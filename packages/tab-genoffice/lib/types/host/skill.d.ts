/**
 * Runtime skill: control-mode workflow. Lives on ctx.skills, not systemPrompt.
 * Catalog shows name + description; the body loads only after `skill dsh-genoffice`.
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const GENOFFICE_SKILL_NAME = "dsh-genoffice";
/** Catalog text. Do not list “做 PPT / 汇报 PPT” — those would auto-route. Capped at 500. */
export declare const GENOFFICE_SKILL_DESCRIPTION: string;
export declare const GENOFFICE_SKILL_CONTENT: string;
export declare function applySkill(ctx: Context): void;
//# sourceMappingURL=skill.d.ts.map