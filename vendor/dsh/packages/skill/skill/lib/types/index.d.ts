/**
 * Agent skill provider registry.
 *
 * This package is the interface third of the skill capability seam. Concrete
 * providers such as `@deepseek-ai/dsh-skill-local` decide where skills come
 * from; this service only merges provider catalogs, resolves the winning skill
 * for a name, and exposes the winning summaries and definitions to consumers.
 *
 * @module @deepseek-ai/dsh-skill
 */
import { Context, Service } from 'cordis';
import type Schema from 'schemastery';
/**
 * Return whether a string is a valid kebab-case skill name.
 * @param name - candidate skill name to validate.
 * @returns whether the name matches the public skill-name grammar.
 */
export declare function isSkillName(name: string): boolean;
/** Origin bucket for a skill contribution. The value is prompt-visible metadata, not precedence by itself. */
export type SkillSource = 'project-dsh' | 'project-agents' | 'runtime' | 'user-dsh' | 'user-agents' | 'custom' | 'bundled' | (string & {});
/** Optional provider-specific base used by loaded skill bodies to resolve relative resources. */
export type SkillResourceBase = {
    readonly kind: 'directory';
    readonly path: string;
} | {
    readonly kind: 'url';
    readonly url: string;
} | {
    readonly kind: 'opaque';
    readonly description: string;
};
/** Invocation controls shared by skill discovery consumers. */
export interface SkillInvocationPolicy {
    /** Whether model-facing catalogs and loaders include this skill. */
    readonly modelInvocable: boolean;
    /** Whether human-facing command catalogs and loaders include this skill. */
    readonly userInvocable: boolean;
}
/** Invocation-neutral skill metadata returned by `ctx.skills.list()`. */
export interface SkillSummary {
    /** Kebab-case identifier used to address the skill. */
    readonly name: string;
    /** Short routing description shown by discovery consumers. */
    readonly description: string;
    /** Optional extra routing guidance. */
    readonly whenToUse?: string;
    /** Resolved model and user invocation controls. */
    readonly invocation: SkillInvocationPolicy;
    /** Discovery source that produced this winning skill. */
    readonly source: SkillSource;
    /** Provider that owns this skill body. */
    readonly provider: string;
    /** Provider-specific base for relative resources. */
    readonly resourceBase?: SkillResourceBase;
}
/** Provider catalog entry used by the registry to merge and later load skills. */
export interface SkillCandidate extends SkillSummary {
    /** Lower ranks win duplicate skill names before provider registration order is considered. */
    readonly rank: number;
    /** Opaque provider-owned handle passed back to `provider.get()`. */
    readonly locator: unknown;
    /** Absolute file path when the provider has one. */
    readonly path?: string;
    /** Parsed optional metadata object from provider-specific skill frontmatter. */
    readonly metadata?: Readonly<Record<string, unknown>>;
}
/** Complete parsed skill definition, including the body loaded by `ctx.skills.get()`. */
export interface SkillDefinition extends SkillSummary {
    /** Markdown instruction body after any provider-specific metadata removal. */
    readonly content: string;
    /** Absolute file path when the skill came from disk. */
    readonly path?: string;
    /** Parsed optional metadata object from frontmatter. */
    readonly metadata?: Readonly<Record<string, unknown>>;
}
/** Runtime skill contribution accepted by `ctx.skills.register()`. */
export type SkillRegistration = Omit<SkillDefinition, 'invocation' | 'provider'> & {
    /** Invocation controls; omission permits both model and user surfaces. */
    readonly invocation?: SkillInvocationPolicy;
    /** Provider label; omission uses the registry-owned runtime provider. */
    readonly provider?: string;
};
/** Caller context used for cwd-sensitive and abortable provider work. */
export interface SkillLookupOptions {
    /** Workspace selector for the current lookup. */
    readonly cwd?: string | undefined;
    /** Abort discovery or loading work for the current caller. */
    readonly signal?: AbortSignal | undefined;
}
/**
 * Return whether a skill may be advertised to and loaded by a model.
 * @param skill - skill metadata carrying resolved invocation controls.
 * @returns whether the policy permits model invocation.
 */
export declare function isModelInvocable(skill: Pick<SkillSummary, 'invocation'>): boolean;
/**
 * Return whether a skill may be advertised to and loaded by a human-facing command.
 * @param skill - skill metadata carrying resolved invocation controls.
 * @returns whether the policy permits user invocation.
 */
