# genoffice-land-pages-plugin Review Report

> Review mode: full | Date: 2026-08-25 | Reviewer: agent
> Fixed point: plugin `HEAD` `68c53868` vs WIP (uncommitted)
> Axes: Standards + Spec (parallel) aggregated below

## 上下文推断摘要

| 项 | 结论 |
|---|---|
| 推断目标 | 对照 spec 2 / 5.2 / 5.4 审查 host `land_pages` 交付 |
| 推断来源 | 用户「review检查一下」；包 `docs/genoffice-land-pages-plugin/` |
| 置信度 | 高 |
| 缺失信息 | 本回合未重跑 DSH 3080 矩阵；mtime 无原始 `stat` 输出 |
| 采用假设 | ASM-001 仍是合同（会话模型写 spec），不得被模板合成悄悄替换 |
| 下一步 | 报告；不改代码 |

## 0. 结论

| 项 | 结论 |
|---|---|
| 是否可发布 | Conditional |
| 阻塞问题数 | 0 P0 |
| 高风险问题数 | 2 P1 |
| Evidence 是否充分 | Partial（工具 CALL/RES 在；规划合同与 context 一致性不足） |
| 最大风险 | `pptx_generate_deck(topic)` 不再走会话模型；文案仍声称「当前会话模型写 PageSpec」 |

**一句话**：落地管线（注册 `pptx_land_pages`、generate/regenerate 只 POST `land_pages`、无 iframe key、无「桌面版」、catalog 仍 opt-in）成立；**host 规划合同（BR-004 / ASM-001 / §3.4）未交付**，UF-002/004 的 `get_deck_context` 与 land 成功报文不一致。

---

## 1. 输入资料

| 资料 | 路径 / 来源 | 状态 | 备注 |
|---|---|---|---|
| Spec | `docs/genoffice-land-pages-plugin/spec.md` | Found | v0.1.0 Ready |
| Tasks CSV | `docs/genoffice-land-pages-plugin/tasks.csv` | Found | Task 1–8 均「已完成」 |
| Diff | plugin `git diff HEAD -- packages/tab-genoffice` | Found | WIP vs `68c53868`；含非本包脏文件 |
| Evidence | `docs/genoffice-land-pages-plugin/evidence/` | Found | EVD-000..007 路径存在 |
| Issue tracker | `docs/agents/issue-tracker.md` | Missing | 包外无 tracker |

---

## 2. L1 静态一致性

| 检查项 | 结果 | 证据 | 风险 |
|---|---|---|---|
| 所有 BR 有实现 | Fail | BR-004 topic-only：`planDeckPages` 参数 `_run`/`_signal` 未使用，模板合成 outline+两文本框 | 合同与实现分裂 |
| 所有 BR 有验证 | Partial | 单测锁「topic-only 不得调 nested LLM」——与 BR-004 相反；UF-001 成功是模板字面量 | 假绿 |
| 所有 UF 有 evidence | Partial | 四个 jsonl 都在；UF-002/004 context 与 Then 不符；fail-planning 是旧 LLM 空输出 | 核销过宽 |
| INV 未被破坏 | Pass | INV-001：`git -C genoffice diff --stat -- upstream/apps/slides` 空；INV-002 catalog；INV-006 `source:'runtime'`；INV-007 `fileOpenOnThisPage` 返回无 scope 的 `{ seed }` | — |
| diff 未越界 | Pass（本包） | 未改 slides renderer。同工作树另有 sheets/pdf capability、`genoffice.tsx` 预览拆除、`file-tab.ts` 未跟踪 | 提交时需拆开 |
| 未删除权限/错误处理 | Pass | `planning failed:` 新分支；GUARD 下一步改 land_pages | — |
| 未只改 mock/fixture | Pass | `tools.ts` / `page-plan.ts` / `lib/index.js` 真路径 | — |

### 5.4 专项清单

