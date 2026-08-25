---
name: genoffice-preview
description: Use when the user asks to preview, open, view, or quickly edit a local document (.docx / .md) in the browser via GenOffice 网页版 — e.g. "预览这个文件", "用 genoffice 打开 xxx.docx", "快速查看这个文档". Starts the GenOffice web relay if needed and opens the file in the matching editor.
---

# GenOffice 网页版快速预览 / 编辑

把本地文件（`.docx` / `.md`）快速传递到 GenOffice 网页版（http://localhost:8787）在浏览器中预览或编辑。

## 前置

- GenOffice 产品仓在 `/Users/nothing/workspace/dsh/plugin/dsh-genoffice/plugin`（兼容入口 `/Users/nothing/workspace/dsh/genoffice`；魔改上游在并列的 `../upstream`）
- 需要 Node ≥ 22（零依赖，无需构建即可跑 relay；首次使用前若 `upstream/apps/*/web-dist` 不存在，需先 `npm run web` 构建一次）
- 浏览器建议 Chrome / Edge（File System Access API 完整支持）

## 步骤

### 1. 确认/启动 relay

```bash
node /Users/nothing/workspace/dsh/genoffice/scripts/dev.mjs start-relay
```

（等价于手工 `curl -s http://localhost:8787/api/health`，不在则
`cd /Users/nothing/workspace/dsh/plugin/dsh-genoffice/upstream && node web/server.mjs`。）

### 2. 打开文件（任选一种）

**方式 A — CLI 注入（最稳，不依赖路径读取开关）：**

```bash
node /Users/nothing/workspace/dsh/genoffice/scripts/dev.mjs open <文件的绝对或相对路径>
```

会自动用系统默认浏览器打开对应编辑器标签页（`.docx` → `/docs/`，`.md` → `/markdown/`）。
relay 未启动时自动拉起。加 `--no-browser` 只打印 URL。

**方式 B — 直接生成 URL（适合给用户或写进脚本）：**

```
http://localhost:8787/docs/?open=path:<文件的绝对路径>
http://localhost:8787/markdown/?open=path:<文件的绝对路径>
```

URL 里 `path:` 后的路径需 `encodeURIComponent` 编码。`path:` 形态默认仅在 relay 绑定
loopback 时可用；若 relay 以 `HOST=0.0.0.0` 暴露到网络，需设 `GENOFFICE_WEB_OPEN_PATHS=1`
显式开启（此时注意安全边界）。

## 注意事项

- 打开的文件是字节副本：保存会触发下载，不会覆盖原文件（要写回原文件请让用户用拖拽
  方式打开，Chromium 下会保留原文件句柄）。
- 仅支持 `.docx`（AI Docs）和 `.md`（AI Markdown）；xlsx/pptx/pdf 会提示"仅桌面版可用"。
- 文件超过 50MB 会被拒绝。
- 若返回 404/空白页，先确认 relay 已启动（`curl http://localhost:8787/api/health`）且
  `apps/*/web-dist` 已构建（`cd upstream && npm run web`）。
- 接口契约与排查手册见栈根 `/Users/nothing/workspace/dsh/genoffice/README.md` 与
  `contracts/`。
