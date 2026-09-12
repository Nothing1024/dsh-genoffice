# web-runtime-efficiency Spec

> Version: 0.3.0 | Date: 2026-09-12 | Status: Ready 可执行（仅规格，尚未实施）
>
> 本文件是本包唯一事实源。本轮只生成与校验；此包未来实施依赖状态安全、插件契约、官方同步与 Web 功能完成，不重复修改前置包收敛的控制协议。

## 0. 一页纸人话摘要

- 让 GenOffice 启动更直接、agent 调用更轻，并让 DSH 之外的 agent 不用先请用户打开编辑器页面。
- 先测冷启动、打开、读取、编辑、保存的真实耗时和传输量，再消除重复读文件和无关工具声明。
- 把网页构建与运行分开，只有请求的文档应用真正可用才报告就绪；构建齐全时也能检查整套是否就绪。
- 通过现有 HTTP 和事件流协议提供可复用客户端与命令入口，按需启动受控的无界面浏览器执行器。
- 功能和文档保存行为保持一致；任何性能结果都附前后相同条件的测量，不预报未经测量的收益。
- 不再造编辑引擎、不重新实现前置包的状态保护，也不改变默认只在本机服务和显式保存的行为。

## 1. 事实基线与假设

### 1.1 需求与运行模式

| 项 | 结论 |
|---|---|
| 原始需求 | 用户希望魔改上游干练、高效、其他 agent 更好支持，插件与上游契合，并授权多套 oneclick 包 |
| 输入类型 | description，前序 review 与本次磁盘勘察 |
| Mode | oneclick；本轮只生成任务包并运行校验，业务任务留待未来执行；交接统一使用母包 handoff |
| 置信度 | 高；性能目标待真实基线校准，标 ASM-001 |
| 输出目录 | `docs/web-runtime-efficiency/` |
| 路径基准 | 插件仓库根；魔改上游为 `../engine/` |

### 1.2 任务类型路由

| 维度 | 结论 |
|---|---|
| 任务类型 | performance + refactor + backend + infra |
| 主要风险 | 优化绕过版本/保存保护、工具族动态发现不兼容、headless 抢占可视会话、误报 readiness |
| 行号引用策略 | symbol + rg 为主，前置包落地后重验位置 |
| 必需验收方式 | 相同数据/版本/硬件的 benchmark、真实 CLI/API、浏览器接管、进程退出与资源释放 |
| 必须覆盖用户场景 | build/serve/每 app readiness、按族发现工具、其他 agent 独立编辑保存、可视会话复用 |

### 1.3 勘察事实清单

| 事实 | 来源命令 | 输出摘要 |
|---|---|---|
| 现有两仓边界清楚 | `cat README.md package.json ../engine/package.json` | 插件 host 工具和 Sidebar；engine relay + renderer；已有 HTTP/SSE 控制 |
| 默认启动包含构建 | `cat ../engine/package.json` | web 命令依次构建 shell/docs/markdown 再启动 node web/server.mjs；没有独立全应用 build/serve 脚本 |
| 就绪目前只检查任一静态根 | `sed -n '180,210p' ../engine/web/server.mjs`；`sed -n '536,554p' ../engine/web/server.mjs` | findStaticRoots 列六个 root；health.ready=live.length>0，无每 app 依赖完备判断 |
| 五族 mtime 捕获会再次请求全文件 | `rg "captureMtime|/api/file" ../engine/apps/docs/src/renderer/control.ts ../engine/apps/markdown/src/renderer/control.ts ../engine/apps/sheets/src/renderer/control.ts ../engine/apps/slides/src/renderer/control.ts ../engine/apps/pdf/src/renderer/control.ts` | 每族 captureMtime 调 GET /api/file 并仅读 mtimeMs；前置包后需重新核验是否已消除 |
| 文件端点返回内容与元信息 | `rg "const data = await readFile|mtimeMs|base64" ../engine/web/server.mjs` | GET /api/file 读完整数据并返回 base64/mtime；保存成功已有 mtime 回执 |
| 所有工具一次组装 | `rg "createControlTools|createOpenTools|allTools" packages/tab-genoffice/src/host/tools.ts`；`rg "CONTROL_TOOL_TABLE|ControlToolEntry" packages/tab-genoffice/src/host/tool-schema.ts` | createControlTools 遍历静态表并按 capability 注册；现默认并非按当前文档族发现 |
| 已有能力消费层可复用 | `rg "export function capabilityOf|isExposed" packages/tab-genoffice/src/host/capability.ts` | capabilityOf/isExposed 可作为前置契约版本迁移的消费点 |
| 现启动脚本直接运行 relay | `rg "spawn|web/server.mjs|health" scripts/dev.mjs packages/tab-genoffice/src/host/relay-launch.ts` | start-relay 启动 node server；host health 只认 overall ready |
| 独立文件打开脚本已存在 | `rg --files ../engine/web -g '*open*'`；`cat ../engine/package.json` | web/open.mjs、npm run open；现入口用于浏览器打开文件，不等于独立工具客户端 |
| 纯转换包和事务边界已存在 | `rg "Pure-function|convertPdfToDocx|convertPdfToPptx|convertPdfToXlsx" ../engine/packages/pdf2docx/src/index.ts`；`rg "runTxn" ../engine/apps/slides/src/renderer/web-bridge.ts` | bytes 转换包和 Slides runTxn 可复用，不能再复制算法层 |
| 真实浏览器环境可用 | `node -e 'const {chromium}=require("playwright"); const fs=require("node:fs"); console.log(JSON.stringify({playwright:require.resolve("playwright"),browserExists:fs.existsSync(chromium.executablePath())}))'`（engine cwd） | playwright 在 node_modules，Chromium executable 存在 |
| 真实验证脚本存在 | `rg --files ../engine/web -g '*e2e*' -g '*test*'` | home/cross-app/open-save/url-open、write-atomic.test 和 smoke 可沿用扩展 |
| 环境版本已核实 | `node --version`；`npm --version` | Node v22.23.2，npm 10.9.8 |

### 1.4 假设清单

| 假设 ID | 内容 | 风险 | 确认方式 |
|---|---|---|---|
| ASM-001 | 性能目标以 P0 相同条件测量后写入；必须确保不存在 mtime 第二次整文件传输、serve 隐式构建和按族模式的无关 schema；前置包已消除的项只回归 | 随意预设毫秒收益不可信 | P0 记录样本规模/重复数/硬件/版本/冷暖定义，校准后按变更协议消解 |
| ASM-002 | 前置安全包负责 revision/owner/会话状态和五族 control 共享化；本包只接入既有模块 | 重复实现协议、修改互相覆盖 | P0 检查前置证据与当前导出，迁移定位后再实施 |
| ASM-003 | 外部 agent 首先交付可复用客户端 SDK + CLI；若宿主已有 MCP 工具入口再做薄适配，不额外创造第二套传输协议 | 硬加 MCP 依赖或宿主动态工具能力不足 | P0 核查已安装依赖/DSH 工具发现接口；保留兼容模式并记录取舍 |
| ASM-004 | 无界面执行器使用已安装 Chromium、按文档会话复用，有限并发和空闲退出；具体资源上限由基线确定 | 资源泄漏、与可视页面竞争执行权 | P0 测单会话内存和冷启动，依据安全包 owner 协议选择/复用 |

