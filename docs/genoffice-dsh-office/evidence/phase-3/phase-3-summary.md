# Phase 3 Summary（slides 接入）

## 完成任务
- **Task 12** slides Web 化基础：web-node-shims + web-slides-session（pptx-engine 会话模型核心子集）+
  web-bridge（SlidesApi 全接口）+ vite.web.config + package.json 脚本。
  验证：web:build ✓；/slides/?open=path: 加载成功（3 canvas，console 仅文档化 warn）。
- **Task 13** slides 控制适配器：control.ts（SSE 注册/注销、createSlidesSkill(access).executeTool 桥接、
  exportSlidesBytes 写回）；App.tsx 接线（ctxRef 实时 DeckAccess）。
  验证：context/read_slide/set_element_text/export 全链路真实数据；冲突分支（mtime）正确拒绝。
- **Task 14** pptx_* 工具：tool-schema.ts +37（36 skill + save）；3099 重启；smoke pptx 族三向镜像通过。

## 验证命令
| 命令 | 结果 | 日志 |
|---|---|---|
| npm run web:build -w @genoffice/slides | ✓ | slides-web-console.log |
| npm run typecheck -w @genoffice/slides | ✓ | slides-web-console.log |
| 控制面 context/tool/export | 全链路真实数据 + 冲突分支 | slides-control-console.log |
| cd plugin && npm run build && npm run typecheck | ✓ | pptx-tools.log |
| node scripts/dev.mjs smoke | 全部通过 | phase-3 回归 |

## 用户路径 / API 验证
| UF/API | 结果 | Evidence |
|---|---|---|
| UF-002 前置（读页/改文本/写回） | 真实数据 + 字节校验（bold 落盘） | slides-control-console.log |
| BR-008 显式写回 | 编辑后文件不变；export 后变化 | slides-control-console.log |
| BR-004 冲突 | mtime 变化 → conflict，原文件保留 | slides-control-console.log |
| BR-003 未注册 / BR-002 非法输入 | 与契约一致（smoke 断言） | smoke |

## 剩余风险
- 文本布局用 HeuristicMetrics（无系统字体度量），换行/居中与桌面版可能有细微差异。
- TIFF 图片不转码（浏览器不能解码），该图片元素不显示（保存保真不受影响）。
- 未覆盖方法显式不可用（文档化子集）；agent 端到端留待 Task 23。
