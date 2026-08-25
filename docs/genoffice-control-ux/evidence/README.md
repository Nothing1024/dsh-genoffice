# Evidence Directory

本目录用于保存 genoffice-control-ux 的执行和验收证据。没有 evidence，不视为完成。

## 结构（与 spec 2.5 / 5.3 对应）

```text
evidence/
  phase-0/          # 契约 diff、dirty-survey.md
  phase-1/          # relay-saved.log、adapters.diff、plugin.diff、tests.log、double-save.log
  phase-2/          # saveas-ui.diff、回归输出
  phase-3/          # contracts-dirty.diff、dirty-adapters.diff、dirty-ui.diff
  phase-4/          # pdf-open.diff、fast-fail.diff、relay-launch.diff、launch-ui.diff
  phase-5/          # smoke.log、build.log、close.log
  UF-001/           # 保存不重挂：截图对、undo 步骤、双保存 console（EVD-001）
  UF-002/           # 冲突另存：conflict/成功截图、字节核对（EVD-002）
  UF-003/           # 未保存指示：● 标题、按钮高亮、返回确认、伪造消息（EVD-003）
  UF-004/           # pdf_open 成功与 GUI 未开快速失败的工具调用记录（EVD-004）
  UF-005/           # relay 一键拉起：down/starting/up 截图、无 env 无按钮（EVD-005）
  API-saveas/       # export saveAs curl 样例：成功/exists/invalid（EVD-007）
```

## Evidence 命名

- `EVD-xxx` 必须能在 `spec.md` 第 2.5 节中找到。
- 截图文件名包含 UF 编号和状态：`UF-001-success.png`、`UF-003-dirty-title.png`。
- API 文件名包含场景：`API-saveas-exists.json`。
- 命令输出保存完整命令、时间、结果摘要。

## Phase Summary 模板

```markdown
# Phase {N} Summary

## 完成任务

- Task ...

## 验证命令

| 命令 | 结果 | 日志 |
|---|---|---|

## 用户路径 / API 验证

| UF/API | 结果 | Evidence |
|---|---|---|

## 剩余风险

- ...
```
