/**
 * @deepseek-ai/dsh-host-apiproxy — the API gateway every client shape shares:
 * the ApiProxy contract (api/: types + zod schemas, browser-safe), the fetch
 * carrier pair (fetch/: toFetchHandler on the host side, AbstractApiClient +
 * platform subclasses on the client side), and the host-side implementation
 * (api-proxy.ts: createApiProxy + the ApiProxyService gateway plugin providing
 * `ctx.apiProxy`). Transport-agnostic by design: this package registers no
 * routes — physical carriers wrap `ctx.apiProxy` themselves.
 */
import { Context, Service } from 'cordis';
import z from 'schemastery';
import type { ApiProxy } from './api/index.ts';
export type * from './api/index.ts';
export { RpcId } from './api/rpc.ts';
export { toFetchHandler } from './fetch/handler.ts';
export { AbstractApiClient, InProcessApiClient } from './fetch/client.ts';
export type { IApiClient } from './fetch/client.ts';
export { createApiProxy } from './api-proxy.ts';
export type { ApiProxyDefaults } from './api-proxy.ts';
declare module 'cordis' {
    interface Context {
        /** The host-side ApiProxy implementation (the transport-agnostic gateway face). */
        apiProxy: ApiProxy;
    }
}
/** Gateway plugin config: host-level agent routing and Workspace creation root. */
export interface Config {
    /** Default provider route for created/resumed agents. */
    provider: string;
    /** Default model id. */
    model: string;
    /** Parent directory for name-created Workspaces; defaults to the Host cwd. */
    workspaceRoot?: string;
}
/**
 * The API gateway service: implements the ApiProxy contract over the composed
 * host context and provides it as `ctx.apiProxy`. The Host cwd is the default
 * project directory and the fallback parent for name-created Workspaces.
 */
export declare class ApiProxyService extends Service implements ApiProxy {
    static inject: string[];
    static Config: z<Config>;
    readonly sessions: ApiProxy['sessions'];
    readonly subagents: ApiProxy['subagents'];
    readonly workspace: ApiProxy['workspace'];
    readonly host: ApiProxy['host'];
    readonly commands: ApiProxy['commands'];
    readonly goals: ApiProxy['goals'];
    readonly skills: ApiProxy['skills'];
    readonly settings: ApiProxy['settings'];
    readonly credentials: ApiProxy['credentials'];
    readonly llm: ApiProxy['llm'];
    readonly events: ApiProxy['events'];
    readonly respond: ApiProxy['respond'];
    constructor(ctx: Context, config: Config);
}
export default ApiProxyService;
//# sourceMappingURL=index.d.ts.map