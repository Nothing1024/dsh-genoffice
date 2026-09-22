# official-upstream-sync Spec

> Version: 0.3.0 | Date: 2026-09-12 | Status: Ready 可执行（仅规格，尚未实施）
>
> 运行模式：oneclick；本轮只生成与校验。唯一事实源；未来合并与实现任务均待开始。

## 0. 一页纸人话摘要

- 给维护魔改 GenOffice 和使用 DSH 插件的用户，在浏览器中吸收官方的新编辑能力与可靠性修复。
- 把官方固定版本完整合并到隔离分支，逐个解决冲突，并保留魔改的五类文档控制入口。
- 同步评论、页眉页脚等编辑工具需要的数据，让已有插件参数和编辑器执行逻辑继续对应。
- 保留前置包修好的文档状态保护、页面生成和原子保存；控制模式仍默认由用户或 agent 显式保存。
- 完成标准是五类真实文件能打开、读取、编辑、保存并重新打开，新增工具由真实浏览器执行，且不依赖 Electron。
- 官方新增 HTML 编辑器、OCR 等完整 Web 产品能力交由后续能力补齐包；本包不以编译通过代替这些能力的可用性验收。

## 1. 事实基线与假设

### 1.1 需求与运行模式

| 项 | 结论 |
|---|---|
| 原始需求 | 用户要求魔改上游同步官方，改善其他 agent 使用与完整 Web 支持；最新范围为本轮只生成多套 oneclick 包并运行包校验，业务实现留待未来执行 |
| 输入类型 | 当前对话研究结论及本地两仓源码 |
| Mode | oneclick；本轮只生成完整任务规格与校验 |
| 置信度 | 高；合并对象与两仓位置均已通过命令核实 |
| 输出目录 | `docs/official-upstream-sync/`，位于插件仓 |
| 上游术语 | 未注明官方时均指 `../engine` 魔改仓；官方固定对象为 `de139a061537bea40f0cc81ef8f09a95f77ac52a` |
| 前置包 | `../control-session-safety/spec.md` 与 `../plugin-tool-alignment/spec.md`，由母包核对其完成证据后才能执行本包合并 |
| 缺失信息 | ASM-001：前置包本轮仅生成校验；未来实际合并起点必须包含前置包完成并验收后的修复 |
| 下一步 | 本轮完成任务规格与定位/结构校验；后续执行先过跨包前置闸门 |

### 1.2 任务类型路由

| 维度 | 结论 |
|---|---|
| 任务类型 | infra + refactor + backend + frontend + bugfix |
| 主要风险 | 官方与魔改保存路径和工具上下文漂移；手工移植的共享算法不会被 Git 自动同步；浏览器误引入 Node transport |
| 行号引用策略 | 行号仅 hint；按 symbol 与 rg anchor 重定位 |
| 必需验收方式 | Git ancestry/冲突清单、typecheck、workspace tests、五族 Web build、真实浏览器与 relay API 往返 |
| 必须覆盖用户场景 | 五族显式保存闭环；Docs 新工具上下文；魔改 Slides page-spec 落页；Web 启动不加载 Node 专用 transport |

### 1.3 勘察事实清单

以下命令除特别标明外均在 `../engine` 执行；插件仓和 engine 仓是两个独立 Git 仓库。

| 事实 | 来源命令 | 输出摘要 |
|---|---|---|
| 魔改分支与 HEAD | `git branch --show-current`；`git rev-parse HEAD`；`git status --short` | `fork/eat-official-engine`；`247e3f5c488afb25915e9ee97fe0fd22e27648da`；工作树无输出 |
| 固定官方对象和共同基线 | `git show --stat --oneline de139a061537bea40f0cc81ef8f09a95f77ac52a`；`git merge-base HEAD de139a061537bea40f0cc81ef8f09a95f77ac52a` | 官方对象存在，标题为增加 Requesty provider；base=`f68df70e222d47aa08211f9a2d7748c610d1d6aa` |
| 双方独有提交数 | `git rev-list --left-right --count HEAD...de139a061537bea40f0cc81ef8f09a95f77ac52a` | 魔改 37、官方 98；该数仅是本次勘察基线 |
| 合并预演 | `git merge-tree --write-tree HEAD de139a061537bea40f0cc81ef8f09a95f77ac52a` | exit 1，16 个冲突文件；只生成 Git 临时树对象，未进入工作区 merge 状态 |
| 文档说明存在陈旧能力描述 | `cat README.md web/README.md package.json` | 顶层 README 描述五族控制；web/README 仍写三族待 Web 化；真实能力必须以代码与运行结果判断 |
| 六个现有 app 均有 Web 构建命令 | `rg -n 'web:build' apps/docs/package.json apps/markdown/package.json apps/sheets/package.json apps/slides/package.json apps/pdf/package.json apps/shell/package.json` | 每个 app 的 `web:build` 均为 Vite Web 配置构建；根 `npm run web` 只串 shell/docs/markdown |
| Docs 控制器缺少官方新增工具上下文 | `rg -n 'executeTool' apps/docs/src/renderer/control.ts`；`git show de139a061537bea40f0cc81ef8f09a95f77ac52a:apps/docs/src/renderer/ai/tools.ts` | 本地只传 editor/call/numIds；官方还接收 track、signal、frozen、comments、hf；read_comments 无 comments access 时返回不可用 |
| 原生文档上下文与 relay 上下文是两条入口 | `rg -n 'markDocSeen' apps/docs/src/renderer/ai/tools.ts`；`rg -n 'buildDocumentContext' apps/docs/src/renderer/control.ts`；`git show de139a061537bea40f0cc81ef8f09a95f77ac52a:apps/docs/src/renderer/ai/docs-skill.ts` | 官方原生 buildContext 调 markDocSeen；本地 relay/context 直接 buildDocumentContext。DSH 经 get_document_context 工具已有 executeTool settle，不应误判成同一缺陷 |
| 官方已有浏览器设置入口但不含流式调用 | `git show de139a061537bea40f0cc81ef8f09a95f77ac52a:packages/ai-provider/package.json`；`git show de139a061537bea40f0cc81ef8f09a95f77ac52a:packages/ai-provider/src/browser.ts`；`sed -n '1,35p' apps/docs/src/renderer/web-bridge.ts` | 官方导出 ./browser 与 ./codex-app-server；browser 只提供设置元数据，Web bridge 仍从根导入 chatForProvider/streamForProvider，不能仅替换成 ./browser |
| 魔改共享落页算法有双入口 | `rg -n 'parsePageSpec' apps/slides/src/renderer/ai/slides-skill.ts apps/slides/src/renderer/web-bridge.ts apps/slides/src/shared/page-spec.ts` | renderer 与 Web bridge 复用 shared/page-spec；官方冲突涉及 main/page-spec，需语义迁移到共享模块 |
| 写盘与 relay 路由可定位 | `rg -n 'writeFileAtomic' web/server.mjs web/write-atomic.mjs`；`rg -n 'control/open' web/server.mjs` | writeFileAtomic 位于 web/write-atomic.mjs，relay export 与 /api/file 使用；控制 open 位于 server L703 |
| 可用测试环境 | `node -e "for (const p of ['@playwright/test','playwright','playwright-core']) console.log(p,import.meta.resolve(p)); console.log(process.version)"`；`command -v node`；`node --version`；`printf '%s\\n' "$SHELL"` | 本 subagent 的 exec_command（login=true，cwd=engine）输出 `/usr/local/bin/node`、`v26.8.2`、`/bin/zsh`；三个浏览器驱动包可解析。统筹者此前在另一命令上下文观测 v22.23.2，因此实际执行时重新记录 Node 路径/版本，不把当前 PATH 观测当项目固定版本 |
| 现有 UI 脚本不能单独证明真实写盘 | `sed -n '1,65p' web/e2e-open-save.mjs` | 文件选择器与写句柄被内存 stub 替换；可做 UI 回归，最终验收必须补真实 relay path 文件写盘和重开 |
| 插件验证命令 | 在插件仓执行 `cat package.json` | `npm test`、`npm run typecheck`、`npm run standard:check`、`npm run smoke` 均有已声明脚本 |

