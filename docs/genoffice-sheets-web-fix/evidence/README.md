# Evidence Directory

本目录用于保存 `genoffice-sheets-web-fix` 需求的执行和验收证据。没有 evidence，不视为完成。

## 结构

```text
evidence/
  phase-0/
    repro-control-mode.png     # 控制模式下死区复现截图
    repro-non-control.png      # 非控制模式对照截图
    design-decision.md         # Task 2 修复方案选择记录
  phase-1/
    typecheck.log
    build.log
  phase-2/
    （Phase 2 聚合 summary，具体产物见 benchmark/）
  phase-3/
    （最终回归 summary）
  UF-001/
    success-700px.png
    success-900px.png
  UF-002/
    resize-500px.png
  UF-003/
    default-open.png
    collapsed.png
    expanded-again.png
  benchmark/
    fixtures/
      large-10k-rows.xlsx
    fixture-open-check.png
    baseline.md
    before-after.md 或 decision.md
    performance-trace.json
```

## Evidence 命名

- `EVD-xxx` 必须能在 `spec.md` 第 2.5 节中找到。
- 截图文件名包含 UF 编号和状态，如 `UF-001/success-700px.png`。
- 性能基线/决策文档必须包含具体数字或具体理由，不得含糊。

## Phase Summary 模板

```markdown
# Phase {N} Summary

## 完成任务

- Task ...

## 验证命令

| 命令 | 结果 | 日志 |
|---|---|---|

## 用户路径 / 性能验证

| UF/基线项 | 结果 | Evidence |
|---|---|---|

## 剩余风险

- ...
```
