import type { FocusEventHandler, MouseEventHandler, ReactElement, Ref } from 'react';
/** Bubble placement relative to the anchor. */
export type TooltipSide = 'right' | 'bottom' | 'top';
/** Props Tooltip injects into its anchor child; the child's own handlers are chained ahead of the tooltip's. */
interface AnchorProps {
    ref?: Ref<HTMLElement> | undefined;
    onMouseEnter?: MouseEventHandler | undefined;
    onMouseLeave?: MouseEventHandler | undefined;
    onFocus?: FocusEventHandler | undefined;
    onBlur?: FocusEventHandler | undefined;
}
/**
 * Attach a hover/focus tooltip to an anchor element.
 * @param props.label - bubble text.
 * @param props.side - placement relative to the anchor (default 'right').
 * @param props.delayMs - hover delay in milliseconds; keyboard focus remains immediate.
 * @param props.disabled - suppress the bubble while true; the anchor renders identically so
 * toggling never remounts it (which would cut its CSS transitions).
 * @param props.children - a single anchor element; its own ref (callback or object) is forwarded alongside the tooltip's.
 * @returns the cloned anchor plus a fixed-position bubble while hovered/focused.
 */
export declare function Tooltip({ label, side, delayMs, disabled, children }: {
    label: string;
    side?: TooltipSide;
    delayMs?: number;
    disabled?: boolean;
    children: ReactElement<AnchorProps>;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=Tooltip.d.ts.map