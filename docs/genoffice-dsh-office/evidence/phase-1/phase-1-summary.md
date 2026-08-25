# Phase 1 Summary（契约与控制面扩展）

## 完成任务

- **Task 4** 扩展 `contracts/control-api.md`（0.1.0 → 0.2.0）：
  - app 注册表扩为 `{docs, markdown, sheets, slides, pdf}`（§2.3）
  - 工具名集合表追加 xlsx_* 8 / pptx_* 37 / pdf_* 20（全量镜像 skill 实测集合，见 contract-extension.md 差异说明）
  - 扩展名 → app 映射（xlsx→sheets / pptx→slides / pdf→pdf）+ 镜像点声明更新
  - 评审记录：`evidence/phase-1/contract-extension.md`
- **Task 5** relay 控制面与 smoke 断言：
  - `upstream/web/server.mjs` `controlMatch` 正则扩为五 app（L403）
  - `scripts/dev.mjs`：五 app 未注册形状断言（BR-003）、未知 app 404 改用 `foo`、契约工具名集合计数
    （docx 11 + markdown 5 + xlsx 8 + pptx 37 + pdf 20）、五 app skill 镜像断言、host 镜像按已声明族严格核对
    （未接线族提示）
- **Task 6** Phase 1 回归：smoke 全绿 + curl 抽查五 app 未注册两态

## 验证命令

| 命令 | 结果 | 日志 |
|---|---|---|
| `node scripts/dev.mjs smoke` | 全部通过（新增 5 app 断言与 3 skill 镜像断言） | smoke.log |
| curl 五 app `context` 未注册 | 五 app 均 `{ok:false,error:'executor not registered'}` | 本 summary |
| curl 未知 app `foo` | 404 | 本 summary |
| `python3 …/validate_package.py docs/genoffice-dsh-office` | 0 FAIL / 13 PASS | contract-extension.md |

## 用户路径 / API 验证

| UF/API | 结果 | Evidence |
|---|---|---|
| `POST /api/control/{docs,markdown,sheets,slides,pdf}/<64hex>/context`（未注册） | `executor not registered` 五态一致 | smoke.log + 本 summary |
| `POST /api/control/foo/…` | 404（未知 app 语义不破坏） | smoke.log |
| 契约 ↔ skill 镜像（5 app） | 逐名一致 | smoke.log |
| 契约 ↔ 插件 host 注册 | docx/markdown 一致；xlsx/pptx/pdf 未接线（Task 10/14/18）提示 | smoke.log |

## 剩余风险

- 插件 host 的 xlsx/pptx/pdf 工具族尚未接线（Task 10/14/18 生效后 smoke 自动严格核对）。
- relay 需重启才生效（rev 缓存陷阱已记录：改 server.mjs 后必须重启 8787 实例）。
