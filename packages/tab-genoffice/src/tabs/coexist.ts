/**
 * Click-preview coexistence config (BR-007). Changing claimed types or
 * degrade behaviour is a constant edit, not a render-logic rewrite.
 *
 * 2026-08-13 decision (ASM-001): claim docx / xlsx / pptx; leave md / pdf
 * to the upstream builtin viewers. Degrade stays manual.
 */
export const CLAIMED_EXTS = ['docx', 'xlsx', 'pptx'] as const

export type ClaimedExt = (typeof CLAIMED_EXTS)[number]

/** `manual` = button to the builtin; `auto` = render builtin with a strip. */
export type DegradeMode = 'manual' | 'auto'

export const DEGRADE_MODE: DegradeMode = 'manual'

/** better-sidebar builtin viewer ids keyed by our extension. */
export const UPSTREAM_VIEWER_ID: Record<string, string> = {
  docx: 'docx',
  xlsx: 'xlsx',
  pptx: 'pptx',
  md: 'markdown',
  pdf: 'pdf',
}

export function isClaimedExt(ext: string): ext is ClaimedExt {
  return (CLAIMED_EXTS as readonly string[]).includes(ext)
}
