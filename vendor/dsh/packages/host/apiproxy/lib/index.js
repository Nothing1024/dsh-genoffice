import { join, resolve } from "node:path";
import { Service } from "cordis";
import z from "schemastery";
import { randomUUID } from "node:crypto";
import { mkdir, stat } from "node:fs/promises";
import { installAgentLlmTarget } from "@deepseek-ai/dsh-agent";
import { ReasoningEffortId, createUserMessage, errorChain, freezeMessage } from "@deepseek-ai/dsh-llm";
import { isAppendSurfaceEvent, lastActivityTime } from "@deepseek-ai/dsh-session";
import { SessionQueryError } from "@deepseek-ai/dsh-session-query";
import { SubagentError } from "@deepseek-ai/dsh-subagent";
import { WorkspaceId, WorkspaceMoveInvalidError, WorkspaceUnknownSessionError, workspaceDomainState, workspaceRecord } from "@deepseek-ai/dsh-workspace";
import { GoalError } from "@deepseek-ai/dsh-goal";
import { SettingsConflictError, settingsNamespace } from "@deepseek-ai/dsh-settings";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { SessionTitleInvalidError } from "@deepseek-ai/dsh-session-title";
import { z as z$1 } from "zod";
import { UserInteractionError } from "@deepseek-ai/dsh-user-interaction";
import { DirectoryPickerError } from "@deepseek-ai/dsh-host-directory-picker";
import { runNativeCommand } from "@deepseek-ai/dsh-native-command";
//#region lib/types/api/session-search.js
/**
* Return the longest prefix containing at most `maximum` Unicode code points.
* @param value - text to bound.
* @param maximum - non-negative code-point limit.
* @returns `value` unchanged when it fits, otherwise a code-point-safe prefix.
*/
function truncateUnicodeCodePoints(value, maximum) {
	let count = 0;
	let end = 0;
	for (const codePoint of value) {
		if (count === maximum) return value.slice(0, end);
		count++;
		end += codePoint.length;
	}
	return value;
}
//#endregion
//#region lib/types/api/sessions.schema.js
/**
* sessions domain zod schemas (names derived from map keys: sessionListRequestSchema /
* sessionListValueSchema). SessionEvent passthrough = strict envelope (type/seq/time) + wide
* data: the merge-extensible event surface keeps an unknown-type branch at the union level,
* with no field-level passthrough. SessionId brand cast point: sessionIdSchema, and only there.
*/
/** SessionId: one brand cast after shape validation (the only cast point in this domain). */
const sessionIdSchema = z$1.string().min(1);
/** MessageId: one brand cast after non-empty string validation. */
const messageIdSchema$1 = z$1.string().min(1);
/**
* WorkspaceId: the workspace domain's one brand cast. Hosted here rather
* than in workspace.schema because session.create references it while
* workspace.schema references sessionIdSchema — schema modules must stay a
* DAG (both casts used at module top level; a cycle is a load-time TDZ).
*/
const workspaceIdSchema = z$1.string().min(1);
/** SessionEvent passthrough: strict envelope, wide data (the client fold handles unknown types via its documented default). */
const sessionEventSchema = z$1.object({
	type: z$1.string(),
	seq: z$1.number().int().nonnegative(),
	time: z$1.number(),
	data: z$1.unknown(),
	sourceEventSeqs: z$1.array(z$1.number()).optional(),
	surfaceOp: z$1.unknown().optional()
});
/** SessionSummary row of session.list (`projections` reuses the history block's shape and schema). */
const sessionSummarySchema = z$1.object({
	sessionId: sessionIdSchema,
	updatedAt: z$1.number(),
	running: z$1.boolean(),
	blank: z$1.boolean(),
	parentSessionId: sessionIdSchema.optional(),
	origin: z$1.literal("subagent").optional(),
	cwd: z$1.string().optional(),
	projections: z$1.lazy(() => sessionProjectionsBlockSchema).optional()
});
/** session.list request payload (cursor is a reserved seat, unimplemented in v1). */
const sessionListRequestSchema = z$1.object({ cursor: z$1.string().optional() });
/** session.list response value. */
const sessionListValueSchema = z$1.object({ items: z$1.array(sessionSummarySchema) });
/** session.search request payload. */
const sessionSearchRequestSchema = z$1.object({ query: z$1.string().trim().min(1).max(500).refine((query) => !query.includes("\0"), { message: "search query must not contain NUL" }) });
/** One session.search result. */
const sessionSearchItemSchema = z$1.object({
	sessionId: sessionIdSchema,
	snippet: z$1.string().refine((snippet) => truncateUnicodeCodePoints(snippet, 240) === snippet, { message: `search snippet must contain at most 240 Unicode code points` })
});
/** session.search response value. */
const sessionSearchValueSchema = z$1.object({
	items: z$1.array(sessionSearchItemSchema).max(20),
	hasMore: z$1.boolean()
});
/** session.create request payload (at most one of workspaceId / cwd). */
const sessionCreateRequestSchema = z$1.object({
	workspaceId: workspaceIdSchema.optional(),
	cwd: z$1.string().optional(),
	sessionId: sessionIdSchema.optional()
}).refine((payload) => payload.workspaceId === void 0 || payload.cwd === void 0, { message: "session.create accepts workspaceId or cwd, not both" });
/** session.create response value. */
const sessionCreateValueSchema = z$1.object({ sessionId: sessionIdSchema });
/** session.rename request payload (raw title; host-side normalization decides acceptance). */
const sessionRenameRequestSchema = z$1.object({
	sessionId: sessionIdSchema,
	title: z$1.string()
});
/** session.rename response value (the normalized accepted title and its event seq). */
const sessionRenameValueSchema = z$1.object({
	title: z$1.string().min(1),
	seq: z$1.number().int().nonnegative()
});
/** session.fork request payload (atSeq anchors the completed-turn cut). */
const sessionForkRequestSchema = z$1.object({
	sessionId: sessionIdSchema,
	atSeq: z$1.number().int().nonnegative().optional()
});
/** session.fork response value (the child session id). */
const sessionForkValueSchema = z$1.object({ sessionId: sessionIdSchema });
/** session.history request payload (beforeSeq/maxMessages page backwards from the window tail). */
const sessionHistoryRequestSchema = z$1.object({
	sessionId: sessionIdSchema,
	beforeSeq: z$1.number().int().nonnegative().optional(),
	maxMessages: z$1.number().int().positive().optional()
});
/** Complete provider/model target. */
const modelTargetSchema = z$1.object({
	provider: z$1.string().min(1),
	model: z$1.string().min(1),
	reasoningEffort: z$1.string().min(1).optional()
});
/** One adapter-owned reasoning effort. */
const modelReasoningEffortSchema = z$1.object({
	id: z$1.string().min(1),
	name: z$1.string().min(1),
	description: z$1.string().optional()
});
/** Exact-model reasoning metadata. */
const modelReasoningSchema = z$1.object({
	efforts: z$1.array(modelReasoningEffortSchema).min(1),
	defaultEffort: z$1.string().min(1).optional()
});
/** One advisory model entry inside a provider group. */
const modelCatalogModelSchema = z$1.object({
	id: z$1.string().min(1),
	name: z$1.string().min(1),
	description: z$1.string().optional(),
	reasoning: modelReasoningSchema.optional()
});
/** One successfully loaded provider group. */
const modelProviderGroupSchema = z$1.object({
	id: z$1.string().min(1),
	name: z$1.string().min(1),
	models: z$1.array(modelCatalogModelSchema)
});
/** One provider-local catalog failure. */
const modelCatalogFailureSchema = z$1.object({
	id: z$1.string().min(1),
	name: z$1.string().min(1),
	message: z$1.string()
});
/**
* ToolEventView passthrough: lock only the `for` discriminant and the presence
* of a card-tagged `view` object. The view interior is a host-computed product
* the client reads without echoing back; deep-validating it would hand-copy
* the dsh-tools vocabulary into this schema and drift with it.
*/
const toolEventViewSchema = z$1.discriminatedUnion("for", [z$1.object({
	for: z$1.literal("call"),
	view: z$1.looseObject({ card: z$1.string() })
}), z$1.object({
	for: z$1.literal("result"),
	view: z$1.looseObject({ card: z$1.string() })
})]);
/** One session.history item: the session event plus its optional host-computed tool view. */
const historyEntrySchema = z$1.object({
	event: sessionEventSchema,
	view: toolEventViewSchema.optional()
});
/**
* Projection baseline passthrough: `values` stays a wide record — each value
* was already parsed by its provider's own schema on the host side, and
* deep-validating here would import every domain's schema into the carrier.
*/
const sessionProjectionsBlockSchema = z$1.object({
	asOfSeq: z$1.number().int().min(-1),
	values: z$1.record(z$1.string(), z$1.unknown())
});
/** session.history response value (projections rides the tail page only). */
const sessionHistoryValueSchema = z$1.object({
	events: z$1.array(historyEntrySchema),
	hasMore: z$1.boolean(),
	projections: sessionProjectionsBlockSchema.optional()
});
/** session.models request payload. */
const sessionModelsRequestSchema = z$1.object({ sessionId: sessionIdSchema });
/** session.models response value. */
const sessionModelsValueSchema = z$1.object({
	current: modelTargetSchema,
	groups: z$1.array(modelProviderGroupSchema),
	failures: z$1.array(modelCatalogFailureSchema)
});
/** session.selectModel request payload. */
const sessionSelectModelRequestSchema = z$1.object({
	sessionId: sessionIdSchema,
	provider: z$1.string().min(1),
	model: z$1.string().min(1),
	reasoningEffort: z$1.string().min(1).optional()
});
/** session.selectModel response value. */
const sessionSelectModelValueSchema = z$1.object({ selected: modelTargetSchema });
/** ContentBlock passthrough: core is merge-extensible — the type discriminant envelope is strict, the rest stays wide. */
const contentBlockSchema = z$1.looseObject({ type: z$1.string() });
/** session.prompt request payload. */
const sessionPromptRequestSchema = z$1.object({
	sessionId: sessionIdSchema,
	mode: z$1.union([z$1.literal("queue"), z$1.literal("steer")]),
	content: z$1.array(contentBlockSchema)
});
/** session.prompt response value (the command slot appears only when the prompt dispatched a slash command). */
const sessionPromptValueSchema = z$1.object({
	accepted: z$1.literal(true),
	command: z$1.object({
		kind: z$1.literal("success"),
		text: z$1.string().optional()
	}).optional()
});
/** session.updateQueue request payload. */
const sessionUpdateQueueRequestSchema = z$1.object({
	sessionId: sessionIdSchema,
	itemId: messageIdSchema$1,
	action: z$1.discriminatedUnion("kind", [
		z$1.object({
			kind: z$1.literal("edit"),
			content: z$1.array(contentBlockSchema)
		}),
		z$1.object({ kind: z$1.literal("remove") }),
		z$1.object({ kind: z$1.literal("steer") })
	])
});
/** session.updateQueue response value. */
const sessionUpdateQueueValueSchema = z$1.object({ accepted: z$1.literal(true) });
/** session.cancel request payload. */
const sessionCancelRequestSchema = z$1.object({ sessionId: sessionIdSchema });
/** session.cancel response value. */
const sessionCancelValueSchema = z$1.object({ accepted: z$1.literal(true) });
//#endregion
//#region lib/types/api/approvals.schema.js
/**
* approvals domain zod schemas (respond is a client-response; the payload schema serves
* the /api/respond endpoint's second parse after routing via the pending table).
* ApprovalRequestId brand cast point: one.
*/
/** ApprovalRequestId: one brand cast after shape validation (the only cast point in this domain). */
const approvalRequestIdSchema = z$1.string().min(1);
/** Approval answer payload (the result.value slot of a client-response). */
const approvalResponsePayloadSchema = z$1.object({
	sessionId: sessionIdSchema,
	approvalId: approvalRequestIdSchema,
	outcome: z$1.union([z$1.literal("allowed-once"), z$1.literal("rejected")])
});
//#endregion
//#region lib/types/api/questions.schema.js
/**
* questions domain zod schemas (respond is a client-response; the payload schema serves
* the /api/respond endpoint's second parse after routing via the pending table). The question
* identifier is the echoed rpcId; the payload carries no resource id.
*/
/** AskUserQuestionAnswer validated strictly against core dsh-user-interaction. */
const askUserQuestionAnswerSchema = z$1.object({ answers: z$1.array(z$1.object({
	id: z$1.string(),
	selected: z$1.array(z$1.string()),
	custom: z$1.string().optional()
})) });
/** Question answer payload (the result.value slot of a client-response). */
const questionResponsePayloadSchema = z$1.object({
	sessionId: sessionIdSchema,
	answer: askUserQuestionAnswerSchema
});
//#endregion
//#region lib/types/api/rpc.js
/**
* Four-quadrant RPC message model. Channels and messages are decoupled: HTTP,
* WebSocket, and in-process SSE are physical carriers, while logical messages
* are channel-independent and form a four-member discriminated union.
* api/ contract layer: zero Node dependencies, importable from the browser.
*/
/**
* Brands a string as RpcId (same precedent as core `SessionId()`). Minted by the initiator:
* client-request → client mints; server-request → host mints (answerable frames get a stable
* logical id, pure pushes mint a fresh one each time).
* @param id - Raw id string (implementations mint UUIDs; tests may pass fixtures).
* @returns The same string, branded (compile-time cast, zero runtime cost).
*/
function RpcId(id) {
	return id;
}
//#endregion
//#region lib/types/native-path-opener.js
/** Cross-platform native path and text-document openers used by the local GUI carrier. */
/** PowerShell single-quoted literal (doubles embedded quotes). */
function powershellLiteral(path) {
	return `'${path.replace(/'/g, "''")}'`;
}
/** Dispatch one shell-free platform command for the requested open intent. */
async function openNativePathWithIntent(path, signal, intent, internals = {}) {
	const platform = internals.platform ?? process.platform;
	const run = internals.run ?? runNativeCommand;
	if (platform === "darwin") {
		await run("open", intent === "text-editor" ? ["-t", path] : [path], signal);
		return;
	}
	if (platform === "win32") {
		await run("powershell.exe", [
			"-NoProfile",
			"-Command",
			`Invoke-Item -LiteralPath ${powershellLiteral(path)}`
		], signal);
		return;
	}
	if (platform === "linux") {
		await run("xdg-open", [path], signal);
		return;
	}
	throw new Error(`native path opener is unsupported on ${platform}`);
}
/**
* Open a filesystem path with the operating system's default application.
* @param path - absolute or host-resolvable path (caller owns resolution).
* @param signal - caller/connection lifetime; abort terminates the native command.
* @param internals - platform and runner seam for deterministic tests.
*/
function openNativePath(path, signal, internals = {}) {
	return openNativePathWithIntent(path, signal, "default", internals);
}
/**
* Open a text document for editing; macOS bypasses the file-type association
* so a YAML association with a browser cannot consume the gesture.
* @param path - absolute or host-resolvable text-document path.
* @param signal - caller/connection lifetime; abort terminates the native command.
* @param internals - platform and runner seam for deterministic tests.
*/
function openNativeTextFile(path, signal, internals = {}) {
	return openNativePathWithIntent(path, signal, "text-editor", internals);
}
//#endregion
//#region lib/types/api-proxy.js
/**
* Host-side ApiProxy implementation. Signature discipline: unary takes the
* narrow RpcRequest<P> and echoes request.rpcId on the RpcResponse<T>.
*/
/** Page size when history is called without maxMessages. */
const DEFAULT_MAX_MESSAGES = 50;
/** Non-model settings namespaces intentionally served to the Web client. */
const WEB_SETTINGS_NAMESPACES = ["permission"];
/** Provider work budget: at most 100 calls and 2,000 inspected hits. */
const SESSION_SEARCH_PROVIDER_CALL_LIMIT = 100;
/** Bound cold-log stat fan-out and settle each started batch before cancellation returns. */
const COLD_SUMMARY_BATCH_SIZE = 16;
/** Conversation message event types (the pagination counting unit). */
const MESSAGE_TYPES = new Set(["user/message", "assistant/message"]);
/** Product settings intentionally exposed beside model-provider namespaces. */
const PRODUCT_SETTINGS_NAMESPACES = new Set(["ui-onboarding"]);
/** Read live abort state across awaits without treating it as synchronously immutable. */
function isAborted(signal) {
	return signal.aborted;
}
/**
* Message-boundary pagination: count maxMessages append-origin messages
* backwards from the window tail. Replacement copies never entered the
* conversation a reader sees — they restate a shadowed range for the model
* alone — so they consume no quota; the page stays one contiguous raw range,
* which keeps a compaction's log-only provenance on the same page as its
* replacement. The cut is the starting seq of the oldest message group (chunks
* group via sourceEventSeqs — never cut mid-message). The tail page naturally
* includes the in-progress partial.
*/
function paginate(events, beforeSeq, maxMessages) {
	const window = beforeSeq === void 0 ? [...events] : events.filter((event) => event.seq < beforeSeq);
	let count = 0;
	let cut = 0;
	for (let i = window.length - 1; i >= 0; i--) {
		const event = window[i];
		if (!MESSAGE_TYPES.has(event.type) || !isAppendSurfaceEvent(event)) continue;
		count++;
		const sources = event.sourceEventSeqs;
		const groupStart = sources !== void 0 && sources.length > 0 ? Math.min(event.seq, ...sources) : event.seq;
		if (count >= maxMessages) {
			cut = groupStart;
			break;
		}
	}
	return {
		events: window.filter((event) => event.seq >= cut),
		hasMore: cut > 0
	};
}
/** Wrap an ok result echoing the request's rpcId. */
function ok(request, value) {
	return {
		rpcId: request.rpcId,
		result: {
			ok: true,
			value
		}
	};
}
/**
* Build the provider/model catalog over every registered route. Shared by the
* session-scoped `session.models` and host-scoped `llm.models`. Catalog
* membership stays advisory: an unlisted session target remains valid for
* provider dispatch, but is not injected back into the selector after its
* owning catalog stops advertising it. Per-provider failures ride `failures`
* without failing the sound groups; groups that advertise nothing are dropped.
*/
async function buildModelCatalog(ctx) {
	const catalog = await Promise.all(ctx.llm.listProviders().map(async (provider) => {
		try {
			const models = await ctx.llm.listModels(provider.id);
			const entries = await Promise.all(models.map(async (model) => {
				const resolved = await ctx.llm.resolveModelInfo(provider.id, model.id);
				const reasoning = resolved.reasoning === void 0 ? void 0 : {
					efforts: resolved.reasoning.efforts.map((effort) => ({
						id: effort.id,
						name: effort.name,
						...effort.description === void 0 ? {} : { description: effort.description }
					})),
					...resolved.reasoning.defaultEffort === void 0 ? {} : { defaultEffort: resolved.reasoning.defaultEffort }
				};
				return {
					id: model.id,
					name: model.name,
					...model.description === void 0 ? {} : { description: model.description },
					...reasoning !== void 0 ? { reasoning } : {}
				};
			}));
			return {
				kind: "group",
				group: {
					id: provider.id,
					name: provider.name,
					models: entries
				}
			};
		} catch (error) {
			return {
				kind: "failure",
				failure: {
					id: provider.id,
					name: provider.name,
					message: error instanceof Error ? error.message : String(error)
				}
			};
		}
	}));
	return {
		groups: catalog.flatMap((item) => item.kind === "group" ? [item.group] : []).filter((group) => group.models.length > 0),
		failures: catalog.flatMap((item) => item.kind === "failure" ? [item.failure] : [])
	};
}
/** Wrap an error result echoing the request's rpcId. */
function err(request, error) {
	return {
		rpcId: request.rpcId,
		result: {
			ok: false,
			error
		}
	};
}
/** Simple async queue: core callbacks push, the AsyncIterable pulls; abort/return cleans up. */
var FrameQueue = class {
	buffer = [];
	waiter;
	done = false;
	push(item) {
		if (this.done) return;
		this.buffer.push(item);
		this.waiter?.();
	}
	end() {
		this.done = true;
		this.waiter?.();
	}
	async *iterate(signal, cleanup) {
		const onAbort = () => {
			this.end();
		};
		signal.addEventListener("abort", onAbort, { once: true });
		try {
			while (true) {
				while (this.buffer.length > 0) yield this.buffer.shift();
				if (this.done || signal.aborted) return;
				await new Promise((resolve) => {
					this.waiter = resolve;
				});
				this.waiter = void 0;
			}
		} finally {
			signal.removeEventListener("abort", onAbort);
			cleanup();
		}
	}
};
/**
* Server-side frame mint: pure pushes get a fresh rpcId per frame (answerable
* frames — approval/question requested — mint their stable id in their
* pending registries instead).
*/
function frame(payload) {
	return {
		rpcId: RpcId(randomUUID()),
		payload
	};
}
/** Queue the subscription baseline frame. */
function subscribeSession(queue, session) {
	queue.push(frame({
		type: "session/subscribed",
		sessionId: session.id,
		lastSeq: session.seq - 1
	}));
}
/**
* Whether the session's conversation has started: no turn has run yet (a
* turn is one model-loop execution). Standalone plugin events — command
* lifecycle records, plan/mode, titles, goals — never open a turn, so
* running `/plan` or `/goal` on a fresh session keeps it blank
* (list-hidden, reusable).
*/
function sessionBlank(session) {
	return !session.events.some((event) => event.type === "turn/start");
}
/** Shared Session-header projection for list baselines and creation frames. */
function sessionListFields(header) {
	return {
		...header.parentSession === void 0 ? {} : { parentSessionId: header.parentSession },
		...header.origin === void 0 ? {} : { origin: header.origin },
		...header.cwd === void 0 ? {} : { cwd: header.cwd }
	};
}
/** SessionSummary projection for attached (in-memory) sessions. */
function summarize(session, running) {
	return {
		sessionId: session.id,
		updatedAt: lastActivityTime(session.events) ?? session.header.createdAt,
		running,
		blank: sessionBlank(session),
		...sessionListFields(session.header)
	};
}
/**
* SessionSummary projection for cold (persisted, unattached) sessions.
* updatedAt is the log file's mtime; backends without a per-session file
* (locate() undefined) fall back to the header's createdAt.
*/
async function summarizeCold(persistence, meta, signal) {
	signal?.throwIfAborted();
	let updatedAt = meta.createdAt;
	const location = persistence.locate(meta);
	signal?.throwIfAborted();
	if (location !== void 0) {
		try {
			updatedAt = (await stat(location.path)).mtimeMs;
		} catch {}
		signal?.throwIfAborted();
	}
	return {
		sessionId: meta.id,
		updatedAt,
		running: false,
		blank: false,
		...meta.parentSession === void 0 ? {} : { parentSessionId: meta.parentSession },
		...meta.origin === void 0 ? {} : { origin: meta.origin },
		/* v8 ignore next -- the empty arm needs a cwd-less meta, but list()
		filters those out (legacy logs are not served); the conditional mirrors
		summarize() shape. */
		...meta.cwd === void 0 ? {} : { cwd: meta.cwd }
	};
}
/** Map a browse-primitive failure onto the wire error vocabulary (unknown throws stay internal). */
function directoryError(error) {
	if (error instanceof DirectoryPickerError) return {
		code: error.code,
		message: error.message,
		details: { path: error.path }
	};
	return {
		code: "internal",
		message: error instanceof Error ? error.message : String(error),
		details: {}
	};
}
/** Project a pending entry into its answerable mux frame (initial push and mux-open replay share it). */
function requestedFrame(pending) {
	return {
		rpcId: pending.rpcId,
		payload: {
			type: "approval/requested",
			sessionId: pending.sessionId,
			approvalId: pending.approvalId,
			toolName: pending.toolName,
			...pending.callId === void 0 ? {} : { callId: pending.callId },
			...pending.reason === void 0 ? {} : { reason: pending.reason }
		}
	};
}
/** Validate one answer batch against the exact question request it resolves. */
function matchesQuestions(payload, pending) {
	if (payload.sessionId !== pending.sessionId) return false;
	const answers = payload.answer.answers;
	if (answers.length !== pending.questions.length) return false;
	return answers.every((answer, index) => {
		const question = pending.questions[index];
		if (answer.id !== question.id) return false;
		if (new Set(answer.selected).size !== answer.selected.length) return false;
		const custom = answer.custom?.trim();
		if (custom !== void 0 && custom === "") return false;
		if (question.multiSelect !== true) {
			if (custom !== void 0 && answer.selected.length > 0) return false;
			if (answer.selected.length > 1) return false;
		}
		const labels = new Set(question.options?.map((option) => option.label) ?? []);
		return answer.selected.every((label) => labels.has(label));
	});
}
/**
* Compute the render intent for a tool/call or tool/result event through the
* presenters registered at this moment; every other event type gets none. A
* result's presenter needs its call's parsed args — `argsFor` supplies them
* (live: the per-session call table; history: an in-page backscan), returning
* undefined when the pairing is unavailable (e.g. the call fell off the page),
* which soft-falls to no view. Presenter or JSON.parse throws also soft-fall:
* the client's documented default (generic JSON card) covers every miss.
*/
function viewFor(ctx, event, argsFor) {
	try {
		if (event.type === "tool/call") {
			const { name, arguments: raw } = event.data;
			const view = ctx.tools.get(name)?.presentCall?.(JSON.parse(raw));
			return view === void 0 ? void 0 : {
				for: "call",
				view
			};
		}
		if (event.type === "tool/result") {
			const { message, meta } = event.data;
			const [result] = message.content;
			const callId = message.source.callId;
			const call = argsFor(callId);
			if (call === void 0) return void 0;
			const view = ctx.tools.get(call.name)?.presentResult?.(call.args, {
				content: result.content,
				isError: result.isError === true,
				...meta === void 0 ? {} : { meta }
			});
			return view === void 0 ? void 0 : {
				for: "result",
				view
			};
		}
	} catch (error) {
		console.error(`api-proxy: presenter failed for ${event.type}, falling back to generic: ${String(error)}`);
	}
}
/**
* Resolve a tool/result's call pairing by scanning a window of events backwards
* for the matching tool/call. Used by the history path (the page is the
* window — a cross-page pairing soft-falls to no view) and by live-path table
* misses after a reconnect-eviction.
*/
function backscanArgs(events, callId) {
	for (let i = events.length - 1; i >= 0; i--) {
		const event = events[i];
		if (event.type !== "tool/call") continue;
		const data = event.data;
		if (data.callId !== callId) continue;
		try {
			return {
				name: data.name,
				args: JSON.parse(data.arguments)
			};
		} catch {
			return;
		}
	}
}
/** Render one detached history page through the same presenter path as ordinary history. */
function historyPage(ctx, events, beforeSeq, maxMessages) {
	const page = paginate(events, beforeSeq, maxMessages ?? DEFAULT_MAX_MESSAGES);
	return {
		events: page.events.map((event) => {
			const view = viewFor(ctx, event, (callId) => backscanArgs(page.events, callId));
			return {
				event,
				...view === void 0 ? {} : { view }
			};
		}),
		hasMore: page.hasMore
	};
}
/**
* The projection baseline for one history tail page: the registry's
* watermark-cache snapshot — one fully synchronous read (no await between the
* page slice and this), so all values and `asOfSeq` form a single consistent
* cut and `asOfSeq` equals the window tail event seq. The carrier holds zero
* domain knowledge (each value passed its unit's own schema inside the
* registry). An absent registry means the deployment has no projection seam:
* the whole block is absent and clients treat every key as capability-absent.
*/
function projectionsFor(ctx, session) {
	const registry = ctx.get("sessionProjections");
	if (registry === void 0) return void 0;
	return registry.snapshot(session);
}
/**
* The projection baseline of one session.list row, fail-soft: attached
* sessions cut the registry's live watermark cache; cold sessions view the
* persisted projection cache's identity-checked stored rows (zero log loads
* either way — the listing use case the cache exists for). The block shape
* (values + asOfSeq) matches the history tail's, so a client seeds its
* value store under the same higher-seq-wins rule. Any failure — and an
* empty value set — yields an absent block: a listing without projections
* is degraded, never broken.
*/
function listProjectionsFor(ctx, meta, session) {
	try {
		const block = session !== void 0 ? ctx.get("sessionProjections")?.snapshot(session) : ctx.get("sessionProjectionCache")?.cachedSnapshot(meta);
		return block !== void 0 && Object.keys(block.values).length > 0 ? block : void 0;
	} catch (error) {
		ctx.logger.warn(`session.list: projection column for "${meta.id}" failed (serving the row without it): ${String(error)}`);
		return;
	}
}
/** Projection baseline for a detached history tail without Agent activation. */
function detachedProjectionsFor(ctx, events) {
	const registry = ctx.get("sessionProjections");
	if (registry === void 0) return void 0;
	return registry.restore({}, events, 0).snapshot;
}
/** Map continuation admission failures without exposing provider details. */
function subagentPromptError(request, error, signal) {
	const childSessionId = request.payload.childSessionId;
	if (signal.aborted) return err(request, {
		code: "cancelled",
		message: "subagent prompt was cancelled",
		details: {}
	});
	if (error instanceof SubagentError) switch (error.code) {
		case "NOT_RESUMABLE": return err(request, {
			code: "subagent-not-resumable",
			message: "subagent cannot be resumed",
			details: { childSessionId }
		});
		case "UNAUTHORIZED": return err(request, {
			code: "subagent-unauthorized",
			message: "subagent does not belong to this parent",
			details: { childSessionId }
		});
		case "DRAINING":
		case "ACTIVATION_CLOSING":
		case "CONTINUATION_UNAVAILABLE":
		case "PERSISTENCE_UNAVAILABLE": return err(request, {
			code: "subagent-delivery-unavailable",
			message: "subagent follow-up is temporarily unavailable",
			details: { childSessionId }
		});
		default: break;
	}
	return err(request, {
		code: "internal",
		message: "subagent prompt failed",
		details: {}
	});
}
/** Verify one address and mode against the complete direct-child catalog. */
async function catalogChild(ctx, address, signal) {
	const { parentSessionId, childSessionId, mode } = address;
	try {
		const entry = (await ctx.subagents.listChildren(parentSessionId, signal)).find((candidate) => candidate.id === childSessionId);
		if (entry === void 0 || entry.kind === "child" && entry.mode !== mode) return { error: {
			code: "subagent-not-found",
			message: `session "${childSessionId}" is not a ${mode} direct child of "${parentSessionId}"`,
			details: {
				parentSessionId,
				childSessionId
			}
		} };
		if (entry.kind === "diagnostic") return { error: {
			code: "subagent-catalog-diagnostic",
			message: `subagent "${childSessionId}" is ${entry.reason}`,
			details: {
				parentSessionId,
				childSessionId,
				reason: entry.reason
			}
		} };
		return { entry };
	} catch (error) {
		if (signal?.aborted || error instanceof SubagentError && error.code === "CANCELLED" || error instanceof SessionQueryError && error.code === "SESSION_QUERY_ABORTED") return { error: {
			code: "cancelled",
			message: "subagent catalog read was cancelled",
			details: {}
		} };
		if (error instanceof SessionQueryError && error.code === "SESSION_QUERY_SESSION_NOT_FOUND") return { error: {
			code: "subagent-not-found",
			message: `parent session "${parentSessionId}" was not found`,
			details: {
				parentSessionId,
				childSessionId
			}
		} };
		return { error: {
			code: "internal",
			message: "subagent catalog read failed",
			details: {}
		} };
	}
}
/**
* Thrown by the cold-resume path when the id names no servable session
* (absent from the store, or a pre-project legacy log without a cwd).
*/
var SessionNotFound = class extends Error {};
/** Session identity whose lifecycle belongs to subagent routing, not generic Host resume. */
var SubagentSessionOwnership = class extends Error {
	sessionId;
	constructor(sessionId) {
		super(`session "${sessionId}" is a subagent session; use subagent delivery`);
		this.sessionId = sessionId;
	}
};
/** Requested identity already belongs to a session with another project cwd. */
var SessionCwdConflict = class extends Error {
	sessionId;
	requestedCwd;
	existingCwd;
	constructor(sessionId, requestedCwd, existingCwd) {
		super(`session "${sessionId}" already exists with cwd ${JSON.stringify(existingCwd)}; requested ${JSON.stringify(requestedCwd)}`);
		this.sessionId = sessionId;
		this.requestedCwd = requestedCwd;
		this.existingCwd = existingCwd;
	}
};
/** Host failed before the registry could adopt a name-created directory. */
var WorkspaceDirectoryCreationError = class extends Error {};
/** An explicit Host naming operation would duplicate another Workspace title. */
var WorkspaceNameConflictError = class extends Error {
	workspaceName;
	constructor(workspaceName) {
		super(`workspace name '${workspaceName}' is already in use`);
		this.workspaceName = workspaceName;
		this.name = "WorkspaceNameConflictError";
	}
};
/** Shared workspace-not-found error response of the workspace.* mutation rows. */
function workspaceNotFound(request, workspaceId) {
	return err(request, {
		code: "workspace-not-found",
		message: `workspace "${workspaceId}" not found`,
		details: { workspaceId }
	});
}
/** Wire projection of one workspace entity (the workspace.* value row). */
function workspaceView(workspace) {
	return {
		workspaceId: workspace.id,
		path: workspace.path,
		title: workspace.title,
		sessionIds: [...workspace.sessionIds],
		createdAt: workspace.createdAt,
		updatedAt: workspace.updatedAt
	};
}
/** Wire projection of the durable record carried by `domain/changed`. */
function changedWorkspaceView(workspaceId, value) {
	const record = workspaceRecord.parse(value);
	return {
		workspaceId,
		path: record.path,
		title: record.title,
		sessionIds: [...record.sessionIds],
		createdAt: record.createdAt,
		updatedAt: record.updatedAt
	};
}
/**
* Implement ApiProxy over a composed host context.
* @param ctx - a context with the Host spine and Workspace registry mounted.
* @param defaults - host routing and project-directory defaults.
* @returns the ApiProxy implementation.
*/
function createApiProxy(ctx, defaults) {
	const agentOptions = {
		provider: defaults.provider,
		model: defaults.model
	};
	const targets = /* @__PURE__ */ new WeakMap();
	/** Implicit resume of cold sessions, deduplicating concurrent calls (follows the jsonrpc sessionCreations precedent). */
	const resumes = /* @__PURE__ */ new Map();
	/** Client-chosen identity creation/resume, deduplicated across concurrent retries. */
	const sessionCreations = /* @__PURE__ */ new Map();
	/** Serializes path ownership and explicit title checks with Workspace mutations. */
	let workspaceCreationChain = Promise.resolve();
	const pendingQuestions = /* @__PURE__ */ new Map();
	const pendingApprovals = /* @__PURE__ */ new Map();
	const muxQueues = /* @__PURE__ */ new Set();
	/**
	* Install or return the session-local target that prompt assembly snapshots.
	* Seed order: latest logged request/header, else the host default routing.
	* There is no create-time per-session override tier on this wire — if one
	* returns (a create-options contribution), it must fold in between the two.
	*/
	function targetFor(agent) {
		const installed = targets.get(agent);
		if (installed !== void 0) return installed;
		const logged = agent.session.requestHeader()?.config;
		const target = {
			current: logged === void 0 ? {
				provider: defaults.provider,
				model: defaults.model
			} : {
				provider: logged.provider,
				model: logged.model,
				...logged.reasoningEffort === void 0 ? {} : { reasoningEffort: logged.reasoningEffort }
			},
			assembled: void 0
		};
		installAgentLlmTarget(agent.ctx, target);
		targets.set(agent, target);
		return target;
	}
	/** Pre-publication setup used by both fresh and resumed Web agents. */
	function installTarget(agentCtx) {
		const agent = agentCtx.agent;
		if (agent === void 0) throw new Error("api-proxy: agent setup has no scoped agent");
		targetFor(agent);
	}
	/** Send one transient frame to every connected mux consumer. */
	function broadcast(payload) {
		const envelope = frame(payload);
		for (const queue of muxQueues) queue.push(envelope);
	}
	ctx.inject(["sessionProjections"], (projectionCtx) => {
		projectionCtx.sessionProjections.onChanged((session, key, value, seq) => {
			broadcast({
				type: "session/projection",
				sessionId: session.id,
				key,
				value,
				seq
			});
		});
	});
	/** Project both durable inbox lists, optionally including the splice currently being emitted. */
	const queueItems = (agent, splice) => {
		const project = (target) => {
			const messages = target === "next-turn" ? agent.inbox.nextTurn : agent.inbox.nextStep;
			return splice?.target === target ? messages.toSpliced(splice.start, splice.removedCount ?? 0, ...splice.inserted) : messages;
		};
		return [...project("next-turn").map((message) => ({
			id: message.id,
			placement: "queued",
			message
		})), ...project("next-step").map((message) => ({
			id: message.id,
			placement: message.source.kind === "user" ? "steering" : "context",
			message
		}))];
	};
	ctx.on("session/event", (session, event) => {
		if (event.type !== "agent/inbox/spliced") return;
		const agent = ctx.agents.get(session.id);
		if (agent?.session !== session) return;
		broadcast({
			type: "session/queue",
			sessionId: session.id,
			items: queueItems(agent, event.data)
		});
	});
	/** Remove a wait before settling it: synchronous deletion makes the first claimant win. */
	function claimQuestion(pending, outcome) {
		pendingQuestions.delete(pending.rpcId);
		if (pending.signal !== void 0 && pending.onAbort !== void 0) pending.signal.removeEventListener("abort", pending.onAbort);
		broadcast({
			type: "question/resolved",
			sessionId: pending.sessionId,
			questionRpcId: pending.rpcId,
			outcome
		});
	}
	const disposeProvider = ctx.userInteraction.registerProvider({ ask(request) {
		const sessionId = request.agent?.id;
		if (sessionId === void 0) return Promise.reject(new UserInteractionError("web user interaction requires an agent-owned session", "ASK_MISSING_AGENT"));
		return new Promise((resolve, reject) => {
			const rpcId = RpcId(randomUUID());
			const pending = {
				rpcId,
				sessionId,
				questions: request.questions,
				resolve,
				reject,
				...request.signal === void 0 ? {} : { signal: request.signal }
			};
			const onAbort = () => {
				claimQuestion(pending, "cancelled");
				reject(new UserInteractionError("ask_user_question was aborted before the user answered", "ASK_ABORTED"));
			};
			pending.onAbort = onAbort;
			pendingQuestions.set(rpcId, pending);
			request.signal?.addEventListener("abort", onAbort, { once: true });
			const envelope = {
				rpcId,
				payload: {
					type: "question/requested",
					sessionId,
					questions: request.questions
				}
			};
			for (const queue of muxQueues) queue.push(envelope);
		});
	} });
	ctx.effect(() => () => {
		disposeProvider();
		for (const pending of [...pendingQuestions.values()]) {
			claimQuestion(pending, "cancelled");
			pending.reject(new UserInteractionError("web user-interaction provider was disposed", "ASK_ABORTED"));
		}
	}, "api-proxy: user-interaction provider");
	if (ctx.get("approval") !== void 0) {
		ctx.effect(() => () => {
			for (const pending of [...pendingApprovals.values()]) pending.resolve("cancelled");
		}, "api-proxy: approval registry teardown");
		ctx.on("approval/request", (req, next) => {
			if (req.signal?.aborted === true) return Promise.resolve("cancelled");
			const events = req.agent.session.events;
			const claimed = /* @__PURE__ */ new Set();
			for (const entry of pendingApprovals.values()) claimed.add(entry.approvalId);
			const decided = /* @__PURE__ */ new Set();
			let approvalId;
			for (let i = events.length - 1; i >= 0; i -= 1) {
				const event = events[i];
				if (event.type === "approval/decided") decided.add(event.data.id);
				else if (event.type === "approval/asked") {
					if (decided.has(event.data.id) || claimed.has(event.data.id)) continue;
					if ((req.callId ?? null) !== (event.data.callId ?? null)) continue;
					approvalId = event.data.id;
					break;
				}
			}
			if (approvalId === void 0) return next();
			const id = approvalId;
			return new Promise((resolve) => {
				const settle = (outcome) => {
					/* v8 ignore next 3 -- defensive double-settle guard: respond() routes
					through the pending table (a settled id is not-pending before it can
					re-settle) and the first settle removes the abort listener, so no
					reachable path settles twice; kept against future settle callers. */
					if (!pendingApprovals.delete(pending.rpcId)) return;
					req.signal?.removeEventListener("abort", onAbort);
					broadcast({
						type: "approval/resolved",
						sessionId: pending.sessionId,
						approvalId: id,
						outcome
					});
					resolve(outcome);
				};
				const onAbort = () => {
					settle("cancelled");
				};
				const pending = {
					rpcId: RpcId(randomUUID()),
					sessionId: req.agent.session.id,
					approvalId: id,
					toolName: req.toolName,
					...req.callId === void 0 ? {} : { callId: req.callId },
					...req.reason === void 0 ? {} : { reason: req.reason },
					resolve: settle
				};
				pendingApprovals.set(pending.rpcId, pending);
				req.signal?.addEventListener("abort", onAbort, { once: true });
				const envelope = requestedFrame(pending);
				for (const queue of muxQueues) queue.push(envelope);
			});
		});
	}
	/** Whether the session's own suffix carries the durable subagent discriminator. */
	function hasSubagentDescriptor(session) {
		const events = session.events;
		for (let index = session.header.seedLength ?? 0; index < events.length; index += 1) if (events[index]?.type === "subagent/descriptor") return true;
		return false;
	}
	/**
	* Generic Host interaction cannot claim a durably classified subagent or an
	* Agent created through its live parent. The runtime-owner arm also covers
	* descriptor-less child publication windows and older stored headers.
	*/
	function hasSubagentOwner(session, agent) {
		if (session.header.origin === "subagent" || hasSubagentDescriptor(session)) return true;
		const parentId = session.header.parentSession;
		if (parentId === void 0 || agent === void 0) return false;
		const parent = ctx.agents.get(parentId);
		return parent !== void 0 && ctx.agents.isOwnedBy(agent.id, parent);
	}
	/** Stable generic-Host error for an identity reserved to subagent routing. */
	function subagentOwnershipError(sessionId) {
		return {
			code: "agent-busy",
			message: `session "${sessionId}" is owned by subagent routing`,
			details: { reason: "use subagent delivery for this child session" }
		};
	}
	/** Inspect one cold served session without repairing, resuming, or publishing it. */
	async function inspectServable(sessionId) {
		const persistence = ctx.get("sessionPersistence");
		if (persistence === void 0) throw new Error("session persistence is not configured (load a dsh-session-persistence backend)");
		const meta = (await persistence.list()).find((m) => m.id === sessionId);
		if (meta === void 0 || meta.cwd === void 0) throw new SessionNotFound(`session "${sessionId}" not found`);
		const inspected = await persistence.inspect(sessionId);
		if (inspected.meta.cwd === void 0) throw new SessionNotFound(`session "${sessionId}" not found`);
		return {
			meta: inspected.meta,
			events: [...inspected.events]
		};
	}
	/**
	* Resolve one live registered identity through the subagent-ownership
	* fence: subagent-owned agents answer `agent-busy`, plain agents pass.
	* Fences the live agent's own session rather than trusting a
	* "registered ⇒ attached-store" invariant — a registered subagent whose
	* session is ever absent from the attached store must still not be handed
	* out through generic Host routing. `undefined` means no live agent.
	*/
	function fencedLiveAgent(sessionId) {
		const live = ctx.agents.get(sessionId);
		if (live === void 0) return void 0;
		if (hasSubagentOwner(live.session, live)) return { error: subagentOwnershipError(sessionId) };
		return { agent: live };
	}
	async function agentFor(sessionId) {
		const fenced = fencedLiveAgent(sessionId);
		if (fenced !== void 0) return fenced;
		const attached = ctx.sessions.get(sessionId);
		if (attached !== void 0 && hasSubagentOwner(attached, void 0)) return { error: subagentOwnershipError(sessionId) };
		let resume = resumes.get(sessionId);
		if (resume === void 0) {
			resume = (async () => {
				try {
					const inspected = await inspectServable(sessionId);
					if (hasSubagentOwner({
						header: inspected.meta,
						events: inspected.events
					}, void 0)) throw new SubagentSessionOwnership(sessionId);
					const publishedSession = ctx.sessions.get(sessionId);
					const publishedAgent = ctx.agents.get(sessionId);
					if (publishedSession !== void 0 && hasSubagentOwner(publishedSession, publishedAgent)) throw new SubagentSessionOwnership(sessionId);
					return (await ctx.agents.resume({
						resumeSessionId: sessionId,
						agentOptions,
						setup: installTarget
					})).agent;
				} finally {
					resumes.delete(sessionId);
				}
			})();
			resumes.set(sessionId, resume);
		}
		try {
			return { agent: await resume };
		} catch (error) {
			if (error instanceof SessionNotFound) return { error: {
				code: "session-not-found",
				message: error.message,
				details: { sessionId }
			} };
			if (error instanceof SubagentSessionOwnership) return { error: subagentOwnershipError(error.sessionId) };
			const fenced = fencedLiveAgent(sessionId);
			if (fenced !== void 0) return fenced;
			const attached = ctx.sessions.get(sessionId);
			if (attached !== void 0 && hasSubagentOwner(attached, void 0)) return { error: subagentOwnershipError(sessionId) };
			return { error: {
				code: "internal",
				message: `resume failed for session "${sessionId}": ${String(error)}`,
				details: {}
			} };
		}
	}
	/** Read one stable session prefix without acquiring an Agent owner. */
	async function readSessionState(sessionId) {
		const attached = ctx.sessions.get(sessionId);
		if (attached !== void 0) return {
			id: attached.id,
			header: attached.header,
			events: [...attached.events]
		};
		const inspected = await inspectServable(sessionId);
		return {
			id: inspected.meta.id,
			header: inspected.meta,
			events: inspected.events
		};
	}
	/** Resolve the Workspace inherited by a fork without making ordinary loose lineage grouped. */
	async function forkWorkspace(source) {
		const workspaces = ctx.workspace.list();
		const direct = workspaces.find((workspace) => workspace.sessionIds.includes(source.id));
		if (direct !== void 0 || source.header.origin !== "subagent") return direct;
		const lineage = await ctx.sessionQuery.traceSession(source.id);
		for (const ancestor of lineage.ancestors) {
			const workspace = workspaces.find((candidate) => candidate.sessionIds.includes(ancestor.header.id));
			if (workspace !== void 0) return workspace;
		}
	}
	/** Read one transcript cut and optional projection baseline without acquiring an Agent owner. */
	async function historyStateFor(sessionId, includeProjections) {
		const attached = ctx.sessions.get(sessionId);
		if (attached !== void 0) {
			const events = [...attached.events];
			const projections = includeProjections ? projectionsFor(ctx, attached) : void 0;
			return {
				events,
				...projections === void 0 ? {} : { projections }
			};
		}
		const inspected = await inspectServable(sessionId);
		const projections = includeProjections ? detachedProjectionsFor(ctx, inspected.events) : void 0;
		return {
			events: inspected.events,
			...projections === void 0 ? {} : { projections }
		};
	}
	/** Resolve one requested identity to a live agent, creating or resuming it once. */
	async function ensureSession(sessionId, cwd, checkPersistedIdentity) {
		let creation = sessionCreations.get(sessionId);
		if (creation === void 0) {
			creation = (async () => {
				const attached = ctx.sessions.get(sessionId);
				const live = ctx.agents.get(sessionId);
				if (attached !== void 0 && hasSubagentOwner(attached, live)) throw new SubagentSessionOwnership(sessionId);
				if (live !== void 0) return live;
				const persistence = checkPersistedIdentity ? ctx.get("sessionPersistence") : void 0;
				const stored = persistence === void 0 ? void 0 : (await persistence.list()).find((header) => header.id === sessionId);
				if (persistence !== void 0 && stored !== void 0) {
					const inspected = await persistence.inspect(sessionId);
					if (hasSubagentOwner({
						header: inspected.meta,
						events: inspected.events
					}, void 0)) throw new SubagentSessionOwnership(sessionId);
					if (inspected.meta.cwd !== cwd) throw new SessionCwdConflict(sessionId, cwd, inspected.meta.cwd);
					return (await ctx.agents.resume({
						resumeSessionId: sessionId,
						agentOptions,
						setup: installTarget
					})).agent;
				}
				try {
					await mkdir(cwd, { recursive: true });
				} catch (error) {
					throw new Error(`failed to ensure project directory "${cwd}": ${String(error)}`, { cause: error });
				}
				return (await ctx.agents.create({
					sessionId,
					agentOptions,
					meta: { cwd },
					setup: installTarget
				})).agent;
			})().catch((error) => {
				const live = ctx.agents.get(sessionId);
				if (live !== void 0) {
					if (hasSubagentOwner(live.session, live)) throw new SubagentSessionOwnership(sessionId);
					return live;
				}
				const attached = ctx.sessions.get(sessionId);
				if (attached !== void 0 && hasSubagentOwner(attached, void 0)) throw new SubagentSessionOwnership(sessionId);
				throw error;
			}).finally(() => {
				sessionCreations.delete(sessionId);
			});
			sessionCreations.set(sessionId, creation);
		}
		const agent = await creation;
		if (hasSubagentOwner(agent.session, agent)) throw new SubagentSessionOwnership(sessionId);
		if (agent.session.header.cwd !== cwd) throw new SessionCwdConflict(sessionId, cwd, agent.session.header.cwd);
		return agent;
	}
	/** Resolve or create one path while holding the Host's workspace-create chain. */
	function ensureWorkspace(path, title, rejectExistingName = false, createDirectory = false) {
		const operation = workspaceCreationChain.then(async () => {
			if (rejectExistingName && title !== void 0 && ctx.workspace.list().some((workspace) => workspace.title === title)) throw new WorkspaceNameConflictError(title);
			if (createDirectory) try {
				await mkdir(path, { recursive: true });
			} catch (error) {
				throw new WorkspaceDirectoryCreationError(`failed to create workspace directory "${path}": ${String(error)}`);
			}
			const existing = await ctx.workspace.resolveByPath(path);
			if (existing !== void 0) return {
				workspace: existing,
				created: false
			};
			return {
				workspace: await ctx.workspace.create(path, title),
				created: true
			};
		});
		workspaceCreationChain = operation.then(() => void 0, () => void 0);
		return operation;
	}
	/**
	* Build the session.list baseline shared by listing and search visibility.
	* Attached sessions come from memory; servable cold sessions merge from
	* persistence, and the final order is newest-first.
	*/
	async function listVisibleSessionSummaries(signal) {
		signal?.throwIfAborted();
		const items = ctx.sessions.list().map((session) => {
			const agent = ctx.agents.get(session.id);
			const projections = listProjectionsFor(ctx, session.header, session);
			return {
				...summarize(session, agent?.status === "running"),
				...projections === void 0 ? {} : { projections }
			};
		});
		signal?.throwIfAborted();
		const attached = new Set(items.map((item) => item.sessionId));
		const persistence = ctx.get("sessionPersistence");
		if (persistence !== void 0) {
			const cold = (await persistence.list(signal)).filter((meta) => !attached.has(meta.id) && meta.cwd !== void 0);
			signal?.throwIfAborted();
			for (let offset = 0; offset < cold.length; offset += COLD_SUMMARY_BATCH_SIZE) {
				signal?.throwIfAborted();
				const batch = cold.slice(offset, offset + COLD_SUMMARY_BATCH_SIZE);
				const settled = await Promise.allSettled(batch.map(async (meta) => {
					const projections = listProjectionsFor(ctx, meta, void 0);
					return {
						...await summarizeCold(persistence, meta, signal),
						...projections === void 0 ? {} : { projections }
					};
				}));
				const summaries = [];
				let rejected = false;
				let failure;
				for (const result of settled) if (result.status === "fulfilled") summaries.push(result.value);
				else if (!rejected) {
					rejected = true;
					failure = result.reason;
				}
				if (rejected) throw failure;
				signal?.throwIfAborted();
				items.push(...summaries);
			}
		}
		items.sort((a, b) => b.updatedAt - a.updatedAt);
		return items;
	}
	/** Resolve the goal service; absent = the deployment did not compose @deepseek-ai/dsh-goal. */
	function goalService() {
		const goals = ctx.get("goals");
		if (goals === void 0) return { error: {
			code: "internal",
			message: "goal service is absent: this deployment does not mount @deepseek-ai/dsh-goal in its composition (cordis.yml or explicit assembly)",
			details: {}
		} };
		return goals;
	}
	/** Map one goal-domain rejection to the wire error (stable GoalError codes ride in details). */
	function goalError(request, error) {
		const details = error instanceof GoalError ? { goalCode: error.code } : {};
		return err(request, {
			code: "internal",
			message: String(error),
			details
		});
	}
	/** Resolve a session's agent, apply one goal mutation, and acknowledge with the new CAS ref. */
	async function mutateGoal(request, mutation) {
		const goals = goalService();
		if ("error" in goals) return err(request, goals.error);
		const found = await agentFor(request.payload.sessionId);
		if ("error" in found) return err(request, found.error);
		try {
			const ref = mutation(goals, found.agent);
			return ok(request, { ref: {
				id: ref.id,
				revision: ref.revision
			} });
		} catch (error) {
			return goalError(request, error);
		}
	}
	/** Missing-service report shared by the settings domain (skills-domain stance). */
	function settingsAbsent() {
		return {
			code: "internal",
			message: "settings service is absent: this deployment does not mount a settings provider (e.g. @deepseek-ai/dsh-settings-local) in its composition",
			details: {}
		};
	}
	/** Open one Host-resolved target and map native failures onto the wire vocabulary. */
	async function openTarget(request, path, signal, open) {
		try {
			await open(path, signal);
			return ok(request, { opened: true });
		} catch (error) {
			if (signal.aborted) return err(request, {
				code: "cancelled",
				message: "path open was aborted",
				details: {}
			});
			return err(request, {
				code: "internal",
				message: `path open failed: ${error instanceof Error ? error.message : String(error)}`,
				details: {}
			});
		}
	}
	/** Open one Host-resolved path with its default application. */
	function openPath(request, path, signal) {
		return openTarget(request, path, signal, defaults.openPath ?? ((target, openSignal) => openNativePath(target, openSignal)));
	}
	/** Open one Host-resolved text document in a native editor. */
	function openTextFile(request, path, signal) {
		return openTarget(request, path, signal, defaults.openTextFile ?? ((target, openSignal) => openNativeTextFile(target, openSignal)));
	}
	/** Missing-service report shared by the credentials domain. */
	function credentialsAbsent() {
		return {
			code: "internal",
			message: "credentials service is absent: this deployment does not mount a credential provider (e.g. @deepseek-ai/dsh-credentials-local) in its composition",
			details: {}
		};
	}
	/** Map one redacted seam descriptor to its wire view. */
	function namespaceView(descriptor) {
		return {
			ns: String(descriptor.ns),
			schema: descriptor.schema,
			value: descriptor.value,
			...descriptor.base === void 0 ? {} : { base: descriptor.base },
			...descriptor.user === void 0 ? {} : { user: descriptor.user },
			applies: descriptor.applies,
			secrets: (descriptor.secrets ?? []).map((secret) => ({
				path: [...secret.path],
				set: secret.set
			})),
			revision: descriptor.revision
		};
	}
	/** Settings namespaces whose changes can invalidate the model catalog. */
	function modelProviderNamespaces() {
		return new Set(ctx.llm.listConfigurableProviders().map((entry) => entry.settingsNs));
	}
	/**
	* The settings namespaces this proxy serves: configurable model providers
	* plus the small explicit Web preference and product-owned allowlists. The
	* settings seam remains general; a future registration does not become
	* remotely readable or writable by default.
	*/
	function exposedNamespaces() {
		const exposed = modelProviderNamespaces();
		for (const ns of WEB_SETTINGS_NAMESPACES) exposed.add(ns);
		for (const ns of PRODUCT_SETTINGS_NAMESPACES) exposed.add(ns);
		return exposed;
	}
	/** Refuse a namespace outside the explicit configuration-client boundary. */
	function notExposed(request, ns) {
		return err(request, {
			code: "settings-not-exposed",
			message: `settings namespace "${ns}" is not exposed to configuration clients`,
			details: { ns }
		});
	}
	/**
	* Run one settings write (merge or wholesale replace) and acknowledge with
	* the namespace's new redacted view. A namespace outside the configuration
	* boundary is refused before the seam is touched; every seam refusal —
	* unknown or invalid namespace, read-only provider, schema validation,
	* storage — becomes one `settings-rejected` carrying the seam's own message.
	*/
	async function settingsWrite(request, ns, mode, section, expectedRevision) {
		const settings = ctx.get("settings");
		if (settings === void 0) return err(request, settingsAbsent());
		const rejected = (error) => {
			if (error instanceof SettingsConflictError) return err(request, {
				code: "settings-conflict",
				message: error.message,
				details: {
					ns,
					expected: error.expected,
					actual: error.actual
				}
			});
			return err(request, {
				code: "settings-rejected",
				message: error instanceof Error ? error.message : String(error),
				details: { ns }
			});
		};
		let branded;
		try {
			branded = settingsNamespace(ns);
		} catch (error) {
			return rejected(error);
		}
		if (!exposedNamespaces().has(ns)) return notExposed(request, ns);
		try {
			if (mode === "update") await settings.update(branded, section, expectedRevision);
			else if (mode === "replace") await settings.replace(branded, section, expectedRevision);
			else await settings.mutate(branded, section, expectedRevision);
		} catch (error) {
			return rejected(error);
		}
		const descriptor = settings.describe({ redactSecrets: true }).find((candidate) => candidate.ns === branded);
		if (descriptor === void 0) return err(request, {
			code: "internal",
			message: `settings namespace "${ns}" was disposed after the ${mode}`,
			details: {}
		});
		return ok(request, namespaceView(descriptor));
	}
	return {
		sessions: {
			async list(request) {
				return ok(request, { items: await listVisibleSessionSummaries() });
			},
			async search(request, signal) {
				const cancelled = () => err(request, {
					code: "cancelled",
					message: "session search was aborted",
					details: {}
				});
				if (isAborted(signal)) return cancelled();
				const sessionQuery = ctx.get("sessionQuery");
				if (sessionQuery === void 0) return err(request, {
					code: "internal",
					message: "session search is unavailable: this deployment does not mount @deepseek-ai/dsh-session-query",
					details: {}
				});
				try {
					const visible = await listVisibleSessionSummaries(signal);
					if (isAborted(signal)) return cancelled();
					if (visible.length === 0) return ok(request, {
						items: [],
						hasMore: false
					});
					const visibleIds = new Set(visible.map((item) => item.sessionId));
					const authorized = [];
					const acceptedIds = /* @__PURE__ */ new Set();
					const seenCursors = /* @__PURE__ */ new Set();
					let cursor;
					let providerCallCount = 0;
					let providerPageLimit = 20;
					while (authorized.length <= 20) {
						if (isAborted(signal)) return cancelled();
						if (providerCallCount >= SESSION_SEARCH_PROVIDER_CALL_LIMIT) throw new Error(`session search provider exceeded the ${SESSION_SEARCH_PROVIDER_CALL_LIMIT}-call work budget`);
						providerCallCount++;
						const requestedCursor = cursor;
						const requestedPageLimit = providerPageLimit;
						let page;
						try {
							page = await sessionQuery.searchSessions({
								query: request.payload.query,
								eventFilters: [{
									kind: "type",
									values: ["user/message", "assistant/message"]
								}, {
									kind: "surface",
									values: ["current"]
								}],
								limit: requestedPageLimit,
								...requestedCursor === void 0 ? {} : { cursor: requestedCursor }
							}, { signal });
						} catch (error) {
							if (isAborted(signal)) return cancelled();
							if (requestedCursor === void 0 && error instanceof SessionQueryError && error.code === "SESSION_QUERY_INVALID_LIMIT" && requestedPageLimit > 1) {
								providerPageLimit = Math.max(1, Math.floor(requestedPageLimit / 2));
								continue;
							}
							if (requestedCursor !== void 0 && error instanceof SessionQueryError && error.code === "SESSION_QUERY_STALE_CURSOR") {
								authorized.length = 0;
								acceptedIds.clear();
								seenCursors.clear();
								cursor = void 0;
								continue;
							}
							throw error;
						}
						if (isAborted(signal)) return cancelled();
						const providerItemCount = page.items.length;
						if (providerItemCount > requestedPageLimit) throw new Error(`session search provider returned ${providerItemCount} items; maximum is ${requestedPageLimit}`);
						for (const hit of page.items) {
							if (authorized.length > 20) continue;
							if (!visibleIds.has(hit.header.id) || hit.bestMatch.sessionId !== hit.header.id || hit.bestMatch.surface !== "current" || !MESSAGE_TYPES.has(hit.bestMatch.type) || acceptedIds.has(hit.header.id)) continue;
							const snippet = truncateUnicodeCodePoints(hit.bestMatch.snippet, 240);
							acceptedIds.add(hit.header.id);
							authorized.push({
								sessionId: hit.header.id,
								snippet
							});
						}
						const nextCursor = page.nextCursor;
						if (nextCursor !== void 0) {
							if (seenCursors.has(nextCursor)) throw new Error("session search provider repeated a continuation cursor");
							seenCursors.add(nextCursor);
						}
						if (authorized.length > 20 || nextCursor === void 0) break;
						cursor = nextCursor;
					}
					return ok(request, {
						items: authorized.slice(0, 20),
						hasMore: authorized.length > 20
					});
				} catch (error) {
					if (isAborted(signal) || error instanceof SessionQueryError && error.code === "SESSION_QUERY_ABORTED") return cancelled();
					return err(request, {
						code: "internal",
						message: `session search failed: ${String(error)}`,
						details: {}
					});
				}
			},
			async create(request) {
				const sessionId = request.payload.sessionId ?? `session-${randomUUID()}`;
				let workspace;
				if (request.payload.workspaceId !== void 0) {
					workspace = ctx.workspace.get(WorkspaceId(request.payload.workspaceId));
					if (workspace === void 0) return err(request, {
						code: "workspace-not-found",
						message: `workspace "${request.payload.workspaceId}" not found`,
						details: { workspaceId: request.payload.workspaceId }
					});
				}
				const cwd = workspace?.path ?? request.payload.cwd ?? defaults.cwd;
				try {
					await ensureSession(sessionId, cwd, request.payload.sessionId !== void 0);
				} catch (error) {
					if (error instanceof SessionCwdConflict) return err(request, {
						code: "session-conflict",
						message: error.message,
						details: {
							sessionId: error.sessionId,
							requestedCwd: error.requestedCwd,
							...error.existingCwd === void 0 ? {} : { existingCwd: error.existingCwd }
						}
					});
					if (error instanceof SubagentSessionOwnership) return err(request, subagentOwnershipError(error.sessionId));
					return err(request, {
						code: "internal",
						message: `failed to create session "${sessionId}": ${String(error)}`,
						details: {}
					});
				}
				if (workspace !== void 0) try {
					await workspace.attachSession(sessionId);
				} catch (error) {
					return err(request, {
						code: "workspace-attach-failed",
						message: `session "${sessionId}" was created but could not attach to workspace "${workspace.id}": ${String(error)}`,
						details: {
							sessionId,
							workspaceId: workspace.id
						}
					});
				}
				return ok(request, { sessionId });
			},
			async history(request) {
				const { sessionId, beforeSeq, maxMessages } = request.payload;
				let state;
				try {
					state = await historyStateFor(sessionId, beforeSeq === void 0);
				} catch (error) {
					if (error instanceof SessionNotFound) return err(request, {
						code: "session-not-found",
						message: error.message,
						details: { sessionId }
					});
					return err(request, {
						code: "internal",
						message: `history unavailable for session "${sessionId}": ${String(error)}`,
						details: {}
					});
				}
				const page = historyPage(ctx, state.events, beforeSeq, maxMessages);
				return ok(request, {
					events: page.events,
					hasMore: page.hasMore,
					...state.projections === void 0 ? {} : { projections: state.projections }
				});
			},
			async models(request) {
				const { sessionId } = request.payload;
				const found = await agentFor(sessionId);
				if ("error" in found) return err(request, found.error);
				const current = targetFor(found.agent).current;
				const { groups, failures } = await buildModelCatalog(ctx);
				return ok(request, {
					current: { ...current },
					groups,
					failures
				});
			},
			async selectModel(request) {
				const { sessionId, provider, model, reasoningEffort } = request.payload;
				const found = await agentFor(sessionId);
				if ("error" in found) return err(request, found.error);
				try {
					const resolved = await ctx.llm.resolveCallConfig({
						provider,
						model,
						...reasoningEffort === void 0 ? {} : { reasoningEffort: ReasoningEffortId(reasoningEffort) }
					});
					const selected = {
						provider: resolved.provider,
						model: resolved.model,
						...resolved.reasoningEffort === void 0 ? {} : { reasoningEffort: resolved.reasoningEffort }
					};
					targetFor(found.agent).current = selected;
					return ok(request, { selected: { ...selected } });
				} catch (error) {
					return err(request, {
						code: "model-unavailable",
						message: error instanceof Error ? error.message : String(error),
						details: {
							provider,
							model
						}
					});
				}
			},
			async rename(request) {
				const { sessionId, title } = request.payload;
				const found = await agentFor(sessionId);
				if ("error" in found) return err(request, found.error);
				const titles = ctx.get("sessionTitle");
				if (titles === void 0) return err(request, {
					code: "internal",
					message: "renaming is unavailable: this deployment mounts no session-title service",
					details: {}
				});
				try {
					const accepted = titles.rename(found.agent.session, title);
					return ok(request, {
						title: accepted.title,
						seq: accepted.eventSeq
					});
				} catch (error) {
					if (error instanceof SessionTitleInvalidError) return err(request, {
						code: "title-invalid",
						message: error.message,
						details: { sessionId }
					});
					return err(request, {
						code: "internal",
						message: `failed to rename session "${sessionId}": ${String(error)}`,
						details: {}
					});
				}
			},
			async fork(request) {
				const { sessionId, atSeq } = request.payload;
				let source;
				try {
					source = await readSessionState(sessionId);
				} catch (error) {
					if (error instanceof SessionNotFound) return err(request, {
						code: "session-not-found",
						message: error.message,
						details: { sessionId }
					});
					return err(request, {
						code: "internal",
						message: `fork source unavailable for session "${sessionId}": ${String(error)}`,
						details: {}
					});
				}
				const events = source.events;
				const lastSeq = events.at(-1)?.seq ?? -1;
				const boundary = (atSeq === void 0 ? void 0 : events.find((e) => e.type === "turn/end" && e.seq >= atSeq)) ?? (atSeq === void 0 || atSeq > lastSeq ? events.findLast((e) => e.type === "turn/end") : void 0);
				if (boundary === void 0) return err(request, {
					code: "fork-unavailable",
					message: atSeq !== void 0 && atSeq <= lastSeq ? `session "${sessionId}" has not completed the turn containing event ${String(atSeq)}` : `session "${sessionId}" has no completed turn to fork from`,
					details: { sessionId }
				});
				let cut = boundary.seq + 1;
				while (cut < events.length && events[cut]?.type !== "turn/start") cut++;
				let workspace;
				try {
					workspace = await forkWorkspace(source);
				} catch (error) {
					return err(request, {
						code: "internal",
						message: `failed to resolve fork workspace for session "${sessionId}": ${String(error)}`,
						details: {}
					});
				}
				const childId = `session-${randomUUID()}`;
				try {
					await ctx.agents.create({
						sessionId: childId,
						seed: events.slice(0, cut),
						meta: {
							...source.header.cwd === void 0 ? {} : { cwd: source.header.cwd },
							parentSession: source.id,
							seedLength: cut
						},
						agentOptions,
						setup: installTarget
					});
				} catch (error) {
					return err(request, {
						code: "internal",
						message: `failed to fork session "${sessionId}": ${String(error)}`,
						details: {}
					});
				}
				if (workspace !== void 0) try {
					await workspace.attachSession(childId);
				} catch (error) {
					return err(request, {
						code: "workspace-attach-failed",
						message: `session "${childId}" was forked but could not attach to workspace "${workspace.id}": ${String(error)}`,
						details: {
							sessionId: childId,
							workspaceId: workspace.id
						}
					});
				}
				return ok(request, { sessionId: childId });
			},
			async prompt(request) {
				const { sessionId, mode, content } = request.payload;
				const found = await agentFor(sessionId);
				if ("error" in found) return err(request, found.error);
				const agent = found.agent;
				const source = {
					kind: "user",
					rpcId: request.rpcId
				};
				try {
					const message = createUserMessage({
						content,
						source
					});
					if (mode === "steer") agent.steer(message);
					else agent.followup(message);
				} catch (error) {
					return err(request, {
						code: "agent-busy",
						message: "prompt rejected",
						details: { reason: String(error) }
					});
				}
				return ok(request, { accepted: true });
			},
			updateQueue(request) {
				const { sessionId, itemId, action } = request.payload;
				const agent = ctx.agents.get(sessionId);
				if (agent !== void 0 && hasSubagentOwner(agent.session, agent)) return Promise.resolve(err(request, subagentOwnershipError(sessionId)));
				if (agent === void 0) return Promise.resolve(err(request, {
					code: "queue-item-not-found",
					message: "queued item is no longer pending",
					details: { itemId }
				}));
				const target = agent.inbox.nextTurn.some((message) => message.id === itemId) ? "next-turn" : agent.inbox.nextStep.some((message) => message.id === itemId) ? "next-step" : void 0;
				const message = target === void 0 ? void 0 : (target === "next-turn" ? agent.inbox.nextTurn : agent.inbox.nextStep).find((candidate) => candidate.id === itemId);
				if (target === void 0 || message === void 0) return Promise.resolve(err(request, {
					code: "queue-item-not-found",
					message: "queued item is no longer pending",
					details: { itemId }
				}));
				if (action.kind === "steer" && (target !== "next-turn" || agent.status !== "running")) return Promise.resolve(err(request, {
					code: "steer-unavailable",
					message: "current turn no longer accepts steering",
					details: { itemId }
				}));
				if (action.kind === "edit") agent.inbox.replace(itemId, freezeMessage({
					...message,
					content: action.content
				}));
				else {
					agent.inbox.remove(itemId);
					if (action.kind === "steer") agent.steer(message);
				}
				return Promise.resolve(ok(request, { accepted: true }));
			},
			cancel(request) {
				const { sessionId } = request.payload;
				const agent = ctx.agents.get(sessionId);
				if (agent === void 0) return Promise.resolve(err(request, {
					code: "session-not-found",
					message: `session "${sessionId}" not found (not attached)`,
					details: { sessionId }
				}));
				if (hasSubagentOwner(agent.session, agent)) return Promise.resolve(err(request, subagentOwnershipError(sessionId)));
				agent.cancel({ kind: "user" }, { keepInbox: true });
				return Promise.resolve(ok(request, { accepted: true }));
			}
		},
		subagents: {
			async list(request, signal) {
				try {
					return ok(request, {
						entries: (await ctx.subagents.listChildren(request.payload.parentSessionId, signal)).map((entry) => entry.kind === "child" ? {
							...entry,
							activity: ctx.agents.get(entry.id)?.status === "running" ? "running" : "inactive"
						} : entry),
						parentAvailable: ctx.agents.get(request.payload.parentSessionId) !== void 0
					});
				} catch (error) {
					if (signal?.aborted || error instanceof SubagentError && error.code === "CANCELLED" || error instanceof SessionQueryError && error.code === "SESSION_QUERY_ABORTED") return err(request, {
						code: "cancelled",
						message: "subagent catalog read was cancelled",
						details: {}
					});
					return err(request, {
						code: "internal",
						message: "subagent catalog read failed",
						details: {}
					});
				}
			},
			async history(request, signal) {
				const { parentSessionId, childSessionId, mode, beforeSeq, maxMessages } = request.payload;
				const verified = await catalogChild(ctx, {
					parentSessionId,
					childSessionId,
					mode
				}, signal);
				if (verified.error !== void 0) return err(request, verified.error);
				try {
					const snapshot = await ctx.sessionQuery.readSession(childSessionId);
					signal?.throwIfAborted();
					if (snapshot.session.parentSession !== parentSessionId) return err(request, {
						code: "subagent-unauthorized",
						message: "subagent parent changed during history read",
						details: { childSessionId }
					});
					const page = historyPage(ctx, snapshot.events, beforeSeq, maxMessages);
					const projections = beforeSeq === void 0 ? detachedProjectionsFor(ctx, snapshot.events) : void 0;
					return ok(request, {
						...page,
						...projections === void 0 ? {} : { projections }
					});
				} catch (error) {
					if (signal?.aborted || error instanceof SessionQueryError && error.code === "SESSION_QUERY_ABORTED") return err(request, {
						code: "cancelled",
						message: "subagent history read was cancelled",
						details: {}
					});
					if (error instanceof SessionQueryError && error.code === "SESSION_QUERY_SESSION_NOT_FOUND") return err(request, {
						code: "subagent-not-found",
						message: "subagent disappeared during history read",
						details: {
							parentSessionId,
							childSessionId
						}
					});
					return err(request, {
						code: "internal",
						message: "subagent history read failed",
						details: {}
					});
				}
			},
			async prompt(request, signal) {
				const { parentSessionId, childSessionId, content } = request.payload;
				const parent = ctx.agents.get(parentSessionId);
				if (parent === void 0) return err(request, {
					code: "subagent-parent-unavailable",
					message: `parent session "${parentSessionId}" is not live`,
					details: { parentSessionId }
				});
				const verified = await catalogChild(ctx, {
					parentSessionId,
					childSessionId,
					mode: "continuable"
				}, signal);
				if (verified.error !== void 0) return err(request, verified.error);
				try {
					return ok(request, { messageId: await ctx.subagents.followup(parent, childSessionId, content, {
						source: {
							kind: "user",
							rpcId: request.rpcId
						},
						signal
					}) });
				} catch (error) {
					return subagentPromptError(request, error, signal);
				}
			}
		},
		workspace: {
			list(request) {
				return Promise.resolve(ok(request, {
					items: ctx.workspace.list().map(workspaceView),
					archivedSessionIds: [...ctx.workspace.archivedSessionIds]
				}));
			},
			async create(request) {
				const { payload } = request;
				let path;
				if (payload.name !== void 0) {
					const name = payload.name.trim();
					if (name === "" || name === "." || name === ".." || /[/\\]/.test(name)) return err(request, {
						code: "workspace-invalid-path",
						message: `workspace name must be one non-empty path segment, got "${payload.name}"`,
						details: { path: payload.name }
					});
					path = join(defaults.workspaceRoot, name);
				} else path = payload.path;
				try {
					const name = payload.name?.trim();
					const { workspace, created } = await ensureWorkspace(path, name, name !== void 0, name !== void 0);
					return ok(request, {
						workspace: workspaceView(workspace),
						created
					});
				} catch (error) {
					if (error instanceof WorkspaceNameConflictError) return err(request, {
						code: "workspace-name-conflict",
						message: error.message,
						details: { name: error.workspaceName }
					});
					if (error instanceof WorkspaceDirectoryCreationError) return err(request, {
						code: "internal",
						message: error.message,
						details: {}
					});
					return err(request, {
						code: "workspace-invalid-path",
						message: `cannot create a workspace at "${path}": ${error instanceof Error ? error.message : String(error)}`,
						details: { path }
					});
				}
			},
			async rename(request) {
				const { payload } = request;
				const workspace = ctx.workspace.get(WorkspaceId(payload.workspaceId));
				if (workspace === void 0) return workspaceNotFound(request, payload.workspaceId);
				const title = payload.title.trim();
				const operation = workspaceCreationChain.then(async () => {
					if (title === workspace.title) return;
					if (ctx.workspace.list().some((other) => other.id !== workspace.id && other.title === title)) throw new WorkspaceNameConflictError(title);
					await workspace.setTitle(title);
				});
				workspaceCreationChain = operation.then(() => void 0, () => void 0);
				try {
					await operation;
				} catch (error) {
					if (error instanceof WorkspaceNameConflictError) return err(request, {
						code: "workspace-name-conflict",
						message: error.message,
						details: { name: error.workspaceName }
					});
					throw error;
				}
				return ok(request, { workspace: workspaceView(workspace) });
			},
			async delete(request) {
				const { workspaceId } = request.payload;
				const operation = workspaceCreationChain.then(() => ctx.workspace.delete(WorkspaceId(workspaceId)));
				workspaceCreationChain = operation.then(() => void 0, () => void 0);
				if (!await operation) return workspaceNotFound(request, workspaceId);
				return ok(request, { deleted: true });
			},
			async insertSessionBefore(request) {
				const { payload } = request;
				const workspace = ctx.workspace.get(WorkspaceId(payload.workspaceId));
				if (workspace === void 0) return workspaceNotFound(request, payload.workspaceId);
				try {
					await workspace.insertSessionBefore(payload.sessionId, payload.beforeSessionId);
				} catch (error) {
					if (!(error instanceof WorkspaceMoveInvalidError)) throw error;
					return err(request, {
						code: "workspace-move-invalid",
						message: error.message,
						details: {
							workspaceId: payload.workspaceId,
							sessionId: payload.sessionId,
							...payload.beforeSessionId === void 0 ? {} : { beforeSessionId: payload.beforeSessionId }
						}
					});
				}
				return ok(request, { workspace: workspaceView(workspace) });
			},
			async archiveSession(request) {
				const { sessionId } = request.payload;
				try {
					await ctx.workspace.archiveSession(sessionId);
				} catch (error) {
					if (!(error instanceof WorkspaceUnknownSessionError)) throw error;
					return err(request, {
						code: "session-not-found",
						message: error.message,
						details: { sessionId }
					});
				}
				return ok(request, { archivedSessionIds: [...ctx.workspace.archivedSessionIds] });
			}
		},
		host: {
			describe(request) {
				return Promise.resolve(ok(request, {
					version: "0.0.1",
					cwd: defaults.cwd,
					provider: defaults.provider,
					model: defaults.model,
					attachedSessions: ctx.agents.list().length
				}));
			},
			async pickDirectory(request, signal) {
				const capability = ctx.directoryPicker.capability();
				if (capability.kind !== "native") return err(request, {
					code: "directory-picker-unavailable",
					message: `host.pickDirectory needs the native capability; the composed picker serves "${capability.kind}"`,
					details: { capability: capability.kind }
				});
				try {
					return ok(request, { path: await capability.pick(signal) });
				} catch (error) {
					if (signal.aborted) return err(request, {
						code: "cancelled",
						message: "directory picker was aborted",
						details: {}
					});
					return err(request, {
						code: "internal",
						message: `directory picker failed: ${error instanceof Error ? error.message : String(error)}`,
						details: {}
					});
				}
			},
			async listDirectory(request, signal) {
				const capability = ctx.directoryPicker.capability();
				if (capability.kind !== "browse") return err(request, {
					code: "directory-picker-unavailable",
					message: `host.listDirectory needs the browse capability; the composed picker serves "${capability.kind}"`,
					details: { capability: capability.kind }
				});
				try {
					return ok(request, await capability.list(request.payload.path, signal));
				} catch (error) {
					if (signal.aborted) return err(request, {
						code: "cancelled",
						message: "directory listing was aborted",
						details: {}
					});
					return err(request, directoryError(error));
				}
			},
			async createDirectory(request) {
				const capability = ctx.directoryPicker.capability();
				if (capability.kind !== "browse") return err(request, {
					code: "directory-picker-unavailable",
					message: `host.createDirectory needs the browse capability; the composed picker serves "${capability.kind}"`,
					details: { capability: capability.kind }
				});
				try {
					return ok(request, { path: await capability.createDirectory(request.payload.path, request.payload.name) });
				} catch (error) {
					return err(request, directoryError(error));
				}
			},
			async openPath(request, signal) {
				return openPath(request, request.payload.path, signal);
			}
		},
		commands: {
			async list(request) {
				const commands = ctx.get("commands");
				if (commands === void 0) return err(request, {
					code: "internal",
					message: "command registry is absent: this deployment does not mount @deepseek-ai/dsh-commands in its composition (cordis.yml or explicit assembly)",
					details: {}
				});
				const found = await agentFor(request.payload.sessionId);
				if ("error" in found) return err(request, found.error);
				return ok(request, { commands: commands.list(found.agent) });
			},
			async execute(request, signal) {
				const commands = ctx.get("commands");
				if (commands === void 0) return err(request, {
					code: "internal",
					message: "command registry is absent: this deployment does not mount @deepseek-ai/dsh-commands in its composition (cordis.yml or explicit assembly)",
					details: {}
				});
				const { sessionId, line } = request.payload;
				const found = await agentFor(sessionId);
				if ("error" in found) return err(request, found.error);
				try {
					const execution = await commands.execute(found.agent, line, signal);
					return ok(request, execution === void 0 ? { matched: false } : {
						matched: true,
						commandId: execution.commandId
					});
				} catch (error) {
					if (signal.aborted) return err(request, {
						code: "cancelled",
						message: "command execution was aborted",
						details: {}
					});
					return err(request, {
						code: "internal",
						message: `command failed: ${String(error)}`,
						details: {}
					});
				}
			}
		},
		goals: {
			async create(request) {
				const { objective, maxGoalRounds } = request.payload;
				return mutateGoal(request, (goals, agent) => goals.create(agent, {
					objective,
					...maxGoalRounds !== void 0 ? { maxGoalRounds } : {}
				}));
			},
			async edit(request) {
				const { ref, objective, maxGoalRounds } = request.payload;
				return mutateGoal(request, (goals, agent) => goals.edit(agent, ref, {
					...objective !== void 0 ? { objective } : {},
					...maxGoalRounds !== void 0 ? { maxGoalRounds } : {}
				}));
			},
			async pause(request) {
				return mutateGoal(request, (goals, agent) => goals.pause(agent, request.payload.ref));
			},
			async resume(request) {
				return mutateGoal(request, (goals, agent) => goals.resume(agent, request.payload.ref));
			},
			async complete(request) {
				return mutateGoal(request, (goals, agent) => goals.complete(agent, request.payload.ref));
			},
			async clear(request) {
				const goals = goalService();
				if ("error" in goals) return err(request, goals.error);
				const found = await agentFor(request.payload.sessionId);
				if ("error" in found) return err(request, found.error);
				try {
					goals.clear(found.agent, request.payload.ref);
					return ok(request, { cleared: true });
				} catch (error) {
					return goalError(request, error);
				}
			}
		},
		skills: { async list(request) {
			const { sessionId } = request.payload;
			const session = ctx.sessions.get(sessionId);
			if (session === void 0) return err(request, {
				code: "session-not-found",
				message: `session "${sessionId}" not found (not attached)`,
				details: { sessionId }
			});
			if (session.header.cwd === void 0) return err(request, {
				code: "internal",
				message: `session "${sessionId}" has no project cwd`,
				details: {}
			});
			const cwd = session.header.cwd;
			const skillRegistry = ctx.get("skills");
			if (skillRegistry === void 0) return err(request, {
				code: "internal",
				message: "skill registry is absent: this deployment does not mount @deepseek-ai/dsh-skill in its composition (cordis.yml or explicit assembly)",
				details: {}
			});
			try {
				return ok(request, { skills: (await skillRegistry.list({ cwd })).filter((skill) => skill.invocation.modelInvocable && skill.invocation.userInvocable).map((skill) => ({
					name: skill.name,
					description: skill.description,
					...skill.whenToUse === void 0 ? {} : { whenToUse: skill.whenToUse }
				})) });
			} catch (error) {
				return err(request, {
					code: "internal",
					message: `skill listing failed: ${String(error)}`,
					details: {}
				});
			}
		} },
		settings: {
			describe(request) {
				const settings = ctx.get("settings");
				if (settings === void 0) return Promise.resolve(err(request, settingsAbsent()));
				const exposed = exposedNamespaces();
				return Promise.resolve(ok(request, {
					writable: settings.writable,
					hasDocument: settings.documentPath !== void 0,
					namespaces: settings.describe({ redactSecrets: true }).filter((descriptor) => exposed.has(String(descriptor.ns))).map(namespaceView)
				}));
			},
			async openDocument(request, signal) {
				const settings = ctx.get("settings");
				if (settings === void 0) return err(request, settingsAbsent());
				if (isAborted(signal)) return err(request, {
					code: "cancelled",
					message: "settings document open was aborted",
					details: {}
				});
				let path;
				try {
					path = await settings.prepareDocument();
				} catch (error) {
					if (isAborted(signal)) return err(request, {
						code: "cancelled",
						message: "settings document preparation was aborted",
						details: {}
					});
					return err(request, {
						code: "internal",
						message: `settings document preparation failed: ${error instanceof Error ? error.message : String(error)}`,
						details: {}
					});
				}
				if (path === void 0) return err(request, {
					code: "internal",
					message: "settings provider has no local document to open",
					details: {}
				});
				if (isAborted(signal)) return err(request, {
					code: "cancelled",
					message: "settings document open was aborted",
					details: {}
				});
				return openTextFile(request, path, signal);
			},
			update: (request) => settingsWrite(request, request.payload.ns, "update", request.payload.patch, request.payload.expectedRevision),
			replace: (request) => settingsWrite(request, request.payload.ns, "replace", request.payload.section, request.payload.expectedRevision),
			mutate: (request) => settingsWrite(request, request.payload.ns, "mutate", request.payload.ops, request.payload.expectedRevision)
		},
		credentials: {
			async describe(request) {
				const credentials = ctx.get("credentials");
				if (credentials === void 0) return err(request, credentialsAbsent());
				const entries = await Promise.all(request.payload.refs.map(async (ref) => {
					const info = await credentials.describe(credentialRef(ref));
					return [ref, {
						configured: info.configured,
						...info.source === void 0 ? {} : { source: info.source },
						writable: info.writable
					}];
				}));
				return ok(request, { credentials: Object.fromEntries(entries) });
			},
			async set(request) {
				const credentials = ctx.get("credentials");
				if (credentials === void 0) return err(request, credentialsAbsent());
				const { ref, value } = request.payload;
				try {
					await credentials.set(credentialRef(ref), value);
				} catch (error) {
					return err(request, {
						code: "credential-rejected",
						message: error instanceof Error ? error.message : String(error),
						details: { ref }
					});
				}
				return ok(request, {});
			},
			async unset(request) {
				const credentials = ctx.get("credentials");
				if (credentials === void 0) return err(request, credentialsAbsent());
				const { ref } = request.payload;
				try {
					await credentials.unset(credentialRef(ref));
				} catch (error) {
					return err(request, {
						code: "credential-rejected",
						message: error instanceof Error ? error.message : String(error),
						details: { ref }
					});
				}
				return ok(request, {});
			}
		},
		llm: {
			providers(request) {
				const registered = ctx.llm.listProviders();
				const active = new Set(registered.map((provider) => provider.id));
				const directory = ctx.llm.listConfigurableProviders();
				const declared = new Set(directory.map((entry) => entry.provider));
				const views = directory.map((entry) => ({
					provider: entry.provider,
					displayName: entry.displayName,
					settingsNs: entry.settingsNs,
					settingsPath: [...entry.settingsPath],
					active: active.has(entry.provider)
				}));
				for (const provider of registered) {
					if (declared.has(provider.id)) continue;
					views.push({
						provider: provider.id,
						displayName: provider.name,
						settingsNs: "",
						settingsPath: [],
						active: true
					});
				}
				return Promise.resolve(ok(request, { providers: views }));
			},
			async models(request) {
				return ok(request, await buildModelCatalog(ctx));
			},
			async discoverModels(request, signal) {
				const { settingsNs, provider, baseURL, api, apiKey } = request.payload;
				try {
					return ok(request, { models: await ctx.llm.discoverModels(settingsNs, {
						...provider === void 0 ? {} : { provider },
						...baseURL === void 0 ? {} : { baseURL },
						...api === void 0 ? {} : { api },
						...apiKey === void 0 ? {} : { apiKey },
						...signal === void 0 ? {} : { signal }
					}) });
				} catch (error) {
					return err(request, {
						code: "model-discovery-failed",
						message: error instanceof Error ? error.message : String(error),
						details: {
							settingsNs,
							...baseURL === void 0 ? {} : { baseURL }
						}
					});
				}
			}
		},
		events: {
			mux(_request, signal) {
				const queue = new FrameQueue();
				muxQueues.add(queue);
				for (const session of ctx.sessions.list()) subscribeSession(queue, session);
				for (const pending of pendingQuestions.values()) queue.push({
					rpcId: pending.rpcId,
					payload: {
						type: "question/requested",
						sessionId: pending.sessionId,
						questions: pending.questions
					}
				});
				for (const pending of pendingApprovals.values()) queue.push(requestedFrame(pending));
				for (const session of ctx.sessions.list()) {
					const agent = ctx.agents.get(session.id);
					if (agent?.session === session && agent.inbox.hasPending) queue.push(frame({
						type: "session/queue",
						sessionId: session.id,
						items: queueItems(agent)
					}));
				}
				const openCalls = /* @__PURE__ */ new Map();
				const disposers = [
					ctx.on("session/event", (session, event) => {
						if (event.type === "tool/call") {
							const data = event.data;
							try {
								let table = openCalls.get(session.id);
								if (table === void 0) openCalls.set(session.id, table = /* @__PURE__ */ new Map());
								table.set(data.callId, {
									name: data.name,
									args: JSON.parse(data.arguments)
								});
							} catch {}
						} else if (event.type === "turn/end") openCalls.delete(session.id);
						const view = viewFor(ctx, event, (callId) => openCalls.get(session.id)?.get(callId) ?? backscanArgs(session.events, callId));
						queue.push(frame({
							type: "session/event",
							sessionId: session.id,
							event,
							...view === void 0 ? {} : { view }
						}));
					}),
					ctx.on("session/created", (session) => {
						subscribeSession(queue, session);
					}),
					ctx.on("session/disposed", (session) => {
						openCalls.delete(session.id);
					})
				];
				return queue.iterate(signal, () => {
					muxQueues.delete(queue);
					for (const dispose of disposers) dispose();
				});
			},
			host(_request, signal) {
				const queue = new FrameQueue();
				const committedWorkspaceIds = new Set(ctx.workspace.list().map((workspace) => String(workspace.id)));
				let archivedSessionIds = ctx.workspace.archivedSessionIds;
				const disposers = [
					ctx.on("session/created", (session) => {
						queue.push(frame({
							type: "host/session-added",
							sessionId: session.id,
							blank: sessionBlank(session),
							...sessionListFields(session.header)
						}));
					}),
					ctx.on("session/disposed", (session) => {
						queue.push(frame({
							type: "host/session-removed",
							sessionId: session.id
						}));
					}),
					ctx.on("agent/status", ({ agent, status }) => {
						queue.push(frame({
							type: "host/session-status",
							sessionId: agent.id,
							running: status === "running"
						}));
					}),
					ctx.on("agent/error", ({ agent, error }) => {
						queue.push(frame({
							type: "host/agent-error",
							sessionId: agent.id,
							message: errorChain(error)
						}));
					}),
					ctx.on("domain/changed", (change) => {
						if (change.domain !== "workspace") return;
						if (change.table === "") {
							if (change.operation !== "put") return;
							const state = workspaceDomainState.parse(change.value);
							for (const workspaceId of state.workspaceIds) {
								if (committedWorkspaceIds.has(workspaceId)) continue;
								const workspace = ctx.workspace.get(workspaceId);
								if (workspace === void 0) throw new Error(`committed workspace registry references missing workspace "${workspaceId}"`);
								committedWorkspaceIds.add(workspaceId);
								queue.push(frame({
									type: "host/workspace-changed",
									workspace: workspaceView(workspace)
								}));
							}
							if (state.archivedSessionIds.length !== archivedSessionIds.length || state.archivedSessionIds.some((id, index) => id !== archivedSessionIds[index])) {
								archivedSessionIds = state.archivedSessionIds;
								queue.push(frame({
									type: "host/archived-sessions-changed",
									archivedSessionIds: [...state.archivedSessionIds]
								}));
							}
							return;
						}
						if (change.table !== "workspaces") return;
						if (change.operation === "deleted") {
							if (!committedWorkspaceIds.delete(change.key)) return;
							queue.push(frame({
								type: "host/workspace-removed",
								workspaceId: change.key
							}));
							return;
						}
						if (!committedWorkspaceIds.has(change.key)) return;
						queue.push(frame({
							type: "host/workspace-changed",
							workspace: changedWorkspaceView(change.key, change.value)
						}));
					}),
					ctx.on("commands/change", () => {
						queue.push(frame({ type: "host/commands-changed" }));
					}),
					ctx.on("settings/document-updated", (ns) => {
						const name = String(ns);
						queue.push(frame({
							type: "host/settings-changed",
							ns: name
						}));
						if (modelProviderNamespaces().has(name)) queue.push(frame({ type: "host/models-changed" }));
					}),
					ctx.on("credentials/updated", (ref) => {
						queue.push(frame({
							type: "host/credentials-changed",
							ref: String(ref)
						}));
					}),
					ctx.on("llm/adapters-updated", () => {
						queue.push(frame({ type: "host/models-changed" }));
					})
				];
				return queue.iterate(signal, () => {
					for (const dispose of disposers) dispose();
				});
			}
		},
		respond(message) {
			const approval = pendingApprovals.get(message.rpcId);
			if (approval !== void 0) {
				if (!message.result.ok) return Promise.resolve({
					accepted: false,
					reason: "bad-response"
				});
				const parsed = approvalResponsePayloadSchema.safeParse(message.result.value);
				if (!parsed.success || parsed.data.approvalId !== approval.approvalId || parsed.data.sessionId !== approval.sessionId) return Promise.resolve({
					accepted: false,
					reason: "bad-response"
				});
				approval.resolve(parsed.data.outcome);
				return Promise.resolve({ accepted: true });
			}
			const pending = pendingQuestions.get(message.rpcId);
			if (pending === void 0) return Promise.resolve({
				accepted: false,
				reason: "not-pending"
			});
			if (!message.result.ok) {
				if (message.result.error.code !== "cancelled") return Promise.resolve({
					accepted: false,
					reason: "bad-response"
				});
				claimQuestion(pending, "cancelled");
				pending.reject(new UserInteractionError("the user cancelled ask_user_question", "ASK_CANCELLED"));
				return Promise.resolve({ accepted: true });
			}
			const parsed = questionResponsePayloadSchema.safeParse(message.result.value);
			if (!parsed.success) return Promise.resolve({
				accepted: false,
				reason: "bad-response"
			});
			const payload = {
				sessionId: parsed.data.sessionId,
				answer: { answers: parsed.data.answer.answers.map((answer) => ({
					id: answer.id,
					selected: answer.selected,
					...answer.custom === void 0 ? {} : { custom: answer.custom }
				})) }
			};
			if (!matchesQuestions(payload, pending)) return Promise.resolve({
				accepted: false,
				reason: "bad-response"
			});
			claimQuestion(pending, "answered");
			pending.resolve(payload.answer);
			return Promise.resolve({ accepted: true });
		}
	};
}
//#endregion
//#region lib/types/api/rpc.schema.js
/**
* Message-layer zod schemas: the four wire full forms + error body +
* carrier receipt. The payload slot is unknown in the full-form schemas — business payloads
* get a second parse dispatched by method (two-level parse discipline).
* Brand cast point: rpcIdSchema, and only there.
*/
/**
* RpcId: one brand cast after shape validation (the only cast point in this
* file). No min-length: the id is an opaque echo token, and rejecting shapes
* here would only turn a correlatable error report into a client-side parse
* failure (the handler substitutes a sentinel when a request's id is unreadable).
*/
const rpcIdSchema = z$1.string();
/** Error body: discriminated by code, per-branch details aligned to RpcErrorDetailsMap; details is required. */
const rpcErrorSchema = z$1.discriminatedUnion("code", [
	z$1.object({
		code: z$1.literal("bad-request"),
		message: z$1.string(),
		details: z$1.object({ issues: z$1.array(z$1.custom()) })
	}),
	z$1.object({
		code: z$1.literal("cancelled"),
		message: z$1.string(),
		details: z$1.object({})
	}),
	z$1.object({
		code: z$1.literal("session-not-found"),
		message: z$1.string(),
		details: z$1.object({ sessionId: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("model-unavailable"),
		message: z$1.string(),
		details: z$1.object({
			provider: z$1.string(),
			model: z$1.string()
		})
	}),
	z$1.object({
		code: z$1.literal("session-conflict"),
		message: z$1.string(),
		details: z$1.object({
			sessionId: z$1.string(),
			requestedCwd: z$1.string(),
			existingCwd: z$1.string().optional()
		})
	}),
	z$1.object({
		code: z$1.literal("workspace-attach-failed"),
		message: z$1.string(),
		details: z$1.object({
			sessionId: z$1.string(),
			workspaceId: z$1.string()
		})
	}),
	z$1.object({
		code: z$1.literal("workspace-not-found"),
		message: z$1.string(),
		details: z$1.object({ workspaceId: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("workspace-invalid-path"),
		message: z$1.string(),
		details: z$1.object({ path: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("workspace-name-conflict"),
		message: z$1.string(),
		details: z$1.object({ name: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("workspace-move-invalid"),
		message: z$1.string(),
		details: z$1.object({
			workspaceId: z$1.string(),
			sessionId: z$1.string(),
			beforeSessionId: z$1.string().optional()
		})
	}),
	z$1.object({
		code: z$1.literal("directory-unreadable"),
		message: z$1.string(),
		details: z$1.object({ path: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("directory-exists"),
		message: z$1.string(),
		details: z$1.object({ path: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("directory-create-failed"),
		message: z$1.string(),
		details: z$1.object({ path: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("directory-picker-unavailable"),
		message: z$1.string(),
		details: z$1.object({ capability: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("agent-busy"),
		message: z$1.string(),
		details: z$1.object({ reason: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("queue-item-not-found"),
		message: z$1.string(),
		details: z$1.object({ itemId: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("steer-unavailable"),
		message: z$1.string(),
		details: z$1.object({ itemId: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("command-error"),
		message: z$1.string(),
		details: z$1.object({})
	}),
	z$1.object({
		code: z$1.literal("unknown-command"),
		message: z$1.string(),
		details: z$1.object({})
	}),
	z$1.object({
		code: z$1.literal("settings-rejected"),
		message: z$1.string(),
		details: z$1.object({ ns: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("settings-not-exposed"),
		message: z$1.string(),
		details: z$1.object({ ns: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("settings-conflict"),
		message: z$1.string(),
		details: z$1.object({
			ns: z$1.string(),
			expected: z$1.number(),
			actual: z$1.number()
		})
	}),
	z$1.object({
		code: z$1.literal("credential-rejected"),
		message: z$1.string(),
		details: z$1.object({ ref: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("model-discovery-failed"),
		message: z$1.string(),
		details: z$1.object({
			settingsNs: z$1.string(),
			baseURL: z$1.string().optional()
		})
	}),
	z$1.object({
		code: z$1.literal("title-invalid"),
		message: z$1.string(),
		details: z$1.object({ sessionId: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("fork-unavailable"),
		message: z$1.string(),
		details: z$1.object({ sessionId: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("subagent-parent-unavailable"),
		message: z$1.string(),
		details: z$1.object({ parentSessionId: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("subagent-not-found"),
		message: z$1.string(),
		details: z$1.object({
			parentSessionId: z$1.string(),
			childSessionId: z$1.string()
		})
	}),
	z$1.object({
		code: z$1.literal("subagent-catalog-diagnostic"),
		message: z$1.string(),
		details: z$1.object({
			parentSessionId: z$1.string(),
			childSessionId: z$1.string(),
			reason: z$1.union([
				z$1.literal("corrupt"),
				z$1.literal("unsupported"),
				z$1.literal("unavailable")
			])
		})
	}),
	z$1.object({
		code: z$1.literal("subagent-not-resumable"),
		message: z$1.string(),
		details: z$1.object({ childSessionId: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("subagent-unauthorized"),
		message: z$1.string(),
		details: z$1.object({ childSessionId: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("subagent-delivery-unavailable"),
		message: z$1.string(),
		details: z$1.object({ childSessionId: z$1.string() })
	}),
	z$1.object({
		code: z$1.literal("internal"),
		message: z$1.string(),
		details: z$1.object({})
	})
]);
/**
* Business success/failure result schema (generic, reusable).
* @param value - Schema for the business value.
* @returns Schema for RpcResult<T>.
*/
function rpcResultSchema(value) {
	return z$1.union([z$1.object({
		ok: z$1.literal(true),
		value
	}), z$1.object({
		ok: z$1.literal(false),
		error: rpcErrorSchema
	})]);
}
/** ClientRequest full form (payload stays wide — the business layer runs the second parse). */
const clientRequestSchema = z$1.object({
	type: z$1.literal("client-request"),
	rpcId: rpcIdSchema,
	method: z$1.string(),
	payload: z$1.unknown()
});
/** ServerResponse full form (result.value stays wide). */
const serverResponseSchema = z$1.object({
	type: z$1.literal("server-response"),
	rpcId: rpcIdSchema,
	result: rpcResultSchema(z$1.unknown())
});
/** ServerRequest full form (payload stays wide). */
const serverRequestSchema = z$1.object({
	type: z$1.literal("server-request"),
	rpcId: rpcIdSchema,
	method: z$1.string(),
	payload: z$1.unknown()
});
/** ClientResponse full form (result.value stays wide). */
const clientResponseSchema = z$1.object({
	type: z$1.literal("client-response"),
	rpcId: rpcIdSchema,
	result: rpcResultSchema(z$1.unknown())
});
z$1.discriminatedUnion("type", [
	clientRequestSchema,
	serverResponseSchema,
	serverRequestSchema,
	clientResponseSchema
]);
/** Carrier receipt schema. */
const rpcReceiptSchema = z$1.union([z$1.object({ accepted: z$1.literal(true) }), z$1.object({
	accepted: z$1.literal(false),
	reason: z$1.union([z$1.literal("not-pending"), z$1.literal("bad-response")])
})]);
//#endregion
//#region lib/types/api/host.schema.js
/**
* host domain zod schemas (names derived from map keys).
*/
/** host.describe request payload (empty object literal). */
const hostDescribeRequestSchema = z$1.object({});
/** host.describe response value. */
const hostDescribeValueSchema = z$1.object({
	version: z$1.string(),
	cwd: z$1.string(),
	provider: z$1.string().optional(),
	model: z$1.string().optional(),
	attachedSessions: z$1.number().int().nonnegative()
});
/** host.pickDirectory request payload (empty object literal). */
const hostPickDirectoryRequestSchema = z$1.object({});
/** host.pickDirectory response value; null means the user cancelled. */
const hostPickDirectoryValueSchema = z$1.object({ path: z$1.string().nullable() });
/** Directory row shared by listing entries and breadcrumb crumbs. */
const directoryEntrySchema = z$1.object({
	name: z$1.string(),
	path: z$1.string(),
	hidden: z$1.boolean()
});
/** host.listDirectory request payload; an absent path lists the home directory. */
const hostListDirectoryRequestSchema = z$1.object({ path: z$1.string().optional() });
/** host.listDirectory response value. */
const hostListDirectoryValueSchema = z$1.object({
	path: z$1.string(),
	home: z$1.string(),
	crumbs: z$1.array(directoryEntrySchema),
	entries: z$1.array(directoryEntrySchema),
	truncated: z$1.boolean()
});
/** host.createDirectory request payload: name must be one plain path segment. */
const hostCreateDirectoryRequestSchema = z$1.object({
	path: z$1.string(),
	name: z$1.string()
}).refine((payload) => payload.name.trim() !== "" && payload.name !== "." && payload.name !== ".." && !/[/\\]/.test(payload.name), { message: "host.createDirectory requires a single non-blank path segment name" });
/** host.createDirectory response value: the created directory's absolute path. */
const hostCreateDirectoryValueSchema = z$1.object({ path: z$1.string() });
/** host.openPath request payload. */
const hostOpenPathRequestSchema = z$1.object({ path: z$1.string().min(1) });
/** host.openPath response value. */
const hostOpenPathValueSchema = z$1.object({ opened: z$1.literal(true) });
//#endregion
//#region lib/types/api/workspace.schema.js
/**
* workspace domain zod schemas (names derived from map keys). The
* WorkspaceId brand cast lives in sessions.schema (see the note there) and
* is re-exported here as the domain-local name.
*/
/** WorkspaceView row of every workspace.* response. */
const workspaceViewSchema = z$1.object({
	workspaceId: workspaceIdSchema,
	path: z$1.string(),
	title: z$1.string(),
	sessionIds: z$1.array(sessionIdSchema),
	createdAt: z$1.string(),
	updatedAt: z$1.string()
});
/** workspace.list request payload (empty object literal). */
const workspaceListRequestSchema = z$1.object({});
/** workspace.list response value. */
const workspaceListValueSchema = z$1.object({
	items: z$1.array(workspaceViewSchema),
	archivedSessionIds: z$1.array(sessionIdSchema)
});
/** workspace.create request payload: exactly one of path/name (the contract's create spellings). */
const workspaceCreateRequestSchema = z$1.object({
	path: z$1.string().optional(),
	name: z$1.string().optional()
}).refine((payload) => payload.path === void 0 !== (payload.name === void 0), { message: "workspace.create requires exactly one of path / name" });
/** workspace.create response value. */
const workspaceCreateValueSchema = z$1.object({
	workspace: workspaceViewSchema,
	created: z$1.boolean()
});
/** workspace.rename request payload: the new title must be non-blank. */
const workspaceRenameRequestSchema = z$1.object({
	workspaceId: workspaceIdSchema,
	title: z$1.string()
}).refine((payload) => payload.title.trim() !== "", { message: "workspace.rename requires a non-blank title" });
/** workspace.rename response value. */
const workspaceRenameValueSchema = z$1.object({ workspace: workspaceViewSchema });
/** workspace.delete request payload. */
const workspaceDeleteRequestSchema = z$1.object({ workspaceId: workspaceIdSchema });
/** workspace.delete response value. */
const workspaceDeleteValueSchema = z$1.object({ deleted: z$1.literal(true) });
/** workspace.insertSessionBefore request payload (anchor omitted = append to end). */
const workspaceInsertSessionBeforeRequestSchema = z$1.object({
	workspaceId: workspaceIdSchema,
	sessionId: sessionIdSchema,
	beforeSessionId: sessionIdSchema.optional()
});
/** workspace.insertSessionBefore response value. */
const workspaceInsertSessionBeforeValueSchema = z$1.object({ workspace: workspaceViewSchema });
/** workspace.archiveSession request payload. */
const workspaceArchiveSessionRequestSchema = z$1.object({ sessionId: sessionIdSchema });
/** workspace.archiveSession response value: the full updated archive set. */
const workspaceArchiveSessionValueSchema = z$1.object({ archivedSessionIds: z$1.array(sessionIdSchema) });
//#endregion
//#region lib/types/api/commands.schema.js
/**
* commands domain zod schemas (names derived from map keys: commandListRequestSchema /
* commandListValueSchema / commandExecuteRequestSchema / commandExecuteValueSchema).
*/
/** CommandDescriptor row of command.list. */
const commandDescriptorSchema = z$1.object({
	name: z$1.string().min(1),
	description: z$1.string(),
	input: z$1.object({ hint: z$1.string() }).optional()
});
/** command.list request payload. */
const commandListRequestSchema = z$1.object({ sessionId: sessionIdSchema });
/** command.list response value. */
const commandListValueSchema = z$1.object({ commands: z$1.array(commandDescriptorSchema) });
/** command.execute request payload. */
const commandExecuteRequestSchema = z$1.object({
	sessionId: sessionIdSchema,
	line: z$1.string()
});
/** CommandId: one brand cast after shape validation (the only cast point in this domain). */
const commandIdSchema = z$1.string().min(1);
/** command.execute response value: pure admission — outcomes ride the logged
* lifecycle events; commandId (present exactly when matched) correlates with them. */
const commandExecuteValueSchema = z$1.object({
	matched: z$1.boolean(),
	commandId: commandIdSchema.optional()
});
//#endregion
//#region lib/types/api/skills.schema.js
/**
* skills domain zod schemas (names derived from map keys: skillListRequestSchema /
* skillListValueSchema).
*/
/** SkillEntry row of skill.list. */
const skillEntrySchema = z$1.object({
	name: z$1.string().min(1),
	description: z$1.string(),
	whenToUse: z$1.string().optional()
});
/** skill.list request payload. */
const skillListRequestSchema = z$1.object({ sessionId: sessionIdSchema });
/** skill.list response value. */
const skillListValueSchema = z$1.object({ skills: z$1.array(skillEntrySchema) });
//#endregion
//#region lib/types/api/goals.schema.js
/**
* goals domain zod schemas. Mutation-only shapes: every value schema is a
* `{ ref }` acknowledgement (clear: `{ cleared }`) — the current goal state
* travels exclusively on the 'goal' session projection.
*/
/** GoalRef schema. */
const goalRefSchema = z$1.object({
	id: z$1.string(),
	revision: z$1.number().int().positive()
});
/** Shared `{ ref }` acknowledgement value of every non-clear mutation. */
const goalRefValueSchema = z$1.object({ ref: goalRefSchema });
/** goal.create request payload. */
const goalCreateRequestSchema = z$1.object({
	sessionId: z$1.string(),
	objective: z$1.string().min(1),
	maxGoalRounds: z$1.number().int().positive().optional()
});
/** goal.create response value. */
const goalCreateValueSchema = goalRefValueSchema;
/** goal.edit request payload. */
const goalEditRequestSchema = z$1.object({
	sessionId: z$1.string(),
	ref: goalRefSchema,
	objective: z$1.string().min(1).optional(),
	maxGoalRounds: z$1.number().int().positive().optional()
}).refine((value) => value.objective !== void 0 || value.maxGoalRounds !== void 0, { message: "goal.edit requires objective or maxGoalRounds" });
/** goal.edit response value. */
const goalEditValueSchema = goalRefValueSchema;
/** goal.pause request payload. */
const goalPauseRequestSchema = z$1.object({
	sessionId: z$1.string(),
	ref: goalRefSchema
});
/** goal.pause response value. */
const goalPauseValueSchema = goalRefValueSchema;
/** goal.resume request payload. */
const goalResumeRequestSchema = z$1.object({
	sessionId: z$1.string(),
	ref: goalRefSchema
});
/** goal.resume response value. */
const goalResumeValueSchema = goalRefValueSchema;
/** goal.complete request payload. */
const goalCompleteRequestSchema = z$1.object({
	sessionId: z$1.string(),
	ref: goalRefSchema
});
/** goal.complete response value. */
const goalCompleteValueSchema = goalRefValueSchema;
/** goal.clear request payload. */
const goalClearRequestSchema = z$1.object({
	sessionId: z$1.string(),
	ref: goalRefSchema
});
/** goal.clear response value. */
const goalClearValueSchema = z$1.object({ cleared: z$1.literal(true) });
//#endregion
//#region lib/types/api/settings.schema.js
/**
* settings domain zod schemas (names derived from map keys: settingsDescribeRequestSchema /
* settingsDescribeValueSchema / settingsUpdate* / settingsReplace*).
*/
/** One redacted secret slot. */
const settingsSecretViewSchema = z$1.object({
	path: z$1.array(z$1.string()),
	set: z$1.boolean()
});
/** SettingsNamespaceView row of settings.describe and the write responses. */
const settingsNamespaceViewSchema = z$1.object({
	ns: z$1.string().min(1),
	schema: z$1.unknown(),
	value: z$1.unknown(),
	base: z$1.unknown().optional(),
	user: z$1.unknown().optional(),
	applies: z$1.union([z$1.literal("live"), z$1.literal("restart")]),
	secrets: z$1.array(settingsSecretViewSchema),
	revision: z$1.number()
});
/** settings.describe request payload. */
const settingsDescribeRequestSchema = z$1.object({});
/** settings.describe response value. */
const settingsDescribeValueSchema = z$1.object({
	writable: z$1.boolean(),
	hasDocument: z$1.boolean(),
	namespaces: z$1.array(settingsNamespaceViewSchema)
});
/** settings.openDocument request payload. */
const settingsOpenDocumentRequestSchema = z$1.object({});
/** settings.openDocument response value. */
const settingsOpenDocumentValueSchema = z$1.object({ opened: z$1.literal(true) });
/** settings.update request payload. */
const settingsUpdateRequestSchema = z$1.object({
	ns: z$1.string().min(1),
	patch: z$1.record(z$1.string(), z$1.unknown()),
	expectedRevision: z$1.number().optional()
});
/** settings.update response value: the namespace's new redacted view. */
const settingsUpdateValueSchema = settingsNamespaceViewSchema;
/** settings.replace request payload. */
const settingsReplaceRequestSchema = z$1.object({
	ns: z$1.string().min(1),
	section: z$1.record(z$1.string(), z$1.unknown()),
	expectedRevision: z$1.number().optional()
});
/** One path-addressed edit of settings.mutate. */
const settingsPathOpSchema = z$1.discriminatedUnion("op", [z$1.object({
	op: z$1.literal("set"),
	path: z$1.array(z$1.string()),
	value: z$1.unknown()
}), z$1.object({
	op: z$1.literal("unset"),
	path: z$1.array(z$1.string())
})]);
/** settings.mutate request payload. */
const settingsMutateRequestSchema = z$1.object({
	ns: z$1.string().min(1),
	ops: z$1.array(settingsPathOpSchema),
	expectedRevision: z$1.number().optional()
});
/** settings.mutate response value: the namespace's new redacted view. */
const settingsMutateValueSchema = settingsNamespaceViewSchema;
/** settings.replace response value. */
const settingsReplaceValueSchema = settingsNamespaceViewSchema;
//#endregion
//#region lib/types/api/credentials.schema.js
/**
* credentials domain zod schemas (names derived from map keys:
* credentialsDescribeRequestSchema / credentialsDescribeValueSchema / …).
* The reference-name pattern mirrors the seam's `credentialRef` guard so an
* invalid name fails as `bad-request` before reaching the service.
*/
/** POSIX-portable environment-variable name (the seam's `credentialRef` pattern). */
const credentialRefNameSchema = z$1.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);
/** CredentialView entry of credentials.describe. */
const credentialViewSchema = z$1.object({
	configured: z$1.boolean(),
	source: z$1.string().optional(),
	writable: z$1.boolean()
});
/** credentials.describe request payload. */
const credentialsDescribeRequestSchema = z$1.object({ refs: z$1.array(credentialRefNameSchema).max(64) });
/** credentials.describe response value. */
const credentialsDescribeValueSchema = z$1.object({ credentials: z$1.record(z$1.string(), credentialViewSchema) });
/** credentials.set request payload: the one direction a value crosses this wire. */
const credentialsSetRequestSchema = z$1.object({
	ref: credentialRefNameSchema,
	value: z$1.string().min(1)
});
/** credentials.set response value. */
const credentialsSetValueSchema = z$1.object({});
/** credentials.unset request payload. */
const credentialsUnsetRequestSchema = z$1.object({ ref: credentialRefNameSchema });
/** credentials.unset response value. */
const credentialsUnsetValueSchema = z$1.object({});
//#endregion
//#region lib/types/api/llm.schema.js
/**
* llm domain zod schemas (names derived from map keys: llmProvidersRequestSchema /
* llmProvidersValueSchema / llmModelsRequestSchema / llmModelsValueSchema).
*/
/** ConfigurableProviderView row of llm.providers. */
const configurableProviderViewSchema = z$1.object({
	provider: z$1.string().min(1),
	displayName: z$1.string().min(1),
	settingsNs: z$1.string(),
	settingsPath: z$1.array(z$1.string()),
	active: z$1.boolean()
});
/** llm.providers request payload. */
const llmProvidersRequestSchema = z$1.object({});
/** llm.providers response value. */
const llmProvidersValueSchema = z$1.object({ providers: z$1.array(configurableProviderViewSchema) });
/** llm.models request payload. */
const llmModelsRequestSchema = z$1.object({});
/** llm.models response value. */
const llmModelsValueSchema = z$1.object({
	groups: z$1.array(modelProviderGroupSchema),
	failures: z$1.array(modelCatalogFailureSchema)
});
/** DiscoveredModelView row of llm.discoverModels. */
const discoveredModelViewSchema = z$1.object({
	id: z$1.string().min(1),
	name: z$1.string().min(1).optional(),
	contextWindow: z$1.number().int().positive().optional(),
	maxTokens: z$1.number().int().positive().optional()
});
/** llm.discoverModels request payload. */
const llmDiscoverModelsRequestSchema = z$1.object({
	settingsNs: z$1.string().min(1),
	provider: z$1.string().min(1).optional(),
	baseURL: z$1.string().min(1).optional(),
	api: z$1.string().min(1).optional(),
	apiKey: z$1.string().min(1).optional()
});
/** llm.discoverModels response value. */
const llmDiscoverModelsValueSchema = z$1.object({ models: z$1.array(discoveredModelViewSchema) });
//#endregion
//#region lib/types/api/subagents.schema.js
/** Zod schemas for the browser-safe subagent domain. */
/** Healthy and diagnostic durable catalog rows. */
const subagentListEntrySchema = z$1.union([
	z$1.object({
		kind: z$1.literal("child"),
		id: sessionIdSchema,
		mode: z$1.literal("one-shot"),
		activity: z$1.union([z$1.literal("running"), z$1.literal("inactive")]),
		hasChildren: z$1.boolean(),
		label: z$1.string().optional()
	}),
	z$1.object({
		kind: z$1.literal("child"),
		id: sessionIdSchema,
		mode: z$1.literal("continuable"),
		activity: z$1.union([z$1.literal("running"), z$1.literal("inactive")]),
		hasChildren: z$1.boolean(),
		label: z$1.string()
	}),
	z$1.object({
		kind: z$1.literal("diagnostic"),
		id: sessionIdSchema,
		reason: z$1.union([
			z$1.literal("corrupt"),
			z$1.literal("unsupported"),
			z$1.literal("unavailable")
		])
	})
]);
/** subagent.list request payload. */
const subagentListRequestSchema = z$1.object({ parentSessionId: sessionIdSchema });
/** subagent.list response value. */
const subagentListValueSchema = z$1.object({
	entries: z$1.array(subagentListEntrySchema),
	parentAvailable: z$1.boolean()
});
/** subagent.history request payload. */
const subagentHistoryRequestSchema = z$1.object({
	parentSessionId: sessionIdSchema,
	childSessionId: sessionIdSchema,
	mode: z$1.union([z$1.literal("one-shot"), z$1.literal("continuable")]),
	beforeSeq: z$1.number().int().nonnegative().optional(),
	maxMessages: z$1.number().int().positive().optional()
});
/** subagent.history response value. */
const subagentHistoryValueSchema = z$1.object({
	events: z$1.array(historyEntrySchema),
	hasMore: z$1.boolean(),
	projections: sessionProjectionsBlockSchema.optional()
});
/** subagent.prompt request payload. */
const subagentPromptRequestSchema = z$1.object({
	parentSessionId: sessionIdSchema,
	childSessionId: sessionIdSchema,
	mode: z$1.literal("continuable"),
	content: z$1.array(contentBlockSchema)
});
const messageIdSchema = z$1.string();
/** subagent.prompt response value. */
const subagentPromptValueSchema = z$1.object({ messageId: messageIdSchema });
//#endregion
//#region lib/types/fetch/handler.js
/**
* Server side of the fetch carrier: maps an ApiProxy onto a pure
* WHATWG Request->Response function. Two-level parse: full form (type/rpcId/method +
* path==method) -> payload dispatched per method. HTTP status expresses only the carrier
* (404 unknown path / 415 non-JSON media type / 400 non-JSON body / 500 handler crash);
* business errors are always 200 + ServerResponse.
*/
const UNARY_ROUTES = {
	"session.list": {
		schema: sessionListRequestSchema,
		invoke: (api, r) => api.sessions.list(r)
	},
	"session.search": {
		schema: sessionSearchRequestSchema,
		invoke: (api, r, signal) => api.sessions.search(r, signal)
	},
	"session.create": {
		schema: sessionCreateRequestSchema,
		invoke: (api, r) => {
			return api.sessions.create(r);
		}
	},
	"session.history": {
		schema: sessionHistoryRequestSchema,
		invoke: (api, r) => api.sessions.history(r)
	},
	"session.models": {
		schema: sessionModelsRequestSchema,
		invoke: (api, r) => api.sessions.models(r)
	},
	"session.selectModel": {
		schema: sessionSelectModelRequestSchema,
		invoke: (api, r) => api.sessions.selectModel(r)
	},
	"session.rename": {
		schema: sessionRenameRequestSchema,
		invoke: (api, r) => api.sessions.rename(r)
	},
	"session.fork": {
		schema: sessionForkRequestSchema,
		invoke: (api, r) => api.sessions.fork(r)
	},
	"session.prompt": {
		schema: sessionPromptRequestSchema,
		invoke: (api, r) => api.sessions.prompt(r)
	},
	"session.updateQueue": {
		schema: sessionUpdateQueueRequestSchema,
		invoke: (api, r) => api.sessions.updateQueue(r)
	},
	"session.cancel": {
		schema: sessionCancelRequestSchema,
		invoke: (api, r) => api.sessions.cancel(r)
	},
	"subagent.list": {
		schema: subagentListRequestSchema,
		invoke: (api, r, signal) => api.subagents.list(r, signal)
	},
	"subagent.history": {
		schema: subagentHistoryRequestSchema,
		invoke: (api, r, signal) => api.subagents.history(r, signal)
	},
	"subagent.prompt": {
		schema: subagentPromptRequestSchema,
		invoke: (api, r, signal) => api.subagents.prompt(r, signal)
	},
	"host.describe": {
		schema: hostDescribeRequestSchema,
		invoke: (api, r) => api.host.describe(r)
	},
	"host.pickDirectory": {
		schema: hostPickDirectoryRequestSchema,
		invoke: (api, r, signal) => api.host.pickDirectory(r, signal)
	},
	"host.listDirectory": {
		schema: hostListDirectoryRequestSchema,
		invoke: (api, r, signal) => api.host.listDirectory(r, signal)
	},
	"host.createDirectory": {
		schema: hostCreateDirectoryRequestSchema,
		invoke: (api, r) => api.host.createDirectory(r)
	},
	"host.openPath": {
		schema: hostOpenPathRequestSchema,
		invoke: (api, r, signal) => api.host.openPath(r, signal)
	},
	"workspace.list": {
		schema: workspaceListRequestSchema,
		invoke: (api, r) => api.workspace.list(r)
	},
	"workspace.create": {
		schema: workspaceCreateRequestSchema,
		invoke: (api, r) => api.workspace.create(r)
	},
	"workspace.rename": {
		schema: workspaceRenameRequestSchema,
		invoke: (api, r) => api.workspace.rename(r)
	},
	"workspace.delete": {
		schema: workspaceDeleteRequestSchema,
		invoke: (api, r) => api.workspace.delete(r)
	},
	"workspace.insertSessionBefore": {
		schema: workspaceInsertSessionBeforeRequestSchema,
		invoke: (api, r) => api.workspace.insertSessionBefore(r)
	},
	"workspace.archiveSession": {
		schema: workspaceArchiveSessionRequestSchema,
		invoke: (api, r) => api.workspace.archiveSession(r)
	},
	"command.list": {
		schema: commandListRequestSchema,
		invoke: (api, r) => api.commands.list(r)
	},
	"command.execute": {
		schema: commandExecuteRequestSchema,
		invoke: (api, r, signal) => api.commands.execute(r, signal)
	},
	"skill.list": {
		schema: skillListRequestSchema,
		invoke: (api, r) => {
			return api.skills.list(r);
		}
	},
	"goal.create": {
		schema: goalCreateRequestSchema,
		invoke: (api, r) => api.goals.create(r)
	},
	"goal.edit": {
		schema: goalEditRequestSchema,
		invoke: (api, r) => api.goals.edit(r)
	},
	"goal.pause": {
		schema: goalPauseRequestSchema,
		invoke: (api, r) => api.goals.pause(r)
	},
	"goal.resume": {
		schema: goalResumeRequestSchema,
		invoke: (api, r) => api.goals.resume(r)
	},
	"goal.complete": {
		schema: goalCompleteRequestSchema,
		invoke: (api, r) => api.goals.complete(r)
	},
	"goal.clear": {
		schema: goalClearRequestSchema,
		invoke: (api, r) => api.goals.clear(r)
	},
	"settings.describe": {
		schema: settingsDescribeRequestSchema,
		invoke: (api, r) => api.settings.describe(r)
	},
	"settings.openDocument": {
		schema: settingsOpenDocumentRequestSchema,
		invoke: (api, r, signal) => api.settings.openDocument(r, signal)
	},
	"settings.update": {
		schema: settingsUpdateRequestSchema,
		invoke: (api, r) => api.settings.update(r)
	},
	"settings.replace": {
		schema: settingsReplaceRequestSchema,
		invoke: (api, r) => api.settings.replace(r)
	},
	"settings.mutate": {
		schema: settingsMutateRequestSchema,
		invoke: (api, r) => api.settings.mutate(r)
	},
	"credentials.describe": {
		schema: credentialsDescribeRequestSchema,
		invoke: (api, r) => api.credentials.describe(r)
	},
	"credentials.set": {
		schema: credentialsSetRequestSchema,
		invoke: (api, r) => api.credentials.set(r)
	},
	"credentials.unset": {
		schema: credentialsUnsetRequestSchema,
		invoke: (api, r) => api.credentials.unset(r)
	},
	"llm.providers": {
		schema: llmProvidersRequestSchema,
		invoke: (api, r) => api.llm.providers(r)
	},
	"llm.models": {
		schema: llmModelsRequestSchema,
		invoke: (api, r) => api.llm.models(r)
	},
	"llm.discoverModels": {
		schema: llmDiscoverModelsRequestSchema,
		invoke: (api, r, signal) => api.llm.discoverModels(r, signal)
	}
};
/** Route lookup that narrows an arbitrary path segment to a map key (single cast point for the string→key refinement). */
function methodFor(path) {
	return Object.hasOwn(UNARY_ROUTES, path) ? path : void 0;
}
/**
* Sentinel rpcId for error responses to envelopes whose own rpcId is unreadable: the response
* must still be a valid ServerResponse (a self-violating shape would turn the server's explicit
* bad-request report into a client-side parse failure). Fixed value, documented here as wire contract.
*/
const INVALID_REQUEST_RPC_ID = RpcId("invalid-request");
/** Wrap a business error as a ServerResponse full form (rpcId backfilled; an unreadable rpcId uses the invalid-request sentinel). */
function errorResponse(rpcId, error) {
	const body = {
		type: "server-response",
		rpcId,
		result: {
			ok: false,
			error
		}
	};
	return Response.json(body);
}
/** Complete the impl's narrow form into a ServerResponse full form. */
function fullResponse(narrow) {
	const body = {
		type: "server-response",
		rpcId: narrow.rpcId,
		result: narrow.result
	};
	return Response.json(body);
}
/**
* Parse the payload and invoke one unary route. Generic over the map key so
* the row's schema/invoke pairing typechecks; the only cast collapses the
* Wire<> widening back to the exact payload (undefined-valued properties and
* absent ones are indistinguishable after JSON transport).
*/
async function handleUnary(api, method, message, signal) {
	const route = UNARY_ROUTES[method];
	const payload = route.schema.safeParse(message.payload);
	if (!payload.success) return errorResponse(message.rpcId, {
		code: "bad-request",
		message: `invalid payload for ${method}`,
		details: { issues: payload.error.issues }
	});
	try {
		return fullResponse(await route.invoke(api, {
			rpcId: message.rpcId,
			payload: payload.data
		}, signal));
	} catch (error) {
		return new Response(`handler failure: ${String(error)}`, { status: 500 });
	}
}
/** SSE frame: complete the narrow RpcRequest<frame> into a ServerRequest full form (method = frame type). */
function fullFrame(narrow) {
	return {
		type: "server-request",
		rpcId: narrow.rpcId,
		method: narrow.payload.type,
		payload: narrow.payload
	};
}
/**
* Wrap a frame stream as an SSE Response; stops when req.signal aborts. An
* impl throw mid-stream emits one stream/error frame and then closes.
*/
function sseResponse(frames) {
	const encoder = new TextEncoder();
	const stream = new ReadableStream({ async start(controller) {
		try {
			controller.enqueue(encoder.encode(": connected\n\n"));
			for await (const narrow of frames) controller.enqueue(encoder.encode(`data: ${JSON.stringify(fullFrame(narrow))}\n\n`));
		} catch (error) {
			const failure = {
				type: "stream/error",
				error: {
					code: "internal",
					message: String(error),
					details: {}
				}
			};
			try {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(fullFrame({
					rpcId: RpcId(randomUUID()),
					payload: failure
				}))}\n\n`));
			} catch {}
		} finally {
			try {
				controller.close();
			} catch {}
		}
	} });
	return new Response(stream, { headers: {
		"content-type": "text/event-stream",
		"cache-control": "no-cache"
	} });
}
/**
* Wraps an ApiProxy into a pure fetch function (isomorphic point: feed the returned fetch straight to InProcessApiClient).
* @param api - the host-side ApiProxy implementation.
* @returns an object holding `fetch(Request)`; paths outside /api/ return 404.
*/
function toFetchHandler(api) {
	return { async fetch(input, init) {
		const req = input instanceof Request ? input : new Request(input, init);
		const path = new URL(req.url).pathname;
		if (path === "/api/events.mux" && req.method === "GET") return sseResponse(api.events.mux({
			rpcId: RpcId(randomUUID()),
			payload: {}
		}, req.signal));
		if (path === "/api/events.host" && req.method === "GET") return sseResponse(api.events.host({
			rpcId: RpcId(randomUUID()),
			payload: {}
		}, req.signal));
		if (req.method !== "POST" || !path.startsWith("/api/")) return new Response("not found", { status: 404 });
		if (req.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") return new Response("content type must be application/json", { status: 415 });
		let body;
		try {
			body = await req.json();
		} catch {
			return new Response("body is not JSON", { status: 400 });
		}
		if (path === "/api/respond") {
			const parsed = clientResponseSchema.safeParse(body);
			if (!parsed.success) return Response.json({
				accepted: false,
				reason: "bad-response"
			});
			return Response.json(await api.respond(parsed.data));
		}
		const method = methodFor(path.slice(5));
		if (method === void 0) return new Response("not found", { status: 404 });
		const envelope = clientRequestSchema.safeParse(body);
		if (!envelope.success) {
			const rawId = body?.rpcId;
			return errorResponse(typeof rawId === "string" ? RpcId(rawId) : INVALID_REQUEST_RPC_ID, {
				code: "bad-request",
				message: "invalid client-request message",
				details: { issues: envelope.error.issues }
			});
		}
		const message = envelope.data;
		if (message.method !== method) return errorResponse(message.rpcId, {
			code: "bad-request",
			message: `method "${message.method}" does not match path "${method}"`,
			details: { issues: [] }
		});
		return handleUnary(api, method, message, req.signal);
	} };
}
//#endregion
//#region lib/types/api/events.schema.js
/**
* events domain zod schemas: MuxFrame / HostFrame unions (discriminatedUnion('type')).
* A frame is the payload slot of the ServerRequest full form; the SessionEvent inside
* a session/event frame reuses sessions.schema's strict-envelope + wide-data passthrough branch.
*/
/** Question shape validated strictly against core dsh-user-interaction. */
const askUserQuestionItemSchema = z$1.object({
	id: z$1.string(),
	question: z$1.string(),
	header: z$1.string().optional(),
	detail: z$1.string().optional(),
	options: z$1.array(z$1.object({
		label: z$1.string(),
		description: z$1.string().optional()
	})).optional(),
	multiSelect: z$1.boolean().optional(),
	intent: z$1.discriminatedUnion("kind", [z$1.object({
		kind: z$1.literal("plan-review"),
		approve: z$1.string()
	})]).optional()
});
/** Unified message envelope carried by transient queue frames. */
const messageSchema = z$1.object({
	id: z$1.string().min(1),
	role: z$1.union([
		z$1.literal("system"),
		z$1.literal("user"),
		z$1.literal("assistant")
	]),
	content: z$1.array(contentBlockSchema),
	source: z$1.looseObject({ kind: z$1.string() })
});
/** MuxFrame union (payload slot of a mux-stream ServerRequest). */
const muxFrameSchema = z$1.discriminatedUnion("type", [
	z$1.object({
		type: z$1.literal("session/event"),
		sessionId: sessionIdSchema,
		event: sessionEventSchema,
		view: toolEventViewSchema.optional()
	}),
	z$1.object({
		type: z$1.literal("session/subscribed"),
		sessionId: sessionIdSchema,
		lastSeq: z$1.number().int()
	}),
	z$1.object({
		type: z$1.literal("approval/requested"),
		sessionId: sessionIdSchema,
		approvalId: approvalRequestIdSchema,
		toolName: z$1.string(),
		callId: z$1.string().optional(),
		reason: z$1.string().optional()
	}),
	z$1.object({
		type: z$1.literal("approval/resolved"),
		sessionId: sessionIdSchema,
		approvalId: approvalRequestIdSchema,
		outcome: z$1.union([
			z$1.literal("allowed-once"),
			z$1.literal("rejected"),
			z$1.literal("cancelled"),
			z$1.literal("unavailable")
		])
	}),
	z$1.object({
		type: z$1.literal("question/requested"),
		sessionId: sessionIdSchema,
		questions: z$1.array(askUserQuestionItemSchema).min(1)
	}),
	z$1.object({
		type: z$1.literal("question/resolved"),
		sessionId: sessionIdSchema,
		questionRpcId: rpcIdSchema,
		outcome: z$1.union([z$1.literal("answered"), z$1.literal("cancelled")])
	}),
	z$1.object({
		type: z$1.literal("session/queue"),
		sessionId: sessionIdSchema,
		items: z$1.array(z$1.object({
			id: messageIdSchema$1,
			placement: z$1.union([
				z$1.literal("queued"),
				z$1.literal("steering"),
				z$1.literal("context")
			]),
			message: messageSchema
		}))
	}),
	z$1.object({
		type: z$1.literal("session/projection"),
		sessionId: sessionIdSchema,
		key: z$1.string().min(1),
		value: z$1.unknown(),
		seq: z$1.number().int().nonnegative()
	}),
	z$1.object({
		type: z$1.literal("stream/error"),
		error: rpcErrorSchema
	})
]);
/** HostFrame union (payload slot of a host-stream ServerRequest). */
const hostFrameSchema = z$1.discriminatedUnion("type", [
	z$1.object({
		type: z$1.literal("host/session-added"),
		sessionId: sessionIdSchema,
		blank: z$1.boolean(),
		parentSessionId: sessionIdSchema.optional(),
		origin: z$1.literal("subagent").optional(),
		cwd: z$1.string().optional()
	}),
	z$1.object({
		type: z$1.literal("host/session-removed"),
		sessionId: sessionIdSchema
	}),
	z$1.object({
		type: z$1.literal("host/session-status"),
		sessionId: sessionIdSchema,
		running: z$1.boolean()
	}),
	z$1.object({
		type: z$1.literal("host/agent-error"),
		sessionId: sessionIdSchema,
		message: z$1.string()
	}),
	z$1.object({
		type: z$1.literal("host/workspace-changed"),
		workspace: workspaceViewSchema
	}),
	z$1.object({
		type: z$1.literal("host/workspace-removed"),
		workspaceId: workspaceIdSchema
	}),
	z$1.object({
		type: z$1.literal("host/archived-sessions-changed"),
		archivedSessionIds: z$1.array(sessionIdSchema)
	}),
	z$1.object({ type: z$1.literal("host/commands-changed") }),
	z$1.object({
		type: z$1.literal("host/settings-changed"),
		ns: z$1.string()
	}),
	z$1.object({
		type: z$1.literal("host/credentials-changed"),
		ref: z$1.string()
	}),
	z$1.object({ type: z$1.literal("host/models-changed") }),
	z$1.object({
		type: z$1.literal("stream/error"),
		error: rpcErrorSchema
	})
]);
//#endregion
//#region lib/types/fetch/client.js
/**
* Client side of the fetch carrier. AbstractApiClient holds every protocol invariant: rpcId minting,
* four-quadrant envelope wrap/unwrap, zod parsing, in-process SSE frame decoding, and the payload-direct
* IApiClient domain methods (business code never mints). Platform differences ride two aspects:
* abstract doFetch (transport) + overridable onEnvelope (tap). ApiProxy (the impl face) is untouched.
*/
/**
* S→C second-level parse table: value schema by method (the response-path
* mirror of the handler's request table; key coverage compiler-enforced against RpcMethodMap).
*/
const UNARY_VALUE_SCHEMAS = {
	"session.list": sessionListValueSchema,
	"session.search": sessionSearchValueSchema,
	"session.create": sessionCreateValueSchema,
	"session.history": sessionHistoryValueSchema,
	"session.models": sessionModelsValueSchema,
	"session.selectModel": sessionSelectModelValueSchema,
	"session.rename": sessionRenameValueSchema,
	"session.fork": sessionForkValueSchema,
	"session.prompt": sessionPromptValueSchema,
	"session.updateQueue": sessionUpdateQueueValueSchema,
	"session.cancel": sessionCancelValueSchema,
	"subagent.list": subagentListValueSchema,
	"subagent.history": subagentHistoryValueSchema,
	"subagent.prompt": subagentPromptValueSchema,
	"host.describe": hostDescribeValueSchema,
	"host.pickDirectory": hostPickDirectoryValueSchema,
	"host.listDirectory": hostListDirectoryValueSchema,
	"host.createDirectory": hostCreateDirectoryValueSchema,
	"host.openPath": hostOpenPathValueSchema,
	"workspace.list": workspaceListValueSchema,
	"workspace.create": workspaceCreateValueSchema,
	"workspace.rename": workspaceRenameValueSchema,
	"workspace.delete": workspaceDeleteValueSchema,
	"workspace.insertSessionBefore": workspaceInsertSessionBeforeValueSchema,
	"workspace.archiveSession": workspaceArchiveSessionValueSchema,
	"command.list": commandListValueSchema,
	"command.execute": commandExecuteValueSchema,
	"skill.list": skillListValueSchema,
	"goal.create": goalCreateValueSchema,
	"goal.edit": goalEditValueSchema,
	"goal.pause": goalPauseValueSchema,
	"goal.resume": goalResumeValueSchema,
	"goal.complete": goalCompleteValueSchema,
	"goal.clear": goalClearValueSchema,
	"settings.describe": settingsDescribeValueSchema,
	"settings.openDocument": settingsOpenDocumentValueSchema,
	"settings.update": settingsUpdateValueSchema,
	"settings.replace": settingsReplaceValueSchema,
	"settings.mutate": settingsMutateValueSchema,
	"credentials.describe": credentialsDescribeValueSchema,
	"credentials.set": credentialsSetValueSchema,
	"credentials.unset": credentialsUnsetValueSchema,
	"llm.providers": llmProvidersValueSchema,
	"llm.models": llmModelsValueSchema,
	"llm.discoverModels": llmDiscoverModelsValueSchema
};
/** Default timeout for bounded unary calls (rpc-compare 2026-07-19: a hung host must not leave callers pending forever). */
const DEFAULT_TIMEOUT_MS = 3e4;
/** URL base for in-process handler injection (fake authority, opencode precedent). */
const INTERNAL_BASE = "http://dsh.internal";
/**
* Abstract fetch-carrier client. Subclasses supply the transport (doFetch) and may refine the
* per-message tap (onEnvelope) — platform aspects stay in subclasses, protocol invariants stay
* here. Envelope observation is a first-class aspect of this data middle layer: the instance
* owns a microtask-batched buffer (frame storms must not cost one consumer update per frame),
* and observers subscribe via subscribeEnvelopes. The isomorphic point survives: an in-process
* subclass whose doFetch is toFetchHandler(api).fetch never touches the network.
*/
var AbstractApiClient = class {
	timeoutMs;
	/** Instance-owned observation buffer (module-level state would leak across instances/tests). */
	envelopeBatch = [];
	flushScheduled = false;
	envelopeListeners = /* @__PURE__ */ new Set();
	/** @param timeoutMs - timeout for bounded unary calls; user-paced calls and streams do not use it. */
	constructor(timeoutMs = DEFAULT_TIMEOUT_MS) {
		this.timeoutMs = timeoutMs;
	}
	/**
	* Subscribe to batched envelope observation (diagnostics/logging consumers).
	* Batches follow microtask boundaries; a listener throw is isolated (observation
	* must never break the carrier).
	* @param listener - receives each flushed batch in arrival order.
	* @returns unsubscribe function.
	*/
	subscribeEnvelopes(listener) {
		this.envelopeListeners.add(listener);
		return () => {
			this.envelopeListeners.delete(listener);
		};
	}
	/** Per-message tap: feeds the instance buffer. Subclasses may override to observe unbatched (call super to keep batching). */
	onEnvelope(message) {
		if (this.envelopeListeners.size === 0) return;
		this.envelopeBatch.push(message);
		if (this.flushScheduled) return;
		this.flushScheduled = true;
		queueMicrotask(() => {
			this.flushScheduled = false;
			const batch = this.envelopeBatch;
			this.envelopeBatch = [];
			for (const notify of this.envelopeListeners) try {
				notify(batch);
			} catch (error) {
				console.error("[apiproxy] envelope listener threw:", error);
			}
		});
	}
	/** Browser = same-origin (a fake authority would fail DNS on real requests); no-location env (Node) = fake authority. */
	resolveBase() {
		const loc = globalThis.location;
		return loc?.origin !== void 0 && loc.origin !== "null" ? loc.origin : INTERNAL_BASE;
	}
	mintRpcId() {
		return RpcId(crypto.randomUUID());
	}
	/**
	* Shared POST leg of both C→S carriers (callUnary/respond): JSON body,
	* optional default timeout merged with the caller's external signal, non-2xx → transport throw.
	*/
	async postJson(path, body, signal, timeoutPolicy = "default") {
		const requestSignal = timeoutPolicy === "default" ? signal === void 0 ? AbortSignal.timeout(this.timeoutMs) : AbortSignal.any([AbortSignal.timeout(this.timeoutMs), signal]) : signal;
		const response = await this.doFetch(new URL(path, this.resolveBase()), {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
			...requestSignal === void 0 ? {} : { signal: requestSignal }
		});
		if (!response.ok) throw new Error(`transport failure for ${path}: HTTP ${response.status}`);
		return response;
	}
	/**
	* Unary protocol path: mint → tap → POST full form → envelope parse → verify
	* echo → value parse → tap → narrow. Virtual so a fake carrier (fixture) can
	* override transport at this layer.
	*/
	async callUnary(method, payload, signal, timeoutPolicy = "default") {
		const message = {
			type: "client-request",
			rpcId: this.mintRpcId(),
			method,
			payload
		};
		this.onEnvelope(message);
		const response = await this.postJson(`/api/${method}`, message, signal, timeoutPolicy);
		const full = serverResponseSchema.parse(await response.json());
		this.onEnvelope(full);
		if (full.rpcId !== message.rpcId) throw new Error(`rpcId mismatch for ${method}: sent ${message.rpcId}, got ${full.rpcId}`);
		if (!full.result.ok) return {
			rpcId: full.rpcId,
			result: full.result
		};
		const value = UNARY_VALUE_SCHEMAS[method].parse(full.result.value);
		return {
			rpcId: full.rpcId,
			result: {
				ok: true,
				value
			}
		};
	}
	/** Mux stream opener; virtual for the same override reason as callUnary. */
	openMux(_payload, signal, onOpen) {
		return this.readSse("/api/events.mux", signal, muxFrameSchema, onOpen);
	}
	/** Host stream opener; virtual. */
	openHost(_payload, signal, onOpen) {
		return this.readSse("/api/events.host", signal, hostFrameSchema, onOpen);
	}
	/**
	* SSE protocol path: streaming fetch (not EventSource), '\n\n' framing, ServerRequest envelope +
	* frame-schema parse, tap, narrow yield. onOpen fires once the response headers are in and the
	* body is readable — the stream-established signal, before any frame arrives. A frame that fails
	* either parse level is reported and skipped (one corrupt frame must not kill the stream; the
	* client's gap detection covers whatever the frame carried).
	*/
	async *readSse(path, signal, frameSchema, onOpen) {
		const response = await this.doFetch(new URL(path, this.resolveBase()), { signal });
		if (!response.ok || response.body === null) throw new Error(`transport failure for ${path}: HTTP ${response.status}`);
		onOpen?.();
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) return;
				buffer += decoder.decode(value, { stream: true });
				let boundary;
				while ((boundary = buffer.indexOf("\n\n")) !== -1) {
					const chunk = buffer.slice(0, boundary);
					buffer = buffer.slice(boundary + 2);
					const data = chunk.split("\n").filter((line) => line.startsWith("data: ")).map((line) => line.slice(6)).join("");
					if (data === "") continue;
					let full;
					let frame;
					try {
						full = serverRequestSchema.parse(JSON.parse(data));
						frame = frameSchema.parse(full.payload);
					} catch (error) {
						console.error(`[apiproxy] dropping malformed SSE frame on ${path}:`, error);
						continue;
					}
					this.onEnvelope(full);
					yield {
						rpcId: full.rpcId,
						payload: frame
					};
				}
			}
		} finally {
			await reader.cancel().catch(() => void 0);
		}
	}
	sessions = {
		list: (payload, signal) => this.callUnary("session.list", payload, signal),
		search: (payload, signal) => this.callUnary("session.search", payload, signal),
		create: (payload, signal) => this.callUnary("session.create", payload, signal),
		history: (payload, signal) => this.callUnary("session.history", payload, signal),
		models: (payload, signal) => this.callUnary("session.models", payload, signal),
		selectModel: (payload, signal) => this.callUnary("session.selectModel", payload, signal),
		rename: (payload, signal) => {
			return this.callUnary("session.rename", payload, signal);
		},
		fork: (payload, signal) => this.callUnary("session.fork", payload, signal),
		prompt: (payload, signal) => this.callUnary("session.prompt", payload, signal),
		updateQueue: (payload, signal) => this.callUnary("session.updateQueue", payload, signal),
		cancel: (payload, signal) => this.callUnary("session.cancel", payload, signal)
	};
	subagents = {
		list: (payload, signal) => this.callUnary("subagent.list", payload, signal),
		history: (payload, signal) => this.callUnary("subagent.history", payload, signal),
		prompt: (payload, signal) => this.callUnary("subagent.prompt", payload, signal)
	};
	host = {
		describe: (payload, signal) => this.callUnary("host.describe", payload, signal),
		pickDirectory: (payload, signal) => this.callUnary("host.pickDirectory", payload, signal, "caller-signal-only"),
		listDirectory: (payload, signal) => this.callUnary("host.listDirectory", payload, signal),
		createDirectory: (payload, signal) => this.callUnary("host.createDirectory", payload, signal),
		openPath: (payload, signal) => this.callUnary("host.openPath", payload, signal)
	};
	workspace = {
		list: (payload, signal) => this.callUnary("workspace.list", payload, signal),
		create: (payload, signal) => this.callUnary("workspace.create", payload, signal),
		rename: (payload, signal) => this.callUnary("workspace.rename", payload, signal),
		delete: (payload, signal) => this.callUnary("workspace.delete", payload, signal),
		insertSessionBefore: (payload, signal) => this.callUnary("workspace.insertSessionBefore", payload, signal),
		archiveSession: (payload, signal) => this.callUnary("workspace.archiveSession", payload, signal)
	};
	commands = {
		list: (payload, signal) => this.callUnary("command.list", payload, signal),
		execute: (payload, signal) => this.callUnary("command.execute", payload, signal, "caller-signal-only")
	};
	skills = { list: (payload, signal) => this.callUnary("skill.list", payload, signal) };
	goals = {
		create: (payload, signal) => this.callUnary("goal.create", payload, signal),
		edit: (payload, signal) => this.callUnary("goal.edit", payload, signal),
		pause: (payload, signal) => this.callUnary("goal.pause", payload, signal),
		resume: (payload, signal) => this.callUnary("goal.resume", payload, signal),
		complete: (payload, signal) => this.callUnary("goal.complete", payload, signal),
		clear: (payload, signal) => this.callUnary("goal.clear", payload, signal)
	};
	settings = {
		describe: (payload, signal) => this.callUnary("settings.describe", payload, signal),
		openDocument: (payload, signal) => this.callUnary("settings.openDocument", payload, signal),
		update: (payload, signal) => this.callUnary("settings.update", payload, signal),
		replace: (payload, signal) => this.callUnary("settings.replace", payload, signal),
		mutate: (payload, signal) => this.callUnary("settings.mutate", payload, signal)
	};
	credentials = {
		describe: (payload, signal) => this.callUnary("credentials.describe", payload, signal),
		set: (payload, signal) => this.callUnary("credentials.set", payload, signal),
		unset: (payload, signal) => this.callUnary("credentials.unset", payload, signal)
	};
	llm = {
		providers: (payload, signal) => this.callUnary("llm.providers", payload, signal),
		models: (payload, signal) => this.callUnary("llm.models", payload, signal),
		discoverModels: (payload, signal) => this.callUnary("llm.discoverModels", payload, signal)
	};
	events = {
		mux: (payload, signal, onOpen) => this.openMux(payload, signal, onOpen),
		host: (payload, signal, onOpen) => this.openHost(payload, signal, onOpen)
	};
	async respond(message, signal) {
		this.onEnvelope(message);
		const response = await this.postJson("/api/respond", message, signal);
		return rpcReceiptSchema.parse(await response.json());
	}
};
/**
* In-process client over an injected fetch-shaped handler (the isomorphic point:
* `new InProcessApiClient(toFetchHandler(api))` never touches the network). Lives here because
* in-process injection is this package's own capability (handler and client are both local).
*/
var InProcessApiClient = class extends AbstractApiClient {
	handler;
	constructor(handler, timeoutMs) {
		super(timeoutMs);
		this.handler = handler;
	}
	/**
	* Faithful to real fetch: reject on signal abort even when the in-process
	* handler ignores the signal (a hung impl must not defeat timeout/cancel).
	*/
	doFetch(input, init) {
		const signal = init?.signal ?? void 0;
		if (signal === void 0) return this.handler.fetch(input, init);
		if (signal.aborted) return Promise.reject(abortError(signal));
		return new Promise((resolve, reject) => {
			const onAbort = () => {
				reject(abortError(signal));
			};
			signal.addEventListener("abort", onAbort, { once: true });
			this.handler.fetch(input, init).then(resolve, reject).finally(() => {
				signal.removeEventListener("abort", onAbort);
			});
		});
	}
};
/** Mirror fetch's abort rejection: the signal's reason when present, else a DOMException-style AbortError. */
function abortError(signal) {
	const reason = signal.reason;
	if (reason instanceof Error) return reason;
	if (typeof reason === "string") return new Error(reason);
	return /* @__PURE__ */ new Error("This operation was aborted");
}
//#endregion
//#region lib/types/index.js
/**
* @deepseek-ai/dsh-host-apiproxy — the API gateway every client shape shares:
* the ApiProxy contract (api/: types + zod schemas, browser-safe), the fetch
* carrier pair (fetch/: toFetchHandler on the host side, AbstractApiClient +
* platform subclasses on the client side), and the host-side implementation
* (api-proxy.ts: createApiProxy + the ApiProxyService gateway plugin providing
* `ctx.apiProxy`). Transport-agnostic by design: this package registers no
* routes — physical carriers wrap `ctx.apiProxy` themselves.
*/
/**
* The API gateway service: implements the ApiProxy contract over the composed
* host context and provides it as `ctx.apiProxy`. The Host cwd is the default
* project directory and the fallback parent for name-created Workspaces.
*/
var ApiProxyService = class extends Service {
	static inject = [
		"agents",
		"directoryPicker",
		"llm",
		"sessions",
		"subagents",
		"sessionQuery",
		"tools",
		"userInteraction",
		"workspace"
	];
	static Config = z.object({
		provider: z.string().required(),
		model: z.string().required(),
		workspaceRoot: z.string()
	});
	sessions;
	subagents;
	workspace;
	host;
	commands;
	goals;
	skills;
	settings;
	credentials;
	llm;
	events;
	respond;
	constructor(ctx, config) {
		super(ctx, "apiProxy");
		const cwd = process.cwd();
		const api = createApiProxy(ctx, {
			provider: config.provider,
			model: config.model,
			cwd,
			workspaceRoot: resolve(config.workspaceRoot ?? cwd)
		});
		this.sessions = api.sessions;
		this.subagents = api.subagents;
		this.workspace = api.workspace;
		this.host = api.host;
		this.commands = api.commands;
		this.goals = api.goals;
		this.skills = api.skills;
		this.settings = api.settings;
		this.credentials = api.credentials;
		this.llm = api.llm;
		this.events = api.events;
		this.respond = api.respond.bind(api);
	}
};
//#endregion
export { AbstractApiClient, ApiProxyService, ApiProxyService as default, InProcessApiClient, RpcId, createApiProxy, toFetchHandler };
