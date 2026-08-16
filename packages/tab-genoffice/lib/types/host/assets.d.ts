import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
export declare const ASSET_PREFIX = "/dsh-artifact/genoffice-asset";
export declare const TOKEN_TTL_MS = 60000;
export declare const MAX_ASSET_BYTES: number;
export interface PublishedAsset {
    url: string;
    token: string;
    dispose: () => void;
}
export interface AssetChannel {
    readonly available: boolean;
    publish(absPath: string): Promise<PublishedAsset>;
}
interface TokenRow {
    absPath: string;
    expires: number;
}
export interface AssetStore {
    publish(absPath: string, bind: {
        host: string;
        port: number;
    }): Promise<PublishedAsset>;
    take(token: string, now?: number): TokenRow | undefined;
    peek(token: string): TokenRow | undefined;
    clear(): void;
}
export declare function createAssetStore(opts?: {
    ttlMs?: number;
    now?: () => number;
}): AssetStore;
export declare function serveAsset(store: AssetStore, req: IncomingMessage, res: ServerResponse): Promise<void>;
/**
 * Prefer `reflect.get` when the service is already provided (external plugins
 * often cannot `inject()` undeclared services). Fall back to nested inject so
 * Electron compositions without webServer still load.
 */
export declare function createAssetChannel(ctx: Context): AssetChannel;
export {};
//# sourceMappingURL=assets.d.ts.map