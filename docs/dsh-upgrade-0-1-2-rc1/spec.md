# dsh-upgrade-0-1-2-rc1 Spec

> Version: 0.1.0 | Date: 2026-09-05 | Status: Ready

本文件是本需求的**唯一事实源**：事实基线、业务合同、技术方案、任务计划、验收协议全部在此。当前会话直接执行本包，不生成 handoff.md（shared-rules §10：交给别的 Agent/另开会话才生成）。

填写三态规则：每个表格单元格只允许——1. 验证过的事实（注明来源命令）；2. 显式假设 `ASM-xxx`；3. `待勘察`。

---

## 0. 一页纸人话摘要

- **给谁 / 场景**：`dsh-genoffice` 插件的维护者（自己），在 DSH 宿主平台（deepseek-harness）发布新版本后需要让插件继续兼容。
- **做什么**：把插件工程从锁定的 DSH `0.1.0-rc.7` 升级到 `0.1.2-rc.1`，并同步升级插件依赖的第三方侧栏插件 `dsh-better-sidebar` 到 `0.18.0`（它是官方架构重写后重新适配 0.1.2-rc.1 的正式版）。
- **改哪里**：5 处版本号声明文件（workspace overrides、插件 package.json、开发环境 profile、README）+ 2 处插件源码里的 client 类型导入（因为上游删除了 `@deepseek-ai/dsh-client-runtime` 这个包）。
- **怎么算做完**：`pnpm install` + `typecheck` + `build` 全绿，本地起一个真实的 DSH 网关（`env/boot.sh`），侧栏能看到 GenOffice 的 tab、点开能正常打开文件、relay 状态正常，且插件在 pluginInventory 里 `fiberPhase` 是 `active`（不是白屏或加载失败）。
- **不做什么**：不追新到最新版 `0.1.3-alpha.1`（那是 alpha 通道，风险更高，本次先小步升到 `0.1.2-rc.1` 这个 rc 通道）；不改插件的业务逻辑（file-tab/docx 预览/relay 等功能行为不变）；不改 host 侧代码（已确认 host 侧 6 个上游包在此区间无破坏性变更）。

---

## 1. 事实基线与假设

### 1.1 需求与运行模式

| 项 | 结论 |
|---|---|
| 原始需求 | 用户在上一轮对话中已完成 DSH 升级兼容性调研（Phase 1-3），本轮要求「oneclick 规划一口气更新完」——即把已确认的升级方案落成可执行任务包并执行 |
| 输入类型 | 上下文（本会话前序调研结论，非新的需求描述） |
| Mode | oneclick |
| 置信度 | 高（前序调研已用 gh CLI 逐版本核实，未编造） |
| 输出目录 | `docs/dsh-upgrade-0-1-2-rc1/` |

### 1.2 任务类型路由

| 维度 | 结论 |
|---|---|
| 任务类型 | infra（依赖版本升级，非新功能）+ 少量 refactor（2 处 import 改型） |
| 主要风险 | Cordis Loader 加载期爆炸（模块解析失败/服务注入不存在导致 web 端白屏，见 dsh-upgrade-compat skill 的致命风险警告）；`dsh-better-sidebar` 与 DSH 版本 peer 不匹配 |
| 行号引用策略 | 中等（infra 类型），但改动点少，均已定位到精确行号 |
| 必需验收方式 | typecheck/build（命令级）+ 真实冒烟启动网关观察 web UI（infra 类真实场景） |
| 必须覆盖用户场景 | UF-001（插件加载不炸网关）、UF-002（GenOffice 侧栏 tab 功能在新版本下可用） |

### 1.3 勘察事实清单

> 全部来自本会话前序 Phase 1-3 调研中实际执行的 `gh api` / `npm view` / 本地文件读取命令。

