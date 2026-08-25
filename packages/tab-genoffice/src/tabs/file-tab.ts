/**
 * Per-file sidebar tabs. The browser tab stays `single`; each open document
 * is its own tab, deduped by path so a second click focuses the existing one.
 */
import type { BetterSidebarService } from 'dsh-better-sidebar'

/** Directory/browser tab (one instance). */
export const BROWSER_TAB_ID = 'dsh-genoffice:tab'

/** Control-mode document tab (one instance per path). */
export const FILE_TAB_ID = 'dsh-genoffice:file'

export function fileNameOf(path: string): string {
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return slash < 0 ? path : path.slice(slash + 1)
}

/** Seed for `betterSidebar.openTab` — path-derived id so files sit side by side. */
export function fileTabSeed(path: string): Parameters<BetterSidebarService['openTab']>[0] {
  const title = fileNameOf(path)
  return {
    type: FILE_TAB_ID,
    path,
    title,
    id: `${FILE_TAB_ID}:${path}`,
  }
}

export type FileOpenRequest = {
  seed: Parameters<BetterSidebarService['openTab']>[0]
  scope?: { sessionId: string }
}

/**
 * Turn a relay `/api/open/stream` `file` payload into an `openTab` request.
 * A sessionId must ride with the seed: omitting it lands the tab in whatever
 * session is active on THIS page, so a second DSH page would also open it.
 */
export function fileOpenFromEvent(data: { path?: unknown; sessionId?: unknown }): FileOpenRequest | undefined {
  const path = typeof data.path === 'string' ? data.path : ''
  if (path === '') return undefined
  const sessionId = typeof data.sessionId === 'string' && data.sessionId !== '' ? data.sessionId : undefined
  return sessionId === undefined
    ? { seed: fileTabSeed(path) }
    : { seed: fileTabSeed(path), scope: { sessionId } }
}

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
export function fileOpenOnThisPage(
  data: { path?: unknown; sessionId?: unknown },
  activeSessionId: string | undefined,
): FileOpenRequest | undefined {
  const next = fileOpenFromEvent(data)
  if (next === undefined) return undefined
  if (next.scope === undefined) return next
  if (activeSessionId === undefined || activeSessionId !== next.scope.sessionId) return undefined
  return { seed: next.seed }
}
