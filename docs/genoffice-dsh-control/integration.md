# GenOffice 原生集成（DSH 控制模式）

> 目标（genoffice-dsh-control）：DSH agent 通过 `docx_*`/`markdown_*` 工具直接驱动
> GenOffice 网页版内的文档编辑器——AI 大脑归 DSH，GenOffice 编辑器是执行面。
> 本文是**集成视角**的说明（架构、启动、使用、集成点、排障）；需求合同以
> `spec.md` 为准，接口形状以 `contracts/control-api.md` 为准。

## 1. 这是什么

原生集成 = 在 GenOffice 网页版（docs/markdown app）内部植入**控制适配器**，由 relay
控制面把 DSH 侧的工具调用转译为编辑器内的真实操作（Tiptap dispatch / `executeTool`），
并支持把编辑结果**显式写回原文件**。控制模式下 GenOffice 内嵌 AI 助手整体隐藏
（AI 大脑归 DSH）。

```
DSH agent ── docx_*/markdown_* 工具 ──► 插件 host（tab-genoffice）
   │                                        │ POST /api/control/<app>/<docId>/{tool,context,export}
   ▼                                        ▼
relay :8787 控制面（注册表 + SSE 下行 + notify 上行 + tmp+rename 原子写回）
   │ SSE（EventSource）                     │ POST /api/file（写回）
   ▼                                        ▼
iframe 内 docs/markdown app ── 控制适配器（control.ts）──► Tiptap 编辑器
   （control=1，无 AI dock）
```

## 2. 组件与集成点

| 组件 | 位置 | 职责 | 镜像点（INV-004） |
|---|---|---|---|
| 控制契约 | `contracts/control-api.md` | 端点/SSE 消息/工具名集合/安全边界 | 唯一事实源 |
| relay 控制面 | `upstream/web/server.mjs` | 执行器注册表（docId→SSE 连接）、context/tool/export 转发、`POST /api/file` 原子写回、loopback 边界 | `handleApi` 控制面段 |
| docs 控制适配器 | `upstream/apps/docs/src/renderer/control.ts` | `control=1` 解析、EventSource 注册/注销、tool/context/export 事件处理、`buildDocBytes` 导出 | `CONTROL_MODE`/`CONTROL_PATH` |
| markdown 控制适配器 | `upstream/apps/markdown/src/renderer/control.ts` | 同上（markdown 版执行器） | 同上 |
| AI 隐藏 | 两 app `App.tsx` + `components/Ribbon.tsx` | `control=1` 时不渲染 AI dock / Genspark AI 按钮 / AI 快捷按钮 | `hideAi` prop |
| 插件 host 工具 | `../plugin/dsh-genoffice/plugin/packages/tab-genoffice/src/host/{tool-schema,tools}.ts` | `docx_*`/`markdown_*` 等控制工具、relay 调用 | 工具名集合（smoke 断言） |
| 插件 tab | `../plugin/dsh-genoffice/plugin/packages/tab-genoffice/src/tabs/genoffice.tsx` | 预览 URL 带 `control=1`、「写入磁盘」 | `PREVIEWABLE` |
| smoke | `scripts/dev.mjs` | 控制面端点形状 + 工具名集合镜像断言 | 第 8/9 节断言 |

## 3. 启动与前置

```sh
cd ~/workspace/dsh/genoffice
node scripts/dev.mjs start-relay
node scripts/dev.mjs status             # relay :8787；dsh 默认 :3080
node scripts/dev.mjs smoke

npx --yes @deepseek-ai/dsh web          # 日常官方 GUI，不要再用 wt-artifact / :3099
```

构建：改 app 后 `cd upstream && npm run web`；改插件后 `cd ../plugin/dsh-genoffice/plugin && pnpm run build`，然后重启 DSH（rev 缓存）。

## 4. 用户工作流

