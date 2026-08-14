// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { GenOfficePanel } from '../src/tabs/genoffice.tsx'
import { resetRelayStore } from '../src/tabs/relay.ts'
import type { TabComponentProps } from 'dsh-better-sidebar'

afterEach(() => {
  cleanup()
  resetRelayStore()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  resetRelayStore()
})

function panel(cwd?: string) {
  const props = {
    ctx: {} as never,
    store: {} as never,
    scope: { sessionId: 's', cwd },
    tab: { id: 't', type: 'genoffice', title: 'GenOffice' },
    visible: true,
  } as TabComponentProps
  return render(<GenOfficePanel {...props} />)
}

describe('GenOffice list start directory', () => {
  it('fetches scope.cwd on first load', async () => {
    const fetch = vi.fn(async (input: RequestInfo) => {
      const url = String(input)
      const path = new URL(url).searchParams.get('path')
      return {
        ok: true,
        json: async () => ({ ok: true, path: path || '/home', parent: '/', entries: [] }),
      }
    })
    vi.stubGlobal('fetch', fetch)
    panel('/proj')
    await waitFor(() => { expect(fetch).toHaveBeenCalled() })
    const url = String(fetch.mock.calls[0]?.[0])
    expect(url).toContain('path=%2Fproj')
  })

  it('fetches an empty path when cwd is missing', async () => {
    const fetch = vi.fn(async (input: RequestInfo) => {
      const url = String(input)
      const path = new URL(url).searchParams.get('path')
      return {
        ok: true,
        json: async () => ({
          ok: true,
          path: path ? path : '/Users/me',
          parent: '/',
          entries: [],
        }),
      }
    })
    vi.stubGlobal('fetch', fetch)
    const view = panel('')
    await waitFor(() => { expect(fetch).toHaveBeenCalled() })
    expect(String(fetch.mock.calls[0]?.[0])).toMatch(/path=$|path=$/)
    await waitFor(() => {
      expect(fetch.mock.calls.some((c) => String(c[0]).includes('path=') && !String(c[0]).includes('path=%2F'))).toBe(true)
    })
    await waitFor(() => { expect(view.getByText('已回落到主目录')).toBeTruthy() })
  })
})

describe('path bar', () => {
  it('breadcrumb segments jump to that directory', async () => {
    const fetch = vi.fn(async (input: RequestInfo) => {
      const path = new URL(String(input)).searchParams.get('path') ?? ''
      return {
        ok: true,
        json: async () => ({
          ok: true,
          path: path || '/a/b/c',
          parent: '/a/b',
          entries: [],
        }),
      }
    })
    vi.stubGlobal('fetch', fetch)
    const view = panel('/a/b/c')
    await waitFor(() => { expect(view.getByRole('button', { name: 'b' })).toBeTruthy() })
    fireEvent.click(view.getByRole('button', { name: 'b' }))
    await waitFor(() => {
      expect(fetch.mock.calls.some((c) => String(c[0]).includes('path=%2Fa%2Fb'))).toBe(true)
    })
  })

  it('rejects a relative path without sending a request', async () => {
    const fetch = vi.fn(async (input: RequestInfo) => {
      const path = new URL(String(input)).searchParams.get('path') ?? ''
      return {
        ok: true,
        json: async () => ({ ok: true, path: path || '/proj', parent: '/', entries: [] }),
      }
    })
    vi.stubGlobal('fetch', fetch)
    const view = panel('/proj')
    await waitFor(() => { expect(view.getByRole('button', { name: 'proj' })).toBeTruthy() })
    const before = fetch.mock.calls.length
    fireEvent.click(view.getByLabelText('当前路径'))
    const input = await view.findByLabelText('跳转到路径')
    fireEvent.change(input, { target: { value: 'relative/nope' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(view.getByText(/绝对路径/)).toBeTruthy()
    expect(fetch.mock.calls.length).toBe(before)
  })
})
