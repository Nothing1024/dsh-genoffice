# Review 修复记录（2026-08-12，二轴审查后）

## Standards 轴发现并修复

1. **server.mjs — 连接级 pending 竞态（真实缺陷）**：`failPendingFor(docId)` 会失败该 docId 的
   **全部** pending 条目，包括同 docId 重新注册后的新连接的在途调用——旧连接（被 re-registration
   关闭）的清理会误杀新执行器的进行中调用（表现为随机 timeout）。修复：pending 条目绑定其连接
   （`waitForResult(..., conn)`），`failPendingFor(docId, conn)` 只失败**本连接**的条目
   （BR-010 语义精确化：断线只杀死随连接死亡的调用）。
2. **server.mjs — 死代码**：未使用的 `isControl` 变量、`controlMatch` 中未使用的 `app` 解构 → 删除。
3. **genoffice.tsx — stale closure 使 unload 修复失效（真实缺陷）**：`subscribePreview` 订阅回调
   捕获首渲染闭包，其中的 `view` 恒为 list——`openPreviewByPath` 里基于 `view` 状态的卸载条件
   在事件路径永不触发，旧 iframe 文档继续运行（执行器反复抢占）。修复：无条件 `unloadPreview()`
   （iframe 未挂载时为 no-op）。
4. **control.ts（两 app）— 重连抖动**：`visibilitychange/online` 无条件 reopen 会造成已连接时的
   注册闪断；修复：仅当 EventSource 处于 CLOSED 时才重连。
5. **plugin tools.ts — 卡片分类**：`presentCall` 一律 `kind:'edit'` 不准确；按工具族分类
   （read/edit/execute：get_document_context/read_blocks/web_search/image_search → read；
   save → execute；其余 → edit）。

## Spec 轴核对结论

- 未发现 spec 要求缺失或行为错误的新问题（P5 阶段已按 5.2 矩阵逐行核销）。
- 两处已记录的契约偏差（工具名 `_` 分隔符、按钮直连 export 端点）经复核为平台约束下的合理实现，
  契约 §4 / phase-4 summary 已注明。

## 修复后验证

- `node scripts/dev.mjs smoke` 全部 PASS；`validate_package.py` 0 FAIL / 0 WARN / 13 PASS。
- 控制面回归（curl）：context 往返 ok、未注册错误语义、`POST /api/file` 写回、伪造 Host 403 全通过。
- GUI 实景：context → replace_blocks → save 全链路成功（修复后 bundle）。