合并预演冲突文件：`.gitignore`、`README.md`、`apps/docs/src/renderer/App.tsx`、`apps/markdown/src/renderer/App.tsx`、`apps/markdown/src/renderer/ai/markdown-skill.ts`、`apps/markdown/src/renderer/components/Ribbon.tsx`、`apps/pdf/src/renderer/App.tsx`、`apps/sheets/src/renderer/App.tsx`、`apps/sheets/src/renderer/ExcelShell.tsx`、`apps/sheets/src/renderer/edit-journal.ts`、`apps/sheets/src/renderer/save-actions.ts`、`apps/slides/src/main/page-spec.ts`、`apps/slides/src/renderer/ai/AiPanel.tsx`、`apps/slides/src/renderer/ai/slides-skill.ts`、`apps/slides/tests/page-spec.test.ts`、`apps/slides/tests/scratch-block.test.ts`。

### 1.4 假设清单

| 假设 ID | 内容 | 风险 | 确认方式 |
|---|---|---|---|
| ASM-001 | 本包执行基点是前置安全包和插件契约包验收后的魔改 HEAD，而非固定停留在 247e3f5 | 合并覆盖前置修复、冲突数量变化 | P0 记录实际 HEAD、前置 evidence、完整改动清单并再次预演 |
| ASM-002 | 本包可在隔离分支完成固定官方完整 merge，后续由统筹者决定落入当前开发分支的方式 | 当前用户未要求发布或 push；不能移动用户工作区丢失改动 | P0 记录两仓 status 与隔离工作区路径，保证原工作区及未提交改动不变 |

### 1.5 已确认决策 / 变更记录

| 日期 | 来源与决定 | 影响 |
|---|---|---|
| 2026-09-12 | 用户明确：只生成任务包并运行校验 | 本轮业务实现和真实应用验收均不执行，状态全部待开始。 |
| 2026-09-12 | 响应用户对 master 连续执行和 CSV 完整性的要求 | 增量升级现母包；六包均使用 tasks.csv，原任务编号/依赖/状态保留，本轮统一 CSV 的选择覆盖 skill 的小包内嵌表默认规则。 |
| 2026-09-12 | 规划审查：状态安全→插件契合→官方同步→Web 补齐→效率，源码按依赖串行 | 调整跨包边界，禁止把 no-replay 视为幂等或把参数镜像视为版本化单源；任务保持待开始。 |
| 2026-09-12 | oneclick 阶段提交遇到 Git 作者身份缺失 | 保留生成文件，未改 Git 身份配置，未提交用户既有改动。 |

## 2. 业务合同

### 2.1 BR 业务规则

<a id="BR-001"></a>

| 规则 ID | 规则 | 正例 | 反例 | 影响范围 | 验证方式 |
|---|---|---|---|---|---|
| BR-001 | 合并结果包含固定官方完整历史，并保留执行前魔改基点与前置包修复 | 官方 SHA 和实际魔改起点均为结果 ancestor | 仅 cherry-pick 少量功能却称完整同步；覆盖前置修复 | engine 隔离分支 | Git ancestry 与前置回归 |
| BR-002 | 既有 docx/md/xlsx/pptx/pdf Web 控制入口在合并后完成真实文件 open→context→edit→save→reopen | 五族可回读编辑内容且磁盘仅显式 save 后变化 | 仅 Vite build 成功；工具成功但重开丢内容 | 五族 renderer、bridge、relay、插件 | UF-001 |
| BR-003 | 官方新增 Docs 工具获得 App 持有的评论、页眉页脚、修订等必要上下文，读取状态和写入基线语义一致 | relay 上下文读取后正常编辑；评论回复保存重开可见 | 工具注册成功却返回 comments unavailable；把 DSH get_document_context 误当缺 markDocSeen | Docs 控制适配器与工具执行器 | UF-002 |
| BR-004 | 浏览器产物不依赖 Node/Electron 执行本包既有编辑能力，普通 Web 模型 transport 保持可执行接口 | Web 可启动编辑；provider settings 与运行 transport 边界明确 | 根 import 间接拉入 node:child_process；将缺失流式函数当作可替换入口 | ai-provider 和五族 Web bridge | UF-001 与浏览器构建/启动证据 |
| BR-005 | 官方算法修复迁入魔改共享模块，同时保留 page-spec 与 land_pages 的现有输入和落页语义 | shared/page-spec 同时供 desktop/Web 消费且落页成功 | 只解决 main/page-spec 文本冲突，共享副本仍旧算法 | Slides 共享算法和工具 | UF-003 |
| BR-006 | 同步报告明确列出新增官方功能在 Web 的实现边界，不把 HTML/OCR 等编译成功登记为产品可用 | 核心包与既有五族验收通过，HTML/OCR 交接后续包独立验收 | 合并完直接宣称 Web 全功能支持 | 跨包能力清单 | EVD-004 |

### 2.2 UF 用户验收场景（索引）

| 场景 ID | Given | When | Then | 角色 | 验证方式 | Evidence |
|---|---|---|---|---|---|---|
| UF-001 | 五族各一个真实临时文件且隔离 relay 就绪 | agent 打开、读上下文、编辑并显式保存后重开 | 页面与磁盘一致，失败与冲突可恢复且原文件受保护 | agent/浏览器用户 | browser + real API + 文件回读 | EVD-001 |
| UF-002 | 含评论、页眉页脚和修订的真实 docx 已打开 | agent 读取上下文并调用对应官方工具 | 返回真实内容；成功写入保存后保留；无效对象给出可恢复错误 | agent | browser + real API + 文件重开 | EVD-002 |
| UF-003 | 控制模式 Slides 已打开真实 pptx | agent 通过 land_pages 追加页面再保存重开 | 页面正确落入且保留原页，非法输入和旧状态无部分写入 | agent | browser + real API + 文件重开 | EVD-003 |

### 2.3 核心业务流程（步骤级交互脚本）

#### UF-001: 五族控制保存闭环

