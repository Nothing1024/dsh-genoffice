# genoffice-dsh-control Spec

> Version: 0.2.0 | Date: 2026-08-12 | Status: Ready 可执行
>
> 本文件是本需求的**唯一事实源**：事实基线、业务合同、技术方案、任务计划、验收协议全部在此。
> 其他文件（handoff.md、tasks.csv）只引用本文件，不复制内容。
>
> 填写三态规则：每个表格单元格只允许三种内容——
> 1. 验证过的事实（注明来源命令）；2. 显式假设 `ASM-xxx`；3. `待勘察`。
> 禁止编造看似合理的命令、symbol、文件名。

---

## 1. 事实基线与假设

### 1.1 需求与运行模式

| 项 | 结论 |
|---|---|
| 原始需求 | 来自上下文推断（`/prd-workflow oneclick` 空输入）：让 DSH 控制 GenOffice 文档编辑——docs/markdown 先行（M0），去掉 GenOffice 内嵌 AI 助手（AI 面板/BYOK），AI 大脑归 DSH；后续 sheets/slides/pdf 走同一控制契约（M1-M3 另立项） |
| 输入类型 | empty（上下文回退） |
| Mode | oneclick |
| 置信度 | 高 |
| 输出目录 | `/Users/nothing/workspace/dsh/genoffice/docs/genoffice-dsh-control/`（栈编排层，跨 upstream + plugin 两仓库） |

### 1.2 任务类型路由

| 维度 | 结论 |
|---|---|
| 任务类型 | frontend（控制适配器/去 AI dock/插件 tab 接线）+ backend（relay 控制面/写回端点/契约）+ infra（构建、smoke 断言、契约镜像） |
| 主要风险 | 契约跨三侧镜像漂移（upstream app / relay / 插件）；iframe 生命周期与执行器注册时机；写回原子性与外部修改冲突；零依赖 relay 下双向通道实现（SSE+POST） |
| 行号引用策略 | 业务/前端/API 优先，行号仅作 hint；三段式定位以 symbol + grep anchor 为准 |
| 必需验收方式 | browser（chrome MCP）/ contract（curl）/ manual（非控制模式回归） |
| 必须覆盖用户场景 | 控制编辑、显式写回、无 AI 助手模式、文档上下文供给（UF-001~004） |

### 1.3 勘察事实清单

> 每条事实来自本会话实际执行的命令/操作。勘察日期 2026-08-12。

| 事实 | 来源命令 | 输出摘要 |
|---|---|---|
| relay `:8787` 运行中，health 返回 `{ok:true, name:"genoffice-web-relay", port:8787}` | `curl -s http://localhost:8787/api/health` | relay UP |
| DSH 插件实例 `:3099` 与 harness GUI `:3080` 均 200 | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3099/` 等 | 3099/3080 均 200 |
| 契约冒烟 14 项全 PASS（dir/file/inject/open 形态/事件名镜像/tab⊆渲染器） | `node scripts/dev.mjs smoke`（栈根） | 全部通过 ✔ |
| relay 端点路由集中在 `handleApi(req,res,pathname,body,url)` | `grep -n "async function handleApi" upstream/web/server.mjs` | L209；`createServer` L486 |
| relay 现有端点：`/api/health` L210、`/api/fetch-file` L215、`/api/files` L241、`/api/file` L272、`/api/dir` L302、`/api/inject` POST L353 / GET L379 | `grep -n "api/health\|api/dir\|api/file\|..." upstream/web/server.mjs` | 全部为 GET/POST，无写文件端点 |
| docs 的 AI dock 挂载：`import { AiPanel }` L27；`showAi` state L287；`<div className={ai-dock...}>` L2726；`<AiPanel ...>` L2728 | `grep -n "ai-dock\|AiPanel\|showAi" apps/docs/src/renderer/App.tsx` | 确认挂载点 |
| markdown 的 AI dock 挂载：`AiPanel` import L21；ai-dock L385；AiPanel L397 | `grep -n "ai-dock\|AiPanel\|showAi" apps/markdown/src/renderer/App.tsx` | 确认挂载点 |
| docs web-bridge 实现 `aiStream`/`aiStreamCancel`/`getAiSettings`/`setAiSettings`（BYOK 直连） | `read apps/docs/src/renderer/web-bridge.ts` | aiStream L704-710；aiChat L687-702 |
| docs web-bridge 用 `new URLSearchParams(location.search)` 解析 `open=` 目标 | `grep -n "URLSearchParams" apps/docs/src/renderer/web-bridge.ts` | L976 |
| docs skill 工具清单（10 个）：`AGENT_TOOLS` 含 get_document_context/read_blocks/insert_content/replace_blocks/apply_commands/web_search/image_search/insert_image/insert_chart/edit_chart | `grep -n "name: '" apps/docs/src/renderer/ai/tools.ts` | L28 起 |
| markdown skill 同样形状（`createMarkdownSkill(getEditor)`，AGENT_TOOLS 同 docs 系） | `read apps/markdown/src/renderer/ai/markdown-skill.ts` | 绑定 Tiptap Editor |
| agent-core 形状：`AgentToolCall{id,name,input}` L9；`ToolExecution{output,isError,mutated,summary,display}` L53；`AgentSkill{systemPrompt,tools,buildContext,executeTool}`（skill.ts） | `read packages/agent-core/src/types.ts` | 控制契约可直接沿用 |
| 编辑原语：`replaceBlockRange`/`insertBlocksAfter` 等块级函数绑定 Tiptap Editor | `read apps/docs/src/renderer/ai/protocol.ts` | L809 / L888 |
| 插件 tab-genoffice：`PREVIEWABLE = {docx:'docs', md:'markdown'}`；iframe sandbox=`allow-scripts allow-same-origin allow-downloads` | `read plugin/packages/tab-genoffice/src/tabs/genoffice.tsx` | L24 / L251 |
| 插件 client 消费 `dsh:open-local-file` 事件并 pushPreview + activate tab | `read plugin/packages/tab-genoffice/src/client/index.ts` | L30/L43-52 |
| DSH 工具注册模式：`ctx.tools.register(createDocumentTool(ctx, resolved))` | `grep -n "tools.register" plugin/packages/document/src/index.ts` | L46；工具定义模板见 `createDocumentTool` L201 |
| 栈根 git 基线：clean，HEAD `7a4fffe`；upstream clean；plugin 有预先存在的未提交改动（README.md/tasks.csv/package.json/artifact-contract.ts/ArtifactBody.tsx，与本需求无关） | `git status --short` / `git log --oneline -3`（三仓库） | 基线记录 |
| 浏览器实景：docs 页面 AI 面板含 Genspark AI 快捷按钮（总结/润色/排版）+ 右侧 AI dock（起草/附件/修订追踪/发送）+ ⚙ AI 设置（服务商/API Key/模型，localStorage BYOK） | chrome MCP 快照 `http://localhost:8787/docs/` | 实景确认 |
| 浏览器实景：插件 iframe 预览 md 时 markdown app 内 AI dock 完整存在 | chrome MCP 快照（3099 GenOffice tab 打开 `陶瓷项目模型调研报告.md`） | 实景确认 |

### 1.4 假设清单

| 假设 ID | 内容 | 风险 | 确认方式 |
|---|---|---|---|
| ASM-001 | 拓扑：混合——统一控制契约；docs/markdown 执行器在浏览器 iframe（relay 控制面转发），sheets/slides/pdf 后续服务端执行器走同一契约 | 后续 app 接入时契约需扩展 app 维度 | M0 契约设计时预留 `app` 维度（`/api/control/<app>/<docId>/…`） |
| ASM-002 | 不等官方 Web 版（Issue #5 在测），按 M0 自研推进 | 官方版本可能改变 app 内部结构 | 契约/镜像点集中在 contracts/ 与 app 内适配器，可替换后端 |
| ASM-003 | 评审归属：AI 编辑 diff/回滚/修订确认归 DSH 侧（P1 迭代）；M0 只保证"控制编辑 + 显式写回"，iframe 内不做 review 面板 | M0 无 diff 评审 UX，用户靠 iframe 内可见变化确认 | 2.3 节脚本不含评审步骤；P1 另立项 |
| ASM-004 | 写回策略：显式写回——编辑工具只改 iframe 内文档状态；写回由显式动作触发（tab「写入磁盘」按钮 / `docx:save` `markdown:save` 工具），经 relay `POST /api/file` 原子写回原路径 | 用户忘记保存；多会话并发写同一文件 | BR-008/UF-002 定义触发与冲突处理；写回前 mtime 校验 |
| ASM-005 | 去 AI 助手方式：URL 参数 `control=1` 运行时隐藏 AI dock（不做构建裁剪/依赖摘除），保证非控制模式零回归 | 面板代码仍在 bundle 中（体积/表面残留） | INV-001 回归断言；P2 评估构建裁剪 |
| ASM-006 | DSH 工具命名：`docx:*` / `markdown:*` 前缀；工具定义由 skill 的 `AGENT_TOOLS` 生成（name 映射），沿用 AgentToolCall/ToolExecution 形状 | 工具数量与 skill 同步漂移 | INV-004 镜像 + smoke 断言工具名集合 |
| ASM-007 | 会话绑定：`docId = SHA-256(绝对路径)`；一个 iframe 同时只绑定一个 docId；M0 单文档单会话 | 多文档并发编辑不支持（M1 扩展） | BR-009；5.2 只测单文档 |
| ASM-008 | 控制通道传输：下行 relay→iframe 用 SSE（EventSource，零依赖），上行 iframe→relay 用 `POST /api/control/notify`；保持 `server.mjs` 零依赖（Node ≥22） | SSE 长连接在 iframe 隐藏/切 tab 时被浏览器节流 | 适配器在 document.visibilitychange 恢复重连；工具调用超时由 host 侧 deadline 兜底 |

