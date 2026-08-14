// GenericCommandCard: the default command row — a stripped-down
// GenericToolCard rendering the command name and its settlement text.
// Supplied by the chat view as the keyed commandview slot's render-site
// fallback (an unregistered command name lands here); registrants may compose
// it as a base, feeding the same owner payload through.

import { ToolRow } from './ToolRow.tsx'
import type { ToolRowState } from '../contract/tool-call-model.ts'
import type { ChatViewSlotProps, CommandRowOwnerProps } from '../contract/slots.ts'
import { IconApiOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'

/** Node state → row state semantic (running while unsettled; outcome kind after). */
function stateOf(outcome: CommandRowOwnerProps['node']['outcome']): ToolRowState {
  if (outcome === null) return 'running'
  return outcome.kind === 'error' ? 'error' : 'ok'
}

/** Card props: the owner payload plus the render site's locale seat (plain prop). */
export interface GenericCommandCardProps extends CommandRowOwnerProps {
  t: ChatViewSlotProps['t']
}

export function GenericCommandCard({ node, t }: GenericCommandCardProps) {
  const text = node.outcome?.text
  const summary = node.outcome === null
    ? t('command.running')
    : text ?? (node.outcome.kind === 'error' ? t('command.failed') : t('command.done'))
  // Title is the bare command name: the row already reads `name · outcome`,
  // and the dispatched line's own `/` and arguments only restate what the
  // settlement text says (`permission · preset workspace-write`). A
  // cross-window node whose run page fell out of the window has no name.
  const title = node.name ?? t('command.title')
  return (
    <ToolRow
      t={t}
      variant="others"
      icon={<IconApiOutline14 size={14} />}
      title={title}
      summary={summary}
      // Expandable only when the outcome text overflows a one-line summary.
      body={text !== undefined && text.includes('\n') ? text : null}
      state={stateOf(node.outcome)}
    />
  )
}
