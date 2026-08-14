/**
 * node:http ↔ WHATWG fetch bridge for the /api transport (host side of the
 * web carrier; the fetch-shaped handler itself is transport-agnostic).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
/**
 * Bridge one node:http request to the fetch-shaped handler (client close
 * aborts; SSE bodies stream out chunk by chunk).
 * @param req - incoming node:http request (fully read before dispatch).
 * @param res - node:http response the bridge writes and owns to completion.
 * @param apiHandler - fetch-shaped API carrier the request is dispatched to.
 */
export declare function bridge(req: IncomingMessage, res: ServerResponse, apiHandler: {
    fetch: typeof fetch;
}): Promise<void>;
//# sourceMappingURL=http-bridge.d.ts.map