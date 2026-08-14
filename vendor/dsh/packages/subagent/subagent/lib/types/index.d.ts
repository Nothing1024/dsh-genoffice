/**
 * The subagent seam (`ctx.subagents`): a named-provider registry plus a
 * capability-validating asynchronous start surface. Providers establish a
 * child before returning its run, so fulfillment is the single publication and
 * ownership-transfer boundary.
 *
 * Unlike the bash seam (one executor per context, second load throws), MULTIPLE
 * providers coexist here: each registers under a unique name and a caller picks
 * one by name. The shape mirrors the LLM adapter registry
 * (`LlmService.registerAdapter`), not the single-service bash executor.
 *
 * This package is the INTERFACE third of the capability seam. Implementations
 * (`@deepseek-ai/dsh-subagent-spawn`, `-fork`, `-acp`) and the model-facing
 * consumer (`@deepseek-ai/dsh-tool-subagent`) are separate packages.
 *
 * Public operations express caller intent: `start` returns one published owned
 * one-shot run, `startContinuable` establishes a durable continuable child, and
 * `followup` delivers later content without exposing whether the child is
 * resident. Continuable children never become a {@link SubagentRun}: the
 * continuation manager holds their `AgentHandle` directly and orders every turn
 * through the child's own inbox, so providers contribute only the detached
 * creation spec and see no handle, turn, or teardown. Direct-child discovery
 * independently interprets the optional session-query corpus and does not
 * require that continuation runtime.
 *
 * Same-process providers are trusted typed collaborators. Requests, provider
 * descriptors, results, and lifecycle payloads are borrowed immutable values;
 * serialization and hostile-input validation belong at real process, worker,
 * persistence, and model boundaries.
 *
 * @module @deepseek-ai/dsh-subagent
 */
