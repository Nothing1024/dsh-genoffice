# Phase 1 Summary

## 完成任务

- Task 4: 方案 B 落地（`control-mode` class + 单列 grid；未改 `isCopilotOpen` 初值）
- Task 5: UF-001/UF-002 真实场景验证
- Task 6: UF-003 非控制模式三态无回归
- Task 7: Phase 1 回归验证

## 验证命令

| 命令 | 结果 | 日志 |
|---|---|---|
| `npm run typecheck -w @genoffice/sheets` | 通过 | `phase-1/typecheck.log` EXIT:0 |
| `npm run web:build -w @genoffice/sheets` | 通过 8.61s | `phase-1/build.log` EXIT:0 |

## 用户路径 / 性能验证

| UF/基线项 | 结果 | Evidence |
|---|---|---|
| UF-001 700px | leftover=0，fillRatio=1，无 360px 死区，console 空 | `UF-001/success-700px.png` |
| UF-001 900px | leftover=0，表格铺满，列 A–J 可见（修复前只到 F） | `UF-001/success-900px.png` |
| UF-002 500px / 900→500 / 1100px | 无 360px 死区；1100px 时 grid=1100 leftover=0 | `UF-002/resize-500px.png` |
| UF-003 三态 | 默认/收起/再展开与修复前一致，未带 `control-mode` | `UF-003/*.png` + `compare.md` |

## 代码改动（仅 apps/sheets）

- `ExcelShell.tsx`：`.app-shell` class 在 `CONTROL_MODE` 时附加 `control-mode`；`useState(true)` 未改
- `styles.css`：`.app-shell.control-mode .sheet-body { grid-template-columns: minmax(0, 1fr); }`

## 剩余风险

- `body { min-width: 900px }` 使视口 <900px 时仍按 900px 排版并裁切；已确认裁切区内无 360px 死区。不在本次范围。
