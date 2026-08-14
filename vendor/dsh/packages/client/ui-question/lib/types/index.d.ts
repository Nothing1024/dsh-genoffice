/**
 * Web question plugin, node half: enabling this UI feature also exposes the
 * model-facing ask_user_question tool on the host composition.
 */
import type { Context } from 'cordis';
/** Host services required by the model-facing tool. */
export declare const inject: string[];
/**
 * Mount ask_user_question for hosts that selected the Web question plugin.
 * @param ctx - Host plugin context carrying tools and userInteraction.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map