# Evidence Directory

本目录用于保存执行和验收证据。没有 evidence，不视为完成。

## 建议结构

```text
evidence/
  phase-0/
  phase-1/
  phase-2/
  phase-3/
  UF-001/
  UF-002/
  UF-003/
  UF-004/
  UF-005/
  UF-006/
```

## Evidence 命名

- `EVD-xxx` 必须能在 `spec.md` 第 2.5 节中找到。
- API 文件保存完整 request/response。
- 会话日志用 JSONL 摘工具 CALL/RES，不要整份 `assistant/chunk` 垃圾。

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
