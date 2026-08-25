# genoffice-control-ux Spec

> Version: 0.1.0 | Date: 2026-08-25 | Status: Skeleton 骨架
>
> 本文件是本需求的**唯一事实源**：事实基线、业务合同、技术方案、任务计划、验收协议全部在此。
> 其他文件（handoff.md、tasks.csv）只引用本文件，不复制内容。
>
> 填写三态规则：每个表格单元格只允许三种内容——
> 1. 验证过的事实（注明来源命令）；2. 显式假设 `ASM-xxx`；3. `未校准`。
> 禁止编造看似合理的命令、symbol、文件名。

---

## 1. 事实基线与假设

### 1.1 需求与运行模式

| 项 | 结论 |
|---|---|
| 原始需求 | GenOffice 控制模式交互升级：保存不重挂 iframe、写回冲突可另存副本、未保存指示、补 pdf_open、relay 一键拉起、*_open 无 GUI 快速失败（来自 2026-08-25 会话的交互改进清单，用户确认「可以」后运行 oneclick） |
| 输入类型 | empty（上下文回退推断） |
| Mode | oneclick |
| 置信度 | 高 |
| 输出目录 | `~/workspace/dsh/genoffice/docs/genoffice-control-ux/` |

### 1.2 任务类型路由

| 维度 | 结论 |
|---|---|
| 任务类型 | frontend（插件 tab UI 交互）+ backend（relay 控制面契约扩展）+ infra（web-dist 构建与镜像纪律） |
| 主要风险 | 三侧镜像漂移（contracts / relay / 5 个 app 适配器 / 插件）；新旧版本组合的兼容回退（INV-003）；iframe 跨源通信边界 |
| 行号引用策略 | 仅 hint，以 symbol + rg anchor 为准（栈内多仓并行改动，行号漂移概率高） |
| 必需验收方式 | smoke 契约断言 + 插件 vitest + 浏览器真实场景回放（5.2） |
| 必须覆盖用户场景 | 保存后继续编辑、外部修改冲突、未保存离开、agent 打开 pdf、relay 宕机恢复 |

### 1.3 勘察事实清单

> 每条事实来自 2026-08-25 会话实际执行的命令。