| 事实 | 来源命令 | 输出摘要 |
|---|---|---|
| 插件当前所有 `@deepseek-ai/dsh-*` 依赖锁定在 `0.1.0-rc.7` | `cat plugin/pnpm-workspace.yaml` | `overrides` 块 62 条包全部 `0.1.0-rc.7`；`minimumReleaseAgeExclude` 同步列出，末尾含 `dsh-better-sidebar@0.13.0` |
| 上游可用 tag 列表（新到旧） | `gh api repos/deepseek-ai/deepseek-harness/tags --paginate --jq '.[].name' \| grep '^dsh-v'` | `dsh-v0.1.3-alpha.1, 0.1.2-rc.1, 0.1.2-alpha.1~5, 0.1.1-rc.1/2, 0.1.0-rc.8/7` |
| 目标版本用户已选定 | AskUserQuestion 交互结果 | `0.1.2-rc.1` |
| `@deepseek-ai/dsh-client-runtime` 包在 rc.7~1.1-rc.2 存在，1.2-alpha.1 起被删除 | `gh api "repos/deepseek-ai/deepseek-harness/contents/packages/client/runtime?ref=<tag>" -i` 逐 tag 探测 | rc.7/rc.8/1.1-rc.1/1.1-rc.2 返回 200；1.2-alpha.1~5 全部 404 |
| 该包删除于单个巨型 commit | `gh api repos/deepseek-ai/deepseek-harness/commits?path=packages/client/runtime&sha=master` | commit `be531688`「refactor(client): migrate consumers and remove Runtime」，2026-08-22 |
| 新架构下 `ClientContext` 改为直接来自 `@deepseek-ai/cordis` 的 `Context` | `gh api "repos/deepseek-ai/deepseek-harness/contents/packages/client/ui-sidebar/src/client/index.ts?ref=dsh-v0.1.2-rc.1"` | `import type { Context as ClientContext } from '@deepseek-ai/cordis'` |
| `ctx.locale.bind()`/`ctx.locale.register()` 调用形态未变；`./client` subpath export 仍在 | general-purpose agent 调查（读 `packages/client/locale/src/client/index.ts` 两版本对比 + `package.json` exports 字段） | 方法签名一致；`FALLBACK_LOCALE` 从 `'zh'` 改为 `'en'`（插件双语词典完整，实际不触发） |
| host 侧 6 个包（`cordis`/`dsh-tools`/`dsh-llm`/`dsh-system-prompt`/`dsh-host-webserver`）在此区间**均无破坏性变更** | general-purpose agent 调查（逐包读两版本源码对比） | `defineTool`/`ParameterSchemaSpec`/`BlockAssembler`/`createUserMessage`/`GenerateOptions`/`StreamChunk` 结构不变；仅内部 `CallId`→`ToolCallId` 品牌类型改名，插件未引用 |
| 插件源码全仓库未引用 `CallId` | `grep -rn "CallId" packages/tab-genoffice/src` | 零命中 |
| `dsh-better-sidebar` 必须同步升级到 `0.18.0` | `npm view dsh-better-sidebar@<v> peerDependencies --json` 逐版本核对 + `gh api repos/omdsh-dev/DSH-better-sidebar/releases/tags/v0.18.0` | 0.18.0 起 peer 下限 `^0.1.2-rc.1`，明确"不再支持 0.1.0-rc.8~0.1.1-rc.2"；0.17.1 是双版本兼容过渡版 |
| `BetterSidebarService` 接口在插件实际使用面（`registerTab`/`registerFileViewer`/`openTab`/`getSnapshot`）完全兼容 | `npm pack dsh-better-sidebar@0.13.0/@0.18.0` 后 `diff service.d.ts` | 仅新增字段（`revealed`、`onReferenceFile` 新增 `isDir` 参数、`floatWindows` feature），插件未用到这些字段 |
| `cordis.patch.yml`（本插件）无 `!!js` 表达式，无品牌类型跨版本断裂风险点 | `cat packages/tab-genoffice/cordis.patch.yml` | 仅一个 `insert` 行，无 `config:`/`!!js` |
| 待改动的精确行号：`pnpm-workspace.yaml` | `grep -n "^overrides:\|^minimumReleaseAgeExclude:\|dsh-better-sidebar" pnpm-workspace.yaml` | `overrides:` L7；`minimumReleaseAgeExclude:` L73；`dsh-better-sidebar@0.13.0` L133 |
| 待改动的精确行号：`packages/tab-genoffice/package.json` | `grep -n "devDependencies\|peerDependencies\|@deepseek-ai/dsh-client-runtime\|dsh-better-sidebar" packages/tab-genoffice/package.json` | `devDependencies` L36；`@deepseek-ai/dsh-client-runtime` L39 devDeps / L56 peerDeps；`dsh-better-sidebar` L47 devDeps / L63 peerDeps；`peerDependenciesMeta.dsh-better-sidebar` L68；`dsh.client.inject` 数组含 `@deepseek-ai/dsh-client-runtime` L76 |
| 待改动的精确行号：`src/client/index.ts` | `grep -n "ClientContext\|import" packages/tab-genoffice/src/client/index.ts` | L9 `import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'` |
| 待改动的精确行号：`src/standard/cordis-client-adapter.ts` | `grep -n "ClientContext\|import" packages/tab-genoffice/src/standard/cordis-client-adapter.ts` | L6 同上；L20 `export function createClientActivation(ctx: ClientContext)` |
| 开发环境 profile 同样锁定旧版本 | `cat env/README.md`、`cat env/profiles/go/package.json`、`cat env/profiles/go/pnpm-workspace.yaml` | `env/README.md` L18/19/26；`env/profiles/go/package.json` 全文（`dependencies` 4 行 + `dsh.profile.bundles` 4 行）；`env/profiles/go/pnpm-workspace.yaml` L14-16 `overrides` |
| `standards/host-descriptor.json` 的 `$comment` 字段以人话记录了当前版本号 | `cat standards/host-descriptor.json` | L2 `$comment` 提到 "DSH 0.1.0-rc.7" 和 "dsh-better-sidebar@0.13.0" |
| 测试文件里没有对 `dsh-client-runtime` 的直接依赖（用手搭 fake ctx，非该包） | `grep -n "dsh-client-runtime\|dsh-client-test-runtime\|ClientContext\|import" packages/tab-genoffice/tests/integration.spec.tsx` | 仅注释提到 `dsh-client-test-runtime`（说明其不可在纯 Node 环境跑，本身用轻量 fake ctx 替代），无需修改 |
| 本地构建/验证命令 | `cat packages/tab-genoffice/package.json` scripts 段 + 根 `package.json` scripts 段 | 根：`npm run typecheck --workspaces`、`npm run build --workspaces`、`npm run test --workspaces`；子包：`tsc -p tsconfig.json`（typecheck）、`tsc -p tsconfig.build.json && tsdown`（build）、`vitest run`（test） |
| 冒烟启动命令 | `cat env/README.md` | `pnpm install && pnpm run build && sh env/setup.sh` 然后 `sh env/boot.sh`（起 `:3080`）；relay 另起 `node scripts/dev.mjs start-relay` |
| 工作区当前 git 状态干净，可安全改动 | `git status` / `git log --oneline -3` | `nothing to commit, working tree clean`，HEAD 为 `d7428532` |

### 1.4 假设清单

| 假设 ID | 内容 | 风险 | 确认方式 |
|---|---|---|---|
| ASM-001 | `dsh-better-sidebar@0.18.0` 与 `@deepseek-ai/dsh@0.1.2-rc.1` 组合可以从 npm 正常安装（0.18.0 release notes 提到 DSH rc.x 发布在 npm `next` dist-tag，存在 dist-tag 错配风险） | 中——如果 `@deepseek-ai/dsh@0.1.2-rc.1` 不在 `latest` dist-tag，`pnpm install` 可能解析不到，需要显式指定版本号（已在 pnpm-workspace.yaml overrides 显式钉版本，风险降低但仍需安装时验证） | Task 6（`pnpm install`）执行结果 |
| ASM-002 | `env/profiles/go` 下的 `node_modules`/`pnpm-lock.yaml` 需要随版本号变化重新安装，而非仅改 `package.json` | 低——`pnpm install` 会按 lockfile/overrides 重新解析，属常规操作 | Task 6/7 执行结果 |

