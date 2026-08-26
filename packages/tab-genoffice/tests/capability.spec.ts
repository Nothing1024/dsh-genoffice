import { describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CAPABILITY, EXPOSED_COUNT, isExposed } from '../src/host/capability.ts'
import { createControlTools, registeredToolNames } from '../src/host/tools.ts'
import { apply as applyHost } from '../src/index.ts'
import { CONTROL_TOOL_TABLE } from '../src/host/tool-schema.ts'

const fakeAssets = {
  available: true,
  publish: async () => ({ url: 'http://127.0.0.1:9/dsh-artifact/genoffice-asset/t', token: 't', dispose: () => {} }),
}

const UP = resolve(import.meta.dirname, '../../../../engine')

const ASSET_GATED = ['docx_insert_image', 'pdf_insert_image', 'pdf_replace_image'] as const
const OPEN_TOOLS = ['pptx_open', 'docx_open', 'xlsx_open', 'md_open', 'pdf_open'] as const
const tableKeys = CONTROL_TOOL_TABLE.map((row) => `${row.app}:${row.skillName}`)
const exposedNames = CONTROL_TOOL_TABLE
  .filter((row) => {
    const cap = CAPABILITY[`${row.app}:${row.skillName}`]
    return cap !== undefined && isExposed(cap)
  })
  .map((row) => row.name)

describe('capability filter', () => {
  it('covers every CONTROL_TOOL_TABLE row so a new official tool cannot hide behind the filter', () => {
    expect(Object.keys(CAPABILITY).sort()).toEqual([...tableKeys].sort())
    expect(EXPOSED_COUNT).toBe(exposedNames.length)
  })

  it('exposes the capability-available control tools plus 5 open tools when the asset channel is available', () => {
    const names = registeredToolNames({ assets: fakeAssets })
    expect(names).toHaveLength(exposedNames.length + OPEN_TOOLS.length)
    expect(names).toEqual(expect.arrayContaining([...exposedNames, ...OPEN_TOOLS]))
    expect(names).toContain('xlsx_aggregate_range')
    expect(names).toContain('xlsx_find_cells')
    expect(names).toContain('xlsx_select_range')
    expect(names).toContain('xlsx_trace_precedents')
    expect(names).toContain('xlsx_trace_dependents')
    expect(names).toContain('pptx_apply_ops')
    expect(names).toContain('pdf_insert_text')
    expect(names).toContain('docx_insert_image')
    expect(names).toContain('pptx_add_chart')
    expect(names).toContain('pptx_add_smartart')
    expect(names).toContain('pptx_analyze_media')
    expect(names).toContain('pptx_generate_deck')
    expect(names).toContain('pptx_land_pages')
    expect(names).toContain('pptx_regenerate_slide')
    expect(names).toContain('pdf_list_page_images')
    expect(names).toContain('pdf_insert_image')
    expect(names).toContain('pdf_transform_image')
    expect(names).toContain('pdf_rotate_image')
    expect(names).toContain('pdf_replace_image')
    expect(names).toContain('pdf_delete_image')
    expect(names).not.toContain('docx_web_search')
    expect(names).not.toContain('docx_image_search')
    expect(names).not.toContain('pptx_generate_image')
    expect(names).not.toContain('pdf_generate_image')
  })

  it('skips insert/replace image tools without webServer and still registers the other exposed control tools plus 5 open tools', () => {
    const names = registeredToolNames()
    expect(names).toHaveLength(exposedNames.length - ASSET_GATED.length + OPEN_TOOLS.length)
    expect(names).not.toContain('docx_insert_image')
    expect(names).not.toContain('pdf_insert_image')
    expect(names).not.toContain('pdf_replace_image')
    expect(names).toContain('docx_open')
    expect(names).toContain('pdf_list_page_images')
    expect(names).toContain('pdf_delete_image')
    expect(names).toContain('pptx_apply_ops')
    expect(names).toContain('xlsx_aggregate_range')
    expect(names).toContain('pdf_insert_text')
  })

  it('DSH_GENOFFICE_ALL_TOOLS registers every CONTROL_TOOL_TABLE row plus 5 open tools and labels egress tools', () => {
    const tools = createControlTools({ allTools: true, assets: fakeAssets })
    expect(tools).toHaveLength(CONTROL_TOOL_TABLE.length + OPEN_TOOLS.length)
    const search = tools.find((t) => t.name === 'docx_web_search')
    expect(search?.description).toMatch(/会向公网发起请求/)
    expect(tools.filter((t) => t.name.endsWith('_open')).map((t) => t.name)).toEqual([
      'pptx_open',
      'docx_open',
      'xlsx_open',
      'md_open',
      'pdf_open',
    ])
  })

  it('handover wins over status: available + handover stays unregistered', () => {
    expect(isExposed({
      status: 'available',
      netEgress: false,
      handover: 'dsh:pending',
      evidence: 'test',
    })).toBe(false)
    expect(registeredToolNames({ assets: fakeAssets })).not.toContain('pptx_generate_image')
  })

  it('exposed set has zero netEgress and no public url parameter', () => {
    for (const [key, entry] of Object.entries(CAPABILITY)) {
      if (!isExposed(entry)) continue
      expect(entry.netEgress, `${key} leaked netEgress`).toBe(false)
    }
    const names = new Set(registeredToolNames({ assets: fakeAssets }))
    for (const row of CONTROL_TOOL_TABLE) {
      if (!names.has(row.name)) continue
      expect(row.parameters.url, `${row.name} still accepts url (BR-015)`).toBeUndefined()
    }
  })
})

