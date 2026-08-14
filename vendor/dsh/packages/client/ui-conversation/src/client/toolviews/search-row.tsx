// Search toolview registrant: the keyed toolview hole for the `grep` and `glob`
// tools. One SearchRow component registered under both, since both declare the
// same `card: 'search'` render intent and render as one visual object; the
// derived model's `kind` decides the card shape (grouped matches or a path
// list). The row composes the shared ToolRow (chrome, running sweep, whole-row
// expand) and feeds it the completed search as ToolRow's `search` card
// material, so it renders through SearchBlock in the collapsed-by-default
// expanded body — with a capped search's recovery footer below the card. A
// search declares its render intent result-time only, so a running row is the
// summary line alone; a settled call with no search card (an errored search, a
// nested run_code sub-dispatch, a legacy generic result) surfaces its
// model-facing text through ToolRow's Output section instead.

import type { Context } from 'cordis'
import { IconSearchOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolRowProps } from '../contract/slots.ts'
import { searchCardModel } from '../contract/search-card-model.ts'
import { toolRowModel } from '../contract/tool-call-model.ts'
import { ToolRow } from '../chat/ToolRow.tsx'
import { NS } from '../locales.ts'

/** Full row props: the toolview runtime share plus the standard locale seat. */
type SearchRowProps = ToolRowProps & PropsLocale<'conversation'>

/**
 * Search row: icon + Search · {summary} in the shared ToolRow chrome, with the
 * completed search's card as the row's collapsed-by-default card body (a capped
 * search's recovery footer rides below it, inside ToolRow). Registered under
 * both `grep` and `glob`; the derived model's `kind` decides the card shape. A
 * settled call with no search card surfaces its model-facing text through
 * ToolRow's Output section, since the keyed SearchRow owns this render slot.
 */
export function SearchRow({ toolName, block, inspect, t }: SearchRowProps) {
  const model = toolRowModel(toolName, block)
  const search = searchCardModel(block)
  return (
    <ToolRow
      t={t}
      variant={model.variant}
      toolName={toolName}
      icon={<IconSearchOutline16 size={14} />}
      title={model.title}
      // The result view's replacement title outranks the args-derived summary,
      // matching the terminal card's description precedence.
      summary={search?.title ?? model.summary}
      body={null}
      // A settled call with no search card (errored search, nested run_code
      // sub-dispatch, legacy generic result) has its text nowhere else to go;
      // ToolRow's Output section carries it, and errorSummary its first line.
      // When a card is present ToolRow renders it instead of the output, so
      // passing model.output unconditionally is safe and keeps the four card
      // rows symmetric.
      output={model.output}
      errorSummary={model.errorSummary}
      search={search}
      state={model.state}
      inspect={inspect}
    />
  )
}

/**
 * The search toolview follows the chat toolview declaration across activation
 * and reload. One component registers under both keys because `grep` and
 * `glob` are the same visual object discriminated by the result view's `kind`.
 */
export const searchToolview = {
  name: 'search-toolview',
  inject: ['slots'],
  /**
   * Register the search row into the chat view's keyed toolview hole under both
   * the `grep` and `glob` tool names.
   * @param ctx - registrant context (disposal rides ctx.effect inside slots.register).
   */
  apply(ctx: Context): void {
    ctx.slots.inject('conversation.chat.toolview', function* () {
      yield ctx.slots.register({ name: 'conversation.chat.toolview', key: 'grep', locale: NS }, SearchRow)
      yield ctx.slots.register({ name: 'conversation.chat.toolview', key: 'glob', locale: NS }, SearchRow)
    })
  },
}
