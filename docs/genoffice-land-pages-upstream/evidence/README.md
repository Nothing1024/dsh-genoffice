# Evidence Directory

本目录用于保存**上游**执行和验收证据。没有 evidence，不视为完成。

```text
evidence/
  phase-0/
  phase-1/
  phase-2/
  UF-001/
  UF-002/
  UF-003/
  UF-004/
  UF-005/
```

- `EVD-xxx` 必须能在 `spec.md` 第 2.5 节中找到。
- API 文件保存完整 request/response。
- 本包验收是 curl 控制面，不要求 DSH 会话 JSONL。
