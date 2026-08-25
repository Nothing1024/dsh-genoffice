# 三 app Web 化策略决议（Task 2 产物）

> 基于 Task 1 勘察（evidence/phase-0/commands.log、slidesapi-inventory.md、sheets-pdf-survey.md）。
> 每条路线注明「谁做、怎么做、验证命令」。

## 1. sheets：xlsx 读写后端 → 浏览器内 JSZip 管线（gateway 复用 + node shim）

**路线**：不在 relay 代理 Rust sidecar，也不引 wasm——复用 `apps/sheets/src/gateway/xlsx-gateway.ts`
的**纯 JSZip 内存管线**（`readBasicWorkbook` / `planCellEditsToXlsx` / `assembleWithJsZip`），
通过 vite.web.config.ts 的 `resolve.alias` 把 `node:crypto` / `node:fs/promises` / `node:path` / `node:buffer`
映射到浏览器 shim（自写最小 Buffer shim，~60 行），在 sheets 的 web bundle 内直接运行。

**理由**：
- gateway 顶层仅 4 处 node 导入，均为文件落盘/哈希函数使用，浏览器路径不调用；核心解析/补丁全为
  JSZip + 字符串 XML 操作（事实：xlsx-gateway.ts L346/L368/L415/L453/L564）。
- 保存只改 touched entries（`MutationPlan`），原包其他条目字节不动 → BR-009 格式保真最稳。
- 不新增 npm 依赖（JSZip 已是 sheets 依赖）、不新增环境变量、不动 relay（零依赖约束保持）。

**怎么做**：
1. `apps/sheets/src/renderer/web-buffer.ts`（新）：Buffer 子集 shim（from/alloc/concat/isBuffer/toString/subarray/byteLength）。
2. `apps/sheets/vite.web.config.ts`（新）：参照 docs 版 + alias 映射 node: 导入 → shim/空实现。
3. `apps/sheets/src/renderer/web-bridge.ts`（新）：实现 `window.desktopApi` 子集——
   `?open=path:` → relay `/api/file` 拉字节 → `readBasicWorkbook`(+styles/列宽扩展解析) →
   构造 `WorkbookFile`（worksheetMetadataSchema 最小字段集）→ `loadWorkbookSkeleton`；
   `readWorkbookRange/readWorkbookFormulas` 从内存模型按范围返回；`saveWorkbookEdits` →
   编辑日志 → gateway 计划 → 新字节（control 模式供 export 事件回传，非 control 下载）。
4. `apps/sheets/src/renderer/control.ts`（新）：沿用 M0 适配器结构，exportBytes = 当前字节。

**验证命令**：`npm run web:build -w @genoffice/sheets`；浏览器 `/sheets/?control=1&open=path:<tmp.xlsx>`；
注入 executeTool 后触发导出 → 字节与编辑器状态一致（BR-008 半程）。

**风险**：gateway 类型引用 `Buffer`（TS 类型，shim 需匹配）；styles.xml 解析为新增代码（numFmt 子集）；
公式 `t="array"`/共享公式等高级结构只读保真（不重写）。

## 2. slides：slidesApi 浏览器实现面 → in-browser pptx-engine 会话模型

**路线**：新建 `apps/slides/src/renderer/web-bridge.ts` 实现 `window.slidesApi` 的浏览器替代面，
基于 monorepo 内**纯 TS 的 `@genoffice/pptx-engine`**（解析/补丁/重打包）与 `@genoffice/pptx-render`（渲染树）。
主进程 245 处依赖中的**核心编辑子集**由浏览器实现面承接，其余标记显式不可用。

**理由**：
- pptx-engine 仅 3 处 node 内建引用（`node:crypto` createHash/randomUUID、`node:zlib` deflateSync），
  全部可浏览器 shim（crypto.subtle / crypto.randomUUID / JSZip 自身压缩）；解析→渲染树、
  `savePptx` 重打包均为现成纯 JS（事实：packages/pptx-engine/src/zip.ts L10、media-insert.ts L14、
  sections.ts L22；slides-main.ts L1381 `savePptx`）。
- 渲染器本来就是无文件状态（RenderSlide[] 全量在浏览器），session 模型可整体搬到浏览器。

