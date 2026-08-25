# 性能基线（Task 9 / UF-004 / EVD-004）

日期：2026-08-21  
环境：Playwright Chromium headless，relay `http://127.0.0.1:8787`，已构建 `web-dist`（`index-DpoDUAoR.js`）。  
方法：每个夹具 **新 BrowserContext × 3 次**，取中位数。页面 `addInitScript` 注册 `PerformanceObserver({type:'longtask'})`。  
脚本：`/tmp/genoffice-sheets-bench.mjs`；原始 JSON：`performance-trace.json`。  
生产构建 **无 sourcemap**（`vite.web.config.ts` 未开 `build.sourcemap`），Long Task 调用栈无法还原到 `parseWorksheet` / `matchAll`，此项标为待勘察，用「小文件 vs 10k vs 50k 打开耗时差」作为解析成本代理。

## 夹具

| 夹具 | 路径 | 规模 | 体积 |
|---|---|---|---|
| small-compat | `upstream/apps/sheets/fixtures/generated/compatibility-basic.xlsx` | 2 个单元格 | 2.7 KB |
| large-10k | `evidence/benchmark/fixtures/large-10k-rows.xlsx` | 10,000 × 5 = 50,000 单元格 | 190 KB |
| large-50k | `evidence/benchmark/fixtures/large-50k-rows.xlsx` | 50,000 × 5 = 250,000 单元格 | 982 KB |

## 冷启动 / 首包

| 项 | 数字 | 来源 |
|---|---|---|
| 主 bundle | `index-DpoDUAoR.js` | Resource Timing |
| 传输 / 解码体积 | **10,000,140 bytes（约 9.54 MB）**，`transferSize` 10,000,440 | 三次夹具均相同 |
| 主包 Resource Timing `duration`（localhost） | 中位 **56–58 ms** | 本地 loopback，不能代表公网 |
| `domContentLoaded` / `loadEventEnd` | 约 **263 ms**（small 第 1 次） | Navigation Timing |
| 打开 → `#univer-container canvas` 可见（中位） | small **388 ms**；10k **377 ms**；50k **380 ms** | wall clock `goto` → canvas |

localhost 上将 9.54 MB 读进内存只要 ~57 ms；**主线程随后的脚本 parse/eval** 才把 DCL 推到 ~263 ms。这与「最长 Long Task ~200 ms」同量级。

## 打开到渲染完成

| 夹具 | canvasMs 三次 | 中位 |
|---|---|---|
| small-compat | 388 / 430 / 372 | **388 ms** |
| large-10k | 389 / 369 / 377 | **377 ms** |
| large-50k | 376 / 380 / 380 | **380 ms** |

**10k / 50k 相对小文件没有可分辨的打开耗时增加**（差值为 −11 / −8 ms，小于单次抖动）。说明在本夹具（纯数字单元格、无 shared strings / 公式）下，`parseWorksheet` 不是打开路径的主导成本。

## 最长 Long Task 与归属

| 夹具 | 最长 Long Task 三次 (ms) | 中位 | longTaskSum 样例 |
|---|---|---|---|
| small-compat | 223 / 204 / 185 | **204** | 372 / 369 / 402 |
| large-10k | 221 / 185 / 222 | **221** | 374 / 365 / 371 |
| large-50k | 144 / 143 / 143 | **144** | 206 / 210 / 143 |

- `name`: `self`；`attribution[0].containerType`: `window`（无函数名）。
- **待勘察**：无 sourcemap，不能从 Long Task 条目断言调用栈属于 `parseWorksheet` / `matchAll`。
- 与文件规模 **不正相关**（50k 的最长任务反而更短），不支持「主线程 xlsx 正则解析是最大 Long Task」这一假设。
- 与 Navigation Timing 对齐的更可能归属：**9.54 MB 主包的 parse/eval**（DCL ~263 ms 量级）。

## 滚动

Headless 下 2s 内对 `#univer-container` 派发 `wheel`，用 `requestAnimationFrame` 计数：

| 夹具 | rAF fps 中位 |
|---|---|
| small / 10k / 50k | **114.8–115.4** |

Headless Chromium **无显示器 vsync**，该数字不是用户可见 FPS。可见掉帧 / 60Hz FPS **待勘察**（需要 headed DevTools Performance 面板）。本轮未观察到滚动过程中出现新的数百毫秒级 Long Task（打开阶段的 Long Task 已在 canvas 前结束）。

## 离线拆解：cell 正则解析成本（Node，非浏览器）

同一 `cellPattern` 在 Node 对 sheet XML 做 `exec` 循环（不含属性解析 / Map 写入，是浏览器路径的**下限**）：

| 夹具 | XML 字符数 | cells | zipMs | xmlDecodeMs | cellRegexMs |
|---|---|---|---|---|---|
| small | 250 | 2 | 0.3 | 0.4 | 0 |
| 10k | 1,588,024 | 50,000 | 0.4 | 6.2 | **3.8** |
| 50k | 8,428,024 | 250,000 | 1.4 | 27.1 | **13.3** |

即使把 XML 解码 + 正则合计（50k ≈ 40 ms）全部算进主线程，仍明显小于最长 Long Task（~200 ms）和打开总时间（~380 ms）。

## 三项必填数字（验收）

| 必填项 | 数字 |
|---|---|
| 冷启动首包耗时 | 主 bundle Resource Timing **57 ms 中位**（localhost）；体积 **9.54 MB**；DCL **~263 ms** |
| 打开到渲染完成耗时 | `#univer-container canvas` **377–388 ms 中位**（与文件规模无关） |
| 最长 Long Task 及其归属 | **204–221 ms 中位**（10k/小文件）；attribution = `window` / `self`；**不能**在无 sourcemap 下钉到 `parseWorksheet`（待勘察）。规模差实验 + Node 正则下限表明解析不是该 Long Task 的主因 |

## 保存路径

未单独测量保存（`buildSavePayload` / `notify`）。打开/滚动基线未显示保存异常。若用户卡顿主要在保存，按 ASM-002 需另开任务，本次不改 `control.ts`。
