import type { ToolSchema } from '@deepseek-ai/dsh-llm/types';
import type { HistoryEntry } from '@deepseek-ai/dsh-client-connection/client';
import type { CodeSubCall, ConversationNode, PartialAssistant, RunningToolCall } from './conversation.ts';
import type { ConversationContext } from './conversation-context.ts';
import { type RequestView } from './request-inspection.ts';
/** Lazily derived inspection data for one immutable session-history window. */
export interface SessionHistoryInspection {
    eventNodes: readonly ConversationNode[];
    contexts: readonly ConversationContext[];
    requests: readonly RequestView[];
    callSchemas: ReadonlyMap<string, ToolSchema>;
    interruptedNodes: readonly ConversationNode[];
    partial: PartialAssistant | null;
    runningCalls: readonly RunningToolCall[];
    codeDispatches: ReadonlyMap<string, readonly CodeSubCall[]>;
}
/**
 * Remove completed-step token payloads that no inspection projection reads.
 * The first visible token preserves timing, usage chunks preserve accounting,
 * and unfinished steps retain every chunk for live or interrupted content.
 * @param entries - Contiguous raw history entries in sequence order.
 * @returns A projection-equivalent, usually much smaller entry ledger.
 */
export declare function compactHistoryInspectionEntries(entries: readonly HistoryEntry[]): readonly HistoryEntry[];
/**
 * Create a lazy inspection projection over an immutable history window.
 * Conversation consumers retain the cheap wrapper; only Trajectory snapshots
 * the entries and replays event order and request lifecycle state.
 * @param loadEntries - Lazily snapshots contiguous raw entries in sequence order.
 * @returns Lazy, memoized inspection fields for that exact window.
 */
export declare function createHistoryInspection(loadEntries: () => readonly HistoryEntry[]): SessionHistoryInspection;
//# sourceMappingURL=history.d.ts.map