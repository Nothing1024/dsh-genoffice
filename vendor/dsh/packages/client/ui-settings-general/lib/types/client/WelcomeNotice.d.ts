/** Product-wide, versioned first-run welcome step. */
import type { ReactNode } from 'react';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-web-react';
import type { WelcomeNoticeState, WelcomeNoticeStore } from './welcome-store.ts';
/** Registrant-owned dependencies of {@link WelcomeNotice}. */
export interface WelcomeNoticeInjected {
    controller: WelcomeNoticeStore;
    useSnapshot: SnapshotSelectorHook<WelcomeNoticeState>;
}
/** Coordinator owner props plus the welcome step's injected face. */
export type WelcomeNoticeProps = PropsRuntime<'settings.onboarding'> & PropsLocale<'settings'> & WelcomeNoticeInjected;
/** Render the mandatory notice until its current version is acknowledged. */
export declare function WelcomeNotice(props: WelcomeNoticeProps): ReactNode;
//# sourceMappingURL=WelcomeNotice.d.ts.map