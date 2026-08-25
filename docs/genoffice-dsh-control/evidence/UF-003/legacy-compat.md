# UF-003 失败分支：旧构建兼容（legacy-compat）

## 说明

- 无法在真实 relay 上构造「旧 web-dist」场景（当前 web-dist 由本次实现重建，历史 dist 未留存）。
- 兼容机制（代码事实）：app 渲染器对 `control=1` 的解析完全位于**新增代码**中
  （`apps/*/renderer/control.ts` 模块级 `params.get('control') === '1'`、App.tsx 的 `CONTROL_MODE`
  条件渲染、Ribbon `hideAi` prop）。旧构建（无这些代码）加载同一 URL 时：
  - `?control=1` 参数被忽略（无任何读取点）→ 按普通模式渲染；
  - `?open=path:` 走原有打开链 → 预览正常；
  - 不会崩溃（无新增依赖、无新增强制初始化路径）。
- 等价验证：非 control 页面（无 control=1）在本实现下行为与旧版完全一致
  （INV-001 回归截图 docs-noncontrol-ai.png / markdown-noncontrol-ai.png 佐证「无 control 即旧行为」）。
