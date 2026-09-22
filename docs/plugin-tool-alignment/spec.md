# plugin-tool-alignment Spec

> Version: 0.3.0 | Date: 2026-09-12 | Status: Ready 可执行（仅规格，尚未实施）
>
> 本文件是本包唯一事实源；oneclick 三阶段规格已展开；本轮只生成与校验，业务实现与真实场景尚未执行。

## 0. 一页纸人话摘要

- 给 DSH 用户和调用 GenOffice 的 agent 修复文件打开入口与编辑参数不一致的问题。
- 项目目录中的文件链接必须打开正确文件；普通点击 Markdown/PDF 继续使用宿主预览，agent 明确请求编辑时进入 GenOffice 网页控制模式。
- 已经能在网页执行的表格、图表等工具，应给出正确参数和真实说明；批量编辑应解释单位和元素定位方式。
- 页面生成超时不能偷偷重复执行，以免重复追加页面；错误必须带可恢复的下一步。
- 完成以真实 Sidebar、真实 relay 和浏览器中的打开、编辑、保存、重开结果为准，同时保持用户现有 Sidebar 迁移改动。
- 本包修插件兼容层；文档状态一致性、官方合并、尚未实现的网页功能由其他包承担。

## 1. 事实基线与假设

### 1.1 需求与运行模式

| 项 | 结论 |
|---|---|
| 原始需求 | 用户要求针对此前 review 的优化项制作多套 prd-workflow oneclick 包；本轮仅生成任务包并运行校验，不执行修复；本包负责插件与魔改上游契合 |
| 输入类型 | 当前对话需求与本地真实源码 |
| Mode | oneclick；本轮不 execute，未来执行从包状态板开始 |
| 置信度 | 高；五项问题均有源码定位 |
| 输出目录 | `docs/plugin-tool-alignment/` |
| 上下文推断 | “上游”指本地魔改 engine；保留现有默认行为和用户脏改，不提交其他人的改动 |
| 跨包顺序 | 任务包文档可并行生成；未来源码执行必须依次 safety → plugin-tool-alignment → official-sync → web-feature → efficiency |

### 1.2 任务类型路由

| 维度 | 结论 |
|---|---|
| 任务类型 | bugfix + frontend + backend |
| 主要风险 | 路径解析错文档、md/pdf agent 入口被拒绝、参数按声明调用失败、超时追加重复页面 |
| 行号策略 | symbol 与 rg anchor 为准，行号仅 hint |
| 必需验收 | 失败回归、真实 SDK 契约、浏览器 Sidebar 接线、真实 relay 请求及保存重开 |
| 必须覆盖 | 普通点击与显式控制分流；相对/绝对/跨 session 路径；PPT 编辑与批处理；落页超时不重放 |

### 1.3 勘察事实清单

| 事实 | 来源命令 | 输出摘要 |
|---|---|---|
| 插件 HEAD 与用户改动 | `git rev-parse --short HEAD`；`git status --short` | HEAD 为 `5d5ee6d1`，Sidebar 迁移与构建产物等大量未提交改动；本包目录此前不存在 |
| 工程验证入口 | `cat package.json packages/tab-genoffice/package.json` | 根脚本有 `npm test`、`npm run typecheck`、`npm run build`、`npm run standard:check`、`npm run smoke`；测试框架为 Vitest |
| 官方 Sidebar 的显式 kind 仍检查 canOpen | `rg -n 'claim\(address, kind\)|canOpen' env/profiles/go/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js` | rc.2 SDK 的 `claim` 在显式 kind 分支仍可抛出 refuses；默认分支按 patterns 排名 |
| 当前插件 canOpen 只认领三种 Office 文件 | `sed -n '37,124p' packages/tab-genoffice/src/standard/client.ts`；`cat packages/tab-genoffice/src/tabs/coexist.ts` | `CLAIMED_EXTS` 为 docx/xlsx/pptx；SSE 打开请求强制 `GENOFFICE_FILE_KIND`，md/pdf 因 canOpen 被拒绝后异常被 catch 吞掉 |
| 项目目录路径会编码为相对路径但没有还原 | `cat packages/tab-genoffice/src/tabs/file-address.ts`；`cat packages/tab-genoffice/src/tabs/docx-control-viewer.tsx` | `fileAddressFor` 对 cwd 内路径去掉前缀；`GenOfficeFileTab` 直接用 `parsed.path` 请求 relay |
| 已有会话目录数据入口 | `rg -n 'useSessions|cwd|fileAddressFor|openResource' packages/tab-genoffice/src/tabs/genoffice.tsx packages/tab-genoffice/src/standard/sidebar.ts` | 本地 Sidebar props 已含 useSessions/byId/cwd；文件浏览页使用会话 cwd，普通 md/pdf 不带显式 kind |
| PPT schema 字段已漂移 | `sed -n '1013,1080p' packages/tab-genoffice/src/host/tool-schema.ts`；`sed -n '3343,3474p' ../engine/apps/slides/src/renderer/ai/slides-skill.ts` | cell 声明 cellId/text，执行要求 row/col/paragraphs；structure 声明 action，执行要求 kind/index/before；style/chart 也将顶层字段错误包成 object |
| 已有网页实现仍被错误文案阻挡 | `rg -n '网页版|控制模式下不可用' packages/tab-genoffice/src/host/tool-schema.ts`；`rg -n 'slides:.*table|slides:edit_chart|slides:ungroup|slides:save_template' packages/tab-genoffice/src/host/capability.ts` | 多个 available 条目仍标“网页版不可用”；不能仅删除说明而不校验参数 |
| 批量 op 的必要说明被丢失 | `sed -n '1183,1207p' ../engine/apps/slides/src/renderer/ai/slides-skill.ts`；`sed -n '1111,1133p' packages/tab-genoffice/src/host/tool-schema.ts` | 引擎说明含 target、durable ID、EMU 及 1px=9525EMU、opVocabulary；插件仅 opaque object[] |
| 超时自动重放与契约冲突 | `sed -n '295,316p' packages/tab-genoffice/src/host/tools.ts`；`rg -n 'callRelayRetry|executeLandPages' packages/tab-genoffice/src/host/tools.ts`；`rg -n '不重放' contracts/control-api.md` | land_pages/generate/regenerate 共用三次超时重放；现有合同禁止重放编辑 |
| 已有测试主要使用 stub | `sed -n '1,110p' packages/tab-genoffice/tests/host-land-pages.spec.ts`；`sed -n '250,300p' packages/tab-genoffice/tests/standard-facet.spec.ts` | fetch 与 Sidebar openResource 均为 vi.fn，不能替代实际 SDK claim 和浏览器接线 |
| 可用真实浏览器依赖 | `node -e "import('../engine/node_modules/playwright-core/index.mjs').then(({chromium})=>console.log(chromium.executablePath()))"` | 模块可导入，返回本机 Chromium 安装路径 |
| 勘察时默认服务未监听 | `curl -sS --max-time 3 http://127.0.0.1:8787/api/health`；`curl -sS -I --max-time 3 http://127.0.0.1:3080` | 两端均 connection refused；执行需隔离启动，不得停或重启后来出现的用户进程 |
| relay 支持端口隔离且须预构建 | `rg -n 'PORT|web-dist|listen' ../engine/web/server.mjs`；`cat ../engine/package.json` | `PORT` 默认为 8787；`node web/server.mjs` 服务已有 web-dist；构建有 workspace web:build |

