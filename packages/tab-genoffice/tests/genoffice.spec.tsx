// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { GenOfficePanel } from '../src/tabs/genoffice.tsx'
import { fileTabSeed } from '../src/tabs/file-tab.ts'
import { resetRelayStore } from '../src/tabs/relay.ts'
import type { TabComponentProps } from 'dsh-better-sidebar'

afterEach(() => {
  cleanup()
  resetRelayStore()
  vi.unstubAllGlobals()
})

class FakeEventSource {
  url: string
  constructor(url: string) { this.url = url }
  addEventListener(): void {}
  close(): void {}
}

beforeEach(() => {
  resetRelayStore()
  vi.stubGlobal('EventSource', FakeEventSource)
})

function panel(cwd?: string, openTab: ReturnType<typeof vi.fn> = vi.fn()) {
  const props = {
    ctx: { betterSidebar: { openTab } } as never,
    store: {} as never,
    scope: { sessionId: 's', cwd },
    tab: { id: 't', type: 'genoffice', title: 'GenOffice' },
    visible: true,
  } as TabComponentProps
  return { view: render(<GenOfficePanel {...props} />), openTab }
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
    await waitFor(() => {
      expect(fetch.mock.calls.some((c) => String(c[0]).includes('/api/dir') && String(c[0]).includes('path=%2Fproj'))).toBe(true)
    })
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
    const { view } = panel('')
    await waitFor(() => {
      expect(fetch.mock.calls.some((c) => String(c[0]).includes('/api/dir'))).toBe(true)
    })
    await waitFor(() => {
      expect(fetch.mock.calls.some((c) => String(c[0]).includes('/api/dir') && String(c[0]).includes('path=') && !String(c[0]).includes('path=%2F'))).toBe(true)
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
    const { view } = panel('/a/b/c')
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
    const { view } = panel('/proj')
    await waitFor(() => { expect(view.getByRole('button', { name: 'proj' })).toBeTruthy() })
    const dirCalls = (): number => fetch.mock.calls.filter((c) => String(c[0]).includes('/api/dir')).length
    const before = dirCalls()
    fireEvent.click(view.getByLabelText('当前路径'))
    const input = await view.findByLabelText('跳转到路径')
    fireEvent.change(input, { target: { value: 'relative/nope' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(view.getByText(/绝对路径/)).toBeTruthy()
    expect(dirCalls()).toBe(before)
  })
})

describe('business failures vs relay-down', () => {
  it('an unreadable path shows the error without the relay-down strip', async () => {
    const fetch = vi.fn(async (input: RequestInfo) => {
      const url = String(input)
      if (url.includes('/api/dir')) {
        const path = new URL(url).searchParams.get('path') ?? ''
        if (path === '/root/secret') {
          return { ok: true, json: async () => ({ ok: false, error: 'EACCES: permission denied' }) }
        }
        return { ok: true, json: async () => ({ ok: true, path: path || '/tmp', parent: '/', entries: [] }) }
      }
      return { ok: true, json: async () => ({ ok: true }) }
    })
    vi.stubGlobal('fetch', fetch)
    const { view } = panel('/tmp')
    await waitFor(() => { expect(view.getByRole('button', { name: 'tmp' })).toBeTruthy() })
    fireEvent.click(view.getByLabelText('当前路径'))
    const input = await view.findByLabelText('跳转到路径')
    fireEvent.change(input, { target: { value: '/root/secret' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => { expect(view.getByText(/permission denied/)).toBeTruthy() })
    expect(view.queryByText(/relay 不可用/)).toBeNull()
  })
})

describe('hidden entries toggle', () => {
  it('hides dot entries by default and shows them after toggling', async () => {
    const entries = [
      { name: '.secret', dir: false, hidden: true, symlink: false, size: 1, mtimeMs: 0, ext: '' },
      { name: 'a.docx', dir: false, hidden: false, symlink: false, size: 1, mtimeMs: 0, ext: 'docx' },
    ]
    const fetch = vi.fn(async (input: RequestInfo) => {
      const url = String(input)
      if (url.includes('/api/dir')) {
        return { ok: true, json: async () => ({ ok: true, path: '/tmp', parent: '/', entries }) }
      }
      return { ok: true, json: async () => ({ ok: true }) }
    })
    vi.stubGlobal('fetch', fetch)
    const { view } = panel('/tmp')
    await waitFor(() => { expect(view.getByText('a.docx')).toBeTruthy() })
    expect(view.queryByText('.secret')).toBeNull()
    fireEvent.click(view.getByRole('button', { name: '显示隐藏项' }))
    expect(view.getByText('.secret')).toBeTruthy()
    fireEvent.click(view.getByRole('button', { name: '藏起隐藏项' }))
    expect(view.queryByText('.secret')).toBeNull()
  })
})

describe('opening a file from the list', () => {
  it('opens a per-path document tab and keeps the directory list', async () => {
    const fetch = vi.fn(async (input: RequestInfo) => {
      const url = String(input)
      if (url.includes('/api/dir')) {
        const path = new URL(url).searchParams.get('path') ?? ''
        return {
          ok: true,
          json: async () => ({
            ok: true,
            path: path || '/tmp',
            parent: '/',
            entries: [
              { name: 'a.docx', dir: false, hidden: false, symlink: false, size: 1, mtimeMs: 0, ext: 'docx' },
              { name: 'notes.txt', dir: false, hidden: false, symlink: false, size: 1, mtimeMs: 0, ext: 'txt' },
            ],
          }),
        }
      }
      return { ok: true, json: async () => ({ ok: true }) }
    })
    vi.stubGlobal('fetch', fetch)
    const { view, openTab } = panel('/tmp')
    await waitFor(() => { expect(view.getByText('a.docx')).toBeTruthy() })
    fireEvent.click(view.getByText('a.docx'))
    expect(openTab).toHaveBeenCalledWith(fileTabSeed('/tmp/a.docx'), { sessionId: 's', cwd: '/tmp' })
    expect(view.getByRole('button', { name: '主目录' })).toBeTruthy()
    expect(view.queryByRole('button', { name: '返回' })).toBeNull()
    fireEvent.click(view.getByText('notes.txt'))
    expect(openTab).toHaveBeenCalledTimes(1)
  })
})
