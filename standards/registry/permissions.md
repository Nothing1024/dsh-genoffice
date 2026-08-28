# permissions —— 契约坐标之外的敏感环境能力

manifest `permissions` 声明的是**环境能力 scope**，不是契约坐标：没有服务面、没有 acquire/publish，只有「插件运行中会做这件事」的事前告知。授权归 authorize 阶段（上游 RFC 未定案），静态协商只负责把它们晒出来（validate.mjs 在协商环节打印 permissions 清单）。本文件是两个 x- scope 的语义定义；命名空间纪律与契约坐标一致（x- 前缀、不伪装标准 scope）。

## `x-nothing1024.net.loopback-fetch`

- **语义**：向本机 loopback 端口发起 HTTP(S) 请求。本插件用于 host 半身探活/代理 GenOffice relay（`127.0.0.1:8787`）。
- **边界**：仅 loopback；不含任意外网 fetch（那应是另一个更敏感的 scope）。
- **缺席/拒授的降级**：relay 探活失败按既有降级路径走——面板与视图显示降级横幅、提供「启动 relay」入口。
- **对应实现**：`src/host/capability.ts`（host 半身探活/控制调用）、`src/tabs/relay.ts`（client 半身）。

## `x-nothing1024.process.spawn`

- **语义**：拉起本机子进程。本插件用于「启动 relay」路由 spawn GenOffice relay 进程。
- **边界**：spawn 的命令由插件自身携带（`scripts/dev.mjs` 生态内），不代执行会话输入。
- **缺席/拒授的降级**：路由返回失败提示，面板转为手动命令提示（复制 `node scripts/dev.mjs up` 一类）。
- **对应实现**：`src/host/relay-launch.ts`。

## 为什么不做成契约坐标

契约坐标描述**宿主提供的服务面**（可 publish/acquire、有句柄类型）；这两项是插件**自身行为**对环境的触达，宿主没有对应服务对象可提供。把它们塞进 requires 会让协商器把「行为授权」误判成「能力缺席→降级/拒载」。上游 manifest.md 的 permissions 字段语义与此一致（详细论证见 contributions/0003）。
