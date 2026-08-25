# genoffice-land-pages-upstream Spec

> Version: 0.1.0 | Date: 2026-08-24 | Status: Ready 可执行
>
> 本文件是**上游 GenOffice**（`upstream/apps/slides` + `contracts/`）的唯一事实源。
> 不包含 DSH 插件 host 规划。插件包见 `../genoffice-land-pages-plugin/`。
>
> 填写三态规则：验证过的事实 / `ASM-xxx` / `待勘察`。禁止编造命令、symbol、文件名。

---

## 1. 事实基线与假设

### 1.1 需求与运行模式

| 项 | 结论 |
|---|---|
| 原始需求 | 把控制模式出片拆成可调用原语：宿主提交 `PageSpec[]`，slides iframe 只 parse/build/land。控制模式禁止 iframe BYOK。 |
| 输入类型 | description（用户要求把跨仓 handoff 切成上游 / 插件两份） |
| Mode | oneclick |
| 置信度 | 高 |
| 输出目录 | `docs/genoffice-land-pages-upstream/`（相对 `/Users/nothing/workspace/dsh/genoffice`） |
| 仓库边界 | **只改** `upstream/` 与 `contracts/` 与 `scripts/dev.mjs`。禁止改 `plugin/`。 |

### 1.2 任务类型路由

| 维度 | 结论 |
|---|---|
| 任务类型 | backend（控制契约工具名）+ frontend（iframe skill / DeckAccess） |
| 主要风险 | 1) 控制模式仍走 `withLocalLlm`；2) smoke pptx 计数未改 39；3) 落地成功但未写 `htmlGenerated` |
| 行号引用策略 | 业务/API 优先；行号 hint；symbol + rg anchor 为准 |
| 必需验收方式 | curl 控制面 `land_pages` + slides vitest + `node scripts/dev.mjs smoke` |
| 必须覆盖用户场景 | 外部 agent 直调落地、非法 spec 拒绝、topic-only 硬失败、replace_at、append |
| 不覆盖 | DSH `pptx_generate_deck` 用会话模型写 spec（插件包） |

### 1.3 勘察事实清单

> 勘察日期 2026-08-24。路径相对 `upstream/`，除非写明栈根。

| 事实 | 来源命令 | 输出摘要 |
|---|---|---|
| 控制模式 DeckAccess 用 iframe `getAiSettings()`；genspark / 无 key → `web control mode has no local LLM` | `read apps/slides/src/renderer/ai/control-deck-access.ts` | `NO_LOCAL_LLM` L17；`loadControlAiSettings` L19-30；`withLocalLlm` L41-46 |
| `localGeneratePage` 已是纯落地：`parsePageSpec` + `buildPagePptx` + `issueCloudPage` | `read apps/slides/src/renderer/web-bridge.ts` | L627-643 |
| `generate_deck` 在 `isCloudPageGenEnabled=false` 时走 `generatePageLocal` 再 `generateFromHtml([marker])` | `read apps/slides/src/renderer/ai/slides-skill.ts` | L2736 / L2754-2760 |
| 控制适配器：`createSlidesSkill(access).executeTool(call)` | `read apps/slides/src/renderer/control.ts` | `handleTool` L123-154 |
| `PageSpec`：`background?` + `elements`（shape/text/image）；1280×720；48 元素 / 8 图 / 4000 字 | `read apps/slides/src/shared/page-spec.ts` | L26-31、L58-108、`parsePageSpec` L135、`buildPagePptx` L352 |
| marker 前缀 `cloudpptx:` | `read apps/slides/src/shared/cloud-page-marker.ts` | L6 / L10-12 |
| `webHtmlToPptx` 支持 replace/append/replace_at/insert_at | `read apps/slides/src/renderer/web-slides-session.ts` | `webHtmlToPptx` L767 |
| `blockScratchBuild`：`htmlGenerated===true` 或带文字非装饰元素 >2 才放行 add_* | `read apps/slides/src/renderer/ai/slides-skill.ts` | L1593-1615；`skillStateCache` L1524-1544 |
| `generate_deck` 成功后 `state.htmlGenerated = true` | 同上 | L2901 |
| 契约 pptx 工具计数锁 38；smoke 断言 | `read contracts/control-api.md` + `scripts/dev.mjs` | §4 注；dev.mjs L259-262 |
| 空白稿经 DSH 打 iframe `generate_deck`：`Planning failed: web control mode has no local LLM` | `dsh-session-cat.sh … session-7942fd4a-…` | 证明 iframe 规划依赖 BYOK |
| `cloudGenStatus.enabled` 已是 false | `read apps/slides/src/renderer/web-bridge.ts` | L624 |

