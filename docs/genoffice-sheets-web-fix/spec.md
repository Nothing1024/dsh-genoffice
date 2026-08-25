# genoffice-sheets-web-fix Spec

> Version: 0.1.0 | Date: 2026-08-21 | Status: Done 已验收（P0–P3 已执行；布局方案 B 已落地，性能本轮只出基线、不改解析代码）
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
| 原始需求 | 用户反馈：本地自建 web 版 GenOffice，在插件（`dsh-tab-genoffice`）控制模式内嵌打开 xlsx 时，编辑区域只显示约一半（顶栏完整），且整体性能卡顿严重；要求修复布局问题并对性能问题做优化排期 |
| 输入类型 | description（来自当前对话上下文，已完成两轮 Explore 调研） |
| Mode | oneclick |
| 置信度 | 高（布局 bug 根因已在前序调研中定位到具体文件/symbol，本次已重新核实；性能问题根因分散，部分为 `待勘察` 但已定性为独立 Phase） |
| 输出目录 | `/Users/nothing/workspace/dsh/genoffice/docs/genoffice-sheets-web-fix/`（栈编排层；代码改动落在 `upstream/apps/sheets/`，是 `genspark-ai/genoffice` 的本地 fork，独立 git 仓库） |

### 1.2 任务类型路由

| 维度 | 结论 |
|---|---|
| 任务类型 | bugfix（布局截断，P0）+ performance（渲染/解析/首包体积卡顿，P1，先度量后优化） |
| 主要风险 | 布局修复需要覆盖「用户手动收起 AI 面板」与「控制模式下 AI 面板整体不渲染」两条独立状态，避免修复一个引入另一个的回归；性能优化没有现成 profiling 数据，必须先建基线再决定优化点，禁止凭猜测改代码 |
| 行号引用策略 | bugfix 用中等（症状复现优先，行号定位可疑区域）；performance 用低（先基线数据，行号只在确定瓶颈后才重要） |
| 必需验收方式 | browser（Chrome/Playwright 真实渲染 + DevTools Performance/Network 面板）+ manual（无自动化环境时的手动截图对比） |
| 必须覆盖用户场景 | 控制模式（`control=1`，插件 iframe 嵌入，典型宽度 700-900px）下打开 xlsx：小文件正常显示、AI 面板收起后正常显示、大文件加载耗时可接受；非控制模式（独立浏览器 tab 打开）作为对照组，确认改动不引入回归 |

### 1.3 勘察事实清单

> 每条事实必须来自实际执行的命令。没跑命令的不许写在这里。

| 事实 | 来源命令 | 输出摘要 |
|---|---|---|
| 编辑区域收窄根因：`.sheet-body` 用 CSS Grid 两列布局，第一列宽度由 `--copilot-width`（默认 360px）驱动，与该列是否有真实 DOM 子元素无关 | `sed -n '1359,1365p' upstream/apps/sheets/src/renderer/styles.css` | `grid-template-columns: var(--copilot-width, 360px) minmax(0, 1fr);` |
| 控制模式下 AI 面板整体不渲染（`CONTROL_MODE` 为 true 时 `<AiChatPanel>` 分支被跳过） | `sed -n '420,445p' upstream/apps/sheets/src/renderer/ExcelShell.tsx` | L422 `{!CONTROL_MODE && (<AiChatPanel .../>)}` |
| 驱动 grid 列收窄的状态 `isCopilotOpen` 初始值硬编码为 `true`，且全文件无任何地方让它感知 `CONTROL_MODE` | `rg -n "isCopilotOpen" upstream/apps/sheets/src/renderer/ExcelShell.tsx` | L273 `useState(true)`；L319/415/424/2081 均直接消费该状态，无 `CONTROL_MODE` 联动 |
| 唯一的收窄补偿规则只覆盖"用户手动点击收起"（`copilot-collapsed` class），未覆盖"控制模式下面板整体不渲染" | `sed -n '1445,1447p' upstream/apps/sheets/src/renderer/styles.css` | `.app-shell.copilot-collapsed .sheet-body { grid-template-columns: 34px minmax(0, 1fr); }` |
| 插件侧 iframe 嵌入宽度受限于侧栏面板（`flex:1` 占满可用宽度，无固定像素值，但典型侧栏场景远小于 1600px 全屏） | `sed -n '199,206p' packages/tab-genoffice/src/tabs/genoffice.module.css`（当前仓库路径 `/Users/nothing/workspace/dsh/plugin/dsh-genoffice/plugin`） | `.iframe { flex: 1; min-height: 0; border: 0; ... }`，容器宽度由外层侧栏面板决定，非全屏 |
| `control=1` 仅由插件 `previewUrlFor(path, ext, control=true, nonce)` 构造，是本 bug 唯一触发路径；桌面 Electron 版从不传 `control=1` | `grep -n "previewUrlFor\|control=1" packages/tab-genoffice/src/tabs/relay.ts` | L71/76：`control ? 'control=1&' : ''`，只在控制模式 viewer 中被设为 true |
| docs/slides 两个 app 用 flex 布局（`.app-main { display:flex }` + `.ai-dock` 用 `width` 而非 grid 列），`AiChatPanel`/`AiPanel` 用 `hideAi` prop 由 ribbon 侧隐藏按钮但**容器本身仍走 flex 自然收窄**，不受这个 grid-track 问题影响 | `sed -n '7530,7540p' upstream/apps/docs/src/renderer/styles.css`；`sed -n '7020,7030p' upstream/apps/slides/src/renderer/styles.css` | 两处均 `display: flex` + 子元素 `width`/`flex` 驱动，不是"声明列宽独立于子元素存在"的 grid-track 模式；sheets 是三个 app 里唯一用 grid 且唯一复现此 bug 的 |
| xlsx worksheet 解析在浏览器主线程用正则 `matchAll` 逐段解析 XML 字符串，未使用 Web Worker | `rg -n "cellPattern|matchAll" upstream/apps/sheets/src/renderer/web-xlsx.ts` | L368 `const cellPattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g`；L370 起 `while ((match = cellPattern.exec(xml)) ...)`，及另外 9 处 `matchAll` 调用，均在主线程同步执行 |
| web 版公式重算硬编码为空实现，无原生 sidecar 兜底 | `sed -n '249,253p' upstream/apps/sheets/src/renderer/web-bridge.ts` | `recalcWorkbook: async (_request) => { // browser has no IronCalc sidecar ...; return { cells: [] } }` |
| Univer 表格引擎用 `ResizeObserver` 驱动 canvas 尺寸重算 | `grep -n "ResizeObserver" upstream/node_modules/@univerjs/engine-render/lib/es/index.js` | L24462 起：`this._resizeObserver = new ResizeObserver(() => { ...this.resize()... })` |
| sheets web 构建产物主 bundle 约 9.5MB，未做路由级代码分割；总产物 19MB（含 197 个语言包 chunk） | `du -sh upstream/apps/sheets/web-dist; ls -la upstream/apps/sheets/web-dist/assets \| sort -k5 -nr \| head -5` | `19M` 总量；`index-D6kw6VLu.js` 单文件 `10000116` 字节（约 9.5MB） |
| sheets 已有基准测试脚本（`benchmark-xlsx.ts`：小规模合成 fixture 计时；`benchmark-large-xlsx.ts`：走桌面版 Rust sidecar，读取 `LARGE_XLSX_FIXTURE` 环境变量指定的真实大文件），但都是针对**桌面版 gateway/sidecar 路径**，没有面向浏览器主线程解析路径的基准 | `cat upstream/apps/sheets/scripts/benchmark-xlsx.ts upstream/apps/sheets/scripts/benchmark-large-xlsx.ts` | 前者调 `applyPlanToXlsx`（`gateway/xlsx-gateway`）；后者起 `XlsxSidecarClient`（原生进程），均不经过 `web-xlsx.ts` 的浏览器解析路径 |
| 项目已有 Playwright 1.62.1 + Chromium 可执行环境，但现有 e2e 套件针对 Electron 桌面壳（`electron.launch`），未覆盖 web 构建 | `cat upstream/e2e/playwright.config.ts`；`ls ~/Library/Caches/ms-playwright` | config 顶部注释："tests launch the real built app (electron.launch)"；chromium-1228 等浏览器已安装，可另写脚本连 web-dist 静态服务或 `npm run web:dev` |
| sheets 目前没有大体量真实 xlsx 测试夹具（现有 `fixtures/generated/*.xlsx` 均为小型 compatibility 夹具） | `ls upstream/apps/sheets/fixtures/generated` | 5 个文件，均为 `compatibility-*.xlsx`，无标注行数/大小的性能专用夹具 |
| sheets typecheck/gate 命令存在，可作为改动后的入场券 | `cat upstream/apps/sheets/package.json` (`scripts` 段) | `typecheck: tsc --noEmit`；`gate: npm run typecheck && npm run fixtures && npm test && npm run compat` |
| 本地 web relay 启动方式（真实场景测试的启动命令来源） | `head -10 /Users/nothing/workspace/dsh/genoffice/scripts/dev.mjs`（`start-relay` 分支注释） | `node scripts/dev.mjs start-relay` 拉起 `:8787` relay，日志落 `/tmp/genoffice-web.log`；DSH 侧栏在 `:3080` |

