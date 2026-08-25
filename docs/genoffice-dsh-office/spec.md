# genoffice-dsh-office Spec

> Version: 0.1.0 | Date: 2026-08-12 | Status: Draft 草稿（Stage 1：第 1-2 章 + 3.3 + Phase 地图）
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
| 原始需求 | 来自上下文推断（`/prd-workflow oneclick` 空输入）：让 DSH 控制 GenOffice **全套件**——在 M0（docs/markdown 控制，`docs/genoffice-dsh-control/`）基础上，把 sheets(xlsx)/slides(pptx)/pdf 接入同一控制契约（M1：三 app 可被 DSH agent 编辑/标注并显式写回，控制模式下无内嵌 AI 助手） |
| 输入类型 | empty（上下文回退） |
| Mode | oneclick |
| 置信度 | 高 |
| 输出目录 | `/Users/nothing/workspace/dsh/genoffice/docs/genoffice-dsh-office/`（栈编排层，跨 upstream + plugin 两仓库） |

### 1.2 任务类型路由

| 维度 | 结论 |
|---|---|
| 任务类型 | frontend（三 app Web 化 + 控制适配器 + 去 AI dock）+ backend（relay 控制面 app 白名单扩展 + 契约）+ infra（构建接入、smoke 断言、插件工具注册） |
| 主要风险 | 三 app Web 化工程量未知（slides 245 处 IPC、xlsx sidecar、pdf 打开/保存管线）；格式保真（xlsx/pptx 重打包、pdf 标注）破坏桌面版兼容；控制契约 app 维度扩展的镜像漂移 |
| 行号引用策略 | 业务/前端/API 优先，行号仅作 hint；三段式定位以 symbol + grep anchor 为准 |
| 必需验收方式 | browser（chrome MCP）/ contract（curl）/ manual（非控制模式回归 + 桌面版格式兼容） |
| 必须覆盖用户场景 | xlsx/pptx/pdf 控制编辑与显式写回、无 AI 助手模式、非 control 零回归、格式保真 |

### 1.3 勘察事实清单

> 每条事实来自本会话实际执行的命令。勘察日期 2026-08-12。

| 事实 | 来源命令 | 输出摘要 |
|---|---|---|
| 六个 app 目录存在（docs/markdown/pdf/sheets/shell/slides），但只有 shell/docs/markdown 有 web-dist 构建 | `ls apps/` + `ls apps/*/web-dist/index.html` | sheets/slides/pdf **未构建 web-dist** |
| 三 app 均无 vite.web.config.ts（docs 的 `apps/docs/vite.web.config.ts` 是 Web 化参考模板） | `ls apps/sheets/vite.web.config.ts apps/slides/vite.web.config.ts apps/pdf/vite.web.config.ts` | 均不存在 |
| 三 app 均无 web-bridge 文件（docs/markdown 的 `web-bridge.ts` 是参考实现） | `ls apps/*/src/renderer/*web-bridge*.ts` | 均不存在 |
| sheets 编辑器基于 Univer 引擎 | `read apps/sheets/src/renderer/create-univer.ts` | `import { Univer } from '@univerjs/core'` L9 |
| sheets 已具备 AgentSkill（createWorkbookSkill，7 工具） | `grep createWorkbookSkill/executeWorkbookTool apps/sheets/src/renderer` | workbook-skill.ts L20/L26；tools.ts L360 |
| sheets 工具集：get_workbook_context/read_range/load_guide/read_formats/read_sheet_features/read_cells/propose_operations | `grep "name: '" apps/sheets/src/renderer/ai/tools.ts` | 7 个 |
| sheets App.tsx 使用 desktopApi（notifyPendingEdits） | `grep "window\." apps/sheets/src/renderer/create-univer.ts` | L373 |
| slides 渲染器对 `window.slidesApi` 的依赖面为 245 处（slides-skill 内部即引用 editText/batchEditTransform/beginHistoryBatch 等） | `grep -rn "window\.slidesApi" apps/slides/src/renderer`（harness grep） | 245 matches，跨 18 文件 |
| slides 已具备 AgentSkill（slides-skill.ts，工具 ≥13：get_deck_context/read_slide/set_element_text/style/transform/fill/stroke/execute_slide_script/web_search/image_search/generate_image/analyze_media 等） | `grep "name: '" apps/slides/src/renderer/ai/slides-skill.ts` | L337 起 |
| slides 保存面：file-actions.ts 的 `window.slidesApi.save()` / `saveAs()` | `grep "slidesApi" apps/slides/src/renderer/file-actions.ts` | L44/L64 |
| pdf 已具备 AgentSkill（createPdfSkill，工具 ≥15：read_pages/search_text/goto_page/markup_text/edit_text/edit_block/image_search/generate_image/list_page_images/insert_image/transform_image/rotate_image/replace_image/delete_image/list_form_fields 等） | `grep "name: '" apps/pdf/src/renderer/ai/tools.ts` | L81 起 |
| pdf 渲染器的 window 依赖基本为浏览器原生（getSelection/innerWidth/devicePixelRatio/resize），无 slidesApi 式 IPC 面 | `grep "window\." apps/pdf/src/renderer/App.tsx apps/pdf/src/renderer/annotations.ts` | 均为浏览器 API |
| 三 app 均存在 `main.tsx` 渲染入口 | `ls apps/{sheets,slides,pdf}/src/renderer/main.tsx` | 均存在 |
| relay `findStaticRoots` 候选列表已含全部六 app（shell/docs/markdown/pdf/sheets/slides），构建后即被托管 | `grep "findStaticRoots" upstream/web/server.mjs`（harness grep） | L79 起 candidates |
| M0 控制面 app 白名单仅 {docs, markdown} | `read contracts/control-api.md` | §2.3 `app ∈ {docs, markdown}` |
| M0 插件 tab `PREVIEWABLE` 仅 {docx→docs, md→markdown}，xlsx/pptx/pdf 列表置灰"仅桌面版可用" | `grep "PREVIEWABLE" plugin/packages/tab-genoffice/src/tabs/genoffice.tsx`（harness grep） | L24 |
| M0 插件 host 工具表 `CONTROL_TOOL_TABLE`（docx_* 11 + markdown_* 5）为契约工具名集合镜像 | `grep "CONTROL_TOOL_TABLE" plugin/packages/tab-genoffice/src/host/tool-schema.ts`（harness grep） | 定义处 |
| 浏览器实景（M0 验收）：xlsx/pptx/pdf 在插件文件列表显示"仅桌面版可用" | M0 5.2 验收会话快照 | 置灰行 + 标签 |

### 1.4 假设清单

| 假设 ID | 内容 | 风险 | 确认方式 |
|---|---|---|---|
| ASM-001 | 三 app Web 化策略已由 P0 定稿（evidence/phase-0/web-strategy.md）：**sheets** = 浏览器内 JSZip 管线（复用 gateway `readBasicWorkbook`/`planCellEditsToXlsx`/`assembleWithJsZip` + vite alias node shim，不用 sidecar/wasm）；**slides** = in-browser pptx-engine 会话模型实现 `window.slidesApi` 核心编辑子集（打开/保存/编辑文本/变换/填充/描边/历史/页操作；未覆盖方法显式不可用 console.warn）；**pdf** = 渲染器 pdf.js（已就绪）+ 浏览器内 pdf-lib 合并保存（text-edit 走 wasm `?url`，超预算可降级 isError） | slides 245 处 IPC 全量移植工程量可能超包容量；gateway 浏览器 shim 的类型适配 | P0 Task 2 决议已落盘；超量则 slides 降级为"控制面打通 + 只读上下文 + 最小编辑子集"（open/save 必须可用，BR-008 前提） |
| ASM-002 | 工具名前缀沿用 M0 修订规则：`xlsx_*`/`pptx_*`/`pdf_*`（`_` 分隔符，DeepSeek API 工具名 pattern 限制） | 与 spec 原文 `:` 命名偏差 | contracts/control-api.md §4 注（沿用 M0） |
| ASM-003 | 去 AI 助手沿用 M0 模式：`control=1` 运行时条件渲染隐藏（不做构建裁剪） | 面板代码仍在 bundle | INV-001 回归断言 |
| ASM-004 | 保存语义（P0 定稿）：sheets/slides 保存为原格式文件（xlsx/pptx 重打包，复用各自保存管线）；**pdf 保存为标注合并后的 PDF**（非侧车文件，未标注页面字节不变）；三 app 写回统一 `POST /api/file` tmp+rename | 重打包格式破坏桌面版兼容 | EVD-008 格式保真校验（桌面版/Office 打开） |
| ASM-005 | 单文档单会话（沿用 M0）；三 app 各自独立执行器注册，同 docId 单连接 | 多页并发抢占注册表 | BR-003 语义 + 5.2 单文档测试 |
| ASM-006 | 写回与安全边界完全复用 M0（POST /api/file tmp+rename、loopback、mtime 冲突），不新增环境变量 | 无 | 契约沿用 |

---

## 2. 业务合同

> 本章是 BR/UF/INV/EVD 的唯一定义处。任务、handoff、review 一律引用 ID，不复制表格。

### 2.1 BR 业务规则

