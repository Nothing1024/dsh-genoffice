import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import { InputMachine } from "./machine.js";
/** Guard tier from the machine phase. */
function guardOf(phase) {
    switch (phase) {
        case 'plain': return 'plain';
        case 'claimed': return 'claimed';
        default: return 'frozen'; // adjudicating / submitting
    }
}
const EMPTY_QUEUE = [];
/** No-pipeline lexicon: zero text-ref decorations. */
const EMPTY_LEXICON = new Map();
/**
 * The per-session input facade: scoped-event application verbs +
 * setDraft/submit + the published InputState store.
 */
export class SessionInputShell {
    deps;
    /** Published machine state + queue overlay (the InputZone currency source). */
    state;
    /** Latest surfaced notice (null after clear); the wiring renders it beside the error strip. */
    notices = createSnapshotStore(null);
    /** The public provide-channel action face (one stable identity per session — decision 20). */
    actions = {
        setDraft: (text) => { this.setDraft(text); },
        submit: () => { this.submit('queue'); },
    };
    // Real wall clock: the typing-run merge window must actually expire in
    // production (the machine's no-clock default is a constant for pure tests).
    core = new InputMachine({ now: () => Date.now() });
    noticeSeq = 0;
    lastDraft = '';
    disposed = false;
    /** Draft persistence mirror (chat store write; receives the clipboard projection, never raw placeholders). */
    mirrorFn;
    constructor(deps) {
        this.deps = deps;
        this.state = createSnapshotStore(this.compose());
        deps.queue?.subscribe(() => { this.publish(); });
    }
    // ---- SessionInput face ----
    /**
     * Single draft write path (all mutation rides machine events).
     * @param text - the full next draft.
     * @param editRange - the DOM-observed edit shape, when the caller knows it
     * (narrows the machine's occurrence math; absent → diff scan).
     */
    setDraft(text, editRange) {
        this.run(this.core.dispatch({ type: 'draft-changed', draft: text, ...(editRange !== undefined ? { editRange } : {}) }));
    }
    /**
     * Clear the draft as a successful-send commit: no undo unit is recorded and
     * the undo history is cut, so Ctrl/Cmd-Z cannot resurrect sent content
     * (the command path gets the same discipline from submit-settled success).
     */
    commitSend() {
        this.run(this.core.dispatch({ type: 'send-committed' }));
    }
    /** Undo the latest transaction (InputBar intercepts the platform chord). */
    undo() {
        this.run(this.core.dispatch({ type: 'undo' }));
    }
    /** Redo the latest undone transaction. */
    redo() {
        this.run(this.core.dispatch({ type: 'redo' }));
    }
    /**
     * Paste text over the selection in one transaction, with any hot-snapshot
     * sync matches componentized inside it.
     * @param text - pasted plain text.
     * @param selection - replaced selection in draft coordinates.
     * @param components - sync-matched reference components (disjoint, inside `text`).
     * @param generation - projection generation for late async-upgrade guards.
     */
    pasteBegin(text, selection, components, generation) {
        this.run(this.core.dispatch({
            type: 'paste-begin', text, selection,
            ...(components !== undefined ? { components } : {}),
            ...(generation !== undefined ? { generation } : {}),
        }));
    }
    /** End the live paste-match attempt (caret/selection ops and Slash updates the machine cannot see). */
    invalidatePaste() {
        this.run(this.core.dispatch({ type: 'invalidate-paste' }));
    }
    /**
     * Enter adjudication + submit transaction + default sink. Effects fan out
     * from the machine; this method only feeds the event. Lock entry
     * (adjudicating/submitting) force-closes the transient layers: the popup
     * dismisses and the menu tracks frozen.
     */
    submit(mode = 'queue') {
        this.run(this.core.dispatch({ type: 'enter', mode }));
        const phase = this.snapshot.phase;
        if (phase === 'adjudicating' || phase === 'submitting') {
            this.deps.popup?.()?.dismiss();
            this.deps.slash?.()?.track(this.snapshot.draft, 0, { tier: 'frozen' }, this.snapshot.draftRev);
        }
    }
    /**
     * Feed a draft/caret change through trigger detection (guard derived from
     * the machine phase).
     * @param draft - live draft text.
     * @param caret - caret position in draft coordinates.
     */
    track(draft, caret) {
        this.deps.slash?.()?.track(draft, caret, { tier: guardOf(this.snapshot.phase) }, this.snapshot.draftRev);
    }
    /**
     * Keyboard arbitration while the menu is open.
     * @param key - the intercepted key.
     * @param composing - IME composition guard state.
     * @returns the menu's verdict; 'pass' when no pipeline is mounted.
     */
    arbitrate(key, composing) {
        return this.deps.slash?.()?.arbitrate(key, composing) ?? 'pass';
    }
    /**
     * Space adjudication over the controller's hot state.
     * @returns true = a claim/insert was applied — the caller preventDefaults.
     */
    space() {
        const slash = this.deps.slash?.();
        if (slash === undefined)
            return false;
        const consumed = slash.onSpace();
        // Machine-driven draft replacement never passes through onChange, so
        // re-track: the caret lands after the token, where detection sees
        // whitespace and closes the menu.
        if (consumed) {
            const next = this.snapshot;
            slash.track(next.draft, next.draft.length, { tier: guardOf(next.phase) }, next.draftRev);
        }
        return consumed;
    }
    /** Dismiss the popupSelect shell (any interaction outside the box). */
    dismissPopup() {
        this.deps.popup?.()?.dismiss();
    }
    /**
     * Hot plain-text reference lexicon source for the decoration scan
     * (decision 21): delegates to the controller's aggregated store. Stable
     * identity per shell; without a pipeline the snapshot is the empty Map and
     * subscribers never fire.
     */
    lexicon = {
        getSnapshot: () => this.deps.slash?.()?.lexicon.getSnapshot() ?? EMPTY_LEXICON,
        subscribe: fn => this.deps.slash?.()?.lexicon.subscribe(fn) ?? (() => { }),
    };
    /**
     * Apply one command claim (scoped begin-command event listener body).
     * @param claim - the command claim from the pick path.
     * @param span - pick-time span snapshot.
     * @returns whether the machine accepted (phase + span CAS passed and the draft mutated).
     */
    beginCommand(claim, span) {
        const before = this.core.state.draftRev;
        this.run(this.core.dispatch({ type: 'begin-command', claim, span }));
        return this.core.state.phase === 'claimed' && this.core.state.draftRev !== before;
    }
    /**
     * Apply one reference insertion (scoped insert-reference event listener body).
     * @param ref - the reference insertion from the pick path.
     * @param span - pick-time span snapshot.
     * @returns whether the machine accepted.
     */
    insertReference(ref, span) {
        const before = this.core.state.draftRev;
        this.run(this.core.dispatch({ type: 'insert-ref', reference: ref, span }));
        return this.core.state.draftRev !== before;
    }
    /**
     * Consume one command token after business success (scoped consume-token
     * event listener body). Span guard: revision CAS then splice; bare-token
     * guard: trimmed-draft equality then clear.
     * @param guard - exact span or bare-token guard.
     * @returns whether the token was consumed.
     */
    consumeToken(guard) {
        const snapshot = this.core.state;
        if (guard.kind === 'span') {
            if (guard.span.draftRev !== snapshot.draftRev)
                return false;
            const draft = snapshot.draft;
            this.setDraft(draft.slice(0, guard.span.start) + draft.slice(guard.span.end));
            return true;
        }
        if (snapshot.draft.trim() !== guard.token)
            return false;
        this.setDraft('');
        return true;
    }
    /**
     * Insert plain reference text over the pick-time span (scoped insert-text
     * event listener body, decision 21). Same CAS-then-splice shape as the
     * consume-token span branch: the machine sees an ordinary draft-changed
     * transaction (one undo step), no occurrence is minted — the chip look is
     * a scan-derived decoration, never state.
     * @param text - the plain reference text to splice in (e.g. `/name `).
     * @param span - pick-time span snapshot (draftRev CAS).
     * @returns whether the text was applied.
     */
    insertText(text, span) {
        const snapshot = this.core.state;
        if (span.draftRev !== snapshot.draftRev)
            return false;
        const draft = snapshot.draft;
        this.setDraft(draft.slice(0, span.start) + text + draft.slice(span.end));
        return true;
    }
    /**
     * Surface a notice from outside the machine (detached command results).
     * @param level - severity tier.
     * @param text - notice body.
     */
    notify(level, text) {
        this.noticeSeq += 1;
        this.notices.set({ level, text, seq: this.noticeSeq });
    }
    // ---- wiring-layer extras (not on the frozen SessionInput face) ----
    /** Teardown: abort any in-flight attempt and stop accepting async settlements. */
    dispose() {
        this.disposed = true;
        this.run(this.core.dispatch({ type: 'release' }));
    }
    /** Read the live machine state (guard derivation reads here). */
    get snapshot() {
        return this.state.getSnapshot();
    }
    /**
     * Bind the draft persistence mirror (chat store write). Adopt-on-bind: the
     * store draft may hold a persisted value from a previous mount; the caller
     * seeds it via setDraft BEFORE binding, and afterwards every machine-adopted
     * draft mirrors out.
     * @param write - store draft write.
     * @returns the unbind disposer.
     */
    bindMirror(write) {
        this.mirrorFn = write;
        return () => {
            if (this.mirrorFn === write)
                this.mirrorFn = undefined;
        };
    }
    // ---- effect executor ----
    run(effects) {
        for (const fx of effects)
            this.execute(fx);
        this.publish();
    }
    execute(fx) {
        switch (fx.type) {
            case 'notice': {
                this.noticeSeq += 1;
                this.notices.set({ level: fx.level, text: fx.text, seq: this.noticeSeq });
                return;
            }
            case 'adjudicate': {
                this.adjudicate(fx.attempt, fx.draft);
                return;
            }
            case 'begin-submit': {
                this.beginSubmit(fx.attempt, fx.claim, fx.args);
                return;
            }
            case 'default-sink': {
                this.sinkSerialized(fx.draft, fx.mode);
                return;
            }
            default:
                return; // machine-internal effects (mirror rides publish)
        }
    }
    /**
     * Prompt serialization before the sink (design §3.12): expand each
     * placeholder to its owner's model form via the session controller's
     * codec routing. Owner missing / serialize failure / disposal blocks the
     * send — notice + draft and chips retained, never a silent downgrade to
     * the clipboard text. Chip-free drafts skip the async detour.
     */
    sinkSerialized(draft, mode) {
        const occurrences = this.core.state.occurrences;
        if (occurrences.length === 0) {
            this.deps.defaultSink(draft.trim(), mode);
            return;
        }
        const slash = this.deps.slash?.();
        const controller = new AbortController();
        void Promise.all(occurrences.map(async (o) => {
            if (slash === undefined)
                throw new Error(`no serializer for reference source "${o.source}"`);
            return { offset: o.offset, text: await slash.serializeReference(o.source, o.ref, controller.signal) };
        })).then((parts) => {
            if (this.disposed)
                return;
            // Splice model forms over their placeholders (offsets are draft-time;
            // parts arrive offset-sorted since the table is).
            let out = '';
            let cursor = 0;
            for (const part of parts) {
                out += draft.slice(cursor, part.offset) + part.text;
                cursor = part.offset + 1;
            }
            out += draft.slice(cursor);
            this.deps.defaultSink(out.trim(), mode);
        }, (error) => {
            controller.abort();
            if (this.disposed)
                return;
            const message = error instanceof Error ? error.message : String(error);
            this.notify('error', message);
        });
    }
    /** Enter adjudication: poll the session controller; failure = notice + draft retained (never a silent downgrade). */
    adjudicate(attempt, draft) {
        const slash = this.deps.slash?.();
        if (slash === undefined) {
            // No pipeline mounted: the '/' line is an ordinary message.
            this.run(this.core.dispatch({ type: 'adjudicated', attempt, outcome: undefined }));
            return;
        }
        slash.adjudicate(draft.trim(), attempt.signal).then((outcome) => {
            if (this.dead(attempt))
                return;
            this.run(this.core.dispatch({ type: 'adjudicated', attempt, outcome }));
        }, (error) => {
            if (this.dead(attempt))
                return;
            const message = error instanceof Error ? error.message : String(error);
            this.run(this.core.dispatch({ type: 'adjudication-failed', attempt, message }));
        });
    }
    /** The submit transaction: claim.submit against the session scope; ok maps from the outcome kind. */
    beginSubmit(attempt, claim, args) {
        Promise.resolve()
            .then(() => claim.submit(args, this.deps.actx))
            .then((outcome) => {
            if (this.dead(attempt))
                return;
            this.run(this.core.dispatch({
                type: 'submit-settled', attempt, ok: outcome.kind === 'success', outcome,
            }));
        }, (error) => {
            if (this.dead(attempt))
                return;
            const message = error instanceof Error ? error.message : String(error);
            this.run(this.core.dispatch({ type: 'submit-settled', attempt, ok: false, message }));
        });
    }
    /** Late-settlement guard: superseded attempts and disposed facades drop silently. */
    dead(attempt) {
        return this.disposed || attempt.signal.aborted;
    }
    compose() {
        const core = this.core.state;
        return { ...core, queue: this.deps.queue?.getSnapshot() ?? EMPTY_QUEUE };
    }
    publish() {
        const next = this.compose();
        this.state.set(next);
        if (next.draft !== this.lastDraft) {
            this.lastDraft = next.draft;
            this.mirrorFn?.(next.draft);
        }
    }
}
//# sourceMappingURL=facade.js.map