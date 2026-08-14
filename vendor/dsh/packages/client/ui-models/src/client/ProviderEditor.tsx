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

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { CredentialView, IApiClient, SettingsNamespaceView, SettingsPathOpView } from '@deepseek-ai/dsh-client-connection/client'
import {
  deletePath, getPath, hasPath, nodeAtPath, rehydrateSchema, setPath, validateDraft,
} from '@deepseek-ai/dsh-client-schema-form'
import {
  DeepSeekModelsEditor, modelDrafts, validateDeepSeekModels,
} from './DeepSeekModelsEditor.tsx'
import { EditorFooter } from './EditorFooter.tsx'
import { ModelListEditor } from './ModelListEditor.tsx'
import { deriveKeyRef, messageOf } from './store.ts'
import type { en } from './locales.ts'
import styles from './ModelsSection.module.css'

/** Per-adapter-family curated field sets (unknown namespaces get the hint alone). */
type EditorLayout = 'deepseek' | 'pi-ai' | 'unknown'

/** Reasoning vocabularies per layout; the empty option means "inherit". */
const EFFORT_CHOICES: Record<'deepseek' | 'pi-ai', readonly string[]> = {
  deepseek: ['off', 'high', 'max'],
  'pi-ai': ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
}

/** The draft key the effort select edits, per layout. */
const EFFORT_FIELD: Record<'deepseek' | 'pi-ai', string> = {
  deepseek: 'reasoningEffort',
  'pi-ai': 'reasoning',
}

/** The public DeepSeek endpoint shown as the deepseek base-URL placeholder. */
const DEEPSEEK_PUBLIC_BASE_URL = 'https://api.deepseek.com'

/** Props of {@link ProviderEditor}. */
export interface ProviderEditorProps {
  /** Provider route id. */
  provider: string
  /** Display name for the card title. */
  displayName: string
  /** Hide the title row (the add card renders its own provider select). */
  hideTitle?: boolean
  /** The owning namespace view (schema, layers, secrets). */
  namespace: SettingsNamespaceView
  /** Path from the section root to this provider's profile. */
  settingsPath: readonly string[]
  /** Wire faces for writes and for interrogating a provider endpoint. */
  api: Pick<IApiClient, 'settings' | 'credentials' | 'llm'>
  /** Section copy. */
  t: (key: keyof typeof en) => string
  /** Disable writes (read-only settings provider). */
  readOnly: boolean
  /** Close the editor; `changed` reports whether an Apply committed. */
  onClose: (changed: boolean) => void
}

