# Phase 1

- POST /api/file 与 export 成功响应含数值 `mtimeMs`
- 浏览器连续两次「写入磁盘」ok、iframe `_r` 不变、无 conflict
- 见 `double-save.log` / `relay-saved.log`（若被 gitignore）
