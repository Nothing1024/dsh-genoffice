/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-user-interaction`.
 * @module @deepseek-ai/dsh-user-interaction/invariant
 */
import type { Context } from 'cordis';
/** Cordis companion plugin name. */
export declare const name = "user-interaction-invariant";
/** Service required before the companion can reserve package ownership. */
export declare const inject: string[];
/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export declare const apply: (ctx: Context) => Promise<() => void>;
//# sourceMappingURL=invariant.d.ts.map