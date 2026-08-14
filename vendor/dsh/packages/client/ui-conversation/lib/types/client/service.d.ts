/**
 * Scope-addressed conversation send, cancel, and history orchestration.
 *
 * Scope addressing rides the cordis Service tracker: property access through
 * `ctx.conversation` rebinds `this.ctx` to the caller's context, so methods
 * read the session tag with `scopeOf`. Mutable state must remain reachable
 * through one property read; assignment through the tracker proxy and `#`
 * private fields bypass that rebinding.
 */
import { Service } from 'cordis';
import type { Context } from 'cordis';
import type { QueueAction, QueueItemId } from './contract/queue.ts';
import type { InputService } from './input/contract.ts';
/**
 * The outward conversation face (`ctx.conversation`): the scope-addressed
 * verbs and the input registry other plugins may reach — and exactly what a
 * test fake must supply.
 */
export interface IConversation {
    /** The per-session input machine registry (InputService face). */
    readonly input: InputService;
    /**
     * Send a prompt into the caller scope's session (queued turn).
     * @param text - prompt text, sent verbatim as one text block.
     * @returns completion; business failures reject (and land in promptError).
     */
    send(text: string): Promise<void>;
    /**
     * Apply one edit, remove, or strict steer operation to a pending queue occurrence.
     * @param itemId - agent-owned inbox occurrence identity.
     * @param action - requested queue operation.
     * @returns completion; converged strict-steer races resolve, while other failures reject.
     */
    updateQueue(itemId: QueueItemId, action: QueueAction): Promise<void>;
    /**
     * Cancel the scoped session's in-flight turn while preserving its pending Queue.
     * @returns completion; failures reject as in send.
     */
    cancel(): Promise<void>;
    /**
     * Pull one older history page for the scoped session.
     * @returns completion of the page pull.
     */
    loadOlder(): Promise<void>;
}
/** Scope-addressed conversation service (root singleton, provided as `conversation`). */
export declare class ConversationService extends Service implements IConversation {
    /** The per-session input machine registry (InputService face, design §5.2). */
    readonly input: InputService;
    /**
     * @param ctx - owning root context (the plugin apply context; the service
     * registers itself and follows that fiber's lifetime).
     * @param config - carries the InputService instance constructed by the
     * plugin apply (the same InputHub the slot inject factories close over).
     */
    constructor(ctx: Context, config: {
        input: InputService;
    });
    /**
     * Send a prompt into the scoped session. Business failures also land in the
     * session snapshot's promptError (object-layer surface); the rejection here
     * exists for caller choreography (the composer restores the draft on it).
     * @param text - prompt text, sent verbatim as one text block.
     */
    send(text: string): Promise<void>;
    /** Apply one operation to a pending queue occurrence. */
    updateQueue(itemId: QueueItemId, action: QueueAction): Promise<void>;
    /** Cancel the scoped session's in-flight turn while preserving Queue (failures land in promptError and reject, as in send). */
    cancel(): Promise<void>;
    /** Pull one older history page for the scoped Session. */
    loadOlder(): Promise<void>;
    /** Resolve the caller scope's session face or throw on root contexts. */
    private scopedSession;
    /** Read the caller's session scope tag via the sessions service; root contexts fail loud. */
    private scopeId;
    private requireSessions;
}
//# sourceMappingURL=service.d.ts.map