| 规则 ID | 规则 | 正例 | 反例 | 影响范围 | 验证方式 |
|---|---|---|---|---|---|
| BR-001 | 控制模式激活：sheets/slides/pdf 页面 URL 带 `control=1` 时进入控制模式（注册执行器 + 隐藏 AI 助手）；不带时行为与桌面版一致 | `/sheets/?control=1&open=path:…` → 控制模式 | `/sheets/?open=path:…` → 非控制模式 | 三 app | browser 截图对比 |
| BR-002 | 工具调用形状沿用 M0 契约：`{id, name, input}` → `{output, isError, mutated, summary}`；非法 JSON input 不执行 | 合法调用 → `{ok:true, execution:{…}}` | input 非对象 → `{ok:false, error:'invalid input'}` | relay 控制面 + 适配器 | contract curl |
| BR-003 | 执行器注册：`docId = sha256(绝对路径)`（app 维度注册表）；未注册 docId 的工具调用返回 `executor not registered` | 已打开文档 → 调用可达 | 未打开 → 明确错误 | relay 注册表 | contract curl |
| BR-004 | 写回原子性：`POST /api/file` tmp+rename；任何失败不改变原文件字节（沿用 M0） | 写回成功 → 原路径替换 | 目标不可写 → ok:false 原文件保留 | relay | contract + 文件 diff |
| BR-005 | 写回与安全边界 loopback-only（沿用 M0 `ALLOW_ABS_PATHS` 语义） | loopback 请求 → 允许 | 伪造 Host → 403 | relay | contract curl |
| BR-006 | 控制模式无 AI 助手：三 app 不渲染 AI dock、Ribbon AI 入口与快捷按钮 | control=1 页面无任何 AI UI | 出现 AI dock → FAIL | 三 app App.tsx/Ribbon | browser 截图 |
| BR-007 | 工具名集合镜像：`xlsx_*`/`pptx_*`/`pdf_*` 注册名与契约表、各 skill `AGENT_TOOLS` 一致 | smoke 三向一致 | 任一漂移 → smoke FAIL | 插件 host + contracts | smoke 断言 |
| BR-008 | 显式写回触发：编辑工具只改 iframe 内状态；写回仅由 `*_save` 工具 / tab「写入磁盘」触发 | 编辑后文件不变；保存后变化 | 编辑隐式写盘 → FAIL | 插件 + relay | 文件 diff |
| BR-009 | 格式保真：xlsx/pptx 重打包后可被桌面版/Office 打开且公式/样式/版式不破坏；pdf 标注/编辑不改变未标注页面内容 | 保存后桌面版打开正常 | 重打包损坏 → FAIL | 三 app 保存管线 | EVD-008 桌面版/Office 打开校验 |
| BR-010 | 控制通道超时：host 侧 deadline（沿用 M0 70s）；断线后未完成调用返回 timeout，不重放 | 正常调用 < deadline → 成功 | 断线 → timeout 且无重复编辑 | 插件 host | 故障注入 |

### 2.2 UF 用户验收场景（索引）

| 场景 ID | Given | When | Then | 角色 | 验证方式 | Evidence |
|---|---|---|---|---|---|---|
| UF-001 | GenOffice tab 已打开某 xlsx（control 模式），DSH 会话进行中 | 用户指示"把 B 列改成数值格式并求和"，agent 调用 `xlsx_*` 工具链 | iframe 内工作表实时更新；agent 汇报"已修改"；原文件未变（未写回） | 用户 + DSH agent | browser + contract | EVD-003 |
| UF-002 | GenOffice tab 已打开某 pptx（control 模式） | 用户指示"把第 2 页标题改为 X"，agent 调用 `pptx_*` 工具链 | iframe 内幻灯片实时更新；原文件未变 | 用户 + DSH agent | browser + contract | EVD-003 |
| UF-003 | GenOffice tab 已打开某 pdf（control 模式） | 用户指示"高亮第 1 页第 2 段并改一处错字"，agent 调用 `pdf_*` 工具链 | 标注/编辑实时可见；原文件未变（未写回） | 用户 + DSH agent | browser + contract | EVD-003 |
| UF-004 | 用户经 DSH GenOffice tab 打开 xlsx/pptx/pdf（control=1） | 页面加载完成 | 三 app 均无 AI 助手 UI；编辑器功能完整；非 control 页面 AI 助手照常 | 用户 | browser 截图 | EVD-002 / EVD-006 |

> 说明：显式写回（保存按钮 / `*_save`）作为每个 UF 的 2.3 脚本最后一步 + 失败分支覆盖（M0 UF-002 语义沿用）；未注册/非法参数/超时/格式保真失败作为各 UF 失败分支。

### 2.3 核心业务流程（步骤级交互脚本）

#### UF-001: DSH 控制编辑 Excel（xlsx）

**前置状态**：GenOffice tab 预览态（iframe 已加载 control 模式 sheets 页面并注册执行器）；DSH 会话进行中；用户消息包含编辑意图。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 发送"把 B 列改成数值格式并求和" | 聊天消息发出 | agent 规划工具调用链 | agent 开始思考 |
| 2 | — | 工具卡片"读取工作簿上下文" | host 调 `POST /api/control/sheets/<docId>/context` | 卡片进行中 |
| 3 | — | — | agent 调 `xlsx_read_range` / `xlsx_read_cells` | 同上 |
| 4 | — | — | agent 调 `xlsx_propose_operations` / `xlsx_read_formats`；适配器 `executeTool` → Univer dispatch | iframe 内工作表对应单元格/区域实时更新 |
| 5 | — | 工具结果卡片返回 `{output, mutated:true}` | agent 汇总 | 聊天回复"已完成"，附摘要；原文件未变（BR-008） |
| 6 | 点 tab「写入磁盘」（或对 agent 说"保存"） | 按钮 loading→saved 提示"已保存到 \<path\>" | 适配器导出 xlsx 字节（复用保存管线）→ notify export → relay `POST /api/file` 原子写回 | 磁盘内容 = iframe 当前内容 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 执行器未注册 | iframe 未打开/已关闭/断线 | 工具卡片"请先在 GenOffice tab 打开该文档" | `{ok:false, error:'executor not registered'}` | 重新打开文档后重发 |
| 编辑器未就绪 | 字节仍在加载，Univer 未挂载 | 工具卡片 isError | 适配器回传 `editor not ready` | agent 等待后重试 |
| 非法参数 | read_range 的 range 非法 | 工具卡片解析错误 | 适配器 isError 附详情；文档不变 | agent 修正重试 |
| 超时 | SSE 断线/iframe 卡死 | 工具卡片 timeout | BR-010 语义；不重放 | 刷新 tab 后重发 |
| 格式保真失败 | 重打包失败（损坏的 xlsx） | 保存报错"写入失败：…" | export 回传 isError，不落盘 | 修复后重试（BR-009） |
| 写回冲突 | 原文件 mtime 与打开时不一致 | 红色提示"文件已被外部修改，未覆盖" | relay 拒绝写回 | 重新打开文档 |

**界面状态机**：

```text
idle → agent-planning → tool-running（逐卡）→ edited（iframe 可见变化）→ agent-reply
                │                              │
                └── error（卡片展示，可重试）────┘
保存：idle → saving（按钮 loading）→ saved | conflict | error
```

**入口接线清单**：

- DSH 聊天输入框 → agent 工具调度 → 插件 host `xlsx_*` 工具（Task 10 接线）
- GenOffice tab 打开 xlsx（文件浏览 / `dsh:open-local-file` 联动）→ iframe control 模式（Task 10 接线）
- relay 控制面 `/api/control/sheets/<docId>/*` → sheets 适配器（Task 8/9 接线）

#### UF-002: DSH 控制编辑 PPT（pptx）

**前置状态**：同上，slides 页面。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 发送"把第 2 页标题改为 X" | 消息发出 | agent 规划 | — |
| 2 | — | 工具卡片"读取演示文稿上下文" | `POST /api/control/slides/<docId>/context` | 卡片进行中 |
| 3 | — | — | `pptx_read_slide` 读取目标页 | 同上 |
| 4 | — | — | `pptx_set_element_text` → 适配器执行 → 幻灯片编辑面更新 | iframe 内第 2 页标题实时变化 |
| 5 | — | 结果卡片 `mutated:true` | agent 汇总 | 聊天回复"已修改第 2 页标题"；原文件未变 |
| 6 | 保存（按钮 / `pptx_save`） | saved 提示 | pptx 重打包 → 原子写回 | 磁盘 = iframe 内容 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 执行器未注册 | 未打开 pptx | 卡片错误 | `executor not registered` | 先打开文档 |
| 元素不存在 | set_element_text 的 sourceId 无效（页已改版） | 卡片 isError"元素不存在" | 适配器 isError；文档不变 | agent 重新 read_slide 后重试 |
| 编辑器未就绪 | slides 引擎加载中 | isError | `editor not ready` | 等待重试 |
| 非法参数 | element 参数非对象 | `invalid input` | relay 不转发 | 修正重试 |
| 超时 | 断线 | timeout | 不重放 | 刷新重试 |
| 格式保真失败 | pptx 重打包损坏 | 保存报错 | 不落盘（BR-009） | 修复重试 |

**界面状态机**：同 UF-001。

**入口接线清单**：

- 聊天 → host `pptx_*` 工具（Task 14 接线）
- tab 打开 pptx（`PREVIEWABLE` 扩展 + control URL，Task 14 接线）
- relay `/api/control/slides/<docId>/*` → slides 适配器（Task 13 接线）

#### UF-003: DSH 控制 PDF（标注/文本编辑）

