# UF-001 索引（总包 5.2）

date: 2026-08-19T01:26:00Z

子包 session-marks 5.2 UF-001～008 按 CLI 能跑的范围执行。

## 结论

- `packages/session-marks` 库单测 8/8 通过（见 `../UF-005/kind-hook.log`）。
- `dsh-session` 入口存在：`packages/session-tool-cli/lib/bin.js`。
- **主路径未通**：CLI `composeProfile` 仍读已删除的 worktree 锚点  
  `DSH_SESSION_ANCHOR` 默认 `../../../../env/session-tool-env/apps/cli/package.json`  
  工作区内无 `session-tool-env`。create/list 在打到网关前即以 ENOENT 退出。
- **无 `marks` 子命令**（仅 `session` / `workspace`）。UF-008 CLI 不可用。
- create 未接线 `session-marks.put`；`tagsOf` 仍扫官方 `session/tags` 事件。
- 网关 `sh env/setup.sh` 成功。`sh env/boot.sh` 随后使 :3080 返回 200。  
  网关已 UP 时再跑 create，仍在锚点 ENOENT 处失败（见 `success.txt`）。
- `env/.env` 已从 `~/.dsh/.env` 复制（mode 600），`.gitignore` 已加 `env/.env`，未提交。

## 本目录文件

| 文件 | 含义 |
|---|---|
| `fail-web.txt` | 未 boot / 锚点缺失时 create；marks.jsonl 未出现 |
| `marks-cli.txt` | `dsh-session marks --help` 无该子命令 |
| `fail-empty-tag.txt` | `--tag ""` 同样卡在锚点 ENOENT，未到 tag-invalid |

子包 `plugin/session-tool/plugin/docs/session-marks/evidence/` 仍无 CLI 矩阵落盘。
