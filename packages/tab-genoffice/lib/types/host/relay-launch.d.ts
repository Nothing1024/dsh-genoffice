import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
export declare const RELAY_LAUNCH_ROUTE = "/dsh-artifact/genoffice-relay";
export declare function isRelayLaunchConfigured(env?: NodeJS.ProcessEnv): boolean;
export declare function handleRelayLaunchRequest(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function applyRelayLaunchRoute(ctx: Context): void;
/** Test helper. */
export declare function resetRelayLaunch(): void;
//# sourceMappingURL=relay-launch.d.ts.map