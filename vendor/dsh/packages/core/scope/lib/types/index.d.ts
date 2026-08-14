/**
 * Scoped-context primitive: mint a Cordis context that tags registrations with
 * an opaque identity and build routing-only event carriers for that identity.
 *
 * @module @deepseek-ai/dsh-scope
 */
import type { Context } from 'cordis';
export { AnonymousEntries, NamedEntries, ScopedLayers } from './store.ts';
export type { ScopeLayer } from './store.ts';
/** An opaque, identity-compared scope key. */
export type ScopeKey = object;
declare const ScopedBrand: unique symbol;
/**
 * A routing-only event receiver built by {@link scopeTarget}. The type
 * parameter records the subject type for dispatch checking; the carrier does
 * not expose the subject's properties. Event payloads carry the real subject.
 */
export type Scoped<T extends object> = object & {
    readonly [ScopedBrand]: T;
};
/** A minted registration scope and its quiescent disposal boundaries. */
export interface Scope {
    /** Context through which scope-owned registrations are made. */
    ctx: Context;
    /** Exact Cordis disposer, used when nesting this scope in an ordered composite effect. */
    rawDispose: () => Promise<void> | void;
    /** Dispose every scope-owned registration; racing calls await the same completion. */
    dispose(): Promise<void>;
}
/**
 * Mint a scope under `ctx`. The scoped context inherits the minting plugin's
 * dependency surface and owns every registration made through it.
 * @param ctx - active context whose dependency surface the scope inherits.
 * @param key - opaque identity used for listener routing.
 * @returns the scoped context and exact/shared disposal boundaries.
 */
export declare function createScope(ctx: Context, key: ScopeKey): Scope;
/**
 * Read the nearest scope tag inherited by a context.
 * @param ctx - context to inspect.
 * @returns its scope key, or `undefined` for an unscoped context.
 */
export declare function scopeOf(ctx: Context): ScopeKey | undefined;
/**
 * Build an opaque receiver that preserves the base filter, admits untagged
 * listeners globally, and admits tagged listeners only for a matching key.
 * @param base - subject or service whose existing Cordis filter is preserved.
 * @param key - routed scope identity, or `undefined` for an unscoped subject.
 * @returns a carrier whose subject remains available only through event arguments.
 */
export declare function scopeTarget<T extends object>(base: T, key: ScopeKey | undefined): Scoped<T>;
/**
 * Test whether a value is a scope carrier.
 * @param value - dispatch receiver to inspect.
 * @returns whether {@link scopeTarget} created it.
 */
export declare function isScopeCarrier(value: unknown): value is Scoped<object>;
/**
 * Read a carrier's routing key.
 * @param value - dispatch receiver to inspect.
 * @returns the carrier key, or `undefined` for an unkeyed/non-carrier value.
 */
export declare function carrierKeyOf(value: unknown): ScopeKey | undefined;
//# sourceMappingURL=index.d.ts.map