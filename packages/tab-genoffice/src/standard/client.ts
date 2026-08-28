/**
 * GenOffice 的 client facet 主体（dsh-community-standard 形态）。
 *
 * v0.15 中 `client` 是保留 facet 名（归 RFC 0002），manifest 不声明本模块；
 * 生产路径由官方 client bundle 入口（src/client/index.ts）经
 * cordis-client-adapter 执行同一份主体。RFC 0002 定案后，把本模块的构建
 * 产物填进 facets.client.entry 即完成切换——主体零改动。
 *
 * 依赖（CLIENT_REQUIRED / CLIENT_OPTIONAL 镜像）：
 * - Locale（required）：词典注册 + 翻译绑定；
 * - SidebarTab（optional peer）：缺席时跳过全部 UI 注册不崩（BR-003）。
 */
import { createElement } from 'react'
import type {
  BetterSidebarService,
  FileViewerDescriptor,
  TabComponentProps,
  TabDescriptor,
} from 'dsh-better-sidebar'
import { GenOfficePanel } from '../tabs/genoffice.tsx'
import { GenOfficeIcon } from '../tabs/icon.tsx'
import { DocxControlViewer, GenOfficeFileTab } from '../tabs/docx-control-viewer.tsx'
import { CLAIMED_EXTS } from '../tabs/coexist.ts'
import { BROWSER_TAB_ID, FILE_TAB_ID, fileOpenOnThisPage } from '../tabs/file-tab.ts'
import { en, NS, zh } from '../tabs/locales.ts'
import { RELAY_BASE } from '../tabs/relay.ts'
import { defineFacet } from './sdk.ts'
import {
  LOCALE,
  SIDEBAR_TAB,
  type LocaleHandle,
  type SidebarAcquireHandle,
} from './coordinates.ts'

/** 全部 UI 注册（tabs + FileViewers + 全局 SSE）。返回合并卸载函数。 */
function mountSidebar(
  betterSidebar: BetterSidebarService,
  t: (key: string) => string,
): () => void {
  const offs: Array<() => void> = []

  // 0.13 required fields stay id/title/component. Do not set urlTarget
  // (we do not claim http(s)) or FileViewer toolbar fields (internal).
  const browserTab: TabDescriptor = {
    id: BROWSER_TAB_ID,
    title: () => t('tab.genoffice'),
    icon: (size: number) => createElement(GenOfficeIcon, { size }),
    order: 20,
    single: true,
    // Enable/disable appears automatically in the Side card settings
    // inventory from title + icon; we have no extra PrefsSchema toggles.
    component: (props: TabComponentProps) => createElement(GenOfficePanel, props),
  }
  offs.push(betterSidebar.registerTab(browserTab))

  const fileTab: TabDescriptor = {
    id: FILE_TAB_ID,
    title: () => t('tab.file'),
    icon: (size: number) => createElement(GenOfficeIcon, { size }),
    hidden: true,
    dedupeKey: (opened) => opened.path,
    component: (props: TabComponentProps) => createElement(GenOfficeFileTab, props),
  }
  offs.push(betterSidebar.registerTab(fileTab))

  for (const ext of CLAIMED_EXTS) {
    const viewer: FileViewerDescriptor = {
      id: `dsh-genoffice:viewer-${ext}`,
      title: () => `GenOffice · .${ext}`,
      icon: (size: number) => createElement(GenOfficeIcon, { size }),
      exts: [ext],
      priority: 10,
      fetchStrategy: 'none',
      component: DocxControlViewer,
    }
    offs.push(betterSidebar.registerFileViewer(viewer))
  }

  // Global SSE: *_open lands on a per-path file tab even if the browser
  // tab has not been opened yet (BR-M03). Only the page whose active
  // session matches sessionId mounts the iframe (see fileOpenOnThisPage).
  const es = new EventSource(`${RELAY_BASE}/api/open/stream`)
  es.addEventListener('file', (ev: MessageEvent) => {
    try {
      const data = JSON.parse(ev.data) as { path?: unknown; sessionId?: unknown }
      const activeSessionId = betterSidebar.getSnapshot?.().sessionId
      const next = fileOpenOnThisPage(data, activeSessionId)
      if (next === undefined) return
      betterSidebar.openTab(next.seed)
    } catch { /* malformed event — ignore */ }
  })
  offs.push(() => { es.close() })

  return () => {
    for (const off of offs.splice(0).reverse()) off()
  }
}

export default defineFacet((activation) => {
  const { contracts, scope } = activation

  const locale = contracts.get<LocaleHandle>(LOCALE)
  const t = locale.bind(NS)
  scope.add(locale.register(NS, { zh, en }))

  if (!contracts.has(SIDEBAR_TAB)) return
  const sidebar = contracts.get<SidebarAcquireHandle<BetterSidebarService>>(SIDEBAR_TAB)
  scope.add(sidebar.acquire((betterSidebar) => mountSidebar(betterSidebar, t)))
})
