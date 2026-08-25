# slidesApi 方法清单（Task 1 勘察产物）

> 来源命令（2026-08-12，upstream 仓库）：
> `grep -rhoE "window\.slidesApi\.[a-zA-Z0-9_]+" apps/slides/src/renderer | sed 's/window\.slidesApi\.//' | sort | uniq -c | sort -rn`
> `grep -rn "window\.slidesApi" apps/slides/src/renderer | wc -l` → **245 matches，跨 22 个文件**。
> 方法名全部来自实际 grep 输出，无记忆补充。

## 0. 总量

- 全量方法名（去重）：129 个
- 使用点：245 处，跨 22 文件（App.tsx 为主消费点，另有 ai/slides-skill.ts 等）

## 1. 打开 / 会话（open/session）

| 方法 | 使用数 | 说明 |
|---|---|---|
| `openPptx` | 1 | 打开对话框选 pptx（App.tsx L621 附近） |
| `consumePendingOpen` | 2 | 挂起打开消费（App.tsx L359/L860） |
| `onOpened` | 1 | 打开完成回调 |
| `newBlank` | 1 | 新建空白演示 |
| `getRecentFiles` | 1 | 最近文件列表 |
| `onRenamed` | 1 | 文件重命名回调 |
| `getLanguage` / `onLanguageChanged` | 1/1 | 语言 |
| `getTheme` / `onThemeChanged`(via main.tsx) | 1/1 | 主题 |
| `getAiSettings` | 1 | AI 设置 |
| `reportCloseSaveResult` | 2 | 关闭前保存结果上报 |
| `onCloseSaveRequest` | 1 | 关闭保存请求 |

## 2. 保存 / 导出（save/export）

| 方法 | 使用数 | 说明 |
|---|---|---|
| `save` | 1 | 保存到当前路径（file-actions.ts L44） |
| `saveAs` | 1 | 另存为（file-actions.ts L64） |
| `isDirty` | 3 | 脏状态查询 |
| `setAutoSavePref` | 1 | 自动保存偏好 |
| `exportPdf` | 1 | 导出 PDF |
| `exportImages` | 1 | 导出图片 |
| `pickExportPdfPath` | 1 | 选导出 PDF 路径 |
| `pickExportDir` | 1 | 选导出目录 |
| `printSlides` | 1 | 打印 |
| `htmlToPptx` | 2 | HTML → pptx |

## 3. 编辑核心面（control 模式必须覆盖）

