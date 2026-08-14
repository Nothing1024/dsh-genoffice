// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { CLAIMED_EXTS, DEGRADE_MODE } from '../src/tabs/coexist.ts'

describe('click-preview coexist config', () => {
  it('claims docx, xlsx, pptx and uses manual degrade', () => {
    expect([...CLAIMED_EXTS]).toEqual(['docx', 'xlsx', 'pptx'])
    expect(DEGRADE_MODE).toBe('manual')
  })
})