| 事实 | 来源命令 | 输出摘要 |
|---|---|---|
| 保存成功后插件强制重挂 iframe（换 nonce），undo/滚动全丢 | `Read plugin/packages/tab-genoffice/src/tabs/control-mode.tsx`（L126-158 `saveToDisk` → L61-67 `remountControl`） | `data.ok` 后调 `remountControl()`，`setFrameNonce` 换 key 重载 iframe |
| 重挂根因：适配器冲突基线 mtime 只捕获一次，保存后过期 | `Read upstream/apps/docs/src/renderer/control.ts`（L215-228 `captureMtime`） | `if (mtimeMs !== null) return mtimeMs` 惰性缓存，无刷新路径 |
| 5 个 app 适配器结构一致，均有 captureMtime 缓存 | `rg -n "captureMtime|mtimeMs" apps/{markdown,sheets,slides,pdf}/src/renderer/control.ts` | sheets L205-217、slides L203-215、markdown L184-189 同构 |
| relay 下行推送函数与执行器注册表 | `rg -n "executors|registry" web/server.mjs` | L69 `const executors = new Map()`（docId→{res}），L102 `pushTo` 按 docId 推 SSE 事件 |
| relay export 写回衔接点 | `sed -n '800,845p' web/server.mjs` | 写回在 `writeFileAtomic(path, buf, expected)`（L832）成功后 `json(res,200,{ok:true,path,name})`——saved 事件与响应 mtimeMs 的插入点 |
| writeFileAtomic 冲突校验容差 100ms | `rg -n "writeFileAtomic" -A 16 web/server.mjs` | L179 `Math.abs(st.mtimeMs - Number(expectedMtimeMs)) > 100` → conflict |
| 冲突分支 UI 只有「从磁盘重载」一条恢复路径 | `Read control-mode.tsx`（L144-146） | `data.error === 'conflict'` → 提示重载，重载即丢弃 iframe 内编辑 |
| docs 有现成复合 dirty 检查 | `head -30 apps/docs/src/renderer/doc-dirty.ts` | `DocDirtyState`（dirtyRef + 20 余项分域 dirty），供 close guard/autosave 用 |
| 其余 4 app 存在 dirty 相关模块（精确 symbol 待校准） | `rg -l -i "dirty|unsaved" apps/{markdown,sheets,slides,pdf}/src/renderer` | markdown: App.tsx/Ribbon.tsx；sheets: univer-sync.ts/edit-journal.ts；slides: action-context.ts；pdf: edit-state.ts/annotations.ts |
| better-sidebar 支持动态改 tab 标题 | `rg -n "updateTab" node_modules/dsh-better-sidebar/src/client/service.ts` | L417 `updateTab(tabId, patch: { title?; path?; meta? })` |
| better-sidebar 无关闭前确认钩子 | `rg -n "beforeClose|confirmClose" node_modules/dsh-better-sidebar/src`（无匹配） | 关闭确认只能降级：标题指示 + 返回按钮 confirm |
| *_open 家族缺 pdf：OPEN_TOOL_EXTS 只有 4 个 | `Read plugin/.../src/host/tools.ts`（L518 `OPEN_TOOL_EXTS = ['pptx','docx','xlsx','md']`、L45-50 `OPEN_TOOL_BY_APP` 无 pdf） | agent 有 21 个 pdf_* 控制工具但无法自行打开 pdf |
| POST /api/open 已返回 subscribers 数，插件未使用 | `Read contracts/relay-api.md`（§POST /api/open）+ `Read tools.ts`（L579-591 execute 未读 subscribers） | 快速失败分支的数据已具备 |
| relay 宕机提示为手动命令，无一键拉起 | `Read control-mode.tsx`（L219-224 relayStrip）+ `Read genoffice.tsx`（L298-303） | 文案：「在仓库执行 \`node web/server.mjs\`」 |
| host 插件可用完整 Node API（先例：node:fs/node:crypto） | `head -20 plugin/.../src/host/assets.ts` | `import { readFile, stat } from 'node:fs/promises'` — spawn child_process 无平台障碍 |
| host 已有同源 webServer 路由先例（sync 路由） | `Read plugin/.../src/host/sync.ts` | `applySyncRoute` 注册 `/dsh-artifact/genoffice-sync`，loopback origin 校验 |
| *_save 成功后 markSyncWindow 8s；UI 保存走 notifyHostSync 同款窗口 | `Read tools.ts`（L210 saveViaRelay）+ `Read sync.ts`（SYNC_WINDOW_MS=8000） | 不重挂后该窗口对 *_save 变纯害（阻塞后续编辑），需按响应能力条件化 |
| 控制契约当前 SSE 事件表无 saved；export 无 saveAs | `Read contracts/control-api.md`（§2.1 事件表、§2.6 export） | 契约扩展点明确 |
| smoke 当前 36 项全过（含工具名三方镜像） | `node scripts/dev.mjs smoke` | `[smoke] 全部通过 ✔` |
| 插件测试基线 109/109 通过 | `cd plugin && pnpm vitest run` | `Test Files 13 passed / Tests 109 passed` |
| sheets/pdf web-dist 已重建并含 ac51e28 修复 | `rg -c "__genofficeExportBytes" apps/{sheets,pdf}/web-dist/assets/index-*.js` | sheets=2、pdf=2；relay 已托管新 bundle |
| iframe 与插件页跨源（8787 vs 3080），postMessage 可行 | `Read relay.ts`（RELAY_BASE=localhost:8787）+ dev.mjs（DSH_URL=127.0.0.1:3080） | dirty 上报选 iframe→parent postMessage，origin 白名单校验 |

### 1.4 假设清单

| 假设 ID | 内容 | 风险 | 确认方式 |
|---|---|---|---|
| ASM-001 | 范围取改进清单的高+中影响 6 项；低影响 4 项（键盘导航、加载超时打磨、superseded 事件、聊天路径点击联动）列入 2.8 非目标 | 用户可能想全做 | 用户对骨架摘要无异议即视为确认 |
| ASM-002 | relay 一键拉起用环境变量 `DSH_GENOFFICE_ROOT`（指向本产品仓根，即 `dsh-genoffice/plugin` 或兼容入口 `~/workspace/dsh/genoffice`）定位 `scripts/dev.mjs`；未设置则不暴露该入口 | 插件包无法自省仓库位置，env 是唯一稳定通道 | Task 20 实现时在 README 记录；5.2 真实场景验证 |
| ASM-003 | markdown/sheets/slides/pdf 的 dirty 精确信号 symbol 未逐一核实（docs 已核实 doc-dirty.ts） | 接错信号导致指示失真（违反 BR-004） | P0 Task 2 勘察校准，产出写回 3.3 定位清单 |
| ASM-004 | dirty postMessage 频率用「状态翻转时发送」（dirty↔clean 变化才发），不做节流即可满足性能 | 高频编辑下消息风暴 | Task 12 实现时若翻转频繁再加 300ms 去抖 |
| ASM-005 | 5.2 真实场景可用 chrome-devtools-proxy MCP 浏览器自动化；不可用时按手动脚本+用户回填降级 | 执行会话工具集不同 | 执行 Task 24 前 probe 工具可用性 |

---

## 2. 业务合同

> 本章是 BR/UF/INV/EVD 的唯一定义处。任务、handoff、review 一律引用 ID，不复制表格。

### 2.1 BR 业务规则

| 规则 ID | 规则 | 正例 | 反例 | 影响范围 | 验证方式 |
|---|---|---|---|---|---|
| BR-001 | export 写回成功的响应必须携带写回后文件真实 `mtimeMs`；插件收到含 `mtimeMs` 的成功响应时**不得重挂 iframe**（编辑器 undo/滚动/选区保留） | 保存后立即 Cmd+Z 可撤销保存前的编辑 | 保存后 iframe 白屏重载、undo 栈清空 | relay export 端点 + control-mode.tsx | vitest + 5.2 UF-001 |
| BR-002 | `saved` SSE 事件只在写回成功后推送给该 docId 执行器，data 为 `{mtimeMs}`（写回后 stat 值）；conflict/失败不推送；适配器收到后必须以之为新冲突基线（连续两次保存第二次不得 conflict） | 保存→改一字→再保存 → ok | 第二次保存报 conflict；失败也推 saved | server.mjs + 5 个 control.ts | e2e 连续保存 + 5.2 UF-001 |
| BR-003 | 另存副本走 export 的 `saveAs`（绝对路径）分支：跳过 mtime 校验、`wx` 原子创建；目标已存在 → `{ok:false,error:'exists'}` 且原文件与目标均不变 | 冲突后另存 `报告 (副本).docx` 成功，原文件保持外部修改后的字节 | saveAs 覆盖了已存在文件 | server.mjs + control-mode.tsx + *_save 工具 | curl 分支测试 + 5.2 UF-002 |
| BR-004 | 未保存指示以编辑器真实 dirty 状态为源（适配器上报），dirty 时 tab 标题加 `● ` 前缀且工具栏「写入磁盘」高亮；保存成功/从磁盘重载后指示清除 | 打一个字 → 标题变 `● 报告.docx`；保存 → 恢复 | 无编辑也常亮；保存后不清除；用「调过工具」近似 dirty | 5 个 control.ts + control-mode.tsx | 5.2 UF-003 |
| BR-005 | `pdf_open` 与既有 *_open 行为完全一致：仅接受 `.pdf` 绝对路径、POST /api/open、轮询 registered ≤20s、成功输出「已打开控制模式」 | pdf_open ~/a.pdf → 20s 内 tab 出现并注册 | 接受相对路径；不等注册直接返回成功 | tools.ts | open-tools.spec + 5.2 UF-004 |
| BR-006 | POST /api/open 响应 `subscribers === 0` 时，*_open 必须立即失败（不进入 20s 轮询），错误信息含「没有 DSH 页面在监听」与打开 GUI 的引导 | GUI 全关时 pdf_open 秒级报错并引导 | 干等 20s 后报 executor not registered | tools.ts + errors.ts | open-tools.spec + 5.2 UF-004 失败分支 |
| BR-007 | 「启动 relay」入口仅在 host 设置了 `DSH_GENOFFICE_ROOT` 时可用；点击后 spawn `node scripts/dev.mjs start-relay`，≤10s 内 `/api/health` OK 则恢复，否则显示失败并保留手动命令提示 | 配置了 env：relay down → 点按钮 → 10s 内面板恢复 | 未配置 env 仍显示按钮；启动失败无提示 | host 新路由 + relay.ts + 两处 UI | vitest + 5.2 UF-005 |

### 2.2 UF 用户验收场景（索引）

| 场景 ID | Given | When | Then | 角色 | 验证方式 | Evidence |
|---|---|---|---|---|---|---|
| UF-001 | 控制模式已打开 docx 且做过编辑 | 点「写入磁盘」 | 保存成功提示；iframe 不重载；undo 可用；再次编辑再保存不 conflict | 用户 | browser | EVD-001 |
| UF-002 | 文件被外部修改后用户在 iframe 内也有编辑 | 保存 → conflict → 点「另存为副本」 | 副本落盘成功提示含新路径；原文件不变；iframe 编辑保留 | 用户 | browser | EVD-002 |
| UF-003 | 控制模式已打开文档 | 编辑一字 → 观察标题/按钮 → 点「返回」 | 标题现 `● `、按钮高亮；返回弹确认，取消则留在原地 | 用户 | browser | EVD-003 |
| UF-004 | relay 在跑、DSH GUI 已开 | agent 调 `pdf_open {path}` | 20s 内返回「已打开控制模式」，pdf tab 出现；GUI 未开时秒级报「没有 DSH 页面在监听」 | agent | agent 会话 | EVD-004 |
| UF-005 | relay 未运行、`DSH_GENOFFICE_ROOT` 已配置 | 面板/预览页点「启动 relay」 | ≤10s 面板恢复列表/预览；未配置 env 时不显示按钮 | 用户 | browser | EVD-005 |

> 每个 UF 均用户可见，2.3 节均有流程脚本。

### 2.3 核心业务流程（步骤级交互脚本）

#### UF-001: 保存后原地继续编辑

**前置状态**：DSH GUI（:3080）+ relay（:8787）运行中；控制模式已打开 `~/tmp/demo.docx` 并输入过文字（undo 栈非空）。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 点工具栏「写入磁盘」 | 按钮文案变「写入中…」，工具栏全体禁用（busy） | 插件 POST `/api/control/docs/<docId>/export {path}` | — |
| 2 | — | — | relay 下行 `export` 事件 → 适配器回传字节 → `writeFileAtomic` 成功 → relay `pushTo(docId,'saved',{mtimeMs})` 并响应 `{ok:true,path,mtimeMs}` | — |
| 3 | — | 绿色提示「已保存到 <path>」（4s 后自动消失），按钮恢复 | 适配器收 `saved` → 更新冲突基线；插件检测响应含 `mtimeMs` → **跳过重挂** | iframe 画面纹丝不动，光标/滚动位置不变 |
| 4 | 按 Cmd+Z | 编辑器撤销上一步输入 | Tiptap 本地 undo | 保存前的编辑历史仍然可用 |
| 5 | 再输入一字后再点「写入磁盘」 | 同步骤 1-3 | 第二次 export 用新基线校验 | 第二次保存成功，无 conflict |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 旧 relay 兼容 | export 成功响应**不含** `mtimeMs`（旧 server.mjs） | 与现状一致：「正在同步…」+ iframe 重载 | 插件回退 remountControl + notifyHostSync（INV-003） | 无需操作，行为同旧版 |
| 写回失败 | 目标目录只读等 | 红色提示「写入失败：<原因>」，iframe 不重载、编辑保留 | relay 返回 `{ok:false,error}`，不推 saved | 修复磁盘问题后重试 |
| relay 中途宕机 | export 请求 fetch 失败 | 红色提示「写入失败：…」+ relay 不可用条幅出现 | probe 置 relayOk=false | 重启 relay 后重试，编辑不丢 |

**界面状态机**：

```text
idle → saving →(响应 ok 且含 mtimeMs)→ saved(4s)→ idle    # 不重挂
         |            \(响应 ok 无 mtimeMs)→ syncing → idle  # 旧版回退重挂
         \→ error(编辑保留，可重试) / conflict(见 UF-002)
```

**入口接线清单**：

- 文件 tab / FileViewer 工具栏「写入磁盘」按钮 onClick → `saveToDisk`（control-mode.tsx）
- agent `docx_save` 等 5 个 *_save 工具 → host `saveViaRelay`（tools.ts）——同一响应字段驱动：含 `mtimeMs` 时不再 `markSyncWindow`

#### UF-002: 写回冲突时另存副本

**前置状态**：控制模式打开 `demo.docx` 并编辑过；随后另一程序改写了磁盘上的同一文件（mtime 变化）。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 点「写入磁盘」 | 按钮「写入中…」 | export → mtime 校验失败 | 橙色提示「文件已被外部修改，未覆盖」+ 出现「另存为副本」「从磁盘重载」两个按钮 |
| 2 | 点「另存为副本」 | 按钮 loading | 插件生成 `demo (副本 20260825-1149).docx` 路径 → POST export `{path, saveAs}` → relay 收字节后 `wx` 原子写 saveAs | — |
| 3 | — | 绿色提示「已另存为 <副本路径>」 | 不推 saved（原文档基线不变）、不重挂 | iframe 编辑保留，可继续改或再另存 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 副本已存在 | saveAs 目标已有文件 | 红色提示「副本已存在，请重试（将生成新文件名）」 | relay 返回 `{ok:false,error:'exists'}`，两个文件均不变（BR-003） | 再点一次（时间戳变化生成新名） |
| 用户取消 | 冲突提示后直接点「从磁盘重载」 | confirm 弹窗警告丢弃编辑 | 确认后 remountControl，从磁盘重新加载 | 现状行为，不回归 |
| saveAs 写失败 | 目录只读 | 红色提示「写入失败：<原因>」 | 原文件与副本均不变 | 换目录或修权限后重试 |

**界面状态机**：

```text
conflict → saving-as →(ok)→ saved-as(提示含副本路径) → idle(编辑保留)
              \→(exists/error)→ conflict(可重试/改走重载)
