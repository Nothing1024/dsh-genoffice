import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { getRelayOk, probeRelay, resetRelayStore, subscribeRelay } from '../src/tabs/relay.ts'

describe('shared relay store', () => {
  beforeEach(() => {
    resetRelayStore()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    resetRelayStore()
  })

  it('notifies subscribers once per completed probe', async () => {
    let hits = 0
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))
    const stop = subscribeRelay(() => { hits += 1 })
    await probeRelay(true)
    expect(getRelayOk()).toBe(true)
    expect(hits).toBe(1)
    stop()
  })

  it('throttles back-to-back probes unless forced', async () => {
    const fetch = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetch)
    await probeRelay(true)
    await probeRelay(false)
    expect(fetch).toHaveBeenCalledTimes(1)
    await probeRelay(true)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