| 项 | 结果 |
|---|---|
| generate_deck relay 不是 iframe `generate_deck` | Pass（单测 + 实现特判） |
| 未把 secrets 写入 iframe | Pass（host 无 localStorage/apiKey 写入；probe note） |
| catalog 【不要主动触发】 | Pass |
| errors 无「桌面版」 | Pass（`rg` src 无匹配） |
| `lib/index.js` rebuild | Pass（含 `pptx_land_pages` / `skillName:"land_pages"`） |
| 无 slides renderer 改动 | Pass |
| BR-000 绿才标 5.2 | Pass（`probe.json` `br000: green`） |
| 5.2 矩阵全过 | Conditional（工具成功；规划合同与 context Then 未过） |
| 入口接线：工具已注册 | Pass |
| 所有 BR/UF/INV 可核销 | Fail（BR-004 / ASM-001 / UF-002 Then / UF-004 一致性） |

---

## 3. L2 技术验证

| 验证项 | 是否运行 | 结果 | Evidence | 问题 |
|---|---|---|---|---|
| typecheck | 本回合 No | Pass（归档） | `evidence/phase-1/tests.txt` | 未复跑 |
| lint | No | NA | 包无独立 lint 命令 | — |
| unit | Yes | Pass | `vitest run tests/host-land-pages.spec.ts tests/skill.spec.ts` → 13/13 | 单测把「不调 LLM」写成合同 |
| integration | No | NA | — | — |
| e2e/API | 本回合 No | Partial | UF-*.jsonl + probe.json | 见 P1 |
| build | 本回合 No | Pass（归档） | `lib-land-pages.txt` count=18 | `src/host/capability.js` 仍 cloud-only，与 ts/lib 漂移 |
| package validator | Yes | Pass | `validate_package.py` 13 PASS / 0 FAIL | 只验路径存在，不验 jsonl 语义 |
| smoke | 本回合 No | Pass（归档） | `evidence/phase-2/smoke.log` `pptx 39` | — |
| migration/benchmark | NA | NA | — | — |

---

## 4. L3 用户路径复现

本回合**未**重开 DSH 3080 回放。下表按归档 jsonl 对照 spec 2.3 / 5.2，不是现场复跑。

| UF | 复现步骤 | 期望 | 实际 | 结果 | Evidence |
|---|---|---|---|---|---|
| UF-001 主路径 | open → generate_deck topic+3 → context → add_shape | ≥3 页真文字；非 no local LLM；add_shape 非 scratch | `Landed 3 host-authored page(s)`；文案是模板「封面：主标题与一句话钩子」；add_shape 成功 | Partial | `evidence/UF-001/success.jsonl` |
| UF-001 规划失败 | 逼空模型 | `planning failed:`，稿空白 | `planning failed: empty model output`（旧 nested-LLM）。当前 topic-only **不再调模型**，该失败已失效 | Stale | `evidence/UF-001/fail-planning.jsonl` |
| UF-002 | land_pages 2 页 replace | 工具成功；**context 2 页** | 工具 `Deck now has 2 page(s)`；随后 context **1 页空**；read_slide(1) 才见「第二页 节奏」 | Fail Then | `evidence/UF-002/success.jsonl` |
| UF-003 | 非法 pages | isError；无桌面版；页数不变 | `invalid page spec`；无桌面版；context 仍 2 页（承接 UF-002，非 spec 的 1 空白页） | Pass（拒绝） / Partial（前置） | `evidence/UF-003/rejected.jsonl` |
| UF-004 | regenerate brief **或** land replace_at | 仅第 1 页变；无 no local LLM | 走了 `pptx_land_pages replace_at`（允许）；工具称 3 页；context 1 页空；read_slide(0) 先是旧「季度复盘」而非「替换后的第一页」 | Partial | `evidence/UF-004/replaced.jsonl` |

### 入口接线与交互完整性