### 1.6 质量记录

本轮只生成完整任务规格并校验；不对性能收益或功能完成作未验证声明。完整校验记录见 evidence/package-validation/；源码与用户既有改动保留。

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
| BR-001 | 每项优化使用相同 fixture/环境/版本的前后基线，记录冷启动、open/context/edit/save 延迟、请求字节和进程资源；不得虚构收益 | 两次同条件测量附原始数据及分位数 | 只报告源码行数减少就称明显加速 | benchmark | UF-001、UF-004 |
| BR-002 | 文件加载时获得可绑定该字节版本的元信息，后续保存沿统一状态合同使用；不得仅为 mtime 再读取整文件 | 首次 open 一次内容传输，保存不追加全文件 GET | 用 stat 替换后却丢失版本一致性 | relay/文件加载/共享控制适配 | UF-001 |
| BR-003 | build 与 serve 可分别运行，serve 不隐式构建；health 区分存活、各 app 构建与运行依赖就绪，整套就绪必须覆盖所有宣称 app | 缺 sheets build 时 sheets 不就绪，其他已就绪 app 可用 | 只有 shell 就 overall ready 误认全可用 | package scripts/relay/launcher | UF-002 |
| BR-004 | 工具及能力声明有版本，本包从已对齐的执行器与插件声明建立单源，以前置契约为校准依据；按文档族请求只传该族及公共入口，不偷偷漏必要工具；旧宿主可用兼容模式 | 打开 xlsx 发现完整 sheets 工具，切 pptx 更新清单 | 模型同时收到所有无关 schema 或参数版本错配 | engine manifest/plugin/tool client | UF-003 |
| BR-005 | 非 DSH agent 用同一 HTTP+SSE 合同完成 open→context→edit→save→reopen，无需人工先开 DSH 页面 | CLI 独立打开临时 md，修改保存重开 | 接口返回 executor not registered 后让用户开页 | 客户端/CLI/headless manager | UF-004 |
| BR-006 | 无界面执行器按会话复用并尊重 owner，已有可视执行器时不得抢占；失败/取消/空闲退出释放资源且不丢未保存内容 | 同文件重复 open 复用会话，可视接管有明确版本交接 | 每次 open 新页或关闭带未保存改动的唯一页 | executor manager/状态合同 | UF-004 |
| BR-007 | 共享纯算法只保留一份；本包不重新分叉前置包共用 control，客户端只负责传输/发现/生命周期 | 多 adapter 调同一保存和事务接口 | SDK 再写一套编辑模型或独立 dirty | engine/module/plugin 边界 | UF-001、UF-004 |

### 2.2 UF 用户验收场景（索引）

| 场景 ID | Given | When | Then | 角色 | 验证方式 | Evidence |
|---|---|---|---|---|---|---|
| UF-001 | 固定数据和真实 relay | 测打开、读、改、保存前后表现 | 请求次数/字节有证据，内容与冲突保护不变 | 开发者/agent | benchmark + HTTP + reopen | EVD-001 |
| UF-002 | 已构建与缺构建两组目录 | 单独启动服务并请求各 app | 无隐式 build，readiness 准确且恢复可用 | 部署者/用户 | CLI + HTTP + browser | EVD-002 |
| UF-003 | 版本匹配的引擎和插件/客户端 | 按文档族发现与执行工具再切换 | schema 范围和参数准确，版本错配前置拒绝 | DSH/外部 agent | discovery API + true tool calls | EVD-003 |
| UF-004 | 无 DSH 页面的服务环境 | 外部 CLI 完成文档编辑保存，并接入可视页 | 自动取得正确执行器，内容持久化且资源可回收 | 外部 agent/浏览器用户 | CLI + browser + process stats | EVD-004 |

### 2.3 核心业务流程（步骤级交互脚本）

#### UF-001: 真实测量和无重复读取

**前置状态**：五族及同步后 HTML 的自造小/中/大 fixture；同一机器固定版本、冷暖定义和重复次数由 P0 记录。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 运行基线用例，从公开入口打开文档 | 报告 loading/ready 和测量进度 | 记录请求、耗时、资源及加载版本 | 有原始逐次数据 |
| 2 | 读取/编辑/保存并重开 | 输出调用状态和保存路径 | 使用加载回执版本，无 mtime-only 全文件读取 | 文档内容正确、无额外全文件传输 |
| 3 | 在相同条件运行优化后测量 | 输出前后结果 | 对照分位数、字节、资源和正确性 | 能判断收益与回归，不夸大数值 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 文件外部变化 | 加载后外部改文件 | 保存返回冲突，dirty 保留 | 保留版本保护不靠重读覆盖 | 重读并显式合并/另存 |
| 测量条件不一致 | fixture/版本/缓存状态变化 | 报告不可比较 | 不混用样本、不标性能通过 | 复原条件后重测 |

**界面状态机**：CLI `preparing → measuring → comparing → passed / invalid-run`；文档状态沿前置安全合同。

**入口接线清单**：现有 Web 打开/控制 API → 统一文件加载/元信息 → 显式保存；benchmark 从公开入口调用并采集，不直调内部函数替代业务路径。

#### UF-002: 构建与运行分离及就绪探测

**前置状态**：隔离 relay 端口；一组完整构建、一组故意缺 app 构建或服务依赖的测试目录。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 显式构建后单独启动 serve | 输出启动地址和 app 就绪信息 | 只启动运行时，不触发构建 | 启动日志可核对 |
| 2 | 请求 health、打开指定 app | 展示请求 app 状态 | 检查该 app 静态资源和所需依赖 | 可用 app 正常打开 |
| 3 | 重启同一完整部署并测冷启动 | 显示服务可用状态 | 复用构建产物 | 冷启动结果与实际资源就绪一致 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 目标 app 缺构建 | 删除隔离副本某 app index | 目标 app 显示未就绪与构建要求 | 不把其他 app 的 ready 当目标 ready | 补构建后重新探测 |
| 原生服务缺依赖 | sidecar/打印 provider 不可用 | 显示具体依赖状态 | 存活探测仍可用，受影响能力禁提交 | 启动依赖后就绪恢复 |

**界面状态机**：`stopped → starting → live(app: ready / missing-build / missing-dependency)`；修复后按 app 重探测。

