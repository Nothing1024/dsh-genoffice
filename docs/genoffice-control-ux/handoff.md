# genoffice-control-ux Handoff

本文件是可直接交给 Codex / Claude / Generic Coding Agent 的交付 Prompt。你的目标不是"按文件改代码"，而是在不破坏业务不变量的前提下，完成 spec 定义的用户可见行为。

> 使用方式：把本文件完整粘贴给执行 Agent，或让 Agent 开工前先读本文件。
> 本文件只做入口导航，不复制 spec 内容；所有规则、任务、验收细节以 `spec.md` 为准。

## 1. 目标

升级 GenOffice 控制模式交互：保存不重挂 iframe（编辑状态保留）、写回冲突可另存副本、未保存指示与返回确认、补齐 pdf_open、*_open 无 GUI 秒级失败、relay 宕机一键拉起——横跨 contracts / relay(server.mjs) / 5 个 app 控制适配器 / dsh-tab-genoffice 插件四处镜像点。

## 2. 资料清单

| 资料 | 路径 | 状态 | 用途 |
|---|---|---|---|
| Spec（唯一事实源） | `~/workspace/dsh/genoffice/docs/genoffice-control-ux/spec.md` | found | 业务合同、技术方案、任务详情、验收协议 |
| Tasks CSV（状态板） | `~/workspace/dsh/genoffice/docs/genoffice-control-ux/tasks.csv` | found | 25 条任务状态跟踪 |
| Evidence 目录 | `~/workspace/dsh/genoffice/docs/genoffice-control-ux/evidence/` | found | 证据归档 |
| 跨侧契约 | `~/workspace/dsh/genoffice/contracts/{control-api.md,relay-api.md}` | found | 先改契约再动源码（INV-001） |
| 插件仓库 | `~/workspace/dsh/plugin/dsh-genoffice/plugin/packages/tab-genoffice/` | found | host 工具 + tab UI |

缺失资料与假设：

- ASM-002: relay 一键拉起依赖 `DSH_GENOFFICE_ROOT` 环境变量定位栈根（spec 1.4）。
- ASM-003: markdown/sheets/slides/pdf 的 dirty 精确 symbol 由 Task 2 校准后回写 spec 3.3。

## 3. 开工上下文

### 架构 Before / After

```text
Before: 保存成功 → 插件重挂 iframe（undo/滚动丢）＋ *_save 后 8s sync 窗口；
        conflict 只能丢弃编辑；无 dirty 指示；pdf 无 *_open；relay down 只有手动命令。
After:  relay 写回成功 → 响应带 mtimeMs + SSE saved 事件刷新适配器基线 → 插件不重挂
        （旧 relay 无 mtimeMs → 自动回退重挂，INV-003）；
        conflict 增「另存为副本」（export saveAs, wx 不覆盖）；
        适配器 postMessage dirty → tab 标题 ● + 按钮高亮 + 返回确认；
        pdf_open 补齐 / subscribers=0 秒级失败 / host 路由 spawn start-relay。
```

### Phase 地图

```text
P0 契约与校准 ──→ P1 保存不重挂 ──→ P2 冲突另存副本 ──┐
                     │                                ├──→ P5 真实场景全套测试 + 收尾
                     ├──→ P3 未保存指示 ──────────────┤
                     └──→ P4 agent 侧补齐 ────────────┘
```

### 最关键规则（Top 10，全量见 spec.md 第 2 章）

- BR-001: export 成功响应带 mtimeMs → 插件不得重挂 iframe（undo/滚动保留）。
- BR-002: saved 事件只在写回成功后推，适配器以之为新基线，连续保存不 conflict。
- BR-003: saveAs 用 wx 原子创建，目标存在 → `exists`，两侧文件均不变。
- BR-004: dirty 指示以编辑器真实状态为源，保存/重载后清除。
- BR-005: pdf_open 与既有 *_open 行为完全一致。
- BR-006: subscribers=0 时 *_open 秒级失败，不进 20s 轮询。
- BR-007: 「启动 relay」仅在 DSH_GENOFFICE_ROOT 配置时可用，≤10s health 否则报错。
- INV-001: 先改 contracts/ 再镜像源码，`node scripts/dev.mjs smoke` 全绿。
- INV-003: 新旧组合（新插件+旧 relay、新 relay+旧 dist）必须回退现状，禁止保存必 conflict。
- INV-004: 控制面 89 工具逐名不变；*_open 4→5 只增不改。

### 禁止事项

- 不得为了通过测试删除现有业务分支。
- 不得绕过 loopback 安全边界（INV-002）。
- 不得只修改 mock/fixture，不修改真实路径。
- 不得把失败状态吞掉（conflict/exists/timeout 都要到 UI/工具输出）。
- 不得只按行号修改；必须用 symbol/rg anchor 校验（三段式定位见 spec.md 第 3.3 节）。
- 不得只实现组件/函数而不接线到真实入口——接线清单见 spec.md 第 2.3 节各 UF。
- 不得跳过交互反馈（loading、禁用、错误提示、成功反馈）；它们是需求本体。
- 不得只跑单测就宣称完成——完成的唯一标准是 spec.md 第 5.2 节真实场景全套测试。
- 不得在 conflict/失败分支推送 saved 事件（BR-002 反例）。

## 3.5 运行位置与写入边界（防越界）

**运行目录**：`~/workspace/dsh`（两仓公共祖先；本文件与 spec 的全部路径以此可达）。tasks.csv 备注列已标注每条任务的仓库归属。

**两仓与写入白名单**（超出白名单的写入 = 越界，必须先在状态板备注登记原因）：

