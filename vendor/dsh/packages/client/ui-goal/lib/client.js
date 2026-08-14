window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-goal",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-goal/src/client/GoalBar.module.css.mjs
		const css = ".JoAFBq_dock{box-sizing:border-box;width:calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));margin:0 auto}.JoAFBq_bar{box-sizing:border-box;width:100%;max-width:calc(var(--dsh-composer-card-max-width) - 4 * var(--dsh-composer-dock-inset));border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-tip);border-radius:12px;align-items:center;gap:10px;height:36px;margin:0 auto;padding:4px 5px 4px 12px;display:flex}.JoAFBq_goalGlyph{color:var(--dsw-alias-label-tertiary);flex:none;display:inline-flex}.JoAFBq_label{color:var(--dsw-alias-label-primary);flex:none;font-size:13px;font-weight:500;line-height:24px}.JoAFBq_objective{min-width:0;color:var(--dsw-alias-label-primary-dimmed);text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:13px;line-height:20px;overflow:hidden}.JoAFBq_error{min-width:0;color:var(--dsw-alias-state-error-primary);text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:12px;line-height:20px;overflow:hidden}.JoAFBq_objectiveInput{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);min-width:0;height:26px;color:var(--dsw-alias-label-primary);border-radius:6px;outline:none;flex:1;padding:0 8px;font-size:13px;line-height:20px}.JoAFBq_objectiveInput:focus{border-color:var(--dsw-alias-state-business-primary)}.JoAFBq_objectiveInput::placeholder{color:var(--dsw-alias-label-caption)}.JoAFBq_actions{flex:none;align-items:center;gap:10px;display:flex}.JoAFBq_iconBtn{width:28px;height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:999px;justify-content:center;align-items:center;padding:0;display:inline-flex}.JoAFBq_iconBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.JoAFBq_iconBtn:disabled{opacity:.4;cursor:default}";
		const tagId = "@deepseek-ai/dsh-client-ui-goal/GoalBar.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-goal";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var GoalBar_module_css_default = {
			"goalGlyph": "JoAFBq_goalGlyph",
			"error": "JoAFBq_error",
			"bar": "JoAFBq_bar",
			"objective": "JoAFBq_objective",
			"dock": "JoAFBq_dock",
			"label": "JoAFBq_label",
			"objectiveInput": "JoAFBq_objectiveInput",
			"actions": "JoAFBq_actions",
			"iconBtn": "JoAFBq_iconBtn"
		};
		//#endregion
		//#region src/client/GoalBar.tsx
		/**
		* GoalBar: the goal indicator docked above the message composer (input dock
		* strip). A present goal shows a goal glyph, a phase label, the truncated
		* objective, and icon actions — resume when paused, edit (inline form in the
		* same strip), and clear. Goal creation lives on the `/goal` command, not
		* here: loading (undefined), no goal (null), and complete goals render
		* nothing. Live state arrives as the projected whole snapshot; the verbs are
		* the injected face.
		*/
		/** Strip label keys per visible phase; complete goals render nothing. */
		const PHASE_LABELS = {
			active: "phase.active",
			paused: "phase.paused",
			blocked: "phase.blocked"
		};
		function GoalBar({ goal, onEdit, onPause, onResume, onClear, t }) {
			const [editing, setEditing] = (0, react.useState)(false);
			const [draft, setDraft] = (0, react.useState)("");
			const [pending, setPending] = (0, react.useState)(false);
			const [actionError, setActionError] = (0, react.useState)(null);
			const [clearedGoalId, setClearedGoalId] = (0, react.useState)(null);
			const pendingRef = (0, react.useRef)(false);
			const goalId = goal?.id;
			(0, react.useEffect)(() => {
				setEditing(false);
				setActionError(null);
				setClearedGoalId(null);
			}, [goalId]);
			const runAction = (0, react.useCallback)(async (action) => {
				if (pendingRef.current) return void 0;
				pendingRef.current = true;
				setPending(true);
				setActionError(null);
				const result = await action();
				pendingRef.current = false;
				setPending(false);
				if (!result.ok) setActionError(`${result.error.message} (${result.error.code})`);
				return result;
			}, []);
			const handleEdit = (0, react.useCallback)(async () => {
				const trimmed = draft.trim();
				if (trimmed === "") return;
				if ((await runAction(() => onEdit(trimmed)))?.ok) setEditing(false);
			}, [
				draft,
				onEdit,
				runAction
			]);
			const handleClear = (0, react.useCallback)(async (clearedId) => {
				if ((await runAction(onClear))?.ok) setClearedGoalId(clearedId);
			}, [onClear, runAction]);
			if (goal === void 0 || goal === null || goal.phase === "complete" || goal.id === clearedGoalId) return null;
			if (editing) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: GoalBar_module_css_default.dock,
				"data-goal-bar": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: GoalBar_module_css_default.bar,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: GoalBar_module_css_default.objectiveInput,
							type: "text",
							"aria-label": t("objective.aria"),
							value: draft,
							onChange: (e) => {
								setDraft(e.target.value);
							},
							onKeyDown: (e) => {
								if (e.key === "Enter") handleEdit();
								if (e.key === "Escape") setEditing(false);
							},
							autoFocus: true
						}),
						actionError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: GoalBar_module_css_default.error,
							role: "alert",
							children: actionError
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: GoalBar_module_css_default.actions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: t("action.save"),
								side: "bottom",
								delayMs: 500,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: GoalBar_module_css_default.iconBtn,
									onClick: () => {
										handleEdit();
									},
									disabled: pending || draft.trim() === "",
									"aria-label": t("action.save"),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, { size: 14 })
								})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: t("action.cancel"),
								side: "bottom",
								delayMs: 500,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: GoalBar_module_css_default.iconBtn,
									onClick: () => {
										setEditing(false);
									},
									disabled: pending,
									"aria-label": t("action.cancel"),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, { size: 14 })
								})
							})]
						})
					]
				})
			});
			const title = goal.phase === "blocked" ? goal.blockedReason?.message : void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: GoalBar_module_css_default.dock,
				"data-goal-bar": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: GoalBar_module_css_default.bar,
					title,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: GoalBar_module_css_default.goalGlyph,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGoalOutline16, { size: 14 })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: GoalBar_module_css_default.label,
							children: t(PHASE_LABELS[goal.phase])
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: GoalBar_module_css_default.objective,
							children: goal.objective
						}),
						actionError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: GoalBar_module_css_default.error,
							role: "alert",
							children: actionError
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: GoalBar_module_css_default.actions,
							children: [
								goal.phase === "active" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
									label: t("action.pause"),
									side: "bottom",
									delayMs: 500,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: GoalBar_module_css_default.iconBtn,
										disabled: pending,
										onClick: () => {
											runAction(onPause);
										},
										"aria-label": t("action.pause"),
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPauseOutline16, { size: 14 })
									})
								}),
								goal.phase === "paused" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
									label: t("action.resume"),
									side: "bottom",
									delayMs: 500,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: GoalBar_module_css_default.iconBtn,
										disabled: pending,
										onClick: () => {
											runAction(onResume);
										},
										"aria-label": t("action.resume"),
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlayOutline16, { size: 14 })
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
									label: t("action.edit"),
									side: "bottom",
									delayMs: 500,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: GoalBar_module_css_default.iconBtn,
										disabled: pending,
										onClick: () => {
											setDraft(goal.objective);
											setEditing(true);
										},
										"aria-label": t("action.edit"),
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, { size: 14 })
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
									label: t("action.clear"),
									side: "bottom",
									delayMs: 500,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: GoalBar_module_css_default.iconBtn,
										disabled: pending,
										onClick: () => {
											handleClear(goal.id);
										},
										"aria-label": t("action.clear"),
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutline16, { size: 14 })
									})
								})
							]
						})
					]
				})
			});
		}
		/** Dock adapter: reads the host-computed 'goal' projection (whole value; absent or null renders nothing). */
		function GoalDock({ useProjection, onEdit, onPause, onResume, onClear, t }) {
			const projection = useProjection("goal");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GoalBar, {
				goal: projection === void 0 ? void 0 : projection === null ? null : projection.goal,
				onEdit,
				onPause,
				onResume,
				onClear,
				t
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** `goal` namespace dictionaries. */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"phase.active": "进行中的目标",
			"phase.paused": "已暂停的目标",
			"phase.blocked": "受阻的目标",
			"objective.aria": "目标内容",
			"action.save": "保存目标",
			"action.cancel": "取消编辑",
			"action.pause": "暂停目标",
			"action.resume": "恢复目标",
			"action.edit": "编辑目标",
			"action.clear": "清除目标"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"phase.active": "Ongoing Goal",
			"phase.paused": "Paused Goal",
			"phase.blocked": "Blocked Goal",
			"objective.aria": "Goal objective",
			"action.save": "Save goal",
			"action.cancel": "Cancel edit",
			"action.pause": "Pause goal",
			"action.resume": "Resume goal",
			"action.edit": "Edit goal",
			"action.clear": "Clear goal"
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "goal";
		/** Required services: slots for the dock entry, sessions for the projected ref, connection for the wire verbs, locale for the copy. */
		const inject = [
			"slots",
			"sessions",
			"connection",
			"locale"
		];
		/** Map one settled RPC result onto the strip's inline-render shape. */
		function settle(result) {
			if (result.ok) return { ok: true };
			return {
				ok: false,
				error: {
					code: result.error.code,
					message: result.error.message
				}
			};
		}
		/**
		* Client plugin body: the GoalBar dock entry with its mutation verbs.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-goal: dictionaries");
			const { goals } = ctx.get("connection").api;
			const sessions = ctx.sessions;
			/** The session's current projected CAS ref, read at verb call time (no staleness fence: the RPC's CAS is the guard). */
			const refOf = (sessionId) => {
				const projection = (sessions.binding(sessionId)?.session.projections.faceOf("goal"))?.getSnapshot();
				if (projection == null) return void 0;
				return {
					id: projection.goal.id,
					revision: projection.goal.revision
				};
			};
			const noCurrentGoal = {
				ok: false,
				error: {
					code: "no-current-goal",
					message: "no current goal to mutate"
				}
			};
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "goal",
				order: 10,
				locale: NS,
				inject: (sessionId) => ({
					onEdit: async (objective) => {
						const ref = refOf(sessionId);
						if (ref === void 0) return noCurrentGoal;
						return settle((await goals.edit({
							sessionId,
							ref,
							objective
						})).result);
					},
					onPause: async () => {
						const ref = refOf(sessionId);
						if (ref === void 0) return noCurrentGoal;
						return settle((await goals.pause({
							sessionId,
							ref
						})).result);
					},
					onResume: async () => {
						const ref = refOf(sessionId);
						if (ref === void 0) return noCurrentGoal;
						return settle((await goals.resume({
							sessionId,
							ref
						})).result);
					},
					onClear: async () => {
						const ref = refOf(sessionId);
						if (ref === void 0) return noCurrentGoal;
						return settle((await goals.clear({
							sessionId,
							ref
						})).result);
					}
				})
			}, GoalDock));
		}
		//#endregion
		exports.GoalBar = GoalBar;
		exports.GoalDock = GoalDock;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map