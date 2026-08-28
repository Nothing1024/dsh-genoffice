/**
 * Host half of the GenOffice tab artifact — official dsh entry.
 *
 * 主体在 src/standard/host.ts（dsh-community-standard 的 host facet）；
 * 本文件只是 cordis 胶水：构造适配 activation 并驱动同一个 facet 定义。
 * dsh-plugin.json 的 facets.host.entry 指向 facet 构建产物 lib/standard/host.js，
 * dsh.plugin.json（官方 manifest）的 main 指向本文件的构建产物 lib/index.js。
 */
import type { Context } from '@deepseek-ai/cordis'
import { createHostActivation } from './standard/cordis-host-adapter.ts'
import { runFacet } from './standard/sdk.ts'
import hostFacet from './standard/host.ts'

/** Plugin name (host half). */
export const name = 'dsh-tab-genoffice'

/** Required services: the host tool registry. webServer / systemPrompt / skills are nested. */
export const inject = ['tools']

/**
 * Plugin host body.
 * @param ctx - host root context.
 */
export function apply(ctx: Context): void {
  void runFacet(hostFacet, createHostActivation(ctx).activation)
}