**前置状态**：隔离 relay 绑定 loopback，临时测试目录保存五种真实文件；以 path 控制 URL 打开，使用前置安全包的当前协议。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | agent 从控制 open 入口请求文件，浏览器进入返回的编辑器 | 显示加载中，尚未 ready 时不可编辑保存 | 实际读取与解析文件，确认执行器及文档状态 | 对应编辑器展示原内容 |
| 2 | agent 读当前上下文后发出一次合法编辑 | 页面显示更改与未保存状态 | 当前文档执行工具并返回真实结果，磁盘不提前改变 | agent 和用户看到同一内容 |
| 3 | agent 显式 save，再关闭并重开 | 保存完成后 dirty 状态对应被持久化版本 | 原子写盘，重新读取文件 | 新内容保留且未改内容完整 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 打开失败 | 临时文件无效或解析失败 | 明确显示失败，禁用写回 | 返回加载错误，不创建空白覆盖原文件 | 使用有效文件重新 open |
| 保存冲突 | 打开后从外部修改磁盘文件 | 保留编辑与未保存提示 | 返回前置安全协议定义的冲突，外部内容不被覆盖 | 重读并重新应用所需编辑 |
| 再次编辑 | 保存进行中用户追加编辑 | 保存后仍显示未保存的新内容 | 保存确认只确认导出版本 | 再显式保存 |

**界面状态机**：`closed → loading → ready → dirty → saving → ready`；加载失败进入 `error`；保存冲突进入 `dirty/conflict`；保存中再次编辑回到 `dirty`。

**入口接线清单**：`POST /api/control/open` → `/docs/`、`/markdown/`、`/sheets/`、`/slides/`、`/pdf/` 的 `?control=1&open=path:...` → 各 app control adapter → relay 的 context/tool/export → 插件已对齐的五族 open/save 工具。

#### UF-002: Docs 新工具上下文与持久化

**前置状态**：临时 docx 包含已有评论线程、页眉页脚及修订；App 已完成加载。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | agent 请求 relay/context 并读工具上下文 | 页面保持当前文档 | 获取同一 App 的评论/页眉页脚状态并建立当前读取基线 | 返回实际文档内容与对象标识 |
| 2 | agent 读评论、回复有效线程并编辑页眉页脚 | 评论和页眉页脚区域反映变化，dirty 对应持久化内容 | 复用 App 的执行访问器与 dirty/save 管线 | 正确线程和目标区域被修改 |
| 3 | 显式保存并重开 | 保存与重新加载反馈完整 | 写盘并再次解析 | 评论回复和页眉页脚仍存在；修订信息不丢失 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 评论消失 | 获取评论后另一编辑删除该线程或锚点 | 保留当前文档，无虚假成功 | 返回对象不存在，禁止添加到错误线程 | read_comments 后重新定位 |
| 读取后外部编辑 | 用户改变被索引的文档块，再发旧索引写入 | 用户编辑保留 | 前置 revision 保护与原生 freshness 检查协同拒绝旧写入 | 新 context 后重试合法操作 |

**界面状态机**：`ready → context-read → editing → dirty → saving → ready`；过期/无效对象进入 `recoverable-error → context-read`。

**入口接线清单**：Docs App 的评论/页眉页脚访问器 → `initControlMode` options → `executeTool`；relay `context` 路径与插件 `get_document_context` 工具分别回放，不能只测试其一。

#### UF-003: 保留共享算法的页面落地

**前置状态**：含一张原始页面的真实 pptx 在 Web 控制模式 ready；请求使用现有 page-spec 模型。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | agent 读取已有页面后提交一个合法 land_pages 追加请求 | 显示执行进度并保留原页 | 共享 parsePageSpec/buildPagePptx 与原有事务路径落页 | 新页面出现且原页不变 |
| 2 | agent 显式保存并重开 | 完成保存，重新加载全部页面 | 写入真实 pptx 后解析回读 | 页面数和文字/布局对应提交内容 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 非法规格 | 提交不能解析的 page-spec | 原页面不变，返回参数错误 | 校验失败，不追加部分页面 | 修正输入再提交 |
| 旧请求/丢回执 | 落页已执行但回执丢失，或提交过期 revision | 不重复追加，保留已成功页面 | 旧版请求拒绝；未知结果先读确认，不自动重放，不假定服务端已有重复 call ID 去重 | 读取最新上下文确认结果 |

**界面状态机**：`ready → landing → dirty → saving → ready`；参数/状态失败进入 `ready/error` 且页面保持原样。

**入口接线清单**：插件 `pptx_land_pages` → relay tool → Slides skill 的 `land_pages` → shared/page-spec 与 Web bridge → 原有落页事务 → 显式 export。

### 2.4 INV 不变量

| 不变量 ID | 内容 | 关联 BR/UF | 验证方式 |
|---|---|---|---|
| INV-001 | 不修改用户未提交改动，不在原工作区直接进行有冲突 merge；不 push/publish | BR-001 | 前后 Git status、原文件 diff 与隔离路径记录 |
| INV-002 | 控制模式默认仍显式保存，非控制模式已有默认行为保持 | BR-002、UF-001 | 自动保存等待窗口前后磁盘 hash；普通模式回归 |
| INV-003 | 前置 safety/alignment 修复及返回协议在官方同步后仍满足各自合同 | BR-001、BR-002、BR-003、BR-005 | 重跑前置包相关 validators 与跨包真实场景 |
| INV-004 | relay loopback、文件路径权限、原子写盘与冲突拒绝保持 | BR-002、UF-001 | 真实 API 负向与文件字节校验 |
| INV-005 | 不为通过构建删除官方核心更新、跳过冲突或注册不可执行工具 | BR-001、BR-003、BR-004、BR-006 | ancestry、冲突语义 review、工具调用证据 |

### 2.5 EVD 证据清单

| 证据 ID | 类型 | 期望证据 | 保存位置 |
|---|---|---|---|
| EVD-001 | browser/api/file | 五族各自成功、加载失败、保存冲突和保存中新编辑的请求响应、截图、console/network、磁盘校验 | `evidence/UF-001/` |
| EVD-002 | browser/api/file | Docs 评论/页眉页脚/修订及两条 context 入口真实回放 | `evidence/UF-002/` |
| EVD-003 | browser/api/file | 合法/非法/重复落页的页面截图、响应和重开结果 | `evidence/UF-003/` |
| EVD-004 | log/json | 固定 SHA、实际起点、冲突处理表、测试与构建输出、Web 能力交接边界 | `evidence/phase-0/`、`evidence/phase-1/`、`evidence/phase-2/` |

### 2.6 角色与权限矩阵

本包不新增账号或角色体系，复用本机用户与 agent 的现有 relay 权限；远端/越权请求不得因同步获得文件权限。

### 2.7 负向 / 破坏性场景

- 合并前后实际 SHA 与前置包状态变化必须重算影响，禁止按过期 16 文件清单机械覆盖。
- 新 HTML/OCR app 或包进入 workspaces 不代表 Web 功能可达；未验收项传递到 `../web-feature-completion/spec.md`。
- 原生 `markDocSeen` 是单编辑器 freshness 辅助，不能替代跨 agent revision；两个 context 入口分别验证。

### 2.8 非目标

- 本包不发布、push 或覆盖当前用户开发分支，不删除历史能力以缩短合并工作量。
- 新增 HTML/OCR、PDF 转换导出、Sheets 解析完整性等完整 Web 交互由后续能力补齐包负责；本包负责同步后的核心可编译可运行边界与已有五族回归。

## 3. 技术方案

### 3.1 架构 Before / After

