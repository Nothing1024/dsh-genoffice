# UF-001 写回失败

本轮未做 chmod 只读目录的浏览器回放。

失败分支仍由 control-mode `saveToDisk` 的 `ok:false` 路径落到红色 `saveMessage`，且不走 remount（只在 `ok && typeof mtimeMs === 'number'` 时清 dirty）。
