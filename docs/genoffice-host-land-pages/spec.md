# genoffice-host-land-pages Spec

> Version: 0.1.0 | Date: 2026-08-24 | Status: Ready 可执行
>
> 本文件是本需求的**唯一事实源**：事实基线、业务合同、技术方案、任务计划、验收协议全部在此。
> 其他文件（handoff.md、tasks.csv）只引用本文件，不复制内容。
>
> 填写三态规则：每个表格单元格只允许三种内容——
> 1. 验证过的事实（注明来源命令）；2. 显式假设 `ASM-xxx`；3. `待勘察`。
> 禁止编造看似合理的命令、symbol、文件名。

---

## 1. 事实基线与假设

### 1.1 需求与运行模式

| 项 | 结论 |
|---|---|
| 原始需求 | 控制模式出片的 LLM 归 DSH（或其他宿主 agent），不要 slides iframe BYOK。把「写页 → 落地」拆成和其他 `pptx_*` 一样的可交互控制面接口：宿主提交 `PageSpec[]`，iframe 只 parse/build/land。 |
| 输入类型 | description（当前对话：用户否定网页配 key，要求 handoff 做成可调用接口） |
| Mode | oneclick（执行包：spec + tasks.csv + handoff） |
| 置信度 | 高 |
| 输出目录 | `docs/genoffice-host-land-pages/`（相对 `/Users/nothing/workspace/dsh/genoffice`） |

### 1.2 任务类型路由

| 维度 | 结论 |
|---|---|
| 任务类型 | backend（控制面工具契约）+ frontend（iframe 落地、去 BYOK）+ prompt（DSH skill / generate_deck host 规划） |
| 主要风险 | 1) `generate_deck` 仍转发到 iframe LLM；2) 新增工具导致 smoke 工具计数漂移；3) 落地成功但未写 `htmlGenerated`，空白稿 `add_shape` 仍被 `blockScratchBuild` 拦 |
| 行号引用策略 | 业务/API 优先；行号仅 hint；三段式定位以 symbol + rg anchor 为准 |
| 必需验收方式 | contract（curl land_pages）+ DSH 会话工具（pptx_open → pptx_land_pages / pptx_generate_deck）+ slides vitest |
| 必须覆盖用户场景 | 空白稿出片、外部 agent 直调落地、非法 spec 拒绝、iframe 无 AI settings、单页重做、append |

### 1.3 勘察事实清单

> 每条事实来自本会话实际执行的命令。勘察日期 2026-08-24。

| 事实 | 来源命令 | 输出摘要 |
|---|---|---|
| 控制模式 DeckAccess 用 iframe `getAiSettings()`；`provider==='genspark'` 或缺 apiKey/model → `web control mode has no local LLM` | `read apps/slides/src/renderer/ai/control-deck-access.ts` | `loadControlAiSettings` L19-30；`NO_LOCAL_LLM` L17；`withLocalLlm` L41-46 |
| web `aiStream` 同样拒绝 genspark / 无 key | `read apps/slides/src/renderer/web-bridge.ts` | `runAiStream` L245-261 发 error chunk |
| `localGeneratePage` **已经**是纯落地：`parsePageSpec` + `buildPagePptx` + `issueCloudPage`，不打 LLM | 同上 | `slidesApi.localGeneratePage` L627-643 |
| `generatePageLocalWithLlm` 先 `runLlmOnce` 写 JSON，再调 `localGeneratePage` | `read apps/slides/src/renderer/ai/local-page-gen.ts` | L157-185 |
| `generate_deck` 在 `isCloudPageGenEnabled=false` 时走 `access.generatePageLocal`，再 `generateFromHtml([marker])` | `read apps/slides/src/renderer/ai/slides-skill.ts` | `gen` L2736；`flushLanded` L2754-2760 |
| 控制适配器把 skill 名原样执行：`createSlidesSkill(access).executeTool(call)` | `read apps/slides/src/renderer/control.ts` | `handleTool` L123-154 |
| DSH host 把 `pptx_*` 转成 `{call:{name: entry.skillName, input}}` POST 到 relay | `read packages/tab-genoffice/src/host/tools.ts` | L145-146 |
| `pptx_generate_deck` 已注册且 capability=`available`，文案仍写 iframe BYOK | `read packages/tab-genoffice/src/host/tool-schema.ts` + `capability.ts` | tool-schema L822-828；capability L73 |
| 空白稿实跑：`pptx_open` 成功后 `pptx_generate_deck` 上游原文 `Planning failed: web control mode has no local LLM` | `dsh-session-cat.sh … session-7942fd4a-ecf2-4b1f-9f74-27309374ea52` | CALL/RES 各一次，turn completed |
| 更早一次（旧 web-dist）报 `Cloud slide generation is unavailable — sign in to Genspark (gsk) first` | `dsh-session-cat.sh … session-f1ad5057-…` | 旧包；新包 `index-mLMRltQW.js` 已无该完整句 |
| `PageSpec` 形状：`background?` + `elements`（shape/text/image）；画布 1280×720；上限 48 元素 / 8 图 / 4000 字 | `read apps/slides/src/shared/page-spec.ts` | L26-31、L58-108、`parsePageSpec` L135、`buildPagePptx` L352 |
| 落地 marker 前缀 `cloudpptx:`，web 内存字节 | `read apps/slides/src/shared/cloud-page-marker.ts` | `CLOUD_PAGE_PREFIX` L6；`issueCloudPage` L10-12 |
| `htmlToPptx` web 实现支持 replace/append/replace_at/insert_at | `read apps/slides/src/renderer/web-slides-session.ts` | `webHtmlToPptx` L767 起 |
| `blockScratchBuild`：`htmlGenerated===true` 或带文字非装饰元素 >2 才放行 `add_text_box`/`add_shape`/`add_smartart` | `read apps/slides/src/renderer/ai/slides-skill.ts` | L1593-1615；cache `skillStateCache` L1524-1544 |
| `generate_deck` 成功后 `state.htmlGenerated = true` | 同上 | L2901 |
| 契约 pptx 工具计数锁 38；smoke 断言该数字 | `read contracts/control-api.md` + `scripts/dev.mjs` | control-api §4 注；dev.mjs L259-262 |
| 插件 guard 错误下一步仍写「从零出片请用桌面版 GenOffice」 | `read packages/tab-genoffice/src/host/errors.ts` | L109-116 |
| 运行时 skill `dsh-genoffice` 未写 land_pages / 宿主出片 | `read packages/tab-genoffice/src/host/skill.ts` | `GENOFFICE_SKILL_CONTENT` L17-40 |
| 已有单测：本地 generate_deck 落地 ≥3 页并解锁 add_text_box | `read apps/slides/tests/web-generate-deck-local.test.ts` | 用 mock `generatePageLocal`，不是 host 提交 spec |

