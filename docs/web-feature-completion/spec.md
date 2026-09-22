# web-feature-completion Spec

> Version: 0.3.0 | Date: 2026-09-12 | Status: Ready 可执行（仅规格，尚未实施）
>
> 本文件是本包唯一事实源。oneclick 规格已完整展开；本轮只生成与校验，不代表功能已实现。

## 0. 一页纸人话摘要

- 给浏览器用户和外部 agent 补齐文档功能，操作从网页入口开始，在网页或服务端完成并得到真实文件。
- 覆盖现有五类文档的新建、打开、编辑和导出，并接入官方新增的 HTML 编辑器；HTML 接入必须在固定官方版本同步之后进行。
- 优先解决 Excel 公式、表格特征和图片读取不完整，再补 PDF 页面处理、Office 转换及演示文稿网页菜单功能。
- 打印、文字识别、模型和媒体功能允许依赖服务；开始操作前就要显示服务是否可用，不能执行到一半要求安装桌面版。
- 所有宣称可用的入口都必须通过成功、错误和恢复场景，导出文件还要重新打开核对内容。
- 不重写已有纯转换算法，不替代前置包的状态一致性、原子保存或工具契约修复；不把桌面安装器、自动更新和操作系统菜单列为网页文档功能。

## 1. 事实基线与假设

### 1.1 需求与运行模式

| 项 | 结论 |
|---|---|
| 原始需求 | 用户要求魔改上游完整支持 Web、避免 agent 中途遇到桌面专属限制，并授权生成多套 oneclick 包 |
| 输入类型 | description，结合前序 review；事实以本次磁盘勘察为准 |
| Mode | oneclick；本轮只生成任务包并运行校验，业务任务留待未来执行；交接统一使用母包 handoff |
| 置信度 | 高：目标和两仓位置明确；部署所需服务条件登记为 ASM-001 |
| 输出目录 | `docs/web-feature-completion/` |
| 路径基准 | 本文代码路径相对于插件仓库；魔改上游是 `../engine/`，官方是其 `upstream/main` |

### 1.2 任务类型路由

| 维度 | 结论 |
|---|---|
| 任务类型 | frontend + backend + bugfix + infra |
| 主要风险 | XLSX 语义缺失、桥接入口空实现、转换假成功、原生依赖泄漏进浏览器 |
| 行号引用策略 | 仅 hint，以 symbol 和 rg anchor 为准；同步官方后重新核验 |
| 必需验收方式 | 浏览器实际入口、真实 relay、真实转换文件、重开对账、成功与失败证据 |
| 必须覆盖用户场景 | 五族主页和跨 app 打开、Sheets 特征及图片、PDF 编辑转换、Slides 菜单、服务型导出、HTML 编辑转换 |

### 1.3 勘察事实清单

命令从插件仓库执行；带 `--prefix` 或 `-C` 的命令已明确目标仓库。下列事实仅描述静态结构与环境，不把历史测试结果当成本次通过。

| 事实 | 来源命令 | 输出摘要 |
|---|---|---|
| 插件按两仓产品组织 | `cat README.md package.json` | host 工具经 HTTP/SSE 驱动 Web 编辑器；存在 test/typecheck/build/standard:check/smoke |
| engine 固定基线和官方引用可用 | `git -C ../engine rev-parse HEAD upstream/main` | engine `247e3f5c488afb25915e9ee97fe0fd22e27648da`；官方 `de139a061537bea40f0cc81ef8f09a95f77ac52a` |
| 首页只路由 docx/md | `rg "appForExt|newSheet|newSlide|newPdf|notifyUnsupported" ../engine/apps/shell/src/renderer/src/web-bridge.ts` | appForExt 137；newSheet/newSlide/newPdf 293–296 调 notifyUnsupported |
| Sheets Web 模型有固定空字段 | `sed -n '380,416p' ../engine/apps/sheets/src/renderer/web-xlsx.ts`；`sed -n '510,571p' ../engine/apps/sheets/src/renderer/web-xlsx.ts` | 仅提取有正文的 f 标签；definedNames/visuals/tables 为空，筛选和保护返回 null |
| Sheets 图片与透视读取有缺口 | `rg "readWorkbookMedia|readPivotDefinition|readLocalImage|exportPdf" ../engine/apps/sheets/src/renderer/web-bridge.ts` | 媒体、透视、图片方法抛不可用错误，PDF 导出为错误结果 |
| 已有 sidecar 客户端 | `sed -n '1,60p' ../engine/apps/sheets/src/main/xlsx-sidecar-client.ts` | XlsxSidecarClient 用 Node spawn + stdio，协议 version=1，已有 open/readRange/readFormulaCells |
| PDF 页面算法已存在 | `rg "export (async )?function (extractPagesBytes|insertBlankPageBytes|setPageSizeBytes|splitPagesBytes|cropPagesBytes)" ../engine/apps/pdf/src/main/save-pdf.ts` | 5 项 bytes 函数位于 436/460/609/662/706，无需另写算法 |
| PDF→Office 已有纯函数包 | `rg "export |Pure-function" ../engine/packages/pdf2docx/src/index.ts` | 字节输入输出；convertPdfToDocx、convertPdfToPptx、convertPdfToXlsx 已导出，调用方负责 WASM |
| PDF Web 未接上述出口 | `rg "extractPages|insertBlankPage|setPageSize|splitPages|cropPages|convertOffice" ../engine/apps/pdf/src/renderer/web-bridge.ts` | 对应方法为 unsupported 或抛错 |
| Slides 已有共用事务执行能力 | `rg "runTxn|notAvailable|exportPdf" ../engine/apps/slides/src/renderer/web-bridge.ts` | runTxn 位于 750–792；布局、主题、分节、媒体、母版、放映、导出等仍有 notAvailable |
| 原生打印与 OCR 入口可定位 | `rg "printToPDF|exportPdfAsDocx|OCR" ../engine/apps/docs/src/main/docs-main.ts ../engine/apps/markdown/src/main/markdown-main.ts ../engine/apps/sheets/src/main/pdf-export.ts ../engine/apps/shell/src/main/index.ts` | 打印依赖 Electron webContents；shell 有本地转换与云 OCR 分流 |
| HTML 仅存在官方对象中 | `git -C ../engine ls-tree --name-only upstream/main:apps/html` | package.json、src、tests 等存在于 Git 对象；当前工作树没有该 app，不为其编造文件定位 |
| 当前 Web 构建只默认包含三项 | `cat ../engine/package.json` | npm run web 构建 shell/docs/markdown 后启动；五族各有 web:build |
| 真实浏览器工具存在 | `node -e 'const {chromium}=require("playwright"); const fs=require("node:fs"); console.log(JSON.stringify({playwright:require.resolve("playwright"),browserExists:fs.existsSync(chromium.executablePath())}))'`（engine cwd） | Playwright 已安装，Chromium executable 存在；可扩展现有 web/e2e 脚本 |
| 文档有历史滞后，不能代替源码能力判定 | `cat ../engine/web/README.md`；`rg --files ../engine/web -g '*e2e*'` | README 仍称三族待 Web 化，但当前桥接文件和控制器存在；已有 home/cross-app/open-save/url-open 等测试脚本 |

### 1.4 假设清单

| 假设 ID | 内容 | 风险 | 确认方式 |
|---|---|---|---|
| ASM-001 | 服务型能力通过本机 relay 启动已有 sidecar、隔离打印执行器或配置的 OCR/model provider；不要求 Electron GUI | 服务部署不齐导致不可验收 | P0 校准逐项探测二进制/provider；保留失败前置检查并把未具备依赖的任务标阻塞 |
| ASM-002 | 本包在状态安全、插件契约和固定官方同步包通过后实施；任务序号由母包统一登记 | 官方合并导致定位漂移 | P0 记录前置包完成证据与同步后 SHA，重跑所有定位 |
| ASM-003 | 完整 Web 指全部文档业务入口；登录若是 provider 前置条件应在网页完成或明确服务配置，安装器/更新器不在范围 | 入口清单可能漏项 | P0 生成 bridge 方法及 UI/tool 引用清单，每项必须映射实现任务和验收，不允许用隐藏已承诺功能缩范围 |

### 1.6 质量记录