**前置状态**：同上，pdf 页面。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 发送"高亮第 1 页第 2 段，并把'错误'改成'正确'" | 消息发出 | agent 规划 | — |
| 2 | — | 工具卡片"读取 PDF" | `POST /api/control/pdf/<docId>/context` | 卡片进行中 |
| 3 | — | — | `pdf_search_text` 定位 + `pdf_read_pages` 读页 | 同上 |
| 4 | — | — | `pdf_markup_text`（高亮）+ `pdf_edit_text`（改字）→ 适配器执行 → 标注/文本层更新 | iframe 内页面实时显示高亮与改写 |
| 5 | — | 结果卡片 `mutated:true` | agent 汇总 | 聊天回复完成；原文件未变 |
| 6 | 保存（按钮 / `pdf_save`） | saved 提示 | 标注合并导出 → 原子写回（ASM-004 定稿落盘形态） | 磁盘产物可打开 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 执行器未注册 | 未打开 pdf | 卡片错误 | `executor not registered` | 先打开文档 |
| 文本不匹配 | markup/edit 的 old_text 非页面原文 | 卡片 isError"原文不存在" | isError；文档不变 | agent 重读页面后重试 |
| 编辑器未就绪 | pdf 渲染/标注层加载中 | isError | `editor not ready` | 等待重试 |
| 非法参数 | 参数非对象 | `invalid input` | relay 不转发 | 修正重试 |
| 超时 | 断线 | timeout | 不重放 | 刷新重试 |
| 导出失败 | 标注合并失败 | 保存报错 | 不落盘 | 修复重试 |

**界面状态机**：同 UF-001。

**入口接线清单**：

- 聊天 → host `pdf_*` 工具（Task 18 接线）
- tab 打开 pdf（`PREVIEWABLE` 扩展 + control URL，Task 18 接线）
- relay `/api/control/pdf/<docId>/*` → pdf 适配器（Task 17 接线）

#### UF-004: 无 AI 助手模式（三 app）

**前置状态**：用户通过 DSH GenOffice tab 打开 xlsx/pptx/pdf；URL 由插件生成并带 `control=1`。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 文件浏览点击 xlsx/pptx/pdf 行 | 预览 loading 态 | 插件生成 `/sheets|slides|pdf/?control=1&open=path:<enc>` | 预览区出现编辑器 |
| 2 | — | — | app 解析 control=1：不渲染 AI dock / Ribbon AI 入口；适配器注册执行器 | 页面无任何 AI 助手 UI；编辑/预览功能完整 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 旧构建无适配器 | web-dist 未重建 | 按普通模式渲染（AI 出现） | control=1 被忽略（兼容降级） | 重建后刷新 |
| 非 control 回归 | 无 control=1 的 URL | AI 助手照常 | 行为与桌面版一致（INV-001） | —（预期行为） |

**界面状态机**：

```text
loading → editor-ready（control: 无 AI 元素 / 非 control: AI 元素照常）
```

**入口接线清单**：

- tab-genoffice `previewUrlFor` 生成带 `control=1` 的 URL（Task 20 接线）
- 三 app 解析 `control=1` 并条件渲染（Task 20 接线）
- 三 app 适配器注册（Task 9/13/17 接线）

### 2.4 INV 不变量

| 不变量 ID | 内容 | 关联 BR/UF | 验证方式 |
|---|---|---|---|
| INV-001 | 非 control 模式（URL 无 `control=1`）的三 app 行为与桌面版一致：AI 可用、保存=下载/另存、预览副本语义不变 | BR-001, UF-004 | browser 截图对比 |
| INV-002 | 控制面与写回端点默认仅 loopback（沿用 M0）；网络暴露未显式开启时默认拒绝 | BR-005 | contract curl 模拟非 loopback |
| INV-003 | 写回原子性：tmp+rename；任何失败不破坏原文件字节 | BR-004 | 故障注入 + 文件 diff |
| INV-004 | 契约镜像纪律：`contracts/control-api.md`（M0 文件扩展）为控制契约单一事实源；app 适配器 / relay / 插件三侧镜像点同步；smoke 断言形状与工具名集合 | BR-002, BR-007 | smoke 断言 |
| INV-005 | 编辑器状态唯一性：所有文档变更必须经编辑器实例（`executeTool` / Univer / slides 引擎 / pdf 标注层 dispatch）执行；禁止绕开编辑器直接改文件字节 | UF-001~003 | 代码 review + 工具链实测 |
| INV-006 | iframe sandbox 不放松：保持 `allow-scripts allow-same-origin allow-downloads` | UF-001~004 | 代码 review |
| INV-007 | 插件预览语义：未进入控制模式时现有预览行为（保存=下载副本、不写回原文件）不变 | UF-004 | browser 回归 |

### 2.5 EVD 证据清单

| 证据 ID | 类型 | 期望证据 | 保存位置 |
|---|---|---|---|
| EVD-001 | api | 三 app context/tool/写回端点 request+response JSON 样例（正常/未注册/非法参数/非 loopback 各一发） | `evidence/API-control/` |
| EVD-002 | screenshot | control=1 模式下 sheets/slides/pdf 页面截图（无 AI dock） | `evidence/UF-004/` |
| EVD-003 | log+screenshot | 端到端：agent 工具调用链日志 + 编辑前后截图 + 工具结果 JSON；原文件 diff 为空（未写回） | `evidence/UF-001|002|003/` |
| EVD-004 | log | `node scripts/dev.mjs smoke` 全绿日志（含扩展后的控制契约断言） | `evidence/phase-1/` |
| EVD-005 | diff | 写回前后文件字节 diff + mtime 记录 + tab 提示截图 | `evidence/UF-00x/`（按场景） |
| EVD-006 | screenshot | 非 control 模式回归截图（AI 助手存在 + 保存=下载提示） | `evidence/UF-004/` |
| EVD-007 | log | plugin `npm run build` + `npm run typecheck` 通过日志；upstream `npm run web` 构建通过日志 | `evidence/phase-0/` |
| EVD-008 | log+file | 格式保真校验：写回后的 xlsx/pptx/pdf 可被桌面版/Office 打开且关键内容/格式一致（含校验工具输出） | `evidence/UF-00x/format-fidelity/` |

### 2.6 角色与权限矩阵

| 角色 | 可见 | 可操作 | 禁止 | 失败提示 | 验证场景 |
|---|---|---|---|---|---|
| 用户 | DSH 聊天 + GenOffice tab（三 app 编辑器/保存按钮） | 发起编辑指令、触发写回 | 直接操作 iframe 内 AI 面板（M0 已隐藏，三 app 同） | tab 内错误提示/toast | UF-001~004 |
| DSH agent | 工具注册表 + 文档上下文 | 调用 `xlsx_*`/`pptx_*`/`pdf_*` 工具 | 绕过工具直接改文件（INV-005） | 工具结果 isError 语义 | UF-001~003 |
| relay/插件 host | 本机文件系统（loopback） | 控制面转发、写回 | 非 loopback 写回（INV-002） | `ok:false` + error | UF-001~003 |

### 2.7 负向 / 破坏性场景

| 场景 | Given | When | Then | Evidence |
|---|---|---|---|---|
| 写回冲突 | 文件被外部修改（mtime 变化） | 触发写回 | 拒绝写回，原文件不变 | EVD-005 |
| 断线 | SSE 连接中断 | agent 调用工具 | 超时错误，不重放 | EVD-003 |
| 非法输入 | agent 发出非 JSON/未知工具名 | 控制面收到调用 | `ok:false` + 明确错误 | EVD-001 |
| 非 loopback 写回 | 伪造 Host 头 | 请求到达 relay | 403 拒绝 | EVD-001 |
| 格式损坏 | 重打包损坏（磁盘 xlsx/pptx/pdf 被外部改坏） | 保存/打开 | 打开失败或导出 isError，不落盘；原文件不变 | EVD-008 |
| 旧构建兼容 | relay 托管旧 web-dist（无适配器） | 打开 control=1 URL | 按普通模式渲染，不崩溃 | EVD-006 |

### 2.8 非目标

- 不做 sheets/slides/pdf 的**全量桌面功能 Web 化**——只保证控制模式下可编辑的路径（按 P0 策略决议的核心子集），其余能力保持"桌面版可用"
- 不做 M0 已有能力回归之外的编辑器功能增强
- 不做 AI 编辑的 diff/回滚/修订评审 UX（沿用 ASM-003，P1 迭代另立项）
- 不做构建裁剪摘除 AI 依赖（ASM-003，仅运行时隐藏）
- 不做多文档并发编辑会话（ASM-005）
- 不改 iframe sandbox 策略（INV-006）
- 不改桌面版（Electron）任何行为；上游仓库保持可同步

---

## 3. 技术方案

### 3.3 三段式定位清单

> 行号只是 hint；漂移时以 symbol + grep anchor 为准。`待勘察` 项由 P0 校准任务补齐。