### 1.4 假设清单

| 假设 ID | 内容 | 风险 | 确认方式 |
|---|---|---|---|
| ASM-001 | 控制模式写 spec 的 LLM = **调用方会话模型**（DSH session model 或其他 agent 自己的模型）。iframe 不再持有出片用 API key。 | 宿主模型质量差导致 spec 校验失败 | UF-001 实跑；非法 spec 走 UF-003 而非静默填页 |
| ASM-002 | 新增控制工具 `land_pages` / DSH `pptx_land_pages`（加法）。不删 `generate_deck` 工具名。smoke pptx 计数 38→39。 | 漏改 smoke / CONTROL_TOOL_TABLE 漂移 | BR-007；`node scripts/dev.mjs smoke` |
| ASM-003 | 外部 agent 调落地的方式和现有 `pptx_set_element_text` 相同：先让 iframe `control=1` 注册执行器，再 `POST /api/control/slides/<docId>/tool`。不新开 WebSocket。 | 调用方以为有独立 HTTP 生成服务 | UF-002 curl 样例 |
| ASM-004 | MVP 图片只接受 spec 里已有的 `https?://` URL（iframe `fetchImageBytes`）。不把 gsk `generate_image` 接入 host 出片。无图则纯色块+文字。 | 无图页偏素 | 非目标；失败记 `imageFailures`，不整套回滚 |
| ASM-005 | DSH `pptx_generate_deck` 改为 **host 实现**：会话模型写 outline + 每页 PageSpec，再调 `land_pages`。不再把 `topic` 原样转给 iframe `generate_deck`。 | host 超时（多页多次 LLM） | BR-010 已有 70s tool deadline 不够则 land_pages 按页调用；generate_deck host 侧可串行 land |
| ASM-006 | 控制模式 `plan_deck` / `generate_deck(topic only)` / `regenerate_slide(brief only)` 若仍打到 iframe，必须立刻 isError，不得再进 `withLocalLlm`。 | 旧客户端继续 topic-only | UF-004 |

---

## 质量记录

- 包生成后运行：`python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/genoffice-host-land-pages`
- 结果填执行时日志；生成阶段以脚本输出为准。

---

## 2. 业务合同

> 本章是 BR/UF/INV/EVD 的唯一定义处。任务、handoff、review 一律引用 ID，不复制表格。

### 2.1 BR 业务规则

| 规则 ID | 规则 | 正例 | 反例 | 影响范围 | 验证方式 |
|---|---|---|---|---|---|
| BR-001 | 控制模式出片路径禁止 iframe BYOK：`createControlDeckAccess` 不得对 generate/plan/style/regenerate 调用 `getAiSettings` / `aiStream` / `createRunLlmOnce` | `land_pages` 在 `localStorage` 无 `genoffice-web-ai-settings` 时成功落地 | iframe 再报 `web control mode has no local LLM` 作为出片前提 | slides control DeckAccess | UF-004 + rg |
| BR-002 | 新增 skill 工具 `land_pages`，DSH 名 `pptx_land_pages`，调用形状与现有控制工具相同：`{id,name,input}` → `{output,isError,mutated,summary}` | 合法 pages → mutated true，页进入 canvas | input 非对象 → relay `invalid input`，不执行 | control-api / control.ts / tools.ts | contract curl |
| BR-003 | `land_pages.input.pages` 的元素必须能通过现有 `parsePageSpec`（可先 `JSON.stringify` 单页再 parse）。画布默认 1280×720。超限/缺字段/越界 → isError，稿面不变 | 合法 shape+text spec 落地为可编辑元素 | `elements:[]` 且无 background、或 x<0 → 拒绝 | page-spec.ts | 单测 + UF-003 |
| BR-004 | `land_pages` 成功（至少 1 页 merge 进 deck）必须把该 docPath 的 `skillStateCache.htmlGenerated` 置 `true`，从而解除 `blockScratchBuild` | 落地后 `pptx_add_shape` 不再报 from-scratch guard | 只改了内存 pptx 但 cache 仍 false | slides-skill.ts | UF-001 末步 |
| BR-005 | 控制模式 `cloudGenStatus.enabled` 保持 `false`；禁止为了出片重新打开 gsk / `generatePageCloud` | `isCloudPageGenEnabled` 恒 false | 错误文案再出现 `sign in to Genspark` / Use cloud generation | web-bridge.ts | rg + UF-001 |
| BR-006 | 非法 spec / 空 pages / 错误 insert_mode：返回 isError，**不**改当前 slides，**不**写盘 | 坏 spec 后 `get_deck_context` 页数不变 | 半落地 1 页然后失败且无法区分 | land_pages | UF-003 |
| BR-007 | 四处镜像同步：`contracts/control-api.md` 工具表、relay 不改传输、插件 `CONTROL_TOOL_TABLE`+`CAPABILITY`、`scripts/dev.mjs` smoke 计数。pptx 家族 38→39 | smoke 全绿且含 `pptx_land_pages` | 只改插件不改契约 | INV-004 | `node scripts/dev.mjs smoke` |
| BR-008 | 落地只改 iframe 会话；写回仍仅 `pptx_save` / tab「写入磁盘」（现有 BR-008） | land 后磁盘 pptx 字节不变直到 save | land_pages 直接 POST /api/file | tools.ts / export | UF-001 核对 mtime |
| BR-009 | DSH `pptx_generate_deck`：无 `pages_spec` 时由 **host** 用会话模型生成 PageSpec[] 再 land；有 `pages_spec` 时跳过规划直接 land。禁止再转发 topic-only 到 iframe `generate_deck` | 空白稿 topic+approx_pages=3 → ≥3 页真文字 | 上游原文仍 `web control mode has no local LLM` | plugin host | UF-001 |
| BR-010 | 控制模式若仍收到 iframe 侧 `generate_deck`/`regenerate_slide`/`plan_deck` 且 payload 不含可落地 spec：isError，原文精确为 `control mode requires pages_spec; use land_pages`（不得再进 Planning LLM） | 旧客户端 topic-only → 该字符串 | 再进 `planDeckOutlineWithLlm` | slides-skill control 分支 | UF-004 |
| BR-011 | `insert_mode`：`replace`（默认，整套替换）、`append`（末尾追加）、`replace_at`/`insert_at`（需 `at_index` 整数）。语义对齐现有 `webHtmlToPptx` | append 后旧页仍在 | replace_at 越界却造新页 | webHtmlToPptx | UF-005/006 |
| BR-012 | 插件错误映射：出片/落地失败不得再写「用桌面版 GenOffice」。`no local LLM` 若仍出现，下一步改为「改走 pptx_land_pages / 宿主写 spec」 | errors.ts 无「桌面版」 | 模型被带去桌面云 | errors.ts | rg + UF-003 |