骨架源码定位闸门已通过；后续完整结构与渲染记录见 evidence/package-validation/。本轮业务源码和用户既有改动保持。

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
| BR-001 | 五族新建、文件选择、拖入、最近文件、跨 app 入口在 Web 可达；HTML 在官方同步后纳入 | 首页打开 xlsx 后编辑并保存重开 | 首页把 xlsx 提示为仅桌面版 | shell/各编辑器 | UF-001、UF-006 |
| BR-002 | Sheets 的公式及已有特征必须按真实语义读取与保存，不得用空结果假装不存在；共享公式跟随项返回正确平移公式 | B2 共享公式读取为对应 B2 引用，隐藏表/名称/筛选/保护重开保持 | 跟随单元格只有缓存值或保护消失 | Sheets 模型/sidecar | UF-002 |
| BR-003 | Sheets 图片、工作簿媒体和透视等已声明可读写能力必须接到真实模型；保存后媒体关系可重开 | 插图、移动、保存重开图像仍在原锚点 | readWorkbookMedia 抛 Web 不可用 | Sheets bridge/UI/tool | UF-002 |
| BR-004 | PDF 页面操作及 PDF→docx/pptx/xlsx 复用已有算法，产出真实可打开文件；扫描件必须区分图像保真和 OCR 可编辑结果 | 提取页后页数正确，转换后目标编辑器打开可核对 | 下载伪文件或扫描页假称可编辑文本 | PDF/转换包/worker | UF-003 |
| BR-005 | Slides 菜单和工具使用一致的编辑事务语义，布局/主题/结构/媒体/母版/放映/导出等文档功能不得保留不可达 stub | 菜单改布局后工具读取、撤销、保存重开一致 | apply_ops 可做但菜单同操作抛错 | Slides bridge/UI/ops | UF-004 |
| BR-006 | PDF 导出、打印、OCR、模型、搜图与媒体分析在操作前提供真实 readiness；缺依赖即说明服务条件，不能中途要求桌面版 | 已配置打印服务返回 PDF 路径；未配置 OCR 在提交前阻止并提示配置 | 打印弹框返回成功却没有导出文件 | Docs/Markdown/Sheets/Slides/PDF/provider | UF-005 |
| BR-007 | 官方 HTML app 具有 Web 构建、静态路由、打开/编辑/保存和 HTML→Word 的网页闭环，并使用统一能力与状态契约 | 首页打开 HTML，修改保存，转 Word 并重开 | 只拷贝 Electron renderer 就宣称接入 | HTML/shell/relay/plugin | UF-006 |
| BR-008 | P0 盘点中所有文档桥接 stub、工具声明及相关入口必须逐项归属任务；错误前置校验不等于业务实现完成 | 加密文档、附件文本、批量保存等能力均有实现/验收记录 | 删除描述或隐藏入口后宣称全部 Web 可用 | 五族+HTML 能力清单 | UF-001 至 UF-006 |

### 2.2 UF 用户验收场景（索引）

| 场景 ID | Given | When | Then | 角色 | 验证方式 | Evidence |
|---|---|---|---|---|---|---|
| UF-001 | Web 首页与五族构建可用 | 新建/选择/拖入/最近/跨 app 打开五族 | 加载后编辑保存重开；错误不破坏原文件 | 浏览器用户/agent | browser + file reopen | EVD-001 |
| UF-002 | 含共享公式、名称、隐藏表、筛选、保护、媒体、透视的 xlsx | 读取并编辑单元格、图片后保存 | 读取语义准确且未触及特征保真 | 用户/agent | browser + sidecar + zip 对账 | EVD-002 |
| UF-003 | 可读文本 PDF 与扫描 PDF | 页面操作及三个 Office 目标转换 | 文件类型、页数、文本/图片模式可核对 | 用户/agent | browser + target reopen | EVD-003 |
| UF-004 | 含表格/图表/媒体/母版的 pptx | 菜单与工具依次修改、撤销并导出 | UI 与工具观察一致，重开保持 | 用户/agent | browser + HTTP + reopen | EVD-004 |
| UF-005 | provider 就绪状态可查询 | 打印/PDF 导出/OCR/模型/媒体操作 | 可用时返回实物；不可用时开始前解释服务条件 | 用户/agent | browser + provider API | EVD-005 |
| UF-006 | 已同步固定官方版本并构建 HTML | 首页打开 HTML、编辑保存并转换 Word | HTML 和 docx 可重开，网页完成全流程 | 用户/agent | browser + target reopen | EVD-006 |

### 2.3 核心业务流程（步骤级交互脚本）

#### UF-001: 五族网页入口闭环

**前置状态**：隔离 Web profile、临时文档、各族构建就绪；对每族分别走新建、文件选择、拖入、最近文件、跨编辑器打开。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 从上述真实入口新建或打开文件 | 显示加载、禁止尚未就绪的编辑 | 选择正确 app、加载字节并等待 ready | 文件名与内容正确 |
| 2 | 修改一个可核对对象并保存 | 显示 dirty→saving→saved | 用前置状态契约保存到许可目标 | 得到路径或下载文件 |
| 3 | 关闭后重新打开输出 | 显示加载后文档 | 重新解析磁盘字节 | 新内容存在，原有内容保留 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 取消或拒绝文件权限 | 取消选择器/拒绝写句柄 | 返回原页，保留 dirty | 不创建假文档或覆盖磁盘 | 重新选择或明确另存 |
| 损坏文件/缺失构建 | 解析失败或 app 资源缺失 | 显示具体文件/资源错误，编辑禁用 | 返回错误而非空白 ready | 修复输入/构建后重试 |

**界面状态机**：`idle → loading → ready → dirty → saving → saved`；`loading → error`；`saving → error(dirty retained)`。

**入口接线清单**：shell newDoc/newSheet/newSlide/newPdf/newMarkdown、openPath/拖入/最近项 → appForExt → 各 app Web bridge；控制打开沿前置包统一入口。入口、加载态、取消态和错误态须有显式实现任务。

#### UF-002: Sheets 语义、图片与保存

**前置状态**：自造可审计 XLSX fixture，覆盖共享公式主项/跟随项/绝对混合引用、名称、隐藏、筛选、保护、图像和透视；记录压缩包与预期单元格语义。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 从首页打开 fixture 并读取范围/公式 | 加载完成后表格可交互 | 完整模型经 browser 或 sidecar 读取 | 公式、特征、媒体与 fixture 一致 |
| 2 | 改普通值、插入移动一张图片 | 单元格与图片即时更新、dirty 可见 | 复用 workbook 保存管线并保留特征 | 图像位置和文字值正确 |
| 3 | 保存并重开，读取同一范围与特征 | saved 后重载 | 对照 OOXML 和 sidecar 语义 | 修改存在，共享公式/未触及特征仍在 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| sidecar 不可用/退出 | 启动缺二进制或操作中服务终止 | 开始前显示依赖或当前失败，保留会话 | 不把特征填空继续编辑；不写坏文件 | 恢复服务重新读取 |
| 非法图片/受保护目标 | 损坏图片、错误媒体关系或保护阻止写入 | 明确校验错误且原内容仍在 | 不修改 journal/媒体映射 | 改输入或按权限解锁后重试 |

**界面状态机**：`loading → ready → editing → saving → saved`；`loading → dependency-error`；`editing/saving → error(pending retained)`。

**入口接线清单**：Sheets 打开 → web bridge/sidecar；范围/公式工具 → 完整读取模型；图片菜单/agent image skill → 媒体管线；Ctrl+S 与显式 save → 同一保存出口。

#### UF-003: PDF 页面操作与 Office 转换

**前置状态**：文本 PDF、扫描 PDF、多页尺寸 PDF、加密及损坏负例；输出到临时目录。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 从 PDF 页面菜单选择提取/插页/尺寸/拆分/裁切 | 显示选择范围和待执行状态 | 复用 bytes 算法校验并执行 | 预览页数/范围/尺寸正确 |
| 2 | 选择 Word、Excel 或 PowerPoint 转换 | 显示进度和取消操作 | worker 复用纯转换包；扫描页明确标记图像/OCR 模式 | 输出名称、格式、页数与警示准确 |
| 3 | 保存并从目标 app 打开 | 显示保存完成后打开目标 | 按真实字节解析输出 | 文本/图片与承诺模式一致 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 非法页码/损坏输入 | 空选页、越界、解析失败 | 就地指出错误，保留 PDF | 不输出空文件、不覆盖源文件 | 修正范围/重新选文件 |
| worker 失败/取消 | WASM 加载失败、资源耗尽、用户取消 | 显示已失败/已取消与可重试 | 终止任务清理临时输出，不报成功 | 修复资源/缩小范围后重试 |

**界面状态机**：`ready → validating → processing → output-ready → saved`；`validating/processing → error`；`processing → cancelled`。

**入口接线清单**：PDF 页面菜单及 pdf skill → 共享页面算法；convertOffice → worker → pdf2docx 包三个出口 → 保存/下载 → 目标编辑器路由；进度、取消和失败需接线。

#### UF-004: Slides 共用事务与剩余文档功能

**前置状态**：带布局、主题、分节、链接、媒体、母版、动画、演示配置的真实 PPTX；P0 清单把每个相关菜单方法映射具体测试子用例。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 在菜单执行清单中的文档操作 | pending、成功后刷新画布 | 可复用操作走 runTxn；其余接入对应共享逻辑 | 属性/画布与预期一致 |
| 2 | agent 读取并再修改，用户撤销/重做 | 所有观察端显示同一版本 | 使用统一历史与状态协议 | 没有 UI/tool 分叉 |
| 3 | 网页放映或导出图片/PDF，再保存重开 | 展示放映状态/输出文件 | 浏览器展示或服务导出并持久化 | 输出内容可打开验证 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 对象/参数无效 | 不存在元素、非法索引或尺寸 | 清楚报校验错误 | 事务不产生半份修改 | 重新读取选择有效对象 |
| 媒体/放映权限失败 | 媒体不可解码、浏览器拒绝弹窗/全屏 | 显示原因和重试入口，保留内容 | 不标记导出/放映成功 | 更换媒体或用户手势重试 |

**界面状态机**：`ready → pending → dirty → saved`；`pending → error(unchanged)`；`ready → presenting → ready`。

**入口接线清单**：Slides Ribbon/上下文菜单/母版/放映入口 → slidesApi Web 实现；apply_ops 和专用工具 → 同一事务/历史；导出入口 → 输出文件服务。P0 全量 stub 清单必须逐项覆盖，不能只完成 apply_ops。

#### UF-005: 服务型功能在网页可用

