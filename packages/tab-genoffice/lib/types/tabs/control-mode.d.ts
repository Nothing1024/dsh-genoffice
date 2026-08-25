import type { ReactNode } from 'react';
import { type DegradeMode } from './coexist.ts';
export interface ControlModeViewerProps {
    path: string;
    title: string;
    ext: string;
    onBack?: () => void;
    renderBuiltin?: () => ReactNode;
    degradeMode?: DegradeMode;
    tabId?: string;
    updateTab?: (id: string, patch: {
        title?: string;
        path?: string;
        meta?: unknown;
    }) => void;
}
export declare function ControlModeViewer(props: ControlModeViewerProps): ReactNode;
//# sourceMappingURL=control-mode.d.ts.map