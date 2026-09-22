/**
 * client facet 的 cordis 适配器：locale + 官方右侧 Sidebar
 * （`sidebarRight` / `sidebarRightTabs` / `slots`，optional，可能晚到）。
 * client 侧的 cordis 耦合止步于此文件与 src/client/index.ts。
 *
 * Do not read `ctx.sidebarRight` (etc.) on the parent fiber: Cordis 4
 * throws `cannot get property "…" without inject`. Peek through
 * `ctx.reflect.get(name, false)` or own properties on test benches.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { acquireFromCordis, type CordisLike } from './cordis-acquire.ts'
import {
  CLIENT_OPTIONAL,
  CLIENT_REQUIRED,
  LOCALE,
  SIDEBAR_TAB,
  type LocaleHandle,
  type SidebarAcquireHandle,
  type Translate,
} from './coordinates.ts'
import { coordKey, createActivation, type ActivationController } from './sdk.ts'
import type { OfficialSidebar } from './sidebar.ts'

const SIDEBAR_SERVICES = ['sidebarRight', 'sidebarRightTabs', 'slots'] as const

function peekNamed(ctx: object, name: string): unknown {
  let getter: ((n: string, strict?: boolean) => unknown) | undefined
  try {
    const reflect = (ctx as { reflect?: { get?: (n: string, strict?: boolean) => unknown } }).reflect
    if (typeof reflect?.get === 'function') getter = reflect.get.bind(reflect)
  } catch {
    getter = undefined
  }
  if (getter !== undefined) {
    try {
      return getter(name, false)
    } catch {
      return undefined
    }
  }
  return Object.prototype.hasOwnProperty.call(ctx, name)
    ? (ctx as Record<string, unknown>)[name]
    : undefined
}

function lookupOfficialSidebar(ctx: object): OfficialSidebar | undefined {
  const sidebarRight = peekNamed(ctx, 'sidebarRight') as OfficialSidebar['sidebarRight'] | undefined
  const sidebarRightTabs = peekNamed(ctx, 'sidebarRightTabs') as OfficialSidebar['sidebarRightTabs'] | undefined
  const slots = peekNamed(ctx, 'slots') as OfficialSidebar['slots'] | undefined
  if (sidebarRight === undefined || sidebarRightTabs === undefined || slots === undefined) {
    return undefined
  }
  const sessionId = peekNamed(ctx, 'sessionId')
  return {
    sidebarRight,
    sidebarRightTabs,
    slots,
    ...(typeof sessionId === 'string' ? { sessionId } : {}),
  }
}

export function createClientActivation(ctx: ClientContext): ActivationController {
  const cordis = ctx as unknown as CordisLike

  const locale: LocaleHandle = {
    bind: (ns) => ctx.locale.bind(ns as never) as Translate,
    register: (ns, dicts) => ctx.locale.register(ns as never, dicts as never),
  }

  const sidebar: SidebarAcquireHandle<OfficialSidebar> = {
    acquire: acquireFromCordis<OfficialSidebar>(
      cordis,
      (scope) => lookupOfficialSidebar(scope ?? ctx),
      SIDEBAR_SERVICES,
    ),
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