### 2.2 UF 用户验收场景（索引）

| 场景 ID | Given | When | Then | 角色 | 验证方式 | Evidence |
|---|---|---|---|---|---|---|
| UF-001 | DSH 已打开空白 pptx 控制模式；iframe 无 AI settings | 会话 `/dsh-genoffice` 后 `pptx_generate_deck({topic, approx_pages:3})` | ≥3 页、每页有真文字；随后 `pptx_add_shape` 不被 scratch guard 拒绝；磁盘未写直到 save | DSH agent | DSH 会话 + browser | EVD-001 |
| UF-002 | 同一空白稿执行器已注册 | 外部调用方 POST `land_pages` 带 2 页合法 PageSpec，`insert_mode:replace` | 200 execution.isError 空；context 显示 2 页 | 任意 agent | curl | EVD-002 |
| UF-003 | 执行器已注册，当前 1 空白页 | POST `land_pages` pages 非法（缺 elements 或坐标越界） | isError；页数仍为 1 | 任意 agent | curl | EVD-003 |
| UF-004 | iframe localStorage 无 `genoffice-web-ai-settings` | 直接 iframe `generate_deck` topic-only（不经 host） | isError 且原文含 `control mode requires pages_spec; use land_pages`；**没有** `web control mode has no local LLM` | 回归 | curl | EVD-004 |
| UF-005 | 已落地 ≥1 页 | `land_pages` `insert_mode:replace_at` + `at_index:0` 一页新 spec | 仅第 1 页内容替换，页数不变 | DSH/外部 | curl + context | EVD-005 |
| UF-006 | 已落地 ≥1 页 | `land_pages` `insert_mode:append` 一页新 spec | 页数 +1，旧页文本仍在 | DSH/外部 | curl + context | EVD-006 |

### 2.3 核心业务流程（步骤级交互脚本）

#### UF-001: DSH 空白稿宿主出片

**前置状态**：relay `:8787` 托管**当前** slides web-dist；DSH `:3080` 加载 `@deepseek-ai/dsh-tab-genoffice`；空白文件 `/Users/nothing/workspace/dsh/plugin/session-tool/plugin/env/manual-view/空白演示文稿.pptx`（或同结构空白 pptx）；slides iframe **未**配置 `genoffice-web-ai-settings`。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | DSH 会话发送 `/dsh-genoffice` 并要求打开空白 pptx、生成 3 页 | 无 | 加载 runtime skill `dsh-genoffice` | skill 已注入 |
| 2 | 模型调 `pptx_open` | sidebar 打开 slides iframe | host 轮询 `POST /api/control/open` 直到 `registered:true` | 工具返回 `已打开控制模式：<path>` |
| 3 | 模型调 `pptx_generate_deck` `{topic, approx_pages:3}` | iframe 逐页出现（replace 后 append） | **host** 用会话模型写 PageSpec[]，再对 iframe 调 `land_pages`；**不**把 topic 转给 iframe generate_deck | 工具成功；非 `no local LLM` |
| 4 | 模型调 `pptx_get_deck_context` | 大纲刷新 | context 含 ≥3 页预览文字 | 页数与主题相关真文字 |
| 5 | 模型调 `pptx_add_shape`（任意非空页） | 画布多一个形状 | `blockScratchBuild` 因 `htmlGenerated` 放行 | isError 空；输出不含 Use cloud generation |
| 6 | （可选）`pptx_save` | tab 写入磁盘 | 仅此时 POST /api/file | 磁盘 mtime 变化 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 执行器未挂上 | open 后 iframe 未 SSE | 工具 isError `executor not registered` | 不落地 | 只再 `pptx_open` 一次 |
| host 规划失败 | 会话模型空输出 / spec 两次 parse 失败 | generate_deck isError，稿面仍空白 | 不半落地 | 改 brief 重试或改调 `pptx_land_pages` 自带 spec |
| relay 旧包 | web-dist 无 land_pages | unrecognized tool / 旧 LLM 错误 | — | 重建 slides `npm run web:build` 并重启 8787 |

**界面状态机**：

```text
closed → open(registered) → landing → landed(htmlGenerated=true)
                |                |
                v                v
         executor-missing    land-error（稿面保持落地前）
```

**入口接线清单**：

- DSH tool `pptx_open` → better-sidebar 无 scope 打开 control iframe
- DSH tool `pptx_generate_deck` → **host 实现**（新）→ iframe `land_pages`
- DSH tool `pptx_land_pages` → relay `POST /api/control/slides/<docId>/tool` name=`land_pages`
- iframe `initControlMode` → `createSlidesSkill.executeTool`

#### UF-002: 外部 agent 直调 land_pages

**前置状态**：UF-001 步骤 2 已完成（registered）；调用方持有绝对路径，自算 `docId=sha256(path)`。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | POST `/api/control/open` `{path}` | — | `{ok,docId,registered:true}` | 确认执行器 |
| 2 | POST `/api/control/slides/<docId>/tool` `land_pages` 2 页合法 spec，replace | 画布替换为 2 页 | parse+build+htmlToPptx replace | execution.mutated=true |
| 3 | POST `.../context` | — | buildContext 大纲 | 2 页标题/预览 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 未注册 | 无 iframe | `{ok:false,error:'executor not registered'}` | 不转发 | 先 open control=1 |
| invalid input | call.input 非对象 | `{ok:false,error:'invalid input'}` | 不执行 | 修 JSON |

**界面状态机**：

```text
registered → tool(land_pages) → mutated
                    |
                    v
              invalid input / unregistered
```

**入口接线清单**：

- `contracts/control-api.md` §2.4 已有 tool 端点；新增的是 skill 名 `land_pages`，不是新传输

#### UF-003: 非法 spec 拒绝

**前置状态**：执行器已注册；deck 1 空白页。

**成功主路径**（此处「成功」=正确拒绝）：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | land_pages `pages:[{}]` 或 elements 越界 | 画布不变 | parsePageSpec ok:false；整次调用 isError | 页数仍 1 |
| 2 | get_deck_context | — | 与调用前一致 | 无半页 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 空 pages | `pages:[]` 或缺省 | isError `land_pages requires a non-empty pages array` | 不调用 htmlToPptx | 补 pages |
| 多页中第 2 页坏 | pages[1] 非法 | **整批拒绝**（BR-006），第 1 页也不落 | 先全部 parse | 修坏页后重提 |

**界面状态机**：

```text
registered → validate → error（state unchanged）
                 |
                 v
               land
```

**入口接线清单**：同 UF-002；校验在 iframe `land_pages` execute 入口，不在 relay。

#### UF-004: 无 iframe AI settings 时 topic-only 被拒

