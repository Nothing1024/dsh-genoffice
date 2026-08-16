/**
 * Host-side sync window: while the control iframe remounts after a save/reload,
 * tool calls must say 「文档正在同步」 instead of 「执行器未注册」 (BR-010).
 *
 * The browser posts `{ path }` to this same-origin route before remounting.
 * Host `*_save` also marks the window after a successful export.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
export declare const SYNC_ROUTE = "/dsh-artifact/genoffice-sync";
export declare const SYNC_WINDOW_MS = 8000;
export declare function markSyncWindow(path: string, now?: number): void;
export declare function isInSyncWindow(path: string, now?: number): boolean;
export declare function clearSyncWindow(path: string): void;
/** Test helper. */
export declare function resetSyncWindows(): void;
export declare function handleSyncRequest(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function applySyncRoute(ctx: Context): void;
//# sourceMappingURL=sync.d.ts.map