import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
import type { ServiceAcquire, WebServerLike } from '../standard/coordinates.ts';
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
 * Build the channel over a ServiceAcquire (the standard-facet seam): mounts
 * the one-shot asset route when the web server materialises; `dispose`
 * cancels the pending acquire or unmounts the live route.
 */
export declare function createAssetChannelFrom(acquire: ServiceAcquire<WebServerLike> | undefined): AssetChannel & {
    dispose(): void;
};
/**
 * cordis 形态的旧入口：lookup 已到位的 webServer，否则嵌套 inject
 * （Electron 组合缺 webServer 时照常装载）。
 */
export declare function createAssetChannel(ctx: Context): AssetChannel;
export {};
//# sourceMappingURL=assets.d.ts.map