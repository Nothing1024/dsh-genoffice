/**
 * Scoped-context primitive: mint a Cordis context that tags registrations with
 * an opaque identity and build routing-only event carriers for that identity.
 *
 * @module @deepseek-ai/dsh-scope
 */
import { Context as CordisContext } from 'cordis';
export { AnonymousEntries, NamedEntries, ScopedLayers } from "./store.js";
/** Context tag written by {@link createScope}. */
const kScope = Symbol('dsh.scope');
/** The key associated with each carrier. Presence distinguishes an unkeyed carrier from a non-carrier. */
const carrierKeys = new WeakMap();
/** Follow a Cordis fiber through asynchronous teardown even if its raw disposer was already claimed. */
async function quiesceFiber(fiber) {
    await Promise.resolve(fiber.dispose());
    while (fiber.inertia !== undefined)
        await fiber.inertia;
}
/** Shared no-op plugin used as the backing scope fiber. */
function scope() { }
/**
 * Mint a scope under `ctx`. The scoped context inherits the minting plugin's
 * dependency surface and owns every registration made through it.
 * @param ctx - active context whose dependency surface the scope inherits.
 * @param key - opaque identity used for listener routing.
 * @returns the scoped context and exact/shared disposal boundaries.
 */
export function createScope(ctx, key) {
    const fiber = ctx.plugin(scope);
    const scoped = fiber.ctx.extend({ [kScope]: key });
    let disposing;
    return {
        ctx: scoped,
        rawDispose: fiber.dispose,
        dispose: () => (disposing ??= quiesceFiber(fiber)),
    };
}
/**
 * Read the nearest scope tag inherited by a context.
 * @param ctx - context to inspect.
 * @returns its scope key, or `undefined` for an unscoped context.
 */
export function scopeOf(ctx) {
    return ctx[kScope];
}
/**
 * Build an opaque receiver that preserves the base filter, admits untagged
 * listeners globally, and admits tagged listeners only for a matching key.
 * @param base - subject or service whose existing Cordis filter is preserved.
 * @param key - routed scope identity, or `undefined` for an unscoped subject.
 * @returns a carrier whose subject remains available only through event arguments.
 */
export function scopeTarget(base, key) {
    const baseFilter = base[CordisContext.filter];
    const carrier = {
        [CordisContext.filter](ctx) {
            if (baseFilter !== undefined && !baseFilter.call(base, ctx))
                return false;
            const tag = scopeOf(ctx);
            return tag === undefined || tag === key;
        },
    };
    carrierKeys.set(carrier, key);
    return carrier;
}
/**
 * Test whether a value is a scope carrier.
 * @param value - dispatch receiver to inspect.
 * @returns whether {@link scopeTarget} created it.
 */
export function isScopeCarrier(value) {
    return typeof value === 'object' && value !== null && carrierKeys.has(value);
}
/**
 * Read a carrier's routing key.
 * @param value - dispatch receiver to inspect.
 * @returns the carrier key, or `undefined` for an unkeyed/non-carrier value.
 */
export function carrierKeyOf(value) {
    if (!isScopeCarrier(value)) {
        return undefined;
    }
    return carrierKeys.get(value);
}
//# sourceMappingURL=index.js.map