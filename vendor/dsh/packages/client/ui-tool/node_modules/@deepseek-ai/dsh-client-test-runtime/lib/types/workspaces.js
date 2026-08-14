/** Test-owned workspaces face: the renderer standard-kit observable plus recorded actions. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import { workspaceListState } from "./fixtures.js";
/**
 * Workspaces test double. Implements the same IWorkspaces face features
 * receive as `ctx.workspaces`, so a production face change breaks this
 * double at compile time. Every action records into {@link
 * TestWorkspaces.calls}; defaults are inert echoes — feature tests needing
 * richer behavior replace them via {@link TestWorkspaces.stub}.
 */
export class TestWorkspaces {
    stabilize;
    /** The useWorkspaces standard feed. */
    list;
    /** Calls observed on the action face, newest last. */
    calls = [];
    /** Replaceable action seat: feature tests may stub richer behavior. */
    stubs = new Map();
    /**
     * @param stabilize - the owning runtime's act wrapper.
     */
    constructor(stabilize) {
        this.stabilize = stabilize;
        this.list = createSnapshotStore(workspaceListState());
    }
    /**
     * Update the workspace list state through an immer draft.
     * @param mutate - draft mutator.
     */
    async update(mutate) {
        await this.stabilize(() => { this.list.update(mutate); });
    }
    /**
     * Replace an action's behavior (the recorded call is still appended first).
     * @param method - action name (e.g. 'connectWorkspace').
     * @param impl - replacement behavior.
     */
    stub(method, impl) {
        this.stubs.set(method, impl);
    }
    /**
     * Connect a workspace to its reusable/new blank session (recorded). The
     * default resolves the workspace id back as the session id; stub for
     * cross-session flows.
     * @param workspaceId - target workspace.
     * @returns the connected session id.
     */
    async connectWorkspace(workspaceId) {
        this.calls.push({ method: 'connectWorkspace', args: [workspaceId] });
        const stub = this.stubs.get('connectWorkspace');
        if (stub !== undefined)
            return await stub(workspaceId);
        return `session-of-${workspaceId}`;
    }
    /**
     * New-session flow (recorded; stubbed behavior runs when installed).
     * @param workspaceId - optional explicit workspace target.
     */
    startSession(workspaceId) {
        this.calls.push({ method: 'startSession', args: [workspaceId] });
        this.stubs.get('startSession')?.(workspaceId);
    }
    /**
     * Create a Workspace (recorded). The default echoes a view derived from
     * the input; stub for failure or list-coupled flows.
     * @param input - the Host create payload.
     * @returns the created Workspace view.
     */
    async create(input) {
        this.calls.push({ method: 'create', args: [input] });
        const stub = this.stubs.get('create');
        if (stub !== undefined)
            return await stub(input);
        return {
            workspaceId: `ws-${input.path}`,
            title: input.path,
            path: input.path,
            sessionIds: [],
        };
    }
    /**
     * Open a path with the host OS default application (recorded; default no-op).
     * @param path - host-resolvable path.
     */
    async openPath(path) {
        this.calls.push({ method: 'openPath', args: [path] });
        await this.stubs.get('openPath')?.(path);
    }
    /**
     * Directory picker (recorded). The default cancels (null); stub to select.
     * @returns the picked path, or null.
     */
    async pickDirectory() {
        this.calls.push({ method: 'pickDirectory', args: [] });
        const stub = this.stubs.get('pickDirectory');
        if (stub !== undefined)
            return await stub();
        return null;
    }
    /**
     * Browse listing (recorded). The default serves an empty home level; stub
     * to shape a tree.
     * @param path - absolute directory to list; absent lists the home level.
     * @returns the level's listing.
     */
    async listDirectory(path, signal) {
        // The signal is recorded and forwarded like the production face passes
        // it to the wire, so cancellation integration tests can observe or
        // reject on a superseded scan.
        this.calls.push({ method: 'listDirectory', args: [path, signal] });
        const stub = this.stubs.get('listDirectory');
        if (stub !== undefined)
            return await stub(path, signal);
        // The chain runs root-to-target inclusive, per the DirectoryListing
        // contract — a bare root crumb would mislabel the level in browsers
        // driven by this double.
        return {
            path: '/home/test',
            home: '/home/test',
            crumbs: [
                { name: '/', path: '/', hidden: false },
                { name: 'home', path: '/home', hidden: false },
                { name: 'test', path: '/home/test', hidden: false },
            ],
            entries: [],
            truncated: false,
        };
    }
    /**
     * Browse child creation (recorded). The default joins parent and name.
     * @param path - absolute existing parent directory.
     * @param name - single path segment.
     * @returns the created directory's absolute path.
     */
    async createDirectory(path, name) {
        this.calls.push({ method: 'createDirectory', args: [path, name] });
        const stub = this.stubs.get('createDirectory');
        if (stub !== undefined)
            return await stub(path, name);
        return `${path}/${name}`;
    }
    /**
     * Rename a Workspace (recorded). The default echoes a minimal view.
     * @param workspaceId - target workspace.
     * @param title - new title.
     * @returns the updated view.
     */
    async rename(workspaceId, title) {
        this.calls.push({ method: 'rename', args: [workspaceId, title] });
        const stub = this.stubs.get('rename');
        if (stub !== undefined)
            return await stub(workspaceId, title);
        return { workspaceId, title, path: `/${title}`, sessionIds: [] };
    }
    /**
     * Delete a Workspace (recorded; default no-op).
     * @param workspaceId - target workspace.
     */
    async delete(workspaceId) {
        this.calls.push({ method: 'delete', args: [workspaceId] });
        await this.stubs.get('delete')?.(workspaceId);
    }
    /**
     * Move a Workspace in display order (recorded; default no-op).
     * @param workspaceId - Workspace to move.
     * @param beforeWorkspaceId - Anchor; omitted appends.
     */
    async insertBefore(workspaceId, beforeWorkspaceId) {
        this.calls.push({ method: 'insertBefore', args: [workspaceId, beforeWorkspaceId] });
        await this.stubs.get('insertBefore')?.(workspaceId, beforeWorkspaceId);
    }
    /**
     * Move an accounted session (recorded). The default echoes a minimal view.
     * @param workspaceId - target workspace.
     * @param sessionId - session to move.
     * @param beforeSessionId - anchor; omitted appends.
     * @returns the updated view.
     */
    async insertSessionBefore(workspaceId, sessionId, beforeSessionId) {
        this.calls.push({ method: 'insertSessionBefore', args: [workspaceId, sessionId, beforeSessionId] });
        const stub = this.stubs.get('insertSessionBefore');
        if (stub !== undefined)
            return await stub(workspaceId, sessionId, beforeSessionId);
        return { workspaceId, title: '', path: '', sessionIds: [sessionId] };
    }
    /**
     * Archive a session (recorded). The default mirrors the production face's
     * observable effect: the id joins the list state's archive set.
     * @param sessionId - session to archive.
     */
    async archiveSession(sessionId) {
        this.calls.push({ method: 'archiveSession', args: [sessionId] });
        const stub = this.stubs.get('archiveSession');
        if (stub !== undefined) {
            await stub(sessionId);
            return;
        }
        await this.update((draft) => {
            draft.archivedSessionIds = [...draft.archivedSessionIds, sessionId];
        });
    }
}
//# sourceMappingURL=workspaces.js.map