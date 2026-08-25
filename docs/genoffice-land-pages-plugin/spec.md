# genoffice-land-pages-plugin Spec

> Version: 0.1.0 | Date: 2026-08-24 | Status: Ready 可执行
>
> 本文件是 **DSH 插件**（`plugin/packages/tab-genoffice`）的唯一事实源。
> 不实现 slides iframe 落地管线。上游包见 `../genoffice-land-pages-upstream/`。
>
> 填写三态规则：验证过的事实 / `ASM-xxx` / `待勘察`。禁止编造命令、symbol、文件名。

---

## 1. 事实基线与假设

### 1.1 需求与运行模式

| 项 | 结论 |
|---|---|
| 原始需求 | DSH（或其他走同一 host 的 agent）像现有 `pptx_*` 一样调用落地：注册 `pptx_land_pages`；`pptx_generate_deck` 用**会话模型**写 `PageSpec[]` 再 land。禁止把 key 写入 iframe。 |
| 输入类型 | description（用户要求把跨仓 handoff 切成上游 / 插件两份） |
| Mode | oneclick |
| 置信度 | 高 |
| 输出目录 | `docs/genoffice-land-pages-plugin/`（相对 `/Users/nothing/workspace/dsh/genoffice`） |
| 仓库边界 | **只改** `plugin/dsh-genoffice/plugin`（及该插件测试）。禁止改 `upstream/apps/slides` 渲染器。契约 `contracts/control-api.md` 由上游包改；本包只对齐插件表与 smoke 的 host 镜像。 |

### 1.2 任务类型路由

| 维度 | 结论 |
|---|---|
| 任务类型 | backend（工具注册 / host 规划）+ prompt（skill / 错误文案） |
| 主要风险 | 1) `pptx_generate_deck` 仍 `executeControl(..., generate_deck)`；2) iframe 尚无 `land_pages` 时误标完成；3) 把 `.env` 注入 iframe |
| 行号引用策略 | 业务/API 优先；symbol + rg |
| 必需验收方式 | DSH 会话 `pptx_open` → `pptx_land_pages` / `pptx_generate_deck`；插件 build/typecheck；smoke host 表 |
| 必须覆盖用户场景 | 空白稿宿主出片、直调 land_pages、错误文案无桌面版 |
| 不覆盖 | iframe `land_pages` 实现、拆除 `withLocalLlm`（上游包） |

### 1.3 勘察事实清单

> 勘察日期 2026-08-24。插件路径相对 `plugin/dsh-genoffice/plugin/packages/tab-genoffice/`，除非写明。

| 事实 | 来源命令 | 输出摘要 |
|---|---|---|
| DSH host 把 `pptx_*` 转成 `{call:{name: entry.skillName, input}}` POST relay | `read src/host/tools.ts` | L145-146 `executeControl` |
| `pptx_generate_deck` 已在 CONTROL_TOOL_TABLE，capability=`available`，文案写 iframe BYOK | `read src/host/tool-schema.ts` + `capability.ts` | tool-schema L822-828；capability L73 |
| 空白稿实跑：`pptx_open` 成功后 `pptx_generate_deck` 上游 `Planning failed: web control mode has no local LLM` | `dsh-session-cat.sh … session-7942fd4a-…` | CALL/RES 各一次 |
| 更早一次旧 web-dist：`sign in to Genspark (gsk) first` | `dsh-session-cat.sh … session-f1ad5057-…` | 上游包旧包问题；本包不得靠配 iframe key 绕过 |
| `dsh-genoffice` catalog 含「【不要主动触发】」；content 未写 land_pages | `read src/host/skill.ts` | L10-40；`source: 'runtime'` |
| guard 错误下一步仍写「从零出片请用桌面版 GenOffice」 | `read src/host/errors.ts` | L109-116 |
| `isExposed` 含 `available`/`partial`/`guarded` | `read src/host/capability.ts` | L114-118 |
| capability.spec 断言 generate_deck 为 local spec→pptx 且 available | `read tests/capability.spec.ts` | L132-148 |
| PageSpec 形状与 parse 上限在上游 `page-spec.ts`（本包 host 规划必须产出可 parse 的 JSON） | `read ../../../../genoffice/upstream/apps/slides/src/shared/page-spec.ts` | L58-108、L135 |
| 规划 prompt 在上游 `pageSpecSystemPrompt` / `PLAN_DECK_SYSTEM_PROMPT` | `read …/local-page-gen.ts` | L47-98、L127 |
| `CONTROL_TIMEOUT_MS = 70_000` | `read src/host/tools.ts` | L18 |

