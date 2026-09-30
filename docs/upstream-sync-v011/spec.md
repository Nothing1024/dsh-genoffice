# upstream-sync-v011 Spec

> Version: 0.1.0 | Date: 2026-09-30 | Status: Ready 可执行
>
> Status 取值（校验脚本核对）：Skeleton 骨架（只有方案，第 4、5 章与 tasks.csv、handoff.md 未填）/ Ready 可执行 / InProgress 执行中 / Done 已验收 / Deferred 已搁置。
>
> 本文件是本需求的**唯一事实源**：事实基线、业务合同、技术方案、任务计划、验收协议全部在此。
> 其他文件（handoff.md、tasks.csv）只引用本文件，不复制内容。
>
> 填写三态规则：每个表格单元格只允许三种内容——
> 1. 验证过的事实（注明来源命令）；2. 显式假设 `ASM-xxx`；3. `待勘察`。
> 禁止编造看似合理的命令、symbol、文件名。
>
> 路径约定：源码路径相对插件仓根（本包所在仓）；引擎仓写作 `../engine`（并列目录）。本包执行时的引擎工作目录是合并 worktree `../engine-sync`（分支 `sync/consolidate-fork`），收尾后回到 `../engine`。

---

## 0. 一页纸人话摘要

- **给谁 / 场景**：在 DSH 侧栏里看着 agent 改 Word、Excel、PPT、PDF 的你；同时是每次手动同步官方 GenOffice 的维护者。
- **做什么**：把魔改引擎升级到官方最新版（v0.11.0 之后），同时保住"边改边看、未保存、可撤销、显式写入磁盘"的现有体验；顺带修掉一个"任意网页能写你磁盘"的安全漏洞。
- **改哪里**：魔改引擎（网页版编辑器 + 本机中继服务 relay）和 DSH 插件的工具层。插件新增一个内部通道，调用官方自带的命令行服务（MCP，官方提供的 agent 接口）处理"新建空白 PPT"。
- **怎么算做完**：
  - agent 现有的全部工具在新引擎上真实调用成功，其中官方已删除的 18 个旧工具由插件内部改写成官方新写法；
  - 在侧栏打开文件、agent 编辑、看到变化、点"写入磁盘"、重开文件还在；
  - 别的网站无法再通过 relay 写你的磁盘；
  - 以后每次同步官方，有一个评审脚本列出官方新增、删除、改了参数的编辑器工具，未经你评审的不会给 agent 用。
- **不做什么**：不把编辑交给 MCP 直接写盘（会丢实时预览和撤销）；不新增官方编辑器里的新工具（只出评审报告，由你逐个决定）；不推送官方仓库。

---

## 1. 事实基线与假设

### 1.1 需求与上下文

| 项 | 结论 |
|---|---|
| 原始需求 | 对话中逐步确定："对比 engine 和最新官方上游，魔改项目如何同步上游"→ 确认"在意实时编辑体验"→"官方已删除的旧工具优先内部转换"→"重叠功能看是否能以调用 MCP 为主"→"MCP 用插件内部调用方式接"→"同步官方后新工具评审后再暴露"→ 调用 spec-workflow 出任务包 |
| 需求来源 | 当前会话对话上下文 + 两仓实际勘察（见 1.3）+ 已暂存的合并工作区 `../engine-sync`（`git diff --cached --shortstat` = 17 files） |
| 置信度 | 中高；业务方向由用户逐条确认，剩余不阻塞的决策点登记为 ASM-001~ASM-006 |
| 输出目录 | `docs/upstream-sync-v011/` |

### 1.2 任务类型与验收重点

| 维度 | 结论 |
|---|---|
| 任务类型 | refactor（上游合并 + 模块迁移）、security（relay 跨站写盘）、bugfix（18 个 Unknown tool、sheets-media 保存误报冲突）、backend（relay 路由、插件 host 工具）、infra（CLI 构建与 MCP 进程） |
| 主要风险 | 645 个官方提交合并冲突（22~24 文件/轮）；模块搬家导致 import 断裂；工具改写后语义偏差；同源检查误伤编辑器自身请求；MCP 与 iframe 同时写同一文件 |
| 行号引用策略 | 行号只作 hint；以 symbol + rg anchor 为准（合并会大面积漂移） |
| 必需验收方式 | typecheck/test/web:build；relay 真实 HTTP 请求（含跨站负向）；Playwright 驱动真实 iframe 编辑器的 e2e；插件 e2e-plugin-alignment |
| 必须覆盖用户场景 | 侧栏实时编辑保存闭环（UF-001）、旧工具改写（UF-002）、新建空白 PPT 走 MCP（UF-003）、跨站写盘被拒（UF-004）、同步评审报告（UF-005） |

### 1.3 勘察事实清单

| 事实 | 来源命令 | 输出摘要 |
|---|---|---|
| 引擎仓 remote：origin=用户 fork，upstream=官方且 push 已禁用 | `git -C ../engine remote get-url --push upstream` | `DISABLED-do-not-push-to-official` |
| 合并 worktree 在 `../engine-sync`，分支 `sync/consolidate-fork`，HEAD=1b58f608，fork 合并已暂存未提交 | `git -C ../engine worktree list`；`git -C ../engine-sync diff --cached --shortstat` | 3 个 worktree（engine / engine-sync / engine-upstream）；17 files changed |
| git 提交身份未配置 | `git -C ../engine config user.name` | 空（unset） |
| `fork/eat-official-engine` 比 origin 多 1 个未推送提交 874bd10 | `git -C ../engine rev-list --left-right --count fork/eat-official-engine...origin/fork/eat-official-engine` | `1 0` |
| fork 当前 HEAD 落后官方 645 个提交；官方 tag 序列 | `git -C ../engine rev-list --count HEAD..upstream/main`；`git tag --merged upstream/main` | 645；v0.10.63 v0.10.488 v0.10.639 v0.10.915 v0.10.1038 v0.10.1467 v0.11.0；main=324b0477 |
| 合并分支对各 tag 的冲突文件数 | `git merge-tree --write-tree --name-only 1b58f608 <tag>`（原分支 `official-sync-de139a0` 已删，指向同一提交） | 6 / 19 / 15 / 17 / 18 / 22 / 22 / 22 |
| 合并分支 typecheck、全量单测、7 个 app web:build、e2e-official-sync、e2e-control-session、插件 e2e-plugin-alignment 通过 | 本会话 `npm run typecheck`、`npm test`、`npm run web:build`、`node web/e2e-official-sync.mjs --all` 等 | 全部 exit 0 |
| sheets-media 保存报 `conflict`，未合并的同步分支同样复现 | `node web/e2e-web-features.mjs --case sheets-media`（合并与基线 worktree 各一次） | `insert-save-ok` failed `{"error":"conflict"}` |
| relay 跨站写盘：合并版带 `overwrite:true` 可改写已有文件；当前 fork 可新建任意文件 | 隔离端口 curl `Origin: https://evil.example`、`Content-Type: text/plain` POST `/api/file` | 合并版 victim→`pwned`；fork 版改写 `conflict`、新建 `ok:true` |
| relay 只校验 Host 和对端 IP，不校验 Origin 与 Content-Type | `rg "function isLoopbackRequest" -A6 ../engine-sync/web/server.mjs` | 只比较 host 与 remoteAddress |
| 编辑器保存路径发 `overwrite: true` | `rg "overwrite: true" ../engine-sync/apps/*/src/renderer/web-bridge.ts` | docs L239、html L230、markdown L235、slides L2226 |
| 18 个插件工具（slides 15、pdf 3）在合并引擎里返回 `Unknown tool` | Playwright 驱动隔离 relay 调 `/api/control/<app>/<docId>/tool` | slides `set_element_text`/`add_text_box`/`delete_slide`、pdf `rotate_page`/`delete_page` 实测 `isError: Unknown tool`；其余按"编辑器源码中搜不到该工具名"判定：`pptx_set_element_{text,style,transform,fill,stroke}`、`crop_image`、`set_picture_opacity`、`delete_slide`、`add_slide`、`add_text_box`、`add_shape`、`add_smartart`、`set_slide_background`、`delete_element`、`ungroup_element`；`pdf_fill_form_field`、`rotate_page`、`delete_page` |
| 被删工具的来源：官方快照 69b4ce05（slides）与 d24c964a（pdf） | `git show 69b4ce05 -- apps/slides/src/renderer/ai/slides-skill.ts \| rg "^-\s+name:"` | 删除 `set_element_text`、`add_text_box`、`delete_element` 等；pdf 删 `fill_form_field`、`rotate_page`、`delete_page` |
| 替代 op 在合并引擎中存在 | `rg -o "'(setText\|setFill\|addElement\|deleteSlide\|…)'" ../engine-sync/apps/slides/src/main/ops/*.ts`；`rg "rotatePages:\|deletePage:\|setFormValue:" ../engine-sync/apps/pdf/src/shared/op-docs.ts` | slides 11 个 op 全部命中；pdf 三个 op 命中，签名 `{pages:[page],dir:90\|-90\|180}` / `{page}` / `{value:{name,value?,checked?}}` |
| slides `apply_ops` 内对 `addElement/addSmartArt/addTable/addChart` 仍执行空白 deck 拦截 | `rg "SCRATCH_GUARDED_OPS = " ../engine-sync/apps/slides/src/renderer/ai/slides-skill.ts` | L1450 `new Set(['addElement', 'addSmartArt', 'addTable', 'addChart'])` |
| 插件工具表 101 条、按能力注册 93 条、schema 76.5KB | `node --experimental-strip-types` 读取 `CONTROL_TOOL_TABLE` + `isExposed` | 93/101；hidden 8 个均为联网工具 |
| 官方编辑器工具定义可在 Node 下直接 import（docs/markdown/html），sheets/pdf 在 Node 下失败 | `tsx` 动态 import 各 `ai/tools.ts` | docs 18、markdown 7、html 6 ok；sheets `Invalid or unexpected token`；pdf `document is not defined` |
| 官方最新版编辑器工具差异：docs +11、markdown +1，slides/pdf 相对 fork 仅少 fork 自加项 | 比较 `git show <ref>:apps/*/src/renderer/ai/tools.ts \| rg -o "name: '…'"` | docs 18→29；markdown 7→8；sheets/html 不变 |
| 官方最新版把 slides ops 迁到 `packages/pptx-ops`，page-spec 迁到 `packages/pipelines`；合并分支 web-bridge 仍 import 旧路径 | `git ls-tree upstream/main packages/`；`rg "script-map\|shared/page-spec" ../engine-sync/apps/slides/src/renderer/web-bridge.ts` | L93 `../main/ops/script-map`、L184 `../shared/page-spec` |
| 官方 CLI/MCP：`create_pptx` 用空 ops 可无桌面版生成 1 页 13.33×7.5in 空白 deck，已存在时报 `output_exists` | 在 `../engine-upstream` 构建 CLI 后 `genoffice create --type pptx --ops <[]> --out …` 两次；MCP `create_pptx` 调用一次 | 2s 内 ok；第二次 `output_exists`；MCP 同样 ok |
| 官方 MCP 常驻延迟 13-85ms，CLI 每次 0.5-1.8s；并发写同一文件丢更新 | 本会话 bench/probe 脚本 | 5 并发 `docs_apply` 全部 ok，文件只剩 1 条 |
| `render`、转 PDF、HTML→Word 需要 GenOffice 桌面版进程 | `genoffice convert a.html --to docx`、`render`；`packages/cli/src/formats/app-export.ts` `appLaunch` | 打印 `starting GenOffice for … export` 后 25s 无结果；按 `GENOFFICE_APP_BIN` / dev Electron / `/Applications/GenOffice.app` 查找 |
| 官方 CLI 的 `docs_check`/`slides_audit`/`info`/`convert pdf→docx、md→docx、docx→md` 无需桌面版 | 同上实测 | 0-2s ok |
| MCP SDK 版本（官方 CLI 依赖） | `node -p "require('../engine-upstream/node_modules/@modelcontextprotocol/sdk/package.json').version"` | 1.30.0 |
| 合并分支尚无 `packages/cli` | `ls ../engine-sync/packages \| rg -c cli` | 0 |
| 插件 host 已可 spawn 子进程（relay-launch），并声明 `x-nothing1024.process.spawn` 权限 | `rg "spawn" packages/tab-genoffice/src/host/relay-launch.ts`；`rg "process.spawn" standards/registry/permissions.md` | 有 |
| 插件 e2e 用例名与端口 | `rg "const CASES\|DEFAULT_PORT" scripts/e2e-plugin-alignment.mjs` | cases: baseline path claim ppt-schema apply-ops no-replay contract land-pages；端口 19787 |
| e2e 默认写插件仓 evidence；`e2e-web-features.mjs` 与 `generate-capability-manifest.mjs` 的 `PLUGIN_ROOT` 默认值是绝对路径 | `rg "^const PLUGIN = " ../engine-sync/web/e2e-web-features.mjs ../engine-sync/web/generate-capability-manifest.mjs` | 两处默认 `/Users/nothing/...` |
| 引擎 CLAUDE.md 已加同步评审规则（已暂存）；插件 AGENTS.md 已加指向（未提交） | `rg "## Syncing the official upstream" ../engine-sync/CLAUDE.md`；`git status --short` | L5；` M AGENTS.md` |
| 引擎文档禁止中文；现有违规来自 fork 自有中文文档 | `node ../engine-sync/tools/check-english-comments.mjs` | 违规集中在 `genoffice-web-findings.md` 158、`web/README.md` 147、`DSH.md` 14、`README.md` 2 等；本会话新加的 `CLAUDE.md` 段落不在列表 |

