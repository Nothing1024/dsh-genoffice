/**
 * Host route that can spawn the GenOffice relay from a configured checkout.
 * Modeled on sync.ts: loopback origin, exact path. Route mounting lives in
 * the standard host facet (src/standard/host.ts).
 */
import { spawn } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'

export const RELAY_LAUNCH_ROUTE = '/dsh-artifact/genoffice-relay'
const HEALTH = 'http://localhost:8787/api/health'
const POLL_MS = 250
const TIMEOUT_MS = 10_000
const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

let inFlight: Promise<{ ok: true } | { ok: false; error: 'timeout' }> | null = null

export function isRelayLaunchConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const root = env.DSH_GENOFFICE_ROOT
  if (typeof root !== 'string' || root === '') return false
  try {
    accessSync(join(root, 'scripts/dev.mjs'), constants.R_OK)
    return true
  } catch {
    return false
  }
}

async function pollHealth(deadline: number): Promise<boolean> {
  while (Date.now() < deadline) {
    try {
      const resp = await fetch(HEALTH, { signal: AbortSignal.timeout(500) })
      if (resp.ok) {
        // ready:false = zombie instance (static roots gone) — treat as not up
        // so start-relay gets spawned and replaces it. Old relays lack `ready`.
        const data = (await resp.json().catch(() => ({}))) as { ok?: unknown; ready?: unknown }
        if (data.ok === true && data.ready !== false) return true
      }
    } catch {
      /* still down */
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
  return false
}

async function spawnRelay(): Promise<{ ok: true } | { ok: false; error: 'timeout' }> {
  if (inFlight !== null) return inFlight
  const root = process.env.DSH_GENOFFICE_ROOT ?? ''
  const script = join(root, 'scripts/dev.mjs')
  inFlight = (async () => {
    try {
      if (await pollHealth(Date.now() + POLL_MS)) return { ok: true as const }
      const child = spawn(process.execPath, [script, 'start-relay'], {
        detached: true,
        stdio: 'ignore',
      })
      child.unref()
      const up = await pollHealth(Date.now() + TIMEOUT_MS)
      return up ? { ok: true as const } : { ok: false as const, error: 'timeout' as const }
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

export async function handleRelayLaunchRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const origin = req.headers.origin
  if (origin !== undefined && !LOOPBACK_ORIGIN.test(origin)) {
    res.writeHead(403).end()
    return
  }
  const method = req.method ?? 'GET'
  if (method === 'GET') {
    writeJson(res, 200, { configured: isRelayLaunchConfigured() })
    return
  }
  if (method !== 'POST') {
    res.writeHead(405).end()
    return
  }
  if (!isRelayLaunchConfigured()) {
    writeJson(res, 200, { ok: false, error: 'not configured' })
    return
  }
  writeJson(res, 200, await spawnRelay())
}

/** Test helper. */
export function resetRelayLaunch(): void {
  inFlight = null
}