### 1.5 变更记录

首次生成，无历史变更。

---

## 2. 业务合同

### 2.1 BR 业务规则

| 规则 ID | 规则 | 正例 | 反例 | 影响范围 | 验证方式 |
|---|---|---|---|---|---|
| BR-001 | 插件升级后，DSH 网关必须能正常启动，web UI 不得白屏 | 网关启动日志无异常，浏览器打开 `:3080` 正常渲染界面 | 网关启动抛出模块解析异常，或 web UI 白屏 | 全局（防爆红线，见 dsh-upgrade-compat skill 的致命风险警告） | 冒烟启动 + 浏览器打开 |
| BR-002 | 插件在 pluginInventory 中必须显示为 `active`，不得挂起或失败 | `fiberPhase: active` | `fiberPhase: pending`/`failed` | 插件加载 | pluginInventory 检查（浏览器 DevTools 或 DSH 内建设置页） |
| BR-003 | GenOffice 侧栏 tab 的既有功能（打开文件、docx/xlsx/pptx 预览、relay 状态提示）在升级后行为不变 | 侧栏能看到 GenOffice tab，点击能打开文件浏览器，双击文档能进入预览 | 侧栏 tab 消失、点击无响应、预览报错 | 用户可见功能（INV-001 的具体化） | 真实浏览器点击 + `pnpm test` 回归 |
| BR-004 | `typecheck`/`build` 命令必须在新版本依赖下全绿，不得因类型断裂而报错 | `tsc -p tsconfig.json` 退出码 0 | 报 `Cannot find module '@deepseek-ai/dsh-client-runtime/client'` 等错误 | 编译期（L1 断裂防线） | `npm run typecheck --workspaces` |

### 2.2 UF 用户验收场景（索引）

| 场景 ID | Given | When | Then | 角色 | 验证方式 | Evidence |
|---|---|---|---|---|---|---|
| UF-001 | 插件依赖已升级到 0.1.2-rc.1 组合，本地 `env/` 已重新 setup | 执行 `sh env/boot.sh` 启动网关 | 网关正常启动，浏览器打开 web UI 无白屏，插件 `fiberPhase` 为 `active` | 插件维护者（自己） | manual | EVD-001 |
| UF-002 | 网关已正常启动 | 在侧栏点击 GenOffice tab，浏览文件列表，双击一个已知文档 | 侧栏 tab 正常显示、文件列表可浏览、双击后进入 docx/xlsx/pptx 的 control-mode 预览且渲染正常 | 插件维护者（自己） | manual | EVD-002 |

### 2.3 核心业务流程（步骤级交互脚本）

#### UF-001: 升级后网关冒烟启动

**前置状态**：插件工程 5 处版本号文件已改为 `0.1.2-rc.1` / `dsh-better-sidebar@0.18.0`，2 处源码 import 已改为 `@deepseek-ai/cordis` 的 `Context`；`pnpm install` 已成功执行；`env/` 已重新 `setup.sh`。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 在终端执行 `sh env/boot.sh` | 终端打印启动日志 | Cordis Loader 依次加载 `dsh-base`→`dsh-web-app`→`dsh-better-sidebar`→`dsh-tab-genoffice` 各 bundle | 终端显示网关已在 `:3080` 监听，无异常堆栈 |
| 2 | 浏览器打开 `http://localhost:3080` | 页面开始加载 | Web Client 引导脚本执行、各 client 插件 `apply()` 依次激活 | 页面正常渲染出 DSH 主界面（对话框、侧栏），无白屏、无控制台报错弹窗 |
| 3 | 打开浏览器设置页里的插件清单（或用 `dsh` CLI 查询） | — | 读取 pluginInventory | `dsh-tab-genoffice` 一行显示 `fiberPhase: active` |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 模块解析失败 | 某处 import 仍指向已删除的 `@deepseek-ai/dsh-client-runtime` | 终端启动报错，或 web UI 白屏 | Cordis Loader 加载链中断 | 按 preflight-checks.md「方法 1：cordis.patch.yml 加 `disabled: true`」临时禁用插件，回读报错堆栈定位遗漏的 import，修复后重启 |
| peer 版本不匹配 | `dsh-better-sidebar` 与 DSH 版本 peer 冲突（ASM-001 落空） | `pnpm install` 报 peer dependency 冲突警告/错误 | 依赖解析失败 | 显式在 `pnpm-workspace.yaml` overrides 钉死具体可用的 `@deepseek-ai/dsh` 版本号，重新 `pnpm install` |

**界面状态机**：

```text
booting → active（web UI 正常）
    |
    v
  crashed（白屏/启动报错，回退到 preflight-checks 应急恢复）
```

**入口接线清单**：

- `sh env/boot.sh` → `env/profiles/go/cordis.yml`（读取 profile bundle 列表）→ 浏览器 `http://localhost:3080`

#### UF-002: GenOffice 侧栏功能真实回放

**前置状态**：UF-001 已通过，网关正常运行；relay 已通过 `node scripts/dev.mjs start-relay` 启动。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 点击侧栏 GenOffice tab 图标 | tab 面板展开 | 前端调用 relay `/api/dir` 获取文件列表 | 文件浏览器面板显示当前目录文件树 |
| 2 | 双击一个 `.docx`（或 `.xlsx`/`.pptx`）文件 | 打开一个新的 file tab，短暂 loading | `matchFileViewer` 命中 `DocxControlViewer`，走 control-mode 预览 | 文档以 control-mode 方式渲染出来，无报错 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| relay 未启动 | `:8787` 无进程 | 侧栏显示「启动 relay」引导入口（BR-003 既有降级行为） | `isRelayLaunchConfigured` 检测 `DSH_GENOFFICE_ROOT` | 点击「启动 relay」按钮，或手动 `node scripts/dev.mjs start-relay` |
| `dsh-better-sidebar` 服务未就绪（optional peer 缺席） | betterSidebar 服务未激活 | 侧栏无 GenOffice tab（按 BR-003 的既有跳过注册行为，不崩溃） | `contracts.has(SIDEBAR_TAB)` 为 false，`client.ts` 直接 return | 确认 `dsh-better-sidebar@0.18.0` 已正确装入该 profile 的 bundle 列表 |

