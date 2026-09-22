# GenOffice Master 一次执行交接

当用户要求按本交接执行时，使用 prd-workflow 的 execute 模式，连续完成 master 和全部子包，直到联合验收与回归结束；不要停在生成计划或逐包询问是否继续。文件生成和包校验本身不启动业务实现。

唯一入口为 `spec.md`；母状态为 `tasks.csv`，程序为 `master.py`，证据为 `evidence/`。子包顺序及完整合同见 spec 第 2 章：

1. `../control-session-safety/spec.md`、`../control-session-safety/tasks.csv`
2. `../plugin-tool-alignment/spec.md`、`../plugin-tool-alignment/tasks.csv`
3. `../official-upstream-sync/spec.md`、`../official-upstream-sync/tasks.csv`
4. `../web-feature-completion/spec.md`、`../web-feature-completion/tasks.csv`
5. `../web-runtime-efficiency/spec.md`、`../web-runtime-efficiency/tasks.csv`

架构与顺序：状态合同 → 插件契合 → 固定官方同步 → 完整 Web → 运行效率 → 联合验收。关键规则只导航：BR-003/BR-006 跨包依赖与连续推进，BR-004 真实验收，BR-007 CSV 单一状态源，INV-001/INV-002 既有改动与保存权限边界。

先读 master 和当前子包 spec 第 1、2、4、5 章，加载已安装 prd-workflow 执行规则。以下 master 命令从本目录运行；业务命令按各 spec 指定工作目录执行。

1. 运行 `python3 master.py validate`、`python3 master.py status --json`，并以 `git -C ../.. status --short`、`git -C ../../../engine status --short` 记录两仓现状；基线与隔离环境按当前 Task 校准。
2. 循环调用 `python3 master.py next --json`：execute_task/resume_task 时读取返回的 spec/anchor，按 CSV 前置执行最小闭环、接线、验证、保存证据，然后只更新该任务的 CSV 状态，再继续 next。
3. close_wrapper 时先核对该子包真实结果及源码版本，运行 `python3 master.py gate` 加返回的子包名；通过后更新母包装任务并继续 next。子包结束不结束整个会话。
4. blocked 或验证失败时先修根因并重验；仅不可恢复的真实阻塞才记录已阻塞和原因，保留现场，不能跳过依赖、自动填完成或假造证据。中断后重新 next 续跑。
5. 五个子包完成后执行母包联合场景及最终回归；全部状态与证据完整后运行 `python3 master.py gate`、`python3 master.py validate`，重新渲染六包视图，汇报实际结果与剩余阻塞。

master 只读调度与校验，不替你写业务代码，也不将 CSV 的验证说明直接交给 shell。程序默认寻找已安装 skill；迁移工作区时用其 --repo/--skill-dir 参数明确定位。
验收 result.json 格式以 spec 第 2.5 节为准；gate 不能替代真实回放和源码版本核对。浏览器使用已核实的 Playwright/Chromium，开工时重新探测；缺失先恢复，无法恢复则保留未完成并提供逐步手动脚本供回填。
保留用户既有未提交改动，不更改 Git 身份，不 push/publish，不自动重放写请求，不放松权限、不吞错；Git 身份阻止提交时保留产物并报告，不虚构提交。前置测试 driver 均就绪后才在母 Task 7 创建联合脚本。
