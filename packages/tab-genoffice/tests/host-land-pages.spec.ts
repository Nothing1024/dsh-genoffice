import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CAPABILITY } from '../src/host/capability.ts'
import { classifyControlError } from '../src/host/errors.ts'
import { coercePagesSpec, pageSpecFromOutline, parseOutline, parsePageSpecLike, planDeckPages } from '../src/host/page-plan.ts'
import { CONTROL_TOOL_TABLE } from '../src/host/tool-schema.ts'
import { createControlTools } from '../src/host/tools.ts'

const PAGE = {
  background: '#16395C',
  elements: [
    { type: 'text', x: 80, y: 80, w: 1120, h: 80, paragraphs: [{ runs: [{ text: 'Hello' }] }] },
  ],
}

const PAGE_B = {
  background: '#0F2740',
  elements: [
    { type: 'text', x: 80, y: 80, w: 1120, h: 80, paragraphs: [{ runs: [{ text: 'Second' }] }] },
  ],
}

const OUTLINE = {
  core_hook: '营收+18',
  pages: [
    { title: '封面', type: 'cover', brief: '主标题与钩子', layout: 'cover_dark_minimal' },
    { title: '要点', type: 'content', brief: '三项进展', layout: 'three_column_cards' },
    { title: '收束', type: 'closing', brief: '下一步', layout: 'closing_thank_you' },
  ],
}

const exec = { signal: new AbortController().signal } as never

function contextOutput(n: number, filled: boolean): string {
  const pages = Array.from({ length: n }, (_, i) => {
    const body = filled
      ? `Page ${i + 1} (slideIndex=${i}):\n  - e_${i} | text | "${i === 0 ? 'Hello' : `P${i + 1}`}"`
      : `Page ${i + 1} (slideIndex=${i}):\n(Use read_slide to see element positions/sizes/colors)`
    return body
  }).join('\n')
  return `The presentation has ${n} pages; page 1 is currently shown. Canvas 1280×720px.\n${pages}`
}

function mockToolFetch(opts?: { contextLag?: number }): ReturnType<typeof vi.fn> {
  let contextHits = 0
  let lastCount = 1
  return vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { call?: { name?: string; input?: Record<string, unknown> } }
    const name = String(body.call?.name ?? '')
    if (name === 'get_deck_context') {
      contextHits += 1
      const ready = contextHits > (opts?.contextLag ?? 0)
      const n = ready ? lastCount : 1
      return {
        ok: true,
        json: async () => ({
          ok: true,
          execution: { output: contextOutput(n, ready), isError: false, mutated: false, summary: 'context' },
        }),
      }
    }
    const pages = Array.isArray(body.call?.input?.pages) ? body.call.input.pages.length : 1
    const insert = String(body.call?.input?.insert_mode ?? 'replace')
    lastCount = insert === 'replace_at' ? Math.max(pages, 3) : pages
    return {
      ok: true,
      json: async () => ({
        ok: true,
        execution: {
          output: `Landed ${pages} host-authored page(s) (insert_mode:${insert}). Deck now has ${lastCount} page(s).`,
          isError: false,
          mutated: true,
          summary: String(body.call?.name),
        },
      }),
    }
  })
}

function tools(opts: Parameters<typeof createControlTools>[0] = {}) {
  return createControlTools({ landSettleMs: 0, landPollMs: 0, ...opts })
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pptx_land_pages registration', () => {
  it('is in the control table with skillName land_pages and available capability', () => {
    const row = CONTROL_TOOL_TABLE.find((r) => r.name === 'pptx_land_pages')
    expect(row?.skillName).toBe('land_pages')
    expect(row?.parameters.path).toBeTruthy()
    expect(row?.parameters.pages).toHaveProperty('required', true)
    expect(CAPABILITY['slides:land_pages']?.status).toBe('available')
    expect(tools().map((t) => t.name)).toContain('pptx_land_pages')
  })

  it('generate_deck / regenerate_slide no longer mention iframe BYOK', () => {
    const deck = CONTROL_TOOL_TABLE.find((r) => r.name === 'pptx_generate_deck')
    const regen = CONTROL_TOOL_TABLE.find((r) => r.name === 'pptx_regenerate_slide')
    expect(deck?.description).not.toMatch(/genspark/i)
    expect(deck?.description).not.toMatch(/no local LLM/)
    expect(deck?.parameters.pages_spec).toBeTruthy()
    expect(regen?.description).not.toMatch(/genspark/i)
    expect(regen?.parameters.page_spec).toBeTruthy()
  })
})

