import { SurfaceManager, isSurfaceEligibleType, isSurfaceEvent, } from '@deepseek-ai/dsh-session/surface';
import { toAssistantBlocks } from "../sessions/conversation.js";
import { contextForm, contextProvenance } from "../sessions/context-provenance.js";
import { SteeringHistory } from "../sessions/steering-history.js";
import { PartialAccumulator } from "../sessions/partial.js";
import { indexAssistantStepTiming, settledAssistantTiming } from "../sessions/assistant-timing.js";
function replacementCrossesWindowHead(event, baseSeq) {
    if (!isSurfaceEvent(event) || event.surfaceOp === 'append')
        return false;
    return event.surfaceOp.start < baseSeq || event.surfaceOp.end < baseSeq;
}
function contextOriginKind(event) {
    if (event?.type !== 'user/message')
        return 'rewrite';
    const source = event.data.source;
    if (typeof source === 'object' && 'kind' in source && 'plugin' in source) {
        if (source.plugin === 'compact')
            return 'compaction';
        if (source.plugin === 'rewind')
            return 'rewind';
    }
    return 'rewrite';
}
function foldContexts(events) {
    const replay = [];
    const originalSeqs = [];
    const rebasedSeqByOriginal = new Map();
    const surface = new SurfaceManager(replay);
    const contexts = [];
    let generation = 0;
    let originSeq;
    const originalNodes = () => surface.nodes.map((seq) => {
        const original = originalSeqs[seq];
        if (original === undefined)
            throw new Error(`rebased surface seq ${seq} has no origin`);
        return original;
    });
    for (const event of events) {
        if (!isSurfaceEvent(event))
            continue;
        if (event.surfaceOp !== 'append') {
            contexts.push({
                generation,
                nodes: originalNodes(),
                ...(originSeq === undefined ? {} : { originSeq }),
            });
            generation++;
            originSeq = event.seq;
        }
        const rebasedSeq = replay.length;
        const { sourceEventSeqs: rawSources, ...eventWithoutSources } = event;
        const mappedSourceEventSeqs = rawSources?.flatMap((seq) => {
            const rebased = rebasedSeqByOriginal.get(seq);
            return rebased === undefined ? [] : [rebased];
        });
        const sourceEventSeqs = mappedSourceEventSeqs?.length === 0
            ? undefined
            : mappedSourceEventSeqs;
        const surfaceOp = event.surfaceOp === 'append'
            ? event.surfaceOp
            : {
                ...event.surfaceOp,
                start: rebasedSeqByOriginal.get(event.surfaceOp.start) ?? event.surfaceOp.start,
                end: rebasedSeqByOriginal.get(event.surfaceOp.end) ?? event.surfaceOp.end,
            };
        originalSeqs.push(event.seq);
        rebasedSeqByOriginal.set(event.seq, rebasedSeq);
        replay.push({
            ...eventWithoutSources,
            seq: rebasedSeq,
            surfaceOp,
            ...(sourceEventSeqs === undefined ? {} : { sourceEventSeqs }),
        });
    }
    contexts.push({
        generation,
        nodes: originalNodes(),
        ...(originSeq === undefined ? {} : { originSeq }),
    });
    return contexts;
}
// History projection owns its node mapping so Chat's live adapter remains free
// of inspection metadata and lifecycle coupling.
/* jscpd:ignore-start */
function materializeNode(event, callIndex, resultView, assistantTiming, requestConfig, steering) {
    switch (event.type) {
        case 'user/message':
            if (event.data.source.kind !== 'user') {
                return {
                    kind: 'context', seq: event.seq, time: event.time,
                    content: event.data.content, source: event.data.source,
                    provenance: contextProvenance(event.data.source),
                    form: contextForm(event.data.source),
                };
            }
            if (steering) {
                return {
                    kind: 'steering', messageId: event.data.id,
                    seq: event.seq, time: event.time,
                    content: event.data.content, source: event.data.source,
                };
            }
            return {
                kind: 'user', seq: event.seq, time: event.time,
                content: event.data.content, source: event.data.source,
            };
        case 'assistant/message':
            return {
                kind: 'assistant', seq: event.seq, time: event.time,
                turn: event.data.turn, step: event.data.step,
                blocks: toAssistantBlocks(event.data.message.content), usage: event.data.usage,
                provenance: {
                    provider: event.data.message.source.provider,
                    model: event.data.message.source.model,
                },
                ...(requestConfig !== undefined ? { requestConfig } : {}),
                ...(assistantTiming === undefined ? {} : { timing: assistantTiming }),
            };
        case 'tool/result': {
            const result = event.data.message.content[0];
            const callId = String(event.data.message.source.callId);
            const call = callIndex.get(callId);
            return {
                kind: 'tool-result', seq: event.seq, time: event.time,
                callId,
                call: call === undefined ? null : { name: call.name, argsRaw: call.argsRaw },
                callTime: call?.time ?? null,
                content: result.content, isError: result.isError === true,
                ...(event.data.error === undefined ? {} : { error: event.data.error }),
                meta: event.data.meta,
                callView: call?.callView ?? null,
                resultView,
            };
        }
        default:
            return {
                kind: 'unknown', seq: event.seq, time: event.time,
                type: event.type, data: event.data,
            };
    }
}
/* jscpd:ignore-end */
function projectTransient(entries) {
    let partial = null;
    const openCalls = new Map();
    const interruptedNodes = [];
    const codeDispatches = new Map();
    for (const entry of entries) {
        const { event } = entry;
        if (event.type === 'tool/code-dispatch-start') {
            const data = event.data;
            const siblings = codeDispatches.get(data.parentCallId) ?? [];
            // The independent replay emits the same public running-call shape as
            // Chat without reading or mutating Session's live index.
            /* jscpd:ignore-start */
            codeDispatches.set(data.parentCallId, [...siblings, {
                    callId: data.subCallId,
                    name: data.name,
                    argsRaw: JSON.stringify(data.arguments),
                    turn: 0,
                    step: 0,
                    time: event.time,
                    callView: null,
                }]);
            /* jscpd:ignore-end */
            continue;
        }
        if (event.type === 'tool/code-dispatch') {
            const data = event.data;
            const siblings = codeDispatches.get(data.parentCallId) ?? [];
            const at = siblings.findIndex(sub => sub.callId === data.subCallId);
            const started = at === -1 ? undefined : siblings[at];
            // History independently reproduces the public settled-call shape instead
            // of consuming Session's live code-dispatch projection.
            /* jscpd:ignore-start */
            const settled = {
                kind: 'tool-result', seq: event.seq, time: event.time,
                callId: data.subCallId,
                call: { name: data.name, argsRaw: JSON.stringify(data.arguments) },
                callTime: started?.time ?? null,
                content: data.content,
                isError: data.isError,
                callView: null,
                resultView: null,
            };
            codeDispatches.set(data.parentCallId, at === -1
                ? [...siblings, settled]
                : siblings.map((sub, index) => index === at ? settled : sub));
            /* jscpd:ignore-end */
            continue;
        }
        switch (event.type) {
            case 'assistant/chunk': {
                const { turn, step, chunk } = event.data;
                if (partial === null || partial.turn !== turn || partial.step !== step) {
                    partial = new PartialAccumulator(turn, step);
                }
                partial.push(chunk);
                break;
            }
            case 'assistant/message':
                if (partial?.turn === event.data.turn && partial.step === event.data.step) {
                    partial = null;
                }
                break;
            case 'tool/call':
                // History reconstructs its own in-flight index; this intentionally
                // mirrors the published Chat node shape, not Chat's mutable state.
                /* jscpd:ignore-start */
                openCalls.set(String(event.data.callId), {
                    callId: String(event.data.callId),
                    name: event.data.name,
                    argsRaw: event.data.arguments,
                    turn: event.data.turn,
                    step: event.data.step,
                    time: event.time,
                    callView: entry.view?.for === 'call' ? entry.view.view : null,
                });
                /* jscpd:ignore-end */
                break;
            case 'tool/result':
                openCalls.delete(String(event.data.message.source.callId));
                break;
            case 'turn/end': {
                if (partial !== null && partial.turn === event.data.turn) {
                    const { blocks } = partial.toPartial();
                    const visible = blocks.some(block => block.kind === 'text' || block.kind === 'reasoning' ? block.text !== '' : true);
                    if (visible) {
                        interruptedNodes.push({
                            kind: 'assistant', seq: event.seq - 0.9, time: event.time,
                            turn: partial.turn, step: partial.step, blocks, interrupted: true,
                        });
                    }
                    partial = null;
                }
                let callOffset = 0;
                for (const [callId, call] of openCalls) {
                    if (call.turn !== event.data.turn)
                        continue;
                    openCalls.delete(callId);
                    // Interrupted terminal nodes are reconstructed independently so a
                    // Trajectory replay cannot observe Session's frozen-node lifecycle.
                    /* jscpd:ignore-start */
                    interruptedNodes.push({
                        kind: 'tool-result', seq: event.seq - 0.8 + callOffset++ * 0.01,
                        time: event.time,
                        callId,
                        call: { name: call.name, argsRaw: call.argsRaw },
                        callTime: call.time,
                        content: [],
                        isError: true,
                        error: { name: 'Interrupted', code: 'interrupted' },
                        callView: call.callView,
                        resultView: null,
                    });
                    /* jscpd:ignore-end */
                }
                break;
            }
            default:
                break;
        }
    }
    return {
        interruptedNodes,
        partial: partial?.toPartial() ?? null,
        runningCalls: [...openCalls.values()],
        codeDispatches,
    };
}
/**
 * Project one immutable history ledger without reading or mutating Chat state.
 * @param entries - Contiguous history entries in sequence order.
 * @returns Event order, context lineage, and transient tail state.
 */
