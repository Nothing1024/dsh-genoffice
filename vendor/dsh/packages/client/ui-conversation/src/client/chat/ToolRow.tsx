// ToolRow: the single-line tool summary row (figma component set 122:9479) —
// 16px leading slot (state dot / tool icon, chevron on hover or expanded) + title +
// separator dot + FILL-truncated summary, drawn through the shared
// DisclosureRow chrome with the whole row as the expand toggle (click /
// Enter / Space, icon→chevron hover preview). The collapsed row is always
// one line; every row with body, output, or a card material (terminal, diff,
// read, search, web) is expandable; the summary stays inline while open,
// except Think, where the running collapsed row follows the latest line at its
// scroll end and the summary yields while open to avoid repeating the body.
// The expanded body — an IN/OUT gutter-labeled card (figma 1249:35657) for
// text input/output, the run_code program through CodeBlock, or a card
// primitive (TerminalBlock, DiffBlock, ReadBlock, SearchBlock, WebBlock) for a
// call that declared that render intent — lives in a max-height scroll
// container so a long payload scrolls internally instead of taking over the
// message flow; Think's prose is the exception and flows uncapped like message
// text. Every card kind starts collapsed, so a run of tool calls stays
// scannable; the details panel is the single-call full-height reading surface.
// Expand state is component-local view state. File-tool summaries are path
// links that open through the host (stopPropagation keeps the two gestures
// independent); an error row's collapsed summary is the failure's first line in
// the error color.

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  CodeBlock, DiffBlock, ReadBlock, SearchBlock, StateDot, TerminalBlock, WebBlock,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { WebBlockProps } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { CHAT_DIFF_MAX_LINES, type DiffCardModel } from '../contract/diff-card-model.ts'
import { CHAT_READ_MAX_LINES, type ReadCardModel } from '../contract/read-card-model.ts'
import { CHAT_SEARCH_MAX_LINES, type SearchCardModel } from '../contract/search-card-model.ts'
import { terminalBlockLabels, type TerminalCardModel } from '../contract/terminal-card-model.ts'
import type { ToolRowState, ToolRowVariant } from '../contract/tool-call-model.ts'
import { DisclosureRow } from './DisclosureRow.tsx'
import { useThrottledVisualUpdate } from './use-throttled-visual-update.ts'
import css from './ToolRow.module.css'

export interface ToolRowProps {
  /** The render site's conversation locale seat (terminal/code body copy). */
  t: TranslateNS<'conversation'>
  variant: ToolRowVariant
  /** Wire tool name for tool-owned styling layered over the generic variant. */
  toolName?: string | undefined
  /** Leading 16px tool icon, shown while collapsed and not running/failed. */
  icon: ReactNode
  title: string
  summary: string
  /** Expanded-body input text; null = no input section. */
  body: string | null
  /** Flattened result text for the expanded Output section; null/absent = no output section. */
  output?: string | null | undefined
  /** Error first line shown as the collapsed summary on an error row; null/absent = keep `summary`. */
  errorSummary?: string | null | undefined
  /**
   * Terminal-card material for a call whose render intent is a terminal card
   * (derived by `terminalCardModel`); it replaces the text sections when
   * present. A call carries at most one card kind, so the card props below are
   * mutually exclusive.
   */
  terminal?: TerminalCardModel | null | undefined
  /**
   * Diff-card material for a call whose render intent is a diff card (derived by
   * `diffCardModel`); it replaces the text body when present, the same way
   * `terminal` does.
   */
  diff?: DiffCardModel | null | undefined
  /**
   * Read-card material for a call whose render intent is a read card (derived by
   * `readCardModel`); it replaces the text body with the file's line-numbered,
   * syntax-highlighted window when present.
   */
  read?: ReadCardModel | null | undefined
  /**
   * Search-card material for a call whose render intent is a search card
   * (derived by `searchCardModel`); it replaces the text body with grouped
   * matches or a path list when present.
   */
  search?: SearchCardModel | null | undefined
  /**
   * Web-card material for a call whose render intent is a web card (derived by
   * `webCardModel`); it replaces the text body with the retrieval's citation
   * list or fetched-source card when present.
   */
  web?: WebBlockProps | null | undefined
  state: ToolRowState
  /**
   * Filesystem path from tool args; when set with onOpenFile, the summary
   * renders as a hover-underline link that opens the host default app.
   */
  filePath?: string | undefined
  /** Open the path with the host OS default application (already cwd-resolved). */
  onOpenFile?: ((path: string) => void) | undefined
  /**
   * Jump to this call in the trajectory view: a hover-revealed Inspect pill
   * over the expanded body. Absent = no affordance (rows without a call
   * identity, like Think).
   */
  inspect?: (() => void) | undefined
}