### 1.4 假设清单

| 假设 ID | 内容 | 风险 | 确认方式 |
|---|---|---|---|
| ASM-001 | 写 spec 的 LLM = **当前 DSH 会话模型**，不是 iframe `getAiSettings`。 | 会话模型质量差 → parse 失败 | UF-001；失败可区分规划 vs 落地 |
| ASM-002 | `pptx_land_pages` 为加法。`pptx_generate_deck` 工具名保留，实现改为 host。smoke pptx 39 由上游改契约；本包改 CONTROL_TOOL_TABLE 才能让 smoke 全绿。 | 上游未合入 land_pages 时转发 未知工具 | BR-000 闸门；P0 探测 |
| ASM-003 | 调用方仍先 `pptx_open` 等「已打开控制模式」。不新开传输。 | 与现有 pptx_* 一致 | UF-001 步骤 2 |
| ASM-004 | 图片：host 规划只把已有 `https?://` 放进 spec；不把 gsk generate_image 接入出片。 | 页偏素 | 非目标 |
| ASM-005 | host 规划 prompt **复制**上游常量文本，禁止 plugin import slides renderer。 | 两份 prompt 漂移 | 注释标明来源文件 |
| ASM-006 | 上游未提供 `land_pages` 时本包不得把 5.2 标完成。可先改表与文案，E2E 阻塞。 | 假完成 | Task 1 探测 |

---

## 质量记录

- 生成后：`python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/genoffice-land-pages-plugin`

---

## 2. 业务合同

### 2.1 BR 业务规则

| 规则 ID | 规则 | 正例 | 反例 | 影响范围 | 验证方式 |
|---|---|---|---|---|---|
| BR-000 | 本包 E2E 依赖上游 iframe 已实现 `land_pages` 且 web-dist 已部署。探测：control 已注册时 POST `land_pages` 最小合法 1 页，不得返回未知工具 / `no local LLM` | 探测成功再跑 UF-001 | 探测失败仍标 5.2 完成 | 验收闸门 | Task 1 |
| BR-001 | 禁止把 `.env` / DSH key / `genoffice-web-ai-settings` 写入 iframe | land 成功且 iframe localStorage 无新 apiKey | 为出片注入 BYOK | host | rg + UF-001 |
| BR-002 | 注册 DSH 工具 `pptx_land_pages`，`skillName: 'land_pages'`，capability `available`，`isExposed` true。转发形状与其他 pptx_* 相同（host 剥 `path`） | 会话工具列表可见；curl 经 DSH 等价于直接 land_pages | 只改 ts 不 rebuild `lib/index.js` | tool-schema / capability / tools.ts | UF-002 |
| BR-003 | `pptx_land_pages.parameters` 含必填 `path` + `pages`（array）；可选 `insert_mode`/`at_index`/`deck_name`。`pages` 元素对齐上游 PageSpec | 合法 JSON 转发为 skillInput.pages | 把 path 传进 iframe call.input | tools.ts | UF-002 |
| BR-004 | `pptx_generate_deck` **不得** `executeControl` 到 iframe `generate_deck`。无 `pages_spec`：会话模型写 outline+每页 JSON，parse 失败最多再试 1 次，再 `land_pages`。有 `pages_spec`：跳过规划直接 land | 空白稿 topic+approx_pages=3 → ≥3 页真文字；relay body `name==='land_pages'` | 上游原文仍 `web control mode has no local LLM` | tools.ts | UF-001 |
| BR-005 | `pptx_regenerate_slide`：无 `page_spec` 时 host 写一页 spec 再 `replace_at`；有则直接 land。禁止 brief-only 转发 iframe 打 LLM | replace_at 一页 | 上游 `no local LLM` | tools.ts | UF-004 |
| BR-006 | 插件错误映射不得写「用桌面版 GenOffice」。`no local LLM` / pages_spec 的下一步改为 `pptx_land_pages` / 宿主写 spec | errors.ts 无「桌面版」 | 模型被带去桌面云 | errors.ts | rg + UF-003 |
| BR-007 | `dsh-genoffice` catalog 仍以「【不要主动触发】」开头，不提「做 PPT」。content 写清：空白稿用 `pptx_generate_deck` 或自写 spec 后 `pptx_land_pages`；禁止 ppt-image-first / python-pptx。`source: 'runtime'` 保持 | skill.list 描述含【不要主动触发】 | catalog 抢做 PPT | skill.ts | INV-002 |
| BR-008 | 落地不写盘；写盘仅 `pptx_save` / tab「写入磁盘」 | generate 后磁盘 mtime 不变直到 save | land 直接 POST /api/file | 沿用现有 save | UF-001 |
| BR-009 | host 规划超时：单次 land 走现有 70s；多页可逐页 land。规划失败与落地失败错误可区分 | 输出含 `planning failed:` vs `land_pages:` | 一律 unrecognized | errors.ts | UF-001 失败 |
| BR-010 | `lib/index.js` 必须与 ts 同步 rebuild。不得只改 `capability.js` 残留 | build 后 grep land_pages 命中 | 只改 src、3080 仍旧表 | pnpm build | EVD-005 |

