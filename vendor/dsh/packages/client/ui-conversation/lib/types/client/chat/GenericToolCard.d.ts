import type { ChatViewSlotProps, ToolRowOwnerProps } from '../contract/slots.ts';
/** Card props: the owner payload plus the render site's locale seat (plain prop). */
export interface GenericToolCardProps extends ToolRowOwnerProps {
    t: ChatViewSlotProps['t'];
}
export declare function GenericToolCard({ toolName, block, cwd, openFile, inspect, t }: GenericToolCardProps): import("react").JSX.Element;
//# sourceMappingURL=GenericToolCard.d.ts.map