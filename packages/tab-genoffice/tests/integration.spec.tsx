// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { apply as genofficeApply } from '@deepseek-ai/dsh-tab-genoffice/client'
import { ControlModeViewer } from '../src/tabs/control-mode.tsx'
import { DocxControlViewer, GenOfficeFileTab } from '../src/tabs/docx-control-viewer.tsx'
import { CLAIMED_EXTS } from '../src/tabs/coexist.ts'
import { resetActiveDocs } from '../src/tabs/doc-registry.ts'
import { BROWSER_TAB_ID, FILE_TAB_ID, fileTabSeed } from '../src/tabs/file-tab.ts'
import { docIdFor, previewUrlFor, resetRelayStore } from '../src/tabs/relay.ts'
import type { FileViewerDescriptor, FileViewerProps, TabDescriptor } from 'dsh-better-sidebar'

afterEach(() => {
  cleanup()
  resetActiveDocs()
  resetRelayStore()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

class FakeEventSource {
  static instances: FakeEventSource[] = []
  url: string
  closed = false
  private readonly listeners = new Map<string, Set<(ev: MessageEvent) => void>>()
  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }
  addEventListener(type: string, fn: (ev: MessageEvent) => void): void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(fn)
    this.listeners.set(type, set)
  }
  close(): void {
    this.closed = true
  }
  emit(type: string, data: string): void {
    for (const fn of this.listeners.get(type) ?? []) fn({ data } as MessageEvent)
  }
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('dsh.locale', 'zh')
  resetActiveDocs()
  resetRelayStore()
  FakeEventSource.instances = []
  vi.stubGlobal('EventSource', FakeEventSource)
})

function fakeBetterSidebar(sessionId?: string) {
  const registered: TabDescriptor[] = []
  const viewers: FileViewerDescriptor[] = []
  return {
    registered,
    viewers,
    registerTab(descriptor: TabDescriptor) {
      registered.push(descriptor)
      return () => {
        const at = registered.indexOf(descriptor)
        if (at >= 0) registered.splice(at, 1)
      }
    },
    registerFileViewer(descriptor: FileViewerDescriptor) {
      viewers.push(descriptor)
      return () => {
        const at = viewers.indexOf(descriptor)
        if (at >= 0) viewers.splice(at, 1)
      }
    },
    getTabs: () => registered,
    getFileViewers: () => viewers,
    getTab: (id: string) => registered.find((t) => t.id === id),
    isTabEnabled: () => true,
    isViewerEnabled: (_id: string) => true,
    matchFileViewer: () => undefined,
    openTab: vi.fn(),
    closeTab: vi.fn(),
    updateTab: vi.fn(),
    subscribe: () => () => {},
    getSnapshot: () => ({ sessionId }),
  }
}

/** A minimal locale double exposing the two faces `apply(ctx)` touches. */
function fakeLocale(active: 'zh' | 'en' = 'zh') {
  const dicts = new Map<string, { zh: Record<string, string>; en: Record<string, string> }>()
  let current: 'zh' | 'en' = active
  return {
    bind: (ns: string) => (key: string) => dicts.get(ns)?.[current]?.[key] ?? key,
    register: (ns: string, dict: { zh: Record<string, string>; en: Record<string, string> }) => {
      dicts.set(ns, dict)
      return () => { dicts.delete(ns) }
    },
    setActive(locale: 'zh' | 'en') { current = locale },
  }
}

/**
 * Lightweight Cordis-shaped bench for the registration contract. The full
 * `@deepseek-ai/dsh-client-test-runtime` is an in-repository vitest suite
 * (its README: the built lib re-exports the browser-loader client bundle,
 * not importable under plain Node), so out-of-tree specs drive a small
 * ctx with the two services `apply` touches: `locale` + optional
 * `betterSidebar`. Registration/dispose semantics mirror cordis
 * (`ctx.effect` runs the callback and collects the disposer).
 */
