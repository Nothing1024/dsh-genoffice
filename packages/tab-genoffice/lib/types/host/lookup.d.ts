/**
 * External profile plugins do not share the web-app isolate map, so
 * `ctx.inject(['webServer'])` stays PENDING and `ctx.webServer` throws.
 * The reflect store is process-wide; look up by shape.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm/types';
export interface LlmStreamService {
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    listProviders(): unknown;
}
export declare function lookupService<T>(ctx: Context, pred: (value: unknown) => value is T): T | undefined;
export declare function lookupWebServer(ctx: Context): Context['webServer'] | undefined;
export declare function lookupSystemPrompt(ctx: Context): Context['systemPrompt'] | undefined;
/** Host skill registry. Isolated profile plugins cannot `inject(['skills'])` at top level. */
export interface SkillsService {
    register(skill: {
        name: string;
        description: string;
        content: string;
        source: string;
    }): () => void;
}
export declare function lookupSkills(ctx: Context): SkillsService | undefined;
export declare function lookupLlm(ctx: Context): LlmStreamService | undefined;
//# sourceMappingURL=lookup.d.ts.map