```

**入口接线清单**：

- 冲突提示区新增「另存为副本」按钮 onClick → `saveAsCopy`（control-mode.tsx 新增）
- agent 侧 `*_save` 新增可选参数 `save_as`（tool-schema.ts 5 处 + 契约 §4 保存工具入参）

#### UF-003: 未保存指示与返回确认

**前置状态**：控制模式打开任一文档，未做编辑。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 在 iframe 内输入一个字 | — | 适配器 dirty 翻转 → `postMessage({type:'genoffice:dirty',docId,dirty:true})` 到 parent | tab 标题变 `● demo.docx`（updateTab），「写入磁盘」按钮高亮描边 |
| 2 | 点「写入磁盘」并成功 | 同 UF-001 | 保存成功 → 适配器 dirty 复位 → postMessage dirty:false | 标题恢复 `demo.docx`，按钮恢复常态 |
| 3 | 再编辑后点「返回」 | 弹 confirm「有未保存的编辑，确定离开？」 | 取消 → 停留；确定 → unloadPreview + onBack | 不丢失地留下，或明确知情地离开 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 消息来源伪造 | 非 relay origin 的 postMessage | 无任何反应 | 插件校验 `event.origin === RELAY_BASE` 且 docId 匹配，不符丢弃 | — |
| 旧 web-dist | iframe 无 dirty 上报代码 | 标题永不出现 `● `，返回不弹确认 | 插件收不到消息即维持现状行为（INV-003） | 重建 web-dist 后自动生效 |
| tab 直接关闭 | 用户点 tab 的关闭按钮 | **无确认直接关**（better-sidebar 无 beforeClose 钩子，已知限制见 2.8） | 编辑丢弃 | 依赖 `● ` 指示提醒用户先保存 |

**界面状态机**：

```text
clean ↔ dirty（适配器翻转驱动）
dirty + 返回 → confirm → (取消)dirty / (确定)closed
保存成功 → clean
```

**入口接线清单**：

- 5 个 app 适配器 dirty 源接线：初始化时订阅编辑器 dirty 状态（docs 用 doc-dirty；其余 4 app 按 P0 校准结论）→ postMessage
- control-mode.tsx `window.addEventListener('message')` → setDirty state → `betterSidebar.updateTab(tabId,{title})` + 按钮 className + goBack confirm

#### UF-004: agent 打开 pdf 进入控制模式

**前置状态**：relay 运行中；`~/tmp/demo.pdf` 存在。

**成功主路径**（DSH GUI 已开）：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 在 chat 让 agent 编辑该 pdf | agent 调用 `pdf_open` 工具卡片出现 | host POST /api/open `{path,sessionId}` → subscribers ≥1 → 客户端 SSE 收 file 事件 → openTab | 侧栏弹出 pdf 文件 tab，iframe 加载 |
| 2 | — | 工具卡片显示成功 | waitUntilRegistered 轮询 /api/control/open 至 registered=true | 工具输出「已打开控制模式：<path>」，agent 继续调 pdf_* 编辑 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| GUI 未开 | subscribers === 0 | 工具秒级失败，输出含「没有 DSH 页面在监听，请先打开 DSH web 界面」 | BR-006 快速失败，不进入 20s 轮询 | 用户打开 :3080 后 agent 重试 |
| 非 pdf 路径 | path 后缀不是 .pdf | 工具失败「path 必须是 .pdf 文件」 | 本地校验拒绝，不发请求 | 换正确路径 |
| 注册超时 | GUI 开着但 iframe 20s 未注册（如 relay 旧 dist） | 工具失败「文档尚未在控制模式打开」 | waitUntilRegistered 超时走 executor not registered 分类 | 检查 web-dist 构建/手动点击文件 |

**界面状态机**：

```text
tool:running → (subscribers=0) fail-fast
            → (open ok) polling ≤20s → registered → success
                                     → timeout → fail(executor not registered)
```

**入口接线清单**：

- `OPEN_TOOL_EXTS` 加 `'pdf'` → createOpenTools 自动注册 `pdf_open`（tools.ts）
- `OPEN_TOOL_BY_APP` 加 `pdf: 'pdf_open'` → 21 个 pdf_* 工具描述自动带「须先 pdf_open」前缀

#### UF-005: relay 宕机一键拉起

**前置状态**：relay 未运行；DSH host 进程环境含 `DSH_GENOFFICE_ROOT=~/workspace/dsh/genoffice`（ASM-002）。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 打开 GenOffice 面板或文件预览 | 条幅「GenOffice relay 不可用」+「重新检查」+「启动 relay」按钮 | 插件 GET host `/dsh-artifact/genoffice-relay`（能力探测，返回 `{configured:true}` 才显示启动按钮） | 看到可一键恢复的入口 |
| 2 | 点「启动 relay」 | 按钮变「启动中…」禁用 | 插件 POST host 路由 → host spawn `node scripts/dev.mjs start-relay`（detached）→ 轮询 /api/health ≤10s | — |
| 3 | — | 条幅消失 | health OK → probeRelay 刷新 → 面板自动重载列表/预览 | 目录列表或预览恢复 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 未配置 env | `DSH_GENOFFICE_ROOT` 缺失 | 只显示「重新检查」与手动命令提示（现状），无启动按钮 | 能力探测返回 `{configured:false}` | 按 README 配置 env 后重启 DSH |
| 启动超时 | 10s 内 health 不通（如端口被占） | 红色提示「启动失败，请手动执行 node web/server.mjs 并查看 /tmp/genoffice-web.log」 | host 返回 `{ok:false,error:'timeout'}` | 手动排查 |
| 路径失效 | env 指向的 scripts/dev.mjs 不存在 | 同上失败提示（含具体原因） | host 校验文件存在性后拒绝 spawn | 修正 env |

**界面状态机**：

```text
relay-down → starting(≤10s) → up(条幅消失，自动刷新)
                     \→ start-failed(保留手动命令提示，可重试)
```

**入口接线清单**：

- host 新路由 `/dsh-artifact/genoffice-relay`（GET 能力探测 / POST 启动）——仿 sync.ts 的 applySyncRoute 挂载
- genoffice.tsx 面板条幅 + control-mode.tsx relayStrip 两处加「启动 relay」按钮（同一共享组件/函数）

### 2.4 INV 不变量

| 不变量 ID | 内容 | 关联 BR/UF | 验证方式 |
|---|---|---|---|
| INV-001 | 栈契约同步纪律（栈级 INV-004）：任何跨侧接口改动先改 `contracts/control-api.md`/`relay-api.md`，再镜像两侧源码，`node scripts/dev.mjs smoke` 全绿 | 全部 BR | smoke |
| INV-002 | 写回安全边界不变：原子写（tmp+rename / wx）、loopback-only、50MB 上限、既有 conflict 语义；saveAs 只新增分支不改旧路径 | BR-002/BR-003 | smoke + curl 矩阵 |
| INV-003 | 新旧组合兼容：新插件 + 旧 relay（响应无 mtimeMs）回退重挂旧行为；新 relay + 旧 web-dist（无 saved 监听/无 dirty 上报）不劣化于现状；绝不出现「保存后必 conflict」组合 | BR-001/BR-002/BR-004 | 兼容矩阵测试（5.2） |
| INV-004 | 控制面 89 个工具逐名不变（docx 11 + markdown 5 + xlsx 13 + pptx 39 + pdf 21）；*_open 家族 4→5 只增不改 | BR-005 | smoke 工具名镜像断言 + vitest |
| INV-005 | 非控制模式（无 `control=1`）行为零变化；未打开控制模式的普通预览不受 dirty/saved 机制影响 | BR-004 | 5.2 兼容行 |

### 2.5 EVD 证据清单

| 证据 ID | 类型 | 期望证据 | 保存位置 |
|---|---|---|---|
| EVD-001 | screenshot+log | 保存前后同视口截图对（滚动/选区不变）、undo 生效录屏或步骤截图、连续两次保存 console | `evidence/UF-001/` |
| EVD-002 | screenshot+file | conflict 提示截图、另存成功截图、副本文件与原文件字节各自正确的 diff/校验 | `evidence/UF-002/` |
| EVD-003 | screenshot | `● ` 标题截图、按钮高亮截图、返回 confirm 截图、保存后清除截图 | `evidence/UF-003/` |
| EVD-004 | log | agent 会话 pdf_open 成功与 subscribers=0 快速失败的工具调用记录 | `evidence/UF-004/` |
| EVD-005 | screenshot+log | relay down 条幅、启动中、恢复后面板截图；health 输出；未配置 env 的无按钮截图 | `evidence/UF-005/` |
| EVD-006 | log | 每 Phase 命令输出（typecheck/vitest/smoke/构建） | `evidence/phase-{N}/` |
| EVD-007 | json | export saveAs 分支 curl 样例（exists/成功/非法路径） | `evidence/API-saveas/` |

### 2.6 角色与权限矩阵

单一角色（本机用户/其 agent），无权限差异——安全边界是 loopback 网络边界（INV-002），不是账号权限。

### 2.7 负向 / 破坏性场景

| 场景 | Given | When | Then | Evidence |
|---|---|---|---|---|
| 网络/依赖失败 | 保存进行中 relay 被 kill | export fetch 失败 | 红色错误提示，iframe 编辑保留，可重启后重试（UF-001 分支） | EVD-001 |
| 重复提交 | busy 状态 | 连点「写入磁盘」/「另存副本」 | 按钮禁用（busy guard），只发一次请求 | EVD-001 |
| 伪造消息 | 恶意页面 postMessage dirty | origin ≠ RELAY_BASE | 丢弃，UI 无变化（UF-003 分支） | EVD-003 |
| 旧数据兼容 | 旧 web-dist / 旧 relay 任一组合 | 走 UF-001/003 流程 | 回退现状行为，不出现新错误（INV-003） | EVD-006（兼容矩阵） |
| 空数据 | 未做任何编辑 | 观察指示/直接保存 | 无 `● `；保存走正常路径（幂等写回） | EVD-003 |

### 2.8 非目标

- 低影响改进 4 项暂不做（ASM-001）：文件浏览器键盘导航/过滤、预览加载超时智能化、跨页面双开 `superseded` 事件、聊天内路径点击联动恢复。
- tab 关闭按钮的关闭前确认：better-sidebar 无 beforeClose 钩子（1.3 已勘察），本期以 `● ` 指示 + 返回确认覆盖，不改 better-sidebar。
- agent 侧 *_save 冲突时的自动决策（自动另存/覆盖）：只提供 `save_as` 参数，决策留给 agent/用户。
- relay 多实例管理、端口配置化。

---

## 3. 技术方案

### 3.1 架构 Before / After

```text
Before（保存链路）:
  [插件 saveToDisk] → POST export → relay 写回 {ok,path}
        → 插件 remountControl() 重挂 iframe（undo/滚动丢失）
        → host *_save markSyncWindow 8s（保存后编辑被拒窗口）
  冲突: conflict → 只有「从磁盘重载」（丢弃编辑）
  dirty: 无指示；pdf: agent 无法自行打开；relay down: 手动命令

