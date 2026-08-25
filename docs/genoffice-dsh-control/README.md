# genoffice-dsh-control — 文档入口

DSH 控制 GenOffice 文档编辑（docs/markdown 先行）的需求包。**spec.md 是唯一事实源**，
其余文件只做导航与实现记录，不复制 spec 内容。

| 文档 | 用途 |
|---|---|
| [spec.md](./spec.md) | **唯一事实源**：事实基线、业务合同（BR/UF/INV/EVD）、技术方案、Task 1-24、验收协议（5.2 执行矩阵 / 5.3 evidence / 5.4 检查清单） |
| [integration.md](./integration.md) | **原生 GenOffice 集成说明**：架构、组件与集成点、启动、用户/agent 工作流、安全边界、故障排查、M0-M3 范围 |
| [tasks.csv](./tasks.csv) | 24 条任务状态板（全部已完成） |
| [handoff.md](./handoff.md) | 交付 Prompt（入口导航，执行时读 spec） |
| [evidence/](./evidence/) | 执行证据（phase-0~5 + UF-001~004 + API-control + fixtures + acceptance-guide.md + review-fixes.md） |

## 快速入口

- 想**用**：`evidence/acceptance-guide.md`（验收/复验步骤）或 `integration.md` §4-5（用户/agent 工作流）
- 想**理解实现**：`integration.md` §2（组件与集成点）→ `contracts/control-api.md`（契约）
- 想**验收**：`spec.md` §5 + `evidence/acceptance-guide.md`
