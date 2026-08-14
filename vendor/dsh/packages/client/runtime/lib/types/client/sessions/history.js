import { projectConversationHistory } from "../session-history/history-fold.js";
import { inspectRequests } from "./request-inspection.js";
function assistantStepKey(turn, step) {
    return `${turn}\u0000${step}`;
}
function isFirstTokenCandidate(entry) {
    const event = entry.event;
    if (event.type !== 'assistant/chunk')
        return false;
    switch (event.data.chunk.type) {
        case 'text-delta':
        case 'reasoning-delta':
            return event.data.chunk.text !== '';
        case 'tool-call-delta':
            return event.data.chunk.argumentsDelta !== '' || event.data.chunk.name !== undefined;
        default:
            return false;
    }
}
/**
 * Remove completed-step token payloads that no inspection projection reads.
 * The first visible token preserves timing, usage chunks preserve accounting,
 * and unfinished steps retain every chunk for live or interrupted content.
 * @param entries - Contiguous raw history entries in sequence order.
 * @returns A projection-equivalent, usually much smaller entry ledger.
 */
export function compactHistoryInspectionEntries(entries) {
    const completedSteps = new Set();
    for (const { event } of entries) {
        if (event.type === 'assistant/message') {
            completedSteps.add(assistantStepKey(event.data.turn, event.data.step));
        }
    }
    const firstTokenSteps = new Set();
    const compacted = [];
    let changed = false;
    for (const entry of entries) {
        const event = entry.event;
        if (event.type !== 'assistant/chunk') {
            compacted.push(entry);
            continue;
        }
        const key = assistantStepKey(event.data.turn, event.data.step);
        if (!completedSteps.has(key) || event.data.chunk.type === 'usage') {
            compacted.push(entry);
            continue;
        }
        if (isFirstTokenCandidate(entry) && !firstTokenSteps.has(key)) {
            firstTokenSteps.add(key);
            compacted.push(entry);
        }
        else {
            changed = true;
        }
    }
    return changed ? compacted : entries;
}
/**
 * Create a lazy inspection projection over an immutable history window.
 * Conversation consumers retain the cheap wrapper; only Trajectory snapshots
 * the entries and replays event order and request lifecycle state.
 * @param loadEntries - Lazily snapshots contiguous raw entries in sequence order.
 * @returns Lazy, memoized inspection fields for that exact window.
 */
export function createHistoryInspection(loadEntries) {
    let entries;
    let conversation;
    let requests;
    const historyEntries = () => entries ??= loadEntries();
    const conversationProjection = () => conversation ??= projectConversationHistory(historyEntries());
    const requestProjection = () => requests ??= inspectRequests(historyEntries());
    return {
        get eventNodes() {
            return conversationProjection().eventNodes;
        },
        get contexts() {
            return conversationProjection().contexts;
        },
        get interruptedNodes() {
            return conversationProjection().interruptedNodes;
        },
        get partial() {
            return conversationProjection().partial;
        },
        get runningCalls() {
            return conversationProjection().runningCalls;
        },
        get codeDispatches() {
            return conversationProjection().codeDispatches;
        },
        get requests() {
            return requestProjection().requests;
        },
        get callSchemas() {
            return requestProjection().callSchemas;
        },
    };
}
//# sourceMappingURL=history.js.map