### 1.4 假设清单

| 假设 ID | 内容 | 风险 | 确认方式 |
|---|---|---|---|
| ASM-001 | 用户会提供 git 提交 name/email；执行前不得编造身份 | 无身份则所有 commit 任务阻塞 | Task 1 开头向用户确认；未给则该任务标 `已阻塞:缺提交身份` |
| ASM-002 | 用户同意 relay 同源检查（安全改动需确认，已在对话中提出、未明确回复） | 未同意则 BR-003 相关任务不能执行 | Task 1 同时确认；未同意则 Task 3 标 `暂缓:待用户同意安全改动` |
| ASM-003 | 已开放工具官方改了参数时，评审前"照常注册并在报告中标红"（用户未选定，取对 agent 可用性影响最小的做法） | 行为变化被忽略 | Task 14 实现前向用户确认一次；用户选"暂停注册"则按 BR-006 反例改实现 |
| ASM-004 | 全部验证通过后把 `main` 快进到 `sync/consolidate-fork` 的合并结果并推送到 origin（origin 只保留 `main`，2026-09-30 已完成前置合并与分支收敛） | 推送需用户同意 | 最终任务前向用户确认；不同意则只保留本地结果 |
| ASM-005 | 按 tag 合并时每轮冲突可在魔改文件内解决，不需要改动官方核心算法 | 某轮冲突需要重写官方逻辑 | 每轮合并任务记录冲突文件与解决理由；超出预期时阻塞并报告 |
| ASM-006 | sheets 与 pdf 的编辑器工具定义在 Node 下无法直接 import，工具清单改为由 iframe 执行器在注册时上报（运行时 discovery） | 若浏览器端上报不可行需改方案 | Task 13 实测六个 app 执行器上报结果 |

---

## 2. 业务合同

### 2.1 BR 业务规则

<a id="BR-001"></a>

| 规则 ID | 规则 | 正例 | 反例 | 影响范围 | 验证方式 |
|---|---|---|---|---|---|
| BR-001 | 引擎升级到官方 `upstream/main` 全部历史，魔改只存在于 fork 自有文件与最小接入点 | `git merge-base --is-ancestor upstream/main HEAD` 为真；`App.tsx` 中魔改接入只剩一行 hook 调用 | 为省冲突丢弃官方文件改动；把 fork 逻辑散落回官方 `App.tsx` | 引擎仓全部 app | ancestry 检查 + diff 审阅 + typecheck/test |
| BR-002 | 插件已暴露工具在新引擎上真实调用成功；官方已删除的旧工具保留原名和参数，由插件 host 改写成编辑器 `apply_ops` 调用 | `pptx_set_element_text` 调用后编辑器里文字变化、可撤销、未保存 | 返回 `Unknown tool`；改写后直接写盘；改写后丢失撤销 | 插件 host 工具层 | e2e 对每个改写工具真实调用 + 回读 |
| BR-003 | relay 拒绝跨站写请求：非 GET 请求带非本机 Origin 或非 JSON Content-Type（原始字节接口除外）一律 403 | 侧栏与编辑器自身请求正常 | `Origin: https://evil.example` 的 `text/plain` POST `/api/file` 写入成功 | relay 全部写接口 | 负向 curl 用例 + 回归测试 |
| BR-004 | 编辑器保存写盘必须带版本校验，不再用 `overwrite: true` 无条件覆盖 | 磁盘文件被外部修改后保存返回 `conflict` | 外部改动被静默覆盖 | docs/html/markdown/slides web-bridge 保存路径 | e2e：外部改盘后保存 → conflict |
| BR-005 | "新建空白 PPT"改由插件内部调用官方 MCP `create_pptx`，结果与原行为一致：生成 1 页 13.33×7.5in、目标已存在则拒绝 | 新路径生成文件可在侧栏打开编辑 | 覆盖已存在文件；依赖 relay `/api/pptx/create` 或 fork 的 `blank-pptx.mjs` | 插件 `pptx_create`、relay、引擎 pptx-engine | e2e 新建两次（第二次拒绝）+ 打开编辑 |
| BR-006 | 同步官方后，官方新增的编辑器工具未经 `capability.ts` 登记不注册；评审脚本列出新增、删除、参数变化三类 | 新工具出现在报告"未登记"里且不注册 | 新工具自动出现在 agent 工具列表 | 插件注册逻辑 + 评审脚本 | 评审脚本输出 + 注册数比对 |
| BR-007 | MCP 写入的目标文件正在侧栏控制模式打开时，插件拒绝该写入 | 侧栏打开 a.pptx 时对 a.pptx 调 MCP 写工具 → 拒绝并提示用插件编辑工具 | MCP 写盘后侧栏旧内容保存覆盖 MCP 结果 | 插件 MCP 通道 | e2e：打开文件后调 `pptx_create` 同路径 → 拒绝 |
| BR-008 | 保存时不得误报冲突：编辑器导出带的版本与磁盘当前文件一致时写入成功 | sheets 插图后保存成功 | sheets-media `insert-save-ok` 报 conflict | sheets 控制执行器导出路径 | `e2e-web-features --case sheets-media` 通过 |

### 2.2 UF 用户验收场景（索引）

| 场景 ID | Given | When | Then | 角色 | 验证方式 | Evidence |
|---|---|---|---|---|---|---|
| UF-001 | 侧栏以控制模式打开 docx/xlsx/pptx/md/pdf | agent 调编辑工具，用户点"写入磁盘"，再重开 | 编辑即时可见、未保存标记出现、保存后重开内容仍在 | 用户 + agent | e2e（Playwright 驱动 iframe） | EVD-001 |
| UF-002 | 侧栏打开 pptx/pdf | agent 调用官方已删除的旧工具（如 `pptx_set_element_text`、`pdf_rotate_page`） | 编辑器执行等效 op，结果可见、可撤销、未落盘 | agent | e2e | EVD-002 |
| UF-003 | 目标路径不存在 | agent 调 `pptx_create` | 生成空白 deck 并可在侧栏打开；再次调用同路径被拒绝 | agent | e2e | EVD-003 |
| UF-004 | relay 运行中 | 跨站网页向 relay 发写请求 | 请求被 403 拒绝，磁盘不变；侧栏自身请求照常 | 攻击者 / 用户 | curl 负向 + e2e 回归 | EVD-004 |
| UF-005 | 维护者合并了新的官方 tag | 运行评审脚本 | 输出新增/删除/参数变化三类工具清单；未登记工具不注册 | 维护者 | CLI 运行 | EVD-005 |

