import type { IApiClient, MuxFrame, SessionId } from '@deepseek-ai/dsh-client-connection/client';
import type { SessionHistoryFace, SessionHistorySnapshot } from '../contract/session-history.ts';
/** Independent raw-history owner used only by inspection consumers. */
export declare class SessionHistorySource implements SessionHistoryFace {
    readonly sessionId: SessionId;
    private readonly api;
    private entries;
    private inspectionEntries;
    private baseSeq;
    private hasMore;
    private state;
    private error;
    private generation;
    private persistentConsumer;
    private readonly consumerSignals;
    private openPromise;
    private olderPromise;
    private stitching;
    private liveBuffer;
    private subscribedLastSeq;
    private inspectionCache;
    private streamPublishToken;
    private streamPartial;
    private snapshotCache;
    private readonly notifier;
    /**
     * @param sessionId - Host session identity.
     * @param api - Shared wire client.
     */
    constructor(sessionId: SessionId, api: IApiClient);
    /**
     * Subscribe to ledger changes.
     * @param listener - Change callback.
     * @returns Unsubscribe function.
     */
    subscribe(listener: () => void): () => void;
    /**
     * Read the cached ledger snapshot.
     * @returns Stable snapshot until the source changes.
     */
    getSnapshot(): SessionHistorySnapshot;
    /**
     * Load the current tail without reading older pages.
     * @param signal - Consumer lifetime.
     * @returns When the tail is ready or loading fails.
     */
    loadTail(signal?: AbortSignal): Promise<void>;
    /**
     * Prepend one older page when the current window has a predecessor.
     * @param signal - Consumer lifetime.
     * @returns Whether the loaded window advanced.
     */
    loadOlder(signal?: AbortSignal): Promise<boolean>;
    /**
     * Route a relevant mux frame without involving the Chat session.
     * @param frame - Session-addressed frame.
     */
    handleMuxFrame(frame: MuxFrame): void;
    /** Invalidate dead-generation requests while retaining the last readable snapshot. */
    handleDisconnected(): void;
    /** Rebuild an activated ledger from the new connection generation. */
    resync(): void;
    /** Stop future refresh work after the host removes the session. */
    dispose(): void;
    private open;
    private trackConsumer;
    private hasConsumer;
    private doOpen;
    private loadOlderPage;
    private installTail;
    private acceptLive;
    private appendLive;
    /** Append a chunk against the cached finalized projection; false means no visible publish. */
    private appendIncrementalChunk;
    /** Coalesce token-stream projection and rendering work to one publish per browser frame. */
    private publishStreamDirty;
    /** Publish structural changes immediately and invalidate an older scheduled stream publish. */
    private publishDirtyNow;
    private repairGap;
    private tailSeq;
    private buildSnapshot;
    /** Inspection pinned to the source's current immutable entry array. */
    private currentInspection;
}
//# sourceMappingURL=source.d.ts.map