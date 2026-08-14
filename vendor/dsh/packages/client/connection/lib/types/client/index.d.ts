/**
 * Browser wire client. The plugin selects fixture or HTTP transport, provides
 * the shared API client, and lets the runtime object layer start the stream
 * controller with its sinks.
 */
import type { Context } from 'cordis';
import type { IApiClient } from './api.ts';
import { type ConnectionConfig, type ConnectionSinks, type ConnectionState } from './connection.ts';
export type { ApiProxy, SessionsApi, SessionSearchItem, SessionSummary, HostApi, EventsApi, MuxFrame, HostFrame, ApprovalResponsePayload, QuestionResponsePayload, HistoryEntry, ToolEventView, DirectoryEntry, DirectoryListing, ToolCallView, ToolResultView, WorkspaceApi, WorkspaceId, WorkspaceView, CommandsApi, CommandDescriptor, SkillsApi, SkillEntry, ModelCatalogFailure, ModelCatalogModel, ModelProviderGroup, ModelReasoning, MessageId, ModelReasoningEffort, ModelTarget, QueueAction, QueuedInboxItem, SessionModels, SubagentsApi, SubagentAddress, SubagentCatalog, SubagentListEntry, SubagentPromptReceipt, RpcRequest, RpcResponse, RpcResult, RpcError, RpcErrorCode, ClientRequest, ServerResponse, ServerRequest, ClientResponse, RpcMessage, RpcReceipt, IApiClient, SessionId, SessionEvent, ContentBlock, StreamChunk, GoalsApi, GoalRef, SettingsApi, SettingsNamespaceView, SettingsPathOpView, SettingsSecretView, CredentialsApi, CredentialView, ConfigurableProviderView, DiscoveredModelView, LlmApi, } from './api.ts';
export { RpcId, AbstractApiClient, transportError, } from './api.ts';
export type { ConnectionConfig, ConnectionSinks, ConnectionState };
/** Required services (none — this is the wire root). */
export declare const inject: string[];
/**
 * The ctx.connection service surface: the api client plus a one-shot
 * controller starter (the runtime plugin supplies sinks when its object layer
 * is ready — connection stays consumer-agnostic).
 */
export interface ConnectionHandle {
    /** Shared api client (fixture or real, decided at boot from the page URL). */
    readonly api: IApiClient;
    /** Whether the current page authority is loopback; non-browser contexts default to true. */
    readonly isLoopback: boolean;
    /**
     * Start the connect/pump/reconnect loop with the consumer's frame sinks.
     * One consumer owns the streams (the runtime object layer); a second call
     * throws.
     * @param sinks - frame/state callbacks.
     * @param config - reconnect/backoff tunables.
     * @returns stop handle for the loop.
     */
    start(sinks: ConnectionSinks, config?: ConnectionConfig): {
        stop(): void;
    };
}
/**
 * Client plugin body: pick the api by page mode and provide ctx.connection.
 * @param ctx - client cordis context.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map