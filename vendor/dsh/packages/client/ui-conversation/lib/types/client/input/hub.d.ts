/**
 * InputHub: the InputService implementation (`ctx.conversation.input`) — one
 * SessionInputShell per session, created inside the sessions provide
 * materialization (decision 19: the 'input' standard-kit entry IS the
 * creation trigger) and torn down by the scope disposer (instance-and-scope
 * share one lifecycle). The hub registers the three scoped input-mutation
 * listeners on each session's actx (the sole consumer side of the ui-slash
 * bail events) and owns the default-sink choreography: every session is a
 * real host entity, so the sink is one unconditional prompt path.
 */
import type { ClientContext, SessionBinding, SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { SlashController } from '@deepseek-ai/dsh-client-ui-slash/client';
import type { ComposerKeyboard, InputService, SessionInput } from './contract.ts';
import { SessionInputShell } from './facade.ts';
/** Session-addressed input facade registry (InputService face + composer-layer extras). */
export declare class InputHub implements InputService {
    private readonly rootCtx;
    private readonly shells;
    /** @param ctx - client root context (services resolved lazily per call — boot order stays free). */
    constructor(rootCtx: ClientContext);
    /**
     * Resolve the facade for one session-scope ctx (InputService face).
     * @param actx - session-scope context.
     * @returns the resident per-session facade.
     */
    for(actx: ClientContext): SessionInput;
    /**
     * Resident shell for one session binding — the provide-channel entry
     * (called during scope materialization, BEFORE the scope record is
     * queryable, hence binding-fed and hence the thunked slash/popup deps).
     * Wires the scoped event listeners + teardown into the session scope.
     * @param binding - session assembly handle.
     * @returns the shell.
     */
    shellFor(binding: SessionBinding): SessionInputShell;
    /**
     * Resident shell by session id (service-face path; the provide channel has
     * normally created it already — this covers direct id-addressed access).
     * @param id - session id.
     * @returns the shell.
     */
    shell(id: SessionId): SessionInputShell;
    /**
     * The InputBar-exclusive keyboard command face (decision 20): the shell
     * satisfies it structurally; package-internal — handed through the
     * composer-bar entry's inject, never across a plugin boundary.
     * @param id - session id.
     * @returns the shell as the keyboard face.
     */
    keyboard(id: SessionId): ComposerKeyboard;
    /**
     * Resolve the optional slash controller for composer chrome that launches
     * the shared candidate menu without typing a trigger.
     * @param id - session id.
     * @returns the resident controller, or undefined when ui-slash is absent.
     */
    slash(id: SessionId): SlashController | undefined;
    /**
     * Default sink: optimistic clear + prompt. The session is always a real
     * host entity (materialized when its workspace was picked), so there is
     * exactly one path; a failed first prompt is an ordinary prompt failure
     * (error strip via promptError, draft restored only while untouched).
     */
    private sink;
    private controller;
    private popup;
    private sessions;
}
//# sourceMappingURL=hub.d.ts.map