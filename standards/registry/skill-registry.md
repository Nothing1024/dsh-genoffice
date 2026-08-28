# x-nothing1024.dsh.skills/v1alpha1 # SkillRegistry

运行时 skill 目录注册（optional）。把 GenOffice 控制编辑的操作手册注册为按需装载的 skill。

- **提供方**：DSH 宿主 skills 服务。
- **SDK 面**：`SkillRegistryHandle.register({ name, description, content, source }) → 卸载函数`（coordinates.ts）。
- **生命周期**：register 返回卸载函数；停用时 LIFO 撤销。
- **降级路径**：缺席时跳过注册——系统提示词段（SystemPrompt）仍在，模型少一份深度手册。
- **消费方**：`src/standard/host.ts`（注册 `src/host/skill.ts` 的 genoffice 运行时 skill）。
- **sensitivity = low**：skill 内容按需进入上下文、由模型主动拉取，非常驻注入面；比 SystemPrompt 被动一档。