### 1.4 假设清单

| 假设 ID | 内容 | 风险 | 确认方式 |
|---|---|---|---|
| ASM-001 | 写 spec 的 LLM 在宿主（DSH 或其他 agent），不在 iframe。本包只提供落地原语。 | 上游完成后 DSH 未接仍不能 topic 出片 | 插件包 UF-001；本包不验收 DSH generate_deck |
| ASM-002 | 新增 skill 名 `land_pages`（加法）。不删 `generate_deck`。smoke pptx 38→39。 | 漏改 smoke | BR-007 |
| ASM-003 | 调用方式与现有工具相同：`POST /api/control/slides/<docId>/tool`。不新开 HTTP 生成服务 / WebSocket。 | 调用方找错入口 | UF-001 curl |
| ASM-004 | 图片只接受 spec 内 `https?://` URL（现有 `fetchImageBytes`）。无图则色块+文字。 | 页偏素 | `imageFailures` 不整套回滚 |
| ASM-005 | 用 `createControlDeckAccess` 上的 `hostAuthoredSpecsOnly: true`（或等价）区分控制模式 vs AiPanel，避免误伤非控制 LLM 管线 | 标错导致桌面出片挂 | INV-001 |

---

## 质量记录

- 生成后：`python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/genoffice-land-pages-upstream`

---

## 2. 业务合同

### 2.1 BR 业务规则

| 规则 ID | 规则 | 正例 | 反例 | 影响范围 | 验证方式 |
|---|---|---|---|---|---|
| BR-001 | 控制模式出片路径禁止 iframe BYOK：`createControlDeckAccess` 不得对 generate/plan/style/regenerate 调用 `getAiSettings` / `aiStream` / `createRunLlmOnce` | 无 `genoffice-web-ai-settings` 时 `land_pages` 仍成功 | 出片前提报 `web control mode has no local LLM` | control-deck-access.ts | UF-003 + rg |
| BR-002 | 新增 skill 工具 `land_pages`，调用形状 `{id,name,input}` → `{output,isError,mutated,summary}` | 合法 pages → mutated true | input 非对象 → relay `invalid input` | slides-skill + control.ts | UF-001 |
| BR-003 | `pages[]` 每页必须通过现有 `parsePageSpec`（默认 1280×720） | 合法 shape+text 落地为可编辑元素 | 缺 elements 或 x<0 → isError | page-spec.ts | UF-002 |
| BR-004 | `land_pages` 至少 1 页 merge 成功后，该 docPath 的 `skillStateCache.htmlGenerated=true` | 随后 `add_shape` 不被 from-scratch 拒 | 只改内存 pptx、cache 仍 false | slides-skill.ts | UF-001 末 + vitest |
| BR-005 | `cloudGenStatus.enabled` 保持 false；禁止为出片打开 gsk / `generatePageCloud` | `isCloudPageGenEnabled` 恒 false | 再出现 sign in to Genspark | web-bridge.ts | rg |
| BR-006 | 非法 spec / 空 pages / 错误 insert_mode：isError，**不**改当前 slides，**不**写盘 | 坏 spec 后页数不变 | 第 1 页已落、第 2 页失败 | land_pages | UF-002 |
| BR-007 | 镜像：`contracts/control-api.md` 工具表 + smoke 计数 pptx 38→39。本包**不**改插件 `CONTROL_TOOL_TABLE`（插件包负责） | smoke 在插件未注册前：契约侧 39，插件镜像可能 FAIL | 只改 skill 不改契约 | contracts + scripts/dev.mjs | 见 ASM-006 处理 |
| BR-008 | 落地只改 iframe 会话；写回仍仅 export/`pptx_save` | land 后磁盘 mtime 不变 | land_pages 直接 POST /api/file | INV-005 | UF-001 |
| BR-009 | 控制模式收到 `generate_deck`/`regenerate_slide`/`plan_deck` 且 payload 无 `pages_spec`（或同形 `pages`）：isError，原文精确 `control mode requires pages_spec; use land_pages`。不得进 Planning LLM | topic-only → 该字符串 | 再进 `planDeckOutlineWithLlm` | slides-skill.ts | UF-003 |
| BR-010 | `insert_mode`：`replace`（默认）、`append`、`replace_at`/`insert_at`（需整数 `at_index`）。语义对齐 `webHtmlToPptx` | append 后旧页仍在 | replace_at 越界却造新页 | webHtmlToPptx | UF-004 / UF-005 |
| BR-011 | `generate_deck` 若带 `pages_spec`（PageSpec[]）：内部转 `land_pages`，不打 LLM | 带 spec 的 generate_deck 落地 | 带 spec 仍走 BYOK | slides-skill.ts | UF-001 可选 |

