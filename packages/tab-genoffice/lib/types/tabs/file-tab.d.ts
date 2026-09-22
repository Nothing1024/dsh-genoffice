/** Directory/browser tab kind (one instance per pane). */
export declare const BROWSER_TAB_ID = "dsh-genoffice:tab";
/** Control-mode document tab kind (one instance per path via contentId). */
export declare const FILE_TAB_ID = "dsh-genoffice:file";
export declare function fileNameOf(path: string): string;
export declare function isClaimedPath(path: string): boolean;
export type FileOpenRequest = {
    path: string;
    sessionId?: string;
};
/**
 * Turn a relay `/api/open/stream` `file` payload into an open request.
 * A sessionId must ride with the path: omitting it lands the tab in whatever
 * session is active on THIS page.
 */
export declare function fileOpenFromEvent(data: {
    path?: unknown;
    sessionId?: unknown;
}): FileOpenRequest | undefined;
/**
 * Decide whether THIS DSH page should mount the control iframe.
 *
 * Official `sidebarRight.openResource` writes into the mounted session's
 * surface. A second page sharing origin must not open a tab for a session it
 * is not viewing — that would skip expand on the origin page.
 *
 * A page whose sidebar has no mounted session id (the usual single-page
 * case) still opens the file. Dropping that event used to leave the tab
 * unmounted, so `*_open` timed out as `executor not registered` even though
 * the relay had subscribers. A page that IS viewing a different session
 * still skips, so two open chats do not steal each other's file.
 */
export declare function fileOpenOnThisPage(data: {
    path?: unknown;
    sessionId?: unknown;
}, activeSessionId?: string): FileOpenRequest | undefined;
/**
 * Address for the page that accepted the open.
 *
 * Use this page's mounted session when it has one. Otherwise use the absolute
 * scope. Never stamp the agent id or `'unknown'` onto the address: the file
 * tab would then look up a session that is not on screen, and the iframe
 * would not mount.
 */
export declare function controlOpenAddress(path: string, pageSessionId?: string): string;
//# sourceMappingURL=file-tab.d.ts.map