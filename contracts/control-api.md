# 控制契约（genoffice-dsh-office）

> 本文件是 DSH 控制 GenOffice 文档编辑的**单一事实源**（INV-004）。版本：0.3.0 | 2026-08-25（控制 UX 过程文档已归档到 [project-dev-library `genoffice-control-ux-prd`](https://github.com/Nothing1024/project-dev-library/blob/project/dsh-genoffice/dsh-genoffice/genoffice-control-ux-prd.md)）。
>
> 四处镜像点（各侧独立声明，改动后必须同步本文件并跑 `node scripts/dev.mjs smoke` 验证）：
> 1. app 控制适配器：`upstream/apps/{docs,markdown,sheets,slides,pdf}/src/renderer/control.ts`
> 2. relay 控制面：`upstream/web/server.mjs`
> 3. 插件 host 工具：`plugin/packages/tab-genoffice/src/host/*`
> 4. smoke 断言：`scripts/dev.mjs`

## 1. 拓扑与传输（ASM-008）

- 下行 relay → iframe：`GET /api/control/stream?docId=<id>`（SSE，EventSource，零依赖，Node ≥ 22）。
- 上行 iframe → relay：`POST /api/control/notify`（JSON）。
- **禁止**引入 WebSocket/其他依赖替代 SSE+POST 双向通道；改动传输需显式更新 ASM-008 并获需求方同意。
- 工具调用超时由 host 侧 deadline 兜底（BR-010）；适配器在 `visibilitychange`/`online` 时重连 EventSource。

## 2. 端点契约

### 2.1 GET /api/control/stream?docId=<id> — SSE 下行通道

- `docId`：`sha256(绝对路径)` 十六进制串，**长度必须为 64**，非法格式 → `400 {ok:false, error:'invalid docId'}`。
- 连接建立：立即写 SSE 头（`Content-Type: text/event-stream`，不压缩不缓冲），发送：

```
event: hello
data: {"docId":"<64hex>"}
```

- 注册表登记 `docId → {res, lastSeen}`；连接关闭/错误 → 注销（BR-003）。
- 保活：每 25s 发送 `event: ping` / `data: {"t":<epoch ms>}`；连接关闭时清理定时器。
- 连接数上限 32，超限 → `503 {ok:false, error:'too many streams'}`。
- 下行事件（data 均为单行 JSON）：

| event | data | 方向语义 |
|---|---|---|
| `hello` | `{"docId": string}` | 注册确认 |
| `ping` | `{"t": number}` | 保活 |
| `tool` | `{"requestId": string, "call": {"id": string, "name": string, "input": object}}` | 工具调用（BR-002 形状） |
| `context` | `{"requestId": string}` | 请求文档上下文 |
| `export` | `{"requestId": string}` | 请求导出当前文档字节 |
| `error` | `{"message": string}` | 服务端错误通知 |
| `saved` | `{"mtimeMs": number}` | 写回成功通知（新冲突基线） |

### 2.2 POST /api/control/notify — 上行通知

入参：`{docId, kind: 'tool-result' | 'export' | 'context', requestId?, payload}`

- `docId` 未注册 → `200 {ok:false, error:'executor not registered'}`。
- `kind='tool-result'`：`payload` = ToolExecution 形状（见 2.4），按 `requestId` 放入 pending 表（TTL 60s）供挂起请求消费；成功 → `200 {ok:true}`。
- `kind='context'`：`payload = {context: string}`，按 `requestId` 消费（TTL 30s）。
- `kind='export'`：`payload = {base64, name, path, mtimeMs?}`（base64 字节 + 文件名 + **原绝对路径** + 打开时 mtime），转交写回流程（§2.6/§2.5）。
- 请求体上限 50MB；上行数据不得被 relay 修改形状（镜像断言用）。

### 2.3 POST /api/control/<app>/<docId>/context — 文档上下文

- `app ∈ {docs, markdown, sheets, slides, pdf}`，否则 `404`。
- 转发下行 `event: context`（带 relay 侧 UUID requestId），等待 notify `kind='context'` 回传（TTL 30s）。
- 成功：`200 {ok:true, context: string}`（与 skill `buildContext` 等价：块列表 index\|type\|preview + 选区）。
- 执行器未注册：`200 {ok:false, error:'executor not registered'}`（BR-003）。
- 超时：`200 {ok:false, error:'timeout'}`（BR-010）。
- 挂起请求与 SSE 连接生命周期绑定：断线即失败（timeout）。

### 2.4 POST /api/control/<app>/<docId>/tool — 工具调用

入参：`{call: {id, name, input}}`

- 校验：`call.id`/`call.name` 为非空字符串；`call.input` 必须为 JSON 对象——否则 `200 {ok:false, error:'invalid input'}`，**不转发不执行**（BR-002）。
- 执行器未注册：`200 {ok:false, error:'executor not registered'}`（BR-003）。
- 转发下行 `event: tool`（`{requestId, call}`），等待 `tool-result`（TTL 60s）。
- 成功：`200 {ok:true, execution: {output, isError?, mutated?, summary, display?}}`（ToolExecution 形状，见 `upstream/packages/agent-core/src/types.ts`）。
- 超时/断线：`200 {ok:false, error:'timeout'}`；**不重放调用**（避免重复编辑）。
- notify 到达但已超时 → 丢弃并记录（不响应）。

### 2.6 POST /api/control/<app>/<docId>/export — 导出并写回（UF-002 保存链路）

入参：`{path: string(绝对路径), expectedMtimeMs?: number, saveAs?: string(绝对路径)}`

- 写回目标（`saveAs` ?? 入参 `path`）在等待 iframe 导出之前预检父目录可写性：不可写 → `{ok:false, error:'EACCES'|'EPERM'|'EROFS'}`；`saveAs` 且目标已存在 → `{ok:false, error:'exists'}`。预检失败不转发 export、不推 `saved`。
- 执行器未注册：`200 {ok:false, error:'executor not registered'}`。
- 转发下行 `event: export`（带 requestId），等待 notify `kind='export'`（TTL 60s）。
- 收到 `payload = {base64, name, path, mtimeMs?}` 后：校验 `payload.path` 与入参 `path` 一致（不一致 → `{ok:false, error:'path mismatch'}`）→ 转 `POST /api/file` 同一写回逻辑（§2.5，tmp+rename 原子写）。
- 成功：`200 {ok:true, path, mtimeMs}`（`mtimeMs` = 写后 `stat`）；冲突：`200 {ok:false, error:'conflict'}`；其他失败：`{ok:false, error}`（原文件不变，INV-003）。
- 适配器回传的 `mtimeMs` 为空时以入参 `expectedMtimeMs` 为准；两者皆空则跳过 mtime 校验。
- `saveAs` 已设：跳过 mtime 校验，对目标 `wx` 独占创建；已存在 → `{ok:false, error:'exists'}`（原文件与目标均不变）；相对路径 → `{ok:false, error:'invalid saveAs'}`；成功 `{ok:true, path, name, mtimeMs}`（`mtimeMs` = 写后 `stat`）。`saveAs` 成功**不**推送 `saved`。

### 2.7 POST /api/control/open — docId 计算辅助（BR-009）

入参：`{path: string(绝对路径)}` → `200 {ok:true, docId, path, registered}`。`registered` 为该 docId 是否已有控制执行器（iframe 已挂上 `/api/control/stream`）。路径非绝对 → `400 {ok:false, error:'invalid path'}`。

### 2.8 iframe→host postMessage — dirty 上报（UI-only，INV-005）

形状：`{type:'genoffice:dirty', docId: string(64hex), dirty: boolean}`。

- 发送时机：dirty 状态翻转时各发一次（clean→dirty / dirty→clean）。
- 接收方校验：`event.origin` 必须等于 relay origin（插件侧 `RELAY_BASE`），且 `docId` 与当前打开文档一致；否则丢弃。
- 仅布尔状态，不含任何编辑数据（INV-005）。

### 2.5 POST /api/file — 写回（BR-004/BR-005，INV-002/INV-003）

入参：`{path: string(绝对路径), base64: string, expectedMtimeMs?: number}`

- 安全边界：仅 loopback 来源（沿用 `ALLOW_ABS_PATHS` 语义：HOST 为 loopback 或显式 `GENOFFICE_WEB_OPEN_PATHS=1`）；否则 `403 {ok:false, error:'loopback only'}`（BR-005）。
- 字节上限 50MB（`{ok:false, error:'file too large'}`）。
- 目标必须为绝对路径（`path.isAbsolute` 等价检查）且父目录存在；`..` 解析越界由 loopback 边界兜底。
- 原子写：写 `tmp`（**与目标同目录**，禁止跨设备 rename）+ `rename` 原子替换；任何失败不改变原文件字节（BR-004）。
- `expectedMtimeMs` 可选：与当前 mtime 不匹配 → `200 {ok:false, error:'conflict'}`，原文件不变（UF-002 外部修改分支）。
- 成功：`200 {ok:true, path, mtimeMs}`（`mtimeMs` = 写后 `stat`）。本端点**不**推送 `saved`。

## 3. docId 规则（BR-009）

- `docId = SHA-256(绝对路径)` 的十六进制串（64 字符）；与打开时间无关（纯路径哈希），同路径重复打开复用同一 docId。
- 计算实现：`createHash('sha256').update(absPath).digest('hex')`。
- 辅助端点：`POST /api/control/open` 入参 `{path}` → `{ok:true, docId}`（§2.7）。
- M0 单文档单会话（ASM-007）：一个 iframe 同时只绑定一个 docId。

## 4. 工具名集合（BR-007，INV-004）

DSH 工具名 = `<app前缀>_<skill工具名>`；`docx` ↔ app `docs`，`markdown` ↔ app `markdown`。定义由对应 skill 的 `AGENT_TOOLS` 生成（Task 18 生成器输入 = 本表）。

> **命名分隔符说明（ASM-006 修订）**：平台 LLM 供应商要求工具名匹配 `^[a-zA-Z0-9_-]+$`（实测 DeepSeek API 拒绝含 `:` 的工具名，报 `INVALID_REQUEST`）。故前缀与 skill 名之间用 `_` 而非 `:`；前缀语义（app 维度）与 skill 名一一映射不变。

| DSH 工具名 | skill 工具名 | app | 备注 |
|---|---|---|---|
| `docx_get_document_context` | get_document_context | docs | 上下文（块索引/序号/选区） |
| `docx_read_blocks` | read_blocks | docs | 读块范围（受限 HTML，分页） |
| `docx_insert_content` | insert_content | docs | 插入新内容 |
| `docx_replace_blocks` | replace_blocks | docs | 替换块范围 |
| `docx_apply_commands` | apply_commands | docs | 格式化/结构/批量命令 |
| `docx_web_search` | web_search | docs | 网页搜索 |
| `docx_image_search` | image_search | docs | 图片搜索 |
| `docx_insert_image` | insert_image | docs | 插入图片 |
| `docx_insert_chart` | insert_chart | docs | 插入图表 |
| `docx_edit_chart` | edit_chart | docs | 编辑图表 |
| `docx_save` | （写回工具，非 skill 工具） | docs | 显式写回触发（BR-008） |
| `markdown_get_document_context` | get_document_context | markdown | 上下文 |
| `markdown_read_blocks` | read_blocks | markdown | 读块范围（GFM） |
| `markdown_insert_content` | insert_content | markdown | 插入新内容 |
| `markdown_replace_blocks` | replace_blocks | markdown | 替换块范围 |
| `markdown_save` | （写回工具，非 skill 工具） | markdown | 显式写回触发（BR-008） |
| `xlsx_get_workbook_context` | get_workbook_context | sheets | 工作簿上下文 |
| `xlsx_read_range` | read_range | sheets | 读区域值/公式 |
| `xlsx_load_guide` | load_guide | sheets | 加载操作指南 |
| `xlsx_read_formats` | read_formats | sheets | 读区域格式 |
| `xlsx_read_sheet_features` | read_sheet_features | sheets | 读工作表特性 |
| `xlsx_read_cells` | read_cells | sheets | 读单元格明细 |
| `xlsx_aggregate_range` | aggregate_range | sheets | 区域统计（去重/求和，不逐格读） |
| `xlsx_find_cells` | find_cells | sheets | 全文/公式/错误单元格搜索 |
| `xlsx_select_range` | select_range | sheets | 选中并滚到区域（纯视图） |
| `xlsx_trace_precedents` | trace_precedents | sheets | 追溯公式引用 |
| `xlsx_trace_dependents` | trace_dependents | sheets | 追溯公式被引用 |
| `xlsx_propose_operations` | propose_operations | sheets | 提议操作计划 |
| `xlsx_save` | （写回工具，非 skill 工具） | sheets | 显式写回触发（BR-008） |
| `pptx_get_deck_context` | get_deck_context | slides | 演示文稿上下文 |
| `pptx_read_slide` | read_slide | slides | 读单页元素树 |
| `pptx_set_element_text` | set_element_text | slides | 改元素文本 |
| `pptx_set_element_style` | set_element_style | slides | 改元素样式 |
| `pptx_set_element_transform` | set_element_transform | slides | 改元素变换 |
| `pptx_execute_slide_script` | execute_slide_script | slides | 执行幻灯片脚本 |
| `pptx_set_element_fill` | set_element_fill | slides | 改填充 |
| `pptx_set_element_stroke` | set_element_stroke | slides | 改描边 |
| `pptx_web_search` | web_search | slides | 网页搜索 |
| `pptx_image_search` | image_search | slides | 图片搜索 |
| `pptx_generate_image` | generate_image | slides | 生成图片 |
| `pptx_analyze_media` | analyze_media | slides | 媒体分析 |
| `pptx_insert_web_image` | insert_web_image | slides | 插入网络图片 |
| `pptx_crop_image` | crop_image | slides | 裁剪图片 |
| `pptx_set_picture_opacity` | set_picture_opacity | slides | 图片透明度 |
| `pptx_replace_image` | replace_image | slides | 替换图片 |
| `pptx_ask_clarification` | ask_clarification | slides | 需求澄清 |
| `pptx_plan_deck` | plan_deck | slides | 演示大纲规划 |
| `pptx_regenerate_slide` | regenerate_slide | slides | 按 brief 重做一页（本地 spec→pptx，不走云）；控制模式需 page_spec 或改用 land_pages |
| `pptx_delete_slide` | delete_slide | slides | 删除页 |
| `pptx_generate_deck` | generate_deck | slides | 本地生成整套演示（非控制模式 LLM 规划；控制模式需 pages_spec 或改用 land_pages，iframe 不 BYOK） |
| `pptx_land_pages` | land_pages | slides | 宿主提交 PageSpec[] 落地（parsePageSpec → localGeneratePage → htmlToPptx，无 iframe LLM） |
| `pptx_save_style_template` | save_style_template | slides | 保存样式模板 |
| `pptx_list_style_templates` | list_style_templates | slides | 列出样式模板 |
| `pptx_add_slide` | add_slide | slides | 添加页 |
| `pptx_add_text_box` | add_text_box | slides | 添加文本框 |
| `pptx_add_shape` | add_shape | slides | 添加形状 |
| `pptx_add_chart` | add_chart | slides | 添加图表 |
| `pptx_add_smartart` | add_smartart | slides | 添加 SmartArt |
| `pptx_add_table` | add_table | slides | 添加表格 |
| `pptx_edit_table_cell` | edit_table_cell | slides | 编辑表格单元格 |
| `pptx_edit_table_structure` | edit_table_structure | slides | 编辑表格结构 |
| `pptx_edit_table_style` | edit_table_style | slides | 编辑表格样式 |
| `pptx_edit_chart` | edit_chart | slides | 编辑图表 |
| `pptx_set_slide_background` | set_slide_background | slides | 设置页背景 |
| `pptx_delete_element` | delete_element | slides | 删除元素 |
| `pptx_ungroup_element` | ungroup_element | slides | 取消组合 |
| `pptx_apply_ops` | apply_ops | slides | 原子批量编辑 op |
| `pptx_save` | （写回工具，非 skill 工具） | slides | 显式写回触发（BR-008） |
| `pdf_read_pages` | read_pages | pdf | 读页文本 |
| `pdf_search_text` | search_text | pdf | 全文搜索 |
| `pdf_goto_page` | goto_page | pdf | 跳转页 |
| `pdf_markup_text` | markup_text | pdf | 文本标注（高亮/下划线/删除线） |
| `pdf_edit_text` | edit_text | pdf | 文本改写 |
| `pdf_edit_block` | edit_block | pdf | 文本块编辑 |
| `pdf_insert_text` | insert_text | pdf | 新增文本块 |
| `pdf_image_search` | image_search | pdf | 图片搜索 |
| `pdf_generate_image` | generate_image | pdf | 生成图片 |
| `pdf_list_page_images` | list_page_images | pdf | 列出页内图片 |
| `pdf_insert_image` | insert_image | pdf | 插入图片 |
| `pdf_transform_image` | transform_image | pdf | 变换图片 |
| `pdf_rotate_image` | rotate_image | pdf | 旋转图片 |
| `pdf_replace_image` | replace_image | pdf | 替换图片 |
| `pdf_delete_image` | delete_image | pdf | 删除图片 |
| `pdf_list_form_fields` | list_form_fields | pdf | 列出表单字段 |
| `pdf_fill_form_field` | fill_form_field | pdf | 填表单字段 |
| `pdf_rotate_page` | rotate_page | pdf | 旋转页 |
| `pdf_delete_page` | delete_page | pdf | 删除页 |
| `pdf_get_outline` | get_outline | pdf | 读大纲 |
| `pdf_save` | （写回工具，非 skill 工具） | pdf | 显式写回触发（BR-008） |

- 写回触发（BR-008）：编辑工具只改 iframe 内文档状态；写回仅由显式动作触发——tab「写入磁盘」按钮或 `docx_save`/`markdown_save`/`xlsx_save`/`pptx_save`/`pdf_save` 工具，经 relay `POST /api/file` 原子写回原路径。
- 保存工具入参：`{path: string, save_as?: string}`（均为绝对路径；`save_as` 走 export `saveAs` 分支）→ 返回写回结果；conflict → isError 提示"文件已被外部修改"；exists → 另存目标已存在。
- 扩展名 → app 映射：`xlsx→sheets`、`pptx→slides`、`pdf→pdf`（插件 tab `PREVIEWABLE` 与 host app 选择用）。
- 工具名集合完整性：本表为控制面**全部工具**（skill + 各族 `*_save`）镜像，与 smoke 锁步：docx 11 + markdown 5 + xlsx 13 + pptx 39 + pdf 21（skill 分别为 10 / 4 / 12 / 38 / 20，含官方 merge 新增 `aggregate_range`/`find_cells`/`select_range`/`trace_precedents`/`trace_dependents`/`apply_ops`/`insert_text` / `land_pages`）。插件 `CONTROL_TOOL_TABLE` 与 `CAPABILITY` 必须逐名覆盖——缺 capability 的表项默认不注册。smoke 按本表逐名核对 skill / host / capability，漂移即 FAIL（BR-007 / INV-004）。不删官方工具。`pptx_land_pages` 是控制模式出片原语（宿主提交 PageSpec[]，iframe 只落地）。`pptx_generate_deck` / `pptx_regenerate_slide` 在非控制模式仍走网页本地 spec→pptx（`cloudGenStatus.enabled` 仍为 false）；控制模式 topic-only 必须 isError `control mode requires pages_spec; use land_pages`，不得进 iframe BYOK。空白稿落地后 `htmlGenerated` 解锁 `add_text_box` / `add_shape`。

## 5. 错误语义汇总（UF-001 失败分支）

| 场景 | 返回 |
|---|---|
| 执行器未注册（docId 无 SSE 连接） | `{ok:false, error:'executor not registered'}` |
| 编辑器未就绪（iframe 内 editor 为空） | 适配器回传 isError：`{output:'editor not ready', isError:true}` |
| 非法输入（input 非 JSON 对象 / 缺字段） | `{ok:false, error:'invalid input'}`（relay 不转发） |
| 控制通道超时 / SSE 断线 | `{ok:false, error:'timeout'}`；不重放 |
| 写回目标不可写 | `{ok:false, error:<原因>}`；原文件不变 |
| 写回外部修改冲突 | `{ok:false, error:'conflict'}`；原文件不变 |
| 另存目标已存在 | `{ok:false, error:'exists'}`；原文件与目标均不变 |
| 没有 DSH 页面在监听 /api/open/stream（`*_open` 且 `subscribers=0`） | `{ok:false, error:'no-gui-listening'}`；宿主也可直接失败「没有 DSH 页面在监听」 |
| 非 loopback 写回 | `403 {ok:false, error:'loopback only'}` |
| 控制模式 topic-only generate_deck / regenerate_slide / plan_deck | 适配器回传 isError，output 精确为 `control mode requires pages_spec; use land_pages` |
| land_pages 空 pages | 适配器回传 isError，output 含 `land_pages requires a non-empty pages array` |

## 6. 安全边界（INV-002）

- 控制面（stream/notify/context/tool）与写回端点默认仅 loopback；`HOST=0.0.0.0` 且未设 `GENOFFICE_WEB_OPEN_PATHS=1` 时控制面调用与写回默认拒绝（沿用 `ALLOW_ABS_PATHS` 语义，不新增环境变量）。
- 编辑工具只改 iframe 内文档状态，禁止绕过编辑器直接改文件字节/IndexedDB 快照（INV-005）。
- iframe sandbox 保持 `allow-scripts allow-same-origin allow-downloads` 不放松（INV-006）；控制通道只经 HTTP（SSE+POST）到达。

## 7. 兼容降级（UF-003 失败分支）

- relay 托管旧 web-dist（无适配器代码）时 `control=1` 参数被忽略，按普通模式渲染（AI dock 出现），不崩溃。
- 无 `control=1` 参数时行为与现状完全一致（INV-001）：AI dock 可用、保存=下载副本。