### 1.4 假设清单

| 假设 ID | 内容 | 风险 | 确认方式 |
|---|---|---|---|
| ASM-001 | 当前会话可使用隔离 DSH profile 启动真实 Sidebar，或以真实 SDK 客户端模块的隔离浏览器应用回放，不访问用户凭据 | 宿主 bundle 加载可能依赖完整服务 | P0 核验最小真实入口、profile 启动参数与独立端口；失败则保持真实场景未完成，不以 mock 替代 |
| ASM-002 | 魔改引擎同步后目标工具仍保留相同语义；字段以执行时目标 engine 实现再核验 | 官方增量可能改变字段 | P0 锁定 engine 实际提交；Stage 2 最终 contract check 对齐该提交 |

质量记录：骨架定位与合同检查已通过；完整生成校验日志见 evidence/package-validation/。阶段提交曾因本仓未配置 Git 作者身份失败，未更改身份配置或业务源码。

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
| BR-001 | 会话作用域文件地址按地址内 session 的 cwd 还原为绝对路径；本已绝对的 POSIX/Windows/UNC 路径保持语义；不能解析时阻止请求并显示原因 | session A 的 a.docx 请求 A.cwd/a.docx，即使当前激活 B | 将 a.docx 直接发 relay 或套用 B.cwd 打开错误文件 | 文件解析与控制页 | UF-001 |
| BR-002 | 默认点击仅认领 docx/xlsx/pptx；显式 GenOffice 控制打开支持 docx/xlsx/pptx/md/pdf；无效地址、未知格式不被认领 | 普通 md 走宿主预览，md_open 走 GenOffice | 为修 md_open 抢占所有 md/pdf 默认点击，或显式 kind 仍被 canOpen 拒绝 | Sidebar 类型与 SSE | UF-002 |
| BR-003 | 对已开放 PPT 工具，声明的字段、required、枚举和执行器一致，用户按声明即可操作；不宣称实现不存在的桌面限制 | edit_table_cell 使用 row/col/paragraphs 并真实编辑成功 | cellId/text 仍被声明必需；available 工具仍标网页不可用 | 工具表与 capability | UF-003 |
| BR-004 | apply_ops 说明给出真实支持的 op 用法、target 地址、durable ID 与 EMU 换算，并明确 dry_run 和上限；避免把像素专用工具说明混用于批处理 | 1px 先乘 9525，先 dry_run 再编辑 | 把 read_slide 像素直接当 EMU，或猜不存在 op | 批处理工具 | UF-003 |
| BR-005 | land_pages 及其生成包装器只发送一次写入；超时或断线回报结果不确定并提示先读取文档核实，不自动追加重放 | 一次 append 已执行而回执丢失时最多发送一次写请求 | timeout 后新 call ID 重新执行两次 | host 落页执行 | UF-004 |
| BR-006 | 契约校验至少覆盖已修工具字段、枚举、单位说明、capability 与真实实现；异常可恢复且不能悄然吞掉合法打开失败 | 检测旧字段、未知 kind 和不支持格式且输出明确错误 | 只比工具名通过便宣布契约兼容 | 兼容校验与错误 | UF-001 / UF-002 / UF-003 / UF-004 |

### 2.2 UF 用户验收场景（索引）

| 场景 ID | Given | When | Then | 角色 | 验证方式 | Evidence |
|---|---|---|---|---|---|---|
| UF-001 | 会话 cwd 内有测试 docx，另有不同 cwd 的会话 | 用户从真实 Sidebar 点击项目文件 | 正确文件进入控制页；可编辑、保存、重开验证；缺目录或非法地址显示错误 | 用户 | browser + API | EVD-001 |
| UF-002 | Markdown/PDF 和 Office 测试文件存在 | 用户普通点击或 agent 发起 *_open | 默认预览分流保持；五族显式控制可达；跨会话事件不误开 | 用户与 agent | 真实 SDK + browser + API | EVD-002 |
| UF-003 | 真实 Slides 控制模式已打开含表格/图表的测试 deck | agent 按声明编辑，再以 durable ID 批处理并保存重开 | 内容与几何准确；非法参数清晰失败；dry_run 不改文档 | agent | 工具入口 + browser + 磁盘重开 | EVD-003 |
| UF-004 | 真实 Slides deck 可追加一页，网络可在写入后中断回执 | agent 调用落页、生成或单页重生成 | 成功正常返回；结果不明不重放，重新读取可确认实际页数 | agent | 真实 relay 故障注入 + 请求日志 | EVD-004 |

### 2.3 核心业务流程（步骤级交互脚本）

#### UF-001: 项目文件路径还原

