# x-nothing1024.dsh.sidebar-right/v1alpha1 # SidebarRight

官方右侧 Sidebar 的页类型 / 资源类型槽位（optional peer）。**提供方是官方** `@deepseek-ai/dsh-client-ui-sidebar-right`（随 `dsh-web-app@0.1.7-alpha.1` 装配），不再依赖第三方 `dsh-better-sidebar`。

- **SDK 面**：`SidebarAcquireHandle<OfficialSidebar>.acquire(mount) → 卸载函数`；服务面是 `sidebarRight` + `sidebarRightTabs` + `slots`（`src/standard/sidebar.ts`）。
- **延迟绑定**：web-app 的 client 服务可能晚于本插件激活，acquire 语义同 WebServer——mount 零或一次，零次即降级。
- **降级路径（BR-003）**：缺席时插件照常激活：无页签、无资源类型，工具与 relay 能力不受影响；`tests/standard-facet.spec.ts` 有专项断言。
- **消费方**：`src/standard/client.ts`（GenOffice 引导页、docx/xlsx/pptx 资源类型、SSE `EventSource` 监听）。
- **sensitivity = low**：UI 槽位注册，不触模型、不触网络面。
