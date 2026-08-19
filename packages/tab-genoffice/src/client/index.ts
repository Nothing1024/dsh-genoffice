/**
 * Client half of the GenOffice tab artifact: registers the file-browser tab
 * and control-mode FileViewers (docx / xlsx / pptx) on `ctx.betterSidebar`. When the
 * upstream service is absent the plugin still loads and skips registration
 * (BR-003) — betterSidebar is requested via `ctx.inject` so a missing
 * service never fail-louds the whole DSH tree.
 */
import { createElement } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {
  BetterSidebarService,
  FileViewerDescriptor,
  TabComponentProps,
  TabDescriptor,
} from 'dsh-better-sidebar'
import { GenOfficePanel } from '../tabs/genoffice.tsx'
import { GenOfficeIcon } from '../tabs/icon.tsx'
import { DocxControlViewer } from '../tabs/docx-control-viewer.tsx'
import { CLAIMED_EXTS } from '../tabs/coexist.ts'
import { en, NS, zh } from '../tabs/locales.ts'
import { RELAY_BASE, emitOpenFile } from '../tabs/relay.ts'

/** Locale is required; betterSidebar is awaited inside apply so its absence
 *  skips registration instead of leaving this fiber PENDING (BR-003). */
export const inject = ['locale']

/** ClientContext and the upstream cordis augmentation live in different
 *  declaration graphs; this intersection is the type-only bridge (BR-002). */
type SidebarClientContext = ClientContext & { betterSidebar: BetterSidebarService }

/**
 * Register the GenOffice tab and claimed FileViewers when better-sidebar is present.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-tab-genoffice: dictionaries')

  ctx.inject(['betterSidebar'], (raw) => {
    const sidebarCtx = raw as SidebarClientContext
    const { betterSidebar } = sidebarCtx
    sidebarCtx.effect(
      () => {
        // 0.13 required fields stay id/title/component. Do not set urlTarget
        // (we do not claim http(s)) or FileViewer toolbar fields (internal).
        const tab: TabDescriptor = {
          id: 'dsh-genoffice:tab',
          title: () => t('tab.genoffice'),
          icon: (size: number) => createElement(GenOfficeIcon, { size }),
          order: 20,
          single: true,
          // Enable/disable appears automatically in the Side card settings
          // inventory from title + icon; we have no extra PrefsSchema toggles.
          component: (props: TabComponentProps) => createElement(GenOfficePanel, props),
        }
        return betterSidebar.registerTab(tab)
      },
      'dsh-tab-genoffice: registerTab',
    )
    for (const ext of CLAIMED_EXTS) {
      sidebarCtx.effect(
        () => {
          const viewer: FileViewerDescriptor = {
            id: `dsh-genoffice:viewer-${ext}`,
            title: () => `GenOffice · .${ext}`,
            icon: (size: number) => createElement(GenOfficeIcon, { size }),
            exts: [ext],
            priority: 10,
            fetchStrategy: 'none',
            component: DocxControlViewer,
          }
          return betterSidebar.registerFileViewer(viewer)
        },
        `dsh-tab-genoffice: registerFileViewer:${ext}`,
      )
    }

    // Global SSE: start before GenOfficePanel mounts so *_open events are
    // never lost even when the sidebar tab hasn't been opened yet (BR-M03).
    sidebarCtx.effect(() => {
      const es = new EventSource(`${RELAY_BASE}/api/open/stream`)
      es.addEventListener('file', (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data) as { path?: unknown }
          const filePath = typeof data.path === 'string' ? data.path : ''
          if (filePath === '') return
          betterSidebar.openTab({ type: 'dsh-genoffice:tab', path: filePath })
          setTimeout(() => emitOpenFile(filePath), 300)
        } catch { /* malformed event — ignore */ }
      })
      return () => es.close()
    }, 'dsh-tab-genoffice: open-file-stream')
  })
}