**前置状态**：真实 Sidebar 的 GenOffice 文件浏览页，会话 A 的 cwd 存在测试文档。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 点击 cwd 内 docx | 新控制页显示加载状态 | 按文件地址里的会话 A 查 cwd，构成绝对路径 | 标题与文件一致 |
| 2 | 编辑并点击写入磁盘 | 现有编辑与保存反馈可见 | 请求同一个绝对路径，保存后重开 | 内容仍在正确磁盘文件 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 缺少会话 cwd | 相对地址对应 session 目录数据未到达或不存在 | 显示等待目录或无法解析原因，不显示空白文档 | 不发相对路径请求，不借用其他会话 cwd | 元数据到达后正常加载；不可恢复时用户返回目录 |
| 非法地址 | 编码错误、非文件 URI、空路径 | 显示地址无法解析 | 不发送 /api/control/open 和 /api/file | 返回目录重新点击有效文件 |

**界面状态机**：`unresolved → loading → ready → saving → ready`；`unresolved → error`；可恢复元数据更新后 `unresolved → loading`。

**入口接线清单**：GenOfficePanel 文件行 openResource → 官方 Sidebar 类型 → GenOfficeFileTab/useSessions → DocxControlViewer → ControlModeViewer；错误页保留关闭/返回动作。

#### UF-002: 默认预览与显式控制分流

**前置状态**：同一会话中有 md/pdf/docx/xlsx/pptx 测试文件，真实 Sidebar 插件已注册。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 普通点击 md/pdf，再点击 Office 文件 | 按原预览方式打开页签 | 默认匹配仍仅认领 Office 三族 | md/pdf 为宿主预览，Office 为 GenOffice |
| 2 | agent 对五族逐一调用 *_open | 工具进入等待状态、目标控制页出现 | SSE 显式 kind 可通过 canOpen；控制 iframe 注册 | 能读取文档上下文，错误不被吞掉 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 不支持地址或格式 | 显式打开 txt 或畸形 URI | 明确拒绝或保持现有宿主行为 | 不在 GenOffice 内创建错误编辑页 | 用户使用宿主预览或有效文件 |
| 事件属于另一会话 | session A 页面收到 B 的 open | A 不弹出 B 的文件 | 保持 fileOpenOnThisPage 的会话过滤 | B 的真实页面处理；不存在时 open 回报未就绪 |

**界面状态机**：`idle → claimed → loading → controlled`；不匹配 `idle → host-preview`；非法 `idle → rejected`。

**入口接线清单**：默认文件链接/openResource → patterns；agent *_open → /api/open → EventSource file → openResource(kind) → canOpen → GenOfficeFileTab。

#### UF-003: 按工具声明编辑真实 PPT

**前置状态**：测试 deck 含表格、图表与文本，agent 先打开并读取上下文。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 按 schema 编辑单元格、结构、样式与图表 | 工具结果与 Slides 更新 | 传参以当前执行器要求为准 | 单元格、行列、样式、图表准确改变 |
| 2 | 用文档中元素 ID、EMU 参数 dry_run 后应用 op | dry_run 说明只验证，正式应用后更新 | 事务执行并保留既有错误恢复 | 元素位置/文字符合预期，保存重开仍一致 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 字段或元素非法 | 非法 row/col、缺少段落或不存在 ID | 工具给具体字段/定位错误 | 不伪装成功，现有事务语义保持 | 重新读取上下文并按正确字段调用 |
| op 无效或超限 | 未知 op、零 op、超过 50 个 | 返回校验错误及真实支持用法 | dry_run 与 atomic 失败不落下部分改动 | 缩小批次或更正 op 后 dry_run |

**界面状态机**：`ready → validating → ready`（dry_run）；`ready → editing → dirty → saving → ready`；`validating/editing → error → ready`。

**入口接线清单**：createControlTools → CONTROL_TOOL_TABLE/参数声明 → capability 注册过滤 → callRelay → engine slides skill → web bridge；上下文读取提供真实 ID。

#### UF-004: 落页回执丢失不重复写入

**前置状态**：测试 deck 已打开，准备无需外部模型的 pages_spec/page_spec 和一次追加页。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 调用 pptx_land_pages 或生成包装器 | 工具显示执行中，浏览器出现一页 | 只发一次落页写调用；已有只读 settle 可继续 | 页数精确增加一次 |
| 2 | 保存并重新打开 | 保存成功反馈 | 原子保存已有结果 | 磁盘 deck 页数和文字正确 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 执行后回执超时 | 引擎已追加但响应被截断 | 工具明确结果不确定，提示先读取核实 | 不生成新 call ID 重放写入 | 重新读取页数/文字，确认后显式保存 |
| 写入前断线或取消 | 请求没有到达执行器或用户 abort | 明确失败或取消 | 不自动重放；保留信号取消语义 | 恢复连接并先读上下文，再由调用方决定新操作 |

**界面状态机**：`ready → submitting → landed`；`submitting → uncertain → inspected`；`submitting → cancelled`。

**入口接线清单**：pptx_land_pages / pptx_generate_deck / pptx_regenerate_slide → executeLandPages → callRelay 单次调用；错误经过现有 classifyControlError 并传给工具结果。

### 2.4 INV 不变量

| 不变量 ID | 内容 | 关联 BR/UF | 验证方式 |
|---|---|---|---|
| INV-001 | 保留用户 Sidebar 迁移与原有 docx/xlsx/pptx 默认认领；md/pdf 普通点击使用宿主预览 | BR-002 / UF-002 | diff + 真实 SDK 默认认领 |
| INV-002 | 显式保存才写盘；不增加自动保存、不清理用户文件、不触碰用户 DSH 凭据或重启其进程 | BR-001 / BR-005 | 请求日志、磁盘前后值、进程范围记录 |
| INV-003 | 保持网络外发与资产通道筛选边界；不通过放开所有工具修复 capability | BR-003 / BR-006 | capability 回归与注册集检查 |
| INV-004 | session 定向打开、错误分类与 abort 语义保持；不吞掉合法 open 的运行时失败 | BR-001 / BR-002 / BR-005 | 跨 session 与断线/取消场景 |

### 2.5 EVD 证据清单

