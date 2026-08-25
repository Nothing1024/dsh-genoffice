# genoffice-land-pages-upstream Review Fix Tasks

来源：`review-report.md` pass 2（2026-08-25）。

| ID | 级别 | 任务 | 验收 |
|---|---|---|---|
| FIX-001 | P2 | 契约 `pptx_regenerate_slide` 备注 `page_spec` → `pages_spec`（单页数组）或「改用 land_pages」。不要默认给 iframe 兼收 DSH 单数 `page_spec`（插件已 POST land_pages） | 契约与 `hostAuthoredPageSpecs` 同字段；curl regen + `pages_spec:[{…}]` 落地；brief-only / 单数 `page_spec` 仍 BR-009（除非明确要兼收） |
| FIX-002 | P3 | PR 说明 `dev.mjs` `/api/open` sessionId / `registered` 与 relay 同捆 | smoke pptx=39；不把 open-broadcast 算进本 UF |
| FIX-003 | P3 | 可选：`pages_spec` 非数组不要复用 BR-009 | `pages_spec:"nope"` ≠ topic-only 文案；空数组保持 `land_pages requires a non-empty pages array` |
| FIX-004 | P3 | 从本 diff 拿掉 `apply_ops` `maxItems: 50`，或单独 commit | `git diff slides-skill.ts` 无 apply_ops hunk |
| FIX-005 | P3 | 可选：`executeLandPages` 抽到 sibling module | slides-skill 不再因落地原语继续膨胀 |

不要改：`plugin/`、scratch 阈值、`cloudGenStatus.enabled`、AiPanel `runAiStream`。
