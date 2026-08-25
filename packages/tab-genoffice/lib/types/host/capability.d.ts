/** Capability table: the single source for register-filter, prompt, and drift tests.
 *  status = upstream web-mode fact; handover = product ownership (wins over status).
 *  Source: docs/genoffice-research/evidence/capability-matrix.py (WEB_STATUS).
 */
export type CapabilityStatus = 'available' | 'relay-fetch' | 'partial' | 'guarded' | 'bridge-missing' | 'state-locked' | 'cloud-only';
export type CapabilityHandover = 'dsh:web_search' | 'dsh:pending';
export type CapabilityApp = 'docs' | 'markdown' | 'sheets' | 'slides' | 'pdf';
export type CapabilityKey = `${CapabilityApp}:${string}`;
export interface CapabilityEntry {
    status: CapabilityStatus;
    netEgress: boolean;
    handover?: CapabilityHandover;
    evidence: string;
}
export declare const CAPABILITY: Record<CapabilityKey, CapabilityEntry>;
export declare function isExposed(entry: CapabilityEntry): boolean;
export declare function capabilityOf(app: CapabilityApp, skillName: string): CapabilityEntry | undefined;
/** Exposed set size. Tests must derive expected counts from CONTROL_TOOL_TABLE, not hardcode this. */
export declare const EXPOSED_COUNT: number;
//# sourceMappingURL=capability.d.ts.map