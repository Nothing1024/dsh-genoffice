/**
 * Browser theme registry over the `--dsw-*` token stylesheets. The service
 * owns the theme preference (light/dark/system), resolves `system` through
 * `prefers-color-scheme`, and publishes immutable snapshots; it never touches
 * the DOM — ui-layout's presenter consumes the resolved snapshot. The plugin
 * also registers the Appearance preference row into the settings General
 * section — the theme feature owns its own settings surface.
 */
import type { Context } from 'cordis';
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type ThemeKey } from './locales.ts';
export type { AppearanceRowComponentProps, AppearanceRowInjected } from './AppearanceRow.tsx';
export type { AppearanceRowState } from './settings-store.ts';
export type { ThemeKey } from './locales.ts';
/** Namespace owning this feature's settings-row copy. */
export declare const SETTINGS_NS = "settings.theme";
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The Appearance settings row's copy. */
        'settings.theme': ThemeKey;
    }
}
/** Theme token dictionary: --dsw-alias-* overrides keyed by variable name. */
export type ThemeTokens = Record<string, string>;
/** Theme preference: a concrete theme id or follow-the-OS. */
export type ThemePreference = 'light' | 'dark' | 'system';
/** One selectable theme: id, dark/light semantics, and alias-token overrides. */
export interface ThemeDefinition {
    /** Theme id (the setTheme argument for concrete themes). */
    id: string;
    /**
     * Which base palette this theme builds on. The presenter switches
     * `body[data-ds-dark-theme]` from this field — never from the id.
     */
    colorScheme: 'light' | 'dark';
    /** Alias-layer overrides applied as inline CSS variables over the base palette. */
    tokens: ThemeTokens;
}
/** Immutable theme state published on every change. */
export interface ThemeSnapshot {
    /** The persisted preference (may be `system`). */
    preference: ThemePreference;
    /** The resolved active theme (`system` resolved via prefers-color-scheme). */
    active: ThemeDefinition;
    /** Registered themes in registration order. */
    themes: readonly ThemeDefinition[];
    /** Monotonic change counter (registry or active changes). */
    revision: number;
}
declare module 'cordis' {
    interface Context {
        theme: ThemeService;
    }
    interface Events {
        /**
         * Theme state changed (preference switched, registry updated, or the OS
         * color scheme changed while the preference is `system`).
         * @param snapshot - Current immutable theme snapshot.
         * @mode emit
         */
        'theme/change'(snapshot: ThemeSnapshot): void;
    }
}
/** localStorage key holding the persisted theme preference. */
export declare const STORAGE_KEY = "dsh.theme";
/** Default preference when nothing (or garbage) is persisted. */
export declare const DEFAULT_PREFERENCE: ThemePreference;
/**
 * Theme registry and preference owner. `light`/`dark` are built in (the base
 * stylesheets carry both palettes); third-party themes register alias-layer
 * overrides. Reads go through {@link getTheme}; writes only through
 * {@link setTheme}; continuous sync only through the `theme/change` event.
 * The service holds the `prefers-color-scheme` media query (environment
 * sensing, not presentation) and re-emits when the OS scheme flips while the
 * preference is `system`.
 */
export declare class ThemeService {
    private readonly ctx;
    private themes;
    private preference;
    private revision;
    private snapshot;
    private readonly media;
    /**
     * @param ctx - owning context (change events are emitted on it; the
     * media-query listener is released through ctx.effect on dispose).
     */
    constructor(ctx: Context);
    /**
     * Read the current immutable theme snapshot.
     * @returns the current snapshot (stable reference until the next change).
     */
    getTheme(): ThemeSnapshot;
    /**
     * Switch the theme preference — the only preference write entry. Persists
     * the preference and emits `theme/change`.
     * @param id - a registered theme id or `system`; unknown ids throw.
     */
    setTheme(id: string): void;
    /**
     * Register a theme. Duplicate id throws (single occupant per id; the
     * built-in pair counts; `system` is a preference, not a registrable id).
     * @param definition - theme id, colorScheme, and alias-token overrides.
     * @returns disposer. Disposing the theme backing the active preference
     * resets the preference to the default so the UI never keeps tokens of an
     * unregistered theme.
     */
    register(definition: ThemeDefinition): () => void;
    private buildSnapshot;
    private publish;
}
/** Required services: slots + locale (the feature registers its own settings row with localized copy). */
export declare const inject: string[];
/**
 * Client plugin body: provide the theme service and register the
 * feature-owned Appearance preference row into the General section's item
 * slot (a feature owns its settings surface).
 * @param ctx - client cordis context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map