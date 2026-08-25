# genoffice-dsh-office Handoff

本文件是可直接交给 Codex / Claude / Generic Coding Agent 的交付 Prompt。你的目标不是"按文件改代码"，而是在不破坏业务不变量的前提下，完成 spec 定义的用户可见行为。

> 使用方式：把本文件完整粘贴给执行 Agent，或让 Agent 开工前先读本文件。
> 本文件只做入口导航，不复制 spec 内容；所有规则、任务、验收细节以 `spec.md` 为准。

## 1. 目标

把 DSH 对 GenOffice 的控制从 M0（docs/markdown，已交付于 `../genoffice-dsh-control/`）扩展到**全套件**：sheets(xlsx)/slides(pptx)/pdf 接入同一控制契约，DSH agent 可编辑/标注并显式写回原文件；控制模式下三 app 无内嵌 AI 助手。

## 2. 资料清单

| 资料 | 路径 | 状态 | 用途 |
|---|---|---|---|
| Spec（唯一事实源） | `spec.md` | 已生成 | 业务合同、技术方案、任务详情、验收协议 |
| Tasks CSV（状态板） | `tasks.csv` | 已生成 | 24 条任务状态跟踪 |
| Evidence 目录 | `evidence/` | 骨架已建 | 证据归档（结构见 evidence/README.md） |
| M0 参照实现 | `../genoffice-dsh-control/` | 已交付 | 控制契约/适配器/工具/验收全套可参照（含 evidence） |

缺失资料与假设：

- ASM-001~006 见 spec 第 1.4 节（三 app Web 化策略、工具名前缀、去 AI 模式、保存语义、会话绑定、安全边界）。**开工前请重读**，P0 的 Task 2 会把 ASM-001/004 定稿。
- 三 app 的 Web 化缺口（slidesApi 245 处、xlsx 读写后端、pdf 管线）是最大未知，Task 1 勘察后定稿，**不得跳过勘察直接实现**。

## 3. 开工上下文

### 架构 Before / After

```text
Before（M0 之后）:
DSH agent ── docx_*/markdown_* 工具 ──► relay 控制面（app ∈ {docs, markdown}）
   └─ sheets/slides/pdf 未 Web 化：列表置灰"仅桌面版可用"

After:
DSH agent ── xlsx_*/pptx_*/pdf_* 工具 ──► relay 控制面（app ∈ {docs, markdown, sheets, slides, pdf}）
   ├─ sheets iframe：Univer 引擎 + 控制适配器（xlsx 读写按 P0 决议）
   ├─ slides iframe：slidesApi 浏览器实现面 + 控制适配器（核心编辑子集）
   └─ pdf iframe：pdf.js 渲染 + 标注/文本编辑层 + 控制适配器
   三 app control=1 均无 AI 助手；写回统一 POST /api/file（tmp+rename）
```

### Phase 地图

```text
P0 基线与勘察 ──► P1 契约与控制面扩展 ──► P2 sheets 接入 ──► P3 slides 接入 ──► P4 pdf 接入 ──► P5 去 AI 与插件收尾 ──► P6 端到端验收
```

### 最关键规则（Top 10，全量见 spec.md 第 2 章）

- BR-001: `control=1` 才进控制模式；无该参数行为与桌面版完全一致
- BR-002: 工具调用形状 `{id,name,input}` → `{output,isError,mutated,summary}`；非法输入不执行
- BR-003: 执行器按 docId 注册/注销（app 维度）；未注册 → `executor not registered`
- BR-004/005: 写回 tmp+rename 原子、loopback-only；失败不破坏原文件
- BR-006: 控制模式下 AI 助手（dock/快捷按钮）整体不可见
- BR-007: 工具名集合镜像：`xlsx_*`/`pptx_*`/`pdf_*` ↔ 契约 ↔ skill AGENT_TOOLS ↔ smoke 断言
- BR-008: 编辑工具只改 iframe 内状态；写回仅由显式动作触发（保存按钮 / `*_save` 工具）
- BR-009: 格式保真：xlsx/pptx 重打包与 pdf 标注产物必须可被桌面版/Office 打开且不破坏内容
- BR-010: 控制调用带 deadline，超时不重放
- INV-001: 非控制模式零回归（AI 助手照常、保存=下载）；INV-004: 契约单一事实源四处镜像同步

### 禁止事项

- 不得为了通过测试删除现有业务分支。
- 不得绕过权限判断（写回/控制面仅 loopback，INV-002）。
- 不得只修改 mock/fixture，不修改真实路径。
- 不得把失败状态吞掉（未注册/超时/冲突/解析错误/未覆盖方法都要显式返回）。
- 不得只按行号修改；必须用 symbol + grep anchor 校验（三段式定位见 spec.md 第 3.3 节）。
- 不得只实现组件/函数而不接线到真实入口（入口接线清单见 spec.md 第 2.3 节）。
- 不得跳过交互反馈（保存按钮 loading/禁用/错误提示/成功反馈是需求本体）。
- 不得只跑单测/静态 review 就宣称完成——完成的唯一标准是 spec.md 第 5.2 节真实场景全套测试。
- 不得为过类型检查放宽类型；不得放松 iframe sandbox（INV-006）。
- 不得跳过 Task 1 勘察直接猜测 Web 化方案（slidesApi 方法清单必须来自实际 grep）。

## 4. 开工前初始化

1. 通读 `spec.md` 第 1、2 章（事实基线 + 业务合同，重点读 2.3 节流程脚本）。
2. 预读 spec.md 第 5 章验收协议——先知道完成标准（5.2 真实场景测试），再开工。
3. 打开 `tasks.csv`，结合 spec 第 4 章找到第一条可执行任务（Task 1）。
4. 运行 `git status` 确认工作区状态（三仓库：栈根 / `upstream/` / `plugin/dsh-artifact/`）。
5. 运行基线命令：`cd /Users/nothing/workspace/dsh/genoffice && node scripts/dev.mjs status && node scripts/dev.mjs smoke`。
6. 参考 M0 交付物：`../../contracts/control-api.md`（扩展对象）与 `evidence/`（验收样例）。

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
4. 对照 M0 实现（`../genoffice-dsh-control/`）——三 app 适配器/工具/接线均沿用 M0 模式。
5. 最多主动修复 3 次，仍失败则阻塞并继续其他任务。

## 7. 完成标准与汇报

所有任务「已完成」后：

1. 运行最终验收命令（命令级，入场券）：`node scripts/dev.mjs smoke`（栈根）+ `cd plugin && npm run build && npm run typecheck` + `cd upstream && npm run web`。
2. **执行 spec.md 第 5.2 节真实场景全套测试**：启动 relay 与 3099 实例，按 2.3 节流程脚本逐条回放主路径和失败分支（执行矩阵 16 行），保存截图/console/API 样例到矩阵写明的 `evidence/` 路径。执行矩阵有任何一行失败 = 未完成，回去修。
3. 重跑 `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/genoffice-dsh-office`——它会审计真实场景任务的证据是否落盘（evidence 缺失 = FAIL，不得宣称完成）。
4. 对照 spec.md 第 2 章逐条核对 BR/UF/INV/EVD（重点 BR-009 格式保真：三 app 写回产物过桌面版/Office 打开校验）。
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
