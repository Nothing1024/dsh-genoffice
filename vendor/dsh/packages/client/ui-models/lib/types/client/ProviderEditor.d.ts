/**
 * One provider's editor card, hand-written per adapter family: the primary
 * field is a single write-only **API key** input (the page never asks for an
 * environment-variable name — a typed key stores through `credentials.set`
 * under the profile's reference, deriving `<ROUTE>_API_KEY` when the profile
 * has none, and the pi-ai profile records that derivation as `apiKeyEnv`);
 * the collapsed 自定义设置 area carries the per-family extras (`baseURL` for
 * both families, `reasoningEffort` for deepseek / `reasoning` for pi-ai, and
 * DeepSeek's id/name/context-window model catalog). Everything else stays
 * owned by `settings.yaml`. Profile edits land as minimal `settings.mutate`
 * path ops against the stored section — the card reads the redacted
 * descriptor, so it names only the fields it can see and a stored literal
 * secret is never collaterally removed.
 */
import type { ReactNode } from 'react';
import type { IApiClient, SettingsNamespaceView, SettingsPathOpView } from '@deepseek-ai/dsh-client-connection/client';
import type { en } from './locales.ts';
/** Props of {@link ProviderEditor}. */
export interface ProviderEditorProps {
    /** Provider route id. */
    provider: string;
    /** Display name for the card title. */
    displayName: string;
    /** Hide the title row (the add card renders its own provider select). */
    hideTitle?: boolean;
    /** The owning namespace view (schema, layers, secrets). */
    namespace: SettingsNamespaceView;
    /** Path from the section root to this provider's profile. */
    settingsPath: readonly string[];
    /** Wire faces for writes and for interrogating a provider endpoint. */
    api: Pick<IApiClient, 'settings' | 'credentials' | 'llm'>;
    /** Section copy. */
    t: (key: keyof typeof en) => string;
    /** Disable writes (read-only settings provider). */
    readOnly: boolean;
    /** Close the editor; `changed` reports whether an Apply committed. */
    onClose: (changed: boolean) => void;
}
/**
 * The minimal path ops carrying `after` over `before`, both as the card sees
 * them (that is, redacted). Only keys the card observed are named: a stored
 * `role('secret')` field appears in neither side, so it produces no op and
 * survives the write — the whole reason edits are path-addressed rather than
 * a rebuilt section.
 * @param base - path of the edited subtree inside the user section.
 * @param before - the subtree as loaded, or undefined when it is new.
 * @param after - the subtree as edited.
 * @returns ordered set/unset ops; empty when nothing changed.
 */
export declare function pathOps(base: readonly string[], before: unknown, after: Record<string, unknown>): SettingsPathOpView[];
/**
 * Render one provider's editing card.
 * @param props - the addressed profile plus wire faces and copy.
 * @returns the editor card.
 */
export declare function ProviderEditor(props: ProviderEditorProps): ReactNode;
//# sourceMappingURL=ProviderEditor.d.ts.map