**前置状态**：控制 iframe 无 `genoffice-web-ai-settings`；执行器已注册。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | POST tool `generate_deck` `{topic, approx_pages:3}` **直接打 iframe** | 画布不变 | 不调用 `planDeckOutlineWithLlm` / `aiStream` | isError 原文 `control mode requires pages_spec; use land_pages` |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 旧包仍 BYOK | web-dist 未重建 | 可能仍 `no local LLM` | — | 重建并硬刷新 iframe |
| 误走云 | cloudGenStatus 被打开 | Genspark 文案 | 禁止 | BR-005 |

**界面状态机**：

```text
registered → generate_deck(topic-only) → isError(pages_spec required)
```

**入口接线清单**：`slides-skill.ts` `case 'generate_deck'` 控制模式短路；`createControlDeckAccess` 删除 `withLocalLlm` 规划。

#### UF-005: replace_at 重做一页

**前置状态**：deck ≥1 页已落地。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | land_pages 单页 spec，`insert_mode:replace_at`,`at_index:0` | 第 1 页画面替换 | `htmlToPptx(..., 'replace_at', 0)` | 页数不变；第 1 页新文字 |
| 2 | （DSH 包装）`pptx_regenerate_slide` 有 `page_spec` 时转本路径 | 同上 | host 若只有 brief：会话模型写一页 spec 再 land | 其他页不动 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| at_index 越界 | at_index>=页数 | isError，稿不变 | 对齐 webHtmlToPptx 现有错误 | 先 context |
| 无 spec 的 regenerate | iframe 只收到 brief | BR-010 字符串 | 不打 LLM | host 补 spec |

**界面状态机**：

```text
landed → replace_at → landed（页数同，index 页新）
```

**入口接线清单**：`pptx_land_pages` / `pptx_regenerate_slide` host 包装；iframe `land_pages` + 现有 `regenerateSlide`/`landReplaceAt`。

#### UF-006: append 追加页

**前置状态**：deck ≥1 页。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | land_pages 1 页 spec，`insert_mode:append` | 末尾多一页 | webHtmlToPptx append | 页数 +1；旧页文本仍在 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 无 session | 未打开稿 | append 现有错误 `No deck to append to` | 不造新会话 | 先 open / replace |

**界面状态机**：

```text
landed → append → landed(n+1)
```

**入口接线清单**：同 UF-002，`insert_mode:append`。

### 2.4 INV 不变量

| 不变量 ID | 内容 | 关联 BR/UF | 验证方式 |
|---|---|---|---|
| INV-001 | 非控制模式（无 `control=1`）AiPanel BYOK / 桌面 `aiStream` 行为不变 | BR-001 | 无 control 打开 /slides/ ，不改 settings UI |
| INV-002 | `cloudGenStatus.enabled===false`；`cloudGeneratePage` 仍不可用 | BR-005 | rg + 单测 |
| INV-003 | 已有 `pptx_set_element_*` / `pptx_read_slide` / `pptx_save` 形状与语义不变 | BR-002 | smoke + 抽测 context |
| INV-004 | 控制契约四处镜像（control-api、适配器工具名、CONTROL_TOOL_TABLE、smoke） | BR-007 | `node scripts/dev.mjs smoke` |
| INV-005 | 落地不写原文件；写盘仅显式 save | BR-008 | UF-001 步骤 5 前 mtime |
| INV-006 | 不放宽 `blockScratchBuild` 阈值（仍 ≤2 文字元素且 !htmlGenerated 拦截）。解锁只靠落地成功置 htmlGenerated 或稿已有内容 | BR-004 | 空白稿未落地时 add_shape 仍拒 |
| INV-007 | SSE+POST 控制传输不改为 WebSocket | ASM-003 | control-api §1 |
| INV-008 | `dsh-genoffice` catalog 仍含「【不要主动触发】」，不抢「做 PPT」路由 | skill.ts | 字符串断言 |

### 2.5 EVD 证据清单

| 证据 ID | 类型 | 期望证据 | 保存位置 |
|---|---|---|---|
| EVD-001 | log + api | 会话 JSONL：pptx_open 成功；pptx_generate_deck 非 no local LLM；context ≥3 页；add_shape 非 scratch | `evidence/UF-001/` |
| EVD-002 | api | curl land_pages 200 + execution + context | `evidence/UF-002/` |
| EVD-003 | api | 非法 spec isError + context 页数未变 | `evidence/UF-003/` |
| EVD-004 | api | iframe generate_deck topic-only 精确错误串；无 no local LLM | `evidence/UF-004/` |
| EVD-005 | api | replace_at 页数不变、第 1 页文字变 | `evidence/UF-005/` |
| EVD-006 | api | append 页数 +1 | `evidence/UF-006/` |
| EVD-007 | test | slides vitest land_pages / 无 LLM | `evidence/phase-1/` |
| EVD-008 | cmd | `node scripts/dev.mjs smoke` 全绿（pptx=39） | `evidence/phase-2/` |
| EVD-009 | cmd | plugin build/typecheck | `evidence/phase-2/` |

### 2.6 角色与权限矩阵

| 角色 | 可见 | 可操作 | 禁止 | 失败提示 | 验证场景 |
|---|---|---|---|---|---|
| DSH 会话 agent | pptx_* 工具（含 land_pages / generate_deck） | open / land / generate / save | iframe 配 key；python-pptx；ppt-image-first | 现有 classifyControlError | UF-001 |
| 外部控制面调用方 | HTTP `/api/control/*`（loopback） | 与 DSH 相同的 land_pages | 非 loopback 写回 | executor not registered / invalid input | UF-002 |
| 终端用户（看 iframe） | 画布页落地过程 | 手动改元素；写入磁盘 | 控制模式不出现 AI dock | — | INV-001 对照 |

### 2.7 负向 / 破坏性场景

| 场景 | Given | When | Then | Evidence |
|---|---|---|---|---|
| 权限 / 网络 | relay 未起 | land_pages | host fetch 失败，现有 relay-down 类错误 | EVD-001 失败可附 |
| 空数据 | pages 缺或 [] | land_pages | isError，稿不变 | EVD-003 |
| 旧数据兼容 | 旧 DSH 仍发 generate_deck topic-only 到 iframe | iframe 执行 | BR-010 错误，不打 LLM | EVD-004 |
| 重复提交 | 连续两次 replace 同一 spec | 第二次仍成功（幂等视觉） | 允许；不双写磁盘 | UF-002 |
| 半落地 | 3 页中第 2 页 spec 坏 | 整批拒绝 | BR-006 | EVD-003 |

### 2.8 非目标

