import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  emitOpenFile,
  getRelayOk,
  getRelayReady,
  probeRelay,
  resetRelayStore,
  scheduleOpenFile,
  startOpenFileStream,
  subscribeOpenFile,
  subscribeRelay,
} from '../src/tabs/relay.ts'

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

  it('marks ready=false for a zombie instance (health ok but static roots gone)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, ready: false, roots: [], executors: 0 }),
    })))
    await probeRelay(true)
    expect(getRelayOk()).toBe(true)
    expect(getRelayReady()).toBe(false)
  })

  it('treats an old relay without the ready field as ready', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, name: 'genoffice-web-relay', port: 8787 }),
    })))
    await probeRelay(true)
    expect(getRelayOk()).toBe(true)
    expect(getRelayReady()).toBe(true)
  })

  it('resets ready to unknown when the relay is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED') }))
    await probeRelay(true)
    expect(getRelayOk()).toBe(false)
    expect(getRelayReady()).toBe(null)
  })
})

describe('open-file subscribe/emit', () => {
  class FakeEventSource {
    static last: FakeEventSource | undefined
    url: string
    closed = false
    private readonly listeners = new Map<string, Set<(ev: MessageEvent) => void>>()
    constructor(url: string) {
      this.url = url
      FakeEventSource.last = this
    }
    addEventListener(type: string, fn: (ev: MessageEvent) => void): void {
      const set = this.listeners.get(type) ?? new Set()
      set.add(fn)
      this.listeners.set(type, set)
    }
    close(): void { this.closed = true }
    emit(type: string, data: string): void {
      for (const fn of this.listeners.get(type) ?? []) fn({ data } as MessageEvent)
    }
  }

  beforeEach(() => {
    FakeEventSource.last = undefined
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  it('dispatches subscribeOpenFile listeners via emitOpenFile', () => {
    const seen: string[] = []
    const stop = subscribeOpenFile((p) => { seen.push(p) })
    emitOpenFile('/tmp/a.docx')
    emitOpenFile('/tmp/b.pptx')
    expect(seen).toEqual(['/tmp/a.docx', '/tmp/b.pptx'])
    stop()
    emitOpenFile('/tmp/c.xlsx')
    expect(seen).toEqual(['/tmp/a.docx', '/tmp/b.pptx'])
  })

  it('scheduleOpenFile emits immediately when a listener is already mounted', () => {
    const seen: string[] = []
    const stop = subscribeOpenFile((p) => { seen.push(p) })
    const cancel = scheduleOpenFile('/tmp/ready.docx')
    expect(seen).toEqual(['/tmp/ready.docx'])
    cancel()
    stop()
  })

  it('scheduleOpenFile waits then emits when no listener is mounted, and cancel drops it', () => {
    vi.useFakeTimers()
    try {
      const seen: string[] = []
      const cancel = scheduleOpenFile('/tmp/late.docx', 300)
      const stop = subscribeOpenFile((p) => { seen.push(p) })
      expect(seen).toEqual([])
      vi.advanceTimersByTime(300)
      expect(seen).toEqual(['/tmp/late.docx'])
      stop()
      cancel()
      const cancelDropped = scheduleOpenFile('/tmp/dropped.docx', 300)
      const stop2 = subscribeOpenFile((p) => { seen.push(p) })
      cancelDropped()
      vi.advanceTimersByTime(300)
      expect(seen).toEqual(['/tmp/late.docx'])
      stop2()
    } finally {
      vi.useRealTimers()
    }
  })

  it('startOpenFileStream forwards SSE file events', () => {
    const seen: string[] = []
    const stopSub = subscribeOpenFile((p) => { seen.push(p) })
    const stop = startOpenFileStream()
    expect(FakeEventSource.last?.url).toBe('http://localhost:8787/api/open/stream')
    FakeEventSource.last?.emit('file', JSON.stringify({ path: '/tmp/deck.pptx' }))
    FakeEventSource.last?.emit('file', JSON.stringify({ path: '' }))
    FakeEventSource.last?.emit('file', 'nope')
    expect(seen).toEqual(['/tmp/deck.pptx'])
    stop()
    stopSub()
    expect(FakeEventSource.last?.closed).toBe(true)
  })
})
