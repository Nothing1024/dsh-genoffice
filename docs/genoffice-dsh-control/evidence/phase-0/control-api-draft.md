# contracts/control-api.md 评审记录（Task 2）

> 评审时间：2026-08-12 | 评审人：执行 Agent（对照 spec.md 第 2 章 BR/UF/INV 与 ASM 清单）

## 评审项

### 1. 端点契约 vs spec Task 2 要求

| spec 要求 | 契约位置 | 结论 |
|---|---|---|
| `GET /api/control/stream?docId=<id>` SSE 下行（tool/hello/ping 消息格式） | §2.1 | ✔ 定义了 hello/ping/tool/context/export/error 六种事件 |
| `POST /api/control/notify` 上行 `{docId, kind:'tool-result'\|'export', requestId?, payload}` | §2.2 | ✔ tool-result=ToolExecution；export=base64 字节 |
| `POST /api/control/<app>/<docId>/context` → `{ok, context}` | §2.3 | ✔ app∈{docs,markdown} 404；TTL 30s；未注册/超时错误 |
| `POST /api/control/<app>/<docId>/tool` 入参 `{call:{id,name,input}}` → `{ok, execution}` / `{ok:false, error}` | §2.4 | ✔ invalid input 不转发；TTL 60s；不重放 |
| `POST /api/file` 写回 `{path, base64}`；tmp+rename；loopback-only | §2.5 | ✔ 含 expectedMtimeMs 冲突校验（UF-002） |
| `docId = SHA-256(绝对路径)` | §3 | ✔ 64hex、纯路径哈希（BR-009） |
| 工具名集合 = `docx:`/`markdown:` 前缀映射 | §4 | ✔ 10+1 docx / 4+1 markdown 全表（Task 18 输入） |
| 镜像点声明（4 处） | 文件头 | ✔ apps/*/renderer/control.ts、server.mjs、tab-genoffice/src/host/*、scripts/dev.mjs |
| 安全边界：控制面与写回默认 loopback；HOST=0.0.0.0 写回默认拒绝 | §6 | ✔ 沿用 ALLOW_ABS_PATHS 语义，无新环境变量 |

### 2. ASM 符合性

- ASM-001（app 维度预留）：✔ 端点形态 `/api/control/<app>/<docId>/…`。
- ASM-004（显式写回）：✔ §4 写回触发规则（BR-008）。
- ASM-006（工具命名）：✔ §4 前缀映射 + 生成器输入。
- ASM-007（docId 会话绑定）：✔ §3 M0 单文档单会话。
- ASM-008（SSE+POST，零依赖）：✔ §1 明确禁止 WebSocket 替代。

### 3. 禁止事项检查

- 无 WebSocket 依赖引入 ✔
- 无非 JSON 消息格式（SSE data 均为单行 JSON）✔
- 错误不吞：未注册/超时/非法输入/冲突/403 均显式定义 ✔

## 结论

通过。4 个镜像点声明存在；契约覆盖 BR-001~BR-010、INV-002/003/004/005/006 相关要求；UF-001~004 失败分支错误语义齐全（§5）。

## 备注

- `POST /api/control/<app>/<docId>/open` 标记为可选辅助端点（spec Task 8 亦为可选）。
- 连接数上限 32、pending TTL（tool-result 60s / context 30s）为 spec 要求登记的实现细节，已写入契约。
