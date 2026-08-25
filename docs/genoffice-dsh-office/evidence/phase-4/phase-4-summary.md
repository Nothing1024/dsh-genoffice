# Phase 4 Summary（pdf 接入）

## 完成任务
- **Task 16** pdf Web 化基础：web-node-shims（Buffer utf16le 等）+ web-wasm-assets（pdfium/hb-subset/LiberationSans ?url）+
  web-font-locate/web-font-subset/web-text-edit（pdfium wasm 文本改写全量移植）+ web-pdf-save（pdf-lib 合并）+ web-bridge + vite.web.config；
  server.mjs MIME 补 .mjs。
  验证：web:build ✓；/pdf/?open=path: 渲染成功（pdf.js 4 canvas，文本可见，console 无 error）。
- **Task 17** pdf 控制适配器：control.ts（executePdfTool 桥接、export=⌘S 同源 payload 应用 + 字节写回）；
  App.tsx 接线（aiApiRef/buildSaveRequestRef）。
  验证：context/read_pages/search_text/markup_text/edit_text/export 全链路；写回产物含高亮标注 +
  "right" 改写；冲突分支正确。
- **Task 18** pdf_* 工具：tool-schema.ts +20（19 skill + save）；smoke pdf 族三向镜像通过。

## 验证命令
| 命令 | 结果 | 日志 |
|---|---|---|
| npm run web:build -w @genoffice/pdf | ✓ | pdf-web-console.log |
| npm run typecheck -w @genoffice/pdf | ✓ | pdf-web-console.log |
| 控制面 context/tool/export | 全链路真实数据 | pdf-control-console.log |
| cd plugin && npm run build && npm run typecheck | ✓ | pdf-tools.log |
| node scripts/dev.mjs smoke | 全部通过 | phase-4 回归 |

## 用户路径 / API 验证
| UF/API | 结果 | Evidence |
|---|---|---|
| UF-003 前置（读页/搜索/高亮/改字/写回） | 真实数据 + 字节校验 | pdf-control-console.log |
| BR-008 显式写回 | 编辑后文件不变；export 后变化 | pdf-control-console.log |
| BR-009 格式保真 | 未编辑内容流保留（pdfium 重读校验） | pdf-control-console.log |

## 剩余风险
- 图片编辑（insert/transform/replace/delete image）网页版显式不可用（nativeImage 依赖）。
- 文本改写字体固定 LiberationSans（无系统字体），CJK 改写可能缺字（isError 显式拒绝）。
- agent 端到端留待 Task 23。
