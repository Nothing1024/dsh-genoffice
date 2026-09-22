// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { apply as genofficeApply } from '@deepseek-ai/dsh-tab-genoffice/client'
import { ControlModeViewer } from '../src/tabs/control-mode.tsx'
import { DocxControlViewer, GenOfficeFileTab } from '../src/tabs/docx-control-viewer.tsx'
import { CLAIMED_EXTS } from '../src/tabs/coexist.ts'
import { resetActiveDocs } from '../src/tabs/doc-registry.ts'
import { FILE_TAB_ID } from '../src/tabs/file-tab.ts'
import { absoluteFileAddress, fileAddressFor } from '../src/tabs/file-address.ts'
import { docIdFor, previewUrlFor, resetRelayStore } from '../src/tabs/relay.ts'
import {
  GENOFFICE_FILE_KIND,
  GENOFFICE_FILE_TAB_ID,
  GENOFFICE_KIND,
  GENOFFICE_TAB_ID,
  type OfficialSidebar,
  type SidebarPaneTabProps,
  type SidebarRightTabDefinition,
} from '../src/standard/sidebar.ts'

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

function fakeOfficialSidebar() {
  const types: SidebarRightTabDefinition[] = []
  const bodies: Array<{ key: string }> = []
  const openResource = vi.fn()
  const openTab = vi.fn()
  const close = vi.fn()
  const sidebar: OfficialSidebar = {
    sidebarRight: { openResource, openTab, close },
    sidebarRightTabs: {
      register(definition) {
        types.push(definition)
        return () => {
          const at = types.indexOf(definition)
          if (at >= 0) types.splice(at, 1)
        }
      },
    },
    slots: {
      inject(_name, register) {
        return register()
      },
      register(options, _component) {
        const entry = { key: options.key }
        bodies.push(entry)
        return () => {
          const at = bodies.indexOf(entry)
          if (at >= 0) bodies.splice(at, 1)
        }
      },
    },
  }
  return { sidebar, types, bodies, openResource, close }
}

