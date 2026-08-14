/**
 * SlotsService: the cordis Service layer of the slot system over the pure
 * SlotCore (ui-slots owns registration semantics, the declaration ledger,
 * the load-time validations, and the unload cascade). This layer owns what
 * needs the runtime: the 'slots/changed' event bridge, register and
 * declaration injection through the caller's ctx.effect (fiber unload
 * collects both), the renderer install seam (install()/renderSlot('root') +
 * the SlotRendererHost face), and the store INSTANCE axis — handle x scope
 * key -> create/cache, dropped with the last holding entry, session instances
 * cleared (with persisted state) on scope death.
 */
import { Service } from 'cordis';
import type { Context } from 'cordis';
import { SlotCore } from '@deepseek-ai/dsh-client-ui-slots';
import type { LocaleFace, OwnerOf, SlotMap, SlotRenderer, SlotSpec, StoredEntry } from '@deepseek-ai/dsh-client-ui-slots';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        /** The built-in render-tree root hole (seeded by SlotCore): rendered only by the shell, occupied by a layout entry. */
        'root': {
            kind: 'single';
            scope: 'root';
            owner: RootOwnerProps;
        };
    }
}
/** Root owner share: the shell supplies nothing — the frame is inject-assembled. */
export interface RootOwnerProps {
    children?: never;
}
/** One synchronous effect installed while an injected slot declaration is live. */
type SlotInjectionEffect = (() => void) | Iterable<() => void, void, void>;
/** cordis Service layer of the slot system; see the module doc for the split with SlotCore. */
export declare class SlotsService extends Service {
    private readonly _core;
    /** Store-instance axis: handle -> mounted scope, refcount, resolved instances. */
    private readonly _stores;
    private _renderer;
    private _locale;
    private _host;
    /**
     * @param ctx - owning root context.
     */
    constructor(ctx: Context);
    /**
     * The single registration API. The typed face IS the core's register
     * (both overloads reused verbatim — one authority, no structural copy;
     * see SlotCore.register for children declaration, store seat, inject
     * face, load-time validation, and the unload cascade). This layer adds:
     * disposal through the caller's ctx.effect (fiber unload = cascade),
     * exclusive-factory minting (`store: createXxxStore` becomes a per-entry
     * handle), the registrant diagnostics stamp, and store-instance lifecycle
     * on the entry axis.
     *
     * Declared here, implemented by prototype assignment below the class: it
     * MUST stay a prototype method (never an instance arrow) — the cordis
     * service proxy binds `this.ctx` to the CALLER's context at call time,
     * which is what routes the effect (and the unload cascade) into the
     * caller's fiber. An arrow property would freeze `this` to the service's
     * own root ctx and silently break per-plugin disposal.
     */
    readonly register: SlotCore['register'];
    /**
     * Install an effect for each declaration lifetime of a slot. The callback
     * runs synchronously when the declaration already exists; otherwise it runs
     * inside the declaring `register()` call after the declaration is committed.
     * Collapse disposes the effect and a later declaration runs it again.
     * Callback effects are synchronous disposers; iterable effects install
     * transactionally and dispose in reverse order. The controller belongs to
     * the caller's fiber, so plugin unload cancels a pending wait and removes any
     * active contribution.
     *
     * @param key - declared SlotMap key to depend on.
     * @param callback - creates one disposer or an iterable of disposers.
     * @returns idempotent disposer for the wait and active effect.
     * @throws callback setup failures synchronously when the slot is already declared.
     */
    inject(key: keyof SlotMap & string, callback: () => SlotInjectionEffect): () => void;
    /**
     * Install the shell's renderer (web-react's createSlotRenderer product).
     * Boot-once: a second install throws. Runs through the caller's ctx.effect,
     * so shell fiber unload uninstalls the renderer.
     * @param renderer - the outlet machinery implementing SlotRenderer.
     */
    install(renderer: SlotRenderer): void;
    /**
     * Install the locale face backing the `t` standard seat (the locale
     * plugin's product; same boot-once discipline as the renderer install).
     * Runs through the caller's ctx.effect, so the installing fiber's unload
     * uninstalls the face.
     * @param face - namespace binder + revision observable.
     */
    installLocale(face: LocaleFace): void;
    /**
     * The single ctx-level render entry: the shell renders 'root'; every other
     * key renders inside components through the props renderSlot face. All
     * three guards are fail-loud boot-order checks, no fallback.
     * @param key - must be 'root' (runtime-enforced for dynamically composed callers).
     * @param owner - owner share for the root entry (the shell supplies {}).
     * @returns the rendered root tree.
     */
    renderSlot<K extends keyof SlotMap & string>(key: K, owner: OwnerOf<K>): ReturnType<SlotRenderer['renderRoot']>;
    /**
     * Drop the per-session store instances of a dead session (the sessions
     * service calls this on scope teardown; root-scoped records are untouched).
     * Persisted state goes with the session — a never-rendered dead session can
     * still own keys from an earlier page load, so the instance is materialized
     * transiently just to clear storage (no-op for unpersisted stores).
     * @param sessionId - the torn-down session.
     */
    pruneStoreScope(sessionId: string): void;
    /**
     * Snapshot entries for a key (render-erased view; stable reference between mutations).
     * @param key - SlotMap key.
     * @returns registered entries.
     */
    entries(key: keyof SlotMap & string): readonly StoredEntry[];
    /**
     * Look up a declared spec (register-declared or the built-in 'root').
     * @param key - SlotMap key.
     * @returns spec or undefined.
     */
    spec<K extends keyof SlotMap & string>(key: K): SlotSpec<SlotMap[K]> | undefined;
    /**
     * Subscribe to a key's registration changes (microtask-batched).
     * @param key - SlotMap key.
     * @param fn - change callback.
     * @returns unsubscribe.
     */
    subscribe(key: keyof SlotMap & string, fn: () => void): () => void;
    /**
     * Version counter for uSES pairing.
     * @param key - SlotMap key.
     * @returns current version.
     */
    getVersion(key: keyof SlotMap & string): number;
    /** Delegating registration path: factory minting + registrant stamp + core write + instance-axis bookkeeping. */
    private _register;
    /** Build once after both object-layer services mount; per-session provide bundles still resolve lazily. */
    private hostFace;
    /** Resolve (create or reuse) the store instance for a registered handle under a scope key. */
    private resolveStore;
    /** Bind (or re-reference) a handle on the axis; cross-scope conflicts already threw in the core. */
    private _acquire;
    /** Drop one reference; the last holder's unload drops the record (instances go with it — engine stores need no explicit dispose). */
    private _release;
}
export {};
//# sourceMappingURL=slots.d.ts.map