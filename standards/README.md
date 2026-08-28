# standards/ —— dsh-community-standard v0.15 对齐面

对齐 [oh-my-dsh/dsh-community-standard](https://github.com/oh-my-dsh/dsh-community-standard)（社区 Draft v0.15，非官方标准）。策略是**先采其纪律、后接其契约**：manifest 静态化、协商前置、fixture 文化、上游触点显式化现在就做；标准坐标等 Registry 定案后做一次映射替换。

```sh
npm run standard:check           # = node standards/validate.mjs
node standards/validate.mjs --update-baseline   # 评审后固化 adapter 基线
```

## 内容

| 文件 | 作用 |
|---|---|
| `validate.mjs` | 自包含检查器：manifest 校验 + 纯函数协商 + fixtures 自检 + adapter 审计 |
| `dsh-plugin.schema.json` / `host-descriptor.schema.json` | 上游 schema 本地快照（仅参考；本仓权威校验在 validate.mjs） |
| `host-descriptor.json` | profile `go` 的部署描述（:3080，DSH 0.1.0-rc.7） |
| `adapter-baseline.json` | packages/*/src 的上游 import 基线（新增触点须评审） |
| `fixtures/` | 合法/非法 manifest 样本，每条"必须"配一个违反它的样本 |

manifest 本体在 `packages/tab-genoffice/dsh-plugin.json`（标准文件名带连字符；与官方装载用的 `dsh.plugin.json` 是两份文件、两套生态，互不覆盖）。

## 本仓声明的私有契约坐标（x- 命名空间，未经 Registry 登记）

| 坐标 | kind | 语义 | 提供方 |
|---|---|---|---|
| `x-nothing1024.dsh.tools/v1alpha1` | ToolRegistry | `ctx.tools`（genoffice 控制工具注册在 host 半身） | DSH 宿主 |
| `x-nothing1024.dsh.system-prompt/v1alpha1` | SystemPrompt | `ctx.systemPrompt` | DSH 宿主 |
| `x-nothing1024.dsh.web-server/v1alpha1` | WebServer | `ctx.webServer`（relay 路由 `/dsh-artifact/genoffice-relay`） | DSH 宿主 |
| `x-nothing1024.better-sidebar/v1alpha1` | SidebarTab | `ctx.betterSidebar` 页签注册（optional peer；缺席时插件照常激活、无页签） | dsh-better-sidebar@0.13.0 |

## 已知缺口（对应上游延期 RFC）

- **RFC 0002（client facet）**：tab-genoffice 是典型双半身插件（host 半身注册工具与 relay 路由，client 半身 `lib/client.js` 渲染文件浏览器与 docx/xlsx/pptx 预览，经 `package.json` 的 `dsh.client` 发现）。v0.15 里 `client` 是保留 facet 名**不可声明**，manifest 只覆盖 host 半身——这正是上游 RFC 0001 §1 说的"12 个样本中 9 个双 face"常态，等 RFC 0002 定案后补齐。
- **RFC 0005（views 贡献点）**：better-sidebar 页签属于第三方 UI 槽位，不在 v0.16 草案的 `contributes.views` location 枚举里，暂不声明。
- **外部进程依赖**：GenOffice relay（:8787）与 `../engine` 引擎是部署级依赖，超出插件-宿主契约范围，由 `scripts/dev.mjs` 与侧栏「启动 relay」降级路径兜底。
