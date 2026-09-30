# Evidence Directory

本目录用于保存执行和验收证据。没有 evidence，不视为完成；空文件（0 字节）不算证据，校验脚本会判失败。

所有 e2e 必须带 `--out docs/upstream-sync-v011/evidence/...` 写到这里，不得写到其他任务包的 evidence 目录。

## 结构

```text
evidence/
  phase-0/
    decisions.md      # ASM-001/002 用户决定
    baseline.log      # 合并提交后的测试通过数
    exit.log
  phase-1/
    conflict/  five/  sheets-media/  css/  exit-css/
    exit.log
  phase-2/
    rename-css/  land/  ous/
    merge-v0.10.63.md
    merge-log.md      # 每个 tag 的冲突文件、解决理由、编辑器工具变化
    exit.log
  phase-3/
    remove-pptx-create.log
    pta/
    exit.log
  phase-4/
    docs.log
  UF-001/  sidebar-success.png  five-family.log  file-conflict.log  revision.log  relay-down.png
  UF-002/  legacy-rewrite.log  invalid-args.log  scratch-guard.log
  UF-003/  create.log  exists.log  occupied.log  mcp-missing.log
  UF-004/  cross-origin.log  json-forged.log  inject.log
  UF-005/  editor-tools.json  report.md  relay-down.log  not-ready.log
  final/
    regression.log
```

## Evidence 命名

- `EVD-xxx` 必须能在 `spec.md` 第 2.5 节中找到。
- 截图文件名包含 UF 编号和状态。
- 命令输出保存完整命令、时间、结果摘要；curl 用例保存 request 头与 response 全文。

## Phase Summary 模板

每个 Phase 最后一条任务完成后写 `phase-{N}/summary.md`：

```markdown
# Phase {N} Summary

## 完成任务

- Task ...

## 验证命令（含出口检查）

| 命令 | 结果 | 日志 |
|---|---|---|

## 用户路径 / API 验证

| UF/API | 结果 | Evidence |
|---|---|---|

## 剩余风险

- ...
```
