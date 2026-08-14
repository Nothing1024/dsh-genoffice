/**
 * Layout plugin, browser half: one register() call contributes AppFrame into
 * the runtime's built-in 'root' slot and, in the same breath, declares the
 * four child slots (declaration = exclusive render authority), seats the
 * layout store (panel geometry), and wires the panel-action service face.
 * ctx.layout is the cross-plugin panel-action seam; navigation state lives
 * with the runtime sessions service. A second effect seats the theme
 * presenter, which projects ctx.theme snapshots onto document.body.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export { LayoutService } from './service.ts';
export type { ILayout } from './service.ts';
declare module 'cordis' {
    interface Context {
        /** The outward face only; the concrete service stays inside this plugin. */
        layout: import('./service.ts').ILayout;
    }
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        'sidebar': {
            kind: 'single';
            scope: 'root';
            owner: SidebarOwnerProps;
        };
        'tabs': {
            kind: 'single';
            scope: 'root';
            owner: SidebarOwnerProps;
        };
        'conversation': {
            kind: 'single';
            scope: 'session-maybe';
            owner: ConvOwnerProps;
        };
        'details': {
            kind: 'single';
            scope: 'session';
            owner: DetailsOwnerProps;
        };
    }
}
/** Sidebar owner share: live column state from the frame's concession solve. */
export interface SidebarOwnerProps {
    /** True when the sidebar is closed (the column renders the compact control rail). */
    collapsed: boolean;
    /** Rendered column width in px (SIDEBAR_COLLAPSED when collapsed). */
    width: number;
}
/** Conversation owner share: business state and actions belong to the registrant. */
export interface ConvOwnerProps {
}
/** Details owner share: empty — sessionId arrives as a framework-standard prop. */
export interface DetailsOwnerProps {
}
/** Required services (cordis fiber inject — the loader passes the whole export surface as an object plugin). */
export declare const inject: string[];
/**
 * Client plugin body: provide ctx.layout, then one register() call — AppFrame
 * into 'root' with the four child-slot declarations, the layout store seat,
 * and the inject hook that hands the store's bound actions to the service.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map