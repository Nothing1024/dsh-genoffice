import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
/** Locale is required; betterSidebar is awaited inside apply so its absence
 *  skips registration instead of leaving this fiber PENDING (BR-003). */
export declare const inject: string[];
/**
 * Register the GenOffice tab and claimed FileViewers when better-sidebar is present.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map