// todo_write toolview: plan-flavored summary row replacing the generic
// "Tool call" card, registered into the keyed 'conversation.chat.toolview'
// hole like the bash sample (a product registration, not a sample). The row
// composes ToolRow (chrome, running sweep, whole-row expand) and swaps in a
// summary of the written list (counts + active item) from the call args; the
// durable list itself renders in the TodoPanel above the composer, so the
// row stays one line until expanded.

import { IconChecklistOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Context } from 'cordis'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolRowProps } from '../contract/slots.ts'
import { toolRowModel } from '../contract/tool-call-model.ts'
import { ToolRow } from '../chat/ToolRow.tsx'
import { NS } from '../locales.ts'

/** Todo row props: the toolview runtime share plus the standard locale seat. */
type TodoRowProps = ToolRowProps & PropsLocale<'conversation'>

/** One parsed args item, shape-checked (model JSON: any field may be missing or mistyped). */
interface TodoWriteItem { content?: unknown; status?: unknown }

function isItem(value: unknown): value is TodoWriteItem {
  return typeof value === 'object' && value !== null
}

function summarize(argsRaw: string, t: TodoRowProps['t']): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(argsRaw)
  } catch {
    // Mid-stream truncation or malformed model JSON: fall back to the generic summary.
    return null
  }
  // Valid JSON with an invalid shape (null root, non-array todos, null items —
  // a rejected tool/call retains such args verbatim): same generic fallback.
  if (typeof parsed !== 'object' || parsed === null) return null
  const todos = (parsed as { todos?: unknown }).todos
  if (!Array.isArray(todos) || !todos.every(isItem)) { return null }
  const done = todos.filter(item => item.status === 'completed').length
  const active = todos.find(item => item.status === 'in_progress')
  const head = t('todo.completed', { done, total: todos.length })
  return typeof active?.content === 'string' && active.content !== ''
    ? `${head} · ${active.content}`
    : head
}

/** One-line plan update row (the whole row toggles the call's Input/Output
 *  sections, ToolRow's unified expand). Non-ok execution states keep the
 *  shared row's dot semantics — a cancelled call wrote no todo/write, so it
 *  must not read as a completed update. */
export function TodoRow({ toolName, block, inspect, t }: TodoRowProps) {
  const model = toolRowModel(toolName, block)
  const argsRaw = ('kind' in block ? block.call?.argsRaw : block.argsRaw) ?? ''
  const summary = summarize(argsRaw, t) ?? model.summary
  return (
    <ToolRow
      t={t}
      variant={model.variant}
      toolName={toolName}
      icon={<IconChecklistOutline14 />}
      title={t('todo.rowTitle')}
      summary={summary}
      body={model.body}
      output={model.output}
      errorSummary={model.errorSummary}
      state={model.state}
      inspect={inspect}
    />
  )
}

/**
 * The todo row as a plain registrant plugin following the chat toolview
 * declaration across independent activation and reload lifetimes.
 */
export const todoToolview = {
  name: 'todo-toolview',
  inject: ['slots'],
  /**
   * Register the todo row into the chat view's keyed toolview hole.
   * @param ctx - registrant context (disposal rides ctx.effect inside slots.register).
   */
  apply(ctx: Context): void {
    ctx.slots.inject('conversation.chat.toolview', () =>
      ctx.slots.register({ name: 'conversation.chat.toolview', key: 'todo_write', locale: NS }, TodoRow))
  },
}
