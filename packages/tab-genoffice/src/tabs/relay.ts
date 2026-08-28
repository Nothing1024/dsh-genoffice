/**
 * GenOffice relay loopback: shared by the file-list panel and the control-mode
 * viewer. Probe state is a module-level store so both surfaces show one strip.
 */

/** The genoffice relay base (loopback; CORS loopback whitelist covers it). */
export const RELAY_BASE = 'http://localhost:8787'

export const PREVIEWABLE: Record<string, string> = {
  docx: 'docs',
  md: 'markdown',
  xlsx: 'sheets',
  pptx: 'slides',
  pdf: 'pdf',
}

const RELAY_THROTTLE_MS = 1500

type RelayListener = () => void

let relayOk: boolean | null = null
/** null = 未探测/relay 不可达；false = API 活着但静态根丢失（contracts/relay-api.md health.ready）。 */
let relayReady: boolean | null = null
let lastProbeAt = 0
let inFlight: Promise<boolean> | null = null
const listeners = new Set<RelayListener>()

type OpenFileListener = (path: string) => void
const openFileListeners = new Set<OpenFileListener>()

export function getRelayOk(): boolean | null {
  return relayOk
}

export function getRelayReady(): boolean | null {
  return relayReady
}

export function subscribeRelay(fn: RelayListener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function emitRelay(): void {
  for (const fn of listeners) fn()
}

/** Update the shared flag without a network round-trip (list fetch already proved it). */
export function noteRelayOk(ok: boolean): void {
  if (relayOk === ok) return
  relayOk = ok
  lastProbeAt = Date.now()
  emitRelay()
}

/** Test helper — not for production. */
export function resetRelayStore(): void {
  relayOk = null
  relayReady = null
  lastProbeAt = 0
  inFlight = null
  openFileListeners.clear()
}

export function extOf(path: string): string {
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  const base = slash < 0 ? path : path.slice(slash + 1)
  const dot = base.lastIndexOf('.')
  return dot < 0 ? '' : base.slice(dot + 1).toLowerCase()
}

export async function docIdFor(absPath: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(absPath))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Control mode adds `control=1`; `_r` busts the iframe after save/reload (BR-014). */
export function previewUrlFor(path: string, ext: string, control: boolean, nonce?: string): string {
  const app = PREVIEWABLE[ext]
  if (app === undefined) return ''
  const target = encodeURIComponent(`path:${path}`)
  const extra = nonce !== undefined && nonce !== '' ? `&_r=${encodeURIComponent(nonce)}` : ''
  return `${RELAY_BASE}/${app}/?${control ? 'control=1&' : ''}open=${target}${extra}`
}

export interface RelayHealth {
  up: boolean
  ready: boolean
}

/** Raw health probe (no store). Old relays without `ready` count as ready. */
export async function checkRelay(signal?: AbortSignal): Promise<RelayHealth> {
  try {
    const resp = await fetch(
      `${RELAY_BASE}/api/health`,
      signal === undefined ? undefined : { signal },
    )
    if (!resp.ok) return { up: false, ready: false }
    let ready = true
    try {
      const data = (await resp.json()) as { ready?: unknown }
      ready = data.ready !== false
    } catch {
      // non-JSON health (old relay / test stub) — assume ready
    }
    return { up: true, ready }
  } catch {
    return { up: false, ready: false }
  }
}

/** Shared probe with throttle. `force` bypasses throttle (「重新检查」). */
export async function probeRelay(force = false, signal?: AbortSignal): Promise<boolean> {
  const now = Date.now()
  if (!force && inFlight !== null) return inFlight
  if (!force && relayOk !== null && now - lastProbeAt < RELAY_THROTTLE_MS) return relayOk
  lastProbeAt = now
  inFlight = checkRelay(signal).then((h) => {
    relayOk = h.up
    relayReady = h.up ? h.ready : null
    emitRelay()
    return h.up
  }).finally(() => {
    inFlight = null
  })
  return inFlight
}

export async function probeRelayLaunch(): Promise<boolean> {
  try {
    const resp = await fetch(`${window.location.origin}/dsh-artifact/genoffice-relay`)
    if (!resp.ok) return false
    const data = (await resp.json()) as { configured?: boolean }
    return data.configured === true
  } catch {
    return false
  }
}

export async function launchRelay(): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch(`${window.location.origin}/dsh-artifact/genoffice-relay`, { method: 'POST' })
    const data = (await resp.json()) as { ok?: boolean; error?: string }
    return typeof data.error === 'string'
      ? { ok: data.ok === true, error: data.error }
      : { ok: data.ok === true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function notifyHostSync(path: string): Promise<void> {
  try {
    await fetch(`${window.location.origin}/dsh-artifact/genoffice-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
  } catch {
    // Electron / missing webServer: host saveViaRelay still marks the window.
  }
}

export function subscribeOpenFile(fn: OpenFileListener): () => void {
  openFileListeners.add(fn)
  return () => { openFileListeners.delete(fn) }
}

/** Dispatch a file path to all subscribeOpenFile listeners (used by the client-level SSE handler). */
export function emitOpenFile(filePath: string): void {
  for (const fn of openFileListeners) fn(filePath)
}

/**
 * Deliver an open path to the mounted panel. If no listener is up yet
 * (tab still opening), wait `delayMs` once; cancel the timer on dispose.
 */
export function scheduleOpenFile(filePath: string, delayMs = 300): () => void {
  if (openFileListeners.size > 0) {
    emitOpenFile(filePath)
    return () => {}
  }
  const timer = setTimeout(() => emitOpenFile(filePath), delayMs)
  return () => clearTimeout(timer)
}

/** Test helper: EventSource → emitOpenFile. Production uses apply()'s single stream. */
export function startOpenFileStream(): () => void {
  const es = new EventSource(`${RELAY_BASE}/api/open/stream`)
  es.addEventListener('file', (ev: MessageEvent) => {
    try {
      const data = JSON.parse(ev.data) as { path?: unknown }
      if (typeof data.path === 'string' && data.path !== '') emitOpenFile(data.path)
    } catch { /* malformed event, ignore */ }
  })
  return () => es.close()
}