After:
  [插件 saveToDisk] → POST export → relay 写回成功 stat 新 mtime
        ├→ 响应 {ok,path,mtimeMs}          → 插件不重挂（旧 relay 无 mtimeMs → 回退重挂）
        └→ SSE pushTo(docId,'saved',{mtimeMs}) → 适配器刷新冲突基线
  冲突: conflict → 「另存为副本」saveAs(wx) ∥ 「从磁盘重载」
  dirty: 适配器 postMessage → tab 标题 ● + 按钮高亮 + 返回确认
  pdf_open 补齐 5 族；subscribers=0 快速失败
  relay down: host /dsh-artifact/genoffice-relay spawn start-relay（env 配置时）
```

### 3.2 模块改造

| 模块 | 职责 | 改造说明 |
|---|---|---|
| `contracts/control-api.md` | 控制契约单一事实源 | §2.1 事件表加 `saved`；§2.6 export 加 `saveAs` 入参与 `exists` 错误、成功响应加 `mtimeMs`；§4 保存工具入参加可选 `save_as`；错误语义表加 `exists`、「没有 DSH 页面在监听」 |
| `contracts/relay-api.md` | relay API 契约 | `/api/open` 补 subscribers=0 的消费方语义（*_open 快速失败） |
| `upstream/web/server.mjs` | relay 权威实现 | export 写回成功后 stat 新 mtime → 响应加 `mtimeMs` + `pushTo(docId,'saved',{mtimeMs})`；saveAs 分支（wx 原子创建、exists 错误、跳过 mtime 校验） |
| `upstream/apps/{docs,markdown,sheets,slides,pdf}/src/renderer/control.ts` | 5 个控制适配器 | 监听 `saved` 事件刷新 `mtimeMs` 基线；初始化订阅编辑器 dirty → postMessage 翻转上报 |
| `plugin/.../src/tabs/control-mode.tsx` | 控制模式 UI | 响应含 mtimeMs 时跳过 remountControl；conflict 分支加「另存为副本」；message 监听 dirty → updateTab 标题 + 按钮高亮 + goBack confirm；relayStrip 加「启动 relay」 |
| `plugin/.../src/tabs/relay.ts` | relay 探测共享层 | 新增 host relay 路由探测/启动的 fetch 封装 |
| `plugin/.../src/host/tools.ts` | host 工具 | OPEN_TOOL_EXTS/OPEN_TOOL_BY_APP 加 pdf；subscribers=0 快速失败；saveViaRelay 响应含 mtimeMs 时不 markSyncWindow；*_save 透传 save_as |
| `plugin/.../src/host/tool-schema.ts` | 工具参数表 | 5 个 *_save 加可选 `save_as` 参数 |
| `plugin/.../src/host/relay-launch.ts`（新） | 一键拉起路由 | 仿 sync.ts：GET 能力探测 / POST spawn start-relay + health 轮询 |
| `scripts/dev.mjs` | smoke 镜像 | 新增断言：export saveAs 参数校验分支、/api/open subscribers 字段、契约 saved 事件表可解析 |

### 3.3 三段式定位清单

> 行号只是 hint；漂移时以 symbol + rg anchor 为准。

| 文件 | 稳定定位 | 搜索定位 | 行号 hint | 备注 |
|---|---|---|---|---|
| `upstream/web/server.mjs` | `writeFileAtomic` | `rg "writeFileAtomic" web/server.mjs` | L164、L832 | 写回成功点 = saved 推送与响应 mtimeMs 插入点 |
| `upstream/web/server.mjs` | `pushTo` / `executors` | `rg "const executors|function pushTo" web/server.mjs` | L69、L102 | saved 事件复用下行通道 |
| `upstream/web/server.mjs` | export 端点分支 | `rg "'export'" web/server.mjs` | L800-834 | saveAs 分支在 path mismatch 校验旁扩展 |
| `upstream/apps/docs/src/renderer/control.ts` | `captureMtime` / `openStream` | `rg "captureMtime" apps/docs/src/renderer/control.ts` | L215-228 | saved 监听加在 openStream 事件组；其余 4 app 同构 |
| `upstream/apps/docs/src/renderer/doc-dirty.ts` | `isDocDirty(DocDirtyState)` | `rg "isDocDirty|DocDirtyState" apps/docs/src/renderer` | L6-56 | docs dirty 源：`isDocDirty` 聚合 `dirtyRef` 与分域 dirty；App.tsx 传入 getDirty |
| `upstream/apps/markdown/src/renderer/App.tsx` | `dirty` / `dirtyRef` / `markDirty` | `rg -n "dirtyRef|markDirty|uiOnly" apps/markdown/src/renderer/App.tsx` | L114-180 | `markDirty` 写 `dirty`/`dirtyRef`；`uiOnly` 事务排除（折叠等不落盘） |
| `upstream/apps/sheets/src/renderer/App.tsx` + `edit-journal.ts` | `pendingEdits` + `journalSize(editJournal)` | `rg -n "pendingEdits|journalSize" apps/sheets/src/renderer` | App L407 | 同目标再编辑仍 `pendingEdits>0` |
| `upstream/apps/slides/src/renderer/App.tsx` | App `dirty` state | `rg -n "setDirty|isDirty|sessionDirty" apps/slides/src/renderer` | App L284；web-slides-session L169 | 桌面 `isDirty` / web `sessionDirty(undoStack)` |
| `upstream/apps/pdf/src/renderer/App.tsx` | App 计算 `dirty` | `rg -n "const dirty" apps/pdf/src/renderer/App.tsx` | L1375-1388 | markups/edits/rotations/deleted/order/metadata |
| `plugin/.../src/tabs/control-mode.tsx` | `saveToDisk` / `remountControl` | `rg "remountControl" src/tabs/control-mode.tsx` | L61-67、L126-158 | 不重挂改造 + conflict 按钮 + dirty UI |
| `plugin/.../src/tabs/control-mode.tsx` | `relayStrip` | `rg "relayStrip" src/tabs/control-mode.tsx` | L219-224 | 「启动 relay」按钮位 |
| `plugin/.../src/tabs/genoffice.tsx` | relay 不可用条幅 | `rg "relay 不可用" src/tabs/genoffice.tsx` | L298-303 | 面板侧按钮位 |
| `plugin/.../src/host/tools.ts` | `OPEN_TOOL_EXTS` / `OPEN_TOOL_BY_APP` / `createOpenTools` / `saveViaRelay` | `rg "OPEN_TOOL_EXTS|saveViaRelay" src/host/tools.ts` | L45-50、L184-212、L518-595 | pdf_open + 快速失败 + sync window 条件化 |
| `plugin/.../src/host/sync.ts` | `applySyncRoute` | `rg "applySyncRoute" src/host/sync.ts` | L75-89 | relay-launch 路由的挂载范本 |
| `plugin/.../src/host/tool-schema.ts` | `isSaveEntry` / 保存条目 | `rg "isSaveEntry|_save" src/host/tool-schema.ts` | 未校准（save 条目具体行） | save_as 参数追加点，P0 校准 |
| `plugin/.../src/tabs/file-tab.ts` | `fileTabSeed`（tab id 构成） | `rg "fileTabSeed" src/tabs/file-tab.ts` | L19-27 | updateTab 需要 tabId=`${FILE_TAB_ID}:${path}` |
| `node_modules/dsh-better-sidebar/src/client/service.ts` | `updateTab` | `rg "updateTab" node_modules/dsh-better-sidebar/src/client/service.ts` | L417 | 只读依赖，确认签名 |
| `scripts/dev.mjs` | `smoke` | `rg "async function smoke" scripts/dev.mjs` | L85 | 新断言追加点 |

> 未校准 + ASM 占比：18 行中 5 行（28%）≤ 30%，P0 Task 2 全部覆盖。

### 3.4 API / 数据 / 权限 / 路由影响

| 类型 | 是否影响 | 说明 | 兼容策略 |
|---|---|---|---|
| API | 是 | export 响应加 `mtimeMs`（增量字段）、入参加 `saveAs`（可选）；SSE 加 `saved` 事件；host 新增 `/dsh-artifact/genoffice-relay` | 全部增量：旧消费方忽略新字段/事件即回退现状（INV-003） |
| 数据 | 是 | saveAs 会创建新文件（wx，不覆盖） | BR-003 exists 保护 |
| 权限 | 否 | 仍是 loopback 边界；host 新路由沿用 sync.ts 的 loopback origin 校验 | INV-002 |
| 路由 | 否 | 无前端路由变化 | — |

---

## 4. Phase 计划与任务详情

> Phase 依赖链：

```text
P0 契约与校准 ──→ P1 保存不重挂 ──→ P2 冲突另存副本 ──┐
                     │                                ├──→ P5 真实场景全套测试 + 收尾
                     ├──→ P3 未保存指示 ──────────────┤
                     └──→ P4 agent 侧补齐 ────────────┘