### 2.2 UF 用户验收场景（索引）

| 场景 ID | Given | When | Then | 角色 | 验证方式 | Evidence |
|---|---|---|---|---|---|---|
| UF-001 | 空白 pptx 已 `control=1` 注册执行器；iframe 无 AI settings | POST `land_pages` 2 页合法 PageSpec，`insert_mode:replace` | execution 非 isError；context 2 页；磁盘未变 | 外部 agent | curl | EVD-001 |
| UF-002 | 执行器已注册，当前 1 空白页 | POST `land_pages` 非法 pages | isError；页数仍 1 | 外部 agent | curl | EVD-002 |
| UF-003 | iframe 无 AI settings | POST `generate_deck` `{topic, approx_pages:3}` | isError 含 `control mode requires pages_spec; use land_pages`；**不含** `web control mode has no local LLM` | 回归 | curl | EVD-003 |
| UF-004 | 已落地 ≥1 页 | `land_pages` `replace_at` + `at_index:0` | 页数不变；第 1 页文字变 | 外部 agent | curl | EVD-004 |
| UF-005 | 已落地 ≥1 页 | `land_pages` `append` 一页 | 页数 +1；旧页文本仍在 | 外部 agent | curl | EVD-005 |

### 2.3 核心业务流程（步骤级交互脚本）

#### UF-001: curl land_pages replace

**前置状态**：relay `:8787` 托管**当前** slides web-dist（含本包改动）；空白 pptx 绝对路径已知；`control=1&open=path:` iframe 已 SSE 注册。不要配 iframe AI settings。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | POST `/api/control/open` `{path}` | — | `{ok,docId,registered:true}` | 执行器在 |
| 2 | POST `/api/control/slides/<docId>/tool` name=`land_pages`，2 页合法 spec，replace | 画布换成 2 页 | 全部 parse → localGeneratePage → htmlToPptx replace；htmlGenerated=true | mutated true |
| 3 | POST `.../context` | — | buildContext | 2 页预览文字 |
| 4 | （可选）POST tool `add_shape` | 画布多样子 | blockScratchBuild 放行 | 非 from-scratch 错误 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 未注册 | 无 iframe | `executor not registered` | 不转发 | 先打开 control=1 |
| invalid input | call.input 非对象 | `invalid input` | 不执行 | 修 JSON |
| 旧 web-dist | 无 land_pages case | 未知工具 / 旧 LLM 错 | — | `npm run web:build` 并重启 8787 |

