# upstream-sync-v011 Handoff

本文件是可直接交给 Claude Coding Agent 的交付 Prompt。你的目标不是"按文件改代码"，而是在不破坏业务不变量的前提下，完成 spec 定义的用户可见行为。

> 使用方式：把本文件完整粘贴给执行 Agent，或让 Agent 开工前先读本文件。
> 本文件只做入口导航，不复制 spec 内容；所有规则、任务、验收细节以 `spec.md` 为准。
> 路径纪律：包内文件（spec.md、tasks.csv、evidence/）写相对包目录的路径；源码文件写相对仓库根的路径；禁止绝对路径。
> 所有命令都在**仓库根目录**（插件仓）执行；包目录相对仓库根写作 `docs/upstream-sync-v011`。引擎仓是并列目录，工作区为合并 worktree `../engine-sync`。

## 1. 目标

把魔改 GenOffice 引擎升级到官方 `upstream/main`，保住侧栏实时编辑体验，修掉 relay 跨站写盘漏洞，并让插件已暴露的全部工具在新引擎上真实可用（旧工具内部改写、新建 PPT 走官方 MCP、同步后新工具需评审）。

## 1.1 执行环境假设

| 项 | 假设 |
|---|---|
| 执行环境 | claude |
| 浏览器工具 | 可假设有浏览器与截图工具，5.2 走自动回放并直接落盘 evidence；隔离回放用引擎自带 Playwright |
| 长命令策略 | 正常执行；引擎全量测试约 10 分钟、web:build 约 2 分钟，放后台并等待结果 |
| 验证命令输出 | 期望摘要即可 |

## 2. 资料清单

| 资料 | 路径 | 状态 | 用途 |
|---|---|---|---|
| Spec（唯一事实源） | `spec.md` | found | 业务合同、技术方案、任务详情、验收协议 |
| Tasks CSV（状态板） | `tasks.csv` | found | 任务状态跟踪（唯一状态板） |
| Evidence 目录 | `evidence/` | found | 证据归档 |
| 引擎同步规则 | `../engine-sync/CLAUDE.md` | found（已暂存未提交） | 同步官方后的工具评审规则 |
| 插件 agent 规则 | `AGENTS.md` | found（未提交改动） | DSH 环境与共享配置约束 |

包工具：下文 `$SPEC_SKILL` 指执行机上 spec-workflow skill 的目录（常见 `~/.claude/skills/spec-workflow` 或 `~/.agents/skills/spec-workflow`，按执行机实际查找，不要写死）。其中 scripts/board.py 看进度与可开工任务，scripts/validate_package.py 做包校验。执行机上没有该 skill 时：状态板直接读 tasks.csv；校验改为人工核对 5.2 执行矩阵的 evidence 路径逐条落盘，并在完成总结中注明"未跑校验脚本"。

缺失资料与假设：

- ASM-001: git 提交身份未配置，需用户提供 → Task 1 先确认，未给则提交类任务阻塞。
- ASM-002: relay 同源检查（安全改动）未获用户明确同意 → Task 1 先确认，未同意则 Task 3、Task 4 暂缓。
- ASM-003: 已开放工具参数变化时的处理方式 → Task 14 实现前确认。
- ASM-004: 分支快进、推送与 main 跟踪调整 → Task 18 前确认。
- ASM-005 / ASM-006: 见 spec.md 1.4 节。

## 3. 开工上下文

> spec 第 4 章变化（含 review 追加 Phase-Fix）或第 2 章关键规则变化时，必须同步刷新本节。

### 架构 Before / After

```text
Before: agent ─ 插件 101 条手写工具 ─ relay(无 Origin 校验) ─ iframe 编辑器(fork 基线)
After:  agent ─ 插件（工具名不变）
          ├─ 编辑类 ─ 改写层(18 旧工具→apply_ops) ─ relay(Origin/Type 校验) ─ iframe 编辑器(官方最新 + dsh-control)
          └─ pptx_create ─ 内部 MCP 客户端 ─ genoffice mcp(引擎自建 CLI)
```

