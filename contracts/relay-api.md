# relay HTTP API 契约

权威实现：`upstream/web/server.mjs`（Node ≥ 22，零依赖）。默认只绑 loopback（`127.0.0.1:8787`）；以 `HOST=0.0.0.0` 暴露到网络时，绝对路径读必须显式 `GENOFFICE_WEB_OPEN_PATHS=1`。

## 通用规则

- 所有响应 `Content-Type: application/json`。业务失败**通常** `200 + {ok:false, error}`；参数缺失/路径越界/未知路由用 400/403/404，`/api/inject` 超限为 413（见各端点）。
- 文件类端点统一 50MB 上限（`/api/fetch-image` 为 20MB）。
- CORS：仅回显 loopback origin（`http://localhost:*` / `http://127.0.0.1:*` / `http://[::1]:*`），不做 `*` 通配、不回显外部 origin。DSH GUI（`127.0.0.1:3080`）跨域调 `/api/*` 靠这个。
- 静态托管：`/` 与 `/docs/`、`/markdown/` 等按 `apps/<app>/web-dist` 是否存在路由；裸 `/` 落到第一个已构建的 app。

## 端点

### GET /api/health
```json
{ "ok": true, "name": "genoffice-web-relay", "port": 8787, "live": true, "ready": true, "roots": ["shell", "docs"], "claimed": ["shell", "docs", "markdown", "pdf", "sheets", "slides", "html"], "apps": { "docs": { "build": true, "ready": true, "missing": [] } }, "executors": 0 }
```
- `ok` / `live` 表示 API 进程存活。`ready` 表示**全部宣称 app** 的 `web-dist/index.html` 可读；缺一个 app 时 `ready` 为 false，但其他已构建 app 仍可用。
- `roots` 是当前可读的静态根；`apps` / `claimed` 是每次请求现算的每 app 构建状态。`roots.length === 0` 才是僵尸实例（应重启 relay）。旧客户端勿把 `ready:false` 当成进程已死。
- `executors` = 当前控制面 SSE 执行器数（contracts/control-api.md §2.1 的注册表大小）。
- 旧 relay 无 `live` / `apps` / `claimed`；消费方按「缺字段视为有静态根」向后兼容。

### GET|POST /api/discovery  — 版本化按族能力（别名 `/api/capabilities`）
查询或 JSON 正文：`family` / `app` / `ext`、`mode=family|compatible`、`schema_revision`、`protocol_version`。头：`X-GenOffice-Schema-Revision`、`X-GenOffice-Family`、`X-GenOffice-Protocol`。
```json
{
  "ok": true,
  "protocol": "genoffice-control",
  "protocol_version": "1.0.0",
  "schema_revision": "2026.09.1",
  "supported_schema_revisions": ["2026.09.1"],
  "mode": "family",
  "family": "sheets",
  "state": "family-loaded",
  "ready": true,
  "families": { "sheets": { "app": "sheets", "aliases": ["sheets", "xlsx"], "ready": true } },
  "public": [{ "name": "discovery", "path": "/api/discovery" }, { "name": "xlsx_open" }],
  "tools": [{ "name": "xlsx_get_workbook_context", "skillName": "get_workbook_context", "app": "sheets", "parameters": {}, "write": false }],
  "schema_bytes": 12345,
  "tool_count": 13,
  "refresh": { "url": "/api/discovery?family=sheets" }
}
```
- 无 family：`mode=compatible`，完整 100 工具表（旧宿主）。
- 未知族：`404 {ok:false, error:'family-unsupported', tools:[]}`，不回落其他 app。
- 不受支持的 schema/protocol：`409`，`tools:[]`，`refresh` 指向本入口。
- 该族 `web-dist` 缺失：`200` + `state=dependency-missing` + 该族真实 schema。
- 客户端在 `/api/control/<app>/<docId>/tool` 或 `/export` 声明错版本/错族时，写操作 `409` 且不转发执行器；缺头的旧客户端保持原行为。
- 单源：`upstream/web/capability-manifest.json`（由插件 CONTROL_TOOL_TABLE + CAPABILITY 生成）。


