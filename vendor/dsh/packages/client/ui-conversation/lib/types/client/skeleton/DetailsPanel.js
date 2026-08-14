import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// DetailsPanel, P-I minimal form: close button + the selected call's args and
// result — args as JSON, the result raw except for a terminal-card call, whose
// Output section is the command's terminal card. The three-段 Switch /
// Prev-Next stepping / See-in-trajectory are deferred (ledger). Reads the
// selection from the shared chat
// store (conversation writes, this panel reads — the cross-registration
// share the store seat exists for) and derives the call material from the
// session snapshot — no data of its own.
import { CodeBlock, DiffBlock, ReadBlock, SearchBlock, TerminalBlock, WebBlock } from '@deepseek-ai/dsh-client-ui-primitives';
import { shallowEqual } from '@deepseek-ai/dsh-client-runtime/client';
import { readCardModel } from "../contract/read-card-model.js";
import { diffCardModel } from "../contract/diff-card-model.js";
import { searchCardModel } from "../contract/search-card-model.js";
import { terminalBlockLabels, terminalCardModel } from "../contract/terminal-card-model.js";
import { webCardModel } from "../contract/web-card-model.js";
import { resultText } from "../contract/tool-call-model.js";
import css from './DetailsPanel.module.css';
/** Material of a settled result node (native call or run_code sub-dispatch). */
function settledMaterial(node, callId) {
    return { name: node.call?.name ?? callId, argsRaw: node.call?.argsRaw ?? null, block: node };
}
/** Material of an in-flight call (native call or run_code sub-dispatch). */
function runningMaterial(call) {
    return { name: call.name, argsRaw: call.argsRaw, block: call };
}
function materialFor(s, callId) {
    for (const node of s.nodes) {
        if (node.kind === 'tool-result' && node.callId === callId)
            return settledMaterial(node, callId);
    }
    const open = s.runningCalls.find(c => c.callId === callId);
    if (open !== undefined)
        return runningMaterial(open);
    // run_code sub-dispatches: the native call-block shapes, so a selected
    // sub-row resolves through the same material as a native call — the
    // settled ToolResultNode form, or the RunningToolCall form mid-flight.
    for (const subs of s.codeDispatches.values()) {
        for (const sub of subs) {
            if (sub.callId !== callId) {
                continue;
            }
            return 'kind' in sub ? settledMaterial(sub, callId) : runningMaterial(sub);
        }
    }
    return null;
}
function pretty(raw) {
    try {
        return JSON.stringify(JSON.parse(raw), null, 2);
    }
    catch {
        // Not JSON (streaming fragment or plain text): show verbatim.
        return raw;
    }
}
export function DetailsPanel({ useSession, useSessions, sessionId, useStore, closeDetails, renderSlot, t }) {
    const selection = useStore(s => s.selection);
    // Session workspace root: an omitted or relative terminal cwd resolves
    // against it, which the pure presenter cannot see.
    const sessionCwd = useSessions(list => list.byId[sessionId]?.cwd);
    const callId = selection?.callId;
    // materialFor builds a fresh wrapper; shallowEqual short-circuits on its
    // stable members (result node reference rides the snapshot's structural sharing).
    const material = useSession(s => (callId === undefined ? null : materialFor(s, callId)), (a, b) => { return shallowEqual(a, b); });
    return (_jsxs("div", { className: css.root, children: [_jsxs("div", { className: css.header, children: [_jsx("div", { className: css.title, children: selection === null ? t('details.title') : material?.name ?? selection.toolName ?? t('details.title') }), _jsx("button", { type: "button", className: css.close, "aria-label": t('details.close'), onClick: () => { closeDetails(); }, children: _jsx("svg", { viewBox: "0 0 16 16", width: "14", height: "14", "aria-hidden": true, children: _jsx("path", { d: "M4 4l8 8M12 4l-8 8", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }) }) })] }), _jsx("div", { className: css.body, children: selection === null || callId === undefined
                    ? _jsx("div", { className: css.empty, children: t('details.empty') })
                    : material === null
                        ? _jsx("div", { className: css.empty, children: t('details.notInWindow') })
                        : (_jsxs(_Fragment, { children: [material.argsRaw !== null && (_jsxs("section", { className: css.section, children: [_jsx("div", { className: css.sectionLabel, children: t('details.input') }), _jsx(CodeBlock, { code: pretty(material.argsRaw), lang: "json", copyLabel: t('copy'), copiedLabel: t('copied') })] })), _jsxs("section", { className: css.section, children: [_jsx("div", { className: css.sectionLabel, children: t('details.output') }), _jsx(OutputBody, { material: material, cwd: sessionCwd, t: t, renderSlot: renderSlot, callId: callId }, callId)] })] })) })] }));
}
/**
 * The Output section's body for the selected call. A terminal-card call — a
 * shell command's call/result views — renders through the shared TerminalBlock
 * at the primitive's own full height allowance, so column-aligned output keeps
 * its alignment and scrolls sideways instead of folding. A read-card call
 * renders through the shared ReadBlock at that same full height, so the whole
 * returned window is line-numbered and highlighted. A diff-card call — a
 * write/edit's applied change — renders through the shared DiffBlock at the same
 * full height. A search-card call — a `grep`/`glob` result view — renders
 * through the shared SearchBlock at the same full height allowance, with a
 * capped search's recovery footer below it. A web-card call — a
 * `web_search`/`web_fetch` result — renders through WebBlock at its own full
 * source-list allowance. Every other call, and a running call with no card yet,
 * keeps the flattened text form.
 * @param props.material - the selected call's material from {@link materialFor}.
 * @param props.cwd - the session workspace root, resolving the terminal view's cwd.
 * @param props.t - the panel's locale seat, passed down as a plain prop.
 * @returns the Output section's body element.
 */
