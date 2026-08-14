import z from 'schemastery';
import { toFetchHandler } from '@deepseek-ai/dsh-host-apiproxy';
import { API_PATH, HOST_EVENTS_PATH, MUX_EVENTS_PATH } from "./api-path.js";
import { bridge } from "./http-bridge.js";
import { assertTrustedAuthority, isTrustedApiRequest } from "./api-request-trust.js";
import { rejectWebSocketUpgrade, WebSocketDownlinks } from "./websocket-downlink.js";
export { API_PATH, HOST_EVENTS_PATH, MUX_EVENTS_PATH } from "./api-path.js";
/** Stable Cordis plugin name. */
export const name = 'client-connection';
/** Services required before mounting the route. */
export const inject = ['httpServer', 'apiProxy'];
export const Config = z.object({
    trustedHosts: z.array(String).default([]),
});
/**
 * Methods gated to loopback even on a trusted-host deployment. Native dialogs
 * act on the host machine; the settings and credential domains mutate the
 * user's configuration and secret store, and READING them is equally
 * privileged — `settings.describe` returns every exposed namespace's
 * configuration and `credentials.describe` reports whether an arbitrary
 * environment-variable name is configured and where from, which is
 * reconnaissance no anonymous caller should have. `trustedHosts` is a
 * DNS-rebinding fence, explicitly not authentication, so the whole
 * configuration plane stays loopback-same-origin until a real authentication
 * layer exists. `llm.discoverModels` belongs to that plane on both counts: it
 * carries a draft credential, and it makes the HOST issue a GET to a URL the
 * caller chose and reports back the status or the parsed body — an anonymous
 * LAN caller would have a probe for whatever the host can reach and the
 * browser cannot.
 *
 * The model catalog (`llm.providers`, `llm.models`) is deliberately NOT here:
 * it carries provider ids, display names, and model lists — no endpoints,
 * keys, or key state — and a LAN client's model picker legitimately needs it.
 */
const PRIVILEGED_METHODS = new Set([
    'host.pickDirectory',
    'host.openPath',
    'settings.describe',
    'settings.openDocument',
    'settings.update',
    'settings.replace',
    'settings.mutate',
    'credentials.describe',
    'credentials.set',
    'credentials.unset',
    'llm.discoverModels',
]);
/**
 * Mounts the API gateway under the browser transport prefix. Every request on
 * the prefix passes the browser-trust fence first (DNS-rebinding and
 * cross-site defense — [api-request-trust](./api-request-trust.ts));
 * privileged methods additionally pass it with an empty trust list, which
 * pins them to loopback.
 * @param ctx - Host plugin context.
 * @param config - resolved plugin config (schema defaults applied).
 */
export function apply(ctx, config) {
    // The Loader resolves schema defaults; hand-built test contexts may pass none.
    const trustedHosts = config?.trustedHosts ?? [];
    // Config boundary: a malformed entry fails the load loudly here rather than
    // silently authorizing its hostname prefix at request time.
    for (const entry of trustedHosts)
        assertTrustedAuthority(entry);
    const apiHandler = toFetchHandler(ctx.apiProxy);
    const downlinks = new WebSocketDownlinks(ctx.apiProxy);
    const route = {
        kind: 'prefix',
        path: API_PATH,
        handler: async (req, res) => {
            const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname;
            const method = pathname.startsWith(`${API_PATH}/`)
                ? pathname.slice(API_PATH.length + 1)
                : undefined;
            const allowed = method !== undefined && PRIVILEGED_METHODS.has(method)
                ? isTrustedApiRequest(req, [])
                : isTrustedApiRequest(req, trustedHosts);
            if (!allowed) {
                res.writeHead(403);
                res.end('forbidden');
                return;
            }
            if (req.method === 'GET' && (pathname === MUX_EVENTS_PATH || pathname === HOST_EVENTS_PATH)) {
                res.writeHead(426, { connection: 'Upgrade', upgrade: 'websocket' });
                res.end('upgrade required');
                return;
            }
            await bridge(req, res, apiHandler);
        },
    };
    ctx.effect(() => { return ctx.httpServer.register(route); }, 'client-connection: /api route');
    const registerDownlink = (path, handle) => {
        ctx.effect(() => ctx.httpServer.registerUpgrade({
            path,
            handler: (req, socket, head) => {
                if (!isTrustedApiRequest(req, trustedHosts)) {
                    rejectWebSocketUpgrade(socket);
                    return;
                }
                return handle(req, socket, head);
            },
        }), `client-connection: ${path} WebSocket`);
    };
    ctx.effect(() => () => downlinks.close(), 'client-connection: WebSocket downlinks');
    registerDownlink(MUX_EVENTS_PATH, (req, socket, head) => { downlinks.handleMux(req, socket, head); });
    registerDownlink(HOST_EVENTS_PATH, (req, socket, head) => { downlinks.handleHost(req, socket, head); });
}
//# sourceMappingURL=index.js.map