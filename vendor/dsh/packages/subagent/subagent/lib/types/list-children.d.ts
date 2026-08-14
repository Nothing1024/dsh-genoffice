/**
 * Read-only interpretation of session-query lineage as durable subagent
 * children. Only descendants with durable `origin: 'subagent'` enter per-child
 * inspection. The module owns no catalog state and does not consult Activation,
 * Agent-registry, continuation-manager, or provider state. A child's descriptor
 * distinguishes one-shot work from a continuable conversation.
 *
 * @module @deepseek-ai/dsh-subagent
 */
import type { Context } from 'cordis';
import type { SessionId } from '@deepseek-ai/dsh-session';
import type SubagentService from './index.ts';
/**
 * One entry of a {@link listChildren} result in trace candidate order. Only a
 * candidate whose durable header has `origin: 'subagent'` is inspected. A
 * valid descriptor produces a `child`, a per-child inspection failure produces
 * a `diagnostic`, and a candidate without its own descriptor is omitted.
 * Healthy rows include a one-level, origin-classified descendant hint.
 * Diagnostics are transient query results, never session events or catalog
 * state, and never expose model-hidden descriptor content.
 */
export type SubagentListEntry = {
    readonly kind: 'child';
    /** The durable child session id, stable across Activations. */
    readonly id: SessionId;
    /**
     * Corpus snapshot activity: `running` means the logical record is live in
     * `ctx.sessions`; `inactive` means it exists only in persistence. Neither
     * encodes a durable outcome, and a continuable child may still reject
     * delivery as an ownership conflict.
     */
    readonly activity: 'running' | 'inactive';
    /** Whether a direct descendant has durable `origin: 'subagent'`. */
    readonly hasChildren: boolean;
} & ({
    /** A terminal one-shot child. */
    readonly mode: 'one-shot';
    /** Optional durable creation label from the child's descriptor. */
    readonly label?: string;
} | {
    /** A resumable conversation. */
    readonly mode: 'continuable';
    /** Durable creation label from the child's descriptor. */
    readonly label: string;
}) | {
    readonly kind: 'diagnostic';
    /** The traced candidate's session id. */
    readonly id: SessionId;
    /**
     * Why the candidate was omitted: `corrupt` for invalid surfaces, header
     * conflicts, or malformed/duplicated descriptors; `unsupported` for an
     * unknown descriptor version; `unavailable` when the child disappeared or
     * its per-child read hit a persistence failure.
     */
    readonly reason: 'corrupt' | 'unsupported' | 'unavailable';
};
/**
 * Interpret one parent's origin-classified direct descendants as session-backed
 * subagents without loading or resuming an Agent. Ordinary forks are skipped
 * before per-child event inspection.
 * @see {@link SubagentService.listChildren} for the public cancellation and
 *   failure contract.
 * @param ctx - context carrying the optional session-query service.
 * @param parentSessionId - parent session whose direct children are listed.
 * @param signal - caller-owned cancellation.
 * @returns children and per-child diagnostics in stable trace order.
 * @throws {@link SubagentError} when session query is unavailable or
 *   the caller cancels the scan.
 */
export declare function listChildren(ctx: Context, parentSessionId: SessionId, signal?: AbortSignal): ReturnType<SubagentService['listChildren']>;
//# sourceMappingURL=list-children.d.ts.map