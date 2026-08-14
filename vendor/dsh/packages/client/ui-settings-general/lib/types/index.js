/** Host loader entry for the browser implementation exported from `./client`. */
import z from 'schemastery';
import { settingsNamespace } from '@deepseek-ai/dsh-settings';
import { WELCOME_NOTICE_ACK_FIELD, WELCOME_NOTICE_SETTINGS_NAMESPACE, } from "./onboarding-copy.js";
export { WELCOME_NOTICE_ACK_FIELD, WELCOME_NOTICE_COPY, WELCOME_NOTICE_SETTINGS_NAMESPACE, WELCOME_NOTICE_VERSION, } from "./onboarding-copy.js";
const OnboardingSettingsSchema = z.object({
    [WELCOME_NOTICE_ACK_FIELD]: z.string(),
});
/** Register the durable GUI-onboarding section when a settings provider exists. */
export function apply(ctx) {
    ctx.inject(['settings'], (settingsCtx) => {
        settingsCtx.settings.register(settingsNamespace(WELCOME_NOTICE_SETTINGS_NAMESPACE), OnboardingSettingsSchema);
    });
}
//# sourceMappingURL=index.js.map