### 2.2 UF 用户验收场景（索引）

| 场景 ID | Given | When | Then | 角色 | 验证方式 | Evidence |
|---|---|---|---|---|---|---|
| UF-001 | 上游 land_pages 已部署；DSH 打开空白 pptx 控制模式；iframe 无 AI settings | `/dsh-genoffice` 后 `pptx_generate_deck({topic, approx_pages:3})` | ≥3 页真文字；随后 `pptx_add_shape` 非 scratch；磁盘未写直到 save | DSH agent | DSH 会话 | EVD-001 |
| UF-002 | 同一空白稿已 open | `pptx_land_pages` 2 页合法 spec，replace | 工具成功；context 2 页 | DSH agent | DSH 会话 | EVD-002 |
| UF-003 | 执行器已注册 | `pptx_land_pages` 非法 pages | isError；页数不变；文案无「桌面版」 | DSH agent | DSH 会话 | EVD-003 |
| UF-004 | 已落地 ≥1 页 | `pptx_regenerate_slide` 带 brief（host 写 spec）或 `pptx_land_pages` replace_at | 仅第 1 页变；无 no local LLM | DSH agent | DSH 会话 | EVD-004 |

### 2.3 核心业务流程（步骤级交互脚本）

#### UF-001: DSH 空白稿宿主出片

**前置状态**：BR-000 探测通过；relay `:8787` 当前 slides；DSH `:3080` 加载本插件 **rebuild 后** 的实例；空白 pptx 副本；iframe **未**配置 `genoffice-web-ai-settings`。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 会话 `/dsh-genoffice` 要求打开空白 pptx 并生成 3 页 | — | 加载 runtime skill | catalog 未抢做 PPT |
| 2 | 模型 `pptx_open` | sidebar slides iframe | host 轮询 open 至 registered | `已打开控制模式：<path>` |
| 3 | 模型 `pptx_generate_deck` `{topic, approx_pages:3}` | iframe 逐页出现 | **host** 会话模型写 PageSpec[]，POST `land_pages`；**不** POST iframe `generate_deck` | 非 `no local LLM` |
| 4 | `pptx_get_deck_context` | 大纲 | context ≥3 页真文字 | 与主题相关 |
| 5 | `pptx_add_shape` | 多样子 | 上游 htmlGenerated 已真 | 非 scratch / 非云 |
| 6 | （可选）`pptx_save` | 写入磁盘 | 仅此时写盘 | mtime 变 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 执行器未挂 | open 后无 SSE | executor not registered | 不落地 | 只再 open 一次 |
| 规划失败 | 模型空输出 / 两次 parse 失败 | isError `planning failed:`，稿仍空白 | 不半落地 | 改 brief 或改调 pptx_land_pages |
| 上游无 land_pages | BR-000 失败 | 未知工具或旧 LLM 错 | E2E 阻塞 | 等上游包 |
| 旧插件 bundle | 未 build / 未重启 3080 | 无 pptx_land_pages | — | pnpm build 并重启 DSH |

**界面状态机**：

```text
closed → open(registered) → host-plan → land_pages → landed
                |                |            |
                v                v            v
         executor-missing  planning-failed  land-error
```

**入口接线清单**：

- `pptx_open` → 现有 waitUntilRegistered（无 scope 打开）
- `pptx_generate_deck` → **新 host 实现** → iframe `land_pages`
- `pptx_land_pages` → 现有 `executeControl`
- skill content 步骤 3–4

#### UF-002: 直调 pptx_land_pages

