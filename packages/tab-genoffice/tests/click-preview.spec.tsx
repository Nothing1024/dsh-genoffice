// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  CLAIMED_EXTS,
  DEGRADE_MODE,
  DOWNLOAD_VIEWER_ID,
  OWN_VIEWER_PREFIX,
  pickDegradeViewer,
} from '../src/tabs/coexist.ts'

describe('click-preview coexist config', () => {
  it('claims docx, xlsx, pptx and uses manual degrade', () => {
    expect([...CLAIMED_EXTS]).toEqual(['docx', 'xlsx', 'pptx'])
    expect(DEGRADE_MODE).toBe('manual')
  })
})

describe('pickDegradeViewer (sidebar 0.13 has no builtin office viewers)', () => {
  const own = { id: `${OWN_VIEWER_PREFIX}docx`, exts: ['docx'], priority: 10 }
  const officePlugin = { id: 'docx', exts: ['docx'], priority: 0 }
  const download = { id: DOWNLOAD_VIEWER_ID, exts: ['doc', 'xls', 'ppt'], priority: -50 }
  const code = { id: 'code', exts: [] as const, priority: -100 }

  it('prefers a registered office-plugin id when present', () => {
    expect(pickDegradeViewer([own, officePlugin, download], 'docx', own.id)).toBe(officePlugin)
  })

  it('skips this plugin\'s own viewer so degrade cannot recurse', () => {
    expect(pickDegradeViewer([own, download], 'docx', own.id)?.id).toBe(DOWNLOAD_VIEWER_ID)
  })

  it('does not fall through to the catch-all code editor', () => {
    expect(pickDegradeViewer([own, code], 'docx', own.id)).toBeUndefined()
  })

  it('returns undefined when nothing usable is registered', () => {
    expect(pickDegradeViewer([own], 'docx', own.id)).toBeUndefined()
  })

  it('skips a preferred id that is disabled and falls through to download', () => {
    expect(
      pickDegradeViewer(
        [own, officePlugin, download],
        'docx',
        own.id,
        (id) => id !== 'docx',
      )?.id,
    ).toBe(DOWNLOAD_VIEWER_ID)
  })
})
