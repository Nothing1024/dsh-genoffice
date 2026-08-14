/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-loader-smoke`.
 * @module @deepseek-ai/dsh-loader-smoke/invariant
 */
const PACKAGE_NAME = '@deepseek-ai/dsh-loader-smoke';
/** Cordis companion plugin name. */
export const name = 'loader-smoke-invariant';
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants'];
/**
 * No runtime invariant: this test-support package owns no production event stream or mutable data;
 * consuming test suites exercise its behavior.
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