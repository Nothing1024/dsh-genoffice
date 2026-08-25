import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  handleRelayLaunchRequest,
  isRelayLaunchConfigured,
  resetRelayLaunch,
} from '../src/host/relay-launch.ts'

const prev = process.env.DSH_GENOFFICE_ROOT

function mockReq(method: string, origin?: string): IncomingMessage {
  return {
    method,
    headers: origin === undefined ? {} : { origin },
  } as IncomingMessage
}

function mockRes(): ServerResponse & { status: number; body: string } {
  const r = {
    status: 0,
    body: '',
    writeHead(code: number, _headers?: unknown) {
      r.status = code
      return r
    },
    end(chunk?: unknown) {
      r.body = chunk === undefined ? '' : String(chunk)
    },
  }
  return r as unknown as ServerResponse & { status: number; body: string }
}

describe('relay-launch route', () => {
  beforeEach(() => {
    delete process.env.DSH_GENOFFICE_ROOT
    resetRelayLaunch()
  })

  afterEach(() => {
    if (prev === undefined) delete process.env.DSH_GENOFFICE_ROOT
    else process.env.DSH_GENOFFICE_ROOT = prev
    resetRelayLaunch()
  })

  it('GET reports configured false when the env is unset', async () => {
    expect(isRelayLaunchConfigured()).toBe(false)
    const res = mockRes()
    await handleRelayLaunchRequest(mockReq('GET'), res)
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ configured: false })
  })

  it('POST is ok:false when not configured', async () => {
    const res = mockRes()
    await handleRelayLaunchRequest(mockReq('POST', 'http://127.0.0.1:3080'), res)
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: false, error: 'not configured' })
  })

  it('a fake DSH_GENOFFICE_ROOT stays unconfigured and POST is ok:false', async () => {
    process.env.DSH_GENOFFICE_ROOT = '/tmp/no-such-genoffice-root-xyz'
    expect(isRelayLaunchConfigured()).toBe(false)
    const res = mockRes()
    await handleRelayLaunchRequest(mockReq('POST', 'http://localhost:3080'), res)
    expect(JSON.parse(res.body)).toEqual({ ok: false, error: 'not configured' })
  })
})
