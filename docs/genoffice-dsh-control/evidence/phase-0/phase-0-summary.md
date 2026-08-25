# Phase 0 Summary

## 完成任务

- Task 1：记录基线并归档证据（commands.log / baseline.md / baseline-docs.png）
- Task 2：定义 contracts/control-api.md 控制契约（单一事实源，4 镜像点声明，评审记录 control-api-draft.md）
- Task 3：Phase 0 回归验证

## 验证命令

| 命令 | 结果 | 日志 |
|---|---|---|
| `node scripts/dev.mjs status` | relay :8787 UP；dsh :3099 UP | evidence/phase-0/commands.log |
| `node scripts/dev.mjs smoke` | 14 项断言全部 PASS（现状不回归） | evidence/phase-0/commands.log |
| `git status --short` / `git log --oneline -3`（三仓库） | 栈根 clean（仅 evidence/ 未跟踪）；upstream clean；plugin 非 git 仓库 | evidence/phase-0/baseline.md |
| chrome MCP 截图 `http://localhost:8787/docs/` | 非 control 模式基线：Genspark AI 按钮 + AI 总结/润色/排版 + 右侧 AI dock + AI 设置齐全 | evidence/phase-0/baseline-docs.png |

## 用户路径 / API 验证

| UF/API | 结果 | Evidence |
|---|---|---|
| INV-001 对照基线（非 control AI dock 存在） | ✔ 截图 + a11y 快照确认 | baseline-docs.png |
| 契约人工评审（4 镜像点声明存在、端点/错误语义/安全边界齐全） | ✔ 通过 | control-api-draft.md |

## 产出物

- `contracts/control-api.md`（新建，控制契约单一事实源，INV-004）

## 剩余风险

- 契约中的实现细节（连接数上限 32、TTL 60s/30s）将在 P1 落地时按实际校准。
- plugin 目录非 git 仓库，无法用 git diff 追踪插件改动；以 build/typecheck/实景验证为准。
