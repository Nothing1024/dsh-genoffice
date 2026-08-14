// Request-centric inspection read model. Ordinary generation and compaction
// calls share one chronological projection; presentation-specific grouping
// remains in the trajectory consumer.
import { displayFailureMessage } from "./failure-display.js";
/**
 * Derive the request-centric read model from one immutable history window.
 * Compaction participates as a request purpose rather than a parallel
 * top-level collection. A leading resume/change header exposes its prompt but
 * cannot project a change until the preceding header enters the window.
 * @param entries - Contiguous raw session history.
 * @returns Requests and call-time schemas derived from that history.
 */
export function inspectRequests(entries) {
    const events = entries.map(entry => entry.event);
    return {
        requests: deriveRequests(events),
        callSchemas: deriveCallSchemas(events),
    };
}
function requestKey(turn, step) {
    return `${turn}\u0000${step}`;
}
function addTokenUsage(current, next) {
    const previous = current;
    return {
        inputTokens: (previous?.inputTokens ?? 0) + next.inputTokens,
        outputTokens: (previous?.outputTokens ?? 0) + next.outputTokens,
        ...(previous?.cacheReadTokens === undefined && next.cacheReadTokens === undefined
            ? {}
            : {
                cacheReadTokens: (previous?.cacheReadTokens ?? 0) + (next.cacheReadTokens ?? 0),
            }),
        ...(previous?.cacheWriteTokens === undefined && next.cacheWriteTokens === undefined
            ? {}
            : {
                cacheWriteTokens: (previous?.cacheWriteTokens ?? 0) + (next.cacheWriteTokens ?? 0),
            }),
        ...(previous?.reasoningTokens === undefined && next.reasoningTokens === undefined
            ? {}
            : {
                reasoningTokens: (previous?.reasoningTokens ?? 0) + (next.reasoningTokens ?? 0),
            }),
    };
}
function deriveCallSchemas(events) {
    let active = new Map();
    const calls = new Map();
    const capture = (callId, name) => {
        if (calls.has(callId))
            return;
        const schema = active.get(name);
        if (schema !== undefined)
            calls.set(callId, schema);
    };
    for (const event of events) {
        if (event.type === 'request/header') {
            const tools = event.data.header.tools;
            active = new Map(Array.isArray(tools)
                ? tools.map(schema => [schema.name, schema])
                : []);
            continue;
        }
        if (event.type === 'tool/call') {
            capture(String(event.data.callId), event.data.name);
            continue;
        }
        const type = event.type;
        if (type === 'tool/code-dispatch-start' || type === 'tool/code-dispatch') {
            const data = event.data;
            capture(data.subCallId, data.name);
        }
    }
    return calls;
}
function promptChange(previous, prompt, event) {
    if (previous === undefined && event.data.reason !== 'initial')
        return;
    const systemChanged = previous !== undefined && previous.system !== prompt.system;
    const toolsChanged = previous !== undefined
        && JSON.stringify(previous.tools) !== JSON.stringify(prompt.tools);
    if (previous !== undefined && !systemChanged && !toolsChanged)
        return;
    return {
        seq: event.seq,
        time: event.time,
        kind: previous === undefined
            ? 'initial'
            : systemChanged && toolsChanged
                ? 'system-and-tools'
                : systemChanged
                    ? 'system'
                    : 'tools',
        ...(previous === undefined ? {} : { previous }),
    };
}
/** Project ordinary and compaction provider calls into one chronological request stream. */
function deriveRequests(events) {
    const requests = [];
    const ordinaryByStep = new Map();
    const lastStepByTurn = new Map();
    let activeStep;
    let activePrompt;
    let activeCompaction;
    const updateAssistant = (index, change) => {
        if (index === undefined)
            return;
        const request = requests[index];
        if (request?.purpose === 'assistant')
            requests[index] = { ...request, ...change };
    };
    const updateCompaction = (index, change) => {
        if (index === undefined)
            return;
        const request = requests[index];
        if (request?.purpose === 'compaction')
            requests[index] = { ...request, ...change };
    };
    for (const sourceEvent of events) {
        if (sourceEvent.type === 'step/start') {
            const { turn, step } = sourceEvent.data;
            const key = requestKey(turn, step);
            ordinaryByStep.set(key, requests.length);
            lastStepByTurn.set(turn, key);
            requests.push({
                purpose: 'assistant',
                startSeq: sourceEvent.seq,
                turn,
                step,
                startedAt: sourceEvent.time,
                completedAt: null,
                status: 'running',
                ...(activePrompt === undefined
                    ? {}
                    : { prompt: activePrompt, requestConfig: activePrompt.config }),
            });
            activeStep = key;
            continue;
        }
        if (sourceEvent.type === 'request/header') {
            const tools = sourceEvent.data.header.tools;
            const prompt = {
                config: sourceEvent.data.header.config,
                system: sourceEvent.data.header.system ?? '',
                tools: Array.isArray(tools) ? tools : [],
            };
            const change = promptChange(activePrompt, prompt, sourceEvent);
            activePrompt = prompt;
            updateAssistant(activeStep === undefined ? undefined : ordinaryByStep.get(activeStep), {
                prompt,
                requestConfig: prompt.config,
                ...(change === undefined ? {} : { promptChange: change }),
            });
            continue;
        }
        if (sourceEvent.type === 'assistant/chunk'
            && sourceEvent.data.chunk.type === 'usage') {
            const index = ordinaryByStep.get(requestKey(sourceEvent.data.turn, sourceEvent.data.step));
            const request = index === undefined ? undefined : requests[index];
            updateAssistant(index, {
                usage: addTokenUsage(request?.purpose === 'assistant' ? request.usage : undefined, sourceEvent.data.chunk.usage),
            });
            continue;
        }
        if (sourceEvent.type === 'assistant/message') {
            const index = ordinaryByStep.get(requestKey(sourceEvent.data.turn, sourceEvent.data.step));
            const request = index === undefined ? undefined : requests[index];
            updateAssistant(index, {
                completedAt: sourceEvent.time,
                status: 'complete',
                resultSeq: sourceEvent.seq,
                provenance: {
                    provider: sourceEvent.data.message.source.provider,
                    model: sourceEvent.data.message.source.model,
                },
                ...(request?.purpose === 'assistant'
                    && request.usage !== undefined
                    || sourceEvent.data.usage === undefined
                    ? {}
                    : { usage: sourceEvent.data.usage }),
            });
            continue;
        }
        if (sourceEvent.type === 'step/end') {
            const key = requestKey(sourceEvent.data.turn, sourceEvent.data.step);
            const index = ordinaryByStep.get(key);
            const request = index === undefined ? undefined : requests[index];
            if (request?.purpose === 'assistant' && request.status === 'running') {
                updateAssistant(index, {
                    completedAt: sourceEvent.time,
                    status: 'error',
                });
            }
            if (activeStep === key)
                activeStep = undefined;
            continue;
        }
        if (sourceEvent.type === 'llm/retry') {
            const event = sourceEvent;
            updateAssistant(ordinaryByStep.get(requestKey(event.data.turn, event.data.step)), {
                status: 'error',
                error: displayFailureMessage(event.data.failure),
                retry: event.data.retry,
                maxRetries: event.data.maxRetries,
                retryDelayMs: event.data.delayMs,
            });
            continue;
        }
        if (sourceEvent.type === 'turn/end') {
            const lastStep = lastStepByTurn.get(sourceEvent.data.turn);
            if (sourceEvent.data.reason.kind === 'error') {
                updateAssistant(lastStep === undefined ? undefined : ordinaryByStep.get(lastStep), {
                    status: 'error',
                    error: displayFailureMessage(sourceEvent.data.reason.error),
                });
            }
            lastStepByTurn.delete(sourceEvent.data.turn);
            continue;
        }
        const type = sourceEvent.type;
        if (type === 'session/end-seed' && activeCompaction !== undefined) {
            updateCompaction(activeCompaction, {
                completedAt: sourceEvent.time,
                status: 'error',
                error: 'Compaction was interrupted before completion.',
            });
            activeCompaction = undefined;
            continue;
        }
        if (type === 'compact/start') {
            const event = sourceEvent;
            activeCompaction = requests.length;
            requests.push({
                purpose: 'compaction',
                startSeq: event.seq,
                turn: event.data.turn,
                step: 0,
                startedAt: event.time,
                completedAt: null,
                status: 'running',
            });
            continue;
        }
        if (type === 'compact/summary' && activeCompaction !== undefined) {
            const event = sourceEvent;
            updateCompaction(activeCompaction, {
                resultSeq: event.seq,
                summary: event.data.summary,
                ...(event.data.rawOutput === undefined ? {} : { rawOutput: event.data.rawOutput }),
                provenance: {
                    provider: event.data.provider,
                    model: event.data.model,
                },
                requestConfig: {
                    provider: event.data.provider,
                    model: event.data.model,
                    purpose: 'compaction',
                    ...(event.data.maxTokens === undefined ? {} : { maxTokens: event.data.maxTokens }),
                },
                ...(event.data.usage === undefined ? {} : { usage: event.data.usage }),
            });
            continue;
        }
        if (sourceEvent.type === 'user/message'
            && activeCompaction !== undefined
            && isCompactionSource(sourceEvent.data.source)) {
            updateCompaction(activeCompaction, { replacementSeq: sourceEvent.seq });
            continue;
        }
        if (type !== 'compact/end' || activeCompaction === undefined)
            continue;
        const event = sourceEvent;
        updateCompaction(activeCompaction, {
            completedAt: event.time,
            status: event.data.error === undefined ? 'complete' : 'error',
            ...(event.data.error === undefined ? {} : { error: event.data.error }),
        });
        activeCompaction = undefined;
    }
    return requests.sort((left, right) => left.startSeq - right.startSeq);
}
function isCompactionSource(source) {
    return typeof source === 'object'
        && source !== null
        && 'kind' in source
        && source.kind === 'plugin'
        && 'plugin' in source
        && source.plugin === 'compact';
}
//# sourceMappingURL=request-inspection.js.map