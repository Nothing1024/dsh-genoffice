/** Workspace baseline, incremental-frame, and unary-action owner. */
import { transportError } from '@deepseek-ai/dsh-host-apiproxy/api';
import { mergeOrderedBaseline } from "../ordered-baseline.js";
import { Notifier } from "../sessions/notifier.js";
import { Workspace } from "./workspace.js";
/** Workspace object cluster driven by one list baseline and changed-frame upserts. */
export class WorkspaceManager {
    api;
    items = [];
    itemViewsSource = null;
    itemViewsCache = [];
    // Full-snapshot state (list response / unary response / changed frame all
    // carry the complete set), so deltas never merge — installs replace.
    archivedSessionIds = [];
    state = 'idle';
    phase = 'pending';
    error = null;
    inflight = null;
    refreshFrames = null;
    /**
     * True once a frame or unary echo installed the archive set while a list
     * request was in flight: that install is newer than the pending baseline,
     * so the baseline's (older) set must not roll it back — the archive
     * mirror of replaying refreshFrames over the item baseline.
     */
    archivedSupersedesRefresh = false;
    /**
     * Ids this process has seen removed, kept for the connection's lifetime so
     * a late changed frame or a stale baseline row cannot resurrect a deleted
     * row. Correctness rests on Host ids never being reused (the registry mints
     * a fresh `randomUUID` per record, including when the same directory is
     * registered again) — a path-derived id scheme would turn these entries
     * into permanent blindfolds and must clear them instead.
     */
    removedIds = new Set();
    snapshotCache;
    notifier = new Notifier(() => {
        this.snapshotCache = this.buildSnapshot();
    });
    /** @param api - shared wire client. */
    constructor(api) {
        this.api = api;
        this.snapshotCache = this.buildSnapshot();
    }
    /**
     * Refresh from workspace.list. The first successful response establishes
     * Host order; later responses update membership and values without moving
     * identities already visible to the client. Frames arriving during the RPC
     * are replayed over its response.
     * @returns the shared in-flight refresh.
     */
    refresh() {
        if (this.inflight !== null)
            return this.inflight;
        this.state = 'loading';
        this.error = null;
        const established = this.itemViews();
        const frames = [];
        this.refreshFrames = frames;
        this.notifier.markDirty();
        this.inflight = (async () => {
            try {
                const { result } = await this.api.workspace.list({});
                if (result.ok) {
                    let items = this.phase === 'pending'
                        ? result.value.items
                        : mergeOrderedBaseline(established, result.value.items, workspace => workspace.workspaceId);
                    items = items.filter(workspace => !this.removedIds.has(workspace.workspaceId));
                    for (const delta of frames)
                        items = applyWorkspaceDelta(items, delta);
                    this.installViews(items);
                    if (!this.archivedSupersedesRefresh)
                        this.installArchived(result.value.archivedSessionIds);
                    this.state = 'idle';
                    this.phase = 'ready';
                }
                else {
                    this.state = 'error';
                    this.error = result.error;
                }
            }
            catch (error) {
                this.state = 'error';
                const folded = transportError(error);
                /* v8 ignore next -- transportError always returns the failure branch. */
                this.error = !folded.ok ? folded.error : null;
            }
            finally {
                this.refreshFrames = null;
                this.archivedSupersedesRefresh = false;
                this.inflight = null;
                this.notifier.markDirty();
            }
        })();
        return this.inflight;
    }
    /**
     * Create or resolve a real Workspace, then publish its returned snapshot
     * without waiting for the changed frame.
     * @param input - name under workspaceRoot or an existing absolute path.
     * @returns the wire result.
     */
    async create(input) {
        const workspace = new Workspace(this.api, input);
        const completion = workspace.materialize();
        if (completion === undefined)
            throw new Error('a local Workspace must be materializable');
        const result = await completion;
        if (result.ok)
            this.upsert(result.value.workspace, workspace);
        return result;
    }
    /**
     * Rename a Workspace, then publish its returned snapshot without waiting
     * for the changed frame.
     * @param workspaceId - target workspace.
     * @param title - new display title.
     * @returns the wire result.
     */
    async rename(workspaceId, title) {
        const { result } = await this.api.workspace.rename({ workspaceId, title });
        if (result.ok)
            this.upsert(result.value.workspace);
        return result;
    }
    /**
     * Delete a Workspace registration and remove its local projection from the
     * unary response without waiting for the Host frame.
     * @param workspaceId - target workspace.
     * @returns the wire result.
     */
    async delete(workspaceId) {
        const { result } = await this.api.workspace.delete({ workspaceId });
        if (result.ok)
            this.remove(workspaceId, true);
        return result;
    }
    /**
     * Move a session within its Workspace's manual order, then publish the
     * returned snapshot without waiting for the changed frame.
     * @param workspaceId - owning workspace.
     * @param sessionId - accounted session to move.
     * @param beforeSessionId - accounted anchor to insert before; omitted appends.
     * @returns the wire result.
     */
    async insertSessionBefore(workspaceId, sessionId, beforeSessionId) {
        const { result } = await this.api.workspace.insertSessionBefore({
            workspaceId, sessionId,
            ...beforeSessionId === undefined ? {} : { beforeSessionId },
        });
        if (result.ok)
            this.upsert(result.value.workspace);
        return result;
    }
    /**
     * Archive one session in the registry-global set, then install the
     * returned full set without waiting for the changed frame.
     * @param sessionId - session to archive.
     * @returns the wire result.
     */
    async archiveSession(sessionId) {
        const { result } = await this.api.workspace.archiveSession({ sessionId });
        if (result.ok)
            this.installArchived(result.value.archivedSessionIds);
        return result;
    }
    /**
     * Host-frame entry. Non-workspace frames are ignored so the runtime can
     * fan one host stream out to both object managers.
     * @param envelope - host stream envelope.
     */
    handleHostEnvelope(envelope) {
        if (envelope.payload.type === 'host/workspace-changed')
            this.upsert(envelope.payload.workspace);
        else if (envelope.payload.type === 'host/workspace-removed')
            this.remove(envelope.payload.workspaceId);
        else if (envelope.payload.type === 'host/archived-sessions-changed') {
            this.installArchived(envelope.payload.archivedSessionIds);
        }
    }
    /** Re-pull the baseline after each connection generation. */
    handleConnected() {
        void this.refresh();
    }
    /**
     * Subscribe to workspace snapshot invalidation.
     * @param listener - snapshot invalidation callback.
     * @returns unsubscribe function.
     */
    subscribe(listener) {
        return this.notifier.subscribe(listener);
    }
    /**
     * Read the cached workspace snapshot after flushing pending notifications.
     * @returns the cached workspace snapshot.
     */
    getSnapshot() {
        this.notifier.ensureFresh();
        return this.snapshotCache;
    }
    buildSnapshot() {
        return {
            items: this.itemViews(),
            archivedSessionIds: this.archivedSessionIds,
            state: this.state,
            phase: this.phase,
            error: this.error,
        };
    }
    /**
     * Replace the archive set when membership actually changed (array identity
     * backs Object.is short-circuits). Host snapshots are append-ordered, so
     * positional comparison is exact, not merely heuristic.
     */
    installArchived(archivedSessionIds) {
        if (this.refreshFrames !== null)
            this.archivedSupersedesRefresh = true;
        if (archivedSessionIds.length === this.archivedSessionIds.length
            && archivedSessionIds.every((id, index) => id === this.archivedSessionIds[index]))
            return;
        this.archivedSessionIds = [...archivedSessionIds];
        this.notifier.markDirty();
    }
    /** Upsert one Host view, optionally retaining the local object that materialized it. */
    upsert(view, identity) {
        if (this.removedIds.has(view.workspaceId))
            return;
        this.refreshFrames?.push({ type: 'upsert', workspace: view });
        const index = this.items.findIndex(item => item.getSnapshot().view?.workspaceId === view.workspaceId);
        // Mutation responses and changed frames race (two carriers, no ordering):
        // reject a snapshot strictly older than the installed projection so a
        // late unary response cannot roll back a newer frame.
        const installed = index === -1 ? undefined : this.items[index]?.getSnapshot().view;
        if (installed !== undefined && Date.parse(view.updatedAt) < Date.parse(installed.updatedAt))
            return;
        if (identity !== undefined) {
            this.items = index === -1
                ? [identity, ...this.items]
                : this.items.map((item, position) => position === index ? identity : item);
        }
        else if (index === -1) {
            this.items = [new Workspace(this.api, view), ...this.items];
        }
        else {
            this.items[index]?.adopt(view);
            this.items = [...this.items];
        }
        this.notifier.markDirty();
    }
    /** Remove one id idempotently and retain a tombstone against late echoes. */
    remove(workspaceId, direct = false) {
        this.refreshFrames?.push({ type: 'remove', workspaceId });
        this.removedIds.add(workspaceId);
        const items = this.items.filter(item => item.getSnapshot().view?.workspaceId !== workspaceId);
        if (items.length === this.items.length) {
            // The Host frame may have removed the row first but left its batched
            // notification pending. A successful unary echo still flushes that
            // committed state before the user action resolves.
            if (direct)
                this.notifier.notifyNow();
            return;
        }
        this.items = items;
        if (direct)
            this.notifier.notifyNow();
        else
            this.notifier.markDirty();
    }
    installViews(views) {
        const existing = new Map(this.items.flatMap((workspace) => {
            const view = workspace.getSnapshot().view;
            return view === undefined ? [] : [[view.workspaceId, workspace]];
        }));
        const installed = new Map();
        for (const view of views) {
            const duplicate = installed.get(view.workspaceId);
            if (duplicate !== undefined) {
                duplicate.adopt(view);
                continue;
            }
            const workspace = existing.get(view.workspaceId) ?? new Workspace(this.api, view);
            workspace.adopt(view);
            installed.set(view.workspaceId, workspace);
        }
        this.items = [...installed.values()];
    }
    itemViews() {
        if (this.itemViewsSource === this.items)
            return this.itemViewsCache;
        this.itemViewsSource = this.items;
        this.itemViewsCache = this.items.flatMap((workspace) => {
            const view = workspace.getSnapshot().view;
            return view === undefined ? [] : [view];
        });
        return this.itemViewsCache;
    }
}
/** Known ids retain their position; a newly created Workspace enters first. */
function upsertWorkspace(items, workspace) {
    const index = items.findIndex(item => item.workspaceId === workspace.workspaceId);
    return index === -1
        ? [workspace, ...items]
        : items.map((item, position) => position === index ? workspace : item);
}
/** Replay one ordered delta over a baseline: upsert in place, or drop the removed id. */
function applyWorkspaceDelta(items, delta) {
    return delta.type === 'upsert'
        ? upsertWorkspace(items, delta.workspace)
        : items.filter(workspace => workspace.workspaceId !== delta.workspaceId);
}
//# sourceMappingURL=manager.js.map