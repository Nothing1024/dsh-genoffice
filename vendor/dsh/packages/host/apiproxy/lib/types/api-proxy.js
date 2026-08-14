/**
 * Host-side ApiProxy implementation. Signature discipline: unary takes the
 * narrow RpcRequest<P> and echoes request.rpcId on the RpcResponse<T>.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { installAgentLlmTarget } from '@deepseek-ai/dsh-agent';
import { createUserMessage, freezeMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import { errorChain } from '@deepseek-ai/dsh-llm';
import { isAppendSurfaceEvent, lastActivityTime } from '@deepseek-ai/dsh-session';
import { SessionQueryError } from '@deepseek-ai/dsh-session-query';
import { SubagentError } from '@deepseek-ai/dsh-subagent';
import { workspaceDomainState, workspaceRecord, WorkspaceId as brandWorkspaceId, WorkspaceMoveInvalidError, WorkspaceUnknownSessionError, } from '@deepseek-ai/dsh-workspace';
import { SESSION_SEARCH_RESULT_LIMIT, SESSION_SEARCH_SNIPPET_MAX_CODE_POINTS, truncateUnicodeCodePoints, } from "./api/session-search.js";
// GoalError narrows domain rejections to their stable codes at the wire boundary.
import { GoalError } from '@deepseek-ai/dsh-goal';
// The settings/credentials seams: brand guards run at this wire boundary; the
// service reads stay optional (`ctx.get`) so a composition without either
// provider still serves every other domain.
import { SettingsConflictError, settingsNamespace } from '@deepseek-ai/dsh-settings';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
// Value edge: the rename impl narrows the title service's validation failure; the import also resolves `ctx.get('sessionTitle')`.
import { SessionTitleInvalidError } from '@deepseek-ai/dsh-session-title';
import { approvalResponsePayloadSchema } from "./api/approvals.schema.js";
import { questionResponsePayloadSchema } from "./api/questions.schema.js";
import { RpcId } from "./api/rpc.js";
import { UserInteractionError } from '@deepseek-ai/dsh-user-interaction';
import { DirectoryPickerError } from '@deepseek-ai/dsh-host-directory-picker';
import { openNativePath, openNativeTextFile } from "./native-path-opener.js";
/** Page size when history is called without maxMessages. */
const DEFAULT_MAX_MESSAGES = 50;
/** Non-model settings namespaces intentionally served to the Web client. */
const WEB_SETTINGS_NAMESPACES = ['permission'];
/** Provider work budget: at most 100 calls and 2,000 inspected hits. */
const SESSION_SEARCH_PROVIDER_CALL_LIMIT = 100;
/** Bound cold-log stat fan-out and settle each started batch before cancellation returns. */
const COLD_SUMMARY_BATCH_SIZE = 16;
/** Conversation message event types (the pagination counting unit). */
const MESSAGE_TYPES = new Set(['user/message', 'assistant/message']);
/** Product settings intentionally exposed beside model-provider namespaces. */
const PRODUCT_SETTINGS_NAMESPACES = new Set(['ui-onboarding']);
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
    const window = beforeSeq === undefined ? [...events] : events.filter(event => event.seq < beforeSeq);
    let count = 0;
    let cut = 0;
    for (let i = window.length - 1; i >= 0; i--) {
        const event = window[i];
        if (!MESSAGE_TYPES.has(event.type) || !isAppendSurfaceEvent(event))
            continue;
        count++;
        const sources = event.sourceEventSeqs;
        const groupStart = sources !== undefined && sources.length > 0 ? Math.min(event.seq, ...sources) : event.seq;
        if (count >= maxMessages) {
            cut = groupStart;
            break;
        }
    }
    const page = window.filter(event => event.seq >= cut);
    return { events: page, hasMore: cut > 0 };
}
/** Wrap an ok result echoing the request's rpcId. */
function ok(request, value) {
    return { rpcId: request.rpcId, result: { ok: true, value } };
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
                const reasoning = resolved.reasoning === undefined
                    ? undefined
                    : {
                        efforts: resolved.reasoning.efforts.map(effort => ({
                            id: effort.id,
                            name: effort.name,
                            ...effort.description === undefined
                                ? {}
                                : { description: effort.description },
                        })),
                        ...resolved.reasoning.defaultEffort === undefined
                            ? {}
                            : { defaultEffort: resolved.reasoning.defaultEffort },
                    };
                return {
                    id: model.id,
                    name: model.name,
                    ...model.description === undefined ? {} : { description: model.description },
                    ...reasoning !== undefined ? { reasoning } : {},
                };
            }));
            const group = {
                id: provider.id,
                name: provider.name,
                models: entries,
            };
            return { kind: 'group', group };
        }
        catch (error) {
            const failure = {
                id: provider.id,
                name: provider.name,
                message: error instanceof Error ? error.message : String(error),
            };
            return { kind: 'failure', failure };
        }
    }));
    return {
        groups: catalog.flatMap(item => item.kind === 'group' ? [item.group] : []).filter(group => group.models.length > 0),
        failures: catalog.flatMap(item => item.kind === 'failure' ? [item.failure] : []),
    };
}
/** Wrap an error result echoing the request's rpcId. */
function err(request, error) {
    return { rpcId: request.rpcId, result: { ok: false, error } };
}
/** Simple async queue: core callbacks push, the AsyncIterable pulls; abort/return cleans up. */
class FrameQueue {
    buffer = [];
    waiter;
    done = false;
    push(item) {
        if (this.done)
            return;
        this.buffer.push(item);
        this.waiter?.();
    }
    end() {
        this.done = true;
        this.waiter?.();
    }
    async *iterate(signal, cleanup) {
        const onAbort = () => { this.end(); };
        signal.addEventListener('abort', onAbort, { once: true });
        try {
            while (true) {
                while (this.buffer.length > 0)
                    yield this.buffer.shift();
                if (this.done || signal.aborted)
                    return;
                await new Promise((resolve) => { this.waiter = resolve; });
                this.waiter = undefined;
            }
        }
        finally {
            signal.removeEventListener('abort', onAbort);
            cleanup();
        }
    }
}
/**
 * Server-side frame mint: pure pushes get a fresh rpcId per frame (answerable
 * frames — approval/question requested — mint their stable id in their
 * pending registries instead).
 */
function frame(payload) {
    return { rpcId: RpcId(randomUUID()), payload };
}
/** Queue the subscription baseline frame. */
function subscribeSession(queue, session) {
    queue.push(frame({ type: 'session/subscribed', sessionId: session.id, lastSeq: session.seq - 1 }));
}
/**
 * Whether the session's conversation has started: no turn has run yet (a
 * turn is one model-loop execution). Standalone plugin events — command
 * lifecycle records, plan/mode, titles, goals — never open a turn, so
 * running `/plan` or `/goal` on a fresh session keeps it blank
 * (list-hidden, reusable).
 */