- 不改 `blockScratchBuild` 的 2 元素阈值。
- 不在控制模式恢复 gsk 云出片 / 不要求 iframe 配 DeepSeek/Claude key。
- 不把 DSH 会话模型的 key 注入 `localStorage`。
- 不做图片生成闭环（ASM-004）。
- 不把 workflow 写回 system prompt；skill 仍 opt-in `dsh-genoffice`。
- 不改 docs/sheets/pdf 工具。
- 不把 Python / ppt-image-first 当作本需求的修复手段。

---

## 3. 技术方案

### 3.1 架构 Before / After

```text
Before:
DSH session LLM ── pptx_generate_deck(topic) ──► iframe generate_deck
                                              ├─ planDeckOutlineWithLlm  ─┐
                                              ├─ generateStyleSkillWithLlm ├─ iframe getAiSettings / aiStream
                                              └─ generatePageLocalWithLlm ─┘
                                              └─ localGeneratePage + htmlToPptx   (落地已存在)
空白 + 无 BYOK → "web control mode has no local LLM"

After:
DSH / 任意 agent ── pptx_land_pages(pages: PageSpec[]) ──► iframe land_pages
                         │                                 ├─ parsePageSpec
                         │                                 ├─ buildPagePptx
                         │                                 ├─ issueCloudPage
                         │                                 └─ htmlToPptx + htmlGenerated=true
                         │
                   pptx_generate_deck(topic)  [host 实现]
                         ├─ 会话模型写 outline + PageSpec[]
                         └─ 内部调用 land_pages（可逐页）
iframe 不再为出片持有 API key
```

### 3.2 模块改造

| 模块 | 职责 | 改造说明 |
|---|---|---|
| `page-spec.ts` | spec 校验与单页 pptx 字节 | **不改语义**；land_pages 复用 `parsePageSpec` / `buildPagePptx` |
| `control-deck-access.ts` | 控制模式 DeckAccess | 删除 `withLocalLlm` / `loadControlAiSettings`。`generatePageLocal`/`planDeckOutline`/`generateStyleSkill` 对无 spec 的调用返回固定错误。落地方法保留 |
| `slides-skill.ts` | AGENT_TOOLS + executeTool | 新增 `land_pages`；`generate_deck`/`regenerate_slide`/`plan_deck` 在控制模式（ASM-006：用 DeckAccess 标记或 `CONTROL_MODE`）无 spec 时短路 |
| `control.ts` | 执行器 | 无需新传输；新工具名走现有 handleTool |
| `web-bridge.ts` | localGeneratePage / aiStream | localGeneratePage 保持；控制出片不再依赖 aiStream。非控制 INV-001 保留 aiStream |
| `tool-schema.ts` + `capability.ts` + `tools.ts` | DSH 工具表 | 注册 `pptx_land_pages`；`pptx_generate_deck` 改为 host 实现（不走 generic executeControl） |
| `errors.ts` / `skill.ts` | 文案 | 去掉桌面版；skill 写清 land_pages 与宿主出片 |
| `contracts/control-api.md` + `scripts/dev.mjs` | 镜像 | 工具表 + pptx 39 |

### 3.3 三段式定位清单

| 文件 | 稳定定位 | 搜索定位 | 行号 hint | 备注 |
|---|---|---|---|---|
| `upstream/apps/slides/src/shared/page-spec.ts` | `export interface PageSpec` / `parsePageSpec` / `buildPagePptx` | `rg "export interface PageSpec" apps/slides/src/shared/page-spec.ts` | L105 / L135 / L352 | 不改校验上限除非 spec 证明必要 |
| `upstream/apps/slides/src/renderer/ai/control-deck-access.ts` | `loadControlAiSettings` / `createControlDeckAccess` / `withLocalLlm` | `rg "NO_LOCAL_LLM" apps/slides/src/renderer/ai/control-deck-access.ts` | L17-47 | 删除 BYOK 门闩 |
| `upstream/apps/slides/src/renderer/ai/slides-skill.ts` | `AGENT_TOOLS` `name: 'generate_deck'` / `function blockScratchBuild` / `case 'generate_deck'` | `rg "name: 'generate_deck'" apps/slides/src/renderer/ai/slides-skill.ts` | L771 / L1593 / L2345 | 新增 land_pages case |
| `upstream/apps/slides/src/renderer/ai/local-page-gen.ts` | `pageSpecSystemPrompt` / `generatePageLocalWithLlm` | `rg "pageSpecSystemPrompt" apps/slides/src/renderer/ai/local-page-gen.ts` | L47 / L157 | host 可复制 prompt 文本；插件不 import renderer |
| `upstream/apps/slides/src/renderer/web-bridge.ts` | `localGeneratePage` / `runAiStream` | `rg "localGeneratePage" apps/slides/src/renderer/web-bridge.ts` | L627 / L245 | 落地已就绪 |
| `upstream/apps/slides/src/renderer/web-slides-session.ts` | `webHtmlToPptx` | `rg "export async function webHtmlToPptx"` | L767 | 四种 mode |
| `upstream/apps/slides/src/renderer/control.ts` | `initControlMode` / `handleTool` | `rg "skill.executeTool" apps/slides/src/renderer/control.ts` | L144 | 无新通道 |
| `upstream/apps/slides/src/shared/cloud-page-marker.ts` | `issueCloudPage` | `rg "CLOUD_PAGE_PREFIX"` | L6 | 保持 |
| `plugin/.../src/host/tool-schema.ts` | `CONTROL_TOOL_TABLE` `pptx_generate_deck` | `rg "name: 'pptx_generate_deck'"` | L823 | 旁加 land_pages |
| `plugin/.../src/host/capability.ts` | `slides:generate_deck` | `rg "slides:generate_deck"` | L73 | 增 `slides:land_pages` available |
| `plugin/.../src/host/tools.ts` | `executeControl` / `registerControlTools` | `rg "entry.skillName" packages/tab-genoffice/src/host/tools.ts` | L146 | generate_deck 特判 host |
| `plugin/.../src/host/errors.ts` | `classifyControlError` GUARD_RE 分支 | `rg "桌面版"` | L109-116 | 改下一步 |
| `plugin/.../src/host/skill.ts` | `GENOFFICE_SKILL_CONTENT` | `rg "GENOFFICE_SKILL_CONTENT"` | L17 | 补 land 步骤 |
| `contracts/control-api.md` | §4 工具表 | `rg "pptx_generate_deck"` | ~L163 | 加行 + 计数 39 |
| `scripts/dev.mjs` | familyCount pptx | `rg "pptx 38"` | L259-262 | 改为 39 |

### 3.4 API / 数据 / 权限 / 路由影响

