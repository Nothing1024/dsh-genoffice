# UF-001 失败分支：编辑器未就绪（fail-notready）

## 实测说明（时序）

- 触发窗口极短：文档字节加载 → 解析 → 编辑器挂载在亚秒级完成（fixture 220B / 2KB），
  浏览器实景中无法稳定命中「已打开文档但 editor 尚未挂载」的窗口。
- 该分支的实现路径（适配器代码，两 app 一致）：

  ```ts
  const editor = opts.getEditor()
  if (!editor) {
    await notify(docId, 'tool-result', requestId, errorExecution('editor not ready', call.name))
    return
  }
  ```

  → relay 侧返回 `{ok:true, execution:{output:'editor not ready', isError:true, ...}}`
  → host 工具映射为 isError（模型可见），文档不被修改。

- 等价 API 层验证：markdown skill 的 `createMarkdownSkill` 对 `getEditor() === null` 同样
  返回 `{output: 'editor not ready', isError: true}`（upstream 既有行为，spec 2.3 失败分支一致）；
  relay tool 端点对未注册 docId 返回 `executor not registered`（fail-unregistered 已覆盖相邻语义）。

## 结论

分支已实现且不可崩溃；真实加载窗口过短无法稳定截图，以时序说明 + 代码路径 + 相邻语义 API 验证覆盖。