| 文件 | 稳定定位 | 搜索定位 | 行号 hint | 备注 |
|---|---|---|---|---|
| `upstream/web/server.mjs` | `async function handleApi` / `findStaticRoots` | `grep -n "async function handleApi\|findStaticRoots" upstream/web/server.mjs` | L209 / L79 | 控制面 app 白名单扩展点 |
| `contracts/control-api.md` | §2.3 app 白名单 / §4 工具名集合 | `grep -n "app ∈\|工具名集合" contracts/control-api.md` | — | M0 契约扩展 |
| `scripts/dev.mjs` | smoke 控制面断言块 | `grep -n "control\|工具名集合" scripts/dev.mjs` | L207 起 | 扩展 app/工具名断言 |
| `upstream/apps/sheets/src/renderer/main.tsx` | `ReactDOM.createRoot` | `grep -n "createRoot" apps/sheets/src/renderer/main.tsx` | L46 | sheets 入口 |
| `upstream/apps/sheets/src/renderer/create-univer.ts` | `import { Univer }` | `grep -n "Univer" apps/sheets/src/renderer/create-univer.ts` | L9 | Univer 引擎装配 |
| `upstream/apps/sheets/src/renderer/ai/workbook-skill.ts` | `export function createWorkbookSkill` | `grep -n "createWorkbookSkill" apps/sheets/src/renderer/ai/workbook-skill.ts` | L20 | 执行器复用源 |
| `upstream/apps/sheets/src/renderer/ai/tools.ts` | `WORKBOOK_TOOLS` / `export function executeWorkbookTool` | `grep -n "WORKBOOK_TOOLS\|executeWorkbookTool" apps/sheets/src/renderer/ai/tools.ts` | L360 | xlsx 工具定义源 |
| `upstream/apps/sheets/src/renderer/App.tsx` | `createWorkbookSkill(sheetsSkillDeps())` | `grep -n "createWorkbookSkill" apps/sheets/src/renderer/App.tsx` | L798 | skill 装配点 |
| `upstream/apps/sheets/src/renderer/web-bridge.ts` | （新建，参照 docs 版） | — | P0 已定稿（web-strategy.md）：desktopApi 浏览器子集 + gateway 复用；参照 `apps/docs/src/renderer/web-bridge.ts` `const desktop` L489 |
| `upstream/apps/slides/src/renderer/App.tsx` | `window.slidesApi` 依赖面 | `grep -rn "window\.slidesApi" apps/slides/src/renderer` | L345 等（245 处） | Web 化主战场 |
| `upstream/apps/slides/src/renderer/ai/slides-skill.ts` | 工具定义 | `grep -n "name: '" apps/slides/src/renderer/ai/slides-skill.ts` | L337 起 | pptx 工具定义源 |
| `upstream/apps/slides/src/renderer/file-actions.ts` | `window.slidesApi.save()` / `saveAs()` | `grep -n "slidesApi" apps/slides/src/renderer/file-actions.ts` | L44 / L64 | 保存管线入口 |
| `upstream/apps/slides/src/renderer/web-bridge.ts` | （新建） | — | P0 已定稿（slidesapi-inventory.md：129 方法清单 + web-strategy.md：pptx-engine 会话模型） |
| `upstream/apps/pdf/src/renderer/ai/pdf-skill.ts` | `export function createPdfSkill` | `grep -n "createPdfSkill" apps/pdf/src/renderer/ai/pdf-skill.ts` | 文件头 | 执行器复用源 |
| `upstream/apps/pdf/src/renderer/ai/tools.ts` | `AGENT_TOOLS` / `executePdfTool` | `grep -n "AGENT_TOOLS\|executePdfTool" apps/pdf/src/renderer/ai/tools.ts` | L81 起 | pdf 工具定义源 |
| `upstream/apps/pdf/src/renderer/web-bridge.ts` | （新建） | — | P0 已定稿（sheets-pdf-survey.md：pdfApi 26 方法 + web-strategy.md：pdf-lib 浏览器合并 + wasm `?url`） |
| `plugin/packages/tab-genoffice/src/tabs/genoffice.tsx` | `const PREVIEWABLE` | `grep -n "PREVIEWABLE" plugin/packages/tab-genoffice/src/tabs/genoffice.tsx` | L24 | 扩展 xlsx/pptx/pdf |
| `plugin/packages/tab-genoffice/src/host/tool-schema.ts` | `CONTROL_TOOL_TABLE` | `grep -n "CONTROL_TOOL_TABLE" plugin/packages/tab-genoffice/src/host/tool-schema.ts` | 定义处 | xlsx_*/pptx_*/pdf_* 工具表 |
| `plugin/packages/tab-genoffice/src/host/tools.ts` | `createControlTools` | `grep -n "createControlTools" plugin/packages/tab-genoffice/src/host/tools.ts` | 定义处 | 工具执行（沿用 M0 模式） |

---

## 4. Phase 计划与任务详情

> Phase 依赖链：

```text
P0 基线与勘察 ──► P1 契约与控制面扩展 ──► P2 sheets 接入 ──► P3 slides 接入 ──► P4 pdf 接入 ──► P5 去 AI 与插件收尾 ──► P6 端到端验收
```

> 任务状态跟踪：任务数 ≥ 8，用同目录 `tasks.csv`。

> 任务详情（第 4 章完整版）与验收协议（第 5 章）在 Stage 2 补全。

### 3.1 架构 Before / After

```text
Before（M0 之后、本包之前）:
DSH agent ── docx_*/markdown_* 工具 ──► relay 控制面（app ∈ {docs, markdown}）
   └─ GenOffice tab iframe：docs/markdown 可控制编辑；sheets/slides/pdf 列表置灰"仅桌面版可用"

After（本包）:
DSH agent ── xlsx_*/pptx_*/pdf_* 工具 ──► relay 控制面（app ∈ {docs, markdown, sheets, slides, pdf}）
   ├─ sheets iframe：Univer 引擎 + 控制适配器（xlsx 读写：按 P0 决议）
   ├─ slides iframe：slidesApi 浏览器实现面 + 控制适配器（核心编辑子集）
   └─ pdf iframe：pdf.js 渲染 + 标注/文本编辑层 + 控制适配器
   三 app 控制模式均无 AI 助手；写回统一走 POST /api/file（tmp+rename）
```

### 3.2 模块改造

| 模块 | 职责 | 改造说明 |
|---|---|---|
| `contracts/control-api.md` | 控制契约单一事实源（M0 文件） | app 注册表扩为 {docs, markdown, sheets, slides, pdf}；工具名集合表追加 xlsx_*/pptx_*/pdf_*；镜像点声明更新 |
| `upstream/web/server.mjs` | relay 控制面 | 控制面 app 白名单（controlMatch 正则）扩展；`findStaticRoots` 已含全部 app（构建后自动托管） |
| `scripts/dev.mjs` | 栈工具 | smoke 新增：扩展 app 的控制面端点形状断言、工具名集合镜像（xlsx/pptx/pdf ↔ skill ↔ 契约） |
| `apps/sheets/src/renderer/web-bridge.ts`（新） | sheets Web 桥 | desktopApi 替代面（language/theme/open/save/notifyPendingEdits 等，按 P0 勘察清单）；`vite.web.config.ts` 参照 docs |
| `apps/sheets/src/renderer/control.ts`（新） | sheets 控制适配器 | control=1 解析、EventSource 注册/注销、context/tool/export 事件处理、executeWorkbookTool 桥接、导出复用保存管线 |
| `apps/slides/src/renderer/web-bridge.ts`（新） | slides Web 桥 | slidesApi 浏览器实现面（打开/保存/编辑核心子集，按 P0 方法清单）；`vite.web.config.ts` |
| `apps/slides/src/renderer/control.ts`（新） | slides 控制适配器 | 同上（执行器来自 slides-skill） |
| `apps/pdf/src/renderer/web-bridge.ts`（新） | pdf Web 桥 | 打开/保存字节管线（pdf.js + 标注层导出）；`vite.web.config.ts` |
| `apps/pdf/src/renderer/control.ts`（新） | pdf 控制适配器 | 同上（执行器来自 pdf-skill） |
| 三 app `App.tsx` + Ribbon | 编辑器外壳 | control=1 条件渲染隐藏 AI dock/Ribbon AI 入口（hideAi prop，沿用 M0 模式） |
| `plugin/packages/tab-genoffice/src/tabs/genoffice.tsx` | 插件 tab | PREVIEWABLE 扩展 {xlsx→sheets, pptx→slides, pdf→pdf}；previewUrlFor 带 control=1；「写入磁盘」按钮沿用 |
| `plugin/packages/tab-genoffice/src/host/tool-schema.ts` | 工具定义生成器 | CONTROL_TOOL_TABLE 追加 xlsx_*(7+save)/pptx_*(13+save)/pdf_*(15+save) |
| `plugin/packages/tab-genoffice/src/host/tools.ts` | host 工具执行 | 沿用 M0（app 由扩展名映射：xlsx→sheets/pptx→slides/pdf→pdf） |

### 3.4 API / 数据 / 权限 / 路由影响

| 类型 | 是否影响 | 说明 | 兼容策略 |
|---|---|---|---|
| API | 是（扩展） | 控制面 app 白名单扩为 5 个；端点形状不变；`POST /api/file` 不变 | 全部扩展性改动，不动现有端点形状；smoke 断言向后兼容 |
| 数据 | 是（轻量） | relay 内存注册表 app 维度；三 app 各自 IndexedDB 语义沿用桌面版 | 注册表无持久化；断线重连由适配器负责 |
| 权限 | 否 | loopback 边界沿用（INV-002） | 不新增环境变量 |
| 路由 | 是（参数级） | 三 app 新增 `?control=1` 查询参数；打开后清除（沿用 M0） | 无该参数走原逻辑（INV-001） |

---

## 4. Phase 计划与任务详情

> 任务状态跟踪：任务数 24 ≥ 8，用同目录 `tasks.csv`。

### Phase 0: 基线与勘察

> 你在哪里：三 app（sheets/slides/pdf）均未 Web 化（无 web-bridge/vite.web.config/web-dist），但 AI 工具集（AgentSkill）已就绪；控制契约 app 白名单仅 docs/markdown。
> 做完之后：三 app Web 化缺口勘察完成、策略决议落盘；基线证据归档。

### Task 1: 记录基线并勘察三 app Web 化缺口

- **关联**：EVD-007 / INV-001（前置勘察）；UF 写 NA（内部任务，无用户可见流程）
- **前置任务**：无
- **风险等级**：P0