### GET /api/dir?path=  — 目录列表（DSH 插件文件浏览）
`path` 缺省 = 用户主目录。符号链接**只标记不跟随**（`symlink: true` 且不视为目录）；不可读路径返回 `ok:false` 而非 500。
```json
{
  "ok": true,
  "path": "/Users/nothing", "parent": "/Users",
  "entries": [
    { "name": "notes.md", "dir": false, "hidden": false, "symlink": false,
      "size": 1234, "mtimeMs": 1723000000000, "ext": "md" }
  ]
}
```
- 目录行无 `size/mtimeMs/ext`；`hidden` = 点前缀；排序：隐藏最后 → 目录优先 → 名称。
- 安全：绝对路径读默认仅 loopback——内部常量 `ALLOW_ABS_PATHS` 在 HOST 为 loopback（`127.0.0.1`/`localhost`/`::1`）或显式设 `GENOFFICE_WEB_OPEN_PATHS=1` 时为真（环境变量名只有后者）。

### GET /api/file?path=  — 读绝对路径（`path:` open 形态的后端）
```json
{ "ok": true, "base64": "<bytes>", "mime": "application/octet-stream", "name": "a.docx", "mtimeMs": 1723000000000 }
```
`mtimeMs` 为读取时文件的 mtime（控制模式写回冲突校验的基线，INV-004 镜像点：`apps/*/renderer/control.ts` 与 `contracts/control-api.md` §2.5）。

### POST /api/file  — 写回（控制模式显式保存，BR-004/BR-005；详细契约见 contracts/control-api.md §2.5，INV-004 镜像点：`server.mjs` / `tab-genoffice/src/host/*`）
入参：`{ "path": "/abs/path/a.docx", "base64": "<bytes>", "expectedMtimeMs": 1723000000000 }`
- 仅 loopback 来源（`ALLOW_ABS_PATHS` 语义 + 请求级 Host/远端地址校验），否则 `403 {ok:false, error:'loopback only'}`。
- 原子写：同目录 `tmp` + `rename`；任何失败不改变原文件字节（INV-003）。
- `expectedMtimeMs` 不匹配 → `200 {ok:false, error:'conflict'}`，原文件不变（外部修改冲突分支）。
- 成功：`200 { "ok": true, "path": "/abs/path/a.docx", "mtimeMs": 1723000000000 }`（`mtimeMs` = 写后 `stat`）；字节上限 50MB。本端点不推送 `saved`。

### POST /api/inject  +  GET /api/inject/<token>  — 字节注入（`inject:` open 形态）
POST 请求体 = 原始字节，头 `X-File-Name`（URI 编码）；返回 `{ok, token, name}`。token 一次性，TTL 30 分钟（5 分钟扫描）。
```json
{ "ok": true, "token": "<uuid>", "name": "a.docx" }
```
GET 消费后立即失效：`{ "ok": true, "base64": "<bytes>", "name": "a.docx" }`，404 = 不存在/已过期。

### GET /api/files?path=  — 服务端白名单读（默认关闭）
仅当 `GENOFFICE_WEB_FILES_ROOT` 设置时可用；`path` 相对该根，越界 403。响应同 `/api/file`。

### GET /api/fetch-file?url=  — 远程文件代理（`https://` open 形态）
```json
{ "ok": true, "base64": "<bytes>", "mime": "…", "name": "remote.docx" }
```

### POST /api/search/web | /api/search/image | /api/fetch-image
- `/api/search/web` `{query, maxResults}` → `{results:[{title,url,snippet}], method:"duckduckgo"|"bing"|"error"}`（DDG 被限流自动降级 Bing）
- `/api/search/image` `{query, maxResults}` → `{images:[{title,imageUrl,sourceUrl,source,width,height}], method:"bing"}`
- `/api/fetch-image` `{url}` → `{base64, mime}`（20MB 上限）

