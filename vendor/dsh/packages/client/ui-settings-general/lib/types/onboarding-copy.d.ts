/** Durable settings namespace for product-wide GUI onboarding facts. */
export declare const WELCOME_NOTICE_SETTINGS_NAMESPACE = "ui-onboarding";
/** Field storing the last welcome notice version the user acknowledged. */
export declare const WELCOME_NOTICE_ACK_FIELD = "welcomeNoticeVersion";
/**
 * Bump only when the notice changes materially and every user should see it
 * again. The acknowledgement is compared for exact equality.
 */
export declare const WELCOME_NOTICE_VERSION = "2026-07-30.7";
/** The complete editable welcome notice in both supported GUI locales. */
export declare const WELCOME_NOTICE_COPY: {
    readonly zh: {
        readonly title: "内测声明";
        readonly paragraphs: readonly ["感谢您愿意拨冗试用 DeepSeek Harness。当前版本仍处于内部测试阶段，功能仍待完善，体验难免有些粗糙。", "“如切如磋，如琢如磨。” 产品的成长，离不开一次次真实的碰撞与坦诚的反馈。您在真实使用中发现的问题，也可能促使我们重新审视，甚至推翻已有的设计。", "为了帮助我们更准确地还原您真实使用中的问题，内测版本默认会上传所有 Session Log；如需关闭，可以设置环境变量 DSH_TELEMETRY_DISABLED=1。另外，如果您有任何反馈与建议，请在企业微信群中留言告诉我们。每一条反馈，都会帮助我们把它打磨得更好。"];
        readonly feedbackEmphasis: "如果您有任何反馈与建议，请在企业微信群中留言告诉我们";
        readonly continueLabel: "继续";
    };
    readonly en: {
        readonly title: "内测声明";
        readonly paragraphs: readonly ["感谢您愿意拨冗试用 DeepSeek Harness。当前版本仍处于内部测试阶段，功能仍待完善，体验难免有些粗糙。", "“如切如磋，如琢如磨。” 产品的成长，离不开一次次真实的碰撞与坦诚的反馈。您在真实使用中发现的问题，也可能促使我们重新审视，甚至推翻已有的设计。", "为了帮助我们更准确地还原您真实使用中的问题，内测版本默认会上传所有 Session Log；如需关闭，可以设置环境变量 DSH_TELEMETRY_DISABLED=1。另外，如果您有任何反馈与建议，请在企业微信群中留言告诉我们。每一条反馈，都会帮助我们把它打磨得更好。"];
        readonly feedbackEmphasis: "如果您有任何反馈与建议，请在企业微信群中留言告诉我们";
        readonly continueLabel: "继续";
    };
};
//# sourceMappingURL=onboarding-copy.d.ts.map