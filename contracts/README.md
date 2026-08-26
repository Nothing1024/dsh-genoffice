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

## 消费方清单

- `../engine/web/server.mjs` — relay 实现（权威；控制面段为 control-api.md 的权威实现）
- `../engine/web/open.mjs` — CLI 注入（inject 形态的生产者）
- `../engine/apps/{docs,markdown}/src/renderer/web-bridge.ts` — `open=` 形态的消费方
- `../engine/apps/{docs,markdown}/src/renderer/control.ts` — 控制适配器（control-api.md 消费方/执行器）
- `../packages/tab-genoffice/` — `/api/dir` 与 `path:` 形态的消费方 + 控制面
- 内测 markdown `local-paths.ts` 平台补丁已随 worktree 删除；正式版路径链接以官方渲染器为准
- `scripts/dev.mjs` — 冒烟镜像（事件名/扩展名白名单/控制面端点形状/工具名集合断言，见 events.md 与 control-api.md；`open` 命令转发到 `web/open.mjs`）
