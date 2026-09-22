# control-session-safety Spec

> Version: 0.3.0 | Date: 2026-09-12 | Status: Ready 可执行（仅规格，尚未实施）
>
> 本文件是本包唯一事实源。运行模式：oneclick；本轮只生成与校验任务包，不执行修复。规格已展开，未来实现仍待开始。

## 0. 一页纸人话摘要

- 面向多个 agent 和同时打开文档的用户，解决刚打开就编辑、旧内容上误改、保存后仍丢内容的问题。
- 打开必须等真实内容准备好；加载失败明确报错，原文件不会被当成空白文件覆盖。
- 编辑请求携带读取时的版本，其他人已改动则返回可恢复冲突；保存只确认实际导出的那一版。
- 同一文件写入排队，同一文档只有一个执行命令的窗口，断线重连不会让两个窗口反复抢占。
- 后续实施先证明 Markdown 的浏览器与磁盘闭环，再推广到 Word、表格、演示文稿和 PDF。
- 五类文档全部完成打开、编辑、保存、重开与失败分支验收，旧缺陷不能复现，才可标记实现完成。
- 本轮交付可执行任务包；官方同步、Web 功能补齐、插件工具参数分别由其他包承担。

## 1. 事实基线与假设

### 1.1 需求与运行模式

| 项 | 结论 |
|---|---|
| 原始需求 | 用户要求多套 prd-workflow oneclick 包；最新指令限定本轮只生成任务包并运行校验。 |
| 输入类型 | 当前对话明确描述、本地源码和历史复现材料。 |
| Mode | oneclick；全部未来实现任务待开始，不执行修复、不生成子 handoff。 |
| 置信度 | 高；本包处理本地魔改上游状态一致性，官方上游另有同步包。 |
| 输出目录 | `docs/control-session-safety/` |

上下文推断摘要：目标是让其他 agent 稳定完成 open→context→edit→save。历史复现与当前源码已核对。本轮文档可并行；未来代码按 control-session-safety → plugin-tool-alignment → official-upstream-sync → web-feature-completion → web-runtime-efficiency 串行执行，避免共写插件 host/tools.ts。本包负责 relay/五族状态及插件相应接入；下一包再处理 schema 参数漂移与现存规划器重放。

### 1.2 任务类型路由

| 维度 | 结论 |
|---|---|
| 任务类型 | bugfix、backend、frontend、refactor。 |
| 主要风险 | 提前成功、陈旧位置编辑、保存期间 dirty 丢失、并发覆盖、窗口抢占。 |
| 行号引用策略 | 仅 hint，以现存 symbol 与 rg anchor 为准。 |
| 必需验收方式 | 实施时先证明失败，再用真实 Chromium+relay+临时磁盘回归，辅以 Node 测试、类型检查与五族构建。 |
| 必须覆盖用户场景 | UF-001 至 UF-004 的主路径和失败分支，从真实接口与浏览器入口进入。 |

### 1.3 勘察事实清单

命令均从插件仓库根运行，`../engine` 是独立魔改上游仓库。以下只陈述已运行的勘察，不表示实现通过。

| 事实 | 来源命令 | 输出摘要 |
|---|---|---|
| 魔改上游基线干净 | `git -C ../engine status --short`；`git -C ../engine rev-parse HEAD` | 无状态输出；HEAD 为 `247e3f5c488afb25915e9ee97fe0fd22e27648da`。 |
| 文档描述落后于实现 | `cat ../engine/README.md`；`cat ../engine/web/README.md` | 主 README 定位 Web+agent fork；web/README 仍写三族待 Web 化，能力以代码核实。 |
| 现有验证命令存在 | `cat ../engine/package.json`；`cat ../engine/apps/markdown/package.json`；`cat ../engine/apps/markdown/vitest.config.ts` | 根 typecheck、workspace test/web:build 已定义；Markdown 测试使用 jsdom。 |
| 原子写现有测试通过 | `node --test ../engine/web/write-atomic.test.mjs` | 4 passed、0 failed，仅覆盖错误映射和目标预检；在用户限定只生成包前作为勘察执行。 |
| 浏览器工具已安装 | `node -e 'const p = require("../engine/node_modules/playwright"); console.log(p.chromium.executablePath())'` | 已配置 Chromium 1234 可执行路径；历史脚本使用同一 Playwright。 |
| 历史真实复现有五项失败 | `cat /tmp/genoffice-state-review-2Hsj3r/repro-results.jsonl`；`sed -n '1,150p' /tmp/genoffice-state-review-2Hsj3r/repro.mjs` | 提前写成功后被加载覆盖、旧索引误改、旧保存确认清 dirty、加载失败覆盖、双窗口 5.2 秒注册 4/3 次。 |
| 历史写盘复现有两项失败 | `cat /tmp/genoffice-state-review-2Hsj3r/atomic-results.jsonl`；`cat /tmp/genoffice-state-review-2Hsj3r/atomic-repro.mjs` | mtime+50ms 外部修改仍被覆盖，同基线并发写均 ok。 |
| Markdown 提前注册并吞加载失败 | `sed -n '190,272p' ../engine/apps/markdown/src/renderer/App.tsx`；`sed -n '307,385p' ../engine/apps/markdown/src/renderer/web-bridge.ts` | editor 建立即注册；bytesFromRemote 失败返回 null，consumePending 把失败当无目标。 |
| 回执没有绑定版本 | `sed -n '76,237p' ../engine/apps/markdown/src/renderer/control.ts` | tool 仅检查 editor；saved 无条件 onSaved；mtime 独立再读且失败保留 null。 |
| 五族均有控制接线 | `rg -n 'initControlMode' ../engine/apps/markdown/src/renderer/App.tsx ../engine/apps/docs/src/renderer/App.tsx ../engine/apps/sheets/src/renderer/App.tsx ../engine/apps/slides/src/renderer/App.tsx ../engine/apps/pdf/src/renderer/App.tsx` | 五族都调用 initControlMode；PDF 使用 onMerged 保留合并重载语义。 |
| registered 仅表示 SSE 存在 | `sed -n '614,838p' ../engine/web/server.mjs` | 重注册关闭旧连接；open 只查 executors；notify 未核对 owner；没有 revision。 |
| 原子写未排队且有 100ms 容差 | `cat ../engine/web/write-atomic.mjs` | 写 tmp 后比较 mtime 差大于 100，再 rename；并发实例独立执行。 |
| 插件当前把注册视作 open 完成 | `sed -n '100,135p' packages/tab-genoffice/src/host/tools.ts` | waitUntilRegistered 接受 registered=true 或字段缺失；加载错误没有结构化传回。 |
| 插件保存界面也会直接清 dirty | `sed -n '225,257p' packages/tab-genoffice/src/tabs/control-mode.tsx` | export 成功且有 mtimeMs 时 setDirty(false)，须与导出 revision 一并改造。 |
| 插件标准验证命令存在 | `cat package.json` | npm run typecheck、npm test、npm run standard:check、npm run smoke 已定义；本轮未运行业务验证。 |

历史 `/tmp` 结果只是问题基线，本轮不重新运行、不冒充修复证据。未来实施将材料复制与新结果保存到本包 evidence，仅使用临时测试文件。

### 1.4 假设清单

