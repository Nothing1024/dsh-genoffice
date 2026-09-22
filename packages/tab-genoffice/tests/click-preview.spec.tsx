import { describe, expect, it } from 'vitest'
import { CLAIMED_EXTS, CONTROL_EXTS, DEGRADE_MODE } from '../src/tabs/coexist.ts'
import { isClaimedPath } from '../src/tabs/file-tab.ts'

describe('click-preview coexist config', () => {
  it('claims docx, xlsx, pptx and uses manual degrade', () => {
    expect([...CLAIMED_EXTS]).toEqual(['docx', 'xlsx', 'pptx'])
    expect(DEGRADE_MODE).toBe('manual')
    expect(isClaimedPath('/tmp/a.docx')).toBe(true)
    expect(isClaimedPath('/tmp/a.md')).toBe(false)
    expect([...CONTROL_EXTS]).toEqual(['docx', 'xlsx', 'pptx', 'md', 'pdf', 'html'])
    expect([...CLAIMED_EXTS]).not.toContain('html')
    expect(isClaimedPath('/tmp/a.html')).toBe(false)
  })
})
