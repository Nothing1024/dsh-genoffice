# Phase 5 Summary（去 AI 与插件收尾）

## 完成任务
- **Task 20** 三 app 控制模式隐藏 AI 助手：
  - sheets：ExcelShell.tsx（AiChatPanel dock + AI RibbonGroup 由 CONTROL_MODE 条件渲染）
  - slides：App.tsx（ai-dock + stage-ai-bar 隐藏）；Ribbon 新增 hideAi prop（ribbon-shared Props/RibbonTabCtx/RibbonHomeTab Genspark AI Group）
  - pdf：App.tsx（AI ribbon-group 首槽 + AiPanel dock 隐藏）
  - 双态截图 6 张（EVD-002/006）
- **Task 21** 插件构建/类型检查：npm run build && npm run typecheck 全绿；
  vendor 同步不需要（未动平台包类型；env/wt-artifact local-paths.ts 为 env 内直接修改）；
  3099 重启 → HTTP 200
- **Task 22** Phase 5 回归：smoke 全绿 + 双态截图对比

## 验证命令
| 命令 | 结果 | 日志 |
|---|---|---|
| 三 app web:build / typecheck | 全绿 | 本阶段 |
| cd plugin && npm run build && npm run typecheck | 全绿 | build-typecheck.log |
| 3099 重启 | HTTP 200 | build-typecheck.log |
| node scripts/dev.mjs smoke | 全部通过 | 本阶段回归 |

## 双态截图（EVD-002/006）
| app | control=1（无 AI） | 非 control（AI 照常） |
|---|---|---|
| sheets | UF-004/sheets-control-noai.png | UF-004/sheets-noncontrol-ai.png |
| slides | UF-004/slides-control-noai.png | UF-004/slides-noncontrol-ai.png |
| pdf | UF-004/pdf-control-noai.png | UF-004/pdf-noncontrol-ai.png |

## 剩余风险
- 截图受并发浏览器会话干扰，已用 isolated context 重试确保为 GenOffice 页面实拍。
- agent 端到端（Task 23）是完成唯一标准。
