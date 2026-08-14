import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Workspace browser tree row components (figma Cell set 14:3080): pure presentational —
 * all data and callbacks arrive via props. Hover swaps (folder->chevron,
 * time->ellipsis, action buttons) are CSS-only. Row ... menus are visual-only
 * except workspace Rename/Delete and session Rename/Fork/Archive; the session
 * and workspace hover cards are suppressed while a menu is open.
 */
import { useState } from 'react';
import clsx from 'clsx';
import { HoverCard, IconArchiveOutline20, IconBranchOutline16, IconEditOutline16, IconEllipsisOutline16, IconFolderClose16, IconFolderOpen16, IconPlusOutline16, IconTrashOutline16, IconTriangleRightFill14, Menu, StateDot, } from '@deepseek-ai/dsh-client-ui-primitives';
import { relativeTime } from "../tree.js";
import css from './Rows.module.css';
/** Row display title: blank rows show the localized New Session label. */
function displayTitle(node, t) {
    return node.blank ? t('session.new') : node.title;
}
/** Localized compact relative time ("刚刚"/"5分钟" in zh, "now"/"5min" in en). */
function timeLabel(updatedAt, now, t) {
    const { unit, n } = relativeTime(updatedAt, now);
    return unit === 'now' ? t('time.now') : t(`time.${unit}`, { n });
}
/** Hover-card variant: distances wrap in the ago template; the now bucket stays bare (no "now ago"). */
function hoverTimeLabel(updatedAt, now, t) {
    const { unit, n } = relativeTime(updatedAt, now);
    return unit === 'now' ? t('time.now') : t('time.ago', { t: t(`time.${unit}`, { n }) });
}
/**
 * Absolute creation time through the dictionary's date template (the message
 * clock pattern): `toLocaleString` would follow the browser language, not the
 * app locale, and produce mixed-language text after a switch.
 */