**界面状态机**：

```text
idle → tab-open → viewer-loading → viewer-ready
                          |
                          v
                     viewer-error（预览报错，见 Task 详情排障）
```

**入口接线清单**：

- 侧栏 GenOffice tab（`BROWSER_TAB_ID`）→ `genoffice.tsx` 面板 → 双击文件 → `matchFileViewer` → `DocxControlViewer`

### 2.4 INV 不变量

| 不变量 ID | 内容 | 关联 BR/UF | 验证方式 |
|---|---|---|---|
| INV-001 | 升级过程不改变插件对外的业务行为（file-tab、docx/xlsx/pptx 预览、relay 交互协议），仅改动版本号声明与因包删除被迫更换的类型来源 | BR-003 | `pnpm test --workspaces`（既有 16 个 spec 全部保持通过）+ UF-002 真实回放 |
| INV-002 | host 侧代码（`src/host/*.ts`）零改动——已确认该区间上游 host 包无破坏性变更 | BR-004 | `git diff --stat packages/tab-genoffice/src/host` 应为空 |

### 2.5 EVD 证据清单

| 证据 ID | 类型 | 期望证据 | 保存位置 |
|---|---|---|---|
| EVD-001 | log | `sh env/boot.sh` 启动日志（无异常）+ pluginInventory 截图/输出（`fiberPhase: active`） | `evidence/UF-001/boot.log` + `evidence/UF-001/plugin-inventory.png`（或文本输出） |
| EVD-002 | screenshot | 侧栏 GenOffice tab 打开、文件列表、docx 预览三张截图 | `evidence/UF-002/` |
| EVD-003 | log | `npm run typecheck --workspaces` 与 `npm run build --workspaces` 完整输出 | `evidence/phase-0/typecheck-build.log` |
| EVD-004 | log | `npm run test --workspaces` 完整输出（既有 16 个 spec） | `evidence/phase-0/test.log` |

### 2.6 角色与权限矩阵

单一角色，无权限差异（插件维护者本人在本地开发环境操作）。

### 2.7 负向 / 破坏性场景

| 场景 | Given | When | Then | Evidence |
|---|---|---|---|---|
| 依赖版本冲突 | `dsh-better-sidebar@0.18.0` 与钉死的 `@deepseek-ai/dsh@0.1.2-rc.1` peer 不匹配 | `pnpm install` | 报 peer 冲突，需按 UF-001 失败分支处理 | `evidence/phase-0/pnpm-install.log` |
| 遗漏的 import 未改 | 仍有文件引用 `@deepseek-ai/dsh-client-runtime` | `npm run typecheck --workspaces` | 报 `Cannot find module`，需全仓库 grep 补漏 | `evidence/phase-0/typecheck-build.log` |
| 旧数据兼容 | N/A——本次升级不涉及持久化数据格式变更 | — | — | — |

### 2.8 非目标

- 不升级到最新 `0.1.3-alpha.1`（alpha 通道风险更高，本次先落地 rc 通道）。
- 不改动插件业务逻辑代码（`src/tabs/*`、`src/host/*` 除已确认无需改动的部分）。
- 不引入新功能或新依赖包。

---

## 3. 技术方案

### 3.1 架构 Before / After

```text
Before:
  pnpm-workspace.yaml overrides: @deepseek-ai/dsh-* = 0.1.0-rc.7, dsh-better-sidebar@0.13.0
  packages/tab-genoffice/package.json: peerDeps/devDeps 锁 0.1.0-rc.6/rc.7
  src/client/index.ts, src/standard/cordis-client-adapter.ts:
    import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'  ← 包已删除
  env/profiles/go: 同样锁 0.1.0-rc.7 / dsh-better-sidebar@0.13.0

After:
  pnpm-workspace.yaml overrides: @deepseek-ai/dsh-* = 0.1.2-rc.1, dsh-better-sidebar@0.18.0
  packages/tab-genoffice/package.json: peerDeps/devDeps 同步升级；devDeps/peerDeps/dsh.client.inject 中
    移除 @deepseek-ai/dsh-client-runtime 条目
  src/client/index.ts, src/standard/cordis-client-adapter.ts:
    import type { Context as ClientContext } from '@deepseek-ai/cordis'  ← 新架构下的正确来源
  env/profiles/go + env/README.md + standards/host-descriptor.json: 同步升级版本号说明
```

### 3.2 模块改造

| 模块 | 职责 | 改造说明 |
|---|---|---|
| `pnpm-workspace.yaml`（根） | 全 workspace 依赖版本锁定 | overrides 62 条 + minimumReleaseAgeExclude 62 条，`0.1.0-rc.7`→`0.1.2-rc.1`；`dsh-better-sidebar@0.13.0`→`@0.18.0` |
| `packages/tab-genoffice/package.json` | 插件自身依赖声明 | devDeps/peerDeps 版本号升级；删除 `@deepseek-ai/dsh-client-runtime` 相关 3 处（devDeps/peerDeps/`dsh.client.inject` 数组） |
| `packages/tab-genoffice/src/client/index.ts` | client 入口 | `ClientContext` 类型来源改为 `@deepseek-ai/cordis` |
| `packages/tab-genoffice/src/standard/cordis-client-adapter.ts` | client 适配器 | 同上 |
| `env/profiles/go/package.json` + `pnpm-workspace.yaml` | 本地开发环境 profile | 同步版本号，供 `env/boot.sh` 冒烟验证 |
| `env/README.md` | 环境说明文档 | 同步文档中的版本号提示 |
| `standards/host-descriptor.json` | 部署描述 `$comment` | 同步版本号提示（纯注释字段，非机器读取的 schema 字段） |

### 3.3 三段式定位清单

