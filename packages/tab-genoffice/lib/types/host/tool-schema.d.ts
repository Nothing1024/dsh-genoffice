/**
 * Control-tool schema table and generator (genoffice-dsh-control, Task 18).
 *
 * INV-004 mirror: the table below mirrors contracts/control-api.md §4 (the
 * single source of truth). The plugin and upstream are independent
 * repositories, so the table is embedded here — the stack smoke assertion
 * (`node scripts/dev.mjs smoke` → 契约 ↔ 插件 host 注册) keeps the name set
 * in sync. The generator consumes only this table (never upstream sources at
 * runtime) and produces `defineTool`-ready definitions (Task 19).
 *
 * Parameter specs use the dsh-tools property-map format; union item types are
 * spelled with `oneOf` (the supported union surface). `path` (the target
 * file's absolute path) is a plugin-side addition on every tool: it selects
 * the executor via docId = sha256(path) (BR-009).
 */
import type { ParameterSchemaSpec } from '@deepseek-ai/dsh-tools';
export interface ControlToolEntry {
    /** DSH tool name, e.g. `docx:read_blocks` (INV-004: contracts/control-api.md §4) */
    name: string;
    /** upstream skill tool name (AGENT_TOOLS) forwarded to the executor */
    skillName: string;
    /** relay control-plane app segment (docx→docs, markdown→markdown, xlsx→sheets, pptx→slides, pdf→pdf) */
    app: 'docs' | 'markdown' | 'sheets' | 'slides' | 'pdf';
    /** model-visible description: skill discipline + control context */
    description: string;
    /** defineTool parameter spec (skill inputSchema + the required `path`) */
    parameters: ParameterSchemaSpec;
}
/**
 * Tool table — the plugin-side mirror of contracts/control-api.md §4.
 * 11 docx tools (10 skill + docx_save) and 5 markdown tools (4 skill + markdown_save).
 * Naming uses `_` instead of `:` (provider tool-name pattern ^[a-zA-Z0-9_-]+$;
 * see the contract's §4 separator note, ASM-006 revision).
 */
export declare const CONTROL_TOOL_TABLE: ControlToolEntry[];
/** Whether a table entry is the write-back trigger (BR-008). */
export declare function isSaveEntry(entry: ControlToolEntry): boolean;
//# sourceMappingURL=tool-schema.d.ts.map