| 假设 ID | 内容 | 风险 | 确认方式 |
|---|---|---|---|
| ASM-001 | 使用小型共享运行时与五族状态/执行/导出回调，不新建编辑引擎。 | 各族保存快照不同，过度共享可能改变行为。 | Markdown 最小闭环后核对其余四族实际边界。 |
| ASM-002 | expectedRevision 为增量字段；未传版本的旧调用保留默认语义，插件在本包接入 readiness/revision，其他 agent 可使用版本保护。 | 旧调用不能宣称具备多 agent 陈旧读保护。 | 本包验证插件有版本/无版本两条路径，下包在此基础处理 schema 对齐。 |
| ASM-003 | 文件版本从实际加载字节响应取得，优先用内容摘要；不依赖独立再读的 mtime。 | 五族加载桥不同，必须找齐来源。 | 实施时核对五族读取响应、序列化与写盘版本链。 |

### 1.5 已确认决策 / 变更记录

| 日期 | 来源与决定 | 影响 |
|---|---|---|
| 2026-09-12 | 用户明确：只生成任务包并运行校验 | 本轮业务实现和真实应用验收均不执行，状态全部待开始。 |
| 2026-09-12 | 响应用户对 master 连续执行和 CSV 完整性的要求 | 增量升级现母包；六包均使用 tasks.csv，原任务编号/依赖/状态保留，本轮统一 CSV 的选择覆盖 skill 的小包内嵌表默认规则。 |
| 2026-09-12 | 规划审查：状态安全→插件契合→官方同步→Web 补齐→效率，源码按依赖串行 | 调整跨包边界，禁止把 no-replay 视为幂等或把参数镜像视为版本化单源；任务保持待开始。 |
| 2026-09-12 | oneclick 阶段提交遇到 Git 作者身份缺失 | 保留生成文件，未改 Git 身份配置，未提交用户既有改动。 |

## 2. 业务合同

本章是本次用户授权目标的唯一规则定义；技术选择尚待验证的部分显式引用 ASM。

### 2.1 BR 业务规则

<a id="BR-001"></a>

| 规则 ID | 规则 | 正例 | 反例 | 影响范围 | 验证方式 |
|---|---|---|---|---|---|
| BR-001 | open 区分 connected/loading/ready/error，真实目标加载成功后才允许文档操作；失败保留错误并禁止控制写盘。 | 延迟时 loading，完成后 ready；失败原文件字节不变。 | SSE 注册即可编辑，加载失败当空文档。 | 五族加载与控制 | UF-001 |
| BR-002 | context/结果返回 revision；带 expectedRevision 的修改须在执行前比较，过期即拒绝、不修改、返回当前版本与刷新恢复办法。 | A 读后 B 改，A 旧版被拒；重读决策后可成功。 | 旧索引静默用于新文档。 | 控制运行时与 relay | UF-002；ASM-002 |
| BR-003 | 保存确认绑定导出 revision 与 owner，导出后编辑仍 dirty；失败不清 dirty，回执不能影响其他窗口。 | 磁盘保存 A 版，后来 B 修改仍待保存。 | 旧回执无条件清 dirty。 | 五族导出/saved/onMerged | UF-003 |
| BR-004 | 同目标路径写入串行，队首重新验证实际加载文件版本；已有目标的保存若版本未知或变化则拒绝覆盖，新建或另存为仅可写入不存在的目标。 | 同基线并发至多一项成功；50ms 外部修改冲突。 | mtime 容差漏冲突，并发均成功。 | relay export/file 与原子写 | UF-003；ASM-003 |
| BR-005 | docId 仅一个有效 owner；不同窗口不能自动重连抢占，同 owner 可恢复，旧 owner 结果不能完成新请求。 | 后开窗口明确被占用；原 owner 关闭后显式重开可接管。 | 两窗反复注册、旧回执被接收。 | SSE/notify/pending | UF-004 |
| BR-006 | relay/renderer 及本包新增插件接入的加载、断线、冲突、超时对 agent 可见；未知结果与重连不得触发自动重放写请求。 | 回执丢失告知结果未知，先读状态确认。 | catch 空成功或新 call ID 自动重试修改。 | relay/renderer 与本包插件接入；现存落页规划器重放由下一包修复 | UF-001、UF-002、UF-003、UF-004 |

### 2.2 UF 用户验收场景（索引）

| 场景 ID | Given | When | Then | 角色 | 验证方式 | Evidence |
|---|---|---|---|---|---|---|
| UF-001 | agent 打开已有文件 | 内容延迟、成功或失败加载 | ready 对应真实内容，失败不覆盖 | agent/用户 | browser+API+磁盘 | EVD-001 |
| UF-002 | 两个 agent 读取同文档 | 一方修改，另一方提交旧版 | 旧版拒绝，重读后显式重做成功 | agent | API+browser | EVD-002 |
| UF-003 | 已加载且修改的文件 | 保存中再编辑、并发或外部修改 | 版本可核对，dirty 保留，冲突不覆盖 | agent/用户 | browser+API+磁盘 | EVD-003 |
| UF-004 | 两窗打开同文件 | 连接、断线、重连、旧回执 | owner 稳定，错误可恢复且不重放 | agent/用户 | 双窗口 browser+API | EVD-004 |

### 2.3 核心业务流程（步骤级交互脚本）

#### UF-001: 等真实内容加载后编辑

**前置状态**：五族各一份合法临时文件；浏览器访问对应编辑器 `?control=1&open=path:...`，agent 调真实控制接口。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 打开文件 | 加载中，agent 收到 loading | SSE 连上仍等待真实文件解析 | 无空白成功上下文 |
| 2 | ready 后读内容并编辑 | 原文和修改可见 | 返回 revision，执行编辑 | 回执匹配可见内容 |
| 3 | 保存并重开 | 保存成功 | 写盘后重新读真实文件 | 修改与原文均保留 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 加载中编辑 | 延迟文件读取 | 保持加载，agent 收 not-ready | 不执行文档读写 | ready 后显式提交 |
| 加载失败 | 读取错误、断网或非法字节 | 界面及 agent 收 load-error | 不回退新建，拒绝编辑/export | 修复来源后显式重开 |

**界面状态机**：

```text
connecting → loading → ready → dirty → saving → ready
                 └→ error → 显式重开 → loading
```

**入口接线清单**：

- 五族 App 的 initControlMode、文件读取与解析成功/失败出口。
- 五族 tool/context/export、relay `/api/control/open` 及对应控制请求。
- 插件 waitUntilRegistered/open 工具消费真实 readiness 与 load-error，不以 connected 代替 ready。

#### UF-002: 按读取版本提交多 agent 编辑

**前置状态**：owner 已 ready，agent A/B 独立调用 `/context`。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | A 读上下文 | 内容不变 | 返回结构与 revision | 可以携带读取版本 |
| 2 | A 传当前 expectedRevision 修改 | 修改出现且 dirty | 执行前比较，成功后推进版本 | 返回执行结果与 revision |
| 3 | B 重读再编辑 | 先看到 A 修改 | B 使用新版本执行 | 两次修改均保留 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 旧 revision | B 插入块后 A 仍用旧版 | A 收 conflict，无错位改写 | 执行前拒绝，返回当前版本 | A 重读并重新决策 |
| 回执丢失 | 工具执行后 notify 失败 | 可见修改保留，agent 收未知结果 | 显式报告错误，不重放 | 先读内容确认 |

**界面状态机**：

```text
ready(R) → executing → ready(R+1)
         ├→ conflict → 重新读取
         └→ result-unknown → 读取确认
```

**入口接线清单**：