1. **打开**：GenOffice tab 文件浏览点击 docx/md，或点击聊天/文档里渲染的本地路径链接（`dsh:open-local-file` 事件联动）→ iframe 以 `?control=1&open=path:<enc>` 打开，进入控制模式（无 AI 元素），工具栏出现「写入磁盘」。
2. **编辑**：对 DSH agent 下指令（"把第 3 章改成表格"）；或直接在 iframe 内手动编辑。
3. **落盘（显式写回）**：点「写入磁盘」按钮，或让 agent 调 `docx_save`/`markdown_save`——两者都经 relay 原子写回原路径（tmp+rename，mtime 冲突保护）。

> 编辑工具只改 iframe 内状态，**不落盘**（BR-008）；写回仅由显式动作触发。

## 5. DSH agent 工作流（工具）

16 个工具：`docx_get_document_context / read_blocks / insert_content / replace_blocks /
apply_commands / web_search / image_search / insert_image / insert_chart / edit_chart / save`
（11）+ `markdown_get_document_context / read_blocks / insert_content / replace_blocks / save`
（5）。每个工具都带 `path`（目标文件绝对路径）参数；`docId = sha256(path)`。

典型链：`docx_get_document_context`（块索引）→ `docx_read_blocks`（读原文）→
`docx_replace_blocks {startBlockIndex, endBlockIndex, html}`（改写）→ `docx_save`。

错误语义（模型可见 isError）：`executor not registered` → "请先在 GenOffice tab 打开该文档"；
`invalid input`；`timeout`（不重放）；`conflict`（"文件已被外部修改，未覆盖"）。

> 工具名用 `_` 而非 `:` 前缀（DeepSeek API 工具名 pattern 限制，见契约 §4 注）。

## 6. 安全边界（INV-002/003/006）

- 控制面与写回默认仅 loopback（`ALLOW_ABS_PATHS` 语义 + 请求级 Host/远端校验），伪造 Host → 403；
- 写回 tmp+rename 原子，任何失败不改变原文件字节；`expectedMtimeMs` 不匹配 → `conflict` 拒绝；
- iframe sandbox 保持 `allow-scripts allow-same-origin allow-downloads`（控制通道只走 HTTP）。

## 7. 故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| 保存报 mtime 冲突 | 文件在 iframe 打开后被外部修改（含测试重置 fixture） | 重新打开文档（丢弃未保存编辑）后再保存；这是预期保护 |
| 工具报"文档尚未打开" | 执行器未注册（未打开 / 已切换文档 / relay 重启后未重连） | 重新打开文档；EventSource 会在可见时自动重连 |
| iframe 反复"stream error" | 同一 docId 存在多个 control 页面互相抢占注册表 | 关闭多余页面；同 tab 内重开已由卸载逻辑防止 |
| 保存提示超时 | SSE 断线 / iframe 卡死，host deadline（70s）兜底 | 刷新 tab 后重试；调用不会被重放 |
| 改 bundle 后行为不变 | rev 缓存 | 重启 3099 / relay 实例 |

## 8. 契约与镜像纪律（INV-004）

`contracts/control-api.md` 是控制契约唯一事实源；四处镜像点（app 适配器 / `server.mjs` /
插件 host 工具 / `scripts/dev.mjs`）各自独立声明，`node scripts/dev.mjs smoke` 断言端点形状与
工具名集合三向一致。改接口顺序：先改契约 → 同步两侧源码（标注 `INV-004`）→ 跑 smoke。

## 9. 范围与后续

- **M0（本目标）**：docs/markdown 控制编辑 + 显式写回 + 无 AI 模式；单文档单会话。
- **M1-M3（另立项）**：sheets/slides/pdf 走同一控制契约（契约已预留 `app` 维度
  `/api/control/<app>/<docId>/…`）；多文档并发；AI 编辑 diff/回滚评审面板。
- 非目标：构建裁剪摘除 AI 依赖（仅运行时隐藏）；桌面版（Electron）行为不变。