| 类型 | 是否影响 | 说明 | 兼容策略 |
|---|---|---|---|
| API | yes | 现有 `POST /api/control/slides/<docId>/tool` 增加 `name:"land_pages"`。无新 path | 旧客户端无此工具名则不调用；iframe 缺实现 → 未知工具 isError |
| 数据 | yes | `input.pages: PageSpec[]` 见下 JSON；不落新文件格式 | parse 失败不写会话 |
| 权限 | no | 仍 loopback；INV-002 沿用 | — |
| 路由 | no | 无新 HTTP 路由 | — |

**`land_pages` input（iframe skill / DSH 去掉 path 后的 skillInput）**：

```json
{
  "pages": [
    {
      "background": "#16395C",
      "elements": [
        {
          "type": "text",
          "x": 80, "y": 80, "w": 1120, "h": 80,
          "valign": "top",
          "paragraphs": [
            {
              "align": "left",
              "runs": [{ "text": "标题", "sizePt": 32, "bold": true, "color": "#FFFFFF" }]
            }
          ]
        }
      ]
    }
  ],
  "insert_mode": "replace",
  "at_index": 0,
  "deck_name": "可选文件名提示"
}
```

`insert_mode` 缺省 `replace`。`replace_at` / `insert_at` 时 `pages.length===1` 且必须有整数 `at_index`。

**DSH `pptx_land_pages` parameters**：上表 + 必填 `path`（绝对路径，host 在转发前剥离，与其他 pptx_* 一致）。

**DSH `pptx_generate_deck` 增参**（可选，不破坏现有 topic 字段）：

- `pages_spec`: 与 `land_pages.pages` 同形。若提供，host **跳过**规划 LLM，直接 land。
- 无 `pages_spec` 时 host 规划（BR-009）。

**精确错误串**：

| 条件 | `execution.output` 必须包含 |
|---|---|
| pages 空 | `land_pages requires a non-empty pages array` |
| 单页 parse 失败 | `invalid page spec:` + `parsePageSpec` 的 error |
| 控制模式 topic-only generate_deck 打到 iframe | `control mode requires pages_spec; use land_pages` |
| replace_at 越界 | 沿用 `webHtmlToPptx` 现有 `atIndex out of range` |

---

## 4. Phase 计划与任务详情

> Phase 依赖链：

```text
P0 契约冻结 ──► P1 iframe 落地原语 ──► P2 DSH host 接线 ──► P3 端到端验收
```

> 任务状态跟踪：同目录 `tasks.csv`。
> 任务标题必须是 `### Task {N}: {标题}` 格式。

### Phase 0: 契约冻结

> 你在哪里：落地管线已存在，但出片 LLM 绑在 iframe BYOK。
> 做完之后：control-api 与错误串/JSON 形状冻结，实现不得另起一套。

### Task 1: 冻结 land_pages 与 PageSpec 契约

- **关联**：BR-002 / BR-003 / BR-007 / BR-010 / BR-011 / UF-002 / INV-004 / EVD-008
- **前置任务**：无
- **风险等级**：P0

**为什么做**：先锁工具名、JSON、错误串和 pptx 计数，避免实现时 iframe 与 DSH 各写一套。

**涉及文件与定位**：

- `contracts/control-api.md`：§4 工具表，`rg "pptx_generate_deck"`
- `scripts/dev.mjs`：`rg "pptx 38"`

**具体操作**：

1. §4 增加 `pptx_land_pages` ↔ `land_pages` 行；`pptx_generate_deck` 备注改为「控制模式由宿主写 spec，iframe 只落地」。
2. 删除「控制模式 LLM 用 slides iframe 的 BYOK」那句。
3. 工具计数 pptx 38→39（skill 37→38）；同步 smoke。
4. 把本 spec 3.4 的错误串抄进契约「错误语义」表（只新增行，不改 executor not registered 等旧行）。

**验证**：`rg "pptx_land_pages" contracts/control-api.md` 有行；`rg "pptx === 39|pptx 39" scripts/dev.mjs` 命中。

**Evidence**：`evidence/phase-0/`

**注意事项**：禁止新 HTTP path；禁止 WebSocket。

### Task 2: 执行 Phase 0 回归验证

- **关联**：本 Phase 全部 BR
- **前置任务**：1

**验证**：契约 diff 只含加法 + 文案；`node scripts/dev.mjs smoke` 在实现 land_pages 前可能因计数/镜像 FAIL——若 FAIL，记为预期并在 P1/P2 清掉，本任务核对文档内部自洽即可。

**Evidence**：`evidence/phase-0/`

### Phase 1: iframe 落地原语

> 你在哪里：`localGeneratePage` 已能把 specJson 变成 marker。
> 做完之后：控制模式多一个 `land_pages` 工具；出片不再碰 iframe LLM。

### Task 3: iframe 新增 land_pages 并不再调控制模式 LLM

- **关联**：BR-001 / BR-002 / BR-003 / BR-005 / BR-006 / BR-011 / UF-002 / UF-003 / INV-002 / EVD-007
- **前置任务**：2
- **风险等级**：P0

**为什么做**：这是外部 agent 与 DSH 共用的原语，必须和 `set_element_text` 一样走 skill.executeTool。

**涉及文件与定位**：

- `slides-skill.ts`：`createSlidesSkill` / AGENT_TOOLS
- `control-deck-access.ts`：`createControlDeckAccess`
- `web-bridge.ts`：`localGeneratePage`（复用，不复制一份 build）

**具体操作**：

1. AGENT_TOOLS 增加 `land_pages`，inputSchema 对齐 3.4。
2. `executeTool` case：对 `pages` **全部** `parsePageSpec`；任一批失败 → 整批 isError（BR-006）。
3. 成功则逐页 `window.slidesApi.localGeneratePage({specJson})` 得 marker，再按 insert_mode 调已有 `generateFromHtml` / `regenerateSlide`（replace_at）。
4. 成功后 `state.htmlGenerated = true`（BR-004）。
5. `createControlDeckAccess` 删除 `loadControlAiSettings` / `withLocalLlm`。`generatePageLocal` 若仍被内部调用：只接受「已是 marker」或直接拆掉 LLM 包装，改为调用方必须先有 spec——控制路径以 `land_pages` 为准。
6. `isCloudPageGenEnabled` 保持 `async () => false`。

**验证**：`rg "land_pages" apps/slides/src/renderer/ai/slides-skill.ts`；`rg "withLocalLlm|loadControlAiSettings" apps/slides/src/renderer/ai/control-deck-access.ts` 无匹配。

**Evidence**：`evidence/phase-1/`

**注意事项**：不要改非控制 AiPanel 的 `createRunLlmOnce`。不要把 `runAiStream` 从 web-bridge 删掉（INV-001）。

### Task 4: generate_deck 与 regenerate_slide 控制模式改走 pages_spec

- **关联**：BR-009 / BR-010 / UF-004 / UF-005 / ASM-006
- **前置任务**：3
- **风险等级**：P0