**前置状态**：分已配置与未配置服务两组，服务包含打印、OCR、模型、搜索、生图、媒体分析；禁用未经配置的外发。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 打开导出或 AI 操作入口 | 提交前展示服务 readiness 和数据处理位置 | 实际探测所需 provider | 能开始的操作与能力声明一致 |
| 2 | 提交已就绪操作 | loading、取消、禁重入 | 网页经 relay 调正确服务 | PDF 文件、OCR 文本或模型/媒体结果真实返回 |
| 3 | 打开结果并继续编辑 | 成功结果可下载/定位 | 保存目标与内容校验 | 原文件和新结果均可追踪 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 前置依赖缺失 | 未配置 provider/打印程序缺失 | 提交前给出服务配置要求，无桌面版迁移要求 | 不发送业务请求，不伪称能力 available | 配置完成后重新探测 |
| 运行时失败 | 超时、认证过期、空输出或用户取消 | 显示具体原因、内容保留 | 不自动重放写操作、不返回伪成功 | 恢复依赖后显式重试 |

**界面状态机**：`checking → ready / dependency-missing`；`ready → running → success / error / cancelled`。

**入口接线清单**：五族导出/打印、扫描件 OCR、模型/搜索/媒体菜单及工具 → readiness → relay provider → 真实文件或结构化结果；Docs 附件提取、加密相关桥接也归 P0 清单接入并验收。

#### UF-006: 官方 HTML app 的 Web 闭环

**前置状态**：前置官方同步包已完成，记录固定 SHA；从同步后的实际 HTML 代码重新定位，不沿用不存在的预估 symbol。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 首页新建或打开 HTML | 加载并展示 HTML 编辑界面 | 路由到 Web 构建并加载文档 | 内容与文件一致 |
| 2 | 用户或 agent 编辑并显式保存 | dirty→saving→saved | 接入统一状态和保存契约 | 真实 HTML 可重开 |
| 3 | 选择转换为 Word 后打开 | 显示转换进度与输出 | 使用官方转换实现的 Web 兼容入口 | docx 正常打开且内容一致 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 资源不完整/加载失败 | HTML build 缺失、文件不可读 | 明确就绪或文件错误 | 不误路由 Docs、不注册假 ready | 构建/修复输入后重试 |
| 转换失败/外部资源失败 | 非法 HTML、资源不可达或用户取消 | 转换失败，编辑内容保留 | 输出无伪成功，外链依照既有网络边界 | 修复内容或资源后重试 |

**界面状态机**：`loading → ready → dirty → saving → saved`；`ready → converting → output-ready / error / cancelled`。

**入口接线清单**：shell 类型路由/新建菜单 → relay HTML 静态根 → 同步后 HTML Web bridge → 控制会话及保存 → HTML→Word 菜单与输出打开。

### 2.4 INV 不变量

| 不变量 ID | 内容 | 关联 BR/UF | 验证方式 |
|---|---|---|---|
| INV-001 | 保持默认 loopback/路径权限/网络限制，不引入任意路径或任意外发代理 | BR-001、BR-006 | 跨源、越界路径和恶意 URL 负例 |
| INV-002 | 控制模式继续默认显式保存，复用前置包 revision/owner/冲突保护；失败不清 dirty | BR-001 至 BR-008 | 保存并发与失败回归 |
| INV-003 | 纯转换/编辑算法只复用或抽出依赖，不复制另一套漂移实现；不破坏现桌面调用者 | BR-002、BR-004、BR-005 | import 边界、桌面 typecheck/回归 |
| INV-004 | 未实现/未配置能力不得报 available；删除提示词不能充当功能实现 | BR-006、BR-008 | 能力清单与正负真实场景一一对应 |

### 2.5 EVD 证据清单

| 证据 ID | 类型 | 期望证据 | 保存位置 |
|---|---|---|---|
| EVD-001 | browser/file | 五族各入口成功、取消权限、损坏文件/构建负例截图、console/network、重开对账 | `evidence/UF-001/` |
| EVD-002 | browser/data | xlsx 模型真值、共享公式展开、OOXML 对账、图片重开与 sidecar/保护失败 | `evidence/UF-002/` |
| EVD-003 | browser/file | PDF 每项操作和三目标转换输出、重开截图、worker/参数失败 | `evidence/UF-003/` |
| EVD-004 | browser/API | 每个 Slides stub 清单项的 UI/tool/撤销/重开及失败记录 | `evidence/UF-004/` |
| EVD-005 | browser/API/file | 每项 provider 正常/未配置/失败结果，打印/OCR 的真实产物 | `evidence/UF-005/` |
| EVD-006 | browser/file | HTML 编辑保存和 Word 转换输出及两失败分支 | `evidence/UF-006/` |
| EVD-007 | inventory/log | 固定 SHA、全量 bridge/入口/能力归属清单、构建和命令回归日志 | `evidence/phase-0/` |

### 2.6 角色与权限矩阵

无新增用户权限角色；浏览器文件句柄、relay 本机路径许可、provider 配置沿既有边界。外部 agent 与 DSH 使用同一文档控制权限，不扩大远程写入范围。

### 2.7 负向 / 破坏性场景

跨流程必须覆盖：转换期间切换文档、保存冲突、服务退出后重试、双 agent 修改、取消后迟到结果、下载成功但路径保存失败。结果均依 INV-001、INV-002 处理，不覆盖其他会话/原始文件。

### 2.8 非目标

本包不承担官方 Git 合并、前置状态修复和插件 schema 来源统一；不实现桌面安装器/系统菜单/自动更新。所有文档功能缺口仍在本包清单内，不因难度改为“只提示不可用”。

## 3. 技术方案

### 3.1 架构 Before / After

```text
Before: UI/tool → 分散 Web bridge → 部分纯算法 + 部分 desktop stub
After:  UI/tool → 统一能力/状态合同 → 浏览器纯算法或 worker
                                    → relay 服务适配 → sidecar/打印/OCR/provider
```

### 3.2 模块改造

按真实入口划分 shell、Sheets 完整模型、PDF 页面与转换、Slides 事务、服务型输出、Docs/Markdown 剩余桥接、HTML 八个责任面。纯 bytes/事务复用已有包；Node sidecar 与打印只在 relay 服务运行；provider readiness 供菜单与 agent 同时消费。每个 stub 必须映射下面一个实现任务及验收子用例。

### 3.3 三段式定位清单

| 文件 | 稳定定位 | 搜索定位 | 行号 hint | 备注 |
|---|---|---|---|---|
| `../engine/apps/shell/src/renderer/src/web-bridge.ts` | appForExt | `rg "function appForExt" ../engine/apps/shell/src/renderer/src/web-bridge.ts` | L137 | 五族和后续 HTML 入口 |
| `../engine/apps/sheets/src/renderer/web-xlsx.ts` | parseXlsxWorkbook | `rg "export async function parseXlsxWorkbook" ../engine/apps/sheets/src/renderer/web-xlsx.ts` | L444 | 现 Web 模型 |
| `../engine/apps/sheets/src/main/xlsx-sidecar-client.ts` | XlsxSidecarClient | `rg "export class XlsxSidecarClient" ../engine/apps/sheets/src/main/xlsx-sidecar-client.ts` | L27 | 已有纯 Node 传输客户 |
| `../engine/apps/sheets/src/renderer/web-bridge.ts` | desktopApi | `rg "const desktopApi" ../engine/apps/sheets/src/renderer/web-bridge.ts` | L188 | 媒体/图片/透视/导出 |
| `../engine/apps/pdf/src/main/save-pdf.ts` | extractPagesBytes | `rg "export async function extractPagesBytes" ../engine/apps/pdf/src/main/save-pdf.ts` | L436 | 页面纯算法来源 |
| `../engine/packages/pdf2docx/src/index.ts` | convertPdfToDocx | `rg "export async function convertPdfToDocx" ../engine/packages/pdf2docx/src/index.ts` | L42 | 三目标纯转换包 |
| `../engine/apps/pdf/src/renderer/web-bridge.ts` | convertOffice | `rg "convertOffice:" ../engine/apps/pdf/src/renderer/web-bridge.ts` | L298 | worker/UI 接线入口 |
| `../engine/apps/slides/src/renderer/web-bridge.ts` | runTxn / notAvailable | `rg "runTxn" ../engine/apps/slides/src/renderer/web-bridge.ts` | L64/L750 | 菜单和工具复用 |
| `../engine/apps/sheets/src/main/pdf-export.ts` | exportPdf | `rg "export async function exportPdf" ../engine/apps/sheets/src/main/pdf-export.ts` | L16 | 原生打印边界 |
| `../engine/apps/shell/src/main/index.ts` | exportPdfAsDocx | `rg "async function exportPdfAsDocx" ../engine/apps/shell/src/main/index.ts` | L3368 | OCR 服务原入口 |
| `../engine/web/server.mjs` | findStaticRoots | `rg "function findStaticRoots" ../engine/web/server.mjs` | L227 | 含 html 静态根；已知 app 缺 web-dist 返回 404，不回落到 Docs |
| `docs/web-feature-completion/isolated-engine/apps/html/vite.web.config.ts` | webBridgePlugin | `rg "function webBridgePlugin" docs/web-feature-completion/isolated-engine/apps/html/vite.web.config.ts` | L12 | HTML 在隔离合并树；Web Vite 构建注入 web-bridge |
| `docs/web-feature-completion/isolated-engine/apps/html/src/renderer/web-bridge.ts` | htmlApi / exportDocx | `rg "exportDocx:" docs/web-feature-completion/isolated-engine/apps/html/src/renderer/web-bridge.ts` | L614 | 隔离树 HTML 打开/保存/预览；HTML→Word 走 relay job 后打开 Docs |
| `docs/web-feature-completion/isolated-engine/apps/html/src/renderer/control.ts` | initControlMode | `rg "export function initControlMode" docs/web-feature-completion/isolated-engine/apps/html/src/renderer/control.ts` | L83 | 隔离树 HTML 控制会话 readiness/revision/owner |
| `docs/web-feature-completion/isolated-engine/web/html-docx.mjs` | htmlDocxReady / startHtmlDocxJob | `rg "export function htmlDocxReady" docs/web-feature-completion/isolated-engine/web/html-docx.mjs` | L30 | 隔离树官方 html2docx CLI job；仅在 PK zip 后写 dest |
| `packages/tab-genoffice/src/host/capability.ts` | capabilityOf | `rg "export function capabilityOf" packages/tab-genoffice/src/host/capability.ts` | L121 | 前置插件契约消费点 |