```text
Before: 247e3f5 魔改五族 Web/relay + f68df70 官方基线
After:  前置安全与契约修复 + 固定官方 de139a0 完整历史
        → 冲突语义合并 → Docs 控制上下文适配 → 浏览器 transport 边界
        → 共享落页算法修复 → 五族真实回放 → Web 能力补齐包
```

### 3.2 模块改造

在隔离工作区完整合并固定官方历史；App 保持唯一评论/页眉页脚/修订状态，control 传访问器；provider settings 与浏览器运行 transport 分层，Node 专用 transport 留服务边界；shared/page-spec 是魔改落页算法单源。同步后五族与插件重新执行前置回归。

### 3.3 三段式定位清单

命令以插件仓为 `--repo`；`../engine` 为实际兄弟仓路径。行号仅 hint，执行前重跑 rg；所有行均来自本次源代码读取。

| 文件 | 稳定定位 | 搜索定位 | 行号 hint | 备注 |
|---|---|---|---|---|
| `../engine/apps/docs/src/renderer/control.ts` | `initControlMode` | `rg "initControlMode" ../engine/apps/docs/src/renderer/control.ts` | L97 | 接入官方新增执行上下文 |
| `../engine/apps/docs/src/renderer/App.tsx` | `initControlMode` 调用 | `rg "initControlMode" ../engine/apps/docs/src/renderer/App.tsx` | L1371 | App store 与控制器接线 |
| `../engine/apps/docs/src/renderer/ai/tools.ts` | `executeTool`、`markDocSeen` | `rg "markDocSeen" ../engine/apps/docs/src/renderer/ai/tools.ts` | L264 | 官方新签名用 git show 对照 |
| `../engine/apps/docs/src/renderer/web-bridge.ts` | ai-provider import | `rg "chatForProvider" ../engine/apps/docs/src/renderer/web-bridge.ts` | L17 | 浏览器运行 transport 导入边界 |
| `../engine/packages/ai-provider/package.json` | `exports` | `rg "exports" ../engine/packages/ai-provider/package.json` | L8 | 合并后已有 ./browser 与 ./codex-app-server |
| `../engine/apps/slides/src/shared/page-spec.ts` | `parsePageSpec`、`buildPagePptx` | `rg "buildPagePptx" ../engine/apps/slides/src/shared/page-spec.ts` | L352 | 同步官方 main/page-spec 的算法变化 |
| `../engine/apps/slides/src/renderer/ai/slides-skill.ts` | `land_pages` | `rg "land_pages" ../engine/apps/slides/src/renderer/ai/slides-skill.ts` | L857 | 保留魔改工具及输入语义 |
| `../engine/apps/slides/src/renderer/web-bridge.ts` | `parsePageSpec` import | `rg "parsePageSpec" ../engine/apps/slides/src/renderer/web-bridge.ts` | L137 | 共享算法 Web 消费端 |
| `../engine/apps/sheets/src/renderer/save-actions.ts` | `buildSavePayload` | `rg "buildSavePayload" ../engine/apps/sheets/src/renderer/save-actions.ts` | L81 | 处理官方保存字段变化与魔改语义 |
| `../engine/apps/sheets/src/renderer/edit-journal.ts` | `createEditJournal` | `rg "createEditJournal" ../engine/apps/sheets/src/renderer/edit-journal.ts` | L246 | 保留魔改 journal 变化 |
| `../engine/web/server.mjs` | `findStaticRoots` | `rg "findStaticRoots" ../engine/web/server.mjs` | L186 | 全部 app Web 产物与控制路由 |
| `../engine/web/write-atomic.mjs` | `writeFileAtomic` | `rg "writeFileAtomic" ../engine/web/write-atomic.mjs` | L47 | 前置安全包修复不可丢失 |

| `packages/tab-genoffice/src/host/tool-schema.ts` | CONTROL_TOOL_TABLE | `rg "export const CONTROL_TOOL_TABLE" packages/tab-genoffice/src/host/tool-schema.ts` | L72 | 同步后工具字段 |
| `packages/tab-genoffice/src/host/capability.ts` | capabilityOf | `rg "export function capabilityOf" packages/tab-genoffice/src/host/capability.ts` | L121 | 同步后能力核验 |

### 3.4 API / 数据 / 权限 / 路由影响

API 需适配官方工具上下文和前置 revision 契约；数据仍写真实 Office 文件并复用现有序列化。权限不扩张，既有五族路由保留；新增官方 app 的完整 Web 入口交由后续包独立验收。


本包不实现服务端重复 call ID 去重，不能把前置 no-replay 解释为幂等保证。固定官方 SHA 是 2026-09-12 调研快照；执行时即使远端前进，也不悄悄切换合并对象，应先按需求变更协议更新合同和影响分析。

## 4. Phase 计划与任务详情

总入口：[Master handoff](../genoffice-web-roadmap/handoff.md)。未来执行由 master 连续调度本包；本包 CSV 是本包唯一任务状态源，跨包解锁须过 master gate。

control-session-safety → plugin-tool-alignment 两包均完成真实验收后，记录其实际两仓基点；不得直接以旧 247e3f5 分支替换前置修复。

任务依赖按下表序号串行。跨包依赖不能由 board.py 自动推断，各包 Task 1 负责核对母包及前置证据；“可开工”不等于本轮授权执行。

实现任务 6 项；其余为基线、验收、测量或回归。所有任务均为未来执行状态。

状态板：[tasks.csv](tasks.csv)。本轮按用户要求统一为独立 CSV；本节只保留任务详情，状态不在此重复维护。

### Phase 0: 可运行起点与基线

### Task 1: 锁定前置修复并建立隔离合并基线

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / INV-001 / INV-002 / INV-003 / INV-004 / INV-005 / EVD-004
- **前置任务**：无（仍需核对上述跨包条件）
- **风险等级**：P0

**为什么做**：读取两个前置包全部任务与证据，记录两仓 HEAD、dirty diff 和 Node 路径/版本；创建隔离 checkout/worktree，并把已验收但尚未提交的修复以可审计方式带入，原工作区保持不变。

**涉及文件与定位**：

- `../engine/apps/docs/src/renderer/control.ts`：`initControlMode`；`rg "initControlMode" ../engine/apps/docs/src/renderer/control.ts`；L97，行号仅 hint。
- `../engine/apps/slides/src/renderer/ai/slides-skill.ts`：`land_pages`；`rg "land_pages" ../engine/apps/slides/src/renderer/ai/slides-skill.ts`；L857，行号仅 hint。
- `../engine/web/server.mjs`：`findStaticRoots`；`rg "findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。
- `../engine/web/write-atomic.mjs`：`writeFileAtomic`；`rg "writeFileAtomic" ../engine/web/write-atomic.mjs`；L47，行号仅 hint。

**具体操作**：

1. 读取两个前置包全部任务与证据，记录两仓 HEAD、dirty diff 和 Node 路径/版本；创建隔离 checkout/worktree，并把已验收但尚未提交的修复以可审计方式带入，原工作区保持不变。
2. 再次运行 git merge-tree 预演实际起点与固定官方 SHA，清点冲突及自动合并后的敏感文件；16 文件仅历史提示，不能当固定数量验收。
3. 未来新建 web/e2e-official-sync.mjs，复用前置真实测试驱动并增加五族与 Docs 新上下文/page-spec 用例，支持 --case/--all/--out；准备可审计五族文件及评论/页眉/修订 fixture。记录 workspace tests 已有失败，先恢复测试环境。

**验证**：`git -C ../engine rev-parse HEAD`；`git -C ../engine merge-tree --write-tree HEAD de139a061537bea40f0cc81ef8f09a95f77ac52a` → 保存实际冲突；`npm --prefix ../engine run typecheck` → 保存基线

**Evidence**：`evidence/phase-0/task-1.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 2: 完整合并官方并解决敏感文件冲突