### 1.4 假设清单

| 假设 ID | 内容 | 风险 | 确认方式 |
|---|---|---|---|
| ASM-001 | "编辑区域显示不全"截图对应的容器宽度在 700–900px 区间（插件侧栏典型宽度），而非全屏 | 若用户实际是在极窄侧栏（<500px）或分屏窄窗打开，360px 死区占比更极端，修复后仍可能有其他挤压问题，需要 Task 3 的真实截图核实 | Task 3 用 DevTools 设备模拟/窗口尺寸截图复现，比对用户描述 |
| ASM-002 | 性能卡顿的"很严重"主要发生在**打开/首次渲染阶段**和/或**滚动交互阶段**，而不是"保存"阶段（保存走 relay 原子写回，逻辑独立且历次验收未标记性能问题） | 若卡顿主要在保存阶段，Phase 2 的 profiling 范围需要扩展到 `control.ts` 的 `notify`/`buildSavePayload` 路径 | Task 6 profiling 时同时记录打开、滚动、保存三段耗时，若保存耗时异常再追加校准任务 |
| ASM-003 | Univer 在浏览器原生 canvas 场景与在插件 `<iframe sandbox="allow-scripts allow-same-origin allow-downloads">` 内嵌场景之间，硬件加速合成路径没有本质性能差异（即 iframe 嵌套本身不是主要瓶颈） | 若假设错误，Phase 2 的优化方向需要额外排查 iframe 合成层问题，可能超出应用代码可控范围（需要插件侧调整 iframe 属性或改为非 iframe 挂载） | Task 6 profiling 时对比"iframe 内打开"与"独立 tab 打开"同一文件的耗时/FPS 数据，若有显著差异记录为新发现并升级为 P0 |

---

## 2. 业务合同

### 2.1 BR 业务规则

| 规则 ID | 规则 | 正例 | 反例 | 影响范围 | 验证方式 |
|---|---|---|---|---|---|
| BR-001 | 控制模式（`control=1`）下，`.sheet-body` 的可用宽度不得被已移除的 AI 面板列预留空间挤占；表格编辑区应占据除 ribbon/状态栏外的全部可用宽度 | 控制模式打开 700px 容器中的 xlsx，`#univer-container` 实际渲染宽度 ≈ 700px（扣除极小边距） | 控制模式打开同样容器，`#univer-container` 实际渲染宽度 ≈ 340px（少了 360px 死区） | `upstream/apps/sheets/src/renderer/ExcelShell.tsx`、`styles.css` | browser：DevTools 测量元素实际宽度 |
| BR-002 | 非控制模式（独立 tab 打开，AI 面板正常参与布局）下的显示效果不得因本次修复发生回归 | 独立 tab 打开 xlsx，AI 面板展开/收起两种状态下表格区域宽度与修复前一致 | 修复后独立 tab 打开时 AI 面板消失或宽度错乱 | 同上 | browser：修复前后截图对比 |
| BR-003 | 性能优化任务在没有基线数据前不得直接改动渲染/解析逻辑；必须先产出量化的 profiling 基线（打开耗时、主线程阻塞时长、首包大小），再针对基线中占比最高的瓶颈项排优化顺序 | Phase 2 先跑 `benchmark`/DevTools Performance 记录基线数字，再基于数字决定第一个优化点 | 跳过基线直接"看起来卡就优化xxx" | `upstream/apps/sheets/scripts/`、profiling evidence | manual/benchmark：基线文档 + before/after 对比 |
| BR-004 | 本次性能优化任务范围内产出的任何代码改动，必须保持现有 xlsx 保真度（打开/编辑/保存的单元格值、格式、公式结果不变），不得为了"更快"丢失数据 | 优化后打开同一测试夹具，单元格值/格式与优化前逐一对比一致 | 优化后行数变多的大文件出现单元格值缺失或格式丢失 | `upstream/apps/sheets/src/renderer/web-xlsx.ts` 及相关 | test：现有 `compat`/`test` 脚本 + 抽样对比 |

### 2.2 UF 用户验收场景（索引）

| 场景 ID | Given | When | Then | 角色 | 验证方式 | Evidence |
|---|---|---|---|---|---|---|
| UF-001 | 用户在 DSH 插件侧栏（典型宽度容器）控制模式下打开一个 xlsx 文件 | 页面加载完成 | 表格编辑区域占据除 ribbon/状态栏外的全部可用宽度，不出现约一半宽度的死区 | 插件用户 | browser | EVD-001 |
| UF-002 | 用户在控制模式下打开 xlsx 后，AI 面板本就不可见（`CONTROL_MODE` 生效） | 用户尝试调整浏览器/容器窗口大小 | 表格区域随容器宽度联动伸展，始终不留 360px 死区 | 插件用户 | browser | EVD-002 |
| UF-003 | 用户在非控制模式（独立浏览器 tab）打开 xlsx，AI 面板正常显示/可收起 | 用户点击 AI 面板收起/展开按钮 | 表格区域按原有行为伸展/收缩，与修复前一致（无回归） | Web 独立用户 | browser | EVD-003 |
| UF-004 | 用户在本地自建 web 版打开一个较大的 xlsx 文件（几千行以上） | 用户观察打开耗时、滚动流畖度 | 有量化的基线数据记录当前耗时/帧率，供后续判断是否需要继续优化；本轮至少完成 Phase 2 范围内可确认的优化项（如有) | 插件/Web 用户 | browser + benchmark | EVD-004 |

