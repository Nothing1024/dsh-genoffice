# genoffice-land-pages-upstream Review Report

> Review mode: full | Date: 2026-08-25 | Pass: 2 | Reviewer: omp（Standards + Spec 双轴 + L1–L4 复测）
>
> 固定点：栈根 `0ad00d63` / upstream `ac51e28e` 工作树（用户未给 commit；非三圆点分支）。

## 0. 结论

| 项 | 结论 |
|---|---|
| 是否可发布 | Conditional |
| 阻塞问题数 | 0 |
| 高风险问题数 | 1（P2：契约 regenerate 行 `page_spec` vs iframe skill `pages_spec`） |
| Evidence 是否充分 | Yes（validate_package 13 PASS；本 pass 8787 复测） |
| 最大风险 | 按 `control-api.md` 直调 iframe `regenerate_slide` + `page_spec` 会假失败；DSH 插件不走该路径（它 POST `land_pages`） |

相对 pass 1：BUG-003 收窄为「非数组 pages_spec」；DSH `page_spec` 不是 iframe 入参。新增：`apply_ops` `maxItems: 50` 无关 hunk；`slides-skill.ts` 继续膨胀。

## 1. 输入资料

| 资料 | 路径 / 来源 | 状态 | 备注 |
|---|---|---|---|
| Spec | `docs/genoffice-land-pages-upstream/spec.md` | Found | BR-001~011 / UF-001~005 / INV-001~007 |
| Tasks CSV | `docs/genoffice-land-pages-upstream/tasks.csv` | Found | 8/8 已完成 |
| Diff | 工作树 vs HEAD：契约、`dev.mjs`、`slides-skill.ts`、`control-deck-access.ts`、`web-land-pages.test.ts` | Found | 忽略无关脏文件 |
| Evidence | `docs/genoffice-land-pages-upstream/evidence/` | Found | 5.2 7 路径 + 本 pass live curl |
| 插件（对照） | `plugin/.../host/tools.ts` `executeRegenerateSlide` | Found | 本包未改；用来判断 BUG-001 是否打到 DSH |

---

## 2. L1 静态一致性

| 检查项 | 结果 | 证据 | 风险 |
|---|---|---|---|
| 所有 BR 有实现 | Pass（契约 regenerate 文案 Fail） | 控制 DeckAccess 无 BYOK；`land_pages`；先 parse 再 land；htmlGenerated；pptx 39 | L161 `page_spec` |
| 所有 BR 有验证 | Pass | vitest + 5.2 + 本 pass curl | lint/format 仍未跑 |
| 所有 UF 有 evidence | Pass | UF-001~005 文件在 | — |
| INV 未被破坏 | Pass | AiPanel 未拆；cloud false；mtime 不变；无 plugin 源码 diff | smoke host 绿来自兄弟包 |
| diff 未越界 | Fail（P3） | `apply_ops` 加 `maxItems: 50`；`dev.mjs` `/api/open` sessionId | 非 land_pages |
| 未删除权限/错误处理 | Pass | invalid input / unregistered 仍在 | — |
| 未只改 mock | Pass | 真实 skill + 8787 | — |

---

## 3. L2 技术验证

| 验证项 | 是否运行 | 结果 | Evidence | 问题 |
|---|---|---|---|---|
| typecheck | Yes（pass 1） | Pass | `npm run typecheck -w @genoffice/slides` | 本 pass 未重跑 |
| lint | No | Missing | — | CONTRIBUTING |
| unit | Yes（交付） | Pass | land_pages/scratch/local-page-gen 18 | 本 pass 未重跑 |
| e2e/API | Yes | Pass | 5.2 + 本 pass live | — |
| build | Yes（交付） | Pass | slides `web:build` | — |
| validate_package | Yes（本 pass） | Pass | 0 FAIL / 13 PASS | — |

---

## 4. L3 用户路径复现（本 pass 8787）

`POST /api/control/open` → `registered:true`；稿 `/tmp/genoffice-land-pages/blank.pptx`。

| UF | 复现 | 期望 | 实际 | 结果 |
|---|---|---|---|---|
| UF-003 | generate_deck topic-only | BR-009 精确串 | 同 | Pass |
| UF-001 形 | land_pages replace 1 页 | mutated | Landed 1 | Pass |
| UF-005 形 | append 2 页 | 页数 1→3；BASE/A1/A2 都在 | 同 | Pass |
| BR-009 plan | plan_deck 有 outline | BR-009 串 | 同 | Pass |
| BR-011 形 | regen `pages_spec:[{PLURAL}]` | replace_at 落地 | Landed 1；context 含 PLURAL | Pass |

