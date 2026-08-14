import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type GoalKey } from './locales.ts';
export { GoalBar, GoalDock } from './GoalBar.tsx';
export type { GoalActionResult, GoalBarActions } from './slots.ts';
export type { GoalKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The goal strip's copy. */
        goal: GoalKey;
    }
}
/** Required services: slots for the dock entry, sessions for the projected ref, connection for the wire verbs, locale for the copy. */
export declare const inject: string[];
/**
 * Client plugin body: the GoalBar dock entry with its mutation verbs.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map