---

## 2. 业务合同

> 本章是 BR/UF/INV/EVD 的唯一定义处。任务、handoff、review 一律引用 ID，不复制表格。

### 2.1 BR 业务规则

| 规则 ID | 规则 | 正例 | 反例 | 影响范围 | 验证方式 |
|---|---|---|---|---|---|
| BR-001 | 控制模式激活：docs/markdown 页面 URL 带 `control=1` 时进入控制模式（注册执行器 + 隐藏 AI dock）；不带时行为与现状完全一致 | `/docs/?control=1&open=path:…` → 控制模式 | `/docs/?open=path:…` → 非控制模式，AI dock 正常 | docs/markdown app | browser 截图对比 + smoke |
| BR-002 | 工具调用形状：控制面工具调用必须携带 `{id, name, input}`；返回 `{output, isError, mutated, summary}`；非法 JSON input 返回 isError 并附解析错误 | 合法调用 → `{ok:true, execution:{…}}` | input 非 JSON → `{ok:false, error}`，工具不执行 | relay 控制面 + 适配器 | contract curl |
| BR-003 | 执行器注册：iframe 控制适配器挂载时注册 `docId→连接`，卸载/断线注销；未注册 docId 的工具调用返回明确错误 | 已打开 control 文档后 tool 调用可达 | 无 iframe 打开时 tool 调用 → `{ok:false, error:'executor not registered'}` | relay 注册表 | contract curl + browser |
| BR-004 | 写回原子性：`POST /api/file` 采用 tmp+rename；任何失败不改变原文件字节 | 写回成功 → 原路径内容替换 | 目标不可写 → `ok:false`，原文件保留 | relay 写回端点 | contract + 文件 diff |
| BR-005 | 写回安全边界：`POST /api/file` 仅允许 loopback 来源（沿用 `ALLOW_ABS_PATHS` 语义）；`HOST=0.0.0.0` 且未设 `GENOFFICE_WEB_OPEN_PATHS=1` 时拒绝 | loopback 请求 → 允许 | 非 loopback → 403 | relay | contract curl（模拟 Host 头） |
| BR-006 | AI 助手不可见：控制模式下 docs/markdown 不渲染 AI dock、Ribbon「Genspark AI」按钮、AI 总结/润色/排版快捷按钮 | control=1 页面无任何 AI 助手 UI | control=1 页面出现 AI dock → FAIL | docs/markdown App.tsx | browser 截图 |
| BR-007 | DSH 工具注册：插件注册 `docx:*`/`markdown:*` 工具，定义由对应 skill 的 `AGENT_TOOLS` 生成；工具名集合与契约镜像一致 | agent 可见 `docx:insert_content` 等全部工具 | 工具名与契约不一致 → smoke FAIL | 插件 host + contracts | smoke 断言 + DSH 会话实测 |
| BR-008 | 写回触发：编辑工具只改 iframe 内文档状态；写回仅由显式动作（tab「写入磁盘」/ `docx:save` `markdown:save` 工具）触发 | 编辑后文件字节不变；触发保存后变化 | 编辑工具隐式写盘 → FAIL | 插件 + relay | 文件 diff 前后对比 |
| BR-009 | 文档身份：`docId = SHA-256(绝对路径)`；同路径重复打开复用同一 docId | 同一路径两次打开 → 同 docId | 不同路径 → 不同 docId | relay 注册表 | contract curl |
| BR-010 | 控制通道超时：host 侧工具调用带 deadline（沿用 dsh-timeout 模式）；SSE 断线重连后未完成调用返回超时错误 | 正常调用 < deadline → 成功 | 断线/无响应超时 → `{ok:false, error:'timeout'}` | 插件 host + 适配器 | 故障注入（kill iframe） |

### 2.2 UF 用户验收场景（索引）

| 场景 ID | Given | When | Then | 角色 | 验证方式 | Evidence |
|---|---|---|---|---|---|---|
| UF-001 | GenOffice tab 已打开某 docx/md（control 模式），DSH 会话进行中 | 用户指示"把第 3 章改成表格"，agent 调用 `docx:get_document_context` → `docx:read_blocks` → `docx:replace_blocks` | iframe 内文档块级更新实时可见；agent 汇报"已修改"；原文件字节未变（未触发写回） | 用户 + DSH agent | browser + contract | EVD-003 |
| UF-002 | 文档已被 AI 编辑（iframe 内 dirty 状态） | 用户点击 tab「写入磁盘」或 agent 调用 `docx:save` | relay `POST /api/file` 原子写回；tab 提示"已保存到 \<path\>"；磁盘内容 = iframe 当前内容 | 用户 | browser + 文件 diff | EVD-005 |
| UF-003 | 用户经 DSH GenOffice tab 打开文档（control=1） | 页面加载完成 | 无 Genspark AI 按钮、无 AI 总结/润色/排版、无右侧 AI dock；编辑器功能完整；非 control 模式页面 AI 助手照常 | 用户 | browser 截图 | EVD-002 / EVD-006 |
| UF-004 | agent 需编辑文档但尚未读取内容 | agent 调用 `/api/control/\<app\>/\<docId\>/context` | 返回与 skill `buildContext` 等价的文档上下文（含块索引/序号）；执行器未注册时返回明确错误 | DSH agent | contract | EVD-001 |

> 说明：UF-001~004 均为用户可见（agent 行为即用户体验），全部需要 2.3 节流程脚本；无豁免。

### 2.3 核心业务流程（步骤级交互脚本）

#### UF-001: DSH 控制编辑文档

**前置状态**：GenOffice tab 处于预览态（iframe 已加载 control 模式 docs/markdown 页面并注册执行器）；DSH 会话进行中；用户消息包含编辑意图。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 发送"把第 3 章改成表格" | 聊天消息发出 | agent 规划工具调用链 | 消息发出，agent 开始思考 |
| 2 | — | agent 显示工具调用卡片（如"读取文档上下文"） | 插件 host 调用 `GET /api/control/<app>/<docId>/context` | 工具卡片展示进行中 |
| 3 | — | — | agent 调用 `docx:read_blocks`（带块范围） | 同上 |
| 4 | — | — | agent 调用 `docx:replace_blocks {start,end,html}`；host 经 relay 控制面转发 iframe；适配器 `executeTool` → Tiptap dispatch | iframe 内对应块被替换并高亮（aiChanged）；无整页刷新 |
| 5 | — | 工具结果卡片返回 `{output, mutated:true, summary}` | agent 汇总 | 聊天回复"已完成第 3 章表格化"，附摘要；原文件未变（BR-008） |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 执行器未注册 | iframe 未打开/已关闭/断线，tool 调用到达 relay | 工具结果卡片显示错误"executor not registered" | relay 返回 `{ok:false, error}`；agent 不再重试同调用 | 用户重新打开文档（tab 预览重载）后重发指令 |
| 编辑器未就绪 | 文档字节仍在加载，编辑器实例未挂载 | 工具结果卡片显示"editor not ready" | 适配器返回 isError；不修改文档 | agent 等待后重试（P0 任务含重试策略） |
| 非法参数 | replace_blocks 的 html 无法解析（非 GFM/块语法） | 工具结果卡片显示解析错误 | 适配器返回 isError 附错误详情；文档不变 | agent 修正参数重试（错误信息引导） |
| 控制通道超时 | SSE 断线/iframe 卡死，host deadline 到期 | 工具结果卡片显示 timeout | BR-010 超时语义；不重放调用（避免重复编辑） | 用户刷新 tab 后重发指令 |

**界面状态机**：

```text
idle → agent-planning → tool-running（逐卡）→ edited（iframe 可见变化）→ agent-reply
                │                              │
                └── error（卡片展示，可重试）────┘
```

**入口接线清单**（本流程从哪些真实入口可达；实现任务必须包含接线）：