| UF | 入口真实可达 | loading/禁用态 | 错误提示 | 成功反馈 | 结果 |
|---|---|---|---|---|---|
| UF-001 | Yes（会话工具 `pptx_generate_deck`） | NA（工具超时 300s） | Yes（`planning failed:` 映射） | Yes（Landed N pages） | Pass 接线 |
| UF-002 | Yes（`pptx_land_pages`） | NA | — | 工具成功 / context 滞后 | Fail 成功反馈一致性 |
| UF-003 | Yes | NA | Yes（无桌面版） | — | Pass |
| UF-004 | Yes | NA | — | 工具成功 / context 滞后 | Fail 成功反馈一致性 |

---

## 5. L4 反向 / 破坏性验证

| 场景 | 操作 | 期望 | 实际 | 结果 | 风险 |
|---|---|---|---|---|---|
| 权限/secrets | generate 时写 iframe key | 禁止 | host 无 localStorage/`apiKey` 写入 | Pass（代码） | 无运行时 localStorage dump |
| 非法输入 | `pages: [{}]` | 整批拒绝 | 上游 `elements` missing or empty | Pass | — |
| 空 topic | generate_deck 无 topic/pages_spec | `planning failed:` | 单测 `rejects.toThrow(/planning failed:/)`，不 POST | Pass | — |
| 网络/timeout | iframe 忙 | BR-009 可区分 | `callRelayRetry` 对 `/timeout/i` 重试 3 次（规格未写，可接受） | Pass+extra | 掩盖持续超时 |
| 旧 bundle | 未 rebuild | 无新工具 | `lib/index.js` 已含 land_pages；`src/host/capability.js` 仍 cloud-only | Pass runtime / P3 残留 | 若有人加载 src js 会看旧表 |
| 重复 land | replace 连续 | 幂等替换 | 未单独测 | Evidence Missing | — |
| 规划失败半落地 | 空模型 | 不半落地 | 旧 jsonl 里 fail 后 add_shape 仍 scratch（符合）；现路径几乎不再 fail | Stale | — |

---

## 6. 问题清单

| ID | 严重级别 | 标题 | 关联 BR/UF/INV | 证据 | 建议修复 |
|---|---|---|---|---|---|
| BUG-001 | P1 | topic-only generate_deck 不走会话模型 | BR-004 / ASM-001 / §3.4 / UF-001 | `page-plan.ts` `planDeckPages(_run,_signal)`；UF-001 标题=模板字面量；skill/tool 文案仍写「会话模型」 | 要么恢复 outline+逐页 JSON（parse 再试 1 次），要么改 spec/文案承认模板规划并降级 ASM-001 |
| BUG-002 | P1 | land 成功后 `get_deck_context` / `read_slide` 与页数不一致 | UF-002 / UF-004 | UF-002 工具 2 页 vs context 1 页空；UF-004 工具 3 页 vs context 1 页，read_slide 先读到旧封面 | 落地后等待 canvas 再读 context；或修 iframe 大纲滞后。未稳定前不要把 Then「context N 页」标完成 |
| BUG-003 | P2 | UF-001 fail-planning 证据相对当前代码过期 | UF-001 失败分支 / BR-009 | `empty model output` 来自已删除的 nested-LLM；现缺 topic 才 planning failed | 用非法/空 `pages_spec` 或缺 topic 重录失败 jsonl |
| BUG-004 | P2 | skill/capability/tool-schema 对生成路径说谎 | BR-004 / BR-007 | `skill.ts` L35；`tool-schema.ts` generate_deck description；`capability.ts` slides:generate_deck evidence | 与真实 planner 对齐 |
| BUG-005 | P3 | `sessionPlanLlm` 在每个非 save 控制工具上解析 | Standards | `tools.ts` L399 在 generate/regenerate 特判之前 | 挪进两个特判分支 |
| BUG-006 | P3 | `src/host/*.js` 手改孪生且 `capability.js` 仍 cloud-only | BR-010 精神 | `capability.js` L55 generate_deck cloud-only | 删除 src 下编译残留，只保留 ts→lib |
| BUG-007 | P3 | `pageSpecFromOutline` 丢弃 layout/image_queries | §3.4 轻量校验之后的质量 | `page-plan.ts` L226-250 vs `parseOutline` | 接入或从 schema 删掉这些字段 |
| BUG-008 | P3 | BR-008 mtime 无原始 stat | BR-008 / INV-005 | 仅 `phase-2/notes.md`「mtime 不变」 | 补 `stat` 前后输出 |

