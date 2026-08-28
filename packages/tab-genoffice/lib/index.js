import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { BlockAssembler } from "@deepseek-ai/dsh-llm";
import { createUserMessage } from "@deepseek-ai/dsh-llm/message";
//#region src/host/lookup.ts
function isLlmStreamService(v) {
	if (typeof v !== "object" || v === null) return false;
	if (!("stream" in v) || !("listProviders" in v)) return false;
	return typeof v.stream === "function" && typeof v.listProviders === "function";
}
function lookupService(ctx, pred) {
	const store = (ctx.root ?? ctx).reflect?.store;
	if (store === void 0) return void 0;
	for (const key of Reflect.ownKeys(store)) {
		const value = store[key]?.value;
		if (pred(value)) return value;
	}
}
function lookupWebServer(ctx) {
	return lookupService(ctx, (v) => typeof v === "object" && v !== null && typeof v.register === "function" && typeof v.port === "number");
}
function lookupSystemPrompt(ctx) {
	return lookupService(ctx, (v) => typeof v === "object" && v !== null && typeof v.section === "function");
}
function lookupSkills(ctx) {
	return lookupService(ctx, (v) => typeof v === "object" && v !== null && typeof v.register === "function" && typeof v.registerProvider === "function" && typeof v.snapshot === "function");
}
function lookupLlm(ctx) {
	return lookupService(ctx, isLlmStreamService);
}
//#endregion
//#region src/host/assets.ts
/**
* One-shot loopback asset channel for `docx_insert_image` (BR-016).
* Token dies on first GET or after TTL; missing webServer → channel unavailable.
*
* Reads bytes with node:fs — this plugin has no `ctx.fs` service.
*/
const ASSET_PREFIX = "/dsh-artifact/genoffice-asset";
const MIME = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".gif": "image/gif"
};
function assertSafeImagePath(absPath) {
	if (!absPath.startsWith("/")) throw new Error("imagePath 必须是本机绝对路径");
	if (absPath.split("/").includes("..")) throw new Error("imagePath 不得包含 ..");
	if (/^https?:\/\//i.test(absPath)) throw new Error("插图只接受本机路径，不接受公网 URL（BR-016）");
	const ext = extname(absPath).toLowerCase();
	if (MIME[ext] === void 0) throw new Error("仅支持 png / jpeg / webp / gif");
	return ext;
}
function createAssetStore(opts) {
	const ttl = opts?.ttlMs ?? 6e4;
	const now = opts?.now ?? Date.now;
	const tokens = /* @__PURE__ */ new Map();
	return {
		async publish(absPath, bind) {
			assertSafeImagePath(absPath);
			const st = await stat(absPath);
			if (!st.isFile()) throw new Error("imagePath 不是文件");
			if (st.size > 20971520) throw new Error("图片超过 20MB");
			const token = randomUUID();
			tokens.set(token, {
				absPath,
				expires: now() + ttl
			});
			return {
				url: `http://${bind.host === "0.0.0.0" ? "127.0.0.1" : bind.host}:${bind.port}${ASSET_PREFIX}/${token}`,
				token,
				dispose: () => {
					tokens.delete(token);
				}
			};
		},
		take(token, at) {
			const row = tokens.get(token);
			if (row === void 0) return void 0;
			tokens.delete(token);
			if ((at ?? now()) > row.expires) return void 0;
			return row;
		},
		peek(token) {
			return tokens.get(token);
		},
		clear() {
			tokens.clear();
		}
	};
}
async function serveAsset(store, req, res) {
	if ((req.method ?? "GET") !== "GET" && (req.method ?? "") !== "HEAD") {
		res.writeHead(405).end();
		return;
	}
	let pathname = "";
	try {
		pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
	} catch {
		res.writeHead(400).end();
		return;
	}
	const prefix = `${ASSET_PREFIX}/`;
	if (!pathname.startsWith(prefix)) {
		res.writeHead(404).end();
		return;
	}
	const token = pathname.slice(prefix.length);
	if (!/^[0-9a-f-]{36}$/i.test(token)) {
		res.writeHead(404).end();
		return;
	}
	const row = store.take(token);
	if (row === void 0) {
		res.writeHead(404).end();
		return;
	}
	const ext = extname(row.absPath).toLowerCase();
	const type = MIME[ext];
	if (type === void 0) {
		res.writeHead(404).end();
		return;
	}
	try {
		const buf = await readFile(row.absPath);
		if (buf.length > 20971520) {
			res.writeHead(404).end();
			return;
		}
		res.writeHead(200, {
			"Content-Type": type,
			"Content-Length": buf.length,
			"Cache-Control": "no-store"
		});
		res.end(buf);
	} catch {
		res.writeHead(404).end();
	}
}
/**
* Prefer `reflect.get` when the service is already provided (external plugins
* often cannot `inject()` undeclared services). Fall back to nested inject so
* Electron compositions without webServer still load.
*/
function createAssetChannel(ctx) {
	const store = createAssetStore();
	const bind = {
		host: "127.0.0.1",
		port: 0,
		ready: false
	};
	const mount = (http) => {
		bind.host = http.host === "0.0.0.0" ? "127.0.0.1" : http.host;
		bind.port = http.port;
		bind.ready = true;
		const disposeRoute = http.register({
			kind: "prefix",
			path: ASSET_PREFIX,
			handler: (req, res) => {
				serveAsset(store, req, res);
			}
		});
		return () => {
			bind.ready = false;
			disposeRoute();
			store.clear();
		};
	};
	const existing = lookupWebServer(ctx);
	if (existing !== void 0) ctx.effect(() => mount(existing));
	else ctx.inject(["webServer"], (c) => mount(c.webServer));
	return {
		get available() {
			return bind.ready;
		},
		publish(absPath) {
			if (!bind.ready) return Promise.reject(/* @__PURE__ */ new Error("资产通道不可用：当前组合没有 webServer"));
			return store.publish(absPath, {
				host: bind.host,
				port: bind.port
			});
		}
	};
}
//#endregion
//#region src/host/capability.ts
const CAPABILITY = {
	"docs:get_document_context": {
		status: "available",
		netEgress: false,
		evidence: "docs/tools.ts:420-687 编辑器内实现，不经桥接"
	},
	"docs:read_blocks": {
		status: "available",
		netEgress: false,
		evidence: "docs/tools.ts:420-687 编辑器内实现，不经桥接"
	},
	"docs:insert_content": {
		status: "available",
		netEgress: false,
		evidence: "docs/tools.ts:420-687 编辑器内实现，不经桥接"
	},
	"docs:replace_blocks": {
		status: "available",
		netEgress: false,
		evidence: "docs/tools.ts:420-687 编辑器内实现，不经桥接"
	},
	"docs:apply_commands": {
		status: "available",
		netEgress: false,
		evidence: "docs/tools.ts:420-687 编辑器内实现，不经桥接"
	},
	"docs:web_search": {
		status: "relay-fetch",
		netEgress: true,
		handover: "dsh:web_search",
		evidence: "docs/web-bridge.ts:719-757 → relay /api/search/* 与 /api/fetch-image"
	},
	"docs:image_search": {
		status: "relay-fetch",
		netEgress: true,
		handover: "dsh:pending",
		evidence: "docs/web-bridge.ts:719-757 → relay /api/search/* 与 /api/fetch-image"
	},
	"docs:insert_image": {
		status: "available",
		netEgress: false,
		evidence: "Task 6: loopback asset channel; upstream insert_image accepts http URL"
	},
	"docs:insert_chart": {
		status: "available",
		netEgress: false,
		evidence: "docs/tools.ts:420-687 编辑器内实现，不经桥接"
	},
	"docs:edit_chart": {
		status: "available",
		netEgress: false,
		evidence: "docs/tools.ts:420-687 编辑器内实现，不经桥接"
	},
	"docs:save": {
		status: "available",
		netEgress: false,
		evidence: "relay POST /api/control/<app>/<docId>/export（server.mjs:558-601 原子写回）"
	},
	"markdown:get_document_context": {
		status: "available",
		netEgress: false,
		evidence: "markdown/tools.ts:189-302 编辑器内实现"
	},
	"markdown:read_blocks": {
		status: "available",
		netEgress: false,
		evidence: "markdown/tools.ts:189-302 编辑器内实现"
	},
	"markdown:insert_content": {
		status: "available",
		netEgress: false,
		evidence: "markdown/tools.ts:189-302 编辑器内实现"
	},
	"markdown:replace_blocks": {
		status: "available",
		netEgress: false,
		evidence: "markdown/tools.ts:189-302 编辑器内实现"
	},
	"markdown:save": {
		status: "available",
		netEgress: false,
		evidence: "relay POST /api/control/<app>/<docId>/export（server.mjs:558-601 原子写回）"
	},
	"sheets:get_workbook_context": {
		status: "available",
		netEgress: false,
		evidence: "sheets/tools.ts:365-601 走 Univer，不经桥接"
	},
	"sheets:read_range": {
		status: "available",
		netEgress: false,
		evidence: "sheets/tools.ts:365-601 走 Univer，不经桥接"
	},
	"sheets:load_guide": {
		status: "available",
		netEgress: false,
		evidence: "sheets/tools.ts:365-601 走 Univer，不经桥接"
	},
	"sheets:read_formats": {
		status: "available",
		netEgress: false,
		evidence: "sheets/tools.ts:365-601 走 Univer，不经桥接"
	},
	"sheets:read_sheet_features": {
		status: "available",
		netEgress: false,
		evidence: "sheets/tools.ts:365-601 走 Univer，不经桥接"
	},
	"sheets:read_cells": {
		status: "available",
		netEgress: false,
		evidence: "sheets/tools.ts:365-601 走 Univer，不经桥接"
	},
	"sheets:aggregate_range": {
		status: "available",
		netEgress: false,
		evidence: "sheets/tools.ts aggregate_range 走 Univer，不经桥接"
	},
	"sheets:find_cells": {
		status: "available",
		netEgress: false,
		evidence: "sheets/tools.ts find_cells 走 Univer，不经桥接"
	},
	"sheets:select_range": {
		status: "available",
		netEgress: false,
		evidence: "sheets/tools.ts select_range 走 Univer 视图，不经桥接"
	},
	"sheets:trace_precedents": {
		status: "available",
		netEgress: false,
		evidence: "sheets/tools.ts trace_precedents 走 Univer，不经桥接"
	},
	"sheets:trace_dependents": {
		status: "available",
		netEgress: false,
		evidence: "sheets/tools.ts trace_dependents 走 Univer，不经桥接"
	},
	"sheets:propose_operations": {
		status: "partial",
		netEgress: false,
		evidence: "sheets/tools.ts:533-601 可用；add_image 走 readLocalImage（web-bridge.ts:263 stub）"
	},
	"sheets:save": {
		status: "available",
		netEgress: false,
		evidence: "relay POST /api/control/<app>/<docId>/export（server.mjs:558-601 原子写回）"
	},
	"slides:get_deck_context": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts:226,308-336,356-421 均为真实实现"
	},
	"slides:read_slide": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts:226,308-336,356-421 均为真实实现"
	},
	"slides:set_element_text": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts:226,308-336,356-421 均为真实实现"
	},
	"slides:set_element_style": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts:226,308-336,356-421 均为真实实现"
	},
	"slides:set_element_transform": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts:226,308-336,356-421 均为真实实现"
	},
	"slides:execute_slide_script": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts:226,308-336,356-421 均为真实实现"
	},
	"slides:set_element_fill": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts:226,308-336,356-421 均为真实实现"
	},
	"slides:set_element_stroke": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts:226,308-336,356-421 均为真实实现"
	},
	"slides:web_search": {
		status: "relay-fetch",
		netEgress: true,
		handover: "dsh:web_search",
		evidence: "web-bridge.ts:606-627 → relay /api/search/*"
	},
	"slides:image_search": {
		status: "relay-fetch",
		netEgress: true,
		handover: "dsh:pending",
		evidence: "web-bridge.ts:606-627 → relay /api/search/*"
	},
	"slides:generate_image": {
		status: "available",
		netEgress: false,
		handover: "dsh:pending",
		evidence: "web-bridge.ts generateImage → relay POST /api/generate-image → gsk img (browser netEgress false)"
	},
	"slides:analyze_media": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts analyzeMedia → relay POST /api/analyze-media → gsk media-analyze (browser netEgress false)"
	},
	"slides:insert_web_image": {
		status: "available",
		netEgress: true,
		evidence: "web-bridge.ts insertImageUrl → fetch + addPicture"
	},
	"slides:crop_image": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts editPictureSrcRect → pptx-engine editPictureSrcRect"
	},
	"slides:set_picture_opacity": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts editPictureOpacity → pptx-engine setPictureOpacity"
	},
	"slides:replace_image": {
		status: "available",
		netEgress: true,
		evidence: "web-bridge.ts replacePictureUrl / replacePictureBytes → pptx-engine replacePictureBytes"
	},
	"slides:ask_clarification": {
		status: "available",
		netEgress: false,
		evidence: "App.tsx control mode getDeckAccess adds askClarification via React state; ClarifyCard overlay rendered in App root"
	},
	"slides:plan_deck": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts:226,308-336,356-421 均为真实实现"
	},
	"slides:regenerate_slide": {
		status: "available",
		netEgress: false,
		evidence: "host 写一页 PageSpec 再 land_pages replace_at；不把 brief-only 转发 iframe LLM"
	},
	"slides:delete_slide": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts:226,308-336,356-421 均为真实实现"
	},
	"slides:land_pages": {
		status: "available",
		netEgress: false,
		evidence: "CONTROL_TOOL_TABLE pptx_land_pages → iframe land_pages；iframe 只落地，host 剥 path"
	},
	"slides:generate_deck": {
		status: "available",
		netEgress: false,
		evidence: "host 用当前会话模型写 PageSpec[] 再 land_pages；禁止 executeControl generate_deck"
	},
	"slides:save_style_template": {
		status: "available",
		netEgress: false,
		evidence: "slides-skill.ts:1444-1459 skillStateCache persists lastStyleSkill across tool calls per docPath"
	},
	"slides:list_style_templates": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts listStyleTemplates → localStorage genoffice-style-templates"
	},
	"slides:add_slide": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts:226,308-336,356-421 均为真实实现"
	},
	"slides:add_text_box": {
		status: "guarded",
		netEgress: false,
		evidence: "slides-skill.ts:1498-1521 blockScratchBuild：deck 带文字非装饰元素 ≤2 且 htmlGenerated=false 即拒绝；skillStateCache（line 1448）跨调用持久化 htmlGenerated，generate_deck 后可解锁"
	},
	"slides:add_shape": {
		status: "guarded",
		netEgress: false,
		evidence: "slides-skill.ts:1498-1521 blockScratchBuild：deck 带文字非装饰元素 ≤2 且 htmlGenerated=false 即拒绝；skillStateCache（line 1448）跨调用持久化 htmlGenerated，generate_deck 后可解锁"
	},
	"slides:add_chart": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts addChart → pptx-engine addChart"
	},
	"slides:add_smartart": {
		status: "guarded",
		netEgress: false,
		evidence: "web-bridge.ts:1001-1022 addSmartArt → pptx-engine addSmartArt (pushHistory before mutation); slides-skill.ts:3086-3124 already wired; blockScratchBuild（slides-skill.ts:1498-1521）同 add_text_box/add_shape"
	},
	"slides:add_table": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts addTable → pptx-engine addTable"
	},
	"slides:edit_table_cell": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts editTableCell → pptx-engine editTableCellText"
	},
	"slides:edit_table_structure": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts tableStructure / tableMerge → pptx-engine"
	},
	"slides:edit_table_style": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts editTableStyle → pptx-engine editTableStyle"
	},
	"slides:edit_chart": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts editChart / getChartData → pptx-engine"
	},
	"slides:set_slide_background": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts:226,308-336,356-421 均为真实实现"
	},
	"slides:delete_element": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts:226,308-336,356-421 均为真实实现"
	},
	"slides:ungroup_element": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts ungroupElement → pptx-engine ungroupElement"
	},
	"slides:apply_ops": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts applyTxn → runTxn（executor.ts）；空或 >50 ops 拒绝"
	},
	"slides:save": {
		status: "available",
		netEgress: false,
		evidence: "relay POST /api/control/<app>/<docId>/export（server.mjs:558-601 原子写回）"
	},
	"pdf:read_pages": {
		status: "available",
		netEgress: false,
		evidence: "pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463"
	},
	"pdf:search_text": {
		status: "available",
		netEgress: false,
		evidence: "pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463"
	},
	"pdf:goto_page": {
		status: "available",
		netEgress: false,
		evidence: "pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463"
	},
	"pdf:markup_text": {
		status: "available",
		netEgress: false,
		evidence: "pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463"
	},
	"pdf:edit_text": {
		status: "available",
		netEgress: false,
		evidence: "pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463"
	},
	"pdf:edit_block": {
		status: "available",
		netEgress: false,
		evidence: "pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463"
	},
	"pdf:insert_text": {
		status: "available",
		netEgress: false,
		evidence: "pdf/tools.ts insertTextTool（与 edit_text/edit_block 同路径）"
	},
	"pdf:image_search": {
		status: "relay-fetch",
		netEgress: true,
		handover: "dsh:pending",
		evidence: "pdf/web-bridge.ts:208-219 → relay /api/search/image"
	},
	"pdf:generate_image": {
		status: "available",
		netEgress: false,
		handover: "dsh:pending",
		evidence: "pdf/web-bridge.ts generateImage → relay POST /api/generate-image → gsk img (browser netEgress false)"
	},
	"pdf:list_page_images": {
		status: "available",
		netEgress: false,
		evidence: "pdf/web-bridge.ts listPageImages → web-image-edit.ts listPageImages (pdfium wasm)"
	},
	"pdf:insert_image": {
		status: "available",
		netEgress: false,
		evidence: "pdf/web-bridge.ts listPageImages + web-pdf-save.ts applyImageEdits → web-image-edit.ts applyImageEdits (pdfium wasm)"
	},
	"pdf:transform_image": {
		status: "available",
		netEgress: false,
		evidence: "pdf/web-bridge.ts listPageImages + web-pdf-save.ts applyImageEdits → web-image-edit.ts applyImageEdits (pdfium wasm)"
	},
	"pdf:rotate_image": {
		status: "available",
		netEgress: false,
		evidence: "pdf/web-bridge.ts listPageImages + web-pdf-save.ts applyImageEdits → web-image-edit.ts applyImageEdits (pdfium wasm)"
	},
	"pdf:replace_image": {
		status: "available",
		netEgress: false,
		evidence: "pdf/web-bridge.ts listPageImages + web-pdf-save.ts applyImageEdits → web-image-edit.ts applyImageEdits (pdfium wasm)"
	},
	"pdf:delete_image": {
		status: "available",
		netEgress: false,
		evidence: "pdf/web-bridge.ts listPageImages + web-pdf-save.ts applyImageEdits → web-image-edit.ts applyImageEdits (pdfium wasm)"
	},
	"pdf:list_form_fields": {
		status: "available",
		netEgress: false,
		evidence: "pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463"
	},
	"pdf:fill_form_field": {
		status: "available",
		netEgress: false,
		evidence: "pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463"
	},
	"pdf:rotate_page": {
		status: "available",
		netEgress: false,
		evidence: "pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463"
	},
	"pdf:delete_page": {
		status: "available",
		netEgress: false,
		evidence: "pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463"
	},
	"pdf:get_outline": {
		status: "available",
		netEgress: false,
		evidence: "pdf/tools.ts:461-1325 + web-pdf-save.ts:414-463"
	},
	"pdf:save": {
		status: "available",
		netEgress: false,
		evidence: "relay POST /api/control/<app>/<docId>/export（server.mjs:558-601 原子写回）"
	}
};
function isExposed(entry) {
	return (entry.status === "available" || entry.status === "partial" || entry.status === "guarded") && entry.netEgress === false && entry.handover === void 0;
}
function capabilityOf(app, skillName) {
	return CAPABILITY[`${app}:${skillName}`];
}
Object.values(CAPABILITY).filter(isExposed).length;
//#endregion
//#region src/host/prompt.ts
const APP_LABEL = {
	docs: "docx",
	markdown: "markdown",
	sheets: "xlsx",
	slides: "pptx",
	pdf: "pdf"
};
function appOf(key) {
	return key.split(":")[0];
}
function skillOf(key) {
	return key.slice(key.indexOf(":") + 1);
}
function reasonOf(entry) {
	if (entry.handover === "dsh:web_search") return "已交还 DSH，请用 web_search";
	if (entry.handover === "dsh:pending") return "已划归 DSH 侧其它工具，本包不提供";
	if (entry.status === "bridge-missing") return "网页桥接缺失";
	if (entry.status === "state-locked") return "控制面状态门锁死";
	if (entry.status === "cloud-only") return "依赖云生成";
	if (entry.status === "relay-fetch") return "会经 relay 出网";
	if (entry.status === "guarded") return "空白 deck 会被上游守卫拒绝";
	if (entry.status === "partial") return "部分可用";
	return entry.status;
}
/** Generated from CAPABILITY — do not maintain a second handwritten inventory. */
function buildGenOfficePromptText() {
	const exposed = [];
	const blocked = [];
	for (const [key, entry] of Object.entries(CAPABILITY)) {
		const label = `${APP_LABEL[appOf(key)]}:${skillOf(key)}`;
		if (isExposed(entry)) exposed.push(label);
		else blocked.push(`${label}（${reasonOf(entry)}）`);
	}
	const byApp = {};
	for (const name of exposed) {
		const colon = name.indexOf(":");
		const app = name.slice(0, colon);
		const skill = name.slice(colon + 1);
		(byApp[app] ?? (byApp[app] = [])).push(skill);
	}
	return [
		"本机 GenOffice 是 web 部署。工具只改已经在控制模式打开的文档；写盘只有 *_save 或界面「写入磁盘」。",
		`可做：\n${Object.entries(byApp).map(([app, skills]) => `${app}：${skills.join("、")}`).join("\n")}`,
		`不可做（不要调用、不要向用户承诺）：\n${blocked.join("；")}`,
		"需要联网资料时用 DSH 自己的 web_search。GenOffice 侧没有检索工具。",
		"图片：不提供搜图与生图。本地已有图片时用 docx_insert_image 或 pdf_insert_image，参数 imagePath 为本机绝对路径。",
		"「在浏览器中打开」会离开控制模式；网页版 AI 面板可直连第三方模型服务商，可能出网。"
	].join("\n");
}
function applyPrompt(ctx) {
	const text = buildGenOfficePromptText();
	const mount = (sp) => {
		return sp.section({
			name: "tool:genoffice",
			order: 150,
			text
		});
	};
	const existing = lookupSystemPrompt(ctx);
	if (existing !== void 0) {
		ctx.effect(() => mount(existing));
		return;
	}
	ctx.inject(["systemPrompt"], (c) => mount(c.systemPrompt));
}
//#endregion
//#region src/host/skill.ts
const GENOFFICE_SKILL_NAME = "dsh-genoffice";
/** Catalog text. Do not list “做 PPT / 汇报 PPT” — those would auto-route. Capped at 500. */
const GENOFFICE_SKILL_DESCRIPTION = [
	"【不要主动触发】仅当用户明确写出本 skill 名称或发送 /dsh-genoffice 时再加载。",
	"用户只说做 PPT、汇报、答辩、路演时不要调用本 skill。",
	"加载后：先 pptx_open / docx_open / xlsx_open / md_open，等到「已打开控制模式」，再用内置工具改稿。"
].join("");
const GENOFFICE_SKILL_CONTENT = [
	"# GenOffice 控制模式",
	"",
	"本 skill 不自动适用于「做 PPT」类请求。只有用户点名 `dsh-genoffice` 或发送 `/dsh-genoffice` 后才按下面做。",
	"",
	"本会话有内置 `pptx_*` / `docx_*` / `xlsx_*` / `md_*` 工具。按本 skill 工作时只走这些工具。",
	"",
	"## 不要走这些路径",
	"",
	"- 不要调用 skill `ppt-image-first` 或 `third-imagegen`。若已经加载，停止执行它们的步骤。",
	"- 不要用 bash、python、python-pptx、soffice、LibreOffice 或生图 API 生成或改写 pptx/docx/xlsx。",
	"- 不要先拼 HTML 预览再导出 PPT。",
	"",
	"## 步骤",
	"",
	"1. 先调用对应 `pptx_open` / `docx_open` / `xlsx_open` / `md_open`，path 为本机绝对路径。",
	"2. 等到工具返回「已打开控制模式：<path>」，再调用其它同前缀工具。",
	"3. 读改先 `*_get_*_context`（PPT 用 `pptx_get_deck_context`）。",
	"4. 空白 pptx 出片：用 `pptx_generate_deck`（当前会话模型写 PageSpec 再落地）或自写 PageSpec 后 `pptx_land_pages`。不要把 API key 写入 iframe。",
	"5. 只用内置工具改 iframe 内文档。写盘只用 `*_save` 或界面「写入磁盘」。",
	"",
	"## 失败",
	"",
	"若报 `executor not registered` 或「尚未在控制模式打开」，只再调用一次对应 `*_open` 并等待成功。不要改走脚本。"
].join("\n");
function applySkill(ctx) {
	const mount = (skills) => skills.register({
		name: GENOFFICE_SKILL_NAME,
		description: GENOFFICE_SKILL_DESCRIPTION,
		content: GENOFFICE_SKILL_CONTENT,
		source: "runtime"
	});
	const existing = lookupSkills(ctx);
	if (existing !== void 0) {
		ctx.effect(() => mount(existing));
		return;
	}
	ctx.inject(["skills"], (c) => mount(c.skills));
}
//#endregion
//#region src/host/relay-launch.ts
/**
* Host route that can spawn the GenOffice relay from a configured checkout.
* Modeled on sync.ts: loopback origin, exact path, optional webServer inject.
*/
const RELAY_LAUNCH_ROUTE = "/dsh-artifact/genoffice-relay";
const HEALTH = "http://localhost:8787/api/health";
const POLL_MS = 250;
const TIMEOUT_MS = 1e4;
const LOOPBACK_ORIGIN$1 = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
let inFlight = null;
function isRelayLaunchConfigured(env = process.env) {
	const root = env.DSH_GENOFFICE_ROOT;
	if (typeof root !== "string" || root === "") return false;
	try {
		accessSync(join(root, "scripts/dev.mjs"), constants.R_OK);
		return true;
	} catch {
		return false;
	}
}
async function pollHealth(deadline) {
	while (Date.now() < deadline) {
		try {
			const resp = await fetch(HEALTH, { signal: AbortSignal.timeout(500) });
			if (resp.ok) {
				const data = await resp.json().catch(() => ({}));
				if (data.ok === true && data.ready !== false) return true;
			}
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, POLL_MS));
	}
	return false;
}
async function spawnRelay() {
	if (inFlight !== null) return inFlight;
	const root = process.env.DSH_GENOFFICE_ROOT ?? "";
	const script = join(root, "scripts/dev.mjs");
	inFlight = (async () => {
		try {
			if (await pollHealth(Date.now() + POLL_MS)) return { ok: true };
			spawn(process.execPath, [script, "start-relay"], {
				detached: true,
				stdio: "ignore"
			}).unref();
			return await pollHealth(Date.now() + TIMEOUT_MS) ? { ok: true } : {
				ok: false,
				error: "timeout"
			};
		} finally {
			inFlight = null;
		}
	})();
	return inFlight;
}
function writeJson(res, status, body) {
	res.writeHead(status, { "Content-Type": "application/json" });
	res.end(JSON.stringify(body));
}
async function handleRelayLaunchRequest(req, res) {
	const origin = req.headers.origin;
	if (origin !== void 0 && !LOOPBACK_ORIGIN$1.test(origin)) {
		res.writeHead(403).end();
		return;
	}
	const method = req.method ?? "GET";
	if (method === "GET") {
		writeJson(res, 200, { configured: isRelayLaunchConfigured() });
		return;
	}
	if (method !== "POST") {
		res.writeHead(405).end();
		return;
	}
	if (!isRelayLaunchConfigured()) {
		writeJson(res, 200, {
			ok: false,
			error: "not configured"
		});
		return;
	}
	writeJson(res, 200, await spawnRelay());
}
function applyRelayLaunchRoute(ctx) {
	const mount = (http) => {
		return http.register({
			kind: "exact",
			path: RELAY_LAUNCH_ROUTE,
			handler: (req, res) => {
				handleRelayLaunchRequest(req, res);
			}
		});
	};
	const existing = lookupWebServer(ctx);
	if (existing !== void 0) {
		ctx.effect(() => mount(existing));
		return;
	}
	ctx.inject(["webServer"], (c) => mount(c.webServer));
}
//#endregion
//#region src/host/sync.ts
const SYNC_ROUTE = "/dsh-artifact/genoffice-sync";
const SYNC_WINDOW_MS = 8e3;
const windows = /* @__PURE__ */ new Map();
const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
function markSyncWindow(path, now = Date.now()) {
	if (!path.startsWith("/")) return;
	windows.set(path, now + SYNC_WINDOW_MS);
}
function isInSyncWindow(path, now = Date.now()) {
	const exp = windows.get(path);
	if (exp === void 0) return false;
	if (now > exp) {
		windows.delete(path);
		return false;
	}
	return true;
}
async function readBody(req) {
	const chunks = [];
	for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	return Buffer.concat(chunks).toString("utf8");
}
async function handleSyncRequest(req, res) {
	const origin = req.headers.origin;
	if (origin !== void 0 && !LOOPBACK_ORIGIN.test(origin)) {
		res.writeHead(403).end();
		return;
	}
	if ((req.method ?? "GET") !== "POST") {
		res.writeHead(405).end();
		return;
	}
	let path = "";
	try {
		const body = JSON.parse(await readBody(req));
		path = typeof body.path === "string" ? body.path : "";
	} catch {
		res.writeHead(400).end();
		return;
	}
	if (!path.startsWith("/")) {
		res.writeHead(400).end();
		return;
	}
	markSyncWindow(path);
	res.writeHead(204).end();
}
function applySyncRoute(ctx) {
	const mount = (http) => {
		return http.register({
			kind: "exact",
			path: SYNC_ROUTE,
			handler: (req, res) => {
				handleSyncRequest(req, res);
			}
		});
	};
	const existing = lookupWebServer(ctx);
	if (existing !== void 0) {
		ctx.effect(() => mount(existing));
		return;
	}
	ctx.inject(["webServer"], (c) => mount(c.webServer));
}
//#endregion
//#region src/host/errors.ts
function triple(zh, upstream, next) {
	return `${zh}\n上游原文：${upstream.trim().length > 0 ? upstream.trim() : "（无上游原文）"}\n下一步：${next}`;
}
const GUARD_RE = /blockScratchBuild|htmlGenerated|notAvailable|空白|守卫|cannot add|scratch build|cloud generation|htmlToPptx|cloudGenStatus/i;
function classifyControlError(input) {
	const err = input.error;
	const path = input.path ?? "";
	if (input.kind === "sync" || /文档正在同步|sync window/i.test(err)) return {
		class: "sync-window",
		message: triple("文档正在同步，请稍后再试。本次调用不会被重放。", err, "等侧栏「正在同步…」结束后再调用工具。")
	};
	if (input.kind === "capability") return {
		class: "capability-unavailable",
		message: triple("该能力在本机 GenOffice web 部署下不可用，本不该被调用。", err, "改用系统提示词里给出的替代（检索用 web_search；插图用本机 imagePath）。从零出片用 pptx_generate_deck 或 pptx_land_pages。")
	};
	if (input.kind === "fetch" || /econnrefused|fetch failed|failed to fetch|networkerror|relay 返回 http/i.test(err)) return {
		class: "relay-down",
		message: triple("GenOffice relay 不可达。控制工具需要本机 localhost:8787 上的中继。", err, "在 GenOffice 仓库执行 `node web/server.mjs`（或 `npm run web`），然后点侧栏「重新检查」。")
	};
	if (err.includes("没有 DSH 页面在监听") || err.includes("no-gui-listening")) return {
		class: "executor-missing",
		message: triple("没有 DSH 页面在监听打开请求。", err, "请先在浏览器打开 DSH（默认 http://127.0.0.1:3080）再重试。")
	};
	if (input.kind === "relay" && err === "executor not registered" || err.includes("executor not registered")) return {
		class: "executor-missing",
		message: triple(`文档尚未在控制模式打开${path ? `（${path}）` : ""}。`, err, "在侧栏 explorer / chat 产物行 / git 面板点击该文件，等控制模式 iframe 加载后再重试。")
	};
	if (err === "invalid input" || /invalid input|参数无效/i.test(err)) return {
		class: "invalid-params",
		message: triple("参数无效：工具参数必须是合法 JSON 对象，且字段名与上游 skill 一致。", err, "按工具 description 修正参数后重试；不要自造上游不认识的键。")
	};
	if (err === "conflict" || /mtime 冲突|已被外部修改/i.test(err)) return {
		class: "write-conflict",
		message: triple("写回冲突：磁盘上的文件与冲突基线不一致，未覆盖原文件。", err, "若刚点过「写入磁盘」，等同步完成后再保存。若确有其它程序改了文件，点「从磁盘重载」丢弃未保存编辑后再试。")
	};
	if (err === "exists" || /(?:^|\b)exists(?:\b|$)/.test(err)) return {
		class: "write-conflict",
		message: triple("另存目标已存在，未覆盖。", err, "换个名字或删除既有副本")
	};
	if (/^planning failed:/i.test(err)) return {
		class: "invalid-params",
		message: triple("宿主规划失败，未落地。", err, "改 topic/brief，或改调 pptx_land_pages 自写 PageSpec。不要把 key 写入 iframe。")
	};
	if (input.kind === "executor" && GUARD_RE.test(err) || GUARD_RE.test(err)) return {
		class: "upstream-guard",
		message: triple("上游策略拒绝了这次编辑（不是参数写错）。空白稿需先落地再改元素。", err, "空白稿用 pptx_generate_deck 或 pptx_land_pages 出片后再改；不要反复重试同一调用。")
	};
	if (input.kind === "local") return {
		class: "invalid-params",
		message: triple("本机参数校验失败。", err, "修正 path / imagePath 后重试（必须是绝对路径，且不得含 ..）。")
	};
	return {
		class: "unrecognized",
		message: triple("未识别的上游错误。", err, "规划失败看 planning failed:；落地失败看 land_pages 原文。不要盲目重试。")
	};
}
//#endregion
//#region src/host/page-plan.ts
/**
* Host-side deck planning. Prompt text is copied from
* engine/apps/slides/src/renderer/ai/local-page-gen.ts
* (`pageSpecSystemPrompt`, `pageSpecUserMessage`, `PLAN_DECK_SYSTEM_PROMPT`,
* `STYLE_SKILL_SYSTEM_PROMPT`, `styleSkillUserMessage`, `planDeckUserMessage`).
* Do not import the slides renderer (ASM-005).
*/
const SPEC_CANVAS_W = 1280;
const DEFAULT_STYLE = "Main background: #16395C\nMain text color: #FFFFFF\nPrimary accent: #3DDC97\nSecondary accent: #F4D35E\nOverall style: dark professional typography-first slide.";
function pageSpecSystemPrompt(canvasW, canvasH) {
	return `You are a professional slide visual designer. Output exactly ONE JSON object describing one slide; no explanations/markdown/code fences.

## Canvas
${canvasW}x${canvasH} px, origin top-left. All x/y/w/h are integers in px. Nothing may cross the canvas edges; negative coordinates forbidden. Elements paint in array order: background/decor shapes first, then images, text last (text must never end up underneath a shape).\n
## Format
{"background":"#RRGGBB","elements":[...]}
Element types:
- Shape: {"type":"shape","shape":"roundRect","x":80,"y":120,"w":360,"h":200,"fill":"#RRGGBB or #RRGGBBAA (AA=alpha, 00 transparent)","stroke":{"color":"#RRGGBB","widthPt":1},"paragraphs":[...optional label text, vertically centered...]}
  Allowed shape values: rect, roundRect, ellipse, triangle, rightArrow, leftArrow, upArrow, downArrow, chevron, diamond, parallelogram, trapezoid, hexagon, pentagon, pie, donut, star5, heart, cloud, line, lineArrow. line/lineArrow draw the diagonal of their box from top-left to bottom-right and need a stroke (a horizontal rule = a box with h:1).
- Text: {"type":"text","x":80,"y":60,"w":800,"h":90,"valign":"top","paragraphs":[{"align":"left","lineSpacingPct":110,"spaceAfterPt":6,"bullet":false,"runs":[{"text":"...","sizePt":18,"bold":true,"italic":false,"color":"#RRGGBB","font":"Font Name"}]}]}
  A paragraph may mix runs of different weight/color/size (e.g. a big number run + a small unit run in one line).
- Image: {"type":"image","url":"https://...","x":660,"y":80,"w":540,"h":560} — center-cropped to fill its box (object-fit: cover).

## Hard layout rules
- Text boxes have ZERO inner padding: the box top-left is exactly where the first glyph starts. Size every box from its content: one line is about sizePt*1.8 px tall at lineSpacingPct 110; a CJK character is about sizePt*1.35 px wide, a Latin character about sizePt*0.7 px. Text wraps at the box width — count the wrapped lines and make the box tall enough, plus one spare line.
- Text must never overflow its box or overlap other text. Keep >=8px between text and card edges, >=20px between a big title and its subtitle, >=5px between stacked text blocks in the same column — self-check every pair before output.
- Font sizes in pt: big titles 32-48, subtitles 18-24, body 12-15, hero KPI numbers up to 80.
- Spread content across the whole page; do not cram it into the top half leaving large blank areas; make text and images as large as the layout allows.

## Visuals and assets
- Photos may only use URLs from the "available images" list, at most as many image elements as URLs. With no available images, fill with typography/color blocks/shapes — never fake photos.
- Icon-like decoration uses the allowed shapes only (at most 4-5 per page, strongly content-related). **Never use emoji**.
- Data visuals: compose bars/rings/timelines from rect/donut/line shapes with sizes proportional to the real values from the brief.
- Solid colors only (alpha allowed) — no gradients. **No placeholders of any kind**: all copy comes from the brief’s real content.

## Anti-AI design rules (violation = unacceptable)
- No thin vertical accent bar on the left of cards, no colored bar on top of cards, no small bar left of titles — express hierarchy with background color/font weight/size contrast.
- One primary + one secondary accent color for the whole page; even when comparing multiple entities, do not give each a different color (no rainbow cards).
- No decorative corner blocks/short lines; decorative elements must be consistent in position and style across the deck.
- Do not turn every page into a "shape + bold subtitle + description" list; the cover must not be a flat one-line title + subtitle layout — it needs a visual anchor (large color block/geometric composition/huge number/hero image).`;
}
function pageSpecUserMessage(args) {
	const imgBlock = args.images.length ? `\nAvailable image URLs (put them into image elements; do not invent placeholder blocks):\n${args.images.map((u, i) => `${i + 1}. ${u}`).join("\n")}` : "";
	const ctxBlock = args.context ? `\n\nReference material (all real names/figures/facts come from here; do not invent):\n${args.context.slice(0, 4e3)}` : "";
	return `This is the deck's unified style (this page must follow it strictly to stay consistent across pages):\n${args.style}\n\n` + (args.topic ? `Deck topic: ${args.topic}\n` : "") + `Deck-wide narrative Core Hook: ${args.coreHook}\n\nNow design page ${args.pageIndex}/${args.totalPages}.\nTitle: ${args.title}\nLayout: ${args.layout}\nContent brief (use real data/facts): ${args.brief}${imgBlock}${ctxBlock}\n\nReturn only this page's spec JSON.`;
}
const PLAN_DECK_SYSTEM_PROMPT = "You are a professional deck planner. Given the confirmed design style, plan the content page by page. Output only one JSON object, no explanations/markdown/code fences.\nFormat: {\"core_hook\":\"...\",\"pages\":[{\"title\":\"\",\"type\":\"cover|content|data|closing\",\"brief\":\"\",\"layout\":\"\",\"image_queries\":[]}]}\n\n## core_hook\nThe deck's narrative anchor: one sentence, with tension, containing a number or counter-intuitive contrast, at most 20 characters.\n\n## layout (choose from the Style Skill's per-page-type variant library; content pages within one deck must not repeat the same variant)\ncover: cover_typography_hero (huge pure typography) | cover_dark_minimal (dark background, centered large title) | cover_split_color (side-by-side color blocks) | cover_full_image_overlay (full-bleed photo + dark overlay) | cover_magazine (magazine-style large title + partial imagery) | cover_split_image (text left, image right)\ncontent: left_text_right_image | three_column_cards | hero_big_number | two_column_comparison | timeline_horizontal | full_image_text_overlay\ndata: kpi_cards_row | chart_with_insight | two_by_two_grid\nclosing: closing_cta | closing_thank_you\nSelection criteria: 3 parallel points → three_column_cards; a key number → hero_big_number; comparison/categories → two_column_comparison/two_by_two_grid; sequence → timeline_horizontal; image+text → left_text_right_image/full_image_text_overlay; metrics → kpi_cards_row.\n\n## brief\nDescribe in detail what goes in each region of the layout; prefer real data/facts from the reference material, no \"XX%\" placeholders; cover gives main/sub titles and mood; data gives metric names + concrete values + changes.\n\n## image_queries\nArray: one entry per photo slot on the page. If the reference material contains ready image URLs (starting with http), use them directly; otherwise put English image-search keywords (describing a concrete scene, e.g. \"summer palace kunming lake\", not generic words like \"park\") — the system auto-searches and fills real URLs back. Travel/product/people/brand pages get images by default; give [] only when the page truly needs no photos (fill with typography/icons; never count on CSS-drawn fake images).";
function planDeckUserMessage(a) {
	const styleBlock = a.styleSkill ? `\n[Confirmed design style Style Skill; choose layout accordingly while planning]:\n${a.styleSkill}` : "";
	return `Topic: ${a.topic}${a.context ? `\nReference material/requirements: ${a.context}` : ""}${styleBlock}\nPlan ${a.count} pages in total.\nOutput the JSON.`;
}
function extractJsonText(raw) {
	const text = String(raw ?? "");
	const candidates = [];
	for (let start = 0; start < text.length; start++) {
		if (text[start] !== "{") continue;
		let depth = 0;
		let inString = false;
		let escape = false;
		for (let i = start; i < text.length; i++) {
			const ch = text[i];
			if (inString) {
				if (escape) escape = false;
				else if (ch === "\\") escape = true;
				else if (ch === "\"") inString = false;
				continue;
			}
			if (ch === "\"") {
				inString = true;
				continue;
			}
			if (ch === "{") depth += 1;
			else if (ch === "}") {
				depth -= 1;
				if (depth === 0) {
					candidates.push(text.slice(start, i + 1));
					break;
				}
			}
		}
	}
	for (const candidate of candidates) try {
		JSON.parse(candidate);
		return candidate;
	} catch {
		continue;
	}
	return candidates[0];
}
function asRecord(v) {
	return v !== null && typeof v === "object" && !Array.isArray(v) ? v : void 0;
}
function isPageSpecLike(v) {
	const rec = asRecord(v);
	if (rec === void 0) return false;
	const elements = rec.elements;
	if (!Array.isArray(elements) || elements.length === 0) return false;
	return elements.every((el) => {
		const item = asRecord(el);
		if (item === void 0) return false;
		if (typeof item.type !== "string" || item.type.length === 0) return false;
		return [
			"x",
			"y",
			"w",
			"h"
		].every((k) => typeof item[k] === "number" && Number.isFinite(item[k]));
	});
}
function parsePageSpecLike(raw) {
	const json = extractJsonText(raw);
	if (json === void 0) return {
		ok: false,
		error: "no JSON object found in the output"
	};
	let parsed;
	try {
		parsed = JSON.parse(json);
	} catch (e) {
		return {
			ok: false,
			error: e instanceof Error ? e.message : String(e)
		};
	}
	if (!isPageSpecLike(parsed)) return {
		ok: false,
		error: "spec missing elements with type/x/y/w/h"
	};
	return {
		ok: true,
		spec: parsed
	};
}
function parseOutline(raw) {
	const json = extractJsonText(raw);
	if (json === void 0) return {
		ok: false,
		error: "no JSON object found in the output"
	};
	let parsed;
	try {
		parsed = JSON.parse(json);
	} catch (e) {
		return {
			ok: false,
			error: "outline JSON parse failed: " + (e instanceof Error ? e.message : String(e))
		};
	}
	const rec = asRecord(parsed);
	if (rec === void 0) return {
		ok: false,
		error: "outline JSON parse failed: not an object"
	};
	const pagesRaw = rec.pages;
	if (!Array.isArray(pagesRaw) || pagesRaw.length === 0) return {
		ok: false,
		error: "outline JSON parse failed: pages must be a non-empty array"
	};
	const pages = [];
	for (const item of pagesRaw) {
		const p = asRecord(item);
		if (p === void 0) return {
			ok: false,
			error: "outline JSON parse failed: page is not an object"
		};
		const title = typeof p.title === "string" ? p.title : "";
		const brief = typeof p.brief === "string" ? p.brief : "";
		const layout = typeof p.layout === "string" ? p.layout : "";
		if (title.length === 0 || brief.length === 0 || layout.length === 0) return {
			ok: false,
			error: "outline JSON parse failed: each page needs title/brief/layout"
		};
		const image_queries = Array.isArray(p.image_queries) ? p.image_queries.filter((u) => typeof u === "string" && /^https?:\/\//i.test(u)) : [];
		pages.push({
			title,
			brief,
			layout,
			...typeof p.type === "string" ? { type: p.type } : {},
			...image_queries.length > 0 ? { image_queries } : {}
		});
	}
	return {
		ok: true,
		outline: {
			core_hook: typeof rec.core_hook === "string" && rec.core_hook.length > 0 ? rec.core_hook : pages[0]?.title ?? "",
			pages
		}
	};
}
function coercePagesSpec(value) {
	if (!Array.isArray(value) || value.length === 0) return void 0;
	if (!value.every(isPageSpecLike)) return void 0;
	return value;
}
function httpImagesFrom(value) {
	if (!Array.isArray(value)) return [];
	return value.filter((u) => typeof u === "string" && /^https?:\/\//i.test(u));
}
async function llmJson(run, system, user, signal, parse, maxTokens) {
	let lastErr = "empty model output";
	for (let attempt = 0; attempt < 2; attempt++) {
		if (signal.aborted) throw new Error("planning failed: aborted");
		const prompt = attempt === 0 ? user : `${user}\n\nYour previous output was rejected: ${lastErr}. Output the corrected JSON object only.`;
		let text;
		try {
			text = await run(system, prompt, signal, maxTokens);
		} catch (e) {
			lastErr = e instanceof Error ? e.message : String(e);
			continue;
		}
		if (typeof text !== "string" || text.trim().length === 0) {
			lastErr = "empty model output";
			continue;
		}
		const parsed = parse(text);
		if (parsed.ok) return parsed.value;
		lastErr = parsed.error;
	}
	throw new Error(`planning failed: ${lastErr}`);
}
async function planDeckPages(input, run, signal) {
	const given = coercePagesSpec(input.pages_spec);
	if (given !== void 0) return given;
	if (input.pages_spec !== void 0) throw new Error("planning failed: pages_spec must be a non-empty array of PageSpec objects");
	const topic = typeof input.topic === "string" ? input.topic.trim() : "";
	const approx = typeof input.approx_pages === "number" && Number.isFinite(input.approx_pages) ? Math.max(1, Math.min(12, Math.round(input.approx_pages))) : 3;
	const style = typeof input.style === "string" && input.style.length > 0 ? input.style : DEFAULT_STYLE;
	const context = typeof input.context === "string" && input.context.length > 0 ? input.context : void 0;
	let outline;
	const pagesInput = input.pages;
	if (Array.isArray(pagesInput) && pagesInput.length > 0) {
		const parsed = parseOutline(JSON.stringify({
			core_hook: typeof input.core_hook === "string" ? input.core_hook : topic,
			pages: pagesInput
		}));
		if (!parsed.ok) throw new Error(`planning failed: ${parsed.error}`);
		outline = parsed.outline;
	}
	if (outline === void 0) {
		if (topic.length === 0) throw new Error("planning failed: topic is required when pages_spec is omitted");
		const outlineArgs = {
			topic,
			count: approx,
			styleSkill: style
		};
		if (context !== void 0) outlineArgs.context = context;
		outline = await llmJson(run, PLAN_DECK_SYSTEM_PROMPT, planDeckUserMessage(outlineArgs), signal, (text) => {
			const parsed = parseOutline(text);
			return parsed.ok ? {
				ok: true,
				value: parsed.outline
			} : parsed;
		}, 2048);
	}
	const sharedImages = httpImagesFrom(input.image_urls);
	const specs = [];
	for (const [i, page] of outline.pages.entries()) {
		const pageImages = [...sharedImages, ...(page.image_queries ?? []).filter((u) => /^https?:\/\//i.test(u))];
		const specArgs = {
			style,
			coreHook: outline.core_hook,
			pageIndex: i + 1,
			totalPages: outline.pages.length,
			title: page.title,
			layout: page.layout,
			brief: page.brief,
			images: pageImages
		};
		if (topic.length > 0) specArgs.topic = topic;
		if (context !== void 0) specArgs.context = context;
		const spec = await llmJson(run, pageSpecSystemPrompt(SPEC_CANVAS_W, 720), pageSpecUserMessage(specArgs), signal, (text) => {
			const parsed = parsePageSpecLike(text);
			return parsed.ok ? {
				ok: true,
				value: parsed.spec
			} : parsed;
		}, 4096);
		specs.push(spec);
	}
	if (specs.length === 0) throw new Error("planning failed: no pages produced");
	return specs;
}
async function planOnePageSpec(input, run, signal) {
	const given = input.page_spec;
	if (given !== void 0) {
		if (!isPageSpecLike(given)) throw new Error("planning failed: page_spec must be a PageSpec object");
		return given;
	}
	const brief = typeof input.brief === "string" ? input.brief.trim() : "";
	if (brief.length === 0) throw new Error("planning failed: brief is required when page_spec is omitted");
	const title = typeof input.title === "string" && input.title.length > 0 ? input.title : "Slide";
	const layout = typeof input.layout === "string" && input.layout.length > 0 ? input.layout : "cover_dark_minimal";
	const style = typeof input.style === "string" && input.style.length > 0 ? input.style : DEFAULT_STYLE;
	return await llmJson(run, pageSpecSystemPrompt(SPEC_CANVAS_W, 720), pageSpecUserMessage({
		style,
		coreHook: title,
		pageIndex: 1,
		totalPages: 1,
		title,
		layout,
		brief,
		images: httpImagesFrom(input.image_urls)
	}), signal, (text) => {
		const parsed = parsePageSpecLike(text);
		return parsed.ok ? {
			ok: true,
			value: parsed.spec
		} : parsed;
	}, 4096);
}
//#endregion
//#region src/host/session-llm.ts
function asSessionAgent(value) {
	if (typeof value !== "object" || value === null) return void 0;
	if (!("id" in value) || !("options" in value) || !("ctx" in value) || !("session" in value)) return void 0;
	if (typeof value.id !== "string" || value.id.length === 0) return void 0;
	if (typeof value.options !== "object" || value.options === null) return void 0;
	if (typeof value.ctx !== "object" || value.ctx === null) return void 0;
	if (typeof value.session !== "object" || value.session === null) return void 0;
	if (!("requestHeader" in value.session) || typeof value.session.requestHeader !== "function") return void 0;
	return value;
}
function routeOf(agent) {
	const header = agent.session.requestHeader()?.config;
	const provider = header?.provider ?? agent.options.provider;
	const model = header?.model ?? agent.options.model;
	if (provider === void 0 || provider.length === 0 || model === void 0 || model.length === 0) return void 0;
	const route = {
		provider,
		model
	};
	if (header?.temperature !== void 0) route.temperature = header.temperature;
	if (header?.maxTokens !== void 0) route.maxTokens = header.maxTokens;
	return route;
}
function assembledText(assembler, rawDeltas) {
	try {
		const fromBlocks = assembler.blocks().filter((b) => b.type === "text").map((b) => b.text).join("");
		if (fromBlocks.trim().length > 0) return fromBlocks;
	} catch {}
	return rawDeltas;
}
function isTextDelta(chunk) {
	return chunk.type === "text-delta";
}
function sessionPlanLlm(agentValue) {
	const agent = asSessionAgent(agentValue);
	if (agent === void 0) return async () => {
		throw new Error("planning failed: no session model");
	};
	const llm = lookupLlm(agent.ctx);
	const route = routeOf(agent);
	if (llm === void 0 || route === void 0) return async () => {
		throw new Error("planning failed: session LLM is unavailable");
	};
	return async (system, user, signal, maxTokens) => {
		const assembler = new BlockAssembler();
		const options = {
			provider: route.provider,
			model: route.model,
			system,
			messages: [createUserMessage({
				content: [{
					type: "text",
					text: user
				}],
				source: {
					kind: "plugin",
					plugin: "dsh-tab-genoffice",
					form: "notice",
					summary: "host page plan"
				}
			})],
			signal
		};
		if (maxTokens !== void 0) options.maxTokens = maxTokens;
		if (route.temperature !== void 0) options.temperature = route.temperature;
		let rawDeltas = "";
		for await (const chunk of llm.stream(options)) {
			assembler.push(chunk);
			if (isTextDelta(chunk)) rawDeltas += chunk.text;
		}
		const finish = assembler.finish;
		if (finish.kind === "error" || finish.kind === "aborted") throw new Error(finish.failure.message);
		const text = assembledText(assembler, rawDeltas);
		if (text.trim().length === 0) throw new Error(`empty model output (${finish.kind})`);
		return text;
	};
}
//#endregion
//#region src/host/tool-schema.ts
/** Absolute-path parameter shared by every control tool. */
const PATH_PARAM = {
	type: "string",
	required: true,
	description: "目标文件的本机绝对路径（必须与 GenOffice tab 中打开的文件一致）"
};
const SAVE_PARAMS = {
	path: PATH_PARAM,
	save_as: {
		type: "string",
		description: "冲突时另存到该绝对路径，不覆盖已存在文件"
	}
};
/**
* Tool table — the plugin-side mirror of contracts/control-api.md §4.
* Family counts match contracts/control-api.md §4 and smoke (skill + *_save):
* docx 11 (10+save), markdown 5 (4+save), xlsx 13 (12+save),
* pptx 39 (38+save), pdf 21 (20+save).
* Naming uses `_` instead of `:` (provider tool-name pattern ^[a-zA-Z0-9_-]+$;
* see the contract's §4 separator note, ASM-006 revision).
*/
const CONTROL_TOOL_TABLE = [
	{
		name: "docx_get_document_context",
		skillName: "get_document_context",
		app: "docs",
		description: "该工具操作 GenOffice 网页版中已打开的 docx 文档（控制模式）。所有块索引基于文档当前状态，修改后索引会变化，需重新读取上下文。获取当前文档最新状态：块列表（序号|类型|内容预览）、全文统计与当前选区。块索引会随修改变化，需要最新索引时先调用本工具。",
		parameters: { path: PATH_PARAM }
	},
	{
		name: "docx_read_blocks",
		skillName: "read_blocks",
		app: "docs",
		description: "该工具操作 GenOffice 网页版中已打开的 docx 文档（控制模式）。所有块索引基于文档当前状态，修改后索引会变化，需重新读取上下文。读取一个块范围（0 起、含端点）的完整受限 HTML 内容；长范围分页返回，截断时会给出继续读取的 offset。改写前必须先读取原文。",
		parameters: {
			path: PATH_PARAM,
			startBlockIndex: {
				type: "integer",
				required: true,
				description: "起始块索引（0 起，含）"
			},
			endBlockIndex: {
				type: "integer",
				required: true,
				description: "结束块索引（含）"
			},
			offset: {
				type: "integer",
				description: "继续被截断的读取时的字符偏移（默认 0）"
			}
		}
	},
	{
		name: "docx_insert_content",
		skillName: "insert_content",
		app: "docs",
		description: "该工具操作 GenOffice 网页版中已打开的 docx 文档（控制模式）。所有块索引基于文档当前状态，修改后索引会变化，需重新读取上下文。在指定位置插入新内容（受限 HTML，可含多个块）。用于写入/续写/生成新内容；改写现有内容请用 docx:replace_blocks。",
		parameters: {
			path: PATH_PARAM,
			html: {
				type: "string",
				required: true,
				description: "要插入的受限 HTML 片段"
			},
			afterBlockIndex: {
				type: "integer",
				description: "在该块索引之后插入；-1 = 文档开头；缺省 = 光标所在块之后"
			}
		}
	},
	{
		name: "docx_replace_blocks",
		skillName: "replace_blocks",
		app: "docs",
		description: "该工具操作 GenOffice 网页版中已打开的 docx 文档（控制模式）。所有块索引基于文档当前状态，修改后索引会变化，需重新读取上下文。用一个块范围替换为新内容（受限 HTML，新块数量可与旧不同）。用于改写/翻译/压缩/扩写现有内容。",
		parameters: {
			path: PATH_PARAM,
			startBlockIndex: {
				type: "integer",
				required: true,
				description: "起始块索引（0 起，含）"
			},
			endBlockIndex: {
				type: "integer",
				required: true,
				description: "结束块索引（含）"
			},
			html: {
				type: "string",
				required: true,
				description: "替换用的受限 HTML 片段"
			}
		}
	},
	{
		name: "docx_apply_commands",
		skillName: "apply_commands",
		app: "docs",
		description: "该工具操作 GenOffice 网页版中已打开的 docx 文档（控制模式）。所有块索引基于文档当前状态，修改后索引会变化，需重新读取上下文。执行格式化/结构/批量命令（batchUpdate 风格）：文字样式、段落格式、标题级别、查找替换、删除/移动块、列表转换、图片属性。",
		parameters: {
			path: PATH_PARAM,
			commands: {
				type: "array",
				required: true,
				description: "按序执行的命令数组；每条命令是单键对象",
				items: {
					type: "object",
					additionalProperties: true
				}
			}
		}
	},
	{
		name: "docx_web_search",
		skillName: "web_search",
		app: "docs",
		description: "该工具操作 GenOffice 网页版中已打开的 docx 文档（控制模式）。所有块索引基于文档当前状态，修改后索引会变化，需重新读取上下文。搜索网页获取文字信息（资料/数据/事实），返回标题/链接/摘要。",
		parameters: {
			path: PATH_PARAM,
			query: {
				type: "string",
				required: true,
				description: "搜索关键词"
			},
			maxResults: {
				type: "integer",
				description: "最大结果数，默认 6"
			}
		}
	},
	{
		name: "docx_image_search",
		skillName: "image_search",
		app: "docs",
		description: "该工具操作 GenOffice 网页版中已打开的 docx 文档（控制模式）。所有块索引基于文档当前状态，修改后索引会变化，需重新读取上下文。搜索图片，返回图片链接列表；选定后可用 docx:insert_image 插入。",
		parameters: {
			path: PATH_PARAM,
			query: {
				type: "string",
				required: true,
				description: "图片搜索关键词"
			},
			maxResults: {
				type: "integer",
				description: "最大结果数，默认 8"
			}
		}
	},
	{
		name: "docx_insert_image",
		skillName: "insert_image",
		app: "docs",
		description: "该工具操作 GenOffice 网页版中已打开的 docx 文档（控制模式）。所有块索引基于文档当前状态，修改后索引会变化，需重新读取上下文。插入本机图片；需要网图请先用 DSH 的 web_search 找到来源后由用户下载到本地。imagePath 必须是本机绝对路径。",
		parameters: {
			path: PATH_PARAM,
			imagePath: {
				type: "string",
				required: true,
				description: "本机图片绝对路径（png/jpeg/webp/gif）"
			},
			maxWidthPx: {
				type: "integer",
				description: "最大宽度（px），默认 480"
			}
		}
	},
	{
		name: "docx_insert_chart",
		skillName: "insert_chart",
		app: "docs",
		description: "该工具操作 GenOffice 网页版中已打开的 docx 文档（控制模式）。所有块索引基于文档当前状态，修改后索引会变化，需重新读取上下文。插入图表（原生 Word 图表）。数据必须真实：来自文档内容或 DSH 的 web_search 结果，不得编造数字。",
		parameters: {
			path: PATH_PARAM,
			kind: {
				type: "string",
				required: true,
				enum: [
					"bar",
					"line",
					"pie"
				],
				description: "图表类型"
			},
			title: {
				type: "string",
				description: "图表标题"
			},
			categories: {
				type: "array",
				required: true,
				description: "分类（x 轴/扇区）标签",
				items: { type: "string" }
			},
			series: {
				type: "array",
				required: true,
				description: "数据系列：values 长度与 categories 相同，缺失用 null；饼图只用第一个系列",
				items: {
					type: "object",
					additionalProperties: true,
					properties: {
						name: { type: "string" },
						values: {
							type: "array",
							required: true,
							items: { oneOf: [{ type: "number" }, { type: "null" }] }
						}
					}
				}
			},
			afterBlockIndex: {
				type: "integer",
				description: "在该块索引之后插入；-1 = 文档开头；缺省 = 光标所在块之后"
			}
		}
	},
	{
		name: "docx_edit_chart",
		skillName: "edit_chart",
		app: "docs",
		description: "该工具操作 GenOffice 网页版中已打开的 docx 文档（控制模式）。所有块索引基于文档当前状态，修改后索引会变化，需重新读取上下文。编辑文档中已有图表的数据（标题/分类标签/系列名/数值）。分类数量与每个系列的值数量必须与原始图表一致（数据点不可增删）。",
		parameters: {
			path: PATH_PARAM,
			blockIndex: {
				type: "integer",
				required: true,
				description: "图表的块索引"
			},
			title: {
				type: "string",
				description: "新标题（省略则保留）"
			},
			categories: {
				type: "array",
				description: "新分类标签，长度与原图一致；保留位置传 null",
				items: { oneOf: [{ type: "string" }, { type: "null" }] }
			},
			series: {
				type: "array",
				description: "要修改的系列",
				items: {
					type: "object",
					additionalProperties: true,
					properties: {
						index: {
							type: "integer",
							required: true,
							description: "系列索引（0 起）"
						},
						name: {
							type: "string",
							description: "新系列名（省略则保留）"
						},
						values: {
							type: "array",
							description: "新数值，长度与原系列一致；保留位置传 null",
							items: { oneOf: [{ type: "number" }, { type: "null" }] }
						}
					}
				}
			}
		}
	},
	{
		name: "docx_save",
		skillName: "save",
		app: "docs",
		description: "该工具操作 GenOffice 网页版中已打开的 docx 文档（控制模式）。所有块索引基于文档当前状态，修改后索引会变化，需重新读取上下文。将当前文档内容显式写回原文件（原子写回）。编辑工具只修改网页内状态，只有本工具（或 GenOffice tab 的「写入磁盘」按钮）会真正写盘。",
		parameters: SAVE_PARAMS
	},
	{
		name: "markdown_get_document_context",
		skillName: "get_document_context",
		app: "markdown",
		description: "该工具操作 GenOffice 网页版中已打开的 markdown 文档（控制模式）。markdown 内容必须是纯 GFM。刷新文档概览：顶层块编号列表（索引|类型|预览）与当前选区。索引编辑前如有疑问先调用本工具。",
		parameters: { path: PATH_PARAM }
	},
	{
		name: "markdown_read_blocks",
		skillName: "read_blocks",
		app: "markdown",
		description: "该工具操作 GenOffice 网页版中已打开的 markdown 文档（控制模式）。markdown 内容必须是纯 GFM。以 markdown 读取一个顶层块范围；长输出分页，提示中会给出继续读取的 offset。",
		parameters: {
			path: PATH_PARAM,
			startIndex: {
				type: "integer",
				required: true,
				description: "起始块索引（0 起）"
			},
			endIndex: {
				type: "integer",
				required: true,
				description: "结束块索引（含）"
			},
			offset: {
				type: "integer",
				description: "继续被截断读取的字符偏移"
			}
		}
	},
	{
		name: "markdown_insert_content",
		skillName: "insert_content",
		app: "markdown",
		description: "该工具操作 GenOffice 网页版中已打开的 markdown 文档（控制模式）。markdown 内容必须是纯 GFM。在一个顶层块之后插入新 markdown 内容；afterIndex=-1 插入文档开头；空白文档时替换空段落。",
		parameters: {
			path: PATH_PARAM,
			afterIndex: {
				type: "integer",
				required: true,
				description: "在其后插入的块索引；-1 = 文档开头"
			},
			markdown: {
				type: "string",
				required: true,
				description: "要插入的 Markdown 内容"
			}
		}
	},
	{
		name: "markdown_replace_blocks",
		skillName: "replace_blocks",
		app: "markdown",
		description: "该工具操作 GenOffice 网页版中已打开的 markdown 文档（控制模式）。markdown 内容必须是纯 GFM。用一个顶层块范围（含端点）替换为新 markdown 内容。用于改写、格式调整和删除（空 markdown 删除该范围）。",
		parameters: {
			path: PATH_PARAM,
			startIndex: {
				type: "integer",
				required: true,
				description: "起始块索引（0 起）"
			},
			endIndex: {
				type: "integer",
				required: true,
				description: "结束块索引（含）"
			},
			markdown: {
				type: "string",
				required: true,
				description: "替换用 Markdown；空串 = 删除"
			}
		}
	},
	{
		name: "markdown_save",
		skillName: "save",
		app: "markdown",
		description: "该工具操作 GenOffice 网页版中已打开的 markdown 文档（控制模式）。markdown 内容必须是纯 GFM。将当前文档内容显式写回原文件（原子写回）。编辑工具只修改网页内状态，只有本工具（或 GenOffice tab 的「写入磁盘」按钮）会真正写盘。",
		parameters: SAVE_PARAMS
	},
	{
		name: "xlsx_get_workbook_context",
		skillName: "get_workbook_context",
		app: "sheets",
		description: "该工具操作 GenOffice 网页版中已打开的 xlsx 工作簿（控制模式）。所有编辑先改 iframe 内工作表，只有 xlsx_save 或 tab「写入磁盘」才会写回原文件。获取工作簿概览：所有工作表（id/名称/数据范围 行列数）、当前工作表、当前选区、已知非空单元格。数据量问题（多少行/多少数据）直接依据数据范围回答，不要逐块读。",
		parameters: { path: PATH_PARAM }
	},
	{
		name: "xlsx_read_range",
		skillName: "read_range",
		app: "sheets",
		description: "该工具操作 GenOffice 网页版中已打开的 xlsx 工作簿（控制模式）。所有编辑先改 iframe 内工作表，只有 xlsx_save 或 tab「写入磁盘」才会写回原文件。按矩形区域读取当前值/公式，返回带行号列标的网格（最多 2000 单元格）。读取前建议先 get_workbook_context 了解数据范围。",
		parameters: {
			path: PATH_PARAM,
			range: {
				type: "string",
				required: true,
				description: "区域如 \"A1:D20\"；单格 \"B2\" 也可"
			}
		}
	},
	{
		name: "xlsx_load_guide",
		skillName: "load_guide",
		app: "sheets",
		description: "该工具操作 GenOffice 网页版中已打开的 xlsx 工作簿（控制模式）。所有编辑先改 iframe 内工作表，只有 xlsx_save 或 tab「写入磁盘」才会写回原文件。加载操作指南到上下文（字段定义、约定、常见错误）。除最基本的单格读写外，生成 propose_operations 前应加载相关指南。",
		parameters: {
			path: PATH_PARAM,
			guides: {
				type: "array",
				required: true,
				description: "指南名列表，如 [\"writing\",\"formatting\"]",
				items: { type: "string" }
			}
		}
	},
	{
		name: "xlsx_read_formats",
		skillName: "read_formats",
		app: "sheets",
		description: "该工具操作 GenOffice 网页版中已打开的 xlsx 工作簿（控制模式）。所有编辑先改 iframe 内工作表，只有 xlsx_save 或 tab「写入磁盘」才会写回原文件。读取区域内单元格的显式格式（粗体/斜体/下划线/颜色/数字格式/对齐/边框）；只返回有显式格式的单元格，最多 200 个。",
		parameters: {
			path: PATH_PARAM,
			range: {
				type: "string",
				required: true,
				description: "区域如 \"A1:D20\""
			}
		}
	},
	{
		name: "xlsx_read_sheet_features",
		skillName: "read_sheet_features",
		app: "sheets",
		description: "该工具操作 GenOffice 网页版中已打开的 xlsx 工作簿（控制模式）。所有编辑先改 iframe 内工作表，只有 xlsx_save 或 tab「写入磁盘」才会写回原文件。读取工作表特性状态：自动筛选、条件格式、数据验证、定义名称、冻结窗格、隐藏/保护状态、形状图片、页面设置。修改前先读现状。",
		parameters: {
			path: PATH_PARAM,
			sheetId: {
				type: "string",
				description: "目标工作表 id；省略读取当前工作表"
			}
		}
	},
	{
		name: "xlsx_read_cells",
		skillName: "read_cells",
		app: "sheets",
		description: "该工具操作 GenOffice 网页版中已打开的 xlsx 工作簿（控制模式）。所有编辑先改 iframe 内工作表，只有 xlsx_save 或 tab「写入磁盘」才会写回原文件。读取散布单元格的当前值/公式（连续区域用 read_range）。写之前必须先读目标单元格，禁止臆测内容。",
		parameters: {
			path: PATH_PARAM,
			addresses: {
				type: "array",
				required: true,
				description: "单元格地址列表，如 [\"A1\",\"B2\"]，最多 100 个",
				items: { type: "string" }
			}
		}
	},
	{
		name: "xlsx_aggregate_range",
		skillName: "aggregate_range",
		app: "sheets",
		description: "该工具操作 GenOffice 网页版中已打开的 xlsx 工作簿（控制模式）。所有编辑先改 iframe 内工作表，只有 xlsx_save 或 tab「写入磁盘」才会写回原文件。对区域做统计（非空数、去重数、数值 sum/avg/min/max、高频值），不逐格读。大表问「多少个不同供应商」必须用它，禁止循环 read_range 或写昂贵 COUNTIF。一列一次。",
		parameters: {
			path: PATH_PARAM,
			range: {
				type: "string",
				required: true,
				description: "区域如 \"D2:D88588\"（通常一列，不含表头）"
			},
			sheetId: {
				type: "string",
				description: "目标工作表 id；省略读当前表"
			},
			topValues: {
				type: "number",
				description: "返回多少个最高频值（0-50，默认 10）"
			}
		}
	},
	{
		name: "xlsx_find_cells",
		skillName: "find_cells",
		app: "sheets",
		description: "该工具操作 GenOffice 网页版中已打开的 xlsx 工作簿（控制模式）。所有编辑先改 iframe 内工作表，只有 xlsx_save 或 tab「写入磁盘」才会写回原文件。在整本或一张表里搜索值/公式匹配的单元格，返回 Sheet!Address。明文是大小写不敏感子串；regex=true 当 JS 正则；errors_only=true 找公式错误格（此时可省略 query）。定位数据或审计错误优先用它，不要分页 read_range。",
		parameters: {
			path: PATH_PARAM,
			query: {
				type: "string",
				description: "文本或正则；仅 errors_only=true 时可省略"
			},
			regex: {
				type: "boolean",
				description: "将 query 当作 JS 正则（默认 false）"
			},
			look_in: {
				type: "string",
				enum: [
					"values",
					"formulas",
					"both"
				],
				description: "匹配范围（默认 both）"
			},
			sheetId: {
				type: "string",
				description: "限制到一张表；省略搜全部表"
			},
			errors_only: {
				type: "boolean",
				description: "只找公式错误值（默认 false）"
			},
			max_results: {
				type: "integer",
				description: "最多返回条数"
			}
		}
	},
	{
		name: "xlsx_select_range",
		skillName: "select_range",
		app: "sheets",
		description: "该工具操作 GenOffice 网页版中已打开的 xlsx 工作簿（控制模式）。所有编辑先改 iframe 内工作表，只有 xlsx_save 或 tab「写入磁盘」才会写回原文件。选中区域并滚到可见（激活该表）。纯视图导航，不改数据。",
		parameters: {
			path: PATH_PARAM,
			range: {
				type: "string",
				required: true,
				description: "区域如 \"A1:D20\"；单格也可"
			},
			sheetId: {
				type: "string",
				description: "目标工作表 id；省略当前表"
			}
		}
	},
	{
		name: "xlsx_trace_precedents",
		skillName: "trace_precedents",
		app: "sheets",
		description: "该工具操作 GenOffice 网页版中已打开的 xlsx 工作簿（控制模式）。所有编辑先改 iframe 内工作表，只有 xlsx_save 或 tab「写入磁盘」才会写回原文件。列出公式单元格读取的引用（precedents）及当前值，并标出错误值。深度 1；对可疑引用再调一次可往上走。定义名称不展开。",
		parameters: {
			path: PATH_PARAM,
			address: {
				type: "string",
				required: true,
				description: "要审计的公式格，如 \"C10\""
			},
			sheetId: {
				type: "string",
				description: "单元格所在表；省略当前表"
			}
		}
	},
	{
		name: "xlsx_trace_dependents",
		skillName: "trace_dependents",
		app: "sheets",
		description: "该工具操作 GenOffice 网页版中已打开的 xlsx 工作簿（控制模式）。所有编辑先改 iframe 内工作表，只有 xlsx_save 或 tab「写入磁盘」才会写回原文件。找出工作簿里所有读取该单元格的公式（dependents）。改/删单元格前用它看谁会断。经定义名称间接引用的检测不到。",
		parameters: {
			path: PATH_PARAM,
			address: {
				type: "string",
				required: true,
				description: "目标单元格，如 \"B2\""
			},
			sheetId: {
				type: "string",
				description: "单元格所在表；省略当前表"
			}
		}
	},
	{
		name: "xlsx_propose_operations",
		skillName: "propose_operations",
		app: "sheets",
		description: "该工具操作 GenOffice 网页版中已打开的 xlsx 工作簿（控制模式）。所有编辑先改 iframe 内工作表，只有 xlsx_save 或 tab「写入磁盘」才会写回原文件。提交一批变更操作并立即应用到工作簿（可用 Undo/⌘Z 回滚）。基础操作：{op:\"set_cell\",sheetId,address,value} | {op:\"set_formula\",sheetId,address,formula(以=开头)} | {op:\"clear_cell\",sheetId,address} | {op:\"rename_sheet\",sheetId,name}；其余操作（format_range/set_range/sort_range/insert_rows/add_sheet/add_table/add_chart 等）字段定义见指南，先 load_guide。结构操作不能与其他类别同批；最多 2000 个展开单元格变更；sheetId 必须来自 get_workbook_context。",
		parameters: {
			path: PATH_PARAM,
			operations: {
				type: "array",
				required: true,
				description: "工作簿 DSL 判别联合格式的操作数组",
				items: {
					type: "object",
					additionalProperties: true
				}
			},
			summary: {
				type: "string",
				required: true,
				description: "本批变更的一句话总结"
			}
		}
	},
	{
		name: "xlsx_save",
		skillName: "save",
		app: "sheets",
		description: "该工具操作 GenOffice 网页版中已打开的 xlsx 工作簿（控制模式）。所有编辑先改 iframe 内工作表，只有 xlsx_save 或 tab「写入磁盘」才会写回原文件。将当前工作簿内容显式写回原文件（原子写回，tmp+rename）。编辑工具只修改网页内状态，只有本工具（或 tab「写入磁盘」按钮）会真正写盘。",
		parameters: SAVE_PARAMS
	},
	{
		name: "pptx_get_deck_context",
		skillName: "get_deck_context",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。获取演示文稿最新大纲：每页文本元素列表（元素 id | 类型 | 文本预览）。编辑后确认全局状态时调用。",
		parameters: { path: PATH_PARAM }
	},
	{
		name: "pptx_read_slide",
		skillName: "read_slide",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。读取一页的全部元素：完整文本（不截断）与当前颜色（填充/文本/描边，hex）。改写一页前必须先调用。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true,
				description: "页码（0 起）"
			}
		}
	},
	{
		name: "pptx_set_element_text",
		skillName: "set_element_text",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。替换一个文本元素的全部内容。paragraphs 为替换后的完整段落数组，每段一个对象；整段粗体/斜体等用段落上的布尔字段。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true,
				description: "页码（0 起）"
			},
			sourceId: {
				type: "string",
				required: true,
				description: "元素 id（来自大纲/read_slide）"
			},
			paragraphs: {
				type: "array",
				required: true,
				description: "完整段落数组（替换全部内容）",
				items: {
					type: "object",
					additionalProperties: true,
					properties: {
						text: { type: "string" },
						bold: { type: "boolean" },
						italic: { type: "boolean" },
						underline: { type: "boolean" },
						fontSize: { type: "number" },
						fontFamily: { type: "string" },
						color: {
							type: "string",
							description: "#RRGGBB"
						}
					}
				}
			}
		}
	},
	{
		name: "pptx_set_element_style",
		skillName: "set_element_style",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。修改元素文本格式（不改文字）：字号/颜色/粗体/斜体/下划线/对齐/字体。只传要改的字段。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			sourceId: {
				type: "string",
				required: true
			},
			fontSize: {
				type: "number",
				description: "字号（pt）"
			},
			color: {
				type: "string",
				description: "#RRGGBB"
			},
			bold: { type: "boolean" },
			italic: { type: "boolean" },
			underline: { type: "boolean" },
			fontFamily: {
				type: "string",
				description: "字体名；通常省略继承主题"
			},
			align: {
				type: "string",
				enum: [
					"left",
					"center",
					"right"
				]
			}
		}
	},
	{
		name: "pptx_set_element_transform",
		skillName: "set_element_transform",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。移动/缩放/旋转元素（像素坐标，原点左上，画布宽 1280）。只传要改的字段。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			sourceId: {
				type: "string",
				required: true
			},
			x: {
				type: "number",
				description: "左上角 x（px）"
			},
			y: {
				type: "number",
				description: "左上角 y（px）"
			},
			w: {
				type: "number",
				description: "宽（px）"
			},
			h: {
				type: "number",
				description: "高（px）"
			},
			rotationDeg: {
				type: "number",
				description: "旋转角（度，顺时针）"
			}
		}
	},
	{
		name: "pptx_execute_slide_script",
		skillName: "execute_slide_script",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。执行幻灯片脚本（多属性/多元素/相对微调/对齐分布用脚本）。脚本 API：setText(id, text|paragraphs)、setStyle(id, {fontSize,color,bold,…})、setTransform(id, {x,y,w,h,rotationDeg})、setFill(id, color|\"none\")、setStroke(id, {color,widthPt}|null)、addText/addShape、remove(id)、align/distribute。画布 1280×720，坐标像素。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			code: {
				type: "string",
				required: true,
				description: "JavaScript 脚本源码（上游键名 code）"
			},
			explanation: {
				type: "string",
				description: "脚本意图说明（可选）"
			}
		}
	},
	{
		name: "pptx_set_element_fill",
		skillName: "set_element_fill",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。设置元素实心填充。fill=#RRGGBB；传 \"none\" 取消填充。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			sourceId: {
				type: "string",
				required: true
			},
			fill: {
				type: "string",
				required: true,
				description: "#RRGGBB 或 none"
			}
		}
	},
	{
		name: "pptx_set_element_stroke",
		skillName: "set_element_stroke",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。设置元素描边。传 color（#RRGGBB）+ widthPt（磅）；remove=true 移除描边。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			sourceId: {
				type: "string",
				required: true
			},
			color: {
				type: "string",
				description: "#RRGGBB"
			},
			widthPt: {
				type: "number",
				description: "线宽（磅）"
			},
			remove: {
				type: "boolean",
				description: "true = 移除描边"
			}
		}
	},
	{
		name: "pptx_web_search",
		skillName: "web_search",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。搜索网页获取文字信息，返回标题/链接/摘要。",
		parameters: {
			path: PATH_PARAM,
			query: {
				type: "string",
				required: true,
				description: "搜索关键词"
			},
			maxResults: {
				type: "integer",
				description: "最大结果数，默认 6"
			}
		}
	},
	{
		name: "pptx_image_search",
		skillName: "image_search",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。搜索图片返回链接列表（配合 insert_web_image 使用）。",
		parameters: {
			path: PATH_PARAM,
			query: {
				type: "string",
				required: true,
				description: "图片搜索关键词（建议英文）"
			},
			maxResults: {
				type: "integer",
				description: "最大结果数，默认 8"
			}
		}
	},
	{
		name: "pptx_generate_image",
		skillName: "generate_image",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。Genspark AI 图片生成/编辑。经本地中继调用，浏览器不直连公网。",
		parameters: {
			path: PATH_PARAM,
			prompt: {
				type: "string",
				required: true
			},
			model: { type: "string" }
		}
	},
	{
		name: "pptx_analyze_media",
		skillName: "analyze_media",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。媒体内容理解分析。mediaUrls 为图片/音视频链接；经本地中继调用 Genspark。",
		parameters: {
			path: PATH_PARAM,
			mediaUrls: {
				type: "array",
				required: true,
				items: { type: "string" }
			},
			requirements: {
				type: "string",
				required: true
			}
		}
	},
	{
		name: "pptx_insert_web_image",
		skillName: "insert_web_image",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。把网络图片插入当前页（返回更新页 + 新元素 id）。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			url: {
				type: "string",
				required: true,
				description: "图片直链"
			},
			xPx: { type: "number" },
			yPx: { type: "number" },
			wPx: { type: "number" },
			hPx: { type: "number" }
		}
	},
	{
		name: "pptx_crop_image",
		skillName: "crop_image",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。裁剪图片（srcRect 0..1 比例）。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			sourceId: {
				type: "string",
				required: true
			},
			srcRect: {
				type: "object",
				required: true,
				additionalProperties: true,
				properties: {
					x: { type: "number" },
					y: { type: "number" },
					w: { type: "number" },
					h: { type: "number" }
				}
			}
		}
	},
	{
		name: "pptx_set_picture_opacity",
		skillName: "set_picture_opacity",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。整图透明度（0..100）。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			sourceId: {
				type: "string",
				required: true
			},
			opacity: {
				type: "number",
				required: true,
				description: "0..100"
			}
		}
	},
	{
		name: "pptx_replace_image",
		skillName: "replace_image",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。原地替换图片（框/层级/效果保留）。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			sourceId: {
				type: "string",
				required: true
			},
			url: {
				type: "string",
				required: true,
				description: "新图片直链"
			}
		}
	},
	{
		name: "pptx_ask_clarification",
		skillName: "ask_clarification",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。向用户提出澄清问题（需 AI 面板交互，控制模式下不可用）。",
		parameters: {
			path: PATH_PARAM,
			questions: {
				type: "array",
				required: true,
				items: {
					type: "object",
					additionalProperties: true,
					properties: {
						label: { type: "string" },
						options: {
							type: "array",
							items: { type: "string" }
						}
					}
				}
			}
		}
	},
	{
		name: "pptx_plan_deck",
		skillName: "plan_deck",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。演示大纲规划。",
		parameters: {
			path: PATH_PARAM,
			core_hook: {
				type: "string",
				required: true,
				description: "核心钩子 / 主题一句话"
			},
			style: { type: "string" },
			pages: {
				type: "integer",
				description: "目标页数"
			}
		}
	},
	{
		name: "pptx_regenerate_slide",
		skillName: "regenerate_slide",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。按 brief 由当前会话模型写一页 PageSpec，再 land_pages replace_at（其他页不动）。也可直接传 page_spec 跳过规划。不要把 brief 交给 iframe 打 LLM。先 read_slide；需要图时把真实 http(s) URL 放进 image_urls。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true,
				description: "要重做的页（0 起）"
			},
			brief: {
				type: "string",
				description: "新页内容与布局说明：各区域放什么、用什么 layout（如 three_column_cards）。无 page_spec 时必填。"
			},
			title: {
				type: "string",
				description: "页标题"
			},
			layout: {
				type: "string",
				description: "布局意图名（可选）"
			},
			image_urls: {
				type: "array",
				items: { type: "string" },
				description: "本页真实 http(s) 图片 URL；没有则 []"
			},
			page_spec: {
				type: "object",
				additionalProperties: true,
				description: "已写好的单页 PageSpec（background + elements）；有则跳过规划直接 land"
			},
			dataSource: {
				type: "string",
				enum: [
					"user",
					"document",
					"search",
					"sample"
				],
				description: "brief 含具体数字时必填：数字来源"
			}
		}
	},
	{
		name: "pptx_delete_slide",
		skillName: "delete_slide",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。删除一页（只剩一页时拒绝）。返回完整页数组。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			}
		}
	},
	{
		name: "pptx_land_pages",
		skillName: "land_pages",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。把宿主写好的 PageSpec[] 落入当前稿（iframe 只落地，不打 LLM）。pages 每页须有 elements[]，元素含 type/x/y/w/h；画布 1280×720。insert_mode 缺省 replace；replace_at/insert_at 需 pages.length===1 且整数 at_index。落地不写盘。",
		parameters: {
			path: PATH_PARAM,
			pages: {
				type: "array",
				required: true,
				description: "PageSpec 数组：background + elements（shape/text/image）",
				items: {
					type: "object",
					additionalProperties: true
				}
			},
			insert_mode: {
				type: "string",
				enum: [
					"replace",
					"append",
					"replace_at",
					"insert_at"
				],
				description: "replace（默认）/ append / replace_at / insert_at"
			},
			at_index: {
				type: "integer",
				description: "replace_at / insert_at 的页索引（0 起）"
			},
			deck_name: {
				type: "string",
				description: "可选稿名"
			}
		}
	},
	{
		name: "pptx_generate_deck",
		skillName: "generate_deck",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。用当前 DSH 会话模型写 PageSpec[]，再 land_pages 落地（不转发 iframe generate_deck，不配 iframe key）。推荐 topic + approx_pages；也可直接传 pages_spec。空白稿出片后解锁 add_text_box / add_shape。落地不写盘。",
		parameters: {
			path: PATH_PARAM,
			topic: {
				type: "string",
				description: "演示主题/需求（与 approx_pages 搭配时由宿主规划，不必手写 pages）"
			},
			approx_pages: {
				type: "integer",
				description: "期望页数（与 topic 联用）"
			},
			context: {
				type: "string",
				description: "可选：真实材料/数据/问卷答案"
			},
			core_hook: {
				type: "string",
				description: "可选：已定叙事锚点（与 pages 联用时推荐）"
			},
			style: {
				type: "string",
				description: "统一设计系统（与 pages 联用时需要；与 topic 联用时作风格提示）"
			},
			pages: {
				type: "array",
				description: "可选：已知道每页时直接传入；每项 title/brief/layout 必填",
				items: {
					type: "object",
					additionalProperties: true,
					properties: {
						title: { type: "string" },
						type: {
							type: "string",
							description: "cover|content|data|closing"
						},
						brief: { type: "string" },
						layout: { type: "string" },
						image_queries: {
							type: "array",
							items: { type: "string" }
						}
					}
				}
			},
			pages_spec: {
				type: "array",
				description: "已写好的 PageSpec[]；有则跳过规划直接 land_pages",
				items: {
					type: "object",
					additionalProperties: true
				}
			},
			insert_mode: {
				type: "string",
				enum: ["replace", "append"],
				description: "replace（默认，整套替换）或 append（追加到末尾）"
			},
			style_template: {
				type: "string",
				description: "已保存样式模板名（跳过风格生成）"
			},
			dataSource: {
				type: "string",
				enum: [
					"user",
					"document",
					"search",
					"sample"
				],
				description: "topic/context/briefs 含具体数字时必填：数字来源"
			}
		}
	},
	{
		name: "pptx_save_style_template",
		skillName: "save_style_template",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。保存样式模板（网页版不可用，返回错误）。",
		parameters: {
			path: PATH_PARAM,
			name: {
				type: "string",
				required: true
			},
			styleSkill: {
				type: "string",
				required: true
			}
		}
	},
	{
		name: "pptx_list_style_templates",
		skillName: "list_style_templates",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。列出样式模板（网页版返回空）。",
		parameters: { path: PATH_PARAM }
	},
	{
		name: "pptx_add_slide",
		skillName: "add_slide",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。在指定页之后复制一页（clearText=true 清空文本）。",
		parameters: {
			path: PATH_PARAM,
			sourceIndex: {
				type: "integer",
				required: true,
				description: "复制源页码（0 起）"
			},
			clearText: { type: "boolean" }
		}
	},
	{
		name: "pptx_add_text_box",
		skillName: "add_text_box",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。添加文本框（x/y/w/h 像素；paragraphs 富文本）。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			x: {
				type: "number",
				required: true
			},
			y: {
				type: "number",
				required: true
			},
			w: {
				type: "number",
				required: true
			},
			h: {
				type: "number",
				required: true
			},
			paragraphs: {
				type: "array",
				description: "富文本段落",
				items: {
					type: "object",
					additionalProperties: true
				}
			}
		}
	},
	{
		name: "pptx_add_shape",
		skillName: "add_shape",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。添加形状（kind 形状预设，fillColor / paragraphs 可选）。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			kind: {
				type: "string",
				required: true,
				description: "形状预设名"
			},
			x: {
				type: "number",
				required: true
			},
			y: {
				type: "number",
				required: true
			},
			w: {
				type: "number",
				required: true
			},
			h: {
				type: "number",
				required: true
			},
			fillColor: {
				type: "string",
				description: "#RRGGBB"
			},
			paragraphs: {
				type: "array",
				description: "形状内文本段落",
				items: {
					type: "object",
					additionalProperties: true
				}
			}
		}
	},
	{
		name: "pptx_add_chart",
		skillName: "add_chart",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。添加图表（网页版不可用，返回错误）。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			kind: {
				type: "string",
				required: true
			}
		}
	},
	{
		name: "pptx_add_smartart",
		skillName: "add_smartart",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。插入 SmartArt 风格示意图（list=纵向列表、process=流程箭头、cycle=循环、hierarchy=层级、pyramid=金字塔、matrix=2x2、venn=维恩）。items 为节点文本。省略 x/y/w/h 时居中。空白 deck 会被上游守卫拒绝。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			layout: {
				type: "string",
				required: true,
				enum: [
					"list",
					"process",
					"cycle",
					"hierarchy",
					"pyramid",
					"matrix",
					"venn"
				],
				description: "示意图布局"
			},
			items: {
				type: "array",
				required: true,
				items: { type: "string" },
				description: "节点文本（建议 2–8 项）"
			},
			x: { type: "number" },
			y: { type: "number" },
			w: { type: "number" },
			h: { type: "number" }
		}
	},
	{
		name: "pptx_add_table",
		skillName: "add_table",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。添加表格（网页版不可用，返回错误）。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			rows: {
				type: "integer",
				required: true
			},
			cols: {
				type: "integer",
				required: true
			}
		}
	},
	{
		name: "pptx_edit_table_cell",
		skillName: "edit_table_cell",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。编辑表格单元格文本（网页版不可用，返回错误）。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			sourceId: {
				type: "string",
				required: true
			},
			cellId: {
				type: "string",
				required: true
			},
			text: {
				type: "string",
				required: true
			}
		}
	},
	{
		name: "pptx_edit_table_structure",
		skillName: "edit_table_structure",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。表格行列增删（网页版不可用，返回错误）。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			sourceId: {
				type: "string",
				required: true
			},
			action: {
				type: "string",
				required: true,
				enum: [
					"addRow",
					"addCol",
					"delRow",
					"delCol"
				]
			}
		}
	},
	{
		name: "pptx_edit_table_style",
		skillName: "edit_table_style",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。编辑表格样式（网页版不可用，返回错误）。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			sourceId: {
				type: "string",
				required: true
			},
			style: {
				type: "object",
				required: true,
				additionalProperties: true
			}
		}
	},
	{
		name: "pptx_edit_chart",
		skillName: "edit_chart",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。编辑图表数据（网页版不可用，返回错误）。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			sourceId: {
				type: "string",
				required: true
			},
			data: {
				type: "object",
				required: true,
				additionalProperties: true
			}
		}
	},
	{
		name: "pptx_set_slide_background",
		skillName: "set_slide_background",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。设置页面背景色。slideIndex=-1 应用到所有页。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true,
				description: "页码（0 起）；-1 = 全部"
			},
			color: {
				type: "string",
				required: true,
				description: "#RRGGBB"
			}
		}
	},
	{
		name: "pptx_delete_element",
		skillName: "delete_element",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。删除页内一个元素。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			sourceId: {
				type: "string",
				required: true
			}
		}
	},
	{
		name: "pptx_ungroup_element",
		skillName: "ungroup_element",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。取消组合（网页版不可用，返回错误）。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			sourceId: {
				type: "string",
				required: true
			}
		}
	},
	{
		name: "pptx_apply_ops",
		skillName: "apply_ops",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。以一笔事务应用一组官方原子编辑 op（默认 atomic：失败全回滚）。dry_run=true 只校验不改稿。多页/大量元素批处理用这个；单页排版优先 execute_slide_script，单个编辑优先专用工具。网页版走 applyTxn → runTxn（空或超过 50 个 op 拒绝；per_op 失败跳过）。",
		parameters: {
			path: PATH_PARAM,
			ops: {
				type: "array",
				required: true,
				description: "op 列表，按顺序作为一笔事务（最多 50）",
				items: {
					type: "object",
					additionalProperties: true
				}
			},
			dry_run: {
				type: "boolean",
				description: "只校验计划，不改稿"
			},
			isolation: {
				type: "string",
				enum: ["atomic", "per_op"],
				description: "atomic 默认全成或全败；per_op 失败跳过"
			}
		}
	},
	{
		name: "pptx_save",
		skillName: "save",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。将当前演示文稿内容显式写回原文件（原子写回，tmp+rename）。编辑工具只修改网页内状态，只有本工具（或 tab「写入磁盘」按钮）会真正写盘。",
		parameters: SAVE_PARAMS
	},
	{
		name: "pdf_read_pages",
		skillName: "read_pages",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。读取一页或多页的文本内容（带 [Page N] 标记）。回答文档内容问题前先读取相关页；一次最多 10 页。",
		parameters: {
			path: PATH_PARAM,
			start: {
				type: "integer",
				required: true,
				description: "起始页码（1 起）"
			},
			end: {
				type: "integer",
				description: "结束页码（含）；省略只读起始页"
			}
		}
	},
	{
		name: "pdf_search_text",
		skillName: "search_text",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。全文搜索字符串，返回页码与上下文摘录。定位某内容在哪一页时优先用本工具。",
		parameters: {
			path: PATH_PARAM,
			query: {
				type: "string",
				required: true,
				description: "搜索文本（大小写不敏感）"
			}
		}
	},
	{
		name: "pdf_goto_page",
		skillName: "goto_page",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。跳转到指定页（页码 1 起）；页已删除时返回 false。",
		parameters: {
			path: PATH_PARAM,
			page: {
				type: "integer",
				required: true,
				description: "目标页码（1 起）"
			}
		}
	},
	{
		name: "pdf_markup_text",
		skillName: "markup_text",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。给一段文本加标注（高亮/下划线/删除线）。text 必须是该页存在的原文片段（先用 read_pages 或 search_text 确认）；默认只标第一处，all=true 标全部。",
		parameters: {
			path: PATH_PARAM,
			page: {
				type: "integer",
				required: true,
				description: "页码（1 起）"
			},
			text: {
				type: "string",
				required: true,
				description: "页面上的原文片段"
			},
			type: {
				type: "string",
				required: true,
				enum: [
					"highlight",
					"underline",
					"strikeout"
				],
				description: "标注类型"
			},
			all: {
				type: "boolean",
				description: "是否标注该页所有出现处；默认 false"
			}
		}
	},
	{
		name: "pdf_edit_text",
		skillName: "edit_text",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。替换页面上一个短文本片段（改写 PDF 内容流，保存时生效）。old_text 必须是该页存在的原文；只改第一处（除非给 occurrence）。替换文本在原位置绘制、不重排页面，长度宜接近原文；不能删除文本（new_text 非空）。",
		parameters: {
			path: PATH_PARAM,
			page: {
				type: "integer",
				required: true,
				description: "页码（1 起）"
			},
			old_text: {
				type: "string",
				required: true,
				description: "页面上的原文片段"
			},
			new_text: {
				type: "string",
				required: true,
				description: "替换文本；\"\\n\" 分多行"
			},
			occurrence: {
				type: "integer",
				description: "第几处出现（1 起）；默认 1"
			},
			font_size: {
				type: "number",
				description: "新字号（pt）；省略保持原字号"
			},
			color: {
				type: "string",
				description: "新文本颜色 #RRGGBB；省略保持原色"
			},
			font: {
				type: "string",
				enum: [
					"arial",
					"times",
					"courier"
				],
				description: "替换字体"
			},
			bold: {
				type: "boolean",
				description: "加粗"
			},
			italic: {
				type: "boolean",
				description: "斜体"
			}
		}
	},
	{
		name: "pdf_edit_block",
		skillName: "edit_block",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。重写整段（自动换行重排，块内向下生长）。paragraph_text 是定位段落的独特片段（必须唯一匹配一段）；整段替换为 new_text。改几个词用 edit_text。",
		parameters: {
			path: PATH_PARAM,
			page: {
				type: "integer",
				required: true
			},
			paragraph_text: {
				type: "string",
				required: true,
				description: "定位段落的原文片段"
			},
			new_text: {
				type: "string",
				required: true,
				description: "整段替换文本"
			},
			font_size: { type: "number" },
			color: {
				type: "string",
				description: "#RRGGBB"
			},
			font: {
				type: "string",
				enum: [
					"arial",
					"times",
					"courier"
				]
			},
			bold: { type: "boolean" },
			italic: { type: "boolean" }
		}
	},
	{
		name: "pdf_insert_text",
		skillName: "insert_text",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。在页面上新增文本（叠在页面上，保存时生效）。空白页/空白区域用它；改已有文字用 edit_text / edit_block。x/y 是显示坐标系下文本块左上角（pt，从页顶/页左算）；省略则水平居中靠上。",
		parameters: {
			path: PATH_PARAM,
			page: {
				type: "integer",
				required: true,
				description: "页码（1 起）"
			},
			text: {
				type: "string",
				required: true,
				description: "要插入的文本；\"\\n\" 换行"
			},
			x: {
				type: "number",
				description: "文本块左边缘，距页左（pt）"
			},
			y: {
				type: "number",
				description: "文本块上边缘，距页顶（pt）"
			},
			font_size: {
				type: "number",
				description: "字号 pt，默认 14"
			},
			color: {
				type: "string",
				description: "颜色 #RRGGBB，默认黑"
			},
			max_width: {
				type: "number",
				description: "换行宽度（pt）；省略保持给定换行"
			},
			align: {
				type: "string",
				enum: [
					"left",
					"center",
					"right"
				],
				description: "行对齐，默认 left"
			},
			font: {
				type: "string",
				enum: [
					"arial",
					"times",
					"courier"
				]
			},
			bold: { type: "boolean" },
			italic: { type: "boolean" }
		}
	},
	{
		name: "pdf_image_search",
		skillName: "image_search",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。搜索图片返回链接列表（配合 insert_image）。",
		parameters: {
			path: PATH_PARAM,
			query: {
				type: "string",
				required: true,
				description: "图片搜索关键词（建议英文）"
			},
			max_results: {
				type: "integer",
				description: "最大结果数，默认 8"
			}
		}
	},
	{
		name: "pdf_generate_image",
		skillName: "generate_image",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。AI 图片生成。经本地中继调用 Genspark，浏览器不直连公网。",
		parameters: {
			path: PATH_PARAM,
			prompt: {
				type: "string",
				required: true
			},
			aspect_ratio: { type: "string" }
		}
	},
	{
		name: "pdf_list_page_images",
		skillName: "list_page_images",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。列出页内嵌入图片（位置/尺寸，1 起编号）。改图前先调用。",
		parameters: {
			path: PATH_PARAM,
			page: {
				type: "integer",
				description: "页码（1 起）；省略则列出每一页"
			}
		}
	},
	{
		name: "pdf_insert_image",
		skillName: "insert_image",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。插入本地图片到指定页。imagePath 为本机绝对路径。省略 x/y 时居中；width 为显示宽度（点），高度按比例。",
		parameters: {
			path: PATH_PARAM,
			page: {
				type: "integer",
				required: true
			},
			imagePath: {
				type: "string",
				required: true,
				description: "本机图片绝对路径"
			},
			x: {
				type: "number",
				description: "左边缘（点，从页左缘）"
			},
			y: {
				type: "number",
				description: "上边缘（点，从页顶）"
			},
			width: {
				type: "number",
				description: "显示宽度（点）；高度按图片比例"
			},
			anchor_text: {
				type: "string",
				description: "页内原文片段，用于相对定位"
			},
			placement: {
				type: "string",
				enum: [
					"below",
					"above",
					"right",
					"left"
				]
			},
			layer: {
				type: "string",
				enum: ["above_text", "below_text"]
			}
		}
	},
	{
		name: "pdf_transform_image",
		skillName: "transform_image",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。移动/缩放已有页内图片。image_number 来自 list_page_images。",
		parameters: {
			path: PATH_PARAM,
			page: {
				type: "integer",
				required: true
			},
			image_number: {
				type: "integer",
				required: true,
				description: "list_page_images 的 1 起编号"
			},
			x: { type: "number" },
			y: { type: "number" },
			width: { type: "number" },
			height: { type: "number" },
			layer: {
				type: "string",
				enum: ["above_text", "below_text"]
			}
		}
	},
	{
		name: "pdf_rotate_image",
		skillName: "rotate_image",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。旋转已有页内图片。cw=顺时针 90°，ccw=逆时针 90°，180=半圈。",
		parameters: {
			path: PATH_PARAM,
			page: {
				type: "integer",
				required: true
			},
			image_number: {
				type: "integer",
				required: true,
				description: "list_page_images 的 1 起编号"
			},
			direction: {
				type: "string",
				enum: [
					"cw",
					"ccw",
					"180"
				],
				required: true
			}
		}
	},
	{
		name: "pdf_replace_image",
		skillName: "replace_image",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。原地替换页内图片像素（位置/层级不变）。imagePath 为本机绝对路径。",
		parameters: {
			path: PATH_PARAM,
			page: {
				type: "integer",
				required: true
			},
			image_number: {
				type: "integer",
				required: true,
				description: "list_page_images 的 1 起编号"
			},
			imagePath: {
				type: "string",
				required: true,
				description: "本机图片绝对路径"
			}
		}
	},
	{
		name: "pdf_delete_image",
		skillName: "delete_image",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。删除页内图片。image_number 来自 list_page_images。",
		parameters: {
			path: PATH_PARAM,
			page: {
				type: "integer",
				required: true
			},
			image_number: {
				type: "integer",
				required: true,
				description: "list_page_images 的 1 起编号"
			}
		}
	},
	{
		name: "pdf_list_form_fields",
		skillName: "list_form_fields",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。列出表单字段。",
		parameters: { path: PATH_PARAM }
	},
	{
		name: "pdf_fill_form_field",
		skillName: "fill_form_field",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。填写表单字段。",
		parameters: {
			path: PATH_PARAM,
			name: {
				type: "string",
				required: true,
				description: "字段名"
			},
			value: {
				type: "string",
				required: true
			},
			checked: {
				type: "boolean",
				description: "复选框是否勾选"
			}
		}
	},
	{
		name: "pdf_rotate_page",
		skillName: "rotate_page",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。旋转页面（direction: left/right，90°）。",
		parameters: {
			path: PATH_PARAM,
			page: {
				type: "integer",
				required: true
			},
			direction: {
				type: "string",
				enum: ["left", "right"],
				required: true
			}
		}
	},
	{
		name: "pdf_delete_page",
		skillName: "delete_page",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。删除页面（至少保留一页）。",
		parameters: {
			path: PATH_PARAM,
			page: {
				type: "integer",
				required: true
			}
		}
	},
	{
		name: "pdf_get_outline",
		skillName: "get_outline",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。读取文档大纲（书签层级）。",
		parameters: { path: PATH_PARAM }
	},
	{
		name: "pdf_save",
		skillName: "save",
		app: "pdf",
		description: "该工具操作 GenOffice 网页版中已打开的 pdf 文档（控制模式）。所有标注/编辑先改 iframe 内状态，只有 pdf_save 或 tab「写入磁盘」才会写回原文件。页码 1 起。将当前文档（含标注与文本改写）显式写回原文件（原子写回，tmp+rename）。编辑工具只修改网页内状态，只有本工具（或 tab「写入磁盘」按钮）会真正写盘。",
		parameters: SAVE_PARAMS
	}
];
/** Write-back trigger (BR-008). Only the five `*_save` rows; `save_style_template` is a skill, not disk write-back. */
function isSaveEntry(entry) {
	return entry.skillName === "save";
}
//#endregion
//#region src/host/tools.ts
/**
* Host tools: GenOffice control plane via relay POST /api/control/<app>/<docId>/…
*
* Registration is filtered by CAPABILITY (BR-001 / BR-015). The table lists
* every control tool (docx 11 + markdown 5 + xlsx 13 + pptx 39 + pdf 21 = 89);
* a row without a CAPABILITY key is not registered. DSH_GENOFFICE_ALL_TOOLS=1
* re-opens the filter.
* Write-back only through *_save and the tab button (BR-011).
* pptx_generate_deck / pptx_regenerate_slide plan on the session model then
* land_pages — they must not POST iframe generate_deck / regenerate_slide.
*/
const RELAY_BASE = "http://localhost:8787";
const CONTROL_TIMEOUT_MS = 7e4;
const GENERATE_DECK_TIMEOUT_MS = 3e5;
/** How long `*_open` waits for the control iframe to register on relay. */
const OPEN_READY_MS = 2e4;
const OPEN_POLL_MS = 250;
const LAND_SETTLE_MS = 8e3;
const LAND_POLL_MS = 250;
async function sha256Hex(s) {
	const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const OPEN_TOOL_BY_APP = {
	docs: "docx_open",
	markdown: "md_open",
	sheets: "xlsx_open",
	slides: "pptx_open",
	pdf: "pdf_open"
};
function describeEntry(entry, cap, allTools) {
	let d = entry.description;
	const openName = OPEN_TOOL_BY_APP[entry.app];
	if (openName !== void 0) d = `须先 ${openName} 等到「已打开控制模式」再调用。${d}`;
	if (cap === void 0) return d;
	if (allTools && cap.netEgress) d = `【会向公网发起请求】${d}`;
	if (allTools && cap.handover === "dsh:web_search") d = `【已交还 DSH，请改用 web_search】${d}`;
	if (allTools && cap.handover === "dsh:pending") d = `【已划归 DSH 侧，本包不提供】${d}`;
	if (cap.status === "partial") d = `【部分可用】${d}`;
	if (cap.status === "guarded") d = `【上游守卫】空白或元素过少的 deck 上会被拒绝，请改写已有页面。${d}`;
	return d;
}
function shouldRegister(entry, opts) {
	if (opts.allTools) return true;
	const cap = capabilityOf(entry.app, entry.skillName);
	if (cap === void 0 || !isExposed(cap)) return false;
	if ((entry.name === "docx_insert_image" || entry.name === "pdf_insert_image" || entry.name === "pdf_replace_image") && !opts.assetsAvailable) return false;
	return true;
}
function sleep(ms, signal) {
	return new Promise((resolve, reject) => {
		if (signal.aborted) {
			reject(signal.reason instanceof Error ? signal.reason : /* @__PURE__ */ new Error("aborted"));
			return;
		}
		const timer = setTimeout(resolve, ms);
		const onAbort = () => {
			clearTimeout(timer);
			reject(signal.reason instanceof Error ? signal.reason : /* @__PURE__ */ new Error("aborted"));
		};
		signal.addEventListener("abort", onAbort, { once: true });
	});
}
/**
* Poll relay until the control iframe has registered an executor for `path`.
* Old relays without `registered` are treated as ready (do not block open).
*/
async function waitUntilRegistered(path, signal) {
	const deadline = Date.now() + OPEN_READY_MS;
	while (Date.now() < deadline) {
		if (signal.aborted) return false;
		try {
			const resp = await fetch(`${RELAY_BASE}/api/control/open`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path }),
				signal
			});
			if (resp.ok) {
				const data = await resp.json();
				if (data.registered === true) return true;
				if (data.registered === void 0) return true;
			}
		} catch (e) {
			if (signal.aborted) return false;
			if (e instanceof Error && e.name === "AbortError") return false;
		}
		try {
			await sleep(OPEN_POLL_MS, signal);
		} catch {
			return false;
		}
	}
	return false;
}
function fail(error, path, kind) {
	const input = { error };
	if (path !== void 0) input.path = path;
	if (kind !== void 0) input.kind = kind;
	throw new Error(classifyControlError(input).message);
}
async function callRelay(entry, input, signal) {
	const path = String(input.path ?? "");
	if (!path.startsWith("/")) fail("path 必须是目标文件的本机绝对路径", path, "local");
	if (isInSyncWindow(path)) fail("sync window", path, "sync");
	const docId = await sha256Hex(path);
	const { path: _strip, ...skillInput } = input;
	let resp;
	try {
		resp = await fetch(`${RELAY_BASE}/api/control/${entry.app}/${docId}/tool`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			signal,
			body: JSON.stringify({ call: {
				id: crypto.randomUUID(),
				name: entry.skillName,
				input: skillInput
			} })
		});
	} catch (e) {
		fail(e instanceof Error ? e.message : String(e), path, "fetch");
	}
	if (!resp.ok) {
		const text = await resp.text().catch(() => "");
		fail(`relay 返回 HTTP ${resp.status}${text ? `: ${text}` : ""}`, path, "fetch");
	}
	const data = await resp.json();
	if (!data.ok) fail(String(data.error ?? "unknown error"), path, "relay");
	const execution = data.execution ?? {};
	if (execution.isError) fail(String(execution.output ?? "executor error"), path, "executor");
	return {
		ok: true,
		output: String(execution.output ?? ""),
		summary: String(execution.summary ?? entry.skillName)
	};
}
async function saveViaRelay(entry, input, signal) {
	const path = String(input.path ?? "");
	if (!path.startsWith("/")) fail("path 必须是目标文件的本机绝对路径", path, "local");
	if (isInSyncWindow(path)) fail("sync window", path, "sync");
	const saveAsRaw = input.save_as;
	if (saveAsRaw !== void 0 && saveAsRaw !== "") {
		if (typeof saveAsRaw !== "string" || !saveAsRaw.startsWith("/")) fail("save_as 必须是本机绝对路径", path, "local");
	}
	const docId = await sha256Hex(path);
	const body = { path };
	if (typeof saveAsRaw === "string" && saveAsRaw !== "") body.saveAs = saveAsRaw;
	let resp;
	try {
		resp = await fetch(`${RELAY_BASE}/api/control/${entry.app}/${docId}/export`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			signal,
			body: JSON.stringify(body)
		});
	} catch (e) {
		fail(e instanceof Error ? e.message : String(e), path, "fetch");
	}
	if (!resp.ok) {
		const text = await resp.text().catch(() => "");
		fail(`relay 返回 HTTP ${resp.status}${text ? `: ${text}` : ""}`, path, "fetch");
	}
	const data = await resp.json();
	if (!data.ok) fail(String(data.error ?? "unknown error"), path, "relay");
	if (body.saveAs !== void 0) return {
		ok: true,
		output: `已另存为 ${data.path ?? body.saveAs}`,
		summary: "已另存为"
	};
	if (typeof data.mtimeMs !== "number") markSyncWindow(path);
	return {
		ok: true,
		output: `已保存到 ${data.path ?? path}`,
		summary: "已保存"
	};
}
const READ_SKILLS = /* @__PURE__ */ new Set([
	"get_document_context",
	"read_blocks",
	"web_search",
	"image_search",
	"get_workbook_context",
	"read_range",
	"load_guide",
	"read_formats",
	"read_sheet_features",
	"read_cells",
	"get_deck_context",
	"read_slide",
	"analyze_media",
	"list_style_templates",
	"read_pages",
	"search_text",
	"goto_page",
	"list_page_images",
	"list_form_fields",
	"get_outline"
]);
function callKindFor(entry) {
	if (READ_SKILLS.has(entry.skillName)) return "read";
	return "edit";
}
async function executeInsertImage(entry, input, signal, assets) {
	const path = String(input.path ?? "");
	const imagePath = String(input.imagePath ?? "");
	if (assets === void 0 || assets === null || !assets.available) fail("资产通道不可用：当前组合没有 webServer", path, "capability");
	if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) fail("插图只接受本机路径，不接受公网 URL（BR-016）", path, "local");
	let published;
	try {
		published = await assets.publish(imagePath);
	} catch (e) {
		fail(e instanceof Error ? e.message : String(e), path, "local");
	}
	try {
		const { imagePath: _drop, ...rest } = input;
		return await callRelay(entry, {
			...rest,
			url: published.url
		}, signal);
	} finally {
		published.dispose();
	}
}
function landPagesEntry() {
	const entry = CONTROL_TOOL_TABLE.find((row) => row.skillName === "land_pages");
	if (entry === void 0) throw new Error("planning failed: pptx_land_pages is not in CONTROL_TOOL_TABLE");
	return entry;
}
function planningFail(error, path) {
	const raw = error instanceof Error ? error.message : String(error);
	fail(raw.startsWith("planning failed:") ? raw : `planning failed: ${raw}`, path, "local");
}
function isTimeoutError(error) {
	const raw = error instanceof Error ? error.message : String(error);
	return /timeout/i.test(raw);
}
async function callRelayRetry(entry, input, signal) {
	let last;
	for (let attempt = 0; attempt < 3; attempt++) try {
		return await callRelay(entry, input, signal);
	} catch (e) {
		last = e;
		if (!isTimeoutError(e) || attempt === 2) throw e;
		await sleep(400, signal);
	}
	throw last instanceof Error ? last : new Error(String(last));
}
function parseLandedCount(output) {
	const m = output.match(/Deck now has (\d+) page/i);
	if (m === null) return void 0;
	return Number(m[1]);
}
function parseDeckPageCount(output) {
	const m = output.match(/The presentation has (\d+) pages?/i);
	if (m === null) return void 0;
	return Number(m[1]);
}
function contextHasElements(output) {
	return /\|\s*(text|shape|image)\s*\|/i.test(output);
}
function firstTextNeedle(pages) {
	if (!Array.isArray(pages) || pages.length === 0) return void 0;
	const page = pages[0];
	if (typeof page !== "object" || page === null || !("elements" in page)) return void 0;
	const elements = page.elements;
	if (!Array.isArray(elements)) return void 0;
	for (const el of elements) {
		if (typeof el !== "object" || el === null) continue;
		const rec = el;
		if (rec.type !== "text") continue;
		const paragraphs = rec.paragraphs;
		if (!Array.isArray(paragraphs) || paragraphs.length === 0) continue;
		const para = paragraphs[0];
		if (typeof para !== "object" || para === null) continue;
		const runs = para.runs;
		if (!Array.isArray(runs) || runs.length === 0) continue;
		const run = runs[0];
		if (typeof run !== "object" || run === null) continue;
		const text = run.text;
		if (typeof text === "string" && text.trim().length > 0) return text.trim().slice(0, 24);
	}
}
function deckContextEntry() {
	return CONTROL_TOOL_TABLE.find((row) => row.skillName === "get_deck_context");
}
async function waitLanded(path, expectedPages, signal, needle, settle) {
	const entry = deckContextEntry();
	if (entry === void 0) return;
	const deadline = Date.now() + settle.settleMs;
	for (;;) {
		if (signal.aborted) return;
		let output = "";
		try {
			output = (await callRelay(entry, { path }, signal)).output;
		} catch {
			output = "";
		}
		const n = parseDeckPageCount(output);
		const pagesOk = n !== void 0 && n === expectedPages;
		const filled = contextHasElements(output);
		const needleOk = needle === void 0 || output.includes(needle);
		if (pagesOk && filled && needleOk) return;
		if (Date.now() >= deadline) return;
		try {
			await sleep(settle.pollMs, signal);
		} catch {
			return;
		}
	}
}
async function executeLandPages(input, signal, settle) {
	const result = await callRelayRetry(landPagesEntry(), input, signal);
	const expected = parseLandedCount(result.output);
	if (expected !== void 0) await waitLanded(String(input.path ?? ""), expected, signal, firstTextNeedle(input.pages), settle);
	return result;
}
async function executeGenerateDeck(input, signal, planLlm, settle) {
	const path = String(input.path ?? "");
	let pages;
	try {
		pages = await planDeckPages(input, planLlm, signal);
	} catch (e) {
		planningFail(e, path);
	}
	const landInput = {
		path,
		pages,
		insert_mode: input.insert_mode === "append" ? "append" : "replace"
	};
	if (typeof input.deck_name === "string") landInput.deck_name = input.deck_name;
	return await executeLandPages(landInput, signal, settle);
}
async function executeRegenerateSlide(input, signal, planLlm, settle) {
	const path = String(input.path ?? "");
	const atIndex = input.slideIndex;
	if (typeof atIndex !== "number" || !Number.isInteger(atIndex) || atIndex < 0) fail("slideIndex 必须是 ≥0 的整数", path, "local");
	let page;
	try {
		page = await planOnePageSpec(input, planLlm, signal);
	} catch (e) {
		planningFail(e, path);
	}
	return await executeLandPages({
		path,
		pages: [page],
		insert_mode: "replace_at",
		at_index: atIndex
	}, signal, settle);
}
/** Build the control tool definitions from the contract mirror table. */
function createControlTools(opts = {}) {
	const allTools = opts.allTools ?? process.env.DSH_GENOFFICE_ALL_TOOLS === "1";
	const assetsAvailable = opts.assets?.available === true;
	const settle = {
		settleMs: opts.landSettleMs ?? LAND_SETTLE_MS,
		pollMs: opts.landPollMs ?? LAND_POLL_MS
	};
	return [...CONTROL_TOOL_TABLE.filter((entry) => shouldRegister(entry, {
		allTools,
		assetsAvailable
	})).map((entry) => {
		const isSave = isSaveEntry(entry);
		const cap = capabilityOf(entry.app, entry.skillName);
		return defineTool({
			name: entry.name,
			description: describeEntry(entry, cap, allTools),
			parameters: entry.parameters,
			timeoutMs: entry.name === "pptx_generate_deck" ? GENERATE_DECK_TIMEOUT_MS : CONTROL_TIMEOUT_MS,
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						ok: {
							type: "boolean",
							required: true
						},
						output: {
							type: "string",
							required: true
						},
						summary: {
							type: "string",
							required: true
						}
					}
				},
				render: (_args, value) => [{
					type: "text",
					text: value.output
				}]
			},
			presentCall: (args) => {
				const path = String(args.path ?? "");
				return {
					card: "generic",
					title: entry.name,
					kind: callKindFor(entry),
					rawInput: path,
					...isSave && path.startsWith("/") ? { locations: [{ path }] } : {}
				};
			},
			presentResult: (_args, result) => ({
				card: "generic",
				title: result.isError ? `${entry.name} 失败` : entry.name
			}),
			async execute(args, exec) {
				const input = args;
				if (entry.name === "docx_insert_image" || entry.name === "pdf_insert_image" || entry.name === "pdf_replace_image") return await executeInsertImage(entry, input, exec.signal, opts.assets);
				if (isSave) {
					const result = await saveViaRelay(entry, input, exec.signal);
					return {
						ok: result.ok,
						output: result.output,
						summary: result.summary
					};
				}
				if (entry.name === "pptx_generate_deck") {
					const planLlm = opts.planLlm ?? sessionPlanLlm(exec.agent);
					return await executeGenerateDeck(input, exec.signal, planLlm, settle);
				}
				if (entry.name === "pptx_regenerate_slide") {
					const planLlm = opts.planLlm ?? sessionPlanLlm(exec.agent);
					return await executeRegenerateSlide(input, exec.signal, planLlm, settle);
				}
				if (entry.skillName === "land_pages") return await executeLandPages(input, exec.signal, settle);
				const result = await callRelay(entry, input, exec.signal);
				return {
					ok: result.ok,
					output: result.output,
					summary: result.summary
				};
			}
		});
	}), ...createOpenTools()];
}
const OPEN_TOOL_EXTS = [
	"pptx",
	"docx",
	"xlsx",
	"md",
	"pdf"
];
function openToolDesc(ext) {
	return `【必做第一步】用 GenOffice 控制模式打开本机 .${ext} 文件。做或改该类型文档时必须先调用本工具，等到返回「已打开控制模式」后才能调用其它 ${ext}_* 工具。禁止用 python、python-pptx、soffice、skill ppt-image-first、third-imagegen 代替本工具。path 为本机绝对路径，文件必须存在。`;
}
/** Open tools: POST /api/open — bypasses the control plane (no docId needed). */
function createOpenTools() {
	return OPEN_TOOL_EXTS.map((ext) => defineTool({
		name: `${ext}_open`,
		description: openToolDesc(ext),
		parameters: { path: {
			type: "string",
			description: "目标文件的本机绝对路径",
			required: true
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					ok: {
						type: "boolean",
						required: true
					},
					output: {
						type: "string",
						required: true
					},
					summary: {
						type: "string",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: value.output
			}]
		},
		presentCall: (args) => ({
			card: "generic",
			title: `${ext}_open`,
			kind: "read",
			rawInput: String(args.path ?? "")
		}),
		presentResult: (_args, result) => ({
			card: "generic",
			title: result.isError ? `${ext}_open 失败` : `${ext}_open`
		}),
		async execute(args, exec) {
			const filePath = String(args.path ?? "");
			if (!filePath.startsWith("/")) fail("path 必须是目标文件的本机绝对路径", filePath, "local");
			const slash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
			if (!(slash < 0 ? filePath : filePath.slice(slash + 1)).toLowerCase().endsWith(`.${ext}`)) fail(`path 必须是 .${ext} 文件`, filePath, "local");
			let resp;
			try {
				const sessionId = exec.agent?.id;
				const body = { path: filePath };
				if (typeof sessionId === "string" && sessionId !== "") body.sessionId = sessionId;
				resp = await fetch(`${RELAY_BASE}/api/open`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
					signal: exec.signal
				});
			} catch (e) {
				throw new Error(`open failed: ${e instanceof Error ? e.message : String(e)}`);
			}
			if (!resp.ok) {
				const body = await resp.json().catch(() => ({}));
				const msg = typeof body["error"] === "string" ? body["error"] : `HTTP ${resp.status}`;
				throw new Error(`open failed: ${msg}`);
			}
			const data = await resp.json();
			if (data["ok"] !== true) {
				const msg = typeof data["error"] === "string" ? data["error"] : "未知错误";
				throw new Error(`open failed: ${msg}`);
			}
			if (data["subscribers"] === 0) fail("没有 DSH 页面在监听 /api/open/stream —— 请先在浏览器打开 DSH（默认 http://127.0.0.1:3080）再重试", filePath, "relay");
			if (!await waitUntilRegistered(filePath, exec.signal)) fail("executor not registered", filePath, "relay");
			return {
				ok: true,
				output: `已打开控制模式：${filePath}`,
				summary: "打开文件"
			};
		}
	}));
}
//#endregion
//#region src/index.ts
/** Plugin name (host half). */
const name = "dsh-tab-genoffice";
/** Required services: the host tool registry. webServer / systemPrompt / skills are nested. */
const inject = ["tools"];
/**
* Plugin host body.
* @param ctx - host root context.
*/
function apply(ctx) {
	applyPrompt(ctx);
	applySkill(ctx);
	applySyncRoute(ctx);
	applyRelayLaunchRoute(ctx);
	const assets = createAssetChannel(ctx);
	for (const tool of createControlTools({ assets })) ctx.tools.register(tool);
}
//#endregion
export { apply, inject, name };