/** The Inspect pill's code glyph (user-supplied 16×16), fill follows text color. */
function IconInspect() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M16 8L10.8571 12V10.552L14.1383 8L10.8571 5.448V4L16 8ZM5.14286 10.552L1.86171 8L5.14286 5.448V4L0 8L5.14286 12V10.552ZM9.02514 4L5.59657 12H6.84057L10.2691 4H9.02514Z" fill="currentColor" />
    </svg>
  )
}

/** Leading-slot state substitution: the tool icon yields to the terminal state
 *  semantic (error = red, interrupted = amber halo). Running keeps the icon —
 *  the row sweep (CSS on data-state) carries the in-flight signal. */
function leadingFor(state: ToolRowState, icon: ReactNode): ReactNode {
  switch (state) {
    case 'error': return <StateDot state="error" />
    case 'stopped': return <StateDot state="warning" />
    default: return icon
  }
}

/** Visually hidden run-state label: the StateDot and the CSS sweep are both
 *  aria-hidden / colour-only, so assistive technology needs this text to know a
 *  row is running, failed, or interrupted. null in the ok state (the icon and
 *  summary already describe a settled row). */
function stateStatus(state: ToolRowState, t: TranslateNS<'conversation'>): string | null {
  switch (state) {
    case 'running': return t('row.running')
    case 'error': return t('row.failed')
    case 'stopped': return t('row.stopped')
    default: return null
  }
}

