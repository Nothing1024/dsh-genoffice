/** Body attribute selecting the dark base palette in the token stylesheets. */
export const DARK_ATTRIBUTE = 'data-ds-dark-theme';
/** Applies theme snapshots to the document; one instance per plugin fiber. */
export class ThemePresenter {
    /** Token names this presenter wrote in the last apply (its retraction set). */
    appliedTokens = [];
    /**
     * Project a snapshot onto the document: set root `color-scheme` and the body
     * palette attribute from `active.colorScheme` (never the id — `system` is
     * resolved upstream), then replace the previously applied token variables
     * with `active.tokens`.
     * @param snapshot - resolved theme snapshot from ctx.theme.
     */
    apply(snapshot) {
        const scheme = snapshot.active.colorScheme;
        document.documentElement.style.colorScheme = scheme;
        const body = document.body;
        if (scheme === 'dark')
            body.setAttribute(DARK_ATTRIBUTE, '');
        else
            body.removeAttribute(DARK_ATTRIBUTE);
        for (const name of this.appliedTokens)
            body.style.removeProperty(name);
        this.appliedTokens = [];
        for (const [name, value] of Object.entries(snapshot.active.tokens)) {
            body.style.setProperty(name, value);
            this.appliedTokens.push(name);
        }
    }
    /** Retract everything this presenter wrote: root color-scheme, the palette attribute, and all applied token variables. */
    dispose() {
        document.documentElement.style.removeProperty('color-scheme');
        const body = document.body;
        body.removeAttribute(DARK_ATTRIBUTE);
        for (const name of this.appliedTokens)
            body.style.removeProperty(name);
        this.appliedTokens = [];
    }
}
//# sourceMappingURL=theme-presenter.js.map