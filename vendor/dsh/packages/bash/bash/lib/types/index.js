/**
 * The `ctx.bash` executor seam for foreground commands and background process
 * handles. Task ids, ownership, polling, and notices belong to
 * `@deepseek-ai/dsh-tasks`, keeping executors independent of sessions.
 * @module @deepseek-ai/dsh-bash
 */
import { Service } from 'cordis';
export { DSH_ENV_PREFIX } from "./types.js";
export { parseExitStatus } from "./render.js";
/**
 * Abstract bash execution service. Subclass, implement the abstract methods,
 * and load the subclass as a plugin — it registers as `ctx.bash` (one
 * implementation per context; loading a second throws, which is cordis'
 * standard duplicate-service behavior).
 *
 * Implementations must honor these semantics:
 * - {@link run} rejects only for infrastructure failures. Nonzero exits,
 *   timeout kills, and abort kills resolve with a {@link BashRunResult}.
 * - {@link start} returns immediately; no timeout applies to background
 *   processes. `done` settles at process close and never rejects; spawn
 *   failures settle as `killed` with the error on stderr.
 * - {@link BashProcess.readOutput} is incremental: consecutive reads never
 *   repeat output. Lossy reads report truncation and available spill files.
 * - A still-running background process is stopped and awaited when its
 *   owning composition tears down. With the subprocess seam that
 *   boundary is `ctx.subprocess` disposal, so a background process survives
 *   an executor-only reload.
 */
export class BashExecutor extends Service {
    constructor(ctx) {
        super(ctx, 'bash');
    }
    /**
     * The sandbox mode this executor applies by default, or `undefined` when it
     * does not sandbox commands.
     * @returns the configured default sandbox mode, when supported.
     */
    get sandboxMode() {
        return undefined;
    }
}
export default BashExecutor;
//# sourceMappingURL=index.js.map