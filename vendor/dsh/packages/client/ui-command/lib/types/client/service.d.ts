/**
 * CommandService (`ctx.command`): the '/' command source over the
 * session-keyed directory, the client-contribution registry, and the
 * per-session popupSelect controllers. Candidate synthesis merges the host
 * catalog with contributions by availability, then fuzzy query/position
 * filtering; a host/contribution name collision fails loud. Every execute
 * addresses the session's agent by sessionId — sessions are always
 * agent-backed.
 */
import { Service } from 'cordis';
import type { Context } from 'cordis';
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client';
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import type { ClientSessionContext } from '@deepseek-ai/dsh-client-ui-slash/client';
import type { CommandContribution, CommandDecoration, CommandServiceContract } from './contract.ts';
import { PopupSelectController } from './popup.ts';
/** Command surface: session-keyed directory + '/' source + contribution registry + per-session popups. */
export declare class CommandService extends Service implements CommandServiceContract {
    static inject: string[];
    private readonly directory;
    private readonly live;
    /**
     * @param ctx - owning root context (plugin fiber; the service registers
     * itself as `command` and follows that fiber's lifetime).
     */
    constructor(ctx: Context);
    /**
     * Register one client command contribution; effect disposer (rides the
     * caller's fiber). Duplicate names throw.
     * @param contribution - the contribution (descriptor + availability + popup spec).
     * @returns the disposer removing the registration.
     */
    register(contribution: CommandContribution): () => void;
    /**
     * Hang a bare-invocation decoration on one host command; effect disposer
     * (rides the caller's fiber). Duplicate names throw.
     * @param decoration - host command name + availability + popup spec.
     * @returns the disposer removing the registration.
     */
    decorate(decoration: CommandDecoration): () => void;
    /**
     * Resolve the per-session popup controller (lazy; dies with the session
     * scope). The controller's consume callback dispatches the scoped
     * consume-token event back to this session; focusComposer reaches the
     * composer through the overlay slot currency.
     * @param actx - session-scope ctx.
     * @returns the resident controller.
     */
    popupFor(actx: ClientContext): PopupSelectController<ClientSessionContext>;
    /** Composer focus hooks by session (the overlay wiring binds the textarea focus here). */
    private readonly focusHooks;
    /**
     * Bind one session's composer-focus hook (overlay slot wiring; unbind on unmount).
     * @param id - session id.
     * @param focus - textarea focus callback.
     * @returns the unbind disposer.
     */
    bindComposerFocus(id: SessionId, focus: () => void): () => void;
    /** Menu candidates: host catalog + contribution availability, then position filtering and fuzzy name ranking. */
    private candidates;
    /** Decision table, menu column: contribution/decorated-host → popup; host input → claim; host bare → detached execute. */
    private dispatch;
    /** Decision table, space column: hot-key sync check; only host leadingInput claims. */
    private matchSpace;
    /**
     * Decision table, enter column. Strong-waits the session's catalog (a
     * warmup failure rejects — never a silent downgrade). Contributions and
     * bare host commands act on the bare token only; leadingInput claims
     * args-tolerant.
     */
    private matchEnter;
    /** Open the session's popup for one contribution or decoration (menu pick / bare enter). */
    private openPopup;
    /** Build the leadingInput claim: token `/name ` + the command.execute submit transaction. */
    private leadingClaim;
    /**
     * The command.execute transaction, addressed to the session's agent — pure
     * admission semantics. An unmatched line reports an error outcome (the
     * composer's immediate admission feedback); an admitted command reports
     * plain success regardless of its handler outcome, because the host
     * executor durably logged the lifecycle (`command/run`/`command/done`) and
     * the outcome renders as a persistent flow node — the composer never
     * echoes it. Transport failures throw.
     */
    private execute;
    /**
     * Fire-and-forget execute for the internal ('handled') paths. Outcomes are
     * NOT surfaced here: the host executor durably logs the command lifecycle
     * (`command/run`/`command/done`), and the mux-broadcast events render as a
     * persistent flow node on every tab. Only a transport/admission failure —
     * which never entered a handler and therefore never logged — falls back to
     * the composer notice as immediate feedback.
     */
    private runDetached;
    /** Dispatch a consume-token event to one session (menu-pick / bare-enter execute paths). */
    private consumeVia;
    /** Route an admission/transport failure to the session's composer notice channel (scope gone = attempt died with it). */
    private noticeFor;
    /** id → actx interchange (registered exchange point: this service coordinates for projection-only sources). */
    private scopeFor;
    private sessions;
}
//# sourceMappingURL=service.d.ts.map