export declare function isUserInvocable(skill: Pick<SkillSummary, 'invocation'>): boolean;
/** One catalog observation plus whether discovery completed within a stable catalog revision. */
export interface SkillCatalogSnapshot {
    /** Sorted invocation-neutral summaries collected in this observation. */
    readonly skills: SkillSummary[];
    /** Whether every registered provider completed without a concurrent catalog revision. */
    readonly complete: boolean;
}
/** Provider candidates plus whether the current discovery is authoritative. */
export interface SkillProviderObservation {
    /** Candidates available from the current provider discovery. */
    readonly candidates: readonly SkillCandidate[];
    /** Whether discovery completed and these candidates may be cached. */
    readonly complete: boolean;
}
/** Provider interface for one source of skills, such as local directories or a remote registry. */
export interface SkillProvider {
    /** Unique provider name in the `ctx.skills` registry. */
    readonly name: string;
    /**
     * List available skill candidates for the current lookup context. Provider
     * plugins register synchronously during `apply()`; remote initialization,
     * authentication, and discovery are awaited inside this method. Implementations
     * should settle promptly when `options.signal` aborts.
     * @param options - lookup options; `cwd` selects workspace-sensitive skills and `signal` cancels work.
     * @returns provider candidates as a complete-array shorthand, or an explicit
     *   observation when usable candidates came from incomplete discovery.
     */
    readonly list: (options: SkillLookupOptions) => Promise<readonly SkillCandidate[] | SkillProviderObservation>;
    /**
     * Load a complete skill body for a previously listed candidate.
     * @param candidate - the winning candidate originally returned by this provider.
     * @param options - lookup options; `cwd` selects workspace-sensitive skills and `signal` cancels work.
     * @returns the full skill body, or `undefined` if it is no longer loadable.
     */
    readonly get: (candidate: SkillCandidate, options: SkillLookupOptions) => Promise<SkillDefinition | undefined>;
}
/** Registration-scoped lifecycle and invalidation capability borrowed by one provider. */
export interface SkillProviderControl {
    /** Aborts if registration fails or when the exact provider registration is disposed. */
    readonly signal: AbortSignal;
    /** Invalidate completed catalogs and notify consumers only while the exact registration remains active. */
    readonly invalidate: () => void;
}
/** Skill registry configuration. */
export interface Config {
    /** Maximum number of completed cwd/provider catalogs kept in memory. */
    readonly collectCacheMaxEntries?: number;
}
declare module 'cordis' {
    interface Context {
        skills: SkillService;
    }
    interface Events {
        /**
         * A skill provider, runtime contribution, or provider-backed catalog may
         * have changed. This is an unfiltered invalidation notification; consumers
         * refetch the catalog for their own lookup options. Listener failures are
         * contained and cannot veto the registry mutation.
         * @mode emit
         */
        'skills/change'(): void;
    }
}
/**
 * Registry of skill providers. It merges provider catalogs with stable
 * first-wins duplicate handling, exposes sorted invocation-neutral summaries, and
 * loads full skill bodies on demand.
 */
export declare class SkillService extends Service {
    static Config: Schema<Config>;
    private readonly collectCacheMaxEntries;
    private readonly providers;
    private readonly runtime;
    private readonly collectCache;
    private providerRevision;
    private nextProviderOrder;
    private runtimeRevision;
    constructor(ctx: Context, config?: Config);
    /**
     * Register a borrowed same-process provider synchronously during plugin apply. Duplicate and
     * reserved names throw; remote initialization belongs in `list()`. Fiber disposal unregisters
     * the provider and invalidates catalog caches.
     * @param create - synchronous factory receiving this registration's lifecycle and invalidation control.
     * @returns the exact Cordis effect disposer that unregisters this provider;
     *   composite effects may yield it directly to preserve teardown ordering.
     */
    registerProvider(create: (control: SkillProviderControl) => SkillProvider): () => void;
    /**
     * Register a borrowed readonly runtime skill. Project entries outrank runtime entries, which
     * outrank user entries. Same-name runtime entries are first-wins; a duplicate logs a warning and
     * receives a no-op disposer so it cannot remove the winner.
     * @param skill - the skill definition input; omitted invocation and provider fields receive defaults.
     * @returns the exact Cordis effect disposer, preserving composite teardown order and invalidating caches.
     */
    register(skill: SkillRegistration): () => void;
    /**
     * List invocation-neutral skill summaries for a workspace. Consumers apply
     * model or user invocation policy at their operational boundary. Lookup
     * options and provider candidates are readonly same-process values borrowed
     * throughout discovery.
     * @param options - lookup options; `cwd` selects project roots and `signal` cancels discovery.
     * @returns all sorted winning summaries.
     */
    list(options?: SkillLookupOptions): Promise<SkillSummary[]>;
    /**
     * Observe the current invocation-neutral catalog and whether discovery completed within a stable revision.
     * Incomplete observations are never cached, allowing consumers to retain last-good state and
     * retry on their next request boundary.
     * @param options - lookup options; `cwd` selects project roots and `signal` cancels discovery.
     * @returns sorted summaries plus discovery-completeness state.
     */
    snapshot(options?: SkillLookupOptions): Promise<SkillCatalogSnapshot>;
    /**
     * Load and validate the winning candidate, passing its opaque discovery locator back to the
     * provider. Cancellation is rechecked after selection, including cache hits, and raced against
     * loading so an uncooperative provider cannot hang the caller.
     * @param name - kebab-case skill name.
     * @param options - lookup options; `cwd` selects workspace-sensitive skills and `signal` cancels work.
     * @returns the full skill, including body content, or `undefined`.
     */
    get(name: string, options?: SkillLookupOptions): Promise<SkillDefinition | undefined>;
    private collect;
    private collectFresh;
    private listAllCandidates;
    private invalidateCache;
    private invalidateProvider;
    /** Notify catalog observers without making their refresh work load-bearing. */
    private notifyChange;
}
export default SkillService;
//# sourceMappingURL=index.d.ts.map