/**
 * One-shot loopback asset channel for `docx_insert_image` (BR-016).
 * Token dies on first GET or after TTL; missing webServer → channel unavailable.
 *
 * Reads bytes with node:fs — this plugin has no `ctx.fs` service.
 */
import { readFile, stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { lookupWebServer } from './lookup.ts'

export const ASSET_PREFIX = '/dsh-artifact/genoffice-asset'
export const TOKEN_TTL_MS = 60_000
export const MAX_ASSET_BYTES = 20 * 1024 * 1024

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

export interface PublishedAsset {
  url: string
  token: string
  dispose: () => void
}

export interface AssetChannel {
  readonly available: boolean
  publish(absPath: string): Promise<PublishedAsset>
}

interface TokenRow {
  absPath: string
  expires: number
}

export interface AssetStore {
  publish(absPath: string, bind: { host: string; port: number }): Promise<PublishedAsset>
  take(token: string, now?: number): TokenRow | undefined
  peek(token: string): TokenRow | undefined
  clear(): void
}

function assertSafeImagePath(absPath: string): string {
  if (!absPath.startsWith('/')) {
    throw new Error('imagePath 必须是本机绝对路径')
  }
  if (absPath.split('/').includes('..')) {
    throw new Error('imagePath 不得包含 ..')
  }
  if (/^https?:\/\//i.test(absPath)) {
    throw new Error('插图只接受本机路径，不接受公网 URL（BR-016）')
  }
  const ext = extname(absPath).toLowerCase()
  if (MIME[ext] === undefined) {
    throw new Error('仅支持 png / jpeg / webp / gif')
  }
  return ext
}

export function createAssetStore(opts?: { ttlMs?: number; now?: () => number }): AssetStore {
  const ttl = opts?.ttlMs ?? TOKEN_TTL_MS
  const now = opts?.now ?? Date.now
  const tokens = new Map<string, TokenRow>()

  return {
    async publish(absPath, bind) {
      const ext = assertSafeImagePath(absPath)
      const st = await stat(absPath)
      if (!st.isFile()) throw new Error('imagePath 不是文件')
      if (st.size > MAX_ASSET_BYTES) throw new Error('图片超过 20MB')
      void ext
      const token = randomUUID()
      tokens.set(token, { absPath, expires: now() + ttl })
      const host = bind.host === '0.0.0.0' ? '127.0.0.1' : bind.host
      const url = `http://${host}:${bind.port}${ASSET_PREFIX}/${token}`
      return {
        url,
        token,
        dispose: () => { tokens.delete(token) },
      }
    },
    take(token, at) {
      const row = tokens.get(token)
      if (row === undefined) return undefined
      tokens.delete(token)
      if ((at ?? now()) > row.expires) return undefined
      return row
    },
    peek(token) {
      return tokens.get(token)
    },
    clear() {
      tokens.clear()
    },
  }
}

export async function serveAsset(
  store: AssetStore,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if ((req.method ?? 'GET') !== 'GET' && (req.method ?? '') !== 'HEAD') {
    res.writeHead(405).end()
    return
  }
  let pathname = ''
  try {
    pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname
  } catch {
    res.writeHead(400).end()
    return
  }
  const prefix = `${ASSET_PREFIX}/`
  if (!pathname.startsWith(prefix)) {
    res.writeHead(404).end()
    return
  }
  const token = pathname.slice(prefix.length)
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    res.writeHead(404).end()
    return
  }
  const row = store.take(token)
  if (row === undefined) {
    res.writeHead(404).end()
    return
  }
  const ext = extname(row.absPath).toLowerCase()
  const type = MIME[ext]
  if (type === undefined) {
    res.writeHead(404).end()
    return
  }
  try {
    const buf = await readFile(row.absPath)
    if (buf.length > MAX_ASSET_BYTES) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': buf.length,
      'Cache-Control': 'no-store',
    })
    res.end(buf)
  } catch {
    res.writeHead(404).end()
  }
}

/**
 * Prefer `reflect.get` when the service is already provided (external plugins
 * often cannot `inject()` undeclared services). Fall back to nested inject so
 * Electron compositions without webServer still load.
 */
export function createAssetChannel(ctx: Context): AssetChannel {
  const store = createAssetStore()
  const bind = { host: '127.0.0.1', port: 0, ready: false }

  const mount = (http: Context['webServer']): (() => void) => {
    bind.host = http.host === '0.0.0.0' ? '127.0.0.1' : http.host
    bind.port = http.port
    bind.ready = true
    const disposeRoute = http.register({
      kind: 'prefix',
      path: ASSET_PREFIX,
      handler: (req, res) => { void serveAsset(store, req, res) },
    })
    return () => {
      bind.ready = false
      disposeRoute()
      store.clear()
    }
  }

  const existing = lookupWebServer(ctx)
  if (existing !== undefined) {
    ctx.effect(() => mount(existing))
  } else {
    ctx.inject(['webServer'], (c) => mount(c.webServer))
  }

  return {
    get available() {
      return bind.ready
    },
    publish(absPath) {
      if (!bind.ready) {
        return Promise.reject(new Error('资产通道不可用：当前组合没有 webServer'))
      }
      return store.publish(absPath, { host: bind.host, port: bind.port })
    },
  }
}