### Phase 地图

```text
P0 前置与基线(Task 1-2) → P1 安全与已知缺陷(Task 3-5) → P2 官方上游合并(Task 6-9)
→ P3 插件兼容与 MCP(Task 10-15) → P4 验收与收尾(Task 16-18)
```

### 最关键规则（最多 10 条，全量见 spec.md 第 2 章）

- BR-001: 引擎包含 `upstream/main` 全部历史，魔改只在 fork 自有文件与最小接入点。
- BR-002: 已暴露工具真实可用；18 个官方已删旧工具保留原名，由插件改写为 `apply_ops`。
- BR-003: relay 拒绝跨站写请求（非本机 Origin 或非 JSON Content-Type）。
- BR-004: 编辑器保存必须带版本校验，不再 `overwrite: true`。
- BR-005: `pptx_create` 改走内部 MCP `create_pptx`，行为与原来一致。
- BR-006: 官方新增编辑器工具未登记 `CAPABILITY` 不注册；评审脚本列三类变化。
- BR-007: MCP 写入目标正在侧栏打开时拒绝。
- BR-008: sheets 保存不得误报冲突。
- INV-001: 控制模式编辑只在内存生效，磁盘只在显式保存时变化。
- INV-006: 用户原工作区 `../engine` 在收尾前不被修改。

### 禁止事项

- 不得为了通过测试删除现有业务分支。
- 不得绕过权限判断。
- 不得只修改 mock/fixture，不修改真实路径。
- 不得把失败状态吞掉。
- 不得只按行号修改；必须用 symbol/rg anchor 校验（三段式定位见 spec.md 第 3.3 节）。
- 不得只实现组件/函数而不接线到真实入口——接线清单见 spec.md 第 2.3 节。
- 不得跳过交互反馈（loading、禁用、错误提示、成功反馈）；它们是需求本体。
- 不得只跑单测就宣称完成——完成的唯一标准是 spec.md 第 5.2 节真实场景全套测试。
- 不得推送官方仓库，不得修改全局 git 配置，不得编造提交身份。
- 不得在用户未同意时停止用户正在运行的 :8787 relay。
- e2e 必须带 `--out docs/upstream-sync-v011/evidence/...`，不得覆盖其他任务包的 evidence。

## 4. 开工前初始化（一次性）

1. 通读 `spec.md` 第 1、2 章（事实基线 + 业务合同，重点读 2.3 节流程脚本）。
2. 预读 spec.md 第 5 章验收协议——先知道完成标准（5.2 真实场景测试），再开工。
3. 看进度与可开工任务：`python3 $SPEC_SKILL/scripts/board.py docs/upstream-sync-v011`（没有 skill 时直接读 tasks.csv）。
4. 结构闸门：`python3 $SPEC_SKILL/scripts/validate_package.py docs/upstream-sync-v011` 必须 0 FAIL 才开工；有 FAIL 先按第 6.1 节修包，不许带病执行。
5. 运行 `git status` 与 `git -C ../engine-sync status --short` 确认工作区为已知状态（合并已暂存、`AGENTS.md` 有改动属于预期）。
6. 运行基线命令：`git -C ../engine-sync diff --cached --shortstat && npm --prefix ../engine-sync run typecheck`。
7. 把 spec.md 顶部 `Status` 改为 `InProgress 执行中`（已是 InProgress 则跳过）。

## 5. 核心执行循环