> UF-004 为性能观测/基线场景，非"点击后立即看到修复效果"的强交互场景，其 2.3 节流程脚本聚焦于"如何执行 profiling 并读出结果"，不适用标准表单提交式的失败分支（已在 2.3 节以适用的失败态替代：夹具缺失、profiling 工具不可用）。

### 2.3 核心业务流程（步骤级交互脚本）

#### UF-001: 控制模式下编辑区域占满可用宽度

**前置状态**：DSH 插件侧栏已打开，用户在文件树中选中一个 `.xlsx` 文件，插件通过 `ControlModeViewer` 以 `control=1&open=path:...` 构造 iframe URL。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 点击侧栏文件树中的 xlsx 文件 | 插件面板显示加载中状态（`previewLoaded=false` 期间的占位) | iframe `src` 设为 `previewUrlFor(path, 'xlsx', true, nonce)` | — |
| 2 | — | — | sheets 页面加载，`CONTROL_MODE=true`，跳过 `<AiChatPanel>` 渲染分支 | — |
| 3 | — | — | `.sheet-body` 改为单列 `minmax(0, 1fr)`，唯一子节点 `.sheet-main` 拿到全部轨道宽度 | — |
| 4 | — | iframe 内容渲染完成 | `#univer-container` 拿到全部可用宽度渲染表格 | 用户看到表格从容器左边缘开始铺满，与 ribbon 宽度一致，无空白死区 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| relay 未启动 | `:8787` 服务未运行 | 插件侧栏走 `relayOk===false` 降级提示（现有逻辑，本次不改） | `probeRelay` 探测失败 | 用户按提示启动 relay 后重试，不属于本次修复范围 |
| 用户手动调整浏览器窗口极窄（<340px） | 容器宽度小于原死区宽度 | 表格区域仍应尽量利用全部宽度（不应比修复前更差），但可能出现表格自身横向滚动 | `minmax(0, 1fr)` 保证列不会为负 | 属于表格引擎自身响应式的已知边界情况，不在本次 BR-001 判定范围内，仅需确认不比修复前更差 |

**界面状态机**：

```text
idle → loading(iframe src 设置) → loaded(CONTROL_MODE 生效, 无 AI 面板) → rendered(表格铺满可用宽度)
```

**入口接线清单**：

- DSH 侧栏 → 文件树点击 xlsx → `packages/tab-genoffice/src/tabs/control-mode.tsx` 的 `ControlModeViewer` → iframe `src=previewUrlFor(...)` → `upstream/apps/sheets` web 构建 → `ExcelShell.tsx` 的 `.sheet-body` 布局。

#### UF-002: 容器宽度变化时表格区域联动伸展（无死区）

**前置状态**：与 UF-001 相同，控制模式已打开 xlsx。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 用户拖动 DSH 侧栏面板宽度（或调整浏览器窗口） | 面板宽度即时跟随拖动 | iframe 容器尺寸变化触发 `ResizeObserver` | — |
| 2 | — | — | Univer 引擎 `resize()` 基于新的容器尺寸重新计算画布 | 表格铺满新的可用宽度，不出现相对固定 360px 的死区 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 拖动过程中中间态闪烁 | 拖动速度过快，`ResizeObserver` 回调有延迟 | 短暂可见表格宽度滞后一帧 | 属于浏览器渲染管线正常延迟，非本次 bug 范围 | 松开鼠标后应立即收敛到正确宽度；若持续偏差才算失败 |
| 面板收窄到小于表格最小可用宽度 | 拖动到极窄 | 出现表格内部横向滚动条 | `minmax(0, 1fr)` 兜底 | 不视为本次 bug，只需确认无 360px 固定死区残留 |

**界面状态机**：

```text
stable(宽度W1) → resizing → stable(宽度W2, 表格铺满W2, 无残留死区)
```

**入口接线清单**：

- 同 UF-001 的入口，额外经过侧栏面板宽度拖拽 handler（DSH betterSidebar 原生能力，本次不改）→ iframe 容器尺寸变化 → sheets `ResizeObserver`。

#### UF-003: 非控制模式（独立 tab）AI 面板收起/展开行为不回归

**前置状态**：用户点击插件"在浏览器中打开"（`previewUrlFor(path, ext, false)`），走独立 tab，非 iframe 嵌入，`CONTROL_MODE=false`。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 打开独立 tab | AI 面板默认展开（`isCopilotOpen` 初始 `true`） | `.sheet-body` 走原有 grid 两列布局 | 左侧 AI 面板 360px + 右侧表格区域 |
| 2 | 点击 AI 面板收起按钮 | 面板收起动画 180ms | `isCopilotOpen=false`，`.app-shell` 加上 `copilot-collapsed` class | 左侧变为 34px 图标条，右侧表格区域相应变宽 |

**失败分支**：

| 分支 | 触发条件 | 界面表现 | 系统行为 | 恢复路径 |
|---|---|---|---|---|
| 修复引入回归：非控制模式下表格区域宽度计算错误 | 若 Task 修复方式误将"控制模式"判断和"用户手动收起"判断耦合出 bug | AI 面板仍显示，但表格区域却按"已收起"计算宽度（或反之） | 需要在实现里保持两个独立布尔条件的正确合取/析取逻辑 | 通过 UF-003 的截图对比测试捕捉，回退到正确的条件表达式 |

**界面状态机**：

```text
(独立tab) idle → copilotOpen=true(默认) ⇄ copilotOpen=false(手动切换)
两态均应与修复前截图一致
```

**入口接线清单**：

- 插件"在浏览器中打开"按钮（`control-mode.tsx` L166-169）→ `window.open(previewUrlFor(path, ext, false), '_blank')` → sheets 独立页面 → `ExcelShell.tsx` 原有 AI 面板逻辑（不受本次修复影响）。

#### UF-004: 性能基线记录与本轮可完成的优化

**前置状态**：本地已启动 web relay + sheets web 构建产物（或 `web:dev`），有可用的大体量 xlsx 测试夹具。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | 执行方（agent/开发者）用 Chrome DevTools 或 Playwright 打开一个大体量 xlsx | 页面显示加载态 | 触发 `web-xlsx.ts` 的 `parseWorksheet` 主线程解析 | Performance 面板记录到主线程长任务（Long Task）耗时数字 |
| 2 | 记录冷启动首包下载/解析耗时 | Network 面板显示 `index-*.js` 下载耗时 | 浏览器解析并执行主 bundle | Network 面板给出具体 KB/ms 数字，形成"冷启动"基线 |
| 3 | 若基线显示某一项（如主线程解析）占比明显最高，且改动成本可控（例如把 `matchAll` 循环移入 Web Worker），在本轮完成该项优化并重新测基线对比 | — | 代码改动 + 重新测量 | before/after 数字对比，写入 `evidence/benchmark/` |

**失败分支（适用替代）**：

| 分支 | 触发条件 | 表现 | 恢复路径 |
|---|---|---|---|
| 无大体量真实 xlsx 夹具 | `fixtures/generated/` 只有小型夹具 | 无法产出有代表性的基线数字 | Task 5 先生成一个大体量合成夹具（如现有 `benchmark-xlsx.ts` 的 `ROW_COUNT=10_000` 思路搬到浏览器解析路径），或提示用户提供真实大文件路径 |
| 无浏览器自动化工具/环境无法起本机浏览器 | CI/无头环境限制 | 无法用 DevTools 交互式测量 | 降级为 Playwright headless + `performance.now()` 埋点脚本方式测量，产出等价的数字化基线 |

