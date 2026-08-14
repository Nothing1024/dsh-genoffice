import type { HistoryEntry } from '@deepseek-ai/dsh-client-connection/client';
import type { CodeSubCall, ConversationNode, PartialAssistant, RunningToolCall } from '../sessions/conversation.ts';
import type { ConversationContext } from '../sessions/conversation-context.ts';
/** Immutable conversation projections derived only from the history source. */
export interface ConversationHistoryProjection {
    eventNodes: readonly ConversationNode[];
    contexts: readonly ConversationContext[];
    interruptedNodes: readonly ConversationNode[];
    partial: PartialAssistant | null;
    runningCalls: readonly RunningToolCall[];
    codeDispatches: ReadonlyMap<string, readonly CodeSubCall[]>;
}
/**
 * Project one immutable history ledger without reading or mutating Chat state.
 * @param entries - Contiguous history entries in sequence order.
 * @returns Event order, context lineage, and transient tail state.
 */
export declare function projectConversationHistory(entries: readonly HistoryEntry[]): ConversationHistoryProjection;
//# sourceMappingURL=history-fold.d.ts.map