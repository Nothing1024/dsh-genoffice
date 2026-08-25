/**
 * GenOffice relay loopback: shared by the file-list panel and the control-mode
 * viewer. Probe state is a module-level store so both surfaces show one strip.
 */
/** The genoffice relay base (loopback; CORS loopback whitelist covers it). */
export declare const RELAY_BASE = "http://localhost:8787";
export declare const PREVIEWABLE: Record<string, string>;
type RelayListener = () => void;
type OpenFileListener = (path: string) => void;
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
export declare function probeRelayLaunch(): Promise<boolean>;
export declare function launchRelay(): Promise<{
    ok: boolean;
    error?: string;
}>;
export declare function notifyHostSync(path: string): Promise<void>;
export declare function subscribeOpenFile(fn: OpenFileListener): () => void;
/** Dispatch a file path to all subscribeOpenFile listeners (used by the client-level SSE handler). */
export declare function emitOpenFile(filePath: string): void;
/**
 * Deliver an open path to the mounted panel. If no listener is up yet
 * (tab still opening), wait `delayMs` once; cancel the timer on dispose.
 */
export declare function scheduleOpenFile(filePath: string, delayMs?: number): () => void;
/** Test helper: EventSource → emitOpenFile. Production uses apply()'s single stream. */
export declare function startOpenFileStream(): () => void;
export {};
//# sourceMappingURL=relay.d.ts.map