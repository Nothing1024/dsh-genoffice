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
{ "ok": true, "name": "genoffice-web-relay", "port": 8787 }
```

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
- 成功：`200 { "ok": true, "path": "/abs/path/a.docx" }`；字节上限 50MB。

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
| `mdx` | — | tab 不预览；内测渲染器补丁已删 |
| 其余（xlsx/pptx/pdf/…） | — | 仅桌面版可用，列表置灰 |

路径需 `encodeURIComponent` 后放入 `path:` 之后整体再编码进 URL。

**镜像点**（改完跑 `node scripts/dev.mjs smoke`）：
- `PREVIEWABLE`（`../plugin/dsh-genoffice/plugin/packages/tab-genoffice/src/tabs/genoffice.tsx`）
- `APP_BY_EXT`（`upstream/web/open.mjs`）
- 内测 `LOCAL_FILE_EXTS` 补丁已删
