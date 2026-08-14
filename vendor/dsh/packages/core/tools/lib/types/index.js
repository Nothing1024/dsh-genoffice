/**
 * Tool registry, model presentation modes, and pre/guard/around/post/result
 * execution pipeline.
 * @module @deepseek-ai/dsh-tools
 */
import { Service } from 'cordis';
import z from 'schemastery';
import { AnonymousEntries, NamedEntries, ScopedLayers, scopeOf, scopeTarget } from '@deepseek-ai/dsh-scope';
import { assertNever, deepFreeze, HarnessError } from '@deepseek-ai/dsh-llm';
import { snapshotJsonValue } from '@deepseek-ai/dsh-session';
import { assertSupportedJsonSchema, validateJsonSchemaValue } from "./json-schema.js";
import { createRunCodeTool, RUN_CODE_NAME, SDK_SECTION_ORDER } from "./code-mode.js";
import { renderToolsSdk } from "./ts-types.js";
export { defineTool, valueSchemaSpecToJsonSchema, parameterSchemaSpecToJsonSchema, validateArgs, ToolArgsError, } from "./schema.js";
export { assertSupportedJsonSchema, assertObjectJsonSchema, validateJsonSchemaValue, JsonSchemaError, } from "./json-schema.js";
export { CodeRunFailedError, RUN_CODE_NAME } from "./code-mode.js";
export { jsonSchemaToTs, renderToolsSdk } from "./ts-types.js";
export { defineContentToolFixture } from "./testing.js";
/**
 * Scheduler entry point omitted from the generated named service API.
 * @internal
 */
export const TOOL_REGISTRY_SCHEDULER = Symbol('@deepseek-ai/dsh-tools.scheduler');
/** Canonical error code for cancellation after a tool body was invoked. */
export const TOOL_ABORTED = 'ABORTED';
/** Canonical error code for cancellation before a tool body was invoked. */
export const TOOL_ABORTED_BEFORE_DISPATCH = 'ABORTED_BEFORE_DISPATCH';
/**
 * Thrown (internally) when the model requests a tool that isn't registered.
 * Extends {@link HarnessError} (`code: 'UNKNOWN_TOOL'`) so an unknown-tool
 * failure is as routable as a tool-thrown one — retry/sandbox/replay code can
 * distinguish it from a tool body's own error.
 */
export class ToolNotFoundError extends HarnessError {
    constructor(toolName) {
        super(`unknown tool "${toolName}"`, 'UNKNOWN_TOOL');
        this.name = 'ToolNotFoundError';
    }
}
/** Thrown when a tool body or post-policy value violates its declared output. */
export class ToolOutputError extends HarnessError {
    /** Schema/value violations in validation order. */
    violations;
    constructor(toolName, violations) {
        super(`tool "${toolName}" returned invalid output: ${violations.join('; ')}`, 'INVALID_TOOL_OUTPUT');
        this.name = 'ToolOutputError';
        this.violations = violations;
    }
}
/** Convert one projector exception into the canonical invalid-output failure. */
function projectionError(toolName, projector, error) {
    return new ToolOutputError(toolName, [`output.${projector} failed: ${errorMessage(error)}`]);
}
/** Snapshot one projector result before later durable-result materialization. */
function snapshotProjection(toolName, projector, candidate) {
    try {
        const detached = snapshotJsonValue(candidate);
        if (detached === undefined) {
            throw new ToolOutputError(toolName, [`output.${projector} returned non-lossless JSON`]);
        }
        return detached;
    }
    catch (error) {
        if (error instanceof ToolOutputError)
            throw error;
        throw projectionError(toolName, projector, error);
    }
}
/** Snapshot one body or policy value into the canonical invalid-output failure class. */
function snapshotToolValue(toolName, candidate) {
    try {
        const detached = snapshotJsonValue(candidate);
        if (detached === undefined)
            throw new ToolOutputError(toolName, ['value is not lossless JSON']);
        return detached;
    }
    catch (error) {
        if (error instanceof ToolOutputError)
            throw error;
        throw new ToolOutputError(toolName, [`value snapshot failed: ${errorMessage(error)}`]);
    }
}
/**
 * Best-effort human-readable message from an arbitrary thrown value: Error
 * instances use `.message`; non-Error objects with a string `message`
 * property (e.g. `throw { message: 'denied' }`) use it too; everything else
 * is stringified.
 */
