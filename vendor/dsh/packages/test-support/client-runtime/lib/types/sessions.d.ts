/** Test-owned sessions face: the SlotRegistry host contract over declarative fixtures. */
import type { Context } from '@deepseek-ai/cordis';
import type { AttachmentIdType } from '@deepseek-ai/dsh-attachment';
import type { AgentContext, ConversationSnapshot, ISessions, ProjectionsFace, SessionFace, SessionId, SessionListState, SessionProvideDescriptor, SessionSearchResultItem, SessionSummary, SnapshotStore, SubagentAddress } from '@deepseek-ai/dsh-client-runtime/client';
import type { HostObservable, SessionMaybeProvideInfo, SessionProvideInfo } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionFixture, Stabilizer } from './fixtures.ts';
/**
 * The fixture-backed session face: conversation reads delegate to the
 * fixture's snapshot store; ISession verbs are fail-loud stubs unless the
 * fixture supplies them (the runtime never fakes behavior a test did not
 * declare — an unstubbed call names itself instead of half-working). Extra
 * fixture methods are grafted verbatim for feature-side casts.
 */
export declare class FixtureSession implements SessionFace {
    readonly sessionId: SessionId;
    private readonly store;
    /**
     * The useProjection seat: identity-stable per-key faces over the fixture's
     * projection values (set via {@link TestSessions.setProjection}).
     */
    readonly projections: ProjectionsFace & {
        set(key: string, value: unknown): void;
    };
    /**
     * @param sessionId - host identity (branded view of the fixture id).
     * @param store - conversation snapshot store (updateSnapshot writes it).
     * @param overrides - fixture-declared behavior face, grafted over the stubs.
     */
    constructor(sessionId: SessionId, store: SnapshotStore<ConversationSnapshot>, overrides: Record<string, unknown>);
    /** @returns the fixture conversation snapshot (useSession read side). */
    getSnapshot(): ConversationSnapshot;
    /**
     * Subscribe to fixture snapshot changes.
     * @param fn - change callback.
     * @returns unsubscribe.
     */
    subscribe(fn: () => void): () => void;
    /**
     * Fail-loud stub; supply `prompt` on the fixture's session face to exercise it.
     * @returns never — always throws.
     */
    prompt(): never;
    /**
     * Fail-loud stub; supply `readAttachment` on the fixture's session face to exercise it.
     * @param _attachmentId - opaque durable attachment id.
     * @returns never — always throws.
     */
    readAttachment(_attachmentId: AttachmentIdType): never;
    /**
     * Fail-loud stub; supply `updateQueue` on the fixture's session face to exercise it.
     * @returns never — always throws.
     */
    updateQueue(): never;
    /**
     * Fail-loud stub; supply `cancel` on the fixture's session face to exercise it.
     * @returns never — always throws.
     */
    cancel(): never;
    /**
     * Fail-loud stub; supply `command` on the fixture's session face to exercise it.
     * @returns never — always throws.
     */
    command(): never;
    /**
     * Fail-loud stub; supply `loadOlder` on the fixture's session face to exercise it.
     * @returns never — always throws.
     */
    loadOlder(): never;
    /**
     * Fail-loud stub; supply `rename` on the fixture's session face to exercise it.
     * @returns never — always throws.
     */
    rename(): never;
}
/** Test binding shape handed to provider resolvers and feature injects (a SessionBinding whose session is the fixture face). */
export interface TestSessionBinding {
    readonly sessionId: SessionId;
    readonly session: FixtureSession;
    readonly ctx: AgentContext;
}
/**
 * Sessions test double behind the renderer host and feature injects: owns the
 * list/current observable, the standard-props provide channel (the runtime's
 * `useSession` contribution included), scope minting through the production
 * `createScope`, and the session behavior face supplied per fixture.
 *
 * Implements the same ISessions face features receive as `ctx.sessions`, so
 * a production face change breaks this double at compile time; the extra
 * members (add/updateSnapshot/setCurrent/remove/behavior/calls/stubSearch and
 * the legacy provideInfo/maybeProvideInfo lookups) are bench-only surface.
 */
