/** Test double for the client settings-scope seam. */
import { vi } from 'vitest';
/**
 * Build an in-memory settings scope for service specs: starts in the host
 * loading state, records writes, and lets the test publish Host acceptances.
 * @returns the stub handle.
 */
export function stubSettingsScope() {
    let snapshot = {
        status: 'loading', value: undefined, base: undefined, user: undefined,
        revision: undefined, writable: false, mode: 'host',
    };
    const listeners = new Set();
    const set = vi.fn(() => Promise.resolve());
    const unset = vi.fn(() => Promise.resolve());
    return {
        scope: {
            getSnapshot: () => snapshot,
            subscribe: (listener) => {
                listeners.add(listener);
                return () => { listeners.delete(listener); };
            },
            set,
            unset,
        },
        set,
        unset,
        listenerCount: () => listeners.size,
        publish: (next) => {
            snapshot = { ...snapshot, ...next };
            for (const listener of [...listeners])
                listener();
        },
    };
}
//# sourceMappingURL=settings-scope.js.map