/**
 * Provider-routed model-request retry policy on the agent loop's request
 * recovery seam. Each scheduled retry is durable before its cancellable wait.
 *
 * @module @deepseek-ai/dsh-llm-retry
 */
import type { Context } from 'cordis';
import z from 'schemastery';
import type { LlmFailure } from '@deepseek-ai/dsh-llm';
declare module '@deepseek-ai/dsh-session' {
    interface SessionEventMap {
        /** Durable, non-surface record of one provider-routed retry scheduled after a failed request attempt. */
        'llm/retry': {
            turn: number;
            step: number;
            provider: string;
            mode: 'normal';
            policyKey: string;
            retry: number;
            maxRetries: number;
            delayMs: number;
            failure: LlmFailure;
        } | {
            turn: number;
            step: number;
            provider: string;
            mode: 'always';
            policyKey: string;
            retry: number;
            delayMs: number;
            failure: LlmFailure;
        };
    }
}
export type { LlmRetryEventData } from './types.ts';
export declare const name = "llm-retry";
export declare const inject: string[];
/** This policy executor has no config; providers own `retryPolicy`. */
export type Config = Readonly<Record<string, never>>;
/** Runtime schema for {@link Config}. */
export declare const Config: z<Config>;
/** Non-serializable seams used to make timing policy deterministic in tests. */
export interface RetryInternals {
    /** Random sample in the inclusive zero-to-one range used for jitter. */
    random?: () => number;
}
/**
 * Install provider-routed normal or unbounded request recovery.
 * @param ctx - plugin context that owns the listener and active waits.
 * @param config - empty executor config; provider registrations own policy.
 * @param internals - non-serializable deterministic seams for tests.
 */
export declare function apply(ctx: Context, config?: Config, internals?: RetryInternals): void;
//# sourceMappingURL=index.d.ts.map