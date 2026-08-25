/**
 * Host-side deck planning. Prompt text is copied from
 * upstream/apps/slides/src/renderer/ai/local-page-gen.ts
 * (`pageSpecSystemPrompt`, `pageSpecUserMessage`, `PLAN_DECK_SYSTEM_PROMPT`,
 * `STYLE_SKILL_SYSTEM_PROMPT`, `styleSkillUserMessage`, `planDeckUserMessage`).
 * Do not import the slides renderer (ASM-005).
 */
export declare const SPEC_CANVAS_W = 1280;
export declare const SPEC_CANVAS_H = 720;
export type HostLlmOnce = (system: string, user: string, signal: AbortSignal, maxTokens?: number) => Promise<string>;
export declare const DEFAULT_STYLE = "Main background: #16395C\nMain text color: #FFFFFF\nPrimary accent: #3DDC97\nSecondary accent: #F4D35E\nOverall style: dark professional typography-first slide.";
export interface PageSpecLike {
    background?: string;
    elements: Array<Record<string, unknown>>;
}
export interface OutlinePage {
    title: string;
    type?: string;
    brief: string;
    layout: string;
    image_queries?: string[];
}
export interface DeckOutline {
    core_hook: string;
    pages: OutlinePage[];
}
export declare function pageSpecSystemPrompt(canvasW: number, canvasH: number): string;
export declare function pageSpecUserMessage(args: {
    style: string;
    topic?: string;
    coreHook: string;
    pageIndex: number;
    totalPages: number;
    title: string;
    layout: string;
    brief: string;
    images: string[];
    context?: string;
}): string;
export declare const STYLE_SKILL_SYSTEM_PROMPT: string;
export declare function styleSkillUserMessage(a: {
    topic: string;
    styleHint?: string;
    questionnaire?: string;
}): string;
export declare const PLAN_DECK_SYSTEM_PROMPT: string;
export declare function planDeckUserMessage(a: {
    topic: string;
    context?: string;
    styleSkill?: string;
    count: number;
}): string;
export declare function extractJsonText(raw: string): string | undefined;
export declare function isPageSpecLike(v: unknown): v is PageSpecLike;
export declare function parsePageSpecLike(raw: string): {
    ok: true;
    spec: PageSpecLike;
} | {
    ok: false;
    error: string;
};
export declare function pageSpecFromOutline(page: OutlinePage, coreHook: string, cover: boolean): PageSpecLike;
export declare function parseOutline(raw: string): {
    ok: true;
    outline: DeckOutline;
} | {
    ok: false;
    error: string;
};
export declare function coercePagesSpec(value: unknown): PageSpecLike[] | undefined;
export declare function httpImagesFrom(value: unknown): string[];
export declare function planDeckPages(input: Record<string, unknown>, run: HostLlmOnce, signal: AbortSignal): Promise<PageSpecLike[]>;
export declare function planOnePageSpec(input: Record<string, unknown>, run: HostLlmOnce, signal: AbortSignal): Promise<PageSpecLike>;
//# sourceMappingURL=page-plan.d.ts.map