### 2.3 核心业务流程（步骤级交互脚本）

#### UF-001: 侧栏实时编辑并显式保存

**前置状态**：DSH（:3082）右侧栏 GenOffice 页签；relay 运行在新引擎上；目标文件存在且未被其他写入方修改。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 在侧栏点开文件（或 agent 调 `*_open`） | 侧栏显示加载中 | relay 注册控制执行器，readiness 由 loading→ready | 编辑器显示文档内容 |
| 2 | agent 调编辑工具（如 `docx_insert_content`） | 工具卡显示执行中 | relay 转发到 iframe `executeTool`，revision 递增 | 文档内容即时变化；"写入磁盘"按钮变为有未保存标记 |
| 3 | 用户点"写入磁盘" | 按钮显示"写入中…" | relay `/export` 带版本校验原子写盘 | 未保存标记消失 |
| 4 | 用户点"从磁盘重新加载"并确认 | 侧栏重新加载 | 从磁盘重新解析 | 刚才的编辑仍在 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 外部改盘冲突 | 打开后文件被外部修改，再点保存 | 保存失败提示冲突，编辑内容保留 | `/export` 返回 `conflict`，磁盘不变 | 另存为副本或重新加载 |
| 旧 revision | agent 带过期 `expectedRevision` 调工具 | 工具卡报错 | relay 返回 `conflict` 与当前 revision | agent 重读 context 后重试 |
| relay 不可用 | relay 进程未启动 | 侧栏提示 relay 不可用并提供"启动 relay" | 工具调用报 relay-down | 点"启动 relay"后重新检查 |

**界面状态机**：

```text
loading → ready(clean) → dirty → saving → ready(clean)
   |                        |         |
   v                        v         v
 error(可重新检查)     conflict(保留编辑，可另存/重载)
```

**入口接线清单**：

- 侧栏页签打开文件 → `packages/tab-genoffice/src/tabs/control-mode.tsx` 控制模式 iframe
- agent 工具 `*_open` / 编辑工具 / `*_save` → `packages/tab-genoffice/src/host/tools.ts` → relay `/api/control/*`
- "写入磁盘"按钮 → `control-mode.tsx` 保存 → relay `/export`

#### UF-002: 调用官方已删除的旧工具

**前置状态**：侧栏已按 UF-001 打开 pptx 或 pdf，执行器 ready。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | agent 调 `pptx_set_element_text {slideIndex, sourceId, paragraphs}` | 工具卡执行中 | 插件 host 改写为 `apply_ops [{op:'setText', …}]` 发给 iframe | — |
| 2 | — | — | 编辑器执行事务，返回 records | 幻灯片文字变化；有未保存标记；Cmd+Z 可撤销 |
| 3 | agent 调 `pdf_rotate_page {page, direction:'right'}` | 工具卡执行中 | 改写为 pdf `apply_ops [{op:'rotatePages', pages:[page], dir:90}]` | 页面旋转，未落盘 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 参数非法 | sourceId 不存在 / 页码越界 | 工具卡显示编辑器返回的错误原文 | op 被整体拒绝，文档不变 | agent 按错误提示修正 |
| 空白 deck 拦截 | 在空白 deck 上调 `pptx_add_text_box` | 工具卡显示拦截原因 | `SCRATCH_GUARDED_OPS` 拦截 `addElement` | agent 改用 `pptx_generate_deck` |

**界面状态机**：

```text
idle → calling → applied(dirty)
          |
          v
        rejected(文档不变，错误原文可见)
```

**入口接线清单**：

- agent 工具名不变 → `tools.ts` 注册 → 改写层 → relay `/api/control/<app>/<docId>/tool`（`name: 'apply_ops'`）

#### UF-003: 新建空白 PPT（走 MCP）

**前置状态**：目标路径不存在；引擎已构建 `packages/cli`。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | agent 调 `pptx_create {path}` | 工具卡执行中 | 插件确认路径未在侧栏打开 → 懒启动 `genoffice mcp` → `create_pptx {out, ops: []}` | — |
| 2 | — | — | MCP 返回 `status: ok` | 工具卡显示已创建 |
| 3 | agent 调 `pptx_open` | 侧栏打开新文件 | 同 UF-001 | 1 页空白 deck，可编辑 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 目标已存在 | 同路径再次调用 | 工具卡报"文件已存在" | MCP 返回 `output_exists`，磁盘不变 | 换路径 |
| 文件正在侧栏打开 | 同路径已在控制模式 | 工具卡报"文件正在侧栏编辑" | 插件在调用 MCP 前拒绝（BR-007） | 关闭页签或换路径 |
| MCP 启动失败 | CLI 未构建 / 进程崩溃 | 工具卡报 MCP 不可用及修复命令 | 连接失败，不写盘 | 执行 CLI 构建后重试 |

**界面状态机**：

```text
idle → connecting(首次) → calling → created
                 |            |
                 v            v
          mcp-unavailable   rejected(exists / open-in-sidebar)
```

**入口接线清单**：

- agent 工具 `pptx_create` → `tools.ts` 分支 → 新 MCP 客户端模块 → `genoffice mcp`（stdio）

#### UF-004: 跨站写请求被拒绝

**前置状态**：relay 运行；攻击网页位于非本机 origin。

**成功主路径**（对防御方而言）：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 用户浏览恶意网页 | 无 | 网页发 `text/plain` POST `/api/file` | — |
| 2 | — | — | relay 按 Origin/Content-Type 判定跨站 → 403 | 磁盘文件不变 |
| 3 | 用户在侧栏正常编辑并保存 | 同 UF-001 | 本机 origin + JSON 请求放行 | 保存成功 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 伪造 JSON 跨站 | 带 `Content-Type: application/json` 的跨站请求 | 无 | 浏览器先发预检，relay 对非本机 origin 不回 CORS 头；非浏览器客户端带 Origin 头则 403 | 无需恢复 |
| 原始字节接口 | `/api/inject` 使用 `application/octet-stream` | 无 | 该路由仍要求本机 Origin 或无 Origin | 无需恢复 |

**界面状态机**：

```text
request → origin/type check → allowed → handler
                   |
                   v
                 403（磁盘不变）
```

**入口接线清单**：

- relay 统一入口 `createServer` 回调 → 写接口前置检查（CLI 场景：`curl` 直连验证）

#### UF-005: 同步官方后的工具评审

**前置状态**：维护者已合并一个官方 tag 并构建；relay 可启动。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 运行评审脚本 | 终端输出进度 | 拉取各执行器上报的工具定义，对比 `CAPABILITY` 与上次快照 | — |
| 2 | — | — | 生成三类清单 | 终端与报告文件列出：未登记的新增工具、已登记但被删除/改名、已登记但参数变化 |
| 3 | 在 `capability.ts` 登记决定后重跑 | — | 已登记工具注册 | 报告对应条目消失 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| relay 未启动 | 无法获取上报 | 脚本报错并给出启动命令 | 非 0 退出 | 启动 relay 后重跑 |
| 执行器未就绪 | 某 app 页面未加载 | 该 app 标"未获取"而非"无变化" | 非 0 退出 | 检查 web:build 后重跑 |

**界面状态机**：

```text
start → collecting → diffing → report(0 = 无待评审 / 1 = 有待评审)
            |
            v
          error(非 0，提示修复命令)
```

**入口接线清单**：

- CLI：`node scripts/tool-review.mjs`（新增，插件仓）→ relay 上报接口

### 2.4 INV 不变量

| 不变量 ID | 内容 | 关联 BR/UF | 验证方式 |
|---|---|---|---|
| INV-001 | 控制模式下编辑只在内存生效，磁盘只在显式保存时变化 | BR-002、UF-001、UF-002 | e2e 编辑后比对磁盘 sha256 不变，保存后变化 |
| INV-002 | 编辑器撤销栈可撤销 agent 编辑（含改写后的旧工具） | BR-002、UF-002 | e2e 调用后触发撤销，内容复原 |
| INV-003 | 不向官方仓库推送；不修改官方远程配置之外的 git 设置除非用户同意 | BR-001 | `git remote get-url --push upstream` 仍为 DISABLED |
| INV-004 | relay 仅绑定 loopback；非本机对端仍 403 | BR-003、UF-004 | curl 从非 loopback 或伪造 Host 仍拒绝 |
| INV-005 | agent 可见工具名与参数不因本次改造改变（新增评审通过的除外） | BR-002、BR-006 | 注册工具名与参数快照比对 |
| INV-006 | 用户原工作区 `../engine`（`main`）在收尾前不被修改 | BR-001 | `git -C ../engine status --short` 前后一致 |

### 2.5 EVD 证据清单

| 证据 ID | 类型 | 期望证据 | 保存位置 |
|---|---|---|---|
| EVD-001 | e2e log + screenshot | 五族打开→编辑→保存→重开，磁盘 sha 前后记录 | `evidence/UF-001/` |
| EVD-002 | e2e log | 18 个改写工具逐个调用结果、撤销结果 | `evidence/UF-002/` |
| EVD-003 | e2e log | 新建、重复新建拒绝、打开中拒绝、打开编辑 | `evidence/UF-003/` |
| EVD-004 | curl request/response | 跨站写被拒（改写、新建、JSON 伪造、inject） | `evidence/UF-004/` |
| EVD-005 | CLI 输出 | 评审报告三类清单 | `evidence/UF-005/` |

