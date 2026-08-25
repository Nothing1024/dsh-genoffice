/**
 * Click-preview coexistence (BR-007 / ASM-001): claim docx/xlsx/pptx;
 * md/pdf stay on host viewers. Degrade is manual.
 *
 * Sidebar 0.13 dropped builtin office viewers. Prefer those ids if another
 * plugin re-registered them, then any non-own ext match, then
 * binary-download — never this plugin's own viewer (that would recurse).
 */
export const CLAIMED_EXTS = ['docx', 'xlsx', 'pptx'] as const

export type ClaimedExt = (typeof CLAIMED_EXTS)[number]

/** `manual` = button to the builtin; `auto` = render builtin with a strip. */
export type DegradeMode = 'manual' | 'auto'

export const DEGRADE_MODE: DegradeMode = 'manual'

/** Preferred fallback viewer ids keyed by extension. */
export const UPSTREAM_VIEWER_ID: Record<string, string> = {
  docx: 'docx',
  xlsx: 'xlsx',
  pptx: 'pptx',
  md: 'markdown',
  pdf: 'pdf',
}

/** FileViewer ids this plugin registers (`dsh-genoffice:viewer-${ext}`). */
export const OWN_VIEWER_PREFIX = 'dsh-genoffice:viewer-'

/** Last-resort host viewer: download the bytes, never a text editor. */
export const DOWNLOAD_VIEWER_ID = 'binary-download'

/** Minimal viewer row the degrade picker needs (keeps coexist free of sidebar types). */
export interface DegradeViewerCandidate {
  id: string
  exts: readonly string[]
  priority?: number
}

export function isOwnViewerId(id: string): boolean {
  return id.startsWith(OWN_VIEWER_PREFIX)
}

/**
 * Pick a FileViewer to render when control-mode cannot (relay down).
 * Never returns this plugin's own viewer — that would recurse into
 * ControlModeViewer.
 */
export function pickDegradeViewer<T extends DegradeViewerCandidate>(
  viewers: readonly T[],
  ext: string,
  skipId?: string,
  enabled?: (id: string) => boolean,
): T | undefined {
  const usable = (v: T): boolean =>
    v.id !== skipId
    && !isOwnViewerId(v.id)
    && (enabled === undefined || enabled(v.id))

  const preferredId = UPSTREAM_VIEWER_ID[ext]
  if (preferredId !== undefined) {
    const named = viewers.find((v) => v.id === preferredId && usable(v))
    if (named !== undefined) return named
  }

  const byExt = viewers
    .filter((v) => usable(v) && v.exts.includes(ext))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  const match = byExt[0]
  if (match !== undefined) return match

  return viewers.find((v) => v.id === DOWNLOAD_VIEWER_ID && usable(v))
}

export function isClaimedExt(ext: string): ext is ClaimedExt {
  return (CLAIMED_EXTS as readonly string[]).includes(ext)
}
