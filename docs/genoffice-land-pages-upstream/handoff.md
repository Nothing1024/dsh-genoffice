# genoffice-land-pages-upstream Handoff

本文件是可直接交给 Codex / Claude / Generic Coding Agent 的交付 Prompt。你的目标不是"按文件改代码"，而是在不破坏业务不变量的前提下，完成 spec 定义的用户可见行为。

> 使用方式：把本文件完整粘贴给执行 Agent，或让 Agent 开工前先读本文件。
> 本文件只做入口导航，不复制 spec 内容；所有规则、任务、验收细节以 `spec.md` 为准。
>
> **本包只改上游 GenOffice**（`upstream/` + `contracts/` + `scripts/dev.mjs`）。禁止改 DSH `plugin/`。插件接线是另一份包 `../genoffice-land-pages-plugin/`。

## 1. 目标

在 slides 控制模式增加可调用原语 `land_pages`：宿主提交 `PageSpec[]`，iframe 只落地。拆除控制模式 iframe BYOK。不实现 DSH 会话模型规划。

## 2. 资料清单

| 资料 | 路径 | 状态 | 用途 |
|---|---|---|---|
| Spec（唯一事实源） | `spec.md` | 已生成 | 业务合同、技术方案、任务、验收 |
| Tasks CSV | `tasks.csv` | 已生成 | 8 条任务 |
| Evidence | `evidence/` | 骨架已建 | 见 `evidence/README.md` |
| 控制契约 | `../../contracts/control-api.md` | 已有，待加 land_pages | 镜像 |
| 兄弟包 | `../genoffice-land-pages-plugin/` | 并行可写，验收依赖本包合并 | 不要在本仓实现 DSH host |

缺失资料与假设：ASM-001~005 见 spec 第 1.4 节。开工前重读。

## 3. 开工上下文

### 架构 Before / After

```text
Before: generate_deck(topic) → iframe BYOK LLM → localGeneratePage
After:  land_pages(pages) → parsePageSpec → buildPagePptx → htmlToPptx
        generate_deck(topic-only, control) → isError pages_spec required
```

`localGeneratePage` / `webHtmlToPptx` 已存在。缺工具名和去 LLM。定位见 spec 第 3.3 节。

### Phase 地图

```text
P0 契约 ──► P1 iframe 原语 ──► P2 curl 端到端
```

### 最关键规则（Top 10，全量见 spec.md 第 2 章）

- BR-001: 控制出片禁止 `getAiSettings` / `aiStream`
- BR-002: 新工具 `land_pages`，形状与现有 control tool 相同
- BR-003: 每页通过现有 `parsePageSpec`（1280×720）
- BR-004: 落地成功必须 `htmlGenerated=true`
- BR-006: 非法 spec 整批拒绝，稿面不变
- BR-007: 契约 + smoke pptx 38→39（插件表由兄弟包改）
- BR-008: 落地不写盘
- BR-009: topic-only → `control mode requires pages_spec; use land_pages`
- BR-010: insert_mode 对齐 `webHtmlToPptx`
- INV-006 / INV-007: 不放宽 scratch 阈值；不改 plugin/

### 禁止事项

- 不得改 `plugin/`（INV-007）。
- 不得实现 DSH `pptx_generate_deck` host LLM。
- 不得把 key 写入 iframe localStorage。
- 不得打开 gsk / `cloudGenStatus.enabled=true`。
- 不得放宽 `blockScratchBuild`。
- 不得新开 WebSocket / 新 HTTP 生成服务。
- 不得拆非控制 AiPanel `runAiStream`。
- 不得只按行号改；symbol + rg（spec 3.3）。
- 不得只跑单测宣称完成——完成标准是 spec 5.2 curl 矩阵。
- 不得中途问是否继续，除非全部任务阻塞。

## 4. 开工前初始化

1. 通读 `spec.md` 第 1、2 章（尤其 2.3 与 3.4 JSON）。
2. 预读第 5 章（5.2 curl，不跑 DSH generate_deck）。
3. 打开 `tasks.csv`，从 Task 1 开始。
4. `git status`：工作区 `upstream/`。
5. 栈根 `/Users/nothing/workspace/dsh/genoffice`：`node scripts/dev.mjs status`。改 slides 后必须 `npm run web:build` 并重启 8787。
6. 空白夹具复制一份再测：`/Users/nothing/workspace/dsh/plugin/session-tool/plugin/env/manual-view/空白演示文稿.pptx`。

## 5. 核心执行循环

```text
WHILE 存在待开始或进行中的任务:
    1. 找到下一条前置已完成的任务
    2. 读 spec.md 第 4 章对应 Task
    3. 回答关联 BR/UF/INV/EVD；哪些不能变
    4. 状态板 → 进行中
    5. 三段式定位
    6. 执行
    7. 验证并保存 evidence
    8. 通过 → 已完成；失败最多修 3 次
    9. 仍失败 → 已阻塞:原因，继续独立任务
   10. Phase 回归后写 summary，再下一 Phase
```

不要中途问"是否继续"。除非所有剩余任务都被阻塞，否则继续推进。

## 6. 排障顺序

1. 当前 Task 注意事项。
2. spec 第 2 章 BR/UF/INV。
3. 错误类型：
   - `web control mode has no local LLM` → 还在 `withLocalLlm` / 旧 web-dist
   - Genspark 登录句 → 8787 旧 slides 包
   - `executor not registered` → iframe 未 SSE
   - smoke 插件表 FAIL → 预期，交给插件包；契约必须已是 39
   - add_shape 仍 scratch → 未写 `skillStateCache.htmlGenerated`
4. 最多修 3 次，否则阻塞。

## 7. 完成标准与汇报

1. vitest（spec 5.1）+ 契约 rg。
2. **执行 spec 5.2 curl 矩阵**（UF-001~005）。任一行失败 = 未完成。
3. `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py /Users/nothing/workspace/dsh/genoffice/docs/genoffice-land-pages-upstream`
4. 对照第 2 章与 5.4。
5. 总结：

```markdown
## 完成总结
- 完成范围：...
- 修改文件：...（必须无 plugin/）
- 通过的 BR/UF：...（curl 矩阵 N/N）
- 未破坏的不变量：...
- Evidence：evidence/...
- 剩余风险：插件未注册 pptx_land_pages 时 smoke host 表可能仍红
```