**界面状态机**：

```text
closed → open(registered) → land_pages → landed(htmlGenerated)
                |                  |
                v                  v
         unregistered          land-error（稿面不变）
```

**入口接线清单**：

- `initControlMode` → `executeTool`
- AGENT_TOOLS `land_pages` → `localGeneratePage` + `generateFromHtml`

#### UF-002: 非法 spec 整批拒绝

**前置状态**：UF-001 步骤 1 完成；deck 1 空白页。

**成功主路径**（正确拒绝）：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | land_pages `pages:[{}]` 或越界坐标 | 画布不变 | parsePageSpec 失败；整次 isError | 页数 1 |
| 2 | 空 `pages:[]` | 不变 | isError `land_pages requires a non-empty pages array` | 未调 htmlToPptx |
| 3 | 3 页中第 2 页坏 | 不变 | 先全部 parse，整批拒绝 | 无半落地 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 半落地 bug | 实现先落再 parse 下一页 | 页数变了 | 违反 BR-006 | 改为先全部 parse |

**界面状态机**：

```text
registered → validate-all → error（state unchanged）
```

**入口接线清单**：`land_pages` execute 入口，不在 relay。

#### UF-003: topic-only generate_deck 硬失败

**前置状态**：控制 iframe 无 AI settings；执行器已注册。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | POST tool `generate_deck` `{topic,approx_pages:3}` | 画布不变 | 不调用 planDeckOutlineWithLlm / aiStream | 原文含 `control mode requires pages_spec; use land_pages` |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 仍 BYOK | 未删 withLocalLlm | `web control mode has no local LLM` | 违反 BR-001/009 | 删控制模式 LLM 门闩 |
| 误走云 | cloudGenStatus true | Genspark 文案 | 违反 BR-005 | 保持 enabled:false |

**界面状态机**：

```text
registered → generate_deck(topic-only) → isError(pages_spec required)
```

**入口接线清单**：`case 'generate_deck'` 看 `hostAuthoredSpecsOnly`；AiPanel 非控制不走此分支。

#### UF-004: replace_at

**前置状态**：已有 ≥1 页落地。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | land_pages 单页 spec，`insert_mode:replace_at`,`at_index:0` | 第 1 页替换 | htmlToPptx replace_at | 页数不变；文字变 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 越界 | at_index>=页数 | isError，稿不变 | 沿用 `atIndex out of range` | 先 context |
| pages.length≠1 | 多页 replace_at | isError | 对齐 webHtmlToPptx | 每次一页 |

**界面状态机**：

```text
landed → replace_at → landed（n 同）
```

**入口接线清单**：land_pages → landReplaceAt / htmlToPptx replace_at。

#### UF-005: append

**前置状态**：已有 ≥1 页。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | land_pages 1 页，`insert_mode:append` | 末尾多一页 | webHtmlToPptx append | 页数 +1；旧页仍在 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 无 session | 未打开稿 | `No deck to append to` | 不造新会话 | 先 open / replace |

**界面状态机**：

```text
landed → append → landed(n+1)
```

**入口接线清单**：同 UF-001，`insert_mode:append`。

### 2.4 INV 不变量

| 不变量 ID | 内容 | 关联 BR/UF | 验证方式 |
|---|---|---|---|
| INV-001 | 非控制模式 AiPanel BYOK / `runAiStream` 行为不变 | BR-001 | 无 control 打开 /slides/ |
| INV-002 | `cloudGenStatus.enabled===false` | BR-005 | rg + 单测 |
| INV-003 | 已有 set_element_* / read_slide / save 语义不变 | BR-002 | smoke 抽测 |
| INV-004 | 控制传输仍 SSE+POST，无 WebSocket | ASM-003 | control-api §1 |
| INV-005 | 落地不写原文件 | BR-008 | UF-001 mtime |
| INV-006 | 不放宽 blockScratchBuild 阈值 | BR-004 | 未落地空白稿 add_shape 仍拒 |
| INV-007 | 本包不改 DSH plugin 源码 | 仓库边界 | git diff 无 plugin/ |

