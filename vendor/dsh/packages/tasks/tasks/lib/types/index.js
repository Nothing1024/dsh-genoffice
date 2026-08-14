/**
 * The background task registry seam (`ctx.tasks`). It owns the contract for
 * task ids, session-scoped access, lifecycle state, completion listeners, and
 * owner cleanup while producers retain their execution resources. The
 * process-local registry lives in `@deepseek-ai/dsh-tasks-local`.
 * @module @deepseek-ai/dsh-tasks
 */
import { Service } from 'cordis';
export { TaskId } from "./types.js";
/**
 * Abstract background task registry. Subclass, implement the abstract methods,
 * and load the subclass as a plugin — it registers as `ctx.tasks` (one
 * implementation per context; loading a second throws, which is cordis'
 * standard duplicate-service behavior).
 *
 * Implementations must honor these semantics:
 * - Registrations outlive producer and control-surface fibers. Owner and
 *   service disposal cancel live work and await compliant producers; a
 *   throwing teardown cancel force-fails only the record.
 * - Owned-task access is fenced by the owner's session id. Ids are
 *   predictable, so authorization — not secrecy — is the boundary.
 * - Settlement is first-wins: one terminal record, one round of contained
 *   listener notification, and released waiters, even against a late
 *   producer outcome.
 * - {@link start} refuses work while no control surface is attached, so a
 *   producer cannot start work that callers cannot collect or stop.
 */
export class TaskService extends Service {
    constructor(ctx) {
        // `abstract` erases at runtime, and this package name used to be the
        // mountable concrete registry — a stale composition row would otherwise
        // register a ctx.tasks with no method implementations and fail far from
        // the misconfiguration. Fail loud at load instead.
        if (new.target === TaskService) {
            throw new Error('@deepseek-ai/dsh-tasks is the abstract task registry seam; load an implementation such as @deepseek-ai/dsh-tasks-local instead');
        }
        super(ctx, 'tasks');
    }
}
export default TaskService;
//# sourceMappingURL=index.js.map