function errorMessage(error) {
    try {
        if (error instanceof Error)
            return error.message;
        if (typeof error === 'object' && error !== null
            && 'message' in error && typeof error.message === 'string') {
            return error.message;
        }
        return String(error);
    }
    catch {
        // A hostile thrown value can trap `instanceof`, property access, or string
        // coercion. Error normalization is the outermost safety boundary, so its
        // fallback must itself be total.
        return '<unprintable thrown value>';
    }
}
/** Derive one failure message from policy feedback without changing its rendered blocks. */
function failureMessageFromContent(content) {
    const text = content
        .map(block => block.type === 'text' ? block.text : `[${block.type} content]`)
        .join('\n');
    return text.length > 0 ? text : 'tool result blocked by post-execute policy';
}
/** Snapshot and freeze one durable tool-result projection or reject lossy data. */
function materializePresentation(candidate) {
    const detached = snapshotJsonValue(candidate);
    if (detached === undefined) {
        throw new TypeError('tool result must be losslessly JSON-serializable');
    }
    return deepFreeze(detached);
}
/** Structured `{ name, code }` for a thrown HarnessError, else undefined. */
function errorInfo(error) {
    try {
        return error instanceof HarnessError ? { name: error.name, code: error.code } : undefined;
    }
    catch {
        return undefined;
    }
}
/** One scope's complete tool-registry contribution. */
class ToolLayer {
    tools;
    restrictions = new AnonymousEntries();
    guards = new AnonymousEntries();
    constructor(scope) {
        this.tools = new NamedEntries(name => new Error(scope === undefined
            ? `tool "${name}" is already registered (for a per-agent variant, register through that agent's \`agent.ctx\` instead)`
            : `tool "${name}" is already registered in this scope`));
    }
    /** Whether every contribution table in this aggregate layer is empty. */
    isEmpty() {
        return this.tools.isEmpty() && this.restrictions.isEmpty() && this.guards.isEmpty();
    }
    /** Whether every compiled restriction in this layer admits a global tool name. */
    admits(name) {
        for (const filter of this.restrictions.values()) {
            if ((filter.allow !== undefined && !filter.allow.has(name))
                || (filter.deny !== undefined && filter.deny.has(name)))
                return false;
        }
        return true;
    }
    /** First monotonic denial from this layer's live guard registrations. */
    guardReason(exec) {
        for (const guard of this.guards.values()) {
            const reason = guard(exec);
            if (reason !== undefined)
                return reason;
        }
        return undefined;
    }
}
/** Resolve the run_code overlap cap at the owning config boundary (direct construction bypasses the Loader schema). */
function resolveMaxParallelSubCalls(value) {
    const maxParallelSubCalls = value ?? 10;
    if (!Number.isInteger(maxParallelSubCalls) || maxParallelSubCalls < 1) {
        throw new Error('maxParallelSubCalls must be a positive integer');
    }
    return maxParallelSubCalls;
}
/**
 * Tool registry and execution pipeline. Scoped registrations shadow globals;
 * one visibility resolver feeds presentation, lookup, and dispatch.
 */
