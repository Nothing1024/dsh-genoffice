# dsh-genoffice — 产品仓

DSH 侧栏插件 + 跨侧契约 + 启动/冒烟脚本。魔改 GenOffice 本体在并列目录 `../upstream`（独立 git，origin = genspark-ai/genoffice），不要把上游 commit 进本仓。

钉正式 npm：`@deepseek-ai/dsh-*@0.1.0-rc.7`，`dsh-better-sidebar@0.13.0`（optional peer `^0.13.0`）。不要 `latest`，不要 `vendor/dsh` / worktree `file:`。

仓内 `env/` 是 loopback `DSH_HOME`（profile `go`，:3080），不要提交凭据。

`~/workspace/dsh/genoffice` 指向本目录，旧命令继续可用。

## 目录

```text
.
├── packages/tab-genoffice/   # @deepseek-ai/dsh-tab-genoffice
├── contracts/                # 跨侧契约（INV-004 单一事实源）
├── scripts/dev.mjs           # status / start-relay / smoke / open
├── docs/                     # 活文档 + 历史任务包
├── skill/genoffice-preview/
└── env/                      # 本机 DSH_HOME，不进 git
```

## 日常

```sh
cd ~/workspace/dsh/plugin/dsh-genoffice/plugin
pnpm install
pnpm run build
pnpm test
node scripts/dev.mjs start-relay
node scripts/dev.mjs smoke
sh env/setup.sh
sh env/boot.sh            # loopback :3080
```

构建上游 web-dist：`cd ../upstream && npm run web`。

调试网关内部状态用 `dsh-plugin-debug` skill：`~/.agents/skills/dsh-plugin-debug/scripts/dsh-rpc.sh 3080 pluginInventory/list`。

## Relay 一键启动

设置 `DSH_GENOFFICE_ROOT` 为本仓根目录（且 `<root>/scripts/dev.mjs` 可读）后，插件 host 路由 `GET/POST /dsh-artifact/genoffice-relay` 可用，侧栏在 relay 不可用时显示「启动 relay」。未设置该环境变量则只保留手动命令 `node scripts/dev.mjs start-relay`。

