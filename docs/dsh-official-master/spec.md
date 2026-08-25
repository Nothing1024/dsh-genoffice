# dsh-official-master Spec

> Version: 0.1.0 | Date: 2026-08-18 | Status: Ready 可执行
>
> 本文件是**总包**唯一事实源：把尚未收口的正式化工作收成一条可执行链。
> 子包 `plugin/session-tool/plugin/docs/session-marks/spec.md` 仍是种类位的细则；本文件只引用 ID，不复制其子表。
>
> 三态：验证过的事实 / `ASM-xxx` / `待勘察`。禁止编造命令、symbol、文件名。

---

## 1. 事实基线与假设

### 1.1 需求与运行模式

| 项 | 结论 |
|---|---|
| 原始需求 | 其他线也规划并一口气做完：session-marks 实现 + genoffice `*_open`/SSE 移植 + 三仓 rc.7 收口 + vibee 只接 `kind:vibee` 查询契约。后期完整 Web 页不在本包做完，但 marks 查询必须可被 vibee import。 |
| 输入类型 | 对话上下文 + 已有 session-marks 子包 |
| Mode | oneclick（总包） |
| 置信度 | 高 |
| 输出目录 | `genoffice/docs/dsh-official-master/` |

### 1.2 任务类型路由

| 维度 | 结论 |
|---|---|
| 任务类型 | refactor + backend + frontend（genoffice tab/SSE）+ infra（commit） |
| 主要风险 | ① session-marks 与 rc.7 脏树交织；② stash 整包 apply 会带回 vendor/file:；③ vibee 与 origin 分叉 force-push；④ 一次 workflow 超时 |
| 行号策略 | symbol + rg |
| 必需验收 | session-tool CLI 真跑（子包 5.2）+ genoffice unit + `node scripts/dev.mjs smoke` |
| 必须覆盖 | UF-001 marks 真写；UF-002 双闸；UF-003 open 工具；UF-004 SSE/relay；UF-005 vibee 能打/读 kind:vibee |

### 1.3 勘察事实清单

| 事实 | 来源命令 | 输出摘要 |
|---|---|---|
| session-marks 子包已在且校验过 | `ls plugin/session-tool/plugin/docs/session-marks` | spec/tasks/handoff/evidence |
| session-tool 超 origin 1（docs commit）且大量 rc.7 未提交 | `git -C session-tool/plugin status -sb` | ahead 1 + M env/packages |
| genoffice 插件 stash `wip/local-open-sse` | `git stash list` | stash@{0} |
| stash 含 tools/client/relay/genoffice.tsx 及旧 lock | `git stash show --stat` | 19 files，lock 大头 |
| 当前树无 createOpenTools；RELAY_BASE 在 tools.ts L15 | `rg createOpenTools\|RELAY_BASE tab-genoffice/src/host/tools.ts` | 无 open 工具 |
| PREVIEWABLE 在 `relay.ts` L9 | `rg PREVIEWABLE src/tabs/relay.ts` | 存在 |
| genoffice 已有 `plugin/env/{boot,setup}.sh` | `ls plugin/env` | 4 项 |
| genoffice 栈 relay :8787 | `curl /api/health` | 200 |
| 栈脚本已改 :3080 与 plugin 路径 | `rg DSH_URL\|pluginRoot genoffice/scripts/dev.mjs` | 3080 + dsh-genoffice |
| vibee ahead 2 behind 1，coverage 删除脏 | `git -C vibee/plugin status -sb` | 不可 force-push |
| store / test-Nothing1024 / better-sidebar clone 已删 | `ls ~/workspace/dsh/plugin` | 仅三插件 |
| better-sidebar npm 0.13 已是 genoffice 依赖 | `rg dsh-better-sidebar tab-genoffice/package.json` | 0.13.0 |
| 子包 UF/BR 定义处 | 读 session-marks/spec.md 第 2 章 | 子包第 2 章全表 |

### 1.4 假设清单

