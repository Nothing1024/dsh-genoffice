import { SlotsService } from "./slots.js";
import { SessionsService } from "./sessions/service.js";
import { SessionHistoryService } from "./session-history/service.js";
import { WorkspacesService } from "./workspaces/service.js";
export { SlotsService } from "./slots.js";
export { SessionCreateError, SessionsService, scopeOf, workspaceTitleOf } from "./sessions/service.js";
export { SessionHistoryService } from "./session-history/service.js";
// The provide channel is shared with the client test runtime (one
// materialization/projection implementation; no test-side mirror to drift).
export { SessionProvideChannel } from "./sessions/provide.js";
export { createScope } from "./agents/scope.js";
export { DirectoryBrowseError, WorkspaceCreateError, WorkspacesService } from "./workspaces/service.js";
// Runtime owns the snapshot store; web-react only binds it to React.
export { createSnapshotStore, defineStore, shallowEqual } from "./contract/store.js";
export { PendingWait } from "./sessions/pending.js";
/** Required services: the wire handle mounted by the connection plugin. */
export const inject = ['connection'];
/** Mounts the browser runtime services and connection stream.
 * @param ctx - Client Cordis context.
 */
export function apply(ctx) {
    ctx.plugin(SlotsService);
    const connection = ctx.get('connection');
    const sessions = new SessionsService(ctx, connection.api);
    const sessionHistory = new SessionHistoryService(ctx, connection.api);
    const workspaces = new WorkspacesService(ctx, connection.api, sessions);
    ctx.effect(() => workspaces.startInitialSelection(), 'runtime: initial Workspace selection');
    const loop = connection.start({
        onMuxEnvelope: (envelope) => {
            sessions.handleMuxEnvelope(envelope);
            try {
                sessionHistory.handleMuxEnvelope(envelope);
            }
            catch (error) {
                console.error('[web-runtime] history frame routing failed:', error);
            }
        },
        onHostEnvelope: (envelope) => {
            sessions.handleHostEnvelope(envelope);
            workspaces.handleHostEnvelope(envelope);
            // Typed-event bridge: the session layer ignores registry frames (no
            // session routing); consumers (command directory caches, the settings
            // and model surfaces) subscribe on ctx.
            const frame = envelope.payload;
            if (frame.type === 'host/commands-changed')
                ctx.emit('commands/changed');
            else if (frame.type === 'host/settings-changed')
                ctx.emit('settings/changed', frame.ns);
            else if (frame.type === 'host/credentials-changed')
                ctx.emit('credentials/changed', frame.ref);
            else if (frame.type === 'host/models-changed')
                ctx.emit('models/changed');
            try {
                sessionHistory.handleHostEnvelope(envelope);
            }
            catch (error) {
                console.error('[web-runtime] history host-frame routing failed:', error);
            }
        },
        onConnected: () => {
            sessions.handleConnected();
            workspaces.handleConnected();
            ctx.emit('connection/reset');
            try {
                sessionHistory.handleConnected();
            }
            catch (error) {
                console.error('[web-runtime] history reconnect failed:', error);
            }
        },
        onStateChange: (state) => {
            // Generation death fires before any next-generation frame can arrive
            // (reconnect replays flow from stream open, ahead of onConnected):
            // the only safe moment to drop generation-scoped interaction state.
            if (state === 'reconnecting') {
                sessions.handleDisconnected();
                try {
                    sessionHistory.handleDisconnected();
                }
                catch (error) {
                    console.error('[web-runtime] history disconnect failed:', error);
                }
            }
        },
    });
    ctx.effect(() => { return () => { loop.stop(); }; }, 'runtime: connection stream loop');
}
//# sourceMappingURL=index.js.map