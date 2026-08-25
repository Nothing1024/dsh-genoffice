# Phase 3 Summary

## 完成任务

- Task 12: spec 5.2 真实场景全套测试
- Task 13: Phase 3 回归验证（typecheck + 5.4 + validate_package.py）

## 验证命令

| 命令 | 结果 | 日志 |
|---|---|---|
| Playwright 5.2 矩阵重放 | 全行 pass | `phase-3/matrix.json` |
| `npm run typecheck -w @genoffice/sheets` | EXIT 0 | `phase-3/typecheck.log` |
| `python3 validate_package.py docs/genoffice-sheets-web-fix` | 见同目录 `validate_package.log` | |

## 用户路径 / 性能验证

| UF | 结果 | Evidence |
|---|---|---|
| UF-001 | leftover=0 @700/900，console 0 error | `UF-001/success-*.png` `console.png` |
| UF-002 | leftover=0 @500；1100px 伸展到 1100 | `UF-002/resize-500px.png` |
| UF-003 | 三态与修复前一致 | `UF-003/*.png` `compare.md` |
| UF-003 失败分支 | 无视觉回归 | 同上 |
| UF-004 | 有基线数字；暂不做优化 | `benchmark/baseline.md` `decision.md` |
| UF-004 夹具 | 10k 可打开 | `benchmark/fixture-open-check.png` |

## 剩余风险

- `body { min-width: 900px }` 使 <900px 视口裁切，非本 bug。
- 性能：9.54MB 主包仍在；本轮不声称已不卡。
- upstream 工作区另有未提交的 web 移植文件（`control.ts` / `web-xlsx.ts` 等）；本次 commit 只含布局修复触及的 `ExcelShell.tsx` + `styles.css`。`CONTROL_MODE` 符号来自已有未跟踪的 `control.ts`。
