/** Session/workspace fixture shapes and snapshot defaults for the test runtime. */
import type { ConversationSnapshot, ISession, SessionId, SessionSummary, WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client';
/**
 * Fixture overrides for the session behavior face: any subset of the
 * production ISession verbs (typed against it, so a face change surfaces
 * here at compile time), plus extra members feature-specific casts consume.
 * The open Record tail means a misnamed EXTRA member is not caught by the
 * compiler (it grafts as dead weight); the ISession verbs stay safe — a
 * misnamed verb leaves the fail-loud stub in place, which names itself at
 * the first call.
 */
export type SessionBehaviorOverrides = Partial<ISession> & Record<string, unknown>;
/**
 * act-wrapped mutation runner shared by every runtime object: public mutators
 * funnel through it so tests never handle SlotCore microtask batching or
 * React act themselves.
 */
export type Stabilizer = (fn: () => void | Promise<void>) => Promise<void>;
/**
 * Session fixture accepted by {@link TestSessions.add}: identity plus optional
 * snapshot/list-row overrides and the session behavior face the feature under
 * test actually calls (kept open — the runtime never fakes methods a test did
 * not supply, so an unstubbed call fails loud at the call site).
 */
export interface SessionFixture {
    id: string;
    /** Overrides merged over {@link conversationSnapshot} (sessionId comes from `id`). */
    snapshot?: Partial<Omit<ConversationSnapshot, 'sessionId'>>;
    /** List-row overrides merged over the defaults derived from `id`. */
    summary?: Partial<Omit<SessionSummary, 'id'>>;
    /** Session behavior face: exactly the methods the feature under test calls (ISession subset + extras). */
    session?: SessionBehaviorOverrides;
}
/**
 * A complete quiescent conversation snapshot (open window, no traffic).
 * @param sessionId - owning session id.
 * @returns the snapshot; spread fixture overrides on top.
 */
export declare function conversationSnapshot(sessionId: SessionId): ConversationSnapshot;
/**
 * A ready workspace list with no workspaces (the shape WorkspaceRuntime
 * projects after both baselines land).
 * @returns the initial state of the test workspaces store.
 */
export declare function workspaceListState(): WorkspaceListState;
//# sourceMappingURL=fixtures.d.ts.map