（P2/P3/P4 互不依赖，可并行；均依赖 P1 的契约落地与构建链验证）
```

> 任务状态跟踪：任务数 25 ≥ 8，用同目录 `tasks.csv`。
> 任务标题格式 `### Task {N}: {标题}`，N 与 CSV 序号一致。

### Phase 0: 契约与校准

> 你在哪里：改进方案已定但契约未记录，4 个 app 的 dirty 信号 symbol 未核实。
> 做完之后：contracts/ 是新接口的单一事实源；3.3 定位清单无未校准项。

### Task 1: 更新控制契约与 relay 契约

- **关联**：BR-001 / BR-002 / BR-003 / BR-006 / INV-001；UF NA（纯契约文档，无用户可见界面）
- **前置任务**：无
- **风险等级**：P0

**为什么做**：栈纪律（INV-001）要求先改契约再动源码；四处镜像点都以 contracts/ 为准。

**涉及文件与定位**：

- `contracts/control-api.md`：§2.1 SSE 事件表、§2.6 export、§4 工具表尾注、§5 错误语义表，`rg "saved|saveAs" contracts/control-api.md`（当前无匹配，新增）
- `contracts/relay-api.md`：`rg "subscribers" contracts/relay-api.md`，§POST /api/open

**具体操作**：

1. §2.1 下行事件表加行：`saved` | `{"mtimeMs": number}` | 写回成功通知（新冲突基线）。
2. §2.6 export：入参加 `saveAs?: string(绝对路径)`；语义——saveAs 存在时跳过 mtime 校验、`wx` 原子创建、目标存在 → `{ok:false,error:'exists'}`；成功响应统一为 `{ok:true, path, name, mtimeMs}`（mtimeMs=写回后 stat）。
3. §4 保存工具行备注加：入参 `{path, save_as?}`。
4. §5 错误表加 `exists`（saveAs 目标已存在）与 `no gui listening`（*_open subscribers=0 快速失败文案锚点）。
5. relay-api.md `/api/open`：注明 `subscribers` 为 `/api/open/stream` 订阅数，消费方 *_open 在 0 时快速失败（指向 control-api.md §5）。
6. 版本号 0.2.0 → 0.3.0，记录日期与本 spec 路径。

**验证**：`rg -n "saved|saveAs|save_as|exists" contracts/control-api.md` → 四处均有定义 → 期望非空

**Evidence**：`evidence/phase-0/contracts.diff`

**注意事项**：只加增量语义，不改旧字段含义（INV-002/003）；禁止顺手改无关章节。

### Task 2: 校准 dirty 信号与 save 条目定位

- **关联**：BR-004 / ASM-003；UF NA（纯勘察，无用户可见界面）
- **前置任务**：无
- **风险等级**：P0

**为什么做**：3.3 清单 5 处未校准全部集中在 dirty 信号与 tool-schema save 条目；接错信号直接违反 BR-004。

**涉及文件与定位**：

- `upstream/apps/markdown/src/renderer/App.tsx`：`rg -i "dirty" apps/markdown/src/renderer/App.tsx`
- `upstream/apps/sheets/src/renderer/univer-sync.ts` + `edit-journal.ts`：`rg -i "dirty" apps/sheets/src/renderer/univer-sync.ts`
- `upstream/apps/slides/src/renderer/action-context.ts`：`rg -i "dirty" apps/slides/src/renderer/action-context.ts`
- `upstream/apps/pdf/src/renderer/edit-state.ts`：`rg -i "dirty|unsaved" apps/pdf/src/renderer/edit-state.ts`
- `upstream/apps/docs/src/renderer/App.tsx`：`rg "DocDirtyState|doc-dirty" apps/docs/src/renderer/App.tsx`（dirty 状态持有处/传递链）
- `plugin/.../src/host/tool-schema.ts`：`rg "skillName: 'save'|_save" src/host/tool-schema.ts`

**具体操作**：

1. 逐 app 确认「有未保存修改」的权威布尔源（symbol + 所在组件/模块 + 订阅方式），优先复用桌面版 close guard 用的同一信号。
2. 确认 control.ts 初始化点能否拿到该信号（App.tsx 传入 initControlMode opts 或全局单例），写明接线方案。
3. 确认 tool-schema.ts 5 个 save 条目的 parameters 定义行。
4. 把结论回写本 spec 3.3 清单（替换 5 个未校准）与 Task 12-14 的定位段。

**验证**：`rg -c "未校准" docs/genoffice-control-ux/spec.md` → 期望 0

**Evidence**：`evidence/phase-0/dirty-survey.md`（每 app：symbol、rg 输出摘要、接线方案）

**注意事项**：dirty 必须是「持久化内容有修改」，排除选区/视图态（参照 doc-dirty.ts 头注释）；找不到现成信号的 app 记录替代方案（如编辑器事务计数）再进 P3。

### Task 3: 执行 Phase 0 回归验证

- **关联**：INV-001；本 Phase 全部任务
- **前置任务**：1;2

**验证**：`node scripts/dev.mjs smoke` → 全绿（契约文档改动不破坏现有断言）+ `rg -c "未校准" docs/genoffice-control-ux/spec.md` → 0

**Evidence**：`evidence/phase-0/`

### Phase 1: 保存不重挂（saved 事件 + 渐进增强）

> 你在哪里：契约已定义 saved/mtimeMs，源码未动。
> 做完之后：新组合下保存零重挂、连续保存不 conflict；旧组合回退现状。

### Task 4: relay 写回成功后推送 saved 并回带 mtimeMs

- **关联**：BR-001 / BR-002 / INV-002；UF-001
- **前置任务**：3
- **风险等级**：P0

**涉及文件与定位**：

- `upstream/web/server.mjs`：`writeFileAtomic`，`rg "writeFileAtomic" web/server.mjs`，L164、L832（hint）
- 同文件：`pushTo`，`rg "function pushTo" web/server.mjs`，L102（hint）

**具体操作**：

1. export 端点写回成功后 `stat` 目标文件取新 `mtimeMs`。
2. 响应改为 `{ok:true, path, name, mtimeMs}`。
3. `pushTo(docId, 'saved', { mtimeMs })`（仅成功分支；conflict/失败不推，BR-002 反例）。
4. `POST /api/file` 直写路径不推 saved（无 docId 语义），但成功响应同样补 `mtimeMs`（表单一致性，消费方可忽略）。

**验证**：`node scripts/dev.mjs smoke` → 全绿；`curl -s -X POST localhost:8787/api/file -H 'Content-Type: application/json' -d '{"path":"/tmp/ux-t4.md","base64":"aGk="}' | jq .mtimeMs` → 数值非 null

**Evidence**：`evidence/phase-1/relay-saved.log`

**注意事项**：stat 失败不阻塞成功响应（mtimeMs 置 null 并记 console）；禁止在 conflict 分支推 saved。

### Task 5: 五个 app 适配器监听 saved 刷新冲突基线

- **关联**：BR-002 / INV-003；UF-001
- **前置任务**：4
- **风险等级**：P0

**涉及文件与定位**：

- `upstream/apps/{docs,markdown,sheets,slides,pdf}/src/renderer/control.ts`：`openStream` 事件注册组 + `captureMtime`，`rg "addEventListener\('export'" apps/*/src/renderer/control.ts`（saved 监听加在同组）

**具体操作**：

1. 每个 control.ts 的 `openStream` 加 `es.addEventListener('saved', …)`：解析 `{mtimeMs}`，非空则赋值模块内 `mtimeMs` 基线变量（重置 captureMtime 缓存）。
2. 五份文件镜像注释 `INV-004`（栈级）指向 contracts/control-api.md §2.1。

**验证**：`cd upstream && npm run typecheck -w @genoffice/docs -w @genoffice/markdown -w @genoffice/sheets -w @genoffice/slides -w @genoffice/pdf` → 0 error

