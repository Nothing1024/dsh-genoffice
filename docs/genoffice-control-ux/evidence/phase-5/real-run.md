# 5.2 全流程 2026-08-25（源码修复后整表重跑）

环境：DSH `127.0.0.1:3080` profile `go`；`DSH_GENOFFICE_ROOT` 已配；chrome-devtools-proxy 本机 9222。
AI Tab Group 扩展在页面里 `chrome.runtime` 不可用，未归组。

`node scripts/dev.mjs smoke` → 全部 PASS。
`cd plugin && pnpm vitest run` → 15 files / 129 tests。
upstream 五 app typecheck → 0 error。

| 矩阵行 | 结果 | 说明 |
|---|---|---|
| UF-001 主路径 | PASS | `_r=01783f38-…` 保存不重挂；undo + 二次保存无 conflict |
| UF-001 旧 relay 回退 | SKIP / 单测 | 未 stash 现网 `server.mjs`；见 UF-001/legacy.md |
| UF-001 写回失败 | PASS | 「写入失败：EACCES」，nonce `8409c3c8-…` 不换 |
| UF-002 主路径 | PASS | 外部 EXTERNAL_TOUCH → 另存 `/tmp/ux-demo (副本 20260825-2228).md` |
| UF-002 副本已存在 | PASS | UI「副本已存在，未覆盖」；两文件字节不变 |
| UF-003 主路径 | PASS | ● / 未保存 / 「返回」confirm 可取消；见 UF-003/notes.md |
| UF-003 伪造消息 | PASS | 3080 origin postMessage 不改 ●；单测见 forged.md |
| UF-004 主路径 | PASS | chat `pdf_open` + `pdf_read_pages`；见 UF-004/agent-session.md |
| UF-004 GUI 未开 | SKIP / 单测 | 未关用户 DSH；open-tools.spec 覆盖 |
| UF-005 主路径 | PASS | kill 后刷新见「启动 relay」；点击后列表恢复 |
| UF-005 未配置 env | SKIP / 单测 | 现网 configured=true；relay-launch.spec.ts |
| 兼容非控制模式 | PASS | `localhost:8787/markdown/?open=path:…` 无 control=1，Genspark dock 在 |

## 5.4 抽查

- 保存成功 iframe 未重挂、undo 可用（UF-001）
- exists / EACCES 两侧文件未变；saveAs API `{error:"exists"}` / `{error:"invalid saveAs"}`
- dirty 来自适配器；伪造 origin 丢弃
- smoke 89 工具名镜像仍绿
- subscribers=0 由单测覆盖
- 新旧 relay 组合未 stash 现网，由无 mtimeMs 重挂单测覆盖
