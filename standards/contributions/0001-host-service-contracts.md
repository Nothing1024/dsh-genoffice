# 供稿 0001：宿主服务契约的田野报告（→ RFC 0006 Host Services）

- **状态**：草拟，未提交。目标场馆：oh-my-dsh/dsh-community-standard 的 RFC 0006 征求意见。
- **来源**：dsh-genoffice 插件（`io.github.nothing1024.tab-genoffice`）——一个真实跑在 DSH 0.1.2-rc.1 上的双半身插件，host 半身消费四条宿主服务契约，全部以 x- 私有坐标 + branded facet 落地（`packages/tab-genoffice/src/standard/`）。

## 我们实测的四条契约

| 坐标（x- 私有） | kind | 上游候选归宿 | required? |
|---|---|---|---|
| `x-nothing1024.dsh.tools/v1alpha1` | ToolRegistry | 工具注册（RFC 0006 未列，建议新增） | required |
| `x-nothing1024.dsh.system-prompt/v1alpha1` | SystemPrompt | PromptSections | optional |
| `x-nothing1024.dsh.skills/v1alpha1` | SkillRegistry | skill 目录（建议新增） | optional |
| `x-nothing1024.dsh.web-server/v1alpha1` | WebServer | WebRoutes | optional |

句柄接口全文见 `packages/tab-genoffice/src/standard/coordinates.ts`；语义卡片见 `standards/registry/*.md`。

## 田野发现（建议进 RFC 正文）

1. **SDK 面应刻意小于宿主实现面。** 我们的 `SystemPromptHandle` 只有一个 `section()`、`SkillRegistryHandle` 只有一个 `register()`——宿主服务的其余表面积留在适配器后面。这让「换宿主」的成本从服务面收敛到适配器（本仓 `cordis-*.ts` 两个文件）。
2. **延迟绑定必须是一等语义。** DSH 的 webServer / 第三方 sidebar 都可能晚于插件激活到位。我们的解法是 `ServiceAcquire<S>`：`acquire(mount) → 卸载函数`，mount 被调用**零或一次**，零次即声明过的降级路径。协商是静态的，绑定是延迟的——RFC 0006 若只定义同步 getter，装不下这个现实。
3. **一切注册都返回卸载函数，停用按 LIFO 撤销。** 这是我们能通过「facet 停用后宿主零残留」测试（`tests/standard-facet.spec.ts`）的前提，建议 RFC 写成 MUST。
4. **工具命名的现实约束**：工具名实测受 DeepSeek API `^[a-zA-Z0-9_-]+$` 约束。ToolRegistry 契约若不规定命名字符集，同一插件在不同模型宿主上会出现「注册成功但调用失败」的静默断裂——这是 registry 设计的一手输入。

## 开放问题

- ToolRegistry 的工具定义 schema（参数 JSON Schema 方言、流式输出）是否进契约，还是留给 apiVersion 演进？
- 「插件供给插件」的契约（我们的 SidebarTab 由第三方 dsh-better-sidebar 提供）在 descriptor `capabilities` 里如何标注提供方？
