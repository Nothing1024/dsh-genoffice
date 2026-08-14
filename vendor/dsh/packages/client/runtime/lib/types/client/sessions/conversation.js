// ConversationSnapshot / ConversationNode: the only data shape the logic layer feeds the UI.
// Immutability contract: every change swaps the top-level object; unchanged
// substructures keep their references (the React.memo premise). callId/approvalId stay plain
// string here (narrow to real brands when convenient).
/**
 * core ContentBlock[] -> AssistantBlock[] (classifier shared by finalized messages and partial block-end).
 * @param content - core content blocks verbatim.
 * @returns UI-classified blocks in source order.
 */
export function toAssistantBlocks(content) {
    return content.map(toAssistantBlock);
}
/**
 * Classify one block (ToolCallBlock fields are id/arguments, mapped to callId/argsRaw).
 * @param block - one core content block.
 * @returns the UI classification.
 */
export function toAssistantBlock(block) {
    switch (block.type) {
        case 'text': return { kind: 'text', text: block.text };
        case 'reasoning': return { kind: 'reasoning', text: block.text };
        case 'tool-call': return { kind: 'tool-call', callId: String(block.id), name: block.name, argsRaw: block.arguments };
        default: return { kind: 'other', block };
    }
}
//# sourceMappingURL=conversation.js.map