export function ToolRow({
  t,
  variant,
  toolName,
  icon,
  title,
  summary,
  body,
  output,
  errorSummary,
  terminal,
  diff,
  read,
  search,
  web,
  state,
  filePath,
  onOpenFile,
  inspect,
}: ToolRowProps) {
  const [expanded, setExpanded] = useState(false)
  const summaryRef = useRef<HTMLSpanElement>(null)
  const terminalBody = terminal ?? null
  const diffBody = diff ?? null
  const readBody = read ?? null
  const searchBody = search ?? null
  const webBody = web ?? null
  const outputText = output ?? null
  // A card replaces the text body; a call carries at most one card kind, so the
  // card props are mutually exclusive. Any of them, or a text body/output,
  // makes the row expandable.
  const card = terminalBody ?? diffBody ?? readBody ?? searchBody ?? webBody
  const expandable = body !== null || outputText !== null || card !== null
  const open = expanded && expandable
  // The run-state label AT needs: the StateDot and the running sweep are both
  // aria-hidden / colour-only, so a stopped or running row is otherwise silent.
  const status = stateStatus(state, t)
  // An error row's collapsed summary IS the failure: the first error line in
  // the error color outranks both the args summary and a terminal description.
  const failureLine = state === 'error' ? errorSummary ?? null : null
  const summaryText = failureLine ?? summary
  // The failure line is error prose, not the path: no open-file affordance.
  const fileLink = filePath !== undefined && onOpenFile !== undefined && failureLine === null
  const isThink = variant === 'think'
  const followSummaryEnd = isThink && state === 'running' && !open
  const scheduleSummaryScroll = useThrottledVisualUpdate(() => {
    const summaryElement = summaryRef.current
    if (summaryElement === null) return
    summaryElement.scrollLeft = followSummaryEnd
      ? summaryElement.scrollWidth - summaryElement.clientWidth
      : 0
  })
  useEffect(() => {
    if (!isThink) return
    scheduleSummaryScroll()
  }, [followSummaryEnd, isThink, scheduleSummaryScroll, summaryText])
  const toggleExpand = () => {
    setExpanded(v => !v)
  }
  const openFile = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (filePath !== undefined) onOpenFile?.(filePath)
  }
  // Keep Enter/Space on the focused path link from bubbling to the row's
  // keydown handler, which would preventDefault() the key and toggle expand
  // instead of activating the link — the keyboard analogue of openFile's
  // stopPropagation. The native button still fires its own onClick from the key.
  const fileLinkKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') event.stopPropagation()
  }
  // Think reasoning is prose, not an input payload: expanded, it renders as
  // plain indented text (no IN/OUT card) and the inline summary yields to avoid
  // repeating the body.
  // The code variant's program renders through CodeBlock (shiki), so only its
  // output joins the IN/OUT card; every other variant's input does too.
  const cardBody = variant !== 'code' ? body : null
  // The state substitution rides the idle icon slot, so an expandable error
  // row keeps DisclosureRow's icon→chevron hover preview (its default) instead
  // of losing it with the icon.
  return (
    <div className={css.root} data-variant={variant} data-tool={toolName} data-state={state}>
      {status !== null && <span className={css.visuallyHidden}>{status}</span>}
      <DisclosureRow
        rowClassName={css.row}
        leadingClassName={css.leading}
        titleClassName={css.title}
        chevronClassName={css.chevron}
        icon={leadingFor(state, icon)}
        title={title}
        open={open}
        expandable={expandable}
        expandOnRowClick
        keepContentWhenOpen={!isThink}
        onToggle={toggleExpand}
        collapsedContent={summaryText !== '' && (
          /* An empty summary drops the separator with it (a row that is only
             its title shows no trailing dot). */
          <>
            <span className={css.sep} aria-hidden />
            {fileLink ? (
              <button
                type="button"
                className={css.fileLink}
                onClick={openFile}
                onKeyDown={fileLinkKeyDown}
              >
                {summaryText}
              </button>
            ) : (
              <span
                ref={isThink ? summaryRef : undefined}
                className={clsx(css.summary, failureLine !== null && css.errorSummary)}
                data-follow-end={followSummaryEnd || undefined}
              >
                {summaryText}
              </span>
            )}
          </>
        )}
      >
        {/* The wrapper (sibling of the header row, so clicks inside never
            toggle it) carries the expanded body and the Inspect pill below. */}
        <div className={css.bodyWrap}>
          {terminalBody !== null
            ? (
              <TerminalBlock
                {...terminalBody.card}
                maxLines={Infinity}
                labels={terminalBlockLabels(t)}
                className={css.terminalBody}
              />
            )
            : diffBody !== null
              ? <DiffBlock {...diffBody.card} maxLines={CHAT_DIFF_MAX_LINES} className={css.diffBody} />
              : readBody !== null
                ? <ReadBlock {...readBody} maxLines={CHAT_READ_MAX_LINES} className={css.readBody} />
                : searchBody !== null
                  ? (
                    <>
                      <SearchBlock {...searchBody.card} maxLines={CHAT_SEARCH_MAX_LINES} className={css.searchBody} />
                      {/* A capped search's recovery locator lives only in the result
                          text; show it below the card so the dropped rows survive. */}
                      {searchBody.recovery !== undefined && (
                        <div className={css.searchRecovery}>{searchBody.recovery}</div>
                      )}
                    </>
                  )
                  : webBody !== null
                    ? <WebBlock {...webBody} className={css.webBody} />
                    : isThink
                      ? <div className={css.thinkBody}>{body}</div>
                      : (
                        <>
                          {variant === 'code' && body !== null && (
                            <div className={css.bodyScroll}>
                              <CodeBlock code={body} lang="typescript" copyLabel={t('copy')} copiedLabel={t('copied')} className={css.codeBody} />
                            </div>
                          )}
                          {(cardBody !== null || outputText !== null) && (
                            <div className={css.ioCard}>
                              {cardBody !== null && (
                                <div className={css.ioSection}>
                                  <span className={css.ioLabel}>IN</span>
                                  <span className={css.ioText}>{cardBody}</span>
                                </div>
                              )}
                              {cardBody !== null && outputText !== null && (
                                <span className={css.ioDivider} aria-hidden />
                              )}
                              {outputText !== null && (
                                <div className={css.ioSection}>
                                  <span className={css.ioLabel}>OUT</span>
                                  <span className={css.ioText} data-error={state === 'error' || undefined}>
                                    {outputText}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
          {inspect !== undefined && (
            <button
              type="button"
              className={css.inspectButton}
              onClick={inspect}
            >
              <IconInspect />
              Inspect
            </button>
          )}
        </div>
      </DisclosureRow>
    </div>
  )
}
