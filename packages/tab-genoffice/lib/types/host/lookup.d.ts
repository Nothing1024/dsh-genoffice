/**
 * External profile plugins do not share the web-app isolate map, so
 * `ctx.inject(['webServer'])` stays PENDING and `ctx.webServer` throws.
 * The reflect store is process-wide; look up by shape.
 */
import type { Context } from '@deepseek-ai/cordis';
export declare function lookupService<T>(ctx: Context, pred: (value: unknown) => value is T): T | undefined;
export declare function lookupWebServer(ctx: Context): Context['webServer'] | undefined;
export declare function lookupSystemPrompt(ctx: Context): Context['systemPrompt'] | undefined;
//# sourceMappingURL=lookup.d.ts.map