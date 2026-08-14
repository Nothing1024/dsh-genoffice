/**
 * Pure session projection for subagent active-turn duration.
 *
 * @module @deepseek-ai/dsh-subagent/projection
 */
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection';
interface TimingState {
    /** Milliseconds accumulated across completed post-descriptor turns. */
    settledMs: number;
    /** Current open interval kept paired inside the fold. */
    active?: {
        since: number;
        through: number;
    };
    /** Latest pre-descriptor turn start, promoted when the child's own descriptor arrives. */
    pendingTurnStart?: number;
    /** Whether the fold has crossed a descriptor in this logical log. */
    descriptorSeen: boolean;
}
/**
 * Fold turn boundaries around the child's own durable descriptor.
 *
 * A fork seed may contain an ancestor descriptor and completed turns. Every
 * descriptor therefore resets the accumulated state; the healthy catalog
 * admits only a child with exactly one descriptor in its own suffix, making
 * the final reset the child's authoritative timing origin.
 */
export declare const subagentTimingProjectionDefinition: ProjectionDefinition<'subagentTiming', TimingState>;
export {};
//# sourceMappingURL=projection.d.ts.map