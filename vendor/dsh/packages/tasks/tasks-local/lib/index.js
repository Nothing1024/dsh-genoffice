import { deadline, timeoutOf } from "@deepseek-ai/dsh-timeout";
import { TaskId, TaskService } from "@deepseek-ai/dsh-tasks";
//#region lib/types/index.js
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
var __addDisposableResource = function(env, value, async) {
	if (value !== null && value !== void 0) {
		if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
		var dispose, inner;
		if (async) {
			if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
			dispose = value[Symbol.asyncDispose];
		}
		if (dispose === void 0) {
			if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
			dispose = value[Symbol.dispose];
			if (async) inner = dispose;
		}
		if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
		if (inner) dispose = function() {
			try {
				inner.call(this);
			} catch (e) {
				return Promise.reject(e);
			}
		};
		env.stack.push({
			value,
			dispose,
			async
		});
	} else if (async) env.stack.push({ async: true });
	return value;
};
var __disposeResources = (function(SuppressedError) {
	return function(env) {
		function fail(e) {
			env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
			env.hasError = true;
		}
		var r, s = 0;
		function next() {
			while (r = env.stack.pop()) try {
				if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
				if (r.dispose) {
					var result = r.dispose.call(r.value);
					if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
						fail(e);
						return next();
					});
				} else s |= 1;
			} catch (e) {
				fail(e);
			}
			if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
			if (env.hasError) throw env.error;
		}
		return next();
	};
})(typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
	var e = new Error(message);
	return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
/** Timeout code that distinguishes a bounded wait from caller cancellation. */
const TASK_WAIT_TIMEOUT = "TASK_WAIT_TIMEOUT";
/** True for the three terminal {@link TaskStatus} values. */
function isTerminal(status) {
	return status === "completed" || status === "killed" || status === "failed";
}
/**
* The in-memory `tasks` registry. See the seam contract in
* `@deepseek-ai/dsh-tasks` for the ownership, isolation, and lifecycle
* semantics this implementation honors.
*/
var LocalTaskService = class extends TaskService {
	store = /* @__PURE__ */ new Map();
	counters = /* @__PURE__ */ new Map();
	surfaces = /* @__PURE__ */ new Set();
	listeners = /* @__PURE__ */ new Set();
	listenersClosed = false;
	/** Owner agents with attached scope cleanup, mapped to the exact disposer. */
	ownerCleanups = /* @__PURE__ */ new Map();
	/** Service context used by detached settlement continuations and teardown. */
	selfCtx;
	constructor(ctx) {
		super(ctx);
		this.selfCtx = ctx;
		ctx.effect(() => {
			return () => this.disposeAll();
		}, "tasks teardown");
	}
	start(spec) {
		if (this.surfaces.size === 0) throw new Error("background tasks unavailable: no control surface is attached (load @deepseek-ai/dsh-tool-tasks)");
		if (spec.kind.length === 0) throw new Error("invalid task kind: expected a non-empty string");
		if (spec.label.length === 0) throw new Error("invalid task label: expected a non-empty string");
		if (spec.outputLimitBytes !== void 0 && (!Number.isSafeInteger(spec.outputLimitBytes) || spec.outputLimitBytes <= 0)) throw new Error(`invalid outputLimitBytes: expected a positive safe integer, got ${JSON.stringify(spec.outputLimitBytes)}`);
		if (spec.owner !== void 0) this.ensureOwnerCleanup(spec.owner);
		const hooks = spec.run();
		const count = (this.counters.get(spec.kind) ?? 0) + 1;
		this.counters.set(spec.kind, count);
		const id = TaskId(`${spec.kind}-${count}`);
		let markSettled;
		const settled = new Promise((resolve) => {
			markSettled = resolve;
		});
		const task = {
			id,
			kind: spec.kind,
			label: spec.label,
			outputLimitBytes: spec.outputLimitBytes,
			owner: spec.owner,
			cancel: hooks.cancel.bind(hooks),
			readOutput: hooks.readOutput?.bind(hooks),
			status: "running",
			detail: void 0,
			output: void 0,
			startedAt: Date.now(),
			finishedAt: void 0,
			reported: false,
			settled,
			markSettled,
			waiters: 0,
			waitResolvers: /* @__PURE__ */ new Set()
		};
		this.store.set(id, task);
		hooks.done.then((outcome) => {
			this.settle(task, outcome);
		}, (error) => {
			this.selfCtx.logger.warn(`tasks: task ${task.id} 'done' rejected (producer contract violation): ${String(error)}`);
			this.settle(task, {
				status: "failed",
				detail: String(error)
			});
		});
		return id;
	}
	list(caller) {
		const session = caller?.id;
		return [...this.store.values()].filter((task) => task.owner === void 0 || task.owner.id === session).map((task) => this.snapshot(task));
	}
	get(id, caller) {
		const task = this.expect(id);
		this.assertAccess(task, caller);
		return this.snapshot(task);
	}
	read(id, caller) {
		const task = this.expect(id);
		this.assertAccess(task, caller);
		const text = task.readOutput !== void 0 ? task.readOutput() : isTerminal(task.status) ? task.output ?? "" : "";
		if (isTerminal(task.status)) task.reported = true;
		return {
			text,
			snapshot: this.snapshot(task)
		};
	}
	kill(id, caller, reason) {
		const task = this.expect(id);
		this.assertAccess(task, caller);
		if (isTerminal(task.status)) {
			task.reported = true;
			return "already-finished";
		}
		task.cancel(reason);
		task.status = "stopping";
		task.reported = true;
		return "requested";
	}
	async wait(id, timeoutMs, caller, signal) {
		const task = this.expect(id);
		this.assertAccess(task, caller);
		if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error(`invalid wait timeout: expected a positive number of milliseconds, got ${JSON.stringify(timeoutMs)}`);
		if (!isTerminal(task.status)) {
			if (signal?.aborted) throw new Error("wait aborted");
			task.waiters += 1;
			let counted = true;
			const uncount = () => {
				if (!counted) return;
				counted = false;
				task.waiters -= 1;
			};
			try {
				const env_1 = {
					stack: [],
					error: void 0,
					hasError: false
				};
				try {
					const d = __addDisposableResource(env_1, deadline(signal, timeoutMs, TASK_WAIT_TIMEOUT), false);
					await new Promise((resolve, reject) => {
						const onSettled = () => {
							task.waitResolvers.delete(onSettled);
							d.signal.removeEventListener("abort", onAbort);
							resolve();
						};
						const onAbort = () => {
							task.waitResolvers.delete(onSettled);
							if (timeoutOf(d.signal, "TASK_WAIT_TIMEOUT") !== void 0) resolve();
							else if (isTerminal(task.status)) resolve();
							else {
								uncount();
								reject(/* @__PURE__ */ new Error("wait aborted"));
							}
						};
						task.waitResolvers.add(onSettled);
						d.signal.addEventListener("abort", onAbort, { once: true });
					});
				} catch (e_1) {
					env_1.error = e_1;
					env_1.hasError = true;
				} finally {
					__disposeResources(env_1);
				}
			} finally {
				uncount();
			}
		}
		if (isTerminal(task.status)) task.reported = true;
		return this.snapshot(task);
	}
	onTaskDone(listener) {
		const dispose = this.ctx.effect(() => {
			this.listeners.add(listener);
			return () => this.listeners.delete(listener);
		}, "tasks.onTaskDone()");
		return () => void dispose();
	}
	attachSurface(name) {
		const token = Symbol(name);
		const dispose = this.ctx.effect(() => {
			this.surfaces.add(token);
			return () => this.surfaces.delete(token);
		}, "tasks.attachSurface()");
		return () => void dispose();
	}
	/** Look up a task or fail loud. */
	expect(id) {
		const task = this.store.get(id);
		if (task === void 0) throw new Error(`unknown task ${id}`);
		return task;
	}
	/**
	* The isolation fence: a task with an owner is reachable only by callers
	* whose session id matches (`!== undefined` semantics — an unowned task is
	* open, and a no-agent caller can never match an owned one).
	*/
	assertAccess(task, caller) {
		if (task.owner !== void 0 && task.owner.id !== caller?.id) throw new Error(`task ${task.id} belongs to another session`);
	}
	/** Project a fresh read-only snapshot from the mutable record. */
	snapshot(task) {
		const ownerSession = task.owner?.id;
		return {
			id: task.id,
			kind: task.kind,
			label: task.label,
			...task.outputLimitBytes !== void 0 ? { outputLimitBytes: task.outputLimitBytes } : {},
			...ownerSession !== void 0 ? { ownerSession } : {},
			status: task.status,
			...task.detail !== void 0 ? { detail: task.detail } : {},
			startedAt: task.startedAt,
			...task.finishedAt !== void 0 ? { finishedAt: task.finishedAt } : {},
			reported: task.reported
		};
	}
	/**
	* Record the first terminal outcome, notify contained listeners, and release
	* waiters. First-wins preserves a teardown force-failure against late producer
	* settlement. Pending waits mark the task reported before listeners run.
	*/
	settle(task, outcome) {
		if (isTerminal(task.status)) return;
		task.status = outcome.status;
		task.detail = outcome.detail;
		task.output = outcome.output;
		task.finishedAt = Date.now();
		if (task.waiters > 0) task.reported = true;
		if (!this.listenersClosed) {
			const snapshot = this.snapshot(task);
			for (const listener of this.listeners) try {
				const returned = listener(snapshot, task.owner);
				Promise.resolve(returned).catch((error) => {
					this.selfCtx.logger.warn(`tasks: onTaskDone listener rejected for ${task.id}: ${String(error)}`);
				});
			} catch (error) {
				this.selfCtx.logger.warn(`tasks: onTaskDone listener threw for ${task.id}: ${String(error)}`);
			}
		}
		const waitResolvers = [...task.waitResolvers];
		task.waitResolvers.clear();
		for (const resolveWait of waitResolvers) resolveWait();
		task.markSettled();
	}
	/**
	* Attach one awaited cleanup through the exact owner's scope. This survives
	* producer reloads and joins agent quiescence; the retained disposer lets
	* service teardown detach the cross-fiber effect. Fails when the registry is
	* absent or the owner is not its currently registered instance.
	*/
	ensureOwnerCleanup(owner) {
		const ownerId = owner.id;
		const agents = this.selfCtx.get("agents");
		if (agents === void 0) throw new Error("background task ownership requires the agent registry (load @deepseek-ai/dsh-agent)");
		if (agents.get(ownerId) !== owner) throw new Error(`agent "${ownerId}" is not the registered agent instance (background task owner must be live)`);
		if (this.ownerCleanups.has(owner)) return;
		const detach = owner.ctx.effect(() => async () => {
			this.ownerCleanups.delete(owner);
			await this.disposeOwned(owner);
		}, "tasks.ownerCleanup()");
		this.ownerCleanups.set(owner, detach);
	}
	/** Cancel, await terminal records, and drop every task owned by one exact agent lifecycle. */
	async disposeOwned(owner) {
		const owned = [...this.store.values()].filter((task) => task.owner === owner);
		this.cancelForTeardown(owned, "owner disposed");
		await Promise.all(owned.map((task) => task.settled));
		for (const task of owned) this.store.delete(task.id);
	}
	/**
	* Close listeners, cancel live tasks, await settlement, and detach owner
	* effects. Throwing cancels are force-failed to avoid teardown deadlock.
	*/
	async disposeAll() {
		this.listenersClosed = true;
		this.listeners.clear();
		const all = [...this.store.values()];
		this.cancelForTeardown(all, "tasks service disposed");
		await Promise.all(all.map((task) => task.settled));
		this.store.clear();
		const ownerCleanups = [...this.ownerCleanups.values()];
		this.ownerCleanups.clear();
		await Promise.all(ownerCleanups.map((cleanup) => Promise.resolve(cleanup())));
	}
	/**
	* Cancel tasks during teardown with per-task containment. A throwing cancel
	* force-fails the record and reports a possible orphan; a cancel that returns
	* without settling remains indistinguishable from a slow stop and may stall.
	*/
	cancelForTeardown(tasks, reason) {
		for (const task of tasks) {
			if (isTerminal(task.status)) continue;
			try {
				task.cancel(reason);
				task.status = "stopping";
			} catch (error) {
				const detail = `cancel threw during teardown; work may be orphaned: ${String(error)}`;
				this.selfCtx.logger.warn(`tasks: cancel of ${task.id} threw during teardown; task record forced failed and work may be orphaned: ${String(error)}`);
				this.settle(task, {
					status: "failed",
					detail
				});
			}
		}
	}
};
//#endregion
export { LocalTaskService, LocalTaskService as default, TASK_WAIT_TIMEOUT };
