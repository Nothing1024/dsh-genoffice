# INV-005 非控制模式

`GET http://localhost:8787/markdown/?open=path:/tmp/ux-demo.md`（无 `control=1`）→ 200。
工具栏有 Genspark AI dock（「问问这篇文档」），正文为磁盘 `ux-demo.md`。
控制模式 iframe 才带 `control=1`。
