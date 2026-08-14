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
/** Scope-addressed conversation service (root singleton, provided as `conversation`). */
export class ConversationService extends Service {
    /** The per-session input machine registry (InputService face, design §5.2). */
    input;
    /**
     * @param ctx - owning root context (the plugin apply context; the service
     * registers itself and follows that fiber's lifetime).
     * @param config - carries the InputService instance constructed by the
     * plugin apply (the same InputHub the slot inject factories close over).
     */
    constructor(ctx, config) {
        super(ctx, 'conversation');
        this.input = config.input;
    }
    /**
     * Send a prompt into the scoped session. Business failures also land in the
     * session snapshot's promptError (object-layer surface); the rejection here
     * exists for caller choreography (the composer restores the draft on it).
     * @param text - prompt text, sent verbatim as one text block.
     */
    async send(text) {
        const session = this.scopedSession('send');
        const result = await session.prompt([{ type: 'text', text }], 'queue');
        if (!result.ok)
            throw new Error(`conversation.send failed: ${result.error.code}: ${result.error.message}`);
    }
    /** Apply one operation to a pending queue occurrence. */
    async updateQueue(itemId, action) {
        const session = this.scopedSession('updateQueue');
        const result = await session.updateQueue(itemId, action);
        if (!result.ok) {
            if (action.kind === 'steer'
                && (result.error.code === 'steer-unavailable' || result.error.code === 'queue-item-not-found'))
                return;
            throw new Error(`conversation.updateQueue failed: ${result.error.code}: ${result.error.message}`);
        }
    }
    /** Cancel the scoped session's in-flight turn while preserving Queue (failures land in promptError and reject, as in send). */
    async cancel() {
        const session = this.scopedSession('cancel');
        const result = await session.cancel();
        if (!result.ok)
            throw new Error(`conversation.cancel failed: ${result.error.code}: ${result.error.message}`);
    }
    /** Pull one older history page for the scoped Session. */
    async loadOlder() {
        await this.scopedSession('loadOlder').loadOlder();
    }
    /** Resolve the caller scope's session face or throw on root contexts. */
    scopedSession(op) {
        const id = this.scopeId(op);
        const binding = this.requireSessions().binding(id);
        if (binding === undefined)
            throw new Error(`conversation.${op}: session "${id}" resolved no binding`);
        return binding.session;
    }
    /** Read the caller's session scope tag via the sessions service; root contexts fail loud. */
    scopeId(op) {
        const id = this.requireSessions().scopeOf(this.ctx);
        if (id === undefined) {
            throw new Error(`conversation.${op} requires a session scope — address one via ctx.sessions.scope(id).conversation`);
        }
        return id;
    }
    requireSessions() {
        // Strict ctx.get, not the injection proxy: the scope-addressed pattern
        // reads the service off whatever context the tracker rebound.
        const sessions = this.ctx.get('sessions');
        if (sessions === undefined)
            throw new Error('conversation: sessions service unavailable');
        return sessions;
    }
}
//# sourceMappingURL=service.js.map