| 方法 | 使用数 | 说明 |
|---|---|---|
| `editText` | 7 | 文本编辑（含 style-actions/slides-skill 多处） |
| `editTransform` | 3 | 元素变换 |
| `batchEditTransform` | 2 | 批量变换 |
| `editFill` | 6 | 填充样式 |
| `editStroke` | 5 | 描边样式 |
| `editTableCell` | 4 | 表格单元格编辑 |
| `editTableStyle` | 2 | 表格样式 |
| `addElement` | 8 | 添加元素（文本/形状/图片等） |
| `addSlide` / `addBlankSlide` / `addSlideWithLayout` | 2/1/1 | 添加幻灯片 |
| `deleteElement` | 3 | 删除元素 |
| `deleteSlide` | 2 | 删除幻灯片 |
| `copySlide` / `pasteSlide` / `repasteSlide` | 2/1/1 | 幻灯片复制粘贴 |
| `copyElements` / `pasteElements` | 2/1 | 元素复制粘贴 |
| `duplicateElements` | 1 | 元素复制 |
| `groupElements` / `ungroupElement` | 1/2 | 组合/取消组合 |
| `reorderElement` | 1 | 元素重排 |
| `flipElements` | 2 | 翻转 |
| `moveSlide` / `moveSection` | 1/1 | 移动页/节 |
| `setSlideSize` | 1 | 页面尺寸 |
| `setSlideHidden` | 1 | 隐藏页 |
| `beginHistoryBatch` / `endHistoryBatch` | 3/3 | 历史批处理 |
| `undo` / `redo` | 1/1 | 撤销重做 |
| `setNotes` / `getNotes` | 1/3 | 备注 |
| `getRenderSlides` | 1 | 渲染树获取 |
| `editBackground` | 2 | 背景编辑 |
| `editChart` / `getChartData` | 2/3 | 图表编辑/数据 |
| `setLink` / `getLink` / `getRunLinks` / `getSlideLinks` | 2/2/1/1 | 超链接 |
| `findReplace` | 1 | 查找替换 |
| `addTable` / `tableMerge` / `tableStructure` | 2/1/3 | 表格 |
| `setTableRowHeight` / `setTableColWidth` | 1/1 | 表格尺寸 |
| `addChart` / `addSmartArt` / `addImageBytes` / `addMediaBytes` / `insertImage` / `insertImageUrl` / `insertMedia` / `insertModel3d` / `addInk` | 2/2/2/1/1/1/1/1/1 | 插入对象 |
| `editPictureSrcRect` / `editPictureOpacity` / `replacePictureUrl` / `replacePictureBytes` / `editConnectorEndpoints` / `editChart` | 2/1/1/1/1/2 | 图片/连接线 |
| `getShapeKeys` / `getMediaData` / `getLayouts` / `getTheme` / `applyTheme` / `getTransition` / `setTransition` / `getAnimations` / `setAnimations` / `setAdvanceTimes` | 2/2/1/1/1/3/1/5/1/1 | 形状/媒体/版式/主题/动画 |
| `getSections` / `addSection` / `renameSection` / `removeSection` / `getHeaderFooter` / `applyHeaderFooter` / `getComments` / `addComment` / `deleteComment` / `getChartColorSchemes` | 1/1/1/1/1/1/1/1/1/1 | 节/页眉页脚/评论 |
| `saveStyleTemplate` / `loadStyleTemplate` / `listStyleTemplates` / `saveStyleSidecar` | 1/1/1/1 | 样式模板 |
| `masterOpen` / `masterEnter` / `masterClose` / `masterEditText` / `masterEditTransform` / `masterEditFill` / `masterEditStroke` / `masterDeleteElement` | 1/1/1/1/1/1/1/1 | 母版编辑 |

## 4. 演讲 / 展示（presenter）

| 方法 | 使用数 | 说明 |
|---|---|---|
| `presenterStart` / `presenterEnd` / `presenterSync` / `presenterSwap` / `presenterInk` / `presenterEnhance`(无) | 1/1/1/1/6/— | 演讲者视图 |
| `audienceNav` / `audienceReady` / `onAudienceNav` | 5/1/1 | 观众导航 |
| `onShowSync` / `onShowInk` / `onMenuCommand` | 1/1/1 | 展示回调 |

## 5. 剪贴板 / 其他

| 方法 | 使用数 | 说明 |
|---|---|---|
| `nativeClipboard` | 3 | 原生剪贴板 |
| `hasSlideClipboard` | 2 | 幻灯片剪贴板状态 |
| `clipboardExternal` | 1 | 外部剪贴板 |
| `cloudGenStatus` / `cloudGeneratePage` | 1/1 | 云端生成 |
| `aiStream` / `aiStreamCancel` / `onAiStream` / `aiGskLogin` | 1/1/2/1 | AI 流 |
| `webSearch` / `imageSearch` / `generateImage` / `analyzeMedia` | 1/2/1/1 | AI 搜索/生成 |
| `aiSnapshotRestore` | 2 | AI 快照恢复 |
| `getComments`(见上) / `printSlides`(见上) | | |

## 6. 结论（Task 2 决议输入）

- 245 处依赖中，**control 模式必需的核心编辑子集**约 30 个方法（第 3 节标 * 者），集中在
  App.tsx / style-actions.ts / arrange-actions.ts / slide-actions.ts / table-actions.ts / clipboard-actions.ts。
- 主进程侧的对应实现全部基于 `@genoffice/pptx-engine`（纯 TS，JSZip + fast-xml-parser，
  仅 3 处 node 内建引用：`node:crypto` createHash/randomUUID、`node:zlib` deflateSync——均可浏览器 shim）。
- 展示/演讲/打印/导出 PDF 等非 control 路径可标记为「显式不可用」（console.warn + 默认值），
  不影响控制模式编辑能力。