**入口接线清单**：engine package scripts → web/server → health；插件 start-relay/Sidebar 状态消费每 app 信息；浏览器路由打开前核对目标 readiness。

#### UF-003: 版本化按族工具发现

**前置状态**：前置插件契约已完成参数镜像对齐，本包已建立版本化单源；一组匹配版本、一组旧版本客户；真实五族工具样例。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | agent 发现能力并选择 xlsx | 返回版本/就绪/族信息 | 从单源 manifest 装载该族工具 | 只收到必要公共和 xlsx schema |
| 2 | 按 schema 读取和编辑真实工作簿 | 返回规范结果 | 参数及能力版本一致 | 调用成功且文件语义正确 |
| 3 | 切换 pptx 或使用兼容宿主 | 明确当前族/兼容范围 | 更新该族清单或兼容完整表 | 工具可发现且不失去必要入口 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 版本不兼容 | 客户 schema revision 不受支持 | 开始前返回版本及恢复建议 | 不执行未知参数写操作 | 刷新 manifest/用兼容版本 |
| 族或依赖不可用 | 未知 app、该族 provider 不就绪 | 明确 unsupported/dependency 状态 | 不编造 schema 或静默回退其他 app | 切到支持族/恢复服务 |

**界面状态机**：`discovering → compatible → family-loaded → calling`；`discovering → incompatible`；`family-loaded → dependency-missing`。

**入口接线清单**：engine 单源能力输出 → plugin createControlTools/外部客户端发现入口 → 按族装载 → HTTP 工具调用；宿主不支持动态时保持显式兼容模式。

#### UF-004: 外部 agent 独立闭环与执行器生命周期

**前置状态**：不打开 DSH/编辑器页；真实 relay、临时文件和浏览器运行时；按前置状态安全契约配置会话所有权。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 外部 CLI/SDK 发送 open | 输出 starting/loading/ready | 复用已有合适执行器，否则按需启动受控页面 | 无人工开页就获得 ready 会话 |
| 2 | context→edit→save→reopen | 返回版本、内容与真实路径 | 使用现 HTTP/SSE 和前置禁止自动重放与保存协议 | 磁盘重开内容正确 |
| 3 | 打开可视页、再次请求同文件 | 显示已有会话/接管结果 | 按 owner 复用/交接，不互相抢注册 | UI 与 CLI 看到一致版本 |
| 4 | 显式关闭或空闲回收 | 输出会话释放/保留 dirty 原因 | 释放已保存会话；未保存状态保留或先显式处置 | 页数、进程与内存无持续泄漏 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 浏览器缺失/崩溃 | 启动失败或运行时退出 | 明确 runtime 错误和保存状态 | 清理半初始化注册，不无限重试写入 | 修复运行时并重新 open |
| 冲突/资源上限 | 同文件有效 owner、并发超过上限 | 返回等待/冲突/繁忙及当前状态 | 不抢 owner、不杀 dirty 会话 | 等释放、显式接管或重读后继续 |

**界面状态机**：`absent → spawning → loading → ready → busy → idle → released`；`spawning/loading → failed`；`ready → visible-handoff`；`dirty → retained`。

**入口接线清单**：新增公开 SDK/CLI 入口（实际路径由 P0 根据仓库风格确定）→ 已有 /api/control/open/context/tool/export → executor manager → 无界面或可视 Web renderer；客户端不自建编辑模型。

### 2.4 INV 不变量

| 不变量 ID | 内容 | 关联 BR/UF | 验证方式 |
|---|---|---|---|
| INV-001 | 不降低前置包 ready/revision/owner/禁止自动重放/原子保存保护，默认仍显式保存 | BR-002、BR-005、BR-006 | 前置竞争/丢回执/保存冲突场景重放 |
| INV-002 | 维持默认本机监听和路径/来源/网络边界，headless 不扩大文件或网络访问许可 | BR-003、BR-005 | 权限负例与恶意 URL |
| INV-003 | 已有 DSH 工具名及正常可视浏览器路径保持兼容，按族发现需显式能力协商 | BR-004、BR-006 | 旧客户端与现 Sidebar E2E |
| INV-004 | 不复制纯算法或统一 control，不预报未经测量的性能收益 | BR-001、BR-007 | import 检查和原始 benchmark 证据 |

### 2.5 EVD 证据清单

| 证据 ID | 类型 | 期望证据 | 保存位置 |
|---|---|---|---|
| EVD-001 | benchmark/API/file | 原始样本、前后汇总、请求字节与正确性/冲突结果 | `evidence/UF-001/` |
| EVD-002 | CLI/API/browser | build/serve 日志、完整/缺构建/缺依赖 health、路由截图 | `evidence/UF-002/` |
| EVD-003 | schema/API | 按族与兼容 manifest、字节统计、真实调用及错版本结果 | `evidence/UF-003/` |
| EVD-004 | CLI/browser/process | 无 DSH 闭环、可视交接、崩溃与资源上限、进程清理 | `evidence/UF-004/` |
| EVD-005 | baseline/log | 前置包完成证据、固定 SHA、模块定位、依赖与测量协议 | `evidence/phase-0/` |

### 2.6 角色与权限矩阵

无新增业务权限角色；SDK、CLI、DSH 和浏览器共享同一 relay 权限。无界面执行器只是受控运行时，不获得超出已授权文档范围的能力。

### 2.7 负向 / 破坏性场景

跨流程验收：旧 manifest + 新引擎、前置状态包升级后旧 SDK、多客户端同文件、无界面退出前未保存编辑、资源不足与启动取消、静态根移动后 health 恢复；均须保留错误与恢复证据。

### 2.8 非目标

本包不再次重写五族 control 或文档算法，不做第三套编辑模型，不部署远程公开服务，不凭未验证指标追求任意体积或速度目标。Web 功能与官方新增功能由前置包实现。

## 3. 技术方案

### 3.1 架构 Before / After

```text
Before: DSH 全量工具 → relay → 用户已打开的 renderer；启动与 build 混合
After:  DSH / SDK / CLI → 版本化按族能力 → 同一 relay 会话合同
                                               → 可视 renderer 复用
                                               → 按需 headless renderer
        build 产物 → 独立 serve → 每 app / 整套 readiness
```

### 3.2 模块改造

文件版本复用前置加载响应；build/serve 与每 app readiness 分开；本包建立版本化能力/schema 单源并提供按族发现；SDK/CLI 只编排公开控制协议，执行器管理负责 headless 复用、可视所有权与资源回收。共享算法和编辑模型保留前置实现。

### 3.3 三段式定位清单

