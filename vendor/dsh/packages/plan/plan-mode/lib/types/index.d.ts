/**
 * Plan mode is logged per-agent collaboration state: while active, a
 * deployment-owned guidance section shapes each model request, and
 * `exit_plan_mode` presents the completed plan for user review, while the
 * `/plan off` command lets a user leave directly. Plan mode is independent of
 * sandbox mode and approval policy; those enforcement axes do not read or
 * write plan state.
 *
 * The state in force is folded from the session log (`plan/mode`, last one
 * wins), so resume and fork restore it without a live mirror. User selections
 * are held as pending intent until an in-turn step boundary. The service
 * projects pending intent into the proposed step assembly, then flushes it
 * from `agent/pre-step` only when the step is accepted. Same-step request
 * retries reuse their assembly.
 *
 * The exit tool remains registered while plan mode is inactive so crossing a
 * boundary changes only the prompt section, not the request tool catalog.
 *
 * Agent Note:
 * - .agents/notes/implemented/simplification/2026-07-22-plan-specific-collaboration-state.md
 *
 * @module @deepseek-ai/dsh-plan-mode
 */
import { Context, Service } from 'cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
export type * from './types.ts';
declare module '@deepseek-ai/dsh-session' {
    interface SessionEventMap {
        /**
         * Whether plan mode is in force from this point on: log-only, non-surface,
         * whole-value replace. The last `plan/mode` wins; a log with none folds to
         * inactive through {@link foldPlanMode}.
         */
        'plan/mode': {
            active: boolean;
        };
    }
}
declare module 'cordis' {
    interface Context {
        planMode: PlanModeService;
    }
}
/**
 * The model-facing exit tool's name. It stays registered while plan mode is
 * inactive so the request tool catalog is stable across transitions.
 */
export declare const EXIT_PLAN_MODE = "exit_plan_mode";
/** Deployment-owned plan guidance. */
export interface PlanModeConfig {
    /** Guidance rendered as the `plan:policy` prompt section while plan mode is active. */
    section: string;
}
/**
 * Validate deployment-owned plan guidance. Missing, blank, non-string, or
 * unknown fields fail at plugin load rather than silently shaping nothing.
 *
 * @param config Raw plugin config.
 * @returns A detached validated config.
 */
export declare function resolveConfig(config: PlanModeConfig): PlanModeConfig;
/**
 * Whether plan mode is active after the first `end` events. The last
 * `plan/mode` wins; a prefix with none is inactive.
 *
 * @param events The session log or any prefix of it.
 * @param end Fold `events[0, end)`; defaults to the whole log.
 * @returns Whether plan mode is active.
 */
export declare function foldPlanMode(events: readonly SessionEvent[], end?: number): boolean;
/**
 * `ctx.planMode`: owns logged plan state, boundary application and narration,
 * the `plan:policy` section, the `/plan` command, and the stable exit tool.
 * UIs observe committed flips through `session/event`; there is no live mirror.
 */
export declare class PlanModeService extends Service {
    static inject: string[];
    /** Validated deployment-owned guidance. */
    private readonly section;
    /**
     * Latest selection per session awaiting an in-turn request-boundary flush.
     * `narrate` is true for user selections and false for the exit tool, whose
     * result already narrates the transition.
     */
    private readonly pendingIntents;
    constructor(ctx: Context, config?: PlanModeConfig);
    /**
     * Read the logged plan state and any selected state awaiting a boundary.
     *
     * @param agent The agent to read.
     * @returns Current logged state plus a pending selection, when present.
     */
    get(agent: Agent): {
        active: boolean;
        pending?: boolean;
    };
    /**
     * Select whether plan mode should be active. Between turns the change
     * commits immediately — no request boundary would arrive until the next
     * prompt, so a queued intent would hang (the open-turn fold is the idle
     * signal: agent status stays `running` through post-turn checkpointing,
     * where a boundary equally never comes). During an open turn the
     * selection is held as pending intent for the next in-turn request
     * boundary. Repeated selection of the current or already-pending state is
     * a no-op.
     *
     * @param agent The agent to switch.
     * @param active Whether plan mode should be active.
     * @returns what happened: `committed` (logged now), `queued` (awaiting the
     * next boundary), `cancelled` (an opposite pending selection was cleared;
     * the logged state already matches), or `noop` (already in that state).
     */
    set(agent: Agent, active: boolean): 'committed' | 'queued' | 'cancelled' | 'noop';
    /** Flush one pending selection before the next request assembly. */
    private onBoundary;
    /** Build a user-switch notice when the last logged header described the other mode. */
    private narration;
}
export default PlanModeService;
//# sourceMappingURL=index.d.ts.map