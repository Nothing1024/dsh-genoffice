import { type ReactNode } from 'react';
/** Shared 24px disclosure chrome for conversation flow rows. */
export interface DisclosureRowProps {
    icon: ReactNode;
    title: string;
    open: boolean;
    expandable: boolean;
    onToggle: () => void;
    /** Makes the complete title row the disclosure target. */
    expandOnRowClick?: boolean | undefined;
    /** Replaces the collapsed icon with a chevron while the row is hovered. */
    previewChevron?: boolean | undefined;
    /** Keeps `collapsedContent` inline while open (ToolRow's summary stays readable next to the expanded card). */
    keepContentWhenOpen?: boolean | undefined;
    collapsedContent?: ReactNode;
    children?: ReactNode;
    className?: string | undefined;
    rowClassName?: string | undefined;
    leadingClassName?: string | undefined;
    chevronClassName?: string | undefined;
    titleClassName?: string | undefined;
}
/**
 * Render one disclosure header and its controlled expanded content.
 * @param props - Visual content, controlled state, and interaction policy.
 * @returns The disclosure row.
 */
export declare function DisclosureRow({ icon, title, open, expandable, onToggle, expandOnRowClick, previewChevron, keepContentWhenOpen, collapsedContent, children, className, rowClassName, leadingClassName, chevronClassName, titleClassName, }: DisclosureRowProps): import("react").JSX.Element;
//# sourceMappingURL=DisclosureRow.d.ts.map