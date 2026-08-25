# Phase 0 dirty-signal survey

Calibrated 2026-08-25 against desktop close-guard sources. Transient UI (selection, fold, highlights) is excluded.

| app | authority | module | how control.ts sees it |
|---|---|---|---|
| docs | `isDocDirty(DocDirtyState)` | `apps/docs/src/renderer/doc-dirty.ts` | App.tsx `initControlMode({ getDirty })` reads current persisted flags via ref (`dirtyRef` + section/header/footer/theme/comments/protection, not selection) |
| markdown | `dirtyRef.current` / `markDirty` | `apps/markdown/src/renderer/App.tsx` | `getDirty: () => dirtyRef.current`; `uiOnly` transactions never mark dirty |
| sheets | `pendingEdits` = `journalSize(editJournal)` | `apps/sheets/src/renderer/App.tsx` | `pendingEditsRef`; `getDirty: () => pendingEditsRef.current > 0`. Same-target re-edits keep size > 0 (`visualEditTick` is ribbon-only) |
| slides | App `dirty` state (desktop `slidesApi.isDirty`; web `sessionDirty` = undo stack) | `apps/slides/src/renderer/App.tsx`, `web-slides-session.ts` | `dirtyFlagRef` synced with `dirty` |
| pdf | computed `dirty` (markups/edits/rotations/deleted/order/metadata) | `apps/pdf/src/renderer/App.tsx` ~L1375 | `dirtyFlagRef`; same boolean as `pdfApi.setDirty` |

tool-schema `*_save` rows (add optional `save_as`): `docx_save` L259, `markdown_save` L319, `xlsx_save` L500, `pptx_save` L1124, `pdf_save` L1401.