function sessionBlank(session) {
    return !session.events.some(event => event.type === 'turn/start');
}
/** Shared Session-header projection for list baselines and creation frames. */
function sessionListFields(header) {
    return {
        ...header.parentSession === undefined ? {} : { parentSessionId: header.parentSession },
        ...header.origin === undefined ? {} : { origin: header.origin },
        ...header.cwd === undefined ? {} : { cwd: header.cwd },
    };
}
/** SessionSummary projection for attached (in-memory) sessions. */
function summarize(session, running) {
    return {
        sessionId: session.id,
        // Excludes end-seed: a resumed-but-untouched session
        // must not sort as freshly worked in.
        updatedAt: lastActivityTime(session.events) ?? session.header.createdAt,
        running,
        blank: sessionBlank(session),
        ...sessionListFields(session.header),
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
    if (location !== undefined) {
        try {
            updatedAt = (await stat(location.path)).mtimeMs;
        }
        catch {
            // The log vanished between list() and stat() (concurrent cleanup); createdAt stands in.
        }
        signal?.throwIfAborted();
    }
    return {
        sessionId: meta.id,
        updatedAt,
        running: false,
        // Lazy persistence keeps never-appended sessions out of list(); reading
        // a cold log to check for turns would defeat the index read, so a listed
        // cold session is served as not-blank (its log holds its conversation).
        blank: false,
        ...meta.parentSession === undefined ? {} : { parentSessionId: meta.parentSession },
        ...meta.origin === undefined ? {} : { origin: meta.origin },
        /* v8 ignore next -- the empty arm needs a cwd-less meta, but list()
        filters those out (legacy logs are not served); the conditional mirrors
        summarize() shape. */
        ...meta.cwd === undefined ? {} : { cwd: meta.cwd },
    };
}
/** Map a browse-primitive failure onto the wire error vocabulary (unknown throws stay internal). */
function directoryError(error) {
    if (error instanceof DirectoryPickerError) {
        return { code: error.code, message: error.message, details: { path: error.path } };
    }
    return { code: 'internal', message: error instanceof Error ? error.message : String(error), details: {} };
}
/** Project a pending entry into its answerable mux frame (initial push and mux-open replay share it). */
function requestedFrame(pending) {
    return {
        rpcId: pending.rpcId,
        payload: {
            type: 'approval/requested',
            sessionId: pending.sessionId,
            approvalId: pending.approvalId,
            toolName: pending.toolName,
            ...pending.callId === undefined ? {} : { callId: pending.callId },
            ...pending.reason === undefined ? {} : { reason: pending.reason },
        },
    };
}
/** Validate one answer batch against the exact question request it resolves. */
function matchesQuestions(payload, pending) {
    if (payload.sessionId !== pending.sessionId)
        return false;
    const answers = payload.answer.answers;
    if (answers.length !== pending.questions.length)
        return false;
    return answers.every((answer, index) => {
        const question = pending.questions[index];
        if (answer.id !== question.id)
            return false;
        if (new Set(answer.selected).size !== answer.selected.length)
            return false;
        const custom = answer.custom?.trim();
        if (custom !== undefined && custom === '')
            return false;
        if (question.multiSelect !== true) {
            if (custom !== undefined && answer.selected.length > 0)
                return false;
            if (answer.selected.length > 1)
                return false;
        }
        const labels = new Set(question.options?.map(option => option.label) ?? []);
        return answer.selected.every(label => labels.has(label));
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
        if (event.type === 'tool/call') {
            const { name, arguments: raw } = event.data;
            const view = ctx.tools.get(name)?.presentCall?.(JSON.parse(raw));
            return view === undefined ? undefined : { for: 'call', view };
        }
        if (event.type === 'tool/result') {
            const { message, meta } = event.data;
            const [result] = message.content;
            const callId = message.source.callId;
            const call = argsFor(callId);
            if (call === undefined)
                return undefined;
            const view = ctx.tools.get(call.name)?.presentResult?.(call.args, {
                content: result.content,
                isError: result.isError === true,
                ...meta === undefined ? {} : { meta },
            });
            return view === undefined ? undefined : { for: 'result', view };
        }
    }
    catch (error) {
        // A throwing presenter (or unparseable arguments) must not break delivery;
        // the event still ships, just without a view.
        console.error(`api-proxy: presenter failed for ${event.type}, falling back to generic: ${String(error)}`);
    }
    return undefined;
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
        if (event.type !== 'tool/call')
            continue;
        const data = event.data;
        if (data.callId !== callId)
            continue;
        try {
            return { name: data.name, args: JSON.parse(data.arguments) };
        }
        catch {
            // Unparseable stored arguments: same soft-fall as a live parse failure.
            return undefined;
        }
    }
    return undefined;
}
/** Render one detached history page through the same presenter path as ordinary history. */
function historyPage(ctx, events, beforeSeq, maxMessages) {
    const page = paginate(events, beforeSeq, maxMessages ?? DEFAULT_MAX_MESSAGES);
    return {
        events: page.events.map((event) => {
            const view = viewFor(ctx, event, callId => backscanArgs(page.events, callId));
            return { event, ...view === undefined ? {} : { view } };
        }),
        hasMore: page.hasMore,
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
    const registry = ctx.get('sessionProjections');
    if (registry === undefined)
        return undefined;
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
        const block = session !== undefined
            ? ctx.get('sessionProjections')?.snapshot(session)
            : ctx.get('sessionProjectionCache')?.cachedSnapshot(meta);
        return block !== undefined && Object.keys(block.values).length > 0 ? block : undefined;
    }
    catch (error) {
        ctx.logger.warn(`session.list: projection column for "${meta.id}" failed (serving the row without it): ${String(error)}`);
        return undefined;
    }
}
/** Projection baseline for a detached history tail without Agent activation. */
function detachedProjectionsFor(ctx, events) {
    const registry = ctx.get('sessionProjections');
    if (registry === undefined)
        return undefined;
    return registry.restore({}, events, 0).snapshot;
}
/** Map continuation admission failures without exposing provider details. */
function subagentPromptError(request, error, signal) {
    const childSessionId = request.payload.childSessionId;
    if (signal.aborted) {
        return err(request, { code: 'cancelled', message: 'subagent prompt was cancelled', details: {} });
    }
    if (error instanceof SubagentError) {
        switch (error.code) {
            case 'NOT_RESUMABLE':
                return err(request, {
                    code: 'subagent-not-resumable',
                    message: 'subagent cannot be resumed',
                    details: { childSessionId },
                });
            case 'UNAUTHORIZED':
                return err(request, {
                    code: 'subagent-unauthorized',
                    message: 'subagent does not belong to this parent',
                    details: { childSessionId },
                });
            case 'DRAINING':
            case 'ACTIVATION_CLOSING':
            case 'CONTINUATION_UNAVAILABLE':
            case 'PERSISTENCE_UNAVAILABLE':
                return err(request, {
                    code: 'subagent-delivery-unavailable',
                    message: 'subagent follow-up is temporarily unavailable',
                    details: { childSessionId },
                });
            default:
                break;
        }
    }
    return err(request, { code: 'internal', message: 'subagent prompt failed', details: {} });
}
/** Verify one address and mode against the complete direct-child catalog. */
async function catalogChild(ctx, address, signal) {
    const { parentSessionId, childSessionId, mode } = address;
    try {
        const entries = await ctx.subagents.listChildren(parentSessionId, signal);
        const entry = entries.find(candidate => candidate.id === childSessionId);
        if (entry === undefined || (entry.kind === 'child' && entry.mode !== mode)) {
            return {
                error: {
                    code: 'subagent-not-found',
                    message: `session "${childSessionId}" is not a ${mode} direct child of "${parentSessionId}"`,
                    details: { parentSessionId, childSessionId },
                },
            };
        }
        if (entry.kind === 'diagnostic') {
            return {
                error: {
                    code: 'subagent-catalog-diagnostic',
                    message: `subagent "${childSessionId}" is ${entry.reason}`,
                    details: { parentSessionId, childSessionId, reason: entry.reason },
                },
            };
        }
        return { entry };
    }
    catch (error) {
        if (signal?.aborted
            || (error instanceof SubagentError && error.code === 'CANCELLED')
            || (error instanceof SessionQueryError && error.code === 'SESSION_QUERY_ABORTED')) {
            return { error: { code: 'cancelled', message: 'subagent catalog read was cancelled', details: {} } };
        }
        if (error instanceof SessionQueryError && error.code === 'SESSION_QUERY_SESSION_NOT_FOUND') {
            return {
                error: {
                    code: 'subagent-not-found',
                    message: `parent session "${parentSessionId}" was not found`,
                    details: { parentSessionId, childSessionId },
                },
            };
        }
        return { error: { code: 'internal', message: 'subagent catalog read failed', details: {} } };
    }
}
/**
 * Thrown by the cold-resume path when the id names no servable session
 * (absent from the store, or a pre-project legacy log without a cwd).
 */
class SessionNotFound extends Error {
}
/** Session identity whose lifecycle belongs to subagent routing, not generic Host resume. */
class SubagentSessionOwnership extends Error {
    sessionId;
    constructor(sessionId) {
        super(`session "${sessionId}" is a subagent session; use subagent delivery`);
        this.sessionId = sessionId;
    }
}
/** Requested identity already belongs to a session with another project cwd. */
class SessionCwdConflict extends Error {
    sessionId;
    requestedCwd;
    existingCwd;
    constructor(sessionId, requestedCwd, existingCwd) {
        super(`session "${sessionId}" already exists with cwd ${JSON.stringify(existingCwd)}; `
            + `requested ${JSON.stringify(requestedCwd)}`);
        this.sessionId = sessionId;
        this.requestedCwd = requestedCwd;
        this.existingCwd = existingCwd;
    }
}
/** Host failed before the registry could adopt a name-created directory. */
class WorkspaceDirectoryCreationError extends Error {
}
/** An explicit Host naming operation would duplicate another Workspace title. */
class WorkspaceNameConflictError extends Error {
    workspaceName;
    constructor(workspaceName) {
        super(`workspace name '${workspaceName}' is already in use`);
        this.workspaceName = workspaceName;
        this.name = 'WorkspaceNameConflictError';
    }
}
/** Shared workspace-not-found error response of the workspace.* mutation rows. */
function workspaceNotFound(request, workspaceId) {
    return err(request, {
        code: 'workspace-not-found',
        message: `workspace "${workspaceId}" not found`,
        details: { workspaceId },
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
        updatedAt: workspace.updatedAt,
    };
}
/** Wire projection of the durable record carried by `domain/changed`. */
function changedWorkspaceView(workspaceId, value) {
    const record = workspaceRecord.parse(value);
    return {
        workspaceId: workspaceId,
        path: record.path,
        title: record.title,
        sessionIds: [...record.sessionIds],
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
}
/**
 * Implement ApiProxy over a composed host context.
 * @param ctx - a context with the Host spine and Workspace registry mounted.
 * @param defaults - host routing and project-directory defaults.
 * @returns the ApiProxy implementation.
 */
export function createApiProxy(ctx, defaults) {
    const agentOptions = { provider: defaults.provider, model: defaults.model };
    const targets = new WeakMap();
    /** Implicit resume of cold sessions, deduplicating concurrent calls (follows the jsonrpc sessionCreations precedent). */
    const resumes = new Map();
    /** Client-chosen identity creation/resume, deduplicated across concurrent retries. */
    const sessionCreations = new Map();
    /** Serializes path ownership and explicit title checks with Workspace mutations. */
    let workspaceCreationChain = Promise.resolve();
    const pendingQuestions = new Map();
    const pendingApprovals = new Map();
    const muxQueues = new Set();
    /**
     * Install or return the session-local target that prompt assembly snapshots.
     * Seed order: latest logged request/header, else the host default routing.
     * There is no create-time per-session override tier on this wire — if one
     * returns (a create-options contribution), it must fold in between the two.
     */
    function targetFor(agent) {
        const installed = targets.get(agent);
        if (installed !== undefined)
            return installed;
        const logged = agent.session.requestHeader()?.config;
        const target = {
            current: logged === undefined
                ? { provider: defaults.provider, model: defaults.model }
                : {
                    provider: logged.provider,
                    model: logged.model,
                    ...logged.reasoningEffort === undefined
                        ? {}
                        : { reasoningEffort: logged.reasoningEffort },
                },
            assembled: undefined,
        };
        installAgentLlmTarget(agent.ctx, target);
        targets.set(agent, target);
        return target;
    }
    /** Pre-publication setup used by both fresh and resumed Web agents. */
    function installTarget(agentCtx) {
        const agent = agentCtx.agent;
        if (agent === undefined)
            throw new Error('api-proxy: agent setup has no scoped agent');
        targetFor(agent);
    }
    /** Send one transient frame to every connected mux consumer. */
    function broadcast(payload) {
        const envelope = frame(payload);
        for (const queue of muxQueues)
            queue.push(envelope);
    }
    // Projection change feed → session/projection push frames. The carrier
    // mints the wire frame (the seam package holds no wire vocabulary); the
    // child activates only when a projection registry is composed, and the
    // subscription unwinds with this gateway's fiber.
    ctx.inject(['sessionProjections'], (projectionCtx) => {
        projectionCtx.sessionProjections.onChanged((session, key, value, seq) => {
            broadcast({ type: 'session/projection', sessionId: session.id, key, value, seq });
        });
    });
    /** Project both durable inbox lists, optionally including the splice currently being emitted. */
    const queueItems = (agent, splice) => {
        const project = (target) => {
            const messages = target === 'next-turn' ? agent.inbox.nextTurn : agent.inbox.nextStep;
            return splice?.target === target
                ? messages.toSpliced(splice.start, splice.removedCount ?? 0, ...splice.inserted)
                : messages;
        };
        return [
            ...project('next-turn').map(message => ({ id: message.id, placement: 'queued', message })),
            ...project('next-step').map(message => ({
                id: message.id,
                // Only user-origin messages are steering; injected context (approval
                // notices, task completion, attached snapshots) is not a user action
                // and must not render as a pending steering bubble.
                placement: message.source.kind === 'user' ? 'steering' : 'context',
                message,
            })),
        ];
    };
    ctx.on('session/event', (session, event) => {
        if (event.type !== 'agent/inbox/spliced')
            return;
        const agent = ctx.agents.get(session.id);
        if (agent?.session !== session)
            return;
        broadcast({ type: 'session/queue', sessionId: session.id, items: queueItems(agent, event.data) });
    });
    /** Remove a wait before settling it: synchronous deletion makes the first claimant win. */
    function claimQuestion(pending, outcome) {
        pendingQuestions.delete(pending.rpcId);
        if (pending.signal !== undefined && pending.onAbort !== undefined) {
            pending.signal.removeEventListener('abort', pending.onAbort);
        }
        broadcast({
            type: 'question/resolved', sessionId: pending.sessionId,
            questionRpcId: pending.rpcId, outcome,
        });
    }
    const disposeProvider = ctx.userInteraction.registerProvider({
        ask(request) {
            const sessionId = request.agent?.id;
            if (sessionId === undefined) {
                return Promise.reject(new UserInteractionError('web user interaction requires an agent-owned session', 'ASK_MISSING_AGENT'));
            }
            return new Promise((resolve, reject) => {
                const rpcId = RpcId(randomUUID());
                const pending = {
                    rpcId, sessionId, questions: request.questions, resolve, reject,
                    ...(request.signal === undefined ? {} : { signal: request.signal }),
                };
                const onAbort = () => {
                    claimQuestion(pending, 'cancelled');
                    reject(new UserInteractionError('ask_user_question was aborted before the user answered', 'ASK_ABORTED'));
                };
                pending.onAbort = onAbort;
                pendingQuestions.set(rpcId, pending);
                request.signal?.addEventListener('abort', onAbort, { once: true });
                const envelope = {
                    rpcId,
                    payload: { type: 'question/requested', sessionId, questions: request.questions },
                };
                for (const queue of muxQueues)
                    queue.push(envelope);
            });
        },
    });
    ctx.effect(() => () => {
        disposeProvider();
        for (const pending of [...pendingQuestions.values()]) {
            claimQuestion(pending, 'cancelled');
            pending.reject(new UserInteractionError('web user-interaction provider was disposed', 'ASK_ABORTED'));
        }
    }, 'api-proxy: user-interaction provider');
    // --- Approval pending registry ------------------------------------------
    // The proxy is the approval channel for every agent this host owns: an ask
    // through `ctx.approval` becomes an answerable server-request on the mux
    // stream (stable rpcId), settled by POST /api/respond. The entry survives
    // client disconnects — mux-open replays still-pending requested frames with
    // the same rpcId (the refresh-recovery baseline) — and withdraws on the
    // ask's own abort signal (turn cancel), pushing `cancelled` to subscribers.
    if (ctx.get('approval') !== undefined) {
        // Teardown parity with the question provider above: a gateway disposed
        // while approvals are pending settles every entry as 'cancelled' (the
        // service's fail-closed vocabulary), so no ask promise dangles past the
        // proxy's lifetime and subscribers see the withdrawal.
        ctx.effect(() => () => {
            for (const pending of [...pendingApprovals.values()])
                pending.resolve('cancelled');
        }, 'api-proxy: approval registry teardown');
        ctx.on('approval/request', (req, next) => {
            // Dispatch rides a microtask behind the service's own signal check: an
            // abort landing in that window would register the abort listener AFTER
            // the signal fired — never invoked, entry pending forever, zombie frame
            // on every mux replay. Settle synchronously instead of publishing.
            if (req.signal?.aborted === true)
                return Promise.resolve('cancelled');
            // The audit pair `approval/asked` is already appended by the service
            // before dispatch, but dispatch rides a microtask: parallel tool calls
            // can append several asked events before any answerer runs. THIS
            // request's event is therefore the newest asked event that is still
            // undecided, unclaimed by another pending entry, and — when the ask
            // names a call — carries the same callId.
            const events = req.agent.session.events;
            const claimed = new Set();
            for (const entry of pendingApprovals.values())
                claimed.add(entry.approvalId);
            const decided = new Set();
            let approvalId;
            for (let i = events.length - 1; i >= 0; i -= 1) {
                const event = events[i];
                if (event.type === 'approval/decided') {
                    decided.add(event.data.id);
                }
                else if (event.type === 'approval/asked') {
                    if (decided.has(event.data.id) || claimed.has(event.data.id))
                        continue;
                    // Symmetric pairing: a callId-bearing ask only takes its own call's
                    // record, and a callId-less ask only takes a callId-less record —
                    // so neither shape can steal the other's audit id under parallel
                    // asks. (Today every producer — the tool executor — passes callId;
                    // the callId-less arm guards any future non-tool asker.)
                    if ((req.callId ?? null) !== (event.data.callId ?? null))
                        continue;
                    approvalId = event.data.id;
                    break;
                }
            }
            // No asked event means the request bypassed the service's audit path —
            // not this channel's question; delegate to the fail-closed default.
            if (approvalId === undefined)
                return next();
            const id = approvalId;
            return new Promise((resolve) => {
                const settle = (outcome) => {
                    /* v8 ignore next 3 -- defensive double-settle guard: respond() routes
                       through the pending table (a settled id is not-pending before it can
                       re-settle) and the first settle removes the abort listener, so no
                       reachable path settles twice; kept against future settle callers. */
                    if (!pendingApprovals.delete(pending.rpcId))
                        return;
                    req.signal?.removeEventListener('abort', onAbort);
                    broadcast({ type: 'approval/resolved', sessionId: pending.sessionId, approvalId: id, outcome });
                    // A cancelled ask was already settled by the service's own signal
                    // race, which discards this late resolution; resolving is a no-op
                    // there and keeps this promise from dangling forever.
                    resolve(outcome);
                };
                const onAbort = () => { settle('cancelled'); };
                const pending = {
                    rpcId: RpcId(randomUUID()),
                    sessionId: req.agent.session.id,
                    approvalId: id,
                    toolName: req.toolName,
                    ...req.callId === undefined ? {} : { callId: req.callId },
                    ...req.reason === undefined ? {} : { reason: req.reason },
                    resolve: settle,
                };
                pendingApprovals.set(pending.rpcId, pending);
                req.signal?.addEventListener('abort', onAbort, { once: true });
                const envelope = requestedFrame(pending);
                for (const queue of muxQueues)
                    queue.push(envelope);
            });
        });
    }
    /** Whether the session's own suffix carries the durable subagent discriminator. */
    function hasSubagentDescriptor(session) {
        const events = session.events;
        // Indexed scan from the own-suffix start: slicing copies the whole suffix
        // on every Agent-bound RPC, including each `session.prompt` on long
        // transcripts.
        for (let index = session.header.seedLength ?? 0; index < events.length; index += 1) {
            if (events[index]?.type === 'subagent/descriptor')
                return true;
        }
        return false;
    }
    /**
     * Generic Host interaction cannot claim a durably classified subagent or an
     * Agent created through its live parent. The runtime-owner arm also covers
     * descriptor-less child publication windows and older stored headers.
     */
    function hasSubagentOwner(session, agent) {
        if (session.header.origin === 'subagent' || hasSubagentDescriptor(session))
            return true;
        const parentId = session.header.parentSession;
        if (parentId === undefined || agent === undefined)
            return false;
        const parent = ctx.agents.get(parentId);
        return parent !== undefined && ctx.agents.isOwnedBy(agent.id, parent);
    }
    /** Stable generic-Host error for an identity reserved to subagent routing. */
    function subagentOwnershipError(sessionId) {
        return {
            code: 'agent-busy',
            message: `session "${sessionId}" is owned by subagent routing`,
            details: { reason: 'use subagent delivery for this child session' },
        };
    }
    /** Inspect one cold served session without repairing, resuming, or publishing it. */
    async function inspectServable(sessionId) {
        const persistence = ctx.get('sessionPersistence');
        if (persistence === undefined) {
            throw new Error('session persistence is not configured (load a dsh-session-persistence backend)');
        }
        const meta = (await persistence.list()).find(m => m.id === sessionId);
        if (meta === undefined || meta.cwd === undefined)
            throw new SessionNotFound(`session "${sessionId}" not found`);
        const inspected = await persistence.inspect(sessionId);
        if (inspected.meta.cwd === undefined)
            throw new SessionNotFound(`session "${sessionId}" not found`);
        return { meta: inspected.meta, events: [...inspected.events] };
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
        if (live === undefined)
            return undefined;
        if (hasSubagentOwner(live.session, live))
            return { error: subagentOwnershipError(sessionId) };
        return { agent: live };
    }
    async function agentFor(sessionId) {
        const fenced = fencedLiveAgent(sessionId);
        if (fenced !== undefined)
            return fenced;
        const attached = ctx.sessions.get(sessionId);
        if (attached !== undefined && hasSubagentOwner(attached, undefined)) {
            return { error: subagentOwnershipError(sessionId) };
        }
        let resume = resumes.get(sessionId);
        if (resume === undefined) {
            resume = (async () => {
                try {
                    const inspected = await inspectServable(sessionId);
                    if (hasSubagentOwner({ header: inspected.meta, events: inspected.events }, undefined)) {
                        throw new SubagentSessionOwnership(sessionId);
                    }
                    const publishedSession = ctx.sessions.get(sessionId);
                    const publishedAgent = ctx.agents.get(sessionId);
                    if (publishedSession !== undefined && hasSubagentOwner(publishedSession, publishedAgent)) {
                        throw new SubagentSessionOwnership(sessionId);
                    }
                    const handle = await ctx.agents.resume({
                        resumeSessionId: sessionId,
                        agentOptions,
                        setup: installTarget,
                    });
                    return handle.agent;
                }
                finally {
                    resumes.delete(sessionId);
                }
            })();
            resumes.set(sessionId, resume);
        }
        try {
            return { agent: await resume };
        }
        catch (error) {
            if (error instanceof SessionNotFound) {
                return { error: { code: 'session-not-found', message: error.message, details: { sessionId } } };
            }
            if (error instanceof SubagentSessionOwnership) {
                return { error: subagentOwnershipError(error.sessionId) };
            }
            // A concurrent publish can win the identity between the pre-resume
            // re-check and `ctx.agents.resume` publication; the ID-collision
            // rejection falls through here. Mirror ensureSession's `.catch` in
            // full: classify a subagent-owned winner into the stable ownership
            // error, and hand a clean plain-agent winner straight back.
            const fenced = fencedLiveAgent(sessionId);
            if (fenced !== undefined)
                return fenced;
            const attached = ctx.sessions.get(sessionId);
            if (attached !== undefined && hasSubagentOwner(attached, undefined)) {
                return { error: subagentOwnershipError(sessionId) };
            }
            // The internal details slot is contractually {}; the reason rides the message.
            return { error: { code: 'internal', message: `resume failed for session "${sessionId}": ${String(error)}`, details: {} } };
        }
    }
    /** Read one stable session prefix without acquiring an Agent owner. */
    async function readSessionState(sessionId) {
        const attached = ctx.sessions.get(sessionId);
        if (attached !== undefined) {
            return {
                id: attached.id,
                header: attached.header,
                events: [...attached.events],
            };
        }
        const inspected = await inspectServable(sessionId);
        return { id: inspected.meta.id, header: inspected.meta, events: inspected.events };
    }
    /** Resolve the Workspace inherited by a fork without making ordinary loose lineage grouped. */
    async function forkWorkspace(source) {
        const workspaces = ctx.workspace.list();
        const direct = workspaces.find(workspace => workspace.sessionIds.includes(source.id));
        if (direct !== undefined || source.header.origin !== 'subagent')
            return direct;
        const lineage = await ctx.sessionQuery.traceSession(source.id);
        for (const ancestor of lineage.ancestors) {
            const workspace = workspaces.find(candidate => candidate.sessionIds.includes(ancestor.header.id));
            if (workspace !== undefined)
                return workspace;
        }
        return undefined;
    }
    /** Read one transcript cut and optional projection baseline without acquiring an Agent owner. */
    async function historyStateFor(sessionId, includeProjections) {
        const attached = ctx.sessions.get(sessionId);
        if (attached !== undefined) {
            const events = [...attached.events];
            const projections = includeProjections ? projectionsFor(ctx, attached) : undefined;
            return { events, ...projections === undefined ? {} : { projections } };
        }
        const inspected = await inspectServable(sessionId);
        const projections = includeProjections ? detachedProjectionsFor(ctx, inspected.events) : undefined;
        return {
            events: inspected.events,
            ...projections === undefined ? {} : { projections },
        };
    }
    /** Resolve one requested identity to a live agent, creating or resuming it once. */
    async function ensureSession(sessionId, cwd, checkPersistedIdentity) {
        let creation = sessionCreations.get(sessionId);
        if (creation === undefined) {
            creation = (async () => {
                const attached = ctx.sessions.get(sessionId);
                const live = ctx.agents.get(sessionId);
                if (attached !== undefined && hasSubagentOwner(attached, live)) {
                    throw new SubagentSessionOwnership(sessionId);
                }
                if (live !== undefined)
                    return live;
                const persistence = checkPersistedIdentity ? ctx.get('sessionPersistence') : undefined;
                const stored = persistence === undefined
                    ? undefined
                    : (await persistence.list()).find(header => header.id === sessionId);
                if (persistence !== undefined && stored !== undefined) {
                    const inspected = await persistence.inspect(sessionId);
                    // Ownership first: explicit-id adoption of a session-backed
                    // subagent must answer `agent-busy` regardless of the requested
                    // cwd (the api/commands.ts contract), not a cwd conflict.
                    if (hasSubagentOwner({ header: inspected.meta, events: inspected.events }, undefined)) {
                        throw new SubagentSessionOwnership(sessionId);
                    }
                    if (inspected.meta.cwd !== cwd) {
                        throw new SessionCwdConflict(sessionId, cwd, inspected.meta.cwd);
                    }
                    return (await ctx.agents.resume({
                        resumeSessionId: sessionId,
                        agentOptions,
                        setup: installTarget,
                    })).agent;
                }
                try {
                    await mkdir(cwd, { recursive: true });
                }
                catch (error) {
                    throw new Error(`failed to ensure project directory "${cwd}": ${String(error)}`, { cause: error });
                }
                return (await ctx.agents.create({
                    sessionId,
                    agentOptions,
                    meta: { cwd },
                    setup: installTarget,
                })).agent;
            })().catch((error) => {
                // Another Host entry path may have published the same identity while
                // this operation crossed an asynchronous persistence/filesystem step.
                const live = ctx.agents.get(sessionId);
                if (live !== undefined) {
                    if (hasSubagentOwner(live.session, live))
                        throw new SubagentSessionOwnership(sessionId);
                    return live;
                }
                const attached = ctx.sessions.get(sessionId);
                if (attached !== undefined && hasSubagentOwner(attached, undefined)) {
                    throw new SubagentSessionOwnership(sessionId);
                }
                throw error;
            }).finally(() => {
                sessionCreations.delete(sessionId);
            });
            sessionCreations.set(sessionId, creation);
        }
        const agent = await creation;
        if (hasSubagentOwner(agent.session, agent))
            throw new SubagentSessionOwnership(sessionId);
        if (agent.session.header.cwd !== cwd) {
            throw new SessionCwdConflict(sessionId, cwd, agent.session.header.cwd);
        }
        return agent;
    }
    /** Resolve or create one path while holding the Host's workspace-create chain. */
    function ensureWorkspace(path, title, rejectExistingName = false, createDirectory = false) {
        const operation = workspaceCreationChain.then(async () => {
            if (rejectExistingName && title !== undefined
                && ctx.workspace.list().some(workspace => workspace.title === title)) {
                throw new WorkspaceNameConflictError(title);
            }
            if (createDirectory) {
                try {
                    await mkdir(path, { recursive: true });
                }
                catch (error) {
                    throw new WorkspaceDirectoryCreationError(`failed to create workspace directory "${path}": ${String(error)}`);
                }
            }
            const existing = await ctx.workspace.resolveByPath(path);
            if (existing !== undefined)
                return { workspace: existing, created: false };
            return { workspace: await ctx.workspace.create(path, title), created: true };
        });
        workspaceCreationChain = operation.then(() => undefined, () => undefined);
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
                ...summarize(session, agent?.status === 'running'),
                ...projections === undefined ? {} : { projections },
            };
        });
        signal?.throwIfAborted();
        const attached = new Set(items.map(item => item.sessionId));
        const persistence = ctx.get('sessionPersistence');
        if (persistence !== undefined) {
            const cold = (await persistence.list(signal))
                .filter(meta => !attached.has(meta.id) && meta.cwd !== undefined);
            signal?.throwIfAborted();
            for (let offset = 0; offset < cold.length; offset += COLD_SUMMARY_BATCH_SIZE) {
                signal?.throwIfAborted();
                const batch = cold.slice(offset, offset + COLD_SUMMARY_BATCH_SIZE);
                const settled = await Promise.allSettled(batch.map(async (meta) => {
                    // Cold rows read the persisted projection cache only — never a
                    // log load; a session without a cache row simply has no column.
                    const projections = listProjectionsFor(ctx, meta, undefined);
                    return {
                        ...await summarizeCold(persistence, meta, signal),
                        ...projections === undefined ? {} : { projections },
                    };
                }));
                const summaries = [];
                let rejected = false;
                let failure;
                for (const result of settled) {
                    if (result.status === 'fulfilled') {
                        summaries.push(result.value);
                    }
                    else if (!rejected) {
                        rejected = true;
                        failure = result.reason;
                    }
                }
                if (rejected)
                    throw failure;
                signal?.throwIfAborted();
                items.push(...summaries);
            }
        }
        items.sort((a, b) => b.updatedAt - a.updatedAt);
        return items;
    }
    /** Resolve the goal service; absent = the deployment did not compose @deepseek-ai/dsh-goal. */
    function goalService() {
        const goals = ctx.get('goals');
        if (goals === undefined) {
            return { error: { code: 'internal', message: 'goal service is absent: this deployment does not mount @deepseek-ai/dsh-goal in its composition (cordis.yml or explicit assembly)', details: {} } };
        }
        return goals;
    }
    /** Map one goal-domain rejection to the wire error (stable GoalError codes ride in details). */
    function goalError(request, error) {
        const details = error instanceof GoalError ? { goalCode: error.code } : {};
        return err(request, { code: 'internal', message: String(error), details });
    }
    /** Resolve a session's agent, apply one goal mutation, and acknowledge with the new CAS ref. */
    async function mutateGoal(request, mutation) {
        const goals = goalService();
        if ('error' in goals)
            return err(request, goals.error);
        const found = await agentFor(request.payload.sessionId);
        if ('error' in found)
            return err(request, found.error);
        try {
            const ref = mutation(goals, found.agent);
            return ok(request, { ref: { id: ref.id, revision: ref.revision } });
        }
        catch (error) {
            return goalError(request, error);
        }
    }
    /** Missing-service report shared by the settings domain (skills-domain stance). */
    function settingsAbsent() {
        return { code: 'internal', message: 'settings service is absent: this deployment does not mount a settings provider (e.g. @deepseek-ai/dsh-settings-local) in its composition', details: {} };
    }
    /** Open one Host-resolved target and map native failures onto the wire vocabulary. */
    async function openTarget(request, path, signal, open) {
        try {
            await open(path, signal);
            return ok(request, { opened: true });
        }
        catch (error) {
            if (signal.aborted) {
                return err(request, {
                    code: 'cancelled',
                    message: 'path open was aborted',
                    details: {},
                });
            }
            return err(request, {
                code: 'internal',
                message: `path open failed: ${error instanceof Error ? error.message : String(error)}`,
                details: {},
            });
        }
    }
    /** Open one Host-resolved path with its default application. */
    function openPath(request, path, signal) {
        const open = defaults.openPath
            ?? ((target, openSignal) => openNativePath(target, openSignal));
        return openTarget(request, path, signal, open);
    }
    /** Open one Host-resolved text document in a native editor. */
    function openTextFile(request, path, signal) {
        const open = defaults.openTextFile
            ?? ((target, openSignal) => openNativeTextFile(target, openSignal));
        return openTarget(request, path, signal, open);
    }
    /** Missing-service report shared by the credentials domain. */
    function credentialsAbsent() {
        return { code: 'internal', message: 'credentials service is absent: this deployment does not mount a credential provider (e.g. @deepseek-ai/dsh-credentials-local) in its composition', details: {} };
    }
    /** Map one redacted seam descriptor to its wire view. */
    function namespaceView(descriptor) {
        return {
            ns: String(descriptor.ns),
            schema: descriptor.schema,
            value: descriptor.value,
            ...descriptor.base === undefined ? {} : { base: descriptor.base },
            ...descriptor.user === undefined ? {} : { user: descriptor.user },
            applies: descriptor.applies,
            secrets: (descriptor.secrets ?? []).map(secret => ({ path: [...secret.path], set: secret.set })),
            revision: descriptor.revision,
        };
    }
    /** Settings namespaces whose changes can invalidate the model catalog. */
    function modelProviderNamespaces() {
        return new Set(ctx.llm.listConfigurableProviders().map(entry => entry.settingsNs));
    }
    /**
     * The settings namespaces this proxy serves: configurable model providers
     * plus the small explicit Web preference and product-owned allowlists. The
     * settings seam remains general; a future registration does not become
     * remotely readable or writable by default.
     */
    function exposedNamespaces() {
        const exposed = modelProviderNamespaces();
        for (const ns of WEB_SETTINGS_NAMESPACES)
            exposed.add(ns);
        for (const ns of PRODUCT_SETTINGS_NAMESPACES)
            exposed.add(ns);
        return exposed;
    }
    /** Refuse a namespace outside the explicit configuration-client boundary. */
    function notExposed(request, ns) {
        return err(request, {
            code: 'settings-not-exposed',
            message: `settings namespace "${ns}" is not exposed to configuration clients`,
            details: { ns },
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
        const settings = ctx.get('settings');
        if (settings === undefined)
            return err(request, settingsAbsent());
        const rejected = (error) => {
            // A stale writer is its own outcome, not a malformed request: the client
            // must re-read and re-apply rather than treat the write as invalid.
            if (error instanceof SettingsConflictError) {
                return err(request, {
                    code: 'settings-conflict',
                    message: error.message,
                    details: { ns, expected: error.expected, actual: error.actual },
                });
            }
            return err(request, {
                code: 'settings-rejected',
                message: error instanceof Error ? error.message : String(error),
                details: { ns },
            });
        };
        let branded;
        try {
            branded = settingsNamespace(ns);
        }
        catch (error) {
            // A malformed name is a client bug, reported as such; it could never be
            // in the exposed set either, so naming the real fault costs no ground.
            return rejected(error);
        }
        if (!exposedNamespaces().has(ns))
            return notExposed(request, ns);
        try {
            if (mode === 'update')
                await settings.update(branded, section, expectedRevision);
            else if (mode === 'replace')
                await settings.replace(branded, section, expectedRevision);
            else
                await settings.mutate(branded, section, expectedRevision);
        }
        catch (error) {
            return rejected(error);
        }
        const descriptor = settings.describe({ redactSecrets: true }).find(candidate => candidate.ns === branded);
        if (descriptor === undefined) {
            // The write committed but the namespace vanished before this read: only
            // a concurrent registrant disposal can produce it.
            return err(request, { code: 'internal', message: `settings namespace "${ns}" was disposed after the ${mode}`, details: {} });
        }
        return ok(request, namespaceView(descriptor));
    }
    return {
        sessions: {
            // Attached sessions summarize from memory; persisted-but-unattached (cold)
            // sessions merge in from the persistence store so history survives restarts.
            // Legacy logs without a cwd (pre-project stance) are not served — every
            // session now records its project at create time.
            async list(request) {
                return ok(request, { items: await listVisibleSessionSummaries() });
            },
            async search(request, signal) {
                const cancelled = () => err(request, {
                    code: 'cancelled',
                    message: 'session search was aborted',
                    details: {},
                });
                if (isAborted(signal))
                    return cancelled();
                const sessionQuery = ctx.get('sessionQuery');
                if (sessionQuery === undefined) {
                    return err(request, {
                        code: 'internal',
                        message: 'session search is unavailable: this deployment does not mount @deepseek-ai/dsh-session-query',
                        details: {},
                    });
                }
                try {
                    const visible = await listVisibleSessionSummaries(signal);
                    if (isAborted(signal))
                        return cancelled();
                    if (visible.length === 0)
                        return ok(request, { items: [], hasMore: false });
                    const visibleIds = new Set(visible.map(item => item.sessionId));
                    const authorized = [];
                    const acceptedIds = new Set();
                    const seenCursors = new Set();
                    let cursor;
                    let providerCallCount = 0;
                    let providerPageLimit = SESSION_SEARCH_RESULT_LIMIT;
                    while (authorized.length <= SESSION_SEARCH_RESULT_LIMIT) {
                        if (isAborted(signal))
                            return cancelled();
                        if (providerCallCount >= SESSION_SEARCH_PROVIDER_CALL_LIMIT) {
                            throw new Error(`session search provider exceeded the ${SESSION_SEARCH_PROVIDER_CALL_LIMIT}-call work budget`);
                        }
                        providerCallCount++;
                        const requestedCursor = cursor;
                        const requestedPageLimit = providerPageLimit;
                        let page;
                        try {
                            page = await sessionQuery.searchSessions({
                                query: request.payload.query,
                                eventFilters: [
                                    { kind: 'type', values: ['user/message', 'assistant/message'] },
                                    { kind: 'surface', values: ['current'] },
                                ],
                                limit: requestedPageLimit,
                                ...requestedCursor === undefined ? {} : { cursor: requestedCursor },
                            }, { signal });
                        }
                        catch (error) {
                            if (isAborted(signal))
                                return cancelled();
                            if (requestedCursor === undefined
                                && error instanceof SessionQueryError
                                && error.code === 'SESSION_QUERY_INVALID_LIMIT'
                                && requestedPageLimit > 1) {
                                providerPageLimit = Math.max(1, Math.floor(requestedPageLimit / 2));
                                continue;
                            }
                            if (requestedCursor !== undefined
                                && error instanceof SessionQueryError
                                && error.code === 'SESSION_QUERY_STALE_CURSOR') {
                                authorized.length = 0;
                                acceptedIds.clear();
                                seenCursors.clear();
                                cursor = undefined;
                                continue;
                            }
                            throw error;
                        }
                        if (isAborted(signal))
                            return cancelled();
                        const providerItemCount = page.items.length;
                        if (providerItemCount > requestedPageLimit) {
                            throw new Error(`session search provider returned ${providerItemCount} items; maximum is ${requestedPageLimit}`);
                        }
                        // Host visibility is the authorization boundary. Consume the
                        // provider's globally ranked stream rather than binding every
                        // visible id into one SQLite statement, then re-check complete
                        // provenance before emitting any snippet.
                        for (const hit of page.items) {
                            if (authorized.length > SESSION_SEARCH_RESULT_LIMIT)
                                continue;
                            if (!visibleIds.has(hit.header.id)
                                || hit.bestMatch.sessionId !== hit.header.id
                                || hit.bestMatch.surface !== 'current'
                                || !MESSAGE_TYPES.has(hit.bestMatch.type)
                                || acceptedIds.has(hit.header.id))
                                continue;
                            const snippet = truncateUnicodeCodePoints(hit.bestMatch.snippet, SESSION_SEARCH_SNIPPET_MAX_CODE_POINTS);
                            acceptedIds.add(hit.header.id);
                            authorized.push({
                                sessionId: hit.header.id,
                                snippet,
                            });
                        }
                        const nextCursor = page.nextCursor;
                        if (nextCursor !== undefined) {
                            if (seenCursors.has(nextCursor)) {
                                throw new Error('session search provider repeated a continuation cursor');
                            }
                            seenCursors.add(nextCursor);
                        }
                        if (authorized.length > SESSION_SEARCH_RESULT_LIMIT || nextCursor === undefined)
                            break;
                        cursor = nextCursor;
                    }
                    return ok(request, {
                        items: authorized.slice(0, SESSION_SEARCH_RESULT_LIMIT),
                        hasMore: authorized.length > SESSION_SEARCH_RESULT_LIMIT,
                    });
                }
                catch (error) {
                    if (isAborted(signal)
                        || (error instanceof SessionQueryError && error.code === 'SESSION_QUERY_ABORTED'))
                        return cancelled();
                    // XXX: Redact provider details before exposing this gateway beyond
                    // its current single-user local deployment.
                    return err(request, {
                        code: 'internal',
                        message: `session search failed: ${String(error)}`,
                        details: {},
                    });
                }
            },
            async create(request) {
                const sessionId = request.payload.sessionId ?? `session-${randomUUID()}`;
                let workspace;
                if (request.payload.workspaceId !== undefined) {
                    workspace = ctx.workspace.get(brandWorkspaceId(request.payload.workspaceId));
                    if (workspace === undefined) {
                        return err(request, {
                            code: 'workspace-not-found',
                            message: `workspace "${request.payload.workspaceId}" not found`,
                            details: { workspaceId: request.payload.workspaceId },
                        });
                    }
                }
                const cwd = workspace?.path ?? request.payload.cwd ?? defaults.cwd;
                try {
                    await ensureSession(sessionId, cwd, request.payload.sessionId !== undefined);
                }
                catch (error) {
                    if (error instanceof SessionCwdConflict) {
                        return err(request, {
                            code: 'session-conflict',
                            message: error.message,
                            details: {
                                sessionId: error.sessionId,
                                requestedCwd: error.requestedCwd,
                                ...error.existingCwd === undefined ? {} : { existingCwd: error.existingCwd },
                            },
                        });
                    }
                    if (error instanceof SubagentSessionOwnership) {
                        return err(request, subagentOwnershipError(error.sessionId));
                    }
                    return err(request, {
                        code: 'internal',
                        message: `failed to create session "${sessionId}": ${String(error)}`,
                        details: {},
                    });
                }
                if (workspace !== undefined) {
                    try {
                        await workspace.attachSession(sessionId);
                    }
                    catch (error) {
                        return err(request, {
                            code: 'workspace-attach-failed',
                            message: `session "${sessionId}" was created but could not attach to workspace "${workspace.id}": ${String(error)}`,
                            details: { sessionId, workspaceId: workspace.id },
                        });
                    }
                }
                return ok(request, { sessionId });
            },
            async history(request) {
                const { sessionId, beforeSeq, maxMessages } = request.payload;
                let state;
                try {
                    state = await historyStateFor(sessionId, beforeSeq === undefined);
                }
                catch (error) {
                    if (error instanceof SessionNotFound) {
                        return err(request, { code: 'session-not-found', message: error.message, details: { sessionId } });
                    }
                    return err(request, {
                        code: 'internal',
                        message: `history unavailable for session "${sessionId}": ${String(error)}`,
                        details: {},
                    });
                }
                const page = historyPage(ctx, state.events, beforeSeq, maxMessages);
                return ok(request, {
                    events: page.events,
                    hasMore: page.hasMore,
                    ...state.projections === undefined ? {} : { projections: state.projections },
                });
            },
            async models(request) {
                const { sessionId } = request.payload;
                const found = await agentFor(sessionId);
                if ('error' in found)
                    return err(request, found.error);
                const current = targetFor(found.agent).current;
                const { groups, failures } = await buildModelCatalog(ctx);
                return ok(request, { current: { ...current }, groups, failures });
            },
            async selectModel(request) {
                const { sessionId, provider, model, reasoningEffort } = request.payload;
                const found = await agentFor(sessionId);
                if ('error' in found) {
                    return err(request, found.error);
                }
                try {
                    const resolved = await ctx.llm.resolveCallConfig({
                        provider,
                        model,
                        ...reasoningEffort === undefined
                            ? {}
                            : { reasoningEffort: ReasoningEffortId(reasoningEffort) },
                    });
                    const selected = {
                        provider: resolved.provider,
                        model: resolved.model,
                        ...resolved.reasoningEffort === undefined
                            ? {}
                            : { reasoningEffort: resolved.reasoningEffort },
                    };
                    targetFor(found.agent).current = selected;
                    return ok(request, { selected: { ...selected } });
                }
                catch (error) {
                    return err(request, {
                        code: 'model-unavailable',
                        message: error instanceof Error ? error.message : String(error),
                        details: { provider, model },
                    });
                }
            },
            async rename(request) {
                const { sessionId, title } = request.payload;
                const found = await agentFor(sessionId);
                if ('error' in found)
                    return err(request, found.error);
                const titles = ctx.get('sessionTitle');
                if (titles === undefined) {
                    return err(request, { code: 'internal', message: 'renaming is unavailable: this deployment mounts no session-title service', details: {} });
                }
                try {
                    const accepted = titles.rename(found.agent.session, title);
                    return ok(request, { title: accepted.title, seq: accepted.eventSeq });
                }
                catch (error) {
                    // Only the input's fault maps to title-invalid (the message is
                    // product-user-visible in the rename dialog); liveness and disposal
                    // races are deployment trouble, not a bad title.
                    if (error instanceof SessionTitleInvalidError) {
                        return err(request, {
                            code: 'title-invalid',
                            message: error.message,
                            details: { sessionId },
                        });
                    }
                    return err(request, {
                        code: 'internal',
                        message: `failed to rename session "${sessionId}": ${String(error)}`,
                        details: {},
                    });
                }
            },
            async fork(request) {
                const { sessionId, atSeq } = request.payload;
                let source;
                try {
                    source = await readSessionState(sessionId);
                }
                catch (error) {
                    if (error instanceof SessionNotFound) {
                        return err(request, { code: 'session-not-found', message: error.message, details: { sessionId } });
                    }
                    return err(request, {
                        code: 'internal',
                        message: `fork source unavailable for session "${sessionId}": ${String(error)}`,
                        details: {},
                    });
                }
                const events = source.events;
                // An in-log anchor belongs to the turn containing it and must never
                // clip backward to an earlier completed turn. Omitted and past-end
                // anchors retain the last-completed-turn shortcut.
                const lastSeq = events.at(-1)?.seq ?? -1;
                const anchoredBoundary = atSeq === undefined
                    ? undefined
                    : events.find(e => e.type === 'turn/end' && e.seq >= atSeq);
                const boundary = anchoredBoundary
                    ?? (atSeq === undefined || atSeq > lastSeq
                        ? events.findLast(e => e.type === 'turn/end')
                        : undefined);
                if (boundary === undefined) {
                    return err(request, {
                        code: 'fork-unavailable',
                        message: atSeq !== undefined && atSeq <= lastSeq
                            ? `session "${sessionId}" has not completed the turn containing event ${String(atSeq)}`
                            : `session "${sessionId}" has no completed turn to fork from`,
                        details: { sessionId },
                    });
                }
                // Extend the cut through trailing out-of-band appends (session/title,
                // injections) up to the next turn/start: they are standalone events, so
                // the seed stays balanced, and the child inherits a title generated
                // right after the boundary turn.
                let cut = boundary.seq + 1;
                while (cut < events.length && events[cut]?.type !== 'turn/start')
                    cut++;
                let workspace;
                try {
                    workspace = await forkWorkspace(source);
                }
                catch (error) {
                    return err(request, {
                        code: 'internal',
                        message: `failed to resolve fork workspace for session "${sessionId}": ${String(error)}`,
                        details: {},
                    });
                }
                const childId = `session-${randomUUID()}`;
                try {
                    await ctx.agents.create({
                        sessionId: childId,
                        seed: events.slice(0, cut),
                        meta: {
                            ...source.header.cwd === undefined ? {} : { cwd: source.header.cwd },
                            parentSession: source.id,
                            seedLength: cut,
                        },
                        agentOptions,
                        setup: installTarget,
                    });
                }
                catch (error) {
                    return err(request, {
                        code: 'internal',
                        message: `failed to fork session "${sessionId}": ${String(error)}`,
                        details: {},
                    });
                }
                // An ordinary source keeps its direct Workspace. A subagent source is
                // not listed there, so its ordinary fork joins the nearest owning
                // ancestor instead. The child is already published if attach fails.
                if (workspace !== undefined) {
                    try {
                        await workspace.attachSession(childId);
                    }
                    catch (error) {
                        return err(request, {
                            code: 'workspace-attach-failed',
                            message: `session "${childId}" was forked but could not attach to workspace "${workspace.id}": ${String(error)}`,
                            details: { sessionId: childId, workspaceId: workspace.id },
                        });
                    }
                }
                return ok(request, { sessionId: childId });
            },
            async prompt(request) {
                const { sessionId, mode, content } = request.payload;
                const found = await agentFor(sessionId);
                if ('error' in found)
                    return err(request, found.error);
                const agent = found.agent;
                // The rpcId rides MessageSource into user/message (merge declaration in api/sessions.ts; provisional correlation).
                const source = { kind: 'user', rpcId: request.rpcId };
                try {
                    const message = createUserMessage({ content, source });
                    if (mode === 'steer')
                        agent.steer(message);
                    else
                        agent.followup(message);
                }
                catch (error) {
                    // A synchronous throw from steer/followup means disposed or invalid input; surface as agent-busy with the reason attached.
                    return err(request, { code: 'agent-busy', message: 'prompt rejected', details: { reason: String(error) } });
                }
                return ok(request, { accepted: true });
            },
            updateQueue(request) {
                const { sessionId, itemId, action } = request.payload;
                const agent = ctx.agents.get(sessionId);
                if (agent !== undefined && hasSubagentOwner(agent.session, agent)) {
                    return Promise.resolve(err(request, subagentOwnershipError(sessionId)));
                }
                if (agent === undefined) {
                    return Promise.resolve(err(request, {
                        code: 'queue-item-not-found',
                        message: 'queued item is no longer pending',
                        details: { itemId },
                    }));
                }
                const target = agent.inbox.nextTurn.some(message => message.id === itemId)
                    ? 'next-turn'
                    : agent.inbox.nextStep.some(message => message.id === itemId) ? 'next-step' : undefined;
                const message = target === undefined
                    ? undefined
                    : (target === 'next-turn' ? agent.inbox.nextTurn : agent.inbox.nextStep)
                        .find(candidate => candidate.id === itemId);
                if (target === undefined || message === undefined) {
                    return Promise.resolve(err(request, {
                        code: 'queue-item-not-found',
                        message: 'queued item is no longer pending',
                        details: { itemId },
                    }));
                }
                if (action.kind === 'steer' && (target !== 'next-turn' || agent.status !== 'running')) {
                    return Promise.resolve(err(request, {
                        code: 'steer-unavailable',
                        message: 'current turn no longer accepts steering',
                        details: { itemId },
                    }));
                }
                if (action.kind === 'edit') {
                    agent.inbox.replace(itemId, freezeMessage({ ...message, content: action.content }));
                }
                else {
                    agent.inbox.remove(itemId);
                    if (action.kind === 'steer')
                        agent.steer(message);
                }
                return Promise.resolve(ok(request, { accepted: true }));
            },
            cancel(request) {
                const { sessionId } = request.payload;
                const agent = ctx.agents.get(sessionId);
                if (agent === undefined) {
                    return Promise.resolve(err(request, {
                        code: 'session-not-found',
                        message: `session "${sessionId}" not found (not attached)`,
                        details: { sessionId },
                    }));
                }
                if (hasSubagentOwner(agent.session, agent)) {
                    return Promise.resolve(err(request, subagentOwnershipError(sessionId)));
                }
                agent.cancel({ kind: 'user' }, { keepInbox: true });
                return Promise.resolve(ok(request, { accepted: true }));
            },
        },
        subagents: {
            async list(request, signal) {
                try {
                    const entries = await ctx.subagents.listChildren(request.payload.parentSessionId, signal);
                    return ok(request, {
                        entries: entries.map(entry => entry.kind === 'child'
                            ? {
                                ...entry,
                                activity: ctx.agents.get(entry.id)?.status === 'running' ? 'running' : 'inactive',
                            }
                            : entry),
                        parentAvailable: ctx.agents.get(request.payload.parentSessionId) !== undefined,
                    });
                }
                catch (error) {
                    if (signal?.aborted
                        || (error instanceof SubagentError && error.code === 'CANCELLED')
                        || (error instanceof SessionQueryError && error.code === 'SESSION_QUERY_ABORTED')) {
                        return err(request, {
                            code: 'cancelled',
                            message: 'subagent catalog read was cancelled',
                            details: {},
                        });
                    }
                    return err(request, {
                        code: 'internal',
                        message: 'subagent catalog read failed',
                        details: {},
                    });
                }
            },
            async history(request, signal) {
                const { parentSessionId, childSessionId, mode, beforeSeq, maxMessages, } = request.payload;
                const verified = await catalogChild(ctx, {
                    parentSessionId, childSessionId, mode,
                }, signal);
                if (verified.error !== undefined)
                    return err(request, verified.error);
                try {
                    const snapshot = await ctx.sessionQuery.readSession(childSessionId);
                    signal?.throwIfAborted();
                    if (snapshot.session.parentSession !== parentSessionId) {
                        return err(request, {
                            code: 'subagent-unauthorized',
                            message: 'subagent parent changed during history read',
                            details: { childSessionId },
                        });
                    }
                    const page = historyPage(ctx, snapshot.events, beforeSeq, maxMessages);
                    const projections = beforeSeq === undefined
                        ? detachedProjectionsFor(ctx, snapshot.events)
                        : undefined;
                    return ok(request, { ...page, ...projections === undefined ? {} : { projections } });
                }
                catch (error) {
                    if (signal?.aborted
                        || (error instanceof SessionQueryError && error.code === 'SESSION_QUERY_ABORTED')) {
                        return err(request, {
                            code: 'cancelled',
                            message: 'subagent history read was cancelled',
                            details: {},
                        });
                    }
                    if (error instanceof SessionQueryError
                        && error.code === 'SESSION_QUERY_SESSION_NOT_FOUND') {
                        return err(request, {
                            code: 'subagent-not-found',
                            message: 'subagent disappeared during history read',
                            details: { parentSessionId, childSessionId },
                        });
                    }
                    return err(request, {
                        code: 'internal',
                        message: 'subagent history read failed',
                        details: {},
                    });
                }
            },
            async prompt(request, signal) {
                const { parentSessionId, childSessionId, content } = request.payload;
                const parent = ctx.agents.get(parentSessionId);
                if (parent === undefined) {
                    return err(request, {
                        code: 'subagent-parent-unavailable',
                        message: `parent session "${parentSessionId}" is not live`,
                        details: { parentSessionId },
                    });
                }
                const verified = await catalogChild(ctx, {
                    parentSessionId, childSessionId, mode: 'continuable',
                }, signal);
                if (verified.error !== undefined)
                    return err(request, verified.error);
                try {
                    const messageId = await ctx.subagents.followup(parent, childSessionId, content, {
                        source: { kind: 'user', rpcId: request.rpcId },
                        signal,
                    });
                    return ok(request, { messageId });
                }
                catch (error) {
                    return subagentPromptError(request, error, signal);
                }
            },
        },
        workspace: {
            list(request) {
                return Promise.resolve(ok(request, {
                    items: ctx.workspace.list().map(workspaceView),
                    archivedSessionIds: [...ctx.workspace.archivedSessionIds],
                }));
            },
            // Exactly one of path/name arrives (schema refine). Existing-folder
            // adoption reuses its canonical path; create-by-name rejects a name
            // already present in the registry.
            // TODO: the create-by-name branch lost its last product consumer when
            // the Web picker collapsed onto the directory flow
            // (.agents/notes/implemented/simplification/2026-07-31-one-route-to-add-a-workspace.md).
            // Delete it with the wire schema's `name` member, this
            // `defaults.workspaceRoot`, the client seam that carried the name
            // (`WorkspaceCreateInput`, `WorkspacesService.create`'s `{ name }` arm,
            // `intentName`'s name branch, the manager's "name under workspaceRoot"
            // contract), and the `dsh web --workspace-root` flag plus its apps/cli
            // README lines, which exist only to feed it.
            async create(request) {
                const { payload } = request;
                let path;
                if (payload.name !== undefined) {
                    const name = payload.name.trim();
                    if (name === '' || name === '.' || name === '..' || /[/\\]/.test(name)) {
                        return err(request, {
                            code: 'workspace-invalid-path',
                            message: `workspace name must be one non-empty path segment, got "${payload.name}"`,
                            details: { path: payload.name },
                        });
                    }
                    path = join(defaults.workspaceRoot, name);
                }
                else {
                    path = payload.path;
                }
                try {
                    const name = payload.name?.trim();
                    const { workspace, created } = await ensureWorkspace(path, name, name !== undefined, name !== undefined);
                    return ok(request, { workspace: workspaceView(workspace), created });
                }
                catch (error) {
                    if (error instanceof WorkspaceNameConflictError) {
                        return err(request, {
                            code: 'workspace-name-conflict',
                            message: error.message,
                            details: { name: error.workspaceName },
                        });
                    }
                    if (error instanceof WorkspaceDirectoryCreationError) {
                        return err(request, { code: 'internal', message: error.message, details: {} });
                    }
                    // The registry rejects a path that does not resolve to an existing
                    // directory (realpath ENOENT / not-a-directory) — the business
                    // error of the typed-path flow, surfaced as a validation failure.
                    return err(request, {
                        code: 'workspace-invalid-path',
                        message: `cannot create a workspace at "${path}": ${error instanceof Error ? error.message : String(error)}`,
                        details: { path },
                    });
                }
            },
            async rename(request) {
                const { payload } = request;
                const workspace = ctx.workspace.get(brandWorkspaceId(payload.workspaceId));
                if (workspace === undefined)
                    return workspaceNotFound(request, payload.workspaceId);
                const title = payload.title.trim();
                // Uniqueness AND the same-title no-op both ride the create chain so
                // they observe the state left by earlier queued renames — checked
                // up front, a queued A→A could report success while an earlier A→B
                // still lands afterwards.
                const operation = workspaceCreationChain.then(async () => {
                    if (title === workspace.title)
                        return;
                    if (ctx.workspace.list().some(other => other.id !== workspace.id && other.title === title)) {
                        throw new WorkspaceNameConflictError(title);
                    }
                    await workspace.setTitle(title);
                });
                workspaceCreationChain = operation.then(() => undefined, () => undefined);
                try {
                    await operation;
                }
                catch (error) {
                    if (error instanceof WorkspaceNameConflictError) {
                        return err(request, {
                            code: 'workspace-name-conflict',
                            message: error.message,
                            details: { name: error.workspaceName },
                        });
                    }
                    throw error;
                }
                return ok(request, { workspace: workspaceView(workspace) });
            },
            async delete(request) {
                const { workspaceId } = request.payload;
                const operation = workspaceCreationChain.then(() => ctx.workspace.delete(brandWorkspaceId(workspaceId)));
                workspaceCreationChain = operation.then(() => undefined, () => undefined);
                if (!await operation)
                    return workspaceNotFound(request, workspaceId);
                return ok(request, { deleted: true });
            },
            async insertSessionBefore(request) {
                const { payload } = request;
                const workspace = ctx.workspace.get(brandWorkspaceId(payload.workspaceId));
                if (workspace === undefined)
                    return workspaceNotFound(request, payload.workspaceId);
                try {
                    await workspace.insertSessionBefore(payload.sessionId, payload.beforeSessionId);
                }
                catch (error) {
                    // Only the entity's unaccounted-id rejection is the business code;
                    // storage/durability failures propagate as internal errors.
                    if (!(error instanceof WorkspaceMoveInvalidError))
                        throw error;
                    return err(request, {
                        code: 'workspace-move-invalid',
                        message: error.message,
                        details: {
                            workspaceId: payload.workspaceId,
                            sessionId: payload.sessionId,
                            ...payload.beforeSessionId === undefined ? {} : { beforeSessionId: payload.beforeSessionId },
                        },
                    });
                }
                return ok(request, { workspace: workspaceView(workspace) });
            },
            async archiveSession(request) {
                const { sessionId } = request.payload;
                try {
                    await ctx.workspace.archiveSession(sessionId);
                }
                catch (error) {
                    // Only the registry's unknown-session rejection is the business
                    // code; storage/durability failures propagate as internal errors.
                    if (!(error instanceof WorkspaceUnknownSessionError))
                        throw error;
                    return err(request, {
                        code: 'session-not-found',
                        message: error.message,
                        details: { sessionId },
                    });
                }
                return ok(request, { archivedSessionIds: [...ctx.workspace.archivedSessionIds] });
            },
        },
        host: {
            describe(request) {
                // TODO(step2): version should read apps/cli's package.json; placeholder for now.
                return Promise.resolve(ok(request, {
                    version: '0.0.1',
                    // Same source as session.create's fallback: the UI's default project
                    // must match where an unspecified-cwd session actually lands.
                    cwd: defaults.cwd,
                    provider: defaults.provider,
                    model: defaults.model,
                    attachedSessions: ctx.agents.list().length,
                }));
            },
            async pickDirectory(request, signal) {
                const capability = ctx.directoryPicker.capability();
                if (capability.kind !== 'native') {
                    return err(request, {
                        code: 'directory-picker-unavailable',
                        message: `host.pickDirectory needs the native capability; the composed picker serves "${capability.kind}"`,
                        details: { capability: capability.kind },
                    });
                }
                try {
                    const path = await capability.pick(signal);
                    return ok(request, { path });
                }
                catch (error) {
                    if (signal.aborted) {
                        return err(request, {
                            code: 'cancelled',
                            message: 'directory picker was aborted',
                            details: {},
                        });
                    }
                    return err(request, {
                        code: 'internal',
                        message: `directory picker failed: ${error instanceof Error ? error.message : String(error)}`,
                        details: {},
                    });
                }
            },
            async listDirectory(request, signal) {
                const capability = ctx.directoryPicker.capability();
                if (capability.kind !== 'browse') {
                    return err(request, {
                        code: 'directory-picker-unavailable',
                        message: `host.listDirectory needs the browse capability; the composed picker serves "${capability.kind}"`,
                        details: { capability: capability.kind },
                    });
                }
                try {
                    // The carrier's signal follows the caller: a disconnect or timeout
                    // stops the backend's directory scan instead of outliving it.
                    return ok(request, await capability.list(request.payload.path, signal));
                }
                catch (error) {
                    // An abort is the caller's own timeout/disconnect, not a server
                    // failure — same code pickDirectory and command.execute report.
                    if (signal.aborted) {
                        return err(request, { code: 'cancelled', message: 'directory listing was aborted', details: {} });
                    }
                    return err(request, directoryError(error));
                }
            },
            async createDirectory(request) {
                const capability = ctx.directoryPicker.capability();
                if (capability.kind !== 'browse') {
                    return err(request, {
                        code: 'directory-picker-unavailable',
                        message: `host.createDirectory needs the browse capability; the composed picker serves "${capability.kind}"`,
                        details: { capability: capability.kind },
                    });
                }
                try {
                    return ok(request, { path: await capability.createDirectory(request.payload.path, request.payload.name) });
                }
                catch (error) {
                    return err(request, directoryError(error));
                }
            },
            async openPath(request, signal) {
                return openPath(request, request.payload.path, signal);
            },
        },
        commands: {
            // Both methods address one session's agent. agentFor resumes on miss
            // and fences every subagent-owned identity with `agent-busy`; the
            // api/commands.ts module contract owns that fence's wording, so this
            // comment only notes the routing shape: clients send a sessionId for a
            // published session, and resume restores an existing entity.
            async list(request) {
                // Missing service = the deployment omitted dsh-commands from its
                // composition, not an empty catalog: fail loud instead of serving [].
                const commands = ctx.get('commands');
                if (commands === undefined) {
                    return err(request, { code: 'internal', message: 'command registry is absent: this deployment does not mount @deepseek-ai/dsh-commands in its composition (cordis.yml or explicit assembly)', details: {} });
                }
                const found = await agentFor(request.payload.sessionId);
                if ('error' in found)
                    return err(request, found.error);
                return ok(request, { commands: commands.list(found.agent) });
            },
            async execute(request, signal) {
                const commands = ctx.get('commands');
                if (commands === undefined) {
                    return err(request, { code: 'internal', message: 'command registry is absent: this deployment does not mount @deepseek-ai/dsh-commands in its composition (cordis.yml or explicit assembly)', details: {} });
                }
                const { sessionId, line } = request.payload;
                const found = await agentFor(sessionId);
                if ('error' in found)
                    return err(request, found.error);
                try {
                    // Pure admission: the executor's durable command/run + command/done
                    // pair (broadcast on the mux stream) carries the outcome; the
                    // response reports whether the line resolved to a handler, plus the
                    // minted pairing id so the issuing client can correlate its request
                    // with the flow node the lifecycle events produce.
                    const execution = await commands.execute(found.agent, line, signal);
                    return ok(request, execution === undefined
                        ? { matched: false }
                        : { matched: true, commandId: execution.commandId });
                }
                catch (error) {
                    if (signal.aborted)
                        return err(request, { code: 'cancelled', message: 'command execution was aborted', details: {} });
                    return err(request, { code: 'internal', message: `command failed: ${String(error)}`, details: {} });
                }
            },
        },
        goals: {
            // Mutations only — the read side is the 'goal' session projection.
            // Every verb resolves the session's agent (agentFor: implicit cold
            // resume, the command.* precedent) and acknowledges with the new CAS
            // ref; the committed goal/change event carries the whole value to every
            // client through the projection frames.
            async create(request) {
                const { objective, maxGoalRounds } = request.payload;
                return mutateGoal(request, (goals, agent) => goals.create(agent, {
                    objective,
                    ...(maxGoalRounds !== undefined ? { maxGoalRounds } : {}),
                }));
            },
            async edit(request) {
                const { ref, objective, maxGoalRounds } = request.payload;
                return mutateGoal(request, (goals, agent) => goals.edit(agent, ref, {
                    ...(objective !== undefined ? { objective } : {}),
                    ...(maxGoalRounds !== undefined ? { maxGoalRounds } : {}),
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
                if ('error' in goals)
                    return err(request, goals.error);
                const found = await agentFor(request.payload.sessionId);
                if ('error' in found)
                    return err(request, found.error);
                try {
                    goals.clear(found.agent, request.payload.ref);
                    return ok(request, { cleared: true });
                }
                catch (error) {
                    return goalError(request, error);
                }
            },
        },
        skills: {
            // Skill lookup never touches the Agent registry: the session address
            // resolves to a canonical cwd from the host-resident session header, so
            // listing skills cannot create or resume an agent as a side effect.
            async list(request) {
                const { sessionId } = request.payload;
                const session = ctx.sessions.get(sessionId);
                if (session === undefined) {
                    return err(request, {
                        code: 'session-not-found',
                        message: `session "${sessionId}" not found (not attached)`,
                        details: { sessionId },
                    });
                }
                if (session.header.cwd === undefined) {
                    // Every served session records its project at create time; a
                    // cwd-less header is a pre-project legacy log (not served).
                    return err(request, { code: 'internal', message: `session "${sessionId}" has no project cwd`, details: {} });
                }
                const cwd = session.header.cwd;
                // Same stance as the commands domain: a missing service means the
                // deployment omitted dsh-skill from its composition, not an empty
                // catalog. ctx.get also keeps this handler independent of the gateway
                // plugin's inject list (an undeclared `ctx.skills` property read
                // fails the reflect proxy).
                const skillRegistry = ctx.get('skills');
                if (skillRegistry === undefined) {
                    return err(request, { code: 'internal', message: 'skill registry is absent: this deployment does not mount @deepseek-ai/dsh-skill in its composition (cordis.yml or explicit assembly)', details: {} });
                }
                try {
                    const skills = (await skillRegistry.list({ cwd }))
                        .filter(skill => skill.invocation.modelInvocable && skill.invocation.userInvocable);
                    return ok(request, {
                        skills: skills.map(skill => ({
                            name: skill.name,
                            description: skill.description,
                            ...skill.whenToUse === undefined ? {} : { whenToUse: skill.whenToUse },
                        })),
                    });
                }
                catch (error) {
                    return err(request, { code: 'internal', message: `skill listing failed: ${String(error)}`, details: {} });
                }
            },
        },
        settings: {
            describe(request) {
                const settings = ctx.get('settings');
                if (settings === undefined)
                    return Promise.resolve(err(request, settingsAbsent()));
                const exposed = exposedNamespaces();
                return Promise.resolve(ok(request, {
                    writable: settings.writable,
                    hasDocument: settings.documentPath !== undefined,
                    namespaces: settings.describe({ redactSecrets: true })
                        .filter(descriptor => exposed.has(String(descriptor.ns)))
                        .map(namespaceView),
                }));
            },
            async openDocument(request, signal) {
                const settings = ctx.get('settings');
                if (settings === undefined)
                    return err(request, settingsAbsent());
                if (isAborted(signal)) {
                    return err(request, {
                        code: 'cancelled',
                        message: 'settings document open was aborted',
                        details: {},
                    });
                }
                let path;
                try {
                    path = await settings.prepareDocument();
                }
                catch (error) {
                    if (isAborted(signal)) {
                        return err(request, {
                            code: 'cancelled',
                            message: 'settings document preparation was aborted',
                            details: {},
                        });
                    }
                    return err(request, {
                        code: 'internal',
                        message: `settings document preparation failed: ${error instanceof Error ? error.message : String(error)}`,
                        details: {},
                    });
                }
                if (path === undefined) {
                    return err(request, {
                        code: 'internal',
                        message: 'settings provider has no local document to open',
                        details: {},
                    });
                }
                if (isAborted(signal)) {
                    return err(request, {
                        code: 'cancelled',
                        message: 'settings document open was aborted',
                        details: {},
                    });
                }
                return openTextFile(request, path, signal);
            },
            update: request => settingsWrite(request, request.payload.ns, 'update', request.payload.patch, request.payload.expectedRevision),
            replace: request => settingsWrite(request, request.payload.ns, 'replace', request.payload.section, request.payload.expectedRevision),
            mutate: request => settingsWrite(request, request.payload.ns, 'mutate', request.payload.ops, request.payload.expectedRevision),
        },
        credentials: {
            async describe(request) {
                const credentials = ctx.get('credentials');
                if (credentials === undefined)
                    return err(request, credentialsAbsent());
                const entries = await Promise.all(request.payload.refs.map(async (ref) => {
                    const info = await credentials.describe(credentialRef(ref));
                    const view = {
                        configured: info.configured,
                        ...info.source === undefined ? {} : { source: info.source },
                        writable: info.writable,
                    };
                    return [ref, view];
                }));
                return ok(request, { credentials: Object.fromEntries(entries) });
            },
            async set(request) {
                const credentials = ctx.get('credentials');
                if (credentials === undefined)
                    return err(request, credentialsAbsent());
                const { ref, value } = request.payload;
                try {
                    await credentials.set(credentialRef(ref), value);
                }
                catch (error) {
                    return err(request, {
                        code: 'credential-rejected',
                        message: error instanceof Error ? error.message : String(error),
                        details: { ref },
                    });
                }
                return ok(request, {});
            },
            async unset(request) {
                const credentials = ctx.get('credentials');
                if (credentials === undefined)
                    return err(request, credentialsAbsent());
                const { ref } = request.payload;
                try {
                    await credentials.unset(credentialRef(ref));
                }
                catch (error) {
                    return err(request, {
                        code: 'credential-rejected',
                        message: error instanceof Error ? error.message : String(error),
                        details: { ref },
                    });
                }
                return ok(request, {});
            },
        },
        llm: {
            providers(request) {
                const registered = ctx.llm.listProviders();
                const active = new Set(registered.map(provider => provider.id));
                const directory = ctx.llm.listConfigurableProviders();
                const declared = new Set(directory.map(entry => entry.provider));
                const views = directory.map(entry => ({
                    provider: entry.provider,
                    displayName: entry.displayName,
                    settingsNs: entry.settingsNs,
                    settingsPath: [...entry.settingsPath],
                    active: active.has(entry.provider),
                }));
                // Routes registered without a directory declaration still appear —
                // they exist and serve models — just with no settings address.
                for (const provider of registered) {
                    if (declared.has(provider.id))
                        continue;
                    views.push({
                        provider: provider.id,
                        displayName: provider.name,
                        settingsNs: '',
                        settingsPath: [],
                        active: true,
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
                    const models = await ctx.llm.discoverModels(settingsNs, {
                        ...provider === undefined ? {} : { provider },
                        ...baseURL === undefined ? {} : { baseURL },
                        ...api === undefined ? {} : { api },
                        ...apiKey === undefined ? {} : { apiKey },
                        ...signal === undefined ? {} : { signal },
                    });
                    return ok(request, { models });
                }
                catch (error) {
                    // Every failure here is the user's next move, not a transport fault:
                    // a wrong endpoint, a rejected key, or a protocol with no listing all
                    // end at the same place — fill the models in by hand. The details
                    // repeat only what the caller already sent, never the credential.
                    return err(request, {
                        code: 'model-discovery-failed',
                        message: error instanceof Error ? error.message : String(error),
                        details: { settingsNs, ...baseURL === undefined ? {} : { baseURL } },
                    });
                }
            },
        },
        events: {
            mux(_request, signal) {
                const queue = new FrameQueue();
                muxQueues.add(queue);
                for (const session of ctx.sessions.list()) {
                    subscribeSession(queue, session);
                }
                for (const pending of pendingQuestions.values()) {
                    queue.push({
                        rpcId: pending.rpcId,
                        payload: {
                            type: 'question/requested', sessionId: pending.sessionId,
                            questions: pending.questions,
                        },
                    });
                }
                // Refresh recovery: still-pending approval questions replay with their
                // stable rpcId so a reconnecting client can still answer them.
                for (const pending of pendingApprovals.values())
                    queue.push(requestedFrame(pending));
                // Queue snapshot baseline (pendingQuestions precedent): frames replayed
                // in arrival order per session; a reconnecting client rebuilds its
                // queue view from these alone.
                for (const session of ctx.sessions.list()) {
                    const agent = ctx.agents.get(session.id);
                    if (agent?.session === session && agent.inbox.hasPending) {
                        queue.push(frame({ type: 'session/queue', sessionId: session.id, items: queueItems(agent) }));
                    }
                }
                // Per-session open-call table for result-view pairing. Bounded by the
                // per-turn call count: entries clear on turn/end; a table miss (stream
                // opened mid-turn) backscans the session's in-memory events instead.
                const openCalls = new Map();
                const disposers = [
                    ctx.on('session/event', (session, event) => {
                        if (event.type === 'tool/call') {
                            const data = event.data;
                            try {
                                let table = openCalls.get(session.id);
                                if (table === undefined)
                                    openCalls.set(session.id, table = new Map());
                                table.set(data.callId, { name: data.name, args: JSON.parse(data.arguments) });
                            }
                            catch {
                                // Unparseable model arguments: leave the table unset; the result view soft-falls.
                            }
                        }
                        else if (event.type === 'turn/end') {
                            openCalls.delete(session.id);
                        }
                        const view = viewFor(ctx, event, callId => openCalls.get(session.id)?.get(callId) ?? backscanArgs(session.events, callId));
                        queue.push(frame({ type: 'session/event', sessionId: session.id, event, ...view === undefined ? {} : { view } }));
                    }),
                    ctx.on('session/created', (session) => {
                        subscribeSession(queue, session);
                    }),
                    ctx.on('session/disposed', (session) => {
                        openCalls.delete(session.id);
                    }),
                ];
                return queue.iterate(signal, () => {
                    muxQueues.delete(queue);
                    for (const dispose of disposers)
                        dispose();
                });
            },
            host(_request, signal) {
                const queue = new FrameQueue();
                const committedWorkspaceIds = new Set(ctx.workspace.list().map(workspace => String(workspace.id)));
                // Frame-dedup baseline, same posture as committedWorkspaceIds: the
                // stream opens against the current set; workspace.list re-baselines
                // reconnecting clients, so only later changes need frames.
                let archivedSessionIds = ctx.workspace.archivedSessionIds;
                const disposers = [
                    ctx.on('session/created', (session) => {
                        queue.push(frame({
                            type: 'host/session-added',
                            sessionId: session.id,
                            // Derived at frame time like summarize(); a just-created session
                            // has run no turn yet, so this is constantly true in practice.
                            blank: sessionBlank(session),
                            // Including cwd lets the client group the new session without refreshing the list.
                            ...sessionListFields(session.header),
                        }));
                    }),
                    ctx.on('session/disposed', (session) => {
                        queue.push(frame({ type: 'host/session-removed', sessionId: session.id }));
                    }),
                    ctx.on('agent/status', ({ agent, status }) => {
                        queue.push(frame({ type: 'host/session-status', sessionId: agent.id, running: status === 'running' }));
                    }),
                    ctx.on('agent/error', ({ agent, error }) => {
                        queue.push(frame({ type: 'host/agent-error', sessionId: agent.id, message: errorChain(error) }));
                    }),
                    ctx.on('domain/changed', (change) => {
                        if (change.domain !== 'workspace')
                            return;
                        if (change.table === '') {
                            if (change.operation !== 'put')
                                return;
                            const state = workspaceDomainState.parse(change.value);
                            for (const workspaceId of state.workspaceIds) {
                                if (committedWorkspaceIds.has(workspaceId))
                                    continue;
                                const workspace = ctx.workspace.get(workspaceId);
                                if (workspace === undefined) {
                                    throw new Error(`committed workspace registry references missing workspace "${workspaceId}"`);
                                }
                                committedWorkspaceIds.add(workspaceId);
                                queue.push(frame({ type: 'host/workspace-changed', workspace: workspaceView(workspace) }));
                            }
                            if (state.archivedSessionIds.length !== archivedSessionIds.length
                                || state.archivedSessionIds.some((id, index) => id !== archivedSessionIds[index])) {
                                archivedSessionIds = state.archivedSessionIds;
                                queue.push(frame({
                                    type: 'host/archived-sessions-changed',
                                    archivedSessionIds: [...state.archivedSessionIds],
                                }));
                            }
                            return;
                        }
                        if (change.table !== 'workspaces')
                            return;
                        if (change.operation === 'deleted') {
                            if (!committedWorkspaceIds.delete(change.key))
                                return;
                            queue.push(frame({
                                type: 'host/workspace-removed',
                                workspaceId: change.key,
                            }));
                            return;
                        }
                        if (!committedWorkspaceIds.has(change.key))
                            return;
                        // Existing-entity table writes are complete attach/touch commits.
                        // A new entity's first put waits for the global registry write above.
                        queue.push(frame({
                            type: 'host/workspace-changed',
                            workspace: changedWorkspaceView(change.key, change.value),
                        }));
                    }),
                    ctx.on('commands/change', () => {
                        queue.push(frame({ type: 'host/commands-changed' }));
                    }),
                    ctx.on('settings/document-updated', (ns) => {
                        // The RAW-section event, not the resolved one: a field going from
                        // inherited to overridden leaves the resolved value equal, and a
                        // configuration client still has to re-read (its held revision is
                        // stale, and the field's meaning changed).
                        const name = String(ns);
                        queue.push(frame({ type: 'host/settings-changed', ns: name }));
                        // A provider's own settings carry its model catalog and endpoint,
                        // so a change there invalidates the model list even when the route
                        // set is untouched — `llm/adapters-updated` alone misses it.
                        if (modelProviderNamespaces().has(name))
                            queue.push(frame({ type: 'host/models-changed' }));
                    }),
                    ctx.on('credentials/updated', (ref) => {
                        queue.push(frame({ type: 'host/credentials-changed', ref: String(ref) }));
                    }),
                    ctx.on('llm/adapters-updated', () => {
                        queue.push(frame({ type: 'host/models-changed' }));
                    }),
                ];
                return queue.iterate(signal, () => { for (const dispose of disposers)
                    dispose(); });
            },
        },
        respond(message) {
            // Route by the echoed rpcId (the wire correlation): approvals first,
            // then questions — the two registries share one id space of UUIDs.
            const approval = pendingApprovals.get(message.rpcId);
            if (approval !== undefined) {
                if (!message.result.ok)
                    return Promise.resolve({ accepted: false, reason: 'bad-response' });
                const parsed = approvalResponsePayloadSchema.safeParse(message.result.value);
                // The payload's audit correlation must match the entry the rpcId routed
                // to — a mismatched answer is malformed, not merely late.
                if (!parsed.success || parsed.data.approvalId !== approval.approvalId || parsed.data.sessionId !== approval.sessionId) {
                    return Promise.resolve({ accepted: false, reason: 'bad-response' });
                }
                approval.resolve(parsed.data.outcome);
                return Promise.resolve({ accepted: true });
            }
            const pending = pendingQuestions.get(message.rpcId);
            if (pending === undefined)
                return Promise.resolve({ accepted: false, reason: 'not-pending' });
            if (!message.result.ok) {
                if (message.result.error.code !== 'cancelled') {
                    return Promise.resolve({ accepted: false, reason: 'bad-response' });
                }
                claimQuestion(pending, 'cancelled');
                pending.reject(new UserInteractionError('the user cancelled ask_user_question', 'ASK_CANCELLED'));
                return Promise.resolve({ accepted: true });
            }
            const parsed = questionResponsePayloadSchema.safeParse(message.result.value);
            if (!parsed.success) {
                return Promise.resolve({ accepted: false, reason: 'bad-response' });
            }
            const payload = {
                sessionId: parsed.data.sessionId,
                answer: {
                    answers: parsed.data.answer.answers.map(answer => ({
                        id: answer.id,
                        selected: answer.selected,
                        ...(answer.custom === undefined ? {} : { custom: answer.custom }),
                    })),
                },
            };
            if (!matchesQuestions(payload, pending)) {
                return Promise.resolve({ accepted: false, reason: 'bad-response' });
            }
            claimQuestion(pending, 'answered');
            pending.resolve(payload.answer);
            return Promise.resolve({ accepted: true });
        },
    };
}
//# sourceMappingURL=api-proxy.js.map