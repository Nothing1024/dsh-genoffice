# spec 5.4 专项检查清单（Task 13）

- [x] `ExcelShell.tsx` 的修复没有改 `isCopilotOpen` 初值（仍 `useState(true)`），未混入方案 A；落地为方案 B：`CONTROL_MODE` 时附加 `control-mode` class + CSS 单列 grid。
- [x] UF-003 三态截图与修复前逐项比对，列宽/x 坐标一致（默认 360+540，收起 34+866，再展开还原）；非控制模式无 `control-mode` class。
- [x] Task 10 未改 `web-xlsx.ts`，无需 `compat`；对外接口未动。
- [x] `decision.md` 写明：最大瓶颈是 9.54MB 主包 parse/eval（Long Task ~200ms，与文件规模无关），Worker 化解析预期收益为噪声级，故本轮暂不做。
- [x] 5.2 执行矩阵全部通过，evidence 路径真实存在（见 `phase-3/matrix.json` 与 `validate_package.py`）。
- [x] 入口接线：真实 URL `http://127.0.0.1:8787/sheets/?control=1&open=path:...` 与不带 control=1 的对照，不是孤立组件。
- [x] 交互：控制模式无 AI 面板；resize 后 leftover=0；非控制模式收起/展开动效（180ms grid transition）存在。
- [x] BR-001~004 / UF-001~004 / INV-001~004 / EVD-001~005 已核销。
