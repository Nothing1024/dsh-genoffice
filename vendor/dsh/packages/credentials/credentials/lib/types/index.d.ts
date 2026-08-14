/**
 * Credential seam (`ctx.credentials`). Settings and composition files carry
 * *references* to secrets — environment-variable names — while providers own
 * the actual values and their storage. Consumers resolve a reference once per
 * operation, so a changed credential reaches the next operation without any
 * plugin restart, and configuration surfaces describe a reference without
 * ever seeing its value.
 * @module @deepseek-ai/dsh-credentials
 */
import { Context, Service } from 'cordis';
import type { Branded } from '@deepseek-ai/dsh-brand';
/** Nominal reference to one credential: a POSIX-style environment-variable name. */
export type CredentialRef = Branded<'CredentialRef'>;
/**
 * Brand a raw string as a {@link CredentialRef}.
 * @param value - candidate reference; a POSIX shell identifier such as `DEEPSEEK_API_KEY`.
 * @returns the branded reference.
 */
export declare function credentialRef(value: string): CredentialRef;
/** One resolved credential value and the source layer that supplied it. */
export interface ResolvedCredential {
    /** The non-empty secret value. */
    value: string;
    /** Provider-defined source layer id (the local provider uses `env` and `file`). */
    source: string;
}
/** Source and writability facts for one reference, safe for configuration UIs — never the value. */
export interface CredentialInfo {
    /** Whether {@link Credentials.resolve} would currently return a value. */
    configured: boolean;
    /** Source layer currently supplying the value; absent while unconfigured. */
    source?: string;
    /** Whether {@link Credentials.set} would currently succeed for this reference. */
    writable: boolean;
}
declare module 'cordis' {
    interface Context {
        credentials: Credentials;
    }
    interface Events {
        /**
         * Committed change to a provider-managed credential source: a `set`, an
         * `unset`, or an external edit observed in storage. Ambient
         * process-environment changes are not observable and never emit. Listener
         * failures are contained and logged — a sync throw and an async rejection
         * alike — without changing the committed operation's outcome, except
         * `INVARIANT`-coded failures, which rethrow after every listener ran;
         * that rethrow reaches the emitter only from synchronous listeners, so
         * invariant checks on this event must not be async functions.
         * @param ref - the reference whose stored value changed.
         * @mode emit
         */
        'credentials/updated'(ref: CredentialRef): void;
    }
}
/**
 * Abstract credential service. Providers implement the four operations over
 * their source layers; one seam-wide rule binds them all: an empty stored
 * value is absent everywhere — `resolve` skips it, `describe` reports it
 * unconfigured — so a blank never masquerades as a configured secret.
 */
export declare abstract class Credentials extends Service {
    constructor(ctx: Context);
    /**
     * Resolve one reference to its current value. Resolution is per call:
     * consumers re-resolve at each operation and must not cache across
     * operations — that per-operation read is what makes a changed credential
     * reach the next operation without a restart.
     * @param ref - the reference to resolve.
     * @returns the value and its source, or `undefined` while unconfigured.
     */
    abstract resolve(ref: CredentialRef): Promise<ResolvedCredential | undefined>;
    /**
     * Describe one reference for configuration surfaces without exposing the
     * value.
     * @param ref - the reference to describe.
     * @returns configured state, supplying source, and writability.
     */
    abstract describe(ref: CredentialRef): Promise<CredentialInfo>;
    /**
     * Durably store one value in the provider-managed writable source. Rejects
     * while a read-only source shadows the reference — the write would appear
     * to succeed while resolution keeps returning the shadowing value — and
     * rejects an empty value (use {@link unset}).
     * @param ref - the reference to store.
     * @param value - the non-empty secret value.
     */
    abstract set(ref: CredentialRef, value: string): Promise<void>;
    /**
     * Remove one reference from the provider-managed writable source; removing
     * an absent reference is a no-op. Rejects while a read-only source shadows
     * the reference, like {@link set}.
     * @param ref - the reference to remove.
     */
    abstract unset(ref: CredentialRef): Promise<void>;
    /**
     * Fan `credentials/updated` out with contained listener failures: every
     * listener runs, and a sync throw or async rejection is logged without
     * changing the committed operation's outcome — except `INVARIANT`-coded
     * failures, which rethrow after every listener ran (the rethrow reaches the
     * caller only from synchronous listeners, so invariant checks on this event
     * must not be async functions). Providers call this only after the write or
     * reload actually committed, so a broken observer can never make a durable
     * change look failed.
     * @param ref - the reference whose stored value changed.
     */
    protected notifyUpdated(ref: CredentialRef): void;
    /** Contained-listener diagnostic shared by the sync and async failure paths. */
    private warnListenerFailure;
}
export default Credentials;
//# sourceMappingURL=index.d.ts.map