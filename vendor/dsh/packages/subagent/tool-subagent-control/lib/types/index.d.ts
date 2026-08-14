/**
 * The globally named `send_message` tool: a thin model-facing adapter over
 * `ctx.subagents.followup()`. It performs no lifecycle routing of its own —
 * residency and cold resume belong to the subagent service — and it lives apart
 * from the provider-bound `@deepseek-ai/dsh-tool-subagent` instances so multiple
 * delegation tools share one control tool.
 * @module @deepseek-ai/dsh-tool-subagent-control
 */
import type { Context } from 'cordis';
export declare const name = "tool-subagent-control";
export declare const inject: string[];
/**
 * Register the `send_message` tool.
 * @param ctx - context carrying the tool registry and subagent service.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map