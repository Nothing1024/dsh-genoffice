# genoffice-sheets-web-fix Handoff

本文件是可直接交给 Codex / Claude / Grok / 任意 Coding Agent 的交付 Prompt。你的目标不是"按文件改代码"，而是在不破坏业务不变量的前提下，完成 spec 定义的用户可见行为。

> 使用方式：把本文件完整粘贴给执行 Agent，或让 Agent 开工前先读本文件。
> 本文件只做入口导航，不复制 spec 内容；所有规则、任务、验收细节以 `spec.md` 为准。
> **执行方式**：本次交付给 Grok 执行，要求 Grok 调用其自身的 agentic workflow（多步骤/工具调用循环）自主完成，不是单轮对话输出代码 diff。

## 1. 目标

修复 GenOffice Sheets（Excel）Web 版在 DSH 插件控制模式（iframe 嵌入，`control=1`）下"编辑区域只显示约一半、顶部工具栏完整"的布局截断 bug，并对 Web 版整体卡顿问题做量化基线 + 可行的首轮性能优化。

## 2. 资料清单

| 资料 | 路径 | 状态 | 用途 |
|---|---|---|---|
| Spec（唯一事实源） | `spec.md`（本目录，完整路径 `/Users/nothing/workspace/dsh/genoffice/docs/genoffice-sheets-web-fix/spec.md`） | found | 业务合同、技术方案、任务详情、验收协议 |
| Tasks CSV（状态板） | `tasks.csv`（本目录） | found | 13 任务、4 Phase 状态跟踪 |
| Evidence 目录 | `evidence/`（本目录，内含 evidence/README.md 说明结构） | found | 证据归档 |

缺失资料与假设：

- ASM-001~003 见 spec.md 第 1.4 节，均为可执行期自行验证的假设，不阻塞开工。

## 3. 开工上下文

### 仓库布局（重要：两个独立仓库）

```text
/Users/nothing/workspace/dsh/genoffice/                  ← 编排层（本 spec/tasks/evidence 所在处，独立 git 仓库）
  docs/genoffice-sheets-web-fix/                          ← 本次任务包
  scripts/dev.mjs                                         ← relay 启停脚本
  upstream/                                                ← GenOffice 本体 fork（genspark-ai/genoffice，独立 git 仓库，代码改动全部在这里）
    apps/sheets/src/renderer/ExcelShell.tsx                ← 布局修复目标文件
    apps/sheets/src/renderer/styles.css                    ← 布局修复目标文件
    apps/sheets/src/renderer/web-xlsx.ts                   ← 性能优化候选文件（若基线支持）
    apps/sheets/src/renderer/control.ts                    ← 只读，不许改（保存/写回契约）
```

**Grok 必须先 cd 进 upstream/ 再跑 sheets 相关的 npm run 命令**（workspaces 结构，见 spec 1.3 节事实清单）。`upstream/` 是它自己独立的 git 仓库（origin `genspark-ai/genoffice`），编排层根目录的 git 提交不会自动包含 `upstream/` 里的改动——两边要分别 commit。

### 架构 Before / After

```text
Before: control=1 时 AiChatPanel 的 DOM 被移除，但 .sheet-body 的 CSS Grid 仍按
        `var(--copilot-width, 360px) minmax(0, 1fr)` 分配列宽 → 360px 死区残留 →
        表格区域只拿到 (容器宽度 - 360px)，顶部 ribbon 横跨全宽不受影响。

After:  CONTROL_MODE 时 .app-shell 附加 control-mode class（不改 isCopilotOpen 初值），
        `.app-shell.control-mode .sheet-body { grid-template-columns: minmax(0, 1fr); }`
        → 唯一子节点 .sheet-main 拿满宽，无 360px 第二列死区。
```

### Phase 地图

```text
P0(基线与复现，3任务) → P1(布局修复，4任务) → P2(性能基线与优化，4任务) → P3(端到端验收，2任务)
```

### 最关键规则（Top 10，全量见 spec.md 第 2 章）

- BR-001: 控制模式下 `.sheet-body` 可用宽度不得被已移除的 AI 面板列预留空间挤占
- BR-002: 非控制模式（独立 tab）AI 面板展开/收起行为不得因修复回归
- BR-003: 性能优化必须先有量化基线数字，再决定优化哪一项，禁止凭感觉改代码
- BR-004: 性能优化不得破坏 xlsx 打开/编辑/保存的数据保真度
- UF-001: 控制模式下打开 xlsx，表格区域占满可用宽度，无约 360px 死区
- UF-002: 容器宽度变化时表格区域联动伸展，不残留死区
- UF-003: 非控制模式 AI 面板展开/收起三态与修复前视觉一致（回归检查）
- UF-004: 产出性能基线数字；若数字支持且风险可控，完成一项优化并给出 before/after
- INV-002: 不得触碰 control.ts 的保存/写回契约（buildSavePayload/notify）
- INV-004: docs/slides 两个 app 的布局代码不在本次改动范围内（它们走 flex，未复现此 bug）

### 禁止事项

- 不得为了通过测试删除现有业务分支。
- 不得绕过权限判断（本需求无权限分支，此项形式保留）。
- 不得只修改 mock/fixture，不修改真实路径。
- 不得把失败状态吞掉。
- 不得只按行号修改；必须用 symbol/rg anchor 校验（三段式定位见 spec.md 第 3.3 节）。
- 不得只实现组件/函数而不接线到真实入口——本需求改动点本身就在真实渲染路径上，无需额外接线，但验证必须走真实 URL（`http://127.0.0.1:8787/sheets/?control=1&open=path:...`），不得只读代码判断"应该没问题"。
- 不得跳过交互反馈（resize 联动、AI 面板收起/展开动效）；它们是需求本体。
- 不得只跑单测/typecheck 就宣称完成——完成的唯一标准是 spec.md 第 5.2 节真实场景全套测试。
- 不得混用 Task 2 评估的方案 A/B（只落地一种最小改动，见 Task 4）。
- 不得在 Phase 2 没有基线数字的情况下直接改 web-xlsx.ts；若判断"暂不做优化"，必须在 evidence/benchmark/decision.md 写清楚具体理由，不许含糊。
- 不得修改 docs/slides 两个 app 的任何文件（INV-004，diff 范围只限 `apps/sheets/`）。