export class ToolRegistry extends Service {
    static inject = ['systemPrompt'];
    static Config = z.object({
        mode: z.union(['native', 'code', 'both']).default('native'),
        maxParallelSubCalls: z.natural().min(1).default(10),
    });
    /** Internal staged view consumed by `dsh-agent-loop`'s parallel scheduler. */
    [TOOL_REGISTRY_SCHEDULER] = {
        prepare: exec => this.prepareScheduledExecution(exec),
        dispatch: exec => this.dispatchScheduledExecution(exec),
        finalize: (exec, result) => this.finalizeScheduledExecution(exec, result),
        finish: (exec, result) => { return this.finishScheduledExecution(exec, result); },
    };
    /** Context deferred by a running tool body, keyed by its scheduler-owned execution. */
    deferredContexts = new WeakMap();
    /** Executions whose tool body declared the current turn complete. */
    concludingExecutions = new WeakSet();
    /** Original caller cancellation, kept outside the wrapper-mutable execution object. */
    cancellationStates = new WeakMap();
    /** Definition-owned final content transform snapshotted before policy begins. */
    contentFinalizers = new WeakMap();
    layers = new ScopedLayers(scope => new ToolLayer(scope), () => { this.ctx.emit('tools/change'); });
    mode;
    /** Reserved presentation transport, kept outside the filterable registration layers. */
    codeTransport;
    constructor(ctx, config = {}) {
        super(ctx, 'tools');
        // The schema already defaulted an omitted mode; the ?? narrows the
        // optional-input type for direct (non-Loader) construction in tests.
        this.mode = config.mode ?? 'native';
        // `run_code` is presentation infrastructure, not an end capability. It
        // therefore does not enter the global layer: per-agent restrictions must
        // not remove it, and a scoped registration must not shadow it. The
        // visibility resolver appends this reserved definition after resolving
        // the filterable global/scoped capability layers.
        this.codeTransport = this.mode === 'native'
            ? undefined
            : createRunCodeTool(this, {
                requireRuntime: () => this.requireCodeRuntime(),
                maxParallel: resolveMaxParallelSubCalls(config.maxParallelSubCalls),
                shapeDispatchLog: dispatch => this.shapeDispatchLog(dispatch),
            });
        ctx.systemPrompt.tools(context => this.wireSchemas(context.scope));
        if (this.mode !== 'native') {
            ctx.systemPrompt.section({
                name: 'tools:sdk',
                order: SDK_SECTION_ORDER,
                // Regenerate from the calling scope's visible tools in stable order.
                text: (context) => {
                    this.requireCodeRuntime();
                    return renderToolsSdk(this.sdkSchemas(context.scope));
                },
            });
        }
    }
    /**
     * Build one scope's wire schemas and names for prompt-order validation.
     * Restrictions do not make known tools invalid, but a mode collapse does.
     */
    wireSchemas(scope) {
        const view = this.view(scope);
        const schemas = [...view.visible.values()].map(definition => this.schemaOf(definition, false));
        if (this.mode === 'native') {
            return { schemas, knownNames: [...view.knownNames] };
        }
        this.requireCodeRuntime();
        if (this.mode === 'code') {
            return {
                schemas: schemas.filter(schema => schema.name === RUN_CODE_NAME),
                knownNames: [RUN_CODE_NAME],
            };
        }
        return { schemas, knownNames: [...view.knownNames, RUN_CODE_NAME] };
    }
    /**
     * Resolve the code runtime or throw the actionable misconfiguration error.
     * Read at use time (assembly / run_code execution), NOT via static
     * `inject`: an inject entry would hold `ctx.tools` — and every tool plugin
     * behind it — hostage to a code runtime existing even under `mode:
     * 'native'` (the loop's optional-backend idiom, same as
     * `sessionPersistence`).
     */
    requireCodeRuntime() {
        const runtime = this.ctx.get('codeRuntime');
        if (!runtime) {
            throw new Error(`dsh-tools: mode "${this.mode}" requires a code runtime — load a ctx.codeRuntime implementation (e.g. @deepseek-ai/dsh-code-runtime-worker) or set tools mode to "native"`);
        }
        if (runtime.language !== 'typescript') {
            throw new Error(`dsh-tools: mode "${this.mode}" generates a TypeScript SDK, but the loaded code runtime's language is "${runtime.language}"`);
        }
        return runtime;
    }
    /**
     * Register globally or in the calling agent scope. Scoped tools shadow
     * globals; duplicates within one layer and the reserved `run_code` name fail.
     * @param definition - tool schema, execution, and optional finalization/presentation callbacks.
     * @returns the exact disposer that unregisters the tool.
     */
    register(definition) {
        const name = definition.name;
        const output = definition.output;
        if (output === undefined || typeof output !== 'object'
            || typeof output.render !== 'function'
            || (output.presentationMeta !== undefined && typeof output.presentationMeta !== 'function')) {
            throw new TypeError(`tool "${name}" must declare output { schema, render, presentationMeta? }`);
        }
        assertSupportedJsonSchema(output.schema);
        const timeoutMs = definition.timeoutMs;
        if (timeoutMs !== undefined
            && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
            throw new TypeError(`tool "${name}" timeoutMs must be a positive finite number`);
        }
        if (this.codeTransport !== undefined && name === RUN_CODE_NAME) {
            throw new Error(`tool name "${RUN_CODE_NAME}" is reserved for the Code Mode presentation transport and cannot be registered or shadowed`);
        }
        return this.layers.effect(this.ctx, layer => layer.tools.insert(name, definition), { label: 'tools.register()' });
    }
    /**
     * Restrict global tools for the calling agent scope. Empty filters, unknown
     * names, scope-local names, and reserved transport names fail. Restrictions
     * intersect; scoped registrations remain visible.
     * @param filter - global-surface mask: `allow` (keep only) and/or `deny` (remove).
     * @returns the exact disposer that lifts this restriction.
     */
    restrict(filter) {
        const scope = scopeOf(this.ctx);
        if (scope === undefined) {
            throw new Error('tools.restrict() requires a scoped context (agent.ctx): a context-global restriction would mask every agent — deny the tool for the intended agent instead');
        }
        const allow = filter.allow;
        const deny = filter.deny;
        if (allow === undefined && deny === undefined) {
            throw new Error('tools.restrict({}) is a no-op: pass `allow` and/or `deny` (an empty filter is almost always a materialized-empty-config bug)');
        }
        const compiled = {
            ...allow !== undefined ? { allow: new Set(allow) } : {},
            ...deny !== undefined ? { deny: new Set(deny) } : {},
        };
        if (this.codeTransport !== undefined
            && [...allow ?? [], ...deny ?? []].includes(RUN_CODE_NAME)) {
            throw new Error(`tools.restrict() cannot name reserved Code Mode presentation transport "${RUN_CODE_NAME}"; restrict end-capability tools instead`);
        }
        const known = this.view(scope).restrictableNames;
        const unknown = [...allow ?? [], ...deny ?? []].filter(name => !known.has(name));
        if (unknown.length > 0) {
            throw new Error(`tools.restrict() names unknown global tool${unknown.length > 1 ? 's' : ''} ${unknown.map(n => `"${n}"`).join(', ')}; known global tools: ${[...known].sort().join(', ') || '(none)'}`);
        }
        return this.layers.effect(this.ctx, layer => layer.restrictions.append(compiled), { label: 'tools.restrict()' });
    }
    /**
     * Register a monotonic guard after the extensible `tools/pre-execute`
     * waterfall. A plain-context guard applies globally; one registered through
     * `agent.ctx` applies only to that agent. Any matching guard may deny by
     * returning a reason, while no guard can force-allow a call another guard
     * denied. The exact effect disposer is returned for ordered ownership and
     * HMR cleanup.
     * @param guard - synchronous check; a returned string denies the execution.
     * @returns the exact disposer that unregisters the guard.
     */
    guard(guard) {
        return this.layers.effect(this.ctx, layer => layer.guards.append(guard), { label: 'tools.guard()', notify: false });
    }
    /** First monotonic denial from the global then matching scoped guard layers. */
    guardReason(exec) {
        const globalReason = this.layers.global.guardReason(exec);
        if (globalReason !== undefined)
            return globalReason;
        return exec.agent === undefined ? undefined : this.layers.peek(exec.agent)?.guardReason(exec);
    }
    /**
     * Resolve every registry fact one scope needs in one layer traversal. The
     * visible map applies global restrictions, scoped shadowing, and the reserved
     * presentation transport; the other sets retain the pre-restriction facts
     * needed by restriction and prompt-order validation.
     * @param scope - the viewing scope (the agent), or undefined for the global view.
     * @returns the complete derived view for that scope.
     */
    view(scope) {
        const layer = this.layers.peek(scope);
        const visible = new Map();
        const knownNames = new Set();
        const restrictableNames = new Set();
        for (const [name, definition] of this.layers.global.tools.entries()) {
            knownNames.add(name);
            restrictableNames.add(name);
            if (layer?.admits(name) ?? true)
                visible.set(name, definition);
        }
        // Scoped layer second: same-name entries REPLACE (shadow) the global ones,
        // and scope-local registrations are never part of the global filter above.
        for (const [name, definition] of layer?.tools.entries() ?? []) {
            knownNames.add(name);
            visible.set(name, definition);
        }
        // Presentation infrastructure is resolved last and outside capability
        // filtering. Registration rejects this reserved name, so the insertion is
        // an invariant assertion as well as protection against future layer changes.
        if (this.codeTransport !== undefined) {
            visible.set(RUN_CODE_NAME, this.codeTransport);
        }
        return { visible, knownNames, restrictableNames };
    }
    /**
     * Look up a tool as one scope sees it (scoped
     * shadows global; a restricted-away global reads as absent). Presenters pass
     * the calling agent so the rendered card matches the definition that
     * actually executed.
     * @param name - the tool name as registered.
     * @param scope - the viewing scope (the agent); omitted = the global view.
     * @returns the definition the scope resolves, or undefined when none is visible.
     */
    get(name, scope) {
        return this.view(scope).visible.get(name);
    }
    /**
     * Project visible definitions onto the allowlisted model-facing schema fields,
     * excluding execution and presentation callbacks.
     * @param scope - the viewing scope (the agent); omitted = the global view.
     * @returns one deep-cloned schema per visible tool.
     */
    schemas(scope) {
        return [...this.view(scope).visible.values()].map(definition => this.schemaOf(definition, true));
    }
    /** Project visible callable tools onto the generated Code Mode SDK contract. */
    sdkSchemas(scope) {
        return [...this.view(scope).visible.values()]
            .filter(definition => definition.name !== RUN_CODE_NAME)
            .map((definition) => {
            const output = snapshotJsonValue(definition.output.schema);
            /* v8 ignore next -- registration already validated and retained this schema as lossless JSON. */
            if (output === undefined) {
                throw new Error(`tool "${definition.name}" output schema must be lossless JSON before SDK projection`);
            }
            return {
                ...this.schemaOf(definition, true),
                output,
            };
        });
    }
    /** Project one definition onto the model-facing schema fields. */
    schemaOf(definition, detachParameters) {
        const { name, description, parameters } = definition;
        const detached = detachParameters ? snapshotJsonValue(parameters) : parameters;
        if (detached === undefined) {
            throw new Error(`tool "${name}" parameters must be lossless JSON before schema projection`);
        }
        return {
            name,
            description,
            parameters: detached,
        };
    }
    /**
     * Classify a pending call through the caller's visible tool definition. Only
     * an exact `true` is parallel; unknown, hidden, undeclared, invalid, or
     * throwing classifiers are exclusive.
     * @param exec - call name, parsed arguments, and optional agent scope.
     * @returns the fail-closed scheduling mode.
     */
    executionMode(exec) {
        const tool = this.get(exec.name, exec.agent);
        if (!tool?.isConcurrencySafe)
            return { kind: 'exclusive' };
        try {
            const concurrencySafe = tool.isConcurrencySafe(exec.arguments);
            return concurrencySafe === true ? { kind: 'parallel' } : { kind: 'exclusive' };
        }
        catch {
            return { kind: 'exclusive' };
        }
    }
    /**
     * Run the `tools/code-dispatch-log` waterfall over one settled sub-dispatch
     * and return the content the bridge should log on `tool/code-dispatch`.
     * Contained: a throwing listener falls back to the unshaped content — log
     * shaping must never fail the dispatch or lose the settle event. Private:
     * the ONE consumer is the `run_code` bridge this registry constructs, which
     * receives it as a capability parameter (the `requireRuntime` idiom) — the
     * waterfall, not this invoker, is the public extension seam.
     */
    async shapeDispatchLog(dispatch) {
        try {
            return await this.ctx.waterfall(scopeTarget(this, dispatch.agent), 'tools/code-dispatch-log', dispatch, () => Promise.resolve(dispatch.content));
        }
        catch (error) {
            this.ctx.logger.warn(`tools: code-dispatch-log listener failed for ${dispatch.name}: ${errorMessage(error)}; logging the unshaped content`);
            return dispatch.content;
        }
    }
    /**
     * Execute through pre-policy, guards, around-dispatch, post-policy,
     * definition-owned content finalization, and final notification. Tool and
     * listener failures resolve as materialized error results; an invisible tool
     * reports `UNKNOWN_TOOL`. The returned outcome is the same lossless, frozen
     * snapshot final observers receive. Cancellation
     * arriving after entry and before final result materialization skips a
     * not-yet-started body with `ABORTED_BEFORE_DISPATCH` or replaces a
     * successful started outcome with `ABORTED`; already-started work is still
     * drained and may retain a tool-owned structured error.
     * @param exec - the typed same-process call input. The registry assigns its
     *   correlation token before policy begins.
     * @returns the materialized final result.
     */
    async execute(exec) {
        return this.prepareExecution(exec, prepared => this.completeScheduledExecution(prepared));
    }
    async completeScheduledExecution(prepared) {
        switch (prepared.kind) {
            case 'dispatch': {
                const dispatched = await this.dispatchScheduledExecution(prepared.exec);
                return dispatched.kind === 'post-result'
                    ? await this.finalizeScheduledExecution(prepared.exec, dispatched.result)
                    : this.finishScheduledExecution(prepared.exec, dispatched.result);
            }
            case 'post-result':
                return await this.finalizeScheduledExecution(prepared.exec, prepared.result);
            case 'final-result':
                return this.finishScheduledExecution(prepared.exec, prepared.result);
            /* v8 ignore next -- closed-union exhaustiveness guard */
            default:
                return assertNever(prepared, 'scheduled tool preparation');
        }
    }
    createExecution(exec) {
        const deferredContexts = [];
        const token = createExecutionToken();
        const callId = exec.callId;
        const name = exec.name;
        const agent = exec.agent;
        const parent = exec.parent;
        const signal = exec.signal;
        const definition = this.get(name, agent);
        const finalizeContent = definition?.finalizeContent?.bind(definition);
        const concludingExecutions = this.concludingExecutions;
        const base = {
            token,
            callId,
            name,
            signal,
            ...agent !== undefined ? { agent } : {},
            ...parent !== undefined ? { parent } : {},
            deferContext(context) {
                deferredContexts.push(context);
            },
            concludeTurn() {
                concludingExecutions.add(this);
            },
        };
        try {
            const detached = snapshotJsonValue(exec.arguments);
            if (detached === undefined) {
                throw new TypeError('tool execution arguments must be losslessly JSON-serializable');
            }
            const execution = { ...base, arguments: deepFreeze(detached) };
            this.deferredContexts.set(execution, deferredContexts);
            this.contentFinalizers.set(execution, finalizeContent);
            this.cancellationStates.set(execution, {
                callerSignal: signal,
                bodyInvoked: false,
            });
            return { kind: 'ready', exec: execution };
        }
        catch (error) {
            const execution = { ...base, arguments: undefined };
            this.contentFinalizers.set(execution, finalizeContent);
            return { kind: 'final-result', exec: execution, result: toolErrorResult(error) };
        }
    }
    /**
     * Run the ordered pre-execute and monotonic guard stages for the scheduler.
     * @param input - the caller-supplied execution input.
     * @returns the prepared execution plus the next scheduler stage.
     * @internal
     */
    async prepareScheduledExecution(input) {
        return this.prepareExecution(input, prepared => prepared);
    }
    async prepareExecution(input, next) {
        const created = this.createExecution(input);
        if (created.kind !== 'ready')
            return next(created);
        const exec = created.exec;
        if (this.callerCancelled(exec)) {
            return next({ kind: 'final-result', exec, result: toolAbortedBeforeDispatchResult() });
        }
        try {
            const carrier = scopeTarget(this, exec.agent);
            const gate = await this.ctx.waterfall(carrier, 'tools/pre-execute', exec, () => Promise.resolve({ kind: 'allow' }));
            const askResolution = gate.kind === 'ask'
                ? await this.serviceAsk(exec, gate)
                : { decision: gate, approvalCancelled: false };
            const { decision } = askResolution;
            if (this.callerCancelled(exec) && askResolution.approvalCancelled) {
                return await next({ kind: 'post-result', exec, result: toolAbortedBeforeDispatchResult() });
            }
            const denialReason = decision.kind === 'allow'
                ? this.guardReason(exec)
                : decision.reason;
            if (denialReason !== undefined) {
                return await next({
                    kind: 'post-result',
                    exec,
                    result: this.materializeFinalResult({
                        content: [{ type: 'text', text: `Error: ${denialReason}` }],
                        isError: true,
                        error: { message: denialReason },
                    }),
                });
            }
            if (this.callerCancelled(exec)) {
                return await next({ kind: 'post-result', exec, result: toolAbortedBeforeDispatchResult() });
            }
            return await next({ kind: 'dispatch', exec });
        }
        catch (error) {
            return next({ kind: 'final-result', exec, result: toolErrorResult(error) });
        }
    }
    /** Whether the original caller signal is currently aborted. */
    callerCancelled(exec) {
        const state = this.cancellationStates.get(exec);
        /* v8 ignore next -- only registry-minted executions reach the staged scheduler methods */
        if (state === undefined)
            throw new Error('tool registry scheduler invariant violated: missing cancellation state');
        return state.callerSignal.aborted;
    }
    /** Canonical cancellation outcome selected by whether the tool body started. */
    cancellationResult(exec, prior) {
        const state = this.cancellationStates.get(exec);
        /* v8 ignore next -- only registry-minted executions reach the staged scheduler methods */
        if (state === undefined)
            throw new Error('tool registry scheduler invariant violated: missing cancellation state');
        return state.bodyInvoked
            ? toolAbortedResult(prior)
            : toolAbortedBeforeDispatchResult(prior);
    }
    /**
     * Dispatch the registered body with the original caller signal fused back
     * into any around-wrapper replacement. Cancellation never abandons the body:
     * a started promise reaches quiescence before its outcome becomes `ABORTED`.
     */
    async dispatchToolBody(exec) {
        const state = this.cancellationStates.get(exec);
        /* v8 ignore next -- only registry-minted executions reach the staged scheduler methods */
        if (state === undefined)
            throw new Error('tool registry scheduler invariant violated: missing cancellation state');
        const wrapperSignal = exec.signal;
        const fused = fuseToolSignals(state.callerSignal, wrapperSignal);
        const signal = fused.signal;
        if (isAborted(signal)) {
            fused.dispose();
            return toolAbortedBeforeDispatchResult();
        }
        exec.signal = signal;
        try {
            const tool = this.get(exec.name, exec.agent);
            if (!tool)
                throw new ToolNotFoundError(exec.name);
            state.bodyInvoked = true;
            const returned = await tool.execute(exec.arguments, exec);
            const result = this.createSuccessResult(exec, tool, returned);
            return isAborted(signal)
                ? toolAbortedResult(result)
                : result;
        }
        catch (error) {
            return toolErrorResult(error);
        }
        finally {
            fused.dispose();
            exec.signal = wrapperSignal;
        }
    }
    /**
     * Run around-dispatch and the tool body. Tool and unknown-tool failures still
     * receive post-execute; pipeline failures are already final.
     * @param exec - the prepared execution.
     * @returns whether the result still needs post-execute.
     * @internal
     */
    async dispatchScheduledExecution(exec) {
        try {
            const mutableExec = exec;
            const carrier = scopeTarget(this, exec.agent);
            const result = await this.ctx.waterfall(carrier, 'tools/execute', mutableExec, () => this.dispatchToolBody(mutableExec));
            const normalized = this.normalizeDispatchResult(exec, result);
            const deferredContexts = this.deferredContexts.get(exec);
            /* v8 ignore next -- dispatch only receives executions minted by this registry's prepare stage */
            if (deferredContexts === undefined)
                throw new Error('tool registry scheduler invariant violated: unprepared execution');
            const resultWithDeferredContexts = deferredContexts.length === 0
                ? normalized
                : this.markCanonical(exec, {
                    ...normalized,
                    additionalContexts: [
                        ...deferredContexts,
                        ...normalized.additionalContexts ?? [],
                    ],
                });
            return {
                kind: 'post-result',
                result: this.callerCancelled(exec) && !resultWithDeferredContexts.isError
                    ? this.cancellationResult(exec, resultWithDeferredContexts)
                    : resultWithDeferredContexts,
            };
        }
        catch (error) {
            return { kind: 'final-result', result: toolErrorResult(error) };
        }
    }
    /**
     * Run ordered post-execute, then apply definition-owned content finalization,
     * materialize, and notify the final outcome.
     * @param exec - the prepared execution.
     * @param result - dispatch/pre result that still needs post-execute.
     * @returns the materialized final result.
     * @internal
     */
    async finalizeScheduledExecution(exec, result) {
        try {
            const postResult = await this.postExecute(exec, result);
            return this.finishScheduledExecution(exec, this.callerCancelled(exec) && !postResult.isError
                ? this.cancellationResult(exec, postResult)
                : postResult);
        }
        catch (error) {
            return this.finishScheduledExecution(exec, toolErrorResult(error));
        }
    }
    /**
     * Materialize the candidate, apply definition-owned content finalization,
     * then materialize and notify the authoritative result.
     * @param exec - the prepared execution.
     * @param result - final result.
     * @returns the materialized final result.
     * @internal
     */
    finishScheduledExecution(exec, result) {
        let materializedResult;
        try {
            materializedResult = this.materializeFinalResult(result);
        }
        catch (error) {
            materializedResult = this.materializeFinalResult(toolErrorResult(error));
        }
        let finalResult;
        try {
            finalResult = this.materializeFinalResult(this.applyFinalContent(exec, materializedResult));
        }
        catch (error) {
            finalResult = this.materializeFinalResult(toolErrorResult(error));
        }
        this.notifyResult(exec, finalResult);
        return finalResult;
    }
    /** Apply the snapshotted tool-owned content transform without exposing other result fields. */
    applyFinalContent(exec, result) {
        const finalizeContent = this.contentFinalizers.get(exec);
        if (finalizeContent === undefined)
            return result;
        const content = finalizeContent(exec, result);
        return content === undefined ? result : { ...result, content };
    }
    /** Notify observers without exposing a mutation or error channel into the outcome. */
    notifyResult(exec, result) {
        // Freeze the registry's live object before observers receive its readonly
        // WeakMap-keyable view.
        Object.freeze(exec);
        const { name: toolName, callId } = exec;
        const reportFailure = (error) => {
            this.ctx.logger.warn(`tool "${toolName}" (${callId}): tools/result observer failed: ${errorMessage(error)}`);
        };
        const callbacks = this.ctx.events.dispatch('emit', [
            scopeTarget(this, exec.agent), 'tools/result', exec, result,
        ]);
        for (const callback of callbacks) {
            try {
                const returned = callback(exec, result);
                void Promise.resolve(returned).catch(reportFailure);
            }
            catch (error) {
                reportFailure(error);
            }
        }
    }
    /**
     * Resolve an `ask` decision to allow/deny through the approval seam. The
     * seam is consumed opportunistically with `ctx.get('approval')` — a
     * deployment that composes no ApprovalService keeps the historical degrade
     * to deny, and an unmount mid-session degrades the same way on the next ask.
     * An agent-less execution also degrades: without an agent there is no
     * session to audit to and no UI to route to. Otherwise the outcome maps
     * one-to-one — `allowed-once` proceeds; the three non-grants deny with
     * distinct reasons so the model can tell a human "no" from an absent
     * approval channel.
     */
    async serviceAsk(exec, ask) {
        const approval = this.ctx.get('approval');
        if (approval === undefined) {
            return {
                decision: { kind: 'deny', reason: ask.reason ?? `tool "${exec.name}" requires approval (not yet supported)` },
                approvalCancelled: false,
            };
        }
        if (exec.agent === undefined) {
            return {
                decision: { kind: 'deny', reason: `tool "${exec.name}" requires approval, but the call has no agent to route it through` },
                approvalCancelled: false,
            };
        }
        const outcome = await approval.request({
            agent: exec.agent,
            toolName: exec.name,
            callId: exec.callId,
            ...ask.reason !== undefined ? { reason: ask.reason } : {},
            signal: exec.signal,
        });
        switch (outcome) {
            case 'allowed-once': return { decision: { kind: 'allow' }, approvalCancelled: false };
            case 'rejected': return {
                decision: { kind: 'deny', reason: `the user rejected tool "${exec.name}"` },
                approvalCancelled: false,
            };
            case 'cancelled': return {
                decision: { kind: 'deny', reason: `approval for tool "${exec.name}" was cancelled` },
                approvalCancelled: true,
            };
            case 'unavailable': return {
                decision: { kind: 'deny', reason: `tool "${exec.name}" requires approval, but no approval channel is available` },
                approvalCancelled: false,
            };
            default: return assertNever(outcome, 'ApprovalOutcome');
        }
    }
    /**
     * Run the `tools/post-execute` waterfall over a dispatched `result` and apply
     * its {@link PostToolDecision}: `accept` keeps the call successful (replacing
     * `content` when given), `block` turns it into an `isError` whose content is
     * the corrective `feedback`. Either decision may attach `additionalContexts`,
     * which are ferried on the returned result for the loop's active-batch FIFO.
     * Context deferred by the tool body survives an accepted result but is
     * discarded when the outer call is blocked; a block exposes only context the
     * blocking decision explicitly supplied.
     * Runs inside `execute`'s outer try/catch (a throwing listener → isError).
     */
    async postExecute(exec, result) {
        const decision = await this.ctx.waterfall(scopeTarget(this, exec.agent), 'tools/post-execute', exec, result, () => Promise.resolve({ kind: 'accept' }));
        const decisionContexts = decision.additionalContexts ?? [];
        if (decision.kind === 'block') {
            const message = failureMessageFromContent(decision.feedback);
            return this.markCanonical(exec, {
                content: decision.feedback,
                isError: true,
                error: { message },
                ...decisionContexts.length > 0 ? { additionalContexts: decisionContexts } : {},
            });
        }
        if (Object.hasOwn(decision, 'content') && Object.hasOwn(decision, 'value')) {
            throw new TypeError('tools/post-execute accept decision cannot replace both value and content');
        }
        const additionalContexts = [
            ...result.additionalContexts ?? [],
            ...decisionContexts,
        ];
        if (Object.hasOwn(decision, 'value')) {
            if (result.isError) {
                throw new TypeError('tools/post-execute cannot replace the value of a failed result');
            }
            const tool = this.get(exec.name, exec.agent);
            if (tool === undefined)
                throw new ToolNotFoundError(exec.name);
            const replaced = this.createSuccessResult(exec, tool, decision.value);
            return this.markCanonical(exec, {
                ...replaced,
                ...additionalContexts.length > 0 ? { additionalContexts } : {},
            });
        }
        return this.markCanonical(exec, {
            ...result,
            ...decision.content !== undefined ? { content: decision.content } : {},
            ...additionalContexts.length > 0 ? { additionalContexts } : {},
        });
    }
    /** Registry-normalized results and the exact dispatch that validated each value. */
    canonicalResults = new WeakMap();
    /** Mark one registry-normalized result as canonical only for its owning dispatch. */
    markCanonical(exec, result) {
        this.canonicalResults.set(result, exec.token);
        return result;
    }
    /** Snapshot, validate, render, and optionally project one successful body value. */
    createSuccessResult(exec, tool, candidate) {
        const detached = snapshotToolValue(tool.name, candidate);
        const violations = validateJsonSchemaValue(tool.output.schema, detached, 'value');
        if (violations.length > 0)
            throw new ToolOutputError(tool.name, violations);
        const value = deepFreeze(detached);
        let rendered;
        try {
            rendered = tool.output.render(exec.arguments, value);
        }
        catch (error) {
            throw projectionError(tool.name, 'render', error);
        }
        const content = snapshotProjection(tool.name, 'render', rendered);
        let meta;
        if (exec.parent === undefined && tool.output.presentationMeta !== undefined) {
            let projected;
            try {
                projected = tool.output.presentationMeta(exec.arguments, value);
            }
            catch (error) {
                throw projectionError(tool.name, 'presentationMeta', error);
            }
            meta = snapshotProjection(tool.name, 'presentationMeta', projected);
        }
        const concludesTurn = this.concludingExecutions.has(exec);
        return this.markCanonical(exec, this.materializeFinalResult({
            isError: false,
            value,
            content,
            ...meta !== undefined ? { meta } : {},
            ...concludesTurn ? { concludesTurn: true } : {},
        }));
    }
    /** Normalize an around-dispatch wrapper's authored result through the owning output contract. */
    normalizeDispatchResult(exec, result) {
        if (this.canonicalResults.get(result) === exec.token)
            return result;
        if (result.isError) {
            return this.markCanonical(exec, {
                isError: true,
                error: result.error,
                content: result.content,
                ...result.meta !== undefined ? { meta: result.meta } : {},
                ...result.additionalContexts !== undefined ? { additionalContexts: result.additionalContexts } : {},
            });
        }
        const tool = this.get(exec.name, exec.agent);
        if (tool === undefined)
            throw new ToolNotFoundError(exec.name);
        const normalized = this.createSuccessResult(exec, tool, result.value);
        return this.markCanonical(exec, {
            ...normalized,
            ...result.additionalContexts !== undefined ? { additionalContexts: result.additionalContexts } : {},
        });
    }
    /** Materialize the authoritative commit outcome once, immediately before `tools/result`. */
    materializeFinalResult(result) {
        const presentation = {
            content: result.content,
            ...result.meta !== undefined ? { meta: result.meta } : {},
            ...result.additionalContexts !== undefined ? { additionalContexts: result.additionalContexts } : {},
        };
        if (result.isError) {
            return materializePresentation({ isError: true, error: result.error, ...presentation });
        }
        const detached = materializePresentation({
            isError: false,
            ...presentation,
            ...result.concludesTurn === true ? { concludesTurn: true } : {},
        });
        return deepFreeze({ ...detached, value: result.value });
    }
}
/** Mint a same-process correlation token whose identity is its value. */
function createExecutionToken() {
    return Symbol('dsh.tool.execution');
}
function toolErrorResult(error) {
    const info = errorInfo(error);
    const message = errorMessage(error);
    return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
        error: { message, ...info ? { info } : {} },
    };
}
/** Read live abort state across an await without treating it as synchronously immutable. */
function isAborted(signal) {
    return signal.aborted;
}
/**
 * Fuse caller and wrapper cancellation without nesting `AbortSignal.any`.
 * Keeping the relay dispatch-scoped also removes listeners when work settles.
 */
