/**
 * Durable session-persistence seam (`ctx.sessionPersistence`). Backends store
 * {@link SessionEvent}s as the event-sourced log and carry non-replayable
 * {@link SessionHeader} metadata separately.
 * @module @deepseek-ai/dsh-session-persistence
 */
import { Service } from 'cordis';
import { SessionPreparation } from '@deepseek-ai/dsh-session';
export { SessionPersistenceRevision } from "./revision.js";
// The backend-agnostic write-path orchestration first-party backends compose.
export { DEFAULT_PREPARED_SESSION_CACHE_SIZE, PersistenceCoordinator, SessionPersistenceCorruptionError, } from "./coordinator.js";
/**
 * Durable append-only session storage. Implementations preserve contiguous,
 * losslessly JSON-serializable events; {@link append} resolves only after
 * durability, and {@link load} balances a complete interrupted tail without
 * rewriting committed events.
 */
export class SessionPersistence extends Service {
    constructor(ctx) {
        super(ctx, 'sessionPersistence');
    }
    /**
     * Prepare the exact unpublished Session used by resume. Implementations may
     * reuse object graphs retained by an earlier {@link inspect} after confirming
     * their durable revision is still current; disposal releases an unpublished
     * reservation. Revision retries require the durable log to remain unchanged
     * for one read/check round trip; continuous external writers may delay completion.
     * @param id - persisted session to prepare.
     * @param signal - optional cancellation for preparation work.
     * @returns one owned unpublished Session preparation.
     */
    async prepare(id, signal) {
        signal?.throwIfAborted();
        const loaded = await this.load(id);
        signal?.throwIfAborted();
        const sessions = this.ctx.get('sessions');
        if (sessions === undefined) {
            throw new Error('cannot prepare a session: SessionStore is not configured');
        }
        return SessionPreparation.create(sessions.prepare(id, {
            seed: loaded.events.map(event => structuredClone(event)),
            meta: structuredClone(loaded.meta),
            seedSource: 'persistence',
        }));
    }
}
export default SessionPersistence;
//# sourceMappingURL=index.js.map