**Evidence**：`evidence/phase-1/adapters.diff`

**注意事项**：mtimeMs 变量当前是 `let mtimeMs: number | null` 闭包（L215 hint）——saved 处理必须写同一个闭包变量，不要新建状态。

### Task 6: 插件保存链路渐进增强（响应含 mtimeMs 不重挂）

- **关联**：BR-001 / INV-003；UF-001
- **前置任务**：4
- **风险等级**：P0

**涉及文件与定位**：

- `plugin/.../src/tabs/control-mode.tsx`：`saveToDisk`，`rg "remountControl" src/tabs/control-mode.tsx`，L126-158（hint）
- `plugin/.../src/host/tools.ts`：`saveViaRelay`，`rg "markSyncWindow" src/host/tools.ts`，L210（hint）

**具体操作**：

1. `saveToDisk`：解析响应 `mtimeMs`；`typeof mtimeMs === 'number'` → 只设 saved 提示，**不调** `remountControl`；否则走旧路径（重挂 + notifyHostSync）。
2. `saveViaRelay`：同判断——含 mtimeMs 时不 `markSyncWindow`（保存后 agent 可立即继续编辑）；不含时保留现状。
3. 输出文案区分：不重挂路径提示「已保存到 <path>（编辑状态已保留）」。

**验证**：`cd plugin && pnpm vitest run` → 全绿（先更新受影响用例）

**Evidence**：`evidence/phase-1/plugin.diff`

**注意事项**：「从磁盘重载」仍必须重挂 + notifyHostSync（用户显式丢弃场景），不要顺手改掉。

### Task 7: 更新插件测试与 smoke 断言（saved/mtimeMs）

- **关联**：BR-001 / BR-002 / INV-001；UF NA（测试资产，无用户可见界面）
- **前置任务**：5;6
- **风险等级**：P1

**涉及文件与定位**：

- `plugin/.../tests/`：`rg "saveViaRelay|export" tests/ -l`（skill.spec.ts / open-tools.spec.ts 等，实改哪些以 rg 为准）
- `scripts/dev.mjs`：`smoke`，`rg "async function smoke" scripts/dev.mjs`，L85（hint）

**具体操作**：

1. 插件 vitest：mock relay export 响应含/不含 mtimeMs 两分支，断言 markSyncWindow 调用与否、saveToDisk 状态流。
2. smoke 加断言：POST /api/file 成功响应含数值 mtimeMs；契约 §2.1 表能解析出 `saved` 行。

**验证**：`cd plugin && pnpm vitest run` 全绿 + `node scripts/dev.mjs smoke` 全绿

**Evidence**：`evidence/phase-1/tests.log`

### Task 8: 重建五 app web-dist 并验证连续保存

- **关联**：BR-002 / INV-003；UF-001
- **前置任务**：5;6;7
- **风险等级**：P0

**涉及文件与定位**：

- `upstream/package.json`：`web:build` workspace 脚本，`rg "web:build" upstream/package.json`

**具体操作**：

1. `for w in docs markdown sheets slides pdf; do npm run web:build -w @genoffice/$w; done`。
2. 新 bundle 特征校验：`rg -c "genoffice:dirty|saved" apps/*/web-dist/assets/index-*.js`（至少 saved 监听落入）。
3. e2e：控制模式打开 fixture docx → 编辑 → 保存 → 再编辑 → 再保存，断言第二次 `{ok:true}` 无 conflict（可用 `upstream/web/e2e-open-save.mjs` 扩展或手动 + console 记录）。

**验证**：连续两次保存均 ok（记录 console/网络响应）

**Evidence**：`evidence/phase-1/double-save.log`

**注意事项**：sheets 构建已知前置——vite alias `/^node:.*/` 与 `node:fs` shim（2026-08-25 已修，见 1.3 清单）；构建失败先查 alias 拼接。

### Task 9: 执行 Phase 1 回归验证

- **关联**：本 Phase 全部 BR/UF；INV-001/002/003/004
- **前置任务**：8

**验证**：`node scripts/dev.mjs smoke` 全绿 + `cd plugin && pnpm vitest run` 全绿 + upstream 五 app typecheck 0 error

**Evidence**：`evidence/phase-1/`

### Phase 2: 冲突另存副本

> 你在哪里：保存不重挂已落地，conflict 仍只有丢弃一条路。
> 做完之后：conflict 可另存副本；agent *_save 支持 save_as。

### Task 10: relay export saveAs 分支

- **关联**：BR-003 / INV-002；UF-002
- **前置任务**：9
- **风险等级**：P0

**涉及文件与定位**：

- `upstream/web/server.mjs`：export 端点分支，`rg "'path mismatch'" web/server.mjs`，L819（hint）；`writeFileAtomic`，L164（hint）

**具体操作**：

1. export 入参解析 `saveAs`（必须绝对路径，否则 `{ok:false,error:'invalid saveAs'}`）。
2. saveAs 存在时：仍校验 payload.path 与入参 path 一致（导出的是该文档字节）；写入目标改为 saveAs；跳过 expectedMtimeMs 校验；用 `wx` 打开（已存在 → `{ok:false,error:'exists'}`，两文件均不变）。
3. 成功响应 `{ok:true, path: saveAs, name, mtimeMs}`；**不推 saved**（原文档基线不变，BR-003）。
4. 50MB 上限、loopback 校验沿用（INV-002）。

**验证**：`bash -c 'curl 三连：无执行器 saveAs → executor not registered；saveAs 相对路径 → invalid saveAs；（执行器在线时）saveAs 已存在 → exists'` 输出存档

**Evidence**：`evidence/API-saveas/*.json`

**注意事项**：`wx` 与 tmp+rename 二选一处必须保证失败不留半截文件；禁止复用原路径的 tmp 名。

### Task 11: 冲突 UI「另存为副本」+ *_save save_as 参数

- **关联**：BR-003；UF-002
- **前置任务**：10
- **风险等级**：P1

**涉及文件与定位**：

- `plugin/.../src/tabs/control-mode.tsx`：conflict 分支，`rg "conflict" src/tabs/control-mode.tsx`，L144-146（hint）
- `plugin/.../src/host/tool-schema.ts`：5 个 save 条目 parameters（Task 2 校准的行号）
- `plugin/.../src/host/tools.ts`：`saveViaRelay`，L184-212（hint）

**具体操作**：

1. control-mode.tsx：`saveState === 'conflict'` 时提示区渲染「另存为副本」按钮；点击生成 `{原名} (副本 {yyyyMMdd-HHmm}).{ext}` 同目录路径 → 调 export `{path, saveAs}`；成功 → 绿色提示含副本路径、不重挂；`exists` → 提示重试。
2. tool-schema.ts：5 个 save 条目加可选 `save_as`（string，描述注明「冲突时另存到该绝对路径，不覆盖已存在文件」）。
3. tools.ts saveViaRelay：透传 save_as → body `{path, saveAs}`；成功输出「已另存为 <路径>」；此路径**不** markSyncWindow（原文档没变）。
4. errors.ts：`exists` 归入 write-conflict 类，文案给「换个名字或删除既有副本」。

**验证**：`cd plugin && pnpm vitest run` 全绿（新增 saveAs 用例：exists/成功/相对路径拒绝）

**Evidence**：`evidence/phase-2/saveas-ui.diff`

**注意事项**：副本名生成在插件侧（用户可见、可预期），不放 relay；busy guard 覆盖新按钮防连点（2.7 重复提交）。

### Task 12: 执行 Phase 2 回归验证

- **关联**：本 Phase 全部 BR/UF；INV-002/004
- **前置任务**：11

**验证**：`node scripts/dev.mjs smoke` 全绿 + `cd plugin && pnpm vitest run` 全绿 + Task 10 curl 矩阵重放

**Evidence**：`evidence/phase-2/`

### Phase 3: 未保存指示

> 你在哪里：保存链路已稳，但用户看不出有没有未保存修改。
> 做完之后：dirty 时标题 `● ` + 按钮高亮 + 返回确认；保存/重载清除。

### Task 13: 契约补 dirty 上报通道定义

- **关联**：BR-004 / INV-001；UF NA（契约文档，无用户可见界面）
- **前置任务**：9
- **风险等级**：P1

**涉及文件与定位**：

- `contracts/control-api.md`：§2.1 之后新增小节（如 §2.8 iframe→宿主页 postMessage 通道），`rg "postMessage" contracts/`（当前无匹配，新增）

**具体操作**：

1. 定义消息形状：`{type:'genoffice:dirty', docId: string(64hex), dirty: boolean}`；发送时机（翻转时）；接收方校验（origin 必须等于 relay origin、docId 匹配当前文档）。
2. 注明该通道是 UI 提示用途，不承载编辑数据（INV-005 编辑仍走编辑器）。

**验证**：`rg -n "genoffice:dirty" contracts/control-api.md` → 有定义

**Evidence**：`evidence/phase-3/contracts-dirty.diff`

### Task 14: 五个 app 适配器上报 dirty 翻转

- **关联**：BR-004 / INV-003 / ASM-003 / ASM-004；UF-003
- **前置任务**：13;2
- **风险等级**：P0

**涉及文件与定位**：

