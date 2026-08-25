# Phase 6 Summary（端到端验收）

## 完成任务
- **Task 23** 执行 spec 5.2 真实场景全套测试（16 行执行矩阵全部通过）：
  - UF-001/002/003 主路径：真实 agent 会话（3099 实例，DeepSeek-V4-Flash）驱动，工具链 → iframe 变化 → 显式写回，
    磁盘产物校验（B11=SUM 公式 + 0.00 格式 / slide2 标题改写 / pdf "wrong→right" + 高亮标注）
  - 失败分支：执行器未注册（png+json）、非法参数、超时（agent 自然触发，未重放）、元素不存在、文本不匹配、
    导出失败（path mismatch 不落盘）、格式保真（解包比对 + QuickLook）
  - UF-004：三 app control 无 AI（3 张）+ 非 control AI 照常（3 张 + noncontrol-ai.png）+ 旧构建兼容记录
  - API-control：五 app 未注册 + file-write-{ok,403,conflict}
- **Task 24** Phase 6 回归：smoke 全绿；六 app web:build 全绿；三 app + 插件 typecheck 0 error；
  5.4 专项检查清单核对（见下）；validate_package.py → **0 FAIL / 0 WARN**

## 验证命令
| 命令 | 结果 |
|---|---|
| node scripts/dev.mjs smoke | 全部通过 |
| npm run web:build -w @genoffice/{shell,docs,markdown,sheets,slides,pdf} | 全部 ✓ built |
| npm run typecheck -w @genoffice/{sheets,slides,pdf} | 0 error |
| cd plugin && npm run build && npm run typecheck | 全绿 |
| validate_package.py docs/genoffice-dsh-office | 0 FAIL / 0 WARN（13 PASS，5.2 证据齐全） |

## 5.4 专项检查清单
- [x] 5.2 执行矩阵全部通过，evidence 齐全（validate 审计 13 条路径）
- [x] 2.3 入口接线清单：聊天工具（agent 实测）/ tab 打开（control=1 iframe）/ 保存按钮（写入磁盘 + *_save 工具实测）
- [x] 界面交互状态（保存按钮 loading/saved/conflict/error：xlsx-tab-preview、main-tab-savebutton、conflict 实测）
- [x] INV-001 非控制零回归（noncontrol-ai.png 三 app AI 照常 + 保存=下载语义未动）
- [x] INV-004 契约镜像（contracts ↔ server.mjs ↔ 三适配器 ↔ host ↔ smoke，五族逐名核对）
- [x] INV-005 无绕过编辑器的写路径（编辑经 executeTool/skill deps；写回经导出字节）
- [x] INV-006 sandbox 未放松（iframe 仍 allow-scripts allow-same-origin allow-downloads）
- [x] BR-009 格式保真（UF-00x/format-fidelity：xlsx/pptx 未编辑条目字节一致、pdf QuickLook + 未标注页不变）
- [x] 3.3 定位清单待勘察行已补齐（web-bridge 三行标注 P0 决议）
- [x] BR/UF/INV 可逐条核销（validate 引用闭环 29 个）

## 剩余风险
- pdf 文本改写字体固定 LiberationSans（无系统字体，CJK 改写可能缺字 → isError 显式拒绝）
- pdf 图片编辑（insert/transform/replace/delete image）网页版显式不可用（nativeImage 依赖）
- slides 文本布局用 HeuristicMetrics（与桌面版系统字体度量有细微差异）
- 控制模式导出写回后渲染器搜索索引不自动刷新（与 M0 桌面 tab 写回语义一致；重新打开文件可见最新磁盘内容）
