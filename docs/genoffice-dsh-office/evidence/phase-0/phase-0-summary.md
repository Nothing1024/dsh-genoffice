# Phase 0 Summary（基线与勘察）

## 完成任务

- **Task 1** 记录基线并勘察三 app Web 化缺口：
  - `evidence/phase-0/commands.log`（git 基线 + smoke 基线 + 全部勘察命令）
  - `evidence/phase-0/slidesapi-inventory.md`（slidesApi **129 方法 / 245 处 / 22 文件**，按打开/保存/编辑/演讲分组）
  - `evidence/phase-0/sheets-pdf-survey.md`（sheets desktopApi 26 方法 + gateway 纯 JSZip 管线发现；
    pdf pdfApi 26 方法 + pdf-lib 保存管线 + wasm 资产位置）
  - `evidence/phase-0/baseline-sheets-unbuilt.png`（未构建 app 实拍：/sheets/ 回退 shell 首页，非 404）
- **Task 2** 三 app Web 化策略决议：
  - `evidence/phase-0/web-strategy.md`（sheets=浏览器 JSZip gateway 复用；slides=in-browser pptx-engine
    会话模型；pdf=pdf.js + 浏览器 pdf-lib 合并；pdf 导出形态=合并 PDF）
  - spec.md §1.4 ASM-001 / ASM-004 定稿更新；§3.3 定位清单 3 处 `待勘察` 行全部补齐
- **Task 3** Phase 0 回归验证：smoke 全绿（M0 现状零回归）

## 验证命令

| 命令 | 结果 | 日志 |
|---|---|---|
| `node scripts/dev.mjs status` | relay :8787 UP / dsh :3099 UP | commands.log |
| `node scripts/dev.mjs smoke` | 全部通过（30 断言，含契约/控制面/镜像） | commands.log + 本阶段重跑 |
| `git status --short` / `git log --oneline -3`（栈根 + upstream） | 基线记录 | commands.log |
| `grep -rhoE "window\.slidesApi\.[a-zA-Z0-9_]+" …` | 129 方法 | slidesapi-inventory.md |
| `curl http://localhost:8787/sheets/` | 200（shell 首页回退） | sheets-pdf-survey.md |

## 关键事实（进入 P1-P4 的依据）

1. sheets/slides/pdf 无 web-dist 与 vite.web.config.ts；`findStaticRoots` 候选已含全部六 app，构建后自动托管。
2. sheets 的 xlsx 读写存在**纯 JSZip 内存管线**（gateway：readBasicWorkbook / planCellEditsToXlsx /
   assembleWithJsZip），node 导入仅 4 处可 shim → 浏览器可复用，保存只改 touched entries（BR-009 最稳）。
3. slides 245 处依赖中核心编辑子集约 30 方法；pptx-engine 纯 TS 仅 3 处 node 内建引用 → 浏览器会话模型可行。
4. pdf 渲染器已内嵌 pdf.js（浏览器原生）；保存管线主体 pdf-lib 纯浏览器可跑；wasm 资产在 npm 包内可 `?url`。
5. relay `controlMatch` 正则（server.mjs L403）与 smoke 断言（dev.mjs 控制面块）为 P1 扩展点。

## 剩余风险

- sheets gateway 浏览器 shim 的类型适配（Buffer 类型）与 styles.xml 解析新增量。
- slides pptx-engine 会话模型移植量（核心子集 30 方法）——超预算则按决议降级（open/save 必须可用）。
- pdf text-edit 的 PDFium wasm 面较大——超预算降级为 isError 显式不可用。
