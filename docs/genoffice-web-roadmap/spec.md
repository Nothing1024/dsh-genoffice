# GenOffice Master Spec

> Version: 0.3.0 | Date: 2026-09-12 | Status: Ready 可执行（仅规格，尚未实施）

## 0. 一页纸人话摘要

- 面向在浏览器里编辑文档、并让多个智能助手操作文档的用户。
- 本目录作为统一 master，串行统筹状态安全、插件契合、官方同步、网页功能、运行效率五个子包。
- 六包都有独立 CSV 状态板；给执行 agent 一次交接即可连续推进，断点续跑从实际状态恢复。
- 本轮只生成这些任务包、检查定位与结构、生成可读视图；不执行修复、不合并官方代码。
- 后续执行先解决编辑丢失与打开失败，再更新官方能力，最后补齐网页功能并按实测优化。
- 功能完成必须有真实文件的打开、编辑、保存、重新打开证据，不能用工具表或单测通过代替。
- 保留用户现有未提交改动、默认显式保存和本机文件访问边界。

## 1. 事实基线与假设

### 1.1 需求与运行模式

| 项 | 结论 |
|---|---|
| 原始需求 | 基于前轮插件与魔改上游评审生成多套 prd-workflow oneclick 包；用户进一步明确只生成任务包并运行校验 |
| 输入类型 | 当前对话需求、源码、真实缺陷复现与测试日志 |
| Mode | oneclick；本轮不进入 execute |
| 置信度 | 高：对象、五项目标和交付边界均由用户明确 |
| 输出目录 | `docs/genoffice-web-roadmap/` |

### 1.2 任务类型路由

| 维度 | 结论 |
|---|---|
| 任务类型 | infra、bugfix、frontend、backend、performance；本包仅统筹，具体改造由子包约定 |
| 主要风险 | 子包修改同一适配层互相覆盖；旧状态修复被官方同步覆盖；单测通过却真实入口失败 |
| 行号策略 | 所有行号仅 hint，以稳定符号及 rg 锚点为准 |
| 必需验收 | 包级结构与定位校验；后续执行需要跨包真实浏览器与 API 联合回放 |

### 1.3 勘察事实清单

以下命令在插件仓根执行；`../engine` 是魔改上游。

| 事实 | 来源命令 | 输出摘要 |
|---|---|---|
| 两仓产品关系与显式保存已写入 README | `rg "两仓一产品|写回仅由显式动作" README.md` | 插件包装 DSH；魔改上游提供 Web 编辑器、relay 和控制面 |
| 插件工作区包含用户尚未提交的 Sidebar 迁移 | `git status --short` | 既有源码、配置、构建产物变更及两个未跟踪 TS 源文件；本轮不得覆盖 |
| 魔改上游初始工作区干净 | `git -C ../engine status --short` | 无输出 |
| 当前固定代码版本可追溯 | `git log -1 --oneline` 和 `git -C ../engine log -1 --oneline` | 插件 5d5ee6d1；魔改上游 247e3f5 |
| 插件有现成校验入口 | `cat package.json` | typecheck、build、test、standard:check、smoke |
| 控制面以 SSE 和 POST 配合，写操作超时不应重放 | `rg "禁止|不重放|显式" contracts/control-api.md` | 本轮前置评审核实对应契约；后续改造保留传输与默认保存边界 |
| 前轮实测覆盖真实加载和保存竞态 | `cat /tmp/genoffice-state-review-2Hsj3r/repro-results.jsonl` | 加载覆盖已确认编辑、旧索引误写、保存回执清除较新编辑、读取失败覆盖原文件、双窗口互踢均复现 |
| 前轮原子写助手存在并发冲突缺口 | `cat /tmp/genoffice-state-review-2Hsj3r/atomic-results.jsonl` | 同基线并发写双方成功；50ms 外部修改未拒绝 |
| 前轮验证日志可用作基线 | `ls -l /tmp/genoffice-review-*` | 插件测试、smoke、引擎类型检查和全工作区测试日志均存在；失败不等同本轮新增回归 |

| 六包 CSV 迁移未丢任务 | `rg --files docs/genoffice-web-roadmap docs/control-session-safety docs/plugin-tool-alignment docs/official-upstream-sync docs/web-feature-completion docs/web-runtime-efficiency`；用已安装 board.load_tasks 读取后迁移 | 原先 3 份 CSV、3 份内嵌表；现为 6 份 CSV，79 项编号/依赖/状态保留。 |
| Master 运行入口已落盘 | `rg -n 'class Master' docs/genoffice-web-roadmap/master.py` | 薄 stdlib 程序提供状态、下一任务和证据闸门；功能结果见本轮验证日志。 |

### 1.4 假设清单

| 假设 ID | 内容 | 风险 | 确认方式 |
|---|---|---|---|
| ASM-001 | 后续执行仍采用并列 `plugin/`、`engine/` 的两仓布局 | 仓库搬迁后命令与定位失效 | 每个子包执行前记录工作区与固定版本，重新运行定位校验 |
| ASM-002 | 后续执行者具备独立 Chromium 与本机 relay 启动条件 | 无法取得真实浏览器证据 | 执行前按子包环境准备检查；不足时明确阻塞，不伪造验收 |

### 1.5 已确认决策 / 变更记录

