// TranscriptAdapter: the human transcript projected from the raw event window
// in LOG order. The model-visible surface deliberately shadows replaced ranges,
// so it is the wrong source for conversation a reader already saw; this adapter
// keeps every append-origin event at its own log position and contributes one
// marker node per landed compaction checkpoint. Node order is therefore
// seq-monotonic by construction — no surface fold, no padding sentinels, no
// seq === index assertion to satisfy, and no degradation branch.
// Subpath export (package.json exports "./surface", alias added for this): all value imports
// go through it — the package root points at lib/index.js (needs a build) which the vite
// browser bundle cannot resolve; surface.ts has no Node dependencies.
import { isAppendSurfaceEvent, isReplacementSurfaceEvent } from '@deepseek-ai/dsh-session/surface';
import { toAssistantBlocks } from "./conversation.js";
import { contextForm, contextProvenance } from "./context-provenance.js";
import { SteeringHistory } from "./steering-history.js";
import { indexAssistantStepTiming, settledAssistantTiming } from "./assistant-timing.js";
/**
 * The compaction seam's checkpoint plugin, pinned to the seam's own declaration
 * at COMPILE time: renaming it there fails this annotation (`TS2322`). The
 * import stays type-only because a value import would fail the client purity
 * gate (`packages/client/tsdown.client.ts`) — cross-plugin value imports are
 * forbidden in a browser bundle — while an erased type never reaches it.
 */
const COMPACT_PLUGIN = 'compact';
/** One event -> UI node (pure function; the ten-variant ConversationNode union). */
function materializeNode(event, callIndex, resultView, steering, stepTimings) {
    switch (event.type) {
        case 'user/message':
            // Injected context (plugin/goal source) folds to a context node, not a
            // user message; only a direct human prompt is a user node. A compaction
            // checkpoint never reaches here (isCompactCheckpoint routes it away).
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
                timing: settledAssistantTiming(stepTimings, event.data.turn, event.data.step, event.time),
            };
        case 'tool/result': {
            const result = event.data.message.content[0];
            const callId = String(event.data.message.source.callId);
            const call = callIndex.get(callId);
            return {
                kind: 'tool-result', seq: event.seq, time: event.time,
                callId,
                call: call ? { name: call.name, argsRaw: call.argsRaw } : null,
                callTime: call?.time ?? null,
                content: result.content, isError: result.isError === true,
                ...(event.data.error !== undefined ? { error: event.data.error } : {}),
                meta: event.data.meta,
                callView: call?.callView ?? null,
                resultView,
            };
        }
        /* v8 ignore next 2 -- defensive arm: only the four surface-eligible types
        can be append-origin, and each has a case above; reachable only if core
        adds an eligible type. */
        default:
            return {
                kind: 'unknown', seq: event.seq, time: event.time,
                type: event.type, data: event.data,
            };
    }
}
/**
 * Whether an event is a landed compaction checkpoint — all three conditions,
 * matching the terminal's `isCompactCheckpoint`: a `user/message`, carrying the
 * compaction seam's checkpoint plugin source, that REPLACED a surface range. A
 * plugin-sourced `user/message` that appends is injected context (a
 * session-reference card), not a compaction; a replacement `tool/result` is an
 * in-place prune and a replacement `assistant/message` a generic rewrite, and
 * both mark no boundary in the conversation.
 * @param event - the raw window event.
 * @returns true when the event compacted a surface range.
 */
function isCompactCheckpoint(event) {
    if (event.type !== 'user/message')
        return false;
    const source = event.data.source;
    return source.kind === 'plugin' && source.plugin === COMPACT_PLUGIN
        && isReplacementSurfaceEvent(event);
}
/** Whether an event contributes a node to the human transcript. */
function isTranscriptEvent(event) {
    return isAppendSurfaceEvent(event) || isCompactCheckpoint(event);
}
/**
 * Concatenated text of a `compact/summary` payload, or null when it carries no
 * usable text. The payload is a `ContentBlock[]` whose union is
 * merge-extensible, so a non-text block is skipped rather than discarding the
 * text beside it; a payload with no text block at all falls to null through the
 * empty check.
 */
