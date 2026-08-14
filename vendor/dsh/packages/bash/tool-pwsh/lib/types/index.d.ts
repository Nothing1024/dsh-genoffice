/**
 * Model-facing `pwsh` tool over the `ctx.bash` executor seam. Intended for
 * Windows compositions where a PowerShell executor (e.g.
 * `@deepseek-ai/dsh-pwsh-local`) backs `ctx.bash`; the tool contract is
 * PowerShell-dialect: native `C:\...` paths and `$env:NAME` variables.
 *
 * Behavior mirrors `dsh-tool-bash` call-for-call minus the sandbox surface:
 * foreground and `run_in_background` execution (background handles register
 * with the generic `ctx.tasks` runtime), the managed `DSH_*` environment
 * through the shared `bash-env` registry, and the bash marker/truncation
 * rendering story. UI presentation mirrors the bash tool's too: a completed
 * foreground call is a terminal card with the parsed exit-status pill, using
 * the shared exit-status parse from `@deepseek-ai/dsh-bash`.
 *
 * @module @deepseek-ai/dsh-tool-pwsh
 */
import type { Context } from 'cordis';
import z from 'schemastery';
declare module '@deepseek-ai/dsh-tasks' {
    interface TaskKindMap {
        pwsh: 'pwsh';
    }
}
export declare const name = "tool-pwsh";
export declare const inject: string[];
/** Configuration for the pwsh tool. */
export interface Config {
    /** Expose `run_in_background` (default true); disabled calls are also rejected. */
    enableRunInBackground?: boolean;
}
/** Runtime configuration schema for the pwsh tool plugin. */
export declare const Config: z<Config>;
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map