- relay context/tool 新字段与 expectedRevision 传递；真实 executeTool 前校验。
- 五族全部持久化修改源推进版本，包括 UI/键盘，不能只统计 agent 工具。
- 插件 callRelay 与工具结果将 revision/expectedRevision 传给 agent，禁止所有会话共享一份隐式读取基线。

#### UF-003: 保存实际导出版本

**前置状态**：临时文件已加载并有未保存修改，五族使用各自现有导出与合并路径。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 显式保存 | 显示保存中 | 捕获导出与文件版本，同目标排队检查 | 回执对应落盘版本 |
| 2 | 导出后回执前继续编辑 | 新修改出现、未保存 | 分别跟踪导出与当前版本 | 旧回执不清新 dirty |
| 3 | 再保存并重开 | 未保存状态清除 | 写入新版本再读盘 | 新旧修改完整 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 外部修改 | 与 baseline 相差不足 100ms 或摘要变化 | conflict、dirty 保留 | 不覆盖外部字节 | 显式重开/合并后再存 |
| 同基线并发 | 同一目标两个保存请求 | 至多一个成功 | 队列内重新验证 | 读文件与编辑器状态再决策 |
| 写盘/导出失败 | 无权限、序列化失败、断线 | 明确错误、dirty 保留 | 不发虚假 saved，不覆盖 | 修复后显式再存 |

**界面状态机**：

```text
dirty(R) → exporting(R) → queued(R) → saved(R)
             └编辑→ dirty(R+1) ─旧回执→ dirty(R+1)
queued → conflict/error → dirty（内容保留）
```

**入口接线清单**：

- 五族 exportBytes/getDirty/onSaved；PDF getSaveRequest/onMerged 与保留未保存改动的重载。
- relay export、POST `/api/file`、writeFileAtomic；saved 包含导出 revision/owner。
- 插件控制页写盘按钮不得因有 mtimeMs 就清 dirty，按导出版本确认与后续 dirty 事件更新。

#### UF-004: 双窗口稳定归属与重连

**前置状态**：两个可见 Chromium 页面打开同一路径，docId 相同。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 第一窗打开 | 内容与控制可用 | 分配 owner，绑定连接 | 命令进入第一窗 |
| 2 | 第二窗打开 | 显示控制被占用 | 不替换现 owner，不抢占重连 | 第一窗持续可编辑 |
| 3 | 关第一窗，再显式重开第二窗 | 重新加载后控制可用 | 结束旧 pending，新 owner 接管 | 只由新 owner 执行 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 短暂断线 | owner 网络断后恢复 | 显示恢复状态，内容保留 | 同 owner 重连，旧请求报错不重放 | 先读上下文确认 |
| 旧结果晚到 | 新连接建立后旧 owner notify | 新窗内容不变 | 校验 owner/请求归属，拒绝旧回执 | 新请求按自身结果完成 |

**界面状态机**：

```text
connecting → owner-ready → reconnecting → owner-ready
           └→ occupied → 显式重开 → connecting
owner-closed → pending-error；旧回执 → discarded
```

**入口接线清单**：

- 五族 SSE open/onerror、visibilitychange/pageshow/pagehide、close 清理与控制状态反馈。
- relay stream 注册、pending 绑定、notify 检查与 open 状态响应。

### 2.4 INV 不变量

| 不变量 ID | 内容 | 关联 BR/UF | 验证方式 |
|---|---|---|---|
| INV-001 | 非 control 的原生编辑/保存/自动保存默认行为保持；控制写盘仍显式触发。 | BR-001、BR-003 | 五族正常编辑保存回归 |
| INV-002 | 保留 SSE 下行、POST 上行、路径 docId、loopback 校验；无 WebSocket 或云上传。 | BR-005、BR-006 | 正常、非法 Host/参数真实请求 |
| INV-003 | 复用现有导出引擎，保留格式/未修改部分/PDF 合并重载语义。 | BR-003、BR-004 | 五族 save→reopen 与格式/字节验证 |
| INV-004 | 本包运行时及新增接入不自动重放修改（现存落页包装器由下一包负责）；另存为不覆盖已有目标；失败不清 dirty。 | BR-003、BR-004、BR-006 | 重复请求、目标存在与失败注入 |

### 2.5 EVD 证据清单

| 证据 ID | 类型 | 期望证据 | 保存位置 |
|---|---|---|---|
| EVD-001 | browser/API/file | UF-001 主路径与失败；截图、console、network、文件摘要 | `evidence/UF-001/` |
| EVD-002 | browser/API | UF-002 两 agent 请求响应与页面内容 | `evidence/UF-002/` |
| EVD-003 | browser/API/file | UF-003 导出竞态、并发、冲突、磁盘、dirty | `evidence/UF-003/` |
| EVD-004 | browser/API | UF-004 注册计数、owner、断线与晚到结果 | `evidence/UF-004/` |
| EVD-005 | log/test | 历史基线、修复前失败、类型/测试/构建/回归日志 | `evidence/phase-0/`、`evidence/phase-1/`、`evidence/phase-2/` |

### 2.6 角色与权限矩阵

单一权限域，保持现有 loopback 授权。owner 只表示执行归属，不是绕过访问校验的身份凭证。

### 2.7 负向 / 破坏性场景

破坏性检查已由 UF-001 加载失败、UF-002 丢失回执、UF-003 外改/并发、UF-004 旧 owner 覆盖。测试只写临时文件；预期注入错误与非预期 console/server 错误分别记录。

### 2.8 非目标

- 不做官方合并、新工具、Web 转换/打印或全局性能重写。
- 不改变旧调用未传 expectedRevision 的默认语义，不宣称该模式具备陈旧读保护。
- 不接管用户真实文档，不自动合并外部修改；本轮不执行业务代码或业务验证。

## 3. 技术方案

### 3.1 架构 Before / After

```text
Before: 五份 control.ts 自行注册/重连/导出 → relay 按 docId 转发 → 独立原子写
After:  五族状态/修改/导出回调 → 小型共享会话运行时
        → relay 绑定 owner/readiness/request → 目标路径队列+文件版本检查
```

ASM-001：先 Markdown 最小纵切再推广；共享层限会话、版本、传输与保存确认，工具与序列化留在编辑器。新增路径/symbol 在实施校准后确定，不冒充已验证定位。

### 3.2 模块改造

加载桥负责真实解析结果；共享控制运行时负责 readiness、revision、owner 和保存确认；relay 负责请求归属、超时和写队列。五族 adapter 保留各自序列化、编辑历史与 PDF 合并，不复制文档模型。插件仅传递版本与加载/保存反馈。

### 3.3 三段式定位清单

仓库根为插件目录；以下路径均已核实。漂移以 symbol+rg 为准，行号仅 hint。

