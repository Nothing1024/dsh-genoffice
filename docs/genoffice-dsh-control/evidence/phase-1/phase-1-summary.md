# Phase 1 Summary

## 完成任务

- Task 4：执行器注册表与 SSE 下行通道（`GET /api/control/stream`：hello/ping/注册/注销/32 连接上限/非法 docId 400）
- Task 5：上行通知 `POST /api/control/notify`（tool-result/context/export 三 kind；未注册明确错误；pending TTL）
- Task 6：context/tool 端点（合法往返 / invalid input 不转发 / executor not registered / timeout 不重放 / 未知 app 404）
- Task 7：`POST /api/file` 写回端点（tmp+rename 原子写；loopback-only 403；mtime 冲突校验；50MB 上限）
- Task 8：docId 计算（sha256 绝对路径，64hex；`POST /api/control/open` 辅助端点；非法路径 400）
- Task 9：Phase 1 回归验证（smoke 新增控制面端点形状 + 工具名集合镜像断言，全绿）

## 验证命令

| 命令 | 结果 | 日志 |
|---|---|---|
| `node scripts/dev.mjs smoke` | 22 项断言全部 PASS（原 14 + 新增 8 项控制面断言） | evidence/phase-1/smoke.log |
| `curl -N /api/control/stream?docId=<64hex>` | hello 事件即时返回；ping 每 25s | evidence/API-control/stream-hello.txt |
| `curl -N …?docId=nothex` | `400 {ok:false,error:'invalid docId'}` | 同上（命令日志） |
| 模拟执行器往返（curl 分离连接） | context `{ok,context}`；tool `{ok,execution}`；invalid input 不转发；unregistered；timeout | evidence/API-control/{context-ok,tool-ok,tool-invalid,tool-unregistered,tool-timeout}.json |
| `curl POST /api/file` | ok：字节正确替换；403：伪造 Host；fail：坏路径原文件不变；conflict：mtime 不匹配拒绝 | evidence/API-control/file-write-{ok,403,fail}.json |
| `node -e` docId + `POST /api/control/open` | 同路径同 docId；异路径异 docId；与 node 侧 sha256 一致 | evidence/API-control/docid.log |

## 用户路径 / API 验证

| UF/API | 结果 | Evidence |
|---|---|---|
| UF-001 失败分支（未注册/非法参数/超时） | ✔ 三态错误语义与契约一致 | tool-{unregistered,invalid,timeout}.json |
| UF-002 保存链路（export→notify→写回） | ✔ 磁盘内容 = 回传字节；未注册报错 | export-ok.json |
| UF-004（context 端点） | ✔ 返回上下文；未注册报错 | context-ok.json |
| BR-009 docId 规则 | ✔ | docid.log |
| INV-002/BR-005 写回边界 | ✔ 403 | file-write-403.json |

## 剩余风险

- 修复了一个真实竞态：pending 注册必须在 pushTo 之前（fast notify 否则被丢弃）——已修复并回归。
- Node fetch（undici）单进程内同时持有 SSE + 挂起 POST 时会排队延迟响应；真实客户端为浏览器（EventSource + 页面 fetch），连接池充足，不受影响。smoke 与 5.2 均用真实客户端形态验证。
- 工具名集合镜像断言中插件 host 侧待 P4 接线后生效（当前提示行）。