function fileTabProps(path: string, close: () => void = () => {}): SidebarPaneTabProps {
  return {
    sessionId: 's',
    useTabInfo: () => ({
      sessionId: 's',
      tab: {
        id: `${FILE_TAB_ID}:${path}`,
        title: path.slice(path.lastIndexOf('/') + 1),
        contentId: fileAddressFor('s', undefined, path),
        kind: GENOFFICE_FILE_KIND,
        actions: { openResource: vi.fn(), openTab: vi.fn(), close },
      },
    }),
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
 * `sidebarRight`. Registration/dispose semantics mirror cordis
 * (`ctx.effect` runs the callback and collects the disposer).
 */
async function bench(withSidebar = true, sessionId?: string) {
  const fake = fakeOfficialSidebar()
  const disposers: Array<() => void> = []
  const locale = fakeLocale()
  const ctx: Record<string, unknown> = {
    locale,
    effect: (fn: () => void | (() => void)) => {
      const d = fn()
      if (typeof d === 'function') disposers.push(d)
    },
    inject: (names: string[], cb: (c: unknown) => void) => {
      if (withSidebar && names.includes('sidebarRight')) {
        cb({
          ...ctx,
          sidebarRight: fake.sidebar.sidebarRight,
          sidebarRightTabs: fake.sidebar.sidebarRightTabs,
          slots: fake.sidebar.slots,
          sessionId,
        })
      }
    },
  }
  if (withSidebar) {
    ctx.sidebarRight = fake.sidebar.sidebarRight
    ctx.sidebarRightTabs = fake.sidebar.sidebarRightTabs
    ctx.slots = fake.sidebar.slots
    if (sessionId !== undefined) ctx.sessionId = sessionId
  }
  genofficeApply(ctx as never)
  return {
    fake,
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

describe('genoffice official sidebar registration', () => {
  it('registers a guide page and an extension resource type for claimed office files', async () => {
    const b = await bench(true)
    expect(b.fake.types.map((t) => t.id)).toEqual([GENOFFICE_TAB_ID, GENOFFICE_FILE_TAB_ID])
    expect(b.fake.types[0]?.kind).toBe(GENOFFICE_KIND)
    expect(b.fake.types[1]?.kind).toBe(GENOFFICE_FILE_KIND)
    expect(b.fake.types[1]?.priority).toBe('extension')
    expect(b.fake.types[1]?.patterns).toEqual(CLAIMED_EXTS.map((ext) => `*.${ext}`))
    expect(b.fake.bodies.map((row) => row.key)).toEqual([GENOFFICE_TAB_ID, GENOFFICE_FILE_TAB_ID])
    await b.runtime.dispose()
  })

  it('disposer from effect unregisters the types (HMR / BR-006)', async () => {
    const b = await bench(true)
    expect(b.fake.types).toHaveLength(2)
    await b.plugin.dispose()
    expect(b.fake.types).toHaveLength(0)
    expect(b.fake.bodies).toHaveLength(0)
    await b.runtime.dispose()
  })

  it('optional peer: skips registration without throwing when sidebarRight is absent (BR-003)', async () => {
    const b = await bench(false)
    expect(b.fake.types).toHaveLength(0)
    await b.runtime.dispose()
  })

  it('does not read ctx.sidebarRight on a cordis-like proxy (inject fence)', async () => {
    const locale = fakeLocale()
    const fake = fakeOfficialSidebar()
    const store: Record<string, unknown> = {
      sidebarRight: fake.sidebar.sidebarRight,
      sidebarRightTabs: fake.sidebar.sidebarRightTabs,
      slots: fake.sidebar.slots,
    }
    const disposers: Array<() => void> = []
    const target = {
      locale,
      effect: (fn: () => void | (() => void)) => {
        const d = fn()
        if (typeof d === 'function') disposers.push(d)
      },
      inject: () => {},
      reflect: {
        get(name: string) {
          return store[name]
        },
      },
    }
    const ctx = new Proxy(target, {
      get(obj, prop, recv) {
        if (prop === 'sidebarRight' || prop === 'sidebarRightTabs' || prop === 'slots' || prop === 'sessionId') {
          throw new Error(`cannot get property "${String(prop)}" without inject`)
        }
        return Reflect.get(obj, prop, recv)
      },
    })
    expect(() => genofficeApply(ctx as never)).not.toThrow()
    expect(fake.types.map((t) => t.id)).toEqual([GENOFFICE_TAB_ID, GENOFFICE_FILE_TAB_ID])
    for (const d of disposers.splice(0)) d()
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
  it('shows a visible exit to the static fallback when relay is down (manual)', async () => {
    stubRelay(false)
    const view = render(
      <DocxControlViewer path="/tmp/a.docx" title="a.docx" />,
    )
    const button = await view.findByRole('button', { name: '用后备预览打开' })
    expect(view.getByText(/relay 不可用/)).toBeTruthy()
    fireEvent.click(button)
    expect(view.getByText(/没有可用的后备预览/)).toBeTruthy()
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

  it('file tab Back closes the tab; a viewer without onBack has no Back', async () => {
    stubRelay(true)
    const close = vi.fn()
    const tab = render(<GenOfficeFileTab {...fileTabProps('/tmp/a.docx', close)} />)
    const back = await tab.findByRole('button', { name: '返回' })
    fireEvent.click(back)
    expect(close).toHaveBeenCalled()

    tab.unmount()
    const viewer = render(
      <DocxControlViewer path="/tmp/b.docx" title="b.docx" />,
    )
    await within(viewer.container).findByRole('button', { name: '写入磁盘' })
    expect(within(viewer.container).queryByRole('button', { name: '返回' })).toBeNull()
  })

  it('dirty Back confirm cancel keeps the file tab open', async () => {
    stubRelay(true)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const close = vi.fn()
    const tab = render(<GenOfficeFileTab {...fileTabProps('/tmp/a.docx', close)} />)
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
    expect(close).not.toHaveBeenCalled()
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
    expect(b.fake.openResource).toHaveBeenCalledWith(
      absoluteFileAddress('/tmp/demo.docx'),
      { kind: GENOFFICE_FILE_KIND },
    )
    await b.runtime.dispose()
  })

  it('file event with sessionId opens on the matching page', async () => {
    const b = await bench(true, 'session-a')
    FakeEventSource.instances[0]?.emit(
      'file',
      JSON.stringify({ path: '/tmp/demo.docx', sessionId: 'session-a' }),
    )
    expect(b.fake.openResource).toHaveBeenCalledWith(
      fileAddressFor('session-a', undefined, '/tmp/demo.docx'),
      { kind: GENOFFICE_FILE_KIND },
    )
    await b.runtime.dispose()
  })

  it('a second page viewing another session does not open the origin session', async () => {
    const page1 = await bench(true, 'session-a')
    const page2 = await bench(true, 'session-b')
    const payload = JSON.stringify({ path: '/tmp/demo.docx', sessionId: 'session-a' })
    FakeEventSource.instances[0]?.emit('file', payload)
    FakeEventSource.instances[1]?.emit('file', payload)
    expect(page1.fake.openResource).toHaveBeenCalledWith(
      fileAddressFor('session-a', undefined, '/tmp/demo.docx'),
      { kind: GENOFFICE_FILE_KIND },
    )
    expect(page2.fake.openResource).not.toHaveBeenCalled()
    await page1.runtime.dispose()
    await page2.runtime.dispose()
  })

  it('a second file event opens a distinct resource address so files sit side by side', async () => {
    const b = await bench(true)
    FakeEventSource.instances[0]?.emit('file', JSON.stringify({ path: '/tmp/a.docx' }))
    FakeEventSource.instances[0]?.emit('file', JSON.stringify({ path: '/tmp/b.xlsx' }))
    expect(b.fake.openResource).toHaveBeenNthCalledWith(
      1,
      absoluteFileAddress('/tmp/a.docx'),
      { kind: GENOFFICE_FILE_KIND },
    )
    expect(b.fake.openResource).toHaveBeenNthCalledWith(
      2,
      absoluteFileAddress('/tmp/b.xlsx'),
      { kind: GENOFFICE_FILE_KIND },
    )
    expect(absoluteFileAddress('/tmp/a.docx')).not.toBe(
      absoluteFileAddress('/tmp/b.xlsx'),
    )
    await b.runtime.dispose()
  })

  it('ignores malformed SSE payloads', async () => {
    const b = await bench(true)
    expect(() => FakeEventSource.instances[0]?.emit('file', '{not-json')).not.toThrow()
    expect(b.fake.openResource).not.toHaveBeenCalled()
    await b.runtime.dispose()
  })
})
