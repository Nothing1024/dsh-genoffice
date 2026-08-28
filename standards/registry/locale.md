# x-nothing1024.dsh.locale/v1alpha1 # Locale

客户端词典注册与翻译绑定（client facet 的 required）。v0.15 中 `client` 是保留 facet 名，本坐标**暂不进 manifest**——client facet 主体（`src/standard/client.ts`）经适配器在官方 client bundle 内执行，坐标先在本注册表备案。

- **提供方**：DSH 客户端运行时 `ctx.locale`（`@deepseek-ai/dsh-client-locale`）。
- **SDK 面**：`LocaleHandle.bind(ns) → 翻译函数`、`register(ns, dicts) → 卸载函数`（coordinates.ts）。
- **生命周期**：register 返回卸载函数；client facet 停用时 LIFO 撤销。
- **降级路径**：无——client 运行时必带 locale，故列为 client 半身 required（`CLIENT_REQUIRED`）。
- **消费方**：`src/standard/client.ts`（`common` / `settings.locale` / `tabs.genoffice` 三个命名空间）。
- **sensitivity = low**：纯 UI 词典，不触模型、不触网络。