describe('pptx_generate_deck host land_pages', () => {
  it('POSTs land_pages not generate_deck when pages_spec is provided', async () => {
    const fetch = mockToolFetch()
    vi.stubGlobal('fetch', fetch)
    const tool = tools({
      planLlm: async () => {
        throw new Error('LLM must not run when pages_spec is present')
      },
    }).find((t) => t.name === 'pptx_generate_deck')
    expect(tool).toBeDefined()
    const result = await tool!.execute(
      { path: '/tmp/demo.pptx', pages_spec: [PAGE] },
      exec,
    )
    expect(result).toMatchObject({ ok: true })
    expect(String((result as { output: string }).output)).toMatch(/land_pages|Landed/)
    const land = fetch.mock.calls.find((c) => String(c[1]?.body ?? '').includes('"land_pages"'))
    expect(land).toBeDefined()
    const body = JSON.parse(String(land?.[1]?.body)) as {
      call: { name: string; input: Record<string, unknown> }
    }
    expect(body.call.name).toBe('land_pages')
    expect(body.call.input.path).toBeUndefined()
    expect(body.call.input.pages).toEqual([PAGE])
    expect(body.call.input.insert_mode).toBe('replace')
  })

  it('plans with the session-model seam then lands, never calling generate_deck', async () => {
    const fetch = mockToolFetch()
    vi.stubGlobal('fetch', fetch)
    const prompts: string[] = []
    let llmCalls = 0
    const tool = tools({
      planLlm: async (system) => {
        llmCalls += 1
        prompts.push(system.slice(0, 40))
        if (system.includes('deck planner')) return JSON.stringify(OUTLINE)
        return JSON.stringify(llmCalls === 2 ? PAGE : PAGE_B)
      },
    }).find((t) => t.name === 'pptx_generate_deck')
    const result = await tool!.execute(
      { path: '/tmp/demo.pptx', topic: '季度复盘', approx_pages: 3 },
      exec,
    )
    expect(result).toMatchObject({ ok: true })
    expect(llmCalls).toBe(4)
    expect(prompts[0]).toMatch(/deck planner/)
    const land = fetch.mock.calls.find((c) => String(c[1]?.body ?? '').includes('"land_pages"'))
    expect(land).toBeDefined()
    const body = JSON.parse(String(land?.[1]?.body)) as { call: { name: string; input: { pages: unknown[]; insert_mode: string } } }
    expect(body.call.name).toBe('land_pages')
    expect(body.call.input.pages).toHaveLength(3)
    expect(body.call.input.insert_mode).toBe('replace')
    expect(fetch.mock.calls.some((c) => String(c[1]?.body ?? '').includes('"generate_deck"'))).toBe(false)
  })

  it('retries outline parse once then lands', async () => {
    const fetch = mockToolFetch()
    vi.stubGlobal('fetch', fetch)
    let n = 0
    const tool = tools({
      planLlm: async (system) => {
        n += 1
        if (system.includes('deck planner')) {
          if (n === 1) return 'not json'
          return JSON.stringify(OUTLINE)
        }
        return JSON.stringify(PAGE)
      },
    }).find((t) => t.name === 'pptx_generate_deck')
    const result = await tool!.execute(
      { path: '/tmp/demo.pptx', topic: '季度复盘', approx_pages: 3 },
      exec,
    )
    expect(result).toMatchObject({ ok: true })
    const land = fetch.mock.calls.find((c) => String(c[1]?.body ?? '').includes('"land_pages"'))
    const body = JSON.parse(String(land?.[1]?.body)) as { call: { input: { pages: unknown[] } } }
    expect(body.call.input.pages).toHaveLength(3)
  })

  it('surfaces planning failed: without posting generate_deck', async () => {
    const fetch = mockToolFetch()
    vi.stubGlobal('fetch', fetch)
    const tool = tools({
      planLlm: async () => '',
    }).find((t) => t.name === 'pptx_generate_deck')
    await expect(
      tool!.execute({ path: '/tmp/demo.pptx' }, exec),
    ).rejects.toThrow(/planning failed:/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('surfaces planning failed: when the session model returns empty JSON', async () => {
    const fetch = mockToolFetch()
    vi.stubGlobal('fetch', fetch)
    const tool = tools({
      planLlm: async () => '',
    }).find((t) => t.name === 'pptx_generate_deck')
    await expect(
      tool!.execute({ path: '/tmp/demo.pptx', topic: '季度复盘', approx_pages: 3 }, exec),
    ).rejects.toThrow(/planning failed:/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('polls get_deck_context until page count matches land output', async () => {
    const fetch = mockToolFetch({ contextLag: 1 })
    vi.stubGlobal('fetch', fetch)
    const tool = tools({
      planLlm: async () => {
        throw new Error('unused')
      },
      landSettleMs: 2_000,
      landPollMs: 0,
    }).find((t) => t.name === 'pptx_land_pages')
    const result = await tool!.execute(
      { path: '/tmp/demo.pptx', pages: [PAGE, PAGE_B], insert_mode: 'replace' },
      exec,
    )
    expect(result).toMatchObject({ ok: true })
    const names = fetch.mock.calls.map((c) => {
      const body = JSON.parse(String(c[1]?.body ?? '{}')) as { call?: { name?: string } }
      return body.call?.name
    })
    expect(names[0]).toBe('land_pages')
    expect(names.filter((n) => n === 'get_deck_context').length).toBeGreaterThanOrEqual(2)
  })
})

describe('pptx_regenerate_slide host land_pages', () => {
  it('lands replace_at instead of regenerate_slide', async () => {
    const fetch = mockToolFetch()
    vi.stubGlobal('fetch', fetch)
    const tool = tools({
      planLlm: async () => JSON.stringify(PAGE),
    }).find((t) => t.name === 'pptx_regenerate_slide')
    await tool!.execute({ path: '/tmp/demo.pptx', slideIndex: 0, brief: '重做封面' }, exec)
    const land = fetch.mock.calls.find((c) => String(c[1]?.body ?? '').includes('"land_pages"'))
    const body = JSON.parse(String(land?.[1]?.body)) as {
      call: { name: string; input: Record<string, unknown> }
    }
    expect(body.call.name).toBe('land_pages')
    expect(body.call.input.insert_mode).toBe('replace_at')
    expect(body.call.input.at_index).toBe(0)
    expect(body.call.input.path).toBeUndefined()
  })
})

describe('host PageSpec parse', () => {
  it('accepts a minimal legal spec and rejects empty elements', () => {
    expect(parsePageSpecLike(JSON.stringify(PAGE)).ok).toBe(true)
    expect(parsePageSpecLike('{"elements":[]}').ok).toBe(false)
    expect(coercePagesSpec([PAGE])?.length).toBe(1)
    expect(coercePagesSpec([])).toBeUndefined()
  })

  it('parses the first JSON object when the model concatenates two', () => {
    const raw = '{"core_hook":"钩","pages":[{"title":"A","brief":"b","layout":"cover_dark_minimal"}]}{"core_hook":"x"}'
    const parsed = parseOutline(raw)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.outline.pages).toHaveLength(1)
  })

  it('wires http image_queries into the outline fallback spec', () => {
    const spec = pageSpecFromOutline({
      title: '产品',
      brief: '节奏',
      layout: 'left_text_right_image',
      image_queries: ['https://example.com/a.png', 'not-a-url'],
    }, '钩', false)
    expect(spec.elements.some((el) => el.type === 'image' && el.url === 'https://example.com/a.png')).toBe(true)
    expect(spec.background).toBe('#0F2740')
  })
})

describe('planDeckPages session model', () => {
  it('does not call the model when pages_spec is given', async () => {
    const specs = await planDeckPages(
      { pages_spec: [PAGE] },
      async () => {
        throw new Error('must not run')
      },
      new AbortController().signal,
    )
    expect(specs).toEqual([PAGE])
  })
})

describe('error mapping', () => {
  it('does not tell the model to use 桌面版 GenOffice', () => {
    const guard = classifyControlError({ error: 'blockScratchBuild: blank', kind: 'executor' })
    const cap = classifyControlError({ error: 'not registered', kind: 'capability' })
    const plan = classifyControlError({ error: 'planning failed: empty model output', kind: 'local' })
    expect(guard.message).not.toMatch(/桌面版/)
    expect(cap.message).not.toMatch(/桌面版/)
    expect(plan.message).toMatch(/planning failed:/)
    expect(plan.message).toMatch(/pptx_land_pages/)
  })
})
