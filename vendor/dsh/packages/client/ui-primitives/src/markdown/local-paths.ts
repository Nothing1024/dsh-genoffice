/**
 * Local-file-path linking for assistant-authored markdown: prose frequently
 * names absolute file paths (…/report.md, ~/notes/notes.docx). When such a
 * path ends in a previewable extension, the text renderer splits it out and
 * renders it as a clickable local-file link; the click dispatches
 * {@link LOCAL_FILE_OPEN_EVENT} on `window` for host plugins to consume
 * (the artifact profile's genoffice tab listens and previews the file).
 *
 * The detection is deliberately conservative — absolute POSIX paths only,
 * previewable extensions only, and never inside URLs, relative paths, or
 * mid-word tokens — so ordinary prose and code mentions stay inert text.
 */

/** Window event dispatched when a rendered local-file link is clicked. */
export const LOCAL_FILE_OPEN_EVENT = 'dsh:open-local-file'

/** Previewable local-file extensions (kept in sync with the genoffice tab's own allowlist). */
const LOCAL_FILE_EXTS = 'md|mdx|docx'

/**
 * Path body: one or more of any character except whitespace, quotes, angle
 * brackets, and prose punctuation (CJK and ASCII). Parens/brackets/braces
 * are excluded too — bracketed filenames are rarer in prose than the
 * sentence punctuation that would otherwise leak into the match.
 */
const PATH_BODY = `[^\\s"'` + '`' + `<>，。；：、！？()\\[\\]{}]+`

/**
 * One local-file-path occurrence: `~?/` absolute start, a path body ending
 * in a previewable extension, followed by a non-path character (or end).
 * The leading alternative captures the single preceding character so the
 * caller can re-emit it as plain text; `:`, `/`, `.`, and word characters
 * before the slash disqualify URLs (`https://…`, the second slash of `//`),
 * Windows drives, and relative paths (`../`, `./`).
 */
export const LOCAL_FILE_PATH_RE = new RegExp(
  `(^|[^\\w:>/.])(~?\\/${PATH_BODY}\\.(?:${LOCAL_FILE_EXTS}))(?![\\w.])`,
  'gi',
)

/** One segment of a split text run: plain prose, or a detected local path. */
export type LocalPathToken =
  | { kind: 'text'; value: string }
  | { kind: 'path'; path: string }

/**
 * Split a text-node value into prose segments and detected local file paths.
 * Adjacent prose segments coalesce, so the token stream alternates.
 * @param value - the raw text-node value.
 * @returns alternating text/path tokens preserving the original order and content.
 */
export function splitTextWithLocalPaths(value: string): LocalPathToken[] {
  const tokens: LocalPathToken[] = []
  const push = (token: LocalPathToken): void => {
    const prev = tokens[tokens.length - 1]
    if (token.kind === 'text' && prev !== undefined && prev.kind === 'text') {
      tokens[tokens.length - 1] = { kind: 'text', value: prev.value + token.value }
    } else {
      tokens.push(token)
    }
  }
  let last = 0
  for (const match of value.matchAll(LOCAL_FILE_PATH_RE)) {
    // matchAll always yields an index, and the pattern always captures both
    // groups (the pre character and the path), so no fallbacks are needed.
    const index = match.index
    const whole = match[0]
    const pre = match[1]
    const path = match[2]
    if (index > last) push({ kind: 'text', value: value.slice(last, index) })
    if (pre !== '') push({ kind: 'text', value: pre })
    push({ kind: 'path', path })
    last = index + whole.length
  }
  if (last < value.length) push({ kind: 'text', value: value.slice(last) })
  return tokens
}