export function projectConversationHistory(entries) {
    const events = entries.map(entry => entry.event);
    const steeringHistory = new SteeringHistory();
    const steeringSeqs = new Set();
    for (const event of events) {
        if (steeringHistory.apply(event))
            steeringSeqs.add(event.seq);
    }
    const baseSeq = events[0]?.seq ?? 0;
    const eventsBySeq = new Map(events.map(event => [event.seq, event]));
    const callIndex = new Map();
    const resultViews = new Map();
    const assistantSteps = new Map();
    const assistantTimings = new Map();
    const assistantRequestConfigs = new Map();
    const promptsByContext = new Map();
    let activeRequestConfig;
    let activePrompt;
    let contextGeneration = 0;
    for (const [index, event] of events.entries()) {
        const view = entries[index]?.view;
        if (event.type === 'tool/call') {
            callIndex.set(String(event.data.callId), {
                name: event.data.name,
                argsRaw: event.data.arguments,
                time: event.time,
                callView: view?.for === 'call' ? view.view : null,
            });
        }
        else if (event.type === 'tool/result' && view?.for === 'result') {
            resultViews.set(event.seq, view.view);
        }
        if (isSurfaceEvent(event) && event.surfaceOp !== 'append') {
            contextGeneration++;
            if (activePrompt !== undefined)
                promptsByContext.set(contextGeneration, activePrompt);
        }
        indexAssistantStepTiming(assistantSteps, event);
        if (event.type === 'request/header') {
            activeRequestConfig = event.data.header.config;
            activePrompt = {
                config: event.data.header.config,
                system: event.data.header.system ?? '',
                tools: event.data.header.tools ?? [],
            };
            promptsByContext.set(contextGeneration, activePrompt);
        }
        else if (event.type === 'assistant/message') {
            assistantTimings.set(event.seq, settledAssistantTiming(assistantSteps, event.data.turn, event.data.step, event.time));
            if (activeRequestConfig !== undefined) {
                assistantRequestConfigs.set(event.seq, activeRequestConfig);
            }
        }
    }
    const nodeCache = new Map();
    const materialize = (seq) => {
        const cached = nodeCache.get(seq);
        if (cached !== undefined)
            return cached;
        const event = eventsBySeq.get(seq);
        if (event === undefined || !isSurfaceEligibleType(event.type))
            return;
        const node = materializeNode(event, callIndex, resultViews.get(seq) ?? null, assistantTimings.get(seq), assistantRequestConfigs.get(seq), steeringSeqs.has(seq));
        nodeCache.set(seq, node);
        return node;
    };
    const eventNodes = events.flatMap((event) => {
        const node = materialize(event.seq);
        return node === undefined ? [] : [node];
    });
    let contexts;
    if (events.some(event => replacementCrossesWindowHead(event, baseSeq))) {
        contexts = [{
                id: 0,
                ...(activePrompt === undefined ? {} : { prompt: activePrompt }),
                nodes: eventNodes,
            }];
    }
    else {
        try {
            contexts = foldContexts(events).map((context) => {
                const nodes = context.nodes.flatMap((seq) => {
                    const node = materialize(seq);
                    return node === undefined ? [] : [node];
                });
                const prompt = promptsByContext.get(context.generation);
                if (context.originSeq === undefined) {
                    return {
                        id: context.generation,
                        ...(prompt === undefined ? {} : { prompt }),
                        nodes,
                    };
                }
                const originEvent = eventsBySeq.get(context.originSeq);
                return {
                    id: context.generation,
                    parentId: context.generation - 1,
                    origin: contextOriginKind(originEvent),
                    originSeq: context.originSeq,
                    ...(originEvent === undefined ? {} : { createdAt: originEvent.time }),
                    ...(prompt === undefined ? {} : { prompt }),
                    nodes,
                };
            });
        }
        catch (error) {
            console.error('[web-runtime] history surface fold failed, using event order:', error);
            contexts = [{
                    id: 0,
                    ...(activePrompt === undefined ? {} : { prompt: activePrompt }),
                    nodes: eventNodes,
                }];
        }
    }
    return {
        eventNodes,
        contexts,
        ...projectTransient(entries),
    };
}
//# sourceMappingURL=history-fold.js.map