/**
 * ui-skill browser half: source registration (duplicate-name proof) +
 * fiber-teardown removal (HMR safety) against the real SlashService, then
 * the source behavior contract driven directly on the captured source with
 * real ClientSessionContext projections — sessionId addressing, the
 * session-keyed catalog cache (single-flight per key, scope-birth warm
 * prewarm, connection/reset clear), startsWith filtering, RPC-failure
 * rejection, pick → plain-text outcome (decision 21), the synchronous
 * lexicon reads over the settled cache, and the reference codec's two
 * projections. Direct driving is deliberate: this spec owns only the
 * source's own contract.
 */
import { Context } from 'cordis'
import { describe, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { SlashService } from '@deepseek-ai/dsh-client-ui-slash/client'
import type { ClientSessionContext, SlashSource } from '@deepseek-ai/dsh-client-ui-slash/client'
import { apply, inject } from '../src/client/index.ts'

type SkillRow = { name: string; description: string; whenToUse?: string }
type ListResult =
  | { ok: true; value: { skills: SkillRow[] } }
  | { ok: false; error: { code: string; message: string; details: object } }
type ListFn = (payload: object, signal?: AbortSignal) => Promise<{ result: ListResult }>

/** Boot the plugin over fake slash/connection faces; returns the captured source and its ctx. */
async function bench(list: ListFn, addressed?: SessionId) {
  const ctx = new Context()
  let captured: SlashSource | undefined
  ctx.provide('slash', { registerSource: (src: SlashSource) => { captured = src; return () => {} } })
  ctx.provide('connection', { api: { skills: { list } } })
  ctx.provide('sessions', {
    subagentAddress: (id: SessionId) => id === addressed
      ? { parentSessionId: sid('parent'), childSessionId: id, mode: 'continuable' as const }
      : undefined,
  })
  await ctx.plugin({ inject: [...inject], apply }).await()
  return { ctx, source: captured! }
}

const CATALOG: SkillRow[] = [
  { name: 'commit-helper', description: 'commit flow' },
  { name: 'code-review', description: 'review flow', whenToUse: 'reviews' },
  { name: 'deploy', description: 'deploy flow' },
]

const listOk = (skills: SkillRow[]): ListFn => () => Promise.resolve({ result: { ok: true as const, value: { skills } } })

/** Counting fake: records payloads, resolves the shared catalog. */
function countingList(skills: SkillRow[] = CATALOG) {
  const payloads: object[] = []
  const list: ListFn = (payload) => {
    payloads.push(payload)
    return listOk(skills)(payload)
  }
  return { list, payloads }
}

const sid = (id: string) => id as SessionId

const proj = (id: string): ClientSessionContext => ({ sessionId: sid(id) })

const req = (query: string, signal?: AbortSignal) =>
  ({ query, position: 'leading' as const, signal: signal ?? new AbortController().signal })

describe('apply', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['slash', 'connection', 'sessions'])
  })

  it('registers the "/" skill source; disposal frees the name (HMR safety)', async () => {
    const ctx = new Context()
    // SlashService itself injects 'sessions'; the stub unblocks its fiber.
    ctx.provide('sessions', {})
    await ctx.plugin(SlashService).await()
    ctx.provide('connection', { api: { skills: { list: listOk(CATALOG) } } })
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const slash = ctx.get('slash') as SlashService
    const rival = {
      trigger: '/' as const,
      name: 'skill',
      candidates: () => { return Promise.resolve([]) },
      onPick: () => undefined,
    }
    // Live registration holds the (trigger, name) seat…
    expect(() => slash.registerSource(rival)).toThrow(/already registered/)
    // …and fiber teardown releases it.
    await fiber.dispose()
    expect(() => slash.registerSource(rival)).not.toThrow()
  })
})

describe('candidates: sessionId addressing', () => {
  it('lists via {sessionId} and filters by startsWith(query)', async () => {
    const { list, payloads } = countingList()
    const { source } = await bench(list)
    const items = await source.candidates(proj('s1'), req('co'))
    // Exact payload: session address only — no agent or transport vocabulary.
    expect(payloads).toEqual([{ sessionId: 's1' }])
    expect(items).toEqual([
      { name: 'commit-helper', description: 'commit flow' },
      { name: 'code-review', description: 'review flow' },
    ])
  })

  it('rejects on a failed result (the slash shell owns the menu-side fold)', async () => {
    const { source } = await bench(() => Promise.resolve({
      result: { ok: false, error: { code: 'internal', message: 'boom', details: {} } },
    }))
    await expect(source.candidates(proj('s1'), req('co')))
      .rejects.toThrow('skill.list failed: internal: boom')
  })

  it('does not fetch Agent-bound skills for an addressed child', async () => {
    const { list, payloads } = countingList()
    const { source } = await bench(list, sid('child'))
    await expect(source.candidates(proj('child'), req(''))).resolves.toEqual([])
    source.warm!(proj('child'))
    expect(payloads).toEqual([])
  })
})

