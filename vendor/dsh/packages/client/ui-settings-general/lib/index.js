import z from "schemastery";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
//#region lib/types/onboarding-copy.js
/** Durable settings namespace for product-wide GUI onboarding facts. */
const WELCOME_NOTICE_SETTINGS_NAMESPACE = "ui-onboarding";
/** Field storing the last welcome notice version the user acknowledged. */
const WELCOME_NOTICE_ACK_FIELD = "welcomeNoticeVersion";
/**
* Bump only when the notice changes materially and every user should see it
* again. The acknowledgement is compared for exact equality.
*/
const WELCOME_NOTICE_VERSION = "2026-07-30.7";
/** The complete editable welcome notice in both supported GUI locales. */
const WELCOME_NOTICE_COPY = {
	zh: {
		title: "内测声明",
		paragraphs: [
			"感谢您愿意拨冗试用 DeepSeek Harness。当前版本仍处于内部测试阶段，功能仍待完善，体验难免有些粗糙。",
			"“如切如磋，如琢如磨。” 产品的成长，离不开一次次真实的碰撞与坦诚的反馈。您在真实使用中发现的问题，也可能促使我们重新审视，甚至推翻已有的设计。",
			"为了帮助我们更准确地还原您真实使用中的问题，内测版本默认会上传所有 Session Log；如需关闭，可以设置环境变量 DSH_TELEMETRY_DISABLED=1。另外，如果您有任何反馈与建议，请在企业微信群中留言告诉我们。每一条反馈，都会帮助我们把它打磨得更好。"
		],
		feedbackEmphasis: "如果您有任何反馈与建议，请在企业微信群中留言告诉我们",
		continueLabel: "继续"
	},
	en: {
		title: "内测声明",
		paragraphs: [
			"感谢您愿意拨冗试用 DeepSeek Harness。当前版本仍处于内部测试阶段，功能仍待完善，体验难免有些粗糙。",
			"“如切如磋，如琢如磨。” 产品的成长，离不开一次次真实的碰撞与坦诚的反馈。您在真实使用中发现的问题，也可能促使我们重新审视，甚至推翻已有的设计。",
			"为了帮助我们更准确地还原您真实使用中的问题，内测版本默认会上传所有 Session Log；如需关闭，可以设置环境变量 DSH_TELEMETRY_DISABLED=1。另外，如果您有任何反馈与建议，请在企业微信群中留言告诉我们。每一条反馈，都会帮助我们把它打磨得更好。"
		],
		feedbackEmphasis: "如果您有任何反馈与建议，请在企业微信群中留言告诉我们",
		continueLabel: "继续"
	}
};
//#endregion
//#region lib/types/index.js
/** Host loader entry for the browser implementation exported from `./client`. */
const OnboardingSettingsSchema = z.object({ [WELCOME_NOTICE_ACK_FIELD]: z.string() });
/** Register the durable GUI-onboarding section when a settings provider exists. */
function apply(ctx) {
	ctx.inject(["settings"], (settingsCtx) => {
		settingsCtx.settings.register(settingsNamespace(WELCOME_NOTICE_SETTINGS_NAMESPACE), OnboardingSettingsSchema);
	});
}
//#endregion
export { WELCOME_NOTICE_ACK_FIELD, WELCOME_NOTICE_COPY, WELCOME_NOTICE_SETTINGS_NAMESPACE, WELCOME_NOTICE_VERSION, apply };