| 证据 ID | 类型 | 期望证据 | 保存位置 |
|---|---|---|---|
| EVD-001 | browser/API/file | 路径还原成功与两条失败分支的截图、console、network 和磁盘比对 | `evidence/UF-001/` |
| EVD-002 | SDK/browser/API | 默认与显式 claim、五族打开与两条失败分支，真实模块版本 | `evidence/UF-002/` |
| EVD-003 | tools/browser/file | 参数契约检查、PPT 编辑/dry_run/失败恢复/保存重开，前后截图 | `evidence/UF-003/` |
| EVD-004 | API/browser/log | 单次落页写调用记录，真实断线与回执丢失后页数 | `evidence/UF-004/` |
| EVD-005 | command | 项目校验与完整包结构校验日志 | `evidence/validation/` |

### 2.6 角色与权限

单一本机用户与其授权 agent；无新增权限角色。沿用 loopback、资产通道及文件访问边界。

### 2.7 负向与破坏性场景

跨会话错路径由 UF-001/UF-002 覆盖；回执丢失导致重复追加由 UF-004 覆盖；错误 schema 与事务半写入由 UF-003 覆盖。测试仅用隔离临时文件。

### 2.8 非目标

- 不在此包合并官方上游、不实现新的编辑器功能或多 agent revision 协议。
- 不引入统一动态 schema 平台、完整 CLI/MCP 框架，也不重新设计 Sidebar。

## 3. 技术方案

### 3.1 架构方向

现有 Sidebar→插件参数表→relay→魔改执行器链路不变；修复地址消费、显式控制认领、工具镜像与单次写入。实现任务见第 4 章。

### 3.2 改造边界

文件地址解析负责按地址所属 session 还原 cwd；Sidebar 的默认模式匹配与显式 kind 可接受格式分开；CONTROL_TOOL_TABLE 只镜像真实执行字段，capability 不扩张权限；executeLandPages 只发一次写调用。真实 SDK claim 是必测入口。

### 3.3 三段式定位清单

| 文件 | 稳定定位 | 搜索定位 | 行号 hint | 备注 |
|---|---|---|---|---|
| `packages/tab-genoffice/src/tabs/file-address.ts` | fileAddressFor / parseFileAddress | `rg "fileAddressFor" packages/tab-genoffice/src/tabs/file-address.ts` | L84 | 生产端路径相对化 |
| `packages/tab-genoffice/src/tabs/docx-control-viewer.tsx` | GenOfficeFileTab | `rg "GenOfficeFileTab" packages/tab-genoffice/src/tabs/docx-control-viewer.tsx` | L40 | 消费端未还原 cwd |
| `packages/tab-genoffice/src/standard/client.ts` | mountSidebar / claimedExtOf | `rg "canOpen: canOpenControlAddress" packages/tab-genoffice/src/standard/client.ts` | L97 | 默认 patterns 与显式控制允许集应区分 |
| `packages/tab-genoffice/src/standard/sidebar.ts` | SidebarPaneTabProps | `rg "useSessions" packages/tab-genoffice/src/standard/sidebar.ts` | L91 | 已有会话目录 hook 类型 |
| `packages/tab-genoffice/src/tabs/genoffice.tsx` | GenOfficePanel | `rg "fileAddressFor" packages/tab-genoffice/src/tabs/genoffice.tsx` | L277 | 真实文件点击入口 |
| `packages/tab-genoffice/src/host/tool-schema.ts` | CONTROL_TOOL_TABLE | `rg "pptx_edit_table_cell" packages/tab-genoffice/src/host/tool-schema.ts` | L1028 | 工具参数、说明及 apply_ops |
| `packages/tab-genoffice/src/host/capability.ts` | CAPABILITY / isExposed | `rg "slides:edit_table_cell" packages/tab-genoffice/src/host/capability.ts` | L83 | 网页支持事实与过滤 |
| `packages/tab-genoffice/src/host/tools.ts` | executeLandPages / callRelayRetry | `rg "async function executeLandPages" packages/tab-genoffice/src/host/tools.ts` | L394 | 生成包装器公共落页路径 |
| `packages/tab-genoffice/tests/file-tab.spec.ts` | fileAddressFor suite | `rg "describe.*fileAddressFor" packages/tab-genoffice/tests/file-tab.spec.ts` | L15 | 现有路径编码与 session 回归 |
| `packages/tab-genoffice/tests/standard-facet.spec.ts` | Sidebar contract tests | `rg "sidebarRight:.*openResource" packages/tab-genoffice/tests/standard-facet.spec.ts` | L276 | 当前 fake 不能证明 SDK claim |
| `packages/tab-genoffice/tests/host-land-pages.spec.ts` | mockToolFetch | `rg "function mockToolFetch" packages/tab-genoffice/tests/host-land-pages.spec.ts` | L49 | 回归覆盖包装器 |
| `../engine/apps/slides/src/renderer/ai/slides-skill.ts` | executeSlidesTool | `rg "case 'edit_table_cell'" ../engine/apps/slides/src/renderer/ai/slides-skill.ts` | L3343 | 当前字段真实来源，只读 |
| `env/profiles/go/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js` | SidebarRightTabRegistry.claim | `rg "claim\(address, kind\)" env/profiles/go/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js` | L3475 | rc.2 真实 SDK，只读 |

### 3.4 接口影响

参数镜像修复遵循执行器现有协议；纠正错误字段会影响依赖错误声明的调用方，错误信息应给出可执行恢复方式。路径 URI 编码语法、工具名和默认保存策略保持。


本包维护已存在的工具镜像和核验，不承诺生成版本化单源 manifest，该收敛工作归效率包。更正错误参数以当前执行器为事实，避免为了兼容历史错误声明引入多个长期歧义结构。未知结果不得以自动补偿重放。

## 4. Phase 计划与任务详情

总入口：[Master handoff](../genoffice-web-roadmap/handoff.md)。未来执行由 master 连续调度本包；本包 CSV 是本包唯一任务状态源，跨包解锁须过 master gate。

先完成 control-session-safety 的状态板、真实场景与证据闸门，读取其实际协议和 host/tools.ts 改动；本包源码完成后才进入官方同步。

任务依赖按下表序号串行。跨包依赖不能由 board.py 自动推断，各包 Task 1 负责核对母包及前置证据；“可开工”不等于本轮授权执行。

