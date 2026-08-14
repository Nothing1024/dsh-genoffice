/**
 * Official-DeepSeek first-run step. Readiness comes from the same
 * provider/settings/credential join as the Models page: any provider the user
 * can already talk to ends the step, and only a user with none is offered the
 * official DeepSeek route. The prompt itself only routes to that page's single
 * credential editor.
 */
import type { ReactNode } from 'react';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-web-react';
import type { ModelsSettingsState, ModelsSettingsStore } from './store.ts';
import type { en } from './locales.ts';
/** Injected dependencies of {@link DeepSeekOnboardingDialog}. */
export interface DeepSeekOnboardingInjected {
    /** Shared Models-page join controller. */
    controller: ModelsSettingsStore;
    /** Subscription hook bound to the shared join snapshot. */
    useSnapshot: SnapshotSelectorHook<ModelsSettingsState>;
    /** Feature copy. */
    t: (key: keyof typeof en) => string;
}
/** Slot owner props plus the feature's injected dependencies. */
export type DeepSeekOnboardingDialogProps = PropsRuntime<'settings.onboarding'> & DeepSeekOnboardingInjected;
/**
 * Prompt a first-run user to open Models while no provider can serve requests
 * and the official adapter exists with an unconfigured effective credential.
 * @param props - settings-shell owner state and Models feature dependencies.
 * @returns the onboarding page or null when onboarding needs no intervention.
 */
export declare function DeepSeekOnboardingDialog(props: DeepSeekOnboardingDialogProps): ReactNode;
//# sourceMappingURL=DeepSeekOnboardingDialog.d.ts.map