- `upstream/apps/{docs,markdown,sheets,slides,pdf}/src/renderer/control.ts` + 各 App.tsx（initControlMode 调用点）：`rg "initControlMode" apps/*/src/renderer/App.tsx`
- dirty 信号源：按 Task 2 校准结论（docs = doc-dirty.ts `DocDirtyState`）

**具体操作**：

1. `ControlAdapterOptions` 加 `getDirty?: () => boolean`（可选，保持旧调用兼容）。
2. 适配器内以轻量轮询（1s）或信号订阅（按 Task 2 结论择优）检测翻转，翻转时 `window.parent.postMessage({type:'genoffice:dirty', docId, dirty}, '*')`——目标 origin 用 `'*'`：消息不含敏感数据（BR-004 只有布尔），接收方靠 origin 白名单过滤。
3. 保存成功（saved 事件）与从磁盘重载后强制发一次 `dirty:false`。
4. 五 app 的 App.tsx 传入 getDirty 接线。

**验证**：五 app typecheck 0 error + 重建 web-dist 后手动验证 console 收到消息

**Evidence**：`evidence/phase-3/dirty-adapters.diff`

**注意事项**：dirty 定义排除瞬态 UI（选区/高亮），以桌面 close guard 同源信号为准；ASM-004 翻转发送，风暴时再加 300ms 去抖。

### Task 15: 插件 dirty UI（标题 ●、按钮高亮、返回确认）

- **关联**：BR-004；UF-003
- **前置任务**：14
- **风险等级**：P1

**涉及文件与定位**：

- `plugin/.../src/tabs/control-mode.tsx`：`goBack` / toolbar，`rg "goBack" src/tabs/control-mode.tsx`，L171-174（hint）
- `plugin/.../src/tabs/file-tab.ts`：`fileTabSeed`（tabId 构成 `${FILE_TAB_ID}:${path}`），L19-27（hint）
- better-sidebar `updateTab(tabId,{title})`：service.ts L417（只读依赖）

**具体操作**：

1. control-mode.tsx `useEffect` 挂 `window.addEventListener('message')`：校验 `event.origin === RELAY_BASE` 且 `data.type === 'genoffice:dirty'` 且 docId 匹配（docIdFor(path) 比对）→ setDirty。
2. dirty=true：`betterSidebar.updateTab(tabId, {title: '● ' + title})`（tab 场景才有 tabId；FileViewer 场景只做按钮高亮）；「写入磁盘」按钮加高亮 className。
3. `goBack` 与 `reloadFromDisk`：dirty 时 confirm 文案含「有未保存的编辑」。
4. 保存成功 / 收到 dirty:false → 复原标题与按钮。
5. locales.ts 补文案键（zh/en）。

**验证**：`cd plugin && pnpm vitest run` 全绿（message 过滤用例：错误 origin/错误 docId 丢弃——2.7 伪造消息）

**Evidence**：`evidence/phase-3/dirty-ui.diff`

**注意事项**：ControlModeViewer 需要拿到 tabId——FileViewer 场景无 tab，updateTab 跳过（能力判断，不报错）；卸载时移除 listener。

### Task 16: 执行 Phase 3 回归验证

- **关联**：本 Phase 全部 BR/UF；INV-003/005
- **前置任务**：15

**验证**：smoke 全绿 + 插件 vitest 全绿 + 五 app typecheck + 重建 web-dist 后旧插件（不处理消息）无报错（兼容抽查）

**Evidence**：`evidence/phase-3/`

### Phase 4: agent 侧补齐（pdf_open / 快速失败 / 一键拉起）

> 你在哪里：UI 侧交互已齐，agent 侧还有三个缺口。
> 做完之后：agent 可自主打开 pdf；GUI 未开秒级报错；relay 可一键拉起。

### Task 17: 补 pdf_open 工具

- **关联**：BR-005 / INV-004；UF-004
- **前置任务**：9
- **风险等级**：P1

**涉及文件与定位**：

- `plugin/.../src/host/tools.ts`：`OPEN_TOOL_EXTS`，L518（hint）；`OPEN_TOOL_BY_APP`，L45-50（hint）
- `plugin/.../tests/open-tools.spec.ts`：`rg "OPEN_TOOL|_open" tests/open-tools.spec.ts`

**具体操作**：

1. `OPEN_TOOL_EXTS` 加 `'pdf'`；`OPEN_TOOL_BY_APP` 加 `pdf: 'pdf_open'`。
2. open-tools.spec 断言 5 个 open 工具注册、pdf_open 扩展名校验。
3. `registeredToolNames` 相关用例数量随之 +1（89 控制工具不变，INV-4 断言不动）。

**验证**：`cd plugin && pnpm vitest run` 全绿

**Evidence**：`evidence/phase-4/pdf-open.diff`

### Task 18: *_open subscribers=0 快速失败

- **关联**：BR-006；UF-004
- **前置任务**：17
- **风险等级**：P1

**涉及文件与定位**：

- `plugin/.../src/host/tools.ts`：`createOpenTools` execute，L556-592（hint），`rg "subscribers" src/host/tools.ts`（当前无匹配，新增）
- `plugin/.../src/host/errors.ts`：`classifyControlError`，`rg "executor-missing" src/host/errors.ts`

**具体操作**：

1. execute 解析 `data.subscribers`；`=== 0` 时直接 fail：「没有 DSH 页面在监听 /api/open/stream —— 请先在浏览器打开 DSH（默认 http://127.0.0.1:3080）再重试」，跳过 waitUntilRegistered。
2. `subscribers` 缺失（旧 relay）→ 维持现有 20s 轮询路径（INV-003 同理的增量兼容）。
3. errors.ts 增加/复用分类，保持「中文说明+上游原文+下一步」三段式。

**验证**：`cd plugin && pnpm vitest run` 全绿（mock subscribers=0/缺失两分支）

**Evidence**：`evidence/phase-4/fast-fail.diff`

### Task 19: host 一键拉起 relay 路由

- **关联**：BR-007 / ASM-002；UF-005
- **前置任务**：9
- **风险等级**：P1

**涉及文件与定位**：

- `plugin/.../src/host/relay-launch.ts`（新文件）：范本 `applySyncRoute`，`rg "applySyncRoute" src/host/sync.ts`，L75-89（hint）
- `plugin/.../src/index.ts`：`apply`，L24-32（hint）

**具体操作**：

1. 新建 relay-launch.ts：路由 `/dsh-artifact/genoffice-relay`；GET → `{configured: boolean}`（`process.env.DSH_GENOFFICE_ROOT` 存在且 `<root>/scripts/dev.mjs` 可读）；POST → 校验 configured → `spawn(process.execPath, [dev.mjs, 'start-relay'], {detached, stdio:'ignore'})` → 轮询 `http://localhost:8787/api/health` ≤10s → `{ok:true}` 或 `{ok:false,error:'timeout'}`。
2. loopback origin 校验与 405/400 处理照抄 sync.ts。
3. index.ts `apply` 挂载 `applyRelayLaunchRoute(ctx)`。
4. 插件 README 记录 `DSH_GENOFFICE_ROOT` 配置说明（ASM-002 落地）。

**验证**：`cd plugin && pnpm vitest run` 全绿（vitest：未配置 → configured:false；配置假路径 POST → ok:false）

**Evidence**：`evidence/phase-4/relay-launch.diff`

**注意事项**：spawn 必须 detached+unref（不随 DSH 退出）；并发点击需幂等（已在启动中直接复用轮询，不重复 spawn）。

### Task 20: 两处 UI 接入「启动 relay」按钮

- **关联**：BR-007；UF-005
- **前置任务**：19
- **风险等级**：P1

**涉及文件与定位**：

- `plugin/.../src/tabs/relay.ts`：新增 `probeRelayLaunch` / `launchRelay` fetch 封装，`rg "notifyHostSync" src/tabs/relay.ts`（同层放置），L108-118（hint）
- `plugin/.../src/tabs/genoffice.tsx`：条幅，L298-303（hint）
- `plugin/.../src/tabs/control-mode.tsx`：`relayStrip`，L219-224（hint）

**具体操作**：

1. relay.ts：`GET/POST ${location.origin}/dsh-artifact/genoffice-relay` 封装（同源，无 CORS）。
2. 两处条幅：探测 configured=true 时渲染「启动 relay」；点击 → 「启动中…」→ 成功后 `probeRelay(true)` 刷新（面板自动 loadList / 预览自动挂载）；失败显示 error 文案含手动命令。
3. busy/重复点击防护；locales 补文案。

**验证**：`cd plugin && pnpm vitest run` 全绿（条幅渲染分支用例）

**Evidence**：`evidence/phase-4/launch-ui.diff`

### Task 21: 执行 Phase 4 回归验证

- **关联**：本 Phase 全部 BR/UF；INV-004
- **前置任务**：18;20

**验证**：smoke 全绿（工具名镜像含 5 个 open 工具不破坏 89 断言）+ 插件 vitest 全绿

**Evidence**：`evidence/phase-4/`

### Phase 5: 真实场景全套测试与收尾

> 你在哪里：五个改进全部落码并过命令级验证。
> 做完之后：5.2 执行矩阵全绿、evidence 齐全、两仓提交。

### Task 22: 契约与 smoke 终版对齐

