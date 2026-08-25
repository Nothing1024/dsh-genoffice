/** Capability table: the single source for register-filter, prompt, and drift tests.
 *  status = upstream web-mode fact; handover = product ownership (wins over status).
 *  Source: docs/genoffice-research/evidence/capability-matrix.py (WEB_STATUS).
 */

export type CapabilityStatus =
  | 'available' | 'relay-fetch' | 'partial' | 'guarded'
  | 'bridge-missing' | 'state-locked' | 'cloud-only'

export type CapabilityHandover = 'dsh:web_search' | 'dsh:pending'

export type CapabilityApp = 'docs' | 'markdown' | 'sheets' | 'slides' | 'pdf'

export type CapabilityKey = `${CapabilityApp}:${string}`

export interface CapabilityEntry {
  status: CapabilityStatus
  netEgress: boolean
  handover?: CapabilityHandover
  evidence: string
}

export const CAPABILITY: Record<CapabilityKey, CapabilityEntry> = {
  'docs:get_document_context': { status: 'available', netEgress: false, evidence: 'docs/tools.ts:420-687 编辑器内实现，不经桥接' },
  'docs:read_blocks': { status: 'available', netEgress: false, evidence: 'docs/tools.ts:420-687 编辑器内实现，不经桥接' },
  'docs:insert_content': { status: 'available', netEgress: false, evidence: 'docs/tools.ts:420-687 编辑器内实现，不经桥接' },
  'docs:replace_blocks': { status: 'available', netEgress: false, evidence: 'docs/tools.ts:420-687 编辑器内实现，不经桥接' },
  'docs:apply_commands': { status: 'available', netEgress: false, evidence: 'docs/tools.ts:420-687 编辑器内实现，不经桥接' },
  'docs:web_search': { status: 'relay-fetch', netEgress: true, handover: 'dsh:web_search', evidence: 'docs/web-bridge.ts:719-757 → relay /api/search/* 与 /api/fetch-image' },
  'docs:image_search': { status: 'relay-fetch', netEgress: true, handover: 'dsh:pending', evidence: 'docs/web-bridge.ts:719-757 → relay /api/search/* 与 /api/fetch-image' },
  'docs:insert_image': { status: 'available', netEgress: false, evidence: 'Task 6: loopback asset channel; upstream insert_image accepts http URL' },
  'docs:insert_chart': { status: 'available', netEgress: false, evidence: 'docs/tools.ts:420-687 编辑器内实现，不经桥接' },
  'docs:edit_chart': { status: 'available', netEgress: false, evidence: 'docs/tools.ts:420-687 编辑器内实现，不经桥接' },
  'docs:save': { status: 'available', netEgress: false, evidence: 'relay POST /api/control/<app>/<docId>/export（server.mjs:558-601 原子写回）' },
  'markdown:get_document_context': { status: 'available', netEgress: false, evidence: 'markdown/tools.ts:189-302 编辑器内实现' },
  'markdown:read_blocks': { status: 'available', netEgress: false, evidence: 'markdown/tools.ts:189-302 编辑器内实现' },
  'markdown:insert_content': { status: 'available', netEgress: false, evidence: 'markdown/tools.ts:189-302 编辑器内实现' },
  'markdown:replace_blocks': { status: 'available', netEgress: false, evidence: 'markdown/tools.ts:189-302 编辑器内实现' },
  'markdown:save': { status: 'available', netEgress: false, evidence: 'relay POST /api/control/<app>/<docId>/export（server.mjs:558-601 原子写回）' },
  'sheets:get_workbook_context': { status: 'available', netEgress: false, evidence: 'sheets/tools.ts:365-601 走 Univer，不经桥接' },
  'sheets:read_range': { status: 'available', netEgress: false, evidence: 'sheets/tools.ts:365-601 走 Univer，不经桥接' },
  'sheets:load_guide': { status: 'available', netEgress: false, evidence: 'sheets/tools.ts:365-601 走 Univer，不经桥接' },
  'sheets:read_formats': { status: 'available', netEgress: false, evidence: 'sheets/tools.ts:365-601 走 Univer，不经桥接' },
  'sheets:read_sheet_features': { status: 'available', netEgress: false, evidence: 'sheets/tools.ts:365-601 走 Univer，不经桥接' },
  'sheets:read_cells': { status: 'available', netEgress: false, evidence: 'sheets/tools.ts:365-601 走 Univer，不经桥接' },
  'sheets:aggregate_range': { status: 'available', netEgress: false, evidence: 'sheets/tools.ts aggregate_range 走 Univer，不经桥接' },
  'sheets:find_cells': { status: 'available', netEgress: false, evidence: 'sheets/tools.ts find_cells 走 Univer，不经桥接' },
  'sheets:select_range': { status: 'available', netEgress: false, evidence: 'sheets/tools.ts select_range 走 Univer 视图，不经桥接' },
  'sheets:trace_precedents': { status: 'available', netEgress: false, evidence: 'sheets/tools.ts trace_precedents 走 Univer，不经桥接' },
  'sheets:trace_dependents': { status: 'available', netEgress: false, evidence: 'sheets/tools.ts trace_dependents 走 Univer，不经桥接' },
  'sheets:propose_operations': { status: 'partial', netEgress: false, evidence: 'sheets/tools.ts:533-601 可用；add_image 走 readLocalImage（web-bridge.ts:263 stub）' },
  'sheets:save': { status: 'available', netEgress: false, evidence: 'relay POST /api/control/<app>/<docId>/export（server.mjs:558-601 原子写回）' },
  'slides:get_deck_context': { status: 'available', netEgress: false, evidence: 'web-bridge.ts:226,308-336,356-421 均为真实实现' },
  'slides:read_slide': { status: 'available', netEgress: false, evidence: 'web-bridge.ts:226,308-336,356-421 均为真实实现' },
  'slides:set_element_text': { status: 'available', netEgress: false, evidence: 'web-bridge.ts:226,308-336,356-421 均为真实实现' },
  'slides:set_element_style': { status: 'available', netEgress: false, evidence: 'web-bridge.ts:226,308-336,356-421 均为真实实现' },
  'slides:set_element_transform': { status: 'available', netEgress: false, evidence: 'web-bridge.ts:226,308-336,356-421 均为真实实现' },
  'slides:execute_slide_script': { status: 'available', netEgress: false, evidence: 'web-bridge.ts:226,308-336,356-421 均为真实实现' },
  'slides:set_element_fill': { status: 'available', netEgress: false, evidence: 'web-bridge.ts:226,308-336,356-421 均为真实实现' },
  'slides:set_element_stroke': { status: 'available', netEgress: false, evidence: 'web-bridge.ts:226,308-336,356-421 均为真实实现' },
  'slides:web_search': { status: 'relay-fetch', netEgress: true, handover: 'dsh:web_search', evidence: 'web-bridge.ts:606-627 → relay /api/search/*' },
  'slides:image_search': { status: 'relay-fetch', netEgress: true, handover: 'dsh:pending', evidence: 'web-bridge.ts:606-627 → relay /api/search/*' },
  'slides:generate_image': { status: 'available', netEgress: false, handover: 'dsh:pending', evidence: 'web-bridge.ts generateImage → relay POST /api/generate-image → gsk img (browser netEgress false)' },
  'slides:analyze_media': { status: 'available', netEgress: false, evidence: 'web-bridge.ts analyzeMedia → relay POST /api/analyze-media → gsk media-analyze (browser netEgress false)' },
  'slides:insert_web_image': { status: 'available', netEgress: true, evidence: 'web-bridge.ts insertImageUrl → fetch + addPicture' },
  'slides:crop_image': { status: 'available', netEgress: false, evidence: 'web-bridge.ts editPictureSrcRect → pptx-engine editPictureSrcRect' },
  'slides:set_picture_opacity': { status: 'available', netEgress: false, evidence: 'web-bridge.ts editPictureOpacity → pptx-engine setPictureOpacity' },
  'slides:replace_image': { status: 'available', netEgress: true, evidence: 'web-bridge.ts replacePictureUrl / replacePictureBytes → pptx-engine replacePictureBytes' },
  'slides:ask_clarification': { status: 'available', netEgress: false, evidence: 'App.tsx control mode getDeckAccess adds askClarification via React state; ClarifyCard overlay rendered in App root' },
  'slides:plan_deck': { status: 'available', netEgress: false, evidence: 'web-bridge.ts:226,308-336,356-421 均为真实实现' },
  'slides:regenerate_slide': { status: 'available', netEgress: false, evidence: 'host 写一页 PageSpec 再 land_pages replace_at；不把 brief-only 转发 iframe LLM' },
  'slides:delete_slide': { status: 'available', netEgress: false, evidence: 'web-bridge.ts:226,308-336,356-421 均为真实实现' },
  'slides:land_pages': { status: 'available', netEgress: false, evidence: 'CONTROL_TOOL_TABLE pptx_land_pages → iframe land_pages；iframe 只落地，host 剥 path' },
  'slides:generate_deck': { status: 'available', netEgress: false, evidence: 'host 用当前会话模型写 PageSpec[] 再 land_pages；禁止 executeControl generate_deck' },
  'slides:save_style_template': { status: 'available', netEgress: false, evidence: 'slides-skill.ts:1444-1459 skillStateCache persists lastStyleSkill across tool calls per docPath' },
  'slides:list_style_templates': { status: 'available', netEgress: false, evidence: 'web-bridge.ts listStyleTemplates → localStorage genoffice-style-templates' },
  'slides:add_slide': { status: 'available', netEgress: false, evidence: 'web-bridge.ts:226,308-336,356-421 均为真实实现' },
  'slides:add_text_box': { status: 'guarded', netEgress: false, evidence: 'slides-skill.ts:1498-1521 blockScratchBuild：deck 带文字非装饰元素 ≤2 且 htmlGenerated=false 即拒绝；skillStateCache（line 1448）跨调用持久化 htmlGenerated，generate_deck 后可解锁' },
  'slides:add_shape': { status: 'guarded', netEgress: false, evidence: 'slides-skill.ts:1498-1521 blockScratchBuild：deck 带文字非装饰元素 ≤2 且 htmlGenerated=false 即拒绝；skillStateCache（line 1448）跨调用持久化 htmlGenerated，generate_deck 后可解锁' },
  'slides:add_chart': { status: 'available', netEgress: false, evidence: 'web-bridge.ts addChart → pptx-engine addChart' },
  'slides:add_smartart': { status: 'guarded', netEgress: false, evidence: 'web-bridge.ts:1001-1022 addSmartArt → pptx-engine addSmartArt (pushHistory before mutation); slides-skill.ts:3086-3124 already wired; blockScratchBuild（slides-skill.ts:1498-1521）同 add_text_box/add_shape' },
  'slides:add_table': { status: 'available', netEgress: false, evidence: 'web-bridge.ts addTable → pptx-engine addTable' },
  'slides:edit_table_cell': { status: 'available', netEgress: false, evidence: 'web-bridge.ts editTableCell → pptx-engine editTableCellText' },
  'slides:edit_table_structure': { status: 'available', netEgress: false, evidence: 'web-bridge.ts tableStructure / tableMerge → pptx-engine' },
  'slides:edit_table_style': { status: 'available', netEgress: false, evidence: 'web-bridge.ts editTableStyle → pptx-engine editTableStyle' },
  'slides:edit_chart': { status: 'available', netEgress: false, evidence: 'web-bridge.ts editChart / getChartData → pptx-engine' },
  'slides:set_slide_background': { status: 'available', netEgress: false, evidence: 'web-bridge.ts:226,308-336,356-421 均为真实实现' },
  'slides:delete_element': { status: 'available', netEgress: false, evidence: 'web-bridge.ts:226,308-336,356-421 均为真实实现' },
  'slides:ungroup_element': { status: 'available', netEgress: false, evidence: 'web-bridge.ts ungroupElement → pptx-engine ungroupElement' },
  'slides:apply_ops': { status: 'available', netEgress: false, evidence: 'web-bridge.ts applyTxn → runTxn（executor.ts）；空或 >50 ops 拒绝' },
  'slides:save': { status: 'available', netEgress: false, evidence: 'relay POST /api/control/<app>/<docId>/export（server.mjs:558-601 原子写回）' },
  'pdf:read_pages': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
  'pdf:search_text': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
  'pdf:goto_page': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
  'pdf:markup_text': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
  'pdf:edit_text': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
  'pdf:edit_block': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
  'pdf:insert_text': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts insertTextTool（与 edit_text/edit_block 同路径）' },
  'pdf:image_search': { status: 'relay-fetch', netEgress: true, handover: 'dsh:pending', evidence: 'pdf/web-bridge.ts:208-219 → relay /api/search/image' },
  'pdf:generate_image': { status: 'available', netEgress: false, handover: 'dsh:pending', evidence: 'pdf/web-bridge.ts generateImage → relay POST /api/generate-image → gsk img (browser netEgress false)' },
  'pdf:list_page_images': { status: 'available', netEgress: false, evidence: 'pdf/web-bridge.ts listPageImages → web-image-edit.ts listPageImages (pdfium wasm)' },
  'pdf:insert_image': { status: 'available', netEgress: false, evidence: 'pdf/web-bridge.ts listPageImages + web-pdf-save.ts applyImageEdits → web-image-edit.ts applyImageEdits (pdfium wasm)' },
  'pdf:transform_image': { status: 'available', netEgress: false, evidence: 'pdf/web-bridge.ts listPageImages + web-pdf-save.ts applyImageEdits → web-image-edit.ts applyImageEdits (pdfium wasm)' },
  'pdf:rotate_image': { status: 'available', netEgress: false, evidence: 'pdf/web-bridge.ts listPageImages + web-pdf-save.ts applyImageEdits → web-image-edit.ts applyImageEdits (pdfium wasm)' },
  'pdf:replace_image': { status: 'available', netEgress: false, evidence: 'pdf/web-bridge.ts listPageImages + web-pdf-save.ts applyImageEdits → web-image-edit.ts applyImageEdits (pdfium wasm)' },
  'pdf:delete_image': { status: 'available', netEgress: false, evidence: 'pdf/web-bridge.ts listPageImages + web-pdf-save.ts applyImageEdits → web-image-edit.ts applyImageEdits (pdfium wasm)' },
  'pdf:list_form_fields': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
  'pdf:fill_form_field': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
  'pdf:rotate_page': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
  'pdf:delete_page': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
  'pdf:get_outline': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
  'pdf:save': { status: 'available', netEgress: false, evidence: 'relay POST /api/control/<app>/<docId>/export（server.mjs:558-601 原子写回）' },
}

export function isExposed(entry: CapabilityEntry): boolean {
  return (entry.status === 'available' || entry.status === 'partial' || entry.status === 'guarded')
    && entry.netEgress === false
    && entry.handover === undefined
}

export function capabilityOf(app: CapabilityApp, skillName: string): CapabilityEntry | undefined {
  return CAPABILITY[`${app}:${skillName}`]
}

/** Exposed set size. Tests must derive expected counts from CONTROL_TOOL_TABLE, not hardcode this. */
export const EXPOSED_COUNT = Object.values(CAPABILITY).filter(isExposed).length

