/**
 * Model-facing result rendering for the pwsh tool — the PowerShell twin of
 * `dsh-tool-bash`'s renderer minus the sandbox surface: stdout, a marked
 * stderr section, truncation notices with spill paths, then exit-status
 * markers. Non-zero exits are reported, not errored — the model decides how to
 * react; only infrastructure failures (spawn errors, aborts) surface as
 * isError results.
 *
 * @module @deepseek-ai/dsh-tool-pwsh/render
 */
import type { BashProcessRead, CollectedOutput } from '@deepseek-ai/dsh-bash';
/** The renderable foreground result shape (the schema-derived value, no `kind`). */
export interface RenderablePwshResult {
    exitCode: number | null;
    signal: string | null;
    timedOut: boolean;
    timeoutMs: number;
    stdout: CollectedOutput;
    stderr: CollectedOutput;
}
/**
 * Shape one finished run into the text the model sees: stdout, then a marked
 * stderr section, then exit-status markers, matching the bash tool's story —
 * a clean exit (0, no signal) produces no marker.
 * @param result - the completed foreground run from the executor.
 * @returns the model-facing text: output body (or `(no output)`), then any timeout/signal/exit markers, each on its own line.
 */
export declare function renderPwshResult(result: RenderablePwshResult): string;
/**
 * Shape one background-process read into the `task_output` delta the model
 * sees: the incremental delta, plus the lossy-read notice (with full-stream
 * spill paths) when in-memory truncation dropped unread bytes.
 * @param read - one incremental read from the process handle.
 * @returns the delta text with any loss notice appended.
 */
export declare function renderPwshProcessRead(read: BashProcessRead): string;
//# sourceMappingURL=render.d.ts.map