**为什么做**：三 app 的 Web 化工程量是最大未知；勘察产出 slidesApi 方法清单、sheets 读写依赖、pdf 打开/保存管线，补齐 3.3 定位清单的 `待勘察` 行（三态规则：事实必须来自实际命令）。

**涉及文件与定位**：

- `apps/slides/src/renderer/`：`window.slidesApi` 全量方法清单，`grep -rn "window\.slidesApi" apps/slides/src/renderer`，245 处（hint）
- `apps/sheets/src/renderer/`：Univer 装配（`create-univer.ts` L9）+ desktopApi 依赖面（`grep -n "desktopApi" apps/sheets/src/renderer`，待勘察）
- `apps/pdf/src/renderer/`：打开/保存/渲染管线（`App.tsx` 浏览器原生窗口依赖，待勘察）
- `apps/docs/src/renderer/web-bridge.ts`：Web 桥参考实现（`const desktop` L489，hint）

**具体操作**：

1. 运行并记录：`git status --short` / `git log --oneline -3`（栈根 + upstream）→ `evidence/phase-0/commands.log`
2. 用 grep 枚举 slides 全部 `window.slidesApi.<method>` 方法名 → 方法清单落盘 `evidence/phase-0/slidesapi-inventory.md`（按方法分组：open/save/edit/history/search/export…）
3. 勘察 sheets 的 xlsx 读写依赖（Univer 读写插件、sidecar 引用）与 pdf 的打开/保存/渲染管线 → 各自小节落盘
4. 浏览器基线：chrome MCP 打开 `http://localhost:8787/sheets/` 等 → 确认未构建 404 行为，截图存档（非 control 基线）

**验证**：`ls evidence/phase-0/` → 含 commands.log、slidesapi-inventory.md、sheets-pdf-survey.md、baseline 截图

**Evidence**：`evidence/phase-0/`

**注意事项**：不得修改任何源码；方法清单必须来自实际 grep 输出，禁止凭记忆补方法名。

### Task 2: 三 app Web 化策略决议

- **关联**：ASM-001 / BR-001 / INV-001；UF 写 NA（内部决议）
- **前置任务**：1
- **风险等级**：P0

**为什么做**：ASM-001 的三条路线（sheets sidecar-vs-wasm、slides 移植-vs-浏览器引擎、pdf 管线）必须基于 Task 1 勘察定稿；决议直接决定 P2-P4 的工程量与验收口径。

**涉及文件与定位**：

- `evidence/phase-0/web-strategy.md`：新建（策略决议落盘）
- `spec.md` 第 1.4 节：ASM-001 定稿更新

**具体操作**：

1. 按 Task 1 勘察结果对三 app 各定一条路线并写明理由与风险：sheets（xlsx 读写后端：relay 代理 sidecar vs wasm）；slides（slidesApi 浏览器实现面覆盖范围：打开/保存/编辑核心子集，明确不覆盖面）；pdf（pdf.js 渲染 + 标注层 + 导出形态：合并 PDF vs 侧车文件）
2. 明确 slides 降级条件（如方法数 > 阈值则只做"控制面打通 + 只读上下文 + 最小编辑子集"）
3. 更新 spec 1.4 ASM-001/ASM-004 定稿内容

**验证**：`ls evidence/phase-0/web-strategy.md` 存在且三 app 各有一条明确路线

**Evidence**：`evidence/phase-0/web-strategy.md`

**注意事项**：决议必须可执行——每条路线注明"谁做、怎么做、验证命令"；不得留"再看"式决议。

### Task 3: 执行 Phase 0 回归验证

- **关联**：本 Phase 全部 BR/UF/INV
- **前置任务**：1;2

**验证**：`node scripts/dev.mjs smoke` → 全部通过（M0 现状不回归）；定位清单 `待勘察` 行已全部补齐或标注 P0 已覆盖

**Evidence**：`evidence/phase-0/phase-0-summary.md`

### Phase 1: 契约与控制面扩展

> 你在哪里：控制契约与 relay 控制面 app 白名单仅 {docs, markdown}。
> 做完之后：契约注册表含 5 app，工具名集合表含 xlsx_*/pptx_*/pdf_*，smoke 断言覆盖扩展。

### Task 4: 扩展 contracts/control-api.md 控制契约

- **关联**：BR-002 / BR-007 / INV-004；UF 写 NA（内部契约，UF 由 Task 9/13/17/20 消费）
- **前置任务**：3
- **风险等级**：P0

**为什么做**：契约是跨四侧（三 app 适配器 / relay / 插件 / smoke）的单一事实源；先扩展契约再实现，防止镜像漂移（INV-004）。

**涉及文件与定位**：

- `contracts/control-api.md`：§2.3 app 白名单、§4 工具名集合表、镜像点声明，`grep -n "app ∈\|工具名集合" contracts/control-api.md`

**具体操作**：

1. app 注册表扩展：`app ∈ {docs, markdown, sheets, slides, pdf}`（§2.3 + 2.6 语义沿用）
2. 工具名集合表追加（name 以 `_` 分隔，ASM-002）：`xlsx_*` 7 个（get_workbook_context/read_range/load_guide/read_formats/read_sheet_features/read_cells/propose_operations）+ `xlsx_save`；`pptx_*` 13 个（get_deck_context/read_slide/set_element_text/set_element_style/set_element_transform/execute_slide_script/set_element_fill/set_element_stroke/web_search/image_search/generate_image/analyze_media + 其余以 Task 1 清单为准）+ `pptx_save`；`pdf_*` 15 个（read_pages/search_text/goto_page/markup_text/edit_text/edit_block/image_search/generate_image/list_page_images/insert_image/transform_image/rotate_image/replace_image/delete_image/list_form_fields）+ `pdf_save`
3. 扩展名 → app 映射：xlsx→sheets、pptx→slides、pdf→pdf（§4 备注）
4. 镜像点声明更新（4 处：三 app control.ts / server.mjs / tab-genoffice host / scripts/dev.mjs，注释 INV-004 指向本文件）

**验证**：`python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/genoffice-dsh-office` 契约 ID 引用闭环；人工评审：镜像点声明覆盖新 app

**Evidence**：`evidence/phase-1/contract-extension.md`（评审记录）

**注意事项**：禁止在契约中引入非 JSON 消息格式；SSE/notify 双向通道沿用 ASM-008（M0）设计，不得改传输。

### Task 5: relay 控制面 app 白名单扩展与 smoke 断言

- **关联**：BR-002 / BR-003 / INV-004；UF 写 NA（传输/断言层）
- **前置任务**：4
- **风险等级**：P0

**为什么做**：控制面 `/api/control/<app>/<docId>/*` 的正则白名单决定三 app 是否可达；smoke 断言是 INV-004 的机器闸门。

**涉及文件与定位**：

- `upstream/web/server.mjs`：`controlMatch` 正则，`grep -n "controlMatch" upstream/web/server.mjs`，L399（hint）
- `scripts/dev.mjs`：smoke 控制面断言块，`grep -n "控制面\|工具名集合" scripts/dev.mjs`，L207（hint）

**具体操作**：

1. `controlMatch` 正则扩展 app 集合：`(docs|markdown|sheets|slides|pdf)`（其余语义不变）
2. smoke 新增断言：五个 app 的未注册错误形状（`POST /api/control/<app>/<64hex>/context` → `executor not registered`）；工具名集合镜像扩展到 xlsx/pptx/pdf（契约 ↔ skill AGENT_TOOLS ↔ 插件 host 注册）
3. 契约 ↔ skill 镜像断言读取 `apps/{sheets,slides,pdf}/src/renderer/ai/*.ts` 的 `name: '…'` 集合

**验证**：`node scripts/dev.mjs smoke` → 全部 PASS（含新增断言）

**Evidence**：`evidence/phase-1/smoke.log`

**注意事项**：未知 app 仍返回 404（不破坏现有语义）；不得为过断言放宽契约。

### Task 6: 执行 Phase 1 回归验证

- **关联**：本 Phase 全部 BR/UF/INV
- **前置任务**：4;5

**验证**：`node scripts/dev.mjs smoke` → 全绿（含扩展断言）；curl 抽查五 app 未注册/未知 app 两态

**Evidence**：`evidence/phase-1/phase-1-summary.md`

### Phase 2: sheets 接入

> 你在哪里：sheets 未 Web 化，但 Univer 引擎与 workbook-skill（7 工具）已就绪。
> 做完之后：sheets 可在控制模式下被 DSH 编辑并显式写回 xlsx。

### Task 7: sheets Web 化基础（web-bridge + 构建接入）

- **关联**：BR-001 / INV-001 / INV-005；UF-001（前置）
- **前置任务**：6
- **风险等级**：P0

**为什么做**：sheets 渲染器当前依赖 `window.desktopApi`（Electron 注入）；Web 桥提供浏览器替代面，是控制模式与保存管线的地基。

**涉及文件与定位**：

- `apps/sheets/src/renderer/web-bridge.ts`：新建（参照 `apps/docs/src/renderer/web-bridge.ts` 的 `const desktop` L489，hint）
- `apps/sheets/vite.web.config.ts`：新建（参照 `apps/docs/vite.web.config.ts`）
- `apps/sheets/src/renderer/App.tsx`：`window.desktopApi` 依赖面（`grep -n "desktopApi" apps/sheets/src/renderer`，待勘察行号——Task 1 已勘察）

**具体操作**：

