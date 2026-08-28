/**
 * host facet 的 cordis 适配器：把 dsh 宿主的私有服务面映射成
 * 标准 activation 的三个面。本插件里 cordis（host 侧）的耦合止步于此。
 *
 * 与部署描述（standards/host-descriptor.json）的关系：contracts.has 对
 * SystemPrompt / SkillRegistry / WebServer 恒答「有」——profile go 的
 * descriptor 声明了这四条能力，而 dsh 服务可能晚于插件激活到位，句柄
 * 内部用 acquireFromCordis 做延迟绑定；服务永不出现时 mount 不跑，
 * 等价于声明过的降级路径（一致性讨论见 standards/contributions/）。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { lookupSkills, lookupSystemPrompt, lookupWebServer } from '../host/lookup.ts'
import { acquireFromCordis, type CordisLike } from './cordis-acquire.ts'
import {
  HOST_OPTIONAL,
  HOST_REQUIRED,
  SKILL_REGISTRY,
  SYSTEM_PROMPT,
  TOOL_REGISTRY,
  WEB_SERVER,
  type SkillRegistryHandle,
  type SystemPromptHandle,
  type WebServerHandle,
  type WebServerLike,
} from './coordinates.ts'
import { coordKey, createActivation, type ActivationController, type PublishTarget } from './sdk.ts'

/** dsh-tools 服务的最小注册面（真实服务返回卸载函数；测试替身可能返回 void）。 */
interface ToolRegistrarLike {
  tools: { register(definition: unknown): unknown }
}

export function createHostActivation(ctx: Context): ActivationController {
  const cordis = ctx as unknown as CordisLike

  const systemPrompt: SystemPromptHandle = {
    section: (spec) =>
      acquireFromCordis(cordis, () => lookupSystemPrompt(ctx), 'systemPrompt')(
        (sp) => sp.section(spec),
      ),
  }

  const skills: SkillRegistryHandle = {
    register: (skill) =>
      acquireFromCordis(cordis, () => lookupSkills(ctx), 'skills')(
        (service) => service.register(skill),
      ),
  }

  const webServer: WebServerHandle = {
    acquire: acquireFromCordis<WebServerLike>(
      cordis,
      () => lookupWebServer(ctx) as WebServerLike | undefined,
      'webServer',
    ),
  }

  const registerTool: PublishTarget = (_id, implementation) => {
    const off = (ctx as unknown as ToolRegistrarLike).tools.register(implementation)
    return typeof off === 'function' ? (off as () => void) : undefined
  }

  return createActivation({
    declared: [...HOST_REQUIRED, ...HOST_OPTIONAL],
    contracts: new Map<string, unknown>([
      [coordKey(SYSTEM_PROMPT), systemPrompt],
      [coordKey(SKILL_REGISTRY), skills],
      [coordKey(WEB_SERVER), webServer],
    ]),
    publishTargets: new Map([[coordKey(TOOL_REGISTRY), registerTool]]),
    onScopeAdd: (dispose) => {
      cordis.effect(() => () => { void dispose() }, 'dsh-tab-genoffice: standard scope')
    },
  })
}