### 2.5 EVD 证据清单

| 证据 ID | 类型 | 期望证据 | 保存位置 |
|---|---|---|---|
| EVD-001 | api | curl land_pages 成功 + context | `evidence/UF-001/` |
| EVD-002 | api | 非法 spec / 空 pages isError + 页数未变 | `evidence/UF-002/` |
| EVD-003 | api | topic-only 精确错误串；无 no local LLM | `evidence/UF-003/` |
| EVD-004 | api | replace_at | `evidence/UF-004/` |
| EVD-005 | api | append 页数 +1 | `evidence/UF-005/` |
| EVD-006 | test | vitest land_pages / scratch unlock | `evidence/phase-1/` |
| EVD-007 | cmd | `node scripts/dev.mjs smoke`（契约 pptx=39；插件未同步时若 FAIL，记录在 phase-0 并在插件包清掉——本包契约+skill 必须已是 39） | `evidence/phase-2/` |

### 2.6 角色与权限矩阵

| 角色 | 可见 | 可操作 | 禁止 | 失败提示 | 验证场景 |
|---|---|---|---|---|---|
| 外部控制面调用方 | `/api/control/*` loopback | land_pages | 非 loopback 写回 | executor not registered / invalid input | UF-001 |
| 终端用户（看 iframe） | 画布落地 | 手动改元素；写入磁盘 | 控制模式 AI dock | — | INV-001 |

### 2.7 负向 / 破坏性场景

| 场景 | Given | When | Then | Evidence |
|---|---|---|---|---|
| 空数据 | pages [] | land_pages | 精确空数组错误 | EVD-002 |
| 旧客户端 | topic-only generate_deck | iframe 执行 | BR-009 字符串，不打 LLM | EVD-003 |
| 半落地 | 多页中一页坏 | land_pages | 整批拒绝 | EVD-002 |
| 未注册 | 无 iframe | tool | executor not registered | UF-001 失败 |

### 2.8 非目标

- 不实现 DSH `pptx_generate_deck` host 规划（插件包）。
- 不改 `blockScratchBuild` 阈值。
- 不恢复 gsk 云出片。
- 不把 API key 写入 iframe。
- 不改 docs/sheets/pdf。
- 不改 `plugin/`。

---

## 3. 技术方案

### 3.1 架构 Before / After

```text
Before:
宿主 ── generate_deck(topic) ──► iframe LLM (getAiSettings) ──► localGeneratePage
无 key → "web control mode has no local LLM"

After:
宿主 ── land_pages(pages: PageSpec[]) ──► parsePageSpec → buildPagePptx → htmlToPptx
generate_deck(topic-only, control) ──► isError pages_spec required
generate_deck(pages_spec, control) ──► 转 land_pages
AiPanel 非控制：LLM 管线不变
```

### 3.2 模块改造

| 模块 | 职责 | 改造说明 |
|---|---|---|
| `page-spec.ts` | 校验/建页 | **不改语义**；复用 |
| `control-deck-access.ts` | 控制 DeckAccess | 删 `withLocalLlm` / `loadControlAiSettings`；设 `hostAuthoredSpecsOnly: true` |
| `slides-skill.ts` | AGENT_TOOLS + execute | 新增 `land_pages`；控制模式 topic-only 短路；成功写 htmlGenerated |
| `control.ts` | 执行器 | 无新传输 |
| `web-bridge.ts` | localGeneratePage / aiStream | 落地保持；`runAiStream` 留给非控制（INV-001） |
| `contracts/control-api.md` + `scripts/dev.mjs` | 镜像 | 加 `land_pages` 行；pptx 39 |

