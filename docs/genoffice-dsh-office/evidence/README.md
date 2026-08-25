# Evidence Directory

本目录用于保存执行和验收证据。没有 evidence，不视为完成。

## 建议结构

```text
evidence/
  phase-0/
    commands.log / slidesapi-inventory.md / sheets-pdf-survey.md
    baseline-*.png / web-strategy.md / phase-0-summary.md
  phase-1/
    contract-extension.md / smoke.log / phase-1-summary.md
  phase-2/
    sheets-web-console.log / sheets-control-console.log / sheets-export-bytes.json
    xlsx-tools.log / phase-2-summary.md
  phase-3/
    slides-web-console.log / slides-control-console.log
    pptx-tools.log / phase-3-summary.md
  phase-4/
    pdf-web-console.log / pdf-control-console.log
    pdf-tools.log / phase-4-summary.md
  phase-5/
    build-typecheck.log / phase-5-summary.md
  phase-6/
    phase-6-summary.md
  UF-001/               # xlsx 主路径 + 失败分支 + format-fidelity/
    main-*.png / tool-calls.log / file-unchanged.diff
    fail-unregistered.png / fail-invalid.json / fail-timeout.json
  UF-002/               # pptx
    main-*.png / after.diff / fail-unregistered.png / fail-badelement.json
  UF-003/               # pdf
    main-*.png / after.diff / fail-textmismatch.json / fail-export.json
  UF-004/               # 无 AI 双态截图（三 app）
    {sheets,slides,pdf}-control-noai.png / -noncontrol-ai.png
    noncontrol-ai.png / legacy-compat.png
  API-control/          # 五 app 控制面 request/response 样例
    context-ok.json / tool-{ok,invalid,unregistered,timeout}.json
    file-write-{ok,403,fail}.json / export-ok.json / docid.log
  fixtures/
    demo.xlsx / demo.pptx / demo.pdf
```

## Evidence 命名

- `EVD-xxx` 必须能在 `spec.md` 第 2.5 节中找到。
- 截图文件名包含 UF 编号和状态：`UF-001-main.png`。
- API 文件名包含场景和状态：`file-write-403.json`。
- 格式保真证据：`UF-00x/format-fidelity/`（写回产物 + 桌面版/Office 打开校验输出）。

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
