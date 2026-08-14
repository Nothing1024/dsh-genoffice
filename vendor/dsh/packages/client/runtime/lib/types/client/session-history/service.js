import { SessionHistorySource } from "./source.js";
/** Root registry and frame router for independent inspection histories. */
export class SessionHistoryService {
    api;
    sources = new Map();
    /**
     * @param ctx - Client root context.
     * @param api - Shared wire client.
     */
    constructor(ctx, api) {
        this.api = api;
        ctx.reflect.provide('sessionHistory', this, undefined);
    }
    /**
     * Resolve one identity-stable history source.
     * @param sessionId - Host session identity.
     * @returns Source independent from SessionManager.
     */
    source(sessionId) {
        let source = this.sources.get(sessionId);
        if (source === undefined) {
            source = new SessionHistorySource(sessionId, this.api);
            this.sources.set(sessionId, source);
        }
        return source;
    }
    /**
     * Route history-relevant mux frames only to an existing source.
     * @param envelope - Validated mux envelope.
     */
    handleMuxEnvelope(envelope) {
        const frame = envelope.payload;
        if (frame.type === 'stream/error')
            return;
        this.sources.get(frame.sessionId)?.handleMuxFrame(frame);
    }
    /**
     * Drop a removed session's independent history source.
     * @param envelope - Validated host envelope.
     */
    handleHostEnvelope(envelope) {
        const frame = envelope.payload;
        if (frame.type !== 'host/session-removed') {
            return;
        }
        this.sources.get(frame.sessionId)?.dispose();
        this.sources.delete(frame.sessionId);
    }
    /** Invalidate requests from the dead connection generation. */
    handleDisconnected() {
        for (const source of this.sources.values())
            source.handleDisconnected();
    }
    /** Rebuild every previously activated source from the new generation. */
    handleConnected() {
        for (const source of this.sources.values())
            source.resync();
    }
}
//# sourceMappingURL=service.js.map