# Phase 2 Summary

## 完成任务

- Task 10：docs 控制适配器（`apps/docs/src/renderer/control.ts`：control=1 解析、docId=sha256(绝对路径)、EventSource 注册/注销、tool/context/export 三事件处理、visibilitychange/online 重连、编辑器未就绪分支）
- Task 11：markdown 控制适配器（`apps/markdown/src/renderer/control.ts`，同一契约，markdown 版 executeTool/buildDocContext）
- Task 12：适配器接线（docs/markdown App.tsx 编辑器就绪后 initControlMode；control 参数打开后清除；非 control 零副作用）
- Task 13：导出字节链路（docs: buildDocBytes 复用保存管线；markdown: serializeDocText + getMarkdown；export 事件 → notify kind='export' 回传 base64+path+mtimeMs）
- Task 14：Phase 2 回归验证

## 验证命令

| 命令 | 结果 | 日志 |
|---|---|---|
| `npm run typecheck -w @genoffice/docs` / `-w @genoffice/markdown` | 全绿 | — |
| `npm run web:build`（shell/docs/markdown） | 构建成功 | — |
| `node scripts/dev.mjs smoke` | 全部 PASS | evidence/phase-1/smoke.log（复跑） |
| 浏览器 control=1 docs 页面 | console 无 error；EventSource 建立；hello 注册 | evidence/phase-2/docs-control-console.log |
| 浏览器 control=1 markdown 页面 | 同上 | evidence/phase-2/markdown-control-console.log |
| 浏览器非 control 页面 | 无 /api/control/stream 请求 | 实景（performance entries = []） |

## 用户路径 / API 验证

| UF/API | 结果 | Evidence |
|---|---|---|
| UF-001 docs：read_blocks 返回真实内容；replace_blocks mutated:true 且 iframe 实时变化 | ✔ | docs-control-console.log + wiring-docs.png |
| UF-001 markdown：read_blocks 返回 markdown；replace_blocks 改写可见 | ✔ | markdown-control-console.log + wiring-markdown.png |
| UF-004：context 端点返回块结构上下文（docs/markdown） | ✔ | 实景 + API-control/context-ok.json |
| UF-002 半程：export → 磁盘内容 = iframe 内容（docs：document.xml 含改写段落；markdown：文件含改写段落） | ✔ | export-bytes.json + markdown-export.json |
| BR-008：编辑工具不写盘（编辑前后 fixture md5 不变） | ✔ | export-bytes.json verification |
| INV-001：非 control 页面无 EventSource、AI dock 照常 | ✔ | 实景 |
| Task 12：打开后地址栏无 control/open 残留 | ✔ | 页面 URL 实景 |

## 修复的缺陷

- **URL 清除竞态**：适配器最初在 initControlMode 中清除 open 参数，但 markdown app 的 boot effect 在适配器 effect 之后才消费 open= → 文档加载为空白。修复：适配器只清除 `control` 参数，`open`/`file` 由 app 自身流程清除（两 app 已统一）。

## 剩余风险

- docs `executeTool` 的 numIds 来自当前文档扫描（非 AiPanel 的 blocksRef 全量扫描），列表插入的 numId 复用以文档内现有定义为限；行为与 AiPanel 一致或更保守。
- 编辑器未就绪分支（UF-001 fail-notready）在真实浏览器中加载窗口极短，5.2 将以时序说明 + API 层验证覆盖。