| 日期 | 来源与决定 | 影响 |
|---|---|---|
| 2026-09-12 | 用户明确：只生成任务包并运行校验 | 本轮业务实现和真实应用验收均不执行，状态全部待开始。 |
| 2026-09-12 | 响应用户对 master 连续执行和 CSV 完整性的要求 | 增量升级现母包；六包均使用 tasks.csv，原任务编号/依赖/状态保留，本轮统一 CSV 的选择覆盖 skill 的小包内嵌表默认规则。 |
| 2026-09-12 | 规划审查：状态安全→插件契合→官方同步→Web 补齐→效率，源码按依赖串行 | 调整跨包边界，禁止把 no-replay 视为幂等或把参数镜像视为版本化单源；任务保持待开始。 |
| 2026-09-12 | oneclick 阶段提交遇到 Git 作者身份缺失 | 保留生成文件，未改 Git 身份配置，未提交用户既有改动。 |

## 2. 业务合同

本章只定义统筹规则；各子包的业务细节以对应 spec 第 2 章为准。

### 2.1 BR 业务规则

<a id="BR-001"></a>

| 规则 ID | 规则 | 正例 | 反例 | 影响范围 | 验证方式 |
|---|---|---|---|---|---|
| BR-001 | 五个子包分别定义合同与验收，母包必须覆盖用户五项目标并维护跨包依赖 | 每个目标有负责子包，官方同步后重验前置修复 | 只生成修 bug 包，遗漏官方更新与完整 Web | 全部包 | 对照目标映射及子包第 2 章 |
| BR-002 | 本轮交付只包含任务规格、状态板、交接导航、视图和校验证据，不执行业务任务 | 所有实现与真实场景任务仍待开始 | 用旧失败复现把修复任务标为完成 | 本轮生成 | 检查任务状态和两仓业务文件变化 |
| BR-003 | 依赖子包完成真实验收后才能开始依赖它的实现；本轮文档可并行，后续按状态安全、插件契合、官方同步、Web 功能、效率依次实施 | 状态安全先接入 host/tools，插件契合随后调整同一文件，官方同步保留二者修复 | 一边改控制适配器一边覆盖式合并官方 | 后续执行 | 状态板及跨包开工检查 |
| BR-004 | 跨包完成由联合回放确认，包校验通过不能替代功能验收 | 五族真实保存重开且各包证据齐全 | 只有 schema 名称镜像通过就宣称完整 Web | 后续交付 | 联合执行矩阵 |
| BR-005 | 生成完成时每个包必须单独通过机器结构及源码定位检查，视图仅由 spec 生成 | 六个包逐个 0 FAIL，页面与当前 spec 同源 | 只校验母包或手改 HTML 修正规格 | 本轮生成 | 逐包 validate_package.py 与 render_spec.py |
| BR-006 | master 从本章子包导航和母 CSV 包装关系读取依赖；一次 execute 交接后，agent 持续执行 next 指向的任务，前置子包通过完成闸门后继续，阻塞时保留状态 | 中断后继续未完成任务，伪标完成但缺验收证据时阻止下游 | 每包结束又问是否继续，或只看母包装行完成就解锁下游 | master.py、handoff、跨包状态 | UF-001 |
| BR-007 | 六包均有 8 列 tasks.csv，每个任务只在所属 CSV 维护状态；spec 保留合同和任务详情，编号、依赖与原状态不得在迁移中丢失 | 79 项原任务完整保留，母包装任务与子包任务不重复计成功 | CSV 与内嵌表同时维护，或补 CSV 时将任务重置/遗漏 | 所有任务包 | UF-001 |

Master 状态板：[tasks.csv](tasks.csv)（8 项统筹任务）；子包路径、CSV 与目标映射如下，共 79 项任务。

