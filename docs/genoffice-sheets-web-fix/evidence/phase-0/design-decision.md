# Task 2 设计决策：控制模式布局修复方案

日期：2026-08-21
关联：BR-001, BR-002, INV-001, UF-001, UF-003

## 1. 复现时的真实 DOM（覆盖 spec 的 Before 心智模型）

Playwright 在 `800×900` 视口、`control=1` 下对
`fixtures/generated/compatibility-basic.xlsx` 实测（见 `repro-control-mode.png`）：

| 项 | 控制模式 (`control=1`) | 非控制模式 |
|---|---|---|
| `.app-shell` class | `app-shell `（无 `copilot-collapsed`） | `app-shell ` |
| `.sheet-body` `grid-template-columns` | `360px 540px` | `360px 540px` |
| `.sheet-body` 子节点 | **仅** `.sheet-main`（`grid-column: auto`，宽 360px，x=0） | `AiChatPanel`（360px）+ `.sheet-main`（x=360） |
| `#univer-container` | x=0，内容 overflow 出 360px 轨道，右侧约 350px 空白 | x=360，表格在第二列 |
| AI 面板 DOM | 不存在（`{!CONTROL_MODE && <AiChatPanel/>}`） | 存在且默认展开 |
| `body` min-width | `900px`（既有约束，本次不改） | 同左 |

结论：控制模式下第一列并不是「空着的 360px 把表格挤到右边」，而是
**唯一子元素 `.sheet-main` 被 CSS Grid 自动放入第一列（360px 固定轨道）**，
第二列 `1fr` 成为右侧死区。这与「编辑区域只显示约一半、顶栏完整」一致。

`body { min-width: 900px }` 使 800px 视口仍按 900px 排版并 `overflow: hidden`
裁切；这是既有约束，不是本 bug 的根因。根因是 grid 两列在「第一列无 DOM」时
仍按 `--copilot-width` 分配。

## 2. 方案评估

### 方案 A：`useState(!CONTROL_MODE)`，复用 `.copilot-collapsed`

- 改动：`ExcelShell.tsx` 一处初值。
- 非控制模式：`CONTROL_MODE=false` → `!false=true`，初值与现在相同，UF-003 默认展开不受影响。
- 控制模式：`isCopilotOpen=false` → `.app-shell.copilot-collapsed`，现有规则
  `grid-template-columns: 34px minmax(0, 1fr)` 生效。
- **失败点（实测否决）**：该规则的前提是「第一列仍有收起态 `<aside class="copilot collapsed">`，
  `.sheet-main` 落在第二列」。控制模式整棵 `AiChatPanel` 不渲染，`.sheet-main` 仍是唯一子节点、
  仍进第一列。把第一列从 360px 改成 34px **会把表格进一步压窄**，与 BR-001 相反。
- 另外把「控制模式」和「用户手动收起」绑在同一个 boolean 上，正是 spec 警告的 UF-003 耦合风险。

### 方案 B：独立 `control-mode` class + 专用 CSS（选定）

- 改动：
  1. `.app-shell` 在 `CONTROL_MODE` 时附加 `control-mode` class（不改 `isCopilotOpen`）。
  2. 新增选择器，**只**覆盖控制模式。
- spec 示例写的是
  `.app-shell.control-mode .sheet-body { grid-template-columns: 0 minmax(0, 1fr); }`。
  该写法仍是两列，唯一子节点会进 **0 宽第一列**，比方案 A 更差。
- **校正（仍属方案 B，不是混用 A）**：控制模式下改为单列

  ```css
  .app-shell.control-mode .sheet-body {
    grid-template-columns: minmax(0, 1fr);
  }
  ```

  唯一子节点 `.sheet-main` 拿到全部轨道宽度；不引入 34px 收起轨（控制模式本就没有 AI 入口）。

## 3. 选定

**落地方案 B（单列校正版）**。

理由：

1. 与实测 DOM 一致：控制模式 = 无 AI 子节点，应使用 1 列 grid，而不是「假装已收起的 2 列」。
2. 不改 `isCopilotOpen` 初值/切换逻辑 → UF-003 / INV-001 / BR-002 零耦合。
3. 不改 `.copilot-collapsed` 既有 `34px 1fr` 规则 → 非控制模式收起/展开视觉与修复前一致。
4. 不混用方案 A 的 state 初值（遵守 Task 4「禁止同时改 state 初值又改 CSS 选择器」：只走 B）。
5. 不触碰 `control.ts`（INV-002）、不改 docs/slides（INV-004）。

## 4. 对 UF-003 的影响推理

| 状态 | `CONTROL_MODE` | `isCopilotOpen` | `.app-shell` class | grid |
|---|---|---|---|---|
| 独立 tab 默认 | false | `true`（初值不变） | `app-shell` | `360px 1fr`（既有） |
| 独立 tab 收起 | false | `false`（用户点击） | `app-shell copilot-collapsed` | `34px 1fr`（既有） |
| 独立 tab 再展开 | false | `true` | `app-shell` | `360px 1fr`（既有） |
| 控制模式 | true | 仍为 `true`，但面板不渲染 | `app-shell control-mode` | `minmax(0, 1fr)`（新） |

`control-mode` 选择器不匹配非控制模式，因此三态与修复前逐像素应一致。

## 5. 明确不采用的路径

- 不在控制模式里继续渲染收起态 `AiChatPanel` 来「凑」两列（会露出 34px AI 按钮，与 ribbon 已隐藏 AI 入口不一致）。
- 不把 `isCopilotOpen` 初值改成 `!CONTROL_MODE`（方案 A，实测会压窄表格）。
- 不修改 `body { min-width: 900px }`（既有约束，非本 bug；若后续插件极窄侧栏仍裁切，另开需求）。
