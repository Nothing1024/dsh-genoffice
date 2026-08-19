# dsh-genoffice — 插件仓库

连接 GenOffice relay，在 DSH 侧栏编辑 Office 文档（docx/pptx/xlsx/md）。注册到 `ctx.betterSidebar`。

钉正式 npm：`@deepseek-ai/dsh-*@0.1.0-rc.7`，`dsh-better-sidebar@0.13.0`（optional peer `^0.13.0`）。不要 `latest`，不要 `vendor/dsh` / worktree `file:`。

仓内 `env/` 是 loopback `DSH_HOME`（profile `go`，:3080）。relay 用栈根 `node ~/workspace/dsh/genoffice/scripts/dev.mjs start-relay`。

覆盖前本机未提交功能在 stash：`git stash list`（`wip/local-open-sse`）。该 stash 叠在官方化树上不能干净 apply，未弹出。

## 包

| 包 | 职责 |
|---|---|
| `packages/tab-genoffice`（`@deepseek-ai/dsh-tab-genoffice`） | 侧栏 tab + 控制模式预览 |

```sh
cd ~/workspace/dsh/plugin/dsh-genoffice/plugin
pnpm install
pnpm run build
pnpm test
sh env/setup.sh
sh env/boot.sh            # loopback :3080
```
