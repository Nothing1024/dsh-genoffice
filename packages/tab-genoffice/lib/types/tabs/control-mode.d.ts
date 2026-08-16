import type { ReactNode } from 'react';
import { type DegradeMode } from './coexist.ts';
export interface ControlModeViewerProps {
    path: string;
    title: string;
    ext: string;
    onBack?: () => void;
    renderBuiltin?: () => ReactNode;
    degradeMode?: DegradeMode;
}
export declare function ControlModeViewer(props: ControlModeViewerProps): ReactNode;
//# sourceMappingURL=control-mode.d.ts.map