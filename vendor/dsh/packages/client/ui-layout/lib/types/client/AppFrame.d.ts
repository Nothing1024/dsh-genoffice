import type { PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import type { createLayoutStore } from './stores.ts';
/** Full composed props: runtime share + child-slot render share + store share. */
export type AppFrameProps = PropsRuntime<'root'> & PropsRenderSlots<'sidebar' | 'conversation' | 'tabs'> & PropsStore<ReturnType<typeof createLayoutStore>>;
/** The three-column frame: official sidebar left, center, tabs right (see module doc). */
export declare function AppFrame({ useStore, actions, renderSlot, }: AppFrameProps): import("react").JSX.Element;
//# sourceMappingURL=AppFrame.d.ts.map