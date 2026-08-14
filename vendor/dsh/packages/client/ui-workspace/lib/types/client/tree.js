/** Group key for Sessions outside every Workspace. */
export const UNGROUPED_KEY = '';
/** Display label for the ungrouped bucket row. */
export const UNGROUPED_LABEL = 'Ungrouped';
/**
 * Directory display label: basename of the path (both separators accepted).
 * Ungrouped-bucket fallback for surfaces without a workspace title.
 * @param cwd - directory path, or undefined for the ungrouped bucket.
 * @returns basename, the raw cwd when it has no basename, or the ungrouped label.
 */
export function projectLabel(cwd) {
    if (cwd === undefined || cwd === '')
        return UNGROUPED_LABEL;
    const base = cwd.replace(/[/\\]+$/, '').split(/[/\\]/).pop();
    return base !== undefined && base !== '' ? base : cwd;
}
/** Recency comparator: newest first, id as the deterministic tiebreak (ids are unique per group). */
function byRecency(a, b) {
    if (b.updatedAt !== a.updatedAt)
        return b.updatedAt - a.updatedAt;
    return a.id < b.id ? -1 : 1;
}
/**
 * Ordinary sessions are visible; among blank sessions, only the current one
 * is visible. Subagent children use their parent header catalog; archived
 * sessions are visible nowhere, while their accounting slots remain so
 * unarchiving restores position.
 */
function sessionVisible(session, current, archived) {
    return session.origin !== 'subagent'
        && !archived.has(session.id)
        && (!session.blank || session.id === current);
}
/**
 * A blank session is the selected Workspace's provisional New Session row;
 * its canonical title never enters search (blank rows are query-excluded)
 * and the renderer localizes its display label.
 */
function sessionTitle(session) {
    return session.blank ? 'New Session' : session.displayTitle;
}
/** Build one group without projecting session lineage into presentation. */
function buildGroup(key, workspaceId, cwd, createdAt, label, members, order) {
    const sessions = [...members];
    // Workspace order is workspace.sessionIds; only Ungrouped lacks an account
    // order and therefore falls back to recency.
    if (order === 'recency')
        sessions.sort(byRecency);
    return { key, workspaceId, cwd, createdAt, label, sessions };
}
/**
 * Group Sessions by Host Workspace: one group per entity in stable Host
 * order, with members resolved from sessionIds in their stored order. Sessions
 * outside every Workspace trail in the recency-ordered Ungrouped bucket.
 */
function groupByWorkspace(list, workspaces, archived) {
    const groups = [];
    const accounted = new Set();
    for (const workspace of workspaces) {
        const members = [];
        for (const id of workspace.sessionIds) {
            const summary = list.byId[id];
            if (summary === undefined)
                continue; // account may lead the list pull; the row appears when the summary lands
            accounted.add(id);
            if (!sessionVisible(summary, list.current, archived))
                continue;
            members.push(summary);
        }
        groups.push(buildGroup(workspace.workspaceId, workspace.workspaceId, workspace.path, Date.parse(workspace.createdAt), workspace.title, members, 'account'));
    }
    const stray = list.ids
        .map(id => list.byId[id])
        .filter((s) => s !== undefined && !accounted.has(s.id) && sessionVisible(s, list.current, archived));
    if (stray.length > 0) {
        groups.push(buildGroup(UNGROUPED_KEY, undefined, undefined, undefined, UNGROUPED_LABEL, stray, 'recency'));
    }
    return groups;
}
function sessionNode(s) {
    return {
        id: s.id,
        title: sessionTitle(s),
        blank: s.blank,
        running: s.running,
        completed: s.completed === true,
        updatedAt: s.updatedAt,
        ...(s.pendingInteraction === undefined ? {} : { pendingInteraction: s.pendingInteraction }),
    };
}
/**
 * Derive the workspace browser groups with every session as a top-level row.
 *
 * Every group shows; sessions populate under expanded groups, preserving
 * Host account order. Blank sessions are excluded except for the selected
 * provisional New Session row; archived sessions are excluded everywhere.
 * Content search lives outside this derivation
 * (see {@link deriveSearchResults}).
 * @param list - sessions list snapshot (`current` feeds containsCurrent).
 * @param workspaces - real workspaces in stable Host order.
 * @param archivedSessionIds - registry-global archive set.
 * @param view - local expansion arrays.
 * @returns group sections in render order.
 */