实现任务 6 项；其余为基线、验收、测量或回归。所有任务均为未来执行状态。

状态板：[tasks.csv](tasks.csv)。本轮按用户要求统一为独立 CSV；本节只保留任务详情，状态不在此重复维护。

### Phase 0: 可运行起点与基线

### Task 1: 校准前置协议与真实 Sidebar 测试入口

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / INV-001 / INV-002 / INV-003 / INV-004 / EVD-005
- **前置任务**：无（仍需核对上述跨包条件）
- **风险等级**：P1

**为什么做**：核对安全包全部完成证据、当前两仓 SHA/status、实际 SDK 包版本和 canOpen 行为；在用户既有 Sidebar 迁移之上工作。

**涉及文件与定位**：

- `packages/tab-genoffice/src/standard/client.ts`：mountSidebar / claimedExtOf；`rg "canOpen: canOpenControlAddress" packages/tab-genoffice/src/standard/client.ts`；L97，行号仅 hint。
- `packages/tab-genoffice/src/standard/sidebar.ts`：SidebarPaneTabProps；`rg "useSessions" packages/tab-genoffice/src/standard/sidebar.ts`；L91，行号仅 hint。
- `packages/tab-genoffice/tests/standard-facet.spec.ts`：Sidebar contract tests；`rg "sidebarRight:.*openResource" packages/tab-genoffice/tests/standard-facet.spec.ts`；L276，行号仅 hint。
- `env/profiles/go/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js`：SidebarRightTabRegistry.claim；`rg "claim\(address, kind\)" env/profiles/go/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js`；L3475，行号仅 hint。

**具体操作**：

1. 核对安全包全部完成证据、当前两仓 SHA/status、实际 SDK 包版本和 canOpen 行为；在用户既有 Sidebar 迁移之上工作。
2. 未来新建 scripts/e2e-plugin-alignment.mjs，实现 --baseline/--case/--all/--out；用已安装真实 Sidebar SDK 和真实 GenOffice facet 启动隔离测试页面、真实 relay 与临时文件。优先真实隔离 DSH profile；必须回放官方 claim，不能用 vi.fn 假装真实宿主。
3. 记录独立端口与启动入口，消解 ASM-001；基础 harness 用真实客户端 props/context，若完整宿主不可用，保留完整 DSH 联调为未完成并报告具体缺件。对路径、显式 kind、schema 与重复追加建立失败复现。

**验证**：`node scripts/e2e-plugin-alignment.mjs --baseline` → 已知缺陷逐项确认；`npm run typecheck` → 记录基线

**Evidence**：`evidence/validation/task-1.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 2: 还原文件所属会话路径并接线错误态

- **关联**：BR-001 / BR-006 / UF-001 / INV-001 / INV-004 / EVD-001
- **前置任务**：1
- **风险等级**：P1

**为什么做**：使用地址内 session 的 cwd 还原相对路径；区分 POSIX/Windows/UNC 绝对路径语义，不用当前激活会话偷换地址归属。

**涉及文件与定位**：

- `packages/tab-genoffice/src/tabs/file-address.ts`：fileAddressFor / parseFileAddress；`rg "fileAddressFor" packages/tab-genoffice/src/tabs/file-address.ts`；L84，行号仅 hint。
- `packages/tab-genoffice/src/tabs/docx-control-viewer.tsx`：GenOfficeFileTab；`rg "GenOfficeFileTab" packages/tab-genoffice/src/tabs/docx-control-viewer.tsx`；L40，行号仅 hint。
- `packages/tab-genoffice/src/standard/sidebar.ts`：SidebarPaneTabProps；`rg "useSessions" packages/tab-genoffice/src/standard/sidebar.ts`；L91，行号仅 hint。
- `packages/tab-genoffice/src/tabs/genoffice.tsx`：GenOfficePanel；`rg "fileAddressFor" packages/tab-genoffice/src/tabs/genoffice.tsx`；L277，行号仅 hint。

**具体操作**：

1. 使用地址内 session 的 cwd 还原相对路径；区分 POSIX/Windows/UNC 绝对路径语义，不用当前激活会话偷换地址归属。
2. 接线 useSessions 元数据未到达的等待态与到达后恢复，非法地址可关闭/返回且不请求 relay。先完成真实文件行点击→改字→保存→重开纵切。

**验证**：`node scripts/e2e-plugin-alignment.mjs --case path`；`npm test` → 正确文件、跨 session、缺 cwd 与畸形地址均通过

**Evidence**：`evidence/validation/task-2.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 3: 执行 Phase 0 回归验证

- **关联**：BR-001 / BR-006 / UF-001 / INV-001 / INV-004 / EVD-005
- **前置任务**：2
- **风险等级**：P1

**为什么做**：复验路径生产/消费、默认 Office 打开和迁移兼容；记录原文件摘要与实际请求目标一致。

**涉及文件与定位**：

- `packages/tab-genoffice/src/tabs/file-address.ts`：fileAddressFor / parseFileAddress；`rg "fileAddressFor" packages/tab-genoffice/src/tabs/file-address.ts`；L84，行号仅 hint。
- `packages/tab-genoffice/src/tabs/docx-control-viewer.tsx`：GenOfficeFileTab；`rg "GenOfficeFileTab" packages/tab-genoffice/src/tabs/docx-control-viewer.tsx`；L40，行号仅 hint。
- `packages/tab-genoffice/src/tabs/genoffice.tsx`：GenOfficePanel；`rg "fileAddressFor" packages/tab-genoffice/src/tabs/genoffice.tsx`；L277，行号仅 hint。

**具体操作**：

1. 复验路径生产/消费、默认 Office 打开和迁移兼容；记录原文件摘要与实际请求目标一致。

**验证**：`npm run typecheck`；`npm test`；`node scripts/e2e-plugin-alignment.mjs --case path` → 通过

