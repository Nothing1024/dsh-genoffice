/**
 * Shared in-process child composition: the delegation-depth budget, the
 * durable session metadata, the resolved child `AgentOptions`, and the scoped
 * setup a child agent needs. Both the one-shot provider driver and the
 * continuation manager compose children this way, so depth accounting and
 * lineage stamping have one home.
 *
 * @module @deepseek-ai/dsh-subagent/child-agent
 */
import { delegationDepthOf } from "./depth.js";
/** Thrown when starting a child would exceed the requested depth cap. */
export class SubagentDepthError extends Error {
    attemptedDepth;
    maxDepth;
    constructor(attemptedDepth, maxDepth) {
        super(`subagent depth ${attemptedDepth} exceeds maxDepth ${maxDepth}`);
        this.attemptedDepth = attemptedDepth;
        this.maxDepth = maxDepth;
        this.name = 'SubagentDepthError';
    }
}
/**
 * Resolve the child's delegation depth from its parent and enforce an optional
 * cap. The persisted parent header is the monotone floor, so a resumed parent
 * cannot delegate as if it were top-level.
 * @param parent - the delegating parent agent.
 * @param maxDepth - optional absolute cap the resolved depth must not exceed.
 * @returns the child's non-negative safe-integer depth.
 * @throws {SubagentDepthError} when the resolved depth exceeds `maxDepth`.
 * @throws {RangeError} when the resolved depth leaves the safe-integer range.
 */
export function resolveChildDepth(parent, maxDepth) {
    const childDepth = delegationDepthOf(parent) + 1;
    if (!Number.isSafeInteger(childDepth))
        throw new RangeError('subagent child depth exceeds the safe-integer range');
    if (maxDepth !== undefined && childDepth > maxDepth) {
        throw new SubagentDepthError(childDepth, maxDepth);
    }
    return childDepth;
}
/**
 * Resolve the child's `AgentOptions`: the parent's provider/model/maxTokens
 * route unless the request overrides it, stamped with the child's own
 * delegation depth.
 * @param parent - the delegating parent whose route the child inherits.
 * @param requested - per-child overrides, if any.
 * @param childDepth - the resolved delegation depth to stamp.
 * @returns the resolved options for `ctx.agents.create()`.
 */
export function resolveChildAgentOptions(parent, requested, childDepth) {
    const parentProvider = parent.options.provider;
    const parentModel = parent.options.model;
    const parentMaxTokens = parent.options.maxTokens;
    return {
        ...parentProvider !== undefined ? { provider: parentProvider } : {},
        ...parentModel !== undefined ? { model: parentModel } : {},
        ...parentMaxTokens !== undefined ? { maxTokens: parentMaxTokens } : {},
        ...requested,
        subagentDepth: childDepth,
    };
}
/**
 * Build the child session's durable creation metadata: the parent's workspace,
 * its direct lineage, coarse product origin, the recursion budget that must
 * survive persistence, and the seed boundary that separates inherited parent
 * history from child work.
 * @param parent - the delegating parent agent.
 * @param childDepth - the resolved delegation depth to persist.
 * @param lineageSeedLength - how many leading events came from the parent's log.
 * @returns the `meta` for `ctx.agents.create()`.
 */
export function childSessionMeta(parent, childDepth, lineageSeedLength) {
    const parentHeader = parent.session.header;
    return {
        ...parentHeader.cwd !== undefined ? { cwd: parentHeader.cwd } : {},
        parentSession: parentHeader.id,
        // Navigation classification only; the descriptor remains the authority
        // for mode and continuation capability.
        origin: 'subagent',
        // Durable: the recursion budget must survive persistence and resume.
        delegationDepth: childDepth,
        ...lineageSeedLength > 0 ? { seedLength: lineageSeedLength } : {},
    };
}
/**
 * Apply one child's scoped composition inside its creation window: a shadowing
 * persona section and a tool restriction, both owned by the child's scope and
 * therefore invisible to its parent and siblings.
 * @param childCtx - the child agent's scoped creation context.
 * @param composition - the persona and tool filter to install.
 */
export function applyChildComposition(childCtx, composition) {
    if (composition.persona !== undefined) {
        childCtx.systemPrompt.section({ name: 'deployment:persona', order: 0, text: composition.persona });
    }
    if (composition.toolFilter !== undefined)
        childCtx.tools.restrict(composition.toolFilter);
}
//# sourceMappingURL=child-agent.js.map