| 文件 | 稳定定位 | 搜索定位 | 行号 hint | 备注 |
|---|---|---|---|---|
| `pnpm-workspace.yaml` | `overrides:` 块 | `rg "^overrides:" pnpm-workspace.yaml` | L7-L72 | 62 行 `@deepseek-ai/dsh-*` 版本号 |
| `pnpm-workspace.yaml` | `minimumReleaseAgeExclude:` 块 | `rg "^minimumReleaseAgeExclude:" pnpm-workspace.yaml` | L73-L133 | 末行含 `dsh-better-sidebar@0.13.0` |
| `packages/tab-genoffice/package.json` | `devDependencies` | `rg '"devDependencies"' packages/tab-genoffice/package.json` | L36-L52 | 含 `@deepseek-ai/dsh-client-runtime` L39、`dsh-better-sidebar` L47 |
| `packages/tab-genoffice/package.json` | `peerDependencies` | `rg '"peerDependencies"' packages/tab-genoffice/package.json` | L53-L65 | 含 `@deepseek-ai/dsh-client-runtime` L56、`dsh-better-sidebar` L63 |
| `packages/tab-genoffice/package.json` | `dsh.client.inject` | `rg '"inject"' packages/tab-genoffice/package.json` | L74-L77 | 含 `@deepseek-ai/dsh-client-runtime` L76 |
| `packages/tab-genoffice/src/client/index.ts` | `import type { ClientContext }` | `rg "dsh-client-runtime" packages/tab-genoffice/src/client/index.ts` | L9 | 改为 `@deepseek-ai/cordis` |
| `packages/tab-genoffice/src/standard/cordis-client-adapter.ts` | `import type { ClientContext }` | `rg "dsh-client-runtime" packages/tab-genoffice/src/standard/cordis-client-adapter.ts` | L6 | 改为 `@deepseek-ai/cordis`；L20 `createClientActivation` 签名沿用同一类型名不用改 |
| `env/profiles/go/package.json` | `dependencies` | `rg "0.1.0-rc.7|dsh-better-sidebar" env/profiles/go/package.json` | 全文 8 行 | dependencies 4 行 + bundles 4 行 |
| `env/profiles/go/pnpm-workspace.yaml` | `overrides:` | `rg "0.1.0-rc.7" env/profiles/go/pnpm-workspace.yaml` | L14-L16 | 3 行 |
| `env/README.md` | 依赖版本说明表 | `rg "0.1.0-rc.7|dsh-better-sidebar" env/README.md` | L18-L19, L26 | 文档提示 |
| `standards/host-descriptor.json` | `$comment` | `rg "0.1.0-rc.7" standards/host-descriptor.json` | L2 | 纯注释，人读 |

### 3.4 API / 数据 / 权限 / 路由影响

均无影响——本次升级不改变插件对外 API 契约、数据格式、权限模型或路由结构（已通过 host 侧 6 包无破坏性变更的调查结论确认）。

---

## 4. Phase 计划与任务详情

> Phase 依赖链：

```text
P0 版本号文件升级 → P1 源码 import 修复 → P2 安装与命令级验证 → P3 真实场景冒烟验证
```

> 任务状态跟踪：实现任务数（不含基线/回归类开销任务）为 7 个，< 8，使用下方内嵌状态表，不生成 tasks.csv。

### 内嵌状态表

| 序号 | 任务 | 前置 | 验证命令 | 状态 |
|---|---|---|---|---|
| 1 | 升级根 `pnpm-workspace.yaml` 版本号 | 无 | `grep -c "0.1.2-rc.1" pnpm-workspace.yaml` → ≥62 | 已完成 |
| 2 | 升级 `packages/tab-genoffice/package.json` 依赖并移除 `dsh-client-runtime` | 无 | `grep -c "dsh-client-runtime" packages/tab-genoffice/package.json` → 0 | 已完成 |
| 3 | 修复 `src/client/index.ts` 与 `src/standard/cordis-client-adapter.ts` 的 `ClientContext` 导入 | 无 | `grep -rn "dsh-client-runtime" packages/tab-genoffice/src` → 无输出 | 待开始 |
| 4 | 同步 `env/profiles/go` 与 `env/README.md`、`standards/host-descriptor.json` 版本号提示 | 1 | `grep -rln "0.1.0-rc.7" env/profiles/go env/README.md standards/host-descriptor.json` → 无输出 | 待开始 |
| 5 | `pnpm install` 重新解析依赖（根 workspace + `env/profiles/go`） | 1;2;3;4 | `pnpm install && echo OK` → OK，无 peer 冲突报错 | 待开始 |
| 6 | 命令级验证：typecheck + build + test | 5 | `npm run typecheck --workspaces && npm run build --workspaces && npm run test --workspaces` → 全部退出码 0 | 待开始 |
| 7 | 执行 spec 5.2 真实场景全套测试（网关冒烟 + 侧栏功能回放） | 6 | 按 5.2 执行矩阵逐行回放，全部通过 | 待开始 |

### Phase 0: 版本号文件升级

> 你在哪里：插件全线锁定 `0.1.0-rc.7` / `dsh-better-sidebar@0.13.0`
> 做完之后：全部文件声明 `0.1.2-rc.1` / `dsh-better-sidebar@0.18.0`，无遗留旧版本号引用

### Task 1: 升级根 `pnpm-workspace.yaml` 版本号

- **关联**：BR-001 / UF-001（NA，本任务是纯配置改动，不直接用户可见，为 UF-001 的前置条件） / INV-002
- **前置任务**：无
- **风险等级**：P0

**为什么做**：这是全 workspace 依赖解析的唯一源头，不改这里，`pnpm install` 不会拉取新版本。

**涉及文件与定位**：

- `pnpm-workspace.yaml`：`overrides:` 块，`rg "^overrides:" pnpm-workspace.yaml`，L7-L72
- `pnpm-workspace.yaml`：`minimumReleaseAgeExclude:` 块，`rg "^minimumReleaseAgeExclude:" pnpm-workspace.yaml`，L73-L133

**具体操作**：

