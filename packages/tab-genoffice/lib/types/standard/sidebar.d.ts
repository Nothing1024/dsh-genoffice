/**
 * Official right-Sidebar service face used by this plugin.
 *
 * Types are local so the standard layer stays free of `@deepseek-ai/*` imports
 * (adapter-baseline + facet-entry purity). Runtime values come from
 * `ctx.sidebarRight` / `ctx.sidebarRightTabs` / `ctx.slots` in 0.1.7-rc.1.
 */
export declare const GENOFFICE_KIND = "genoffice";
export declare const GENOFFICE_TAB_ID = "@deepseek-ai/dsh-tab-genoffice";
export declare const GENOFFICE_FILE_KIND = "genoffice-file";
export declare const GENOFFICE_FILE_TAB_ID = "@deepseek-ai/dsh-tab-genoffice/file";
export type SidebarRightTabPriority = 'extension' | 'builtin' | 'fallback';
export interface SidebarRightGuideEntry {
    /** Stable identity within this provider. Required by the registry since 0.1.6-alpha.1. */
    readonly id: string;
    readonly order: number;
    readonly title: () => string;
    readonly description?: () => string;
    readonly icon?: (props: {
        size?: number;
        className?: string;
    }) => unknown;
}
export interface SidebarRightTabDefinition {
    readonly id: string;
    readonly kind: string;
    readonly patterns?: readonly string[];
    readonly priority?: SidebarRightTabPriority;
    readonly canOpen?: (address: string) => boolean;
    readonly title: (address: string) => string;
    readonly guide?: readonly SidebarRightGuideEntry[];
}
export interface SidebarRightOpenResourceOptions {
    readonly kind?: string;
    readonly paneId?: string;
    readonly replaceTab?: string | boolean;
    readonly revealIfOpened?: boolean;
}
export interface SidebarRightService {
    openResource(address: string, options?: SidebarRightOpenResourceOptions): void;
    openTab(kind: string, options?: SidebarRightOpenResourceOptions): void;
    close(tabId: string): void;
}
export interface SidebarRightTabRegistry {
    register(definition: SidebarRightTabDefinition): () => void;
}
export type SlotComponent = (props: Record<string, unknown>) => unknown;
export interface SlotRegisterOptions {
    readonly name: string;
    readonly key: string;
    readonly locale?: string;
}
export interface SlotRegistry {
    inject(name: string, register: () => () => void): () => void;
    register(options: SlotRegisterOptions, component: SlotComponent): () => void;
}
export interface OfficialSidebar {
    readonly sidebarRight: SidebarRightService;
    readonly sidebarRightTabs: SidebarRightTabRegistry;
    readonly slots: SlotRegistry;
    /** Mounted conversation session, when the adapter can see one. */
    readonly sessionId?: string;
}
export interface SidebarTabActions {
    openResource(address: string, options?: SidebarRightOpenResourceOptions): void;
    openTab(kind: string, options?: SidebarRightOpenResourceOptions): void;
    close(): void;
}
export interface SidebarTabInfo {
    readonly tab: {
        readonly id: string;
        readonly title: string;
        readonly contentId: string;
        readonly kind: string;
        readonly actions: SidebarTabActions;
    };
    readonly sessionId?: string;
}
export type UseSidebarTabInfo = () => SidebarTabInfo;
/**
 * Official `useSessions` is a store selector hook (`useSelector`), not a
 * no-arg snapshot reader. Calling it without a selector throws
 * `TypeError: l is not a function` inside useSyncExternalStoreWithSelector.
 * The snapshot uses `current` (not `currentId`).
 */
export interface SessionListSnapshot {
    readonly current?: string;
    readonly byId?: Record<string, {
        cwd?: string;
    } | undefined>;
}
export type UseSessions = <Selected>(selector: (sessions: SessionListSnapshot) => Selected) => Selected;
export interface SidebarPaneTabProps {
    readonly useTabInfo: UseSidebarTabInfo;
    readonly sessionId?: string;
    readonly useSessions?: UseSessions;
}
//# sourceMappingURL=sidebar.d.ts.map