"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UPSTREAM_VIEWER_ID = exports.DEGRADE_MODE = exports.CLAIMED_EXTS = void 0;
exports.isClaimedExt = isClaimedExt;
/**
 * Click-preview coexistence config (BR-007). Changing claimed types or
 * degrade behaviour is a constant edit, not a render-logic rewrite.
 *
 * 2026-08-13 decision (ASM-001): claim docx / xlsx / pptx; leave md / pdf
 * to the upstream builtin viewers. Degrade stays manual.
 */
exports.CLAIMED_EXTS = ['docx', 'xlsx', 'pptx'];
exports.DEGRADE_MODE = 'manual';
/** better-sidebar builtin viewer ids keyed by our extension. */
exports.UPSTREAM_VIEWER_ID = {
    docx: 'docx',
    xlsx: 'xlsx',
    pptx: 'pptx',
    md: 'markdown',
    pdf: 'pdf',
};
function isClaimedExt(ext) {
    return exports.CLAIMED_EXTS.includes(ext);
}
