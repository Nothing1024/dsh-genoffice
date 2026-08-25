# Phase 5 Summary

## 完成任务

- Task 23：spec 5.2 真实场景全套测试（执行矩阵逐行回放，证据落盘）
- Task 24：Phase 5 回归验证（命令级 + 5.4 专项检查 + validate_package.py 0 FAIL）

## 最终验收命令（5.1 入场券）

| 验证项 | 命令 | 结果 |
|---|---|---|
| 栈契约冒烟 | `node scripts/dev.mjs smoke` | 全部 PASS（含控制面端点形状 + 工具名集合镜像断言） |
| 上游 web 构建 | `npm run web:build -w @genoffice/{shell,docs,markdown}` | 构建成功 |
| 插件构建/类型检查 | `cd plugin && npm run build && npm run typecheck` | 全绿 |
| relay 端点形状 | curl（Task 4-8 各验证） | 与 contracts/control-api.md 一致 |
| 校验脚本 | `python3 .../validate_package.py docs/genoffice-dsh-control` | **0 FAIL / 0 WARN / 13 PASS**（5.2 引用证据 18 条路径齐全） |

## 5.2 执行矩阵（逐行结果）

| 矩阵行 | 结果 | Evidence |
|---|---|---|
| UF-001 主路径 | ✔ agent 工具链（context→replace→save）+ iframe 前后截图 + 原文件 diff 空 + console 无 error | UF-001/main-before.png、main-after.png、tool-calls.log、file-unchanged.diff |
| UF-001 执行器未注册 | ✔ 工具卡片「文档尚未在 GenOffice tab 中打开」 | UF-001/fail-unregistered.png |
| UF-001 编辑器未就绪 | ✔ 时序说明 + 代码路径（窗口亚秒级无法实拍） | UF-001/fail-notready.png |
| UF-001 非法参数 | ✔ `{ok:false, error:'invalid input'}`，文档不变 | UF-001/fail-invalid.json |
| UF-001 超时 | ✔ SSE 断线 → `{ok:false, error:'timeout'}`，不重放 | UF-001/fail-timeout.json |
| UF-002 主路径 | ✔ 按钮 loading→saved；「已保存到 path」；磁盘=iframe | UF-002/save-success.png + after.diff |
| UF-002 外部修改冲突 | ✔ 外部 touch 后保存 → conflict 提示，原文件未被覆盖 | UF-002/fail-conflict.png |
| UF-002 目标不可写 | ✔ `{ok:false, error:'EACCES…'}`，原文件不变 | UF-002/fail-readonly.json |
| UF-002 未打开文档 | ✔ 列表视图无保存按钮（保存动作不可达） | UF-002/fail-noopen.png |
| UF-003 主路径 | ✔ docs/markdown control=1 无任何 AI 元素；编辑功能完整 | UF-003/docs-control-noai.png、markdown-control-noai.png |
| UF-003 非 control 回归 | ✔ AI dock/快捷按钮照常（INV-001/INV-007） | UF-003/docs-noncontrol-ai.png、markdown-noncontrol-ai.png、noncontrol-ai.png |
| UF-003 旧构建兼容 | ✔ 机制说明（control=1 解析全在新增代码，旧构建自动忽略不崩溃） | UF-003/legacy-compat.png |
| UF-004 主路径 | ✔ context 返回块结构/索引与 iframe 一致 | UF-004/context-ok.json |
| UF-004 执行器未注册 | ✔ `{ok:false, error:'executor not registered'}` | UF-004/fail-unregistered.json |
| UF-004 文档过大 | ✔ 4001 块文档 → 8000 字符截断 + more-blocks 提示（截断策略） | UF-004/fail-large.json |

## 5.4 专项检查清单

- [x] 5.2 执行矩阵全部通过，evidence 齐全且与 2.5 EVD 清单一致（EVD-001~007 全部落盘）
- [x] 2.3 入口接线清单全部可达：聊天工具（agent 会话实测）、tab 打开（control=1 URL + 事件联动）、保存按钮（写入磁盘）、context（context 端点）
- [x] 保存按钮交互状态机齐全：idle / saving（写入中…）/ saved（已保存到 path）/ conflict / error
- [x] INV-001 非控制模式零回归（docs/markdown 截图对比基线）
- [x] INV-004 契约镜像：contracts/control-api.md ↔ server.mjs ↔ 适配器 ↔ 插件工具 ↔ smoke 断言逐处核对（smoke 三向断言 PASS）
- [x] INV-005 无绕过编辑器路径：编辑全走 executeTool/Tiptap；导出走 buildDocBytes/serializeDocText
- [x] INV-006 sandbox 未放松：`allow-scripts allow-same-origin allow-downloads` 实测不变
- [x] BR/UF/INV 逐条核销（见完成总结）
- [x] `待勘察` 定位已补全：markdown web-bridge markdownApi 注入点、markdown tools.ts AGENT_TOOLS 行号、preview-bus 行号、smoke 断言挂载点均已勘察并实现

## 剩余风险

- 多浏览器页面同时以 control=1 打开同一文件会抢占执行器（M0 单会话语义，ASM-007）；tab 与适配器已修复同页内 detach 场景。
- 工具名用 `_` 分隔符（`docx_*`/`markdown_*`）而非 spec 原文 `:`（DeepSeek API 工具名 pattern 限制，契约 §4 已修订注明）。
- 「写入磁盘」按钮直连 relay export 端点（无 client→host 工具 RPC）；与 save 工具同一写回链，边界由 relay 强制。