- **关联**：BR-001 / BR-002 / INV-001 / INV-003 / INV-005 / EVD-004
- **前置任务**：1
- **风险等级**：P0

**为什么做**：只在隔离引擎工作区合并固定 de139a061537bea40f0cc81ef8f09a95f77ac52a；逐个语义合并 App、Markdown、Sheets 保存/journal、Slides 工具和测试，不用整文件 ours/theirs 丢弃一方。

**涉及文件与定位**：

- `../engine/apps/docs/src/renderer/control.ts`：`initControlMode`；`rg "initControlMode" ../engine/apps/docs/src/renderer/control.ts`；L97，行号仅 hint。
- `../engine/apps/docs/src/renderer/App.tsx`：`initControlMode` 调用；`rg "initControlMode" ../engine/apps/docs/src/renderer/App.tsx`；L1371，行号仅 hint。
- `../engine/apps/slides/src/renderer/ai/slides-skill.ts`：`land_pages`；`rg "land_pages" ../engine/apps/slides/src/renderer/ai/slides-skill.ts`；L857，行号仅 hint。
- `../engine/apps/sheets/src/renderer/save-actions.ts`：`buildSavePayload`；`rg "buildSavePayload" ../engine/apps/sheets/src/renderer/save-actions.ts`；L81，行号仅 hint。
- `../engine/apps/sheets/src/renderer/edit-journal.ts`：`createEditJournal`；`rg "createEditJournal" ../engine/apps/sheets/src/renderer/edit-journal.ts`；L246，行号仅 hint。
- `../engine/web/server.mjs`：`findStaticRoots`；`rg "findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。
- `../engine/web/write-atomic.mjs`：`writeFileAtomic`；`rg "writeFileAtomic" ../engine/web/write-atomic.mjs`；L47，行号仅 hint。

**具体操作**：

1. 只在隔离引擎工作区合并固定 de139a061537bea40f0cc81ef8f09a95f77ac52a；逐个语义合并 App、Markdown、Sheets 保存/journal、Slides 工具和测试，不用整文件 ours/theirs 丢弃一方。
2. 把官方变化、魔改保留项、前置修复归属和冲突解决理由记入 evidence；自动合并的控制/bridge 和依赖导出同样审查。
3. 先证明 Markdown 最小打开保存重开可运行，再扩下一阶段工具适配；merge commit 的 author 身份必须来自已配置环境，不编造身份。提交前检查 staged diff/status 和敏感数据。

**验证**：`git -C ../engine diff --check`；`git -C ../engine ls-files -u` → 无未解决冲突；`node ../engine/web/e2e-official-sync.mjs --case markdown` → 真实闭环通过

**Evidence**：`evidence/phase-0/task-2.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 3: 执行 Phase 0 回归验证

- **关联**：BR-001 / BR-002 / INV-001 / INV-003 / INV-005 / EVD-004
- **前置任务**：2
- **风险等级**：P1

**为什么做**：确认实际 merge 结果同时包含官方 SHA 与记录的魔改起点；检查当前原工作区状态未被隔离工作修改。

**涉及文件与定位**：

- `../engine/apps/docs/src/renderer/control.ts`：`initControlMode`；`rg "initControlMode" ../engine/apps/docs/src/renderer/control.ts`；L97，行号仅 hint。
- `../engine/web/server.mjs`：`findStaticRoots`；`rg "findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。
- `../engine/web/write-atomic.mjs`：`writeFileAtomic`；`rg "writeFileAtomic" ../engine/web/write-atomic.mjs`；L47，行号仅 hint。

**具体操作**：

1. 确认实际 merge 结果同时包含官方 SHA 与记录的魔改起点；检查当前原工作区状态未被隔离工作修改。
2. 运行已合并最小切片与前置状态测试；其余未适配功能保持未完成。

**验证**：`git -C ../engine merge-base --is-ancestor de139a061537bea40f0cc81ef8f09a95f77ac52a HEAD`；`node ../engine/web/e2e-official-sync.mjs --case markdown`；`npm --prefix ../engine run typecheck` → 通过；`实际魔改起点另做 ancestry 核对`

**Evidence**：`evidence/phase-0/task-3.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Phase 1: 按依赖扩展并验证

### Task 4: 接入 Docs 官方执行上下文和读取基线

- **关联**：BR-003 / UF-002 / INV-002 / INV-003 / EVD-002
- **前置任务**：3
- **风险等级**：P1

**为什么做**：从合并后 App 传入 track/signal/frozen/comments/hf 等实际工具需要的访问器，复用单份 store，不创建平行状态。

**涉及文件与定位**：

- `../engine/apps/docs/src/renderer/control.ts`：`initControlMode`；`rg "initControlMode" ../engine/apps/docs/src/renderer/control.ts`；L97，行号仅 hint。
- `../engine/apps/docs/src/renderer/App.tsx`：`initControlMode` 调用；`rg "initControlMode" ../engine/apps/docs/src/renderer/App.tsx`；L1371，行号仅 hint。
- `../engine/apps/docs/src/renderer/ai/tools.ts`：`executeTool`、`markDocSeen`；`rg "markDocSeen" ../engine/apps/docs/src/renderer/ai/tools.ts`；L264，行号仅 hint。

**具体操作**：

1. 从合并后 App 传入 track/signal/frozen/comments/hf 等实际工具需要的访问器，复用单份 store，不创建平行状态。
2. 分别校验原生 relay/context 和 DSH get_document_context 路径的读取标记；与前置 expectedRevision 保护协同，不能把单编辑器 markDocSeen 当多 agent 隔离。
3. 从真实入口读取/回复评论、编辑页眉页脚并保存重开，原修订保留；无效线程/过期索引返回具体恢复错误，UI 与工具一致。

**验证**：`node ../engine/web/e2e-official-sync.mjs --case docs-context`；`npm --prefix ../engine run test -w @genoffice/docs` → 两条读取入口及新工具通过