### GET /api/open/stream  — 本机打开订阅（SSE）
仅 loopback。立即发送 `event: hello` / `data: {}`，每 25s `ping`。下行 `file` 事件：

```json
{ "path": "/abs/path/a.xlsx", "sessionId": "optional-dsh-session" }
```

`sessionId` 仅在 `POST /api/open` 传入时出现，用来把打开请求钉在发起页的 DSH session（避免落到另一页的前台 session）。

### POST /api/open  — 向订阅者广播打开本机文件
入参：`{ "path": "/abs/path/a.xlsx", "sessionId"?: string }`
- 仅 loopback；路径必须绝对；`stat` 失败 → `200 {ok:false, error:'file not found'}`。
- 成功：`200 {ok:true, path, subscribers}`，并向所有 `/api/open/stream` 连接写 `file` 事件。`subscribers` 为当前 `/api/open/stream` 连接数；为 `0` 时插件 `*_open` 立即失败（见 `contracts/control-api.md` §5）。
- **不**报告控制执行器是否已登记——那是 `POST /api/control/open` 的 `registered` 字段（见 `contracts/control-api.md` §2.7）。

### GET /api/gsk-status | POST /api/generate-image | POST /api/analyze-media
Genspark 能力由 **relay 代跑**（gsk CLI 或 `tool_cli` HTTP），浏览器不直连 genspark.ai。
- `/api/gsk-status` → `{available: boolean}`（`GSK_API_KEY` 或 `~/.genspark-tool-cli/config.json`）
- `/api/generate-image` `{prompt, model?, referenceImageUrls?, aspectRatio?, imageSize?}` → `{url}` 或 `{error}`
- `/api/analyze-media` `{mediaUrls, requirements}` → `{text}` 或 `{error}`

## `?open=` target 形态（docs/markdown app 的 URL 打开协议）

`/docs/?open=<target>` 与 `/markdown/?open=<target>`（别名 `?file=`；RESTful 形态 `/docs/f/<base64url>`）。

| target | 含义 | 取字节路径 |
|---|---|---|
| `path:<abs>` | 本机绝对路径（DSH 插件 iframe 用） | `GET /api/file?path=` |
| `inject:<token>` | CLI/服务注入的一次性字节（`web/open.mjs` 用） | `GET /api/inject/<token>` |
| `server:<rel>` | relay 主机白名单根内文件 | `GET /api/files?path=` |
| `https://…` | 远程文件 | `GET /api/fetch-file?url=` |
| `data:…` | 内联字节 | 浏览器本地解码 |
| `/webdoc/<id>/<name>` | IndexedDB 本地记录（拖拽/最近文件） | 浏览器本地 |

**扩展名 → app 映射**（插件面板 `PREVIEWABLE` 与 `open.mjs` 的 `APP_BY_EXT` 必须与此一致）：

| 扩展名 | app 路径 | 说明 |
|---|---|---|
| `docx` | `/docs/?open=path:<enc>` | AI Docs |
| `md`（含 `markdown`） | `/markdown/?open=path:<enc>` | AI Markdown |
| `xlsx` | `/sheets/?open=path:<enc>` | AI Sheets |
| `pptx` | `/slides/?open=path:<enc>` | AI Slides |
| `pdf` | `/pdf/?open=path:<enc>` | AI PDF |
| `mdx` | — | tab 不预览；内测渲染器补丁已删 |

路径需 `encodeURIComponent` 后放入 `path:` 之后整体再编码进 URL。

**镜像点**（改完跑 `node scripts/dev.mjs smoke`）：
- `PREVIEWABLE`（`../plugin/dsh-genoffice/plugin/packages/tab-genoffice/src/tabs/genoffice.tsx`）
- `APP_BY_EXT`（`upstream/web/open.mjs`）
- 内测 `LOCAL_FILE_EXTS` 补丁已删