| 文件 | 稳定定位 | 搜索定位 | 行号 hint | 备注 |
|---|---|---|---|---|
| `../engine/package.json` | web / web:build / web:serve | `rg "\"web:serve\":" ../engine/package.json` | L33 | 校准名：`web` 保持兼容默认；`web:build` 全 app；`web:serve` 纯运行 |
| `../engine/web/server.mjs` | findStaticRoots | `rg "function findStaticRoots" ../engine/web/server.mjs` | L186 | 每 app 静态 readiness |
| `../engine/web/server.mjs` | handleApi | `rg "async function handleApi" ../engine/web/server.mjs` | L540 | health/file/control 协议承载 |
| `../engine/apps/markdown/src/renderer/control.ts` | captureMtime | `rg "captureMtime" ../engine/apps/markdown/src/renderer/control.ts` | L225 | 仅标现基线；安全包后改用其共享适配，不重复重构 |
| `packages/tab-genoffice/src/host/tools.ts` | createControlTools | `rg "export function createControlTools" packages/tab-genoffice/src/host/tools.ts` | L455 | 按族发现消费点 |
| `packages/tab-genoffice/src/host/tool-schema.ts` | CONTROL_TOOL_TABLE | `rg "export const CONTROL_TOOL_TABLE" packages/tab-genoffice/src/host/tool-schema.ts` | L72 | 现有 schema，版本化单源由本包建立 |
| `packages/tab-genoffice/src/host/capability.ts` | capabilityOf | `rg "export function capabilityOf" packages/tab-genoffice/src/host/capability.ts` | L121 | 版本能力消费 |
| `packages/tab-genoffice/src/host/relay-launch.ts` | spawnRelay | `rg "async function spawnRelay" packages/tab-genoffice/src/host/relay-launch.ts` | L48 | 宿主 readiness 适配 |
| `scripts/dev.mjs` | start-relay | `rg "web/server.mjs" scripts/dev.mjs` | L72 | 独立启动现入口 |
| `../engine/web/open.mjs` | 浏览器打开脚本 | `rg "browser" ../engine/web/open.mjs` | L1 | 扩 CLI 时沿现目录风格，先校准职责 |
| `docs/web-runtime-efficiency/isolated-engine/web/e2e-agent-runtime.mjs` | baseline case | `rg "async function runBaseline" docs/web-runtime-efficiency/isolated-engine/web/e2e-agent-runtime.mjs` | L1 | Task 1 新增；隔离树 |
| `docs/web-runtime-efficiency/isolated-engine/web/bench-agent-runtime.mjs` | before/after/compare | `rg "async function runPhase" docs/web-runtime-efficiency/isolated-engine/web/bench-agent-runtime.mjs` | L1 | Task 1 新增测量入口 |
| `docs/web-runtime-efficiency/isolated-engine/web/runtime-measure.mjs` | measureSample | `rg "export async function measureSample" docs/web-runtime-efficiency/isolated-engine/web/runtime-measure.mjs` | L1 | 共用探测与计时 |
| `../engine/packages/pdf2docx/src/index.ts` | convertPdfToDocx | `rg "export async function convertPdfToDocx" ../engine/packages/pdf2docx/src/index.ts` | L42 | 已有纯算法边界 |
| `../engine/apps/slides/src/renderer/web-bridge.ts` | runTxn | `rg "runTxn" ../engine/apps/slides/src/renderer/web-bridge.ts` | L64/L750 | 已有事务复用边界 |

### 3.4 API / 数据 / 权限 / 路由影响

扩展前置控制协议，新增版本化发现与会话生命周期接口，保留现 HTTP+SSE 和兼容模式；不改 Office 文件格式。新增 CLI/SDK 是同协议客户端，headless 归服务生命周期管理；所有访问继续受现有权限限制。新文件路径和具体接口字段需在 P0 基于前置包真实产物确定。


P0 先固定可比较性能协议，再把实测目标写入 §1.4 与任务验收；前后基点只跨本包优化，不用旧官方版本比较新功能版。按族模式减少无关 schema 的字节数不等于同等 token 收益，不能把字符/字节当 token。默认完整工具表继续兼容，动态模式仅在宿主明确协商支持时启用。

## 4. Phase 计划与任务详情

总入口：[Master handoff](../genoffice-web-roadmap/handoff.md)。未来执行由 master 连续调度本包；本包 CSV 是本包唯一任务状态源，跨包解锁须过 master gate。

前四个子包全部完成真实验收后再测量和优化；已由状态安全包消除的重复读取只回归，不重复实现。按族发现是增量能力协商，默认 DSH 注册行为保留。

任务依赖按下表序号串行。跨包依赖不能由 board.py 自动推断，各包 Task 1 负责核对母包及前置证据；“可开工”不等于本轮授权执行。

实现任务 9 项；其余为基线、验收、测量或回归。所有任务均为未来执行状态。

状态板见同目录 [tasks.csv](tasks.csv)，纯状态和导航，不复制业务合同。

### Phase 0: 可运行起点与基线

### Task 1: 固定测量协议和真实客户端基线

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / BR-007 / INV-001 / INV-002 / INV-003 / INV-004 / EVD-005
- **前置任务**：无（仍需核对上述跨包条件）
- **风险等级**：P1

**为什么做**：核对四个前置包真实完成证据与实际模块导出；记录机器、Node 路径/版本、Chromium、依赖、fixture 哈希、冷/暖定义、重复数及随机顺序。用同一前置完成基点衡量本包优化。

**涉及文件与定位**：

- `../engine/package.json`：web 脚本；`rg "\"web\":" ../engine/package.json`；L29，行号仅 hint。
- `../engine/web/server.mjs`：findStaticRoots；`rg "function findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。
- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。
- `../engine/apps/markdown/src/renderer/control.ts`：captureMtime；`rg "captureMtime" ../engine/apps/markdown/src/renderer/control.ts`；L225，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：createControlTools；`rg "export function createControlTools" packages/tab-genoffice/src/host/tools.ts`；L455，行号仅 hint。
- `packages/tab-genoffice/src/host/tool-schema.ts`：CONTROL_TOOL_TABLE；`rg "export const CONTROL_TOOL_TABLE" packages/tab-genoffice/src/host/tool-schema.ts`；L72，行号仅 hint。
- `packages/tab-genoffice/src/host/capability.ts`：capabilityOf；`rg "export function capabilityOf" packages/tab-genoffice/src/host/capability.ts`；L121，行号仅 hint。
- `packages/tab-genoffice/src/host/relay-launch.ts`：spawnRelay；`rg "async function spawnRelay" packages/tab-genoffice/src/host/relay-launch.ts`；L48，行号仅 hint。
- `scripts/dev.mjs`：start-relay；`rg "web/server.mjs" scripts/dev.mjs`；L72，行号仅 hint。
- `../engine/web/open.mjs`：浏览器打开脚本；`rg "browser" ../engine/web/open.mjs`；L1，行号仅 hint。
- `../engine/packages/pdf2docx/src/index.ts`：convertPdfToDocx；`rg "export async function convertPdfToDocx" ../engine/packages/pdf2docx/src/index.ts`；L42，行号仅 hint。
- `../engine/apps/slides/src/renderer/web-bridge.ts`：runTxn；`rg "runTxn" ../engine/apps/slides/src/renderer/web-bridge.ts`；L64/L750，行号仅 hint。

**具体操作**：

1. 核对四个前置包真实完成证据与实际模块导出；记录机器、Node 路径/版本、Chromium、依赖、fixture 哈希、冷/暖定义、重复数及随机顺序。用同一前置完成基点衡量本包优化。
2. 未来新建 web/e2e-agent-runtime.mjs 与 web/bench-agent-runtime.mjs，分别支持 --case/--all/--out 和 --before/--after/--compare/--out；采集启动/open/context/edit/save 原始时长、字节、进程/RSS、文件正确性。先测 Markdown，然后五族+HTML 小/中/大文件。
3. 复核是否仍有 mtime 全文件重复读取，核验已安装 SDK/MCP 依赖及宿主动态工具能力；确定 CLI/SDK 最小路径、资源上限和性能容忍区间，按变更协议消解假设，不预设虚构毫秒收益。

**验证**：`node ../engine/web/bench-agent-runtime.mjs --before` → 完整原始基线；`node ../engine/web/e2e-agent-runtime.mjs --case baseline` → 记录已有能力与缺口

**Evidence**：`evidence/phase-0/task-1.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 2: 复用加载元信息并消除重复文件传输

