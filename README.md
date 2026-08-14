# dsh-genoffice — 插件仓库

本目录是 **GenOffice 插件的 git 仓库**（out-of-tree，独立于 DSH 平台仓库）。

> 能力：连接 GenOffice relay，在 DSH GUI 侧栏中编辑 Office 文档（docx/pptx/xlsx/md）。
> 环境（worktree / DSH_HOME / profile / 端口）见上级 [`../README.md`](../README.md)。

## 包结构（pnpm workspace，1 包）

| 包 | 职责 |
|---|---|
| `packages/tab-genoffice`（`@deepseek-ai/dsh-tab-genoffice`） | GenOffice 侧栏 tab：relay 通信 + 文档浏览器 + 控制模式预览（docx 走 FileViewer），注册到 `ctx.betterSidebar` |

## 依赖接线（vendored @deepseek-ai）

- 插件包以 `file:` 依赖指向环境 worktree（`env/wt-genoffice`）的平台包，运行时经 `node_modules/@deepseek-ai` 符号链接解析。
- 实例接线：`~/.dsh-wt-genoffice/profiles/node_modules/@deepseek-ai/dsh-tab-genoffice` → 本仓库 `packages/tab-genoffice` 符号链接。
- 零平台补丁：完全依赖 `dsh-better-sidebar` 提供的插件接口（`registerTab` + `registerFileViewer`）。

## 维护命令

```sh
cd ~/workspace/dsh/plugin/dsh-genoffice/plugin
pnpm install
pnpm run build    # 全仓 build → typecheck
pnpm test         # vitest
```

## 验证路径

- 单测：`pnpm test`
- 类型检查：`pnpm run typecheck`
- 真实场景：启动环境并在 GUI 中打开 GenOffice 文档
