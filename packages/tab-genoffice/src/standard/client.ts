/**
 * GenOffice 的 client facet 主体（dsh-community-standard 形态）。
 *
 * v0.15 中 `client` 是保留 facet 名（归 RFC 0002），manifest 不声明本模块；
 * 生产路径由官方 client bundle 入口（src/client/index.ts）经
 * cordis-client-adapter 执行同一份主体。
 *
 * 依赖：
 * - Locale（required）：词典注册 + 翻译绑定；
 * - SidebarRight（optional）：缺席时跳过全部 UI 注册不崩（BR-003）。
 */
import { createElement } from 'react'
import { GenOfficePanel } from '../tabs/genoffice.tsx'
import { GenOfficeIcon } from '../tabs/icon.tsx'
import { GenOfficeFileTab } from '../tabs/docx-control-viewer.tsx'
import { CLAIMED_EXTS, isControlExt } from '../tabs/coexist.ts'
import { controlOpenAddress, fileNameOf, fileOpenOnThisPage } from '../tabs/file-tab.ts'
import { parseFileAddress } from '../tabs/file-address.ts'
import { en, NS, zh } from '../tabs/locales.ts'
import { RELAY_BASE, extOf } from '../tabs/relay.ts'
import { defineFacet } from './sdk.ts'
import {
  LOCALE,
  SIDEBAR_TAB,
  type LocaleHandle,
  type SidebarAcquireHandle,
} from './coordinates.ts'
import {
  GENOFFICE_FILE_KIND,
  GENOFFICE_FILE_TAB_ID,
  GENOFFICE_KIND,
  GENOFFICE_TAB_ID,
  type OfficialSidebar,
  type SidebarRightTabDefinition,
} from './sidebar.ts'

function canOpenControlAddress(address: string): boolean {
  const parsed = parseFileAddress(address)
  if (parsed === undefined) return false
  return isControlExt(extOf(parsed.path))
}

function basenameOfAddress(address: string): string {
  const parsed = parseFileAddress(address)
  if (parsed === undefined) return 'GenOffice'
  const name = fileNameOf(parsed.path)
  return name === '' ? 'GenOffice' : name
}

function registerKeyedTab(
  sidebar: OfficialSidebar,
  id: string,
  component: (props: Record<string, unknown>) => unknown,
  locale?: string,
): () => void {
  const { slots } = sidebar
  return slots.inject('sidebar.right.pane.tab', () => slots.register(
    { name: 'sidebar.right.pane.tab', key: id, ...(locale === undefined ? {} : { locale }) },
    component,
  ))
}

function mountSidebar(
  sidebar: OfficialSidebar,
  t: (key: string) => string,
  activeSessionId: () => string | undefined,
): () => void {
  const offs: Array<() => void> = []
  const { sidebarRight, sidebarRightTabs } = sidebar

  const browserType: SidebarRightTabDefinition = {
    id: GENOFFICE_TAB_ID,
    kind: GENOFFICE_KIND,
    title: () => t('tab.genoffice'),
    guide: [{
      id: 'genoffice',
      order: 20,
      title: () => t('tab.genoffice'),
      description: () => t('tab.guide'),
      icon: GenOfficeIcon,
    }],
  }
  offs.push(sidebarRightTabs.register(browserType))
  offs.push(registerKeyedTab(
    sidebar,
    GENOFFICE_TAB_ID,
    (props) => createElement(GenOfficePanel, props as never),
    NS,
  ))

  const fileType: SidebarRightTabDefinition = {
    id: GENOFFICE_FILE_TAB_ID,
    kind: GENOFFICE_FILE_KIND,
    patterns: CLAIMED_EXTS.map((ext) => `*.${ext}`),
    priority: 'extension',
    canOpen: canOpenControlAddress,
    title: basenameOfAddress,
  }
  offs.push(sidebarRightTabs.register(fileType))
  offs.push(registerKeyedTab(
    sidebar,
    GENOFFICE_FILE_TAB_ID,
    (props) => createElement(GenOfficeFileTab, props as never),
  ))

  const es = new EventSource(`${RELAY_BASE}/api/open/stream`)
  es.addEventListener('file', (ev: MessageEvent) => {
    try {
      const data = JSON.parse(ev.data) as { path?: unknown; sessionId?: unknown }
      const pageSessionId = activeSessionId()
      const next = fileOpenOnThisPage(data, pageSessionId)
      if (next === undefined) return
      try {
        sidebarRight.openResource(controlOpenAddress(next.path, pageSessionId), {
          kind: GENOFFICE_FILE_KIND,
        })
      } catch (error) {
        console.error('[genoffice] explicit control open failed', error)
      }
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
  const sidebar = contracts.get<SidebarAcquireHandle<OfficialSidebar>>(SIDEBAR_TAB)
  scope.add(sidebar.acquire((service) => mountSidebar(service, t, () => service.sessionId)))
})
