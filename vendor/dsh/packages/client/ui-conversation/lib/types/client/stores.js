/**
 * Per-session chat store shared by conversation and details registrations.
 * The plugin creates its handle at apply time so identity follows the fiber.
 */
import { defineStore } from '@deepseek-ai/dsh-client-runtime/client';
/**
 * Declares the per-session chat state and write surface.
 * @returns the store handle.
 */
export function createChatStore() {
    return defineStore({
        init: () => ({ selection: null, draft: '', view: null, inspect: null }),
        persist: 'dsh.conversation.chat',
        actions: {
            select: (d, target) => { d.selection = target; },
            setDraft: (d, text) => { d.draft = text; },
            clearDraft: (d) => { d.draft = ''; },
            // Optimistic-send failure restore: only when the user typed nothing new
            // since the clear (send choreography lives in the inject factory).
            restoreDraft: (d, text) => { if (d.draft === '')
                d.draft = text; },
            setView: (d, view) => { d.view = view; },
            setInspect: (d, target) => { d.inspect = target; },
        },
    });
}
//# sourceMappingURL=stores.js.map