**界面状态机**：不适用（本 UF 是度量/优化流程，非用户可见交互状态机；豁免原因：这是开发期性能基线产出流程，面向执行 Agent/开发者，不是终端用户可感知的独立界面状态）。

**入口接线清单**：

- `upstream/apps/sheets` → `npm run web:build -w @genoffice/sheets` 产出 `web-dist/` → `node web/server.mjs` 起 relay → Chrome/Playwright 访问 `http://127.0.0.1:8787/sheets/?open=path:<大文件路径>` 完成度量。

### 2.4 INV 不变量

| 不变量 ID | 内容 | 关联 BR/UF | 验证方式 |
|---|---|---|---|
| INV-001 | 非控制模式下 AI 面板展开/收起的既有行为和视觉效果不得改变 | BR-002, UF-003 | browser：修复前后截图对比 |
| INV-002 | 修复过程不得触碰 `control.ts` 的保存/写回契约（`buildSavePayload`/`notify`），本次范围只涉及布局 CSS/状态判断 | BR-001 | 代码审查：diff 范围检查 |
| INV-003 | 性能优化不得改变 xlsx 打开/编辑/保存后的数据保真度（单元格值、格式、公式结果） | BR-004 | test：`npm run compat` + 抽样对比 |
| INV-004 | docs/slides 两个 app 的布局代码不在本次改动范围内（它们走 flex 布局，未复现此 bug，避免无关改动扩大回归面） | BR-001 | 代码审查：diff 仅限 `apps/sheets/` |

### 2.5 EVD 证据清单

| 证据 ID | 类型 | 期望证据 | 保存位置 |
|---|---|---|---|
| EVD-001 | screenshot | 控制模式下修复前后表格区域宽度对比截图（含容器边框/尺寸标注） | `evidence/UF-001/` |
| EVD-002 | screenshot | 容器宽度变化时表格联动截图（至少两个宽度点） | `evidence/UF-002/` |
| EVD-003 | screenshot | 非控制模式 AI 面板展开/收起两态截图，与修复前对比无差异 | `evidence/UF-003/` |
| EVD-004 | benchmark | 性能基线 before/after 数字表（首包大小、主线程解析耗时、打开总耗时） | `evidence/benchmark/` |
| EVD-005 | log | typecheck/build 命令输出 | `evidence/phase-{N}/` |

### 2.6 角色与权限矩阵

单一角色，无权限差异——本需求面向所有能访问插件侧栏/web 版 GenOffice 的用户，不存在权限分支。

### 2.7 负向 / 破坏性场景

| 场景 | Given | When | Then | Evidence |
|---|---|---|---|---|
| 极窄容器 | 容器宽度 < 340px | 控制模式打开 xlsx | 表格区域仍占满可用宽度（可能出现内部横向滚动），不得比修复前更差 | EVD-001 |
| 大文件在控制模式下打开 | 容器为典型侧栏宽度 + 大体量 xlsx | 打开文件 | 布局修复和性能基线均适用，不应互相干扰（如死区消失后单纯因为可用宽度变大导致渲染更慢是可接受的正常现象，需在 evidence 中区分说明） | EVD-004 |
| 旧数据兼容 | 已保存过的旧 xlsx（此前在死区 bug 存在期间打开过） | 修复后重新打开 | 文件内容不受影响（bug 是纯前端渲染问题，未触碰保存路径） | EVD-005 |

### 2.8 非目标

- 不修复 docs/slides 两个 app（它们的布局机制是 flex，未复现此 bug，暂无证据表明需要同样修复；如后续用户反馈类似问题，应另开一个需求单独勘察）。
- 不在本轮内做"全量"性能优化到某个绝对目标值（如"打开必须 <1s"）；本轮的性能范围是「产出量化基线 + 完成基线中明确可行、低风险的优化项（如主线程解析卸载到 Worker，若可行）」，未完成的优化项转化为后续 Phase 的待办清单，不假装"已经不卡了"。
- 不涉及 `genoffice-dsh-office` 已完成范围之外的其他能力（云端生成、图表/表格桥接等），那部分维持已有的 `bridge-missing`/`cloud-only` 状态，不在本需求范围。
- 不改变 xlsx 保存/写回的契约和 docId 计算方式（`control.ts` 相关逻辑），仅涉及渲染层布局和解析/渲染性能。
- 不修复 `body { min-width: 900px }`（既有约束：视口 &lt;900px 时仍按 900px 排版并由 `overflow: hidden` 裁切）。本需求只消除已移除 AI 面板留下的 ~360px grid 死区；极窄侧栏裁切若要修，另开需求。

---

## 3. 技术方案

### 3.1 架构 Before / After

```text
Before（布局 bug）:
  插件 iframe (control=1)
    → ExcelShell.tsx
         isCopilotOpen=true (硬编码初值, 不感知 CONTROL_MODE)
         .app-shell 无 copilot-collapsed class
         .sheet-body { grid-template-columns: 360px 1fr }  ← AI 面板 DOM 已被移除但列宽仍保留
         #univer-container 只拿到 (容器宽度 - 360px)

After（修复后，方案 B）:
  插件 iframe (control=1)
    → ExcelShell.tsx
         isCopilotOpen 初值仍为 true（不感知 CONTROL_MODE，避免与手动收起耦合）
         .app-shell 附加 control-mode class
         .sheet-body { grid-template-columns: minmax(0, 1fr) }  ← 单列：唯一子节点 .sheet-main 拿满宽
         #univer-container 拿到全部可用宽度（无 360px 第二列死区）

Before（性能，未知量化基线）:
  浏览器主线程: 下载 9.5MB bundle → 解析执行 → xlsx XML 正则解析(主线程) → Univer 渲染
  "卡顿"仅为主观感受, 无数字支撑, 无法判断优化优先级

After（性能，Phase 2 产出）:
  同一路径每段有量化数字（见 evidence/benchmark/baseline.md）；
  基线表明最大项是 9.54MB 主包 parse/eval，不是 web-xlsx matchAll；
  本轮判定暂不做 Worker / 拆包（decision.md）；不假装已经不卡
```

### 3.2 模块改造

| 模块 | 职责 | 改造说明 |
|---|---|---|
| `upstream/apps/sheets/src/renderer/ExcelShell.tsx` | AI 面板开合状态 + 顶层 class 计算 | **已落地方案 B**：`CONTROL_MODE` 时 `.app-shell` 附加 `control-mode` class；`isCopilotOpen` 初值保持 `true`，不与手动收起耦合 |
| `upstream/apps/sheets/src/renderer/styles.css` | `.sheet-body` grid 列宽规则 | **已落地**：`.app-shell.control-mode .sheet-body { grid-template-columns: minmax(0, 1fr); }`（单列；spec 初稿里的 `0 1fr` 两列写法会把唯一子节点塞进 0 宽第一列，已校正） |
| `upstream/apps/sheets/src/renderer/web-xlsx.ts` | xlsx worksheet 解析 | Phase 2 基线显示这不是主要瓶颈，**本轮未改** |
| `upstream/apps/sheets/scripts/` | 基准测试脚本 | 新增一个面向浏览器解析路径的基准脚本或 Playwright 测量脚本，产出可复现的 before/after 数字 |

### 3.3 三段式定位清单

