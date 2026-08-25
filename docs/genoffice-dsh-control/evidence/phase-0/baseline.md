# Phase 0 基线记录（Task 1）

> 时间：2026-08-12（会话内实际命令）
> 目的：为后续任务提供可回滚的基线快照与命令证据（spec 三态规则：事实必须来自实际命令）。

## 1. 栈根状态

- 工作区：`/Users/nothing/workspace/dsh/genoffice`
- relay `:8787`：UP（`node scripts/dev.mjs status` → `relay :8787 UP`）
- DSH 实例 `:3099`：UP（`dsh :3099 UP`）
- `node scripts/dev.mjs smoke`：14 项断言全部 PASS（详见 commands.log）

## 2. 三仓库 git 基线

| 仓库 | 状态 | HEAD |
|---|---|---|
| 栈根 `/Users/nothing/workspace/dsh/genoffice` | clean（仅 `?? docs/genoffice-dsh-control/evidence/phase-0/` 未跟踪） | `5390982 handoff: 生成 genoffice-dsh-control 交付 prompt（含 evidence/README 骨架）`（前序 `28c936b`、`0815b8a`） |
| upstream `/Users/nothing/workspace/dsh/genoffice/upstream` | git 仓库，clean（无改动输出） | `dd33cb8 chore: 移除已迁移的 dsh-plugin*/ 源码与归档快照` |
| plugin `/Users/nothing/workspace/dsh/plugin/dsh-artifact` | 非 git 仓库（无 .git）；保持不动 | — |

> 注：spec 1.3 记录 plugin 有与本需求无关的预先未提交改动；实际勘察 plugin 目录无 .git（非仓库），相关文件（README.md/tasks.csv/package.json/artifact-contract.ts/ArtifactBody.tsx）不在本需求改动范围内。

## 3. 浏览器基线（INV-001 对照）

- 页面：`http://localhost:8787/docs/`（docs 渲染器，非 control 模式，打开"未命名文档.docx"预览副本）
- 截图：`evidence/phase-0/baseline-docs.png`
- 实景确认（a11y 快照）：
  - Ribbon「Genspark AI」按钮（打开 AI 助手）存在
  - AI 快捷按钮「AI 总结 / AI 润色 / AI 排版」存在
  - 右侧 AI dock（Genspark 分隔条 + AI 设置 + 起草区 + 附件 + 修订追踪 + 发送）存在
  - ⚙ AI 设置对话框（模型服务商 / API Key / 模型，localStorage BYOK）存在
  - 保存按钮：`保存 (⌘S)` 存在（当前 disabled，因文档未修改）

## 4. 基线命令输出摘要

完整输出见 `commands.log`：
- `node scripts/dev.mjs status` → relay/dsh 均 UP
- `node scripts/dev.mjs smoke` → 全部通过 ✔（契约断言 14 项：health/dir/file/inject/open 形态/事件名镜像/tab⊆渲染器）

## 5. 本阶段关键约束备忘

- 不修改任何源码（Task 1 纯记录）。
- baseline-docs.png 为 INV-001 非控制模式对照基线：后续 Task 15/16 的「非 control 截图」应与此一致（AI 元素齐全）。
