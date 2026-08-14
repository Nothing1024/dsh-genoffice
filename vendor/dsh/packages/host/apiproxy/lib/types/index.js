/**
 * @deepseek-ai/dsh-host-apiproxy — the API gateway every client shape shares:
 * the ApiProxy contract (api/: types + zod schemas, browser-safe), the fetch
 * carrier pair (fetch/: toFetchHandler on the host side, AbstractApiClient +
 * platform subclasses on the client side), and the host-side implementation
 * (api-proxy.ts: createApiProxy + the ApiProxyService gateway plugin providing
 * `ctx.apiProxy`). Transport-agnostic by design: this package registers no
 * routes — physical carriers wrap `ctx.apiProxy` themselves.
 */
import { resolve } from 'node:path';
import { Service } from 'cordis';
import z from 'schemastery';
import { createApiProxy } from "./api-proxy.js";
export { RpcId } from "./api/rpc.js";
export { toFetchHandler } from "./fetch/handler.js";
export { AbstractApiClient, InProcessApiClient } from "./fetch/client.js";
export { createApiProxy } from "./api-proxy.js";
/**
 * The API gateway service: implements the ApiProxy contract over the composed
 * host context and provides it as `ctx.apiProxy`. The Host cwd is the default
 * project directory and the fallback parent for name-created Workspaces.
 */
export class ApiProxyService extends Service {
    static inject = [
        'agents', 'directoryPicker', 'llm', 'sessions', 'subagents', 'sessionQuery',
        'tools', 'userInteraction', 'workspace',
    ];
    static Config = z.object({
        provider: z.string().required(),
        model: z.string().required(),
        workspaceRoot: z.string(),
    });
    sessions;
    subagents;
    workspace;
    host;
    commands;
    goals;
    skills;
    settings;
    credentials;
    llm;
    events;
    respond;
    constructor(ctx, config) {
        super(ctx, 'apiProxy');
        const cwd = process.cwd();
        const api = createApiProxy(ctx, {
            provider: config.provider,
            model: config.model,
            cwd,
            workspaceRoot: resolve(config.workspaceRoot ?? cwd),
        });
        this.sessions = api.sessions;
        this.subagents = api.subagents;
        this.workspace = api.workspace;
        this.host = api.host;
        this.commands = api.commands;
        this.goals = api.goals;
        this.skills = api.skills;
        this.settings = api.settings;
        this.credentials = api.credentials;
        this.llm = api.llm;
        this.events = api.events;
        // createApiProxy returns closures (no `this` capture); bind only satisfies
        // the unbound-method lint without changing behavior.
        this.respond = api.respond.bind(api);
    }
}
export default ApiProxyService;
//# sourceMappingURL=index.js.map