import { Service } from "cordis";
import { HarnessError } from "@deepseek-ai/dsh-llm";
//#region lib/types/index.js
/**
* User-interaction seam (`ctx.userInteraction`): a UI-backed service for
* pausing an agent tool call until the human answers a question. The model-
* facing tool lives in `@deepseek-ai/dsh-tool-ask-user`; UI packages provide
* the single active provider.
*
* @module @deepseek-ai/dsh-user-interaction
*/
/** Stable error taxonomy for user-interaction failures. */
var UserInteractionError = class extends HarnessError {
	constructor(message, code, options) {
		super(message, code, options);
		this.name = "UserInteractionError";
	}
};
/** `ctx.userInteraction`: one active UI provider plus an `ask()` surface. */
var UserInteractionService = class extends Service {
	provider;
	constructor(ctx) {
		super(ctx, "userInteraction");
	}
	/**
	* Register the UI provider. Only one provider may be active in a context.
	*
	* @param provider UI-side implementation that collects answers.
	* @returns Disposer that unregisters this provider.
	*/
	registerProvider(provider) {
		const dispose = this.ctx.effect(function* () {
			if (this.provider !== void 0) throw new UserInteractionError("a user-interaction provider is already registered", "DUPLICATE_PROVIDER");
			this.provider = provider;
			yield () => {
				this.provider = void 0;
			};
		}.bind(this), "userInteraction.registerProvider()");
		return () => {
			dispose();
		};
	}
	/**
	* Ask the active UI provider and wait for the user's answer.
	*
	* @param request Questions, owner agent, and abort signal.
	* @returns The answer chosen or typed by the human.
	*/
	async ask(request) {
		if (request.signal?.aborted) throw new UserInteractionError("ask_user_question was aborted before the user answered", "ASK_ABORTED");
		if (request.questions.length === 0) throw new UserInteractionError("ask_user_question requires at least one question", "EMPTY_QUESTIONS");
		for (const question of request.questions) {
			const intent = question.intent;
			if (intent === void 0) continue;
			if (!(question.options ?? []).some((option) => option.label === intent.approve)) throw new UserInteractionError(`question ${question.id} declares intent ${intent.kind} whose approve label ${JSON.stringify(intent.approve)} names none of its options`, "BAD_INTENT");
			if (question.detail === void 0) throw new UserInteractionError(`question ${question.id} declares intent ${intent.kind} without the detail it reviews`, "BAD_INTENT");
		}
		if (this.provider === void 0) throw new UserInteractionError("no user-interaction provider is registered", "NO_PROVIDER");
		return this.provider.ask(request);
	}
};
//#endregion
export { UserInteractionError, UserInteractionService, UserInteractionService as default };
