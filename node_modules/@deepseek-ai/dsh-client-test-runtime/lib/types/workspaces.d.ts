import type { DirectoryListing, IWorkspaces, SessionId, SnapshotStore, WorkspaceId, WorkspaceListState, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client';
import type { Stabilizer } from './fixtures.ts';
/**
 * Workspaces test double. Implements the same IWorkspaces face features
 * receive as `ctx.workspaces`, so a production face change breaks this
 * double at compile time. Every action records into {@link
 * TestWorkspaces.calls}; defaults are inert echoes — feature tests needing
 * richer behavior replace them via {@link TestWorkspaces.stub}.
 */
export declare class TestWorkspaces implements IWorkspaces {
    private readonly stabilize;
    /** The useWorkspaces standard feed. */
    readonly list: SnapshotStore<WorkspaceListState>;
    /** Calls observed on the action face, newest last. */
    readonly calls: {
        method: string;
        args: unknown[];
    }[];
    /** Replaceable action seat: feature tests may stub richer behavior. */
    private readonly stubs;
    /**
     * @param stabilize - the owning runtime's act wrapper.
     */
    constructor(stabilize: Stabilizer);
    /**
     * Update the workspace list state through an immer draft.
     * @param mutate - draft mutator.
     */
    update(mutate: (draft: WorkspaceListState) => void): Promise<void>;
    /**
     * Replace an action's behavior (the recorded call is still appended first).
     * @param method - action name (e.g. 'connectWorkspace').
     * @param impl - replacement behavior.
     */
    stub(method: string, impl: (...args: unknown[]) => unknown): void;
    /**
     * Connect a workspace to its reusable/new blank session (recorded). The
     * default resolves the workspace id back as the session id; stub for
     * cross-session flows.
     * @param workspaceId - target workspace.
     * @returns the connected session id.
     */
    connectWorkspace(workspaceId: WorkspaceId): Promise<SessionId>;
    /**
     * New-session flow (recorded; stubbed behavior runs when installed).
     * @param workspaceId - optional explicit workspace target.
     */
    startSession(workspaceId?: WorkspaceId): void;
    /**
     * Create a Workspace (recorded). The default echoes a view derived from
     * the input; stub for failure or list-coupled flows.
     * @param input - the Host create payload.
     * @returns the created Workspace view.
     */
    create(input: {
        path: string;
    }): Promise<WorkspaceView>;
    /**
     * Open a path with the host OS default application (recorded; default no-op).
     * @param path - host-resolvable path.
     */
    openPath(path: string): Promise<void>;
    /**
     * Directory picker (recorded). The default cancels (null); stub to select.
     * @returns the picked path, or null.
     */
    pickDirectory(): Promise<string | null>;
    /**
     * Browse listing (recorded). The default serves an empty home level; stub
     * to shape a tree.
     * @param path - absolute directory to list; absent lists the home level.
     * @returns the level's listing.
     */
    listDirectory(path?: string, signal?: AbortSignal): Promise<DirectoryListing>;
    /**
     * Browse child creation (recorded). The default joins parent and name.
     * @param path - absolute existing parent directory.
     * @param name - single path segment.
     * @returns the created directory's absolute path.
     */
    createDirectory(path: string, name: string): Promise<string>;
    /**
     * Rename a Workspace (recorded). The default echoes a minimal view.
     * @param workspaceId - target workspace.
     * @param title - new title.
     * @returns the updated view.
     */
    rename(workspaceId: WorkspaceId, title: string): Promise<WorkspaceView>;
    /**
     * Delete a Workspace (recorded; default no-op).
     * @param workspaceId - target workspace.
     */
    delete(workspaceId: WorkspaceId): Promise<void>;
    /**
     * Move a Workspace in display order (recorded; default no-op).
     * @param workspaceId - Workspace to move.
     * @param beforeWorkspaceId - Anchor; omitted appends.
     */
    insertBefore(workspaceId: WorkspaceId, beforeWorkspaceId?: WorkspaceId): Promise<void>;
    /**
     * Move an accounted session (recorded). The default echoes a minimal view.
     * @param workspaceId - target workspace.
     * @param sessionId - session to move.
     * @param beforeSessionId - anchor; omitted appends.
     * @returns the updated view.
     */
    insertSessionBefore(workspaceId: WorkspaceId, sessionId: SessionId, beforeSessionId?: SessionId): Promise<WorkspaceView>;
    /**
     * Archive a session (recorded). The default mirrors the production face's
     * observable effect: the id joins the list state's archive set.
     * @param sessionId - session to archive.
     */
    archiveSession(sessionId: SessionId): Promise<void>;
}
//# sourceMappingURL=workspaces.d.ts.map