function createdLabel(createdAt, t) {
    const d = new Date(createdAt);
    const pad2 = (v) => { return String(v).padStart(2, '0'); };
    const date = t('date.ymd', { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
    return t('hover.created', { time: `${date} ${pad2(d.getHours())}:${pad2(d.getMinutes())}` });
}
/** Hover-card body: workspace title, full directory path, absolute creation time. */
function WorkspaceHoverContent({ label, cwd, createdAt, t }) {
    return (_jsxs("div", { className: css.hoverContent, children: [_jsx("div", { className: css.hoverTitle, children: label }), _jsx("div", { className: css.hoverPath, children: cwd }), _jsx("div", { className: css.hoverTime, children: createdLabel(createdAt, t) })] }));
}
/**
 * Project (workspace) header row: 54px, folder + title + session count;
 * hover reveals the chevron and create button, and dwelling on a real
 * Workspace shows its hover card (the ungrouped bucket has none).
 * `containsCurrent` arrives on the node (derivation fact, no renderer scan).
 * @param props.group - derived group node.
 * @param props.onToggle - expand/collapse the group.
 * @param props.onCreate - start a frontend Session inside this Workspace.
 * @param props.t - the browser root's locale seat.
 * @returns the row element.
 */
export function ProjectRowItem({ group, onToggle, onCreate, actions, t }) {
    const row = group;
    // The ungrouped bucket has no workspace title: its label is dictionary copy.
    const label = row.workspaceId === undefined ? t('group.ungrouped') : row.label;
    const active = group.expanded && group.containsCurrent;
    const count = t(row.sessionCount === 1 ? 'sessions.count.one' : 'sessions.count.other', { n: row.sessionCount });
    const [menuOpen, setMenuOpen] = useState(false);
    const workspaceMenuItems = [
        { id: 'rename', label: t('rename'), icon: _jsx(IconEditOutline16, {}) },
        { id: 'delete', label: t('delete.workspace'), icon: _jsx(IconTrashOutline16, {}), danger: true },
    ];
    const ownRow = (_jsxs("div", { className: clsx(css.projectRow, menuOpen && css.menuOpen), role: "treeitem", "aria-expanded": row.expanded, onClick: onToggle, children: [_jsx("span", { className: clsx(css.slot, css.folder, active && css.folderActive), children: row.expanded ? _jsx(IconFolderOpen16, {}) : _jsx(IconFolderClose16, {}) }), _jsx("span", { className: clsx(css.slot, css.chevron), children: _jsx(IconTriangleRightFill14, { className: clsx(css.arrow, row.expanded && css.arrowOpen) }) }), _jsxs("span", { className: css.projectText, children: [_jsx("span", { className: css.title, children: label }), _jsx("span", { className: css.meta, children: count })] }), _jsxs("span", { className: css.rowActions, children: [actions !== undefined && (_jsx(Menu, { open: menuOpen, onClose: () => { setMenuOpen(false); }, items: workspaceMenuItems, onSelect: (id) => {
                            setMenuOpen(false);
                            // Unknown ids leave before the dispatch: a future menu row must
                            // not inherit the destructive branch as an else fallback.
                            /* v8 ignore next -- workspaceMenuItems carries exactly these two rows today. */
                            if (id !== 'rename' && id !== 'delete')
                                return;
                            if (id === 'rename')
                                actions.rename();
                            else
                                actions.delete();
                        }, portal: true, closeOnPointerLeave: true, anchor: (_jsx("button", { type: "button", className: css.iconButton, "aria-label": t('actions.workspace.aria', { name: label }), onClick: (e) => { e.stopPropagation(); setMenuOpen(v => !v); }, children: _jsx(IconEllipsisOutline16, {}) })) })), _jsx("button", { type: "button", className: css.iconButton, "aria-label": t('actions.newSession.aria', { name: label }), onClick: (e) => { e.stopPropagation(); onCreate(); }, children: _jsx(IconPlusOutline16, {}) })] })] }));
    // The ungrouped bucket has no backing Workspace: no card to show.
    if (row.createdAt === undefined)
        return ownRow;
    return (_jsx(HoverCard, { anchor: ownRow, content: _jsx(WorkspaceHoverContent, { label: row.label, cwd: row.cwd, createdAt: row.createdAt, t: t }), disabled: menuOpen, copyText: row.cwd, copyLabel: t('copy'), copiedLabel: t('hover.copied') }));
}
/* v8 ignore next 3 -- closed-union backstop; only reached if the status is forged */
function assertNever(value) {
    throw new Error(`unknown pending interaction: ${String(value)}`);
}
/** Session status presentation; pending user interaction outranks the running state. */
function sessionStatus(node, t) {
    switch (node.pendingInteraction) {
        case 'approval': return { state: 'warning', label: t('status.waitingApproval') };
        case 'plan-review': return { state: 'warning', label: t('status.planReview') };
        case 'question': return { state: 'warning', label: t('status.waitingAnswer') };
        case undefined: break;
        /* v8 ignore next -- closed PendingInteractionStatus union */
        default: return assertNever(node.pendingInteraction);
    }
    if (node.running)
        return { state: 'ongoing', label: t('status.running') };
    if (node.completed)
        return { state: 'done', label: t('status.completed') };
    return { state: 'done', label: t('status.idle') };
}
/** Hover-card body: full title, relative time, and interaction/running/completed/idle status. */
function SessionHoverContent({ node, now, t }) {
    const status = sessionStatus(node, t);
    return (_jsxs("div", { className: css.hoverContent, children: [_jsx("div", { className: css.hoverTitle, children: displayTitle(node, t) }), !node.blank && _jsx("div", { className: css.hoverTime, children: hoverTimeLabel(node.updatedAt, now, t) }), _jsxs("div", { className: css.hoverStatus, children: [_jsx(StateDot, { state: status.state }), _jsx("span", { children: status.label })] })] }));
}
/**
 * One flat search result: title, Workspace context, and optional content
 * excerpt. Search navigation opens the session only; it does not address an
 * event inside the conversation.
 * @param props.result - merged local/content search row.
 * @param props.currentId - selected session id.
 * @param props.onOpen - open the selected session.
 * @param props.t - Workspace-browser translation seat.
 * @returns the result button.
 */
export function SearchResultItem({ result, currentId, onOpen, t }) {
    const selected = result.id === currentId;
    const status = sessionStatus(result, t);
    return (_jsxs("button", { type: "button", className: clsx(css.searchResultRow, selected && css.selected), role: "treeitem", "aria-selected": selected, onClick: () => { onOpen(result.id); }, children: [_jsxs("span", { className: css.searchResultHeading, children: [_jsx("span", { className: css.slot, children: (status.state !== 'done' || result.completed) && (_jsxs(_Fragment, { children: [_jsx(StateDot, { state: status.state }), _jsx("span", { className: css.visuallyHidden, children: status.label })] })) }), _jsx("span", { className: css.searchResultTitle, children: result.title })] }), _jsx("span", { className: css.searchResultWorkspace, children: result.workspace }), result.snippet !== undefined && (_jsx("span", { className: css.searchResultSnippet, children: result.snippet }))] }));
}
/** Pointer-position half of a row (insert line above or below). */
function rowHalf(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
}
/**
 * One top-level 34px session row: status dot (pending user interaction outranks
 * running), title, relative time, and the row actions menu.
 * @param props.node - derived session node.
 * @param props.currentId - selected session id (row highlight).
 * @param props.now - epoch ms for relative-time formatting.
 * @param props.onOpen - open a session by id.
 * @param props.onRename - open the session rename dialog (id + current title).
 * @param props.onFork - fork a session at its last completed turn.
 * @param props.onArchive - archive a session by id.
 * @param props.drag - optional draggable-row wiring.
 * @param props.t - the browser root's locale seat.
 * @returns the session row.
 */
export function SessionNodeItem({ node, currentId, now, onOpen, onRename, onFork, onArchive, drag, t }) {
    const row = node;
    const title = displayTitle(node, t);
    const selected = node.id === currentId;
    const status = sessionStatus(node, t);
    const [menuOpen, setMenuOpen] = useState(false);
    // Archive replaces the former Delete placeholder: it hides the row through
    // the registry-global archive set and never touches the session log, so it
    // is not styled as destructive and needs no confirmation dialog.
    const sessionMenuItems = [
        { id: 'rename', label: t('rename'), icon: _jsx(IconEditOutline16, {}) },
        { id: 'fork', label: t('menu.fork'), icon: _jsx(IconBranchOutline16, {}) },
        // 20-native glyph in the menu's 16px icon slot (Menu.module.css .itemIcon).
        { id: 'archive', label: t('menu.archiveSession'), icon: _jsx(IconArchiveOutline20, { size: 16 }) },
    ];
    // Figma session cell: pad 8, status slot 16, then a 4px title gap.
    const ownRow = (_jsxs("div", { className: clsx(css.sessionRow, selected && css.selected, menuOpen && css.menuOpen, drag?.marker === 'before' && css.dropBefore, drag?.marker === 'after' && css.dropAfter), role: "treeitem", "aria-selected": selected, onClick: () => { onOpen(node.id); }, draggable: drag !== undefined, onDragStart: drag === undefined
            ? undefined
            : (e) => {
                e.dataTransfer.effectAllowed = 'move';
                drag.start();
            }, onDragEnd: drag?.end, onDragOver: drag === undefined
            ? undefined
            : (e) => {
                if (!drag.active)
                    return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                drag.hover(rowHalf(e));
            }, onDrop: drag === undefined
            ? undefined
            : (e) => {
                if (!drag.active)
                    return;
                e.preventDefault();
                drag.drop(rowHalf(e));
            }, children: [_jsx("span", { className: css.slot, children: (status.state !== 'done' || row.completed) && (_jsxs(_Fragment, { children: [_jsx(StateDot, { state: status.state }), _jsx("span", { className: css.visuallyHidden, children: status.label })] })) }), _jsx("span", { className: css.title, children: title }), !row.blank && _jsx("span", { className: css.time, children: timeLabel(row.updatedAt, now, t) }), !row.blank && (_jsx("span", { className: css.rowActions, children: _jsx(Menu, { open: menuOpen, onClose: () => { setMenuOpen(false); }, items: sessionMenuItems, onSelect: (id) => {
                        setMenuOpen(false);
                        if (id === 'rename')
                            onRename(node.id, row.title);
                        if (id === 'fork')
                            onFork(node.id);
                        if (id === 'archive')
                            onArchive(node.id);
                    }, portal: true, closeOnPointerLeave: true, anchor: (_jsx("button", { type: "button", className: css.iconButton, "aria-label": t('actions.session.aria', { name: title }), onClick: (e) => { e.stopPropagation(); setMenuOpen(v => !v); }, children: _jsx(IconEllipsisOutline16, {}) })) }) }))] }));
    return (_jsx(HoverCard, { anchor: ownRow, content: _jsx(SessionHoverContent, { node: node, now: now, t: t }), disabled: menuOpen || drag?.active === true, copyText: row.blank ? undefined : row.title, copyLabel: t('copy'), copiedLabel: t('hover.copied') }));
}
//# sourceMappingURL=Rows.js.map