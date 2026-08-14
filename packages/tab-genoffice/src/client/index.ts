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
  TabComponentProps,
} from 'dsh-better-sidebar'
import { GenOfficePanel } from '../tabs/genoffice.tsx'
import { GenOfficeIcon } from '../tabs/icon.tsx'
import { DocxControlViewer } from '../tabs/docx-control-viewer.tsx'
import { CLAIMED_EXTS } from '../tabs/coexist.ts'
import { en, NS, zh } from '../tabs/locales.ts'

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
      () => betterSidebar.registerTab({
        id: 'dsh-artifact:genoffice',
        title: () => t('tab.genoffice'),
        icon: (size: number) => createElement(GenOfficeIcon, { size }),
        order: 20,
        single: true,
        // Enable/disable appears automatically in the Side card settings
        // inventory from title + icon; we have no extra PrefsSchema toggles.
        component: (props: TabComponentProps) => createElement(GenOfficePanel, props),
      }),
      'dsh-tab-genoffice: registerTab',
    )
    for (const ext of CLAIMED_EXTS) {
      sidebarCtx.effect(
        () => betterSidebar.registerFileViewer({
          id: `dsh-artifact:genoffice-${ext}`,
          title: () => `GenOffice · .${ext}`,
          icon: (size: number) => createElement(GenOfficeIcon, { size }),
          exts: [ext],
          priority: 10,
          fetchStrategy: 'none',
          component: DocxControlViewer,
        }),
        `dsh-tab-genoffice: registerFileViewer:${ext}`,
      )
    }
  })
}
