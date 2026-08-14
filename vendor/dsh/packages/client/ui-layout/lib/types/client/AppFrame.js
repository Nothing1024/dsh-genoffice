import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Three-column shell frame, registered into the built-in 'root' slot (the web
 * shell renders only 'root'). Owns the grid tracks (sidebar | center | tabs),
 * the drag handles (pointer capture + rAF throttle), the concession chain
 * (columns.ts), and the child-slot render decisions: the OFFICIAL sidebar
 * slot renders on the LEFT (ui-sidebar shell with the workspace browser),
 * the session-aware center occupant renders in the center position, and the
 * 'tabs' slot (the artifact profile's TabsRoot right rail) renders on the
 * RIGHT. The 'details' slot stays declared but has no render site in this
 * variant (its registrant, ui-conversation's DetailsPanel, never conflicts —
 * it just never renders). Pure component: everything arrives through the
 * three framework shares — zero cordis or framework imports, zero self-made
 * hooks.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { computeColumns, DETAILS_DEFAULT, SIDEBAR_AUTO_COLLAPSE, SIDEBAR_DEFAULT } from "./columns.js";
import css from './AppFrame.module.css';
/** Center column grid item (session-body building block). */
function CenterColumn(props) {
    return _jsx("div", { className: css.centerCol, children: props.children });
}
/**
 * One drag handle: pointer capture, rAF-throttled dx reports against the drag-start origin.
 * `side` keys the hover-reveal CSS to the owning column.
 */
function DragHandle(props) {
    const [dragging, setDragging] = useState(false);
    const origin = useRef(0);
    const latest = useRef(0);
    const frame = useRef(null);
    const callbacks = useRef({ onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd });
    callbacks.current = { onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd };
    const onPointerDown = useCallback((e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        origin.current = e.clientX;
        latest.current = e.clientX;
        callbacks.current.onStart();
        setDragging(true);
    }, []);
    const onPointerMove = useCallback((e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId))
            return;
        latest.current = e.clientX;
        frame.current ??= requestAnimationFrame(() => {
            frame.current = null;
            callbacks.current.onDrag(latest.current - origin.current);
        });
    }, []);
    const onPointerUp = useCallback((e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId))
            return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (frame.current !== null) {
            cancelAnimationFrame(frame.current);
            frame.current = null;
        }
        callbacks.current.onDrag(latest.current - origin.current);
        setDragging(false);
        callbacks.current.onEnd();
    }, []);
    return (_jsx("div", { className: css.handle, style: { left: props.left }, "data-side": props.side, "data-dragging": dragging || undefined, onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp }));
}
/** The three-column frame: official sidebar left, center, tabs right (see module doc). */
export function AppFrame({ useStore, actions, renderSlot, }) {
    const panels = useStore(s => s);
    const frameRef = useRef(null);
    const [viewport, setViewport] = useState(() => window.innerWidth);
    // Track the frame's own box (not the window): rAF-throttled ResizeObserver.
    useEffect(() => {
        const el = frameRef.current;
        /* v8 ignore next -- the ref is always attached by effect time: the frame div renders unconditionally. */
        if (el === null) {
            return;
        }
        let raf = null;
        const observer = new ResizeObserver(() => {
            raf ??= requestAnimationFrame(() => {
                raf = null;
                const width = el.getBoundingClientRect().width;
                if (width > 0)
                    setViewport(width);
            });
        });
        observer.observe(el);
        return () => {
            observer.disconnect();
            if (raf !== null)
                cancelAnimationFrame(raf);
        };
    }, []);
    // Narrow viewports auto-collapse the sidebar; the store mirror keeps
    // toggleSidebar's semantics right (narrow toggles flip the manual
    // re-expand override, stores.ts). Collapsed is decided here, so the
    // solver stays breakpoint-free: a narrow re-expand passes the preference
    // (or the default when the wide preference is closed) and the center
    // absorbs the squeeze.
    const narrow = viewport < SIDEBAR_AUTO_COLLAPSE;
    useEffect(() => { actions.setNarrow(narrow); }, [actions, narrow]);
    const sidebarCollapsed = narrow ? !panels.narrowExpanded : panels.sidebar === 0;
    const sidebarPreference = sidebarCollapsed
        ? 0
        : panels.sidebar === 0 ? SIDEBAR_DEFAULT : panels.sidebar;
    // The right tabs rail: the store's details width doubles as the tabs
    // width preference (0 = default width; the rail never collapses in this
    // variant).
    const tabsWidth = panels.details === 0 ? DETAILS_DEFAULT : panels.details;
    const cols = computeColumns(viewport, sidebarPreference, tabsWidth);
    const colsRef = useRef(cols);
    colsRef.current = cols;
    // The drag base is the rendered width captured at drag start (grabbing a
    // concession-clamped panel must not jump back to the stored preference);
    // it stays frozen for the whole gesture so dx deltas do not compound.
    const sidebarBase = useRef(0);
    const tabsBase = useRef(0);
    // Track-level transitions pause for the whole gesture: eased tracks would
    // detach the column edge from the pointer (AppFrame.module.css).
    const [dragging, setDragging] = useState(false);
    const onDragEnd = useCallback(() => { setDragging(false); }, []);
    const onSidebarStart = useCallback(() => { sidebarBase.current = colsRef.current.sidebar; setDragging(true); }, []);
    const onTabsStart = useCallback(() => { tabsBase.current = colsRef.current.details; setDragging(true); }, []);
    const onSidebarDrag = useCallback((dx) => {
        actions.setSidebar(sidebarBase.current + dx);
    }, [actions]);
    // Right-edge rail: a positive dx drags the rail's left edge rightward,
    // which NARROWS the column — hence the sign flip.
    const onTabsDrag = useCallback((dx) => {
        actions.setDetails(tabsBase.current - dx);
    }, [actions]);
    return (_jsxs("div", { ref: frameRef, className: css.frame, style: { gridTemplateColumns: `${cols.sidebar}px minmax(0, 1fr) ${cols.details}px` }, "data-sidebar-collapsed": sidebarCollapsed || undefined, "data-dragging": dragging || undefined, children: [_jsx("div", { className: css.sidebarCol, children: renderSlot('sidebar', {
                    collapsed: sidebarCollapsed,
                    width: cols.sidebar,
                }) }), _jsx(CenterColumn, { children: renderSlot('conversation', {}) }), _jsx("div", { className: css.tabsCol, children: renderSlot('tabs', {
                    collapsed: false,
                    width: cols.details,
                }) }), !sidebarCollapsed && _jsx(DragHandle, { side: "sidebar", left: cols.sidebar, onStart: onSidebarStart, onDrag: onSidebarDrag, onEnd: onDragEnd }), _jsx(DragHandle, { side: "tabs", left: viewport - cols.details, onStart: onTabsStart, onDrag: onTabsDrag, onEnd: onDragEnd })] }));
}
//# sourceMappingURL=AppFrame.js.map