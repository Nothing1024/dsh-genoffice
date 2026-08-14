import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// MessageItem: simple chat nodes — user and consumed-steering bubbles
// (right-aligned, with clock + copy / branch IconActions; steering adds the
// interjection caption that names it), pending steering (caption + copy only),
// context injection, compaction marker, retry disclosure, and unknown-surface
// JSON rows.
import { memo, useEffect, useMemo, useState } from 'react';
import { JsonBlock, MessageText, StateDot } from '@deepseek-ai/dsh-client-ui-primitives';
import { CompactionItem } from "./CompactionItem.js";
import { ContextInjectionRow } from "./ContextInjectionRow.js";
import { MessageIconActions } from "./MessageIconActions.js";
import css from './MessageItem.module.css';
function contentText(content) {
    const texts = [];
    const rest = [];
    for (const block of content) {
        const b = block;
        if (b.type === 'text' && typeof b.text === 'string')
            texts.push(b.text);
        else
            rest.push(block);
    }
    return { text: texts.join(''), rest };
}
function retrySeconds(milliseconds) {
    return Math.max(1, Math.ceil(milliseconds / 1_000));
}
function ModelRetryItem({ node, active, t }) {
    // Anchor the host-scheduled delay to this browser's first render of the
    // retry node. Host event time and Date.now() may belong to different clocks.
    const deadline = useMemo(() => Date.now() + node.delayMs, [node.delayMs, node.seq]);
    const scheduledSeconds = retrySeconds(node.delayMs);
    const maximum = node.mode === 'normal' ? node.maxRetries : '∞';
    const [countdown, setCountdown] = useState(() => ({
        deadline,
        seconds: retrySeconds(deadline - Date.now()),
    }));
    const remainingSeconds = countdown.deadline === deadline
        ? countdown.seconds
        : retrySeconds(deadline - Date.now());
    useEffect(() => {
        if (!active)
            return;
        const updateCountdown = () => {
            const next = retrySeconds(deadline - Date.now());
            setCountdown(current => (current.deadline === deadline && current.seconds === next
                ? current
                : { deadline, seconds: next }));
            return next;
        };
        if (updateCountdown() === 1)
            return;
        const timer = window.setInterval(() => {
            if (updateCountdown() === 1)
                window.clearInterval(timer);
        }, 250);
        return () => { window.clearInterval(timer); };
    }, [active, deadline]);
    const label = active
        ? t('message.retry.active')
        : node.retryState === 'cancelled'
            ? t('message.retry.cancelled')
            : node.retryState === 'started'
                ? t('message.retry.started')
                : t('message.retry.scheduled');
    const seconds = active ? remainingSeconds : scheduledSeconds;
    return (_jsxs("details", { className: css.retryRow, "data-active": active || undefined, children: [_jsx("summary", { className: css.retrySummary, children: _jsx("span", { className: css.retryText, role: "status", children: t('message.retry.status', { label, retry: node.retry, maximum, seconds }) }) }), _jsxs("div", { className: css.retryDetails, children: [_jsxs("div", { children: [_jsx("span", { className: css.retryDetailLabel, children: t('message.retry.delay') }), Math.round(node.delayMs), "ms"] }), _jsxs("div", { children: [_jsx("span", { className: css.retryDetailLabel, children: t('message.retry.failure') }), node.failure.message] })] })] }));
}
/** Persistent, turn-positioned feedback for a terminal failure. */
function TurnErrorItem({ node, t }) {
    return (_jsxs("div", { className: css.turnErrorRow, role: "status", children: [_jsx(StateDot, { state: "error", className: css.turnErrorDot }), _jsxs("div", { className: css.turnErrorCopy, children: [_jsx("span", { className: css.turnErrorTitle, children: t('message.turnError') }), _jsx("span", { className: css.turnErrorMessage, children: node.message })] }), node.code !== undefined && _jsx("code", { className: css.turnErrorCode, children: node.code })] }));
}
/**
 * Display projection of reference forms in a user bubble (free geometry — no
 * textarea alignment constraint here); everything else stays plain text. The
 * logged model text remains the single truth; this is presentation only. Two
 * shapes decorate: legacy `<skill>name</skill>` spans (pre-decision-21
 * history) and plain-text `/name` / `@name` word-boundary tokens (decision
 * 21: the sent text IS the reference — the bubble uses the same plainest
 * token scan as the composer, minus the lexicon: sent tokens were validated
 * at compose time, so shape alone decorates).
 */
