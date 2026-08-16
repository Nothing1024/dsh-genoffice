/**
 * `tabs.genoffice` namespace dictionaries: the GenOffice tab's own copy.
 * Each tab artifact owns its namespace — the sidebar core never holds other
 * tabs' copy.
 */
/** Simplified Chinese dictionary (the key-set source of truth). */
export declare const zh: {
    'tab.genoffice': string;
};
/** The genoffice tab namespace key union. */
export type GenOfficeTabKey = keyof typeof zh;
/** English dictionary, checked complete against the zh key set. */
export declare const en: {
    'tab.genoffice': string;
};
/** Dictionary namespace owned by the genoffice tab artifact. */
export declare const NS: "tabs.genoffice";
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The genoffice tab bar label. */
        'tabs.genoffice': GenOfficeTabKey;
    }
}
//# sourceMappingURL=locales.d.ts.map