### 3.4 API / 数据 / 权限 / 路由影响

新增能力通过前置包既有版本合同扩展；服务 job 必须有取消和错误结果，数据输出保持 Office 文件语义与显式保存，权限沿 INV-001；HTML 在官方同步后扩展静态/控制路由。具体接口字段在未来 Task 1 依据同步后的契约校准，不能预写不存在的 API。


服务型能力有两重闸门：未配置时的前置拒绝必须通过；已配置时也必须产出真实结果才算该能力完成。没有可用 provider 时保留任务未完成/已阻塞，不以“能提示缺配置”替代完整 Web。所有新 HTTP job 字段在 Task 1 依据同步后代码记录，沿用前置错误/取消/owner 协议。

## 4. Phase 计划与任务详情

总入口：[Master handoff](../genoffice-web-roadmap/handoff.md)。未来执行由 master 连续调度本包；本包 CSV 是本包唯一任务状态源，跨包解锁须过 master gate。

依次完成状态安全、插件契合、官方固定同步后开工；官方新增源码以实际同步结果定位。本轮不安装服务、不启应用、不执行这里的实现任务。

任务依赖按下表序号串行。跨包依赖不能由 board.py 自动推断，各包 Task 1 负责核对母包及前置证据；“可开工”不等于本轮授权执行。

实现任务 16 项；其余为基线、验收、测量或回归。所有任务均为未来执行状态。

状态板见同目录 [tasks.csv](tasks.csv)，纯状态和导航，不复制业务合同。

### Phase 0: 可运行起点与基线

### Task 1: 建立完整文档能力清单和验收数据

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / BR-007 / BR-008 / INV-001 / INV-002 / INV-003 / INV-004 / EVD-007
- **前置任务**：无（仍需核对上述跨包条件）
- **风险等级**：P1

**为什么做**：核对前置实际 SHA、真实验收与新增 HTML 源码；扫描五族+HTML bridge 所有 unsupported/notAvailable/空结果及 UI/tool 引用，写 evidence/phase-0/capability-inventory.csv，列固定为 app,entry,bridge,implementation_task,uf,positive_case,negative_case,dependency,status。不把安装器/更新器算文档入口。

**涉及文件与定位**：

- `../engine/apps/shell/src/renderer/src/web-bridge.ts`：appForExt；`rg "function appForExt" ../engine/apps/shell/src/renderer/src/web-bridge.ts`；L137，行号仅 hint。
- `../engine/apps/sheets/src/renderer/web-xlsx.ts`：parseXlsxWorkbook；`rg "export async function parseXlsxWorkbook" ../engine/apps/sheets/src/renderer/web-xlsx.ts`；L444，行号仅 hint。
- `../engine/apps/sheets/src/main/xlsx-sidecar-client.ts`：XlsxSidecarClient；`rg "export class XlsxSidecarClient" ../engine/apps/sheets/src/main/xlsx-sidecar-client.ts`；L27，行号仅 hint。
- `../engine/apps/sheets/src/renderer/web-bridge.ts`：desktopApi；`rg "const desktopApi" ../engine/apps/sheets/src/renderer/web-bridge.ts`；L188，行号仅 hint。
- `../engine/apps/pdf/src/main/save-pdf.ts`：extractPagesBytes；`rg "export async function extractPagesBytes" ../engine/apps/pdf/src/main/save-pdf.ts`；L436，行号仅 hint。
- `../engine/packages/pdf2docx/src/index.ts`：convertPdfToDocx；`rg "export async function convertPdfToDocx" ../engine/packages/pdf2docx/src/index.ts`；L42，行号仅 hint。
- `../engine/apps/pdf/src/renderer/web-bridge.ts`：convertOffice；`rg "convertOffice:" ../engine/apps/pdf/src/renderer/web-bridge.ts`；L298，行号仅 hint。
- `../engine/apps/slides/src/renderer/web-bridge.ts`：runTxn / notAvailable；`rg "runTxn" ../engine/apps/slides/src/renderer/web-bridge.ts`；L64/L750，行号仅 hint。
- `../engine/apps/sheets/src/main/pdf-export.ts`：exportPdf；`rg "export async function exportPdf" ../engine/apps/sheets/src/main/pdf-export.ts`；L16，行号仅 hint。
- `../engine/apps/shell/src/main/index.ts`：exportPdfAsDocx；`rg "async function exportPdfAsDocx" ../engine/apps/shell/src/main/index.ts`；L3368，行号仅 hint。
- `../engine/web/server.mjs`：findStaticRoots；`rg "function findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。
- `packages/tab-genoffice/src/host/capability.ts`：capabilityOf；`rg "export function capabilityOf" packages/tab-genoffice/src/host/capability.ts`；L121，行号仅 hint。

**具体操作**：

1. 核对前置实际 SHA、真实验收与新增 HTML 源码；扫描五族+HTML bridge 所有 unsupported/notAvailable/空结果及 UI/tool 引用，写 evidence/phase-0/capability-inventory.csv，列固定为 app,entry,bridge,implementation_task,uf,positive_case,negative_case,dependency,status。不把安装器/更新器算文档入口。
2. 每项必须映射 Task 2—19 的具体能力组；落不到组的项先在第 2 章补合同和失败流程，再增任务，不能塞进“清理其他 stub”或隐掉入口。
3. 未来新建 web/e2e-web-features.mjs，支持 --case/--all/--out 并按能力清单枚举子用例；准备共享公式/名称/隐藏/保护/图片/透视 XLSX、文本/扫描/加密 PDF、复杂 PPTX、含附件/加密文档、HTML fixture，独立校准真实 sidecar/打印/OCR/provider 部署条件。

**验证**：`npm --prefix ../engine run typecheck`；`npm --prefix ../engine run web:build --workspaces --if-present`；`node ../engine/web/e2e-web-features.mjs --case inventory` → 清单每行有负责任务与真值数据，依赖探测有记录

**Evidence**：`evidence/phase-0/task-1.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 2: 完成首页到 Sheets 保存的最小网页闭环

- **关联**：BR-001 / BR-002 / UF-001 / UF-002 / INV-001 / INV-002 / EVD-001 / EVD-002
- **前置任务**：1
- **风险等级**：P0

**为什么做**：先接 shell xlsx 类型路由、新建/打开与加载态，选择完整读取模型：优先经 relay 复用已存在 sidecar 客户端，Node spawn 不入 browser bundle。

**涉及文件与定位**：

- `../engine/apps/shell/src/renderer/src/web-bridge.ts`：appForExt；`rg "function appForExt" ../engine/apps/shell/src/renderer/src/web-bridge.ts`；L137，行号仅 hint。
- `../engine/apps/sheets/src/renderer/web-xlsx.ts`：parseXlsxWorkbook；`rg "export async function parseXlsxWorkbook" ../engine/apps/sheets/src/renderer/web-xlsx.ts`；L444，行号仅 hint。
- `../engine/apps/sheets/src/main/xlsx-sidecar-client.ts`：XlsxSidecarClient；`rg "export class XlsxSidecarClient" ../engine/apps/sheets/src/main/xlsx-sidecar-client.ts`；L27，行号仅 hint。
- `../engine/apps/sheets/src/renderer/web-bridge.ts`：desktopApi；`rg "const desktopApi" ../engine/apps/sheets/src/renderer/web-bridge.ts`；L188，行号仅 hint。
- `../engine/web/server.mjs`：findStaticRoots；`rg "function findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。

**具体操作**：

1. 先接 shell xlsx 类型路由、新建/打开与加载态，选择完整读取模型：优先经 relay 复用已存在 sidecar 客户端，Node spawn 不入 browser bundle。
2. 只以一个最小工作簿证明首页→Sheets→改值→显式保存→重开；不依赖 Electron 页面。错误、取消和 ready 按前置状态接口接线，成功后再扩大特征。

**验证**：`node ../engine/web/e2e-web-features.mjs --case sheets-slice` → 真实 XLSX 字节闭环通过

**Evidence**：`evidence/phase-0/task-2.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 3: 补齐五族新建打开和跨应用入口

- **关联**：BR-001 / BR-008 / UF-001 / INV-001 / INV-002 / EVD-001
- **前置任务**：2
- **风险等级**：P1

**为什么做**：将 shell 新建、文件选择、拖入、最近文件及各编辑器跨 app 入口统一按文件族路由；补合法空白 xlsx/pptx/pdf 的创建，不返回不可用 stub。

**涉及文件与定位**：

- `../engine/apps/shell/src/renderer/src/web-bridge.ts`：appForExt；`rg "function appForExt" ../engine/apps/shell/src/renderer/src/web-bridge.ts`；L137，行号仅 hint。
- `../engine/web/server.mjs`：findStaticRoots；`rg "function findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。

**具体操作**：

1. 将 shell 新建、文件选择、拖入、最近文件及各编辑器跨 app 入口统一按文件族路由；补合法空白 xlsx/pptx/pdf 的创建，不返回不可用 stub。
2. 所有入口有 loading/取消/权限失败/解析失败反馈；对五族逐项实际点击，下载和磁盘路径保存都以真实产物为准。HTML 后续任务再扩同一路由。

**验证**：`node ../engine/web/e2e-web-features.mjs --case entry-matrix` → 五族乘五类入口及失败恢复通过

**Evidence**：`evidence/phase-0/task-3.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 4: 恢复 Sheets 共享公式及工作簿特征语义