export function deriveGroups(list, workspaces, archivedSessionIds, view) {
    const archived = new Set(archivedSessionIds);
    const expandedProjects = new Set(view.expandedProjects);
    const currentGroup = list.current === undefined
        ? undefined
        : workspaces.find(w => w.sessionIds.includes(list.current))?.workspaceId
            ?? UNGROUPED_KEY;
    const groups = [];
    for (const g of groupByWorkspace(list, workspaces, archived)) {
        const expanded = expandedProjects.has(g.key);
        groups.push({
            key: g.key,
            workspaceId: g.workspaceId,
            cwd: g.cwd,
            createdAt: g.createdAt,
            label: g.label,
            sessionCount: g.sessions.length,
            expanded,
            containsCurrent: g.key === currentGroup,
            sessions: expanded ? g.sessions.map(sessionNode) : [],
        });
    }
    return groups;
}
/**
 * Derive the flat session list ("In one list" mode): every session — fork
 * children included — as a top-level row, strictly newest-first. No grouping,
 * no parent/child adjacency. Content search lives outside this derivation
 * (see {@link deriveSearchResults}).
 * @param list - sessions list snapshot.
 * @param archivedSessionIds - registry-global archive set.
 * @returns flat rows in render order.
 */
export function deriveFlat(list, archivedSessionIds) {
    const archived = new Set(archivedSessionIds);
    const rows = [];
    for (const id of list.ids) {
        const s = list.byId[id];
        if (s === undefined || !sessionVisible(s, list.current, archived))
            continue;
        rows.push(s);
    }
    rows.sort(byRecency);
    return rows.map(sessionNode);
}
/**
 * Merge immediate title/Workspace substring matches with ranked Host content
 * matches. Local rows lead newest-first, content-only rows retain backend
 * order, and duplicate sessions receive the backend snippet in place.
 * @param list - session metadata authority.
 * @param workspaces - Workspace membership and display labels.
 * @param query - caller text; surrounding whitespace is ignored.
 * @param archivedSessionIds - registry-global archive set (members never match).
 * @param content - ranked Host content-search page.
 * @param limit - protocol-owned maximum merged row count.
 * @returns bounded deduplicated flat rows and a refine-query hint bit.
 */
export function deriveSearchResults(list, workspaces, query, archivedSessionIds, content, limit) {
    const q = query.trim().toLowerCase();
    if (q === '')
        return { items: [], hasMore: false };
    const archived = new Set(archivedSessionIds);
    const workspaceBySession = new Map();
    for (const workspace of workspaces) {
        for (const sessionId of workspace.sessionIds) {
            if (!workspaceBySession.has(sessionId))
                workspaceBySession.set(sessionId, workspace.title);
        }
    }
    const labelOf = (summary) => workspaceBySession.get(summary.id) ?? projectLabel(summary.cwd);
    const contentBySession = new Map();
    for (const item of content.items) {
        if (!contentBySession.has(item.sessionId))
            contentBySession.set(item.sessionId, item);
    }
    const local = [];
    for (const id of list.ids) {
        const summary = list.byId[id];
        // Blank placeholders never match a query (their canonical title displays
        // localized, so matching it would tie search to one language).
        if (summary === undefined || summary.blank || !sessionVisible(summary, list.current, archived))
            continue;
        if (sessionTitle(summary).toLowerCase().includes(q)
            || labelOf(summary).toLowerCase().includes(q)) {
            local.push(summary);
        }
    }
    local.sort(byRecency);
    const ordered = [];
    const included = new Set();
    const include = (summary) => {
        if (included.has(summary.id))
            return;
        included.add(summary.id);
        ordered.push(summary);
    };
    for (const summary of local)
        include(summary);
    for (const item of content.items) {
        const summary = list.byId[item.sessionId];
        if (summary !== undefined && !summary.blank && sessionVisible(summary, list.current, archived)) {
            include(summary);
        }
    }
    return {
        items: ordered.slice(0, limit).map((summary) => {
            const match = contentBySession.get(summary.id);
            return {
                id: summary.id,
                title: sessionTitle(summary),
                workspace: labelOf(summary),
                running: summary.running,
                ...(summary.pendingInteraction === undefined
                    ? {}
                    : { pendingInteraction: summary.pendingInteraction }),
                completed: summary.completed === true,
                ...match === undefined ? {} : { snippet: match.snippet },
            };
        }),
        hasMore: content.hasMore || ordered.length > limit,
    };
}
/**
 * Compact relative time for session rows, as a structured bucket the
 * renderer localizes ("now"/"5min"/"3h"/"2d"/"4mo"/"1y" in en).
 * @param updatedAt - epoch ms of the session's last activity.
 * @param now - current epoch ms (injected for pure rendering).
 * @returns the row's trailing time bucket and magnitude.
 */
export function relativeTime(updatedAt, now) {
    const MIN = 60_000;
    const HOUR = 3_600_000;
    const DAY = 86_400_000;
    const diff = Math.max(0, now - updatedAt);
    if (diff < MIN)
        return { unit: 'now', n: 0 };
    if (diff < HOUR)
        return { unit: 'minutes', n: Math.floor(diff / MIN) };
    if (diff < DAY)
        return { unit: 'hours', n: Math.floor(diff / HOUR) };
    if (diff < 30 * DAY)
        return { unit: 'days', n: Math.floor(diff / DAY) };
    if (diff < 365 * DAY)
        return { unit: 'months', n: Math.floor(diff / (30 * DAY)) };
    return { unit: 'years', n: Math.floor(diff / (365 * DAY)) };
}
//# sourceMappingURL=tree.js.map