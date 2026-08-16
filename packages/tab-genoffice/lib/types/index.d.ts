/**
 * Host half of the GenOffice tab artifact: control tools, deployment prompt,
 * loopback asset channel, and the post-save sync window route.
 */
import type { Context } from '@deepseek-ai/cordis';
/** Plugin name (host half). */
export declare const name = "dsh-tab-genoffice";
/** Required services: the host tool registry. webServer / systemPrompt are nested. */
export declare const inject: string[];
/**
 * Plugin host body.
 * @param ctx - host root context.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map