# UF-005

## 主路径（本轮浏览器）

1. `kill` 掉 :8787 relay 后刷新 GenOffice 面板
2. 条幅出现「启动 relay」（`GET /dsh-artifact/genoffice-relay` → `{"configured":true}`）
3. 点击后 ~349ms `GET /api/health` 恢复 `{ok:true,port:8787}`

截图：`UF-005-down.png` / `UF-005-up.png`

## 未配置 env

本轮 DSH 带了 `DSH_GENOFFICE_ROOT`，无法同时拍「无按钮」。
由 `relay-launch.spec.ts` 的 configured=false 分支覆盖。