async function bench(withSidebar = true, sessionId?: string) {
  const sidebar = fakeBetterSidebar(sessionId)
  const disposers: Array<() => void> = []
  const locale = fakeLocale()
  const ctx = {
    locale,
    effect: (fn: () => void | (() => void)) => {
      const d = fn()
      if (typeof d === 'function') disposers.push(d)
    },
    inject: (names: string[], cb: (c: unknown) => void) => {
      if (withSidebar && names.includes('betterSidebar')) cb({ ...ctx, betterSidebar: sidebar })
    },
  }
  genofficeApply(ctx as never)
  return {
    sidebar,
    runtime: { dispose: () => { for (const d of disposers.splice(0)) d() } },
    plugin: { dispose: () => { for (const d of disposers.splice(0)) d() } },
  }
}

function stubRelay(ok: boolean): void {
  vi.stubGlobal('fetch', vi.fn(async () => {
    if (!ok) throw new Error('ECONNREFUSED')
    return { ok: true, json: async () => ({ ok: true }) }
  }))
}

describe('genoffice better-sidebar registration', () => {
  it('registers a prefixed tab and one viewer per claimed ext', async () => {
    const b = await bench(true)
    expect(b.sidebar.registered.map((t) => t.id)).toEqual([BROWSER_TAB_ID, FILE_TAB_ID])
    const browser = b.sidebar.registered[0]
    const fileTab = b.sidebar.registered[1]
    expect(browser?.single).toBe(true)
    expect(fileTab?.hidden).toBe(true)
    expect(fileTab?.dedupeKey?.({ path: '/tmp/a.docx' } as never)).toBe('/tmp/a.docx')
    expect(b.sidebar.viewers.map((v) => v.id)).toEqual(
      CLAIMED_EXTS.map((ext) => `dsh-genoffice:viewer-${ext}`),
    )
    expect(b.sidebar.viewers.map((v) => v.exts[0])).toEqual([...CLAIMED_EXTS])
    for (const viewer of b.sidebar.viewers) {
      expect(viewer.priority).toBe(10)
      expect(viewer.fetchStrategy).toBe('none')
      expect(viewer.id.startsWith('dsh-genoffice:')).toBe(true)
    }
    await b.runtime.dispose()
  })

  it('disposer from effect unregisters the tab (HMR / BR-006)', async () => {
    const b = await bench(true)
    expect(b.sidebar.registered).toHaveLength(2)
    await b.plugin.dispose()
    expect(b.sidebar.registered).toHaveLength(0)
    expect(b.sidebar.viewers).toHaveLength(0)
    await b.runtime.dispose()
  })

  it('optional peer: skips registration without throwing when betterSidebar is absent (BR-003)', async () => {
    const b = await bench(false)
    expect(b.sidebar.registered).toHaveLength(0)
    await b.runtime.dispose()
  })
})

describe('genoffice locale dictionaries', () => {
  it('registers the tabs.genoffice namespace with zh/en both resolved after apply', () => {
    const locale = fakeLocale()
    const ctx = { locale, effect: (fn: () => void | (() => void)) => { fn() }, inject: () => {} }
    genofficeApply(ctx as never)
    // zh active → zh dict resolves the key; en active → en dict resolves it too.
    expect(locale.bind('tabs.genoffice')('tab.genoffice')).toBe('GenOffice')
    locale.setActive('en')
    expect(locale.bind('tabs.genoffice')('tab.genoffice')).toBe('GenOffice')
    // A key outside the registered namespace falls back to the key itself.
    expect(locale.bind('tabs.genoffice')('tab.missing')).toBe('tab.missing')
  })
})

