import { GoalDock } from "./GoalBar.js";
import { en, zh } from "./locales.js";
export { GoalBar, GoalDock } from "./GoalBar.js";
/** Dictionary namespace owned by this plugin. */
const NS = 'goal';
/** Required services: slots for the dock entry, sessions for the projected ref, connection for the wire verbs, locale for the copy. */
export const inject = ['slots', 'sessions', 'connection', 'locale'];
/** Map one settled RPC result onto the strip's inline-render shape. */
function settle(result) {
    if (result.ok)
        return { ok: true };
    return { ok: false, error: { code: result.error.code, message: result.error.message } };
}
/**
 * Client plugin body: the GoalBar dock entry with its mutation verbs.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-goal: dictionaries');
    const { goals } = ctx.get('connection').api;
    const sessions = ctx.sessions;
    /** The session's current projected CAS ref, read at verb call time (no staleness fence: the RPC's CAS is the guard). */
    const refOf = (sessionId) => {
        const face = sessions.binding(sessionId)?.session.projections.faceOf('goal');
        const projection = face?.getSnapshot();
        if (projection == null)
            return undefined;
        return { id: projection.goal.id, revision: projection.goal.revision };
    };
    const noCurrentGoal = {
        ok: false,
        error: { code: 'no-current-goal', message: 'no current goal to mutate' },
    };
    ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
        name: 'conversation.input.dock',
        id: 'goal',
        order: 10,
        locale: NS,
        inject: (sessionId) => ({
            onEdit: async (objective) => {
                const ref = refOf(sessionId);
                if (ref === undefined)
                    return noCurrentGoal;
                return settle((await goals.edit({ sessionId, ref, objective })).result);
            },
            onPause: async () => {
                const ref = refOf(sessionId);
                if (ref === undefined)
                    return noCurrentGoal;
                return settle((await goals.pause({ sessionId, ref })).result);
            },
            onResume: async () => {
                const ref = refOf(sessionId);
                if (ref === undefined)
                    return noCurrentGoal;
                return settle((await goals.resume({ sessionId, ref })).result);
            },
            onClear: async () => {
                const ref = refOf(sessionId);
                if (ref === undefined)
                    return noCurrentGoal;
                return settle((await goals.clear({ sessionId, ref })).result);
            },
        }),
    }, GoalDock));
}
//# sourceMappingURL=index.js.map