| 假设 ID | 内容 | 风险 | 确认方式 |
|---|---|---|---|
| ASM-M01 | 总包执行时**先做 session-marks 再做 vibee 接线** | 低 | Phase 顺序 |
| ASM-M02 | stash 只允许移植 **src + 对应 tests**，禁止套回 vendor `file:` lock | 高 | review diff |
| ASM-M03 | `POST /api/open` 与 `/api/open/stream` 仍在 `upstream/web/server.mjs` | 中 | P2 `rg` 确认，否则待勘察补 |
| ASM-M04 | vibee 本包只打/读 kind，不画新 sidebar tab | 低 | INV-M03 |
| ASM-M05 | 三仓可本地 commit，**不 push**（vibee 分叉） | 低 | Task 收口 |
| ASM-M06 | session-marks 细则以子 spec 为准，总包任务「执行子包」即可 | 低 | 子包已 0 FAIL |

### 1.5 质量记录

- `validate_package.py`（2026-08-18）：**0 FAIL / 0 WARN / 13 PASS**。

---

## 2. 业务合同

### 2.1 BR 业务规则

| 规则 ID | 规则 | 正例 | 反例 | 影响范围 | 验证方式 |
|---|---|---|---|---|---|
| BR-M01 | 种类位实现必须满足子包第 2 章全部业务规则（不在本表展开） | marks.jsonl 真写 | 再挂 vendor | session-tool | 子包 5.1/5.2 |
| BR-M02 | genoffice 提供 `docx_open`/`markdown_open`/`xlsx_open`/`pptx_open`（或现树命名 `*_open`），经 relay `POST /api/open`，不经 control plane | 工具调通打开 | 只改 stash 未接线 | tab-genoffice host | unit + smoke |
| BR-M03 | client 在 tab 未开时也能收 relay `EventSource(/api/open/stream)` 并打开预览 | 后开 tab 仍收到 | 只在 Panel mount 才连 | client + relay.ts | unit/integration |
| BR-M04 | 移植不得恢复 `vendor/dsh` 或 `file:` 平台依赖 | package.json 仍 npm rc.7 + sidebar 0.13 | stash 整包 apply | genoffice plugin | rg file: |
| BR-M05 | `node scripts/dev.mjs smoke` 保持全绿 | PASS | 再指 dsh-artifact | 栈脚本 | smoke |
| BR-M06 | vibee 创建/登记工作流会话时写入 `kind:vibee`（经 session-marks 或 session-tool create tags） | marks.get 含 kind:vibee | 只改注释 | vibee-host | unit |
| BR-M07 | 三插件 rc.7 钉与本包功能可分别 commit；禁止 `push --force` origin | 本地 commit | force 丢掉 b644b7e | git | log |

子包规则只在 session-marks/spec 第 2 章定义，本总包用 BR-M01 概括。

### 2.2 UF 用户验收场景（索引）

| 场景 ID | Given | When | Then | 角色 | 验证方式 | Evidence |
|---|---|---|---|---|---|---|
| UF-001 | session-tool env 可 boot | 按子包 UF-001～008 跑 CLI | 子包 5.2 矩阵全过 | 人/CLI | CLI | 子 EVD + `evidence/UF-001/` 索引 |
| UF-002 | 默认 list 有 ~ 与 kind:hidden | 默认 list | 双闸生效 | 人/CLI | CLI | 子 UF-002 |
| UF-003 | relay :8787 UP，插件已 build | 调 `pptx_open`/`docx_open`（以源码工具名为准）path 为存在的本地文件 | relay 收 POST /api/open；不报 control 缺 docId | 人/agent | unit+curl | EVD-M03 |
| UF-004 | relay UP | `node scripts/dev.mjs smoke` | 全 PASS | 开发者 | CLI | EVD-M04 |
| UF-005 | session-marks 已落地 | vibee 代码路径在「开跑/建会话」处写入 kind:vibee | listByKind 能取到 | 开发者 | unit | EVD-M05 |

### 2.3 核心业务流程

#### UF-001: 种类位 CLI（执行子包）

**前置**：子包 spec 5.2 环境准备。

**成功主路径**：逐步执行子包 2.3 的 UF-001～008 主路径（本处不复制表格）。

**失败分支**：子包 2.3 各失败分支；外加「子包测试因 rc.7 脏树失败」→ 先不 revert 脏树，在其上叠加 marks。

