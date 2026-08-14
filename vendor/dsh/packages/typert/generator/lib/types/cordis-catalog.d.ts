/**
 * Cordis catalog-specific projection over the compiler-independent Typert
 * model. This module owns Cordis validation and text projection mechanics;
 * callers supply repository-specific type classifications and inherited data.
 * @module @deepseek-ai/dsh-typert-generator
 */
import type { FaceModel, SourceDeclarationModel } from './model.ts';
type Mode = 'emit' | 'waterfall' | 'parallel' | 'serial';
/** One harness event, extracted from an `interface Events` block. */
export interface EventEntry {
    /** Scoped name, e.g. `agent/request`. */
    name: string;
    /** The scope prefix, e.g. `agent` (everything before the first `/`). */
    scope: string;
    /** Full signature text (the method-signature member, JSDoc stripped). */
    signature: string;
    /** Original declaration JSDoc, dedented from its containing interface. */
    jsDoc: string;
    /** Dispatch mode from the `@mode` tag. */
    mode: Mode;
    /** Description prose (JSDoc minus the `@mode` tag), one line per paragraph. */
    doc: string;
    /** Source pointer `packages/…/file.ts:line` of the declaration. */
    source: string;
}
/** One public service method and the source contract attached to it. */
export interface ServiceMethodEntry {
    /** Public method signature (body stripped). */
    signature: string;
    /** Original method JSDoc, dedented from its containing class. */
    jsDoc: string;
}
/** One harness service, extracted from an `interface Context` block. */
export interface ServiceEntry {
    /** The `ctx.<key>` name, e.g. `llm`. */
    key: string;
    /** The service class/interface name, e.g. `LlmService`. */
    type: string;
    /** Whether the service class is abstract (a seam interface). */
    abstract: boolean;
    /** Class-level JSDoc prose, one line per paragraph. */
    doc: string;
    /** Public methods (bodies stripped), in source order. */
    methods: ServiceMethodEntry[];
    /** Source pointer of the class declaration. */
    source: string;
}
/** A terse inherited-tier entry supplied by the catalog policy. */
export interface InheritedEntry {
    /** Display name of the inherited event or context member group. */
    name: string;
    /** One-line description rendered into the catalog. */
    summary: string;
    /** Source pointer such as `vendor/…:line`. */
    source: string;
}
/** Repository policy consumed by the Cordis catalog parsing and rendering logic. */
export interface CordisCatalogPolicy {
    /** Type names linked from signatures to their documentation pages. */
    readonly linkedTypePages: Readonly<Record<string, string>>;
    /** TypeScript or framework types that need no repository documentation link. */
    readonly foundationTypeNames: ReadonlySet<string>;
    /** Repository types deliberately documented outside the linked data catalog. */
    readonly typeLinkExemptions: Readonly<Record<string, string>>;
    /** Manually curated framework events inherited by every plugin. */
    readonly inheritedEvents: readonly InheritedEntry[];
    /** Manually curated framework context members inherited by every plugin. */
    readonly inheritedServices: readonly InheritedEntry[];
}
/** Complete model-level Cordis projection used by every text renderer. */
export interface CordisCatalogModel {
    readonly events: readonly EventEntry[];
    readonly services: readonly ServiceEntry[];
}
/** Repository-specific Cordis validation and projection over one Typert face. */
export declare class CordisCatalogProjector {
    private readonly face;
    private readonly sourceDeclarations;
    private readonly policy;
    private readonly renderer;
    /**
     * @param face - analyzed host face containing package business semantics.
     * @param sourceDeclarations - exported declarations available to the runtime type closure.
     * @param policy - caller-owned type classifications and inherited Cordis data.
     */
    constructor(face: FaceModel, sourceDeclarations: readonly SourceDeclarationModel[], policy: CordisCatalogPolicy);
    /**
     * Validate and project the host model's Cordis surface.
     * @returns every validated service and event projected from the host model.
     */
    project(): CordisCatalogModel;
    /**
     * Render the model-facing static API consumed by `tool-cordis`.
     * @param model - validated Cordis catalog projection from this projector.
     * @returns the model-facing TypeScript catalog source.
     */
    renderRuntimeApi(model: CordisCatalogModel): string;
    private collectEvents;
    private collectServices;
    private runtimeTypes;
}
/**
 * Analyze the host project once and return both the model and its projection.
 * @param scanRoot - workspace root containing `tsconfig.host.json`.
 * @param policy - caller-owned type classifications and inherited Cordis data.
 * @returns the configured projector and its validated catalog model.
 */
export declare function projectCordisCatalog(scanRoot: string, policy: CordisCatalogPolicy): {
    readonly projector: CordisCatalogProjector;
    readonly model: CordisCatalogModel;
};
/**
 * Collect all modeled events for relationship-document consumers.
 * @param scanRoot - workspace root containing `tsconfig.host.json`.
 * @param policy - caller-owned Cordis catalog policy.
 * @returns all validated event entries.
 */
export declare function collectEvents(scanRoot: string, policy: CordisCatalogPolicy): EventEntry[];
/**
 * Collect all modeled services for relationship-document consumers.
 * @param scanRoot - workspace root containing `tsconfig.host.json`.
 * @param policy - caller-owned Cordis catalog policy.
 * @returns all validated service entries.
 */
export declare function collectServices(scanRoot: string, policy: CordisCatalogPolicy): ServiceEntry[];
/**
 * Render the events catalog deterministically.
 * @param events - validated event entries to render.
 * @param policy - type links and inherited events supplied by the caller.
 * @returns the complete generated Markdown document.
 */
export declare function renderEvents(events: EventEntry[], policy: CordisCatalogPolicy): string;
/**
 * Render the services catalog deterministically.
 * @param services - validated service entries to render.
 * @param policy - type links and inherited services supplied by the caller.
 * @returns the complete generated Markdown document.
 */
export declare function renderServices(services: ServiceEntry[], policy: CordisCatalogPolicy): string;
export {};
//# sourceMappingURL=cordis-catalog.d.ts.map