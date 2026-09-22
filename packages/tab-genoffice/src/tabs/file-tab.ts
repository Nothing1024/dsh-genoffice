/**
 * Per-file sidebar tabs. The browser tab is a page kind; each open document
 * is a resource tab claimed by `*.docx|xlsx|pptx` at the extension band.
 */
import { absoluteFileAddress, fileAddressFor } from './file-address.ts'
import { CLAIMED_EXTS } from './coexist.ts'
import { extOf } from './relay.ts'

/** Directory/browser tab kind (one instance per pane). */
export const BROWSER_TAB_ID = 'dsh-genoffice:tab'

/** Control-mode document tab kind (one instance per path via contentId). */
export const FILE_TAB_ID = 'dsh-genoffice:file'

export function fileNameOf(path: string): string {
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return slash < 0 ? path : path.slice(slash + 1)
}

export function isClaimedPath(path: string): boolean {
  return (CLAIMED_EXTS as readonly string[]).includes(extOf(path))
}

export type FileOpenRequest = {
  path: string
  sessionId?: string
}

/**
 * Turn a relay `/api/open/stream` `file` payload into an open request.
 * A sessionId must ride with the path: omitting it lands the tab in whatever
 * session is active on THIS page.
 */
export function fileOpenFromEvent(data: { path?: unknown; sessionId?: unknown }): FileOpenRequest | undefined {
  const path = typeof data.path === 'string' ? data.path : ''
  if (path === '') return undefined
  const sessionId = typeof data.sessionId === 'string' && data.sessionId !== '' ? data.sessionId : undefined
  return sessionId === undefined ? { path } : { path, sessionId }
}

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
export function fileOpenOnThisPage(
  data: { path?: unknown; sessionId?: unknown },
  activeSessionId?: string,
): FileOpenRequest | undefined {
  const next = fileOpenFromEvent(data)
  if (next === undefined) return undefined
  if (next.sessionId === undefined) return next
  if (activeSessionId !== undefined && activeSessionId !== next.sessionId) return undefined
  return { path: next.path, sessionId: next.sessionId }
}

/**
 * Address for the page that accepted the open.
 *
 * Use this page's mounted session when it has one. Otherwise use the absolute
 * scope. Never stamp the agent id or `'unknown'` onto the address: the file
 * tab would then look up a session that is not on screen, and the iframe
 * would not mount.
 */
export function controlOpenAddress(path: string, pageSessionId?: string): string {
  if (pageSessionId !== undefined && pageSessionId !== '') {
    return fileAddressFor(pageSessionId, undefined, path)
  }
  return absoluteFileAddress(path)
}
