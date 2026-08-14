/**
 * Workspace-level discovery and model-driven Typert generation.
 * @module @deepseek-ai/dsh-typert-generator/workspace
 */
import type { DiscoveredTypertPackage } from './analyzer.ts';
import type { ModelEmitResult } from './emitter.ts';
/** One emitted artifact paired with its source package root. */
export interface WorkspaceEmitResult extends ModelEmitResult {
    readonly packageRoot: string;
}
/** Discover, analyze, and emit package reflection from independent faces. */
export declare class WorkspaceTypertGenerator {
    private readonly root;
    /**
     * Bind generation to one workspace root.
     * @param root - directory containing face aggregate tsconfigs.
     */
    constructor(root: string);
    /**
     * Find public package faces that contribute Cordis services/events or
     * explicitly tagged Typert roots.
     * @returns discovered packages in stable package-name order.
     */
    discover(): DiscoveredTypertPackage[];
    /**
     * Generate all discovered contributors, or an explicit package subset.
     * @param packages - optional exact package names for a focused pass.
     * @returns one artifact per package face.
     */
    generate(packages?: readonly string[]): WorkspaceEmitResult[];
    private validateExport;
}
//# sourceMappingURL=workspace.d.ts.map