describe('catalog cache', () => {
  it('re-polls on the same session filter locally: one RPC across keystrokes', async () => {
    const { list, payloads } = countingList()
    const { source } = await bench(list)
    await source.candidates(proj('s1'), req(''))
    const second = await source.candidates(proj('s1'), req('co'))
    expect(payloads).toHaveLength(1)
    expect(second).toEqual([
      { name: 'commit-helper', description: 'commit flow' },
      { name: 'code-review', description: 'review flow' },
    ])
    // A different session is its own key — one more RPC, not two.
    await source.candidates(proj('s2'), req(''))
    expect(payloads).toEqual([{ sessionId: 's1' }, { sessionId: 's2' }])
  })

  it('single-flight: concurrent candidates on one cold key share one RPC', async () => {
    const { list, payloads } = countingList()
    const { source } = await bench(list)
    const [a, b] = await Promise.all([
      source.candidates(proj('s1'), req('dep')),
      source.candidates(proj('s1'), req('co')),
    ])
    expect(payloads).toHaveLength(1)
    expect(a).toEqual([{ name: 'deploy', description: 'deploy flow' }])
    expect(b).toHaveLength(2)
  })

  it('an aborted caller yields empty but leaves the shared fetch warm', async () => {
    const { list, payloads } = countingList()
    const { source } = await bench(list)
    const aborted = new AbortController()
    aborted.abort()
    await expect(source.candidates(proj('s1'), req('co', aborted.signal))).resolves.toEqual([])
    // The fetch settled into the cache: the next caller pays zero RPC.
    await expect(source.candidates(proj('s1'), req('co'))).resolves.toHaveLength(2)
    expect(payloads).toHaveLength(1)
  })

  it('a failed fetch does not poison the key: the next caller retries', async () => {
    let fail = true
    const payloads: object[] = []
    const { source } = await bench((payload) => {
      payloads.push(payload)
      return fail
        ? Promise.resolve({ result: { ok: false as const, error: { code: 'internal', message: 'boom', details: {} } } })
        : listOk(CATALOG)(payload)
    })
    await expect(source.candidates(proj('s1'), req(''))).rejects.toThrow('boom')
    fail = false
    await expect(source.candidates(proj('s1'), req(''))).resolves.toHaveLength(3)
    expect(payloads).toHaveLength(2)
  })

  it('the scope-birth warm prewarms the session key fire-and-forget', async () => {
    const { list, payloads } = countingList()
    const { source } = await bench(list)
    source.warm!(proj('s1'))
    await vi.waitFor(() => { expect(payloads).toHaveLength(1) })
    expect(payloads[0]).toEqual({ sessionId: 's1' })
    // The prewarmed key serves candidates with zero further RPC; other
    // sessions' keys stay untouched.
    await expect(source.candidates(proj('s1'), req(''))).resolves.toHaveLength(3)
    expect(payloads).toHaveLength(1)
    await source.candidates(proj('s2'), req(''))
    expect(payloads).toHaveLength(2)
  })

  it('connection/reset clears every cached session', async () => {
    const { list, payloads } = countingList()
    const { ctx, source } = await bench(list)
    await source.candidates(proj('s1'), req(''))
    await source.candidates(proj('s2'), req(''))
    expect(payloads).toHaveLength(2)
    ctx.emit('connection/reset')
    await source.candidates(proj('s1'), req(''))
    await source.candidates(proj('s2'), req(''))
    expect(payloads).toHaveLength(4)
  })
})

describe('lexicon', () => {
  it('is undefined before the session catalog settles and serves names after', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    const { source } = await bench(async (payload) => {
      await gate
      return listOk(CATALOG)(payload)
    })
    // Cold: nothing cached for the session.
    expect(source.lexicon!(proj('s1'))).toBeUndefined()
    const pending = source.candidates(proj('s1'), req(''))
    // In flight: still no synchronous snapshot.
    expect(source.lexicon!(proj('s1'))).toBeUndefined()
    release!()
    await pending
    expect(source.lexicon!(proj('s1'))).toEqual(['commit-helper', 'code-review', 'deploy'])
    // Another session's key is independent — cold until its own fetch.
    expect(source.lexicon!(proj('s2'))).toBeUndefined()
  })

  it('subscribeLexicon notifies on catalog settle and on invalidation, per session', async () => {
    const { list } = countingList()
    const { ctx, source } = await bench(list)
    const s1 = vi.fn()
    const s2 = vi.fn()
    source.subscribeLexicon!(proj('s1'), s1)
    source.subscribeLexicon!(proj('s2'), s2)
    await source.candidates(proj('s1'), req(''))
    expect(s1).toHaveBeenCalledTimes(1)
    expect(s2).not.toHaveBeenCalled()
    // Reset invalidates every cached session: each key notifies its own listeners.
    await source.candidates(proj('s2'), req(''))
    ctx.emit('connection/reset')
    expect(s1).toHaveBeenCalledTimes(2)
    expect(s2).toHaveBeenCalledTimes(2)
  })

  it('an unsubscribed lexicon listener stops receiving notifications', async () => {
    const { list } = countingList()
    const { source } = await bench(list)
    const listener = vi.fn()
    const off = source.subscribeLexicon!(proj('s1'), listener)
    off()
    await source.candidates(proj('s1'), req(''))
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('pick and codec', () => {
  it('onPick returns the literal /name text with a closing space (decision 21)', async () => {
    const { source } = await bench(listOk(CATALOG))
    const outcome = source.onPick({
      candidate: { name: 'commit-helper', description: 'commit flow' },
      session: proj('s1'),
      position: 'leading',
      via: 'menu',
      span: { start: 0, end: 4, draftRev: 7 },
    })
    expect(outcome).toEqual({ text: '/commit-helper ' })
  })

  it('codec projects clipboard `/name` and serializes the model form <skill>name</skill>', async () => {
    const { source } = await bench(listOk(CATALOG))
    expect(source.codec!.clipboardText('deploy')).toBe('/deploy')
    await expect(source.codec!.serialize('deploy', new AbortController().signal))
      .resolves.toBe('<skill>deploy</skill>')
  })
})

describe('adjudication', () => {
  it('never participates: no matchSpace/matchEnter hooks on the skill source', async () => {
    const { source } = await bench(listOk(CATALOG))
    expect(typeof source.matchSpace).toBe('undefined')
    expect(typeof source.matchEnter).toBe('undefined')
  })
})
