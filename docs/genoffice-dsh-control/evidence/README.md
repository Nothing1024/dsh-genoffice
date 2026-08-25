# Evidence Directory

本目录用于保存执行和验收证据。没有 evidence，不视为完成。

## 建议结构

```text
evidence/
  phase-0/
    commands.log
    baseline.md
    baseline-docs.png        # 非 control 模式基线截图（INV-001 对照）
    control-api-draft.md     # 契约评审记录
    phase-0-summary.md
  phase-1/
    smoke.log
    phase-1-summary.md
  phase-2/
    docs-control-console.log
    markdown-control-console.log
    wiring-docs.png
    wiring-markdown.png
    export-bytes.json
    phase-2-summary.md
  phase-3/
    phase-3-summary.md
  phase-4/
    tool-schema.json
    build-typecheck.log
    phase-4-summary.md
  phase-5/
    phase-5-summary.md
  UF-001/
    main-*.png / tool-calls.log / file-unchanged.diff
    fail-unregistered.png / fail-notready.png / fail-invalid.json / fail-timeout.json
  UF-002/
    save-success.png / after.diff / fail-conflict.png / fail-readonly.json / fail-noopen.png
  UF-003/
    docs-control-noai.png / markdown-control-noai.png
    noncontrol-ai.png / legacy-compat.png
  UF-004/
    context-ok.json / fail-unregistered.json / fail-large.json
  API-control/
    stream-hello.txt / notify-ok.json / notify-unregistered.json
    tool-{ok,invalid,unregistered}.json / file-write-{ok,403,fail}.json / docid.log
  fixtures/
    demo.md / demo.docx        # 5.2 测试数据
```

## Evidence 命名

- `EVD-xxx` 必须能在 `spec.md` 第 2.5 节中找到。
- 截图文件名包含 UF 编号和状态：`UF-001-main.png`。
- API 文件名包含场景和状态：`file-write-403.json`。
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
