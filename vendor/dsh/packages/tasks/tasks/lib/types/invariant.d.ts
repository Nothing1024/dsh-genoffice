/** Package-owned background-task snapshot invariants. @module @deepseek-ai/dsh-tasks/invariant */
import type { Context } from 'cordis';
/** Cordis companion plugin name. */
export declare const name = "tasks-invariant";
/** Service required before the companion can reserve package ownership. */
export declare const inject: string[];
/**
 * Register the task-registry invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export declare const apply: (ctx: Context) => Promise<() => void>;
//# sourceMappingURL=invariant.d.ts.map