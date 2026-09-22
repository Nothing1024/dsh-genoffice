/**
 * GenOffice tab / viewer icons. Official guide entries take a component
 * `(props: { size?: number }) => ReactNode`.
 */
import type { ReactNode } from 'react';
/** Shared SVG presentation props for sidebar tab icons (16px grid). */
export declare const TAB_ICON_PROPS: {
    width: number;
    height: number;
    viewBox: string;
    fill: string;
    stroke: string;
    strokeWidth: number;
    strokeLinecap: "round";
    strokeLinejoin: "round";
};
/** GenOffice document glyph. `size` is accepted for the guide-entry icon. */
export declare function GenOfficeIcon(_props: {
    size?: number;
    className?: string;
}): ReactNode;
//# sourceMappingURL=icon.d.ts.map