### 2.6 角色与权限矩阵

单一本机用户，无账号体系；"攻击者"只是跨站网页，负向覆盖见 UF-004。

### 2.7 负向 / 破坏性场景

| 场景 | Given | When | Then | Evidence |
|---|---|---|---|---|
| 并发写同一文件 | 侧栏打开文件 | MCP 写同一路径 | 插件拒绝（BR-007） | EVD-003 |
| 旧数据兼容 | 已有会话历史引用旧工具名 | 新引擎下调用旧工具 | 改写后成功（BR-002） | EVD-002 |
| 依赖失败 | CLI 未构建 | 调 `pptx_create` | 明确报错，不写盘 | EVD-003 |

权限不足与空数据不适用：单用户本机工具，无账号与空列表场景。

### 2.8 非目标

- 不把编辑类工具交给 MCP 直接写盘。
- 不开放官方新增的编辑器工具（docs 11 个、markdown 1 个、pdf 新工具），只出评审报告。
- 不接入需要桌面版的 MCP 功能（`render`、转 PDF、HTML→Word）；relay 现有打印、OCR、HTML→Word 服务保留。
- 本轮不新增 MCP 文件级工具（`docs_check`、`sheet_check`、`slides_audit`、`convert`、`merge`）；MCP 通道建好后按 BR-006 评审另行开放。
- 不用 `dsh-mcp-client` 直接挂载 MCP。
- 不推送官方仓库。

---

## 3. 技术方案

### 3.1 架构 Before / After

```text
Before:
agent ─ 插件 host 101 条手写工具 ─ relay(:8787, 无 Origin 校验) ─ iframe 编辑器(fork 基线 08-20)
                              └─ /api/pptx/create + fork blank-pptx.mjs

After:
agent ─ 插件 host（工具名不变）
        ├─ 编辑类 ─ 改写层(18 旧工具→apply_ops) ─ relay(:8787, Origin/Type 校验) ─ iframe 编辑器(官方 v0.11+ + dsh-control)
        ├─ pptx_create ─ 内部 MCP 客户端 ─ genoffice mcp(stdio, 引擎自建 packages/cli)
        └─ 注册前过 CAPABILITY；评审脚本对比执行器上报的工具定义
```

### 3.2 模块改造

| 模块 | 职责 | 改造说明 |
|---|---|---|
| 引擎合并分支 | 承载官方历史 + 魔改 | 提交当前合并；按 tag 合并官方到 main；修 import 迁移 |
| 引擎控制执行器 | iframe 内执行工具 | 魔改 `control.ts` 改名 `dsh-control.ts`，保留官方同名文件；App 接入收成 hook；注册时上报工具定义（ASM-006） |
| relay | 文件、控制面、服务 | 写接口加 Origin/Content-Type 校验；保存路径改版本校验；删除 `/api/pptx/create` |
| sheets 控制执行器 | 导出版本 | 修正导出 `expectedRevision` 与磁盘版本不一致 |
| 插件改写层 | 旧工具兼容 | 18 个旧工具参数→op 映射，发 `apply_ops` |
| 插件 MCP 客户端 | 文件级操作 | 懒启动 `genoffice mcp`，只供 `pptx_create`；写前检查侧栏占用 |
| 插件评审脚本 | 同步评审 | 对比上报工具与 `CAPABILITY`、上次快照 |
| e2e | 真实验证 | 覆盖改写工具、MCP 新建、跨站负向；修 `PLUGIN_ROOT` 绝对路径与 evidence 默认输出 |

### 3.3 三段式定位清单

| 文件 | 稳定定位 | 搜索定位 | 行号 hint | 备注 |
|---|---|---|---|---|
| `packages/tab-genoffice/src/host/capability.ts` | `export const CAPABILITY` | `rg "export const CAPABILITY" packages/tab-genoffice/src/host/capability.ts` | L23 | 登记表；18 个旧工具 evidence 需更新 |
| `packages/tab-genoffice/src/host/capability.ts` | `export function isExposed` | `rg "export function isExposed" packages/tab-genoffice/src/host/capability.ts` | L128 | 注册闸门 |
| `packages/tab-genoffice/src/host/tool-schema.ts` | `export const CONTROL_TOOL_TABLE` | `rg "export const CONTROL_TOOL_TABLE" packages/tab-genoffice/src/host/tool-schema.ts` | L71 | 101 条手写定义 |
| `packages/tab-genoffice/src/host/tool-schema.ts` | `pptx_set_element_text` 条目 | `rg "name: 'pptx_set_element_text'" packages/tab-genoffice/src/host/tool-schema.ts` | L615 | 旧工具之一 |
| `packages/tab-genoffice/src/host/tool-schema.ts` | `pdf_rotate_page` 条目 | `rg "name: 'pdf_rotate_page'" packages/tab-genoffice/src/host/tool-schema.ts` | L1551 | 参数 `page`、`direction: left\|right` |
| `packages/tab-genoffice/src/host/tools.ts` | `async function callRelay` | `rg "async function callRelay" packages/tab-genoffice/src/host/tools.ts` | L201 | 改写层接入点 |
| `packages/tab-genoffice/src/host/tools.ts` | `pptx_create` 分支 | `rg "entry.name === 'pptx_create'" packages/tab-genoffice/src/host/tools.ts` | L671 | 改走 MCP |
| `packages/tab-genoffice/src/host/tools.ts` | `function shouldRegister` | `rg "function shouldRegister" packages/tab-genoffice/src/host/tools.ts` | L105 | discovery 过滤 |
| `packages/tab-genoffice/src/tabs/doc-registry.ts` | `export function lookupActive` | `rg "export function lookupActive" packages/tab-genoffice/src/tabs/doc-registry.ts` | L19 | 侧栏占用查询（BR-007） |
| `packages/tab-genoffice/src/host/relay-launch.ts` | `export function isRelayLaunchConfigured` | `rg "export function isRelayLaunchConfigured" packages/tab-genoffice/src/host/relay-launch.ts` | L19 | 子进程启动先例 |
| `scripts/e2e-plugin-alignment.mjs` | `const DEFAULT_PORT` | `rg "^const DEFAULT_PORT" scripts/e2e-plugin-alignment.mjs` | L34 | 新增用例 |
| `../engine-sync/web/server.mjs` | `function isLoopbackRequest` | `rg "function isLoopbackRequest" ../engine-sync/web/server.mjs` | L137 | 同源检查接入点 |
| `../engine-sync/web/server.mjs` | `const server = createServer` | `rg "const server = createServer" ../engine-sync/web/server.mjs` | L1498 | CORS 与统一入口 |
| `../engine-sync/web/server.mjs` | `/api/pptx/create` 路由 | `rg "pathname === '/api/pptx/create'" ../engine-sync/web/server.mjs` | L1381 | 删除 |
| `../engine-sync/web/write-atomic.mjs` | `overwrite !== true` | `rg "overwrite !== true" ../engine-sync/web/write-atomic.mjs` | L83 | overwrite 放行点 |
| `../engine-sync/apps/docs/src/renderer/web-bridge.ts` | `overwrite: true` | `rg "overwrite: true" ../engine-sync/apps/docs/src/renderer/web-bridge.ts` | L239 | 同 html L230、markdown L235、slides L2226 |
| `../engine-sync/apps/sheets/src/renderer/control.ts` | `expectedRevision: fileRev` | `rg "expectedRevision: fileRev" ../engine-sync/apps/sheets/src/renderer/control.ts` | L334 | sheets-media 误报冲突嫌疑点 |
| `../engine-sync/apps/slides/src/renderer/control.ts` | `export function initControlMode` | `rg "export function initControlMode" ../engine-sync/apps/slides/src/renderer/control.ts` | L139 | 6 个 app 同名，改名为 dsh-control |
| `../engine-sync/apps/slides/src/renderer/web-bridge.ts` | `script-map` import | `rg "main/ops/script-map" ../engine-sync/apps/slides/src/renderer/web-bridge.ts` | L93 | 官方已迁到 `packages/pptx-ops` |
| `../engine-sync/apps/slides/src/renderer/ai/slides-skill.ts` | `SCRATCH_GUARDED_OPS` | `rg "SCRATCH_GUARDED_OPS = " ../engine-sync/apps/slides/src/renderer/ai/slides-skill.ts` | L1450 | 空白 deck 拦截 |
| `../engine-sync/apps/pdf/src/shared/op-docs.ts` | `rotatePages:` | `rg "rotatePages:" ../engine-sync/apps/pdf/src/shared/op-docs.ts` | L138 | pdf op 签名 |
| `../engine-sync/web/capability-manifest.mjs` | `export function buildDiscovery` | `rg "export function buildDiscovery" ../engine-sync/web/capability-manifest.mjs` | L107 | discovery 改为执行器上报 |
| `../engine-sync/web/e2e-web-features.mjs` | `const PLUGIN` 绝对路径默认 | `rg "^const PLUGIN = " ../engine-sync/web/e2e-web-features.mjs` | L21 | 改相对 |
| `../engine-sync/web/generate-capability-manifest.mjs` | `const PLUGIN` 绝对路径默认 | `rg "^const PLUGIN = " ../engine-sync/web/generate-capability-manifest.mjs` | L12 | 改相对或删除 |
| `../engine-sync/CLAUDE.md` | 同步评审规则 | `rg "## Syncing the official upstream" ../engine-sync/CLAUDE.md` | L5 | 已暂存 |

### 3.4 API / 数据 / 权限 / 路由影响