- DSH 聊天输入框发送消息 → agent 工具调度 → 插件 host 工具（`docx:*`/`markdown:*` 注册，Task P4 接线）
- GenOffice tab 打开文档（文件浏览点击 / `dsh:open-local-file` 事件联动）→ iframe control 模式（Task P4 接线）
- relay 控制面（/api/control/* + SSE）→ iframe 适配器（Task P1/P2 接线）

#### UF-002: 显式写回

**前置状态**：文档已被 AI 编辑（或用户手动编辑），iframe 内文档为 dirty 状态；原文件路径已知（`path:` 形态打开）。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 点击 tab 工具栏「写入磁盘」（或对 agent 说"保存"→ agent 调 `docx:save`） | 按钮进入 loading/禁用态 | 插件发起保存：适配器导出当前文档字节（复用 save/export 管线）→ POST relay `/api/control/<docId>/export` → relay `POST /api/file` tmp+rename 原子写回 | 按钮恢复；tab 提示"已保存到 /path/xxx" |
| 2 | — | — | 返回写回结果 `{ok:true, path}` | agent 汇报"已保存"（工具调用路径） |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 目标不可写 | 原文件被删除/目录只读 | 按钮恢复；toast 或工具卡片错误"写入失败：…" | relay 返回 `{ok:false, error}`；原文件不变（BR-004） | 用户另存/修复权限后重试 |
| 外部修改冲突 | 原文件 mtime 与打开时不一致 | 提示"文件已被外部修改，未覆盖" | 写回前 mtime 校验失败 → 拒绝写回（沿用桌面版 external-change 思路，M0 简化实现） | 用户重新打开文件（丢弃 iframe 内编辑需确认） |
| 无打开文档 | 未进入 control 模式即点保存 | 按钮禁用 | 保存动作校验执行器注册状态，未注册则不发起 | 先打开文档 |

**界面状态机**：

```text
idle → saving（按钮 loading）→ saved | conflict | error（均可重试）
```

**入口接线清单**：

- tab 工具栏「写入磁盘」按钮（tab-genoffice 面板新增，Task P4 接线）
- `docx:save` / `markdown:save` 工具（Task P4 接线）
- 适配器导出字节链路（Task P2 接线）

#### UF-003: 无 AI 助手模式

**前置状态**：用户通过 DSH GenOffice tab 打开文档；URL 由插件生成并带 `control=1`。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 在文件浏览列表点击 docx/md 行 | 预览 loading 态 | 插件生成 `/docs/?control=1&open=path:<enc>` 或 `/markdown/?control=1&open=path:<enc>` | 预览区出现编辑器 |
| 2 | — | — | app 解析 `control=1`：不渲染 AI dock、Ribbon AI 快捷按钮；适配器注册执行器 | 页面无任何 AI 助手 UI；编辑/预览功能完整 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 旧构建无适配器 | relay 托管的 web-dist 未含适配器代码（缓存/未重建） | 页面按普通模式渲染（AI dock 出现） | `control=1` 参数被忽略（兼容降级） | 重建 web-dist 后刷新 |
| 非 control 回归 | 用户直接用旧 URL（无 control=1）打开 | AI dock 正常出现 | 行为与现状一致（INV-001） | —（预期行为） |

**界面状态机**：

```text
loading → editor-ready（control: 无 AI 元素 / 非 control: AI 元素照常）
```

**入口接线清单**：

- tab-genoffice `previewUrlFor` 生成带 `control=1` 的 URL（Task P4 接线）
- docs/markdown app 解析 `control=1` 并条件渲染（Task P3 接线）
- app 适配器注册（Task P2 接线）

#### UF-004: 文档上下文供给

**前置状态**：执行器已注册；agent 需要文档状态。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | （agent 侧）调用 `POST /api/control/<app>/<docId>/context` | 工具卡片"获取文档上下文" | relay 转发适配器 → 执行 skill `buildContext` 等价逻辑 | 返回上下文文本（块结构/索引），agent 据此规划编辑 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 执行器未注册 | 文档未打开 | 工具卡片错误 | `{ok:false, error:'executor not registered'}` | 先打开文档 |
| 文档过大 | 上下文超长（ASM：沿用现有序列化上限，上限值待勘察） | 工具卡片错误/截断说明 | 截断或返回错误（按上限策略） | agent 用 read_blocks 分段读取 |

**界面状态机**：

```text
idle → context-fetching → context-returned | error
```

**入口接线清单**：

- 插件 host 工具内部调用（Task P4 接线）
- relay context 端点 + 适配器实现（Task P1/P2 接线）

### 2.4 INV 不变量

| 不变量 ID | 内容 | 关联 BR/UF | 验证方式 |
|---|---|---|---|
| INV-001 | 非控制模式（URL 无 `control=1`）的 docs/markdown 页面行为与现状完全一致：AI dock 可用、BYOK 设置可用、保存=下载副本、预览副本语义不变 | BR-001, UF-003 | browser 截图对比（EVD-006） |
| INV-002 | 控制面与写回端点默认仅 loopback；网络暴露（`HOST=0.0.0.0`）且未显式开启时控制面写回/工具调用默认拒绝 | BR-005 | contract curl 模拟非 loopback |
| INV-003 | 写回原子性：tmp+rename；任何失败不破坏原文件字节 | BR-004, UF-002 | 故障注入 + 文件 diff |
| INV-004 | 契约镜像纪律（扩展既有模式）：`contracts/control-api.md` 为控制契约单一事实源；app 适配器 / relay / 插件三侧镜像点同步；`scripts/dev.mjs smoke` 断言形状与工具名集合 | BR-002, BR-007 | smoke 断言 |
| INV-005 | 编辑器状态唯一性：所有文档变更必须经编辑器实例（`executeTool` / Tiptap dispatch）执行；禁止绕开编辑器直接改写文件字节或 IndexedDB 快照 | UF-001 | 代码 review + 工具链实测 |
| INV-006 | iframe sandbox 不放松：保持 `allow-scripts allow-same-origin allow-downloads`；控制通道只经 HTTP/postMessage 到达 | UF-001 | 代码 review |
| INV-007 | 插件预览语义：未进入控制模式时现有预览行为（保存=下载副本、不写回原文件）不变 | UF-003 | browser 回归 |

### 2.5 EVD 证据清单

| 证据 ID | 类型 | 期望证据 | 保存位置 |
|---|---|---|---|
| EVD-001 | api | context/tool/写回端点 request+response JSON 样例（正常/未注册/非法参数/非 loopback 各一发） | `evidence/API-control/` |
| EVD-002 | screenshot | control=1 模式下 docs 与 markdown 页面截图（无 AI dock） | `evidence/UF-003/` |
| EVD-003 | log+screenshot | 端到端：agent 工具调用链日志 + iframe 编辑前后截图 + 工具结果 JSON；原文件 diff 为空（未写回） | `evidence/UF-001/` |
| EVD-004 | log | `node scripts/dev.mjs smoke` 全绿日志（含新增控制契约断言） | `evidence/phase-1/` |
| EVD-005 | diff | 写回前后文件字节 diff + mtime 记录 + tab 提示截图 | `evidence/UF-002/` |
| EVD-006 | screenshot | 非 control 模式回归截图（AI dock 存在 + 保存=下载提示） | `evidence/UF-003/` |
| EVD-007 | log | plugin `npm run build` + `npm run typecheck` 通过日志；upstream `npm run web` 构建通过日志 | `evidence/phase-0/` |

### 2.6 角色与权限矩阵

| 角色 | 可见 | 可操作 | 禁止 | 失败提示 | 验证场景 |
|---|---|---|---|---|---|
| 用户 | DSH 聊天 + GenOffice tab（编辑器/保存按钮） | 发起编辑指令、触发写回 | 直接操作 iframe 内 AI 面板（M0 已隐藏） | tab 内错误提示/toast | UF-001/002/003 |
| DSH agent | 工具注册表 + 文档上下文 | 调用 `docx:*`/`markdown:*` 工具 | 绕过工具直接改文件（INV-005） | 工具结果 isError 语义 | UF-001/004 |
| relay/插件 host | 本机文件系统（loopback） | 控制面转发、写回 | 非 loopback 写回（INV-002） | `ok:false` + error | UF-002 |

### 2.7 负向 / 破坏性场景

| 场景 | Given | When | Then | Evidence |
|---|---|---|---|---|
| 写回冲突 | 文件被外部修改（mtime 变化） | 触发写回 | 拒绝写回，提示冲突，原文件不变 | EVD-005 |
| 断线 | SSE 连接中断 | agent 调用工具 | 超时错误，不重放调用，无重复编辑 | EVD-003（故障注入） |
| 非法输入 | agent 发出非 JSON/未知工具名 | 控制面收到调用 | `ok:false` + 明确错误，执行器不受影响 | EVD-001 |
| 非 loopback 写回 | 伪造 Host 头请求 `POST /api/file` | 请求到达 relay | 403 拒绝 | EVD-001 |
| 旧构建兼容 | relay 托管旧 web-dist（无适配器） | 打开 control=1 URL | 按普通模式渲染，不崩溃（兼容降级） | EVD-006 |

### 2.8 非目标

- 不做 sheets/slides/pdf 的控制（M1-M3 另立项；契约预留 `app` 维度）
- 不做 AI 编辑的 diff/回滚/修订评审 UX（ASM-003，P1 迭代）
- 不做构建裁剪摘除 AI 依赖（ASM-005，仅运行时隐藏）
- 不做多文档并发编辑会话（ASM-007）
- 不改桌面版（Electron）任何行为；上游仓库保持可同步
- 不改 iframe sandbox 策略（INV-006）

---

## 3. 技术方案

> Stage 1 交付 3.3 定位清单；3.1/3.2/3.4 由 Stage 2 补全。

### 3.1 架构 Before / After

```text
Before:
DSH GUI（3099）                                    relay :8787（零依赖 Node）
┌──────────────────────────────┐                  ┌────────────────────────────┐
│ 聊天 ── create-document 工具  │                  │ 静态托管 apps web-dist      │
│ GenOffice tab                │                  │ /api/dir /api/file(读)      │
│  └─ iframe open=path: (预览)  │ ── GET /api/* ──►│ /api/search/* /api/inject  │
│      └─ AI dock 内嵌(BYOK)    │                  │ （无写文件端点）             │
└──────────────────────────────┘                  └────────────────────────────┘

After:
DSH GUI（3099）                                    relay :8787
┌──────────────────────────────┐                  ┌────────────────────────────┐
│ 聊天 ── docx:*/markdown:* 工具│                  │ 静态托管 + 现有端点         │
│ GenOffice tab                │                  │ 控制面（新增）：            │
│  └─ iframe control=1         │ ── HTTP ───────► │  执行器注册表 docId→连接    │
│      └─ 控制适配器(新)        │ ◄─ SSE ───────── │  /api/control/*            │
│      └─ 无 AI dock(新)       │                  │  POST /api/file（写回，新） │
│  └─ 「写入磁盘」按钮(新)      │ ── 导出字节 ────►│   tmp+rename 原子写        │
└──────────────────────────────┘                  └────────────────────────────┘
        ▲ DSH agent 大脑（模型/循环/工具/对话）
```

### 3.2 模块改造

| 模块 | 职责 | 改造说明 |
|---|---|---|
| `upstream/web/server.mjs` | relay：静态托管 + 目录/文件读 + 搜索 + 注入 | +控制面：SSE 下行端点、`POST /api/control/notify`（上行）、`/api/control/<app>/<docId>/context`、`/api/control/<app>/<docId>/tool`、执行器注册表（内存）；+`POST /api/file` 写回（tmp+rename、loopback 边界） |
| `apps/docs/src/renderer/control.ts`（新） | docs 控制适配器 | 解析 `control=1`；注册/注销执行器；SSE 订阅下行调用；桥接 `executeTool`（复用 `ai/tools.ts` 与协议原语）；导出当前文档字节（复用 save/export 管线）；上行 POST 结果 |
| `apps/markdown/src/renderer/control.ts`（新） | markdown 控制适配器 | 同上，执行器来自 `ai/tools.ts`（markdown） |
| `apps/docs/src/renderer/App.tsx` / `apps/markdown/src/renderer/App.tsx` | 编辑器外壳 | `control=1` 时条件渲染：不挂 ai-dock、不渲染 Ribbon「Genspark AI」及 AI 快捷按钮；非 control 分支零改动 |
| `contracts/control-api.md`（新） | 控制契约单一事实源 | 端点形状、SSE 消息格式、工具调用/结果形状、docId 规则、镜像点声明、安全边界 |
| `scripts/dev.mjs` | 栈工具 | smoke 新增：控制面端点形状、工具名集合镜像（skill ↔ DSH 注册 ↔ 契约）、`?control=1` 可达性 |
| `plugin/packages/tab-genoffice/src/tabs/genoffice.tsx` | 插件 tab | `previewUrlFor` 生成带 `control=1` 的 URL；新增「写入磁盘」保存按钮（loading/成功/冲突/失败态） |
| `plugin/packages/tab-genoffice/src/host/`（新） | 插件 host 工具 | `docx:*`/`markdown:*` 工具注册：定义由 skill `AGENT_TOOLS` 生成（name 映射 `docx:<name>`）；执行 = 调 relay 控制面 + deadline 超时 + 错误语义；`docx:save`/`markdown:save` 写回工具 |
| `plugin/packages/tab-genoffice/src/client/` | 插件 client | iframe 打开事件带 control 参数；保存动作接线（host 工具 ↔ tab 按钮 ↔ 适配器导出）；preview-bus 复用 |
| `contracts/relay-api.md` | 契约 | +`POST /api/file` 写回端点条目（与 control-api.md 分工：控制面专章） |

### 3.3 三段式定位清单

| 文件 | 稳定定位 | 搜索定位 | 行号 hint | 备注 |
|---|---|---|---|---|
| `upstream/web/server.mjs` | `async function handleApi` / `createServer` | `grep -n "async function handleApi" upstream/web/server.mjs` | L209 / L486 | 控制面与写回端点挂载点 |
| `upstream/apps/docs/src/renderer/App.tsx` | `import { AiPanel }` / `ai-dock` div / `<AiPanel` | `grep -n "ai-dock\|AiPanel" apps/docs/src/renderer/App.tsx` | L27 / L2726 / L2728 | control=1 条件渲染点 |
| `upstream/apps/markdown/src/renderer/App.tsx` | `import { AiPanel }` / `ai-dock` div / `<AiPanel` | `grep -n "ai-dock\|AiPanel" apps/markdown/src/renderer/App.tsx` | L21 / L385 / L397 | control=1 条件渲染点 |
| `upstream/apps/docs/src/renderer/web-bridge.ts` | `const desktop: DesktopApi` / `aiStream` / `new URLSearchParams(location.search)` | `grep -n "URLSearchParams\|aiStream" apps/docs/src/renderer/web-bridge.ts` | L489 / L704 / L976 | 适配器兄弟模块参照；open= 解析链 |
| `upstream/apps/markdown/src/renderer/web-bridge.ts` | `window.markdownApi` 注入 | `grep -n "markdownApi" apps/markdown/src/renderer/web-bridge.ts` | 待勘察 | 适配器兄弟模块参照 |
| `upstream/apps/docs/src/renderer/ai/tools.ts` | `export const AGENT_TOOLS` / `executeTool` | `grep -n "AGENT_TOOLS\|export function executeTool" apps/docs/src/renderer/ai/tools.ts` | L28 起 | 执行器复用源 |
| `upstream/apps/markdown/src/renderer/ai/tools.ts` | `AGENT_TOOLS` / `executeTool` | `grep -n "AGENT_TOOLS" apps/markdown/src/renderer/ai/tools.ts` | 待勘察 | 执行器复用源 |
| `upstream/apps/docs/src/renderer/ai/docs-skill.ts` | `createDocsSkill` | `grep -n "createDocsSkill" apps/docs/src/renderer/ai/docs-skill.ts` | L11 | skill 形状参照 |
| `upstream/apps/markdown/src/renderer/ai/markdown-skill.ts` | `createMarkdownSkill` | `grep -n "createMarkdownSkill" apps/markdown/src/renderer/ai/markdown-skill.ts` | L37 | skill 形状参照 |
| `upstream/packages/agent-core/src/types.ts` | `interface AgentToolCall` / `interface ToolExecution` / `interface AgentSkill` | `grep -n "AgentToolCall\|ToolExecution" packages/agent-core/src/types.ts` | L9 / L53 | 契约类型源 |
| `plugin/packages/tab-genoffice/src/tabs/genoffice.tsx` | `const PREVIEWABLE` / iframe sandbox / `previewUrlFor` | `grep -n "PREVIEWABLE\|sandbox\|previewUrlFor" plugin/packages/tab-genoffice/src/tabs/genoffice.tsx` | L24 / L251 / L57 | control=1 URL 生成 + 保存按钮挂载点 |
| `plugin/packages/tab-genoffice/src/tabs/preview-bus.ts` | `pushPreview` / `takePendingPreview` | `grep -n "pushPreview\|takePendingPreview" plugin/packages/tab-genoffice/src/tabs/preview-bus.ts` | 待勘察 | 打开事件复用 |
| `plugin/packages/tab-genoffice/src/client/index.ts` | `LOCAL_FILE_OPEN_EVENT` / `apply` | `grep -n "LOCAL_FILE_OPEN_EVENT" plugin/packages/tab-genoffice/src/client/index.ts` | L30 / L36 | 事件消费 |
| `plugin/packages/document/src/tools/create-document.ts` | `createDocumentTool` / `defineTool` | `grep -n "createDocumentTool" plugin/packages/document/src/tools/create-document.ts` | L201 | DSH 工具定义模板 |
| `plugin/packages/document/src/index.ts` | `ctx.tools.register` | `grep -n "tools.register" plugin/packages/document/src/index.ts` | L46 | 工具注册模式 |
| `contracts/relay-api.md` | 端点表 / `?open=` target 形态 | — | — | 新契约文件参照 |
| `contracts/events.md` | 事件契约 / 镜像点声明 | — | — | 镜像纪律参照 |
| `scripts/dev.mjs` | smoke 断言块 | `grep -n "smoke\|PASS" scripts/dev.mjs` | 待勘察 | 新增断言挂载点 |

### 3.4 API / 数据 / 权限 / 路由影响

| 类型 | 是否影响 | 说明 | 兼容策略 |
|---|---|---|---|
| API | 是（新增） | relay 新增 `/api/control/*`（SSE + notify + context + tool）与 `POST /api/file`；CORS 沿用现有 loopback 白名单 | 全部新增端点，不动现有端点形状；smoke 断言向后兼容 |
| 数据 | 是（轻量） | relay 新增内存执行器注册表（docId→连接，进程重启即失效）；app 端 IndexedDB/文件句柄语义不变 | 注册表无持久化；断线重连由适配器负责（ASM-008） |
| 权限 | 是（收紧） | 写回与控制面默认仅 loopback（INV-002）；`POST /api/file` 非 loopback 拒绝 | 沿用 `ALLOW_ABS_PATHS` 语义，不新增环境变量（ASM 可评审） |
| 路由 | 是（参数级） | app 内无新路由；新增 `?control=1` 查询参数，打开后从地址栏清除（沿用 open= 清除逻辑） | 无该参数时走原逻辑（INV-001） |

---

## 4. Phase 计划与任务详情

> Phase 依赖链：

```text
P0 基线与契约 ──► P1 relay 控制面 ──► P2 app 控制适配器 ──► P3 去 AI 助手 ──► P4 DSH 插件工具与接线 ──► P5 端到端验收
```

> 任务状态跟踪：任务数 24 ≥ 8，用同目录 `tasks.csv`。

### Phase 0: 基线与契约

> 你在哪里：三仓库基线已勘察（栈根 clean@7a4fffe、upstream clean、plugin 有无关未提交改动）；smoke 14 项全绿。
> 做完之后：`contracts/control-api.md` 落盘为控制契约单一事实源；基线证据归档。

### Task 1: 记录基线并归档证据

- **关联**：EVD-007 / INV-004（前置勘察）；UF 写 NA（内部任务，无用户可见流程）
- **前置任务**：无
- **风险等级**：P2

**为什么做**：为后续任务提供可回滚的基线快照与命令证据（三态规则：事实必须来自实际命令）。

**涉及文件与定位**：

- `docs/genoffice-dsh-control/evidence/phase-0/`：新建，`commands.log` / `baseline.md`

**具体操作**：

1. 运行并记录：`node scripts/dev.mjs status`、`node scripts/dev.mjs smoke`（栈根）
2. 运行并记录：三仓库 `git status --short` 与 `git log --oneline -3`
3. 记录浏览器基线：chrome MCP 打开 `http://localhost:8787/docs/`（非 control 模式，AI dock 存在）截图存档 `evidence/phase-0/baseline-docs.png`（作为 INV-001 对照基线）

**验证**：`ls evidence/phase-0/` → 含 commands.log、baseline.md、baseline-docs.png

**Evidence**：`evidence/phase-0/`

**注意事项**：不要修改任何源码；截图必须是非 control 模式（对照基线）。

### Task 2: 定义 contracts/control-api.md 控制契约

- **关联**：BR-001~BR-010 / INV-002 / INV-004；UF 写 NA（内部契约任务，UF 由 Task 5/6/18 消费）
- **前置任务**：1
- **风险等级**：P0

**为什么做**：控制契约是跨三侧（app 适配器 / relay / 插件）的单一事实源；先定契约再实现，防止镜像漂移（INV-004 纪律）。

**涉及文件与定位**：

- `contracts/control-api.md`：新建（参照 `contracts/relay-api.md` 的格式与安全边界表述）

**具体操作**：

1. 定义端点契约：
   - `GET /api/control/stream?docId=<id>` — SSE 下行（消息格式：`event: tool` / `data: {requestId, call:{id,name,input}}`；`event: hello` 注册确认；`event: ping` 保活）
   - `POST /api/control/notify` — 上行 `{docId, kind:'tool-result'|'export', requestId?, payload}`（tool-result 形状 = ToolExecution；export 携带 base64 字节）
   - `POST /api/control/<app>/<docId>/context` — 返回 `{ok, context}`（skill buildContext 等价）
   - `POST /api/control/<app>/<docId>/tool` — 入参 `{call:{id,name,input}}`；返回 `{ok, execution}` 或 `{ok:false, error}`（未注册/超时/非法输入）
   - `POST /api/file` — 写回 `{path, base64}`（body 或 JSON，实现时定）；返回 `{ok, path}` / `{ok:false, error}`；tmp+rename；loopback-only
2. 定义 `docId = SHA-256(绝对路径)`；工具名集合 = `docx:`/`markdown:` 前缀映射规则
3. 定义镜像点声明：`apps/*/renderer/control.ts`、`server.mjs`、`tab-genoffice/src/host/*`、`scripts/dev.mjs` 四处，注释 `INV-004` 指向本文件
4. 安全边界：控制面与写回默认仅 loopback；`HOST=0.0.0.0` 时写回默认拒绝（INV-002）

**验证**：`python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/genoffice-dsh-control` 契约 ID 引用闭环（Stage 2 末整体跑）；人工评审：4 个镜像点声明存在

**Evidence**：`evidence/phase-0/control-api-draft.md`（评审记录）

**注意事项**：禁止在契约中引入非 JSON 消息格式；SSE 下行/上行分离是零依赖约束（ASM-008）的硬设计，不得改为 WebSocket（除非显式引入 ws 依赖并更新 ASM）。

### Task 3: 执行 Phase 0 回归验证

- **关联**：本 Phase 全部 BR/UF/INV
- **前置任务**：1;2

**验证**：`node scripts/dev.mjs smoke` → 全部通过（现状不回归）；契约文件人工评审通过

**Evidence**：`evidence/phase-0/phase-0-summary.md`

### Phase 1: relay 控制面

> 你在哪里：relay 只有读端点与搜索。
> 做完之后：relay 具备控制面（注册表 + SSE + notify + context/tool）与原子写回端点，契约形状经 curl 验证。

### Task 4: 实现执行器注册表与 SSE 下行通道

- **关联**：BR-003 / BR-009 / INV-002；UF 写 NA（内部传输层，UF-001/004 经 Task 6 消费）
- **前置任务**：3
- **风险等级**：P0

**为什么做**：iframe 执行器与 relay 的绑定通道；未注册/断线语义是 BR-003 的主体。

**涉及文件与定位**：

- `upstream/web/server.mjs`：`async function handleApi`，`grep -n "async function handleApi" upstream/web/server.mjs`，L209（hint）
- `contracts/control-api.md`：SSE 消息格式（Task 2 已定义）

**具体操作**：

1. 实现内存注册表：`Map<docId, {res, lastSeen}>`（SSE 响应对象）；`docId` 校验：`sha256(绝对路径)` 的十六进制串，长度 64，非法格式 400
2. 实现 `GET /api/control/stream?docId=<id>`：写 SSE 头（`text/event-stream`），立即发 `event: hello`，注册表登记；连接关闭/错误时注销（BR-003 注销语义）
3. 保活：每 25s 发 `event: ping`（零依赖 setTimeout，连接关闭时清理定时器）
4. 下行发送函数 `pushTo(docId, event, data)`：未注册返回 false（供 Task 6 用）

**验证**：`curl -N "http://127.0.0.1:8787/api/control/stream?docId=<64hex>"` → 收到 `hello` 事件与周期 ping；`docId` 非法 → 400

**Evidence**：`evidence/API-control/stream-hello.txt`（curl 输出）

**注意事项**：SSE 响应不得被压缩/缓冲（Node http 直接写即可）；连接数上限（如 32）防泄漏，超限 503（ASM 登记实现细节）。

### Task 5: 实现上行通知 POST /api/control/notify

- **关联**：BR-002 / BR-010；UF 写 NA（传输层）
- **前置任务**：4
- **风险等级**：P1

**为什么做**：iframe 执行结果与导出字节回传 relay 的唯一通道（ASM-008 上行）。

**涉及文件与定位**：

- `upstream/web/server.mjs`：`handleApi`（L209 hint）

**具体操作**：

1. 实现 `POST /api/control/notify`：入参 `{docId, kind, requestId?, payload}`；校验 docId 已注册（未注册 → `{ok:false, error}`）
2. `kind='tool-result'`：将 `payload`（ToolExecution 形状）放入 `pending[requestId]`，供 Task 6 的挂起请求消费
3. `kind='export'`：payload 含 base64 字节 + 文件名，转交写回流程（Task 7）
4. 请求体大小上限 50MB（沿用 relay 既有上限）

**验证**：`curl -X POST http://127.0.0.1:8787/api/control/notify -d '{"docId":"<64hex>","kind":"tool-result","requestId":"r1","payload":{...}}'` → `{ok:true}`；未注册 docId → `{ok:false}`

**Evidence**：`evidence/API-control/notify-ok.json` + `notify-unregistered.json`

**注意事项**：pending 表需 TTL（如 60s）防泄漏；上行数据不得被 relay 修改形状（镜像断言用）。

### Task 6: 实现 context/tool 端点

- **关联**：BR-002 / BR-003 / BR-010 / UF-001 / UF-004；INV-004
- **前置任务**：4;5
- **风险等级**：P0

**为什么做**：DSH agent 与执行器的业务接口；错误语义（未注册/非法输入/超时）是 UF-001 失败分支的实现。

**涉及文件与定位**：

- `upstream/web/server.mjs`：`handleApi`（L209 hint）
- `contracts/control-api.md`：端点形状（Task 2）

**具体操作**：

1. `POST /api/control/<app>/<docId>/context`：`app ∈ {docs, markdown}` 否则 404；转发下行 `event: context`，等待 notify 回传（TTL 30s）；超时 → `{ok:false, error:'timeout'}`（BR-010）
2. `POST /api/control/<app>/<docId>/tool`：入参校验（`call.id/name/input` 存在；input 为 JSON 对象，否则 `{ok:false, error:'invalid input'}` 不转发）；下行 `event: tool`（带 requestId）；等待 `tool-result`（TTL 60s）；未注册 → `{ok:false, error:'executor not registered'}`（BR-003）
3. 下行后立即从注册表移除 pending（一次性）；notify 到达但已超时 → 丢弃并记录

**验证**：与 Task 4/5 联调：开 SSE → `POST tool`（合法/非法输入/未注册三发）→ 分别得到成功/`invalid input`/`executor not registered`；SSE 关闭后 tool → 未注册错误

**Evidence**：`evidence/API-control/tool-*.json`（三种场景 request/response）

**注意事项**：requestId 用 relay 侧 UUID；挂起请求与 SSE 连接生命周期绑定（断线即失败）。

### Task 7: 实现 POST /api/file 写回端点

- **关联**：BR-004 / BR-005 / UF-002；INV-002 / INV-003
- **前置任务**：5
- **风险等级**：P0

**为什么做**：编辑内容落盘回原路径的唯一通道；原子性与安全边界是 UF-002 失败分支的实现。

**涉及文件与定位**：

- `upstream/web/server.mjs`：`handleApi`（L209 hint）；现有 `/api/file` 读端点 L272（hint，同路径策略）

**具体操作**：

1. 实现 `POST /api/file`：入参 `{path, base64}`；loopback 来源校验（沿用 `ALLOW_ABS_PATHS` 逻辑，非 loopback 且未显式开启 → 403，BR-005）
2. 字节上限 50MB；目标路径为绝对路径且存在父目录；写入 `tmp`（同目录）+ `rename` 原子替换（BR-004）
3. mtime 冲突校验（可选参数 `expectedMtimeMs`）：不匹配 → `{ok:false, error:'conflict'}`（UF-002 外部修改分支）
4. 更新 `contracts/relay-api.md` 写回端点条目（镜像点注释 `INV-004`）

**验证**：写临时文件 → `curl -X POST /api/file -d '{"path":"<tmp>","base64":"..."}'` → `{ok:true}`，文件字节正确；伪造非 loopback Host → 403；指向不存在目录 → `{ok:false}` 原文件不变

**Evidence**：`evidence/API-control/file-write-{ok,403,fail}.json`

**注意事项**：禁止 `rename` 跨设备（tmp 必须与目标同目录）；写回前记录原 mtime（EVD-005 用）。

### Task 8: 实现 docId 计算与路径安全校验

- **关联**：BR-009 / INV-002；UF 写 NA（内部）
- **前置任务**：4
- **风险等级**：P2

**为什么做**：docId 与绝对路径的双向一致性；防止路径穿越/伪造 docId。

**涉及文件与定位**：

- `upstream/web/server.mjs`：`handleApi`（L209 hint）

**具体操作**：

1. 实现 `docIdFor(absPath)`：`createHash('sha256').update(absPath).digest('hex')`
2. `POST /api/control/<app>/<docId>/open` 辅助端点（可选）：入参 `{path}` → 返回 docId（供插件/测试用）
3. 路径校验：写回与打开只接受绝对路径（`path.isAbsolute` 等价检查）；拒绝 `..` 解析后越界（绝对路径场景由 loopback 边界兜底，文档化）

**验证**：`node -e` 计算同一路径两次 docId 一致；不同路径不一致；`POST open` 返回 64hex

**Evidence**：`evidence/API-control/docid.log`

**注意事项**：docId 与打开时间无关（纯路径哈希），保证同路径复用（BR-009）。

### Task 9: 执行 Phase 1 回归验证

- **关联**：本 Phase 全部 BR/UF/INV
- **前置任务**：6;7;8

**验证**：`node scripts/dev.mjs smoke` → 全部通过（含新增断言：控制面端点形状、工具名集合镜像）；curl 样例齐全

**Evidence**：`evidence/phase-1/smoke.log` + `evidence/phase-1/phase-1-summary.md`

### Phase 2: app 控制适配器

> 你在哪里：app（docs/markdown）只有 web-bridge，无外部控制能力。
> 做完之后：两个 app 在 `control=1` 时注册执行器、执行下行工具调用、可导出当前字节。

### Task 10: 实现 docs 控制适配器

- **关联**：BR-001 / BR-002 / BR-003 / UF-001 / UF-004；INV-005 / INV-006
- **前置任务**：9
- **风险等级**：P0

**为什么做**：docs 编辑能力的对外执行面；复用现有 `executeTool`/协议原语（INV-005）。

**涉及文件与定位**：

- `apps/docs/src/renderer/control.ts`：新建（参照 `web-bridge.ts` 的模块风格，`grep -n "const desktop" apps/docs/src/renderer/web-bridge.ts`，L489 hint）
- `apps/docs/src/renderer/ai/tools.ts`：`export function executeTool` / `AGENT_TOOLS`（L28 hint）
- `apps/docs/src/renderer/ai/docs-skill.ts`：`createDocsSkill`（L11 hint，skill 形状参照）

**具体操作**：

1. 实现 `initControlMode(editor)`：
   - 解析 `control=1`（`URLSearchParams(location.search)`，复用 L976 的解析链）；未命中直接返回（非控制模式零副作用，INV-001）
   - 计算 `docId = docIdFor(当前文档绝对路径)`（路径来自 open= 解析结果；无路径（新建文档）→ 不注册并提示）
   - `new EventSource('/api/control/stream?docId=…')` 注册；`hello` 事件确认；`tool` 事件 → `executeTool(editor, call)` → `POST /api/control/notify`（tool-result）；`context` 事件 → `buildDocContext(editor)` 回传
   - `visibilitychange`/`online` 时重连 EventSource；页面卸载/文档切换时注销（BR-003）
2. 工具输入校验：`call.input` 非对象 → 回传 isError（BR-002 的适配器侧实现）
3. 错误处理：编辑器未就绪（editor 为空）→ 回传 `{output:'editor not ready', isError:true}`（UF-001 失败分支）

**验证**：`cd upstream && npm run web` 构建通过；浏览器打开 `/docs/?control=1&open=path:<tmp.md>` → console 无 error；DevTools 中手动 `executeTool` 等价调用（临时注入脚本）→ 文档变化

**Evidence**：`evidence/phase-2/docs-control-console.log`

**注意事项**：禁止直接改文件字节/IndexedDB（INV-005）；EventSource 失败需 console 可见（不能吞错误）；sandbox 内 EventSource 同源可用（INV-006 不放松）。

### Task 11: 实现 markdown 控制适配器

- **关联**：BR-001 / BR-002 / BR-003 / UF-001 / UF-004；INV-005 / INV-006
- **前置任务**：9
- **风险等级**：P0

**为什么做**：同 Task 10，针对 markdown app（执行器来自 markdown skill）。

**涉及文件与定位**：

- `apps/markdown/src/renderer/control.ts`：新建（参照 docs 适配器）
- `apps/markdown/src/renderer/ai/tools.ts`：`executeTool` / `AGENT_TOOLS`（行号待勘察，`grep -n "AGENT_TOOLS" apps/markdown/src/renderer/ai/tools.ts`）
- `apps/markdown/src/renderer/ai/markdown-skill.ts`：`createMarkdownSkill`（L37 hint）

**具体操作**：

1. 按 Task 10 的同一契约实现 markdown 版（`buildDocContext`/`executeTool` 来自 markdown 模块；markdown 的 GFM-only 纪律在工具描述中已含，无需改动）
2. 与 docs 版共享的形状抽到 `apps/*/src/renderer/control-shared.ts`（如 SSE 客户端、notify 封装）——两 app 独立构建，复制共享模块或各自实现，按构建复杂度定（ASM：优先各自内聚，避免跨 app 共享包）

**验证**：`npm run web` 构建通过；`/markdown/?control=1&open=path:<tmp.md>` → console 无 error；注入调用 → 文档变化

**Evidence**：`evidence/phase-2/markdown-control-console.log`

**注意事项**：markdown app 无编辑器时 `getEditor()` 返回 null → 必须走 `editor not ready` 分支（UF-001）。

### Task 12: 适配器接线（挂载点 + URL 参数协作）

- **关联**：BR-001 / UF-003；INV-001
- **前置任务**：10;11
- **风险等级**：P1

**为什么做**：控制模式必须从真实入口可达（shared-rules 6.3 接线要求）；`control=1` 与 `open=` 解析链协作。

**涉及文件与定位**：

- `apps/docs/src/renderer/main.tsx` / `App.tsx`：编辑器实例就绪后调用 `initControlMode(editor)`（`grep -n "createEditor\|new Editor" apps/docs/src/renderer/` 待勘察行号）
- `apps/docs/src/renderer/web-bridge.ts`：open= 目标解析结果（`openPath` 变量，L843 hint）——适配器需要最终绝对路径
- `apps/markdown/src/renderer/main.tsx`：同上

**具体操作**：

1. docs：编辑器创建成功后（现有初始化链末尾）调用 `initControlMode(editor, {getPath})`；`getPath` 返回 open= 解析出的绝对路径
2. 打开后从地址栏清除 `control` 与 `open` 参数（复用现有清除逻辑，L999-1000 hint），刷新不重开
3. markdown：同样接线
4. 非 control 模式：初始化链不变（零改动路径，INV-001）

**验证**：`/docs/?control=1&open=path:<enc>` → 页面加载后 URL 无残留参数；EventSource 已建立（console/network 可见）；`/docs/?open=path:<enc>`（无 control）→ 无 EventSource

**Evidence**：`evidence/phase-2/wiring-docs.png` + `evidence/phase-2/wiring-markdown.png`

**注意事项**：编辑器实例引用必须新鲜（skill 的 `getEditor()` 模式）；接线失败 = 控制不可用，属 P0 缺陷。

### Task 13: 导出字节链路（写回数据源）

- **关联**：BR-008 / UF-002；INV-003
- **前置任务**：10;11
- **风险等级**：P1

**为什么做**：写回需要"当前文档字节"，导出复用现有 save/export 管线，禁止绕过编辑器重打包（INV-005）。

**涉及文件与定位**：

- `apps/docs/src/renderer/control.ts`：新增 `exportBytes()`（复用 save 管线入口；`grep -n "save\|export" apps/docs/src/renderer/` 现有保存函数，待勘察行号）
- `apps/markdown/src/renderer/control.ts`：同上（markdown 保存 = 纯文本导出）

**具体操作**：

1. docs：`exportBytes()` 触发与保存一致的 OOXML 重打包（dirty blocks → 拼回 document.xml → 重打包 zip），返回 `{base64, name}`；复用现有保存函数，不复制逻辑
2. markdown：`exportBytes()` 返回当前编辑器内容文本（GFM）
3. 控制模式新增 `event: export` 下行处理：收到后执行 `exportBytes()` → `POST /api/control/notify`（kind='export'）
4. 导出失败（如重打包错误）→ 回传 isError，不落盘（INV-003）

**验证**：控制模式下触发 export（临时注入或经插件端到端）→ notify 收到与编辑器一致的字节；导出后原文件未变（BR-008 半程验证）

**Evidence**：`evidence/phase-2/export-bytes.json`（base64 长度 + 与打开字节的 diff 说明）

**注意事项**：导出必须走编辑器状态（docx 的 dirty block 语义），不得重新解析磁盘文件。

### Task 14: 执行 Phase 2 回归验证

- **关联**：本 Phase 全部 BR/UF/INV
- **前置任务**：12;13

**验证**：`node scripts/dev.mjs smoke` 全绿；控制模式浏览器路径逐步走查（打开/注册/调用/导出）无 console error

**Evidence**：`evidence/phase-2/phase-2-summary.md`

### Phase 3: 去 AI 助手

> 你在哪里：control=1 时 AI dock 仍渲染（Task 12 只加了控制能力）。
> 做完之后：控制模式下 AI 助手整体不可见；非控制模式零回归。

### Task 15: docs 控制模式隐藏 AI 助手

- **关联**：BR-006 / UF-003；INV-001
- **前置任务**：14
- **风险等级**：P1

**为什么做**：BR-006 主体——控制模式下不渲染任何 AI 助手 UI。

**涉及文件与定位**：

- `apps/docs/src/renderer/App.tsx`：`ai-dock` div（L2726 hint）/ `AiPanel`（L2728 hint）/ `showAi` state（L287 hint）
- Ribbon 中「Genspark AI」按钮与 AI 快捷按钮：`grep -n "Genspark AI\|AI 总结\|aiQuick" apps/docs/src/renderer/` 待勘察

**具体操作**：

1. 新增 `const controlMode = 解析 control=1`（与适配器共享同一来源）
2. `ai-dock` 渲染条件改为 `showAi && !controlMode`；Ribbon「Genspark AI」与 AI 总结/润色/排版按钮同样 `!controlMode` 隐藏
3. 非 control 分支代码路径不变（INV-001）

**验证**：`/docs/?control=1&open=path:…` 截图 → 无 AI 元素（EVD-002）；`/docs/?open=path:…` 截图 → AI 元素照常（EVD-006）

**Evidence**：`evidence/UF-003/docs-control-noai.png` + `evidence/UF-003/docs-noncontrol-ai.png`

**注意事项**：只做渲染条件，不改 AiPanel/agent 模块代码（ASM-005 运行时隐藏）；`showAi` 的 localStorage 逻辑保留。

### Task 16: markdown 控制模式隐藏 AI 助手

- **关联**：BR-006 / UF-003；INV-001
- **前置任务**：14
- **风险等级**：P1

**为什么做**：同 Task 15，markdown app。

**涉及文件与定位**：

- `apps/markdown/src/renderer/App.tsx`：ai-dock（L385 hint）/ AiPanel（L397 hint）

**具体操作**：

1. 同 Task 15 模式：`aiOpen && !controlMode` 控制 dock；Ribbon「Genspark AI」快捷按钮隐藏
2. 非 control 分支不变

**验证**：`/markdown/?control=1&open=path:…` 截图无 AI 元素；非 control 截图 AI 元素照常

**Evidence**：`evidence/UF-003/markdown-control-noai.png` + `evidence/UF-003/markdown-noncontrol-ai.png`

**注意事项**：同 Task 15。

### Task 17: 执行 Phase 3 回归验证

- **关联**：本 Phase 全部 BR/UF/INV（重点 INV-001）
- **前置任务**：15;16

**验证**：`node scripts/dev.mjs smoke` 全绿；control/非 control 双态截图对比存档（EVD-002/EVD-006）

**Evidence**：`evidence/phase-3/phase-3-summary.md`

### Phase 4: DSH 插件工具与接线

> 你在哪里：插件 tab 只有预览（无 control=1、无保存、无工具）。
> 做完之后：DSH agent 可调用 `docx:*`/`markdown:*` 工具控制文档；tab 提供「写入磁盘」。

### Task 18: 实现 skill→defineTool 工具定义生成器

- **关联**：BR-007 / INV-004 / UF-001；UF 写 NA（工具定义生成，消费方为 Task 19）
- **前置任务**：17
- **风险等级**：P1

**为什么做**：工具定义必须与 skill 的 `AGENT_TOOLS` 保持一致（INV-004），手工复制必然漂移。

**涉及文件与定位**：

- `plugin/packages/tab-genoffice/src/host/tool-schema.ts`：新建
- `upstream/apps/docs/src/renderer/ai/tools.ts`：`AGENT_TOOLS`（L28 hint）——生成器输入源（编译期从 vendor 镜像或契约文件读取，ASM：从 `contracts/control-api.md` 工具名集合表生成，避免跨仓库 import）
- `plugin/packages/document/src/tools/create-document.ts`：`defineTool` 用法模板（L201 hint）

**具体操作**：

1. 在 `contracts/control-api.md` 中固化工具名集合表（docx: 10 个 + markdown: 同形状子集，以各 skill AGENT_TOOLS 为准并双向核对）
2. 生成器：读契约工具表 → 产出 `defineTool` 定义数组（name=`docx:<name>`，parameters=inputSchema，description 追加 skill 纪律摘要）
3. `docx:save`/`markdown:save` 工具定义（写回触发，BR-008）

**验证**：`npm run build` 通过；生成的定义与契约表逐字段一致（脚本断言）

**Evidence**：`evidence/phase-4/tool-schema.json`（生成结果快照）

**注意事项**：生成器不得在运行时依赖 upstream 源码（插件与 upstream 是独立仓库）；契约表为唯一输入。

### Task 19: 实现 host 工具执行（context/tool/save）

- **关联**：BR-002 / BR-003 / BR-008 / BR-010 / UF-001 / UF-002 / UF-004
- **前置任务**：18
- **风险等级**：P0

**为什么做**：DSH agent 侧的执行面；错误语义（未注册/超时/冲突）映射为工具 isError。

**涉及文件与定位**：

- `plugin/packages/tab-genoffice/src/host/tools.ts`：新建（`ctx.tools.register` 模式参照 `plugin/packages/document/src/index.ts` L46）
- `plugin/packages/tab-genoffice/src/host/index.ts`：host 入口（现有 `apply` 为空，`plugin/packages/tab-genoffice/src/index.ts` L1-4）

**具体操作**：

1. host `apply` 改为注册工具（`inject` 增加 tools 服务声明）
2. 每个工具执行：`POST /api/control/<app>/<docId>/tool`（app 由扩展名映射：docx→docs，md→markdown）；`docId` 由入参路径计算；deadline（复用 `@deepseek-ai/dsh-timeout` 的 `deadline` 模式）→ 超时返回 isError（BR-010）
3. 错误映射：`executor not registered` → isError 提示"请先在 GenOffice tab 打开该文档"（UF-001 恢复路径）；`invalid input` → isError 附解析错误
4. `docx:save`/`markdown:save`：调用导出链路（经 relay 触发 iframe export → 写回），返回写回结果；conflict → isError 提示外部修改（UF-002）

**验证**：DSH 会话实测（chrome MCP）：让 agent 调用 `docx:read_blocks` 读取已打开文档 → 返回真实内容；未打开文档 → 明确错误

**Evidence**：`evidence/UF-001/agent-tool-calls.log`（Trajectory 截图/日志）

**注意事项**：工具入参含路径时校验为绝对路径（INV-002 侧）；工具不得自行写盘（BR-008，写回只能经 save 工具/按钮）。

### Task 20: client 接线（control URL + 保存按钮 + 事件复用）

- **关联**：BR-001 / BR-008 / UF-002 / UF-003；INV-006 / INV-007
- **前置任务**：19
- **风险等级**：P1

**为什么做**：用户可见入口（2.3 节接线清单）；预览语义兼容（INV-007）。

**涉及文件与定位**：

- `plugin/packages/tab-genoffice/src/tabs/genoffice.tsx`：`previewUrlFor`（L57 hint）/ 工具栏区（L263-292 hint）/ iframe（L244-254 hint）
- `plugin/packages/tab-genoffice/src/client/index.ts`：事件消费（L36-52）

**具体操作**：

1. `previewUrlFor` 生成 `…/?control=1&open=path:<enc>`（预览 iframe 与控制模式合一：同一 iframe 既是预览也是执行器）
2. 预览工具栏新增「写入磁盘」按钮：点击 → 通知 host 执行 `docx:save`/`markdown:save`（经 client→host 机制，参照 document 包 `exec.agent.session.append` 模式，具体通道 P0 勘察）；状态机 idle→saving→saved/conflict/error（UF-002 界面状态机）
3. 保持 sandbox 不变（INV-006）；非 control 打开路径（“在浏览器中打开”按钮）不变（INV-007）
4. `dsh:open-local-file` 联动路径不变（事件 → 打开 control 预览）

**验证**：浏览器实景：点击 md 文件 → iframe 带 control=1；「写入磁盘」按钮出现且状态机可用；「在浏览器中打开」URL 无 control（INV-007）

**Evidence**：`evidence/UF-002/save-button-*.png`（idle/saved/conflict 三态）

**注意事项**：按钮的 loading/禁用/错误提示是需求本体（shared-rules 8）；client→host 通道若平台无现成 RPC，采用 session 事件或 window 消息桥（P0 勘察任务中确认，写入 1.3 事实）。

### Task 21: 插件构建、类型检查与 vendor 同步

- **关联**：EVD-007 / INV-004；UF 写 NA（构建任务）
- **前置任务**：20
- **风险等级**：P1

**为什么做**：插件包独立编译；平台补丁/vendor 镜像同步纪律（dsh-artifact README 维护命令）。

**涉及文件与定位**：

- `plugin/`：`package.json` / `scripts/sync-vendor.mjs`

**具体操作**：

1. `cd plugin && npm run build && npm run typecheck` → 全绿（修复直至通过）
2. 若涉及平台包类型（tools/deadline 等）更新，运行 `node scripts/sync-vendor.mjs <env-wt-artifact>` 同步 vendor 镜像
3. 重启 3099 实例（rev 缓存陷阱：改 bundle 后必须重启）验证插件加载（`--dump-config` 层序含新工具注册）

**验证**：`npm run build && npm run typecheck` → 通过；3099 实例可访问且工具注册可见（DSH 会话 `/tools` 或等效入口，待勘察）

**Evidence**：`evidence/phase-4/build-typecheck.log`

**注意事项**：不得为过类型检查放宽类型（如 any 泛滥）；构建产物变更需同步 vendor。

### Task 22: 执行 Phase 4 回归验证

- **关联**：本 Phase 全部 BR/UF/INV
- **前置任务**：19;20;21

**验证**：`node scripts/dev.mjs smoke` 全绿；DSH 会话端到端走查（打开→编辑→保存）无 console error

**Evidence**：`evidence/phase-4/phase-4-summary.md`

### Phase 5: 端到端验收

> 你在哪里：全链路已实现。
> 做完之后：spec 5.2 真实场景全套测试通过；任务包证据审计通过。

### Task 23: 执行 spec 5.2 真实场景全套测试

- **关联**：全部用户可见 UF（UF-001~004）
- **前置任务**：22
- **风险等级**：P0

**为什么做**：完成的唯一标准（shared-rules 6）；机器校验闸门会审计证据落盘。

**涉及文件与定位**：

- `spec.md` 第 5.2 节执行矩阵（本任务按矩阵逐行回放）

**具体操作**：

1. 按 5.2 环境准备启动 relay + 3099 实例；准备 fixture（`evidence/fixtures/demo.md`、`demo.docx`，docx 用现有样例复制或 `web/open.mjs` 生成）
2. 逐行执行矩阵：UF-001 主路径 + 3 失败分支；UF-002 主路径 + 3 失败分支；UF-003 主路径 + 2 分支；UF-004 主路径 + 2 分支
3. 每行保存证据（截图/console/network/API 样例）到 5.2 矩阵指定路径

**验证**：执行矩阵全部行通过；`python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/genoffice-dsh-control` → 0 FAIL（证据审计通过）

**Evidence**：`evidence/UF-001/` `evidence/UF-002/` `evidence/UF-003/` `evidence/UF-004/`（按 5.2 矩阵）

**注意事项**：禁止用单测/静态 review 代替本节（shared-rules 6）；失败 = 回到对应任务修复后重跑本矩阵。

### Task 24: 执行 Phase 5 回归验证

- **关联**：本 Phase 全部 BR/UF/INV（含 5.4 专项检查）
- **前置任务**：23

**验证**：`node scripts/dev.mjs smoke` 全绿 + 5.4 专项检查清单逐项核对 + 校验脚本 0 FAIL

**Evidence**：`evidence/phase-5/phase-5-summary.md`

---

## 5. 验收与 Review 协议

> **验收铁律：命令级验证（5.1）通过只是入场券，不是完成。** 用户可见的需求必须通过 5.2 真实场景全套测试才算完成——单元测试全绿但界面点不动 = 未完成。

### 5.1 命令级验证（入场券）

| 验证项 | 命令 | 期望 | Evidence |
|---|---|---|---|
| 栈契约冒烟 | `node scripts/dev.mjs smoke`（栈根） | 全部 PASS（含新增控制契约断言） | EVD-004 |
| 上游 web 构建 | `cd upstream && npm run web` | 构建成功，relay 可访问 | EVD-007 |
| 插件构建/类型检查 | `cd plugin && npm run build && npm run typecheck` | 全绿 | EVD-007 |
| relay 端点形状 | `curl`（见各 Task 验证命令） | 与 contracts/control-api.md 一致 | EVD-001 |
| 校验脚本 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/genoffice-dsh-control` | 0 FAIL | — |