**Evidence**：`evidence/validation/task-3.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Phase 1: 按依赖扩展并验证

### Task 4: 分开默认预览与五族显式控制认领

- **关联**：BR-002 / BR-006 / UF-002 / INV-001 / INV-004 / EVD-002
- **前置任务**：3
- **风险等级**：P1

**为什么做**：保留默认 patterns 仅 Office 三族；显式 kind 的 canOpen 接受合法五族控制地址。考虑采用独立显式控制 kind，避免同 kind 扩 canOpen 后意外改变默认优先级；以真实 SDK 行为决定最小实现。

**涉及文件与定位**：

- `packages/tab-genoffice/src/tabs/docx-control-viewer.tsx`：GenOfficeFileTab；`rg "GenOfficeFileTab" packages/tab-genoffice/src/tabs/docx-control-viewer.tsx`；L40，行号仅 hint。
- `packages/tab-genoffice/src/standard/client.ts`：mountSidebar / claimedExtOf；`rg "canOpen: canOpenControlAddress" packages/tab-genoffice/src/standard/client.ts`；L97，行号仅 hint。
- `packages/tab-genoffice/src/standard/sidebar.ts`：SidebarPaneTabProps；`rg "useSessions" packages/tab-genoffice/src/standard/sidebar.ts`；L91，行号仅 hint。
- `env/profiles/go/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js`：SidebarRightTabRegistry.claim；`rg "claim\(address, kind\)" env/profiles/go/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js`；L3475，行号仅 hint。

**具体操作**：

1. 保留默认 patterns 仅 Office 三族；显式 kind 的 canOpen 接受合法五族控制地址。考虑采用独立显式控制 kind，避免同 kind 扩 canOpen 后意外改变默认优先级；以真实 SDK 行为决定最小实现。
2. 接线 SSE file/session 过滤、openResource(kind)、GenOfficeFileTab；合法 open 失败传回 UI/agent，可恢复而不吞异常。

**验证**：`node scripts/e2e-plugin-alignment.mjs --case claim` → 默认 md/pdf 宿主预览，五族显式打开成功，跨 session 不误开

**Evidence**：`evidence/validation/task-4.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 5: 对齐 PPT 表格图表字段与能力说明

- **关联**：BR-003 / BR-006 / UF-003 / INV-003 / EVD-003
- **前置任务**：4
- **风险等级**：P1

**为什么做**：逐字段比对 edit_table_cell/structure/style/edit_chart 的 required、枚举、嵌套结构与 executeSlidesTool；更正 row/col/paragraphs、kind/index/before 及顶层样式/图表参数。

**涉及文件与定位**：

- `packages/tab-genoffice/src/host/tool-schema.ts`：CONTROL_TOOL_TABLE；`rg "pptx_edit_table_cell" packages/tab-genoffice/src/host/tool-schema.ts`；L1028，行号仅 hint。
- `packages/tab-genoffice/src/host/capability.ts`：CAPABILITY / isExposed；`rg "slides:edit_table_cell" packages/tab-genoffice/src/host/capability.ts`；L83，行号仅 hint。
- `../engine/apps/slides/src/renderer/ai/slides-skill.ts`：executeSlidesTool；`rg "case 'edit_table_cell'" ../engine/apps/slides/src/renderer/ai/slides-skill.ts`；L3343，行号仅 hint。

**具体操作**：

1. 逐字段比对 edit_table_cell/structure/style/edit_chart 的 required、枚举、嵌套结构与 executeSlidesTool；更正 row/col/paragraphs、kind/index/before 及顶层样式/图表参数。
2. 只对已实际可执行的工具移除错误桌面限制说明，逐个真实调用；保留未开放能力及资产过滤，错误给字段级恢复办法。

**验证**：`node scripts/e2e-plugin-alignment.mjs --case ppt-schema`；`npm test` → 所有修正参数真实执行并重开保留

**Evidence**：`evidence/validation/task-5.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 6: 补齐批量编辑定位单位和事务用法

- **关联**：BR-004 / BR-006 / UF-003 / INV-003 / EVD-003
- **前置任务**：5
- **风险等级**：P1

**为什么做**：从现执行器同步 opVocabulary、target/durable ID、EMU 换算及 dry_run/上限说明，不复制与 op 不同的像素参数假设。

**涉及文件与定位**：

- `packages/tab-genoffice/src/host/tool-schema.ts`：CONTROL_TOOL_TABLE；`rg "pptx_edit_table_cell" packages/tab-genoffice/src/host/tool-schema.ts`；L1028，行号仅 hint。
- `../engine/apps/slides/src/renderer/ai/slides-skill.ts`：executeSlidesTool；`rg "case 'edit_table_cell'" ../engine/apps/slides/src/renderer/ai/slides-skill.ts`；L3343，行号仅 hint。

**具体操作**：

1. 从现执行器同步 opVocabulary、target/durable ID、EMU 换算及 dry_run/上限说明，不复制与 op 不同的像素参数假设。
2. 按说明生成最小 dry_run 与正式 op，核对位置及保存重开；非法 ID、0/超 50 op、未知 op 验证无部分事务修改。

**验证**：`node scripts/e2e-plugin-alignment.mjs --case apply-ops`；`npm run typecheck` → 单位、定位、dry_run 和失败事务通过

**Evidence**：`evidence/validation/task-6.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 7: 移除落页包装器自动写入重放

- **关联**：BR-005 / BR-006 / UF-004 / INV-002 / INV-004 / EVD-004
- **前置任务**：6
- **风险等级**：P1

**为什么做**：executeLandPages 改为单次写调用并保留 abort；三个包装器共用相同语义，只读 settle 可继续，但 timeout 不新建 call ID 重发。

**涉及文件与定位**：

- `packages/tab-genoffice/src/host/tools.ts`：executeLandPages / callRelayRetry；`rg "async function executeLandPages" packages/tab-genoffice/src/host/tools.ts`；L394，行号仅 hint。
- `packages/tab-genoffice/tests/host-land-pages.spec.ts`：mockToolFetch；`rg "function mockToolFetch" packages/tab-genoffice/tests/host-land-pages.spec.ts`；L49，行号仅 hint。

**具体操作**：

1. executeLandPages 改为单次写调用并保留 abort；三个包装器共用相同语义，只读 settle 可继续，但 timeout 不新建 call ID 重发。
2. 把执行后回执丢失区分为结果未知，提示先读页数/文本；测试写前断线、写后超时、取消，真实网络记录只含一次落页请求。

