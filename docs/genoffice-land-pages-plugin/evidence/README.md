# Evidence Directory

本目录用于保存 **DSH 插件**执行和验收证据。没有 evidence，不视为完成。

```text
evidence/
  phase-0/          # 含 probe.json（BR-000）
  phase-1/
  phase-2/
  UF-001/
  UF-002/
  UF-003/
  UF-004/
```

- `EVD-xxx` 必须能在 `spec.md` 第 2.5 节中找到。
- 会话日志只摘 tool CALL/RES，不要整份 `assistant/chunk`。
- 5.2 标完成前必须有绿的 `phase-0/probe.json`。