**前置状态**：UF-001 步骤 2 完成。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | `pptx_land_pages` 2 页合法 spec，replace | 画布 2 页 | executeControl name=land_pages | 工具成功 |
| 2 | `pptx_get_deck_context` | — | context | 2 页 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 未 open | 无 iframe | executor not registered | 不转发 | 先 open |
| 未注册工具 | cap 未暴露 | 模型看不到工具 | — | BR-002 |

**界面状态机**：

```text
registered → pptx_land_pages → mutated
```

**入口接线清单**：CONTROL_TOOL_TABLE + registerControlTools。

#### UF-003: 非法 spec

**前置状态**：已 open；1 空白页。

**成功主路径**（正确拒绝）：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | pptx_land_pages 坏 pages | 画布不变 | 上游整批拒绝；host 映射错误 | isError；无「桌面版」 |
| 2 | context | — | 页数 1 | 无半页 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| host 未剥 path | iframe 看到 path 字段 | 可能 invalid spec | 违反 BR-003 | 剥 path 如其他 pptx_* |

**界面状态机**：

```text
registered → land_pages(invalid) → error（稿不变）
```

**入口接线清单**：同 UF-002；文案 BR-006。

#### UF-004: 重做一页

**前置状态**：已落地 ≥1 页。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | `pptx_regenerate_slide` brief 或 land_pages replace_at 0 | 第 1 页变 | host 写 spec → land_pages replace_at | 页数不变；无 no local LLM |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 仍转发 iframe regenerate | 未改 tools.ts | no local LLM | 违反 BR-005 | host 接管 |
| at_index 越界 | 错误 index | 上游 isError | 稿不变 | 先 context |

**界面状态机**：

```text
landed → replace_at → landed（n 同）
```

**入口接线清单**：`pptx_regenerate_slide` 特判与 `pptx_land_pages`。

### 2.4 INV 不变量

| 不变量 ID | 内容 | 关联 BR/UF | 验证方式 |
|---|---|---|---|
| INV-001 | 本包不改 `upstream/apps/slides` 渲染器 | 仓库边界 | git diff |
| INV-002 | skill catalog「【不要主动触发】」，不抢做 PPT | BR-007 | 字符串 |
| INV-003 | 已有 pptx_set_element_* / read_slide / save 形状不变 | BR-002 | 抽测 |
| INV-004 | 不放宽 blockScratchBuild（那是上游）；插件不得为解锁而改错误吞掉 | UF-001 步骤 5 | 未落地 add_shape 仍错 |
| INV-005 | 落地不写盘 | BR-008 | mtime |
| INV-006 | `source: 'runtime'` 仍在 skills.register | skill.ts | 回归 |
| INV-007 | openTab 匹配页仍不得带 session scope（既有修复） | tools.ts fileOpenOnThisPage | 不回退 |

### 2.5 EVD 证据清单

| 证据 ID | 类型 | 期望证据 | 保存位置 |
|---|---|---|---|
| EVD-001 | log | 会话 JSONL：open 成功；generate_deck 非 no local LLM；context ≥3 页；add_shape 非 scratch | `evidence/UF-001/` |
| EVD-002 | log | pptx_land_pages 2 页成功 | `evidence/UF-002/` |
| EVD-003 | log | 非法 spec isError；无桌面版 | `evidence/UF-003/` |
| EVD-004 | log | regenerate / replace_at | `evidence/UF-004/` |
| EVD-005 | cmd | plugin build/typecheck；lib/index.js 含 land_pages | `evidence/phase-1/` |
| EVD-006 | test | host 单测：generate_deck 发出 land_pages 而非 generate_deck | `evidence/phase-1/` |
| EVD-007 | cmd | `node scripts/dev.mjs smoke` 全绿（上游契约 39 + 本表） | `evidence/phase-2/` |
| EVD-000 | api | BR-000 探测请求/响应 | `evidence/phase-0/probe.json` |

### 2.6 角色与权限矩阵

| 角色 | 可见 | 可操作 | 禁止 | 失败提示 | 验证场景 |
|---|---|---|---|---|---|
| DSH 会话 agent | pptx_* 含 land_pages / generate_deck | open / land / generate / save | iframe 配 key；python-pptx；ppt-image-first | classifyControlError | UF-001 |
| 维护者 | 工具表 / skill | rebuild 插件 | 改 slides renderer | — | INV-001 |

### 2.7 负向 / 破坏性场景

