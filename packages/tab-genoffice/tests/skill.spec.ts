import { describe, expect, it, vi } from 'vitest'
import { lookupSkills } from '../src/host/lookup.ts'
import {
  applySkill,
  GENOFFICE_SKILL_CONTENT,
  GENOFFICE_SKILL_DESCRIPTION,
  GENOFFICE_SKILL_NAME,
} from '../src/host/skill.ts'

describe('dsh-genoffice runtime skill', () => {
  it('is opt-in and must not auto-route generic PPT requests', () => {
    expect(GENOFFICE_SKILL_NAME).toBe('dsh-genoffice')
    expect(GENOFFICE_SKILL_DESCRIPTION.length).toBeLessThanOrEqual(500)
    expect(GENOFFICE_SKILL_DESCRIPTION).toMatch(/不要主动触发/)
    expect(GENOFFICE_SKILL_DESCRIPTION).toMatch(/\/dsh-genoffice/)
    expect(GENOFFICE_SKILL_DESCRIPTION).toMatch(/pptx_open/)
    expect(GENOFFICE_SKILL_DESCRIPTION).not.toMatch(/ppt-image-first/)
    expect(GENOFFICE_SKILL_DESCRIPTION).not.toMatch(/做一个PPT/)
    expect(GENOFFICE_SKILL_DESCRIPTION).not.toMatch(/汇报PPT/)
  })

  it('requires *_open then built-in tools, and forbids script bypass', () => {
    expect(GENOFFICE_SKILL_CONTENT).toMatch(/pptx_open/)
    expect(GENOFFICE_SKILL_CONTENT).toMatch(/已打开控制模式/)
    expect(GENOFFICE_SKILL_CONTENT).toMatch(/pptx_get_deck_context/)
    expect(GENOFFICE_SKILL_CONTENT).toMatch(/pptx_generate_deck/)
    expect(GENOFFICE_SKILL_CONTENT).toMatch(/pptx_land_pages/)
    expect(GENOFFICE_SKILL_CONTENT).toMatch(/executor not registered/)
    expect(GENOFFICE_SKILL_CONTENT).toMatch(/不要改走脚本/)
    expect(GENOFFICE_SKILL_CONTENT).toMatch(/ppt-image-first/)
    expect(GENOFFICE_SKILL_CONTENT).toMatch(/python-pptx/)
    expect(GENOFFICE_SKILL_CONTENT).toMatch(/\/dsh-genoffice/)
  })

  it('registers on an already-resolved skills service', () => {
    const register = vi.fn(() => () => undefined)
    const skills = { register, registerProvider: () => undefined, snapshot: () => undefined }
    const effect = vi.fn((fn: () => unknown) => fn())
    applySkill({
      effect,
      inject: vi.fn(),
      root: { reflect: { store: { skills: { value: skills } } } },
    } as never)
    expect(register).toHaveBeenCalledWith({
      name: GENOFFICE_SKILL_NAME,
      description: GENOFFICE_SKILL_DESCRIPTION,
      content: GENOFFICE_SKILL_CONTENT,
      source: 'runtime',
    })
    expect(effect).toHaveBeenCalled()
  })

  it('looks up the skills service by registerProvider + snapshot shape', () => {
    const skills = { register() {}, registerProvider() {}, snapshot() {} }
    const ctx = { root: { reflect: { store: { skills: { value: skills } } } } }
    expect(lookupSkills(ctx as never)).toBe(skills)
    expect(lookupSkills({ root: { reflect: { store: { tools: { value: { register() {} } } } } } } as never)).toBeUndefined()
  })
})