### 5.2 真实场景全套测试（Real-Run，完成的唯一标准）

> 在真实运行的应用上，把第 2.3 节每条流程脚本从头到尾走一遍——用和真实用户完全相同的方式。禁止用"跑了单测"或"读了代码确认逻辑正确"代替本节。

**环境准备**：

| 项 | 值 |
|---|---|
| 启动命令 | relay：`node scripts/dev.mjs start-relay`（栈根）；DSH 实例：`DSH_HOME=~/.dsh-wt-artifact ~/workspace/dsh/plugin/dsh-artifact/env/wt-artifact/bin/dsh --profile artifact --patch ~/.dsh-wt-artifact/artifact-3099.patch.yml` |
| 访问入口 | relay `http://localhost:8787`；DSH GUI `http://127.0.0.1:3099`（GenOffice tab） |
| 测试账号/数据 | 无需账号；fixture：`evidence/fixtures/demo.md`（自建，含 3 章标题+段落）、`demo.docx`（从现有样例复制；缺失则新建空白保存） |
| 干净状态定义 | fixture 文件改动后 `git checkout`（栈根仓库内）或重新复制；relay/3099 重启恢复注册表空态 |
| 可用测试工具 | chrome MCP（真实浏览器点击/截图/console/network）+ `curl`（contract 场景） |

