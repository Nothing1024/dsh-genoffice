# x-nothing1024.dsh.tools/v1alpha1 # ToolRegistry

LLM 工具注册。host facet 的**唯一 required** 契约——工具是 GenOffice 控制编辑的核心通道，缺席即拒载（无降级路径）。

- **提供方**：DSH 宿主 `ctx.tools`（`@deepseek-ai/dsh-tools` 的 defineTool 生态）。
- **SDK 面**：无独立句柄——工具经 `extensions.publish(TOOL_REGISTRY, 工具名, 定义)` 发布（facet-api 的发布原语），适配器（`cordis-host-adapter.ts`）把 publish 映射到 `ctx.tools.register`。
- **生命周期**：publish 返回卸载函数；facet 停用时按 LIFO 撤销全部工具。
- **命名约束（实测）**：工具名受 DeepSeek API `^[a-zA-Z0-9_-]+$` 约束——这是社区 registry 设计的一手输入（见 contributions/0001）。
- **消费方**：`src/standard/host.ts`（发布 `src/host/tools.ts` 的控制/打开工具集）。
- **sensitivity = medium**：发布进模型工具面、直接影响 agent 行为；trusted-in-process 档位下静态放行，进审计清单。不是 high：工具执行由 agent 循环与用户可见性中介，真正的环境能力（loopback fetch、spawn）另走 permissions 授权。
