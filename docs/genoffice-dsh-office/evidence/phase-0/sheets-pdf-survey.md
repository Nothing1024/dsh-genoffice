# sheets / pdf Web 化勘察（Task 1 产物）

> 勘察日期 2026-08-12，upstream 仓库。事实均来自实际 grep/read 输出。

## 1. sheets：Univer 引擎与 xlsx 读写依赖

### 1.1 现状

- 渲染器基于 Univer（`create-univer.ts` L9 `import { Univer } from '@univerjs/core'`），
  `main.tsx` 经 `window.desktopApi.getLanguage()/getTheme()` 引导（失败静默降级，桌面桥缺失不崩溃）。
- `window.desktopApi` 使用面（26 个方法，13 文件）：`readWorkbookRange`(5) / `saveWorkbookEdits`(2) /
  `readWorkbookFormulas`(2) / `getPathForFile` / `closeWorkbook` / `selectWorkbook` /
  `writeWorkbookRecovery` / `notifyPendingEdits`(App.tsx 内) 等；AI 面（aiStream/webSearch/imageSearch…）。
- **打开路径**：`App.tsx handleInspectWorkbook` → `window.desktopApi.selectWorkbook()` →
  `openLazyWorkbook(WorkbookFile)`（App.tsx L2714）→ `loadWorkbookSkeleton`（univer-sync.ts L282）
  建 Univer 骨架，单元格按需经 `readWorkbookRange` 懒加载（LazyWorkbookState，univer-state.ts L19）。
- **保存路径**：`save-actions.ts handleSave` → 编辑日志（edit-journal）+ Univer 状态序列化 →
  `window.desktopApi.saveWorkbookEdits({edits, …})` → 主进程对磁盘原文件应用（gateway）。
- 主进程 xlsx 读写：`apps/sheets/src/main/sheets-main.ts` + `gateway/xlsx-gateway.ts`（纯 JSZip）+
  Rust sidecar（`native/xlsx-engine`，`xlsx-sidecar-client.ts`）。sidecar 用于大文件流式与打开快照。

### 1.2 关键发现：gateway 存在纯 JSZip 内存管线（浏览器可复用）

`apps/sheets/src/gateway/xlsx-gateway.ts`（纯 JS，仅顶层 node 导入可 shim）：

- `readBasicWorkbook(buffer): Promise<ImportedXlsx>`（L368）——JSZip 解包 → `xl/workbook.xml` +
  sharedStrings + 各 worksheet → `{snapshot: {sheets: [{id, name, cells}]}, sheetNamesById}`。
- `assembleWithJsZip(source, plan): Promise<XlsxMutation>`（L346）——plan（replaced/added/removed）
  → 重新打包 → 新 xlsx 字节（`type: 'nodebuffer'`，可换 'uint8array'）。
- `planCellEditsToXlsx`（L564）/ `applyCellEditsToXlsx`（L453）/ `applyPlanToXlsx`（L415）——
  单元格编辑计划（值/公式/样式补丁）应用到原包，**只改 touched entries**（格式保真，BR-009 关键）。
- node 导入仅：`node:crypto`(createHash)、`node:fs/promises`、`node:path`（文件落盘函数专用，
  浏览器路径不调用）；`Buffer` 类型需浏览器 shim（vite alias 到自写最小 Buffer 或 buffer 包）。

> **策略含义**：sheets Web 化不需要 wasm 也不需要 relay 代理 sidecar——
> gateway 的 JSZip 内存管线可直接在浏览器 bundle 内运行（vite alias shim node: 导入），
> 打开 = `/api/file` 字节 → 解析 → Univer；保存 = 编辑日志 → planCellEditsToXlsx → 字节 → 写回。

### 1.3 浏览器桥需实现的 desktopApi 子集（control 必需）