1. 把 `overrides:` 块下全部 62 行 `'@deepseek-ai/dsh-*': 0.1.0-rc.7` 的版本号替换为 `0.1.2-rc.1`。
2. 把 `minimumReleaseAgeExclude:` 块下全部 62 行 `'@deepseek-ai/dsh-*@0.1.0-rc.7'` 替换为 `'@deepseek-ai/dsh-*@0.1.2-rc.1'`。
3. 把该块末尾 `dsh-better-sidebar@0.13.0` 替换为 `dsh-better-sidebar@0.18.0`。

**验证**：`grep -c "0.1.2-rc.1" pnpm-workspace.yaml` → 期望 ≥ 124（overrides 62 + exclude 62）；`grep -c "0.1.0-rc.7" pnpm-workspace.yaml` → 期望 0

**Evidence**：`evidence/phase-0/task-1-diff.txt`（`git diff pnpm-workspace.yaml` 输出）

**注意事项**：易错点——两个块（overrides / minimumReleaseAgeExclude）包名列表必须保持一致，禁止只改一处导致两块版本号不一致触发 pnpm 警告。

**执行记录（偏差）**：`@deepseek-ai/dsh-client-runtime` 这个包名在 `0.1.2-rc.1` 已不存在于 npm registry（`npm view @deepseek-ai/dsh-client-runtime@0.1.2-rc.1` → 404），仅替换版本号会让 overrides/exclude 指向一个不存在的版本。追加操作：从两个块中各删除 1 行 `@deepseek-ai/dsh-client-runtime` 条目（与 Task 2 移除插件自身依赖的逻辑一致）。最终 `pnpm-workspace.yaml` 含 122 处 `0.1.2-rc.1`、0 处 `dsh-client-runtime`、0 处 `0.1.0-rc.7`。

### Task 2: 升级 `packages/tab-genoffice/package.json` 依赖并移除 `dsh-client-runtime`

- **关联**：BR-004 / UF-001（NA，配置改动） / INV-002
- **前置任务**：无
- **风险等级**：P0

**为什么做**：插件自身声明的 peer/dev 依赖必须与新的宿主版本兼容；`@deepseek-ai/dsh-client-runtime` 包已被上游删除，继续声明会导致 `pnpm install` 找不到该包版本或安装期报错。

**涉及文件与定位**：

- `packages/tab-genoffice/package.json`：`devDependencies`，`rg '"devDependencies"' packages/tab-genoffice/package.json`，L36-L52
- `packages/tab-genoffice/package.json`：`peerDependencies`，`rg '"peerDependencies"' packages/tab-genoffice/package.json`，L53-L65
- `packages/tab-genoffice/package.json`：`dsh.client.inject`，`rg '"inject"' packages/tab-genoffice/package.json`，L74-L77

**具体操作**：

1. `devDependencies` 中删除 `"@deepseek-ai/dsh-client-runtime": "0.1.0-rc.7"` 一行（L39）；其余 `@deepseek-ai/dsh-*` 条目版本号改为 `"0.1.2-rc.1"`；`"dsh-better-sidebar": "0.13.0"` 改为 `"0.18.0"`。
2. `peerDependencies` 中删除 `"@deepseek-ai/dsh-client-runtime": "^0.1.0-rc.6"` 一行（L56）；其余 `@deepseek-ai/dsh-*` 条目改为 `"^0.1.2-rc.1"`；`"dsh-better-sidebar": "^0.13.0"` 改为 `"^0.18.0"`。
3. `dsh.client.inject` 数组中删除 `"@deepseek-ai/dsh-client-runtime"` 一项（L76），只保留 `"@deepseek-ai/dsh-client-locale"`。

**验证**：`grep -c "dsh-client-runtime" packages/tab-genoffice/package.json` → 期望 0；`grep -c "0.1.2-rc.1" packages/tab-genoffice/package.json` → 期望 ≥ 8

**Evidence**：`evidence/phase-0/task-2-diff.txt`

**注意事项**：禁止只删 devDeps 而漏删 peerDeps 或 `dsh.client.inject` 数组——三处都引用了这个已废弃的包名。

### Task 3: 执行 Phase 0 回归验证

- **关联**：本 Phase 全部任务（Task 1、2）
- **前置任务**：1;2

**验证**：`grep -rln "0.1.0-rc.7\|dsh-client-runtime" pnpm-workspace.yaml packages/tab-genoffice/package.json` → 无输出（确认两个文件都已清干净）

**Evidence**：`evidence/phase-0/regression.log`

---

### Phase 1: 源码 import 修复

> 你在哪里：版本号文件已升级，但源码里仍有 2 处指向已删除包的类型导入
> 做完之后：`ClientContext` 类型全部来自 `@deepseek-ai/cordis`，typecheck 不再报 `Cannot find module`

### Task 4: 修复 `src/client/index.ts` 与 `src/standard/cordis-client-adapter.ts` 的 `ClientContext` 导入

- **关联**：BR-004 / UF-001 / INV-002
- **前置任务**：无（可与 Phase 0 并行，但列在其后便于顺序执行）
- **风险等级**：P0

**为什么做**：`@deepseek-ai/dsh-client-runtime` 包在目标版本已被物理删除（commit `be531688`），继续 import 会导致 typecheck 和 build 双双失败（L1 编译断裂），这是本次升级唯一的代码级改动点。

**涉及文件与定位**：

- `packages/tab-genoffice/src/client/index.ts`
  - 稳定定位：`import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'`
  - 搜索定位：`rg "dsh-client-runtime" packages/tab-genoffice/src/client/index.ts`
  - 行号 hint：L9
- `packages/tab-genoffice/src/standard/cordis-client-adapter.ts`
  - 稳定定位：同上 import 行；另有 `export function createClientActivation(ctx: ClientContext): ActivationController`
  - 搜索定位：`rg "dsh-client-runtime" packages/tab-genoffice/src/standard/cordis-client-adapter.ts`
  - 行号 hint：L6（import）/ L20（函数签名，类型名不变不用动）

**具体操作**：

