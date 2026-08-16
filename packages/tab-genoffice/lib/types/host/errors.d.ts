/**
 * Seven failure classes for GenOffice control tools (BR-010).
 * Pure mapping: 中文说明 + 上游原文 + 下一步. Never replaces the upstream string.
 */
export type ControlErrorClass = 'relay-down' | 'executor-missing' | 'invalid-params' | 'upstream-guard' | 'capability-unavailable' | 'write-conflict' | 'sync-window' | 'unrecognized';
export interface MappedControlError {
    class: ControlErrorClass;
    message: string;
}
export interface ClassifyInput {
    error: string;
    path?: string;
    /** Pre-classified kind when the caller already knows the source. */
    kind?: 'fetch' | 'relay' | 'executor' | 'sync' | 'capability' | 'local';
}
export declare function classifyControlError(input: ClassifyInput): MappedControlError;
//# sourceMappingURL=errors.d.ts.map