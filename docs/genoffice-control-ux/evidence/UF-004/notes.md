# UF-004

## 已验证

- host 注册 `pdf_open`（`OPEN_TOOL_EXTS` 含 `pdf`）
- DSH GUI 打开时 `POST /api/open` 返回 `subscribers: 1`（控制模式 iframe 在听）
- `subscribers === 0` 秒级失败：`packages/tab-genoffice/tests/save-tools.spec.ts` / `open-tools.spec.ts`

## 未在本轮用 chat 真跑

没有在新会话里让 agent 调 `pdf_open /tmp/ux-demo.pdf` 再跟一条 `pdf_*`。
工具卡与 tab 弹出依赖那条 agent 路径；代码接线已在。