**Evidence**：`evidence/phase-0/task-4.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 5: 隔离浏览器 provider 与 Node 运行依赖

- **关联**：BR-004 / UF-001 / INV-005 / EVD-001 / EVD-004
- **前置任务**：4
- **风险等级**：P1

**为什么做**：追踪官方 ai-provider exports 和五族 bridge 依赖图；复用 ./browser 设置入口，保留 Web chat/stream 真实实现，必要时抽取浏览器安全入口或经现服务边界转发。

**涉及文件与定位**：

- `../engine/apps/docs/src/renderer/web-bridge.ts`：ai-provider import；`rg "chatForProvider" ../engine/apps/docs/src/renderer/web-bridge.ts`；L17，行号仅 hint。
- `../engine/packages/ai-provider/package.json`：`exports`；`rg "exports" ../engine/packages/ai-provider/package.json`；L8，行号仅 hint。

**具体操作**：

1. 追踪官方 ai-provider exports 和五族 bridge 依赖图；复用 ./browser 设置入口，保留 Web chat/stream 真实实现，必要时抽取浏览器安全入口或经现服务边界转发。
2. 不把 browser.ts 中不存在的流式函数强行导入；检查产物不能引入 child_process、Electron 或 Node transport 到浏览器执行路径。
3. 实际浏览器启动并调用已配置普通 Web transport，保留缺配置前置反馈；不得仅用 bundle 字符串扫描宣称运行通过。

**验证**：`npm --prefix ../engine run web:build --workspaces --if-present`；`node ../engine/web/e2e-official-sync.mjs --case browser-provider` → 构建与浏览器实际执行通过

**Evidence**：`evidence/phase-0/task-5.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 6: 同步共享落页算法并保持输入兼容

- **关联**：BR-005 / UF-003 / INV-003 / INV-005 / EVD-003
- **前置任务**：5
- **风险等级**：P1

**为什么做**：逐项对照官方 main/page-spec 与魔改 shared/page-spec 算法差异，迁入唯一共享实现，desktop/Web 两侧都消费该模块。

**涉及文件与定位**：

- `../engine/apps/slides/src/shared/page-spec.ts`：`parsePageSpec`、`buildPagePptx`；`rg "buildPagePptx" ../engine/apps/slides/src/shared/page-spec.ts`；L352，行号仅 hint。
- `../engine/apps/slides/src/renderer/ai/slides-skill.ts`：`land_pages`；`rg "land_pages" ../engine/apps/slides/src/renderer/ai/slides-skill.ts`；L857，行号仅 hint。
- `../engine/apps/slides/src/renderer/web-bridge.ts`：`parsePageSpec` import；`rg "parsePageSpec" ../engine/apps/slides/src/renderer/web-bridge.ts`；L137，行号仅 hint。

**具体操作**：

1. 逐项对照官方 main/page-spec 与魔改 shared/page-spec 算法差异，迁入唯一共享实现，desktop/Web 两侧都消费该模块。
2. 保留 pages_spec/page_spec 输入与落页事务；移植官方新算法失败例，验证原页、文字、布局与非法规格不产生部分页。
3. 前置落页超时禁止重放保持；响应未知先读取确认，不假定相同 call ID 会自动去重。

**验证**：`npm --prefix ../engine run test -w @genoffice/slides`；`node ../engine/web/e2e-official-sync.mjs --case land-pages` → 合法/非法/过期和丢回执场景通过

**Evidence**：`evidence/phase-0/task-6.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 7: 复核其余四族保存与控制适配

- **关联**：BR-002 / UF-001 / INV-002 / INV-003 / INV-004 / EVD-001
- **前置任务**：6
- **风险等级**：P0

**为什么做**：针对合并后 Markdown/Sheets/Slides/PDF 的加载、journal、保存队列和 tool 变化，复核安全包共享 adapter 调用；普通模式新官方默认行为遵循本包兼容合同。

**涉及文件与定位**：

- `../engine/apps/slides/src/renderer/ai/slides-skill.ts`：`land_pages`；`rg "land_pages" ../engine/apps/slides/src/renderer/ai/slides-skill.ts`；L857，行号仅 hint。
- `../engine/apps/sheets/src/renderer/save-actions.ts`：`buildSavePayload`；`rg "buildSavePayload" ../engine/apps/sheets/src/renderer/save-actions.ts`；L81，行号仅 hint。
- `../engine/apps/sheets/src/renderer/edit-journal.ts`：`createEditJournal`；`rg "createEditJournal" ../engine/apps/sheets/src/renderer/edit-journal.ts`；L246，行号仅 hint。
- `../engine/web/server.mjs`：`findStaticRoots`；`rg "findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。
- `../engine/web/write-atomic.mjs`：`writeFileAtomic`；`rg "writeFileAtomic" ../engine/web/write-atomic.mjs`；L47，行号仅 hint。

**具体操作**：

1. 针对合并后 Markdown/Sheets/Slides/PDF 的加载、journal、保存队列和 tool 变化，复核安全包共享 adapter 调用；普通模式新官方默认行为遵循本包兼容合同。
2. 重点检查 Sheets payload/journal 与 PDF 合并重载，不以类型断言忽略新增字段；每族独立保存中新编辑、外改冲突及真实重开。

**验证**：`node ../engine/web/e2e-official-sync.mjs --case five-family`；`node ../engine/web/e2e-control-session.mjs --all` → 状态与保存回归通过

**Evidence**：`evidence/phase-0/task-7.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 8: 同步插件新增工具声明与能力边界

- **关联**：BR-002 / BR-003 / BR-006 / UF-001 / UF-002 / INV-003 / INV-005 / EVD-004
- **前置任务**：7
- **风险等级**：P1

**为什么做**：对照合并后真实 Docs/五族执行器更新插件工具声明、可用能力和传递上下文；只注册本包已有真实执行链路的新增编辑工具，字段/枚举/结果契约须可调用验证。

**涉及文件与定位**：

- `../engine/apps/docs/src/renderer/control.ts`：`initControlMode`；`rg "initControlMode" ../engine/apps/docs/src/renderer/control.ts`；L97，行号仅 hint。
- `../engine/apps/docs/src/renderer/ai/tools.ts`：`executeTool`、`markDocSeen`；`rg "markDocSeen" ../engine/apps/docs/src/renderer/ai/tools.ts`；L264，行号仅 hint。
- `../engine/apps/slides/src/renderer/ai/slides-skill.ts`：`land_pages`；`rg "land_pages" ../engine/apps/slides/src/renderer/ai/slides-skill.ts`；L857，行号仅 hint。
- `../engine/web/server.mjs`：`findStaticRoots`；`rg "findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。
- `packages/tab-genoffice/src/host/tool-schema.ts`：CONTROL_TOOL_TABLE；`rg "export const CONTROL_TOOL_TABLE" packages/tab-genoffice/src/host/tool-schema.ts`；L72，行号仅 hint。
- `packages/tab-genoffice/src/host/capability.ts`：capabilityOf；`rg "export function capabilityOf" packages/tab-genoffice/src/host/capability.ts`；L121，行号仅 hint。

**具体操作**：

1. 对照合并后真实 Docs/五族执行器更新插件工具声明、可用能力和传递上下文；只注册本包已有真实执行链路的新增编辑工具，字段/枚举/结果契约须可调用验证。
2. 重跑插件路径/显式 kind/PPT 参数/落页 no-replay 契约；本任务修改插件前读取上一包完整变更，不回滚 Sidebar 迁移。

**验证**：`npm run typecheck`；`npm test`；`npm run build`；`npm run standard:check`；`node scripts/e2e-plugin-alignment.mjs --all`；`node ../engine/web/e2e-official-sync.mjs --case docs-context` → 新旧工具真实通过

