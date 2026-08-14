/**
 * Chat flow derivation: ConversationSnapshot nodes -> render items. Tool
 * results group into consecutive-run tool groups (figma step-summary flow,
 * VERTICAL gap10) alternating with narration. Consecutive retry notices
 * reuse the first notice's row while projecting the latest retry turn.
 * Item identity keys are stable across snapshots so the list parent can
 * subscribe to keys only while rows subscribe to content. IconActions ownership
 * and completed-turn branch points are derived here too so ChatView and the
 * flow share their gates.
 */
import type { ConversationNode, ConversationSnapshot, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client';
/** One renderable flow item; key is the React key and the parent's identity unit. */
export type ChatFlowItem = {
    kind: 'node';
    key: string;
    node: ConversationNode;
} | {
    kind: 'tool-group';
    key: string;
    results: readonly ToolResultNode[];
};
/**
 * Seq set of assistants that own IconActions: the last content-text assistant
 * in each turn. Mid-turn narration (text before tools) stays chrome-free.
 * @param nodes - snapshot nodes (surface order).
 * @returns Seq values ChatView may pass as `time` into AssistantMarkdown.
 */
export declare function assistantActionsSeqs(nodes: readonly ConversationNode[]): ReadonlySet<number>;
/**
 * Exact start time of the latest in-window turn without a matching end time.
 * @param turnTimings - In-window turn timings in event order.
 * @returns Unix epoch ms, or null when the running turn started outside the window.
 */
export declare function runningTurnStartTime(turnTimings: ConversationSnapshot['turnTimings']): number | null;
/**
 * Seq set of message rows that may fork: the last transcript node of a
 * completed turn, when that node owns message chrome. A later tool, reasoning,
 * error, or other transcript node leaves the earlier message's branch action
 * unavailable because the Host would include the whole turn.
 * @param nodes - snapshot nodes in event order.
 * @param turnEnds - completed turn boundaries retained from the event window.
 * @returns Message seq values whose visible position matches the fork boundary.
 */
export declare function messageBranchSeqs(nodes: readonly ConversationNode[], turnEnds: ReadonlyMap<number, number>): ReadonlySet<number>;
/**
 * Group finalized nodes into the step-summary flow.
 * @param nodes - snapshot nodes in human-transcript and durable-notice order.
 * @returns flow items; consecutive tool results group and retry notices reuse their first key.
 */
export declare function deriveChatFlow(nodes: readonly ConversationNode[]): ChatFlowItem[];
/**
 * Key projection for the list parent's selector (content-blind identity).
 * @param items - derived flow items.
 * @returns joined key string usable with Object.is short-circuiting.
 */
export declare function flowKeys(items: readonly ChatFlowItem[]): string;
//# sourceMappingURL=chat-flow.d.ts.map