/**
 * Host-side ApiProxy implementation. Signature discipline: unary takes the
 * narrow RpcRequest<P> and echoes request.rpcId on the RpcResponse<T>.
 */
import type { Context } from 'cordis';
import type { ApiProxy } from './api/index.ts';
/** Resolved Host routing and project-directory defaults consumed by the API implementation. */
export interface ApiProxyDefaults {
    provider: string;
    model: string;
    /** Default project directory for new sessions whose create request carries no cwd. */
    cwd: string;
    /** Parent directory for name-created workspaces. */
    workspaceRoot: string;
    /** Native open-with-default-application; injectable for carrier tests. */
    openPath?: (path: string, signal: AbortSignal) => Promise<void>;
    /** Native text-editor handoff; injectable for settings-document tests. */
    openTextFile?: (path: string, signal: AbortSignal) => Promise<void>;
}
/**
 * Implement ApiProxy over a composed host context.
 * @param ctx - a context with the Host spine and Workspace registry mounted.
 * @param defaults - host routing and project-directory defaults.
 * @returns the ApiProxy implementation.
 */
export declare function createApiProxy(ctx: Context, defaults: ApiProxyDefaults): ApiProxy;
//# sourceMappingURL=api-proxy.d.ts.map