| 仓库（{仓} = 该仓根目录） | 允许写入 | 明确禁止 |
|---|---|---|
| 插件 `~/workspace/dsh/plugin/dsh-genoffice/plugin`（独立 git；`~/workspace/dsh/genoffice` 是兼容入口） | `{插件}/packages/tab-genoffice/{src,tests}/**`、`{插件}/packages/tab-genoffice/README.md`、`{插件}/packages/tab-genoffice/lib/**`（仅经 `pnpm run build` 生成）、`{插件}/contracts/{control-api.md,relay-api.md}`、`{插件}/scripts/dev.mjs`、`{插件}/docs/genoffice-control-ux/**` | `{插件}/env/`、`{插件}/docs/` 下其他任务包、同目录邻居 `~/workspace/dsh/plugin/{session-tool,vibee}` |
| 上游 `~/workspace/dsh/plugin/dsh-genoffice/upstream`（独立 git 仓；origin = genspark-ai/genoffice） | `{上游}/web/server.mjs`、`{上游}/web/e2e-*.mjs`、`{上游}/apps/{docs,markdown,sheets,slides,pdf}/src/renderer/`（control.ts、App.tsx 及 Task 2 校准登记的 dirty 接线文件）、`{上游}/apps/*/web-dist/**`（仅经 `npm run web:build` 生成） | `{上游}/ee/`、`{上游}/packages/`、`{上游}/apps/shell/`、其余一切未登记文件 |

**Commit 边界**：每完成一个 Phase，在**被改动的仓库各自** commit（两仓互不混提），message 带 `genoffice-control-ux` 前缀与任务号。

**收工审计**（每 Phase 回归时执行并存入 evidence）：

```bash
for d in ~/workspace/dsh/plugin/dsh-genoffice/plugin ~/workspace/dsh/plugin/dsh-genoffice/upstream; do echo "== $d"; git -C "$d" status --short; done
```

输出中出现白名单外路径 = 越界，先回滚该文件再继续。

## 4. 开工前初始化

1. **前提检查（硬性）**：运行上面的两仓审计命令，两仓工作区必须干净（既有改动已由用户提交）。不干净 → 停下报告，**不得替用户提交或丢弃他的未提交改动**。
2. 通读 `spec.md` 第 1、2 章（事实基线 + 业务合同，重点读 2.3 节流程脚本）。
3. 预读 spec.md 第 5 章验收协议——先知道完成标准（5.2 真实场景测试），再开工。
4. 打开状态板 `tasks.csv`，结合第 4 章找到第一条可执行任务（Task 1/Task 2 无前置，可并行）。
5. 运行基线命令：`cd ~/workspace/dsh/genoffice && node scripts/dev.mjs start-relay && node scripts/dev.mjs smoke`（应全绿）＋ `cd ~/workspace/dsh/plugin/dsh-genoffice/plugin && pnpm vitest run`（基线 109 全过）。

## 5. 核心执行循环

```text
WHILE 存在待开始或进行中的任务:
    1. 找到下一条前置任务已完成的任务
    2. 读 spec.md 第 4 章对应 Task 详情
    3. 回答：关联 BR/UF/INV/EVD 是什么？哪些行为不能变？
    4. 状态板更新为「进行中」
    5. 按三段式定位校验文件位置
    6. 执行具体操作
    7. 运行验证命令并保存 evidence
    8. 通过 → 状态「已完成」；失败 → 排障，最多主动修复 3 次
    9. 仍失败 → 标记「已阻塞:{原因}」，继续不依赖该任务的后续任务
   10. Phase 回归通过后，输出 Phase summary（模板见 evidence/README.md），再进入下一 Phase
```

不要中途问"是否继续"。除非所有剩余任务都被阻塞，否则继续推进。

## 6. 排障顺序

1. 查 spec.md 第 4 章当前任务的注意事项（sheets 构建失败先看 vite alias 拼接坑，Task 8 注）。
2. 查 spec.md 第 2 章关联 BR/UF/INV。
3. 按错误类型定位：契约漂移（smoke FAIL）→ contracts 与镜像点；构建 → vite.web.config alias；插件 → vitest mock 形状。
4. 最多主动修复 3 次，仍失败则阻塞并继续其他任务。

## 7. 完成标准与汇报

所有任务「已完成」后：

1. 运行最终验收命令（命令级，入场券）：`cd ~/workspace/dsh/genoffice && node scripts/dev.mjs smoke && cd ~/workspace/dsh/plugin/dsh-genoffice/plugin && pnpm vitest run`。
2. **执行 spec.md 第 5.2 节真实场景全套测试**：启动真实应用，按 2.3 节流程脚本逐条回放主路径和失败分支，保存截图/console/API 样例到 5.2 矩阵写明的 `evidence/` 路径。执行矩阵有任何一行失败 = 未完成，回去修。
3. 重跑 `python3 ~/.agents/skills/prd-workflow/scripts/validate_package.py ~/workspace/dsh/genoffice/docs/genoffice-control-ux`——证据审计 FAIL 不得宣称完成。
4. 对照 spec.md 第 2 章逐条核对 BR/UF/INV/EVD。
5. 对照 spec.md 第 5.4 节专项检查清单自检（含入口接线可达性）。
6. 输出最终总结：

```markdown
## 完成总结
- 完成范围：...
- 修改文件：...
- 通过的 BR/UF：...（真实场景执行矩阵 N/N 行通过）
- 未破坏的不变量：...
- Evidence：evidence/...
- 剩余风险：...
```
