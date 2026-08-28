import { a as HOST_OPTIONAL, c as SYSTEM_PROMPT, d as lookupSkills, f as lookupSystemPrompt, i as runFacet, l as TOOL_REGISTRY, n as coordKey, o as HOST_REQUIRED, p as lookupWebServer, r as createActivation, s as SKILL_REGISTRY, t as host_default, u as WEB_SERVER } from "./host-BbLMRrIh.js";
//#region src/standard/cordis-acquire.ts
/**
* 构造一个 ServiceAcquire：
* - 服务已到位（lookup 命中）→ 立即经 ctx.effect 挂载（disposer 归 fiber）；
* - 未到位 → ctx.inject 等服务出现，出现后在子 ctx 的 effect 里挂载；
* - 部署里永远不出现 → mount 一次都不跑（声明过的降级路径）。
* acquire 返回的取消函数可提前卸载；与 fiber 卸载互为幂等。
*/
function acquireFromCordis(ctx, lookup, serviceName, label = `dsh-tab-genoffice: acquire ${serviceName}`) {
	return (mount) => {
		let cancelled = false;
		let unmount;
		const runMount = (service) => {
			if (cancelled) return () => {};
			const off = mount(service);
			unmount = () => {
				unmount = void 0;
				off();
			};
			return () => {
				unmount?.();
			};
		};
		const existing = lookup();
		if (existing !== void 0) ctx.effect(() => runMount(existing), label);
		else ctx.inject([serviceName], (child) => {
			const service = child[serviceName];
			const effect = child.effect;
			if (typeof effect === "function") effect.call(child, () => runMount(service), label);
			else runMount(service);
		});
		return () => {
			cancelled = true;
			unmount?.();
		};
	};
}
//#endregion
//#region src/standard/cordis-host-adapter.ts
function createHostActivation(ctx) {
	const cordis = ctx;
	const systemPrompt = { section: (spec) => acquireFromCordis(cordis, () => lookupSystemPrompt(ctx), "systemPrompt")((sp) => sp.section(spec)) };
	const skills = { register: (skill) => acquireFromCordis(cordis, () => lookupSkills(ctx), "skills")((service) => service.register(skill)) };
	const webServer = { acquire: acquireFromCordis(cordis, () => lookupWebServer(ctx), "webServer") };
	const registerTool = (_id, implementation) => {
		const off = ctx.tools.register(implementation);
		return typeof off === "function" ? off : void 0;
	};
	return createActivation({
		declared: [...HOST_REQUIRED, ...HOST_OPTIONAL],
		contracts: /* @__PURE__ */ new Map([
			[coordKey(SYSTEM_PROMPT), systemPrompt],
			[coordKey(SKILL_REGISTRY), skills],
			[coordKey(WEB_SERVER), webServer]
		]),
		publishTargets: /* @__PURE__ */ new Map([[coordKey(TOOL_REGISTRY), registerTool]]),
		onScopeAdd: (dispose) => {
			cordis.effect(() => () => {
				dispose();
			}, "dsh-tab-genoffice: standard scope");
		}
	});
}
//#endregion
//#region src/index.ts
/** Plugin name (host half). */
const name = "dsh-tab-genoffice";
/** Required services: the host tool registry. webServer / systemPrompt / skills are nested. */
const inject = ["tools"];
/**
* Plugin host body.
* @param ctx - host root context.
*/
function apply(ctx) {
	runFacet(host_default, createHostActivation(ctx).activation);
}
//#endregion
export { apply, inject, name };
