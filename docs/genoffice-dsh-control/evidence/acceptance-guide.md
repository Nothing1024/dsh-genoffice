# 验收指南（genoffice-dsh-control）

> 依据：spec.md 第 5 章验收协议。实测环境：relay `:8787` + DSH 实例 `:3099`（本机）。
> 已实测通过的特性（2026-08-12 实跑）：markdown/docx 控制编辑全链路、显式写回、
> 无 AI 模式、context 供给、全部失败分支。以下为**复验步骤**——照做即可确认。

## 0. 前置（一次）

```bash
cd /Users/nothing/workspace/dsh/genoffice
node scripts/dev.mjs status          # relay :8787 UP + dsh :3099 UP
node scripts/dev.mjs smoke           # 全部 PASS（含控制面断言 + 工具名集合镜像）
```

fixtures：`docs/genoffice-dsh-control/evidence/fixtures/demo.md`（3 章结构）与 `demo.docx`（标题/第一段/第二段）。
验收后如需复位：`git checkout -- docs/genoffice-dsh-control/evidence/fixtures/` 或重新复制。

## 1. 特性一：控制编辑（UF-001）—— 最重要，先验这个

**操作**（浏览器打开 http://127.0.0.1:3099）：
1. 右侧 GenOffice tab → 文件浏览进入 fixtures 目录 → 点击 `demo.md`；
   - 若想从聊天联动：随便开个会话发一条含该绝对路径的消息，点渲染出的文件链接亦可。
2. 确认预览 iframe 地址形如 `…/markdown/?control=1&open=path:…`，工具栏出现「写入磁盘」按钮。
3. 新建会话，发送：
   「文档 /Users/nothing/workspace/dsh/genoffice/docs/genoffice-dsh-control/evidence/fixtures/demo.md 已在 GenOffice tab 打开。请依次调用 markdown_get_document_context、markdown_replace_blocks（把最后一个段落块改写为『验收通过。』）、markdown_save，并汇报每步结果。」

**通过标准**：
- agent 三步工具调用全部成功（工具卡片显示调用与结果）；
- iframe 内最后一段实时变为「验收通过。」（无整页刷新）；
- agent 汇报「已保存到 …/demo.md」；`tail -2 demo.md` 看到「验收通过。」；
- 编辑后、保存前磁盘字节不变（BR-008）：可在 replace 后、save 前 `md5 demo.md` 对比。

**docx 复验**：同样方式打开 `demo.docx`，让 agent 用 `docx_get_document_context → docx_replace_blocks（html 参数）→ docx_save`；
通过标准同上（磁盘 docx 解包后 document.xml 含新段落，可用 `unzip -p demo.docx word/document.xml | grep` 验证）。

## 2. 特性二：显式写回（UF-002）

**按钮路径**：让 agent（或手动）在 iframe 内做一次编辑（出现「未保存」状态）→ 点工具栏「写入磁盘」：
- 按钮短暂变「写入中…」→ 出现「已保存到 …/demo.md」绿色提示；
- `tail -2 demo.md` 与 iframe 内容一致。

**冲突分支**：编辑后，在终端 `touch demo.md`（外部修改 mtime）→ 再点「写入磁盘」：
- 出现红色提示「文件已被外部修改，未覆盖」；磁盘内容未被覆盖（BR-004）。

**保存工具路径**：让 agent 调用 `markdown_save`/`docx_save`，返回「已保存到 <path>」。
**只读分支**：`mkdir /tmp/ro && chmod 555 /tmp/ro` 后
`curl -X POST http://127.0.0.1:8787/api/file -d '{"path":"/tmp/ro/x.md","base64":"eA=="}'` → `{ok:false,error:"EACCES…"}`。

## 3. 特性三：无 AI 助手（UF-003）

- **control 模式**（第 1 节打开的预览）：Ribbon 无「Genspark AI」按钮、无「AI 总结/润色/排版」、
  无右侧 AI dock；编辑功能完整（字体/段落/表格等均可用）。
- **非 control 回归**：新开标签页直接访问
  `http://localhost:8787/markdown/?open=path:<enc>`（无 control=1）→ AI dock 与快捷按钮**照常出现**
  （INV-001）；「保存」仍是下载副本而非写回原文件（INV-007）。

## 4. 特性四：文档上下文供给（UF-004）

```bash
DOCID=$(node -e "const{createHash}=require('crypto');console.log(createHash('sha256').update('<绝对路径>').digest('hex'))")
curl -X POST http://127.0.0.1:8787/api/control/markdown/$DOCID/context -d '{}'
# → {ok:true, context:"…块列表 index|type|preview…"}，与 iframe 内文档一致
```

## 5. 失败分支抽查（curl，对运行中 relay）

| 分支 | 命令（要点） | 期望 |
|---|---|---|
| 执行器未注册 | `POST /api/control/markdown/<sha256(未打开路径)>/tool` | `{ok:false,error:'executor not registered'}` |
| 非法输入 | `POST …/tool` body `{"call":{"id":"x","name":"replace_blocks","input":"非对象"}}` | `{ok:false,error:'invalid input'}` |
| 未知工具 | `POST …/tool` name=`no_such_tool`（文档已打开时） | `{ok:true,execution:{isError:true,output:'unknown tool: …'}}` |
| 超时 | 打开文档后 kill 其 iframe 前发起调用并断 SSE（或参考 evidence/UF-001/fail-timeout.json） | `{ok:false,error:'timeout'}`，不重放 |
| 非 loopback 写回 | `curl -H 'Host: evil.example.com' -X POST …/api/file` | `HTTP 403 {ok:false,error:'loopback only'}` |
| docId 规则 | `POST /api/control/open -d '{"path":"/x.md"}'` 两次 | 同路径同 64hex，异路径异 |

## 6. 最终核验（机器闸门）

```bash
cd /Users/nothing/workspace/dsh/genoffice
node scripts/dev.mjs smoke
python3 /Users/nothing/.agents/skills/prd-workflow/scripts/validate_package.py docs/genoffice-dsh-control   # 期望 0 FAIL
cd /Users/nothing/workspace/dsh/plugin/dsh-artifact/plugin && npm run build && npm run typecheck            # 全绿
cd /Users/nothing/workspace/dsh/genoffice/upstream && npm run web:build -w @genoffice/shell -w @genoffice/docs -w @genoffice/markdown
```

## 验收结论判定

- 第 1、2、3、4 节全部通过 + 第 5 节抽查无异常 + 第 6 节全绿 → **验收通过**（对应 spec 5.2 执行矩阵 15/15 行与 5.4 检查清单，evidence/ 已按 EVD-001~007 归档）。
- 任一行失败 → 属未完成，回到对应任务修复后重跑本节。
