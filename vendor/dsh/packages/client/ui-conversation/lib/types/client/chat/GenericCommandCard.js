import { jsx as _jsx } from "react/jsx-runtime";
// GenericCommandCard: the default command row — a stripped-down
// GenericToolCard rendering the command name and its settlement text.
// Supplied by the chat view as the keyed commandview slot's render-site
// fallback (an unregistered command name lands here); registrants may compose
// it as a base, feeding the same owner payload through.
import { ToolRow } from "./ToolRow.js";
import { IconApiOutline14 } from '@deepseek-ai/dsh-client-ui-primitives';
/** Node state → row state semantic (running while unsettled; outcome kind after). */
function stateOf(outcome) {
    if (outcome === null)
        return 'running';
    return outcome.kind === 'error' ? 'error' : 'ok';
}
export function GenericCommandCard({ node, t }) {
    const text = node.outcome?.text;
    const summary = node.outcome === null
        ? t('command.running')
        : text ?? (node.outcome.kind === 'error' ? t('command.failed') : t('command.done'));
    // Title is the bare command name: the row already reads `name · outcome`,
    // and the dispatched line's own `/` and arguments only restate what the
    // settlement text says (`permission · preset workspace-write`). A
    // cross-window node whose run page fell out of the window has no name.
    const title = node.name ?? t('command.title');
    return (_jsx(ToolRow, { t: t, variant: "others", icon: _jsx(IconApiOutline14, { size: 14 }), title: title, summary: summary, 
        // Expandable only when the outcome text overflows a one-line summary.
        body: text !== undefined && text.includes('\n') ? text : null, state: stateOf(node.outcome) }));
}
//# sourceMappingURL=GenericCommandCard.js.map