**界面状态机**：见子包。

**入口接线**：`dsh-session` / `session_*` 工具 / `docs/session-marks/spec.md` Task 1–16。

#### UF-002: 双闸隐藏

同子包 UF-002 流程脚本（引用，实现任务在「执行子包」）。

**入口接线**：`session_list` 默认过滤。

#### UF-003: 用工具打开本地 Office 文件

**前置**：relay UP；存在 `/tmp/sm-demo.md` 或仓库 fixtures。

**成功主路径**：

| 步骤 | 用户动作 | 界面即时反馈 | 系统行为 | 用户看到的结果 |
|---|---|---|---|---|
| 1 | agent/单测调用 open 工具 + 绝对路径 | 工具卡片 kind=read | POST `{RELAY}/api/open` `{path}` | ok / 已发送打开指令 |
| 2 | — | — | relay SSE `file` 事件 | 订阅方收到 path |
| 3 | 已挂 client | tab 打开预览 | openTab + emitOpenFile | iframe control 预览或列表 |

**失败分支**：

| 分支 | 触发 | 表现 | 系统 | 恢复 |
|---|---|---|---|---|
| 文件不存在 | 坏 path | 工具 error | 不写盘 | 改 path |
| relay 宕 | 8787 down | open failed HTTP | 不崩 host | start-relay |

**状态机**：`idle → posting → opened | error`

**入口接线**：`createOpenTools`（或等价）在 `createControlTools` 返回值中注册；client `EventSource` 在 `src/client/index.ts` apply。

#### UF-004: 栈 smoke

**前置**：`cd ~/workspace/dsh/genoffice`

**成功主路径**：`start-relay` → `status` relay UP → `smoke` 全 PASS。

**失败分支**：plugin 路径错 → smoke 读不到 PREVIEWABLE；upstream 无 web-dist → 先 `npm run web`（仅当必要）。

**状态机**：`relay-up → smoke-pass | smoke-fail`

**入口接线**：`scripts/dev.mjs`

#### UF-005: vibee 打上 kind:vibee

**前置**：session-marks 可 import。

**成功主路径**：

| 步骤 | 用户动作 | 反馈 | 系统 | 结果 |
|---|---|---|---|---|
| 1 | 触发 vibee 建会话/开跑的代码路径（单测或最小 hook） | — | put marks kind:vibee | get(id) 含该 kind |
| 2 | `listByKind('kind:vibee')` | 列表 | 只读表 | 含该 id |

**失败分支**：session-marks 未建 → 编译失败（P1 必须先完）；无 DSH_HOME → 单测注入 tmp home。

**状态机**：`run-start → marked`

**入口接线**：`packages/vibee-host` 开跑/建 session 处；禁止做 sidebar tab。

### 2.4 INV 不变量

| ID | 内容 | 关联 | 验证 |
|---|---|---|---|
| INV-M01 | 不恢复 test-Nothing1024 / vendor/dsh / store | BR-M04 | ls plugin |
| INV-M02 | 不 force-push vibee | BR-M07 | 无 push --force |
| INV-M03 | 本包不 registerTab 新 Special/Workflows 页 | ASM-M04 | diff |
| INV-M04 | 子包第 2.4 节全部不变量仍成立 | BR-M01 | 子 5.1 |
| INV-M05 | genoffice 控制面工具表不因 open 工具被删 | UF-003 | capability 测 |

### 2.5 EVD 证据清单

| ID | 类型 | 期望 | 位置 |
|---|---|---|---|
| EVD-M01 | 子包 evidence 索引 | 子 5.2 已跑或本包复跑摘要 | `evidence/UF-001/` |
| EVD-M02 | CLI | 双闸 | 子 UF-002 或 `evidence/UF-002/` |
| EVD-M03 | test/log | open 工具 + /api/open | `evidence/UF-003/` |
| EVD-M04 | smoke.log | 全 PASS | `evidence/UF-004/smoke.log` |
| EVD-M05 | test | kind:vibee 写入 | `evidence/UF-005/` |
| EVD-M06 | git log | 各仓 commit 说明 | `evidence/phase-4/` |