**Evidence**：`evidence/phase-0/task-8.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 9: 登记官方增量和后续网页能力归属

- **关联**：BR-001 / BR-006 / INV-005 / EVD-004
- **前置任务**：8
- **风险等级**：P1

**为什么做**：输出官方新增/变更能力清单及每项 Web 状态、现测试和后续负责项；HTML/OCR/转换依赖标为待后续实现验收，不能因进入 workspaces 变成可用。

**涉及文件与定位**：

- `../engine/packages/ai-provider/package.json`：`exports`；`rg "exports" ../engine/packages/ai-provider/package.json`；L8，行号仅 hint。
- `../engine/apps/slides/src/shared/page-spec.ts`：`parsePageSpec`、`buildPagePptx`；`rg "buildPagePptx" ../engine/apps/slides/src/shared/page-spec.ts`；L352，行号仅 hint。
- `../engine/web/server.mjs`：`findStaticRoots`；`rg "findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。

**具体操作**：

1. 输出官方新增/变更能力清单及每项 Web 状态、现测试和后续负责项；HTML/OCR/转换依赖标为待后续实现验收，不能因进入 workspaces 变成可用。
2. 把实际合并 SHA、控制协议差异、共享模块路径与新增 HTML 真实定位交接至 web-feature-completion 的 P0，保留用户五项目标逐项归属。

**验证**：`git -C ../engine diff --stat f68df70e222d47aa08211f9a2d7748c610d1d6aa HEAD`；`python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/official-upstream-sync --repo .` → 清单覆盖官方增量，包结构通过

**Evidence**：`evidence/phase-0/task-9.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 10: 执行 spec 5.2 真实场景全套测试

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / UF-001 / UF-002 / UF-003 / INV-001 / INV-002 / INV-003 / INV-004 / INV-005 / EVD-001 / EVD-002 / EVD-003 / EVD-004
- **前置任务**：9
- **风险等级**：P1

**为什么做**：逐族真实文件回放所有矩阵；Docs 两条 context、新评论/页眉与修订，Slides 共享落页均保存重开；对前置两包回归失败的条目回退状态并修复。

**涉及文件与定位**：

- `../engine/apps/docs/src/renderer/control.ts`：`initControlMode`；`rg "initControlMode" ../engine/apps/docs/src/renderer/control.ts`；L97，行号仅 hint。
- `../engine/apps/slides/src/shared/page-spec.ts`：`parsePageSpec`、`buildPagePptx`；`rg "buildPagePptx" ../engine/apps/slides/src/shared/page-spec.ts`；L352，行号仅 hint。
- `../engine/apps/sheets/src/renderer/save-actions.ts`：`buildSavePayload`；`rg "buildSavePayload" ../engine/apps/sheets/src/renderer/save-actions.ts`；L81，行号仅 hint。
- `../engine/web/server.mjs`：`findStaticRoots`；`rg "findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。
- `../engine/web/write-atomic.mjs`：`writeFileAtomic`；`rg "writeFileAtomic" ../engine/web/write-atomic.mjs`；L47，行号仅 hint。

**具体操作**：

1. 逐族真实文件回放所有矩阵；Docs 两条 context、新评论/页眉与修订，Slides 共享落页均保存重开；对前置两包回归失败的条目回退状态并修复。

**验证**：`node ../engine/web/e2e-official-sync.mjs --all` → 所有矩阵通过，原文件与新输出均可核对

**Evidence**：`evidence/phase-0/task-10.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 11: 执行 Phase 1 回归验证

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / INV-001 / INV-002 / INV-003 / INV-004 / INV-005 / EVD-004
- **前置任务**：10
- **风险等级**：P1

**为什么做**：完整相关 suite、Web 构建及两仓兼容校验通过后核对实际双 ancestry；已知环境失败必须修复或明确阻塞，不能关闭 SSRF 校验求绿。

**涉及文件与定位**：

- `../engine/apps/docs/src/renderer/control.ts`：`initControlMode`；`rg "initControlMode" ../engine/apps/docs/src/renderer/control.ts`；L97，行号仅 hint。
- `../engine/apps/slides/src/shared/page-spec.ts`：`parsePageSpec`、`buildPagePptx`；`rg "buildPagePptx" ../engine/apps/slides/src/shared/page-spec.ts`；L352，行号仅 hint。
- `../engine/web/server.mjs`：`findStaticRoots`；`rg "findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。
- `../engine/web/write-atomic.mjs`：`writeFileAtomic`；`rg "writeFileAtomic" ../engine/web/write-atomic.mjs`；L47，行号仅 hint。

**具体操作**：

1. 完整相关 suite、Web 构建及两仓兼容校验通过后核对实际双 ancestry；已知环境失败必须修复或明确阻塞，不能关闭 SSRF 校验求绿。

**验证**：`npm --prefix ../engine run typecheck`；`npm --prefix ../engine run test`；`npm --prefix ../engine run web:build --workspaces --if-present`；`npm run typecheck`；`npm test`；`npm run build`；`npm run standard:check`；`python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/official-upstream-sync --repo .` → 全通过且真实证据存在

**Evidence**：`evidence/phase-0/task-11.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

## 5. 验收与 Review 协议

### 5.1 命令级验证

本轮仅运行包结构/源码锚点/状态板/视图校验。下列业务命令是未来执行闸门；命令级通过之后仍须运行第 5.2 节。

| 验证项 | 命令（插件仓根） | 期望 |
|---|---|---|
| 本轮规格 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/official-upstream-sync --repo .` | 退出 0；规格必须 0 FAIL |
| 本轮状态 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/board.py docs/official-upstream-sync --json` | 全部任务待开始；后续实施由事实更新 |
| 本轮视图 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/render_spec.py docs/official-upstream-sync` | 退出 0；规格必须 0 FAIL |
| 插件类型 | `npm run typecheck` | 退出 0；规格必须 0 FAIL |
| 插件测试 | `npm test` | 退出 0；规格必须 0 FAIL |
| 插件构建 | `npm run build` | 退出 0；规格必须 0 FAIL |
| 标准契约 | `npm run standard:check` | 退出 0；规格必须 0 FAIL |
| 引擎类型 | `npm --prefix ../engine run typecheck` | 退出 0，无未解释失败 |
| 引擎相关完整测试 | `npm --prefix ../engine run test` | 退出 0，无未解释失败 |
| 所有应用 Web 构建 | `npm --prefix ../engine run web:build --workspaces --if-present` | 退出 0，无未解释失败 |
| 原子保存 | `node --test ../engine/web/write-atomic.test.mjs` | 退出 0，无未解释失败 |

前期 review 的已知测试失败不能当本轮新增回归，也不能被静默忽略。未来先记录实际 Node/PATH 与失败基线，修复可恢复的环境条件；不要移除网络/路径校验求绿。尚不可恢复则相关任务保持未完成并注明原因。

### 5.2 真实场景全套测试

本节定义未来功能完成标准；本轮只生成与校验规格，不执行应用测试。生成器/状态板退出 0 不能替代这里的业务证据。

**环境准备**：

