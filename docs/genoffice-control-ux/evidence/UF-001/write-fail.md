# UF-001 写回失败（浏览器）

前置：`/tmp/ux-ro-dir/ux-ro.md`，目录 `chmod 555`。

## 修复后（本轮）

- 点「写入磁盘」后秒级红字：**写入失败：EACCES**
- iframe `_r=eff62e47-39e5-4d2a-ae5c-261c0e86e1ba` 未换，编辑器仍是磁盘原文（`# ro` / `line`）
- 直接 `curl` 同路径 export：`{"ok":false,"error":"EACCES"}`，耗时 ~10ms（不再等 iframe 60s）
- 磁盘仍是 `# ro\nline\n`（未覆盖）
- `chmod` 已恢复 **755**

截图：`UF-001-write-fail-eacces.png`（此前失败对照：`UF-001-write-fail.png`）

## 对照 spec

红色「写入失败：<磁盘原因>」，iframe 不重挂。本轮原因是 `EACCES`。

## 机制

relay 在等待 iframe export 之前对目标父目录做 wx tmp 预检（`web/write-atomic.mjs` `preflightDest`）。只读目录不再走到 `timeout`。
