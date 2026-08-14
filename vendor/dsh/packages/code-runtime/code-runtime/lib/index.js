import { Service } from "cordis";
//#region lib/types/index.js
/**
* Code-execution seam for running one model-written program against host async bindings.
* Runtimes know nothing about tools or sessions; consumers own those concerns.
* @module @deepseek-ai/dsh-code-runtime
*/
/**
* Registers one `ctx.codeRuntime` implementation. Program, budget, abort, and substrate
* failures resolve in {@link CodeRunResult}; only seam misuse rejects. Implementations bridge
* structured-cloneable bindings, materialize each declared namespace rejection
* class, treat programs as hostile peers, isolate runs from one another, and
* terminate and await in-flight runs during disposal.
*/
var CodeRuntime = class extends Service {
	constructor(ctx) {
		super(ctx, "codeRuntime");
	}
};
//#endregion
export { CodeRuntime, CodeRuntime as default };
