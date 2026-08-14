import { EMPTY_CHAT_SNAPSHOT, EMPTY_CONVERSATION_VIEWS, } from '@deepseek-ai/dsh-client-runtime/client';
/**
 * A complete quiescent conversation snapshot (open window, no traffic).
 * @param sessionId - owning session id.
 * @returns the snapshot; spread fixture overrides on top.
 */
export function conversationSnapshot(sessionId) {
    return {
        sessionId,
        views: EMPTY_CONVERSATION_VIEWS,
        chat: EMPTY_CHAT_SNAPSHOT,
        nodes: [],
        turnTimings: new Map(),
        turnEnds: new Map(),
        partial: null,
        runningCalls: [],
        pending: [],
        queue: [],
        running: false,
        subagent: null,
        composerPhase: 'active',
        removed: false,
        openState: 'open',
        openError: null,
        hasMore: false,
        loadingOlder: false,
        promptError: null,
        blank: false,
        lastAgentError: null,
    };
}
/**
 * A ready workspace list with no workspaces (the shape WorkspaceRuntime
 * projects after both baselines land).
 * @returns the initial state of the test workspaces store.
 */
export function workspaceListState() {
    return {
        items: [],
        archivedSessionIds: [],
        state: 'idle',
        phase: 'ready',
        error: null,
        baselinesReady: true,
        recentWorkspaceId: undefined,
    };
}
//# sourceMappingURL=fixtures.js.map