| 文件 | 稳定定位 | 搜索定位 | 行号 hint | 备注 |
|---|---|---|---|---|
| `../engine/apps/markdown/src/renderer/App.tsx` | `initControlMode` | `rg "initControlMode" ../engine/apps/markdown/src/renderer/App.tsx` | L194 | 状态与控制接线 |
| `../engine/apps/markdown/src/renderer/web-bridge.ts` | `bytesFromRemote` | `rg "bytesFromRemote" ../engine/apps/markdown/src/renderer/web-bridge.ts` | L307 | 加载错误来源 |
| `../engine/apps/markdown/src/renderer/control.ts` | `initControlMode` | `rg "initControlMode" ../engine/apps/markdown/src/renderer/control.ts` | L82 | 首个纵切 |
| `../engine/apps/docs/src/renderer/App.tsx` | `initControlMode` | `rg "initControlMode" ../engine/apps/docs/src/renderer/App.tsx` | L1371 | 导出/dirty |
| `../engine/apps/docs/src/renderer/file-actions.ts` | `loadFile` | `rg "export async function loadFile" ../engine/apps/docs/src/renderer/file-actions.ts` | L243 | Docs 加载出口 |
| `../engine/apps/docs/src/renderer/control.ts` | `initControlMode` | `rg "initControlMode" ../engine/apps/docs/src/renderer/control.ts` | L97 | Docs 适配 |
| `../engine/apps/sheets/src/renderer/App.tsx` | `initControlMode` | `rg "initControlMode" ../engine/apps/sheets/src/renderer/App.tsx` | L1274 | 提前注册 |
| `../engine/apps/sheets/src/renderer/control.ts` | `initControlMode` | `rg "initControlMode" ../engine/apps/sheets/src/renderer/control.ts` | L88 | Sheets 适配 |
| `../engine/apps/slides/src/renderer/App.tsx` | `initControlMode` | `rg "initControlMode" ../engine/apps/slides/src/renderer/App.tsx` | L1131 | 当前上下文 |
| `../engine/apps/slides/src/renderer/control.ts` | `initControlMode` | `rg "initControlMode" ../engine/apps/slides/src/renderer/control.ts` | L90 | Slides 适配 |
| `../engine/apps/pdf/src/renderer/App.tsx` | `controlMergedCbRef` | `rg "controlMergedCbRef" ../engine/apps/pdf/src/renderer/App.tsx` | L4901 | PDF 快照合并 |
| `../engine/apps/pdf/src/renderer/control.ts` | `initControlMode` | `rg "initControlMode" ../engine/apps/pdf/src/renderer/control.ts` | L102 | PDF 适配 |
| `../engine/web/server.mjs` | `executors` | `rg "const executors" ../engine/web/server.mjs` | L70 | 注册与归属 |
| `../engine/web/server.mjs` | `waitForResult` | `rg "function waitForResult" ../engine/web/server.mjs` | L131 | pending 生命周期 |
| `../engine/web/write-atomic.mjs` | `writeFileAtomic` | `rg "export async function writeFileAtomic" ../engine/web/write-atomic.mjs` | L47 | 版本与原子写 |
| `../engine/web/write-atomic.test.mjs` | `writeFileAtomic` | `rg "writeFileAtomic" ../engine/web/write-atomic.test.mjs` | L6 | 现存 Node 测试 |
| `packages/tab-genoffice/src/host/tools.ts` | `waitUntilRegistered` | `rg "async function waitUntilRegistered" packages/tab-genoffice/src/host/tools.ts` | L107 | 插件 open 等待 |
| `packages/tab-genoffice/src/host/tools.ts` | `callRelay` | `rg "async function callRelay" packages/tab-genoffice/src/host/tools.ts` | L141 | 插件控制请求 |
| `packages/tab-genoffice/src/tabs/control-mode.tsx` | `setSaveState` | `rg "setSaveState" packages/tab-genoffice/src/tabs/control-mode.tsx` | L232 | 保存反馈 |

### 3.4 API / 数据 / 权限 / 路由影响

控制 API 增量承载 readiness/revision/expectedRevision/owner/导出版本，ASM-002 兼容旧调用。ASM-003 联通加载文件版本与写盘，不修改文档格式。expectedRevision 的可选兼容仅适用于编辑工具；已有路径写盘缺文件基线必须拒绝，旧调用者先读取取得文件版本后再保存。P0 盘点所有 POST /api/file 调用者并同步传递基线，避免将兼容编辑误解为允许无版本覆盖。权限/路由保持 INV-002。本包同步插件 open、控制请求和保存反馈；plugin-tool-alignment 随后在同一文件基础处理参数漂移及现存 callRelayRetry，不并行改源码。


版本域必须分开：编辑器 revision 对应全部持久化修改；磁盘文件版本对应实际加载字节；owner 只限定执行归属。P0 定义并测试响应结构，避免把 mtime 当编辑版本或把 owner 当访问权限。无 expectedRevision 的旧编辑调用保持原语义；已有路径的写盘不允许缺失文件版本。旧路径写盘调用者在同包迁移。

## 4. Phase 计划与任务详情

总入口：[Master handoff](../genoffice-web-roadmap/handoff.md)。未来执行由 master 连续调度本包；本包 CSV 是本包唯一任务状态源，跨包解锁须过 master gate。

无跨包前置；先核对当前两仓工作区与第 1 章基线。本轮生成校验不授权启动这里的任务。

任务依赖按下表序号串行。跨包依赖不能由 board.py 自动推断，各包 Task 1 负责核对母包及前置证据；“可开工”不等于本轮授权执行。

实现任务 10 项；其余为基线、验收、测量或回归。所有任务均为未来执行状态。

状态板见同目录 [tasks.csv](tasks.csv)，纯状态和导航，不复制业务合同。

### Phase 0: 可运行起点与基线

### Task 1: 归档基线并建立真实竞态复现入口

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / INV-001 / INV-002 / INV-003 / INV-004 / EVD-005
- **前置任务**：无（仍需核对上述跨包条件）
- **风险等级**：P1

**为什么做**：记录两仓 HEAD/status、Node 实际路径/版本与测试失败基线；历史临时证据只作为待复现输入，源文件不存在时按第 2.3 节重建，不把旧日志当修复证明。

**涉及文件与定位**：

- `../engine/apps/markdown/src/renderer/App.tsx`：`initControlMode`；`rg "initControlMode" ../engine/apps/markdown/src/renderer/App.tsx`；L194，行号仅 hint。
- `../engine/apps/markdown/src/renderer/web-bridge.ts`：`bytesFromRemote`；`rg "bytesFromRemote" ../engine/apps/markdown/src/renderer/web-bridge.ts`；L307，行号仅 hint。
- `../engine/web/server.mjs`：`executors`；`rg "const executors" ../engine/web/server.mjs`；L70，行号仅 hint。
- `../engine/web/write-atomic.mjs`：`writeFileAtomic`；`rg "export async function writeFileAtomic" ../engine/web/write-atomic.mjs`；L47，行号仅 hint。
- `../engine/web/write-atomic.test.mjs`：`writeFileAtomic`；`rg "writeFileAtomic" ../engine/web/write-atomic.test.mjs`；L6，行号仅 hint。

**具体操作**：

1. 记录两仓 HEAD/status、Node 实际路径/版本与测试失败基线；历史临时证据只作为待复现输入，源文件不存在时按第 2.3 节重建，不把旧日志当修复证明。
2. 未来新建 `../engine/web/e2e-control-session.mjs`（本轮未创建），实现 --baseline、--case、--all 与 --out 参数；从真实 relay+Chromium+临时磁盘复现五项浏览器缺陷和两项原子写缺陷，故障注入只延迟/中断真实 I/O，不替换编辑器、文件字节或写盘实现。
3. 确定增量协议字段与所有 /api/file 保存调用者；准备五族最小可审计文件和独立测试端口，记录原字节摘要；建立真实插件工具与 ControlModeViewer 的最小驱动以验证本包接入，不依赖后续插件契合包的测试脚本。复现命令 --baseline 仅在预期缺陷确实出现时成功。

**验证**：`node ../engine/web/e2e-control-session.mjs --baseline` → 七项既有缺陷逐项确认或记录已变更原因；`npm --prefix ../engine run typecheck` → 保存基线

