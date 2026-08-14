/**
 * Process-local implementation of the background task registry seam
 * (`ctx.tasks`). It keeps every record in memory and hands out fresh
 * snapshots, never live state.
 *
 * Registrations outlive producer and control-surface fibers. Agent or service
 * disposal cancels live work and awaits compliant producers; a throwing
 * teardown cancel force-fails only the record and reports a possible orphan.
 * @module @deepseek-ai/dsh-tasks-local
 */
import { Context } from 'cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { TaskService, TaskId } from '@deepseek-ai/dsh-tasks';
import type { TaskDoneListener, TaskRead, TaskSnapshot, TaskStart } from '@deepseek-ai/dsh-tasks';
/** Timeout code that distinguishes a bounded wait from caller cancellation. */
export declare const TASK_WAIT_TIMEOUT = "TASK_WAIT_TIMEOUT";
/**
 * The in-memory `tasks` registry. See the seam contract in
 * `@deepseek-ai/dsh-tasks` for the ownership, isolation, and lifecycle
 * semantics this implementation honors.
 */
export declare class LocalTaskService extends TaskService {
    private store;
    private counters;
    private surfaces;
    private listeners;
    private listenersClosed;
    /** Owner agents with attached scope cleanup, mapped to the exact disposer. */
    private ownerCleanups;
    /** Service context used by detached settlement continuations and teardown. */
    private readonly selfCtx;
    constructor(ctx: Context);
    start(spec: TaskStart): TaskId;
    list(caller?: Agent): TaskSnapshot[];
    get(id: TaskId, caller?: Agent): TaskSnapshot;
    read(id: TaskId, caller?: Agent): TaskRead;
    kill(id: TaskId, caller?: Agent, reason?: string): 'requested' | 'already-finished';
    wait(id: TaskId, timeoutMs: number, caller?: Agent, signal?: AbortSignal): Promise<TaskSnapshot>;
    onTaskDone(listener: TaskDoneListener): () => void;
    attachSurface(name: string): () => void;
    /** Look up a task or fail loud. */
    private expect;
    /**
     * The isolation fence: a task with an owner is reachable only by callers
     * whose session id matches (`!== undefined` semantics — an unowned task is
     * open, and a no-agent caller can never match an owned one).
     */
    private assertAccess;
    /** Project a fresh read-only snapshot from the mutable record. */
    private snapshot;
    /**
     * Record the first terminal outcome, notify contained listeners, and release
     * waiters. First-wins preserves a teardown force-failure against late producer
     * settlement. Pending waits mark the task reported before listeners run.
     */
    private settle;
    /**
     * Attach one awaited cleanup through the exact owner's scope. This survives
     * producer reloads and joins agent quiescence; the retained disposer lets
     * service teardown detach the cross-fiber effect. Fails when the registry is
     * absent or the owner is not its currently registered instance.
     */
    private ensureOwnerCleanup;
    /** Cancel, await terminal records, and drop every task owned by one exact agent lifecycle. */
    private disposeOwned;
    /**
     * Close listeners, cancel live tasks, await settlement, and detach owner
     * effects. Throwing cancels are force-failed to avoid teardown deadlock.
     */
    private disposeAll;
    /**
     * Cancel tasks during teardown with per-task containment. A throwing cancel
     * force-fails the record and reports a possible orphan; a cancel that returns
     * without settling remains indistinguishable from a slow stop and may stall.
     */
    private cancelForTeardown;
}
export default LocalTaskService;
//# sourceMappingURL=index.d.ts.map