describe('coexist degrade modes', () => {
  it('shows a visible exit to the builtin preview when relay is down (manual)', async () => {
    stubRelay(false)
    const builtin = {
      id: 'docx',
      exts: ['docx'],
      fetchStrategy: 'mediaUrl' as const,
      component: () => <div>builtin-docx</div>,
    }
    const sidebar = fakeBetterSidebar()
    sidebar.viewers.push(builtin)
    const props: FileViewerProps = {
      ctx: { betterSidebar: sidebar } as unknown as FileViewerProps['ctx'],
      store: {} as FileViewerProps['store'],
      scope: { sessionId: 's' },
      path: '/tmp/a.docx',
      title: 'a.docx',
      viewerId: 'dsh-genoffice:viewer-docx',
    }
    const view = render(<DocxControlViewer {...props} />)
    const button = await view.findByRole('button', { name: '用后备预览打开' })
    expect(view.getByText(/relay 不可用/)).toBeTruthy()
    fireEvent.click(button)
    expect(view.getByText('builtin-docx')).toBeTruthy()
  })

  it('0.13: without an office builtin, degrades to binary-download instead of a dead hint', async () => {
    stubRelay(false)
    const download = {
      id: 'binary-download',
      exts: ['doc', 'xls', 'ppt'],
      fetchStrategy: 'binary-download' as const,
      component: () => <div>download-fallback</div>,
    }
    const own = {
      id: 'dsh-genoffice:viewer-docx',
      exts: ['docx'],
      fetchStrategy: 'none' as const,
      component: () => <div>own-viewer</div>,
    }
    const sidebar = fakeBetterSidebar()
    sidebar.viewers.push(own, download)
    const props: FileViewerProps = {
      ctx: { betterSidebar: sidebar } as unknown as FileViewerProps['ctx'],
      store: {} as FileViewerProps['store'],
      scope: { sessionId: 's' },
      path: '/tmp/a.docx',
      title: 'a.docx',
      viewerId: 'dsh-genoffice:viewer-docx',
    }
    const view = render(<DocxControlViewer {...props} />)
    fireEvent.click(await view.findByRole('button', { name: '用后备预览打开' }))
    expect(view.getByText('download-fallback')).toBeTruthy()
    expect(view.queryByText('own-viewer')).toBeNull()
    expect(view.queryByText('没有可用的后备预览')).toBeNull()
  })

  it('skips a disabled office-plugin viewer and uses binary-download', async () => {
    stubRelay(false)
    const office = {
      id: 'docx',
      exts: ['docx'],
      fetchStrategy: 'mediaUrl' as const,
      component: () => <div>office-plugin</div>,
    }
    const download = {
      id: 'binary-download',
      exts: ['doc', 'xls', 'ppt'],
      fetchStrategy: 'binary-download' as const,
      component: () => <div>download-fallback</div>,
    }
    const sidebar = fakeBetterSidebar()
    sidebar.viewers.push(office, download)
    sidebar.isViewerEnabled = (id: string) => id !== 'docx'
    const props: FileViewerProps = {
      ctx: { betterSidebar: sidebar } as unknown as FileViewerProps['ctx'],
      store: {} as FileViewerProps['store'],
      scope: { sessionId: 's' },
      path: '/tmp/a.docx',
      title: 'a.docx',
      viewerId: 'dsh-genoffice:viewer-docx',
    }
    const view = render(<DocxControlViewer {...props} />)
    fireEvent.click(await view.findByRole('button', { name: '用后备预览打开' }))
    expect(view.getByText('download-fallback')).toBeTruthy()
    expect(view.queryByText('office-plugin')).toBeNull()
  })

  it('shows a dead-end hint when no other viewer is registered', async () => {
    stubRelay(false)
    const sidebar = fakeBetterSidebar()
    const props: FileViewerProps = {
      ctx: { betterSidebar: sidebar } as unknown as FileViewerProps['ctx'],
      store: {} as FileViewerProps['store'],
      scope: { sessionId: 's' },
      path: '/tmp/a.docx',
      title: 'a.docx',
      viewerId: 'dsh-genoffice:viewer-docx',
    }
    const view = render(<DocxControlViewer {...props} />)
    fireEvent.click(await view.findByRole('button', { name: '用后备预览打开' }))
    expect(view.getByText('没有可用的后备预览')).toBeTruthy()
  })

  it('auto mode renders the builtin without a yield click', async () => {
    stubRelay(false)
    const view = render(
      <ControlModeViewer
        path="/tmp/a.docx"
        title="a.docx"
        ext="docx"
        degradeMode="auto"
        renderBuiltin={() => <div>builtin-docx</div>}
      />,
    )
    expect(await view.findByText('builtin-docx')).toBeTruthy()
    expect(view.queryByRole('button', { name: '用后备预览打开' })).toBeNull()
    expect(view.getByRole('button', { name: '重新检查' })).toBeTruthy()
  })
})

