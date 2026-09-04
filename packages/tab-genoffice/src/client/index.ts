/**
 * Client half of the GenOffice tab artifact — official client-bundle entry.
 *
 * 主体在 src/standard/client.ts（标准 client facet：file-browser tab、
 * control-mode FileViewers、全局 SSE；betterSidebar 缺席时按 BR-003 跳过
 * 注册不崩）。本文件只是 cordis 胶水；RFC 0002 定案后 manifest 直接声明
 * facet 产物，本入口保持不变服务官方装载。
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { createClientActivation } from '../standard/cordis-client-adapter.ts'
import { runFacet } from '../standard/sdk.ts'
import clientFacet from '../standard/client.ts'

/** Locale is required; betterSidebar is acquired lazily so its absence
 *  skips registration instead of leaving this fiber PENDING (BR-003). */
export const inject = ['locale']

/**
 * Register the GenOffice tab and claimed FileViewers when better-sidebar is present.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  void runFacet(clientFacet, createClientActivation(ctx).activation)
}
