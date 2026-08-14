window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-conversation",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_ui_slots = require("@deepseek-ai/dsh-client-ui-slots");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let cordis = require("cordis");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/contract/tool-call-model.ts
		/** Figma row titles per variant (design literals, not translatable copy). */
		const VARIANT_TITLES = {
			think: "Think",
			search: "Search",
			read: "Read",
			bash: "Bash",
			write: "Write",
			edit: "Edit",
			code: "Code",
			others: "Tool call"
		};
		/** Known tool name -> variant. */
		const TOOL_VARIANTS = {
			bash: "bash",
			pwsh: "bash",
			read: "read",
			web_fetch: "read",
			web_search: "search",
			grep: "search",
			glob: "search",
			write: "write",
			edit: "edit",
			run_code: "code",
			cordis_inspect: "read",
			cordis_mount: "code",
			cordis_unmount: "others"
		};
		/** Tool-owned titles that refine a generic row variant without replacing it. */
		const TOOL_TITLES = {
			cordis_inspect: "Inspect",
			cordis_mount: "Mount temporary Plugin",
			cordis_unmount: "Unmount temporary Plugin",
			pwsh: "Pwsh"
		};
		/**
		* Classify a tool name into its row variant.
		* @param toolName - wire tool name.
		* @returns matching variant, others when unknown.
		*/
		function classifyTool(toolName) {
			return TOOL_VARIANTS[toolName] ?? "others";
		}
		/**
		* Flatten a settled result's content blocks to display text: text blocks
		* verbatim, other block shapes as pretty JSON. Empty content on a failed call
		* falls back to the structured error's `name: code` line.
		* @param node - the settled result node.
		* @returns the flattened result text (may be empty).
		*/
		function resultText(node) {
			const parts = [];
			for (const block of node.content) if (block.type === "text") parts.push(block.text);
			else parts.push(JSON.stringify(block, null, 2));
			if (parts.length === 0 && node.error !== void 0) parts.push(`${node.error.name}: ${node.error.code}`);
			return parts.join("\n");
		}
		function parseArgs(argsRaw) {
			try {
				return JSON.parse(argsRaw);
			} catch {
				return;
			}
		}
		function firstLine$1(text) {
			const nl = text.indexOf("\n");
			return nl !== -1 ? text.slice(0, nl) : text;
		}
		function pickString(args, keys) {
			for (const key of keys) {
				const v = args[key];
				if (typeof v === "string" && v !== "") return v;
			}
		}
		/** Summary key preference per variant (args-derived; result-derived summaries are a ledger item). */
		const SUMMARY_KEYS = {
			bash: ["description", "command"],
			read: [
				"path",
				"file_path",
				"url"
			],
			search: [
				"query",
				"pattern",
				"url"
			],
			think: [],
			write: ["path", "file_path"],
			edit: ["path", "file_path"],
			code: ["description"],
			others: []
		};
		/**
		* Strip the workspace root from a workspace-rooted absolute path (display only).
		* @param text - the path to shorten.
		* @param cwd - session workspace root; absent or empty leaves the path unchanged.
		* @returns the path relative to the workspace root, or unchanged when it is not rooted there.
		*/
		function relativizeToCwd(text, cwd) {
			if (cwd === void 0 || cwd === "") return text;
			const root = cwd.replace(/[/\\]+$/, "");
			if (text.startsWith(`${root}/`) || text.startsWith(`${root}\\`)) return text.slice(root.length + 1);
			return text;
		}
		function deriveSummary(variant, argsRaw) {
			const parsed = parseArgs(argsRaw);
			if (typeof parsed !== "object" || parsed === null) return firstLine$1(argsRaw);
			const args = parsed;
			const picked = pickString(args, SUMMARY_KEYS[variant]);
			if (picked !== void 0) return firstLine$1(picked);
			for (const v of Object.values(args)) if (typeof v === "string" && v !== "") return firstLine$1(v);
			return firstLine$1(argsRaw);
		}
		/** Path keys only — never `url` (web_fetch lands on the read variant). */
		const FILE_PATH_KEYS = ["path", "file_path"];
		/** File-tool variants whose summary may be an openable workspace path. */
		const FILE_PATH_VARIANTS = new Set([
			"read",
			"write",
			"edit"
		]);
		function deriveFilePath(variant, argsRaw) {
			if (!FILE_PATH_VARIANTS.has(variant)) return void 0;
			const parsed = parseArgs(argsRaw);
			if (typeof parsed !== "object" || parsed === null) return;
			const picked = pickString(parsed, FILE_PATH_KEYS);
			return picked === void 0 ? void 0 : firstLine$1(picked);
		}
		/**
		* Resolve a tool-arg path against the session cwd for host.openPath.
		* Absolute POSIX/Windows paths pass through; relative paths join under cwd.
		* @param cwd - session working directory (may be absent for ungrouped sessions).
		* @param path - path as carried in tool args.
		* @returns a host-facing path string.
		*/
		function resolveToolPath(cwd, path) {
			if (path.startsWith("/") || /^[A-Za-z]:[/\\]/.test(path) || path.startsWith("\\\\")) return path;
			if (cwd === void 0 || cwd === "") return path;
			return `${cwd.replace(/[/\\]+$/, "")}/${path.replace(/^[/\\]+/, "")}`;
		}
		function deriveBody(variant, argsRaw) {
			if (argsRaw === "") return null;
			const parsed = parseArgs(argsRaw);
			if (parsed === void 0) return argsRaw;
			if (variant === "code" && typeof parsed === "object" && parsed !== null) {
				const code = parsed.code;
				if (typeof code === "string" && code !== "") return code;
			}
			return JSON.stringify(parsed, null, 2);
		}
		/**
		* Derive the full row model from a frozen call slice.
		* @param toolName - wire tool name (dispatch-supplied; survives windowless results).
		* @param block - RunningToolCall or ToolResultNode off the snapshot caches.
		* @param cwd - session workspace root; workspace-rooted path summaries display relative to it.
		* @returns the row model.
		*/
		function toolRowModel(toolName, block, cwd) {
			const variant = classifyTool(toolName);
			const done = "kind" in block;
			const argsRaw = (done ? block.call?.argsRaw : block.argsRaw) ?? "";
			const state = !done ? "running" : block.error?.code === "interrupted" ? "stopped" : block.isError ? "error" : "ok";
			const base = argsRaw === "" ? block.callId : relativizeToCwd(deriveSummary(variant, argsRaw), cwd);
			const toolTitle = TOOL_TITLES[toolName];
			const summary = variant === "others" && toolName !== "" && toolTitle === void 0 ? `${toolName} · ${base}` : base;
			const output = done ? resultText(block) || null : null;
			const errorSummary = state === "error" && output !== null ? firstLine$1(output) : null;
			return {
				variant,
				title: toolTitle ?? VARIANT_TITLES[variant],
				summary,
				filePath: deriveFilePath(variant, argsRaw),
				body: deriveBody(variant, argsRaw),
				output,
				errorSummary,
				state
			};
		}
		//#endregion
		//#region src/client/stores.ts
		/**
		* Per-session chat store shared by conversation and details registrations.
		* The plugin creates its handle at apply time so identity follows the fiber.
		*/
		/**
		* Declares the per-session chat state and write surface.
		* @returns the store handle.
		*/
		function createChatStore() {
			return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
				init: () => ({
					selection: null,
					draft: "",
					view: null,
					inspect: null
				}),
				persist: "dsh.conversation.chat",
				actions: {
					select: (d, target) => {
						d.selection = target;
					},
					setDraft: (d, text) => {
						d.draft = text;
					},
					clearDraft: (d) => {
						d.draft = "";
					},
					restoreDraft: (d, text) => {
						if (d.draft === "") d.draft = text;
					},
					setView: (d, view) => {
						d.view = view;
					},
					setInspect: (d, target) => {
						d.inspect = target;
					}
				}
			});
		}
		//#endregion
		//#region src/client/service.ts
		/**
		* Scope-addressed conversation send, cancel, and history orchestration.
		*
		* Scope addressing rides the cordis Service tracker: property access through
		* `ctx.conversation` rebinds `this.ctx` to the caller's context, so methods
		* read the session tag with `scopeOf`. Mutable state must remain reachable
		* through one property read; assignment through the tracker proxy and `#`
		* private fields bypass that rebinding.
		*/
		/** Scope-addressed conversation service (root singleton, provided as `conversation`). */
		var ConversationService = class extends cordis.Service {
			/** The per-session input machine registry (InputService face, design §5.2). */
			input;
			/**
			* @param ctx - owning root context (the plugin apply context; the service
			* registers itself and follows that fiber's lifetime).
			* @param config - carries the InputService instance constructed by the
			* plugin apply (the same InputHub the slot inject factories close over).
			*/
			constructor(ctx, config) {
				super(ctx, "conversation");
				this.input = config.input;
			}
			/**
			* Send a prompt into the scoped session. Business failures also land in the
			* session snapshot's promptError (object-layer surface); the rejection here
			* exists for caller choreography (the composer restores the draft on it).
			* @param text - prompt text, sent verbatim as one text block.
			*/
			async send(text) {
				const result = await this.scopedSession("send").prompt([{
					type: "text",
					text
				}], "queue");
				if (!result.ok) throw new Error(`conversation.send failed: ${result.error.code}: ${result.error.message}`);
			}
			/** Apply one operation to a pending queue occurrence. */
			async updateQueue(itemId, action) {
				const result = await this.scopedSession("updateQueue").updateQueue(itemId, action);
				if (!result.ok) {
					if (action.kind === "steer" && (result.error.code === "steer-unavailable" || result.error.code === "queue-item-not-found")) return;
					throw new Error(`conversation.updateQueue failed: ${result.error.code}: ${result.error.message}`);
				}
			}
			/** Cancel the scoped session's in-flight turn while preserving Queue (failures land in promptError and reject, as in send). */
			async cancel() {
				const result = await this.scopedSession("cancel").cancel();
				if (!result.ok) throw new Error(`conversation.cancel failed: ${result.error.code}: ${result.error.message}`);
			}
			/** Pull one older history page for the scoped Session. */
			async loadOlder() {
				await this.scopedSession("loadOlder").loadOlder();
			}
			/** Resolve the caller scope's session face or throw on root contexts. */
			scopedSession(op) {
				const id = this.scopeId(op);
				const binding = this.requireSessions().binding(id);
				if (binding === void 0) throw new Error(`conversation.${op}: session "${id}" resolved no binding`);
				return binding.session;
			}
			/** Read the caller's session scope tag via the sessions service; root contexts fail loud. */
			scopeId(op) {
				const id = this.requireSessions().scopeOf(this.ctx);
				if (id === void 0) throw new Error(`conversation.${op} requires a session scope — address one via ctx.sessions.scope(id).conversation`);
				return id;
			}
			requireSessions() {
				const sessions = this.ctx.get("sessions");
				if (sessions === void 0) throw new Error("conversation: sessions service unavailable");
				return sessions;
			}
		};
		//#endregion
		//#region src/client/queue/store.ts
		/**
		* Project a session's transient inbox rows as a bare observable (subscribe/getSnapshot).
		* The wiring layer (T5) overlays this onto InputState.queue; the runtime
		* QueuedMessage and the input-contract QueuedMessage are structurally
		* identical.
		* @param session - the resident session face.
		* @returns the queue read face (snapshot reference stable while the queue is unchanged).
		*/
		function queueReadFaceOf(session) {
			return {
				getSnapshot: () => session.getSnapshot().queue,
				subscribe: (fn) => session.subscribe(fn)
			};
		}
		/** The machine never writes the queue; the wiring layer overlays the T9 store projection. */
		const EMPTY_QUEUE$1 = [];
		/** Undo ring depth (design §9.1: bounded self-managed transaction log). */
		const LOG_LIMIT = 100;
		/** Exhaustiveness backstop for the closed InputEvent / guard unions. */
		function unreachable(value) {
			throw new Error(`unreachable input event: ${JSON.stringify(value)}`);
		}
		/**
		* Strip the claim token off a draft to yield submit args. Leading whitespace
		* (incl. newlines — leading-trigger trim) is tolerated; a bare `/name`
		* missing the token's trailing separator yields empty args. Exactly one
		* separator char is consumed; the remainder — newlines included — stays
		* verbatim (`/goal x\ny` → `x\ny`).
		*/
		function argsAfter(draft, token) {
			const s = draft.trimStart();
			if (s.startsWith(token)) return s.slice(token.length);
			const base = token.trimEnd();
			if (s.startsWith(base)) {
				const rest = s.slice(base.length);
				return /^\s/.test(rest) ? rest.slice(1) : rest;
			}
			return "";
		}
		/**
		* Prefix/suffix common-scan recovering the edit range between two drafts
		* (used when the wiring layer cannot supply one from the DOM event).
		*/
		function diffEdit(prev, next) {
			let p = 0;
			const maxCommon = Math.min(prev.length, next.length);
			while (p < maxCommon && prev[p] === next[p]) p += 1;
			let s = 0;
			const maxSuffix = maxCommon - p;
			while (s < maxSuffix && prev[prev.length - 1 - s] === next[next.length - 1 - s]) s += 1;
			return {
				start: p,
				end: prev.length - s,
				insertedLength: next.length - s - p
			};
		}
		/**
		* Pure input machine, one instance per session (per-session isolation is by
		* construction). The machine constructs one AbortController per SubmitAttempt
		* at enter time and aborts it itself on release; the shell never aborts, it
		* only observes attempt.signal on its adjudicate/submit promises. Stale
		* attempts (any adjudicated / adjudication-failed / submit-settled whose seq
		* is not the in-flight one) are dropped: same state, zero effects.
		*/
		var InputMachine = class {
			draft = "";
			draftRev = 0;
			phase = "plain";
			claim;
			occurrences = [];
			occurrenceSeq = 0;
			seq = 0;
			inflight;
			log = [];
			redoStack = [];
			/** Open single-char typing run: the next contiguous char within the window coalesces. */
			typingRun;
			paste;
			pasteSeq = 0;
			mergeWindowMs;
			now;
			constructor(options = {}) {
				this.mergeWindowMs = options.mergeWindowMs ?? 1e3;
				this.now = options.now ?? (() => 0);
			}
			/** Read-only snapshot of the machine state (queue always empty at this tier). */
			get state() {
				const c = this.claim;
				return {
					draft: this.draft,
					draftRev: this.draftRev,
					phase: this.phase,
					...c ? { claim: {
						token: c.token,
						...c.hint !== void 0 ? { hint: c.hint } : {}
					} } : {},
					occurrences: this.occurrences,
					...this.paste !== void 0 ? { paste: this.paste } : {},
					queue: EMPTY_QUEUE$1
				};
			}
			/**
			* Feed one event through the machine.
			* @param ev - Input event; the single write path for all input state.
			* @returns Effects for the shell to execute in order; empty on no-ops, locks, and dropped stale events.
			*/
			dispatch(ev) {
				switch (ev.type) {
					case "draft-changed": return this.onDraftChanged(ev.draft, ev.editRange);
					case "begin-command": return this.onBeginCommand(ev.claim, ev.span);
					case "insert-ref": return this.onInsertRef(ev.reference, ev.span);
					case "consume-token": return this.onConsumeToken(ev.guard);
					case "set-invalid": return this.onSetInvalid(ev.invalidIds);
					case "undo": return this.onUndo();
					case "redo": return this.onRedo();
					case "paste-begin": return this.onPasteBegin(ev.text, ev.selection, ev.components, ev.generation);
					case "paste-upgrade": return this.onPasteUpgrade(ev.attemptId, ev.span, ev.reference);
					case "invalidate-paste":
						this.paste = void 0;
						return [];
					case "enter": return this.onEnter(ev.mode);
					case "adjudicated": return this.onAdjudicated(ev.attempt, ev.outcome);
					case "adjudication-failed": return this.onAdjudicationFailed(ev.attempt, ev.message);
					case "submit-settled": return this.onSubmitSettled(ev);
					case "send-committed": return this.onSendCommitted();
					case "release": return this.onRelease();
					default: return unreachable(ev);
				}
			}
			/** Adopt a new draft: bump the revision (the span-CAS invalidation point). */
			adopt(draft) {
				this.draft = draft;
				this.draftRev += 1;
			}
			/** Push one undo unit (before-state), trim the ring, and cut the redo chain. */
			pushTxn(selectionBefore) {
				this.log.push({
					draftBefore: this.draft,
					occurrencesBefore: this.occurrences,
					...selectionBefore !== void 0 ? { selectionBefore } : {}
				});
				if (this.log.length > LOG_LIMIT) this.log.shift();
				this.redoStack = [];
			}
			/**
			* Reconcile the occurrence table with one edit (old-draft coordinates):
			* entries past the range shift by the length delta; entries whose
			* placeholder sits inside the replaced range go away whole (design §9.1: a
			* deletion/replacement intersecting a placeholder acts on the whole chip).
			*/
			reconcile(range) {
				const delta = range.insertedLength - (range.end - range.start);
				const kept = [];
				for (const o of this.occurrences) if (o.offset < range.start) kept.push(o);
				else if (o.offset >= range.end) kept.push(delta === 0 ? o : {
					...o,
					offset: o.offset + delta
				});
				this.occurrences = kept;
			}
			/** Claimed integrity watch: any mutation that breaks the token prefix releases the claim. */
			watchClaim() {
				if (this.phase === "claimed" && this.claim !== void 0 && !this.draft.startsWith(this.claim.token)) {
					this.phase = "plain";
					this.claim = void 0;
				}
			}
			/** Mint one occurrence at a draft offset. */
			mint(reference, offset) {
				this.occurrenceSeq += 1;
				return {
					occurrenceId: this.occurrenceSeq,
					source: reference.source,
					ref: reference.ref,
					offset,
					label: reference.label,
					clipboardText: reference.clipboardText
				};
			}
			/** Splice minted entries into the offset-sorted table. */
			withMinted(minted) {
				if (minted.length === 0) return;
				this.occurrences = [...this.occurrences, ...minted].sort((a, b) => {
					return a.offset - b.offset;
				});
			}
			onDraftChanged(draft, editRange) {
				if (draft === this.draft) return [];
				const range = editRange ?? diffEdit(this.draft, draft);
				const typing = range.start === range.end && range.insertedLength === 1;
				const at = this.now();
				const run = this.typingRun;
				if (!(typing && run !== void 0 && run.end === range.start && at - run.at <= this.mergeWindowMs)) this.pushTxn({
					start: range.start,
					end: range.end
				});
				this.typingRun = typing ? {
					end: range.start + 1,
					at
				} : void 0;
				this.reconcile(range);
				this.adopt(draft);
				this.watchClaim();
				this.paste = void 0;
				return [];
			}
			/** Span CAS: revision equality (content identity follows) plus bounds sanity. */
			casOk(span) {
				return span.draftRev === this.draftRev && span.start >= 0 && span.start <= span.end && span.end <= this.draft.length;
			}
			onBeginCommand(claim, span) {
				if (this.phase !== "plain" && this.phase !== "claimed") return [];
				if (!this.casOk(span) || this.draft.slice(0, span.start).trim() !== "") return [];
				this.pushTxn();
				this.typingRun = void 0;
				this.reconcile({
					start: 0,
					end: span.end,
					insertedLength: claim.token.length
				});
				this.adopt(claim.token + this.draft.slice(span.end));
				this.claim = claim;
				this.phase = "claimed";
				this.paste = void 0;
				return [];
			}
			onInsertRef(reference, span) {
				if (this.phase !== "plain" && this.phase !== "claimed") return [];
				if (!this.casOk(span)) return [];
				this.replaceSpanWithChip(reference, span);
				this.paste = void 0;
				return [];
			}
			/**
			* Shared chip-insertion transaction: replace [span) with one placeholder
			* occurrence (insert-ref and paste-upgrade both land here). A separating
			* space follows the chip unless one is already next.
			* @returns the inserted length (placeholder plus optional gap).
			*/
			replaceSpanWithChip(reference, span) {
				this.pushTxn();
				this.typingRun = void 0;
				const tail = this.draft.slice(span.end);
				const inserted = "￼" + (tail.length === 0 || tail[0] !== " " ? " " : "");
				this.reconcile({
					start: span.start,
					end: span.end,
					insertedLength: inserted.length
				});
				this.withMinted([this.mint(reference, span.start)]);
				this.adopt(this.draft.slice(0, span.start) + inserted + tail);
				this.watchClaim();
				return inserted.length;
			}
			/**
			* Guarded token deletion after business success (popup settle / menu-pick
			* execute). No effect signals success: the caller reads the draftRev
			* advance off the published state (same currency as the other bail verbs).
			*/
			onConsumeToken(guard) {
				if (this.phase !== "plain" && this.phase !== "claimed") return [];
				switch (guard.kind) {
					case "span": {
						const span = guard.span;
						if (!this.casOk(span) || span.start === span.end) return [];
						this.pushTxn();
						this.typingRun = void 0;
						this.reconcile({
							start: span.start,
							end: span.end,
							insertedLength: 0
						});
						this.adopt(this.draft.slice(0, span.start) + this.draft.slice(span.end));
						this.watchClaim();
						this.paste = void 0;
						return [];
					}
					case "bare-token":
						if (guard.token === "" || this.draft.trim() !== guard.token) return [];
						this.pushTxn();
						this.typingRun = void 0;
						this.occurrences = [];
						this.adopt("");
						this.watchClaim();
						this.paste = void 0;
						return [];
					default: return unreachable(guard);
				}
			}
			/**
			* Owner-resolution style bits: exactly the listed occurrences render
			* invalid. Not a transaction — the draft, revision, and undo log are
			* untouched (design §9.1: invalidation never deletes or rewrites chips).
			*/
			onSetInvalid(invalidIds) {
				const ids = new Set(invalidIds);
				if (!this.occurrences.some((o) => o.invalid === true !== ids.has(o.occurrenceId))) return [];
				this.occurrences = this.occurrences.map((o) => {
					const invalid = ids.has(o.occurrenceId);
					if (o.invalid === true === invalid) return o;
					const { invalid: _drop, ...rest } = o;
					return invalid ? {
						...rest,
						invalid: true
					} : rest;
				});
				return [];
			}
			onUndo() {
				const entry = this.log.pop();
				if (entry === void 0) return [];
				this.redoStack.push({
					draftBefore: this.draft,
					occurrencesBefore: this.occurrences
				});
				this.occurrences = entry.occurrencesBefore;
				this.adopt(entry.draftBefore);
				this.watchClaim();
				this.typingRun = void 0;
				this.paste = void 0;
				return [];
			}
			onRedo() {
				const entry = this.redoStack.pop();
				if (entry === void 0) return [];
				this.log.push({
					draftBefore: this.draft,
					occurrencesBefore: this.occurrences
				});
				if (this.log.length > LOG_LIMIT) this.log.shift();
				this.occurrences = entry.occurrencesBefore;
				this.adopt(entry.draftBefore);
				this.watchClaim();
				this.typingRun = void 0;
				this.paste = void 0;
				return [];
			}
			/**
			* Paste as one transaction: the text (U+FFFC-sanitized) replaces the
			* selection; hot-snapshot sync matches componentize inside the SAME
			* transaction (one undo returns to pre-paste); a match attempt opens for
			* the async remainder while the phase still accepts reference mutations.
			*/
			onPasteBegin(rawText, selection, components = [], generation = 0) {
				const { start, end } = selection;
				if (start < 0 || start > end || end > this.draft.length) return [];
				const text = rawText.split("￼").join("");
				this.pushTxn(selection);
				this.typingRun = void 0;
				const sorted = [...components].sort((a, b) => a.start - b.start);
				const minted = [];
				let inserted = "";
				let cursor = 0;
				for (const c of sorted) {
					inserted += text.slice(cursor, c.start);
					minted.push(this.mint(c.reference, start + inserted.length));
					inserted += "￼";
					cursor = c.end;
				}
				inserted += text.slice(cursor);
				this.reconcile({
					start,
					end,
					insertedLength: inserted.length
				});
				this.withMinted(minted);
				this.adopt(this.draft.slice(0, start) + inserted + this.draft.slice(end));
				this.watchClaim();
				if (this.phase === "plain" || this.phase === "claimed") {
					this.pasteSeq += 1;
					this.paste = {
						attemptId: this.pasteSeq,
						insertedRange: {
							start,
							end: start + inserted.length
						},
						generation
					};
				} else this.paste = void 0;
				return [];
			}
			/**
			* Async match landed: upgrade one pasted token to a chip as an INDEPENDENT
			* transaction (undo #1 → the token text, undo #2 → pre-paste). The attempt
			* stays current — later tokens re-CAS against the advanced draftRev.
			*/
			onPasteUpgrade(attemptId, span, reference) {
				const attempt = this.paste;
				if (attempt === void 0 || attempt.attemptId !== attemptId) return [];
				if (this.phase !== "plain" && this.phase !== "claimed") return [];
				if (!this.casOk(span) || span.start === span.end) return [];
				const insertedLength = this.replaceSpanWithChip(reference, span);
				this.paste = {
					...attempt,
					insertedRange: {
						start: attempt.insertedRange.start,
						end: attempt.insertedRange.end + insertedLength - (span.end - span.start)
					}
				};
				return [];
			}
			/** Mint the next SubmitAttempt and take the in-flight slot. */
			beginAttempt(mode) {
				const controller = new AbortController();
				this.seq += 1;
				const attempt = {
					seq: this.seq,
					signal: controller.signal,
					draftSnapshot: this.draft,
					mode
				};
				this.inflight = {
					attempt,
					controller
				};
				return attempt;
			}
			onEnter(mode) {
				if (this.phase === "adjudicating" || this.phase === "submitting") return [];
				if (this.phase === "claimed" && this.claim !== void 0) {
					const attempt = this.beginAttempt(mode);
					this.phase = "submitting";
					this.paste = void 0;
					return [{
						type: "begin-submit",
						attempt,
						claim: this.claim,
						args: argsAfter(this.draft, this.claim.token)
					}];
				}
				const trimmed = this.draft.trim();
				if (trimmed === "") return [];
				this.paste = void 0;
				if (trimmed.startsWith("/")) {
					const attempt = this.beginAttempt(mode);
					this.phase = "adjudicating";
					return [{
						type: "adjudicate",
						attempt,
						draft: this.draft
					}];
				}
				return [{
					type: "default-sink",
					draft: this.draft,
					mode
				}];
			}
			onAdjudicated(attempt, outcome) {
				const flight = this.inflight;
				if (this.phase !== "adjudicating" || flight === void 0 || flight.attempt.seq !== attempt.seq) return [];
				if (outcome !== void 0 && outcome !== "handled" && "claim" in outcome) {
					this.claim = outcome.claim;
					this.phase = "submitting";
					return [{
						type: "begin-submit",
						attempt,
						claim: outcome.claim,
						args: argsAfter(attempt.draftSnapshot, outcome.claim.token)
					}];
				}
				this.inflight = void 0;
				this.phase = "plain";
				return outcome === void 0 ? [{
					type: "default-sink",
					draft: attempt.draftSnapshot,
					mode: attempt.mode
				}] : [];
			}
			onAdjudicationFailed(attempt, message) {
				if (this.phase !== "adjudicating" || this.inflight?.attempt.seq !== attempt.seq) return [];
				this.inflight = void 0;
				this.phase = "plain";
				return [{
					type: "notice",
					level: "error",
					text: message
				}];
			}
			onSubmitSettled(ev) {
				const flight = this.inflight;
				if (this.phase !== "submitting" || flight === void 0 || flight.attempt.seq !== ev.attempt.seq) return [];
				this.inflight = void 0;
				if (ev.ok) {
					this.phase = "plain";
					this.claim = void 0;
					this.occurrences = [];
					this.adopt("");
					this.log = [];
					this.redoStack = [];
					this.typingRun = void 0;
					this.paste = void 0;
					return ev.outcome?.text !== void 0 ? [{
						type: "notice",
						level: ev.outcome.kind === "error" ? "error" : "info",
						text: ev.outcome.text
					}] : [];
				}
				const text = ev.message ?? ev.outcome?.text ?? "command failed";
				if (this.draft === flight.attempt.draftSnapshot && this.claim !== void 0 && this.draft.startsWith(this.claim.token)) {
					this.phase = "claimed";
					return [{
						type: "notice",
						level: "error",
						text
					}];
				}
				this.phase = "plain";
				this.claim = void 0;
				return [{
					type: "notice",
					level: "error",
					text
				}];
			}
			/** Ordinary send accepted: clear as a commit (no undo unit; sent content
			*  must not be resurrectable — same discipline as submit-settled success). */
			onSendCommitted() {
				this.claim = void 0;
				this.occurrences = [];
				this.adopt("");
				this.log = [];
				this.redoStack = [];
				this.typingRun = void 0;
				this.paste = void 0;
				return [];
			}
			onRelease() {
				if (this.inflight !== void 0) {
					this.inflight.controller.abort();
					this.inflight = void 0;
				}
				this.phase = "plain";
				this.claim = void 0;
				this.typingRun = void 0;
				this.paste = void 0;
				return [];
			}
		};
		//#endregion
		//#region src/client/input/facade.ts
		/** Guard tier from the machine phase. */
		function guardOf(phase) {
			switch (phase) {
				case "plain": return "plain";
				case "claimed": return "claimed";
				default: return "frozen";
			}
		}
		const EMPTY_QUEUE = [];
		/** No-pipeline lexicon: zero text-ref decorations. */
		const EMPTY_LEXICON$2 = /* @__PURE__ */ new Map();
		/**
		* The per-session input facade: scoped-event application verbs +
		* setDraft/submit + the published InputState store.
		*/
		var SessionInputShell = class {
			deps;
			/** Published machine state + queue overlay (the InputZone currency source). */
			state;
			/** Latest surfaced notice (null after clear); the wiring renders it beside the error strip. */
			notices = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(null);
			/** The public provide-channel action face (one stable identity per session — decision 20). */
			actions = {
				setDraft: (text) => {
					this.setDraft(text);
				},
				submit: () => {
					this.submit("queue");
				}
			};
			core = new InputMachine({ now: () => Date.now() });
			noticeSeq = 0;
			lastDraft = "";
			disposed = false;
			/** Draft persistence mirror (chat store write; receives the clipboard projection, never raw placeholders). */
			mirrorFn;
			constructor(deps) {
				this.deps = deps;
				this.state = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(this.compose());
				deps.queue?.subscribe(() => {
					this.publish();
				});
			}
			/**
			* Single draft write path (all mutation rides machine events).
			* @param text - the full next draft.
			* @param editRange - the DOM-observed edit shape, when the caller knows it
			* (narrows the machine's occurrence math; absent → diff scan).
			*/
			setDraft(text, editRange) {
				this.run(this.core.dispatch({
					type: "draft-changed",
					draft: text,
					...editRange !== void 0 ? { editRange } : {}
				}));
			}
			/**
			* Clear the draft as a successful-send commit: no undo unit is recorded and
			* the undo history is cut, so Ctrl/Cmd-Z cannot resurrect sent content
			* (the command path gets the same discipline from submit-settled success).
			*/
			commitSend() {
				this.run(this.core.dispatch({ type: "send-committed" }));
			}
			/** Undo the latest transaction (InputBar intercepts the platform chord). */
			undo() {
				this.run(this.core.dispatch({ type: "undo" }));
			}
			/** Redo the latest undone transaction. */
			redo() {
				this.run(this.core.dispatch({ type: "redo" }));
			}
			/**
			* Paste text over the selection in one transaction, with any hot-snapshot
			* sync matches componentized inside it.
			* @param text - pasted plain text.
			* @param selection - replaced selection in draft coordinates.
			* @param components - sync-matched reference components (disjoint, inside `text`).
			* @param generation - projection generation for late async-upgrade guards.
			*/
			pasteBegin(text, selection, components, generation) {
				this.run(this.core.dispatch({
					type: "paste-begin",
					text,
					selection,
					...components !== void 0 ? { components } : {},
					...generation !== void 0 ? { generation } : {}
				}));
			}
			/** End the live paste-match attempt (caret/selection ops and Slash updates the machine cannot see). */
			invalidatePaste() {
				this.run(this.core.dispatch({ type: "invalidate-paste" }));
			}
			/**
			* Enter adjudication + submit transaction + default sink. Effects fan out
			* from the machine; this method only feeds the event. Lock entry
			* (adjudicating/submitting) force-closes the transient layers: the popup
			* dismisses and the menu tracks frozen.
			*/
			submit(mode = "queue") {
				this.run(this.core.dispatch({
					type: "enter",
					mode
				}));
				const phase = this.snapshot.phase;
				if (phase === "adjudicating" || phase === "submitting") {
					this.deps.popup?.()?.dismiss();
					this.deps.slash?.()?.track(this.snapshot.draft, 0, { tier: "frozen" }, this.snapshot.draftRev);
				}
			}
			/**
			* Feed a draft/caret change through trigger detection (guard derived from
			* the machine phase).
			* @param draft - live draft text.
			* @param caret - caret position in draft coordinates.
			*/
			track(draft, caret) {
				this.deps.slash?.()?.track(draft, caret, { tier: guardOf(this.snapshot.phase) }, this.snapshot.draftRev);
			}
			/**
			* Keyboard arbitration while the menu is open.
			* @param key - the intercepted key.
			* @param composing - IME composition guard state.
			* @returns the menu's verdict; 'pass' when no pipeline is mounted.
			*/
			arbitrate(key, composing) {
				return this.deps.slash?.()?.arbitrate(key, composing) ?? "pass";
			}
			/**
			* Space adjudication over the controller's hot state.
			* @returns true = a claim/insert was applied — the caller preventDefaults.
			*/
			space() {
				const slash = this.deps.slash?.();
				if (slash === void 0) return false;
				const consumed = slash.onSpace();
				if (consumed) {
					const next = this.snapshot;
					slash.track(next.draft, next.draft.length, { tier: guardOf(next.phase) }, next.draftRev);
				}
				return consumed;
			}
			/** Dismiss the popupSelect shell (any interaction outside the box). */
			dismissPopup() {
				this.deps.popup?.()?.dismiss();
			}
			/**
			* Hot plain-text reference lexicon source for the decoration scan
			* (decision 21): delegates to the controller's aggregated store. Stable
			* identity per shell; without a pipeline the snapshot is the empty Map and
			* subscribers never fire.
			*/
			lexicon = {
				getSnapshot: () => this.deps.slash?.()?.lexicon.getSnapshot() ?? EMPTY_LEXICON$2,
				subscribe: (fn) => this.deps.slash?.()?.lexicon.subscribe(fn) ?? (() => {})
			};
			/**
			* Apply one command claim (scoped begin-command event listener body).
			* @param claim - the command claim from the pick path.
			* @param span - pick-time span snapshot.
			* @returns whether the machine accepted (phase + span CAS passed and the draft mutated).
			*/
			beginCommand(claim, span) {
				const before = this.core.state.draftRev;
				this.run(this.core.dispatch({
					type: "begin-command",
					claim,
					span
				}));
				return this.core.state.phase === "claimed" && this.core.state.draftRev !== before;
			}
			/**
			* Apply one reference insertion (scoped insert-reference event listener body).
			* @param ref - the reference insertion from the pick path.
			* @param span - pick-time span snapshot.
			* @returns whether the machine accepted.
			*/
			insertReference(ref, span) {
				const before = this.core.state.draftRev;
				this.run(this.core.dispatch({
					type: "insert-ref",
					reference: ref,
					span
				}));
				return this.core.state.draftRev !== before;
			}
			/**
			* Consume one command token after business success (scoped consume-token
			* event listener body). Span guard: revision CAS then splice; bare-token
			* guard: trimmed-draft equality then clear.
			* @param guard - exact span or bare-token guard.
			* @returns whether the token was consumed.
			*/
			consumeToken(guard) {
				const snapshot = this.core.state;
				if (guard.kind === "span") {
					if (guard.span.draftRev !== snapshot.draftRev) return false;
					const draft = snapshot.draft;
					this.setDraft(draft.slice(0, guard.span.start) + draft.slice(guard.span.end));
					return true;
				}
				if (snapshot.draft.trim() !== guard.token) return false;
				this.setDraft("");
				return true;
			}
			/**
			* Insert plain reference text over the pick-time span (scoped insert-text
			* event listener body, decision 21). Same CAS-then-splice shape as the
			* consume-token span branch: the machine sees an ordinary draft-changed
			* transaction (one undo step), no occurrence is minted — the chip look is
			* a scan-derived decoration, never state.
			* @param text - the plain reference text to splice in (e.g. `/name `).
			* @param span - pick-time span snapshot (draftRev CAS).
			* @returns whether the text was applied.
			*/
			insertText(text, span) {
				const snapshot = this.core.state;
				if (span.draftRev !== snapshot.draftRev) return false;
				const draft = snapshot.draft;
				this.setDraft(draft.slice(0, span.start) + text + draft.slice(span.end));
				return true;
			}
			/**
			* Surface a notice from outside the machine (detached command results).
			* @param level - severity tier.
			* @param text - notice body.
			*/
			notify(level, text) {
				this.noticeSeq += 1;
				this.notices.set({
					level,
					text,
					seq: this.noticeSeq
				});
			}
			/** Teardown: abort any in-flight attempt and stop accepting async settlements. */
			dispose() {
				this.disposed = true;
				this.run(this.core.dispatch({ type: "release" }));
			}
			/** Read the live machine state (guard derivation reads here). */
			get snapshot() {
				return this.state.getSnapshot();
			}
			/**
			* Bind the draft persistence mirror (chat store write). Adopt-on-bind: the
			* store draft may hold a persisted value from a previous mount; the caller
			* seeds it via setDraft BEFORE binding, and afterwards every machine-adopted
			* draft mirrors out.
			* @param write - store draft write.
			* @returns the unbind disposer.
			*/
			bindMirror(write) {
				this.mirrorFn = write;
				return () => {
					if (this.mirrorFn === write) this.mirrorFn = void 0;
				};
			}
			run(effects) {
				for (const fx of effects) this.execute(fx);
				this.publish();
			}
			execute(fx) {
				switch (fx.type) {
					case "notice":
						this.noticeSeq += 1;
						this.notices.set({
							level: fx.level,
							text: fx.text,
							seq: this.noticeSeq
						});
						return;
					case "adjudicate":
						this.adjudicate(fx.attempt, fx.draft);
						return;
					case "begin-submit":
						this.beginSubmit(fx.attempt, fx.claim, fx.args);
						return;
					case "default-sink":
						this.sinkSerialized(fx.draft, fx.mode);
						return;
					default: return;
				}
			}
			/**
			* Prompt serialization before the sink (design §3.12): expand each
			* placeholder to its owner's model form via the session controller's
			* codec routing. Owner missing / serialize failure / disposal blocks the
			* send — notice + draft and chips retained, never a silent downgrade to
			* the clipboard text. Chip-free drafts skip the async detour.
			*/
			sinkSerialized(draft, mode) {
				const occurrences = this.core.state.occurrences;
				if (occurrences.length === 0) {
					this.deps.defaultSink(draft.trim(), mode);
					return;
				}
				const slash = this.deps.slash?.();
				const controller = new AbortController();
				Promise.all(occurrences.map(async (o) => {
					if (slash === void 0) throw new Error(`no serializer for reference source "${o.source}"`);
					return {
						offset: o.offset,
						text: await slash.serializeReference(o.source, o.ref, controller.signal)
					};
				})).then((parts) => {
					if (this.disposed) return;
					let out = "";
					let cursor = 0;
					for (const part of parts) {
						out += draft.slice(cursor, part.offset) + part.text;
						cursor = part.offset + 1;
					}
					out += draft.slice(cursor);
					this.deps.defaultSink(out.trim(), mode);
				}, (error) => {
					controller.abort();
					if (this.disposed) return;
					const message = error instanceof Error ? error.message : String(error);
					this.notify("error", message);
				});
			}
			/** Enter adjudication: poll the session controller; failure = notice + draft retained (never a silent downgrade). */
			adjudicate(attempt, draft) {
				const slash = this.deps.slash?.();
				if (slash === void 0) {
					this.run(this.core.dispatch({
						type: "adjudicated",
						attempt,
						outcome: void 0
					}));
					return;
				}
				slash.adjudicate(draft.trim(), attempt.signal).then((outcome) => {
					if (this.dead(attempt)) return;
					this.run(this.core.dispatch({
						type: "adjudicated",
						attempt,
						outcome
					}));
				}, (error) => {
					if (this.dead(attempt)) return;
					const message = error instanceof Error ? error.message : String(error);
					this.run(this.core.dispatch({
						type: "adjudication-failed",
						attempt,
						message
					}));
				});
			}
			/** The submit transaction: claim.submit against the session scope; ok maps from the outcome kind. */
			beginSubmit(attempt, claim, args) {
				Promise.resolve().then(() => claim.submit(args, this.deps.actx)).then((outcome) => {
					if (this.dead(attempt)) return;
					this.run(this.core.dispatch({
						type: "submit-settled",
						attempt,
						ok: outcome.kind === "success",
						outcome
					}));
				}, (error) => {
					if (this.dead(attempt)) return;
					const message = error instanceof Error ? error.message : String(error);
					this.run(this.core.dispatch({
						type: "submit-settled",
						attempt,
						ok: false,
						message
					}));
				});
			}
			/** Late-settlement guard: superseded attempts and disposed facades drop silently. */
			dead(attempt) {
				return this.disposed || attempt.signal.aborted;
			}
			compose() {
				return {
					...this.core.state,
					queue: this.deps.queue?.getSnapshot() ?? EMPTY_QUEUE
				};
			}
			publish() {
				const next = this.compose();
				this.state.set(next);
				if (next.draft !== this.lastDraft) {
					this.lastDraft = next.draft;
					this.mirrorFn?.(next.draft);
				}
			}
		};
		//#endregion
		//#region src/client/input/hub.ts
		/** Session-addressed input facade registry (InputService face + composer-layer extras). */
		var InputHub = class {
			rootCtx;
			shells = /* @__PURE__ */ new Map();
			/** @param ctx - client root context (services resolved lazily per call — boot order stays free). */
			constructor(rootCtx) {
				this.rootCtx = rootCtx;
			}
			/**
			* Resolve the facade for one session-scope ctx (InputService face).
			* @param actx - session-scope context.
			* @returns the resident per-session facade.
			*/
			for(actx) {
				const id = this.sessions().scopeOf(actx);
				if (id === void 0) throw new Error("conversation.input.for requires a session scope");
				return this.shell(id);
			}
			/**
			* Resident shell for one session binding — the provide-channel entry
			* (called during scope materialization, BEFORE the scope record is
			* queryable, hence binding-fed and hence the thunked slash/popup deps).
			* Wires the scoped event listeners + teardown into the session scope.
			* @param binding - session assembly handle.
			* @returns the shell.
			*/
			shellFor(binding) {
				const existing = this.shells.get(binding.sessionId);
				if (existing !== void 0) return existing;
				const { sessionId: id, session, ctx: actx } = binding;
				const shell = new SessionInputShell({
					actx,
					slash: () => this.controller(actx),
					popup: () => this.popup(actx),
					queue: queueReadFaceOf(session),
					defaultSink: (text, mode) => {
						this.sink(session, text, mode);
					}
				});
				this.shells.set(id, shell);
				actx.effect(() => {
					const offs = [
						actx.on("slash/input-begin-command", (req) => shell.beginCommand(req.claim, req.span) ? true : void 0),
						actx.on("slash/input-insert-reference", (req) => shell.insertReference(req.reference, req.span) ? true : void 0),
						actx.on("slash/input-consume-token", (req) => shell.consumeToken(req.guard) ? true : void 0),
						actx.on("slash/input-insert-text", (req) => shell.insertText(req.text, req.span) ? true : void 0)
					];
					return () => {
						for (const off of offs) off();
						shell.dispose();
						this.shells.delete(id);
					};
				}, "conversation.input: session shell");
				return shell;
			}
			/**
			* Resident shell by session id (service-face path; the provide channel has
			* normally created it already — this covers direct id-addressed access).
			* @param id - session id.
			* @returns the shell.
			*/
			shell(id) {
				const existing = this.shells.get(id);
				if (existing !== void 0) return existing;
				const binding = this.sessions().binding(id);
				if (binding === void 0) throw new Error(`conversation.input: session "${id}" resolved no binding`);
				return this.shellFor(binding);
			}
			/**
			* The InputBar-exclusive keyboard command face (decision 20): the shell
			* satisfies it structurally; package-internal — handed through the
			* composer-bar entry's inject, never across a plugin boundary.
			* @param id - session id.
			* @returns the shell as the keyboard face.
			*/
			keyboard(id) {
				return this.shell(id);
			}
			/**
			* Resolve the optional slash controller for composer chrome that launches
			* the shared candidate menu without typing a trigger.
			* @param id - session id.
			* @returns the resident controller, or undefined when ui-slash is absent.
			*/
			slash(id) {
				const actx = this.sessions().scope(id);
				return actx === void 0 ? void 0 : this.controller(actx);
			}
			/**
			* Default sink: optimistic clear + prompt. The session is always a real
			* host entity (materialized when its workspace was picked), so there is
			* exactly one path; a failed first prompt is an ordinary prompt failure
			* (error strip via promptError, draft restored only while untouched).
			*/
			sink(session, text, mode) {
				if (text === "") return;
				const shell = this.shells.get(session.sessionId);
				shell?.commitSend();
				session.prompt([{
					type: "text",
					text
				}], mode).then((result) => {
					if (!result.ok && shell?.snapshot.draft === "") shell.setDraft(text);
				}, () => {
					if (shell?.snapshot.draft === "") shell.setDraft(text);
				});
			}
			controller(actx) {
				return this.rootCtx.get("slash")?.sessionOf(actx);
			}
			popup(actx) {
				return this.rootCtx.get("command")?.popupFor(actx);
			}
			sessions() {
				const sessions = this.rootCtx.get("sessions");
				if (sessions === void 0) throw new Error("conversation.input: sessions service unavailable");
				return sessions;
			}
		};
		//#endregion
		//#region src/client/input/submission-policy.ts
		/**
		* Browser-local Composer submission policy. It owns the persisted busy-Enter
		* preference and resolves keyboard gestures into queue/steer delivery modes;
		* Host and Agent keep the actual delivery-window authority.
		*/
		/** localStorage key holding the busy-Enter preference. */
		const BUSY_ENTER_STORAGE_KEY = "dsh.conversation.busyEnter";
		/** Default preserves Enter-as-Queue for running conversations. */
		const DEFAULT_BUSY_ENTER_BEHAVIOR = "queue";
		/**
		* Persisted policy used by both the composer inject face and its Settings row.
		* Direct `steer` is intentionally best-effort: AgentLoop turns a closed-window
		* submission into the next waking Queue item.
		*/
		var ComposerSubmissionPolicy = class {
			/** Reactive preference source for the Settings row. */
			busyEnter = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(restoreBusyEnter());
			/**
			* Resolve one keyboard gesture without changing state.
			* @param running - whether the addressed agent currently reports busy.
			* @param gesture - plain Enter or the Cmd/Ctrl-accelerated chord.
			* @param steeringAvailable - whether this session transport supports steering.
			* @returns Queue outside steer-capable busy state; otherwise the preferred mode or its opposite.
			*/
			resolve(running, gesture, steeringAvailable) {
				if (!running || !steeringAvailable) return "queue";
				const preferred = this.busyEnter.getSnapshot();
				if (gesture === "enter") return preferred;
				return preferred === "queue" ? "steer" : "queue";
			}
			/**
			* Change and persist the plain-Enter behavior used during busy state.
			* @param behavior - Queue or Steer.
			*/
			setBusyEnter(behavior) {
				if (this.busyEnter.getSnapshot() === behavior) return;
				this.busyEnter.set(behavior);
				persistBusyEnter(behavior);
			}
		};
		/** Restore a valid preference; unavailable or corrupt storage uses Queue. */
		function restoreBusyEnter() {
			if (typeof localStorage === "undefined") return DEFAULT_BUSY_ENTER_BEHAVIOR;
			let stored;
			try {
				stored = localStorage.getItem(BUSY_ENTER_STORAGE_KEY);
			} catch {
				return DEFAULT_BUSY_ENTER_BEHAVIOR;
			}
			if (stored === "queue" || stored === "steer") return stored;
			return DEFAULT_BUSY_ENTER_BEHAVIOR;
		}
		/** Persist a preference when browser storage is available. */
		function persistBusyEnter(behavior) {
			if (typeof localStorage === "undefined") return;
			try {
				localStorage.setItem(BUSY_ENTER_STORAGE_KEY, behavior);
			} catch {}
		}
		//#endregion
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
		//#region src/client/input/decorations.ts
		/** Token matcher: a trigger char at line start or after whitespace, then a word-ish name (never crosses \n). */
		const TEXT_REF_RE = /(^|\s)([/@])([\w-]+)/g;
		/**
		* Scan the draft for plain-text reference tokens against the hot lexicons
		* (decision 21). Word-boundary discipline: the trigger must sit at the draft
		* start or after whitespace ('x/name' never matches); the name must be an
		* exact lexicon member.
		* @param draft - draft text.
		* @param lexicon - per-trigger name lists (a missing trigger scans nothing).
		* @returns matched ranges in draft order.
		*/
		function scanTextRefs(draft, lexicon) {
			if (lexicon.size === 0 || draft === "") return [];
			const out = [];
			TEXT_REF_RE.lastIndex = 0;
			let m;
			while ((m = TEXT_REF_RE.exec(draft)) !== null) {
				const trigger = m[2];
				const name = m[3] ?? "";
				if (lexicon.get(trigger)?.includes(name)) {
					const start = m.index + (m[1]?.length ?? 0);
					out.push({
						start,
						end: start + 1 + name.length,
						trigger
					});
				}
			}
			return out;
		}
		/** The empty lexicon (default: zero text-ref decorations, old call sites unchanged). */
		const EMPTY_LEXICON$1 = /* @__PURE__ */ new Map();
		/**
		* Derive the mirror-layer decorations from the input state.
		* @param state - published input state.
		* @param lexicon - optional per-trigger reference lexicons (decision 21 scan).
		* @returns token range, chip instructions, text-ref ranges, and the ghost hint.
		*/
		function deriveDecorations(state, lexicon = EMPTY_LEXICON$1) {
			const { draft, claim, phase, occurrences } = state;
			const claimActive = (phase === "claimed" || phase === "submitting") && claim !== void 0 && draft.startsWith(claim.token);
			const token = claimActive ? {
				start: 0,
				end: claim.token.length
			} : null;
			const chips = occurrences.map((o) => ({
				occurrenceId: o.occurrenceId,
				offset: o.offset,
				label: o.label,
				invalid: o.invalid === true
			}));
			const hint = claimActive && claim.hint !== void 0 && draft.slice(claim.token.length).trim() === "" ? claim.hint : null;
			return {
				token,
				chips,
				textRefs: scanTextRefs(draft, lexicon),
				hint
			};
		}
		//#endregion
		//#region src/client/chat/message-chrome.ts
		function pad2(n) {
			return String(n).padStart(2, "0");
		}
		/**
		* Local calendar-day epoch (ms at local midnight) for an instant.
		* @param ms - Unix epoch ms.
		* @returns Midnight of that local calendar day.
		*/
		function startOfLocalDay(ms) {
			const d = new Date(ms);
			d.setHours(0, 0, 0, 0);
			return d.getTime();
		}
		/**
		* Delay until the next local midnight after `ms` (at least 1ms).
		* @param ms - Unix epoch ms.
		* @returns Milliseconds until the following local midnight.
		*/
		function msUntilNextLocalMidnight(ms) {
			const next = new Date(ms);
			next.setHours(24, 0, 0, 0);
			return Math.max(next.getTime() - ms, 1);
		}
		/**
		* Localized elapsed-time label shared by running and settled turn chrome.
		* @param ms - Elapsed duration in milliseconds (negatives clamp to zero).
		* @param t - Translate seat supplying the duration templates.
		* @returns Display string in whole seconds.
		*/
		function formatRunDuration(ms, t) {
			const total = Math.max(0, Math.floor(ms / 1e3));
			const minutes = Math.floor(total / 60);
			const seconds = total % 60;
			return minutes > 0 ? t("duration.minutes", {
				minutes,
				seconds: String(seconds).padStart(2, "0")
			}) : t("duration.seconds", { seconds });
		}
		/**
		* Sub-turn latency figure: one decimal under ten seconds, whole seconds
		* beyond. Unit-less so the locale template owns the second suffix.
		* @param ms - Latency in milliseconds (negatives clamp to zero).
		* @returns Display number in seconds without unit.
		*/
		function formatLatencySeconds(ms) {
			const s = Math.max(0, ms) / 1e3;
			return s < 10 ? String(Math.round(s * 10) / 10) : String(Math.round(s));
		}
		/**
		* Decode-throughput figure: whole tokens from ten up, one decimal below.
		* @param tps - Tokens per second.
		* @returns Display number without unit.
		*/
		function formatTokensPerSecond(tps) {
			const clamped = Math.max(0, tps);
			return clamped >= 10 ? String(Math.round(clamped)) : String(Math.round(clamped * 10) / 10);
		}
		/**
		* Compact local timestamp for message IconActions. Same calendar day →
		* `HH:mm`; earlier this year → the `clock.md` date template + clock; other
		* years → the `clock.ymd` template + clock. Pure: the date templates arrive
		* through the caller's locale seat.
		* @param time - Unix epoch ms from the source session event.
		* @param t - translate seat supplying the `clock.md` / `clock.ymd` templates.
		* @param now - Reference instant for the day/year cut (defaults to wall clock).
		* @returns Date-aware clock string (24-hour, zero-padded time).
		*/
		function formatMessageClock(time, t, now = Date.now()) {
			const d = new Date(time);
			const n = new Date(now);
			const clock = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
			if (d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()) return clock;
			const params = {
				y: d.getFullYear(),
				m: d.getMonth() + 1,
				d: d.getDate()
			};
			return `${d.getFullYear() === n.getFullYear() ? t("clock.md", params) : t("clock.ymd", params)} ${clock}`;
		}
		//#endregion
		//#region src/client/chat/turn-metrics.ts
		function usageOutputTokens(usage) {
			if (typeof usage !== "object" || usage === null) return null;
			const value = usage.outputTokens;
			return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
		}
		/**
		* Read one assistant node's TTFT, decode wall time, and output tokens.
		* @param node - A settled assistant node.
		* @returns Per-part readings with `null` for unrecorded values.
		*/
		function assistantStepReading(node) {
			const timing = node.timing;
			return {
				ttftMs: timing !== void 0 && timing.stepStartTime !== null && timing.firstTokenTime !== null ? Math.max(0, timing.firstTokenTime - timing.stepStartTime) : null,
				decodeMs: timing !== void 0 && timing.firstTokenTime !== null ? Math.max(0, timing.completedTime - timing.firstTokenTime) : null,
				outputTokens: usageOutputTokens(node.usage)
			};
		}
		/**
		* Fold assistant nodes into per-turn footer metrics.
		*
		* TTFT is the turn's lowest-step request-dispatch-to-first-token reading, so
		* it is only meaningful when the turn's start is inside
		* the loaded window (the caller gates on `turnTimings`, which shares that
		* window). Throughput divides summed output tokens by summed decode wall time,
		* counting only steps that carry both.
		* @param nodes - Snapshot nodes of the loaded window.
		* @returns Turn number → available metrics; turns with none are absent.
		*/
		function deriveTurnMetrics(nodes) {
			const folds = /* @__PURE__ */ new Map();
			for (const node of nodes) {
				if (node.kind !== "assistant") continue;
				const reading = assistantStepReading(node);
				let fold = folds.get(node.turn);
				if (fold === void 0) {
					fold = {
						firstStep: node.step,
						firstStepTtftMs: reading.ttftMs,
						decodeMs: 0,
						outputTokens: 0,
						sampled: false
					};
					folds.set(node.turn, fold);
				} else if (node.step < fold.firstStep) {
					fold.firstStep = node.step;
					fold.firstStepTtftMs = reading.ttftMs;
				}
				if (reading.decodeMs !== null && reading.outputTokens !== null) {
					fold.decodeMs += reading.decodeMs;
					fold.outputTokens += reading.outputTokens;
					fold.sampled = true;
				}
			}
			const metrics = /* @__PURE__ */ new Map();
			for (const [turn, fold] of folds) {
				const entry = {};
				if (fold.firstStepTtftMs !== null) entry.ttftMs = fold.firstStepTtftMs;
				if (fold.sampled && fold.decodeMs > 0) entry.tokensPerSecond = fold.outputTokens / (fold.decodeMs / 1e3);
				if (entry.ttftMs !== void 0 || entry.tokensPerSecond !== void 0) metrics.set(turn, entry);
			}
			return metrics;
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/chat/StatsLine.module.css.mjs
		const css$19 = "._8RwK3q_root{text-align:center;max-width:var(--dsh-chat-content-width);box-sizing:border-box;width:100%;padding:4px calc(var(--dsh-composer-side-clearance) + 16px) 0px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;margin:0 auto;font-size:12px;line-height:20px;display:block;overflow:hidden}._8RwK3q_sep{color:var(--dsw-alias-separator-primary);margin:0 10px}";
		const tagId$19 = "@deepseek-ai/dsh-client-ui-conversation/StatsLine.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$19) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$19;
			tag.textContent = css$19;
			document.head.appendChild(tag);
		}
		var StatsLine_module_css_default = {
			"sep": "_8RwK3q_sep",
			"root": "_8RwK3q_root"
		};
		//#endregion
		//#region src/client/chat/StatsLine.tsx
		/**
		* Fold assistant and tool-result nodes into the window-scoped display totals.
		*
		* Counts and wall times describe the loaded window on purpose — they answer
		* "what is on screen". Token accounting deliberately does NOT come from here:
		* the window is paged and compaction rewrites it, so billing rides the durable
		* `tokenUsage` projection instead.
		* @param nodes - snapshot nodes.
		* @returns visible counts and summed wall times.
		*/
		function deriveStats(nodes) {
			const turns = /* @__PURE__ */ new Set();
			let steps = 0;
			let llmMs = 0;
			let toolMs = 0;
			let ttftMs = 0;
			let ttftSteps = 0;
			let decodeMs = 0;
			let decodeTokens = 0;
			for (const node of nodes) {
				if (node.kind === "tool-result") {
					if (node.callTime !== null) toolMs += Math.max(0, node.time - node.callTime);
					continue;
				}
				if (node.kind !== "assistant") continue;
				turns.add(node.turn);
				steps += 1;
				if (node.timing !== void 0 && node.timing.stepStartTime !== null) llmMs += Math.max(0, node.timing.completedTime - node.timing.stepStartTime);
				const reading = assistantStepReading(node);
				if (reading.ttftMs !== null) {
					ttftMs += reading.ttftMs;
					ttftSteps += 1;
				}
				if (reading.decodeMs !== null && reading.outputTokens !== null) {
					decodeMs += reading.decodeMs;
					decodeTokens += reading.outputTokens;
				}
			}
			return {
				turns: turns.size,
				steps,
				llmMs,
				toolMs,
				ttftMs,
				ttftSteps,
				decodeMs,
				decodeTokens
			};
		}
		/**
		* Compact token count: 517 / 12.2K / 517K / 1.2M (one decimal under three digits).
		* @param n - token count.
		* @returns display string.
		*/
		function formatTokens(n) {
			const scaled = (v) => v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
			if (n < 1e3) return String(n);
			if (n < 1e6) return `${scaled(n / 1e3)}K`;
			return `${scaled(n / 1e6)}M`;
		}
		/**
		* Compact duration: 45.2s under a minute, 2m42s from there on.
		* @param ms - duration in milliseconds.
		* @returns display string.
		*/
		function formatDuration(ms) {
			const s = ms / 1e3;
			if (s < 60) return `${Math.round(s * 10) / 10}s`;
			const whole = Math.round(s);
			return `${Math.floor(whole / 60)}m${whole % 60}s`;
		}
		/**
		* Cache-hit share of prompt-side input over the whole durable log.
		* @param usage - the session's token-usage projection value.
		* @returns rounded integer percent, or null when no input was billed.
		*/
		function cacheHitPercent(usage) {
			const denominator = billedInputTokens(usage);
			return denominator === 0 ? null : Math.round(usage.cacheReadTokens / denominator * 100);
		}
		/**
		* Sum the three disjoint prompt-side billing buckets.
		* @param usage - the session's token-usage projection value.
		* @returns billed input tokens.
		*/
		function billedInputTokens(usage) {
			return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
		}
		/**
		* Approximate context occupancy, using the TUI's integer rounding and upper
		* clamp. The numerator is `projectedTokens` — the provider sample carried
		* forward over the surface's movement since — so compaction shows immediately
		* instead of waiting for the next request to report usage; it falls back to the
		* bare sample only for a log whose projection predates that field. Numerator
		* and capacity remain independent last-wins projection fields, so this is a
		* reference figure rather than an exact measurement of one request (see the
		* token-meter README).
		* @param pressure - the session's context-pressure projection value.
		* @returns occupancy with its numerator and denominator, or null until both values are known.
		*/
		function contextOccupancy(pressure) {
			const usedTokens = pressure?.projectedTokens ?? pressure?.pressureTokens;
			if (usedTokens === void 0 || pressure?.contextWindow === void 0) return null;
			return {
				percent: Math.min(100, Math.round(usedTokens / pressure.contextWindow * 100)),
				usedTokens,
				contextWindow: pressure.contextWindow
			};
		}
		const StatsLine = (0, react.memo)(function StatsLine({ useSession, useProjection, t }) {
			const nodes = useSession((s) => s.nodes);
			const usage = useProjection("tokenUsage");
			const stats = (0, react.useMemo)(() => deriveStats(nodes), [nodes]);
			const groups = [];
			if (stats.steps > 0) {
				groups.push(t("stats.counts", {
					turns: stats.turns,
					steps: stats.steps
				}));
				const durations = [];
				if (stats.llmMs > 0) durations.push(t("stats.llm", { duration: formatDuration(stats.llmMs) }));
				if (stats.toolMs > 0) durations.push(t("stats.toolCall", { duration: formatDuration(stats.toolMs) }));
				if (durations.length > 0) groups.push(durations.join(" · "));
				const speeds = [];
				if (stats.ttftSteps > 0) speeds.push(t("stats.ttftAverage", { duration: formatDuration(stats.ttftMs / stats.ttftSteps) }));
				if (stats.decodeMs > 0) speeds.push(t("stats.tokensPerSecond", { throughput: formatTokensPerSecond(stats.decodeTokens / (stats.decodeMs / 1e3)) }));
				if (speeds.length > 0) groups.push(speeds.join(" · "));
			}
			if (usage !== void 0 && (stats.steps > 0 || billedInputTokens(usage) > 0 || usage.outputTokens > 0)) {
				const cacheHit = cacheHitPercent(usage);
				if (cacheHit !== null) groups.push(t("stats.cacheHit", { percent: cacheHit }));
				groups.push(t("stats.tokens", {
					input: formatTokens(billedInputTokens(usage)),
					output: formatTokens(usage.outputTokens)
				}));
			}
			const line = groups.join(" | ");
			const rootRef = (0, react.useRef)(null);
			const [truncated, setTruncated] = (0, react.useState)(false);
			(0, react.useLayoutEffect)(() => {
				const el = rootRef.current;
				if (el === null) return;
				const measure = () => {
					setTruncated(el.scrollWidth > el.clientWidth);
				};
				measure();
				if (typeof ResizeObserver === "undefined") return;
				const observer = new ResizeObserver(measure);
				observer.observe(el);
				return () => {
					observer.disconnect();
				};
			}, [line]);
			if (groups.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: line,
				side: "top",
				delayMs: 500,
				disabled: !truncated,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					ref: rootRef,
					className: StatsLine_module_css_default.root,
					children: groups.map((group, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [i > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: StatsLine_module_css_default.sep,
						"aria-hidden": true,
						children: "|"
					}), " "] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: group })] }, group))
				})
			});
		});
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/skeleton/ContextMeter.module.css.mjs
		const css$18 = ".Qkf02a_root{display:inline-flex;position:relative}.Qkf02a_trigger{width:28px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:999px;flex:none;place-items:center;display:grid}.Qkf02a_trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}.Qkf02a_track{fill:none;stroke:var(--dsw-alias-border-l3);stroke-width:2px}.Qkf02a_fill{fill:none;stroke:var(--dsw-alias-label-tertiary);stroke-width:2px;stroke-linecap:round}.Qkf02a_panel{z-index:100;box-sizing:border-box;border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-menu);width:264px;box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-secondary);cursor:default;border-radius:12px;padding:12px;font-size:12px;line-height:20px;position:absolute;bottom:calc(100% + 8px);right:0}.Qkf02a_header{align-items:center;gap:6px;display:flex}.Qkf02a_figures{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);margin-left:auto;font-weight:500}.Qkf02a_percent{color:var(--dsw-alias-label-primary);font-weight:500}.Qkf02a_headline{color:var(--dsw-alias-label-tertiary)}.Qkf02a_headline:empty{display:none}.Qkf02a_bar{background:var(--dsw-alias-interactive-bg-hover);border-radius:999px;gap:1px;height:4px;margin:10px 0 12px;display:flex;overflow:hidden}.Qkf02a_segment{background:var(--meter-tint,var(--dsw-alias-label-tertiary));border-radius:1px;flex:none;min-width:2px;height:100%}.Qkf02a_swatch{background:var(--meter-tint);vertical-align:baseline;border-radius:2px;width:8px;height:8px;margin-right:6px;display:inline-block}.Qkf02a_colorSystem{--meter-tint:var(--dsw-static-neutral-bluish-400)}.Qkf02a_colorTools{--meter-tint:#a78bfa}.Qkf02a_colorMessages{--meter-tint:var(--dsw-static-blue-450)}.Qkf02a_rows{margin:6px 0 0}.Qkf02a_row{justify-content:space-between;align-items:center;gap:12px;padding:2px 0;display:flex}.Qkf02a_row dt{color:var(--dsw-alias-label-secondary)}.Qkf02a_row dd{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);margin:0}";
		const tagId$18 = "@deepseek-ai/dsh-client-ui-conversation/ContextMeter.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$18) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$18;
			tag.textContent = css$18;
			document.head.appendChild(tag);
		}
		var ContextMeter_module_css_default = {
			"headline": "Qkf02a_headline",
			"colorSystem": "Qkf02a_colorSystem",
			"colorMessages": "Qkf02a_colorMessages",
			"header": "Qkf02a_header",
			"percent": "Qkf02a_percent",
			"track": "Qkf02a_track",
			"fill": "Qkf02a_fill",
			"bar": "Qkf02a_bar",
			"row": "Qkf02a_row",
			"root": "Qkf02a_root",
			"panel": "Qkf02a_panel",
			"swatch": "Qkf02a_swatch",
			"figures": "Qkf02a_figures",
			"rows": "Qkf02a_rows",
			"colorTools": "Qkf02a_colorTools",
			"segment": "Qkf02a_segment",
			"trigger": "Qkf02a_trigger"
		};
		//#endregion
		//#region src/client/skeleton/ContextMeter.tsx
		/** Composer context-occupancy meter: a ring beside the send button fed by the
		* `contextPressure` projection, with a click-open panel of the heuristic
		* `contextBreakdown` composition (system prompt, tools, conversation).
		* Renders nothing until a provider reports both pressure and a route capacity
		* (same gate as the stats row used). */
		/** Ring geometry: 14px viewBox, 2px stroke. */
		const RADIUS = 5.5;
		const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
		/**
		* Marker the localized occupancy sentence is split on, so the panel headline
		* keeps the reading in its own tone while each locale still owns the word
		* order (`45% of context used` / `上下文已用 45%`).
		*/
		const READING_SLOT = "\0";
		/** Panel legend rows, in bar-segment order; each color class carries the shared swatch/segment tint. */
		const ROWS = [
			{
				key: "systemTokens",
				label: "context.system",
				color: ContextMeter_module_css_default.colorSystem
			},
			{
				key: "toolsTokens",
				label: "context.tools",
				color: ContextMeter_module_css_default.colorTools
			},
			{
				key: "messageTokens",
				label: "context.messages",
				color: ContextMeter_module_css_default.colorMessages
			}
		];
		function ContextMeter({ useProjection, t }) {
			const pressure = useProjection("contextPressure");
			const breakdown = useProjection("contextBreakdown");
			const [open, setOpen] = (0, react.useState)(false);
			const rootRef = (0, react.useRef)(null);
			const context = contextOccupancy(pressure);
			const available = context !== null;
			(0, react.useEffect)(() => {
				if (!available && open) setOpen(false);
			}, [available, open]);
			(0, react.useEffect)(() => {
				if (!open || !available) return;
				const onPointerDown = (e) => {
					if (e.target instanceof Node && rootRef.current?.contains(e.target) === true) return;
					setOpen(false);
				};
				const onKeyDown = (e) => {
					if (e.key === "Escape") setOpen(false);
				};
				document.addEventListener("pointerdown", onPointerDown);
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown);
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [available, open]);
			if (context === null) return null;
			const percent = context.percent;
			const reading = `${percent}%`;
			const [headBefore = "", headAfter = ""] = t("context.aria", { percent: READING_SLOT }).split(READING_SLOT).map((part) => part.trim());
			const breakdownTotal = breakdown === void 0 ? 0 : breakdown.systemTokens + breakdown.toolsTokens + breakdown.messageTokens;
			const segments = (breakdown === void 0 || breakdownTotal === 0 ? [{
				key: "total",
				color: void 0,
				width: percent
			}] : ROWS.map((row) => ({
				key: row.key,
				color: row.color,
				width: percent * breakdown[row.key] / breakdownTotal
			}))).filter((part) => part.width > 0);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				ref: rootRef,
				className: ContextMeter_module_css_default.root,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					label: t("context.aria", { percent: reading }),
					side: "top",
					delayMs: 200,
					disabled: open,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: ContextMeter_module_css_default.trigger,
						"aria-label": t("context.aria", { percent: reading }),
						"aria-haspopup": "dialog",
						"aria-expanded": open,
						onClick: () => {
							setOpen(!open);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
							viewBox: "0 0 14 14",
							width: "14",
							height: "14",
							"aria-hidden": true,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
								className: ContextMeter_module_css_default.track,
								cx: "7",
								cy: "7",
								r: RADIUS
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
								className: ContextMeter_module_css_default.fill,
								cx: "7",
								cy: "7",
								r: RADIUS,
								strokeDasharray: `${CIRCUMFERENCE * percent / 100} ${CIRCUMFERENCE}`,
								transform: "rotate(-90 7 7)"
							})]
						})
					})
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ContextMeter_module_css_default.panel,
					role: "dialog",
					"aria-label": t("context.used"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ContextMeter_module_css_default.header,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ContextMeter_module_css_default.headline,
									children: headBefore
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ContextMeter_module_css_default.percent,
									children: reading
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ContextMeter_module_css_default.headline,
									children: headAfter
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ContextMeter_module_css_default.figures,
									children: `~${formatTokens(context.usedTokens)} / ${formatTokens(context.contextWindow)}`
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: ContextMeter_module_css_default.bar,
							children: segments.map((segment) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: segment.color === void 0 ? ContextMeter_module_css_default.segment : `${ContextMeter_module_css_default.segment} ${segment.color}`,
								style: { width: `${segment.width}%` }
							}, segment.key))
						}),
						breakdown !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dl", {
							className: ContextMeter_module_css_default.rows,
							children: ROWS.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ContextMeter_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dt", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: `${ContextMeter_module_css_default.swatch} ${row.color}`,
									"aria-hidden": true
								}), t(row.label)] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: `~${formatTokens(breakdown[row.key])}` })]
							}, row.key))
						})
					]
				})]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/skeleton/PermissionSelect.module.css.mjs
		const css$17 = ".eQkbiq_trigger{min-width:0;max-width:220px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:24px;outline:none;align-items:center;gap:4px;padding:0 4px 0 8px;font-size:13px;font-weight:500;line-height:20px;display:inline-flex}.eQkbiq_trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.eQkbiq_trigger:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}.eQkbiq_trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}.eQkbiq_triggerIcon{flex:none;display:inline-flex}.eQkbiq_triggerIcon svg{width:14px;height:14px}.eQkbiq_triggerLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.eQkbiq_chevron{color:var(--dsw-alias-label-caption);flex:none;transition:transform .12s}@container (width<=460px){.eQkbiq_trigger:has(.eQkbiq_triggerIcon) .eQkbiq_triggerLabel{display:none}}.eQkbiq_chevronOpen{transform:rotate(180deg)}";
		const tagId$17 = "@deepseek-ai/dsh-client-ui-conversation/PermissionSelect.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$17) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$17;
			tag.textContent = css$17;
			document.head.appendChild(tag);
		}
		var PermissionSelect_module_css_default = {
			"trigger": "eQkbiq_trigger",
			"triggerIcon": "eQkbiq_triggerIcon",
			"triggerLabel": "eQkbiq_triggerLabel",
			"chevron": "eQkbiq_chevron",
			"chevronOpen": "eQkbiq_chevronOpen"
		};
		//#endregion
		//#region src/client/skeleton/PermissionSelect.tsx
		const FULL_ACCESS = "danger-full-access";
		const shieldOutline = "M8.20554 0.899994L14.7901 3.36857V7.01026C14.7901 12 11.0466 14.2103 8.20554 15.3C5.36446 14.2103 1.62012 12 1.62012 7.01026V3.36857L8.20554 0.899994Z";
		const permissionGlyphs = {
			"read-only": /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: "16",
				height: "16",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: shieldOutline,
					stroke: "currentColor",
					strokeWidth: "1.31831",
					strokeLinejoin: "round"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M12.1654 5.7552L8.9447 9.41475C8.73044 9.65816 8.53628 9.8804 8.35774 10.0423C8.1713 10.2114 7.94235 10.3717 7.64016 10.4254C7.48207 10.4535 7.32 10.4552 7.16151 10.4294C6.85843 10.3801 6.62728 10.2223 6.43836 10.0559C6.25752 9.89653 6.06037 9.67732 5.84264 9.43705L4.72925 8.20897L5.63557 7.38707L6.74897 8.61594C6.98603 8.87755 7.12974 9.03533 7.24673 9.13839C7.31033 9.19443 7.34485 9.21476 7.35823 9.22122C7.38068 9.22484 7.40352 9.22515 7.42593 9.22122C7.40522 9.22502 7.42893 9.23294 7.53583 9.136C7.65132 9.03126 7.79316 8.87139 8.02643 8.60638L11.2479 4.94763L12.1654 5.7552Z",
					fill: "currentColor"
				})]
			}),
			"workspace-write": /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: "16",
				height: "16",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M8.08887 0.251709C8.20479 0.23085 8.32486 0.241168 8.43652 0.282959L15.0215 2.75171C15.2787 2.84819 15.4492 3.09414 15.4492 3.3689V7.0105C15.4492 7.10986 15.4441 7.2081 15.4414 7.30542C15.0285 7.07175 14.5905 6.87695 14.1309 6.73022V3.82495L8.20508 1.60327L2.2793 3.82495V7.0105C2.27936 9.7171 3.4745 11.5379 5.02734 12.7947C5.01025 12.9942 5 13.1962 5 13.4001C5.00001 13.7617 5.02722 14.1169 5.08008 14.4636C2.91555 13.0393 0.961014 10.752 0.960938 7.0105V3.3689C0.960938 3.09417 1.13146 2.84821 1.38867 2.75171L7.97461 0.282959L8.08887 0.251709Z",
						fill: "currentColor"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M11.3525 5.64688V6.85688H5V5.64688H11.3525Z",
						fill: "currentColor"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M9.5824 8.29376V9.50376H5V8.29376H9.5824Z",
						fill: "currentColor"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M14.6647 15.6852H10.0338C10.3878 15.3751 10.7567 15.0517 11.0772 14.7706C11.2531 14.6164 11.4144 14.4746 11.5511 14.3547H14.6647V15.6852Z",
						fill: "currentColor"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M8.14852 14.1308L7.33925 15.4976C7.22458 15.6912 7.42245 15.9194 7.63037 15.8333L9.09785 15.2254L15.0399 10.0719L14.0905 8.97733L8.14852 14.1308Z",
						fill: "currentColor"
					})
				]
			}),
			[FULL_ACCESS]: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: "16",
				height: "16",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: shieldOutline,
						stroke: "currentColor",
						strokeWidth: "1.31831",
						strokeLinejoin: "round"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M9.10094 4.5V8.75939H7.59888V4.5H9.10094Z",
						fill: "currentColor"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M9.10094 9.8114V11.5H7.59888V9.8114H9.10094Z",
						fill: "currentColor"
					})
				]
			})
		};
		/** Glyph for a permission option value; host-configured names outside the design set get none. */
		function permissionGlyph(value) {
			return permissionGlyphs[value];
		}
		/**
		* Display transform: kebab-case machine names render as title-case labels
		* (`workspace-write` → `Workspace Write`); non-kebab host-configured names
		* pass through. Full access intentionally overrides the machine-name
		* transform so both permission surfaces use the product label `Full access`;
		* the warning body remains locale-aware.
		*/
		function displayName(name) {
			if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return name;
			return name.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
		}
		function optionLabel(option) {
			return option.value === FULL_ACCESS ? "Full access" : displayName(option.name);
		}
		function PermissionSelect({ value, locked, command, t }) {
			const [pick, setPick] = (0, react.useState)(null);
			const [open, setOpen] = (0, react.useState)(false);
			const [confirmation, setConfirmation] = (0, react.useState)(null);
			const [acknowledged, setAcknowledged] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (!locked && value !== void 0) return;
				setOpen(false);
				setAcknowledged(false);
				setConfirmation(null);
			}, [locked, value]);
			if (value === void 0) return null;
			const currentValue = pick ?? value.currentValue;
			const current = value.options.find((option) => option.value === currentValue);
			const busy = pick !== null || confirmation !== null;
			const items = value.options.filter((o) => o.value !== "custom").map((option) => {
				const icon = permissionGlyph(option.value);
				return {
					id: option.value,
					label: optionLabel(option),
					...icon === void 0 ? {} : { icon }
				};
			});
			const submit = (id) => {
				setPick(id);
				command(`/permission ${id}`).catch(() => false).then(() => {
					setPick(null);
				});
			};
			const choose = (id) => {
				setOpen(false);
				if (id === value.currentValue) return;
				if (id === FULL_ACCESS) {
					setAcknowledged(false);
					setConfirmation(id);
					return;
				}
				submit(id);
			};
			const closeConfirmation = () => {
				setAcknowledged(false);
				setConfirmation(null);
			};
			const confirmFullAccess = () => {
				if (locked || !acknowledged || confirmation === null) return;
				const id = confirmation;
				closeConfirmation();
				submit(id);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				open,
				items,
				selectedId: currentValue,
				onSelect: choose,
				onClose: () => {
					setOpen(false);
				},
				side: "top",
				anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: PermissionSelect_module_css_default.trigger,
					"aria-label": t("input.accessMode", { name: current === void 0 ? displayName(currentValue) : optionLabel(current) }),
					title: current?.description,
					disabled: locked || busy,
					onClick: () => {
						setOpen(!open);
					},
					children: [
						permissionGlyph(currentValue) !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: PermissionSelect_module_css_default.triggerIcon,
							"aria-hidden": true,
							children: permissionGlyph(currentValue)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: PermissionSelect_module_css_default.triggerLabel,
							children: current === void 0 ? displayName(currentValue) : optionLabel(current)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: clsx(PermissionSelect_module_css_default.chevron, open && PermissionSelect_module_css_default.chevronOpen),
							"aria-hidden": true,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, {})
						})
					]
				})
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.RiskConfirmation, {
				open: confirmation !== null,
				title: t("access.confirm.title"),
				description: t("access.confirm.description"),
				acknowledgeLabel: t("access.confirm.acknowledge"),
				cancelLabel: t("access.confirm.cancel"),
				confirmLabel: t("access.confirm.enable"),
				acknowledged,
				disabled: locked,
				onAcknowledgedChange: setAcknowledged,
				onCancel: closeConfirmation,
				onConfirm: confirmFullAccess
			})] });
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/skeleton/InputBar.module.css.mjs
		const css$16 = "@font-face{font-family:DshChipCell;src:url(data:font/ttf;base64,AAEAAAAKAIAAAwAgT1MvMkT8SmIAAAEoAAAAYGNtYXAADQBPAAABkAAAADRnbHlmAAAAAAAAAcwAAAABaGVhZCwtPGoAAACsAAAANmhoZWEDIg7bAAAA5AAAACRobXR4EZQAAAAAAYgAAAAIbG9jYQAAAAAAAAHEAAAABm1heHAAAwACAAABCAAAACBuYW1lvljk2gAAAdAAAABscG9zdNNweNQAAAI8AAAALQABAAAAAQAAdia1tV8PPPUAAwPoAAAAAOaLfcUAAAAA5ot9xQAAAAAAAAAAAAAAAwACAAAAAAAAAAEAAAMg/zgAAA+gAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAACAAEAAAACAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAwjKAZAABQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAPz8/PwAA//z//AMg/zgAAAMgAMgAAAAAAAAAAAAAAAAAAAAgAAAB9AAAD6AAAAAAAAIAAAADAAAAFAADAAEAAAAUAAQAIAAAAAQABAABAAD//P//AAD//P//AAUAAQAAAAAAAAAAAAAAAAAAAAAAAAAEADYAAQAAAAAAAQALAAAAAQAAAAAAAgAHAAsAAwABBAkAAQAWABIAAwABBAkAAgAOAChEc2hDaGlwQ2VsbFJlZ3VsYXIARABzAGgAQwBoAGkAcABDAGUAbABsAFIAZQBnAHUAbABhAHIAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAABAgZvYmpyZXAAAAA=)format(\"truetype\")}.ee05ya_root{padding:0 var(--dsh-composer-side-clearance) 8px;flex-direction:column;align-items:center;display:flex}.ee05ya_hero{padding:0 var(--dsh-composer-side-clearance)}.ee05ya_error,.ee05ya_status{width:100%;max-width:var(--dsh-composer-card-max-width);border-radius:8px;margin-bottom:6px;padding:4px 8px;font-size:12px;line-height:18px}.ee05ya_status{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.ee05ya_notice{width:100%;max-width:var(--dsh-composer-card-max-width);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);border-radius:8px;margin-bottom:6px;padding:4px 8px;font-size:12px;line-height:18px}.ee05ya_noticeError,.ee05ya_error{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}.ee05ya_card{box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width);border:1px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-specific-input-major);box-shadow:var(--dsw-shadow-lv2);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:22px;flex-direction:column;gap:12px;padding-top:10px;font-size:16px;line-height:24px;display:flex;position:relative}.ee05ya_accessory{align-items:center;gap:8px;padding:10px 12px 0;display:flex}.ee05ya_overlayAnchor{height:0;position:absolute;inset:0 0 auto}.ee05ya_scroll{max-height:var(--dsh-composer-text-max-height);overflow-y:auto}.ee05ya_grow{position:relative}.ee05ya_backdrop{color:var(--dsw-alias-label-primary);pointer-events:none;position:absolute;inset:0;overflow:hidden}.ee05ya_hlToken{color:var(--dsw-alias-state-warn-label);background-color:#0000}.ee05ya_hlSegment{color:#0000;background-color:#0000;border-radius:4px}.ee05ya_hint{color:var(--dsw-alias-label-caption)}.ee05ya_pending{background:var(--dsw-alias-state-business-primary);border-radius:50%;width:8px;height:8px;animation:1s ease-in-out infinite alternate ee05ya_input-pending}@keyframes ee05ya_input-pending{0%{opacity:.35}to{opacity:1}}.ee05ya_input{resize:none;color:#0000;width:100%;height:100%;caret-color:var(--dsw-alias-state-business-primary);background:0 0;border:none;outline:none;position:absolute;inset:0;overflow:hidden}.ee05ya_input,.ee05ya_mirror,.ee05ya_backdrop{box-sizing:border-box;font-family:\"DshChipCell\", var(--dsw-font-family);font-size:inherit;line-height:inherit;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;padding:4px 12px 0 16px}.ee05ya_input::placeholder{color:var(--dsw-alias-label-caption);user-select:none}.ee05ya_input:disabled{color:var(--dsw-alias-label-tertiary);cursor:not-allowed}.ee05ya_mirror{visibility:hidden;pointer-events:none}.ee05ya_hero .ee05ya_mirror{min-height:52px}.ee05ya_row{justify-content:space-between;align-items:center;gap:12px;min-width:0;padding:2px 8px 6px;display:flex;container-type:inline-size}.ee05ya_tools,.ee05ya_modes,.ee05ya_trailing{align-items:center;min-width:0;display:flex}.ee05ya_tools{gap:16px}.ee05ya_modes{gap:12px}.ee05ya_trailing{flex:none;gap:12px}.ee05ya_add{background:var(--dsw-specific-selector);width:28px;height:28px;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;border-radius:999px;flex:none;place-items:center;display:grid}.ee05ya_add:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}.ee05ya_add:disabled{opacity:.5;cursor:default}.ee05ya_select{max-width:220px;height:28px;color:var(--dsw-alias-label-secondary);white-space:nowrap;cursor:pointer;appearance:none;background-color:#0000;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\");background-position:right 4px center;background-repeat:no-repeat;background-size:12px 12px;border:none;border-radius:8px;outline:none;padding:0 20px 0 8px;font-size:13px;font-weight:500;line-height:20px}.ee05ya_select:hover:not(:disabled){background-color:var(--dsw-alias-interactive-bg-hover)}.ee05ya_select:disabled{opacity:.5;cursor:default}.ee05ya_primary{background:var(--dsw-alias-button-info-fill);color:#fff;cursor:pointer;border:none;border-radius:999px;flex:none;place-items:center;width:34px;height:34px;transition:background-color .1s;display:grid;transform:translateY(-2px)}.ee05ya_primary:hover:not(:disabled){background:var(--dsw-alias-button-info-hover)}.ee05ya_primary:disabled{opacity:.4;cursor:default}.ee05ya_retry{color:inherit;cursor:pointer;background:0 0;border:1px solid;border-radius:4px;margin-left:8px;padding:1px 8px;font-size:12px}.ee05ya_textRef{color:var(--dsw-alias-state-business-primary);-webkit-box-decoration-break:clone;box-decoration-break:clone;background-color:#0000}.ee05ya_textRef:after{display:none}.ee05ya_chip{background:#6187d838;border-radius:6px;position:relative}.ee05ya_chip:before{content:\"￼\";color:#0000}.ee05ya_chipLabel{width:calc(138.889% - 10px);color:var(--dsw-alias-label-primary);white-space:nowrap;justify-content:center;align-items:center;display:flex;position:absolute;top:50%;left:50%;overflow:hidden;transform:translate(-50%,-50%)scale(.72)}.ee05ya_chipInvalid{opacity:.7;background:#d8616133;text-decoration:line-through}";
		const tagId$16 = "@deepseek-ai/dsh-client-ui-conversation/InputBar.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$16) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$16;
			tag.textContent = css$16;
			document.head.appendChild(tag);
		}
		var InputBar_module_css_default = {
			"mirror": "ee05ya_mirror",
			"hero": "ee05ya_hero",
			"tools": "ee05ya_tools",
			"accessory": "ee05ya_accessory",
			"overlayAnchor": "ee05ya_overlayAnchor",
			"status": "ee05ya_status",
			"textRef": "ee05ya_textRef",
			"chipLabel": "ee05ya_chipLabel",
			"hlToken": "ee05ya_hlToken",
			"chipInvalid": "ee05ya_chipInvalid",
			"hlSegment": "ee05ya_hlSegment",
			"retry": "ee05ya_retry",
			"row": "ee05ya_row",
			"chip": "ee05ya_chip",
			"pending": "ee05ya_pending",
			"primary": "ee05ya_primary",
			"trailing": "ee05ya_trailing",
			"notice": "ee05ya_notice",
			"scroll": "ee05ya_scroll",
			"input-pending": "ee05ya_input-pending",
			"input": "ee05ya_input",
			"root": "ee05ya_root",
			"add": "ee05ya_add",
			"card": "ee05ya_card",
			"hint": "ee05ya_hint",
			"select": "ee05ya_select",
			"error": "ee05ya_error",
			"grow": "ee05ya_grow",
			"modes": "ee05ya_modes",
			"backdrop": "ee05ya_backdrop",
			"noticeError": "ee05ya_noticeError"
		};
		//#endregion
		//#region src/client/skeleton/InputBar.tsx
		/** The default composer body: the 'conversation.composer.bar' slot entry
		* (decision 20). Machine state arrives through the standard provide channel
		* (useInput + inputActions); the keyboard/DOM command face and stop arrive
		* through this entry's own inject, whose hooks compartment binds
		* useNotices/useLexicon; layout-phase inputs (variant, placeholder,
		* region-slot content) ride the owner props. Session facts
		* (running/removed/promptError) are self-selected via useSession. */
		/** Decoration product of the no-session state (no machine, empty draft). */
		const INERT_DECORATIONS = {
			token: null,
			chips: [],
			textRefs: [],
			hint: null
		};
		function InputBar({ useSession, useInput, inputActions, keyboard, resolveSubmitMode, toggleCommandMenu, stop, command, t, renderSlot, useNotices, useLexicon, useMenuLauncher, useProjection, sessionId, variant, disabled: inert = false, placeholder, accessory, overlay, leftItems, rightItems, footer }) {
			const input = useInput((s) => s);
			const notice = useNotices((s) => s);
			const lexicon = useLexicon((s) => s);
			const commandMenuOpen = useMenuLauncher((source) => source === "command");
			const promptError = useSession((s) => s.promptError) ?? null;
			const running = useSession((s) => s.running) ?? false;
			const subagent = useSession((s) => s.subagent) ?? null;
			const removed = useSession((s) => s.removed) ?? false;
			const planActive = useProjection("plan", (plan) => plan !== void 0 && (plan.pending ? !plan.active : plan.active));
			const hasGoal = useProjection("goal", (goal) => goal != null);
			const error = promptError === null ? null : {
				op: promptError.op,
				message: `${promptError.error.message} (${promptError.error.code})`
			};
			const live = input !== void 0 && keyboard !== void 0 && inputActions !== void 0;
			const draft = input?.draft ?? "";
			const empty = draft.trim() === "";
			const inputRef = (0, react.useRef)(null);
			const scrollRef = (0, react.useRef)(null);
			const mirrorRef = (0, react.useRef)(null);
			const composingRef = (0, react.useRef)(false);
			const onCompositionStart = () => {
				composingRef.current = true;
			};
			const onCompositionEnd = () => {
				setTimeout(() => {
					composingRef.current = false;
				}, 10);
			};
			const permissions = useProjection("permissions");
			const disabled = removed || inert || !live;
			const locked = disabled;
			const machineBusy = input?.phase === "adjudicating" || input?.phase === "submitting";
			const revealCaret = (caret) => {
				const scrollEl = scrollRef.current;
				const mirrorEl = mirrorRef.current;
				const text = mirrorEl?.firstChild;
				if (scrollEl === null || mirrorEl === null || !(text instanceof Text)) return;
				if (scrollEl.scrollHeight <= scrollEl.clientHeight) return;
				const at = Math.min(caret, text.data.length);
				const afterNewline = at > 0 && text.data[at - 1] === "\n";
				const range = document.createRange();
				range.setStart(text, afterNewline ? at - 1 : at);
				if (afterNewline) range.setEnd(text, at);
				else range.collapse(true);
				const line = afterNewline ? Number.parseFloat(getComputedStyle(mirrorEl).lineHeight) : 0;
				const rect = range.getBoundingClientRect();
				const box = scrollEl.getBoundingClientRect();
				if (rect.bottom + line > box.bottom) scrollEl.scrollTop += rect.bottom + line - box.bottom;
				else if (rect.top + line < box.top) scrollEl.scrollTop -= box.top - rect.top - line;
			};
			const revealSelectionFocus = (el) => {
				revealCaret((el.selectionDirection === "backward" ? el.selectionStart : el.selectionEnd) ?? el.value.length);
			};
			(0, react.useEffect)(() => {
				const el = inputRef.current;
				if (locked || el === null) return;
				el.focus({ preventScroll: true });
				revealSelectionFocus(el);
			}, [locked, sessionId]);
			(0, react.useEffect)(() => {
				const el = inputRef.current;
				if (locked || draft === "" || el === null) return;
				revealSelectionFocus(el);
			}, [draft !== ""]);
			const restoreCaret = (el, caret) => {
				requestAnimationFrame(() => {
					el.setSelectionRange(caret, caret);
					revealCaret(caret);
				});
			};
			(0, react.useEffect)(() => {
				const el = scrollRef.current;
				if (el === null) return;
				const onWheel = (e) => {
					const host = el.closest("[data-conversation-scroll]");
					if (!(host instanceof HTMLElement) || e.deltaY === 0) return;
					const atTop = el.scrollTop <= 0;
					const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
					if (e.deltaY < 0 && !atTop || e.deltaY > 0 && !atEnd) return;
					e.preventDefault();
					host.scrollTop += e.deltaY;
				};
				el.addEventListener("wheel", onWheel, { passive: false });
				return () => {
					el.removeEventListener("wheel", onWheel);
				};
			}, []);
			const onKeyDown = (e) => {
				if (keyboard === void 0 || inputActions === void 0) return;
				if (e.key === "Enter" && e.shiftKey) return;
				const composing = composingRef.current || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229;
				if (e.key === "ArrowUp" || e.key === "ArrowDown") {
					if (keyboard.arbitrate(e.key === "ArrowUp" ? "up" : "down", composing) === "consumed") e.preventDefault();
					return;
				}
				if (e.key === "Escape") {
					keyboard.dismissPopup();
					if (keyboard.arbitrate("escape", composing) === "consumed") e.preventDefault();
					return;
				}
				if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z" || e.key === "y")) {
					e.preventDefault();
					if (machineBusy || locked) return;
					if (e.key === "y" || e.shiftKey) keyboard.redo();
					else keyboard.undo();
					return;
				}
				if (e.key === " ") {
					if (composing) return;
					if (keyboard.space()) e.preventDefault();
					return;
				}
				if (e.key !== "Enter") return;
				if (composing) return;
				if (keyboard.arbitrate("enter", composing) !== "pass") {
					e.preventDefault();
					return;
				}
				e.preventDefault();
				if (e.repeat) return;
				if (locked || machineBusy) return;
				keyboard.submit(resolveSubmitMode(running, e.ctrlKey || e.metaKey ? "accelerated" : "enter", subagent === null));
			};
			const onChange = (e) => {
				if (keyboard === void 0) return;
				if (machineBusy) return;
				const next = e.target.value;
				keyboard.setDraft(next);
				keyboard.track(next, e.target.selectionStart ?? next.length);
			};
			const selectionOf = (el) => ({
				start: el.selectionStart ?? 0,
				end: el.selectionEnd ?? el.selectionStart ?? 0
			});
			const onCopyOrCut = (e, cut) => {
				if (input === void 0 || keyboard === void 0) return;
				const el = e.currentTarget;
				const { start, end } = selectionOf(el);
				if (start === end) return;
				draft.slice(start, end);
				const touched = input.occurrences.filter((o) => o.offset >= start && o.offset < end);
				if (touched.length === 0 && !cut) return;
				e.preventDefault();
				let text = "";
				let cursor = start;
				for (const o of touched) {
					text += draft.slice(cursor, o.offset) + o.clipboardText;
					cursor = o.offset + 1;
				}
				text += draft.slice(cursor, end);
				e.clipboardData.setData("text/plain", text);
				if (cut && !machineBusy && !locked) {
					keyboard.setDraft(draft.slice(0, start) + draft.slice(end), {
						start,
						end,
						insertedLength: 0
					});
					restoreCaret(el, start);
				}
			};
			const onPaste = (e) => {
				if (keyboard === void 0) return;
				if (machineBusy || locked) return;
				const text = e.clipboardData.getData("text/plain");
				if (text === "") return;
				e.preventDefault();
				const el = e.currentTarget;
				const sel = selectionOf(el);
				keyboard.pasteBegin(text, sel);
				const caret = sel.start + text.length;
				restoreCaret(el, caret);
				keyboard.track(keyboard.snapshot.draft, caret);
			};
			const onSelect = (e) => {
				if (keyboard !== void 0 && keyboard.snapshot.paste !== void 0) keyboard.invalidatePaste();
			};
			const keepFocus = (e) => {
				e.preventDefault();
				inputRef.current?.focus({ preventScroll: true });
			};
			const onToggleCommandMenu = () => {
				const el = inputRef.current;
				if (el !== null) toggleCommandMenu?.(selectionOf(el));
			};
			const stopping = running && subagent === null;
			const primaryLabel = stopping ? t("input.stop") : t("input.send");
			const onPrimary = () => {
				if (stopping) {
					stop?.();
					return;
				}
				if (inputActions === void 0) return;
				/* v8 ignore next -- defensive: the primary button is disabled while empty||disabled, so a click cannot reach the false arm. */
				if (!empty && !disabled && !machineBusy) inputActions.submit();
			};
			const accessSelect = command === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PermissionSelect, {
				value: permissions,
				locked,
				command,
				t
			}, sessionId);
			const deco = input === void 0 ? INERT_DECORATIONS : deriveDecorations(input, lexicon);
			const backdrop = [];
			{
				let cursor = 0;
				const pushPlain = (upTo) => {
					if (upTo > cursor) backdrop.push(draft.slice(cursor, upTo));
					cursor = upTo;
				};
				if (deco.token !== null) {
					backdrop.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("mark", {
						className: InputBar_module_css_default.hlToken,
						"data-decoration": "token",
						children: draft.slice(deco.token.start, deco.token.end)
					}, "token"));
					cursor = deco.token.end;
				}
				const boundaries = [...deco.chips.map((chip) => ({
					at: chip.offset,
					kind: "chip",
					chip
				})), ...deco.textRefs.map((ref) => ({
					at: ref.start,
					kind: "text-ref",
					ref
				}))].sort((a, b) => {
					return a.at - b.at;
				});
				for (const b of boundaries) {
					if (b.at < cursor) continue;
					pushPlain(b.at);
					if (b.kind === "chip") {
						const chip = b.chip;
						backdrop.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: clsx(InputBar_module_css_default.chip, chip.invalid && InputBar_module_css_default.chipInvalid),
							"data-decoration": "chip",
							"data-occurrence": chip.occurrenceId,
							"data-invalid": chip.invalid || void 0,
							title: chip.label,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: InputBar_module_css_default.chipLabel,
								children: chip.label
							})
						}, `chip-${chip.occurrenceId}`));
						cursor = chip.offset + 1;
					} else {
						backdrop.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("mark", {
							className: InputBar_module_css_default.textRef,
							"data-decoration": "text-ref",
							children: draft.slice(b.ref.start, b.ref.end)
						}, `ref-${b.ref.start}`));
						cursor = b.ref.end;
					}
				}
				pushPlain(draft.length);
				if (deco.hint !== null) {
					const commandName = input?.claim?.token.slice(1).trim() ?? "";
					const hintKey = `hint.${commandName === "goal" && hasGoal ? "goal.active" : commandName}`;
					const translated = t(hintKey);
					const displayHint = translated !== hintKey ? translated : deco.hint;
					backdrop.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: InputBar_module_css_default.hint,
						"data-decoration": "hint",
						children: displayHint
					}, "hint"));
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(InputBar_module_css_default.root, variant === "hero" && InputBar_module_css_default.hero),
				children: [
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: InputBar_module_css_default.error,
						role: "alert",
						children: error.message
					}),
					notice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: clsx(InputBar_module_css_default.notice, notice.level === "error" && InputBar_module_css_default.noticeError),
						role: "status",
						children: notice.text
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: InputBar_module_css_default.card,
						"data-composer-card": true,
						children: [
							overlay !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: InputBar_module_css_default.overlayAnchor,
								children: overlay
							}),
							accessory !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: InputBar_module_css_default.accessory,
								children: accessory
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								ref: scrollRef,
								className: InputBar_module_css_default.scroll,
								"data-input-scroll": true,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: InputBar_module_css_default.grow,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											"aria-hidden": true,
											className: InputBar_module_css_default.backdrop,
											"data-input-backdrop": true,
											children: backdrop
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
											ref: inputRef,
											className: InputBar_module_css_default.input,
											value: draft,
											disabled: locked,
											readOnly: machineBusy,
											"data-phase": input?.phase ?? "inert",
											placeholder: placeholder ?? (disabled ? t("placeholder.unavailable") : planActive ? t("placeholder.plan") : t("placeholder.default")),
											rows: 2,
											onChange,
											onKeyDown,
											onSelect,
											onCopy: (e) => {
												onCopyOrCut(e, false);
											},
											onCut: (e) => {
												onCopyOrCut(e, true);
											},
											onPaste,
											onCompositionStart,
											onCompositionEnd
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											ref: mirrorRef,
											"aria-hidden": true,
											className: InputBar_module_css_default.mirror,
											"data-input-mirror": true,
											children: `${draft}\n`
										})
									]
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: InputBar_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: InputBar_module_css_default.tools,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											label: t("input.commands"),
											side: "top",
											delayMs: 500,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: InputBar_module_css_default.add,
												"aria-label": t("input.commands"),
												"aria-haspopup": "listbox",
												"aria-expanded": commandMenuOpen,
												disabled: locked || toggleCommandMenu === void 0,
												onMouseDown: keepFocus,
												onClick: onToggleCommandMenu,
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 14 })
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: InputBar_module_css_default.modes,
											children: [accessSelect, renderSlot("conversation.input.plan", { locked })]
										}),
										leftItems
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: InputBar_module_css_default.trailing,
									children: [
										rightItems,
										renderSlot("conversation.input.model", { locked }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextMeter, {
											useProjection,
											t
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											label: primaryLabel,
											side: "top",
											delayMs: 500,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: InputBar_module_css_default.primary,
												"aria-label": primaryLabel,
												disabled: stopping ? stop === void 0 : empty || disabled || machineBusy,
												onMouseDown: keepFocus,
												onClick: onPrimary,
												children: stopping ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
													viewBox: "0 0 16 16",
													width: "16",
													height: "16",
													"aria-hidden": true,
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
														x: "3",
														y: "3",
														width: "10",
														height: "10",
														rx: "3",
														fill: "currentColor"
													})
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
													viewBox: "0 0 16 16",
													width: "16",
													height: "16",
													"aria-hidden": true,
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
														d: "M8.3125 0.980183C8.66767 1.0531 8.97902 1.20418 9.2627 1.43233C9.48724 1.61297 9.73029 1.85793 9.97949 2.10714L14.707 6.83468L13.293 8.24874L9 3.95577V15.0417H7V3.95577L2.70703 8.24874L1.29297 6.83468L6.02051 2.10714C6.26971 1.85793 6.51277 1.61297 6.7373 1.43233C6.97662 1.23986 7.28445 1.04402 7.6875 0.980183C7.8973 0.947006 8.1031 0.95516 8.3125 0.980183Z",
														fill: "currentColor"
													})
												})
											})
										})
									]
								})]
							})
						]
					}),
					footer
				]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/settings/EnterBehaviorRow.module.css.mjs
		const css$15 = ".CG4aUa_row{border-bottom:1px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}.CG4aUa_rowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}.CG4aUa_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}.CG4aUa_desc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}.CG4aUa_selector{background:var(--dsw-alias-bg-module-platform);height:36px;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;border-radius:18px;align-items:center;gap:12px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.CG4aUa_selector:hover{background:var(--dsw-alias-interactive-bg-hover)}.CG4aUa_chevron{flex:none}";
		const tagId$15 = "@deepseek-ai/dsh-client-ui-conversation/EnterBehaviorRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$15) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$15;
			tag.textContent = css$15;
			document.head.appendChild(tag);
		}
		var EnterBehaviorRow_module_css_default = {
			"selector": "CG4aUa_selector",
			"chevron": "CG4aUa_chevron",
			"row": "CG4aUa_row",
			"rowText": "CG4aUa_rowText",
			"desc": "CG4aUa_desc",
			"title": "CG4aUa_title"
		};
		//#endregion
		//#region src/client/settings/EnterBehaviorRow.tsx
		/** General Settings row for the Composer's busy-state Enter preference. */
		const OPTIONS = [{
			id: "queue",
			label: "settings.enter.queue"
		}, {
			id: "steer",
			label: "settings.enter.steer"
		}];
		/**
		* Render the busy-state Enter behavior selector.
		* @param props - composed Settings slot props.
		* @returns the preference row.
		*/
		function EnterBehaviorRow({ useBusyEnter, setBusyEnter, t }) {
			const behavior = useBusyEnter((value) => value);
			const [open, setOpen] = (0, react.useState)(false);
			const selectedLabel = behavior !== "queue" ? "settings.enter.steer" : "settings.enter.queue";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: EnterBehaviorRow_module_css_default.row,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: EnterBehaviorRow_module_css_default.rowText,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: EnterBehaviorRow_module_css_default.title,
						children: t("settings.enter.title")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: EnterBehaviorRow_module_css_default.desc,
						children: t("settings.enter.description")
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
					open,
					onClose: () => {
						setOpen(false);
					},
					items: OPTIONS.map((option) => ({
						id: option.id,
						label: t(option.label)
					})),
					selectedId: behavior,
					onSelect: (id) => {
						setOpen(false);
						setBusyEnter(id);
					},
					align: "end",
					portal: true,
					anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: EnterBehaviorRow_module_css_default.selector,
						"aria-haspopup": "menu",
						"aria-expanded": open,
						onClick: () => {
							setOpen((value) => !value);
						},
						children: [t(selectedLabel), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { className: EnterBehaviorRow_module_css_default.chevron })]
					})
				})]
			});
		}
		//#endregion
		//#region src/client/chat/chat-flow.ts
		/** True when the node has model-visible text content worth IconActions chrome. */
		function hasContentText$1(blocks) {
			return blocks.some((block) => block.kind === "text" && block.text.trim() !== "");
		}
		/** An assistant node that renders nothing: only tool-call heads (rows render
		*  via the grouping pass) and blank text/reasoning. Skipped by the flow so it
		*  neither costs column gaps nor splits a tool-row run. Interrupted nodes
		*  always render (the 已停止 marker). */
		function rendersNothing(node) {
			return node.kind === "assistant" && node.interrupted !== true && node.blocks.every((b) => b.kind === "tool-call" || (b.kind === "text" || b.kind === "reasoning") && b.text.trim() === "");
		}
		/**
		* Seq set of assistants that own IconActions: the last content-text assistant
		* in each turn. Mid-turn narration (text before tools) stays chrome-free.
		* @param nodes - snapshot nodes (surface order).
		* @returns Seq values ChatView may pass as `time` into AssistantMarkdown.
		*/
		function assistantActionsSeqs(nodes) {
			const lastByTurn = /* @__PURE__ */ new Map();
			for (const node of nodes) {
				if (node.kind !== "assistant" || !hasContentText$1(node.blocks)) continue;
				lastByTurn.set(node.turn, node.seq);
			}
			return new Set(lastByTurn.values());
		}
		/**
		* Exact start time of the latest in-window turn without a matching end time.
		* @param turnTimings - In-window turn timings in event order.
		* @returns Unix epoch ms, or null when the running turn started outside the window.
		*/
		function runningTurnStartTime(turnTimings) {
			let latest = null;
			for (const timing of turnTimings.values()) if (timing.endTime === void 0) latest = timing.startTime;
			return latest;
		}
		/**
		* Seq set of message rows that may fork: the last transcript node of a
		* completed turn, when that node owns message chrome. A later tool, reasoning,
		* error, or other transcript node leaves the earlier message's branch action
		* unavailable because the Host would include the whole turn.
		* @param nodes - snapshot nodes in event order.
		* @param turnEnds - completed turn boundaries retained from the event window.
		* @returns Message seq values whose visible position matches the fork boundary.
		*/
		function messageBranchSeqs(nodes, turnEnds) {
			const result = /* @__PURE__ */ new Set();
			const boundaries = [...turnEnds].sort((a, b) => a[1] - b[1]);
			let nodeIndex = 0;
			for (const [turn, endSeq] of boundaries) {
				let tail;
				while (nodeIndex < nodes.length) {
					const candidate = nodes[nodeIndex];
					if (candidate === void 0 || candidate.seq > endSeq) break;
					tail = candidate;
					nodeIndex++;
				}
				if (tail?.kind === "user" || tail?.kind === "steering" || tail?.kind === "assistant" && tail.turn === turn && hasContentText$1(tail.blocks)) result.add(tail.seq);
			}
			return result;
		}
		/**
		* Group finalized nodes into the step-summary flow.
		* @param nodes - snapshot nodes in human-transcript and durable-notice order.
		* @returns flow items; consecutive tool results group and retry notices reuse their first key.
		*/
		function deriveChatFlow(nodes) {
			const items = [];
			let group = null;
			for (const node of nodes) {
				if (rendersNothing(node)) continue;
				if (node.kind === "tool-result") if (group === null) {
					group = [node];
					items.push({
						kind: "tool-group",
						key: `g${node.seq}`,
						results: group
					});
				} else group.push(node);
				else if (node.kind === "model-retry") {
					group = null;
					const previous = items[items.length - 1];
					if (previous?.kind === "node" && previous.node.kind === "model-retry") items[items.length - 1] = {
						...previous,
						node
					};
					else items.push({
						kind: "node",
						key: `n${node.seq}`,
						node
					});
				} else {
					group = null;
					items.push({
						kind: "node",
						key: `n${node.seq}`,
						node
					});
				}
			}
			return items;
		}
		//#endregion
		//#region src/client/chat/use-calendar-day.ts
		/**
		* Local calendar-day epoch that advances at each local midnight.
		* @returns Midnight ms for the current local day; updates after the boundary.
		*/
		function useCalendarDay() {
			const [day, setDay] = (0, react.useState)(() => {
				return startOfLocalDay(Date.now());
			});
			(0, react.useEffect)(() => {
				let timer;
				const arm = () => {
					const now = Date.now();
					setDay(startOfLocalDay(now));
					timer = setTimeout(arm, msUntilNextLocalMidnight(now));
				};
				timer = setTimeout(arm, msUntilNextLocalMidnight(Date.now()));
				return () => {
					clearTimeout(timer);
				};
			}, []);
			return day;
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/chat/MessageIconActions.module.css.mjs
		const css$14 = ".SYl19q_actions{align-items:center;gap:10px;height:28px;display:flex}.SYl19q_timeStart{color:var(--dsw-alias-label-tertiary);white-space:nowrap;padding-right:12px;font-size:14px;line-height:24px}.SYl19q_timeEnd{color:var(--dsw-alias-label-tertiary);white-space:nowrap;padding-left:12px;font-size:14px;line-height:24px}.SYl19q_runTimeDot{margin:0 10px}@media (hover:hover){[data-time-hover-root] :is(.SYl19q_timeStart,.SYl19q_timeEnd){opacity:0;transition:opacity 80ms}[data-time-hover-root]:hover :is(.SYl19q_timeStart,.SYl19q_timeEnd),[data-time-hover-root]:focus-within :is(.SYl19q_timeStart,.SYl19q_timeEnd){opacity:1}}.SYl19q_action{width:28px;height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:28px;justify-content:center;align-items:center;padding:6px;display:inline-flex}.SYl19q_action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.SYl19q_action[data-unavailable]{cursor:default;opacity:.4}.SYl19q_action[data-unavailable]:hover{color:var(--dsw-alias-label-tertiary);background:0 0}.SYl19q_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}";
		const tagId$14 = "@deepseek-ai/dsh-client-ui-conversation/MessageIconActions.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$14) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$14;
			tag.textContent = css$14;
			document.head.appendChild(tag);
		}
		var MessageIconActions_module_css_default = {
			"timeStart": "SYl19q_timeStart",
			"action": "SYl19q_action",
			"actions": "SYl19q_actions",
			"timeEnd": "SYl19q_timeEnd",
			"runTimeDot": "SYl19q_runTimeDot",
			"visuallyHidden": "SYl19q_visuallyHidden"
		};
		//#endregion
		//#region src/client/chat/MessageIconActions.tsx
		/**
		* Copy / branch (/ clock) IconActions row shared by user and assistant chrome.
		* @param props - Copy text, event time, clock side, branch callback, className.
		* @returns The actions row element.
		*/
		function MessageIconActions({ text, time, runMs, ttftMs, tokensPerSecond, clock, onBranch, branchUnavailable = false, showBranch = true, className, t }) {
			const day = useCalendarDay();
			const reasonId = (0, react.useId)();
			const [copied, setCopied] = (0, react.useState)(false);
			const copyPending = (0, react.useRef)(false);
			const copyTimer = (0, react.useRef)(null);
			const copyEpoch = (0, react.useRef)(0);
			(0, react.useEffect)(() => () => {
				copyEpoch.current += 1;
				copyPending.current = false;
				if (copyTimer.current !== null) clearTimeout(copyTimer.current);
			}, []);
			const onCopy = (0, react.useCallback)(() => {
				if (copied || copyPending.current) return;
				const epoch = copyEpoch.current;
				copyPending.current = true;
				(0, _deepseek_ai_dsh_client_ui_primitives.writeClipboard)(text).then((ok) => {
					if (epoch !== copyEpoch.current) return;
					copyPending.current = false;
					if (!ok) return;
					setCopied(true);
					copyTimer.current = window.setTimeout(() => {
						copyTimer.current = null;
						setCopied(false);
					}, 1e3);
				});
			}, [copied, text]);
			const clockEl = time === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: clock === "start" ? MessageIconActions_module_css_default.timeStart : MessageIconActions_module_css_default.timeEnd,
				children: [
					formatMessageClock(time, t, day),
					runMs !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						" ",
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MessageIconActions_module_css_default.runTimeDot,
							"aria-hidden": true,
							children: "·"
						}),
						" ",
						t("message.ranFor", { duration: formatRunDuration(runMs, t) })
					] }),
					ttftMs !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						" ",
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MessageIconActions_module_css_default.runTimeDot,
							"aria-hidden": true,
							children: "·"
						}),
						" ",
						t("message.ttft", { seconds: formatLatencySeconds(ttftMs) })
					] }),
					tokensPerSecond !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						" ",
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MessageIconActions_module_css_default.runTimeDot,
							"aria-hidden": true,
							children: "·"
						}),
						" ",
						t("message.tokensPerSecond", { tps: formatTokensPerSecond(tokensPerSecond) })
					] })
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: className === void 0 ? MessageIconActions_module_css_default.actions : `${MessageIconActions_module_css_default.actions} ${className}`,
				children: [
					clock === "start" ? clockEl : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						label: copied ? t("copied") : t("copy"),
						side: "bottom",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: MessageIconActions_module_css_default.action,
							"aria-label": copied ? t("copied") : t("copy"),
							onClick: onCopy,
							children: copied ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutline16, {})
						})
					}),
					showBranch && onBranch !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						label: branchUnavailable ? t("message.branchUnavailable") : t("message.branch"),
						side: "bottom",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: MessageIconActions_module_css_default.action,
							"aria-label": t("message.branch"),
							"aria-disabled": branchUnavailable || void 0,
							"aria-describedby": branchUnavailable ? reasonId : void 0,
							"data-unavailable": branchUnavailable || void 0,
							onClick: branchUnavailable ? void 0 : onBranch,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutline16, {})
						})
					}),
					showBranch && onBranch !== void 0 && branchUnavailable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						id: reasonId,
						className: MessageIconActions_module_css_default.visuallyHidden,
						children: t("message.branchUnavailable")
					}),
					clock === "end" ? clockEl : null
				]
			});
		}
		//#endregion
		//#region src/client/contract/diff-card-model.ts
		/**
		* Narrow a wire `card:'diff'` view's `diffs` to well-formed hunks. The event
		* view crosses the wire and `toolEventViewSchema` validates only the `card`
		* string, so a version mismatch or an anomalous plugin can deliver a `diff` card
		* whose `diffs` is absent, not an array, or carries malformed hunks. Returning
		* null for any of those routes the block to the generic path instead of letting
		* DiffBlock's `for...of`/`split` throw and crash the row or the details panel.
		* @param diffs - the view's `diffs` field, unverified.
		* @returns the validated hunks, or null when the payload is not usable.
		*/
		function narrowDiffs(diffs) {
			if (!Array.isArray(diffs) || diffs.length === 0) return null;
			const out = [];
			for (const hunk of diffs) {
				if (typeof hunk !== "object" || hunk === null) return null;
				const { path, oldText, newText } = hunk;
				if (typeof path !== "string") return null;
				if (oldText !== null && typeof oldText !== "string") return null;
				if (typeof newText !== "string") return null;
				out.push({
					path,
					oldText,
					newText
				});
			}
			return out;
		}
		/**
		* Derive the diff-card props for a tool call, or null when this call is not a
		* diff card and belongs on the generic path.
		*
		* The result side is authoritative once the call settles: the write/edit tools
		* return the applied contextual hunks there (an edit's real before/after, a
		* create's whole-file diff), which replace the call-time diff derived from the
		* arguments alone. While the call is still running only the call side exists,
		* so a running write/edit shows its intended change. Null is the documented
		* generic-card default and covers every non-diff card — including a `card`
		* value this UI version does not know, which arrives over the wire and cannot
		* be trusted to be one of the compiled variants — and a settled call whose
		* result view is generic (how write/edit keep their execution errors on the
		* generic path).
		*
		* This derivation consumes only `diffs`; the render intent's `title` field is
		* deliberately dropped. The row supplies its own title (`Edit`/`Write · path`
		* from the args), which outranks the view's `title`. A tool that names its own
		* diff header therefore does not surface that text on the Web row.
		* @param block - RunningToolCall or ToolResultNode off the snapshot caches.
		* @returns the diff-card props, or null for the generic path.
		*/
		function diffCardModel(block) {
			if (!("kind" in block)) {
				const call = block.callView?.card === "diff" ? block.callView : null;
				const diffs = call === null ? null : narrowDiffs(call.diffs);
				return diffs === null ? null : { card: { diffs } };
			}
			const result = block.resultView?.card === "diff" ? block.resultView : null;
			const diffs = result === null ? null : narrowDiffs(result.diffs);
			return diffs === null ? null : { card: { diffs } };
		}
		//#endregion
		//#region src/client/contract/read-card-model.ts
		/**
		* Derive the read-card props for a tool call, or null when this call is not a
		* read card and belongs on the generic path.
		*
		* The read card is result-side only, so only a settled call whose result view
		* declares `card:'read'` produces one. Every other case is null — the
		* documented generic-card default:
		*
		* - A running call: it has no result view yet, and a read carries no content at
		*   call time.
		* - A settled call whose result view is not a read card — including a `card`
		*   value this UI version does not know, which arrives over the wire and cannot
		*   be trusted to be one of the compiled variants, and the read tool's own
		*   generic fallback for an error result or a non-envelope body.
		*
		* The label is the read view's `title` when the tool supplied one (the
		* presentation contract's replacement-title rule), otherwise the file path
		* relativized to the session workspace so a workspace-rooted absolute path
		* displays the same short form the row summary shows.
		* @param block - RunningToolCall or ToolResultNode off the snapshot caches.
		* @param sessionCwd - the session workspace root; a workspace-rooted absolute
		*   path label displays relative to it. Absent leaves the path as authored.
		* @returns the read-card props, or null for the generic path.
		*/
		function readCardModel(block, sessionCwd) {
			if (!("kind" in block)) return null;
			const result = block.resultView?.card === "read" ? block.resultView : null;
			if (result === null) return null;
			const lines = result.lines.map((line) => ({
				number: line.number,
				text: line.text
			}));
			return {
				label: result.title ?? relativizeToCwd(result.path, sessionCwd),
				lines,
				totalLines: result.totalLines,
				lang: result.lang
			};
		}
		//#endregion
		//#region src/client/contract/search-card-model.ts
		/**
		* Whether every file group in a matches view is structurally valid: the wire
		* frame carries `shape` and `card` as strings the host schema checks, but not the
		* grouped shape, so a version mismatch or loose producer could deliver
		* `shape: 'matches'` with a missing or malformed `files`. Rendering that would
		* crash {@link SearchBlock} at `.reduce`/`.map`; an invalid shape falls to the
		* generic path instead.
		* @param files - the candidate `files` field off the untrusted result view.
		* @returns whether `files` is a valid {@link SearchFileGroup} array.
		*/
		function isValidFiles(files) {
			return Array.isArray(files) && files.every((file) => typeof file === "object" && file !== null && typeof file.path === "string" && Array.isArray(file.matches) && file.matches.every((match) => typeof match === "object" && match !== null && typeof match.lineNumber === "number" && typeof match.line === "string"));
		}
		/**
		* Flatten a settled tool result's content blocks to their text, joined by
		* newlines. The search view carries no result text — a UI without a card falls
		* back to the raw `tool/result` content — so the truncation recovery footer is
		* read from the block's own content here. Non-text blocks (a search result
		* carries none) are skipped.
		* @param content - the result node's content blocks.
		* @returns the joined text, or undefined when empty.
		*/
		function flattenContent(content) {
			const text = content.filter((block) => block.type === "text" && typeof block.text === "string").map((block) => block.text).join("\n");
			return text === "" ? void 0 : text;
		}
		/**
		* Derive the search-card props for a tool call, or null when this call is not a
		* search card and belongs on the generic path.
		*
		* Only the result side matters: the search card carries no call-time state, so
		* a still-running call (no result view) is null, as is a settled call whose
		* result view is not a search card — including a `card` value this UI version
		* does not know, which arrives over the wire and cannot be trusted to be one of
		* the compiled variants, a `card: 'search'` view whose `shape` is neither
		* `matches` nor `paths` (equally untrusted wire data), and a generic result a
		* `grep`/`glob` failure or nested `run_code` dispatch produces (its text keeps
		* the generic path).
		* @param block - RunningToolCall or ToolResultNode off the snapshot caches.
		* @returns the search-card props, or null for the generic path.
		*/
		function searchCardModel(block) {
			if (!("kind" in block)) return null;
			const result = block.resultView?.card === "search" ? block.resultView : null;
			if (result === null) return null;
			const common = {
				truncated: result.truncated,
				total: result.total
			};
			const recovery = result.truncated ? flattenContent(block.content) : void 0;
			if (result.shape === "matches") {
				if (!isValidFiles(result.files)) return null;
				return {
					title: result.title,
					recovery,
					card: {
						kind: "matches",
						files: result.files,
						...common
					}
				};
			}
			if (result.shape !== "paths") return null;
			if (!Array.isArray(result.paths) || !result.paths.every((path) => {
				return typeof path === "string";
			})) return null;
			return {
				title: result.title,
				recovery,
				card: {
					kind: "paths",
					paths: result.paths,
					...common
				}
			};
		}
		//#endregion
		//#region src/client/contract/terminal-card-model.ts
		/**
		* Build the TerminalBlock display copy from the conversation locale seat —
		* the one place the primitive's label surface pairs with this package's
		* dictionary, shared by every terminal render site (chat row, bash row,
		* details panel).
		* @param t - the render site's conversation locale seat.
		* @returns the full label set for {@link TerminalBlockProps}'s `labels`.
		*/
		function terminalBlockLabels(t) {
			return {
				signal: (signal) => t("terminal.signal", { signal }),
				exitCode: (code) => t("terminal.exitCode", { code }),
				running: t("terminal.running"),
				failed: t("terminal.failed"),
				done: t("terminal.done"),
				copy: t("copy"),
				copied: t("copied"),
				noOutput: t("terminal.noOutput"),
				collapseAria: t("terminal.collapseAria"),
				collapse: t("collapse"),
				expandAria: (hidden) => t("terminal.expandAria", { n: hidden }),
				expand: (hidden) => t("terminal.expandRest", { n: hidden })
			};
		}
		/**
		* True when a settled terminal card reports a failing exit — a non-zero code
		* or a terminating signal. The bash tool settles a failing command as a
		* completed call (`isError` stays false: the exit status is result data), so
		* this is the collapsed row's only failure signal; without it the red exit
		* pill would be visible only after expanding the card.
		* @param model - a derived terminal card.
		* @returns whether the card's exit status is a failure.
		*/
		function terminalFailed(model) {
			const { exitCode, signal, running } = model.card;
			return running !== true && (exitCode !== void 0 && exitCode !== 0 || signal !== void 0);
		}
		/**
		* Resolve a terminal view's working directory the way the render-intent
		* contract assigns to the UI bridge: an absolute path is used as-is, a relative
		* one joins under the session workspace, and an omitted one IS the session
		* workspace. A pure presenter cannot see the session cwd, which is why this
		* resolution belongs here rather than in the tool. Without a session cwd there
		* is nothing to resolve against, so a relative path stays as authored and an
		* omitted one stays absent (the prompt row then draws a bare `$`).
		* @param viewCwd - the cwd the terminal call view carries, if any.
		* @param sessionCwd - the session workspace root, if the caller knows it.
		* @returns the working directory for the prompt label, or undefined.
		*/
		function resolveTerminalCwd(viewCwd, sessionCwd) {
			if (viewCwd === void 0 || viewCwd === "") return sessionCwd;
			if (sessionCwd === void 0 || sessionCwd === "") return normalizeSegments(viewCwd);
			return normalizeSegments(resolveToolPath(sessionCwd, viewCwd));
		}
		/**
		* Collapse `.` and `..` segments so the prompt label names the directory the
		* command actually ran in. The bash executor resolves the workdir before
		* running, so a joined `/w/app/..` must display as `w`, not as `..`. Separators
		* are preserved as authored (a Windows path keeps its backslashes) because this
		* value is only ever displayed; a `..` that would climb past the root is
		* dropped, which is what a filesystem does with it. A UNC path's `server` and
		* `share` are part of its root, not poppable segments: Windows cannot climb
		* above a share, so `\\\\server\\share` with a `..` stays there.
		* @param path - a joined or absolute path, possibly carrying `.`/`..` segments.
		* @returns the same path with those segments resolved.
		*/
		function normalizeSegments(path) {
			if (!/(?:^|[/\\])\.\.?(?:[/\\]|$)/.test(path)) return path;
			const unc = /^[/\\]{2}([^/\\]+)[/\\]+([^/\\]+)/.exec(path);
			if (unc !== null) {
				const [matched, server, share] = unc;
				const root = `\\\\${String(server)}\\${String(share)}`;
				const rest = collapse(path.slice(matched.length), true);
				return rest === "" ? root : `${root}\\${rest}`;
			}
			const separator = path.includes("\\") && !path.includes("/") ? "\\" : "/";
			const rooted = /^[/\\]/.test(path);
			const drive = /^[A-Za-z]:/.exec(path)?.[0] ?? "";
			const body = collapse(path.slice(drive.length), rooted || drive !== "", separator);
			const leading = rooted ? separator : "";
			return drive === "" ? `${leading}${body}` : `${drive}${rooted ? leading : separator}${body}`;
		}
		/**
		* Collapse the `.`/`..` segments of a path body against a known root state.
		* @param body - the path after any drive letter or UNC root.
		* @param rooted - the body hangs off a root, so a `..` at its top is dropped
		*   the way a filesystem drops one; without a root the `..` is kept, since it
		*   stays meaningful against a cwd this function cannot see.
		* @param separator - separator to rejoin with (default `/`).
		* @returns the collapsed body, without leading or trailing separators.
		*/
		function collapse(body, rooted, separator = "/") {
			const kept = [];
			for (const segment of body.split(/[/\\]/)) {
				if (segment === "" || segment === ".") continue;
				if (segment === "..") {
					if (kept.length > 0 && kept[kept.length - 1] !== "..") kept.pop();
					else if (!rooted) kept.push(segment);
					continue;
				}
				kept.push(segment);
			}
			return kept.join(separator);
		}
		/**
		* Derive the terminal-card props for a tool call, or null when this call is
		* not a terminal card and belongs on the generic path.
		*
		* The call side supplies the command and its working directory; the result
		* side supplies the captured output and exit status. Three cases produce
		* null, all of them the documented generic-card default:
		*
		* - Neither side declares `card:'terminal'` — including a `card` value this
		*   UI version does not know, which arrives over the wire and therefore
		*   cannot be trusted to be one of the compiled variants.
		* - A settled call whose result view is not a terminal card: the result
		*   presentation decides how the settled call renders, and the bash tool
		*   returns a generic fenced card for an execution error or a background
		*   start, whose text and error styling the generic path preserves.
		*
		* Window truncation can drop the call head from a settled result (see
		* `ToolResultNode.call`/`callView` in dsh-client-runtime), leaving a terminal
		* result with no call side. That still renders: the command falls back to the
		* result view's replacement title, then to an empty command (the prompt line
		* draws bare), and the prompt shows no cwd.
		* @param block - RunningToolCall or ToolResultNode off the snapshot caches.
		* @param sessionCwd - the session workspace root, which resolves an omitted or
		*   relative view cwd (see {@link resolveTerminalCwd}); absent leaves both unresolved.
		* @returns the terminal-card props, or null for the generic path.
		*/
		function terminalCardModel(block, sessionCwd) {
			const call = block.callView?.card === "terminal" ? block.callView : null;
			if (!("kind" in block)) return call === null ? null : {
				description: call.description,
				card: {
					command: call.title,
					cwd: resolveTerminalCwd(call.cwd, sessionCwd),
					output: void 0,
					exitCode: void 0,
					signal: void 0,
					running: true
				}
			};
			const result = block.resultView?.card === "terminal" ? block.resultView : null;
			if (result === null) return null;
			return {
				description: call?.description,
				card: {
					command: result.title ?? call?.title ?? "",
					cwd: call === null ? void 0 : resolveTerminalCwd(call.cwd, sessionCwd),
					output: result.output,
					exitCode: result.exitCode,
					signal: result.signal,
					running: false
				}
			};
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/chat/DisclosureRow.module.css.mjs
		const css$13 = ".c0PUwq_root{flex-direction:column;width:100%;min-width:0;display:flex}.c0PUwq_row{align-items:center;min-width:0;height:24px;display:flex;position:relative;overflow:hidden}.c0PUwq_row[data-expandable]{cursor:pointer}.c0PUwq_leading{width:16px;height:16px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;flex:none;justify-content:center;align-items:center;margin-right:6px;padding:0;display:inline-flex;position:relative}button.c0PUwq_leading{cursor:pointer}.c0PUwq_iconIdle{opacity:1;transition:opacity .1s;display:inline-flex}.c0PUwq_chevronHover{opacity:0;margin:auto;transition:opacity .1s;position:absolute;inset:0}.c0PUwq_row:hover .c0PUwq_iconIdle{opacity:0}.c0PUwq_row:hover .c0PUwq_chevronHover{opacity:1}.c0PUwq_title{color:var(--dsw-alias-label-secondary);flex:none;font-size:14px;line-height:24px}";
		const tagId$13 = "@deepseek-ai/dsh-client-ui-conversation/DisclosureRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$13) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$13;
			tag.textContent = css$13;
			document.head.appendChild(tag);
		}
		var DisclosureRow_module_css_default = {
			"leading": "c0PUwq_leading",
			"chevronHover": "c0PUwq_chevronHover",
			"title": "c0PUwq_title",
			"iconIdle": "c0PUwq_iconIdle",
			"root": "c0PUwq_root",
			"row": "c0PUwq_row"
		};
		//#endregion
		//#region src/client/chat/DisclosureRow.tsx
		/**
		* Render one disclosure header and its controlled expanded content.
		* @param props - Visual content, controlled state, and interaction policy.
		* @returns The disclosure row.
		*/
		function DisclosureRow({ icon, title, open, expandable, onToggle, expandOnRowClick = false, previewChevron = expandable, keepContentWhenOpen = false, collapsedContent, children, className, rowClassName, leadingClassName, chevronClassName, titleClassName }) {
			const rowExpands = expandable && expandOnRowClick;
			const toggleFromLeading = (event) => {
				event.stopPropagation();
				onToggle();
			};
			const toggleFromKeyboard = (event) => {
				if (!rowExpands || event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				onToggle();
			};
			const collapsedLeading = previewChevron ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: DisclosureRow_module_css_default.iconIdle,
				children: icon
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { className: clsx(chevronClassName, DisclosureRow_module_css_default.chevronHover) })] }) : icon;
			const leading = open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { className: chevronClassName }) : collapsedLeading;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(DisclosureRow_module_css_default.root, className),
				"data-open": open || void 0,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: clsx(DisclosureRow_module_css_default.row, rowClassName),
					"data-disclosure-row": true,
					"data-expandable": rowExpands || void 0,
					role: rowExpands ? "button" : void 0,
					tabIndex: rowExpands ? 0 : void 0,
					"aria-expanded": rowExpands ? open : void 0,
					onClick: !rowExpands ? void 0 : onToggle,
					onKeyDown: rowExpands ? toggleFromKeyboard : void 0,
					children: [
						expandable && !rowExpands ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: clsx(DisclosureRow_module_css_default.leading, leadingClassName),
							"aria-expanded": open,
							onClick: toggleFromLeading,
							children: leading
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: clsx(DisclosureRow_module_css_default.leading, leadingClassName),
							children: leading
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: clsx(DisclosureRow_module_css_default.title, titleClassName),
							children: title
						}),
						(keepContentWhenOpen || !open) && collapsedContent
					]
				}), open && children]
			});
		}
		//#endregion
		//#region src/client/chat/use-throttled-visual-update.ts
		/** Frame-throttled scheduling for non-essential visual alignment. */
		const DEFAULT_INTERVAL_FRAMES = 3;
		/**
		* Return a stable scheduler that coalesces visual updates over a frame interval.
		* Repeated calls retain the latest callback, and unmount cancels pending work.
		* @param update - DOM alignment to run after the throttle interval.
		* @param intervalFrames - Frames to wait before applying the latest alignment.
		* @returns a stable function that schedules the latest update.
		*/
		function useThrottledVisualUpdate(update, intervalFrames = DEFAULT_INTERVAL_FRAMES) {
			const updateRef = (0, react.useRef)(update);
			updateRef.current = update;
			const pendingFrameRef = (0, react.useRef)(null);
			(0, react.useLayoutEffect)(() => () => {
				if (pendingFrameRef.current === null) return;
				cancelAnimationFrame(pendingFrameRef.current);
				pendingFrameRef.current = null;
			}, []);
			return (0, react.useCallback)(() => {
				if (pendingFrameRef.current !== null) return;
				let remainingFrames = intervalFrames;
				const advance = () => {
					remainingFrames -= 1;
					if (remainingFrames > 0) {
						pendingFrameRef.current = requestAnimationFrame(advance);
						return;
					}
					pendingFrameRef.current = null;
					updateRef.current();
				};
				pendingFrameRef.current = requestAnimationFrame(advance);
			}, [intervalFrames]);
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/chat/ToolRow.module.css.mjs
		const css$12 = ".zWOtqG_root{flex-direction:column;display:flex}.zWOtqG_row{position:relative;overflow:hidden}.zWOtqG_root[data-state=running] .zWOtqG_row:after{content:\"\";background:linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--dsw-alias-bg-base) 60%, transparent) 55%, transparent 100%);pointer-events:none;width:300px;animation:2.6s ease-out infinite zWOtqG_dsh-tool-row-sweep;position:absolute;top:0;bottom:0;left:0}@keyframes zWOtqG_dsh-tool-row-sweep{0%{left:-300px}90%,to{left:100%}}.zWOtqG_leading{flex-shrink:0}.zWOtqG_root[data-tool^=cordis_] .zWOtqG_leading,.zWOtqG_root[data-tool^=cordis_] .zWOtqG_title{color:var(--dsw-alias-state-business-primary)}.zWOtqG_root[data-tool^=cordis_] .zWOtqG_title{font-weight:500}.zWOtqG_root[data-tool^=cordis_] .zWOtqG_sep{background:var(--dsw-alias-state-business-primary)}.zWOtqG_chevron{color:var(--dsw-alias-label-secondary)}.zWOtqG_title{font-weight:400}.zWOtqG_sep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}.zWOtqG_summary{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-tertiary);flex:auto;font-size:14px;line-height:24px;overflow:hidden}.zWOtqG_summary[data-follow-end]{text-overflow:clip}.zWOtqG_fileLink{text-overflow:ellipsis;white-space:nowrap;min-width:0;font:inherit;text-align:left;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;flex:auto;margin:0;padding:0;font-size:14px;line-height:24px;overflow:hidden}.zWOtqG_fileLink:hover{text-decoration:underline}.zWOtqG_errorSummary{color:var(--dsw-alias-state-error-primary)}.zWOtqG_bodyWrap{flex-direction:column;display:flex}.zWOtqG_inspectButton{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:0;border-radius:999px;align-self:flex-start;align-items:center;gap:4px;margin:4px 0 2px 4px;padding:2px 8px;font-size:11px;line-height:16px;transition:opacity .1s;display:inline-flex}.zWOtqG_root:hover .zWOtqG_inspectButton,.zWOtqG_inspectButton:focus-visible{opacity:1}.zWOtqG_inspectButton:hover{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-primary)}.zWOtqG_bodyScroll{max-height:260px;overflow-y:auto}.zWOtqG_thinkBody{white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-tertiary);padding:4px 0 4px 22px;font-size:14px;line-height:24px}.zWOtqG_ioCard{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-markdown-code-block);font:var(--dsw-font-markdown-code-block-small);border-radius:12px;flex-direction:column;margin:4px 0 4px 4px;display:flex}.zWOtqG_ioSection{grid-template-columns:max-content 1fr;align-items:baseline;column-gap:14px;max-height:150px;padding:12px 16px;display:grid;overflow-y:auto}.zWOtqG_ioSection::-webkit-scrollbar-thumb{background-clip:padding-box;border:2px solid #0000;border-radius:6px}.zWOtqG_ioSection::-webkit-scrollbar-track{margin:6px 0}.zWOtqG_ioLabel{color:var(--dsw-alias-label-caption);align-self:start;position:sticky;top:0}.zWOtqG_ioDivider{background:var(--dsw-alias-border-l2);flex:none;height:1px}.zWOtqG_ioText{white-space:pre-wrap;word-break:break-word;min-width:0;color:var(--dsw-alias-label-secondary)}.zWOtqG_ioText[data-error]{color:var(--dsw-alias-state-error-primary)}.zWOtqG_codeBody,.zWOtqG_terminalBody,.zWOtqG_diffBody,.zWOtqG_readBody,.zWOtqG_searchBody,.zWOtqG_webBody{margin:4px 0 4px 4px}.zWOtqG_searchRecovery{white-space:pre-wrap;overflow-wrap:anywhere;font:var(--dsw-font-xs-13);color:var(--dsw-alias-label-tertiary);margin:4px 0 4px 4px}.zWOtqG_codeBody{--dsl-code-block-content-font:var(--dsw-font-markdown-code-block-small)}.zWOtqG_terminalBody{--dsl-terminal-font:var(--dsw-font-markdown-code-block-small);--dsl-terminal-line-height:18px;--dsl-terminal-output-max-height:224px;border:1px solid var(--dsw-alias-border-l1)}.zWOtqG_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}";
		const tagId$12 = "@deepseek-ai/dsh-client-ui-conversation/ToolRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$12) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$12;
			tag.textContent = css$12;
			document.head.appendChild(tag);
		}
		var ToolRow_module_css_default = {
			"root": "zWOtqG_root",
			"chevron": "zWOtqG_chevron",
			"errorSummary": "zWOtqG_errorSummary",
			"thinkBody": "zWOtqG_thinkBody",
			"ioSection": "zWOtqG_ioSection",
			"terminalBody": "zWOtqG_terminalBody",
			"dsh-tool-row-sweep": "zWOtqG_dsh-tool-row-sweep",
			"sep": "zWOtqG_sep",
			"diffBody": "zWOtqG_diffBody",
			"readBody": "zWOtqG_readBody",
			"ioText": "zWOtqG_ioText",
			"codeBody": "zWOtqG_codeBody",
			"summary": "zWOtqG_summary",
			"searchBody": "zWOtqG_searchBody",
			"webBody": "zWOtqG_webBody",
			"leading": "zWOtqG_leading",
			"ioLabel": "zWOtqG_ioLabel",
			"searchRecovery": "zWOtqG_searchRecovery",
			"visuallyHidden": "zWOtqG_visuallyHidden",
			"ioDivider": "zWOtqG_ioDivider",
			"bodyWrap": "zWOtqG_bodyWrap",
			"ioCard": "zWOtqG_ioCard",
			"inspectButton": "zWOtqG_inspectButton",
			"bodyScroll": "zWOtqG_bodyScroll",
			"row": "zWOtqG_row",
			"title": "zWOtqG_title",
			"fileLink": "zWOtqG_fileLink"
		};
		//#endregion
		//#region src/client/chat/ToolRow.tsx
		/** The Inspect pill's code glyph (user-supplied 16×16), fill follows text color. */
		function IconInspect() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "12",
				height: "12",
				viewBox: "0 0 16 16",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M16 8L10.8571 12V10.552L14.1383 8L10.8571 5.448V4L16 8ZM5.14286 10.552L1.86171 8L5.14286 5.448V4L0 8L5.14286 12V10.552ZM9.02514 4L5.59657 12H6.84057L10.2691 4H9.02514Z",
					fill: "currentColor"
				})
			});
		}
		/** Leading-slot state substitution: the tool icon yields to the terminal state
		*  semantic (error = red, interrupted = amber halo). Running keeps the icon —
		*  the row sweep (CSS on data-state) carries the in-flight signal. */
		function leadingFor$1(state, icon) {
			switch (state) {
				case "error": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "error" });
				case "stopped": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "warning" });
				default: return icon;
			}
		}
		/** Visually hidden run-state label: the StateDot and the CSS sweep are both
		*  aria-hidden / colour-only, so assistive technology needs this text to know a
		*  row is running, failed, or interrupted. null in the ok state (the icon and
		*  summary already describe a settled row). */
		function stateStatus$1(state, t) {
			switch (state) {
				case "running": return t("row.running");
				case "error": return t("row.failed");
				case "stopped": return t("row.stopped");
				default: return null;
			}
		}
		function ToolRow({ t, variant, toolName, icon, title, summary, body, output, errorSummary, terminal, diff, read, search, web, state, filePath, onOpenFile, inspect }) {
			const [expanded, setExpanded] = (0, react.useState)(false);
			const summaryRef = (0, react.useRef)(null);
			const terminalBody = terminal ?? null;
			const diffBody = diff ?? null;
			const readBody = read ?? null;
			const searchBody = search ?? null;
			const webBody = web ?? null;
			const outputText = output ?? null;
			const expandable = body !== null || outputText !== null || (terminalBody ?? diffBody ?? readBody ?? searchBody ?? webBody) !== null;
			const open = expanded && expandable;
			const status = stateStatus$1(state, t);
			const failureLine = state === "error" ? errorSummary ?? null : null;
			const summaryText = failureLine ?? summary;
			const fileLink = filePath !== void 0 && onOpenFile !== void 0 && failureLine === null;
			const isThink = variant === "think";
			const followSummaryEnd = isThink && state === "running" && !open;
			const scheduleSummaryScroll = useThrottledVisualUpdate(() => {
				const summaryElement = summaryRef.current;
				if (summaryElement === null) return;
				summaryElement.scrollLeft = followSummaryEnd ? summaryElement.scrollWidth - summaryElement.clientWidth : 0;
			});
			(0, react.useEffect)(() => {
				if (!isThink) return;
				scheduleSummaryScroll();
			}, [
				followSummaryEnd,
				isThink,
				scheduleSummaryScroll,
				summaryText
			]);
			const toggleExpand = () => {
				setExpanded((v) => !v);
			};
			const openFile = (event) => {
				event.stopPropagation();
				if (filePath !== void 0) onOpenFile?.(filePath);
			};
			const fileLinkKeyDown = (event) => {
				if (event.key === "Enter" || event.key === " ") event.stopPropagation();
			};
			const cardBody = variant !== "code" ? body : null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ToolRow_module_css_default.root,
				"data-variant": variant,
				"data-tool": toolName,
				"data-state": state,
				children: [status !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: ToolRow_module_css_default.visuallyHidden,
					children: status
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DisclosureRow, {
					rowClassName: ToolRow_module_css_default.row,
					leadingClassName: ToolRow_module_css_default.leading,
					titleClassName: ToolRow_module_css_default.title,
					chevronClassName: ToolRow_module_css_default.chevron,
					icon: leadingFor$1(state, icon),
					title,
					open,
					expandable,
					expandOnRowClick: true,
					keepContentWhenOpen: !isThink,
					onToggle: toggleExpand,
					collapsedContent: summaryText !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ToolRow_module_css_default.sep,
						"aria-hidden": true
					}), fileLink ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: ToolRow_module_css_default.fileLink,
						onClick: openFile,
						onKeyDown: fileLinkKeyDown,
						children: summaryText
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						ref: isThink ? summaryRef : void 0,
						className: clsx(ToolRow_module_css_default.summary, failureLine !== null && ToolRow_module_css_default.errorSummary),
						"data-follow-end": followSummaryEnd || void 0,
						children: summaryText
					})] }),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ToolRow_module_css_default.bodyWrap,
						children: [terminalBody !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TerminalBlock, {
							...terminalBody.card,
							maxLines: Infinity,
							labels: terminalBlockLabels(t),
							className: ToolRow_module_css_default.terminalBody
						}) : diffBody !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DiffBlock, {
							...diffBody.card,
							maxLines: 8,
							className: ToolRow_module_css_default.diffBody
						}) : readBody !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.ReadBlock, {
							...readBody,
							maxLines: 8,
							className: ToolRow_module_css_default.readBody
						}) : searchBody !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SearchBlock, {
							...searchBody.card,
							maxLines: 8,
							className: ToolRow_module_css_default.searchBody
						}), searchBody.recovery !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: ToolRow_module_css_default.searchRecovery,
							children: searchBody.recovery
						})] }) : webBody !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.WebBlock, {
							...webBody,
							className: ToolRow_module_css_default.webBody
						}) : isThink ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: ToolRow_module_css_default.thinkBody,
							children: body
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [variant === "code" && body !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: ToolRow_module_css_default.bodyScroll,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.CodeBlock, {
								code: body,
								lang: "typescript",
								copyLabel: t("copy"),
								copiedLabel: t("copied"),
								className: ToolRow_module_css_default.codeBody
							})
						}), (cardBody !== null || outputText !== null) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ToolRow_module_css_default.ioCard,
							children: [
								cardBody !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ToolRow_module_css_default.ioSection,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ToolRow_module_css_default.ioLabel,
										children: "IN"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ToolRow_module_css_default.ioText,
										children: cardBody
									})]
								}),
								cardBody !== null && outputText !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ToolRow_module_css_default.ioDivider,
									"aria-hidden": true
								}),
								outputText !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ToolRow_module_css_default.ioSection,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ToolRow_module_css_default.ioLabel,
										children: "OUT"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ToolRow_module_css_default.ioText,
										"data-error": state === "error" || void 0,
										children: outputText
									})]
								})
							]
						})] }), inspect !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: ToolRow_module_css_default.inspectButton,
							onClick: inspect,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconInspect, {}), "Inspect"]
						})]
					})
				})]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/chat/AssistantMarkdown.module.css.mjs
		const css$11 = "._48cFCW_root{color:var(--dsw-alias-label-primary);flex-direction:column;font-size:16px;line-height:28px;display:flex}._48cFCW_body{flex-direction:column;gap:16px;display:flex}._48cFCW_stopped{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);border-radius:6px;align-self:flex-start;padding:0 6px;font-size:11px;line-height:18px}._48cFCW_actions{margin-top:16px;margin-left:-6px}";
		const tagId$11 = "@deepseek-ai/dsh-client-ui-conversation/AssistantMarkdown.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$11) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$11;
			tag.textContent = css$11;
			document.head.appendChild(tag);
		}
		var AssistantMarkdown_module_css_default = {
			"actions": "_48cFCW_actions",
			"stopped": "_48cFCW_stopped",
			"root": "_48cFCW_root",
			"body": "_48cFCW_body"
		};
		//#endregion
		//#region src/client/chat/AssistantMarkdown.tsx
		function firstLine(text) {
			const nl = text.indexOf("\n");
			return nl !== -1 ? text.slice(0, nl) : text;
		}
		/** Latest non-blank reasoning line while the block is still streaming. */
		function latestLine(text) {
			const visible = text.trimEnd();
			const nl = visible.lastIndexOf("\n");
			return nl === -1 ? visible : visible.slice(nl + 1);
		}
		/** Joined text blocks for the copy action (reasoning / tool heads stay out). */
		function copyText(blocks) {
			const parts = [];
			for (const block of blocks) if (block.kind === "text") parts.push(block.text);
			return parts.join("");
		}
		/** True when the node has model-visible text content worth chrome under. */
		function hasContentText(blocks) {
			return blocks.some((block) => block.kind === "text" && block.text.trim() !== "");
		}
		/** Reasoning block as the Think variant summary row (figma 39:28304). */
		function ThinkRow({ text, running, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolRow, {
				t,
				variant: "think",
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconThinkOutline14, { size: 14 }),
				title: "Think",
				summary: running ? latestLine(text) : firstLine(text),
				body: text,
				state: running ? "running" : "ok"
			});
		}
		const AssistantMarkdown = (0, react.memo)(function AssistantMarkdown({ blocks, streaming, interrupted, time, runMs, ttftMs, tokensPerSecond, seq, onFork, forkUnavailable, t }) {
			const codeLabels = (0, react.useMemo)(() => ({
				copyLabel: t("copy"),
				copiedLabel: t("copied")
			}), [t]);
			const last = blocks.length - 1;
			if (!(streaming || interrupted === true || blocks.some((block) => block.kind !== "tool-call"))) return null;
			const showActions = !streaming && time !== void 0 && hasContentText(blocks);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: AssistantMarkdown_module_css_default.root,
				"data-streaming": streaming || void 0,
				"data-time-hover-root": true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: AssistantMarkdown_module_css_default.body,
					children: [blocks.map((block, i) => {
						switch (block.kind) {
							case "text": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
								text: block.text,
								streaming,
								codeLabels
							}, i);
							case "reasoning": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThinkRow, {
								text: block.text,
								running: streaming && i === last,
								t
							}, i);
							case "tool-call": return null;
							default: return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonBlock, {
								label: t("message.unknownBlock"),
								payload: block.block,
								truncatedLabel: (total) => t("json.truncated", { total })
							}, i);
						}
					}), interrupted && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: AssistantMarkdown_module_css_default.stopped,
						children: t("message.stopped")
					})]
				}), showActions && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MessageIconActions, {
					text: copyText(blocks),
					time,
					runMs,
					ttftMs,
					tokensPerSecond,
					clock: "end",
					onBranch: onFork === void 0 || seq === void 0 ? void 0 : () => {
						onFork(seq);
					},
					branchUnavailable: forkUnavailable,
					className: AssistantMarkdown_module_css_default.actions,
					t
				})]
			});
		});
		//#endregion
		//#region src/client/chat/GenericCommandCard.tsx
		/** Node state → row state semantic (running while unsettled; outcome kind after). */
		function stateOf(outcome) {
			if (outcome === null) return "running";
			return outcome.kind === "error" ? "error" : "ok";
		}
		function GenericCommandCard({ node, t }) {
			const text = node.outcome?.text;
			const summary = node.outcome === null ? t("command.running") : text ?? (node.outcome.kind === "error" ? t("command.failed") : t("command.done"));
			const title = node.name ?? t("command.title");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolRow, {
				t,
				variant: "others",
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconApiOutline14, { size: 14 }),
				title,
				summary,
				body: text !== void 0 && text.includes("\n") ? text : null,
				state: stateOf(node.outcome)
			});
		}
		//#endregion
		//#region src/client/contract/web-card-model.ts
		/**
		* Derive the web-card props for a tool call, or null when this call is not a
		* web card and belongs on the generic path.
		*
		* The result side supplies the whole card: the sources and answer for a
		* `search`, the URL and status for a `fetch`. Cases producing null, all of
		* them the documented generic-card default:
		*
		* - A running call (no `resultView` yet): the web tools keep a generic pending
		*   card, so nothing web-shaped exists until the call settles.
		* - A settled call whose result view is not a web card — including a `card`
		*   value this UI version does not know, which arrives over the wire and so
		*   cannot be trusted to be one of the compiled variants, and a generic result
		*   view (a web tool's error path returns the generic card, whose text the
		*   generic path preserves).
		* - A web card whose `kind` this UI version does not know (a newer host's
		*   value): the wire cannot be trusted to be `search` or `fetch`, so it takes
		*   the generic path rather than rendering as a malformed fetch.
		* @param block - RunningToolCall or ToolResultNode off the snapshot caches.
		* @returns the web-card props, or null for the generic path.
		*/
		function webCardModel(block) {
			if (!("kind" in block)) return null;
			const result = block.resultView;
			if (result?.card !== "web") return null;
			if (result.kind === "search") return {
				kind: "search",
				answer: result.answer,
				sources: result.sources.map((source) => ({
					url: source.url,
					title: source.title,
					snippet: source.snippet,
					publishedAt: source.publishedAt
				})),
				truncated: result.truncated
			};
			if (result.kind === "fetch") return {
				kind: "fetch",
				url: result.url,
				statusCode: result.statusCode,
				truncated: result.truncated
			};
			return null;
		}
		//#endregion
		//#region src/client/chat/GenericToolCard.tsx
		/** Variant leading icons (figma table); all glyphs render at 14 inside the 16px leading box. */
		const VARIANT_ICONS = {
			think: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconThinkOutline14, { size: 14 }),
			search: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, { size: 14 }),
			read: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBrowseOutline16, { size: 14 }),
			bash: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconApiOutline14, { size: 14 }),
			write: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, { size: 14 }),
			edit: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, { size: 14 }),
			code: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutline16, { size: 14 }),
			others: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSparkle16, { size: 14 })
		};
		function GenericToolCard({ toolName, block, cwd, openFile, inspect, t }) {
			const model = toolRowModel(toolName, block, cwd);
			const terminal = terminalCardModel(block, cwd);
			const read = readCardModel(block, cwd);
			const diff = diffCardModel(block);
			const search = searchCardModel(block);
			const web = webCardModel(block);
			const state = model.state === "ok" && terminal !== null && terminalFailed(terminal) ? "error" : model.state;
			const singleFile = model.filePath !== void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolRow, {
				t,
				variant: model.variant,
				toolName,
				icon: VARIANT_ICONS[model.variant],
				title: model.title,
				summary: terminal?.description ?? search?.title ?? model.summary,
				body: singleFile ? null : model.body,
				output: model.output,
				errorSummary: model.errorSummary,
				terminal,
				diff,
				read,
				search,
				web,
				state,
				filePath: model.filePath,
				onOpenFile: singleFile ? openFile : void 0,
				inspect
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/chat/MessageItem.module.css.mjs
		const css$10 = ".ZPPQVG_userRow{flex-direction:column;align-items:flex-end;gap:6px;display:flex}.ZPPQVG_steeringMark{color:var(--dsw-alias-label-tertiary);padding-right:4px;font-size:12px;line-height:16px}.ZPPQVG_bubble{background:var(--dsw-specific-bubble);max-width:min(525px,82%);color:var(--dsw-alias-label-primary);border-radius:22px;padding:10px 16px;font-size:16px;line-height:24px}.ZPPQVG_contextRow,.ZPPQVG_compactionRow{padding:2px 0}.ZPPQVG_compactionButton{width:100%;min-width:0;height:24px;color:inherit;font:inherit;text-align:left;background:0 0;border:none;border-radius:6px;align-items:center;padding:0;display:flex}.ZPPQVG_compactionButton:not(:disabled){cursor:pointer}.ZPPQVG_compactionButton:not(:disabled):hover{background:var(--dsw-alias-interactive-bg-hover)}.ZPPQVG_compactionLeading{width:16px;height:16px;color:var(--dsw-alias-label-secondary);flex:none;justify-content:center;align-items:center;margin-right:6px;display:inline-flex}.ZPPQVG_compactionTitle{color:var(--dsw-alias-label-primary-dimmed);flex:none;font-size:14px;line-height:24px}.ZPPQVG_compactionSep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}.ZPPQVG_compactionSummary{min-width:0;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:auto;font-size:14px;line-height:24px;overflow:hidden}.ZPPQVG_compactionBody{color:var(--dsw-alias-label-tertiary);padding:4px 0 4px 22px;font-size:14px;line-height:24px}.ZPPQVG_retryRow{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}.ZPPQVG_retrySummary{width:fit-content;color:inherit;cursor:pointer;user-select:none;border-radius:3px;align-items:center;gap:7px;padding:2px 0;list-style:none;display:inline-flex}.ZPPQVG_retrySummary::-webkit-details-marker{display:none}.ZPPQVG_retrySummary:after{content:\"\";opacity:.8;border-bottom:1.5px solid;border-right:1.5px solid;width:6px;height:6px;transition:transform .12s;transform:rotate(-45deg)}.ZPPQVG_retrySummary:hover{color:var(--dsw-alias-label-secondary)}.ZPPQVG_retrySummary:focus-visible{outline:1.5px solid var(--dsw-alias-button-info-fill);outline-offset:2px}.ZPPQVG_retryText{color:inherit}.ZPPQVG_retryRow[data-active] .ZPPQVG_retryText{background:linear-gradient(90deg, var(--dsw-alias-label-tertiary) 0%, var(--dsw-alias-label-tertiary) 40%, var(--dsw-alias-label-secondary) 50%, var(--dsw-alias-label-tertiary) 60%, var(--dsw-alias-label-tertiary) 100%);color:#0000;background-position:100%;background-size:200% 100%;background-clip:text;animation:1.6s ease-in-out infinite ZPPQVG_retry-shimmer}.ZPPQVG_retryRow[open] .ZPPQVG_retrySummary:after{transform:rotate(45deg)}.ZPPQVG_retryDetails{overflow-wrap:anywhere;gap:2px;margin-top:3px;padding-left:14px;font-size:12px;line-height:18px;display:grid}.ZPPQVG_retryDetailLabel{color:var(--dsw-alias-label-secondary)}.ZPPQVG_turnErrorRow{grid-template-columns:10px minmax(0,1fr) auto;align-items:start;gap:8px;padding:2px 0;font-size:13px;line-height:20px;display:grid}.ZPPQVG_turnErrorDot{margin-top:5px}.ZPPQVG_turnErrorCopy{overflow-wrap:anywhere;min-width:0}.ZPPQVG_turnErrorTitle{color:var(--dsw-alias-state-error-primary);margin-right:6px;font-weight:600}.ZPPQVG_turnErrorMessage{color:var(--dsw-alias-label-secondary)}.ZPPQVG_turnErrorCode{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-markdown-code-block-small)}@keyframes ZPPQVG_retry-shimmer{0%{background-position:100%}to{background-position:0}}@media (prefers-reduced-motion:reduce){.ZPPQVG_retryRow[data-active] .ZPPQVG_retryText{color:inherit;background:0 0;animation:none}}.ZPPQVG_refChip{color:var(--dsw-alias-label-primary);white-space:nowrap;vertical-align:baseline;background:#6187d838;border-radius:6px;margin:0 2px;padding:0 8px;font-size:.85em;line-height:1.6;display:inline-block}";
		const tagId$10 = "@deepseek-ai/dsh-client-ui-conversation/MessageItem.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$10) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$10;
			tag.textContent = css$10;
			document.head.appendChild(tag);
		}
		var MessageItem_module_css_default = {
			"steeringMark": "ZPPQVG_steeringMark",
			"compactionTitle": "ZPPQVG_compactionTitle",
			"compactionSummary": "ZPPQVG_compactionSummary",
			"turnErrorDot": "ZPPQVG_turnErrorDot",
			"turnErrorRow": "ZPPQVG_turnErrorRow",
			"compactionBody": "ZPPQVG_compactionBody",
			"retrySummary": "ZPPQVG_retrySummary",
			"retry-shimmer": "ZPPQVG_retry-shimmer",
			"compactionSep": "ZPPQVG_compactionSep",
			"retryText": "ZPPQVG_retryText",
			"bubble": "ZPPQVG_bubble",
			"contextRow": "ZPPQVG_contextRow",
			"compactionButton": "ZPPQVG_compactionButton",
			"retryDetails": "ZPPQVG_retryDetails",
			"retryDetailLabel": "ZPPQVG_retryDetailLabel",
			"turnErrorTitle": "ZPPQVG_turnErrorTitle",
			"userRow": "ZPPQVG_userRow",
			"turnErrorMessage": "ZPPQVG_turnErrorMessage",
			"turnErrorCopy": "ZPPQVG_turnErrorCopy",
			"turnErrorCode": "ZPPQVG_turnErrorCode",
			"compactionRow": "ZPPQVG_compactionRow",
			"retryRow": "ZPPQVG_retryRow",
			"refChip": "ZPPQVG_refChip",
			"compactionLeading": "ZPPQVG_compactionLeading"
		};
		//#endregion
		//#region src/client/chat/CompactionItem.tsx
		/**
		* The collapsed-by-default compaction marker.
		* @param props - the marker node off the snapshot cache.
		* @returns the marker row, with the summary disclosure when one is available.
		*/
		const CompactionItem = (0, react.memo)(function CompactionItem({ node, t }) {
			const [expanded, setExpanded] = (0, react.useState)(false);
			const expandable = node.summary !== null;
			const open = expandable && expanded;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: MessageItem_module_css_default.compactionRow,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: MessageItem_module_css_default.compactionButton,
					disabled: !expandable,
					"aria-expanded": expandable ? open : void 0,
					onClick: () => {
						setExpanded((value) => !value);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MessageItem_module_css_default.compactionLeading,
							children: open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, {})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MessageItem_module_css_default.compactionTitle,
							children: t("message.compaction")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MessageItem_module_css_default.compactionSep,
							"aria-hidden": true
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MessageItem_module_css_default.compactionSummary,
							children: expandable ? t("message.compaction.expand") : t("message.compaction.unavailable")
						})
					]
				}), open && node.summary !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: MessageItem_module_css_default.compactionBody,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, { text: node.summary })
				})]
			});
		});
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/chat/ContextBody.module.css.mjs
		const css$9 = ".cFRPHa_text{color:var(--dsw-alias-label-secondary);font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.cFRPHa_fields{border-top:1px solid var(--dsw-alias-line-secondary);flex-direction:column;gap:2px;margin:8px 0 0;padding-top:8px;display:flex}.cFRPHa_field{gap:8px;min-width:0;display:flex}.cFRPHa_fieldKey{min-width:96px;color:var(--dsw-alias-label-caption);flex:none}.cFRPHa_fieldValue{min-width:0;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere;flex:auto;margin:0}.cFRPHa_files{flex-wrap:wrap;gap:4px 12px;margin:0 0 8px;padding:0;list-style:none;display:flex}.cFRPHa_file{align-items:baseline;gap:6px;min-width:0;display:flex}.cFRPHa_filePath{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.cFRPHa_fileAction{color:var(--dsw-alias-label-caption)}.cFRPHa_catalogNotice{color:var(--dsw-alias-label-caption);margin:0 0 6px}.cFRPHa_entries{flex-direction:column;gap:4px;margin:0;padding:0;list-style:none;display:flex}.cFRPHa_entry{gap:8px;min-width:0;display:flex}.cFRPHa_entryName{color:var(--dsw-alias-label-secondary);flex:none}.cFRPHa_entryDescription{min-width:0;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:auto;overflow:hidden}.cFRPHa_sections{flex-direction:column;gap:8px;margin:0;display:flex}.cFRPHa_section{flex-direction:column;gap:2px;min-width:0;display:flex}.cFRPHa_sectionName{color:var(--dsw-alias-label-caption)}.cFRPHa_sectionText{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.cFRPHa_relaySender{color:var(--dsw-alias-label-caption);overflow-wrap:anywhere;margin:0 0 6px}.cFRPHa_recalls{flex-direction:column;gap:2px;margin:0 0 8px;padding:0;list-style:none;display:flex}.cFRPHa_recall{gap:8px;min-width:0;display:flex}.cFRPHa_recallLabel{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.cFRPHa_recallCounts{color:var(--dsw-alias-label-caption);flex:none}";
		const tagId$9 = "@deepseek-ai/dsh-client-ui-conversation/ContextBody.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$9) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$9;
			tag.textContent = css$9;
			document.head.appendChild(tag);
		}
		var ContextBody_module_css_default = {
			"fields": "cFRPHa_fields",
			"entryName": "cFRPHa_entryName",
			"recallLabel": "cFRPHa_recallLabel",
			"recallCounts": "cFRPHa_recallCounts",
			"fieldKey": "cFRPHa_fieldKey",
			"file": "cFRPHa_file",
			"text": "cFRPHa_text",
			"fieldValue": "cFRPHa_fieldValue",
			"field": "cFRPHa_field",
			"entries": "cFRPHa_entries",
			"entryDescription": "cFRPHa_entryDescription",
			"section": "cFRPHa_section",
			"relaySender": "cFRPHa_relaySender",
			"files": "cFRPHa_files",
			"filePath": "cFRPHa_filePath",
			"sections": "cFRPHa_sections",
			"fileAction": "cFRPHa_fileAction",
			"catalogNotice": "cFRPHa_catalogNotice",
			"entry": "cFRPHa_entry",
			"sectionText": "cFRPHa_sectionText",
			"recalls": "cFRPHa_recalls",
			"recall": "cFRPHa_recall",
			"sectionName": "cFRPHa_sectionName"
		};
		//#endregion
		//#region src/client/chat/ContextBody.tsx
		/** Model-facing text stays bounded at the disclosure, not at the producer. */
		const MAX_CHARS = 2e4;
		/** Rows a list body materializes before summarizing the remainder. */
		const MAX_ENTRIES = 200;
		/** One durable source narrowed to the readable-record shape; null for anything else. */
		function asRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
		}
		/**
		* The content blocks as runs, IN THE ORDER the model received them.
		*
		* Adjacent text blocks join with no separator, matching how provider adapters
		* flatten them — inserting a line break would show the reader a line the model
		* never saw. An unknown block breaks the run and keeps its own fallback rather
		* than being hoisted past the text around it or vanishing; the block union is
		* merge-extensible, so a foreign log may interleave shapes this build does not
		* know.
		*/
		function contentRuns(content) {
			const runs = [];
			for (const block of content) {
				if (block.type !== "text") {
					runs.push({ block });
					continue;
				}
				const last = runs[runs.length - 1];
				if (last !== void 0 && "text" in last) last.text += block.text;
				else runs.push({ text: block.text });
			}
			return runs;
		}
		/** Only the blocks this UI version does not know, for bodies that replace the text. */
		function unknownBlocks(content) {
			return contentRuns(content).flatMap((run) => "block" in run ? [run.block] : []);
		}
		/** The model-facing text, truncated to the display bound. */
		function boundedText(text, t) {
			return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n${t("json.truncated", { total: text.length })}` : text;
		}
		/**
		* One source field rendered as a value row; nested shapes stay compact JSON.
		* Bounded on its own, because provenance is as unbounded as the text: an unknown
		* producer may record an arbitrarily large string or array.
		*/
		function fieldValue(value, t) {
			return boundedText(typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : JSON.stringify(value), t);
		}
		/**
		* Provenance fields as a key/value list. `kind` is always omitted because the
		* row header already names the producer. `form` is omitted only when a
		* dedicated body rendered for it — then the presentation the reader is looking
		* at IS that value. On the opaque fallback the declaration is kept, because
		* that is the one place a form this version cannot present would otherwise
		* disappear from the UI entirely.
		*/
		function SourceFields({ source, formRendered, t }) {
			const record = asRecord(source);
			if (record === null) return null;
			const hidden = formRendered ? ["kind", "form"] : ["kind"];
			const rows = Object.entries(record).filter(([key]) => !hidden.includes(key));
			if (rows.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dl", {
				className: ContextBody_module_css_default.fields,
				"data-context-fields": true,
				children: rows.map(([key, value]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ContextBody_module_css_default.field,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", {
						className: ContextBody_module_css_default.fieldKey,
						children: key
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
						className: ContextBody_module_css_default.fieldValue,
						children: fieldValue(value, t)
					})]
				}, key))
			});
		}
		/**
		* Content blocks this UI version does not know, kept visible rather than
		* dropped: the block union is merge-extensible, so a newer or foreign log may
		* carry a shape this build has no presentation for.
		* @param props - The unrecognized blocks and the locale seat.
		* @returns One generic JSON block per unknown entry.
		*/
		function UnknownBlocks({ blocks, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: blocks.map((block, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonBlock, {
				label: t("message.unknownBlock"),
				payload: block,
				truncatedLabel: (total) => t("json.truncated", { total })
			}, index)) });
		}
		/**
		* The model-facing content of one context, shared by every form that shows it:
		* the text with its real line breaks, then any block this UI version does not
		* know, which keeps its own fallback rather than vanishing.
		* @param props - Durable content and the locale seat.
		* @returns The content blocks as the model received them.
		*/
		function ModelFacingContent({ content, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: contentRuns(content).map((run, index) => "text" in run ? run.text !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
				className: ContextBody_module_css_default.text,
				"data-context-text": true,
				children: boundedText(run.text, t)
			}, index) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonBlock, {
				label: t("message.unknownBlock"),
				payload: run.block,
				truncatedLabel: (total) => t("json.truncated", { total })
			}, index)) });
		}
		/**
		* Default presentation: the model-facing text as text, with its real line
		* breaks, and the remaining provenance beneath it. This is what every form
		* this UI version does not recognize renders as.
		* @param props - Durable content, its source, and the locale seat.
		* @returns The opaque context body.
		*/
		function OpaqueBody({ content, source, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelFacingContent, {
				content,
				t
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceFields, {
				source,
				formRendered: false,
				t
			})] });
		}
		/**
		* Instruction changes read off the source, or null when the record is not a
		* usable instruction list.
		*
		* The read is all-or-nothing: silently dropping one unreadable entry would show
		* a confident, incomplete file list for a log this version cannot fully read.
		* Paths are deduplicated in first-seen order, matching how the header label is
		* derived from the same array.
		*/
		function instructionChanges(source) {
			const record = asRecord(source);
			const list = record === null ? void 0 : record["changes"];
			if (!Array.isArray(list)) return null;
			const changes = [];
			const seen = /* @__PURE__ */ new Set();
			for (const entry of list) {
				const change = asRecord(entry);
				if (change === null) return null;
				const path = change["path"];
				if (typeof path !== "string" || path === "") return null;
				const action = change["action"];
				if (action !== "set" && action !== "replace" && action !== "remove") return null;
				const digest = change["digest"];
				if (seen.has(path)) continue;
				seen.add(path);
				changes.push({
					action,
					path,
					...typeof digest === "string" ? { digest } : {}
				});
			}
			return changes.length === 0 ? null : changes;
		}
		/**
		* Locale key for one reconciled file. The baseline loads a file; a later delta
		* distinguishes a newly reconciled path from a rewritten one, which `set` and
		* `replace` already separate at the producer.
		* @param action - the durable change action.
		* @param baseline - whether this context is the startup/resume baseline.
		* @returns the key naming what happened to that file.
		*/
		function instructionAction(action, baseline) {
			if (action === "remove") return "message.context.instructions.removed";
			if (baseline) return "message.context.instructions.loaded";
			return action === "set" ? "message.context.instructions.added" : "message.context.instructions.updated";
		}
		/**
		* `instructions` form: the files this context reconciled, then their text.
		*
		* The text keeps its `<system-reminder>` framing verbatim — the framing is part
		* of what the model read, so hiding it would misreport the request.
		* @param props - Durable content, its source, and the locale seat.
		* @returns The instructions context body, or the opaque body when the change
		* list is unreadable.
		*/
		function InstructionsBody({ content, source, t }) {
			const changes = instructionChanges(source);
			if (changes === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OpaqueBody, {
				content,
				source,
				t
			});
			const baseline = asRecord(source)?.["baseline"] === true;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: ContextBody_module_css_default.files,
				"data-context-files": true,
				children: changes.map((change) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
					className: ContextBody_module_css_default.file,
					title: change.digest,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ContextBody_module_css_default.filePath,
						children: change.path
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ContextBody_module_css_default.fileAction,
						children: t(instructionAction(change.action, baseline))
					})]
				}, change.path))
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelFacingContent, {
				content,
				t
			})] });
		}
		/**
		* Catalog entries read off the source, or null when the record is not a usable
		* catalog. All-or-nothing for the same reason as the instruction list: this body
		* replaces the model-facing text, so a partial list would hide the only complete
		* account of what the model read.
		*/
		function catalogEntries(source) {
			const record = asRecord(source);
			const list = record === null ? void 0 : record["entries"];
			if (!Array.isArray(list)) return null;
			const entries = [];
			for (const item of list) {
				const entry = asRecord(item);
				if (entry === null) return null;
				const name = entry["name"];
				const description = entry["description"];
				if (typeof name !== "string" || name === "" || typeof description !== "string") return null;
				entries.push({
					name,
					description
				});
			}
			return entries;
		}
		/**
		* `catalog` form: the published entries as a list, read from the source rather
		* than re-parsed out of the model-facing prose.
		*
		* A catalog whose source carries no usable entries falls through to the opaque
		* body, so an older or hand-edited log still shows its text.
		* @param props - Durable content, its source, and the locale seat.
		* @returns The catalog context body, or the opaque body when the entry list is
		* unreadable.
		*/
		function CatalogBody({ content, source, t }) {
			const entries = catalogEntries(source);
			if (entries === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OpaqueBody, {
				content,
				source,
				t
			});
			const update = asRecord(source)?.["update"] === true;
			const shown = entries.slice(0, MAX_ENTRIES);
			const rest = unknownBlocks(content);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				update && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: ContextBody_module_css_default.catalogNotice,
					"data-context-catalog-update": true,
					children: t("message.context.catalog.replaced")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
					className: ContextBody_module_css_default.entries,
					"data-context-entries": true,
					children: shown.map((entry, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						className: ContextBody_module_css_default.entry,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
							className: ContextBody_module_css_default.entryName,
							children: entry.name
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ContextBody_module_css_default.entryDescription,
							children: entry.description
						})]
					}, index))
				}),
				shown.length < entries.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: ContextBody_module_css_default.catalogNotice,
					"data-context-entries-truncated": true,
					children: t("message.context.catalog.more", { count: entries.length - shown.length })
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(UnknownBlocks, {
					blocks: rest,
					t
				})
			] });
		}
		/** Snapshot sections read off the source, or null when the record is unusable. */
		function snapshotSections(source) {
			const record = asRecord(source);
			const list = record === null ? void 0 : record["sections"];
			if (!Array.isArray(list)) return null;
			const sections = [];
			for (const item of list) {
				const section = asRecord(item);
				if (section === null) return null;
				const name = section["name"];
				const text = section["text"];
				if (typeof name !== "string" || name === "" || typeof text !== "string") return null;
				sections.push({
					name,
					text
				});
			}
			return sections.length === 0 ? null : sections;
		}
		/**
		* `snapshot` form: the named contributions this snapshot assembled, in order.
		*
		* The sections are the same bytes the model read, split at the boundaries the
		* producer assembled them on, so a reader sees which subsystem contributed
		* which state instead of one undifferentiated wall.
		*
		* One sentence of the model-facing text is NOT in any section: the producer's
		* framing line declaring that this snapshot supersedes earlier ones. Unlike the
		* `<system-reminder>` wrapper an instruction context carries — which wraps
		* content and cannot be separated from it — that line states the form's own
		* semantics, so the body states them as a caption instead of reprinting the
		* joined prose beside the sections it was split from.
		* @param props - Durable content, its source, and the locale seat.
		* @returns The snapshot context body, or the opaque body when unreadable.
		*/
		function SnapshotBody({ content, source, t }) {
			const sections = snapshotSections(source);
			/* v8 ignore next -- contextBody reads the sections before choosing this body. */
			if (sections === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OpaqueBody, {
				content,
				source,
				t
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: ContextBody_module_css_default.catalogNotice,
				"data-context-snapshot-supersedes": true,
				children: t("message.context.snapshot.supersedes")
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dl", {
				className: ContextBody_module_css_default.sections,
				"data-context-sections": true,
				children: sections.map((section, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ContextBody_module_css_default.section,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", {
						className: ContextBody_module_css_default.sectionName,
						children: section.name
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
						className: ContextBody_module_css_default.sectionText,
						children: boundedText(section.text, t)
					})]
				}, index))
			})] });
		}
		/**
		* `notice` form: what just happened, with the model-facing text beneath it.
		*
		* The one-line account also rides the collapsed row ({@link contextBody}), so a
		* notice is usually readable without expanding at all.
		* @param props - Durable content, its source, and the locale seat.
		* @returns The notice context body.
		*/
		function NoticeBody({ content, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelFacingContent, {
				content,
				t
			});
		}
		/**
		* `relay` form: which agent sent this, then what it said.
		*
		* The sender is an opaque session id; it is shown as provenance rather than a
		* label, because this client cannot resolve it to a title.
		* @param props - Durable content, its source, and the locale seat.
		* @returns The relay context body.
		*/
		function RelayBody({ content, source, t }) {
			const sender = relaySender(source);
			/* v8 ignore next -- contextBody resolves the sender before choosing this body. */
			if (sender === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OpaqueBody, {
				content,
				source,
				t
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: ContextBody_module_css_default.relaySender,
				"data-context-relay-sender": true,
				children: t("message.context.relay.from", { session: sender })
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelFacingContent, {
				content,
				t
			})] });
		}
		/** The sending agent's session id, or null when the record does not name one. */
		function relaySender(source) {
			const sender = asRecord(source)?.["senderSessionId"];
			return typeof sender === "string" && sender !== "" ? sender : null;
		}
		/** Recalled sessions read off the source, or null when the record is unusable. */
		function recalledSessions(source) {
			const record = asRecord(source);
			const list = record === null ? void 0 : record["references"];
			if (!Array.isArray(list)) return null;
			const sessions = [];
			for (const item of list) {
				const reference = asRecord(item);
				if (reference === null) return null;
				const label = reference["label"];
				const retained = reference["retainedMessages"];
				const omitted = reference["omittedMessages"];
				const truncated = reference["truncated"];
				if (typeof label !== "string" || label === "" || typeof retained !== "number" || typeof omitted !== "number" || typeof truncated !== "boolean") return null;
				sessions.push({
					label,
					retained,
					omitted,
					truncated
				});
			}
			return sessions.length === 0 ? null : sessions;
		}
		/**
		* `recall` form: which sessions this material came from and how much of each
		* survived the read, then the material itself.
		*
		* Completeness is the fact a reader needs first: recalled context is bounded on
		* the way in, so a card that hid the omitted count would overstate what the
		* model received.
		* @param props - Durable content, its source, and the locale seat.
		* @returns The recall context body, or the opaque body when unreadable.
		*/
		function RecallBody({ content, source, t }) {
			const sessions = recalledSessions(source);
			if (sessions === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OpaqueBody, {
				content,
				source,
				t
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: ContextBody_module_css_default.recalls,
				"data-context-recalls": true,
				children: sessions.map((session, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
					className: ContextBody_module_css_default.recall,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ContextBody_module_css_default.recallLabel,
							children: session.label
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ContextBody_module_css_default.recallCounts,
							children: t("message.context.recall.counts", {
								retained: session.retained,
								omitted: session.omitted
							})
						}),
						session.truncated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ContextBody_module_css_default.recallCounts,
							children: t("message.context.recall.truncated")
						})
					]
				}, index))
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelFacingContent, {
				content,
				t
			})] });
		}
		/** The one-line account a `notice` puts on its collapsed row, when it records one. */
		function noticeSummary(source) {
			const summary = asRecord(source)?.["summary"];
			return typeof summary === "string" && summary !== "" ? summary : null;
		}
		/**
		* Choose the body for one context node.
		*
		* Returns the form the body actually rendered as, which is not always the
		* declared one: a declared form whose fields are unreadable falls back to
		* opaque, and the caller labels the row with what it really shows.
		* `summary` is the collapsed row's one-line account, which only a `notice`
		* records: its whole point is being readable without expanding.
		* @param form - the producer-declared form projected onto the node.
		* @param props - durable content, its source, and the locale seat.
		* @returns the rendered form (null for opaque), its collapsed summary, and its body.
		*/
		function contextBody(form, props) {
			const opaque = {
				rendered: null,
				summary: null,
				body: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OpaqueBody, { ...props })
			};
			switch (form) {
				case "instructions": return instructionChanges(props.source) === null ? opaque : {
					rendered: "instructions",
					summary: null,
					body: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(InstructionsBody, { ...props })
				};
				case "catalog": return catalogEntries(props.source) === null ? opaque : {
					rendered: "catalog",
					summary: null,
					body: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CatalogBody, { ...props })
				};
				case "snapshot": return snapshotSections(props.source) === null ? opaque : {
					rendered: "snapshot",
					summary: null,
					body: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SnapshotBody, { ...props })
				};
				case "notice": {
					const summary = noticeSummary(props.source);
					return summary === null ? opaque : {
						rendered: "notice",
						summary,
						body: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NoticeBody, { ...props })
					};
				}
				case "relay": return relaySender(props.source) === null ? opaque : {
					rendered: "relay",
					summary: null,
					body: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RelayBody, { ...props })
				};
				case "recall": return recalledSessions(props.source) === null ? opaque : {
					rendered: "recall",
					summary: null,
					body: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecallBody, { ...props })
				};
				case null: return opaque;
				/* v8 ignore next 4 -- closed-union backstop; the compiler rejects a new
				KnownContextForm here rather than letting it degrade to opaque silently. */
				default: throw new Error(`unreachable context form: ${String(form)}`);
			}
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/chat/ContextInjectionRow.module.css.mjs
		const css$8 = ".n9wUYa_root{min-width:0}.n9wUYa_root[data-open]{padding-bottom:4px}.n9wUYa_chevron{color:var(--dsw-alias-label-secondary)}.n9wUYa_sep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}.n9wUYa_source{min-width:0;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:none;font-size:14px;line-height:24px;overflow:hidden}.n9wUYa_summary{min-width:0;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:auto;font-size:14px;line-height:24px;overflow:hidden}.n9wUYa_body{box-sizing:border-box;background:var(--dsw-alias-markdown-code-block);width:calc(100% - 22px);max-height:141px;color:var(--dsw-alias-label-tertiary);font:400 11px/16px var(--ds-font-family-code);border:none;border-radius:8px;margin:4px 0 0 22px;padding:10px 16px 12px 12px;overflow:auto}";
		const tagId$8 = "@deepseek-ai/dsh-client-ui-conversation/ContextInjectionRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$8) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$8;
			tag.textContent = css$8;
			document.head.appendChild(tag);
		}
		var ContextInjectionRow_module_css_default = {
			"chevron": "n9wUYa_chevron",
			"source": "n9wUYa_source",
			"sep": "n9wUYa_sep",
			"body": "n9wUYa_body",
			"summary": "n9wUYa_summary",
			"root": "n9wUYa_root"
		};
		//#endregion
		//#region src/client/chat/ContextInjectionRow.tsx
		/**
		* Render logged context with the Tool calls disclosure chrome from Figma.
		*
		* The header names the role the context plays and, beside it, the producer the
		* durable source identifies, so a reader can tell an injected skill catalog
		* from a workspace instruction file or a recalled session without expanding.
		* The expanded body follows the producer-declared form; an absent or unknown
		* form renders the opaque body.
		* @param props - Durable content, its projected provenance and form, and the locale seat.
		* @returns A collapsed context row with a bounded, form-specific body.
		*/
		function ContextInjectionRow({ content, source, provenance, form, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			const { rendered, summary, body } = contextBody(form, {
				content,
				source,
				t
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DisclosureRow, {
				className: ContextInjectionRow_module_css_default.root,
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBrowseOutline16, { size: 14 }),
				chevronClassName: ContextInjectionRow_module_css_default.chevron,
				title: t(provenance.role === "recall" ? "message.contextRecall" : "message.contextInjection"),
				collapsedContent: provenance.label === null ? void 0 : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ContextInjectionRow_module_css_default.sep,
						"aria-hidden": true
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ContextInjectionRow_module_css_default.source,
						"data-context-source": true,
						children: provenance.label
					}),
					summary !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ContextInjectionRow_module_css_default.sep,
						"aria-hidden": true
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ContextInjectionRow_module_css_default.summary,
						"data-context-summary": true,
						children: summary
					})] })
				] }),
				keepContentWhenOpen: true,
				open,
				expandable: true,
				expandOnRowClick: true,
				onToggle: () => {
					setOpen((value) => !value);
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: ContextInjectionRow_module_css_default.body,
					"data-context-injection-body": true,
					"data-context-form": rendered ?? void 0,
					children: body
				})
			});
		}
		//#endregion
		//#region src/client/chat/MessageItem.tsx
		function contentText(content) {
			const texts = [];
			const rest = [];
			for (const block of content) {
				const b = block;
				if (b.type === "text" && typeof b.text === "string") texts.push(b.text);
				else rest.push(block);
			}
			return {
				text: texts.join(""),
				rest
			};
		}
		function retrySeconds(milliseconds) {
			return Math.max(1, Math.ceil(milliseconds / 1e3));
		}
		function ModelRetryItem({ node, active, t }) {
			const deadline = (0, react.useMemo)(() => Date.now() + node.delayMs, [node.delayMs, node.seq]);
			const scheduledSeconds = retrySeconds(node.delayMs);
			const maximum = node.mode === "normal" ? node.maxRetries : "∞";
			const [countdown, setCountdown] = (0, react.useState)(() => ({
				deadline,
				seconds: retrySeconds(deadline - Date.now())
			}));
			const remainingSeconds = countdown.deadline === deadline ? countdown.seconds : retrySeconds(deadline - Date.now());
			(0, react.useEffect)(() => {
				if (!active) return;
				const updateCountdown = () => {
					const next = retrySeconds(deadline - Date.now());
					setCountdown((current) => current.deadline === deadline && current.seconds === next ? current : {
						deadline,
						seconds: next
					});
					return next;
				};
				if (updateCountdown() === 1) return;
				const timer = window.setInterval(() => {
					if (updateCountdown() === 1) window.clearInterval(timer);
				}, 250);
				return () => {
					window.clearInterval(timer);
				};
			}, [active, deadline]);
			const label = active ? t("message.retry.active") : node.retryState === "cancelled" ? t("message.retry.cancelled") : node.retryState === "started" ? t("message.retry.started") : t("message.retry.scheduled");
			const seconds = active ? remainingSeconds : scheduledSeconds;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: MessageItem_module_css_default.retryRow,
				"data-active": active || void 0,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", {
					className: MessageItem_module_css_default.retrySummary,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: MessageItem_module_css_default.retryText,
						role: "status",
						children: t("message.retry.status", {
							label,
							retry: node.retry,
							maximum,
							seconds
						})
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: MessageItem_module_css_default.retryDetails,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MessageItem_module_css_default.retryDetailLabel,
							children: t("message.retry.delay")
						}),
						Math.round(node.delayMs),
						"ms"
					] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: MessageItem_module_css_default.retryDetailLabel,
						children: t("message.retry.failure")
					}), node.failure.message] })]
				})]
			});
		}
		/** Persistent, turn-positioned feedback for a terminal failure. */
		function TurnErrorItem({ node, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: MessageItem_module_css_default.turnErrorRow,
				role: "status",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
						state: "error",
						className: MessageItem_module_css_default.turnErrorDot
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: MessageItem_module_css_default.turnErrorCopy,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MessageItem_module_css_default.turnErrorTitle,
							children: t("message.turnError")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MessageItem_module_css_default.turnErrorMessage,
							children: node.message
						})]
					}),
					node.code !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
						className: MessageItem_module_css_default.turnErrorCode,
						children: node.code
					})
				]
			});
		}
		/**
		* Display projection of reference forms in a user bubble (free geometry — no
		* textarea alignment constraint here); everything else stays plain text. The
		* logged model text remains the single truth; this is presentation only. Two
		* shapes decorate: legacy `<skill>name</skill>` spans (pre-decision-21
		* history) and plain-text `/name` / `@name` word-boundary tokens (decision
		* 21: the sent text IS the reference — the bubble uses the same plainest
		* token scan as the composer, minus the lexicon: sent tokens were validated
		* at compose time, so shape alone decorates).
		*/
		function projectUserText(text) {
			const re = /<skill>([^<]+)<\/skill>|(^|\s)([/@][\w-]+)(?=\s|$)/g;
			const parts = [];
			let cursor = 0;
			let m;
			while ((m = re.exec(text)) !== null) {
				const legacy = m[1] !== void 0;
				const tokenStart = legacy ? m.index : m.index + (m[2]?.length ?? 0);
				const label = !legacy ? m[3] ?? "" : `/${m[1]}`;
				if (tokenStart > cursor) parts.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MessageText, { text: text.slice(cursor, tokenStart) }, cursor));
				parts.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: MessageItem_module_css_default.refChip,
					"data-ref-chip": label.startsWith("@") ? "subagent" : "skill",
					children: label
				}, tokenStart));
				cursor = legacy ? m.index + m[0].length : tokenStart + label.length;
			}
			if (parts.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MessageText, { text });
			if (cursor < text.length) parts.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MessageText, { text: text.slice(cursor) }, cursor));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: parts });
		}
		/** Right-aligned bubble shared by user and steering rows. */
		function UserStyleBubble({ content, actions, pending = false, steering = false, t }) {
			const { text, rest } = contentText(content);
			const truncated = (total) => t("json.truncated", { total });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: MessageItem_module_css_default.userRow,
				"data-pending-steering": pending || void 0,
				"data-time-hover-root": true,
				children: [
					steering && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: MessageItem_module_css_default.steeringMark,
						"data-steering-mark": true,
						children: t("message.steering")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: MessageItem_module_css_default.bubble,
						children: [projectUserText(text), rest.map((block, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonBlock, {
							label: t("message.extraBlock"),
							payload: block,
							truncatedLabel: truncated
						}, i))]
					}),
					actions?.(text)
				]
			});
		}
		/**
		* Render one Host-authoritative pending steering item with the same visual
		* language as its eventual durable transcript node.
		* @param props - Pending message content and conversation translator.
		* @returns the pending steering bubble.
		*/
		function PendingSteeringBubble({ content, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UserStyleBubble, {
				content,
				pending: true,
				steering: true,
				t,
				actions: (text) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MessageIconActions, {
					text,
					clock: "start",
					showBranch: false,
					className: MessageItem_module_css_default.actions,
					t
				})
			});
		}
		const MessageItem = (0, react.memo)(function MessageItem({ node, retryActive = false, onFork, forkUnavailable = false, t }) {
			const truncated = (total) => t("json.truncated", { total });
			switch (node.kind) {
				case "user":
				case "steering": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UserStyleBubble, {
					content: node.content,
					steering: node.kind === "steering",
					t,
					actions: (text) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MessageIconActions, {
						text,
						time: node.time,
						clock: "start",
						onBranch: onFork === void 0 ? void 0 : () => {
							onFork(node.seq);
						},
						branchUnavailable: forkUnavailable,
						className: MessageItem_module_css_default.actions,
						t
					})
				});
				case "context": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextInjectionRow, {
					content: node.content,
					source: node.source,
					provenance: node.provenance,
					form: node.form,
					t
				});
				case "compaction": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CompactionItem, {
					node,
					t
				});
				case "model-retry": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelRetryItem, {
					node,
					active: retryActive,
					t
				});
				case "turn-error": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TurnErrorItem, {
					node,
					t
				});
				default: return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: MessageItem_module_css_default.contextRow,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonBlock, {
						label: t("message.unknownSurface", { type: node.type }),
						payload: node.data,
						truncatedLabel: truncated
					})
				});
			}
		});
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/chat/ChatView.module.css.mjs
		const css$7 = ".kOtPAa_root{flex-direction:column;flex:auto;min-height:0;display:flex;position:relative}.kOtPAa_scroll{min-height:0;padding:16px calc(var(--dsh-composer-side-clearance) + 16px);flex:auto;overflow-y:auto}[data-conversation-scroll] .kOtPAa_root{flex:none;height:auto;min-height:auto}[data-conversation-scroll] .kOtPAa_scroll{flex:none;min-height:auto;overflow:visible}.kOtPAa_column{max-width:var(--dsh-chat-content-width);flex-direction:column;gap:16px;width:100%;margin:0 auto;display:flex}.kOtPAa_flowItem{min-width:0}.kOtPAa_toolGroup{flex-direction:column;gap:16px;display:flex}.kOtPAa_callRow{border-radius:6px}.kOtPAa_subCalls{border-left:1px solid var(--dsw-alias-border-l2);flex-direction:column;gap:4px;margin:4px 0 2px 22px;padding-left:8px;display:flex}.kOtPAa_turnStatus{height:26px;font:var(--dsw-font-s-strong-14);white-space:nowrap;background:linear-gradient(90deg, var(--dsw-static-deepseek-500) 0%, var(--dsw-static-deepseek-500) 40%, var(--dsw-static-deepseek-200) 50%, var(--dsw-static-deepseek-500) 60%, var(--dsw-static-deepseek-500) 100%);color:#0000;-webkit-text-fill-color:transparent;background-position:100% 0;background-size:250% 100%;-webkit-background-clip:text;background-clip:text;flex:none;align-self:flex-start;align-items:center;animation:1.8s linear infinite kOtPAa_dsh-turn-status-shimmer;display:inline-flex}.kOtPAa_turnStatusClock{font:var(--dsw-font-xs-13);font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-caption);-webkit-text-fill-color:var(--dsw-alias-label-caption);margin-left:8px;font-weight:400}@keyframes kOtPAa_dsh-turn-status-shimmer{to{background-position:0 0}}@media (prefers-reduced-motion:reduce){.kOtPAa_turnStatus{background-position:0 0;background-size:100% 100%;animation:none}}.kOtPAa_hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.kOtPAa_openError{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}.kOtPAa_older{justify-content:center;display:flex}.kOtPAa_older button{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover-solid);cursor:pointer;border:none;border-radius:14px;padding:4px 12px;font-size:12px}.kOtPAa_older button:disabled{cursor:default;opacity:.6}.kOtPAa_toBottomSlot{z-index:8;height:0;padding-right:max(0px, calc((100% - var(--dsh-chat-content-width)) / 2));pointer-events:none;justify-content:flex-end;display:flex;position:sticky;bottom:16px}[data-conversation-scroll] .kOtPAa_toBottomSlot{bottom:calc(var(--dsh-composer-height,152px) + 16px)}.kOtPAa_toBottom{border:1px solid var(--dsw-alias-border-l2);width:34px;height:34px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-button-floating-fill);box-shadow:var(--dsw-shadow-lv2);cursor:pointer;pointer-events:auto;border-radius:100px;justify-content:center;align-items:center;margin-top:-34px;padding:0;display:flex}.kOtPAa_toBottom:hover{background:var(--dsw-alias-button-floating-hover)}";
		const tagId$7 = "@deepseek-ai/dsh-client-ui-conversation/ChatView.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$7) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$7;
			tag.textContent = css$7;
			document.head.appendChild(tag);
		}
		var ChatView_module_css_default = {
			"root": "kOtPAa_root",
			"turnStatusClock": "kOtPAa_turnStatusClock",
			"callRow": "kOtPAa_callRow",
			"subCalls": "kOtPAa_subCalls",
			"toBottom": "kOtPAa_toBottom",
			"column": "kOtPAa_column",
			"openError": "kOtPAa_openError",
			"flowItem": "kOtPAa_flowItem",
			"scroll": "kOtPAa_scroll",
			"older": "kOtPAa_older",
			"hint": "kOtPAa_hint",
			"dsh-turn-status-shimmer": "kOtPAa_dsh-turn-status-shimmer",
			"turnStatus": "kOtPAa_turnStatus",
			"toolGroup": "kOtPAa_toolGroup",
			"toBottomSlot": "kOtPAa_toBottomSlot"
		};
		//#endregion
		//#region src/client/chat/ChatView.tsx
		/** Active column host when present; otherwise the view-local scroller. */
		function scrollerOf(from) {
			return from.closest("[data-conversation-scroll]") ?? from;
		}
		/** Find an already-rendered settled row without interpolating a selector. */
		function anchorElement(list, key) {
			for (const row of list.querySelectorAll("[data-chat-anchor-key]")) if (row.dataset.chatAnchorKey === key) return row;
			return null;
		}
		/** Row position in scrollport coordinates (viewport-independent). */
		function flowTop(row, scrollport) {
			return row.getBoundingClientRect().top - scrollport.getBoundingClientRect().top;
		}
		/** Select a visible stable node/call identity, falling back only when layout
		* has not exposed a visible box yet. */
		function pagingAnchor(list, scrollport) {
			const viewport = scrollport.getBoundingClientRect();
			const visibleBottom = scrollport.querySelector("[data-composer-seat]")?.getBoundingClientRect().top ?? viewport.bottom;
			if (typeof document.elementsFromPoint === "function" && visibleBottom > viewport.top) {
				const content = list.getBoundingClientRect();
				const left = Math.max(viewport.left, content.left);
				const right = Math.min(viewport.right, content.right);
				const x = left + Math.max(0, right - left) / 2;
				const height = visibleBottom - viewport.top;
				const points = [
					1,
					Math.min(32, height / 3),
					height / 2,
					Math.max(1, height - 1)
				];
				for (const offset of points) for (const element of document.elementsFromPoint(x, viewport.top + offset)) {
					const row = element instanceof HTMLElement ? element.closest("[data-chat-anchor-key]") : null;
					if (row !== null && list.contains(row)) return row;
				}
			}
			const rows = [...list.querySelectorAll("[data-chat-anchor-key]")];
			return rows.filter((row) => {
				const rect = row.getBoundingClientRect();
				return rect.bottom > viewport.top && rect.top < visibleBottom;
			})[0] ?? rows[0] ?? null;
		}
		function activeRetrySeq(nodes, running) {
			if (!running) return null;
			for (let index = nodes.length - 1; index >= 0; index -= 1) {
				const node = nodes[index];
				if (node === void 0) continue;
				if (node.kind === "model-retry") return node.retryState === "cancelled" ? null : node.seq;
				if (node.kind === "assistant" || node.kind === "user") return null;
			}
			return null;
		}
		/** Capture a reflow-resistant reader position from the current rendered window. */
		function scrollPosition(list, scrollport) {
			const row = pagingAnchor(list, scrollport);
			const anchorKey = row?.dataset.chatAnchorKey;
			if (row === null || anchorKey === void 0) return null;
			return {
				anchorKey,
				anchorTop: flowTop(row, scrollport),
				scrollTop: scrollport.scrollTop
			};
		}
		/** One `run_code` sub-dispatch row: the identical keyed-slot dispatch as a
		*  top-level call (same registrations, same fallback), nested by the parent.
		*  A started-but-unsettled sub-call arrives as the RunningToolCall shape and
		*  renders the running state exactly as a native in-flight row. */
		const SubCallRow = (0, react.memo)(function SubCallRow({ renderSlot, node, openFile, openDetails, closeDetails, selected, cwd, inspectCall, t }) {
			const toolName = "kind" in node ? node.call?.name ?? "" : node.name;
			const owner = (0, react.useMemo)(() => ({
				callId: node.callId,
				toolName,
				block: node,
				openFile,
				cwd,
				selected,
				openDetails: () => {
					openDetails({ callId: node.callId });
				},
				closeDetails,
				inspect: () => {
					inspectCall(node.callId);
				}
			}), [
				node,
				toolName,
				openFile,
				cwd,
				selected,
				openDetails,
				closeDetails,
				inspectCall
			]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: ChatView_module_css_default.callRow,
				"data-chat-anchor-key": `call:${node.callId}`,
				"data-chat-call-id": node.callId,
				"data-selected": selected || void 0,
				children: renderSlot("conversation.chat.toolview", owner, {
					entryKey: toolName,
					fallback: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GenericToolCard, {
						...owner,
						t
					})
				})
			});
		});
		/** One tool call row (result or running): dispatches through the keyed
		*  toolview slot with the owner payload; unregistered tools fall back to
		*  GenericToolCard at this render site. A `run_code` call additionally
		*  renders its logged sub-dispatches as always-visible indented rows —
		*  each one the same keyed-slot dispatch as a native top-level call. */
		const CallRow = (0, react.memo)(function CallRow({ renderSlot, callId, toolName, block, openFile, openDetails, closeDetails, selected, subCalls, selectedCallId, cwd, inspectCall, t }) {
			const owner = (0, react.useMemo)(() => ({
				callId,
				toolName,
				block,
				openFile,
				cwd,
				selected,
				openDetails: () => {
					openDetails({ callId });
				},
				closeDetails,
				inspect: () => {
					inspectCall(callId);
				}
			}), [
				callId,
				toolName,
				block,
				openFile,
				cwd,
				selected,
				openDetails,
				closeDetails,
				inspectCall
			]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ChatView_module_css_default.callRow,
				"data-chat-anchor-key": `call:${callId}`,
				"data-chat-call-id": callId,
				"data-selected": selected || void 0,
				children: [renderSlot("conversation.chat.toolview", owner, {
					entryKey: toolName,
					fallback: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GenericToolCard, {
						...owner,
						t
					})
				}), subCalls !== void 0 && subCalls.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: ChatView_module_css_default.subCalls,
					"data-subcalls": true,
					children: subCalls.map((node) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SubCallRow, {
						renderSlot,
						node,
						openFile,
						openDetails,
						closeDetails,
						selected: node.callId === selectedCallId,
						cwd,
						inspectCall,
						t
					}, node.callId))
				})]
			});
		});
		/** Consecutive tool results as one step-run group (uniform 16px rhythm). */
		const ToolGroup = (0, react.memo)(function ToolGroup({ renderSlot, results, openFile, openDetails, closeDetails, selectedCallId, codeDispatches, cwd, inspectCall, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: ChatView_module_css_default.toolGroup,
				children: results.map((node) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CallRow, {
					renderSlot,
					callId: node.callId,
					toolName: node.call?.name ?? "",
					block: node,
					openFile,
					openDetails,
					closeDetails,
					selected: node.callId === selectedCallId,
					subCalls: codeDispatches.get(node.callId),
					selectedCallId,
					cwd,
					inspectCall,
					t
				}, node.callId))
			});
		});
		/** One command lifecycle row: keyed dispatch on the command name with the
		*  generic card as the render-site fallback (zero registration required). A
		*  run-less cross-window node has no name and always lands on the fallback. */
		const CommandRow = (0, react.memo)(function CommandRow({ renderSlot, node, t }) {
			const owner = (0, react.useMemo)(() => ({ node }), [node]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: ChatView_module_css_default.callRow,
				children: renderSlot("conversation.chat.commandview", owner, {
					entryKey: node.name ?? "",
					fallback: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GenericCommandCard, {
						...owner,
						t
					})
				})
			});
		});
		/** Turn-level model activity label retained across first-token, tool, and streaming phases. */
		function TurnStatus({ startTime, t }) {
			const [mountedAt] = (0, react.useState)(() => Date.now());
			const anchor = startTime ?? mountedAt;
			const [elapsedMs, setElapsedMs] = (0, react.useState)(() => Math.max(0, Date.now() - anchor));
			(0, react.useEffect)(() => {
				const tick = () => {
					setElapsedMs(Math.max(0, Date.now() - anchor));
				};
				tick();
				const id = setInterval(tick, 1e3);
				return () => {
					clearInterval(id);
				};
			}, [anchor]);
			const showClock = elapsedMs >= 15e3;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ChatView_module_css_default.turnStatus,
				role: "status",
				"aria-live": "polite",
				children: ["Deep diving...", showClock && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: ChatView_module_css_default.turnStatusClock,
					"aria-hidden": true,
					children: formatRunDuration(elapsedMs, t)
				})]
			});
		}
		/** The streaming partial, isolated so chunk batches re-render only this tail;
		*  the column ResizeObserver owns bottom-follow when its box grows. */
		function StreamingTail({ useSession, t }) {
			const partial = useSession((s) => s.partial);
			if (partial === null) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssistantMarkdown, {
				blocks: partial.blocks,
				streaming: true,
				t
			});
		}
		/**
		* The chat view slot entry: pure component over the composed props (tool rows
		* render through the declared keyed hole's renderSlot share).
		*/
		function ChatView({ useSession, useSessions, useStore, renderSlot, sessionId, openFile, openDetails, closeDetails, loadOlder, inspectCall, chatScroll, forkAt, t }) {
			const nodes = useSession((s) => s.nodes);
			const turnTimings = useSession((s) => s.turnTimings);
			const turnEnds = useSession((s) => s.turnEnds);
			const inbox = useSession((s) => s.queue);
			const cwd = useSessions((s) => s.byId[sessionId]?.cwd);
			const running = useSession((s) => s.running);
			const runningCalls = useSession((s) => s.runningCalls);
			const codeDispatches = useSession((s) => s.codeDispatches);
			const openState = useSession((s) => s.openState);
			const openError = useSession((s) => s.openError);
			const hasMore = useSession((s) => s.hasMore);
			const loadingOlder = useSession((s) => s.loadingOlder);
			const selectedCallId = useStore((s) => s.selection?.callId);
			const items = (0, react.useMemo)(() => deriveChatFlow(nodes), [nodes]);
			const pendingSteering = (0, react.useMemo)(() => inbox.filter((item) => item.placement === "steering"), [inbox]);
			const activeRetry = (0, react.useMemo)(() => activeRetrySeq(nodes, running), [nodes, running]);
			const actionSeqs = (0, react.useMemo)(() => assistantActionsSeqs(nodes), [nodes]);
			const branchSeqs = (0, react.useMemo)(() => messageBranchSeqs(nodes, turnEnds), [nodes, turnEnds]);
			const runningTurnStart = (0, react.useMemo)(() => runningTurnStartTime(turnTimings), [turnTimings]);
			const turnMetrics = (0, react.useMemo)(() => deriveTurnMetrics(nodes), [nodes]);
			const listRef = (0, react.useRef)(null);
			const columnRef = (0, react.useRef)(null);
			const atBottomRef = (0, react.useRef)(true);
			const [atBottom, setAtBottom] = (0, react.useState)(true);
			/** Last position delivered or written on the main thread. */
			const observedTopRef = (0, react.useRef)(0);
			/** Pre-input position for the current wheel gesture. */
			const wheelStartRef = (0, react.useRef)(null);
			const wheelEpochRef = (0, react.useRef)(0);
			/** Paging anchor: semantic row/position at click, updated by reader scrolls
			* while the request is pending and restored after the prepend lands. */
			const anchorRef = (0, react.useRef)(null);
			const firstSeqRef = (0, react.useRef)(null);
			const openedRef = (0, react.useRef)(false);
			const lastKeyRef = (0, react.useRef)(null);
			const lastSteeringIdRef = (0, react.useRef)(null);
			/** Flow tip signature — follow-scroll only when this moves, never on a
			*  scroll-driven at-bottom chrome re-render (that was snapping inertial
			*  scrolls the rest of the way to the floor). */
			const followSigRef = (0, react.useRef)(null);
			const firstSeq = nodes[0]?.seq ?? null;
			const lastItem = items[items.length - 1];
			const lastKey = lastItem?.key ?? null;
			const lastSteeringId = pendingSteering[pendingSteering.length - 1]?.id ?? null;
			const followSig = `${openState}:${firstSeq}:${lastKey}:${nodes.length}:${running ? 1 : 0}:${runningCalls.length}:${lastSteeringId ?? ""}`;
			const toBottom = (el) => {
				wheelStartRef.current = null;
				wheelEpochRef.current += 1;
				anchorRef.current = null;
				el.scrollTop = el.scrollHeight;
				observedTopRef.current = el.scrollTop;
				atBottomRef.current = true;
				setAtBottom(true);
				chatScroll.save(null);
			};
			(0, react.useLayoutEffect)(() => {
				const local = listRef.current;
				/* v8 ignore next -- ref-null guard: React attaches the ref before layout effects run. */
				if (local === null) return;
				const el = scrollerOf(local);
				if (openState === "open" && !openedRef.current) {
					openedRef.current = true;
					const saved = chatScroll.read();
					if (saved === null) toBottom(el);
					else {
						el.scrollTop = saved.scrollTop;
						const row = anchorElement(local, saved.anchorKey);
						if (row !== null) el.scrollTop += flowTop(row, el) - saved.anchorTop;
						observedTopRef.current = el.scrollTop;
						const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 25;
						atBottomRef.current = isAtBottom;
						setAtBottom(isAtBottom);
						const normalized = isAtBottom ? null : scrollPosition(local, el);
						if (isAtBottom) chatScroll.save(null);
						else if (normalized !== null) chatScroll.save(normalized);
					}
					firstSeqRef.current = firstSeq;
					lastKeyRef.current = lastKey;
					lastSteeringIdRef.current = lastSteeringId;
					followSigRef.current = followSig;
					return;
				}
				if (anchorRef.current !== null && firstSeq !== null && firstSeqRef.current !== null && firstSeq < firstSeqRef.current) {
					const anchor = anchorRef.current;
					anchorRef.current = null;
					const row = anchorElement(local, anchor.key);
					if (row !== null) el.scrollTop += flowTop(row, el) - anchor.top;
					observedTopRef.current = el.scrollTop;
					firstSeqRef.current = firstSeq;
					/* v8 ignore next -- ?? arm: a prepend adds nodes, so the flow list here is never empty. */
					lastKeyRef.current = lastKey;
					lastSteeringIdRef.current = lastSteeringId;
					followSigRef.current = followSig;
					return;
				}
				firstSeqRef.current = firstSeq;
				const appendedUser = lastKey !== lastKeyRef.current && lastItem !== void 0 && lastItem.kind === "node" && lastItem.node.kind === "user";
				const appendedSteering = lastSteeringId !== null && lastSteeringId !== lastSteeringIdRef.current;
				const tipMoved = followSigRef.current !== followSig;
				lastKeyRef.current = lastKey;
				lastSteeringIdRef.current = lastSteeringId;
				followSigRef.current = followSig;
				if (appendedUser || appendedSteering || tipMoved && atBottomRef.current) toBottom(el);
			});
			const onScrollRef = (0, react.useRef)(() => {});
			onScrollRef.current = () => {
				const local = listRef.current;
				/* v8 ignore next -- ref-null guard: the handler only fires while mounted. */
				if (local === null) return;
				const el = scrollerOf(local);
				const floor = Math.max(0, el.scrollHeight - el.clientHeight);
				const wheelStart = wheelStartRef.current;
				const movedByWheel = wheelStart !== null && Math.abs(el.scrollTop - Math.min(wheelStart, floor)) > .5;
				const isAtBottom = movedByWheel ? floor - el.scrollTop <= 25 : atBottomRef.current;
				if (!movedByWheel && isAtBottom) {
					toBottom(el);
					return;
				}
				atBottomRef.current = isAtBottom;
				setAtBottom(isAtBottom);
				const position = isAtBottom ? null : scrollPosition(local, el);
				if (isAtBottom) anchorRef.current = null;
				else if (anchorRef.current !== null && position !== null) anchorRef.current = {
					key: position.anchorKey,
					top: position.anchorTop
				};
				if (isAtBottom) chatScroll.save(null);
				else if (position !== null) chatScroll.save(position);
				observedTopRef.current = el.scrollTop;
			};
			(0, react.useEffect)(() => {
				const local = listRef.current;
				/* v8 ignore next -- ref-null guard: effect runs after the list node commits. */
				if (local === null) return;
				const el = scrollerOf(local);
				const onScroll = () => {
					onScrollRef.current();
				};
				const onWheel = (event) => {
					if (event.ctrlKey || event.deltaY === 0) return;
					const startTop = observedTopRef.current;
					const floor = Math.max(0, el.scrollHeight - el.clientHeight);
					if (!(event.deltaY < 0 ? startTop > 1 : startTop < floor - 1)) return;
					wheelStartRef.current = startTop;
					const epoch = ++wheelEpochRef.current;
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							if (wheelEpochRef.current === epoch) wheelStartRef.current = null;
						});
					});
				};
				el.addEventListener("scroll", onScroll, { passive: true });
				el.addEventListener("wheel", onWheel, {
					capture: true,
					passive: true
				});
				return () => {
					wheelStartRef.current = null;
					el.removeEventListener("scroll", onScroll);
					el.removeEventListener("wheel", onWheel, true);
				};
			}, []);
			const followRef = (0, react.useRef)(null);
			followRef.current = () => {
				const local = listRef.current;
				if (local !== null && atBottomRef.current) {
					const el = scrollerOf(local);
					el.scrollTop = el.scrollHeight;
					observedTopRef.current = el.scrollTop;
					chatScroll.save(null);
				}
			};
			(0, react.useEffect)(() => {
				const column = columnRef.current;
				const local = listRef.current;
				if (column === null || local === null || typeof ResizeObserver === "undefined") return;
				const composer = scrollerOf(local).querySelector("[data-composer-seat]");
				const observer = new ResizeObserver(() => {
					followRef.current?.();
				});
				observer.observe(column);
				if (composer !== null) observer.observe(composer);
				return () => {
					observer.disconnect();
				};
			}, []);
			(0, react.useEffect)(() => {
				if (!loadingOlder) anchorRef.current = null;
			}, [loadingOlder]);
			const loadOlderAnchored = () => {
				const local = listRef.current;
				/* v8 ignore next -- ref-null guard: the paging button renders inside the list tree. */
				if (local !== null) {
					const el = scrollerOf(local);
					const row = pagingAnchor(local, el);
					if (row !== null && row.dataset.chatAnchorKey !== void 0) anchorRef.current = {
						key: row.dataset.chatAnchorKey,
						top: flowTop(row, el)
					};
				}
				loadOlder();
			};
			const renderItem = (item) => {
				if (item.kind === "tool-group") {
					const inGroup = selectedCallId !== void 0 && item.results.some((r) => r.callId === selectedCallId || codeDispatches.get(r.callId)?.some((sub) => sub.callId === selectedCallId) === true);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolGroup, {
						renderSlot,
						results: item.results,
						openFile,
						openDetails,
						closeDetails,
						selectedCallId: inGroup ? selectedCallId : void 0,
						codeDispatches,
						cwd,
						inspectCall,
						t
					});
				}
				const node = item.node;
				if (node.kind === "assistant") {
					const timing = actionSeqs.has(node.seq) ? turnTimings.get(node.turn) : void 0;
					const metrics = timing?.endTime === void 0 ? void 0 : turnMetrics.get(node.turn);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssistantMarkdown, {
						blocks: node.blocks,
						streaming: false,
						interrupted: node.interrupted,
						time: actionSeqs.has(node.seq) ? node.time : void 0,
						runMs: timing?.endTime === void 0 ? void 0 : Math.max(0, timing.endTime - timing.startTime),
						ttftMs: metrics?.ttftMs,
						tokensPerSecond: metrics?.tokensPerSecond,
						seq: node.seq,
						onFork: forkAt,
						forkUnavailable: !branchSeqs.has(node.seq),
						t
					});
				}
				if (node.kind === "command") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CommandRow, {
					renderSlot,
					node,
					t
				});
				/* v8 ignore next -- tool-result never reaches here: deriveChatFlow folds them into groups. */
				if (node.kind === "tool-result") return null;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MessageItem, {
					node,
					retryActive: node.kind === "model-retry" && node.seq === activeRetry,
					onFork: forkAt,
					forkUnavailable: !branchSeqs.has(node.seq),
					t
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: ChatView_module_css_default.root,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: listRef,
					className: ChatView_module_css_default.scroll,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						ref: columnRef,
						className: ChatView_module_css_default.column,
						"data-chat-flow": "",
						children: [
							openState === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ChatView_module_css_default.hint,
								children: t("chat.loadingHistory")
							}),
							openState === "error" && openError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ChatView_module_css_default.openError,
								children: t("chat.loadError", {
									message: openError.message,
									code: openError.code
								})
							}),
							hasMore && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ChatView_module_css_default.older,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									disabled: loadingOlder,
									onClick: loadOlderAnchored,
									children: loadingOlder ? t("loading") : t("chat.loadOlder")
								})
							}),
							items.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ChatView_module_css_default.flowItem,
								"data-chat-anchor-key": item.kind === "node" ? `node:${String(item.node.seq)}` : void 0,
								"data-chat-flow-key": item.key,
								"data-chat-flow-kind": item.kind === "node" ? item.node.kind : "tool-group",
								children: renderItem(item)
							}, item.key)),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StreamingTail, {
								useSession,
								t
							}),
							runningCalls.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ChatView_module_css_default.toolGroup,
								children: runningCalls.map((call) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CallRow, {
									renderSlot,
									callId: call.callId,
									toolName: call.name,
									block: call,
									openFile,
									openDetails,
									closeDetails,
									selected: call.callId === selectedCallId,
									subCalls: codeDispatches.get(call.callId),
									selectedCallId,
									cwd,
									inspectCall,
									t
								}, call.callId))
							}),
							running && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TurnStatus, {
								startTime: runningTurnStart,
								t
							}),
							pendingSteering.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PendingSteeringBubble, {
								content: item.content,
								t
							}, item.id))
						]
					}), !atBottom && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ChatView_module_css_default.toBottomSlot,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: ChatView_module_css_default.toBottom,
							"aria-label": t("chat.toBottom"),
							onClick: () => {
								const local = listRef.current;
								/* v8 ignore next -- ref-null guard: the button only renders alongside the mounted list. */
								if (local !== null) toBottom(scrollerOf(local));
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, {})
						})
					})]
				})
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** `conversation` namespace dictionaries. */
		/** Dictionary namespace owned by this plugin. */
		const NS = "conversation";
		const PLAN_NEXT_ACTION_ZH = "描述你的任务以生成计划";
		const PLAN_NEXT_ACTION_EN = "describe your task to generate plan";
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"view.chat": "对话",
			"hint.plan": PLAN_NEXT_ACTION_ZH,
			"hint.goal": "输入目标，智能体将持续执行",
			"hint.goal.active": "当前目标进行中。可输入 edit 修改 / pause 暂停 / resume 继续 / clear 清除",
			"placeholder.plan": PLAN_NEXT_ACTION_ZH,
			"placeholder.default": "给智能体发消息",
			"placeholder.unavailable": "会话不可用",
			"placeholder.hero": "描述你想要构建的内容",
			"placeholder.workspace": "选择一个工作区开始",
			"input.commands": "命令",
			"input.stop": "停止生成",
			"input.send": "发送消息",
			"input.accessMode": "访问模式，当前：{name}",
			"context.aria": "上下文已用 {percent}",
			"context.used": "上下文已用",
			"context.system": "系统提示词",
			"context.tools": "工具",
			"context.messages": "对话消息",
			"stats.counts": "{turns} 轮 · {steps} 步",
			"stats.llm": "LLM {duration}",
			"stats.toolCall": "工具调用 {duration}",
			"stats.ttftAverage": "首 token 平均 {duration}",
			"stats.tokensPerSecond": "{throughput} tok/s",
			"stats.cacheHit": "缓存命中 {percent}%",
			"stats.tokens": "输入 {input} tok · 输出 {output} tok",
			"settings.enter.title": "繁忙时 Enter 键行为",
			"settings.enter.description": "仅在智能体运行时生效；Cmd/Ctrl+Enter 使用另一行为",
			"settings.enter.queue": "排队发送",
			"settings.enter.steer": "插话发送",
			"access.confirm.title": "确认启用 Full access？",
			"access.confirm.description": "启用 Full access 后，agent 将减少确认步骤，并且可以直接执行更多操作，包括敏感操作、文件修改或外部命令。仅建议在你信任当前任务时使用。",
			"access.confirm.acknowledge": "我已了解风险，并愿意继续",
			"access.confirm.cancel": "取消",
			"access.confirm.enable": "启用 Full access",
			"hero.headline": "开始构建吧",
			"hero.preview": "预览版",
			"hero.chooseWorkspace": "选择工作区",
			"session.hierarchy": "会话层级",
			"details.title": "详情",
			"details.close": "关闭详情",
			"details.empty": "点击消息流中的工具行查看详情",
			"details.notInWindow": "该调用不在当前窗口内",
			"details.input": "输入",
			"details.output": "输出",
			"details.running": "运行中…",
			"todo.title": "任务",
			"todo.progress.done": "{done} 已完成",
			"todo.progress.active": "{active} 进行中",
			"todo.progress.pending": "{pending} 待处理",
			"todo.rowTitle": "更新任务清单",
			"todo.completed": "{done}/{total} 已完成",
			"chat.loadingHistory": "载入历史…",
			"chat.loadError": "历史加载失败：{message}（{code}）",
			"chat.loadOlder": "加载更早",
			"chat.toBottom": "回到底部",
			"message.extraBlock": "附加内容块",
			"message.contextInjection": "上下文注入",
			"message.contextRecall": "跨会话召回",
			"message.context.instructions.loaded": "已载入",
			"message.context.instructions.added": "已新增",
			"message.context.instructions.updated": "已更新",
			"message.context.instructions.removed": "已移除",
			"message.context.catalog.replaced": "替换目录",
			"message.context.catalog.more": "…还有 {count} 条",
			"message.context.snapshot.supersedes": "取代先前的快照",
			"message.context.relay.from": "来自会话 {session}",
			"message.context.recall.counts": "保留 {retained} 条 · 省略 {omitted} 条",
			"message.context.recall.truncated": "已截断",
			"message.steering": "插话",
			"message.compaction": "上下文已压缩",
			"message.compaction.expand": "点击查看压缩摘要",
			"message.compaction.unavailable": "压缩摘要不可用",
			"message.unknownSurface": "未知 surface 事件：{type}",
			"message.unknownBlock": "未知内容块",
			"message.stopped": "已停止",
			"message.branch": "在新对话中分支",
			"message.branchUnavailable": "仅可从已完成轮次的最后一条消息分支",
			"message.retry.active": "正在重试模型请求",
			"message.retry.cancelled": "模型请求重试已取消",
			"message.retry.started": "已重试模型请求",
			"message.retry.scheduled": "等待重试模型请求",
			"message.retry.status": "{label}（{retry}/{maximum}） · {seconds}s",
			"message.retry.delay": "重试延迟：",
			"message.retry.failure": "失败原因：",
			"message.turnError": "本轮运行失败",
			"message.ranFor": "用时 {duration}",
			"message.ttft": "首 token {seconds}秒",
			"message.tokensPerSecond": "{tps} tok/s",
			"duration.seconds": "{seconds}秒",
			"duration.minutes": "{minutes}分{seconds}秒",
			"command.running": "执行中…",
			"command.failed": "命令失败",
			"command.done": "已完成",
			"command.title": "命令",
			"approval.waiting": "等待审批",
			"approval.detail.aria": "审批详情",
			"approval.escalation": "工具 {toolName} 请求越权执行",
			"approval.reject": "拒绝",
			"approval.allowOnce": "允许一次",
			"ask.rowTitle": "提问",
			"ask.waiting": "等待回答",
			"ask.cancelled": "已取消",
			"ask.interrupted": "已中断",
			"ask.answered": "{answered}/{total} 已回答",
			"bash.running": "运行中",
			"bash.failed": "失败",
			"bash.stopped": "已停止",
			"row.running": "运行中",
			"row.failed": "失败",
			"row.stopped": "已停止",
			"queue.count": "{n} 条排队消息",
			"queue.edit": "编辑排队消息",
			"queue.edit.unsupported": "包含非文本内容，暂不支持编辑",
			"queue.save": "保存排队消息",
			"queue.cancelEdit": "取消编辑",
			"queue.remove": "删除排队消息",
			"queue.steer": "插话发送",
			"queue.steer.unavailable": "仅运行中可插话发送",
			"queue.editFailed": "编辑失败：这条消息可能已经开始发送。",
			"queue.removeFailed": "删除失败：这条消息可能已经开始发送。",
			"queue.steerFailed": "插话发送失败，请重试。",
			"terminal.signal": "信号 {signal}",
			"terminal.exitCode": "退出码 {code}",
			"terminal.running": "运行中",
			"terminal.failed": "失败",
			"terminal.done": "已完成",
			"terminal.noOutput": "无输出",
			"terminal.collapseAria": "收起输出",
			"terminal.expandAria": "展开其余 {n} 行输出",
			"terminal.expandRest": "… 其余 {n} 行",
			"json.truncated": "… 已截断，共 {total} 字符",
			"clock.md": "{m}月{d}日",
			"clock.ymd": "{y}年{m}月{d}日"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"view.chat": "Chat",
			"hint.plan": PLAN_NEXT_ACTION_EN,
			"hint.goal": "describe the objective for a long-running task",
			"hint.goal.active": "goal active — edit / pause / resume / clear",
			"placeholder.plan": PLAN_NEXT_ACTION_EN,
			"placeholder.default": "Message the agent",
			"placeholder.unavailable": "Session unavailable",
			"placeholder.hero": "Describe what you want to build",
			"placeholder.workspace": "Choose a workspace to start",
			"input.commands": "Commands",
			"input.stop": "Stop generating",
			"input.send": "Send message",
			"input.accessMode": "Access mode, current: {name}",
			"context.aria": "{percent} of context used",
			"context.used": "of context used",
			"context.system": "System prompt",
			"context.tools": "Tools",
			"context.messages": "Messages",
			"stats.counts": "{turns} turns · {steps} steps",
			"stats.llm": "LLM {duration}",
			"stats.toolCall": "Tool call {duration}",
			"stats.ttftAverage": "TTFT avg {duration}",
			"stats.tokensPerSecond": "{throughput} tok/s",
			"stats.cacheHit": "Cache hit {percent}%",
			"stats.tokens": "Input {input} tok · Output {output} tok",
			"settings.enter.title": "Enter behavior while busy",
			"settings.enter.description": "Busy only; Cmd/Ctrl+Enter uses the other behavior",
			"settings.enter.queue": "Queue",
			"settings.enter.steer": "Steer",
			"access.confirm.title": "Enable Full access?",
			"access.confirm.description": "Full access reduces confirmation steps and lets the agent perform more actions directly, including sensitive operations, file changes, or external commands. Only use it when you trust the current task.",
			"access.confirm.acknowledge": "I understand the risks and want to continue",
			"access.confirm.cancel": "Cancel",
			"access.confirm.enable": "Enable Full access",
			"hero.headline": "Let's start building",
			"hero.preview": "Preview",
			"hero.chooseWorkspace": "Choose workspace",
			"session.hierarchy": "Session hierarchy",
			"details.title": "Details",
			"details.close": "Close details",
			"details.empty": "Click a tool row in the message flow to view its details",
			"details.notInWindow": "This call is outside the current window",
			"details.input": "Input",
			"details.output": "Output",
			"details.running": "Running…",
			"todo.title": "To-dos",
			"todo.progress.done": "{done} completed",
			"todo.progress.active": "{active} in progress",
			"todo.progress.pending": "{pending} pending",
			"todo.rowTitle": "Update to-do list",
			"todo.completed": "{done}/{total} completed",
			"chat.loadingHistory": "Loading history…",
			"chat.loadError": "Failed to load history: {message} ({code})",
			"chat.loadOlder": "Load earlier",
			"chat.toBottom": "Back to bottom",
			"message.extraBlock": "Extra content block",
			"message.contextInjection": "Context injection",
			"message.contextRecall": "Session recall",
			"message.context.instructions.loaded": "loaded",
			"message.context.instructions.added": "added",
			"message.context.instructions.updated": "updated",
			"message.context.instructions.removed": "removed",
			"message.context.catalog.replaced": "Replacement catalog",
			"message.context.catalog.more": "… {count} more",
			"message.context.snapshot.supersedes": "Supersedes earlier snapshots",
			"message.context.relay.from": "From session {session}",
			"message.context.recall.counts": "{retained} kept · {omitted} omitted",
			"message.context.recall.truncated": "truncated",
			"message.steering": "Interjection",
			"message.compaction": "Context compacted",
			"message.compaction.expand": "View compaction summary",
			"message.compaction.unavailable": "Compaction summary unavailable",
			"message.unknownSurface": "Unknown surface event: {type}",
			"message.unknownBlock": "Unknown content block",
			"message.stopped": "Stopped",
			"message.branch": "Branch into a new conversation",
			"message.branchUnavailable": "Available only on the last message of a completed turn",
			"message.retry.active": "Retrying model request",
			"message.retry.cancelled": "Model request retry cancelled",
			"message.retry.started": "Retried model request",
			"message.retry.scheduled": "Waiting to retry model request",
			"message.retry.status": "{label} ({retry}/{maximum}) · {seconds}s",
			"message.retry.delay": "Retry delay: ",
			"message.retry.failure": "Failure reason: ",
			"message.turnError": "This turn failed",
			"message.ranFor": "Ran for {duration}",
			"message.ttft": "TTFT {seconds}s",
			"message.tokensPerSecond": "{tps} tok/s",
			"duration.seconds": "{seconds}s",
			"duration.minutes": "{minutes}m {seconds}s",
			"command.running": "Running…",
			"command.failed": "Command failed",
			"command.done": "Completed",
			"command.title": "Command",
			"approval.waiting": "Waiting for approval",
			"approval.detail.aria": "Approval details",
			"approval.escalation": "Tool {toolName} requests privileged execution",
			"approval.reject": "Reject",
			"approval.allowOnce": "Allow once",
			"ask.rowTitle": "Ask question",
			"ask.waiting": "waiting",
			"ask.cancelled": "cancelled",
			"ask.interrupted": "interrupted",
			"ask.answered": "{answered}/{total} answered",
			"bash.running": "Running",
			"bash.failed": "Failed",
			"bash.stopped": "Stopped",
			"row.running": "Running",
			"row.failed": "Failed",
			"row.stopped": "Stopped",
			"queue.count": "{n} queued messages",
			"queue.edit": "Edit queued message",
			"queue.edit.unsupported": "Contains non-text content; editing is not supported yet",
			"queue.save": "Save queued message",
			"queue.cancelEdit": "Cancel editing",
			"queue.remove": "Remove queued message",
			"queue.steer": "Steer queued message",
			"queue.steer.unavailable": "Steering is available only while the agent is running",
			"queue.editFailed": "Edit failed: this message may have already started sending.",
			"queue.removeFailed": "Removal failed: this message may have already started sending.",
			"queue.steerFailed": "Steering failed. Try again.",
			"terminal.signal": "signal {signal}",
			"terminal.exitCode": "exit code {code}",
			"terminal.running": "Running",
			"terminal.failed": "Failed",
			"terminal.done": "Done",
			"terminal.noOutput": "No output",
			"terminal.collapseAria": "Collapse output",
			"terminal.expandAria": "Expand the remaining {n} output lines",
			"terminal.expandRest": "… {n} more lines",
			"json.truncated": "… truncated, {total} characters total",
			"clock.md": "{m}/{d}",
			"clock.ymd": "{y}-{m}-{d}"
		};
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/toolviews/bash-sample.module.css.mjs
		const css$6 = ".qXLRoW_card{flex-direction:column;display:flex}.qXLRoW_terminal{--dsl-terminal-font:var(--dsw-font-markdown-code-block-small);--dsl-terminal-line-height:18px;--dsl-terminal-output-max-height:224px;border:1px solid var(--dsw-alias-border-l1);margin:4px 0 4px 4px}.qXLRoW_ioCard{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-markdown-code-block);font:var(--dsw-font-markdown-code-block-small);border-radius:12px;flex-direction:column;margin:4px 0 4px 4px;display:flex}.qXLRoW_ioSection{grid-template-columns:max-content 1fr;align-items:baseline;column-gap:14px;max-height:150px;padding:12px 16px;display:grid;overflow-y:auto}.qXLRoW_ioSection::-webkit-scrollbar-thumb{background-clip:padding-box;border:2px solid #0000;border-radius:6px}.qXLRoW_ioSection::-webkit-scrollbar-track{margin:6px 0}.qXLRoW_ioLabel{color:var(--dsw-alias-label-caption);align-self:start;position:sticky;top:0}.qXLRoW_ioDivider{background:var(--dsw-alias-border-l2);flex:none;height:1px}.qXLRoW_ioText{white-space:pre-wrap;word-break:break-word;min-width:0;color:var(--dsw-alias-label-secondary)}.qXLRoW_ioText[data-error]{color:var(--dsw-alias-state-error-primary)}.qXLRoW_root[data-expandable]{cursor:pointer}.qXLRoW_root{align-items:center;min-width:0;height:24px;display:flex;position:relative;overflow:hidden}.qXLRoW_root[data-state=running]:after{content:\"\";background:linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--dsw-alias-bg-base) 60%, transparent) 55%, transparent 100%);pointer-events:none;width:300px;animation:2.6s ease-out infinite qXLRoW_dsh-bash-row-sweep;position:absolute;top:0;bottom:0;left:0}@keyframes qXLRoW_dsh-bash-row-sweep{0%{left:-300px}90%,to{left:100%}}.qXLRoW_leading{width:16px;height:16px;color:var(--dsw-alias-label-tertiary);flex:none;justify-content:center;align-items:center;margin-right:6px;display:inline-flex;position:relative}.qXLRoW_chevron{color:var(--dsw-alias-label-secondary)}.qXLRoW_iconIdle{opacity:1;transition:opacity .1s;display:inline-flex}.qXLRoW_chevronHover{opacity:0;margin:auto;transition:opacity .1s;position:absolute;inset:0}.qXLRoW_root:hover .qXLRoW_iconIdle{opacity:0}.qXLRoW_root:hover .qXLRoW_chevronHover{opacity:1}.qXLRoW_title{color:var(--dsw-alias-label-secondary);flex:none;font-size:14px;line-height:24px}.qXLRoW_sep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}.qXLRoW_summary{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-tertiary);flex:auto;font-size:14px;line-height:24px;overflow:hidden}.qXLRoW_errorSummary{color:var(--dsw-alias-state-error-primary)}.qXLRoW_bodyWrap{flex-direction:column;display:flex}.qXLRoW_inspectButton{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:0;border-radius:999px;align-self:flex-start;align-items:center;gap:4px;margin:4px 0 2px 4px;padding:2px 8px;font-size:11px;line-height:16px;transition:opacity .1s;display:inline-flex}.qXLRoW_card:hover .qXLRoW_inspectButton,.qXLRoW_inspectButton:focus-visible{opacity:1}.qXLRoW_inspectButton:hover{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-primary)}.qXLRoW_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}";
		const tagId$6 = "@deepseek-ai/dsh-client-ui-conversation/bash-sample.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$6) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$6;
			tag.textContent = css$6;
			document.head.appendChild(tag);
		}
		var bash_sample_module_css_default = {
			"dsh-bash-row-sweep": "qXLRoW_dsh-bash-row-sweep",
			"ioLabel": "qXLRoW_ioLabel",
			"card": "qXLRoW_card",
			"chevronHover": "qXLRoW_chevronHover",
			"terminal": "qXLRoW_terminal",
			"ioSection": "qXLRoW_ioSection",
			"summary": "qXLRoW_summary",
			"ioDivider": "qXLRoW_ioDivider",
			"ioText": "qXLRoW_ioText",
			"iconIdle": "qXLRoW_iconIdle",
			"sep": "qXLRoW_sep",
			"inspectButton": "qXLRoW_inspectButton",
			"bodyWrap": "qXLRoW_bodyWrap",
			"errorSummary": "qXLRoW_errorSummary",
			"title": "qXLRoW_title",
			"visuallyHidden": "qXLRoW_visuallyHidden",
			"ioCard": "qXLRoW_ioCard",
			"chevron": "qXLRoW_chevron",
			"root": "qXLRoW_root",
			"leading": "qXLRoW_leading"
		};
		//#endregion
		//#region src/client/toolviews/bash-sample.tsx
		function leadingFor(state) {
			switch (state) {
				case "error": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "error" });
				case "stopped": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "warning" });
				default: return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconApiOutline14, { size: 14 });
			}
		}
		/** Visually hidden status — StateDot is aria-hidden; AT needs a text label. */
		function stateStatus(state, t) {
			switch (state) {
				case "running": return t("bash.running");
				case "error": return t("bash.failed");
				case "stopped": return t("bash.stopped");
				default: return null;
			}
		}
		/**
		* Bash row: icon + Bash · {description} in the shared ToolRow chrome, the
		* whole row toggling the command's terminal or generic error card (ToolRow's unified
		* expand interaction, replicated locally per the registrant posture).
		*/
		function BashRow({ toolName, block, sessionId, useSessions, inspect, t }) {
			const model = toolRowModel(toolName, block);
			const terminal = terminalCardModel(block, useSessions((list) => list.byId[sessionId]?.cwd));
			const state = model.state === "ok" && terminal !== null && terminalFailed(terminal) ? "error" : model.state;
			const status = stateStatus(state, t);
			const [expanded, setExpanded] = (0, react.useState)(false);
			const genericError = terminal === null && model.state === "error" && (model.body !== null || model.output !== null);
			const expandable = terminal !== null || genericError;
			const open = expanded && expandable;
			const failureLine = model.state === "error" ? model.errorSummary : null;
			const toggleExpand = () => {
				setExpanded((v) => !v);
			};
			const toggleFromKeyboard = (event) => {
				if (!expandable || event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				toggleExpand();
			};
			const leading = open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { className: bash_sample_module_css_default.chevron }) : expandable ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: bash_sample_module_css_default.iconIdle,
				children: leadingFor(state)
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { className: clsx(bash_sample_module_css_default.chevron, bash_sample_module_css_default.chevronHover) })] }) : leadingFor(state);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: bash_sample_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: bash_sample_module_css_default.root,
					"data-sample": "bash",
					"data-variant": "bash",
					"data-state": state,
					"data-expandable": expandable || void 0,
					role: expandable ? "button" : void 0,
					tabIndex: expandable ? 0 : void 0,
					"aria-expanded": expandable ? open : void 0,
					onClick: expandable ? toggleExpand : void 0,
					onKeyDown: expandable ? toggleFromKeyboard : void 0,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: bash_sample_module_css_default.leading,
							children: leading
						}),
						status !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: bash_sample_module_css_default.visuallyHidden,
							children: status
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: bash_sample_module_css_default.title,
							children: model.title
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: bash_sample_module_css_default.sep,
							"aria-hidden": true
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: clsx(bash_sample_module_css_default.summary, failureLine !== null && bash_sample_module_css_default.errorSummary),
							children: failureLine ?? terminal?.description ?? model.summary
						})
					]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: bash_sample_module_css_default.bodyWrap,
					children: [terminal !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TerminalBlock, {
						...terminal.card,
						maxLines: Infinity,
						labels: terminalBlockLabels(t),
						className: bash_sample_module_css_default.terminal
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: bash_sample_module_css_default.ioCard,
						children: [
							model.body !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: bash_sample_module_css_default.ioSection,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: bash_sample_module_css_default.ioLabel,
									children: "IN"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: bash_sample_module_css_default.ioText,
									children: model.body
								})]
							}),
							model.body !== null && model.output !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: bash_sample_module_css_default.ioDivider,
								"aria-hidden": true
							}),
							model.output !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: bash_sample_module_css_default.ioSection,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: bash_sample_module_css_default.ioLabel,
									children: "OUT"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: bash_sample_module_css_default.ioText,
									"data-error": true,
									children: model.output
								})]
							})
						]
					}), inspect !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: bash_sample_module_css_default.inspectButton,
						onClick: inspect,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							width: "12",
							height: "12",
							viewBox: "0 0 16 16",
							fill: "none",
							xmlns: "http://www.w3.org/2000/svg",
							"aria-hidden": true,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
								d: "M16 8L10.8571 12V10.552L14.1383 8L10.8571 5.448V4L16 8ZM5.14286 10.552L1.86171 8L5.14286 5.448V4L0 8L5.14286 12V10.552ZM9.02514 4L5.59657 12H6.84057L10.2691 4H9.02514Z",
								fill: "currentColor"
							})
						}), "Inspect"]
					})]
				})]
			});
		}
		/**
		* The sample as a plain registrant plugin. Slot injection follows the chat
		* toolview declaration across independent activation and reload lifetimes.
		*/
		const bashToolviewSample = {
			name: "bash-toolview-sample",
			inject: ["slots"],
			/**
			* Register the bash row into the chat view's keyed toolview hole.
			* @param ctx - registrant context (disposal rides ctx.effect inside slots.register).
			*/
			apply(ctx) {
				ctx.slots.inject("conversation.chat.toolview", () => ctx.slots.register({
					name: "conversation.chat.toolview",
					key: "bash",
					locale: NS
				}, BashRow));
			}
		};
		//#endregion
		//#region src/client/toolviews/read-row.tsx
		/**
		* Read row: icon + Read · {path} in the shared ToolRow chrome, with the file's
		* read card as the row's collapsed-by-default card body. The summary path is an
		* openable host link when the row names a single file.
		*/
		function ReadRow({ toolName, block, cwd, openFile, inspect, t }) {
			const model = toolRowModel(toolName, block, cwd);
			const read = readCardModel(block, cwd);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolRow, {
				t,
				variant: model.variant,
				toolName,
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBrowseOutline16, { size: 14 }),
				title: model.title,
				summary: model.summary,
				body: null,
				output: model.output,
				errorSummary: model.errorSummary,
				read,
				state: model.state,
				filePath: model.filePath,
				onOpenFile: openFile,
				inspect
			});
		}
		/**
		* The read row as a plain registrant plugin following the chat toolview
		* declaration across independent activation and reload lifetimes.
		*/
		const readToolview = {
			name: "read-toolview",
			inject: ["slots"],
			/**
			* Register the read row into the chat view's keyed toolview hole.
			* @param ctx - registrant context (disposal rides ctx.effect inside slots.register).
			*/
			apply(ctx) {
				ctx.slots.inject("conversation.chat.toolview", () => ctx.slots.register({
					name: "conversation.chat.toolview",
					key: "read",
					locale: NS
				}, ReadRow));
			}
		};
		//#endregion
		//#region src/client/toolviews/file-mutation-row.tsx
		/**
		* File-mutation row: icon + {Edit,Write} · {path} in the shared ToolRow chrome,
		* with the applied diff as the row's collapsed-by-default card body. The
		* summary is a path link (a file tool's interaction); the host's `openFile`
		* resolves it against the session cwd, so this passes the tool's own path
		* verbatim. An errored mutation has no diff card, so ToolRow surfaces the
		* model-facing error text through its Output section and its first line in the
		* collapsed summary instead.
		*/
		function FileMutationRow({ toolName, block, cwd, openFile, inspect, t }) {
			const model = toolRowModel(toolName, block, cwd);
			const diff = diffCardModel(block);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolRow, {
				t,
				variant: model.variant,
				toolName,
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, { size: 14 }),
				title: model.title,
				summary: model.summary,
				body: null,
				output: model.output,
				errorSummary: model.errorSummary,
				diff,
				state: model.state,
				filePath: model.filePath,
				onOpenFile: openFile,
				inspect
			});
		}
		/**
		* The file-mutation rows as a plain registrant plugin following the chat
		* toolview declaration across independent activation and reload lifetimes.
		*/
		const fileMutationToolview = {
			name: "file-mutation-toolview",
			inject: ["slots"],
			/**
			* Register the file-mutation row into the chat view's keyed toolview hole
			* under both mutation tool names.
			* @param ctx - registrant context (disposal rides ctx.effect inside slots.register).
			*/
			apply(ctx) {
				ctx.slots.inject("conversation.chat.toolview", function* () {
					yield ctx.slots.register({
						name: "conversation.chat.toolview",
						key: "edit",
						locale: NS
					}, FileMutationRow);
					yield ctx.slots.register({
						name: "conversation.chat.toolview",
						key: "write",
						locale: NS
					}, FileMutationRow);
				});
			}
		};
		//#endregion
		//#region src/client/toolviews/search-row.tsx
		/**
		* Search row: icon + Search · {summary} in the shared ToolRow chrome, with the
		* completed search's card as the row's collapsed-by-default card body (a capped
		* search's recovery footer rides below it, inside ToolRow). Registered under
		* both `grep` and `glob`; the derived model's `kind` decides the card shape. A
		* settled call with no search card surfaces its model-facing text through
		* ToolRow's Output section, since the keyed SearchRow owns this render slot.
		*/
		function SearchRow({ toolName, block, inspect, t }) {
			const model = toolRowModel(toolName, block);
			const search = searchCardModel(block);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolRow, {
				t,
				variant: model.variant,
				toolName,
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, { size: 14 }),
				title: model.title,
				summary: search?.title ?? model.summary,
				body: null,
				output: model.output,
				errorSummary: model.errorSummary,
				search,
				state: model.state,
				inspect
			});
		}
		/**
		* The search toolview follows the chat toolview declaration across activation
		* and reload. One component registers under both keys because `grep` and
		* `glob` are the same visual object discriminated by the result view's `kind`.
		*/
		const searchToolview = {
			name: "search-toolview",
			inject: ["slots"],
			/**
			* Register the search row into the chat view's keyed toolview hole under both
			* the `grep` and `glob` tool names.
			* @param ctx - registrant context (disposal rides ctx.effect inside slots.register).
			*/
			apply(ctx) {
				ctx.slots.inject("conversation.chat.toolview", function* () {
					yield ctx.slots.register({
						name: "conversation.chat.toolview",
						key: "grep",
						locale: NS
					}, SearchRow);
					yield ctx.slots.register({
						name: "conversation.chat.toolview",
						key: "glob",
						locale: NS
					}, SearchRow);
				});
			}
		};
		//#endregion
		//#region src/client/toolviews/web-row.tsx
		/** web_fetch reads one URL; web_search queries. Titles are figma literals. */
		const WEB_TITLES = {
			web_search: "Search",
			web_fetch: "Fetch"
		};
		/**
		* Web row: icon + Search/Fetch · {summary} in the shared ToolRow chrome, with
		* the completed retrieval's web card as the row's collapsed-by-default card
		* body. The row discriminates on `toolName` only to pick its icon and title.
		*/
		function WebRow({ toolName, block, inspect, t }) {
			const model = toolRowModel(toolName, block);
			const web = webCardModel(block);
			const icon = toolName === "web_fetch" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBrowseOutline16, { size: 14 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, { size: 14 });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolRow, {
				t,
				variant: model.variant,
				toolName,
				icon,
				title: WEB_TITLES[toolName] ?? model.title,
				summary: model.summary,
				body: null,
				output: model.output,
				errorSummary: model.errorSummary,
				web,
				state: model.state,
				inspect
			});
		}
		/**
		* The web rows follow the chat toolview declaration across activation and
		* reload. One WebRow component registers under both web tool names.
		*/
		const webToolview = {
			name: "web-toolview",
			inject: ["slots"],
			/**
			* Register the web row under both web tool names' keyed toolview holes.
			* @param ctx - registrant context (disposal rides ctx.effect inside slots.register).
			*/
			apply(ctx) {
				ctx.slots.inject("conversation.chat.toolview", function* () {
					yield ctx.slots.register({
						name: "conversation.chat.toolview",
						key: "web_search",
						locale: NS
					}, WebRow);
					yield ctx.slots.register({
						name: "conversation.chat.toolview",
						key: "web_fetch",
						locale: NS
					}, WebRow);
				});
			}
		};
		//#endregion
		//#region src/client/contract/slots.ts
		/**
		* Approval domain face over the carrier (the ui-question PendingQuestion
		* pattern): render identity and question material forwarded transparently;
		* answer owns the wire encoding — the ApprovalResponsePayload value shape
		* with the audit correlation the host reconciles — and turns a rejected
		* carrier receipt into a thrown error. Minted per carrier via useMemo.
		*/
		var PendingApproval = class {
			wait;
			/**
			* @param wait - the runtime carrier for one pending approval question.
			*/
			constructor(wait) {
				this.wait = wait;
			}
			/** Opaque render identity (React key / one-shot latch remount axis), forwarded from the carrier. */
			get key() {
				return this.wait.key;
			}
			/** The tool the question is about (headline fallback), forwarded from the carrier payload. */
			get toolName() {
				return this.wait.payload.toolName;
			}
			/** The asker's human-readable WHY (headline when present), forwarded from the carrier payload. */
			get reason() {
				return this.wait.payload.reason;
			}
			/** The paired tool call's id when the ask names one (command-line lookup key), forwarded from the carrier payload. */
			get callId() {
				return this.wait.payload.callId;
			}
			/**
			* Deliver the user's decision; a rejected carrier receipt throws. Panel
			* removal stays frame-driven: the broadcast `approval/resolved` settles the
			* wait and drops it from the pending list.
			* @param outcome - the only two client-answerable outcomes.
			*/
			async answer(outcome) {
				const receipt = await this.wait.respond({
					ok: true,
					value: {
						sessionId: this.wait.sessionId,
						approvalId: this.wait.payload.approvalId,
						outcome
					}
				});
				if (!receipt.accepted) throw new Error(`approval response rejected: ${receipt.reason}`);
			}
		};
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/skeleton/ApprovalPanel.module.css.mjs
		const css$5 = ".OXc72G_root{padding:8px calc(var(--dsh-composer-side-clearance) + 16px) 12px;flex-direction:column;align-items:center;display:flex}.OXc72G_card{width:100%;max-width:var(--dsh-chat-content-width);border:1px solid var(--dsw-alias-state-warn-secondary);background:var(--dsw-specific-input-major);box-shadow:var(--dsw-shadow-lv2);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:20px;overflow:hidden}.OXc72G_strip{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary);align-items:center;gap:8px;padding:10px 16px;font-size:13px;line-height:18px;display:flex}.OXc72G_dot{background:var(--dsw-alias-state-warn-primary);border-radius:50%;width:8px;height:8px}.OXc72G_body{box-sizing:border-box;max-height:var(--dsh-composer-text-max-height);flex-direction:column;gap:6px;padding:12px 16px 0;display:flex;overflow-y:auto}.OXc72G_headline{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:500;line-height:24px}.OXc72G_command{color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code);word-break:break-all;font-size:13px;line-height:20px}.OXc72G_actionRow{justify-content:flex-end;gap:8px;padding:14px 16px;display:flex}.OXc72G_reject:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);border-color:#0000}";
		const tagId$5 = "@deepseek-ai/dsh-client-ui-conversation/ApprovalPanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$5) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$5;
			tag.textContent = css$5;
			document.head.appendChild(tag);
		}
		var ApprovalPanel_module_css_default = {
			"root": "OXc72G_root",
			"card": "OXc72G_card",
			"dot": "OXc72G_dot",
			"body": "OXc72G_body",
			"actionRow": "OXc72G_actionRow",
			"reject": "OXc72G_reject",
			"command": "OXc72G_command",
			"strip": "OXc72G_strip",
			"headline": "OXc72G_headline"
		};
		//#endregion
		//#region src/client/skeleton/ApprovalPanel.tsx
		/** Extract the shell command from an approval's paired running call (bash-family args carry `command`); undefined hides the line. */
		function commandOf(call) {
			if (call === void 0) return void 0;
			try {
				const args = JSON.parse(call.argsRaw);
				return typeof args.command === "string" ? args.command : void 0;
			} catch {
				return;
			}
		}
		/**
		* Composer takeover boundary: mints the domain face on the carrier's stable
		* identity and remounts the flow per request key, so the one-shot answered
		* latch never leaks to the next pending approval.
		* @param props - the selector-matched pending approval carrier plus the framework standard kit.
		* @returns The approval prompt for this request.
		*/
		function ApprovalPanel(props) {
			const approval = (0, react.useMemo)(() => {
				return new PendingApproval(props.matched);
			}, [props.matched]);
			const command = props.useSession((s) => commandOf(approval.callId === void 0 ? void 0 : s.runningCalls.find((call) => call.callId === approval.callId)));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ApprovalFlow, {
				pending: approval,
				t: props.t,
				...command === void 0 ? {} : { command }
			}, approval.key);
		}
		function ApprovalFlow({ pending, command, t }) {
			const [answered, setAnswered] = (0, react.useState)(false);
			const answer = (outcome) => {
				setAnswered(true);
				pending.answer(outcome).catch(() => {
					setAnswered(false);
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: ApprovalPanel_module_css_default.root,
				"data-approval-key": pending.key,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ApprovalPanel_module_css_default.card,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ApprovalPanel_module_css_default.strip,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: ApprovalPanel_module_css_default.dot }), t("approval.waiting")]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ApprovalPanel_module_css_default.body,
							"data-approval-scroll": "",
							tabIndex: 0,
							role: "group",
							"aria-label": t("approval.detail.aria"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ApprovalPanel_module_css_default.headline,
								children: pending.reason ?? t("approval.escalation", { toolName: pending.toolName })
							}), command !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ApprovalPanel_module_css_default.command,
								children: command
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ApprovalPanel_module_css_default.actionRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								className: ApprovalPanel_module_css_default.reject,
								disabled: answered,
								onClick: () => {
									answer("rejected");
								},
								children: t("approval.reject")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								disabled: answered,
								onClick: () => {
									answer("allowed-once");
								},
								children: t("approval.allowOnce")
							})]
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/toolviews/todo-row.tsx
		function isItem(value) {
			return typeof value === "object" && value !== null;
		}
		function summarize(argsRaw, t) {
			let parsed;
			try {
				parsed = JSON.parse(argsRaw);
			} catch {
				return null;
			}
			if (typeof parsed !== "object" || parsed === null) return null;
			const todos = parsed.todos;
			if (!Array.isArray(todos) || !todos.every(isItem)) return null;
			const done = todos.filter((item) => item.status === "completed").length;
			const active = todos.find((item) => item.status === "in_progress");
			const head = t("todo.completed", {
				done,
				total: todos.length
			});
			return typeof active?.content === "string" && active.content !== "" ? `${head} · ${active.content}` : head;
		}
		/** One-line plan update row (the whole row toggles the call's Input/Output
		*  sections, ToolRow's unified expand). Non-ok execution states keep the
		*  shared row's dot semantics — a cancelled call wrote no todo/write, so it
		*  must not read as a completed update. */
		function TodoRow({ toolName, block, inspect, t }) {
			const model = toolRowModel(toolName, block);
			const summary = summarize(("kind" in block ? block.call?.argsRaw : block.argsRaw) ?? "", t) ?? model.summary;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolRow, {
				t,
				variant: model.variant,
				toolName,
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutline14, {}),
				title: t("todo.rowTitle"),
				summary,
				body: model.body,
				output: model.output,
				errorSummary: model.errorSummary,
				state: model.state,
				inspect
			});
		}
		/**
		* The todo row as a plain registrant plugin following the chat toolview
		* declaration across independent activation and reload lifetimes.
		*/
		const todoToolview = {
			name: "todo-toolview",
			inject: ["slots"],
			/**
			* Register the todo row into the chat view's keyed toolview hole.
			* @param ctx - registrant context (disposal rides ctx.effect inside slots.register).
			*/
			apply(ctx) {
				ctx.slots.inject("conversation.chat.toolview", () => ctx.slots.register({
					name: "conversation.chat.toolview",
					key: "todo_write",
					locale: NS
				}, TodoRow));
			}
		};
		//#endregion
		//#region src/client/toolviews/ask-question-row.tsx
		function isAnswer(value) {
			return typeof value === "object" && value !== null;
		}
		/** Answered-count summary off the result JSON (a skipped question has
		*  empty `selected` and no `custom`); null on unexpected shape (generic fallback). */
		function answeredSummary(text, t) {
			let parsed;
			try {
				parsed = JSON.parse(text);
			} catch {
				return null;
			}
			if (typeof parsed !== "object" || parsed === null) return null;
			const answers = parsed.answers;
			if (!Array.isArray(answers) || !answers.every(isAnswer)) return null;
			const answered = answers.filter((a) => Array.isArray(a.selected) && a.selected.length > 0 || typeof a.custom === "string" && a.custom !== "").length;
			return t("ask.answered", {
				answered,
				total: answers.length
			});
		}
		/** One-line question-interaction row (the whole row toggles the call's
		*  Input/Output sections, ToolRow's unified expand). */
		function AskQuestionRow({ toolName, block, inspect, t }) {
			const model = toolRowModel(toolName, block);
			const code = "kind" in block ? block.error?.code : void 0;
			let summary = model.summary;
			let state = model.state;
			if (code === "ASK_CANCELLED") summary = t("ask.cancelled");
			else if (code === "ASK_ABORTED") {
				summary = t("ask.interrupted");
				state = "stopped";
			} else if (model.state === "running") summary = t("ask.waiting");
			else if ("kind" in block && model.state === "ok") summary = answeredSummary(block.content.filter((b) => b.type === "text").map((b) => b.text).join(""), t) ?? model.summary;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolRow, {
				t,
				variant: model.variant,
				toolName,
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconQuestionOutline14, {}),
				title: t("ask.rowTitle"),
				summary,
				body: model.body,
				output: model.output,
				state,
				inspect
			});
		}
		/**
		* The ask-question row as a plain registrant plugin following the chat
		* toolview declaration across independent activation and reload lifetimes.
		*/
		const askQuestionToolview = {
			name: "ask-question-toolview",
			inject: ["slots"],
			/**
			* Register the ask-question row into the chat view's keyed toolview hole.
			* @param ctx - registrant context (disposal rides ctx.effect inside slots.register).
			*/
			apply(ctx) {
				ctx.slots.inject("conversation.chat.toolview", () => ctx.slots.register({
					name: "conversation.chat.toolview",
					key: "ask_user_question",
					locale: NS
				}, AskQuestionRow));
			}
		};
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/skeleton/TodoPanel.module.css.mjs
		const css$4 = ".yvnwVG_root{box-sizing:border-box;width:calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));max-width:calc(var(--dsh-composer-card-max-width) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-tip);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:12px;flex:none;margin:0 auto;overflow:hidden}.yvnwVG_body{flex-direction:column;gap:8px;padding:6px 12px;display:flex}.yvnwVG_header{text-align:left;cursor:pointer;background:0 0;border:none;align-items:center;gap:10px;width:100%;padding:0;display:flex}.yvnwVG_lead{color:var(--dsw-alias-label-tertiary);flex:none;place-items:center;display:grid}.yvnwVG_title{color:var(--dsw-alias-label-primary);flex:none;font-size:13px;font-weight:500;line-height:24px}.yvnwVG_progress{min-width:0;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:auto;font-size:13px;font-weight:400;line-height:20px;overflow:hidden}.yvnwVG_chevron{color:var(--dsw-alias-label-tertiary);flex:none;place-items:center;display:grid}.yvnwVG_list{flex-direction:column;gap:8px;max-height:180px;margin:0;padding:0;list-style:none;display:flex;overflow-y:auto}.yvnwVG_item{min-width:0;color:var(--dsw-alias-label-secondary);align-items:center;gap:10px;font-size:13px;line-height:20px;display:flex}.yvnwVG_glyph{flex:none;place-items:center;width:16px;height:16px;display:grid}.yvnwVG_glyphCompleted{color:var(--dsw-alias-state-success-primary)}.yvnwVG_glyphPending{color:var(--dsw-alias-label-caption)}.yvnwVG_glyphProgress{color:var(--dsw-alias-state-business-primary);animation:1s linear infinite yvnwVG_todo-progress-spin}@keyframes yvnwVG_todo-progress-spin{to{transform:rotate(360deg)}}.yvnwVG_content{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}";
		const tagId$4 = "@deepseek-ai/dsh-client-ui-conversation/TodoPanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var TodoPanel_module_css_default = {
			"list": "yvnwVG_list",
			"header": "yvnwVG_header",
			"lead": "yvnwVG_lead",
			"chevron": "yvnwVG_chevron",
			"glyphCompleted": "yvnwVG_glyphCompleted",
			"todo-progress-spin": "yvnwVG_todo-progress-spin",
			"glyphPending": "yvnwVG_glyphPending",
			"title": "yvnwVG_title",
			"body": "yvnwVG_body",
			"root": "yvnwVG_root",
			"progress": "yvnwVG_progress",
			"item": "yvnwVG_item",
			"glyph": "yvnwVG_glyph",
			"glyphProgress": "yvnwVG_glyphProgress",
			"content": "yvnwVG_content"
		};
		//#endregion
		//#region src/client/skeleton/TodoPanel.tsx
		/** Local exhaustiveness helper — client packages do not depend on `dsh-llm`. */
		/* v8 ignore next 3 -- closed-union backstop; only reached if status is forged */
		function assertNever(value) {
			throw new Error(`unreachable todo status: ${String(value)}`);
		}
		/** Status glyphs share the figma 14×14 artboard; the 16×16 `.glyph` cell centers them. */
		function CompletedGlyph() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 14 14",
				fill: "none",
				"aria-hidden": "true",
				className: TodoPanel_module_css_default.glyphCompleted,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "7",
					cy: "7",
					r: "6.4",
					stroke: "currentColor",
					strokeWidth: "1.2"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M10.9631 5.71411L7.70154 8.97571C7.48011 9.19714 7.27736 9.40099 7.09229 9.54993C6.89742 9.70669 6.66314 9.85279 6.3634 9.90027C6.2049 9.92534 6.04339 9.92534 5.88489 9.90027C5.58515 9.85279 5.35087 9.70669 5.15601 9.54993C4.97093 9.40099 4.76818 9.19714 4.54675 8.97571L3.03516 7.46411L3.96313 6.53613L5.47473 8.04773C5.7169 8.28989 5.86196 8.43389 5.97888 8.52795C6.08597 8.61409 6.10875 8.60701 6.08997 8.604C6.11259 8.60758 6.13571 8.60758 6.15833 8.604C6.13954 8.60701 6.16232 8.61409 6.26941 8.52795C6.38633 8.43389 6.53139 8.28989 6.77356 8.04773L10.0352 4.78613L10.9631 5.71411Z",
					fill: "currentColor"
				})]
			});
		}
		/** In-progress: business-blue ring fading out; CSS spins the svg. */
		function ProgressGlyph() {
			const gradientId = (0, react.useId)();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 14 14",
				fill: "none",
				"aria-hidden": "true",
				className: TodoPanel_module_css_default.glyphProgress,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("linearGradient", {
					id: gradientId,
					x1: "2.5",
					y1: "12",
					x2: "10.5",
					y2: "3.5",
					gradientUnits: "userSpaceOnUse",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", { stopColor: "currentColor" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
						offset: "1",
						stopColor: "currentColor",
						stopOpacity: "0"
					})]
				}) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "7",
					cy: "7",
					r: "6.4",
					stroke: `url(#${gradientId})`,
					strokeWidth: "1.2"
				})]
			});
		}
		/** Pending: dashed unstarted ring (figma dash 2.4 2.4). */
		function PendingGlyph() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 14 14",
				fill: "none",
				"aria-hidden": "true",
				className: TodoPanel_module_css_default.glyphPending,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "7",
					cy: "7",
					r: "6.4",
					stroke: "currentColor",
					strokeWidth: "1.2",
					strokeDasharray: "2.4 2.4"
				})
			});
		}
		function StatusGlyph({ status }) {
			switch (status) {
				case "completed": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CompletedGlyph, {});
				case "in_progress": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProgressGlyph, {});
				case "pending": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PendingGlyph, {});
				/* v8 ignore next -- closed TodoItem status union */
				default: return assertNever(status);
			}
		}
		/** Header summary: "·"-joined per-status counts; zero-count segments are omitted as noise (a non-empty list keeps at least one). */
		function progressLabel(todos, t) {
			const done = todos.filter((item) => item.status === "completed").length;
			const active = todos.filter((item) => item.status === "in_progress").length;
			const pending = todos.length - done - active;
			return [
				...done > 0 ? [t("todo.progress.done", { done })] : [],
				...active > 0 ? [t("todo.progress.active", { active })] : [],
				...pending > 0 ? [t("todo.progress.pending", { pending })] : []
			].join(" · ");
		}
		function TodoPanel({ todos, t }) {
			const [collapsed, setCollapsed] = (0, react.useState)(true);
			if (todos.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
				className: TodoPanel_module_css_default.root,
				"data-testid": "todo-panel",
				"aria-label": t("todo.title"),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: TodoPanel_module_css_default.body,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: TodoPanel_module_css_default.header,
						"aria-expanded": !collapsed,
						onClick: () => {
							setCollapsed((v) => !v);
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: TodoPanel_module_css_default.lead,
								"aria-hidden": true,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutline14, {})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: TodoPanel_module_css_default.title,
								children: t("todo.title")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: TodoPanel_module_css_default.progress,
								children: progressLabel(todos, t)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: TodoPanel_module_css_default.chevron,
								"aria-hidden": true,
								children: !collapsed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronUpOutline14, {})
							})
						]
					}), !collapsed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: TodoPanel_module_css_default.list,
						children: todos.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							className: TodoPanel_module_css_default.item,
							"data-status": item.status,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: TodoPanel_module_css_default.glyph,
								"aria-hidden": true,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusGlyph, { status: item.status })
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: TodoPanel_module_css_default.content,
								children: item.content
							})]
						}, item.content))
					})]
				})
			});
		}
		/** Dock adapter: reads the host-computed 'todos' projection (whole list; absent or null renders nothing). */
		function TodoDock({ useProjection, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TodoPanel, {
				todos: useProjection("todos") ?? [],
				t
			});
		}
		/**
		* The plan strip as a plain registrant plugin (QueueDock posture), following
		* the input-dock declaration across independent activation and reload.
		*/
		const todoDockEntry = {
			name: "conversation-todo-dock",
			inject: ["slots"],
			/**
			* Register the plan strip before the goal and queue entries (order 0).
			* @param ctx - registrant context (disposal rides ctx.effect inside slots.register).
			*/
			apply(ctx) {
				ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
					name: "conversation.input.dock",
					id: "todo",
					order: 0,
					locale: NS
				}, TodoDock));
			}
		};
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/queue/QueueDock.module.css.mjs
		const css$3 = ".oETF8G_dock{box-sizing:border-box;width:calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));max-width:calc(var(--dsh-composer-card-max-width) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));margin:0 auto calc(0px - var(--dsh-composer-stack-gap) - 3px);padding:0 var(--dsh-composer-dock-inset);flex:none}.oETF8G_panel{background:var(--dsw-specific-tip);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:12px 12px 0 0;width:100%;padding:2px 0;position:relative;overflow:hidden}.oETF8G_panel:after{border:1px solid var(--dsw-alias-border-l1);border-radius:inherit;content:\"\";pointer-events:none;border-bottom:none;position:absolute;inset:0}.oETF8G_header{box-sizing:border-box;width:100%;height:36px;color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;background:0 0;border:none;border-radius:8px;align-items:center;gap:10px;padding:4px 12px;display:flex}.oETF8G_header:focus-visible{outline:2px solid var(--dsw-alias-label-tertiary);outline-offset:-2px}.oETF8G_header:disabled{cursor:default}.oETF8G_lead{color:var(--dsw-alias-label-tertiary);flex:none;place-items:center;display:grid}.oETF8G_count{min-width:0;font-family:Inter, var(--dsw-font-family);flex:auto;font-size:13px;font-weight:500;line-height:24px}.oETF8G_chevron{width:14px;height:14px;color:var(--dsw-alias-label-tertiary);flex:none;place-items:center;display:grid}.oETF8G_list{max-height:180px;margin:0;padding:0;list-style:none;overflow-y:auto}.oETF8G_row{box-sizing:border-box;border-radius:8px;align-items:center;gap:10px;width:100%;height:36px;padding:4px 5px 4px 12px;display:flex}.oETF8G_row+.oETF8G_row{box-shadow:inset 0 1px 0 var(--dsw-alias-border-l1)}.oETF8G_preview,.oETF8G_editor{min-width:0;font:var(--dsw-font-xs-13);font-family:Inter, var(--dsw-font-family);flex:auto}.oETF8G_preview{color:var(--dsw-alias-label-primary-dimmed);text-overflow:ellipsis;white-space:nowrap;word-break:break-word;overflow:hidden}.oETF8G_editor{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);height:28px;color:var(--dsw-alias-label-primary);border-radius:6px;outline:none;padding:0 8px}.oETF8G_editor:focus{border-color:var(--dsw-alias-state-business-primary)}.oETF8G_actions{flex:none;align-items:center;gap:10px;display:flex}.oETF8G_action{width:28px;height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:999px;flex:none;place-items:center;padding:0;display:grid}.oETF8G_action:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.oETF8G_action:focus-visible{outline:2px solid var(--dsw-alias-label-tertiary);outline-offset:-2px}.oETF8G_action:disabled{cursor:default;opacity:.45}";
		const tagId$3 = "@deepseek-ai/dsh-client-ui-conversation/QueueDock.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var QueueDock_module_css_default = {
			"header": "oETF8G_header",
			"count": "oETF8G_count",
			"lead": "oETF8G_lead",
			"panel": "oETF8G_panel",
			"preview": "oETF8G_preview",
			"editor": "oETF8G_editor",
			"row": "oETF8G_row",
			"dock": "oETF8G_dock",
			"action": "oETF8G_action",
			"actions": "oETF8G_actions",
			"chevron": "oETF8G_chevron",
			"list": "oETF8G_list"
		};
		//#endregion
		//#region src/client/queue/QueueDock.tsx
		/**
		* Queue strip: one item renders directly; multiple items default to a
		* collapsible count header; an empty queue renders nothing.
		*/
		function QueueDock({ useSession, updateQueue, notify, t }) {
			const inbox = useSession((s) => s.queue);
			const queue = (0, react.useMemo)(() => inbox.filter((row) => row.placement === "queued"), [inbox]);
			const running = useSession((s) => s.running);
			const queueMutable = useSession((s) => s.subagent === null);
			const [editing, setEditing] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(null);
			const [collapsed, setCollapsed] = (0, react.useState)(true);
			const listId = (0, react.useId)();
			(0, react.useEffect)(() => {
				if (queue.length === 0 && !collapsed) setCollapsed(true);
				if (editing !== null && (!queueMutable || !queue.some((row) => row.id === editing.id))) setEditing(null);
			}, [
				collapsed,
				editing,
				queue,
				queueMutable
			]);
			if (queue.length === 0) return null;
			const interactionActive = queueMutable && (editing !== null || busy !== null);
			const expanded = !collapsed || interactionActive;
			const listVisible = queue.length === 1 || expanded;
			const applyAction = async (itemId, action, failure) => {
				setBusy(itemId);
				try {
					await updateQueue(itemId, action);
					return true;
				} catch {
					notify("error", failure);
					return false;
				} finally {
					setBusy((current) => current === itemId ? null : current);
				}
			};
			const saveEdit = async () => {
				if (editing === null || editing.text.trim() === "") return;
				if (await applyAction(editing.id, {
					kind: "edit",
					content: [{
						type: "text",
						text: editing.text
					}]
				}, t("queue.editFailed"))) setEditing(null);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: QueueDock_module_css_default.dock,
				"data-queue-dock": "",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: QueueDock_module_css_default.panel,
					children: [queue.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: QueueDock_module_css_default.header,
						"aria-controls": listId,
						"aria-expanded": expanded,
						disabled: interactionActive,
						onClick: () => {
							setCollapsed((value) => !value);
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: QueueDock_module_css_default.lead,
								"aria-hidden": true,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconQueueOutline14, {})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: QueueDock_module_css_default.count,
								children: t("queue.count", { n: queue.length })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: QueueDock_module_css_default.chevron,
								"aria-hidden": true,
								children: expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronUpOutline14, {})
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						id: listId,
						className: QueueDock_module_css_default.list,
						hidden: !listVisible,
						children: listVisible && queue.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							className: QueueDock_module_css_default.row,
							children: [
								queue.length === 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: QueueDock_module_css_default.lead,
									"aria-hidden": true,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconQueueOutline14, {})
								}),
								editing?.id === row.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									autoFocus: true,
									className: QueueDock_module_css_default.editor,
									"aria-label": t("queue.edit"),
									value: editing.text,
									onChange: (event) => {
										setEditing({
											id: row.id,
											text: event.currentTarget.value
										});
									},
									onKeyDown: (event) => {
										if (event.key === "Escape") {
											setEditing(null);
											return;
										}
										if (event.key === "Enter" && !event.nativeEvent.isComposing) {
											event.preventDefault();
											saveEdit();
										}
									}
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: QueueDock_module_css_default.preview,
									children: row.preview
								}),
								queueMutable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: QueueDock_module_css_default.actions,
									children: editing?.id === row.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
										label: t("queue.save"),
										side: "bottom",
										delayMs: 500,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: QueueDock_module_css_default.action,
											"aria-label": t("queue.save"),
											disabled: busy !== null || editing.text.trim() === "",
											onClick: () => {
												saveEdit();
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, { size: 14 })
										})
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
										label: t("queue.cancelEdit"),
										side: "bottom",
										delayMs: 500,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: QueueDock_module_css_default.action,
											"aria-label": t("queue.cancelEdit"),
											disabled: busy !== null,
											onClick: () => {
												setEditing(null);
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, { size: 14 })
										})
									})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											label: t("queue.edit"),
											side: "bottom",
											delayMs: 500,
											disabled: row.text === null,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: QueueDock_module_css_default.action,
												"aria-label": t("queue.edit"),
												title: row.text === null ? t("queue.edit.unsupported") : void 0,
												disabled: busy !== null || row.text === null,
												onClick: () => {
													if (row.text !== null) setEditing({
														id: row.id,
														text: row.text
													});
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, { size: 14 })
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											label: t("queue.remove"),
											side: "bottom",
											delayMs: 500,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: QueueDock_module_css_default.action,
												"aria-label": t("queue.remove"),
												disabled: busy !== null,
												onClick: () => {
													applyAction(row.id, { kind: "remove" }, t("queue.removeFailed"));
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutline16, { size: 14 })
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											label: t("queue.steer"),
											side: "bottom",
											delayMs: 500,
											disabled: !running,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: QueueDock_module_css_default.action,
												"aria-label": t("queue.steer"),
												title: running ? void 0 : t("queue.steer.unavailable"),
												disabled: busy !== null || !running,
												onClick: () => {
													applyAction(row.id, { kind: "steer" }, t("queue.steerFailed"));
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSendOutline14, {})
											})
										})
									] })
								})
							]
						}, row.id))
					})]
				})
			});
		}
		/**
		* The dock entry as a plain registrant plugin. The conversation service is
		* the action seam; the slot declaration is its independent lifecycle seam.
		*/
		const queueDockEntry = {
			name: "conversation-queue-dock",
			inject: [
				"slots",
				"conversation",
				"sessions"
			],
			/**
			* Register the queue strip as the terminal input-dock entry (order 20).
			* @param ctx - registrant context (disposal rides ctx.effect inside slots.register).
			*/
			apply(ctx) {
				ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
					name: "conversation.input.dock",
					id: "queue",
					order: 20,
					locale: NS,
					inject: (sessionId) => {
						const actx = ctx.sessions.scope(sessionId);
						if (actx === void 0) throw new Error(`queue dock: session "${sessionId}" resolved no scope`);
						const conversation = actx.get("conversation");
						if (conversation === void 0) throw new Error("queue dock: conversation service unavailable");
						return {
							updateQueue: (itemId, action) => conversation.updateQueue(itemId, action),
							notify: (level, text) => {
								conversation.input.for(actx).notify(level, text);
							}
						};
					}
				}, QueueDock));
			}
		};
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/skeleton/HeroShell.module.css.mjs
		const css$2 = ".SGrnWq_root{justify-content:center;align-items:center;min-width:0;height:100%;padding:0 24px;display:flex}.SGrnWq_stack{width:100%;max-width:var(--dsh-composer-card-max-width);flex-direction:column;align-items:stretch;gap:12px;display:flex;overflow:visible}.SGrnWq_headline{color:var(--dsw-alias-label-primary);grid-template-columns:34px auto;justify-content:center;align-items:center;gap:4px 10px;font-size:26px;font-weight:500;line-height:32px;display:grid}.SGrnWq_headlineText{grid-area:1/2}.SGrnWq_previewBadge{background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-label-primary);white-space:nowrap;border-radius:4px;grid-area:2/2;justify-self:start;padding:0 4px;font-size:12px;font-weight:500;line-height:18px}.SGrnWq_fish{color:var(--dsw-alias-state-business-primary);grid-area:1/1}.SGrnWq_body{flex-direction:column;gap:12px;min-width:0;display:flex;position:relative;overflow:visible}.SGrnWq_body>*{z-index:1;position:relative}.SGrnWq_body>.SGrnWq_workspaceRow{z-index:10;align-items:center;min-width:0;padding-left:8px;display:flex}.SGrnWq_workspace{max-width:min(100%,360px);min-height:28px;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:none;border-radius:12px;align-items:center;gap:4px;padding:0 8px;font-size:13px;font-weight:500;line-height:20px;display:inline-flex}.SGrnWq_workspace:not(:disabled):hover,.SGrnWq_workspace[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover)}.SGrnWq_workspace:disabled{cursor:default}.SGrnWq_folder{color:var(--dsw-alias-label-primary);flex:none}.SGrnWq_workspaceLabel{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.SGrnWq_chevron{color:var(--dsw-alias-label-caption);flex:none}.SGrnWq_modalInput{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);width:100%;height:44px;color:var(--dsw-alias-label-primary);background:0 0;border-radius:22px;outline:none;padding:7px 14px;font-size:14px;font-weight:400;line-height:22px}.SGrnWq_modalInput::placeholder{color:var(--dsw-alias-label-caption)}.SGrnWq_modalInput:disabled{color:var(--dsw-alias-label-dimmed)}.SGrnWq_modalAction{min-width:72px}.SGrnWq_modalError{color:var(--dsw-alias-state-error-primary);margin-top:8px;font-size:12px;line-height:18px}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-conversation/HeroShell.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var HeroShell_module_css_default = {
			"headline": "SGrnWq_headline",
			"modalAction": "SGrnWq_modalAction",
			"modalError": "SGrnWq_modalError",
			"previewBadge": "SGrnWq_previewBadge",
			"workspace": "SGrnWq_workspace",
			"workspaceLabel": "SGrnWq_workspaceLabel",
			"workspaceRow": "SGrnWq_workspaceRow",
			"root": "SGrnWq_root",
			"headlineText": "SGrnWq_headlineText",
			"chevron": "SGrnWq_chevron",
			"modalInput": "SGrnWq_modalInput",
			"fish": "SGrnWq_fish",
			"folder": "SGrnWq_folder",
			"stack": "SGrnWq_stack",
			"body": "SGrnWq_body"
		};
		//#endregion
		//#region src/client/skeleton/EmptyHero.tsx
		/**
		* Basename label for the workspace chip (the shared derivation);
		* separator-only paths echo the raw cwd.
		* @param cwd - workspace directory path (non-empty).
		* @returns chip label.
		*/
		function workspaceLabel(cwd) {
			const base = (0, _deepseek_ai_dsh_client_runtime_client.workspaceTitleOf)(cwd);
			return base === "" ? cwd : base;
		}
		/**
		* The workspace chip (folder + label + chevron), always interactive: before
		* the first message the workspace stays switchable — picking another one
		* moves the New Session flow to that workspace's blank session. Without a
		* label the chip renders its placeholder state: closed folder + the
		* "Choose workspace" call to action.
		* @param props.label - chip label (see {@link workspaceLabel}); omitted → placeholder.
		* @param props.menuOpen - menu expansion echo.
		* @param props.onClick - menu toggle.
		* @returns the chip button element.
		*/
		function WorkspaceChip({ buttonRef, label, menuOpen = false, onClick, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				ref: buttonRef,
				type: "button",
				className: HeroShell_module_css_default.workspace,
				"aria-label": t("hero.chooseWorkspace"),
				"aria-haspopup": "menu",
				"aria-expanded": menuOpen,
				onClick,
				children: [
					label === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderClose16, {
						className: HeroShell_module_css_default.folder,
						size: 16
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpen16, {
						className: HeroShell_module_css_default.folder,
						size: 16
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: HeroShell_module_css_default.workspaceLabel,
						children: label ?? t("hero.chooseWorkspace")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, {
						className: HeroShell_module_css_default.chevron,
						size: 12
					})
				]
			});
		}
		/**
		* The soft blue backdrop ellipse (figma 313:14109). Rendered by the hero
		* owner (ConversationRoot), not HeroShell, so it can center on the input
		* card; the owner's className supplies all positioning.
		* @param props.className - positioning class from the owner.
		* @returns the blurred-ellipse svg element.
		*/
		function HeroGlow({ className }) {
			const glowFilterId = `empty-glow-${(0, react.useId)().replace(/:/g, "")}`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className,
				viewBox: "0 0 1051 468",
				fill: "none",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("filter", {
					id: glowFilterId,
					x: "0",
					y: "0",
					width: "1051",
					height: "468",
					filterUnits: "userSpaceOnUse",
					colorInterpolationFilters: "sRGB",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("feFlood", {
							floodOpacity: "0",
							result: "BackgroundImageFix"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("feBlend", {
							mode: "normal",
							in: "SourceGraphic",
							in2: "BackgroundImageFix",
							result: "shape"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("feGaussianBlur", {
							stdDeviation: "50",
							result: "effect1_foregroundBlur"
						})
					]
				}) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
					filter: `url(#${glowFilterId})`,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ellipse", {
						cx: "525.5",
						cy: "234",
						rx: "425.5",
						ry: "134",
						fill: "#6187D8",
						fillOpacity: "0.08"
					})
				})]
			});
		}
		/**
		* Render the hero chrome (headline only; no glow, no composer, no workspace
		* row — the glow is the owner's {@link HeroGlow}).
		* @param props - see {@link HeroShellProps}.
		* @returns the centered hero element tree.
		*/
		function HeroShell({ t, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: HeroShell_module_css_default.root,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: HeroShell_module_css_default.stack,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: HeroShell_module_css_default.headline,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FishLogo, {
								size: 34,
								className: HeroShell_module_css_default.fish
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: HeroShell_module_css_default.headlineText,
								children: t("hero.headline")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: HeroShell_module_css_default.previewBadge,
								children: t("hero.preview")
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: HeroShell_module_css_default.body })]
				}), children]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css.mjs
		const css$1 = ".HjBPGW_root{background:var(--dsw-alias-bg-base);--dsh-chat-content-width:748px;--dsh-composer-card-max-width:calc(var(--dsh-chat-content-width) + 32px);--dsh-composer-side-clearance:16px;--dsh-composer-dock-inset:8px;flex-direction:column;min-width:0;height:100%;display:flex}.HjBPGW_header{border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;padding:12px 28px 0 20px}.HjBPGW_headerHidden{display:none}.HjBPGW_titleRow{align-items:center;gap:10px;min-height:32px;display:flex}.HjBPGW_crumbs{white-space:nowrap;align-items:center;gap:4px;min-width:0;display:flex;overflow:hidden}.HjBPGW_crumbSeg{align-items:center;gap:4px;min-width:0;display:inline-flex}.HjBPGW_crumbSep{color:var(--dsw-alias-label-caption);font-size:14px;line-height:20px}.HjBPGW_crumb{max-width:220px;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;cursor:pointer;background:0 0;border:none;border-radius:12px;padding:4px 8px;font-size:14px;line-height:20px;overflow:hidden}.HjBPGW_crumb:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.HjBPGW_crumbCurrent{color:var(--dsw-alias-label-primary);cursor:default;font-weight:500}.HjBPGW_headerActions{flex:none;align-items:center;gap:8px;display:flex}.HjBPGW_tabs{gap:36px;margin-top:4px;padding-left:8px;display:flex}.HjBPGW_tab{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;padding:0 0 11px;font-size:13px;font-weight:500;line-height:16px;position:relative}.HjBPGW_tab:after{content:\"\";background:0 0;height:3px;position:absolute;bottom:0;left:0;right:0}.HjBPGW_tabActive{color:var(--dsw-alias-state-business-primary)}.HjBPGW_tabActive:after{background:var(--dsw-alias-state-business-primary)}.HjBPGW_viewArea{flex-direction:column;flex:1;min-height:0;display:flex}.HjBPGW_composerStack{--dsh-composer-stack-gap:6px;gap:var(--dsh-composer-stack-gap);flex-direction:column;display:flex}.HjBPGW_composerSeat{--dsh-composer-text-max-height:336px;flex-direction:column;flex:none;display:flex}.HjBPGW_root[data-phase=active]{overflow:hidden}.HjBPGW_root[data-phase=active] .HjBPGW_header{flex:none}.HjBPGW_scrollBody{scrollbar-gutter:stable;flex-direction:column;flex:1;min-height:0;display:flex;overflow-y:auto}.HjBPGW_root[data-phase=active] .HjBPGW_viewArea{flex:1 0 auto;min-height:auto}.HjBPGW_root[data-phase=active] .HjBPGW_composerSeat{z-index:7;background:linear-gradient(180deg, color-mix(in srgb, var(--dsw-alias-bg-base) 0%, transparent) 0px, var(--dsw-alias-bg-base) 36px);position:sticky;bottom:0}.HjBPGW_scrollBody:has([data-conversation-composer-overlay]){position:relative;overflow:hidden auto}.HjBPGW_scrollBody:has([data-conversation-composer-overlay])>.HjBPGW_viewArea{flex:1 1 0;min-height:0;overflow:hidden}.HjBPGW_scrollBody:has([data-conversation-composer-overlay])>.HjBPGW_composerSeat{position:absolute;bottom:0;left:0;right:0}.HjBPGW_composerHero{width:min(calc(var(--dsh-composer-card-max-width) + 2 * var(--dsh-composer-side-clearance)), 100%);z-index:1;align-self:center;gap:12px;padding-bottom:32px;position:relative}.HjBPGW_heroGlow{z-index:-1;aspect-ratio:1051/468;pointer-events:none;width:135.438%;position:absolute;bottom:92px;left:50%;transform:translate(-50%,50%)}.HjBPGW_heroWorkspaceRow{align-items:center;min-width:0;padding-left:20px;display:flex}.HjBPGW_root[data-phase=hero] .HjBPGW_scrollBody{justify-content:center;overflow-y:auto}.HjBPGW_root[data-phase=settling] .HjBPGW_composerSeat{visibility:hidden}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-conversation/ConversationRoot.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var ConversationRoot_module_css_default = {
			"header": "HjBPGW_header",
			"headerHidden": "HjBPGW_headerHidden",
			"composerStack": "HjBPGW_composerStack",
			"heroGlow": "HjBPGW_heroGlow",
			"headerActions": "HjBPGW_headerActions",
			"crumbSeg": "HjBPGW_crumbSeg",
			"tabActive": "HjBPGW_tabActive",
			"crumb": "HjBPGW_crumb",
			"heroWorkspaceRow": "HjBPGW_heroWorkspaceRow",
			"composerHero": "HjBPGW_composerHero",
			"tab": "HjBPGW_tab",
			"viewArea": "HjBPGW_viewArea",
			"crumbSep": "HjBPGW_crumbSep",
			"tabs": "HjBPGW_tabs",
			"crumbCurrent": "HjBPGW_crumbCurrent",
			"crumbs": "HjBPGW_crumbs",
			"scrollBody": "HjBPGW_scrollBody",
			"titleRow": "HjBPGW_titleRow",
			"composerSeat": "HjBPGW_composerSeat",
			"root": "HjBPGW_root"
		};
		//#endregion
		//#region src/client/skeleton/ConversationRoot.tsx
		function ConversationRoot({ sessionId, useSession, useSessions, useWorkspaces, useInput, renderSlot, renderSlotChain, selectWorkspace, t }) {
			const openState = useSession((s) => s.openState);
			const composerPhase = useSession((s) => s.composerPhase);
			const pending = useSession((s) => s.pending) ?? [];
			const session = useSession((s) => s);
			const inputState = useInput((s) => s);
			const cwd = useSessions((s) => sessionId === void 0 ? void 0 : s.byId[sessionId]?.cwd);
			const summaryBlank = useSessions((s) => sessionId === void 0 ? void 0 : s.byId[sessionId]?.blank);
			const workspaces = useWorkspaces((s) => s);
			const [pickerOpen, setPickerOpen] = (0, react.useState)(false);
			const [pendingWorkspaceId, setPendingWorkspaceId] = (0, react.useState)();
			const pickerAnchor = (0, react.useRef)(null);
			const seatObserver = (0, react.useRef)(null);
			const seatResizeRef = (0, react.useCallback)((seat) => {
				seatObserver.current?.disconnect();
				seatObserver.current = null;
				const scroller = seat?.parentElement ?? null;
				if (seat === null || scroller === null) return;
				seatObserver.current = new ResizeObserver(() => {
					scroller.style.setProperty("--dsh-composer-height", `${seat.offsetHeight}px`);
				});
				seatObserver.current.observe(seat);
			}, []);
			const sessionWorkspace = sessionId === void 0 ? void 0 : workspaces.items.find((workspace) => workspace.sessionIds.includes(sessionId));
			const pendingWorkspace = workspaces.items.find((workspace) => workspace.workspaceId === pendingWorkspaceId);
			(0, react.useEffect)(() => {
				if (pendingWorkspaceId === void 0) return;
				if (sessionWorkspace?.workspaceId === pendingWorkspaceId || workspaces.phase === "ready" && pendingWorkspace === void 0) setPendingWorkspaceId(void 0);
			}, [
				pendingWorkspaceId,
				sessionWorkspace?.workspaceId,
				workspaces.phase,
				pendingWorkspace
			]);
			const settling = sessionId !== void 0 && composerPhase === "blank" && openState === "loading" && summaryBlank !== true;
			const hero = sessionId === void 0 || composerPhase === "blank" && (openState === "open" || summaryBlank === true);
			const zone = session === void 0 || inputState === void 0 ? void 0 : {
				session,
				input: inputState
			};
			const chipTitle = pendingWorkspace?.title ?? (sessionId === void 0 ? void 0 : sessionWorkspace?.title ?? (workspaces.phase === "ready" || cwd === void 0 || cwd === "" ? void 0 : workspaceLabel(cwd)));
			const heroWorkspaceRow = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ConversationRoot_module_css_default.heroWorkspaceRow,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceChip, {
					buttonRef: pickerAnchor,
					label: chipTitle,
					menuOpen: pickerOpen,
					onClick: () => {
						setPickerOpen((open) => !open);
					},
					t
				}), renderSlot("conversation.hero.workspace", {
					open: pickerOpen,
					anchorRef: pickerAnchor,
					selectedId: pendingWorkspaceId ?? sessionWorkspace?.workspaceId,
					onPick: (workspaceId) => {
						setPickerOpen(false);
						setPendingWorkspaceId(workspaceId);
						selectWorkspace(workspaceId).catch(() => {
							setPendingWorkspaceId((current) => current === workspaceId ? void 0 : current);
						});
					},
					onClose: () => {
						setPickerOpen(false);
					}
				})]
			});
			const inputBar = renderSlot("conversation.composer.bar", {
				variant: hero ? "hero" : "composer",
				...sessionId === void 0 || hero && chipTitle === void 0 ? {
					disabled: true,
					placeholder: t("placeholder.workspace")
				} : hero ? { placeholder: t("placeholder.hero") } : {},
				overlay: renderSlot("conversation.input.overlay", {}),
				leftItems: zone === void 0 ? null : renderSlot("conversation.input.left", zone),
				rightItems: zone === void 0 ? null : renderSlot("conversation.input.right", zone),
				footer: !hero && zone !== void 0 ? renderSlot("conversation.composer.dock", zone) : null
			});
			const composerBar = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(ConversationRoot_module_css_default.composerStack, hero && ConversationRoot_module_css_default.composerHero),
				children: [
					hero && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HeroGlow, { className: ConversationRoot_module_css_default.heroGlow }),
					hero && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HeroShell, { t }),
					hero && heroWorkspaceRow,
					zone !== void 0 && renderSlot("conversation.input.dock", zone),
					inputBar
				]
			});
			const phase = settling ? "settling" : hero ? "hero" : "active";
			const composer = renderSlotChain("conversation.composer", {
				interactions: pending,
				session
			}, {
				fallback: composerBar,
				overlay: true
			});
			const composerSeat = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: seatResizeRef,
				className: ConversationRoot_module_css_default.composerSeat,
				"data-composer-seat": "",
				children: composer
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ConversationRoot_module_css_default.root,
				"data-phase": phase,
				children: [renderSlot("conversation.session.header", {}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ConversationRoot_module_css_default.scrollBody,
					"data-conversation-scroll": "",
					children: [renderSlot("conversation.session", {}), composerSeat]
				})]
			});
		}
		//#endregion
		//#region src/client/skeleton/ConversationSession.tsx
		/** Strict per-session header/body content inserted into the resident conversation layout. */
		function deriveAncestry(list, id) {
			const chain = [];
			const seen = /* @__PURE__ */ new Set();
			let cursor = id;
			while (cursor !== void 0) {
				if (seen.has(cursor)) break;
				seen.add(cursor);
				const summary = list.byId[cursor];
				if (summary === void 0) break;
				chain.unshift({
					id: summary.id,
					displayTitle: summary.displayTitle
				});
				if (summary.origin !== "subagent") break;
				cursor = summary.parentId;
			}
			return chain;
		}
		function equalBreadcrumbs(left, right) {
			return left.length === right.length && left.every((item, index) => {
				const other = right.at(index);
				return other !== void 0 && item.id === other.id && item.displayTitle === other.displayTitle;
			});
		}
		/**
		* Renders Session header chrome above the resident conversation scrollport.
		* @param props - Strict Session store, view ledger, navigation, render, and locale shares.
		* @returns the hidden blank-session header or visible title and tabs.
		*/
		function ConversationSessionHeader({ sessionId, useSession, useSessions, useStore, actions, renderSlot, views, open, t }) {
			(0, react.useSyncExternalStore)(views.subscribe, views.version);
			const tabs = views.list();
			const activeId = useStore((s) => s.view) ?? "chat";
			const active = tabs.find((view) => view.id === activeId) ?? tabs[0];
			const ancestry = useSessions((s) => deriveAncestry(s, sessionId), equalBreadcrumbs);
			const composerPhase = useSession((s) => s.composerPhase);
			const hideChrome = useSession((s) => s.blank) && composerPhase === "blank";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("header", {
				className: clsx(ConversationRoot_module_css_default.header, hideChrome && ConversationRoot_module_css_default.headerHidden),
				"aria-hidden": hideChrome || void 0,
				children: !hideChrome && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ConversationRoot_module_css_default.titleRow,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("nav", {
						className: ConversationRoot_module_css_default.crumbs,
						"aria-label": t("session.hierarchy"),
						children: [ancestry.map((summary, index) => {
							const last = index === ancestry.length - 1;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: ConversationRoot_module_css_default.crumbSeg,
								children: [index > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ConversationRoot_module_css_default.crumbSep,
									children: "/"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: clsx(ConversationRoot_module_css_default.crumb, last && ConversationRoot_module_css_default.crumbCurrent),
									disabled: last,
									onClick: () => {
										open(summary.id);
									},
									children: summary.displayTitle
								})]
							}, summary.id);
						}), ancestry.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ConversationRoot_module_css_default.crumbCurrent,
							children: sessionId
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ConversationRoot_module_css_default.headerActions,
						children: renderSlot("conversation.session.header.actions", {})
					})]
				}), tabs.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: ConversationRoot_module_css_default.tabs,
					role: "tablist",
					children: tabs.map((viewTab) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						role: "tab",
						"aria-selected": viewTab.id === active?.id,
						className: clsx(ConversationRoot_module_css_default.tab, viewTab.id === active?.id && ConversationRoot_module_css_default.tabActive),
						onClick: () => {
							actions.setView(viewTab.id);
						},
						children: viewTab.label
					}, viewTab.id))
				})] })
			});
		}
		/**
		* Renders the active Session view inside the resident scrollport and keeps
		* the input draft mirrored while blank Hero chrome is visible.
		* @param props - Strict Session input/store, view ledger, and render shares.
		* @returns the active view area, or null while the Session remains blank.
		*/
		function ConversationSession({ useSession, useInput, inputActions, useStore, actions, renderSlot, views, bindDraftMirror }) {
			(0, react.useSyncExternalStore)(views.subscribe, views.version);
			const tabs = views.list();
			const activeId = useStore((s) => s.view) ?? "chat";
			const active = tabs.find((view) => view.id === activeId) ?? tabs[0];
			const composerPhase = useSession((s) => s.composerPhase);
			const blank = useSession((s) => s.blank);
			const inputState = useInput((s) => s);
			const storedDraft = useStore((s) => s.draft);
			const inspect = useStore((s) => s.inspect ?? null);
			(0, react.useEffect)(() => {
				if (inputState.draft === "" && storedDraft !== "") inputActions.setDraft(storedDraft);
				const unmirror = bindDraftMirror(actions.setDraft);
				return () => {
					unmirror();
				};
			}, [inputActions]);
			if (blank && composerPhase === "blank") return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: ConversationRoot_module_css_default.viewArea,
				children: active !== void 0 && renderSlot("conversation.view", {
					inspect,
					onInspectDone: () => {
						actions.setInspect(null);
					}
				}, { only: active.id })
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-conversation/src/client/skeleton/DetailsPanel.module.css.mjs
		const css = ".uYy3aW_root{border-left:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);flex-direction:column;min-width:0;height:100%;display:flex}.uYy3aW_header{border-bottom:1px solid var(--dsw-alias-border-l2);justify-content:space-between;align-items:center;gap:8px;padding:14px 12px 12px;display:flex}.uYy3aW_title{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:500;line-height:20px;overflow:hidden}.uYy3aW_close{width:28px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:999px;flex:none;place-items:center;display:grid}.uYy3aW_close:hover{background:var(--dsw-alias-interactive-bg-hover)}.uYy3aW_body{flex:1;min-height:0;padding:12px 16px;overflow-y:auto}.uYy3aW_empty{color:var(--dsw-alias-label-tertiary);padding:8px 0;font-size:13px;line-height:20px}.uYy3aW_section{margin-bottom:16px}.uYy3aW_sectionLabel{color:var(--dsw-alias-label-secondary);margin-bottom:6px;font-size:12px;font-weight:500;line-height:18px}.uYy3aW_code{background:var(--dsw-alias-markdown-code-block);font-family:var(--ds-font-family-code);color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;border-radius:12px;margin:0;padding:16px;font-size:13px;line-height:22px}.uYy3aW_code[data-error]{color:var(--dsw-alias-state-error-primary)}.uYy3aW_terminalDescription{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13);margin:0 0 6px}.uYy3aW_cardBody{margin:0}.uYy3aW_searchRecovery{white-space:pre-wrap;overflow-wrap:anywhere;color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xs-13);margin:6px 0 0}.uYy3aW_read,.uYy3aW_web{margin:0}";
		const tagId = "@deepseek-ai/dsh-client-ui-conversation/DetailsPanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var DetailsPanel_module_css_default = {
			"sectionLabel": "uYy3aW_sectionLabel",
			"cardBody": "uYy3aW_cardBody",
			"web": "uYy3aW_web",
			"root": "uYy3aW_root",
			"body": "uYy3aW_body",
			"terminalDescription": "uYy3aW_terminalDescription",
			"title": "uYy3aW_title",
			"close": "uYy3aW_close",
			"header": "uYy3aW_header",
			"section": "uYy3aW_section",
			"code": "uYy3aW_code",
			"empty": "uYy3aW_empty",
			"searchRecovery": "uYy3aW_searchRecovery",
			"read": "uYy3aW_read"
		};
		//#endregion
		//#region src/client/skeleton/DetailsPanel.tsx
		/** Material of a settled result node (native call or run_code sub-dispatch). */
		function settledMaterial(node, callId) {
			return {
				name: node.call?.name ?? callId,
				argsRaw: node.call?.argsRaw ?? null,
				block: node
			};
		}
		/** Material of an in-flight call (native call or run_code sub-dispatch). */
		function runningMaterial(call) {
			return {
				name: call.name,
				argsRaw: call.argsRaw,
				block: call
			};
		}
		function materialFor(s, callId) {
			for (const node of s.nodes) if (node.kind === "tool-result" && node.callId === callId) return settledMaterial(node, callId);
			const open = s.runningCalls.find((c) => c.callId === callId);
			if (open !== void 0) return runningMaterial(open);
			for (const subs of s.codeDispatches.values()) for (const sub of subs) {
				if (sub.callId !== callId) continue;
				return "kind" in sub ? settledMaterial(sub, callId) : runningMaterial(sub);
			}
			return null;
		}
		function pretty(raw) {
			try {
				return JSON.stringify(JSON.parse(raw), null, 2);
			} catch {
				return raw;
			}
		}
		function DetailsPanel({ useSession, useSessions, sessionId, useStore, closeDetails, renderSlot, t }) {
			const selection = useStore((s) => s.selection);
			const sessionCwd = useSessions((list) => list.byId[sessionId]?.cwd);
			const callId = selection?.callId;
			const material = useSession((s) => callId === void 0 ? null : materialFor(s, callId), (a, b) => {
				return (0, _deepseek_ai_dsh_client_runtime_client.shallowEqual)(a, b);
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: DetailsPanel_module_css_default.root,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: DetailsPanel_module_css_default.header,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: DetailsPanel_module_css_default.title,
						children: selection === null ? t("details.title") : material?.name ?? selection.toolName ?? t("details.title")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: DetailsPanel_module_css_default.close,
						"aria-label": t("details.close"),
						onClick: () => {
							closeDetails();
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							viewBox: "0 0 16 16",
							width: "14",
							height: "14",
							"aria-hidden": true,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
								d: "M4 4l8 8M12 4l-8 8",
								stroke: "currentColor",
								strokeWidth: "1.5",
								strokeLinecap: "round"
							})
						})
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: DetailsPanel_module_css_default.body,
					children: selection === null || callId === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: DetailsPanel_module_css_default.empty,
						children: t("details.empty")
					}) : material === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: DetailsPanel_module_css_default.empty,
						children: t("details.notInWindow")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [material.argsRaw !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: DetailsPanel_module_css_default.section,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: DetailsPanel_module_css_default.sectionLabel,
							children: t("details.input")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.CodeBlock, {
							code: pretty(material.argsRaw),
							lang: "json",
							copyLabel: t("copy"),
							copiedLabel: t("copied")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: DetailsPanel_module_css_default.section,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: DetailsPanel_module_css_default.sectionLabel,
							children: t("details.output")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OutputBody, {
							material,
							cwd: sessionCwd,
							t,
							renderSlot,
							callId
						}, callId)]
					})] })
				})]
			});
		}
		/**
		* The Output section's body for the selected call. A terminal-card call — a
		* shell command's call/result views — renders through the shared TerminalBlock
		* at the primitive's own full height allowance, so column-aligned output keeps
		* its alignment and scrolls sideways instead of folding. A read-card call
		* renders through the shared ReadBlock at that same full height, so the whole
		* returned window is line-numbered and highlighted. A diff-card call — a
		* write/edit's applied change — renders through the shared DiffBlock at the same
		* full height. A search-card call — a `grep`/`glob` result view — renders
		* through the shared SearchBlock at the same full height allowance, with a
		* capped search's recovery footer below it. A web-card call — a
		* `web_search`/`web_fetch` result — renders through WebBlock at its own full
		* source-list allowance. Every other call, and a running call with no card yet,
		* keeps the flattened text form.
		* @param props.material - the selected call's material from {@link materialFor}.
		* @param props.cwd - the session workspace root, resolving the terminal view's cwd.
		* @param props.t - the panel's locale seat, passed down as a plain prop.
		* @returns the Output section's body element.
		*/
		function OutputBody({ material, cwd, t, renderSlot, callId }) {
			const terminal = terminalCardModel(material.block, cwd);
			if (terminal !== null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [terminal.description !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: DetailsPanel_module_css_default.terminalDescription,
				children: terminal.description
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TerminalBlock, {
				...terminal.card,
				labels: terminalBlockLabels(t),
				className: DetailsPanel_module_css_default.cardBody
			})] });
			const read = readCardModel(material.block, cwd);
			if (read !== null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.ReadBlock, {
				...read,
				className: DetailsPanel_module_css_default.read
			});
			const diff = diffCardModel(material.block);
			if (diff !== null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DiffBlock, {
				...diff.card,
				className: DetailsPanel_module_css_default.cardBody
			});
			const search = searchCardModel(material.block);
			if (search !== null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SearchBlock, {
				...search.card,
				className: DetailsPanel_module_css_default.cardBody
			}), search.recovery !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: DetailsPanel_module_css_default.searchRecovery,
				children: search.recovery
			})] });
			const web = webCardModel(material.block);
			if (web !== null) {
				const settled = "kind" in material.block ? material.block : null;
				const body = settled === null ? "" : resultText(settled);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.WebBlock, {
					...web,
					className: DetailsPanel_module_css_default.web
				}), body !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
					className: DetailsPanel_module_css_default.code,
					children: body
				})] });
			}
			if (!("kind" in material.block)) {
				const toolName = material.block.name;
				return renderSlot("conversation.details.toolview", {
					callId,
					toolName,
					block: material.block
				}, {
					entryKey: toolName,
					fallback: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: DetailsPanel_module_css_default.empty,
						children: t("details.running")
					})
				});
			}
			const result = material.block;
			const toolName = result.call?.name;
			const flattened = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
				className: DetailsPanel_module_css_default.code,
				"data-error": result.isError || void 0,
				children: resultText(result)
			});
			if (toolName === void 0) return flattened;
			return renderSlot("conversation.details.toolview", {
				callId,
				toolName,
				block: result
			}, {
				entryKey: toolName,
				fallback: flattened
			});
		}
		//#endregion
		//#region src/client/apply.ts
		/** Services required by the conversation plugin. */
		const inject = [
			"slots",
			"layout",
			"sessions",
			"workspaces",
			"locale"
		];
		const ABSENT_NOTICES = {
			getSnapshot: () => null,
			subscribe: () => () => {}
		};
		const EMPTY_LEXICON = /* @__PURE__ */ new Map();
		const ABSENT_LEXICON = {
			getSnapshot: () => EMPTY_LEXICON,
			subscribe: () => () => {}
		};
		const ABSENT_MENU_LAUNCHER = {
			getSnapshot: () => null,
			subscribe: () => () => {}
		};
		/** Resolve the session-scoped conversation face (scope-addressed send/cancel), failing loud. */
		function scopedConversation(sessions, id) {
			const scoped = sessions.scope(id);
			if (scoped === void 0) throw new Error(`ui-conversation: session "${id}" resolved no scope`);
			const conversation = scoped.get("conversation");
			if (conversation === void 0) throw new Error("ui-conversation: conversation service unavailable through the session scope");
			return conversation;
		}
		/** Chain routing: claim the composer while an approval wait is pending (pure — owner props only). */
		function selectApproval({ interactions }) {
			return interactions.find((i) => i.kind === "approval") ?? null;
		}
		/** Mounts the conversation plugin.
		* @param ctx - Client root context.
		*/
		function apply(ctx) {
			const sessions = ctx.sessions;
			const workspaces = ctx.workspaces;
			const layout = ctx.layout;
			const slots = ctx.slots;
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-conversation: dictionaries");
			const t = ctx.locale.bind(NS);
			const chatStore = createChatStore();
			const submissionPolicy = new ComposerSubmissionPolicy();
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "composer-enter",
				order: 20,
				locale: NS,
				inject: () => ({
					hooks: { busyEnter: submissionPolicy.busyEnter },
					setBusyEnter: (behavior) => {
						submissionPolicy.setBusyEnter(behavior);
					}
				})
			}, EnterBehaviorRow));
			const chatScrollPositions = /* @__PURE__ */ new Map();
			const viewTabs = () => {
				const tabs = [];
				for (const entry of slots.entries("conversation.view")) {
					/* v8 ignore next -- unreachable: list registration validates id at load. */
					if (entry.options.id === void 0) continue;
					tabs.push({
						id: entry.options.id,
						label: (0, _deepseek_ai_dsh_client_ui_slots.resolveSlotLabel)(entry.options.label) ?? entry.options.id
					});
				}
				return tabs;
			};
			const views = {
				list: viewTabs,
				subscribe: (fn) => slots.subscribe("conversation.view", fn),
				version: () => slots.getVersion("conversation.view")
			};
			const inputHub = new InputHub(ctx);
			ctx.effect(() => sessions.provide({
				hooks: ["input"],
				props: ["inputActions"],
				resolve: (binding) => {
					const shell = inputHub.shellFor(binding);
					return {
						hooks: { input: shell.state },
						props: { inputActions: shell.actions }
					};
				}
			}), "ui-conversation: input standard-kit provider");
			slots.register({
				name: "conversation",
				locale: NS,
				children: {
					"conversation.session": {
						kind: "single",
						scope: "session"
					},
					"conversation.session.header": {
						kind: "single",
						scope: "session"
					},
					"conversation.composer": {
						kind: "chain",
						scope: "session"
					},
					"conversation.composer.bar": {
						kind: "single",
						scope: "session-maybe"
					},
					"conversation.input.overlay": {
						kind: "list",
						scope: "session"
					},
					"conversation.input.dock": {
						kind: "list",
						scope: "session"
					},
					"conversation.composer.dock": {
						kind: "list",
						scope: "session"
					},
					"conversation.input.left": {
						kind: "list",
						scope: "session"
					},
					"conversation.input.right": {
						kind: "list",
						scope: "session"
					},
					"conversation.hero.workspace": {
						kind: "single",
						scope: "root"
					}
				},
				inject: (sessionId) => ({ selectWorkspace: async (workspaceId) => {
					const nextId = await workspaces.connectWorkspace(workspaceId);
					if (sessionId !== void 0 && nextId !== sessionId) {
						const from = inputHub.shell(sessionId);
						const draft = from.snapshot.draft;
						if (draft !== "") {
							inputHub.shell(nextId).setDraft(draft);
							from.setDraft("");
						}
					}
					sessions.open(nextId);
				} })
			}, ConversationRoot);
			slots.register({
				name: "conversation.session",
				children: { "conversation.view": {
					kind: "list",
					scope: "session"
				} },
				store: chatStore,
				inject: (sessionId, _actions) => ({
					views,
					bindDraftMirror: (write) => inputHub.shell(sessionId).bindMirror(write)
				})
			}, ConversationSession);
			slots.register({
				name: "conversation.session.header",
				locale: NS,
				children: { "conversation.session.header.actions": {
					kind: "list",
					scope: "session"
				} },
				store: chatStore,
				inject: () => ({
					views,
					open: (id) => {
						sessions.open(id);
					}
				})
			}, ConversationSessionHeader);
			slots.register({
				name: "conversation.composer.bar",
				locale: NS,
				children: {
					"conversation.input.plan": {
						kind: "single",
						scope: "session"
					},
					"conversation.input.model": {
						kind: "single",
						scope: "session"
					}
				},
				inject: (sessionId) => {
					if (sessionId === void 0) return {
						keyboard: void 0,
						resolveSubmitMode: (running, gesture, steeringAvailable) => submissionPolicy.resolve(running, gesture, steeringAvailable),
						toggleCommandMenu: void 0,
						stop: void 0,
						command: void 0,
						hooks: {
							notices: ABSENT_NOTICES,
							lexicon: ABSENT_LEXICON,
							menuLauncher: ABSENT_MENU_LAUNCHER
						}
					};
					const shell = inputHub.shell(sessionId);
					const slash = inputHub.slash(sessionId);
					return {
						keyboard: shell,
						resolveSubmitMode: (running, gesture, steeringAvailable) => submissionPolicy.resolve(running, gesture, steeringAvailable),
						toggleCommandMenu: slash === void 0 ? void 0 : (selection) => {
							shell.dismissPopup();
							const snapshot = shell.snapshot;
							slash.toggleSource("command", {
								trigger: "/",
								query: "",
								position: snapshot.draft.slice(0, selection.start).trim() === "" ? "leading" : "inline",
								span: {
									...selection,
									draftRev: snapshot.draftRev
								}
							});
						},
						stop: () => {
							scopedConversation(sessions, sessionId).cancel().catch(() => {});
						},
						command: async (line) => {
							const session = sessions.binding(sessionId)?.session;
							if (session === void 0) return false;
							const result = await session.command(line);
							return result.ok && result.value.matched;
						},
						hooks: {
							notices: shell.notices,
							lexicon: shell.lexicon,
							menuLauncher: slash?.launcher ?? ABSENT_MENU_LAUNCHER
						}
					};
				}
			}, InputBar);
			slots.register({
				name: "conversation.composer",
				select: selectApproval,
				priority: 1,
				locale: NS
			}, ApprovalPanel);
			slots.register({
				name: "conversation.view",
				id: "chat",
				order: 0,
				label: () => t("view.chat"),
				locale: NS,
				children: {
					"conversation.chat.toolview": {
						kind: "keyed",
						scope: "session"
					},
					"conversation.chat.commandview": {
						kind: "keyed",
						scope: "session"
					}
				},
				store: chatStore,
				inject: (sessionId, actions) => {
					const scoped = scopedConversation(sessions, sessionId);
					return {
						openDetails: (target) => {
							actions.select(target);
							layout.openDetails();
						},
						closeDetails: () => {
							actions.select(null);
							layout.closeDetails();
						},
						openFile: (path) => {
							const cwd = sessions.list.getSnapshot().byId[sessionId]?.cwd;
							workspaces.openPath(resolveToolPath(cwd, path)).catch(() => {});
						},
						loadOlder: () => {
							scoped.loadOlder();
						},
						inspectCall: (callId) => {
							actions.setInspect({ callId });
							actions.setView("trajectory");
						},
						chatScroll: {
							save: (position) => {
								if (position === null) chatScrollPositions.delete(sessionId);
								else chatScrollPositions.set(sessionId, position);
							},
							read: () => chatScrollPositions.get(sessionId) ?? null
						},
						forkAt: (seq) => {
							sessions.fork({
								sessionId,
								atSeq: seq,
								increaseTitle: true
							}).then((childId) => {
								sessions.open(childId);
							}).catch(() => {});
						}
					};
				}
			}, ChatView);
			slots.register({
				name: "conversation.composer.dock",
				id: "stats",
				order: 0,
				locale: NS
			}, StatsLine);
			ctx.plugin(ConversationService, { input: inputHub });
			ctx.plugin(bashToolviewSample);
			ctx.plugin(readToolview);
			ctx.plugin(fileMutationToolview);
			ctx.plugin(searchToolview);
			ctx.plugin(webToolview);
			ctx.plugin(todoToolview);
			ctx.plugin(askQuestionToolview);
			ctx.plugin(todoDockEntry);
			ctx.plugin(queueDockEntry);
			slots.register({
				name: "details",
				locale: NS,
				store: chatStore,
				children: { "conversation.details.toolview": {
					kind: "keyed",
					scope: "session"
				} },
				inject: () => ({ closeDetails: () => {
					layout.closeDetails();
				} })
			}, DetailsPanel);
		}
		//#endregion
		exports.ConversationService = ConversationService;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map