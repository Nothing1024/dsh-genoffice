/**
 * Local copy of the official `dsh-resource://file/…` grammar.
 *
 * `@deepseek-ai/dsh-util-workspace-path` is not a frozen platform module, so
 * the client bundle cannot import it at runtime. The encoding rules match
 * 0.1.7-alpha.1 (`:` stays literal; session vs absolute scopes).
 */

const FILE_ADDRESS_PREFIX = 'dsh-resource://file/'

function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/%3A/gi, ':')
}

function encodePath(path: string): string {
  return path.split('/').map(encodeSegment).join('/')
}

function isDriveSegment(segment: string | undefined): boolean {
  return segment !== undefined && /^[A-Za-z]:$/.test(segment)
}

export type FileAddress =
  | { readonly scope: 'session'; readonly sessionId: string; readonly path: string }
  | { readonly scope: 'absolute'; readonly path: string }

/** `dsh-resource://file/session/<sessionId>/<path>`. */
export function sessionFileAddress(sessionId: string, path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '')
  return `${FILE_ADDRESS_PREFIX}session/${encodeSegment(sessionId)}/${encodePath(normalized)}`
}

/** `dsh-resource://file/absolute/<path>` (leading `/` dropped; UNC keeps one empty segment). */
export function absoluteFileAddress(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const unc = normalized.startsWith('//')
  const absolute = normalized.replace(/^\/+/, '')
  return `${FILE_ADDRESS_PREFIX}absolute/${unc ? '/' : ''}${encodePath(absolute)}`
}

export function parseFileAddress(address: string): FileAddress | undefined {
  try {
    if (!address.startsWith(FILE_ADDRESS_PREFIX)) return undefined
    const end = address.search(/[?#]/)
    const [scope, ...rest] = address.slice(FILE_ADDRESS_PREFIX.length, end === -1 ? undefined : end).split('/')
    if (scope === 'session') {
      const [id, ...segments] = rest
      if (id === undefined || id === '' || segments.length === 0) return undefined
      return {
        scope,
        sessionId: decodeURIComponent(id),
        path: segments.map(decodeURIComponent).join('/'),
      }
    }
    if (scope === 'absolute') {
      const unc = rest[0] === '' && rest.length > 1
      const segments = (unc ? rest.slice(1) : rest).map(decodeURIComponent)
      if (segments.length === 0 || segments[0] === '') return undefined
      if (unc) return { scope, path: `//${segments.join('/')}` }
      return {
        scope,
        path: isDriveSegment(segments[0]) ? segments.join('/') : `/${segments.join('/')}`,
      }
    }
    return undefined
  } catch {
    return undefined
  }
}

function isWindowsStylePath(value: string): boolean {
  return /^[A-Za-z]:[/\\]/.test(value) || value.startsWith('\\\\')
}

export function isAbsoluteWorkspacePath(path: string): boolean {
  return path.startsWith('/') || isWindowsStylePath(path)
}

/**
 * Session-scoped when relative or under cwd; otherwise still session-scoped with
 * the absolute path (matches official `fileAddressFor` — never uses the
 * `absolute` scope from a session-bound opener).
 */
export function fileAddressFor(sessionId: string, cwd: string | undefined, path: string): string {
  const normalized = path.replace(/\\/g, '/')
  if (!isAbsoluteWorkspacePath(normalized)) return sessionFileAddress(sessionId, normalized)
  const root = cwd === undefined ? '' : cwd.replace(/\\/g, '/').replace(/\/+$/, '')
  if (root !== '' && normalized === root) return sessionFileAddress(sessionId, '')
  if (root !== '' && normalized.startsWith(`${root}/`)) {
    return sessionFileAddress(sessionId, normalized.slice(root.length + 1))
  }
  return sessionFileAddress(sessionId, normalized)
}

