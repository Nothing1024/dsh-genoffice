import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region src/host/lookup.ts
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
		status: "cloud-only",
		netEgress: false,
		evidence: "web-bridge.ts:220-224 cloudGenStatus.enabled=false / htmlToPptx 报错"
	},
	"slides:delete_slide": {
		status: "available",
		netEgress: false,
		evidence: "web-bridge.ts:226,308-336,356-421 均为真实实现"
	},
	"slides:generate_deck": {
		status: "cloud-only",
		netEgress: false,
		evidence: "web-bridge.ts:220-224 cloudGenStatus.enabled=false / htmlToPptx 报错"
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
	if (entry.status === "cloud-only") return "依赖云生成 / 桌面版";
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
		"本机 GenOffice 是 web 部署，不是桌面版。工具只改已经在控制模式打开的文档；写盘只有 *_save 或界面「写入磁盘」。",
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
		message: triple("该能力在本机 GenOffice web 部署下不可用，本不该被调用。", err, "改用系统提示词里给出的替代（检索用 web_search；插图用本机 imagePath；表格/图表/云出片请改桌面版）。")
	};
	if (input.kind === "fetch" || /econnrefused|fetch failed|failed to fetch|networkerror|relay 返回 http/i.test(err)) return {
		class: "relay-down",
		message: triple("GenOffice relay 不可达。控制工具需要本机 localhost:8787 上的中继。", err, "在 GenOffice 仓库执行 `node web/server.mjs`（或 `npm run web`），然后点侧栏「重新检查」。")
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
	if (input.kind === "executor" && GUARD_RE.test(err) || GUARD_RE.test(err)) return {
		class: "upstream-guard",
		message: triple("上游策略拒绝了这次编辑（不是参数写错）。web 部署下空白 deck 无法靠手搭解锁。", err, "改为改写已有页面上的元素；从零出片请用桌面版 GenOffice。不要反复重试同一调用。")
	};
	if (input.kind === "local") return {
		class: "invalid-params",
		message: triple("本机参数校验失败。", err, "修正 path / imagePath 后重试（必须是绝对路径，且不得含 ..）。")
	};
	return {
		class: "unrecognized",
		message: triple("未识别的上游错误。", err, "根据原文判断是否需要重开文档或检查 relay；不要盲目重试。")
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
/**
* Tool table — the plugin-side mirror of contracts/control-api.md §4.
* 11 docx tools (10 skill + docx_save) and 5 markdown tools (4 skill + markdown_save).
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
		parameters: { path: PATH_PARAM }
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
		parameters: { path: PATH_PARAM }
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
		parameters: { path: PATH_PARAM }
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
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。用单页 HTML 重做一页（依赖 LLM 管线，控制模式下通常不可用）。",
		parameters: {
			path: PATH_PARAM,
			slideIndex: {
				type: "integer",
				required: true
			},
			html: {
				type: "string",
				required: true
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
		name: "pptx_generate_deck",
		skillName: "generate_deck",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。生成整套演示（依赖 LLM 管线，控制模式下通常不可用）。",
		parameters: {
			path: PATH_PARAM,
			topic: {
				type: "string",
				required: true
			},
			style: { type: "string" },
			approx_pages: { type: "integer" }
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
		name: "pptx_save",
		skillName: "save",
		app: "slides",
		description: "该工具操作 GenOffice 网页版中已打开的 pptx 演示文稿（控制模式）。所有编辑先改 iframe 内幻灯片，只有 pptx_save 或 tab「写入磁盘」才会写回原文件。页面索引 0 起，画布 1280×720。将当前演示文稿内容显式写回原文件（原子写回，tmp+rename）。编辑工具只修改网页内状态，只有本工具（或 tab「写入磁盘」按钮）会真正写盘。",
		parameters: { path: PATH_PARAM }
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
		parameters: { path: PATH_PARAM }
	}
];
/** Whether a table entry is the write-back trigger (BR-008). */
function isSaveEntry(entry) {
	return entry.skillName === "save";
}
//#endregion
//#region src/host/tools.ts
/**
* Host tools: GenOffice control plane via relay POST /api/control/<app>/<docId>/…
*
* Registration is filtered by CAPABILITY (BR-001 / BR-015). The table still
* lists all 81 entries; DSH_GENOFFICE_ALL_TOOLS=1 re-opens the filter.
* Write-back only through *_save and the tab button (BR-011).
*/
const RELAY_BASE = "http://localhost:8787";
const CONTROL_TIMEOUT_MS = 7e4;
async function sha256Hex(s) {
	const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function describeEntry(entry, cap, allTools) {
	let d = entry.description;
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
	const docId = await sha256Hex(path);
	let resp;
	try {
		resp = await fetch(`${RELAY_BASE}/api/control/${entry.app}/${docId}/export`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			signal,
			body: JSON.stringify({ path })
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
	markSyncWindow(path);
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
/** Build the control tool definitions from the contract mirror table. */
function createControlTools(opts = {}) {
	const allTools = opts.allTools ?? process.env.DSH_GENOFFICE_ALL_TOOLS === "1";
	const assetsAvailable = opts.assets?.available === true;
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
			timeoutMs: CONTROL_TIMEOUT_MS,
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
	"md"
];
const OPEN_TOOL_DESC = "用 GenOffice 侧栏打开指定本地文件（控制模式）。调用后侧栏会自动切换到该文件的编辑器；文件必须存在于本机。path 为本机绝对路径。";
/** Open tools: POST /api/open — bypasses the control plane (no docId needed). */
function createOpenTools() {
	return OPEN_TOOL_EXTS.map((ext) => defineTool({
		name: `${ext}_open`,
		description: OPEN_TOOL_DESC,
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
				resp = await fetch(`${RELAY_BASE}/api/open`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ path: filePath }),
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
			return {
				ok: true,
				output: `已发送打开指令：${filePath}`,
				summary: "打开文件"
			};
		}
	}));
}
//#endregion
//#region src/index.ts
/** Plugin name (host half). */
const name = "dsh-tab-genoffice";
/** Required services: the host tool registry. webServer / systemPrompt are nested. */
const inject = ["tools"];
/**
* Plugin host body.
* @param ctx - host root context.
*/
function apply(ctx) {
	applyPrompt(ctx);
	applySyncRoute(ctx);
	const assets = createAssetChannel(ctx);
	for (const tool of createControlTools({ assets })) ctx.tools.register(tool);
}
//#endregion
export { apply, inject, name };