function projectUserText(text) {
    const re = /<skill>([^<]+)<\/skill>|(^|\s)([/@][\w-]+)(?=\s|$)/g;
    const parts = [];
    let cursor = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
        const legacy = m[1] !== undefined;
        const tokenStart = legacy ? m.index : m.index + (m[2]?.length ?? 0);
        const label = !legacy ? m[3] ?? '' : `/${m[1]}`;
        if (tokenStart > cursor)
            parts.push(_jsx(MessageText, { text: text.slice(cursor, tokenStart) }, cursor));
        parts.push(_jsx("span", { className: css.refChip, "data-ref-chip": label.startsWith('@') ? 'subagent' : 'skill', children: label }, tokenStart));
        cursor = legacy ? m.index + m[0].length : tokenStart + label.length;
    }
    if (parts.length === 0)
        return _jsx(MessageText, { text: text });
    if (cursor < text.length)
        parts.push(_jsx(MessageText, { text: text.slice(cursor) }, cursor));
    return _jsx(_Fragment, { children: parts });
}
/** Right-aligned bubble shared by user and steering rows. */
function UserStyleBubble({ content, actions, pending = false, steering = false, t, }) {
    const { text, rest } = contentText(content);
    const truncated = (total) => t('json.truncated', { total });
    return (_jsxs("div", { className: css.userRow, "data-pending-steering": pending || undefined, "data-time-hover-root": true, children: [steering && _jsx("span", { className: css.steeringMark, "data-steering-mark": true, children: t('message.steering') }), _jsxs("div", { className: css.bubble, children: [projectUserText(text), rest.map((block, i) => _jsx(JsonBlock, { label: t('message.extraBlock'), payload: block, truncatedLabel: truncated }, i))] }), actions?.(text)] }));
}
/**
 * Render one Host-authoritative pending steering item with the same visual
 * language as its eventual durable transcript node.
 * @param props - Pending message content and conversation translator.
 * @returns the pending steering bubble.
 */
export function PendingSteeringBubble({ content, t }) {
    return (_jsx(UserStyleBubble, { content: content, pending: true, steering: true, t: t, actions: text => (_jsx(MessageIconActions, { text: text, clock: "start", showBranch: false, className: css.actions, t: t })) }));
}
export const MessageItem = memo(function MessageItem({ node, retryActive = false, onFork, forkUnavailable = false, t, }) {
    const truncated = (total) => t('json.truncated', { total });
    switch (node.kind) {
        case 'user':
        case 'steering':
            return (_jsx(UserStyleBubble, { content: node.content, steering: node.kind === 'steering', t: t, actions: text => (_jsx(MessageIconActions, { text: text, time: node.time, clock: "start", onBranch: onFork === undefined ? undefined : () => { onFork(node.seq); }, branchUnavailable: forkUnavailable, className: css.actions, t: t })) }));
        case 'context':
            return (_jsx(ContextInjectionRow, { content: node.content, source: node.source, provenance: node.provenance, form: node.form, t: t }));
        case 'compaction':
            return _jsx(CompactionItem, { node: node, t: t });
        case 'model-retry':
            return _jsx(ModelRetryItem, { node: node, active: retryActive, t: t });
        case 'turn-error':
            return _jsx(TurnErrorItem, { node: node, t: t });
        default:
            return (_jsx("div", { className: css.contextRow, children: _jsx(JsonBlock, { label: t('message.unknownSurface', { type: node.type }), payload: node.data, truncatedLabel: truncated }) }));
    }
});
//# sourceMappingURL=MessageItem.js.map