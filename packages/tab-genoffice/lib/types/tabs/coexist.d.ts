/**
 * Click-preview coexistence config (BR-007). Changing claimed types or
 * degrade behaviour is a constant edit, not a render-logic rewrite.
 *
 * 2026-08-13 decision (ASM-001): claim docx / xlsx / pptx; leave md / pdf
 * to the upstream builtin viewers. Degrade stays manual.
 */
export declare const CLAIMED_EXTS: readonly ["docx", "xlsx", "pptx"];
export type ClaimedExt = (typeof CLAIMED_EXTS)[number];
/** `manual` = button to the builtin; `auto` = render builtin with a strip. */
export type DegradeMode = 'manual' | 'auto';
export declare const DEGRADE_MODE: DegradeMode;
/** better-sidebar builtin viewer ids keyed by our extension. */
export declare const UPSTREAM_VIEWER_ID: Record<string, string>;
export declare function isClaimedExt(ext: string): ext is ClaimedExt;
//# sourceMappingURL=coexist.d.ts.map