| 场景 | Given | When | Then | Evidence |
|---|---|---|---|---|
| 上游未就绪 | land_pages 未知 | generate_deck | E2E 阻塞，不标完成 | EVD-000 |
| 规划失败 | 模型胡 JSON | generate_deck | planning failed，稿空白 | EVD-001 失败可附 |
| 空 pages | land_pages [] | 工具 | 上游空数组错误，无桌面版 | EVD-003 |
| 旧 bundle | 未重启 3080 | 无新工具 | 重启后再测 | EVD-005 |

### 2.8 非目标

- 不实现 iframe `land_pages` / 不删 `withLocalLlm`（上游包）。
- 不改 blockScratchBuild 阈值。
- 不把 secrets 写入 iframe。
- 不恢复 gsk 云出片。
- 不把 workflow 写回 system prompt。
- 不改 docs/sheets/pdf。

---

## 3. 技术方案

### 3.1 架构 Before / After

```text
Before:
DSH ── pptx_generate_deck(topic) ── executeControl ── iframe generate_deck ── BYOK
→ no local LLM

After:
DSH ── pptx_land_pages(pages) ── executeControl ── iframe land_pages
DSH ── pptx_generate_deck(topic) ── session LLM → PageSpec[] ── land_pages
iframe 出片零 key
```

### 3.2 模块改造

| 模块 | 职责 | 改造说明 |
|---|---|---|
| `tool-schema.ts` | 工具表 | 加 `pptx_land_pages`；generate_deck/regenerate 描述去 iframe BYOK；可选 `pages_spec`/`page_spec` |
| `capability.ts` | 暴露 | `slides:land_pages` available；更新 generate_deck evidence 文案 |
| `tools.ts` | 执行 | land_pages 走 executeControl；generate_deck / regenerate_slide **特判 host** |
| `errors.ts` | 文案 | 删桌面版；下一步 land_pages |
| `skill.ts` | runtime skill | content 补宿主出片；catalog 不变抢路由 |
| `lib/index.js` | 产物 | 必须 rebuild |
| 测试 | capability.spec + 新 host 测 | relay body name=land_pages |

### 3.3 三段式定位清单

| 文件 | 稳定定位 | 搜索定位 | 行号 hint | 备注 |
|---|---|---|---|---|
| `packages/tab-genoffice/src/host/tool-schema.ts` | `CONTROL_TOOL_TABLE` `pptx_generate_deck` | `rg "name: 'pptx_generate_deck'"` | L823 | 旁加 land_pages |
| `packages/tab-genoffice/src/host/capability.ts` | `slides:generate_deck` | `rg "slides:generate_deck"` | L73 | 加 land_pages |
| `packages/tab-genoffice/src/host/tools.ts` | `executeControl` / `registerControlTools` | `rg "entry.skillName"` | L146 | generate_deck 特判 |
| `packages/tab-genoffice/src/host/errors.ts` | GUARD 分支 | `rg "桌面版"` | L109-116 | 删 |
| `packages/tab-genoffice/src/host/skill.ts` | `GENOFFICE_SKILL_CONTENT` | `rg "GENOFFICE_SKILL_CONTENT"` | L17 | 补步骤 |
| `packages/tab-genoffice/tests/capability.spec.ts` | generate_deck available | `rg "pptx_generate_deck"` | L132 | 加 land_pages |

### 3.4 API / 数据 / 权限 / 路由影响

| 类型 | 是否影响 | 说明 | 兼容策略 |
|---|---|---|---|
| API | 否（新 HTTP） | 仍 POST `/api/control/slides/<docId>/tool` | 上游无 land_pages 则未知工具 |
| 数据 | yes | `pages` / `pages_spec` PageSpec JSON | 剥 path |
| 权限 | no | loopback | — |
| 路由 | no | — | — |

**DSH `pptx_land_pages` parameters**：必填 `path`；`pages` 同上游 3.4；`insert_mode`/`at_index`/`deck_name` 可选。

**`pptx_generate_deck` 增参**：可选 `pages_spec`（同 `pages`）。无则 host 规划。

**host 规划最小合同**：

1. 系统/用户 prompt 复制自 `pageSpecSystemPrompt` / `PLAN_DECK_SYSTEM_PROMPT` / `pageSpecUserMessage`（注明来源，禁止 import renderer）。
2. 先 outline（core_hook + pages briefs）再逐页 spec JSON。
3. 每页输出必须能被上游 `parsePageSpec` 接受（host 侧可用轻量 JSON 校验：有 `elements` 数组且每项有 type/x/y/w/h；完整校验仍以 iframe 为准）。
4. 画布 1280×720。

