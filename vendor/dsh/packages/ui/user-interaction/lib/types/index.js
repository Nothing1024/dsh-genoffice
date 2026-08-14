/**
 * User-interaction seam (`ctx.userInteraction`): a UI-backed service for
 * pausing an agent tool call until the human answers a question. The model-
 * facing tool lives in `@deepseek-ai/dsh-tool-ask-user`; UI packages provide
 * the single active provider.
 *
 * @module @deepseek-ai/dsh-user-interaction
 */
import { Service } from 'cordis';
import { HarnessError } from '@deepseek-ai/dsh-llm';
/** Stable error taxonomy for user-interaction failures. */
export class UserInteractionError extends HarnessError {
    constructor(message, code, options) {
        super(message, code, options);
        this.name = 'UserInteractionError';
    }
}
/** `ctx.userInteraction`: one active UI provider plus an `ask()` surface. */
export class UserInteractionService extends Service {
    provider;
    constructor(ctx) {
        super(ctx, 'userInteraction');
    }
    /**
     * Register the UI provider. Only one provider may be active in a context.
     *
     * @param provider UI-side implementation that collects answers.
     * @returns Disposer that unregisters this provider.
     */
    registerProvider(provider) {
        const dispose = this.ctx.effect(function* () {
            if (this.provider !== undefined) {
                throw new UserInteractionError('a user-interaction provider is already registered', 'DUPLICATE_PROVIDER');
            }
            this.provider = provider;
            yield () => {
                this.provider = undefined;
            };
        }.bind(this), 'userInteraction.registerProvider()');
        return () => { return void dispose(); };
    }
    /**
     * Ask the active UI provider and wait for the user's answer.
     *
     * @param request Questions, owner agent, and abort signal.
     * @returns The answer chosen or typed by the human.
     */
    async ask(request) {
        if (request.signal?.aborted) {
            throw new UserInteractionError('ask_user_question was aborted before the user answered', 'ASK_ABORTED');
        }
        if (request.questions.length === 0) {
            throw new UserInteractionError('ask_user_question requires at least one question', 'EMPTY_QUESTIONS');
        }
        // A presentation intent asserts two things the types cannot: that the
        // named approve label is one of this question's own options, and that a
        // plan-review carries the plan it is a review of. A UI honouring the
        // intent answers with that label, and shows that detail as the plan, so
        // either gap would put a choice the asker never offered — or an approval of
        // something invisible — in front of the user. Caught at the asker, where
        // the mistake is, rather than in each UI.
        for (const question of request.questions) {
            const intent = question.intent;
            if (intent === undefined)
                continue;
            if (!(question.options ?? []).some(option => option.label === intent.approve)) {
                throw new UserInteractionError(`question ${question.id} declares intent ${intent.kind} whose approve label `
                    + `${JSON.stringify(intent.approve)} names none of its options`, 'BAD_INTENT');
            }
            if (question.detail === undefined) {
                throw new UserInteractionError(`question ${question.id} declares intent ${intent.kind} without the detail it reviews`, 'BAD_INTENT');
            }
        }
        if (this.provider === undefined) {
            throw new UserInteractionError('no user-interaction provider is registered', 'NO_PROVIDER');
        }
        return this.provider.ask(request);
    }
}
export default UserInteractionService;
//# sourceMappingURL=index.js.map