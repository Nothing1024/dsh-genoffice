/**
 * Models settings section: the provider rows joined from the configurable
 * directory, settings namespaces, and credential states, with one editor
 * card at a time. A whole-section provider without a configured key (the
 * unconfigured DeepSeek posture) renders as its open setup card instead of a
 * row; the add flow is a card carrying the dormant-provider select. Every
 * mutation writes through the wire, while a provider removal first requires
 * confirmation; the page re-renders from pushed invalidations or the
 * post-apply reload.
 */
import type { ReactNode } from 'react';
import type { IApiClient } from '@deepseek-ai/dsh-client-connection/client';
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-web-react';
import type { ModelsSettingsState, ModelsSettingsStore, ProviderRow } from './store.ts';
import type { en } from './locales.ts';
/** Injected dependencies of {@link ModelsSection} (slot `inject`). */
export interface ModelsSectionInjected {
    /** The page store (loaded on mount, refreshed on pushed invalidations). */
    controller: ModelsSettingsStore;
    /** uSES subscription hook bound to the store. */
    useSnapshot: SnapshotSelectorHook<ModelsSettingsState>;
    /** Wire faces the editor writes through. */
    api: Pick<IApiClient, 'settings' | 'credentials' | 'llm'>;
    /** Section copy. */
    t: (key: keyof typeof en) => string;
}
/**
 * Props delivered by the slot outlet: the inject face spread flat (the
 * renderer erases the share boundary at the render call).
 */
export type ModelsSectionProps = Partial<ModelsSectionInjected>;
/**
 * Remove one user-added provider profile by unsetting its path in the stored
 * user section, then reload. The removal names the profile rather than
 * rebuilding the section: this page only ever holds the redacted descriptor,
 * so a rebuilt section would drop every literal secret stored elsewhere in
 * the namespace along with the profile being removed.
 * @param api - settings wire face.
 * @param controller - the page store to refresh.
 * @param target - the provider's settings address.
 * @returns the failure message, or undefined once the write and reload landed.
 */
export declare function removeProviderProfile(api: Pick<IApiClient, 'settings'>, controller: ModelsSettingsStore, target: {
    settingsNs: string;
    settingsPath: readonly string[];
}): Promise<string | undefined>;
/**
 * Whether a whole-section provider still needs its first key: nothing marks
 * the credential configured and no literal `apiKey` is stored, so the page
 * opens the setup card instead of showing a row.
 * @param row - the joined provider row.
 * @returns whether to render the setup card.
 */
export declare function needsSetup(row: ProviderRow): boolean;
/**
 * Render the Models section content column.
 * @param props - slot-delivered injected dependencies.
 * @returns the section, or null while the shell has not injected yet.
 */
export declare function ModelsSection(props: ModelsSectionProps): ReactNode;
//# sourceMappingURL=ModelsSection.d.ts.map