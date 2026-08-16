/**
 * In-memory docId occupancy table (BR-005). One control-mode surface per
 * document: a second mount shows a hint instead of a second iframe.
 * Cleared on full page reload — that is accepted.
 */
export type ControlSurface = 'tab' | 'viewer';
export interface ActiveDoc {
    surface: ControlSurface;
}
export declare function lookupActive(docId: string): ActiveDoc | undefined;
export declare function subscribeActive(listener: () => void): () => void;
/** Register occupancy. Returns an unregister function. */
export declare function registerActive(docId: string, entry: ActiveDoc): () => void;
/** Test seam: drop every entry. */
export declare function resetActiveDocs(): void;
//# sourceMappingURL=doc-registry.d.ts.map