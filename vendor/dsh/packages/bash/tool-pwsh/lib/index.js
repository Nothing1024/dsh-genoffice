import { isAbsolute, resolve } from "node:path";
import z from "schemastery";
import { TOOL_ABORTED, defineTool } from "@deepseek-ai/dsh-tools";
import { HarnessError } from "@deepseek-ai/dsh-llm";
import { parseExitStatus } from "@deepseek-ai/dsh-bash";
//#region lib/types/background.js
/**
* Generic-task adaptation for background pwsh process handles — the shell-agnostic
* twin of `dsh-tool-bash`'s background adaptation.
*
* @module @deepseek-ai/dsh-tool-pwsh/background
*/
/**
* Map a settled background process onto the generic task-outcome vocabulary:
* `killed` stays `killed` (detail: the signal when one is known), everything
* else is `completed` with the exit code as detail. A nonzero command exit is
* reported, not failed, exactly like the foreground rendering.
* @param proc - the settled process handle.
* @returns the outcome for the `ctx.tasks` registration.
*/
function processOutcome(proc) {
	if (proc.status === "killed") return {
		status: "killed",
		detail: proc.signal === null ? "killed before exit" : `signal: ${proc.signal}`
	};
	return {
		status: "completed",
		detail: `exit code: ${proc.exitCode ?? 0}`
	};
}
//#endregion
//#region lib/types/render.js
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
/** Append the truncation notice (with the full-output spill path) to a stream's text. */
function streamText(output) {
	if (!output.truncated) return output.text;
	return `${output.text}\n[output truncated; full output: ${output.spillPath ?? "(unavailable)"}]`;
}
/**
* Shape one finished run into the text the model sees: stdout, then a marked
* stderr section, then exit-status markers, matching the bash tool's story —
* a clean exit (0, no signal) produces no marker.
* @param result - the completed foreground run from the executor.
* @returns the model-facing text: output body (or `(no output)`), then any timeout/signal/exit markers, each on its own line.
*/
function renderPwshResult(result) {
	const out = streamText(result.stdout);
	const err = streamText(result.stderr);
	let body = out;
	if (err.length > 0) {
		if (body.length > 0 && !body.endsWith("\n")) body += "\n";
		body += `[stderr]\n${err}`;
	}
	if (body.length === 0) body = "(no output)";
	const markers = [];
	if (result.timedOut) markers.push(`[timed out after ${result.timeoutMs}ms]`);
	if (result.signal !== null) markers.push(`[killed by signal: ${result.signal}]`);
	else if (result.exitCode !== 0) markers.push(`[exit code: ${result.exitCode}]`);
	if (markers.length === 0) return body;
	if (!body.endsWith("\n")) body += "\n";
	return body + markers.join("\n");
}
/**
* Shape one background-process read into the `task_output` delta the model
* sees: the incremental delta, plus the lossy-read notice (with full-stream
* spill paths) when in-memory truncation dropped unread bytes.
* @param read - one incremental read from the process handle.
* @returns the delta text with any loss notice appended.
*/
function renderPwshProcessRead(read) {
	const notices = [];
	if (read.lossy) {
		const paths = [read.stdoutSpillPath, read.stderrSpillPath].filter((path) => path !== void 0);
		notices.push(`[some output was dropped from memory; full output: ${paths.length > 0 ? paths.join(", ") : "(unavailable)"}]`);
	}
	if (notices.length === 0) return read.delta;
	return `${read.delta}${read.delta.length > 0 && !read.delta.endsWith("\n") ? "\n" : ""}${notices.join("\n")}`;
}
//#endregion
//#region lib/types/index.js
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
const name = "tool-pwsh";
const inject = [
	"tools",
	"bash",
	"systemPrompt",
	"bashEnv"
];
/** Runtime configuration schema for the pwsh tool plugin. */
const Config = z.object({ enableRunInBackground: z.boolean().default(true) });
function validatePwshArgs(args) {
	if (args.command.trim().length === 0) throw new Error("invalid command: expected a non-empty string");
	if (args.description.trim().length === 0) throw new Error("invalid description: expected a non-empty string");
	if (args.timeoutMs !== void 0 && (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0)) throw new Error(`invalid timeoutMs: expected a positive number, got ${JSON.stringify(args.timeoutMs)}`);
}
function pwshDescription(backgroundEnabled) {
	return "Execute a PowerShell command (`pwsh -Command`) and return its stdout/stderr. Each call runs in a fresh pwsh process: no state (cwd, variables, functions) persists between calls — pass `workdir` instead of using `cd`. Paths use native Windows form (`C:\\...`); read environment variables with `$env:NAME`. Non-zero exits are reported as `[exit code: N]`. Current harness environment facts are exposed through managed `$env:DSH_*` variables; inspect them when needed. Long output is truncated to its tail; the full output is saved to a file whose path is reported when available. On Windows a force-killed command settles as `[exit code: 1]` without a signal marker — treat it as an interruption, not a command failure. " + (backgroundEnabled ? "Set `run_in_background: true` for long-running commands: the call returns a task id immediately; read its output with `task_output` and stop it with `task_kill`." : "Background execution is not available; long-running commands must finish within the timeout.");
}
/**
* Resolve an explicit workdir first, making a relative one session-workspace-relative;
* otherwise use the session header cwd and leave executor defaulting as the fallback.
*/
function resolveWorkdir(modelWorkdir, exec) {
	const headerCwd = exec.agent?.session.header.cwd;
	if (modelWorkdir === void 0) return headerCwd;
	if (headerCwd !== void 0 && !isAbsolute(modelWorkdir)) return resolve(headerCwd, modelWorkdir);
	return modelWorkdir;
}
/** Detach the executor DTO from readonly seam interfaces into plain JSON data. */
function canonicalPwshResult(result) {
	const output = (stream) => ({
		text: stream.text,
		truncated: stream.truncated,
		...stream.spillPath !== void 0 ? { spillPath: stream.spillPath } : {}
	});
	return {
		kind: "foreground",
		exitCode: result.exitCode,
		signal: result.signal,
		timedOut: result.timedOut,
		aborted: result.aborted,
		timeoutMs: result.timeoutMs,
		stdout: output(result.stdout),
		stderr: output(result.stderr)
	};
}
/** Canonical background-handle properties shared by the pwsh output union. */
const BACKGROUND_OUTPUT_PROPERTIES = {
	kind: {
		type: "string",
		required: true,
		const: "background"
	},
	taskId: {
		type: "string",
		required: true
	}
};
function apply(ctx, config = {}) {
	const backgroundEnabled = config.enableRunInBackground ?? true;
	ctx.systemPrompt.section({
		name: "tool:pwsh",
		order: 105,
		text: "Non-zero exits are reported as `[exit code: N]` markers; investigate failures before moving on. On Windows a killed process settles as `[exit code: 1]` without a signal marker; treat a bare exit 1 after an interruption as a termination, not a command failure."
	});
	ctx.tools.register(defineTool({
		name: "pwsh",
		description: pwshDescription(backgroundEnabled),
		parameters: {
			command: {
				type: "string",
				required: true,
				description: "The PowerShell command to execute."
			},
			description: {
				type: "string",
				required: true,
				description: "Clear, concise description of what this command does in active voice, 5-10 words (shown in the UI). Examples: \"ls\" → \"List files in current directory\"; \"git status\" → \"Show working tree status\"; \"Get-Process\" → \"List running processes\"."
			},
			timeoutMs: {
				type: "number",
				description: "Timeout in milliseconds. The executor applies its configured default and cap, and kills the command on expiry."
			},
			workdir: {
				type: "string",
				description: "Working directory for this command. Defaults to the session workspace; a relative path is resolved against it."
			},
			...backgroundEnabled ? { run_in_background: {
				type: "boolean",
				description: "Run in the background and return a task id immediately (collect with task_output, stop with task_kill). No timeout applies."
			} } : {}
		},
		output: {
			schema: { oneOf: [{
				type: "object",
				additionalProperties: false,
				properties: BACKGROUND_OUTPUT_PROPERTIES
			}, {
				type: "object",
				additionalProperties: false,
				properties: {
					kind: {
						type: "string",
						required: true,
						const: "foreground"
					},
					exitCode: {
						required: true,
						oneOf: [{ type: "integer" }, { type: "null" }]
					},
					signal: {
						required: true,
						oneOf: [{ type: "string" }, { type: "null" }]
					},
					timedOut: {
						type: "boolean",
						required: true
					},
					aborted: {
						type: "boolean",
						required: true
					},
					timeoutMs: {
						type: "number",
						required: true
					},
					stdout: {
						type: "object",
						additionalProperties: false,
						required: true,
						properties: {
							text: {
								type: "string",
								required: true
							},
							truncated: {
								type: "boolean",
								required: true
							},
							spillPath: { type: "string" }
						}
					},
					stderr: {
						type: "object",
						additionalProperties: false,
						required: true,
						properties: {
							text: {
								type: "string",
								required: true
							},
							truncated: {
								type: "boolean",
								required: true
							},
							spillPath: { type: "string" }
						}
					}
				}
			}] },
			render: (_args, value) => [{
				type: "text",
				text: value.kind === "background" ? `started background task ${value.taskId}` : renderPwshResult(value)
			}]
		},
		async execute(args, exec) {
			validatePwshArgs(args);
			const workdir = resolveWorkdir(args.workdir, exec);
			const request = {
				command: args.command,
				...workdir !== void 0 ? { workdir } : {},
				...args.timeoutMs !== void 0 ? { timeoutMs: args.timeoutMs } : {},
				dshEnv: ctx.bashEnv.collect(exec)
			};
			if (args.run_in_background === true) {
				if (!backgroundEnabled) throw new Error("run_in_background is disabled for this deployment (enableRunInBackground: false)");
				const tasks = ctx.get("tasks");
				if (tasks === void 0) throw new Error("background tasks unavailable: load @deepseek-ai/dsh-tasks and @deepseek-ai/dsh-tool-tasks");
				/* v8 ignore start -- the bash twin's branch is exercised by its sandbox-approval mid-call abort;
				pwsh has no approval surface, and the tool registry's pre-dispatch abort check intercepts
				already-aborted signals first, so this mirror-only guard has no reachable trigger. */
				if (exec.signal.aborted) {
					const error = new HarnessError("tool call aborted", TOOL_ABORTED);
					error.name = "AbortError";
					throw error;
				}
				return {
					kind: "background",
					taskId: tasks.start({
						kind: "pwsh",
						label: args.command,
						...exec.agent ? { owner: exec.agent } : {},
						run: () => {
							const proc = ctx.bash.start(ctx.bash.resolve(request));
							return {
								cancel: () => void proc.kill(),
								done: proc.done.then(() => processOutcome(proc)),
								readOutput: () => {
									return renderPwshProcessRead(proc.readOutput());
								}
							};
						}
					})
				};
			}
			const result = await ctx.bash.run(ctx.bash.resolve({
				...request,
				signal: exec.signal
			}));
			if (result.aborted) {
				const error = new HarnessError("tool call aborted", TOOL_ABORTED);
				error.name = "AbortError";
				throw error;
			}
			return canonicalPwshResult(result);
		},
		presentCall: (args) => {
			if (args.run_in_background === true) return {
				card: "generic",
				title: args.command,
				kind: "execute",
				rawInput: args.command,
				content: [{
					type: "text",
					text: args.description
				}]
			};
			return {
				card: "terminal",
				title: args.command,
				description: args.description,
				...args.workdir !== void 0 ? { cwd: args.workdir } : {}
			};
		},
		presentResult: (args, result) => {
			const block = result.content.length === 1 ? result.content[0] : void 0;
			if (block === void 0 || block.type !== "text") return void 0;
			const raw = block.text;
			if (typeof args === "object" && args !== null && args.run_in_background === true || result.isError) return {
				card: "generic",
				content: [{
					type: "text",
					text: `\`\`\`console\n${raw.replace(/\n+$/, "")}\n\`\`\``
				}]
			};
			const { body, ...exit } = parseExitStatus(raw);
			return {
				card: "terminal",
				output: body,
				...exit
			};
		}
	}));
}
//#endregion
export { Config, apply, inject, name };
