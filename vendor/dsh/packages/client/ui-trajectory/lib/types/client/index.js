import { createTrajectoryDurationStore } from "./duration-store.js";
import { TrajectoryView } from "./TrajectoryView.js";
/** Required services: the conversation view slot and independent history source. */
export const inject = ['slots', 'sessionHistory'];
/**
 * Client plugin body: register the trajectory view tab. The registration
 * rides the slot service's effect wrapper, so plugin unload removes the tab.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    const duration = createTrajectoryDurationStore();
    ctx.slots.inject('conversation.view', () => ctx.slots.register({
        name: 'conversation.view',
        id: 'trajectory',
        order: 10,
        label: 'Trajectory',
        inject: (sessionId) => {
            const history = ctx.sessionHistory.source(sessionId);
            return {
                hooks: { history, duration },
                loadHistoryTail: signal => history.loadTail(signal),
                loadOlderHistory: signal => history.loadOlder(signal),
                setActualDuration: (value) => { duration.set(value); },
            };
        },
    }, TrajectoryView));
}
//# sourceMappingURL=index.js.map