| 子包 | CSV 状态板 | 任务数（当前基线） | 负责目标 | 依赖 |
|---|---|---|---|---|
| [状态安全](../control-session-safety/spec.md#BR-001) | [tasks.csv](../control-session-safety/tasks.csv) | 15 | 可靠 open/edit/save、多 agent 文档状态一致性 | 无跨包前置 |
| [插件契合](../plugin-tool-alignment/spec.md#BR-001) | [tasks.csv](../plugin-tool-alignment/tasks.csv) | 10 | 插件入口、参数、工具说明与魔改上游契合 | 状态安全；两包会修改同一宿主工具文件，源码执行不得并行 |
| [官方同步](../official-upstream-sync/spec.md#BR-001) | [tasks.csv](../official-upstream-sync/tasks.csv) | 11 | 魔改上游同步固定官方版本并保留已有修复 | 状态安全、插件契合 |
| [网页功能](../web-feature-completion/spec.md#BR-001) | [tasks.csv](../web-feature-completion/tasks.csv) | 21 | 五族及新增官方能力的完整 Web 运行路径 | 官方同步 |
| [运行效率](../web-runtime-efficiency/spec.md#BR-001) | [tasks.csv](../web-runtime-efficiency/tasks.csv) | 14 | 可复用 agent 接口、构建部署、性能测量与优化 | 前四包 |

### 2.2 UF 用户验收场景（索引）

| 场景 ID | Given | When | Then | 角色 | 验证方式 | Evidence |
|---|---|---|---|---|---|---|
| UF-001 | master 和五个子包及 CSV 已生成 | 维护者一次交接，执行 agent 查看下一项、完成闸门或中断后续跑 | 下一任务符合本包和跨包依赖，缺证据不能放行；本轮只验证调度不执行修复 | 维护者与执行 agent | CLI、视图、临时任务文件 | EVD-001 |
| UF-002 | 后续五套子包均完成各自验收 | 用户经插件打开文档，两个 agent 交错编辑并保存，随后执行 Web 转换或新增官方能力 | 状态修复在同步与功能扩展后仍有效，输出文件可重开且不要求桌面客户端 | 用户及 agent | browser、HTTP、文件检查 | EVD-002 |

### 2.3 核心业务流程（步骤级交互脚本）

#### UF-001: 一次交接、连续调度和断点续跑

**前置状态**：维护者位于插件仓；本轮仅生成包。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 向执行 agent 一次交付 handoff，先运行 master validate/status | 输出六包 CSV 数量、阶段和校验结果 | 从本章导航读取包顺序，校验包装关系和每包结构 | 能核对完整范围及当前进度 |
| 2 | agent 运行 master next 并执行返回的任务 | 显示包名、任务编号、spec 与 CSV 路径 | 尊重本包前置、母包依赖和进行中任务 | 从正确任务开始或继续，无需逐包确认 |
| 3 | 完成子包后运行 master gate，再更新母包装行并继续 next | 显示验收结果或具体阻塞 | 逐项核查状态与真实证据，不运行 CSV 验证列中的叙述文本 | 前置满足才进入下一包，直至联合验收与回归 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 包缺失或状态结构损坏 | spec/CSV 缺失、错列、无效依赖或非法路径 | validate/next 输出具体错误 | 不执行任何业务命令，不生成假的下一任务 | 修复包文件与依赖后重新校验 |
| 前置未完成或证据不合格 | 前置包阻塞、母包装行误标完成、真实证据缺失/为空/失败 | next/gate 给出包名与原因 | 不解锁下游、不自动补写完成状态 | 修复前置并跑完真实验收，再 gate 和续跑 |

**界面状态机**：`待校验 → 可执行 → 进行中 → 子包闸门 → 下一包 → 联合验收 → 完成`；错误进入 `待修订/已阻塞`，恢复后按 CSV 续跑；本轮只回放调度状态，不进入业务执行。

**入口接线清单**：`handoff.md` → `master.py validate/status/next/gate` → 本章子包导航 + 六份 CSV → 子包 spec 的任务详情；agent 执行业务任务后回到 master 闸门。

#### UF-002: 跨包联合回放

**前置状态**：后续执行阶段；各子包验收完成，使用临时文件和隔离浏览器。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 经插件打开会话目录中的五族文档 | 加载状态明确，真正就绪后可编辑 | 地址解析、执行器与文件版本一致 | 打开成功后首次编辑可用 |
| 2 | 两个 agent 交错读改，用户同时操作页面 | 过期写入被明确拒绝，较新编辑保持未保存 | 执行所有权及版本校验生效 | 不出现成功但改错块或内容丢失 |
| 3 | 保存、重开，使用已接入的官方新增功能与转换出口 | 返回真实输出及可恢复错误 | 更新后的引擎复用相同控制合同 | 文件可重开，工作流始终处于 Web |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 同步后旧修复回归 | 加载延迟或双窗口再次触发状态缺陷 | 联合场景失败并保留日志 | 不标记总目标完成 | 回退对应任务状态，修复后重验关联子包 |
| 环境能力缺失 | 转换或生成所需服务未就绪 | 在规划前说明具体条件 | 不产生假的成功输出或转桌面提示 | 配齐服务后重试同一 Web 入口 |

**界面状态机**：`loading → ready → dirty → saving → saved`；旧版本写入进入可恢复的 `stale`，加载失败进入 `error`，不允许空白覆盖原文件。

**入口接线清单**：DSH 官方右侧 Sidebar → GenOffice 文件页 → 五族控制工具；魔改上游 Web shell → 各编辑器 → 真实导出入口。

### 2.4 INV 不变量

| 不变量 ID | 内容 | 关联 BR/UF | 验证方式 |
|---|---|---|---|
| INV-001 | 不覆盖、提交或回滚用户既有业务改动；本轮仅新增或更新本需求包文件 | BR-002 | 与生成前文件哈希和 git 状态对比 |
| INV-002 | 保留默认显式保存、SSE+POST、loopback 边界；需要变更时先修改负责子包合同 | BR-003、UF-002 | 子包合同审查及联合负向回放 |
| INV-003 | spec 是唯一合同来源，状态板只记任务状态，HTML 与 handoff 不复制业务定义 | BR-005 | 校验、视图重渲染及交接链接检查 |

### 2.5 EVD 证据清单

| 证据 ID | 类型 | 期望证据 | 保存位置 |
|---|---|---|---|
| EVD-001 | log、HTML | 六套包校验、状态与视图结果 | `evidence/package-validation/` |
| EVD-002 | screenshot、network、API、file | 后续联合执行矩阵及输出文件 | `evidence/joint-run/` |
| EVD-003 | log、hash | 本轮生成前后业务文件未变与既有测试基线 | `evidence/baseline/` |

<a id="acceptance-result"></a>

**跨包验收结果格式**（BR-006）：各包第 5.2 节的每个 `result.json` 使用下列结构；这仅定义未来真实验收格式，不是已通过的证据文件。

```json
{
  "schema_version": 1,
  "package": "control-session-safety",
  "uf": "UF-001",
  "branch": "success",
  "run_id": "真实运行的唯一编号",
  "source_revisions": {"plugin": "实际插件版本", "engine": "实际引擎版本"},
  "status": "passed",
  "cases": [
    {
      "id": "markdown-open-save-reopen",
      "status": "passed",
      "assertions": [{"name": "重开内容与已保存版本一致", "status": "passed", "expected": "真实预期", "actual": "真实观察"}]
    }
  ]
}
```

UF/branch 与证据所在路径一致；失败分支名使用 `failure-1`、`failure-2` 等矩阵序号。`cases` 和每项 `assertions` 均非空且全部通过；负例中的预期业务报错不等于验收失败。gate 同时要求矩阵中的全部精确证据路径是包内非空普通文件，拒绝目录代替文件与符号链接逃逸。零 console/network 事件记录真实采集元信息与零计数，不能写占位日志。

gate 只证明任务状态、包结构和证据记录满足闸门，不自动证明证据真实或版本仍适用；执行 agent 仍须按第 5.2 节回放、核对版本变化和实际产物。母包总完成还要求五个子包全部过 gate，不能只检查母 CSV。

### 2.6 角色与权限矩阵

本轮仅维护者生成规格，无新权限模型；后续文件访问继承各子包已有本机授权边界。

### 2.7 负向 / 破坏性场景

| 场景 | Given | When | Then | Evidence |
|---|---|---|---|---|
| 误启动实现 | 本轮仅生成包 | 状态板存在可开工业务任务 | 不执行，状态保持待开始 | EVD-001 |
| 丢失既有迁移 | 插件工作区有未提交代码 | 生成或更新规格 | 业务文件与基线一致 | EVD-003 |
| 子包完成误传递 | 只有一个包已验收 | 查看母包进度 | 未验收子包及联合任务保持未完成 | EVD-002 |

### 2.8 非目标

本轮不实施业务代码、不升级依赖、不启动现有用户会话、不进行官方实际合并或外部发布；后续功能边界见子包。

## 3. 技术方案

### 3.1 架构 Before / After

```text
Before: 插件与魔改引擎分别演进，控制/参数/网页能力有漂移
After: 状态合同 → 插件契合 → 固定官方同步 → 完整 Web → 按实测优化
       每包真实验收 → 下一包保留前置合同 → 母包联合回放
```

### 3.2 模块改造

master 由本章导航、六份 CSV、master.py 和 handoff 组成。master.py 只读取状态、计算下一项、校验包和验收证据；实现业务任务由执行 agent 完成。CSV 中验证列是给 agent 阅读的命令与断言说明，包含自然语言，不能整体交给 shell。原始源码与既有 dirty 文件按哈希保护；各包 spec 保存业务合同与任务详情，HTML 为只读投影。


### 3.3 三段式定位清单

| 文件 | 稳定定位 | 搜索定位 | 行号 hint | 备注 |
|---|---|---|---|---|
| `README.md` | 两仓一产品 | `rg "两仓一产品" README.md` | L9 | 插件仓根为统一定位基准 |
| `scripts/dev.mjs` | smoke | `rg "async function smoke" scripts/dev.mjs` | L127 | 既有 API 与工具名基线 |
| `packages/tab-genoffice/src/host/tools.ts` | createControlTools | `rg "export function createControlTools" packages/tab-genoffice/src/host/tools.ts` | L455 | 宿主控制工具入口 |
| `packages/tab-genoffice/src/standard/client.ts` | mountSidebar | `rg "function mountSidebar" packages/tab-genoffice/src/standard/client.ts` | L65 | 插件真实文件打开入口 |
| `../engine/web/server.mjs` | handleApi | `rg "async function handleApi" ../engine/web/server.mjs` | L540 | 魔改上游控制服务入口 |

| `docs/genoffice-web-roadmap/master.py` | Master | `rg "class Master" docs/genoffice-web-roadmap/master.py` | L127 | 跨包状态与闸门 |
| `docs/genoffice-web-roadmap/master.py` | result_errors | `rg "def result_errors" docs/genoffice-web-roadmap/master.py` | L83 | 验收结果格式检查 |
| `docs/genoffice-web-roadmap/master.py` | main | `rg "def main" docs/genoffice-web-roadmap/master.py` | L280 | 连续执行导航 CLI |

### 3.4 接口与兼容边界

本轮生成不变更业务 API/数据/权限/路由；未来改造由子包合同定义。


所有命令从插件仓根运行；切换隔离两仓后仍保持 plugin/engine 并列。生成证据仅位于 package-validation/baseline，未来 joint-run 未执行不创建占位成功文件。母包任务表的五项子包执行属于实现统筹任务，基线/联合验收/回归属于开销，本轮按用户要求统一使用 CSV。

## 4. Phase 计划与任务详情

本轮只生成任务包与校验。下列任务全部供后续明确进入 execute 时使用；每个子包 Task 1 即使本地 board 显示可开工，仍须先通过母包跨包前置核验。

任务依赖按 CSV 序号串行。子包独立 board 仅看包内前置；master.py next 同时检查母包与上游子包闸门。包装任务备注 package=包名 对应第 2.1 节导航顺序。用户明确交付 execute 后持续循环到最终验收；本轮仍只完善包与校验。

实现任务 5 项；其余为基线、验收、测量或回归。所有任务均为未来执行状态。

状态板：[tasks.csv](tasks.csv)。本轮按用户要求统一为独立 CSV；本节只保留任务详情，状态不在此重复维护。

### Phase 0: 可运行起点与基线

### Task 1: 核对执行范围和六包实际前置基线

- **关联**：BR-002 / BR-003 / BR-005 / BR-006 / BR-007 / UF-001 / INV-001 / INV-003 / EVD-001 / EVD-003
- **前置任务**：无（仍需核对上述跨包条件）
- **风险等级**：P1

**为什么做**：仅在后续会话明确进入 execute 后开始；先通读母包与当前子包第 1/2/5 章，运行所有状态板，记录两仓 HEAD/status、实际 Node 路径和独立工作区。

**涉及文件与定位**：

- `docs/genoffice-web-roadmap/master.py`：Master/result_errors/main；`rg "class Master" docs/genoffice-web-roadmap/master.py`；L127，仅 hint。

- `README.md`：两仓一产品；`rg "两仓一产品" README.md`；L9，行号仅 hint。
- `scripts/dev.mjs`：smoke；`rg "async function smoke" scripts/dev.mjs`；L127，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：createControlTools；`rg "export function createControlTools" packages/tab-genoffice/src/host/tools.ts`；L455，行号仅 hint。
- `packages/tab-genoffice/src/standard/client.ts`：mountSidebar；`rg "function mountSidebar" packages/tab-genoffice/src/standard/client.ts`；L65，行号仅 hint。
- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。

**具体操作**：

1. 仅在后续会话明确进入 execute 后开始；先通读母包与当前子包第 1/2/5 章，运行所有状态板，记录两仓 HEAD/status、实际 Node 路径和独立工作区。
2. 核对用户既有 Sidebar 迁移与生成阶段哈希，明确每个包写入边界；验证包锚点若漂移先校准。当前生成通过不标记此任务已完成。
3. 运行 master.py validate/status/next，核对六份 CSV 和首个任务；此时只登记联合回放需求。联合脚本依赖子包 driver，须在 Task 7、五包实际完成后创建，不在本任务提前引用尚不存在的 driver。

**验证**：`python3 docs/genoffice-web-roadmap/master.py validate`；`python3 docs/genoffice-web-roadmap/master.py status --json`；`python3 docs/genoffice-web-roadmap/master.py next --json` → 全包完整且下一任务符合真实依赖

**Evidence**：`evidence/baseline/task-1.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 2: 执行状态安全子包并验收

- **关联**：BR-001 / BR-003 / BR-004 / UF-002 / INV-002 / EVD-002
- **前置任务**：1
- **风险等级**：P1

**为什么做**：读取 `docs/control-session-safety/spec.md` 第 1/2/4/5 章及状态板，按该包合同和依赖执行；每项完成即保存真实证据，错误回退对应任务，不从其他包复制实现。

**涉及文件与定位**：

- `scripts/dev.mjs`：smoke；`rg "async function smoke" scripts/dev.mjs`；L127，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：createControlTools；`rg "export function createControlTools" packages/tab-genoffice/src/host/tools.ts`；L455，行号仅 hint。
- `packages/tab-genoffice/src/standard/client.ts`：mountSidebar；`rg "function mountSidebar" packages/tab-genoffice/src/standard/client.ts`；L65，行号仅 hint。
- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。

**具体操作**：

1. 读取 `docs/control-session-safety/spec.md` 第 1/2/4/5 章及状态板，按该包合同和依赖执行；每项完成即保存真实证据，错误回退对应任务，不从其他包复制实现。
2. 只有子包 board 的 done==total 且 total>0、doing=0、blocked 为空、真实场景证据齐全、证据闸门通过，母包这一项才能完成；board 进程 exit 0 只表示读取成功。
3. 将实际两仓 SHA、修改路径和协议差异移交下一包，保持线性开工约束。

**验证**：`python3 docs/genoffice-web-roadmap/master.py gate control-session-safety` → 全部任务完成、结构与精确验收证据通过

**Evidence**：`evidence/baseline/task-2.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 3: 执行插件契合子包并验收

- **关联**：BR-001 / BR-003 / BR-004 / UF-002 / INV-002 / EVD-002
- **前置任务**：2
- **风险等级**：P1

**为什么做**：读取 `docs/plugin-tool-alignment/spec.md` 第 1/2/4/5 章及状态板，按该包合同和依赖执行；每项完成即保存真实证据，错误回退对应任务，不从其他包复制实现。

**涉及文件与定位**：

- `scripts/dev.mjs`：smoke；`rg "async function smoke" scripts/dev.mjs`；L127，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：createControlTools；`rg "export function createControlTools" packages/tab-genoffice/src/host/tools.ts`；L455，行号仅 hint。
- `packages/tab-genoffice/src/standard/client.ts`：mountSidebar；`rg "function mountSidebar" packages/tab-genoffice/src/standard/client.ts`；L65，行号仅 hint。
- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。

**具体操作**：

1. 读取 `docs/plugin-tool-alignment/spec.md` 第 1/2/4/5 章及状态板，按该包合同和依赖执行；每项完成即保存真实证据，错误回退对应任务，不从其他包复制实现。
2. 只有子包 board 的 done==total 且 total>0、doing=0、blocked 为空、真实场景证据齐全、证据闸门通过，母包这一项才能完成；board 进程 exit 0 只表示读取成功。
3. 将实际两仓 SHA、修改路径和协议差异移交下一包，保持线性开工约束。

**验证**：`python3 docs/genoffice-web-roadmap/master.py gate plugin-tool-alignment` → 全部任务完成、结构与精确验收证据通过

**Evidence**：`evidence/baseline/task-3.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 4: 执行固定官方同步子包并验收

- **关联**：BR-001 / BR-003 / BR-004 / UF-002 / INV-002 / EVD-002
- **前置任务**：3
- **风险等级**：P1

**为什么做**：读取 `docs/official-upstream-sync/spec.md` 第 1/2/4/5 章及状态板，按该包合同和依赖执行；每项完成即保存真实证据，错误回退对应任务，不从其他包复制实现。

**涉及文件与定位**：

- `scripts/dev.mjs`：smoke；`rg "async function smoke" scripts/dev.mjs`；L127，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：createControlTools；`rg "export function createControlTools" packages/tab-genoffice/src/host/tools.ts`；L455，行号仅 hint。
- `packages/tab-genoffice/src/standard/client.ts`：mountSidebar；`rg "function mountSidebar" packages/tab-genoffice/src/standard/client.ts`；L65，行号仅 hint。
- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。

**具体操作**：

1. 读取 `docs/official-upstream-sync/spec.md` 第 1/2/4/5 章及状态板，按该包合同和依赖执行；每项完成即保存真实证据，错误回退对应任务，不从其他包复制实现。
2. 只有子包 board 的 done==total 且 total>0、doing=0、blocked 为空、真实场景证据齐全、证据闸门通过，母包这一项才能完成；board 进程 exit 0 只表示读取成功。
3. 将实际两仓 SHA、修改路径和协议差异移交下一包，保持线性开工约束。

**验证**：`python3 docs/genoffice-web-roadmap/master.py gate official-upstream-sync` → 全部任务完成、结构与精确验收证据通过

**Evidence**：`evidence/baseline/task-4.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 5: 执行网页功能补齐子包并验收

- **关联**：BR-001 / BR-003 / BR-004 / UF-002 / INV-002 / EVD-002
- **前置任务**：4
- **风险等级**：P1

**为什么做**：读取 `docs/web-feature-completion/spec.md` 第 1/2/4/5 章及状态板，按该包合同和依赖执行；每项完成即保存真实证据，错误回退对应任务，不从其他包复制实现。

**涉及文件与定位**：

- `scripts/dev.mjs`：smoke；`rg "async function smoke" scripts/dev.mjs`；L127，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：createControlTools；`rg "export function createControlTools" packages/tab-genoffice/src/host/tools.ts`；L455，行号仅 hint。
- `packages/tab-genoffice/src/standard/client.ts`：mountSidebar；`rg "function mountSidebar" packages/tab-genoffice/src/standard/client.ts`；L65，行号仅 hint。
- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。

**具体操作**：

1. 读取 `docs/web-feature-completion/spec.md` 第 1/2/4/5 章及状态板，按该包合同和依赖执行；每项完成即保存真实证据，错误回退对应任务，不从其他包复制实现。
2. 只有子包 board 的 done==total 且 total>0、doing=0、blocked 为空、真实场景证据齐全、证据闸门通过，母包这一项才能完成；board 进程 exit 0 只表示读取成功。
3. 将实际两仓 SHA、修改路径和协议差异移交下一包，保持线性开工约束。

**验证**：`python3 docs/genoffice-web-roadmap/master.py gate web-feature-completion` → 全部任务完成、结构与精确验收证据通过

**Evidence**：`evidence/baseline/task-5.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 6: 执行运行效率子包并验收

- **关联**：BR-001 / BR-003 / BR-004 / UF-002 / INV-002 / EVD-002
- **前置任务**：5
- **风险等级**：P1

**为什么做**：读取 `docs/web-runtime-efficiency/spec.md` 第 1/2/4/5 章及状态板，按该包合同和依赖执行；每项完成即保存真实证据，错误回退对应任务，不从其他包复制实现。

**涉及文件与定位**：

- `scripts/dev.mjs`：smoke；`rg "async function smoke" scripts/dev.mjs`；L127，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：createControlTools；`rg "export function createControlTools" packages/tab-genoffice/src/host/tools.ts`；L455，行号仅 hint。
- `packages/tab-genoffice/src/standard/client.ts`：mountSidebar；`rg "function mountSidebar" packages/tab-genoffice/src/standard/client.ts`；L65，行号仅 hint。
- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。

**具体操作**：

1. 读取 `docs/web-runtime-efficiency/spec.md` 第 1/2/4/5 章及状态板，按该包合同和依赖执行；每项完成即保存真实证据，错误回退对应任务，不从其他包复制实现。
2. 只有子包 board 的 done==total 且 total>0、doing=0、blocked 为空、真实场景证据齐全、证据闸门通过，母包这一项才能完成；board 进程 exit 0 只表示读取成功。
3. 将实际两仓 SHA、修改路径和协议差异移交下一包，保持线性开工约束。

**验证**：`python3 docs/genoffice-web-roadmap/master.py gate web-runtime-efficiency` → 全部任务完成、结构与精确验收证据通过

**Evidence**：`evidence/baseline/task-6.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 7: 执行 spec 5.2 跨包真实场景全套测试

- **关联**：BR-001 / BR-003 / BR-004 / UF-001 / UF-002 / INV-001 / INV-002 / INV-003 / EVD-001 / EVD-002 / EVD-003
- **前置任务**：6
- **风险等级**：P1

**为什么做**：五个子包全部验收后，用同一份部署、固定两仓 SHA 和临时文件从真实 Sidebar/外部 CLI 进入；两个 agent 交错读写，用户并行编辑，保存重开后接官方新增工具与 Web 转换。

**涉及文件与定位**：

- `scripts/dev.mjs`：smoke；`rg "async function smoke" scripts/dev.mjs`；L127，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：createControlTools；`rg "export function createControlTools" packages/tab-genoffice/src/host/tools.ts`；L455，行号仅 hint。
- `packages/tab-genoffice/src/standard/client.ts`：mountSidebar；`rg "function mountSidebar" packages/tab-genoffice/src/standard/client.ts`；L65，行号仅 hint。
- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。

**具体操作**：

1. 此时五个子包真实 driver 已存在，创建 scripts/e2e-genoffice-joint.mjs，复用它们编排 --case/--all/--out；先验证最小跨包链路，再扩完整联合矩阵。
2. 五个子包全部验收后，用同一份部署、固定两仓 SHA 和临时文件从真实 Sidebar/外部 CLI 进入；两个 agent 交错读写，用户并行编辑，保存重开后接官方新增工具与 Web 转换。
3. 执行主路径、同步后旧缺陷回归、依赖缺失前置反馈及恢复；返回结果与页面/磁盘相互核对，不能仅汇总子包日志代替联合链路。

**验证**：`node scripts/e2e-genoffice-joint.mjs --all` → 第 5.2 节全部矩阵与跨包链路通过

**Evidence**：`evidence/baseline/task-7.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 8: 执行 Phase 0 联合回归验证

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / BR-007 / INV-001 / INV-002 / INV-003 / EVD-001 / EVD-002 / EVD-003
- **前置任务**：7
- **风险等级**：P1

**为什么做**：运行最终相关 validators，六包逐个过真实证据闸门并核对任务状态、SHA、输入输出；生成只读视图和母包导航后汇报实际完成范围。

**涉及文件与定位**：

- `README.md`：两仓一产品；`rg "两仓一产品" README.md`；L9，行号仅 hint。
- `scripts/dev.mjs`：smoke；`rg "async function smoke" scripts/dev.mjs`；L127，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：createControlTools；`rg "export function createControlTools" packages/tab-genoffice/src/host/tools.ts`；L455，行号仅 hint。
- `packages/tab-genoffice/src/standard/client.ts`：mountSidebar；`rg "function mountSidebar" packages/tab-genoffice/src/standard/client.ts`；L65，行号仅 hint。
- `../engine/web/server.mjs`：handleApi；`rg "async function handleApi" ../engine/web/server.mjs`；L540，行号仅 hint。

**具体操作**：

1. 运行最终相关 validators，六包逐个过真实证据闸门并核对任务状态、SHA、输入输出；生成只读视图和母包导航后汇报实际完成范围。

**验证**：`npm --prefix ../engine run typecheck`；`npm --prefix ../engine run test`；`npm --prefix ../engine run web:build --workspaces --if-present`；`npm run typecheck`；`npm test`；`npm run build`；`npm run standard:check`；`python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/genoffice-web-roadmap --repo .` → 全部通过；`五个子包逐个再次校验`；`python3 docs/genoffice-web-roadmap/master.py gate` → 母子包联合完成；`失败回退对应状态`

**Evidence**：`evidence/baseline/task-8.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

## 5. 验收与 Review 协议

### 5.1 命令级验证

Master 自身测试：`python3 -B -m unittest discover -s docs/genoffice-web-roadmap -p test_master.py`；使用临时包和已安装技能校验器验证调度及正负证据闸门，测试不修改实际六包 CSV。

Master 包校验入口（现有包内脚本）：`python3 docs/genoffice-web-roadmap/master.py validate`；统一进度与下一任务：`python3 docs/genoffice-web-roadmap/master.py status --json`、`python3 docs/genoffice-web-roadmap/master.py next --json`。执行 agent 实现完子包后调用 `python3 docs/genoffice-web-roadmap/master.py gate control-session-safety`（其余包使用本章导航包名）。脚本不会启动业务实现。

本轮仅运行包结构/源码锚点/状态板/视图校验。下列业务命令是未来执行闸门；命令级通过之后仍须运行第 5.2 节。

| 验证项 | 命令（插件仓根） | 期望 |
|---|---|---|
| 本轮规格 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/genoffice-web-roadmap --repo .` | 退出 0；规格必须 0 FAIL |
| 本轮状态 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/board.py docs/genoffice-web-roadmap --json` | 全部任务待开始；后续实施由事实更新 |
| 本轮视图 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/render_spec.py docs/genoffice-web-roadmap` | 退出 0；规格必须 0 FAIL |
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
| 数据与权限 | 由各子包生成可审计临时文件，母 Task 7 复制为联合测试数据；只使用测试目录与已配置服务。双 agent 分别保留读取版本，浏览器 profile/下载目录隔离；日志不含凭据或真实用户文档。 |
| 干净状态 | 每组用例复制初始 fixture、记录哈希和版本；关闭本组拥有的页面/进程并清理临时输出；不删除源码仓库或用户数据。 |
| 测试工具 | 本地已安装 Playwright/Chromium、Node HTTP、真实 relay 与文件系统。若后续环境缺浏览器，先恢复依赖；无法恢复则按第 2.3 节生成手动逐步脚本供回填，未获真实结果不得完成。 |
| 验证入口 | `node scripts/e2e-genoffice-joint.mjs --all`；这是 Task 7 在五个子包 driver 就绪后新增的联合回放脚本，本轮未创建。默认 relay 地址为上述隔离端口，提供 `--out` 指向本包 evidence；逐项 `--case` 名称见任务验证行，全部必须由创建任务实现。 |

**执行矩阵**：每行归档实际 request/response、console/server 输出、network 与截图；预期故障单独标注，不能吞掉非预期错误。result.json 必须枚举全部适用 app/入口/能力子例、成功断言、失败断言、恢复结果及输出文件清单，不允许只写一个总 pass。

| UF | 执行方式 | 操作来源 | 必须核对的点 | Evidence |
|---|---|---|---|---|
| UF-001 主路径 | master CLI + 临时包文件 | 第 2.3 节 UF-001 三步 | 六份 CSV 完整；next 指向真实待办；进行中优先续跑；全完成和证据合格后才解锁下一包 | `evidence/package-validation/UF-001/success/result.json`、`evidence/package-validation/UF-001/success/console.log`、`evidence/package-validation/UF-001/success/network.json`、`evidence/package-validation/UF-001/success/screenshot.png` |
| UF-001 失败分支：包缺失或状态结构损坏 | master CLI + 临时包文件 | 删除临时 spec/CSV，或写入错列、循环、越界路径 | 明确失败且不返回可执行下游；恢复文件后校验通过；不影响真实包状态 | `evidence/package-validation/UF-001/failure-1/result.json`、`evidence/package-validation/UF-001/failure-1/console.log`、`evidence/package-validation/UF-001/failure-1/network.json`、`evidence/package-validation/UF-001/failure-1/screenshot.png` |
| UF-001 失败分支：前置未完成或证据不合格 | master CLI + 临时包文件 | 阻塞前置、母包装误标完成、空/缺失/失败验收 JSON | gate 拒绝且 next 不解锁下游；合法完整证据恢复后允许继续 | `evidence/package-validation/UF-001/failure-2/result.json`、`evidence/package-validation/UF-001/failure-2/console.log`、`evidence/package-validation/UF-001/failure-2/network.json`、`evidence/package-validation/UF-001/failure-2/screenshot.png` |
| UF-002 主路径 | browser + 公开 API + 真实磁盘 | 第 2.3 节 UF-002 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/joint-run/UF-002/success/result.json`、`evidence/joint-run/UF-002/success/console.log`、`evidence/joint-run/UF-002/success/network.json`、`evidence/joint-run/UF-002/success/screenshot.png` |
| UF-002 失败分支：同步后旧修复回归 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：加载延迟或双窗口再次触发状态缺陷 | 不标记总目标完成；恢复：回退对应任务状态，修复后重验关联子包；恢复后重走成功路径 | `evidence/joint-run/UF-002/failure-1/result.json`、`evidence/joint-run/UF-002/failure-1/console.log`、`evidence/joint-run/UF-002/failure-1/network.json`、`evidence/joint-run/UF-002/failure-1/screenshot.png` |
| UF-002 失败分支：环境能力缺失 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：转换或生成所需服务未就绪 | 不产生假的成功输出或转桌面提示；恢复：配齐服务后重试同一 Web 入口；恢复后重走成功路径 | `evidence/joint-run/UF-002/failure-2/result.json`、`evidence/joint-run/UF-002/failure-2/console.log`、`evidence/joint-run/UF-002/failure-2/network.json`、`evidence/joint-run/UF-002/failure-2/screenshot.png` |

每行失败或缺证据均表示该真实场景未完成；修复后重走该行及受影响的成功路径。服务型功能的未配置负例不能代替已配置服务正例。

### 5.3 Evidence 归档

跨包验收 JSON 格式以第 2.5 节为准；实际运行版本、用例与断言必须来自真实回放。当前 master 程序测试保存在 evidence/package-validation/master-tests.log，测试临时包只验证调度/闸门行为，不代表子包业务通过。

业务证据类别和位置以第 2.5 节为准；各 Task 的命令日志保存完整命令、cwd、时间、固定 SHA、退出码与结果。第 5.2 节目录下保存真实文件和逐项结果，不创建空文件满足审计。当前生成校验单独存 `evidence/package-validation/`，不属于修复完成证据。

### 5.4 Review 专项检查

- [ ] 每项业务规则、用户路径和不变量均有任务及实际证据核销。
- [ ] 第 2.3 节每条入口、加载/禁用/错误/成功和恢复反馈都在真实 UI 或 CLI 可达。
- [ ] 第 5.2 节全部主路径、失败分支和适用 app/清单子项通过，真实产物已重开。
- [ ] 未以固定 stub、忽略错误、放松网络/文件权限或自动重放修改来通过测试。
- [ ] 前置包实际 SHA/协议与当前实现一致；原用户工作区和未提交内容没有被覆盖。
- [ ] 最终状态按实际结果更新，真实场景任务完成后再次运行包证据闸门。
