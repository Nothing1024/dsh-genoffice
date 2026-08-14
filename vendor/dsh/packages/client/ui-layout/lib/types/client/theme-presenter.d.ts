/**
 * Global theme DOM applier: projects the resolved ThemeSnapshot onto the
 * document — `html { color-scheme }` for native UA chrome (scrollbars, form
 * controls), `body[data-ds-dark-theme]` for the token palette, and the active
 * theme's alias-token overrides as inline CSS variables on body. Pure DOM
 * writes, no React involvement; the presenter only ever retracts what it wrote
 * itself, so foreign attributes and inline styles survive apply/dispose.
 */
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client';
/** Body attribute selecting the dark base palette in the token stylesheets. */
export declare const DARK_ATTRIBUTE = "data-ds-dark-theme";
/** Applies theme snapshots to the document; one instance per plugin fiber. */
export declare class ThemePresenter {
    /** Token names this presenter wrote in the last apply (its retraction set). */
    private appliedTokens;
    /**
     * Project a snapshot onto the document: set root `color-scheme` and the body
     * palette attribute from `active.colorScheme` (never the id — `system` is
     * resolved upstream), then replace the previously applied token variables
     * with `active.tokens`.
     * @param snapshot - resolved theme snapshot from ctx.theme.
     */
    apply(snapshot: ThemeSnapshot): void;
    /** Retract everything this presenter wrote: root color-scheme, the palette attribute, and all applied token variables. */
    dispose(): void;
}
//# sourceMappingURL=theme-presenter.d.ts.map