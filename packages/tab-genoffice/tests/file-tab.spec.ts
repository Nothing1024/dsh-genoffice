import { describe, expect, it } from 'vitest'
import { BROWSER_TAB_ID, FILE_TAB_ID, controlOpenAddress, fileNameOf, fileOpenFromEvent, fileOpenOnThisPage, isClaimedPath } from '../src/tabs/file-tab.ts'
import { absoluteFileAddress, fileAddressFor, parseFileAddress, sessionFileAddress } from '../src/tabs/file-address.ts'

describe('file names and claimed paths', () => {
  it('uses basename and claims office extensions', () => {
    expect(fileNameOf('/tmp/demo.docx')).toBe('demo.docx')
    expect(fileNameOf('C:\\work\\deck.pptx')).toBe('deck.pptx')
    expect(isClaimedPath('/tmp/demo.docx')).toBe(true)
    expect(isClaimedPath('/tmp/notes.md')).toBe(false)
    expect(BROWSER_TAB_ID).not.toBe(FILE_TAB_ID)
  })
})

describe('fileAddressFor', () => {
  it('encodes a session-scoped address, keeping : literal', () => {
    expect(sessionFileAddress('s:1', '/tmp/demo.docx')).toBe(
      'dsh-resource://file/session/s:1//tmp/demo.docx',
    )
    expect(parseFileAddress(sessionFileAddress('s:1', '/tmp/demo.docx'))).toEqual({
      scope: 'session',
      sessionId: 's:1',
      path: '/tmp/demo.docx',
    })
    expect(fileAddressFor('sess', '/workspace', 'notes.docx')).toBe(
      sessionFileAddress('sess', 'notes.docx'),
    )
    expect(fileAddressFor('sess', '/workspace', '/workspace/a.docx')).toBe(
      sessionFileAddress('sess', 'a.docx'),
    )
    expect(fileAddressFor('sess', '/workspace', '/tmp/a.docx')).toBe(
      sessionFileAddress('sess', '/tmp/a.docx'),
    )
  })
})

describe('fileOpenFromEvent', () => {
  it('returns a path with no session when the SSE payload has only path', () => {
    expect(fileOpenFromEvent({ path: '/tmp/demo.docx' })).toEqual({
      path: '/tmp/demo.docx',
    })
  })

  it('attaches the origin session so openResource does not land in another page\'s active session', () => {
    expect(fileOpenFromEvent({ path: '/tmp/demo.docx', sessionId: 'session-a' })).toEqual({
      path: '/tmp/demo.docx',
      sessionId: 'session-a',
    })
  })

  it('ignores blank path, blank sessionId, and non-string fields', () => {
    expect(fileOpenFromEvent({ path: '' })).toBeUndefined()
    expect(fileOpenFromEvent({ path: 1 })).toBeUndefined()
    expect(fileOpenFromEvent({})).toBeUndefined()
    expect(fileOpenFromEvent({ path: '/tmp/a.docx', sessionId: '' })).toEqual({
      path: '/tmp/a.docx',
    })
    expect(fileOpenFromEvent({ path: '/tmp/a.docx', sessionId: 12 })).toEqual({
      path: '/tmp/a.docx',
    })
  })
})

describe('fileOpenOnThisPage', () => {
  const payload = { path: '/tmp/demo.docx', sessionId: 'session-a' }

  it('opens when this page is viewing the origin session', () => {
    expect(fileOpenOnThisPage(payload, 'session-a')).toEqual({
      path: '/tmp/demo.docx',
      sessionId: 'session-a',
    })
  })

  it('skips when this page is viewing a different session', () => {
    expect(fileOpenOnThisPage(payload, 'session-b')).toBeUndefined()
  })

  it('opens when this page has no mounted session id', () => {
    expect(fileOpenOnThisPage(payload, undefined)).toEqual({
      path: '/tmp/demo.docx',
      sessionId: 'session-a',
    })
  })

  it('still opens a legacy payload that has no sessionId', () => {
    expect(fileOpenOnThisPage({ path: '/tmp/demo.docx' }, 'session-b')).toEqual({
      path: '/tmp/demo.docx',
    })
  })
})

describe('controlOpenAddress', () => {
  it('uses the mounted page session when the page has one', () => {
    expect(controlOpenAddress('/tmp/demo.docx', 'session-a')).toBe(
      fileAddressFor('session-a', undefined, '/tmp/demo.docx'),
    )
  })

  it('uses the absolute scope when the page has no session id', () => {
    expect(controlOpenAddress('/tmp/demo.docx', undefined)).toBe(
      absoluteFileAddress('/tmp/demo.docx'),
    )
    expect(controlOpenAddress('/tmp/demo.docx', '')).toBe(
      absoluteFileAddress('/tmp/demo.docx'),
    )
  })
})
