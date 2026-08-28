import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createAssetChannel, createAssetStore, serveAsset } from '../src/host/assets.ts'
import { apply as applyHost } from '../src/index.ts'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

function mockRes() {
  const rec: { status: number; body: Buffer } = { status: 0, body: Buffer.alloc(0) }
  return {
    rec,
    writeHead(code: number) {
      rec.status = code
      return this
    },
    end(buf?: Buffer | string) {
      if (buf !== undefined) rec.body = Buffer.isBuffer(buf) ? buf : Buffer.from(buf)
    },
  }
}

describe('asset channel', () => {
  it('serves a token once then 404s', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'go-asset-'))
    const file = join(dir, 'a.png')
    writeFileSync(file, PNG)
    const store = createAssetStore()
    const pub = await store.publish(file, { host: '127.0.0.1', port: 4175 })
    expect(pub.url).toMatch(/^http:\/\/127\.0\.0\.1:4175\/dsh-artifact\/genoffice-asset\//)
    const first = mockRes()
    await serveAsset(store, { url: new URL(pub.url).pathname, method: 'GET' } as never, first as never)
    expect(first.rec.status).toBe(200)
    const second = mockRes()
    await serveAsset(store, { url: new URL(pub.url).pathname, method: 'GET' } as never, second as never)
    expect(second.rec.status).toBe(404)
  })

  it('expired tokens 404 and do not leak the path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'go-asset-'))
    const file = join(dir, 'a.png')
    writeFileSync(file, PNG)
    let now = 1_000
    const store = createAssetStore({ ttlMs: 10, now: () => now })
    const pub = await store.publish(file, { host: '127.0.0.1', port: 9 })
    now = 1_000 + 50
    const res = mockRes()
    await serveAsset(store, { url: new URL(pub.url).pathname, method: 'GET' } as never, res as never)
    expect(res.rec.status).toBe(404)
    expect(res.rec.body.toString()).not.toContain(file)
  })

  it('forged tokens 404', async () => {
    const store = createAssetStore()
    const res = mockRes()
    await serveAsset(
      store,
      { url: '/dsh-artifact/genoffice-asset/00000000-0000-4000-8000-000000000000', method: 'GET' } as never,
      res as never,
    )
    expect(res.rec.status).toBe(404)
  })

  it('createAssetChannel without webServer does not throw', () => {
    const ctx = { inject: vi.fn(() => {}) }
    expect(() => createAssetChannel(ctx as never)).not.toThrow()
    expect(() => applyHost({
      effect: vi.fn((fn: () => unknown) => { fn() }),
      inject: vi.fn(() => {}),
      tools: { register: vi.fn() },
    } as never)).not.toThrow()
  })
})
