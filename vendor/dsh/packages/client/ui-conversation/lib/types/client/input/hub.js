import { queueReadFaceOf } from "../queue/store.js";
import { SessionInputShell } from "./facade.js";
/** Session-addressed input facade registry (InputService face + composer-layer extras). */
export class InputHub {
    rootCtx;
    shells = new Map();
    /** @param ctx - client root context (services resolved lazily per call — boot order stays free). */
    constructor(rootCtx) {
        this.rootCtx = rootCtx;
    }
    /**
     * Resolve the facade for one session-scope ctx (InputService face).
     * @param actx - session-scope context.
     * @returns the resident per-session facade.
     */
    for(actx) {
        const sessions = this.sessions();
        const id = sessions.scopeOf(actx);
        if (id === undefined)
            throw new Error('conversation.input.for requires a session scope');
        return this.shell(id);
    }
    /**
     * Resident shell for one session binding — the provide-channel entry
     * (called during scope materialization, BEFORE the scope record is
     * queryable, hence binding-fed and hence the thunked slash/popup deps).
     * Wires the scoped event listeners + teardown into the session scope.
     * @param binding - session assembly handle.
     * @returns the shell.
     */
    shellFor(binding) {
        const existing = this.shells.get(binding.sessionId);
        if (existing !== undefined)
            return existing;
        const { sessionId: id, session, ctx: actx } = binding;
        const shell = new SessionInputShell({
            actx,
            slash: () => this.controller(actx),
            popup: () => this.popup(actx),
            queue: queueReadFaceOf(session),
            defaultSink: (text, mode) => { this.sink(session, text, mode); },
        });
        this.shells.set(id, shell);
        // The one teardown axis: listeners, shell, and map entries all ride the
        // scope fiber (decision 12 — nothing here outlives the scope).
        actx.effect(() => {
            const offs = [
                actx.on('slash/input-begin-command', req => shell.beginCommand(req.claim, req.span) ? true : undefined),
                actx.on('slash/input-insert-reference', req => shell.insertReference(req.reference, req.span) ? true : undefined),
                actx.on('slash/input-consume-token', req => shell.consumeToken(req.guard) ? true : undefined),
                actx.on('slash/input-insert-text', req => shell.insertText(req.text, req.span) ? true : undefined),
            ];
            return () => {
                for (const off of offs)
                    off();
                shell.dispose();
                this.shells.delete(id);
            };
        }, 'conversation.input: session shell');
        return shell;
    }
    /**
     * Resident shell by session id (service-face path; the provide channel has
     * normally created it already — this covers direct id-addressed access).
     * @param id - session id.
     * @returns the shell.
     */
    shell(id) {
        const existing = this.shells.get(id);
        if (existing !== undefined)
            return existing;
        const binding = this.sessions().binding(id);
        if (binding === undefined)
            throw new Error(`conversation.input: session "${id}" resolved no binding`);
        return this.shellFor(binding);
    }
    /**
     * The InputBar-exclusive keyboard command face (decision 20): the shell
     * satisfies it structurally; package-internal — handed through the
     * composer-bar entry's inject, never across a plugin boundary.
     * @param id - session id.
     * @returns the shell as the keyboard face.
     */
    keyboard(id) {
        return this.shell(id);
    }
    /**
     * Resolve the optional slash controller for composer chrome that launches
     * the shared candidate menu without typing a trigger.
     * @param id - session id.
     * @returns the resident controller, or undefined when ui-slash is absent.
     */
    slash(id) {
        const actx = this.sessions().scope(id);
        return actx === undefined ? undefined : this.controller(actx);
    }
    /**
     * Default sink: optimistic clear + prompt. The session is always a real
     * host entity (materialized when its workspace was picked), so there is
     * exactly one path; a failed first prompt is an ordinary prompt failure
     * (error strip via promptError, draft restored only while untouched).
     */
    sink(session, text, mode) {
        if (text === '')
            return;
        const shell = this.shells.get(session.sessionId);
        // Commit, not an editable clear: undo must not resurrect sent content.
        shell?.commitSend();
        void session.prompt([{ type: 'text', text }], mode).then((result) => {
            if (!result.ok && shell?.snapshot.draft === '')
                shell.setDraft(text);
        }, () => {
            if (shell?.snapshot.draft === '')
                shell.setDraft(text);
        });
    }
    controller(actx) {
        const slash = this.rootCtx.get('slash');
        return slash?.sessionOf(actx);
    }
    popup(actx) {
        const command = this.rootCtx.get('command');
        return command?.popupFor(actx);
    }
    sessions() {
        const sessions = this.rootCtx.get('sessions');
        if (sessions === undefined)
            throw new Error('conversation.input: sessions service unavailable');
        return sessions;
    }
}
//# sourceMappingURL=hub.js.map