describe('bridge-missing drift', () => {
  const bridge = resolve(UP, 'apps/slides/src/renderer/web-bridge.ts')
  const pdfBridge = resolve(UP, 'apps/pdf/src/renderer/web-bridge.ts')
  const pdfSave = resolve(UP, 'apps/pdf/src/renderer/web-pdf-save.ts')
  const present = existsSync(bridge)

  it.skipIf(!present)('image generate/analyze and pdf image ops are wired (not hardcoded stubs)', () => {
    const slides = readFileSync(bridge, 'utf8')
    expect(slides).not.toContain("网页版暂不支持 Genspark 图片生成")
    expect(slides).not.toContain("网页版暂不支持媒体分析")
    expect(slides).toContain('/generate-image')
    expect(slides).toContain('/analyze-media')
    const pdf = readFileSync(pdfBridge, 'utf8')
    expect(pdf).not.toContain("网页版暂不支持 Genspark 图片生成")
    expect(pdf).toContain('web-image-edit')
    expect(pdf).toContain('/generate-image')
    const save = readFileSync(pdfSave, 'utf8')
    expect(save).not.toContain('网页版暂不支持图片编辑')
    expect(save).toContain("import('./web-image-edit')")
  })

  it.skipIf(!present)('slides generate_deck is local spec→pptx, not a cloud stub', () => {
    const src = readFileSync(bridge, 'utf8')
    expect(src).toContain('localGeneratePage')
    expect(src).toContain('webHtmlToPptx')
    expect(src).toContain("cloudGenStatus: async () => ({ enabled: false })")
    expect(src).not.toContain("网页版暂不支持本地单页生成")
    expect(src).not.toContain("网页版暂不支持 HTML 转 PPTX")
    const deck = CONTROL_TOOL_TABLE.find((r) => r.name === 'pptx_generate_deck')
    const regen = CONTROL_TOOL_TABLE.find((r) => r.name === 'pptx_regenerate_slide')
    const land = CONTROL_TOOL_TABLE.find((r) => r.name === 'pptx_land_pages')
    expect(deck?.parameters.topic).toBeTruthy()
    expect(deck?.parameters.pages).toBeTruthy()
    expect(deck?.parameters.pages_spec).toBeTruthy()
    expect(deck?.parameters.topic).not.toHaveProperty('required')
    expect(regen?.parameters.brief).toBeTruthy()
    expect(regen?.parameters.page_spec).toBeTruthy()
    expect(regen?.parameters.html).toBeUndefined()
    expect(land?.skillName).toBe('land_pages')
    expect(CAPABILITY['slides:generate_deck']?.status).toBe('available')
    expect(CAPABILITY['slides:regenerate_slide']?.status).toBe('available')
    expect(CAPABILITY['slides:land_pages']?.status).toBe('available')
  })

  it.skipIf(!present)('slides bridge-missing skills are still stubs (can un-skip when upstream implements)', () => {
    const src = readFileSync(bridge, 'utf8')
    const hints: Record<string, string> = {
      add_table: 'addTable',
      add_chart: 'addChart',
      add_smartart: 'addSmartArt',
      edit_table_cell: 'editTableCell',
      edit_table_structure: 'tableStructure',
      edit_table_style: 'editTableStyle',
      edit_chart: 'editChart',
      insert_web_image: 'insertImageUrl',
      replace_image: 'replacePictureUrl',
      crop_image: 'editPictureSrcRect',
      set_picture_opacity: 'editPictureOpacity',
      ungroup_element: 'ungroupElement',
    }
    for (const [skill, hint] of Object.entries(hints)) {
      const cap = CAPABILITY[`slides:${skill}`]
      if (cap?.status !== 'bridge-missing') continue
      expect(
        src.includes(`notAvailable('${hint}')`),
        `${skill} 的桥接 ${hint} 已不是 stub，可以放开该工具`,
      ).toBe(true)
    }
  })
})

describe('dsh web_search exists', () => {
  it('the npm dsh-tools platform still references web_search', () => {
    // Migration (BR-002): the vendored tool catalog under vendor/dsh is gone;
    // the public source of truth is the installed @deepseek-ai/dsh-tools
    // package. Assert the web_search tool family is still part of the
    // platform's presentation vocabulary.
    const toolsRoot = resolve(import.meta.dirname, '../../../node_modules/@deepseek-ai/dsh-tools')
    expect(existsSync(toolsRoot)).toBe(true)
    const presentation = resolve(toolsRoot, 'lib/types/presentation.d.ts')
    expect(existsSync(presentation)).toBe(true)
    expect(readFileSync(presentation, 'utf8')).toContain('web_search')
  })
})

describe('host apply without webServer', () => {
  it('does not throw', () => {
    const ctx = {
      inject: vi.fn(() => {}),
      tools: { register: vi.fn() },
    }
    expect(() => applyHost(ctx as never)).not.toThrow()
    expect(ctx.tools.register).toHaveBeenCalled()
  })
})