- **关联**：BR-002 / UF-002 / INV-002 / INV-003 / EVD-002
- **前置任务**：3
- **风险等级**：P1

**为什么做**：复用完整读取/保存管线，正确展开共享公式跟随项的相对/绝对/混合引用；名称、隐藏、表格、筛选、保护等不能以空字段掩盖读取缺失。

**涉及文件与定位**：

- `../engine/apps/sheets/src/renderer/web-xlsx.ts`：parseXlsxWorkbook；`rg "export async function parseXlsxWorkbook" ../engine/apps/sheets/src/renderer/web-xlsx.ts`；L444，行号仅 hint。
- `../engine/apps/sheets/src/main/xlsx-sidecar-client.ts`：XlsxSidecarClient；`rg "export class XlsxSidecarClient" ../engine/apps/sheets/src/main/xlsx-sidecar-client.ts`；L27，行号仅 hint。
- `../engine/apps/sheets/src/renderer/web-bridge.ts`：desktopApi；`rg "const desktopApi" ../engine/apps/sheets/src/renderer/web-bridge.ts`；L188，行号仅 hint。

**具体操作**：

1. 复用完整读取/保存管线，正确展开共享公式跟随项的相对/绝对/混合引用；名称、隐藏、表格、筛选、保护等不能以空字段掩盖读取缺失。
2. 读取真值与既有 fixture OOXML/sidecar 双向核对，修改无关单元格后保存重开验证未触及特征保真；拒绝受保护目标写入时不能修改 journal。

**验证**：`node ../engine/web/e2e-web-features.mjs --case sheets-semantics`；`npm --prefix ../engine run test -w @genoffice/sheets` → 语义和特征保真通过

**Evidence**：`evidence/phase-0/task-4.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 5: 接入 Sheets 媒体图片及透视数据

- **关联**：BR-003 / BR-008 / UF-002 / INV-002 / INV-003 / EVD-002
- **前置任务**：4
- **风险等级**：P1

**为什么做**：readWorkbookMedia/readLocalImage/readPivotDefinition 等清单项接真实模型与媒体关系；菜单和 agent 使用同一图片/锚点保存管线。

**涉及文件与定位**：

- `../engine/apps/sheets/src/main/xlsx-sidecar-client.ts`：XlsxSidecarClient；`rg "export class XlsxSidecarClient" ../engine/apps/sheets/src/main/xlsx-sidecar-client.ts`；L27，行号仅 hint。
- `../engine/apps/sheets/src/renderer/web-bridge.ts`：desktopApi；`rg "const desktopApi" ../engine/apps/sheets/src/renderer/web-bridge.ts`；L188，行号仅 hint。

**具体操作**：

1. readWorkbookMedia/readLocalImage/readPivotDefinition 等清单项接真实模型与媒体关系；菜单和 agent 使用同一图片/锚点保存管线。
2. 插图、移动、保存、重开验证图像关系和锚点；损坏媒体、无效关系、sidecar 退出和保护失败保持已有工作簿，重连后从真实模型恢复。

**验证**：`node ../engine/web/e2e-web-features.mjs --case sheets-media` → 图片/透视读取及正负保存回放通过

**Evidence**：`evidence/phase-0/task-5.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 6: 执行 Phase 0 回归验证

- **关联**：BR-001 / BR-002 / BR-003 / UF-001 / UF-002 / INV-001 / INV-002 / INV-003 / INV-004 / EVD-007
- **前置任务**：5
- **风险等级**：P1

**为什么做**：复验首页与完整 Sheets 模型，保存前后 OOXML 和前置版本/冲突保护；确认不存在空数据假成功。

**涉及文件与定位**：

- `../engine/apps/shell/src/renderer/src/web-bridge.ts`：appForExt；`rg "function appForExt" ../engine/apps/shell/src/renderer/src/web-bridge.ts`；L137，行号仅 hint。
- `../engine/apps/sheets/src/renderer/web-xlsx.ts`：parseXlsxWorkbook；`rg "export async function parseXlsxWorkbook" ../engine/apps/sheets/src/renderer/web-xlsx.ts`；L444，行号仅 hint。
- `../engine/apps/sheets/src/renderer/web-bridge.ts`：desktopApi；`rg "const desktopApi" ../engine/apps/sheets/src/renderer/web-bridge.ts`；L188，行号仅 hint。

**具体操作**：

1. 复验首页与完整 Sheets 模型，保存前后 OOXML 和前置版本/冲突保护；确认不存在空数据假成功。

**验证**：`npm --prefix ../engine run typecheck`；`npm --prefix ../engine run web:build --workspaces --if-present`；`node ../engine/web/e2e-web-features.mjs --case entries-sheets` → 通过

**Evidence**：`evidence/phase-0/task-6.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Phase 1: 按依赖扩展并验证

### Task 7: 接通 PDF 页面算法与网页菜单

- **关联**：BR-004 / UF-003 / INV-002 / INV-003 / EVD-003
- **前置任务**：6
- **风险等级**：P1

**为什么做**：将已有 extractPagesBytes/insertBlankPageBytes/setPageSizeBytes/splitPagesBytes/cropPagesBytes 与 UI/tool 接通，必要时仅抽离 Electron/Node import。

**涉及文件与定位**：

- `../engine/apps/pdf/src/main/save-pdf.ts`：extractPagesBytes；`rg "export async function extractPagesBytes" ../engine/apps/pdf/src/main/save-pdf.ts`；L436，行号仅 hint。
- `../engine/apps/pdf/src/renderer/web-bridge.ts`：convertOffice；`rg "convertOffice:" ../engine/apps/pdf/src/renderer/web-bridge.ts`；L298，行号仅 hint。

**具体操作**：

1. 将已有 extractPagesBytes/insertBlankPageBytes/setPageSizeBytes/splitPagesBytes/cropPagesBytes 与 UI/tool 接通，必要时仅抽离 Electron/Node import。
2. 先提取页真实下载与重开，再逐项尺寸、拆分、裁切/插页；非法范围、取消和解析错误不覆盖源文件，进度与选择结果可见。

**验证**：`node ../engine/web/e2e-web-features.mjs --case pdf-pages`；`npm --prefix ../engine run test -w @genoffice/pdf` → 每项页数尺寸及失败通过

**Evidence**：`evidence/phase-0/task-7.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 8: 接入 PDF 三目标转换和 worker 取消

- **关联**：BR-004 / UF-003 / INV-001 / INV-002 / INV-003 / EVD-003
- **前置任务**：7
- **风险等级**：P1

**为什么做**：复用 pdf2docx 包，先 PDF→Word 输出并在 Docs 重开，再扩 PPTX/XLSX；worker 负责 WASM/进度/取消/错误，不重新实现转换算法。

**涉及文件与定位**：

- `../engine/packages/pdf2docx/src/index.ts`：convertPdfToDocx；`rg "export async function convertPdfToDocx" ../engine/packages/pdf2docx/src/index.ts`；L42，行号仅 hint。
- `../engine/apps/pdf/src/renderer/web-bridge.ts`：convertOffice；`rg "convertOffice:" ../engine/apps/pdf/src/renderer/web-bridge.ts`；L298，行号仅 hint。

**具体操作**：

1. 复用 pdf2docx 包，先 PDF→Word 输出并在 Docs 重开，再扩 PPTX/XLSX；worker 负责 WASM/进度/取消/错误，不重新实现转换算法。
2. 扫描页区分图像保真与 OCR 模式，未做 OCR 不宣称可编辑文字；WASM/资源/取消失败清理临时输出，保留原 PDF 和编辑内容。

**验证**：`node ../engine/web/e2e-web-features.mjs --case pdf-convert`；`npm --prefix ../engine run test -w @genoffice/pdf2docx` → 三目标真实重开及失败通过

**Evidence**：`evidence/phase-0/task-8.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 9: 统一 Slides 布局主题结构菜单事务

- **关联**：BR-005 / UF-004 / INV-002 / INV-003 / EVD-004
- **前置任务**：8
- **风险等级**：P1

**为什么做**：从一个已有 apply_ops 可执行的布局操作证明菜单与 runTxn/历史共用，再扩布局、主题、页面顺序、分节和清单中的结构操作。

**涉及文件与定位**：

- `../engine/apps/slides/src/renderer/web-bridge.ts`：runTxn / notAvailable；`rg "runTxn" ../engine/apps/slides/src/renderer/web-bridge.ts`；L64/L750，行号仅 hint。

**具体操作**：

1. 从一个已有 apply_ops 可执行的布局操作证明菜单与 runTxn/历史共用，再扩布局、主题、页面顺序、分节和清单中的结构操作。
2. 每个菜单实际点击后由工具读出同一变更，撤销/重做、保存重开一致；非法对象/尺寸校验不留部分修改，接 pending/error 反馈。

**验证**：`node ../engine/web/e2e-web-features.mjs --case slides-structure` → 清单结构组逐项 UI/tool/撤销/重开通过

**Evidence**：`evidence/phase-0/task-9.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 10: 接入 Slides 媒体链接与输出管线

- **关联**：BR-005 / BR-008 / UF-004 / INV-001 / INV-002 / EVD-004
- **前置任务**：9
- **风险等级**：P1

**为什么做**：按清单接图片/音视频/链接、媒体属性及图片导出入口，复用资产授权与当前事务路径；PDF 导出准备共享服务接口由 Task 13 接完。

