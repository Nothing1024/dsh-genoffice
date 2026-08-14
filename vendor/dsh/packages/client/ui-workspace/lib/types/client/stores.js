/**
 * The workspace browser's viewing store: the session-list grouping mode,
 * persisted across reloads. Module level exports the factory only (a
 * module-level handle would pin the store identity across plugin reloads);
 * register() receives the factory and the browser derives its PropsStore
 * share from the return type.
 */
import { defineStore } from '@deepseek-ai/dsh-client-runtime/client';
/**
 * Create the workspace browser viewing store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createWorkspaceViewStore() {
    return defineStore({
        init: () => { return ({ groupBy: 'workspace' }); },
        persist: 'dsh.workspace.view',
        actions: {
            setGroupBy: (d, mode) => { d.groupBy = mode; },
        },
    });
}
//# sourceMappingURL=stores.js.map