| 类型 | 是否影响 | 说明 | 兼容策略 |
|---|---|---|---|
| API | 是 | relay 删除 `/api/pptx/create`；写接口新增 403；`/api/discovery` 改为执行器上报来源 | 插件同版本切换；`contracts/relay-api.md`、`contracts/control-api.md` 同步 |
| 数据 | 否 | 文档文件格式不变 | — |
| 权限 | 是 | relay 写接口收紧 | 本机侧栏请求回归验证 |
| 路由 | 否 | 侧栏与编辑器 URL 不变 | — |

---

## 4. Phase 计划与任务详情

> Phase 依赖链：

```text
P0 前置与基线 → P1 安全与已知缺陷 → P2 官方上游合并 → P3 插件兼容与 MCP → P4 验收与收尾
```

> 状态板：同目录 `tasks.csv`。本章只写任务详情，不放状态表、不写前置任务。
> 命令均在插件仓根执行；引擎命令用 `npm --prefix ../engine-sync` 或 `(cd ../engine-sync && …)`。
> e2e 一律带 `--out docs/upstream-sync-v011/evidence/…`，不写其他任务包的 evidence 目录。

### Phase 0: 前置与基线

> 你在哪里：合并已暂存未提交；无提交身份；安全改动未获同意。
> 做完之后：合并提交在 `sync/consolidate-fork`，基线测试结果落盘。

### Task 1: 确认提交身份与安全改动许可

- **关联**：INV-003 / INV-006（非用户可见任务，UF 写 NA：只收集决策）
- **风险等级**：P1

**为什么做**：ASM-001（提交身份）与 ASM-002（relay 同源检查许可）未消解，后续提交与 P1 安全任务都依赖它们。

**涉及文件与定位**：

- 无源码改动；读 `git -C ../engine config user.name` 确认仍未配置。

**具体操作**：

1. 向用户确认 git 提交 name/email；只在 `../engine-sync` 用 `git -c user.name=… -c user.email=…` 或用户指定方式使用，不改全局配置。
2. 向用户确认同意 relay 写接口加同源检查（BR-003）与保存改版本校验（BR-004）。
3. 把结论写进 1.4 节对应 ASM（证实则回写 1.3 并删除 ASM 行）。

**验证**：`git -C ../engine remote get-url --push upstream` → 期望 `DISABLED-do-not-push-to-official`；spec 1.4 节 ASM-001/ASM-002 已消解或对应任务已标阻塞/暂缓

**Evidence**：`evidence/phase-0/decisions.md`

**注意事项**：易错点 用户未回复时编造身份；禁止 修改 `~/.gitconfig`

### Task 2: 提交合并并记录测试基线

- **关联**：BR-001 / INV-006 / EVD-001（非用户可见任务，UF 写 NA：基线记录）
- **风险等级**：P1

**为什么做**：已暂存的 fork 合并（17 files，含 `CLAUDE.md` 同步规则）是后续所有合并的起点；需要可比对的测试通过数。

**涉及文件与定位**：

- `../engine-sync/CLAUDE.md`：`## Syncing the official upstream`，`rg "## Syncing the official upstream" ../engine-sync/CLAUDE.md`，L5（hint）
- `../engine-sync/web/server.mjs`：`/api/pptx/create` 路由，`rg "pathname === '/api/pptx/create'" ../engine-sync/web/server.mjs`，L1381（hint）

**具体操作**：

1. `git -C ../engine-sync diff --cached --stat` 审阅；确认无未解决冲突（`git -C ../engine-sync ls-files -u` 为空）。
2. 用 Task 1 的身份 `git -C ../engine-sync commit`，message 写明来源两条分支与 14 个冲突的解决方式。
3. 记录基线：引擎 typecheck/test/web:build、`e2e-official-sync --all`、`e2e-control-session --all`、插件 `e2e-plugin-alignment --all`、`e2e-web-features --case sheets-media`（预期失败，作为 BR-008 基线）。

**验证**：`git -C ../engine-sync log -1 --merges --format=%s` → 期望非空；`npm --prefix ../engine-sync run typecheck` → exit 0；Phase 出口检查：`npm --prefix ../engine-sync test && node ../engine-sync/web/e2e-control-session.mjs --all --out docs/upstream-sync-v011/evidence/phase-0/css` → 通过，通过数写入 baseline.log

**Evidence**：`evidence/phase-0/baseline.log`、`evidence/phase-0/exit.log`

**注意事项**：易错点 e2e 默认写其他包 evidence，务必带 `--out`；禁止 在 `../engine` 原工作区提交（INV-006）

### Phase 1: 安全与已知缺陷

> 你在哪里：relay 可被跨站写盘；sheets 保存误报冲突。
> 做完之后：跨站写被拒，sheets-media 通过。

### Task 3: 给 relay 写接口加同源检查

- **关联**：BR-003 / UF-004 / INV-004 / EVD-004
- **风险等级**：P0

**为什么做**：本会话已复现跨站 `text/plain` POST `/api/file` 改写/新建文件（1.3）。

**涉及文件与定位**：

- `../engine-sync/web/server.mjs`：`function isLoopbackRequest`，`rg "function isLoopbackRequest" ../engine-sync/web/server.mjs`，L137（hint）
- `../engine-sync/web/server.mjs`：`const server = createServer`，`rg "const server = createServer" ../engine-sync/web/server.mjs`，L1498（hint）

**具体操作**：

1. 在统一入口对所有非 GET/OPTIONS 的 `/api/*` 请求：带 Origin 且不匹配本机 origin 正则 → 403；JSON 接口要求 `Content-Type: application/json`，原始字节接口（`/api/inject` 等 `application/octet-stream`）只放行本机或无 Origin。
2. 保留 `isLoopbackRequest`（INV-004），新检查叠加在其前。
3. 在 `web/` 增加针对该检查的 node:test 回归用例（跨站改写、跨站新建、JSON 伪造、inject、本机正常请求）。

**验证**：`node --test ../engine-sync/web/*.test.mjs` → 全部通过；`node ../engine-sync/web/e2e-control-session.mjs --all --out docs/upstream-sync-v011/evidence/phase-1/css` → 通过（编辑器自身请求未被误伤）

**Evidence**：`evidence/UF-004/cross-origin.log`、`evidence/phase-1/css/`

**注意事项**：易错点 漏掉 CORS 预检（OPTIONS）或误拦侧栏 `http://127.0.0.1:3082` 来源；禁止 用通配 `*`

### Task 4: 编辑器保存改为版本校验写盘

- **关联**：BR-004 / UF-001 / INV-001 / EVD-001
- **风险等级**：P1

**为什么做**：docs/html/markdown/slides 保存带 `overwrite: true`，外部改动会被静默覆盖，也是跨站漏洞的放大器。

**涉及文件与定位**：

- `../engine-sync/apps/docs/src/renderer/web-bridge.ts`：`overwrite: true`，`rg "overwrite: true" ../engine-sync/apps/docs/src/renderer/web-bridge.ts`，L239（hint；html L230、markdown L235、slides L2226 同理）
- `../engine-sync/web/write-atomic.mjs`：`overwrite !== true`，`rg "overwrite !== true" ../engine-sync/web/write-atomic.mjs`，L83（hint）

**具体操作**：

1. 四处保存改为传加载时记录的 `expectedRevision`（`bindLoadMeta` 已提供 fileRevision）。
2. 保存成功后用 relay 返回的新 revision 更新本地基线，保证连续保存不误报。
3. relay `/api/file` 仅在显式"另存为新文件"时允许无版本写入。

**验证**：`node ../engine-sync/web/e2e-control-session.mjs --case file-conflict --out docs/upstream-sync-v011/evidence/phase-1/conflict` → 外部改盘后保存返回 conflict 且磁盘不变；`node ../engine-sync/web/e2e-official-sync.mjs --case five-family --out docs/upstream-sync-v011/evidence/phase-1/five` → 通过

**Evidence**：`evidence/phase-1/conflict/`、`evidence/phase-1/five/`

**注意事项**：易错点 连续两次保存第二次误报 conflict；禁止 删除 conflict 分支求绿

### Task 5: 修复 sheets 保存误报冲突

- **关联**：BR-008 / UF-001 / EVD-001
- **风险等级**：P1

**为什么做**：`sheets-media` 插图后保存报 `conflict`，合并前的同步分支同样复现（1.3），会让 sheets 插图后的保存不可用。

**涉及文件与定位**：

- `../engine-sync/apps/sheets/src/renderer/control.ts`：`expectedRevision: fileRev`，`rg "expectedRevision: fileRev" ../engine-sync/apps/sheets/src/renderer/control.ts`，L334（hint）

**具体操作**：

1. 先复现并定位：对比导出时 `fileRev` 与写盘前磁盘 sha256，确认是基线未随上一次保存/插图更新，还是插图路径绕过了 `saved` 事件。
2. 修正基线更新时机，保持冲突检测对外部改盘仍生效。
3. 把复现步骤保留为回归（sheets-media 用例即是）。

**验证**：`node ../engine-sync/web/e2e-web-features.mjs --case sheets-media --out docs/upstream-sync-v011/evidence/phase-1/sheets-media` → 通过；Phase 出口检查：`node --test ../engine-sync/web/*.test.mjs && node ../engine-sync/web/e2e-control-session.mjs --all --out docs/upstream-sync-v011/evidence/phase-1/exit-css` → 通过，通过数不低于基线

**Evidence**：`evidence/phase-1/sheets-media/`、`evidence/phase-1/exit.log`

**注意事项**：易错点 为消除误报把 expectedRevision 置空；禁止 关闭外部改盘检测

### Phase 2: 官方上游合并

> 你在哪里：合并分支基于 de139a0，落后官方 547 个提交。
> 做完之后：包含 `upstream/main` 全部历史，魔改收敛到 dsh-control 与一行 hook，CLI 可构建。

### Task 6: 拆分控制执行器避开官方同名文件

- **关联**：BR-001 / INV-001 / INV-005（非用户可见任务，UF 写 NA：结构调整，零行为变更）
- **风险等级**：P1

