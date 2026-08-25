# UF-003 伪造 dirty 消息

浏览器页内无法伪造 `event.origin`。由单测覆盖：

`ignores dirty messages from the wrong origin or docId`

- `http://evil.example` + 正确 docId → 按钮无 `btnDirty`
- relay origin + 错误 docId → 无 `btnDirty`
- relay origin + 正确 docId → 出现 `btnDirty`
