/**
 * Pure session projection for subagent active-turn duration.
 *
 * @module @deepseek-ai/dsh-subagent/projection
 */
import { z } from 'zod';
// Zod's optional output includes explicit `undefined`; with
// exactOptionalPropertyTypes the public interface permits omission only.
const projectionSchema = z.object({
    settledMs: z.number().int().nonnegative(),
    active: z.object({
        since: z.number().int().nonnegative(),
        through: z.number().int().nonnegative(),
    }).strict().optional(),
}).strict();
/**
 * Fold turn boundaries around the child's own durable descriptor.
 *
 * A fork seed may contain an ancestor descriptor and completed turns. Every
 * descriptor therefore resets the accumulated state; the healthy catalog
 * admits only a child with exactly one descriptor in its own suffix, making
 * the final reset the child's authoritative timing origin.
 */
export const subagentTimingProjectionDefinition = {
    key: 'subagentTiming',
    schema: projectionSchema,
    init: () => ({ descriptorSeen: false, settledMs: 0 }),
    apply: (state, event) => {
        if (event.type === 'turn/start') {
            return state.descriptorSeen
                ? { ...state, active: { since: event.time, through: event.time } }
                : { ...state, pendingTurnStart: event.time };
        }
        if (event.type === 'subagent/descriptor') {
            const activeSince = state.active?.since ?? state.pendingTurnStart;
            return {
                descriptorSeen: true,
                settledMs: 0,
                ...(activeSince === undefined
                    ? {}
                    : { active: { since: activeSince, through: event.time } }),
            };
        }
        if (event.type === 'turn/end') {
            if (!state.descriptorSeen) {
                if (state.pendingTurnStart === undefined)
                    return state;
                const { pendingTurnStart: _closed, ...next } = state;
                return next;
            }
            if (state.active === undefined)
                return state;
            const { active, ...rest } = state;
            return {
                ...rest,
                settledMs: state.settledMs + Math.max(0, event.time - active.since),
            };
        }
        if (state.active === undefined)
            return state;
        return { ...state, active: { ...state.active, through: event.time } };
    },
    view: state => ({
        settledMs: state.settledMs,
        ...(state.active === undefined ? {} : { active: state.active }),
    }),
    stateVersion: 2,
};
//# sourceMappingURL=projection.js.map