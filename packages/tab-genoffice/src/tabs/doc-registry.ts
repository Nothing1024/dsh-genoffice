/**
 * In-memory docId occupancy table (BR-005). One control-mode surface per
 * document: a second mount shows a hint instead of a second iframe.
 * Cleared on full page reload — that is accepted.
 */
export type ControlSurface = 'tab' | 'viewer'

export interface ActiveDoc {
  surface: ControlSurface
}

const active = new Map<string, ActiveDoc>()
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function lookupActive(docId: string): ActiveDoc | undefined {
  return active.get(docId)
}

export function subscribeActive(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Register occupancy. Returns an unregister function. */
export function registerActive(docId: string, entry: ActiveDoc): () => void {
  active.set(docId, entry)
  queueMicrotask(notify)
  return () => {
    if (active.get(docId) === entry) {
      active.delete(docId)
      notify()
    }
  }
}

/** Test seam: drop every entry. */
export function resetActiveDocs(): void {
  active.clear()
  notify()
}
