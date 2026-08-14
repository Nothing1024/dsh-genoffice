window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-settings-general",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_web_react = require("@deepseek-ai/dsh-client-web-react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-settings-general/src/client/chrome.module.css.mjs
		const css$3 = ".zqiQQG_triggerLabel{white-space:nowrap;overflow:hidden}";
		const tagId$3 = "@deepseek-ai/dsh-client-ui-settings-general/chrome.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-general";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var chrome_module_css_default = { "triggerLabel": "zqiQQG_triggerLabel" };
		//#endregion
		//#region src/client/chrome.tsx
		/**
		* Shell chrome content registered into the shell's trigger/header seats: the
		* trigger row icon + label (figma sidebar foot) and the panel title text.
		* The shell renders the surrounding chrome (button, nav heading row) and
		* reads each entry's `label` option for aria text.
		*/
		/**
		* Render the trigger row content (icon; label only in the wide column).
		* @param props - composed slot props.
		* @returns the trigger content fragment.
		*/
		function TriggerContent({ wide, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutline14, { size: !wide ? 18 : 14 }), wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: chrome_module_css_default.triggerLabel,
				children: t("trigger")
			})] });
		}
		/**
		* Render the panel title text.
		* @param props - composed slot props.
		* @returns the title text node.
		*/
		function HeaderContent({ t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: t("title") });
		}
		/**
		* Render the close button's visually-hidden label text.
		* @param props - composed slot props.
		* @returns the label text node.
		*/
		function CloseLabel({ t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: t("close") });
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-settings-general/src/client/GeneralSection.module.css.mjs
		const css$2 = ".fJxyqq_section{flex-direction:column;width:100%;display:flex}.fJxyqq_section>:last-child{border-bottom:none}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-settings-general/GeneralSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-general";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var GeneralSection_module_css_default = { "section": "fJxyqq_section" };
		//#endregion
		//#region src/client/GeneralSection.tsx
		/**
		* Render the General section content column.
		* @param props - composed slot props (contract/slots.ts).
		* @returns the section element tree.
		*/
		function GeneralSection({ renderSlot }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: GeneralSection_module_css_default.section,
				children: renderSlot("settings.general.item", {})
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-settings-general/src/client/SettingsDocumentAction.module.css.mjs
		const css$1 = ".c3yywa_action{align-items:center;gap:8px;min-width:0;display:flex}.c3yywa_error{max-width:180px;color:var(--dsw-alias-state-error-primary);text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px;overflow:hidden}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-settings-general/SettingsDocumentAction.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-general";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var SettingsDocumentAction_module_css_default = {
			"action": "c3yywa_action",
			"error": "c3yywa_error"
		};
		//#endregion
		//#region src/client/SettingsDocumentAction.tsx
		/** Optional settings-header action for opening a file-backed Host document. */
		/**
		* Render the open-document action only after Host metadata confirms document availability.
		* @param props - header owner props, localized copy, and injected document state.
		* @returns the action, or null while unavailable or unresolved.
		*/
		function SettingsDocumentAction({ controller, useSnapshot, t }) {
			const state = useSnapshot((snapshot) => snapshot);
			(0, react.useEffect)(() => {
				controller.load();
			}, [controller]);
			if (state.status !== "ready") return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SettingsDocumentAction_module_css_default.action,
				children: [state.error === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: SettingsDocumentAction_module_css_default.error,
					role: "alert",
					children: t("openDocument.error")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					size: "sm",
					disabled: state.opening,
					onClick: () => {
						controller.open();
					},
					children: t("openDocument")
				})]
			});
		}
		//#endregion
		//#region src/client/settings-document-store.ts
		function messageOf$1(error) {
			return error instanceof Error ? error.message : String(error);
		}
		/** Loads local-document availability and invokes the pathless Host-owned open operation. */
		var SettingsDocumentStore = class {
			api;
			/** uSES-safe state source shared by the registered header action. */
			store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)({
				status: "idle",
				opening: false,
				error: null
			});
			generation = 0;
			/**
			* @param api - loopback settings wire face that reports and opens the provider document.
			*/
			constructor(api) {
				this.api = api;
			}
			/**
			* Load whether the current provider owns a local document.
			* @returns after the latest metadata response updates the store.
			*/
			async load() {
				const generation = ++this.generation;
				this.store.update((state) => {
					state.status = "loading";
					state.error = null;
				});
				try {
					const { result } = await this.api.settings.describe({});
					if (generation !== this.generation) return;
					if (!result.ok) {
						this.store.update((state) => {
							state.status = "unavailable";
							state.error = result.error.message;
						});
						return;
					}
					this.store.update((state) => {
						state.status = result.value.hasDocument ? "ready" : "unavailable";
						state.error = null;
					});
				} catch (error) {
					if (generation !== this.generation) return;
					this.store.update((state) => {
						state.status = "unavailable";
						state.error = messageOf$1(error);
					});
				}
			}
			/**
			* Open the loaded document once; concurrent gestures collapse behind the in-flight action.
			* @returns after the native-open request settles, or immediately when unavailable/already opening.
			*/
			async open() {
				const current = this.store.getSnapshot();
				if (current.status !== "ready" || current.opening) return;
				this.store.update((state) => {
					state.opening = true;
					state.error = null;
				});
				try {
					const response = await this.api.settings.openDocument({});
					if (!response.result.ok) throw new Error(response.result.error.message);
				} catch (error) {
					this.store.update((state) => {
						state.error = messageOf$1(error);
					});
				} finally {
					this.store.update((state) => {
						state.opening = false;
					});
				}
			}
		};
		/**
		* Refresh document availability after reconnect only when a surface has already requested it.
		* @param controller - optional loopback document state owner.
		*/
		function refreshDocumentIfLoaded(controller) {
			if (controller === void 0 || controller.store.getSnapshot().status === "idle") return;
			controller.load();
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-settings-general/src/client/WelcomeNotice.module.css.mjs
		const css = ".XvBaEq_page{z-index:1;box-sizing:border-box;width:min(640px,100vw - 64px);max-height:100vh;color:var(--dsw-alias-label-primary);--welcome-ease-out:cubic-bezier(.23, 1, .32, 1);padding:clamp(64px,9vh,104px) 0 40px;position:relative;overflow-y:auto}.XvBaEq_brand{color:var(--dsw-alias-label-primary);align-items:center;margin-bottom:42px;display:flex}.XvBaEq_title{letter-spacing:-.02em;outline:none;margin:0;font-size:28px;font-weight:600;line-height:36px}.XvBaEq_opening,.XvBaEq_reflection,.XvBaEq_feedback,.XvBaEq_error{margin:0}.XvBaEq_opening{margin-top:30px}.XvBaEq_reflection{margin-top:36px;padding:0}.XvBaEq_feedback{margin-top:30px}.XvBaEq_opening,.XvBaEq_reflection,.XvBaEq_feedback{color:var(--dsw-alias-label-secondary);font-size:16px;line-height:28px}.XvBaEq_feedback strong{color:inherit;font-weight:500}.XvBaEq_footer{justify-content:flex-end;margin-top:32px;display:flex}.XvBaEq_error{color:var(--dsw-alias-state-error-primary);margin-top:20px;font-size:14px;line-height:22px}.XvBaEq_primary{min-width:120px;transition:transform .14s var(--welcome-ease-out)}.XvBaEq_primary:active:not(:disabled){transform:scale(.97)}.XvBaEq_brand,.XvBaEq_title,.XvBaEq_opening,.XvBaEq_reflection,.XvBaEq_feedback,.XvBaEq_footer{animation:XvBaEq_welcome-enter .28s var(--welcome-ease-out) both}.XvBaEq_title{animation-delay:40ms}.XvBaEq_opening{animation-delay:80ms}.XvBaEq_reflection{animation-delay:.12s}.XvBaEq_feedback{animation-delay:.16s}.XvBaEq_footer{animation-delay:.2s}@keyframes XvBaEq_welcome-enter{0%{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@media (prefers-reduced-motion:reduce){.XvBaEq_brand,.XvBaEq_title,.XvBaEq_opening,.XvBaEq_reflection,.XvBaEq_feedback,.XvBaEq_footer{animation:none}.XvBaEq_primary{transition:none}}@media (width<=560px){.XvBaEq_page{width:calc(100vw - 40px);padding-top:38px}.XvBaEq_brand{margin-bottom:30px}.XvBaEq_opening{margin-top:24px}.XvBaEq_reflection,.XvBaEq_feedback{margin-top:28px}.XvBaEq_footer{margin-top:30px}.XvBaEq_primary{width:100%}}";
		const tagId = "@deepseek-ai/dsh-client-ui-settings-general/WelcomeNotice.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-general";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var WelcomeNotice_module_css_default = {
			"feedback": "XvBaEq_feedback",
			"footer": "XvBaEq_footer",
			"reflection": "XvBaEq_reflection",
			"opening": "XvBaEq_opening",
			"page": "XvBaEq_page",
			"title": "XvBaEq_title",
			"welcome-enter": "XvBaEq_welcome-enter",
			"primary": "XvBaEq_primary",
			"brand": "XvBaEq_brand",
			"error": "XvBaEq_error"
		};
		//#endregion
		//#region src/client/WelcomeNotice.tsx
		/** Product-wide, versioned first-run welcome step. */
		function emphasizedFeedback(paragraph, emphasis) {
			const index = paragraph.indexOf(emphasis);
			/* v8 ignore next -- both locale values derive from one owner object that contains the emphasis */
			if (index < 0) return paragraph;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				paragraph.slice(0, index),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: emphasis }),
				paragraph.slice(index + emphasis.length)
			] });
		}
		/** Render the mandatory notice until its current version is acknowledged. */
		function WelcomeNotice(props) {
			const { complete, controller, useSnapshot, t } = props;
			const state = useSnapshot((snapshot) => snapshot);
			const finished = (0, react.useRef)(false);
			const titleRef = (0, react.useRef)(null);
			const finish = (0, react.useCallback)(() => {
				if (finished.current) return;
				finished.current = true;
				complete();
			}, [complete]);
			(0, react.useEffect)(() => {
				if (state.status === "idle") controller.load();
			}, [controller, state.status]);
			(0, react.useEffect)(() => {
				if (state.acknowledged) finish();
			}, [finish, state.acknowledged]);
			(0, react.useEffect)(() => {
				if (state.status === "ready" && !state.acknowledged) titleRef.current?.focus();
			}, [state.acknowledged, state.status]);
			if (state.status === "idle" || state.status === "loading" || state.acknowledged) return null;
			const acknowledge = async () => {
				if (await controller.acknowledge()) finish();
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.OnboardingSurface, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: WelcomeNotice_module_css_default.page,
				role: "region",
				"aria-labelledby": "welcome-notice-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: WelcomeNotice_module_css_default.brand,
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.BrandWordmark, { size: 24 })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						ref: titleRef,
						id: "welcome-notice-title",
						className: WelcomeNotice_module_css_default.title,
						tabIndex: -1,
						children: t("welcome.title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: WelcomeNotice_module_css_default.opening,
						children: t("welcome.paragraph.0")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("blockquote", {
						className: WelcomeNotice_module_css_default.reflection,
						children: t("welcome.paragraph.1")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: WelcomeNotice_module_css_default.feedback,
						children: emphasizedFeedback(t("welcome.paragraph.2"), t("welcome.feedbackEmphasis"))
					}),
					state.error === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: WelcomeNotice_module_css_default.error,
						role: "alert",
						children: t("welcome.error")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: WelcomeNotice_module_css_default.footer,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							className: WelcomeNotice_module_css_default.primary,
							disabled: state.status === "saving",
							onClick: () => {
								acknowledge();
							},
							children: t("welcome.continue")
						})
					})
				]
			}) });
		}
		//#endregion
		//#region src/onboarding-copy.ts
		/** Durable settings namespace for product-wide GUI onboarding facts. */
		const WELCOME_NOTICE_SETTINGS_NAMESPACE = "ui-onboarding";
		/** Field storing the last welcome notice version the user acknowledged. */
		const WELCOME_NOTICE_ACK_FIELD = "welcomeNoticeVersion";
		/**
		* Bump only when the notice changes materially and every user should see it
		* again. The acknowledgement is compared for exact equality.
		*/
		const WELCOME_NOTICE_VERSION = "2026-07-30.7";
		/** The complete editable welcome notice in both supported GUI locales. */
		const WELCOME_NOTICE_COPY = {
			zh: {
				title: "内测声明",
				paragraphs: [
					"感谢您愿意拨冗试用 DeepSeek Harness。当前版本仍处于内部测试阶段，功能仍待完善，体验难免有些粗糙。",
					"“如切如磋，如琢如磨。” 产品的成长，离不开一次次真实的碰撞与坦诚的反馈。您在真实使用中发现的问题，也可能促使我们重新审视，甚至推翻已有的设计。",
					"为了帮助我们更准确地还原您真实使用中的问题，内测版本默认会上传所有 Session Log；如需关闭，可以设置环境变量 DSH_TELEMETRY_DISABLED=1。另外，如果您有任何反馈与建议，请在企业微信群中留言告诉我们。每一条反馈，都会帮助我们把它打磨得更好。"
				],
				feedbackEmphasis: "如果您有任何反馈与建议，请在企业微信群中留言告诉我们",
				continueLabel: "继续"
			},
			en: {
				title: "内测声明",
				paragraphs: [
					"感谢您愿意拨冗试用 DeepSeek Harness。当前版本仍处于内部测试阶段，功能仍待完善，体验难免有些粗糙。",
					"“如切如磋，如琢如磨。” 产品的成长，离不开一次次真实的碰撞与坦诚的反馈。您在真实使用中发现的问题，也可能促使我们重新审视，甚至推翻已有的设计。",
					"为了帮助我们更准确地还原您真实使用中的问题，内测版本默认会上传所有 Session Log；如需关闭，可以设置环境变量 DSH_TELEMETRY_DISABLED=1。另外，如果您有任何反馈与建议，请在企业微信群中留言告诉我们。每一条反馈，都会帮助我们把它打磨得更好。"
				],
				feedbackEmphasis: "如果您有任何反馈与建议，请在企业微信群中留言告诉我们",
				continueLabel: "继续"
			}
		};
		//#endregion
		//#region src/client/welcome-store.ts
		function messageOf(error) {
			return error instanceof Error ? error.message : String(error);
		}
		function acknowledgementOf(view) {
			if (typeof view.value !== "object" || view.value === null) return void 0;
			const value = view.value[WELCOME_NOTICE_ACK_FIELD];
			return typeof value === "string" ? value : void 0;
		}
		/** Coordinates durable Host acknowledgement or a process-local remote fallback. */
		var WelcomeNoticeStore = class {
			api;
			persistence;
			/** uSES-safe state source shared by the registered welcome step. */
			store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)({
				status: "idle",
				acknowledged: false,
				error: null
			});
			generation = 0;
			/**
			* @param api - settings wire face used for durable reads and writes.
			* @param persistence - remote browsers use memory because settings is loopback-only.
			*/
			constructor(api, persistence = "host") {
				this.api = api;
				this.persistence = persistence;
			}
			/** Load the acknowledgement from Host settings or initialize process-local state. */
			async load() {
				const generation = ++this.generation;
				if (this.persistence === "memory") {
					this.store.update((state) => {
						state.status = "ready";
						state.error = null;
					});
					return;
				}
				this.store.update((state) => {
					state.status = "loading";
					state.error = null;
				});
				try {
					const response = await this.api.settings.describe({});
					if (!response.result.ok) throw new Error(response.result.error.message);
					const view = response.result.value.namespaces.find((candidate) => candidate.ns === WELCOME_NOTICE_SETTINGS_NAMESPACE);
					if (view === void 0) throw new Error("welcome acknowledgement settings are unavailable");
					if (generation !== this.generation) return;
					this.store.update((state) => {
						state.status = "ready";
						state.acknowledged = acknowledgementOf(view) === WELCOME_NOTICE_VERSION;
						state.error = null;
					});
				} catch (error) {
					if (generation !== this.generation) return;
					this.store.update((state) => {
						state.status = "error";
						state.acknowledged = false;
						state.error = messageOf(error);
					});
				}
			}
			/**
			* Acknowledge this copy version. The Host path mutation is idempotent across
			* tabs and preserves sibling settings; remote fallback changes only this store.
			* @returns true when the selected persistence mode accepted the acknowledgement.
			*/
			async acknowledge() {
				const generation = ++this.generation;
				if (this.persistence === "memory") {
					this.store.update((state) => {
						state.status = "ready";
						state.acknowledged = true;
						state.error = null;
					});
					return true;
				}
				this.store.update((state) => {
					state.status = "saving";
					state.error = null;
				});
				try {
					const response = await this.api.settings.mutate({
						ns: WELCOME_NOTICE_SETTINGS_NAMESPACE,
						ops: [{
							op: "set",
							path: [WELCOME_NOTICE_ACK_FIELD],
							value: WELCOME_NOTICE_VERSION
						}]
					});
					if (!response.result.ok) throw new Error(response.result.error.message);
					if (generation === this.generation) this.store.update((state) => {
						state.status = "ready";
						state.acknowledged = true;
						state.error = null;
					});
					return true;
				} catch (error) {
					if (generation === this.generation) this.store.update((state) => {
						state.status = "error";
						state.acknowledged = false;
						state.error = messageOf(error);
					});
					return false;
				}
			}
		};
		/**
		* Refresh only after welcome state has left idle. A memory-mode load retains
		* acknowledgement so reconnect and settings-change refreshes do not reopen a
		* process-local notice.
		* @param controller - welcome state owner whose current status decides whether to load.
		*/
		function refreshWelcomeIfLoaded(controller) {
			if (controller.store.getSnapshot().status === "idle") return;
			controller.load();
		}
		//#endregion
		//#region src/client/locales.ts
		/** Shell chrome, General-nav, and welcome-notice dictionaries; feature rows own their copy. */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"trigger": "设置",
			"title": "设置",
			"close": "关闭",
			"openDocument": "打开配置文件",
			"openDocument.error": "无法打开配置文件",
			"general.nav": "通用设置",
			"welcome.title": WELCOME_NOTICE_COPY.zh.title,
			"welcome.paragraph.0": WELCOME_NOTICE_COPY.zh.paragraphs[0],
			"welcome.paragraph.1": WELCOME_NOTICE_COPY.zh.paragraphs[1],
			"welcome.paragraph.2": WELCOME_NOTICE_COPY.zh.paragraphs[2],
			"welcome.feedbackEmphasis": WELCOME_NOTICE_COPY.zh.feedbackEmphasis,
			"welcome.continue": WELCOME_NOTICE_COPY.zh.continueLabel,
			"welcome.error": "暂时无法保存确认状态，请重试。"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"trigger": "Settings",
			"title": "Settings",
			"close": "Close",
			"openDocument": "Open configuration file",
			"openDocument.error": "Could not open configuration file",
			"general.nav": "General",
			"welcome.title": WELCOME_NOTICE_COPY.en.title,
			"welcome.paragraph.0": WELCOME_NOTICE_COPY.en.paragraphs[0],
			"welcome.paragraph.1": WELCOME_NOTICE_COPY.en.paragraphs[1],
			"welcome.paragraph.2": WELCOME_NOTICE_COPY.en.paragraphs[2],
			"welcome.feedbackEmphasis": WELCOME_NOTICE_COPY.en.feedbackEmphasis,
			"welcome.continue": WELCOME_NOTICE_COPY.en.continueLabel,
			"welcome.error": "The acknowledgement could not be saved. Please try again."
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin (shell chrome + General copy). */
		const NS = "settings";
		/**
		* Required services (cordis fiber inject). The target slots are declared by
		* ui-settings' apply, whose activation order relative to this one is NOT
		* constrained; registrations depend on their slots through `slots.inject()`.
		*/
		const inject = [
			"slots",
			"locale",
			"connection"
		];
		/**
		* Register the `settings` dictionaries, the chrome content, and the General
		* section, each once its slot declaration is on the ledger.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-settings-general: dictionaries");
			const t = ctx.locale.bind(NS);
			const connection = ctx.get("connection");
			const documentController = connection.isLoopback ? new SettingsDocumentStore(connection.api) : void 0;
			const documentInjected = documentController === void 0 ? void 0 : (() => {
				const useSnapshot = (0, _deepseek_ai_dsh_client_web_react.bindSnapshotSelector)(documentController.store);
				return () => ({
					controller: documentController,
					useSnapshot
				});
			})();
			const welcomeController = new WelcomeNoticeStore(connection.api, connection.isLoopback ? "host" : "memory");
			const useWelcomeSnapshot = (0, _deepseek_ai_dsh_client_web_react.bindSnapshotSelector)(welcomeController.store);
			const welcomeInjected = () => ({
				controller: welcomeController,
				useSnapshot: useWelcomeSnapshot
			});
			ctx.effect(() => {
				const refresh = (ns) => {
					if (ns !== void 0 && ns !== "ui-onboarding") return;
					refreshWelcomeIfLoaded(welcomeController);
				};
				const disposers = [ctx.on("settings/changed", refresh), ctx.on("connection/reset", () => {
					refresh();
					refreshDocumentIfLoaded(documentController);
				})];
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "ui-settings-general: metadata invalidations");
			ctx.slots.inject("settings.trigger", () => ctx.slots.register({
				name: "settings.trigger",
				locale: NS
			}, TriggerContent));
			ctx.slots.inject("settings.header", () => ctx.slots.register({
				name: "settings.header",
				locale: NS
			}, HeaderContent));
			if (documentInjected !== void 0) ctx.slots.inject("settings.action", () => ctx.slots.register({
				name: "settings.action",
				id: "open-document",
				order: 0,
				locale: NS,
				inject: documentInjected
			}, SettingsDocumentAction));
			ctx.slots.inject("settings.close", () => ctx.slots.register({
				name: "settings.close",
				locale: NS
			}, CloseLabel));
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "general",
				order: 0,
				label: () => {
					return t("general.nav");
				},
				locale: NS,
				children: { "settings.general.item": {
					kind: "list",
					scope: "root"
				} }
			}, GeneralSection));
			ctx.slots.inject("settings.onboarding", () => ctx.slots.register({
				name: "settings.onboarding",
				id: "welcome-notice",
				order: -100,
				locale: NS,
				inject: welcomeInjected
			}, WelcomeNotice));
		}
		//#endregion
		exports.SettingsDocumentStore = SettingsDocumentStore;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map