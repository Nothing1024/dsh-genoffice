/**
 * Skill reference plugin, browser half: registers the '/' skill source —
 * candidates from the skill.list RPC addressed by the per-call session
 * projection's sessionId (sessions are always agent-backed; the host
 * resolves cwd from the session header), pick inserts the literal `/name `
 * text (decision 21: the draft carries plain text, chip visuals are derived
 * by scanning against the source lexicon, and the prompt ships the same
 * literal — no `<skill>` tag). The RPC rides the plugin's root-context
 * connection captured at registration — the source never reads services off
 * a per-call argument. No adjudication hooks: skill references ride
 * ordinary prompts and never enter command adjudication.
 *
 * Catalog fetches are cached per session (the small twin of the ui-command
 * directory): the per-keystroke candidates re-poll filters a settled
 * snapshot locally, so one session costs one RPC. The scope-birth warm hook
 * prewarms the session's key; connection/reset clears everything — the host
 * catalog may differ across generations. A shared in-flight fetch
 * deliberately outlives any single menu interaction: closing the menu must
 * not kill the prewarm other consumers will hit, so it carries its own
 * abort (fired only on invalidation/teardown) while a candidates caller
 * with an aborted signal just returns early.
 */
import type { ConnectionHandle, SessionId, SkillEntry } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext, ISessions } from '@deepseek-ai/dsh-client-runtime/client'
import type { SlashServiceContract, SlashSource } from '@deepseek-ai/dsh-client-ui-slash/client'

/** One session's catalog fetch: the shared promise plus its own abort handle. */
interface CatalogFetch {
  readonly promise: Promise<readonly SkillEntry[]>
  readonly abort: AbortController
  /** Settled catalog for synchronous lexicon reads (unset while in flight or on failure). */
  settled?: readonly SkillEntry[]
}

/** Required services: slash registry, routed sessions, and the wire face. */
export const inject = ['slash', 'connection', 'sessions']

/**
 * Client plugin body: register the '/' skill source over the root wire face.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const skills = (ctx.get('connection') as ConnectionHandle).api.skills
  const sessions = ctx.get('sessions') as ISessions
  // Session-keyed catalog cache; single-flight per key. Plugin-closure state:
  // the fiber effect below is its teardown boundary.
  const fetches = new Map<SessionId, CatalogFetch>()
  // Per-session lexicon invalidation listeners (subscribeLexicon consumers).
  const lexiconListeners = new Map<SessionId, Set<() => void>>()

  const notifyLexicon = (sessionId: SessionId): void => {
    for (const listener of [...(lexiconListeners.get(sessionId) ?? [])]) {
      try {
        listener()
      } catch (error) {
        // Contain listener failures: settlement notifies from an ignored
        // promise chain (a throw would surface as an unhandled rejection)
        // and one faulty consumer must not starve the others.
        console.error('[ui-skill] lexicon listener failed:', error)
      }
    }
  }

  const fetchCatalog = (sessionId: SessionId): Promise<readonly SkillEntry[]> => {
    if (sessions.subagentAddress(sessionId) !== undefined) return Promise.resolve([])
    const existing = fetches.get(sessionId)
    if (existing !== undefined) return existing.promise
    const abort = new AbortController()
    const promise = (async () => {
      const { result } = await skills.list({ sessionId }, abort.signal)
      if (!result.ok) { throw new Error(`skill.list failed: ${result.error.code}: ${result.error.message}`) }
      return result.value.skills
    })()
    const entry: CatalogFetch = { promise, abort }
    fetches.set(sessionId, entry)
    promise.then(
      // Settled snapshot backs the synchronous lexicon reads.
      (skills) => {
        entry.settled = skills
        notifyLexicon(sessionId)
      },
      // A failed fetch must not poison the key: the next consumer retries.
      () => {
        if (fetches.get(sessionId) === entry) fetches.delete(sessionId)
      },
    )
    return promise
  }

  const invalidate = (key: SessionId): void => {
    const entry = fetches.get(key)
    if (entry === undefined) return
    fetches.delete(key)
    entry.abort.abort()
    notifyLexicon(key)
  }

  const clearAll = (): void => {
    for (const key of [...fetches.keys()]) invalidate(key)
  }

  const source: SlashSource = {
    trigger: '/',
    name: 'skill',
    order: 2,
    async candidates(session, { query, signal }) {
      const skills = await fetchCatalog(session.sessionId)
      // Superseded keystroke: the shared fetch stays warm, this caller yields.
      if (signal.aborted) return []
      return skills
        .filter(skill => skill.name.startsWith(query))
        .map(skill => ({ name: skill.name, description: skill.description }))
    },
    warm(session) {
      // Fire-and-forget scope-birth prewarm; the shared fetch reports
      // through candidates.
      fetchCatalog(session.sessionId).catch(() => {})
    },
    lexicon(session) {
      return fetches.get(session.sessionId)?.settled?.map(skill => skill.name)
    },
    subscribeLexicon(session, listener) {
      const key = session.sessionId
      const listeners = lexiconListeners.get(key) ?? new Set()
      listeners.add(listener)
      lexiconListeners.set(key, listeners)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) lexiconListeners.delete(key)
      }
    },
    onPick({ candidate }) {
      // Decision 21: plain-text reference — the literal lands in the draft
      // and ships to the model verbatim (trailing space closes the token).
      // Legacy path (decision 21), retained for the removal cut, no longer reached:
      // return { insert: { source: 'skill', ref: candidate.name, label: candidate.name, clipboardText: `/${candidate.name}` } }
      return { text: `/${candidate.name} ` }
    },
    codec: {
      clipboardText: ref => `/${ref}`,
      serialize: ref => Promise.resolve(`<skill>${ref}</skill>`),
    },
  }
  const slash = ctx.get('slash') as SlashServiceContract
  ctx.on('connection/reset', clearAll)
  ctx.effect(() => {
    const unregister = slash.registerSource(source)
    return () => {
      unregister()
      clearAll()
    }
  }, 'ui-skill: source')
}
