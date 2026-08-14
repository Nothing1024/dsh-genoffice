/** Package-owned permission-preset event invariants. @module @deepseek-ai/dsh-permission/invariant */
import type { Context } from 'cordis';
/** Cordis companion plugin name. */
export declare const name = "permission-invariant";
/** Service required before the companion can reserve package ownership. */
export declare const inject: string[];
/**
 * Register the permission invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export declare const apply: (ctx: Context) => Promise<() => void>;
//# sourceMappingURL=invariant.d.ts.map