**精确错误前缀**：

| 条件 | 工具 output 含 |
|---|---|
| 规划失败 | `planning failed:` |
| 落地失败 | 上游原文（host 不吞） |
| 无桌面版 | 不得出现「桌面版」 |

---

## 4. Phase 计划与任务详情

```text
P0 探测与表 ──► P1 host 实现 ──► P2 端到端（DSH）
```

### Task 1: 探测上游 land_pages 并冻结插件工具表

- **关联**：BR-000 / BR-002 / BR-003 / BR-010 / EVD-000 / EVD-005
- **前置任务**：无
- **风险等级**：P0

**为什么做**：表可以先加；E2E 不能在上游缺失时假装完成。

**涉及文件与定位**：tool-schema.ts；capability.ts；capability.spec.ts

**具体操作**：

1. 对已注册空白稿 POST `land_pages` 1 页最小 spec，保存 `evidence/phase-0/probe.json`。
2. 无论探测成败：CONTROL_TOOL_TABLE 加 `pptx_land_pages`；CAPABILITY `slides:land_pages` available。
3. generate_deck / regenerate 描述去掉「iframe 需配置非 genspark」。
4. generate_deck 增加可选 `pages_spec`；regenerate 可选 `page_spec`。
5. 探测失败：本任务仍可完成表改动，但 Task 7（5.2）保持阻塞直到探测成功。

**验证**：`rg "pptx_land_pages" src/host/tool-schema.ts`；probe 文件存在。

**Evidence**：`evidence/phase-0/`

**注意事项**：禁止为探测注入 iframe key。禁止改 slides 源码（去上游包）。

### Task 2: 执行 Phase 0 回归验证

- **关联**：本 Phase BR
- **前置任务**：1

**验证**：表 diff 为加法；probe 结论写入 phase-0 notes。

**Evidence**：`evidence/phase-0/`

### Task 3: host 接管 pptx_generate_deck 与 pptx_regenerate_slide

- **关联**：BR-001 / BR-004 / BR-005 / BR-009 / UF-001 / UF-004 / EVD-006
- **前置任务**：2
- **风险等级**：P0

**为什么做**：用户明确 LLM 归 DSH。

**涉及文件与定位**：tools.ts `registerControlTools` / `executeControl`

**具体操作**：

1. `pptx_land_pages` 走现有 executeControl。
2. `pptx_generate_deck`：有 pages_spec → land_pages；否则会话 completion 写 spec（ASM-005 复制 prompt），再 land_pages。
3. 断言发出的 relay JSON `call.name === 'land_pages'` 且绝非 topic-only `generate_deck`。
4. `pptx_regenerate_slide` 同样 host 写一页或转发 page_spec 为 replace_at。
5. 禁止读 iframe settings、禁止写 localStorage。
6. 规划失败前缀 `planning failed:`。

**验证**：单测 mock LLM 固定 spec，抓 fetch body。

**Evidence**：`evidence/phase-1/`

### Task 4: skill 与 errors 文案

- **关联**：BR-006 / BR-007 / INV-002 / INV-006 / UF-001
- **前置任务**：3
- **风险等级**：P1

**具体操作**：

1. GENOFFICE_SKILL_CONTENT：空白稿 → generate_deck 或 land_pages；禁止 ppt-image-first / python。
2. catalog 仍【不要主动触发】。
3. errors.ts 删「桌面版」；GUARD / unrecognized 下一步指向 land_pages。
4. 保持 `source: 'runtime'`。

**验证**：`rg "桌面版" src` 无匹配；description 含【不要主动触发】。

**Evidence**：`evidence/phase-1/`

### Task 5: rebuild 插件并锁测试

- **关联**：BR-010 / EVD-005 / EVD-006
- **前置任务**：3;4
- **风险等级**：P0

**具体操作**：`pnpm run build && pnpm run typecheck`；capability.spec 含 pptx_land_pages；lib/index.js grep land_pages。

**验证**：build 全绿。

**Evidence**：`evidence/phase-1/`

### Task 6: 执行 Phase 1 回归验证

- **关联**：本 Phase BR
- **前置任务**：3;4;5

**验证**：测试 + build；`rg "executeControl" 不得再把 generate_deck topic-only 送出`（实现特判覆盖）。

