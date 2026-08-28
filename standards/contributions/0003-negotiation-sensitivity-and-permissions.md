# 供稿 0003：sensitivity 档位与 permissions 语义（→ spec/negotiation.md + spec/manifest.md）

- **状态**：草拟，未提交。目标场馆：oh-my-dsh/dsh-community-standard 的 negotiation/manifest 规范讨论。
- **来源**：dsh-genoffice 插件的本地协商器实现（`standards/validate.mjs` 的 `negotiate` 纯函数）与五结局 fixture 集。

## 问题

v0.15 的协商报告里有 `pending-authorization` 结局，但**判定它的输入没有着落**：registry 条目缺一个敏感度词汇，宿主无从知道哪条契约需要授权。同时 manifest 有 `permissions` 字段但 scope 语义未定义，实现者只能各自发明。

## 建议一：registry 条目加 `sensitivity` 枚举

```
sensitivity ∈ { low, medium, high }
```

| 档位 | 语义 | 协商行为 |
|---|---|---|
| low | 纯展示/本地化 | 放行 |
| medium | 影响模型行为（工具/提示词）或宿主 loopback 网络面 | trusted-in-process 档位放行，列入审计 |
| high | 需用户或策略显式授权 | verdict = `pending-authorization`，坐标进 `awaitingAuthorization` |

关键判定规则（我们实现后才发现的坑）：**敏感检查只针对匹配成功的声明**——required 缺席已是 rejected、optional 缺席已是降级，人都不在，不需要授权。伪代码：

```
for c in requires.contracts:
  if c 不在 capabilities: (optional ? degradedOptional : missingRequired) << c; continue
  if registry[c].sensitivity == high: awaitingAuthorization << c
```

## 建议二：permissions = 环境能力 scope，与契约坐标分家

契约坐标描述宿主提供的**服务面**（可 publish/acquire、有句柄类型）；permissions 描述插件**自身行为**对环境的触达（网络、子进程），宿主没有对应服务对象。二者混进 requires 会让协商器把「行为授权」误判成「能力缺席 → 降级/拒载」。建议规范明确：

- permissions 不参与 compatible/rejected 判定，静态协商只负责**晒出清单**；
- 授权归 authorize 阶段（独立 RFC），拒授的效果是插件按自己声明的降级路径运行，而非拒载；
- scope 命名沿用坐标的命名空间纪律（未标准化的用 `x-` 前缀）。

我们实测的两个 scope 及其降级路径见 `standards/registry/permissions.md`（loopback-fetch → 降级横幅 + 手动入口；process.spawn → 手动命令提示）。

## 可捐赠的一致性材料

- 五结局协商 fixtures（`standards/fixtures/negotiation/`）：compatible / degraded-optional / rejected-missing-required / rejected-unsupported-facet / pending-authorization，各含 manifest × descriptor × registry × expected-report 四件套，深比较即可跑；
- `negotiate` 参考实现（纯函数，约 50 行，零依赖）。

## 开放问题

- `high` 授权的粒度：按坐标一次性授权，还是按 (插件, 坐标) 对？
- 报告的 `message` 是否应标准化为结构化字段（当前是人类可读散文，本地化困难）？
