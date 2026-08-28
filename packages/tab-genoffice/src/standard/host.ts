/**
 * GenOffice 的 host facet（dsh-community-standard 形态的插件主体）。
 *
 * `export default defineFacet(...)`：manifest（dsh-plugin.json）的
 * facets.host.entry 指向本模块的构建产物 lib/standard/host.js。
 * 生产路径同样走这里——官方 dsh 入口（src/index.ts）只是
 * cordis 适配器 + runFacet 两行胶水（倒装：主体依赖标准三面，
 * cordis 耦合被赶进 src/standard/cordis-*.ts）。
 *
 * 依赖声明（与 dsh-plugin.json requires 镜像，INV-004）：
 * - ToolRegistry（required）：94 个控制/打开工具经 extensions.publish 发布；
 * - SystemPrompt / SkillRegistry / WebServer（optional）：缺席时按声明降级——
 *   无提示词段、无 skill 目录项、无 sync/relay-launch/asset 路由（插图工具随
 *   资产通道不可用而不注册）。
 */
import { createAssetChannelFrom } from '../host/assets.ts'
import { buildGenOfficePromptText, PROMPT_SECTION } from '../host/prompt.ts'
import {
  GENOFFICE_SKILL_CONTENT,
  GENOFFICE_SKILL_DESCRIPTION,
  GENOFFICE_SKILL_NAME,
} from '../host/skill.ts'
import { handleSyncRequest, SYNC_ROUTE } from '../host/sync.ts'
import { handleRelayLaunchRequest, RELAY_LAUNCH_ROUTE } from '../host/relay-launch.ts'
import { createControlTools } from '../host/tools.ts'
import { defineFacet } from './sdk.ts'
import {
  SKILL_REGISTRY,
  SYSTEM_PROMPT,
  TOOL_REGISTRY,
  WEB_SERVER,
  type SkillRegistryHandle,
  type SystemPromptHandle,
  type WebServerHandle,
} from './coordinates.ts'

export default defineFacet((activation) => {
  const { contracts, scope, extensions } = activation

  const web = contracts.has(WEB_SERVER) ? contracts.get<WebServerHandle>(WEB_SERVER) : undefined

  const assets = createAssetChannelFrom(web?.acquire)
  scope.add(() => { assets.dispose() })

  if (web !== undefined) {
    scope.add(web.acquire((http) => http.register({
      kind: 'exact',
      path: SYNC_ROUTE,
      handler: (req, res) => { void handleSyncRequest(req, res) },
    })))
    scope.add(web.acquire((http) => http.register({
      kind: 'exact',
      path: RELAY_LAUNCH_ROUTE,
      handler: (req, res) => { void handleRelayLaunchRequest(req, res) },
    })))
  }

  if (contracts.has(SYSTEM_PROMPT)) {
    scope.add(contracts.get<SystemPromptHandle>(SYSTEM_PROMPT).section({
      ...PROMPT_SECTION,
      text: buildGenOfficePromptText(),
    }))
  }

  if (contracts.has(SKILL_REGISTRY)) {
    scope.add(contracts.get<SkillRegistryHandle>(SKILL_REGISTRY).register({
      name: GENOFFICE_SKILL_NAME,
      description: GENOFFICE_SKILL_DESCRIPTION,
      content: GENOFFICE_SKILL_CONTENT,
      source: 'runtime',
    }))
  }

  for (const tool of createControlTools({ assets })) {
    extensions.publish(TOOL_REGISTRY, tool.name, tool)
  }
})