**Evidence**：`evidence/phase-0/task-1.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 2: 完成 Markdown 加载状态最小闭环

- **关联**：BR-001 / BR-006 / UF-001 / INV-001 / EVD-001
- **前置任务**：1
- **风险等级**：P1

**为什么做**：把 SSE connected 与内容 ready 分离，真实读取/解析完成后才启用 context/tool/export；加载失败保留结构化错误，禁止按新文档回退。

**涉及文件与定位**：

- `../engine/apps/markdown/src/renderer/App.tsx`：`initControlMode`；`rg "initControlMode" ../engine/apps/markdown/src/renderer/App.tsx`；L194，行号仅 hint。
- `../engine/apps/markdown/src/renderer/web-bridge.ts`：`bytesFromRemote`；`rg "bytesFromRemote" ../engine/apps/markdown/src/renderer/web-bridge.ts`；L307，行号仅 hint。
- `../engine/apps/markdown/src/renderer/control.ts`：`initControlMode`；`rg "initControlMode" ../engine/apps/markdown/src/renderer/control.ts`；L82，行号仅 hint。
- `../engine/web/server.mjs`：`executors`；`rg "const executors" ../engine/web/server.mjs`；L70，行号仅 hint。

**具体操作**：

1. 把 SSE connected 与内容 ready 分离，真实读取/解析完成后才启用 context/tool/export；加载失败保留结构化错误，禁止按新文档回退。
2. 接线 App 读取成功/失败、控制状态与页面 loading/禁用/error/重开动作；覆盖延迟读时提前编辑及读取失败后保存。
3. 先跑 Markdown 打开→改一个文本块→显式保存→真实重开，再扩后续机制；最小闭环不通过不得推广其他族。

**验证**：`node ../engine/web/e2e-control-session.mjs --case markdown-loading` → 成功与两失败分支通过；`npm --prefix ../engine run typecheck`

**Evidence**：`evidence/phase-0/task-2.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 3: 执行 Phase 0 回归验证

- **关联**：BR-001 / BR-006 / UF-001 / INV-001 / EVD-005
- **前置任务**：2
- **风险等级**：P1

**为什么做**：重跑已实现的 Markdown 闭环及普通非 control 加载/保存；记录未修竞态，不把整个包标完成。

**涉及文件与定位**：

- `../engine/apps/markdown/src/renderer/App.tsx`：`initControlMode`；`rg "initControlMode" ../engine/apps/markdown/src/renderer/App.tsx`；L194，行号仅 hint。
- `../engine/apps/markdown/src/renderer/web-bridge.ts`：`bytesFromRemote`；`rg "bytesFromRemote" ../engine/apps/markdown/src/renderer/web-bridge.ts`；L307，行号仅 hint。
- `../engine/apps/markdown/src/renderer/control.ts`：`initControlMode`；`rg "initControlMode" ../engine/apps/markdown/src/renderer/control.ts`；L82，行号仅 hint。

**具体操作**：

1. 重跑已实现的 Markdown 闭环及普通非 control 加载/保存；记录未修竞态，不把整个包标完成。

**验证**：`node ../engine/web/e2e-control-session.mjs --case markdown-loading`；`npm --prefix ../engine run test -w @genoffice/markdown` → 通过

**Evidence**：`evidence/phase-0/task-3.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Phase 1: 按依赖扩展并验证

### Task 4: 接入独立读取版本及修改前校验

- **关联**：BR-002 / BR-006 / UF-002 / INV-004 / EVD-002
- **前置任务**：3
- **风险等级**：P1

**为什么做**：在共享运行时维护当前 revision；UI/键盘、工具、撤销重做与其他持久化修改统一推进，context/结果返回版本。

**涉及文件与定位**：

- `../engine/apps/markdown/src/renderer/control.ts`：`initControlMode`；`rg "initControlMode" ../engine/apps/markdown/src/renderer/control.ts`；L82，行号仅 hint。
- `../engine/web/server.mjs`：`executors`；`rg "const executors" ../engine/web/server.mjs`；L70，行号仅 hint。
- `../engine/web/server.mjs`：`waitForResult`；`rg "function waitForResult" ../engine/web/server.mjs`；L131，行号仅 hint。

**具体操作**：

1. 在共享运行时维护当前 revision；UI/键盘、工具、撤销重做与其他持久化修改统一推进，context/结果返回版本。
2. 将 expectedRevision 原样传至执行前检查，过期写入不改变文档并返回当前版本及重新读取办法；不要按 docId 保存所有 agent 共用的隐式 seen 状态。
3. 测试 A读/B插入/A旧索引写入，以及可选字段缺省的旧调用兼容；错误结果和页面内容同时核对。

**验证**：`node ../engine/web/e2e-control-session.mjs --case revision` → 旧版本零修改、重读后成功

**Evidence**：`evidence/phase-0/task-4.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 5: 绑定导出快照和保存确认版本

- **关联**：BR-003 / UF-003 / INV-003 / INV-004 / EVD-003
- **前置任务**：4
- **风险等级**：P0

**为什么做**：捕获导出字节对应 revision 与 owner，saved 回执只确认该快照；保存期间新增修改保持 dirty，写盘或序列化失败不清 dirty。

**涉及文件与定位**：

- `../engine/apps/markdown/src/renderer/control.ts`：`initControlMode`；`rg "initControlMode" ../engine/apps/markdown/src/renderer/control.ts`；L82，行号仅 hint。
- `../engine/web/server.mjs`：`executors`；`rg "const executors" ../engine/web/server.mjs`；L70，行号仅 hint。
- `packages/tab-genoffice/src/tabs/control-mode.tsx`：`setSaveState`；`rg "setSaveState" packages/tab-genoffice/src/tabs/control-mode.tsx`；L232，行号仅 hint。

**具体操作**：

1. 捕获导出字节对应 revision 与 owner，saved 回执只确认该快照；保存期间新增修改保持 dirty，写盘或序列化失败不清 dirty。
2. 接线共享回调与控制页保存反馈，保存完成和新的 dirty 事件不得被旧回执逆转；记录导出、写盘、回执、后续编辑四个时点。

**验证**：`node ../engine/web/e2e-control-session.mjs --case save-snapshot` → 保存中编辑和失败均保留 dirty

**Evidence**：`evidence/phase-0/task-5.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 6: 串行写盘并校验加载文件版本

- **关联**：BR-004 / UF-003 / INV-002 / INV-003 / INV-004 / EVD-003
- **前置任务**：5
- **风险等级**：P1

**为什么做**：复用现有临时文件+rename 原子替换，按规范目标路径串行化；队首再次比较从加载字节取得的文件版本，拒绝未知基线与任何真实内容冲突。

**涉及文件与定位**：

- `../engine/web/server.mjs`：`executors`；`rg "const executors" ../engine/web/server.mjs`；L70，行号仅 hint。
- `../engine/web/write-atomic.mjs`：`writeFileAtomic`；`rg "export async function writeFileAtomic" ../engine/web/write-atomic.mjs`；L47，行号仅 hint。
- `../engine/web/write-atomic.test.mjs`：`writeFileAtomic`；`rg "writeFileAtomic" ../engine/web/write-atomic.test.mjs`；L6，行号仅 hint。

**具体操作**：

1. 复用现有临时文件+rename 原子替换，按规范目标路径串行化；队首再次比较从加载字节取得的文件版本，拒绝未知基线与任何真实内容冲突。
2. 同步 relay export 与 POST /api/file 调用者传递文件版本，去除以 100ms 容差判断内容一致的假设；新建/另存为保证目标不存在。
3. 扩现有 write-atomic.test 覆盖同基线并发、50ms 外改、目标存在、失败清理；公开 API 与真实磁盘再次验证，不能只测助手。

**验证**：`node --test ../engine/web/write-atomic.test.mjs`；`node ../engine/web/e2e-control-session.mjs --case file-conflict` → 并发至多一项成功，外改字节保留

**Evidence**：`evidence/phase-0/task-6.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 7: 稳定执行所有权并拒绝晚到回执

