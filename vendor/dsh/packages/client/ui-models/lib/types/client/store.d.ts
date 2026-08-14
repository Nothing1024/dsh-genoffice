/**
 * Models settings page store: one snapshot joining the configurable-provider
 * directory (`llm.providers`), the settings namespaces (`settings.describe`),
 * and the referenced credentials (`credentials.describe`). The host stays the
 * single fact source — every mutation writes through the wire and the page
 * re-renders from the next describe, pushed or refetched.
 */
import type { ConfigurableProviderView, CredentialView, IApiClient, SettingsNamespaceView } from '@deepseek-ai/dsh-client-connection/client';
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
/** One provider row the page renders. */
export interface ProviderRow {
    /** The directory entry (route id, display name, settings address, live state). */
    entry: ConfigurableProviderView;
    /** Whether any layer configures this provider (its profile resolves). */
    configured: boolean;
    /** Whether the user layer alone carries the profile (removal restores the base). */
    removable: boolean;
    /** The credential reference the resolved profile names, when one does. */
    apiKeyEnv: string | undefined;
    /** Credential state for {@link apiKeyEnv}, once described. */
    credential: CredentialView | undefined;
    /** Whether the redacted secret sidecar reports an effective literal `apiKey`. */
    literalApiKeyConfigured: boolean;
}
/** Page snapshot. */
export interface ModelsSettingsState {
    status: 'idle' | 'loading' | 'ready' | 'error';
    /** Whole-load failure text; row-level write failures stay in the editor. */
    error: string | null;
    /** Credential enrichment failure; provider/settings rows remain usable. */
    credentialError: string | null;
    /** Whether the settings provider accepts writes. */
    writable: boolean;
    /** Every configurable provider joined with its configured/credential state. */
    rows: readonly ProviderRow[];
    /** Namespace views by ns, for the editor's schema/layers/secrets. */
    namespaces: ReadonlyMap<string, SettingsNamespaceView>;
}
/**
 * Human text for a rejected wire call. A transport failure rejects with an
 * Error; a host or a runtime can reject with anything, and the page still has
 * to say something.
 * @param error - the rejection value.
 * @returns the message to show.
 */
export declare function messageOf(error: unknown): string;
/**
 * Derive the conventional credential reference for a provider route: the v1
 * page never asks for an environment-variable name, so a typed key stores
 * under this derived reference and the profile records it as `apiKeyEnv`.
 * @param provider - provider route id (e.g. `anthropic`, `minimax-cn`).
 * @returns the derived reference name (e.g. `MINIMAX_CN_API_KEY`).
 */
export declare function deriveKeyRef(provider: string): string;
/**
 * The wire protocols a hand-declared route may name, read out of the owning
 * namespace's own schema. This stays a schema read rather than a wire field so
 * the choices the page offers cannot drift from the ones the adapter accepts:
 * both come from the same `Config`.
 * @param namespace - the namespace view whose schema declares the profile shape.
 * @returns the protocol identifiers, or an empty list when the schema has none.
 */
export declare function protocolChoices(namespace: SettingsNamespaceView | undefined): string[];
/** The models settings page controller (one per settings surface). */
export declare class ModelsSettingsStore {
    private readonly api;
    /** The snapshot the section renders from (uSES-safe store). */
    readonly store: SnapshotStore<ModelsSettingsState>;
    /** Latest load wins; an older response never overwrites a newer one. */
    private generation;
    /**
     * @param api - the wire face (settings/credentials/llm domains).
     */
    constructor(api: Pick<IApiClient, 'settings' | 'credentials' | 'llm'>);
    /**
     * Surface a failure from an operation the page ran outside {@link load} —
     * a row removal — on the same banner a load failure uses.
     * @param message - the failure text to show.
     */
    fail(message: string): void;
    /**
     * Refresh the whole page snapshot: directory and namespaces in parallel,
     * then one batched credential describe over every referenced ref. A
     * failure keeps the last good rows and surfaces the error.
     * @returns nothing; the snapshot carries the outcome.
     */
    load(): Promise<void>;
}
/** DeepSeek onboarding readiness derived only from the shared Models join. */
export type DeepSeekReadiness = {
    kind: 'loading';
} | {
    kind: 'adapter-absent';
} | {
    kind: 'configured';
} | {
    kind: 'credential-missing';
} | {
    kind: 'unavailable';
    reason: 'load-failed' | 'provider-inactive' | 'settings-unavailable' | 'credential-ref-unavailable' | 'credentials-unavailable' | 'settings-read-only' | 'credential-read-only';
};
/**
 * Project official-DeepSeek readiness from the provider/settings/credential
 * join used by the Models page. A missing official configurable-provider
 * declaration means the adapter is not repairable by navigating to Models.
 * @param state - current shared Models join snapshot.
 * @returns the onboarding state without reading a parallel fact source.
 */
export declare function deepSeekReadiness(state: ModelsSettingsState): DeepSeekReadiness;
//# sourceMappingURL=store.d.ts.map