**涉及文件与定位**：

- `../engine/apps/slides/src/renderer/web-bridge.ts`：runTxn / notAvailable；`rg "runTxn" ../engine/apps/slides/src/renderer/web-bridge.ts`；L64/L750，行号仅 hint。

**具体操作**：

1. 按清单接图片/音视频/链接、媒体属性及图片导出入口，复用资产授权与当前事务路径；PDF 导出准备共享服务接口由 Task 13 接完。
2. 每项真实媒体解码与保存重开，非法媒体/URL 不扩网络权限；错误明确可恢复且内容保留。

**验证**：`node ../engine/web/e2e-web-features.mjs --case slides-media` → 媒体链接与图片输出通过

**Evidence**：`evidence/phase-0/task-10.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 11: 接入 Slides 母版动画和网页放映

- **关联**：BR-005 / BR-008 / UF-004 / INV-002 / INV-003 / EVD-004
- **前置任务**：10
- **风险等级**：P1

**为什么做**：将清单母版、动画与演示配置接实际文档逻辑，复用 UI/tool 持久化和历史；网页放映使用浏览器可实现显示路径。

**涉及文件与定位**：

- `../engine/apps/slides/src/renderer/web-bridge.ts`：runTxn / notAvailable；`rg "runTxn" ../engine/apps/slides/src/renderer/web-bridge.ts`；L64/L750，行号仅 hint。

**具体操作**：

1. 将清单母版、动画与演示配置接实际文档逻辑，复用 UI/tool 持久化和历史；网页放映使用浏览器可实现显示路径。
2. 从真实入口进入/退出放映，用户手势与全屏/弹窗拒绝给出恢复操作；配置保存重开与可视播放一致，不能只替换 notAvailable 文案。

**验证**：`node ../engine/web/e2e-web-features.mjs --case slides-presentation` → 母版/动画/放映与权限失败通过

**Evidence**：`evidence/phase-0/task-11.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 12: 执行 Phase 1 回归验证

- **关联**：BR-004 / BR-005 / UF-003 / UF-004 / INV-001 / INV-002 / INV-003 / INV-004 / EVD-007
- **前置任务**：11
- **风险等级**：P1

**为什么做**：复验所有 PDF 转换产物及 Slides 各能力组；交错编辑、撤销和导出不得破坏前置保存快照/owner 保护。

**涉及文件与定位**：

- `../engine/apps/pdf/src/main/save-pdf.ts`：extractPagesBytes；`rg "export async function extractPagesBytes" ../engine/apps/pdf/src/main/save-pdf.ts`；L436，行号仅 hint。
- `../engine/packages/pdf2docx/src/index.ts`：convertPdfToDocx；`rg "export async function convertPdfToDocx" ../engine/packages/pdf2docx/src/index.ts`；L42，行号仅 hint。
- `../engine/apps/pdf/src/renderer/web-bridge.ts`：convertOffice；`rg "convertOffice:" ../engine/apps/pdf/src/renderer/web-bridge.ts`；L298，行号仅 hint。
- `../engine/apps/slides/src/renderer/web-bridge.ts`：runTxn / notAvailable；`rg "runTxn" ../engine/apps/slides/src/renderer/web-bridge.ts`；L64/L750，行号仅 hint。

**具体操作**：

1. 复验所有 PDF 转换产物及 Slides 各能力组；交错编辑、撤销和导出不得破坏前置保存快照/owner 保护。

**验证**：`npm --prefix ../engine run typecheck`；`npm --prefix ../engine run web:build --workspaces --if-present`；`node ../engine/web/e2e-web-features.mjs --case pdf-slides` → 全组通过

**Evidence**：`evidence/phase-0/task-12.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Phase 2: 完整接线与验收

### Task 13: 提供网页打印和真实 PDF 导出服务

- **关联**：BR-006 / UF-005 / INV-001 / INV-002 / INV-003 / EVD-005
- **前置任务**：12
- **风险等级**：P1

**为什么做**：通过隔离服务执行器复用文档渲染和打印逻辑，先证明 Docs 真实 PDF 输出，再接 Markdown/Sheets/Slides/PDF 相关出口。不能以调用浏览器打印弹框等同导出成功。

**涉及文件与定位**：

- `../engine/apps/sheets/src/renderer/web-bridge.ts`：desktopApi；`rg "const desktopApi" ../engine/apps/sheets/src/renderer/web-bridge.ts`；L188，行号仅 hint。
- `../engine/apps/slides/src/renderer/web-bridge.ts`：runTxn / notAvailable；`rg "runTxn" ../engine/apps/slides/src/renderer/web-bridge.ts`；L64/L750，行号仅 hint。
- `../engine/apps/sheets/src/main/pdf-export.ts`：exportPdf；`rg "export async function exportPdf" ../engine/apps/sheets/src/main/pdf-export.ts`；L16，行号仅 hint。
- `../engine/web/server.mjs`：findStaticRoots；`rg "function findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。

**具体操作**：

1. 通过隔离服务执行器复用文档渲染和打印逻辑，先证明 Docs 真实 PDF 输出，再接 Markdown/Sheets/Slides/PDF 相关出口。不能以调用浏览器打印弹框等同导出成功。
2. 菜单和工具在提交前探测服务 readiness； job 进度/取消/错误与输出路径按前置合同，产物页面/内容可核对，缺依赖时保留未完成。

**验证**：`node ../engine/web/e2e-web-features.mjs --case print-export` → 每个宣称 app 产生真实 PDF，缺依赖和取消通过

**Evidence**：`evidence/phase-0/task-13.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 14: 接通扫描件 OCR 和结果回到编辑器

- **关联**：BR-004 / BR-006 / UF-003 / UF-005 / INV-001 / INV-002 / EVD-003 / EVD-005
- **前置任务**：13
- **风险等级**：P1

**为什么做**：复用 shell 已有 OCR/provider 分流，经 Web 服务入口提供配置/可用性检查，再用真实已配置服务处理自造扫描页并回填可编辑目标。

**涉及文件与定位**：

- `../engine/packages/pdf2docx/src/index.ts`：convertPdfToDocx；`rg "export async function convertPdfToDocx" ../engine/packages/pdf2docx/src/index.ts`；L42，行号仅 hint。
- `../engine/apps/pdf/src/renderer/web-bridge.ts`：convertOffice；`rg "convertOffice:" ../engine/apps/pdf/src/renderer/web-bridge.ts`；L298，行号仅 hint。
- `../engine/apps/shell/src/main/index.ts`：exportPdfAsDocx；`rg "async function exportPdfAsDocx" ../engine/apps/shell/src/main/index.ts`；L3368，行号仅 hint。
- `../engine/web/server.mjs`：findStaticRoots；`rg "function findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。

**具体操作**：

1. 复用 shell 已有 OCR/provider 分流，经 Web 服务入口提供配置/可用性检查，再用真实已配置服务处理自造扫描页并回填可编辑目标。
2. 区分图像与识别文字模式、失败/取消/空结果；未经配置不外发文件，OCR 成功须核对识别内容与目标编辑器重开。

**验证**：`node ../engine/web/e2e-web-features.mjs --case ocr` → 真实识别成功、未配置和运行失败均通过

**Evidence**：`evidence/phase-0/task-14.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 15: 接通模型搜索生成与媒体分析能力

- **关联**：BR-006 / BR-008 / UF-005 / INV-001 / INV-002 / INV-004 / EVD-005
- **前置任务**：14
- **风险等级**：P1

**为什么做**：逐项登记并复用已安装 provider 的模型、搜索、生图、媒体分析接口，前置 readiness 同时提供给 UI 和工具规划；没有现服务适配时按清单逐项实现。

**涉及文件与定位**：

- `../engine/apps/slides/src/renderer/web-bridge.ts`：runTxn / notAvailable；`rg "runTxn" ../engine/apps/slides/src/renderer/web-bridge.ts`；L64/L750，行号仅 hint。
- `../engine/apps/shell/src/main/index.ts`：exportPdfAsDocx；`rg "async function exportPdfAsDocx" ../engine/apps/shell/src/main/index.ts`；L3368，行号仅 hint。
- `../engine/web/server.mjs`：findStaticRoots；`rg "function findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。
- `packages/tab-genoffice/src/host/capability.ts`：capabilityOf；`rg "export function capabilityOf" packages/tab-genoffice/src/host/capability.ts`；L121，行号仅 hint。

**具体操作**：

1. 逐项登记并复用已安装 provider 的模型、搜索、生图、媒体分析接口，前置 readiness 同时提供给 UI 和工具规划；没有现服务适配时按清单逐项实现。
2. 每项已配置服务真实请求与结果落地、认证过期/超时/取消/空输出均回放；不将删除桌面提示视为完成，不自动重放写入。

**验证**：`node ../engine/web/e2e-web-features.mjs --case providers` → 清单每项正例、缺配置、运行错误和恢复通过

**Evidence**：`evidence/phase-0/task-15.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 16: 补齐 Docs 和 Markdown 剩余文档桥接

- **关联**：BR-006 / BR-008 / UF-001 / UF-005 / INV-001 / INV-002 / INV-003 / EVD-001 / EVD-005
- **前置任务**：15
- **风险等级**：P1

**为什么做**：依据 Task 1 清单分别接 Docs 加密/解密、附件文本提取、批量保存及 Markdown 未接文档功能；每行必须有自身操作/真值/失败子用例，涉及新合同先走变更。

**涉及文件与定位**：

- `../engine/apps/shell/src/renderer/src/web-bridge.ts`：appForExt；`rg "function appForExt" ../engine/apps/shell/src/renderer/src/web-bridge.ts`；L137，行号仅 hint。
- `../engine/apps/shell/src/main/index.ts`：exportPdfAsDocx；`rg "async function exportPdfAsDocx" ../engine/apps/shell/src/main/index.ts`；L3368，行号仅 hint。
- `../engine/web/server.mjs`：findStaticRoots；`rg "function findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。