- **关联**：BR-005 / BR-006 / UF-004 / INV-002 / INV-004 / EVD-004
- **前置任务**：6
- **风险等级**：P1

**为什么做**：owner 贯穿注册、pending、notify 与 saved；后开窗口显示 occupied，不替换现 owner；原 owner 可有限重连，关闭后才允许显式重新打开接管。

**涉及文件与定位**：

- `../engine/apps/markdown/src/renderer/control.ts`：`initControlMode`；`rg "initControlMode" ../engine/apps/markdown/src/renderer/control.ts`；L82，行号仅 hint。
- `../engine/web/server.mjs`：`executors`；`rg "const executors" ../engine/web/server.mjs`；L70，行号仅 hint。
- `../engine/web/server.mjs`：`waitForResult`；`rg "function waitForResult" ../engine/web/server.mjs`；L131，行号仅 hint。

**具体操作**：

1. owner 贯穿注册、pending、notify 与 saved；后开窗口显示 occupied，不替换现 owner；原 owner 可有限重连，关闭后才允许显式重新打开接管。
2. 绑定连接代际并拒绝旧 owner/旧请求结果，清理超时与断线 pending；发生结果未知时明确提示先读确认，不自动重放写请求。
3. 接线 visibility/page 生命周期与占用/恢复提示，跑双可见窗口持续注册计数及延迟 notify。

**验证**：`node ../engine/web/e2e-control-session.mjs --case owner` → 双窗不互踢、旧回执不完成新请求

**Evidence**：`evidence/phase-0/task-7.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 8: 执行 Phase 1 回归验证

- **关联**：BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / UF-002 / UF-003 / UF-004 / EVD-005
- **前置任务**：7
- **风险等级**：P1

**为什么做**：逐项复验版本、保存、队列和 owner 后组合交错；同时跑合法/非法 Host 与参数，不降低 loopback 约束。

**涉及文件与定位**：

- `../engine/apps/markdown/src/renderer/control.ts`：`initControlMode`；`rg "initControlMode" ../engine/apps/markdown/src/renderer/control.ts`；L82，行号仅 hint。
- `../engine/web/server.mjs`：`executors`；`rg "const executors" ../engine/web/server.mjs`；L70，行号仅 hint。
- `../engine/web/write-atomic.mjs`：`writeFileAtomic`；`rg "export async function writeFileAtomic" ../engine/web/write-atomic.mjs`；L47，行号仅 hint。

**具体操作**：

1. 逐项复验版本、保存、队列和 owner 后组合交错；同时跑合法/非法 Host 与参数，不降低 loopback 约束。

**验证**：`node ../engine/web/e2e-control-session.mjs --case markdown-state`；`node --test ../engine/web/write-atomic.test.mjs`；`npm --prefix ../engine run typecheck` → 全部通过

**Evidence**：`evidence/phase-0/task-8.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Phase 2: 完整接线与验收

### Task 9: 推广 Docs 加载及全修改状态接线

- **关联**：BR-001 / BR-002 / BR-003 / BR-005 / BR-006 / UF-001 / UF-002 / UF-003 / UF-004 / INV-003 / EVD-001 / EVD-002 / EVD-003 / EVD-004
- **前置任务**：8
- **风险等级**：P1

**为什么做**：以 Markdown 已通过共享接口接入 Docs App/file-actions；校准文档/批注等真实修改源与导出回调，保持原工具及文件保真；加载、禁用、错误与保存反馈接真实入口。

**涉及文件与定位**：

- `../engine/apps/docs/src/renderer/App.tsx`：`initControlMode`；`rg "initControlMode" ../engine/apps/docs/src/renderer/App.tsx`；L1371，行号仅 hint。
- `../engine/apps/docs/src/renderer/file-actions.ts`：`loadFile`；`rg "export async function loadFile" ../engine/apps/docs/src/renderer/file-actions.ts`；L243，行号仅 hint。
- `../engine/apps/docs/src/renderer/control.ts`：`initControlMode`；`rg "initControlMode" ../engine/apps/docs/src/renderer/control.ts`；L97，行号仅 hint。

**具体操作**：

1. 以 Markdown 已通过共享接口接入 Docs App/file-actions；校准文档/批注等真实修改源与导出回调，保持原工具及文件保真；加载、禁用、错误与保存反馈接真实入口。

**验证**：`node ../engine/web/e2e-control-session.mjs --case docs-state`；`npm --prefix ../engine run test -w @genoffice/docs` → 通过

**Evidence**：`evidence/phase-0/task-9.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 10: 推广 Sheets journal 与保存状态接线

- **关联**：BR-001 / BR-002 / BR-003 / BR-005 / BR-006 / UF-001 / UF-002 / UF-003 / UF-004 / INV-003 / EVD-001 / EVD-002 / EVD-003 / EVD-004
- **前置任务**：9
- **风险等级**：P0

**为什么做**：对接真实工作簿加载、journal/撤销和 save payload，revision 覆盖单元格、格式、图片等持久化修改；保存确认不覆盖新增 journal，空或失败读取不得 ready。

**涉及文件与定位**：

- `../engine/apps/sheets/src/renderer/App.tsx`：`initControlMode`；`rg "initControlMode" ../engine/apps/sheets/src/renderer/App.tsx`；L1274，行号仅 hint。
- `../engine/apps/sheets/src/renderer/control.ts`：`initControlMode`；`rg "initControlMode" ../engine/apps/sheets/src/renderer/control.ts`；L88，行号仅 hint。

**具体操作**：

1. 对接真实工作簿加载、journal/撤销和 save payload，revision 覆盖单元格、格式、图片等持久化修改；保存确认不覆盖新增 journal，空或失败读取不得 ready。

**验证**：`node ../engine/web/e2e-control-session.mjs --case sheets-state`；`npm --prefix ../engine run test -w @genoffice/sheets` → 通过

**Evidence**：`evidence/phase-0/task-10.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 11: 推广 Slides 事务和导出状态接线

- **关联**：BR-001 / BR-002 / BR-003 / BR-005 / BR-006 / UF-001 / UF-002 / UF-003 / UF-004 / INV-003 / EVD-001 / EVD-002 / EVD-003 / EVD-004
- **前置任务**：10
- **风险等级**：P1

**为什么做**：事务/UI 修改和历史操作统一推进 revision；保留 page-spec 与 apply_ops 行为，捕获与导出字节对应的快照版本；接线加载失败和 occupied 反馈。

**涉及文件与定位**：

- `../engine/apps/slides/src/renderer/App.tsx`：`initControlMode`；`rg "initControlMode" ../engine/apps/slides/src/renderer/App.tsx`；L1131，行号仅 hint。
- `../engine/apps/slides/src/renderer/control.ts`：`initControlMode`；`rg "initControlMode" ../engine/apps/slides/src/renderer/control.ts`；L90，行号仅 hint。

**具体操作**：

