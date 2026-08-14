import type { Context } from 'cordis';
import type { HostFrame, IApiClient, MuxFrame, RpcRequest, SessionId } from '@deepseek-ai/dsh-client-connection/client';
import type { ISessionHistory, SessionHistoryFace } from '../contract/session-history.ts';
/** Root registry and frame router for independent inspection histories. */
export declare class SessionHistoryService implements ISessionHistory {
    private readonly api;
    private readonly sources;
    /**
     * @param ctx - Client root context.
     * @param api - Shared wire client.
     */
    constructor(ctx: Context, api: IApiClient);
    /**
     * Resolve one identity-stable history source.
     * @param sessionId - Host session identity.
     * @returns Source independent from SessionManager.
     */
    source(sessionId: SessionId): SessionHistoryFace;
    /**
     * Route history-relevant mux frames only to an existing source.
     * @param envelope - Validated mux envelope.
     */
    handleMuxEnvelope(envelope: RpcRequest<MuxFrame>): void;
    /**
     * Drop a removed session's independent history source.
     * @param envelope - Validated host envelope.
     */
    handleHostEnvelope(envelope: RpcRequest<HostFrame>): void;
    /** Invalidate requests from the dead connection generation. */
    handleDisconnected(): void;
    /** Rebuild every previously activated source from the new generation. */
    handleConnected(): void;
}
//# sourceMappingURL=service.d.ts.map