function OutputBody({ material, cwd, t, renderSlot, callId }) {
    const terminal = terminalCardModel(material.block, cwd);
    if (terminal !== null) {
        // The contract renders the presenter's description above the card, and the
        // panel has no summary row to carry it, so it is drawn here.
        return (_jsxs(_Fragment, { children: [terminal.description !== undefined && (_jsx("div", { className: css.terminalDescription, children: terminal.description })), _jsx(TerminalBlock, { ...terminal.card, labels: terminalBlockLabels(t), className: css.cardBody })] }));
    }
    const read = readCardModel(material.block, cwd);
    // The panel takes the primitive's own default cap, not the row's tighter one:
    // it is the single-call reading surface, so the whole window is available.
    if (read !== null)
        return _jsx(ReadBlock, { ...read, className: css.read });
    const diff = diffCardModel(material.block);
    if (diff !== null)
        return _jsx(DiffBlock, { ...diff.card, className: css.cardBody });
    const search = searchCardModel(material.block);
    if (search !== null) {
        return (_jsxs(_Fragment, { children: [_jsx(SearchBlock, { ...search.card, className: css.cardBody }), search.recovery !== undefined && (_jsx("div", { className: css.searchRecovery, children: search.recovery }))] }));
    }
    const web = webCardModel(material.block);
    // The card shows every source the tool returned (the same list the model saw),
    // scrolling within its own capped height. Below the card the panel also renders
    // the flattened result content — the model-visible text the card does not carry
    // verbatim (a web_fetch card shows only the URL and status, so its fetched body
    // lives only here; a search card's answer and sources are structured, so the
    // flattened form repeats them as the raw text the model saw).
    if (web !== null) {
        const settled = 'kind' in material.block ? material.block : null;
        const body = settled === null ? '' : resultText(settled);
        return (_jsxs(_Fragment, { children: [_jsx(WebBlock, { ...web, className: css.web }), body !== '' && _jsx("pre", { className: css.code, children: body })] }));
    }
    // A settled call always carries the result node the flattened form needs;
    // the running shape has no result to flatten.
    if (!('kind' in material.block)) {
        // An in-flight call: let the keyed output hole render its running surface
        // (a feature plugin streams generation progress here); the fallback is
        // the panel's plain running text, exactly as before the hole existed.
        const toolName = material.block.name;
        return renderSlot('conversation.details.toolview', {
            callId,
            toolName,
            // The running shape stands in for the settled block; registrants
            // discriminate with `'kind' in block`.
            block: material.block,
        }, {
            entryKey: toolName,
            fallback: _jsx("div", { className: css.empty, children: t('details.running') }),
        });
    }
    const result = material.block;
    const toolName = result.call?.name;
    const flattened = (_jsx("pre", { className: css.code, "data-error": result.isError || undefined, children: resultText(result) }));
    // A window-truncated call head has no wire tool name to key on; render the
    // flattened form directly instead of pretending a keyed dispatch key.
    if (toolName === undefined)
        return flattened;
    // The keyed output hole lets a feature plugin render the selected call's
    // output (e.g. ui-artifact's full document); the fallback is exactly the
    // flattened result text this arm rendered before the hole existed, so
    // unregistered tools are byte-identical (UF-002).
    return renderSlot('conversation.details.toolview', { callId, toolName, block: result }, {
        entryKey: toolName,
        fallback: flattened,
    });
}
//# sourceMappingURL=DetailsPanel.js.map