### 2.6 角色与权限

单一开发者/agent 执行。无多角色。CLI 与工具沿用 session-tool fence。open 工具只打本机 path，无跨用户。

### 2.7 负向

| 场景 | Then | Evidence |
|---|---|---|
| stash 整包 apply | 禁止；只摘 src | INV-M01 |
| relay down 时 open | 工具失败 | UF-003 |
| marks 未完成就改 vibee | 阻塞 P3 | ASM-M01 |
| 空 tag | 见子包非法 tag 流程 | 子包 evidence |

### 2.8 非目标

- 完整 vibee GUI / details 槽补丁 / 官方会话栏徽章
- 发布 npm、向官方提 PR
- 迁移历史 session/tags 日志
- 删除 ppt-plan / blank.pptx（无关）

---

## 3. 技术方案

### 3.1 Before / After

```text
Before: marks 假写；genoffice 无 open/SSE；三仓 rc.7 脏；vibee 不认种类
After:  子包落地；open+SSE 在官方化树上；commits 本地；vibee 开跑打 kind:vibee
```

### 3.2 模块改造

| 模块 | 改造 |
|---|---|
| session-tool 全仓 | 执行子 spec 第 4 章 |
| tab-genoffice src/host/tools.ts | 增加 open 工具族 |
| tab-genoffice src/client + relay + genoffice.tsx | SSE + openTab |
| genoffice scripts/dev.mjs | 保持 smoke |
| vibee-host | 建会话时 marks.put kind:vibee |
| git | 按仓 commit，不 push |

### 3.3 三段式定位

| 文件 | 稳定定位 | 搜索 | hint |
|---|---|---|---|
| session-marks 子 spec | Task 1–16 | `docs/session-marks/spec.md` | — |
| `.../session-tool-local/src/index.ts` | `async create` `tagsOf` | `rg "async create" .../index.ts` | L163 |
| `.../tab-genoffice/src/host/tools.ts` | `createControlTools` `RELAY_BASE` | `rg createControlTools` | 文件上部 |
| `.../tab-genoffice/src/client/index.ts` | `apply` `registerTab` | `rg registerTab` | client |
| `.../tab-genoffice/src/tabs/relay.ts` | `PREVIEWABLE` | `rg PREVIEWABLE` | L9 |
| `genoffice/upstream/web/server.mjs` | `/api/open` | `rg "/api/open"` | ASM-M03 执行时确认 |
| `.../vibee-host/src/index.ts` | 开跑/create session | `rg "create\|session" packages/vibee-host/src` | 待执行时以 rg 为准 |

### 3.4 API / 数据

| 类型 | 影响 | 兼容 |
|---|---|---|
| API | session tags 语义变真写；新 open 工具 | 旧假 tag 调用变为真 |
| 数据 | marks.jsonl | 新文件 |
| 权限 | 无新模型 | — |
| 路由 | 只用已有 /api/open | 不新增官方路由 |

---

## 4. Phase 计划与任务详情

```text
P0 总基线 → P1 执行 session-marks 子包 → P2 genoffice open/SSE
  → P3 vibee kind:vibee → P4 本地 commit 收口 → P5 总 5.2
```

### Phase 0: 总基线

### Task 1: 记录三仓与栈基线

- **关联**：INV-M01 / EVD-M06 / UF NA
- **前置任务**：无
- **风险等级**：P0

**为什么做**：防止把 rc.7 脏树当回归失败。

**涉及文件**：三 plugin git；`genoffice/scripts/dev.mjs`

**具体操作**：

1. 三仓 `git status -sb` + `git stash list` 写入 `evidence/phase-0/git.txt`
2. `node scripts/dev.mjs smoke` 写入 `evidence/phase-0/smoke.log`（relay 已 200 则直接 smoke）

**验证**：两文件存在

**Evidence**：`evidence/phase-0/`

**注意事项**：不要 reset --hard 丢掉 rc.7 工作区

### Task 2: 执行 Phase 0 回归验证

- **关联**：Phase 0
- **前置任务**：1
- **验证**：phase-0 文件齐全
- **Evidence**：`evidence/phase-0/`