**具体操作**：

1. 依据 Task 1 清单分别接 Docs 加密/解密、附件文本提取、批量保存及 Markdown 未接文档功能；每行必须有自身操作/真值/失败子用例，涉及新合同先走变更。
2. 复用官方纯函数和现服务边界，密码/附件内容不进日志；输入损坏、取消与权限失败保留原文。真实菜单和 agent 入口与结果打开一并验证。

**验证**：`node ../engine/web/e2e-web-features.mjs --case docs-markdown` → 所有清单归属项真实通过，未归属项为零

**Evidence**：`evidence/phase-0/task-16.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 17: 接入官方 HTML 网页编辑和控制闭环

- **关联**：BR-001 / BR-007 / UF-006 / INV-001 / INV-002 / INV-003 / EVD-006
- **前置任务**：16
- **风险等级**：P1

**为什么做**：根据同步后真实 HTML app 接 Web Vite 构建、静态根、类型路由和 bridge；定位回写第 3.3 节，不预造官方 symbol。

**涉及文件与定位**：

- `../engine/apps/shell/src/renderer/src/web-bridge.ts`：appForExt；`rg "function appForExt" ../engine/apps/shell/src/renderer/src/web-bridge.ts`；L137，行号仅 hint。
- `../engine/web/server.mjs`：findStaticRoots；`rg "function findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。

**具体操作**：

1. 根据同步后真实 HTML app 接 Web Vite 构建、静态根、类型路由和 bridge；定位回写第 3.3 节，不预造官方 symbol。
2. 连接用户/agent 编辑、readiness/revision/owner、显式保存与重开；外部资源按既有网络策略处理，资源缺失和加载失败有可恢复反馈。

**验证**：`npm --prefix ../engine run web:build --workspaces --if-present`；`node ../engine/web/e2e-web-features.mjs --case html-edit` → HTML 网页和控制真实闭环通过