1. 按 Task 1 勘察清单实现 desktopApi 替代面：语言/主题（localStorage）、打开（`?open=path:` 形态 + relay `/api/file`）、保存（导出字节 → 下载/写回）、`notifyPendingEdits` 等
2. 复制 `apps/docs/vite.web.config.ts` 为 sheets 版（注入桥 + CSP + `base: '/sheets/'`）
3. `web/server.mjs` 的 `findStaticRoots` 候选已含 sheets（L79 hint）——构建后自动托管；验证 `npm run web:build -w @genoffice/sheets`

**验证**：`npm run web:build -w @genoffice/sheets` 构建成功；浏览器打开 `/sheets/?open=path:<tmp.xlsx>` → 编辑器加载，console 无 error

**Evidence**：`evidence/phase-2/sheets-web-console.log`

**注意事项**：禁止复制 docs 桥的 AI 直连逻辑；Web 桥只做打开/保存/主题等基础面（AI 在 control 模式隐藏，非 control 模式可保留 BYOK——以桌面版语义为准，INV-001）。

### Task 8: xlsx 读写后端接入（保存管线）

- **关联**：BR-004 / BR-009 / UF-001；INV-003
- **前置任务**：7
- **风险等级**：P1

**为什么做**：控制模式写回需要"当前工作簿字节"；xlsx 的读写后端（sidecar 或 wasm）决定保存管线能否复用。

**涉及文件与定位**：

- `apps/sheets/src/renderer/`：保存管线入口（`grep -n "save\|export" apps/sheets/src/renderer/file-actions.ts` 或等价文件，待勘察——Task 1 已勘察）
- `upstream/web/server.mjs`：若走 relay sidecar 代理则新增端点（`handleApi`，L209 hint）

**具体操作**：

1. 按 Task 2 决议接入 xlsx 读写后端（wasm 直连浏览器 或 relay 代理 sidecar）
2. 实现 `exportBytes()` 等价物：从 Univer 状态导出当前 xlsx 字节（复用保存管线，不重新解析磁盘文件——INV-005）
3. 若走 relay 端点：遵循 loopback 边界与 50MB 上限（沿用 M0）

**验证**：控制模式下触发导出（临时注入）→ 字节与编辑器状态一致；导出后原文件未变（BR-008 半程）

**Evidence**：`evidence/phase-2/sheets-export-bytes.json`

**注意事项**：导出必须走编辑器状态（Univer dirty 语义），禁止绕开编辑器（INV-005）。

### Task 9: sheets 控制适配器

- **关联**：BR-001 / BR-002 / BR-003 / UF-001；INV-005 / INV-006
- **前置任务**：7;8
- **风险等级**：P0

**为什么做**：sheets 编辑能力的对外执行面；复用 `executeWorkbookTool`（INV-005）。

**涉及文件与定位**：

- `apps/sheets/src/renderer/control.ts`：新建（参照 `apps/markdown/src/renderer/control.ts` 的适配器结构）
- `apps/sheets/src/renderer/ai/tools.ts`：`executeWorkbookTool`（L360 hint）/ `buildWorkbookContext`（workbook-skill L20 hint）
- `apps/sheets/src/renderer/App.tsx`：编辑器就绪后接线（`createWorkbookSkill` 装配点 L798 hint）

**具体操作**：

1. 实现 `initControlMode(getEditor, {exportBytes})`（结构沿用 M0 适配器）：control=1 解析、docId=sha256(绝对路径)、EventSource 注册/注销、tool 事件 → `executeWorkbookTool(call, deps)` → notify；context 事件 → `buildWorkbookContext(deps)`；export 事件 → `exportBytes()` → notify；可见时重连、pagehide 注销
2. 工具输入校验与错误处理沿用 M0（invalid input / editor not ready / 异常 isError）
3. App.tsx 接线：编辑器就绪后 initControlMode（非 control 零副作用）

**验证**：`npm run web:build -w @genoffice/sheets` 通过；浏览器 `/sheets/?control=1&open=path:<tmp.xlsx>` → console 无 error；DevTools 注入等价 `executeTool` 调用 → 工作表变化

**Evidence**：`evidence/phase-2/sheets-control-console.log`

**注意事项**：禁止直接改文件字节/IndexedDB（INV-005）；EventSource 失败需 console 可见（不能吞错误）。

### Task 10: xlsx_* 工具定义与 host 执行 + tab 接线

- **关联**：BR-007 / BR-008 / UF-001；INV-004 / INV-007
- **前置任务**：9
- **风险等级**：P0

**为什么做**：DSH agent 侧执行面 + 用户可见入口（2.3 节 UF-001 接线清单）。

**涉及文件与定位**：

- `plugin/packages/tab-genoffice/src/host/tool-schema.ts`：`CONTROL_TOOL_TABLE`（定义处）
- `plugin/packages/tab-genoffice/src/host/tools.ts`：`createControlTools`（定义处）
- `plugin/packages/tab-genoffice/src/tabs/genoffice.tsx`：`PREVIEWABLE`（L24 hint）/ `previewUrlFor`（L57 hint）

**具体操作**：

1. tool-schema.ts 追加 `xlsx_*` 8 个工具定义（7 skill + save；inputSchema 镜像 sheets tools.ts；`path` 参数沿用）
2. tools.ts 的 app 映射扩展：xlsx→sheets（`appByExt` 映射表，docx→docs/md→markdown/xlsx→sheets）
3. genoffice.tsx：`PREVIEWABLE` 扩展 `{xlsx:'sheets', pptx:'slides', pdf:'pdf'}`（pptx/pdf 待对应 Phase 生效，可一次扩展）；「写入磁盘」按钮沿用（按扩展名映射 app）
4. 插件构建 + 3099 重启后验证工具注册

**验证**：`cd plugin && npm run build && npm run typecheck` 通过；DSH 会话让 agent 调 `xlsx_get_workbook_context` → 返回真实内容

**Evidence**：`evidence/phase-2/xlsx-tools.log`

**注意事项**：工具入参含路径时校验绝对路径（INV-002 侧）；工具不得自行写盘（BR-008）。

### Task 11: 执行 Phase 2 回归验证

- **关联**：本 Phase 全部 BR/UF/INV
- **前置任务**：7;8;9;10

**验证**：`node scripts/dev.mjs smoke` 全绿；`/sheets/?control=1` 浏览器走查（打开/注册/调用/导出）无 console error

**Evidence**：`evidence/phase-2/phase-2-summary.md`

### Phase 3: slides 接入

> 你在哪里：slides 未 Web 化，slidesApi 依赖面 245 处；slides-skill（≥13 工具）已就绪。
> 做完之后：slides 在控制模式下可被 DSH 编辑（按 P0 决议的核心子集）并显式写回 pptx。

### Task 12: slides Web 化基础（slidesApi 浏览器实现面）

- **关联**：BR-001 / INV-001 / INV-005；UF-002（前置）
- **前置任务**：11
- **风险等级**：P0

**为什么做**：slides 渲染器全部编辑/保存/历史走 `window.slidesApi`；浏览器实现面是控制模式的地基（覆盖范围由 Task 2 决议定稿）。

**涉及文件与定位**：

- `apps/slides/src/renderer/web-bridge.ts`：新建（实现 `window.slidesApi` 的浏览器替代面）
- `apps/slides/vite.web.config.ts`：新建（参照 docs）
- `apps/slides/src/renderer/App.tsx`：`window.slidesApi` 消费点（L345 等，245 处）
- `evidence/phase-0/slidesapi-inventory.md`：方法清单（Task 1 产物）

**具体操作**：

1. 按方法清单实现核心子集（Task 2 决议）：打开（`?open=path:` → 字节 → 引擎加载）、保存（pptx 重打包导出字节）、编辑面（editText/editTransform/editFill/editStroke/batchEditTransform/beginHistoryBatch/endHistoryBatch/undo/redo）、语言/主题
2. 未覆盖方法：实现为显式不可用（console.warn + 默认值），不得静默吞掉（防呆规则）
3. `vite.web.config.ts` + 构建接入（`findStaticRoots` 已含 slides）

**验证**：`npm run web:build -w @genoffice/slides` 构建成功；浏览器 `/slides/?open=path:<tmp.pptx>` → 编辑器加载，console 无 error（未覆盖方法仅 warn）

**Evidence**：`evidence/phase-3/slides-web-console.log`

**注意事项**：按 Task 2 决议的覆盖范围执行；若决议为降级子集，保存/打开必须仍可用（写回是 BR-008 前提）。

### Task 13: slides 控制适配器

- **关联**：BR-001 / BR-002 / BR-003 / UF-002；INV-005 / INV-006
- **前置任务**：12
- **风险等级**：P0

**为什么做**：slides 编辑能力的对外执行面；执行器来自 slides-skill（INV-005）。

**涉及文件与定位**：

- `apps/slides/src/renderer/control.ts`：新建（参照 M0 适配器结构）
- `apps/slides/src/renderer/ai/slides-skill.ts`：工具/上下文（`grep -n "name: '" apps/slides/src/renderer/ai/slides-skill.ts`，L337 起）
- `apps/slides/src/renderer/App.tsx`：编辑器就绪后接线

**具体操作**：

1. 实现 `initControlMode(getEditor, {exportBytes})`（沿用 M0 结构）：注册/注销、tool/context/export 事件、executeTool 桥接 slides-skill、导出复用保存管线
2. 编辑器未就绪 → `editor not ready`（UF-002 失败分支）
3. App.tsx 接线（非 control 零副作用）

**验证**：`npm run web:build -w @genoffice/slides` 通过；`/slides/?control=1&open=path:<tmp.pptx>` console 无 error；注入调用 → 幻灯片变化

**Evidence**：`evidence/phase-3/slides-control-console.log`

**注意事项**：同 Task 9 注意事项。

