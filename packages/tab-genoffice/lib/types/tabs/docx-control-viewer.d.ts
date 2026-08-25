import type { ReactNode } from 'react';
import type { FileViewerProps, TabComponentProps } from 'dsh-better-sidebar';
/** Relay-down fallback: another enabled FileViewer, never this plugin's own. */
export declare function renderDegradeFallback(props: FileViewerProps): ReactNode;
export declare function DocxControlViewer(props: FileViewerProps): ReactNode;
/** Per-file sidebar tab: same control-mode surface as the FileViewer, no Back. */
export declare function GenOfficeFileTab(props: TabComponentProps): ReactNode;
//# sourceMappingURL=docx-control-viewer.d.ts.map