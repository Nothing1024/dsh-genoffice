# Phase 3 Summary

## 完成任务

- Task 15：docs 控制模式隐藏 AI 助手（ai-dock 不渲染；Ribbon「Genspark AI」组 + AI 总结/润色/排版隐藏；视图 tab「AI 面板」toggle 隐藏——`hideAi={CONTROL_MODE}` 条件渲染，非 control 分支零改动）
- Task 16：markdown 控制模式隐藏 AI 助手（ai-dock 不渲染；Ribbon Genspark AI 组隐藏）
- Task 17：Phase 3 回归验证

## 验证命令

| 命令 | 结果 | 日志 |
|---|---|---|
| `npm run typecheck -w @genoffice/docs` / `-w @genoffice/markdown` | 全绿 | — |
| `npm run web:build`（docs/markdown） | 构建成功 | — |
| `node scripts/dev.mjs smoke` | 全部 PASS | — |
| 浏览器 control=1 双态截图对比 | docs/markdown 均无任何 AI 元素；非 control 均 AI 元素齐全 | evidence/UF-003/ |

## 用户路径 / API 验证

| UF | 结果 | Evidence |
|---|---|---|
| UF-003 docs control=1 | 无 Genspark AI 按钮、无 AI 总结/润色/排版、无右侧 AI dock；编辑器功能完整（Ribbon 各 tab 正常） | docs-control-noai.png |
| UF-003 markdown control=1 | 同上；文档正常加载显示 | markdown-control-noai.png |
| UF-003 非 control 回归（docs） | Genspark AI 按钮 + 快捷按钮 + AI dock（含 AI 设置）照常 | docs-noncontrol-ai.png |
| UF-003 非 control 回归（markdown） | 同上 | markdown-noncontrol-ai.png |
| BR-006 | control 模式截图无任何 AI 助手 UI | 上述两张 control 截图 |

## 实现说明

- 只做渲染条件（ASM-005 运行时隐藏）：AiPanel/agent 模块代码未改动；`showAi`/`aiOpen` 的 localStorage 逻辑保留。
- 非 control 分支代码路径不变（INV-001），仅新增 `hideAi` prop（默认 false）。

## 剩余风险

- 旧构建兼容（UF-003 失败分支）：relay 托管旧 web-dist 时 control=1 被忽略、按普通模式渲染——由构建部署纪律保证（web-dist 重建后生效），5.2 记录说明。
