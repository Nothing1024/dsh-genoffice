// DetailsPanel, P-I minimal form: close button + the selected call's args and
// result — args as JSON, the result raw except for a terminal-card call, whose
// Output section is the command's terminal card. The three-段 Switch /
// Prev-Next stepping / See-in-trajectory are deferred (ledger). Reads the
// selection from the shared chat
// store (conversation writes, this panel reads — the cross-registration
// share the store seat exists for) and derives the call material from the
// session snapshot — no data of its own.

import { CodeBlock, DiffBlock, ReadBlock, SearchBlock, TerminalBlock, WebBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import { shallowEqual } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConversationSnapshot, RunningToolCall, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'
import type { DetailsSlotProps } from '../contract/slots.ts'
import { readCardModel } from '../contract/read-card-model.ts'
import { diffCardModel } from '../contract/diff-card-model.ts'
import { searchCardModel } from '../contract/search-card-model.ts'
import { terminalBlockLabels, terminalCardModel } from '../contract/terminal-card-model.ts'
import { webCardModel } from '../contract/web-card-model.ts'
import { resultText, type ToolCallBlock } from '../contract/tool-call-model.ts'
import css from './DetailsPanel.module.css'

/** Full props composed by reference from the contract (automatic shares & injected share). */
export type DetailsPanelProps = DetailsSlotProps

/**
 * Selected call material: the call's display name and args plus the frozen
 * block slice it came from. `block` is a snapshot-cached reference, so the
 * wrapper stays shallow-equal across unrelated snapshot frames; the settled /
 * running split is read off it with the `'kind' in block` discrimination
 * instead of duplicated as flags.
 */
interface CallMaterial {
  name: string
  argsRaw: string | null
  block: ToolCallBlock
}

/** Material of a settled result node (native call or run_code sub-dispatch). */
function settledMaterial(node: ToolResultNode, callId: string): CallMaterial {
  return { name: node.call?.name ?? callId, argsRaw: node.call?.argsRaw ?? null, block: node }
}

/** Material of an in-flight call (native call or run_code sub-dispatch). */
function runningMaterial(call: RunningToolCall): CallMaterial {
  return { name: call.name, argsRaw: call.argsRaw, block: call }
}

function materialFor(s: ConversationSnapshot, callId: string): CallMaterial | null {
  for (const node of s.nodes) {
    if (node.kind === 'tool-result' && node.callId === callId) return settledMaterial(node, callId)
  }
  const open = s.runningCalls.find(c => c.callId === callId)
  if (open !== undefined) return runningMaterial(open)
  // run_code sub-dispatches: the native call-block shapes, so a selected
  // sub-row resolves through the same material as a native call — the
  // settled ToolResultNode form, or the RunningToolCall form mid-flight.
  for (const subs of s.codeDispatches.values()) {
    for (const sub of subs) {
      if (sub.callId !== callId) { continue }
      return 'kind' in sub ? settledMaterial(sub, callId) : runningMaterial(sub)
    }
  }
  return null
}

function pretty(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    // Not JSON (streaming fragment or plain text): show verbatim.
    return raw
  }
}

export function DetailsPanel({ useSession, useSessions, sessionId, useStore, closeDetails, renderSlot, t }: DetailsPanelProps) {
  const selection = useStore(s => s.selection)
  // Session workspace root: an omitted or relative terminal cwd resolves
  // against it, which the pure presenter cannot see.
  const sessionCwd = useSessions(list => list.byId[sessionId]?.cwd)
  const callId = selection?.callId
  // materialFor builds a fresh wrapper; shallowEqual short-circuits on its
  // stable members (result node reference rides the snapshot's structural sharing).
  const material = useSession(
    s => (callId === undefined ? null : materialFor(s, callId)),
    (a, b) => { return shallowEqual(a, b) })

  return (
    <div className={css.root}>
      <div className={css.header}>
        <div className={css.title}>
          {selection === null ? t('details.title') : material?.name ?? selection.toolName ?? t('details.title')}
        </div>
        <button
          type="button" className={css.close} aria-label={t('details.close')}
          onClick={() => { closeDetails() }}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className={css.body}>
        {selection === null || callId === undefined
          ? <div className={css.empty}>{t('details.empty')}</div>
          : material === null
            ? <div className={css.empty}>{t('details.notInWindow')}</div>
            : (
              <>
                {material.argsRaw !== null && (
                  <section className={css.section}>
                    <div className={css.sectionLabel}>{t('details.input')}</div>
                    <CodeBlock code={pretty(material.argsRaw)} lang="json" copyLabel={t('copy')} copiedLabel={t('copied')} />
                  </section>
                )}
                <section className={css.section}>
                  <div className={css.sectionLabel}>{t('details.output')}</div>
                  {/* Keyed by the selected call: the body owns per-call view
                      state (the terminal card's expand and copy), which React
                      would otherwise carry into the next selection because the
                      panel does not unmount between calls. */}
                  <OutputBody key={callId} material={material} cwd={sessionCwd} t={t} renderSlot={renderSlot} callId={callId} />
                </section>
              </>
            )}
      </div>
    </div>
  )
}

