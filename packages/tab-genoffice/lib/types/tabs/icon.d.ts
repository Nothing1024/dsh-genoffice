/**
 * GenOffice tab / viewer icons. The registerTab `icon` field takes
 * `(size) => ReactNode`; the panel no longer uses a tabIcon static.
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
/** GenOffice document glyph. `size` is accepted for the TabDescriptor icon callback. */
export declare function GenOfficeIcon(_props: {
    size?: number;
}): ReactNode;
//# sourceMappingURL=icon.d.ts.map