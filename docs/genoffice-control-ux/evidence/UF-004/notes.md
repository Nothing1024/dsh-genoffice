# UF-004

## agent 会话主路径（2026-08-25 全矩阵重跑，PASS）

DSH :3080 会话「读取PDF文件并调用函数」（1 轮 · 3 步，用时 8 秒）：

1. `pdf_open` `/tmp/ux-demo.pdf` → 「已打开控制模式」；侧栏弹出 pdf 文件 tab，iframe 2 页
2. `pdf_read_pages` start=1 end=1 → Page 1「Demo PDF Page One」

详见 `agent-session.md`。截图：`UF-004-dsh-pdf-tab.png`

控制面补证：`registered: true`；`context` / `search_text` / `read_pages` 见此前 `UF-004-pdf-registered.png`。

## GUI 未开

未关用户 DSH 页面。`open-tools.spec.ts`：`subscribers === 0` 秒级失败，文案含「没有 DSH 页面在监听」。
