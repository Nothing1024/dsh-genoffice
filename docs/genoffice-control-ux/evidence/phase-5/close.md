# Task 25 close 2026-08-25

```
node scripts/dev.mjs smoke          → 全部通过
cd plugin && pnpm vitest run        → 15 files / 129 tests
upstream 五 app typecheck           → 0 error
node --test write-atomic.test.mjs   → 4 pass
validate_package.py docs/genoffice-control-ux
```

5.2 矩阵见 `real-run.md`。两仓语义提交：upstream（preflight + pdf/sheets 注册）/ 插件（Back 接线 + 证据）。

validate_package.py: 0 FAIL / 1 WARN / 12 PASS（5.2 路径审计因 Phase 5 标题先匹配而 WARN，证据目录本身齐全）。
