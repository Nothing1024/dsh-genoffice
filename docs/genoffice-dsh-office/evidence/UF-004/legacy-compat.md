# UF-004 失败分支：旧构建兼容（无法构造时记录说明）
按 5.2 矩阵注：「无法构造时记录说明」。
构造旧构建需回退 web-dist 到无适配器版本并重启 relay；当前环境（relay 托管最新构建）下
该分支的语义由设计保证（contracts/control-api.md §7 兼容降级）：
- 旧 web-dist 无 control.ts 适配器 → control=1 参数被忽略（页面代码不识别该参数），
  按普通模式渲染（AI dock 出现），不崩溃；
- 无 control=1 时行为与桌面版一致（INV-001）——本分支的等价验证见
  UF-004/noncontrol-ai.png（非 control 三 app AI 照常）。
未构造二进制旧构建快照；以代码路径 + 非 control 实测作为等价证据。