import { Context, Service } from 'cordis';
import type { Scoped } from '@deepseek-ai/dsh-scope';
import type { ContentBlock, MessageId } from '@deepseek-ai/dsh-llm';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { SubagentProvider, SubagentRun, SubagentRunEndInfo, SubagentRunInfo, SubagentStartRequest } from './types.ts';
import type { ContinuableStart, ContinuableStartSpec, SubagentFollowupOptions, SubagentReportOptions } from './continuation.ts';
import type { ContinuableSetupContribution } from './activation-setup-registry.ts';
import type { SubagentListEntry } from './list-children.ts';
export * from './out-of-process.ts';
export { SubagentRunId } from './types.ts';
export type { ContinuableCreateRequest, ContinuableCreateSpec, ResolvedSubagentStartRequest, SubagentCapabilities, SubagentProvider, SubagentResult, SubagentRun, SubagentStartRequest, SubagentStopReason, SubagentStopReasonMap, } from './types.ts';
export { foldSubagentDescriptor, snapshotSubagentDescriptor, SUBAGENT_DESCRIPTOR_VERSION, } from './descriptor.ts';
export type { ContinuableSubagentDescriptorData, ContinuableSubagentDescriptorInput, OneShotSubagentDescriptorData, OneShotSubagentDescriptorInput, SubagentDescriptorData, SubagentDescriptorInput, } from './descriptor.ts';
export { seedDescriptorTurn } from './descriptor-seed.ts';
export { SubagentError } from './error.ts';
export { settleRun } from './run-settlement.ts';
export { assertSubagentMaxDepth, delegationDepthOf } from './depth.ts';
export { applyChildComposition, childSessionMeta, resolveChildAgentOptions, resolveChildDepth, SubagentDepthError, } from './child-agent.ts';
export type { ChildComposition } from './child-agent.ts';
export type { ContinuableStart, ContinuableStartSpec, CoordinatorMessageSource, SubagentFollowupOptions, SubagentReportDelivery, SubagentReportMessageSource, SubagentReportOptions, } from './continuation.ts';
export type { ContinuableSetupContribution } from './activation-setup-registry.ts';
export type { SubagentListEntry } from './list-children.ts';
export type { SubagentRunEndInfo, SubagentRunInfo } from './types.ts';
export type { SubagentTimingProjection } from './projection-types.ts';
declare module 'cordis' {
    interface Context {
        subagents: SubagentService;
    }
    interface Events {
        /**
         * A provider became resolvable in the registry.
         * @param provider - the registered provider.
         * @mode emit
         */
        'subagent/provider-added'(provider: SubagentProvider): void;
        /**
         * A provider left the registry. Accepted runs remain holder-owned.
         * @param name - the provider name that no longer resolves.
         * @mode emit
         */
        'subagent/provider-removed'(name: string): void;
        /**
         * A provider established a published child. For in-process providers,
         * `ctx.agents.get(info.id)` resolves during this notification.
         * Scope-filtered dispatch keys the carrier by the delegating parent, so a
         * parent-scoped listener observes only its own delegations. Paired with
         * `subagent/end`.
         * @param info - the provider and published child identity.
         * @dshScopeScan unsupported
         * @mode emit
         */
        'subagent/start'(this: Scoped<SubagentService>, info: SubagentRunInfo): void;
        /**
         * A published child settled. Scope-filtered dispatch uses the same delegating
         * parent carrier as `subagent/start`, so the lifecycle pair reaches the
         * same scoped audience.
         * @param info - the run identity and terminal outcome.
         * @dshScopeScan unsupported
         * @mode emit
         */
        'subagent/end'(this: Scoped<SubagentService>, info: SubagentRunEndInfo): void;
    }
}
/** Named provider registry with one-shot runs, durable discovery, and continuable-child operations. */
export declare class SubagentService extends Service {
    private providers;
    private continuations;
    /** Deployment contributions composed into unpublished continuable children. */
    private readonly setupRegistry;
    /**
     * The contained lifecycle-edge publisher. Built here because scoped dispatch
     * keys its carrier by this exact service instance, whose own context filter
     * composes into the carrier.
     */
    private readonly emitLifecycle;
    constructor(ctx: Context);
    /**
     * Establish one durable continuable child and deliver its initial prompt.
     * Resolves when the child's inbox accepts that prompt, without waiting for the
     * turn to start or for the message to reach the Session log; any earlier
     * failure rejects with no ids and rolls back the child entirely.
     * @param spec - provider, delegation request, and caller cancellation.
     * @returns the durable child id and the accepted prompt's message id.
     * @throws when continuation services are unavailable or materialization fails.
     */
    startContinuable(spec: ContinuableStartSpec): Promise<ContinuableStart>;
    /**
     * Deliver one later message to a continuable child as its next FIFO turn. A
     * resident child's Agent inbox accepts it directly (waking a `waiting`
     * Activation), while an absent one is cold-resumed from its persisted
     * Session. The Agent inbox is the only queue, so every accepted message has
     * one observable order.
     * @param parent - the exact live direct parent authorizing this delivery.
     * @param childId - durable child session id.
     * @param content - user-role content to deliver.
     * @param options - durable provenance and caller cancellation, which stops the
     *   operation only before inbox acceptance.
     * @returns the accepted message's inbox id.
     * @throws when continuation services are unavailable, parent authority is
     *   rejected, or the message was not admitted.
     */
    followup(parent: Agent, childId: SessionId, content: ContentBlock[], options: SubagentFollowupOptions): Promise<MessageId>;
    /**
     * Deliver selected content from one live continuable child to its durable
     * direct parent. The child is the authority credential; callers cannot name a
     * recipient. Reporting does not conclude the child's turn or Activation.
     * @param child - exact live reporting child.
     * @param content - selected model-facing content.
     * @param options - parent scheduling and pre-acceptance cancellation.
     * @returns the stable identity of the parent-accepted message.
     * @throws when continuation services are unavailable, sender authorization
     *   fails, or the direct parent is not live.
     */
    reportFrom(child: Agent, content: ContentBlock[], options: SubagentReportOptions): Promise<MessageId>;
    /**
     * Compose one deployment capability into every continuable child's
     * unpublished creation context on fresh creation and cold resume. Grants wait
     * for the next Activation; removing the contribution revokes every resident
     * installation immediately.
     * @param contribution - synchronous child-scope installer.
     * @returns the exact Cordis effect disposer.
     */
    registerContinuableSetup(contribution: ContinuableSetupContribution): () => void;
    /**
     * Close continuable admission below exact live parent Agents, stop only their
     * visible descendant Activations synchronously, then await admitted scoped
     * materializations and release those forests child-first. The scoped cutoff
     * lasts until each exact parent leaves the registry; unrelated parent trees
     * remain live.
     * @param parents - exact host-owned parent Agents entering teardown.
     * @returns once every retained descendant Activation released its `AgentHandle`.
     * @throws an aggregate error after all branches settle when any failed.
     */
    drainContinuableDescendants(parents: readonly Agent[]): Promise<void>;
    /**
     * Enumerate the parent's direct session-backed subagents from the
     * live-preferred session corpus without loading or resuming an Agent. Session
     * query supplies lineage, candidate order, event reads, and live state; this
     * service interprets descriptor mode, activity, and per-child diagnostics
     * without consulting Agent registrations, Activations, or providers.
     *
     * The trace and exact descriptor read receive `signal`; the full event-list
     * read has no signal parameter, so the scan rechecks cancellation around
     * every await and between candidates. Query rejections that settle after an
     * abort become a stable `SubagentError` with code `CANCELLED`.
     * @param parentSessionId - parent session whose direct children are listed.
     * @param signal - caller-owned cancellation forwarded where supported and
     *   observed around every query await.
     * @returns children and per-child diagnostics in stable trace order.
     * @throws {@link SubagentError} when session query is unavailable or the
     *   caller cancels the scan.
     */
    listChildren(parentSessionId: SessionId, signal?: AbortSignal): Promise<SubagentListEntry[]>;
    /**
     * Register a provider under its name. Registration is effect-scoped and HMR
     * safe; removing a provider blocks new starts but does not revoke runs that
     * were already returned to their holders.
     * @param provider - the trusted provider implementation.
     * @returns the exact Cordis effect disposer.
     */
    registerProvider(provider: SubagentProvider): () => void;
    /**
     * Look up a provider by name.
     * @param name - the provider name.
     * @returns the provider, or undefined when absent.
     */
    getProvider(name: string): SubagentProvider | undefined;
    /**
     * List registered provider names in insertion order.
     * @returns the registered names.
     */
    list(): string[];
    /**
     * Establish a published child on the named provider. Capability and semantic
     * checks run before delegation. Provider ownership lasts until its promise
     * fulfills; a rejection therefore has no run for the caller to dispose and
     * emits no run lifecycle events. Post-publication turn and infrastructure
     * failures settle through the returned run.
     * @param name - the provider to use.
     * @param request - child label, prompt, parent, signal, and optional capabilities.
     * @returns the published holder-owned run.
     */
    start(name: string, request: SubagentStartRequest): Promise<SubagentRun>;
    /**
     * Resolve one provider's detached continuable-creation contribution. Method
     * presence on the provider IS the capability, so a provider without it is
     * rejected before the manager reserves any child resources.
     */
    private prepareContinuable;
    /** Look up a provider for dispatch or fail loud. */
    private expectProvider;
    /** Resolve the optional continuable-subagent manager or fail loud. */
    private requireContinuations;
    /**
     * Build the lifecycle observer for one continuable Activation's residency
     * epoch, so the manager publishes its edges without owning event dispatch.
     */
    private observeActivation;
    /** Reject the first requested capability that the provider lacks. */
    private assertCapabilities;
}
export default SubagentService;
//# sourceMappingURL=index.d.ts.map