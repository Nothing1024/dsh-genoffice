import * as toolAskUser from '@deepseek-ai/dsh-tool-ask-user';
/** Host services required by the model-facing tool. */
export const inject = ['tools', 'userInteraction'];
/**
 * Mount ask_user_question for hosts that selected the Web question plugin.
 * @param ctx - Host plugin context carrying tools and userInteraction.
 */
export function apply(ctx) {
    toolAskUser.apply(ctx);
}
//# sourceMappingURL=index.js.map