- **关联**：BR-001 / BR-002 / BR-007 / UF-001 / INV-001 / INV-004 / EVD-001
- **前置任务**：1
- **风险等级**：P1

**为什么做**：只在前置适配仍有重复读取时修改：从同次文件加载响应获取与字节绑定的版本和元信息，保存沿用对应文件版本；不以独立 stat 偷换读字节基线。

**涉及文件与定位**：

- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。
- `../engine/apps/markdown/src/renderer/control.ts`：captureMtime；`rg "captureMtime" ../engine/apps/markdown/src/renderer/control.ts`；L225，行号仅 hint。

**具体操作**：

1. 只在前置适配仍有重复读取时修改：从同次文件加载响应获取与字节绑定的版本和元信息，保存沿用对应文件版本；不以独立 stat 偷换读字节基线。
2. 先 Markdown 真实 open/save 证明无 mtime-only 全文件请求，再推广既有共享层；前置已满足时只提交有证据的回归，不制造无意义重构。

**验证**：`node ../engine/web/e2e-agent-runtime.mjs --case no-duplicate-read` → 请求/字节零额外全文件读取，外改仍冲突

**Evidence**：`evidence/phase-0/task-2.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 3: 分离完整网页构建和纯运行入口

- **关联**：BR-003 / UF-002 / INV-003 / EVD-002
- **前置任务**：2
- **风险等级**：P1

**为什么做**：保留现 npm run web 默认行为兼容，新增明确全 app build 与纯 serve 命令，覆盖五族、shell 及前置 HTML；名称在当前 package scripts 校准后写回 spec。

**涉及文件与定位**：

- `../engine/package.json`：web 脚本；`rg "\"web\":" ../engine/package.json`；L29，行号仅 hint。
- `scripts/dev.mjs`：start-relay；`rg "web/server.mjs" scripts/dev.mjs`；L72，行号仅 hint。

**具体操作**：

1. 保留现 `npm run web`（shell+docs+markdown 构建后启动）兼容。新增根脚本 `web:build`=`npm run web:build --workspaces --if-present`（五族+shell+HTML）和 `web:serve`=`node web/server.mjs`。插件 `scripts/dev.mjs start-relay` 仍只启动 `web/server.mjs`，不隐式构建。
2. 纯 serve 仅消费已有 web-dist，不调用 vite/npm build；启动和停止只管理本次服务进程，并记录完整日志与启动耗时。

**验证**：`node ../engine/web/e2e-agent-runtime.mjs --case build-serve`；`npm --prefix ../engine run web:build --workspaces --if-present` → 纯运行无构建，完整 app 可服务

**Evidence**：`evidence/phase-0/task-3.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 4: 实现各应用就绪并接入宿主启动反馈

- **关联**：BR-003 / UF-002 / INV-002 / INV-003 / EVD-002
- **前置任务**：3
- **风险等级**：P1

**为什么做**：区分 live、app 构建完整、app 运行依赖与整套就绪；不能只检查任一静态根。缺某 app 时其他独立 app 保持可用，目标打开前消费目标状态。

**涉及文件与定位**：

- `../engine/web/server.mjs`：findStaticRoots；`rg "function findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。
- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。
- `packages/tab-genoffice/src/host/relay-launch.ts`：spawnRelay；`rg "async function spawnRelay" packages/tab-genoffice/src/host/relay-launch.ts`；L48，行号仅 hint。
- `scripts/dev.mjs`：start-relay；`rg "web/server.mjs" scripts/dev.mjs`；L72，行号仅 hint。

**具体操作**：

1. 区分 live、app 构建完整、app 运行依赖与整套就绪；不能只检查任一静态根。缺某 app 时其他独立 app 保持可用，目标打开前消费目标状态。
2. 接插件 relay-launch、Sidebar 状态和 start-relay 的新语义，兼容旧客户端并避免 overall ready 误判。缺 build/sidecar/打印依赖分别恢复并重新探测。

**验证**：`node ../engine/web/e2e-agent-runtime.mjs --case readiness`；`npm run typecheck` → 完整/缺构建/缺依赖和恢复通过

**Evidence**：`evidence/phase-0/task-4.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 5: 执行 Phase 0 回归验证

- **关联**：BR-001 / BR-002 / BR-003 / UF-001 / UF-002 / INV-001 / INV-002 / INV-003 / INV-004 / EVD-005
- **前置任务**：4
- **风险等级**：P1

**为什么做**：重跑单应用和整套就绪、无重复读取、外改冲突及原 npm run web 兼容路径；比较数据采样协议保持不变。

**涉及文件与定位**：

- `../engine/package.json`：web 脚本；`rg "\"web\":" ../engine/package.json`；L29，行号仅 hint。
- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。
- `../engine/apps/markdown/src/renderer/control.ts`：captureMtime；`rg "captureMtime" ../engine/apps/markdown/src/renderer/control.ts`；L225，行号仅 hint。
- `packages/tab-genoffice/src/host/relay-launch.ts`：spawnRelay；`rg "async function spawnRelay" packages/tab-genoffice/src/host/relay-launch.ts`；L48，行号仅 hint。

**具体操作**：

1. 重跑单应用和整套就绪、无重复读取、外改冲突及原 npm run web 兼容路径；比较数据采样协议保持不变。

**验证**：`node ../engine/web/e2e-agent-runtime.mjs --case startup-file`；`npm --prefix ../engine run typecheck`；`npm run typecheck` → 全通过

