# genoffice-dsh-control Handoff

本文件是可直接交给 Codex / Claude / Generic Coding Agent 的交付 Prompt。你的目标不是"按文件改代码"，而是在不破坏业务不变量的前提下，完成 spec 定义的用户可见行为。

> 使用方式：把本文件完整粘贴给执行 Agent，或让 Agent 开工前先读本文件。
> 本文件只做入口导航，不复制 spec 内容；所有规则、任务、验收细节以 `spec.md` 为准。

## 1. 目标

让 DSH（DeepSeek Harness）控制 GenOffice 的 docs/markdown 文档编辑：DSH agent 通过 `docx:*`/`markdown:*` 工具驱动浏览器内编辑器执行块级编辑（AI 大脑归 DSH），GenOffice 网页版在控制模式下不再显示内嵌 AI 助手；编辑内容可显式写回原文件。三仓库：`upstream/`（GenOffice 本体）、`plugin/dsh-artifact/`（DSH 插件）、栈根（契约/脚本）。

## 2. 资料清单

| 资料 | 路径 | 状态 | 用途 |
|---|---|---|---|
| Spec（唯一事实源） | `spec.md` | found | 业务合同、技术方案、任务详情、验收协议 |
| Tasks CSV（状态板） | `tasks.csv` | found | 24 条任务状态跟踪 |
| Evidence 目录 | `evidence/` | found | 证据归档（已建骨架） |

缺失资料与假设：

- ASM-001~ASM-008 见 spec 第 1.4 节（拓扑/上游竞合/评审归属/写回策略/面板拆除方式/工具命名/会话绑定/传输通道）。**开工前请重读**，若有异议先与需求方确认再动工。

## 3. 开工上下文

### 架构 Before / After

```text
Before:
DSH GUI ── iframe(open=path:) ──► relay:8787（只读: dir/file/search）
   └─ 预览副本; 保存=下载; AI dock 内嵌(BYOK)

After:
DSH agent ── docx:*/markdown:* 工具 ──► plugin host ──► relay 控制面(HTTP+SSE) ──► iframe 适配器 ──► Tiptap
   │                                                     └── POST /api/file（写回, tmp+rename）──► 原文件
   └─ GenOffice tab（control=1）: 无 AI dock
```

### Phase 地图

```text
P0 基线与契约 ──► P1 relay 控制面 ──► P2 app 控制适配器 ──► P3 去 AI 助手 ──► P4 DSH 插件工具与接线 ──► P5 端到端验收
```

### 最关键规则（Top 10，全量见 spec.md 第 2 章）

- BR-001: `control=1` 才进控制模式；无该参数行为与现状完全一致
- BR-002: 工具调用形状 `{id,name,input}` → 返回 `{output,isError,mutated,summary}`；非法输入不执行
- BR-003: 执行器按 docId 注册/注销；未注册 → `executor not registered`
- BR-004/005: 写回 tmp+rename 原子、loopback-only；失败不破坏原文件
- BR-006: 控制模式下 AI 助手（dock/快捷按钮）整体不可见
- BR-008: 编辑工具只改 iframe 内状态；写回仅由显式动作触发（保存按钮 / `docx:save`）
- BR-010: 控制调用带 deadline，超时不重放
- INV-001: 非控制模式零回归（AI dock 照常、保存=下载）
- INV-004: 契约单一事实源（Task 2 创建于栈根 contracts/ 目录，开工前不存在），四处镜像点同步 + smoke 断言
- INV-005: 所有文档变更必须经编辑器（executeTool/Tiptap dispatch），禁止绕过编辑器直接改文件

### 禁止事项

- 不得为了通过测试删除现有业务分支。
- 不得绕过权限判断（写回/控制面仅 loopback，INV-002）。
- 不得只修改 mock/fixture，不修改真实路径。
- 不得把失败状态吞掉（未注册/超时/冲突/解析错误都要显式返回）。
- 不得只按行号修改；必须用 symbol + grep anchor 校验（三段式定位见 spec.md 第 3.3 节）。
- 不得只实现组件/函数而不接线到真实入口（入口接线清单见 spec.md 第 2.3 节）。
- 不得跳过交互反馈（保存按钮 loading/禁用/错误提示/成功反馈是需求本体）。
- 不得只跑单测/静态 review 就宣称完成——完成的唯一标准是 spec.md 第 5.2 节真实场景全套测试。
- 不得为过类型检查放宽类型；不得放松 iframe sandbox（INV-006）。
- 不得引入 WebSocket 依赖替代 SSE 下行（ASM-008：保持 relay 零依赖，除非显式更新假设并获需求方同意）。

## 4. 开工前初始化

1. 通读 `spec.md` 第 1、2 章（事实基线 + 业务合同，重点读 2.3 节流程脚本）。
2. 预读 spec.md 第 5 章验收协议——先知道完成标准（5.2 真实场景测试），再开工。
3. 打开 `tasks.csv`，结合 spec 第 4 章找到第一条可执行任务（Task 1）。
4. 运行 `git status` 确认工作区状态（三仓库：栈根 / `upstream/` / `plugin/dsh-artifact/`；plugin 有与本需求无关的预先未提交改动，不要动）。
5. 运行基线命令：`cd /Users/nothing/workspace/dsh/genoffice && node scripts/dev.mjs status && node scripts/dev.mjs smoke`。

## 5. 核心执行循环

```text
WHILE 存在待开始或进行中的任务:
    1. 找到下一条前置任务已完成的任务
    2. 读 spec.md 第 4 章对应 Task 详情
    3. 回答：关联 BR/UF/INV/EVD 是什么？哪些行为不能变？
    4. 状态板更新为「进行中」
    5. 按三段式定位校验文件位置（symbol + grep anchor）
    6. 执行具体操作
    7. 运行验证命令并保存 evidence（evidence/ 结构与命名见 spec 5.3）
    8. 通过 → 状态「已完成」；失败 → 排障，最多主动修复 3 次
    9. 仍失败 → 标记「已阻塞:{原因}」，继续不依赖该任务的后续任务
   10. Phase 回归通过后，输出 Phase summary（模板见 evidence/README.md），再进入下一 Phase
```

不要中途问"是否继续"。除非所有剩余任务都被阻塞，否则继续推进。

## 6. 排障顺序

1. 查 spec.md 第 4 章当前任务的注意事项。
2. 查 spec.md 第 2 章关联 BR/UF/INV。
3. 按错误类型定位：import、类型、权限、API、数据、UI 状态、构建缓存（rev 缓存陷阱：改 bundle 后必须重启 3099 实例）。
4. 最多主动修复 3 次，仍失败则阻塞并继续其他任务。

## 7. 完成标准与汇报

所有任务「已完成」后：

1. 运行最终验收命令（命令级，入场券）：`node scripts/dev.mjs smoke`（栈根）+ `cd plugin && npm run build && npm run typecheck` + `cd upstream && npm run web`。
2. **执行 spec.md 第 5.2 节真实场景全套测试**：启动 relay 与 3099 实例，按 2.3 节流程脚本逐条回放主路径和失败分支（执行矩阵 16 行），保存截图/console/API 样例到矩阵写明的 `evidence/` 路径。执行矩阵有任何一行失败 = 未完成，回去修。
3. 重跑 `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py /Users/nothing/workspace/dsh/genoffice/docs/genoffice-dsh-control`——它会审计真实场景任务的证据是否落盘（evidence 缺失 = FAIL，不得宣称完成）。
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