1. `src/client/index.ts` L9：`import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'` 改为 `import type { Context as ClientContext } from '@deepseek-ai/cordis'`。
2. `src/standard/cordis-client-adapter.ts` L6：同样改法；L7 的 `import type {} from '@deepseek-ai/dsh-client-locale/client'`（触发 `ctx.locale` 的 declaration merging）保持不动。
3. `createClientActivation(ctx: ClientContext)` 函数体内部逻辑（`ctx.locale.bind`/`register`、`acquireFromCordis` 调用）不需要改动——已确认这些调用形态未变。

**验证**：`grep -rn "dsh-client-runtime" packages/tab-genoffice/src` → 无输出；`tsc -p packages/tab-genoffice/tsconfig.json --noEmit` → 退出码 0

**Evidence**：`evidence/phase-1/task-4-diff.txt`

**注意事项**：易错点——`import type {} from '@deepseek-ai/dsh-client-locale/client'` 这一行是为了触发 TS 的 declaration merging（让 `Context` 上出现 `locale` 字段），**不要误删**；这行本身不受本次升级影响。

### Task 5: 执行 Phase 1 回归验证

- **关联**：Task 4
- **前置任务**：4

**验证**：`npm run typecheck --workspaces` → 退出码 0（`豁免回归:单任务Phase已并入验证` 的豁免通道不适用，因本 Phase 只有 1 个实现任务但改动涉及编译正确性，仍需独立跑一次 typecheck 确认无遗漏的其他文件引用；此任务即该验证，不再单开）

**Evidence**：`evidence/phase-1/regression.log`

---

### Phase 2: 安装与命令级验证

> 你在哪里：所有文件已改完，尚未重新安装依赖或跑构建
> 做完之后：`pnpm install`/`typecheck`/`build`/`test` 全绿，具备进入真实场景验证的资格

### Task 6: `pnpm install` 重新解析依赖

- **关联**：BR-004 / ASM-001 / ASM-002
- **前置任务**：1;2;3;4
- **风险等级**：P1

**为什么做**：版本号文件改动后必须重新安装才能让 `node_modules` 与 lockfile 反映新版本；同时验证 ASM-001（`dsh-better-sidebar@0.18.0` 与 `@deepseek-ai/dsh@0.1.2-rc.1` 组合能否正常安装解析，无 peer 冲突）。

**涉及文件与定位**：

- 根目录 `pnpm-lock.yaml`（安装后自动更新，无需手动改）
- `env/profiles/go/pnpm-lock.yaml`（同上）

**具体操作**：

1. 在插件根目录执行 `pnpm install`。
2. 在 `env/` 目录执行 `sh env/setup.sh`（该脚本内部会为 `env/profiles/go` 重新安装依赖，见 1.3 节勘察事实）。
3. 观察是否有 peer dependency 冲突警告；如有（ASM-001 落空），按 UF-001 失败分支处理：显式钉版本号后重装。

**验证**：`pnpm install && echo OK` → 输出 `OK`，无 `ERESOLVE`/peer 冲突报错

**Evidence**：`evidence/phase-2/task-6-pnpm-install.log`

**注意事项**：如果安装报 `@deepseek-ai/dsh@0.1.2-rc.1` 找不到（dist-tag 问题，见 ASM-001），先用 `npm view @deepseek-ai/dsh@0.1.2-rc.1 version` 确认该版本号在 npm registry 上确实可解析，再排查是否是 pnpm 的 `minimumReleaseAgeExclude` 白名单未同步（Task 1 已处理，若仍报错检查白名单是否遗漏该版本号字符串）。

### Task 7: 命令级验证（typecheck + build + test）

- **关联**：BR-004 / INV-001 / INV-002
- **前置任务**：6
- **风险等级**：P0

**为什么做**：这是真实场景验证前的入场券（shared-rules §6.1），必须先过命令级验证才有资格进入 Phase 3。

**涉及文件与定位**：无新增定位，跑既有构建/测试脚本。

**具体操作**：

1. `npm run typecheck --workspaces`
2. `npm run build --workspaces`
3. `npm run test --workspaces`

**验证**：三条命令均退出码 0；`test` 报告既有 16 个 spec 文件全部通过（对照 1.3 节勘察的既有 spec 清单）

**Evidence**：`evidence/phase-2/typecheck-build-test.log`

**注意事项**：如果 `build` 报 `tsdown` 打包错误但 `typecheck` 通过，检查是否是 ESM/CJS 互操作问题（preflight-checks.md Check 2 提到的已知类别）。

### Task 8: 执行 Phase 2 回归验证

- **关联**：Task 6、7
- **前置任务**：6;7

**验证**：`node -e "import('./packages/tab-genoffice/lib/index.js').then(() => console.log('OK')).catch(e => { console.error(e.message); process.exit(1) })"` → 输出 `OK`（preflight-checks.md Check 3：模块加载检查，确认构建产物不会在 import 阶段就挂）

**Evidence**：`evidence/phase-2/module-load-check.log`

---

### Phase 3: 真实场景冒烟验证

> 你在哪里：命令级验证全绿，但尚未在真实运行的网关上验证
> 做完之后：网关正常启动、web UI 无白屏、GenOffice 侧栏功能可用——这是本次升级完成的唯一标准

### Task 9: 执行 spec 5.2 真实场景全套测试

- **关联**：UF-001、UF-002（全部用户可见 UF）
- **前置任务**：8
- **风险等级**：P0

**为什么做**：命令级验证只是入场券（shared-rules §7），Cordis Loader 的运行时加载行为、web UI 渲染、侧栏交互都不会被 typecheck/build/单测捕获，必须真实跑一遍网关。

**涉及文件与定位**：

- `env/boot.sh`：`rg "boot" env/boot.sh`，启动脚本
- `env/README.md`：L18-L26，环境准备参考

**具体操作**：