| 文件 | 稳定定位 | 搜索定位 | 行号 hint | 备注 |
|---|---|---|---|---|
| `upstream/apps/sheets/src/renderer/ExcelShell.tsx` | `const [isCopilotOpen, setIsCopilotOpen] = useState(true)` | `rg -n "isCopilotOpen" upstream/apps/sheets/src/renderer/ExcelShell.tsx` | L273（初值）、L319（class 表达式）、L415/424（AiChatPanel props）、L2081（ribbon 按钮） | 行号漂移时以 `isCopilotOpen` symbol 为准 |
| `upstream/apps/sheets/src/renderer/ExcelShell.tsx` | `import { CONTROL_MODE } from './control-flags'` | `rg -n "CONTROL_MODE" upstream/apps/sheets/src/renderer/ExcelShell.tsx` | L16（import）、L319（`control-mode` class）、L422（AiChatPanel 条件渲染）、L2077（ribbon AI 分组条件渲染） | 布局修复只依赖 flags，不 import 完整 `control.ts` 适配器 |
| `upstream/apps/sheets/src/renderer/control-flags.ts` | `export const CONTROL_MODE = params.get('control') === '1'` | `rg -n "CONTROL_MODE" upstream/apps/sheets/src/renderer/control-flags.ts` | L12 | 单次读取 URL 参数，模块加载时确定，运行期不变 |
| `upstream/apps/sheets/src/renderer/control.ts` | `export { CONTROL_MODE, CONTROL_PATH } from './control-flags'` | `rg -n "CONTROL_MODE" upstream/apps/sheets/src/renderer/control.ts` | 再导出 | SSE/保存适配器；本需求不改其 `buildSavePayload`/`notify`（INV-002）；适配器本身仍属 web 移植 WIP，不随本需求入库 |
| `upstream/apps/sheets/src/renderer/styles.css` | `.sheet-body { grid-template-columns: var(--copilot-width, 360px) minmax(0, 1fr); }` | `rg -n "sheet-body" upstream/apps/sheets/src/renderer/styles.css` | L1360-1364 | — |
| `upstream/apps/sheets/src/renderer/styles.css` | `.app-shell.copilot-collapsed .sheet-body { grid-template-columns: 34px minmax(0, 1fr); }` | `rg -n "copilot-collapsed" upstream/apps/sheets/src/renderer/styles.css` | L1445-1447 | 现有的"手动收起"补偿规则，作为修复参考模板 |
| `upstream/apps/sheets/src/renderer/web-xlsx.ts` | `const cellPattern = /<c\b([^>]*?)(?:\/>\|>([\s\S]*?)<\/c>)/g` | `rg -n "cellPattern\|matchAll" upstream/apps/sheets/src/renderer/web-xlsx.ts` | L368起，另有 9 处 matchAll（L235/253/256/259/262/321/353/384/428/451/613/619） | 性能 Phase 若要做 Worker 卸载，需要处理这整批调用 |
| `upstream/apps/sheets/src/renderer/web-bridge.ts` | `recalcWorkbook: async (_request): Promise<WorkbookRecalcResult> => { ... return { cells: [] } }` | `rg -n "recalcWorkbook" upstream/apps/sheets/src/renderer/web-bridge.ts` | L249-253 | 仅记录为已知架构限制，本次不改（不在 2.8 非目标之外的范围内） |
| `packages/tab-genoffice/src/tabs/relay.ts`（当前插件仓库） | `export function previewUrlFor(path, ext, control, nonce)` | `rg -n "previewUrlFor" packages/tab-genoffice/src/tabs/relay.ts` | L71-76 | 确认 `control=1` 触发路径，本文件不改 |

### 3.4 API / 数据 / 权限 / 路由影响

| 类型 | 是否影响 | 说明 | 兼容策略 |
|---|---|---|---|
| API | 否 | 不改 relay/control 契约 | — |
| 数据 | 否（布局）/需验证（性能） | 布局改动纯 CSS/状态层；性能改动若涉及 Worker 化解析，需保证解析结果与原实现字节级一致 | INV-003 用 `npm run compat` 校验 |
| 权限 | 否 | 无权限差异 | — |
| 路由 | 否 | 不改变 URL 参数结构 | — |

---

## 4. Phase 计划与任务详情

> Phase 依赖链：

```text
P0(基线与复现) → P1(布局修复) → P2(性能基线与优化) → P3(端到端验收)
```

> 任务状态跟踪：本需求任务数 = 13（≥ 8），使用同目录 `tasks.csv`。全部「已完成」。
> 任务标题格式 `### Task {N}: {标题}`，N 与 CSV 序号一致。

### Phase 0: 基线与复现

> 你在哪里：只有前序调研的结论，尚未在真实运行的 web 版上复现过布局截断和性能问题。
> 做完之后：有截图/数据形式的复现证据，且确认 Phase 1/2 的改动范围边界。

### Task 1: 启动本地 web 版并复现布局截断问题

- **关联**：BR-001, UF-001, INV-001（非用户可见步骤，UF 关联见 Task 详情）
- **前置任务**：无
- **风险等级**：P0

**为什么做**：修复前必须先在真实运行的应用上复现问题，确认根因假设正确，避免"看代码猜测就动手改"。

**涉及文件与定位**：

- `upstream/apps/sheets`：`npm run web:build -w @genoffice/sheets`
- `/Users/nothing/workspace/dsh/genoffice/scripts/dev.mjs`：`node scripts/dev.mjs start-relay`

**具体操作**：

1. 在 `upstream/` 执行 `npm run web:build -w @genoffice/sheets`，确认构建成功。
2. 执行 `node /Users/nothing/workspace/dsh/genoffice/scripts/dev.mjs start-relay` 拉起 relay（`:8787`）。
3. 用浏览器访问 `http://127.0.0.1:8787/sheets/?control=1&open=path:<一个测试xlsx绝对路径>`，并把浏览器窗口/DevTools 设备模拟调整到 700-900px 宽度模拟插件侧栏容器。
4. 截图记录当前的死区现象（表格区域偏左半部分，右侧或左侧有空白）。
5. 同一文件不带 `control=1` 打开一次，截图作为对照（AI 面板正常显示，表格区域正常）。

**验证**：截图能清晰看到 `control=1` 下表格区域宽度明显小于容器宽度，且死区宽度接近 360px → 复现成功

**Evidence**：`evidence/phase-0/repro-control-mode.png`、`evidence/phase-0/repro-non-control.png`

**注意事项**：易错点是用全屏窗口测试看不出问题（前序调研已发现全屏下死区占比小、不明显）；禁止只用默认全屏窗口截图就得出"复现失败"的结论。

### Task 2: 确认修复实现方式并记录设计决策

- **关联**：BR-001, BR-002, INV-001
- **前置任务**：1
- **风险等级**：P0

**为什么做**：有两种可行修复方向——(a) 让 `isCopilotOpen` 初值/effect 感知 `CONTROL_MODE`；(b) 直接在 CSS 上新增一条基于 `CONTROL_MODE` 产生的 class 的选择器。需要在动手改代码前明确选哪种，避免和"用户手动收起"状态耦合出新 bug（对应 1.4 节及 UF-003 失败分支的回归风险）。

**涉及文件与定位**：

