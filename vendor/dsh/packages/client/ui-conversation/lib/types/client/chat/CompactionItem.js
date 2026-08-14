import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// CompactionItem: the one row a landed compaction contributes to the flow.
// The conversation it shadowed on the model surface stays above it, so this
// marker reports where the model stopped seeing that history — it never
// replaces it. The framed checkpoint payload is written for the model and is
// not rendered; the disclosure shows the summary from the checkpoint's own
// provenance, and a window cut that left that provenance outside makes the row
// non-expandable rather than empty.
import { memo, useState } from 'react';
import { IconChevronDownOutline14, IconChevronRightOutline14, MarkdownText, } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './MessageItem.module.css';
/**
 * The collapsed-by-default compaction marker.
 * @param props - the marker node off the snapshot cache.
 * @returns the marker row, with the summary disclosure when one is available.
 */
export const CompactionItem = memo(function CompactionItem({ node, t }) {
    const [expanded, setExpanded] = useState(false);
    const expandable = node.summary !== null;
    const open = expandable && expanded;
    return (_jsxs("div", { className: css.compactionRow, children: [_jsxs("button", { type: "button", className: css.compactionButton, disabled: !expandable, "aria-expanded": expandable ? open : undefined, onClick: () => { setExpanded(value => !value); }, children: [_jsx("span", { className: css.compactionLeading, children: open ? _jsx(IconChevronDownOutline14, {}) : _jsx(IconChevronRightOutline14, {}) }), _jsx("span", { className: css.compactionTitle, children: t('message.compaction') }), _jsx("span", { className: css.compactionSep, "aria-hidden": true }), _jsx("span", { className: css.compactionSummary, children: expandable ? t('message.compaction.expand') : t('message.compaction.unavailable') })] }), open && node.summary !== null
                && _jsx("div", { className: css.compactionBody, children: _jsx(MarkdownText, { text: node.summary }) })] }));
});
//# sourceMappingURL=CompactionItem.js.map