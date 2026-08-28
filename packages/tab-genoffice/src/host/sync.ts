/**
 * Host-side sync window: while the control iframe remounts after a save/reload,
 * tool calls must say 「文档正在同步」 instead of 「执行器未注册」 (BR-010).
 *
 * The browser posts `{ path }` to this same-origin route before remounting.
 * Host `*_save` also marks the window after a successful export.
 * Route mounting lives in the standard host facet (src/standard/host.ts).
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

export const SYNC_ROUTE = '/dsh-artifact/genoffice-sync'
export const SYNC_WINDOW_MS = 8_000

const windows = new Map<string, number>()
const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

export function markSyncWindow(path: string, now = Date.now()): void {
  if (!path.startsWith('/')) return
  windows.set(path, now + SYNC_WINDOW_MS)
}

export function isInSyncWindow(path: string, now = Date.now()): boolean {
  const exp = windows.get(path)
  if (exp === undefined) return false
  if (now > exp) {
    windows.delete(path)
    return false
  }
  return true
}

export function clearSyncWindow(path: string): void {
  windows.delete(path)
}

/** Test helper. */
export function resetSyncWindows(): void {
  windows.clear()
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

export async function handleSyncRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const origin = req.headers.origin
  if (origin !== undefined && !LOOPBACK_ORIGIN.test(origin)) {
    res.writeHead(403).end()
    return
  }
  if ((req.method ?? 'GET') !== 'POST') {
    res.writeHead(405).end()
    return
  }
  let path = ''
  try {
    const body = JSON.parse(await readBody(req)) as { path?: unknown }
    path = typeof body.path === 'string' ? body.path : ''
  } catch {
    res.writeHead(400).end()
    return
  }
  if (!path.startsWith('/')) {
    res.writeHead(400).end()
    return
  }
  markSyncWindow(path)
  res.writeHead(204).end()
}