### 3.3 三段式定位清单

| 文件 | 稳定定位 | 搜索定位 | 行号 hint | 备注 |
|---|---|---|---|---|
| `upstream/apps/slides/src/shared/page-spec.ts` | `export interface PageSpec` / `parsePageSpec` / `buildPagePptx` | `rg "export interface PageSpec"` | L105 / L135 / L352 | |
| `upstream/apps/slides/src/renderer/ai/control-deck-access.ts` | `createControlDeckAccess` / `withLocalLlm` | `rg "NO_LOCAL_LLM"` | L17-47 | 删除 BYOK |
| `upstream/apps/slides/src/renderer/ai/slides-skill.ts` | `name: 'generate_deck'` / `blockScratchBuild` / `case 'generate_deck'` | `rg "name: 'generate_deck'"` | L771 / L1593 / L2345 | 加 land_pages |
| `upstream/apps/slides/src/renderer/web-bridge.ts` | `localGeneratePage` | `rg "localGeneratePage"` | L627 | 复用 |
| `upstream/apps/slides/src/renderer/web-slides-session.ts` | `webHtmlToPptx` | `rg "export async function webHtmlToPptx"` | L767 | |
| `upstream/apps/slides/src/renderer/control.ts` | `handleTool` | `rg "skill.executeTool"` | L144 | |
| `contracts/control-api.md` | §4 | `rg "pptx_generate_deck"` | ~L163 | 加 land_pages |
| `scripts/dev.mjs` | familyCount pptx | `rg "pptx 38"` | L259-262 | →39 |

### 3.4 API / 数据 / 权限 / 路由影响

| 类型 | 是否影响 | 说明 | 兼容策略 |
|---|---|---|---|
| API | yes | 现有 tool 端点增加 `name:"land_pages"`。无新 path | 缺实现 → 未知工具 isError |
| 数据 | yes | `input.pages: PageSpec[]` | parse 失败不写会话 |
| 权限 | no | 仍 loopback | — |
| 路由 | no | — | — |