**执行矩阵**（每条 = 2.3 节一条流程脚本的真实回放）：

| UF | 执行方式 | 操作来源 | 必须核对的点 | Evidence |
|---|---|---|---|---|
| UF-001 主路径 | browser + API | 2.3 节 UF-001 成功主路径：聊天指令 → agent 工具链 → iframe 变化 | 每步「界面即时反馈」「用户看到的结果」与脚本一致；iframe 块级更新可见；原文件 diff 为空（BR-008）；console 无新增 error | `evidence/UF-001/main-*.png` + `evidence/UF-001/tool-calls.log` + `evidence/UF-001/file-unchanged.diff` |
| UF-001 失败分支 执行器未注册 | browser + API | 不打开文档直接让 agent 编辑 | 工具卡片显示"请先打开文档"类错误；无文档变化 | `evidence/UF-001/fail-unregistered.png` |
| UF-001 失败分支 编辑器未就绪 | browser | 打开文档后立即（加载中）触发调用 | isError 返回；不崩溃 | `evidence/UF-001/fail-notready.png`（加载窗口难捕获时记录时序说明） |
| UF-001 失败分支 非法参数 | API | `POST tool` 传非 JSON input | `{ok:false, error:'invalid input'}`；文档不变 | `evidence/UF-001/fail-invalid.json` |
| UF-001 失败分支 超时 | API | 关闭 iframe 后调用（SSE 断线） | timeout 错误；不重放 | `evidence/UF-001/fail-timeout.json` |
| UF-002 主路径 | browser + diff | 编辑后点「写入磁盘」 | 按钮 loading→saved；提示"已保存到 \<path\>"；磁盘字节 = iframe 内容 | `evidence/UF-002/save-success.png` + `evidence/UF-002/after.diff` |
| UF-002 失败分支 外部修改冲突 | browser | 编辑期间外部 touch 原文件（mtime 变化）后保存 | conflict 提示；原文件未被覆盖 | `evidence/UF-002/fail-conflict.png` |
| UF-002 失败分支 目标不可写 | API | 指向只读目录路径写回 | `{ok:false}`；原文件不变 | `evidence/UF-002/fail-readonly.json` |
| UF-002 失败分支 未打开文档 | browser | 无文档时点保存 | 按钮禁用/提示先打开文档 | `evidence/UF-002/fail-noopen.png` |
| UF-003 主路径 | browser | tab 打开 docx/md | 无任何 AI 助手 UI；编辑功能完整 | `evidence/UF-003/docs-control-noai.png`、`markdown-control-noai.png` |
| UF-003 失败分支 非 control 回归 | browser | 直接访问无 control=1 URL | AI dock 照常（INV-001）；保存=下载（INV-007） | `evidence/UF-003/noncontrol-ai.png` |
| UF-003 失败分支 旧构建兼容 | browser | （可选）用旧 web-dist 打开 control=1 | 按普通模式渲染不崩溃 | `evidence/UF-003/legacy-compat.png`（无法构造时记录说明） |
| UF-004 主路径 | API | `POST context` | 返回上下文含块结构/索引，与 iframe 内文档一致 | `evidence/UF-004/context-ok.json` |
| UF-004 失败分支 执行器未注册 | API | 无打开文档时调用 | `{ok:false, error:'executor not registered'}` | `evidence/UF-004/fail-unregistered.json` |
| UF-004 失败分支 文档过大 | API | （构造条件不具备时标注跳过原因） | 截断或错误策略生效 | `evidence/UF-004/fail-large.json`（或说明） |