入口：`POST /api/control/slides/<docId>/tool`。无 UI loading（curl）。错误/成功反馈与 2.3 一致。

---

## 5. L4 反向 / 破坏性验证（本 pass）

| 场景 | 操作 | 期望 | 实际 | 结果 |
|---|---|---|---|---|
| 非法 input | `input: []` | `invalid input` | 同 | Pass |
| 空 pages_spec 数组 | generate_deck `{pages_spec:[]}` | 可区分缺失 | `land_pages requires a non-empty pages array` | Pass（进了 land，不是 BR-009） |
| 畸形 pages_spec | `{pages_spec:"nope"}` | 可区分非法 | BR-009 串 | Fail = BUG-003 |
| 契约 page_spec | regen `{page_spec:{…}}` | 契约若权威则落地 | BR-009 串 | Fail = BUG-001 |
| 正确 pages_spec regen | `{pages_spec:[PLURAL]}` | 落地 | 落地 | Pass |
| 磁盘 | land 后 mtime | 不变 | 不变 | Pass |
| 半落地 spec | 交付 UF-002 half-batch | 整批拒 | 见 evidence | Pass |
| SSE 断线 | — | timeout | Evidence Missing | Missing |

---

## 6. 问题清单

| ID | 级别 | 标题 | 关联 | 相对 pass 1 |
|---|---|---|---|---|
| BUG-001 | P2 | 契约 regenerate 写 `page_spec`，iframe 只读 `pages_spec`/`pages` | BR-009 / 契约 §4 | 仍开。DSH 不触发（插件 `land_pages`）；直调 iframe 仍挂 |
| BUG-002 | P3 | `dev.mjs` `/api/open` sessionId smoke 非本 spec | EVD-007 | 仍开 |
| BUG-003 | P3 | 非数组 `pages_spec` 复用 BR-009 | BR-009 | 收窄：空数组已区分 |
| BUG-004 | P3 | `slides-skill.ts` 无关 hunk `apply_ops.maxItems: 50` | spec 2.8 非目标 | 新 |
| BUG-005 | P3 | land_pages 编排内联进 3671 行 `slides-skill.ts` | CONTRIBUTING 文件膨胀 | 新（judgement） |

### BUG-001: 契约 `page_spec` vs skill `pages_spec`

**严重级别**：P2（iframe 契约权威）；对 DSH 主路径为 P3。  
**关联**：BR-009 / 契约 §4 L161  
**复现**：`regenerate_slide` + `page_spec` 对象 → `control mode requires pages_spec; use land_pages`。`pages_spec: [PageSpec]` → 落地。  
**证据**：本 pass curl；`hostAuthoredPageSpecs`；插件 `executeRegenerateSlide` POST `land_pages` `pages:[page]`。  
**建议**：契约改为「控制模式需 `pages_spec`（单页数组）或改用 land_pages」。不要为 DSH 在 iframe 兼收 `page_spec`，除非有非插件调用方。

### BUG-002 / BUG-003

同 pass 1。BUG-003 仅 `pages_spec` 非数组。

### BUG-004: 无关 `maxItems: 50`

**严重级别**：P3  
**复现**：`git diff slides-skill.ts` apply_ops `ops` 属性。  
**期望**：本包只加 land_pages。  
**实际**：多一行 schema。  
**建议**：拆出本 diff，或单独说明。

### BUG-005: 大文件继续膨胀

**严重级别**：P3 judgement  
**关联**：CONTRIBUTING「already-large file → prefer a new module」  
**实际**：`executeLandPages` ~100 行进 `slides-skill.ts`。  
**建议**：可迁到 `land-pages.ts`；非发布门闩。

Spec 轴另记：`webHtmlToPptx` append 若后页 merge 失败可能前缀已落（既有 helper）。BR-006 点名的是非法 spec / 空 pages / 错误 insert_mode，那些已先 parse。P3 弱项，不单列 BUG。

---

## 7. 发布建议

- Conditional：UF-001~005 与 BR-001/004/006/009/010/011 在 8787 上成立。发布前改契约 L161（BUG-001）。
- 必须先修复：BUG-001
- 可延期：BUG-002、003、004、005；PR 前 lint/format:check
- 不修：为 DSH 在 iframe 认 `page_spec`（插件已转 land_pages）