describe('control-mode toolbar parity', () => {
  it('the two surfaces share save, reload, and browser-open; only the tab has Back', async () => {
    stubRelay(true)
    const tab = render(
      <ControlModeViewer path="/tmp/a.docx" title="a.docx" ext="docx" onBack={() => {}} />,
    )
    const viewer = render(
      <ControlModeViewer path="/tmp/b.docx" title="b.docx" ext="docx" />,
    )
    await within(tab.container).findByRole('button', { name: '写入磁盘' })
    await within(viewer.container).findByRole('button', { name: '写入磁盘' })
    expect(within(tab.container).getByRole('button', { name: '从磁盘重载' })).toBeTruthy()
    expect(within(viewer.container).getByRole('button', { name: '从磁盘重载' })).toBeTruthy()
    expect(within(tab.container).getByRole('button', { name: '在浏览器中打开' })).toBeTruthy()
    expect(within(viewer.container).getByRole('button', { name: '在浏览器中打开' })).toBeTruthy()
    expect(within(tab.container).getByRole('button', { name: '返回' })).toBeTruthy()
    expect(within(viewer.container).queryByRole('button', { name: '返回' })).toBeNull()
  })

  it('file tab Back closes the tab; FileViewer has no Back', async () => {
    stubRelay(true)
    const sidebar = fakeBetterSidebar()
    const tabId = `${FILE_TAB_ID}:/tmp/a.docx`
    const tab = render(
      <GenOfficeFileTab
        ctx={{ betterSidebar: sidebar } as never}
        store={{} as never}
        scope={{ sessionId: 's' }}
        tab={{ id: tabId, type: FILE_TAB_ID, path: '/tmp/a.docx', title: 'a.docx' }}
        visible
      />,
    )
    const back = await tab.findByRole('button', { name: '返回' })
    fireEvent.click(back)
    expect(sidebar.closeTab).toHaveBeenCalledWith(tabId, { sessionId: 's' })

    tab.unmount()
    const viewer = render(
      <DocxControlViewer
        ctx={{ betterSidebar: sidebar } as never}
        store={{} as never}
        scope={{ sessionId: 's' }}
        path="/tmp/b.docx"
        title="b.docx"
        viewerId="dsh-genoffice:viewer-docx"
      />,
    )
    await within(viewer.container).findByRole('button', { name: '写入磁盘' })
    expect(within(viewer.container).queryByRole('button', { name: '返回' })).toBeNull()
  })

  it('dirty Back confirm cancel keeps the file tab open', async () => {
    stubRelay(true)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const sidebar = fakeBetterSidebar()
    const tabId = `${FILE_TAB_ID}:/tmp/a.docx`
    const tab = render(
      <GenOfficeFileTab
        ctx={{ betterSidebar: sidebar } as never}
        store={{} as never}
        scope={{ sessionId: 's' }}
        tab={{ id: tabId, type: FILE_TAB_ID, path: '/tmp/a.docx', title: 'a.docx' }}
        visible
      />,
    )
    await tab.findByRole('button', { name: '返回' })
    const id = await docIdFor('/tmp/a.docx')
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'http://localhost:8787',
      data: { type: 'genoffice:dirty', docId: id, dirty: true },
    }))
    await waitFor(() => {
      expect(tab.getByRole('button', { name: '写入磁盘' }).className).toMatch(/btnDirty/)
    })
    fireEvent.click(tab.getByRole('button', { name: '返回' }))
    expect(confirm).toHaveBeenCalled()
    expect(String(confirm.mock.calls[0]?.[0] ?? '')).toMatch(/有未保存的编辑/)
    expect(sidebar.closeTab).not.toHaveBeenCalled()
  })

  it('browser-open tooltip warns about leaving control mode', async () => {
    stubRelay(true)
    const view = render(<ControlModeViewer path="/tmp/a.docx" title="a.docx" ext="docx" />)
    const btn = await view.findByRole('button', { name: '在浏览器中打开' })
    expect(btn.getAttribute('title') ?? '').toMatch(/离开控制模式/)
    expect(btn.getAttribute('title') ?? '').toMatch(/出网/)
  })

  it('save remounts the iframe with a new nonce and control=1', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo) => {
      const url = String(input)
      if (url.includes('/export')) {
        return { ok: true, json: async () => ({ ok: true, path: '/tmp/a.docx' }) }
      }
      return { ok: true, json: async () => ({ ok: true }) }
    }))
    const view = render(<ControlModeViewer path="/tmp/a.docx" title="a.docx" ext="docx" />)
    await waitFor(() => { expect(view.container.querySelector('iframe')).not.toBeNull() })
    const before = view.container.querySelector('iframe')?.getAttribute('src') ?? ''
    fireEvent.click(view.getByRole('button', { name: '写入磁盘' }))
    await waitFor(() => {
      const src = view.container.querySelector('iframe')?.getAttribute('src') ?? ''
      expect(src).toContain('control=1')
      expect(src).toContain('_r=')
      expect(src).not.toBe(before)
    })
    expect(view.getByRole('button', { name: '写入磁盘' })).toHaveProperty('disabled', true)
  })

  it('save with numeric mtimeMs does not remount the iframe', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo) => {
      const url = String(input)
      if (url.includes('/export')) {
        return { ok: true, json: async () => ({ ok: true, path: '/tmp/a.docx', mtimeMs: 1_700_000_000_000 }) }
      }
      return { ok: true, json: async () => ({ ok: true }) }
    }))
    const view = render(<ControlModeViewer path="/tmp/a.docx" title="a.docx" ext="docx" />)
    await waitFor(() => { expect(view.container.querySelector('iframe')).not.toBeNull() })
    const before = view.container.querySelector('iframe')?.getAttribute('src') ?? ''
    fireEvent.click(view.getByRole('button', { name: '写入磁盘' }))
    await waitFor(() => {
      expect(view.getByText(/编辑状态已保留/)).toBeTruthy()
    })
    expect(view.container.querySelector('iframe')?.getAttribute('src')).toBe(before)
  })

  it('write failure shows the relay disk error and does not remount', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo) => {
      const url = String(input)
      if (url.includes('/export')) {
        return { ok: true, json: async () => ({ ok: false, error: 'EACCES' }) }
      }
      return { ok: true, json: async () => ({ ok: true }) }
    }))
    const view = render(<ControlModeViewer path="/tmp/a.docx" title="a.docx" ext="docx" />)
    await waitFor(() => { expect(view.container.querySelector('iframe')).not.toBeNull() })
    const before = view.container.querySelector('iframe')?.getAttribute('src') ?? ''
    fireEvent.click(view.getByRole('button', { name: '写入磁盘' }))
    await waitFor(() => {
      expect(view.getByText('写入失败：EACCES')).toBeTruthy()
    })
    expect(view.container.querySelector('iframe')?.getAttribute('src')).toBe(before)
  })

  it('ignores dirty messages from the wrong origin or docId', async () => {
    stubRelay(true)
    const view = render(<ControlModeViewer path="/tmp/a.docx" title="a.docx" ext="docx" />)
    await waitFor(() => { expect(view.container.querySelector('iframe')).not.toBeNull() })
    const id = await docIdFor('/tmp/a.docx')
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'http://evil.example',
      data: { type: 'genoffice:dirty', docId: id, dirty: true },
    }))
    expect(view.getByRole('button', { name: '写入磁盘' }).className).not.toMatch(/btnDirty/)
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'http://localhost:8787',
      data: { type: 'genoffice:dirty', docId: '0'.repeat(64), dirty: true },
    }))
    expect(view.getByRole('button', { name: '写入磁盘' }).className).not.toMatch(/btnDirty/)
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'http://localhost:8787',
      data: { type: 'genoffice:dirty', docId: id, dirty: true },
    }))
    await waitFor(() => {
      expect(view.getByRole('button', { name: '写入磁盘' }).className).toMatch(/btnDirty/)
    })
  })

  it('updateTab writes the bullet title once and does not loop', async () => {
    stubRelay(true)
    const updateTab = vi.fn()
    const view = render(
      <ControlModeViewer
        path="/tmp/a.docx"
        title="a.docx"
        ext="docx"
        tabId="file:/tmp/a.docx"
        updateTab={updateTab}
      />,
    )
    await waitFor(() => { expect(view.container.querySelector('iframe')).not.toBeNull() })
    expect(updateTab).not.toHaveBeenCalled()
    const id = await docIdFor('/tmp/a.docx')
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'http://localhost:8787',
      data: { type: 'genoffice:dirty', docId: id, dirty: true },
    }))
    await waitFor(() => {
      expect(updateTab).toHaveBeenCalledTimes(1)
      expect(updateTab.mock.calls[0]?.[1]).toEqual({ title: '● a.docx' })
    })
    view.rerender(
      <ControlModeViewer
        path="/tmp/a.docx"
        title="● a.docx"
        ext="docx"
        tabId="file:/tmp/a.docx"
        updateTab={updateTab}
      />,
    )
    await waitFor(() => {
      expect(view.getByRole('button', { name: '写入磁盘' }).className).toMatch(/btnDirty/)
    })
    expect(updateTab).toHaveBeenCalledTimes(1)
  })

  it('conflict offers 另存为副本 and posts saveAs without remounting', async () => {
    const fetch = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/export')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { saveAs?: string }
        if (typeof body.saveAs === 'string') {
          return { ok: true, json: async () => ({ ok: true, path: body.saveAs, name: 'copy.docx', mtimeMs: 1 }) }
        }
        return { ok: true, json: async () => ({ ok: false, error: 'conflict' }) }
      }
      return { ok: true, json: async () => ({ ok: true }) }
    })
    vi.stubGlobal('fetch', fetch)
    const view = render(<ControlModeViewer path="/tmp/a.docx" title="a.docx" ext="docx" />)
    await waitFor(() => { expect(view.container.querySelector('iframe')).not.toBeNull() })
    const before = view.container.querySelector('iframe')?.getAttribute('src') ?? ''
    fireEvent.click(view.getByRole('button', { name: '写入磁盘' }))
    const copyBtn = await view.findByRole('button', { name: '另存为副本' })
    fireEvent.click(copyBtn)
    await waitFor(() => {
      expect(view.getByText(/已另存为/)).toBeTruthy()
    })
    expect(view.container.querySelector('iframe')?.getAttribute('src')).toBe(before)
    const exportBodies = fetch.mock.calls
      .filter((c) => String(c[0]).includes('/export'))
      .map((c) => JSON.parse(String((c[1] as RequestInit | undefined)?.body ?? '{}')) as { saveAs?: string })
    expect(exportBodies.some((b) => typeof b.saveAs === 'string' && b.saveAs.includes('副本'))).toBe(true)
  })
})

