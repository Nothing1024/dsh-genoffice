/** Trajectory view: compact summary over a turn-aware event ledger. */
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionHistoryFace, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
/** Session-history paging needed by the event-complete trajectory view. */
export interface TrajectoryViewInjected {
    hooks: {
        history: SessionHistoryFace;
        duration: SnapshotStore<boolean>;
    };
    loadHistoryTail: (signal: AbortSignal) => Promise<void>;
    loadOlderHistory: (signal: AbortSignal) => Promise<boolean>;
    setActualDuration: (actualDuration: boolean) => void;
}
export declare function TrajectoryView({ useHistory, useDuration, loadHistoryTail, loadOlderHistory, setActualDuration, inspect, onInspectDone, }: ConvViewProps & InjectFace<TrajectoryViewInjected>): import("react").JSX.Element;
//# sourceMappingURL=TrajectoryView.d.ts.map