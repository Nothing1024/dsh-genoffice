import { Context, Inject } from "@deepseek-ai/cordis";
import { Fragment, createElement, useSyncExternalStore } from "react";
import { act, render, within } from "@testing-library/react";
import { ConversationEventRegistry, ConversationViewRegistry, EMPTY_CHAT_SNAPSHOT, EMPTY_CONVERSATION_VIEWS, SessionProvideChannel, SlotRegistry, createScope, createSnapshotStore, scopeOf } from "@deepseek-ai/dsh-client-runtime/client";
import { createSlotRenderer } from "@deepseek-ai/dsh-client-web-react";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { SESSION_SEARCH_RESULT_LIMIT } from "@deepseek-ai/dsh-host-apiproxy/api";
//#region lib/types/snapshot.js
/**
* DOM snapshot hygiene: a vitest snapshot serializer that keeps `.snap`
* files structural. Two normalizations, both on a clone (the live DOM is
* untouched, so class/tag queries keep working):
*
* - CSS-module scoped class names (`_frame_334d2d`, this repo's
*   `_[local]_[hash]` shape) fold back to their semantic local (`frame`), so
*   CSS edits do not churn snapshots.
* - `<svg>` internals collapse to a `data-content` fingerprint on the svg
*   element: path geometry is print noise, but the fingerprint still flips
*   when an icon's artwork actually changes.
*/
/** One scoped class token: `_<local>_<hash>` (local may itself contain underscores). */
const SCOPED_CLASS = /^_(.+)_[a-z0-9]+$/;
/** Fold scoped tokens in one class attribute value; foreign tokens pass through. */
function normalizeClassValue(value) {
	return value.split(/\s+/).filter((token) => token !== "").map((token) => token.replace(SCOPED_CLASS, "$1")).join(" ");
}
/** FNV-1a 32-bit over the svg markup: deterministic, dependency-free fingerprint. */
function fingerprint(markup) {
	let hash = 2166136261;
	for (let i = 0; i < markup.length; i++) {
		hash ^= markup.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}
/** svg elements of a subtree, the root included when it is one. */
function svgsOf(root) {
	const svgs = [...root.querySelectorAll("svg")];
	if (root.tagName.toLowerCase() === "svg") svgs.unshift(root);
	return svgs;
}
/** Whether serializing this subtree needs a normalized clone. */
function needsNormalization(root) {
	return [root, ...root.querySelectorAll("[class]")].some((el) => {
		const value = el.getAttribute("class");
		return value !== null && value.split(/\s+/).some((token) => SCOPED_CLASS.test(token));
	}) || svgsOf(root).some((svg) => svg.childNodes.length > 0);
}
/**
* The serializer plugin. Matches DOM elements whose subtree carries a scoped
* class or svg internals; serializes a normalized clone, which no longer
* matches, so printing falls through to the built-in DOM element serializer.
*/
const domSnapshotSerializer = {
	test(value) {
		return typeof Element !== "undefined" && value instanceof Element && needsNormalization(value);
	},
	serialize(value, config, indentation, depth, refs, printer) {
		const clone = value.cloneNode(true);
		for (const el of [clone, ...clone.querySelectorAll("[class]")]) {
			const raw = el.getAttribute("class");
			if (raw !== null) el.setAttribute("class", normalizeClassValue(raw));
		}
		for (const svg of svgsOf(clone)) {
			if (svg.childNodes.length === 0) continue;
			svg.setAttribute("data-content", fingerprint(svg.innerHTML));
			svg.replaceChildren();
		}
		return printer(clone, config, indentation, depth, refs);
	}
};
let registered = false;
/**
* Register {@link domSnapshotSerializer} with vitest's expect (idempotent).
* SlotTestRuntime.create() calls this; specs that snapshot DOM outside the
* runtime import and call it themselves.
*/
function registerDomSnapshotSerializer() {
	if (registered) return;
	registered = true;
	expect.addSnapshotSerializer(domSnapshotSerializer);
}
//#endregion
//#region lib/types/fixtures.js
/**
* A complete quiescent conversation snapshot (open window, no traffic).
* @param sessionId - owning session id.
* @returns the snapshot; spread fixture overrides on top.
*/
function conversationSnapshot(sessionId) {
	return {
		sessionId,
		views: EMPTY_CONVERSATION_VIEWS,
		chat: EMPTY_CHAT_SNAPSHOT,
		nodes: [],
		turnTimings: /* @__PURE__ */ new Map(),
		turnEnds: /* @__PURE__ */ new Map(),
		partial: null,
		runningCalls: [],
		pending: [],
		queue: [],
		running: false,
		subagent: null,
		composerPhase: "active",
		removed: false,
		openState: "open",
		openError: null,
		hasMore: false,
		loadingOlder: false,
		promptError: null,
		blank: false,
		lastAgentError: null
	};
}
/**
* A ready workspace list with no workspaces (the shape WorkspaceRuntime
* projects after both baselines land).
* @returns the initial state of the test workspaces store.
*/
function workspaceListState() {
	return {
		items: [],
		archivedSessionIds: [],
		state: "idle",
		phase: "ready",
		error: null,
		baselinesReady: true,
		recentWorkspaceId: void 0
	};
}
//#endregion
//#region lib/types/sessions.js
/**
* The fixture-backed session face: conversation reads delegate to the
* fixture's snapshot store; ISession verbs are fail-loud stubs unless the
* fixture supplies them (the runtime never fakes behavior a test did not
* declare — an unstubbed call names itself instead of half-working). Extra
* fixture methods are grafted verbatim for feature-side casts.
*/
var FixtureSession = class {
	sessionId;
	store;
	/**
	* The useProjection seat: identity-stable per-key faces over the fixture's
	* projection values (set via {@link TestSessions.setProjection}).
	*/
	projections;
	/**
	* @param sessionId - host identity (branded view of the fixture id).
	* @param store - conversation snapshot store (updateSnapshot writes it).
	* @param overrides - fixture-declared behavior face, grafted over the stubs.
	*/
	constructor(sessionId, store, overrides) {
		this.sessionId = sessionId;
		this.store = store;
		const values = /* @__PURE__ */ new Map();
		const listeners = /* @__PURE__ */ new Map();
		const faces = /* @__PURE__ */ new Map();
		this.projections = {
			faceOf: (key) => {
				let face = faces.get(key);
				if (face === void 0) {
					face = {
						getSnapshot: () => values.get(key),
						subscribe: (fn) => {
							const set = listeners.get(key) ?? /* @__PURE__ */ new Set();
							set.add(fn);
							listeners.set(key, set);
							return () => {
								set.delete(fn);
							};
						}
					};
					faces.set(key, face);
				}
				return face;
			},
			set: (key, value) => {
				values.set(key, value);
				for (const fn of [...listeners.get(key) ?? []]) fn();
			}
		};
		Object.assign(this, overrides);
	}
	/** @returns the fixture conversation snapshot (useSession read side). */
	getSnapshot() {
		return this.store.getSnapshot();
	}
	/**
	* Subscribe to fixture snapshot changes.
	* @param fn - change callback.
	* @returns unsubscribe.
	*/
	subscribe(fn) {
		return this.store.subscribe(fn);
	}
	/**
	* Fail-loud stub; supply `prompt` on the fixture's session face to exercise it.
	* @returns never — always throws.
	*/
	prompt() {
		throw new Error(`test session "${this.sessionId}": prompt is not stubbed — supply it on the fixture's session face`);
	}
	/**
	* Fail-loud stub; supply `readAttachment` on the fixture's session face to exercise it.
	* @param _attachmentId - opaque durable attachment id.
	* @returns never — always throws.
	*/
	readAttachment(_attachmentId) {
		throw new Error(`test session "${this.sessionId}": readAttachment is not stubbed — supply it on the fixture's session face`);
	}
	/**
	* Fail-loud stub; supply `updateQueue` on the fixture's session face to exercise it.
	* @returns never — always throws.
	*/
	updateQueue() {
		throw new Error(`test session "${this.sessionId}": updateQueue is not stubbed — supply it on the fixture's session face`);
	}
	/**
	* Fail-loud stub; supply `cancel` on the fixture's session face to exercise it.
	* @returns never — always throws.
	*/
	cancel() {
		throw new Error(`test session "${this.sessionId}": cancel is not stubbed — supply it on the fixture's session face`);
	}
	/**
	* Fail-loud stub; supply `command` on the fixture's session face to exercise it.
	* @returns never — always throws.
	*/
	command() {
		throw new Error(`test session "${this.sessionId}": command is not stubbed — supply it on the fixture's session face`);
	}
	/**
	* Fail-loud stub; supply `loadOlder` on the fixture's session face to exercise it.
	* @returns never — always throws.
	*/
	loadOlder() {
		throw new Error(`test session "${this.sessionId}": loadOlder is not stubbed — supply it on the fixture's session face`);
	}
	/**
	* Fail-loud stub; supply `rename` on the fixture's session face to exercise it.
	* @returns never — always throws.
	*/
	rename() {
		throw new Error(`test session "${this.sessionId}": rename is not stubbed — supply it on the fixture's session face`);
	}
};
/**
* Sessions test double behind the renderer host and feature injects: owns the
* list/current observable, the standard-props provide channel (the runtime's
* `useSession` contribution included), scope minting through the production
* `createScope`, and the session behavior face supplied per fixture.
*
* Implements the same ISessions face features receive as `ctx.sessions`, so
* a production face change breaks this double at compile time; the extra
* members (add/updateSnapshot/setCurrent/remove/behavior/calls/stubSearch and
* the legacy provideInfo/maybeProvideInfo lookups) are bench-only surface.
*/
var TestSessions = class {
	stabilize;
	rootCtx;
	/** The useSessions standard feed (list rows + current selection). */
	list;
	/**
	* Atomic current-session provide projection (production SessionRuntime
	* mirror): selection changes and provider-roster changes publish through
	* this one source — the member the SlotRegistry host face hands the
	* renderer's SessionProvider.
	*/
	currentProvideInfo;
	records = /* @__PURE__ */ new Map();
	/** The production provide channel (roster, materialization rules, current projection) — no test-side mirror. */
	channel;
	/** Calls observed on the service-level face, newest last. */
	calls = [];
	/** The wire schema's `session.search` result bound (production parity). */
	searchResultLimit = SESSION_SEARCH_RESULT_LIMIT;
	/** Replaceable search behavior (see {@link TestSessions.stubSearch}). */
	searchStub;
	/**
	* @param stabilize - the owning runtime's act wrapper.
	* @param rootCtx - the runtime's Cordis root; scope fibers mount under it.
	*/
	constructor(stabilize, rootCtx) {
		this.stabilize = stabilize;
		this.rootCtx = rootCtx;
		this.list = createSnapshotStore({
			ids: [],
			byId: {},
			current: void 0,
			phase: "ready",
			subagentsByParent: {},
			jobsBySession: {},
			currentAddress: void 0
		});
		this.channel = new SessionProvideChannel({
			rebuildBundles: () => {
				for (const record of this.records.values()) if (record.provideInfo !== void 0) record.provideInfo = this.channel.materializeInfo(this.bindingOf(record.session.sessionId, record));
			},
			resolveCurrent: () => this.maybeProvideInfo(this.list.getSnapshot().current)
		});
		this.currentProvideInfo = this.channel.currentProvideInfo;
		this.list.subscribe(() => {
			this.channel.publishCurrent();
		});
	}
	/**
	* Add a session from a fixture and (by default) make it current.
	* @param fixture - identity + snapshot/summary overrides + behavior face.
	* @param opts - pass `current: false` to add without selecting.
	* @returns the stable session id (branded view of `fixture.id`).
	*/
	async add(fixture, opts) {
		const id = fixture.id;
		if (this.records.has(id)) throw new Error(`test session "${id}" already added`);
		const summary = {
			id,
			displayTitle: fixture.id,
			running: false,
			blank: false,
			updatedAt: this.records.size + 1,
			...fixture.summary
		};
		const snapshot = createSnapshotStore({
			...conversationSnapshot(id),
			...fixture.snapshot
		});
		this.records.set(id, {
			summary,
			snapshot,
			session: new FixtureSession(id, snapshot, fixture.session ?? {}),
			scope: void 0,
			scopeFiber: void 0,
			provideInfo: void 0
		});
		await this.stabilize(() => {
			this.list.update((draft) => {
				draft.ids.push(id);
				draft.byId[id] = summary;
				if (opts?.current !== false) draft.current = id;
			});
		});
		return id;
	}
	/**
	* Update a session's conversation snapshot through an immer draft (the
	* live-stream stand-in: components subscribed via useSession re-render).
	* @param id - session id.
	* @param mutate - draft mutator.
	*/
	async updateSnapshot(id, mutate) {
		const record = this.require(id);
		await this.stabilize(() => {
			record.snapshot.update(mutate);
		});
	}
	/**
	* Update a session's list row (the wire-echo stand-in: title settles,
	* running flips — components subscribed via useSessions re-render).
	* @param id - session id.
	* @param patch - summary fields to merge over the row.
	*/
	async updateSummary(id, patch) {
		const record = this.require(id);
		record.summary = {
			...record.summary,
			...patch
		};
		await this.stabilize(() => {
			this.list.update((draft) => {
				draft.byId[id] = record.summary;
			});
		});
	}
	/**
	* Switch the current selection (undefined = the no-session empty state).
	* @param id - session id to select, or undefined to clear.
	*/
	async setCurrent(id) {
		if (id !== void 0) this.require(id);
		await this.stabilize(() => {
			this.list.update((draft) => {
				draft.current = id;
			});
		});
	}
	/**
	* Remove a session: list row, scope fiber, and per-session store instances
	* (with persisted state) die together — the same single lifecycle axis the
	* production SessionRuntime drives on session death, minus staging.
	* @param id - session id.
	*/
	async remove(id) {
		const record = this.require(id);
		this.records.delete(id);
		await this.stabilize(async () => {
			this.list.update((draft) => {
				draft.ids = draft.ids.filter((existing) => existing !== id);
				const { [id]: _dead, ...rest } = draft.byId;
				draft.byId = rest;
				if (draft.current === id) draft.current = void 0;
			});
			if (record.scopeFiber !== void 0) await record.scopeFiber.dispose();
			this.rootCtx.get("slots")?.pruneStoreScope(id);
		});
	}
	/**
	* Register a per-session standard-props provider (production `provide`
	* contract: hooks become `use<Name>` selector hooks on the render side,
	* props spread verbatim; duplicate names fail loud at materialization).
	* @param descriptor - static member roster plus per-session resolver.
	* @returns disposer removing the provider.
	*/
	provide(descriptor) {
		return this.channel.provide(descriptor);
	}
	/**
	* Resolve the definite per-session standard-props bundle (host face member).
	* @param id - session id.
	* @returns the identity-stable bundle, or undefined for unknown sessions.
	*/
	provideInfo(id) {
		const record = this.records.get(id);
		if (record === void 0) return void 0;
		record.provideInfo ??= this.channel.materializeInfo(this.bindingOf(id, record));
		return record.provideInfo;
	}
	/**
	* Resolve the current-session-optional standard kit (host face member):
	* unknown or absent ids return the static no-session projection.
	* @param id - current session id, when selected.
	* @returns a definite or no-session provide bundle.
	*/
	maybeProvideInfo(id) {
		return (id === void 0 ? void 0 : this.provideInfo(id)) ?? this.channel.maybeInfo;
	}
	/**
	* Resolve (mint on first touch) the session-scoped Cordis context through
	* the production `createScope`, so real `scopeOf`/scope-addressed services
	* resolve it.
	* @param id - session id.
	* @returns the scoped context, or undefined for unknown sessions.
	*/
	scope(id) {
		const record = this.records.get(id);
		if (record === void 0) return void 0;
		if (record.scope === void 0) {
			const handle = createScope(this.rootCtx, id);
			record.scope = handle.ctx;
			record.scopeFiber = handle.fiber;
		}
		return record.scope;
	}
	/**
	* Session assembly binding (inject factories and provide resolvers receive it).
	* @param id - session id.
	* @returns sessionId + behavior face + scoped ctx, or undefined when unknown.
	*/
	binding(id) {
		const record = this.records.get(id);
		if (record === void 0) return void 0;
		return this.bindingOf(id, record);
	}
	/**
	* Read the session scope tag off a context (service-method boundary mirror).
	* @param ctx - any client context.
	* @returns the session id, or undefined on root contexts.
	*/
	scopeOf(ctx) {
		return scopeOf(ctx);
	}
	/**
	* Resolve the scoped session face off a context (production `sessionOf`
	* mirror).
	* @param ctx - any client context.
	* @returns the fixture session face, or undefined off-scope.
	*/
	sessionOf(ctx) {
		const id = scopeOf(ctx);
		if (id === void 0) return void 0;
		return this.records.get(id)?.session;
	}
	/**
	* Service-level selection call (recorded, then applied to the list store
	* synchronously — inject callbacks call this outside any act window; the
	* store notify is microtask-batched so the next stabilized step observes it).
	* @param id - session id.
	*/
	open(id) {
		this.calls.push({
			method: "open",
			args: [id]
		});
		this.require(id);
		this.list.update((draft) => {
			draft.current = id;
			draft.currentAddress = void 0;
		});
	}
	/** Open an existing fixture through its catalog address. */
	openSubagent(address) {
		this.calls.push({
			method: "openSubagent",
			args: [address]
		});
		this.require(address.childSessionId);
		this.list.update((draft) => {
			draft.current = address.childSessionId;
			draft.currentAddress = address;
		});
	}
	/** Resolve the current fixture's retained catalog address. */
	subagentAddress(id) {
		const address = this.list.getSnapshot().currentAddress;
		return address?.childSessionId === id ? address : void 0;
	}
	/** Record catalog consumption; fixture callers drive snapshots explicitly. */
	setSubagentCatalogOpen(parentSessionId, open) {
		this.calls.push({
			method: "setSubagentCatalogOpen",
			args: [parentSessionId, open]
		});
	}
	/** Record a catalog refresh; fixture callers drive snapshots explicitly. */
	refreshSubagents(parentSessionId) {
		this.calls.push({
			method: "refreshSubagents",
			args: [parentSessionId]
		});
		return Promise.resolve();
	}
	/** Apply a confirmed preset switch into the fixture list, as production does. */
	noteAgentPreset(sessionId, agentPreset) {
		this.list.update((draft) => {
			const summary = draft.byId[sessionId];
			if (summary !== void 0) draft.byId[sessionId] = {
				...summary,
				agentPreset
			};
		});
	}
	/** Clear the current selection (recorded; the production no-session flow). */
	clear() {
		this.calls.push({
			method: "clear",
			args: []
		});
		this.list.update((draft) => {
			draft.current = void 0;
			draft.currentAddress = void 0;
		});
	}
	/**
	* Replace the sidebar-search result page (the call is still recorded).
	* @param impl - hits for a query, as the Host would rank them.
	*/
	stubSearch(impl) {
		this.searchStub = impl;
	}
	/**
	* Content search over the fixture corpus (recorded). The default answers an
	* empty page: content ranking is Host behavior, so a scenario that asserts
	* hits declares them through {@link TestSessions.stubSearch}.
	* @param query - non-blank literal phrase.
	* @param signal - cancellation for a superseded search (recorded and forwarded).
	* @returns the stubbed or empty result page.
	*/
	search(query, signal) {
		this.calls.push({
			method: "search",
			args: [query, signal]
		});
		return Promise.resolve({
			ok: true,
			value: this.searchStub?.(query, signal) ?? {
				items: [],
				hasMore: false
			}
		});
	}
	/**
	* Recorded fork stub: no child materializes (benches asserting the full
	* fork flow drive the production service; this face only proves the call).
	* @param opts - source session id, optional cut anchor, and client title policy.
	* @returns the source id (no child record is created).
	*/
	fork(opts) {
		this.calls.push({
			method: "fork",
			args: [opts]
		});
		return Promise.resolve(opts.sessionId);
	}
	/**
	* The session face of a fixture (typed view for assertions; fixture
	* behavior methods are grafted onto it).
	* @param id - session id.
	* @returns the FixtureSession the binding and provide channel carry.
	*/
	behavior(id) {
		return this.require(id).session;
	}
	/** Dispose minted scope fibers (runtime dispose path). */
	async disposeScopes() {
		for (const record of this.records.values()) if (record.scopeFiber !== void 0) {
			await record.scopeFiber.dispose();
			record.scope = void 0;
			record.scopeFiber = void 0;
		}
	}
	bindingOf(id, record) {
		const ctx = this.scope(id);
		/* v8 ignore next 2 -- bindingOf only runs for a live record, whose scope
		* always resolves; kept so a future caller cannot mint a ctx-less binding. */
		if (ctx === void 0) throw new Error(`test session "${id}" resolved no scope`);
		return {
			sessionId: id,
			session: record.session,
			ctx
		};
	}
	require(id) {
		const record = this.records.get(id);
		if (record === void 0) throw new Error(`test session "${id}" is not added`);
		return record;
	}
};
//#endregion
//#region lib/types/workspaces.js
/** Test-owned workspaces face: the renderer standard-kit observable plus recorded actions. */
/**
* Workspaces test double. Implements the same IWorkspaces face features
* receive as `ctx.workspaces`, so a production face change breaks this
* double at compile time. Every action records into {@link
* TestWorkspaces.calls}; defaults are inert echoes — feature tests needing
* richer behavior replace them via {@link TestWorkspaces.stub}.
*/
var TestWorkspaces = class {
	stabilize;
	/** The useWorkspaces standard feed. */
	list;
	/** Calls observed on the action face, newest last. */
	calls = [];
	/** Replaceable action seat: feature tests may stub richer behavior. */
	stubs = /* @__PURE__ */ new Map();
	/**
	* @param stabilize - the owning runtime's act wrapper.
	*/
	constructor(stabilize) {
		this.stabilize = stabilize;
		this.list = createSnapshotStore(workspaceListState());
	}
	/**
	* Update the workspace list state through an immer draft.
	* @param mutate - draft mutator.
	*/
	async update(mutate) {
		await this.stabilize(() => {
			this.list.update(mutate);
		});
	}
	/**
	* Replace an action's behavior (the recorded call is still appended first).
	* @param method - action name (e.g. 'connectWorkspace').
	* @param impl - replacement behavior.
	*/
	stub(method, impl) {
		this.stubs.set(method, impl);
	}
	/**
	* Connect a workspace to its reusable/new blank session (recorded). The
	* default resolves the workspace id back as the session id; stub for
	* cross-session flows.
	* @param workspaceId - target workspace.
	* @returns the connected session id.
	*/
	async connectWorkspace(workspaceId) {
		this.calls.push({
			method: "connectWorkspace",
			args: [workspaceId]
		});
		const stub = this.stubs.get("connectWorkspace");
		if (stub !== void 0) return await stub(workspaceId);
		return `session-of-${workspaceId}`;
	}
	/**
	* New-session flow (recorded; stubbed behavior runs when installed).
	* @param workspaceId - optional explicit workspace target.
	*/
	startSession(workspaceId) {
		this.calls.push({
			method: "startSession",
			args: [workspaceId]
		});
		this.stubs.get("startSession")?.(workspaceId);
	}
	/**
	* Create a Workspace (recorded). The default echoes a view derived from
	* the input; stub for failure or list-coupled flows.
	* @param input - the Host create payload.
	* @returns the created Workspace view.
	*/
	async create(input) {
		this.calls.push({
			method: "create",
			args: [input]
		});
		const stub = this.stubs.get("create");
		if (stub !== void 0) return await stub(input);
		return {
			workspaceId: `ws-${input.path}`,
			title: input.path,
			path: input.path,
			sessionIds: []
		};
	}
	/**
	* Open a path with the host OS default application (recorded; default no-op).
	* @param path - host-resolvable path.
	*/
	async openPath(path) {
		this.calls.push({
			method: "openPath",
			args: [path]
		});
		await this.stubs.get("openPath")?.(path);
	}
	/**
	* Directory picker (recorded). The default cancels (null); stub to select.
	* @returns the picked path, or null.
	*/
	async pickDirectory() {
		this.calls.push({
			method: "pickDirectory",
			args: []
		});
		const stub = this.stubs.get("pickDirectory");
		if (stub !== void 0) return await stub();
		return null;
	}
	/**
	* Browse listing (recorded). The default serves an empty home level; stub
	* to shape a tree.
	* @param path - absolute directory to list; absent lists the home level.
	* @returns the level's listing.
	*/
	async listDirectory(path, signal) {
		this.calls.push({
			method: "listDirectory",
			args: [path, signal]
		});
		const stub = this.stubs.get("listDirectory");
		if (stub !== void 0) return await stub(path, signal);
		return {
			path: "/home/test",
			home: "/home/test",
			crumbs: [
				{
					name: "/",
					path: "/",
					hidden: false
				},
				{
					name: "home",
					path: "/home",
					hidden: false
				},
				{
					name: "test",
					path: "/home/test",
					hidden: false
				}
			],
			entries: [],
			truncated: false
		};
	}
	/**
	* Browse child creation (recorded). The default joins parent and name.
	* @param path - absolute existing parent directory.
	* @param name - single path segment.
	* @returns the created directory's absolute path.
	*/
	async createDirectory(path, name) {
		this.calls.push({
			method: "createDirectory",
			args: [path, name]
		});
		const stub = this.stubs.get("createDirectory");
		if (stub !== void 0) return await stub(path, name);
		return `${path}/${name}`;
	}
	/**
	* Rename a Workspace (recorded). The default echoes a minimal view.
	* @param workspaceId - target workspace.
	* @param title - new title.
	* @returns the updated view.
	*/
	async rename(workspaceId, title) {
		this.calls.push({
			method: "rename",
			args: [workspaceId, title]
		});
		const stub = this.stubs.get("rename");
		if (stub !== void 0) return await stub(workspaceId, title);
		return {
			workspaceId,
			title,
			path: `/${title}`,
			sessionIds: []
		};
	}
	/**
	* Delete a Workspace (recorded; default no-op).
	* @param workspaceId - target workspace.
	*/
	async delete(workspaceId) {
		this.calls.push({
			method: "delete",
			args: [workspaceId]
		});
		await this.stubs.get("delete")?.(workspaceId);
	}
	/**
	* Move a Workspace in display order (recorded; default no-op).
	* @param workspaceId - Workspace to move.
	* @param beforeWorkspaceId - Anchor; omitted appends.
	*/
	async insertBefore(workspaceId, beforeWorkspaceId) {
		this.calls.push({
			method: "insertBefore",
			args: [workspaceId, beforeWorkspaceId]
		});
		await this.stubs.get("insertBefore")?.(workspaceId, beforeWorkspaceId);
	}
	/**
	* Move an accounted session (recorded). The default echoes a minimal view.
	* @param workspaceId - target workspace.
	* @param sessionId - session to move.
	* @param beforeSessionId - anchor; omitted appends.
	* @returns the updated view.
	*/
	async insertSessionBefore(workspaceId, sessionId, beforeSessionId) {
		this.calls.push({
			method: "insertSessionBefore",
			args: [
				workspaceId,
				sessionId,
				beforeSessionId
			]
		});
		const stub = this.stubs.get("insertSessionBefore");
		if (stub !== void 0) return await stub(workspaceId, sessionId, beforeSessionId);
		return {
			workspaceId,
			title: "",
			path: "",
			sessionIds: [sessionId]
		};
	}
	/**
	* Archive a session (recorded). The default mirrors the production face's
	* observable effect: the id joins the list state's archive set.
	* @param sessionId - session to archive.
	*/
	async archiveSession(sessionId) {
		this.calls.push({
			method: "archiveSession",
			args: [sessionId]
		});
		const stub = this.stubs.get("archiveSession");
		if (stub !== void 0) {
			await stub(sessionId);
			return;
		}
		await this.update((draft) => {
			draft.archivedSessionIds = [...draft.archivedSessionIds, sessionId];
		});
	}
};
//#endregion
//#region lib/types/settings-scope.js
/** Test double for the client settings-scope seam. */
/**
* Build an in-memory settings scope for service specs: starts in the host
* loading state, records writes, and lets the test publish Host acceptances.
* @returns the stub handle.
*/
function stubSettingsScope() {
	let snapshot = {
		status: "loading",
		value: void 0,
		base: void 0,
		user: void 0,
		revision: void 0,
		writable: false,
		mode: "host"
	};
	const listeners = /* @__PURE__ */ new Set();
	const set = vi.fn(() => Promise.resolve());
	const unset = vi.fn(() => Promise.resolve());
	return {
		scope: {
			getSnapshot: () => snapshot,
			subscribe: (listener) => {
				listeners.add(listener);
				return () => {
					listeners.delete(listener);
				};
			},
			set,
			unset
		},
		set,
		unset,
		listenerCount: () => listeners.size,
		publish: (next) => {
			snapshot = {
				...snapshot,
				...next
			};
			for (const listener of [...listeners]) listener();
		}
	};
}
//#endregion
//#region lib/types/remote.js
/**
* Remote service test double for the forwarded-event path. Feature specs need
* `ctx.remote.$on` to exist (their plugins inject `remote`) and need forwarded
* host events to reach those subscribers, but not the generated namespaces or
* the wire — so this double implements subscription and dispatch only.
*
* Dispatch is driven the same way production drives it: `client/runtime` owns the
* host frame sink and hands each decoded `host/remote-event` frame to
* `$dispatch`. A spec therefore exercises its refresh chains by calling
* `$dispatch(name, args)` on this double.
*
* `$mount` rejects: a spec that reaches a generated namespace through this
* double has outgrown it and needs the real Client Remote service.
*
* One deliberate asymmetry with production: a throwing listener propagates out
* of the emit instead of being contained and logged, so a spec cannot lean on
* this double for the containment guarantee `$on` documents — assert that
* against the real service.
*/
var TestRemote = class {
	subscriptions = /* @__PURE__ */ new Map();
	/**
	* Register the double as `ctx.remote`.
	* @param ctx - the spec's root Context.
	*/
	constructor(ctx) {
		ctx.provide("remote", this);
	}
	/**
	* Deliver one forwarded host event to its subscribers, standing in for the
	* carrier that owns the frame sink.
	* @param event - forwarded host event name.
	* @param args - the Host argument list, verbatim.
	*/
	$dispatch(event, args) {
		const listeners = this.subscriptions.get(event);
		if (listeners === void 0) return;
		for (const listener of [...listeners]) listener(...args);
	}
	/**
	* Subscribe to one forwarded host event.
	* @param event - forwarded host event name.
	* @param listener - receives the Host argument list verbatim.
	* @returns disposer removing this subscription.
	*/
	$on(event, listener) {
		const listeners = this.subscriptions.get(event) ?? /* @__PURE__ */ new Set();
		this.subscriptions.set(event, listeners);
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}
	/**
	* Generated-namespace mount, unsupported by this double.
	* @returns never; always rejects.
	*/
	$mount() {
		return Promise.reject(/* @__PURE__ */ new Error("TestRemote: $mount needs the real Client Remote service"));
	}
};
//#endregion
//#region lib/types/translate.js
/**
* Test double of the locale lookup chain: a translate stub over plain
* dictionaries, mirroring LocaleRuntime's resolution order (first dictionary
* that owns the key wins, then the key itself stays visible) and its
* `{name}` template interpolation. Specs stub the framework-injected `t`
* seat with `makeTranslate(zh, commonZh)` instead of re-implementing the
* chain per suite.
*/
/**
* Build a translate stub resolving through `dicts` in order (namespace
* first, then the shared common vocabulary), falling back to the key.
* @param dicts - dictionaries consulted in order.
* @returns the translate function (assignable to any `XxxProps['t']` seat).
*/
function makeTranslate(...dicts) {
	return (key, params) => {
		let template = key;
		for (const dict of dicts) {
			const hit = dict[key];
			if (hit !== void 0) {
				template = hit;
				break;
			}
		}
		if (!params) return template;
		return template.replace(/\{(\w+)\}/g, (match, name) => name in params ? String(params[name]) : match);
	};
}
//#endregion
//#region lib/types/locale-env.js
/**
* Browser-language pin for specs that assert localized copy. A fresh
* LocaleRuntime with no stored preference opens in the language `navigator`
* asks for, and jsdom reports the runner's own (`en-US`) — so a spec asserting
* the product's Chinese copy states the browser it assumes instead of
* inheriting the machine's.
*/
/**
* Pin `navigator.languages`/`navigator.language` for every test in the
* calling file (or describe block), restoring the environment's own values
* afterwards. Call at suite level, like the other vitest hooks.
* @param primary - most preferred BCP 47 tag; also becomes `navigator.language`.
* @param rest - further tags in preference order.
*/
function usePinnedBrowserLanguages(primary, ...rest) {
	beforeEach(() => {
		Object.defineProperty(navigator, "languages", {
			value: [primary, ...rest],
			configurable: true
		});
		Object.defineProperty(navigator, "language", {
			value: primary,
			configurable: true
		});
	});
	afterEach(() => {
		const own = navigator;
		delete own.languages;
		delete own.language;
	});
}
//#endregion
//#region lib/types/index.js
/**
* jsdom slot test runtime: a real small runtime — Cordis `Context`, the
* runtime `SlotRegistry`, and the web-react renderer — assembled around
* test-owned session/workspace doubles, so feature specs exercise
* declaration, registration, scope, store, inject, rendering, updates, and
* disposal without hand-building the machinery per suite.
*
* Not part of the product plugin graph (no `dsh.client`); feature packages
* depend on it in devDependencies only. It copies no SlotCore/renderer/store
* machinery — everything mounts the production implementations.
* @module @deepseek-ai/dsh-client-test-runtime
*/
/**
* Owner-props cell behind the auto frame: one external store the frame
* subscribes to, so {@link SlotTestRuntime.renderSlot} and
* {@link SlotView.update} drive React through the standard uSES boundary.
*/
var OwnerPropsCell = class {
	owners = /* @__PURE__ */ new Map();
	listeners = /* @__PURE__ */ new Set();
	version = 0;
	/** Snapshot version for uSES pairing (bumped on every set). */
	getVersion = () => this.version;
	/**
	* Subscribe to owner-props changes.
	* @param fn - change callback.
	* @returns unsubscribe.
	*/
	subscribe = (fn) => {
		this.listeners.add(fn);
		return () => {
			this.listeners.delete(fn);
		};
	};
	/**
	* Install or replace one key's owner props and notify (synchronous; the
	* caller wraps in act).
	* @param key - slot key.
	* @param owner - owner props share.
	*/
	set(key, owner) {
		this.owners.set(key, owner);
		this.version += 1;
		for (const fn of [...this.listeners]) fn();
	}
	/** Keys with supplied owner props, in first-supply order. */
	entries() {
		return [...this.owners.entries()];
	}
};
/**
* The test-owned 'root' occupant: declares the child slots a suite needs
* through the REAL `slots.register`, with a caller-supplied minimal frame —
* the runtime never guesses a feature's page structure.
*/
var TestRoot = class {
	slots;
	stabilize;
	disposeEntry;
	/**
	* @param slots - the runtime SlotRegistry.
	* @param stabilize - the owning runtime's act wrapper.
	*/
	constructor(slots, stabilize) {
		this.slots = slots;
		this.stabilize = stabilize;
	}
	/**
	* Register the root frame, declaring (and thereby claiming) the child
	* slots. One declaration per runtime — a second call fails loud in the
	* core ('root' is a single slot).
	* @param children - child-slot declaration table (declaration + render authorization + runtime spec).
	* @param frame - minimal frame component; its props derive from the declared keys (composed-props contract).
	* @returns completion of the act-wrapped registration.
	*/
	async declare(children, frame) {
		await this.stabilize(() => {
			this.disposeEntry = this.slots.register({
				name: "root",
				children
			}, frame);
		});
	}
	/** Remove the root registration and collapse its declarations (runtime dispose path). */
	release() {
		this.disposeEntry?.();
		this.disposeEntry = void 0;
	}
};
/**
* The assembled test runtime. Obtain via {@link SlotTestRuntime.create};
* dispose with {@link SlotTestRuntime.dispose} (afterEach). Public mutators
* are act-wrapped throughout — tests never handle SlotCore microtask
* batching or React act themselves.
*/
var SlotTestRuntime = class SlotTestRuntime {
	/** The runtime's Cordis root (escape hatch: extra services via `ctx.provide`, raw `ctx.plugin` mounts). */
	ctx;
	/** The production SlotRegistry mounted on {@link SlotTestRuntime.ctx}. */
	slots;
	/** The test-owned 'root' occupant. */
	root;
	/** Sessions double (list/current observable, cells, scopes, behavior faces). */
	sessions;
	/** Workspaces double (list observable, recorded intent actions). */
	workspaces;
	stabilizer = async (fn) => {
		await act(async () => {
			await fn();
		});
	};
	host;
	views = [];
	handles = [];
	disposed = false;
	/** Auto-frame state ({@link SlotTestRuntime.declare} / {@link SlotTestRuntime.renderSlot}). */
	ownerCell = new OwnerPropsCell();
	autoDeclared = /* @__PURE__ */ new Set();
	autoRootView;
	constructor(ctx, slots) {
		this.ctx = ctx;
		this.slots = slots;
		this.root = new TestRoot(slots, this.stabilizer);
		this.sessions = new TestSessions(this.stabilizer, ctx);
		this.workspaces = new TestWorkspaces(this.stabilizer);
		ctx.provide("sessions", this.sessions);
		ctx.provide("workspaces", this.workspaces);
		const renderer = createSlotRenderer();
		slots.install({ renderRoot: (host, ownerProps) => {
			this.host = host;
			return renderer.renderRoot(host, ownerProps);
		} });
	}
	/**
	* Assemble a runtime: real Context, mounted SlotRegistry, installed
	* renderer, and the session/workspace doubles provided as services.
	* @returns the ready runtime.
	*/
	static async create() {
		registerDomSnapshotSerializer();
		const ctx = new Context();
		await ctx.plugin(SlotRegistry).await();
		await ctx.plugin(ConversationEventRegistry).await();
		await ctx.plugin(ConversationViewRegistry).await();
		return new SlotTestRuntime(ctx, ctx.get("slots"));
	}
	/**
	* Provide an extra service the feature under test injects (e.g. a layout
	* fake). Sugar over `ctx.provide`, typed against the Context declaration
	* merge: for a declared service name the fake must be a subset of that
	* service's outward face (Partial — supply only what the feature calls),
	* so a production face change breaks the fake at compile time. Undeclared
	* names stay unchecked (ad-hoc test services).
	* @param name - service name.
	* @param value - service implementation (test double).
	*/
	provide(name, value) {
		this.ctx.provide(name, value);
	}
	/**
	* Mount a feature plugin on a real fiber. Required services are prechecked
	* so a missing provider fails loud instead of suspending the fiber forever
	* (deliberate load-order suspension tests use `ctx.plugin` directly).
	* @param plugin - plugin value (function, class, or `{ inject, apply }` object).
	* @returns handle owning the fiber's explicit disposal.
	*/
	async mount(plugin) {
		const missing = Object.keys(Inject.resolve(plugin.inject)).filter((name) => this.ctx.get(name) === void 0);
		if (missing.length > 0) throw new Error(`mount would suspend: missing service(s) ${missing.join(", ")} — provide() them first`);
		const fiber = this.ctx.plugin(plugin);
		await this.stabilizer(async () => {
			await fiber.await();
		});
		let disposed = false;
		const handle = {
			fiber,
			dispose: async () => {
				if (disposed) return;
				disposed = true;
				await this.stabilizer(() => fiber.dispose());
			}
		};
		this.handles.push(handle);
		return handle;
	}
	/**
	* Render the root slot tree through the ctx-level entry (the shell's own
	* entry point): `ctx.slots.renderSlot('root', {})` under Testing Library.
	* @returns the Testing Library view.
	*/
	renderRoot() {
		const view = render(createElement(Fragment, null, this.slots.renderSlot("root", {})));
		this.views.push(view);
		return view;
	}
	/**
	* Declare child slots under an auto-generated root frame — the single-slot
	* mounting path for local DOM snapshots. Each key later supplied through
	* {@link SlotTestRuntime.renderSlot} renders inside the renderer's own
	* `<div data-slot="<key>">` outlet anchor (the snapshot root — the frame
	* adds no wrapper of its own). Mutually exclusive with
	* {@link TestRoot.declare} ('root' is a single slot); one call per runtime.
	* @param children - child-slot declaration table (same contract as TestRoot.declare).
	* @returns completion of the act-wrapped registration.
	*/
	async declare(children) {
		for (const key of Object.keys(children)) this.autoDeclared.add(key);
		const cell = this.ownerCell;
		const AutoFrame = (props) => {
			useSyncExternalStore(cell.subscribe, cell.getVersion);
			return createElement(Fragment, null, cell.entries().map(([key, owner]) => createElement(Fragment, { key }, props.renderSlot(key, owner))));
		};
		await this.root.declare(children, AutoFrame);
	}
	/**
	* Render one declared slot with its owner props and return the local view.
	* The whole root tree mounts through the production assembly path
	* (renderer, scope providers, store axis); only this key's output lands in
	* the returned container. Call again with another key to view a sibling
	* slot of the same tree.
	* @param key - a key declared through {@link SlotTestRuntime.declare}.
	* @param owner - owner props share for the render site.
	* @returns the slot-local view (snapshot container, scoped queries, owner updates).
	*/
	renderSlot(key, owner) {
		if (!this.autoDeclared.has(key)) throw new Error(`renderSlot('${key}') without declare() — declare the key first (or use root.declare for a custom frame)`);
		const install = (next) => {
			act(() => {
				this.ownerCell.set(key, next);
			});
		};
		install(owner);
		this.autoRootView ??= this.renderRoot();
		const container = this.autoRootView.container.querySelector(`[data-slot="${key}"]`);
		if (!(container instanceof HTMLElement)) throw new Error(`renderSlot('${key}'): the auto frame rendered no wrapper — was the runtime already disposed?`);
		return {
			container,
			view: within(container),
			update: install
		};
	}
	/**
	* Resolve the store instance the renderer would hand a slot's component
	* (identity assertions, action-driven writes). Requires a prior
	* {@link SlotTestRuntime.renderRoot} — the host face exists only inside the
	* installed renderer, exactly as in production.
	* @param key - slot key whose first entry declares the store.
	* @param scopeKey - session id for session-scope slots; omit for root scope.
	* @returns the live store instance.
	*/
	storeOf(key, scopeKey) {
		if (this.host === void 0) throw new Error("storeOf before renderRoot() — the host face exists only inside the installed renderer");
		const entry = this.host.entriesOf(key)[0];
		if (entry === void 0) throw new Error(`storeOf('${key}'): no registration on the ledger`);
		const instance = this.host.storeOf(entry, scopeKey);
		if (instance === void 0) throw new Error(`storeOf('${key}'): the entry declares no store`);
		return instance;
	}
	/**
	* Flush pending ledger/store notifications inside act — for mutations made
	* outside the runtime's own methods (e.g. a direct `slots.register`).
	* @returns completion of the act pass.
	*/
	async flush() {
		await this.stabilizer(() => {});
	}
	/**
	* Tear down: unmount React trees first, then dispose feature fibers, the
	* root registration, minted session scopes, and persisted test state.
	* Idempotent.
	* @returns completion of the teardown.
	*/
	async dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.autoRootView = void 0;
		for (const view of this.views.splice(0)) view.unmount();
		for (const handle of this.handles.splice(0)) await handle.dispose();
		this.root.release();
		await this.sessions.disposeScopes();
		localStorage.clear();
	}
};
//#endregion
export { FixtureSession, SlotTestRuntime, TestRemote, TestRoot, TestSessions, TestWorkspaces, conversationSnapshot, domSnapshotSerializer, makeTranslate, registerDomSnapshotSerializer, stubSettingsScope, usePinnedBrowserLanguages, workspaceListState };