/** A user-section subtree as a plain draft object (absent → empty). */
function draftAt(namespace: SettingsNamespaceView, path: readonly string[]): Record<string, unknown> {
  const subtree = getPath(namespace.user, path)
  if (typeof subtree !== 'object' || subtree === null || Array.isArray(subtree)) return {}
  return structuredClone(subtree) as Record<string, unknown>
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
export function pathOps(
  base: readonly string[],
  before: unknown,
  after: Record<string, unknown>,
): SettingsPathOpView[] {
  const previous = typeof before === 'object' && before !== null && !Array.isArray(before)
    ? before as Record<string, unknown>
    : {}
  const ops: SettingsPathOpView[] = []
  for (const [key, value] of Object.entries(after)) {
    if (JSON.stringify(previous[key]) === JSON.stringify(value)) continue
    ops.push({ op: 'set', path: [...base, key], value })
  }
  for (const key of Object.keys(previous)) {
    if (!(key in after)) ops.push({ op: 'unset', path: [...base, key] })
  }
  return ops
}

/** The editor layout the owning namespace selects. */
function layoutOf(ns: string): EditorLayout {
  if (ns === 'llm-deepseek') return 'deepseek'
  if (ns === 'llm-pi-ai') return 'pi-ai'
  return 'unknown'
}

/** The credential reference this profile resolves keys through. */
function refFor(namespace: SettingsNamespaceView, path: readonly string[], provider: string): string {
  const profile = getPath(namespace.value, path)
  const named = typeof profile === 'object' && profile !== null
    ? (profile as { apiKeyEnv?: unknown }).apiKeyEnv
    : undefined
  return typeof named === 'string' && named.length > 0 ? named : deriveKeyRef(provider)
}

/**
 * Render one provider's editing card.
 * @param props - the addressed profile plus wire faces and copy.
 * @returns the editor card.
 */
export function ProviderEditor(props: ProviderEditorProps): ReactNode {
  const { namespace, settingsPath, api, t } = props
  const [draft, setDraft] = useState<Record<string, unknown>>(() => draftAt(namespace, settingsPath))
  const [keyDraft, setKeyDraft] = useState('')
  const [keyState, setKeyState] = useState<CredentialView | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  // The revision this card opened at. A write carrying it is refused if
  // anything else — another tab, an external edit of settings.yaml — moved the
  // namespace meanwhile, instead of silently overwriting that change.
  const [openedAt] = useState(() => { return namespace.revision })
  const root = useMemo(() => rehydrateSchema(namespace.schema), [namespace.schema])
  const node = useMemo(() => nodeAtPath(root, settingsPath), [root, settingsPath])
  const fallback = getPath(namespace.value, settingsPath)
  const disabled = props.readOnly || busy
  const layout = layoutOf(namespace.ns)
  const keyRef = refFor(namespace, settingsPath, props.provider)

  useEffect(() => {
    let stale = false
    setKeyState(undefined)
    // The key state is a placeholder hint, not a precondition for editing:
    // neither a business rejection nor a transport failure may reach the
    // browser as an unhandled rejection, so the card simply renders without
    // the "already configured" hint.
    void api.credentials.describe({ refs: [keyRef] }).then(
      (response) => {
        if (stale || !response.result.ok) return
        setKeyState(response.result.value.credentials[keyRef])
      },
      () => undefined,
    )
    return () => { stale = true }
  }, [api.credentials, keyRef])

  const stringAt = (source: unknown, key: string): string | undefined => {
    const value = getPath(source, [key])
    return typeof value === 'string' && value.length > 0 ? value : undefined
  }
  const setField = (key: string, next: string | undefined): void => {
    setDraft(current => next === undefined ? deletePath(current, [key]) : setPath(current, [key], next))
  }

  // The model list is validated by the same per-row checker for both families,
  // so a bad row is named by its position rather than by a blanket message.
  const modelFailure = validateDeepSeekModels(getPath(draft, ['models']))
  // What the form currently shows, which is what an interrogation must ask:
  // an edited-but-unsaved endpoint, and a key typed but not yet stored.
  const probeApi = stringAt(draft, 'api') ?? stringAt(fallback, 'api')
  const probeBaseURL = stringAt(draft, 'baseURL') ?? stringAt(fallback, 'baseURL')
  const probe = {
    settingsNs: namespace.ns,
    // Naming the route lets an adapter that already describes it answer from
    // its own registry — better metadata, no network call, no endpoint needed.
    provider: props.provider,
    ...probeBaseURL === undefined ? {} : { baseURL: probeBaseURL },
    ...probeApi === undefined ? {} : { api: probeApi },
    ...keyDraft.length === 0 ? {} : { apiKey: keyDraft },
  }
  /**
   * The write for this card, or a failure message. Every edit travels as
   * path ops against the STORED section: the draft comes from the redacted
   * descriptor, so a wholesale replace rebuilt from it would delete the
   * literal secrets the wire never returned. Ops name only the fields this
   * card can see, so a stored secret is untouched by construction.
   */
  const applyOnce = async (): Promise<string | undefined> => {
    const ns = namespace.ns
    const original = getPath(namespace.user, settingsPath)
    // The pi-ai profile must name the reference the key stores under, so a
    // dormant add (or a legacy profile without one) records the derivation.
    const next = layout === 'pi-ai' && stringAt(draft, 'apiKeyEnv') === undefined
      && stringAt(fallback, 'apiKeyEnv') === undefined
      ? setPath(draft, ['apiKeyEnv'], keyRef)
      : draft
    {
      // The same checker gates the submit button, so a card cannot reach this
      // with a bad row; it stays because the schema check below would refuse
      // the write with a message naming a path instead of the row, and because
      // nothing but this function decides what is written.
      const failure = validateDeepSeekModels(getPath(next, ['models']))
      /* v8 ignore next 3 -- unreachable from the card: the same failure disables submit */
      if (failure !== undefined) {
        return `${t('model')} ${String(failure.index + 1)}: ${t(failure.key)}`
      }
    }
    /* v8 ignore next -- apply is only reachable from the rendered card, which required a resolved node */
    if (node !== undefined && settingsPath.length === 0) {
      const sectionError = validateDraft(node, next)
      if (sectionError !== undefined) return sectionError
    }
    const ops = pathOps(settingsPath, original, next)
    if (ops.length > 0) {
      const response = await api.settings.mutate({ ns, ops, expectedRevision: openedAt })
      if (!response.result.ok) {
        return response.result.error.code === 'settings-conflict'
          ? t('conflict')
          : response.result.error.message
      }
    }
    if (keyDraft.length > 0) {
      const stored = await api.credentials.set({ ref: keyRef, value: keyDraft })
      if (!stored.result.ok) return stored.result.error.message
    }
    setKeyDraft('')
    return undefined
  }

  const apply = async (): Promise<void> => {
    setBusy(true)
    setFailure(undefined)
    try {
      const failure = await applyOnce()
      if (failure !== undefined) {
        setFailure(failure)
        return
      }
      props.onClose(true)
    } catch (error) {
      // A transport failure (disconnect, a request the host refuses) rejects
      // rather than answering; without this the card would stay busy forever
      // with no error shown.
      setFailure(messageOf(error))
    } finally {
      setBusy(false)
    }
  }

  if (node === undefined) {
    // A directory entry addressing a position its schema cannot resolve is a
    // host-side inconsistency; showing it beats a blank card.
    return <p className={styles['error']}>{`${props.provider}: unresolvable settings path`}</p>
  }

  const keyLocked = keyState?.writable === false

  /**
   * The catalog beneath the user layer: what the composition entry pinned, or
   * else the schema default that `resolve` would supply. The effective value
   * cannot answer this — it still carries the stored override until the unset
   * is applied, so reading it would echo that override straight back the
   * moment reset drops it, leaving the rows unchanged until a reload.
   */
  const inheritedModels = (): unknown => {
    const pinned = getPath(namespace.base, [...settingsPath, 'models'])
    return pinned ?? nodeAtPath(root, [...settingsPath, 'models'])?.meta.default
  }

  /**
   * The curated fields of one known adapter family. Taking the narrowed
   * family as a parameter is what makes `EFFORT_FIELD` total here: an
   * unknown namespace never reaches this body.
   */
  const curatedFields = (family: 'deepseek' | 'pi-ai'): ReactNode => {
    const effortField = EFFORT_FIELD[family]
    const customModels = getPath(draft, ['models'])
    const modelsOverridden = hasPath(draft, ['models'])
    const models = modelDrafts(modelsOverridden ? customModels : inheritedModels())
    const defaultContextWindow = getPath(fallback, ['defaultContextWindow'])
    const defaultMaxTokens = getPath(fallback, ['maxTokens'])
    /** What both family editors take: the rows, whose layer owns them, and the two writes. */
    const catalogProps = {
      models,
      overridden: modelsOverridden,
      t,
      disabled,
      onChange: (next: Record<string, unknown>[]) => {
        setDraft(current => setPath(current, ['models'], next))
      },
      onReset: () => { setDraft(current => deletePath(current, ['models'])) },
    }
    return (
      <>
        <div className={styles['field']}>
          <span className={styles['fieldLabel']}>{t('keyInput')}</span>
          <input
            className={styles['input']}
            type="password"
            autoComplete="off"
            value={keyDraft}
            placeholder={keyLocked
              ? t('keyEnvLocked')
              : keyState?.configured === true ? t('keyStored') : t('keyPlaceholder')}
            aria-label={t('keyInput')}
            disabled={disabled || keyLocked}
            onChange={(event) => { setKeyDraft(event.target.value) }}
          />
        </div>
        <details className={styles['customized']}>
          <summary className={styles['customizedSummary']}>{t('customized')}</summary>
          <div className={styles['customizedBody']}>
            <div className={styles['field']}>
              <span className={styles['fieldLabel']}>{t('baseUrl')}</span>
              <input
                className={styles['input']}
                type="text"
                value={stringAt(draft, 'baseURL') ?? ''}
                placeholder={family === 'deepseek'
                  ? DEEPSEEK_PUBLIC_BASE_URL
                  : stringAt(fallback, 'baseURL') ?? t('baseUrlDefault')}
                aria-label={t('baseUrl')}
                disabled={disabled}
                onChange={(event) => {
                  setField('baseURL', event.target.value === '' ? undefined : event.target.value)
                }}
              />
            </div>
            <div className={styles['field']}>
              <span className={styles['fieldLabel']}>{t('effort')}</span>
              <select
                className={`${styles['input']} ${styles['selectInput']}`}
                value={stringAt(draft, effortField) ?? ''}
                aria-label={t('effort')}
                disabled={disabled}
                onChange={(event) => {
                  setField(effortField, event.target.value === '' ? undefined : event.target.value)
                }}
              >
                <option value="">{t('effortInherit')}</option>
                {EFFORT_CHOICES[family].map(choice => (
                  <option key={choice} value={choice}>{choice}</option>
                ))}
              </select>
            </div>
            {/* Both families edit the same rows through the same contract; only
                the extras differ — DeepSeek's inherited capacities, pi-ai's
                endpoint interrogation. */}
            {family === 'deepseek'
              ? (
                <DeepSeekModelsEditor
                  {...catalogProps}
                  defaultContextWindow={typeof defaultContextWindow === 'number'
                    ? defaultContextWindow
                    : undefined}
                  defaultMaxTokens={typeof defaultMaxTokens === 'number' ? defaultMaxTokens : undefined}
                />
              )
              : <ModelListEditor {...catalogProps} probe={probe} api={api} />}
          </div>
        </details>
      </>
    )
  }

  return (
    <div className={styles['editor']}>
      {props.hideTitle === true
        ? null
        : (
          <div className={styles['editorHeader']}>
            <span className={styles['editorTitle']}>{props.displayName}</span>
            {props.provider !== props.displayName
              ? <span className={styles['editorRoute']}>{props.provider}</span>
              : null}
          </div>
        )}
      {layout === 'unknown'
        ? <p className={styles['advancedHint']}>{`${t('advancedHint')} (${namespace.ns})`}</p>
        : curatedFields(layout)}
      {failure === undefined ? null : <p className={styles['error']}>{failure}</p>}
      {modelFailure === undefined
        ? null
        : (
          <p className={styles['advancedHint']}>
            {`${t('model')} ${String(modelFailure.index + 1)}: ${t(modelFailure.key)}`}
          </p>
        )}
      <EditorFooter
        t={t}
        busy={busy}
        submitDisabled={disabled || layout === 'unknown' || modelFailure !== undefined}
        submitLabel="apply"
        submitBusyLabel="applying"
        onCancel={() => { props.onClose(false) }}
        onSubmit={() => { void apply() }}
      />
    </div>
  )
}
