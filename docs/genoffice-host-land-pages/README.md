# genoffice-host-land-pages（已拆分）

跨仓需求已切成两份**独立执行包**。不要把本目录的 `handoff.md` 交给执行 Agent。

| 包 | 改谁 | 路径 |
|---|---|---|
| 上游 GenOffice | `upstream/apps/slides` + `contracts/` + `scripts/dev.mjs` | [`../genoffice-land-pages-upstream/`](../genoffice-land-pages-upstream/) |
| DSH 插件 | `plugin/packages/tab-genoffice` | [`../genoffice-land-pages-plugin/`](../genoffice-land-pages-plugin/) |

依赖：插件 5.2 依赖上游已部署 `land_pages`。可并行改表，E2E 必须上游先绿。

本目录 `spec.md` / `handoff.md` / `tasks.csv` 是拆分前的合并稿，仅作存档。
