/**
 * dsh-community-standard 对齐层的行为契约：
 * 1. SDK 垫片执行 facet-api 纪律（错误码、LIFO、发布释放）；
 * 2. host facet 在完整/降级宿主下的注册面；
 * 3. client facet 的注册面与 BR-003 降级；
 * 4. dsh-plugin.json 与 coordinates.ts 的镜像一致（INV-004）。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import hostFacet from '../src/standard/host.ts'
import clientFacet from '../src/standard/client.ts'
import {
  coordKey,
  createActivation,
  defineFacet,
  isFacetDefinition,
  runFacet,
  StandardError,
  type ContractCoordinate,
  type PublishTarget,
} from '../src/standard/sdk.ts'
import {
  CLIENT_OPTIONAL,
  CLIENT_REQUIRED,
  HOST_OPTIONAL,
  HOST_REQUIRED,
  LOCALE,
  PERMISSION_LOOPBACK_FETCH,
  PERMISSION_PROCESS_SPAWN,
  SIDEBAR_TAB,
  SKILL_REGISTRY,
  SYSTEM_PROMPT,
  TOOL_REGISTRY,
  WEB_SERVER,
  type LocaleHandle,
  type ServiceAcquire,
  type SidebarAcquireHandle,
  type SkillRegistryHandle,
  type SystemPromptHandle,
  type WebServerHandle,
  type WebServerLike,
} from '../src/standard/coordinates.ts'
import { registeredToolNames } from '../src/host/tools.ts'
import { ASSET_PREFIX } from '../src/host/assets.ts'
import { SYNC_ROUTE } from '../src/host/sync.ts'
import { RELAY_LAUNCH_ROUTE } from '../src/host/relay-launch.ts'
import { CLAIMED_EXTS } from '../src/tabs/coexist.ts'
import { BROWSER_TAB_ID, FILE_TAB_ID } from '../src/tabs/file-tab.ts'
import { NS } from '../src/tabs/locales.ts'

const X: ContractCoordinate = { apiVersion: 'x-test.demo/v1alpha1', kind: 'Demo' }
const Y: ContractCoordinate = { apiVersion: 'x-test.demo/v1alpha1', kind: 'Optional' }

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn()
    return undefined
  } catch (e) {
    return e instanceof StandardError ? e.code : `not-standard-error: ${String(e)}`
  }
}

describe('standard sdk (facet-api 纪律)', () => {
  it('publish/get on undeclared coordinates → E_CONTRACT_NOT_DECLARED', () => {
    const { activation } = createActivation({ declared: [] })
    expect(codeOf(() => activation.contracts.get(X))).toBe('E_CONTRACT_NOT_DECLARED')
    expect(codeOf(() => activation.extensions.publish(X, 'a', {}))).toBe('E_CONTRACT_NOT_DECLARED')
    expect(activation.contracts.has(X)).toBe(false)
  })

  it('declared-but-absent optional → get throws E_CONTRACT_UNAVAILABLE, has() false', () => {
    const { activation } = createActivation({ declared: [Y] })
    expect(activation.contracts.has(Y)).toBe(false)
    expect(codeOf(() => activation.contracts.get(Y))).toBe('E_CONTRACT_UNAVAILABLE')
  })

  it('duplicate publish of the same (coordinate, id) → E_DUPLICATE_PUBLISH', () => {
    const target: PublishTarget = () => () => {}
    const { activation } = createActivation({
      declared: [X],
      publishTargets: new Map([[coordKey(X), target]]),
    })
    activation.extensions.publish(X, 'same', {})
    expect(codeOf(() => activation.extensions.publish(X, 'same', {}))).toBe('E_DUPLICATE_PUBLISH')
  })

  it('dispose runs scope LIFO, releases publishes, then blocks further use', async () => {
    const order: string[] = []
    const target: PublishTarget = (id) => () => { order.push(`unpublish:${id}`) }
    const controller = createActivation({
      declared: [X],
      publishTargets: new Map([[coordKey(X), target]]),
    })
    const { activation } = controller
    activation.scope.add(() => { order.push('cleanup:first') })
    activation.extensions.publish(X, 'tool', {})
    activation.scope.add(() => { order.push('cleanup:second') })
    await controller.dispose()
    // 未撤回的发布先释放，随后 scope LIFO。
    expect(order).toEqual(['unpublish:tool', 'cleanup:second', 'cleanup:first'])
    expect(codeOf(() => activation.contracts.has(X))).toBe('E_WRONG_STATE')
    await controller.dispose() // 可重复
  })

  it('publish disposal is idempotent and dispose skips released publishes', async () => {
    let released = 0
    const target: PublishTarget = () => () => { released += 1 }
    const controller = createActivation({
      declared: [X],
      publishTargets: new Map([[coordKey(X), target]]),
    })
    const handle = controller.activation.extensions.publish(X, 'once', {})
    handle.dispose()
    handle.dispose()
    await controller.dispose()
    expect(released).toBe(1)
  })

  it('default exports are branded facet definitions', () => {
    expect(isFacetDefinition(hostFacet)).toBe(true)
    expect(isFacetDefinition(clientFacet)).toBe(true)
    expect(isFacetDefinition({ setup() {} })).toBe(false)
    expect(isFacetDefinition(defineFacet(() => {}))).toBe(true)
  })
})

describe('manifest ↔ coordinates 镜像（INV-004）', () => {
  it('dsh-plugin.json requires 与 HOST_REQUIRED/HOST_OPTIONAL 一致', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../dsh-plugin.json'), 'utf8'),
    ) as {
      requires: { contracts: Array<{ apiVersion: string; kind: string; optional?: boolean }> }
      permissions: string[]
    }
    const declaredRequired = manifest.requires.contracts
      .filter((c) => c.optional !== true)
      .map(coordKey)
      .sort()
    const declaredOptional = manifest.requires.contracts
      .filter((c) => c.optional === true)
      .map(coordKey)
      .sort()
    expect(declaredRequired).toEqual([...HOST_REQUIRED].map(coordKey).sort())
    expect(declaredOptional).toEqual([...HOST_OPTIONAL].map(coordKey).sort())
    expect([...manifest.permissions].sort()).toEqual(
      [PERMISSION_LOOPBACK_FETCH, PERMISSION_PROCESS_SPAWN].sort(),
    )
  })

  it('client 声明镜像保持 locale required + sidebar optional（RFC 0002 待declared）', () => {
    expect(CLIENT_REQUIRED.map(coordKey)).toEqual([coordKey(LOCALE)])
    expect(CLIENT_OPTIONAL.map(coordKey)).toEqual([coordKey(SIDEBAR_TAB)])
  })
})

interface FakeRoute {
  kind: 'exact' | 'prefix'
  path: string
}

function fakeWebServer(): { handle: WebServerHandle; routes: FakeRoute[] } {
  const routes: FakeRoute[] = []
  const http: WebServerLike = {
    host: '127.0.0.1',
    port: 3080,
    register(route) {
      const entry: FakeRoute = { kind: route.kind, path: route.path }
      routes.push(entry)
      return () => {
        const at = routes.indexOf(entry)
        if (at >= 0) routes.splice(at, 1)
      }
    },
  }
  const acquire: ServiceAcquire<WebServerLike> = (mount) => {
    const un = mount(http)
    return () => { un() }
  }
  return { handle: { acquire }, routes }
}

describe('host facet', () => {
  function bench(opts: { web?: boolean; prompt?: boolean; skill?: boolean } = {}) {
    const tools = new Map<string, unknown>()
    const target: PublishTarget = (id, impl) => {
      tools.set(id, impl)
      return () => { tools.delete(id) }
    }
    const web = fakeWebServer()
    const sections: Array<{ name: string; order: number; text: string }> = []
    const promptHandle: SystemPromptHandle = {
      section: (spec) => {
        sections.push(spec)
        return () => {
          const at = sections.indexOf(spec)
          if (at >= 0) sections.splice(at, 1)
        }
      },
    }
    const skillRegs: Array<{ name: string }> = []
    const skillHandle: SkillRegistryHandle = {
      register: (skill) => {
        skillRegs.push(skill)
        return () => {
          const at = skillRegs.indexOf(skill)
          if (at >= 0) skillRegs.splice(at, 1)
        }
      },
    }
    const contracts = new Map<string, unknown>()
    if (opts.web !== false) contracts.set(coordKey(WEB_SERVER), web.handle)
    if (opts.prompt !== false) contracts.set(coordKey(SYSTEM_PROMPT), promptHandle)
    if (opts.skill !== false) contracts.set(coordKey(SKILL_REGISTRY), skillHandle)
    const controller = createActivation({
      declared: [...HOST_REQUIRED, ...HOST_OPTIONAL],
      contracts,
      publishTargets: new Map([[coordKey(TOOL_REGISTRY), target]]),
    })
    return { controller, tools, web, sections, skillRegs }
  }

  it('full host: routes + prompt + skill mounted, all tools published once', () => {
    const b = bench()
    runFacet(hostFacet, b.controller.activation)
    expect(b.web.routes).toEqual(expect.arrayContaining([
      { kind: 'prefix', path: ASSET_PREFIX },
      { kind: 'exact', path: SYNC_ROUTE },
      { kind: 'exact', path: RELAY_LAUNCH_ROUTE },
    ]))
    expect(b.sections).toEqual([expect.objectContaining({ name: 'tool:genoffice', order: 150 })])
    expect(b.skillRegs).toEqual([expect.objectContaining({ name: 'dsh-genoffice' })])
    // 资产通道就绪 → 与 available 通道下的注册名单一致（含 insert-image 家族）。
    const expected = registeredToolNames({ assets: { available: true, publish: () => Promise.reject(new Error('n/a')) } })
    expect([...b.tools.keys()].sort()).toEqual([...expected].sort())
  })

  it('degraded host (no optional contracts): publishes the no-webServer tool set, nothing throws', () => {
    const b = bench({ web: false, prompt: false, skill: false })
    runFacet(hostFacet, b.controller.activation)
    expect(b.web.routes).toEqual([])
    expect(b.sections).toEqual([])
    expect(b.skillRegs).toEqual([])
    const expected = registeredToolNames()
    expect([...b.tools.keys()].sort()).toEqual([...expected].sort())
  })

  it('dispose unmounts routes, prompt, skill and unpublishes every tool', async () => {
    const b = bench()
    runFacet(hostFacet, b.controller.activation)
    expect(b.tools.size).toBeGreaterThan(0)
    await b.controller.dispose()
    expect(b.tools.size).toBe(0)
    expect(b.web.routes).toEqual([])
    expect(b.sections).toEqual([])
    expect(b.skillRegs).toEqual([])
  })
})

describe('client facet', () => {
  function bench(opts: { sidebar?: boolean } = {}) {
    vi.stubGlobal('EventSource', class {
      addEventListener(): void {}
      close(): void {}
    })
    const dicts = new Map<string, unknown>()
    const locale: LocaleHandle = {
      bind: () => (key) => key,
      register: (ns, d) => {
        dicts.set(ns, d)
        return () => { dicts.delete(ns) }
      },
    }
    const tabs: Array<{ id: string }> = []
    const viewers: Array<{ id: string; exts: string[] }> = []
    const sidebarService = {
      registerTab(tab: { id: string }) {
        tabs.push(tab)
        return () => {
          const at = tabs.indexOf(tab)
          if (at >= 0) tabs.splice(at, 1)
        }
      },
      registerFileViewer(viewer: { id: string; exts: string[] }) {
        viewers.push(viewer)
        return () => {
          const at = viewers.indexOf(viewer)
          if (at >= 0) viewers.splice(at, 1)
        }
      },
      openTab: vi.fn(),
      getSnapshot: () => ({ sessionId: 's-1' }),
    }
    const sidebar: SidebarAcquireHandle<unknown> = {
      acquire: (mount) => {
        const un = mount(sidebarService)
        return () => { un() }
      },
    }
    const contracts = new Map<string, unknown>([[coordKey(LOCALE), locale]])
    if (opts.sidebar !== false) contracts.set(coordKey(SIDEBAR_TAB), sidebar)
    const controller = createActivation({
      declared: [...CLIENT_REQUIRED, ...CLIENT_OPTIONAL],
      contracts,
    })
    return { controller, dicts, tabs, viewers }
  }

  it('registers dictionaries, both tabs and one viewer per claimed ext', () => {
    const b = bench()
    runFacet(clientFacet, b.controller.activation)
    expect(b.dicts.has(NS)).toBe(true)
    expect(b.tabs.map((t) => t.id)).toEqual([BROWSER_TAB_ID, FILE_TAB_ID])
    expect(b.viewers.map((v) => v.id)).toEqual(CLAIMED_EXTS.map((ext) => `dsh-genoffice:viewer-${ext}`))
  })

  it('sidebar absent → dictionaries only, no UI registrations (BR-003)', () => {
    const b = bench({ sidebar: false })
    runFacet(clientFacet, b.controller.activation)
    expect(b.dicts.has(NS)).toBe(true)
    expect(b.tabs).toEqual([])
    expect(b.viewers).toEqual([])
  })

  it('dispose unregisters everything', async () => {
    const b = bench()
    runFacet(clientFacet, b.controller.activation)
    await b.controller.dispose()
    expect(b.dicts.size).toBe(0)
    expect(b.tabs).toEqual([])
    expect(b.viewers).toEqual([])
  })
})