- **关联**：INV-001 / INV-004；UF NA（镜像纪律，无用户可见界面）
- **前置任务**：21
- **风险等级**：P1

**具体操作**：

1. 复查 contracts/ 两文件与四处镜像点（server.mjs / 5 control.ts / 插件 host / smoke）的 INV-004 注释互指。
2. smoke 补漏：export saveAs 未注册分支断言、/api/open 响应含 subscribers 数值断言。
3. `node scripts/dev.mjs smoke` 全绿。

**验证**：`node scripts/dev.mjs smoke` → 全部 PASS

**Evidence**：`evidence/phase-5/smoke.log`

### Task 23: 重建全部 web-dist 并部署核对

- **关联**：INV-003；全部 UF 的运行前提
- **前置任务**：22
- **风险等级**：P0

**具体操作**：

1. 五 app `web:build` 全部重建；`rg` 校验新 bundle 含 saved 监听与 dirty 上报特征。
2. relay 托管核对：`curl localhost:8787/{app}/ | rg index-` 与磁盘最新 bundle 一致。
3. 插件 `pnpm run build` 重建 lib/，DSH 重启加载新插件（rev 缓存注意，见 plugin README）。

**验证**：五 app bundle 特征齐全 + relay 托管一致 + 插件 lib 时间戳 ≥ src

**Evidence**：`evidence/phase-5/build.log`

### Task 24: 执行 spec 5.2 真实场景全套测试

- **关联**：全部用户可见 UF（UF-001~005）；INV-003/005
- **前置任务**：23
- **风险等级**：P0

**具体操作**：按 5.2 执行矩阵逐行回放（环境准备见 5.2），每行截图/console/network 归档到对应 `evidence/UF-xxx/`；任何一行失败回到对应任务修复后整表重跑。

**验证**：5.2 执行矩阵全部行通过

**Evidence**：`evidence/UF-001/ ~ UF-005/`（对应 EVD-001~005）

### Task 25: 执行 Phase 5 回归验证（收尾）

- **关联**：全部 BR/UF/INV
- **前置任务**：24

**验证**：`node scripts/dev.mjs smoke` + `cd plugin && pnpm vitest run` + 五 app typecheck 全绿；`python3 ~/.agents/skills/prd-workflow/scripts/validate_package.py docs/genoffice-control-ux` 0 FAIL（证据闸门）；两仓按语义 commit（upstream / 插件）

**Evidence**：`evidence/phase-5/close.log`

---

## 5. 验收与 Review 协议

> **验收铁律：命令级验证（5.1）通过只是入场券，不是完成。** 用户可见的需求必须通过 5.2 真实场景全套测试才算完成。

### 5.1 命令级验证（入场券）

| 验证项 | 命令 | 期望 | Evidence |
|---|---|---|---|
| 契约冒烟 | `cd ~/workspace/dsh/genoffice && node scripts/dev.mjs smoke` | 全部 PASS | EVD-006 |
| 插件测试 | `cd ~/workspace/dsh/plugin/dsh-genoffice/plugin && pnpm vitest run` | 全绿（基线 109，新增后更多） | EVD-006 |
| upstream typecheck | `cd ~/workspace/dsh/plugin/dsh-genoffice/upstream && for w in docs markdown sheets slides pdf; do npm run typecheck -w @genoffice/$w; done` | 0 error | EVD-006 |
| web-dist 构建 | `for w in docs markdown sheets slides pdf; do npm run web:build -w @genoffice/$w; done` | 全部成功 | EVD-006 |
| saveAs API 矩阵 | Task 10 curl 三连 | 形状与 BR-003 一致 | EVD-007 |

### 5.2 真实场景全套测试（Real-Run，完成的唯一标准）

**环境准备**：

| 项 | 值 |
|---|---|
| 启动命令 | `cd ~/workspace/dsh/genoffice && node scripts/dev.mjs start-relay`；DSH：`npx --yes @deepseek-ai/dsh web`（:3080） |
| 访问入口 | `http://127.0.0.1:3080` → 侧栏 GenOffice tab；iframe 由 relay :8787 托管 |
| 测试账号/数据 | 无账号体系；fixture：`cp docs/genoffice-dsh-control/evidence/fixtures/demo.docx /tmp/ux-demo.docx`（md/xlsx/pptx/pdf 同源 fixtures 目录） |
| 干净状态定义 | 删除 /tmp/ux-*.* 副本文件；重启 relay 清执行器注册表；DSH 硬刷新清 doc-registry |
| 可用测试工具 | 浏览器自动化（chrome-devtools-proxy MCP，执行前 probe；ASM-005）；不可用时按下表「操作来源」输出逐步手动脚本请用户执行并回填截图 |

**执行矩阵**（每条 = 2.3 节流程脚本真实回放）：

| UF | 执行方式 | 操作来源 | 必须核对的点 | Evidence |
|---|---|---|---|---|
| UF-001 主路径 | browser | 2.3 UF-001 步骤 1-5 | 保存后 iframe 不重载（DOM 不重建）、undo 可用、第二次保存无 conflict；console 无新增 error | `evidence/UF-001/` |
| UF-001 旧 relay 回退 | browser | 临时以旧 server.mjs（git stash relay 改动）跑同流程 | 回退重挂行为、无 conflict 死循环（INV-003） | `evidence/UF-001/legacy.md` |
| UF-001 写回失败 | browser | chmod 只读目录后保存 | 红色错误、编辑保留 | `evidence/UF-001/` |
| UF-002 主路径 | browser | 2.3 UF-002 步骤 1-3（外部 `touch`+改字节触发冲突） | conflict 提示、另存成功、原文件字节不变、iframe 编辑保留 | `evidence/UF-002/` |
| UF-002 副本已存在 | browser | 预置同名副本再另存 | exists 提示、两文件均不变 | `evidence/UF-002/` |
| UF-003 主路径 | browser | 2.3 UF-003 步骤 1-3 | `● ` 标题、按钮高亮、保存后清除、返回确认可取消 | `evidence/UF-003/` |
| UF-003 伪造消息 | browser console | 手动 postMessage 错误 origin/docId | UI 无变化 | `evidence/UF-003/forged.md` |
| UF-004 主路径 | agent 会话 | chat 内让 agent `pdf_open /tmp/ux-demo.pdf` 并做一次 pdf_* 编辑 | 工具成功、tab 出现、编辑生效 | `evidence/UF-004/` |
| UF-004 GUI 未开 | agent 会话（CLI） | 关闭全部 DSH 页面后调 pdf_open | 秒级失败、文案含「没有 DSH 页面在监听」 | `evidence/UF-004/` |
| UF-005 主路径 | browser | kill relay → 面板点「启动 relay」 | ≤10s 恢复、列表自动刷新 | `evidence/UF-005/` |
| UF-005 未配置 env | browser | 无 `DSH_GENOFFICE_ROOT` 启动 DSH | 无启动按钮、保留手动命令提示 | `evidence/UF-005/` |
| 兼容：非控制模式 | browser | 直接浏览器开 `localhost:8787/docs/?open=path:…`（无 control=1） | 与现状一致、AI dock 可用、无 dirty 消息副作用（INV-005） | `evidence/phase-5/` |

**通过标准**：矩阵全部行通过且 evidence 齐全；任何一行失败 = 未完成。

### 5.3 Evidence 目录结构与命名

```text
evidence/
  phase-{0..5}/     # 每 Phase 命令输出与 summary
  UF-00{1..5}/      # 截图、console log、手动脚本回填
  API-saveas/       # saveAs curl 样例（EVD-007）
```

- 截图命名 `UF-001-success.png` 式；API 样例 `API-saveas-exists.json` 式。
- EVD ID 与 2.5 节一一对应。

### 5.4 Review 专项检查清单

- [ ] 保存成功后 iframe 未重挂（React DevTools 或 DOM 标记核对），undo 栈保留（BR-001）
- [ ] conflict / 写回失败分支绝无 saved 事件推送（relay 日志核对，BR-002）
- [ ] saveAs 用 `wx` 语义，exists 时两侧文件字节均未变（BR-003）
- [ ] dirty 指示源自适配器上报而非「调过工具」近似；伪造 origin 消息被丢弃（BR-004 / 2.7）
- [ ] pdf_open 注册后控制面 89 工具名逐名不变（INV-004，smoke）
- [ ] subscribers=0 快速失败 <2s，不占用 20s 轮询（BR-006）
- [ ] 未配置 `DSH_GENOFFICE_ROOT` 时启动按钮不可见（BR-007）
- [ ] 新插件+旧 relay、新 relay+旧 dist 两个组合各抽一条流程回放（INV-003）
- [ ] 5.2 执行矩阵全部通过，evidence 与 2.5 EVD 清单一致
- [ ] 2.3 每条流程「入口接线清单」从真实入口可达（按钮/工具名逐个点到）
- [ ] 界面交互与 2.3 脚本逐步一致（loading、禁用、错误提示、成功反馈）
- [ ] 所有 BR/UF/INV 可对照第 2 章逐条核销

---

## 质量记录

- 2026-08-25 Stage 1：勘察 20 条事实（1.3），未校准+ASM 占比 28%（≤30%），BR 7 条均有正反例，UF 5 条均有 2.3 流程脚本。
