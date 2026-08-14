import { AppearanceRow } from "./AppearanceRow.js";
import { createAppearanceRowStore } from "./settings-store.js";
import { en, zh } from "./locales.js";
/** Namespace owning this feature's settings-row copy. */
export const SETTINGS_NS = 'settings.theme';
/** localStorage key holding the persisted theme preference. */
export const STORAGE_KEY = 'dsh.theme';
/** Default preference when nothing (or garbage) is persisted. */
export const DEFAULT_PREFERENCE = 'system';
const BUILTIN_THEMES = Object.freeze([
    Object.freeze({ id: 'light', colorScheme: 'light', tokens: Object.freeze({}) }),
    Object.freeze({ id: 'dark', colorScheme: 'dark', tokens: Object.freeze({}) }),
]);
/**
 * Theme registry and preference owner. `light`/`dark` are built in (the base
 * stylesheets carry both palettes); third-party themes register alias-layer
 * overrides. Reads go through {@link getTheme}; writes only through
 * {@link setTheme}; continuous sync only through the `theme/change` event.
 * The service holds the `prefers-color-scheme` media query (environment
 * sensing, not presentation) and re-emits when the OS scheme flips while the
 * preference is `system`.
 */
export class ThemeService {
    ctx;
    themes = [...BUILTIN_THEMES];
    preference;
    revision = 0;
    snapshot;
    media;
    /**
     * @param ctx - owning context (change events are emitted on it; the
     * media-query listener is released through ctx.effect on dispose).
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.preference = restorePreference();
        // Non-browser runs (node e2e booting the client tree) have no matchMedia.
        this.media = typeof matchMedia === 'undefined' ? undefined : matchMedia('(prefers-color-scheme: dark)');
        this.snapshot = this.buildSnapshot();
        if (this.media !== undefined) {
            const media = this.media;
            const onChange = () => {
                if (this.preference !== 'system') {
                    return;
                }
                this.publish();
            };
            ctx.effect(() => {
                media.addEventListener('change', onChange);
                return () => { media.removeEventListener('change', onChange); };
            }, 'ui-theme: prefers-color-scheme listener');
        }
    }
    /**
     * Read the current immutable theme snapshot.
     * @returns the current snapshot (stable reference until the next change).
     */
    getTheme() {
        return this.snapshot;
    }
    /**
     * Switch the theme preference — the only preference write entry. Persists
     * the preference and emits `theme/change`.
     * @param id - a registered theme id or `system`; unknown ids throw.
     */
    setTheme(id) {
        if (id !== 'system' && !this.themes.some(t => t.id === id)) {
            throw new Error(`theme "${id}" is not registered`);
        }
        if (this.preference === id)
            return;
        this.preference = id;
        persistPreference(this.preference);
        this.publish();
    }
    /**
     * Register a theme. Duplicate id throws (single occupant per id; the
     * built-in pair counts; `system` is a preference, not a registrable id).
     * @param definition - theme id, colorScheme, and alias-token overrides.
     * @returns disposer. Disposing the theme backing the active preference
     * resets the preference to the default so the UI never keeps tokens of an
     * unregistered theme.
     */
    register(definition) {
        if (definition.id === 'system')
            throw new Error('"system" is a preference, not a registrable theme id');
        if (this.themes.some(t => t.id === definition.id)) {
            throw new Error(`theme "${definition.id}" is already registered`);
        }
        this.themes = [...this.themes, definition];
        this.publish();
        return () => {
            if (!this.themes.some(t => t.id === definition.id))
                return;
            this.themes = this.themes.filter(t => t.id !== definition.id);
            if (this.preference === definition.id) {
                this.preference = DEFAULT_PREFERENCE;
                persistPreference(this.preference);
            }
            this.publish();
        };
    }
    buildSnapshot() {
        const resolvedId = this.preference === 'system'
            ? (this.media?.matches === true ? 'dark' : 'light')
            : this.preference;
        // Both built-ins always exist; a registered preference id resolves or has
        // been reset by its disposer, so the lookup cannot miss.
        const active = this.themes.find(t => t.id === resolvedId);
        /* v8 ignore next 2 -- needs a registry without light/dark, which register()/dispose() cannot produce */
        if (active === undefined)
            throw new Error(`theme registry lost "${resolvedId}"`);
        return Object.freeze({
            preference: this.preference,
            active,
            themes: Object.freeze([...this.themes]),
            revision: this.revision,
        });
    }
    publish() {
        this.revision += 1;
        this.snapshot = this.buildSnapshot();
        this.ctx.emit('theme/change', this.snapshot);
    }
}
/** Read the persisted preference; unknown or unreadable values fall back to the default. */
function restorePreference() {
    // Non-browser runs (node e2e booting the client tree) have no localStorage.
    if (typeof localStorage === 'undefined')
        return DEFAULT_PREFERENCE;
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system')
            return stored;
    }
    catch {
        // Storage access can throw (privacy mode); the default below covers it.
    }
    return DEFAULT_PREFERENCE;
}
/** Persist the preference; storage failures are non-fatal (preference resets next boot). */
function persistPreference(preference) {
    if (typeof localStorage === 'undefined')
        return;
    try {
        localStorage.setItem(STORAGE_KEY, preference);
    }
    catch {
        // Storage access can throw (privacy mode / quota); the preference simply
        // does not survive the session.
    }
}
/** Required services: slots + locale (the feature registers its own settings row with localized copy). */
export const inject = ['slots', 'locale'];
/**
 * Client plugin body: provide the theme service and register the
 * feature-owned Appearance preference row into the General section's item
 * slot (a feature owns its settings surface).
 * @param ctx - client cordis context.
 */
export function apply(ctx) {
    const theme = new ThemeService(ctx);
    ctx.provide('theme', theme);
    ctx.effect(() => ctx.locale.register(SETTINGS_NS, { zh, en }), 'ui-theme: settings row dictionaries');
    const store = createAppearanceRowStore();
    let bound;
    const sync = (snapshot) => {
        bound?.sync(snapshot.preference, snapshot.revision);
    };
    ctx.on('theme/change', sync);
    const injected = (actions) => {
        bound = actions;
        // Re-sync from the getter so no event is lost between registration and
        // first render (the store's revision guard drops stale duplicates).
        sync(theme.getTheme());
        return {
            setTheme: (id) => { theme.setTheme(id); },
        };
    };
    ctx.slots.inject('settings.general.item', () => ctx.slots.register({
        name: 'settings.general.item',
        id: 'appearance',
        order: 10,
        store,
        locale: SETTINGS_NS,
        inject: injected,
    }, AppearanceRow));
}
//# sourceMappingURL=index.js.map