```text
WHILE 存在可开工任务（前置已满足的待开始任务）:
    1. 取第一条可开工任务（有 skill 时用 board.py --next；前置任务以 tasks.csv 为准）
    2. tasks.csv 该行改「进行中」——立即写盘，不批量刷
    3. 锚点级读取：只读 spec.md 第 4 章该 Task 的段落 + 其关联 BR/UF/INV/EVD 的定义行，
       不重读全文；验证命令以该段落的「验证」行为准，CSV 那列只是摘要
    4. 回答：关联 BR/UF/INV/EVD 是什么？哪些行为不能变？
    5. 按三段式定位校验文件位置；行号漂移以 symbol + rg anchor 为准，漂移记入状态板备注列
    6. 执行具体操作
    7. 运行验证命令（任务验证行带「Phase 出口检查」的，一并执行），evidence 按任务要求落盘
    8. 通过 → 状态「已完成」；失败 → 排障，最多主动修复 3 次
    9. 仍失败 → 标记「已阻塞:{原因}」，继续不依赖该任务的后续任务
   10. commit：一个语义单元一次，message 格式 `<scope>: <做了什么>` 且点名条目 ID
       （如 `tasks: Task-10 完成旧工具改写层`；禁止"更新文档""phase N complete"）；
       引擎仓提交用 Task 1 确认的身份
   11. 一个 Phase 的最后一条任务完成 → 输出 Phase summary 到 evidence/phase-{N}/，再进入下一 Phase
```

不要中途问"是否继续"。除非所有剩余任务都被阻塞，否则继续推进。用户明确说本轮不做的任务标「暂缓:{原因}」，不算阻塞。需要用户决策的点只有 ASM-001~ASM-004，按对应任务的操作步骤询问一次。

到达「执行 spec 5.2 真实场景全套测试」任务时：先核对 5.2 环境准备表（启动命令 / 访问入口 / 工具），按第 1.1 节执行环境假设自动回放；执行矩阵**逐行**回放，evidence 存到矩阵 Evidence 列写明的路径。全部回放完后，**先把该任务标「已完成」，再重跑校验脚本**——证据审计只在任务标完成后才触发；报证据缺失或空文件就改回「进行中」，补齐后再标。

## 6. 排障顺序

1. 查 spec.md 第 4 章当前任务的注意事项。
2. 查 spec.md 第 2 章关联 BR/UF/INV。
3. 按错误类型定位：import（官方模块迁移到 `packages/pptx-ops`、`packages/pipelines`）、类型、跨站检查误伤、revision 冲突、iframe 未就绪、MCP 进程。
4. 最多主动修复 3 次，仍失败则阻塞并继续其他任务。

### 6.1 发现 spec 本身有错

不许在代码里就地打补丁绕过。按顺序：改 spec 第 2 章（BR/UF/INV/EVD，Version +0.1，1.5 节记变更）→ 列出受影响任务 → tasks.csv 同步（受影响的「已完成」回退为「待开始」并注明原因）→ 刷新本文件第 3 节 → 重跑校验脚本 → 继续执行循环。

## 7. 收尾与汇报

tasks.csv 全部「已完成」或「暂缓」后（含 review 追加的 Phase-Fix），做一次收尾。5.2 已由最后 Phase 的真实场景任务执行过，收尾**不重跑 5.2 全套**：

1. 确认最后 Phase 的「执行 spec 5.2 真实场景全套测试」「执行最终回归验证」两条任务都是「已完成」。
2. 本轮做过 Phase-Fix 时：按 review-report.md 中对应 BUG 的复现步骤逐条复核，把结论回写 review-report 的问题清单与第 0 节结论（只复核这些项，不整包重审）。
3. 对照 spec.md 第 2 章逐条核对 BR/UF/INV/EVD，对照第 5.4 节专项检查清单自检（含入口接线可达性）。
4. 全部通过 → spec.md 顶部 `Status` 改为 `Done 已验收`；有未通过项 → 把对应任务改回「进行中」或「已阻塞:原因」，Status 保持 `InProgress`。
5. 重跑 `python3 $SPEC_SKILL/scripts/validate_package.py docs/upstream-sync-v011` → 0 FAIL。
6. 执行期间 spec 第 4 章变过（含追加 Phase-Fix）→ 刷新本文件第 3 节 Phase 地图。
7. 输出最终总结：

```markdown
## 完成总结
- 完成范围：...
- 修改文件：...
- 通过的 BR/UF：...（真实场景执行矩阵 N/N 行通过）
- 未破坏的不变量：...
- Evidence：evidence/...
- 暂缓项：...（没有则写"无"）
- 剩余风险：...
```
