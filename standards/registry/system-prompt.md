# x-nothing1024.dsh.system-prompt/v1alpha1 # SystemPrompt

系统提示词分段注入（optional）。向模型解释 GenOffice 运行时的存在与使用方式。

- **提供方**：DSH 宿主 `ctx.systemPrompt`（`@deepseek-ai/dsh-system-prompt`）。
- **SDK 面**：`SystemPromptHandle.section({ name, order, text }) → 卸载函数`（coordinates.ts）。
- **生命周期**：section 返回卸载函数；停用时 LIFO 撤销。
- **降级路径**：缺席时跳过注入，工具照常注册——模型少一段引导文案，功能仍可被工具描述发现。
- **消费方**：`src/standard/host.ts`（注入 `src/host/prompt.ts` 的 `PROMPT_SECTION`）。
- **sensitivity = medium**：提示词注入面直接塑造模型行为，与 ToolRegistry 同档；trusted-in-process 下静态放行，进审计清单。
