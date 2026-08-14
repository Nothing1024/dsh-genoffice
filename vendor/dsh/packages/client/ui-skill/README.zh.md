# @deepseek-ai/dsh-client-ui-skill

[English](README.md) | 中文

skill（技能）引用 source 的浏览器端：把 `/` 触发的 `skill` source 注册进 `ctx.slash`。普通会话的候选来自 `skill.list` RPC，以每次调用的 `ClientSessionContext` 投影中的 `{sessionId}` 寻址，host 从会话 header 解析 `cwd`。宿主返回模型可调用与用户可调用 skill 的交集，因为该浏览器路径插入的是模型引用，而不是直接加载正文。由目录寻址的可继续 subagent 在客户端解析为没有 skill 候选，因为现有 skill RPC 要求会话已挂载；查看其持久化历史不得激活它。目录按普通会话缓存，拉取走 single-flight；scope 创建时的 `warm` 钩子预热该会话的缓存项，`connection/reset` 清空全部缓存。结果按 `startsWith(query)` 过滤；pick 一个候选会把字面文本 `/name ` 经 slash 流水线落进草稿（决策 21 的纯文本引用），source 的 `codec` 拥有该引用的两种投影：`clipboardText` → `/name`，`serialize` → 提交时生成的模型形式 `<skill>name</skill>`。RPC 使用插件注册时捕获的根上下文连接——source 绝不从每次调用的参数上读取服务。source 不实现 `matchSpace`／`matchEnter` 钩子——skill 引用永不进入命令裁决，随普通提示词落入 default sink。

`skill.list` 失败时 `candidates` 抛出异常，slash 壳层记录日志并折叠为静默的菜单组丢弃——菜单只显示 pending／ready 状态。

`/client` 导出表层只有插件主体（`apply`／`inject`）；source 对象是注册 effect 的内部实现。

## 模型体验

### 用户提示词中的 skill 引用文本

#### 模型看到的内容

被 pick 的候选会把字面文本 `/name ` 落进草稿（决策 21：纯文本，无 `<skill>` 标签）；该文本原样进入普通用户消息（`session.prompt`）到达模型，没有专用内容块、提示词 section 或 host 侧展开。与实际 skill 的关联在模型侧建立且具有非确定性：会话前缀已携带 skill 目录（由 `dsh-tool-skill` 渲染），引用名称与目录条目匹配，正是这一点引导模型去加载它。

#### Token 影响

有条件且极小：只有 pick（或手动键入相同文本）会把引用的字符加进那一条用户消息。浏览菜单和拉取候选不会增加任何模型 token。

#### KV Cache 影响

仅追加：引用是追加在可复用历史前缀之后的新用户消息的一部分。该包绝不改写较早的请求 token。

## 已知限制与暂缓事项

- **skill 加载具有非确定性**：引用是协作线索，不是保证；模型可能忽略它。针对命中率不足情况的返工路径（host 侧 `context/skill-reference` 引导包，或全文注入）记录在设计台账中；协议中的文本形态不会改变。
- **首次击键可能与预热竞速**：scope 创建时的预热会启动目录拉取，但目录落定之前打开的菜单，在那次击键下不会显示 skill 候选。这是设计上接受的取舍：skill 引用不参与回车裁决，因此没有任何攸关正确性的环节等待目录。
- **文本是唯一依据**：引用是普通的草稿文本；手动键入的相同 token 就是同一个引用。chip 视觉由 lexicon 扫描派生；没有 occurrence 身份或位置跟踪（组件化 chip 是台账事项）。
