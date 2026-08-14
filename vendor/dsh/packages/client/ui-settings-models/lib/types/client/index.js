import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react';
import { ModelsSection } from "./ModelsSection.js";
import { DeepSeekOnboardingDialog } from "./DeepSeekOnboardingDialog.js";
import { ModelsSettingsStore } from "./store.js";
import { en, zh } from "./locales.js";
/** Dictionary namespace owned by this plugin. */
const NS = 'settings.models';
/**
 * Refetch the page snapshot only after its first load: an unopened Models
 * page must not fetch on background invalidations.
 * @param controller - the page store.
 */
export function refreshIfLoaded(controller) {
    if (controller.store.getSnapshot().status === 'idle')
        return;
    void controller.load();
}
/**
 * Required services (cordis fiber inject). The target slot is declared by
 * ui-settings' apply, whose activation order relative to this one is NOT
 * constrained; registration depends on each slot through `slots.inject()`.
 */
export const inject = ['slots', 'locale', 'connection', 'remote'];
/**
 * Register the Models section once the `settings.section` declaration is on
 * the ledger, wire its store to the connection, and keep it fresh on every
 * pushed invalidation (settings, credentials, or provider topology).
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-models: copy dictionaries');
    const connection = ctx.get('connection');
    const controller = new ModelsSettingsStore(connection.api);
    const useSnapshot = bindSnapshotSelector(controller.store);
    // Registration-time text (the nav label thunk) and the inject faces share
    // one bound translate; copy freshness rides the locale revision.
    const t = ctx.locale.bind(NS);
    const injected = () => ({
        controller,
        useSnapshot,
        api: connection.api,
        t,
    });
    const onboardingInjected = () => ({
        controller,
        useSnapshot,
        t,
    });
    // Pushed invalidations converge every open surface without polling: any
    // settings/credentials/topology change refetches once the page loaded.
    ctx.effect(() => {
        const refresh = () => { refreshIfLoaded(controller); };
        const disposers = [
            ctx.remote.$on('settings/document-updated', refresh),
            ctx.remote.$on('credentials/updated', refresh),
            ctx.remote.$on('llm/adapters-updated', refresh),
            ctx.on('connection/reset', refresh),
        ];
        return () => { for (const dispose of disposers)
            dispose(); };
    }, 'ui-settings-models: pushed invalidations');
    ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'models',
        order: 10,
        label: () => t('nav'),
        inject: injected,
    }, ModelsSection));
    ctx.slots.inject('settings.onboarding', () => ctx.slots.register({
        name: 'settings.onboarding',
        id: 'deepseek-official',
        order: 0,
        inject: onboardingInjected,
    }, DeepSeekOnboardingDialog));
}
//# sourceMappingURL=index.js.map