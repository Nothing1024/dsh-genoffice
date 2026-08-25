# Phase 2 Summary（sheets 接入）

## 完成任务

- **Task 7** sheets Web 化基础：`vite.web.config.ts`（node: 别名 shim）、`web-node-shims.ts`（Buffer 子集 +
  同步 SHA-256 + fs/path/os/zlib 桩）、`web-xlsx.ts`（浏览器 xlsx 解析 + 范围/公式读取 + gateway 保存）、
  `web-bridge.ts`（window.desktopApi 全接口）、package.json web:build/web:dev。
  验证：`npm run web:build -w @genoffice/sheets` ✓；`/sheets/?open=path:` 加载成功（Univer 3 canvas，
  仅 1 次 /api/file，console 无 error）。
- **Task 8** xlsx 读写后端：gateway `applyCellEditsToXlsx` 纯 JSZip 管线浏览器直跑（保存只改 touched
  entries）；`applySaveRequest` 组装（sheetId→name 映射、结构操作分组、filter/cf/dv/hyperlink/note/
  formulaValues/pageSetup 转换）；`buildSavePayload` 从 save-actions 抽取共用。
  验证：编辑 D1=42 + B1:B10 数值格式 → 导出写回成功；未编辑条目字节不变（BR-009）；原文件在写回前不变（BR-008）。
- **Task 9** sheets 控制适配器：`control.ts`（M0 结构：SSE 注册/注销、tool/context/export 事件、
  executeWorkbookTool 桥接、buildExportBytes=⌘S 同源保存管线）；App.tsx 接线（univerRef.current 后 init，
  cleanup close，非 control 零副作用）。
  验证：control=1 页面注册成功；context/read_range/propose_operations/export 全链路真实数据。
- **Task 10** xlsx_* 工具与 tab 接线：tool-schema.ts +8 工具；tools.ts READ_SKILLS 扩展；
  genoffice.tsx PREVIEWABLE 五扩展；local-paths.ts 白名单同步（md|mdx|docx|xlsx|pptx|pdf）。
  验证：plugin build+typecheck ✓；3099 重启；tab 打开 xlsx → control=1 iframe → 工具可调 →「写入磁盘」
  写回落盘（E1=99）。

## 验证命令

| 命令 | 结果 | 日志 |
|---|---|---|
| `npm run web:build -w @genoffice/sheets` | ✓ | sheets-web-console.log |
| `npm run typecheck -w @genoffice/sheets` | ✓（0 error） | sheets-web-console.log |
| 控制面 context/tool/export（curl） | 全链路真实数据 | sheets-control-console.log + API-control/*.json |
| 写回产物校验 | zip OK；D1=42；B1 s=2；numFmtId=2；未编辑条目字节不变 | sheets-export-bytes.json |
| `cd plugin && npm run build && npm run typecheck` | ✓ | xlsx-tools.log |
| 3099 tab 走查 | xlsx 可预览；control iframe；写入磁盘落盘 | xlsx-tab-preview.png |
| `node scripts/dev.mjs smoke` | 全部通过（xlsx 族 host 镜像严格核对） | smoke（本 summary） |

## 用户路径 / API 验证

| UF/API | 结果 | Evidence |
|---|---|---|
| UF-001 前置（工具链读/写/上下文） | context/read_range/propose_operations 真实数据 | API-control/sheets-*.json |
| BR-008 显式写回 | 编辑后文件不变；export/写入磁盘后变化 | sheets-export-bytes.json |
| BR-009 格式保真 | 未编辑条目字节不变；zip 完整 | sheets-export-bytes.json |
| BR-003 未注册 | `executor not registered` | API-control/sheets-tool-unregistered.json |
| BR-002 非法输入 | `invalid input` 不执行 | API-control/sheets-tool-invalid.json |

## 剩余风险

- 浏览器 xlsx 解析为自定义子集（styles 解析覆盖常用面；高级主题色/图表只读保真）。
- `正在流式加载…行可用` 状态文案为桌面同语义（全量已索引）。
- agent 端到端（聊天→工具→写回）留待 Task 23 执行矩阵。
