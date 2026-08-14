/**
 * Code Mode `run_code` transport. Programs call the registry's agent-visible
 * tools through nested executions scheduled under the native concurrency
 * contract; each sub-dispatch is logged for reconstruction, while only the
 * outer curated result enters model history.
 * @module @deepseek-ai/dsh-tools/src/code-mode
 */
import { CallId, HarnessError } from '@deepseek-ai/dsh-llm';
import type { ContentBlock } from '@deepseek-ai/dsh-llm';
import type { CodeRuntime } from '@deepseek-ai/dsh-code-runtime';
import type { CodeDispatchLog, ToolDefinition, ToolRegistry } from './index.ts';
declare module '@deepseek-ai/dsh-session' {
    interface SessionEventMap {
        /**
         * One sub-dispatch STARTING inside a `run_code` program: the parent
         * `run_code` call id, the deterministic sub-call id (`<parent>:code:<n>`,
         * numbered in submission order), and the tool `name` with its
         * JSON-normalized `arguments` — the exact value dispatched, normalized
         * BEFORE dispatch, so this append can never fail on payload shape.
         * Appended when the scheduler actually starts the call (not at
         * submission), so a start means the tool body pipeline was entered; a
         * call abandoned in the queue logs nothing. Log-only: `deriveMessages()`
         * ignores it; UIs use it for live per-sub-call running state and pair it
         * with `tool/code-dispatch` by `subCallId` (timing = the two events'
         * `time` fields).
         */
        'tool/code-dispatch-start': {
            parentCallId: CallId;
            subCallId: CallId;
            name: string;
            arguments: unknown;
        };
        /**
         * One bridged sub-dispatch SETTLING: the pairing ids (matching the
         * `tool/code-dispatch-start` with the same `subCallId`), the tool `name`
         * with the same JSON-normalized `arguments`, and the sub-call's complete
         * model-facing outcome in `tool/result`'s own vocabulary
         * (`content` + `isError`), so UIs render a sub-call through the exact
         * code path that renders a native call. Every started sub-call settles
         * with exactly one of these (abort included: the aborted pipeline result
         * is an `isError` outcome).
         * Log-only: `deriveMessages()` ignores it, so sub-calls never re-enter
         * model context; persistence and UIs get every call. Appended inside the
         * parent `run_code`'s execution (the bridge drains in-flight dispatches
         * before returning), so its execution-enclosure relation holds by
         * construction.
         */
        'tool/code-dispatch': {
            parentCallId: CallId;
            subCallId: CallId;
            name: string;
            arguments: unknown;
            isError: boolean;
            content: ContentBlock[];
        };
    }
}
/** The model-facing name of the Code Mode tool. */
export declare const RUN_CODE_NAME = "run_code";
/** The `tools:sdk` section order: inside the 100–199 tool-guidance band, after per-tool guidance sections. */
export declare const SDK_SECTION_ORDER = 150;
/**
 * Thrown by `run_code` when the program run itself failed — a program
 * exception, a budget expiry, an abort, or substrate death. Extends
 * {@link HarnessError} (`code: 'CODE_RUN_FAILED'`); the registry's execution
 * pipeline converts it into a structured `isError` result whose text carries
 * the failure kind plus the captured logs, so the model can self-correct.
 */
export declare class CodeRunFailedError extends HarnessError {
    constructor(message: string);
}
/**
 * Registry-private capabilities the bridge receives at construction — the
 * `requireRuntime` idiom: operations only the owning registry can mint stay
 * off its public service surface and flow here as closures instead.
 */
export interface RunCodeBridgeOptions {
    /** Resolves `ctx.codeRuntime` or throws the loud misconfiguration error (shared with the registry's assembly-time checks). */
    requireRuntime: () => CodeRuntime;
    /** The run's overlap cap for parallel-classified sub-calls (the registry passes its validated `maxParallelSubCalls`). */
    maxParallel: number;
    /** Runs the contained `tools/code-dispatch-log` waterfall over one settled sub-dispatch (the registry's private invoker). */
    shapeDispatchLog: (dispatch: CodeDispatchLog) => Promise<ContentBlock[]>;
}
/**
 * Build the `run_code` {@link ToolDefinition}: required `code` and
 * `description` parameters, executed through the dispatch bridge described
 * above. The
 * registry reserves it as presentation infrastructure under non-native modes,
 * outside the filterable global/scoped capability layers.
 * @param registry - the owning registry (sub-calls go through its `execute`,
 *   bindings cover its registered tools).
 * @param options - the registry-private capabilities described above.
 * @returns the registry-ready definition.
 */
export declare function createRunCodeTool(registry: ToolRegistry, options: RunCodeBridgeOptions): ToolDefinition;
//# sourceMappingURL=code-mode.d.ts.map