describe('control-mode dual open', () => {
  it('a second mount of the same path does not render an iframe until the first unmounts', async () => {
    stubRelay(true)
    const first = render(<ControlModeViewer path="/tmp/a.docx" title="a.docx" ext="docx" />)
    await first.findByRole('button', { name: '写入磁盘' })
    await waitFor(() => {
      expect(first.container.querySelector('iframe')).not.toBeNull()
    })
    const second = render(<ControlModeViewer path="/tmp/a.docx" title="a.docx" ext="docx" />)
    expect(await within(second.container).findByText(/已在另一处打开/)).toBeTruthy()
    expect(second.container.querySelector('iframe')).toBeNull()
    first.unmount()
    await waitFor(() => {
      expect(within(second.container).queryByText(/已在另一处打开/)).toBeNull()
      expect(second.container.querySelector('iframe')).not.toBeNull()
    })
  })
})

describe('preview URL semantics', () => {
  it('control URLs carry control=1 and browser URLs do not', () => {
    expect(previewUrlFor('/tmp/a.docx', 'docx', true)).toContain('control=1')
    expect(previewUrlFor('/tmp/a.docx', 'docx', false)).not.toContain('control=1')
    expect(previewUrlFor('/tmp/a.docx', 'docx', true, 'abc')).toContain('_r=abc')
  })
})

