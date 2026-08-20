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

const UP = resolve(import.meta.dirname, '../../../../../../genoffice/upstream')

describe('capability filter', () => {
  it('exposes 63 control tools plus 4 open tools when the asset channel is available', () => {
    expect(EXPOSED_COUNT).toBe(63)
    expect(Object.keys(CAPABILITY)).toHaveLength(81)
    const names = registeredToolNames({ assets: fakeAssets })
    expect(names).toHaveLength(67)
    expect(names).toContain('docx_insert_image')
    expect(names).toContain('docx_open')
    expect(names).toContain('pptx_open')
    expect(names).toContain('xlsx_open')
    expect(names).toContain('md_open')
    expect(names).toContain('pptx_add_chart')
    expect(names).toContain('pptx_add_smartart')
    expect(names).not.toContain('docx_web_search')
    expect(names).not.toContain('docx_image_search')
    expect(names).not.toContain('pptx_generate_image')
  })

  it('skips insert_image without webServer and still registers the other 62 control tools plus 4 open tools', () => {
    const names = registeredToolNames()
    expect(names).toHaveLength(66)
    expect(names).not.toContain('docx_insert_image')
    expect(names).toContain('docx_open')
  })

  it('DSH_GENOFFICE_ALL_TOOLS registers 81 control tools plus 4 open tools and labels egress tools', () => {
    const tools = createControlTools({ allTools: true, assets: fakeAssets })
    expect(tools).toHaveLength(85)
    const search = tools.find((t) => t.name === 'docx_web_search')
    expect(search?.description).toMatch(/会向公网发起请求/)
    expect(tools.filter((t) => t.name.endsWith('_open')).map((t) => t.name)).toEqual([
      'pptx_open',
      'docx_open',
      'xlsx_open',
      'md_open',
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
  const present = existsSync(bridge)

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