| 项 | 值 |
|---|---|
| 工作目录 | 插件仓根；`../engine` 为前置包实际验收后的隔离兄弟仓。 |
| 启动命令 | `PORT=18787 node ../engine/web/server.mjs`；这是已核实支持 PORT 的现存服务入口。先检查端口空闲；被占用则选新独立端口并把实际地址写入日志，不停止用户进程。 |
| 构建前置 | `npm --prefix ../engine run web:build --workspaces --if-present`；校准实际 app 清单，生成完成不等于构建已经运行。 |
| 访问入口 | `http://127.0.0.1:18787/`；五族 `/docs/`、`/markdown/`、`/sheets/`、`/slides/`、`/pdf/`；控制 URL 由真实 `/api/control/open` 返回。HTML 在前置同步和接入后记录实际路由。 |
| 插件入口 | 已核实的 Sidebar → GenOffice 文件行与显式 open；使用插件契合包隔离真实 SDK/DSH harness，不借用用户 profile。完整 DSH 服务的隔离启动参数在其 Task 1 记录，无法启动时完整宿主验收保持未完成。 |
| 数据与权限 | 由 Task 1 生成可审计临时文件；只使用测试目录与已配置服务。双 agent 分别保留读取版本，浏览器 profile/下载目录隔离；日志不含凭据或真实用户文档。 |
| 干净状态 | 每组用例复制初始 fixture、记录哈希和版本；关闭本组拥有的页面/进程并清理临时输出；不删除源码仓库或用户数据。 |
| 测试工具 | 本地已安装 Playwright/Chromium、Node HTTP、真实 relay 与文件系统。若后续环境缺浏览器，先恢复依赖；无法恢复则按第 2.3 节生成手动逐步脚本供回填，未获真实结果不得完成。 |
| 验证入口 | `node ../engine/web/e2e-official-sync.mjs --all`；这是 Task 1 要新增的真实回放脚本，本轮未创建。默认 relay 地址为上述隔离端口，提供 `--out` 指向本包 evidence；逐项 `--case` 名称见任务验证行，全部必须由创建任务实现。 |

**执行矩阵**：每行归档实际 request/response、console/server 输出、network 与截图；预期故障单独标注，不能吞掉非预期错误。result.json 必须枚举全部适用 app/入口/能力子例、成功断言、失败断言、恢复结果及输出文件清单，不允许只写一个总 pass。

| UF | 执行方式 | 操作来源 | 必须核对的点 | Evidence |
|---|---|---|---|---|
| UF-001 主路径 | browser + 公开 API + 真实磁盘 | 第 2.3 节 UF-001 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-001/success/result.json`、`evidence/UF-001/success/console.log`、`evidence/UF-001/success/network.json`、`evidence/UF-001/success/screenshot.png` |
| UF-001 失败分支：打开失败 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：临时文件无效或解析失败 | 返回加载错误，不创建空白覆盖原文件；恢复：使用有效文件重新 open；恢复后重走成功路径 | `evidence/UF-001/failure-1/result.json`、`evidence/UF-001/failure-1/console.log`、`evidence/UF-001/failure-1/network.json`、`evidence/UF-001/failure-1/screenshot.png` |
| UF-001 失败分支：保存冲突 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：打开后从外部修改磁盘文件 | 返回前置安全协议定义的冲突，外部内容不被覆盖；恢复：重读并重新应用所需编辑；恢复后重走成功路径 | `evidence/UF-001/failure-2/result.json`、`evidence/UF-001/failure-2/console.log`、`evidence/UF-001/failure-2/network.json`、`evidence/UF-001/failure-2/screenshot.png` |
| UF-001 失败分支：再次编辑 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：保存进行中用户追加编辑 | 保存确认只确认导出版本；恢复：再显式保存；恢复后重走成功路径 | `evidence/UF-001/failure-3/result.json`、`evidence/UF-001/failure-3/console.log`、`evidence/UF-001/failure-3/network.json`、`evidence/UF-001/failure-3/screenshot.png` |
| UF-002 主路径 | browser + 公开 API + 真实磁盘 | 第 2.3 节 UF-002 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-002/success/result.json`、`evidence/UF-002/success/console.log`、`evidence/UF-002/success/network.json`、`evidence/UF-002/success/screenshot.png` |
| UF-002 失败分支：评论消失 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：获取评论后另一编辑删除该线程或锚点 | 返回对象不存在，禁止添加到错误线程；恢复：read_comments 后重新定位；恢复后重走成功路径 | `evidence/UF-002/failure-1/result.json`、`evidence/UF-002/failure-1/console.log`、`evidence/UF-002/failure-1/network.json`、`evidence/UF-002/failure-1/screenshot.png` |
| UF-002 失败分支：读取后外部编辑 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：用户改变被索引的文档块，再发旧索引写入 | 前置 revision 保护与原生 freshness 检查协同拒绝旧写入；恢复：新 context 后重试合法操作；恢复后重走成功路径 | `evidence/UF-002/failure-2/result.json`、`evidence/UF-002/failure-2/console.log`、`evidence/UF-002/failure-2/network.json`、`evidence/UF-002/failure-2/screenshot.png` |
| UF-003 主路径 | browser + 公开 API + 真实磁盘 | 第 2.3 节 UF-003 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-003/success/result.json`、`evidence/UF-003/success/console.log`、`evidence/UF-003/success/network.json`、`evidence/UF-003/success/screenshot.png` |
| UF-003 失败分支：非法规格 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：提交不能解析的 page-spec | 校验失败，不追加部分页面；恢复：修正输入再提交；恢复后重走成功路径 | `evidence/UF-003/failure-1/result.json`、`evidence/UF-003/failure-1/console.log`、`evidence/UF-003/failure-1/network.json`、`evidence/UF-003/failure-1/screenshot.png` |
| UF-003 失败分支：旧请求/丢回执 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：落页已执行但回执丢失，或提交过期 revision | 旧版请求拒绝；未知结果先读确认，不自动重放，不假定服务端已有重复 call ID 去重；恢复：读取最新上下文确认结果；恢复后重走成功路径 | `evidence/UF-003/failure-2/result.json`、`evidence/UF-003/failure-2/console.log`、`evidence/UF-003/failure-2/network.json`、`evidence/UF-003/failure-2/screenshot.png` |

每行失败或缺证据均表示该真实场景未完成；修复后重走该行及受影响的成功路径。服务型功能的未配置负例不能代替已配置服务正例。

### 5.3 Evidence 归档

验收结果格式引用 [master spec 第 2.5 节](../genoffice-web-roadmap/spec.md#acceptance-result)；未来 harness 必须输出该格式，master gate 逐个检查精确非空文件。零 console/network 事件也记录真实采集元信息及零计数；不得创建无意义占位日志。

业务证据类别和位置以第 2.5 节为准；各 Task 的命令日志保存完整命令、cwd、时间、固定 SHA、退出码与结果。第 5.2 节目录下保存真实文件和逐项结果，不创建空文件满足审计。当前生成校验单独存 `evidence/package-validation/`，不属于修复完成证据。

### 5.4 Review 专项检查

- [ ] 每项业务规则、用户路径和不变量均有任务及实际证据核销。
- [ ] 第 2.3 节每条入口、加载/禁用/错误/成功和恢复反馈都在真实 UI 或 CLI 可达。
- [ ] 第 5.2 节全部主路径、失败分支和适用 app/清单子项通过，真实产物已重开。
- [ ] 未以固定 stub、忽略错误、放松网络/文件权限或自动重放修改来通过测试。
- [ ] 前置包实际 SHA/协议与当前实现一致；原用户工作区和未提交内容没有被覆盖。
- [ ] 最终状态按实际结果更新，真实场景任务完成后再次运行包证据闸门。