- `upstream/apps/sheets/src/renderer/ExcelShell.tsx`：`isCopilotOpen`，`rg -n "isCopilotOpen" upstream/apps/sheets/src/renderer/ExcelShell.tsx`，L273/319/415/424/2081
- `upstream/apps/sheets/src/renderer/styles.css`：`.copilot-collapsed`，`rg -n "copilot-collapsed" upstream/apps/sheets/src/renderer/styles.css`，L1445-1447

**具体操作**：

1. 评估方案 A：把 `useState(true)` 的初值改为 `useState(!CONTROL_MODE)`（简单，但要确认 `CONTROL_MODE` 在组件渲染前已确定，且不影响非控制模式下的默认展开行为——`CONTROL_MODE=false` 时 `!false=true`，行为不变）。
2. 评估方案 B：新增一个独立的 CSS 选择器（例如给 `.app-shell` 增加一个 `control-mode` class，选择器 `.app-shell.control-mode .sheet-body { grid-template-columns: 0 minmax(0,1fr); }`），与 `copilot-collapsed` 独立存在，互不干扰。
3. **选定方案 B（单列校正），否决方案 A**。Playwright 实测控制模式下 `.sheet-body` 只有 `.sheet-main` 一个子节点，被 CSS Grid 自动放入第一列。方案 A 套用 `.copilot-collapsed` 的 `34px 1fr` 会把表格压进 34px 轨道，比现状更差。方案 B 示例里的 `0 minmax(0,1fr)` 仍是两列，唯一子节点会进 0 宽第一列，同样不行；校正为单列 `minmax(0, 1fr)`。理由见 `evidence/phase-0/design-decision.md`。
4. UF-003 推理：方案 B 不改 `isCopilotOpen` 初值/切换；`control-mode` 选择器不匹配非控制模式，默认展开 / 收起 / 再展开与修复前一致。

**验证**：设计决策有文字记录（本任务的操作 3/4），且经过口头/文档推理确认不影响 UF-003 → 通过

**Evidence**：`evidence/phase-0/design-decision.md`

**注意事项**：禁止不比较两种方案就直接动手改；禁止选定方案后不推理对 UF-003 的影响。

### Task 3: 执行 Phase 0 回归验证

- **关联**：本 Phase 全部内容（复现 + 设计决策）
- **前置任务**：1;2

**验证**：确认 `evidence/phase-0/` 下已有复现截图和设计决策文档，且团队/执行者对 Phase 1 的改动范围有清晰认识

**Evidence**：`evidence/phase-0/`

---

### Phase 1: 布局修复

> 你在哪里：已确认根因和修复方案（Phase 0）。
> 做完之后：控制模式下表格区域占满可用宽度，非控制模式行为无回归，有截图证据。

### Task 4: 实现 `isCopilotOpen`/class 的控制模式感知修复

- **关联**：BR-001, BR-002, INV-001, INV-002
- **前置任务**：3
- **风险等级**：P0

**为什么做**：这是本需求的核心修复——让 Task 2 选定的方案落地为代码改动。

**涉及文件与定位**：

- `upstream/apps/sheets/src/renderer/ExcelShell.tsx`：`.app-shell` class 表达式，`rg -n "app-shell" upstream/apps/sheets/src/renderer/ExcelShell.tsx`
- `upstream/apps/sheets/src/renderer/styles.css`：`.copilot-collapsed` 旁新增 `control-mode` 规则，`rg -n "control-mode" upstream/apps/sheets/src/renderer/styles.css`

**具体操作**（按 Task 2 选定的方案 B 落地，不是方案 A）：

1. `.app-shell` 的 class 在 `CONTROL_MODE` 为真时附加 `control-mode`：`` `app-shell ${isCopilotOpen ? '' : 'copilot-collapsed'}${CONTROL_MODE ? ' control-mode' : ''}` ``。
2. 新增 `.app-shell.control-mode .sheet-body { grid-template-columns: minmax(0, 1fr); }`。不改 `.copilot-collapsed` 既有 `34px 1fr`。
3. **不改** `useState(true)`。`CONTROL_MODE` 从 `./control-flags` import（不依赖完整 `control.ts` 适配器入库）。
4. 检查 ribbon AI 入口已有 `{!CONTROL_MODE && (...)}` 包裹，控制模式下按钮不显示。
5. 本地跑 `npm run web:build -w @genoffice/sheets` 确认构建通过。

**验证**：`npm run typecheck -w @genoffice/sheets` → 通过；`npm run web:build -w @genoffice/sheets` → 构建成功

**Evidence**：`evidence/phase-1/typecheck.log`、`evidence/phase-1/build.log`

**注意事项**：禁止同时改 state 初值又改 CSS（不得混用方案 A/B）；只走方案 B。

### Task 5: 真实场景验证控制模式下表格铺满宽度（UF-001/UF-002）

- **关联**：UF-001, UF-002, EVD-001, EVD-002
- **前置任务**：4
- **风险等级**：P0

**为什么做**：命令级验证（typecheck/build）通过不代表用户能看到修复效果，必须在真实浏览器里回放。

**涉及文件与定位**：

- 无新增代码文件，验证对象是 Task 4 的构建产物

**具体操作**：

1. 重新执行 `npm run web:build -w @genoffice/sheets`（若 Task 4 已做可跳过重复构建）。
2. 用浏览器访问 `http://127.0.0.1:8787/sheets/?control=1&open=path:<同 Task 1 的测试文件>`，窗口宽度设为 700-900px。
3. 截图，测量 `#univer-container` 实际渲染宽度是否 ≈ 容器宽度（允许 ribbon/状态栏之外的正常 padding 误差）。
4. 拖动/调整浏览器窗口宽度到另一个数值（如 500px），再截图一次，确认表格区域联动伸展（UF-002）。
5. 检查 console 面板无新增 error。

**验证**：两个宽度点下表格区域均铺满容器（无 360px 固定死区），console 无 error → 通过

**Evidence**：`evidence/UF-001/success-700px.png`、`evidence/UF-001/success-900px.png`、`evidence/UF-002/resize-500px.png`

**注意事项**：不得只测一个宽度就下结论；必须与 Task 1 的复现截图做直接对比说明"修复前 vs 修复后"。

### Task 6: 真实场景验证非控制模式无回归（UF-003）

- **关联**：UF-003, INV-001, EVD-003
- **前置任务**：4
- **风险等级**：P0

**为什么做**：修复必须不破坏现有独立 tab 打开时的 AI 面板行为，这是 INV-001 的直接验证。

**涉及文件与定位**：

- 无新增代码文件

**具体操作**：

1. 浏览器���问 `http://127.0.0.1:8787/sheets/?open=path:<同一测试文件>`（不带 `control=1`）。
2. 确认页面加载后 AI 面板默认展开（左侧 360px 面板可见），截图。
3. 点击 AI 面板收起按钮，确认收起动画正常、表格区域相应变宽，截图。
4. 再次点击展开，确认恢复，截图。
5. 与 Task 1 的"非控制模式对照截图"做逐项对比，确认无视觉差异。

**验证**：AI 面板默认展开/收起/展开三态截图与修复前一致 → 通过

**Evidence**：`evidence/UF-003/default-open.png`、`evidence/UF-003/collapsed.png`、`evidence/UF-003/expanded-again.png`

**注意事项**：如发现任何视觉差异（哪怕很细微），必须记录并追溯是否 Task 4 的改动范围过大导致，不得忽略视觉差异直接判定通过。

