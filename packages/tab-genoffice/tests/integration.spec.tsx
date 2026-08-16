// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { apply as genofficeApply } from '@deepseek-ai/dsh-tab-genoffice/client'
import { ControlModeViewer } from '../src/tabs/control-mode.tsx'
import { DocxControlViewer } from '../src/tabs/docx-control-viewer.tsx'
import { CLAIMED_EXTS } from '../src/tabs/coexist.ts'
import { resetActiveDocs } from '../src/tabs/doc-registry.ts'
import { previewUrlFor, resetRelayStore } from '../src/tabs/relay.ts'
import type { FileViewerDescriptor, FileViewerProps, TabDescriptor } from 'dsh-better-sidebar'

afterEach(() => {
  cleanup()
  resetActiveDocs()
  resetRelayStore()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('dsh.locale', 'zh')
  resetActiveDocs()
  resetRelayStore()
})

function fakeBetterSidebar() {
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
    isViewerEnabled: () => true,
    matchFileViewer: () => undefined,
    openTab: vi.fn(),
    closeTab: vi.fn(),
    subscribe: () => () => {},
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
async function bench(withSidebar = true) {
  const sidebar = fakeBetterSidebar()
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
    expect(b.sidebar.registered.map((t) => t.id)).toEqual(['dsh-artifact:genoffice'])
    expect(b.sidebar.viewers.map((v) => v.id)).toEqual(
      CLAIMED_EXTS.map((ext) => `dsh-artifact:genoffice-${ext}`),
    )
    expect(b.sidebar.viewers.map((v) => v.exts[0])).toEqual([...CLAIMED_EXTS])
    for (const viewer of b.sidebar.viewers) {
      expect(viewer.priority).toBe(10)
      expect(viewer.fetchStrategy).toBe('none')
      expect(viewer.id.startsWith('dsh-artifact:')).toBe(true)
    }
    await b.runtime.dispose()
  })

  it('disposer from effect unregisters the tab (HMR / BR-006)', async () => {
    const b = await bench(true)
    expect(b.sidebar.registered).toHaveLength(1)
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
      viewerId: 'dsh-artifact:genoffice-docx',
    }
    const view = render(<DocxControlViewer {...props} />)
    const button = await view.findByRole('button', { name: '用内置预览打开' })
    expect(view.getByText(/relay 不可用/)).toBeTruthy()
    fireEvent.click(button)
    expect(view.getByText('builtin-docx')).toBeTruthy()
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
    expect(view.queryByRole('button', { name: '用内置预览打开' })).toBeNull()
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
