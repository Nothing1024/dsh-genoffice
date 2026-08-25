# UF-002

## 主路径（2026-08-25 全矩阵重跑）

- 控制模式打开 `/tmp/ux-demo.md`，iframe 编辑 `SAVE2-EDIT`，nonce `_r=01783f38-e563-4785-bd22-8d2609000718`
- 外部写入 `EXTERNAL_TOUCH` 后点「写入磁盘」→ 橙色「文件已被外部修改，未覆盖」+「另存为副本」
- 点「另存为副本」→ 绿色「已另存为 /tmp/ux-demo (副本 20260825-2228).md」
- iframe 未重挂，编辑 `SAVE2-EDIT` 仍在

## 副本已存在

- 预置同分钟文件名后再另存 → 红色「副本已存在，未覆盖」
- 原文件仍含 `EXTERNAL_TOUCH`、不含 `SAVE2-EDIT`
- 副本 `2228` 仍含 `SAVE2-EDIT`、不含 `EXTERNAL_TOUCH`
- 预置 `2230` 仍是 `PLACEHOLDER_EXISTS`

截图：`UF-002-conflict.png` `UF-002-saveas-success.png` `UF-002-exists.png`  
字节：`bytes.md`