### Task 7: 执行 Phase 1 回归验证

- **关联**：本 Phase 全部 BR/UF（BR-001, BR-002, UF-001, UF-002, UF-003）
- **前置任务**：4;5;6

**验证**：`npm run typecheck -w @genoffice/sheets` 通过 + UF-001/002/003 三组 evidence 齐全且结论一致（修复生效、无回归）

**Evidence**：`evidence/phase-1/`

---

### Phase 2: 性能基线与优化

> 你在哪里：布局问题已修复（Phase 1）。性能问题目前只有定性分析，没有量化数字。
> 做完之后：有可复现的 before/after 性能数字；至少完成一项数字支持、风险可控的优化，或明确记录"本轮暂不做，原因是XX"。

### Task 8: 准备大体量 xlsx 性能测试夹具

- **关联**：UF-004（失败分支：无大体量夹具）
- **前置任务**：7
- **风险等级**：P1

**为什么做**：现有 `fixtures/generated/*.xlsx` 都是小型 compatibility 夹具，无法代表用户反馈的"大文件卡顿"场景，必须先有代表性的测试数据。

**涉及文件与定位**：

- `upstream/apps/sheets/scripts/benchmark-xlsx.ts`：`buildLargeFixture`，`rg -n "buildLargeFixture\|ROW_COUNT" upstream/apps/sheets/scripts/benchmark-xlsx.ts`，L9-10（`ROW_COUNT = 10_000`）附近，作为生成大文件的参考思路

**具体操作**：

1. 复用或改写 `benchmark-xlsx.ts` 里生成合成夹具的逻辑（`buildLargeFixture`/`buildCompatibilityFixture`），输出一个真实可打开的 `.xlsx` 文件（而不仅是内存 buffer），落盘到 `evidence/benchmark/fixtures/large-10k-rows.xlsx`。
2. 如果时间/条件允许，额外准备一个更大规模（如 5 万行）的夹具用于压力测试；如果生成困难，记录为 `待勘察` 并只用一个规模的夹具继续。
3. 确认该文件能被 `web:dev`/`web-dist` 正常打开（跑一次 Task 1 类似的手动打开验证）。

**验证**：生成的 `.xlsx` 文件能在浏览器 web 版正常打开且能看到数据 → 通过

**Evidence**：`evidence/benchmark/fixtures/large-10k-rows.xlsx`（文件本身即证据）、`evidence/benchmark/fixture-open-check.png`

**注意事项**：不得用极小夹具（几十行）冒充"大体量"测试；如果生成大文件遇到阻塞，必须明确记录阻塞原因并标记任务为已阻塞，不得跳过直接编造性能数字。

### Task 9: 采集性能基线（冷启动/打开耗时/主线程阻塞）

- **关联**：UF-004, BR-003, EVD-004
- **前置任务**：8
- **风险等级**：P1

**为什么做**：这是 BR-003 的直接要求——先有数字再决定优化什么，不能凭感觉改代码。

**涉及文件与定位**：

- Chrome DevTools（Network + Performance 面板），或 Playwright headless + `performance.now()` 埋点脚本（无可用交互式浏览器时的降级方式）

**具体操作**：

1. 用 Chrome DevTools 打开 `http://127.0.0.1:8787/sheets/?open=path:<Task 8 生成的大文件>`，Network 面板记录：主 bundle（`index-*.js`）下载耗时、总传输字节数；清缓存后的冷启动首屏耗时。
2. Performance 面板录制一次"点击打开到表格渲染完成"的过程，记录：最长的单个 Long Task 耗时、Long Task 是否与 `parseWorksheet`/`matchAll` 调用栈相关（在 Performance 面板的调用栈里查看）。
3. 滚动表格若干屏，记录 FPS/是否有明显掉帧（DevTools Performance 面板的 FPS 图表）。
4. 把以上数字整理成表格，写入 `evidence/benchmark/baseline.md`。
5. 如果 DevTools 交互环境不可用，改用 Playwright headless 脚本：在页面注入 `performance.now()` 埋点（打开开始/表格首次可交互），跑 3 次取中位数，同样产出耗时数字。

**验证**：`evidence/benchmark/baseline.md` 存在且包含至少「冷启动首包耗时」「打开到渲染完成耗时」「最长 Long Task 耗时及其调用栈归属」三项数字 → 通过

**Evidence**：`evidence/benchmark/baseline.md`、`evidence/benchmark/performance-trace.json`（如 DevTools 支持导出）

**注意事项**：禁止编造数字；如果某一项确实测不出来（比如调用栈符号缺失导致看不清 Long Task 归属），如实标注"待勘察"而不是猜一个归因。

### Task 10: 基于基线选定并实现一项可行的优化（或明确记录暂不做）

- **关联**：UF-004, BR-003, BR-004, INV-003
- **前置任务**：9
- **风险等级**：P1

**为什么做**：把基线数字转化为实际行动——如果数字支持某个改动收益明显且风险可控，就做；否则如实说明留给下一轮。

**涉及文件与定位**：

- `upstream/apps/sheets/src/renderer/web-xlsx.ts`：如果 Task 9 显示主线程解析是最大瓶颈，`rg -n "cellPattern\|matchAll" upstream/apps/sheets/src/renderer/web-xlsx.ts`，L235-619 各处 `matchAll` 调用是候选改动点（例如整体搬进 Web Worker，保持输入输出契约不变）

**具体操作**：

1. 依据 Task 9 基线数字排出优先级（最耗时的一项排第一）。
2. 若第一项是"主线程 xlsx 解析"且评估后风险可控（不改变解析算法只改变执行线程），实现 Worker 化：新增一个 worker 模块封装现有 `parseWorksheet` 等函数，`web-bridge.ts` 里改为 `postMessage` 调用 worker 并等待结果，保持对外接口签名不变。
3. 若评估后发现改动成本/风险超出本轮范围（例如需要重构整个 `web-xlsx.ts` 的同步调用链），则不动代码，只在 `evidence/benchmark/decision.md` 里写清楚："本轮暂不做 Worker 化，原因是 XXX，建议后续单独排期，预期收益是 YYY"。
4. 若做了改动，重新执行 Task 9 同样的测量步骤，产出 after 数字，与 before 对比。
5. 跑 `npm run compat -w @genoffice/sheets`（若涉及解析逻辑改动）确认数据保真度未受影响（INV-003）。

**验证**：若有改动：`npm run compat -w @genoffice/sheets` 通过 + before/after 数字对比显示改进；若无改动：`decision.md` 有清晰的理由和后续建议 → 通过

**Evidence**：`evidence/benchmark/before-after.md`（若有改动）或 `evidence/benchmark/decision.md`（若无改动）

**注意事项**：不得为了"看起来有进展"做一个对基线瓶颈无关的小改动然后宣称"优化完成"；改与不改都必须有数字或明确理由支撑决策，这是 BR-003 的核心要求。

### Task 11: 执行 Phase 2 回归验证

- **关联**：本 Phase 全部 UF/BR（UF-004, BR-003, BR-004, INV-003）
- **前置任务**：8;9;10

**验证**：`evidence/benchmark/` 下有基线文档 + 决策文档（改或不改都有记录）+（若涉及代码改动）`npm run typecheck -w @genoffice/sheets` 与 `npm run compat -w @genoffice/sheets` 通过

**Evidence**：`evidence/phase-2/`

---

### Phase 3: 端到端验收

