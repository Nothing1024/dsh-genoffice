# spec 5.2 curl 矩阵 2026-08-24

环境：`node scripts/dev.mjs start-relay` 后 8787 UP；`npm run web:build -w @genoffice/slides`；iframe `/?control=1&open=path:/tmp/genoffice-land-pages/blank.pptx`（复制自 `空白演示文稿.pptx`）；iframe 无 AI settings。

| UF | 结果 | Evidence |
|---|---|---|
| UF-001 主路径 | land_pages 2 页 mutated true；context 含「封面标题」「目录要点」；mtime 不变；随后 add_shape 非 scratch | UF-001/success.json context.json mtime.json add_shape.json |
| UF-001 未注册 | executor not registered | UF-001/fail-unregistered.json |
| UF-002 非法 spec | isError `invalid page spec:`；页数仍 1 | UF-002/rejected.json |
| UF-002 空 pages | `land_pages requires a non-empty pages array` | UF-002/empty.json |
| UF-002 半落地 | 3 页中第 2 页坏 → 整批拒绝，页数仍 1 | UF-002/half-batch.json |
| UF-003 topic-only | 精确 `control mode requires pages_spec; use land_pages`；无 no local LLM | UF-003/topic-only.json |
| UF-004 replace_at | 页数 2 不变；第 1 页「替换后的第一页」；第 2 页「目录要点」仍在 | UF-004/replaced.json context.json |
| UF-005 append | 页数 3；旧页文本仍在；末页「追加页尾」 | UF-005/appended.json context.json |

未跑 DSH `pptx_generate_deck`。
