# UF-002 双闸（总包 5.2）

date: 2026-08-19T01:26:00Z

## 结论

默认 list 双闸（`~` 标题 + `kind:hidden`）**未能用 CLI 核对**。

`dsh-session session list --profile st` 在加载 profile 时因缺少  
`session-tool-env/apps/cli/package.json` 退出，未到达 list JOIN / hidden filter。

`empty.txt` 是该次 CLI 原始输出。

库层：`session-marks` 不实现标题隐藏；`isTitleHidden` 仍来自 vendor `dsh-session-tags`。
双闸主路径仍依赖 session-tool-local 接线，本包未在 CLI 上验证。
