# x-nothing1024.dsh.web-server/v1alpha1 # WebServer

宿主 loopback HTTP 路由注册（optional）。承载 relay 拉起路由、同步窗口路由与图片资产通道。

- **提供方**：DSH 宿主 `ctx.webServer`（`@deepseek-ai/dsh-host-webserver`）。
- **SDK 面**：`WebServerHandle.acquire(mount) → 卸载函数`，服务面 `WebServerLike`（`host`/`port`/`register({kind, path, handler}) → 卸载函数`），见 coordinates.ts。
- **延迟绑定**：webServer 可能晚于插件激活到位，因此只有 acquire 形态——mount 在服务可用时被调用零或一次，零次即降级路径（`ServiceAcquire` 语义）。
- **生命周期**：acquire 与 mount 返回的卸载函数都能撤销挂载；停用时 LIFO 撤销。
- **降级路径**：缺席时「启动 relay」路由与同步窗口路由不注册，面板隐藏对应入口、sync 走兜底（`src/host/lookup.ts` 注入 PENDING 的既有行为）。
- **消费方**：`src/standard/host.ts`（`SYNC_ROUTE`、`RELAY_LAUNCH_ROUTE`、`ASSET_PREFIX` 三组路由）。
- **sensitivity = medium**：在宿主 loopback HTTP 面上开路由，扩大本机攻击面；但仅 loopback、不越出主机，真正的进程拉起走 `x-nothing1024.process.spawn` 权限（见 permissions.md）。