**`land_pages` input**：

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
            { "align": "left", "runs": [{ "text": "标题", "sizePt": 32, "bold": true, "color": "#FFFFFF" }] }
          ]
        }
      ]
    }
  ],
  "insert_mode": "replace",
  "at_index": 0,
  "deck_name": "可选"
}
```

`insert_mode` 缺省 `replace`。`replace_at`/`insert_at` 要求 `pages.length===1` 且整数 `at_index`。

**精确错误串**：

| 条件 | output 必须包含 |
|---|---|
| pages 空 | `land_pages requires a non-empty pages array` |
| 单页 parse 失败 | `invalid page spec:` + parsePageSpec error |
| 控制模式 topic-only generate_deck | `control mode requires pages_spec; use land_pages` |
| replace_at 越界 | 现有 `atIndex out of range` |

**契约表新增行**：`pptx_land_pages` ↔ `land_pages`（DSH 名先占位；插件未注册前 smoke 的「host 表」断言若失败，本包 evidence 注明「待插件包 Task 1」——契约文件本身必须已有该行）。

---

## 4. Phase 计划与任务详情

```text
P0 契约 ──► P1 iframe 原语 ──► P2 端到端（curl）
```

### Task 1: 冻结 land_pages 契约与 smoke 计数

- **关联**：BR-002 / BR-007 / BR-009 / INV-004 / EVD-007
- **前置任务**：无
- **风险等级**：P0

**为什么做**：先锁名字、JSON、错误串、pptx 39。

**涉及文件与定位**：`contracts/control-api.md`；`scripts/dev.mjs`

**具体操作**：

1. §4 增加 `land_pages` / `pptx_land_pages` 行；`generate_deck` 备注改为控制模式需 `pages_spec`，iframe 不 BYOK。
2. 删除「控制模式 LLM 用 slides iframe 的 BYOK」。
3. pptx 38→39（skill 37→38）。
4. 错误语义表增加 BR-009 字符串。

**验证**：`rg "pptx_land_pages|land_pages" contracts/control-api.md`；`rg "pptx 39|pptx === 39" scripts/dev.mjs`

**Evidence**：`evidence/phase-0/`

**注意事项**：禁止新 HTTP path。smoke 可能因插件表未同步 FAIL——记入 evidence，由插件包清；本任务完成标准是契约文件与 scripts 数字已改。

### Task 2: 执行 Phase 0 回归验证

- **关联**：本 Phase 全部 BR
- **前置任务**：1

**验证**：契约 diff 仅加法+文案。

**Evidence**：`evidence/phase-0/`

### Task 3: iframe 新增 land_pages 并拆除控制模式 LLM

- **关联**：BR-001 / BR-002 / BR-003 / BR-005 / BR-006 / BR-010 / UF-001 / UF-002 / INV-001 / INV-002 / EVD-006
- **前置任务**：2
- **风险等级**：P0

**为什么做**：外部 agent 与未来 DSH 共用的原语。

**涉及文件与定位**：`slides-skill.ts`；`control-deck-access.ts`；`web-bridge.ts` `localGeneratePage`

**具体操作**：

1. AGENT_TOOLS 增加 `land_pages`。
2. execute：先**全部** parsePageSpec；任一批失败 → 整批 isError。
3. 成功则逐页 `localGeneratePage` 得 marker，再按 insert_mode 调 generateFromHtml / regenerateSlide。
4. 成功后 `state.htmlGenerated = true`。
5. 删除 `loadControlAiSettings` / `withLocalLlm`。设置 `hostAuthoredSpecsOnly: true`。
6. `isCloudPageGenEnabled` 保持 false。
7. **不要**删除 web-bridge `runAiStream`（INV-001）。

**验证**：`rg "name: 'land_pages'" apps/slides/src/renderer/ai/slides-skill.ts`；`rg "withLocalLlm|loadControlAiSettings" apps/slides/src/renderer/ai/control-deck-access.ts` 无匹配。

**Evidence**：`evidence/phase-1/`

### Task 4: 控制模式 generate_deck / regenerate_slide / plan_deck 短路

- **关联**：BR-009 / BR-011 / UF-003 / ASM-005
- **前置任务**：3
- **风险等级**：P0

**为什么做**：旧客户端仍会把 topic-only 打进 iframe。

**具体操作**：

1. `hostAuthoredSpecsOnly` 且无 pages_spec → 精确错误串。
2. 有 pages_spec → 转 land_pages（generate_deck）或 replace_at（regenerate 单页）。
3. AiPanel 非控制保持 LLM 管线。

**验证**：单测 topic-only 不 mock LLM 即失败。

**Evidence**：`evidence/phase-1/`

### Task 5: 单测落地与守卫

- **关联**：BR-003 / BR-004 / BR-006 / INV-006 / EVD-006
- **前置任务**：3;4
- **风险等级**：P1

**具体操作**：新建 `tests/web-land-pages.test.ts`（或扩现有）：合法 3 页解锁 add_text_box；非法 spec 页数不变；控制 DeckAccess 无 getAiSettings。

**验证**：`cd upstream/apps/slides && npx vitest run tests/web-land-pages.test.ts tests/scratch-block.test.ts`

**Evidence**：`evidence/phase-1/`

### Task 6: 执行 Phase 1 回归验证

- **关联**：本 Phase 全部 BR
- **前置任务**：3;4;5

**验证**：vitest 全绿；control-deck-access 无 `NO_LOCAL_LLM`。

**Evidence**：`evidence/phase-1/`

### Task 7: 执行 spec 5.2 真实场景全套测试

- **关联**：全部用户可见 UF / EVD-001..005
- **前置任务**：6
- **风险等级**：P0

**验证**：5.2 矩阵（curl，不跑 DSH generate_deck）。

**Evidence**：`evidence/UF-001/` 等

### Task 8: 执行 Phase 2 回归验证

- **关联**：全部 BR/UF/INV
- **前置任务**：7

**验证**：5.4 清单；`python3 …/validate_package.py docs/genoffice-land-pages-upstream` 0 FAIL。

**Evidence**：`evidence/phase-2/`

---

## 5. 验收与 Review 协议

### 5.1 命令级验证（入场券）

| 验证项 | 命令 | 期望 | Evidence |
|---|---|---|---|
| vitest | `cd upstream/apps/slides && npx vitest run tests/web-land-pages.test.ts tests/scratch-block.test.ts` | 全绿 | EVD-006 |
| 无 BYOK 门闩 | `rg "loadControlAiSettings|withLocalLlm" upstream/apps/slides/src/renderer/ai/control-deck-access.ts` | 无匹配 | EVD-006 |
| 契约 | `rg "land_pages" contracts/control-api.md` | 有行 | EVD-007 |
| smoke | `node scripts/dev.mjs smoke` | 契约 pptx=39；插件未同步导致的 host 表 FAIL 须在 evidence 标明，不得假装全绿 | EVD-007 |
| 无 plugin diff | `git -C plugin/dsh-genoffice status` 或确认本工作区未改 plugin | 无本需求插件改动 | INV-007 |

### 5.2 真实场景全套测试（Real-Run，完成的唯一标准）

**环境准备**：

| 项 | 值 |
|---|---|
| 启动命令 | 栈根 `node scripts/dev.mjs status`；改 slides 后 `npm run web:build` 并重启 8787 |
| 访问入口 | `http://localhost:8787/slides/?control=1&open=path:<空白pptx>` |
| 测试账号/数据 | 复制空白 pptx；**不要**写 iframe AI settings |
| 干净状态定义 | 新 iframe 加载；registered:true |
| 可用测试工具 | chrome-devtools-proxy；curl loopback 8787 |