**Evidence**：`evidence/phase-1/`

### Task 7: 执行 spec 5.2 真实场景全套测试

- **关联**：全部用户可见 UF / EVD-001..004
- **前置任务**：6
- **风险等级**：P0

**为什么做**：单测绿 ≠ DSH 能出片。

**验证**：5.2 矩阵。**若 BR-000 探测仍失败：本任务标已阻塞:上游 land_pages 未部署，不得标已完成。**

**Evidence**：`evidence/UF-001/` 等

### Task 8: 执行 Phase 2 回归验证

- **关联**：全部 BR/UF/INV
- **前置任务**：7

**验证**：smoke 全绿（需上游契约 39）；validate_package.py 0 FAIL。

**Evidence**：`evidence/phase-2/`

---

## 5. 验收与 Review 协议

### 5.1 命令级验证（入场券）

| 验证项 | 命令 | 期望 | Evidence |
|---|---|---|---|
| 插件构建 | `cd /Users/nothing/workspace/dsh/plugin/dsh-genoffice/plugin && pnpm run build && pnpm run typecheck` | 全绿；lib 含 land_pages | EVD-005 |
| 无桌面版 | `rg "桌面版" packages/tab-genoffice/src` | 无匹配 | EVD-005 |
| catalog | `rg "不要主动触发" packages/tab-genoffice/src/host/skill.ts` | 命中 description | EVD-005 |
| host 测 | 插件测试：generate_deck → land_pages | 全绿 | EVD-006 |
| 无 slides renderer diff | git diff 无 `upstream/apps/slides` | 无 | INV-001 |
| smoke | `node scripts/dev.mjs smoke`（栈根） | 上游+本表后全绿 | EVD-007 |

### 5.2 真实场景全套测试（Real-Run，完成的唯一标准）

**环境准备**：

| 项 | 值 |
|---|---|
| 启动命令 | DSH 3080 加载 rebuild 后插件；relay 8787 为**上游已含 land_pages** 的 web-dist |
| 访问入口 | DSH 新会话；`/dsh-genoffice` |
| 测试账号/数据 | 复制空白 pptx；**不要**写 iframe AI settings / `.env` 进页面 |
| 干净状态定义 | 新 session；BR-000 探测已绿 |
| 可用测试工具 | `dsh-rpc.sh 3080`；`dsh-session-cat.sh`；chrome-devtools-proxy |

**执行矩阵**：

| UF | 执行方式 | 操作来源 | 必须核对的点 | Evidence |
|---|---|---|---|---|
| UF-001 主路径 | DSH 会话 | 2.3 UF-001 | generate_deck 无 no local LLM、无 Genspark 登录；≥3 页真文字；add_shape 非 scratch；save 前 mtime 不变 | `evidence/UF-001/success.jsonl` |
| UF-001 规划失败 | mock/短 prompt 逼空（若不能则记录无法注入模型失败，用非法 pages_spec 空数组走 host 校验） | 2.3 | `planning failed:` 或明确拒绝；稿空白 | `evidence/UF-001/fail-planning.jsonl` |
| UF-002 主路径 | DSH | 2.3 | land_pages 2 页 | `evidence/UF-002/success.jsonl` |
| UF-003 非法 spec | DSH | 2.3 | isError；无桌面版；页数不变 | `evidence/UF-003/rejected.jsonl` |
| UF-004 replace_at | DSH | 2.3 | 页数不变；无 no local LLM | `evidence/UF-004/replaced.jsonl` |

**通过标准**：矩阵全行通过 **且** BR-000 绿。上游未就绪 = 未完成，不是跳过。

### 5.3 Evidence 目录结构与命名

```text
evidence/
  phase-0/
  phase-1/
  phase-2/
  UF-001/
  UF-002/
  UF-003/
  UF-004/
```

会话日志只摘 tool CALL/RES，不要整份 assistant/chunk。

### 5.4 Review 专项检查清单

- [ ] generate_deck 的 relay body 不是 iframe topic-only generate_deck
- [ ] 未把 secrets 写入 iframe
- [ ] catalog 仍【不要主动触发】
- [ ] errors 无桌面版
- [ ] lib/index.js 已 rebuild
- [ ] 无 slides renderer 改动
- [ ] BR-000 探测绿才标 5.2 完成
- [ ] 5.2 矩阵全过
- [ ] 入口接线：工具已注册到会话
- [ ] 所有 BR/UF/INV 可核销