export declare class TestSessions implements ISessions {
    private readonly stabilize;
    private readonly rootCtx;
    /** The useSessions standard feed (list rows + current selection). */
    readonly list: SnapshotStore<SessionListState>;
    /**
     * Atomic current-session provide projection (production SessionRuntime
     * mirror): selection changes and provider-roster changes publish through
     * this one source — the member the SlotRegistry host face hands the
     * renderer's SessionProvider.
     */
    readonly currentProvideInfo: HostObservable<SessionMaybeProvideInfo>;
    private readonly records;
    /** The production provide channel (roster, materialization rules, current projection) — no test-side mirror. */
    private readonly channel;
    /** Calls observed on the service-level face, newest last. */
    readonly calls: {
        method: 'open' | 'openSubagent' | 'setSubagentCatalogOpen' | 'refreshSubagents' | 'clear' | 'search' | 'fork';
        args: unknown[];
    }[];
    /** The wire schema's `session.search` result bound (production parity). */
    readonly searchResultLimit = 20;
    /** Replaceable search behavior (see {@link TestSessions.stubSearch}). */
    private searchStub;
    /**
     * @param stabilize - the owning runtime's act wrapper.
     * @param rootCtx - the runtime's Cordis root; scope fibers mount under it.
     */
    constructor(stabilize: Stabilizer, rootCtx: Context);
    /**
     * Add a session from a fixture and (by default) make it current.
     * @param fixture - identity + snapshot/summary overrides + behavior face.
     * @param opts - pass `current: false` to add without selecting.
     * @returns the stable session id (branded view of `fixture.id`).
     */
    add(fixture: SessionFixture, opts?: {
        current?: boolean;
    }): Promise<SessionId>;
    /**
     * Update a session's conversation snapshot through an immer draft (the
     * live-stream stand-in: components subscribed via useSession re-render).
     * @param id - session id.
     * @param mutate - draft mutator.
     */
    updateSnapshot(id: string, mutate: (draft: ConversationSnapshot) => void): Promise<void>;
    /**
     * Update a session's list row (the wire-echo stand-in: title settles,
     * running flips — components subscribed via useSessions re-render).
     * @param id - session id.
     * @param patch - summary fields to merge over the row.
     */
    updateSummary(id: string, patch: Partial<Omit<SessionSummary, 'id'>>): Promise<void>;
    /**
     * Switch the current selection (undefined = the no-session empty state).
     * @param id - session id to select, or undefined to clear.
     */
    setCurrent(id: string | undefined): Promise<void>;
    /**
     * Remove a session: list row, scope fiber, and per-session store instances
     * (with persisted state) die together — the same single lifecycle axis the
     * production SessionRuntime drives on session death, minus staging.
     * @param id - session id.
     */
    remove(id: string): Promise<void>;
    /**
     * Register a per-session standard-props provider (production `provide`
     * contract: hooks become `use<Name>` selector hooks on the render side,
     * props spread verbatim; duplicate names fail loud at materialization).
     * @param descriptor - static member roster plus per-session resolver.
     * @returns disposer removing the provider.
     */
    provide(descriptor: SessionProvideDescriptor): () => void;
    /**
     * Resolve the definite per-session standard-props bundle (host face member).
     * @param id - session id.
     * @returns the identity-stable bundle, or undefined for unknown sessions.
     */
    provideInfo(id: string): SessionProvideInfo | undefined;
    /**
     * Resolve the current-session-optional standard kit (host face member):
     * unknown or absent ids return the static no-session projection.
     * @param id - current session id, when selected.
     * @returns a definite or no-session provide bundle.
     */
    maybeProvideInfo(id: string | undefined): SessionMaybeProvideInfo;
    /**
     * Resolve (mint on first touch) the session-scoped Cordis context through
     * the production `createScope`, so real `scopeOf`/scope-addressed services
     * resolve it.
     * @param id - session id.
     * @returns the scoped context, or undefined for unknown sessions.
     */
    scope(id: string): AgentContext | undefined;
    /**
     * Session assembly binding (inject factories and provide resolvers receive it).
     * @param id - session id.
     * @returns sessionId + behavior face + scoped ctx, or undefined when unknown.
     */
    binding(id: string): TestSessionBinding | undefined;
    /**
     * Read the session scope tag off a context (service-method boundary mirror).
     * @param ctx - any client context.
     * @returns the session id, or undefined on root contexts.
     */
    scopeOf(ctx: Context): SessionId | undefined;
    /**
     * Resolve the scoped session face off a context (production `sessionOf`
     * mirror).
     * @param ctx - any client context.
     * @returns the fixture session face, or undefined off-scope.
     */
    sessionOf(ctx: Context): SessionFace | undefined;
    /**
     * Service-level selection call (recorded, then applied to the list store
     * synchronously — inject callbacks call this outside any act window; the
     * store notify is microtask-batched so the next stabilized step observes it).
     * @param id - session id.
     */
    open(id: SessionId): void;
    /** Open an existing fixture through its catalog address. */
    openSubagent(address: SubagentAddress): void;
    /** Resolve the current fixture's retained catalog address. */
    subagentAddress(id: SessionId): SubagentAddress | undefined;
    /** Record catalog consumption; fixture callers drive snapshots explicitly. */
    setSubagentCatalogOpen(parentSessionId: SessionId, open: boolean): void;
    /** Record a catalog refresh; fixture callers drive snapshots explicitly. */
    refreshSubagents(parentSessionId: SessionId): Promise<void>;
    /** Apply a confirmed preset switch into the fixture list, as production does. */
    noteAgentPreset(sessionId: SessionId, agentPreset: string): void;
    /** Clear the current selection (recorded; the production no-session flow). */
    clear(): void;
    /**
     * Replace the sidebar-search result page (the call is still recorded).
     * @param impl - hits for a query, as the Host would rank them.
     */
    stubSearch(impl: (query: string, signal: AbortSignal) => {
        items: SessionSearchResultItem[];
        hasMore: boolean;
    }): void;
    /**
     * Content search over the fixture corpus (recorded). The default answers an
     * empty page: content ranking is Host behavior, so a scenario that asserts
     * hits declares them through {@link TestSessions.stubSearch}.
     * @param query - non-blank literal phrase.
     * @param signal - cancellation for a superseded search (recorded and forwarded).
     * @returns the stubbed or empty result page.
     */
    search(query: string, signal: AbortSignal): ReturnType<ISessions['search']>;
    /**
     * Recorded fork stub: no child materializes (benches asserting the full
     * fork flow drive the production service; this face only proves the call).
     * @param opts - source session id, optional cut anchor, and client title policy.
     * @returns the source id (no child record is created).
     */
    fork(opts: {
        sessionId: SessionId;
        atSeq?: number;
        increaseTitle?: boolean;
    }): Promise<SessionId>;
    /**
     * The session face of a fixture (typed view for assertions; fixture
     * behavior methods are grafted onto it).
     * @param id - session id.
     * @returns the FixtureSession the binding and provide channel carry.
     */
    behavior(id: string): FixtureSession;
    /** Dispose minted scope fibers (runtime dispose path). */
    disposeScopes(): Promise<void>;
    private bindingOf;
    private require;
}
//# sourceMappingURL=sessions.d.ts.map