### Phase 1: session-marks

### Task 3: 按子包执行 session-marks 至 5.1 绿

- **关联**：BR-M01 / UF-001 / UF-002
- **前置任务**：2
- **风险等级**：P0

**为什么做**：种类位是 vibee/隐藏/展示的前提。

**涉及文件**：子 spec 第 3.3 / 第 4 章全部

**具体操作**：严格按 `plugin/session-tool/plugin/docs/session-marks/spec.md` Task 1–14 与 handoff 执行；更新**子包** tasks.csv；evidence 可落在子包 `evidence/` 并在总包 `evidence/UF-001/` 放索引 README。

**验证**：子包 `pnpm test && pnpm run build`；无 vendor 依赖

**Evidence**：`evidence/UF-001/index.md` + 子 evidence

**注意事项**：PATH 带 nvm node；不要 revert rc.7 pin

### Task 4: 执行 Phase 1 回归验证

- **关联**：BR-M01
- **前置任务**：3
- **验证**：子包 5.1 + rg 无 dsh-session-tags 依赖
- **Evidence**：`evidence/phase-1/`

### Phase 2: genoffice open/SSE

### Task 5: 确认 relay /api/open 并移植 open 工具

- **关联**：BR-M02 / UF-003 / INV-M05 / ASM-M03
- **前置任务**：4
- **风险等级**：P0

**为什么做**：stash 里的产品能力要落到官方化树。

**涉及文件**：`upstream/web/server.mjs` `rg /api/open`；`tab-genoffice/src/host/tools.ts` `createControlTools`

**具体操作**：

1. 确认 `/api/open` 与 `/api/open/stream` 存在，摘录到 evidence
2. 手工移植 stash 中 **tools.ts 的 createOpenTools**（不要 apply 整个 stash）
3. 单测：open 成功/缺文件/relay down
4. 保持 control 工具表

**验证**：`cd plugin/dsh-genoffice/plugin && pnpm test` 含 open；`rg "file:.*vendor/dsh" packages` 无

**Evidence**：`evidence/UF-003/`

**注意事项**：BR-M04 禁止套 lock

### Task 6: 移植 SSE client 与预览打开

- **关联**：BR-M03 / UF-003
- **前置任务**：5
- **风险等级**：P1

**涉及文件**：`src/client/index.ts` `apply`；`src/tabs/relay.ts`；`src/tabs/genoffice.tsx`

**具体操作**：EventSource 在 client apply（tab 未开也连）；emit/subscribe open；id 若仍是 `dsh-artifact:*` 可一并改为 `dsh-genoffice:*`（与 stash 一致）但不要改依赖

**验证**：integration/client 测；`pnpm run build`

**Evidence**：`evidence/phase-2/sse.log`

### Task 7: 执行 Phase 2 回归验证

- **关联**：UF-003 / UF-004 / BR-M05
- **前置任务**：6
- **验证**：`pnpm test`（genoffice plugin）+ `node ~/workspace/dsh/genoffice/scripts/dev.mjs smoke`
- **Evidence**：`evidence/UF-004/smoke.log`

### Phase 3: vibee 种类接线

### Task 8: 开跑/建会话写入 kind:vibee

- **关联**：BR-M06 / UF-005 / INV-M03
- **前置任务**：7
- **风险等级**：P1

**涉及文件**：`plugin/vibee/plugin/packages/vibee-host/src`（`rg create|session` 定位后改）

**具体操作**：依赖 `session-marks`（workspace 或 file: 到 session-tool 仓，**不要**再 vendor session-tags）。在真正创建/登记 run session 处 `put(id, ['kind:vibee'])`；单测用 tmp DSH_HOME。不 registerTab。

**验证**：`pnpm --filter` 或仓内 test 覆盖该 hook

**Evidence**：`evidence/UF-005/`

**注意事项**：vibee 勿 reset 到 origin

### Task 9: 执行 Phase 3 回归验证

- **关联**：UF-005
- **前置任务**：8
- **验证**：vibee build+既有非 GUI 测仍过
- **Evidence**：`evidence/phase-3/`

### Phase 4: 本地收口