> 你在哪里：布局已修复并验证，性能已有基线和（若可行）首轮优化。
> 做完之后：全部用户可见 UF 的真实场景测试跑完，5.4 检查清单自检通过，校验脚本 0 FAIL。

### Task 12: 执行 spec 5.2 真实场景全套测试

- **关联**：全部用户可见 UF（UF-001, UF-002, UF-003, UF-004）
- **前置任务**：7;11

**为什么做**：这是完成的唯一标准——单测/typecheck 通过不算完成，必须把 2.3 节全部流程脚本在真实运行的应用上走一遍。

**涉及文件与定位**：无新增代码文件，验证对象是前序全部改动的最终状态。

**具体操作**：按 5.2 节执行矩阵逐行回放（见下），全部通过后再进行 Task 13。

**验证**：按 5.2 执行矩阵逐行回放，全部通过

**Evidence**：`evidence/UF-001/`、`evidence/UF-002/`、`evidence/UF-003/`、`evidence/UF-004/`（Phase 1/2 中已产出的证据在此汇总核对，缺失的补充）

### Task 13: 执行 Phase 3 回归验证

- **关联**：本需求全部 BR/UF/INV
- **前置任务**：12

**验证**：`npm run typecheck -w @genoffice/sheets` 全绿 + 5.4 节专项检查清单逐条通过 + `python3 {skill_dir}/scripts/validate_package.py {package_dir}` 0 FAIL

**Evidence**：`evidence/phase-3/`

---

## 5. 验收与 Review 协议

> **验收铁律：命令级验证（5.1）通过只是入场券，不是完成。** 用户可见的需求必须通过 5.2 真实场景全套测试才算完成——单元测试全绿但界面点不动 = 未完成。

### 5.1 命令级验证（入场券）

| 验证项 | 命令 | 期望 | Evidence |
|---|---|---|---|
| typecheck | `npm run typecheck -w @genoffice/sheets`（在 `upstream/` 目录执行） | 无类型错误 | EVD-005 |
| web build | `npm run web:build -w @genoffice/sheets` | 构建成功，产出 `web-dist/` | EVD-005 |
| compat（若涉及解析逻辑改动） | `npm run compat -w @genoffice/sheets` | 现有兼容性测试全绿 | EVD-005 |
| gate（可选，全量） | `npm run gate -w @genoffice/sheets` | typecheck + fixtures + test + compat 全绿 | EVD-005 |

### 5.2 真实场景全套测试（Real-Run，完成的唯一标准）

**环境准备**：

| 项 | 值 |
|---|---|
| 启动命令 | `cd upstream && npm run web:build -w @genoffice/sheets && node /Users/nothing/workspace/dsh/genoffice/scripts/dev.mjs start-relay` |
| 访问入口 | `http://127.0.0.1:8787/sheets/?control=1&open=path:<绝对路径>`（控制模式）/ `http://127.0.0.1:8787/sheets/?open=path:<绝对路径>`（非控制模式） |
| 测试账号/数据 | 无需账号；测试数据 = Task 1 使用的常规 xlsx（`fixtures/generated/compatibility-basic.xlsx` 或等价文件）+ Task 8 生成的大体量夹具 |
| 干净状态定义 | 每次测试前刷新页面（`about:blank` → 重新设置 `src`），避免上一次打开的状态残留；性能测量清浏览器缓存后再测冷启动 |
| 可用测试工具 | Chrome DevTools（本机已装浏览器，手动操作）；Playwright 1.62.1 + 已安装的 Chromium（`~/Library/Caches/ms-playwright`）可用于脚本化测量，但当前 `e2e/playwright.config.ts` 是面向 Electron 桌面壳的配置，若要用 Playwright 需另写一个指向 `http://127.0.0.1:8787` 的独立测试脚本，不与现有 e2e 套件混用 |

**执行矩阵**：

| UF | 执行方式 | 操作来源 | 必须核对的点 | Evidence |
|---|---|---|---|---|
| UF-001 主路径 | browser | 2.3 节 UF-001 成功主路径逐步执行 | 表格区域宽度 ≈ 容器宽度，无 360px 死区；console 无新增 error | `evidence/UF-001/success-700px.png` + console 截图 |
| UF-002 主路径 | browser | 2.3 节 UF-002 成功主路径逐步执行 | 至少两个不同容器宽度下表格联动伸展，无死区 | `evidence/UF-002/resize-500px.png` + `success-900px.png` |
| UF-003 主路径 | browser | 2.3 节 UF-003 成功主路径逐步执行 | AI 面板默认展开/收起/再展开三态与修复前一致 | `evidence/UF-003/default-open.png` + `collapsed.png` + `expanded-again.png` |
| UF-003 失败分支（修复引入回归） | browser | 逐项比对修复前后截图 | 无任何视觉差异；若有差异则本轮未完成 | 同上，附对比说明 |
| UF-004 主路径 | browser/Playwright | 2.3 节 UF-004 成功主路径逐步执行 | 有量化基线数字；若做了优化，有 before/after 对比 | `evidence/benchmark/baseline.md` + `before-after.md` 或 `decision.md` |
| UF-004 失败分支（无大体量夹具） | manual | Task 8 记录 | 若确实无法生成，需有清晰的阻塞记录而非跳过 | `evidence/benchmark/fixture-open-check.png` |

**通过标准**：执行矩阵全部行通过且 evidence 齐全。任何一行失败 = 本需求未完成，回到对应任务修复后重跑。

### 5.3 Evidence 目录结构与命名

```text
evidence/
  phase-0/
    repro-control-mode.png
    repro-non-control.png
    design-decision.md
  phase-1/
    typecheck.log
    build.log
  phase-2/
    (聚合性 summary，具体产物在 benchmark/ 下)
  phase-3/
    (最终回归 summary)
  UF-001/
    success-700px.png
    success-900px.png
  UF-002/
    resize-500px.png
  UF-003/
    default-open.png
    collapsed.png
    expanded-again.png
  benchmark/
    fixtures/
      large-10k-rows.xlsx
    fixture-open-check.png
    baseline.md
    before-after.md 或 decision.md
    performance-trace.json
```

### 5.4 Review 专项检查清单

执行核销见 `evidence/phase-3/checklist-5.4.md`。本表与之一致：

- [x] `ExcelShell.tsx` 只落地 Task 2 选定的方案 B（`control-mode` class + 单列 grid），未改 `isCopilotOpen` 初值，未混用方案 A
- [x] UF-003 的三态截图与修复前逐项比对，确认零差异（默认 360+540 / 收起 34+866 / 再展开还原）
- [x] Task 10 未改 `web-xlsx.ts`，无需 `compat`
- [x] Task 10 判定「暂不做」，`evidence/benchmark/decision.md` 写明：最大瓶颈是 9.54MB 主包 parse/eval，Worker 化解析收益为噪声级
- [x] 5.2 执行矩阵全部通过，evidence 齐全且与第 2.5 节 EVD 清单一致（`validate_package.py` 0 FAIL）
- [x] 2.3 节每条流程的「入口接线清单」已实现——真实 URL `http://127.0.0.1:8787/sheets/?control=1&open=path:...` 可达
- [x] 界面交互与 2.3 节脚本逐步一致（loading、resize leftover=0、AI 面板收起/展开动效存在）
- [x] 所有 BR/UF/INV 状态可对照第 2 章逐条核销
