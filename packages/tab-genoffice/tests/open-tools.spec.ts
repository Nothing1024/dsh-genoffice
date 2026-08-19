import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONTROL_TOOL_TABLE } from '../src/host/tool-schema.ts'
import { createControlTools, createOpenTools, registeredToolNames } from '../src/host/tools.ts'

const exec = { signal: new AbortController().signal } as never

afterEach(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('createOpenTools', () => {
  it('registers pptx_open / docx_open / xlsx_open / md_open', () => {
    expect(createOpenTools().map((t) => t.name)).toEqual([
      'pptx_open',
      'docx_open',
      'xlsx_open',
      'md_open',
    ])
  })

  it('is appended to createControlTools and does not drop the control table', () => {
    const names = registeredToolNames({ allTools: true })
    for (const row of CONTROL_TOOL_TABLE) {
      expect(names).toContain(row.name)
    }
    expect(names.filter((n) => n.endsWith('_open'))).toEqual([
      'pptx_open',
      'docx_open',
      'xlsx_open',
      'md_open',
    ])
  })

  it('POSTs /api/open on success and does not hit the control plane', async () => {
    const fetch = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      expect(String(input)).toBe('http://localhost:8787/api/open')
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toEqual({ path: '/tmp/demo.docx' })
      return { ok: true, json: async () => ({ ok: true, path: '/tmp/demo.docx', subscribers: 1 }) }
    })
    vi.stubGlobal('fetch', fetch)
    const tool = createOpenTools().find((t) => t.name === 'docx_open')
    expect(tool).toBeDefined()
    const result = await tool!.execute({ path: '/tmp/demo.docx' }, exec)
    expect(result).toEqual({
      ok: true,
      output: '已发送打开指令：/tmp/demo.docx',
      summary: '打开文件',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(String(fetch.mock.calls[0]?.[0])).not.toContain('/api/control')
    expect(tool!.presentCall({ path: '/tmp/demo.docx' }).kind).toBe('read')
  })

  it('fails when the relay reports a missing file', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: false, error: 'file not found' }),
    })))
    const tool = createOpenTools().find((t) => t.name === 'pptx_open')
    await expect(tool!.execute({ path: '/tmp/missing.pptx' }, exec)).rejects.toThrow(
      'open failed: file not found',
    )
  })

  it('rejects a relative path before calling the relay', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const tool = createOpenTools().find((t) => t.name === 'docx_open')
    await expect(tool!.execute({ path: 'foo.docx' }, exec)).rejects.toThrow('绝对路径')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a path whose extension does not match the tool', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const tool = createOpenTools().find((t) => t.name === 'pptx_open')
    await expect(tool!.execute({ path: '/tmp/a.docx' }, exec)).rejects.toThrow('.pptx')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fails when the relay is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('fetch failed')
    }))
    const tool = createOpenTools().find((t) => t.name === 'xlsx_open')
    await expect(tool!.execute({ path: '/tmp/book.xlsx' }, exec)).rejects.toThrow(
      'open failed: fetch failed',
    )
  })
})
