window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-theme",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		//#region ../../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-theme/src/client/AppearanceRow.module.css.mjs
		const css = ".bUa63q_group{border-bottom:1px solid var(--dsw-alias-border-l2);flex-direction:column;gap:8px;padding:16px 0;display:flex}.bUa63q_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}.bUa63q_cubeRow{flex-wrap:wrap;align-items:stretch;gap:8px;display:flex}.bUa63q_themeCube{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border-radius:16px;flex-direction:column;flex:180px;justify-content:center;align-items:center;gap:4px;padding:20px 32px;font-size:14px;line-height:22px;display:flex}.bUa63q_themeCube:hover:not(.bUa63q_selected){background:var(--dsw-alias-interactive-bg-hover)}.bUa63q_selected{background:var(--dsw-alias-bg-module-platform);border-color:var(--dsw-static-neutral-bluish-400)}";
		const tagId = "@deepseek-ai/dsh-client-ui-theme/AppearanceRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-theme";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var AppearanceRow_module_css_default = {
			"title": "bUa63q_title",
			"group": "bUa63q_group",
			"selected": "bUa63q_selected",
			"cubeRow": "bUa63q_cubeRow",
			"themeCube": "bUa63q_themeCube"
		};
		//#endregion
		//#region src/client/AppearanceRow.tsx
		/**
		* Appearance preference row registered into the General section item slot
		* (figma 501:30012 'Frame 2117131228'): title + three preference cubes.
		* Registered by this package — the theme feature owns its own settings
		* surface. Selection follows the persisted preference, never the resolved
		* active theme.
		*/
		/** Cube order and icons (figma 501:30015-30017: Light, Dark, System). */
		const CUBES = [
			{
				id: "light",
				labelKey: "appearance.light",
				Icon: _deepseek_ai_dsh_client_ui_primitives.IconLightOutline16
			},
			{
				id: "dark",
				labelKey: "appearance.dark",
				Icon: _deepseek_ai_dsh_client_ui_primitives.IconDarkOutline16
			},
			{
				id: "system",
				labelKey: "appearance.system",
				Icon: _deepseek_ai_dsh_client_ui_primitives.IconFollowsystemOutline16
			}
		];
		/**
		* Render the Appearance row.
		* @param props - composed slot props.
		* @returns the row element tree.
		*/
		function AppearanceRow({ t, setTheme, useStore }) {
			const preference = useStore((s) => s.preference);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: AppearanceRow_module_css_default.group,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: AppearanceRow_module_css_default.title,
					children: t("appearance.title")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: AppearanceRow_module_css_default.cubeRow,
					children: CUBES.map(({ id, labelKey, Icon }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: clsx(AppearanceRow_module_css_default.themeCube, preference === id && AppearanceRow_module_css_default.selected),
						"aria-pressed": preference === id,
						onClick: () => {
							setTheme(id);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {}), t(labelKey)]
					}, id))
				})]
			});
		}
		//#endregion
		//#region src/client/settings-store.ts
		/**
		* Appearance row slot store: a mirror of the theme service snapshot. The
		* plugin's apply-world change listener is the only writer; the row component
		* reads via props.useStore.
		*/
		/**
		* Declares the Appearance row state and write surface.
		* @returns the store handle.
		*/
		function createAppearanceRowStore() {
			return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
				init: () => ({
					preference: "system",
					revision: -1
				}),
				actions: { sync: (d, preference, revision) => {
					if (revision <= d.revision) return;
					d.preference = preference;
					d.revision = revision;
				} }
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** `settings.theme` namespace dictionaries (the Appearance row's copy). */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"appearance.title": "外观",
			"appearance.light": "浅色",
			"appearance.dark": "深色",
			"appearance.system": "跟随系统"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"appearance.title": "Appearance",
			"appearance.light": "Light",
			"appearance.dark": "Dark",
			"appearance.system": "System"
		};
		//#endregion
		//#region src/client/index.ts
		/** Namespace owning this feature's settings-row copy. */
		const SETTINGS_NS = "settings.theme";
		/** localStorage key holding the persisted theme preference. */
		const STORAGE_KEY = "dsh.theme";
		/** Default preference when nothing (or garbage) is persisted. */
		const DEFAULT_PREFERENCE = "system";
		const BUILTIN_THEMES = Object.freeze([Object.freeze({
			id: "light",
			colorScheme: "light",
			tokens: Object.freeze({})
		}), Object.freeze({
			id: "dark",
			colorScheme: "dark",
			tokens: Object.freeze({})
		})]);
		/**
		* Theme registry and preference owner. `light`/`dark` are built in (the base
		* stylesheets carry both palettes); third-party themes register alias-layer
		* overrides. Reads go through {@link getTheme}; writes only through
		* {@link setTheme}; continuous sync only through the `theme/change` event.
		* The service holds the `prefers-color-scheme` media query (environment
		* sensing, not presentation) and re-emits when the OS scheme flips while the
		* preference is `system`.
		*/
		var ThemeService = class {
			ctx;
			themes = [...BUILTIN_THEMES];
			preference;
			revision = 0;
			snapshot;
			media;
			/**
			* @param ctx - owning context (change events are emitted on it; the
			* media-query listener is released through ctx.effect on dispose).
			*/
			constructor(ctx) {
				this.ctx = ctx;
				this.preference = restorePreference();
				this.media = typeof matchMedia === "undefined" ? void 0 : matchMedia("(prefers-color-scheme: dark)");
				this.snapshot = this.buildSnapshot();
				if (this.media !== void 0) {
					const media = this.media;
					const onChange = () => {
						if (this.preference !== "system") return;
						this.publish();
					};
					ctx.effect(() => {
						media.addEventListener("change", onChange);
						return () => {
							media.removeEventListener("change", onChange);
						};
					}, "ui-theme: prefers-color-scheme listener");
				}
			}
			/**
			* Read the current immutable theme snapshot.
			* @returns the current snapshot (stable reference until the next change).
			*/
			getTheme() {
				return this.snapshot;
			}
			/**
			* Switch the theme preference — the only preference write entry. Persists
			* the preference and emits `theme/change`.
			* @param id - a registered theme id or `system`; unknown ids throw.
			*/
			setTheme(id) {
				if (id !== "system" && !this.themes.some((t) => t.id === id)) throw new Error(`theme "${id}" is not registered`);
				if (this.preference === id) return;
				this.preference = id;
				persistPreference(this.preference);
				this.publish();
			}
			/**
			* Register a theme. Duplicate id throws (single occupant per id; the
			* built-in pair counts; `system` is a preference, not a registrable id).
			* @param definition - theme id, colorScheme, and alias-token overrides.
			* @returns disposer. Disposing the theme backing the active preference
			* resets the preference to the default so the UI never keeps tokens of an
			* unregistered theme.
			*/
			register(definition) {
				if (definition.id === "system") throw new Error("\"system\" is a preference, not a registrable theme id");
				if (this.themes.some((t) => t.id === definition.id)) throw new Error(`theme "${definition.id}" is already registered`);
				this.themes = [...this.themes, definition];
				this.publish();
				return () => {
					if (!this.themes.some((t) => t.id === definition.id)) return;
					this.themes = this.themes.filter((t) => t.id !== definition.id);
					if (this.preference === definition.id) {
						this.preference = DEFAULT_PREFERENCE;
						persistPreference(this.preference);
					}
					this.publish();
				};
			}
			buildSnapshot() {
				const resolvedId = this.preference === "system" ? this.media?.matches === true ? "dark" : "light" : this.preference;
				const active = this.themes.find((t) => t.id === resolvedId);
				/* v8 ignore next 2 -- needs a registry without light/dark, which register()/dispose() cannot produce */
				if (active === void 0) throw new Error(`theme registry lost "${resolvedId}"`);
				return Object.freeze({
					preference: this.preference,
					active,
					themes: Object.freeze([...this.themes]),
					revision: this.revision
				});
			}
			publish() {
				this.revision += 1;
				this.snapshot = this.buildSnapshot();
				this.ctx.emit("theme/change", this.snapshot);
			}
		};
		/** Read the persisted preference; unknown or unreadable values fall back to the default. */
		function restorePreference() {
			if (typeof localStorage === "undefined") return DEFAULT_PREFERENCE;
			try {
				const stored = localStorage.getItem(STORAGE_KEY);
				if (stored === "light" || stored === "dark" || stored === "system") return stored;
			} catch {}
			return DEFAULT_PREFERENCE;
		}
		/** Persist the preference; storage failures are non-fatal (preference resets next boot). */
		function persistPreference(preference) {
			if (typeof localStorage === "undefined") return;
			try {
				localStorage.setItem(STORAGE_KEY, preference);
			} catch {}
		}
		/** Required services: slots + locale (the feature registers its own settings row with localized copy). */
		const inject = ["slots", "locale"];
		/**
		* Client plugin body: provide the theme service and register the
		* feature-owned Appearance preference row into the General section's item
		* slot (a feature owns its settings surface).
		* @param ctx - client cordis context.
		*/
		function apply(ctx) {
			const theme = new ThemeService(ctx);
			ctx.provide("theme", theme);
			ctx.effect(() => ctx.locale.register(SETTINGS_NS, {
				zh,
				en
			}), "ui-theme: settings row dictionaries");
			const store = createAppearanceRowStore();
			let bound;
			const sync = (snapshot) => {
				bound?.sync(snapshot.preference, snapshot.revision);
			};
			ctx.on("theme/change", sync);
			const injected = (actions) => {
				bound = actions;
				sync(theme.getTheme());
				return { setTheme: (id) => {
					theme.setTheme(id);
				} };
			};
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "appearance",
				order: 10,
				store,
				locale: SETTINGS_NS,
				inject: injected
			}, AppearanceRow));
		}
		//#endregion
		exports.DEFAULT_PREFERENCE = DEFAULT_PREFERENCE;
		exports.SETTINGS_NS = SETTINGS_NS;
		exports.STORAGE_KEY = STORAGE_KEY;
		exports.ThemeService = ThemeService;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map