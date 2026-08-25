import { describe, expect, it } from 'vitest'
import { BROWSER_TAB_ID, FILE_TAB_ID, fileNameOf, fileOpenFromEvent, fileOpenOnThisPage, fileTabSeed } from '../src/tabs/file-tab.ts'

describe('fileTabSeed', () => {
  it('uses a path-derived id and the basename as title', () => {
    expect(fileTabSeed('/tmp/demo.docx')).toEqual({
      type: FILE_TAB_ID,
      path: '/tmp/demo.docx',
      title: 'demo.docx',
      id: `${FILE_TAB_ID}:/tmp/demo.docx`,
    })
    expect(fileNameOf('C:\\work\\deck.pptx')).toBe('deck.pptx')
    expect(BROWSER_TAB_ID).not.toBe(FILE_TAB_ID)
  })
})

describe('fileOpenFromEvent', () => {
  it('returns a path seed with no scope when the SSE payload has only path', () => {
    expect(fileOpenFromEvent({ path: '/tmp/demo.docx' })).toEqual({
      seed: fileTabSeed('/tmp/demo.docx'),
    })
  })

  it('attaches the origin session so openTab does not land in another page\'s active session', () => {
    expect(fileOpenFromEvent({ path: '/tmp/demo.docx', sessionId: 'session-a' })).toEqual({
      seed: fileTabSeed('/tmp/demo.docx'),
      scope: { sessionId: 'session-a' },
    })
  })

  it('ignores blank path, blank sessionId, and non-string fields', () => {
    expect(fileOpenFromEvent({ path: '' })).toBeUndefined()
    expect(fileOpenFromEvent({ path: 1 })).toBeUndefined()
    expect(fileOpenFromEvent({})).toBeUndefined()
    expect(fileOpenFromEvent({ path: '/tmp/a.docx', sessionId: '' })).toEqual({
      seed: fileTabSeed('/tmp/a.docx'),
    })
    expect(fileOpenFromEvent({ path: '/tmp/a.docx', sessionId: 12 })).toEqual({
      seed: fileTabSeed('/tmp/a.docx'),
    })
  })
})

describe('fileOpenOnThisPage', () => {
  const payload = { path: '/tmp/demo.docx', sessionId: 'session-a' }

  it('opens without scope when this page is viewing the origin session', () => {
    expect(fileOpenOnThisPage(payload, 'session-a')).toEqual({
      seed: fileTabSeed('/tmp/demo.docx'),
    })
  })

  it('skips when this page is viewing a different session', () => {
    expect(fileOpenOnThisPage(payload, 'session-b')).toBeUndefined()
  })

  it('skips when the active session is unknown', () => {
    expect(fileOpenOnThisPage(payload, undefined)).toBeUndefined()
  })

  it('still opens a legacy payload that has no sessionId', () => {
    expect(fileOpenOnThisPage({ path: '/tmp/demo.docx' }, 'session-b')).toEqual({
      seed: fileTabSeed('/tmp/demo.docx'),
    })
  })
})
