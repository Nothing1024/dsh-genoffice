import { z } from "zod";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region lib/types/index.js
/**
* Model-facing whole-list replacement. Each call appends a `todo/write` snapshot to the calling
* agent's session; replay is last-write-wins, and UIs render from session events. A non-agent
* caller has no owning list and is rejected. Named exports preserve loader injection metadata.
* @module @deepseek-ai/dsh-tool-todo
*/
const name = "tool-todo";
const inject = ["tools"];
/** The valid {@link TodoItem} statuses, as a runtime set for input narrowing. */
const STATUSES = [
	"pending",
	"in_progress",
	"completed"
];
const DESCRIPTION = "Record and update a structured task list for the current work. Send the ENTIRE list every call — it REPLACES the previous list (there are no partial updates, no per-item edits). Use it to plan multi-step work and show progress: add one todo per concrete step before you start. Keep AT MOST ONE todo `in_progress` at a time; while work remains, exactly one active task should be `in_progress`. Mark a todo `completed` the moment it is done (do not batch completions), and allow no `in_progress` item only once all work is complete. Skip the list for trivial single-step tasks. Statuses: `pending` (not started), `in_progress` (being worked on now), `completed` (finished).";
/**
* Validate the value constraints the ParameterSchemaSpec can't express and build the canonical {@link
* TodoItem}[]: trimmed non-empty unique content and at most one in-progress item. The registry
* has already enforced the status enum and rejected unknown item keys (`additionalProperties:
* false` — the logged snapshot must equal what the model believes it wrote, so a nested/extended
* item shape fails loud at the schema boundary instead of silently flattening); the cast below
* records that guarantee.
*/
function toTodoList(raw) {
	const todos = [];
	const seen = /* @__PURE__ */ new Set();
	let inProgress = 0;
	for (const item of raw) {
		const content = item.content.trim();
		if (content.length === 0) throw new Error("invalid todo: `content` must be a non-empty string");
		if (seen.has(content)) throw new Error(`invalid todos: duplicate content ${JSON.stringify(content)}`);
		seen.add(content);
		const status = item.status;
		if (status === "in_progress") inProgress++;
		todos.push({
			content,
			status
		});
	}
	if (inProgress > 1) throw new Error(`invalid todos: at most one task may be in_progress, got ${inProgress}`);
	return todos;
}
/** Wire payload schema of the `todos` projection (whole list or pre-first-write null). */
const todosProjectionSchema = z.union([z.array(z.object({
	content: z.string(),
	status: z.union([
		z.literal("pending"),
		z.literal("in_progress"),
		z.literal("completed")
	])
})), z.null()]);
/** Register the `todo_write` tool on `ctx.tools` and, when the session-projection seam is composed, the `todos` unit. */
function apply(ctx) {
	ctx.inject(["sessionProjections"], (projectionCtx) => {
		projectionCtx.sessionProjections.register({
			key: "todos",
			schema: todosProjectionSchema,
			init: () => {
				return null;
			},
			apply: (state, event) => {
				if (event.type === "todo/write") return event.data.todos;
				if (event.type === "turn/start") return null;
				return state;
			},
			view: (state) => state,
			stateVersion: 2
		});
	});
	ctx.tools.register(defineTool({
		name: "todo_write",
		description: DESCRIPTION,
		parameters: { todos: {
			type: "array",
			required: true,
			description: "The COMPLETE task list, replacing any previous list.",
			items: {
				type: "object",
				additionalProperties: false,
				properties: {
					content: {
						type: "string",
						required: true,
						description: "What the task is — a short imperative line."
					},
					status: {
						type: "string",
						required: true,
						enum: [...STATUSES],
						description: "pending (not started) | in_progress (now) | completed (done)."
					}
				}
			}
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					todos: {
						type: "array",
						required: true,
						items: {
							type: "object",
							additionalProperties: false,
							properties: {
								content: {
									type: "string",
									required: true
								},
								status: {
									type: "string",
									required: true,
									enum: [...STATUSES]
								}
							}
						}
					},
					counts: {
						type: "object",
						additionalProperties: false,
						required: true,
						properties: {
							pending: {
								type: "integer",
								required: true
							},
							inProgress: {
								type: "integer",
								required: true
							},
							completed: {
								type: "integer",
								required: true
							}
						}
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `Updated todo list: ${value.counts.pending} pending, ${value.counts.inProgress} in progress, ${value.counts.completed} completed.`
			}]
		},
		execute(args, exec) {
			const todos = toTodoList(args.todos);
			if (!exec.agent) throw new Error("todo_write requires an owning agent session");
			exec.agent.session.append("todo/write", { todos });
			const count = (status) => todos.filter((t) => t.status === status).length;
			return Promise.resolve({
				todos: todos.map((todo) => ({
					content: todo.content,
					status: todo.status
				})),
				counts: {
					pending: count("pending"),
					inProgress: count("in_progress"),
					completed: count("completed")
				}
			});
		},
		presentCall: (args) => ({
			card: "generic",
			title: "Update todo list",
			kind: "other",
			rawInput: args.todos
		})
	}));
}
//#endregion
export { apply, inject, name };