**验证**：`node scripts/e2e-plugin-alignment.mjs --case no-replay`；`npm test` → 三个包装器最多一次写请求

**Evidence**：`evidence/validation/task-7.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 8: 扩展兼容校验到真实字段与错误反馈

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / UF-001 / UF-002 / UF-003 / UF-004 / EVD-005
- **前置任务**：7
- **风险等级**：P1

**为什么做**：在现有测试/契约检查中覆盖字段、枚举、说明、capability 和执行结果；故意恢复旧字段必须触发失败，不写只比工具名的镜像测试。

**涉及文件与定位**：

- `packages/tab-genoffice/src/host/tool-schema.ts`：CONTROL_TOOL_TABLE；`rg "pptx_edit_table_cell" packages/tab-genoffice/src/host/tool-schema.ts`；L1028，行号仅 hint。
- `packages/tab-genoffice/src/host/capability.ts`：CAPABILITY / isExposed；`rg "slides:edit_table_cell" packages/tab-genoffice/src/host/capability.ts`；L83，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：executeLandPages / callRelayRetry；`rg "async function executeLandPages" packages/tab-genoffice/src/host/tools.ts`；L394，行号仅 hint。
- `packages/tab-genoffice/tests/standard-facet.spec.ts`：Sidebar contract tests；`rg "sidebarRight:.*openResource" packages/tab-genoffice/tests/standard-facet.spec.ts`；L276，行号仅 hint。
- `../engine/apps/slides/src/renderer/ai/slides-skill.ts`：executeSlidesTool；`rg "case 'edit_table_cell'" ../engine/apps/slides/src/renderer/ai/slides-skill.ts`；L3343，行号仅 hint。
- `env/profiles/go/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js`：SidebarRightTabRegistry.claim；`rg "claim\(address, kind\)" env/profiles/go/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js`；L3475，行号仅 hint。

**具体操作**：

1. 在现有测试/契约检查中覆盖字段、枚举、说明、capability 和执行结果；故意恢复旧字段必须触发失败，不写只比工具名的镜像测试。
2. 把本包已完成声明和实际 engine SHA 作为官方同步的校准基线；由后续同步包重新核验新增或变动工具。

**验证**：`npm run typecheck`；`npm test`；`npm run build`；`npm run standard:check`；`node scripts/e2e-plugin-alignment.mjs --case contract` → 声明差异能被检测且真实调用通过

**Evidence**：`evidence/validation/task-8.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 9: 执行 spec 5.2 真实场景全套测试

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / UF-001 / UF-002 / UF-003 / UF-004 / INV-001 / INV-002 / INV-003 / INV-004 / EVD-001 / EVD-002 / EVD-003 / EVD-004
- **前置任务**：8
- **风险等级**：P1

**为什么做**：按第 5.2 节完整矩阵回放真实 SDK/Sidebar、插件工具、relay、浏览器和磁盘；至少两个 cwd/session，五族打开及 PPT 全部修正操作；截图与实际请求字段配对保存。

**涉及文件与定位**：

- `packages/tab-genoffice/src/tabs/docx-control-viewer.tsx`：GenOfficeFileTab；`rg "GenOfficeFileTab" packages/tab-genoffice/src/tabs/docx-control-viewer.tsx`；L40，行号仅 hint。
- `packages/tab-genoffice/src/standard/client.ts`：mountSidebar / claimedExtOf；`rg "canOpen: canOpenControlAddress" packages/tab-genoffice/src/standard/client.ts`；L97，行号仅 hint。
- `packages/tab-genoffice/src/host/tool-schema.ts`：CONTROL_TOOL_TABLE；`rg "pptx_edit_table_cell" packages/tab-genoffice/src/host/tool-schema.ts`；L1028，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：executeLandPages / callRelayRetry；`rg "async function executeLandPages" packages/tab-genoffice/src/host/tools.ts`；L394，行号仅 hint。
- `env/profiles/go/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js`：SidebarRightTabRegistry.claim；`rg "claim\(address, kind\)" env/profiles/go/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js`；L3475，行号仅 hint。

**具体操作**：

1. 按第 5.2 节完整矩阵回放真实 SDK/Sidebar、插件工具、relay、浏览器和磁盘；至少两个 cwd/session，五族打开及 PPT 全部修正操作；截图与实际请求字段配对保存。

**验证**：`node scripts/e2e-plugin-alignment.mjs --all` → 每个主路径及失败分支通过

**Evidence**：`evidence/validation/task-9.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 10: 执行 Phase 1 回归验证

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / INV-001 / INV-002 / INV-003 / INV-004 / EVD-005
- **前置任务**：9
- **风险等级**：P1

**为什么做**：完成项目 validators，回放安全包在本文件的 readiness/revision/保存接入；不覆盖用户构建前已有变更，证据闸门通过后交给官方同步。

**涉及文件与定位**：

- `packages/tab-genoffice/src/host/tool-schema.ts`：CONTROL_TOOL_TABLE；`rg "pptx_edit_table_cell" packages/tab-genoffice/src/host/tool-schema.ts`；L1028，行号仅 hint。
- `packages/tab-genoffice/src/host/capability.ts`：CAPABILITY / isExposed；`rg "slides:edit_table_cell" packages/tab-genoffice/src/host/capability.ts`；L83，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：executeLandPages / callRelayRetry；`rg "async function executeLandPages" packages/tab-genoffice/src/host/tools.ts`；L394，行号仅 hint。

**具体操作**：

1. 完成项目 validators，回放安全包在本文件的 readiness/revision/保存接入；不覆盖用户构建前已有变更，证据闸门通过后交给官方同步。

**验证**：`npm run typecheck`；`npm test`；`npm run build`；`npm run standard:check`；`node ../engine/web/e2e-control-session.mjs --case plugin-state`；`python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/plugin-tool-alignment --repo .` → 全通过

**Evidence**：`evidence/validation/task-10.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

## 5. 验收与 Review 协议

### 5.1 命令级验证

本轮仅运行包结构/源码锚点/状态板/视图校验。下列业务命令是未来执行闸门；命令级通过之后仍须运行第 5.2 节。

