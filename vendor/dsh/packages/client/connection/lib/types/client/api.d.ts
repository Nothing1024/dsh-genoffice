export type { ApiProxy, SessionsApi, SessionSearchItem, SessionSummary, HostApi, EventsApi, MuxFrame, HostFrame, ApprovalResponsePayload, QuestionResponsePayload, HistoryEntry, ToolEventView, DirectoryEntry, DirectoryListing, WorkspaceApi, WorkspaceId, WorkspaceView, CommandsApi, CommandDescriptor, SkillsApi, SkillEntry, ModelCatalogFailure, ModelCatalogModel, ModelProviderGroup, ModelReasoning, ModelReasoningEffort, ModelTarget, QueueAction, QueuedInboxItem, SessionModels, GoalsApi, GoalRef, SettingsApi, SettingsNamespaceView, SettingsPathOpView, SettingsSecretView, CredentialsApi, CredentialView, ConfigurableProviderView, DiscoveredModelView, LlmApi, SubagentsApi, SubagentAddress, SubagentCatalog, SubagentListEntry, SubagentPromptReceipt, } from '@deepseek-ai/dsh-host-apiproxy/api';
export type { ToolCallView, ToolResultView } from '@deepseek-ai/dsh-tools/presentation';
export type { RpcRequest, RpcResponse, RpcResult, RpcError, RpcErrorCode, ClientRequest, ServerResponse, ServerRequest, ClientResponse, RpcMessage, RpcReceipt, } from '@deepseek-ai/dsh-host-apiproxy/api';
export { RpcId, SESSION_SEARCH_RESULT_LIMIT, transportError, } from '@deepseek-ai/dsh-host-apiproxy/api';
export { AbstractApiClient } from '@deepseek-ai/dsh-host-apiproxy/client';
export type { IApiClient } from '@deepseek-ai/dsh-host-apiproxy/client';
export type { SessionId, SessionEvent } from '@deepseek-ai/dsh-session/types';
export type { MessageId } from '@deepseek-ai/dsh-llm/brand';
export type { ContentBlock, StreamChunk } from '@deepseek-ai/dsh-llm/types';
import type { RpcResponse, RpcResult } from '@deepseek-ai/dsh-host-apiproxy/api';
/**
 * Unwrap a unary response: RpcResponse<T> -> RpcResult<T> (business code only
 * cares about the result slot).
 * @param response - the unary response.
 * @returns its result slot.
 */
export declare function resultOf<T>(response: RpcResponse<T>): RpcResult<T>;
//# sourceMappingURL=api.d.ts.map