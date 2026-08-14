window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-models",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_web_react = require("@deepseek-ai/dsh-client-web-react");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let _deepseek_ai_dsh_client_schema_form = require("@deepseek-ai/dsh-client-schema-form");
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-models/src/client/ModelsSection.module.css.mjs
		const css$1 = ".FVET-W_section{max-width:720px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:12px;display:flex}.FVET-W_title{color:var(--dsw-alias-label-primary);margin:0;font-size:16px;font-weight:500;line-height:24px}.FVET-W_intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:14px;line-height:22px}.FVET-W_notice{color:var(--dsw-alias-state-warn-label);margin:0;font-size:12px;line-height:18px}.FVET-W_rows{flex-direction:column;gap:8px;margin:12px 0 0;padding:0;list-style:none;display:flex}.FVET-W_rowCard{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;flex-direction:column;gap:12px;padding:12px 14px;display:flex}.FVET-W_rowHead{align-items:center;gap:10px;display:flex}.FVET-W_rowName{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}.FVET-W_rowActions{align-items:center;gap:4px;margin-left:auto;display:inline-flex}.FVET-W_primaryButton,.FVET-W_secondaryButton,.FVET-W_addButton{box-sizing:border-box;height:36px;font:inherit;cursor:pointer;border:none;border-radius:18px;justify-content:center;align-items:center;gap:4px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.FVET-W_primaryButton{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}.FVET-W_primaryButton:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.FVET-W_secondaryButton,.FVET-W_addButton{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:0 0}.FVET-W_secondaryButton:hover:not(:disabled),.FVET-W_addButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.FVET-W_secondaryButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}.FVET-W_dangerButton{box-sizing:border-box;height:36px;color:var(--dsw-alias-state-error-primary);font:inherit;cursor:pointer;background:0 0;border:none;border-radius:18px;justify-content:center;align-items:center;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.FVET-W_dangerButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}.FVET-W_rowActions .FVET-W_secondaryButton,.FVET-W_rowActions .FVET-W_dangerButton{border-radius:14px;height:28px;padding:0 10px;font-size:12px;line-height:18px}.FVET-W_primaryButton:disabled,.FVET-W_secondaryButton:disabled,.FVET-W_dangerButton:disabled,.FVET-W_addButton:disabled,.FVET-W_linkButton:disabled,.FVET-W_addModelButton:disabled{opacity:.4;cursor:default}.FVET-W_primaryButton:focus-visible,.FVET-W_secondaryButton:focus-visible,.FVET-W_dangerButton:focus-visible,.FVET-W_addButton:focus-visible,.FVET-W_linkButton:focus-visible,.FVET-W_addModelButton:focus-visible,.FVET-W_iconButton:focus-visible,.FVET-W_customizedSummary:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3);outline:none}.FVET-W_editor{background:var(--dsw-alias-bg-module-platform);border-radius:12px;flex-direction:column;gap:14px;padding:14px 16px;display:flex}.FVET-W_editorHeader{align-items:baseline;gap:8px;display:flex}.FVET-W_editorTitle{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}.FVET-W_editorRoute{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.FVET-W_field{flex-direction:column;gap:6px;display:flex}.FVET-W_fieldLabel{color:var(--dsw-alias-label-secondary);align-items:center;gap:10px;font-size:12px;font-weight:500;line-height:18px;display:inline-flex}.FVET-W_linkButton{box-sizing:border-box;height:28px;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:none;border-radius:14px;align-items:center;padding:0 10px;font-size:12px;line-height:18px;display:inline-flex}.FVET-W_linkButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.FVET-W_advancedHint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}.FVET-W_editorActions{justify-content:flex-end;gap:8px;display:flex}.FVET-W_addBlock{flex-direction:column;gap:12px;display:flex}.FVET-W_addActions{flex-wrap:wrap;gap:10px;display:flex}.FVET-W_addButton{border:1px dashed var(--dsw-alias-border-l3);border-radius:12px;flex:1 1 0;gap:6px;min-width:180px;height:44px}.FVET-W_addCard,.FVET-W_setupCard{background:var(--dsw-alias-bg-module-platform);border-radius:12px;flex-direction:column;gap:14px;padding:14px 16px;list-style:none;display:flex}.FVET-W_addCard .FVET-W_editor,.FVET-W_setupCard .FVET-W_editor{background:0 0;padding:0}.FVET-W_customized{border-top:1px solid var(--dsw-alias-border-l2);padding-top:10px}.FVET-W_customizedSummary{cursor:pointer;width:fit-content;color:var(--dsw-alias-label-secondary);border-radius:6px;align-items:center;gap:6px;margin-left:-4px;padding:2px 4px;font-size:12px;font-weight:500;line-height:18px;list-style:none;display:flex}.FVET-W_customizedSummary::-webkit-details-marker{display:none}.FVET-W_customizedSummary:before{content:\"\";border-bottom:1.5px solid;border-right:1.5px solid;width:5px;height:5px;transition:transform .12s;transform:rotate(-45deg)translate(-1px,-1px)}.FVET-W_customized[open]>.FVET-W_customizedSummary:before{transform:rotate(45deg)translate(-1px,-1px)}.FVET-W_customizedSummary:hover{color:var(--dsw-alias-label-primary)}.FVET-W_customizedBody{flex-direction:column;gap:12px;padding-top:12px;display:flex}.FVET-W_modelCatalog{border-top:1px solid var(--dsw-alias-border-l2);flex-direction:column;gap:10px;padding-top:12px;display:flex}.FVET-W_modelCatalogHeading{flex-direction:column;gap:2px;display:flex}.FVET-W_modelCatalogTitle{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:18px}.FVET-W_modelCatalogMeta,.FVET-W_modelEmpty{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}.FVET-W_modelList{flex-direction:column;gap:8px;display:flex}.FVET-W_modelListHead{justify-content:space-between;align-items:flex-start;gap:12px;display:flex}.FVET-W_modelEntry{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px}.FVET-W_modelRow{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) auto auto;align-items:center;gap:6px;display:grid}.FVET-W_iconButton{box-sizing:border-box;width:28px;height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;display:inline-flex}.FVET-W_iconButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.FVET-W_iconButton:disabled{cursor:default;opacity:.4}.FVET-W_iconButtonDanger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}.FVET-W_modelAdvanced{grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;padding:8px 4px 2px;display:grid}.FVET-W_modelField{flex-direction:column;gap:4px;display:flex}.FVET-W_modelFieldLabel{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.FVET-W_modelEmpty{border:1px dashed var(--dsw-alias-border-l3);text-align:center;border-radius:8px;padding:12px}.FVET-W_addModelButton{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);height:28px;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;border-radius:14px;align-self:flex-start;align-items:center;gap:4px;padding:0 10px;font-size:12px;line-height:18px;display:inline-flex}.FVET-W_addModelButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.FVET-W_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);width:100%;height:32px;font:inherit;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 10px;font-size:14px;line-height:22px}select.FVET-W_input{cursor:pointer;max-width:240px}.FVET-W_input:focus{border-color:var(--dsw-alias-brand-primary);outline:none}.FVET-W_input::placeholder{color:var(--dsw-alias-label-dimmed)}.FVET-W_input:disabled{opacity:.6;cursor:default}.FVET-W_selectInput{appearance:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\");background-position:right 12px center;background-repeat:no-repeat;background-size:12px 12px;padding-right:32px}.FVET-W_error{color:var(--dsw-alias-state-error-primary);margin:0;font-size:12px;line-height:18px}.FVET-W_deleteDialog{width:min(480px,100%)}.FVET-W_deleteConfirm:not(:disabled){border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}.FVET-W_deleteConfirm:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}.FVET-W_hiddenLabel{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}@media (prefers-reduced-motion:reduce){.FVET-W_customizedSummary:before{transition:none}}.FVET-W_fetchDialog{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);max-width:520px}.FVET-W_candidateList{flex-direction:column;gap:2px;max-height:320px;margin:0;padding:0;list-style:none;display:flex;overflow-y:auto}.FVET-W_candidate{border-radius:6px}.FVET-W_candidateLabel{cursor:pointer;align-items:center;gap:8px;padding:6px 8px;display:flex}.FVET-W_candidateId{font-family:var(--ds-font-family-code);overflow-wrap:anywhere;flex:auto;font-size:13px}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-models/ModelsSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-models";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var ModelsSection_module_css_default = {
			"title": "FVET-W_title",
			"addButton": "FVET-W_addButton",
			"addBlock": "FVET-W_addBlock",
			"fieldLabel": "FVET-W_fieldLabel",
			"rows": "FVET-W_rows",
			"rowActions": "FVET-W_rowActions",
			"modelFieldLabel": "FVET-W_modelFieldLabel",
			"error": "FVET-W_error",
			"section": "FVET-W_section",
			"addActions": "FVET-W_addActions",
			"modelEmpty": "FVET-W_modelEmpty",
			"editor": "FVET-W_editor",
			"selectInput": "FVET-W_selectInput",
			"addCard": "FVET-W_addCard",
			"modelCatalogMeta": "FVET-W_modelCatalogMeta",
			"secondaryButton": "FVET-W_secondaryButton",
			"iconButton": "FVET-W_iconButton",
			"advancedHint": "FVET-W_advancedHint",
			"addModelButton": "FVET-W_addModelButton",
			"rowName": "FVET-W_rowName",
			"setupCard": "FVET-W_setupCard",
			"fetchDialog": "FVET-W_fetchDialog",
			"candidateList": "FVET-W_candidateList",
			"candidate": "FVET-W_candidate",
			"customized": "FVET-W_customized",
			"rowCard": "FVET-W_rowCard",
			"rowHead": "FVET-W_rowHead",
			"editorRoute": "FVET-W_editorRoute",
			"deleteConfirm": "FVET-W_deleteConfirm",
			"customizedSummary": "FVET-W_customizedSummary",
			"editorActions": "FVET-W_editorActions",
			"notice": "FVET-W_notice",
			"modelCatalogTitle": "FVET-W_modelCatalogTitle",
			"primaryButton": "FVET-W_primaryButton",
			"modelList": "FVET-W_modelList",
			"modelCatalogHeading": "FVET-W_modelCatalogHeading",
			"modelListHead": "FVET-W_modelListHead",
			"customizedBody": "FVET-W_customizedBody",
			"modelCatalog": "FVET-W_modelCatalog",
			"modelEntry": "FVET-W_modelEntry",
			"modelField": "FVET-W_modelField",
			"linkButton": "FVET-W_linkButton",
			"editorHeader": "FVET-W_editorHeader",
			"modelAdvanced": "FVET-W_modelAdvanced",
			"field": "FVET-W_field",
			"intro": "FVET-W_intro",
			"editorTitle": "FVET-W_editorTitle",
			"modelRow": "FVET-W_modelRow",
			"candidateLabel": "FVET-W_candidateLabel",
			"iconButtonDanger": "FVET-W_iconButtonDanger",
			"hiddenLabel": "FVET-W_hiddenLabel",
			"candidateId": "FVET-W_candidateId",
			"dangerButton": "FVET-W_dangerButton",
			"deleteDialog": "FVET-W_deleteDialog",
			"input": "FVET-W_input"
		};
		//#endregion
		//#region src/client/EditorFooter.tsx
		/**
		* Render one provider card's action row.
		* @param props - the labels, commit gating, and handlers the owning card supplies.
		* @returns the cancel/commit row.
		*/
		function EditorFooter(props) {
			const { t } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ModelsSection_module_css_default["editorActions"],
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: ModelsSection_module_css_default["secondaryButton"],
					disabled: props.busy,
					onClick: props.onCancel,
					children: t("cancel")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: ModelsSection_module_css_default["primaryButton"],
					disabled: props.submitDisabled,
					onClick: props.onSubmit,
					children: props.busy ? t(props.submitBusyLabel) : t(props.submitLabel)
				})]
			});
		}
		//#endregion
		//#region src/client/DeepSeekModelsEditor.tsx
		/**
		* Curated editor for the direct DeepSeek adapter's advisory model catalog.
		* The settings layer replaces `models` as one array, so the parent supplies
		* the effective inherited rows until the first edit materializes a user
		* override; reset removes that override instead of copying defaults into it.
		*/
		/** Row index encoded in an editing-buffer key. */
		function rowOf(key) {
			return Number(key.slice(0, key.indexOf(":")));
		}
		/** Accepted capacity spellings: a decimal count with an optional K/M suffix. */
		const CAPACITY_PATTERN = /^(\d+(?:\.\d+)?)([km])?$/i;
		/** Decimal suffix scales — `1M` is 1000K, matching how model capacities are quoted. */
		const CAPACITY_SCALE = {
			k: 1e3,
			m: 1e6
		};
		/**
		* Read a typed capacity, so a user can write `256K` or `1M` instead of counting
		* zeroes. The stored value stays a plain token count.
		* @param text - raw field text.
		* @returns the count; `undefined` when blank (inherit), `NaN` when unreadable
		* (rejected by {@link validateDeepSeekModels} before any write).
		*/
		function parseCapacity(text) {
			const trimmed = text.trim();
			if (trimmed.length === 0) return void 0;
			const match = CAPACITY_PATTERN.exec(trimmed);
			if (match === null) return NaN;
			const suffix = match[2]?.toLowerCase();
			const scale = suffix === "k" || suffix === "m" ? CAPACITY_SCALE[suffix] : 1;
			const scaled = Number(match[1]) * scale;
			const rounded = Math.round(scaled);
			return Math.abs(scaled - rounded) < 1e-6 ? rounded : scaled;
		}
		/**
		* Spell a stored count back in the shortest form that survives a round trip
		* through {@link parseCapacity}; a count that is not a whole number of
		* thousands stays written out.
		* @param value - stored capacity.
		* @returns the field text.
		*/
		function formatCapacity(value) {
			if (!Number.isInteger(value) || value <= 0) return String(value);
			if (value % CAPACITY_SCALE.m === 0) return `${String(value / CAPACITY_SCALE.m)}M`;
			if (value % CAPACITY_SCALE.k === 0) return `${String(value / CAPACITY_SCALE.k)}K`;
			return String(value);
		}
		/** Convert a schema-validated catalog value into records without dropping hidden fields. */
		function modelDrafts(value) {
			if (!Array.isArray(value)) return [];
			return value.map((entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry) ? entry : {});
		}
		/**
		* Validate adapter constraints that the serialized schema cannot express.
		* @param value - user-owned `models` value, or undefined while inherited.
		* @returns the first invalid row, or undefined when the adapter will accept it.
		*/
		function validateDeepSeekModels(value) {
			if (value === void 0) return void 0;
			const models = modelDrafts(value);
			const seen = /* @__PURE__ */ new Set();
			for (const [index, model] of models.entries()) {
				const id = model["id"];
				const trimmed = typeof id === "string" ? id.trim() : void 0;
				if (trimmed === void 0 || trimmed.length === 0) return {
					index,
					key: "modelIdRequired"
				};
				if (seen.has(trimmed)) return {
					index,
					key: "modelIdDuplicate"
				};
				seen.add(trimmed);
				const name = model["name"];
				if (name !== void 0 && (typeof name !== "string" || name.length === 0)) return {
					index,
					key: "modelNameInvalid"
				};
				const contextWindow = model["contextWindow"];
				if (contextWindow !== void 0 && (typeof contextWindow !== "number" || !Number.isInteger(contextWindow) || contextWindow <= 0)) return {
					index,
					key: "modelContextInvalid"
				};
				const maxTokens = model["maxTokens"];
				if (maxTokens !== void 0 && (typeof maxTokens !== "number" || !Number.isInteger(maxTokens) || maxTokens <= 0)) return {
					index,
					key: "modelMaxTokensInvalid"
				};
			}
		}
		/**
		* Render the direct DeepSeek adapter's model catalog: id and display name on
		* each row, capacities behind the row's own disclosure.
		* @param props - effective rows plus the array-level override actions.
		* @returns the catalog editor.
		*/
		function DeepSeekModelsEditor(props) {
			const [editing, setEditing] = (0, react.useState)(() => /* @__PURE__ */ new Map());
			const [expanded, setExpanded] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const update = (index, key, value) => {
				const next = props.models.map((model, at) => {
					const copy = { ...model };
					if (at !== index) return copy;
					if (value === void 0) Reflect.deleteProperty(copy, key);
					else copy[key] = value;
					return copy;
				});
				props.onChange(next);
			};
			const remove = (index) => {
				setEditing((current) => {
					const next = /* @__PURE__ */ new Map();
					for (const [key, text] of current) {
						const at = rowOf(key);
						if (at === index) continue;
						next.set(at > index ? key.replace(/^\d+/, String(at - 1)) : key, text);
					}
					return next;
				});
				setExpanded((current) => {
					const next = /* @__PURE__ */ new Set();
					for (const at of current) {
						if (at === index) continue;
						next.add(at > index ? at - 1 : at);
					}
					return next;
				});
				props.onChange(props.models.filter((_model, at) => at !== index).map((model) => ({ ...model })));
			};
			const reset = () => {
				setEditing(/* @__PURE__ */ new Map());
				setExpanded(/* @__PURE__ */ new Set());
				props.onReset();
			};
			const toggle = (index) => {
				setExpanded((current) => {
					const next = new Set(current);
					if (!next.delete(index)) next.add(index);
					return next;
				});
			};
			/** The field's text: its live keystrokes, else the stored count spelled short. */
			const capacityText = (model, index, field) => {
				const typed = editing.get(`${String(index)}:${field}`);
				if (typed !== void 0) return typed;
				const value = model[field];
				return typeof value === "number" ? formatCapacity(value) : "";
			};
			const settleCapacity = (index, field) => {
				const key = `${String(index)}:${field}`;
				const typed = editing.get(key);
				if (typed === void 0) return;
				const parsed = parseCapacity(typed);
				if (parsed !== void 0 && Number.isNaN(parsed)) return;
				setEditing((current) => {
					const next = new Map(current);
					next.delete(key);
					return next;
				});
			};
			/** One capacity field of one row, rendered inside the row's disclosure. */
			const capacityField = (model, index, field, fallback) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: ModelsSection_module_css_default["modelField"],
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: ModelsSection_module_css_default["modelFieldLabel"],
					children: props.t(field === "contextWindow" ? "contextWindow" : "maxTokens")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					className: ModelsSection_module_css_default["input"],
					type: "text",
					inputMode: "numeric",
					value: capacityText(model, index, field),
					placeholder: fallback === void 0 ? props.t(field === "contextWindow" ? "contextWindowPlaceholder" : "maxTokensPlaceholder") : formatCapacity(fallback),
					"aria-label": `${props.t(field === "contextWindow" ? "contextWindow" : "maxTokens")} ${String(index + 1)}`,
					disabled: props.disabled,
					onChange: (event) => {
						const text = event.target.value;
						setEditing((current) => new Map(current).set(`${String(index)}:${field}`, text));
						update(index, field, parseCapacity(text));
					},
					onBlur: () => {
						settleCapacity(index, field);
					}
				})]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: ModelsSection_module_css_default["modelCatalog"],
				"aria-label": props.t("models"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ModelsSection_module_css_default["modelListHead"],
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ModelsSection_module_css_default["modelCatalogHeading"],
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ModelsSection_module_css_default["modelCatalogTitle"],
								children: props.t("models")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ModelsSection_module_css_default["modelCatalogMeta"],
								children: props.overridden ? props.t("modelsCustomized") : props.t("modelsInherited")
							})]
						}), props.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: ModelsSection_module_css_default["linkButton"],
							disabled: props.disabled,
							onClick: reset,
							children: props.t("resetModels")
						}) : null]
					}),
					props.models.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["modelEmpty"],
						children: props.t("modelsEmpty")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ModelsSection_module_css_default["modelList"],
						children: props.models.map((model, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ModelsSection_module_css_default["modelEntry"],
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ModelsSection_module_css_default["modelRow"],
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: ModelsSection_module_css_default["input"],
										type: "text",
										value: typeof model["id"] === "string" ? model["id"] : "",
										placeholder: props.t("modelId"),
										"aria-label": `${props.t("modelId")} ${String(index + 1)}`,
										disabled: props.disabled,
										onChange: (event) => {
											update(index, "id", event.target.value);
										},
										onBlur: (event) => {
											const trimmed = event.target.value.trim();
											if (trimmed !== event.target.value) update(index, "id", trimmed);
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: ModelsSection_module_css_default["input"],
										type: "text",
										value: typeof model["name"] === "string" ? model["name"] : "",
										placeholder: props.t("modelName"),
										"aria-label": `${props.t("modelName")} ${String(index + 1)}`,
										disabled: props.disabled,
										onChange: (event) => {
											update(index, "name", event.target.value === "" ? void 0 : event.target.value);
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: ModelsSection_module_css_default["iconButton"],
										"aria-label": `${props.t("modelAdvanced")} ${String(index + 1)}`,
										"aria-expanded": expanded.has(index),
										title: props.t("modelAdvanced"),
										onClick: () => {
											toggle(index);
										},
										children: expanded.has(index) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, {})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: `${ModelsSection_module_css_default["iconButton"]} ${ModelsSection_module_css_default["iconButtonDanger"]}`,
										"aria-label": `${props.t("removeModel")} ${String(index + 1)}`,
										title: props.t("removeModel"),
										disabled: props.disabled,
										onClick: () => {
											remove(index);
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutline16, { size: 14 })
									})
								]
							}), expanded.has(index) ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ModelsSection_module_css_default["modelAdvanced"],
								children: [capacityField(model, index, "contextWindow", props.defaultContextWindow), capacityField(model, index, "maxTokens", props.defaultMaxTokens)]
							}) : null]
						}, index))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: ModelsSection_module_css_default["addModelButton"],
						disabled: props.disabled,
						onClick: () => {
							props.onChange([...props.models.map((model) => ({ ...model })), { id: "" }]);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 14 }), props.t("addModel")]
					})
				]
			});
		}
		//#endregion
		//#region src/client/store.ts
		/**
		* Any route key walks a dict schema to the same profile node, so the lookup
		* names one that cannot collide with a configured route.
		*/
		const PROBE_ROUTE = "\0probe";
		/**
		* Human text for a rejected wire call. A transport failure rejects with an
		* Error; a host or a runtime can reject with anything, and the page still has
		* to say something.
		* @param error - the rejection value.
		* @returns the message to show.
		*/
		function messageOf(error) {
			return error instanceof Error ? error.message : String(error);
		}
		/**
		* Derive the conventional credential reference for a provider route: the v1
		* page never asks for an environment-variable name, so a typed key stores
		* under this derived reference and the profile records it as `apiKeyEnv`.
		* @param provider - provider route id (e.g. `anthropic`, `minimax-cn`).
		* @returns the derived reference name (e.g. `MINIMAX_CN_API_KEY`).
		*/
		function deriveKeyRef(provider) {
			return `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY`;
		}
		/**
		* The wire protocols a hand-declared route may name, read out of the owning
		* namespace's own schema. This stays a schema read rather than a wire field so
		* the choices the page offers cannot drift from the ones the adapter accepts:
		* both come from the same `Config`.
		* @param namespace - the namespace view whose schema declares the profile shape.
		* @returns the protocol identifiers, or an empty list when the schema has none.
		*/
		function protocolChoices(namespace) {
			if (namespace === void 0) return [];
			const list = (0, _deepseek_ai_dsh_client_schema_form.nodeAtPath)((0, _deepseek_ai_dsh_client_schema_form.rehydrateSchema)(namespace.schema), [
				"providers",
				PROBE_ROUTE,
				"api"
			]);
			if (list?.type !== "union" || list.list === void 0) return [];
			return list.list.map((entry) => entry.value).filter((value) => typeof value === "string");
		}
		/** The credential reference a resolved profile names (its `apiKeyEnv` field). */
		function apiKeyEnvOf(namespace, path) {
			if (namespace === void 0) return void 0;
			const profile = (0, _deepseek_ai_dsh_client_schema_form.getPath)(namespace.value, path);
			if (typeof profile !== "object" || profile === null) return void 0;
			const ref = profile.apiKeyEnv;
			return typeof ref === "string" && ref.length > 0 ? ref : void 0;
		}
		/** Whether one namespace's redacted sidecar reports a set literal API key. */
		function literalApiKeyConfigured(namespace, path) {
			if (namespace === void 0) return false;
			const secretPath = [...path, "apiKey"];
			return namespace.secrets.some((secret) => secret.set && secret.path.length === secretPath.length && secret.path.every((key, index) => key === secretPath[index]));
		}
		/** The models settings page controller (one per settings surface). */
		var ModelsSettingsStore = class {
			api;
			/** The snapshot the section renders from (uSES-safe store). */
			store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)({
				status: "idle",
				error: null,
				credentialError: null,
				writable: false,
				rows: [],
				namespaces: /* @__PURE__ */ new Map()
			});
			/** Latest load wins; an older response never overwrites a newer one. */
			generation = 0;
			/**
			* @param api - the wire face (settings/credentials/llm domains).
			*/
			constructor(api) {
				this.api = api;
			}
			/**
			* Surface a failure from an operation the page ran outside {@link load} —
			* a row removal — on the same banner a load failure uses.
			* @param message - the failure text to show.
			*/
			fail(message) {
				this.store.update((s) => {
					s.status = "error";
					s.error = message;
				});
			}
			/**
			* Refresh the whole page snapshot: directory and namespaces in parallel,
			* then one batched credential describe over every referenced ref. A
			* failure keeps the last good rows and surfaces the error.
			* @returns nothing; the snapshot carries the outcome.
			*/
			async load() {
				const generation = ++this.generation;
				this.store.update((s) => {
					s.status = "loading";
					s.error = null;
				});
				let providers;
				let writable;
				let views;
				try {
					const [providersResponse, settingsResponse] = await Promise.all([this.api.llm.providers({}), this.api.settings.describe({})]);
					if (!providersResponse.result.ok) throw new Error(providersResponse.result.error.message);
					if (!settingsResponse.result.ok) throw new Error(settingsResponse.result.error.message);
					providers = providersResponse.result.value.providers;
					writable = settingsResponse.result.value.writable;
					views = settingsResponse.result.value.namespaces;
				} catch (error) {
					if (generation !== this.generation) return;
					this.store.update((s) => {
						s.status = "error";
						s.error = error instanceof Error ? error.message : String(error);
					});
					return;
				}
				const namespaces = new Map(views.map((view) => [view.ns, view]));
				const rows = providers.map((entry) => {
					const namespace = namespaces.get(entry.settingsNs);
					return {
						entry,
						configured: namespace !== void 0 && (entry.settingsPath.length === 0 || (0, _deepseek_ai_dsh_client_schema_form.getPath)(namespace.value, entry.settingsPath) !== void 0),
						removable: namespace !== void 0 && entry.settingsPath.length > 0 && (0, _deepseek_ai_dsh_client_schema_form.hasPath)(namespace.user, entry.settingsPath) && !(0, _deepseek_ai_dsh_client_schema_form.hasPath)(namespace.base, entry.settingsPath),
						apiKeyEnv: apiKeyEnvOf(namespace, entry.settingsPath),
						credential: void 0,
						literalApiKeyConfigured: literalApiKeyConfigured(namespace, entry.settingsPath)
					};
				});
				const refs = [...new Set(rows.flatMap((row) => row.apiKeyEnv === void 0 ? [] : [row.apiKeyEnv]))];
				let credentials = {};
				let credentialError = null;
				if (refs.length > 0) try {
					const response = await this.api.credentials.describe({ refs });
					if (response.result.ok) credentials = response.result.value.credentials;
					else credentialError = response.result.error.message;
				} catch (error) {
					credentialError = messageOf(error);
				}
				if (generation !== this.generation) return;
				this.store.update((s) => {
					s.status = "ready";
					s.error = null;
					s.credentialError = credentialError;
					s.writable = writable;
					s.rows = rows.map((row) => ({
						...row,
						...row.apiKeyEnv !== void 0 && credentials[row.apiKeyEnv] !== void 0 ? { credential: credentials[row.apiKeyEnv] } : {}
					}));
					s.namespaces = namespaces;
				});
			}
		};
		/**
		* Project official-DeepSeek readiness from the provider/settings/credential
		* join used by the Models page. A missing official configurable-provider
		* declaration means the adapter is not repairable by navigating to Models.
		* @param state - current shared Models join snapshot.
		* @returns the onboarding state without reading a parallel fact source.
		*/
		function deepSeekReadiness(state) {
			if ((state.status === "idle" || state.status === "loading") && state.rows.length === 0) return { kind: "loading" };
			if (state.status === "error") return {
				kind: "unavailable",
				reason: "load-failed"
			};
			const row = state.rows.find((candidate) => candidate.entry.provider === "deepseek-official" && candidate.entry.settingsNs === "llm-deepseek" && candidate.entry.settingsPath.length === 0);
			if (row === void 0) return { kind: "adapter-absent" };
			if (!row.entry.active) return {
				kind: "unavailable",
				reason: "provider-inactive"
			};
			if (!row.configured) return {
				kind: "unavailable",
				reason: "settings-unavailable"
			};
			if (row.literalApiKeyConfigured) return { kind: "configured" };
			if (row.apiKeyEnv === void 0) return {
				kind: "unavailable",
				reason: "credential-ref-unavailable"
			};
			if (state.credentialError !== null) return {
				kind: "unavailable",
				reason: "credentials-unavailable"
			};
			if (row.credential === void 0) return {
				kind: "unavailable",
				reason: "credentials-unavailable"
			};
			if (row.credential.configured) return { kind: "configured" };
			if (!state.writable) return {
				kind: "unavailable",
				reason: "settings-read-only"
			};
			if (!row.credential.writable) return {
				kind: "unavailable",
				reason: "credential-read-only"
			};
			return { kind: "credential-missing" };
		}
		//#endregion
		//#region src/client/ModelListEditor.tsx
		/**
		* The model list of one pi-ai provider profile, plus the action that asks the
		* provider what it serves.
		*
		* The list is the profile's `models` array as the card holds it: an empty list
		* means "serve this route's built-in catalog", and any entry replaces that
		* catalog, so a row is only ever added deliberately. Fetching asks the endpoint
		* **the form currently shows** — including a key typed but not yet saved — so
		* adding a provider is one pass instead of save-then-return; the reply is
		* candidates the user picks from, never configuration written behind them.
		*
		* A provider that cannot be interrogated (an unreachable endpoint, a protocol
		* with no readable listing) is not a dead end: the failure is shown next to the
		* rows the user can still fill in by hand.
		*/
		/** A row's text field, or the empty string when unset or not a string. */
		function textOf(model, key) {
			const value = model[key];
			return typeof value === "string" ? value : "";
		}
		/** A row's numeric field, or `undefined` when unset or not a number. */
		function numberOf(model, key) {
			const value = model[key];
			return typeof value === "number" ? value : void 0;
		}
		/** Disclosure chevron; rotates to point down while its row is open. */
		function IconChevron({ open }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				style: {
					transform: open ? "rotate(90deg)" : void 0,
					transition: "transform 120ms ease"
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M6 3.5L10.5 8L6 12.5",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		/** Removal glyph for one model row. */
		function IconTrash() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9a1 1 0 001 .9h4.6a1 1 0 001-.9L12 4M6.5 6.8v4.4M9.5 6.8v4.4",
					stroke: "currentColor",
					strokeWidth: "1.3",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		/**
		* What an empty capacity field is worth, shown as its placeholder so a row left
		* blank does not read as a model with no capacity at all.
		*
		* The magnitudes are the adapter's own route-level fallbacks (`llm-pi-ai`'s
		* `defaultContextWindow` and `defaultMaxTokens`), spelled the way a person
		* would say them. They are a hint, not a mirror: this page counts `K` as 1000,
		* so typing `256K` stores 256000 while leaving the field blank keeps the
		* adapter's 262144. A deployment that overrides those defaults is not
		* reflected here — nothing on this page can read them.
		*/
		const CAPACITY_HINT = {
			contextWindow: "256K",
			maxTokens: "32K"
		};
		/**
		* Spell a stored count for a field that may be unset. The spelling itself is
		* {@link formatCapacity}, shared with the DeepSeek catalog editor so both
		* surfaces read and write one K/M vocabulary.
		* @param value - stored capacity, or `undefined` for an unset field.
		* @returns the field text, empty when unset.
		*/
		function capacitySpelling(value) {
			return value === void 0 ? "" : formatCapacity(value);
		}
		/** Adopt a candidate, keeping whatever capacities the provider disclosed. */
		function adopt(candidate) {
			return {
				id: candidate.id,
				...candidate.name === void 0 ? {} : { name: candidate.name },
				...candidate.contextWindow === void 0 ? {} : { contextWindow: candidate.contextWindow },
				...candidate.maxTokens === void 0 ? {} : { maxTokens: candidate.maxTokens }
			};
		}
		/**
		* Render the model list with its fetch action.
		* @param props - the drafted rows, probe target, wire face, and copy.
		* @returns the model-list editor.
		*/
		function ModelListEditor(props) {
			const { models, onChange, probe, api, t, disabled } = props;
			const [busy, setBusy] = (0, react.useState)(false);
			const [failure, setFailure] = (0, react.useState)(void 0);
			const [candidates, setCandidates] = (0, react.useState)(void 0);
			const [picked, setPicked] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [expanded, setExpanded] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [editing, setEditing] = (0, react.useState)(/* @__PURE__ */ new Map());
			/** Buffer key for one capacity field; the row half moves when rows do. */
			const bufferKey = (index, field) => `${String(index)}:${field}`;
			const editCapacity = (index, field, text) => {
				setEditing((current) => new Map(current).set(bufferKey(index, field), text));
				patch(index, { [field]: parseCapacity(text) });
			};
			/** What a capacity field shows: the buffer while typing, else the stored count. */
			const capacityText = (model, index, field) => editing.get(bufferKey(index, field)) ?? capacitySpelling(numberOf(model, field));
			/** Drop one row's entries and shift the rows after it down, in one pass. */
			const reindexOnRemove = (current, index) => {
				const next = /* @__PURE__ */ new Map();
				for (const [key, value] of current) {
					const at = Number(key.slice(0, key.indexOf(":")));
					if (at === index) continue;
					next.set(at > index ? key.replace(/^\d+/, String(at - 1)) : key, value);
				}
				return next;
			};
			const toggleExpanded = (index) => {
				setExpanded((current) => {
					const next = new Set(current);
					if (!next.delete(index)) next.add(index);
					return next;
				});
			};
			const patch = (index, next) => {
				onChange(models.map((model, at) => {
					if (at !== index) return model;
					const cleared = new Set(Object.entries(next).filter(([, value]) => value === void 0 || value === "").map(([key]) => key));
					return Object.fromEntries(Object.entries({
						...model,
						...next
					}).filter(([key]) => !cleared.has(key)));
				}));
			};
			const fetchModels = async () => {
				setBusy(true);
				setFailure(void 0);
				try {
					const response = await api.llm.discoverModels({
						settingsNs: probe.settingsNs,
						...probe.provider === void 0 ? {} : { provider: probe.provider },
						...probe.baseURL === void 0 || probe.baseURL.length === 0 ? {} : { baseURL: probe.baseURL },
						...probe.api === void 0 ? {} : { api: probe.api },
						...probe.apiKey === void 0 ? {} : { apiKey: probe.apiKey }
					});
					if (!response.result.ok) {
						setFailure(response.result.error.message);
						return;
					}
					const found = response.result.value.models;
					if (found.length === 0) {
						setFailure(t("fetchEmpty"));
						return;
					}
					const known = new Set(models.map((model) => textOf(model, "id")));
					setCandidates(found);
					setPicked(new Set(found.filter((model) => !known.has(model.id)).map((model) => model.id)));
				} catch (error) {
					setFailure(messageOf(error));
				} finally {
					setBusy(false);
				}
			};
			const closePicker = () => {
				setCandidates(void 0);
				setPicked(/* @__PURE__ */ new Set());
			};
			const adoptPicked = () => {
				/* v8 ignore next -- the dialog only renders with candidates loaded */
				if (candidates === void 0) return;
				const byId = new Map(models.map((model) => [textOf(model, "id"), model]));
				for (const candidate of candidates) {
					if (!picked.has(candidate.id)) continue;
					byId.set(candidate.id, byId.get(candidate.id) ?? adopt(candidate));
				}
				onChange([...byId.values()]);
				closePicker();
			};
			const toggle = (id) => {
				setPicked((current) => {
					const next = new Set(current);
					if (!next.delete(id)) next.add(id);
					return next;
				});
			};
			const askable = probe.provider !== void 0 || probe.baseURL !== void 0 && probe.baseURL.length > 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: ModelsSection_module_css_default["modelCatalog"],
				"aria-label": t("models"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ModelsSection_module_css_default["modelListHead"],
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ModelsSection_module_css_default["modelCatalogHeading"],
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ModelsSection_module_css_default["modelCatalogTitle"],
									children: t("models")
								}), props.overridden === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ModelsSection_module_css_default["modelCatalogMeta"],
									children: props.overridden ? t("modelsCustomized") : t("modelsInherited")
								})]
							}),
							props.overridden === true && props.onReset !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ModelsSection_module_css_default["linkButton"],
								disabled,
								onClick: props.onReset,
								children: t("resetModels")
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ModelsSection_module_css_default["linkButton"],
								disabled: disabled || busy || !askable,
								title: askable ? void 0 : t("fetchNeedsBaseUrl"),
								onClick: () => {
									fetchModels();
								},
								children: busy ? t("fetching") : t("fetchModels")
							})
						]
					}),
					models.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["modelEmpty"],
						children: t("modelsEmpty")
					}) : null,
					models.map((model, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ModelsSection_module_css_default["modelEntry"],
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ModelsSection_module_css_default["modelRow"],
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: ModelsSection_module_css_default["input"],
									type: "text",
									value: textOf(model, "id"),
									placeholder: t("modelId"),
									"aria-label": `${t("modelId")} ${index + 1}`,
									disabled,
									onChange: (event) => {
										patch(index, { id: event.target.value });
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: ModelsSection_module_css_default["input"],
									type: "text",
									value: textOf(model, "name"),
									placeholder: t("modelName"),
									"aria-label": `${t("modelName")} ${index + 1}`,
									disabled,
									onChange: (event) => {
										patch(index, { name: event.target.value === "" ? void 0 : event.target.value });
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: ModelsSection_module_css_default["iconButton"],
									"aria-label": `${t("modelAdvanced")} ${index + 1}`,
									"aria-expanded": expanded.has(index),
									title: t("modelAdvanced"),
									onClick: () => {
										toggleExpanded(index);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, { open: expanded.has(index) })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: `${ModelsSection_module_css_default["iconButton"]} ${ModelsSection_module_css_default["iconButtonDanger"]}`,
									"aria-label": `${t("removeModel")} ${index + 1}`,
									title: t("removeModel"),
									disabled,
									onClick: () => {
										onChange(models.filter((_model, at) => at !== index));
										setExpanded((current) => {
											const next = /* @__PURE__ */ new Set();
											for (const at of current) if (at < index) next.add(at);
											else if (at > index) next.add(at - 1);
											return next;
										});
										setEditing((current) => reindexOnRemove(current, index));
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconTrash, {})
								})
							]
						}), expanded.has(index) ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ModelsSection_module_css_default["modelAdvanced"],
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: ModelsSection_module_css_default["modelField"],
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ModelsSection_module_css_default["modelFieldLabel"],
									children: t("modelContextWindow")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: ModelsSection_module_css_default["input"],
									type: "text",
									inputMode: "numeric",
									value: capacityText(model, index, "contextWindow"),
									placeholder: CAPACITY_HINT.contextWindow,
									"aria-label": `${t("modelContextWindow")} ${index + 1}`,
									disabled,
									onChange: (event) => {
										editCapacity(index, "contextWindow", event.target.value);
									}
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: ModelsSection_module_css_default["modelField"],
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ModelsSection_module_css_default["modelFieldLabel"],
									children: t("modelMaxTokens")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: ModelsSection_module_css_default["input"],
									type: "text",
									inputMode: "numeric",
									value: capacityText(model, index, "maxTokens"),
									placeholder: CAPACITY_HINT.maxTokens,
									"aria-label": `${t("modelMaxTokens")} ${index + 1}`,
									disabled,
									onChange: (event) => {
										editCapacity(index, "maxTokens", event.target.value);
									}
								})]
							})]
						}) : null]
					}, index)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: ModelsSection_module_css_default["addModelButton"],
						disabled,
						onClick: () => {
							onChange([...models, { id: "" }]);
						},
						children: t("addModel")
					}),
					failure !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["error"],
						children: failure
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: candidates !== void 0,
						onClose: closePicker,
						title: t("fetchTitle"),
						closeLabel: t("close"),
						description: t("fetchDescription"),
						className: ModelsSection_module_css_default["fetchDialog"],
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: closePicker,
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: adoptPicked,
							children: t("fetchAdopt")
						})] }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: ModelsSection_module_css_default["candidateList"],
							children: (candidates ?? []).map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
								className: ModelsSection_module_css_default["candidate"],
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: ModelsSection_module_css_default["candidateLabel"],
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: picked.has(candidate.id),
										onChange: () => {
											toggle(candidate.id);
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ModelsSection_module_css_default["candidateId"],
										children: candidate.id
									})]
								})
							}, candidate.id))
						})
					})
				]
			});
		}
		//#endregion
		//#region src/client/CustomProviderCard.tsx
		/**
		* The card that declares a provider pi-ai does not ship — an OpenAI-compatible
		* gateway, a self-hosted server, or a provider newer than the installed
		* catalog.
		*
		* This is a create, not an edit, which is why it is its own card rather than
		* the provider editor with extra fields: the route id is being *chosen* here,
		* and the settings address does not exist until it is. One `settings.mutate`
		* sets the whole profile at `providers.<route>`; the key travels separately
		* through `credentials.set` under the reference the profile records, exactly as
		* an existing provider's key does.
		*
		* The three fields a hand-declared route cannot default — endpoint, protocol,
		* and at least one model — are required here rather than at load, so the
		* failure names the field while the user is still looking at it.
		*/
		/** The settings namespace a hand-declared provider is written into. */
		const NS$1 = "llm-pi-ai";
		/** A route id usable as a settings key and as the stem of a credential name. */
		const ROUTE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
		/**
		* Render the custom-provider creation card.
		* @param props - existing routes, protocol choices, wire faces, and copy.
		* @returns the creation card.
		*/
		function CustomProviderCard(props) {
			const { taken, protocols, api, t } = props;
			const [openedAt] = (0, react.useState)(() => props.revision);
			const [route, setRoute] = (0, react.useState)("");
			const [displayName, setDisplayName] = (0, react.useState)("");
			const [baseURL, setBaseURL] = (0, react.useState)("");
			const [protocol, setProtocol] = (0, react.useState)(protocols[0] ?? "");
			const [keyDraft, setKeyDraft] = (0, react.useState)("");
			const [models, setModels] = (0, react.useState)([]);
			const [busy, setBusy] = (0, react.useState)(false);
			const [failure, setFailure] = (0, react.useState)(void 0);
			const disabled = props.readOnly || busy;
			const routeInvalid = route.length > 0 && !ROUTE_PATTERN.test(route);
			const routeTaken = taken.includes(route);
			const modelFailure = validateDeepSeekModels(models);
			const ready = route.length > 0 && !routeInvalid && !routeTaken && baseURL.length > 0 && models.length > 0 && modelFailure === void 0;
			const hint = failure !== void 0 || ready ? void 0 : baseURL.length === 0 ? t("customNeedsBaseUrl") : modelFailure !== void 0 ? `${t("model")} ${String(modelFailure.index + 1)}: ${t(modelFailure.key)}` : t("customNeedsModels");
			/** Perform the create, returning a failure message or undefined. */
			const createOnce = async () => {
				const keyRef = deriveKeyRef(route);
				const profile = {
					...displayName.length === 0 ? {} : { displayName },
					apiKeyEnv: keyRef,
					api: protocol,
					baseURL,
					models: models.map((model) => ({ ...model }))
				};
				const response = await api.settings.mutate({
					ns: NS$1,
					ops: [{
						op: "set",
						path: ["providers", route],
						value: profile
					}],
					expectedRevision: openedAt
				});
				if (!response.result.ok) return response.result.error.message;
				if (keyDraft.length > 0) {
					const stored = await api.credentials.set({
						ref: keyRef,
						value: keyDraft
					});
					if (!stored.result.ok) return stored.result.error.message;
				}
			};
			const create = async () => {
				setBusy(true);
				setFailure(void 0);
				try {
					const outcome = await createOnce();
					if (outcome !== void 0) {
						setFailure(outcome);
						return;
					}
					props.onClose(true);
				} catch (error) {
					setFailure(messageOf(error));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ModelsSection_module_css_default["editor"],
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ModelsSection_module_css_default["editorHeader"],
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ModelsSection_module_css_default["editorTitle"],
							children: t("customTitle")
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ModelsSection_module_css_default["field"],
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ModelsSection_module_css_default["fieldLabel"],
							children: t("customRoute")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: ModelsSection_module_css_default["input"],
							type: "text",
							value: route,
							placeholder: "acme-gateway",
							"aria-label": t("customRoute"),
							disabled,
							onChange: (event) => {
								setRoute(event.target.value);
							}
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["advancedHint"],
						children: routeInvalid ? t("customRouteInvalid") : routeTaken ? t("customRouteTaken") : t("customRouteHint")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ModelsSection_module_css_default["field"],
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ModelsSection_module_css_default["fieldLabel"],
							children: t("customDisplayName")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: ModelsSection_module_css_default["input"],
							type: "text",
							value: displayName,
							placeholder: route.length === 0 ? t("customDisplayName") : route,
							"aria-label": t("customDisplayName"),
							disabled,
							onChange: (event) => {
								setDisplayName(event.target.value);
							}
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ModelsSection_module_css_default["field"],
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ModelsSection_module_css_default["fieldLabel"],
							children: t("baseUrl")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: ModelsSection_module_css_default["input"],
							type: "text",
							value: baseURL,
							placeholder: "https://gateway.example/v1",
							"aria-label": t("baseUrl"),
							disabled,
							onChange: (event) => {
								setBaseURL(event.target.value);
							}
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ModelsSection_module_css_default["field"],
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ModelsSection_module_css_default["fieldLabel"],
							children: t("customApi")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							className: ModelsSection_module_css_default["input"],
							value: protocol,
							"aria-label": t("customApi"),
							disabled,
							onChange: (event) => {
								setProtocol(event.target.value);
							},
							children: protocols.map((choice) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: choice,
								children: choice
							}, choice))
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ModelsSection_module_css_default["field"],
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ModelsSection_module_css_default["fieldLabel"],
							children: t("keyInput")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: ModelsSection_module_css_default["input"],
							type: "password",
							autoComplete: "off",
							value: keyDraft,
							placeholder: t("keyPlaceholder"),
							"aria-label": t("keyInput"),
							disabled,
							onChange: (event) => {
								setKeyDraft(event.target.value);
							}
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelListEditor, {
						models,
						onChange: setModels,
						probe: {
							settingsNs: NS$1,
							baseURL,
							api: protocol,
							...keyDraft.length === 0 ? {} : { apiKey: keyDraft }
						},
						api,
						t,
						disabled
					}),
					failure !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["error"],
						children: failure
					}) : null,
					hint === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["advancedHint"],
						children: hint
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(EditorFooter, {
						t,
						busy,
						submitDisabled: disabled || !ready,
						submitLabel: "create",
						submitBusyLabel: "creating",
						onCancel: () => {
							props.onClose(false);
						},
						onSubmit: () => {
							create();
						}
					})
				]
			});
		}
		//#endregion
		//#region src/client/ProviderEditor.tsx
		/**
		* One provider's editor card, hand-written per adapter family: the primary
		* field is a single write-only **API key** input (the page never asks for an
		* environment-variable name — a typed key stores through `credentials.set`
		* under the profile's reference, deriving `<ROUTE>_API_KEY` when the profile
		* has none, and the pi-ai profile records that derivation as `apiKeyEnv`);
		* the collapsed 自定义设置 area carries the per-family extras (`baseURL` for
		* both families, `reasoningEffort` for deepseek / `reasoning` for pi-ai, and
		* DeepSeek's id/name/context-window model catalog). Everything else stays
		* owned by `settings.yaml`. Profile edits land as minimal `settings.mutate`
		* path ops against the stored section — the card reads the redacted
		* descriptor, so it names only the fields it can see and a stored literal
		* secret is never collaterally removed.
		*/
		/** Reasoning vocabularies per layout; the empty option means "inherit". */
		const EFFORT_CHOICES = {
			deepseek: [
				"off",
				"high",
				"max"
			],
			"pi-ai": [
				"off",
				"minimal",
				"low",
				"medium",
				"high",
				"xhigh",
				"max"
			]
		};
		/** The draft key the effort select edits, per layout. */
		const EFFORT_FIELD = {
			deepseek: "reasoningEffort",
			"pi-ai": "reasoning"
		};
		/** The public DeepSeek endpoint shown as the deepseek base-URL placeholder. */
		const DEEPSEEK_PUBLIC_BASE_URL = "https://api.deepseek.com";
		/** A user-section subtree as a plain draft object (absent → empty). */
		function draftAt(namespace, path) {
			const subtree = (0, _deepseek_ai_dsh_client_schema_form.getPath)(namespace.user, path);
			if (typeof subtree !== "object" || subtree === null || Array.isArray(subtree)) return {};
			return structuredClone(subtree);
		}
		/**
		* The minimal path ops carrying `after` over `before`, both as the card sees
		* them (that is, redacted). Only keys the card observed are named: a stored
		* `role('secret')` field appears in neither side, so it produces no op and
		* survives the write — the whole reason edits are path-addressed rather than
		* a rebuilt section.
		* @param base - path of the edited subtree inside the user section.
		* @param before - the subtree as loaded, or undefined when it is new.
		* @param after - the subtree as edited.
		* @returns ordered set/unset ops; empty when nothing changed.
		*/
		function pathOps(base, before, after) {
			const previous = typeof before === "object" && before !== null && !Array.isArray(before) ? before : {};
			const ops = [];
			for (const [key, value] of Object.entries(after)) {
				if (JSON.stringify(previous[key]) === JSON.stringify(value)) continue;
				ops.push({
					op: "set",
					path: [...base, key],
					value
				});
			}
			for (const key of Object.keys(previous)) if (!(key in after)) ops.push({
				op: "unset",
				path: [...base, key]
			});
			return ops;
		}
		/** The editor layout the owning namespace selects. */
		function layoutOf(ns) {
			if (ns === "llm-deepseek") return "deepseek";
			if (ns === "llm-pi-ai") return "pi-ai";
			return "unknown";
		}
		/** The credential reference this profile resolves keys through. */
		function refFor(namespace, path, provider) {
			const profile = (0, _deepseek_ai_dsh_client_schema_form.getPath)(namespace.value, path);
			const named = typeof profile === "object" && profile !== null ? profile.apiKeyEnv : void 0;
			return typeof named === "string" && named.length > 0 ? named : deriveKeyRef(provider);
		}
		/**
		* Render one provider's editing card.
		* @param props - the addressed profile plus wire faces and copy.
		* @returns the editor card.
		*/
		function ProviderEditor(props) {
			const { namespace, settingsPath, api, t } = props;
			const [draft, setDraft] = (0, react.useState)(() => draftAt(namespace, settingsPath));
			const [keyDraft, setKeyDraft] = (0, react.useState)("");
			const [keyState, setKeyState] = (0, react.useState)(void 0);
			const [busy, setBusy] = (0, react.useState)(false);
			const [failure, setFailure] = (0, react.useState)(void 0);
			const [openedAt] = (0, react.useState)(() => {
				return namespace.revision;
			});
			const root = (0, react.useMemo)(() => (0, _deepseek_ai_dsh_client_schema_form.rehydrateSchema)(namespace.schema), [namespace.schema]);
			const node = (0, react.useMemo)(() => (0, _deepseek_ai_dsh_client_schema_form.nodeAtPath)(root, settingsPath), [root, settingsPath]);
			const fallback = (0, _deepseek_ai_dsh_client_schema_form.getPath)(namespace.value, settingsPath);
			const disabled = props.readOnly || busy;
			const layout = layoutOf(namespace.ns);
			const keyRef = refFor(namespace, settingsPath, props.provider);
			(0, react.useEffect)(() => {
				let stale = false;
				setKeyState(void 0);
				api.credentials.describe({ refs: [keyRef] }).then((response) => {
					if (stale || !response.result.ok) return;
					setKeyState(response.result.value.credentials[keyRef]);
				}, () => void 0);
				return () => {
					stale = true;
				};
			}, [api.credentials, keyRef]);
			const stringAt = (source, key) => {
				const value = (0, _deepseek_ai_dsh_client_schema_form.getPath)(source, [key]);
				return typeof value === "string" && value.length > 0 ? value : void 0;
			};
			const setField = (key, next) => {
				setDraft((current) => next === void 0 ? (0, _deepseek_ai_dsh_client_schema_form.deletePath)(current, [key]) : (0, _deepseek_ai_dsh_client_schema_form.setPath)(current, [key], next));
			};
			const modelFailure = validateDeepSeekModels((0, _deepseek_ai_dsh_client_schema_form.getPath)(draft, ["models"]));
			const probeApi = stringAt(draft, "api") ?? stringAt(fallback, "api");
			const probeBaseURL = stringAt(draft, "baseURL") ?? stringAt(fallback, "baseURL");
			const probe = {
				settingsNs: namespace.ns,
				provider: props.provider,
				...probeBaseURL === void 0 ? {} : { baseURL: probeBaseURL },
				...probeApi === void 0 ? {} : { api: probeApi },
				...keyDraft.length === 0 ? {} : { apiKey: keyDraft }
			};
			/**
			* The write for this card, or a failure message. Every edit travels as
			* path ops against the STORED section: the draft comes from the redacted
			* descriptor, so a wholesale replace rebuilt from it would delete the
			* literal secrets the wire never returned. Ops name only the fields this
			* card can see, so a stored secret is untouched by construction.
			*/
			const applyOnce = async () => {
				const ns = namespace.ns;
				const original = (0, _deepseek_ai_dsh_client_schema_form.getPath)(namespace.user, settingsPath);
				const next = layout === "pi-ai" && stringAt(draft, "apiKeyEnv") === void 0 && stringAt(fallback, "apiKeyEnv") === void 0 ? (0, _deepseek_ai_dsh_client_schema_form.setPath)(draft, ["apiKeyEnv"], keyRef) : draft;
				{
					const failure = validateDeepSeekModels((0, _deepseek_ai_dsh_client_schema_form.getPath)(next, ["models"]));
					/* v8 ignore next 3 -- unreachable from the card: the same failure disables submit */
					if (failure !== void 0) return `${t("model")} ${String(failure.index + 1)}: ${t(failure.key)}`;
				}
				/* v8 ignore next -- apply is only reachable from the rendered card, which required a resolved node */
				if (node !== void 0 && settingsPath.length === 0) {
					const sectionError = (0, _deepseek_ai_dsh_client_schema_form.validateDraft)(node, next);
					if (sectionError !== void 0) return sectionError;
				}
				const ops = pathOps(settingsPath, original, next);
				if (ops.length > 0) {
					const response = await api.settings.mutate({
						ns,
						ops,
						expectedRevision: openedAt
					});
					if (!response.result.ok) return response.result.error.code === "settings-conflict" ? t("conflict") : response.result.error.message;
				}
				if (keyDraft.length > 0) {
					const stored = await api.credentials.set({
						ref: keyRef,
						value: keyDraft
					});
					if (!stored.result.ok) return stored.result.error.message;
				}
				setKeyDraft("");
			};
			const apply = async () => {
				setBusy(true);
				setFailure(void 0);
				try {
					const failure = await applyOnce();
					if (failure !== void 0) {
						setFailure(failure);
						return;
					}
					props.onClose(true);
				} catch (error) {
					setFailure(messageOf(error));
				} finally {
					setBusy(false);
				}
			};
			if (node === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: ModelsSection_module_css_default["error"],
				children: `${props.provider}: unresolvable settings path`
			});
			const keyLocked = keyState?.writable === false;
			/**
			* The catalog beneath the user layer: what the composition entry pinned, or
			* else the schema default that `resolve` would supply. The effective value
			* cannot answer this — it still carries the stored override until the unset
			* is applied, so reading it would echo that override straight back the
			* moment reset drops it, leaving the rows unchanged until a reload.
			*/
			const inheritedModels = () => {
				return (0, _deepseek_ai_dsh_client_schema_form.getPath)(namespace.base, [...settingsPath, "models"]) ?? (0, _deepseek_ai_dsh_client_schema_form.nodeAtPath)(root, [...settingsPath, "models"])?.meta.default;
			};
			/**
			* The curated fields of one known adapter family. Taking the narrowed
			* family as a parameter is what makes `EFFORT_FIELD` total here: an
			* unknown namespace never reaches this body.
			*/
			const curatedFields = (family) => {
				const effortField = EFFORT_FIELD[family];
				const customModels = (0, _deepseek_ai_dsh_client_schema_form.getPath)(draft, ["models"]);
				const modelsOverridden = (0, _deepseek_ai_dsh_client_schema_form.hasPath)(draft, ["models"]);
				const models = modelDrafts(modelsOverridden ? customModels : inheritedModels());
				const defaultContextWindow = (0, _deepseek_ai_dsh_client_schema_form.getPath)(fallback, ["defaultContextWindow"]);
				const defaultMaxTokens = (0, _deepseek_ai_dsh_client_schema_form.getPath)(fallback, ["maxTokens"]);
				/** What both family editors take: the rows, whose layer owns them, and the two writes. */
				const catalogProps = {
					models,
					overridden: modelsOverridden,
					t,
					disabled,
					onChange: (next) => {
						setDraft((current) => (0, _deepseek_ai_dsh_client_schema_form.setPath)(current, ["models"], next));
					},
					onReset: () => {
						setDraft((current) => (0, _deepseek_ai_dsh_client_schema_form.deletePath)(current, ["models"]));
					}
				};
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ModelsSection_module_css_default["field"],
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ModelsSection_module_css_default["fieldLabel"],
						children: t("keyInput")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: ModelsSection_module_css_default["input"],
						type: "password",
						autoComplete: "off",
						value: keyDraft,
						placeholder: keyLocked ? t("keyEnvLocked") : keyState?.configured === true ? t("keyStored") : t("keyPlaceholder"),
						"aria-label": t("keyInput"),
						disabled: disabled || keyLocked,
						onChange: (event) => {
							setKeyDraft(event.target.value);
						}
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
					className: ModelsSection_module_css_default["customized"],
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", {
						className: ModelsSection_module_css_default["customizedSummary"],
						children: t("customized")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ModelsSection_module_css_default["customizedBody"],
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ModelsSection_module_css_default["field"],
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ModelsSection_module_css_default["fieldLabel"],
									children: t("baseUrl")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: ModelsSection_module_css_default["input"],
									type: "text",
									value: stringAt(draft, "baseURL") ?? "",
									placeholder: family === "deepseek" ? DEEPSEEK_PUBLIC_BASE_URL : stringAt(fallback, "baseURL") ?? t("baseUrlDefault"),
									"aria-label": t("baseUrl"),
									disabled,
									onChange: (event) => {
										setField("baseURL", event.target.value === "" ? void 0 : event.target.value);
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ModelsSection_module_css_default["field"],
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ModelsSection_module_css_default["fieldLabel"],
									children: t("effort")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: `${ModelsSection_module_css_default["input"]} ${ModelsSection_module_css_default["selectInput"]}`,
									value: stringAt(draft, effortField) ?? "",
									"aria-label": t("effort"),
									disabled,
									onChange: (event) => {
										setField(effortField, event.target.value === "" ? void 0 : event.target.value);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "",
										children: t("effortInherit")
									}), EFFORT_CHOICES[family].map((choice) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: choice,
										children: choice
									}, choice))]
								})]
							}),
							family === "deepseek" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DeepSeekModelsEditor, {
								...catalogProps,
								defaultContextWindow: typeof defaultContextWindow === "number" ? defaultContextWindow : void 0,
								defaultMaxTokens: typeof defaultMaxTokens === "number" ? defaultMaxTokens : void 0
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelListEditor, {
								...catalogProps,
								probe,
								api
							})
						]
					})]
				})] });
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ModelsSection_module_css_default["editor"],
				children: [
					props.hideTitle === true ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ModelsSection_module_css_default["editorHeader"],
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ModelsSection_module_css_default["editorTitle"],
							children: props.displayName
						}), props.provider !== props.displayName ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ModelsSection_module_css_default["editorRoute"],
							children: props.provider
						}) : null]
					}),
					layout === "unknown" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["advancedHint"],
						children: `${t("advancedHint")} (${namespace.ns})`
					}) : curatedFields(layout),
					failure === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["error"],
						children: failure
					}),
					modelFailure === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["advancedHint"],
						children: `${t("model")} ${String(modelFailure.index + 1)}: ${t(modelFailure.key)}`
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(EditorFooter, {
						t,
						busy,
						submitDisabled: disabled || layout === "unknown" || modelFailure !== void 0,
						submitLabel: "apply",
						submitBusyLabel: "applying",
						onCancel: () => {
							props.onClose(false);
						},
						onSubmit: () => {
							apply();
						}
					})
				]
			});
		}
		//#endregion
		//#region src/client/ModelsSection.tsx
		/**
		* Models settings section: the provider rows joined from the configurable
		* directory, settings namespaces, and credential states, with one editor
		* card at a time. A whole-section provider without a configured key (the
		* unconfigured DeepSeek posture) renders as its open setup card instead of a
		* row; the add flow is a card carrying the dormant-provider select. Every
		* mutation writes through the wire, while a provider removal first requires
		* confirmation; the page re-renders from pushed invalidations or the
		* post-apply reload.
		*/
		/**
		* Remove one user-added provider profile by unsetting its path in the stored
		* user section, then reload. The removal names the profile rather than
		* rebuilding the section: this page only ever holds the redacted descriptor,
		* so a rebuilt section would drop every literal secret stored elsewhere in
		* the namespace along with the profile being removed.
		* @param api - settings wire face.
		* @param controller - the page store to refresh.
		* @param target - the provider's settings address.
		* @returns the failure message, or undefined once the write and reload landed.
		*/
		async function removeProviderProfile(api, controller, target) {
			let response;
			try {
				response = await api.settings.mutate({
					ns: target.settingsNs,
					ops: [{
						op: "unset",
						path: [...target.settingsPath]
					}]
				});
			} catch (error) {
				return messageOf(error);
			}
			if (!response.result.ok) return response.result.error.message;
			await controller.load();
		}
		/**
		* Whether a whole-section provider still needs its first key: nothing marks
		* the credential configured and no literal `apiKey` is stored, so the page
		* opens the setup card instead of showing a row.
		* @param row - the joined provider row.
		* @returns whether to render the setup card.
		*/
		function needsSetup(row) {
			if (row.entry.settingsPath.length > 0) return false;
			if (row.credential?.configured === true) return false;
			return !row.literalApiKeyConfigured;
		}
		function targetOf(row) {
			return {
				provider: row.entry.provider,
				displayName: row.entry.displayName,
				settingsNs: row.entry.settingsNs,
				settingsPath: row.entry.settingsPath
			};
		}
		/**
		* Render the Models section content column.
		* @param props - slot-delivered injected dependencies.
		* @returns the section, or null while the shell has not injected yet.
		*/
		function ModelsSection(props) {
			const { controller, useSnapshot, api, t } = props;
			if (controller === void 0 || useSnapshot === void 0 || api === void 0 || t === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loaded, { injected: {
				controller,
				useSnapshot,
				api,
				t
			} });
		}
		function Loaded({ injected }) {
			const { controller, api, t } = injected;
			const state = injected.useSnapshot((snapshot) => snapshot);
			const [editing, setEditing] = (0, react.useState)(void 0);
			const [adding, setAdding] = (0, react.useState)(false);
			const [deleteTarget, setDeleteTarget] = (0, react.useState)(void 0);
			const [deleting, setDeleting] = (0, react.useState)(false);
			const [declaring, setDeclaring] = (0, react.useState)(false);
			const closeEditor = (changed) => {
				setEditing(void 0);
				setAdding(false);
				setDeclaring(false);
				if (changed) controller.load();
			};
			const closeDelete = () => {
				if (deleting) return;
				setDeleteTarget(void 0);
			};
			const confirmDelete = () => {
				/* v8 ignore next -- the action only renders with a target and is disabled while a deletion is pending */
				if (deleteTarget === void 0 || deleting) return;
				setDeleting(true);
				removeProviderProfile(api, controller, deleteTarget).then((failure) => {
					if (failure !== void 0) {
						controller.fail(failure);
						return;
					}
					setDeleteTarget(void 0);
				}).finally(() => {
					setDeleting(false);
				});
			};
			if (state.status === "idle") controller.load();
			if (state.status === "error") {
				/* v8 ignore next -- an error status always carries text; the fallback satisfies the nullable type */
				const errorText = state.error ?? "";
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ModelsSection_module_css_default["section"],
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["error"],
						children: `${t("loadFailed")}: ${errorText}`
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: ModelsSection_module_css_default["secondaryButton"],
						onClick: () => {
							controller.load();
						},
						children: t("retry")
					})]
				});
			}
			const configured = state.rows.filter((row) => row.configured);
			const addable = state.rows.filter((row) => !row.configured && row.entry.settingsNs !== "");
			const addTarget = adding ? editing : void 0;
			const addNamespace = addTarget === void 0 ? void 0 : state.namespaces.get(addTarget.settingsNs);
			const protocols = protocolChoices(state.namespaces.get("llm-pi-ai"));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ModelsSection_module_css_default["section"],
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: ModelsSection_module_css_default["title"],
						children: t("title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["intro"],
						children: t("intro")
					}),
					!state.writable && state.status === "ready" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["notice"],
						children: t("readOnly")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: ModelsSection_module_css_default["rows"],
						children: configured.map((row) => {
							const target = targetOf(row);
							const namespace = state.namespaces.get(target.settingsNs);
							/* v8 ignore next -- the join marks a row configured only when its namespace resolved */
							if (namespace === void 0) return null;
							if (needsSetup(row)) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
								className: ModelsSection_module_css_default["setupCard"],
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderEditor, {
									provider: target.provider,
									displayName: target.displayName,
									namespace,
									settingsPath: target.settingsPath,
									api,
									t,
									readOnly: !state.writable,
									onClose: closeEditor
								})
							}, row.entry.provider);
							const open = !adding && editing?.provider === row.entry.provider;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
								className: ModelsSection_module_css_default["rowCard"],
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ModelsSection_module_css_default["rowHead"],
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ModelsSection_module_css_default["rowName"],
										children: row.entry.displayName
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: ModelsSection_module_css_default["rowActions"],
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: ModelsSection_module_css_default["secondaryButton"],
											onClick: () => {
												setDeclaring(false);
												setAdding(false);
												setEditing(open ? void 0 : target);
											},
											children: t("edit")
										}), row.removable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: ModelsSection_module_css_default["dangerButton"],
											disabled: !state.writable,
											onClick: () => {
												setDeleteTarget(target);
											},
											children: t("remove")
										}) : null]
									})]
								}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderEditor, {
									provider: target.provider,
									displayName: target.displayName,
									namespace,
									settingsPath: target.settingsPath,
									api,
									t,
									readOnly: !state.writable,
									onClose: closeEditor
								}) : null]
							}, row.entry.provider);
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ModelsSection_module_css_default["addBlock"],
						children: addTarget !== void 0 && addNamespace !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ModelsSection_module_css_default["addCard"],
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ModelsSection_module_css_default["field"],
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ModelsSection_module_css_default["fieldLabel"],
									children: t("provider")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									className: `${ModelsSection_module_css_default["input"]} ${ModelsSection_module_css_default["selectInput"]}`,
									value: addTarget.provider,
									"aria-label": t("provider"),
									onChange: (event) => {
										const row = addable.find((candidate) => candidate.entry.provider === event.target.value);
										/* v8 ignore next -- the select only lists addable rows */
										if (row === void 0) return;
										setEditing(targetOf(row));
									},
									children: addable.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: row.entry.provider,
										children: row.entry.displayName
									}, row.entry.provider))
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderEditor, {
								provider: addTarget.provider,
								displayName: addTarget.displayName,
								hideTitle: true,
								namespace: addNamespace,
								settingsPath: addTarget.settingsPath,
								api,
								t,
								readOnly: !state.writable,
								onClose: closeEditor
							}, addTarget.provider)]
						}) : declaring ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: ModelsSection_module_css_default["addCard"],
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CustomProviderCard, {
								taken: state.rows.map((row) => row.entry.provider),
								protocols,
								/* v8 ignore next -- the card only opens from a button disabled without this namespace */
								revision: state.namespaces.get("llm-pi-ai")?.revision ?? 0,
								api,
								t,
								readOnly: !state.writable,
								onClose: closeEditor
							})
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ModelsSection_module_css_default["addActions"],
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: ModelsSection_module_css_default["addButton"],
								disabled: addable.length === 0 || !state.writable,
								onClick: () => {
									const first = addable[0];
									/* v8 ignore next -- the button is disabled while nothing is addable */
									if (first === void 0) return;
									setDeclaring(false);
									setAdding(true);
									setEditing(targetOf(first));
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 14 }), t("add")]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: ModelsSection_module_css_default["addButton"],
								disabled: protocols.length === 0 || !state.writable,
								onClick: () => {
									setAdding(false);
									setEditing(void 0);
									setDeclaring(true);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 14 }), t("customAdd")]
							})]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: deleteTarget !== void 0,
						onClose: closeDelete,
						title: t("deleteTitle"),
						closeLabel: t("close"),
						description: t("deleteDescription"),
						className: ModelsSection_module_css_default["deleteDialog"],
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							autoFocus: true,
							disabled: deleting,
							onClick: closeDelete,
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							className: ModelsSection_module_css_default["deleteConfirm"],
							disabled: deleting,
							onClick: confirmDelete,
							children: deleting ? t("deleting") : t("deleteConfirm")
						})] })
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-models/src/client/DeepSeekOnboardingDialog.module.css.mjs
		const css = ".RpxqKG_page{z-index:1;box-sizing:border-box;width:min(640px,100vw - 64px);max-height:100vh;color:var(--dsw-alias-label-primary);padding:clamp(104px,18vh,156px) 0 40px;position:relative;overflow-y:auto}.RpxqKG_brand{color:var(--dsw-alias-label-primary);align-items:center;margin-bottom:42px;display:flex}.RpxqKG_title{letter-spacing:-.02em;outline:none;margin:0;font-size:28px;font-weight:600;line-height:36px}.RpxqKG_description{color:var(--dsw-alias-label-secondary);margin:16px 0 0;font-size:16px;line-height:28px}.RpxqKG_actions{justify-content:flex-end;align-items:center;gap:12px;margin-top:32px;display:flex}.RpxqKG_primary{min-width:132px}.RpxqKG_brand,.RpxqKG_title,.RpxqKG_description,.RpxqKG_actions{animation:.28s cubic-bezier(.23,1,.32,1) both RpxqKG_credential-enter}.RpxqKG_title{animation-delay:40ms}.RpxqKG_description{animation-delay:80ms}.RpxqKG_actions{animation-delay:.12s}@keyframes RpxqKG_credential-enter{0%{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@media (prefers-reduced-motion:reduce){.RpxqKG_brand,.RpxqKG_title,.RpxqKG_description,.RpxqKG_actions{animation:none}}@media (width<=560px){.RpxqKG_page{width:calc(100vw - 40px);padding-top:64px}.RpxqKG_brand{margin-bottom:30px}.RpxqKG_actions{flex-direction:column-reverse;align-items:stretch;margin-top:32px}.RpxqKG_primary,.RpxqKG_later{width:100%}}";
		const tagId = "@deepseek-ai/dsh-client-ui-models/DeepSeekOnboardingDialog.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-models";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var DeepSeekOnboardingDialog_module_css_default = {
			"description": "RpxqKG_description",
			"brand": "RpxqKG_brand",
			"primary": "RpxqKG_primary",
			"credential-enter": "RpxqKG_credential-enter",
			"title": "RpxqKG_title",
			"page": "RpxqKG_page",
			"later": "RpxqKG_later",
			"actions": "RpxqKG_actions"
		};
		//#endregion
		//#region src/client/DeepSeekOnboardingDialog.tsx
		/**
		* Official-DeepSeek first-run step. Readiness comes from the same
		* provider/settings/credential join as the Models page; the prompt only
		* routes the user to that page's single credential editor.
		*/
		/* v8 ignore next 3 -- closed-union defaults only defend future source widening */
		function assertNever(_value) {
			throw new Error("unexpected DeepSeek onboarding state");
		}
		/**
		* Prompt a first-run user to open Models while the official adapter exists
		* and its effective credential is not configured.
		* @param props - settings-shell owner state and Models feature dependencies.
		* @returns the onboarding page or null when onboarding needs no intervention.
		*/
		function DeepSeekOnboardingDialog(props) {
			const { complete, openSection, controller, useSnapshot, t } = props;
			const state = useSnapshot((snapshot) => snapshot);
			const readiness = deepSeekReadiness(state);
			const titleRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (state.status === "idle") controller.load();
			}, [controller, state.status]);
			(0, react.useEffect)(() => {
				if (readiness.kind === "adapter-absent" || readiness.kind === "configured" || readiness.kind === "unavailable") complete();
			}, [complete, readiness.kind]);
			(0, react.useEffect)(() => {
				if (readiness.kind === "credential-missing") titleRef.current?.focus();
			}, [readiness.kind]);
			const openModels = () => {
				complete();
				openSection("models");
			};
			switch (readiness.kind) {
				case "loading":
				case "adapter-absent":
				case "configured":
				case "unavailable": return null;
				case "credential-missing": break;
				/* v8 ignore next -- every current readiness variant is handled above */
				default: return assertNever(readiness);
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.OnboardingSurface, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: DeepSeekOnboardingDialog_module_css_default["page"],
				role: "region",
				"aria-labelledby": "deepseek-onboarding-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: DeepSeekOnboardingDialog_module_css_default["brand"],
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.BrandWordmark, { size: 24 })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						ref: titleRef,
						id: "deepseek-onboarding-title",
						className: DeepSeekOnboardingDialog_module_css_default["title"],
						tabIndex: -1,
						children: t("onboardingTitle")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: DeepSeekOnboardingDialog_module_css_default["description"],
						children: t("onboardingDescription")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: DeepSeekOnboardingDialog_module_css_default["actions"],
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							className: DeepSeekOnboardingDialog_module_css_default["later"],
							onClick: complete,
							children: t("onboardingLater")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							className: DeepSeekOnboardingDialog_module_css_default["primary"],
							onClick: openModels,
							children: t("onboardingGoToSettings")
						})]
					})
				]
			}) });
		}
		//#endregion
		//#region src/client/locales.ts
		/** Copy dictionaries for the Models settings section. */
		/** English strings (the key-set source of truth for this pair). */
		const en = {
			nav: "Models",
			title: "Models",
			intro: "Enter your API keys to use models from the following providers.",
			edit: "Edit",
			remove: "Delete",
			deleteTitle: "Delete model provider?",
			deleteDescription: "Deleting this model provider removes its configuration. You will not be able to use its models until you add the provider again.",
			deleteConfirm: "Delete provider",
			deleting: "Deleting provider…",
			add: "Add provider",
			provider: "Provider",
			close: "Close",
			cancel: "Cancel",
			apply: "Apply",
			applying: "Applying…",
			readOnly: "The settings document is read-only in this deployment.",
			loadFailed: "Loading the provider directory failed",
			conflict: "Someone else changed these settings while this card was open. Close it and reopen to edit the current values.",
			retry: "Retry",
			keyInput: "API key",
			keyPlaceholder: "Enter your API key",
			keyStored: "Configured — enter a new value to replace",
			keyEnvLocked: "Provided by the launch environment (read-only)",
			customized: "Customized settings",
			baseUrl: "Base URL",
			baseUrlDefault: "Provider default",
			effort: "Reasoning effort",
			effortInherit: "Default",
			models: "Models",
			modelsInherited: "Using the adapter defaults",
			modelsCustomized: "Customized model catalog",
			resetModels: "Restore defaults",
			model: "Model",
			modelId: "Model ID",
			modelName: "Display name",
			modelNamePlaceholder: "Uses the model ID when empty",
			contextWindow: "Context window",
			contextWindowPlaceholder: "Uses the provider default",
			maxTokens: "Max output tokens",
			maxTokensPlaceholder: "Uses the provider default",
			modelAdvanced: "Capacities",
			addModel: "Add model",
			removeModel: "Delete model",
			modelsEmpty: "No models will be shown in the selector. Unlisted IDs can still be sent directly.",
			modelIdRequired: "Model ID is required.",
			modelIdDuplicate: "Model ID must be unique.",
			modelNameInvalid: "Display name cannot be empty.",
			modelContextInvalid: "Context window must be a positive count, like 131072, 256K, or 1M.",
			modelMaxTokensInvalid: "Max output tokens must be a positive count, like 8192, 64K, or 1M.",
			advancedHint: "Other fields live in settings.yaml; edit that section directly.",
			modelCapacityInvalid: "A capacity must be a number, optionally suffixed K or M.",
			modelDuplicate: "Each model ID may appear once.",
			modelContextWindow: "Context window",
			modelMaxTokens: "Max output tokens",
			fetchModels: "Fetch available models",
			fetching: "Asking the provider…",
			fetchNeedsBaseUrl: "Enter the base URL first, then fetch.",
			fetchEmpty: "The provider listed no models. Add them by hand.",
			fetchTitle: "Choose models to add",
			fetchDescription: "These are the models this provider has available. Choose the ones to add.",
			fetchAdopt: "Add selected",
			customAdd: "Add a custom provider",
			customTitle: "Custom provider",
			customRoute: "Provider ID",
			customRouteHint: "Lowercase identifier that uniquely names this provider in requests and as its credential name.",
			customRouteInvalid: "Use lowercase letters, digits, and dashes.",
			customRouteTaken: "A provider already uses this ID.",
			customDisplayName: "Display name",
			customApi: "API protocol",
			customNeedsBaseUrl: "A custom provider needs a base URL.",
			customNeedsModels: "A custom provider needs at least one model.",
			create: "Create provider",
			creating: "Creating…",
			onboardingTitle: "Add an API key to get started",
			onboardingDescription: "Configure the official DeepSeek provider to start building.",
			onboardingGoToSettings: "Go to settings",
			onboardingLater: "Configure later"
		};
		/** Chinese strings (same keys as {@link en}). */
		const zh = {
			nav: "模型",
			title: "模型",
			intro: "填入各提供方的 API 密钥即可使用其模型。",
			edit: "编辑",
			remove: "删除",
			deleteTitle: "删除模型提供方？",
			deleteDescription: "删除此模型提供方会移除其配置。在重新添加前，你将无法继续使用其模型。",
			deleteConfirm: "删除提供方",
			deleting: "正在删除提供方…",
			add: "添加提供方",
			provider: "提供方",
			close: "关闭",
			cancel: "取消",
			apply: "保存",
			applying: "保存中…",
			readOnly: "当前部署的设置文档为只读。",
			loadFailed: "加载提供方目录失败",
			conflict: "这张卡片打开期间，这些设置已被其他地方改动。请关闭后重新打开，在当前值上编辑。",
			retry: "重试",
			keyInput: "API 密钥",
			keyPlaceholder: "输入 API 密钥",
			keyStored: "已配置——输入新值可替换",
			keyEnvLocked: "由启动环境提供（只读）",
			customized: "自定义设置",
			baseUrl: "API 地址",
			baseUrlDefault: "提供方默认",
			effort: "推理强度",
			effortInherit: "默认",
			models: "模型目录",
			modelsInherited: "正在使用适配器默认模型",
			modelsCustomized: "已自定义模型目录",
			resetModels: "恢复默认模型",
			model: "模型",
			modelId: "模型 ID",
			modelName: "显示名称",
			modelNamePlaceholder: "留空时使用模型 ID",
			contextWindow: "上下文窗口",
			contextWindowPlaceholder: "使用提供方默认值",
			maxTokens: "最大输出 token 数",
			maxTokensPlaceholder: "使用提供方默认值",
			modelAdvanced: "容量",
			addModel: "添加模型",
			removeModel: "删除模型",
			modelsEmpty: "模型选择器中将不显示任何模型；目录外 ID 仍可直接发送。",
			modelIdRequired: "模型 ID 不能为空。",
			modelIdDuplicate: "模型 ID 不能重复。",
			modelNameInvalid: "显示名称不能为空。",
			modelContextInvalid: "上下文窗口必须是正数，例如 131072、256K 或 1M。",
			modelMaxTokensInvalid: "最大输出 token 数必须是正数，例如 8192、64K 或 1M。",
			advancedHint: "其余字段在 settings.yaml 中，请直接编辑对应段。",
			modelCapacityInvalid: "容量需为数字，可加 K 或 M 后缀。",
			modelDuplicate: "每个模型 ID 只能出现一次。",
			modelContextWindow: "上下文窗口",
			modelMaxTokens: "最大输出 token",
			fetchModels: "获取可用模型",
			fetching: "正在询问提供方…",
			fetchNeedsBaseUrl: "请先填写 API 地址，再获取。",
			fetchEmpty: "该提供方没有列出任何模型，请手动添加。",
			fetchTitle: "选择要添加的模型",
			fetchDescription: "以下是模型提供方的可用模型，勾选要添加的模型。",
			fetchAdopt: "添加所选",
			customAdd: "添加自定义提供方",
			customTitle: "自定义提供方",
			customRoute: "Provider ID",
			customRouteHint: "小写标识，在请求中唯一标识该提供方，并用于派生凭据名。",
			customRouteInvalid: "只能使用小写字母、数字和短横线。",
			customRouteTaken: "已有提供方使用了这个 ID。",
			customDisplayName: "显示名称",
			customApi: "API 协议",
			customNeedsBaseUrl: "自定义提供方需要填写 API 地址。",
			customNeedsModels: "自定义提供方至少需要一个模型。",
			create: "创建提供方",
			creating: "创建中…",
			onboardingTitle: "添加一个 API Key 开始使用",
			onboardingDescription: "配置 DeepSeek 官方模型，即可开始使用。",
			onboardingGoToSettings: "前往配置",
			onboardingLater: "稍后配置"
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.models";
		/**
		* Refetch the page snapshot only after its first load: an unopened Models
		* page must not fetch on background invalidations.
		* @param controller - the page store.
		*/
		function refreshIfLoaded(controller) {
			if (controller.store.getSnapshot().status === "idle") return;
			controller.load();
		}
		/**
		* Required services (cordis fiber inject). The target slot is declared by
		* ui-settings' apply, whose activation order relative to this one is NOT
		* constrained; registration depends on each slot through `slots.inject()`.
		*/
		const inject = [
			"slots",
			"locale",
			"connection"
		];
		/**
		* Register the Models section once the `settings.section` declaration is on
		* the ledger, wire its store to the connection, and keep it fresh on every
		* pushed invalidation (settings, credentials, or provider topology).
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => {
				return ctx.locale.register(NS, {
					zh,
					en
				});
			}, "ui-models: copy dictionaries");
			const connection = ctx.get("connection");
			const controller = new ModelsSettingsStore(connection.api);
			const useSnapshot = (0, _deepseek_ai_dsh_client_web_react.bindSnapshotSelector)(controller.store);
			const t = ctx.locale.bind(NS);
			const injected = () => ({
				controller,
				useSnapshot,
				api: connection.api,
				t
			});
			const onboardingInjected = () => ({
				controller,
				useSnapshot,
				t
			});
			ctx.effect(() => {
				const refresh = () => {
					refreshIfLoaded(controller);
				};
				const disposers = [
					ctx.on("settings/changed", refresh),
					ctx.on("credentials/changed", refresh),
					ctx.on("models/changed", refresh),
					ctx.on("connection/reset", refresh)
				];
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "ui-models: pushed invalidations");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "models",
				order: 10,
				label: () => t("nav"),
				inject: injected
			}, ModelsSection));
			ctx.slots.inject("settings.onboarding", () => ctx.slots.register({
				name: "settings.onboarding",
				id: "deepseek-official",
				order: 0,
				inject: onboardingInjected
			}, DeepSeekOnboardingDialog));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.refreshIfLoaded = refreshIfLoaded;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map