import { Service } from "cordis";
import z from "schemastery";
//#region lib/types/index.js
/**
* Agent skill provider registry.
*
* This package is the interface third of the skill capability seam. Concrete
* providers such as `@deepseek-ai/dsh-skill-local` decide where skills come
* from; this service only merges provider catalogs, resolves the winning skill
* for a name, and exposes the winning summaries and definitions to consumers.
*
* @module @deepseek-ai/dsh-skill
*/
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_COLLECT_CACHE_ENTRIES = 128;
const MAX_COLLECT_ATTEMPTS = 2;
const RUNTIME_PROVIDER = "runtime";
const RUNTIME_RANK = 250;
/**
* Return whether a string is a valid kebab-case skill name.
* @param name - candidate skill name to validate.
* @returns whether the name matches the public skill-name grammar.
*/
function isSkillName(name) {
	return SKILL_NAME.test(name);
}
/**
* Return whether a skill may be advertised to and loaded by a model.
* @param skill - skill metadata carrying resolved invocation controls.
* @returns whether the policy permits model invocation.
*/
function isModelInvocable(skill) {
	return skill.invocation.modelInvocable;
}
/**
* Return whether a skill may be advertised to and loaded by a human-facing command.
* @param skill - skill metadata carrying resolved invocation controls.
* @returns whether the policy permits user invocation.
*/
function isUserInvocable(skill) {
	return skill.invocation.userInvocable;
}
/**
* Registry of skill providers. It merges provider catalogs with stable
* first-wins duplicate handling, exposes sorted invocation-neutral summaries, and
* loads full skill bodies on demand.
*/
var SkillService = class extends Service {
	static Config = z.object({ collectCacheMaxEntries: z.number().default(DEFAULT_COLLECT_CACHE_ENTRIES) });
	collectCacheMaxEntries;
	providers = /* @__PURE__ */ new Map();
	runtime = /* @__PURE__ */ new Map();
	collectCache = /* @__PURE__ */ new Map();
	providerRevision = 0;
	nextProviderOrder = 0;
	runtimeRevision = 0;
	constructor(ctx, config = {}) {
		super(ctx, "skills");
		this.collectCacheMaxEntries = config.collectCacheMaxEntries ?? DEFAULT_COLLECT_CACHE_ENTRIES;
		assertPositiveInteger("collectCacheMaxEntries", this.collectCacheMaxEntries);
	}
	/**
	* Register a borrowed same-process provider synchronously during plugin apply. Duplicate and
	* reserved names throw; remote initialization belongs in `list()`. Fiber disposal unregisters
	* the provider and invalidates catalog caches.
	* @param create - synchronous factory receiving this registration's lifecycle and invalidation control.
	* @returns the exact Cordis effect disposer that unregisters this provider;
	*   composite effects may yield it directly to preserve teardown ordering.
	*/
	registerProvider(create) {
		const lifecycle = new AbortController();
		let active = false;
		let provider;
		const control = {
			signal: lifecycle.signal,
			invalidate: () => {
				if (active) this.invalidateProvider(provider);
			}
		};
		try {
			provider = create(control);
			const name = provider.name;
			if (name === RUNTIME_PROVIDER) throw new Error(`"${RUNTIME_PROVIDER}" is reserved for runtime skill registrations`);
			if (this.providers.has(name)) throw new Error(`a skill provider named "${name}" is already registered`);
			const providers = this.providers;
			const order = this.nextProviderOrder;
			const invalidateCache = () => {
				this.invalidateCache();
			};
			this.nextProviderOrder += 1;
			return this.ctx.effect(function* () {
				active = true;
				providers.set(name, {
					provider,
					order
				});
				invalidateCache();
				yield () => {
					active = false;
					providers.delete(name);
					lifecycle.abort(/* @__PURE__ */ new Error(`skill provider "${name}" disposed`));
					invalidateCache();
				};
			}, "skills.registerProvider()");
		} catch (error) {
			lifecycle.abort(error);
			throw error;
		}
	}
	/**
	* Register a borrowed readonly runtime skill. Project entries outrank runtime entries, which
	* outrank user entries. Same-name runtime entries are first-wins; a duplicate logs a warning and
	* receives a no-op disposer so it cannot remove the winner.
	* @param skill - the skill definition input; omitted invocation and provider fields receive defaults.
	* @returns the exact Cordis effect disposer, preserving composite teardown order and invalidating caches.
	*/
	register(skill) {
		validateRuntimeSkill(skill);
		if (this.runtime.get(skill.name) !== void 0) {
			this.ctx.logger.warn(`runtime skill "${skill.name}" ignored because it is already registered`);
			return () => {};
		}
		const definition = {
			...skill,
			invocation: skill.invocation ?? {
				modelInvocable: true,
				userInvocable: true
			},
			provider: skill.provider ?? RUNTIME_PROVIDER
		};
		const runtime = this.runtime;
		const updateRevision = () => {
			this.runtimeRevision += 1;
		};
		const invalidateCache = () => {
			this.invalidateCache();
		};
		return this.ctx.effect(function* () {
			runtime.set(definition.name, definition);
			updateRevision();
			invalidateCache();
			yield () => {
				runtime.delete(definition.name);
				updateRevision();
				invalidateCache();
			};
		}, "skills.register()");
	}
	/**
	* List invocation-neutral skill summaries for a workspace. Consumers apply
	* model or user invocation policy at their operational boundary. Lookup
	* options and provider candidates are readonly same-process values borrowed
	* throughout discovery.
	* @param options - lookup options; `cwd` selects project roots and `signal` cancels discovery.
	* @returns all sorted winning summaries.
	*/
	async list(options = {}) {
		return (await this.snapshot(options)).skills;
	}
	/**
	* Observe the current invocation-neutral catalog and whether discovery completed within a stable revision.
	* Incomplete observations are never cached, allowing consumers to retain last-good state and
	* retry on their next request boundary.
	* @param options - lookup options; `cwd` selects project roots and `signal` cancels discovery.
	* @returns sorted summaries plus discovery-completeness state.
	*/
	async snapshot(options = {}) {
		const collected = await this.collect(options);
		return {
			skills: collected.entries.map((entry) => entry.candidate).map(toSummary).sort(compareSkillSummary),
			complete: collected.cacheable
		};
	}
	/**
	* Load and validate the winning candidate, passing its opaque discovery locator back to the
	* provider. Cancellation is rechecked after selection, including cache hits, and raced against
	* loading so an uncooperative provider cannot hang the caller.
	* @param name - kebab-case skill name.
	* @param options - lookup options; `cwd` selects workspace-sensitive skills and `signal` cancels work.
	* @returns the full skill, including body content, or `undefined`.
	*/
	async get(name, options = {}) {
		if (!isSkillName(name)) return void 0;
		const collected = await this.collect(options);
		throwIfAborted(options.signal);
		const match = collected.entries.find((entry) => entry.candidate.name === name);
		if (match === void 0) return;
		const definition = await waitWithAbort(match.provider.get(match.candidate, options), options.signal);
		if (definition === void 0) return void 0;
		validateDefinition(definition);
		if (definition.name !== match.candidate.name) {
			this.invalidateProvider(match.provider);
			return;
		}
		return definition;
	}
	async collect(options) {
		throwIfAborted(options.signal);
		let attempt = 1;
		while (true) {
			const providerRevision = this.providerRevision;
			const runtimeRevision = this.runtimeRevision;
			const key = collectCacheKey(options, providerRevision, runtimeRevision);
			const cached = this.collectCache.get(key);
			if (cached !== void 0) return {
				entries: cached,
				cacheable: true
			};
			const result = await this.collectFresh(options);
			throwIfAborted(options.signal);
			if (providerRevision !== this.providerRevision || runtimeRevision !== this.runtimeRevision) {
				if (attempt < MAX_COLLECT_ATTEMPTS) {
					attempt += 1;
					continue;
				}
				return {
					entries: result.entries,
					cacheable: false
				};
			}
			if (result.cacheable) {
				this.collectCache.set(key, result.entries);
				if (this.collectCache.size > this.collectCacheMaxEntries) {
					const oldest = this.collectCache.keys().next();
					this.collectCache.delete(oldest.value);
				}
			}
			return result;
		}
	}
	async collectFresh(options) {
		const collected = await this.listAllCandidates(options);
		collected.entries.sort(compareIndexedCandidates);
		const seen = /* @__PURE__ */ new Set();
		const result = [];
		for (const entry of collected.entries) {
			const skill = entry.candidate;
			if (seen.has(skill.name)) {
				this.ctx.logger.warn(`skill "${skill.name}" from ${skill.source} ignored because a higher-priority skill already exists`);
				continue;
			}
			seen.add(skill.name);
			result.push(entry);
		}
		return {
			entries: result,
			cacheable: collected.cacheable
		};
	}
	async listAllCandidates(options) {
		throwIfAborted(options.signal);
		const candidates = [];
		let cacheable = true;
		let runtimeOrder = 0;
		for (const skill of [...this.runtime.values()].sort((a, b) => {
			return compareCodePoints(a.name, b.name);
		})) {
			candidates.push({
				candidate: runtimeCandidate(skill),
				provider: RUNTIME_SKILL_PROVIDER,
				providerOrder: -1,
				localOrder: runtimeOrder
			});
			runtimeOrder += 1;
		}
		for (const { provider, order } of [...this.providers.values()]) {
			let localOrder = 0;
			let output;
			try {
				output = await waitWithAbort(provider.list(options), options.signal);
			} catch (error) {
				if (options.signal?.aborted === true) throw toError(options.signal.reason);
				cacheable = false;
				this.ctx.logger.warn(`skill provider "${provider.name}" skipped: ${errorMessage(error)}`);
			}
			if (output === void 0) continue;
			const observation = normalizeProviderObservation(output, provider.name);
			if (!observation.complete) cacheable = false;
			for (const candidate of observation.candidates) {
				validateCandidate(candidate, provider.name);
				candidates.push({
					candidate,
					provider,
					providerOrder: order,
					localOrder
				});
				localOrder += 1;
			}
		}
		return {
			entries: candidates,
			cacheable
		};
	}
	invalidateCache() {
		this.providerRevision += 1;
		this.collectCache.clear();
		this.notifyChange();
	}
	invalidateProvider(provider) {
		/* v8 ignore else -- A definition load can outlive the exact provider registration it selected. */
		if (this.providers.get(provider.name)?.provider === provider) this.invalidateCache();
	}
	/** Notify catalog observers without making their refresh work load-bearing. */
	notifyChange() {
		for (const callback of this.ctx.events.dispatch("emit", ["skills/change"])) try {
			const returned = callback();
			Promise.resolve(returned).catch((error) => {
				this.ctx.logger.warn(`skills/change listener rejected: ${errorMessage(error)}`);
			});
		} catch (error) {
			this.ctx.logger.warn(`skills/change listener threw: ${errorMessage(error)}`);
		}
	}
};
function normalizeProviderObservation(output, providerName) {
	if (Array.isArray(output)) return {
		candidates: output,
		complete: true
	};
	if (output === null || typeof output !== "object") throw invalidProviderObservation(providerName);
	const observation = output;
	if (!Array.isArray(observation.candidates) || typeof observation.complete !== "boolean") throw invalidProviderObservation(providerName);
	return observation;
}
function invalidProviderObservation(providerName) {
	return /* @__PURE__ */ new TypeError(`skill provider "${providerName}" list() must return an array or { candidates, complete } observation`);
}
const RUNTIME_SKILL_PROVIDER = {
	name: RUNTIME_PROVIDER,
	/* v8 ignore next -- Runtime skills are injected directly by the registry; this provider only owns `get()`. */
	list() {
		return Promise.resolve([]);
	},
	get(candidate) {
		return Promise.resolve(candidate.locator);
	}
};
function runtimeCandidate(skill) {
	return {
		name: skill.name,
		description: skill.description,
		...skill.whenToUse !== void 0 ? { whenToUse: skill.whenToUse } : {},
		invocation: skill.invocation,
		source: skill.source,
		provider: skill.provider,
		...skill.resourceBase !== void 0 ? { resourceBase: skill.resourceBase } : {},
		rank: RUNTIME_RANK,
		locator: skill,
		...skill.path !== void 0 ? { path: skill.path } : {},
		...skill.metadata !== void 0 ? { metadata: skill.metadata } : {}
	};
}
function validateCandidate(candidate, providerName) {
	if (typeof candidate.name !== "string") throw new TypeError(`skill provider "${providerName}" returned a non-string skill name`);
	if (!SKILL_NAME.test(candidate.name)) throw new Error(`skill provider "${providerName}" returned invalid skill name "${candidate.name}"`);
	if (typeof candidate.description !== "string") throw new TypeError(`skill provider "${providerName}" returned skill "${candidate.name}" with a non-string description`);
	if (candidate.description.length === 0) throw new Error(`skill provider "${providerName}" returned skill "${candidate.name}" without a description`);
	validateInvocation(candidate.invocation, `skill provider "${providerName}" returned skill "${candidate.name}"`);
	if (candidate.whenToUse !== void 0 && typeof candidate.whenToUse !== "string") throw new TypeError(`skill provider "${providerName}" returned skill "${candidate.name}" with a non-string whenToUse`);
	if (typeof candidate.source !== "string") throw new TypeError(`skill provider "${providerName}" returned skill "${candidate.name}" with a non-string source`);
	if (typeof candidate.rank !== "number" || !Number.isFinite(candidate.rank)) throw new Error(`skill provider "${providerName}" returned skill "${candidate.name}" with an invalid rank`);
	if (typeof candidate.provider !== "string") throw new TypeError(`skill provider "${providerName}" returned skill "${candidate.name}" with a non-string provider`);
	if (candidate.provider !== providerName) throw new Error(`skill provider "${providerName}" returned skill "${candidate.name}" for provider "${candidate.provider}"`);
	if (candidate.path !== void 0 && typeof candidate.path !== "string") throw new TypeError(`skill provider "${providerName}" returned skill "${candidate.name}" with a non-string path`);
}
function validateRuntimeSkill(skill) {
	if (!SKILL_NAME.test(skill.name)) throw new Error(`invalid skill name "${skill.name}"`);
	if (skill.description.length === 0) throw new Error(`skill "${skill.name}" requires a description`);
	validateInvocation(skill.invocation, `runtime skill "${skill.name}"`);
}
/** Validate a definition loaded from a provider-controlled parser or remote source. */
function validateDefinition(skill) {
	const name = skill.name;
	const description = skill.description;
	const whenToUse = skill.whenToUse;
	const invocation = skill.invocation;
	const source = skill.source;
	const provider = skill.provider;
	const content = skill.content;
	const path = skill.path;
	if (typeof name !== "string") throw new TypeError("loaded skill name must be a string");
	if (!SKILL_NAME.test(name)) throw new Error(`loaded skill has invalid name "${name}"`);
	if (typeof description !== "string") throw new TypeError(`loaded skill "${name}" description must be a string`);
	if (description.length === 0) throw new Error(`loaded skill "${name}" requires a description`);
	validateInvocation(invocation, `loaded skill "${name}"`);
	if (whenToUse !== void 0 && typeof whenToUse !== "string") throw new TypeError(`loaded skill "${name}" whenToUse must be a string`);
	if (typeof source !== "string") throw new TypeError(`loaded skill "${name}" source must be a string`);
	if (typeof provider !== "string") throw new TypeError(`loaded skill "${name}" provider must be a string`);
	if (typeof content !== "string") throw new TypeError(`loaded skill "${name}" content must be a string`);
	if (path !== void 0 && typeof path !== "string") throw new TypeError(`loaded skill "${name}" path must be a string`);
}
function toSummary(skill) {
	const { name, description, whenToUse, invocation, source, provider, resourceBase } = skill;
	return {
		name,
		description,
		...whenToUse !== void 0 ? { whenToUse } : {},
		invocation,
		source,
		provider,
		...resourceBase !== void 0 ? { resourceBase } : {}
	};
}
function validateInvocation(invocation, subject) {
	if (invocation === void 0) return;
	if (typeof invocation !== "object" || invocation === null || Array.isArray(invocation)) throw new TypeError(`${subject} with a non-object invocation policy`);
	const policy = invocation;
	if (typeof policy.modelInvocable !== "boolean") throw new TypeError(`${subject} with a non-boolean invocation.modelInvocable`);
	if (typeof policy.userInvocable !== "boolean") throw new TypeError(`${subject} with a non-boolean invocation.userInvocable`);
}
function compareSkillSummary(left, right) {
	return compareCodePoints(left.name, right.name);
}
function compareCodePoints(left, right) {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
function compareIndexedCandidates(left, right) {
	return left.candidate.rank - right.candidate.rank || left.providerOrder - right.providerOrder || left.localOrder - right.localOrder;
}
function assertPositiveInteger(name, value, minimum = 1) {
	if (!Number.isInteger(value) || value < minimum) throw new Error(`skill: ${name} must be an integer greater than or equal to ${minimum}`);
}
function collectCacheKey(options, providerRevision, runtimeRevision) {
	return JSON.stringify({
		cwd: options.cwd,
		providerRevision,
		runtimeRevision
	});
}
function waitWithAbort(promise, signal) {
	if (signal === void 0) return promise;
	throwIfAborted(signal);
	return new Promise((resolve, reject) => {
		const cleanup = () => {
			signal.removeEventListener("abort", onAbort);
		};
		const onAbort = () => {
			cleanup();
			reject(toError(signal.reason));
		};
		signal.addEventListener("abort", onAbort, { once: true });
		promise.then((value) => {
			cleanup();
			resolve(value);
		}, (error) => {
			cleanup();
			reject(toError(error));
		});
	});
}
/** Throw a total Error for an already-aborted lookup. */
function throwIfAborted(signal) {
	if (signal?.aborted === true) throw toError(signal.reason);
}
/** Normalize an arbitrary abort or provider failure without trusting coercion. */
function toError(error) {
	try {
		if (error instanceof Error) return error;
	} catch {}
	return new Error(errorMessage(error));
}
/** Render an arbitrary provider failure without letting coercion escape containment. */
function errorMessage(error) {
	try {
		return String(error);
	} catch {
		return "[unrenderable thrown value]";
	}
}
//#endregion
export { SkillService, SkillService as default, isModelInvocable, isSkillName, isUserInvocable };
