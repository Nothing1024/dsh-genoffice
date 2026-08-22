import { describe, expect, it } from 'vitest'
import { createControlTools } from '../src/host/tools.ts'

const fakeAssets = {
  available: true,
  publish: async () => ({ url: 'http://127.0.0.1:9/t', token: 't', dispose: () => {} }),
}

function present(name: string, args: Record<string, unknown>) {
  const tool = createControlTools({ assets: fakeAssets }).find((t) => t.name === name)
  expect(tool, name).toBeDefined()
  expect(tool?.presentCall).toBeTypeOf('function')
  // defineTool validates softly and returns undefined on schema mismatch.
  const view = tool!.presentCall!(args)
  expect(view, name).toBeDefined()
  return view!
}

describe('presentCall deliverables join', () => {
  it.each(['docx_save', 'markdown_save', 'xlsx_save', 'pptx_save', 'pdf_save'] as const)(
    '%s is a generic edit with locations so 「产物」 can list the file',
    (name) => {
      const view = present(name, { path: '/tmp/genoffice-e2e/demo.bin' })
      expect(view.card).toBe('generic')
      if (view.card !== 'generic') return
      expect(view.kind).toBe('edit')
      expect(view.locations).toEqual([{ path: '/tmp/genoffice-e2e/demo.bin' }])
    },
  )

  it('does not list in-iframe edits (disk would be stale until save)', () => {
    const view = present('docx_replace_blocks', {
      path: '/tmp/genoffice-e2e/demo.docx',
      startBlockIndex: 0,
      endBlockIndex: 0,
      html: '<p>x</p>',
    })
    expect(view.card).toBe('generic')
    if (view.card !== 'generic') return
    expect(view.kind).toBe('edit')
    expect(view.locations).toBeUndefined()
  })

  it('does not list open/read calls', () => {
    const open = present('docx_open', { path: '/tmp/genoffice-e2e/demo.docx' })
    expect(open.card).toBe('generic')
    if (open.card === 'generic') {
      expect(open.kind).toBe('read')
      expect(open.locations).toBeUndefined()
    }
    const read = present('docx_get_document_context', { path: '/tmp/genoffice-e2e/demo.docx' })
    expect(read.card).toBe('generic')
    if (read.card === 'generic') {
      expect(read.kind).toBe('read')
      expect(read.locations).toBeUndefined()
    }
  })

  it('omits locations when save path is not absolute', () => {
    const view = present('docx_save', { path: 'relative.docx' })
    expect(view.card).toBe('generic')
    if (view.card !== 'generic') return
    expect(view.locations).toBeUndefined()
  })
})