**Evidence**：`evidence/phase-0/task-5.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Phase 1: 按依赖扩展并验证

### Task 6: 建立版本化能力单源和按族发现

- **关联**：BR-004 / BR-007 / UF-003 / INV-002 / INV-003 / EVD-003
- **前置任务**：5
- **风险等级**：P1

**为什么做**：从前置已对齐执行器/插件声明收敛单份版本化 manifest，登记协议/schema 版本、文档族、真实 readiness 和公共入口；参数与能力不在两侧长期手写维护。

**涉及文件与定位**：

- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：createControlTools；`rg "export function createControlTools" packages/tab-genoffice/src/host/tools.ts`；L455，行号仅 hint。
- `packages/tab-genoffice/src/host/tool-schema.ts`：CONTROL_TOOL_TABLE；`rg "export const CONTROL_TOOL_TABLE" packages/tab-genoffice/src/host/tool-schema.ts`；L72，行号仅 hint。
- `packages/tab-genoffice/src/host/capability.ts`：capabilityOf；`rg "export function capabilityOf" packages/tab-genoffice/src/host/capability.ts`；L121，行号仅 hint。

**具体操作**：

1. 从前置已对齐执行器/插件声明收敛单份版本化 manifest，登记协议/schema 版本、文档族、真实 readiness 和公共入口；参数与能力不在两侧长期手写维护。
2. 按族发现只返回目标族与必要公共工具；未知族/不兼容版本拒绝写请求并给刷新方式，不能默默回落其他 app。实现公开发现入口后将准确路径/字段写回 spec 和 harness。

**验证**：`node ../engine/web/e2e-agent-runtime.mjs --case discovery` → 按族范围、真实调用与错版本负例通过

**Evidence**：`evidence/phase-0/task-6.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 7: 接入插件按族协商并保留旧宿主模式

- **关联**：BR-004 / UF-003 / INV-003 / EVD-003
- **前置任务**：6
- **风险等级**：P1

**为什么做**：插件消费同源声明，支持动态工具的宿主显式协商按族加载与切换；不支持时保留当前完整表及既有工具名。不得为了减工具量导致必要 open/save/公共能力不可发现。

**涉及文件与定位**：

- `packages/tab-genoffice/src/host/tools.ts`：createControlTools；`rg "export function createControlTools" packages/tab-genoffice/src/host/tools.ts`；L455，行号仅 hint。
- `packages/tab-genoffice/src/host/tool-schema.ts`：CONTROL_TOOL_TABLE；`rg "export const CONTROL_TOOL_TABLE" packages/tab-genoffice/src/host/tool-schema.ts`；L72，行号仅 hint。
- `packages/tab-genoffice/src/host/capability.ts`：capabilityOf；`rg "export function capabilityOf" packages/tab-genoffice/src/host/capability.ts`；L121，行号仅 hint。
- `packages/tab-genoffice/src/host/relay-launch.ts`：spawnRelay；`rg "async function spawnRelay" packages/tab-genoffice/src/host/relay-launch.ts`；L48，行号仅 hint。

**具体操作**：

1. 插件消费同源声明，支持动态工具的宿主显式协商按族加载与切换；不支持时保留当前完整表及既有工具名。不得为了减工具量导致必要 open/save/公共能力不可发现。
2. 分别量化完整表与各族 UTF-8 schema 字节数，验证 xlsx→pptx 切换、旧宿主与错版本；正例必须真实执行保存重开。

**验证**：`npm run typecheck`；`npm test`；`npm run build`；`npm run standard:check`；`node ../engine/web/e2e-agent-runtime.mjs --case plugin-discovery` → 新旧模式、切族和真实参数均通过

**Evidence**：`evidence/phase-0/task-7.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 8: 提供复用控制协议的 SDK 与 CLI

- **关联**：BR-005 / BR-007 / UF-004 / INV-001 / INV-002 / INV-003 / EVD-004
- **前置任务**：7
- **风险等级**：P1

**为什么做**：按 Task 1 确定的已安装依赖和仓库风格建立薄 SDK 与 CLI，先公开 open/context/edit/save/reopen；请求/结果透传 revision、owner、未知结果和 abort，不维护第二编辑模型。

**涉及文件与定位**：

- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。
- `../engine/web/open.mjs`：浏览器打开脚本；`rg "browser" ../engine/web/open.mjs`；L1，行号仅 hint。

**具体操作**：

1. 按 Task 1 确定的已安装依赖和仓库风格建立薄 SDK 与 CLI，先公开 open/context/edit/save/reopen；请求/结果透传 revision、owner、未知结果和 abort，不维护第二编辑模型。
2. 以 Markdown 真实接口先验证协议解析；有可视执行器时复用，下一任务补无界面启动。CLI 帮助给出真实参数、退出码与结果结构，未知结果先读确认。

**验证**：`node ../engine/web/e2e-agent-runtime.mjs --case sdk-cli` → 真实现有执行器闭环及错误/取消通过

**Evidence**：`evidence/phase-0/task-8.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 9: 按需启动 Markdown 执行器纵向闭环

- **关联**：BR-005 / BR-006 / UF-004 / INV-001 / INV-002 / EVD-004
- **前置任务**：8
- **风险等级**：P1

**为什么做**：用已安装 Chromium 启动受控 renderer，open 等 loading→ready；相同文档复用会话，已有可视 owner 时使用现会话不抢占。

**涉及文件与定位**：

- `../engine/web/server.mjs`：findStaticRoots；`rg "function findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。
- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。
- `../engine/web/open.mjs`：浏览器打开脚本；`rg "browser" ../engine/web/open.mjs`；L1，行号仅 hint。

**具体操作**：

1. 用已安装 Chromium 启动受控 renderer，open 等 loading→ready；相同文档复用会话，已有可视 owner 时使用现会话不抢占。
2. 在完全没有 DSH/可视页的条件下经 CLI 打开 Markdown、读改、显式保存与重开；启动失败清理半注册，不能让用户先手工开页才成功。

**验证**：`node ../engine/web/e2e-agent-runtime.mjs --case headless-markdown` → 无 DSH 的实际磁盘闭环通过

**Evidence**：`evidence/phase-0/task-9.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 10: 推广外部 agent 到五族和 HTML

- **关联**：BR-005 / BR-007 / UF-004 / INV-001 / INV-003 / EVD-004
- **前置任务**：9
- **风险等级**：P1

**为什么做**：沿同一 SDK/CLI/执行器机制接入剩余 app，复用前置工具与导出接口；每族最小读改存重开后覆盖新增官方上下文和服务 readiness。

**涉及文件与定位**：

- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。
- `../engine/web/open.mjs`：浏览器打开脚本；`rg "browser" ../engine/web/open.mjs`；L1，行号仅 hint。
- `../engine/packages/pdf2docx/src/index.ts`：convertPdfToDocx；`rg "export async function convertPdfToDocx" ../engine/packages/pdf2docx/src/index.ts`；L42，行号仅 hint。
- `../engine/apps/slides/src/renderer/web-bridge.ts`：runTxn；`rg "runTxn" ../engine/apps/slides/src/renderer/web-bridge.ts`；L64/L750，行号仅 hint。

**具体操作**：

1. 沿同一 SDK/CLI/执行器机制接入剩余 app，复用前置工具与导出接口；每族最小读改存重开后覆盖新增官方上下文和服务 readiness。
2. 比较 DSH 与外部客户端在相同文档的规范响应，不复制文档算法、转换逻辑或 control 状态。

**验证**：`node ../engine/web/e2e-agent-runtime.mjs --case headless-families` → 五族+HTML 无人工开页闭环通过

**Evidence**：`evidence/phase-0/task-10.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 11: 完善可视交接和资源释放状态机

- **关联**：BR-006 / UF-004 / INV-001 / INV-002 / INV-003 / EVD-004
- **前置任务**：10
- **风险等级**：P1

**为什么做**：基于 owner 实现可视复用/显式交接，脏会话须明确保存或保留，不关闭唯一未保存副本；并发和空闲上限以 Task 1 实测阈值为准。

**涉及文件与定位**：

- `../engine/web/server.mjs`：findStaticRoots；`rg "function findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。
- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。
- `packages/tab-genoffice/src/host/relay-launch.ts`：spawnRelay；`rg "async function spawnRelay" packages/tab-genoffice/src/host/relay-launch.ts`；L48，行号仅 hint。
- `../engine/web/open.mjs`：浏览器打开脚本；`rg "browser" ../engine/web/open.mjs`；L1，行号仅 hint。

**具体操作**：

1. 基于 owner 实现可视复用/显式交接，脏会话须明确保存或保留，不关闭唯一未保存副本；并发和空闲上限以 Task 1 实测阈值为准。
2. 覆盖重复 open、headless/可视冲突、取消/崩溃、资源上限、idle/release；不循环创建页面、不自动重放写入、不误杀用户浏览器进程。

**验证**：`node ../engine/web/e2e-agent-runtime.mjs --case lifecycle` → 崩溃/交接/繁忙/dirty 保留和资源回收通过

**Evidence**：`evidence/phase-0/task-11.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 12: 执行 spec 5.2 真实场景全套测试

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / BR-007 / UF-001 / UF-002 / UF-003 / UF-004 / INV-001 / INV-002 / INV-003 / INV-004 / EVD-001 / EVD-002 / EVD-003 / EVD-004
- **前置任务**：11
- **风险等级**：P1

**为什么做**：按矩阵跑所有 app、兼容客户端和正负生命周期；同时确认与前置安全、Web 完整功能的联动，保留真实文件与进程资源日志。

**涉及文件与定位**：

- `../engine/package.json`：web 脚本；`rg "\"web\":" ../engine/package.json`；L29，行号仅 hint。
- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：createControlTools；`rg "export function createControlTools" packages/tab-genoffice/src/host/tools.ts`；L455，行号仅 hint。
- `packages/tab-genoffice/src/host/relay-launch.ts`：spawnRelay；`rg "async function spawnRelay" packages/tab-genoffice/src/host/relay-launch.ts`；L48，行号仅 hint。
- `../engine/web/open.mjs`：浏览器打开脚本；`rg "browser" ../engine/web/open.mjs`；L1，行号仅 hint。

**具体操作**：

1. 按矩阵跑所有 app、兼容客户端和正负生命周期；同时确认与前置安全、Web 完整功能的联动，保留真实文件与进程资源日志。

**验证**：`node ../engine/web/e2e-agent-runtime.mjs --all` → 全部矩阵通过

**Evidence**：`evidence/phase-0/task-12.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 13: 完成同条件性能复测和收益核销

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-007 / UF-001 / INV-001 / INV-004 / EVD-001
- **前置任务**：12
- **风险等级**：P1

**为什么做**：在 Task 1 固定条件运行 after/compare，输出逐次样本、p50/p95、请求字节和资源前后对比；条件不一致的样本排除并重新测量。

**涉及文件与定位**：

- `../engine/package.json`：web 脚本；`rg "\"web\":" ../engine/package.json`；L29，行号仅 hint。
- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：createControlTools；`rg "export function createControlTools" packages/tab-genoffice/src/host/tools.ts`；L455，行号仅 hint。
- `packages/tab-genoffice/src/host/tool-schema.ts`：CONTROL_TOOL_TABLE；`rg "export const CONTROL_TOOL_TABLE" packages/tab-genoffice/src/host/tool-schema.ts`；L72，行号仅 hint。
- `../engine/web/open.mjs`：浏览器打开脚本；`rg "browser" ../engine/web/open.mjs`；L1，行号仅 hint。

**具体操作**：

1. 在 Task 1 固定条件运行 after/compare，输出逐次样本、p50/p95、请求字节和资源前后对比；条件不一致的样本排除并重新测量。
2. 核对已校准性能目标、零多余文件传输、纯 serve 无构建和按族声明范围；收益不足先查瓶颈，功能/冲突/权限回归不能以更快为理由接受。

**验证**：`node ../engine/web/bench-agent-runtime.mjs --after`；`node ../engine/web/bench-agent-runtime.mjs --compare` → 有效可比样本及目标通过

**Evidence**：`evidence/phase-0/task-13.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 14: 执行 Phase 1 回归验证

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / BR-007 / INV-001 / INV-002 / INV-003 / INV-004 / EVD-005
- **前置任务**：13
- **风险等级**：P1

**为什么做**：完整相关校验和前置代表性冲突/保存/插件场景通过；核对 import 单源及真实证据闸门后，才向母包交接。

**涉及文件与定位**：

- `../engine/package.json`：web 脚本；`rg "\"web\":" ../engine/package.json`；L29，行号仅 hint。
- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：createControlTools；`rg "export function createControlTools" packages/tab-genoffice/src/host/tools.ts`；L455，行号仅 hint。
- `packages/tab-genoffice/src/host/relay-launch.ts`：spawnRelay；`rg "async function spawnRelay" packages/tab-genoffice/src/host/relay-launch.ts`；L48，行号仅 hint。
- `../engine/web/open.mjs`：浏览器打开脚本；`rg "browser" ../engine/web/open.mjs`；L1，行号仅 hint。

**具体操作**：

1. 完整相关校验和前置代表性冲突/保存/插件场景通过；核对 import 单源及真实证据闸门后，才向母包交接。

**验证**：`npm --prefix ../engine run typecheck`；`npm --prefix ../engine run test`；`npm --prefix ../engine run web:build --workspaces --if-present`；`npm run typecheck`；`npm test`；`npm run build`；`npm run standard:check`；`python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/web-runtime-efficiency --repo .` → 全通过，性能和功能证据齐全

**Evidence**：`evidence/phase-0/task-14.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

