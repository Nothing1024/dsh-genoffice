# 跨侧契约（单一事实源）

本目录是 GenOffice 栈**跨侧接口**的单一事实源。两侧实现（relay / DSH 插件 / web 桥 / markdown 渲染器补丁）目前是 INV-004 式手工镜像——各自独立编译、零交叉引用，运行时靠约定对接。**改动接口必须先改这里**，再同步两侧，最后跑 `node scripts/dev.mjs smoke` 验证。

| 契约 | 涉及侧 | 文件 |
|---|---|---|
| relay HTTP API（端点/形状/CORS/安全边界） | `engine/web/server.mjs` ↔ `dsh-tab-genoffice` 面板 / 各 app `web-bridge.ts` | [relay-api.md](./relay-api.md) |
| **控制契约（DSH 控制编辑，原生集成）**：SSE 下行 / notify 上行 / tool / context / export / `POST /api/file` 写回 / docId 规则 / 工具名集合 | `engine/web/server.mjs` 控制面 ↔ `apps/{docs,markdown}/src/renderer/control.ts` ↔ `tab-genoffice/src/host/*` ↔ `scripts/dev.mjs` smoke | [control-api.md](./control-api.md) |
| `dsh:open-local-file` window 事件 | `ui-primitives` 渲染器补丁 ↔ `dsh-tab-genoffice` client | [events.md](./events.md) |
| 扩展名 → 预览 app 映射（docx→docs, md→markdown） | 插件面板 `PREVIEWABLE` ↔ relay 路由 | [relay-api.md](./relay-api.md) §open= 形态 |

## 同步纪律（INV-004 正式化）

1. 先改本目录的 markdown（记录契约），再改两侧源码；
2. 两侧源码里**镜像声明处**标注 `INV-004` 注释并指向本目录；
3. 改完跑 `node scripts/dev.mjs smoke`——它对运行中的 relay 做形状断言，形状漂移会直接报错；
4. 事件名等字符串常量改动：重启 DSH 后再点一次路径联动（内测 wt-artifact 已删）。

## 社区标准对齐（dsh-community-standard，Draft v0.15）

对齐面在 [`../standards/`](../standards/README.md)：六环节 validator（manifest / facet 装载 / 协商报告 / 两组 fixtures / adapter 基线，`npm run standard:check`）+ registry 本地镜像 + 上游供稿草稿。标准 manifest 为 `packages/tab-genoffice/dsh-plugin.json`——反向域名 id `io.github.nothing1024.tab-genoffice`，与官方装载用的 `dsh.plugin.json`（私有 id `dsh-external/dsh-tab-genoffice`）双 manifest 并存、互不覆盖；host facet 入口即标准层产物 `lib/standard/host.js`。本节从**跨侧契约**视角补一份宿主依赖盘点：哪个依赖缺了会怎样，是 `requires` 声明与降级路径的单一事实源。

| 依赖 | required/optional | 现有降级路径 | 契约坐标（x- 私有命名空间，语义卡片见 standards/registry/） |
|---|---|---|---|
| `ctx.tools`（`dsh-tools` defineTool，94 个控制/打开工具） | required（host 半身） | 无（核心功能） | `x-nothing1024.dsh.tools/v1alpha1` ToolRegistry——已列入 `requires` |
| `ctx.systemPrompt`（GenOffice 引导段） | optional（host 半身） | 缺席时跳过注入，工具照常注册 | `x-nothing1024.dsh.system-prompt/v1alpha1` SystemPrompt——已列入 `requires`（optional） |
| skills 服务（genoffice 运行时手册） | optional（host 半身） | 缺席时跳过注册，提示词段兜底 | `x-nothing1024.dsh.skills/v1alpha1` SkillRegistry——已列入 `requires`（optional） |
| `ctx.betterSidebar`（tab / FileViewer UI） | optional（client 半身） | 缺席时跳过注册不崩（BR-003） | `x-nothing1024.better-sidebar/v1alpha1` SidebarTab——已列入 `requires`（optional） |
| `ctx.locale` | required（client 半身） | — | `x-nothing1024.dsh.locale/v1alpha1` Locale——registry 已备案；client facet 归 RFC 0002，暂不进 manifest |
| `ctx.webServer`（`/dsh-artifact/genoffice-relay`、`genoffice-sync` 路由） | optional（host 半身） | 注入 PENDING 时「启动 relay」按钮隐藏、sync 走兜底（见 `src/host/lookup.ts`） | `x-nothing1024.dsh.web-server/v1alpha1` WebServer——已列入 `requires`（optional） |
| loopback 网络（fetch `localhost:8787`） | required | relay 挂时面板/视图显示降级横幅 | permission `x-nothing1024.net.loopback-fetch`——已列入 `permissions`（语义见 standards/registry/permissions.md） |
| 子进程 spawn（start-relay） | optional | 手动命令提示 | permission `x-nothing1024.process.spawn`——已列入 `permissions`（同上） |

待社区推动的三份供稿已草拟在 [`../standards/contributions/`](../standards/contributions/)：0001 宿主服务契约（含工具名受 DeepSeek API `^[a-zA-Z0-9_-]+$` 约束的一手输入）；0002 跨面插件 client facet 田野报告（RFC 0002）；0003 sensitivity 档位与 permissions 语义（敏感能力授权）。

## 消费方清单

- `../engine/web/server.mjs` — relay 实现（权威；控制面段为 control-api.md 的权威实现）
- `../engine/web/open.mjs` — CLI 注入（inject 形态的生产者）
- `../engine/apps/{docs,markdown}/src/renderer/web-bridge.ts` — `open=` 形态的消费方
- `../engine/apps/{docs,markdown}/src/renderer/control.ts` — 控制适配器（control-api.md 消费方/执行器）
- `../packages/tab-genoffice/` — `/api/dir` 与 `path:` 形态的消费方 + 控制面
- 内测 markdown `local-paths.ts` 平台补丁已随 worktree 删除；正式版路径链接以官方渲染器为准
- `scripts/dev.mjs` — 冒烟镜像（事件名/扩展名白名单/控制面端点形状/工具名集合断言，见 events.md 与 control-api.md；`open` 命令转发到 `web/open.mjs`）
