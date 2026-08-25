# UF-003 修复前后对比

视口均为 800×900，同一文件 `compatibility-basic.xlsx`，不带 `control=1`。

| 状态 | 修复前 (Task 1) | 修复后 (Task 6) | 差异 |
|---|---|---|---|
| 默认展开 | grid `360px 540px`，AI 359×600 @x=0，univer 550 @x=360，shell=`app-shell ` | grid `360px 540px`，AI 360×781 @x=0，univer 550 @x=360，shell=`app-shell ` | 无。高度差来自 overlay/测量时机，布局列宽与 x 坐标一致 |
| 收起 | （修复前未截收起态；既有 CSS 为 34px 1fr） | grid `34px 866px`，shell=`app-shell copilot-collapsed`，34px 图标条 + 表格变宽 | 符合修复前既有 `.copilot-collapsed` 行为 |
| 再展开 | — | 回到 `360px 540px`，与默认展开一致 | 无回归 |
| `control-mode` class | 无 | 无（非控制模式不附加） | 方案 B 未泄漏到独立 tab |

截图：`default-open.png` / `collapsed.png` / `expanded-again.png` 对照 `phase-0/repro-non-control.png`。
consoleErrors: []
