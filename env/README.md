# genoffice 固定 env

本目录是一份独立的 `DSH_HOME`（loopback）。不要 `--lan`。

```text
env/
├── setup.sh / boot.sh
└── profiles/go/          bundles + 仓内 link；用户 overlay 空 []
```

```sh
pnpm install && pnpm run build && sh env/setup.sh
sh env/boot.sh            # :3080
```

| 依赖 | 去哪 | bundle 层 |
|---|---|---|
| `@deepseek-ai/dsh-base` / `dsh-web-app` | npm `0.1.0-rc.7` | 是 |
| `dsh-better-sidebar` | npm `0.13.0` | 是 |
| `@deepseek-ai/dsh-tab-genoffice` | `../../packages/tab-genoffice` | 是 |

Relay 另起：`node ~/workspace/dsh/plugin/dsh-genoffice/plugin/scripts/dev.mjs start-relay`。
`boot.sh` 会 export `DSH_GENOFFICE_ROOT` 为本仓根（侧栏「启动 relay」靠它定位 `scripts/dev.mjs`）。

```sh
DSH_HOME=$PWD/env npx --yes @deepseek-ai/dsh@0.1.0-rc.7 --profile go --dump-config
```
