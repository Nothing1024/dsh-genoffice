/**
 * Model-facing whole-list replacement. Each call appends a `todo/write` snapshot to the calling
 * agent's session; replay is last-write-wins, and UIs render from session events. A non-agent
 * caller has no owning list and is rejected. Named exports preserve loader injection metadata.
 * @module @deepseek-ai/dsh-tool-todo
 */
import type { Context } from 'cordis';
export type * from './types.ts';
export declare const name = "tool-todo";
export declare const inject: string[];
/** Register the `todo_write` tool on `ctx.tools` and, when the session-projection seam is composed, the `todos` unit. */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map