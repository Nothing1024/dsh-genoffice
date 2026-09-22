/**
 * Client half of the GenOffice tab artifact — official client-bundle entry.
 *
 * 主体在 src/standard/client.ts（标准 client facet：file-browser tab、
 * control-mode resource tabs、全局 SSE；官方 Sidebar 缺席时按 BR-003 跳过
 * 注册不崩）。本文件只是 cordis 胶水。
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { createClientActivation } from '../standard/cordis-client-adapter.ts'
import { runFacet } from '../standard/sdk.ts'
import clientFacet from '../standard/client.ts'

/** Locale is required. Sidebar services are peeked / nested-injected so
 *  their absence skips registration instead of leaving this fiber PENDING
 *  (BR-003). Never list them here — Cordis would hold the fiber. */
export const inject = ['locale']

/**
 * Register the GenOffice page and claimed Office resource tabs when the
 * official right Sidebar is present.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  void runFacet(clientFacet, createClientActivation(ctx).activation)
}
