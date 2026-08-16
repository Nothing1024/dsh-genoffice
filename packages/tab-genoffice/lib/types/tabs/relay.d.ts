/**
 * GenOffice relay loopback: shared by the file-list panel and the control-mode
 * viewer. Probe state is a module-level store so both surfaces show one strip.
 */
/** The genoffice relay base (loopback; CORS loopback whitelist covers it). */
export declare const RELAY_BASE = "http://localhost:8787";
export declare const PREVIEWABLE: Record<string, string>;
type RelayListener = () => void;
export declare function getRelayOk(): boolean | null;
export declare function subscribeRelay(fn: RelayListener): () => void;
/** Update the shared flag without a network round-trip (list fetch already proved it). */
export declare function noteRelayOk(ok: boolean): void;
/** Test helper — not for production. */
export declare function resetRelayStore(): void;
export declare function extOf(path: string): string;
export declare function docIdFor(absPath: string): Promise<string>;
/** Control mode adds `control=1`; `_r` busts the iframe after save/reload (BR-014). */
export declare function previewUrlFor(path: string, ext: string, control: boolean, nonce?: string): string;
/** Raw health probe (no store). */
export declare function checkRelay(signal?: AbortSignal): Promise<boolean>;
/** Shared probe with throttle. `force` bypasses throttle (「重新检查」). */
export declare function probeRelay(force?: boolean, signal?: AbortSignal): Promise<boolean>;
export declare function notifyHostSync(path: string): Promise<void>;
export {};
//# sourceMappingURL=relay.d.ts.map