### Task 10: 分仓 commit（不 push）

- **关联**：BR-M07 / EVD-M06 / INV-M02
- **前置任务**：9
- **风险等级**：P2

**具体操作**：

1. session-tool：rc.7 pin + session-marks 实现（可 1–2 个语义 commit）
2. dsh-genoffice：rc.7/sidebar + open/SSE（勿提交 node_modules）
3. vibee：rc.7 + kind hook（勿 force）
4. genoffice 栈：脚本/契约文档可单独 commit
5. `git status` 写入 evidence；**禁止 git push**

**验证**：`git log -3` 各仓；无 `--force`

**Evidence**：`evidence/phase-4/git.txt`

### Task 11: 执行 Phase 4 回归验证

- **关联**：BR-M07
- **前置任务**：10
- **验证**：工作区无意外 node_modules 入索引
- **Evidence**：`evidence/phase-4/`

### Phase 5: 总真实场景

### Task 12: 执行 spec 5.2 真实场景全套测试

- **关联**：UF-001～005 全部 / EVD-M01～M05
- **前置任务**：11
- **风险等级**：P0

**具体操作**：按 5.2 矩阵；子包矩阵可复用子 evidence 并在总包写索引。

**验证**：矩阵全过

**Evidence**：`evidence/UF-00x/`

### Task 13: 执行 Phase 5 回归验证

- **关联**：全部
- **前置任务**：12
- **验证**：5.1 + 5.2 + `validate_package.py` 本目录
- **Evidence**：`evidence/phase-5/`

---

## 5. 验收与 Review 协议

### 5.1 命令级

| 项 | 命令 | 期望 |
|---|---|---|
| session-tool | `cd .../session-tool/plugin && pnpm test && pnpm run build` | 绿；无 session-tags 依赖 |
| genoffice plugin | `cd .../dsh-genoffice/plugin && pnpm test && pnpm run build` | 绿 |
| 栈 smoke | `cd .../genoffice && node scripts/dev.mjs smoke` | 全 PASS |
| vibee | `cd .../vibee/plugin && pnpm run build` + 非 GUI test | 绿 |

### 5.2 真实场景全套测试

**环境准备**：

| 项 | 值 |
|---|---|
| session-tool | `sh env/setup.sh && sh env/boot.sh`（PATH 含 nvm） |
| relay | `node scripts/dev.mjs start-relay`（已 UP 可跳过） |
| 入口 | CLI dsh-session；open 工具单测/curl POST :8787/api/open |
| 账号 | `env/.env` 从 `~/.dsh/.env` 复制，不提交 |
| 干净 | 删 `$DSH_HOME/session-tool/marks.jsonl`；open 用临时文件 |
| 工具 | CLI + curl；无强制浏览器 |

**执行矩阵**：

| UF | 方式 | 来源 | 核对 | Evidence |
|---|---|---|---|---|
| UF-001 主+失败 | CLI | 子包 5.2 UF-001～008 | 子矩阵 | `evidence/UF-001/` 索引 |
| UF-002 | CLI | 子 UF-002 | 双闸 | `evidence/UF-002/` 或子 |
| UF-003 主 | test/curl | 2.3 | POST /api/open 200/ok | `evidence/UF-003/success` |
| UF-003 缺文件/relay down | test | 2.3 | error | `evidence/UF-003/fail-*` |
| UF-004 | CLI | 2.3 | smoke PASS | `evidence/UF-004/smoke.log` |
| UF-005 主 | unit | 2.3 | kind:vibee | `evidence/UF-005/` |
| UF-005 无 marks 包 | 编译期 | 失败则 P1 未完 | 阻塞 | 备注 |

### 5.3 Evidence 结构

`evidence/phase-N/`、`evidence/UF-xxx/`

### 5.4 Review 清单

- [ ] 子包 vendor 已拆
- [ ] genoffice 无 file: vendor/dsh
- [ ] open + SSE 在 src 非仅 stash
- [ ] vibee 只接线 kind，无新 sidebar tab
- [ ] 无 force-push
- [ ] 5.2 矩阵 evidence 齐
- [ ] 入口：CLI、session_*、open 工具、smoke 均接线