### Task 14: pptx_* 工具定义与 host 执行 + tab 接线

- **关联**：BR-007 / BR-008 / UF-002；INV-004 / INV-007
- **前置任务**：13
- **风险等级**：P0

**为什么做**：DSH agent 侧执行面 + 用户可见入口（2.3 节 UF-002 接线清单）。

**涉及文件与定位**：

- `plugin/packages/tab-genoffice/src/host/tool-schema.ts`：`CONTROL_TOOL_TABLE`
- `plugin/packages/tab-genoffice/src/host/tools.ts`：app 映射（xlsx→sheets 已加，追加 pptx→slides）
- `plugin/packages/tab-genoffice/src/tabs/genoffice.tsx`：`PREVIEWABLE`（pptx 已随 Task 10 扩展）

**具体操作**：

1. tool-schema.ts 追加 `pptx_*`（13 skill + save；inputSchema 镜像 slides-skill）
2. tools.ts app 映射追加 pptx→slides
3. 插件构建 + 3099 重启验证

**验证**：`cd plugin && npm run build && npm run typecheck` 通过；DSH 会话让 agent 调 `pptx_get_deck_context` → 返回真实内容

**Evidence**：`evidence/phase-3/pptx-tools.log`

**注意事项**：同 Task 10 注意事项。

### Task 15: 执行 Phase 3 回归验证

- **关联**：本 Phase 全部 BR/UF/INV
- **前置任务**：12;13;14

**验证**：`node scripts/dev.mjs smoke` 全绿；`/slides/?control=1` 浏览器走查无 console error

**Evidence**：`evidence/phase-3/phase-3-summary.md`

### Phase 4: pdf 接入

> 你在哪里：pdf 未 Web 化，但渲染器窗口依赖基本为浏览器原生；pdf-skill（≥15 工具）已就绪。
> 做完之后：pdf 在控制模式下可被 DSH 标注/编辑并显式写回。

### Task 16: pdf Web 化基础（web-bridge + 打开/保存管线）

- **关联**：BR-001 / INV-001 / INV-005；UF-003（前置）
- **前置任务**：15
- **风险等级**：P0

**为什么做**：pdf 渲染器虽依赖浏览器原生 API，但打开/保存/标注导出需要 Web 桥与字节管线。

**涉及文件与定位**：

- `apps/pdf/src/renderer/web-bridge.ts`：新建（语言/主题/打开/保存）
- `apps/pdf/vite.web.config.ts`：新建（参照 docs）
- `apps/pdf/src/renderer/App.tsx`：打开/保存/标注层入口（浏览器原生窗口依赖，Task 1 已勘察）

**具体操作**：

1. 实现 Web 桥：`?open=path:` → relay `/api/file` 字节 → pdf.js 渲染；保存 = 标注合并导出字节（形态按 Task 2 决议：合并 PDF 或侧车文件）
2. `vite.web.config.ts` + 构建接入

**验证**：`npm run web:build -w @genoffice/pdf` 构建成功；浏览器 `/pdf/?open=path:<tmp.pdf>` → 渲染 + 标注可操作，console 无 error

**Evidence**：`evidence/phase-4/pdf-web-console.log`

**注意事项**：标注/编辑必须经编辑器层（INV-005）；导出失败不落盘（INV-003）。

### Task 17: pdf 控制适配器

- **关联**：BR-001 / BR-002 / BR-003 / UF-003；INV-005 / INV-006
- **前置任务**：16
- **风险等级**：P0

**为什么做**：pdf 标注/编辑能力的对外执行面；执行器来自 pdf-skill（INV-005）。

**涉及文件与定位**：

- `apps/pdf/src/renderer/control.ts`：新建（沿用 M0 适配器结构）
- `apps/pdf/src/renderer/ai/tools.ts`：`AGENT_TOOLS` / `executePdfTool`（L81 起）
- `apps/pdf/src/renderer/ai/pdf-skill.ts`：`createPdfSkill`（文件头）

**具体操作**：

1. 实现 `initControlMode(getEditor, {exportBytes})`：注册/注销、tool/context/export 事件、executePdfTool 桥接、标注导出
2. 编辑器未就绪 → `editor not ready`（UF-003 失败分支）
3. App.tsx 接线（非 control 零副作用）

**验证**：`npm run web:build -w @genoffice/pdf` 通过；`/pdf/?control=1&open=path:<tmp.pdf>` console 无 error；注入调用 → 标注/文本变化

**Evidence**：`evidence/phase-4/pdf-control-console.log`

**注意事项**：同 Task 9 注意事项。

### Task 18: pdf_* 工具定义与 host 执行 + tab 接线

- **关联**：BR-007 / BR-008 / UF-003；INV-004 / INV-007
- **前置任务**：17
- **风险等级**：P0

**为什么做**：DSH agent 侧执行面 + 用户可见入口（2.3 节 UF-003 接线清单）。

**涉及文件与定位**：

- `plugin/packages/tab-genoffice/src/host/tool-schema.ts`：`CONTROL_TOOL_TABLE`
- `plugin/packages/tab-genoffice/src/host/tools.ts`：app 映射追加 pdf→pdf
- `plugin/packages/tab-genoffice/src/tabs/genoffice.tsx`：`PREVIEWABLE`（pdf 已随 Task 10 扩展）

**具体操作**：

1. tool-schema.ts 追加 `pdf_*`（15 skill + save；inputSchema 镜像 pdf tools.ts）
2. tools.ts app 映射追加 pdf→pdf
3. 插件构建 + 3099 重启验证

**验证**：`cd plugin && npm run build && npm run typecheck` 通过；DSH 会话让 agent 调 `pdf_read_pages` → 返回真实内容

**Evidence**：`evidence/phase-4/pdf-tools.log`

**注意事项**：同 Task 10 注意事项。

### Task 19: 执行 Phase 4 回归验证

- **关联**：本 Phase 全部 BR/UF/INV
- **前置任务**：16;17;18

**验证**：`node scripts/dev.mjs smoke` 全绿；`/pdf/?control=1` 浏览器走查无 console error

**Evidence**：`evidence/phase-4/phase-4-summary.md`

### Phase 5: 去 AI 与插件收尾

> 你在哪里：三 app 控制模式仍会渲染 AI 面板（Task 9/13/17 只加了控制能力）。
> 做完之后：控制模式下 AI 助手整体不可见；非控制模式零回归；插件构建全绿。

### Task 20: 三 app 控制模式隐藏 AI 助手

- **关联**：BR-006 / UF-004；INV-001
- **前置任务**：19
- **风险等级**：P1

**为什么做**：BR-006 主体——控制模式下不渲染任何 AI 助手 UI（沿用 M0 的 hideAi 模式，ASM-003）。

**涉及文件与定位**：

- `apps/sheets/src/renderer/App.tsx`：ai-dock / AiPanel 挂载点（`grep -n "ai-dock\|AiPanel" apps/sheets/src/renderer/App.tsx`，待勘察行号——Task 1 已勘察）
- `apps/slides/src/renderer/App.tsx`：同上
- `apps/pdf/src/renderer/App.tsx`：同上

**具体操作**：

1. 三 app 各新增 `hideAi` 条件（`CONTROL_MODE` 模块级解析，参照 M0 `apps/*/renderer/control.ts`）：ai-dock 不渲染、Ribbon AI 入口与快捷按钮隐藏
2. 非 control 分支代码路径不变（INV-001）

**验证**：三 app `/…/?control=1&open=path:…` 截图无 AI 元素（EVD-002）；非 control 截图 AI 元素照常（EVD-006）

**Evidence**：`evidence/UF-004/{sheets,slides,pdf}-control-noai.png` + `-noncontrol-ai.png`

**注意事项**：只做渲染条件，不改 AiPanel/agent 模块代码（ASM-003）；localStorage 显示逻辑保留。

### Task 21: 插件构建、类型检查与 vendor 同步

- **关联**：EVD-007 / INV-004；UF 写 NA（构建任务）
- **前置任务**：20
- **风险等级**：P1

**为什么做**：插件包独立编译；平台补丁/vendor 镜像同步纪律。

**涉及文件与定位**：

- `plugin/`：`package.json` / `scripts/sync-vendor.mjs`

**具体操作**：

1. `cd plugin && npm run build && npm run typecheck` → 全绿（修复直至通过）
2. 若涉及平台包类型更新，运行 `node scripts/sync-vendor.mjs <env-wt-artifact>` 同步 vendor 镜像
3. 重启 3099 实例（rev 缓存陷阱：改 bundle 后必须重启）验证插件加载与工具注册

**验证**：`npm run build && npm run typecheck` → 通过；3099 实例可访问且工具注册可见（DSH 会话 `/tools` 或等效入口）

**Evidence**：`evidence/phase-5/build-typecheck.log`

**注意事项**：不得为过类型检查放宽类型；构建产物变更需同步 vendor。

### Task 22: 执行 Phase 5 回归验证

- **关联**：本 Phase 全部 BR/UF/INV
- **前置任务**：20;21

**验证**：`node scripts/dev.mjs smoke` 全绿；三 app control/非 control 双态截图对比存档

**Evidence**：`evidence/phase-5/phase-5-summary.md`

### Phase 6: 端到端验收

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

1. 按 5.2 环境准备启动 relay + 3099 实例；准备 fixture（`evidence/fixtures/demo.xlsx`、`demo.pptx`、`demo.pdf`，缺失则用各 app 测试样例复制或生成）
2. 逐行执行矩阵：UF-001~004 主路径 + 各失败分支
3. 每行保存证据（截图/console/network/API 样例）到 5.2 矩阵指定路径

