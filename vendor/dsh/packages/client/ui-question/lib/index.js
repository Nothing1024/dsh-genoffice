import * as toolAskUser from "@deepseek-ai/dsh-tool-ask-user";
//#region lib/types/index.js
/** Host services required by the model-facing tool. */
const inject = ["tools", "userInteraction"];
/**
* Mount ask_user_question for hosts that selected the Web question plugin.
* @param ctx - Host plugin context carrying tools and userInteraction.
*/
function apply(ctx) {
	toolAskUser.apply(ctx);
}
//#endregion
export { apply, inject };