function fuseToolSignals(caller, wrapper) {
    if (caller === wrapper)
        return { signal: caller, dispose() { } };
    const controller = new AbortController();
    let listening = false;
    const dispose = () => {
        if (!listening)
            return;
        listening = false;
        caller.removeEventListener('abort', abortFromCaller);
        wrapper.removeEventListener('abort', abortFromWrapper);
    };
    const abortFrom = (source) => {
        const reason = source.reason;
        controller.abort(reason);
        dispose();
    };
    const abortFromCaller = () => { abortFrom(caller); };
    const abortFromWrapper = () => { abortFrom(wrapper); };
    if (wrapper.aborted)
        abortFromWrapper();
    else if (caller.aborted)
        abortFromCaller();
    else {
        listening = true;
        caller.addEventListener('abort', abortFromCaller, { once: true });
        wrapper.addEventListener('abort', abortFromWrapper, { once: true });
    }
    return { signal: controller.signal, dispose };
}
/** Canonical result when cancellation supersedes success after body invocation. */
function toolAbortedResult(prior) {
    const additionalContexts = prior?.additionalContexts ?? [];
    return {
        content: [{ type: 'text', text: 'Error: tool call aborted' }],
        isError: true,
        error: {
            message: 'tool call aborted',
            info: { name: 'AbortError', code: TOOL_ABORTED },
        },
        ...additionalContexts.length > 0 ? { additionalContexts } : {},
    };
}
/** Canonical result when cancellation prevents tool body invocation. */
function toolAbortedBeforeDispatchResult(prior) {
    const additionalContexts = prior?.additionalContexts ?? [];
    return {
        content: [{ type: 'text', text: 'Error: tool call aborted before dispatch' }],
        isError: true,
        error: {
            message: 'tool call aborted before dispatch',
            info: { name: 'AbortError', code: TOOL_ABORTED_BEFORE_DISPATCH },
        },
        ...additionalContexts.length > 0 ? { additionalContexts } : {},
    };
}
export default ToolRegistry;
//# sourceMappingURL=index.js.map