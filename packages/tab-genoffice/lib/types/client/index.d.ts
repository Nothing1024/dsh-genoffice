/**
 * Client half of the GenOffice tab artifact — official client-bundle entry.
 *
 * 主体在 src/standard/client.ts（标准 client facet：file-browser tab、
 * control-mode FileViewers、全局 SSE；betterSidebar 缺席时按 BR-003 跳过
 * 注册不崩）。本文件只是 cordis 胶水；RFC 0002 定案后 manifest 直接声明
 * facet 产物，本入口保持不变服务官方装载。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
/** Locale is required; betterSidebar is acquired lazily so its absence
 *  skips registration instead of leaving this fiber PENDING (BR-003). */
export declare const inject: string[];
/**
 * Register the GenOffice tab and claimed FileViewers when better-sidebar is present.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map