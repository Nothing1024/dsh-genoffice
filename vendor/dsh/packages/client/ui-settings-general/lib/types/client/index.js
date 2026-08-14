import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react';
import { CloseLabel, HeaderContent, TriggerContent } from "./chrome.js";
import { GeneralSection } from "./GeneralSection.js";
import { SettingsDocumentAction } from "./SettingsDocumentAction.js";
import { refreshDocumentIfLoaded, SettingsDocumentStore } from "./settings-document-store.js";
import { WelcomeNotice } from "./WelcomeNotice.js";
import { refreshWelcomeIfLoaded, WelcomeNoticeStore } from "./welcome-store.js";
import { WELCOME_NOTICE_SETTINGS_NAMESPACE } from "../onboarding-copy.js";
import { en, zh } from "./locales.js";
export { SettingsDocumentStore } from "./settings-document-store.js";
/** Dictionary namespace owned by this plugin (shell chrome + General copy). */
const NS = 'settings';
/**
 * Required services (cordis fiber inject). The target slots are declared by
 * ui-settings' apply, whose activation order relative to this one is NOT
 * constrained; registrations depend on their slots through `slots.inject()`.
 */
export const inject = ['slots', 'locale', 'connection'];
/**
 * Register the `settings` dictionaries, the chrome content, and the General
 * section, each once its slot declaration is on the ledger.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-general: dictionaries');
    // Copy freshness is framework-owned: components read the standard `t`
    // seat, and the nav label is a thunk the owner resolves per render — no
    // locale/change re-registration wiring.
    const t = ctx.locale.bind(NS);
    const connection = ctx.get('connection');
    const documentController = connection.isLoopback
        ? new SettingsDocumentStore(connection.api)
        : undefined;
    const documentInjected = documentController === undefined
        ? undefined
        : (() => {
            const useSnapshot = bindSnapshotSelector(documentController.store);
            return () => ({ controller: documentController, useSnapshot });
        })();
    const welcomeController = new WelcomeNoticeStore(connection.api, connection.isLoopback ? 'host' : 'memory');
    const useWelcomeSnapshot = bindSnapshotSelector(welcomeController.store);
    const welcomeInjected = () => ({
        controller: welcomeController,
        useSnapshot: useWelcomeSnapshot,
    });
    ctx.effect(() => {
        const refresh = (ns) => {
            if (ns !== undefined && ns !== WELCOME_NOTICE_SETTINGS_NAMESPACE)
                return;
            refreshWelcomeIfLoaded(welcomeController);
        };
        const disposers = [
            ctx.on('settings/changed', refresh),
            ctx.on('connection/reset', () => {
                refresh();
                refreshDocumentIfLoaded(documentController);
            }),
        ];
        return () => { for (const dispose of disposers) {
            dispose();
        } };
    }, 'ui-settings-general: metadata invalidations');
    ctx.slots.inject('settings.trigger', () => ctx.slots.register({ name: 'settings.trigger', locale: NS }, TriggerContent));
    ctx.slots.inject('settings.header', () => ctx.slots.register({ name: 'settings.header', locale: NS }, HeaderContent));
    if (documentInjected !== undefined) {
        ctx.slots.inject('settings.action', () => ctx.slots.register({
            name: 'settings.action',
            id: 'open-document',
            order: 0,
            locale: NS,
            inject: documentInjected,
        }, SettingsDocumentAction));
    }
    ctx.slots.inject('settings.close', () => ctx.slots.register({ name: 'settings.close', locale: NS }, CloseLabel));
    ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'general',
        order: 0,
        label: () => { return t('general.nav'); },
        locale: NS,
        children: { 'settings.general.item': { kind: 'list', scope: 'root' } },
    }, GeneralSection));
    ctx.slots.inject('settings.onboarding', () => ctx.slots.register({
        name: 'settings.onboarding',
        id: 'welcome-notice',
        order: -100,
        locale: NS,
        inject: welcomeInjected,
    }, WelcomeNotice));
}
//# sourceMappingURL=index.js.map