/**
 * Settlement of one ONE-SHOT subagent run into a background-Task outcome. Only
 * the one-shot background path uses Tasks; continuable children have no Task,
 * no per-message result, and no Task cancellation.
 *
 * @module @deepseek-ai/dsh-subagent/run-settlement
 */
import type { TaskOutcome } from '@deepseek-ai/dsh-tasks';
import type { SubagentRun } from './types.ts';
/**
 * Await the child result, dispose the run, then return its task outcome. Result
 * and disposal failures become `failed`; when both fail, both details survive.
 * @param run - live run to settle and release.
 * @returns outcome after child resources are released.
 */
export declare function settleRun(run: SubagentRun): Promise<TaskOutcome>;
//# sourceMappingURL=run-settlement.d.ts.map