function compactSummaryText(event) {
    const summary = event.data.summary;
    if (!Array.isArray(summary))
        return null;
    let text = '';
    for (const block of summary) {
        const candidate = block;
        if (candidate.type !== 'text' || typeof candidate.text !== 'string')
            continue;
        text += candidate.text;
    }
    return text.trim() === '' ? null : text;
}
/**
 * One landed checkpoint -> the human-facing compaction marker. The summary text
 * comes from the checkpoint's own provenance (`sourceEventSeqs` names the
 * `compact/summary` event), never from the framed checkpoint payload, which is
 * an instruction envelope written for the model. A window cut that left the
 * provenance outside soft-falls to `summary: null` (a non-expandable marker),
 * the same posture as a call-less tool result.
 */
function materializeCompaction(checkpoint, eventIndex) {
    const sources = checkpoint.sourceEventSeqs;
    let summary = null;
    for (const seq of sources ?? []) {
        const candidate = eventIndex.get(seq);
        if (candidate === undefined || candidate.type !== 'compact/summary')
            continue;
        summary = compactSummaryText(candidate);
        break;
    }
    return { kind: 'compaction', seq: checkpoint.seq, time: checkpoint.time, summary };
}
/** Log-ordered human transcript over a paged raw event window (never consults surface order). */
export class TranscriptAdapter {
    /** Window events by seq: provenance lookup for a checkpoint's summary. */
    eventIndex = new Map();
    /** Transcript nodes in log order; copy-on-write so a published array never mutates. */
    projected = [];
    callIdx = new Map();
    /** Per-step timing boundaries (step/start + first token delta), consumed when the step's assistant/message materializes. */
    stepTimings = new Map();
    /** Wire result views keyed by the tool/result event's seq (views ride the envelope, not the event). */
    resultViews = new Map();
    /** Durable inbox replay used to distinguish next-step human input from queued prompts. */
    steeringHistory = new SteeringHistory();
    /**
     * Command lifecycle nodes by commandId (insertion = run order). The
     * `command/run`/`command/done` pair is log-only, so it is not a surface
     * event and never joins the transcript projection; this index folds the pair
     * (done settles its run's node in place) and nodes() merges the products in
     * by seq. Window cuts soft-fall like tool pairs: a done with no in-window
     * run still builds a node.
     */
    commandIdx = new Map();
    /** Projection revision, bumped only when a transcript node or a command node actually
     *  changed, keying the nodes() result cache: an unchanged projection returns the previous
     *  ARRAY reference, not just cached elements — the snapshot's reference-stability contract
     *  (§A.9.4) starts here, and a chunk storm bumps nothing at all. */
    rev = 0;
    nodesResult = null;
    /**
     * Window rebuild (after open/resync/page prepend): re-index the raw window
     * and re-project the transcript.
     * @param events - the new window contents (seq-ascending).
     * @param views - per-event wire views aligned with `events` by index (undefined slots for view-less events).
     */
    reset(events, views) {
        this.rev++;
        this.eventIndex = new Map();
        this.callIdx = new Map();
        this.resultViews.clear();
        this.commandIdx = new Map();
        this.steeringHistory.reset();
        const steeringSeqs = new Set();
        this.stepTimings = new Map();
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            /* v8 ignore next -- dense-array guard: i stays within events.length, so the undefined arm needs a sparse array no caller builds. */
            if (event === undefined) {
                continue;
            }
            this.eventIndex.set(event.seq, event);
            this.indexCall(event, views?.[i]);
            this.indexCommand(event);
            if (this.steeringHistory.apply(event))
                steeringSeqs.add(event.seq);
            indexAssistantStepTiming(this.stepTimings, event);
        }
        // Indexes first, then project: a tool/result materializes against the
        // complete call index, and a checkpoint against the complete event index.
        const projected = [];
        for (const event of events) {
            if (isTranscriptEvent(event))
                projected.push(this.materialize(event, steeringSeqs.has(event.seq)));
        }
        this.projected = projected;
    }
    /**
     * Tail append (live session/event): index the event and, when it belongs to
     * the transcript, extend the projection by one copy-on-write node so a
     * published array never mutates. An event that changes no node (a chunk
     * storm) bumps no revision, so nodes() keeps returning the same array
     * reference.
     * @param event - the live event (seq = window tail + 1).
     * @param view - host-computed tool view paired with the event when it is a tool call/result; indexed for card rendering.
     */
    append(event, view) {
        this.eventIndex.set(event.seq, event);
        this.indexCall(event, view);
        const steering = this.steeringHistory.apply(event);
        indexAssistantStepTiming(this.stepTimings, event);
        if (this.indexCommand(event))
            this.rev++;
        if (!isTranscriptEvent(event))
            return;
        this.projected = [...this.projected, this.materialize(event, steering)];
        this.rev++;
    }
    /**
     * The current transcript node array. Same revision -> same array reference
     * (memo boundary); node objects are materialized once, so an unchanged node
     * keeps its identity across appends.
     * @returns transcript nodes in log order, command nodes merged in by seq.
     */
    nodes() {
        if (this.nodesResult !== null && this.nodesResult.rev === this.rev)
            return this.nodesResult.value;
        // Command nodes fold outside the transcript (log-only events); merge by
        // seq. Both inputs are seq-ascending (log order and run-index insertion
        // order are the same order), so one linear merge keeps flow order.
        let nodes = this.projected;
        if (this.commandIdx.size > 0) {
            nodes = [];
            const commands = [...this.commandIdx.values()];
            let next = 0;
            for (const node of this.projected) {
                for (let cmd = commands[next]; cmd !== undefined && cmd.seq < node.seq; cmd = commands[++next]) {
                    nodes.push(cmd);
                }
                nodes.push(node);
            }
            for (let cmd = commands[next]; cmd !== undefined; cmd = commands[++next])
                nodes.push(cmd);
        }
        this.nodesResult = { rev: this.rev, value: nodes };
        return nodes;
    }
    /** Materialize one transcript event against the complete current indexes. */
    materialize(event, steering) {
        return isCompactCheckpoint(event)
            ? materializeCompaction(event, this.eventIndex)
            : materializeNode(event, this.callIdx, this.resultViews.get(event.seq) ?? null, steering, this.stepTimings);
    }
    /**
     * Fold one command lifecycle event into its node (run mints, done settles in
     * place; done-only soft-falls).
     * @returns whether the command index changed, so callers can bump the revision.
     */
    indexCommand(event) {
        // Log-only plugin events: the host-side dsh-commands declaration cannot
        // enter the client program, so this wire consumer narrows structurally
        // (the same posture as tool/code-dispatch in session.ts).
        if (event.type === 'command/run') {
            const data = event.data;
            this.commandIdx.set(data.commandId, {
                kind: 'command', seq: event.seq, time: event.time,
                commandId: data.commandId, name: data.name, args: data.args, outcome: null,
            });
            return true;
        }
        if (event.type !== 'command/done')
            return false;
        const data = event.data;
        const run = this.commandIdx.get(data.commandId);
        const outcome = { kind: data.kind, ...data.text === undefined ? {} : { text: data.text } };
        if (run === undefined) {
            // Cross-window cut: the run page fell out of the window — build the
            // node from the done alone (same soft-fall as a call-less tool result).
            this.commandIdx.set(data.commandId, {
                kind: 'command', seq: event.seq, time: event.time,
                commandId: data.commandId, name: null, args: null, outcome,
            });
            return true;
        }
        // Settle in place: a fresh node object (published references stay immutable).
        this.commandIdx.set(data.commandId, { ...run, outcome });
        return true;
    }
    indexCall(event, view) {
        if (event.type === 'tool/result') {
            if (view?.for === 'result')
                this.resultViews.set(event.seq, view.view);
            return;
        }
        if (event.type !== 'tool/call')
            return;
        this.callIdx.set(String(event.data.callId), {
            name: event.data.name, argsRaw: event.data.arguments, turn: event.data.turn, step: event.data.step,
            time: event.time,
            callView: view?.for === 'call' ? view.view : null,
        });
        // No backfill into already-materialized tool-result nodes for this callId
        // (window order puts the call before its result; cannot happen on the normal path).
    }
}
//# sourceMappingURL=transcript-adapter.js.map