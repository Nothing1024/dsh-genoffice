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
let lastProbeAt = 0
let inFlight: Promise<boolean> | null = null
const listeners = new Set<RelayListener>()

export function getRelayOk(): boolean | null {
  return relayOk
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
  lastProbeAt = 0
  inFlight = null
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

/** Raw health probe (no store). */
export async function checkRelay(signal?: AbortSignal): Promise<boolean> {
  try {
    const resp = await fetch(
      `${RELAY_BASE}/api/dir?path=`,
      signal === undefined ? undefined : { signal },
    )
    return resp.ok
  } catch {
    return false
  }
}

/** Shared probe with throttle. `force` bypasses throttle (「重新检查」). */
export async function probeRelay(force = false, signal?: AbortSignal): Promise<boolean> {
  const now = Date.now()
  if (!force && inFlight !== null) return inFlight
  if (!force && relayOk !== null && now - lastProbeAt < RELAY_THROTTLE_MS) return relayOk
  lastProbeAt = now
  inFlight = checkRelay(signal).then((ok) => {
    relayOk = ok
    emitRelay()
    return ok
  }).finally(() => {
    inFlight = null
  })
  return inFlight
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
