import type { Context } from 'cordis';
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types';
import type { IApiClient, MessageId, MuxFrame, QueueAction, RpcId, RpcResult, SessionId, SubagentAddress } from '@deepseek-ai/dsh-client-connection/client';
import type { SessionFace } from '../contract/session.ts';
import type { ConversationSnapshot } from './conversation.ts';
import { ProjectionValueStore } from './projection-store.ts';
/** Messages requested per history page. */
export declare const PAGE_MESSAGES = 50;
/** Manager-owned observers of a Session object's local state edges. */
export interface SessionOptions {
    /** Catalog-discovered address selecting non-activating subagent transport. */
    address?: SubagentAddress;
    /** Whether the exact direct parent Agent was live at the latest catalog read. */
    parentAvailable?: boolean;
    /**
     * First ACCEPTED prompt on a blank session (fires at most once, on the
     * prompt RPC's success response): the manager mirrors the blank→false flip
     * into its list row so the session surfaces without waiting for a host
     * frame. Acceptance is the flip point because it proves the user message
     * is in the host log; a rejected first prompt keeps the session blank
     * (hidden, still reusable by connectWorkspace).
     */
    onEngaged?(session: Session): void;
    /**
     * Manager-owned projection value store to adopt (frames route through the
     * manager and values outlive instantiation); omitted, the Session owns a
     * private store (bare object-layer construction).
     */
    projections?: ProjectionValueStore;
}
/**
 * Owns a session's event window, derived conversation state, and observable
 * snapshot. React bindings remain outside this data layer. Features see only
 * the {@link SessionFace} slice (ISession verbs + the snapshot source); the
 * remaining public members are manager/runtime entry points.
 */