**验证**：执行矩阵全部行通过；`python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/genoffice-dsh-office` → 0 FAIL

**Evidence**：`evidence/UF-001/` `evidence/UF-002/` `evidence/UF-003/` `evidence/UF-004/`（按 5.2 矩阵）

**注意事项**：禁止用单测/静态 review 代替本节；失败 = 回到对应任务修复后重跑本矩阵。

### Task 24: 执行 Phase 6 回归验证

- **关联**：本 Phase 全部 BR/UF/INV（含 5.4 专项检查）
- **前置任务**：23

**验证**：`node scripts/dev.mjs smoke` 全绿 + 5.4 专项检查清单逐项核对 + 校验脚本 0 FAIL

**Evidence**：`evidence/phase-6/phase-6-summary.md`

---

## 5. 验收与 Review 协议

> **验收铁律：命令级验证（5.1）通过只是入场券，不是完成。** 用户可见的需求必须通过 5.2 真实场景全套测试才算完成——单元测试全绿但界面点不动 = 未完成。

### 5.1 命令级验证（入场券）

| 验证项 | 命令 | 期望 | Evidence |
|---|---|---|---|
| 栈契约冒烟 | `node scripts/dev.mjs smoke`（栈根） | 全部 PASS（含新增五 app 控制面断言与 xlsx/pptx/pdf 工具名集合镜像） | EVD-004 |
| 上游 web 构建 | `cd upstream && npm run web` | sheets/slides/pdf web-dist 构建成功，relay 可访问 | EVD-007 |
| 插件构建/类型检查 | `cd plugin && npm run build && npm run typecheck` | 全绿 | EVD-007 |
| relay 端点形状 | `curl`（见各 Task 验证命令） | 与 contracts/control-api.md 一致 | EVD-001 |
| 校验脚本 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/genoffice-dsh-office` | 0 FAIL | — |

### 5.2 真实场景全套测试（Real-Run，完成的唯一标准）

> 在真实运行的应用上，把第 2.3 节每条流程脚本从头到尾走一遍——用和真实用户完全相同的方式。禁止用"跑了单测"或"读了代码确认逻辑正确"代替本节。

**环境准备**：

| 项 | 值 |
|---|---|
| 启动命令 | relay：`node scripts/dev.mjs start-relay`（栈根）；DSH 实例：`DSH_HOME=~/.dsh-wt-artifact ~/workspace/dsh/plugin/dsh-artifact/env/wt-artifact/bin/dsh --profile artifact --patch ~/.dsh-wt-artifact/artifact-3099.patch.yml` |
| 访问入口 | relay `http://localhost:8787`（/sheets/ /slides/ /pdf/）；DSH GUI `http://127.0.0.1:3099`（GenOffice tab） |
| 测试账号/数据 | 无需账号；fixture：`evidence/fixtures/demo.xlsx` / `demo.pptx` / `demo.pdf`（从 upstream 测试样例复制；缺失则用各 app 保存管线生成） |
| 干净状态定义 | fixture 改动后重新复制；relay/3099 重启恢复注册表空态 |
| 可用测试工具 | chrome MCP（真实浏览器点击/截图/console/network）+ `curl`（contract 场景） |

**执行矩阵**（每条 = 2.3 节一条流程脚本的真实回放）：

| UF | 执行方式 | 操作来源 | 必须核对的点 | Evidence |
|---|---|---|---|---|
| UF-001 主路径 | browser + API | 2.3 节 UF-001 成功主路径：聊天指令 → xlsx 工具链 → iframe 变化 → 保存 | 每步「界面即时反馈」「用户看到的结果」与脚本一致；工作表块级更新可见；原文件 diff 为空（BR-008）；console 无新增 error | `evidence/UF-001/main-*.png` + `tool-calls.log` + `file-unchanged.diff` |
| UF-001 失败分支 执行器未注册 | browser + API | 不打开文档直接让 agent 编辑 xlsx | 工具卡片"请先在 GenOffice tab 打开"类错误；无文档变化 | `evidence/UF-001/fail-unregistered.png` |
| UF-001 失败分支 非法参数 | API | `POST /api/control/sheets/<docId>/tool` 传非 JSON input | `{ok:false, error:'invalid input'}`；文档不变 | `evidence/UF-001/fail-invalid.json` |
| UF-001 失败分支 超时 | API | 关闭 iframe 后调用（SSE 断线） | timeout 错误；不重放 | `evidence/UF-001/fail-timeout.json` |
| UF-001 失败分支 格式保真 | API + 桌面验证 | 保存后重打包产物 | 产物可被桌面版/Office 打开且关键单元格/格式一致 | `evidence/UF-001/format-fidelity/` |
| UF-002 主路径 | browser + API | 2.3 节 UF-002：pptx 工具链 → iframe 变化 → 保存 | 同上（幻灯片元素变化可见；磁盘=iframe） | `evidence/UF-002/main-*.png` + `after.diff` |
| UF-002 失败分支 执行器未注册 | browser + API | 未打开 pptx 直接编辑 | 明确错误；无文档变化 | `evidence/UF-002/fail-unregistered.png` |
| UF-002 失败分支 元素不存在 | API | set_element_text 传无效 sourceId | 适配器 isError"元素不存在"；文档不变 | `evidence/UF-002/fail-badelement.json` |
| UF-002 失败分支 格式保真 | API + 桌面验证 | 保存后重打包产物 | 桌面版可打开且版式不破坏 | `evidence/UF-002/format-fidelity/` |
| UF-003 主路径 | browser + API | 2.3 节 UF-003：pdf 工具链 → 标注/编辑 → 保存 | 标注/改写实时可见；磁盘产物可打开 | `evidence/UF-003/main-*.png` + `after.diff` |
| UF-003 失败分支 文本不匹配 | API | markup/edit 的 old_text 非原文 | isError"原文不存在"；文档不变 | `evidence/UF-003/fail-textmismatch.json` |
| UF-003 失败分支 导出失败 | API | 构造标注合并失败 | 保存报错不落盘 | `evidence/UF-003/fail-export.json` |
| UF-003 失败分支 格式保真 | API + 桌面验证 | 保存后产物 | 未标注页面内容不变 | `evidence/UF-003/format-fidelity/` |
| UF-004 主路径 | browser | tab 打开 xlsx/pptx/pdf | 三 app 无任何 AI 助手 UI；编辑功能完整 | `evidence/UF-004/{sheets,slides,pdf}-control-noai.png` |
| UF-004 失败分支 非 control 回归 | browser | 直接访问无 control=1 URL | AI 助手照常（INV-001）；保存=下载（INV-007） | `evidence/UF-004/noncontrol-ai.png` |
| UF-004 失败分支 旧构建兼容 | browser | （可选）旧 web-dist 打开 control=1 | 按普通模式渲染不崩溃 | `evidence/UF-004/legacy-compat.png`（无法构造时记录说明） |

**按任务类型的执行方式**：

- frontend：chrome MCP 真实浏览器点击，截图 + console + network 三件套。
- backend/API：`curl` 对真实运行 relay 发请求（正常/未注册/非法参数/非 loopback 各一发），保存 request/response + server log。
- CLI/脚本：`node scripts/dev.mjs smoke` 完整跑一遍保存输出。
- 格式保真：写回产物用桌面版（或 LibreOffice/Office 打开校验 + 解包比对关键 XML）验证。

**通过标准**：执行矩阵全部行通过且 evidence 齐全。任何一行失败 = 本需求未完成，回到对应任务修复后重跑。

### 5.3 Evidence 目录结构与命名

```text
docs/genoffice-dsh-office/evidence/
  phase-{0..6}/        # 每 Phase 的命令输出、Phase summary
  UF-001/              # xlsx 主路径 + 失败分支截图/日志/diff + format-fidelity/
  UF-002/              # pptx 主路径 + 失败分支 + format-fidelity/
  UF-003/              # pdf 主路径 + 失败分支 + format-fidelity/
  UF-004/              # control/非 control 截图（三 app）
  API-control/         # 控制面 request/response 样例（五 app）
  fixtures/            # 测试用 demo.xlsx / demo.pptx / demo.pdf
```

- EVD ID 必须能在第 2.5 节找到。
- 截图命名：`UF-001-main.png`；API 样例命名：`API-xxx-{scenario}.json`。

### 5.4 Review 专项检查清单

> 实现完成后的专项检查。通用 L1-L4 流程见 skill 的 review mode，此处只列本需求特有项。

- [ ] 5.2 执行矩阵全部通过，evidence 齐全且与第 2.5 节 EVD 清单一致
- [ ] 2.3 节每条流程的「入口接线清单」已实现——从真实入口可达（聊天工具 / tab 打开 / 保存按钮），不是只有孤立模块
- [ ] 界面交互与 2.3 节脚本逐步一致（保存按钮 loading/禁用/成功/冲突/错误态齐全）
- [ ] INV-001 非控制模式零回归（截图对比基线；三 app 与桌面版行为一致）
- [ ] INV-004 契约镜像：contracts/control-api.md ↔ server.mjs ↔ 三 app 适配器 ↔ 插件工具 ↔ smoke 断言，逐处核对
- [ ] INV-005 无绕过编辑器的直接文件改写路径（代码 review）
- [ ] INV-006 sandbox 未放松
- [ ] BR-009 格式保真：xlsx/pptx/pdf 写回产物均通过桌面版打开校验
- [ ] `待勘察` 定位（3.3 清单 3 处）已补全为事实，或被 P0 校准任务覆盖
- [ ] 所有 BR/UF/INV 状态可对照第 2 章逐条核销
