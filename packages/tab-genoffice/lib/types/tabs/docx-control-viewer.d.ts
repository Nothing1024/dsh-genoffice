import type { ReactNode } from 'react';
import type { FileViewerProps, TabComponentProps } from 'dsh-better-sidebar';
/** Relay-down fallback: another enabled FileViewer, never this plugin's own. */
export declare function renderDegradeFallback(props: FileViewerProps): ReactNode;
export declare function DocxControlViewer(props: FileViewerProps & {
    tabId?: string;
    updateTab?: (id: string, patch: {
        title?: string;
        path?: string;
        meta?: unknown;
    }) => void;
    onBack?: () => void;
}): ReactNode;
/** Per-file sidebar tab: control-mode plus Back (closes the tab; UF-003). */
export declare function GenOfficeFileTab(props: TabComponentProps): ReactNode;
//# sourceMappingURL=docx-control-viewer.d.ts.map