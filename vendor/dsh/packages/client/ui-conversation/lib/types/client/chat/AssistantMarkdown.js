import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// AssistantMarkdown: renders assistant blocks in order — markdown text body,
// reasoning as the figma Think summary row (expand = indented gray text),
// other-block JSON fallback. Tool-call heads are NOT rendered here: the chat
// view groups them into tool rows through its keyed toolview slot (figma
// step-summary flow). Shared by finalized nodes and the streaming partial;
// the turn-level loading dots live in the chat view's tail, not here.
// Finalized content (text) nodes append IconActions once streaming ends
// (`time` is omitted for mid-turn narration); their branch action is enabled
// only when the node is also the completed turn's transcript tail. Think /
// tool-head-only nodes stay chrome-free.
import { memo, useMemo } from 'react';
import { IconThinkOutline14, JsonBlock, MarkdownText, } from '@deepseek-ai/dsh-client-ui-primitives';
import { MessageIconActions } from "./MessageIconActions.js";
import { ToolRow } from "./ToolRow.js";
import css from './AssistantMarkdown.module.css';
function firstLine(text) {
    const nl = text.indexOf('\n');
    return nl !== -1 ? text.slice(0, nl) : text;
}
/** Latest non-blank reasoning line while the block is still streaming. */
function latestLine(text) {
    const visible = text.trimEnd();
    const nl = visible.lastIndexOf('\n');
    return nl === -1 ? visible : visible.slice(nl + 1);
}
/** Joined text blocks for the copy action (reasoning / tool heads stay out). */
function copyText(blocks) {
    const parts = [];
    for (const block of blocks) {
        if (block.kind === 'text')
            parts.push(block.text);
    }
    return parts.join('');
}
/** True when the node has model-visible text content worth chrome under. */
function hasContentText(blocks) {
    return blocks.some(block => block.kind === 'text' && block.text.trim() !== '');
}
/** Reasoning block as the Think variant summary row (figma 39:28304). */
function ThinkRow({ text, running, t }) {
    return (_jsx(ToolRow, { t: t, variant: "think", icon: _jsx(IconThinkOutline14, { size: 14 }), title: "Think", summary: running ? latestLine(text) : firstLine(text), body: text, state: running ? 'running' : 'ok' }));
}
export const AssistantMarkdown = memo(function AssistantMarkdown({ blocks, streaming, interrupted, time, runMs, ttftMs, tokensPerSecond, seq, onFork, forkUnavailable, t, }) {
    // Stable per locale revision (t identity changes on switch): a fresh object
    // per render would rebuild MarkdownText's component table every chunk.
    const codeLabels = useMemo(() => ({ copyLabel: t('copy'), copiedLabel: t('copied') }), [t]);
    const last = blocks.length - 1;
    // Tool-call heads render as tool rows in the chat view's grouping pass, so
    // a node that is only those heads (or empty) would paint an empty root
    // between tool groups — skip the shell unless something visible remains.
    const hasVisible = streaming
        || interrupted === true
        || blocks.some(block => block.kind !== 'tool-call');
    if (!hasVisible)
        return null;
    // Footer only under settled content text; Think-only / streaming omit it.
    const showActions = !streaming && time !== undefined && hasContentText(blocks);
    return (_jsxs("div", { className: css.root, "data-streaming": streaming || undefined, "data-time-hover-root": true, children: [_jsxs("div", { className: css.body, children: [blocks.map((block, i) => {
                        switch (block.kind) {
                            case 'text': return (_jsx(MarkdownText, { text: block.text, streaming: streaming, codeLabels: codeLabels }, i));
                            case 'reasoning': return _jsx(ThinkRow, { text: block.text, running: streaming && i === last, t: t }, i);
                            // Grouped into tool rows by ChatView; hasVisible above skips an empty shell.
                            case 'tool-call': return null;
                            default: return (_jsx(JsonBlock, { label: t('message.unknownBlock'), payload: block.block, truncatedLabel: total => t('json.truncated', { total }) }, i));
                        }
                    }), interrupted && _jsx("span", { className: css.stopped, children: t('message.stopped') })] }), showActions && (_jsx(MessageIconActions, { text: copyText(blocks), time: time, runMs: runMs, ttftMs: ttftMs, tokensPerSecond: tokensPerSecond, clock: "end", onBranch: onFork === undefined || seq === undefined ? undefined : () => { onFork(seq); }, branchUnavailable: forkUnavailable, className: css.actions, t: t }))] }));
});
//# sourceMappingURL=AssistantMarkdown.js.map