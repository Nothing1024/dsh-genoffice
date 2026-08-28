# 供稿 0002：client facet 的田野报告（→ RFC 0002 Runtime Presentation）

- **状态**：草拟，未提交。目标场馆：oh-my-dsh/dsh-community-standard 的 RFC 0002 征求意见。
- **来源**：dsh-genoffice 插件。RFC 0001 §1 说 12 个样本里 9 个双 face——本插件即其一：host 半身注册工具/路由/提示词，client 半身渲染侧栏页签与 docx/xlsx/pptx 预览。

## 我们在保留名约束下做了什么

v0.15 把 `client` 定为保留 facet 名不可声明。我们没有等：client 半身照样写成 **branded facet**（`src/standard/client.ts`，defineFacet 默认导出、只消费 FacetActivation、零上游 import），由 45 行适配器（`cordis-client-adapter.ts`）在官方 client bundle 内执行。RFC 0002 定案之日，manifest 加三行 `facets.client` 即可，主体代码零改动。这证明 **client facet 与 host facet 可以共用同一套 facet-api**（extensions/scope/contracts 三面），RFC 0002 不必发明第二套模型。

## 实测需要的两条 client 契约

| 坐标（x- 私有） | kind | 语义 | required? |
|---|---|---|---|
| `x-nothing1024.dsh.locale/v1alpha1` | Locale | 词典注册 + 翻译绑定 | required |
| `x-nothing1024.better-sidebar/v1alpha1` | SidebarTab | 页签/FileViewer 槽位（第三方 peer 提供） | optional |

## 田野发现（建议进 RFC 正文）

1. **client 侧的 optional 降级与 host 侧同构。** sidebar 缺席时插件必须照常激活（无页签、能力不残缺崩溃）——我们的 BR-003 断言在 `tests/standard-facet.spec.ts`。RFC 0002 的协商报告应复用 v0.15 的 `degradedOptional`，不要为 client 另设词汇。
2. **发现机制应统一进 manifest。** 现状是 client 入口靠 `package.json` 的 `dsh.client` 字段发现，与 manifest 的 facets 表两套账。建议 RFC 0002 直接用 `facets.client = { entry, apiVersion }`，废弃旁路发现。
3. **client 契约的提供方可能是 peer 插件**（我们的 SidebarTab 来自 dsh-better-sidebar@0.13.0）。激活顺序不可控，因此 client SDK 也需要 acquire 形态的延迟绑定（同供稿 0001 第 2 条）——这在 UI 场景比 host 场景更常见。
4. **UI 槽位与 contributes.views 的边界**：第三方槽位（非官方 location 枚举）走契约坐标而非 contributes，两机制不冲突——contributes 是静态声明给宿主 UI 读，契约是运行时服务面。

## 开放问题

- client facet 的执行环境（浏览器 bundle）如何表达在 host descriptor 的 `execution` 里？
- SSE/EventSource 一类长连接资源是否需要标准化的生命周期钩子（我们目前在卸载函数里手动 close）？