export declare class Session implements SessionFace {
    readonly sessionId: SessionId;
    private readonly api;
    private readonly options;
    private events;
    /** Wire views aligned with `events` by index (envelope-level annotations; undefined = no view).
     *  Kept parallel rather than merged so `events` stays the raw log slice (model-visible ⟺ logged). */
    private views;
    private baseSeq;
    private hasMore;
    private openState;
    private openError;
    private openPromise;
    /** Bumped by resync to invalidate an in-flight doOpen: a reconnect must rebuild, never adopt
     *  a pre-disconnect open whose history request is already doomed (audit S4). Stale doOpen
     *  passes drop all writes once the generation moves on. */
    private openGeneration;
    private loadingOlder;
    private readonly transcript;
    private partial;
    private openCalls;
    /** Last entered step per turn, folded from step/start for terminal error placement. */
    private lastStepByTurn;
    /** Operational notices and interrupted-turn terminal nodes merged into the flow by seq.
     *  Derived from window events and rebuilt with partial/openCalls; the transcript is
     *  seq-monotonic, so a plain seq merge preserves event order. */
    private derivedNodes;
    private pending;
    private callsRev;
    private callsCache;
    private pendingRev;
    private pendingCache;
    private derivedRev;
    private nodesCache;
    /** Exact turn timing retained from the raw window so presentation never
     *  infers elapsed time from transcript content. */
    private turnTimings;
    private turnTimingsRev;
    private turnTimingsCache;
    /** Completed turn boundaries retained from the raw window so presentation
     *  actions never infer a safe fork point from transcript content alone. */
    private turnEnds;
    private turnEndsRev;
    private turnEndsCache;
    /** Authoritative stream-only inbox snapshot; pending work never hits history. */
    private queued;
    private queueRev;
    private queueCache;
    /** `run_code` sub-dispatches by parent callId (window-derived, like openCalls). Appends
     *  copy-on-write the per-parent array so published snapshot references never mutate. */
    private codeDispatches;
    private dispatchesRev;
    private dispatchesCache;
    /** In-window `artifact/delta` accumulation by callId (window-derived, like codeDispatches). */
    private artifactDeltas;
    private deltasRev;
    private deltasCache;
    private running;
    private address;
    private parentAvailable;
    /**
     * Sticky send marker, private input of the composerPhase derivation: set
     * synchronously before prompt()'s first await, never reset — the blank →
     * engaging edge of the phase machine (see ComposerPhase).
     */
    private promptAttempted;
    /** Empty-log mirror (see ConversationSnapshot.blank); monotone false once flipped. */
    private blankBit;
    private removed;
    private promptError;
    private lastAgentError;
    /** Live events buffered during open/resync and stitched by sequence once history lands. */
    private liveBuffer;
    /** Gap repair in flight; live events detour to the buffer until the tail page lands. */
    private stitching;
    /** subscribed.lastSeq baseline (gap detection; null when no subscribed frame arrived — degrade to the liveBuffer dedup path). */
    private subscribedLastSeq;
    /**
     * Per-session projection value store (session-projection RFC, push model):
     * finished whole values computed on the host, seeded by the tail page's
     * projections block and updated by `session/projection` frames under the
     * one higher-seq-wins rule. Keys are read via `projections.faceOf(key)`
     * (the useProjection resolution face); the conversation snapshot never
     * carries projection values, and no client-side domain folding exists.
     * Manager-owned when constructed through SessionManager (frames route and
     * the store outlives instantiation, the title-snapshot precedent); a bare
     * construction gets a private store.
     */
    readonly projections: ProjectionValueStore;
    private snapshotCache;
    private readonly notifier;
    /**
     * Agent-scoped cordis context, bound once by SessionsService when it
     * mints the scope (the client mirror of the host Agent's loopCtx). The
     * Session dispatches its own scoped events through it; undefined means
     * unbound (bare object-layer construction) or already pruned — both skip
     * dispatch-dependent behavior rather than fail.
     */
    private actx;
    /**
     * @param sessionId - Host session identity (client sessions are always Host-born).
     * @param api - shared wire client.
     * @param options - optional manager-owned state observers.
     */
    constructor(sessionId: SessionId, api: IApiClient, options?: SessionOptions);
    /**
     * Bind the Agent-scoped context minted by SessionsService (single write;
     * a second bind is a wiring error and throws). Direction stays one-way at
     * the seam: consumers still reach the Session via `sessions.sessionOf`,
     * while the Session holds its own dispatch point (host Agent.loopCtx
     * mirror).
     * @param actx - the agent's scoped context.
     */
    bindScope(actx: Context): void;
    /** Release the bound scope at prune time (a later rebind accompanies a freshly minted scope). */
    unbindScope(): void;
    /**
     * Send (queue/steer passed through 1:1); failures land in the snapshot's promptError.
     * @param content - core content blocks verbatim.
     * @param mode - queue appends after the current turn; steer interrupts it.
     * @returns the prompt result (also mirrored into promptError on failure).
     */
    prompt(content: ContentBlock[], mode: 'queue' | 'steer'): Promise<RpcResult<{
        accepted: true;
    }>>;
    /** Apply one operation to a still-pending queue occurrence. */
    updateQueue(itemId: MessageId, action: QueueAction): Promise<RpcResult<{
        accepted: true;
    }>>;
    /**
     * Stop the active turn while the Host preserves pending inbox work; failures
     * land in promptError (same error-strip display slot).
     * @returns the cancel result.
     */
    cancel(): Promise<RpcResult<{
        accepted: true;
    }>>;
    /**
     * Rename: contract session.rename 1:1. On success settle the 'title'
     * projection cell from the response's `{title, seq}` under the store's
     * higher-seq-wins rule (the push frame arriving later is a no-op replay),
     * so the list row and any useProjection('title') reader update without
     * waiting for the mux frame.
     * @param title - raw title text (the host normalizes acceptance).
     * @returns the rename result (normalized accepted title + title event seq).
     */
    rename(title: string): Promise<RpcResult<{
        title: string;
        seq: number;
    }>>;
    /**
     * Execute one slash-command line against this session's agent — pure
     * admission semantics (the host executor durably logs the lifecycle;
     * outcomes render as flow nodes, never as a response echo).
     * @param line - the full command line, leading slash included.
     * @returns the admission result, or the error branch on transport failure.
     */
    command(line: string): Promise<RpcResult<{
        matched: boolean;
    }>>;
    /** First open: pull the tail page (idempotent — in-flight/already-open returns the existing promise). */
    open(): Promise<void>;
    /** Page up: pull one earlier page with the window's first seq as beforeSeq and prepend (§D.2). */
    loadOlder(): Promise<void>;
    /** Reconnect rebuild (manager calls this on onConnected for instances that were opened):
     *  reset the window and rerun open; pending waits for the baseline replay. Invalidates any
     *  in-flight open first — its history request rode the dead connection and must not settle
     *  the fresh generation into 'error' (audit S4). */
    resync(): Promise<void>;
    /**
     * uSES subscription entry.
     * @param listener - change callback.
     * @returns the unsubscribe function.
     */
    subscribe(listener: () => void): () => void;
    /**
     * Cached conversation snapshot (rebuilt lazily when dirty with no listeners).
     * @returns the cached reference (stable until the next flush).
     */
    getSnapshot(): ConversationSnapshot;
    /**
     * Mux frame arrival (the dispatch switch).
     * @param rpcId - the frame envelope id (the respond backfill key for requested frames).
     * @param frame - the routed frame.
     */
    handleMuxEnvelope(rpcId: RpcId, frame: MuxFrame): void;
    /**
     * Running-bit relay from the host stream (list entry and snapshot stay consistent).
     * @param running - the new running state.
     */
    handleRunning(running: boolean): void;
    /**
     * Install or clear the catalog-discovered transport address. A changed
     * address rebuilds an already-open window through its new history route.
     * @param address - direct parent/child address, or undefined for ordinary transport.
     * @param parentAvailable - latest exact-parent availability hint.
     */
    configureSubagent(address: SubagentAddress | undefined, parentAvailable?: boolean): void;
    /**
     * Update only the parent availability hint from a catalog refresh.
     * @param available - whether the exact direct parent is live.
     */
    handleSubagentParentAvailable(available: boolean): void;
    /**
     * Blank-bit relay from the authoritative summary source (list baseline and
     * the session-added frame). Monotone: once any signal (local first send,
     * running flip, an earlier summary) cleared it, a stale true never
     * re-blanks.
     * @param blank - the summary's derived empty-log bit.
     */
    handleBlank(blank: boolean): void;
    /** host/session-removed relay: flag the snapshot (instance survives — resident-instance rule). */
    handleRemoved(): void;
    /**
     * host/agent-error relay: the only outlet for live failures with no turn position.
     * @param message - the stringified error.
     */
    handleAgentError(message: string): void;
    /** No-op because session instances remain resident. */
    dispose(): void;
    /** Requested-frame arrival: the wait enters the pending map under its own key. */
    private mint;
    /** Authoritative resolved-frame settlement: mark, then drop from the pending map. */
    private settle;
    /** @param generation - openGeneration at launch; every await re-checks it and a stale pass
     *  drops all writes (resync superseded this open — its outcome belongs to a dead connection). */
    private doOpen;
    /** Install the history window + stitch the liveBuffer (seq is the sole dedup key).
     *  Stitching MUST NOT route through acceptLiveEvent: openState is still 'loading' here
     *  (doOpen flips it after install), so recursing would push every buffered event straight
     *  back into liveBuffer where nothing ever drains it — a silent drop loop (audit S1).
     *  A carried projections block seeds the value store (higher seq wins, so a stale
     *  baseline cannot overwrite a newer push frame); the window events themselves are
     *  never folded — the host is the only computation site. */
    private installWindow;
    /** Seq-guarded append shared by stitching and the open-state live path. */
    private appendLive;
    /** Retire the first matching live steering occurrence when its durable message takes over. */
    private handoffPendingSteering;
    /** Land a live session/event (open/repair in flight -> buffer; overlapping seq -> drop;
     *  a seq gap -> buffer + tail-page repull instead of appending a hole (audit S3: a gap is an
     *  expected reconnect-window artifact, repaired by refetch). The window stays one contiguous
     *  raw range, which is what lets the transcript render every event between its ends and lets a
     *  compaction checkpoint find its own provenance. */
    private acceptLiveEvent;
    /** Resync-lite (audit S3): repull the tail page and stitch the liveBuffer through the shared
     *  installWindow path. No openState transition — the UI keeps the current window (no loading
     *  flash); events arriving meanwhile detour to liveBuffer via the stitching flag. */
    private repairGap;
    /** Per-event side effects (right column of the §A.9 dispatch table):
     *  chunk/retry projection and openCalls add-remove. */
    private applyEventSideEffects;
    /**
     * Settle the newest scheduled retry, optionally restricted to its failed turn.
     * @param retryState - next client projection state to publish.
     * @param turn - failed turn required for cancellation; omitted for the next retry turn start.
     */
    private settleScheduledRetry;
    /** Re-derive state (partial/openCalls/derivedNodes) from raw window events after a rebuild — keeps
     *  paging/stitching consistent, and makes live handling and history replay converge on the same
     *  retry notices and interrupted nodes. */
    private rebuildDerivedFromWindow;
    private windowTailSeq;
    private buildSnapshot;
    /** Select ordinary or addressed history transport from the stored browser fact. */
    private history;
}
//# sourceMappingURL=session.d.ts.map