**为什么做**：官方在 v0.10.488 新增了语义不同的同名 `control.ts`（docs/pdf/sheets/slides），不拆开每次同步都冲突。

**涉及文件与定位**：

- `../engine-sync/apps/slides/src/renderer/control.ts`：`export function initControlMode`，`rg "export function initControlMode" ../engine-sync/apps/slides/src/renderer/control.ts`，L139（hint；docs/html/markdown/pdf/sheets 同名文件同理）

**具体操作**：

1. 六个 app 的魔改 `control.ts` 改名 `dsh-control.ts`，更新全部 import（用 lsp rename_file）。
2. 各 `App.tsx` 中 controlRef/pendingReadyRef/applyControlReady/initControlMode effect 收成 `useDshControl` hook（放 dsh 侧文件），`App.tsx` 只留调用。
3. 零行为变更：不改任何控制协议字段。

**验证**：`npm --prefix ../engine-sync run typecheck` → exit 0；`node ../engine-sync/web/e2e-control-session.mjs --all --out docs/upstream-sync-v011/evidence/phase-2/rename-css` → 与 Phase 1 出口一致

**Evidence**：`evidence/phase-2/rename-css/`

**注意事项**：易错点 hook 依赖数组把 editor 放进去导致重复注册；禁止 改协议字段

### Task 7: 合并官方 v0.10.63 并迁移 slides 引用

- **关联**：BR-001 / INV-003 / INV-005（非用户可见任务，UF 写 NA：上游合并）
- **风险等级**：P0

**为什么做**：v0.10.63（e42da7c7）把 slides ops 迁到 `packages/pptx-ops`、page-spec 迁到 `packages/pipelines`；web-bridge 仍 import 旧路径。

**涉及文件与定位**：

- `../engine-sync/apps/slides/src/renderer/web-bridge.ts`：`script-map` import，`rg "main/ops/script-map" ../engine-sync/apps/slides/src/renderer/web-bridge.ts`，L93（hint）
- `../engine-sync/apps/slides/src/renderer/ai/slides-skill.ts`：`SCRATCH_GUARDED_OPS`，`rg "SCRATCH_GUARDED_OPS = " ../engine-sync/apps/slides/src/renderer/ai/slides-skill.ts`，L1450（hint）

**具体操作**：

1. `git -C ../engine-sync merge --no-ff v0.10.63`，rerere 已开启；逐个解决冲突，理由写入 evidence。
2. `web-bridge.ts`、`slides-skill.ts` 改从 `@genoffice/pptx-ops`、`@genoffice/pipelines` 引入；fork 的落页扩展并入 `packages/pipelines/src/slides/page-spec.ts`。
3. 按 `CLAUDE.md` 同步规则记录本轮编辑器工具变化（供 Task 14 核对）。

**验证**：`git -C ../engine-sync merge-base --is-ancestor v0.10.63 HEAD` → exit 0；`npm --prefix ../engine-sync run typecheck` → exit 0；`node ../engine-sync/web/e2e-official-sync.mjs --case land-pages --out docs/upstream-sync-v011/evidence/phase-2/land` → 通过

**Evidence**：`evidence/phase-2/merge-v0.10.63.md`、`evidence/phase-2/land/`

**注意事项**：易错点 自动合并后出现重复声明（本会话已发生过）；禁止 丢弃官方文件改动求快

### Task 8: 合并官方 v0.10.488 至 v0.11.0

- **关联**：BR-001 / INV-003 / INV-005（非用户可见任务，UF 写 NA：上游合并）
- **风险等级**：P0

**为什么做**：剩余 6 个 tag 各有 15-22 个冲突文件，逐 tag 合并便于定位回归。

**涉及文件与定位**：

- `../engine-sync/apps/pdf/src/shared/op-docs.ts`：`rotatePages:`，`rg "rotatePages:" ../engine-sync/apps/pdf/src/shared/op-docs.ts`，L138（hint；pdf op 签名，合并后复核）

**具体操作**：

1. 依次 `git -C ../engine-sync merge --no-ff v0.10.488`、`v0.10.639`、`v0.10.915`、`v0.10.1038`、`v0.10.1467`、`v0.11.0`；每轮解决冲突后跑 typecheck。
2. 每轮记录冲突文件、解决理由、编辑器工具变化。
3. 某轮超出 ASM-005（需要改官方核心算法）→ 停止并标阻塞报告。

**验证**：`git -C ../engine-sync merge-base --is-ancestor v0.11.0 HEAD` → exit 0；`npm --prefix ../engine-sync run typecheck` → exit 0

**Evidence**：`evidence/phase-2/merge-log.md`

**注意事项**：易错点 某轮只跑 typecheck 不跑 web:build 漏掉 Vite 入口断裂；禁止 跳过中间 tag

### Task 9: 合并官方 main 并构建 CLI

- **关联**：BR-001 / BR-005 / INV-003（非用户可见任务，UF 写 NA：上游合并与构建）
- **风险等级**：P1

**为什么做**：`324b0477` 在 v0.11.0 之后；Task 11 需要引擎自建的 `packages/cli`。

**涉及文件与定位**：

- `../engine-sync/web/capability-manifest.mjs`：`export function buildDiscovery`，`rg "export function buildDiscovery" ../engine-sync/web/capability-manifest.mjs`，L107（hint）

**具体操作**：

1. `git -C ../engine-sync fetch git@github.com:genspark-ai/genoffice.git main`（HTTPS 不可用，见 1.3）后合并 `upstream/main`。
2. `(cd ../engine-sync && npm ci && npm run build -w @genoffice/cli)`。
3. 删除只用于实测的 `../engine-upstream` worktree（`git -C ../engine worktree remove ../engine-upstream`）。

**验证**：`git -C ../engine-sync merge-base --is-ancestor upstream/main HEAD` → exit 0；`node ../engine-sync/packages/cli/dist/genoffice.cjs --version` → 输出版本；Phase 出口检查：`npm --prefix ../engine-sync run typecheck && npm --prefix ../engine-sync test && npm --prefix ../engine-sync run web:build && node ../engine-sync/web/e2e-official-sync.mjs --all --out docs/upstream-sync-v011/evidence/phase-2/ous` → 通过

**Evidence**：`evidence/phase-2/exit.log`、`evidence/phase-2/ous/`

**注意事项**：易错点 `npm ci` 改动 lockfile 未审阅；禁止 删除 `../engine` 主 worktree

### Phase 3: 插件兼容与 MCP

> 你在哪里：18 个旧工具 Unknown tool；`pptx_create` 依赖 fork 私有实现；工具定义手写。
> 做完之后：旧工具改写可用；`pptx_create` 走 MCP；评审脚本可运行。

### Task 10: 实现旧工具到 apply_ops 改写层

- **关联**：BR-002 / UF-002 / INV-001 / INV-002 / INV-005 / EVD-002
- **风险等级**：P0

**为什么做**：18 个已暴露工具在新引擎返回 `Unknown tool`；用户选择保留原名由插件内部改写。

**涉及文件与定位**：

- `packages/tab-genoffice/src/host/tools.ts`：`async function callRelay`，`rg "async function callRelay" packages/tab-genoffice/src/host/tools.ts`，L201（hint）
- `packages/tab-genoffice/src/host/tool-schema.ts`：`pptx_set_element_text` 条目，`rg "name: 'pptx_set_element_text'" packages/tab-genoffice/src/host/tool-schema.ts`，L615（hint）
- `packages/tab-genoffice/src/host/tool-schema.ts`：`pdf_rotate_page` 条目，`rg "name: 'pdf_rotate_page'" packages/tab-genoffice/src/host/tool-schema.ts`，L1551（hint）

**具体操作**：

1. 新增改写模块：每个旧工具一个函数，把插件参数转成编辑器 `apply_ops` 的 ops；slides 映射 `setText`/`setFont`/`setParagraphFormat`/`setTransform`/`setFill`/`setStroke`/`setPictureSrcRect`/`setPictureOpacity`/`duplicateSlide`/`deleteSlide`/`addElement`/`addSmartArt`/`setBackground`/`deleteElement`/`ungroupElement`；pdf 映射 `rotatePages`（`direction` right→90、left→-90）、`deletePage`、`setFormValue`。
2. 在 `callRelay` 前按工具名分派：旧工具发 `name: 'apply_ops'`，结果原样回给 agent。
3. `capability.ts` 更新这 18 条的 evidence 为"host 改写 → apply_ops <op>"；无法等效的参数（如 `add_slide.clearText`）实测后标 `partial` 并写明。
4. 单测覆盖每个映射的参数边界（页码、方向、缺省字段）。

**验证**：`npm run typecheck && npm test` → 通过；`node scripts/e2e-plugin-alignment.mjs --case legacy-rewrite --out docs/upstream-sync-v011/evidence/UF-002` → 18 个工具真实调用成功、撤销复原、磁盘 sha 不变

**Evidence**：`evidence/UF-002/`

**注意事项**：易错点 pdf 页码 1-based 与 op 的 `pageIndex`/`page` 混用；`add_text_box` 在空白 deck 上被 `SCRATCH_GUARDED_OPS` 拦截属预期；禁止 改写成 MCP 写盘

### Task 11: 接入内部 MCP 客户端实现新建 PPT

- **关联**：BR-005 / BR-007 / UF-003 / EVD-003
- **风险等级**：P1

**为什么做**：`pptx_create` 是唯一实测"无需桌面版、行为一致"的重叠功能（1.3），换成官方实现可删 fork 私有代码。

**涉及文件与定位**：

