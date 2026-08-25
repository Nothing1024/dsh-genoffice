# Phase 0 Summary

## 完成任务

- Task 1: 启动本地 web 版并复现布局截断问题
- Task 2: 确认修复实现方式并记录设计决策
- Task 3: 执行 Phase 0 回归验证

## 验证命令

| 命令 | 结果 | 日志 |
|---|---|---|
| `cd upstream && npm run typecheck -w @genoffice/sheets` | 通过（改动前基线） | 无错误 |
| `cd upstream && npm run web:build -w @genoffice/sheets` | 通过，8.82s | `web-dist/assets/index-D6kw6VLu.js` 9.5MB |
| `node scripts/dev.mjs start-relay` | `:8787` 就绪 | `/tmp/genoffice-web.log` |
| Playwright 800×900 `control=1` | 复现成功：grid `360px 540px`，唯一子节点宽 360，右侧死区 ≈350px | `repro-control-mode.png` + `repro-metrics.json` |
| Playwright 800×900 非控制 | AI 面板 360px + 表格 x=360，对照成立 | `repro-non-control.png` |

## 用户路径 / 性能验证

| UF/基线项 | 结果 | Evidence |
|---|---|---|
| UF-001 复现（修复前） | 控制模式表格未占满，右侧约 360px 死区 | `repro-control-mode.png` |
| UF-003 对照（修复前） | 非控制模式 AI 默认展开，表格在第二列 | `repro-non-control.png` |
| 方案选择 | 选定方案 B（`control-mode` class + 单列 grid），否决方案 A | `design-decision.md` |

## 剩余风险

- 方案 A 若被误用会把表格压到 34px 轨道，Phase 1 必须只落地方案 B。
- `body { min-width: 900px }` 使 <900px 视口裁切，不在本次 BR-001 范围；插件侧栏 700–800px 时修复后仍可能有少量 overflow，需在 Task 5 用两个宽度点确认「无 360px 死区」即可。
- Phase 1 改动范围：`ExcelShell.tsx` class 表达式 + `styles.css` 一条选择器；不改 `isCopilotOpen` 初值、不改 `control.ts`。