1. `sh env/setup.sh`（如 Task 6 未覆盖则在此执行一次，确保 profile 环境就绪）。
2. `sh env/boot.sh`，观察终端启动日志。
3. 浏览器打开 `http://localhost:3080`，核对 UF-001 成功主路径每一步。
4. 检查 pluginInventory（DSH 设置页或 CLI），核对 `dsh-tab-genoffice` 的 `fiberPhase` 为 `active`。
5. `node scripts/dev.mjs start-relay` 启动 relay，按 UF-002 成功主路径点击侧栏 tab、浏览文件、双击一个已知 docx/xlsx/pptx 文件核对预览。
6. 若命中任一失败分支，按 UF-001/UF-002 对应恢复路径处理并重试。

**验证**：按 5.2 执行矩阵逐行回放，全部通过；截图/日志按 EVD-001/EVD-002 归档

**Evidence**：`evidence/UF-001/boot.log`、`evidence/UF-001/plugin-inventory.png`、`evidence/UF-002/*.png`

**注意事项**：如果网关启动即报错，**不要跳过直接判定完成**——按 preflight-checks.md「应急恢复」章节先禁用插件排查，不许把「命令级通过」当作「完成」上报。

### Task 10: 执行 Phase 3 回归验证

- **关联**：Task 9
- **前置任务**：9

**验证**：`npm run test --workspaces`（收尾复跑一次确认真实场景验证过程未意外改动业务代码导致测试回归）+ 关联 UF-001/UF-002 逐条核对通过

**Evidence**：`evidence/phase-3/final-regression.log`

---

## 5. 验收与 Review 协议

### 5.1 命令级验证（入场券）

| 验证项 | 命令 | 期望 | Evidence |
|---|---|---|---|
| typecheck | `npm run typecheck --workspaces` | 退出码 0 | EVD-003 |
| build | `npm run build --workspaces` | 退出码 0 | EVD-003 |
| unit test | `npm run test --workspaces` | 退出码 0，既有 16 个 spec 全部通过 | EVD-004 |
| 模块加载 | `node -e "import('./packages/tab-genoffice/lib/index.js')..."` | 输出 `OK` | `evidence/phase-2/module-load-check.log` |
| 社区标准验证 | `node standards/validate.mjs` | 6 阶段全部通过，第 6 阶段（适配器审计）无新增上游 import 警告 | `evidence/phase-2/standards-validate.log` |

### 5.2 真实场景全套测试（Real-Run，完成的唯一标准）

**环境准备**：

| 项 | 值 |
|---|---|
| 启动命令 | `sh env/setup.sh` 然后 `sh env/boot.sh`（网关 `:3080`）；relay 另起 `node scripts/dev.mjs start-relay`（`:8787`） |
| 访问入口 | `http://localhost:3080`（web UI）；relay 健康检查 `http://127.0.0.1:8787/api/health` |
| 测试账号/数据 | 无需账号（本地 loopback 单用户环境）；测试文档使用仓库内任意已存在的 `.docx`/`.xlsx`/`.pptx` 样例文件 |
| 干净状态定义 | `env/` 目录是独立 `DSH_HOME`，重新 `sh env/setup.sh` 即为干净状态 |
| 可用测试工具 | 无浏览器自动化 MCP（本会话环境未挂载），按「手动脚本 + 用户回填」降级：由执行者手动打开浏览器操作，截图保存到 evidence 目录 |

**执行矩阵**：

| UF | 执行方式 | 操作来源 | 必须核对的点 | Evidence |
|---|---|---|---|---|
| UF-001 主路径 | manual | 2.3 节 UF-001 成功主路径逐步执行 | 终端无异常堆栈；web UI 无白屏；pluginInventory 显示 `active` | `evidence/UF-001/boot.log` + `evidence/UF-001/plugin-inventory.png` |
| UF-001 失败分支「模块解析失败」 | manual | 若命中，按恢复路径执行 `disabled: true` 临时禁用后重启验证网关可正常起来 | 禁用后网关能起，证明问题隔离在本插件 | `evidence/UF-001/fallback-if-triggered.log`（仅在实际触发时归档） |
| UF-002 主路径 | manual | 2.3 节 UF-002 成功主路径逐步执行 | 侧栏 tab 可见、文件列表可浏览、docx/xlsx/pptx 预览正常渲染无报错 | `evidence/UF-002/sidebar-tab.png` + `evidence/UF-002/file-list.png` + `evidence/UF-002/preview.png` |
| UF-002 失败分支「relay 未启动」 | manual | 停掉 relay 后观察侧栏降级行为 | 显示「启动 relay」引导入口，不崩溃 | `evidence/UF-002/relay-down-fallback.png` |

**通过标准**：执行矩阵全部行通过且 evidence 齐全。任何一行失败 = 本需求未完成，回到 Task 4（源码修复）或对应任务修复后重跑。

### 5.3 Evidence 目录结构与命名

```text
evidence/
  phase-0/    # Task 1-3 的 diff 与回归日志
  phase-1/    # Task 4-5 的 diff 与回归日志
  phase-2/    # Task 6-8 的安装/构建/测试日志
  phase-3/    # Task 9-10 的最终回归日志
  UF-001/     # 网关冒烟启动日志与截图
  UF-002/     # 侧栏功能回放截图
```

### 5.4 Review 专项检查清单

- [ ] 全仓库（含 `env/` 目录）不再有任何 `0.1.0-rc.7` 或 `dsh-client-runtime` 字符串残留（`grep -rln "0.1.0-rc.7\|dsh-client-runtime" --include="*.json" --include="*.yaml" --include="*.ts" --include="*.md" .` 应为空，`node_modules`/`lib` 目录除外）
- [ ] host 侧代码（`src/host/*.ts`）零改动，`git diff --stat packages/tab-genoffice/src/host` 应无输出
- [ ] 5.2 执行矩阵全部通过，evidence 齐全且与第 2.5 节 EVD 清单一致
- [ ] 2.3 节每条流程的「入口接线清单」已实现——`sh env/boot.sh` → 浏览器 → 侧栏 tab 全链路可达
- [ ] 界面交互与 2.3 节脚本逐步一致（loading、降级提示都存在）
- [ ] 所有 BR/UF/INV 状态可对照第 2 章逐条核销
