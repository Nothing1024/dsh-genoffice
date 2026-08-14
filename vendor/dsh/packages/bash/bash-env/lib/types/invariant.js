/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-bash-env`.
 * @module @deepseek-ai/dsh-bash-env/invariant
 */
const PACKAGE_NAME = '@deepseek-ai/dsh-bash-env';
/** Cordis companion plugin name. */
export const name = 'bash-env-invariant';
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants'];
/**
 * No runtime invariant: the environment registry validates ownership and collected values at each
 * registration/collection; it publishes no independent snapshot that a companion could cross-check.
 */
const install = () => { };
/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
/* jscpd:ignore-end */
//# sourceMappingURL=invariant.js.map