/**
 * The Output section's body for the selected call. A terminal-card call — a
 * shell command's call/result views — renders through the shared TerminalBlock
 * at the primitive's own full height allowance, so column-aligned output keeps
 * its alignment and scrolls sideways instead of folding. A read-card call
 * renders through the shared ReadBlock at that same full height, so the whole
 * returned window is line-numbered and highlighted. A diff-card call — a
 * write/edit's applied change — renders through the shared DiffBlock at the same
 * full height. A search-card call — a `grep`/`glob` result view — renders
 * through the shared SearchBlock at the same full height allowance, with a
 * capped search's recovery footer below it. A web-card call — a
 * `web_search`/`web_fetch` result — renders through WebBlock at its own full
 * source-list allowance. Every other call, and a running call with no card yet,
 * keeps the flattened text form.
 * @param props.material - the selected call's material from {@link materialFor}.
 * @param props.cwd - the session workspace root, resolving the terminal view's cwd.
 * @param props.t - the panel's locale seat, passed down as a plain prop.
 * @returns the Output section's body element.
 */
function OutputBody({ material, cwd, t, renderSlot, callId }: {
  material: CallMaterial
  cwd: string | undefined
  t: DetailsPanelProps['t']
  renderSlot: DetailsPanelProps['renderSlot']
  callId: string
}) {
  const terminal = terminalCardModel(material.block, cwd)
  if (terminal !== null) {
    // The contract renders the presenter's description above the card, and the
    // panel has no summary row to carry it, so it is drawn here.
    return (
      <>
        {terminal.description !== undefined && (
          <div className={css.terminalDescription}>{terminal.description}</div>
        )}
        <TerminalBlock {...terminal.card} labels={terminalBlockLabels(t)} className={css.cardBody} />
      </>
    )
  }
  const read = readCardModel(material.block, cwd)
  // The panel takes the primitive's own default cap, not the row's tighter one:
  // it is the single-call reading surface, so the whole window is available.
  if (read !== null) return <ReadBlock {...read} className={css.read} />
  const diff = diffCardModel(material.block)
  if (diff !== null) return <DiffBlock {...diff.card} className={css.cardBody} />
  const search = searchCardModel(material.block)
  if (search !== null) {
    return (
      <>
        <SearchBlock {...search.card} className={css.cardBody} />
        {/* A capped search's recovery locator lives only in the result text;
            show it below the card so the dropped rows stay reachable. */}
        {search.recovery !== undefined && (
          <div className={css.searchRecovery}>{search.recovery}</div>
        )}
      </>
    )
  }
  const web = webCardModel(material.block)
  // The card shows every source the tool returned (the same list the model saw),
  // scrolling within its own capped height. Below the card the panel also renders
  // the flattened result content — the model-visible text the card does not carry
  // verbatim (a web_fetch card shows only the URL and status, so its fetched body
  // lives only here; a search card's answer and sources are structured, so the
  // flattened form repeats them as the raw text the model saw).
  if (web !== null) {
    const settled = 'kind' in material.block ? material.block : null
    const body = settled === null ? '' : resultText(settled)
    return (
      <>
        <WebBlock {...web} className={css.web} />
        {body !== '' && <pre className={css.code}>{body}</pre>}
      </>
    )
  }
  // A settled call always carries the result node the flattened form needs;
  // the running shape has no result to flatten.
  if (!('kind' in material.block)) {
    // An in-flight call: let the keyed output hole render its running surface
    // (a feature plugin streams generation progress here); the fallback is
    // the panel's plain running text, exactly as before the hole existed.
    const toolName = material.block.name
    return renderSlot('conversation.details.toolview', {
      callId,
      toolName,
      // The running shape stands in for the settled block; registrants
      // discriminate with `'kind' in block`.
      block: material.block,
    }, {
      entryKey: toolName,
      fallback: <div className={css.empty}>{t('details.running')}</div>,
    })
  }
  const result = material.block
  const toolName = result.call?.name
  const flattened = (
    <pre className={css.code} data-error={result.isError || undefined}>
      {resultText(result)}
    </pre>
  )
  // A window-truncated call head has no wire tool name to key on; render the
  // flattened form directly instead of pretending a keyed dispatch key.
  if (toolName === undefined) return flattened
  // The keyed output hole lets a feature plugin render the selected call's
  // output (e.g. ui-artifact's full document); the fallback is exactly the
  // flattened result text this arm rendered before the hole existed, so
  // unregistered tools are byte-identical (UF-002).
  return renderSlot('conversation.details.toolview', { callId, toolName, block: result }, {
    entryKey: toolName,
    fallback: flattened,
  })
}