**按任务类型的执行方式**：

- frontend：chrome MCP 真实浏览器点击，截图 + console + network 三件套。
- backend/API：`curl` 对真实运行 relay 发请求（正常/未注册/非法参数/非 loopback 各一发），保存 request/response + server log。
- CLI/脚本：`node scripts/dev.mjs smoke` 完整跑一遍保存输出。

**通过标准**：执行矩阵全部行通过且 evidence 齐全。任何一行失败 = 本需求未完成，回到对应任务修复后重跑。

### 5.3 Evidence 目录结构与命名

```text
docs/genoffice-dsh-control/evidence/
  phase-{0..5}/        # 每 Phase 的命令输出、Phase summary
  UF-001/              # 主路径 + 失败分支截图/日志/diff
  UF-002/              # 保存三态 + diff
  UF-003/              # control/非 control 截图
  UF-004/              # context API 样例
  API-control/         # 控制面 request/response 样例
  fixtures/            # 测试用 demo.md / demo.docx
```

- EVD ID 必须能在第 2.5 节找到。
- 截图命名：`UF-001-main.png`；API 样例命名：`API-xxx-{scenario}.json`。

### 5.4 Review 专项检查清单

> 实现完成后的专项检查。通用 L1-L4 流程见 skill 的 review mode，此处只列本需求特有项。

- [ ] 5.2 执行矩阵全部通过，evidence 齐全且与第 2.5 节 EVD 清单一致
- [ ] 2.3 节每条流程的「入口接线清单」已实现——从真实入口可达（聊天工具 / tab 打开 / 保存按钮 / context），不是只有孤立模块
- [ ] 界面交互与 2.3 节脚本逐步一致（保存按钮 loading/禁用/成功/冲突/错误态齐全）
- [ ] INV-001 非控制模式零回归（截图对比基线）
- [ ] INV-004 契约镜像：contracts/control-api.md ↔ server.mjs ↔ 适配器 ↔ 插件工具 ↔ smoke 断言，逐处核对
- [ ] INV-005 无绕过编辑器的直接文件改写路径（代码 review）
- [ ] INV-006 sandbox 未放松
- [ ] 所有 BR/UF/INV 状态可对照第 2 章逐条核销
- [ ] `待勘察` 定位（3.3 清单 4 处）已补全为事实，或已被 P0 校准任务覆盖
