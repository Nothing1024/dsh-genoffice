/**
 * Browser-local Composer submission policy. It owns the persisted busy-Enter
 * preference and resolves keyboard gestures into queue/steer delivery modes;
 * Host and Agent keep the actual delivery-window authority.
 */
import { type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import type { BusyEnterBehavior, ComposerSubmitGesture, InputSubmitMode } from '../contract/composer-submission.ts';
/** localStorage key holding the busy-Enter preference. */
export declare const BUSY_ENTER_STORAGE_KEY = "dsh.conversation.busyEnter";
/** Default preserves Enter-as-Queue for running conversations. */
export declare const DEFAULT_BUSY_ENTER_BEHAVIOR: BusyEnterBehavior;
/**
 * Persisted policy used by both the composer inject face and its Settings row.
 * Direct `steer` is intentionally best-effort: AgentLoop turns a closed-window
 * submission into the next waking Queue item.
 */
export declare class ComposerSubmissionPolicy {
    /** Reactive preference source for the Settings row. */
    readonly busyEnter: SnapshotStore<BusyEnterBehavior>;
    /**
     * Resolve one keyboard gesture without changing state.
     * @param running - whether the addressed agent currently reports busy.
     * @param gesture - plain Enter or the Cmd/Ctrl-accelerated chord.
     * @param steeringAvailable - whether this session transport supports steering.
     * @returns Queue outside steer-capable busy state; otherwise the preferred mode or its opposite.
     */
    resolve(running: boolean, gesture: ComposerSubmitGesture, steeringAvailable: boolean): InputSubmitMode;
    /**
     * Change and persist the plain-Enter behavior used during busy state.
     * @param behavior - Queue or Steer.
     */
    setBusyEnter(behavior: BusyEnterBehavior): void;
}
//# sourceMappingURL=submission-policy.d.ts.map