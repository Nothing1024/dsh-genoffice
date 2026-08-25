# Phase 4 Summary

## 完成任务

- Task 18：skill→defineTool 工具定义生成器（`tab-genoffice/src/host/tool-schema.ts`：契约工具表 + 生成器；11 docx + 5 markdown；参数/描述镜像 contracts/control-api.md §4）
- Task 19：host 工具执行（`host/tools.ts`：`POST /api/control/<app>/<docId>/tool` 执行 + `…/export` 保存；docId=sha256(path)；deadline 70s（BR-010）；错误映射未注册/超时/非法参数/冲突）
- Task 20：client 接线（`previewUrlFor` 生成 control=1 URL；「写入磁盘」按钮 + idle→saving→saved/conflict/error 状态机；iframe 卸载修复；browser-open 无 control——INV-007）
- Task 21：插件 build + typecheck 全绿；3099 实例重启验证（工具注册 + 实景会话）
- Task 22：Phase 4 回归（smoke 全绿，契约↔skill↔host 工具名集合镜像三向一致）

## 验证命令

| 命令 | 结果 | 日志 |
|---|---|---|
| `cd plugin && npm run build && npm run typecheck` | 全绿 | evidence/phase-4/build-typecheck.log |
| `node scripts/dev.mjs smoke` | 全部 PASS（含契约↔skill↔host 工具名集合镜像） | — |
| DSH 会话实测（3099） | agent 调用 markdown_get_document_context → replace_blocks → save 全链路成功（7 秒 / 4 步） | evidence/UF-001/agent-tool-calls.log |
| 浏览器实景 | 点击 md → iframe `?control=1&open=path:`；sandbox 不变；「写入磁盘」三态可用 | evidence/UF-002/save-success.png + fail-conflict.png |

## 用户路径 / API 验证

| UF | 结果 | Evidence |
|---|---|---|
| UF-001 主路径（agent 工具链 → iframe 变化 → 原文件未变） | ✔ 工具链 + 磁盘 md5 校验 | agent-tool-calls.log |
| UF-002 主路径（写入磁盘按钮 → saved 提示 → 磁盘=iframe） | ✔ 磁盘 grep 验证 + 截图 | save-success.png |
| UF-002 失败分支（外部 touch 后保存 → conflict 提示） | ✔ 提示「文件已被外部修改，未覆盖」 | fail-conflict.png |
| UF-003（tab 打开带 control=1；browser-open 无 control） | ✔ iframe URL + sandbox 检查 | 实景 |
| BR-007 工具注册 | ✔ 模型可见并可调用 16 个工具 | 会话实测 |

## 关键修复（真实场景暴露）

1. **工具名分隔符**：DeepSeek API 拒绝含 `:` 的工具名（`INVALID_REQUEST`，pattern `^[a-zA-Z0-9_-]+$`）→ 契约/生成器改用 `docx_`/`markdown_` 前缀（ASM-006 修订，契约 §4 已注明）。
2. **僵尸执行器翻转（数据完整性缺陷）**：同一 docId 的多个 control 页面（GUI tab 重开产生的已卸载 iframe、P2 遗留独立页面）的 EventSource 持续自动重连，与当前 iframe 反复抢占 relay 单执行器槽位 → 保存被旧 mtime 基线拒绝，甚至写回陈旧文档状态。修复：
   - tab：切换预览/返回列表前将旧 iframe `src='about:blank'` 卸载（pagehide → 适配器注销）；
   - 适配器：`onerror` 关闭 EventSource 且仅当页面可见时显式重连（detached iframe 不再重连）。
   修复后单执行器稳定，保存 expected==disk 精确匹配。

## 剩余风险

- 多个浏览器页面同时以 control=1 打开同一文件仍会抢占执行器（M0 单会话语义，ASM-007；用户同时开多页属误用）。
- 「写入磁盘」按钮直连 relay export 端点（平台无 client→host 工具 RPC）；与 host save 工具同一写回路径，loopback + 执行器注册校验由 relay 强制。
