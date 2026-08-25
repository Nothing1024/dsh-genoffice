# UF-005

## 主路径（2026-08-25 全矩阵重跑，PASS）

1. `kill` :8787 后，GenOffice 面板点「刷新」才把 `relayOk` 打成 false
2. 条幅：`GenOffice relay 不可用` +「重新检查」+「启动 relay」
3. 点「启动 relay」：15s 内列表刷回 `manual-view`（content_report.md / 空白文档.docx 等）
4. `GET /api/health` → `{ok:true,name:genoffice-web-relay,port:8787}`

截图：`UF-005-down.png` `UF-005-up.png`

## 未配置 env

当前 DSH 带了 `DSH_GENOFFICE_ROOT`，不能同时拍「无按钮」。
由 `relay-launch.spec.ts` 的 `configured=false` 分支覆盖。
