import type { SessionEvent } from '@deepseek-ai/dsh-session/types';
import type { ToolEventView } from '@deepseek-ai/dsh-client-connection/client';
import type { ConversationNode } from './conversation.ts';
/** Log-ordered human transcript over a paged raw event window (never consults surface order). */
export declare class TranscriptAdapter {
    /** Window events by seq: provenance lookup for a checkpoint's summary. */
    private eventIndex;
    /** Transcript nodes in log order; copy-on-write so a published array never mutates. */
    private projected;
    private callIdx;
    /** Per-step timing boundaries (step/start + first token delta), consumed when the step's assistant/message materializes. */
    private stepTimings;
    /** Wire result views keyed by the tool/result event's seq (views ride the envelope, not the event). */
    private resultViews;
    /** Durable inbox replay used to distinguish next-step human input from queued prompts. */
    private readonly steeringHistory;
    /**
     * Command lifecycle nodes by commandId (insertion = run order). The
     * `command/run`/`command/done` pair is log-only, so it is not a surface
     * event and never joins the transcript projection; this index folds the pair
     * (done settles its run's node in place) and nodes() merges the products in
     * by seq. Window cuts soft-fall like tool pairs: a done with no in-window
     * run still builds a node.
     */
    private commandIdx;
    /** Projection revision, bumped only when a transcript node or a command node actually
     *  changed, keying the nodes() result cache: an unchanged projection returns the previous
     *  ARRAY reference, not just cached elements — the snapshot's reference-stability contract
     *  (§A.9.4) starts here, and a chunk storm bumps nothing at all. */
    private rev;
    private nodesResult;
    /**
     * Window rebuild (after open/resync/page prepend): re-index the raw window
     * and re-project the transcript.
     * @param events - the new window contents (seq-ascending).
     * @param views - per-event wire views aligned with `events` by index (undefined slots for view-less events).
     */
    reset(events: readonly SessionEvent[], views?: readonly (ToolEventView | undefined)[]): void;
    /**
     * Tail append (live session/event): index the event and, when it belongs to
     * the transcript, extend the projection by one copy-on-write node so a
     * published array never mutates. An event that changes no node (a chunk
     * storm) bumps no revision, so nodes() keeps returning the same array
     * reference.
     * @param event - the live event (seq = window tail + 1).
     * @param view - host-computed tool view paired with the event when it is a tool call/result; indexed for card rendering.
     */
    append(event: SessionEvent, view?: ToolEventView): void;
    /**
     * The current transcript node array. Same revision -> same array reference
     * (memo boundary); node objects are materialized once, so an unchanged node
     * keeps its identity across appends.
     * @returns transcript nodes in log order, command nodes merged in by seq.
     */
    nodes(): readonly ConversationNode[];
    /** Materialize one transcript event against the complete current indexes. */
    private materialize;
    /**
     * Fold one command lifecycle event into its node (run mints, done settles in
     * place; done-only soft-falls).
     * @returns whether the command index changed, so callers can bump the revision.
     */
    private indexCommand;
    private indexCall;
}
//# sourceMappingURL=transcript-adapter.d.ts.map