## 5. 验收与 Review 协议

### 5.1 命令级验证

本轮仅运行包结构/源码锚点/状态板/视图校验。下列业务命令是未来执行闸门；命令级通过之后仍须运行第 5.2 节。

| 验证项 | 命令（插件仓根） | 期望 |
|---|---|---|
| 本轮规格 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/web-runtime-efficiency --repo .` | 退出 0；规格必须 0 FAIL |
| 本轮状态 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/board.py docs/web-runtime-efficiency --json` | 全部任务待开始；后续实施由事实更新 |
| 本轮视图 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/render_spec.py docs/web-runtime-efficiency` | 退出 0；规格必须 0 FAIL |
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
| 验证入口 | `node ../engine/web/e2e-agent-runtime.mjs --all`；这是 Task 1 要新增的真实回放脚本，本轮未创建。默认 relay 地址为上述隔离端口，提供 `--out` 指向本包 evidence；逐项 `--case` 名称见任务验证行，全部必须由创建任务实现。 |
| 性能入口 | `node ../engine/web/bench-agent-runtime.mjs --before`、`node ../engine/web/bench-agent-runtime.mjs --after`、`node ../engine/web/bench-agent-runtime.mjs --compare`；Task 1 未来新增，固定测量协议才可比较。 |

**执行矩阵**：每行归档实际 request/response、console/server 输出、network 与截图；预期故障单独标注，不能吞掉非预期错误。result.json 必须枚举全部适用 app/入口/能力子例、成功断言、失败断言、恢复结果及输出文件清单，不允许只写一个总 pass。

| UF | 执行方式 | 操作来源 | 必须核对的点 | Evidence |
|---|---|---|---|---|
| UF-001 主路径 | CLI + browser + HTTP/资源采样 | 第 2.3 节 UF-001 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-001/success/result.json`、`evidence/UF-001/success/console.log`、`evidence/UF-001/success/network.json`、`evidence/UF-001/success/screenshot.png` |
| UF-001 失败分支：文件外部变化 | CLI + browser + HTTP/资源采样 | 第 2.3 节对应分支；触发：加载后外部改文件 | 保留版本保护不靠重读覆盖；恢复：重读并显式合并/另存；恢复后重走成功路径 | `evidence/UF-001/failure-1/result.json`、`evidence/UF-001/failure-1/console.log`、`evidence/UF-001/failure-1/network.json`、`evidence/UF-001/failure-1/screenshot.png` |
| UF-001 失败分支：测量条件不一致 | CLI + browser + HTTP/资源采样 | 第 2.3 节对应分支；触发：fixture/版本/缓存状态变化 | 不混用样本、不标性能通过；恢复：复原条件后重测；恢复后重走成功路径 | `evidence/UF-001/failure-2/result.json`、`evidence/UF-001/failure-2/console.log`、`evidence/UF-001/failure-2/network.json`、`evidence/UF-001/failure-2/screenshot.png` |
| UF-002 主路径 | CLI + browser + HTTP/资源采样 | 第 2.3 节 UF-002 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-002/success/result.json`、`evidence/UF-002/success/console.log`、`evidence/UF-002/success/network.json`、`evidence/UF-002/success/screenshot.png` |
| UF-002 失败分支：目标 app 缺构建 | CLI + browser + HTTP/资源采样 | 第 2.3 节对应分支；触发：删除隔离副本某 app index | 不把其他 app 的 ready 当目标 ready；恢复：补构建后重新探测；恢复后重走成功路径 | `evidence/UF-002/failure-1/result.json`、`evidence/UF-002/failure-1/console.log`、`evidence/UF-002/failure-1/network.json`、`evidence/UF-002/failure-1/screenshot.png` |
| UF-002 失败分支：原生服务缺依赖 | CLI + browser + HTTP/资源采样 | 第 2.3 节对应分支；触发：sidecar/打印 provider 不可用 | 存活探测仍可用，受影响能力禁提交；恢复：启动依赖后就绪恢复；恢复后重走成功路径 | `evidence/UF-002/failure-2/result.json`、`evidence/UF-002/failure-2/console.log`、`evidence/UF-002/failure-2/network.json`、`evidence/UF-002/failure-2/screenshot.png` |
| UF-003 主路径 | CLI + browser + HTTP/资源采样 | 第 2.3 节 UF-003 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-003/success/result.json`、`evidence/UF-003/success/console.log`、`evidence/UF-003/success/network.json`、`evidence/UF-003/success/screenshot.png` |
| UF-003 失败分支：版本不兼容 | CLI + browser + HTTP/资源采样 | 第 2.3 节对应分支；触发：客户 schema revision 不受支持 | 不执行未知参数写操作；恢复：刷新 manifest/用兼容版本；恢复后重走成功路径 | `evidence/UF-003/failure-1/result.json`、`evidence/UF-003/failure-1/console.log`、`evidence/UF-003/failure-1/network.json`、`evidence/UF-003/failure-1/screenshot.png` |
| UF-003 失败分支：族或依赖不可用 | CLI + browser + HTTP/资源采样 | 第 2.3 节对应分支；触发：未知 app、该族 provider 不就绪 | 不编造 schema 或静默回退其他 app；恢复：切到支持族/恢复服务；恢复后重走成功路径 | `evidence/UF-003/failure-2/result.json`、`evidence/UF-003/failure-2/console.log`、`evidence/UF-003/failure-2/network.json`、`evidence/UF-003/failure-2/screenshot.png` |
| UF-004 主路径 | CLI + browser + HTTP/资源采样 | 第 2.3 节 UF-004 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-004/success/result.json`、`evidence/UF-004/success/console.log`、`evidence/UF-004/success/network.json`、`evidence/UF-004/success/screenshot.png` |
| UF-004 失败分支：浏览器缺失/崩溃 | CLI + browser + HTTP/资源采样 | 第 2.3 节对应分支；触发：启动失败或运行时退出 | 清理半初始化注册，不无限重试写入；恢复：修复运行时并重新 open；恢复后重走成功路径 | `evidence/UF-004/failure-1/result.json`、`evidence/UF-004/failure-1/console.log`、`evidence/UF-004/failure-1/network.json`、`evidence/UF-004/failure-1/screenshot.png` |
| UF-004 失败分支：冲突/资源上限 | CLI + browser + HTTP/资源采样 | 第 2.3 节对应分支；触发：同文件有效 owner、并发超过上限 | 不抢 owner、不杀 dirty 会话；恢复：等释放、显式接管或重读后继续；恢复后重走成功路径 | `evidence/UF-004/failure-2/result.json`、`evidence/UF-004/failure-2/console.log`、`evidence/UF-004/failure-2/network.json`、`evidence/UF-004/failure-2/screenshot.png` |

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
