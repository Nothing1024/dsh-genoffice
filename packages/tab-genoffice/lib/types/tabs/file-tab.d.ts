/**
 * Per-file sidebar tabs. The browser tab stays `single`; each open document
 * is its own tab, deduped by path so a second click focuses the existing one.
 */
import type { BetterSidebarService } from 'dsh-better-sidebar';
/** Directory/browser tab (one instance). */
export declare const BROWSER_TAB_ID = "dsh-genoffice:tab";
/** Control-mode document tab (one instance per path). */
export declare const FILE_TAB_ID = "dsh-genoffice:file";
export declare function fileNameOf(path: string): string;
/** Seed for `betterSidebar.openTab` — path-derived id so files sit side by side. */
export declare function fileTabSeed(path: string): Parameters<BetterSidebarService['openTab']>[0];
export type FileOpenRequest = {
    seed: Parameters<BetterSidebarService['openTab']>[0];
    scope?: {
        sessionId: string;
    };
};
/**
 * Turn a relay `/api/open/stream` `file` payload into an `openTab` request.
 * A sessionId must ride with the seed: omitting it lands the tab in whatever
 * session is active on THIS page, so a second DSH page would also open it.
 */
export declare function fileOpenFromEvent(data: {
    path?: unknown;
    sessionId?: unknown;
}): FileOpenRequest | undefined;
/**
 * Decide whether THIS DSH page should mount the control iframe.
 *
 * better-sidebar `openTab(seed, { sessionId })` against a session that is
 * not active on this page writes the tab into that session's store and
 * **skips panel expand**. A second page sharing origin then persists
 * `panelOpen: false` over the viewing page, so the iframe never mounts
 * and relay reports `executor not registered`.
 *
 * Only the page whose active session matches opens, and it opens without
 * scope so the active-session path expands the panel.
 */
export declare function fileOpenOnThisPage(data: {
    path?: unknown;
    sessionId?: unknown;
}, activeSessionId: string | undefined): FileOpenRequest | undefined;
//# sourceMappingURL=file-tab.d.ts.map