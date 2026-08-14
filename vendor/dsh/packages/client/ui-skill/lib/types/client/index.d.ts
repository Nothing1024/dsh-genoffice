import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
/** Required services: slash registry, routed sessions, and the wire face. */
export declare const inject: string[];
/**
 * Client plugin body: register the '/' skill source over the root wire face.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map