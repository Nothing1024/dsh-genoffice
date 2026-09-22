# Official increment inventory (Task 9)

Recorded: 2026-09-12T19:06:00Z
Isolated engine: `/tmp/genoffice-official-sync-engine`
HEAD: `c34ca1a4e7dfc3de33780b6a7f79b42075dc4513`
Official object: `de139a061537bea40f0cc81ef8f09a95f77ac52a` (ancestor: yes)
Fork ancestor: `247e3f5c488afb25915e9ee97fe0fd22e27648da` (ancestor: yes)
Merge-base / increment start: `f68df70e222d47aa08211f9a2d7748c610d1d6aa`
`git diff --stat f68df70e…HEAD`: 1739 files changed, 346824 insertions(+), 114450 deletions(-)
Original engine checkout remains `247e3f5` and was not written.

## Web status legend

- **available**: exercised by official-sync / plugin-alignment / control-session e2e
- **compiled-only**: present in workspaces or Electron paths; not a product-available web entry
- **not-product-available**: must not be claimed because compile/merge succeeded

## Increment → Web status → current test → later owner

| Capability | Web status | Current test | Later owner |
|---|---|---|---|
| Docs apply_ops + apply_commands alias | available | docs-context, five-family, plugin alignment | this package (done) |
| Docs comments / reply / resolve | available | docs-context save+reopen | this package (done) |
| Docs header/footer | available | docs-context OfficialHfKeep | this package (done) |
| Docs read_revisions | available | docs-context OfficialRevKeep | this package (done) |
| Markdown apply_ops + insert_content/replace_blocks aliases | available | five-family, control-session, markdown ai-tools | this package (done) |
| Sheets propose_operations + web save | available | five-family | this package (done) |
| Slides apply_ops (setText/setTransform/dry-run/50-limit) | available | plugin apply-ops, five-family | this package (done) |
| Slides land_pages / pages_spec | available | land-pages, plugin land-pages | this package (done) |
| Slides plugin aliases add_table/add_chart/edit_table_* / get_deck_context | available | plugin ppt-schema + contract | this package (done) |
| PDF open/edit/save control | available | five-family, control-session | this package (done) |
| Requesty / browser provider metadata | available (chat path) | browser-provider | this package (done) |
| Shared page-spec + htmlToPptx landing | available for land_pages | land-pages | this package (done) |
| apps/html (official HTML editor) | compiled-only / not-product-available | no web:build; not in findStaticRoots product apps | web-feature-completion P0 inventory + HTML tasks |
| PDF OCR (apps/pdf ocr-layer / ocrPage) | not-product-available | web-bridge `ocrPage` returns null; desktop/tests only | web-feature-completion Task 14 |
| Electron printToPDF / print-html-pdf | not-product-available | Electron main only | web-feature-completion Task 13 |
| PDF→Office / html2docx / pdf2docx conversion | compiled-only / not-product-available | packages exist; web bridges still unsupported | web-feature-completion Tasks 7–8 |
| Sheets sidecar / media / pivot | not-product-available | web-xlsx empty tables/media | web-feature-completion Tasks 4–5 |
| Slides master / animation / web slideshow extras | not-product-available | web-bridge notAvailable remnants | web-feature-completion Tasks 9–11 |

## Control protocol differences kept on isolated branch

- Plugin still declares dedicated slides table/chart skills; isolated executeTool aliases them onto apply_ops ops.
- Plugin docs still send apply_commands; isolated docs tools alias it to apply_ops.
- Plugin/control-session markdown still send insert_content/replace_blocks; isolated markdown tools alias them.
- land_pages accepts pages / pages_spec / pages_spec.pages / page_spec.

## User five-goal ownership

1. Absorb official edit capability in the browser — this package (merged + e2e).
2. Keep five-family control entry and explicit save — this package + control-session-safety.
3. Plugin tools match executors — this package Task 8 + plugin-tool-alignment.
4. Official HTML editor / OCR / conversion as product features — **web-feature-completion** (not claimed here).
5. Runtime efficiency — **web-runtime-efficiency**.

HTML/OCR/conversion entering the isolated workspaces does **not** make them product-available.
