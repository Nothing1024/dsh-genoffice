/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-bash-env`.
 * @module @deepseek-ai/dsh-bash-env/invariant
 */
import type { Context } from 'cordis';
/** Cordis companion plugin name. */
export declare const name = "bash-env-invariant";
/** Service required before the companion can reserve package ownership. */
export declare const inject: string[];
/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export declare const apply: (ctx: Context) => Promise<() => void>;
//# sourceMappingURL=invariant.d.ts.map