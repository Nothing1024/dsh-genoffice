/**
 * `tabs.genoffice` namespace dictionaries: the GenOffice tab's own copy.
 * Each tab artifact owns its namespace — the sidebar core never holds other
 * tabs' copy.
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'tab.genoffice': 'GenOffice',
  'tab.file': 'GenOffice 文档',
} satisfies Record<string, string>

/** The genoffice tab namespace key union. */
export type GenOfficeTabKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'tab.genoffice': 'GenOffice',
  'tab.file': 'GenOffice document',
} satisfies Record<GenOfficeTabKey, string>

/** Dictionary namespace owned by the genoffice tab artifact. */
export const NS = 'tabs.genoffice' as const

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The genoffice tab bar label. */
    'tabs.genoffice': GenOfficeTabKey
  }
}
