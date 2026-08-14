import { SlashService } from "./service.js";
import { MenuView } from "./MenuView.js";
import { en, zh } from "./locales.js";
export { SlashService } from "./service.js";
export { SlashController } from "./controller.js";
/** Namespace owning the candidate-menu copy. */
const MENU_NS = 'slash.menu';
/** Required services: controller resolution reads the session scope tree; the menu copy is localized. */
export const inject = ['sessions', 'locale'];
/**
 * Client plugin body: mount the service, then register MenuView into the
 * input overlay once its declarer is up.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.plugin(SlashService);
    ctx.effect(() => ctx.locale.register(MENU_NS, { zh, en }), 'ui-slash: menu dictionaries');
    ctx.inject(['slots', 'slash', 'sessions'], (scope) => {
        const slash = scope.slash;
        const sessions = scope.sessions;
        scope.slots.inject('conversation.input.overlay', () => scope.slots.register({
            name: 'conversation.input.overlay',
            id: 'slash-menu',
            order: 0,
            locale: MENU_NS,
            inject: (sessionId) => {
                // Session-scoped slot: resolve this session's controller (the slot
                // frame hands ids, not ctx — the registered id→ctx interchange).
                const actx = sessions.scope(sessionId);
                if (actx === undefined) {
                    throw new Error(`ui-slash: session "${String(sessionId)}" resolved no scope`);
                }
                const controller = slash.sessionOf(actx);
                return {
                    menu: controller.menu,
                    onPick: (source, index) => { controller.pick(source, index); },
                    onDismiss: () => { controller.dismiss(); },
                };
            },
        }, MenuView));
    });
}
//# sourceMappingURL=index.js.map