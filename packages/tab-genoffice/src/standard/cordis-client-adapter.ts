/**
 * client facet 的 cordis 适配器：把 dsh client runtime 的 locale 服务与
 * better-sidebar（optional peer，可能晚到）映射成标准 activation。
 * client 侧的 cordis 耦合止步于此文件与 src/client/index.ts 两行胶水。
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { BetterSidebarService } from 'dsh-better-sidebar'
import { acquireFromCordis, type CordisLike } from './cordis-acquire.ts'
import {
  CLIENT_OPTIONAL,
  CLIENT_REQUIRED,
  LOCALE,
  SIDEBAR_TAB,
  type LocaleHandle,
  type SidebarAcquireHandle,
} from './coordinates.ts'
import { coordKey, createActivation, type ActivationController } from './sdk.ts'

export function createClientActivation(ctx: ClientContext): ActivationController {
  const cordis = ctx as unknown as CordisLike

  // dsh locale 服务的泛型按「已注册命名空间字面量」收窄；句柄面向标准层
  // 用 string 命名空间，这两处收窄转换是适配器的职责边界。
  const locale: LocaleHandle = {
    bind: (ns) => ctx.locale.bind(ns as never) as unknown as ReturnType<LocaleHandle['bind']>,
    register: (ns, dicts) => ctx.locale.register(ns as never, dicts as never),
  }

  /** betterSidebar 无进程内 lookup（client 运行时按 inject 供给），恒走延迟绑定。 */
  const sidebar: SidebarAcquireHandle<BetterSidebarService> = {
    acquire: acquireFromCordis<BetterSidebarService>(cordis, () => undefined, 'betterSidebar'),
  }

  return createActivation({
    declared: [...CLIENT_REQUIRED, ...CLIENT_OPTIONAL],
    contracts: new Map<string, unknown>([
      [coordKey(LOCALE), locale],
      [coordKey(SIDEBAR_TAB), sidebar],
    ]),
    onScopeAdd: (dispose) => {
      cordis.effect(() => () => { void dispose() }, 'dsh-tab-genoffice: standard scope')
    },
  })
}
