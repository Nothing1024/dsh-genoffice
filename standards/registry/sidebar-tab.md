# x-nothing1024.better-sidebar/v1alpha1 # SidebarTab

better-sidebar 页签与 FileViewer 槽位（optional peer）。**提供方是第三方插件** `dsh-better-sidebar@0.13.0` 而非宿主本体——这类「插件供给插件」的契约正是社区 Registry 要解决的场景（部署级能力列入 descriptor `capabilities`，RFC 0003 定案前的过渡做法）。

- **SDK 面**：`SidebarAcquireHandle<S>.acquire(mount) → 卸载函数`；服务面 `S` 由消费方以 `dsh-better-sidebar` 的类型参数化，坐标层不引 UI 依赖（coordinates.ts）。
- **延迟绑定**：peer 插件可能晚于本插件激活，acquire 语义同 WebServer——mount 零或一次，零次即降级。
- **降级路径（BR-003）**：缺席时插件照常激活：无页签、无 FileViewer，工具与 relay 能力不受影响；`tests/standard-facet.spec.ts` 有专项断言。
- **消费方**：`src/standard/client.ts`（genoffice 页签、docx/xlsx/pptx FileViewer、SSE `EventSource` 监听）。
- **sensitivity = low**：UI 槽位注册，不触模型、不触网络面。
