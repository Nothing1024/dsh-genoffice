/**
 * Host tools: GenOffice control plane via relay POST /api/control/<app>/<docId>/…
 *
 * Registration is filtered by CAPABILITY (BR-001 / BR-015). The table still
 * lists all 81 entries; DSH_GENOFFICE_ALL_TOOLS=1 re-opens the filter.
 * Write-back only through *_save and the tab button (BR-011).
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import type { AssetChannel } from './assets.ts';
export interface ControlToolsOptions {
    assets?: AssetChannel | null;
    allTools?: boolean;
}
/** Build the control tool definitions from the contract mirror table. */
export declare function createControlTools(opts?: ControlToolsOptions): ReturnType<typeof defineTool>[];
export declare function registeredToolNames(opts?: ControlToolsOptions): string[];
//# sourceMappingURL=tools.d.ts.map