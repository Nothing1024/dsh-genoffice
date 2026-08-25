# genoffice-land-pages-plugin Handoff

本文件是可直接交给 Codex / Claude / Generic Coding Agent 的交付 Prompt。你的目标不是"按文件改代码"，而是在不破坏业务不变量的前提下，完成 spec 定义的用户可见行为。

> 使用方式：把本文件完整粘贴给执行 Agent，或让 Agent 开工前先读本文件。
> 本文件只做入口导航，不复制 spec 内容；所有规则、任务、验收细节以 `spec.md` 为准。
>
> **本包只改 DSH 插件**（`plugin/dsh-genoffice/plugin`）。禁止改 `upstream/apps/slides`。iframe `land_pages` 是另一份包 `../genoffice-land-pages-upstream/`。

## 1. 目标

让 DSH 像其他 `pptx_*` 一样调用落地：注册 `pptx_land_pages`；`pptx_generate_deck` 用**当前会话模型**写 `PageSpec[]` 再 land。禁止 iframe BYOK / 注入 key。

## 2. 资料清单

| 资料 | 路径 | 状态 | 用途 |
|---|---|---|---|
| Spec（唯一事实源） | `spec.md` | 已生成 | 业务合同、技术方案、任务、验收 |
| Tasks CSV | `tasks.csv` | 已生成 | 8 条任务 |
| Evidence | `evidence/` | 骨架已建 | 见 `evidence/README.md` |
| 兄弟包 | `../genoffice-land-pages-upstream/` | 必须先（或并行后）合并 iframe `land_pages` | 本包 5.2 依赖它 |
| 插件源 | `../../plugin/dsh-genoffice/plugin/packages/tab-genoffice/`（若从栈根）或工作区 `packages/tab-genoffice/` | 已有 | 改这里 |

缺失资料与假设：ASM-001~006 见 spec 第 1.4 节。开工前重读。上游未部署时 **Task 7 必须阻塞**，不得把 5.2 标完成。

## 3. 开工上下文

### 架构 Before / After

```text
Before: pptx_generate_deck(topic) → iframe generate_deck → no local LLM
After:  pptx_land_pages(pages) → iframe land_pages
        pptx_generate_deck(topic) → DSH session LLM → PageSpec[] → land_pages
```

定位见 spec 第 3.3 节。

### Phase 地图

```text
P0 探测与表 ──► P1 host 实现 ──► P2 DSH 端到端
```

### 最关键规则（Top 10，全量见 spec.md 第 2 章）

- BR-000: 上游 `land_pages` 未部署则 5.2 不得标完成
- BR-001: 禁止把 key 写入 iframe
- BR-002: 注册 `pptx_land_pages`，capability available
- BR-004: `pptx_generate_deck` 禁止 executeControl 到 iframe `generate_deck`
- BR-005: `pptx_regenerate_slide` 同样 host 写 spec / replace_at
- BR-006: 错误文案无「桌面版」
- BR-007: catalog 仍【不要主动触发】
- BR-008: 落地不写盘
- BR-010: 必须 rebuild `lib/index.js`
- INV-001 / INV-007: 不改 slides renderer；不回退 openTab scope 修复

### 禁止事项

- 不得改 `upstream/apps/slides`（去上游包）。
- 不得把 `.env` / DSH key 写入 iframe `localStorage`。
- 不得为通过测试把 topic-only 继续转给 iframe。
- 不得用 Python / ppt-image-first 代替本接口。
- 不得把 workflow 写回 system prompt；catalog 必须保留「【不要主动触发】」。
- 不得在错误文案写「用桌面版 GenOffice」。
- 不得只改 `capability.js` 不 rebuild。
- 不得在 BR-000 红时把 Task 7 标已完成。
- 不得只按行号改；symbol + rg（spec 3.3）。
- 不得只跑单测宣称完成——完成标准是 spec 5.2 DSH 矩阵。
- 不得中途问是否继续，除非全部任务阻塞。

## 4. 开工前初始化

1. 通读 `spec.md` 第 1、2 章（尤其 2.3、3.4 host 规划合同）。
2. 预读第 5 章。先做 Task 1 探测。
3. 打开 `tasks.csv`，从 Task 1 开始。
4. `git status`：插件仓 `plugin/dsh-genoffice/plugin`。
5. 基线：DSH `http://127.0.0.1:3080`；relay `http://localhost:8787/api/health`。
6. 空白夹具复制一份：`/Users/nothing/workspace/dsh/plugin/session-tool/plugin/env/manual-view/空白演示文稿.pptx`。
7. 确认 slides web-dist 含上游 `land_pages`（否则 E2E 阻塞）。改插件后必须 build **并重启** 3080（工具表有 rev 缓存）。

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
2. spec 第 2 章。
3. 错误类型：
   - `web control mode has no local LLM` → 仍转发 iframe generate_deck，或上游未短路
   - Genspark 登录句 → 8787 旧 slides 包（上游问题）
   - 未知工具 land_pages → 上游未合入 / 未 rebuild web-dist
   - DSH 看不到 pptx_land_pages → 未 build 或未重启 3080
   - add_shape 仍 scratch → 上游 htmlGenerated 未写（上游包）
4. 最多修 3 次，否则阻塞。上游缺失 → 标已阻塞，不要改 slides 源码。

## 7. 完成标准与汇报

1. `pnpm run build && pnpm run typecheck` + host 单测（spec 5.1）。
2. **执行 spec 5.2 DSH 矩阵**（UF-001~004）。BR-000 红 = 未完成。
3. `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py /Users/nothing/workspace/dsh/genoffice/docs/genoffice-land-pages-plugin`
4. 对照第 2 章与 5.4。
5. 总结：

```markdown
## 完成总结
- 完成范围：...
- 修改文件：...（必须无 upstream/apps/slides）
- 通过的 BR/UF：...（DSH 矩阵 N/N）
- 未破坏的不变量：...
- Evidence：evidence/...
- 剩余风险：...
```
