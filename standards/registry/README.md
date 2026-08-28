# standards/registry/ —— x- 私有契约的本地注册表镜像

上游 dsh-community-standard 的 Registry 尚未开放登记，本目录以上游条目的形状先行维护**本仓声明的六条 x- 契约**。每条 = 一份机器可读 JSON（`validate.mjs` 的协商环节会加载为 registry 快照）+ 一份人类可读 md（服务面、生命周期、降级路径、敏感级别理由）。

**单一事实源分工**（INV-004）：坐标常量与句柄 TypeScript 接口在 `packages/tab-genoffice/src/standard/coordinates.ts`；本目录管机器可读元数据（sensitivity 等）与散文语义；manifest `requires` 与 descriptor `capabilities` 是它们的镜像，由 `validate.mjs` 与 `tests/standard-facet.spec.ts` 看住。

## 条目字段

| 字段 | 语义 |
|---|---|
| `apiVersion` / `kind` | 契约坐标（与 coordinates.ts 逐字一致） |
| `facet` | 消费坐标的半身（host / client） |
| `status` | `x-private`：私有命名空间，未经社区 Registry 登记，不伪装标准坐标 |
| `owner` | 坐标命名空间的持有者 |
| `sensitivity` | 见下表；协商器（validate.mjs `negotiate`）只对 `high` 特判 |
| `doc` | 同名 md 的相对路径 |
| `upstreamCounterpart` | 上游 RFC 里的对应物/候选归宿 |

## sensitivity 档位

| 档位 | 语义 | 协商行为 |
|---|---|---|
| `low` | 纯展示/本地化等，激活即用 | 直接放行 |
| `medium` | 影响模型行为（工具/提示词）或宿主网络面；审计清单可见 | v0.15 唯一执行档位 trusted-in-process 下静态放行（能力声明用于兼容判断与审计，不构成安全边界，见 host-descriptor $comment） |
| `high` | 需要用户或策略显式授权才能激活 | verdict = `pending-authorization`，`awaitingAuthorization` 列出坐标 |

本仓六条目前无 `high`：真正敏感的是**环境能力**（loopback fetch、子进程 spawn），它们不是契约坐标，走 manifest `permissions` 声明（见 [permissions.md](./permissions.md)），授权归 authorize 阶段、超出静态协商。`high` 路径由 `fixtures/negotiation/pending-authorization/` 看住。

## 条目清单

| 坐标 | kind | facet | sensitivity |
|---|---|---|---|
| `x-nothing1024.dsh.tools/v1alpha1` | ToolRegistry | host | medium |
| `x-nothing1024.dsh.system-prompt/v1alpha1` | SystemPrompt | host | medium |
| `x-nothing1024.dsh.skills/v1alpha1` | SkillRegistry | host | low |
| `x-nothing1024.dsh.web-server/v1alpha1` | WebServer | host | medium |
| `x-nothing1024.dsh.locale/v1alpha1` | Locale | client | low |
| `x-nothing1024.better-sidebar/v1alpha1` | SidebarTab | client | low |
