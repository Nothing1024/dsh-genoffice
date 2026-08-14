/** True when the node has model-visible text content worth IconActions chrome. */
function hasContentText(blocks) {
    return blocks.some(block => block.kind === 'text' && block.text.trim() !== '');
}
/** An assistant node that renders nothing: only tool-call heads (rows render
 *  via the grouping pass) and blank text/reasoning. Skipped by the flow so it
 *  neither costs column gaps nor splits a tool-row run. Interrupted nodes
 *  always render (the 已停止 marker). */
function rendersNothing(node) {
    return node.kind === 'assistant' && node.interrupted !== true
        && node.blocks.every(b => b.kind === 'tool-call'
            || ((b.kind === 'text' || b.kind === 'reasoning') && b.text.trim() === ''));
}
/**
 * Seq set of assistants that own IconActions: the last content-text assistant
 * in each turn. Mid-turn narration (text before tools) stays chrome-free.
 * @param nodes - snapshot nodes (surface order).
 * @returns Seq values ChatView may pass as `time` into AssistantMarkdown.
 */
export function assistantActionsSeqs(nodes) {
    const lastByTurn = new Map();
    for (const node of nodes) {
        if (node.kind !== 'assistant' || !hasContentText(node.blocks))
            continue;
        lastByTurn.set(node.turn, node.seq);
    }
    return new Set(lastByTurn.values());
}
/**
 * Exact start time of the latest in-window turn without a matching end time.
 * @param turnTimings - In-window turn timings in event order.
 * @returns Unix epoch ms, or null when the running turn started outside the window.
 */
export function runningTurnStartTime(turnTimings) {
    let latest = null;
    for (const timing of turnTimings.values()) {
        if (timing.endTime === undefined)
            latest = timing.startTime;
    }
    return latest;
}
/**
 * Seq set of message rows that may fork: the last transcript node of a
 * completed turn, when that node owns message chrome. A later tool, reasoning,
 * error, or other transcript node leaves the earlier message's branch action
 * unavailable because the Host would include the whole turn.
 * @param nodes - snapshot nodes in event order.
 * @param turnEnds - completed turn boundaries retained from the event window.
 * @returns Message seq values whose visible position matches the fork boundary.
 */
export function messageBranchSeqs(nodes, turnEnds) {
    const result = new Set();
    const boundaries = [...turnEnds].sort((a, b) => a[1] - b[1]);
    let nodeIndex = 0;
    for (const [turn, endSeq] of boundaries) {
        let tail;
        while (nodeIndex < nodes.length) {
            const candidate = nodes[nodeIndex];
            if (candidate === undefined || candidate.seq > endSeq)
                break;
            tail = candidate;
            nodeIndex++;
        }
        if (tail?.kind === 'user' || tail?.kind === 'steering'
            || (tail?.kind === 'assistant' && tail.turn === turn && hasContentText(tail.blocks))) {
            result.add(tail.seq);
        }
    }
    return result;
}
/**
 * Group finalized nodes into the step-summary flow.
 * @param nodes - snapshot nodes in human-transcript and durable-notice order.
 * @returns flow items; consecutive tool results group and retry notices reuse their first key.
 */
export function deriveChatFlow(nodes) {
    const items = [];
    let group = null;
    for (const node of nodes) {
        if (rendersNothing(node))
            continue;
        if (node.kind === 'tool-result') {
            if (group === null) {
                group = [node];
                items.push({ kind: 'tool-group', key: `g${node.seq}`, results: group });
            }
            else {
                group.push(node);
            }
        }
        else if (node.kind === 'model-retry') {
            group = null;
            const previous = items[items.length - 1];
            if (previous?.kind === 'node'
                && previous.node.kind === 'model-retry') {
                items[items.length - 1] = { ...previous, node };
            }
            else {
                items.push({ kind: 'node', key: `n${node.seq}`, node });
            }
        }
        else {
            group = null;
            items.push({ kind: 'node', key: `n${node.seq}`, node });
        }
    }
    return items;
}
/**
 * Key projection for the list parent's selector (content-blind identity).
 * @param items - derived flow items.
 * @returns joined key string usable with Object.is short-circuiting.
 */
export function flowKeys(items) {
    return items.map(i => i.key).join('|');
}
//# sourceMappingURL=chat-flow.js.map