**为什么做**：旧 DSH 仍可能把 `generate_deck` 转到 iframe；必须硬失败而不是再要 key。

**涉及文件与定位**：

- `slides-skill.ts`：`case 'generate_deck'` / `case 'regenerate_slide'` / `case 'plan_deck'`

**具体操作**：

1. 若 `call.input.pages_spec`（或 land 同形 `pages`）存在：内部转 `land_pages`（generate_deck）或 replace_at（regenerate）。
2. 否则控制模式返回精确串 `control mode requires pages_spec; use land_pages`。用 `CONTROL_MODE` 或 DeckAccess 上显式 `hostAuthoredSpecsOnly: true`（由 `createControlDeckAccess` 设置）区分 AiPanel。
3. AiPanel 非控制路径保持现有 LLM 管线（INV-001）。

**验证**：控制路径单测：topic-only generate_deck 不 mock LLM 即失败；带 pages_spec 则落地。

**Evidence**：`evidence/phase-1/`

### Task 5: 单测覆盖落地与守卫解锁

- **关联**：BR-003 / BR-004 / BR-006 / INV-006 / EVD-007 / UF-003
- **前置任务**：3;4
- **风险等级**：P1

**为什么做**：不依赖 DSH 也能锁 parse 失败不半落地、成功解锁 add_shape。

**涉及文件与定位**：

- `apps/slides/tests/web-generate-deck-local.test.ts`（扩或新建 `web-land-pages.test.ts`）

**具体操作**：

1. 合法 3 页 spec → session slides≥3 且文本非空 → 新 skill 实例 `add_text_box` 成功。
2. 非法 spec → isError，slide count 不变。
3. 断言控制 DeckAccess 测试中 **没有** `getAiSettings` 调用。

**验证**：`cd upstream/apps/slides && npx vitest run tests/web-land-pages.test.ts tests/web-generate-deck-local.test.ts tests/scratch-block.test.ts`

**Evidence**：`evidence/phase-1/`

### Task 6: 执行 Phase 1 回归验证

- **关联**：本 Phase 全部 BR/UF（单测级）
- **前置任务**：3;4;5

**验证**：上列 vitest 全绿；`rg "web control mode has no local LLM" apps/slides/src/renderer/ai/control-deck-access.ts` 无匹配（web-bridge `runAiStream` 可保留给非控制）。

**Evidence**：`evidence/phase-1/`

### Phase 2: DSH host 接线

> 你在哪里：iframe 能吃 spec。
> 做完之后：DSH 工具表可直接调 `pptx_land_pages`；`pptx_generate_deck` 用会话模型写 spec。

### Task 7: DSH 注册 pptx_land_pages 并镜像契约

- **关联**：BR-002 / BR-007 / INV-004 / EVD-008 / UF-002
- **前置任务**：6
- **风险等级**：P0

**为什么做**：和其他 pptx_* 一样出现在会话工具列表。

**涉及文件与定位**：

- `packages/tab-genoffice/src/host/tool-schema.ts`
- `packages/tab-genoffice/src/host/capability.ts`
- `packages/tab-genoffice/tests/capability.spec.ts`
- 重建 `lib/index.js`（不要只改 `capability.js` 残留）

**具体操作**：

1. `CONTROL_TOOL_TABLE` 加 `pptx_land_pages`，skillName `land_pages`，parameters 含 path + pages + insert_mode + at_index。
2. `CAPABILITY['slides:land_pages'] = {status:'available', netEgress:false, evidence:'land_pages → localGeneratePage'}`。
3. `pptx_generate_deck` / `pptx_regenerate_slide` 描述去掉「iframe 需配置非 genspark」。
4. smoke / capability 测试按 39 更新。

**验证**：plugin 测试含 `pptx_land_pages`；`isExposed` 为 true。

**Evidence**：`evidence/phase-2/`

### Task 8: DSH host 接管 pptx_generate_deck

- **关联**：BR-009 / UF-001 / ASM-001 / ASM-005 / EVD-001
- **前置任务**：7
- **风险等级**：P0

**为什么做**：用户明确出片 LLM 归 DSH；topic-only 不能再进 iframe。

**涉及文件与定位**：

- `packages/tab-genoffice/src/host/tools.ts`：`registerControlTools` / `executeControl`
- prompt 文本来源：`pageSpecSystemPrompt` / `PLAN_DECK_SYSTEM_PROMPT`（复制常量，禁止 plugin import slides renderer）

**具体操作**：

1. `pptx_land_pages` 走现有 `executeControl`（只转发 skillInput）。
2. `pptx_generate_deck`：**不要** `executeControl(..., generate_deck)`。host 逻辑：若 `pages_spec` 有值 → 当 land_pages；否则用 DSH 会话可用的 completion API（与当前 session 相同模型，**禁止**读 iframe settings / 禁止把 `.env` 写进页面）生成 outline + 每页 JSON，`parse` 失败最多重试 1 次，然后逐页或整批 `land_pages`。
3. `pptx_regenerate_slide`：若无 `page_spec`，host 写一页 spec 再 `replace_at`；有则直接 land。
4. 超时：单页 land 走现有 70s；host 规划循环自己 abort。
5. 失败映射走 `classifyControlError`，不得出现桌面版文案。

**验证**：单测或最小脚本 mock LLM 返回固定 spec，断言发出的 relay body `name==='land_pages'` 且 `name!=='generate_deck'`。

**Evidence**：`evidence/phase-2/`

**注意事项**：不要把 env 里的 API key 注入 iframe localStorage。host LLM 失败时错误应可区分「规划失败」vs「落地失败」。

### Task 9: 更新 skill 文案与错误下一步

- **关联**：BR-012 / INV-008 / UF-001
- **前置任务**：8
- **风险等级**：P1

**为什么做**：否则模型仍会去配网页 key 或改走 python。

**涉及文件与定位**：

- `skill.ts`：`GENOFFICE_SKILL_CONTENT`
- `errors.ts`：GUARD 下一步

**具体操作**：

1. skill 步骤：空白稿 → `pptx_generate_deck` 或自写 spec 后 `pptx_land_pages`；禁止 ppt-image-first / python-pptx。
2. catalog description 仍以「【不要主动触发】」开头，不提「做 PPT」。
3. errors.ts 去掉「桌面版 GenOffice」；no local LLM / pages_spec 的下一步指向 land_pages。
4. `source: 'runtime'` 保持。

**验证**：`rg "桌面版" packages/tab-genoffice/src` 无匹配（除非注释说明已删）；description 含【不要主动触发】。

**Evidence**：`evidence/phase-2/`

### Task 10: 执行 Phase 2 回归验证

- **关联**：本 Phase 全部 BR
- **前置任务**：7;8;9

