/**
 * Host tools: GenOffice control plane via relay POST /api/control/<app>/<docId>/…
 *
 * Registration is filtered by CAPABILITY (BR-001 / BR-015). The table lists
 * every control tool (docx 11 + markdown 5 + xlsx 13 + pptx 39 + pdf 21 = 89);
 * a row without a CAPABILITY key is not registered. DSH_GENOFFICE_ALL_TOOLS=1
 * re-opens the filter.
 * Write-back only through *_save and the tab button (BR-011).
 * pptx_generate_deck / pptx_regenerate_slide plan on the session model then
 * land_pages — they must not POST iframe generate_deck / regenerate_slide.
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import type { AssetChannel } from './assets.ts';
import { type HostLlmOnce } from './page-plan.ts';
export interface ControlToolsOptions {
    assets?: AssetChannel | null;
    allTools?: boolean;
    /** Test seam: skip session LLM. Production uses the calling agent's model. */
    planLlm?: HostLlmOnce;
    /** Test seam: shorten land settle polling. */
    landSettleMs?: number;
    landPollMs?: number;
}
/** Build the control tool definitions from the contract mirror table. */
export declare function createControlTools(opts?: ControlToolsOptions): ReturnType<typeof defineTool>[];
/** Open tools: POST /api/open — bypasses the control plane (no docId needed). */
export declare function createOpenTools(): ReturnType<typeof defineTool>[];
export declare function registeredToolNames(opts?: ControlToolsOptions): string[];
//# sourceMappingURL=tools.d.ts.map