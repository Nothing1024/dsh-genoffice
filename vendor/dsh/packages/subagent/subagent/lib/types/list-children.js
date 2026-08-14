/**
 * Read-only interpretation of session-query lineage as durable subagent
 * children. Only descendants with durable `origin: 'subagent'` enter per-child
 * inspection. The module owns no catalog state and does not consult Activation,
 * Agent-registry, continuation-manager, or provider state. A child's descriptor
 * distinguishes one-shot work from a continuable conversation.
 *
 * @module @deepseek-ai/dsh-subagent
 */
import { SubagentError } from "./error.js";
import { foldSubagentDescriptor } from "./descriptor.js";
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
export async function listChildren(ctx, parentSessionId, signal) {
    const query = ctx.get('sessionQuery');
    if (query === undefined) {
        throw new SubagentError('listing subagents requires session query (load a dsh-session-query backend)', 'SUBAGENT_CONTROL_SESSION_QUERY_UNAVAILABLE');
    }
    assertListingNotCancelled(signal);
    // Keep runtime values behind the listing-only boundary so ordinary
    // subagent imports and control operations do not evaluate the optional peer.
    const queryRuntime = await import('@deepseek-ai/dsh-session-query');
    assertListingNotCancelled(signal);
    const trace = await runListingQuery(() => query.traceSession(parentSessionId, signal), signal);
    const entries = [];
    for (const node of trace.descendants) {
        if (node.session.header.origin !== 'subagent')
            continue;
        const hasChildren = node.descendants.some(descendant => descendant.session.header.origin === 'subagent');
        const entry = await inspectChild(query, queryRuntime, parentSessionId, node.session, hasChildren, signal);
        // Cancellation can race the inspection's last checkpoint or diagnostic
        // mapping; do not return success or begin another candidate afterward.
        assertListingNotCancelled(signal);
        if (entry !== undefined)
            entries.push(entry);
    }
    return entries;
}
/** Interpret one traced direct-child record as a child, diagnostic, or exclusion. */
async function inspectChild(query, queryRuntime, parentSessionId, candidate, hasChildren, signal) {
    const childId = candidate.header.id;
    try {
        const records = await runListingQuery(() => query.listEvents(childId), signal);
        // Only the child's own suffix: a fork seed may replay an ancestor's
        // descriptor without making the fork itself a subagent.
        const seedLength = candidate.header.seedLength ?? 0;
        const descriptorSeqs = records
            .filter(record => record.seq >= seedLength && record.type === 'subagent/descriptor')
            .map(record => record.seq);
        if (descriptorSeqs.length === 0)
            return undefined;
        if (descriptorSeqs.length > 1) {
            return { kind: 'diagnostic', id: childId, reason: 'corrupt' };
        }
        // The length-one branch proves this exact-read sequence exists.
        // oxlint-disable-next-line typescript/no-non-null-assertion
        const seq = descriptorSeqs[0];
        const window = await runListingQuery(() => query.readEvent({ sessionId: childId, seq }, signal), signal);
        queryRuntime.assertSessionHeadersCompatible(window.session, candidate.header);
        if (window.session.parentSession !== parentSessionId || window.target.type !== 'subagent/descriptor') {
            return { kind: 'diagnostic', id: childId, reason: 'corrupt' };
        }
        let descriptor;
        try {
            descriptor = foldSubagentDescriptor([window.target]);
        }
        catch {
            return { kind: 'diagnostic', id: childId, reason: 'corrupt' };
        }
        if (descriptor === undefined) {
            return { kind: 'diagnostic', id: childId, reason: 'unsupported' };
        }
        const activity = candidate.live ? 'running' : 'inactive';
        if (descriptor.mode === 'one-shot') {
            return {
                kind: 'child',
                id: childId,
                mode: descriptor.mode,
                ...descriptor.label !== undefined ? { label: descriptor.label } : {},
                activity,
                hasChildren,
            };
        }
        return {
            kind: 'child', id: childId, mode: descriptor.mode, label: descriptor.label,
            activity, hasChildren,
        };
    }
    catch (error) {
        const reason = perChildDiagnosticReason(error, queryRuntime.SessionQueryError);
        if (reason === undefined)
            throw error;
        return { kind: 'diagnostic', id: childId, reason };
    }
}
/** Stop a listing scan at its next cancellation checkpoint. */
function assertListingNotCancelled(signal) {
    if (signal?.aborted) {
        throw new SubagentError('subagent listing was cancelled', 'CANCELLED');
    }
}
/**
 * Run one session-query operation between cancellation checkpoints. Query
 * implementations may reject with their own abort error after observing the
 * forwarded signal; cancellation remains a stable subagent failure.
 */
async function runListingQuery(operation, signal) {
    assertListingNotCancelled(signal);
    try {
        const result = await operation();
        assertListingNotCancelled(signal);
        return result;
    }
    catch (error) {
        assertListingNotCancelled(signal);
        throw error;
    }
}
/**
 * Map a per-child query failure to a fixed diagnostic. Configuration errors
 * and unrecognized failures remain operation failures.
 */
function perChildDiagnosticReason(error, SessionQueryError) {
    if (!(error instanceof SessionQueryError))
        return undefined;
    switch (error.code) {
        case 'SESSION_QUERY_CORRUPT_SESSION':
            return 'corrupt';
        case 'SESSION_QUERY_SESSION_NOT_FOUND':
        case 'SESSION_QUERY_EVENT_NOT_FOUND':
        case 'SESSION_QUERY_PERSISTENCE_FAILED':
            return 'unavailable';
        case 'SESSION_QUERY_INVALID_SURFACE':
        case 'SESSION_QUERY_SOURCE_CONFLICT':
            return 'corrupt';
        default:
            return undefined;
    }
}
//# sourceMappingURL=list-children.js.map