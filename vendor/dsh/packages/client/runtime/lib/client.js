window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-runtime",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let cordis = require("cordis");
		let _deepseek_ai_dsh_client_ui_slots = require("@deepseek-ai/dsh-client-ui-slots");
		//#region src/client/slots.ts
		/**
		* SlotsService: the cordis Service layer of the slot system over the pure
		* SlotCore (ui-slots owns registration semantics, the declaration ledger,
		* the load-time validations, and the unload cascade). This layer owns what
		* needs the runtime: the 'slots/changed' event bridge, register and
		* declaration injection through the caller's ctx.effect (fiber unload
		* collects both), the renderer install seam (install()/renderSlot('root') +
		* the SlotRendererHost face), and the store INSTANCE axis — handle x scope
		* key -> create/cache, dropped with the last holding entry, session instances
		* cleared (with persisted state) on scope death.
		*/
		/** Instance key for root-scoped store records (session records key by session id, so the literal cannot collide). */
		const ROOT_INSTANCE_KEY = "root";
		/** cordis Service layer of the slot system; see the module doc for the split with SlotCore. */
		var SlotsService = class extends cordis.Service {
			_core = new _deepseek_ai_dsh_client_ui_slots.SlotCore();
			/** Store-instance axis: handle -> mounted scope, refcount, resolved instances. */
			_stores = /* @__PURE__ */ new Map();
			_renderer;
			_locale;
			_host;
			/**
			* @param ctx - owning root context.
			*/
			constructor(ctx) {
				super(ctx, "slots");
				this._core.onMutate((key) => {
					ctx.emit("slots/changed", key);
				});
			}
			/**
			* Install an effect for each declaration lifetime of a slot. The callback
			* runs synchronously when the declaration already exists; otherwise it runs
			* inside the declaring `register()` call after the declaration is committed.
			* Collapse disposes the effect and a later declaration runs it again.
			* Callback effects are synchronous disposers; iterable effects install
			* transactionally and dispose in reverse order. The controller belongs to
			* the caller's fiber, so plugin unload cancels a pending wait and removes any
			* active contribution.
			*
			* @param key - declared SlotMap key to depend on.
			* @param callback - creates one disposer or an iterable of disposers.
			* @returns idempotent disposer for the wait and active effect.
			* @throws callback setup failures synchronously when the slot is already declared.
			*/
			inject(key, callback) {
				const ctx = this.ctx;
				const disposeController = ctx.effect(() => {
					let active;
					let activeEpoch;
					let stopped = false;
					let unsubscribe = () => {};
					const stop = () => {
						if (stopped) return;
						stopped = true;
						unsubscribe();
						const dispose = active;
						active = void 0;
						activeEpoch = void 0;
						dispose?.();
					};
					const reconcile = () => {
						if (stopped) return;
						const spec = this._core.specDynamic(key);
						const epoch = this._core.declarationEpoch(key);
						if (active !== void 0 && activeEpoch === epoch) return;
						const dispose = active;
						active = void 0;
						activeEpoch = void 0;
						dispose?.();
						if (spec === void 0) return;
						const disposeEffect = ctx.effect(callback, `slots.inject(${JSON.stringify(key)}): declaration`);
						active = () => {
							disposeEffect();
						};
						activeEpoch = epoch;
					};
					const changed = () => {
						try {
							reconcile();
						} catch (error) {
							if (error?.code === "INACTIVE_EFFECT") {
								stop();
								return;
							}
							stop();
							const failure = error instanceof Error ? error : new Error(String(error));
							queueMicrotask(() => {
								throw failure;
							});
						}
					};
					unsubscribe = this._core.subscribeDeclaration(key, changed);
					try {
						reconcile();
					} catch (error) {
						stop();
						throw error;
					}
					return stop;
				}, `slots.inject(${JSON.stringify(key)})`);
				return () => {
					disposeController();
				};
			}
			/**
			* Install the shell's renderer (web-react's createSlotRenderer product).
			* Boot-once: a second install throws. Runs through the caller's ctx.effect,
			* so shell fiber unload uninstalls the renderer.
			* @param renderer - the outlet machinery implementing SlotRenderer.
			*/
			install(renderer) {
				if (this._renderer !== void 0) throw new Error("slot renderer already installed (install() is boot-once)");
				this.ctx.effect(() => {
					this._renderer = renderer;
					return () => {
						if (this._renderer === renderer) this._renderer = void 0;
					};
				}, "slots.install()");
			}
			/**
			* Install the locale face backing the `t` standard seat (the locale
			* plugin's product; same boot-once discipline as the renderer install).
			* Runs through the caller's ctx.effect, so the installing fiber's unload
			* uninstalls the face.
			* @param face - namespace binder + revision observable.
			*/
			installLocale(face) {
				if (this._locale !== void 0) throw new Error("locale face already installed (installLocale() is boot-once)");
				this.ctx.effect(() => {
					this._locale = face;
					return () => {
						if (this._locale === face) this._locale = void 0;
					};
				}, "slots.installLocale()");
			}
			/**
			* The single ctx-level render entry: the shell renders 'root'; every other
			* key renders inside components through the props renderSlot face. All
			* three guards are fail-loud boot-order checks, no fallback.
			* @param key - must be 'root' (runtime-enforced for dynamically composed callers).
			* @param owner - owner share for the root entry (the shell supplies {}).
			* @returns the rendered root tree.
			*/
			renderSlot(key, owner) {
				if (key !== "root") throw new Error(`ctx-level renderSlot only renders 'root' (got "${key}"); child slots render through the component props face`);
				if (this._renderer === void 0) throw new Error("slot renderer not installed — boot must call ctx.slots.install(createSlotRenderer()) before rendering 'root'");
				if (this._core.entries("root").length === 0) throw new Error("'root' has no registration — a layout entry must register into 'root' before the shell renders it");
				return this._renderer.renderRoot(this.hostFace(), owner);
			}
			/**
			* Drop the per-session store instances of a dead session (the sessions
			* service calls this on scope teardown; root-scoped records are untouched).
			* Persisted state goes with the session — a never-rendered dead session can
			* still own keys from an earlier page load, so the instance is materialized
			* transiently just to clear storage (no-op for unpersisted stores).
			* @param sessionId - the torn-down session.
			*/
			pruneStoreScope(sessionId) {
				for (const [handle, record] of this._stores) {
					if (record.scope !== "session") continue;
					(record.instances.get(sessionId) ?? handle.create(sessionId)).clearPersisted();
					record.instances.delete(sessionId);
				}
			}
			/**
			* Snapshot entries for a key (render-erased view; stable reference between mutations).
			* @param key - SlotMap key.
			* @returns registered entries.
			*/
			entries(key) {
				return this._core.entries(key);
			}
			/**
			* Look up a declared spec (register-declared or the built-in 'root').
			* @param key - SlotMap key.
			* @returns spec or undefined.
			*/
			spec(key) {
				return this._core.spec(key);
			}
			/**
			* Subscribe to a key's registration changes (microtask-batched).
			* @param key - SlotMap key.
			* @param fn - change callback.
			* @returns unsubscribe.
			*/
			subscribe(key, fn) {
				return this._core.subscribe(key, fn);
			}
			/**
			* Version counter for uSES pairing.
			* @param key - SlotMap key.
			* @returns current version.
			*/
			getVersion(key) {
				return this._core.getVersion(key);
			}
			/** Delegating registration path: factory minting + registrant stamp + core write + instance-axis bookkeeping. */
			_register(options, component) {
				const store = typeof options.store === "function" ? options.store() : options.store;
				const registrant = options.registrant ?? this.ctx.fiber?.name;
				const erased = {
					...options,
					...store !== void 0 ? { store } : {},
					...registrant !== void 0 ? { registrant } : {}
				};
				const dispose = this._core.register(erased, component);
				if (store !== void 0) {
					const scope = this._core.specDynamic(options.name).scope;
					this._acquire(store, scope);
				}
				let disposed = false;
				return () => {
					if (disposed) return;
					disposed = true;
					dispose();
					if (store !== void 0) this._release(store);
				};
			}
			/** Build once after both object-layer services mount; per-session provide bundles still resolve lazily. */
			hostFace() {
				if (this._host !== void 0) return this._host;
				const sessions = this.ctx.get("sessions");
				if (sessions === void 0) throw new Error("renderSlot('root') before the sessions service mounted — boot order puts runtime apply first");
				const workspaces = this.ctx.get("workspaces");
				if (workspaces === void 0) throw new Error("renderSlot('root') before the workspaces service mounted — boot order puts runtime apply first");
				const service = this;
				this._host = {
					subscribe: (key, fn) => this._core.subscribe(key, fn),
					getVersion: (key) => this._core.getVersion(key),
					entriesOf: (key) => this._core.entries(key),
					specOf: (key) => this._core.specDynamic(key),
					isLive: (entry) => this._core.isLive(entry),
					storeOf: (entry, scopeKey) => entry.store === void 0 ? void 0 : this.resolveStore(entry.store, scopeKey),
					sessions: {
						list: sessions.list,
						provideInfo: sessions.currentProvideInfo
					},
					workspaces: { list: workspaces.list },
					get locale() {
						return service._locale;
					}
				};
				return this._host;
			}
			/** Resolve (create or reuse) the store instance for a registered handle under a scope key. */
			resolveStore(handle, sessionId) {
				const record = this._stores.get(handle);
				if (record === void 0) throw new Error("store handle is not registered (entry unloaded, or the handle never went through register)");
				const key = record.scope === "root" ? ROOT_INSTANCE_KEY : sessionId;
				if (key === void 0) throw new Error(`${record.scope} store resolution requires a session id`);
				let instance = record.instances.get(key);
				if (instance === void 0) {
					instance = record.scope === "root" ? handle.create() : handle.create(key);
					record.instances.set(key, instance);
				}
				return instance;
			}
			/** Bind (or re-reference) a handle on the axis; cross-scope conflicts already threw in the core. */
			_acquire(handle, scope) {
				const record = this._stores.get(handle);
				if (record === void 0) {
					this._stores.set(handle, {
						scope,
						refs: 1,
						instances: /* @__PURE__ */ new Map()
					});
					return;
				}
				record.refs += 1;
			}
			/** Drop one reference; the last holder's unload drops the record (instances go with it — engine stores need no explicit dispose). */
			_release(handle) {
				const record = this._stores.get(handle);
				/* v8 ignore next -- defensive: release only runs from a disposer whose
				* register acquired the same handle, so the record must exist; kept so a
				* future call site cannot underflow the axis. */
				if (record === void 0) return;
				record.refs -= 1;
				if (record.refs === 0) this._stores.delete(handle);
			}
		};
		SlotsService.prototype.register = function register(rawOptions, component) {
			const options = rawOptions;
			return this.ctx.effect(() => this["_register"](options, component), "slots.register()");
		};
		//#endregion
		//#region ../../host/apiproxy/src/api/rpc.ts
		/**
		* Fold a transport exception into the RpcResult error branch (unified error
		* surface; 'internal' as the catch-all code). Lives with RpcResult so every
		* carrier consumer folds the same way.
		* @param error - the thrown value from the carrier.
		* @returns the error branch of an RpcResult.
		*/
		function transportError(error) {
			return {
				ok: false,
				error: {
					code: "internal",
					message: error instanceof Error ? error.message : String(error),
					details: {}
				}
			};
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/zustand@4.4.7_@types+react@18.3.31_immer@10.2.0_react@18.3.1/node_modules/zustand/esm/vanilla.mjs
		const createStoreImpl = (createState) => {
			let state;
			const listeners = /* @__PURE__ */ new Set();
			const setState = (partial, replace) => {
				const nextState = typeof partial === "function" ? partial(state) : partial;
				if (!Object.is(nextState, state)) {
					const previousState = state;
					state = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
					listeners.forEach((listener) => listener(state, previousState));
				}
			};
			const getState = () => state;
			const subscribe = (listener) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			};
			const destroy = () => {
				listeners.clear();
			};
			const api = {
				setState,
				getState,
				subscribe,
				destroy
			};
			state = createState(setState, getState, api);
			return api;
		};
		const createStore = (createState) => createState ? createStoreImpl(createState) : createStoreImpl;
		//#endregion
		//#region ../../../node_modules/.pnpm/zustand@4.4.7_@types+react@18.3.31_immer@10.2.0_react@18.3.1/node_modules/zustand/esm/middleware.mjs
		const subscribeWithSelectorImpl = (fn) => (set, get, api) => {
			const origSubscribe = api.subscribe;
			api.subscribe = (selector, optListener, options) => {
				let listener = selector;
				if (optListener) {
					const equalityFn = (options == null ? void 0 : options.equalityFn) || Object.is;
					let currentSlice = selector(api.getState());
					listener = (state) => {
						const nextSlice = selector(state);
						if (!equalityFn(currentSlice, nextSlice)) {
							const previousSlice = currentSlice;
							optListener(currentSlice = nextSlice, previousSlice);
						}
					};
					if (options == null ? void 0 : options.fireImmediately) optListener(currentSlice, currentSlice);
				}
				return origSubscribe(listener);
			};
			return fn(set, get, api);
		};
		const subscribeWithSelector = subscribeWithSelectorImpl;
		//#endregion
		//#region ../../../node_modules/.pnpm/zustand@4.4.7_@types+react@18.3.31_immer@10.2.0_react@18.3.1/node_modules/zustand/esm/shallow.mjs
		function shallow$1(objA, objB) {
			if (Object.is(objA, objB)) return true;
			if (typeof objA !== "object" || objA === null || typeof objB !== "object" || objB === null) return false;
			if (objA instanceof Map && objB instanceof Map) {
				if (objA.size !== objB.size) return false;
				for (const [key, value] of objA) if (!Object.is(value, objB.get(key))) return false;
				return true;
			}
			if (objA instanceof Set && objB instanceof Set) {
				if (objA.size !== objB.size) return false;
				for (const value of objA) if (!objB.has(value)) return false;
				return true;
			}
			const keysA = Object.keys(objA);
			if (keysA.length !== Object.keys(objB).length) return false;
			for (let i = 0; i < keysA.length; i++) if (!Object.prototype.hasOwnProperty.call(objB, keysA[i]) || !Object.is(objA[keysA[i]], objB[keysA[i]])) return false;
			return true;
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/immer@10.2.0/node_modules/immer/dist/immer.mjs
		var NOTHING = Symbol.for("immer-nothing");
		var DRAFTABLE = Symbol.for("immer-draftable");
		var DRAFT_STATE = Symbol.for("immer-state");
		function die(error, ...args) {
			throw new Error(`[Immer] minified error nr: ${error}. Full error at: https://bit.ly/3cXEKWf`);
		}
		var getPrototypeOf = Object.getPrototypeOf;
		function isDraft(value) {
			return !!value && !!value[DRAFT_STATE];
		}
		function isDraftable(value) {
			if (!value) return false;
			return isPlainObject(value) || Array.isArray(value) || !!value[DRAFTABLE] || !!value.constructor?.[DRAFTABLE] || isMap(value) || isSet(value);
		}
		var objectCtorString = Object.prototype.constructor.toString();
		var cachedCtorStrings = /* @__PURE__ */ new WeakMap();
		function isPlainObject(value) {
			if (!value || typeof value !== "object") return false;
			const proto = Object.getPrototypeOf(value);
			if (proto === null || proto === Object.prototype) return true;
			const Ctor = Object.hasOwnProperty.call(proto, "constructor") && proto.constructor;
			if (Ctor === Object) return true;
			if (typeof Ctor !== "function") return false;
			let ctorString = cachedCtorStrings.get(Ctor);
			if (ctorString === void 0) {
				ctorString = Function.toString.call(Ctor);
				cachedCtorStrings.set(Ctor, ctorString);
			}
			return ctorString === objectCtorString;
		}
		function each(obj, iter, strict = true) {
			if (getArchtype(obj) === 0) (strict ? Reflect.ownKeys(obj) : Object.keys(obj)).forEach((key) => {
				iter(key, obj[key], obj);
			});
			else obj.forEach((entry, index) => iter(index, entry, obj));
		}
		function getArchtype(thing) {
			const state = thing[DRAFT_STATE];
			return state ? state.type_ : Array.isArray(thing) ? 1 : isMap(thing) ? 2 : isSet(thing) ? 3 : 0;
		}
		function has(thing, prop) {
			return getArchtype(thing) === 2 ? thing.has(prop) : Object.prototype.hasOwnProperty.call(thing, prop);
		}
		function set(thing, propOrOldValue, value) {
			const t = getArchtype(thing);
			if (t === 2) thing.set(propOrOldValue, value);
			else if (t === 3) thing.add(value);
			else thing[propOrOldValue] = value;
		}
		function is(x, y) {
			if (x === y) return x !== 0 || 1 / x === 1 / y;
			else return x !== x && y !== y;
		}
		function isMap(target) {
			return target instanceof Map;
		}
		function isSet(target) {
			return target instanceof Set;
		}
		function latest(state) {
			return state.copy_ || state.base_;
		}
		function shallowCopy(base, strict) {
			if (isMap(base)) return new Map(base);
			if (isSet(base)) return new Set(base);
			if (Array.isArray(base)) return Array.prototype.slice.call(base);
			const isPlain = isPlainObject(base);
			if (strict === true || strict === "class_only" && !isPlain) {
				const descriptors = Object.getOwnPropertyDescriptors(base);
				delete descriptors[DRAFT_STATE];
				let keys = Reflect.ownKeys(descriptors);
				for (let i = 0; i < keys.length; i++) {
					const key = keys[i];
					const desc = descriptors[key];
					if (desc.writable === false) {
						desc.writable = true;
						desc.configurable = true;
					}
					if (desc.get || desc.set) descriptors[key] = {
						configurable: true,
						writable: true,
						enumerable: desc.enumerable,
						value: base[key]
					};
				}
				return Object.create(getPrototypeOf(base), descriptors);
			} else {
				const proto = getPrototypeOf(base);
				if (proto !== null && isPlain) return { ...base };
				return Object.assign(Object.create(proto), base);
			}
		}
		function freeze(obj, deep = false) {
			if (isFrozen(obj) || isDraft(obj) || !isDraftable(obj)) return obj;
			if (getArchtype(obj) > 1) Object.defineProperties(obj, {
				set: dontMutateMethodOverride,
				add: dontMutateMethodOverride,
				clear: dontMutateMethodOverride,
				delete: dontMutateMethodOverride
			});
			Object.freeze(obj);
			if (deep) Object.values(obj).forEach((value) => freeze(value, true));
			return obj;
		}
		function dontMutateFrozenCollections() {
			die(2);
		}
		var dontMutateMethodOverride = { value: dontMutateFrozenCollections };
		function isFrozen(obj) {
			if (obj === null || typeof obj !== "object") return true;
			return Object.isFrozen(obj);
		}
		var plugins = {};
		function getPlugin(pluginKey) {
			const plugin = plugins[pluginKey];
			if (!plugin) die(0, pluginKey);
			return plugin;
		}
		var currentScope;
		function getCurrentScope() {
			return currentScope;
		}
		function createScope$1(parent_, immer_) {
			return {
				drafts_: [],
				parent_,
				immer_,
				canAutoFreeze_: true,
				unfinalizedDrafts_: 0
			};
		}
		function usePatchesInScope(scope, patchListener) {
			if (patchListener) {
				getPlugin("Patches");
				scope.patches_ = [];
				scope.inversePatches_ = [];
				scope.patchListener_ = patchListener;
			}
		}
		function revokeScope(scope) {
			leaveScope(scope);
			scope.drafts_.forEach(revokeDraft);
			scope.drafts_ = null;
		}
		function leaveScope(scope) {
			if (scope === currentScope) currentScope = scope.parent_;
		}
		function enterScope(immer2) {
			return currentScope = createScope$1(currentScope, immer2);
		}
		function revokeDraft(draft) {
			const state = draft[DRAFT_STATE];
			if (state.type_ === 0 || state.type_ === 1) state.revoke_();
			else state.revoked_ = true;
		}
		function processResult(result, scope) {
			scope.unfinalizedDrafts_ = scope.drafts_.length;
			const baseDraft = scope.drafts_[0];
			if (result !== void 0 && result !== baseDraft) {
				if (baseDraft[DRAFT_STATE].modified_) {
					revokeScope(scope);
					die(4);
				}
				if (isDraftable(result)) {
					result = finalize(scope, result);
					if (!scope.parent_) maybeFreeze(scope, result);
				}
				if (scope.patches_) getPlugin("Patches").generateReplacementPatches_(baseDraft[DRAFT_STATE].base_, result, scope.patches_, scope.inversePatches_);
			} else result = finalize(scope, baseDraft, []);
			revokeScope(scope);
			if (scope.patches_) scope.patchListener_(scope.patches_, scope.inversePatches_);
			return result !== NOTHING ? result : void 0;
		}
		function finalize(rootScope, value, path) {
			if (isFrozen(value)) return value;
			const useStrictIteration = rootScope.immer_.shouldUseStrictIteration();
			const state = value[DRAFT_STATE];
			if (!state) {
				each(value, (key, childValue) => finalizeProperty(rootScope, state, value, key, childValue, path), useStrictIteration);
				return value;
			}
			if (state.scope_ !== rootScope) return value;
			if (!state.modified_) {
				maybeFreeze(rootScope, state.base_, true);
				return state.base_;
			}
			if (!state.finalized_) {
				state.finalized_ = true;
				state.scope_.unfinalizedDrafts_--;
				const result = state.copy_;
				let resultEach = result;
				let isSet2 = false;
				if (state.type_ === 3) {
					resultEach = new Set(result);
					result.clear();
					isSet2 = true;
				}
				each(resultEach, (key, childValue) => finalizeProperty(rootScope, state, result, key, childValue, path, isSet2), useStrictIteration);
				maybeFreeze(rootScope, result, false);
				if (path && rootScope.patches_) getPlugin("Patches").generatePatches_(state, path, rootScope.patches_, rootScope.inversePatches_);
			}
			return state.copy_;
		}
		function finalizeProperty(rootScope, parentState, targetObject, prop, childValue, rootPath, targetIsSet) {
			if (childValue == null) return;
			if (typeof childValue !== "object" && !targetIsSet) return;
			const childIsFrozen = isFrozen(childValue);
			if (childIsFrozen && !targetIsSet) return;
			if (isDraft(childValue)) {
				const res = finalize(rootScope, childValue, rootPath && parentState && parentState.type_ !== 3 && !has(parentState.assigned_, prop) ? rootPath.concat(prop) : void 0);
				set(targetObject, prop, res);
				if (isDraft(res)) rootScope.canAutoFreeze_ = false;
				else return;
			} else if (targetIsSet) targetObject.add(childValue);
			if (isDraftable(childValue) && !childIsFrozen) {
				if (!rootScope.immer_.autoFreeze_ && rootScope.unfinalizedDrafts_ < 1) return;
				if (parentState && parentState.base_ && parentState.base_[prop] === childValue && childIsFrozen) return;
				finalize(rootScope, childValue);
				if ((!parentState || !parentState.scope_.parent_) && typeof prop !== "symbol" && (isMap(targetObject) ? targetObject.has(prop) : Object.prototype.propertyIsEnumerable.call(targetObject, prop))) maybeFreeze(rootScope, childValue);
			}
		}
		function maybeFreeze(scope, value, deep = false) {
			if (!scope.parent_ && scope.immer_.autoFreeze_ && scope.canAutoFreeze_) freeze(value, deep);
		}
		function createProxyProxy(base, parent) {
			const isArray = Array.isArray(base);
			const state = {
				type_: isArray ? 1 : 0,
				scope_: parent ? parent.scope_ : getCurrentScope(),
				modified_: false,
				finalized_: false,
				assigned_: {},
				parent_: parent,
				base_: base,
				draft_: null,
				copy_: null,
				revoke_: null,
				isManual_: false
			};
			let target = state;
			let traps = objectTraps;
			if (isArray) {
				target = [state];
				traps = arrayTraps;
			}
			const { revoke, proxy } = Proxy.revocable(target, traps);
			state.draft_ = proxy;
			state.revoke_ = revoke;
			return proxy;
		}
		var objectTraps = {
			get(state, prop) {
				if (prop === DRAFT_STATE) return state;
				const source = latest(state);
				if (!has(source, prop)) return readPropFromProto(state, source, prop);
				const value = source[prop];
				if (state.finalized_ || !isDraftable(value)) return value;
				if (value === peek(state.base_, prop)) {
					prepareCopy(state);
					return state.copy_[prop] = createProxy(value, state);
				}
				return value;
			},
			has(state, prop) {
				return prop in latest(state);
			},
			ownKeys(state) {
				return Reflect.ownKeys(latest(state));
			},
			set(state, prop, value) {
				const desc = getDescriptorFromProto(latest(state), prop);
				if (desc?.set) {
					desc.set.call(state.draft_, value);
					return true;
				}
				if (!state.modified_) {
					const current2 = peek(latest(state), prop);
					const currentState = current2?.[DRAFT_STATE];
					if (currentState && currentState.base_ === value) {
						state.copy_[prop] = value;
						state.assigned_[prop] = false;
						return true;
					}
					if (is(value, current2) && (value !== void 0 || has(state.base_, prop))) return true;
					prepareCopy(state);
					markChanged(state);
				}
				if (state.copy_[prop] === value && (value !== void 0 || prop in state.copy_) || Number.isNaN(value) && Number.isNaN(state.copy_[prop])) return true;
				state.copy_[prop] = value;
				state.assigned_[prop] = true;
				return true;
			},
			deleteProperty(state, prop) {
				if (peek(state.base_, prop) !== void 0 || prop in state.base_) {
					state.assigned_[prop] = false;
					prepareCopy(state);
					markChanged(state);
				} else delete state.assigned_[prop];
				if (state.copy_) delete state.copy_[prop];
				return true;
			},
			getOwnPropertyDescriptor(state, prop) {
				const owner = latest(state);
				const desc = Reflect.getOwnPropertyDescriptor(owner, prop);
				if (!desc) return desc;
				return {
					writable: true,
					configurable: state.type_ !== 1 || prop !== "length",
					enumerable: desc.enumerable,
					value: owner[prop]
				};
			},
			defineProperty() {
				die(11);
			},
			getPrototypeOf(state) {
				return getPrototypeOf(state.base_);
			},
			setPrototypeOf() {
				die(12);
			}
		};
		var arrayTraps = {};
		each(objectTraps, (key, fn) => {
			arrayTraps[key] = function() {
				arguments[0] = arguments[0][0];
				return fn.apply(this, arguments);
			};
		});
		arrayTraps.deleteProperty = function(state, prop) {
			return arrayTraps.set.call(this, state, prop, void 0);
		};
		arrayTraps.set = function(state, prop, value) {
			return objectTraps.set.call(this, state[0], prop, value, state[0]);
		};
		function peek(draft, prop) {
			const state = draft[DRAFT_STATE];
			return (state ? latest(state) : draft)[prop];
		}
		function readPropFromProto(state, source, prop) {
			const desc = getDescriptorFromProto(source, prop);
			return desc ? `value` in desc ? desc.value : desc.get?.call(state.draft_) : void 0;
		}
		function getDescriptorFromProto(source, prop) {
			if (!(prop in source)) return void 0;
			let proto = getPrototypeOf(source);
			while (proto) {
				const desc = Object.getOwnPropertyDescriptor(proto, prop);
				if (desc) return desc;
				proto = getPrototypeOf(proto);
			}
		}
		function markChanged(state) {
			if (!state.modified_) {
				state.modified_ = true;
				if (state.parent_) markChanged(state.parent_);
			}
		}
		function prepareCopy(state) {
			if (!state.copy_) state.copy_ = shallowCopy(state.base_, state.scope_.immer_.useStrictShallowCopy_);
		}
		var Immer2 = class {
			constructor(config) {
				this.autoFreeze_ = true;
				this.useStrictShallowCopy_ = false;
				this.useStrictIteration_ = true;
				/**
				* The `produce` function takes a value and a "recipe function" (whose
				* return value often depends on the base state). The recipe function is
				* free to mutate its first argument however it wants. All mutations are
				* only ever applied to a __copy__ of the base state.
				*
				* Pass only a function to create a "curried producer" which relieves you
				* from passing the recipe function every time.
				*
				* Only plain objects and arrays are made mutable. All other objects are
				* considered uncopyable.
				*
				* Note: This function is __bound__ to its `Immer` instance.
				*
				* @param {any} base - the initial state
				* @param {Function} recipe - function that receives a proxy of the base state as first argument and which can be freely modified
				* @param {Function} patchListener - optional function that will be called with all the patches produced here
				* @returns {any} a new state, or the initial state if nothing was modified
				*/
				this.produce = (base, recipe, patchListener) => {
					if (typeof base === "function" && typeof recipe !== "function") {
						const defaultBase = recipe;
						recipe = base;
						const self = this;
						return function curriedProduce(base2 = defaultBase, ...args) {
							return self.produce(base2, (draft) => recipe.call(this, draft, ...args));
						};
					}
					if (typeof recipe !== "function") die(6);
					if (patchListener !== void 0 && typeof patchListener !== "function") die(7);
					let result;
					if (isDraftable(base)) {
						const scope = enterScope(this);
						const proxy = createProxy(base, void 0);
						let hasError = true;
						try {
							result = recipe(proxy);
							hasError = false;
						} finally {
							if (hasError) revokeScope(scope);
							else leaveScope(scope);
						}
						usePatchesInScope(scope, patchListener);
						return processResult(result, scope);
					} else if (!base || typeof base !== "object") {
						result = recipe(base);
						if (result === void 0) result = base;
						if (result === NOTHING) result = void 0;
						if (this.autoFreeze_) freeze(result, true);
						if (patchListener) {
							const p = [];
							const ip = [];
							getPlugin("Patches").generateReplacementPatches_(base, result, p, ip);
							patchListener(p, ip);
						}
						return result;
					} else die(1, base);
				};
				this.produceWithPatches = (base, recipe) => {
					if (typeof base === "function") return (state, ...args) => this.produceWithPatches(state, (draft) => base(draft, ...args));
					let patches, inversePatches;
					return [
						this.produce(base, recipe, (p, ip) => {
							patches = p;
							inversePatches = ip;
						}),
						patches,
						inversePatches
					];
				};
				if (typeof config?.autoFreeze === "boolean") this.setAutoFreeze(config.autoFreeze);
				if (typeof config?.useStrictShallowCopy === "boolean") this.setUseStrictShallowCopy(config.useStrictShallowCopy);
				if (typeof config?.useStrictIteration === "boolean") this.setUseStrictIteration(config.useStrictIteration);
			}
			createDraft(base) {
				if (!isDraftable(base)) die(8);
				if (isDraft(base)) base = current(base);
				const scope = enterScope(this);
				const proxy = createProxy(base, void 0);
				proxy[DRAFT_STATE].isManual_ = true;
				leaveScope(scope);
				return proxy;
			}
			finishDraft(draft, patchListener) {
				const state = draft && draft[DRAFT_STATE];
				if (!state || !state.isManual_) die(9);
				const { scope_: scope } = state;
				usePatchesInScope(scope, patchListener);
				return processResult(void 0, scope);
			}
			/**
			* Pass true to automatically freeze all copies created by Immer.
			*
			* By default, auto-freezing is enabled.
			*/
			setAutoFreeze(value) {
				this.autoFreeze_ = value;
			}
			/**
			* Pass true to enable strict shallow copy.
			*
			* By default, immer does not copy the object descriptors such as getter, setter and non-enumrable properties.
			*/
			setUseStrictShallowCopy(value) {
				this.useStrictShallowCopy_ = value;
			}
			/**
			* Pass false to use faster iteration that skips non-enumerable properties
			* but still handles symbols for compatibility.
			*
			* By default, strict iteration is enabled (includes all own properties).
			*/
			setUseStrictIteration(value) {
				this.useStrictIteration_ = value;
			}
			shouldUseStrictIteration() {
				return this.useStrictIteration_;
			}
			applyPatches(base, patches) {
				let i;
				for (i = patches.length - 1; i >= 0; i--) {
					const patch = patches[i];
					if (patch.path.length === 0 && patch.op === "replace") {
						base = patch.value;
						break;
					}
				}
				if (i > -1) patches = patches.slice(i + 1);
				const applyPatchesImpl = getPlugin("Patches").applyPatches_;
				if (isDraft(base)) return applyPatchesImpl(base, patches);
				return this.produce(base, (draft) => applyPatchesImpl(draft, patches));
			}
		};
		function createProxy(value, parent) {
			const draft = isMap(value) ? getPlugin("MapSet").proxyMap_(value, parent) : isSet(value) ? getPlugin("MapSet").proxySet_(value, parent) : createProxyProxy(value, parent);
			(parent ? parent.scope_ : getCurrentScope()).drafts_.push(draft);
			return draft;
		}
		function current(value) {
			if (!isDraft(value)) die(10, value);
			return currentImpl(value);
		}
		function currentImpl(value) {
			if (!isDraftable(value) || isFrozen(value)) return value;
			const state = value[DRAFT_STATE];
			let copy;
			let strict = true;
			if (state) {
				if (!state.modified_) return state.base_;
				state.finalized_ = true;
				copy = shallowCopy(value, state.scope_.immer_.useStrictShallowCopy_);
				strict = state.scope_.immer_.shouldUseStrictIteration();
			} else copy = shallowCopy(value, true);
			each(copy, (key, childValue) => {
				set(copy, key, currentImpl(childValue));
			}, strict);
			if (state) state.finalized_ = false;
			return copy;
		}
		var produce = new Immer2().produce;
		//#endregion
		//#region src/client/contract/store.ts
		/**
		* Snapshot store engine (zustand vanilla + immer + subscribeWithSelector +
		* rafFlush middleware + opt-in persist + dev freeze) plus the declarative
		* shell over it: {@link defineStore} bakes an init/persist/actions literal
		* into a {@link StoreHandle}, the registration-side store seat of the slot
		* terminal design (§4). Lives in the React-free runtime (store-migration
		* ruling: the data layer owns its engine; web-react is shell-only React
		* glue): engine products are bare observables — subscribe/getSnapshot/
		* update/set, NO selector hook. Hook synthesis is web-react's (the one
		* uSES bridge, cached per source at the binding site).
		*/
		/**
		* Shallow equality for selector slices (zustand/shallow semantics; travels
		* with the engine so hook consumers need no zustand dependency).
		* @param a - left value.
		* @param b - right value.
		* @returns whether the values are shallowly equal.
		*/
		function shallowEqual(a, b) {
			return shallow$1(a, b);
		}
		/** Batches subscriber notification into one flush per animation frame. */
		function rafBatch(notify) {
			const schedule = typeof requestAnimationFrame === "function" ? (fn) => {
				requestAnimationFrame(() => {
					fn();
				});
			} : (fn) => {
				queueMicrotask(fn);
			};
			let scheduled = false;
			return () => {
				if (scheduled) return;
				scheduled = true;
				schedule(() => {
					scheduled = false;
					notify();
				});
			};
		}
		/**
		* Create a snapshot store.
		*
		* Flush default is 'sync' (controlled inputs need same-tick echo); frame-driven
		* stores opt into 'raf', where a frame's worth of updates coalesces into one
		* notification. Known raf-mode tradeoff: a component mounting mid-frame reads
		* fresh state while existing subscribers hear it next flush — transient
		* frame-level skew, same nature as the object layer's microtask batching.
		*
		* @param init - initial state.
		* @param opts - flush mode and opt-in persistence (localStorage, keyed by name).
		* @returns the store.
		*/
		function createSnapshotStore(init, opts) {
			const withSelector = subscribeWithSelector(() => init);
			const api = createStore()(withSelector);
			if (opts?.persist) attachPersistence(api, opts.persist.name);
			let subscribe = (fn) => api.subscribe(fn);
			if (opts?.flush === "raf") {
				const listeners = /* @__PURE__ */ new Set();
				const flush = rafBatch(() => {
					for (const fn of [...listeners]) fn();
				});
				api.subscribe(flush);
				subscribe = (fn) => {
					listeners.add(fn);
					return () => {
						listeners.delete(fn);
					};
				};
			}
			return {
				getSnapshot: () => {
					return api.getState();
				},
				subscribe: (fn) => subscribe(fn),
				update: (mutator) => {
					api.setState(produce(api.getState(), (draft) => {
						mutator(draft);
					}), true);
				},
				set: (next) => {
					api.setState(devFreeze(next), true);
				}
			};
		}
		/**
		* Whole-value JSON persistence to localStorage. Hand-rolled instead of the
		* zustand persist middleware: its write path spreads state into an object
		* (`partialize({ ...get() })`), exploding primitive state (a persisted string
		* draft becomes {0:'h',1:'e',...}) — not fixable via merge/deserialize options
		* because the corruption happens before serialization. Storage failures
		* (quota, private mode) only disable persistence, never break the store.
		*/
		function attachPersistence(api, name) {
			if (typeof localStorage === "undefined") return;
			try {
				const raw = localStorage.getItem(name);
				if (raw !== null) api.setState(devFreeze(JSON.parse(raw)), true);
			} catch (error) {
				console.error(`snapshot store '${name}' rehydration failed:`, error);
			}
			api.subscribe((state) => {
				try {
					localStorage.setItem(name, JSON.stringify(state));
				} catch (error) {
					console.error(`snapshot store '${name}' persistence failed:`, error);
				}
			});
		}
		/** Deep-freeze wholesale-set state outside production: set() bypasses immer's freeze. */
		function devFreeze(value) {
			return value;
		}
		/**
		* Declare a store: initial state, optional persistence, and the full write
		* set as pure draft mutators. The returned handle is the registration
		* currency of the store seat — its identity keys instance sharing. Satisfies
		* ui-slots' DefineStore contract (the handle/instance are the engine-extended
		* subtypes).
		*
		* The `A & ActionsDecl<T>` actions position is load-bearing: T resolves from
		* `init` in the first inference round, and the intersection then contextually
		* types each mutator's draft parameter (context-sensitive functions defer),
		* so call sites write `(d, x: X) => { ... }` with no draft annotation. If a
		* future TS version breaks this single-literal inference, the design's
		* documented fallback is currying (`defineStore(init).actions({...})`).
		* @param decl - init lambda (fresh state per instance), optional persist key, actions table.
		* @returns the store handle.
		*/
		function defineStore(decl) {
			return {
				spec: decl,
				create(scopeKey) {
					const persistKey = decl.persist === void 0 ? void 0 : scopeKey === void 0 ? decl.persist : `${decl.persist}.${scopeKey}`;
					const store = createSnapshotStore(decl.init(), persistKey !== void 0 ? { persist: { name: persistKey } } : void 0);
					const actions = {};
					for (const key of Object.keys(decl.actions)) {
						const mutate = decl.actions[key];
						actions[key] = (...params) => {
							store.update((draft) => {
								mutate(draft, ...params);
							});
						};
					}
					return {
						actions,
						getSnapshot: () => store.getSnapshot(),
						subscribe: (fn) => store.subscribe(fn),
						store,
						clearPersisted: () => {
							if (persistKey === void 0 || typeof localStorage === "undefined") return;
							try {
								localStorage.removeItem(persistKey);
							} catch {}
						}
					};
				}
			};
		}
		//#endregion
		//#region src/client/agents/scope.ts
		/**
		* Client Agent-scope primitive: mint a Cordis context tagged with the owning
		* Agent's identity. The mechanism mirrors the host `dsh-scope` architecture
		* (no-op plugin fiber + context tag + `Context.filter` routing predicate);
		* the shape deliberately diverges: the filter lives on the actx itself
		* instead of a separate carrier object, so scoped dispatch is plain cordis —
		* `actx.bail(actx, event, payload)` / `actx.emit(actx, ...)` — with no
		* wrapper. The host needs a detached carrier because its dispatch subject is
		* the business Agent object; client scope events carry only ids, so the
		* actx is the natural subject. The second divergence stands: the scope key
		* is the branded `SessionId` (value compared), not an object identity — the
		* agent and its session share one id (1:1, same axis; no separate AgentId
		* brand), and a client scope's identity IS that wire id. Third divergence,
		* deliberate: the client scopes the Agent IDENTITY, not a live Agent object
		* — a cold session's host Agent is already disposed while its client actx
		* stays alive for history viewing.
		*/
		/** Context tag written by {@link createScope}. */
		const kScope = Symbol("dsh.client.scope");
		/** Shared no-op plugin backing each Agent scope fiber. */
		function agentScope() {}
		/**
		* Mint an Agent scope under `ctx`: a no-op plugin fiber whose context
		* carries the agent tag and the dispatch filter — untagged listeners are
		* admitted globally, tagged listeners only for a matching agent.
		* Registrations through the returned ctx dispose with the fiber.
		* @param ctx - client root context the scope fiber mounts under.
		* @param key - owning agent identity (the routing tag; agent id === session id).
		* @returns the tagged context and its backing fiber.
		*/
		function createScope(ctx, key) {
			const fiber = ctx.plugin(agentScope);
			return {
				fiber,
				ctx: fiber.ctx.extend({
					[kScope]: key,
					[cordis.Context.filter](listenerCtx) {
						const tag = scopeOf(listenerCtx);
						return tag === void 0 || tag === key;
					}
				})
			};
		}
		/**
		* Read the nearest agent tag inherited by a context.
		* @param ctx - any client context.
		* @returns its agent identity (the session id), or undefined for root contexts.
		*/
		function scopeOf(ctx) {
			return ctx[kScope];
		}
		//#endregion
		//#region src/client/ordered-baseline.ts
		/**
		* Merge an authoritative baseline without moving identities already visible to
		* the client. Baseline-only identities are inserted relative to the nearest
		* following known identity; identities absent from the baseline are removed.
		*
		* @param current - the established client order.
		* @param baseline - the latest authoritative rows.
		* @param keyOf - stable identity selector.
		* @returns baseline-valued rows with the established relative order retained.
		*/
		function mergeOrderedBaseline(current, baseline, keyOf) {
			const baselineByKey = /* @__PURE__ */ new Map();
			for (const value of baseline) baselineByKey.set(keyOf(value), value);
			const merged = current.map((value) => baselineByKey.get(keyOf(value))).filter((value) => {
				return value !== void 0;
			});
			const mergedKeys = new Set(merged.map(keyOf));
			for (let index = 0; index < baseline.length; index++) {
				const value = baseline[index];
				/* v8 ignore next -- dense-array guard: index is bounded by baseline.length. */
				if (value === void 0 || mergedKeys.has(keyOf(value))) continue;
				let insertion = merged.length;
				for (let following = index + 1; following < baseline.length; following++) {
					const candidate = baseline[following];
					/* v8 ignore next -- dense-array guard: following is bounded by baseline.length. */
					if (candidate === void 0) continue;
					const known = merged.findIndex((item) => keyOf(item) === keyOf(candidate));
					if (known !== -1) {
						insertion = known;
						break;
					}
				}
				merged.splice(insertion, 0, value);
				mergedKeys.add(keyOf(value));
			}
			return merged;
		}
		//#endregion
		//#region src/client/sessions/lineage.ts
		/**
		* Summaries -> flat list with lineage indentation. Root and sibling order
		* follows the established input order; this projection never re-sorts a
		* hydrated list from mutable timestamps.
		* @param summaries - the host's session.list items.
		* @param pendingInteractions - current manager-owned interaction status by session.
		* @param completed - sessions with a pending completion reminder (manager-owned live fact; absent = false).
		* @returns display rows in render order.
		*/
		function flattenLineage(summaries, pendingInteractions, completed) {
			const byId = /* @__PURE__ */ new Map();
			for (const s of summaries) byId.set(s.sessionId, s);
			const children = /* @__PURE__ */ new Map();
			const roots = [];
			for (const s of summaries) if (s.parentSessionId !== void 0 && byId.has(s.parentSessionId)) {
				const list = children.get(s.parentSessionId) ?? [];
				list.push(s);
				children.set(s.parentSessionId, list);
			} else roots.push(s);
			const out = [];
			const visited = /* @__PURE__ */ new Set();
			const walk = (s, depth) => {
				if (visited.has(s.sessionId)) {
					console.warn(`[web-runtime] lineage cycle at ${s.sessionId}; emitting as root`);
					return;
				}
				visited.add(s.sessionId);
				const pendingInteraction = pendingInteractions?.get(s.sessionId);
				out.push({
					...s,
					...pendingInteraction === void 0 ? {} : { pendingInteraction },
					completed: completed?.has(s.sessionId) ?? false,
					depth
				});
				const kids = children.get(s.sessionId);
				if (kids === void 0) return;
				for (const kid of kids) walk(kid, depth + 1);
			};
			for (const root of roots) walk(root, 0);
			for (const s of summaries) if (!visited.has(s.sessionId)) walk(s, 0);
			return out;
		}
		//#endregion
		//#region src/client/sessions/notifier.ts
		/** Subscription + batched notification primitive (shared by Session and SessionManager). */
		var Notifier = class {
			rebuild;
			listeners = /* @__PURE__ */ new Set();
			dirty = false;
			notifyPending = false;
			scheduled = "none";
			scheduleGeneration = 0;
			/** @param rebuild - snapshot rebuild function injected by the owner (writes the owner's snapshotCache). */
			constructor(rebuild) {
				this.rebuild = rebuild;
			}
			/**
			* uSES subscription entry.
			* @param listener - change callback.
			* @returns the unsubscribe function.
			*/
			subscribe(listener) {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			}
			/** State-change entry: mark dirty and schedule the batched flush. */
			markDirty() {
				this.dirty = true;
				this.notifyPending = true;
				if (this.scheduled === "microtask") return;
				this.schedule("microtask");
			}
			/** Stream-change entry: mark dirty and publish the cumulative state at most once per frame. */
			markFrameDirty() {
				this.dirty = true;
				this.notifyPending = true;
				if (this.scheduled !== "none") return;
				this.schedule(typeof globalThis.requestAnimationFrame === "function" ? "frame" : "microtask");
			}
			/**
			* Synchronous flush: controlled-input writes must notify in the same tick as
			* onChange, or React rolls the DOM back to the stale value and the caret jumps to the end.
			*/
			notifyNow() {
				this.dirty = true;
				this.notifyPending = true;
				this.invalidateSchedule();
				this.flush();
			}
			/**
			* Pre-getSnapshot check: rebuild synchronously when dirty (read path
			* before first subscribe / while unobserved). Notification stays pending.
			*/
			ensureFresh() {
				if (!this.dirty) return;
				this.dirty = false;
				this.rebuild();
			}
			schedule(kind) {
				const generation = ++this.scheduleGeneration;
				this.scheduled = kind;
				const publish = () => {
					if (generation !== this.scheduleGeneration) return;
					this.scheduled = "none";
					this.flush();
				};
				if (kind === "frame") globalThis.requestAnimationFrame(publish);
				else queueMicrotask(publish);
			}
			invalidateSchedule() {
				this.scheduleGeneration++;
				this.scheduled = "none";
			}
			flush() {
				if (!this.notifyPending) return;
				if (this.listeners.size === 0) return;
				this.notifyPending = false;
				if (this.dirty) {
					this.dirty = false;
					this.rebuild();
				}
				for (const listener of this.listeners) listener();
			}
		};
		//#endregion
		//#region src/client/sessions/projection-store.ts
		/**
		* One session's projection values. Framework semantics, uniform across every
		* key: a baseline seeds rows at its cut, a push frame updates one row, and in
		* both paths a lower-or-equal seq loses — a replayed frame cannot regress a
		* value, a stale baseline cannot overwrite a newer frame. A key the store has
		* never seen reads `undefined` (capability absent). Faces are identity-stable
		* per key (create-on-demand, cached) so the React side binds each exactly
		* once; the store-level channel (`subscribeAny`) serves coarse consumers (the
		* manager's list projection reads the `title` key).
		*/
		var ProjectionValueStore = class {
			rows = /* @__PURE__ */ new Map();
			channels = /* @__PURE__ */ new Map();
			valuesCache;
			/** Coarse any-key channel (no snapshot cache to rebuild: reads hit rows directly). */
			anyNotifier = new Notifier(() => {});
			/**
			* Key-addressed bare observable face (the useProjection resolution path).
			* Always defined — absence is an `undefined` snapshot, never a missing
			* face, so a component may subscribe before the key ever carries a value.
			* @param key - projection key.
			* @returns the identity-stable face for this key.
			*/
			faceOf(key) {
				return this.channel(key).face;
			}
			/**
			* Current whole value for a key (erased framework read; typed reads go
			* through `useProjection`'s map lookup).
			* @param key - projection key.
			* @returns the value, or undefined while the key is absent.
			*/
			get(key) {
				return this.rows.get(key)?.value;
			}
			/**
			* Read every current projection value as one reference-stable snapshot.
			* @returns The same frozen value map until a row changes.
			*/
			values() {
				if (this.valuesCache === void 0) this.valuesCache = Object.freeze(Object.fromEntries([...this.rows].map(([key, row]) => [key, row.value])));
				return this.valuesCache;
			}
			/**
			* Subscribe to any-key changes (microtask-batched) — the manager's list
			* rebuild channel.
			* @param listener - change callback.
			* @returns the unsubscribe function.
			*/
			subscribeAny(listener) {
				return this.anyNotifier.subscribe(listener);
			}
			/**
			* Apply one finished value (the `session/projection` push-frame path).
			* @param key - projection key.
			* @param value - whole value computed by the host unit.
			* @param seq - the unit's watermark at emission.
			*/
			apply(key, value, seq) {
				const row = this.rows.get(key);
				if (row !== void 0 && seq <= row.seq) return;
				this.rows.set(key, {
					value,
					seq
				});
				this.changed(key);
			}
			/**
			* Seed from a history tail page's projections block: every carried key
			* lands under the same seq rule as frames; a key the block omits is
			* capability-absent as of the cut — its row clears unless a newer frame
			* already superseded the cut (a stale baseline can neither overwrite nor
			* clear newer values).
			* @param baseline - the response's projections block.
			*/
			seed(baseline) {
				const values = baseline.values;
				for (const key of Object.keys(values)) this.apply(key, values[key], baseline.asOfSeq);
				for (const [key, row] of this.rows) {
					if (Object.hasOwn(values, key)) continue;
					if (row.seq > baseline.asOfSeq) continue;
					this.rows.delete(key);
					this.changed(key);
				}
			}
			/**
			* Drop rows past a mux-generation baseline (`session/subscribed.lastSeq`):
			* a row claiming knowledge beyond the host's own durable baseline rode
			* state a restart lost — under last-wins it would wrongly outrank the
			* host's recomputed (lower-seq) values forever. Durable replay and the next
			* baseline re-seed whatever truly survived (the title-snapshot precedent,
			* generalized).
			* @param lastSeq - the subscribed frame's durable baseline seq.
			*/
			truncate(lastSeq) {
				for (const [key, row] of this.rows) {
					if (row.seq <= lastSeq) continue;
					this.rows.delete(key);
					this.changed(key);
				}
			}
			changed(key) {
				this.valuesCache = void 0;
				this.channels.get(key)?.notifier.markDirty();
				this.anyNotifier.markDirty();
			}
			channel(key) {
				let channel = this.channels.get(key);
				if (channel === void 0) {
					const notifier = new Notifier(() => {});
					channel = {
						notifier,
						face: {
							getSnapshot: () => {
								return this.rows.get(key)?.value;
							},
							subscribe: (listener) => notifier.subscribe(listener)
						}
					};
					this.channels.set(key, channel);
				}
				return channel;
			}
		};
		//#endregion
		//#region src/client/sessions/pending.ts
		/** Key prefixes, one per kind (the key doubles as the Session pending-map key). */
		const KEY_PREFIX = {
			approval: "a",
			question: "q"
		};
		/**
		* One pending host-owned interaction wait: an immutable render face
		* (kind/key/sessionId/payload) plus the response carrier. respond() backfills
		* the requested frame's rpcId into a client-response envelope — no consumer
		* ever sees the raw rpcId. Settlement is expressed only by pending-list
		* membership (the settled flag is a fail-loud guard, not a render input).
		*/
		var PendingWait = class {
			/** Interaction kind (union discriminant). */
			kind;
			/** Opaque render identity, `<prefix>:<rpcId>` — stable across baseline replay, usable as a React key. */
			key;
			/** Owning session. */
			sessionId;
			/** The requested frame's domain fields, verbatim. */
			payload;
			#settled = false;
			#rpcId;
			#respond;
			/**
			* Minted by Session on a requested frame (public construction is the test-fixture path).
			* @param kind - interaction kind.
			* @param rpcId - the requested frame's stable envelope id (kept private; respond echoes it).
			* @param sessionId - owning session.
			* @param payload - the requested frame's domain fields.
			* @param respond - the client-response carrier (api.respond).
			*/
			constructor(kind, rpcId, sessionId, payload, respond) {
				this.kind = kind;
				this.key = `${KEY_PREFIX[kind]}:${rpcId}`;
				this.sessionId = sessionId;
				this.payload = payload;
				this.#rpcId = rpcId;
				this.#respond = respond;
			}
			/**
			* Send a result for this wait: wraps it into the client-response envelope
			* with the rpcId backfilled. Throws synchronously once settled.
			* @param result - the result shell (ok value / error envelope), domain-encoded by the caller.
			* @returns the carrier receipt.
			*/
			respond(result) {
				if (this.#settled) throw new Error(`pending wait ${this.key} is already settled`);
				return this.#respond({
					type: "client-response",
					rpcId: this.#rpcId,
					result
				});
			}
			/** Session-only settlement mark (the authoritative resolved frame arrived); respond() throws afterwards. */
			markSettled() {
				this.#settled = true;
			}
		};
		//#endregion
		//#region ../../core/session/src/surface.ts
		/** Runtime counterpart of the message-producing event union. */
		const SURFACE_EVENT_TYPES = new Set([
			"user/message",
			"assistant/message",
			"tool/result"
		]);
		/**
		* Whether an event type can join the model-visible surface.
		* @param type - event type to test.
		* @returns true for one of the three message-producing event types.
		*/
		function isSurfaceEligibleType(type) {
			return SURFACE_EVENT_TYPES.has(type);
		}
		/**
		* Narrow an event to a surface-eligible event carrying its required marker.
		* @param event - event to test.
		* @returns true when both the type and marker identify a surface event.
		*/
		function isSurfaceEvent(event) {
			if (!SURFACE_EVENT_TYPES.has(event.type)) return false;
			return event.surfaceOp !== void 0;
		}
		/**
		* Narrow an event to an append-origin surface event: one that entered the
		* surface at its own log position and was never itself a replacement copy.
		*
		* The model-visible surface deliberately shadows replaced ranges, so it is the
		* wrong source for a human transcript — a landed replacement would erase
		* conversation the user already saw. Append-origin events are that transcript's
		* durable source material; replacement copies stay model-only.
		* @param event - event to test.
		* @returns true when the event appended to the surface tail.
		*/
		function isAppendSurfaceEvent(event) {
			return isSurfaceEvent(event) && event.surfaceOp === "append";
		}
		/**
		* Narrow an event to a surface replacement: a node that shadowed an existing
		* surface range instead of appending to the tail. The counterpart of
		* {@link isAppendSurfaceEvent} over the two {@link SurfaceOp} variants.
		* @param event - event to test.
		* @returns true when the event replaced a surface range.
		*/
		function isReplacementSurfaceEvent(event) {
			return isSurfaceEvent(event) && event.surfaceOp !== "append";
		}
		/** Create an empty surface fold state. */
		function createFoldState() {
			return {
				nodes: [],
				replaceGeneration: 0
			};
		}
		/** Whether a runtime value is a non-negative safe event sequence. */
		function isEventSeq(value) {
			return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
		}
		/** Whether a runtime value is the exact positional-replacement shape. */
		function isReplaceOp(value) {
			const op = value;
			return Object.keys(op).length === 3 && Object.hasOwn(op, "op") && Object.hasOwn(op, "start") && Object.hasOwn(op, "end") && op["op"] === "replace" && isEventSeq(op["start"]) && isEventSeq(op["end"]);
		}
		/** Validate event-local surface eligibility and return its operation. */
		function surfaceOpOf(event) {
			const raw = event;
			if (!isSurfaceEligibleType(event.type)) {
				if (raw.surfaceOp !== void 0) throw new Error(`session event "${event.type}" is not surface-eligible and cannot carry surfaceOp`);
				if (raw.sourceEventSeqs !== void 0) throw new Error(`session event "${event.type}" is not surface-eligible and cannot carry sourceEventSeqs`);
				return;
			}
			const op = raw.surfaceOp;
			if (op === void 0) throw new Error(`session event "${event.type}" is surface-eligible and requires a surfaceOp marker`);
			if (op === "append") return op;
			if (op === null || typeof op !== "object" || Array.isArray(op)) throw new Error(`session event "${event.type}" carries an invalid surfaceOp`);
			if (!isReplaceOp(op)) throw new Error(`session event "${event.type}" carries an invalid replace surfaceOp`);
			return op;
		}
		/** Validate provenance against prior log entries and the replacement range. */
		function assertProvenance(event, shadowedSeqs) {
			const raw = event.sourceEventSeqs;
			const sources = /* @__PURE__ */ new Set();
			if (raw !== void 0) {
				if (!Array.isArray(raw)) throw new Error(`sourceEventSeqs on event at seq ${event.seq} must be an array when present`);
				if (raw.length === 0 && event.type !== "assistant/message") throw new Error("sourceEventSeqs must not be empty except on assistant/message");
				let nonEarlierSource;
				for (const source of raw) {
					if (!isEventSeq(source)) throw new Error(`session event "${event.type}" sourceEventSeqs must densely contain non-negative safe integers`);
					sources.add(source);
					if (nonEarlierSource === void 0 && source >= event.seq) nonEarlierSource = source;
				}
				if (sources.size !== raw.length) throw new Error("sourceEventSeqs must not contain duplicates");
				if (nonEarlierSource !== void 0) throw new Error(`sourceEventSeqs must reference earlier events: ${nonEarlierSource} >= current seq ${event.seq}`);
			}
			const missing = shadowedSeqs.filter((seq) => !sources.has(seq));
			if (missing.length > 0) throw new Error(`surface replace: sourceEventSeqs must include every shadowed surface node; missing ${missing.join(", ")}`);
		}
		/** Locate one replacement range without mutating the current fold state. */
		function replacementRange(state, op) {
			const startIdx = state.nodes.indexOf(op.start);
			if (startIdx === -1) throw new Error(`surface replace: start seq ${op.start} not found in surface`);
			const endIdx = state.nodes.indexOf(op.end);
			if (endIdx === -1) throw new Error(`surface replace: end seq ${op.end} not found in surface`);
			if (startIdx > endIdx) throw new Error(`surface replace: start seq ${op.start} (index ${startIdx}) is after end seq ${op.end} (index ${endIdx})`);
			return {
				startIdx,
				endIdx,
				shadowedSeqs: state.nodes.slice(startIdx, endIdx + 1)
			};
		}
		/**
		* Deep structural equality over the session-event JSON value domain
		* (null/boolean/number/string, arrays, plain objects). Replaces
		* `node:util`'s isDeepStrictEqual to keep this module browser-safe.
		*/
		function isDeepEqualJson(a, b) {
			if (a === b) return true;
			if (Array.isArray(a) || Array.isArray(b)) {
				if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
				return a.every((item, i) => {
					return isDeepEqualJson(item, b[i]);
				});
			}
			if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
			const aKeys = Object.keys(a);
			const bRecord = b;
			if (aKeys.length !== Object.keys(b).length) return false;
			return aKeys.every((key) => Object.hasOwn(b, key) && isDeepEqualJson(a[key], bRecord[key]));
		}
		/** Restrict a tool-result replacement to one current result's content. */
		function assertToolResultRewrite(event, shadowedSeqs, events, baseSeq) {
			if (event.type !== "tool/result") return;
			if (shadowedSeqs.length !== 1) throw new Error("tool/result surface replacement must rewrite exactly one current node");
			for (const originalSeq of shadowedSeqs) {
				const original = events[originalSeq - baseSeq];
				if (original?.type !== "tool/result") throw new Error("tool/result surface replacement must target a current tool/result");
				const originalRest = { ...original.data };
				const replacementRest = { ...event.data };
				const originalResult = original.data.message.content[0];
				const replacementResult = event.data.message.content[0];
				originalRest["message"] = {
					...original.data.message,
					content: [{
						...originalResult,
						content: null
					}]
				};
				replacementRest["message"] = {
					...event.data.message,
					content: [{
						...replacementResult,
						content: null
					}]
				};
				if (!isDeepEqualJson(originalRest, replacementRest)) throw new Error("tool/result surface replacement may change only content");
			}
		}
		/** Validate one event at its replay boundary and prepare its atomic fold transition. */
		function planSurfaceEvent(state, event, expectedSeq, events, baseSeq) {
			if (event.seq !== expectedSeq) throw new Error(`session event seq ${event.seq} is not contiguous; expected ${expectedSeq}`);
			const surfaceOp = surfaceOpOf(event);
			if (surfaceOp === void 0) return;
			if (surfaceOp === "append") {
				assertProvenance(event, []);
				return {
					kind: "append",
					seq: event.seq
				};
			}
			const range = replacementRange(state, surfaceOp);
			assertProvenance(event, range.shadowedSeqs);
			assertToolResultRewrite(event, range.shadowedSeqs, events, baseSeq);
			return {
				kind: "replace",
				seq: event.seq,
				start: surfaceOp.start,
				end: surfaceOp.end,
				...range
			};
		}
		/** Apply one event and return replacement metadata only when one occurred. */
		function applySurfaceEvent(state, event, expectedSeq, events, baseSeq) {
			return applySurfacePlan(state, planSurfaceEvent(state, event, expectedSeq, events, baseSeq));
		}
		/** Commit one previously validated surface transition. */
		function applySurfacePlan(state, plan) {
			if (plan?.kind === "append") state.nodes.push(plan.seq);
			else if (plan?.kind === "replace") {
				state.nodes.splice(plan.startIdx, plan.endIdx - plan.startIdx + 1, plan.seq);
				state.replaceGeneration += 1;
			}
			if (plan?.kind !== "replace") return;
			return {
				seq: plan.seq,
				start: plan.start,
				end: plan.end,
				shadowedSeqs: plan.shadowedSeqs
			};
		}
		/** Incremental ordered surface view and append-boundary validator. */
		var SurfaceManager = class {
			log;
			baseSeq;
			/** Shared transition state; replacement history is not retained. */
			_state = createFoldState();
			/** Last processed absolute seq. */
			_lastProcessedSeq;
			/** Candidate already validated by `validateNext`, pending exact log admission. */
			_pendingPlan;
			/**
			* @param log - Contiguous complete log or loaded event window.
			* @param baseSeq - Absolute sequence of the window's first event.
			*/
			constructor(log, baseSeq = 0) {
				this.log = log;
				this.baseSeq = baseSeq;
				this._lastProcessedSeq = baseSeq - 1;
			}
			/**
			* Validate the next candidate without mutating the committed surface.
			* @param event - candidate event that has not entered the log yet.
			*/
			validateNext(event) {
				if (this._lastProcessedSeq < this.baseSeq + this.log.length - 1) this._processDelta();
				const expectedSeq = this.baseSeq + this.log.length;
				this._pendingPlan = {
					event,
					expectedSeq,
					plan: planSurfaceEvent(this._state, event, expectedSeq, this.log, this.baseSeq)
				};
			}
			/** Monotonic count of folded positional replacements. */
			get replaceGeneration() {
				if (this._lastProcessedSeq < this.baseSeq + this.log.length - 1) this._processDelta();
				return this._state.replaceGeneration;
			}
			/** Surface event sequences in model-visible order. */
			get nodes() {
				if (this._lastProcessedSeq < this.baseSeq + this.log.length - 1) this._processDelta();
				return this._state.nodes;
			}
			/** Fold events appended since the previous access. */
			_processDelta() {
				const tailSeq = this.baseSeq + this.log.length - 1;
				for (let seq = this._lastProcessedSeq + 1; seq <= tailSeq; seq++) {
					const index = seq - this.baseSeq;
					const event = this.log[index];
					const pending = this._pendingPlan;
					if (pending?.event === event && pending.expectedSeq === seq) applySurfacePlan(this._state, pending.plan);
					else applySurfaceEvent(this._state, event, seq, this.log, this.baseSeq);
					if (pending !== void 0 && pending.expectedSeq <= seq) this._pendingPlan = void 0;
					this._lastProcessedSeq = seq;
				}
			}
		};
		//#endregion
		//#region src/client/sessions/conversation.ts
		/**
		* core ContentBlock[] -> AssistantBlock[] (classifier shared by finalized messages and partial block-end).
		* @param content - core content blocks verbatim.
		* @returns UI-classified blocks in source order.
		*/
		function toAssistantBlocks(content) {
			return content.map(toAssistantBlock);
		}
		/**
		* Classify one block (ToolCallBlock fields are id/arguments, mapped to callId/argsRaw).
		* @param block - one core content block.
		* @returns the UI classification.
		*/
		function toAssistantBlock(block) {
			switch (block.type) {
				case "text": return {
					kind: "text",
					text: block.text
				};
				case "reasoning": return {
					kind: "reasoning",
					text: block.text
				};
				case "tool-call": return {
					kind: "tool-call",
					callId: String(block.id),
					name: block.name,
					argsRaw: block.arguments
				};
				default: return {
					kind: "other",
					block
				};
			}
		}
		//#endregion
		//#region src/client/sessions/context-provenance.ts
		/** One durable source narrowed to the readable-record shape; null for anything else. */
		function asRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
		}
		/** A record field read as a non-empty string, or null. */
		function readString(record, key) {
			const value = record[key];
			return typeof value === "string" && value.length > 0 ? value : null;
		}
		/** Distinct non-empty `field` values of an array-valued source member, in first-seen order. */
		function collect(source, member, field) {
			const list = source[member];
			if (!Array.isArray(list)) return [];
			const seen = [];
			for (const entry of list) {
				const record = asRecord(entry);
				const value = record === null ? null : readString(record, field);
				if (value !== null && !seen.includes(value)) seen.push(value);
			}
			return seen;
		}
		/** A collected name list rendered as one label; null when the list is empty. */
		function joined(names) {
			return names.length > 0 ? names.join(", ") : null;
		}
		/**
		* Project one durable message source onto its transcript role and producer name.
		*
		* The source arrives over the wire as opaque JSON (`MessageSource` is
		* merge-extensible, so no client-side union can be exhaustive), and a durable
		* log may predate or postdate this UI; every unreadable shape therefore
		* degrades to `inject` with whatever name the record still carries.
		* @param source - the logged `user/message` source, exactly as recorded.
		* @returns the role and producer name to present for this context.
		*/
		function contextProvenance(source) {
			const record = asRecord(source);
			const kind = record === null ? null : readString(record, "kind");
			if (record === null || kind === null) return {
				role: "inject",
				label: null
			};
			switch (kind) {
				case "session-reference": return {
					role: "recall",
					label: joined(collect(record, "references", "label")) ?? kind
				};
				case "workspace-instructions": return {
					role: "inject",
					label: joined(collect(record, "changes", "path")) ?? kind
				};
				case "plugin": return {
					role: "inject",
					label: readString(record, "plugin") ?? kind
				};
				default: return {
					role: "inject",
					label: kind
				};
			}
		}
		/**
		* Context forms this UI version renders with a dedicated presentation. The
		* durable vocabulary (`ContextForm` in `dsh-llm`) may already be wider — an
		* unrecognized or absent value degrades to the opaque presentation rather than
		* dropping the row, so a log written by a newer or foreign producer still
		* renders.
		*/
		const KNOWN_FORMS = [
			"instructions",
			"catalog",
			"snapshot",
			"notice",
			"relay",
			"recall"
		];
		/**
		* Read the producer-declared form off one durable message source.
		* @param source - the logged `user/message` source, exactly as recorded.
		* @returns the form when this UI version presents it, otherwise null (opaque).
		*/
		function contextForm(source) {
			const record = asRecord(source);
			const form = record === null ? null : readString(record, "form");
			return form !== null && KNOWN_FORMS.includes(form) ? form : null;
		}
		//#endregion
		//#region src/client/sessions/steering-history.ts
		/**
		* Incrementally identifies `user/message` events claimed from the next-step
		* inbox. The agent loop records all admitted input as `user/message`; the
		* preceding `agent/inbox/spliced` events preserve whether it came from the
		* queued-turn list or the next-step list.
		*/
		var SteeringHistory = class {
			inbox = {
				"next-turn": [],
				"next-step": []
			};
			claimedNextStep = /* @__PURE__ */ new Set();
			/** Clear all replay state before rebuilding a history window. */
			reset() {
				this.inbox["next-turn"] = [];
				this.inbox["next-step"] = [];
				this.claimedNextStep.clear();
			}
			/**
			* Apply one event and report whether it is a durable human steering message.
			* @param event - next raw session event in sequence order.
			* @returns true only for a user-origin message previously claimed from `next-step`.
			*/
			apply(event) {
				if (event.type === "agent/inbox/spliced") {
					this.applySplice(event.data);
					return false;
				}
				if (event.type !== "user/message") return false;
				const id = event.data.id;
				if (!this.claimedNextStep.delete(id)) return false;
				return event.data.source.kind === "user";
			}
			/** Replay one host-validated inbox splice. */
			applySplice({ target, start, removedCount = 0, inserted, outcome }) {
				const removed = this.inbox[target].splice(start, removedCount, ...inserted);
				for (const identity of inserted) this.claimedNextStep.delete(identity.id);
				if (target !== "next-step" || outcome === "canceled") return;
				for (const identity of removed) this.claimedNextStep.add(identity.id);
			}
		};
		//#endregion
		//#region src/client/sessions/assistant-timing.ts
		/**
		* Composite map key for one assistant step.
		* @param turn - turn number from the event payload.
		* @param step - step number from the event payload.
		* @returns collision-free `turn`/`step` key (NUL separator).
		*/
		function assistantStepKey$1(turn, step) {
			return `${turn}\u0000${step}`;
		}
		/**
		* Whether a chunk carries visible model output (first-token boundary). Empty
		* deltas (heartbeats, empty tool-call frames) do not count as a first token.
		* @param chunk - the assistant/chunk payload.
		* @returns true when the chunk contains a non-empty text/reasoning/tool delta.
		*/
		function isTokenDelta(chunk) {
			switch (chunk.type) {
				case "text-delta":
				case "reasoning-delta": return chunk.text !== "";
				case "tool-call-delta": return chunk.argumentsDelta !== "" || chunk.name !== void 0;
				default: return false;
			}
		}
		/**
		* Fold one event into the per-step timing index: step/start opens the entry,
		* the first non-empty token delta stamps first-token time once. Other event
		* types are no-ops.
		* @param steps - the mutable per-step index, keyed by {@link assistantStepKey}.
		* @param event - the raw window event.
		*/
		function indexAssistantStepTiming(steps, event) {
			if (event.type === "step/start") steps.set(assistantStepKey$1(event.data.turn, event.data.step), {
				stepStartTime: event.time,
				firstTokenTime: null
			});
			else if (event.type === "assistant/chunk" && isTokenDelta(event.data.chunk)) {
				const key = assistantStepKey$1(event.data.turn, event.data.step);
				const current = steps.get(key) ?? {
					stepStartTime: null,
					firstTokenTime: null
				};
				if (current.firstTokenTime === null) steps.set(key, {
					...current,
					firstTokenTime: event.time
				});
			}
		}
		/**
		* Settle one finalized assistant message's timing from its step entry; a step
		* whose start or first token fell outside the window yields null boundaries.
		* @param steps - the per-step index built by {@link indexAssistantStepTiming}.
		* @param turn - the assistant/message turn number.
		* @param step - the assistant/message step number.
		* @param completedTime - the assistant/message event timestamp (epoch ms).
		* @returns the node-ready timing record.
		*/
		function settledAssistantTiming(steps, turn, step, completedTime) {
			return {
				...steps.get(assistantStepKey$1(turn, step)) ?? {
					stepStartTime: null,
					firstTokenTime: null
				},
				completedTime
			};
		}
		//#endregion
		//#region src/client/sessions/transcript-adapter.ts
		/**
		* The compaction seam's checkpoint plugin, pinned to the seam's own declaration
		* at COMPILE time: renaming it there fails this annotation (`TS2322`). The
		* import stays type-only because a value import would fail the client purity
		* gate (`packages/client/tsdown.client.ts`) — cross-plugin value imports are
		* forbidden in a browser bundle — while an erased type never reaches it.
		*/
		const COMPACT_PLUGIN = "compact";
		/** One event -> UI node (pure function; the ten-variant ConversationNode union). */
		function materializeNode$1(event, callIndex, resultView, steering, stepTimings) {
			switch (event.type) {
				case "user/message":
					if (event.data.source.kind !== "user") return {
						kind: "context",
						seq: event.seq,
						time: event.time,
						content: event.data.content,
						source: event.data.source,
						provenance: contextProvenance(event.data.source),
						form: contextForm(event.data.source)
					};
					if (steering) return {
						kind: "steering",
						messageId: event.data.id,
						seq: event.seq,
						time: event.time,
						content: event.data.content,
						source: event.data.source
					};
					return {
						kind: "user",
						seq: event.seq,
						time: event.time,
						content: event.data.content,
						source: event.data.source
					};
				case "assistant/message": return {
					kind: "assistant",
					seq: event.seq,
					time: event.time,
					turn: event.data.turn,
					step: event.data.step,
					blocks: toAssistantBlocks(event.data.message.content),
					usage: event.data.usage,
					timing: settledAssistantTiming(stepTimings, event.data.turn, event.data.step, event.time)
				};
				case "tool/result": {
					const result = event.data.message.content[0];
					const callId = String(event.data.message.source.callId);
					const call = callIndex.get(callId);
					return {
						kind: "tool-result",
						seq: event.seq,
						time: event.time,
						callId,
						call: call ? {
							name: call.name,
							argsRaw: call.argsRaw
						} : null,
						callTime: call?.time ?? null,
						content: result.content,
						isError: result.isError === true,
						...event.data.error !== void 0 ? { error: event.data.error } : {},
						meta: event.data.meta,
						callView: call?.callView ?? null,
						resultView
					};
				}
				/* v8 ignore next 2 -- defensive arm: only the four surface-eligible types
				can be append-origin, and each has a case above; reachable only if core
				adds an eligible type. */
				default: return {
					kind: "unknown",
					seq: event.seq,
					time: event.time,
					type: event.type,
					data: event.data
				};
			}
		}
		/**
		* Whether an event is a landed compaction checkpoint — all three conditions,
		* matching the terminal's `isCompactCheckpoint`: a `user/message`, carrying the
		* compaction seam's checkpoint plugin source, that REPLACED a surface range. A
		* plugin-sourced `user/message` that appends is injected context (a
		* session-reference card), not a compaction; a replacement `tool/result` is an
		* in-place prune and a replacement `assistant/message` a generic rewrite, and
		* both mark no boundary in the conversation.
		* @param event - the raw window event.
		* @returns true when the event compacted a surface range.
		*/
		function isCompactCheckpoint(event) {
			if (event.type !== "user/message") return false;
			const source = event.data.source;
			return source.kind === "plugin" && source.plugin === COMPACT_PLUGIN && isReplacementSurfaceEvent(event);
		}
		/** Whether an event contributes a node to the human transcript. */
		function isTranscriptEvent(event) {
			return isAppendSurfaceEvent(event) || isCompactCheckpoint(event);
		}
		/**
		* Concatenated text of a `compact/summary` payload, or null when it carries no
		* usable text. The payload is a `ContentBlock[]` whose union is
		* merge-extensible, so a non-text block is skipped rather than discarding the
		* text beside it; a payload with no text block at all falls to null through the
		* empty check.
		*/
		function compactSummaryText(event) {
			const summary = event.data.summary;
			if (!Array.isArray(summary)) return null;
			let text = "";
			for (const block of summary) {
				const candidate = block;
				if (candidate.type !== "text" || typeof candidate.text !== "string") continue;
				text += candidate.text;
			}
			return text.trim() === "" ? null : text;
		}
		/**
		* One landed checkpoint -> the human-facing compaction marker. The summary text
		* comes from the checkpoint's own provenance (`sourceEventSeqs` names the
		* `compact/summary` event), never from the framed checkpoint payload, which is
		* an instruction envelope written for the model. A window cut that left the
		* provenance outside soft-falls to `summary: null` (a non-expandable marker),
		* the same posture as a call-less tool result.
		*/
		function materializeCompaction(checkpoint, eventIndex) {
			const sources = checkpoint.sourceEventSeqs;
			let summary = null;
			for (const seq of sources ?? []) {
				const candidate = eventIndex.get(seq);
				if (candidate === void 0 || candidate.type !== "compact/summary") continue;
				summary = compactSummaryText(candidate);
				break;
			}
			return {
				kind: "compaction",
				seq: checkpoint.seq,
				time: checkpoint.time,
				summary
			};
		}
		/** Log-ordered human transcript over a paged raw event window (never consults surface order). */
		var TranscriptAdapter = class {
			/** Window events by seq: provenance lookup for a checkpoint's summary. */
			eventIndex = /* @__PURE__ */ new Map();
			/** Transcript nodes in log order; copy-on-write so a published array never mutates. */
			projected = [];
			callIdx = /* @__PURE__ */ new Map();
			/** Per-step timing boundaries (step/start + first token delta), consumed when the step's assistant/message materializes. */
			stepTimings = /* @__PURE__ */ new Map();
			/** Wire result views keyed by the tool/result event's seq (views ride the envelope, not the event). */
			resultViews = /* @__PURE__ */ new Map();
			/** Durable inbox replay used to distinguish next-step human input from queued prompts. */
			steeringHistory = new SteeringHistory();
			/**
			* Command lifecycle nodes by commandId (insertion = run order). The
			* `command/run`/`command/done` pair is log-only, so it is not a surface
			* event and never joins the transcript projection; this index folds the pair
			* (done settles its run's node in place) and nodes() merges the products in
			* by seq. Window cuts soft-fall like tool pairs: a done with no in-window
			* run still builds a node.
			*/
			commandIdx = /* @__PURE__ */ new Map();
			/** Projection revision, bumped only when a transcript node or a command node actually
			*  changed, keying the nodes() result cache: an unchanged projection returns the previous
			*  ARRAY reference, not just cached elements — the snapshot's reference-stability contract
			*  (§A.9.4) starts here, and a chunk storm bumps nothing at all. */
			rev = 0;
			nodesResult = null;
			/**
			* Window rebuild (after open/resync/page prepend): re-index the raw window
			* and re-project the transcript.
			* @param events - the new window contents (seq-ascending).
			* @param views - per-event wire views aligned with `events` by index (undefined slots for view-less events).
			*/
			reset(events, views) {
				this.rev++;
				this.eventIndex = /* @__PURE__ */ new Map();
				this.callIdx = /* @__PURE__ */ new Map();
				this.resultViews.clear();
				this.commandIdx = /* @__PURE__ */ new Map();
				this.steeringHistory.reset();
				const steeringSeqs = /* @__PURE__ */ new Set();
				this.stepTimings = /* @__PURE__ */ new Map();
				for (let i = 0; i < events.length; i++) {
					const event = events[i];
					/* v8 ignore next -- dense-array guard: i stays within events.length, so the undefined arm needs a sparse array no caller builds. */
					if (event === void 0) continue;
					this.eventIndex.set(event.seq, event);
					this.indexCall(event, views?.[i]);
					this.indexCommand(event);
					if (this.steeringHistory.apply(event)) steeringSeqs.add(event.seq);
					indexAssistantStepTiming(this.stepTimings, event);
				}
				const projected = [];
				for (const event of events) if (isTranscriptEvent(event)) projected.push(this.materialize(event, steeringSeqs.has(event.seq)));
				this.projected = projected;
			}
			/**
			* Tail append (live session/event): index the event and, when it belongs to
			* the transcript, extend the projection by one copy-on-write node so a
			* published array never mutates. An event that changes no node (a chunk
			* storm) bumps no revision, so nodes() keeps returning the same array
			* reference.
			* @param event - the live event (seq = window tail + 1).
			* @param view - host-computed tool view paired with the event when it is a tool call/result; indexed for card rendering.
			*/
			append(event, view) {
				this.eventIndex.set(event.seq, event);
				this.indexCall(event, view);
				const steering = this.steeringHistory.apply(event);
				indexAssistantStepTiming(this.stepTimings, event);
				if (this.indexCommand(event)) this.rev++;
				if (!isTranscriptEvent(event)) return;
				this.projected = [...this.projected, this.materialize(event, steering)];
				this.rev++;
			}
			/**
			* The current transcript node array. Same revision -> same array reference
			* (memo boundary); node objects are materialized once, so an unchanged node
			* keeps its identity across appends.
			* @returns transcript nodes in log order, command nodes merged in by seq.
			*/
			nodes() {
				if (this.nodesResult !== null && this.nodesResult.rev === this.rev) return this.nodesResult.value;
				let nodes = this.projected;
				if (this.commandIdx.size > 0) {
					nodes = [];
					const commands = [...this.commandIdx.values()];
					let next = 0;
					for (const node of this.projected) {
						for (let cmd = commands[next]; cmd !== void 0 && cmd.seq < node.seq; cmd = commands[++next]) nodes.push(cmd);
						nodes.push(node);
					}
					for (let cmd = commands[next]; cmd !== void 0; cmd = commands[++next]) nodes.push(cmd);
				}
				this.nodesResult = {
					rev: this.rev,
					value: nodes
				};
				return nodes;
			}
			/** Materialize one transcript event against the complete current indexes. */
			materialize(event, steering) {
				return isCompactCheckpoint(event) ? materializeCompaction(event, this.eventIndex) : materializeNode$1(event, this.callIdx, this.resultViews.get(event.seq) ?? null, steering, this.stepTimings);
			}
			/**
			* Fold one command lifecycle event into its node (run mints, done settles in
			* place; done-only soft-falls).
			* @returns whether the command index changed, so callers can bump the revision.
			*/
			indexCommand(event) {
				if (event.type === "command/run") {
					const data = event.data;
					this.commandIdx.set(data.commandId, {
						kind: "command",
						seq: event.seq,
						time: event.time,
						commandId: data.commandId,
						name: data.name,
						args: data.args,
						outcome: null
					});
					return true;
				}
				if (event.type !== "command/done") return false;
				const data = event.data;
				const run = this.commandIdx.get(data.commandId);
				const outcome = {
					kind: data.kind,
					...data.text === void 0 ? {} : { text: data.text }
				};
				if (run === void 0) {
					this.commandIdx.set(data.commandId, {
						kind: "command",
						seq: event.seq,
						time: event.time,
						commandId: data.commandId,
						name: null,
						args: null,
						outcome
					});
					return true;
				}
				this.commandIdx.set(data.commandId, {
					...run,
					outcome
				});
				return true;
			}
			indexCall(event, view) {
				if (event.type === "tool/result") {
					if (view?.for === "result") this.resultViews.set(event.seq, view.view);
					return;
				}
				if (event.type !== "tool/call") return;
				this.callIdx.set(String(event.data.callId), {
					name: event.data.name,
					argsRaw: event.data.arguments,
					turn: event.data.turn,
					step: event.data.step,
					time: event.time,
					callView: view?.for === "call" ? view.view : null
				});
			}
		};
		//#endregion
		//#region src/client/sessions/failure-display.ts
		/**
		* Convert a durable failure into copy that is safe to expose in the GUI.
		* @param failure - Failure value preserved by the session event.
		* @returns Display-safe copy for client projections.
		*/
		function displayFailureMessage(failure) {
			if (failure === null || typeof failure !== "object") return String(failure);
			const record = failure;
			if (record.code === "AUTH") return "API key is invalid";
			return typeof record.message === "string" ? record.message : JSON.stringify(failure);
		}
		//#endregion
		//#region src/client/sessions/partial.ts
		/**
		* Whether a stream chunk changes the partial assistant projection shown by the UI.
		* @param type - Stream chunk discriminant.
		* @returns Whether publishing the accumulated partial can change the visible snapshot.
		*/
		function isVisibleAssistantChunk(type) {
			return type === "block-start" || type === "text-delta" || type === "reasoning-delta" || type === "tool-call-delta" || type === "block-end";
		}
		/** assistant/chunk accumulator: folds StreamChunks into AssistantBlock[] with block-level immutability. */
		var PartialAccumulator = class {
			turn;
			step;
			blocks = [];
			changed = true;
			snapshot;
			/**
			* @param turn - Owning agent turn.
			* @param step - Owning model step.
			* @param initialBlocks - Materialized prefix when accumulation begins after history replay.
			*/
			constructor(turn, step, initialBlocks = []) {
				this.turn = turn;
				this.step = step;
				this.blocks = [...initialBlocks];
				this.snapshot = {
					turn,
					step,
					blocks: initialBlocks
				};
			}
			/**
			* Fold one chunk.
			* @param chunk - the stream chunk.
			* @returns whether it caused a visible change (usage/finish return false, skipping notification).
			*/
			push(chunk) {
				switch (chunk.type) {
					case "block-start":
						this.blocks[chunk.index] = emptyBlock(chunk.blockType);
						this.changed = true;
						return true;
					case "text-delta": {
						const prev = this.blocks[chunk.index];
						this.blocks[chunk.index] = {
							kind: "text",
							text: (prev?.kind === "text" ? prev.text : "") + chunk.text
						};
						this.changed = true;
						return true;
					}
					case "reasoning-delta": {
						const prev = this.blocks[chunk.index];
						this.blocks[chunk.index] = {
							kind: "reasoning",
							text: (prev?.kind === "reasoning" ? prev.text : "") + chunk.text
						};
						this.changed = true;
						return true;
					}
					case "tool-call-delta": {
						const prev = this.blocks[chunk.index];
						const base = prev?.kind === "tool-call" ? prev : {
							kind: "tool-call",
							callId: "",
							name: "",
							argsRaw: ""
						};
						this.blocks[chunk.index] = {
							kind: "tool-call",
							callId: base.callId || String(chunk.id),
							name: chunk.name ?? base.name,
							argsRaw: base.argsRaw + chunk.argumentsDelta
						};
						this.changed = true;
						return true;
					}
					case "block-end":
						this.blocks[chunk.index] = toAssistantBlock(chunk.block);
						this.changed = true;
						return true;
					default: return false;
				}
			}
			/**
			* Current partial projection.
			* @returns the cached snapshot (the blocks array reference only changes after a mutation).
			*/
			toPartial() {
				if (this.changed) {
					this.snapshot = {
						turn: this.turn,
						step: this.step,
						blocks: this.blocks.filter((b) => b !== void 0)
					};
					this.changed = false;
				}
				return this.snapshot;
			}
		};
		function emptyBlock(blockType) {
			switch (blockType) {
				case "text": return {
					kind: "text",
					text: ""
				};
				case "reasoning": return {
					kind: "reasoning",
					text: ""
				};
				case "tool-call": return {
					kind: "tool-call",
					callId: "",
					name: "",
					argsRaw: ""
				};
				default: return {
					kind: "other",
					block: null
				};
			}
		}
		const MAX_RETRY_DELAY_MS = 2147483647;
		/** Queue-row preview cap: the dock renders one line, the full content never leaves the host mirror. */
		const QUEUE_PREVIEW_CHARS = 200;
		/** Single-line queue-row preview: text blocks flattened, non-text as tags, capped by code point. */
		function queuePreviewOf(content) {
			const flat = content.map((block) => block.type === "text" ? block.text : `[${block.type}]`).join(" ").replace(/\s+/g, " ").trim();
			const chars = Array.from(flat);
			return chars.length > QUEUE_PREVIEW_CHARS ? `${chars.slice(0, QUEUE_PREVIEW_CHARS).join("")}…` : flat;
		}
		/** Recover complete composer text only when editing cannot discard non-text blocks. */
		function queueTextOf(content) {
			if (!content.every((block) => block.type === "text")) return null;
			return content.map((block) => block.text).join("");
		}
		/**
		* Owns a session's event window, derived conversation state, and observable
		* snapshot. React bindings remain outside this data layer. Features see only
		* the {@link SessionFace} slice (ISession verbs + the snapshot source); the
		* remaining public members are manager/runtime entry points.
		*/
		var Session = class {
			sessionId;
			api;
			options;
			events = [];
			/** Wire views aligned with `events` by index (envelope-level annotations; undefined = no view).
			*  Kept parallel rather than merged so `events` stays the raw log slice (model-visible ⟺ logged). */
			views = [];
			baseSeq = 0;
			hasMore = false;
			openState = "cold";
			openError = null;
			openPromise = null;
			/** Bumped by resync to invalidate an in-flight doOpen: a reconnect must rebuild, never adopt
			*  a pre-disconnect open whose history request is already doomed (audit S4). Stale doOpen
			*  passes drop all writes once the generation moves on. */
			openGeneration = 0;
			loadingOlder = false;
			transcript = new TranscriptAdapter();
			partial = null;
			openCalls = /* @__PURE__ */ new Map();
			/** Last entered step per turn, folded from step/start for terminal error placement. */
			lastStepByTurn = /* @__PURE__ */ new Map();
			/** Operational notices and interrupted-turn terminal nodes merged into the flow by seq.
			*  Derived from window events and rebuilt with partial/openCalls; the transcript is
			*  seq-monotonic, so a plain seq merge preserves event order. */
			derivedNodes = [];
			pending = /* @__PURE__ */ new Map();
			callsRev = 0;
			callsCache = null;
			pendingRev = 0;
			pendingCache = null;
			derivedRev = 0;
			nodesCache = null;
			/** Exact turn timing retained from the raw window so presentation never
			*  infers elapsed time from transcript content. */
			turnTimings = /* @__PURE__ */ new Map();
			turnTimingsRev = 0;
			turnTimingsCache = null;
			/** Completed turn boundaries retained from the raw window so presentation
			*  actions never infer a safe fork point from transcript content alone. */
			turnEnds = /* @__PURE__ */ new Map();
			turnEndsRev = 0;
			turnEndsCache = null;
			/** Authoritative stream-only inbox snapshot; pending work never hits history. */
			queued = [];
			queueRev = 0;
			queueCache = null;
			/** `run_code` sub-dispatches by parent callId (window-derived, like openCalls). Appends
			*  copy-on-write the per-parent array so published snapshot references never mutate. */
			codeDispatches = /* @__PURE__ */ new Map();
			dispatchesRev = 0;
			dispatchesCache = null;
			/** In-window `artifact/delta` accumulation by callId (window-derived, like codeDispatches). */
			artifactDeltas = /* @__PURE__ */ new Map();
			deltasRev = 0;
			deltasCache = null;
			running = false;
			address;
			parentAvailable = false;
			/**
			* Sticky send marker, private input of the composerPhase derivation: set
			* synchronously before prompt()'s first await, never reset — the blank →
			* engaging edge of the phase machine (see ComposerPhase).
			*/
			promptAttempted = false;
			/** Empty-log mirror (see ConversationSnapshot.blank); monotone false once flipped. */
			blankBit = false;
			removed = false;
			promptError = null;
			lastAgentError = null;
			/** Live events buffered during open/resync and stitched by sequence once history lands. */
			liveBuffer = [];
			/** Gap repair in flight; live events detour to the buffer until the tail page lands. */
			stitching = false;
			/** subscribed.lastSeq baseline (gap detection; null when no subscribed frame arrived — degrade to the liveBuffer dedup path). */
			subscribedLastSeq = null;
			/**
			* Per-session projection value store (session-projection RFC, push model):
			* finished whole values computed on the host, seeded by the tail page's
			* projections block and updated by `session/projection` frames under the
			* one higher-seq-wins rule. Keys are read via `projections.faceOf(key)`
			* (the useProjection resolution face); the conversation snapshot never
			* carries projection values, and no client-side domain folding exists.
			* Manager-owned when constructed through SessionManager (frames route and
			* the store outlives instantiation, the title-snapshot precedent); a bare
			* construction gets a private store.
			*/
			projections;
			snapshotCache;
			notifier = new Notifier(() => {
				this.snapshotCache = this.buildSnapshot();
			});
			/**
			* Agent-scoped cordis context, bound once by SessionsService when it
			* mints the scope (the client mirror of the host Agent's loopCtx). The
			* Session dispatches its own scoped events through it; undefined means
			* unbound (bare object-layer construction) or already pruned — both skip
			* dispatch-dependent behavior rather than fail.
			*/
			actx;
			/**
			* @param sessionId - Host session identity (client sessions are always Host-born).
			* @param api - shared wire client.
			* @param options - optional manager-owned state observers.
			*/
			constructor(sessionId, api, options = {}) {
				this.sessionId = sessionId;
				this.api = api;
				this.options = options;
				this.projections = options.projections ?? new ProjectionValueStore();
				this.address = options.address;
				this.parentAvailable = options.parentAvailable ?? false;
				this.snapshotCache = this.buildSnapshot();
			}
			/**
			* Bind the Agent-scoped context minted by SessionsService (single write;
			* a second bind is a wiring error and throws). Direction stays one-way at
			* the seam: consumers still reach the Session via `sessions.sessionOf`,
			* while the Session holds its own dispatch point (host Agent.loopCtx
			* mirror).
			* @param actx - the agent's scoped context.
			*/
			bindScope(actx) {
				if (this.actx !== void 0) throw new Error(`session ${this.sessionId} already has a bound scope`);
				this.actx = actx;
			}
			/** Release the bound scope at prune time (a later rebind accompanies a freshly minted scope). */
			unbindScope() {
				this.actx = void 0;
			}
			/**
			* Send (queue/steer passed through 1:1); failures land in the snapshot's promptError.
			* @param content - core content blocks verbatim.
			* @param mode - queue appends after the current turn; steer interrupts it.
			* @returns the prompt result (also mirrored into promptError on failure).
			*/
			async prompt(content, mode) {
				this.promptError = null;
				this.lastAgentError = null;
				this.promptAttempted = true;
				this.notifier.markDirty();
				let result;
				try {
					if (this.address === void 0) result = (await this.api.sessions.prompt({
						sessionId: this.sessionId,
						mode,
						content
					})).result;
					else if (this.address.mode === "one-shot") result = {
						ok: false,
						error: {
							code: "subagent-not-resumable",
							message: "one-shot subagent conversations are read-only",
							details: { childSessionId: this.address.childSessionId }
						}
					};
					else {
						const routed = (await this.api.subagents.prompt({
							...this.address,
							content
						})).result;
						result = routed.ok ? {
							ok: true,
							value: { accepted: true }
						} : routed;
					}
				} catch (error) {
					result = transportError(error);
				}
				if (!result.ok) {
					this.promptError = {
						op: "send",
						error: result.error
					};
					this.notifier.markDirty();
					return result;
				}
				if (this.blankBit) {
					this.blankBit = false;
					this.options.onEngaged?.(this);
					this.notifier.markDirty();
				}
				return result;
			}
			/** Apply one operation to a still-pending queue occurrence. */
			async updateQueue(itemId, action) {
				try {
					return (await this.api.sessions.updateQueue({
						sessionId: this.sessionId,
						itemId,
						action
					})).result;
				} catch (error) {
					return transportError(error);
				}
			}
			/**
			* Stop the active turn while the Host preserves pending inbox work; failures
			* land in promptError (same error-strip display slot).
			* @returns the cancel result.
			*/
			async cancel() {
				if (this.address !== void 0) {
					const result = {
						ok: false,
						error: {
							code: "subagent-delivery-unavailable",
							message: "subagent activation cancellation is unavailable",
							details: { childSessionId: this.address.childSessionId }
						}
					};
					this.promptError = {
						op: "stop",
						error: result.error
					};
					this.notifier.markDirty();
					return result;
				}
				let result;
				try {
					result = (await this.api.sessions.cancel({ sessionId: this.sessionId })).result;
				} catch (error) {
					result = transportError(error);
				}
				if (!result.ok) {
					this.promptError = {
						op: "stop",
						error: result.error
					};
					this.notifier.markDirty();
				}
				return result;
			}
			/**
			* Rename: contract session.rename 1:1. On success settle the 'title'
			* projection cell from the response's `{title, seq}` under the store's
			* higher-seq-wins rule (the push frame arriving later is a no-op replay),
			* so the list row and any useProjection('title') reader update without
			* waiting for the mux frame.
			* @param title - raw title text (the host normalizes acceptance).
			* @returns the rename result (normalized accepted title + title event seq).
			*/
			async rename(title) {
				try {
					const { result } = await this.api.sessions.rename({
						sessionId: this.sessionId,
						title
					});
					if (result.ok) this.projections.apply("title", result.value.title, result.value.seq);
					return result;
				} catch (error) {
					return transportError(error);
				}
			}
			/**
			* Execute one slash-command line against this session's agent — pure
			* admission semantics (the host executor durably logs the lifecycle;
			* outcomes render as flow nodes, never as a response echo).
			* @param line - the full command line, leading slash included.
			* @returns the admission result, or the error branch on transport failure.
			*/
			async command(line) {
				try {
					return (await this.api.commands.execute({
						sessionId: this.sessionId,
						line
					})).result;
				} catch (error) {
					return transportError(error);
				}
			}
			/** First open: pull the tail page (idempotent — in-flight/already-open returns the existing promise). */
			open() {
				if (this.openState === "open") return Promise.resolve();
				if (this.openPromise !== null) return this.openPromise;
				const promise = this.doOpen(this.openGeneration).finally(() => {
					if (this.openPromise === promise) this.openPromise = null;
				});
				this.openPromise = promise;
				return promise;
			}
			/** Page up: pull one earlier page with the window's first seq as beforeSeq and prepend (§D.2). */
			async loadOlder() {
				if (this.openState !== "open" || !this.hasMore || this.loadingOlder) return;
				this.loadingOlder = true;
				this.notifier.markDirty();
				try {
					const { result } = await this.history({
						beforeSeq: this.baseSeq,
						maxMessages: 50
					});
					if (!result.ok) return;
					const older = result.value.events;
					if (older.length === 0) {
						this.hasMore = result.value.hasMore;
						return;
					}
					const tail = older[older.length - 1];
					if (tail === void 0 || tail.event.seq + 1 !== this.baseSeq) {
						console.error(`[web-runtime] history page discontinuous: tail seq ${tail?.event.seq} vs baseSeq ${this.baseSeq}`);
						this.hasMore = false;
						return;
					}
					this.events = [...older.map((e) => e.event), ...this.events];
					this.views = [...older.map((e) => e.view), ...this.views];
					/* v8 ignore next -- the ?? arm needs older[0] undefined, but the empty-page branch above already returned. */
					this.baseSeq = older[0]?.event.seq ?? this.baseSeq;
					this.hasMore = result.value.hasMore;
					this.transcript.reset(this.events, this.views);
					this.rebuildDerivedFromWindow();
				} catch (error) {
					console.error("[web-runtime] loadOlder failed:", error);
				} finally {
					this.loadingOlder = false;
					this.notifier.markDirty();
				}
			}
			/** Reconnect rebuild (manager calls this on onConnected for instances that were opened):
			*  reset the window and rerun open; pending waits for the baseline replay. Invalidates any
			*  in-flight open first — its history request rode the dead connection and must not settle
			*  the fresh generation into 'error' (audit S4). */
			async resync() {
				if (this.openState === "cold") return;
				this.openGeneration++;
				this.openPromise = null;
				this.openState = "cold";
				this.openError = null;
				this.events = [];
				this.views = [];
				this.baseSeq = 0;
				this.pending.clear();
				this.pendingRev++;
				this.subscribedLastSeq = null;
				this.liveBuffer = [];
				this.notifier.markDirty();
				await this.open();
			}
			/**
			* uSES subscription entry.
			* @param listener - change callback.
			* @returns the unsubscribe function.
			*/
			subscribe(listener) {
				return this.notifier.subscribe(listener);
			}
			/**
			* Cached conversation snapshot (rebuilt lazily when dirty with no listeners).
			* @returns the cached reference (stable until the next flush).
			*/
			getSnapshot() {
				this.notifier.ensureFresh();
				return this.snapshotCache;
			}
			/**
			* Mux frame arrival (the dispatch switch).
			* @param rpcId - the frame envelope id (the respond backfill key for requested frames).
			* @param frame - the routed frame.
			*/
			handleMuxEnvelope(rpcId, frame) {
				switch (frame.type) {
					case "session/event":
						this.acceptLiveEvent(frame.event, frame.view);
						return;
					case "session/queue":
						this.queued = frame.items.map((item) => ({
							id: item.id,
							messageId: item.message.id,
							placement: item.placement,
							content: item.message.content,
							preview: queuePreviewOf(item.message.content),
							text: queueTextOf(item.message.content)
						}));
						this.queueRev++;
						this.notifier.markDirty();
						return;
					case "session/subscribed":
						this.subscribedLastSeq = frame.lastSeq;
						if (this.queued.length > 0) {
							this.queued = [];
							this.queueRev++;
							this.notifier.markDirty();
						}
						return;
					case "approval/requested": {
						const { type: _type, sessionId: _sid, ...payload } = frame;
						this.mint(new PendingWait("approval", rpcId, this.sessionId, payload, (m) => this.api.respond(m)));
						this.notifier.markDirty();
						return;
					}
					case "approval/resolved":
						for (const item of this.pending.values()) if (item.kind === "approval" && item.payload.approvalId === frame.approvalId) this.settle(item);
						this.notifier.markDirty();
						return;
					case "question/requested": {
						const { type: _type, sessionId: _sid, ...payload } = frame;
						this.mint(new PendingWait("question", rpcId, this.sessionId, payload, (m) => this.api.respond(m)));
						this.notifier.markDirty();
						return;
					}
					case "question/resolved": {
						const item = this.pending.get(`q:${frame.questionRpcId}`);
						if (item !== void 0) this.settle(item);
						this.notifier.markDirty();
						return;
					}
					default: return;
				}
			}
			/**
			* Running-bit relay from the host stream (list entry and snapshot stay consistent).
			* @param running - the new running state.
			*/
			handleRunning(running) {
				if (running && this.blankBit) {
					this.blankBit = false;
					this.notifier.markDirty();
				}
				if (this.running === running) return;
				this.running = running;
				this.notifier.markDirty();
			}
			/**
			* Install or clear the catalog-discovered transport address. A changed
			* address rebuilds an already-open window through its new history route.
			* @param address - direct parent/child address, or undefined for ordinary transport.
			* @param parentAvailable - latest exact-parent availability hint.
			*/
			configureSubagent(address, parentAvailable = false) {
				const same = this.address?.parentSessionId === address?.parentSessionId && this.address?.childSessionId === address?.childSessionId && this.address?.mode === address?.mode;
				this.address = address;
				this.parentAvailable = parentAvailable;
				if (!same && this.openState !== "cold") this.resync();
				else this.notifier.markDirty();
			}
			/**
			* Update only the parent availability hint from a catalog refresh.
			* @param available - whether the exact direct parent is live.
			*/
			handleSubagentParentAvailable(available) {
				if (this.parentAvailable === available) return;
				this.parentAvailable = available;
				this.notifier.markDirty();
			}
			/**
			* Blank-bit relay from the authoritative summary source (list baseline and
			* the session-added frame). Monotone: once any signal (local first send,
			* running flip, an earlier summary) cleared it, a stale true never
			* re-blanks.
			* @param blank - the summary's derived empty-log bit.
			*/
			handleBlank(blank) {
				if (blank === this.blankBit) return;
				if (blank && (this.promptAttempted || this.running)) return;
				this.blankBit = blank;
				this.notifier.markDirty();
			}
			/** host/session-removed relay: flag the snapshot (instance survives — resident-instance rule). */
			handleRemoved() {
				this.removed = true;
				this.notifier.markDirty();
			}
			/**
			* host/agent-error relay: the only outlet for live failures with no turn position.
			* @param message - the stringified error.
			*/
			handleAgentError(message) {
				this.lastAgentError = message;
				this.notifier.markDirty();
			}
			/** No-op because session instances remain resident. */
			dispose() {}
			/** Requested-frame arrival: the wait enters the pending map under its own key. */
			mint(wait) {
				this.pending.set(wait.key, wait);
				this.pendingRev++;
			}
			/** Authoritative resolved-frame settlement: mark, then drop from the pending map. */
			settle(wait) {
				wait.markSettled();
				this.pending.delete(wait.key);
				this.pendingRev++;
			}
			/** @param generation - openGeneration at launch; every await re-checks it and a stale pass
			*  drops all writes (resync superseded this open — its outcome belongs to a dead connection). */
			async doOpen(generation) {
				this.openState = "loading";
				this.openError = null;
				this.notifier.markDirty();
				try {
					let { result } = await this.history({ maxMessages: 50 });
					if (generation !== this.openGeneration) return;
					if (!result.ok) {
						this.openState = "error";
						this.openError = result.error;
						return;
					}
					this.installWindow(result.value.events, result.value.hasMore, result.value.projections);
					const tailSeq = this.windowTailSeq();
					if (this.subscribedLastSeq !== null && tailSeq !== null && this.subscribedLastSeq > tailSeq) {
						result = (await this.history({ maxMessages: 50 })).result;
						if (generation !== this.openGeneration) return;
						if (result.ok) this.installWindow(result.value.events, result.value.hasMore, result.value.projections);
					}
					this.openState = "open";
				} catch (error) {
					if (generation !== this.openGeneration) return;
					this.openState = "error";
					const folded = transportError(error);
					/* v8 ignore next -- the `? null` arm is unreachable: transportError always returns ok:false. */
					this.openError = folded.ok ? null : folded.error;
				} finally {
					if (generation === this.openGeneration) this.notifier.markDirty();
				}
			}
			/** Install the history window + stitch the liveBuffer (seq is the sole dedup key).
			*  Stitching MUST NOT route through acceptLiveEvent: openState is still 'loading' here
			*  (doOpen flips it after install), so recursing would push every buffered event straight
			*  back into liveBuffer where nothing ever drains it — a silent drop loop (audit S1).
			*  A carried projections block seeds the value store (higher seq wins, so a stale
			*  baseline cannot overwrite a newer push frame); the window events themselves are
			*  never folded — the host is the only computation site. */
			installWindow(entries, hasMore, projections) {
				this.events = entries.map((e) => e.event);
				this.views = entries.map((e) => e.view);
				this.baseSeq = this.events[0]?.seq ?? 0;
				this.hasMore = hasMore;
				this.transcript.reset(this.events, this.views);
				this.rebuildDerivedFromWindow();
				if (projections !== void 0) this.projections.seed(projections);
				const buffered = this.liveBuffer;
				this.liveBuffer = [];
				for (const item of buffered) this.appendLive(item.event, item.view);
				this.notifier.markDirty();
			}
			/** Seq-guarded append shared by stitching and the open-state live path. */
			appendLive(event, view) {
				const tailSeq = this.windowTailSeq();
				if (tailSeq !== null && event.seq <= tailSeq) return;
				this.events.push(event);
				this.views.push(view);
				this.transcript.append(event, view);
				this.handoffPendingSteering(event);
				this.applyEventSideEffects(event, view);
			}
			/** Retire the first matching live steering occurrence when its durable message takes over. */
			handoffPendingSteering(event) {
				if (event.type !== "user/message") return;
				const message = event.data;
				const index = this.queued.findIndex((item) => item.placement === "steering" && item.messageId === message.id);
				if (index === -1) return;
				this.queued = this.queued.filter((_item, candidate) => candidate !== index);
				this.queueRev++;
			}
			/** Land a live session/event (open/repair in flight -> buffer; overlapping seq -> drop;
			*  a seq gap -> buffer + tail-page repull instead of appending a hole (audit S3: a gap is an
			*  expected reconnect-window artifact, repaired by refetch). The window stays one contiguous
			*  raw range, which is what lets the transcript render every event between its ends and lets a
			*  compaction checkpoint find its own provenance. */
			acceptLiveEvent(event, view) {
				if (this.openState === "loading" || this.stitching) {
					this.liveBuffer.push({
						event,
						view
					});
					return;
				}
				if (this.openState !== "open") return;
				const tailSeq = this.windowTailSeq();
				if (tailSeq !== null && event.seq > tailSeq + 1) {
					this.liveBuffer.push({
						event,
						view
					});
					this.repairGap();
					return;
				}
				this.appendLive(event, view);
				if (event.type === "assistant/chunk") {
					if (isVisibleAssistantChunk(event.data.chunk.type)) this.notifier.markFrameDirty();
					return;
				}
				this.notifier.markDirty();
			}
			/** Resync-lite (audit S3): repull the tail page and stitch the liveBuffer through the shared
			*  installWindow path. No openState transition — the UI keeps the current window (no loading
			*  flash); events arriving meanwhile detour to liveBuffer via the stitching flag. */
			async repairGap() {
				/* v8 ignore next -- re-entry guard: acceptLiveEvent already detours to liveBuffer while stitching, so no second call reaches here. */
				if (this.stitching) return;
				this.stitching = true;
				const generation = this.openGeneration;
				try {
					const { result } = await this.history({ maxMessages: 50 });
					if (result.ok && generation === this.openGeneration && this.openState === "open") this.installWindow(result.value.events, result.value.hasMore, result.value.projections);
				} catch (error) {
					console.error("[web-runtime] gap repair failed:", error);
				} finally {
					this.stitching = false;
				}
			}
			/** Per-event side effects (right column of the §A.9 dispatch table):
			*  chunk/retry projection and openCalls add-remove. */
			applyEventSideEffects(event, view) {
				const eventType = event.type;
				if (eventType === "llm/retry") {
					const data = parseRetryEventData(event.data);
					if (data === null) {
						console.error(`[web-runtime] ignored malformed llm/retry event at seq ${event.seq}`);
						return;
					}
					if (this.partial !== null && this.partial.turn === data.turn && this.partial.step === data.step) this.partial = null;
					this.derivedNodes.push({
						kind: "model-retry",
						seq: event.seq,
						time: event.time,
						retryState: "scheduled",
						...data
					});
					this.derivedRev++;
					return;
				}
				if (eventType === "artifact/delta") {
					const data = event.data;
					if (typeof data.callId !== "string" || typeof data.delta !== "string") {
						console.error(`[web-runtime] ignored malformed artifact/delta event at seq ${event.seq}`);
						return;
					}
					this.artifactDeltas.set(data.callId, (this.artifactDeltas.get(data.callId) ?? "") + data.delta);
					this.deltasRev++;
					return;
				}
				if (event.type === "tool/code-dispatch-start") {
					const data = event.data;
					const running = {
						callId: data.subCallId,
						name: data.name,
						argsRaw: JSON.stringify(data.arguments),
						turn: 0,
						step: 0,
						time: event.time,
						callView: null
					};
					const siblings = this.codeDispatches.get(data.parentCallId) ?? [];
					this.codeDispatches.set(data.parentCallId, [...siblings, running]);
					this.dispatchesRev++;
					return;
				}
				if (event.type === "tool/code-dispatch") {
					const data = event.data;
					const siblings = this.codeDispatches.get(data.parentCallId) ?? [];
					const at = siblings.findIndex((sub) => sub.callId === data.subCallId);
					const started = at === -1 ? void 0 : siblings[at];
					const settled = {
						kind: "tool-result",
						seq: event.seq,
						time: event.time,
						callId: data.subCallId,
						call: {
							name: data.name,
							argsRaw: JSON.stringify(data.arguments)
						},
						callTime: started === void 0 ? null : started.time,
						content: data.content,
						isError: data.isError,
						callView: null,
						resultView: null
					};
					this.codeDispatches.set(data.parentCallId, at === -1 ? [...siblings, settled] : siblings.map((sub, index) => index === at ? settled : sub));
					this.dispatchesRev++;
					return;
				}
				switch (event.type) {
					case "turn/start":
						this.lastStepByTurn.set(event.data.turn, 0);
						this.turnTimings.set(event.data.turn, { startTime: event.time });
						this.turnTimingsRev++;
						return;
					case "step/start":
						this.lastStepByTurn.set(event.data.turn, event.data.step);
						return;
					case "assistant/chunk": {
						const { turn, step, chunk } = event.data;
						this.settleScheduledRetry("started", turn);
						if (this.partial === null || this.partial.turn !== turn || this.partial.step !== step) this.partial = new PartialAccumulator(turn, step);
						this.partial.push(chunk);
						return;
					}
					case "assistant/message":
						if (this.partial !== null && this.partial.turn === event.data.turn && this.partial.step === event.data.step) this.partial = null;
						return;
					case "tool/call":
						this.openCalls.set(String(event.data.callId), {
							callId: String(event.data.callId),
							name: event.data.name,
							argsRaw: event.data.arguments,
							turn: event.data.turn,
							step: event.data.step,
							time: event.time,
							callView: view?.for === "call" ? view.view : null
						});
						this.callsRev++;
						return;
					case "tool/result":
						if (this.openCalls.delete(String(event.data.message.source.callId))) this.callsRev++;
						return;
					case "turn/end": {
						const lastStep = this.lastStepByTurn.get(event.data.turn) ?? 0;
						const timing = this.turnTimings.get(event.data.turn);
						if (timing !== void 0) {
							this.turnTimings.set(event.data.turn, {
								...timing,
								endTime: event.time
							});
							this.turnTimingsRev++;
						}
						this.turnEnds.set(event.data.turn, event.seq);
						this.turnEndsRev++;
						if (event.data.reason.kind === "aborted") this.settleScheduledRetry("cancelled", event.data.turn);
						if (event.data.reason.kind === "error" && !this.derivedNodes.some((node) => node.kind === "model-retry" && node.turn === event.data.turn)) {
							const failure = event.data.reason.error;
							this.derivedNodes.push({
								kind: "turn-error",
								seq: event.seq,
								time: event.time,
								turn: event.data.turn,
								step: lastStep,
								message: displayFailureMessage(failure),
								code: failure.code
							});
							this.derivedRev++;
						}
						if (event.data.reason.kind === "error") this.settleScheduledRetry("started", event.data.turn);
						if (this.partial !== null && this.partial.turn === event.data.turn) {
							const { blocks } = this.partial.toPartial();
							if (blocks.some((b) => b.kind === "text" || b.kind === "reasoning" ? b.text !== "" : true)) {
								this.derivedNodes.push({
									kind: "assistant",
									seq: event.seq - .9,
									time: event.time,
									turn: this.partial.turn,
									step: this.partial.step,
									blocks,
									interrupted: true
								});
								this.derivedRev++;
							}
							this.partial = null;
						}
						let callOffset = 0;
						for (const [callId, call] of this.openCalls) {
							if (call.turn !== event.data.turn) continue;
							this.openCalls.delete(callId);
							this.callsRev++;
							this.derivedNodes.push({
								kind: "tool-result",
								seq: event.seq - .8 + callOffset++ * .01,
								time: event.time,
								callId,
								call: {
									name: call.name,
									argsRaw: call.argsRaw
								},
								callTime: call.time,
								content: [],
								isError: true,
								error: {
									name: "Interrupted",
									code: "interrupted"
								},
								callView: call.callView,
								resultView: null
							});
							this.derivedRev++;
						}
						this.lastStepByTurn.delete(event.data.turn);
						return;
					}
					default: return;
				}
			}
			/**
			* Settle the newest scheduled retry, optionally restricted to its failed turn.
			* @param retryState - next client projection state to publish.
			* @param turn - failed turn required for cancellation; omitted for the next retry turn start.
			*/
			settleScheduledRetry(retryState, turn) {
				const index = this.derivedNodes.findLastIndex((node) => node.kind === "model-retry" && node.retryState === "scheduled" && (turn === void 0 || node.turn === turn));
				if (index < 0) return;
				const node = this.derivedNodes[index];
				/* v8 ignore next -- findLastIndex's predicate narrows the indexed node only at runtime. */
				if (node?.kind !== "model-retry") return;
				this.derivedNodes[index] = {
					...node,
					retryState
				};
				this.derivedRev++;
			}
			/** Re-derive state (partial/openCalls/derivedNodes) from raw window events after a rebuild — keeps
			*  paging/stitching consistent, and makes live handling and history replay converge on the same
			*  retry notices and interrupted nodes. */
			rebuildDerivedFromWindow() {
				this.partial = null;
				this.openCalls.clear();
				this.lastStepByTurn.clear();
				this.callsRev++;
				this.derivedNodes = [];
				this.derivedRev++;
				this.turnTimings = /* @__PURE__ */ new Map();
				this.turnTimingsRev++;
				this.turnEnds = /* @__PURE__ */ new Map();
				this.turnEndsRev++;
				this.codeDispatches = /* @__PURE__ */ new Map();
				this.dispatchesRev++;
				this.artifactDeltas = /* @__PURE__ */ new Map();
				this.deltasRev++;
				for (let i = 0; i < this.events.length; i++) {
					const event = this.events[i];
					/* v8 ignore next -- dense-array guard: i stays within events.length, so the undefined arm needs a sparse array no caller builds. */
					if (event !== void 0) this.applyEventSideEffects(event, this.views[i]);
				}
			}
			windowTailSeq() {
				const tail = this.events[this.events.length - 1];
				return tail === void 0 ? null : tail.seq;
			}
			buildSnapshot() {
				const projected = this.transcript.nodes();
				let nodes;
				if (this.nodesCache !== null && this.nodesCache.projected === projected && this.nodesCache.derivedRev === this.derivedRev) nodes = this.nodesCache.value;
				else {
					nodes = this.derivedNodes.length === 0 ? projected : [...projected, ...this.derivedNodes].sort((a, b) => a.seq - b.seq);
					this.nodesCache = {
						projected,
						derivedRev: this.derivedRev,
						value: nodes
					};
				}
				if (this.callsCache === null || this.callsCache.rev !== this.callsRev) this.callsCache = {
					rev: this.callsRev,
					value: [...this.openCalls.values()]
				};
				if (this.turnTimingsCache === null || this.turnTimingsCache.rev !== this.turnTimingsRev) this.turnTimingsCache = {
					rev: this.turnTimingsRev,
					value: new Map(this.turnTimings)
				};
				if (this.turnEndsCache === null || this.turnEndsCache.rev !== this.turnEndsRev) this.turnEndsCache = {
					rev: this.turnEndsRev,
					value: new Map(this.turnEnds)
				};
				if (this.pendingCache === null || this.pendingCache.rev !== this.pendingRev) this.pendingCache = {
					rev: this.pendingRev,
					value: [...this.pending.values()]
				};
				if (this.dispatchesCache === null || this.dispatchesCache.rev !== this.dispatchesRev) this.dispatchesCache = {
					rev: this.dispatchesRev,
					value: new Map(this.codeDispatches)
				};
				if (this.deltasCache === null || this.deltasCache.rev !== this.deltasRev) this.deltasCache = {
					rev: this.deltasRev,
					value: new Map(this.artifactDeltas)
				};
				if (this.queueCache === null || this.queueCache.rev !== this.queueRev) this.queueCache = {
					rev: this.queueRev,
					value: this.queued
				};
				const partial = this.partial?.toPartial() ?? null;
				return {
					sessionId: this.sessionId,
					nodes,
					turnTimings: this.turnTimingsCache.value,
					turnEnds: this.turnEndsCache.value,
					partial,
					runningCalls: this.callsCache.value,
					pending: this.pendingCache.value,
					codeDispatches: this.dispatchesCache.value,
					artifactDeltas: this.deltasCache.value,
					queue: this.queueCache.value,
					running: this.running,
					subagent: this.address === void 0 ? null : {
						address: this.address,
						parentAvailable: this.parentAvailable
					},
					composerPhase: derivePhase(nodes.some((node) => node.kind !== "command") || partial !== null || this.running || this.pendingCache.value.length > 0, this.promptAttempted),
					removed: this.removed,
					openState: this.openState,
					openError: this.openError,
					hasMore: this.hasMore,
					loadingOlder: this.loadingOlder,
					promptError: this.promptError,
					blank: this.blankBit,
					lastAgentError: this.lastAgentError
				};
			}
			/** Select ordinary or addressed history transport from the stored browser fact. */
			history(payload) {
				return this.address === void 0 ? this.api.sessions.history({
					sessionId: this.sessionId,
					...payload
				}) : this.api.subagents.history({
					...this.address,
					...payload
				});
			}
		};
		/** Validate the plugin-owned payload at the session-event wire boundary. */
		function parseRetryEventData(value) {
			if (value === null || typeof value !== "object") return null;
			const data = value;
			const failure = data.failure;
			if (failure === null || typeof failure !== "object") return null;
			const failureData = failure;
			if (!nonNegativeSafeInteger(data.turn) || !nonNegativeSafeInteger(data.step) || typeof data.provider !== "string" || data.provider.length === 0 || typeof data.policyKey !== "string" || data.policyKey.length === 0 || !positiveSafeInteger(data.retry) || typeof data.delayMs !== "number" || !Number.isFinite(data.delayMs) || data.delayMs < 0 || data.delayMs > MAX_RETRY_DELAY_MS || typeof failureData.message !== "string" || failureData.message.length === 0 || typeof failureData.code !== "string" || failureData.code.length === 0) return null;
			if (data.mode === "normal") {
				if (!positiveSafeInteger(data.maxRetries) || data.retry > data.maxRetries) return null;
			} else if (data.mode === "always") {
				if ("maxRetries" in data) return null;
			} else return null;
			if (failureData.status !== void 0 && (typeof failureData.status !== "number" || !Number.isInteger(failureData.status) || failureData.status < 100 || failureData.status > 599)) return null;
			if (failureData.providerRetryAfterMs !== void 0 && (typeof failureData.providerRetryAfterMs !== "number" || !Number.isFinite(failureData.providerRetryAfterMs) || failureData.providerRetryAfterMs <= 0)) return null;
			if (failureData.requestId !== void 0 && (typeof failureData.requestId !== "string" || failureData.requestId.length === 0)) return null;
			return data;
		}
		function nonNegativeSafeInteger(value) {
			return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
		}
		function positiveSafeInteger(value) {
			return nonNegativeSafeInteger(value) && value > 0;
		}
		/**
		* The composerPhase judgment — the single site that knows the predicate
		* (consumers switch on the result, never re-derive). Monotone per session
		* object: `hasContent` only grows within a window and `promptAttempted` is
		* sticky, so blank → engaging → active never steps back; a failed first
		* prompt stays engaging (retry semantics — see ComposerPhase).
		* @param hasContent - any conversation material exists (non-command nodes,
		*   partial, running turn, pending waits; command lifecycle rows alone keep
		*   the session blank).
		* @param promptAttempted - a prompt was initiated on this session object.
		* @returns the derived phase.
		*/
		function derivePhase(hasContent, promptAttempted) {
			if (hasContent) return "active";
			return promptAttempted ? "engaging" : "blank";
		}
		//#endregion
		//#region src/client/sessions/manager.ts
		/** Stable identity of a frame retained until an uninstantiated Session can consume it. */
		function bufferedRequestKey(envelope) {
			const frame = envelope.payload;
			switch (frame.type) {
				case "approval/requested": return `a:${frame.approvalId}`;
				case "question/requested": return `q:${envelope.rpcId}`;
				case "session/queue": return "queue";
				/* v8 ignore next -- pendingBuffers contains only the three frame types above. */
				default: return;
			}
		}
		/** Match ui-question's binary plan-review routing at the wire boundary. */
		function questionInteractionStatus(questions) {
			if (questions.length !== 1) return "question";
			const question = questions[0];
			const intent = question.intent;
			if (intent?.kind !== "plan-review" || question.detail === void 0) return "question";
			if (question.multiSelect === true) return "question";
			const options = question.options ?? [];
			if (options.length > 2) return "question";
			return options.some((option) => option.label === intent.approve) ? "plan-review" : "question";
		}
		/** Instance cluster + frame entry + the session list (see the web client architecture RFC). */
		var SessionManager = class {
			api;
			sessions = /* @__PURE__ */ new Map();
			/** Pre-instantiation buffer for answerable requests and the queued-turn snapshot, which history
			*  cannot reconstruct on open. Live requests remain until resolution; queue and replay duplicates
			*  compact by identity. Instantiation replays and clears it, while removal drops it (audit S7). */
			pendingBuffers = /* @__PURE__ */ new Map();
			/** Outstanding answerable interactions per session, keyed by their stable request identity.
			*  Manager-owned rather than read off Session instances because the sidebar must light up for
			*  sessions never instantiated. Cleared per connection generation — the reopen replay re-adds
			*  still-pending requests — and on session-removed. */
			pendingInteractions = /* @__PURE__ */ new Map();
			/**
			* Sessions that finished running while not selected — the sidebar's green
			* "done" reminder (manager-owned, survives connection generations; cleared
			* on select and session-removed, re-armed by the next completion).
			*/
			completedNotifications = /* @__PURE__ */ new Set();
			/** Last-observed running bits per session; the true→false edge here arms {@link completedNotifications}. */
			prevRunning = /* @__PURE__ */ new Map();
			/** Per-session projection value stores, retained independently of instance arrival (the
			*  title-snapshot precedent, generalized): push frames land here whether or not the Session
			*  is instantiated (list rows read the 'title' key), and an instantiated Session adopts the
			*  same store so history-baseline seeding and frames converge on one row set. */
			projectionStores = /* @__PURE__ */ new Map();
			summaries = [];
			listState = "idle";
			/** Arrival phase; the pending → ready edge fires on the first successful pull (see SessionListPhase). */
			listPhase = "pending";
			listError = null;
			listInflight = null;
			/** Mutations arriving after a list request starts are replayed over its response. */
			listMutations = null;
			addresses = /* @__PURE__ */ new Map();
			catalogs = /* @__PURE__ */ new Map();
			catalogInflight = /* @__PURE__ */ new Map();
			/** Catalog owners whose membership changed while a pull was in flight: one trailing refresh after it settles. */
			catalogStale = /* @__PURE__ */ new Set();
			openCatalogs = /* @__PURE__ */ new Set();
			catalogDebounce = /* @__PURE__ */ new Map();
			selected;
			listSnapshotCache;
			/** Entry-identity cache (§C.2 reference stability): list rebuilds reuse the previous entry
			*  object when every field matches — wire refreshes mint all-new summary objects, so identity
			*  must be recovered by value or every SessionListItem memo misses on every refresh (audit S5). */
			entryCache = /* @__PURE__ */ new Map();
			itemsCache = [];
			notifier = new Notifier(() => {
				this.listSnapshotCache = this.buildListSnapshot();
			});
			/**
			* @param api - shared wire client.
			* @param restoredSelection - persisted real-Session selection candidate.
			*/
			constructor(api, restoredSelection, restoredAddress) {
				this.api = api;
				this.selected = restoredSelection;
				if (restoredAddress !== void 0) this.addresses.set(restoredAddress.childSessionId, restoredAddress);
				this.listSnapshotCache = this.buildListSnapshot();
			}
			/**
			* Select a listed Session or a retained catalog-addressed child.
			* @param sessionId - listed or catalog-addressed Session id.
			*/
			select(sessionId) {
				const address = this.navigationAddress(sessionId);
				if (!this.summaries.some((summary) => summary.sessionId === sessionId) && address === void 0) throw new Error(`sessions.select: unknown session ${sessionId}`);
				if (address !== void 0) this.addresses.set(sessionId, address);
				this.sessions.get(sessionId)?.configureSubagent(address, address === void 0 ? false : this.catalogs.get(address.parentSessionId)?.parentAvailable ?? false);
				this.selected = sessionId;
				this.completedNotifications.delete(sessionId);
				this.refreshSubagents(sessionId);
				this.notifier.notifyNow();
			}
			/**
			* Select a healthy child through its durable direct-parent address.
			* @param address - catalog-derived parent and child ids.
			*/
			selectSubagent(address) {
				const catalog = this.catalogs.get(address.parentSessionId);
				const entry = catalog?.entries.find((candidate) => candidate.id === address.childSessionId);
				if (entry === void 0 || entry.kind !== "child" || entry.mode !== address.mode) throw new Error(`sessions.selectSubagent: ${address.childSessionId} is not a healthy catalog child`);
				this.addresses.set(address.childSessionId, address);
				this.sessions.get(address.childSessionId)?.configureSubagent(address, catalog?.parentAvailable ?? false);
				this.selected = address.childSessionId;
				this.completedNotifications.delete(address.childSessionId);
				this.refreshSubagents(address.childSessionId);
				this.notifier.notifyNow();
			}
			/** Clear the selection (the layout falls to the no-session view state). */
			clearSelection() {
				this.selected = void 0;
				this.notifier.notifyNow();
			}
			/**
			* Return the durable catalog address retained for one child.
			* @param sessionId - possible addressed child id.
			* @returns The direct-parent address, when navigation discovered one.
			*/
			subagentAddress(sessionId) {
				return this.addresses.get(sessionId);
			}
			/**
			* Resolve an address for breadcrumb navigation without retaining transport authority.
			* @param sessionId - possible child id in an already-loaded catalog.
			* @returns A retained or catalog-derived direct-parent address.
			*/
			navigationAddress(sessionId) {
				const retained = this.addresses.get(sessionId);
				if (retained !== void 0) return retained;
				for (const [parentSessionId, catalog] of this.catalogs) {
					const child = catalog.entries.find((entry) => entry.kind === "child" && entry.id === sessionId);
					if (child?.kind === "child") return {
						parentSessionId,
						childSessionId: sessionId,
						mode: child.mode
					};
				}
			}
			/**
			* Drop a session instance (scope-prune companion, decision 12: instance
			* and scope share one lifecycle). The host session log is the durable
			* truth — a later get() lazily rebuilds and open() backfills history.
			* @param sessionId - the session to drop.
			*/
			drop(sessionId) {
				this.sessions.delete(sessionId);
			}
			/**
			* Lazy build: return the existing instance or construct one (no auto-open —
			* open is triggered by the container's select callback).
			* @param sessionId - the session to get.
			* @returns the resident instance.
			*/
			get(sessionId) {
				let session = this.sessions.get(sessionId);
				if (session === void 0) {
					session = this.createSession(sessionId);
					this.sessions.set(sessionId, session);
					const buffered = this.pendingBuffers.get(sessionId);
					if (buffered !== void 0) {
						this.pendingBuffers.delete(sessionId);
						for (const envelope of buffered) session.handleMuxEnvelope(envelope.rpcId, envelope.payload);
					}
					const summary = this.summaries.find((s) => s.sessionId === sessionId);
					if (summary !== void 0) {
						session.handleBlank(summary.blank);
						session.handleRunning(summary.running);
					} else {
						const address = this.addresses.get(sessionId);
						const child = address === void 0 ? void 0 : this.catalogs.get(address.parentSessionId)?.entries.find((entry) => entry.kind === "child" && entry.id === sessionId);
						if (child?.kind === "child") session.handleRunning(child.activity === "running");
					}
				}
				return session;
			}
			createSession(sessionId) {
				const address = this.addresses.get(sessionId);
				return new Session(sessionId, this.api, {
					...address === void 0 ? {} : {
						address,
						parentAvailable: this.catalogs.get(address.parentSessionId)?.parentAvailable ?? false
					},
					onEngaged: (engaged) => {
						this.recordMutation({
							kind: "engaged",
							sessionId: engaged.sessionId
						});
					},
					projections: this.projectionStore(sessionId)
				});
			}
			/** Resident per-session projection store (create-on-demand; outlives instantiation). */
			projectionStore(sessionId) {
				let store = this.projectionStores.get(sessionId);
				if (store === void 0) {
					store = new ProjectionValueStore();
					store.subscribeAny(() => {
						this.notifier.markDirty();
					});
					this.projectionStores.set(sessionId, store);
				}
				return store;
			}
			/**
			* Refresh one direct-child catalog, reusing its in-flight request.
			* @param parentSessionId - catalog owner.
			*/
			refreshSubagents(parentSessionId) {
				const existing = this.catalogInflight.get(parentSessionId);
				if (existing !== void 0) return existing.promise;
				const previous = this.catalogs.get(parentSessionId);
				const expandableRows = /* @__PURE__ */ new Set();
				const activityRows = /* @__PURE__ */ new Map();
				this.catalogs.set(parentSessionId, {
					entries: previous?.entries ?? [],
					parentAvailable: previous?.parentAvailable ?? false,
					state: "loading",
					error: null
				});
				this.notifier.markDirty();
				const operation = (async () => {
					try {
						const { result } = await this.api.subagents.list({ parentSessionId });
						if (result.ok) {
							const parentAvailable = this.catalogInflight.get(parentSessionId)?.parentAvailableOverride ?? result.value.parentAvailable;
							this.catalogs.set(parentSessionId, {
								...result.value,
								entries: this.withCatalogMutations(result.value.entries, expandableRows, activityRows),
								parentAvailable,
								state: "ready",
								error: null
							});
							for (const [childId, address] of this.addresses) {
								if (address.parentSessionId !== parentSessionId) continue;
								this.sessions.get(childId)?.handleSubagentParentAvailable(parentAvailable);
							}
						} else this.catalogs.set(parentSessionId, {
							entries: this.withCatalogMutations(previous?.entries ?? [], expandableRows, activityRows),
							parentAvailable: this.catalogInflight.get(parentSessionId)?.parentAvailableOverride ?? previous?.parentAvailable ?? false,
							state: "error",
							error: result.error
						});
					} catch (error) {
						const folded = transportError(error);
						this.catalogs.set(parentSessionId, {
							entries: this.withCatalogMutations(previous?.entries ?? [], expandableRows, activityRows),
							parentAvailable: this.catalogInflight.get(parentSessionId)?.parentAvailableOverride ?? previous?.parentAvailable ?? false,
							state: "error",
							error: folded.ok ? null : folded.error
						});
					} finally {
						this.catalogInflight.delete(parentSessionId);
						if (this.catalogStale.delete(parentSessionId)) this.refreshSubagents(parentSessionId);
						this.notifier.markDirty();
					}
				})();
				this.catalogInflight.set(parentSessionId, {
					promise: operation,
					expandableRows,
					activityRows,
					parentAvailableOverride: void 0
				});
				return operation;
			}
			/**
			* Mark whether a catalog menu is consuming live membership updates.
			* @param parentSessionId - catalog owner.
			* @param open - current menu state.
			*/
			setSubagentCatalogOpen(parentSessionId, open) {
				if (open) {
					this.openCatalogs.add(parentSessionId);
					this.refreshSubagents(parentSessionId);
				} else {
					this.openCatalogs.delete(parentSessionId);
					const timer = this.catalogDebounce.get(parentSessionId);
					if (timer !== void 0) {
						clearTimeout(timer);
						this.catalogDebounce.delete(parentSessionId);
					}
				}
			}
			/** Full refresh via session.list (single-flight: an in-flight call is reused). */
			refreshList() {
				if (this.listInflight !== null) return this.listInflight;
				this.listState = "loading";
				this.listError = null;
				const established = this.summaries;
				const mutations = [];
				this.listMutations = mutations;
				this.notifier.markDirty();
				this.listInflight = (async () => {
					try {
						const { result } = await this.api.sessions.list({});
						if (result.ok) {
							const baseline = this.listPhase === "pending" ? result.value.items : mergeOrderedBaseline(established, result.value.items, (summary) => summary.sessionId);
							for (const s of baseline) if (!this.prevRunning.has(s.sessionId)) this.prevRunning.set(s.sessionId, s.running);
							let summaries = baseline;
							for (const mutation of mutations) {
								summaries = applyMutation(summaries, mutation);
								this.summaries = summaries;
								this.syncCompletedNotifications();
							}
							this.summaries = summaries;
							this.listState = "idle";
							this.listPhase = "ready";
							this.syncCompletedNotifications();
							for (const s of this.summaries) {
								const session = this.sessions.get(s.sessionId);
								if (session === void 0) continue;
								session.handleBlank(s.blank);
								session.handleRunning(s.running);
							}
							for (const s of result.value.items) {
								const block = s.projections;
								if (block === void 0) continue;
								const store = this.projectionStore(s.sessionId);
								const values = block.values;
								for (const key of Object.keys(values)) store.apply(key, values[key], block.asOfSeq);
							}
						} else {
							this.listState = "error";
							this.listError = result.error;
						}
					} catch (error) {
						this.listState = "error";
						const folded = transportError(error);
						/* v8 ignore next -- the `? null` arm is unreachable: transportError always returns ok:false. */
						this.listError = folded.ok ? null : folded.error;
					} finally {
						this.listMutations = null;
						this.listInflight = null;
						this.notifier.markDirty();
					}
				})();
				return this.listInflight;
			}
			/**
			* Search visible session message content without adding transient query
			* state to the list snapshot.
			* @param query - non-blank literal phrase.
			* @param signal - cancellation for superseded UI queries.
			* @returns the Host result or a folded transport error.
			*/
			async search(query, signal) {
				try {
					return (await this.api.sessions.search({ query }, signal)).result;
				} catch (error) {
					return transportError(error);
				}
			}
			/**
			* Contract session.create; on success merge into summaries immediately (no
			* wait for the next refresh). A created session is blank by definition
			* (entity birth precedes the first message).
			* @param opts - target workspace or working directory, plus an optional caller-owned id.
			* @returns the create result.
			*/
			async create(opts = {}) {
				try {
					const shared = opts.sessionId === void 0 ? {} : { sessionId: opts.sessionId };
					const payload = opts.workspaceId !== void 0 ? {
						workspaceId: opts.workspaceId,
						...shared
					} : {
						...opts.cwd === void 0 ? {} : { cwd: opts.cwd },
						...shared
					};
					const { result } = await this.api.sessions.create(payload);
					if (result.ok) this.recordMutation({
						kind: "upsert",
						summary: {
							sessionId: result.value.sessionId,
							updatedAt: Date.now(),
							running: false,
							blank: true,
							...opts.cwd !== void 0 ? { cwd: opts.cwd } : {}
						}
					});
					else {
						const publishedSessionId = workspaceAttachSessionId(result.error);
						if (publishedSessionId !== void 0) this.recordMutation({
							kind: "upsert",
							summary: {
								sessionId: publishedSessionId,
								updatedAt: Date.now(),
								running: false,
								blank: true
							}
						});
					}
					return result;
				} catch (error) {
					return transportError(error);
				}
			}
			/**
			* Contract session.fork; on success merge the child into summaries
			* immediately (same synchronous-addressability guarantee as create). The
			* child carries the source's history, so it is never blank; lineage rides
			* parentSessionId so the list nests it under its source. A child published
			* before Workspace attachment fails is also reconciled into the list.
			* @param opts - source session and the optional seq anchoring the cut.
			* @returns the fork result (the child session id).
			*/
			async fork(opts) {
				try {
					const source = this.summaries.find((s) => s.sessionId === opts.sessionId);
					const { result } = await this.api.sessions.fork({
						sessionId: opts.sessionId,
						...opts.atSeq === void 0 ? {} : { atSeq: opts.atSeq }
					});
					const childId = result.ok ? result.value.sessionId : workspaceAttachSessionId(result.error);
					if (childId !== void 0) this.recordMutation({
						kind: "upsert",
						summary: {
							sessionId: childId,
							updatedAt: Date.now(),
							running: false,
							blank: false,
							parentSessionId: opts.sessionId,
							...source?.cwd !== void 0 ? { cwd: source.cwd } : {}
						}
					});
					return result;
				} catch (error) {
					return transportError(error);
				}
			}
			/**
			* Insert-or-enrich a locally synthesized summary: a new id prepends; an
			* existing entry only gains fields it lacks (the session-added frame and the
			* create() echo race — whichever lands second must fill the placeholder's
			* missing cwd/parentSessionId, never overwrite list-refresh data).
			*/
			mergeSummary(summary) {
				this.recordMutation({
					kind: "upsert",
					summary
				});
			}
			/** Apply immediately and retain for replay when a list response is in flight. */
			recordMutation(mutation) {
				this.listMutations?.push(mutation);
				this.summaries = applyMutation(this.summaries, mutation);
				this.syncCompletedNotifications();
				this.notifier.markDirty();
			}
			/**
			* uSES subscription entry for useSessionList.
			* @param listener - change callback.
			* @returns the unsubscribe function.
			*/
			subscribe(listener) {
				return this.notifier.subscribe(listener);
			}
			/**
			* Cached list snapshot (rebuilt lazily when dirty with no listeners).
			* @returns the cached reference (stable until the next flush).
			*/
			getListSnapshot() {
				this.notifier.ensureFresh();
				return this.listSnapshotCache;
			}
			/** Add or refresh one stable pending-interaction identity. */
			trackPending(sessionId, key, status) {
				let interactions = this.pendingInteractions.get(sessionId);
				if (interactions === void 0) {
					interactions = /* @__PURE__ */ new Map();
					this.pendingInteractions.set(sessionId, interactions);
				}
				if (interactions.get(key) === status) return;
				interactions.set(key, status);
				this.notifier.markDirty();
			}
			/** Settle one pending-interaction identity without disturbing sibling waits. */
			resolvePending(sessionId, key) {
				const interactions = this.pendingInteractions.get(sessionId);
				if (interactions === void 0 || !interactions.delete(key)) return;
				if (interactions.size === 0) this.pendingInteractions.delete(sessionId);
				this.notifier.markDirty();
			}
			/**
			* Mux frame entry: sessionId-bearing frames go only to instantiated sessions
			* (no lazy build; non-pending frames for uninstantiated sessions drop —
			* history backfills them on open).
			* @param envelope - the frame with its wire rpcId.
			*/
			handleMuxEnvelope(envelope) {
				const frame = envelope.payload;
				if (frame.type === "stream/error") return;
				if (frame.type === "session/projection") {
					this.projectionStore(frame.sessionId).apply(frame.key, frame.value, frame.seq);
					this.notifier.markDirty();
					return;
				}
				if (frame.type === "session/subscribed") {
					this.projectionStores.get(frame.sessionId)?.truncate(frame.lastSeq);
					this.notifier.markDirty();
					const buffered = this.pendingBuffers.get(frame.sessionId);
					if (buffered !== void 0) {
						const kept = buffered.filter((item) => item.payload.type !== "session/queue");
						if (kept.length !== buffered.length) if (kept.length === 0) this.pendingBuffers.delete(frame.sessionId);
						else this.pendingBuffers.set(frame.sessionId, kept);
					}
				}
				if (frame.type === "approval/requested") this.trackPending(frame.sessionId, `a:${frame.approvalId}`, "approval");
				else if (frame.type === "approval/resolved") this.resolvePending(frame.sessionId, `a:${frame.approvalId}`);
				else if (frame.type === "question/requested") this.trackPending(frame.sessionId, `q:${envelope.rpcId}`, questionInteractionStatus(frame.questions));
				else if (frame.type === "question/resolved") this.resolvePending(frame.sessionId, `q:${frame.questionRpcId}`);
				const session = this.sessions.get(frame.sessionId);
				if (session === void 0) switch (frame.type) {
					case "approval/requested":
					case "question/requested":
					case "session/queue": {
						const buffer = this.pendingBuffers.get(frame.sessionId) ?? [];
						const key = frame.type === "approval/requested" ? `a:${frame.approvalId}` : frame.type === "question/requested" ? `q:${envelope.rpcId}` : "queue";
						const prior = buffer.findIndex((item) => bufferedRequestKey(item) === key);
						if (prior === -1) buffer.push(envelope);
						else buffer[prior] = envelope;
						this.pendingBuffers.set(frame.sessionId, buffer);
						return;
					}
					case "approval/resolved":
					case "question/resolved": {
						const buffer = this.pendingBuffers.get(frame.sessionId);
						if (buffer === void 0) return;
						const key = frame.type === "approval/resolved" ? `a:${frame.approvalId}` : `q:${frame.questionRpcId}`;
						const prior = buffer.findIndex((item) => bufferedRequestKey(item) === key);
						if (prior !== -1) buffer.splice(prior, 1);
						if (buffer.length === 0) this.pendingBuffers.delete(frame.sessionId);
						return;
					}
					default: return;
				}
				session.handleMuxEnvelope(envelope.rpcId, frame);
			}
			/**
			* Host frame entry: list upkeep + per-instance running/removed/agent-error relay.
			* @param envelope - the frame with its wire rpcId.
			*/
			handleHostEnvelope(envelope) {
				const frame = envelope.payload;
				switch (frame.type) {
					case "host/session-added":
						this.mergeSummary({
							sessionId: frame.sessionId,
							updatedAt: Date.now(),
							running: false,
							blank: frame.blank,
							...frame.parentSessionId !== void 0 ? { parentSessionId: frame.parentSessionId } : {},
							...frame.origin !== void 0 ? { origin: frame.origin } : {},
							...frame.cwd !== void 0 ? { cwd: frame.cwd } : {}
						});
						this.sessions.get(frame.sessionId)?.handleBlank(frame.blank);
						if (frame.origin === "subagent" && frame.parentSessionId !== void 0) this.markCatalogParentExpandable(frame.parentSessionId);
						if (frame.parentSessionId !== void 0 && (this.selected === frame.parentSessionId || this.openCatalogs.has(frame.parentSessionId))) this.scheduleCatalogRefresh(frame.parentSessionId);
						return;
					case "host/session-removed": {
						const durableSubagent = this.summaries.find((candidate) => candidate.sessionId === frame.sessionId)?.origin === "subagent" || this.addresses.has(frame.sessionId);
						this.recordMutation(durableSubagent ? {
							kind: "status",
							sessionId: frame.sessionId,
							running: false
						} : {
							kind: "remove",
							sessionId: frame.sessionId
						});
						this.updateCatalogActivity(frame.sessionId, false);
						if (durableSubagent) this.sessions.get(frame.sessionId)?.handleRunning(false);
						else this.sessions.get(frame.sessionId)?.handleRemoved();
						this.pendingBuffers.delete(frame.sessionId);
						this.pendingInteractions.delete(frame.sessionId);
						if (!durableSubagent) this.projectionStores.delete(frame.sessionId);
						const inflightCatalog = this.catalogInflight.get(frame.sessionId);
						if (inflightCatalog !== void 0) {
							inflightCatalog.parentAvailableOverride = false;
							this.catalogStale.add(frame.sessionId);
						}
						const ownedCatalog = this.catalogs.get(frame.sessionId);
						if (ownedCatalog !== void 0 && ownedCatalog.parentAvailable) this.catalogs.set(frame.sessionId, {
							...ownedCatalog,
							parentAvailable: false
						});
						for (const [childId, address] of this.addresses) {
							if (address.parentSessionId !== frame.sessionId) continue;
							this.sessions.get(childId)?.handleSubagentParentAvailable(false);
						}
						return;
					}
					case "host/session-status":
						this.recordMutation({
							kind: "status",
							sessionId: frame.sessionId,
							running: frame.running
						});
						this.sessions.get(frame.sessionId)?.handleRunning(frame.running);
						this.updateCatalogActivity(frame.sessionId, frame.running);
						return;
					case "host/agent-error":
						this.sessions.get(frame.sessionId)?.handleAgentError(frame.message);
						return;
					default: return;
				}
			}
			/**
			* The moment a connection generation dies (before any next-generation frame
			* can arrive — onConnected waits for the readiness handshake while replayed
			* frames flow from stream open, so clearing there would race the replay):
			* drop generation-scoped live state. Interactions resolved while disconnected
			* send no frame, so stale statuses and buffered answerable frames must not
			* survive into the next generation — mux-open replay re-adds every still-pending
			* request with its live rpcId.
			*/
			handleDisconnected() {
				if (this.pendingInteractions.size > 0) {
					this.pendingInteractions.clear();
					this.notifier.markDirty();
				}
				for (const [sessionId, buffer] of [...this.pendingBuffers]) {
					const kept = buffer.filter((item) => item.payload.type !== "approval/requested" && item.payload.type !== "question/requested");
					if (kept.length === buffer.length) continue;
					if (kept.length === 0) this.pendingBuffers.delete(sessionId);
					else this.pendingBuffers.set(sessionId, kept);
				}
			}
			/** After each connection generation: refresh the session baseline and rebuild opened windows. */
			handleConnected() {
				this.refreshList();
				const selectedAddress = this.selected === void 0 ? void 0 : this.addresses.get(this.selected);
				if (selectedAddress !== void 0) this.refreshSubagents(selectedAddress.parentSessionId);
				if (this.selected !== void 0) this.refreshSubagents(this.selected);
				for (const parentSessionId of this.openCatalogs) this.refreshSubagents(parentSessionId);
				for (const session of this.sessions.values()) session.resync();
			}
			/** Debounce membership refetches while one parent catalog is selected or open. */
			scheduleCatalogRefresh(parentSessionId) {
				if (this.catalogDebounce.has(parentSessionId)) return;
				const timer = setTimeout(() => {
					this.catalogDebounce.delete(parentSessionId);
					if (this.catalogInflight.has(parentSessionId)) {
						this.catalogStale.add(parentSessionId);
						return;
					}
					this.refreshSubagents(parentSessionId);
				}, 50);
				this.catalogDebounce.set(parentSessionId, timer);
			}
			/** Apply one Agent-driver transition to loaded and in-flight catalogs. */
			updateCatalogActivity(childSessionId, running) {
				const activity = running ? "running" : "inactive";
				for (const inflight of this.catalogInflight.values()) inflight.activityRows.set(childSessionId, activity);
				let changed = false;
				for (const [parentSessionId, catalog] of this.catalogs) {
					if (!catalog.entries.some((entry) => entry.kind === "child" && entry.id === childSessionId && entry.activity !== activity)) continue;
					const entries = catalog.entries.map((entry) => {
						if (entry.kind !== "child" || entry.id !== childSessionId) return entry;
						return {
							...entry,
							activity
						};
					});
					changed = true;
					this.catalogs.set(parentSessionId, {
						...catalog,
						entries
					});
				}
				if (changed) this.notifier.markDirty();
			}
			/** Preserve and project a positive expandability hint after one direct subagent publishes. */
			markCatalogParentExpandable(parentSessionId) {
				this.applyCatalogParentExpandable(parentSessionId);
				for (const inflight of this.catalogInflight.values()) inflight.expandableRows.add(parentSessionId);
			}
			/** Apply one positive expandability hint to every loaded catalog containing that unique row id. */
			applyCatalogParentExpandable(parentSessionId) {
				let changed = false;
				for (const [catalogParentId, catalog] of this.catalogs) {
					if (!catalog.entries.some((entry) => entry.kind === "child" && entry.id === parentSessionId && !entry.hasChildren)) continue;
					const entries = catalog.entries.map((entry) => {
						if (entry.kind !== "child" || entry.id !== parentSessionId || entry.hasChildren) return entry;
						return {
							...entry,
							hasChildren: true
						};
					});
					changed = true;
					this.catalogs.set(catalogParentId, {
						...catalog,
						entries
					});
				}
				if (changed) this.notifier.markDirty();
			}
			/** Fold request-local row mutations into one catalog result before publication. */
			withCatalogMutations(entries, expandableRows, activityRows) {
				return entries.map((entry) => {
					if (entry.kind !== "child") return entry;
					const activity = activityRows.get(entry.id);
					if (!expandableRows.has(entry.id) && activity === void 0) return entry;
					return {
						...entry,
						...expandableRows.has(entry.id) ? { hasChildren: true } : {},
						...activity === void 0 ? {} : { activity }
					};
				});
			}
			/**
			* Reconcile completion reminders against the latest summaries, eagerly after
			* every mutation and pull (a snapshot-build-time pass would collapse
			* consecutive status frames into one observation). A running→idle edge of a
			* non-selected session arms its reminder; running disarms it; removal drops
			* it. First observation only records the running bit — sessions already
			* idle at load get no reminder.
			*/
			syncCompletedNotifications() {
				const seen = /* @__PURE__ */ new Set();
				for (const s of this.summaries) {
					seen.add(s.sessionId);
					const prev = this.prevRunning.get(s.sessionId);
					if (prev === void 0) {
						this.prevRunning.set(s.sessionId, s.running);
						continue;
					}
					if (prev && !s.running) {
						if (s.sessionId !== this.selected) this.completedNotifications.add(s.sessionId);
					} else if (s.running) this.completedNotifications.delete(s.sessionId);
					this.prevRunning.set(s.sessionId, s.running);
				}
				for (const id of this.prevRunning.keys()) if (!seen.has(id)) this.prevRunning.delete(id);
				for (const id of this.completedNotifications) if (!seen.has(id)) this.completedNotifications.delete(id);
			}
			buildListSnapshot() {
				const merged = this.summaries.map((summary) => {
					const projectionStore = this.projectionStores.get(summary.sessionId);
					const title = projectionStore?.get("title");
					const projectionValues = projectionStore?.values();
					return {
						...summary,
						...typeof title === "string" && title !== "" ? { title } : {},
						...projectionValues === void 0 ? {} : { projectionValues }
					};
				});
				const pendingInteractions = /* @__PURE__ */ new Map();
				for (const [sessionId, interactions] of this.pendingInteractions) {
					const statuses = [...interactions.values()];
					const status = statuses.find((candidate) => candidate !== "approval") ?? statuses[0];
					if (status !== void 0) pendingInteractions.set(sessionId, status);
				}
				const items = flattenLineage(merged, pendingInteractions, this.completedNotifications).map((entry) => {
					const prev = this.entryCache.get(entry.sessionId);
					if (prev !== void 0 && prev.updatedAt === entry.updatedAt && prev.running === entry.running && prev.blank === entry.blank && prev.parentSessionId === entry.parentSessionId && prev.cwd === entry.cwd && prev.origin === entry.origin && prev.title === entry.title && prev.depth === entry.depth && prev.pendingInteraction === entry.pendingInteraction && prev.projectionValues === entry.projectionValues && prev.completed === entry.completed) return prev;
					this.entryCache.set(entry.sessionId, entry);
					return entry;
				});
				for (const id of this.entryCache.keys()) if (!items.some((e) => e.sessionId === id)) this.entryCache.delete(id);
				if (!(items.length === this.itemsCache.length && items.every((e, i) => e === this.itemsCache[i]))) this.itemsCache = items;
				const selected = this.selected;
				const current = selected !== void 0 && (items.some((item) => item.sessionId === selected) || this.addresses.has(selected)) ? selected : void 0;
				return {
					items: this.itemsCache,
					current,
					state: this.listState,
					phase: this.listPhase,
					error: this.listError,
					subagentsByParent: Object.fromEntries(this.catalogs),
					currentAddress: current === void 0 ? void 0 : this.addresses.get(current)
				};
			}
		};
		/** Apply one list mutation without deriving display order. */
		function applyMutation(summaries, mutation) {
			switch (mutation.kind) {
				case "upsert": {
					const existing = summaries.find((summary) => summary.sessionId === mutation.summary.sessionId);
					if (existing === void 0) return [mutation.summary, ...summaries];
					const filled = {
						...existing,
						blank: existing.blank && mutation.summary.blank,
						...existing.cwd === void 0 && mutation.summary.cwd !== void 0 ? { cwd: mutation.summary.cwd } : {},
						...existing.parentSessionId === void 0 && mutation.summary.parentSessionId !== void 0 ? { parentSessionId: mutation.summary.parentSessionId } : {},
						...existing.origin === void 0 && mutation.summary.origin !== void 0 ? { origin: mutation.summary.origin } : {}
					};
					if (filled.cwd === existing.cwd && filled.parentSessionId === existing.parentSessionId && filled.origin === existing.origin && filled.blank === existing.blank) return [...summaries];
					return summaries.map((summary) => summary.sessionId === mutation.summary.sessionId ? filled : summary);
				}
				case "remove": return summaries.filter((summary) => summary.sessionId !== mutation.sessionId);
				case "status": return summaries.map((summary) => summary.sessionId === mutation.sessionId && (summary.running !== mutation.running || mutation.running && summary.blank) ? {
					...summary,
					running: mutation.running,
					blank: summary.blank && !mutation.running
				} : summary);
				case "engaged": return summaries.map((summary) => summary.sessionId === mutation.sessionId && summary.blank ? {
					...summary,
					blank: false
				} : summary);
			}
		}
		/** Temporary source-plane bridge while the Host contract and client project build independently. */
		function workspaceAttachSessionId(error) {
			const candidate = error;
			return candidate.code === "workspace-attach-failed" ? candidate.details.sessionId : void 0;
		}
		//#endregion
		//#region src/client/sessions/provide.ts
		/**
		* Provider roster + materialization + current projection. The channel owns
		* every rule a provider contribution must satisfy; owners keep only their
		* per-session bundle storage and the definition of "current".
		*/
		var SessionProvideChannel = class {
			host;
			providers = [];
			maybeInfoCache;
			/** Latest published current bundle (identity comparison dedupes republish). */
			currentSnapshot;
			/** Projection subscribers (plain cell: bundles hold live session sources, so no store freeze may touch them). */
			listeners = /* @__PURE__ */ new Set();
			/**
			* Atomic current-session provide projection: selection changes and
			* provider-roster changes publish through this one source, so a roster
			* change under a stable current id republishes the bundle instead of
			* stranding mounted entries.
			*/
			currentProvideInfo;
			/**
			* @param host - owner-side bundle storage and current-selection resolution.
			*/
			constructor(host) {
				this.host = host;
				this.providers.push({
					hooks: ["session"],
					resolve: (binding) => ({ hooks: { session: binding.session } })
				});
				this.maybeInfoCache = this.materializeMaybeInfo();
				this.currentSnapshot = this.maybeInfoCache;
				this.currentProvideInfo = {
					getSnapshot: () => {
						return this.currentSnapshot;
					},
					subscribe: (fn) => {
						this.listeners.add(fn);
						return () => {
							this.listeners.delete(fn);
						};
					}
				};
			}
			/** The static no-session projection under the current roster (declared names present, values undefined). */
			get maybeInfo() {
				return this.maybeInfoCache;
			}
			/**
			* Register a per-session standard-props provider (see
			* SessionsService.provide for the product contract). Live bundles rebuild
			* immediately; misdeclared providers fail loud here, at the registration
			* edge, and the registration rolls back — the channel never stays on a
			* roster it cannot materialize.
			* @param descriptor - static member roster plus per-session resolver.
			* @returns disposer removing the provider.
			*/
			provide(descriptor) {
				this.providers.push(descriptor);
				try {
					this.applyRosterChange();
				} catch (error) {
					this.providers.splice(this.providers.indexOf(descriptor), 1);
					this.applyRosterChange();
					throw error;
				}
				return () => {
					const at = this.providers.indexOf(descriptor);
					if (at >= 0) this.providers.splice(at, 1);
					this.applyRosterChange();
				};
			}
			/**
			* Re-derive the current selection's bundle and publish it when it changed.
			* Bundles are identity-stable per (scope, roster) materialization, so an
			* identity compare is exact; synchronous notify — call sites (the owner's
			* list subscription, provide()) already sit behind their own batching or
			* registration edges.
			*/
			publishCurrent() {
				const next = this.host.resolveCurrent();
				if (next === this.currentSnapshot) return;
				this.currentSnapshot = next;
				for (const fn of [...this.listeners]) try {
					fn();
				} catch (error) {
					console.error("sessions.currentProvideInfo subscriber failed:", error);
				}
			}
			/**
			* Materialize the standard-props bundle for one session (fails loud on
			* undeclared, missing, and duplicate member names).
			* @param binding - session assembly handle fed to every resolver.
			* @returns the materialized bundle (identity-stable until the next materialization).
			*/
			materializeInfo(binding) {
				const hooks = {};
				const props = {};
				for (const descriptor of this.providers) {
					const contribution = descriptor.resolve(binding);
					const contributedHooks = contribution.hooks ?? {};
					const contributedProps = contribution.props ?? {};
					for (const name of Object.keys(contributedHooks)) if (!(descriptor.hooks ?? []).includes(name)) throw new Error(`sessions.provide: undeclared hook "${name}"`);
					for (const name of Object.keys(contributedProps)) if (!(descriptor.props ?? []).includes(name)) throw new Error(`sessions.provide: undeclared prop "${name}"`);
					for (const name of descriptor.hooks ?? []) {
						const source = contributedHooks[name];
						if (source === void 0) throw new Error(`sessions.provide: missing hook "${name}"`);
						if (Object.hasOwn(hooks, name)) throw new Error(`sessions.provide: duplicate hook "${name}"`);
						hooks[name] = source;
					}
					for (const name of descriptor.props ?? []) {
						if (!Object.hasOwn(contributedProps, name)) throw new Error(`sessions.provide: missing prop "${name}"`);
						if (Object.hasOwn(props, name)) throw new Error(`sessions.provide: duplicate prop "${name}"`);
						props[name] = contributedProps[name];
					}
				}
				return {
					sessionId: binding.sessionId,
					hooks,
					props,
					projections: { faceOf: (key) => binding.session.projections.faceOf(key) }
				};
			}
			/** Rebuild the static projection and the owner's live bundles, then republish the current one. */
			applyRosterChange() {
				this.maybeInfoCache = this.materializeMaybeInfo();
				this.host.rebuildBundles();
				this.publishCurrent();
			}
			/** Build the static no-session kit and reject duplicate declared names. */
			materializeMaybeInfo() {
				const hooks = {};
				const props = {};
				for (const descriptor of this.providers) {
					for (const name of descriptor.hooks ?? []) {
						if (Object.hasOwn(hooks, name)) throw new Error(`sessions.provide: duplicate hook "${name}"`);
						hooks[name] = void 0;
					}
					for (const name of descriptor.props ?? []) {
						if (Object.hasOwn(props, name)) throw new Error(`sessions.provide: duplicate prop "${name}"`);
						props[name] = void 0;
					}
				}
				return {
					sessionId: void 0,
					hooks,
					props
				};
			}
		};
		//#endregion
		//#region src/client/sessions/service.ts
		/** Structured session-create failure. */
		var SessionCreateError = class extends Error {
			rpcError;
			requestedSessionId;
			name = "SessionCreateError";
			/**
			* @param rpcError - Host business or folded transport error.
			* @param requestedSessionId - caller-preallocated id used for later stream/list reconciliation.
			*/
			constructor(rpcError, requestedSessionId) {
				super(`session create failed: ${rpcError.code}: ${rpcError.message}`);
				this.rpcError = rpcError;
				this.requestedSessionId = requestedSessionId;
			}
		};
		/** Structured session-fork failure. */
		var SessionForkError = class extends Error {
			rpcError;
			sourceSessionId;
			name = "SessionForkError";
			/**
			* @param rpcError - Host business or folded transport error.
			* @param sourceSessionId - the session the fork was cut from.
			*/
			constructor(rpcError, sourceSessionId) {
				super(`session fork failed: ${rpcError.code}: ${rpcError.message}`);
				this.rpcError = rpcError;
				this.sourceSessionId = sourceSessionId;
			}
		};
		/**
		* Workspace display title of a session cwd: the path's last non-empty
		* segment (both separators accepted; trailing separators ignored), or ''
		* for separator-only paths — callers own their fallback (session id, raw
		* cwd, default-directory copy). The repo-wide single basename derivation —
		* every surface naming a workspace (picker rows, toggle labels, list titles)
		* calls this instead of re-splitting paths.
		* @param cwd - workspace directory path.
		* @returns basename title, or '' when no non-empty segment exists.
		*/
		function workspaceTitleOf(cwd) {
			return cwd.replace(/[/\\]+$/, "").split(/[/\\]/).pop() ?? "";
		}
		/**
		* Display title projection: durable title, project directory basename, then
		* the raw id.
		*/
		function displayTitleOf(title, cwd, id) {
			if (title !== void 0) return title;
			if (cwd !== void 0 && cwd !== "") {
				const base = workspaceTitleOf(cwd);
				if (base !== "") return base;
			}
			return id;
		}
		/**
		* Increment a trailing fork number while preserving its half-width or
		* full-width parentheses; an unnumbered title starts with ` (1)`.
		* @param title - source session's durable title.
		* @returns the title assigned to the fork child.
		*/
		function increasedForkTitle(title) {
			const ascii = /^(.*?)\((\d+)\)$/u.exec(title);
			if (ascii?.[1] !== void 0 && ascii[2] !== void 0) return `${ascii[1]}(${BigInt(ascii[2]) + 1n})`;
			const fullWidth = /^(.*?)（(\d+)）$/u.exec(title);
			if (fullWidth?.[1] !== void 0 && fullWidth[2] !== void 0) return `${fullWidth[1]}（${BigInt(fullWidth[2]) + 1n}）`;
			return `${title} (1)`;
		}
		/** Root sessions service: list store, current selection, object-layer manager, scope tree, bindings, and breadcrumb routes. */
		var SessionsService = class {
			rootCtx;
			/**
			* The wire schema's own result bound, re-exposed for presentation plugins as
			* injected data. Not per-connection state: the `session.search` response
			* schema caps `items` at this constant, so every transport (fixture included)
			* reports the same number.
			*/
			searchResultLimit = 20;
			/** List snapshot store (list RPC + host stream increments; re-pulled on reconnect) — the useSessions standard feed, current included. */
			list;
			/** The object-layer instance cluster and frame dispatch entry. */
			manager;
			/**
			* Atomic current-session provide projection: selection changes and
			* provider-roster changes publish through this one source (the renderer
			* host's `sessions.provide` feed), so a roster change under a stable
			* current id republishes the bundle instead of stranding mounted entries.
			*/
			currentProvideInfo;
			/**
			* Persisted selection cell (the durable half of `list.current`). Private on
			* purpose: reads go through the list snapshot; writes through {@link
			* SessionsService.open} / {@link SessionsService.clear}. Projection
			* validates it against the live list instead of destructively pruning, so a
			* selection survives transient list states (reconnect re-pull) and
			* resurfaces when its session returns.
			*/
			selection;
			scopes = /* @__PURE__ */ new Map();
			/** The provide channel (roster, materialization rules, current projection) — shared with the test runtime's double. */
			provideChannel;
			/**
			* The staged session id — follows `list.current` exactly, holding its last
			* defined value across masked gaps (a transiently absent selection blanks
			* `current` without moving the stage, so reconnect re-pulls and removals
			* keep the staged scope's frozen view alive until the stage moves on).
			*/
			watched;
			/** Removed-while-staged sessions whose teardown waits for the stage to move away. */
			deferredRemovals = /* @__PURE__ */ new Set();
			/**
			* @param ctx - client root context (scope fibers mount under it).
			* @param api - wire client shared with every Session.
			*/
			constructor(rootCtx, api) {
				this.rootCtx = rootCtx;
				this.selection = createSnapshotStore({}, { persist: { name: "dsh.sessions.current" } });
				const restored = this.selection.getSnapshot();
				this.manager = new SessionManager(api, restored.sessionId, restored.subagentAddress);
				this.list = createSnapshotStore({
					ids: [],
					byId: {},
					current: void 0,
					phase: "pending",
					subagentsByParent: {},
					currentAddress: void 0
				});
				this.manager.subscribe(() => {
					this.projectList();
				});
				this.list.subscribe(() => {
					this.followCurrent();
					this.provideChannel.publishCurrent();
				});
				this.provideChannel = new SessionProvideChannel({
					rebuildBundles: () => {
						for (const record of this.scopes.values()) record.provideInfo = this.provideChannel.materializeInfo(record.binding);
					},
					resolveCurrent: () => this.maybeProvideInfo(this.list.getSnapshot().current)
				});
				this.currentProvideInfo = this.provideChannel.currentProvideInfo;
				rootCtx.reflect.provide("sessions", this, void 0);
			}
			/**
			* Register a per-session standard-props provider: every session-scope slot
			* component receives the contributed members as standard props (`hooks`
			* sources become `use<Name>` selector hooks on the render side; `props`
			* spread verbatim). Contributions materialize lazily with the session's
			* scope record and die with it. Registration order is resolution order;
			* duplicate member names fail loud at materialization.
			* @param descriptor - static member roster plus per-session resolver.
			* @returns disposer removing the provider (already-materialized bundles keep their members until their scope drops).
			*/
			provide(descriptor) {
				return this.provideChannel.provide(descriptor);
			}
			/**
			* Select a listed or retained catalog-addressed session as current.
			* @param id - listed or addressed session id.
			*/
			open(id) {
				this.manager.select(id);
			}
			/**
			* Open a healthy catalog child through its direct-parent address.
			* @param address - catalog-derived parent and child ids.
			*/
			openSubagent(address) {
				this.manager.selectSubagent(address);
			}
			/**
			* Resolve an already discovered direct-parent address without opening it.
			* Feature plugins use this to avoid Agent-bound RPCs in persisted child views.
			* @param id - possible addressed child id.
			* @returns The retained address, when present.
			*/
			subagentAddress(id) {
				return this.manager.subagentAddress(id);
			}
			/**
			* Inform the runtime whether a catalog menu is consuming membership updates.
			* @param parentSessionId - selected parent.
			* @param open - menu state.
			*/
			setSubagentCatalogOpen(parentSessionId, open) {
				this.manager.setSubagentCatalogOpen(parentSessionId, open);
			}
			/**
			* Refresh one direct-child catalog.
			* @param parentSessionId - catalog owner.
			*/
			refreshSubagents(parentSessionId) {
				return this.manager.refreshSubagents(parentSessionId);
			}
			/**
			* Clear the current selection so the layout shows the no-session empty
			* state (new-session affordance and the workspace preselection flow).
			* Wipes the persisted selection too — a reload stays on empty until the
			* user opens or starts a session. The staged scope keeps its frozen view
			* per the masked-gap contract until the next open() moves the stage.
			*/
			clear() {
				this.manager.clearSelection();
			}
			/**
			* Refresh the real Session baseline, reusing an in-flight pull.
			* @returns completion of the current or newly started baseline pull.
			*/
			refresh() {
				return this.manager.refreshList();
			}
			/**
			* Search the Host's visible message-content index. Results stay
			* request-local; the list snapshot remains the metadata authority.
			* @param query - non-blank literal phrase.
			* @param signal - cancellation for a superseded search.
			* @returns bounded results or a business/transport error.
			*/
			search(query, signal) {
				return this.manager.search(query, signal);
			}
			/**
			* Route a mux stream envelope into the Session object layer.
			* @param envelope - validated mux stream envelope.
			*/
			handleMuxEnvelope(envelope) {
				this.manager.handleMuxEnvelope(envelope);
			}
			/**
			* Route a Host stream envelope into the Session object layer.
			* @param envelope - validated Host stream envelope.
			*/
			handleHostEnvelope(envelope) {
				this.manager.handleHostEnvelope(envelope);
			}
			/** Rebuild the Session baseline and every opened window after connection. */
			handleConnected() {
				this.manager.handleConnected();
			}
			/** Drop generation-scoped live interaction state the moment a connection generation dies. */
			handleDisconnected() {
				this.manager.handleDisconnected();
			}
			/**
			* Create a session on the host. Resolution guarantee: by the time the
			* promise resolves, the created session is in the list store and
			* {@link SessionsService.binding} resolves it — callers (New Session
			* draft hand-off) may address the scope synchronously, without waiting a
			* notifier flush. The synchronous projection below makes this structural
			* rather than an accident of microtask ordering.
			* @param opts - target workspace or directory and an optional preallocated id.
			* @returns the new session id.
			* @throws {SessionCreateError} with the requested id.
			*/
			async create(opts = {}) {
				const result = await this.manager.create(opts);
				if (!result.ok) throw new SessionCreateError(result.error, opts.sessionId);
				this.projectList();
				return result.value.sessionId;
			}
			/**
			* Fork a session from a completed-turn prefix of the source (same
			* synchronous-addressability guarantee as {@link SessionsService.create}:
			* on resolution the child is in the list store and open() can target it).
			* @param opts - source session id, the optional event seq anchoring the
			*   cut (the boundary is the first turn/end at or after it; an in-log
			*   anchor in an open turn is unavailable rather than clipped backward),
			*   and whether to increment an inherited durable title before resolving.
			*   A fractional anchor floors to a real event seq: the frozen nodes of an
			*   interrupted turn carry flow-ordering seqs between two events, and the
			*   wire takes integers only.
			* @returns the child session id.
			* @throws {SessionForkError} with the source id.
			* @throws {Error} when a requested child-title rename fails after creation.
			*/
			async fork(opts) {
				const sourceTitle = opts.increaseTitle ? this.list.getSnapshot().byId[opts.sessionId]?.title : void 0;
				const result = await this.manager.fork({
					sessionId: opts.sessionId,
					...opts.atSeq === void 0 ? {} : { atSeq: Math.floor(opts.atSeq) }
				});
				if (!result.ok) throw new SessionForkError(result.error, opts.sessionId);
				this.projectList();
				const childId = result.value.sessionId;
				if (sourceTitle !== void 0) {
					const child = this.binding(childId)?.session;
					if (child === void 0) throw new Error(`fork child "${childId}" is not locally addressable`);
					const renamed = await child.rename(increasedForkTitle(sourceTitle));
					if (!renamed.ok) throw new Error(`fork child rename failed: ${renamed.error.code}: ${renamed.error.message}`);
				}
				return childId;
			}
			/**
			* Resolve an Agent-scoped context view (use-and-discard).
			* @param id - session id (the agent identity — 1:1 same axis).
			* @returns scoped ctx, or undefined for a session neither listed nor already scoped.
			*/
			scope(id) {
				return this.resolve(id)?.ctx;
			}
			/**
			* Read the Agent scope tag off a context. Service-method seam: fetch
			* bundles must reach scope resolution through ctx.sessions — a cross-bundle
			* value import of the standalone helper would inline a second module
			* instance whose private tag Symbol never matches.
			* @param ctx - any client context.
			* @returns the session id, or undefined on root contexts.
			*/
			scopeOf(ctx) {
				return scopeOf(ctx);
			}
			/**
			* Resolve the business Session behind an Agent-scoped context — the one
			* hop every scoped consumer (event listeners, per-session controllers)
			* takes from ctx-space into object-space (the client mirror of host
			* `agent.session`). Same service-method seam as
			* {@link SessionsService.scopeOf}.
			* @param ctx - an Agent-scoped context.
			* @returns the session face, or undefined when the ctx is untagged or its scope was pruned.
			*/
			sessionOf(ctx) {
				const id = scopeOf(ctx);
				if (id === void 0) return void 0;
				return this.scopes.get(id)?.binding.session;
			}
			/**
			* Resolve the stable session binding (scope-addressed assembly feed). Pure
			* resolution — no staging, no window side effects.
			* @param id - session id.
			* @returns binding, or undefined for a session neither listed nor already scoped.
			*/
			binding(id) {
				return this.resolve(id)?.binding;
			}
			/**
			* Resolve one session's render-layer standard-props bundle (ctx never
			* enters the render layer; the renderer subscribes to
			* {@link SessionsService.currentProvideInfo}). Pure resolution — render-safe:
			* no staging, no window side effects (StrictMode double-invokes and
			* concurrent discarded passes must stay free).
			*/
			provideInfo(id) {
				return this.resolve(id)?.provideInfo;
			}
			/**
			* Resolve the current-session-optional standard kit. Unknown or absent ids
			* return the static no-session projection rather than removing hook props.
			*/
			maybeProvideInfo(id) {
				return (id === void 0 ? void 0 : this.provideInfo(id)) ?? this.provideChannel.maybeInfo;
			}
			/**
			* Move the stage to the list's current session: sweep teardowns deferred
			* behind the previous occupant and pull the new occupant's history window.
			* Staging IS the open signal — the window opens ⟺ the session is on stage
			* — and open() is idempotent (an in-flight or completed open no-ops; a
			* failed one retries the next time current is touched).
			*/
			followCurrent() {
				const snapshot = this.list.getSnapshot();
				const current = snapshot.current;
				if (current === void 0 || snapshot.byId[current] === void 0 || current === this.watched) return;
				this.watched = current;
				this.sweepDeferred();
				const record = this.resolve(current);
				/* v8 ignore next 3 -- defensive: current is always a listed id (open()
				* validates and the projection masks absent selections), so resolve
				* cannot miss; kept so a future current writer cannot crash the notify. */
				if (record !== void 0) {
					record.session.open();
					this.manager.refreshSubagents(current);
				}
			}
			/**
			* Lazily mint the scope + binding for an eligible session. Eligibility and
			* prune share one predicate (decision 12): listed on the host or selected
			* through a retained subagent address. Breadcrumb-only ancestors remain
			* summary data and do not keep scopes alive.
			*/
			resolve(id) {
				const existing = this.scopes.get(id);
				if (existing !== void 0) return existing;
				if (!this.eligible(id)) return void 0;
				const { fiber, ctx } = createScope(this.rootCtx, id);
				const session = this.manager.get(id);
				session.bindScope(ctx);
				const binding = {
					sessionId: id,
					session,
					ctx
				};
				const record = {
					fiber,
					ctx,
					binding,
					session,
					provideInfo: this.provideChannel.materializeInfo(binding)
				};
				this.scopes.set(id, record);
				return record;
			}
			/** The one aliveness predicate shared by scope mint and prune: host-listed or currently addressed. */
			eligible(id) {
				const { ids, current } = this.list.getSnapshot();
				return current === id || ids.includes(id);
			}
			/** Project the manager's list snapshot into the store (title derivation is display-only). */
			projectList() {
				const { items, current, phase, subagentsByParent, currentAddress } = this.manager.getListSnapshot();
				const ids = [];
				const byId = {};
				for (const entry of items) {
					ids.push(entry.sessionId);
					byId[entry.sessionId] = {
						id: entry.sessionId,
						displayTitle: displayTitleOf(entry.title, entry.cwd, entry.sessionId),
						running: entry.running,
						...entry.completed ? { completed: true } : {},
						blank: entry.blank,
						updatedAt: entry.updatedAt,
						...entry.pendingInteraction === void 0 ? {} : { pendingInteraction: entry.pendingInteraction },
						...entry.projectionValues === void 0 ? {} : { projectionValues: entry.projectionValues },
						...entry.title === void 0 ? {} : { title: entry.title },
						...entry.cwd !== void 0 ? { cwd: entry.cwd } : {},
						...entry.parentSessionId !== void 0 ? { parentId: entry.parentSessionId } : {},
						...entry.origin !== void 0 ? { origin: entry.origin } : {}
					};
				}
				if (current !== void 0 && currentAddress !== void 0) {
					const seen = /* @__PURE__ */ new Set();
					let address = currentAddress;
					while (address !== void 0 && !seen.has(address.childSessionId)) {
						const childId = address.childSessionId;
						seen.add(childId);
						const child = subagentsByParent[address.parentSessionId]?.entries.find((entry) => entry.kind === "child" && entry.id === childId);
						if (child?.kind !== "child") break;
						const displayTitle = child.label ?? childId;
						const summary = byId[childId];
						if (summary === void 0) byId[childId] = {
							id: childId,
							displayTitle,
							parentId: address.parentSessionId,
							origin: "subagent",
							running: child.activity === "running",
							blank: false,
							updatedAt: 0
						};
						else if (summary.displayTitle !== displayTitle) byId[childId] = {
							...summary,
							displayTitle
						};
						const parent = byId[address.parentSessionId];
						if (parent !== void 0 && parent.origin !== "subagent") break;
						address = this.manager.navigationAddress(address.parentSessionId);
					}
				}
				const persisted = this.selection.getSnapshot().sessionId;
				if (current === void 0) {
					if (persisted !== void 0) this.selection.set({});
				} else if (byId[current] !== void 0 && (persisted !== current || this.selection.getSnapshot().subagentAddress?.childSessionId !== currentAddress?.childSessionId || this.selection.getSnapshot().subagentAddress?.parentSessionId !== currentAddress?.parentSessionId || this.selection.getSnapshot().subagentAddress?.mode !== currentAddress?.mode)) this.selection.set({
					sessionId: current,
					...currentAddress === void 0 ? {} : { subagentAddress: currentAddress }
				});
				this.list.set({
					ids,
					byId,
					current,
					phase,
					subagentsByParent,
					currentAddress
				});
				this.pruneScopes();
			}
			/** Tear down scope + instance for no-longer-eligible sessions off stage; the staged one defers until the stage moves. */
			pruneScopes() {
				for (const [id, record] of this.scopes) {
					if (this.eligible(id)) continue;
					if (id === this.watched) {
						this.deferredRemovals.add(id);
						continue;
					}
					this.scopes.delete(id);
					this.deferredRemovals.delete(id);
					this.dropScope(id, record);
				}
			}
			/**
			* One teardown for the whole per-session axis (decision 12): the scope
			* fiber (cascading every actx-registered effect: input shell, slash
			* controller, popup, plugin stores, listeners), the session-keyed slot
			* stores, and the Session instance itself — the host session log is the
			* durable truth, a reopen lazily rebuilds and backfills via open().
			*/
			dropScope(id, record) {
				record.fiber.dispose();
				record.session.unbindScope();
				this.rootCtx.get("slots")?.pruneStoreScope(id);
				this.manager.drop(id);
			}
			/** Run deferred teardowns whose session is no longer staged (called when the stage moves). */
			sweepDeferred() {
				for (const id of [...this.deferredRemovals]) {
					/* v8 ignore next -- defensive: only the staged id ever defers, and every
					* stage move sweeps first, so the set cannot contain the id the stage just
					* moved to; kept as a guard against future extra sweep call sites. */
					if (id === this.watched) continue;
					if (this.eligible(id)) {
						this.deferredRemovals.delete(id);
						continue;
					}
					const record = this.scopes.get(id);
					this.deferredRemovals.delete(id);
					/* v8 ignore next -- defensive: prune deletes a scope and its deferral
					* together, so a deferred id always still owns its record; kept so a
					* future teardown path cannot double-dispose. */
					if (record !== void 0) {
						this.scopes.delete(id);
						this.dropScope(id, record);
					}
				}
			}
		};
		//#endregion
		//#region src/client/session-history/history-fold.ts
		function replacementCrossesWindowHead(event, baseSeq) {
			if (!isSurfaceEvent(event) || event.surfaceOp === "append") return false;
			return event.surfaceOp.start < baseSeq || event.surfaceOp.end < baseSeq;
		}
		function contextOriginKind(event) {
			if (event?.type !== "user/message") return "rewrite";
			const source = event.data.source;
			if (typeof source === "object" && "kind" in source && "plugin" in source) {
				if (source.plugin === "compact") return "compaction";
				if (source.plugin === "rewind") return "rewind";
			}
			return "rewrite";
		}
		function foldContexts(events) {
			const replay = [];
			const originalSeqs = [];
			const rebasedSeqByOriginal = /* @__PURE__ */ new Map();
			const surface = new SurfaceManager(replay);
			const contexts = [];
			let generation = 0;
			let originSeq;
			const originalNodes = () => surface.nodes.map((seq) => {
				const original = originalSeqs[seq];
				if (original === void 0) throw new Error(`rebased surface seq ${seq} has no origin`);
				return original;
			});
			for (const event of events) {
				if (!isSurfaceEvent(event)) continue;
				if (event.surfaceOp !== "append") {
					contexts.push({
						generation,
						nodes: originalNodes(),
						...originSeq === void 0 ? {} : { originSeq }
					});
					generation++;
					originSeq = event.seq;
				}
				const rebasedSeq = replay.length;
				const { sourceEventSeqs: rawSources, ...eventWithoutSources } = event;
				const mappedSourceEventSeqs = rawSources?.flatMap((seq) => {
					const rebased = rebasedSeqByOriginal.get(seq);
					return rebased === void 0 ? [] : [rebased];
				});
				const sourceEventSeqs = mappedSourceEventSeqs?.length === 0 ? void 0 : mappedSourceEventSeqs;
				const surfaceOp = event.surfaceOp === "append" ? event.surfaceOp : {
					...event.surfaceOp,
					start: rebasedSeqByOriginal.get(event.surfaceOp.start) ?? event.surfaceOp.start,
					end: rebasedSeqByOriginal.get(event.surfaceOp.end) ?? event.surfaceOp.end
				};
				originalSeqs.push(event.seq);
				rebasedSeqByOriginal.set(event.seq, rebasedSeq);
				replay.push({
					...eventWithoutSources,
					seq: rebasedSeq,
					surfaceOp,
					...sourceEventSeqs === void 0 ? {} : { sourceEventSeqs }
				});
			}
			contexts.push({
				generation,
				nodes: originalNodes(),
				...originSeq === void 0 ? {} : { originSeq }
			});
			return contexts;
		}
		function materializeNode(event, callIndex, resultView, assistantTiming, requestConfig, steering) {
			switch (event.type) {
				case "user/message":
					if (event.data.source.kind !== "user") return {
						kind: "context",
						seq: event.seq,
						time: event.time,
						content: event.data.content,
						source: event.data.source,
						provenance: contextProvenance(event.data.source),
						form: contextForm(event.data.source)
					};
					if (steering) return {
						kind: "steering",
						messageId: event.data.id,
						seq: event.seq,
						time: event.time,
						content: event.data.content,
						source: event.data.source
					};
					return {
						kind: "user",
						seq: event.seq,
						time: event.time,
						content: event.data.content,
						source: event.data.source
					};
				case "assistant/message": return {
					kind: "assistant",
					seq: event.seq,
					time: event.time,
					turn: event.data.turn,
					step: event.data.step,
					blocks: toAssistantBlocks(event.data.message.content),
					usage: event.data.usage,
					provenance: {
						provider: event.data.message.source.provider,
						model: event.data.message.source.model
					},
					...requestConfig !== void 0 ? { requestConfig } : {},
					...assistantTiming === void 0 ? {} : { timing: assistantTiming }
				};
				case "tool/result": {
					const result = event.data.message.content[0];
					const callId = String(event.data.message.source.callId);
					const call = callIndex.get(callId);
					return {
						kind: "tool-result",
						seq: event.seq,
						time: event.time,
						callId,
						call: call === void 0 ? null : {
							name: call.name,
							argsRaw: call.argsRaw
						},
						callTime: call?.time ?? null,
						content: result.content,
						isError: result.isError === true,
						...event.data.error === void 0 ? {} : { error: event.data.error },
						meta: event.data.meta,
						callView: call?.callView ?? null,
						resultView
					};
				}
				default: return {
					kind: "unknown",
					seq: event.seq,
					time: event.time,
					type: event.type,
					data: event.data
				};
			}
		}
		function projectTransient(entries) {
			let partial = null;
			const openCalls = /* @__PURE__ */ new Map();
			const interruptedNodes = [];
			const codeDispatches = /* @__PURE__ */ new Map();
			for (const entry of entries) {
				const { event } = entry;
				if (event.type === "tool/code-dispatch-start") {
					const data = event.data;
					const siblings = codeDispatches.get(data.parentCallId) ?? [];
					codeDispatches.set(data.parentCallId, [...siblings, {
						callId: data.subCallId,
						name: data.name,
						argsRaw: JSON.stringify(data.arguments),
						turn: 0,
						step: 0,
						time: event.time,
						callView: null
					}]);
					continue;
				}
				if (event.type === "tool/code-dispatch") {
					const data = event.data;
					const siblings = codeDispatches.get(data.parentCallId) ?? [];
					const at = siblings.findIndex((sub) => sub.callId === data.subCallId);
					const started = at === -1 ? void 0 : siblings[at];
					const settled = {
						kind: "tool-result",
						seq: event.seq,
						time: event.time,
						callId: data.subCallId,
						call: {
							name: data.name,
							argsRaw: JSON.stringify(data.arguments)
						},
						callTime: started?.time ?? null,
						content: data.content,
						isError: data.isError,
						callView: null,
						resultView: null
					};
					codeDispatches.set(data.parentCallId, at === -1 ? [...siblings, settled] : siblings.map((sub, index) => index === at ? settled : sub));
					continue;
				}
				switch (event.type) {
					case "assistant/chunk": {
						const { turn, step, chunk } = event.data;
						if (partial === null || partial.turn !== turn || partial.step !== step) partial = new PartialAccumulator(turn, step);
						partial.push(chunk);
						break;
					}
					case "assistant/message":
						if (partial?.turn === event.data.turn && partial.step === event.data.step) partial = null;
						break;
					case "tool/call":
						openCalls.set(String(event.data.callId), {
							callId: String(event.data.callId),
							name: event.data.name,
							argsRaw: event.data.arguments,
							turn: event.data.turn,
							step: event.data.step,
							time: event.time,
							callView: entry.view?.for === "call" ? entry.view.view : null
						});
						break;
					case "tool/result":
						openCalls.delete(String(event.data.message.source.callId));
						break;
					case "turn/end": {
						if (partial !== null && partial.turn === event.data.turn) {
							const { blocks } = partial.toPartial();
							if (blocks.some((block) => block.kind === "text" || block.kind === "reasoning" ? block.text !== "" : true)) interruptedNodes.push({
								kind: "assistant",
								seq: event.seq - .9,
								time: event.time,
								turn: partial.turn,
								step: partial.step,
								blocks,
								interrupted: true
							});
							partial = null;
						}
						let callOffset = 0;
						for (const [callId, call] of openCalls) {
							if (call.turn !== event.data.turn) continue;
							openCalls.delete(callId);
							interruptedNodes.push({
								kind: "tool-result",
								seq: event.seq - .8 + callOffset++ * .01,
								time: event.time,
								callId,
								call: {
									name: call.name,
									argsRaw: call.argsRaw
								},
								callTime: call.time,
								content: [],
								isError: true,
								error: {
									name: "Interrupted",
									code: "interrupted"
								},
								callView: call.callView,
								resultView: null
							});
						}
						break;
					}
					default: break;
				}
			}
			return {
				interruptedNodes,
				partial: partial?.toPartial() ?? null,
				runningCalls: [...openCalls.values()],
				codeDispatches
			};
		}
		/**
		* Project one immutable history ledger without reading or mutating Chat state.
		* @param entries - Contiguous history entries in sequence order.
		* @returns Event order, context lineage, and transient tail state.
		*/
		function projectConversationHistory(entries) {
			const events = entries.map((entry) => entry.event);
			const steeringHistory = new SteeringHistory();
			const steeringSeqs = /* @__PURE__ */ new Set();
			for (const event of events) if (steeringHistory.apply(event)) steeringSeqs.add(event.seq);
			const baseSeq = events[0]?.seq ?? 0;
			const eventsBySeq = new Map(events.map((event) => [event.seq, event]));
			const callIndex = /* @__PURE__ */ new Map();
			const resultViews = /* @__PURE__ */ new Map();
			const assistantSteps = /* @__PURE__ */ new Map();
			const assistantTimings = /* @__PURE__ */ new Map();
			const assistantRequestConfigs = /* @__PURE__ */ new Map();
			const promptsByContext = /* @__PURE__ */ new Map();
			let activeRequestConfig;
			let activePrompt;
			let contextGeneration = 0;
			for (const [index, event] of events.entries()) {
				const view = entries[index]?.view;
				if (event.type === "tool/call") callIndex.set(String(event.data.callId), {
					name: event.data.name,
					argsRaw: event.data.arguments,
					time: event.time,
					callView: view?.for === "call" ? view.view : null
				});
				else if (event.type === "tool/result" && view?.for === "result") resultViews.set(event.seq, view.view);
				if (isSurfaceEvent(event) && event.surfaceOp !== "append") {
					contextGeneration++;
					if (activePrompt !== void 0) promptsByContext.set(contextGeneration, activePrompt);
				}
				indexAssistantStepTiming(assistantSteps, event);
				if (event.type === "request/header") {
					activeRequestConfig = event.data.header.config;
					activePrompt = {
						config: event.data.header.config,
						system: event.data.header.system ?? "",
						tools: event.data.header.tools ?? []
					};
					promptsByContext.set(contextGeneration, activePrompt);
				} else if (event.type === "assistant/message") {
					assistantTimings.set(event.seq, settledAssistantTiming(assistantSteps, event.data.turn, event.data.step, event.time));
					if (activeRequestConfig !== void 0) assistantRequestConfigs.set(event.seq, activeRequestConfig);
				}
			}
			const nodeCache = /* @__PURE__ */ new Map();
			const materialize = (seq) => {
				const cached = nodeCache.get(seq);
				if (cached !== void 0) return cached;
				const event = eventsBySeq.get(seq);
				if (event === void 0 || !isSurfaceEligibleType(event.type)) return;
				const node = materializeNode(event, callIndex, resultViews.get(seq) ?? null, assistantTimings.get(seq), assistantRequestConfigs.get(seq), steeringSeqs.has(seq));
				nodeCache.set(seq, node);
				return node;
			};
			const eventNodes = events.flatMap((event) => {
				const node = materialize(event.seq);
				return node === void 0 ? [] : [node];
			});
			let contexts;
			if (events.some((event) => replacementCrossesWindowHead(event, baseSeq))) contexts = [{
				id: 0,
				...activePrompt === void 0 ? {} : { prompt: activePrompt },
				nodes: eventNodes
			}];
			else try {
				contexts = foldContexts(events).map((context) => {
					const nodes = context.nodes.flatMap((seq) => {
						const node = materialize(seq);
						return node === void 0 ? [] : [node];
					});
					const prompt = promptsByContext.get(context.generation);
					if (context.originSeq === void 0) return {
						id: context.generation,
						...prompt === void 0 ? {} : { prompt },
						nodes
					};
					const originEvent = eventsBySeq.get(context.originSeq);
					return {
						id: context.generation,
						parentId: context.generation - 1,
						origin: contextOriginKind(originEvent),
						originSeq: context.originSeq,
						...originEvent === void 0 ? {} : { createdAt: originEvent.time },
						...prompt === void 0 ? {} : { prompt },
						nodes
					};
				});
			} catch (error) {
				console.error("[web-runtime] history surface fold failed, using event order:", error);
				contexts = [{
					id: 0,
					...activePrompt === void 0 ? {} : { prompt: activePrompt },
					nodes: eventNodes
				}];
			}
			return {
				eventNodes,
				contexts,
				...projectTransient(entries)
			};
		}
		//#endregion
		//#region src/client/sessions/request-inspection.ts
		/**
		* Derive the request-centric read model from one immutable history window.
		* Compaction participates as a request purpose rather than a parallel
		* top-level collection. A leading resume/change header exposes its prompt but
		* cannot project a change until the preceding header enters the window.
		* @param entries - Contiguous raw session history.
		* @returns Requests and call-time schemas derived from that history.
		*/
		function inspectRequests(entries) {
			const events = entries.map((entry) => entry.event);
			return {
				requests: deriveRequests(events),
				callSchemas: deriveCallSchemas(events)
			};
		}
		function requestKey(turn, step) {
			return `${turn}\u0000${step}`;
		}
		function addTokenUsage(current, next) {
			const previous = current;
			return {
				inputTokens: (previous?.inputTokens ?? 0) + next.inputTokens,
				outputTokens: (previous?.outputTokens ?? 0) + next.outputTokens,
				...previous?.cacheReadTokens === void 0 && next.cacheReadTokens === void 0 ? {} : { cacheReadTokens: (previous?.cacheReadTokens ?? 0) + (next.cacheReadTokens ?? 0) },
				...previous?.cacheWriteTokens === void 0 && next.cacheWriteTokens === void 0 ? {} : { cacheWriteTokens: (previous?.cacheWriteTokens ?? 0) + (next.cacheWriteTokens ?? 0) },
				...previous?.reasoningTokens === void 0 && next.reasoningTokens === void 0 ? {} : { reasoningTokens: (previous?.reasoningTokens ?? 0) + (next.reasoningTokens ?? 0) }
			};
		}
		function deriveCallSchemas(events) {
			let active = /* @__PURE__ */ new Map();
			const calls = /* @__PURE__ */ new Map();
			const capture = (callId, name) => {
				if (calls.has(callId)) return;
				const schema = active.get(name);
				if (schema !== void 0) calls.set(callId, schema);
			};
			for (const event of events) {
				if (event.type === "request/header") {
					const tools = event.data.header.tools;
					active = new Map(Array.isArray(tools) ? tools.map((schema) => [schema.name, schema]) : []);
					continue;
				}
				if (event.type === "tool/call") {
					capture(String(event.data.callId), event.data.name);
					continue;
				}
				const type = event.type;
				if (type === "tool/code-dispatch-start" || type === "tool/code-dispatch") {
					const data = event.data;
					capture(data.subCallId, data.name);
				}
			}
			return calls;
		}
		function promptChange(previous, prompt, event) {
			if (previous === void 0 && event.data.reason !== "initial") return;
			const systemChanged = previous !== void 0 && previous.system !== prompt.system;
			const toolsChanged = previous !== void 0 && JSON.stringify(previous.tools) !== JSON.stringify(prompt.tools);
			if (previous !== void 0 && !systemChanged && !toolsChanged) return;
			return {
				seq: event.seq,
				time: event.time,
				kind: previous === void 0 ? "initial" : systemChanged && toolsChanged ? "system-and-tools" : systemChanged ? "system" : "tools",
				...previous === void 0 ? {} : { previous }
			};
		}
		/** Project ordinary and compaction provider calls into one chronological request stream. */
		function deriveRequests(events) {
			const requests = [];
			const ordinaryByStep = /* @__PURE__ */ new Map();
			const lastStepByTurn = /* @__PURE__ */ new Map();
			let activeStep;
			let activePrompt;
			let activeCompaction;
			const updateAssistant = (index, change) => {
				if (index === void 0) return;
				const request = requests[index];
				if (request?.purpose === "assistant") requests[index] = {
					...request,
					...change
				};
			};
			const updateCompaction = (index, change) => {
				if (index === void 0) return;
				const request = requests[index];
				if (request?.purpose === "compaction") requests[index] = {
					...request,
					...change
				};
			};
			for (const sourceEvent of events) {
				if (sourceEvent.type === "step/start") {
					const { turn, step } = sourceEvent.data;
					const key = requestKey(turn, step);
					ordinaryByStep.set(key, requests.length);
					lastStepByTurn.set(turn, key);
					requests.push({
						purpose: "assistant",
						startSeq: sourceEvent.seq,
						turn,
						step,
						startedAt: sourceEvent.time,
						completedAt: null,
						status: "running",
						...activePrompt === void 0 ? {} : {
							prompt: activePrompt,
							requestConfig: activePrompt.config
						}
					});
					activeStep = key;
					continue;
				}
				if (sourceEvent.type === "request/header") {
					const tools = sourceEvent.data.header.tools;
					const prompt = {
						config: sourceEvent.data.header.config,
						system: sourceEvent.data.header.system ?? "",
						tools: Array.isArray(tools) ? tools : []
					};
					const change = promptChange(activePrompt, prompt, sourceEvent);
					activePrompt = prompt;
					updateAssistant(activeStep === void 0 ? void 0 : ordinaryByStep.get(activeStep), {
						prompt,
						requestConfig: prompt.config,
						...change === void 0 ? {} : { promptChange: change }
					});
					continue;
				}
				if (sourceEvent.type === "assistant/chunk" && sourceEvent.data.chunk.type === "usage") {
					const index = ordinaryByStep.get(requestKey(sourceEvent.data.turn, sourceEvent.data.step));
					const request = index === void 0 ? void 0 : requests[index];
					updateAssistant(index, { usage: addTokenUsage(request?.purpose === "assistant" ? request.usage : void 0, sourceEvent.data.chunk.usage) });
					continue;
				}
				if (sourceEvent.type === "assistant/message") {
					const index = ordinaryByStep.get(requestKey(sourceEvent.data.turn, sourceEvent.data.step));
					const request = index === void 0 ? void 0 : requests[index];
					updateAssistant(index, {
						completedAt: sourceEvent.time,
						status: "complete",
						resultSeq: sourceEvent.seq,
						provenance: {
							provider: sourceEvent.data.message.source.provider,
							model: sourceEvent.data.message.source.model
						},
						...request?.purpose === "assistant" && request.usage !== void 0 || sourceEvent.data.usage === void 0 ? {} : { usage: sourceEvent.data.usage }
					});
					continue;
				}
				if (sourceEvent.type === "step/end") {
					const key = requestKey(sourceEvent.data.turn, sourceEvent.data.step);
					const index = ordinaryByStep.get(key);
					const request = index === void 0 ? void 0 : requests[index];
					if (request?.purpose === "assistant" && request.status === "running") updateAssistant(index, {
						completedAt: sourceEvent.time,
						status: "error"
					});
					if (activeStep === key) activeStep = void 0;
					continue;
				}
				if (sourceEvent.type === "llm/retry") {
					const event = sourceEvent;
					updateAssistant(ordinaryByStep.get(requestKey(event.data.turn, event.data.step)), {
						status: "error",
						error: displayFailureMessage(event.data.failure),
						retry: event.data.retry,
						maxRetries: event.data.maxRetries,
						retryDelayMs: event.data.delayMs
					});
					continue;
				}
				if (sourceEvent.type === "turn/end") {
					const lastStep = lastStepByTurn.get(sourceEvent.data.turn);
					if (sourceEvent.data.reason.kind === "error") updateAssistant(lastStep === void 0 ? void 0 : ordinaryByStep.get(lastStep), {
						status: "error",
						error: displayFailureMessage(sourceEvent.data.reason.error)
					});
					lastStepByTurn.delete(sourceEvent.data.turn);
					continue;
				}
				const type = sourceEvent.type;
				if (type === "session/end-seed" && activeCompaction !== void 0) {
					updateCompaction(activeCompaction, {
						completedAt: sourceEvent.time,
						status: "error",
						error: "Compaction was interrupted before completion."
					});
					activeCompaction = void 0;
					continue;
				}
				if (type === "compact/start") {
					const event = sourceEvent;
					activeCompaction = requests.length;
					requests.push({
						purpose: "compaction",
						startSeq: event.seq,
						turn: event.data.turn,
						step: 0,
						startedAt: event.time,
						completedAt: null,
						status: "running"
					});
					continue;
				}
				if (type === "compact/summary" && activeCompaction !== void 0) {
					const event = sourceEvent;
					updateCompaction(activeCompaction, {
						resultSeq: event.seq,
						summary: event.data.summary,
						...event.data.rawOutput === void 0 ? {} : { rawOutput: event.data.rawOutput },
						provenance: {
							provider: event.data.provider,
							model: event.data.model
						},
						requestConfig: {
							provider: event.data.provider,
							model: event.data.model,
							purpose: "compaction",
							...event.data.maxTokens === void 0 ? {} : { maxTokens: event.data.maxTokens }
						},
						...event.data.usage === void 0 ? {} : { usage: event.data.usage }
					});
					continue;
				}
				if (sourceEvent.type === "user/message" && activeCompaction !== void 0 && isCompactionSource(sourceEvent.data.source)) {
					updateCompaction(activeCompaction, { replacementSeq: sourceEvent.seq });
					continue;
				}
				if (type !== "compact/end" || activeCompaction === void 0) continue;
				const event = sourceEvent;
				updateCompaction(activeCompaction, {
					completedAt: event.time,
					status: event.data.error === void 0 ? "complete" : "error",
					...event.data.error === void 0 ? {} : { error: event.data.error }
				});
				activeCompaction = void 0;
			}
			return requests.sort((left, right) => left.startSeq - right.startSeq);
		}
		function isCompactionSource(source) {
			return typeof source === "object" && source !== null && "kind" in source && source.kind === "plugin" && "plugin" in source && source.plugin === "compact";
		}
		//#endregion
		//#region src/client/sessions/history.ts
		function assistantStepKey(turn, step) {
			return `${turn}\u0000${step}`;
		}
		function isFirstTokenCandidate(entry) {
			const event = entry.event;
			if (event.type !== "assistant/chunk") return false;
			switch (event.data.chunk.type) {
				case "text-delta":
				case "reasoning-delta": return event.data.chunk.text !== "";
				case "tool-call-delta": return event.data.chunk.argumentsDelta !== "" || event.data.chunk.name !== void 0;
				default: return false;
			}
		}
		/**
		* Remove completed-step token payloads that no inspection projection reads.
		* The first visible token preserves timing, usage chunks preserve accounting,
		* and unfinished steps retain every chunk for live or interrupted content.
		* @param entries - Contiguous raw history entries in sequence order.
		* @returns A projection-equivalent, usually much smaller entry ledger.
		*/
		function compactHistoryInspectionEntries(entries) {
			const completedSteps = /* @__PURE__ */ new Set();
			for (const { event } of entries) if (event.type === "assistant/message") completedSteps.add(assistantStepKey(event.data.turn, event.data.step));
			const firstTokenSteps = /* @__PURE__ */ new Set();
			const compacted = [];
			let changed = false;
			for (const entry of entries) {
				const event = entry.event;
				if (event.type !== "assistant/chunk") {
					compacted.push(entry);
					continue;
				}
				const key = assistantStepKey(event.data.turn, event.data.step);
				if (!completedSteps.has(key) || event.data.chunk.type === "usage") {
					compacted.push(entry);
					continue;
				}
				if (isFirstTokenCandidate(entry) && !firstTokenSteps.has(key)) {
					firstTokenSteps.add(key);
					compacted.push(entry);
				} else changed = true;
			}
			return changed ? compacted : entries;
		}
		/**
		* Create a lazy inspection projection over an immutable history window.
		* Conversation consumers retain the cheap wrapper; only Trajectory snapshots
		* the entries and replays event order and request lifecycle state.
		* @param loadEntries - Lazily snapshots contiguous raw entries in sequence order.
		* @returns Lazy, memoized inspection fields for that exact window.
		*/
		function createHistoryInspection(loadEntries) {
			let entries;
			let conversation;
			let requests;
			const historyEntries = () => entries ??= loadEntries();
			const conversationProjection = () => conversation ??= projectConversationHistory(historyEntries());
			const requestProjection = () => requests ??= inspectRequests(historyEntries());
			return {
				get eventNodes() {
					return conversationProjection().eventNodes;
				},
				get contexts() {
					return conversationProjection().contexts;
				},
				get interruptedNodes() {
					return conversationProjection().interruptedNodes;
				},
				get partial() {
					return conversationProjection().partial;
				},
				get runningCalls() {
					return conversationProjection().runningCalls;
				},
				get codeDispatches() {
					return conversationProjection().codeDispatches;
				},
				get requests() {
					return requestProjection().requests;
				},
				get callSchemas() {
					return requestProjection().callSchemas;
				}
			};
		}
		//#endregion
		//#region src/client/session-history/source.ts
		const HISTORY_PAGE_MESSAGES = 50;
		function isAborted(signal) {
			return signal?.aborted === true;
		}
		/** Independent raw-history owner used only by inspection consumers. */
		var SessionHistorySource = class {
			sessionId;
			api;
			entries = [];
			inspectionEntries = [];
			baseSeq = 0;
			hasMore = false;
			state = "cold";
			error = null;
			generation = 0;
			persistentConsumer = false;
			consumerSignals = /* @__PURE__ */ new Set();
			openPromise = null;
			olderPromise = null;
			stitching = false;
			liveBuffer = [];
			subscribedLastSeq = null;
			inspectionCache = null;
			streamPublishToken = null;
			streamPartial = null;
			snapshotCache;
			notifier = new Notifier(() => {
				this.snapshotCache = this.buildSnapshot();
			});
			/**
			* @param sessionId - Host session identity.
			* @param api - Shared wire client.
			*/
			constructor(sessionId, api) {
				this.sessionId = sessionId;
				this.api = api;
				this.snapshotCache = this.buildSnapshot();
			}
			/**
			* Subscribe to ledger changes.
			* @param listener - Change callback.
			* @returns Unsubscribe function.
			*/
			subscribe(listener) {
				return this.notifier.subscribe(listener);
			}
			/**
			* Read the cached ledger snapshot.
			* @returns Stable snapshot until the source changes.
			*/
			getSnapshot() {
				this.notifier.ensureFresh();
				return this.snapshotCache;
			}
			/**
			* Load the current tail without reading older pages.
			* @param signal - Consumer lifetime.
			* @returns When the tail is ready or loading fails.
			*/
			async loadTail(signal) {
				if (isAborted(signal)) return;
				this.trackConsumer(signal);
				await this.open();
			}
			/**
			* Prepend one older page when the current window has a predecessor.
			* @param signal - Consumer lifetime.
			* @returns Whether the loaded window advanced.
			*/
			async loadOlder(signal) {
				if (isAborted(signal)) return false;
				this.trackConsumer(signal);
				await this.open();
				if (isAborted(signal)) return false;
				const previousBaseSeq = this.baseSeq;
				await this.loadOlderPage();
				return this.baseSeq !== previousBaseSeq;
			}
			/**
			* Route a relevant mux frame without involving the Chat session.
			* @param frame - Session-addressed frame.
			*/
			handleMuxFrame(frame) {
				if (frame.type === "session/subscribed") {
					this.subscribedLastSeq = frame.lastSeq;
					return;
				}
				if (frame.type !== "session/event") return;
				this.acceptLive({
					event: frame.event,
					...frame.view === void 0 ? {} : { view: frame.view }
				});
			}
			/** Invalidate dead-generation requests while retaining the last readable snapshot. */
			handleDisconnected() {
				this.generation++;
				this.openPromise = null;
				this.olderPromise = null;
				this.stitching = false;
				this.liveBuffer = [];
				this.subscribedLastSeq = null;
				if (this.state !== "cold") {
					this.state = "cold";
					this.error = null;
					this.publishDirtyNow();
				}
			}
			/** Rebuild an activated ledger from the new connection generation. */
			resync() {
				if (!this.hasConsumer()) return;
				this.generation++;
				this.openPromise = null;
				this.olderPromise = null;
				this.stitching = false;
				this.liveBuffer = [];
				this.subscribedLastSeq = null;
				this.entries = [];
				this.inspectionEntries = [];
				this.baseSeq = 0;
				this.hasMore = false;
				this.state = "cold";
				this.error = null;
				this.publishDirtyNow();
				this.open();
			}
			/** Stop future refresh work after the host removes the session. */
			dispose() {
				this.persistentConsumer = false;
				this.consumerSignals.clear();
				this.generation++;
				this.openPromise = null;
				this.olderPromise = null;
				this.liveBuffer = [];
				this.streamPublishToken = null;
				this.streamPartial = null;
			}
			open() {
				if (this.state === "ready") return Promise.resolve();
				if (this.openPromise !== null) return this.openPromise;
				const generation = this.generation;
				const settled = this.doOpen(generation).finally(() => {
					if (this.openPromise === settled) this.openPromise = null;
				});
				this.openPromise = settled;
				return settled;
			}
			trackConsumer(signal) {
				if (signal === void 0) {
					this.persistentConsumer = true;
					return;
				}
				if (this.consumerSignals.has(signal)) return;
				this.consumerSignals.add(signal);
				signal.addEventListener("abort", () => {
					this.consumerSignals.delete(signal);
				}, { once: true });
			}
			hasConsumer() {
				return this.persistentConsumer || this.consumerSignals.size > 0;
			}
			async doOpen(generation) {
				this.state = "loading";
				this.error = null;
				this.publishDirtyNow();
				try {
					let { result } = await this.api.sessions.history({
						sessionId: this.sessionId,
						maxMessages: HISTORY_PAGE_MESSAGES
					});
					if (generation !== this.generation) return;
					if (!result.ok) {
						this.state = "error";
						this.error = result.error;
						return;
					}
					this.installTail(result.value.events, result.value.hasMore, true);
					const tailSeq = this.tailSeq();
					if (this.subscribedLastSeq !== null && tailSeq !== null && this.subscribedLastSeq > tailSeq) {
						result = (await this.api.sessions.history({
							sessionId: this.sessionId,
							maxMessages: HISTORY_PAGE_MESSAGES
						})).result;
						if (generation !== this.generation) return;
						if (result.ok) this.installTail(result.value.events, result.value.hasMore, true);
					}
					this.state = "ready";
				} catch (error) {
					if (generation !== this.generation) return;
					this.state = "error";
					const folded = transportError(error);
					/* v8 ignore next -- transportError always returns the error branch. */
					this.error = folded.ok ? null : folded.error;
				} finally {
					if (generation === this.generation) this.publishDirtyNow();
				}
			}
			loadOlderPage() {
				if (this.olderPromise !== null) return this.olderPromise;
				if (this.state !== "ready" || !this.hasMore) return Promise.resolve();
				const generation = this.generation;
				const settled = (async () => {
					try {
						const { result } = await this.api.sessions.history({
							sessionId: this.sessionId,
							beforeSeq: this.baseSeq,
							maxMessages: HISTORY_PAGE_MESSAGES
						});
						if (generation !== this.generation || this.state !== "ready" || !result.ok) return;
						const older = result.value.events;
						if (older.length === 0) {
							this.hasMore = result.value.hasMore;
							return;
						}
						const tail = older.at(-1);
						if (tail === void 0 || tail.event.seq + 1 !== this.baseSeq) {
							console.error(`[web-runtime] inspection history page discontinuous: tail seq ${tail?.event.seq} vs baseSeq ${this.baseSeq}`);
							this.hasMore = false;
							return;
						}
						this.entries = [...older, ...this.entries];
						this.inspectionEntries = compactHistoryInspectionEntries([...this.entries]);
						this.baseSeq = older[0]?.event.seq ?? this.baseSeq;
						this.hasMore = result.value.hasMore;
					} catch (error) {
						console.error("[web-runtime] inspection history paging failed:", error);
					}
				})().finally(() => {
					if (this.olderPromise !== settled) return;
					this.olderPromise = null;
					this.publishDirtyNow();
				});
				this.olderPromise = settled;
				return settled;
			}
			installTail(tail, hasMore, replace) {
				if (replace) {
					this.entries = [...tail];
					this.hasMore = hasMore;
				} else {
					const firstSeq = tail[0]?.event.seq;
					const prefix = firstSeq === void 0 ? this.entries : this.entries.filter((entry) => entry.event.seq < firstSeq);
					this.entries = [...prefix, ...tail];
				}
				this.baseSeq = this.entries[0]?.event.seq ?? 0;
				this.inspectionEntries = compactHistoryInspectionEntries([...this.entries]);
				const buffered = this.liveBuffer;
				this.liveBuffer = [];
				for (const entry of buffered) this.appendLive(entry);
				this.publishDirtyNow();
			}
			acceptLive(entry) {
				if (this.state === "loading" || this.stitching) {
					this.liveBuffer.push(entry);
					return;
				}
				if (this.state !== "ready") return;
				const tailSeq = this.tailSeq();
				if (tailSeq !== null && entry.event.seq > tailSeq + 1) {
					this.liveBuffer.push(entry);
					this.repairGap();
					return;
				}
				if (entry.event.type === "assistant/chunk" && entry.event.data.chunk.type !== "usage") {
					if (!this.appendIncrementalChunk(entry, entry.event)) return;
					this.publishStreamDirty();
					return;
				}
				this.appendLive(entry);
				this.publishDirtyNow();
			}
			appendLive(entry) {
				const tailSeq = this.tailSeq();
				if (tailSeq !== null && entry.event.seq <= tailSeq) return;
				this.entries.push(entry);
				this.inspectionEntries = [...this.inspectionEntries, entry];
				if (entry.event.type === "assistant/message") this.inspectionEntries = compactHistoryInspectionEntries(this.inspectionEntries);
			}
			/** Append a chunk against the cached finalized projection; false means no visible publish. */
			appendIncrementalChunk(entry, event) {
				const { turn, step, chunk } = event.data;
				if (!isVisibleAssistantChunk(chunk.type)) {
					const inspection = this.currentInspection();
					this.appendLive(entry);
					this.inspectionCache = {
						entries: this.inspectionEntries,
						value: inspection
					};
					return false;
				}
				const base = this.currentInspection();
				if (this.streamPartial === null || this.streamPartial.turn !== turn || this.streamPartial.step !== step) {
					const current = base.partial;
					this.streamPartial = new PartialAccumulator(turn, step, current?.turn === turn && current.step === step ? current.blocks : []);
				}
				this.streamPartial.push(chunk);
				this.appendLive(entry);
				this.inspectionCache = {
					entries: this.inspectionEntries,
					value: {
						...base,
						partial: this.streamPartial.toPartial()
					}
				};
				return true;
			}
			/** Coalesce token-stream projection and rendering work to one publish per browser frame. */
			publishStreamDirty() {
				if (this.streamPublishToken !== null) return;
				const token = {};
				this.streamPublishToken = token;
				const publish = () => {
					if (this.streamPublishToken !== token) return;
					this.streamPublishToken = null;
					this.notifier.markDirty();
				};
				if (typeof globalThis.requestAnimationFrame === "function") globalThis.requestAnimationFrame(publish);
				else queueMicrotask(publish);
			}
			/** Publish structural changes immediately and invalidate an older scheduled stream publish. */
			publishDirtyNow() {
				this.streamPublishToken = null;
				this.streamPartial = null;
				this.notifier.markDirty();
			}
			async repairGap() {
				if (this.stitching) return;
				this.stitching = true;
				const generation = this.generation;
				try {
					const { result } = await this.api.sessions.history({
						sessionId: this.sessionId,
						maxMessages: HISTORY_PAGE_MESSAGES
					});
					if (result.ok && generation === this.generation && this.state === "ready") this.installTail(result.value.events, result.value.hasMore, false);
				} catch (error) {
					console.error("[web-runtime] inspection history gap repair failed:", error);
				} finally {
					if (generation === this.generation) this.stitching = false;
				}
			}
			tailSeq() {
				return this.entries.at(-1)?.event.seq ?? null;
			}
			buildSnapshot() {
				return {
					state: this.state,
					error: this.error,
					hasMore: this.hasMore,
					baseSeq: this.baseSeq,
					inspection: this.currentInspection()
				};
			}
			/** Inspection pinned to the source's current immutable entry array. */
			currentInspection() {
				if (this.inspectionCache?.entries !== this.inspectionEntries) {
					const entries = this.inspectionEntries;
					this.inspectionCache = {
						entries,
						value: createHistoryInspection(() => entries)
					};
				}
				return this.inspectionCache.value;
			}
		};
		//#endregion
		//#region src/client/session-history/service.ts
		/** Root registry and frame router for independent inspection histories. */
		var SessionHistoryService = class {
			api;
			sources = /* @__PURE__ */ new Map();
			/**
			* @param ctx - Client root context.
			* @param api - Shared wire client.
			*/
			constructor(ctx, api) {
				this.api = api;
				ctx.reflect.provide("sessionHistory", this, void 0);
			}
			/**
			* Resolve one identity-stable history source.
			* @param sessionId - Host session identity.
			* @returns Source independent from SessionManager.
			*/
			source(sessionId) {
				let source = this.sources.get(sessionId);
				if (source === void 0) {
					source = new SessionHistorySource(sessionId, this.api);
					this.sources.set(sessionId, source);
				}
				return source;
			}
			/**
			* Route history-relevant mux frames only to an existing source.
			* @param envelope - Validated mux envelope.
			*/
			handleMuxEnvelope(envelope) {
				const frame = envelope.payload;
				if (frame.type === "stream/error") return;
				this.sources.get(frame.sessionId)?.handleMuxFrame(frame);
			}
			/**
			* Drop a removed session's independent history source.
			* @param envelope - Validated host envelope.
			*/
			handleHostEnvelope(envelope) {
				const frame = envelope.payload;
				if (frame.type !== "host/session-removed") return;
				this.sources.get(frame.sessionId)?.dispose();
				this.sources.delete(frame.sessionId);
			}
			/** Invalidate requests from the dead connection generation. */
			handleDisconnected() {
				for (const source of this.sources.values()) source.handleDisconnected();
			}
			/** Rebuild every previously activated source from the new generation. */
			handleConnected() {
				for (const source of this.sources.values()) source.resync();
			}
		};
		//#endregion
		//#region src/client/workspaces/workspace.ts
		/**
		* Observable Workspace object whose identity survives Host materialization.
		* Local instances retain their create input and failure state; materialized
		* instances expose the latest Host view.
		*/
		var Workspace = class {
			api;
			view;
			intent;
			materialization = null;
			snapshotCache;
			notifier = new Notifier(() => {
				this.snapshotCache = this.buildSnapshot();
			});
			/**
			* @param api - shared wire client.
			* @param source - local create input or an existing Host Workspace view.
			*/
			constructor(api, source) {
				this.api = api;
				if ("workspaceId" in source) this.view = source;
				else this.intent = {
					input: source,
					snapshot: {
						name: intentName(source),
						phase: "ready"
					}
				};
				this.snapshotCache = this.buildSnapshot();
			}
			/**
			* Materialize this local Workspace through the Host create seam.
			* Re-entry shares the in-flight completion; a materialized instance returns undefined.
			* @returns the Host result, or undefined when this Workspace is already materialized.
			*/
			materialize() {
				if (this.materialization !== null) return this.materialization;
				const intent = this.intent;
				if (intent === void 0) return;
				intent.snapshot = {
					name: intent.snapshot.name,
					phase: "creating"
				};
				this.notifier.notifyNow();
				const completion = this.completeMaterialization(intent).finally(() => {
					if (this.materialization === completion) this.materialization = null;
				});
				this.materialization = completion;
				return completion;
			}
			/**
			* Adopt a Host view without replacing this Workspace object.
			* An existing materialized identity accepts updates only for the same Workspace id.
			* @param view - latest Host projection.
			*/
			adopt(view) {
				if (this.view !== void 0 && this.view.workspaceId !== view.workspaceId) throw new Error("cannot adopt a different Workspace id");
				this.view = view;
				this.intent = void 0;
				this.notifier.markDirty();
			}
			/**
			* Subscribe to Workspace snapshot invalidation.
			* @param listener - snapshot invalidation callback.
			* @returns unsubscribe function.
			*/
			subscribe(listener) {
				return this.notifier.subscribe(listener);
			}
			/**
			* Read the cached Workspace snapshot after flushing pending notifications.
			* @returns the cached Workspace snapshot.
			*/
			getSnapshot() {
				this.notifier.ensureFresh();
				return this.snapshotCache;
			}
			async completeMaterialization(intent) {
				let result;
				try {
					result = (await this.api.workspace.create(intent.input)).result;
				} catch (error) {
					result = transportError(error);
				}
				if (this.intent !== intent) return result;
				if (!result.ok) {
					intent.snapshot = {
						name: intent.snapshot.name,
						phase: "ready",
						error: `${result.error.code}: ${result.error.message}`
					};
					this.notifier.markDirty();
				} else this.adopt(result.value.workspace);
				return result;
			}
			buildSnapshot() {
				return {
					view: this.view,
					intent: this.intent?.snapshot
				};
			}
		};
		function intentName(input) {
			if ("name" in input) return input.name;
			return input.path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? input.path;
		}
		//#endregion
		//#region src/client/workspaces/manager.ts
		/** Workspace object cluster driven by one list baseline and changed-frame upserts. */
		var WorkspaceManager = class {
			api;
			items = [];
			itemViewsSource = null;
			itemViewsCache = [];
			archivedSessionIds = [];
			state = "idle";
			phase = "pending";
			error = null;
			inflight = null;
			refreshFrames = null;
			/**
			* True once a frame or unary echo installed the archive set while a list
			* request was in flight: that install is newer than the pending baseline,
			* so the baseline's (older) set must not roll it back — the archive
			* mirror of replaying refreshFrames over the item baseline.
			*/
			archivedSupersedesRefresh = false;
			/**
			* Ids this process has seen removed, kept for the connection's lifetime so
			* a late changed frame or a stale baseline row cannot resurrect a deleted
			* row. Correctness rests on Host ids never being reused (the registry mints
			* a fresh `randomUUID` per record, including when the same directory is
			* registered again) — a path-derived id scheme would turn these entries
			* into permanent blindfolds and must clear them instead.
			*/
			removedIds = /* @__PURE__ */ new Set();
			snapshotCache;
			notifier = new Notifier(() => {
				this.snapshotCache = this.buildSnapshot();
			});
			/** @param api - shared wire client. */
			constructor(api) {
				this.api = api;
				this.snapshotCache = this.buildSnapshot();
			}
			/**
			* Refresh from workspace.list. The first successful response establishes
			* Host order; later responses update membership and values without moving
			* identities already visible to the client. Frames arriving during the RPC
			* are replayed over its response.
			* @returns the shared in-flight refresh.
			*/
			refresh() {
				if (this.inflight !== null) return this.inflight;
				this.state = "loading";
				this.error = null;
				const established = this.itemViews();
				const frames = [];
				this.refreshFrames = frames;
				this.notifier.markDirty();
				this.inflight = (async () => {
					try {
						const { result } = await this.api.workspace.list({});
						if (result.ok) {
							let items = this.phase === "pending" ? result.value.items : mergeOrderedBaseline(established, result.value.items, (workspace) => workspace.workspaceId);
							items = items.filter((workspace) => !this.removedIds.has(workspace.workspaceId));
							for (const delta of frames) items = applyWorkspaceDelta(items, delta);
							this.installViews(items);
							if (!this.archivedSupersedesRefresh) this.installArchived(result.value.archivedSessionIds);
							this.state = "idle";
							this.phase = "ready";
						} else {
							this.state = "error";
							this.error = result.error;
						}
					} catch (error) {
						this.state = "error";
						const folded = transportError(error);
						/* v8 ignore next -- transportError always returns the failure branch. */
						this.error = !folded.ok ? folded.error : null;
					} finally {
						this.refreshFrames = null;
						this.archivedSupersedesRefresh = false;
						this.inflight = null;
						this.notifier.markDirty();
					}
				})();
				return this.inflight;
			}
			/**
			* Create or resolve a real Workspace, then publish its returned snapshot
			* without waiting for the changed frame.
			* @param input - name under workspaceRoot or an existing absolute path.
			* @returns the wire result.
			*/
			async create(input) {
				const workspace = new Workspace(this.api, input);
				const completion = workspace.materialize();
				if (completion === void 0) throw new Error("a local Workspace must be materializable");
				const result = await completion;
				if (result.ok) this.upsert(result.value.workspace, workspace);
				return result;
			}
			/**
			* Rename a Workspace, then publish its returned snapshot without waiting
			* for the changed frame.
			* @param workspaceId - target workspace.
			* @param title - new display title.
			* @returns the wire result.
			*/
			async rename(workspaceId, title) {
				const { result } = await this.api.workspace.rename({
					workspaceId,
					title
				});
				if (result.ok) this.upsert(result.value.workspace);
				return result;
			}
			/**
			* Delete a Workspace registration and remove its local projection from the
			* unary response without waiting for the Host frame.
			* @param workspaceId - target workspace.
			* @returns the wire result.
			*/
			async delete(workspaceId) {
				const { result } = await this.api.workspace.delete({ workspaceId });
				if (result.ok) this.remove(workspaceId, true);
				return result;
			}
			/**
			* Move a session within its Workspace's manual order, then publish the
			* returned snapshot without waiting for the changed frame.
			* @param workspaceId - owning workspace.
			* @param sessionId - accounted session to move.
			* @param beforeSessionId - accounted anchor to insert before; omitted appends.
			* @returns the wire result.
			*/
			async insertSessionBefore(workspaceId, sessionId, beforeSessionId) {
				const { result } = await this.api.workspace.insertSessionBefore({
					workspaceId,
					sessionId,
					...beforeSessionId === void 0 ? {} : { beforeSessionId }
				});
				if (result.ok) this.upsert(result.value.workspace);
				return result;
			}
			/**
			* Archive one session in the registry-global set, then install the
			* returned full set without waiting for the changed frame.
			* @param sessionId - session to archive.
			* @returns the wire result.
			*/
			async archiveSession(sessionId) {
				const { result } = await this.api.workspace.archiveSession({ sessionId });
				if (result.ok) this.installArchived(result.value.archivedSessionIds);
				return result;
			}
			/**
			* Host-frame entry. Non-workspace frames are ignored so the runtime can
			* fan one host stream out to both object managers.
			* @param envelope - host stream envelope.
			*/
			handleHostEnvelope(envelope) {
				if (envelope.payload.type === "host/workspace-changed") this.upsert(envelope.payload.workspace);
				else if (envelope.payload.type === "host/workspace-removed") this.remove(envelope.payload.workspaceId);
				else if (envelope.payload.type === "host/archived-sessions-changed") this.installArchived(envelope.payload.archivedSessionIds);
			}
			/** Re-pull the baseline after each connection generation. */
			handleConnected() {
				this.refresh();
			}
			/**
			* Subscribe to workspace snapshot invalidation.
			* @param listener - snapshot invalidation callback.
			* @returns unsubscribe function.
			*/
			subscribe(listener) {
				return this.notifier.subscribe(listener);
			}
			/**
			* Read the cached workspace snapshot after flushing pending notifications.
			* @returns the cached workspace snapshot.
			*/
			getSnapshot() {
				this.notifier.ensureFresh();
				return this.snapshotCache;
			}
			buildSnapshot() {
				return {
					items: this.itemViews(),
					archivedSessionIds: this.archivedSessionIds,
					state: this.state,
					phase: this.phase,
					error: this.error
				};
			}
			/**
			* Replace the archive set when membership actually changed (array identity
			* backs Object.is short-circuits). Host snapshots are append-ordered, so
			* positional comparison is exact, not merely heuristic.
			*/
			installArchived(archivedSessionIds) {
				if (this.refreshFrames !== null) this.archivedSupersedesRefresh = true;
				if (archivedSessionIds.length === this.archivedSessionIds.length && archivedSessionIds.every((id, index) => id === this.archivedSessionIds[index])) return;
				this.archivedSessionIds = [...archivedSessionIds];
				this.notifier.markDirty();
			}
			/** Upsert one Host view, optionally retaining the local object that materialized it. */
			upsert(view, identity) {
				if (this.removedIds.has(view.workspaceId)) return;
				this.refreshFrames?.push({
					type: "upsert",
					workspace: view
				});
				const index = this.items.findIndex((item) => item.getSnapshot().view?.workspaceId === view.workspaceId);
				const installed = index === -1 ? void 0 : this.items[index]?.getSnapshot().view;
				if (installed !== void 0 && Date.parse(view.updatedAt) < Date.parse(installed.updatedAt)) return;
				if (identity !== void 0) this.items = index === -1 ? [identity, ...this.items] : this.items.map((item, position) => position === index ? identity : item);
				else if (index === -1) this.items = [new Workspace(this.api, view), ...this.items];
				else {
					this.items[index]?.adopt(view);
					this.items = [...this.items];
				}
				this.notifier.markDirty();
			}
			/** Remove one id idempotently and retain a tombstone against late echoes. */
			remove(workspaceId, direct = false) {
				this.refreshFrames?.push({
					type: "remove",
					workspaceId
				});
				this.removedIds.add(workspaceId);
				const items = this.items.filter((item) => item.getSnapshot().view?.workspaceId !== workspaceId);
				if (items.length === this.items.length) {
					if (direct) this.notifier.notifyNow();
					return;
				}
				this.items = items;
				if (direct) this.notifier.notifyNow();
				else this.notifier.markDirty();
			}
			installViews(views) {
				const existing = new Map(this.items.flatMap((workspace) => {
					const view = workspace.getSnapshot().view;
					return view === void 0 ? [] : [[view.workspaceId, workspace]];
				}));
				const installed = /* @__PURE__ */ new Map();
				for (const view of views) {
					const duplicate = installed.get(view.workspaceId);
					if (duplicate !== void 0) {
						duplicate.adopt(view);
						continue;
					}
					const workspace = existing.get(view.workspaceId) ?? new Workspace(this.api, view);
					workspace.adopt(view);
					installed.set(view.workspaceId, workspace);
				}
				this.items = [...installed.values()];
			}
			itemViews() {
				if (this.itemViewsSource === this.items) return this.itemViewsCache;
				this.itemViewsSource = this.items;
				this.itemViewsCache = this.items.flatMap((workspace) => {
					const view = workspace.getSnapshot().view;
					return view === void 0 ? [] : [view];
				});
				return this.itemViewsCache;
			}
		};
		/** Known ids retain their position; a newly created Workspace enters first. */
		function upsertWorkspace(items, workspace) {
			const index = items.findIndex((item) => item.workspaceId === workspace.workspaceId);
			return index === -1 ? [workspace, ...items] : items.map((item, position) => position === index ? workspace : item);
		}
		/** Replay one ordered delta over a baseline: upsert in place, or drop the removed id. */
		function applyWorkspaceDelta(items, delta) {
			return delta.type === "upsert" ? upsertWorkspace(items, delta.workspace) : items.filter((workspace) => workspace.workspaceId !== delta.workspaceId);
		}
		//#endregion
		//#region src/client/workspaces/service.ts
		/** Structured create failure for UI flows that distinguish Host business errors. */
		var WorkspaceCreateError = class extends Error {
			rpcError;
			constructor(rpcError) {
				super(`workspace create failed: ${rpcError.code}: ${rpcError.message}`);
				this.rpcError = rpcError;
				this.name = "WorkspaceCreateError";
			}
		};
		/** Structured browse failure so the directory browser can branch on Host business codes. */
		var DirectoryBrowseError = class extends Error {
			rpcError;
			constructor(rpcError) {
				super(`directory browse failed: ${rpcError.code}: ${rpcError.message}`);
				this.rpcError = rpcError;
				this.name = "DirectoryBrowseError";
			}
		};
		/** Real Workspace object layer and Host actions. */
		var WorkspacesService = class {
			api;
			sessions;
			/** UI-facing immutable projection; the manager remains wire truth. */
			list;
			/** Workspace baseline and frame owner. */
			manager;
			/** In-flight blank-session creates keyed by workspace (connectWorkspace coalescing). */
			connecting = /* @__PURE__ */ new Map();
			/** Guards the runtime-owned one-shot initial-selection subscription. */
			initialSelectionStarted = false;
			/**
			* @param ctx - client root context.
			* @param api - shared wire client.
			* @param sessions - cross-domain sessions face used for recency and blank-session reuse.
			*/
			constructor(ctx, api, sessions) {
				this.api = api;
				this.sessions = sessions;
				this.manager = new WorkspaceManager(api);
				this.list = createSnapshotStore({
					items: [],
					archivedSessionIds: [],
					state: "idle",
					phase: "pending",
					error: null,
					baselinesReady: false,
					recentWorkspaceId: void 0
				});
				this.manager.subscribe(() => {
					this.project();
				});
				this.sessions.list.subscribe(() => {
					this.project();
				});
				ctx.reflect.provide("workspaces", this, void 0);
			}
			/**
			* Resolve the session a New Session flow lands in once this Workspace is
			* chosen: reuse the workspace's existing blank session when one is in the
			* list mirror, else create a fresh one on the host (`session.create` births
			* the full Session+Agent — the client holds no intermediate state). The
			* caller owns navigation: take the returned id to `sessions.open`.
			* Resolution guarantee (both arms): the returned id is already in the list
			* store and `sessions.binding(id)` resolves synchronously — draft hand-off
			* may write the new scope's machine before opening.
			* @param workspaceId - chosen Workspace (must be in the workspace list).
			* @returns the reused or newly created session id.
			*/
			async connectWorkspace(workspaceId) {
				const workspace = this.list.getSnapshot().items.find((item) => item.workspaceId === workspaceId);
				if (workspace === void 0) throw new Error(`workspaces.connectWorkspace: unknown workspace ${workspaceId}`);
				const inflight = this.connecting.get(workspaceId);
				if (inflight !== void 0) return inflight;
				const archived = this.list.getSnapshot().archivedSessionIds;
				const sessions = this.sessions.list.getSnapshot();
				for (const id of sessions.ids) {
					const summary = sessions.byId[id];
					if (summary !== void 0 && summary.blank && summary.cwd === workspace.path && workspace.sessionIds.includes(summary.id) && !archived.includes(summary.id)) return summary.id;
				}
				const attempt = this.sessions.create({ workspaceId }).finally(() => {
					this.connecting.delete(workspaceId);
				});
				this.connecting.set(workspaceId, attempt);
				return attempt;
			}
			/**
			* Follow the first complete Workspace/Session baseline and select a default
			* session exactly once. A restored current session wins; otherwise the most
			* recent Workspace is connected (reusing or creating its blank session).
			* Later explicit clears stay cleared instead of retriggering this startup
			* policy. A failed connect may retry on the next baseline projection.
			* @returns disposer for the baseline subscription; late work cannot navigate after disposal.
			*/
			startInitialSelection() {
				if (this.initialSelectionStarted) throw new Error("workspaces.startInitialSelection: already started");
				this.initialSelectionStarted = true;
				let state = "waiting";
				let disposed = false;
				const reconcile = () => {
					if (disposed || state !== "waiting") return;
					const workspace = this.list.getSnapshot();
					if (!workspace.baselinesReady) return;
					const current = this.sessions.list.getSnapshot().current;
					const target = workspace.recentWorkspaceId;
					if (current !== void 0 || target === void 0) {
						state = "done";
						return;
					}
					state = "connecting";
					this.connectWorkspace(target).then((sessionId) => {
						if (disposed) return;
						if (this.sessions.list.getSnapshot().current === void 0) this.sessions.open(sessionId);
						state = "done";
					}, (reason) => {
						if (disposed) return;
						state = "waiting";
						console.warn("initial workspace selection failed:", reason);
					});
				};
				const unsubscribe = this.list.subscribe(reconcile);
				reconcile();
				return () => {
					disposed = true;
					unsubscribe();
				};
			}
			/**
			* The shared New Session action behind the shell entry points (sidebar
			* button, workspace browser): resolve the target Workspace — explicit wins,
			* else the recent-Workspace projection — connect its blank session and
			* navigate there; with no Workspace at all, clear the selection into the
			* New Session view state. Connect failures are non-fatal (console
			* diagnostics; the current view stays usable).
			* @param workspaceId - explicit target Workspace for scoped actions.
			*/
			startSession(workspaceId) {
				const target = workspaceId ?? this.list.getSnapshot().recentWorkspaceId;
				if (target === void 0) {
					this.sessions.clear();
					return;
				}
				this.connectWorkspace(target).then((sessionId) => {
					this.sessions.open(sessionId);
				}, (reason) => {
					console.warn("new session failed:", reason);
				});
			}
			/**
			* Create a Workspace by name or register an existing path.
			* @param input - exactly one Host create spelling.
			* @returns the created or idempotently resolved Workspace.
			*/
			async create(input) {
				const result = await this.manager.create(input);
				if (!result.ok) throw new WorkspaceCreateError(result.error);
				return result.value.workspace;
			}
			/**
			* Open the Host's native directory picker (the `native` capability).
			* @returns the selected path, or null when the user cancelled.
			*/
			async pickDirectory() {
				const response = await this.api.host.pickDirectory({});
				if (!response.result.ok) throw new Error(`directory picker failed: ${response.result.error.message}`);
				return response.result.value.path;
			}
			/**
			* List one directory level through the Host's `browse` capability.
			* @param path - absolute directory to list; absent lists the Host home directory.
			* @param signal - aborts the wire request (and the Host's scan) when the caller supersedes it.
			* @returns the level's listing with breadcrumb ancestry.
			*/
			async listDirectory(path, signal) {
				const response = await this.api.host.listDirectory(path === void 0 ? {} : { path }, signal);
				if (!response.result.ok) throw new DirectoryBrowseError(response.result.error);
				return response.result.value;
			}
			/**
			* Create one child directory through the Host's `browse` capability.
			* @param path - absolute existing parent directory.
			* @param name - single non-blank path segment.
			* @returns the created directory's absolute path.
			*/
			async createDirectory(path, name) {
				const response = await this.api.host.createDirectory({
					path,
					name
				});
				if (!response.result.ok) throw new DirectoryBrowseError(response.result.error);
				return response.result.value.path;
			}
			/**
			* Open a filesystem path with the Host operating system's default application.
			* @param path - absolute or host-resolvable path.
			*/
			async openPath(path) {
				const response = await this.api.host.openPath({ path });
				if (!response.result.ok) throw new Error(`path open failed: ${response.result.error.message}`);
			}
			/**
			* Rename a Workspace.
			* @param workspaceId - target workspace.
			* @param title - new display title (trimmed non-empty by the Host).
			* @returns the renamed Workspace view.
			*/
			async rename(workspaceId, title) {
				const result = await this.manager.rename(workspaceId, title);
				if (!result.ok) throw new Error(`workspace rename failed: ${result.error.code}: ${result.error.message}`);
				return result.value.workspace;
			}
			/**
			* Delete one Workspace registration. Sessions, session logs, and the
			* directory remain Host-owned outside this operation.
			* @param workspaceId - target workspace.
			*/
			async delete(workspaceId) {
				const result = await this.manager.delete(workspaceId);
				if (!result.ok) throw new Error(`workspace delete failed: ${result.error.code}: ${result.error.message}`);
			}
			/**
			* Archive a session into the registry-global set. Clearing an archived
			* current selection is the projection sweep's job (one rule for the local
			* echo and a remote tab's frame alike).
			* @param sessionId - session to archive.
			*/
			async archiveSession(sessionId) {
				const result = await this.manager.archiveSession(sessionId);
				if (!result.ok) throw new Error(`session archive failed: ${result.error.code}: ${result.error.message}`);
			}
			/**
			* Move a session within its Workspace's manual order (DOM-insertBefore-like).
			* @param workspaceId - owning workspace.
			* @param sessionId - accounted session to move.
			* @param beforeSessionId - accounted anchor to insert before; omitted appends.
			* @returns the updated Workspace view.
			*/
			async insertSessionBefore(workspaceId, sessionId, beforeSessionId) {
				const result = await this.manager.insertSessionBefore(workspaceId, sessionId, beforeSessionId);
				if (!result.ok) throw new Error(`workspace move failed: ${result.error.code}: ${result.error.message}`);
				return result.value.workspace;
			}
			/**
			* Refresh the workspace baseline, reusing an in-flight pull.
			* @returns completion of the current or newly started workspace baseline pull.
			*/
			refresh() {
				return this.manager.refresh();
			}
			/**
			* Route a Host stream envelope into the Workspace object layer.
			* @param envelope - validated Host stream envelope.
			*/
			handleHostEnvelope(envelope) {
				this.manager.handleHostEnvelope(envelope);
			}
			/** Rebuild the Workspace baseline after connection. */
			handleConnected() {
				this.manager.handleConnected();
			}
			project() {
				const workspace = this.manager.getSnapshot();
				const sessions = this.sessions.list.getSnapshot();
				const baselinesReady = workspace.phase === "ready" && sessions.phase === "ready";
				if (sessions.current !== void 0 && workspace.archivedSessionIds.includes(sessions.current)) this.sessions.clear();
				this.list.set({
					items: workspace.items,
					archivedSessionIds: workspace.archivedSessionIds,
					state: workspace.state,
					phase: workspace.phase,
					error: workspace.error,
					baselinesReady,
					recentWorkspaceId: baselinesReady ? recentWorkspace(workspace.items, sessions.byId) : void 0
				});
			}
		};
		/** Stable tie-breaking follows Host Workspace order. */
		function recentWorkspace(workspaces, sessions) {
			let selected;
			let selectedTime = Number.NEGATIVE_INFINITY;
			for (const workspace of workspaces) {
				let latest = Number.NEGATIVE_INFINITY;
				for (const sessionId of workspace.sessionIds) {
					const session = sessions[sessionId];
					if (session !== void 0) latest = Math.max(latest, session.updatedAt);
				}
				if (latest === Number.NEGATIVE_INFINITY) latest = Date.parse(workspace.createdAt);
				if (selected === void 0 || latest > selectedTime) {
					selected = workspace.workspaceId;
					selectedTime = latest;
				}
			}
			return selected;
		}
		//#endregion
		//#region src/client/index.ts
		/** Required services: the wire handle mounted by the connection plugin. */
		const inject = ["connection"];
		/** Mounts the browser runtime services and connection stream.
		* @param ctx - Client Cordis context.
		*/
		function apply(ctx) {
			ctx.plugin(SlotsService);
			const connection = ctx.get("connection");
			const sessions = new SessionsService(ctx, connection.api);
			const sessionHistory = new SessionHistoryService(ctx, connection.api);
			const workspaces = new WorkspacesService(ctx, connection.api, sessions);
			ctx.effect(() => workspaces.startInitialSelection(), "runtime: initial Workspace selection");
			const loop = connection.start({
				onMuxEnvelope: (envelope) => {
					sessions.handleMuxEnvelope(envelope);
					try {
						sessionHistory.handleMuxEnvelope(envelope);
					} catch (error) {
						console.error("[web-runtime] history frame routing failed:", error);
					}
				},
				onHostEnvelope: (envelope) => {
					sessions.handleHostEnvelope(envelope);
					workspaces.handleHostEnvelope(envelope);
					const frame = envelope.payload;
					if (frame.type === "host/commands-changed") ctx.emit("commands/changed");
					else if (frame.type === "host/settings-changed") ctx.emit("settings/changed", frame.ns);
					else if (frame.type === "host/credentials-changed") ctx.emit("credentials/changed", frame.ref);
					else if (frame.type === "host/models-changed") ctx.emit("models/changed");
					try {
						sessionHistory.handleHostEnvelope(envelope);
					} catch (error) {
						console.error("[web-runtime] history host-frame routing failed:", error);
					}
				},
				onConnected: () => {
					sessions.handleConnected();
					workspaces.handleConnected();
					ctx.emit("connection/reset");
					try {
						sessionHistory.handleConnected();
					} catch (error) {
						console.error("[web-runtime] history reconnect failed:", error);
					}
				},
				onStateChange: (state) => {
					if (state === "reconnecting") {
						sessions.handleDisconnected();
						try {
							sessionHistory.handleDisconnected();
						} catch (error) {
							console.error("[web-runtime] history disconnect failed:", error);
						}
					}
				}
			});
			ctx.effect(() => {
				return () => {
					loop.stop();
				};
			}, "runtime: connection stream loop");
		}
		//#endregion
		exports.DirectoryBrowseError = DirectoryBrowseError;
		exports.PendingWait = PendingWait;
		exports.SessionCreateError = SessionCreateError;
		exports.SessionHistoryService = SessionHistoryService;
		exports.SessionProvideChannel = SessionProvideChannel;
		exports.SessionsService = SessionsService;
		exports.SlotsService = SlotsService;
		exports.WorkspaceCreateError = WorkspaceCreateError;
		exports.WorkspacesService = WorkspacesService;
		exports.apply = apply;
		exports.createScope = createScope;
		exports.createSnapshotStore = createSnapshotStore;
		exports.defineStore = defineStore;
		exports.inject = inject;
		exports.scopeOf = scopeOf;
		exports.shallowEqual = shallowEqual;
		exports.workspaceTitleOf = workspaceTitleOf;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map