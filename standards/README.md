# standards/ —— dsh-community-standard v0.15 对齐面

对齐 [oh-my-dsh/dsh-community-standard](https://github.com/oh-my-dsh/dsh-community-standard)（社区 Draft v0.15，非官方标准）。策略是**纪律与形状都先行、坐标殿后**：manifest 静态化、协商前置、fixture 文化、branded facet、SDK 面收敛现在就做；x- 私有坐标等 Registry 定案后做一次映射替换，届时插件主体零改动。

```sh
npm run standard:check           # = node standards/validate.mjs（六环节，见下）
node standards/validate.mjs --update-baseline   # 评审后固化 adapter 基线
```

## 内容

| 文件/目录 | 作用 |
|---|---|
| `validate.mjs` | 自包含检查器，六环节：manifest 校验 → facet 入口装载检查（entry 存在/无私有 import/品牌默认导出）→ 纯函数协商（v0.15 报告）→ manifest fixtures → 协商 fixtures（五结局）→ adapter 审计 |
| `dsh-plugin.schema.json` / `host-descriptor.schema.json` | 上游 schema 本地快照（仅参考；本仓权威校验在 validate.mjs） |
| `host-descriptor.json` | profile `go` 的部署描述（:3080，DSH 0.1.2-rc.1），含 `apiVersions` 与五条 capabilities |
| `adapter-baseline.json` | packages/*/src 的上游 import 基线（新增触点须评审） |
| `fixtures/` | `valid/` 与 `invalid/`：manifest 样本，每条「必须」配一个违反它的样本；`facet/`：装载检查样本；`negotiation/`：五结局四件套（manifest × descriptor × registry × expected-report） |
| `registry/` | 六条 x- 契约的本地注册表镜像（JSON 供协商器加载 + md 语义卡片），含 sensitivity 档位与 [permissions.md](./registry/permissions.md) |
| `contributions/` | 供上游征求意见期的三份草稿（0001 宿主服务 / 0002 client facet / 0003 sensitivity+permissions） |

manifest 本体在 `packages/tab-genoffice/dsh-plugin.json`（标准文件名带连字符；与官方装载用的 `dsh.plugin.json` 是两份文件、两套生态，互不覆盖）。host facet 入口即标准层构建产物 `lib/standard/host.js`。

## 标准层（packages/tab-genoffice/src/standard/）

插件主体已按标准形状重写，Cordis 只出现在适配器里：

| 文件 | 角色 |
|---|---|
| `sdk.ts` | dsh-community-standard facet 面的本地垫片：`defineFacet` / `FacetActivation`（extensions·scope·contracts 三面）/ `StandardError` 错误码 / LIFO 停用。Registry 定案后整文件换成官方 SDK 依赖 |
| `coordinates.ts` | 六条 x- 坐标常量 + 句柄接口（SDK 面刻意小于宿主实现面）；与 manifest/registry 镜像一致，测试看住 |
| `host.ts` / `client.ts` | 两半身的 facet 主体（branded 默认导出，零上游 import，只消费 FacetActivation） |
| `cordis-host-adapter.ts` / `cordis-client-adapter.ts` / `cordis-acquire.ts` | Cordis → FacetActivation 的全部映射；`acquireFromCordis` 封装 lookup-or-inject 延迟绑定 |

`src/index.ts` 与 `src/client/index.ts` 只剩「适配器 + runFacet」薄壳。专项测试：`tests/standard-facet.spec.ts`。

## 本仓声明的私有契约坐标（x- 命名空间，未经 Registry 登记）

坐标级细节（服务面、生命周期、降级路径、sensitivity 理由）在 [`registry/`](./registry/README.md)：

| 坐标 | kind | facet | requires | sensitivity |
|---|---|---|---|---|
| `x-nothing1024.dsh.tools/v1alpha1` | ToolRegistry | host | required | medium |
| `x-nothing1024.dsh.system-prompt/v1alpha1` | SystemPrompt | host | optional | medium |
| `x-nothing1024.dsh.skills/v1alpha1` | SkillRegistry | host | optional | low |
| `x-nothing1024.dsh.web-server/v1alpha1` | WebServer | host | optional | medium |
| `x-nothing1024.dsh.locale/v1alpha1` | Locale | client | （RFC 0002 定案后进 manifest） | low |
| `x-nothing1024.better-sidebar/v1alpha1` | SidebarTab | client（host 侧 optional 声明） | optional | low |

permissions（契约之外的环境能力）：`x-nothing1024.net.loopback-fetch`、`x-nothing1024.process.spawn`，语义与降级见 [registry/permissions.md](./registry/permissions.md)。

## 已知缺口（对应上游延期 RFC）

- **RFC 0002（client facet）**：client 半身已写成 branded facet（`src/standard/client.ts`）经适配器在官方 client bundle 内执行；v0.15 里 `client` 是保留 facet 名**不可声明**，manifest 只覆盖 host 半身。定案后 manifest 加 `facets.client` 三行即可，主体零改动（田野报告见 contributions/0002）。
- **RFC 0005（views 贡献点）**：better-sidebar 页签属于第三方 UI 槽位，不在 v0.16 草案的 `contributes.views` location 枚举里，暂以契约坐标声明。
- **外部进程依赖**：GenOffice relay（:8787）与 `../engine` 引擎是部署级依赖，超出插件-宿主契约范围，由 `scripts/dev.mjs` 与侧栏「启动 relay」降级路径兜底；网络/子进程触达已以 permissions 显式化。
