/**
 * Model-facing `ask_user_question` tool over the `ctx.userInteraction` seam.
 * The tool pauses until a UI provider returns a human answer, then feeds that
 * answer back into the agent loop as an ordinary tool result.
 *
 * @module @deepseek-ai/dsh-tool-ask-user
 */
import type { Context } from 'cordis';
import '@deepseek-ai/dsh-user-interaction';
export declare const name = "tool-ask-user";
export declare const inject: string[];
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map