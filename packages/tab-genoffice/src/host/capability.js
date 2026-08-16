"use strict";
/** Capability table: the single source for register-filter, prompt, and drift tests.
 *  status = upstream web-mode fact; handover = product ownership (wins over status).
 *  Source: docs/genoffice-research/evidence/capability-matrix.py (WEB_STATUS).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXPOSED_COUNT = exports.CAPABILITY = void 0;
exports.isExposed = isExposed;
exports.capabilityOf = capabilityOf;
exports.CAPABILITY = {
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
    'slides:generate_image': { status: 'bridge-missing', netEgress: false, handover: 'dsh:pending', evidence: 'web-bridge.ts:629-630 硬编码错误串' },
    'slides:analyze_media': { status: 'bridge-missing', netEgress: false, evidence: 'web-bridge.ts:629-630 硬编码错误串' },
    'slides:insert_web_image': { status: 'bridge-missing', netEgress: false, evidence: 'web-bridge.ts:347,354,397,428,430,431,438,439,486 → notAvailable()' },
    'slides:crop_image': { status: 'bridge-missing', netEgress: false, evidence: 'web-bridge.ts:347,354,397,428,430,431,438,439,486 → notAvailable()' },
    'slides:set_picture_opacity': { status: 'bridge-missing', netEgress: false, evidence: 'web-bridge.ts:347,354,397,428,430,431,438,439,486 → notAvailable()' },
    'slides:replace_image': { status: 'bridge-missing', netEgress: false, evidence: 'web-bridge.ts:347,354,397,428,430,431,438,439,486 → notAvailable()' },
    'slides:ask_clarification': { status: 'state-locked', netEgress: false, evidence: 'App.tsx:982-989 控制面 DeckAccess 无 askClarification' },
    'slides:plan_deck': { status: 'available', netEgress: false, evidence: 'web-bridge.ts:226,308-336,356-421 均为真实实现' },
    'slides:regenerate_slide': { status: 'cloud-only', netEgress: false, evidence: 'web-bridge.ts:220-224 cloudGenStatus.enabled=false / htmlToPptx 报错' },
    'slides:delete_slide': { status: 'available', netEgress: false, evidence: 'web-bridge.ts:226,308-336,356-421 均为真实实现' },
    'slides:generate_deck': { status: 'cloud-only', netEgress: false, evidence: 'web-bridge.ts:220-224 cloudGenStatus.enabled=false / htmlToPptx 报错' },
    'slides:save_style_template': { status: 'state-locked', netEgress: false, evidence: 'control.ts:135 每次调用新建 skill → state.lastStyleSkill 恒空' },
    'slides:list_style_templates': { status: 'partial', netEgress: false, evidence: 'web-bridge.ts:490 恒返回 []' },
    'slides:add_slide': { status: 'available', netEgress: false, evidence: 'web-bridge.ts:226,308-336,356-421 均为真实实现' },
    'slides:add_text_box': { status: 'guarded', netEgress: false, evidence: 'slides-skill.ts:1486-1508 blockScratchBuild：deck 带文字非装饰元素 ≤2 且 htmlGenerated=false 即拒绝；控制面 state 每次重建恒 false（control.ts:135），空白 deck 无解锁路径' },
    'slides:add_shape': { status: 'guarded', netEgress: false, evidence: 'slides-skill.ts:1486-1508 blockScratchBuild：deck 带文字非装饰元素 ≤2 且 htmlGenerated=false 即拒绝；控制面 state 每次重建恒 false（control.ts:135），空白 deck 无解锁路径' },
    'slides:add_chart': { status: 'bridge-missing', netEgress: false, evidence: 'web-bridge.ts:347,354,397,428,430,431,438,439,486 → notAvailable()' },
    'slides:add_smartart': { status: 'bridge-missing', netEgress: false, evidence: 'web-bridge.ts:347,354,397,428,430,431,438,439,486 → notAvailable()' },
    'slides:add_table': { status: 'bridge-missing', netEgress: false, evidence: 'web-bridge.ts:347,354,397,428,430,431,438,439,486 → notAvailable()' },
    'slides:edit_table_cell': { status: 'bridge-missing', netEgress: false, evidence: 'web-bridge.ts:347,354,397,428,430,431,438,439,486 → notAvailable()' },
    'slides:edit_table_structure': { status: 'bridge-missing', netEgress: false, evidence: 'web-bridge.ts:347,354,397,428,430,431,438,439,486 → notAvailable()' },
    'slides:edit_table_style': { status: 'bridge-missing', netEgress: false, evidence: 'web-bridge.ts:347,354,397,428,430,431,438,439,486 → notAvailable()' },
    'slides:edit_chart': { status: 'bridge-missing', netEgress: false, evidence: 'web-bridge.ts:347,354,397,428,430,431,438,439,486 → notAvailable()' },
    'slides:set_slide_background': { status: 'available', netEgress: false, evidence: 'web-bridge.ts:226,308-336,356-421 均为真实实现' },
    'slides:delete_element': { status: 'available', netEgress: false, evidence: 'web-bridge.ts:226,308-336,356-421 均为真实实现' },
    'slides:ungroup_element': { status: 'bridge-missing', netEgress: false, evidence: 'web-bridge.ts:347,354,397,428,430,431,438,439,486 → notAvailable()' },
    'slides:save': { status: 'available', netEgress: false, evidence: 'relay POST /api/control/<app>/<docId>/export（server.mjs:558-601 原子写回）' },
    'pdf:read_pages': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
    'pdf:search_text': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
    'pdf:goto_page': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
    'pdf:markup_text': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
    'pdf:edit_text': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
    'pdf:edit_block': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
    'pdf:image_search': { status: 'relay-fetch', netEgress: true, handover: 'dsh:pending', evidence: 'pdf/web-bridge.ts:208-219 → relay /api/search/image' },
    'pdf:generate_image': { status: 'bridge-missing', netEgress: false, handover: 'dsh:pending', evidence: 'pdf/web-bridge.ts:226 GenSpark 图片生成 stub' },
    'pdf:list_page_images': { status: 'bridge-missing', netEgress: false, evidence: 'pdf/web-bridge.ts:192-197 listPageImages 恒 []；web-pdf-save.ts:422-426 图片编辑被跳过' },
    'pdf:insert_image': { status: 'bridge-missing', netEgress: false, evidence: 'pdf/web-bridge.ts:192-197 listPageImages 恒 []；web-pdf-save.ts:422-426 图片编辑被跳过' },
    'pdf:transform_image': { status: 'bridge-missing', netEgress: false, evidence: 'pdf/web-bridge.ts:192-197 listPageImages 恒 []；web-pdf-save.ts:422-426 图片编辑被跳过' },
    'pdf:rotate_image': { status: 'bridge-missing', netEgress: false, evidence: 'pdf/web-bridge.ts:192-197 listPageImages 恒 []；web-pdf-save.ts:422-426 图片编辑被跳过' },
    'pdf:replace_image': { status: 'bridge-missing', netEgress: false, evidence: 'pdf/web-bridge.ts:192-197 listPageImages 恒 []；web-pdf-save.ts:422-426 图片编辑被跳过' },
    'pdf:delete_image': { status: 'bridge-missing', netEgress: false, evidence: 'pdf/web-bridge.ts:192-197 listPageImages 恒 []；web-pdf-save.ts:422-426 图片编辑被跳过' },
    'pdf:list_form_fields': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
    'pdf:fill_form_field': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
    'pdf:rotate_page': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
    'pdf:delete_page': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
    'pdf:get_outline': { status: 'available', netEgress: false, evidence: 'pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463' },
    'pdf:save': { status: 'available', netEgress: false, evidence: 'relay POST /api/control/<app>/<docId>/export（server.mjs:558-601 原子写回）' },
};
function isExposed(entry) {
    return (entry.status === 'available' || entry.status === 'partial' || entry.status === 'guarded')
        && entry.netEgress === false
        && entry.handover === undefined;
}
function capabilityOf(app, skillName) {
    return exports.CAPABILITY["".concat(app, ":").concat(skillName)];
}
/** Exposed set size used by drift tests (51 after insert_image local-source). */
exports.EXPOSED_COUNT = Object.values(exports.CAPABILITY).filter(isExposed).length;
