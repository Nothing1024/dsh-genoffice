/**
 * Command UI plugin, browser half: CommandService (`ctx.command`) owning the
 * capability-keyed directory cache, the '/' command source, the client
 * contribution registry, and the per-session popupSelect controllers; the
 * popupSelect shell self-registers into conversation.input.overlay with
 * per-session resolution.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { CommandService } from './service.ts';
import { type CommandKey } from './locales.ts';
export { CommandService } from './service.ts';
export { CommandDirectory } from './directory.ts';
export type { CommandDescriptor, DirectoryStatus } from './directory.ts';
export { filterOptions, PopupSelectController } from './popup.ts';
export type { PopupSelectDeps, PopupSpec, PopupState, TokenSegment } from './popup.ts';
export type { PopupSelectInjected, PopupSelectViewProps } from './PopupSelectView.tsx';
export type { CommandContribution, CommandDecoration, CommandServiceContract, CommandUiSpec, SelectConfirmation, SelectOption, } from './contract.ts';
export type { CommandKey } from './locales.ts';
declare module 'cordis' {
    interface Context {
        command: CommandService;
    }
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The popupSelect shell's copy. */
        command: CommandKey;
    }
}
/** Required services: the '/' source registry plus the scope + wire faces the service reads, and the copy's locale registry. */
export declare const inject: string[];
/**
 * Client plugin body: mount the service, then register the popupSelect shell
 * into the input overlay once its declarer is up.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map