**覆盖范围（核心编辑子集）**：open（`?open=path:` → 字节 → parse → 渲染树）、save（`savePptx` → 字节）、
editText / editTransform / batchEditTransform / editFill / editStroke / editBackground / addElement /
deleteElement / addSlide / deleteSlide / beginHistoryBatch / endHistoryBatch / undo / redo /
setNotes / getNotes / isDirty / setAutoSavePref / getRenderSlides / getLanguage / getTheme / onOpened /
consumePendingOpen / newBlank(最小)。

**不覆盖（显式不可用：console.warn + 默认值，防呆）**：presenter*/audience*、exportPdf/exportImages/
printSlides、master*、cloudGen*/aiStream 系、saveStyleTemplate 系、clipboard 系、findReplace、
getAnimations/setAnimations/getTransition/setTransition、comments 系、sections 系、headerFooter 系。

**降级条件**：若 pptx-engine 浏览器化遇到不可逾越障碍（如 Buffer/流式 API 依赖超出 shim 能力），
降级为「控制面打通 + 只读上下文 + 最小编辑子集」；**但 open/save 必须可用**（BR-008 写回前提）。

**验证命令**：`npm run web:build -w @genoffice/slides`；`/slides/?open=path:<tmp.pptx>` console 无 error
（未覆盖方法仅 warn）。

## 3. pdf：pdf.js 渲染（已在渲染器内）+ 浏览器内 pdf-lib 合并保存

**路线**：渲染面零改造（pdfjs-dist 已在渲染器内，事实：App.tsx L11）；`window.pdfApi` 浏览器实现面：
`readFile` → relay `/api/file`；`consumePending` → `?open=path:` 解析；**save = 浏览器内 pdf-lib 合并**
（从 `apps/pdf/src/main/save-pdf.ts` 移植为浏览器模块，去掉 node:fs 顶层导入，改传字节）；
`text-edit` 子集经 vite `?url` 加载 `harfbuzzjs/hb-subset.wasm` + `@embedpdf/pdfium/pdfium.wasm`。

**导出形态定稿（ASM-004）**：**标注合并后的 PDF**（非侧车文件）——未标注页面内容字节不变（BR-009）；
写回统一 POST /api/file（tmp+rename）。

**理由**：save-pdf.ts 主体为纯 pdf-lib 操作（标注 appearance stream、表单、页操作），仅顶层 node:fs
导入可剥离（事实：save-pdf.ts L1）；wasm 资产在 npm 包内可 `?url` 引入。

**风险与降级**：text-edit 的 PDFium Emscripten 面较大；若 wasm 移植超预算 →
`pdf_edit_text` 返回 isError「网页版暂不支持文本改写」，标注/表单/页面操作保存不受影响（UF-003 主路径其余部分完整）。

**验证命令**：`npm run web:build -w @genoffice/pdf`；`/pdf/?open=path:<tmp.pdf>` 渲染 + 标注可操作。

## 4. 公共决策

- **打开形态**：三 app 统一 `?open=path:<绝对路径>`（沿用 M0 docs/markdown），`control=1` 时才进控制模式（BR-001）。
- **写回形态**：三 app 复用 M0 `POST /api/file` tmp+rename；适配器 export 事件回传 `{base64, name, path, mtimeMs}`。
- **AI 助手**：control=1 条件渲染隐藏（ASM-003 沿用 M0），非 control 保留桌面语义（INV-001）。
- **执行器**：三 app 各建 `control.ts`，执行器复用各 skill（executeWorkbookTool / slides-skill / executePdfTool），
  全部编辑走编辑器实例（INV-005）。

## 5. 决议结论表

| app | 路线 | 覆盖 | 降级条件 | 验证 |
|---|---|---|---|---|
| sheets | 浏览器 JSZip gateway 复用 | 打开/懒加载读/编辑/保存重打包 | —（gateway 已纯 JS） | web:build + 浏览器走查 + 导出字节比对 |
| slides | in-browser pptx-engine session | 打开/保存/核心编辑子集 | open/save 必须可用 | web:build + 浏览器走查 |
| pdf | 渲染器 pdf.js + 浏览器 pdf-lib 合并 | 打开/标注/表单/页操作/文本编辑(wasm) | text-edit 可降级 isError | web:build + 浏览器走查 |
