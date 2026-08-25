# Task 10 决策：本轮暂不改 `web-xlsx.ts`

关联：BR-003, BR-004, UF-004, INV-003  
日期：2026-08-21  
基线：`baseline.md` + `performance-trace.json`

## 优先级（按基线耗时，降序）

1. **9.54 MB 主 bundle 的主线程 parse/eval**  
   - 证据：DCL ~263 ms；最长 Long Task ~200 ms 且与 xlsx 规模无关；Resource Timing 显示 `index-DpoDUAoR.js` decoded 10,000,140 B。  
   - 这是打开路径上唯一与「卡顿」同量级、且三项夹具都稳定出现的项。

2. **Univer 首屏 + 打开编排（xlsx fetch / 骨架 / canvas）**  
   - 证据：canvas 可见 ~380 ms，其中 DCL 之后只剩 ~120 ms，小文件与 50k 无差别。

3. **`parseWorksheet` / `matchAll` 主线程正则**  
   - 证据：10k/50k 相对 small 的 canvasMs 差值为噪声；Node 下限 50k 正则 13 ms + XML 解码 27 ms。  
   - **不是本轮最大瓶颈。**

4. **滚动掉帧**  
   - Headless rAF ~115/s，无证据表明滚动是主诉；真实 60Hz FPS 待勘察。

## 本轮选择：暂不做优化（不改 `web-xlsx.ts`，不拆主包）

### 为什么不做 Worker 化解析（spec 示例优化项）

- BR-003：必须针对基线中**占比最高**的项。最高项是主包 eval，不是 `matchAll`。
- 预期收益：即使把 50k 数字格的解析全部移出主线程，上限约几十毫秒，小于 Long Task 噪声（单次 143–223 ms）和打开总时间的 380 ms。对用户「严重卡顿」不可感知。
- 风险：`web-xlsx.ts` 的 `parseWorkbook` → `parseWorksheet` 是 `web-bridge.ts` 打开路径上的同步 `await` 链；Worker 化要搬整批 `matchAll`（styles / sharedStrings / rels / cells），保持 INV-003 字节级保真，还要处理 `worker-src` CSP。成本远高于收益。
- spec 原文禁止「对基线瓶颈无关的小改动然后宣称优化完成」。

### 为什么本轮也不做主包拆分

- 这是数字上正确的第一优化方向（动态 `import()` Univer、语言包已经是独立 chunk，但主 index 仍 9.54 MB）。
- 改动面：`vite.web.config.ts` `manualChunks` / 路由级拆分、Univer 初始化时序、首屏白屏 vs 分片加载，回归面包括打开/公式/画布 resize。超出「一项可行、低风险」的本轮范围（spec 2.8：不假装已经不卡）。
- 建议后续单独排期，见下。

## 后续建议（不在本需求交付范围）

| 项 | 预期收益 | 风险 | 前置 |
|---|---|---|---|
| 主 bundle code-split：把 `@univerjs/*` 打成 async chunk，首屏只加载 shell | 最长 Long Task / DCL 从 ~200–260 ms 下降到与 shell 体积成比例；公网首包从 9.54 MB 降到壳大小 | 中高：初始化时序、chunk 瀑布、错误边界 | 打开 `build.sourcemap` 做一次 headed Performance 剖面，确认 Long Task 栈在 Univer/业务之间的比例 |
| 生产 sourcemap + headed DevTools 剖面 | 把「待勘察」的 Long Task 归属从 window 钉到具体函数 | 低 | 仅构建配置 |
| 用带 sharedStrings / 样式 / 多 sheet 的**真实**大文件再测 parse | 若真实文件正则达数百 ms，再评估 Worker | 低（测量） | 用户提供文件或从业务样本抽样 |
| iframe vs 独立 tab 对比（ASM-003） | 确认插件嵌入是否另有合成层成本 | 低 | headed + 插件侧栏 |

## 明确未做的代码改动

- 未修改 `upstream/apps/sheets/src/renderer/web-xlsx.ts`
- 未修改 `web-bridge.ts` / `control.ts`
- 因此无需重跑 `npm run compat`（INV-003 无解析逻辑变化）

可验证性：对比 `git diff` 中 `apps/sheets` 只有布局相关的 `ExcelShell.tsx` + `styles.css`。