`getLanguage/getTheme/onThemeChanged/onLanguageChanged`（localStorage）；
`selectWorkbook`（control 模式改为 `?open=path:` 直开：relay `/api/file` 拉字节 → readBasicWorkbook →
构造 WorkbookFile）；`readWorkbookRange`（从内存解析结果按范围返回）；`readWorkbookFormulas`；
`saveWorkbookEdits`（编辑日志 → gateway 应用 → 字节返回，control 模式走 notify export 写回，
非 control 下载）；`notifyPendingEdits`/`closeWorkbook`/`getPathForFile`/`autoRenameWorkbook`（no-op 或本地）；
AI 面（aiStream 等）按 docs 桥模式浏览器直连（非 control 保留，control 隐藏）。

## 2. pdf：打开 / 保存 / 渲染管线

### 2.1 现状

- 渲染器窗口依赖基本为浏览器原生（`window.getSelection` / `innerWidth` / `devicePixelRatio`）——
  **pdf.js 直接在渲染器内运行**（App.tsx L11 `pdfjs-dist/legacy/build/pdf.mjs`，worker 用 `?url` 导入）。
- `window.pdfApi` 使用面（26 方法）：`readFile`(2) / `save`(2) / `consumePending` / `setDirty` /
  `validateTextEdits` / `sendSaveAsResult` / `sendCloseSaveResult` / `listPageImages` /
  `onThemeChanged/onLanguageChanged/onSaveAsRequest/onSaveAsFlow/onCloseSaveRequest/onAiStream` /
  `getLanguage/getTheme/getAiSettings` / `insertPdf` / `extractPages` / `fetchImage` /
  `imageSearch/generateImage/aiStream/aiStreamCancel` / `exportImages`。
- **打开**：`consumePending()` → 路径 → `readFile(path)` → pdf.js `getDocument`（App.tsx L1216 openPath）。
- **保存**：渲染器持有全部标注/编辑状态（markups/drawings/textEdits/imageEdits/stampCfg/formEdits/
  rotations/deleted/order/metadata，EditSnapshot），`window.pdfApi.save({path, targetPath, …edits})` →
  主进程 `save-pdf.ts`（**pdf-lib**，517 行）合并标注 + `text-edit.ts`（1393 行，**PDFium wasm** +
  harfbuzz **hb-subset.wasm** 子集化）改文本。

### 2.2 关键发现：保存管线主体为 pdf-lib，浏览器可直跑

- `save-pdf.ts` 仅顶层 `node:fs/promises` 导入（读原文件/落盘），核心为纯 pdf-lib 操作
  （markup appearance stream、表单值、旋转/删除/重排页、元数据、extractPages/insertPdf）。
- wasm 资产在 npm 包内：`apps/pdf/node_modules/harfbuzzjs/hb-subset.wasm`、`@embedpdf/pdfium`（package.json 已声明）
  ——vite `?url` 导入即可进 web-dist。
- 浏览器桥方案：`readFile` → relay `/api/file`；`save` → 浏览器内 pdf-lib 合并 + text-edit 子集
  （wasm 可加载时全量，否则 isError 显式不可用）；`consumePending` → `?open=path:` 解析。

### 2.3 风险

- text-edit 的 PDFium wasm 面较大（Emscripten 堆指针 API），浏览器移植需验证 wasm 加载与
  字体定位（font-locate 读系统字体 → 浏览器需换 fetch 网络字体或内置字体）。
- 若 text-edit 浏览器化超预算：降级为「标注 + 表单 + 页面操作」（pdf-lib 面）可保存，
  `pdf_edit_text` 工具 isError 显式不可用，不影响 UF-003 主路径其余部分（决议见 Task 2）。

## 3. 浏览器基线（未构建行为）

- 六 app 中仅 shell/docs/markdown 有 web-dist；sheets/slides/pdf **无 web-dist 且无 vite.web.config.ts**。
- `node scripts/dev.mjs status` → relay :8787 UP。
- `curl http://localhost:8787/sheets/` → **200，返回 shell 首页 HTML**（serveStatic 对未托管 app
  回退到 roots[0]=shell），非 404。`/sheets/` 浏览器实拍 = shell 首页（"首页/最近/项目…"），
  截图 `baseline-sheets-unbuilt.png`。
- 推论：三 app 构建出 web-dist 后 `findStaticRoots`（server.mjs L209 candidates 已含
  pdf/sheets/slides）自动托管，无需改静态路由；只有 `controlMatch` 正则（L403）需扩展。