- `packages/tab-genoffice/src/host/tools.ts`：`pptx_create` 分支，`rg "entry.name === 'pptx_create'" packages/tab-genoffice/src/host/tools.ts`，L671（hint）
- `packages/tab-genoffice/src/tabs/doc-registry.ts`：`export function lookupActive`，`rg "export function lookupActive" packages/tab-genoffice/src/tabs/doc-registry.ts`，L19（hint）
- `packages/tab-genoffice/src/host/relay-launch.ts`：`export function isRelayLaunchConfigured`，`rg "export function isRelayLaunchConfigured" packages/tab-genoffice/src/host/relay-launch.ts`，L19（hint；子进程与根目录配置先例）

**具体操作**：

1. `packages/tab-genoffice` 加固定版本依赖 `@modelcontextprotocol/sdk@1.30.0`。
2. 新增 MCP 客户端模块：首次调用时用 `DSH_GENOFFICE_ROOT` 定位引擎，stdio 启动 `node <engine>/packages/cli/dist/genoffice.cjs mcp`；进程退出后下次调用重连；插件停用时关闭。
3. `pptx_create`：先查侧栏占用（BR-007，host 侧用 relay `/api/control/open` 的 `occupied` 判定），再调 `create_pptx {out, ops: []}`；`output_exists` 映射为"文件已存在"；连接失败给出构建命令。
4. 在 `standards/registry/permissions.md` 的 `x-nothing1024.process.spawn` 下补充该子进程用途。

**验证**：`npm run typecheck && npm test` → 通过；`node scripts/e2e-plugin-alignment.mjs --case mcp-create --out docs/upstream-sync-v011/evidence/UF-003` → 新建成功、重复拒绝、打开中拒绝、CLI 缺失时报错不写盘

**Evidence**：`evidence/UF-003/`

**注意事项**：易错点 占用判定只看插件前端内存（host 读不到）；禁止 用 `force: true`

### Task 12: 删除 relay 新建 PPT 私有实现

- **关联**：BR-005 / BR-001（非用户可见任务，UF 写 NA：删除被取代代码）
- **风险等级**：P2

**为什么做**：Task 11 之后 `/api/pptx/create`、`web/blank-pptx.mjs` 与 fork 对 `pptx-engine` 的 `blank-parts` 改动都无调用方，保留会继续制造同步冲突。

**涉及文件与定位**：

- `../engine-sync/web/server.mjs`：`/api/pptx/create` 路由，`rg "pathname === '/api/pptx/create'" ../engine-sync/web/server.mjs`，L1381（hint）
- `../engine-sync/web/blank-pptx.mjs`：`export function blankPptxBytes`，`rg "export function blankPptxBytes" ../engine-sync/web/blank-pptx.mjs`，L30（hint）

**具体操作**：

1. 删除路由、`import { blankPptxBytes }`、`web/blank-pptx.mjs` 与 `web/blank-pptx.d.mts`。
2. 把 `packages/pptx-engine/src/blank.ts`、`blank-parts.mjs`、`index.ts`、`tests/blank.test.ts` 恢复为官方版本（`git -C ../engine-sync diff upstream/main -- packages/pptx-engine` 为空）。
3. 更新 `contracts/relay-api.md` 删除该端点。

**验证**：`git -C ../engine-sync diff --stat upstream/main -- packages/pptx-engine` → 空；`npm --prefix ../engine-sync run typecheck` → exit 0

**Evidence**：`evidence/phase-3/remove-pptx-create.log`

**注意事项**：易错点 插件或 e2e 仍引用 `/api/pptx/create`（先 `rg "/api/pptx/create"` 两仓清零）

### Task 13: 让执行器上报工具定义

- **关联**：BR-006 / UF-005 / EVD-005（非用户可见入口在 UF-005 的 CLI）
- **风险等级**：P1

**为什么做**：ASM-006：sheets/pdf 工具定义在 Node 下无法 import，评审需要以浏览器执行器实际加载的定义为准。

**涉及文件与定位**：

- `../engine-sync/web/capability-manifest.mjs`：`export function buildDiscovery`，`rg "export function buildDiscovery" ../engine-sync/web/capability-manifest.mjs`，L107（hint）
- `../engine-sync/web/generate-capability-manifest.mjs`：`const PLUGIN` 绝对路径默认，`rg "^const PLUGIN = " ../engine-sync/web/generate-capability-manifest.mjs`，L12（hint）

**具体操作**：

1. 各 `dsh-control.ts` 注册时通过 `notify` 上报本 app 编辑器工具的 `name/description/inputSchema`（docs/sheets/pdf/markdown/html 取工具数组，slides 取 `createSlidesSkill(...).tools`）。
2. relay 新增只读接口按 app 返回最近一次上报（本机限定）。
3. `capability-manifest.json` 不再由插件 `tool-schema.ts` 反向生成；删除 `generate-capability-manifest.mjs` 或改为读上报快照。

**验证**：`npm --prefix ../engine-sync run typecheck` → exit 0；启动 relay 后打开六个 app，`curl -s http://127.0.0.1:18787/api/editor-tools` → 六个 app 均有工具列表（接口名以实现为准，写入 evidence）

**Evidence**：`evidence/UF-005/editor-tools.json`

**注意事项**：易错点 未就绪 app 返回空数组被误读为"无工具"；禁止 上报函数体或闭包

### Task 14: 编写同步评审脚本

- **关联**：BR-006 / UF-005 / INV-005 / EVD-005
- **风险等级**：P1

**为什么做**：落实 `CLAUDE.md` 同步规则：新增未登记不注册、删除与参数变化需评审。

**涉及文件与定位**：

- `packages/tab-genoffice/src/host/capability.ts`：`export const CAPABILITY`，`rg "export const CAPABILITY" packages/tab-genoffice/src/host/capability.ts`，L23（hint）
- `packages/tab-genoffice/src/host/tools.ts`：`function shouldRegister`，`rg "function shouldRegister" packages/tab-genoffice/src/host/tools.ts`，L105（hint）

**具体操作**：

1. 实现前按 ASM-003 向用户确认"参数变化时暂停注册还是照常注册并标红"。
2. 新增 `scripts/tool-review.mjs`：启动隔离 relay + Playwright 打开六个 app，拉取上报定义；对比 `CAPABILITY`（登记）、上次快照（参数指纹）；输出三类清单，有待评审项时非 0 退出。
3. 快照文件放插件仓（评审通过后更新）；首跑时把官方新增工具（docs 11、markdown 1、pdf 新工具）列为未登记。

**验证**：`node scripts/tool-review.mjs --out docs/upstream-sync-v011/evidence/UF-005` → 输出三类清单，未登记新增工具不在注册列表

**Evidence**：`evidence/UF-005/report.md`

**注意事项**：易错点 把"执行器未就绪"当成"工具被删除"；禁止 自动写 `CAPABILITY`

### Task 15: 补齐 e2e 用例并修正测试路径

- **关联**：BR-002 / BR-003 / BR-005 / BR-007 / UF-002 / UF-003 / UF-004 / EVD-002 / EVD-003 / EVD-004
- **风险等级**：P1

**为什么做**：18 个旧工具坏掉未被 e2e 发现；测试脚本默认写其他包 evidence 且有绝对路径。

**涉及文件与定位**：

- `scripts/e2e-plugin-alignment.mjs`：`const DEFAULT_PORT`，`rg "^const DEFAULT_PORT" scripts/e2e-plugin-alignment.mjs`，L34（hint）
- `../engine-sync/web/e2e-web-features.mjs`：`const PLUGIN` 绝对路径默认，`rg "^const PLUGIN = " ../engine-sync/web/e2e-web-features.mjs`，L21（hint）

**具体操作**：

1. `e2e-plugin-alignment.mjs` 新增 `legacy-rewrite`、`mcp-create`、`cross-origin` 三个 case 并纳入 `--all`（Task 10/11 已先行实现的用例在此归并）。
2. `e2e-web-features.mjs` 的 `PLUGIN_ROOT` 默认改为相对引擎目录的 `../plugin`；各 e2e 未传 `--out` 时写到临时目录，不写其他包 evidence。
3. `ENGINE_ROOT` 支持指向 `../engine-sync`。

**验证**：`ENGINE_ROOT=../engine-sync node scripts/e2e-plugin-alignment.mjs --all --out docs/upstream-sync-v011/evidence/phase-3/pta` → 全部通过；Phase 出口检查：`npm run typecheck && npm test && npm run build && npm run standard:check` → 通过，`git status --short docs/` 只含本包改动

**Evidence**：`evidence/phase-3/pta/`、`evidence/phase-3/exit.log`

**注意事项**：易错点 `--all` 未包含新 case；禁止 为通过删除旧 case

### Phase 4: 验收与收尾

> 你在哪里：各项已单独验证。
> 做完之后：5.2 全部通过，文档与契约更新，分支按用户决定收尾。

### Task 16: 更新契约文档与引擎说明

- **关联**：BR-002 / BR-005 / BR-006（非用户可见任务，UF 写 NA：文档）
- **风险等级**：P2

**为什么做**：工具表、relay 端点、DSH 版本都已变化。

**涉及文件与定位**：

- `contracts/control-api.md`、`contracts/relay-api.md`、`../engine-sync/DSH.md`、`README.md`（插件仓）

**具体操作**：

1. `contracts/`：删除 `/api/pptx/create`，补同源检查规则、执行器上报接口、旧工具改写说明。
2. `DSH.md`：DSH 版本改 0.2.0-rc.1、写明同步流程指向 `CLAUDE.md`。`DSH.md`、`web/README.md` 本来就是中文，`check-english-comments` 已报违规（1.3），保持原语言，不新增其他中文文件。
3. 插件 `README.md` 如提到 relay 新建 PPT 同步更新。

**验证**：`rg -n "/api/pptx/create" contracts README.md ../engine-sync/web ../engine-sync/DSH.md` → 无结果；`node ../engine-sync/tools/check-english-comments.mjs` → 违规条数不高于 Phase 0 基线，且没有新文件出现在列表中

