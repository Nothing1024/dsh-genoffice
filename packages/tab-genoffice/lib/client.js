window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-tab-genoffice",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/standard/cordis-acquire.ts
		/**
		* 构造一个 ServiceAcquire：
		* - 服务已到位（lookup 命中）→ 立即经 ctx.effect 挂载（disposer 归 fiber）；
		* - 未到位 → ctx.inject 等服务出现，出现后在子 ctx 的 effect 里挂载；
		* - 部署里永远不出现 → mount 一次都不跑（声明过的降级路径）。
		* acquire 返回的取消函数可提前卸载；与 fiber 卸载互为幂等。
		*/
		function acquireFromCordis(ctx, lookup, serviceName, label = `dsh-tab-genoffice: acquire ${serviceName}`) {
			return (mount) => {
				let cancelled = false;
				let unmount;
				const runMount = (service) => {
					if (cancelled) return () => {};
					const off = mount(service);
					unmount = () => {
						unmount = void 0;
						off();
					};
					return () => {
						unmount?.();
					};
				};
				const existing = lookup();
				if (existing !== void 0) ctx.effect(() => runMount(existing), label);
				else ctx.inject([serviceName], (child) => {
					const service = child[serviceName];
					const effect = child.effect;
					if (typeof effect === "function") effect.call(child, () => runMount(service), label);
					else runMount(service);
				});
				return () => {
					cancelled = true;
					unmount?.();
				};
			};
		}
		//#endregion
		//#region src/standard/coordinates.ts
		/** 客户端词典/翻译（client 半身 required）。 */
		const LOCALE = {
			apiVersion: "x-nothing1024.dsh.locale/v1alpha1",
			kind: "Locale"
		};
		/** better-sidebar 页签与 FileViewer 槽位（client 半身 optional peer）。 */
		const SIDEBAR_TAB = {
			apiVersion: "x-nothing1024.better-sidebar/v1alpha1",
			kind: "SidebarTab"
		};
		/** client facet 的声明镜像（RFC 0002 定案后进 manifest）。 */
		const CLIENT_REQUIRED = [LOCALE];
		const CLIENT_OPTIONAL = [SIDEBAR_TAB];
		//#endregion
		//#region src/standard/sdk.ts
		/** facet-api §7：所有标准 API 抛出的错误必须是 StandardError。 */
		var StandardError = class extends Error {
			code;
			contract;
			constructor(code, message, contract) {
				super(message);
				this.name = "StandardError";
				this.code = code;
				if (contract !== void 0) this.contract = contract;
			}
		};
		/** 坐标的规范化 key（与 standards/validate.mjs 的协商实现同构）。 */
		function coordKey(c) {
			return `${c.apiVersion} # ${c.kind}`;
		}
		/**
		* facet 定义的品牌符号。用 Symbol.for 注册到全局符号表：装载检查器
		* （standards/validate.mjs）和跨构建产物的消费方无需共享模块实例即可识别。
		*/
		const FACET_DEFINITION_BRAND = Symbol.for("dsh-community-standard.facet-definition");
		/** facet-api §2：`export default defineFacet(setup)` 的构造器。 */
		function defineFacet(setup) {
			return {
				[FACET_DEFINITION_BRAND]: true,
				setup
			};
		}
		/** 装载检查：默认导出是否是（任一构建实例的）facet 定义。 */
		function isFacetDefinition(value) {
			return typeof value === "object" && value !== null && value[FACET_DEFINITION_BRAND] === true && typeof value.setup === "function";
		}
		/**
		* 构造一个执行 facet-api 纪律的 activation：
		* 未声明即用 → E_CONTRACT_NOT_DECLARED；optional 缺席 get → E_CONTRACT_UNAVAILABLE；
		* 重复发布 → E_DUPLICATE_PUBLISH；dispose 后再用 → E_WRONG_STATE。
		*/
		function createActivation(options) {
			const declared = new Set(options.declared.map(coordKey));
			const contracts = options.contracts ?? /* @__PURE__ */ new Map();
			const publishTargets = options.publishTargets ?? /* @__PURE__ */ new Map();
			const cleanups = [];
			const published = /* @__PURE__ */ new Map();
			let state = "active";
			const assertActive = (api) => {
				if (state !== "active") throw new StandardError("E_WRONG_STATE", `${api}：activation 已 disposed`);
			};
			const assertDeclared = (coordinate, api) => {
				const key = coordKey(coordinate);
				if (!declared.has(key)) throw new StandardError("E_CONTRACT_NOT_DECLARED", `${api}：坐标 ${key} 未在 manifest requires.contracts 声明`, coordinate);
				return key;
			};
			return {
				activation: {
					extensions: { publish(coordinate, id, implementation) {
						assertActive("extensions.publish");
						const key = assertDeclared(coordinate, "extensions.publish");
						const target = publishTargets.get(key);
						if (target === void 0) throw new StandardError("E_CONTRACT_UNAVAILABLE", `extensions.publish：坐标 ${key} 不可用`, coordinate);
						const publishKey = `${key} :: ${id}`;
						if (published.has(publishKey)) throw new StandardError("E_DUPLICATE_PUBLISH", `重复发布：${publishKey}`, coordinate);
						const off = target(id, implementation);
						const release = () => {
							if (!published.delete(publishKey)) return;
							if (typeof off === "function") off();
						};
						published.set(publishKey, release);
						return { dispose: release };
					} },
					scope: { add(dispose) {
						assertActive("scope.add");
						cleanups.push(dispose);
						options.onScopeAdd?.(dispose);
					} },
					contracts: {
						get(coordinate) {
							assertActive("contracts.get");
							const key = assertDeclared(coordinate, "contracts.get");
							if (!contracts.has(key)) throw new StandardError("E_CONTRACT_UNAVAILABLE", `contracts.get：optional 坐标 ${key} 在本宿主缺席（用 has() 走降级路径）`, coordinate);
							return contracts.get(key);
						},
						has(coordinate) {
							assertActive("contracts.has");
							return declared.has(coordKey(coordinate)) && contracts.has(coordKey(coordinate));
						}
					}
				},
				async dispose() {
					if (state === "disposed") return;
					state = "disposed";
					for (const release of [...published.values()].reverse()) release();
					for (const cleanup of cleanups.splice(0).reverse()) try {
						await cleanup();
					} catch {}
				}
			};
		}
		/**
		* 驱动一个 facet 定义。setup 同步完成时本函数同步返回（宿主对同步插件
		* 不引入额外微任务——capability.spec 依赖注册在 apply 返回前完成）。
		*/
		function runFacet(definition, activation) {
			if (!isFacetDefinition(definition)) throw new StandardError("E_WRONG_STATE", "runFacet：默认导出不是 defineFacet 创建的 facet 定义");
			return definition.setup(activation);
		}
		//#endregion
		//#region src/standard/cordis-client-adapter.ts
		function createClientActivation(ctx) {
			const cordis = ctx;
			const locale = {
				bind: (ns) => ctx.locale.bind(ns),
				register: (ns, dicts) => ctx.locale.register(ns, dicts)
			};
			/** betterSidebar 无进程内 lookup（client 运行时按 inject 供给），恒走延迟绑定。 */
			const sidebar = { acquire: acquireFromCordis(cordis, () => void 0, "betterSidebar") };
			return createActivation({
				declared: [...CLIENT_REQUIRED, ...CLIENT_OPTIONAL],
				contracts: /* @__PURE__ */ new Map([[coordKey(LOCALE), locale], [coordKey(SIDEBAR_TAB), sidebar]]),
				onScopeAdd: (dispose) => {
					cordis.effect(() => () => {
						dispose();
					}, "dsh-tab-genoffice: standard scope");
				}
			});
		}
		//#endregion
		//#region src/tabs/icon.tsx
		/** Shared SVG presentation props for sidebar tab icons (16px grid). */
		const TAB_ICON_PROPS = {
			width: 14,
			height: 14,
			viewBox: "0 0 16 16",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: 1.4,
			strokeLinecap: "round",
			strokeLinejoin: "round"
		};
		/** GenOffice document glyph. `size` is accepted for the TabDescriptor icon callback. */
		function GenOfficeIcon(_props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				...TAB_ICON_PROPS,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4 2h5l3 3v9H4z" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9 2v3h3M6.5 8.5h3M6.5 11h3" })]
			});
		}
		//#endregion
		//#region src/tabs/relay.ts
		/**
		* GenOffice relay loopback: shared by the file-list panel and the control-mode
		* viewer. Probe state is a module-level store so both surfaces show one strip.
		*/
		/** The genoffice relay base (loopback; CORS loopback whitelist covers it). */
		const RELAY_BASE = "http://localhost:8787";
		const PREVIEWABLE = {
			docx: "docs",
			md: "markdown",
			xlsx: "sheets",
			pptx: "slides",
			pdf: "pdf"
		};
		const RELAY_THROTTLE_MS = 1500;
		let relayOk = null;
		/** null = 未探测/relay 不可达；false = API 活着但静态根丢失（contracts/relay-api.md health.ready）。 */
		let relayReady = null;
		let lastProbeAt = 0;
		let inFlight = null;
		const listeners$1 = /* @__PURE__ */ new Set();
		function getRelayOk() {
			return relayOk;
		}
		function getRelayReady() {
			return relayReady;
		}
		function subscribeRelay(fn) {
			listeners$1.add(fn);
			return () => {
				listeners$1.delete(fn);
			};
		}
		function emitRelay() {
			for (const fn of listeners$1) fn();
		}
		/** Update the shared flag without a network round-trip (list fetch already proved it). */
		function noteRelayOk(ok) {
			if (relayOk === ok) return;
			relayOk = ok;
			lastProbeAt = Date.now();
			emitRelay();
		}
		function extOf(path) {
			const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
			const base = slash < 0 ? path : path.slice(slash + 1);
			const dot = base.lastIndexOf(".");
			return dot < 0 ? "" : base.slice(dot + 1).toLowerCase();
		}
		async function docIdFor(absPath) {
			const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(absPath));
			return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
		}
		/** Control mode adds `control=1`; `_r` busts the iframe after save/reload (BR-014). */
		function previewUrlFor(path, ext, control, nonce) {
			const app = PREVIEWABLE[ext];
			if (app === void 0) return "";
			const target = encodeURIComponent(`path:${path}`);
			const extra = nonce !== void 0 && nonce !== "" ? `&_r=${encodeURIComponent(nonce)}` : "";
			return `${RELAY_BASE}/${app}/?${control ? "control=1&" : ""}open=${target}${extra}`;
		}
		/** Raw health probe (no store). Old relays without `ready` count as ready. */
		async function checkRelay(signal) {
			try {
				const resp = await fetch(`${RELAY_BASE}/api/health`, signal === void 0 ? void 0 : { signal });
				if (!resp.ok) return {
					up: false,
					ready: false
				};
				let ready = true;
				try {
					ready = (await resp.json()).ready !== false;
				} catch {}
				return {
					up: true,
					ready
				};
			} catch {
				return {
					up: false,
					ready: false
				};
			}
		}
		/** Shared probe with throttle. `force` bypasses throttle (「重新检查」). */
		async function probeRelay(force = false, signal) {
			const now = Date.now();
			if (!force && inFlight !== null) return inFlight;
			if (!force && relayOk !== null && now - lastProbeAt < RELAY_THROTTLE_MS) return relayOk;
			lastProbeAt = now;
			inFlight = checkRelay(signal).then((h) => {
				relayOk = h.up;
				relayReady = h.up ? h.ready : null;
				emitRelay();
				return h.up;
			}).finally(() => {
				inFlight = null;
			});
			return inFlight;
		}
		async function probeRelayLaunch() {
			try {
				const resp = await fetch(`${window.location.origin}/dsh-artifact/genoffice-relay`);
				if (!resp.ok) return false;
				return (await resp.json()).configured === true;
			} catch {
				return false;
			}
		}
		async function launchRelay() {
			try {
				const data = await (await fetch(`${window.location.origin}/dsh-artifact/genoffice-relay`, { method: "POST" })).json();
				return typeof data.error === "string" ? {
					ok: data.ok === true,
					error: data.error
				} : { ok: data.ok === true };
			} catch (e) {
				return {
					ok: false,
					error: e instanceof Error ? e.message : String(e)
				};
			}
		}
		async function notifyHostSync(path) {
			try {
				await fetch(`${window.location.origin}/dsh-artifact/genoffice-sync`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ path })
				});
			} catch {}
		}
		//#endregion
		//#region src/tabs/file-tab.ts
		/** Directory/browser tab (one instance). */
		const BROWSER_TAB_ID = "dsh-genoffice:tab";
		/** Control-mode document tab (one instance per path). */
		const FILE_TAB_ID = "dsh-genoffice:file";
		function fileNameOf(path) {
			const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
			return slash < 0 ? path : path.slice(slash + 1);
		}
		/** Seed for `betterSidebar.openTab` — path-derived id so files sit side by side. */
		function fileTabSeed(path) {
			const title = fileNameOf(path);
			return {
				type: FILE_TAB_ID,
				path,
				title,
				id: `${FILE_TAB_ID}:${path}`
			};
		}
		/**
		* Turn a relay `/api/open/stream` `file` payload into an `openTab` request.
		* A sessionId must ride with the seed: omitting it lands the tab in whatever
		* session is active on THIS page, so a second DSH page would also open it.
		*/
		function fileOpenFromEvent(data) {
			const path = typeof data.path === "string" ? data.path : "";
			if (path === "") return void 0;
			const sessionId = typeof data.sessionId === "string" && data.sessionId !== "" ? data.sessionId : void 0;
			return sessionId === void 0 ? { seed: fileTabSeed(path) } : {
				seed: fileTabSeed(path),
				scope: { sessionId }
			};
		}
		/**
		* Decide whether THIS DSH page should mount the control iframe.
		*
		* better-sidebar `openTab(seed, { sessionId })` against a session that is
		* not active on this page writes the tab into that session's store and
		* **skips panel expand**. A second page sharing origin then persists
		* `panelOpen: false` over the viewing page, so the iframe never mounts
		* and relay reports `executor not registered`.
		*
		* Only the page whose active session matches opens, and it opens without
		* scope so the active-session path expands the panel.
		*/
		function fileOpenOnThisPage(data, activeSessionId) {
			const next = fileOpenFromEvent(data);
			if (next === void 0) return void 0;
			if (next.scope === void 0) return next;
			if (activeSessionId === void 0 || activeSessionId !== next.scope.sessionId) return void 0;
			return { seed: next.seed };
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/plugin/dsh-genoffice/plugin/packages/tab-genoffice/src/tabs/genoffice.module.css.mjs
		const css = ".p8QEMa_panel{height:100%;min-height:0;color:var(--dsw-alias-label-primary);flex-direction:column;font-size:13px;display:flex}.p8QEMa_toolbar{border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;align-items:center;gap:2px;padding:6px 12px 8px;display:flex}.p8QEMa_btn{cursor:pointer;height:26px;color:var(--dsw-alias-label-secondary);font:inherit;transition:background-color .15s var(--ds-ease-in-out,ease), color .15s var(--ds-ease-in-out,ease);background:0 0;border:0;border-radius:8px;flex:none;align-items:center;gap:6px;padding:0 8px;font-size:12px;display:inline-flex}.p8QEMa_btn:hover:not(:disabled){background:var(--dsw-specific-sidebar-nav-item-hover);color:var(--dsw-alias-label-primary)}.p8QEMa_btn:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}.p8QEMa_btnDirty{color:var(--dsw-alias-state-warning-primary,#b45309);box-shadow:inset 0 0 0 1px var(--dsw-alias-state-warning-primary,#d97706)}.p8QEMa_pathText{background:var(--dsw-specific-sidebar-nav-item-hover);min-width:0;color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;border-radius:6px;flex:1;margin-left:2px;padding:3px 8px;font-size:11px;overflow:hidden}.p8QEMa_pathBar{background:var(--dsw-specific-sidebar-nav-item-hover);cursor:text;border-radius:6px;flex:1;align-items:center;gap:2px;min-width:0;min-height:26px;margin-left:2px;padding:0 4px;display:flex;overflow:hidden}.p8QEMa_crumb{color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;white-space:nowrap;text-overflow:ellipsis;background:0 0;border:0;border-radius:6px;flex:none;max-width:10em;padding:2px 4px;font-size:11px;overflow:hidden}.p8QEMa_crumb:hover{background:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary)}.p8QEMa_pathInput{min-width:0;color:var(--dsw-alias-label-primary);font:inherit;background:0 0;border:0;outline:none;flex:1;padding:3px 4px;font-size:11px}.p8QEMa_homeNote{color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:none;padding:0 8px;font-size:10.5px}.p8QEMa_fileName{white-space:nowrap;text-overflow:ellipsis;flex:1;min-width:0;font-size:12px;font-weight:600;overflow:hidden}.p8QEMa_hint{color:var(--dsw-alias-label-secondary);align-items:center;gap:8px;padding:10px 12px;font-size:12px;display:flex}.p8QEMa_list{flex:1;min-height:0;padding:6px;overflow-y:auto}.p8QEMa_row{cursor:default;border-radius:8px;align-items:center;gap:9px;height:30px;padding:0 8px;font-size:12.5px;display:flex}.p8QEMa_rowClickable{cursor:pointer;transition:background-color .15s var(--ds-ease-in-out,ease)}.p8QEMa_rowClickable:hover{background:var(--dsw-specific-sidebar-nav-item-hover)}.p8QEMa_rowDisabled{opacity:.55}.p8QEMa_rowIcon{width:16px;height:16px;color:var(--dsw-alias-label-tertiary);flex:none;justify-content:center;align-items:center;display:inline-flex}.p8QEMa_rowName{white-space:nowrap;text-overflow:ellipsis;flex:1;min-width:0;overflow:hidden}.p8QEMa_rowTag{color:var(--dsw-alias-label-tertiary);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;flex:none;padding:1px 6px;font-size:10.5px}.p8QEMa_iframe{background:#fff;border:0;border-radius:8px;flex:1;min-height:0;margin:0 12px 12px}";
		const tagId = "@deepseek-ai/dsh-tab-genoffice/genoffice.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-tab-genoffice";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var genoffice_module_css_default = {
			"iframe": "p8QEMa_iframe",
			"pathBar": "p8QEMa_pathBar",
			"homeNote": "p8QEMa_homeNote",
			"hint": "p8QEMa_hint",
			"rowIcon": "p8QEMa_rowIcon",
			"panel": "p8QEMa_panel",
			"rowName": "p8QEMa_rowName",
			"pathInput": "p8QEMa_pathInput",
			"crumb": "p8QEMa_crumb",
			"rowDisabled": "p8QEMa_rowDisabled",
			"toolbar": "p8QEMa_toolbar",
			"row": "p8QEMa_row",
			"fileName": "p8QEMa_fileName",
			"rowClickable": "p8QEMa_rowClickable",
			"rowTag": "p8QEMa_rowTag",
			"pathText": "p8QEMa_pathText",
			"list": "p8QEMa_list",
			"btnDirty": "p8QEMa_btnDirty",
			"btn": "p8QEMa_btn"
		};
		//#endregion
		//#region src/tabs/genoffice.tsx
		/**
		* GenOffice tab panel: relay-backed file browser.
		*
		* Opening a previewable file calls `openTab` for a per-path document tab
		* instead of replacing this list. Initial list uses session cwd
		* (empty string = missing → homedir fallback). Path bar is a breadcrumb
		* with type-to-jump (BR-008 / BR-009).
		*/
		function joinPath(a, b) {
			return a.endsWith("/") ? a + b : a + "/" + b;
		}
		const ROW_ICON_PROPS$1 = {
			...TAB_ICON_PROPS,
			width: 14,
			height: 14
		};
		function FolderIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				...ROW_ICON_PROPS$1,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M2 4.5h4l1.5 2H14v6.5H2z" })
			});
		}
		function LinkIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				...ROW_ICON_PROPS$1,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M6.5 5.5 10 2a2.4 2.4 0 0 1 3.4 3.4L9.9 9a2.4 2.4 0 0 1-3.4 0" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9.5 10.5 6 14a2.4 2.4 0 0 1-3.4-3.4l3.5-3.5a2.4 2.4 0 0 1 3.4 0" })]
			});
		}
		function FileIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				...ROW_ICON_PROPS$1,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4 2h5l3 3v9H4z" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9 2v3h3M6.5 8.5h3M6.5 11h3" })]
			});
		}
		function sessionCwd(cwd) {
			if (cwd === void 0 || cwd === "") return void 0;
			return cwd;
		}
		function crumbsOf(abs) {
			if (!abs.startsWith("/")) return [];
			const parts = abs.split("/").filter(Boolean);
			const out = [{
				label: "/",
				path: "/"
			}];
			let acc = "";
			for (const part of parts) {
				acc += `/${part}`;
				out.push({
					label: part,
					path: acc
				});
			}
			return out;
		}
		function PathBar(props) {
			const [editing, setEditing] = (0, react.useState)(false);
			const [draft, setDraft] = (0, react.useState)(props.path);
			const [expanded, setExpanded] = (0, react.useState)(false);
			const inputRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (!editing) setDraft(props.path);
			}, [props.path, editing]);
			(0, react.useEffect)(() => {
				if (!editing) return;
				inputRef.current?.focus();
				inputRef.current?.select();
			}, [editing]);
			const submit = () => {
				const raw = draft.trim();
				if (!raw.startsWith("/")) {
					props.onInvalid("请输入绝对路径（以 / 开头）");
					return;
				}
				props.onJump(raw);
				setEditing(false);
			};
			if (editing) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: genoffice_module_css_default.pathBar,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					ref: inputRef,
					className: genoffice_module_css_default.pathInput,
					value: draft,
					"aria-label": "跳转到路径",
					onChange: (e) => {
						setDraft(e.target.value);
					},
					onKeyDown: (e) => {
						if (e.key === "Enter") submit();
						if (e.key === "Escape") setEditing(false);
					},
					onBlur: () => {
						const raw = draft.trim();
						if (raw.startsWith("/") && raw !== props.path) props.onJump(raw);
						setEditing(false);
					}
				})
			});
			const all = crumbsOf(props.path);
			const collapsed = !expanded && all.length > 5;
			const first = all[0];
			const shown = collapsed && first !== void 0 ? [
				first,
				{
					label: "…",
					path: ""
				},
				...all.slice(-3)
			] : all;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: genoffice_module_css_default.pathBar,
				title: props.path,
				"aria-label": "当前路径",
				onClick: (e) => {
					if (e.target === e.currentTarget) {
						setDraft(props.path);
						setEditing(true);
					}
				},
				children: shown.map((c, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: genoffice_module_css_default.crumb,
					title: c.path || "展开完整路径",
					onClick: () => {
						if (c.label === "…") {
							setExpanded(true);
							return;
						}
						props.onJump(c.path);
					},
					children: c.label
				}, `${c.path}:${i}`))
			});
		}
		function GenOfficePanel(props) {
			const cwd = sessionCwd(props.scope.cwd);
			const [path, setPath] = (0, react.useState)("");
			const [parent, setParent] = (0, react.useState)(void 0);
			const [entries, setEntries] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [pathError, setPathError] = (0, react.useState)(null);
			const [fellHome, setFellHome] = (0, react.useState)(false);
			const [showHidden, setShowHidden] = (0, react.useState)(false);
			const [relayOk, setRelayOk] = (0, react.useState)(() => getRelayOk());
			const [relayReady, setRelayReady] = (0, react.useState)(() => getRelayReady());
			const [launchConfigured, setLaunchConfigured] = (0, react.useState)(false);
			const [launching, setLaunching] = (0, react.useState)(false);
			const [launchError, setLaunchError] = (0, react.useState)(null);
			const loadSeq = (0, react.useRef)(0);
			const loadList = async (nextPath, asHome = false) => {
				const seq = ++loadSeq.current;
				setLoading(true);
				setError(null);
				setPathError(null);
				try {
					const data = await (await fetch(`${RELAY_BASE}/api/dir?path=${encodeURIComponent(nextPath ?? "")}`)).json();
					if (seq !== loadSeq.current) return;
					if (!data.ok) {
						setPathError(data.error ?? "路径不可读");
						noteRelayOk(true);
					} else {
						setPath(data.path ?? "");
						setParent(data.parent);
						setEntries(data.entries ?? []);
						setFellHome(asHome || nextPath === void 0 || nextPath === "");
						noteRelayOk(true);
					}
				} catch {
					if (seq !== loadSeq.current) return;
					setError("relay 不可用");
					noteRelayOk(false);
				} finally {
					if (seq === loadSeq.current) setLoading(false);
				}
			};
			const prevRelay = (0, react.useRef)(getRelayOk());
			(0, react.useEffect)(() => {
				return subscribeRelay(() => {
					const ok = getRelayOk();
					const was = prevRelay.current;
					prevRelay.current = ok;
					setRelayOk(ok);
					setRelayReady(getRelayReady());
					if (was === false && ok === true) loadList(path || cwd, cwd === void 0 && (path === "" || path === void 0));
				});
			}, [path, cwd]);
			(0, react.useEffect)(() => {
				probeRelayLaunch().then(setLaunchConfigured);
			}, []);
			const startRelay = async () => {
				if (launching) return;
				setLaunching(true);
				setLaunchError(null);
				const result = await launchRelay();
				setLaunching(false);
				if (result.ok) probeRelay(true);
				else setLaunchError(result.error ?? "timeout");
			};
			const mounted = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (mounted.current) return;
				mounted.current = true;
				loadList(cwd, cwd === void 0);
			}, []);
			const pickFile = (entry) => {
				if (entry.dir || entry.symlink) {
					loadList(joinPath(path, entry.name), false);
					return;
				}
				const ext = entry.ext ?? "";
				if (PREVIEWABLE[ext] === void 0) return;
				const abs = joinPath(path, entry.name);
				props.ctx.betterSidebar.openTab(fileTabSeed(abs), props.scope);
			};
			const visibleEntries = entries === null ? null : showHidden ? entries : entries.filter((e) => !e.hidden);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: genoffice_module_css_default.panel,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: genoffice_module_css_default.toolbar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: genoffice_module_css_default.btn,
								title: "回到主目录",
								onClick: () => {
									loadList(void 0, true);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									...ROW_ICON_PROPS$1,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M2.5 7.5 8 2.5l5.5 5M4 6.5V14h8V6.5" })
								}), "主目录"]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: genoffice_module_css_default.btn,
								disabled: cwd === void 0,
								title: cwd === void 0 ? "当前会话没有项目目录" : "回到会话项目根",
								onClick: () => {
									if (cwd !== void 0) loadList(cwd, false);
								},
								children: "项目根"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: genoffice_module_css_default.btn,
								disabled: parent === void 0,
								title: "上级目录",
								onClick: () => {
									if (parent !== void 0) loadList(parent, false);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									...ROW_ICON_PROPS$1,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 13V3M4.5 6.5 8 3l3.5 3.5" })
								}), "上级"]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: genoffice_module_css_default.btn,
								title: "重新加载当前目录",
								onClick: () => {
									loadList(path, fellHome);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									...ROW_ICON_PROPS$1,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M13.5 8a5.5 5.5 0 1 1-1.7-3.9M13.5 2.5V5H11" })
								}), "刷新"]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: genoffice_module_css_default.btn,
								"aria-pressed": showHidden,
								title: showHidden ? "隐藏点前缀条目" : "显示点前缀条目",
								onClick: () => {
									setShowHidden((v) => !v);
								},
								children: showHidden ? "藏起隐藏项" : "显示隐藏项"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PathBar, {
								path,
								onJump: (abs) => {
									loadList(abs, false);
								},
								onInvalid: (msg) => {
									setPathError(msg);
								}
							}),
							fellHome && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: genoffice_module_css_default.homeNote,
								children: "已回落到主目录"
							})
						]
					}),
					relayOk === false && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: genoffice_module_css_default.hint,
						role: "status",
						children: [
							"GenOffice relay 不可用 — 在仓库执行 `node web/server.mjs` 后点重新检查。",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: genoffice_module_css_default.btn,
								onClick: () => {
									probeRelay(true);
								},
								children: "重新检查"
							}),
							launchConfigured && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: genoffice_module_css_default.btn,
								disabled: launching,
								onClick: () => {
									startRelay();
								},
								children: launching ? "启动中…" : "启动 relay"
							}), launchError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								"启动失败：",
								launchError,
								" — 手动执行 `node scripts/dev.mjs start-relay`"
							] })] })
						]
					}),
					relayOk !== false && relayReady === false && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: genoffice_module_css_default.hint,
						role: "status",
						children: ["relay 在运行，但引擎静态资源不可达（引擎目录被移动或 web-dist 未构建）— 预览会打不开。点「启动 relay」替换失效实例，或手动执行 `node scripts/dev.mjs start-relay`。", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: genoffice_module_css_default.btn,
							onClick: () => {
								probeRelay(true);
							},
							children: "重新检查"
						})]
					}),
					loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: genoffice_module_css_default.hint,
						children: "加载中…"
					}),
					!loading && pathError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: genoffice_module_css_default.hint,
						children: pathError
					}),
					!loading && error !== null && relayOk !== false && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: genoffice_module_css_default.hint,
						children: [error, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: genoffice_module_css_default.btn,
							onClick: () => {
								loadList(path || cwd, fellHome);
							},
							children: "重试"
						})]
					}),
					!loading && error === null && visibleEntries !== null && visibleEntries.length === 0 && pathError === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: genoffice_module_css_default.hint,
						children: "空目录"
					}),
					!loading && error === null && visibleEntries !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: genoffice_module_css_default.list,
						children: visibleEntries.map((entry) => {
							const previewable = !entry.dir && !entry.symlink && PREVIEWABLE[entry.ext ?? ""] !== void 0;
							const clickable = entry.dir || entry.symlink || previewable;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: `${genoffice_module_css_default.row} ${clickable ? genoffice_module_css_default.rowClickable : genoffice_module_css_default.rowDisabled}`,
								title: entry.dir ? "进入目录" : entry.symlink ? "符号链接（可能指向目录）" : previewable ? "点击预览" : "网页版不可预览",
								onClick: () => {
									pickFile(entry);
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: genoffice_module_css_default.rowIcon,
										children: entry.dir ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FolderIcon, {}) : entry.symlink ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LinkIcon, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FileIcon, {})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: genoffice_module_css_default.rowName,
										children: entry.name
									}),
									!entry.dir && !previewable && !entry.symlink && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: genoffice_module_css_default.rowTag,
										children: "网页版不可预览"
									})
								]
							}, entry.name);
						})
					})
				]
			});
		}
		//#endregion
		//#region src/tabs/coexist.ts
		/**
		* Click-preview coexistence (BR-007 / ASM-001): claim docx/xlsx/pptx;
		* md/pdf stay on host viewers. Degrade is manual.
		*
		* Sidebar 0.13 dropped builtin office viewers. Prefer those ids if another
		* plugin re-registered them, then any non-own ext match, then
		* binary-download — never this plugin's own viewer (that would recurse).
		*/
		const CLAIMED_EXTS = [
			"docx",
			"xlsx",
			"pptx"
		];
		/** Preferred fallback viewer ids keyed by extension. */
		const UPSTREAM_VIEWER_ID = {
			docx: "docx",
			xlsx: "xlsx",
			pptx: "pptx",
			md: "markdown",
			pdf: "pdf"
		};
		/** FileViewer ids this plugin registers (`dsh-genoffice:viewer-${ext}`). */
		const OWN_VIEWER_PREFIX = "dsh-genoffice:viewer-";
		function isOwnViewerId(id) {
			return id.startsWith(OWN_VIEWER_PREFIX);
		}
		/**
		* Pick a FileViewer to render when control-mode cannot (relay down).
		* Never returns this plugin's own viewer — that would recurse into
		* ControlModeViewer.
		*/
		function pickDegradeViewer(viewers, ext, skipId, enabled) {
			const usable = (v) => v.id !== skipId && !isOwnViewerId(v.id) && (enabled === void 0 || enabled(v.id));
			const preferredId = UPSTREAM_VIEWER_ID[ext];
			if (preferredId !== void 0) {
				const named = viewers.find((v) => v.id === preferredId && usable(v));
				if (named !== void 0) return named;
			}
			const match = viewers.filter((v) => usable(v) && v.exts.includes(ext)).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
			if (match !== void 0) return match;
			return viewers.find((v) => v.id === "binary-download" && usable(v));
		}
		//#endregion
		//#region src/tabs/doc-registry.ts
		const active = /* @__PURE__ */ new Map();
		const listeners = /* @__PURE__ */ new Set();
		function notify() {
			for (const listener of listeners) listener();
		}
		function lookupActive(docId) {
			return active.get(docId);
		}
		function subscribeActive(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
		/** Register occupancy. Returns an unregister function. */
		function registerActive(docId, entry) {
			active.set(docId, entry);
			queueMicrotask(notify);
			return () => {
				if (active.get(docId) === entry) {
					active.delete(docId);
					notify();
				}
			};
		}
		//#endregion
		//#region src/tabs/control-mode.tsx
		/**
		* The single control-mode surface: health probe, iframe, toolbar (save /
		* reload-from-disk / browser-open / back), and relay-down degrade.
		*/
		const ROW_ICON_PROPS = {
			...TAB_ICON_PROPS,
			width: 14,
			height: 14
		};
		const BROWSER_OPEN_TITLE = "离开控制模式；网页版 AI 面板可直连第三方模型服务商，可能出网";
		const RELAY_MANUAL = "`node scripts/dev.mjs start-relay`";
		function copyPathOf(abs, at = /* @__PURE__ */ new Date(), withSeconds = false) {
			const slash = Math.max(abs.lastIndexOf("/"), abs.lastIndexOf("\\"));
			const dir = slash < 0 ? "" : abs.slice(0, slash + 1);
			const base = slash < 0 ? abs : abs.slice(slash + 1);
			const dot = base.lastIndexOf(".");
			const stem = dot < 0 ? base : base.slice(0, dot);
			const ext = dot < 0 ? "" : base.slice(dot + 1);
			const y = String(at.getFullYear());
			const mo = String(at.getMonth() + 1).padStart(2, "0");
			const d = String(at.getDate()).padStart(2, "0");
			const h = String(at.getHours()).padStart(2, "0");
			const mi = String(at.getMinutes()).padStart(2, "0");
			return `${dir}${stem} (副本 ${withSeconds ? `${y}${mo}${d}-${h}${mi}${String(at.getSeconds()).padStart(2, "0")}` : `${y}${mo}${d}-${h}${mi}`}).${ext}`;
		}
		function ControlModeViewer(props) {
			const { path, title, ext, onBack, renderBuiltin, tabId, updateTab } = props;
			const degradeMode = props.degradeMode ?? "manual";
			const [relayOk, setRelayOk] = (0, react.useState)(() => getRelayOk());
			const [relayReady, setRelayReady] = (0, react.useState)(() => getRelayReady());
			const [yielded, setYielded] = (0, react.useState)(false);
			const [blocked, setBlocked] = (0, react.useState)(false);
			const [previewLoaded, setPreviewLoaded] = (0, react.useState)(false);
			const [previewError, setPreviewError] = (0, react.useState)(false);
			const [frameNonce, setFrameNonce] = (0, react.useState)(() => crypto.randomUUID());
			const [syncing, setSyncing] = (0, react.useState)(false);
			const [popupHint, setPopupHint] = (0, react.useState)(false);
			const [saveState, setSaveState] = (0, react.useState)("idle");
			const [saveMessage, setSaveMessage] = (0, react.useState)(null);
			const [dirty, setDirty] = (0, react.useState)(false);
			const [launchConfigured, setLaunchConfigured] = (0, react.useState)(false);
			const [launching, setLaunching] = (0, react.useState)(false);
			const [launchError, setLaunchError] = (0, react.useState)(null);
			const iframeRef = (0, react.useRef)(null);
			const probeSeq = (0, react.useRef)(0);
			const busy = saveState === "saving" || syncing || launching;
			const unloadPreview = () => {
				const prev = iframeRef.current;
				if (prev !== null) prev.src = "about:blank";
			};
			const remountControl = async () => {
				setDirty(false);
				setSyncing(true);
				setPreviewLoaded(false);
				setPreviewError(false);
				await notifyHostSync(path);
				setFrameNonce(crypto.randomUUID());
			};
			const probe = (force = true) => {
				const seq = ++probeSeq.current;
				setRelayOk(null);
				setYielded(false);
				probeRelay(force, new AbortController().signal).then((ok) => {
					if (seq !== probeSeq.current) return;
					setRelayOk(ok);
					setRelayReady(getRelayReady());
				});
			};
			(0, react.useEffect)(() => {
				return subscribeRelay(() => {
					setRelayOk(getRelayOk());
					setRelayReady(getRelayReady());
				});
			}, []);
			(0, react.useEffect)(() => {
				probeRelayLaunch().then(setLaunchConfigured);
			}, []);
			(0, react.useEffect)(() => {
				setDirty(false);
				probe(false);
				return () => {
					probeSeq.current += 1;
					unloadPreview();
				};
			}, [path]);
			(0, react.useEffect)(() => {
				let cancelled = false;
				let unregister;
				const tryClaim = () => {
					docIdFor(path).then((id) => {
						if (cancelled) return;
						if (unregister !== void 0) return;
						if (lookupActive(id) !== void 0) {
							setBlocked(true);
							return;
						}
						setBlocked(false);
						unregister = registerActive(id, { surface: onBack === void 0 ? "viewer" : "tab" });
					});
				};
				tryClaim();
				const stop = subscribeActive(tryClaim);
				return () => {
					cancelled = true;
					stop();
					unregister?.();
				};
			}, [path, onBack]);
			(0, react.useEffect)(() => {
				if (saveState !== "saved") return;
				const timer = window.setTimeout(() => {
					setSaveState("idle");
					setSaveMessage(null);
				}, 4e3);
				return () => {
					window.clearTimeout(timer);
				};
			}, [saveState]);
			(0, react.useEffect)(() => {
				const onMsg = (event) => {
					(async () => {
						const data = event.data;
						if (event.origin !== "http://localhost:8787") return;
						if (data === null || typeof data !== "object") return;
						if (data.type !== "genoffice:dirty") return;
						if (typeof data.dirty !== "boolean" || typeof data.docId !== "string") return;
						const id = await docIdFor(path);
						if (data.docId !== id) return;
						setDirty(data.dirty);
					})();
				};
				window.addEventListener("message", onMsg);
				return () => {
					window.removeEventListener("message", onMsg);
				};
			}, [path]);
			(0, react.useEffect)(() => {
				if (tabId === void 0 || updateTab === void 0) return;
				const base = title.replace(/^● /, "");
				const next = dirty ? `● ${base}` : base;
				if (next === title) return;
				updateTab(tabId, { title: next });
			}, [
				dirty,
				tabId,
				title,
				updateTab
			]);
			const startRelay = async () => {
				if (launching) return;
				setLaunching(true);
				setLaunchError(null);
				const result = await launchRelay();
				setLaunching(false);
				if (result.ok) probe(true);
				else setLaunchError(result.error ?? "timeout");
			};
			const launchControls = launchConfigured && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: genoffice_module_css_default.btn,
				disabled: launching,
				onClick: () => {
					startRelay();
				},
				children: launching ? "启动中…" : "启动 relay"
			}), launchError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
				"启动失败：",
				launchError,
				" — 手动执行 ",
				RELAY_MANUAL
			] })] });
			const saveToDisk = async () => {
				if (busy) return;
				const app = PREVIEWABLE[ext];
				if (app === void 0) return;
				const docId = await docIdFor(path);
				setSaveState("saving");
				setSaveMessage(null);
				try {
					const data = await (await fetch(`${RELAY_BASE}/api/control/${app}/${docId}/export`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ path })
					})).json();
					if (data.ok) {
						setSaveState("saved");
						if (typeof data.mtimeMs === "number") {
							setDirty(false);
							setSaveMessage(`已保存到 ${data.path ?? path}（编辑状态已保留）`);
						} else {
							setSaveMessage(`已保存到 ${data.path ?? path}`);
							await remountControl();
						}
					} else if (data.error === "conflict") {
						setSaveState("conflict");
						setSaveMessage("文件已被外部修改，未覆盖 — 请点「从磁盘重载」后再保存");
					} else if (data.error === "executor not registered") {
						setSaveState("error");
						setSaveMessage("文档未在控制模式打开（执行器未注册）— 请重新打开预览");
					} else {
						setSaveState("error");
						setSaveMessage(`写入失败：${data.error ?? "未知错误"}`);
					}
				} catch (e) {
					setSaveState("error");
					setSaveMessage(`写入失败：${e instanceof Error ? e.message : String(e)}`);
				}
			};
			const writeCopy = async (saveAs, retried = false) => {
				const app = PREVIEWABLE[ext];
				if (app === void 0) return;
				const docId = await docIdFor(path);
				setSaveState("saving");
				setSaveMessage(null);
				try {
					const data = await (await fetch(`${RELAY_BASE}/api/control/${app}/${docId}/export`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							path,
							saveAs
						})
					})).json();
					if (data.ok) {
						setSaveState("saved");
						setSaveMessage(`已另存为 ${data.path ?? saveAs}`);
						return;
					}
					if (data.error === "exists") {
						setSaveState("conflict");
						setSaveMessage("副本已存在，未覆盖");
						if (!retried && window.confirm("副本已存在，换个名字再试？")) await writeCopy(copyPathOf(path, /* @__PURE__ */ new Date(), true), true);
						return;
					}
					setSaveState("error");
					setSaveMessage(`另存失败：${data.error ?? "未知错误"}`);
				} catch (e) {
					setSaveState("error");
					setSaveMessage(`另存失败：${e instanceof Error ? e.message : String(e)}`);
				}
			};
			const saveAsCopy = async () => {
				if (busy) return;
				await writeCopy(copyPathOf(path));
			};
			const reloadFromDisk = () => {
				if (busy) return;
				if (dirty) {
					if (!window.confirm("有未保存的编辑，从磁盘重新加载会丢失。确定？")) return;
				} else if (!window.confirm("从磁盘重新加载？未保存的编辑会丢失。")) return;
				remountControl();
			};
			const openInBrowser = () => {
				if (window.open(previewUrlFor(path, ext, false), "_blank", "noopener") === null) setPopupHint(true);
			};
			const goBack = () => {
				if (dirty && !window.confirm("有未保存的编辑，确定离开？")) return;
				unloadPreview();
				onBack?.();
			};
			const toolbar = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: genoffice_module_css_default.toolbar,
				children: [
					onBack !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: genoffice_module_css_default.btn,
						disabled: busy,
						onClick: goBack,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							...ROW_ICON_PROPS,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M10.5 3.5 6 8l4.5 4.5" })
						}), "返回"]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: genoffice_module_css_default.fileName,
						title: path,
						children: title
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: dirty ? `${genoffice_module_css_default.btn} ${genoffice_module_css_default.btnDirty}` : genoffice_module_css_default.btn,
						disabled: busy,
						title: "将当前编辑内容原子写回原文件",
						onClick: () => {
							saveToDisk();
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							...ROW_ICON_PROPS,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M11 2H4v12h12V5zM8 2v4h4V2M8 14V9h4v5" })
						}), saveState === "saving" ? "写入中…" : "写入磁盘"]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: genoffice_module_css_default.btn,
						disabled: busy,
						title: "丢弃未保存编辑，从磁盘重新打开并重新武装控制模式",
						onClick: reloadFromDisk,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							...ROW_ICON_PROPS,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M13.5 8a5.5 5.5 0 1 1-1.7-3.9M13.5 2.5V5H11" })
						}), "从磁盘重载"]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: genoffice_module_css_default.btn,
						style: { marginLeft: "auto" },
						disabled: busy,
						title: BROWSER_OPEN_TITLE,
						onClick: openInBrowser,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							...ROW_ICON_PROPS,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M6 3H3.5v9.5H13V10M9 3h4v4M13 3l-6 6" })
						}), "在浏览器中打开"]
					})
				]
			});
			const relayStrip = relayOk === false && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: genoffice_module_css_default.hint,
				role: "status",
				children: [
					"GenOffice relay 不可用 — 在仓库执行 `node web/server.mjs` 后点重新检查。",
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: genoffice_module_css_default.btn,
						onClick: () => {
							probe(true);
						},
						children: "重新检查"
					}),
					launchControls
				]
			});
			if (blocked) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: genoffice_module_css_default.panel,
				children: [
					toolbar,
					relayStrip,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: genoffice_module_css_default.hint,
						children: "该文档已在另一处打开 — 请先关掉另一侧，避免两个执行器抢注册"
					})
				]
			});
			if (yielded && renderBuiltin !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: genoffice_module_css_default.panel,
				children: [
					toolbar,
					relayStrip,
					renderBuiltin()
				]
			});
			if (relayOk === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: genoffice_module_css_default.panel,
				children: [toolbar, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: genoffice_module_css_default.hint,
					children: "正在检查 GenOffice relay…"
				})]
			});
			if (!relayOk) {
				const recheck = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: genoffice_module_css_default.btn,
					onClick: () => {
						probe(true);
					},
					children: "重新检查"
				});
				if (degradeMode === "auto" && renderBuiltin !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: genoffice_module_css_default.panel,
					children: [
						toolbar,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: genoffice_module_css_default.hint,
							role: "status",
							children: [
								"GenOffice relay 不可用 — 已切换后备预览。在仓库执行 `node web/server.mjs` 后可恢复控制模式。",
								recheck,
								launchControls
							]
						}),
						renderBuiltin()
					]
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: genoffice_module_css_default.panel,
					children: [toolbar, /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: genoffice_module_css_default.hint,
						role: "status",
						children: [
							"GenOffice relay 不可用 — 控制模式需要 localhost:8787 上的中继。启动命令：`node web/server.mjs`",
							renderBuiltin !== void 0 && degradeMode === "manual" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: genoffice_module_css_default.btn,
								onClick: () => {
									setYielded(true);
								},
								children: "用后备预览打开"
							}),
							recheck,
							launchControls
						]
					})]
				});
			}
			if (relayReady === false) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: genoffice_module_css_default.panel,
				children: [toolbar, /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: genoffice_module_css_default.hint,
					role: "status",
					children: [
						"relay 在运行，但引擎静态资源不可达（引擎目录被移动或 web-dist 未构建）— 预览无法加载。 点「启动 relay」替换失效实例，或手动执行 ",
						RELAY_MANUAL,
						"。",
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: genoffice_module_css_default.btn,
							onClick: () => {
								probe(true);
							},
							children: "重新检查"
						}),
						launchControls
					]
				})]
			});
			const url = previewUrlFor(path, ext, true, frameNonce);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: genoffice_module_css_default.panel,
				children: [
					toolbar,
					popupHint && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: genoffice_module_css_default.hint,
						children: "弹窗被拦截 — 请允许弹窗后重试"
					}),
					syncing && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: genoffice_module_css_default.hint,
						role: "status",
						children: "正在同步…"
					}),
					saveMessage !== null && saveState !== "idle" && !syncing && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: genoffice_module_css_default.hint,
						style: { color: saveState === "saved" ? "var(--dsw-alias-state-success-primary)" : "var(--dsw-alias-state-error-primary)" },
						children: [saveState === "saving" ? "写入中…" : saveMessage, saveState === "conflict" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: genoffice_module_css_default.btn,
							disabled: busy,
							onClick: () => {
								saveAsCopy();
							},
							children: "另存为副本"
						})]
					}),
					previewError ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: genoffice_module_css_default.hint,
						children: ["预览加载失败", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: genoffice_module_css_default.btn,
							disabled: busy,
							onClick: () => {
								remountControl();
							},
							children: "重试"
						})]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("iframe", {
						ref: iframeRef,
						src: url,
						className: genoffice_module_css_default.iframe,
						title,
						sandbox: "allow-scripts allow-same-origin allow-downloads",
						onLoad: () => {
							setPreviewLoaded(true);
							setSyncing(false);
						}
					}, frameNonce),
					!previewLoaded && !previewError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: genoffice_module_css_default.hint,
						children: syncing ? "正在同步…" : "预览加载中…"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreviewTimeout, {
						loaded: previewLoaded,
						nonce: frameNonce,
						onTimeout: () => {
							setPreviewError(true);
							setSyncing(false);
						}
					})
				]
			});
		}
		/** pdf/sheets first paint can exceed 10s (pdf.js worker + Univer). Host
		*  *_open polls registration for 20s — a shorter iframe timeout unmounts
		*  the executor first (UF-004). Re-arm on each remount nonce. */
		function PreviewTimeout({ loaded, nonce, onTimeout }) {
			(0, react.useEffect)(() => {
				if (loaded) return;
				const timer = window.setTimeout(onTimeout, 3e4);
				return () => {
					window.clearTimeout(timer);
				};
			}, [loaded, nonce]);
			return null;
		}
		//#endregion
		//#region src/tabs/docx-control-viewer.tsx
		/**
		* FileViewer adapter: FileViewerProps → ControlModeViewer. One component
		* covers every claimed extension; ext is derived from the path.
		*/
		/** Relay-down fallback: another enabled FileViewer, never this plugin's own. */
		function renderDegradeFallback(props) {
			const sidebar = props.ctx.betterSidebar;
			const builtin = pickDegradeViewer(sidebar.getFileViewers(), extOf(props.path), props.viewerId, (id) => sidebar.isViewerEnabled(id));
			if (builtin === void 0) return (0, react.createElement)("div", { className: genoffice_module_css_default.hint }, "没有可用的后备预览");
			return (0, react.createElement)(builtin.component, {
				...props,
				viewerId: builtin.id
			});
		}
		function DocxControlViewer(props) {
			const ext = extOf(props.path);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ControlModeViewer, {
				path: props.path,
				title: props.title,
				ext,
				renderBuiltin: () => renderDegradeFallback(props),
				...props.tabId !== void 0 ? { tabId: props.tabId } : {},
				...props.updateTab !== void 0 ? { updateTab: props.updateTab } : {},
				...props.onBack !== void 0 ? { onBack: props.onBack } : {}
			});
		}
		/** Per-file sidebar tab: control-mode plus Back (closes the tab; UF-003). */
		function GenOfficeFileTab(props) {
			const path = props.tab.path ?? "";
			const tabId = props.tab.id ?? `dsh-genoffice:file:${path}`;
			const sidebar = props.ctx.betterSidebar;
			const updateTab = (0, react.useCallback)((id, patch) => {
				sidebar.updateTab(id, patch);
			}, [sidebar]);
			const onBack = (0, react.useCallback)(() => {
				sidebar.closeTab(tabId, props.scope);
			}, [
				sidebar,
				tabId,
				props.scope
			]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DocxControlViewer, {
				ctx: props.ctx,
				store: props.store,
				scope: props.scope,
				path,
				title: props.tab.title,
				viewerId: `${OWN_VIEWER_PREFIX}${extOf(path)}`,
				tabId,
				updateTab,
				onBack
			});
		}
		//#endregion
		//#region src/tabs/locales.ts
		/**
		* `tabs.genoffice` namespace dictionaries: the GenOffice tab's own copy.
		* Each tab artifact owns its namespace — the sidebar core never holds other
		* tabs' copy.
		*/
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"tab.genoffice": "GenOffice",
			"tab.file": "GenOffice 文档"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"tab.genoffice": "GenOffice",
			"tab.file": "GenOffice document"
		};
		/** Dictionary namespace owned by the genoffice tab artifact. */
		const NS = "tabs.genoffice";
		//#endregion
		//#region src/standard/client.ts
		/**
		* GenOffice 的 client facet 主体（dsh-community-standard 形态）。
		*
		* v0.15 中 `client` 是保留 facet 名（归 RFC 0002），manifest 不声明本模块；
		* 生产路径由官方 client bundle 入口（src/client/index.ts）经
		* cordis-client-adapter 执行同一份主体。RFC 0002 定案后，把本模块的构建
		* 产物填进 facets.client.entry 即完成切换——主体零改动。
		*
		* 依赖（CLIENT_REQUIRED / CLIENT_OPTIONAL 镜像）：
		* - Locale（required）：词典注册 + 翻译绑定；
		* - SidebarTab（optional peer）：缺席时跳过全部 UI 注册不崩（BR-003）。
		*/
		/** 全部 UI 注册（tabs + FileViewers + 全局 SSE）。返回合并卸载函数。 */
		function mountSidebar(betterSidebar, t) {
			const offs = [];
			const browserTab = {
				id: BROWSER_TAB_ID,
				title: () => t("tab.genoffice"),
				icon: (size) => (0, react.createElement)(GenOfficeIcon, { size }),
				order: 20,
				single: true,
				component: (props) => (0, react.createElement)(GenOfficePanel, props)
			};
			offs.push(betterSidebar.registerTab(browserTab));
			const fileTab = {
				id: FILE_TAB_ID,
				title: () => t("tab.file"),
				icon: (size) => (0, react.createElement)(GenOfficeIcon, { size }),
				hidden: true,
				dedupeKey: (opened) => opened.path,
				component: (props) => (0, react.createElement)(GenOfficeFileTab, props)
			};
			offs.push(betterSidebar.registerTab(fileTab));
			for (const ext of CLAIMED_EXTS) {
				const viewer = {
					id: `dsh-genoffice:viewer-${ext}`,
					title: () => `GenOffice · .${ext}`,
					icon: (size) => (0, react.createElement)(GenOfficeIcon, { size }),
					exts: [ext],
					priority: 10,
					fetchStrategy: "none",
					component: DocxControlViewer
				};
				offs.push(betterSidebar.registerFileViewer(viewer));
			}
			const es = new EventSource(`${RELAY_BASE}/api/open/stream`);
			es.addEventListener("file", (ev) => {
				try {
					const data = JSON.parse(ev.data);
					const activeSessionId = betterSidebar.getSnapshot?.().sessionId;
					const next = fileOpenOnThisPage(data, activeSessionId);
					if (next === void 0) return;
					betterSidebar.openTab(next.seed);
				} catch {}
			});
			offs.push(() => {
				es.close();
			});
			return () => {
				for (const off of offs.splice(0).reverse()) off();
			};
		}
		var client_default = defineFacet((activation) => {
			const { contracts, scope } = activation;
			const locale = contracts.get(LOCALE);
			const t = locale.bind(NS);
			scope.add(locale.register(NS, {
				zh,
				en
			}));
			if (!contracts.has(SIDEBAR_TAB)) return;
			const sidebar = contracts.get(SIDEBAR_TAB);
			scope.add(sidebar.acquire((betterSidebar) => mountSidebar(betterSidebar, t)));
		});
		//#endregion
		//#region src/client/index.ts
		/** Locale is required; betterSidebar is acquired lazily so its absence
		*  skips registration instead of leaving this fiber PENDING (BR-003). */
		const inject = ["locale"];
		/**
		* Register the GenOffice tab and claimed FileViewers when better-sidebar is present.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			runFacet(client_default, createClientActivation(ctx).activation);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map