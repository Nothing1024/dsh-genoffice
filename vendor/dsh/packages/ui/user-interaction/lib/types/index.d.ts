/**
 * User-interaction seam (`ctx.userInteraction`): a UI-backed service for
 * pausing an agent tool call until the human answers a question. The model-
 * facing tool lives in `@deepseek-ai/dsh-tool-ask-user`; UI packages provide
 * the single active provider.
 *
 * @module @deepseek-ai/dsh-user-interaction
 */
import { Context, Service } from 'cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { HarnessError } from '@deepseek-ai/dsh-llm';
declare module 'cordis' {
    interface Context {
        userInteraction: UserInteractionService;
    }
}
import type { AskUserQuestionAnswer, AskUserQuestionItem } from './types.ts';
export type { AskUserQuestionAnswer, AskUserQuestionAnswerItem, AskUserQuestionIntent, AskUserQuestionItem, AskUserQuestionOption, } from './types.ts';
/** Request for a human answer. */
export interface AskUserQuestionRequest {
    /** Questions to display. */
    questions: AskUserQuestionItem[];
    /** Calling agent, when the request came from an agent tool call. */
    agent?: Agent;
    /** Abort signal for the owning tool/step. */
    signal?: AbortSignal;
}
/** UI-side provider for user questions. */
export interface UserInteractionProvider {
    ask(request: AskUserQuestionRequest): Promise<AskUserQuestionAnswer>;
}
/** Stable error taxonomy for user-interaction failures. */
export declare class UserInteractionError extends HarnessError {
    constructor(message: string, code: string, options?: ErrorOptions);
}
/** `ctx.userInteraction`: one active UI provider plus an `ask()` surface. */
export declare class UserInteractionService extends Service {
    private provider;
    constructor(ctx: Context);
    /**
     * Register the UI provider. Only one provider may be active in a context.
     *
     * @param provider UI-side implementation that collects answers.
     * @returns Disposer that unregisters this provider.
     */
    registerProvider(provider: UserInteractionProvider): () => void;
    /**
     * Ask the active UI provider and wait for the user's answer.
     *
     * @param request Questions, owner agent, and abort signal.
     * @returns The answer chosen or typed by the human.
     */
    ask(request: AskUserQuestionRequest): Promise<AskUserQuestionAnswer>;
}
export default UserInteractionService;
//# sourceMappingURL=index.d.ts.map