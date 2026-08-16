/** Test-owned Remote face: `$on` subscriptions driven by the internal forwarded-event plumbing. */
import type { Context } from '@deepseek-ai/cordis';
/**
 * Remote service test double for the forwarded-event path. Feature specs need
 * `ctx.remote.$on` to exist (their plugins inject `remote`) and need forwarded
 * host events to reach those subscribers, but not the generated namespaces or
 * the wire — so this double implements subscription and dispatch only.
 *
 * Dispatch is driven the same way production drives it: `client/runtime` owns the
 * host frame sink and hands each decoded `host/remote-event` frame to
 * `$dispatch`. A spec therefore exercises its refresh chains by calling
 * `$dispatch(name, args)` on this double.
 *
 * `$mount` rejects: a spec that reaches a generated namespace through this
 * double has outgrown it and needs the real Client Remote service.
 *
 * One deliberate asymmetry with production: a throwing listener propagates out
 * of the emit instead of being contained and logged, so a spec cannot lean on
 * this double for the containment guarantee `$on` documents — assert that
 * against the real service.
 */
export declare class TestRemote {
    private readonly subscriptions;
    /**
     * Register the double as `ctx.remote`.
     * @param ctx - the spec's root Context.
     */
    constructor(ctx: Context);
    /**
     * Deliver one forwarded host event to its subscribers, standing in for the
     * carrier that owns the frame sink.
     * @param event - forwarded host event name.
     * @param args - the Host argument list, verbatim.
     */
    $dispatch(event: string, args: readonly unknown[]): void;
    /**
     * Subscribe to one forwarded host event.
     * @param event - forwarded host event name.
     * @param listener - receives the Host argument list verbatim.
     * @returns disposer removing this subscription.
     */
    $on(event: string, listener: (...args: never[]) => void): () => void;
    /**
     * Generated-namespace mount, unsupported by this double.
     * @returns never; always rejects.
     */
    $mount(): Promise<() => Promise<void>>;
}
//# sourceMappingURL=remote.d.ts.map