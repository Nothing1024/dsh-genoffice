# UF-001 旧 relay 回退（INV-003）

未把正在跑的新 `web/server.mjs` stash 成旧实现，避免打断本轮验收。

回退由插件单测覆盖：`packages/tab-genoffice/tests/integration.spec.tsx`

- 成功响应**无** `mtimeMs` → iframe `src` 出现新 `_r=`（重挂）
- 成功响应**有**数值 `mtimeMs` → iframe `src` 不变，文案含「编辑状态已保留」
