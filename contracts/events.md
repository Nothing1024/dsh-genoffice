# `dsh:open-local-file` 事件契约

本地文件预览联动。改事件名须两边一起改，并重启 DSH 验证。

## 事件定义

- 名称：`dsh:open-local-file`
- 载体：`window` 上的 `CustomEvent<string>`，`detail` = 本机绝对路径
- 方向：生产 → 消费（单向）

## 生产者

内测是 `wt-artifact` 里的 `ui-primitives` 补丁（`local-paths.ts`）。**该 worktree 已删**，正式 DSH 不再带这份补丁。路径点击联动是否还在，看官方 markdown 渲染器。

## 消费者

- 位置：`../plugin/dsh-genoffice/plugin/packages/tab-genoffice/src/client/index.ts`
- 覆盖前本机还做过 SSE `/api/open/stream`（stash `wip/local-open-sse`），当前 checkout 未必含这段。

## 扩展名

tab 预览以插件 `PREVIEWABLE` 为准（见 `src/tabs/genoffice.tsx`）。mdx 是否可点不再由已删的渲染器白名单决定。

## 校验

1. `node scripts/dev.mjs smoke`（relay 形状 + 插件 PREVIEWABLE / host 工具名）
2. 端到端：`npx @deepseek-ai/dsh web` + relay `:8787`，在 GenOffice tab 打开本地 docx/md
