# dsh-genoffice — 产品仓

DSH 侧栏插件 + 跨侧契约 + 启动/冒烟脚本。魔改 GenOffice 引擎在并列目录 `../engine`（独立 git，origin = `Nothing1024/dsh-genoffice-engine`；官方在 remote `upstream` = `genspark-ai/genoffice`），不要把引擎 commit 进本仓。

钉正式 npm：`@deepseek-ai/dsh-*@0.1.0-rc.7`，`dsh-better-sidebar@0.13.0`（optional peer `^0.13.0`）。不要 `latest`，不要 `vendor/dsh` / worktree `file:`。

仓内 `env/` 是 loopback `DSH_HOME`（profile `go`，:3080），不要提交凭据。`boot.sh` 会把 `DSH_GENOFFICE_ROOT` 指到本仓根。

## 目录

```text
.
├── packages/tab-genoffice/   # @deepseek-ai/dsh-tab-genoffice
├── contracts/                # 跨侧契约（INV-004 单一事实源）
├── scripts/dev.mjs           # status / start-relay / smoke / open
├── docs/                     # 活文档 + 历史任务包
├── skill/genoffice-preview/
└── env/                      # 配方进 git；凭据 / sessions / storages 不进
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

构建引擎 web-dist：`cd ../engine && npm run web`。

## 社区标准对齐（standards/）

对齐 [dsh-community-standard](https://github.com/oh-my-dsh/dsh-community-standard) v0.15 的静态声明面：`packages/tab-genoffice/dsh-plugin.json` 是标准 manifest（与官方装载用的 `dsh.plugin.json` 并存），`standards/` 内有部署 Host Descriptor（profile `go`）、纯函数协商、fixtures 与上游触点基线。`npm run standard:check` 一键校验；私有坐标用 `x-nothing1024.*` 命名空间。client 半身受 RFC 0002 限制暂不可声明，详见 `standards/README.md`。

调试网关内部状态用 `dsh-plugin-debug` skill：`~/.agents/skills/dsh-plugin-debug/scripts/dsh-rpc.sh 3080 pluginInventory/list`。

## Relay 一键启动

`env/boot.sh` 会设置 `DSH_GENOFFICE_ROOT` 为本仓根（且 `<root>/scripts/dev.mjs` 可读）。之后插件 host 路由 `GET/POST /dsh-artifact/genoffice-relay` 可用，侧栏在 relay 不可用时显示「启动 relay」。未设置该环境变量则只保留手动命令 `node scripts/dev.mjs start-relay`。不要再走已删除的 `~/workspace/dsh/genoffice`。

