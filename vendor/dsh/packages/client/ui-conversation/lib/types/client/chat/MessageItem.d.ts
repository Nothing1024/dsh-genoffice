import type { ReactNode } from 'react';
import type { CompactionSummaryNode, ContextMessageNode, ModelRetryNode, SteeringMessageNode, TurnErrorNode, UnknownSurfaceNode, UserMessageNode } from '@deepseek-ai/dsh-client-runtime/client';
import type { ChatViewSlotProps } from '../contract/slots.ts';
export interface MessageItemProps {
    node: UserMessageNode | SteeringMessageNode | ContextMessageNode | CompactionSummaryNode | ModelRetryNode | TurnErrorNode | UnknownSurfaceNode;
    retryActive?: boolean;
    /** Fork through this message's completed turn when eligible. */
    onFork?: (seq: number) => void;
    /** The message is not the transcript tail of a completed turn. */
    forkUnavailable?: boolean;
    /** The owning view's locale seat, passed down as a plain prop. */
    t: ChatViewSlotProps['t'];
}
/**
 * Render one Host-authoritative pending steering item with the same visual
 * language as its eventual durable transcript node.
 * @param props - Pending message content and conversation translator.
 * @returns the pending steering bubble.
 */
export declare function PendingSteeringBubble({ content, t }: {
    content: readonly unknown[];
    t: ChatViewSlotProps['t'];
}): ReactNode;
export declare const MessageItem: import("react").MemoExoticComponent<({ node, retryActive, onFork, forkUnavailable, t, }: MessageItemProps) => import("react").JSX.Element>;
//# sourceMappingURL=MessageItem.d.ts.map