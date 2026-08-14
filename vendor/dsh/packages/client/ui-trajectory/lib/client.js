window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-trajectory",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let react = require("react");
		react = __toESM(react, 1);
		let react_dom = require("react-dom");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/duration-store.ts
		/**
		* Create the browser-wide trajectory duration preference source.
		* @returns a persisted source shared by every session view in one plugin lifecycle.
		*/
		function createTrajectoryDurationStore() {
			return (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(false, { persist: { name: "dsh.trajectory.duration" } });
		}
		//#endregion
		//#region src/client/context-branches.ts
		function isCompactionCheckpoint(node) {
			if (node.kind !== "context") return false;
			const source = node.source;
			return typeof source === "object" && source !== null && "kind" in source && source.kind === "plugin" && "plugin" in source && source.plugin === "compact";
		}
		/**
		* Join context generations across compaction/rewrite operations and split only at rewind.
		* @param contexts - Append-only context generations from the runtime fold.
		* @returns Rewind-delimited branches in creation order.
		*/
		function deriveTrajectoryContextBranches(contexts) {
			const mutable = [];
			for (const context of contexts) {
				if (mutable.length === 0 || context.origin === "rewind") {
					const previous = mutable.at(-1);
					const retainedSurfaceSeqs = new Set(context.nodes.filter((node) => context.originSeq !== void 0 && node.seq < context.originSeq).map((node) => node.seq));
					const inheritedNodes = previous === void 0 ? [] : [...previous.nodes.values()].filter((node) => retainedSurfaceSeqs.has(node.seq));
					mutable.push({
						id: context.id,
						key: context.origin === "rewind" && context.originSeq !== void 0 ? `rewind:${context.originSeq}` : "root",
						contexts: [context],
						latest: context,
						nodes: new Map([...inheritedNodes, ...context.nodes.filter((node) => !isCompactionCheckpoint(node))].map((node) => [node.seq, node])),
						startSeq: context.originSeq ?? Number.NEGATIVE_INFINITY,
						retainedSurfaceSeqs
					});
					continue;
				}
				const branch = mutable.at(-1);
				if (branch === void 0) continue;
				branch.contexts.push(context);
				branch.latest = context;
				for (const node of context.nodes) if (!isCompactionCheckpoint(node)) branch.nodes.set(node.seq, node);
			}
			return mutable.map((branch) => ({
				id: branch.id,
				key: branch.key,
				contexts: branch.contexts,
				latest: branch.latest,
				nodes: [...branch.nodes.values()].sort((left, right) => {
					return left.seq - right.seq;
				}),
				startSeq: branch.startSeq,
				retainedSurfaceSeqs: branch.retainedSurfaceSeqs
			}));
		}
		/**
		* Test whether a provider request belongs to one rewind branch.
		* @param branch - Branch carrying exact inherited surface provenance.
		* @param request - Provider request to classify.
		* @returns Whether the request began on this branch or produced a retained surface record.
		*/
		function trajectoryBranchContainsRequest(branch, request) {
			if (request.startSeq >= branch.startSeq) return true;
			return request.resultSeq !== void 0 && branch.retainedSurfaceSeqs.has(request.resultSeq) || request.purpose === "compaction" && request.replacementSeq !== void 0 && branch.retainedSurfaceSeqs.has(request.replacementSeq);
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/@tanstack+virtual-core@3.17.7/node_modules/@tanstack/virtual-core/dist/esm/lazy-measurements.js
		function createLazyMeasurementsView(count, flat, getItemKey) {
			const cache = new Array(count);
			return new Proxy(cache, { get(target, prop, receiver) {
				if (typeof prop === "string") {
					const c = prop.charCodeAt(0);
					if (c >= 48 && c <= 57) {
						const i = +prop;
						if (Number.isInteger(i) && i >= 0 && i < count) {
							let v = target[i];
							if (!v) {
								const s = flat[i * 2];
								v = target[i] = {
									index: i,
									key: getItemKey(i),
									start: s,
									size: flat[i * 2 + 1],
									end: s + flat[i * 2 + 1],
									lane: 0
								};
							}
							return v;
						}
					}
					if (prop === "length") return count;
				}
				return Reflect.get(target, prop, receiver);
			} });
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/@tanstack+virtual-core@3.17.7/node_modules/@tanstack/virtual-core/dist/esm/utils.js
		function memo$1(getDeps, fn, opts) {
			let deps = opts.initialDeps ?? [];
			let result;
			let isInitial = true;
			function memoizedFunction() {
				const newDeps = getDeps();
				if (!(newDeps.length !== deps.length || newDeps.some((dep, index) => deps[index] !== dep))) return result;
				deps = newDeps;
				result = fn(...newDeps);
				if ((opts == null ? void 0 : opts.onChange) && !(isInitial && opts.skipInitialOnChange)) opts.onChange(result);
				isInitial = false;
				return result;
			}
			memoizedFunction.updateDeps = (newDeps) => {
				deps = newDeps;
			};
			return memoizedFunction;
		}
		function notUndefined(value, msg) {
			if (value === void 0) throw new Error(`Unexpected undefined${msg ? `: ${msg}` : ""}`);
			else return value;
		}
		const approxEqual = (a, b) => Math.abs(a - b) < 1.01;
		const debounce = (targetWindow, fn, ms) => {
			let timeoutId;
			return function(...args) {
				targetWindow.clearTimeout(timeoutId);
				timeoutId = targetWindow.setTimeout(() => fn.apply(this, args), ms);
			};
		};
		//#endregion
		//#region ../../../node_modules/.pnpm/@tanstack+virtual-core@3.17.7/node_modules/@tanstack/virtual-core/dist/esm/index.js
		let _isIOSResult;
		const isIOSWebKit = () => {
			if (_isIOSResult !== void 0) return _isIOSResult;
			if (typeof navigator === "undefined") return _isIOSResult = false;
			if (/iP(hone|od|ad)/.test(navigator.userAgent)) return _isIOSResult = true;
			const mtp = navigator.maxTouchPoints;
			return _isIOSResult = navigator.platform === "MacIntel" && mtp !== void 0 && mtp > 0;
		};
		const getRect = (element) => {
			const { offsetWidth, offsetHeight } = element;
			return {
				width: offsetWidth,
				height: offsetHeight
			};
		};
		const defaultKeyExtractor = (index) => index;
		const defaultRangeExtractor = (range) => {
			const start = Math.max(range.startIndex - range.overscan, 0);
			const len = Math.min(range.endIndex + range.overscan, range.count - 1) - start + 1;
			const arr = new Array(len);
			for (let i = 0; i < len; i++) arr[i] = start + i;
			return arr;
		};
		const observeElementRect = (instance, cb) => {
			const element = instance.scrollElement;
			if (!element) return;
			const targetWindow = instance.targetWindow;
			if (!targetWindow) return;
			const handler = (rect) => {
				const { width, height } = rect;
				cb({
					width: Math.round(width),
					height: Math.round(height)
				});
			};
			handler(getRect(element));
			if (!targetWindow.ResizeObserver) return () => {};
			const observer = new targetWindow.ResizeObserver((entries) => {
				const run = () => {
					const entry = entries[0];
					if (entry == null ? void 0 : entry.borderBoxSize) {
						const box = entry.borderBoxSize[0];
						if (box) {
							handler({
								width: box.inlineSize,
								height: box.blockSize
							});
							return;
						}
					}
					handler(getRect(element));
				};
				instance.options.useAnimationFrameWithResizeObserver ? requestAnimationFrame(run) : run();
			});
			observer.observe(element, { box: "border-box" });
			return () => {
				observer.unobserve(element);
			};
		};
		const addEventListenerOptions = { passive: true };
		const supportsScrollend = typeof window == "undefined" ? true : "onscrollend" in window;
		const observeOffset = (instance, cb, readOffset) => {
			const element = instance.scrollElement;
			if (!element) return;
			const targetWindow = instance.targetWindow;
			if (!targetWindow) return;
			const registerScrollendEvent = instance.options.useScrollendEvent && supportsScrollend;
			let offset = 0;
			const fallback = registerScrollendEvent ? null : debounce(targetWindow, () => cb(offset, false), instance.options.isScrollingResetDelay);
			const createHandler = (isScrolling) => () => {
				offset = readOffset(element);
				fallback?.();
				cb(offset, isScrolling);
			};
			const handler = createHandler(true);
			const endHandler = createHandler(false);
			element.addEventListener("scroll", handler, addEventListenerOptions);
			if (registerScrollendEvent) element.addEventListener("scrollend", endHandler, addEventListenerOptions);
			return () => {
				element.removeEventListener("scroll", handler);
				if (registerScrollendEvent) element.removeEventListener("scrollend", endHandler);
			};
		};
		const observeElementOffset = (instance, cb) => observeOffset(instance, cb, (el) => {
			const { horizontal, isRtl } = instance.options;
			return horizontal ? el.scrollLeft * (isRtl && -1 || 1) : el.scrollTop;
		});
		const measureElement = (element, entry, instance) => {
			if (instance.options.useCachedMeasurements) {
				const index = instance.indexFromElement(element);
				const key = instance.options.getItemKey(index);
				return instance.itemSizeCache.get(key) ?? instance.options.estimateSize(index);
			}
			if (entry == null ? void 0 : entry.borderBoxSize) {
				const box = entry.borderBoxSize[0];
				if (box) return Math.round(box[instance.options.horizontal ? "inlineSize" : "blockSize"]);
			}
			if (!entry) {
				const index = instance.indexFromElement(element);
				const key = instance.options.getItemKey(index);
				const cachedSize = instance.itemSizeCache.get(key);
				if (cachedSize !== void 0) return cachedSize;
			}
			return element[instance.options.horizontal ? "offsetWidth" : "offsetHeight"];
		};
		const scrollWithAdjustments = (offset, { adjustments = 0, behavior }, instance) => {
			var _a, _b;
			(_b = (_a = instance.scrollElement) == null ? void 0 : _a.scrollTo) == null || _b.call(_a, {
				[instance.options.horizontal ? "left" : "top"]: offset + adjustments,
				behavior
			});
		};
		const elementScroll = scrollWithAdjustments;
		var Virtualizer = class {
			constructor(opts) {
				this.unsubs = [];
				this.scrollElement = null;
				this.targetWindow = null;
				this.isScrolling = false;
				this.scrollState = null;
				this.measurementsCache = [];
				this._flatMeasurements = null;
				this.itemSizeCache = /* @__PURE__ */ new Map();
				this.itemSizeCacheVersion = 0;
				this.laneAssignments = /* @__PURE__ */ new Map();
				this.pendingMin = null;
				this.prevLanes = void 0;
				this.lanesChangedFlag = false;
				this.lanesSettling = false;
				this.pendingScrollAnchor = null;
				this.scrollRect = null;
				this.scrollOffset = null;
				this.scrollDirection = null;
				this.scrollAdjustments = 0;
				this._iosDeferredAdjustment = 0;
				this._iosTouching = false;
				this._iosJustTouchEnded = false;
				this._iosTouchEndTimerId = null;
				this._intendedScrollOffset = null;
				this.elementsCache = /* @__PURE__ */ new Map();
				this.now = () => {
					var _a, _b, _c;
					return ((_c = (_b = (_a = this.targetWindow) == null ? void 0 : _a.performance) == null ? void 0 : _b.now) == null ? void 0 : _c.call(_b)) ?? Date.now();
				};
				this.observer = /* @__PURE__ */ (() => {
					let _ro = null;
					const get = () => {
						if (_ro) return _ro;
						if (!this.targetWindow || !this.targetWindow.ResizeObserver) return null;
						return _ro = new this.targetWindow.ResizeObserver((entries) => {
							entries.forEach((entry) => {
								const run = () => {
									const node = entry.target;
									const index = this.indexFromElement(node);
									if (!node.isConnected) {
										this.observer.unobserve(node);
										for (const [cacheKey, cachedNode] of this.elementsCache) if (cachedNode === node) {
											this.elementsCache.delete(cacheKey);
											break;
										}
										return;
									}
									if (this.shouldMeasureDuringScroll(index)) this.resizeItem(index, this.options.measureElement(node, entry, this));
								};
								this.options.useAnimationFrameWithResizeObserver ? requestAnimationFrame(run) : run();
							});
						});
					};
					return {
						disconnect: () => {
							var _a;
							(_a = get()) == null || _a.disconnect();
							_ro = null;
						},
						observe: (target) => {
							var _a;
							return (_a = get()) == null ? void 0 : _a.observe(target, { box: "border-box" });
						},
						unobserve: (target) => {
							var _a;
							return (_a = get()) == null ? void 0 : _a.unobserve(target);
						}
					};
				})();
				this.range = null;
				this.setOptions = (opts2) => {
					var _a, _b;
					const merged = {
						debug: false,
						initialOffset: 0,
						overscan: 1,
						paddingStart: 0,
						paddingEnd: 0,
						scrollPaddingStart: 0,
						scrollPaddingEnd: 0,
						horizontal: false,
						getItemKey: defaultKeyExtractor,
						rangeExtractor: defaultRangeExtractor,
						onChange: () => {},
						measureElement,
						initialRect: {
							width: 0,
							height: 0
						},
						scrollMargin: 0,
						gap: 0,
						indexAttribute: "data-index",
						initialMeasurementsCache: [],
						lanes: 1,
						anchorTo: "start",
						followOnAppend: false,
						scrollEndThreshold: 1,
						isScrollingResetDelay: 150,
						enabled: true,
						isRtl: false,
						useScrollendEvent: false,
						useAnimationFrameWithResizeObserver: false,
						laneAssignmentMode: "estimate",
						useCachedMeasurements: false
					};
					for (const key in opts2) {
						const v = opts2[key];
						if (v !== void 0) merged[key] = v;
					}
					const prevOptions = this.options;
					let anchor = null;
					let followOnAppend = null;
					let edgeKeysChanged = false;
					if (prevOptions !== void 0 && prevOptions.enabled && merged.enabled && merged.anchorTo === "end" && this.scrollElement !== null) {
						const prevCount = prevOptions.count;
						const nextCount = merged.count;
						const measurements = this.getMeasurements();
						const prevFirstKey = prevCount > 0 ? ((_a = measurements[0]) == null ? void 0 : _a.key) ?? prevOptions.getItemKey(0) : null;
						const prevLastKey = prevCount > 0 ? ((_b = measurements[prevCount - 1]) == null ? void 0 : _b.key) ?? prevOptions.getItemKey(prevCount - 1) : null;
						if (nextCount !== prevCount || prevCount > 0 && nextCount > 0 && (merged.getItemKey(0) !== prevFirstKey || merged.getItemKey(nextCount - 1) !== prevLastKey)) {
							edgeKeysChanged = true;
							const item = prevCount > 0 ? this.getVirtualItemForOffset(this.getScrollOffset()) ?? measurements[0] : null;
							if (item) anchor = [item.key, this.getScrollOffset() - item.start];
							const behavior = merged.followOnAppend === true ? "auto" : merged.followOnAppend || null;
							if (behavior && nextCount > prevCount && this.isAtEnd(prevOptions.scrollEndThreshold) && (prevCount === 0 || merged.getItemKey(nextCount - 1) !== prevLastKey)) followOnAppend = behavior;
						}
					}
					this.options = merged;
					if (edgeKeysChanged) {
						this.pendingMin = 0;
						this.itemSizeCacheVersion++;
					}
					let anchorResolved = false;
					let anchorDelta = 0;
					if (anchor && this.scrollOffset !== null) {
						const [anchorKey, anchorOffset] = anchor;
						const newMeasurements = this.getMeasurements();
						const { count, getItemKey } = this.options;
						let idx = 0;
						while (idx < count && getItemKey(idx) !== anchorKey) idx++;
						if (idx < count) {
							const anchorItem = newMeasurements[idx];
							if (anchorItem) {
								const newOffset = Math.max(0, anchorItem.start + anchorOffset);
								if (newOffset !== this.scrollOffset) {
									anchorDelta = newOffset - this.scrollOffset;
									this.scrollOffset = newOffset;
									anchorResolved = true;
								}
							}
						}
					}
					if (anchorResolved || followOnAppend) this.pendingScrollAnchor = [
						anchorResolved ? anchor[0] : null,
						anchorResolved ? anchor[1] : 0,
						followOnAppend,
						anchorDelta
					];
				};
				this.notify = (sync) => {
					var _a, _b;
					(_b = (_a = this.options).onChange) == null || _b.call(_a, this, sync);
				};
				this.maybeNotify = memo$1(() => {
					this.calculateRange();
					return [
						this.isScrolling,
						this.range ? this.range.startIndex : null,
						this.range ? this.range.endIndex : null
					];
				}, (isScrolling) => {
					this.notify(isScrolling);
				}, {
					key: false,
					debug: () => this.options.debug,
					initialDeps: [
						this.isScrolling,
						this.range ? this.range.startIndex : null,
						this.range ? this.range.endIndex : null
					]
				});
				this.cleanup = () => {
					this.unsubs.filter(Boolean).forEach((d) => d());
					this.unsubs = [];
					this.observer.disconnect();
					if (this.rafId != null && this.targetWindow) {
						this.targetWindow.cancelAnimationFrame(this.rafId);
						this.rafId = null;
					}
					this.scrollState = null;
					this._iosDeferredAdjustment = 0;
					this._iosTouching = false;
					this._iosJustTouchEnded = false;
					this.scrollElement = null;
					this.targetWindow = null;
				};
				this._didMount = () => {
					return () => {
						this.cleanup();
					};
				};
				this._willUpdate = () => {
					var _a;
					const scrollElement = this.options.enabled ? this.options.getScrollElement() : null;
					if (this.scrollElement !== scrollElement) {
						this.cleanup();
						if (!scrollElement) {
							this.maybeNotify();
							return;
						}
						this.scrollElement = scrollElement;
						if (this.scrollElement && "ownerDocument" in this.scrollElement) this.targetWindow = this.scrollElement.ownerDocument.defaultView;
						else this.targetWindow = ((_a = this.scrollElement) == null ? void 0 : _a.window) ?? null;
						this.elementsCache.forEach((cached) => {
							this.observer.observe(cached);
						});
						this.unsubs.push(this.options.observeElementRect(this, (rect) => {
							this.scrollRect = rect;
							this.maybeNotify();
						}));
						this.unsubs.push(this.options.observeElementOffset(this, (offset, isScrolling) => {
							if (isScrolling && this._intendedScrollOffset === null && offset === this.scrollOffset) return;
							if (this._intendedScrollOffset !== null && Math.abs(offset - this._intendedScrollOffset) < 1.5) offset = this._intendedScrollOffset;
							this._intendedScrollOffset = null;
							this.scrollAdjustments = 0;
							const prevOffset = this.getScrollOffset();
							this.scrollDirection = isScrolling ? prevOffset === offset ? this.scrollDirection : prevOffset < offset ? "forward" : "backward" : null;
							this.scrollOffset = offset;
							this.isScrolling = isScrolling;
							this._flushIosDeferredIfReady();
							if (this.scrollState) this.scheduleScrollReconcile();
							this.maybeNotify();
						}));
						if ("addEventListener" in this.scrollElement) {
							const scrollEl = this.scrollElement;
							const onTouchStart = () => {
								this._iosTouching = true;
								this._iosJustTouchEnded = false;
								if (this._iosTouchEndTimerId !== null && this.targetWindow != null) {
									this.targetWindow.clearTimeout(this._iosTouchEndTimerId);
									this._iosTouchEndTimerId = null;
								}
							};
							const onTouchEnd = () => {
								this._iosTouching = false;
								if (!isIOSWebKit() || this.targetWindow == null) return;
								this._iosJustTouchEnded = true;
								this._iosTouchEndTimerId = this.targetWindow.setTimeout(() => {
									this._iosJustTouchEnded = false;
									this._iosTouchEndTimerId = null;
									this._flushIosDeferredIfReady();
								}, 150);
							};
							scrollEl.addEventListener("touchstart", onTouchStart, addEventListenerOptions);
							scrollEl.addEventListener("touchend", onTouchEnd, addEventListenerOptions);
							this.unsubs.push(() => {
								scrollEl.removeEventListener("touchstart", onTouchStart);
								scrollEl.removeEventListener("touchend", onTouchEnd);
								if (this._iosTouchEndTimerId !== null && this.targetWindow != null) {
									this.targetWindow.clearTimeout(this._iosTouchEndTimerId);
									this._iosTouchEndTimerId = null;
								}
							});
						}
						this._scrollToOffset(this.getScrollOffset(), {
							adjustments: void 0,
							behavior: void 0
						});
					}
					const anchor = this.pendingScrollAnchor;
					this.pendingScrollAnchor = null;
					if (anchor && this.scrollElement && this.options.enabled) {
						const [key, _offset, followOnAppend, anchorDelta] = anchor;
						if (key !== null && !followOnAppend) if (isIOSWebKit() && (this.isScrolling || this._iosTouching || this._iosJustTouchEnded)) {
							if (anchorDelta !== 0) this._iosDeferredAdjustment += anchorDelta;
						} else this._scrollToOffset(this.getScrollOffset(), {
							adjustments: void 0,
							behavior: void 0
						});
						if (followOnAppend) this.scrollToEnd({ behavior: followOnAppend });
					}
				};
				this._flushIosDeferredIfReady = () => {
					if (this._iosDeferredAdjustment === 0) return;
					if (this.isScrolling) return;
					if (this._iosTouching) return;
					if (this._iosJustTouchEnded) return;
					const cur = this.getScrollOffset();
					const max = this.getMaxScrollOffset();
					if (cur < 0 || cur > max) return;
					if (this._iosDeferredAdjustment < 0 && cur >= max - 1) {
						this._iosDeferredAdjustment = 0;
						return;
					}
					const delta = this._iosDeferredAdjustment;
					this._iosDeferredAdjustment = 0;
					this._scrollToOffset(cur, {
						adjustments: this.scrollAdjustments += delta,
						behavior: void 0
					});
				};
				this.rafId = null;
				this.getSize = () => {
					if (!this.options.enabled) {
						this.scrollRect = null;
						return 0;
					}
					this.scrollRect = this.scrollRect ?? this.options.initialRect;
					return this.scrollRect[this.options.horizontal ? "width" : "height"];
				};
				this.getScrollOffset = () => {
					if (!this.options.enabled) {
						this.scrollOffset = null;
						return 0;
					}
					this.scrollOffset = this.scrollOffset ?? (typeof this.options.initialOffset === "function" ? this.options.initialOffset() : this.options.initialOffset);
					return this.scrollOffset;
				};
				this.getMeasurementOptions = memo$1(() => [
					this.options.count,
					this.options.paddingStart,
					this.options.scrollMargin,
					this.options.getItemKey,
					this.options.enabled,
					this.options.lanes,
					this.options.laneAssignmentMode,
					this.options.gap
				], (count, paddingStart, scrollMargin, getItemKey, enabled, lanes, laneAssignmentMode, gap) => {
					if (this.prevLanes !== void 0 && this.prevLanes !== lanes) this.lanesChangedFlag = true;
					this.prevLanes = lanes;
					this.pendingMin = null;
					return {
						count,
						paddingStart,
						scrollMargin,
						getItemKey,
						enabled,
						lanes,
						laneAssignmentMode,
						gap
					};
				}, { key: false });
				this.getMeasurements = memo$1(() => [this.getMeasurementOptions(), this.itemSizeCacheVersion], ({ count, paddingStart, scrollMargin, getItemKey, enabled, lanes, laneAssignmentMode, gap }, _itemSizeCacheVersion) => {
					const itemSizeCache = this.itemSizeCache;
					if (!enabled) {
						this.measurementsCache = [];
						this.itemSizeCache.clear();
						this.laneAssignments.clear();
						return [];
					}
					if (this.laneAssignments.size > count) {
						for (const index of this.laneAssignments.keys()) if (index >= count) this.laneAssignments.delete(index);
					}
					if (this.lanesChangedFlag) {
						this.lanesChangedFlag = false;
						this.lanesSettling = true;
						this.measurementsCache = [];
						this.itemSizeCache.clear();
						this.laneAssignments.clear();
						this.pendingMin = null;
					}
					if (this.measurementsCache.length === 0 && !this.lanesSettling) {
						this.measurementsCache = this.options.initialMeasurementsCache;
						this.measurementsCache.forEach((item) => {
							this.itemSizeCache.set(item.key, item.size);
						});
					}
					const min = this.lanesSettling ? 0 : this.pendingMin ?? 0;
					this.pendingMin = null;
					if (this.lanesSettling && this.measurementsCache.length === count) this.lanesSettling = false;
					if (lanes === 1) {
						const need = count * 2;
						let flat = this._flatMeasurements;
						if (!flat || flat.length < need) {
							const next = new Float64Array(need);
							if (flat && min > 0) next.set(flat.subarray(0, min * 2));
							flat = next;
							this._flatMeasurements = flat;
						}
						let runningStart;
						if (min === 0) runningStart = paddingStart + scrollMargin;
						else {
							const prevIdx = min - 1;
							runningStart = flat[prevIdx * 2] + flat[prevIdx * 2 + 1] + gap;
						}
						for (let i = min; i < count; i++) {
							const key = getItemKey(i);
							const measuredSize = itemSizeCache.get(key);
							const size = typeof measuredSize === "number" ? measuredSize : this.options.estimateSize(i);
							flat[i * 2] = runningStart;
							flat[i * 2 + 1] = size;
							runningStart += size + gap;
						}
						const view = createLazyMeasurementsView(count, flat, getItemKey);
						this.measurementsCache = view;
						return view;
					}
					const measurements = this.measurementsCache.slice(0, min);
					const laneLastIndex = new Array(lanes).fill(void 0);
					const laneEnds = new Float64Array(lanes);
					let filledLanes = 0;
					for (let m = 0; m < min; m++) {
						const item = measurements[m];
						if (item) {
							if (laneLastIndex[item.lane] === void 0) filledLanes++;
							laneLastIndex[item.lane] = m;
							laneEnds[item.lane] = item.end;
						}
					}
					for (let i = min; i < count; i++) {
						const key = getItemKey(i);
						const cachedLane = this.laneAssignments.get(i);
						let lane;
						let start;
						const shouldCacheLane = laneAssignmentMode === "estimate" || itemSizeCache.has(key);
						if (cachedLane !== void 0 && this.options.lanes > 1) {
							lane = cachedLane;
							const prevIndex = laneLastIndex[lane];
							const prevInLane = prevIndex !== void 0 ? measurements[prevIndex] : void 0;
							start = prevInLane ? prevInLane.end + gap : paddingStart + scrollMargin;
						} else if (filledLanes === lanes) {
							let bestLane = 0;
							let bestEnd = laneEnds[0];
							let bestIdx = laneLastIndex[0];
							for (let l = 1; l < lanes; l++) {
								const e = laneEnds[l];
								if (e < bestEnd || e === bestEnd && laneLastIndex[l] < bestIdx) {
									bestLane = l;
									bestEnd = e;
									bestIdx = laneLastIndex[l];
								}
							}
							lane = bestLane;
							start = bestEnd + gap;
							if (shouldCacheLane) this.laneAssignments.set(i, lane);
						} else {
							lane = i % this.options.lanes;
							start = paddingStart + scrollMargin;
							if (shouldCacheLane) this.laneAssignments.set(i, lane);
						}
						const measuredSize = itemSizeCache.get(key);
						const size = typeof measuredSize === "number" ? measuredSize : this.options.estimateSize(i);
						const end = start + size;
						measurements[i] = {
							index: i,
							start,
							size,
							end,
							key,
							lane
						};
						if (laneLastIndex[lane] === void 0) filledLanes++;
						laneLastIndex[lane] = i;
						laneEnds[lane] = end;
					}
					this.measurementsCache = measurements;
					return measurements;
				}, {
					key: false,
					debug: () => this.options.debug
				});
				this.calculateRange = memo$1(() => [
					this.getMeasurements(),
					this.getSize(),
					this.getScrollOffset(),
					this.options.lanes
				], (measurements, outerSize, scrollOffset, lanes) => {
					if (measurements.length === 0 || outerSize === 0) {
						this.range = null;
						return null;
					}
					this.range = calculateRangeImpl(measurements, outerSize, scrollOffset, lanes, lanes === 1 && this._flatMeasurements != null ? this._flatMeasurements : null);
					return this.range;
				}, {
					key: false,
					debug: () => this.options.debug
				});
				this.getVirtualIndexes = memo$1(() => {
					let startIndex = null;
					let endIndex = null;
					const range = this.calculateRange();
					if (range) {
						startIndex = range.startIndex;
						endIndex = range.endIndex;
					}
					this.maybeNotify.updateDeps([
						this.isScrolling,
						startIndex,
						endIndex
					]);
					return [
						this.options.rangeExtractor,
						this.options.overscan,
						this.options.count,
						startIndex,
						endIndex
					];
				}, (rangeExtractor, overscan, count, startIndex, endIndex) => {
					return startIndex === null || endIndex === null ? [] : rangeExtractor({
						startIndex,
						endIndex,
						overscan,
						count
					});
				}, {
					key: false,
					debug: () => this.options.debug
				});
				this.indexFromElement = (node) => {
					const attributeName = this.options.indexAttribute;
					const indexStr = node.getAttribute(attributeName);
					if (!indexStr) {
						console.warn(`Missing attribute name '${attributeName}={index}' on measured element.`);
						return -1;
					}
					return parseInt(indexStr, 10);
				};
				this.shouldMeasureDuringScroll = (index) => {
					var _a;
					if (!this.scrollState || this.scrollState.behavior !== "smooth") return true;
					const scrollIndex = this.scrollState.index ?? ((_a = this.getVirtualItemForOffset(this.scrollState.lastTargetOffset)) == null ? void 0 : _a.index);
					if (scrollIndex !== void 0 && this.range) {
						const bufferSize = Math.max(this.options.overscan, Math.ceil((this.range.endIndex - this.range.startIndex) / 2));
						const minIndex = Math.max(0, scrollIndex - bufferSize);
						const maxIndex = Math.min(this.options.count - 1, scrollIndex + bufferSize);
						return index >= minIndex && index <= maxIndex;
					}
					return true;
				};
				this.measureElement = (node) => {
					if (!node) {
						this.elementsCache.forEach((cached, key2) => {
							if (!cached.isConnected) {
								this.observer.unobserve(cached);
								this.elementsCache.delete(key2);
							}
						});
						return;
					}
					const index = this.indexFromElement(node);
					const key = this.options.getItemKey(index);
					const prevNode = this.elementsCache.get(key);
					if (prevNode !== node) {
						if (prevNode) this.observer.unobserve(prevNode);
						this.observer.observe(node);
						this.elementsCache.set(key, node);
					}
					if ((!this.isScrolling || this.scrollState) && this.shouldMeasureDuringScroll(index)) this.resizeItem(index, this.options.measureElement(node, void 0, this));
				};
				this.resizeItem = (index, size) => {
					var _a, _b;
					if (index < 0 || index >= this.options.count) return;
					let cachedSize;
					let itemStart;
					let key;
					const flat = this._flatMeasurements;
					if (this.options.lanes === 1 && flat !== null) {
						key = this.options.getItemKey(index);
						itemStart = flat[index * 2];
						cachedSize = flat[index * 2 + 1];
					} else {
						const item = this.measurementsCache[index];
						if (!item) return;
						key = item.key;
						itemStart = item.start;
						cachedSize = item.size;
					}
					const itemSize = this.itemSizeCache.get(key) ?? cachedSize;
					const delta = size - itemSize;
					if (delta !== 0) {
						const wasAtEnd = this.options.anchorTo === "end" && ((_a = this.scrollState) == null ? void 0 : _a.behavior) !== "smooth" && this.getVirtualDistanceFromEnd() <= this.options.scrollEndThreshold;
						const prevTotalSize = wasAtEnd ? this.getTotalSize() : 0;
						const scrollOffsetWithAdj = this.getScrollOffset() + this.scrollAdjustments;
						const defaultShouldAdjust = !this.itemSizeCache.has(key) ? itemStart < scrollOffsetWithAdj : itemStart + itemSize <= scrollOffsetWithAdj && this.scrollDirection !== "backward";
						const shouldAdjustScroll = ((_b = this.scrollState) == null ? void 0 : _b.behavior) !== "smooth" && (this.shouldAdjustScrollPositionOnItemSizeChange !== void 0 ? this.shouldAdjustScrollPositionOnItemSizeChange(this.measurementsCache[index] ?? {
							index,
							key,
							start: itemStart,
							size: cachedSize,
							end: itemStart + cachedSize,
							lane: 0
						}, delta, this) : defaultShouldAdjust);
						if (this.pendingMin === null || index < this.pendingMin) this.pendingMin = index;
						this.itemSizeCache.set(key, size);
						this.itemSizeCacheVersion++;
						let adjustedSync = false;
						if (wasAtEnd) adjustedSync = this.applyScrollAdjustment(this.getTotalSize() - prevTotalSize);
						else if (shouldAdjustScroll) adjustedSync = this.applyScrollAdjustment(delta);
						this.notify(adjustedSync);
					}
				};
				this.getVirtualItems = memo$1(() => [this.getVirtualIndexes(), this.getMeasurements()], (indexes, measurements) => {
					const virtualItems = [];
					for (let k = 0, len = indexes.length; k < len; k++) {
						const measurement = measurements[indexes[k]];
						virtualItems.push(measurement);
					}
					return virtualItems;
				}, {
					key: false,
					debug: () => this.options.debug
				});
				this.getVirtualItemForOffset = (offset) => {
					const measurements = this.getMeasurements();
					if (measurements.length === 0) return;
					const flat = this._flatMeasurements;
					const useFlat = this.options.lanes === 1 && flat != null;
					return notUndefined(measurements[findNearestBinarySearch(0, measurements.length - 1, useFlat ? (i) => flat[i * 2] : (i) => notUndefined(measurements[i]).start, offset)]);
				};
				this.getMaxScrollOffset = () => {
					if (!this.scrollElement) return 0;
					if ("scrollHeight" in this.scrollElement) return this.options.horizontal ? this.scrollElement.scrollWidth - this.scrollElement.clientWidth : this.scrollElement.scrollHeight - this.scrollElement.clientHeight;
					else {
						const doc = this.scrollElement.document.documentElement;
						return this.options.horizontal ? doc.scrollWidth - this.scrollElement.innerWidth : doc.scrollHeight - this.scrollElement.innerHeight;
					}
				};
				this.getVirtualDistanceFromEnd = () => {
					return Math.max(this.getTotalSize() - this.getSize() - this.getScrollOffset(), 0);
				};
				this.getDistanceFromEnd = () => {
					return Math.max(this.getMaxScrollOffset() - this.getScrollOffset(), 0);
				};
				this.isAtEnd = (threshold = this.options.scrollEndThreshold) => {
					return this.getDistanceFromEnd() <= threshold;
				};
				this.getOffsetForAlignment = (toOffset, align, itemSize = 0) => {
					if (!this.scrollElement) return 0;
					const size = this.getSize();
					const scrollOffset = this.getScrollOffset();
					if (align === "auto") align = toOffset >= scrollOffset + size ? "end" : "start";
					if (align === "center") toOffset += (itemSize - size) / 2;
					else if (align === "end") toOffset -= size;
					const maxOffset = this.getMaxScrollOffset();
					return Math.max(Math.min(maxOffset, toOffset), 0);
				};
				this.getOffsetForIndex = (index, align = "auto") => {
					index = Math.max(0, Math.min(index, this.options.count - 1));
					const size = this.getSize();
					const scrollOffset = this.getScrollOffset();
					const item = this.measurementsCache[index];
					if (!item) return;
					if (align === "auto") if (item.end >= scrollOffset + size - this.options.scrollPaddingEnd) align = "end";
					else if (item.start <= scrollOffset + this.options.scrollPaddingStart) align = "start";
					else return [scrollOffset, align];
					if (align === "end" && index === this.options.count - 1) return [this.getMaxScrollOffset(), align];
					const toOffset = align === "end" ? item.end + this.options.scrollPaddingEnd : item.start - this.options.scrollPaddingStart;
					return [this.getOffsetForAlignment(toOffset, align, item.size), align];
				};
				this.scrollToOffset = (toOffset, { align = "start", behavior = "auto" } = {}) => {
					this._iosDeferredAdjustment = 0;
					const offset = this.getOffsetForAlignment(toOffset, align);
					const now = this.now();
					this.scrollState = {
						index: null,
						align,
						behavior,
						startedAt: now,
						lastTargetOffset: offset,
						stableFrames: 0
					};
					this._scrollToOffset(offset, {
						adjustments: void 0,
						behavior
					});
					this.scheduleScrollReconcile();
				};
				this.scrollToIndex = (index, { align: initialAlign = "auto", behavior = "auto" } = {}) => {
					this._iosDeferredAdjustment = 0;
					index = Math.max(0, Math.min(index, this.options.count - 1));
					const offsetInfo = this.getOffsetForIndex(index, initialAlign);
					if (!offsetInfo) return;
					const [offset, align] = offsetInfo;
					const now = this.now();
					this.scrollState = {
						index,
						align,
						behavior,
						startedAt: now,
						lastTargetOffset: offset,
						stableFrames: 0
					};
					this._scrollToOffset(offset, {
						adjustments: void 0,
						behavior
					});
					this.scheduleScrollReconcile();
				};
				this.scrollBy = (delta, { behavior = "auto" } = {}) => {
					const offset = this.getScrollOffset() + delta;
					const now = this.now();
					this.scrollState = {
						index: null,
						align: "start",
						behavior,
						startedAt: now,
						lastTargetOffset: offset,
						stableFrames: 0
					};
					this._scrollToOffset(offset, {
						adjustments: void 0,
						behavior
					});
					this.scheduleScrollReconcile();
				};
				this.scrollToEnd = ({ behavior = "auto" } = {}) => {
					if (this.options.count > 0) {
						this.scrollToIndex(this.options.count - 1, {
							align: "end",
							behavior
						});
						return;
					}
					this.scrollToOffset(Math.max(this.getTotalSize() - this.getSize(), 0), { behavior });
				};
				this.getTotalSize = () => {
					var _a;
					const measurements = this.getMeasurements();
					let end;
					if (measurements.length === 0) end = this.options.paddingStart;
					else if (this.options.lanes === 1) {
						const lastIdx = measurements.length - 1;
						const flat = this._flatMeasurements;
						if (flat != null) end = flat[lastIdx * 2] + flat[lastIdx * 2 + 1];
						else end = ((_a = measurements[lastIdx]) == null ? void 0 : _a.end) ?? 0;
					} else {
						const endByLane = Array(this.options.lanes).fill(null);
						let endIndex = measurements.length - 1;
						while (endIndex >= 0 && endByLane.some((val) => val === null)) {
							const item = measurements[endIndex];
							if (endByLane[item.lane] === null) endByLane[item.lane] = item.end;
							endIndex--;
						}
						end = Math.max(...endByLane.filter((val) => val !== null));
					}
					return Math.max(end - this.options.scrollMargin + this.options.paddingEnd, 0);
				};
				this.takeSnapshot = () => {
					const snapshot = [];
					if (this.itemSizeCache.size === 0) return snapshot;
					const m = this.getMeasurements();
					for (const item of m) if (item && this.itemSizeCache.has(item.key)) snapshot.push({
						index: item.index,
						key: item.key,
						start: item.start,
						size: item.size,
						end: item.end,
						lane: item.lane
					});
					return snapshot;
				};
				this._scrollToOffset = (offset, { adjustments, behavior }) => {
					this._intendedScrollOffset = offset + (adjustments ?? 0);
					this.options.scrollToFn(offset, {
						behavior,
						adjustments
					}, this);
				};
				this.measure = () => {
					this.pendingMin = null;
					this.itemSizeCache.clear();
					this.laneAssignments.clear();
					this.itemSizeCacheVersion++;
					this.notify(false);
				};
				this.setOptions(opts);
			}
			applyScrollAdjustment(delta, behavior) {
				if (delta === 0) return false;
				if (isIOSWebKit() && (this.isScrolling || this._iosTouching || this._iosJustTouchEnded)) {
					this._iosDeferredAdjustment += delta;
					return false;
				} else {
					this._scrollToOffset(this.getScrollOffset(), {
						adjustments: this.scrollAdjustments += delta,
						behavior
					});
					if (this.scrollOffset !== null) {
						this.scrollOffset += this.scrollAdjustments;
						if (this.scrollOffset < 0) this.scrollOffset = 0;
						this.scrollAdjustments = 0;
					}
					return true;
				}
			}
			scheduleScrollReconcile() {
				if (!this.targetWindow) {
					this.scrollState = null;
					return;
				}
				if (this.rafId != null) return;
				this.rafId = this.targetWindow.requestAnimationFrame(() => {
					this.rafId = null;
					this.reconcileScroll();
				});
			}
			reconcileScroll() {
				if (!this.scrollState) return;
				if (!this.scrollElement) return;
				if (this.now() - this.scrollState.startedAt > 5e3) {
					this.scrollState = null;
					return;
				}
				const offsetInfo = this.scrollState.index != null ? this.getOffsetForIndex(this.scrollState.index, this.scrollState.align) : void 0;
				const targetOffset = offsetInfo ? offsetInfo[0] : this.scrollState.lastTargetOffset;
				const STABLE_FRAMES = 1;
				const targetChanged = targetOffset !== this.scrollState.lastTargetOffset;
				if (!targetChanged && approxEqual(targetOffset, this.getScrollOffset())) {
					this.scrollState.stableFrames++;
					if (this.scrollState.stableFrames >= STABLE_FRAMES) {
						if (this.getScrollOffset() !== targetOffset) this._scrollToOffset(targetOffset, {
							adjustments: void 0,
							behavior: "auto"
						});
						this.scrollState = null;
						return;
					}
				} else {
					this.scrollState.stableFrames = 0;
					if (targetChanged) {
						const viewport = this.getSize() || 600;
						const distance = Math.abs(targetOffset - this.getScrollOffset());
						const keepSmooth = this.scrollState.behavior === "smooth" && distance > viewport;
						this.scrollState.lastTargetOffset = targetOffset;
						if (!keepSmooth) this.scrollState.behavior = "auto";
						this._scrollToOffset(targetOffset, {
							adjustments: void 0,
							behavior: keepSmooth ? "smooth" : "auto"
						});
					}
				}
				this.scheduleScrollReconcile();
			}
		};
		const findNearestBinarySearch = (low, high, getCurrentValue, value) => {
			while (low <= high) {
				const middle = (low + high) / 2 | 0;
				const currentValue = getCurrentValue(middle);
				if (currentValue < value) low = middle + 1;
				else if (currentValue > value) high = middle - 1;
				else return middle;
			}
			if (low > 0) return low - 1;
			else return 0;
		};
		function findNearestBinarySearchFlat(flat, high, value) {
			let low = 0;
			while (low <= high) {
				const middle = (low + high) / 2 | 0;
				const currentValue = flat[middle * 2];
				if (currentValue < value) low = middle + 1;
				else if (currentValue > value) high = middle - 1;
				else return middle;
			}
			return low > 0 ? low - 1 : 0;
		}
		function calculateRangeImpl(measurements, outerSize, scrollOffset, lanes, flat) {
			const lastIndex = measurements.length - 1;
			if (measurements.length <= lanes) return {
				startIndex: 0,
				endIndex: lastIndex
			};
			if (lanes === 1 && flat !== null) {
				const startIndex2 = findNearestBinarySearchFlat(flat, lastIndex, scrollOffset);
				let endIndex2 = startIndex2;
				const limit = scrollOffset + outerSize;
				while (endIndex2 < lastIndex && flat[endIndex2 * 2] + flat[endIndex2 * 2 + 1] < limit) endIndex2++;
				return {
					startIndex: startIndex2,
					endIndex: endIndex2
				};
			}
			const getStart = (index) => measurements[index].start;
			let startIndex = findNearestBinarySearch(0, lastIndex, getStart, scrollOffset);
			let endIndex = startIndex;
			if (lanes === 1) while (endIndex < lastIndex && measurements[endIndex].end < scrollOffset + outerSize) endIndex++;
			else if (lanes > 1) {
				const endPerLane = Array(lanes).fill(0);
				while (endIndex < lastIndex && endPerLane.some((pos) => pos < scrollOffset + outerSize)) {
					const item = measurements[endIndex];
					endPerLane[item.lane] = item.end;
					endIndex++;
				}
				const startPerLane = Array(lanes).fill(scrollOffset + outerSize);
				while (startIndex >= 0 && startPerLane.some((pos) => pos >= scrollOffset)) {
					const item = measurements[startIndex];
					startPerLane[item.lane] = item.start;
					startIndex--;
				}
				startIndex = Math.max(0, startIndex - startIndex % lanes);
				endIndex = Math.min(lastIndex, endIndex + (lanes - 1 - endIndex % lanes));
			}
			return {
				startIndex,
				endIndex
			};
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/@tanstack+react-virtual@3.14.9_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@tanstack/react-virtual/dist/esm/index.js
		const useIsomorphicLayoutEffect = typeof document !== "undefined" ? react.useLayoutEffect : react.useEffect;
		function useVirtualizerBase({ useFlushSync = true, directDomUpdates = false, directDomUpdatesMode = "transform", ...options }) {
			const rerender = react.useReducer((x) => x + 1, 0)[1];
			const directRef = react.useRef({
				enabled: directDomUpdates,
				mode: directDomUpdatesMode,
				container: null,
				lastSize: null,
				lastPositions: /* @__PURE__ */ new WeakMap(),
				prevRange: null
			});
			directRef.current.enabled = directDomUpdates;
			directRef.current.mode = directDomUpdatesMode;
			const applyContainerSize = (instance2) => {
				const state = directRef.current;
				if (!state.enabled || !state.container) return;
				const totalSize = instance2.getTotalSize();
				if (totalSize !== state.lastSize) {
					state.lastSize = totalSize;
					const sizeAxis = instance2.options.horizontal ? "width" : "height";
					state.container.style[sizeAxis] = `${totalSize}px`;
				}
			};
			const applyDirectStyles = (instance2) => {
				const state = directRef.current;
				if (!state.enabled || !state.container) return;
				applyContainerSize(instance2);
				const horizontal = !!instance2.options.horizontal;
				const useTransform = state.mode === "transform";
				const posAxis = horizontal ? "left" : "top";
				const scrollMargin = instance2.options.scrollMargin;
				const items = instance2.getVirtualItems();
				for (const item of items) {
					const next = item.start - scrollMargin;
					const el = instance2.elementsCache.get(item.key);
					if (!el) continue;
					if (state.lastPositions.get(el) === next) continue;
					state.lastPositions.set(el, next);
					if (useTransform) el.style.transform = horizontal ? `translate3d(${next}px, 0, 0)` : `translate3d(0, ${next}px, 0)`;
					else el.style[posAxis] = `${next}px`;
				}
			};
			const resolvedOptions = {
				...options,
				onChange: (instance2, sync) => {
					var _a;
					const state = directRef.current;
					let shouldRerender = true;
					if (state.enabled) {
						applyDirectStyles(instance2);
						const range = instance2.range;
						const prev = state.prevRange;
						shouldRerender = !prev || prev.isScrolling !== instance2.isScrolling || prev.startIndex !== (range == null ? void 0 : range.startIndex) || prev.endIndex !== (range == null ? void 0 : range.endIndex);
						if (shouldRerender) state.prevRange = range ? {
							startIndex: range.startIndex,
							endIndex: range.endIndex,
							isScrolling: instance2.isScrolling
						} : null;
					}
					if (shouldRerender) if (useFlushSync && sync) (0, react_dom.flushSync)(rerender);
					else rerender();
					(_a = options.onChange) == null || _a.call(options, instance2, sync);
				}
			};
			const [instance] = react.useState(() => {
				const v = new Virtualizer(resolvedOptions);
				return Object.assign(v, { containerRef: (node) => {
					const state = directRef.current;
					state.container = node;
					state.lastSize = null;
					if (node && state.enabled) {
						const total = v.getTotalSize();
						state.lastSize = total;
						const axis = v.options.horizontal ? "width" : "height";
						node.style[axis] = `${total}px`;
					}
				} });
			});
			instance.setOptions(resolvedOptions);
			useIsomorphicLayoutEffect(() => {
				return instance._didMount();
			}, []);
			useIsomorphicLayoutEffect(() => {
				applyContainerSize(instance);
				return instance._willUpdate();
			});
			useIsomorphicLayoutEffect(() => {
				applyDirectStyles(instance);
			});
			return instance;
		}
		function useVirtualizer(options) {
			return useVirtualizerBase({
				observeElementRect,
				observeElementOffset,
				scrollToFn: elementScroll,
				...options
			});
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/base.js
		var Diff = class {
			diff(oldStr, newStr, options = {}) {
				let callback;
				if (typeof options === "function") {
					callback = options;
					options = {};
				} else if ("callback" in options) callback = options.callback;
				const oldString = this.castInput(oldStr, options);
				const newString = this.castInput(newStr, options);
				const oldTokens = this.removeEmpty(this.tokenize(oldString, options));
				const newTokens = this.removeEmpty(this.tokenize(newString, options));
				return this.diffWithOptionsObj(oldTokens, newTokens, options, callback);
			}
			diffWithOptionsObj(oldTokens, newTokens, options, callback) {
				var _a;
				const done = (value) => {
					value = this.postProcess(value, options);
					if (callback) {
						setTimeout(function() {
							callback(value);
						}, 0);
						return;
					} else return value;
				};
				const newLen = newTokens.length, oldLen = oldTokens.length;
				let editLength = 1;
				let maxEditLength = newLen + oldLen;
				if (options.maxEditLength != null) maxEditLength = Math.min(maxEditLength, options.maxEditLength);
				const maxExecutionTime = (_a = options.timeout) !== null && _a !== void 0 ? _a : Infinity;
				const abortAfterTimestamp = Date.now() + maxExecutionTime;
				const bestPath = [{
					oldPos: -1,
					lastComponent: void 0
				}];
				let newPos = this.extractCommon(bestPath[0], newTokens, oldTokens, 0, options);
				if (bestPath[0].oldPos + 1 >= oldLen && newPos + 1 >= newLen) return done(this.buildValues(bestPath[0].lastComponent, newTokens, oldTokens));
				let minDiagonalToConsider = -Infinity, maxDiagonalToConsider = Infinity;
				const execEditLength = () => {
					for (let diagonalPath = Math.max(minDiagonalToConsider, -editLength); diagonalPath <= Math.min(maxDiagonalToConsider, editLength); diagonalPath += 2) {
						let basePath;
						const removePath = bestPath[diagonalPath - 1], addPath = bestPath[diagonalPath + 1];
						if (removePath) bestPath[diagonalPath - 1] = void 0;
						let canAdd = false;
						if (addPath) {
							const addPathNewPos = addPath.oldPos - diagonalPath;
							canAdd = addPath && 0 <= addPathNewPos && addPathNewPos < newLen;
						}
						const canRemove = removePath && removePath.oldPos + 1 < oldLen;
						if (!canAdd && !canRemove) {
							bestPath[diagonalPath] = void 0;
							continue;
						}
						if (!canRemove || canAdd && removePath.oldPos < addPath.oldPos) basePath = this.addToPath(addPath, true, false, 0, options);
						else basePath = this.addToPath(removePath, false, true, 1, options);
						newPos = this.extractCommon(basePath, newTokens, oldTokens, diagonalPath, options);
						if (basePath.oldPos + 1 >= oldLen && newPos + 1 >= newLen) return done(this.buildValues(basePath.lastComponent, newTokens, oldTokens)) || true;
						else {
							bestPath[diagonalPath] = basePath;
							if (basePath.oldPos + 1 >= oldLen) maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonalPath - 1);
							if (newPos + 1 >= newLen) minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonalPath + 1);
						}
					}
					editLength++;
				};
				if (callback) (function exec() {
					setTimeout(function() {
						if (editLength > maxEditLength || Date.now() > abortAfterTimestamp) return callback(void 0);
						if (!execEditLength()) exec();
					}, 0);
				})();
				else while (editLength <= maxEditLength && Date.now() <= abortAfterTimestamp) {
					const ret = execEditLength();
					if (ret) return ret;
				}
			}
			addToPath(path, added, removed, oldPosInc, options) {
				const last = path.lastComponent;
				if (last && !options.oneChangePerToken && last.added === added && last.removed === removed) return {
					oldPos: path.oldPos + oldPosInc,
					lastComponent: {
						count: last.count + 1,
						added,
						removed,
						previousComponent: last.previousComponent
					}
				};
				else return {
					oldPos: path.oldPos + oldPosInc,
					lastComponent: {
						count: 1,
						added,
						removed,
						previousComponent: last
					}
				};
			}
			extractCommon(basePath, newTokens, oldTokens, diagonalPath, options) {
				const newLen = newTokens.length, oldLen = oldTokens.length;
				let oldPos = basePath.oldPos, newPos = oldPos - diagonalPath, commonCount = 0;
				while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(oldTokens[oldPos + 1], newTokens[newPos + 1], options)) {
					newPos++;
					oldPos++;
					commonCount++;
					if (options.oneChangePerToken) basePath.lastComponent = {
						count: 1,
						previousComponent: basePath.lastComponent,
						added: false,
						removed: false
					};
				}
				if (commonCount && !options.oneChangePerToken) basePath.lastComponent = {
					count: commonCount,
					previousComponent: basePath.lastComponent,
					added: false,
					removed: false
				};
				basePath.oldPos = oldPos;
				return newPos;
			}
			equals(left, right, options) {
				if (options.comparator) return options.comparator(left, right);
				else return left === right || !!options.ignoreCase && left.toLowerCase() === right.toLowerCase();
			}
			removeEmpty(array) {
				const ret = [];
				for (let i = 0; i < array.length; i++) if (array[i]) ret.push(array[i]);
				return ret;
			}
			castInput(value, options) {
				return value;
			}
			tokenize(value, options) {
				return Array.from(value);
			}
			join(chars) {
				return chars.join("");
			}
			postProcess(changeObjects, options) {
				return changeObjects;
			}
			get useLongestToken() {
				return false;
			}
			buildValues(lastComponent, newTokens, oldTokens) {
				const components = [];
				let nextComponent;
				while (lastComponent) {
					components.push(lastComponent);
					nextComponent = lastComponent.previousComponent;
					delete lastComponent.previousComponent;
					lastComponent = nextComponent;
				}
				components.reverse();
				const componentLen = components.length;
				let componentPos = 0, newPos = 0, oldPos = 0;
				for (; componentPos < componentLen; componentPos++) {
					const component = components[componentPos];
					if (!component.removed) {
						if (!component.added && this.useLongestToken) {
							let value = newTokens.slice(newPos, newPos + component.count);
							value = value.map(function(value, i) {
								const oldValue = oldTokens[oldPos + i];
								return oldValue.length > value.length ? oldValue : value;
							});
							component.value = this.join(value);
						} else component.value = this.join(newTokens.slice(newPos, newPos + component.count));
						newPos += component.count;
						if (!component.added) oldPos += component.count;
					} else {
						component.value = this.join(oldTokens.slice(oldPos, oldPos + component.count));
						oldPos += component.count;
					}
				}
				return components;
			}
		};
		//#endregion
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/character.js
		var CharacterDiff = class extends Diff {};
		new CharacterDiff();
		//#endregion
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/util/string.js
		function longestCommonPrefix(str1, str2) {
			let i;
			for (i = 0; i < str1.length && i < str2.length; i++) if (str1[i] != str2[i]) return str1.slice(0, i);
			return str1.slice(0, i);
		}
		function longestCommonSuffix(str1, str2) {
			let i;
			if (!str1 || !str2 || str1[str1.length - 1] != str2[str2.length - 1]) return "";
			for (i = 0; i < str1.length && i < str2.length; i++) if (str1[str1.length - (i + 1)] != str2[str2.length - (i + 1)]) return str1.slice(-i);
			return str1.slice(-i);
		}
		function replacePrefix(string, oldPrefix, newPrefix) {
			if (string.slice(0, oldPrefix.length) != oldPrefix) throw Error(`string ${JSON.stringify(string)} doesn't start with prefix ${JSON.stringify(oldPrefix)}; this is a bug`);
			return newPrefix + string.slice(oldPrefix.length);
		}
		function replaceSuffix(string, oldSuffix, newSuffix) {
			if (!oldSuffix) return string + newSuffix;
			if (string.slice(-oldSuffix.length) != oldSuffix) throw Error(`string ${JSON.stringify(string)} doesn't end with suffix ${JSON.stringify(oldSuffix)}; this is a bug`);
			return string.slice(0, -oldSuffix.length) + newSuffix;
		}
		function removePrefix(string, oldPrefix) {
			return replacePrefix(string, oldPrefix, "");
		}
		function removeSuffix(string, oldSuffix) {
			return replaceSuffix(string, oldSuffix, "");
		}
		function maximumOverlap(string1, string2) {
			return string2.slice(0, overlapCount(string1, string2));
		}
		function overlapCount(a, b) {
			let startA = 0;
			if (a.length > b.length) startA = a.length - b.length;
			let endB = b.length;
			if (a.length < b.length) endB = a.length;
			const map = Array(endB);
			let k = 0;
			map[0] = 0;
			for (let j = 1; j < endB; j++) {
				if (b[j] == b[k]) map[j] = map[k];
				else map[j] = k;
				while (k > 0 && b[j] != b[k]) k = map[k];
				if (b[j] == b[k]) k++;
			}
			k = 0;
			for (let i = startA; i < a.length; i++) {
				while (k > 0 && a[i] != b[k]) k = map[k];
				if (a[i] == b[k]) k++;
			}
			return k;
		}
		/**
		* Split a string into segments using a word segmenter, merging consecutive
		* segments if they are both whitespace segments. Whitespace segments can
		* appear adjacent to one another for two reasons:
		* - newlines always get their own segment
		* - where a diacritic is attached to a whitespace character in the text, the
		*   segment ends after the diacritic, so e.g. " \u0300 " becomes two segments.
		* This function therefore runs the segmenter's .segment() method and then
		* merges consecutive segments of whitespace into a single part.
		*/
		function segment(string, segmenter) {
			const parts = [];
			for (const segmentObj of Array.from(segmenter.segment(string))) {
				const segment = segmentObj.segment;
				if (parts.length && /\s/.test(parts[parts.length - 1]) && /\s/.test(segment)) parts[parts.length - 1] += segment;
				else parts.push(segment);
			}
			return parts;
		}
		function trailingWs(string, segmenter) {
			if (segmenter) return leadingAndTrailingWs(string, segmenter)[1];
			let i;
			for (i = string.length - 1; i >= 0; i--) if (!string[i].match(/\s/)) break;
			return string.substring(i + 1);
		}
		function leadingWs(string, segmenter) {
			if (segmenter) return leadingAndTrailingWs(string, segmenter)[0];
			const match = string.match(/^\s*/);
			return match ? match[0] : "";
		}
		function leadingAndTrailingWs(string, segmenter) {
			if (!segmenter) return [leadingWs(string), trailingWs(string)];
			if (segmenter.resolvedOptions().granularity != "word") throw new Error("The segmenter passed must have a granularity of \"word\"");
			const segments = segment(string, segmenter);
			const firstSeg = segments[0];
			const lastSeg = segments[segments.length - 1];
			return [/\s/.test(firstSeg) ? firstSeg : "", /\s/.test(lastSeg) ? lastSeg : ""];
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/word.js
		const extendedWordChars = "a-zA-Z0-9_\\u{AD}\\u{C0}-\\u{D6}\\u{D8}-\\u{F6}\\u{F8}-\\u{2C6}\\u{2C8}-\\u{2D7}\\u{2DE}-\\u{2FF}\\u{1E00}-\\u{1EFF}";
		const tokenizeIncludingWhitespace = new RegExp(`[${extendedWordChars}]+|\\s+|[^${extendedWordChars}]`, "ug");
		var WordDiff = class extends Diff {
			equals(left, right, options) {
				if (options.ignoreCase) {
					left = left.toLowerCase();
					right = right.toLowerCase();
				}
				return left.trim() === right.trim();
			}
			tokenize(value, options = {}) {
				let parts;
				if (options.intlSegmenter) {
					const segmenter = options.intlSegmenter;
					if (segmenter.resolvedOptions().granularity != "word") throw new Error("The segmenter passed must have a granularity of \"word\"");
					parts = segment(value, segmenter);
				} else parts = value.match(tokenizeIncludingWhitespace) || [];
				const tokens = [];
				let prevPart = null;
				parts.forEach((part) => {
					if (/\s/.test(part)) if (prevPart == null) tokens.push(part);
					else tokens.push(tokens.pop() + part);
					else if (prevPart != null && /\s/.test(prevPart)) if (tokens[tokens.length - 1] == prevPart) tokens.push(tokens.pop() + part);
					else tokens.push(prevPart + part);
					else tokens.push(part);
					prevPart = part;
				});
				return tokens;
			}
			join(tokens) {
				return tokens.map((token, i) => {
					if (i == 0) return token;
					else return token.replace(/^\s+/, "");
				}).join("");
			}
			postProcess(changes, options) {
				if (!changes || options.oneChangePerToken) return changes;
				let lastKeep = null;
				let insertion = null;
				let deletion = null;
				changes.forEach((change) => {
					if (change.added) insertion = change;
					else if (change.removed) deletion = change;
					else {
						if (insertion || deletion) dedupeWhitespaceInChangeObjects(lastKeep, deletion, insertion, change, options.intlSegmenter);
						lastKeep = change;
						insertion = null;
						deletion = null;
					}
				});
				if (insertion || deletion) dedupeWhitespaceInChangeObjects(lastKeep, deletion, insertion, null, options.intlSegmenter);
				return changes;
			}
		};
		new WordDiff();
		function dedupeWhitespaceInChangeObjects(startKeep, deletion, insertion, endKeep, segmenter) {
			if (deletion && insertion) {
				const [oldWsPrefix, oldWsSuffix] = leadingAndTrailingWs(deletion.value, segmenter);
				const [newWsPrefix, newWsSuffix] = leadingAndTrailingWs(insertion.value, segmenter);
				if (startKeep) {
					const commonWsPrefix = longestCommonPrefix(oldWsPrefix, newWsPrefix);
					startKeep.value = replaceSuffix(startKeep.value, newWsPrefix, commonWsPrefix);
					deletion.value = removePrefix(deletion.value, commonWsPrefix);
					insertion.value = removePrefix(insertion.value, commonWsPrefix);
				}
				if (endKeep) {
					const commonWsSuffix = longestCommonSuffix(oldWsSuffix, newWsSuffix);
					endKeep.value = replacePrefix(endKeep.value, newWsSuffix, commonWsSuffix);
					deletion.value = removeSuffix(deletion.value, commonWsSuffix);
					insertion.value = removeSuffix(insertion.value, commonWsSuffix);
				}
			} else if (insertion) {
				if (startKeep) {
					const ws = leadingWs(insertion.value, segmenter);
					insertion.value = insertion.value.substring(ws.length);
				}
				if (endKeep) {
					const ws = leadingWs(endKeep.value, segmenter);
					endKeep.value = endKeep.value.substring(ws.length);
				}
			} else if (startKeep && endKeep) {
				const newWsFull = leadingWs(endKeep.value, segmenter), [delWsStart, delWsEnd] = leadingAndTrailingWs(deletion.value, segmenter);
				const newWsStart = longestCommonPrefix(newWsFull, delWsStart);
				deletion.value = removePrefix(deletion.value, newWsStart);
				const newWsEnd = longestCommonSuffix(removePrefix(newWsFull, newWsStart), delWsEnd);
				deletion.value = removeSuffix(deletion.value, newWsEnd);
				endKeep.value = replacePrefix(endKeep.value, newWsFull, newWsEnd);
				startKeep.value = replaceSuffix(startKeep.value, newWsFull, newWsFull.slice(0, newWsFull.length - newWsEnd.length));
			} else if (endKeep) {
				const endKeepWsPrefix = leadingWs(endKeep.value, segmenter);
				const overlap = maximumOverlap(trailingWs(deletion.value, segmenter), endKeepWsPrefix);
				deletion.value = removeSuffix(deletion.value, overlap);
			} else if (startKeep) {
				const overlap = maximumOverlap(trailingWs(startKeep.value, segmenter), leadingWs(deletion.value, segmenter));
				deletion.value = removePrefix(deletion.value, overlap);
			}
		}
		var WordsWithSpaceDiff = class extends Diff {
			tokenize(value) {
				const regex = new RegExp(`(\\r?\\n)|[${extendedWordChars}]+|[^\\S\\n\\r]+|[^${extendedWordChars}]`, "ug");
				return value.match(regex) || [];
			}
		};
		new WordsWithSpaceDiff();
		//#endregion
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/line.js
		var LineDiff = class extends Diff {
			constructor() {
				super(...arguments);
				this.tokenize = tokenize;
			}
			equals(left, right, options) {
				if (options.ignoreWhitespace) {
					if (!options.newlineIsToken || !left.includes("\n")) left = left.trim();
					if (!options.newlineIsToken || !right.includes("\n")) right = right.trim();
				} else if (options.ignoreNewlineAtEof && !options.newlineIsToken) {
					if (left.endsWith("\n")) left = left.slice(0, -1);
					if (right.endsWith("\n")) right = right.slice(0, -1);
				}
				return super.equals(left, right, options);
			}
		};
		const lineDiff = new LineDiff();
		function diffLines(oldStr, newStr, options) {
			return lineDiff.diff(oldStr, newStr, options);
		}
		function tokenize(value, options) {
			if (options.stripTrailingCr) value = value.replace(/\r\n/g, "\n");
			const retLines = [], linesAndNewlines = value.split(/(\n|\r\n)/);
			if (!linesAndNewlines[linesAndNewlines.length - 1]) linesAndNewlines.pop();
			for (let i = 0; i < linesAndNewlines.length; i++) {
				const line = linesAndNewlines[i];
				if (i % 2 && !options.newlineIsToken) retLines[retLines.length - 1] += line;
				else retLines.push(line);
			}
			return retLines;
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/sentence.js
		function isSentenceEndPunct(char) {
			return char == "." || char == "!" || char == "?";
		}
		var SentenceDiff = class extends Diff {
			tokenize(value) {
				var _a;
				const result = [];
				let tokenStartI = 0;
				for (let i = 0; i < value.length; i++) {
					if (i == value.length - 1) {
						result.push(value.slice(tokenStartI));
						break;
					}
					if (isSentenceEndPunct(value[i]) && value[i + 1].match(/\s/)) {
						result.push(value.slice(tokenStartI, i + 1));
						i = tokenStartI = i + 1;
						while ((_a = value[i + 1]) === null || _a === void 0 ? void 0 : _a.match(/\s/)) i++;
						result.push(value.slice(tokenStartI, i + 1));
						tokenStartI = i + 1;
					}
				}
				return result;
			}
		};
		new SentenceDiff();
		//#endregion
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/css.js
		var CssDiff = class extends Diff {
			tokenize(value) {
				return value.split(/([{}:;,]|\s+)/);
			}
		};
		new CssDiff();
		//#endregion
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/json.js
		var JsonDiff = class extends Diff {
			constructor() {
				super(...arguments);
				this.tokenize = tokenize;
			}
			get useLongestToken() {
				return true;
			}
			castInput(value, options) {
				const { undefinedReplacement, stringifyReplacer = (k, v) => typeof v === "undefined" ? undefinedReplacement : v } = options;
				return typeof value === "string" ? value : JSON.stringify(canonicalize(value, null, null, stringifyReplacer), null, "  ");
			}
			equals(left, right, options) {
				return super.equals(left.replace(/,([\r\n])/g, "$1"), right.replace(/,([\r\n])/g, "$1"), options);
			}
		};
		new JsonDiff();
		function canonicalize(obj, stack, replacementStack, replacer, key) {
			stack = stack || [];
			replacementStack = replacementStack || [];
			if (replacer) obj = replacer(key === void 0 ? "" : key, obj);
			let i;
			for (i = 0; i < stack.length; i += 1) if (stack[i] === obj) return replacementStack[i];
			let canonicalizedObj;
			if ("[object Array]" === Object.prototype.toString.call(obj)) {
				stack.push(obj);
				canonicalizedObj = new Array(obj.length);
				replacementStack.push(canonicalizedObj);
				for (i = 0; i < obj.length; i += 1) canonicalizedObj[i] = canonicalize(obj[i], stack, replacementStack, replacer, String(i));
				stack.pop();
				replacementStack.pop();
				return canonicalizedObj;
			}
			if (obj && obj.toJSON) obj = obj.toJSON();
			if (typeof obj === "object" && obj !== null) {
				stack.push(obj);
				canonicalizedObj = {};
				replacementStack.push(canonicalizedObj);
				const sortedKeys = [];
				let key;
				for (key in obj)
 /* istanbul ignore else */
				if (Object.prototype.hasOwnProperty.call(obj, key)) sortedKeys.push(key);
				sortedKeys.sort();
				for (i = 0; i < sortedKeys.length; i += 1) {
					key = sortedKeys[i];
					canonicalizedObj[key] = canonicalize(obj[key], stack, replacementStack, replacer, key);
				}
				stack.pop();
				replacementStack.pop();
			} else canonicalizedObj = obj;
			return canonicalizedObj;
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/array.js
		var ArrayDiff = class extends Diff {
			tokenize(value) {
				return value.slice();
			}
			join(value) {
				return value;
			}
			removeEmpty(value) {
				return value;
			}
		};
		new ArrayDiff();
		//#endregion
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/patch/create.js
		function structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
			let optionsObj;
			if (!options) optionsObj = {};
			else if (typeof options === "function") optionsObj = { callback: options };
			else optionsObj = options;
			if (typeof optionsObj.context === "undefined") optionsObj.context = 4;
			const context = optionsObj.context;
			if (optionsObj.newlineIsToken) throw new Error("newlineIsToken may not be used with patch-generation functions, only with diffing functions");
			if (!optionsObj.callback) return diffLinesResultToPatch(diffLines(oldStr, newStr, optionsObj));
			else {
				const { callback } = optionsObj;
				diffLines(oldStr, newStr, Object.assign(Object.assign({}, optionsObj), { callback: (diff) => {
					callback(diffLinesResultToPatch(diff));
				} }));
			}
			function diffLinesResultToPatch(diff) {
				if (!diff) return;
				diff.push({
					value: "",
					lines: []
				});
				function contextLines(lines) {
					return lines.map(function(entry) {
						return " " + entry;
					});
				}
				const hunks = [];
				let oldRangeStart = 0, newRangeStart = 0, curRange = [], oldLine = 1, newLine = 1;
				for (let i = 0; i < diff.length; i++) {
					const current = diff[i], lines = current.lines || splitLines(current.value);
					current.lines = lines;
					if (current.added || current.removed) {
						if (!oldRangeStart) {
							const prev = diff[i - 1];
							oldRangeStart = oldLine;
							newRangeStart = newLine;
							if (prev) {
								curRange = context > 0 ? contextLines(prev.lines.slice(-context)) : [];
								oldRangeStart -= curRange.length;
								newRangeStart -= curRange.length;
							}
						}
						for (const line of lines) curRange.push((current.added ? "+" : "-") + line);
						if (current.added) newLine += lines.length;
						else oldLine += lines.length;
					} else {
						if (oldRangeStart) if (lines.length <= context * 2 && i < diff.length - 2) for (const line of contextLines(lines)) curRange.push(line);
						else {
							const contextSize = Math.min(lines.length, context);
							for (const line of contextLines(lines.slice(0, contextSize))) curRange.push(line);
							const hunk = {
								oldStart: oldRangeStart,
								oldLines: oldLine - oldRangeStart + contextSize,
								newStart: newRangeStart,
								newLines: newLine - newRangeStart + contextSize,
								lines: curRange
							};
							hunks.push(hunk);
							oldRangeStart = 0;
							newRangeStart = 0;
							curRange = [];
						}
						oldLine += lines.length;
						newLine += lines.length;
					}
				}
				for (const hunk of hunks) for (let i = 0; i < hunk.lines.length; i++) if (hunk.lines[i].endsWith("\n")) hunk.lines[i] = hunk.lines[i].slice(0, -1);
				else {
					hunk.lines.splice(i + 1, 0, "\\ No newline at end of file");
					i++;
				}
				return {
					oldFileName,
					newFileName,
					oldHeader,
					newHeader,
					hunks
				};
			}
		}
		/**
		* Split `text` into an array of lines, including the trailing newline character (where present)
		*/
		function splitLines(text) {
			const hasTrailingNl = text.endsWith("\n");
			const result = text.split("\n").map((line) => line + "\n");
			if (hasTrailingNl) result.pop();
			else result.push(result.pop().slice(0, -1));
			return result;
		}
		//#endregion
		//#region src/client/trajectory-record.ts
		/**
		* Resolve the identity that survives prepending older projected records.
		* @param cell - Projected trajectory record.
		* @returns Stable identity from the owning event or tool call, with a fixture fallback.
		*/
		function trajectoryRecordId(cell) {
			if (cell.recordId !== void 0) return cell.recordId;
			if (cell.callId !== void 0) return `${cell.kind}\u0000call\u0000${cell.callId}`;
			if (cell.sourceSeq !== void 0) return `${cell.kind}\u0000seq\u0000${cell.sourceSeq}`;
			return `${cell.kind}\u0000index\u0000${cell.index}`;
		}
		/**
		* Format a duration in milliseconds with thousands separators.
		* @param milliseconds - Duration in milliseconds, or `null` when absent.
		* @returns `—` when unknown, otherwise an integer-millisecond label.
		*/
		function formatDurationMillis(milliseconds) {
			if (milliseconds === null || !Number.isFinite(milliseconds)) return "—";
			return `${Math.round(milliseconds).toLocaleString("en-US")} ms`;
		}
		/**
		* Format an elapsed duration given in seconds as a millisecond label.
		* @param seconds - Duration seconds, or `null` when absent.
		* @returns `—` when unknown, otherwise an integer-millisecond label.
		*/
		function formatElapsedSeconds(seconds) {
			return formatDurationMillis(seconds === null ? null : seconds * 1e3);
		}
		//#endregion
		//#region src/client/trajectory-virtual-rows.ts
		const CONTENT_ROW_HEIGHT = 30;
		const COLLAPSED_SUMMARY_HEIGHT = 20;
		const TERMINAL_BOUNDARY_HEIGHT = 9;
		/**
		* Derive the DOM-safe row identity shared by React, the virtualizer, and
		* browser scroll contracts.
		* @param record - Display record whose identity is required.
		* @returns Stable record identity with a suffix for synthetic fold summaries.
		*/
		function trajectoryVirtualRecordKey(record) {
			const identity = encodeURIComponent(trajectoryRecordId(record.cell));
			return record.collapsedSummaryKind === void 0 ? identity : `${identity}\u0000summary\u0000${record.collapsedSummaryKind}`;
		}
		/**
		* Attach separator-only records to the next content row so the virtualizer
		* never owns a zero-height item. A terminal separator retains its CSS-owned
		* lower-marker clearance as a standalone item.
		* @param records - Final search/fold projection in ledger order.
		* @returns Measurable virtual rows with original logical positions retained.
		*/
		function groupTrajectoryVirtualRows(records) {
			const rows = [];
			let pending = [];
			for (const [logicalIndex, record] of records.entries()) {
				const entry = {
					logicalIndex,
					record
				};
				if (record.cell.requestOnly === true) {
					pending.push(entry);
					continue;
				}
				const entries = [...pending, entry];
				pending = [];
				rows.push({
					entries,
					height: record.collapsedSummaryKind === void 0 ? CONTENT_ROW_HEIGHT : COLLAPSED_SUMMARY_HEIGHT,
					key: trajectoryVirtualRecordKey(record)
				});
			}
			if (pending.length > 0) rows.push({
				entries: pending,
				height: TERMINAL_BOUNDARY_HEIGHT,
				key: pending.map((candidate) => trajectoryVirtualRecordKey(candidate.record)).join("|")
			});
			return rows;
		}
		//#endregion
		//#region src/client/layout.ts
		const PREVIEW_SOURCE_CHARACTERS = 2048;
		const PREVIEW_OUTPUT_CHARACTERS = 512;
		function layoutEntryOrder(entry) {
			return entry.kind === "system" && entry.change.kind === "initial" ? Number.NEGATIVE_INFINITY : entry.seq;
		}
		function inputCellDetail(node) {
			return {
				text: summarizeContent(node.content),
				sourceSeq: node.seq,
				messageSource: node.source,
				inputDetail: detailContent(node.content),
				sourceBlocks: node.content.map((block) => sourceBlock(block)),
				timeSeconds: 0,
				startedAt: finiteTime(node.time)
			};
		}
		/**
		* Fold a snapshot into turn → Message/Step groups with expanded cells.
		* @param input - nodes plus in-flight partial/runningCalls.
		* @returns turns ordered by first appearance.
		*/
		function deriveTrajectoryLayout(input) {
			const { nodes, partial, runningCalls, requests = [], callSchemas, codeDispatches } = input;
			const resultByCall = indexResults(nodes);
			const emittedCallIds = indexAssistantCallIds(nodes);
			const callStartById = /* @__PURE__ */ new Map();
			for (const result of resultByCall.values()) {
				const startedAt = finiteTime(result.callTime);
				if (startedAt !== null) callStartById.set(result.callId, startedAt);
			}
			for (const call of runningCalls) {
				const startedAt = finiteTime(call.time);
				if (startedAt !== null) callStartById.set(call.callId, startedAt);
			}
			const turns = /* @__PURE__ */ new Map();
			const standaloneCompactions = [];
			let index = 0;
			let prevAbsTime = null;
			let lastAssistantTurn = null;
			const bucket = (turn) => {
				let entry = turns.get(turn);
				if (entry === void 0) {
					entry = { groups: [] };
					turns.set(turn, entry);
				}
				return entry;
			};
			const pushMessage = (turn, laid) => {
				const groups = bucket(turn).groups;
				const last = groups.at(-1);
				if (last?.title === "Message") {
					last.laid.push(laid);
					return;
				}
				groups.push({
					title: "Message",
					laid: [laid]
				});
			};
			const pushStep = (turn, step, laid) => {
				if (laid.length === 0) return;
				const groups = bucket(turn).groups;
				const title = `Step ${step}`;
				const existing = groups.find((group) => group.title === title);
				if (existing !== void 0) {
					existing.laid.push(...laid);
					return;
				}
				groups.push({
					title,
					laid: [...laid]
				});
			};
			const representedRequests = /* @__PURE__ */ new Set();
			for (const node of nodes) if (node.kind === "assistant" && node.step > 0) representedRequests.add(`${node.turn}\u0000${node.step}`);
			if (partial !== null && partial.step > 0) representedRequests.add(`${partial.turn}\u0000${partial.step}`);
			for (const call of runningCalls) if (call.step > 0) representedRequests.add(`${call.turn}\u0000${call.step}`);
			const entries = [
				...nodes.map((node, nodeIndex) => ({
					kind: "node",
					seq: node.seq,
					node,
					nodeIndex
				})),
				...requests.filter((request) => request.purpose === "compaction").map((request) => ({
					kind: "compaction",
					seq: request.startSeq,
					request
				})),
				...requests.flatMap((request) => request.purpose !== "assistant" || request.promptChange === void 0 || request.prompt === void 0 ? [] : [{
					kind: "system",
					seq: request.promptChange.seq,
					request,
					change: request.promptChange
				}]),
				...requests.filter((request) => request.purpose === "assistant").filter((request) => !representedRequests.has(`${request.turn}\u0000${request.step}`)).map((request) => ({
					kind: "request",
					seq: request.startSeq,
					request
				}))
			].sort((left, right) => layoutEntryOrder(left) - layoutEntryOrder(right));
			for (const entry of entries) {
				if (entry.kind === "request") {
					const { request } = entry;
					pushStep(request.turn, request.step, [{
						absTime: finiteTime(request.startedAt),
						cell: {
							index: ++index,
							kind: "message",
							text: "",
							sourceSeq: request.startSeq,
							requestOnly: true,
							timeSeconds: request.completedAt === null ? null : durationSeconds(request.completedAt, request.startedAt),
							startedAt: finiteTime(request.startedAt),
							...request.status === "error" ? { isError: true } : {}
						}
					}]);
					prevAbsTime = finiteTime(request.completedAt) ?? finiteTime(request.startedAt) ?? prevAbsTime;
					continue;
				}
				if (entry.kind === "system") {
					const { change, request } = entry;
					pushMessage(change.kind === "initial" ? firstVisibleTurn(nodes, partial) : enclosingPromptTurn(nodes, change.seq, partial), {
						absTime: finiteTime(change.time),
						cell: {
							index: ++index,
							kind: "system",
							text: promptChangeLabel(change),
							sourceSeq: change.seq,
							...request.prompt === void 0 ? {} : { promptDetail: request.prompt },
							...change.previous === void 0 ? {} : { previousPromptDetail: change.previous },
							timeSeconds: 0,
							startedAt: finiteTime(change.time)
						}
					});
					prevAbsTime = finiteTime(change.time) ?? prevAbsTime;
					continue;
				}
				if (entry.kind === "compaction") {
					const request = entry.request;
					const rawOutput = request.rawOutput ?? request.summary;
					const thinkingDetail = rawOutput === void 0 ? "" : detailReasoning(rawOutput);
					const cell = {
						index: ++index,
						kind: "compacted",
						text: request.status === "running" ? "Compacting context…" : request.status === "error" ? request.error ?? "Compaction failed" : request.summary === void 0 ? "Context compacted" : summarizeContent(request.summary),
						sourceSeq: request.startSeq,
						...request.summary === void 0 ? {} : {
							outputDetail: detailContent(request.summary),
							outputBlocks: request.summary.map((block) => sourceBlock(block))
						},
						...thinkingDetail === "" ? {} : { thinkingDetail },
						...rawOutput === void 0 ? {} : { sourceBlocks: rawOutput.map((block) => sourceBlock(block)) },
						...request.status === "error" ? { isError: true } : {},
						timeSeconds: request.completedAt === null ? null : durationSeconds(request.completedAt, request.startedAt),
						startedAt: finiteTime(request.startedAt)
					};
					attachUsage(cell, request.usage);
					const compaction = { groups: [{
						title: `Compaction ${request.startSeq}`,
						laid: [{
							absTime: finiteTime(request.startedAt),
							cell
						}]
					}] };
					if (request.turn === null) standaloneCompactions.push(compaction);
					else bucket(request.turn).groups.push(...compaction.groups);
					prevAbsTime = finiteTime(request.completedAt) ?? finiteTime(request.startedAt) ?? prevAbsTime;
					continue;
				}
				const { node, nodeIndex: i } = entry;
				if (node.kind === "user") {
					pushMessage(enclosingUserTurn(nodes, i, partial, lastAssistantTurn), {
						absTime: finiteTime(node.time),
						cell: {
							index: ++index,
							kind: "user",
							...inputCellDetail(node),
							opensTurn: true
						}
					});
					prevAbsTime = finiteTime(node.time) ?? prevAbsTime;
					continue;
				}
				if (node.kind === "assistant") {
					const laidList = withSubCalls(expandAssistant(node, index + 1, prevAbsTime, resultByCall, callStartById), codeDispatches);
					if (node.step > 0) pushStep(node.turn, node.step, laidList);
					else for (const laid of laidList) pushMessage(node.turn, laid);
					const last = laidList[laidList.length - 1];
					if (last !== void 0) index = last.cell.index;
					prevAbsTime = finiteTime(node.time) ?? prevAbsTime;
					lastAssistantTurn = node.turn;
					continue;
				}
				if (node.kind === "context") {
					pushMessage(enclosingUserTurn(nodes, i, partial, lastAssistantTurn), {
						absTime: finiteTime(node.time),
						cell: {
							index: ++index,
							kind: "context",
							...inputCellDetail(node)
						}
					});
					prevAbsTime = finiteTime(node.time) ?? prevAbsTime;
					continue;
				}
				if (node.kind === "compaction") {
					prevAbsTime = finiteTime(node.time) ?? prevAbsTime;
					continue;
				}
				if (node.kind === "tool-result") {
					if (!emittedCallIds.has(node.callId)) {
						const toolName = node.call?.name;
						const laidList = [{
							absTime: finiteTime(node.callTime ?? node.time),
							...toolName !== void 0 ? { toolName } : {},
							callId: node.callId,
							cell: {
								index: ++index,
								kind: "tool",
								sourceSeq: node.seq,
								text: node.call !== null ? summarizeCall(node.call.name, node.call.argsRaw) : summarizeResult(node),
								...node.call !== null ? { inputDetail: node.call.argsRaw } : {},
								outputDetail: detailResult(node),
								outputBlocks: node.content.map((block) => sourceBlock(block)),
								result: summarizeResult(node),
								callId: node.callId,
								isError: node.isError,
								timeSeconds: durationSeconds(node.time, node.callTime),
								startedAt: finiteTime(node.callTime)
							}
						}];
						for (const laid of expandSubCalls(codeDispatches.get(node.callId), index)) {
							laidList.push(laid);
							index = laid.cell.index;
						}
						pushStep(0, 1, laidList);
					}
					prevAbsTime = finiteTime(node.time) ?? prevAbsTime;
				}
			}
			if (partial !== null) {
				const laidList = expandAssistant({
					kind: "assistant",
					seq: Number.MAX_SAFE_INTEGER,
					time: 0,
					turn: partial.turn,
					step: partial.step,
					blocks: partial.blocks
				}, index + 1, prevAbsTime, resultByCall, callStartById, { streaming: true });
				if (partial.step > 0) pushStep(partial.turn, partial.step, laidList);
				else for (const laid of laidList) pushMessage(partial.turn, laid);
				const last = laidList[laidList.length - 1];
				if (last !== void 0) index = last.cell.index;
			}
			const seenCalls = collectCallIds(turns);
			for (const call of runningCalls) {
				if (seenCalls.has(call.callId)) continue;
				const laidList = [{
					absTime: null,
					toolName: call.name,
					callId: call.callId,
					cell: {
						index: ++index,
						kind: "tool",
						text: summarizeCall(call.name, call.argsRaw),
						inputDetail: call.argsRaw,
						callId: call.callId,
						timeSeconds: null,
						startedAt: finiteTime(call.time)
					}
				}];
				for (const laid of expandSubCalls(codeDispatches.get(call.callId), index)) {
					laidList.push(laid);
					index = laid.cell.index;
				}
				if (call.step > 0) pushStep(call.turn, call.step, laidList);
				else for (const laid of laidList) pushMessage(call.turn, laid);
			}
			const prologue = turns.get(0);
			if (prologue !== void 0) {
				turns.delete(0);
				const emptyTurn = () => ({ groups: [] });
				const first = turns.get(1) ?? emptyTurn();
				first.groups = [...prologue.groups, ...first.groups];
				turns.set(1, first);
			}
			for (const entry of [...turns.values(), ...standaloneCompactions]) for (const group of entry.groups) for (const laid of group.laid) attachToolSchema(laid, callSchemas);
			return [...[...turns.entries()].map(([turn, entry]) => toTurnModel(turn, entry)), ...standaloneCompactions.map((entry) => toTurnModel(null, entry))].sort((left, right) => firstCellIndex(left) - firstCellIndex(right));
		}
		/**
		* Append the changing in-flight assistant cells to a stable finalized layout.
		* @param turns - Finalized layout derived with an empty-block partial anchor.
		* @param partial - Current in-flight assistant projection.
		* @param lastIndex - Highest cell index in the finalized layout.
		* @returns The original layout without a partial, otherwise a layout sharing every unaffected turn.
		*/
		function appendTrajectoryPartialLayout(turns, partial, lastIndex) {
			if (partial === null) return turns;
			const partialTurn = deriveTrajectoryLayout({
				nodes: [],
				partial,
				runningCalls: [],
				codeDispatches: /* @__PURE__ */ new Map()
			}).at(0);
			if (partialTurn === void 0) return turns;
			const streamed = {
				...partialTurn,
				groups: partialTurn.groups.map((group) => ({
					...group,
					cells: group.cells.map((cell) => ({
						...cell,
						index: cell.index + lastIndex
					}))
				}))
			};
			const turnIndex = turns.findIndex((turn) => turn.turn === streamed.turn);
			if (turnIndex === -1) return [...turns, streamed];
			const current = turns[turnIndex];
			/* v8 ignore next -- findIndex proved the dense array position exists. */
			if (current === void 0) return turns;
			const groups = [...current.groups];
			for (const streamedGroup of streamed.groups) {
				const groupIndex = groups.findIndex((group) => group.title === streamedGroup.title);
				if (groupIndex === -1) {
					groups.push(streamedGroup);
					continue;
				}
				const group = groups[groupIndex];
				/* v8 ignore next -- findIndex proved the dense array position exists. */
				if (group === void 0) continue;
				const streamedCallIds = new Set(streamedGroup.cells.flatMap((cell) => cell.callId === void 0 ? [] : [cell.callId]));
				groups[groupIndex] = {
					...streamedGroup,
					cells: [...group.cells.filter((cell) => cell.requestOnly !== true && (cell.callId === void 0 || !streamedCallIds.has(cell.callId))), ...streamedGroup.cells]
				};
			}
			const updated = [...turns];
			updated[turnIndex] = {
				...current,
				groups
			};
			return updated;
		}
		function attachToolSchema(laid, callSchemas) {
			if (laid.callId === void 0 || callSchemas === void 0) return;
			const schema = callSchemas.get(laid.callId);
			if (schema === void 0) return;
			laid.cell.schemaDetail = JSON.stringify(schema, null, 2);
		}
		function toTurnModel(turn, entry) {
			return {
				turn,
				groups: entry.groups.map(({ title, laid }) => {
					const description = groupDescription(laid);
					return {
						title,
						...description !== void 0 ? { description } : {},
						cells: laid.map((l) => l.cell)
					};
				})
			};
		}
		/** Chronological section position from the fold's monotonically assigned cell indexes. */
		function firstCellIndex(turn) {
			return Math.min(...turn.groups.flatMap((group) => group.cells.map((cell) => cell.index)), Number.POSITIVE_INFINITY);
		}
		/** Wall-span duration + tool histogram, e.g. `1.5 s bash×6`. */
		function groupDescription(laid) {
			const parts = [];
			const times = [];
			for (const l of laid) {
				if (l.absTime === null || !Number.isFinite(l.absTime)) continue;
				times.push(l.absTime);
				if (l.cell.kind === "tool" && l.cell.timeSeconds !== null && Number.isFinite(l.cell.timeSeconds)) times.push(l.absTime + l.cell.timeSeconds * 1e3);
			}
			if (times.length >= 2) {
				const span = formatGroupDuration((Math.max(...times) - Math.min(...times)) / 1e3);
				if (span !== void 0) parts.push(span);
			} else if (times.length === 1) {
				const own = laid.find((l) => l.absTime === times[0])?.cell.timeSeconds;
				const span = own !== null && own !== void 0 ? formatGroupDuration(own) : void 0;
				if (span !== void 0) parts.push(span);
			}
			const tools = /* @__PURE__ */ new Map();
			for (const l of laid) {
				if (l.toolName === void 0 || l.cell.kind !== "tool") continue;
				tools.set(l.toolName, (tools.get(l.toolName) ?? 0) + 1);
			}
			for (const [name, count] of tools) parts.push(count > 1 ? `${name}×${count}` : name);
			return parts.length === 0 ? void 0 : parts.join(" ");
		}
		function formatGroupDuration(seconds) {
			if (!Number.isFinite(seconds)) return void 0;
			return formatElapsedSeconds(seconds);
		}
		/** Own-duration seconds from two epoch-ms stamps; null when either is unusable. */
		function durationSeconds(later, earlier) {
			if (earlier === null || !Number.isFinite(later) || !Number.isFinite(earlier)) return null;
			return Math.max(0, (later - earlier) / 1e3);
		}
		/** Epoch-ms usable as an absolute time, else null. */
		function finiteTime(time) {
			return typeof time === "number" && Number.isFinite(time) ? time : null;
		}
		function expandAssistant(node, startIndex, prevAbsTime, results, callStarts, opts) {
			if (opts?.streaming === true && node.blocks.length === 0) return [];
			const out = [];
			let index = startIndex - 1;
			const usage = node.usage;
			const streaming = opts?.streaming === true;
			const recordedStart = finiteTime(node.timing?.stepStartTime);
			const messageDuration = streaming ? null : durationSeconds(node.time, recordedStart ?? prevAbsTime);
			const nodeAbs = streaming ? null : finiteTime(node.time);
			const messageText = node.blocks.filter((block) => block.kind === "text" && (!streaming || block.text !== "")).map((block) => block.kind === "text" ? block.text : "").join("\n\n");
			const thinkingText = node.blocks.filter((block) => block.kind === "reasoning" && (!streaming || block.text !== "")).map((block) => block.kind === "reasoning" ? block.text : "").join("\n\n");
			const message = {
				index: ++index,
				recordId: `assistant\u0000${node.turn}\u0000${node.step}`,
				kind: "message",
				sourceSeq: node.seq,
				text: messageText !== "" ? summarizeText(messageText) : thinkingText !== "" ? summarizeText(thinkingText) : summarizeAssistantActivity(node.blocks),
				...messageText !== "" ? { outputDetail: messageText } : {},
				...thinkingText !== "" ? { thinkingDetail: thinkingText } : {},
				sourceBlocks: node.blocks.map((block) => assistantSourceBlock(block)),
				timeSeconds: messageDuration,
				startedAt: recordedStart
			};
			attachUsage(message, usage);
			message.assistantMetrics = {
				timingRecorded: node.timing !== void 0,
				stepStartTime: node.timing?.stepStartTime ?? null,
				firstTokenTime: node.timing?.firstTokenTime ?? null,
				completedTime: streaming ? null : finiteTime(node.time),
				usageProvided: usage !== void 0,
				outputTokens: Number.isFinite(usage?.outputTokens) ? usage?.outputTokens ?? null : null
			};
			out.push({
				absTime: nodeAbs,
				cell: message
			});
			for (const block of node.blocks) {
				if (block.kind !== "tool-call") continue;
				const result = results.get(block.callId);
				const toolDuration = streaming || result === void 0 ? null : durationSeconds(result.time, result.callTime);
				const callAbs = finiteTime(callStarts.get(block.callId));
				out.push({
					absTime: callAbs,
					toolName: block.name,
					callId: block.callId,
					cell: {
						index: ++index,
						kind: "tool",
						text: summarizeCall(block.name, block.argsRaw),
						inputDetail: block.argsRaw,
						callId: block.callId,
						...result !== void 0 ? {
							outputDetail: detailResult(result),
							outputBlocks: result.content.map((block) => sourceBlock(block)),
							result: summarizeResult(result),
							isError: result.isError
						} : {},
						timeSeconds: toolDuration,
						startedAt: callAbs
					}
				});
			}
			return out;
		}
		function summarizeAssistantActivity(blocks) {
			const tools = /* @__PURE__ */ new Map();
			for (const block of blocks) {
				if (block.kind !== "tool-call") continue;
				tools.set(block.name, (tools.get(block.name) ?? 0) + 1);
			}
			if (tools.size > 0) return "Tool call only";
			return "";
		}
		function promptChangeLabel(change) {
			if (change.kind === "initial") return "Initial System Prompt";
			if (change.kind === "system") return "System Prompt Updated";
			if (change.kind === "tools") return "Tools Updated";
			return "System Prompt and Tools Updated";
		}
		function assistantSourceBlock(block) {
			switch (block.kind) {
				case "text": return {
					type: "text",
					content: block.text
				};
				case "reasoning": return {
					type: "thinking",
					content: block.text
				};
				case "tool-call": return {
					type: "tool-call",
					content: block.argsRaw,
					callId: block.callId,
					toolName: block.name
				};
				case "other": return sourceBlock(block.block);
			}
		}
		function sourceBlock(value) {
			if (typeof value !== "object" || value === null) return {
				type: "unknown",
				content: stringifySourceValue(value)
			};
			const block = value;
			const type = typeof block.type === "string" ? block.type : "unknown";
			if (typeof block.text === "string") return {
				type: type === "reasoning" ? "thinking" : type,
				content: block.text
			};
			const imageSrc = sourceImage(block);
			const imageAlt = typeof block.alt === "string" ? block.alt : void 0;
			return {
				type,
				content: imageSrc === void 0 ? stringifySourceValue(value) : "",
				...imageSrc !== void 0 ? { imageSrc } : {},
				...imageAlt !== void 0 ? { imageAlt } : {}
			};
		}
		function sourceImage(block) {
			if (typeof block.type !== "string" || !block.type.toLowerCase().includes("image")) return void 0;
			for (const candidate of [block.url, block.image_url]) if (typeof candidate === "string") return safeImageSource(candidate);
			if (typeof block.data === "string") {
				const mediaType = [
					block.mimeType,
					block.mediaType,
					block.media_type
				].find((candidate) => typeof candidate === "string") ?? "image/png";
				return safeImageSource(block.data.startsWith("data:") ? block.data : `data:${mediaType};base64,${block.data}`);
			}
			if (typeof block.source !== "object" || block.source === null) return void 0;
			const source = block.source;
			if (typeof source.url === "string") return safeImageSource(source.url);
			if (typeof source.data !== "string") return void 0;
			return safeImageSource(`data:${typeof source.media_type === "string" ? source.media_type : "image/png"};base64,${source.data}`);
		}
		function safeImageSource(value) {
			if (value.startsWith("data:image/") || value.startsWith("blob:")) return value;
			try {
				const protocol = new URL(value).protocol;
				return protocol === "http:" || protocol === "https:" ? value : void 0;
			} catch {
				return;
			}
		}
		function stringifySourceValue(value) {
			return JSON.stringify(value, null, 2) || String(value);
		}
		/**
		* Turn that encloses a user/message: next assistant turn, else the
		* in-flight partial, else the turn after the last finalized assistant (or 1).
		*/
		function enclosingUserTurn(nodes, userIndex, partial, lastAssistantTurn) {
			for (let i = userIndex + 1; i < nodes.length; i++) {
				const n = nodes[i];
				/* v8 ignore next -- dense-array guard: i stays within nodes.length, so the undefined arm needs a sparse array no caller builds. */
				if (n === void 0) continue;
				if (n.kind === "assistant") return n.turn;
			}
			if (partial !== null) return partial.turn;
			if (lastAssistantTurn !== null) return lastAssistantTurn + 1;
			return 1;
		}
		function enclosingPromptTurn(nodes, seq, partial) {
			const next = nodes.find((node) => node.seq > seq && node.kind === "assistant" && node.step > 0);
			if (next?.kind === "assistant") return next.turn;
			return partial?.turn ?? 1;
		}
		/** Earliest raw turn represented by the selected trajectory branch. */
		function firstVisibleTurn(nodes, partial) {
			const turns = nodes.flatMap((node) => node.kind === "assistant" && node.turn > 0 ? [node.turn] : []);
			if (partial !== null && partial.turn > 0) turns.push(partial.turn);
			return turns.length === 0 ? 1 : Math.min(...turns);
		}
		/** Copy provider usage onto a Message cell when present. */
		function attachUsage(cell, usage) {
			if (usage === void 0) return;
			if (usage.inputTokens !== void 0) cell.input = usage.inputTokens;
			if (usage.cacheReadTokens !== void 0) cell.cacheRead = usage.cacheReadTokens;
			if (usage.cacheWriteTokens !== void 0) cell.cacheWrite = usage.cacheWriteTokens;
			if (usage.outputTokens !== void 0) cell.output = usage.outputTokens;
			if (usage.reasoningTokens !== void 0) cell.think = usage.reasoningTokens;
		}
		function indexResults(nodes) {
			const map = /* @__PURE__ */ new Map();
			for (const node of nodes) if (node.kind === "tool-result") map.set(node.callId, node);
			return map;
		}
		function indexAssistantCallIds(nodes) {
			const ids = /* @__PURE__ */ new Set();
			for (const node of nodes) {
				if (node.kind !== "assistant") continue;
				for (const block of node.blocks) if (block.kind === "tool-call") ids.add(block.callId);
			}
			return ids;
		}
		function collectCallIds(turns) {
			const ids = /* @__PURE__ */ new Set();
			for (const entry of turns.values()) for (const group of entry.groups) for (const laid of group.laid) if (laid.callId !== void 0) ids.add(laid.callId);
			return ids;
		}
		/** Interleave each tool cell's run_code sub-dispatch cells right after it, reindexing followers. */
		function withSubCalls(laidList, codeDispatches) {
			if (codeDispatches.size === 0) return laidList;
			const out = [];
			let index = laidList[0] !== void 0 ? laidList[0].cell.index - 1 : 0;
			for (const laid of laidList) {
				out.push({
					...laid,
					cell: {
						...laid.cell,
						index: ++index
					}
				});
				if (laid.callId === void 0) continue;
				for (const sub of expandSubCalls(codeDispatches.get(laid.callId), index)) {
					out.push(sub);
					index = sub.cell.index;
				}
			}
			return out;
		}
		/** Sub-dispatch cells for one run_code parent, in start order (running = null duration). */
		function expandSubCalls(subs, startIndex) {
			if (subs === void 0 || subs.length === 0) return [];
			const out = [];
			let index = startIndex;
			for (const sub of subs) {
				const settled = "kind" in sub;
				out.push({
					absTime: settled ? finiteTime(sub.callTime ?? sub.time) : finiteTime(sub.time),
					toolName: settled ? sub.call?.name ?? sub.callId : sub.name,
					callId: sub.callId,
					cell: {
						index: ++index,
						kind: "subtool",
						callId: sub.callId,
						text: settled ? sub.call !== null ? summarizeCall(sub.call.name, sub.call.argsRaw) : summarizeResult(sub) : summarizeCall(sub.name, sub.argsRaw),
						...settled ? sub.call !== null ? { inputDetail: sub.call.argsRaw } : {} : { inputDetail: sub.argsRaw },
						...settled ? {
							outputDetail: detailResult(sub),
							outputBlocks: sub.content.map((block) => sourceBlock(block)),
							result: summarizeResult(sub),
							isError: sub.isError
						} : {},
						timeSeconds: settled ? durationSeconds(sub.time, sub.callTime) : null,
						startedAt: settled ? finiteTime(sub.callTime) : finiteTime(sub.time)
					}
				});
			}
			return out;
		}
		function summarizeCall(name, argsRaw) {
			const args = trajectoryPreviewText(argsRaw);
			if (args === "") return name;
			return `${name} · ${args}`;
		}
		function summarizeResult(node) {
			if (node.isError) return node.error?.code ?? "error";
			for (const block of node.content) if (block.type === "text" && typeof block.text === "string" && block.text !== "") return summarizeText(block.text);
			return "No output";
		}
		function detailResult(node) {
			if (node.isError) return node.error === void 0 ? "error" : `${node.error.name}: ${node.error.code}`;
			const text = node.content.filter((block) => block.type === "text" && typeof block.text === "string").map((block) => block.type === "text" ? block.text : "").join("\n");
			if (text !== "") return text;
			if (node.content.length === 0 || node.content.every((block) => block.type === "text" && (typeof block.text !== "string" || block.text === ""))) return "No output";
			return JSON.stringify(node.content, null, 2);
		}
		function detailContent(content) {
			return content.filter((block) => block.type === "text" && typeof block.text === "string").map((block) => block.text ?? "").join("\n");
		}
		function detailReasoning(content) {
			return content.filter((block) => block.type === "reasoning" && typeof block.text === "string").map((block) => block.text ?? "").join("\n");
		}
		function summarizeContent(content) {
			for (const block of content) if (block.type === "text" && typeof block.text === "string") return summarizeText(block.text);
			return "";
		}
		function summarizeText(text) {
			return trajectoryPreviewText(text);
		}
		/**
		* Build a bounded one-line ledger preview without parsing the complete Markdown document.
		* Full source remains on the cell for the inspector.
		* @param text - Untrusted message, reasoning, payload, or result text.
		* @returns A compact preview capped independently from the retained source.
		*/
		function trajectoryPreviewText(text) {
			const source = text.slice(0, PREVIEW_SOURCE_CHARACTERS);
			const compact = (0, _deepseek_ai_dsh_client_ui_primitives.extractMarkdownPlainText)(source).replace(/\s+/g, " ").trim();
			const preview = compact.slice(0, PREVIEW_OUTPUT_CHARACTERS).trimEnd();
			return source.length < text.length || preview.length < compact.length ? `${preview}…` : preview;
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-trajectory/src/client/TrajectoryTable.module.css.mjs
		const css$3 = "._2RHtYq_split{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);background:var(--dsw-alias-bg-layer-1);flex:1;width:100%;min-height:0;display:flex;position:relative;overflow:hidden;container-type:inline-size}._2RHtYq_tablePane{min-width:0;padding-bottom:var(--dsh-trajectory-bottom-clearance,0px);flex:1;position:relative;overflow:hidden auto;container:_2RHtYq_trajectory-table/inline-size}._2RHtYq_historyLoading{z-index:5;pointer-events:none;height:0;position:sticky;top:0;overflow:visible}._2RHtYq_historyLoadingBar{box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;height:30px;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);justify-content:center;align-items:center;gap:6px;display:flex}._2RHtYq_historyLoadingSpinner{box-sizing:border-box;border:1.5px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-state-business-primary);border-radius:50%;width:10px;height:10px;animation:.7s linear infinite _2RHtYq_history-loading-spin}._2RHtYq_table:not([data-scroll-ready=true]){visibility:hidden}@keyframes _2RHtYq_history-loading-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){._2RHtYq_historyLoadingSpinner{animation:none}}._2RHtYq_table{--trajectory-turn-accent:color-mix(in srgb, var(--dsw-static-blue-500) 22%, var(--dsw-alias-bg-layer-1));border-spacing:0;table-layout:fixed;width:100%;min-width:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);font:var(--dsw-font-xxs-12)}._2RHtYq_eventColumn{width:122px}._2RHtYq_contentColumn{width:auto}._2RHtYq_table th{z-index:3;box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l2);height:30px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-specific-sidebar-fill);font:var(--dsw-font-xxs-12);text-align:left;text-overflow:ellipsis;user-select:none;white-space:nowrap;padding:0 8px;font-weight:500;position:sticky;top:0;overflow:hidden}._2RHtYq_eventHeader{text-align:right!important;padding-right:4px!important}._2RHtYq_table td{box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l1);text-overflow:ellipsis;white-space:nowrap;height:30px;padding:0 8px;overflow:hidden}._2RHtYq_table tbody ._2RHtYq_virtualSpacer{pointer-events:none}._2RHtYq_table tbody ._2RHtYq_virtualSpacer td{height:var(--trajectory-virtual-spacer-height);border:0;padding:0}._2RHtYq_table tbody tr:not([data-collapsed-summary]):not([data-virtual-spacer]){cursor:default;transition:background-color .12s var(--ds-ease-in-out), opacity .12s var(--ds-ease-in-out);outline:none}._2RHtYq_table tbody tr[data-timeline-focus=outside]{opacity:.24}._2RHtYq_table tbody tr:not([data-collapsed-summary]):not([data-virtual-spacer]):not([data-selected=true]):hover{background:var(--dsw-alias-interactive-bg-hover)}._2RHtYq_table tbody tr[data-request-only=true]:hover{background:0 0}._2RHtYq_table tbody tr[data-request-only=true] td{border-bottom:0;height:0;padding-top:0;padding-bottom:0}._2RHtYq_table tbody tr[data-terminal-request-boundary=true] td{height:9px}._2RHtYq_table tbody tr[data-request-only=true] ._2RHtYq_turnRail{top:-15px;bottom:0}._2RHtYq_table tbody tr:not([data-collapsed-summary]):focus-visible{box-shadow:inset 0 0 0 1px var(--dsw-alias-state-business-primary)}._2RHtYq_table tbody tr[data-selected=true]{background:var(--dsw-alias-interactive-bg-active)}._2RHtYq_requestBoundaryControl{--request-boundary-base-left:12px;z-index:6;top:-8px;left:calc(var(--request-boundary-base-left) + var(--request-boundary-offset,0px));cursor:pointer;background:0 0;border:0;width:16px;height:16px;padding:0;position:absolute}._2RHtYq_requestBoundaryControl:before{background:var(--dsw-alias-label-caption);width:5px;height:5px;box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-1), 0 0 0 3px transparent;content:\"\";transition:background .12s var(--ds-ease-in-out), box-shadow .12s var(--ds-ease-in-out);border-radius:50%;position:absolute;top:5.5px;left:5.5px}._2RHtYq_requestBoundaryControl:after{border:1px solid var(--dsw-alias-border-l1);width:max-content;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);content:attr(data-label);font:9px/12px var(--ds-font-family-code);opacity:0;pointer-events:none;transition:opacity .12s var(--ds-ease-in-out), transform .12s var(--ds-ease-in-out);user-select:none;white-space:nowrap;border-radius:2px;padding:0 4px;position:absolute;top:2px;left:17px;transform:translate(-2px);box-shadow:0 2px 6px #0000001f}._2RHtYq_requestBoundaryControl:hover:before,._2RHtYq_requestBoundaryControl:focus-visible:before{background:var(--dsw-alias-brand-primary-new-colorprimary-new-color)}._2RHtYq_requestBoundaryControlActive:before,._2RHtYq_requestBoundaryControlActive:hover:before,._2RHtYq_requestBoundaryControlActive:focus-visible:before{background:color-mix(in srgb, var(--dsw-alias-brand-primary-new-colorprimary-new-color) 18%, var(--dsw-alias-bg-layer-1));box-shadow:0 0 0 1.5px var(--dsw-alias-brand-primary-new-colorprimary-new-color)}._2RHtYq_requestBoundaryControl[data-request-status=error]:before,._2RHtYq_requestBoundaryControl[data-request-status=error]:hover:before,._2RHtYq_requestBoundaryControl[data-request-status=error]:focus-visible:before{background:var(--dsw-alias-state-error-primary)}._2RHtYq_requestBoundaryControl:hover:after,._2RHtYq_requestBoundaryControl:focus-visible:after{opacity:1;transform:translate(0)}._2RHtYq_requestBoundaryControl:focus-visible{outline:none}._2RHtYq_table tbody tr:has(._2RHtYq_requestBoundaryControl:hover):not([data-selected=true]){background:0 0}._2RHtYq_event{position:relative}._2RHtYq_turnRail,._2RHtYq_selectionRail{background:var(--dsw-alias-brand-primary-new-colorprimary-new-color);pointer-events:none;position:absolute;left:0}._2RHtYq_turnRail{z-index:4;background:var(--trajectory-turn-accent);width:2px;top:-1px;bottom:-1px}._2RHtYq_table tbody tr[data-turn-end=true] ._2RHtYq_turnRail{bottom:0}._2RHtYq_selectionRail{z-index:5;width:3px;top:0;bottom:0}._2RHtYq_table tbody tr[data-error=true] ._2RHtYq_turnRail{background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 22%, var(--dsw-alias-bg-layer-1))}._2RHtYq_table tbody tr[data-error=true] ._2RHtYq_selectionRail{background:var(--dsw-alias-state-error-primary)}._2RHtYq_table tbody tr[data-turn-start=true] td{position:relative;overflow:visible}._2RHtYq_table tbody tr[data-turn-start=true]:not(:first-child) td:before{z-index:1;background:var(--dsw-alias-border-l1);content:\"\";pointer-events:none;height:2px;position:absolute;top:0;left:0;right:0;transform:translateY(-50%)}._2RHtYq_event{padding-left:36px!important;padding-right:4px!important;overflow:visible!important}._2RHtYq_turnLabel{z-index:3;box-sizing:border-box;width:max-content;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-module-platform);font:8px/10px var(--ds-font-family-code);font-variant-numeric:tabular-nums;user-select:none;white-space:nowrap;border-radius:0 0 2px;flex:none;align-items:center;padding:1px 5px;display:inline-grid;position:absolute;top:0;left:0}._2RHtYq_turnLabelFull,._2RHtYq_turnLabelCompact{opacity:1;white-space:nowrap;grid-area:1/1;max-width:64px;overflow:hidden}._2RHtYq_turnLabelCompact{opacity:0;max-width:0}._2RHtYq_turnLabelActive{color:color-mix(in srgb, var(--dsw-static-blue-500) 55%, var(--dsw-alias-label-tertiary));background:var(--trajectory-turn-accent)}._2RHtYq_eventInner{justify-content:flex-start;align-items:center;min-width:0;height:100%;display:flex}._2RHtYq_kindSlot{flex:none;justify-content:flex-end;align-items:flex-end;width:76px;display:flex}._2RHtYq_kindSlot [role=tooltip]{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-shadow-lv2);color:var(--dsw-alias-label-primary)}._2RHtYq_content{color:var(--dsw-alias-label-primary);padding-left:4px!important}._2RHtYq_kindTag{box-sizing:border-box;letter-spacing:.035em;user-select:none;border:1px solid #0000;border-radius:4px;flex:none;align-items:center;height:19px;padding:0 5px;font-size:10px;font-weight:650;line-height:16px;display:inline-flex}._2RHtYq_kindTagIcon{opacity:0;flex:none;justify-content:center;align-items:center;width:0;height:13px;display:inline-flex;overflow:hidden;transform:scale(.8)}._2RHtYq_kindTagLabel{opacity:1;white-space:nowrap;max-width:72px;display:inline-block;overflow:hidden}._2RHtYq_table ._2RHtYq_kindSlot ._2RHtYq_message{justify-content:center;width:100%}@container _2RHtYq_trajectory-table (width<=620px){._2RHtYq_eventColumn{width:50px}._2RHtYq_event{padding-left:28px!important;padding-right:3px!important}._2RHtYq_requestBoundaryControl{--request-boundary-base-left:6px}._2RHtYq_kindSlot{width:19px}._2RHtYq_kindTag,._2RHtYq_table ._2RHtYq_kindSlot ._2RHtYq_message{justify-content:center;width:19px;padding-left:0;padding-right:0}._2RHtYq_kindTagIcon{opacity:1;width:13px;transform:scale(1)}._2RHtYq_kindTagLabel,._2RHtYq_turnLabelFull{opacity:0;max-width:0}._2RHtYq_turnLabelCompact{opacity:1;max-width:64px}}@media (prefers-reduced-motion:no-preference){._2RHtYq_eventColumn,._2RHtYq_event,._2RHtYq_requestBoundaryControl,._2RHtYq_kindSlot,._2RHtYq_kindTag,._2RHtYq_kindTagIcon,._2RHtYq_kindTagLabel,._2RHtYq_turnLabelFull,._2RHtYq_turnLabelCompact{transition-duration:.18s;transition-timing-function:var(--ds-ease-in-out)}._2RHtYq_eventColumn,._2RHtYq_kindSlot{transition-property:width}._2RHtYq_event{transition-property:padding-right,padding-left}._2RHtYq_requestBoundaryControl{transition-property:left}._2RHtYq_kindTag{transition-property:padding-right,padding-left}._2RHtYq_kindTagIcon{transition-property:width,opacity,transform}._2RHtYq_kindTagLabel,._2RHtYq_turnLabelFull,._2RHtYq_turnLabelCompact{transition-property:max-width,opacity}}._2RHtYq_user{color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-state-business-tertiary)}._2RHtYq_systemNeutral{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-module-platform)}._2RHtYq_contextGreen{color:color-mix(in srgb, var(--dsw-alias-state-success-primary) 68%, var(--dsw-alias-label-secondary));background:var(--dsw-alias-state-success-tertiary)}._2RHtYq_compacted{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-module-platform)}._2RHtYq_compactedSummary{font:var(--dsw-font-xs-13);margin-top:12px;padding:0 0 14px}._2RHtYq_promptDiffSections{flex-direction:column;gap:14px;max-height:100%;padding:10px 14px 14px;display:flex;overflow:auto}._2RHtYq_promptDiffSection{min-width:0}._2RHtYq_promptDiffTitle{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-strong-13);user-select:none;margin:0 0 6px}._2RHtYq_promptDiff{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);font:11px/17px var(--ds-font-family-code);white-space:pre;margin:0;overflow:auto}._2RHtYq_promptDiff span{min-width:max-content;padding:0 6px;display:block}._2RHtYq_promptDiffLinemeta{color:var(--dsw-alias-label-caption);background:var(--dsw-alias-bg-module-platform);user-select:none}._2RHtYq_promptDiffLinecontext{color:var(--dsw-alias-label-secondary)}._2RHtYq_promptDiffLineadded{color:color-mix(in srgb, var(--dsw-alias-state-success-primary) 72%, var(--dsw-alias-label-primary));background:var(--dsw-alias-state-success-tertiary)}._2RHtYq_promptDiffLineremoved{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, var(--dsw-alias-bg-layer-1))}._2RHtYq_assistantVioletBright{color:color-mix(in srgb, var(--dsw-alias-brand-primary-new-colorprimary-new-color) 60%, var(--dsw-alias-state-error-secondary));background:color-mix(in srgb, color-mix(in srgb, var(--dsw-alias-brand-primary-new-colorprimary-new-color) 55%, var(--dsw-alias-state-error-secondary)) 15%, var(--dsw-alias-bg-layer-1))}._2RHtYq_toolAmber{color:var(--dsw-alias-state-warn-label);background:var(--dsw-alias-state-warn-tertiary)}._2RHtYq_subtoolAmber{color:color-mix(in srgb, var(--dsw-alias-state-warn-label) 62%, var(--dsw-alias-label-tertiary));background:color-mix(in srgb, var(--dsw-alias-state-warn-tertiary) 58%, var(--dsw-alias-bg-layer-1))}._2RHtYq_contentText{text-overflow:ellipsis;white-space:nowrap;min-width:0;display:block;overflow:hidden}._2RHtYq_toolCallOnly{color:var(--dsw-alias-label-tertiary)}._2RHtYq_table tbody tr[data-collapsed-summary=turn] td,._2RHtYq_table tbody tr[data-collapsed-summary=assistant] td{height:20px}._2RHtYq_table tbody tr[data-collapsed-summary]{cursor:pointer;transition:background-color .12s var(--ds-ease-in-out);outline:none}._2RHtYq_table tbody tr[data-collapsed-summary]:hover{background:var(--dsw-alias-interactive-bg-hover)}._2RHtYq_table tbody tr[data-collapsed-summary]:focus-visible{box-shadow:inset 0 0 0 1px var(--dsw-alias-state-business-primary)}._2RHtYq_collapsedTurnContent{min-width:0;color:var(--dsw-alias-label-secondary);align-items:center;font-size:12px;line-height:16px;display:flex}._2RHtYq_collapsedTurnEllipsis{color:var(--dsw-alias-label-tertiary);user-select:none;flex:none;margin-right:6px;font-weight:600}._2RHtYq_collapsedTurnText{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}._2RHtYq_resultPreview{grid-template-columns:clamp(180px, var(--trajectory-tool-request-width,calc(36cqw - 56px)), 480px) minmax(0, 1fr);align-items:center;gap:8px;min-width:0;display:grid}._2RHtYq_resultRequest,._2RHtYq_inlineResultText{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}._2RHtYq_toolCallNameTypeface{color:var(--dsw-alias-label-primary);font:400 12px/18px Menlo,Consolas,Liberation Mono,PingFang SC,Microsoft YaHei}._2RHtYq_toolCallPayload{color:var(--dsw-alias-label-secondary);font:400 12px/18px var(--ds-font-family-code);margin-left:7px}._2RHtYq_table tbody tr[data-kind=tool] ._2RHtYq_contentText,._2RHtYq_table tbody tr[data-kind=subtool] ._2RHtYq_contentText,._2RHtYq_table tbody tr[data-kind=tool] ._2RHtYq_resultPreview,._2RHtYq_table tbody tr[data-kind=subtool] ._2RHtYq_resultPreview{font-family:var(--ds-font-family-code);font-size:12px}._2RHtYq_table tbody tr[data-kind=subtool] ._2RHtYq_content{padding-left:26px}._2RHtYq_inlineResult{min-width:0;color:var(--dsw-alias-label-secondary);align-items:center;display:flex}._2RHtYq_noOutputText{color:var(--dsw-alias-label-caption)}._2RHtYq_arrow{color:var(--dsw-alias-label-caption);flex:none;margin-right:8px}._2RHtYq_error,._2RHtYq_overview dd._2RHtYq_error,._2RHtYq_details ._2RHtYq_errorPayload{color:var(--dsw-alias-state-error-primary)}._2RHtYq_details ._2RHtYq_errorPayload ._2RHtYq_resultBlockText{color:inherit}._2RHtYq_details ._2RHtYq_jsonPayload._2RHtYq_errorPayload,._2RHtYq_details ._2RHtYq_jsonPreview._2RHtYq_errorPayload{--json-tree-property:var(--dsw-alias-state-error-primary);--json-tree-string:var(--dsw-alias-state-error-primary);--json-tree-number:var(--dsw-alias-state-error-primary);--json-tree-keyword:var(--dsw-alias-state-error-primary);--json-tree-punctuation:var(--dsw-alias-state-error-primary);--json-tree-icon:var(--dsw-alias-state-error-primary)}._2RHtYq_details{border-left:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);flex-direction:column;flex:none;width:clamp(320px,38%,440px);min-width:0;max-width:calc(100% - 280px);min-height:0;display:flex;position:relative}._2RHtYq_detailsResizeHandle{z-index:6;cursor:col-resize;touch-action:none;user-select:none;background:0 0;border:0;width:8px;padding:0;position:absolute;top:0;bottom:0;left:-4px}._2RHtYq_detailsResizeHandle:focus-visible{outline:none}._2RHtYq_detailsHeader{box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;justify-content:space-between;align-items:center;height:42px;padding:0 8px 0 12px;display:flex}._2RHtYq_detailsTitle{min-width:0;color:var(--dsw-alias-label-primary);align-items:center;gap:8px;display:flex}._2RHtYq_requestDetailsDot{background:var(--dsw-alias-label-secondary);border-radius:50%;flex:none;width:5px;height:5px}._2RHtYq_requestDetailsName{font:500 12px/16px var(--ds-font-family-code);flex:none}._2RHtYq_detailsLocation{min-width:0;color:var(--dsw-alias-label-tertiary);font:11px/16px var(--ds-font-family-code);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}._2RHtYq_close{width:28px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;border-radius:6px;flex:none;justify-content:center;align-items:center;padding:0;font-size:18px;line-height:18px;display:inline-flex}._2RHtYq_close:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}._2RHtYq_detailTabs{box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l2);overscroll-behavior-x:contain;scrollbar-width:none;white-space:nowrap;flex:none;gap:1px;width:100%;min-width:0;max-width:100%;height:34px;padding:0 8px;display:flex;overflow:auto hidden}._2RHtYq_detailTabs::-webkit-scrollbar{display:none}._2RHtYq_detailTab{color:var(--dsw-alias-label-tertiary);cursor:pointer;font:var(--dsw-font-xs-13);background:0 0;border:0;flex:none;padding:0 9px;position:relative}._2RHtYq_detailTab:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}._2RHtYq_detailTabActive{color:var(--dsw-alias-state-business-primary)}._2RHtYq_detailTabActive:after{background:var(--dsw-alias-state-business-primary);content:\"\";border-radius:1px 1px 0 0;height:2px;position:absolute;bottom:0;left:9px;right:9px}._2RHtYq_close:focus-visible,._2RHtYq_detailTab:focus-visible{outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:-1px}._2RHtYq_detailBody{min-height:0;padding-bottom:var(--dsh-trajectory-bottom-clearance,0px);scrollbar-gutter:stable;flex:1;overflow:hidden auto}._2RHtYq_detailBodySummary{box-sizing:border-box;padding-bottom:calc(12px + var(--dsh-trajectory-bottom-clearance,0px));flex-direction:column;display:flex;overflow:hidden}._2RHtYq_detailBodySummary>._2RHtYq_overview{overscroll-behavior:contain;flex:0 auto;min-height:0;overflow:auto}._2RHtYq_detailBodySummary>._2RHtYq_compactedSummary{flex:1;min-height:0;overflow:auto}._2RHtYq_summaryScrollRegion{--dsh-scrollbar-thumb:transparent;--dsh-scrollbar-thumb-hover:transparent}._2RHtYq_summaryScrollRegion:hover,._2RHtYq_summaryScrollRegion:focus-within{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}._2RHtYq_compactedSummary ._2RHtYq_markdownPayload{padding-right:18px}._2RHtYq_overview{font:var(--dsw-font-xs-13);margin:0;padding:8px 0}._2RHtYq_overviewParentLinks{gap:14px;display:flex}._2RHtYq_overviewHierarchyNavLink{all:unset;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;opacity:1;align-items:center;gap:1px;display:inline-flex}._2RHtYq_overviewHierarchyNavLink:hover{color:var(--dsw-alias-label-primary)}._2RHtYq_overviewHierarchyJumpIconTight{color:var(--dsw-alias-label-caption);flex:none}._2RHtYq_overviewHierarchyNavLink:hover ._2RHtYq_overviewHierarchyJumpIconTight,._2RHtYq_overviewHierarchyNavLink:focus-visible ._2RHtYq_overviewHierarchyJumpIconTight{color:var(--dsw-alias-label-primary)}._2RHtYq_overviewHierarchyNavLink:focus-visible{color:var(--dsw-alias-label-primary);outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:2px}._2RHtYq_overview>div{grid-template-columns:94px minmax(0,1fr);align-items:center;min-height:22px;padding:0 14px;display:grid}._2RHtYq_overview>._2RHtYq_requestTokenDetail dt{padding-left:12px}._2RHtYq_usagePanel{padding:4px 0 10px}._2RHtYq_usageGroup+._2RHtYq_usageGroup{margin-top:8px}._2RHtYq_usageHeading{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-strong-13);user-select:none;margin:0;padding:4px 14px 1px}._2RHtYq_usageGroup ._2RHtYq_overview{padding:0}._2RHtYq_overview dt{color:var(--dsw-alias-label-tertiary)}._2RHtYq_overview dd{min-width:0;color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;margin:0;overflow:hidden}._2RHtYq_timestampToggle{all:unset;color:inherit;cursor:pointer;font:inherit;user-select:text}._2RHtYq_timestampToggle:focus-visible{outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:2px}._2RHtYq_overviewSections{border-top:0;flex-direction:column;flex:1;min-height:min-content;display:flex;overflow:hidden}._2RHtYq_overviewSection{flex-direction:column;flex:1 1 0;min-height:28px;max-height:max-content;display:flex;overflow:hidden}._2RHtYq_overviewSection+._2RHtYq_overviewSection{padding-top:8px}._2RHtYq_overviewHeading{box-sizing:border-box;width:100%;height:28px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);font:var(--dsw-font-xs-strong-13);user-select:none;flex:none;align-items:flex-end;margin:0;padding:0 0 3px 14px;display:flex}._2RHtYq_overviewTitle{width:max-content;height:auto;color:inherit;cursor:pointer;font:inherit;user-select:none;background:0 0;border:0;flex:none;align-items:center;gap:3px;padding:0;line-height:1;display:inline-flex}._2RHtYq_overviewTitleIcon{color:var(--dsw-alias-label-caption);flex:none}._2RHtYq_overviewTitle:hover ._2RHtYq_overviewTitleIcon{color:var(--dsw-alias-label-primary)}._2RHtYq_overviewTitle:focus-visible{outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:2px}._2RHtYq_overviewTitle:focus-visible ._2RHtYq_overviewTitleIcon{color:var(--dsw-alias-state-business-primary)}._2RHtYq_overviewPreview{overscroll-behavior:contain;background:var(--dsw-alias-bg-layer-1);flex:1;min-height:0;overflow:auto}._2RHtYq_overviewPreview>:last-child{margin-bottom:0;padding-bottom:0}._2RHtYq_overviewPreview ._2RHtYq_jsonPreview>:first-child,._2RHtYq_overviewPreview ._2RHtYq_schemaTree>:first-child{padding-bottom:0}._2RHtYq_overviewPreview ._2RHtYq_schemaTree{margin-bottom:0}._2RHtYq_overviewPreview ._2RHtYq_overview{padding:2px 0 0}._2RHtYq_overviewPreview ._2RHtYq_overview>div{min-height:22px}._2RHtYq_markdownPreview,._2RHtYq_markdownPayload{color:var(--dsw-alias-label-primary)}._2RHtYq_markdownPreview>div,._2RHtYq_markdownPayload>div{font:var(--dsw-font-xs-13);gap:8px}._2RHtYq_markdownPreview>div h1,._2RHtYq_markdownPayload>div h1{font:600 16px/22px var(--dsw-font-family)}._2RHtYq_markdownPreview>div h2,._2RHtYq_markdownPayload>div h2{font:600 15px/22px var(--dsw-font-family)}._2RHtYq_markdownPreview>div :where(h3,h4,h5,h6),._2RHtYq_markdownPayload>div :where(h3,h4,h5,h6){font:600 14px/20px var(--dsw-font-family)}._2RHtYq_markdownPreview>div :not(pre)>code,._2RHtYq_markdownPayload>div :not(pre)>code{font:12px/18px var(--ds-font-family-code)}._2RHtYq_markdownPreview>div table,._2RHtYq_markdownPayload>div table{font:var(--dsw-font-xs-13)}._2RHtYq_markdownPreview>div>:first-child{margin-top:0}._2RHtYq_markdownPreview>div>:last-child{margin-bottom:0}._2RHtYq_markdownPreview>div :where(h1,h2,h3){margin:12px 0 6px}._2RHtYq_markdownPreview>div :where(h4,h5,h6){margin:10px 0 5px}._2RHtYq_markdownPreview>div :where(p,ul,ol){margin:8px 0}._2RHtYq_markdownPreview>div li:not(:first-child){margin-top:3px}._2RHtYq_markdownPreview>div blockquote{margin-top:8px}._2RHtYq_markdownPreview>div hr{margin:14px 0}._2RHtYq_markdownPreview>div>.md-code-block{margin:10px 0}._2RHtYq_assistantContent ._2RHtYq_markdownPayload,._2RHtYq_assistantContent ._2RHtYq_payload{min-height:0}._2RHtYq_thinkingQuote{border-left:2px solid var(--dsw-alias-markdown-citation);color:var(--dsw-alias-label-secondary);background:0 0;margin:6px 14px 0 12px;padding-left:6px}._2RHtYq_thinkingQuoteOnlyPreview{margin-bottom:8px}._2RHtYq_detailBody>._2RHtYq_assistantContentRendered ._2RHtYq_thinkingQuote{margin-top:14px}._2RHtYq_thinkingToggle{width:max-content;height:18px;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:600 12px/18px var(--dsw-font-family);user-select:none;background:0 0;border:0;align-items:center;gap:2px;padding:0;display:flex}._2RHtYq_thinkingChevron{transition:transform .12s var(--ds-ease-in-out);flex:none}._2RHtYq_thinkingToggle[aria-expanded=true] ._2RHtYq_thinkingChevron{transform:rotate(90deg)}._2RHtYq_thinkingToggle:hover{color:var(--dsw-alias-label-secondary)}._2RHtYq_thinkingToggle:focus-visible{outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:2px}._2RHtYq_thinkingQuote ._2RHtYq_markdownPreview,._2RHtYq_thinkingQuote ._2RHtYq_markdownPayload,._2RHtYq_thinkingQuote ._2RHtYq_payload{min-height:0;color:var(--dsw-alias-label-secondary);background:0 0;padding:2px 0}._2RHtYq_assistantOutput{background:var(--dsw-alias-bg-layer-1)}._2RHtYq_markdownPreview{padding:6px 14px 8px}._2RHtYq_markdownPayload{min-height:100%;padding:14px}._2RHtYq_jsonPayload{min-height:100%}._2RHtYq_jsonPreview{min-height:0}._2RHtYq_schema{background:var(--dsw-alias-bg-layer-1);min-height:100%}._2RHtYq_schemaPreview{min-height:0}._2RHtYq_schemaIntro{padding:12px 14px 6px}._2RHtYq_schemaPreview ._2RHtYq_schemaIntro{padding-top:6px}._2RHtYq_schemaName{color:var(--dsw-alias-label-primary);font:600 12px/18px var(--ds-font-family-code);margin:0}._2RHtYq_schemaDescription{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13);white-space:pre-wrap;margin:2px 0 0}._2RHtYq_schemaParameters{min-width:0}._2RHtYq_schemaParametersTitle{color:var(--dsw-alias-label-tertiary);font:600 11px/16px var(--dsw-font-family);user-select:none;margin:0;padding:4px 14px 2px}._2RHtYq_schemaTree{margin:0 6px 8px 0}._2RHtYq_payload{box-sizing:border-box;overflow-wrap:anywhere;min-height:100%;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-markdown-code-block);font:12px/19px var(--ds-font-family-code);tab-size:2;white-space:pre-wrap;margin:0;padding:14px}._2RHtYq_payloadPreview{min-height:0;padding:6px 14px 8px}._2RHtYq_sourceBlocks{box-sizing:border-box;min-height:100%;padding:12px 14px}._2RHtYq_sourceBlock+._2RHtYq_sourceBlock{margin-top:14px}._2RHtYq_sourceBlockHeader,._2RHtYq_sourceBlockJumpTarget{user-select:none;align-items:center;gap:3px;width:max-content;margin-bottom:3px;display:flex}._2RHtYq_sourceBlockJumpTarget{all:unset;cursor:pointer;user-select:none;align-items:center;gap:3px;width:max-content;margin-bottom:3px;display:flex}._2RHtYq_sourceBlockLabel{color:var(--dsw-alias-label-tertiary);font:11px/16px var(--ds-font-family-code)}._2RHtYq_sourceBlockJumpIcon{color:var(--dsw-alias-label-caption);flex:none}._2RHtYq_sourceBlockJumpTarget:hover ._2RHtYq_sourceBlockJumpIcon{color:var(--dsw-alias-label-primary)}._2RHtYq_sourceBlockJumpTarget:focus-visible{outline:none}._2RHtYq_sourceBlockJumpTarget:focus-visible ._2RHtYq_sourceBlockJumpIcon{color:var(--dsw-alias-state-business-primary)}._2RHtYq_sourceBlockContent{overflow-wrap:anywhere;color:var(--dsw-alias-label-primary);font:12px/19px var(--ds-font-family-code);tab-size:2;white-space:pre-wrap;background:0 0;margin:0}._2RHtYq_panelImageLink{cursor:zoom-in;border-radius:4px;width:auto;max-width:100%;display:block;overflow:hidden}._2RHtYq_panelImageLinkPreview{max-height:140px}._2RHtYq_panelImage{border-radius:inherit;background:var(--dsw-alias-bg-base);object-fit:contain;width:auto;max-width:100%;height:auto;max-height:320px;margin:0;display:block}._2RHtYq_panelImageLinkPreview ._2RHtYq_panelImage{max-height:140px}._2RHtYq_messageImages{flex-direction:column;gap:8px;margin:8px 14px 14px;display:flex}._2RHtYq_messageImagesPreview{gap:6px;margin:6px 14px 8px}._2RHtYq_assistantToolCalls{box-sizing:border-box;max-width:100%;color:var(--dsw-alias-label-secondary);font:11px/17px var(--ds-font-family-code);margin:2px 14px 12px;padding:0;list-style:none}._2RHtYq_assistantToolCallsPreview{margin-top:2px;margin-bottom:8px}._2RHtYq_assistantToolCalls li{min-width:0}._2RHtYq_assistantToolCallButton{all:unset;box-sizing:border-box;cursor:pointer;border-radius:3px;align-items:center;width:calc(100% + 4px);min-width:0;height:19px;margin-left:-4px;padding:0 4px;display:flex}._2RHtYq_assistantToolCallButton:hover{background:var(--dsw-alias-interactive-bg-hover)}._2RHtYq_assistantToolCallButton:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:-1px}._2RHtYq_assistantToolCallIcon{color:var(--dsw-alias-label-caption);flex:none;margin-right:5px}._2RHtYq_assistantToolCallButton:hover ._2RHtYq_assistantToolCallIcon,._2RHtYq_assistantToolCallButton:focus-visible ._2RHtYq_assistantToolCallIcon{color:var(--dsw-alias-label-secondary)}._2RHtYq_assistantToolCallText{white-space:nowrap;flex:1;min-width:0;display:flex;overflow:hidden}._2RHtYq_assistantToolCallName{color:var(--dsw-alias-label-secondary);flex:none;margin-right:5px;font-weight:500}._2RHtYq_assistantToolCallArgs{min-width:0;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}._2RHtYq_systemPrompt{box-sizing:border-box}._2RHtYq_toolCatalog{min-height:100%;padding:8px 0 16px}._2RHtYq_toolCatalogItem{border-bottom:1px solid var(--dsw-alias-border-l1)}._2RHtYq_toolCatalogSummary{box-sizing:border-box;cursor:pointer;user-select:none;grid-template-columns:12px 12px max-content minmax(0,1fr);align-items:center;gap:5px;min-height:30px;padding:4px 12px;list-style:none;display:grid}._2RHtYq_toolCatalogSummary::-webkit-details-marker{display:none}._2RHtYq_toolCatalogSummary:hover{background:var(--dsw-alias-interactive-bg-hover)}._2RHtYq_toolCatalogSummary:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:-1px}._2RHtYq_toolCatalogChevron,._2RHtYq_toolCatalogIcon{color:var(--dsw-alias-label-caption)}._2RHtYq_toolCatalogChevron{transition:transform .1s var(--ds-ease-in-out)}._2RHtYq_toolCatalogItem[open] ._2RHtYq_toolCatalogChevron{transform:rotate(90deg)}._2RHtYq_toolCatalogName{color:var(--dsw-alias-label-primary);font:500 12px/18px var(--ds-font-family-code)}._2RHtYq_toolCatalogDescription{min-width:0;color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xs-13);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}._2RHtYq_toolCatalogDefinition{background:var(--dsw-alias-bg-base);padding:0 0 8px 29px}._2RHtYq_toolCatalogFullDescription{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13);white-space:pre-wrap;margin:0;padding:7px 14px 4px 0}._2RHtYq_toolCatalogTree{margin-left:-14px;margin-right:6px}._2RHtYq_resultBlocks{box-sizing:border-box;flex-direction:column;gap:10px;min-height:100%;padding:14px;display:flex}._2RHtYq_resultBlocksPreview{gap:6px;min-height:0;padding:6px 14px 8px}._2RHtYq_resultBlockText{overflow-wrap:anywhere;color:var(--dsw-alias-label-primary);font:12px/19px var(--ds-font-family-code);tab-size:2;white-space:pre-wrap;background:0 0;margin:0}._2RHtYq_overviewPreview ._2RHtYq_noPayload{padding:6px 14px 8px}._2RHtYq_noPayload{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xs-13);margin:0;padding:18px 14px}@media (width<=760px){._2RHtYq_details{z-index:5;border-left-color:var(--dsw-alias-border-l3);width:min(92%,420px);max-width:92%;position:absolute;top:0;bottom:0;right:0;box-shadow:-12px 0 32px #00000024}}";
		const tagId$3 = "@deepseek-ai/dsh-client-ui-trajectory/TrajectoryTable.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-trajectory";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var TrajectoryTable_module_css_default = {
			"eventColumn": "_2RHtYq_eventColumn",
			"overview": "_2RHtYq_overview",
			"panelImageLink": "_2RHtYq_panelImageLink",
			"toolCatalogIcon": "_2RHtYq_toolCatalogIcon",
			"toolCatalogName": "_2RHtYq_toolCatalogName",
			"assistantToolCallText": "_2RHtYq_assistantToolCallText",
			"requestDetailsName": "_2RHtYq_requestDetailsName",
			"detailBody": "_2RHtYq_detailBody",
			"overviewPreview": "_2RHtYq_overviewPreview",
			"detailTabActive": "_2RHtYq_detailTabActive",
			"content": "_2RHtYq_content",
			"compacted": "_2RHtYq_compacted",
			"overviewParentLinks": "_2RHtYq_overviewParentLinks",
			"message": "_2RHtYq_message",
			"overviewHeading": "_2RHtYq_overviewHeading",
			"overviewHierarchyJumpIconTight": "_2RHtYq_overviewHierarchyJumpIconTight",
			"promptDiffSection": "_2RHtYq_promptDiffSection",
			"sourceBlockContent": "_2RHtYq_sourceBlockContent",
			"thinkingQuoteOnlyPreview": "_2RHtYq_thinkingQuoteOnlyPreview",
			"schemaName": "_2RHtYq_schemaName",
			"event": "_2RHtYq_event",
			"jsonPayload": "_2RHtYq_jsonPayload",
			"toolCatalogDefinition": "_2RHtYq_toolCatalogDefinition",
			"subtoolAmber": "_2RHtYq_subtoolAmber",
			"usageGroup": "_2RHtYq_usageGroup",
			"contentText": "_2RHtYq_contentText",
			"collapsedTurnEllipsis": "_2RHtYq_collapsedTurnEllipsis",
			"timestampToggle": "_2RHtYq_timestampToggle",
			"payload": "_2RHtYq_payload",
			"promptDiffTitle": "_2RHtYq_promptDiffTitle",
			"toolAmber": "_2RHtYq_toolAmber",
			"historyLoadingBar": "_2RHtYq_historyLoadingBar",
			"summaryScrollRegion": "_2RHtYq_summaryScrollRegion",
			"assistantToolCallIcon": "_2RHtYq_assistantToolCallIcon",
			"resultPreview": "_2RHtYq_resultPreview",
			"messageImagesPreview": "_2RHtYq_messageImagesPreview",
			"promptDiffSections": "_2RHtYq_promptDiffSections",
			"assistantToolCallArgs": "_2RHtYq_assistantToolCallArgs",
			"trajectory-table": "_2RHtYq_trajectory-table",
			"contentColumn": "_2RHtYq_contentColumn",
			"usagePanel": "_2RHtYq_usagePanel",
			"selectionRail": "_2RHtYq_selectionRail",
			"schemaParameters": "_2RHtYq_schemaParameters",
			"schemaTree": "_2RHtYq_schemaTree",
			"assistantToolCalls": "_2RHtYq_assistantToolCalls",
			"thinkingChevron": "_2RHtYq_thinkingChevron",
			"sourceBlockJumpTarget": "_2RHtYq_sourceBlockJumpTarget",
			"toolCatalogTree": "_2RHtYq_toolCatalogTree",
			"virtualSpacer": "_2RHtYq_virtualSpacer",
			"promptDiffLineadded": "_2RHtYq_promptDiffLineadded",
			"turnLabelCompact": "_2RHtYq_turnLabelCompact",
			"overviewTitleIcon": "_2RHtYq_overviewTitleIcon",
			"contextGreen": "_2RHtYq_contextGreen",
			"sourceBlock": "_2RHtYq_sourceBlock",
			"history-loading-spin": "_2RHtYq_history-loading-spin",
			"detailTab": "_2RHtYq_detailTab",
			"turnLabelActive": "_2RHtYq_turnLabelActive",
			"assistantVioletBright": "_2RHtYq_assistantVioletBright",
			"user": "_2RHtYq_user",
			"kindTagLabel": "_2RHtYq_kindTagLabel",
			"toolCallOnly": "_2RHtYq_toolCallOnly",
			"sourceBlockJumpIcon": "_2RHtYq_sourceBlockJumpIcon",
			"panelImageLinkPreview": "_2RHtYq_panelImageLinkPreview",
			"assistantToolCallButton": "_2RHtYq_assistantToolCallButton",
			"resultRequest": "_2RHtYq_resultRequest",
			"promptDiffLineremoved": "_2RHtYq_promptDiffLineremoved",
			"requestTokenDetail": "_2RHtYq_requestTokenDetail",
			"usageHeading": "_2RHtYq_usageHeading",
			"schemaParametersTitle": "_2RHtYq_schemaParametersTitle",
			"toolCatalogItem": "_2RHtYq_toolCatalogItem",
			"eventInner": "_2RHtYq_eventInner",
			"sourceBlockLabel": "_2RHtYq_sourceBlockLabel",
			"toolCatalogChevron": "_2RHtYq_toolCatalogChevron",
			"table": "_2RHtYq_table",
			"turnLabelFull": "_2RHtYq_turnLabelFull",
			"promptDiff": "_2RHtYq_promptDiff",
			"kindTag": "_2RHtYq_kindTag",
			"collapsedTurnContent": "_2RHtYq_collapsedTurnContent",
			"eventHeader": "_2RHtYq_eventHeader",
			"split": "_2RHtYq_split",
			"historyLoadingSpinner": "_2RHtYq_historyLoadingSpinner",
			"markdownPayload": "_2RHtYq_markdownPayload",
			"assistantContent": "_2RHtYq_assistantContent",
			"assistantContentRendered": "_2RHtYq_assistantContentRendered",
			"schemaIntro": "_2RHtYq_schemaIntro",
			"toolCatalogDescription": "_2RHtYq_toolCatalogDescription",
			"toolCatalogFullDescription": "_2RHtYq_toolCatalogFullDescription",
			"compactedSummary": "_2RHtYq_compactedSummary",
			"toolCallNameTypeface": "_2RHtYq_toolCallNameTypeface",
			"assistantToolCallsPreview": "_2RHtYq_assistantToolCallsPreview",
			"sourceBlocks": "_2RHtYq_sourceBlocks",
			"promptDiffLinecontext": "_2RHtYq_promptDiffLinecontext",
			"detailsLocation": "_2RHtYq_detailsLocation",
			"systemPrompt": "_2RHtYq_systemPrompt",
			"historyLoading": "_2RHtYq_historyLoading",
			"panelImage": "_2RHtYq_panelImage",
			"error": "_2RHtYq_error",
			"kindTagIcon": "_2RHtYq_kindTagIcon",
			"detailBodySummary": "_2RHtYq_detailBodySummary",
			"details": "_2RHtYq_details",
			"noPayload": "_2RHtYq_noPayload",
			"inlineResultText": "_2RHtYq_inlineResultText",
			"noOutputText": "_2RHtYq_noOutputText",
			"arrow": "_2RHtYq_arrow",
			"promptDiffLinemeta": "_2RHtYq_promptDiffLinemeta",
			"resultBlockText": "_2RHtYq_resultBlockText",
			"close": "_2RHtYq_close",
			"toolCallPayload": "_2RHtYq_toolCallPayload",
			"toolCatalog": "_2RHtYq_toolCatalog",
			"toolCatalogSummary": "_2RHtYq_toolCatalogSummary",
			"inlineResult": "_2RHtYq_inlineResult",
			"systemNeutral": "_2RHtYq_systemNeutral",
			"requestBoundaryControl": "_2RHtYq_requestBoundaryControl",
			"requestDetailsDot": "_2RHtYq_requestDetailsDot",
			"markdownPreview": "_2RHtYq_markdownPreview",
			"sourceBlockHeader": "_2RHtYq_sourceBlockHeader",
			"errorPayload": "_2RHtYq_errorPayload",
			"overviewTitle": "_2RHtYq_overviewTitle",
			"resultBlocksPreview": "_2RHtYq_resultBlocksPreview",
			"schemaPreview": "_2RHtYq_schemaPreview",
			"collapsedTurnText": "_2RHtYq_collapsedTurnText",
			"thinkingToggle": "_2RHtYq_thinkingToggle",
			"overviewSection": "_2RHtYq_overviewSection",
			"jsonPreview": "_2RHtYq_jsonPreview",
			"detailsResizeHandle": "_2RHtYq_detailsResizeHandle",
			"detailsHeader": "_2RHtYq_detailsHeader",
			"detailTabs": "_2RHtYq_detailTabs",
			"schema": "_2RHtYq_schema",
			"resultBlocks": "_2RHtYq_resultBlocks",
			"thinkingQuote": "_2RHtYq_thinkingQuote",
			"assistantToolCallName": "_2RHtYq_assistantToolCallName",
			"requestBoundaryControlActive": "_2RHtYq_requestBoundaryControlActive",
			"overviewSections": "_2RHtYq_overviewSections",
			"schemaDescription": "_2RHtYq_schemaDescription",
			"detailsTitle": "_2RHtYq_detailsTitle",
			"messageImages": "_2RHtYq_messageImages",
			"turnRail": "_2RHtYq_turnRail",
			"tablePane": "_2RHtYq_tablePane",
			"assistantOutput": "_2RHtYq_assistantOutput",
			"payloadPreview": "_2RHtYq_payloadPreview",
			"turnLabel": "_2RHtYq_turnLabel",
			"kindSlot": "_2RHtYq_kindSlot",
			"overviewHierarchyNavLink": "_2RHtYq_overviewHierarchyNavLink"
		};
		//#endregion
		//#region src/client/TrajectoryTable.tsx
		/** Turn-aware trajectory event ledger with a local record inspector. */
		const BOTTOM_FOLLOW_THRESHOLD_PX = 2;
		const OLDER_LOAD_THRESHOLD_PX = 48;
		const VIRTUALIZATION_THRESHOLD = 100;
		const VIRTUAL_OVERSCAN_ROWS = 12;
		const VIRTUAL_INITIAL_VIEWPORT_HEIGHT_PX = 600;
		const KIND_LABEL = {
			system: "SYSTEM",
			user: "USER",
			context: "CONTEXT",
			compacted: "COMPACTED",
			message: "ASSISTANT",
			tool: "TOOL",
			subtool: "SUBTOOL"
		};
		function ToolWrenchIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "13",
				height: "13",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"data-role-icon": "wrench",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M14 3.3a3.8 3.8 0 0 1-4.8 4.8l-5.1 5.1a1.6 1.6 0 1 1-2.3-2.3l5.1-5.1A3.8 3.8 0 0 1 11.7 1l-2.3 2.3 2.3 2.3L14 3.3Z" })
			});
		}
		function InformationIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.4",
				strokeLinecap: "round",
				"data-role-icon": "information",
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "8",
						cy: "8",
						r: "6.7"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "8",
						cy: "5.5",
						r: ".85",
						fill: "currentColor",
						stroke: "none"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M8 7.75v3.4",
						strokeWidth: "1.8"
					})
				]
			});
		}
		function CompactedIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: "13",
				height: "13",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"data-role-icon": "compacted",
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m2.5 2.5 3.75 3.75M3 6.25h3.25V3" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m13.5 2.5-3.75 3.75M13 6.25H9.75V3" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m2.5 13.5 3.75-3.75M3 9.75h3.25V13" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m13.5 13.5-3.75-3.75M13 9.75H9.75V13" })
				]
			});
		}
		const KIND_ICON = {
			system: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutline16, { size: 13 }),
			user: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUserOutline16, { size: 13 }),
			context: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(InformationIcon, {}),
			compacted: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CompactedIcon, {}),
			message: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSparkle16, { size: 13 }),
			tool: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolWrenchIcon, {}),
			subtool: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolWrenchIcon, {})
		};
		function useStableVirtualRowStructure(rows) {
			const cache = (0, react.useRef)({
				rows: [],
				structure: []
			});
			if (cache.current.rows === rows) return cache.current.structure;
			const structure = cache.current.structure.length === rows.length && rows.every((row, index) => {
				const previous = cache.current.structure[index];
				return previous?.key === row.key && previous.height === row.height;
			}) ? cache.current.structure : rows.map((row) => ({
				key: row.key,
				height: row.height
			}));
			cache.current = {
				rows,
				structure
			};
			return structure;
		}
		const DETAILS_MIN_WIDTH = 320;
		const DETAILS_MAX_WIDTH = 720;
		const TABLE_MIN_WIDTH = 280;
		const DETAILS_RESIZE_STEP = 16;
		const TOOL_REQUEST_SHARE = .58;
		const TOOL_REQUEST_MIN_WIDTH = 180;
		const TOOL_REQUEST_MAX_WIDTH = 480;
		const DEFAULT_TOOL_REQUEST_SHARE = .36;
		const DEFAULT_TOOL_REQUEST_OFFSET = 56;
		const SYSTEM_PROMPT_TABS = [{
			id: "system-prompt",
			label: "System Prompt"
		}, {
			id: "tools",
			label: "Tools"
		}];
		const SYSTEM_UPDATE_TABS = [{
			id: "diff",
			label: "Diff"
		}, ...SYSTEM_PROMPT_TABS];
		const REQUEST_TABS = [
			{
				id: "overview",
				label: "Summary"
			},
			{
				id: "options",
				label: "Options"
			},
			{
				id: "usage",
				label: "Usage"
			},
			{
				id: "timing",
				label: "Timing"
			}
		];
		function clampDetailsWidth(width, splitWidth) {
			const maxWidth = Math.max(DETAILS_MIN_WIDTH, Math.min(DETAILS_MAX_WIDTH, splitWidth - TABLE_MIN_WIDTH));
			return Math.round(Math.min(Math.max(width, DETAILS_MIN_WIDTH), maxWidth));
		}
		function defaultToolRequestWidth(splitWidth) {
			return Math.min(Math.max(splitWidth * DEFAULT_TOOL_REQUEST_SHARE - DEFAULT_TOOL_REQUEST_OFFSET, TOOL_REQUEST_MIN_WIDTH), TOOL_REQUEST_MAX_WIDTH);
		}
		function formatDurationMs(milliseconds) {
			if (milliseconds < 1e3) return `${Math.round(milliseconds)} ms`;
			return `${(milliseconds / 1e3).toFixed(milliseconds < 1e4 ? 2 : 1)} s`;
		}
		function formatStartedAt(timestamp) {
			if (timestamp === null || !Number.isFinite(timestamp)) return "Not available";
			const date = new Date(timestamp);
			const two = (value) => String(value).padStart(2, "0");
			const three = (value) => String(value).padStart(3, "0");
			const time = `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}.${three(date.getMilliseconds())}`;
			return `${`${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`} ${time}`;
		}
		/** Whether a click lands on an active text selection and should keep it. */
		function clickSelectsText(target) {
			const selection = window.getSelection();
			return selection !== null && !selection.isCollapsed && selection.rangeCount > 0 && selection.getRangeAt(0).intersectsNode(target);
		}
		function StartedAtValue({ timestamp }) {
			const [showUnix, setShowUnix] = (0, react.useState)(false);
			if (timestamp === null || !Number.isFinite(timestamp)) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: "Not available" });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: TrajectoryTable_module_css_default.timestampToggle,
				title: showUnix ? "Show local time" : "Show Unix timestamp",
				onClick: (event) => {
					if (clickSelectsText(event.currentTarget)) return;
					setShowUnix((current) => !current);
				},
				children: showUnix ? (timestamp / 1e3).toFixed(3) : formatStartedAt(timestamp)
			}) });
		}
		function totalTime(metrics) {
			if (!metrics.timingRecorded) return "Not recorded";
			if (metrics.stepStartTime === null) return "Step start unavailable";
			if (metrics.completedTime === null) return "Pending";
			return formatDurationMs(Math.max(0, metrics.completedTime - metrics.stepStartTime));
		}
		function ttft(metrics) {
			if (!metrics.timingRecorded) return "Not recorded";
			if (metrics.stepStartTime === null) return "Step start unavailable";
			if (metrics.firstTokenTime === null) return "First token unavailable";
			return formatDurationMs(Math.max(0, metrics.firstTokenTime - metrics.stepStartTime));
		}
		function generationTime(metrics) {
			if (!metrics.timingRecorded || metrics.firstTokenTime === null) return "First token unavailable";
			if (metrics.completedTime === null) return "Pending";
			return formatDurationMs(Math.max(0, metrics.completedTime - metrics.firstTokenTime));
		}
		function throughput(metrics) {
			if (!metrics.usageProvided) return "Usage unavailable";
			if (metrics.outputTokens === null) return "Output tokens unavailable";
			if (!metrics.timingRecorded || metrics.firstTokenTime === null) return "First token unavailable";
			if (metrics.completedTime === null) return "Pending";
			const generationSeconds = (metrics.completedTime - metrics.firstTokenTime) / 1e3;
			if (generationSeconds <= 0) return "Duration too short";
			return `${(metrics.outputTokens / generationSeconds).toFixed(1)} tok/s`;
		}
		function AssistantTimingPanel({ metrics }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
				className: TrajectoryTable_module_css_default.overview,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Started" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StartedAtValue, { timestamp: metrics.stepStartTime })] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Total duration" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: totalTime(metrics) })] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "TTFT" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: ttft(metrics) })] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Generation" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: generationTime(metrics) })] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Throughput" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: throughput(metrics) })] })
				]
			});
		}
		function flattenRecords(turns) {
			return turns.flatMap((turn, section) => {
				let firstInSection = true;
				const records = turn.groups.flatMap((group) => {
					return group.cells.map((cell, index) => {
						const turnStart = firstInSection && cell.requestOnly !== true && cell.kind !== "system" && (cell.kind !== "compacted" || turn.turn === null);
						if (turnStart) firstInSection = false;
						return {
							turn: turn.turn,
							section,
							group: group.title,
							groupStart: index === 0,
							turnStart,
							cell,
							turnEnd: false
						};
					});
				});
				const last = records.at(-1);
				if (last !== void 0) last.turnEnd = true;
				return records;
			});
		}
		function filterRecords(records, matches) {
			const filtered = records.filter((record) => record.cell.requestOnly !== true && matches.has(record.cell.index)).map((record) => ({
				...record,
				groupStart: false,
				turnStart: false,
				turnEnd: false
			}));
			const startedSections = /* @__PURE__ */ new Set();
			for (const [index, record] of filtered.entries()) {
				const previous = filtered[index - 1];
				const next = filtered[index + 1];
				record.groupStart = previous === void 0 || previous.section !== record.section || previous.group !== record.group;
				record.turnStart = !startedSections.has(record.section) && record.cell.kind !== "system" && (record.cell.kind !== "compacted" || record.turn === null);
				if (record.turnStart) startedSections.add(record.section);
				record.turnEnd = next === void 0 || next.section !== record.section;
			}
			return filtered;
		}
		function requestStep(group) {
			if (!group.startsWith("Step ")) return void 0;
			const value = Number(group.slice(5));
			return Number.isInteger(value) && value > 0 ? value : void 0;
		}
		function requestKey(turn, group) {
			return `${turn}\u0000${group}`;
		}
		function sectionLabel(turn) {
			return turn === null ? "Between turns" : `Turn ${turn}`;
		}
		function indexRequestNumbers(records, sessionNumbers) {
			const numbers = /* @__PURE__ */ new Map();
			for (const request of sessionNumbers ?? []) numbers.set(requestKey(request.turn, request.group), request.number);
			let next = Math.max(0, ...numbers.values()) + 1;
			const boundaries = records.filter((record) => record.groupStart && requestStep(record.group) !== void 0).sort((left, right) => left.cell.index - right.cell.index);
			for (const record of boundaries) {
				const key = requestKey(record.turn, record.group);
				if (!numbers.has(key)) numbers.set(key, next++);
			}
			return numbers;
		}
		function indexRequestBoundaryRuns(records) {
			const indexes = /* @__PURE__ */ new Map();
			let runLength = 0;
			for (const record of records) {
				if (record.cell.requestOnly === true) {
					indexes.set(record.cell.index, runLength++);
					continue;
				}
				if (runLength > 0 && record.groupStart && requestStep(record.group) !== void 0) indexes.set(record.cell.index, runLength);
				runLength = 0;
			}
			return indexes;
		}
		function summarizeTurn(records) {
			const steps = new Set(records.map((record) => record.group).filter((group) => group.startsWith("Step "))).size;
			const toolCalls = records.filter((record) => record.cell.kind === "tool" || record.cell.kind === "subtool").length;
			return [`${steps} ${steps === 1 ? "step" : "steps"}`, `${toolCalls} tool ${toolCalls === 1 ? "call" : "calls"}`].join(" · ");
		}
		function collapseTurnRecords(records, collapsedTurns) {
			const recordsByTurn = /* @__PURE__ */ new Map();
			for (const record of records) {
				if (record.turn === null) continue;
				const turnRecords = recordsByTurn.get(record.turn) ?? [];
				turnRecords.push(record);
				recordsByTurn.set(record.turn, turnRecords);
			}
			return records.flatMap((record) => {
				if (record.turn === null || !collapsedTurns.has(record.turn)) return [record];
				const turnRecords = recordsByTurn.get(record.turn) ?? [record];
				if (record.cell.requestOnly === true || record.cell.kind === "system") return [record];
				const contentRecords = turnRecords.filter((candidate) => candidate.cell.requestOnly !== true && candidate.cell.kind !== "system");
				if (contentRecords.length <= 1) return [record];
				if (record.cell.index !== contentRecords[0]?.cell.index) return [];
				return [{
					...record,
					turnEnd: false
				}, {
					...record,
					groupStart: false,
					turnStart: false,
					turnEnd: true,
					collapsedSummary: summarizeTurn(contentRecords.slice(1)),
					collapsedSummaryKind: "turn"
				}];
			});
		}
		function assistantToolCalls(records, assistantIndex) {
			const at = records.findIndex((record) => record.cell.index === assistantIndex);
			if (at === -1 || records[at]?.cell.kind !== "message") return [];
			const calls = [];
			for (let i = at + 1; i < records.length; i++) {
				const record = records[i];
				if (record === void 0) break;
				if (record.cell.kind !== "tool" && record.cell.kind !== "subtool") break;
				calls.push(record);
			}
			return calls;
		}
		function summarizeAssistantTools(records) {
			const names = [...new Set(records.map((record) => {
				const separator = record.cell.text.indexOf(" · ");
				return separator === -1 ? record.cell.text : record.cell.text.slice(0, separator);
			}).filter((name) => name !== ""))];
			const count = records.length;
			const summary = `${count} tool ${count === 1 ? "call" : "calls"}`;
			return names.length > 0 ? `${summary} · ${names.join(", ")}` : summary;
		}
		function collapseAssistantRecords(records, collapsedAssistants) {
			const out = [];
			for (let i = 0; i < records.length; i++) {
				const record = records[i];
				if (record === void 0) continue;
				out.push(record);
				if (record.cell.kind !== "message" || !collapsedAssistants.has(trajectoryRecordId(record.cell))) continue;
				const calls = [];
				for (let j = i + 1; j < records.length; j++) {
					const candidate = records[j];
					if (candidate === void 0 || candidate.collapsedSummary !== void 0 || candidate.cell.kind !== "tool" && candidate.cell.kind !== "subtool") break;
					calls.push(candidate);
				}
				if (calls.length === 0) continue;
				const last = calls.at(-1);
				out[out.length - 1] = {
					...record,
					turnEnd: false
				};
				out.push({
					...record,
					groupStart: false,
					turnStart: false,
					turnEnd: last?.turnEnd ?? false,
					collapsedSummary: summarizeAssistantTools(calls),
					collapsedSummaryKind: "assistant"
				});
				i += calls.length;
			}
			return out;
		}
		function stateOf(record) {
			if (record.cell.isError) return "error";
			if (record.cell.kind === "compacted" && record.cell.timeSeconds === null) return "running";
			if ((record.cell.kind === "tool" || record.cell.kind === "subtool") && record.cell.outputDetail === void 0) return "running";
			return "complete";
		}
		function statusLabel(state) {
			if (state === "error") return "Failed";
			if (state === "running") return "Pending";
			return "Completed";
		}
		function TokenRows({ cell }) {
			const content = cell.output !== void 0 && cell.think !== void 0 ? Math.max(0, cell.output - cell.think) : void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Tokens" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: cell.output === void 0 ? "—" : `${cell.output} tok` })] }),
				cell.think !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: TrajectoryTable_module_css_default.requestTokenDetail,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Reasoning" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dd", { children: [cell.think, " tok"] })]
				}),
				content !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: TrajectoryTable_module_css_default.requestTokenDetail,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Content" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dd", { children: [content, " tok"] })]
				})
			] });
		}
		function inputTotal(usage) {
			if (usage.input === void 0 && usage.cacheRead === void 0 && usage.cacheWrite === void 0) return void 0;
			return (usage.input ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0);
		}
		function UsageRows({ usage }) {
			if (usage === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: TrajectoryTable_module_css_default.noPayload,
				children: "Usage not reported"
			});
			const totalInput = inputTotal(usage);
			const otherOutput = usage.output !== void 0 && usage.reasoning !== void 0 ? usage.output - usage.reasoning : void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
				className: TrajectoryTable_module_css_default.overview,
				children: [
					totalInput !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Input" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dd", { children: [totalInput, " tok"] })] }),
					usage.cacheRead !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: TrajectoryTable_module_css_default.requestTokenDetail,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Cached" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dd", { children: [usage.cacheRead, " tok"] })]
					}),
					usage.cacheWrite !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: TrajectoryTable_module_css_default.requestTokenDetail,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Cache created" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dd", { children: [usage.cacheWrite, " tok"] })]
					}),
					usage.input !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: TrajectoryTable_module_css_default.requestTokenDetail,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Other" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dd", { children: [usage.input, " tok"] })]
					}),
					usage.output !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Output" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dd", { children: [usage.output, " tok"] })] }),
					usage.reasoning !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: TrajectoryTable_module_css_default.requestTokenDetail,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Reasoning" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dd", { children: [usage.reasoning, " tok"] })]
					}),
					otherOutput !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: TrajectoryTable_module_css_default.requestTokenDetail,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Content" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dd", { children: [otherOutput, " tok"] })]
					})
				]
			});
		}
		function RequestUsagePanel({ usage, cumulative }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: TrajectoryTable_module_css_default.usagePanel,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: TrajectoryTable_module_css_default.usageGroup,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
						className: TrajectoryTable_module_css_default.usageHeading,
						children: "This request"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageRows, { usage })]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: TrajectoryTable_module_css_default.usageGroup,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
						className: TrajectoryTable_module_css_default.usageHeading,
						children: "Session cumulative"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageRows, { usage: cumulative })]
				})]
			});
		}
		function RequestOptions({ options, preview = false }) {
			if (options === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: TrajectoryTable_module_css_default.noPayload,
				children: "Options not recorded"
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonTree, {
				data: options,
				label: "Request options JSON",
				className: preview ? TrajectoryTable_module_css_default.jsonPreview : TrajectoryTable_module_css_default.jsonPayload
			});
		}
		function messageOriginLabel(source) {
			if (typeof source !== "object" || source === null || Array.isArray(source)) return "Unknown";
			const properties = source;
			const kind = properties.kind;
			if (kind === "user") return "User";
			if (kind === "plugin") {
				const plugin = properties.plugin;
				return typeof plugin === "string" && plugin !== "" ? `Plugin · ${plugin}` : "Plugin";
			}
			if (kind === "goal") {
				const round = properties.round;
				return typeof round === "number" && round > 0 ? `Goal · Round ${round}` : "Goal";
			}
			if (typeof kind !== "string" || kind === "") return "Unknown";
			return `${kind[0]?.toUpperCase() ?? ""}${kind.slice(1)}`;
		}
		function MessageOrigin({ record }) {
			const source = record.cell.messageSource;
			if (source === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: TrajectoryTable_module_css_default.noPayload,
				children: "Origin not recorded"
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonTree, {
				data: typeof source === "object" && source !== null ? source : { value: source },
				label: "Message origin JSON",
				className: TrajectoryTable_module_css_default.jsonPayload
			});
		}
		function isMarkdownRecord(record) {
			return record.cell.kind === "user" || record.cell.kind === "context" || record.cell.kind === "message";
		}
		function parentRecords(records, record) {
			if (record.cell.kind !== "tool" && record.cell.kind !== "subtool") return {};
			const at = records.findIndex((candidate) => candidate.cell.index === record.cell.index);
			if (at === -1) return {};
			let tool;
			if (record.cell.kind === "subtool") for (let i = at - 1; i >= 0; i--) {
				const candidate = records[i];
				if (candidate === void 0 || candidate.turn !== record.turn || candidate.group !== record.group) break;
				if (candidate.cell.kind === "tool") {
					tool = candidate;
					break;
				}
			}
			const parentCallId = tool?.cell.callId ?? record.cell.callId;
			let message;
			if (parentCallId !== void 0) message = records.find((candidate) => candidate.turn === record.turn && candidate.cell.kind === "message" && candidate.cell.sourceBlocks?.some((block) => block.callId === parentCallId) === true);
			return {
				...message === void 0 ? {} : { message },
				...tool === void 0 ? {} : { tool }
			};
		}
		function markdownSource(record) {
			if (record.cell.kind === "user" || record.cell.kind === "context") return record.cell.inputDetail;
			if (record.cell.kind === "message" || record.cell.kind === "compacted") return record.cell.outputDetail;
		}
		function detailTabs(record) {
			if (record.cell.kind === "system") return record.cell.previousPromptDetail === void 0 ? SYSTEM_PROMPT_TABS : SYSTEM_UPDATE_TABS;
			if (record.cell.kind === "compacted") return [{
				id: "overview",
				label: "Summary"
			}, {
				id: "source",
				label: "Raw Output"
			}];
			if (isMarkdownRecord(record)) return [
				{
					id: "overview",
					label: "Summary"
				},
				{
					id: "rendered",
					label: "Preview"
				},
				{
					id: "source",
					label: "Source"
				},
				...record.cell.messageSource === void 0 ? [] : [{
					id: "origin",
					label: "Origin"
				}]
			];
			return [
				{
					id: "overview",
					label: "Summary"
				},
				...record.cell.inputDetail ? [{
					id: "input",
					label: "Payload"
				}] : [],
				...record.cell.outputDetail ? [{
					id: "output",
					label: "Result"
				}] : [],
				{
					id: "schema",
					label: "Schema"
				},
				{
					id: "timing",
					label: "Timing"
				}
			];
		}
		function recordDisplayText(cell) {
			if (isToolCallOnly(cell)) return "";
			if (cell.text !== "") return cell.text;
			const markdown = cell.kind === "user" || cell.kind === "context" ? cell.inputDetail : cell.kind === "message" ? cell.outputDetail ?? cell.thinkingDetail : void 0;
			return markdown === void 0 ? "" : trajectoryPreviewText(markdown);
		}
		function toolCallTextParts(kind, text) {
			if (kind !== "tool" && kind !== "subtool") return void 0;
			const separator = text.indexOf(" · ");
			if (separator === -1) return { name: text };
			return {
				name: text.slice(0, separator),
				args: text.slice(separator + 3)
			};
		}
		function isToolCallOnly(cell) {
			return cell.kind === "message" && !cell.outputDetail && !cell.thinkingDetail && cell.text === "Tool call only";
		}
		function MarkdownFragment({ text, rendered, preview }) {
			if (rendered) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: preview ? TrajectoryTable_module_css_default.markdownPreview : TrajectoryTable_module_css_default.markdownPayload,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, { text })
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
				className: `${TrajectoryTable_module_css_default.payload} ${preview ? TrajectoryTable_module_css_default.payloadPreview : ""}`,
				children: text
			});
		}
		function SourceBlocks({ blocks, onOpenCall }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: TrajectoryTable_module_css_default.sourceBlocks,
				children: blocks.map((block, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: TrajectoryTable_module_css_default.sourceBlock,
					children: [block.callId !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: TrajectoryTable_module_css_default.sourceBlockJumpTarget,
						"aria-label": `Open Block #${index + 1} tool call summary`,
						title: "Open tool call summary",
						onClick: () => {
							if (block.callId !== void 0) onOpenCall(block.callId);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: TrajectoryTable_module_css_default.sourceBlockLabel,
							children: `Block #${index + 1} ${block.type}`
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, {
							className: TrajectoryTable_module_css_default.sourceBlockJumpIcon,
							size: 12
						})]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: TrajectoryTable_module_css_default.sourceBlockHeader,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: TrajectoryTable_module_css_default.sourceBlockLabel,
							children: `Block #${index + 1} ${block.type}`
						})
					}), block.imageSrc !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PanelImage, { block }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						className: TrajectoryTable_module_css_default.sourceBlockContent,
						children: block.content
					})]
				}, index))
			});
		}
		function PanelImage({ block, preview = false }) {
			if (block.imageSrc === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
				className: preview ? `${TrajectoryTable_module_css_default.panelImageLink} ${TrajectoryTable_module_css_default.panelImageLinkPreview}` : TrajectoryTable_module_css_default.panelImageLink,
				href: block.imageSrc,
				target: "_blank",
				rel: "noopener noreferrer",
				title: "Open image",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
					className: TrajectoryTable_module_css_default.panelImage,
					src: block.imageSrc,
					alt: block.imageAlt ?? ""
				})
			});
		}
		function MessageImages({ blocks, preview }) {
			const images = blocks?.filter((block) => block.imageSrc !== void 0) ?? [];
			if (images.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: preview ? `${TrajectoryTable_module_css_default.messageImages} ${TrajectoryTable_module_css_default.messageImagesPreview}` : TrajectoryTable_module_css_default.messageImages,
				children: images.map((block, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PanelImage, {
					block,
					preview
				}, index))
			});
		}
		function AssistantToolCalls({ blocks, preview, onOpenCall }) {
			const calls = blocks?.filter((block) => block.type === "tool-call") ?? [];
			if (calls.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: preview ? `${TrajectoryTable_module_css_default.assistantToolCalls} ${TrajectoryTable_module_css_default.assistantToolCallsPreview}` : TrajectoryTable_module_css_default.assistantToolCalls,
				children: calls.map((call, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: TrajectoryTable_module_css_default.assistantToolCallButton,
					title: "Open tool call summary",
					onClick: () => {
						if (call.callId !== void 0) onOpenCall(call.callId);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						className: TrajectoryTable_module_css_default.assistantToolCallIcon,
						width: "12",
						height: "12",
						viewBox: "0 0 24 24",
						fill: "none",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z",
							stroke: "currentColor",
							strokeWidth: "1.8",
							strokeLinecap: "round",
							strokeLinejoin: "round"
						})
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: TrajectoryTable_module_css_default.assistantToolCallText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: TrajectoryTable_module_css_default.assistantToolCallName,
							children: call.toolName ?? "tool-call"
						}), call.content !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: TrajectoryTable_module_css_default.assistantToolCallArgs,
							children: call.content
						})]
					})]
				}) }, call.callId ?? index))
			});
		}
		function ToolGlyph() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: TrajectoryTable_module_css_default.toolCatalogIcon,
				width: "12",
				height: "12",
				viewBox: "0 0 24 24",
				fill: "none",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z",
					stroke: "currentColor",
					strokeWidth: "1.8",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		function ToolCatalog({ tools }) {
			if (tools.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: TrajectoryTable_module_css_default.noPayload,
				children: "No tools in this request"
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: TrajectoryTable_module_css_default.toolCatalog,
				children: tools.map((tool, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
					className: TrajectoryTable_module_css_default.toolCatalogItem,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
						className: TrajectoryTable_module_css_default.toolCatalogSummary,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, {
								className: TrajectoryTable_module_css_default.toolCatalogChevron,
								size: 12
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolGlyph, {}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: TrajectoryTable_module_css_default.toolCatalogName,
								children: tool.name
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: TrajectoryTable_module_css_default.toolCatalogDescription,
								children: tool.description
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: TrajectoryTable_module_css_default.toolCatalogDefinition,
						children: [tool.description !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: TrajectoryTable_module_css_default.toolCatalogFullDescription,
							children: tool.description
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonTree, {
							data: tool.parameters,
							label: `${tool.name} parameters JSON`,
							className: TrajectoryTable_module_css_default.toolCatalogTree
						})]
					})]
				}, `${tool.name}:${index}`))
			});
		}
		function promptDiffLines(before, after) {
			return structuredPatch("", "", before, after, void 0, void 0, { context: 3 }).hunks.flatMap((hunk, hunkIndex) => [
				...hunkIndex === 0 ? [] : [{
					kind: "meta",
					text: ""
				}],
				{
					kind: "meta",
					text: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`
				},
				...hunk.lines.flatMap((line) => {
					if (line.startsWith("\\")) return [];
					if (line.startsWith("+")) return [{
						kind: "added",
						text: line
					}];
					if (line.startsWith("-")) return [{
						kind: "removed",
						text: line
					}];
					return [{
						kind: "context",
						text: line
					}];
				})
			]);
		}
		function PromptDiffSection({ title, before, after }) {
			const lines = promptDiffLines(before, after);
			if (lines.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: TrajectoryTable_module_css_default.promptDiffSection,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
					className: TrajectoryTable_module_css_default.promptDiffTitle,
					children: title
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
					className: TrajectoryTable_module_css_default.promptDiff,
					children: lines.map((line, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: TrajectoryTable_module_css_default[`promptDiffLine${line.kind}`],
						children: [line.text || " ", "\n"]
					}, index))
				})]
			});
		}
		function SystemPromptDiff({ before, after }) {
			const toolsBefore = JSON.stringify(before.tools, null, 2);
			const toolsAfter = JSON.stringify(after.tools, null, 2);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: TrajectoryTable_module_css_default.promptDiffSections,
				children: [before.system !== after.system && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptDiffSection, {
					title: "System Prompt",
					before: before.system,
					after: after.system
				}), toolsBefore !== toolsAfter && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptDiffSection, {
					title: "Tools",
					before: toolsBefore,
					after: toolsAfter
				})]
			});
		}
		function ToolOutputBlocks({ blocks, error, preview }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: [
					TrajectoryTable_module_css_default.resultBlocks,
					preview ? TrajectoryTable_module_css_default.resultBlocksPreview : void 0,
					error ? TrajectoryTable_module_css_default.errorPayload : void 0
				].filter((value) => value !== void 0).join(" "),
				children: blocks.map((block, index) => block.imageSrc !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PanelImage, {
					block,
					preview
				}, index) : block.content !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
					className: TrajectoryTable_module_css_default.resultBlockText,
					children: block.content
				}, index) : null)
			});
		}
		function MarkdownRecordContent({ record, rendered, preview = false, thinkingExpanded, onThinkingExpandedChange, onOpenCall }) {
			if (!rendered && record.cell.sourceBlocks && record.cell.sourceBlocks.length > 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceBlocks, {
				blocks: record.cell.sourceBlocks,
				onOpenCall
			});
			if (record.cell.thinkingDetail) {
				if (!rendered) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarkdownFragment, {
					text: [record.cell.thinkingDetail, record.cell.outputDetail].filter((value) => value !== void 0 && value !== "").join("\n\n"),
					rendered: false,
					preview
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: `${TrajectoryTable_module_css_default.assistantContent} ${TrajectoryTable_module_css_default.assistantContentRendered}`,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: preview && !record.cell.outputDetail ? `${TrajectoryTable_module_css_default.thinkingQuote} ${TrajectoryTable_module_css_default.thinkingQuoteOnlyPreview}` : TrajectoryTable_module_css_default.thinkingQuote,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: TrajectoryTable_module_css_default.thinkingToggle,
								"aria-expanded": thinkingExpanded,
								onClick: () => {
									onThinkingExpandedChange(!thinkingExpanded);
								},
								children: ["Thinking", /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, {
									className: TrajectoryTable_module_css_default.thinkingChevron,
									size: 12
								})]
							}), thinkingExpanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarkdownFragment, {
								text: record.cell.thinkingDetail,
								rendered,
								preview
							})]
						}),
						record.cell.outputDetail && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: TrajectoryTable_module_css_default.assistantOutput,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarkdownFragment, {
								text: record.cell.outputDetail,
								rendered,
								preview
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssistantToolCalls, {
							blocks: record.cell.sourceBlocks,
							preview,
							onOpenCall
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MessageImages, {
							blocks: record.cell.sourceBlocks,
							preview
						})
					]
				});
			}
			const source = markdownSource(record);
			const hasImages = record.cell.sourceBlocks?.some((block) => block.imageSrc !== void 0) === true;
			const hasToolCalls = record.cell.kind === "message" && record.cell.sourceBlocks?.some((block) => block.type === "tool-call") === true;
			if (!source && !hasImages && !hasToolCalls) {
				const emptyLabel = isToolCallOnly(record.cell) ? "Tool call only" : record.cell.text || "No content";
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: TrajectoryTable_module_css_default.noPayload,
					children: emptyLabel
				});
			}
			if (!rendered || !hasImages && !hasToolCalls) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarkdownFragment, {
				text: source ?? "",
				rendered,
				preview
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				source && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarkdownFragment, {
					text: source,
					rendered: true,
					preview
				}),
				record.cell.kind === "message" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssistantToolCalls, {
					blocks: record.cell.sourceBlocks,
					preview,
					onOpenCall
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MessageImages, {
					blocks: record.cell.sourceBlocks,
					preview
				})
			] });
		}
		function RecordTiming({ record }) {
			return record.cell.kind === "message" && record.cell.assistantMetrics !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssistantTimingPanel, { metrics: record.cell.assistantMetrics }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
				className: TrajectoryTable_module_css_default.overview,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Started" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StartedAtValue, { timestamp: record.cell.startedAt ?? null })] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Duration" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: formatElapsedSeconds(record.cell.timeSeconds) })] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Timing source" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: record.cell.timeSeconds === null ? "Not available" : "Session timestamps" })] })
				]
			});
		}
		function RequestTiming({ assistant, anchor, request }) {
			if (assistant !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordTiming, { record: assistant });
			if (request?.startedAt !== void 0) {
				const duration = request.completedAt === null || request.completedAt === void 0 ? null : Math.max(0, (request.completedAt - request.startedAt) / 1e3);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
					className: TrajectoryTable_module_css_default.overview,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Started" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StartedAtValue, { timestamp: request.startedAt })] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Duration" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: formatElapsedSeconds(duration) })] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Timing source" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: duration === null ? "Session timestamps (running)" : "Session timestamps" })] })
					]
				});
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
				className: TrajectoryTable_module_css_default.overview,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Started" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StartedAtValue, { timestamp: anchor?.cell.startedAt ?? null })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Duration" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: formatElapsedSeconds(null) })] })]
			});
		}
		function RecordPayload({ record, direction, preview = false }) {
			const value = direction === "input" ? record.cell.inputDetail : record.cell.outputDetail;
			const missing = direction === "input" ? "No payload captured" : "No result captured";
			if (!value) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: TrajectoryTable_module_css_default.noPayload,
				children: missing
			});
			const error = direction === "output" && record.cell.isError === true;
			const payloadClass = preview ? TrajectoryTable_module_css_default.jsonPreview : TrajectoryTable_module_css_default.jsonPayload;
			const payloadClassName = error ? `${payloadClass} ${TrajectoryTable_module_css_default.errorPayload}` : payloadClass;
			const json = parseJsonContainer(value);
			if (direction === "output" && record.cell.outputBlocks?.length === 1 && record.cell.outputBlocks[0]?.type === "text" && json !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonTree, {
				data: json,
				label: "Result JSON",
				className: payloadClassName
			});
			if (direction === "output" && record.cell.outputBlocks?.some((block) => block.imageSrc !== void 0 || block.content !== "") === true) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolOutputBlocks, {
				blocks: record.cell.outputBlocks,
				error,
				preview
			});
			if (direction === "input" && (record.cell.kind === "user" || record.cell.kind === "context") || direction === "output" && record.cell.kind === "message") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: [preview ? TrajectoryTable_module_css_default.markdownPreview : TrajectoryTable_module_css_default.markdownPayload, error ? TrajectoryTable_module_css_default.errorPayload : void 0].filter((className) => className !== void 0).join(" "),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, { text: value })
			});
			if (json !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonTree, {
				data: json,
				label: `${direction === "input" ? "Payload" : "Result"} JSON`,
				className: payloadClassName
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
				className: [
					TrajectoryTable_module_css_default.payload,
					preview ? TrajectoryTable_module_css_default.payloadPreview : void 0,
					error ? TrajectoryTable_module_css_default.errorPayload : void 0,
					value === "No output" ? TrajectoryTable_module_css_default.noOutputText : void 0
				].filter((value) => value !== void 0).join(" "),
				children: value
			});
		}
		function RecordSchema({ record, preview = false }) {
			if (!record.cell.schemaDetail) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: TrajectoryTable_module_css_default.noPayload,
				children: "Schema unavailable"
			});
			const schema = parseToolSchema(record.cell.schemaDetail);
			if (schema !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: preview ? `${TrajectoryTable_module_css_default.schema} ${TrajectoryTable_module_css_default.schemaPreview}` : TrajectoryTable_module_css_default.schema,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
					className: TrajectoryTable_module_css_default.schemaIntro,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: TrajectoryTable_module_css_default.schemaName,
						children: schema.name
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: TrajectoryTable_module_css_default.schemaDescription,
						children: schema.description
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: TrajectoryTable_module_css_default.schemaParameters,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
						className: TrajectoryTable_module_css_default.schemaParametersTitle,
						children: "Parameters"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonTree, {
						data: schema.parameters,
						label: `${schema.name} parameters JSON`,
						className: TrajectoryTable_module_css_default.schemaTree
					})]
				})]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
				className: `${TrajectoryTable_module_css_default.payload} ${preview ? TrajectoryTable_module_css_default.payloadPreview : ""}`,
				children: record.cell.schemaDetail
			});
		}
		function parseToolSchema(value) {
			try {
				const parsed = JSON.parse(value);
				if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return void 0;
				const schema = parsed;
				if (typeof schema.name !== "string" || typeof schema.description !== "string" || typeof schema.parameters !== "object" || schema.parameters === null || Array.isArray(schema.parameters)) return void 0;
				return {
					name: schema.name,
					description: schema.description,
					parameters: schema.parameters
				};
			} catch {
				return;
			}
		}
		function parseJsonContainer(value) {
			try {
				const parsed = JSON.parse(value);
				return typeof parsed === "object" && parsed !== null ? parsed : void 0;
			} catch {
				return;
			}
		}
		function OverviewSection({ label, onOpen, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: TrajectoryTable_module_css_default.overviewSection,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
					className: TrajectoryTable_module_css_default.overviewHeading,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: TrajectoryTable_module_css_default.overviewTitle,
						onClick: onOpen,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, {
							className: TrajectoryTable_module_css_default.overviewTitleIcon,
							size: 12
						})]
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: `${TrajectoryTable_module_css_default.overviewPreview} ${TrajectoryTable_module_css_default.summaryScrollRegion}`,
					"data-summary-scroll-region": "",
					children
				})]
			});
		}
		/**
		* Render trajectory events as a dense ledger with turn and step separators.
		* Clicking ledger whitespace clears the active record or request selection.
		* @param props - Grouped trajectory data and whole-ledger fold state.
		* @returns The ledger and an optional local record inspector.
		*/
		function TrajectoryTable({ requestNumbers: sessionRequestNumbers, turns, streamingCells = [], timelineFocusIndexes = null, searchMatchIndexes = null, onSelectedIndexChange, onRecordSelect, recordSelection = null, recordFocus = null, historyLoading = false, historyStartSeq, hasOlderRecords = false, onLoadOlder, onClearSelection, collapsedTurns, onToggleTurn, collapsedAssistants, onToggleAssistant, inspectCallId = null, onInspectApplied }) {
			const [selectedRecordId, setSelectedRecordId] = (0, react.useState)(null);
			const [selectedRequest, setSelectedRequest] = (0, react.useState)(null);
			const [activeTab, setActiveTab] = (0, react.useState)("overview");
			const [thinkingExpanded, setThinkingExpanded] = (0, react.useState)(false);
			const [detailsWidth, setDetailsWidth] = (0, react.useState)(null);
			const [toolRequestOffset, setToolRequestOffset] = (0, react.useState)(null);
			const detailsResizeDrag = (0, react.useRef)(null);
			const appliedRecordSelection = (0, react.useRef)(null);
			const appliedRecordFocus = (0, react.useRef)(null);
			const tabHistory = (0, react.useRef)(new Set(["overview"]));
			const rootRef = (0, react.useRef)(null);
			const tablePaneRef = (0, react.useRef)(null);
			const followsTableTail = (0, react.useRef)(false);
			const tableScrollInitialized = (0, react.useRef)(false);
			const [tableScrollReady, setTableScrollReady] = (0, react.useState)(false);
			const pendingScrollRecordId = (0, react.useRef)(null);
			const loadingOlder = (0, react.useRef)(false);
			const [olderLoading, setOlderLoading] = (0, react.useState)(false);
			const olderLoadAnchor = (0, react.useRef)(null);
			const allRecords = (0, react.useMemo)(() => flattenRecords(turns), [turns]);
			const streamingCellsByIndex = (0, react.useMemo)(() => new Map(streamingCells.map((cell) => [cell.index, cell])), [streamingCells]);
			const currentRecord = (0, react.useCallback)((record) => {
				const cell = streamingCellsByIndex.get(record.cell.index);
				return cell === void 0 ? record : {
					...record,
					cell
				};
			}, [streamingCellsByIndex]);
			const selectedTemplate = (0, react.useMemo)(() => selectedRecordId === null ? void 0 : allRecords.find((record) => trajectoryRecordId(record.cell) === selectedRecordId), [allRecords, selectedRecordId]);
			const selected = selectedTemplate === void 0 ? void 0 : currentRecord(selectedTemplate);
			const selectedIndex = selected?.cell.index ?? null;
			(0, react.useEffect)(() => {
				onSelectedIndexChange?.(selectedIndex);
			}, [onSelectedIndexChange, selectedIndex]);
			const requestNumbers = (0, react.useMemo)(() => indexRequestNumbers(allRecords, sessionRequestNumbers), [allRecords, sessionRequestNumbers]);
			const records = (0, react.useMemo)(() => {
				if (searchMatchIndexes !== null) return filterRecords(allRecords, searchMatchIndexes);
				const turnRecords = collapsedTurns.size === 0 ? allRecords : collapseTurnRecords(allRecords, collapsedTurns);
				return collapsedAssistants.size === 0 ? turnRecords : collapseAssistantRecords(turnRecords, collapsedAssistants);
			}, [
				allRecords,
				collapsedAssistants,
				collapsedTurns,
				searchMatchIndexes
			]);
			const projectedVirtualRows = (0, react.useMemo)(() => groupTrajectoryVirtualRows(records), [records]);
			const virtualRowStructure = useStableVirtualRowStructure(projectedVirtualRows);
			const virtualizationEnabled = hasOlderRecords || records.length > VIRTUALIZATION_THRESHOLD;
			const estimateVirtualRowSize = (0, react.useCallback)((index) => virtualRowStructure[index]?.height ?? 30, [virtualRowStructure]);
			const getVirtualRowKey = (0, react.useCallback)((index) => virtualRowStructure[index]?.key ?? index, [virtualRowStructure]);
			const getTableScrollElement = (0, react.useCallback)(() => tablePaneRef.current, []);
			const rowVirtualizer = useVirtualizer({
				count: virtualizationEnabled ? virtualRowStructure.length : 0,
				enabled: virtualizationEnabled,
				estimateSize: estimateVirtualRowSize,
				getItemKey: getVirtualRowKey,
				getScrollElement: getTableScrollElement,
				initialRect: {
					width: 0,
					height: VIRTUAL_INITIAL_VIEWPORT_HEIGHT_PX
				},
				anchorTo: "end",
				overscan: VIRTUAL_OVERSCAN_ROWS,
				scrollEndThreshold: BOTTOM_FOLLOW_THRESHOLD_PX
			});
			const virtualIndexByRecordId = (0, react.useMemo)(() => {
				const indexes = /* @__PURE__ */ new Map();
				for (const [virtualIndex, row] of projectedVirtualRows.entries()) for (const entry of row.entries) if (entry.record.collapsedSummary === void 0) indexes.set(trajectoryRecordId(entry.record.cell), virtualIndex);
				return indexes;
			}, [projectedVirtualRows]);
			const virtualItems = virtualizationEnabled ? rowVirtualizer.getVirtualItems() : [];
			const virtualTop = virtualItems[0]?.start ?? 0;
			const virtualBottom = virtualItems.length === 0 ? 0 : Math.max(0, rowVirtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0));
			const renderedRecords = virtualizationEnabled ? virtualItems.flatMap((item) => {
				const row = projectedVirtualRows[item.index];
				if (row === void 0) return [];
				return row.entries.map((entry, entryIndex) => ({
					record: currentRecord(entry.record),
					position: entry.logicalIndex,
					terminalRequestBoundary: entry.record.cell.requestOnly === true && row.entries.at(-1)?.record.cell.requestOnly === true && entryIndex === row.entries.length - 1
				}));
			}) : records.map((record, position) => ({
				record: currentRecord(record),
				position,
				terminalRequestBoundary: record.cell.requestOnly === true && position === records.length - 1
			}));
			const requestBoundaryRuns = (0, react.useMemo)(() => indexRequestBoundaryRuns(records), [records]);
			const selectedPrompt = selected?.cell.kind === "system" ? selected.cell.promptDetail : void 0;
			const selectedPreviousPrompt = selected?.cell.kind === "system" ? selected.cell.previousPromptDetail : void 0;
			const promptSelected = selectedPrompt !== void 0;
			const selectedState = selected === void 0 ? void 0 : stateOf(selected);
			const selectedRequestRecords = (0, react.useMemo)(() => selectedRequest === null ? [] : allRecords.filter((record) => record.turn === selectedRequest.turn && record.group === selectedRequest.group), [allRecords, selectedRequest]).map(currentRecord);
			const selectedRequestAssistant = selectedRequestRecords.find((record) => record.cell.kind === "message");
			const selectedRequestAnchor = selectedRequestAssistant ?? selectedRequestRecords[0];
			const selectedRequestNumber = selectedRequest === null ? void 0 : requestNumbers.get(requestKey(selectedRequest.turn, selectedRequest.group));
			const selectedRequestInfo = selectedRequest === null ? void 0 : sessionRequestNumbers?.find((request) => selectedRequest.seq === void 0 ? request.turn === selectedRequest.turn && request.group === selectedRequest.group : request.seq === selectedRequest.seq);
			const selectedRequestState = selectedRequest === null ? void 0 : selectedRequestInfo?.status ?? (selectedRequestAssistant?.cell.assistantMetrics?.completedTime === null ? "running" : selectedRequestAssistant === void 0 && selectedRequestRecords.some((record) => stateOf(record) === "running") ? "running" : "complete");
			const selectedRequestToolCalls = selectedRequestRecords.filter((record) => record.cell.kind === "tool").length;
			const selectedRequestSubtoolCalls = selectedRequestRecords.filter((record) => record.cell.kind === "subtool").length;
			const selectedRequestResultTemplate = selectedRequestInfo?.resultSeq === void 0 ? selectedRequestAssistant : allRecords.find((record) => record.cell.sourceSeq === selectedRequestInfo.resultSeq);
			const selectedRequestResult = selectedRequestResultTemplate === void 0 ? void 0 : currentRecord(selectedRequestResultTemplate);
			const selectedRequestUsage = selectedRequestInfo?.usage ?? (selectedRequestAssistant === void 0 ? void 0 : {
				...selectedRequestAssistant.cell.input === void 0 ? {} : { input: selectedRequestAssistant.cell.input },
				...selectedRequestAssistant.cell.cacheRead === void 0 ? {} : { cacheRead: selectedRequestAssistant.cell.cacheRead },
				...selectedRequestAssistant.cell.cacheWrite === void 0 ? {} : { cacheWrite: selectedRequestAssistant.cell.cacheWrite },
				...selectedRequestAssistant.cell.output === void 0 ? {} : { output: selectedRequestAssistant.cell.output },
				...selectedRequestAssistant.cell.think === void 0 ? {} : { reasoning: selectedRequestAssistant.cell.think }
			});
			const selectedRequestCumulativeUsage = selectedRequestInfo?.cumulativeUsage ?? selectedRequestUsage;
			const selectedRequestOptions = selectedRequestInfo?.requestConfig;
			const activeTurn = selectedRequest === null ? selected?.turn : selectedRequest.turn;
			const activeSection = selectedRequest === null ? selected?.section : selectedRequestRecords[0]?.section;
			const selectedTabs = selectedRequest !== null ? REQUEST_TABS.filter((tab) => tab.id !== "options" || selectedRequestOptions !== void 0) : selected === void 0 ? [] : detailTabs(selected);
			const selectedParents = selected === void 0 ? {} : parentRecords(allRecords, selected);
			const selectedParentMessage = selectedParents.message;
			const selectedParentTool = selectedParents.tool;
			const selectedAssistantRequest = selected?.cell.kind === "message" ? requestNumbers.get(requestKey(selected.turn, selected.group)) : void 0;
			const selectedAssistantRequestInfo = selectedAssistantRequest === void 0 ? void 0 : sessionRequestNumbers?.find((request) => request.number === selectedAssistantRequest);
			const selectedAssistantRequestTarget = selected !== void 0 && selectedAssistantRequest !== void 0 ? {
				turn: selected.turn,
				group: selected.group,
				...selectedAssistantRequestInfo?.seq === void 0 ? {} : { seq: selectedAssistantRequestInfo.seq }
			} : void 0;
			const hasSelectedHierarchy = selectedAssistantRequestTarget !== void 0 || selectedParents.message !== void 0 || selectedParents.tool !== void 0;
			const splitStyle = toolRequestOffset === null ? void 0 : { "--trajectory-tool-request-width": `calc(58cqw - ${toolRequestOffset}px)` };
			const activateTab = (tab) => {
				tabHistory.current.delete(tab);
				tabHistory.current.add(tab);
				setActiveTab(tab);
			};
			const clearInspectorSelection = () => {
				setSelectedRecordId(null);
				setSelectedRequest(null);
			};
			const clearAllSelections = () => {
				clearInspectorSelection();
				onClearSelection?.();
			};
			const selectRecord = (0, react.useCallback)((index) => {
				const record = allRecords.find((candidate) => candidate.cell.index === index);
				onRecordSelect?.(index);
				setSelectedRequest(null);
				setSelectedRecordId(record === void 0 ? null : trajectoryRecordId(record.cell));
				if (record === void 0) return;
				const tabs = detailTabs(record);
				const available = new Set(tabs.map((tab) => tab.id));
				setActiveTab([...tabHistory.current].reverse().find((tab) => available.has(tab)) ?? tabs[0]?.id ?? "overview");
			}, [allRecords, onRecordSelect]);
			(0, react.useEffect)(() => {
				if (recordSelection === null || appliedRecordSelection.current === recordSelection) return;
				appliedRecordSelection.current = recordSelection;
				selectRecord(recordSelection.index);
				const record = allRecords.find((candidate) => candidate.cell.index === recordSelection.index);
				pendingScrollRecordId.current = record === void 0 ? null : trajectoryRecordId(record.cell);
			}, [
				allRecords,
				recordSelection,
				selectRecord
			]);
			(0, react.useEffect)(() => {
				if (recordFocus === null || appliedRecordFocus.current === recordFocus) return;
				appliedRecordFocus.current = recordFocus;
				const record = allRecords.find((candidate) => candidate.cell.index === recordFocus.index);
				pendingScrollRecordId.current = record === void 0 ? null : trajectoryRecordId(record.cell);
			}, [allRecords, recordFocus]);
			const selectRequest = (request, tab = "overview") => {
				setSelectedRecordId(null);
				setSelectedRequest(request);
				activateTab(tab);
			};
			const openRecordSummary = (target) => {
				const targetAt = allRecords.findIndex((record) => record.cell.index === target.cell.index);
				if (target.turn !== null && collapsedTurns.has(target.turn)) onToggleTurn(target.turn);
				if (target.cell.kind === "tool" || target.cell.kind === "subtool") for (let i = targetAt - 1; i >= 0; i--) {
					const candidate = allRecords[i];
					if (candidate === void 0 || candidate.turn !== target.turn) break;
					if (candidate.cell.kind !== "message") continue;
					const assistantId = trajectoryRecordId(candidate.cell);
					if (collapsedAssistants.has(assistantId)) onToggleAssistant(assistantId);
					break;
				}
				setSelectedRequest(null);
				setSelectedRecordId(trajectoryRecordId(target.cell));
				activateTab("overview");
			};
			const openCallSummary = (callId) => {
				const target = allRecords.find((record) => record.cell.callId === callId);
				if (target !== void 0) openRecordSummary(target);
			};
			const openRecordSummaryRef = (0, react.useRef)(openRecordSummary);
			openRecordSummaryRef.current = openRecordSummary;
			(0, react.useEffect)(() => {
				if (inspectCallId === null) return;
				const target = flattenRecords(turns).find((record) => record.cell.callId === inspectCallId);
				if (target === void 0) return;
				openRecordSummaryRef.current(target);
				pendingScrollRecordId.current = trajectoryRecordId(target.cell);
				onInspectApplied?.();
			}, [
				inspectCallId,
				turns,
				onInspectApplied
			]);
			(0, react.useEffect)(() => {
				const id = pendingScrollRecordId.current;
				if (id === null) return;
				const position = records.findIndex((record) => trajectoryRecordId(record.cell) === id && record.collapsedSummary === void 0);
				if (position === -1) return;
				if (virtualizationEnabled) {
					const virtualIndex = virtualIndexByRecordId.get(id);
					if (virtualIndex === void 0) return;
					pendingScrollRecordId.current = null;
					followsTableTail.current = false;
					rowVirtualizer.scrollToIndex(virtualIndex, {
						behavior: "smooth",
						align: "center"
					});
					return;
				}
				pendingScrollRecordId.current = null;
				followsTableTail.current = false;
				const recordIndex = records[position]?.cell.index;
				const row = recordIndex === void 0 ? null : rootRef.current?.querySelector(`tr[data-record-index="${recordIndex}"]`);
				/* v8 ignore next -- jsdom lacks scrollIntoView; browsers always have it. */
				if (row !== void 0 && row !== null && typeof row.scrollIntoView === "function") row.scrollIntoView({
					behavior: "smooth",
					block: "center"
				});
			}, [
				records,
				rowVirtualizer,
				virtualIndexByRecordId,
				virtualizationEnabled
			]);
			(0, react.useEffect)(() => {
				if (timelineFocusIndexes === null || timelineFocusIndexes.size === 0) return;
				const focusedPositions = records.flatMap((record, position) => record.collapsedSummary === void 0 && record.cell.requestOnly !== true && timelineFocusIndexes.has(record.cell.index) ? [position] : []);
				const first = focusedPositions.at(0);
				const last = focusedPositions.at(-1);
				if (first === void 0 || last === void 0) return;
				if (!virtualizationEnabled) {
					const ledger = rootRef.current;
					if (ledger === null) return;
					const focusedRows = [...ledger.querySelectorAll("tr[data-timeline-focus=\"inside\"]")];
					const firstRow = focusedRows.at(0);
					const lastRow = focusedRows.at(-1);
					if (firstRow === void 0 || lastRow === void 0) return;
					const focusHeight = lastRow.getBoundingClientRect().bottom - firstRow.getBoundingClientRect().top;
					const target = focusHeight > ledger.clientHeight ? firstRow : focusedRows[Math.floor((focusedRows.length - 1) / 2)];
					/* v8 ignore next -- jsdom lacks scrollIntoView; browsers always have it. */
					if (target !== void 0 && typeof target.scrollIntoView === "function") {
						followsTableTail.current = false;
						target.scrollIntoView({
							behavior: "smooth",
							block: focusHeight > ledger.clientHeight ? "start" : "center"
						});
					}
					return;
				}
				const focusedVirtualIndexes = [...new Set(focusedPositions.flatMap((position) => {
					const record = records[position];
					if (record === void 0) return [];
					const virtualIndex = virtualIndexByRecordId.get(trajectoryRecordId(record.cell));
					return virtualIndex === void 0 ? [] : [virtualIndex];
				}))].sort((left, right) => left - right);
				const firstVirtual = focusedVirtualIndexes.at(0);
				const lastVirtual = focusedVirtualIndexes.at(-1);
				if (firstVirtual === void 0 || lastVirtual === void 0) return;
				const paneHeight = tablePaneRef.current?.clientHeight ?? 0;
				const focusHeight = projectedVirtualRows.slice(firstVirtual, lastVirtual + 1).reduce((height, row) => height + row.height, 0);
				followsTableTail.current = false;
				rowVirtualizer.scrollToIndex(focusHeight > paneHeight ? firstVirtual : focusedVirtualIndexes[Math.floor((focusedVirtualIndexes.length - 1) / 2)] ?? firstVirtual, {
					behavior: "smooth",
					align: focusHeight > paneHeight ? "start" : "center"
				});
			}, [
				projectedVirtualRows,
				records,
				rowVirtualizer,
				timelineFocusIndexes,
				virtualIndexByRecordId,
				virtualizationEnabled
			]);
			const requestOlder = (0, react.useCallback)((pane) => {
				if (!hasOlderRecords || onLoadOlder === void 0 || loadingOlder.current || pane.scrollTop > OLDER_LOAD_THRESHOLD_PX) return;
				loadingOlder.current = true;
				setOlderLoading(true);
				olderLoadAnchor.current = {
					historyStartSeq,
					scrollHeight: pane.scrollHeight,
					scrollTop: pane.scrollTop
				};
				onLoadOlder().then((advanced) => {
					if (!advanced) olderLoadAnchor.current = null;
				}).finally(() => {
					loadingOlder.current = false;
					setOlderLoading(false);
				});
			}, [
				hasOlderRecords,
				historyStartSeq,
				onLoadOlder
			]);
			(0, react.useLayoutEffect)(() => {
				const pane = tablePaneRef.current;
				if (pane === null) return;
				const anchor = olderLoadAnchor.current;
				if (anchor !== null && anchor.historyStartSeq !== historyStartSeq) {
					if (!virtualizationEnabled) pane.scrollTop = anchor.scrollTop + pane.scrollHeight - anchor.scrollHeight;
					olderLoadAnchor.current = null;
					followsTableTail.current = false;
					return;
				}
				if (!tableScrollInitialized.current) {
					if (historyLoading) return;
					tableScrollInitialized.current = true;
					followsTableTail.current = true;
					if (virtualizationEnabled) rowVirtualizer.scrollToEnd({ behavior: "auto" });
					else pane.scrollTop = pane.scrollHeight;
					setTableScrollReady(true);
					return;
				}
				if (!followsTableTail.current) return;
				if (virtualizationEnabled) rowVirtualizer.scrollToEnd({ behavior: "auto" });
				else pane.scrollTop = pane.scrollHeight;
			}, [
				historyLoading,
				historyStartSeq,
				rowVirtualizer,
				virtualRowStructure,
				virtualizationEnabled
			]);
			const loadingLabel = olderLoading ? "Loading earlier history…" : "Loading trajectory…";
			const showLoading = historyLoading || olderLoading || !tableScrollReady;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: TrajectoryTable_module_css_default.split,
				style: splitStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: tablePaneRef,
					className: TrajectoryTable_module_css_default.tablePane,
					"data-trajectory-scroll": "",
					onScroll: (event) => {
						const pane = event.currentTarget;
						followsTableTail.current = pane.scrollHeight - pane.clientHeight - pane.scrollTop <= BOTTOM_FOLLOW_THRESHOLD_PX;
						requestOlder(pane);
					},
					onClick: (event) => {
						if (event.target === event.currentTarget) clearAllSelections();
					},
					children: [showLoading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: TrajectoryTable_module_css_default.historyLoading,
						role: "status",
						"aria-live": "polite",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: TrajectoryTable_module_css_default.historyLoadingBar,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: TrajectoryTable_module_css_default.historyLoadingSpinner,
								"aria-hidden": "true"
							}), loadingLabel]
						})
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
						className: TrajectoryTable_module_css_default.table,
						"data-scroll-ready": tableScrollReady || void 0,
						"aria-rowcount": records.length,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("colgroup", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("col", { className: TrajectoryTable_module_css_default.eventColumn }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("col", { className: TrajectoryTable_module_css_default.contentColumn })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tbody", { children: [
							virtualTop > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", {
								className: TrajectoryTable_module_css_default.virtualSpacer,
								"data-virtual-spacer": "top",
								"aria-hidden": "true",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
									colSpan: 2,
									style: { "--trajectory-virtual-spacer-height": `${virtualTop}px` }
								})
							}),
							renderedRecords.map(({ record, position, terminalRequestBoundary }) => {
								const displayText = recordDisplayText(record.cell);
								const toolCallOnly = isToolCallOnly(record.cell);
								const toolCallText = toolCallTextParts(record.cell.kind, displayText);
								const listDisplayText = toolCallOnly ? "(tool call only)" : toolCallText === void 0 ? displayText : [toolCallText.name, toolCallText.args].filter(Boolean).join(" ");
								const isCollapsedSummary = record.collapsedSummary !== void 0;
								const isRequestOnly = record.cell.requestOnly === true;
								const isInitialSystem = record.cell.kind === "system" && record.cell.index === allRecords[0]?.cell.index;
								const request = record.groupStart && !isCollapsedSummary && (record.turn === null || !collapsedTurns.has(record.turn)) ? requestNumbers.get(requestKey(record.turn, record.group)) : void 0;
								const requestInfo = request === void 0 ? void 0 : sessionRequestNumbers?.find((candidate) => candidate.number === request);
								const requestStatus = requestInfo?.status ?? (record.cell.isError === true ? "error" : void 0);
								const requestRunIndex = requestBoundaryRuns.get(record.cell.index) ?? 0;
								const requestBoundaryStyle = { "--request-boundary-offset": `${requestRunIndex * 8}px` };
								const requestLabel = request === void 0 ? void 0 : `Request #${request}${requestInfo?.purpose === "compaction" ? " · Compaction" : ""}`;
								const requestSelected = request !== void 0 && selectedRequest?.turn === record.turn && selectedRequest.group === record.group;
								const sectionActive = record.turn === null ? activeSection === record.section : activeTurn === record.turn;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
									tabIndex: isRequestOnly ? -1 : 0,
									"aria-rowindex": position + 1,
									"aria-label": isCollapsedSummary ? `Collapsed ${record.collapsedSummaryKind} summary, ${record.collapsedSummary}` : isRequestOnly ? `Request ${request ?? ""}, compaction` : `${request === void 0 ? "" : `Request ${request}, `}${KIND_LABEL[record.cell.kind]}, ${listDisplayText || "no content"}`,
									"aria-selected": !isCollapsedSummary && !isRequestOnly && selectedIndex === record.cell.index,
									"data-kind": record.cell.kind,
									"data-trajectory-row-key": trajectoryVirtualRecordKey(record),
									"data-virtual-position": virtualizationEnabled ? position : void 0,
									"data-record-index": !isCollapsedSummary && !isRequestOnly ? record.cell.index : void 0,
									"data-request-only": isRequestOnly || void 0,
									"data-terminal-request-boundary": terminalRequestBoundary || void 0,
									"data-group-start": record.groupStart || void 0,
									"data-turn-start": record.turnStart || void 0,
									"data-error": record.cell.isError || void 0,
									"data-running": stateOf(record) === "running" || void 0,
									"data-turn-end": record.turnEnd || void 0,
									"data-collapsed-summary": record.collapsedSummaryKind,
									"data-selected": !isCollapsedSummary && selectedIndex === record.cell.index || void 0,
									"data-timeline-focus": isCollapsedSummary || timelineFocusIndexes === null ? void 0 : timelineFocusIndexes.has(record.cell.index) ? "inside" : "outside",
									onClick: isRequestOnly ? void 0 : isCollapsedSummary ? () => {
										if (record.collapsedSummaryKind === "turn" && record.turn !== null) onToggleTurn(record.turn);
										else onToggleAssistant(trajectoryRecordId(record.cell));
									} : () => {
										selectRecord(record.cell.index);
									},
									onDoubleClick: (event) => {
										if (isCollapsedSummary || isRequestOnly) return;
										if (record.turn !== null && collapsedTurns.has(record.turn)) {
											event.preventDefault();
											onToggleTurn(record.turn);
											return;
										}
										if (record.cell.kind === "message" && assistantToolCalls(allRecords, record.cell.index).length > 0) {
											event.preventDefault();
											onToggleAssistant(trajectoryRecordId(record.cell));
											return;
										}
										if (!record.turnStart) return;
										if (record.turn === null) return;
										if (allRecords.filter((candidate) => candidate.turn === record.turn && candidate.cell.requestOnly !== true && candidate.cell.kind !== "system").length <= 1) return;
										event.preventDefault();
										onToggleTurn(record.turn);
									},
									onKeyDown: (event) => {
										if (isRequestOnly) return;
										if (event.key !== "Enter" && event.key !== " ") return;
										event.preventDefault();
										if (isCollapsedSummary) {
											if (record.collapsedSummaryKind === "turn" && record.turn !== null) onToggleTurn(record.turn);
											else onToggleAssistant(trajectoryRecordId(record.cell));
											return;
										}
										selectRecord(record.cell.index);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", {
										className: TrajectoryTable_module_css_default.event,
										children: [
											request !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: requestSelected ? `${TrajectoryTable_module_css_default.requestBoundaryControl} ${TrajectoryTable_module_css_default.requestBoundaryControlActive}` : TrajectoryTable_module_css_default.requestBoundaryControl,
												"aria-label": requestLabel,
												"aria-pressed": requestSelected,
												"data-label": requestLabel,
												"data-request-run-index": requestRunIndex,
												"data-request-status": requestStatus,
												style: requestBoundaryStyle,
												onClick: (event) => {
													event.stopPropagation();
													selectRequest({
														turn: record.turn,
														group: record.group,
														...requestInfo?.seq === void 0 ? {} : { seq: requestInfo.seq }
													});
												},
												onDoubleClick: (event) => {
													event.stopPropagation();
												}
											}),
											record.turn !== null && activeTurn === record.turn && !isInitialSystem && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: TrajectoryTable_module_css_default.turnRail,
												"aria-hidden": "true"
											}),
											!isCollapsedSummary && selectedIndex === record.cell.index && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: TrajectoryTable_module_css_default.selectionRail,
												"aria-hidden": "true"
											}),
											!isCollapsedSummary && !isRequestOnly && record.turnStart && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: sectionActive ? `${TrajectoryTable_module_css_default.turnLabel} ${TrajectoryTable_module_css_default.turnLabelActive}` : TrajectoryTable_module_css_default.turnLabel,
												"aria-label": sectionLabel(record.turn),
												children: record.turn === null ? sectionLabel(record.turn) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: TrajectoryTable_module_css_default.turnLabelFull,
													"aria-hidden": "true",
													children: sectionLabel(record.turn)
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: TrajectoryTable_module_css_default.turnLabelCompact,
													"aria-hidden": "true",
													children: ["#", record.turn]
												})] })
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: TrajectoryTable_module_css_default.eventInner,
												children: !isCollapsedSummary && !isRequestOnly && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: TrajectoryTable_module_css_default.kindSlot,
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: `${TrajectoryTable_module_css_default.kindTag} ${record.cell.kind === "system" ? TrajectoryTable_module_css_default.systemNeutral : record.cell.kind === "context" ? TrajectoryTable_module_css_default.contextGreen : record.cell.kind === "compacted" ? TrajectoryTable_module_css_default.compacted : record.cell.kind === "tool" ? TrajectoryTable_module_css_default.toolAmber : record.cell.kind === "message" ? TrajectoryTable_module_css_default.assistantVioletBright : record.cell.kind === "subtool" ? TrajectoryTable_module_css_default.subtoolAmber : TrajectoryTable_module_css_default[record.cell.kind]}`,
														"data-role-kind": record.cell.kind,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
															label: KIND_LABEL[record.cell.kind],
															side: "right",
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: TrajectoryTable_module_css_default.kindTagIcon,
																"aria-hidden": "true",
																children: KIND_ICON[record.cell.kind]
															})
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: TrajectoryTable_module_css_default.kindTagLabel,
															children: KIND_LABEL[record.cell.kind]
														})]
													})
												})
											})
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: TrajectoryTable_module_css_default.content,
										children: isRequestOnly ? null : record.collapsedSummary !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: TrajectoryTable_module_css_default.collapsedTurnContent,
											title: record.collapsedSummary,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: TrajectoryTable_module_css_default.collapsedTurnEllipsis,
												children: "…"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: TrajectoryTable_module_css_default.collapsedTurnText,
												children: record.collapsedSummary
											})]
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: record.cell.result === void 0 ? TrajectoryTable_module_css_default.contentText : TrajectoryTable_module_css_default.resultPreview,
											title: record.cell.result === void 0 ? listDisplayText : `${listDisplayText} → ${record.cell.result}`,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: record.cell.result === void 0 ? void 0 : TrajectoryTable_module_css_default.resultRequest,
												children: toolCallOnly ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: TrajectoryTable_module_css_default.toolCallOnly,
													children: "(tool call only)"
												}) : toolCallText === void 0 ? listDisplayText || "—" : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: TrajectoryTable_module_css_default.toolCallNameTypeface,
													children: toolCallText.name || "—"
												}), toolCallText.args !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: TrajectoryTable_module_css_default.toolCallPayload,
													children: toolCallText.args
												})] })
											}), record.cell.result !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: record.cell.isError ? `${TrajectoryTable_module_css_default.inlineResult} ${TrajectoryTable_module_css_default.error}` : TrajectoryTable_module_css_default.inlineResult,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: TrajectoryTable_module_css_default.arrow,
													children: "→"
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: record.cell.result === "No output" ? `${TrajectoryTable_module_css_default.inlineResultText} ${TrajectoryTable_module_css_default.noOutputText}` : TrajectoryTable_module_css_default.inlineResultText,
													children: record.cell.result
												})]
											})]
										})
									})]
								}, trajectoryVirtualRecordKey(record));
							}),
							virtualBottom > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", {
								className: TrajectoryTable_module_css_default.virtualSpacer,
								"data-virtual-spacer": "bottom",
								"aria-hidden": "true",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
									colSpan: 2,
									style: { "--trajectory-virtual-spacer-height": `${virtualBottom}px` }
								})
							})
						] })]
					})]
				}), (selectedRequest !== null || promptSelected || selected !== void 0 && selectedState !== void 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
					className: TrajectoryTable_module_css_default.details,
					"aria-label": "Event details",
					style: detailsWidth === null ? void 0 : { width: detailsWidth },
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: TrajectoryTable_module_css_default.detailsResizeHandle,
							role: "separator",
							"aria-label": "Resize event details",
							"aria-controls": "trajectory-detail-panel",
							"aria-orientation": "vertical",
							tabIndex: 0,
							title: "Drag to resize. Double-click to reset.",
							onDoubleClick: () => {
								setDetailsWidth(null);
								setToolRequestOffset(null);
							},
							onPointerDown: (event) => {
								if (event.button !== 0) return;
								const details = event.currentTarget.parentElement;
								if (details === null) return;
								const split = details.parentElement;
								if (split === null) return;
								const splitWidth = split.getBoundingClientRect().width;
								detailsResizeDrag.current = {
									pointerId: event.pointerId,
									startX: event.clientX,
									startWidth: details.getBoundingClientRect().width,
									splitWidth,
									startToolRequestOffset: toolRequestOffset ?? splitWidth * TOOL_REQUEST_SHARE - defaultToolRequestWidth(splitWidth)
								};
								event.currentTarget.setPointerCapture(event.pointerId);
								event.preventDefault();
							},
							onPointerMove: (event) => {
								const drag = detailsResizeDrag.current;
								if (drag === null || drag.pointerId !== event.pointerId) return;
								const nextDetailsWidth = clampDetailsWidth(drag.startWidth + drag.startX - event.clientX, drag.splitWidth);
								setDetailsWidth(nextDetailsWidth);
								setToolRequestOffset(drag.startToolRequestOffset + (nextDetailsWidth - drag.startWidth) * TOOL_REQUEST_SHARE);
							},
							onPointerUp: (event) => {
								if (detailsResizeDrag.current?.pointerId !== event.pointerId) return;
								detailsResizeDrag.current = null;
								event.currentTarget.releasePointerCapture(event.pointerId);
							},
							onPointerCancel: () => {
								detailsResizeDrag.current = null;
							},
							onKeyDown: (event) => {
								if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
								const details = event.currentTarget.parentElement;
								if (details === null) return;
								const split = details.parentElement;
								if (split === null) return;
								const direction = event.key === "ArrowLeft" ? 1 : -1;
								const currentDetailsWidth = details.getBoundingClientRect().width;
								const splitWidth = split.getBoundingClientRect().width;
								const nextDetailsWidth = clampDetailsWidth(currentDetailsWidth + direction * DETAILS_RESIZE_STEP, splitWidth);
								const currentToolRequestOffset = toolRequestOffset ?? splitWidth * TOOL_REQUEST_SHARE - defaultToolRequestWidth(splitWidth);
								setDetailsWidth(nextDetailsWidth);
								setToolRequestOffset(currentToolRequestOffset + (nextDetailsWidth - currentDetailsWidth) * TOOL_REQUEST_SHARE);
								event.preventDefault();
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: TrajectoryTable_module_css_default.detailsHeader,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: TrajectoryTable_module_css_default.detailsTitle,
								children: selectedRequest !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: TrajectoryTable_module_css_default.requestDetailsDot,
										"aria-hidden": "true"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: TrajectoryTable_module_css_default.requestDetailsName,
										children: ["Request #", selectedRequestNumber ?? "—"]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: TrajectoryTable_module_css_default.detailsLocation,
										children: selectedRequestInfo?.purpose === "compaction" ? `Compaction · ${sectionLabel(selectedRequest.turn)}` : sectionLabel(selectedRequest.turn)
									})
								] }) : promptSelected ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: `${TrajectoryTable_module_css_default.kindTag} ${TrajectoryTable_module_css_default.systemNeutral}`,
									children: "SYSTEM"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: TrajectoryTable_module_css_default.detailsLocation,
									children: selected?.cell.text
								})] }) : selected !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: `${TrajectoryTable_module_css_default.kindTag} ${selected.cell.kind === "context" ? TrajectoryTable_module_css_default.contextGreen : selected.cell.kind === "compacted" ? TrajectoryTable_module_css_default.compacted : selected.cell.kind === "tool" ? TrajectoryTable_module_css_default.toolAmber : selected.cell.kind === "message" ? TrajectoryTable_module_css_default.assistantVioletBright : selected.cell.kind === "subtool" ? TrajectoryTable_module_css_default.subtoolAmber : TrajectoryTable_module_css_default[selected.cell.kind]}`,
									children: KIND_LABEL[selected.cell.kind]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: TrajectoryTable_module_css_default.detailsLocation,
									children: selected.cell.kind === "compacted" ? sectionLabel(selected.turn) : `${sectionLabel(selected.turn)} · ${selected.group}`
								})] })
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: TrajectoryTable_module_css_default.close,
								"aria-label": "Close details",
								onClick: clearInspectorSelection,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									"aria-hidden": "true",
									children: "×"
								})
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: TrajectoryTable_module_css_default.detailTabs,
							role: "tablist",
							"aria-label": "Event details",
							children: selectedTabs.map((tab) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								id: `trajectory-detail-${tab.id}`,
								type: "button",
								role: "tab",
								"aria-controls": "trajectory-detail-panel",
								"aria-selected": activeTab === tab.id,
								className: activeTab === tab.id ? `${TrajectoryTable_module_css_default.detailTab} ${TrajectoryTable_module_css_default.detailTabActive}` : TrajectoryTable_module_css_default.detailTab,
								onClick: () => {
									activateTab(tab.id);
								},
								children: tab.label
							}, tab.id))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							id: "trajectory-detail-panel",
							className: activeTab === "overview" ? `${TrajectoryTable_module_css_default.detailBody} ${TrajectoryTable_module_css_default.detailBodySummary}` : TrajectoryTable_module_css_default.detailBody,
							role: "tabpanel",
							"aria-labelledby": `trajectory-detail-${activeTab}`,
							children: [
								selectedRequest !== null && selectedRequestState !== void 0 && activeTab === "overview" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
									className: `${TrajectoryTable_module_css_default.overview} ${TrajectoryTable_module_css_default.summaryScrollRegion}`,
									"data-summary-scroll-region": "",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Status" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
											className: selectedRequestState === "error" ? TrajectoryTable_module_css_default.error : void 0,
											children: statusLabel(selectedRequestState)
										})] }),
										selectedRequestInfo?.purpose === "compaction" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Purpose" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: "Compaction" })] }),
										(selectedRequestInfo?.provider ?? selectedRequestInfo?.requestConfig?.provider) !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Provider" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: selectedRequestInfo?.provider ?? selectedRequestInfo?.requestConfig?.provider })] }),
										(selectedRequestInfo?.model ?? selectedRequestInfo?.requestConfig?.model) !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Model" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: selectedRequestInfo?.model ?? selectedRequestInfo?.requestConfig?.model })] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Tool calls" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: selectedRequestToolCalls })] }),
										selectedRequestSubtoolCalls > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Subtool calls" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: selectedRequestSubtoolCalls })] }),
										selectedRequestInfo?.error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Error" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
											className: TrajectoryTable_module_css_default.error,
											children: selectedRequestInfo.error
										})] }),
										selectedRequestInfo?.retry !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Retry" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dd", { children: [
											"Scheduled ",
											selectedRequestInfo.retry,
											selectedRequestInfo.maxRetries === void 0 ? "" : ` of ${selectedRequestInfo.maxRetries}`
										] })] }),
										selectedRequestInfo?.retryDelayMs !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Retry delay" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: formatDurationMs(selectedRequestInfo.retryDelayMs) })] }),
										selectedRequestResult !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Result" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
											className: TrajectoryTable_module_css_default.overviewParentLinks,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: TrajectoryTable_module_css_default.overviewHierarchyNavLink,
												onClick: () => {
													openRecordSummary(selectedRequestResult);
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: selectedRequestInfo?.purpose === "compaction" ? "Compacted" : "Assistant Message" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, {
													className: TrajectoryTable_module_css_default.overviewHierarchyJumpIconTight,
													size: 11
												})]
											})
										})] })
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: TrajectoryTable_module_css_default.overviewSections,
									children: [
										selectedRequestOptions !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OverviewSection, {
											label: "Options",
											onOpen: () => {
												activateTab("options");
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RequestOptions, {
												options: selectedRequestOptions,
												preview: true
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(OverviewSection, {
											label: "Usage",
											onOpen: () => {
												activateTab("usage");
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageRows, { usage: selectedRequestUsage })
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(OverviewSection, {
											label: "Timing",
											onOpen: () => {
												activateTab("timing");
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RequestTiming, {
												assistant: selectedRequestAssistant,
												anchor: selectedRequestAnchor,
												request: selectedRequestInfo
											})
										})
									]
								})] }),
								selectedRequest !== null && activeTab === "options" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RequestOptions, { options: selectedRequestOptions }),
								selectedRequest !== null && activeTab === "usage" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RequestUsagePanel, {
									usage: selectedRequestUsage,
									cumulative: selectedRequestCumulativeUsage
								}),
								selectedRequest !== null && activeTab === "timing" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RequestTiming, {
									assistant: selectedRequestAssistant,
									anchor: selectedRequestAnchor,
									request: selectedRequestInfo
								}),
								promptSelected && selectedPreviousPrompt !== void 0 && activeTab === "diff" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SystemPromptDiff, {
									before: selectedPreviousPrompt,
									after: selectedPrompt
								}),
								promptSelected && activeTab === "system-prompt" && (selectedPrompt.system === "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: TrajectoryTable_module_css_default.noPayload,
									children: "No system prompt in this request"
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: `${TrajectoryTable_module_css_default.markdownPayload} ${TrajectoryTable_module_css_default.systemPrompt}`,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, { text: selectedPrompt.system })
								})),
								promptSelected && activeTab === "tools" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolCatalog, { tools: selectedPrompt.tools }),
								!promptSelected && selected?.cell.kind === "compacted" && selectedState !== void 0 && activeTab === "overview" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
									className: `${TrajectoryTable_module_css_default.overview} ${TrajectoryTable_module_css_default.summaryScrollRegion}`,
									"data-summary-scroll-region": "",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Status" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
											className: selectedState === "error" ? TrajectoryTable_module_css_default.error : void 0,
											children: statusLabel(selectedState)
										})] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Duration" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: formatElapsedSeconds(selected.cell.timeSeconds) })] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Tokens" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: "—" })] })
									]
								}), selected.cell.outputDetail !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: `${TrajectoryTable_module_css_default.compactedSummary} ${TrajectoryTable_module_css_default.summaryScrollRegion}`,
									"data-summary-scroll-region": "",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarkdownRecordContent, {
										record: selected,
										rendered: true,
										thinkingExpanded,
										onThinkingExpandedChange: setThinkingExpanded,
										onOpenCall: openCallSummary
									})
								})] }),
								!promptSelected && selected !== void 0 && selected.cell.kind !== "compacted" && selectedState !== void 0 && activeTab === "overview" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
									className: `${TrajectoryTable_module_css_default.overview} ${TrajectoryTable_module_css_default.summaryScrollRegion}`,
									"data-summary-scroll-region": "",
									children: [
										selected.cell.messageSource !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Origin" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
											className: TrajectoryTable_module_css_default.overviewParentLinks,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: TrajectoryTable_module_css_default.overviewHierarchyNavLink,
												onClick: () => {
													activateTab("origin");
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: messageOriginLabel(selected.cell.messageSource) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, {
													className: TrajectoryTable_module_css_default.overviewHierarchyJumpIconTight,
													size: 11
												})]
											})
										})] }),
										hasSelectedHierarchy && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: selectedAssistantRequestTarget !== void 0 ? "Origin" : "Hierarchy" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dd", {
											className: TrajectoryTable_module_css_default.overviewParentLinks,
											children: [
												selectedAssistantRequestTarget !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
													type: "button",
													className: TrajectoryTable_module_css_default.overviewHierarchyNavLink,
													onClick: () => {
														selectRequest(selectedAssistantRequestTarget);
													},
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["Request #", selectedAssistantRequest ?? "—"] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, {
														className: TrajectoryTable_module_css_default.overviewHierarchyJumpIconTight,
														size: 11
													})]
												}),
												selectedParentMessage !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
													type: "button",
													className: TrajectoryTable_module_css_default.overviewHierarchyNavLink,
													onClick: () => {
														openRecordSummary(selectedParentMessage);
													},
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Assistant Message" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, {
														className: TrajectoryTable_module_css_default.overviewHierarchyJumpIconTight,
														size: 11
													})]
												}),
												selectedParentTool !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
													type: "button",
													className: TrajectoryTable_module_css_default.overviewHierarchyNavLink,
													onClick: () => {
														openRecordSummary(selectedParentTool);
													},
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Tool Call" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, {
														className: TrajectoryTable_module_css_default.overviewHierarchyJumpIconTight,
														size: 11
													})]
												})
											]
										})] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Status" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", {
											className: selectedState === "error" ? TrajectoryTable_module_css_default.error : void 0,
											children: statusLabel(selectedState)
										})] }),
										selected.cell.kind === "message" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TokenRows, { cell: selected.cell }),
										(selected.cell.kind === "user" || selected.cell.kind === "context") && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "Duration" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: formatElapsedSeconds(selected.cell.timeSeconds) })] })
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: TrajectoryTable_module_css_default.overviewSections,
									children: [
										isMarkdownRecord(selected) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OverviewSection, {
											label: "Preview",
											onOpen: () => {
												activateTab("rendered");
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarkdownRecordContent, {
												record: selected,
												rendered: true,
												preview: true,
												thinkingExpanded,
												onThinkingExpandedChange: setThinkingExpanded,
												onOpenCall: openCallSummary
											})
										}) }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
											selected.cell.inputDetail && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OverviewSection, {
												label: "Payload",
												onOpen: () => {
													activateTab("input");
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordPayload, {
													record: selected,
													direction: "input",
													preview: true
												})
											}),
											selected.cell.outputDetail && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OverviewSection, {
												label: "Result",
												onOpen: () => {
													activateTab("output");
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordPayload, {
													record: selected,
													direction: "output",
													preview: true
												})
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(OverviewSection, {
												label: "Schema",
												onOpen: () => {
													activateTab("schema");
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordSchema, {
													record: selected,
													preview: true
												})
											})
										] }),
										selectedAssistantRequestTarget !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OverviewSection, {
											label: "Request Timing",
											onOpen: () => {
												selectRequest(selectedAssistantRequestTarget, "timing");
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordTiming, { record: selected })
										}),
										(selected.cell.kind === "tool" || selected.cell.kind === "subtool") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OverviewSection, {
											label: "Timing",
											onOpen: () => {
												activateTab("timing");
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordTiming, { record: selected })
										})
									]
								})] }),
								!promptSelected && selected !== void 0 && activeTab === "rendered" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarkdownRecordContent, {
									record: selected,
									rendered: true,
									thinkingExpanded,
									onThinkingExpandedChange: setThinkingExpanded,
									onOpenCall: openCallSummary
								}),
								!promptSelected && selected !== void 0 && activeTab === "source" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarkdownRecordContent, {
									record: selected,
									rendered: false,
									thinkingExpanded,
									onThinkingExpandedChange: setThinkingExpanded,
									onOpenCall: openCallSummary
								}),
								!promptSelected && selected !== void 0 && activeTab === "origin" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MessageOrigin, { record: selected }),
								!promptSelected && selected !== void 0 && activeTab === "input" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordPayload, {
									record: selected,
									direction: "input"
								}),
								!promptSelected && selected !== void 0 && activeTab === "output" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordPayload, {
									record: selected,
									direction: "output"
								}),
								!promptSelected && selected !== void 0 && activeTab === "schema" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordSchema, { record: selected }),
								!promptSelected && selected !== void 0 && activeTab === "timing" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordTiming, { record: selected })
							]
						})
					]
				})]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-trajectory/src/client/TrajectoryToolbar.module.css.mjs
		const css$2 = ".yGfqEq_root{z-index:4;box-sizing:border-box;width:100%;height:var(--dsh-trajectory-toolbar-height);border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);position:sticky;top:0}.yGfqEq_inner{box-sizing:border-box;align-items:center;gap:8px;width:100%;height:100%;padding:0 6px;display:flex}.yGfqEq_actions{flex:none;align-items:center;gap:2px;display:flex}.yGfqEq_toggle{height:20px;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:var(--dsw-font-xxs-12);background:0 0;border:0;border-radius:3px;flex:none;align-items:center;gap:4px;padding:0 7px;display:inline-flex}.yGfqEq_toggle:hover,.yGfqEq_toggle[aria-pressed=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.yGfqEq_toggle:focus-visible{outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:1px}.yGfqEq_toggleIcon{stroke:currentColor;stroke-width:1.25px;stroke-linecap:round;stroke-linejoin:round;flex:none;width:12px;height:12px}.yGfqEq_control{box-sizing:border-box;width:88px;height:20px;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:var(--dsw-font-xxs-12);background:0 0;border:0;border-radius:0;flex:none;justify-content:center;align-items:center;gap:4px;padding:0 5px;display:inline-flex}.yGfqEq_control[hidden]{display:none}.yGfqEq_control:hover:not(:disabled),.yGfqEq_control[aria-checked=true],.yGfqEq_control[aria-pressed=true]{color:var(--dsw-alias-label-primary)}.yGfqEq_control:focus-visible{outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:1px}.yGfqEq_control:disabled{color:var(--dsw-alias-label-dimmed);cursor:not-allowed}.yGfqEq_controlTrack{background:var(--dsw-alias-border-l2);width:20px;height:10px;transition:background-color .12s var(--ds-ease-in-out);border-radius:5px;flex:none;display:inline-block;position:relative}.yGfqEq_controlThumb{background:var(--dsw-alias-bg-layer-1);width:6px;height:6px;transition:transform .12s var(--ds-ease-in-out);border-radius:50%;position:absolute;top:2px;left:2px}.yGfqEq_controlTrack[data-on=true]{background:var(--dsw-alias-state-business-primary)}.yGfqEq_controlTrack[data-on=true] .yGfqEq_controlThumb{transform:translate(10px)}.yGfqEq_action{height:20px;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:var(--dsw-font-xxs-12);background:0 0;border:0;border-radius:3px;flex:none;align-items:center;gap:4px;padding:0 5px;display:inline-flex}.yGfqEq_action:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.yGfqEq_action:focus-visible{outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:1px}.yGfqEq_actionIcon{color:var(--dsw-alias-label-tertiary);font:14px/14px var(--ds-font-family-code)}.yGfqEq_search{border:1px solid var(--dsw-alias-border-l2);min-width:84px;height:22px;color:var(--dsw-alias-label-caption);background:var(--dsw-alias-bg-layer-2);border-radius:4px;flex:0 164px;align-items:center;gap:4px;margin-left:auto;padding:0 6px;display:flex}.yGfqEq_search:hover{border-color:var(--dsw-alias-label-caption)}.yGfqEq_search:focus-within{border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-bg-layer-1)}.yGfqEq_searchIcon{flex:none}.yGfqEq_searchInput{width:100%;min-width:0;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);background:0 0;border:0;outline:0;padding:0}.yGfqEq_searchInput::placeholder{color:var(--dsw-alias-label-caption)}.yGfqEq_searchInput::-webkit-search-cancel-button{cursor:pointer;width:12px;height:12px}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-trajectory/TrajectoryToolbar.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-trajectory";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var TrajectoryToolbar_module_css_default = {
			"actionIcon": "yGfqEq_actionIcon",
			"inner": "yGfqEq_inner",
			"searchIcon": "yGfqEq_searchIcon",
			"controlThumb": "yGfqEq_controlThumb",
			"searchInput": "yGfqEq_searchInput",
			"control": "yGfqEq_control",
			"toggleIcon": "yGfqEq_toggleIcon",
			"search": "yGfqEq_search",
			"toggle": "yGfqEq_toggle",
			"controlTrack": "yGfqEq_controlTrack",
			"actions": "yGfqEq_actions",
			"action": "yGfqEq_action",
			"root": "yGfqEq_root"
		};
		//#endregion
		//#region src/client/TrajectoryToolbar.tsx
		/** Trajectory toolbar: timeline and ledger fold controls. */
		/**
		* Render the sticky trajectory toolbar.
		* @param props - rendered counts and whole-list fold state.
		* @returns the toolbar element.
		*/
		function TrajectoryToolbar({ actualDuration, onActualDurationChange, actualTime, onActualTimeChange, allTurnsCollapsed, onToggleAllTurns, allAssistantsCollapsed, onToggleAllAssistants, searchQuery, onSearchQueryChange }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: TrajectoryToolbar_module_css_default.root,
				role: "toolbar",
				"aria-label": "Trajectory toolbar",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: TrajectoryToolbar_module_css_default.inner,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: TrajectoryToolbar_module_css_default.actions,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: TrajectoryToolbar_module_css_default.toggle,
								"aria-label": "Use actual duration",
								"aria-pressed": actualDuration,
								title: !actualDuration ? "Use actual duration" : "Use equal-width operations",
								onClick: () => {
									onActualDurationChange(!actualDuration);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
									className: TrajectoryToolbar_module_css_default.toggleIcon,
									viewBox: "0 0 16 16",
									fill: "none",
									"aria-hidden": "true",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
										cx: "8",
										cy: "8",
										r: "5.25"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 4.75V8l2.25 1.5" })]
								}), "Duration"]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: TrajectoryToolbar_module_css_default.control,
								role: "switch",
								"aria-checked": actualTime,
								hidden: true,
								onClick: () => {
									onActualTimeChange(!actualTime);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Actual time" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: TrajectoryToolbar_module_css_default.controlTrack,
									"data-on": actualTime || void 0,
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: TrajectoryToolbar_module_css_default.controlThumb })
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: TrajectoryToolbar_module_css_default.action,
								"aria-label": allTurnsCollapsed ? "Expand turns" : "Collapse turns",
								"aria-pressed": allTurnsCollapsed,
								title: allTurnsCollapsed ? "Expand turns" : "Collapse turns",
								onClick: onToggleAllTurns,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: TrajectoryToolbar_module_css_default.actionIcon,
									"aria-hidden": "true",
									children: allTurnsCollapsed ? "⊞" : "⊟"
								}), "Turns"]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: TrajectoryToolbar_module_css_default.action,
								"aria-label": allAssistantsCollapsed ? "Expand calls" : "Collapse calls",
								"aria-pressed": allAssistantsCollapsed,
								title: allAssistantsCollapsed ? "Expand calls" : "Collapse calls",
								onClick: onToggleAllAssistants,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: TrajectoryToolbar_module_css_default.actionIcon,
									"aria-hidden": "true",
									children: allAssistantsCollapsed ? "⊞" : "⊟"
								}), "Calls"]
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: TrajectoryToolbar_module_css_default.search,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, {
							size: 11,
							className: TrajectoryToolbar_module_css_default.searchIcon
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "search",
							className: TrajectoryToolbar_module_css_default.searchInput,
							"aria-label": "Search trajectory",
							placeholder: "Search",
							value: searchQuery,
							onChange: (event) => {
								onSearchQueryChange(event.currentTarget.value);
							}
						})]
					})]
				})
			});
		}
		//#endregion
		//#region src/client/timeline.ts
		/**
		* Format a timeline duration as an integer-millisecond label.
		* @param milliseconds - Non-negative duration in milliseconds.
		* @returns Millisecond label with thousands separators.
		*/
		function formatTimelineOffset(milliseconds) {
			return formatDurationMillis(milliseconds);
		}
		function laneFor(kind) {
			if (kind === "tool" || kind === "subtool") return 2;
			if (kind === "message" || kind === "compacted") return 1;
			return 0;
		}
		function finite(value) {
			return value !== null && value !== void 0 && Number.isFinite(value);
		}
		function cellRange(cell) {
			if (!finite(cell.startedAt)) return null;
			const durationMs = finite(cell.timeSeconds) ? Math.max(0, cell.timeSeconds * 1e3) : 0;
			return {
				start: cell.startedAt,
				end: cell.startedAt + durationMs
			};
		}
		/**
		* Project every visible record into a stable three-lane timeline.
		* @param turns - Unfiltered trajectory layout.
		* @param mode - Independent equal/recorded duration and compressed/complete time projection.
		* @returns Timeline model, or `null` when no record is visible.
		*/
		function deriveTrajectoryTimeline(turns, mode = "sequence") {
			if (mode !== "sequence") return deriveTimedTimeline(turns, mode === "duration" || mode === "actual", mode === "duration");
			const spans = [];
			const turnBoundaries = [];
			for (const turn of turns) {
				const cells = turn.groups.flatMap((group) => group.cells.filter((cell) => cell.requestOnly !== true));
				if (cells.length === 0) continue;
				if (turn.turn !== null) turnBoundaries.push({
					turn: turn.turn,
					time: spans.length
				});
				spans.push(...cells.map((cell, offset) => ({
					start: spans.length + offset,
					end: spans.length + offset + 1,
					index: cell.index,
					isError: cell.isError === true,
					kind: cell.kind,
					label: cell.text,
					lane: laneFor(cell.kind)
				})));
			}
			if (spans.length === 0) return null;
			return {
				start: 0,
				end: spans.length,
				spans,
				turnBoundaries
			};
		}
		function deriveTimedTimeline(turns, actualDuration, compressIdle) {
			const timedTurns = turns.flatMap((turn) => {
				const rawSpans = turn.groups.flatMap((group) => group.cells.flatMap((cell) => {
					if (cell.requestOnly === true) return [];
					const range = cellRange(cell);
					return range === null ? [] : [{
						...range,
						index: cell.index,
						isError: cell.isError === true,
						kind: cell.kind,
						label: cell.text,
						lane: laneFor(cell.kind)
					}];
				}));
				return rawSpans.length === 0 ? [] : [{
					turn: turn.turn,
					rawSpans
				}];
			});
			const rawSpans = timedTurns.flatMap((turn) => turn.rawSpans);
			if (rawSpans.length === 0) return null;
			const removedIdleBySpan = /* @__PURE__ */ new Map();
			let removedIdle = 0;
			let coveredUntil = null;
			for (const span of [...rawSpans].sort((left, right) => left.start - right.start || left.end - right.end)) {
				if (compressIdle && coveredUntil !== null && span.start > coveredUntil) removedIdle += span.start - coveredUntil;
				removedIdleBySpan.set(span, removedIdle);
				coveredUntil = coveredUntil === null ? span.end : Math.max(coveredUntil, span.end);
			}
			const spans = [];
			const turnBoundaries = [];
			for (const turn of timedTurns) {
				const projected = turn.rawSpans.map((span) => {
					const offset = removedIdleBySpan.get(span) ?? 0;
					return {
						...span,
						start: span.start - offset,
						end: (actualDuration ? span.end : span.start) - offset
					};
				});
				spans.push(...projected);
				if (turn.turn !== null) turnBoundaries.push({
					turn: turn.turn,
					time: Math.min(...projected.map((span) => span.start))
				});
			}
			return {
				start: Math.min(...spans.map((span) => span.start)),
				end: Math.max(...spans.map((span) => span.end)),
				spans,
				turnBoundaries
			};
		}
		/**
		* Identify records active at any point inside an inclusive selected interval.
		* @param turns - Unfiltered trajectory layout.
		* @param range - Selected interval in the active projection.
		* @param mode - Independent equal/recorded duration and compressed/complete time projection.
		* @returns Record indexes inside the focus interval.
		*/
		function trajectoryTimelineFocusIndexes(turns, range, mode = "sequence") {
			const model = deriveTrajectoryTimeline(turns, mode);
			return new Set(model?.spans.filter((span) => span.start <= range.end && span.end >= range.start).map((span) => span.index));
		}
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-trajectory/src/client/TrajectoryTimeline.module.css.mjs
		const css$1 = ".h2Ti9q_root{z-index:1;isolation:isolate;border-bottom:1px solid var(--dsw-alias-border-l2);user-select:none;flex:none;position:relative}.h2Ti9q_root [role=tooltip]{font:var(--dsw-font-xxxs-11)}.h2Ti9q_plot{background:var(--dsw-alias-bg-layer-2);grid-template-columns:44px minmax(0,1fr);height:50px;display:grid;overflow:hidden}.h2Ti9q_labels{border-right:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-caption);font:var(--dsw-font-xs-13);font-size:10px;line-height:1;position:relative}.h2Ti9q_labels span{text-align:right;justify-content:flex-end;align-items:center;height:8px;display:flex;position:absolute;right:3px}.h2Ti9q_labels span:first-child{top:7px}.h2Ti9q_labels span:nth-child(2){top:21px}.h2Ti9q_labels span:nth-child(3){top:35px}.h2Ti9q_track{cursor:crosshair;touch-action:none;position:relative;overflow:hidden}.h2Ti9q_track[data-panning=true]{cursor:grabbing}.h2Ti9q_earlierHistory{z-index:5;appearance:none;box-sizing:border-box;background:linear-gradient(to right, var(--dsw-alias-bg-layer-2) 0, var(--dsw-alias-bg-layer-2) 38%, transparent 100%);width:28px;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13);opacity:.72;cursor:pointer;border:0;outline:none;justify-content:flex-start;align-items:center;padding-left:3px;line-height:1;display:flex;position:absolute;top:0;bottom:0;left:0}.h2Ti9q_earlierHistory:hover{opacity:1}.h2Ti9q_earlierHistory[aria-disabled=true]{cursor:default}.h2Ti9q_earlierHistory:focus-visible{box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2)}.h2Ti9q_empty{color:var(--dsw-alias-label-caption);font:var(--dsw-font-xs-13);position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)}.h2Ti9q_track:focus-visible{outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:-1px}.h2Ti9q_lanes{z-index:2;top:7px;bottom:7px;left:var(--trajectory-domain-left);width:var(--trajectory-domain-width);position:absolute}.h2Ti9q_turnBoundaries{z-index:3;top:0;bottom:0;left:var(--trajectory-domain-left);width:var(--trajectory-domain-width);pointer-events:none;position:absolute}@media (prefers-reduced-motion:no-preference){.h2Ti9q_lanes[data-animate-viewport=true],.h2Ti9q_turnBoundaries[data-animate-viewport=true]{transition:left .18s ease-out}}.h2Ti9q_turnBoundary{top:0;bottom:0;left:var(--trajectory-turn-left);background:var(--dsw-alias-border-l2);width:1px;position:absolute}.h2Ti9q_span{top:calc(var(--trajectory-span-lane) * 14px);left:calc(var(--trajectory-span-left) + var(--trajectory-span-gap));width:max(2px, calc(var(--trajectory-span-width) - var(--trajectory-span-gap) - var(--trajectory-span-gap)));background:var(--dsw-alias-label-secondary);opacity:.78;border-radius:1px;min-width:2px;height:8px;position:absolute}.h2Ti9q_span[data-timeline-span=user]{background:var(--dsw-alias-state-business-primary)}.h2Ti9q_span[data-timeline-span=context]{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 68%, var(--dsw-alias-label-secondary))}.h2Ti9q_span[data-timeline-span=message]{--trajectory-assistant-decoding-color:color-mix(in srgb, var(--dsw-alias-brand-primary-new-colorprimary-new-color) 60%, var(--dsw-alias-state-error-secondary));--trajectory-assistant-ttft-color:color-mix(in srgb, var(--trajectory-assistant-decoding-color) 54%, var(--dsw-alias-bg-layer-2));background:var(--trajectory-assistant-decoding-color);opacity:1}.h2Ti9q_span[data-timeline-span=message][data-assistant-timing=true]{background:linear-gradient(to right, var(--trajectory-assistant-ttft-color) 0, var(--trajectory-assistant-ttft-color) var(--trajectory-assistant-ttft), var(--trajectory-assistant-decoding-color) var(--trajectory-assistant-ttft), var(--trajectory-assistant-decoding-color) 100%)}.h2Ti9q_span[data-timeline-span=tool],.h2Ti9q_span[data-timeline-span=subtool]{background:var(--dsw-alias-state-warn-label);opacity:1}.h2Ti9q_span[data-error=true]{background:var(--dsw-alias-state-error-primary)}.h2Ti9q_span[data-equal-duration=true]{width:8px;min-width:8px}.h2Ti9q_span[data-selected=false]{opacity:.2}.h2Ti9q_span[data-hovered=true]:not([data-current=true]){z-index:1;opacity:1;box-shadow:0 0 0 1px var(--dsw-alias-bg-layer-2), 0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 80%, transparent)}.h2Ti9q_span[data-current=true]{z-index:1;opacity:1;box-shadow:0 0 0 1px var(--dsw-alias-bg-layer-2), 0 0 0 2px var(--dsw-alias-state-business-primary)}.h2Ti9q_span[data-search-match=false]{opacity:.14}.h2Ti9q_selection{z-index:1;top:0;bottom:0;left:var(--trajectory-selection-left);width:var(--trajectory-selection-width);background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);min-width:1px;box-shadow:-100vw 0 0 100vw color-mix(in srgb, var(--dsw-alias-bg-layer-1) 58%, transparent), 100vw 0 0 100vw color-mix(in srgb, var(--dsw-alias-bg-layer-1) 58%, transparent);pointer-events:none;position:absolute}.h2Ti9q_selectionEdges{z-index:4;top:0;bottom:0;left:var(--trajectory-selection-left);width:var(--trajectory-selection-width);pointer-events:none;min-width:1px;position:absolute}.h2Ti9q_hoverLine{z-index:4;top:0;bottom:0;left:clamp(0px, calc(var(--trajectory-hover-left) - 1px), calc(100% - 2px));background:var(--dsw-alias-state-business-primary);pointer-events:none;width:2px;position:absolute}.h2Ti9q_selectionEdges:before,.h2Ti9q_selectionEdges:after{background:var(--dsw-alias-state-business-primary);content:\"\";width:3px;position:absolute;top:0;bottom:0}.h2Ti9q_selectionEdges:before{left:0}.h2Ti9q_selectionEdges:after{right:0}.h2Ti9q_selectionEdges[data-dragging=true]:before,.h2Ti9q_selectionEdges[data-dragging=true]:after{width:2px}.h2Ti9q_selection[data-dragging=true]{background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent)}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-trajectory/TrajectoryTimeline.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-trajectory";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var TrajectoryTimeline_module_css_default = {
			"labels": "h2Ti9q_labels",
			"root": "h2Ti9q_root",
			"plot": "h2Ti9q_plot",
			"earlierHistory": "h2Ti9q_earlierHistory",
			"lanes": "h2Ti9q_lanes",
			"turnBoundary": "h2Ti9q_turnBoundary",
			"empty": "h2Ti9q_empty",
			"span": "h2Ti9q_span",
			"selectionEdges": "h2Ti9q_selectionEdges",
			"selection": "h2Ti9q_selection",
			"hoverLine": "h2Ti9q_hoverLine",
			"track": "h2Ti9q_track",
			"turnBoundaries": "h2Ti9q_turnBoundaries"
		};
		//#endregion
		//#region src/client/TrajectoryTimeline.tsx
		/** Chrome-Network-style overview timeline for focusing the trajectory ledger. */
		const MINIMUM_DRAG_PX = 3;
		const MINIMUM_ZOOM_OPERATIONS = 4;
		const EDGE_PAN_ZONE_FRACTION = .08;
		const EDGE_PAN_STEP_FRACTION = .025;
		const MAXIMUM_EDGE_PAN_PX = 32;
		const TIMELINE_TOOLTIP_DELAY_MS = 500;
		function assistantTimingDetail(metrics) {
			const start = metrics?.stepStartTime;
			const first = metrics?.firstTokenTime;
			const completed = metrics?.completedTime;
			if (metrics?.timingRecorded !== true || typeof start !== "number" || typeof first !== "number" || typeof completed !== "number" || !Number.isFinite(start) || !Number.isFinite(first) || !Number.isFinite(completed) || first < start || completed < first) return {};
			return {
				ttftMs: first - start,
				decodingMs: completed - first
			};
		}
		function timelineRecordDetail(cell) {
			const durationMs = cell.timeSeconds === null || !Number.isFinite(cell.timeSeconds) ? void 0 : Math.max(0, cell.timeSeconds * 1e3);
			const startedAt = cell.startedAt === null || !Number.isFinite(cell.startedAt) ? void 0 : cell.startedAt;
			return {
				...durationMs === void 0 ? {} : { durationMs },
				...startedAt === void 0 ? {} : { startedAt },
				...assistantTimingDetail(cell.assistantMetrics)
			};
		}
		function timelineKindLabel(kind) {
			switch (kind) {
				case "system": return "SYSTEM";
				case "user": return "USER";
				case "context": return "CONTEXT";
				case "compacted": return "COMPACTED";
				case "message": return "ASSISTANT";
				case "tool": return "TOOL";
				case "subtool": return "SUBTOOL";
			}
		}
		function formatRecordedTime(timestamp) {
			return new Date(timestamp).toLocaleTimeString(void 0, {
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				fractionalSecondDigits: 3
			});
		}
		function timelineTooltipLabel(kind, detail) {
			const heading = timelineKindLabel(kind);
			if (detail === void 0) return heading;
			const duration = detail.durationMs === void 0 ? null : `Total ${formatTimelineOffset(detail.durationMs)}`;
			return [
				heading,
				detail.startedAt === void 0 ? null : detail.durationMs === void 0 ? `Started ${formatRecordedTime(detail.startedAt)}` : `${formatRecordedTime(detail.startedAt)} → ${formatRecordedTime(detail.startedAt + detail.durationMs)}`,
				[duration, detail.ttftMs === void 0 || detail.decodingMs === void 0 ? null : `TTFT ${formatTimelineOffset(detail.ttftMs)} · Decoding ${formatTimelineOffset(detail.decodingMs)}`].filter((value) => value !== null).join(" · ")
			].filter((value) => value !== null && value !== "").join("\n");
		}
		function orderedRange(left, right) {
			return left <= right ? {
				start: left,
				end: right
			} : {
				start: right,
				end: left
			};
		}
		function clampFraction(value) {
			return Math.min(1, Math.max(0, value));
		}
		function centeredRange(center, width, minimum, maximum) {
			const clampedWidth = Math.min(maximum - minimum, Math.max(0, width));
			const start = Math.min(Math.max(center - clampedWidth / 2, minimum), maximum - clampedWidth);
			return {
				start,
				end: start + clampedWidth
			};
		}
		function rangeFraction(range, start, duration, minimum, maximum) {
			const bounded = orderedRange(Math.min(maximum, Math.max(minimum, range.start)), Math.min(maximum, Math.max(minimum, range.end)));
			return {
				start: (bounded.start - start) / duration,
				end: (bounded.end - start) / duration
			};
		}
		function LaneLabels() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: TrajectoryTimeline_module_css_default.labels,
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Input" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Model" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Tools" })
				]
			});
		}
		function EarlierHistoryBoundary({ loading, onHover, onLoad }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: loading ? "Loading earlier history…" : "Click to load earlier history",
				side: "right",
				delayMs: TIMELINE_TOOLTIP_DELAY_MS,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: TrajectoryTimeline_module_css_default.earlierHistory,
					"data-earlier-history": true,
					"data-loading": loading || void 0,
					"aria-label": loading ? "Loading earlier history" : "Load earlier history",
					"aria-disabled": loading || onLoad === void 0,
					onClick: onLoad,
					onPointerEnter: (event) => {
						event.stopPropagation();
						onHover();
					},
					onPointerMove: (event) => {
						event.stopPropagation();
					},
					onPointerDown: (event) => {
						event.stopPropagation();
					},
					children: "…"
				})
			});
		}
		/** Overview renderer with drag ranges, click-sized focus, and Escape reset. */
		const TrajectoryTimeline = (0, react.memo)(function TrajectoryTimeline({ turns, mode, range, hasEarlierRecords = false, onLoadEarlier, selectedIndex = null, searchMatchIndexes = null, onRangeChange, onRecordSelect, onRecordFocus }) {
			const model = (0, react.useMemo)(() => deriveTrajectoryTimeline(turns, mode), [mode, turns]);
			const detailByIndex = (0, react.useMemo)(() => new Map(turns.flatMap((turn) => turn.groups.flatMap((group) => group.cells.map((cell) => [cell.index, timelineRecordDetail(cell)])))), [turns]);
			const dragRef = (0, react.useRef)(null);
			const panRef = (0, react.useRef)(null);
			const rootRef = (0, react.useRef)(null);
			const trackRef = (0, react.useRef)(null);
			const [draft, setDraft] = (0, react.useState)(null);
			const [hover, setHover] = (0, react.useState)(null);
			const [loadingEarlier, setLoadingEarlier] = (0, react.useState)(false);
			const [panning, setPanning] = (0, react.useState)(false);
			const [viewport, setViewport] = (0, react.useState)(null);
			const [animateViewport, setAnimateViewport] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (model !== null && range !== null && (range.end < model.start || range.start > model.end)) onRangeChange(null);
			}, [
				model,
				onRangeChange,
				range
			]);
			(0, react.useEffect)(() => {
				if (model === null) return;
				setAnimateViewport(false);
				setViewport((current) => current !== null && (current.end < model.start || current.start > model.end) ? null : current);
			}, [model]);
			(0, react.useEffect)(() => {
				if (model === null || selectedIndex === null) return;
				const selectedSpan = model.spans.find((span) => span.index === selectedIndex);
				if (selectedSpan === void 0) return;
				setAnimateViewport(true);
				setViewport((current) => {
					if (current === null) return current;
					if (selectedSpan.end > current.start && selectedSpan.start < current.end) return current;
					const duration = Math.max(1, current.end - current.start);
					const desiredStart = selectedSpan.end <= current.start ? selectedSpan.start : selectedSpan.end - duration;
					const nextStart = Math.min(Math.max(desiredStart, model.start), Math.max(model.start, model.end - duration));
					if (nextStart === current.start) return current;
					return {
						start: nextStart,
						end: nextStart + duration
					};
				});
			}, [model, selectedIndex]);
			const fullDuration = Math.max(1, (model?.end ?? 0) - (model?.start ?? 0));
			const viewportDuration = Math.min(fullDuration, Math.max(1, (viewport?.end ?? 0) - (viewport?.start ?? 0)));
			const viewportStart = model === null || viewport === null ? model?.start ?? 0 : Math.min(Math.max(viewport.start, model.start), model.end - viewportDuration);
			const domainDuration = viewport === null ? fullDuration : viewportDuration;
			const domainStart = viewport === null ? model?.start ?? 0 : viewportStart;
			const showsEarlierBoundary = hasEarlierRecords && model !== null && domainStart === model.start;
			const loadEarlier = onLoadEarlier === void 0 || loadingEarlier ? void 0 : () => {
				setLoadingEarlier(true);
				onLoadEarlier().finally(() => {
					setLoadingEarlier(false);
				});
			};
			const projectedDomainStyle = model === null ? void 0 : {
				"--trajectory-domain-left": `${-(domainStart - model.start) / domainDuration * 100}%`,
				"--trajectory-domain-width": `${fullDuration / domainDuration * 100}%`
			};
			const committed = model === null || range === null ? null : rangeFraction(range, domainStart, domainDuration, model.start, model.end);
			const visibleRange = (model === null || draft === null ? null : rangeFraction(draft, domainStart, domainDuration, model.start, model.end)) ?? committed;
			const activeRange = draft ?? range;
			(0, react.useEffect)(() => {
				const root = rootRef.current;
				if (root === null) return;
				const onWheel = (event) => {
					event.preventDefault();
					const track = trackRef.current;
					if (track === null || model === null) return;
					setAnimateViewport(false);
					const rect = track.getBoundingClientRect();
					const anchorFraction = clampFraction((event.clientX - rect.left) / Math.max(1, rect.width));
					const nextDuration = Math.min(fullDuration, Math.max(Math.min(mode === "sequence" ? MINIMUM_ZOOM_OPERATIONS : 20, fullDuration), domainDuration * Math.exp(event.deltaY * .0015)));
					if (nextDuration >= fullDuration * .999) {
						setViewport(null);
						return;
					}
					const anchorTime = domainStart + anchorFraction * domainDuration;
					const nextStart = Math.min(Math.max(anchorTime - anchorFraction * nextDuration, model.start), model.end - nextDuration);
					setViewport({
						start: nextStart,
						end: nextStart + nextDuration
					});
				};
				root.addEventListener("wheel", onWheel, { passive: false });
				return () => {
					root.removeEventListener("wheel", onWheel);
				};
			}, [
				domainDuration,
				domainStart,
				fullDuration,
				mode,
				model
			]);
			if (model === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
				ref: rootRef,
				className: TrajectoryTimeline_module_css_default.root,
				"aria-label": "Trajectory timeline",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: TrajectoryTimeline_module_css_default.plot,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(LaneLabels, {}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: TrajectoryTimeline_module_css_default.track,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: TrajectoryTimeline_module_css_default.empty,
							children: "No timing data"
						}), hasEarlierRecords && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EarlierHistoryBoundary, {
							loading: loadingEarlier,
							onHover: () => {
								setHover(null);
							},
							onLoad: loadEarlier
						})]
					})]
				})
			});
			const minimumSelectionDuration = Math.min(domainDuration, fullDuration / model.spans.length);
			const fractionAt = (event) => {
				const rect = event.currentTarget.getBoundingClientRect();
				return clampFraction((event.clientX - rect.left) / Math.max(1, rect.width));
			};
			const recordIndexAt = (event) => {
				const value = (event.target instanceof HTMLElement ? event.target : null)?.closest("[data-timeline-record-index]")?.dataset.timelineRecordIndex;
				if (value === void 0) return null;
				const index = Number(value);
				return Number.isFinite(index) ? index : null;
			};
			const commit = (nextRange) => {
				onRangeChange(nextRange);
			};
			const onPointerDown = (event) => {
				if (event.button === 2) {
					panRef.current = {
						anchorClientX: event.clientX,
						anchorStart: domainStart,
						moved: false,
						pannable: viewport !== null,
						pointerId: event.pointerId
					};
					if (viewport !== null) setAnimateViewport(false);
					setPanning(true);
					if (typeof event.currentTarget.setPointerCapture === "function") event.currentTarget.setPointerCapture(event.pointerId);
					return;
				}
				if (event.button !== 0) return;
				const anchor = fractionAt(event);
				const anchorTime = domainStart + anchor * domainDuration;
				const recordIndex = recordIndexAt(event);
				setHover({
					fraction: anchor,
					recordIndex
				});
				dragRef.current = {
					pointerId: event.pointerId,
					anchorTime,
					anchorClientX: event.clientX,
					recordIndex
				};
				if (typeof event.currentTarget.setPointerCapture === "function") event.currentTarget.setPointerCapture(event.pointerId);
				setDraft({
					start: anchorTime,
					end: anchorTime
				});
			};
			const onPointerMove = (event) => {
				const rect = event.currentTarget.getBoundingClientRect();
				const fraction = fractionAt(event);
				setHover({
					fraction,
					recordIndex: recordIndexAt(event)
				});
				const pan = panRef.current;
				if (pan !== null && pan.pointerId === event.pointerId) {
					if (Math.abs(event.clientX - pan.anchorClientX) >= MINIMUM_DRAG_PX) pan.moved = true;
					if (!pan.pannable) return;
					const delta = (event.clientX - pan.anchorClientX) / Math.max(1, rect.width);
					const nextStart = Math.min(Math.max(pan.anchorStart - delta * domainDuration, model.start), model.end - domainDuration);
					setViewport({
						start: nextStart,
						end: nextStart + domainDuration
					});
					return;
				}
				const drag = dragRef.current;
				if (drag === null || drag.pointerId !== event.pointerId) return;
				let nextDomainStart = domainStart;
				if (viewport !== null) {
					const localX = event.clientX - rect.left;
					const edgeWidth = Math.min(MAXIMUM_EDGE_PAN_PX, Math.max(1, rect.width * EDGE_PAN_ZONE_FRACTION));
					const direction = localX < edgeWidth ? -1 : localX > rect.width - edgeWidth ? 1 : 0;
					if (direction !== 0) {
						const strength = clampFraction((direction < 0 ? edgeWidth - localX : localX - (rect.width - edgeWidth)) / edgeWidth);
						const desiredStart = domainStart + direction * domainDuration * EDGE_PAN_STEP_FRACTION * Math.max(.2, strength);
						nextDomainStart = Math.min(Math.max(desiredStart, model.start), model.end - domainDuration);
						if (nextDomainStart !== domainStart) {
							setAnimateViewport(false);
							setViewport({
								start: nextDomainStart,
								end: nextDomainStart + domainDuration
							});
						}
					}
				}
				const pointTime = nextDomainStart + fraction * domainDuration;
				setDraft(orderedRange(drag.anchorTime, pointTime));
			};
			const onPointerEnd = (event) => {
				const pan = panRef.current;
				if (pan !== null && pan.pointerId === event.pointerId) {
					const moved = pan.moved || Math.abs(event.clientX - pan.anchorClientX) >= MINIMUM_DRAG_PX;
					panRef.current = null;
					setPanning(false);
					if (!moved) onRangeChange(null);
					return;
				}
				const drag = dragRef.current;
				if (drag === null || drag.pointerId !== event.pointerId) return;
				const pointFraction = fractionAt(event);
				const pointTime = domainStart + pointFraction * domainDuration;
				const selected = orderedRange(drag.anchorTime, pointTime);
				setHover({
					fraction: pointFraction,
					recordIndex: recordIndexAt(event)
				});
				dragRef.current = null;
				setDraft(null);
				const click = Math.abs(event.clientX - drag.anchorClientX) < MINIMUM_DRAG_PX;
				const clickedSpan = click && drag.recordIndex !== null ? model.spans.find((span) => span.index === drag.recordIndex) : void 0;
				if (clickedSpan !== void 0) {
					onRangeChange(null);
					onRecordSelect?.(clickedSpan.index);
					return;
				}
				commit(selected.end - selected.start < minimumSelectionDuration ? centeredRange(click ? selected.start : (selected.start + selected.end) / 2, minimumSelectionDuration, model.start, model.end) : selected);
				if (click) {
					const timelinePoint = selected.start;
					const nearest = model.spans.reduce((candidate, span) => {
						const candidateDistance = timelinePoint < candidate.start ? candidate.start - timelinePoint : timelinePoint > candidate.end ? timelinePoint - candidate.end : 0;
						return (timelinePoint < span.start ? span.start - timelinePoint : timelinePoint > span.end ? timelinePoint - span.end : 0) < candidateDistance ? span : candidate;
					});
					onRecordFocus?.(nearest.index);
				}
			};
			const onKeyDown = (event) => {
				if (event.key !== "Escape" || range === null) return;
				event.preventDefault();
				onRangeChange(null);
			};
			const onPointerCancel = () => {
				dragRef.current = null;
				panRef.current = null;
				setDraft(null);
				setHover(null);
				setPanning(false);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
				ref: rootRef,
				className: TrajectoryTimeline_module_css_default.root,
				"aria-label": "Trajectory timeline",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: TrajectoryTimeline_module_css_default.plot,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(LaneLabels, {}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						ref: trackRef,
						className: TrajectoryTimeline_module_css_default.track,
						"data-panning": panning || void 0,
						"aria-label": "Timeline overview; drag horizontally to focus events",
						tabIndex: 0,
						onKeyDown,
						onPointerDown,
						onPointerMove,
						onPointerUp: onPointerEnd,
						onPointerCancel,
						onPointerLeave: () => {
							if (dragRef.current === null && panRef.current === null) setHover(null);
						},
						onDoubleClick: (event) => {
							event.preventDefault();
							onRangeChange(null);
						},
						onContextMenu: (event) => {
							event.preventDefault();
						},
						children: [
							showsEarlierBoundary && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EarlierHistoryBoundary, {
								loading: loadingEarlier,
								onHover: () => {
									setHover(null);
								},
								onLoad: loadEarlier
							}),
							hover !== null && hover.recordIndex === null && draft === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: TrajectoryTimeline_module_css_default.hoverLine,
								"data-timeline-hover-line": true,
								"aria-hidden": "true",
								style: { "--trajectory-hover-left": `${hover.fraction * 100}%` }
							}),
							visibleRange !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: TrajectoryTimeline_module_css_default.selection,
								"data-dragging": draft === null ? void 0 : "true",
								"aria-hidden": "true",
								style: {
									"--trajectory-selection-left": `${visibleRange.start * 100}%`,
									"--trajectory-selection-width": `${(visibleRange.end - visibleRange.start) * 100}%`
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: TrajectoryTimeline_module_css_default.selectionEdges,
								"data-dragging": draft === null ? void 0 : "true",
								"aria-hidden": "true",
								style: {
									"--trajectory-selection-left": `${visibleRange.start * 100}%`,
									"--trajectory-selection-width": `${(visibleRange.end - visibleRange.start) * 100}%`
								}
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: TrajectoryTimeline_module_css_default.turnBoundaries,
								"data-animate-viewport": animateViewport || void 0,
								"aria-hidden": "true",
								style: projectedDomainStyle,
								children: model.turnBoundaries.filter((boundary) => boundary.time > model.start && boundary.time >= domainStart && boundary.time <= domainStart + domainDuration).map((boundary) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: TrajectoryTimeline_module_css_default.turnBoundary,
									"data-turn": boundary.turn,
									style: { "--trajectory-turn-left": `${(boundary.time - model.start) / fullDuration * 100}%` }
								}, boundary.turn))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: TrajectoryTimeline_module_css_default.lanes,
								"data-animate-viewport": animateViewport || void 0,
								"data-timeline-domain": true,
								style: projectedDomainStyle,
								children: model.spans.filter((span) => span.index === selectedIndex || span.end >= domainStart && span.start <= domainStart + domainDuration).map((span) => {
									const left = (span.start - model.start) / fullDuration;
									const widthPercent = (span.end - span.start) / fullDuration * 100;
									const detail = detailByIndex.get(span.index);
									const ttftMs = detail?.ttftMs;
									const decodingMs = detail?.decodingMs;
									const ttftFraction = ttftMs === void 0 || decodingMs === void 0 || ttftMs + decodingMs <= 0 ? null : ttftMs / (ttftMs + decodingMs);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
										label: timelineTooltipLabel(span.kind, detail),
										side: "bottom",
										delayMs: TIMELINE_TOOLTIP_DELAY_MS,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											"aria-hidden": "true",
											className: TrajectoryTimeline_module_css_default.span,
											"data-timeline-span": span.kind,
											"data-timeline-record-index": span.index,
											"data-assistant-timing": ttftFraction === null ? void 0 : "true",
											"data-error": span.isError || void 0,
											"data-equal-duration": mode === "time" || void 0,
											"data-current": span.index === selectedIndex || void 0,
											"data-hovered": hover?.recordIndex === span.index || void 0,
											"data-search-match": searchMatchIndexes === null ? void 0 : searchMatchIndexes.has(span.index) ? "true" : "false",
											"data-selected": activeRange === null ? void 0 : span.start <= activeRange.end && span.end >= activeRange.start ? "true" : "false",
											style: {
												"--trajectory-span-left": `${left * 100}%`,
												"--trajectory-span-width": `${widthPercent}%`,
												"--trajectory-span-gap": `min(${widthPercent * .08}%, 1px)`,
												"--trajectory-span-lane": span.lane,
												...ttftFraction === null ? {} : { "--trajectory-assistant-ttft": `${ttftFraction * 100}%` }
											}
										})
									}, span.index);
								})
							})
						]
					})]
				})
			});
		});
		//#endregion
		//#region \0dsh-css:/Users/nothing/workspace/dsh/wt-artifact/packages/client/ui-trajectory/src/client/views.module.css.mjs
		const css = "._96Igya_root{--dsh-trajectory-toolbar-height:32px;box-sizing:border-box;width:100%;height:100%;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);flex-direction:column;display:flex;overflow:hidden}._96Igya_ledger{z-index:0;isolation:isolate;--dsh-trajectory-bottom-clearance:calc(var(--dsh-composer-height,152px) + 16px);flex:1;min-width:0;min-height:0;display:flex;position:relative;overflow:hidden}";
		const tagId = "@deepseek-ai/dsh-client-ui-trajectory/views.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-trajectory";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var views_module_css_default = {
			"ledger": "_96Igya_ledger",
			"root": "_96Igya_root"
		};
		//#endregion
		//#region src/client/TrajectoryView.tsx
		/** Trajectory view: compact summary over a turn-aware event ledger. */
		const EMPTY_TURN_IDS = /* @__PURE__ */ new Set();
		const EMPTY_RECORD_IDS = /* @__PURE__ */ new Set();
		function lastCellIndex(turns) {
			let last = 0;
			for (const turn of turns) for (const group of turn.groups) for (const cell of group.cells) last = Math.max(last, cell.index);
			return last;
		}
		function timelineBlock(block) {
			switch (block.kind) {
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
					callId: block.callId,
					name: block.name,
					argsRaw: ""
				};
				case "other": return {
					kind: "other",
					block: null
				};
			}
		}
		function partialStructureSignature(partial) {
			if (partial === null) return "";
			return partial.blocks.map((block) => block.kind === "tool-call" ? `${block.kind}:${block.callId}:${block.name}` : block.kind).join("\0");
		}
		function requestUsage(value) {
			const usage = value;
			if (usage === void 0) return void 0;
			return {
				...usage.inputTokens === void 0 ? {} : { input: usage.inputTokens },
				...usage.cacheReadTokens === void 0 ? {} : { cacheRead: usage.cacheReadTokens },
				...usage.cacheWriteTokens === void 0 ? {} : { cacheWrite: usage.cacheWriteTokens },
				...usage.outputTokens === void 0 ? {} : { output: usage.outputTokens },
				...usage.reasoningTokens === void 0 ? {} : { reasoning: usage.reasoningTokens }
			};
		}
		function addUsage(total, usage) {
			if (usage === void 0) return total;
			return {
				...total?.input === void 0 && usage.input === void 0 ? {} : { input: (total?.input ?? 0) + (usage.input ?? 0) },
				...total?.cacheRead === void 0 && usage.cacheRead === void 0 ? {} : { cacheRead: (total?.cacheRead ?? 0) + (usage.cacheRead ?? 0) },
				...total?.cacheWrite === void 0 && usage.cacheWrite === void 0 ? {} : { cacheWrite: (total?.cacheWrite ?? 0) + (usage.cacheWrite ?? 0) },
				...total?.output === void 0 && usage.output === void 0 ? {} : { output: (total?.output ?? 0) + (usage.output ?? 0) },
				...total?.reasoning === void 0 && usage.reasoning === void 0 ? {} : { reasoning: (total?.reasoning ?? 0) + (usage.reasoning ?? 0) }
			};
		}
		function searchableJson(value) {
			if (value === void 0) return "";
			try {
				return JSON.stringify(value);
			} catch {
				return "";
			}
		}
		function searchMatches(turns, query) {
			const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
			if (terms.length === 0) return null;
			const matches = /* @__PURE__ */ new Set();
			for (const turn of turns) for (const group of turn.groups) for (const cell of group.cells) {
				if (cell.requestOnly === true) continue;
				const blocks = [...cell.sourceBlocks ?? [], ...cell.outputBlocks ?? []];
				const text = [
					turn.turn === null ? "between turns" : `turn ${turn.turn}`,
					group.title,
					cell.kind,
					cell.kind === "message" ? "assistant" : void 0,
					cell.text,
					cell.inputDetail,
					cell.outputDetail,
					cell.thinkingDetail,
					cell.schemaDetail,
					cell.result,
					cell.callId,
					...blocks.flatMap((block) => [
						block.type,
						block.content,
						block.callId,
						block.toolName,
						block.imageAlt
					]),
					searchableJson(cell.messageSource),
					searchableJson(cell.promptDetail),
					searchableJson(cell.previousPromptDetail)
				].filter((value) => typeof value === "string").join("\n").toLocaleLowerCase();
				if (terms.every((term) => text.includes(term))) matches.add(cell.index);
			}
			return matches;
		}
		function mergeSearchMatches(finalized, partial) {
			if (finalized === null || partial === null) return null;
			return new Set([...finalized, ...partial]);
		}
		function TrajectoryView({ useHistory, useDuration, loadHistoryTail, loadOlderHistory, setActualDuration, inspect, onInspectDone }) {
			const [collapsedTurns, setCollapsedTurns] = (0, react.useState)(EMPTY_TURN_IDS);
			const [collapsedAssistants, setCollapsedAssistants] = (0, react.useState)(EMPTY_RECORD_IDS);
			const [timelineSelection, setTimelineSelection] = (0, react.useState)(null);
			const actualDuration = useDuration((value) => value);
			const [actualTime, setActualTime] = (0, react.useState)(false);
			const [searchQuery, setSearchQuery] = (0, react.useState)("");
			const [selectedTimelineIndex, setSelectedTimelineIndex] = (0, react.useState)(null);
			const [timelineRecordSelection, setTimelineRecordSelection] = (0, react.useState)(null);
			const [timelineRecordFocus, setTimelineRecordFocus] = (0, react.useState)(null);
			const inspection = useHistory((snapshot) => snapshot.inspection);
			const historyLoading = useHistory((snapshot) => snapshot.state === "cold" || snapshot.state === "loading");
			const hasOlderHistory = useHistory((snapshot) => snapshot.hasMore);
			const historyBaseSeq = useHistory((snapshot) => snapshot.baseSeq);
			const nodes = inspection.eventNodes;
			const partial = inspection.partial;
			const runningCalls = inspection.runningCalls;
			const codeDispatches = inspection.codeDispatches;
			const loadHistoryTailRef = (0, react.useRef)(loadHistoryTail);
			loadHistoryTailRef.current = loadHistoryTail;
			const historyControllerRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				historyControllerRef.current = controller;
				loadHistoryTailRef.current(controller.signal);
				return () => {
					controller.abort();
				};
			}, []);
			const requests = inspection.requests;
			const callSchemas = inspection.callSchemas;
			const historyContexts = inspection.contexts;
			const interruptedNodes = inspection.interruptedNodes;
			const contexts = (0, react.useMemo)(() => historyContexts.length === 0 ? [{
				id: 0,
				nodes
			}] : historyContexts, [historyContexts, nodes]);
			const currentBranch = (0, react.useMemo)(() => {
				return deriveTrajectoryContextBranches(contexts);
			}, [contexts]).at(-1);
			if (currentBranch === void 0) throw new Error("trajectory branch projection must not be empty");
			const selectedNodes = (0, react.useMemo)(() => {
				const selected = new Map(currentBranch.nodes.map((node) => [node.seq, node]));
				for (const node of interruptedNodes) selected.set(node.seq, node);
				return [...selected.values()].sort((left, right) => left.seq - right.seq);
			}, [currentBranch.nodes, interruptedNodes]);
			const selectedRequests = (0, react.useMemo)(() => requests.filter((request) => trajectoryBranchContainsRequest(currentBranch, request)), [currentBranch, requests]);
			const requestNumbers = (0, react.useMemo)(() => {
				const assistantsByStep = /* @__PURE__ */ new Map();
				for (const context of contexts) for (const node of context.nodes) {
					if (node.kind !== "assistant" || node.step <= 0) continue;
					assistantsByStep.set(`${node.turn}\u0000${node.step}`, node);
				}
				for (const node of nodes) {
					if (node.kind !== "assistant" || node.step <= 0) continue;
					assistantsByStep.set(`${node.turn}\u0000${node.step}`, node);
				}
				const requestsByStep = new Map(requests.filter((request) => request.purpose === "assistant").map((request) => [`${request.turn}\u0000${request.step}`, request]));
				const orderedRequests = [...requests.map((request) => ({
					seq: request.startSeq,
					request,
					node: request.purpose === "assistant" ? assistantsByStep.get(`${request.turn}\u0000${request.step}`) : void 0
				})), ...[...assistantsByStep.entries()].flatMap(([key, node]) => requestsByStep.has(key) ? [] : [{
					seq: node.seq,
					request: void 0,
					node
				}])].sort((left, right) => left.seq - right.seq);
				const numbered = [];
				let cumulativeUsage;
				for (const [index, entry] of orderedRequests.entries()) {
					const usage = requestUsage(entry.request?.usage ?? entry.node?.usage);
					cumulativeUsage = addUsage(cumulativeUsage, usage);
					if (entry.request?.purpose !== "compaction") {
						const request = entry.request;
						const node = entry.node;
						const turn = request?.turn ?? node?.turn;
						const step = request?.step ?? node?.step;
						if (turn === void 0 || step === void 0) continue;
						const provider = request?.provenance?.provider ?? node?.provenance?.provider;
						const model = request?.provenance?.model ?? node?.provenance?.model;
						const requestConfig = request?.requestConfig ?? node?.requestConfig;
						numbered.push({
							seq: entry.seq,
							turn,
							step,
							group: `Step ${step}`,
							number: index + 1,
							...request?.status === void 0 ? {} : { status: request.status },
							...request?.startedAt === void 0 ? {} : { startedAt: request.startedAt },
							...request?.completedAt === void 0 ? {} : { completedAt: request.completedAt },
							...request?.error === void 0 ? {} : { error: request.error },
							...request?.resultSeq === void 0 ? {} : { resultSeq: request.resultSeq },
							...request?.retry === void 0 ? {} : { retry: request.retry },
							...request?.maxRetries === void 0 ? {} : { maxRetries: request.maxRetries },
							...request?.retryDelayMs === void 0 ? {} : { retryDelayMs: request.retryDelayMs },
							...provider === void 0 ? {} : { provider },
							...model === void 0 ? {} : { model },
							...requestConfig === void 0 ? {} : { requestConfig },
							...usage === void 0 ? {} : { usage },
							...cumulativeUsage === void 0 ? {} : { cumulativeUsage }
						});
						continue;
					}
					const request = entry.request;
					numbered.push({
						seq: request.startSeq,
						turn: request.turn,
						step: 0,
						group: `Compaction ${request.startSeq}`,
						number: index + 1,
						purpose: "compaction",
						status: request.status,
						startedAt: request.startedAt,
						completedAt: request.completedAt,
						...request.error === void 0 ? {} : { error: request.error },
						resultSeq: request.startSeq,
						...request.provenance?.provider === void 0 ? {} : { provider: request.provenance.provider },
						...request.provenance?.model === void 0 ? {} : { model: request.provenance.model },
						...request.requestConfig === void 0 ? {} : { requestConfig: request.requestConfig },
						...usage === void 0 ? {} : { usage },
						...cumulativeUsage === void 0 ? {} : { cumulativeUsage }
					});
				}
				return numbered;
			}, [
				contexts,
				nodes,
				requests
			]);
			const partialTurn = partial?.turn ?? null;
			const partialStep = partial?.step ?? null;
			const finalized = (0, react.useMemo)(() => {
				const turns = deriveTrajectoryLayout({
					nodes: selectedNodes,
					partial: partialTurn === null || partialStep === null ? null : {
						turn: partialTurn,
						step: partialStep,
						blocks: []
					},
					runningCalls,
					requests: selectedRequests,
					callSchemas,
					codeDispatches
				});
				return {
					turns,
					lastIndex: lastCellIndex(turns)
				};
			}, [
				selectedNodes,
				partialTurn,
				partialStep,
				runningCalls,
				selectedRequests,
				callSchemas,
				codeDispatches
			]);
			const timelinePartial = (0, react.useMemo)(() => partial === null ? null : {
				turn: partial.turn,
				step: partial.step,
				blocks: partial.blocks.map((block) => timelineBlock(block))
			}, [
				partialStep,
				partialTurn,
				partialStructureSignature(partial)
			]);
			const timelineTurns = (0, react.useMemo)(() => appendTrajectoryPartialLayout(finalized.turns, timelinePartial, finalized.lastIndex), [finalized, timelinePartial]);
			const timelineMode = actualDuration ? actualTime ? "actual" : "duration" : actualTime ? "time" : "sequence";
			const finalizedSearchMatches = (0, react.useMemo)(() => searchMatches(finalized.turns, searchQuery), [finalized, searchQuery]);
			const partialSearchTurns = (0, react.useMemo)(() => appendTrajectoryPartialLayout([], partial, finalized.lastIndex), [finalized.lastIndex, partial]);
			const streamingCells = (0, react.useMemo)(() => partialSearchTurns.flatMap((turn) => turn.groups.flatMap((group) => group.cells)), [partialSearchTurns]);
			const partialSearchMatches = (0, react.useMemo)(() => searchMatches(partialSearchTurns, searchQuery), [partialSearchTurns, searchQuery]);
			const searchMatchIndexes = (0, react.useMemo)(() => mergeSearchMatches(finalizedSearchMatches, partialSearchMatches), [finalizedSearchMatches, partialSearchMatches]);
			const timelineRange = timelineSelection?.branchKey === currentBranch.key ? timelineSelection.range : null;
			const timelineFocusIndexes = (0, react.useMemo)(() => timelineRange === null ? null : trajectoryTimelineFocusIndexes(timelineTurns, timelineRange, timelineMode), [
				timelineMode,
				timelineRange,
				timelineTurns
			]);
			const handleRecordSelect = (0, react.useCallback)((index) => {
				if (timelineFocusIndexes !== null && !timelineFocusIndexes.has(index)) setTimelineSelection(null);
			}, [timelineFocusIndexes]);
			const handleTimelineRangeChange = (0, react.useCallback)((range) => {
				setTimelineSelection(range === null ? null : {
					branchKey: currentBranch.key,
					range
				});
			}, [currentBranch.key]);
			const handleTimelineRecordSelect = (0, react.useCallback)((index) => {
				setTimelineSelection(null);
				setTimelineRecordSelection({ index });
				setSelectedTimelineIndex(index);
			}, []);
			const handleTimelineRecordFocus = (0, react.useCallback)((index) => {
				setTimelineRecordFocus({ index });
			}, []);
			const collapsibleTurnIds = (0, react.useMemo)(() => timelineTurns.filter((turn) => turn.turn !== null && turn.groups.reduce((count, group) => count + group.cells.filter((cell) => cell.requestOnly !== true && cell.kind !== "system").length, 0) > 1).flatMap((turn) => turn.turn === null ? [] : [turn.turn]), [timelineTurns]);
			const allTurnsCollapsed = collapsibleTurnIds.length > 0 && collapsibleTurnIds.every((turn) => collapsedTurns.has(turn));
			const collapsibleAssistantIds = (0, react.useMemo)(() => {
				const ids = [];
				for (const turn of timelineTurns) {
					const cells = turn.groups.flatMap((group) => group.cells);
					for (let i = 0; i < cells.length; i++) {
						const cell = cells[i];
						if (cell?.kind !== "message") continue;
						const next = cells[i + 1];
						if (next?.kind === "tool" || next?.kind === "subtool") ids.push(trajectoryRecordId(cell));
					}
				}
				return ids;
			}, [timelineTurns]);
			const allAssistantsCollapsed = collapsibleAssistantIds.length > 0 && collapsibleAssistantIds.every((index) => collapsedAssistants.has(index));
			const toggleTurn = (turn) => {
				setCollapsedTurns((current) => {
					const collapsed = new Set(current);
					if (collapsed.has(turn)) collapsed.delete(turn);
					else collapsed.add(turn);
					return collapsed;
				});
			};
			const toggleAllTurns = () => {
				setCollapsedTurns((current) => {
					const collapsed = new Set(current);
					if (allTurnsCollapsed) for (const turn of collapsibleTurnIds) collapsed.delete(turn);
					else for (const turn of collapsibleTurnIds) collapsed.add(turn);
					return collapsed;
				});
			};
			const toggleAssistant = (id) => {
				setCollapsedAssistants((current) => {
					const collapsed = new Set(current);
					if (collapsed.has(id)) collapsed.delete(id);
					else collapsed.add(id);
					return collapsed;
				});
			};
			const toggleAllAssistants = () => {
				setCollapsedAssistants((current) => {
					const collapsed = new Set(current);
					if (allAssistantsCollapsed) for (const index of collapsibleAssistantIds) collapsed.delete(index);
					else for (const index of collapsibleAssistantIds) collapsed.add(index);
					return collapsed;
				});
			};
			const loadEarlierHistory = (0, react.useCallback)(() => {
				const signal = historyControllerRef.current?.signal;
				return signal?.aborted === false ? loadOlderHistory(signal) : Promise.resolve(false);
			}, [loadOlderHistory]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: views_module_css_default.root,
				"data-conversation-composer-overlay": "",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TrajectoryToolbar, {
						actualDuration,
						onActualDurationChange: (nextActualDuration) => {
							setActualDuration(nextActualDuration);
							setTimelineSelection(null);
						},
						actualTime,
						onActualTimeChange: (nextActualTime) => {
							setActualTime(nextActualTime);
							setTimelineSelection(null);
						},
						allTurnsCollapsed,
						onToggleAllTurns: toggleAllTurns,
						allAssistantsCollapsed,
						onToggleAllAssistants: toggleAllAssistants,
						searchQuery,
						onSearchQueryChange: setSearchQuery
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TrajectoryTimeline, {
						turns: timelineTurns,
						mode: timelineMode,
						range: timelineRange,
						hasEarlierRecords: hasOlderHistory,
						onLoadEarlier: loadEarlierHistory,
						selectedIndex: selectedTimelineIndex,
						searchMatchIndexes,
						onRangeChange: handleTimelineRangeChange,
						onRecordSelect: handleTimelineRecordSelect,
						onRecordFocus: handleTimelineRecordFocus
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: views_module_css_default.ledger,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TrajectoryTable, {
							requestNumbers,
							turns: timelineTurns,
							streamingCells,
							timelineFocusIndexes,
							searchMatchIndexes,
							onSelectedIndexChange: setSelectedTimelineIndex,
							onRecordSelect: handleRecordSelect,
							recordSelection: timelineRecordSelection,
							recordFocus: timelineRecordFocus,
							historyLoading,
							historyStartSeq: historyBaseSeq,
							hasOlderRecords: hasOlderHistory,
							onLoadOlder: loadEarlierHistory,
							onClearSelection: () => {
								setTimelineSelection(null);
							},
							collapsedTurns,
							onToggleTurn: toggleTurn,
							collapsedAssistants,
							onToggleAssistant: toggleAssistant,
							inspectCallId: inspect?.callId ?? null,
							onInspectApplied: onInspectDone
						}, currentBranch.key)
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Required services: the conversation view slot and independent history source. */
		const inject = ["slots", "sessionHistory"];
		/**
		* Client plugin body: register the trajectory view tab. The registration
		* rides the slot service's effect wrapper, so plugin unload removes the tab.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const duration = createTrajectoryDurationStore();
			ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "trajectory",
				order: 10,
				label: "Trajectory",
				inject: (sessionId) => {
					const history = ctx.sessionHistory.source(sessionId);
					return {
						hooks: {
							history,
							duration
						},
						loadHistoryTail: (signal) => history.loadTail(signal),
						loadOlderHistory: (signal) => history.loadOlder(signal),
						setActualDuration: (value) => {
							duration.set(value);
						}
					};
				}
			}, TrajectoryView));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map