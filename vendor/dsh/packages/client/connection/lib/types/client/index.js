import { ConnectionController } from "./connection.js";
import { FixtureApiClient } from "./fixture.js";
import { WebApiClient } from "./web-api-client.js";
import { isLoopbackHostname } from "../loopback-hostname.js";
export { RpcId, AbstractApiClient, transportError, } from "./api.js";
/** Required services (none — this is the wire root). */
export const inject = [];
/**
 * Client plugin body: pick the api by page mode and provide ctx.connection.
 * @param ctx - client cordis context.
 */
export function apply(ctx) {
    const pageLocation = typeof location === 'undefined' ? undefined : location;
    const fixture = pageLocation !== undefined && new URLSearchParams(pageLocation.search).has('fixture');
    const api = !fixture ? new WebApiClient() : new FixtureApiClient();
    let started = false;
    const handle = {
        api,
        isLoopback: pageLocation === undefined || isLoopbackHostname(pageLocation.hostname),
        start(sinks, config) {
            if (started)
                throw new Error('connection: the stream loop is already owned by another consumer');
            started = true;
            const controller = new ConnectionController(api, sinks, config ?? {});
            controller.start();
            return { stop: () => { controller.stop(); } };
        },
    };
    ctx.provide('connection', handle);
}
//# sourceMappingURL=index.js.map