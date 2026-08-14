/** Rewind-delimited trajectory branches assembled across surface rewrites. */
import type { ConversationContext, ConversationNode, RequestView } from '@deepseek-ai/dsh-client-runtime/client';
/** One continuous context branch; compactions stay inline while rewinds start a successor branch. */
export interface TrajectoryContextBranch {
    id: number;
    /** Identity stable when older context generations are prepended. */
    key: string;
    contexts: readonly ConversationContext[];
    latest: ConversationContext;
    nodes: readonly ConversationNode[];
    /** Seq that opened this branch; earlier requests require retained surface provenance. */
    startSeq: number;
    /** Exact pre-rewind surface records inherited by this branch. */
    retainedSurfaceSeqs: ReadonlySet<number>;
}
/**
 * Join context generations across compaction/rewrite operations and split only at rewind.
 * @param contexts - Append-only context generations from the runtime fold.
 * @returns Rewind-delimited branches in creation order.
 */
export declare function deriveTrajectoryContextBranches(contexts: readonly ConversationContext[]): readonly TrajectoryContextBranch[];
/**
 * Test whether a provider request belongs to one rewind branch.
 * @param branch - Branch carrying exact inherited surface provenance.
 * @param request - Provider request to classify.
 * @returns Whether the request began on this branch or produced a retained surface record.
 */
export declare function trajectoryBranchContainsRequest(branch: TrajectoryContextBranch, request: RequestView): boolean;
//# sourceMappingURL=context-branches.d.ts.map