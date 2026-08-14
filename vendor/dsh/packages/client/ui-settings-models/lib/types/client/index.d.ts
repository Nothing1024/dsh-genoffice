/**
 * Models settings plugin, browser half. Registers the `models` nav entry and
 * official-DeepSeek first-run overlay into shell-declared slots. Both consume
 * one provider/settings/credential join; the overlay routes missing-key users
 * to the full page's single credential editor. Export discipline:
 * packages/client/AGENTS.md.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { ModelsSettingsStore } from './store.ts';
import { type ModelsKey } from './locales.ts';
export type { ModelsSectionInjected, ModelsSectionProps } from './ModelsSection.tsx';
export type { ModelsKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The Models page + onboarding overlay copy. */
        'settings.models': ModelsKey;
    }
}
export type { ModelsSettingsState, ProviderRow } from './store.ts';
/**
 * Refetch the page snapshot only after its first load: an unopened Models
 * page must not fetch on background invalidations.
 * @param controller - the page store.
 */
export declare function refreshIfLoaded(controller: ModelsSettingsStore): void;
/**
 * Required services (cordis fiber inject). The target slot is declared by
 * ui-settings' apply, whose activation order relative to this one is NOT
 * constrained; registration depends on each slot through `slots.inject()`.
 */
export declare const inject: string[];
/**
 * Register the Models section once the `settings.section` declaration is on
 * the ledger, wire its store to the connection, and keep it fresh on every
 * pushed invalidation (settings, credentials, or provider topology).
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map