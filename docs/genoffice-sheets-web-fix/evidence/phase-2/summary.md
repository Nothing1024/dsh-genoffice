# Phase 2 Summary

## 完成任务

- Task 8: 合成 10k 行夹具（另产 50k），web 版可打开见数据
- Task 9: 冷启动 / 打开 / Long Task 三项量化基线
- Task 10: 基于数字决定本轮暂不改解析代码（`decision.md`）
- Task 11: Phase 2 回归验证

## 验证命令

| 命令 | 结果 | 日志 |
|---|---|---|
| 生成夹具 | 10k = 189,520 B / 50k = 981,517 B | `benchmark/fixtures/` |
| Playwright 打开 10k | canvas + 可见数字格，openMs=1929（含浏览器冷启动） | `benchmark/fixture-open-check.png` |
| 3×3 冷 Context 基线 | small/10k/50k canvas 中位 388/377/380 ms | `benchmark/performance-trace.json` |
| `npm run typecheck -w @genoffice/sheets` | Phase 1 后仍绿；Phase 2 无代码改动 | `phase-1/typecheck.log` |
| `npm run compat` | 跳过（未改解析逻辑，见 decision.md） | — |

## 用户路径 / 性能验证

| UF/基线项 | 结果 | Evidence |
|---|---|---|
| UF-004 夹具 | 10k 行文件可打开，A1=1…E1=5 | `fixture-open-check.png` |
| UF-004 基线 | 首包 9.54MB / 57ms；打开 377–388ms；最长 LT ~200ms | `baseline.md` |
| UF-004 决策 | 暂不做 Worker / 暂不拆包；理由可验证 | `decision.md` |

## 剩余风险

- Long Task 栈无 sourcemap，归属待勘察；用规模差 + Node 正则下限交叉验证。
- Headless 滚动 fps 不能代表 60Hz 掉帧。
- 用户「严重卡顿」更可能来自 9.54MB 主包（尤其非 localhost）或真实复杂 xlsx；本轮未声称「已经不卡」。