## 4. 开工前初始化

1. 通读 spec.md 第 1、2 章（事实基线 + 业务合同，重点读 2.3 节四条流程脚本 UF-001~UF-004）。
2. 预读 spec.md 第 5 章验收协议——先知道完成标准（5.2 真实场景测试），再开工。
3. 打开 tasks.csv（本目录），结合 spec 第 4 章找到 Task 1（当前全部 13 条均为"待开始"）。
4. 在 `/Users/nothing/workspace/dsh/genoffice/` 和 `/Users/nothing/workspace/dsh/genoffice/upstream/` 两处分别运行 `git status` 确认工作区状态（两个独立 git 仓库）。
5. 运行基线命令：`cd upstream && npm run typecheck -w @genoffice/sheets`（确认改动前 typecheck 是绿的，作为 before 基线）。
6. 启动本地 web 环境：`node scripts/dev.mjs start-relay`（在编排层根目录执行，拉起 `:8787` relay）。

## 5. 核心执行循环

**Grok 请用你自己的 agentic workflow（多步自主执行 + 工具调用循环）驱动以下流程，不要把这当成一次性代码生成任务：**

```text
WHILE tasks.csv 中存在"待开始"或"进行中"的任务:
    1. 按序号顺序，找到下一条前置任务已全部"已完成"的任务
    2. 读 spec.md 第 4 章对应 Task N 的详情（关联 BR/UF/INV/EVD、涉及文件、具体操作、验证命令）
    3. 回答：这条任务关联哪些 BR/UF/INV？哪些现有行为不能变？
    4. 把 tasks.csv 该行状态改为「进行中」
    5. 按 spec.md 第 3.3 节三段式定位校验目标文件位置（symbol + rg anchor，不要只信行号）
    6. 执行 Task 详情里的具体操作步骤
    7. 运行该 Task 的验证命令，把输出保存到 Task 详情里写明的 evidence 路径
    8. 通过 → 状态改「已完成」；失败 → 排障，最多主动修复 3 次
    9. 仍失败 → 标记「已阻塞:{具体原因}」，继续处理不依赖它的后续任务
   10. 每个 Phase 最后一条回归验证任务通过后，输出该 Phase 的 Summary（按 evidence/README.md 模板），再进入下一 Phase
```

不要中途问"是否继续"。除非所有剩余任务都被阻塞，否则持续推进直到 13 条任务全部「已完成」或不可再推进为止。

**特别提醒（Phase 2 性能任务，Task 8-11）**：这四条任务的核心约束是 BR-003——必须先跑出量化基线数字（Task 9），再基于数字判断要不要动 web-xlsx.ts（Task 10）。如果直接跳过测量就去优化代码，视为未遵守本次交付要求，需要回退重做。

## 6. 排障顺序

1. 查 spec.md 第 4 章当前任务的"注意事项"小节。
2. 查 spec.md 第 2 章关联 BR/UF/INV 的完整定义。
3. 按错误类型定位：CSS 层叠优先级、React state 初值时序、Vite 构建路径别名、xlsx 解析正则边界。
4. 最多主动修复 3 次，仍失败则标记阻塞并继续其他不依赖它的任务。

## 7. 完成标准与汇报

所有任务「已完成」后：

1. 运行最终验收命令（命令级，入场券）：`cd upstream && npm run typecheck -w @genoffice/sheets && npm run web:build -w @genoffice/sheets`（若 Phase 2 改动了解析逻辑，追加 `npm run compat -w @genoffice/sheets`）。
2. **执行 spec.md 第 5.2 节真实场景全套测试**：按环境准备表启动 relay + web 构建，用浏览器（或 Playwright headless，见 5.2 节"可用测试工具"）访问 `http://127.0.0.1:8787/sheets/?control=1&open=path:<测试文件>` 与不带 `control=1` 的对照 URL，按 2.3 节四条流程脚本逐条回放主路径和失败分支，把截图/console/基线数据保存到 5.2 矩阵写明的 `evidence/` 路径。执行矩阵有任何一行失败 = 未完成，回去修。
3. 重跑：`python3 <安装 prd-workflow skill 的路径>/scripts/validate_package.py docs/genoffice-sheets-web-fix`（若 Grok 环境没有这个 skill 目录，改为人工核对：真实场景任务标「已完成」时，5.2 矩阵引用的 evidence 路径必须真实存在于磁盘）。
4. 对照 spec.md 第 2 章逐条核对 BR-001~004 / UF-001~004 / INV-001~004 / EVD-001~005。
5. 对照 spec.md 第 5.4 节专项检查清单自检。
6. 输出最终总结：

```markdown
## 完成总结
- 完成范围：...
- 修改文件：...（列出 upstream/apps/sheets/ 下具体文件）
- 通过的 BR/UF：...（真实场景执行矩阵 N/N 行通过）
- 未破坏的不变量：...
- Evidence：docs/genoffice-sheets-web-fix/evidence/...
- Phase 2 性能优化结论：完成了哪一项 / 或为什么本轮判断暂不做
- 剩余风险：...
```

两个仓库分别 commit（编排层的 spec/tasks/evidence 状态更新一次；`upstream/` 的代码改动一次，因为它们是独立 git 历史）。
