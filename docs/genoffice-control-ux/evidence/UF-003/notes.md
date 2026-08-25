# UF-003 主路径

- 编辑后 tab 标题 `● ux-demo.md`，iframe 脚「未保存」，「写入磁盘」高亮
- 文件 tab「返回」：`GenOfficeFileTab` → `onBack` → `betterSidebar.closeTab`
- dirty 点「返回」弹 confirm「有未保存的编辑，确定离开？」
  - 取消：留在 `_r=01783f38-e563-4785-bd22-8d2609000718`，`●` 与 `SAVE2-EDIT` 仍在
- FileViewer 仍无「返回」（集成测试）
- 页 origin `127.0.0.1:3080` 伪造 `genoffice:dirty`（对/错 docId）都没有清掉 `●`

截图：`UF-003-dirty-title.png`、`UF-003-back.png`
伪造 origin 单测见 `forged.md`。
