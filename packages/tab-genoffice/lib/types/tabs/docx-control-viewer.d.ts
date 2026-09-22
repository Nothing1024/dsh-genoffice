import type { ReactNode } from 'react';
import type { SidebarPaneTabProps } from '../standard/sidebar.ts';
export declare function renderDegradeFallback(): ReactNode;
export declare function DocxControlViewer(props: {
    path: string;
    title: string;
    tabId?: string;
    onBack?: () => void;
}): ReactNode;
/** Per-file sidebar tab: control-mode plus Back (closes the tab; UF-003). */
export declare function GenOfficeFileTab(props: SidebarPaneTabProps): ReactNode;
//# sourceMappingURL=docx-control-viewer.d.ts.map