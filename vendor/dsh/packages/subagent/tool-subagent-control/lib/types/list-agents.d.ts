/**
 * The globally named `list_agents` tool: a thin model-facing adapter over
 * the continuable projection of `ctx.subagents.listChildren()`. It is
 * separately loadable from the
 * root `send_message` plugin because it additionally requires the session
 * query service — a deployment may use `send_message` without loading session
 * query, and this plugin remains inactive until that service is available.
 * @module @deepseek-ai/dsh-tool-subagent-control/list-agents
 */
import type { Context } from 'cordis';
export declare const name = "tool-subagent-list-agents";
export declare const inject: string[];
/**
 * Register the `list_agents` tool.
 * @param ctx - context carrying the tool registry, subagent service, and session query.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=list-agents.d.ts.map