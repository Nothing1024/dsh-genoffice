import type { ChatViewSlotProps, CommandRowOwnerProps } from '../contract/slots.ts';
/** Card props: the owner payload plus the render site's locale seat (plain prop). */
export interface GenericCommandCardProps extends CommandRowOwnerProps {
    t: ChatViewSlotProps['t'];
}
export declare function GenericCommandCard({ node, t }: GenericCommandCardProps): import("react").JSX.Element;
//# sourceMappingURL=GenericCommandCard.d.ts.map