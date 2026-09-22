import { describe, expect, it } from 'vitest'
import { fileAddressFor } from '../src/tabs/file-address.ts'
import { resolveSessionFilePath } from '../src/tabs/resolve-session-path.ts'

describe('resolveSessionFilePath', () => {
  const cwdA = '/tmp/session-a'
  const cwdB = '/tmp/session-b'
  const abs = `${cwdA}/note.docx`
  const address = fileAddressFor('sess-a', cwdA, abs)

  it('joins the address session cwd, not the active session', () => {
    const resolved = resolveSessionFilePath(address, {
      byId: {
        'sess-a': { cwd: cwdA },
        'sess-b': { cwd: cwdB },
      },
    })
    expect(resolved).toEqual({ status: 'ready', path: abs })
  })

  it('keeps POSIX/Windows/UNC absolute paths', () => {
    expect(resolveSessionFilePath(fileAddressFor('s', undefined, '/abs/x.docx'), { byId: {} })).toEqual({
      status: 'ready',
      path: '/abs/x.docx',
    })
    const win = fileAddressFor('s', undefined, 'C:/Users/x.docx')
    expect(resolveSessionFilePath(win, { byId: {} }).status).toBe('ready')
  })

  it('waits when session metadata has not arrived', () => {
    expect(resolveSessionFilePath(address, { sessionsPending: true })).toMatchObject({
      status: 'waiting',
    })
    expect(resolveSessionFilePath(address, {})).toMatchObject({ status: 'waiting' })
  })

  it('rejects unknown session and missing cwd without inventing a path', () => {
    expect(resolveSessionFilePath(address, { byId: { 'sess-b': { cwd: cwdB } } })).toMatchObject({
      status: 'error',
      error: 'unknown-session',
    })
    expect(resolveSessionFilePath(address, { byId: { 'sess-a': {} } })).toMatchObject({
      status: 'error',
      error: 'missing-cwd',
    })
  })

  it('rejects a malformed address', () => {
    expect(resolveSessionFilePath('sidebar://guide', { byId: {} })).toMatchObject({
      status: 'error',
      error: 'malformed-address',
    })
  })
})
