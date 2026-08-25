# 运行手册 / 验证路径

活文档。`genoffice-dsh-control/`、`genoffice-dsh-office/` 里的 spec / evidence 是当时验收存档，路径仍写 `dsh-artifact` / `:3099`，不要当现在的启动手册。

## 现状速查

| 项 | 命令/位置 |
|---|---|
| relay 健康 | `node scripts/dev.mjs status`（或 `curl http://localhost:8787/api/health`） |
| 契约冒烟 | `node scripts/dev.mjs smoke` |
| 预览本地文件 | `node scripts/dev.mjs open <path> [--no-browser]` |
| web-dist 构建 | `cd ../upstream && npm run web` |
| 插件构建 | `pnpm install && pnpm run build`（本仓根） |
| DSH | `npx --yes @deepseek-ai/dsh web` → http://127.0.0.1:3080 |

## 已知漂移

- **mdx**：旧渲染器补丁会链 `mdx`，tab 只预览 docx/md。内测平台补丁已随 worktree 删除；正式版是否还有路径链接看官方 markdown 渲染器，不再改 `local-paths.ts`。
