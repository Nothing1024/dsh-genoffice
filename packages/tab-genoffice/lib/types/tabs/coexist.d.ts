/**
 * Click-preview coexistence (BR-007 / ASM-001): claim docx/xlsx/pptx;
 * md/pdf stay on host viewers. Degrade is manual.
 *
 * Sidebar 0.13 dropped builtin office viewers. Prefer those ids if another
 * plugin re-registered them, then any non-own ext match, then
 * binary-download — never this plugin's own viewer (that would recurse).
 */
export declare const CLAIMED_EXTS: readonly ["docx", "xlsx", "pptx"];
export type ClaimedExt = (typeof CLAIMED_EXTS)[number];
/** `manual` = button to the builtin; `auto` = render builtin with a strip. */
export type DegradeMode = 'manual' | 'auto';
export declare const DEGRADE_MODE: DegradeMode;
/** Preferred fallback viewer ids keyed by extension. */
export declare const UPSTREAM_VIEWER_ID: Record<string, string>;
/** FileViewer ids this plugin registers (`dsh-genoffice:viewer-${ext}`). */
export declare const OWN_VIEWER_PREFIX = "dsh-genoffice:viewer-";
/** Last-resort host viewer: download the bytes, never a text editor. */
export declare const DOWNLOAD_VIEWER_ID = "binary-download";
/** Minimal viewer row the degrade picker needs (keeps coexist free of sidebar types). */
export interface DegradeViewerCandidate {
    id: string;
    exts: readonly string[];
    priority?: number;
}
export declare function isOwnViewerId(id: string): boolean;
/**
 * Pick a FileViewer to render when control-mode cannot (relay down).
 * Never returns this plugin's own viewer — that would recurse into
 * ControlModeViewer.
 */
export declare function pickDegradeViewer<T extends DegradeViewerCandidate>(viewers: readonly T[], ext: string, skipId?: string, enabled?: (id: string) => boolean): T | undefined;
export declare function isClaimedExt(ext: string): ext is ClaimedExt;
//# sourceMappingURL=coexist.d.ts.map