import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTROL_TOOL_TABLE } from '../src/host/tool-schema.ts'

const toolsSrc = readFileSync(resolve(import.meta.dirname, '../src/host/tools.ts'), 'utf8')

function row(skillName: string, app = 'slides') {
  const found = CONTROL_TOOL_TABLE.find((item) => item.skillName === skillName && item.app === app)
  if (found === undefined) throw new Error(`missing ${app}:${skillName}`)
  return found
}

describe('control tool field contract', () => {
  it('edit_table_cell declares row/col/paragraphs and rejects legacy cellId/text', () => {
    const params = row('edit_table_cell').parameters
    expect(params.cellId).toBeUndefined()
    expect(params.text).toBeUndefined()
    expect(params.row).toMatchObject({ type: 'integer', required: true })
    expect(params.col).toMatchObject({ type: 'integer', required: true })
    expect(params.paragraphs).toMatchObject({ type: 'array', required: true })
    expect(row('edit_table_cell').description).not.toMatch(/网页版不可用/)
  })

  it('edit_table_structure uses kind/index/before not action addRow', () => {
    const params = row('edit_table_structure').parameters
    expect(params.action).toBeUndefined()
    expect(JSON.stringify(params.kind)).toContain('insert-row')
    expect(JSON.stringify(params.kind)).toContain('delete-col')
    expect(params.index).toBeTruthy()
  })

  it('add_chart and edit_chart use top-level series/dataSource not a data wrapper', () => {
    const add = row('add_chart').parameters
    const edit = row('edit_chart').parameters
    expect(add.data).toBeUndefined()
    expect(edit.data).toBeUndefined()
    expect(JSON.stringify(add.dataSource)).toContain('sample')
    expect(add.categories).toBeTruthy()
    expect(add.series).toBeTruthy()
    expect(JSON.stringify(edit.kind)).toContain('barStacked')
  })

  it('apply_ops documents EMU, target addressing, dry_run and the 50-op cap', () => {
    const apply = row('apply_ops')
    expect(apply.description).toMatch(/9525/)
    expect(apply.description).toMatch(/target:\{slide/)
    expect(apply.description).toMatch(/dry_run/)
    expect(apply.description).toMatch(/50/)
    expect(apply.parameters.dry_run).toBeTruthy()
    expect(apply.parameters.ops).toBeTruthy()
  })

  it('land_pages wrappers do not retry timed-out writes', () => {
    expect(toolsSrc).not.toContain('callRelayRetry')
    expect(toolsSrc).toMatch(/async function executeLandPages[\s\S]*await callRelay\(landPagesEntry/)
    expect(toolsSrc).toMatch(/落页写入回执不确定/)
    for (const skill of ['land_pages', 'generate_deck', 'regenerate_slide']) {
      expect(row(skill).description).toMatch(/不会自动重放/)
    }
  })
})