### BUG-001: topic-only generate_deck 不走会话模型

**严重级别**：P1  
**关联**：BR-004 / ASM-001 / spec §3.4 / UF-001 步骤 3  

**复现步骤**：

1. `pptx_open` 空白稿。
2. `pptx_generate_deck({ topic, approx_pages: 3 })`（无 `pages_spec`）。
3. 读 `get_deck_context` 标题/正文。

**期望结果**：host 用当前 DSH 会话模型写 outline，再逐页 PageSpec JSON（parse 失败最多再试 1 次），然后 `land_pages`。页文案由模型生成，不是 host 字符串模板。

**实际结果**：`planDeckPages` 忽略 LLM；`pageSpecFromOutline` 输出固定两文本框。UF-001 正文为「季度复盘三页演示。封面：主标题与一句话钩子。」单测 `topic-only generate_deck must not call nested LLM` 把偏离锁成回归。

**证据**：`packages/tab-genoffice/src/host/page-plan.ts` L337-381；`evidence/UF-001/success.jsonl` L4-6；`tests/host-land-pages.spec.ts` L89-109。

**建议修复**：恢复 `llmJson` 规划（已知 nested `ctx.llm.stream` 不稳定则换会话模型调用方式，而不是删合同）；或正式修订 spec 为「确定性 outline 模板」，并改 skill/tool 文案。禁止维持「会话模型写 spec」文案。

### BUG-002: land 成功后 context 与页数不一致

**严重级别**：P1  
**关联**：UF-002 Then「context 2 页」；UF-004「仅第 1 页变」  

**复现步骤**：见归档 jsonl：land 成功立刻 `pptx_get_deck_context` / `pptx_read_slide`。

**期望结果**：context 页数与 land 报文一致；replace_at 后第 0 页为新 spec 文案，其余页不变。

**实际结果**：工具返回 `Deck now has 2/3 page(s)`，context 报 1 页且空 elements；UF-004 首次 `read_slide(0)` 仍是旧「季度复盘」，不是「替换后的第一页」。

**证据**：`evidence/UF-002/success.jsonl`；`evidence/UF-004/replaced.jsonl`。

**建议修复**：host 在 land 后短轮询 context 直到页数匹配再返回；或在 skill 中写明「land 后等 canvas」。5.2 核销应以稳定后的 context/read_slide 为准。

---

## 7. 发布建议

- **Conditional**：`pptx_land_pages` 与「不再转发 iframe generate_deck / 不注入 key / 无桌面版」可合入。
- **不得宣称**：空白稿 `pptx_generate_deck(topic)` 由「当前会话模型写 PageSpec」。
- **必须先修复（P1）**：BUG-001（实现或改 spec，二选一并改文案）；BUG-002（context 稳定后再标 UF-002/004 完成）。
- **可延期**：BUG-005/006/007 代码气味；BUG-008 mtime 原始输出。
- **需要补充 evidence**：新的 UF-001 规划失败（对应当前代码）；UF-002/004 稳定后的 context；BR-008 `stat`。
- **tasks.csv**：Task 7/8 标「已完成」过宽，建议改回「有条件完成」直到 P1 关闭。

### Standards（并行轴摘要）

无 CODING_STANDARDS.md。判断气味（非 blocker）：死参数 `_run/_signal`；每工具解析 `sessionPlanLlm`；outline 字段丢弃；`src/host/*.js` 手同步。Prompt 复制上游是 ASM-005，不算违规。

### Spec（并行轴摘要）

BR-000/001/002/003/006/007/010 与 INV-001/002/006/007 成立。BR-004/ASM-001/§3.4 不成立。UF-001 主路径落地与 add_shape 解锁成立，规划质量不成立。
