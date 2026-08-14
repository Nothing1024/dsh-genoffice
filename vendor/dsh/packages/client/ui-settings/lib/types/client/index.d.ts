/**
 * Settings shell plugin, browser half. A pure composition face: occupies the
 * sidebar-owned `sidebar.settings` hole with the trigger chrome + modal
 * panel, declares its chrome, section, and onboarding slots, and projects the
 * section ledger into panel navigation. The shell ships no copy; it reads the
 * optional locale revision only to resolve registrant-owned nav-label thunks.
 * ui-settings-general owns the chrome and General content; features own their
 * rows, sections, and onboarding pages. Export discipline: packages/client/AGENTS.md.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export type { SettingsHeaderOwnerProps, SettingsRootComponentProps, SettingsRootInjected, SettingsOnboardingOwnerProps, SettingsOnboardingStep, SettingsSectionOwnerProps, SettingsSectionRow, SettingsTriggerOwnerProps, } from './contract/slots.ts';
/**
 * Required services (cordis fiber inject). The target slot is declared by
 * ui-sidebar's apply, whose activation order relative to this one is NOT
 * constrained (dshClient.inject edges are informational); registration
 * depends on the slot through `slots.inject()`.
 */
export declare const inject: string[];
/**
 * Register the settings shell into `sidebar.settings` once the declaration is
 * on the ledger.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map