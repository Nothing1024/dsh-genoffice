# Task 4：契约扩展评审记录（contract-extension.md）

## 变更内容（contracts/control-api.md，0.1.0 → 0.2.0）

1. **镜像点声明**：适配器镜像点由 {docs, markdown} 扩为五 app
   `upstream/apps/{docs,markdown,sheets,slides,pdf}/src/renderer/control.ts`。
2. **app 注册表**：§2.3 `app ∈ {docs, markdown, sheets, slides, pdf}`（其余端点形状不变）。
3. **工具名集合表（§4）**：追加三族
   - `xlsx_*` 8 个 = 7 skill（get_workbook_context/read_range/load_guide/read_formats/
     read_sheet_features/read_cells/propose_operations）+ `xlsx_save`
   - `pptx_*` 37 个 = 36 skill（get_deck_context/read_slide/set_element_text/…/ungroup_element，
     全量镜像 slides-skill.ts `name: '…'` 集合）+ `pptx_save`
   - `pdf_*` 20 个 = 19 skill（read_pages/search_text/goto_page/markup_text/edit_text/edit_block/
     image_search/generate_image/list_page_images/insert_image/transform_image/rotate_image/
     replace_image/delete_image/list_form_fields/fill_form_field/rotate_page/delete_page/get_outline）
     + `pdf_save`
4. **扩展名 → app 映射**：`xlsx→sheets`、`pptx→slides`、`pdf→pdf`（§4 备注，插件 PREVIEWABLE/host 用）。
5. **写回触发文案**更新为五 app 的 `*_save` 工具名。

## 与 spec 数字的差异说明

spec Task 4 原文写 "pptx_* 13 个 / pdf_* 15 个"，但注明「其余以 Task 1 清单为准」——
Task 1 勘察实测 skill 工具集为 **pptx 36 个、pdf 19 个**（sheets 7 个与 spec 一致）。
按 INV-004 镜像纪律（契约 = skill AGENT_TOOLS 逐名核对，smoke 漂移即 FAIL），
契约表以**实测全量**为准，13/15 为 PRD 生成时的占位估计，已由实测清单取代。

## 评审点核对

| 检查项 | 结果 |
|---|---|
| 未引入非 JSON 消息格式 | ✔（传输/形状零改动，SSE+POST 沿用 ASM-008） |
| 端点形状未变 | ✔（仅 controlMatch app 集合扩展，见 Task 5） |
| 镜像点声明覆盖新 app | ✔（4 处镜像点 + 契约 §4 备注） |
| 工具名 `_` 分隔符（ASM-002） | ✔（xlsx_*/pptx_*/pdf_*） |
| 契约 ID 引用闭环 | validate_package.py 结果见下 |

## 验证命令

| 命令 | 结果 |
|---|---|
| `python3 …/validate_package.py docs/genoffice-dsh-office` | 见下（Task 24 前以 smoke 镜像断言为准，Task 4 要求 0 FAIL） |
