/**
 * Trajectory list fold: expand assistant blocks, attach usage to Message,
 * own-duration times, in-flight partial/runningCalls, and group descriptions.
 */
import type { ConversationSnapshot, RequestInspectionSnapshot, RequestView } from '@deepseek-ai/dsh-client-runtime/client';
import type { TrajectoryCellProps } from './trajectory-record.ts';
/** One Message or Step group inside a turn. */
export interface TrajectoryGroupModel {
    title: string;
    description?: string;
    cells: readonly TrajectoryCellProps[];
}
/** One sticky turn, or a standalone compaction section between turns. */
export interface TrajectoryTurnModel {
    turn: number | null;
    groups: readonly TrajectoryGroupModel[];
}
/** Snapshot slice the trajectory view folds. */
export interface TrajectoryLayoutInput {
    nodes: ConversationSnapshot['nodes'];
    partial: ConversationSnapshot['partial'];
    runningCalls: ConversationSnapshot['runningCalls'];
    requests?: readonly RequestView[];
    callSchemas?: RequestInspectionSnapshot['callSchemas'];
    /** run_code sub-dispatches by parent callId (sub-cells nest under the parent Tool cell). */
    codeDispatches: ConversationSnapshot['codeDispatches'];
}
/**
 * Fold a snapshot into turn → Message/Step groups with expanded cells.
 * @param input - nodes plus in-flight partial/runningCalls.
 * @returns turns ordered by first appearance.
 */
export declare function deriveTrajectoryLayout(input: TrajectoryLayoutInput): readonly TrajectoryTurnModel[];
/**
 * Append the changing in-flight assistant cells to a stable finalized layout.
 * @param turns - Finalized layout derived with an empty-block partial anchor.
 * @param partial - Current in-flight assistant projection.
 * @param lastIndex - Highest cell index in the finalized layout.
 * @returns The original layout without a partial, otherwise a layout sharing every unaffected turn.
 */
export declare function appendTrajectoryPartialLayout(turns: readonly TrajectoryTurnModel[], partial: ConversationSnapshot['partial'], lastIndex: number): readonly TrajectoryTurnModel[];
/**
 * Build a bounded one-line ledger preview without parsing the complete Markdown document.
 * Full source remains on the cell for the inspector.
 * @param text - Untrusted message, reasoning, payload, or result text.
 * @returns A compact preview capped independently from the retained source.
 */
export declare function trajectoryPreviewText(text: string): string;
//# sourceMappingURL=layout.d.ts.map