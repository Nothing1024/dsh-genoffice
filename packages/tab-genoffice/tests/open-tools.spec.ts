import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONTROL_TOOL_TABLE } from '../src/host/tool-schema.ts'
import { createControlTools, createOpenTools, registeredToolNames } from '../src/host/tools.ts'

const exec = { signal: new AbortController().signal } as never

function mockOpenFetch(handlers: {
  open?: (body: Record<string, unknown>) => unknown
  ready?: () => unknown
}): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: RequestInfo, init?: RequestInit) => {
    const url = String(input)
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
    if (url.endsWith('/api/open')) {
      return { ok: true, json: async () => handlers.open?.(body) ?? { ok: true, path: body.path, subscribers: 1 } }
    }
    if (url.endsWith('/api/control/open')) {
      return { ok: true, json: async () => handlers.ready?.() ?? { ok: true, path: body.path, registered: true } }
    }
    throw new Error(`unexpected fetch ${url}`)
  })
}

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

  it('describes *_open as the mandatory first step and forbids script bypass', () => {
    const pptx = createOpenTools().find((t) => t.name === 'pptx_open')
    expect(pptx?.description).toMatch(/必做第一步/)
    expect(pptx?.description).toMatch(/已打开控制模式/)
    expect(pptx?.description).toMatch(/ppt-image-first/)
    expect(pptx?.description).toMatch(/python-pptx/)
  })

  it('tells control tools to wait for *_open first', () => {
    const deck = createControlTools().find((t) => t.name === 'pptx_get_deck_context')
    expect(deck?.description).toMatch(/pptx_open/)
    expect(deck?.description).toMatch(/已打开控制模式/)
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

  it('POSTs /api/open then waits until the executor is registered', async () => {
    const fetch = mockOpenFetch({
      open: (body) => {
        expect(body).toEqual({ path: '/tmp/demo.docx' })
        return { ok: true, path: '/tmp/demo.docx', subscribers: 1 }
      },
    })
    vi.stubGlobal('fetch', fetch)
    const tool = createOpenTools().find((t) => t.name === 'docx_open')
    expect(tool).toBeDefined()
    const result = await tool!.execute({ path: '/tmp/demo.docx' }, exec)
    expect(result).toEqual({
      ok: true,
      output: '已打开控制模式：/tmp/demo.docx',
      summary: '打开文件',
    })
    expect(fetch.mock.calls.map((c) => String(c[0]))).toEqual([
      'http://localhost:8787/api/open',
      'http://localhost:8787/api/control/open',
    ])
    const presented = tool?.presentCall?.({ path: '/tmp/demo.docx' })
    expect(presented?.card).toBe('generic')
    if (presented?.card === 'generic') expect(presented.kind).toBe('read')
  })

  it('includes the calling agent sessionId so other DSH pages do not steal the open', async () => {
    const fetch = mockOpenFetch({
      open: (body) => {
        expect(body).toEqual({ path: '/tmp/demo.docx', sessionId: 'session-a' })
        return { ok: true, path: '/tmp/demo.docx', subscribers: 2 }
      },
    })
    vi.stubGlobal('fetch', fetch)
    const tool = createOpenTools().find((t) => t.name === 'docx_open')
    const scoped = {
      signal: new AbortController().signal,
      agent: { id: 'session-a' },
    } as never
    await tool!.execute({ path: '/tmp/demo.docx' }, scoped)
    expect(String(fetch.mock.calls[0]?.[0])).toBe('http://localhost:8787/api/open')
  })

  it('polls until relay reports the executor registered', async () => {
    let n = 0
    const fetch = mockOpenFetch({
      ready: () => {
        n += 1
        return { ok: true, path: '/tmp/demo.pptx', registered: n >= 3 }
      },
    })
    vi.stubGlobal('fetch', fetch)
    const tool = createOpenTools().find((t) => t.name === 'pptx_open')
    await tool!.execute({ path: '/tmp/demo.pptx' }, exec)
    expect(n).toBe(3)
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