**Evidence**：`evidence/phase-0/task-17.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 18: 接通 HTML 转 Word 及目标打开

- **关联**：BR-007 / UF-006 / INV-001 / INV-002 / INV-003 / EVD-006
- **前置任务**：17
- **风险等级**：P1

**为什么做**：复用官方 HTML→Word 实现的 Web/服务边界，接菜单/tool、进度、取消和输出打开；不把 Electron renderer 直接包装后宣称可用。

**涉及文件与定位**：

- `../engine/packages/html2docx/tools/cli.ts`：官方 HTML→Word CLI；`rg "html2docx" ../engine/packages/html2docx/tools/cli.ts`；行号仅 hint。
- `../engine/web/html-docx.mjs`：htmlDocxReady / startHtmlDocxJob；`rg "export function htmlDocxReady" ../engine/web/html-docx.mjs`；L30，行号仅 hint。
- `../engine/web/server.mjs`：`/api/html/docx/*`；`rg "html/docx" ../engine/web/server.mjs`；L663，行号仅 hint。
- `../engine/apps/html/src/renderer/web-bridge.ts`：exportDocx；`rg "exportDocx:" ../engine/apps/html/src/renderer/web-bridge.ts`；L614，行号仅 hint。

**具体操作**：

1. 复用官方 HTML→Word 实现的 Web/服务边界，接菜单/tool、进度、取消和输出打开；不把 Electron renderer 直接包装后宣称可用。
2. 合法 HTML 转 DOCX 并在 Docs 重开核对；非法内容、外链失败和用户取消无伪成功，编辑内容保留。

**验证**：`node ../engine/web/e2e-web-features.mjs --case html-docx` → 正常转换与两类失败恢复通过

**Evidence**：`evidence/phase-0/task-18.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 19: 对齐插件完整网页能力与清单覆盖

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / BR-007 / BR-008 / UF-001 / UF-002 / UF-003 / UF-004 / UF-005 / UF-006 / INV-004 / EVD-007
- **前置任务**：18
- **风险等级**：P1

**为什么做**：将已验收 Web 能力及 HTML 新族入口接到插件当前工具/能力层，保持普通文件预览默认规则；服务依赖在规划前返回明确可用性，不在请求中途才引导桌面。

**涉及文件与定位**：

- `packages/tab-genoffice/src/host/capability.ts`：capabilityOf / CAPABILITY html:*；`rg "html:export_docx" packages/tab-genoffice/src/host/capability.ts`；行号仅 hint。
- `packages/tab-genoffice/src/host/tool-schema.ts`：html_* CONTROL_TOOL_TABLE；`rg "name: 'html_export_docx'" packages/tab-genoffice/src/host/tool-schema.ts`；行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：html_open / html_export_docx / genoffice_services；`rg "executeHtmlExportDocx|genoffice_services" packages/tab-genoffice/src/host/tools.ts`；行号仅 hint。
- `packages/tab-genoffice/src/tabs/coexist.ts`：CLAIMED_EXTS 不含 html，CONTROL_EXTS 含 html；`rg "CONTROL_EXTS" packages/tab-genoffice/src/tabs/coexist.ts`；行号仅 hint。

**具体操作**：

1. 将已验收 Web 能力及 HTML 新族入口接到插件当前工具/能力层，保持普通文件预览默认规则；服务依赖在规划前返回明确可用性，不在请求中途才引导桌面。
2. 检查 capability-inventory 每项已接线/有正例和失败证据，无孤立功能和未归属 stub；保留效率包后续统一 manifest 工作，不此处再造发现框架。

**验证**：`npm run typecheck`；`npm test`；`npm run build`；`npm run standard:check`；`node ../engine/web/e2e-web-features.mjs --case capability` → 清单覆盖和插件真实入口通过

**Evidence**：`evidence/phase-0/task-19.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 20: 执行 spec 5.2 真实场景全套测试

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / BR-007 / BR-008 / UF-001 / UF-002 / UF-003 / UF-004 / UF-005 / UF-006 / INV-001 / INV-002 / INV-003 / INV-004 / EVD-001 / EVD-002 / EVD-003 / EVD-004 / EVD-005 / EVD-006 / EVD-007
- **前置任务**：19
- **风险等级**：P1

**为什么做**：按矩阵并展开清单每个入口/方法/服务，真实执行正例、负例及恢复；覆盖跨文档切换、迟到取消结果、磁盘保存失败与双 agent 冲突，归档所有输出并重开。

**涉及文件与定位**：

- `../engine/apps/shell/src/renderer/src/web-bridge.ts`：appForExt；`rg "function appForExt" ../engine/apps/shell/src/renderer/src/web-bridge.ts`；L137，行号仅 hint。
- `../engine/apps/sheets/src/renderer/web-xlsx.ts`：parseXlsxWorkbook；`rg "export async function parseXlsxWorkbook" ../engine/apps/sheets/src/renderer/web-xlsx.ts`；L444，行号仅 hint。
- `../engine/apps/pdf/src/main/save-pdf.ts`：extractPagesBytes；`rg "export async function extractPagesBytes" ../engine/apps/pdf/src/main/save-pdf.ts`；L436，行号仅 hint。
- `../engine/packages/pdf2docx/src/index.ts`：convertPdfToDocx；`rg "export async function convertPdfToDocx" ../engine/packages/pdf2docx/src/index.ts`；L42，行号仅 hint。
- `../engine/apps/slides/src/renderer/web-bridge.ts`：runTxn / notAvailable；`rg "runTxn" ../engine/apps/slides/src/renderer/web-bridge.ts`；L64/L750，行号仅 hint。
- `../engine/apps/shell/src/main/index.ts`：exportPdfAsDocx；`rg "async function exportPdfAsDocx" ../engine/apps/shell/src/main/index.ts`；L3368，行号仅 hint。
- `../engine/web/server.mjs`：findStaticRoots；`rg "function findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。
- `packages/tab-genoffice/src/host/capability.ts`：capabilityOf；`rg "export function capabilityOf" packages/tab-genoffice/src/host/capability.ts`；L121，行号仅 hint。

**具体操作**：

1. 按矩阵并展开清单每个入口/方法/服务，真实执行正例、负例及恢复；覆盖跨文档切换、迟到取消结果、磁盘保存失败与双 agent 冲突，归档所有输出并重开。

**验证**：`node ../engine/web/e2e-web-features.mjs --all` → 矩阵和清单全部行通过，无跳过服务正例

**Evidence**：`evidence/phase-0/task-20.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 21: 执行 Phase 2 回归验证

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / BR-007 / BR-008 / INV-001 / INV-002 / INV-003 / INV-004 / EVD-007
- **前置任务**：20
- **风险等级**：P1

**为什么做**：完整相关 suite 和 Web 构建通过；桌面调用者仅命令级回归，用户 Web 完成仍以本包真实矩阵为准；验收后重跑包证据闸门。

**涉及文件与定位**：

- `../engine/apps/shell/src/renderer/src/web-bridge.ts`：appForExt；`rg "function appForExt" ../engine/apps/shell/src/renderer/src/web-bridge.ts`；L137，行号仅 hint。
- `../engine/apps/sheets/src/renderer/web-xlsx.ts`：parseXlsxWorkbook；`rg "export async function parseXlsxWorkbook" ../engine/apps/sheets/src/renderer/web-xlsx.ts`；L444，行号仅 hint。
- `../engine/apps/pdf/src/main/save-pdf.ts`：extractPagesBytes；`rg "export async function extractPagesBytes" ../engine/apps/pdf/src/main/save-pdf.ts`；L436，行号仅 hint。
- `../engine/packages/pdf2docx/src/index.ts`：convertPdfToDocx；`rg "export async function convertPdfToDocx" ../engine/packages/pdf2docx/src/index.ts`；L42，行号仅 hint。
- `../engine/apps/slides/src/renderer/web-bridge.ts`：runTxn / notAvailable；`rg "runTxn" ../engine/apps/slides/src/renderer/web-bridge.ts`；L64/L750，行号仅 hint。
- `../engine/web/server.mjs`：findStaticRoots；`rg "function findStaticRoots" ../engine/web/server.mjs`；L186，行号仅 hint。
- `packages/tab-genoffice/src/host/capability.ts`：capabilityOf；`rg "export function capabilityOf" packages/tab-genoffice/src/host/capability.ts`；L121，行号仅 hint。

**具体操作**：

1. 完整相关 suite 和 Web 构建通过；桌面调用者仅命令级回归，用户 Web 完成仍以本包真实矩阵为准；验收后重跑包证据闸门。

**验证**：`npm --prefix ../engine run typecheck`；`npm --prefix ../engine run test`；`npm --prefix ../engine run web:build --workspaces --if-present`；`npm run typecheck`；`npm test`；`npm run build`；`npm run standard:check`；`python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/web-feature-completion --repo .` → 全通过，输出与证据齐全

**Evidence**：`evidence/phase-0/task-21.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

## 5. 验收与 Review 协议

### 5.1 命令级验证

本轮仅运行包结构/源码锚点/状态板/视图校验。下列业务命令是未来执行闸门；命令级通过之后仍须运行第 5.2 节。

| 验证项 | 命令（插件仓根） | 期望 |
|---|---|---|
| 本轮规格 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/web-feature-completion --repo .` | 退出 0；规格必须 0 FAIL |
| 本轮状态 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/board.py docs/web-feature-completion --json` | 全部任务待开始；后续实施由事实更新 |
| 本轮视图 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/render_spec.py docs/web-feature-completion` | 退出 0；规格必须 0 FAIL |
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
| 验证入口 | `node ../engine/web/e2e-web-features.mjs --all`；这是 Task 1 要新增的真实回放脚本，本轮未创建。默认 relay 地址为上述隔离端口，提供 `--out` 指向本包 evidence；逐项 `--case` 名称见任务验证行，全部必须由创建任务实现。 |

**执行矩阵**：每行归档实际 request/response、console/server 输出、network 与截图；预期故障单独标注，不能吞掉非预期错误。result.json 必须枚举全部适用 app/入口/能力子例、成功断言、失败断言、恢复结果及输出文件清单，不允许只写一个总 pass。

| UF | 执行方式 | 操作来源 | 必须核对的点 | Evidence |
|---|---|---|---|---|
| UF-001 主路径 | browser + 公开 API + 真实磁盘 | 第 2.3 节 UF-001 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-001/success/result.json`、`evidence/UF-001/success/console.log`、`evidence/UF-001/success/network.json`、`evidence/UF-001/success/screenshot.png` |
| UF-001 失败分支：取消或拒绝文件权限 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：取消选择器/拒绝写句柄 | 不创建假文档或覆盖磁盘；恢复：重新选择或明确另存；恢复后重走成功路径 | `evidence/UF-001/failure-1/result.json`、`evidence/UF-001/failure-1/console.log`、`evidence/UF-001/failure-1/network.json`、`evidence/UF-001/failure-1/screenshot.png` |
| UF-001 失败分支：损坏文件/缺失构建 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：解析失败或 app 资源缺失 | 返回错误而非空白 ready；恢复：修复输入/构建后重试；恢复后重走成功路径 | `evidence/UF-001/failure-2/result.json`、`evidence/UF-001/failure-2/console.log`、`evidence/UF-001/failure-2/network.json`、`evidence/UF-001/failure-2/screenshot.png` |
| UF-002 主路径 | browser + 公开 API + 真实磁盘 | 第 2.3 节 UF-002 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-002/success/result.json`、`evidence/UF-002/success/console.log`、`evidence/UF-002/success/network.json`、`evidence/UF-002/success/screenshot.png` |
| UF-002 失败分支：sidecar 不可用/退出 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：启动缺二进制或操作中服务终止 | 不把特征填空继续编辑；不写坏文件；恢复：恢复服务重新读取；恢复后重走成功路径 | `evidence/UF-002/failure-1/result.json`、`evidence/UF-002/failure-1/console.log`、`evidence/UF-002/failure-1/network.json`、`evidence/UF-002/failure-1/screenshot.png` |
| UF-002 失败分支：非法图片/受保护目标 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：损坏图片、错误媒体关系或保护阻止写入 | 不修改 journal/媒体映射；恢复：改输入或按权限解锁后重试；恢复后重走成功路径 | `evidence/UF-002/failure-2/result.json`、`evidence/UF-002/failure-2/console.log`、`evidence/UF-002/failure-2/network.json`、`evidence/UF-002/failure-2/screenshot.png` |
| UF-003 主路径 | browser + 公开 API + 真实磁盘 | 第 2.3 节 UF-003 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-003/success/result.json`、`evidence/UF-003/success/console.log`、`evidence/UF-003/success/network.json`、`evidence/UF-003/success/screenshot.png` |
| UF-003 失败分支：非法页码/损坏输入 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：空选页、越界、解析失败 | 不输出空文件、不覆盖源文件；恢复：修正范围/重新选文件；恢复后重走成功路径 | `evidence/UF-003/failure-1/result.json`、`evidence/UF-003/failure-1/console.log`、`evidence/UF-003/failure-1/network.json`、`evidence/UF-003/failure-1/screenshot.png` |
| UF-003 失败分支：worker 失败/取消 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：WASM 加载失败、资源耗尽、用户取消 | 终止任务清理临时输出，不报成功；恢复：修复资源/缩小范围后重试；恢复后重走成功路径 | `evidence/UF-003/failure-2/result.json`、`evidence/UF-003/failure-2/console.log`、`evidence/UF-003/failure-2/network.json`、`evidence/UF-003/failure-2/screenshot.png` |
| UF-004 主路径 | browser + 公开 API + 真实磁盘 | 第 2.3 节 UF-004 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-004/success/result.json`、`evidence/UF-004/success/console.log`、`evidence/UF-004/success/network.json`、`evidence/UF-004/success/screenshot.png` |
| UF-004 失败分支：对象/参数无效 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：不存在元素、非法索引或尺寸 | 事务不产生半份修改；恢复：重新读取选择有效对象；恢复后重走成功路径 | `evidence/UF-004/failure-1/result.json`、`evidence/UF-004/failure-1/console.log`、`evidence/UF-004/failure-1/network.json`、`evidence/UF-004/failure-1/screenshot.png` |
| UF-004 失败分支：媒体/放映权限失败 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：媒体不可解码、浏览器拒绝弹窗/全屏 | 不标记导出/放映成功；恢复：更换媒体或用户手势重试；恢复后重走成功路径 | `evidence/UF-004/failure-2/result.json`、`evidence/UF-004/failure-2/console.log`、`evidence/UF-004/failure-2/network.json`、`evidence/UF-004/failure-2/screenshot.png` |
| UF-005 主路径 | browser + 公开 API + 真实磁盘 | 第 2.3 节 UF-005 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-005/success/result.json`、`evidence/UF-005/success/console.log`、`evidence/UF-005/success/network.json`、`evidence/UF-005/success/screenshot.png` |
| UF-005 失败分支：前置依赖缺失 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：未配置 provider/打印程序缺失 | 不发送业务请求，不伪称能力 available；恢复：配置完成后重新探测；恢复后重走成功路径 | `evidence/UF-005/failure-1/result.json`、`evidence/UF-005/failure-1/console.log`、`evidence/UF-005/failure-1/network.json`、`evidence/UF-005/failure-1/screenshot.png` |
| UF-005 失败分支：运行时失败 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：超时、认证过期、空输出或用户取消 | 不自动重放写操作、不返回伪成功；恢复：恢复依赖后显式重试；恢复后重走成功路径 | `evidence/UF-005/failure-2/result.json`、`evidence/UF-005/failure-2/console.log`、`evidence/UF-005/failure-2/network.json`、`evidence/UF-005/failure-2/screenshot.png` |
| UF-006 主路径 | browser + 公开 API + 真实磁盘 | 第 2.3 节 UF-006 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-006/success/result.json`、`evidence/UF-006/success/console.log`、`evidence/UF-006/success/network.json`、`evidence/UF-006/success/screenshot.png` |
| UF-006 失败分支：资源不完整/加载失败 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：HTML build 缺失、文件不可读 | 不误路由 Docs、不注册假 ready；恢复：构建/修复输入后重试；恢复后重走成功路径 | `evidence/UF-006/failure-1/result.json`、`evidence/UF-006/failure-1/console.log`、`evidence/UF-006/failure-1/network.json`、`evidence/UF-006/failure-1/screenshot.png` |
| UF-006 失败分支：转换失败/外部资源失败 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：非法 HTML、资源不可达或用户取消 | 输出无伪成功，外链依照既有网络边界；恢复：修复内容或资源后重试；恢复后重走成功路径 | `evidence/UF-006/failure-2/result.json`、`evidence/UF-006/failure-2/console.log`、`evidence/UF-006/failure-2/network.json`、`evidence/UF-006/failure-2/screenshot.png` |

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
