//#region lib/types/invariant.js
/**
* Package-owned invariant companion for `@deepseek-ai/dsh-tasks-local`.
* @module @deepseek-ai/dsh-tasks-local/invariant
*/
const PACKAGE_NAME = "@deepseek-ai/dsh-tasks-local";
/** Cordis companion plugin name. */
const name = "tasks-local-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/**
* No runtime invariant: the seam companion in `@deepseek-ai/dsh-tasks` already
* validates every registry snapshot this implementation publishes.
*/
const install = () => {};
/**
* Register this package's invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns the installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