**执行矩阵**：

| UF | 执行方式 | 操作来源 | 必须核对的点 | Evidence |
|---|---|---|---|---|
| UF-001 主路径 | curl | 2.3 UF-001 | land_pages 2 页成功；无 no local LLM | `evidence/UF-001/success.json` |
| UF-001 未注册 | curl 关 iframe 后 | 2.3 | executor not registered | `evidence/UF-001/fail-unregistered.json` |
| UF-002 非法 spec | curl | 2.3 | isError；页数不变 | `evidence/UF-002/rejected.json` |
| UF-002 空 pages | curl | 2.3 | `land_pages requires a non-empty pages array` | `evidence/UF-002/empty.json` |
| UF-003 topic-only | curl | 2.3 | `control mode requires pages_spec; use land_pages`；无 `web control mode has no local LLM` | `evidence/UF-003/topic-only.json` |
| UF-004 replace_at | curl | 2.3 | 页数不变，第 1 页变 | `evidence/UF-004/replaced.json` |
| UF-005 append | curl | 2.3 | 页数 +1 | `evidence/UF-005/appended.json` |

**通过标准**：矩阵全行通过。本包 **不**要求 DSH 会话 `pptx_generate_deck` 出片。

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
  UF-005/
```

### 5.4 Review 专项检查清单

- [ ] 控制出片路径无 getAiSettings / withLocalLlm
- [ ] land_pages 先全部 parse 再落地
- [ ] htmlGenerated 写入 skillStateCache
- [ ] 未落地空白稿 add_shape 仍拦截
- [ ] 非控制 AiPanel LLM 未拆
- [ ] 无 plugin/ 改动
- [ ] 5.2 矩阵全过
- [ ] 入口接线可达
- [ ] 所有 BR/UF/INV 可核销
