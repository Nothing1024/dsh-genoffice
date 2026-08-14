/**
 * skills domain contract: read-only skill catalog lookup addressed by session.
 * The session's header cwd resolves to the canonical project root host-side —
 * the client never submits a raw path, and skill lookup never creates or
 * resumes an Agent.
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { RpcRequest, RpcResponse } from './rpc.ts';
/** Skill catalog row (wire projection of the host SkillSummary; provider/source vocabulary stays host-side). */
export interface SkillEntry {
    /** Kebab-case identifier referenced as `<skill>name</skill>` in prompts. */
    readonly name: string;
    /** Short routing description. */
    readonly description: string;
    /** Optional extra routing guidance. */
    readonly whenToUse?: string;
}
/** Skill-domain unary methods (the map key skill.* of RpcMethodMap). */
export interface SkillsApi {
    /** Lists skills usable by the browser's user-selected model-reference path. */
    list(request: RpcRequest<{
        sessionId: SessionId;
    }>): Promise<RpcResponse<{
        skills: readonly SkillEntry[];
    }>>;
}
//# sourceMappingURL=skills.d.ts.map