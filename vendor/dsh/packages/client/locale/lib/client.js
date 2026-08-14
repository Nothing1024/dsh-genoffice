window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-locale",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		//#region src/locales/zh.ts
		/** zh base dictionary for the common namespace: cross-feature standard words. */
		const zh$1 = {
			"ok": "确定",
			"cancel": "取消",
			"close": "关闭",
			"copy": "复制",
			"copied": "复制成功",
			"retry": "重试",
			"loading": "加载中…",
			"load.failed": "加载失败",
			"submit": "提交",
			"submitting": "正在提交…",
			"next": "下一步",
			"previous": "上一步",
			"skip": "跳过",
			"delete": "删除",
			"edit": "编辑",
			"save": "保存",
			"search": "搜索",
			"more": "更多",
			"collapse": "收起",
			"expand": "展开",
			"back": "返回",
			"unknown": "未知",
			"none": "无",
			"truncated": "已截断"
		};
		//#endregion
		//#region src/locales/en.ts
		/** en base dictionary for the common namespace, checked complete against the zh key set. */
		const en$1 = {
			"ok": "OK",
			"cancel": "Cancel",
			"close": "Close",
			"copy": "Copy",
			"copied": "Copied",
			"retry": "Retry",
			"loading": "Loading…",
			"load.failed": "Failed to load",
			"submit": "Submit",
			"submitting": "Submitting…",
			"next": "Next",
			"previous": "Previous",
			"skip": "Skip",
			"delete": "Delete",
			"edit": "Edit",
			"save": "Save",
			"search": "Search",
			"more": "More",
			"collapse": "Collapse",
			"expand": "Expand",
			"back": "Back",
			"unknown": "Unknown",
			"none": "None",
			"truncated": "Truncated"
		};
		//#endregion
		//#region src/locales/settings.ts
		/** `settings.locale` namespace dictionaries (the Language row's copy). */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = { "language.title": "语言" };
		/** English dictionary, checked complete against the zh key set. */
		const en = { "language.title": "Language" };
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/locale/src/client/LanguageRow.module.css.mjs
		const css = ".r6q_Ta_row{border-bottom:1px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}.r6q_Ta_rowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}.r6q_Ta_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}.r6q_Ta_selector{background:var(--dsw-alias-bg-module-platform);height:36px;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;border-radius:18px;align-items:center;gap:12px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.r6q_Ta_selector:hover{background:var(--dsw-alias-interactive-bg-hover)}.r6q_Ta_chevron{flex:none}";
		const tagId = "@deepseek-ai/dsh-client-locale/LanguageRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-locale";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var LanguageRow_module_css_default = {
			"title": "r6q_Ta_title",
			"selector": "r6q_Ta_selector",
			"rowText": "r6q_Ta_rowText",
			"chevron": "r6q_Ta_chevron",
			"row": "r6q_Ta_row"
		};
		//#endregion
		//#region src/client/LanguageRow.tsx
		/**
		* Language preference row registered into the General section item slot
		* (figma 501:30011 'Setting-Cell'): title + selector pill opening the locale
		* menu. Registered by this package — the locale feature owns its own
		* settings surface.
		*/
		/**
		* Render the Language row.
		* @param props - composed slot props.
		* @returns the row element tree.
		*/
		function LanguageRow({ t, setLocale, useStore }) {
			const active = useStore((s) => s.active);
			const options = useStore((s) => s.options);
			const [open, setOpen] = (0, react.useState)(false);
			const activeLabel = options.find((o) => o.id === active)?.label ?? active;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: LanguageRow_module_css_default.row,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: LanguageRow_module_css_default.rowText,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: LanguageRow_module_css_default.title,
						children: t("language.title")
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
					open,
					onClose: () => {
						setOpen(false);
					},
					items: options.map((o) => ({
						id: o.id,
						label: o.label
					})),
					selectedId: active,
					onSelect: (id) => {
						setLocale(id);
						setOpen(false);
					},
					align: "end",
					portal: true,
					anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: LanguageRow_module_css_default.selector,
						"aria-haspopup": "menu",
						"aria-expanded": open,
						onClick: () => {
							setOpen((v) => !v);
						},
						children: [activeLabel, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { className: LanguageRow_module_css_default.chevron })]
					})
				})]
			});
		}
		//#endregion
		//#region src/client/settings-store.ts
		/**
		* Language row slot store: a mirror of the locale service snapshot. The
		* plugin's apply-world change listener is the only writer; the row component
		* reads via props.useStore.
		*/
		/**
		* Declares the Language row state and write surface.
		* @returns the store handle.
		*/
		function createLanguageRowStore() {
			return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
				init: () => ({
					active: "",
					options: [],
					revision: -1
				}),
				actions: { sync: (d, active, options, revision) => {
					if (revision <= d.revision) return;
					d.active = active;
					d.options = options;
					d.revision = revision;
				} }
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Fallback locale consulted after the active locale misses (also the last-resort initial locale). */
		const FALLBACK_LOCALE = "zh";
		/** Shared namespace for shell-level texts. */
		const COMMON_NS = "common";
		/** Namespace owning this feature's settings-row copy. */
		const SETTINGS_NS = "settings.locale";
		/** localStorage key holding the persisted locale id. */
		const STORAGE_KEY = "dsh.locale";
		/** The two shipped locales. */
		const LOCALES = Object.freeze([{
			id: "zh",
			label: "中文"
		}, {
			id: "en",
			label: "English"
		}]);
		/**
		* Dictionary registry plus locale preference. Lookup chain per key: the
		* entry's namespace in the active locale -> that namespace's zh fallback ->
		* the shared common namespace (active, then zh) -> the key itself (missing
		* text stays visible, fail loud in the UI rather than blank). Reads go
		* through {@link getLocale}; writes only through {@link setLocale};
		* continuous sync through the `locale/change` event, or through the
		* LocaleFace getSnapshot/subscribe pair the render machinery consumes
		* (installed via `ctx.slots.installLocale`).
		*/
		var LocaleService = class {
			dicts = /* @__PURE__ */ new Map();
			bound = /* @__PURE__ */ new Map();
			snapshot;
			listeners = /* @__PURE__ */ new Set();
			ctx;
			/**
			* @param ctx - owning context (change events are emitted on it).
			*/
			constructor(ctx) {
				this.ctx = ctx;
				this.snapshot = Object.freeze({
					active: resolveInitialLocale(),
					locales: LOCALES,
					revision: 0
				});
			}
			/**
			* Read the current immutable locale snapshot.
			* @returns the current snapshot (stable reference until the next change).
			*/
			getLocale() {
				return this.snapshot;
			}
			/**
			* LocaleFace getSnapshot: the current snapshot (carries `revision`; stable
			* reference between changes, uSES-safe).
			* @returns the current snapshot.
			*/
			getSnapshot() {
				return this.snapshot;
			}
			/**
			* LocaleFace subscribe: notified on every snapshot change (locale switch
			* or dictionary registration — registrations bump the revision so already
			* rendered outlets pick up late-arriving dictionaries).
			* @param fn - change callback.
			* @returns unsubscribe.
			*/
			subscribe(fn) {
				this.listeners.add(fn);
				return () => {
					this.listeners.delete(fn);
				};
			}
			/**
			* Switch the active locale — the only preference write entry. Persists the
			* id and emits `locale/change`.
			* @param id - a registered locale id; unknown ids throw.
			*/
			setLocale(id) {
				const match = this.snapshot.locales.find((l) => l.id === id);
				if (match === void 0) throw new Error(`locale "${id}" is not registered`);
				if (this.snapshot.active === match.id) return;
				persistPreference(match.id);
				this.publish(match.id, true);
			}
			register(ns, localeOrDicts, dict) {
				const pairs = typeof localeOrDicts === "string" ? [[localeOrDicts, dict]] : Object.entries(localeOrDicts);
				let locales = this.dicts.get(ns);
				if (!locales) {
					locales = /* @__PURE__ */ new Map();
					this.dicts.set(ns, locales);
				}
				for (const [locale] of pairs) if (locales.has(locale)) throw new Error(`locale namespace "${ns}" already has locale "${locale}"`);
				for (const [locale, entries] of pairs) locales.set(locale, entries);
				this.publish(this.snapshot.active, false);
				return () => {
					const owner = this.dicts.get(ns);
					/* v8 ignore next -- defensive: a namespace's locales map is created on
					* first register and never removed, so the disposer always finds it. */
					if (!owner) return;
					let removed = false;
					for (const [locale, entries] of pairs) if (owner.get(locale) === entries) {
						owner.delete(locale);
						removed = true;
					}
					if (removed) this.publish(this.snapshot.active, false);
				};
			}
			bind(ns) {
				let t = this.bound.get(ns);
				if (!t) {
					t = (key, params) => this.translate(ns, key, params);
					this.bound.set(ns, t);
					return t;
				}
				return t;
			}
			translate(ns, key, params) {
				const template = this.lookup(ns, key) ?? (ns !== "common" ? this.lookup("common", key) : void 0) ?? key;
				if (!params) return template;
				return template.replace(/\{(\w+)\}/g, (match, name) => name in params ? String(params[name]) : match);
			}
			lookup(ns, key) {
				const locales = this.dicts.get(ns);
				return locales?.get(this.snapshot.active)?.[key] ?? locales?.get("zh")?.[key];
			}
			/**
			* Advance the snapshot revision and notify LocaleFace subscribers (render
			* refresh). Only an active-locale switch additionally emits
			* `locale/change` — dictionary registrations stay off the event so
			* registration-heavy boot cannot storm event listeners (which may
			* re-register slots in response).
			*/
			publish(active, localeChanged) {
				this.snapshot = Object.freeze({
					active,
					locales: this.snapshot.locales,
					revision: this.snapshot.revision + 1
				});
				if (localeChanged) this.ctx.emit("locale/change", this.snapshot);
				for (const fn of [...this.listeners]) try {
					fn();
				} catch (error) {
					console.error("locale subscriber crashed:", error);
				}
			}
		};
		/**
		* The locale a fresh service opens with: an explicit preference the user
		* already chose wins over the browser's own language, which in turn wins over
		* {@link FALLBACK_LOCALE} (non-browser boots and browsers set to a language
		* this app does not ship).
		*/
		function resolveInitialLocale() {
			return restorePreference() ?? detectBrowserLocale() ?? "zh";
		}
		/** Read the persisted locale id; unknown or unreadable values read as no preference. */
		function restorePreference() {
			if (typeof localStorage === "undefined") return void 0;
			try {
				const stored = localStorage.getItem(STORAGE_KEY);
				if (stored === "zh" || stored === "en") return stored;
			} catch {}
		}
		/**
		* The first shipped locale the browser asks for, matched on the primary
		* subtag so every regional variant lands on its language (`zh-Hans-CN` -> zh,
		* `en-GB` -> en). `window` is the browser test, not `navigator`: Node exposes
		* a global `navigator` reporting the machine's own language, which would
		* otherwise decide the locale for non-browser runs (node e2e booting the
		* client tree). `navigator.language` trails the ordered `languages` list and
		* covers its absence on hosts that expose only the single tag.
		*/
		function detectBrowserLocale() {
			if (typeof window === "undefined") return void 0;
			for (const tag of [...navigator.languages ?? [], navigator.language]) {
				const primary = tag.toLowerCase().split("-")[0];
				const match = LOCALES.find((locale) => locale.id === primary);
				if (match) return match.id;
			}
		}
		/** Persist the locale id; storage failures are non-fatal (preference resets next boot). */
		function persistPreference(id) {
			if (typeof localStorage === "undefined") return;
			try {
				localStorage.setItem(STORAGE_KEY, id);
			} catch {}
		}
		/** Required services: the slot registry (the feature registers its own settings row). */
		const inject = ["slots"];
		/**
		* Client plugin body: provide the locale service with base dictionaries and
		* register the feature-owned Language preference row into the General
		* section's item slot (a feature owns its settings surface).
		* @param ctx - client cordis context.
		*/
		function apply(ctx) {
			const locale = new LocaleService(ctx);
			locale.register(COMMON_NS, {
				zh: zh$1,
				en: en$1
			});
			locale.register(SETTINGS_NS, {
				zh,
				en
			});
			ctx.provide("locale", locale);
			ctx.slots.installLocale(locale);
			const store = createLanguageRowStore();
			let bound;
			const sync = (snapshot) => {
				bound?.sync(snapshot.active, snapshot.locales.map((l) => ({
					id: l.id,
					label: l.label
				})), snapshot.revision);
			};
			ctx.on("locale/change", sync);
			const injected = (actions) => {
				bound = actions;
				sync(locale.getLocale());
				return { setLocale: (id) => {
					locale.setLocale(id);
				} };
			};
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "language",
				order: 0,
				store,
				locale: SETTINGS_NS,
				inject: injected
			}, LanguageRow));
		}
		//#endregion
		exports.COMMON_NS = COMMON_NS;
		exports.FALLBACK_LOCALE = FALLBACK_LOCALE;
		exports.LocaleService = LocaleService;
		exports.SETTINGS_NS = SETTINGS_NS;
		exports.STORAGE_KEY = STORAGE_KEY;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map