describe('open-file SSE client', () => {
  it('connects EventSource in apply even before the panel mounts', async () => {
    const b = await bench(true)
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0]?.url).toBe('http://localhost:8787/api/open/stream')
    await b.runtime.dispose()
    expect(FakeEventSource.instances[0]?.closed).toBe(true)
  })

  it('file event opens a per-path document tab', async () => {
    const b = await bench(true)
    FakeEventSource.instances[0]?.emit('file', JSON.stringify({ path: '/tmp/demo.docx' }))
    expect(b.sidebar.openTab).toHaveBeenCalledWith(fileTabSeed('/tmp/demo.docx'))
    await b.runtime.dispose()
  })

  it('file event with sessionId opens on the matching page without targetedOpen scope', async () => {
    const b = await bench(true, 'session-a')
    FakeEventSource.instances[0]?.emit(
      'file',
      JSON.stringify({ path: '/tmp/demo.docx', sessionId: 'session-a' }),
    )
    expect(b.sidebar.openTab).toHaveBeenCalledWith(fileTabSeed('/tmp/demo.docx'))
    expect(b.sidebar.openTab).not.toHaveBeenCalledWith(
      fileTabSeed('/tmp/demo.docx'),
      { sessionId: 'session-a' },
    )
    await b.runtime.dispose()
  })

  it('a second page viewing another session does not open or collapse the origin session', async () => {
    const page1 = await bench(true, 'session-a')
    const page2 = await bench(true, 'session-b')
    const payload = JSON.stringify({ path: '/tmp/demo.docx', sessionId: 'session-a' })
    FakeEventSource.instances[0]?.emit('file', payload)
    FakeEventSource.instances[1]?.emit('file', payload)
    expect(page1.sidebar.openTab).toHaveBeenCalledWith(fileTabSeed('/tmp/demo.docx'))
    expect(page2.sidebar.openTab).not.toHaveBeenCalled()
    await page1.runtime.dispose()
    await page2.runtime.dispose()
  })

  it('a second file event opens a distinct tab seed so files sit side by side', async () => {
    const b = await bench(true)
    FakeEventSource.instances[0]?.emit('file', JSON.stringify({ path: '/tmp/a.docx' }))
    FakeEventSource.instances[0]?.emit('file', JSON.stringify({ path: '/tmp/b.xlsx' }))
    expect(b.sidebar.openTab).toHaveBeenNthCalledWith(1, fileTabSeed('/tmp/a.docx'))
    expect(b.sidebar.openTab).toHaveBeenNthCalledWith(2, fileTabSeed('/tmp/b.xlsx'))
    expect(fileTabSeed('/tmp/a.docx').id).not.toBe(fileTabSeed('/tmp/b.xlsx').id)
    await b.runtime.dispose()
  })

  it('ignores malformed SSE payloads', async () => {
    const b = await bench(true)
    expect(() => FakeEventSource.instances[0]?.emit('file', '{not-json')).not.toThrow()
    expect(b.sidebar.openTab).not.toHaveBeenCalled()
    await b.runtime.dispose()
  })
})