**验证**：`cd plugin/dsh-genoffice/plugin && pnpm run build && pnpm run typecheck`（或该包惯用命令）；`node scripts/dev.mjs smoke` 全绿。

**Evidence**：`evidence/phase-2/`

### Phase 3: 端到端验收

> 你在哪里：代码与契约已锁。
> 做完之后：空白稿在无 iframe key 条件下真实出片。

### Task 11: 执行 spec 5.2 真实场景全套测试

- **关联**：全部用户可见 UF / EVD-001..006
- **前置任务**：10
- **风险等级**：P0

**为什么做**：单测绿不等于 DSH 会话能出片。

**验证**：按 5.2 执行矩阵逐行；全部通过。

**Evidence**：`evidence/UF-001/` 等矩阵所列路径。

### Task 12: 执行 Phase 3 回归验证

- **关联**：全部 BR/UF/INV
- **前置任务**：11

**验证**：smoke + 5.4 清单 + `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/genoffice-host-land-pages` 0 FAIL（真实场景已完成后证据闸门）。

**Evidence**：`evidence/phase-3/`

---

## 5. 验收与 Review 协议

> **验收铁律：命令级验证（5.1）通过只是入场券，不是完成。** 用户可见的需求必须通过 5.2 真实场景全套测试才算完成。

### 5.1 命令级验证（入场券）

| 验证项 | 命令 | 期望 | Evidence |
|---|---|---|---|
| slides 单测 | `cd upstream/apps/slides && npx vitest run tests/web-land-pages.test.ts tests/scratch-block.test.ts` | 全绿 | EVD-007 |
| 契约 smoke | `node scripts/dev.mjs smoke`（栈根 `/Users/nothing/workspace/dsh/genoffice`） | pptx=39 全绿 | EVD-008 |
| 插件构建 | `cd /Users/nothing/workspace/dsh/plugin/dsh-genoffice/plugin && pnpm run build && pnpm run typecheck` | 全绿；`lib/index.js` 含 land_pages | EVD-009 |
| 无 BYOK 门闩 | `rg "loadControlAiSettings|withLocalLlm" upstream/apps/slides/src/renderer/ai/control-deck-access.ts` | 无匹配 | EVD-007 |
| 无桌面版文案 | `rg "桌面版" plugin/packages/tab-genoffice/src` | 无匹配 | EVD-009 |

### 5.2 真实场景全套测试（Real-Run，完成的唯一标准）

> 在真实运行的 relay + DSH + 控制 iframe 上，把第 2.3 节每条流程从头到尾走一遍。禁止用「读了代码」代替。

**环境准备**：

| 项 | 值 |
|---|---|
| 启动命令 | 栈根 `node scripts/dev.mjs status`；relay `http://localhost:8787/api/health`；DSH `http://127.0.0.1:3080`（`DSH_HOME` 指向 genoffice plugin env）。slides 必须是含 `localGeneratePage` 的 **当前** web-dist，改代码后 `npm run web:build -w @genoffice/slides` 并重启 8787 |
| 访问入口 | DSH 新会话；控制 iframe `http://localhost:8787/slides/?control=1&open=path:<空白pptx>` |
| 测试账号/数据 | 空白 pptx：`/Users/nothing/workspace/dsh/plugin/session-tool/plugin/env/manual-view/空白演示文稿.pptx`（先复制一份以免污染）。**不要**向 iframe 写入 `.env` key |
| 干净状态定义 | 新 DSH session；复制空白 pptx；iframe Application 里无 `genoffice-web-ai-settings` 或可忽略 |
| 可用测试工具 | chrome-devtools-proxy；`dsh-rpc.sh 3080`；`dsh-session-cat.sh`；curl loopback 8787 |

**执行矩阵**：

| UF | 执行方式 | 操作来源 | 必须核对的点 | Evidence |
|---|---|---|---|---|
| UF-001 主路径 | DSH 会话 + browser | 2.3 UF-001 | open 成功；generate_deck 无 `no local LLM`、无 Genspark 登录句；context ≥3 页真文字；add_shape 非 scratch；save 前磁盘 mtime 不变 | `evidence/UF-001/success.jsonl` + `evidence/UF-001/context.txt` |
| UF-001 失败 执行器 | curl tool 在 iframe 关闭后 | 2.3 失败分支 | `executor not registered` | `evidence/UF-001/fail-unregistered.json` |
| UF-002 主路径 | curl | 2.3 UF-002 | land_pages 2 页 replace 成功 | `evidence/UF-002/success.json` |
| UF-002 失败 invalid input | curl | 2.3 | `invalid input` | `evidence/UF-002/fail-invalid.json` |
| UF-003 主路径 | curl | 2.3 | 坏 spec isError，页数不变 | `evidence/UF-003/rejected.json` |
| UF-003 空 pages | curl | 2.3 | 精确 `land_pages requires a non-empty pages array` | `evidence/UF-003/empty.json` |
| UF-004 主路径 | curl iframe generate_deck topic-only | 2.3 | 精确 `control mode requires pages_spec; use land_pages`；响应不含 `web control mode has no local LLM` | `evidence/UF-004/topic-only.json` |
| UF-005 主路径 | curl replace_at | 2.3 | 页数不变，第 1 页文字变 | `evidence/UF-005/replaced.json` |
| UF-006 主路径 | curl append | 2.3 | 页数 +1 | `evidence/UF-006/appended.json` |

**通过标准**：执行矩阵全部行通过且 evidence 齐全。任何一行失败 = 未完成。

### 5.3 Evidence 目录结构与命名

```text
evidence/
  phase-0/
  phase-1/
  phase-2/
  phase-3/
  UF-001/
  UF-002/
  UF-003/
  UF-004/
  UF-005/
  UF-006/
```

- EVD ID 必须能在第 2.5 节找到。
- API 样例保存完整 request/response JSON。

### 5.4 Review 专项检查清单

- [ ] 控制模式出片路径无 `getAiSettings` / `withLocalLlm`
- [ ] `pptx_generate_deck` 的 relay body 不是 iframe 侧 topic-only `generate_deck`
- [ ] smoke pptx=39 且四处镜像含 `land_pages`
- [ ] 空白未落地时 `add_shape` 仍被 blockScratchBuild 拦截（INV-006）
- [ ] 落地后 `htmlGenerated` 解锁 add_shape
- [ ] errors.ts / skill 无「桌面版」；catalog 仍【不要主动触发】
- [ ] 未把 secrets 写入 iframe localStorage
- [ ] 5.2 执行矩阵全部通过，evidence 齐全且与第 2.5 节 EVD 清单一致
- [ ] 2.3 节每条流程的入口接线已实现
- [ ] 所有 BR/UF/INV 可对照第 2 章核销