**Evidence**：`evidence/phase-4/docs.log`

**注意事项**：易错点 在引擎仓英文文档里写中文

### Task 17: 执行 spec 5.2 真实场景全套测试

- **关联**：UF-001 / UF-002 / UF-003 / UF-004 / UF-005 / EVD-001 / EVD-002 / EVD-003 / EVD-004 / EVD-005
- **风险等级**：P0

**为什么做**：完成的唯一标准。

**涉及文件与定位**：

- 见 5.2 执行矩阵。

**具体操作**：

1. 按 5.2 环境准备启动；切换 :8787 前征得用户同意停止当前 `../engine` 的 relay。
2. 执行矩阵逐行回放，evidence 写到矩阵指定路径。
3. 任一行失败 → 回到对应任务修复后重跑该行。

**验证**：按 5.2 执行矩阵逐行回放 → 全部通过

**Evidence**：`evidence/UF-001/`、`evidence/UF-002/`、`evidence/UF-003/`、`evidence/UF-004/`、`evidence/UF-005/`

**注意事项**：易错点 用单测代替真实回放；禁止 在用户未同意时停止其 relay 进程

### Task 18: 执行最终回归验证

- **关联**：BR-001 ~ BR-008 / INV-001 ~ INV-006
- **风险等级**：P1

**为什么做**：收尾闸门，并按 ASM-004 处理分支。

**涉及文件与定位**：

- 无新增改动。

**具体操作**：

1. 跑 5.1 全部命令。
2. 核对 INV-003（upstream push 仍禁用）、INV-006（`../engine` 状态未变）。
3. 向用户确认 ASM-004 后：`git -C ../engine merge --ff-only sync/consolidate-fork`，再 `git -C ../engine push origin main`；不新建远端分支。

**验证**：5.1 全部行 → 通过；`python3 $SPEC_SKILL/scripts/validate_package.py docs/upstream-sync-v011` → 0 FAIL

**Evidence**：`evidence/final/regression.log`

**注意事项**：禁止 未经同意 force push 或改 main 跟踪

---

## 5. 验收与 Review 协议

> **验收铁律：命令级验证（5.1）通过只是入场券，不是完成。**

### 5.1 命令级验证（入场券）

| 验证项 | 命令 | 期望 | Evidence |
|---|---|---|---|
| 引擎 typecheck | `npm --prefix ../engine-sync run typecheck` | exit 0 | EVD-001 |
| 引擎单测 | `npm --prefix ../engine-sync test` | 通过数不低于 Phase 0 基线 | EVD-001 |
| 引擎 web 构建 | `npm --prefix ../engine-sync run web:build` | 7 个 app 均 built | EVD-001 |
| relay 回归 | `node --test ../engine-sync/web/*.test.mjs` | 全部通过（含同源检查用例） | EVD-004 |
| CLI 构建 | `(cd ../engine-sync && npm run build -w @genoffice/cli)` | 生成 `packages/cli/dist/genoffice.cjs` | EVD-003 |
| 插件 typecheck/test/build | `npm run typecheck && npm test && npm run build` | 通过 | EVD-002 |
| 插件标准检查 | `npm run standard:check` | 通过 | EVD-002 |

### 5.2 真实场景全套测试（Real-Run，完成的唯一标准）

**环境准备**：

| 项 | 值 |
|---|---|
| 启动命令 | 隔离回放：e2e 脚本自行 `PORT=18787 node ../engine-sync/web/server.mjs`（端口占用时脚本自选空闲端口）；侧栏回放：经用户同意停止 `../engine` 的 relay（`lsof -ti tcp:8787 -sTCP:LISTEN`）后 `node ../engine-sync/web/server.mjs`，再 `sh env/boot.sh` |
| 访问入口 | 隔离：`http://127.0.0.1:18787/`（`/docs/`、`/sheets/`、`/slides/`、`/pdf/`、`/markdown/`、`/html/`）；侧栏：`http://127.0.0.1:3082` 右侧 GenOffice 页签 |
| 测试账号/数据 | 无账号；fixture 用 `../engine-sync/fixtures/generated/{simple.docx,sample.pptx,simple.pdf}` 与 `../engine-sync/apps/sheets/fixtures/generated/*.xlsx`（后者需从 `../engine` 复制，已 gitignore） |
| 干净状态定义 | fixture 复制到临时目录后操作；每行结束删除临时目录 |
| 可用测试工具 | Playwright 1.62.1（`../engine-sync/node_modules`）、curl、DSH 实例浏览器截图 |

**执行矩阵**：

| UF | 执行方式 | 操作来源 | 必须核对的点 | Evidence |
|---|---|---|---|---|
| UF-001 主路径（侧栏） | browser | 2.3 UF-001 成功主路径，在 :3082 侧栏打开 docx，agent 插入内容，点"写入磁盘"，重载 | 编辑即时可见、未保存标记出现后消失、重载后内容在；console 无新增 error | `evidence/UF-001/sidebar-success.png` |
| UF-001 主路径（五族） | e2e | `node ../engine-sync/web/e2e-official-sync.mjs --case five-family` | 五族编辑→保存→重开一致；保存前磁盘 sha 不变 | `evidence/UF-001/five-family.log` |
| UF-001 外部改盘冲突 | e2e | `node ../engine-sync/web/e2e-control-session.mjs --case file-conflict` | 保存返回 conflict，磁盘为外部版本 | `evidence/UF-001/file-conflict.log` |
| UF-001 旧 revision | e2e | `node ../engine-sync/web/e2e-control-session.mjs --case revision` | 过期 expectedRevision 返回 conflict 与当前 revision | `evidence/UF-001/revision.log` |
| UF-001 relay 不可用 | browser | 侧栏打开文件时停止 relay | 侧栏显示 relay 不可用与"启动 relay"，点击后恢复 | `evidence/UF-001/relay-down.png` |
| UF-002 主路径 | e2e | `node scripts/e2e-plugin-alignment.mjs --case legacy-rewrite` | 18 个旧工具全部成功、撤销复原、磁盘 sha 不变 | `evidence/UF-002/legacy-rewrite.log` |
| UF-002 参数非法 | e2e | 同上 case 的非法 sourceId / 越界页码子用例 | 返回编辑器错误原文，文档不变 | `evidence/UF-002/invalid-args.log` |
| UF-002 空白 deck 拦截 | e2e | 同上 case 在空白 deck 调 `pptx_add_text_box` | 返回拦截原因 | `evidence/UF-002/scratch-guard.log` |
| UF-003 主路径 | e2e | `node scripts/e2e-plugin-alignment.mjs --case mcp-create` | 生成 1 页 13.33×7.5in，可打开编辑 | `evidence/UF-003/create.log` |
| UF-003 目标已存在 | e2e | 同上 case 第二次调用 | 返回"文件已存在"，磁盘 sha 不变 | `evidence/UF-003/exists.log` |
| UF-003 文件正在侧栏打开 | e2e | 同上 case 先 open 再 create 同路径 | 调用 MCP 前被拒绝 | `evidence/UF-003/occupied.log` |
| UF-003 MCP 不可用 | e2e | 同上 case 指向缺失 CLI 的引擎根 | 报 MCP 不可用及构建命令，不写盘 | `evidence/UF-003/mcp-missing.log` |
| UF-004 主路径 | curl | `node scripts/e2e-plugin-alignment.mjs --case cross-origin`：跨站 `text/plain` 改写与新建 | 403，磁盘不变；本机侧栏请求 200 | `evidence/UF-004/cross-origin.log` |
| UF-004 JSON 伪造 | curl | 跨站 Origin + `application/json` POST `/api/file` | 403 | `evidence/UF-004/json-forged.log` |
| UF-004 原始字节接口 | curl | 跨站 Origin POST `/api/inject` | 403；本机 `web/open.mjs` 注入仍成功 | `evidence/UF-004/inject.log` |
| UF-005 主路径 | CLI | `node scripts/tool-review.mjs` | 三类清单；未登记新工具未注册 | `evidence/UF-005/report.md` |
| UF-005 relay 未启动 | CLI | relay 端口不可达时运行 | 非 0 退出并给出启动命令 | `evidence/UF-005/relay-down.log` |
| UF-005 执行器未就绪 | CLI | 删除某 app `web-dist` 后运行 | 该 app 标"未获取"，非 0 退出 | `evidence/UF-005/not-ready.log` |

**通过标准**：执行矩阵全部行通过且 evidence 齐全。任何一行失败 = 本需求未完成。

### 5.3 Evidence 目录结构与命名

```text
evidence/
  phase-0/   decisions.md、baseline.log、exit.log
  phase-1/   conflict/、five/、sheets-media/、exit.log
  phase-2/   merge-*.md、land/、ous/、exit.log
  phase-3/   remove-pptx-create.log、pta/、exit.log
  phase-4/   docs.log
  UF-001/ … UF-005/
  final/     regression.log
```

- EVD ID 见第 2.5 节。

### 5.4 Review 专项检查清单

- [ ] `git -C ../engine-sync merge-base --is-ancestor upstream/main HEAD` 为真，且 fork 自有改动只在 dsh 侧文件与一行 hook
- [ ] 18 个旧工具改写与 op 签名一一对应，`capability.ts` evidence 已更新，无法等效的参数标 partial
- [ ] 跨站写全部 403，侧栏与编辑器自身请求无误伤
- [ ] `/api/pptx/create`、`blank-pptx.mjs` 已删除，`packages/pptx-engine` 与官方一致
- [ ] 评审脚本不会自动登记工具
- [ ] 5.2 执行矩阵全部通过，evidence 齐全且与第 2.5 节 EVD 清单一致
- [ ] 2.3 节每条流程的「入口接线清单」已实现并从真实入口可达
- [ ] 所有 BR/UF/INV 状态可对照第 2 章逐条核销