1. 事务/UI 修改和历史操作统一推进 revision；保留 page-spec 与 apply_ops 行为，捕获与导出字节对应的快照版本；接线加载失败和 occupied 反馈。

**验证**：`node ../engine/web/e2e-control-session.mjs --case slides-state`；`npm --prefix ../engine run test -w @genoffice/slides` → 通过

**Evidence**：`evidence/phase-0/task-11.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 12: 推广 PDF 合并重载与保存状态接线

- **关联**：BR-001 / BR-002 / BR-003 / BR-005 / BR-006 / UF-001 / UF-002 / UF-003 / UF-004 / INV-003 / EVD-001 / EVD-002 / EVD-003 / EVD-004
- **前置任务**：11
- **风险等级**：P0

**为什么做**：对接 getSaveRequest/onMerged，不把保存后合并重载视为可覆盖较新编辑；保留未保存增量、页面操作和批注对应状态；用保存中继续编辑的 PDF 真实文件证明。

**涉及文件与定位**：

- `../engine/apps/pdf/src/renderer/App.tsx`：`controlMergedCbRef`；`rg "controlMergedCbRef" ../engine/apps/pdf/src/renderer/App.tsx`；L4901，行号仅 hint。
- `../engine/apps/pdf/src/renderer/control.ts`：`initControlMode`；`rg "initControlMode" ../engine/apps/pdf/src/renderer/control.ts`；L102，行号仅 hint。

**具体操作**：

1. 对接 getSaveRequest/onMerged，不把保存后合并重载视为可覆盖较新编辑；保留未保存增量、页面操作和批注对应状态；用保存中继续编辑的 PDF 真实文件证明。

**验证**：`node ../engine/web/e2e-control-session.mjs --case pdf-state`；`npm --prefix ../engine run test -w @genoffice/pdf` → 通过

**Evidence**：`evidence/phase-0/task-12.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 13: 接入插件打开版本及保存反馈

- **关联**：BR-001 / BR-002 / BR-003 / BR-006 / UF-001 / UF-002 / UF-003 / INV-004 / EVD-001 / EVD-002 / EVD-003
- **前置任务**：12
- **风险等级**：P0

**为什么做**：waitUntilRegistered 消费真实 ready/load-error；callRelay 和结果显式透传 revision/expectedRevision，缺省兼容不共用隐式 agent 基线。

**涉及文件与定位**：

- `packages/tab-genoffice/src/host/tools.ts`：`waitUntilRegistered`；`rg "async function waitUntilRegistered" packages/tab-genoffice/src/host/tools.ts`；L107，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：`callRelay`；`rg "async function callRelay" packages/tab-genoffice/src/host/tools.ts`；L141，行号仅 hint。
- `packages/tab-genoffice/src/tabs/control-mode.tsx`：`setSaveState`；`rg "setSaveState" packages/tab-genoffice/src/tabs/control-mode.tsx`；L232，行号仅 hint。

**具体操作**：

1. waitUntilRegistered 消费真实 ready/load-error；callRelay 和结果显式透传 revision/expectedRevision，缺省兼容不共用隐式 agent 基线。
2. 保存 UI 依导出快照和新 dirty 事件更新，补失败提示与恢复入口。仅修本包接入；原 executeLandPages 的重放在下一包集中移除，此处不宣称该包装器已安全。
3. 向下一包移交实际协议和修改文件清单，避免覆盖同一个 host/tools.ts。

**验证**：`npm run typecheck`；`npm test`；`node ../engine/web/e2e-control-session.mjs --case plugin-state` → 真实插件请求/保存路径通过

**Evidence**：`evidence/phase-0/task-13.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 14: 执行 spec 5.2 真实场景全套测试

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / UF-001 / UF-002 / UF-003 / UF-004 / INV-001 / INV-002 / INV-003 / INV-004 / EVD-001 / EVD-002 / EVD-003 / EVD-004
- **前置任务**：13
- **风险等级**：P1

**为什么做**：按第 5.2 节全部矩阵执行，覆盖五族与所有失败分支；保留原文件、结果文件、磁盘摘要及截图/console/network。加载延迟和断线注入后必须继续完成恢复路径。

**涉及文件与定位**：

- `../engine/apps/markdown/src/renderer/App.tsx`：`initControlMode`；`rg "initControlMode" ../engine/apps/markdown/src/renderer/App.tsx`；L194，行号仅 hint。
- `../engine/apps/docs/src/renderer/App.tsx`：`initControlMode`；`rg "initControlMode" ../engine/apps/docs/src/renderer/App.tsx`；L1371，行号仅 hint。
- `../engine/apps/sheets/src/renderer/App.tsx`：`initControlMode`；`rg "initControlMode" ../engine/apps/sheets/src/renderer/App.tsx`；L1274，行号仅 hint。
- `../engine/apps/slides/src/renderer/App.tsx`：`initControlMode`；`rg "initControlMode" ../engine/apps/slides/src/renderer/App.tsx`；L1131，行号仅 hint。
- `../engine/apps/pdf/src/renderer/App.tsx`：`controlMergedCbRef`；`rg "controlMergedCbRef" ../engine/apps/pdf/src/renderer/App.tsx`；L4901，行号仅 hint。
- `../engine/web/server.mjs`：`executors`；`rg "const executors" ../engine/web/server.mjs`；L70，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：`waitUntilRegistered`；`rg "async function waitUntilRegistered" packages/tab-genoffice/src/host/tools.ts`；L107，行号仅 hint。

**具体操作**：

1. 按第 5.2 节全部矩阵执行，覆盖五族与所有失败分支；保留原文件、结果文件、磁盘摘要及截图/console/network。加载延迟和断线注入后必须继续完成恢复路径。

**验证**：`node ../engine/web/e2e-control-session.mjs --all` → 五族全部矩阵通过，实际写盘与重开一致

**Evidence**：`evidence/phase-0/task-14.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

### Task 15: 执行 Phase 2 回归验证

- **关联**：BR-001 / BR-002 / BR-003 / BR-004 / BR-005 / BR-006 / INV-001 / INV-002 / INV-003 / INV-004 / EVD-005
- **前置任务**：14
- **风险等级**：P1

**为什么做**：运行完整相关校验并核对普通非 control 行为；将真实场景任务标完成后再次运行包证据闸门。

**涉及文件与定位**：

- `../engine/web/server.mjs`：`executors`；`rg "const executors" ../engine/web/server.mjs`；L70，行号仅 hint。
- `../engine/web/write-atomic.mjs`：`writeFileAtomic`；`rg "export async function writeFileAtomic" ../engine/web/write-atomic.mjs`；L47，行号仅 hint。
- `packages/tab-genoffice/src/host/tools.ts`：`waitUntilRegistered`；`rg "async function waitUntilRegistered" packages/tab-genoffice/src/host/tools.ts`；L107，行号仅 hint。

**具体操作**：

1. 运行完整相关校验并核对普通非 control 行为；将真实场景任务标完成后再次运行包证据闸门。

**验证**：`npm --prefix ../engine run typecheck`；`npm --prefix ../engine run test`；`npm --prefix ../engine run web:build --workspaces --if-present`；`npm run typecheck`；`npm test`；`npm run build`；`npm run standard:check`；`python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/control-session-safety --repo .` → 全通过，证据齐全

**Evidence**：`evidence/phase-0/task-15.log`；用户路径按第 5.2 节具体路径归档。

**注意事项**：先核对稳定符号再改，按小增量验证；新测试入口仅在前述创建任务完成后可运行。这些是未来实现任务；收到 execute 指令后按实际验证结果更新 CSV 并持续推进。包生成校验不能替代业务验收。

