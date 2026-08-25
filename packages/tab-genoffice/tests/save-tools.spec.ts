import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyControlError } from '../src/host/errors.ts'
import { isInSyncWindow, resetSyncWindows } from '../src/host/sync.ts'
import { createControlTools } from '../src/host/tools.ts'

const exec = { signal: new AbortController().signal } as never

function saveTool() {
  const tool = createControlTools().find((t) => t.name === 'docx_save')
  expect(tool).toBeDefined()
  return tool!
}

afterEach(() => {
  vi.unstubAllGlobals()
  resetSyncWindows()
})

beforeEach(() => {
  vi.unstubAllGlobals()
  resetSyncWindows()
})

describe('saveViaRelay', () => {
  it('skips markSyncWindow when mtimeMs is a number', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, path: '/tmp/a.docx', mtimeMs: 123 }),
    })))
    const result = await saveTool().execute({ path: '/tmp/a.docx' }, exec)
    expect(result.output).toMatch(/已保存到/)
    expect(isInSyncWindow('/tmp/a.docx')).toBe(false)
  })

  it('marks the sync window when mtimeMs is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, path: '/tmp/a.docx' }),
    })))
    await saveTool().execute({ path: '/tmp/a.docx' }, exec)
    expect(isInSyncWindow('/tmp/a.docx')).toBe(true)
  })

  it('save_as success never marks the sync window', async () => {
    const fetch = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { saveAs?: string }
      expect(body.saveAs).toBe('/tmp/b.docx')
      return { ok: true, json: async () => ({ ok: true, path: '/tmp/b.docx', mtimeMs: 1 }) }
    })
    vi.stubGlobal('fetch', fetch)
    const result = await saveTool().execute({ path: '/tmp/a.docx', save_as: '/tmp/b.docx' }, exec)
    expect(result.output).toBe('已另存为 /tmp/b.docx')
    expect(isInSyncWindow('/tmp/a.docx')).toBe(false)
  })

  it('rejects a relative save_as before calling relay', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(saveTool().execute({ path: '/tmp/a.docx', save_as: 'b.docx' }, exec)).rejects.toThrow(/绝对路径/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('maps save_as exists to write-conflict', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: false, error: 'exists' }),
    })))
    await expect(saveTool().execute({ path: '/tmp/a.docx', save_as: '/tmp/b.docx' }, exec)).rejects.toThrow(
      /换个名字或删除既有副本/,
    )
    expect(classifyControlError({ error: 'exists' }).class).toBe('write-conflict')
  })
})
