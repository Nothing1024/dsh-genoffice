import type { AssistantBlock } from '@deepseek-ai/dsh-client-runtime/client';
import type { ChatViewSlotProps } from '../contract/slots.ts';
export interface AssistantMarkdownProps {
    blocks: readonly AssistantBlock[];
    streaming: boolean;
    /** Frozen partial of an aborted turn: rendered with a stopped marker. */
    interrupted?: boolean | undefined;
    /** Unix epoch ms for the IconActions clock; omitted while streaming or when
     *  the parent withholds chrome (mid-turn content assistants). */
    time?: number | undefined;
    /** Turn wall time in ms for the IconActions run-time label; omitted when the
     *  turn's triggering input is outside the loaded window. */
    runMs?: number | undefined;
    /** Turn first-step TTFT in ms for the IconActions label; omitted when unrecorded. */
    ttftMs?: number | undefined;
    /** Turn decode throughput for the IconActions label; omitted when unrecorded. */
    tokensPerSecond?: number | undefined;
    /** Event sequence used as the fork boundary; omitted while streaming. */
    seq?: number | undefined;
    /** Fork the session through this finalized message's completed turn when eligible. */
    onFork?: ((seq: number) => void) | undefined;
    /** The message is not the transcript tail of a completed turn. */
    forkUnavailable?: boolean | undefined;
    /** The owning view's locale seat, passed down as a plain prop. */
    t: ChatViewSlotProps['t'];
}
export declare const AssistantMarkdown: import("react").MemoExoticComponent<({ blocks, streaming, interrupted, time, runMs, ttftMs, tokensPerSecond, seq, onFork, forkUnavailable, t, }: AssistantMarkdownProps) => import("react").JSX.Element | null>;
//# sourceMappingURL=AssistantMarkdown.d.ts.map