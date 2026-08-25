# Phase 1 summary

- AGENT_TOOLS 增加 `land_pages`；execute 先全部 parsePageSpec，再 localGeneratePage → generateFromHtml / regenerateSlide。
- 成功后 `skillStateCache.htmlGenerated = true`（add_shape 解锁，scratch 阈值未放宽）。
- `createControlDeckAccess` 删除 `loadControlAiSettings` / `withLocalLlm` / `getAiSettings`；`hostAuthoredSpecsOnly: true`。
- 控制模式 topic-only `generate_deck` / brief-only `regenerate_slide` / `plan_deck` → 精确串 `control mode requires pages_spec; use land_pages`。
- 非控制 AiPanel `runAiStream` / `generatePageLocalWithLlm` 未拆。
- `cloudGenStatus.enabled` 保持 false。