| 验证项 | 命令（插件仓根） | 期望 |
|---|---|---|
| 本轮规格 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/plugin-tool-alignment --repo .` | 退出 0；规格必须 0 FAIL |
| 本轮状态 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/board.py docs/plugin-tool-alignment --json` | 全部任务待开始；后续实施由事实更新 |
| 本轮视图 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/render_spec.py docs/plugin-tool-alignment` | 退出 0；规格必须 0 FAIL |
| 插件类型 | `npm run typecheck` | 退出 0；规格必须 0 FAIL |
| 插件测试 | `npm test` | 退出 0；规格必须 0 FAIL |
| 插件构建 | `npm run build` | 退出 0；规格必须 0 FAIL |
| 标准契约 | `npm run standard:check` | 退出 0；规格必须 0 FAIL |

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
| 验证入口 | `node scripts/e2e-plugin-alignment.mjs --all`；这是 Task 1 要新增的真实回放脚本，本轮未创建。默认 relay 地址为上述隔离端口，提供 `--out` 指向本包 evidence；逐项 `--case` 名称见任务验证行，全部必须由创建任务实现。 |

**执行矩阵**：每行归档实际 request/response、console/server 输出、network 与截图；预期故障单独标注，不能吞掉非预期错误。result.json 必须枚举全部适用 app/入口/能力子例、成功断言、失败断言、恢复结果及输出文件清单，不允许只写一个总 pass。

| UF | 执行方式 | 操作来源 | 必须核对的点 | Evidence |
|---|---|---|---|---|
| UF-001 主路径 | browser + 公开 API + 真实磁盘 | 第 2.3 节 UF-001 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-001/success/result.json`、`evidence/UF-001/success/console.log`、`evidence/UF-001/success/network.json`、`evidence/UF-001/success/screenshot.png` |
| UF-001 失败分支：缺少会话 cwd | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：相对地址对应 session 目录数据未到达或不存在 | 不发相对路径请求，不借用其他会话 cwd；恢复：元数据到达后正常加载；不可恢复时用户返回目录；恢复后重走成功路径 | `evidence/UF-001/failure-1/result.json`、`evidence/UF-001/failure-1/console.log`、`evidence/UF-001/failure-1/network.json`、`evidence/UF-001/failure-1/screenshot.png` |
| UF-001 失败分支：非法地址 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：编码错误、非文件 URI、空路径 | 不发送 /api/control/open 和 /api/file；恢复：返回目录重新点击有效文件；恢复后重走成功路径 | `evidence/UF-001/failure-2/result.json`、`evidence/UF-001/failure-2/console.log`、`evidence/UF-001/failure-2/network.json`、`evidence/UF-001/failure-2/screenshot.png` |
| UF-002 主路径 | browser + 公开 API + 真实磁盘 | 第 2.3 节 UF-002 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-002/success/result.json`、`evidence/UF-002/success/console.log`、`evidence/UF-002/success/network.json`、`evidence/UF-002/success/screenshot.png` |
| UF-002 失败分支：不支持地址或格式 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：显式打开 txt 或畸形 URI | 不在 GenOffice 内创建错误编辑页；恢复：用户使用宿主预览或有效文件；恢复后重走成功路径 | `evidence/UF-002/failure-1/result.json`、`evidence/UF-002/failure-1/console.log`、`evidence/UF-002/failure-1/network.json`、`evidence/UF-002/failure-1/screenshot.png` |
| UF-002 失败分支：事件属于另一会话 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：session A 页面收到 B 的 open | 保持 fileOpenOnThisPage 的会话过滤；恢复：B 的真实页面处理；不存在时 open 回报未就绪；恢复后重走成功路径 | `evidence/UF-002/failure-2/result.json`、`evidence/UF-002/failure-2/console.log`、`evidence/UF-002/failure-2/network.json`、`evidence/UF-002/failure-2/screenshot.png` |
| UF-003 主路径 | browser + 公开 API + 真实磁盘 | 第 2.3 节 UF-003 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-003/success/result.json`、`evidence/UF-003/success/console.log`、`evidence/UF-003/success/network.json`、`evidence/UF-003/success/screenshot.png` |
| UF-003 失败分支：字段或元素非法 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：非法 row/col、缺少段落或不存在 ID | 不伪装成功，现有事务语义保持；恢复：重新读取上下文并按正确字段调用；恢复后重走成功路径 | `evidence/UF-003/failure-1/result.json`、`evidence/UF-003/failure-1/console.log`、`evidence/UF-003/failure-1/network.json`、`evidence/UF-003/failure-1/screenshot.png` |
| UF-003 失败分支：op 无效或超限 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：未知 op、零 op、超过 50 个 | dry_run 与 atomic 失败不落下部分改动；恢复：缩小批次或更正 op 后 dry_run；恢复后重走成功路径 | `evidence/UF-003/failure-2/result.json`、`evidence/UF-003/failure-2/console.log`、`evidence/UF-003/failure-2/network.json`、`evidence/UF-003/failure-2/screenshot.png` |
| UF-004 主路径 | browser + 公开 API + 真实磁盘 | 第 2.3 节 UF-004 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-004/success/result.json`、`evidence/UF-004/success/console.log`、`evidence/UF-004/success/network.json`、`evidence/UF-004/success/screenshot.png` |
| UF-004 失败分支：执行后回执超时 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：引擎已追加但响应被截断 | 不生成新 call ID 重放写入；恢复：重新读取页数/文字，确认后显式保存；恢复后重走成功路径 | `evidence/UF-004/failure-1/result.json`、`evidence/UF-004/failure-1/console.log`、`evidence/UF-004/failure-1/network.json`、`evidence/UF-004/failure-1/screenshot.png` |
| UF-004 失败分支：写入前断线或取消 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：请求没有到达执行器或用户 abort | 不自动重放；保留信号取消语义；恢复：恢复连接并先读上下文，再由调用方决定新操作；恢复后重走成功路径 | `evidence/UF-004/failure-2/result.json`、`evidence/UF-004/failure-2/console.log`、`evidence/UF-004/failure-2/network.json`、`evidence/UF-004/failure-2/screenshot.png` |

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
