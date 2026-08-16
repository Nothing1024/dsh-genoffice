/**
 * Host half of the GenOffice tab artifact: control tools, deployment prompt,
 * loopback asset channel, and the post-save sync window route.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { createAssetChannel } from './host/assets.ts'
import { applyPrompt } from './host/prompt.ts'
import { applySyncRoute } from './host/sync.ts'
import { createControlTools } from './host/tools.ts'

/** Plugin name (host half). */
export const name = 'dsh-tab-genoffice'

/** Required services: the host tool registry. webServer / systemPrompt are nested. */
export const inject = ['tools']

/**
 * Plugin host body.
 * @param ctx - host root context.
 */
export function apply(ctx: Context): void {
  applyPrompt(ctx)
  applySyncRoute(ctx)
  const assets = createAssetChannel(ctx)
  for (const tool of createControlTools({ assets })) {
    ctx.tools.register(tool)
  }
}
