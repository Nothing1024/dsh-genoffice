# UF-004 agent 工具调用（真实 DSH 会话，:3080，2026-08-25 22:32）

会话「读取PDF文件并调用函数」（1 轮 · 3 步，用时 8 秒；LLM 7.9s · 工具调用 0.3s）：

用户：调用 pdf_open path=/tmp/ux-demo.pdf，成功后调用 pdf_read_pages start=1 end=1。不要做其他事。

1. pdf_open · /tmp/ux-demo.pdf
   成功打开 /tmp/ux-demo.pdf，返回「已打开控制模式」
   侧栏弹出 ux-demo.pdf 文件 tab，iframe 渲染 2 页（Demo PDF Page One）

2. pdf_read_pages · /tmp/ux-demo.pdf start=1 end=1
   [Page 1]
   Demo PDF Page One
   This is a body paragraph containing the word wrong to fix later.
   Second line for markup testing.
   Revenue: 1200 units

agent：「未做其他操作。」

## subscribers=0（GUI 未开）

未关闭用户 DSH 页面。由 `packages/tab-genoffice/tests/open-tools.spec.ts`：
`fails immediately when subscribers is 0` 断言错误含「没有 DSH 页面在监听」。
`pnpm vitest run` 2026-08-25：15 files / 129 tests 全绿。