## 5. 验收与 Review 协议

### 5.1 命令级验证

本轮仅运行包结构/源码锚点/状态板/视图校验。下列业务命令是未来执行闸门；命令级通过之后仍须运行第 5.2 节。

| 验证项 | 命令（插件仓根） | 期望 |
|---|---|---|
| 本轮规格 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/control-session-safety --repo .` | 退出 0；规格必须 0 FAIL |
| 本轮状态 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/board.py docs/control-session-safety --json` | 全部任务待开始；后续实施由事实更新 |
| 本轮视图 | `python3 /Users/nothing/.agents/skills/prd-workflow/scripts/render_spec.py docs/control-session-safety` | 退出 0；规格必须 0 FAIL |
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
| 插件入口 | 由本包 Task 1 建立真实插件工具/ControlModeViewer 驱动并连接真实 relay，至少以现可达 Office 入口验证新状态字段和保存反馈。五族协议均从真实控制 API/浏览器验证；默认与显式 Sidebar 的 md/pdf 分流是下一包目标，不能使本包测试反向依赖下一包脚本。完整 DSH 隔离联调条件由本包 Task 1 记录，不借用用户 profile。 |
| 数据与权限 | 由 Task 1 生成可审计临时文件；只使用测试目录与已配置服务。双 agent 分别保留读取版本，浏览器 profile/下载目录隔离；日志不含凭据或真实用户文档。 |
| 干净状态 | 每组用例复制初始 fixture、记录哈希和版本；关闭本组拥有的页面/进程并清理临时输出；不删除源码仓库或用户数据。 |
| 测试工具 | 本地已安装 Playwright/Chromium、Node HTTP、真实 relay 与文件系统。若后续环境缺浏览器，先恢复依赖；无法恢复则按第 2.3 节生成手动逐步脚本供回填，未获真实结果不得完成。 |
| 验证入口 | `node ../engine/web/e2e-control-session.mjs --all`；这是 Task 1 要新增的真实回放脚本，本轮未创建。默认 relay 地址为上述隔离端口，提供 `--out` 指向本包 evidence；逐项 `--case` 名称见任务验证行，全部必须由创建任务实现。 |

**执行矩阵**：每行归档实际 request/response、console/server 输出、network 与截图；预期故障单独标注，不能吞掉非预期错误。result.json 必须枚举全部适用 app/入口/能力子例、成功断言、失败断言、恢复结果及输出文件清单，不允许只写一个总 pass。

| UF | 执行方式 | 操作来源 | 必须核对的点 | Evidence |
|---|---|---|---|---|
| UF-001 主路径 | browser + 公开 API + 真实磁盘 | 第 2.3 节 UF-001 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-001/success/result.json`、`evidence/UF-001/success/console.log`、`evidence/UF-001/success/network.json`、`evidence/UF-001/success/screenshot.png` |
| UF-001 失败分支：加载中编辑 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：延迟文件读取 | 不执行文档读写；恢复：ready 后显式提交；恢复后重走成功路径 | `evidence/UF-001/failure-1/result.json`、`evidence/UF-001/failure-1/console.log`、`evidence/UF-001/failure-1/network.json`、`evidence/UF-001/failure-1/screenshot.png` |
| UF-001 失败分支：加载失败 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：读取错误、断网或非法字节 | 不回退新建，拒绝编辑/export；恢复：修复来源后显式重开；恢复后重走成功路径 | `evidence/UF-001/failure-2/result.json`、`evidence/UF-001/failure-2/console.log`、`evidence/UF-001/failure-2/network.json`、`evidence/UF-001/failure-2/screenshot.png` |
| UF-002 主路径 | browser + 公开 API + 真实磁盘 | 第 2.3 节 UF-002 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-002/success/result.json`、`evidence/UF-002/success/console.log`、`evidence/UF-002/success/network.json`、`evidence/UF-002/success/screenshot.png` |
| UF-002 失败分支：旧 revision | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：B 插入块后 A 仍用旧版 | 执行前拒绝，返回当前版本；恢复：A 重读并重新决策；恢复后重走成功路径 | `evidence/UF-002/failure-1/result.json`、`evidence/UF-002/failure-1/console.log`、`evidence/UF-002/failure-1/network.json`、`evidence/UF-002/failure-1/screenshot.png` |
| UF-002 失败分支：回执丢失 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：工具执行后 notify 失败 | 显式报告错误，不重放；恢复：先读内容确认；恢复后重走成功路径 | `evidence/UF-002/failure-2/result.json`、`evidence/UF-002/failure-2/console.log`、`evidence/UF-002/failure-2/network.json`、`evidence/UF-002/failure-2/screenshot.png` |
| UF-003 主路径 | browser + 公开 API + 真实磁盘 | 第 2.3 节 UF-003 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-003/success/result.json`、`evidence/UF-003/success/console.log`、`evidence/UF-003/success/network.json`、`evidence/UF-003/success/screenshot.png` |
| UF-003 失败分支：外部修改 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：与 baseline 相差不足 100ms 或摘要变化 | 不覆盖外部字节；恢复：显式重开/合并后再存；恢复后重走成功路径 | `evidence/UF-003/failure-1/result.json`、`evidence/UF-003/failure-1/console.log`、`evidence/UF-003/failure-1/network.json`、`evidence/UF-003/failure-1/screenshot.png` |
| UF-003 失败分支：同基线并发 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：同一目标两个保存请求 | 队列内重新验证；恢复：读文件与编辑器状态再决策；恢复后重走成功路径 | `evidence/UF-003/failure-2/result.json`、`evidence/UF-003/failure-2/console.log`、`evidence/UF-003/failure-2/network.json`、`evidence/UF-003/failure-2/screenshot.png` |
| UF-003 失败分支：写盘/导出失败 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：无权限、序列化失败、断线 | 不发虚假 saved，不覆盖；恢复：修复后显式再存；恢复后重走成功路径 | `evidence/UF-003/failure-3/result.json`、`evidence/UF-003/failure-3/console.log`、`evidence/UF-003/failure-3/network.json`、`evidence/UF-003/failure-3/screenshot.png` |
| UF-004 主路径 | browser + 公开 API + 真实磁盘 | 第 2.3 节 UF-004 成功步骤逐步回放 | 即时反馈、实际结果与持久化均吻合；全部适用族/入口子例通过 | `evidence/UF-004/success/result.json`、`evidence/UF-004/success/console.log`、`evidence/UF-004/success/network.json`、`evidence/UF-004/success/screenshot.png` |
| UF-004 失败分支：短暂断线 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：owner 网络断后恢复 | 同 owner 重连，旧请求报错不重放；恢复：先读上下文确认；恢复后重走成功路径 | `evidence/UF-004/failure-1/result.json`、`evidence/UF-004/failure-1/console.log`、`evidence/UF-004/failure-1/network.json`、`evidence/UF-004/failure-1/screenshot.png` |
| UF-004 失败分支：旧结果晚到 | browser + 公开 API + 真实磁盘 | 第 2.3 节对应分支；触发：新连接建立后旧 owner notify | 校验 owner/请求归属，拒绝旧回执；恢复：新请求按自身结果完成；恢复后重走成功路径 | `evidence/UF-004/failure-2/result.json`、`evidence/UF-004/failure-2/console.log`、`evidence/UF-004/failure-2/network.json`、`evidence/UF-004/failure-2/screenshot.png` |

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
