// View-ring + toolview-hole type-chain samples, slot form: both are declared
// slots, so the register→inject→render chain and its compile-time locks are
// the slot system's (ui-slots/tests/type-chain.spec.tsx owns the generic
// duals). This spec pins the package-specific surface: the SlotMap rows
// (kind/scope/owner), list- and keyed-kind registration shapes, the ChatView
// and tool-row composed-props contracts, and the runtime dual — a real
// SlotsService ledger driving registration/order/disposal the way
// ConversationRoot's tab projection consumes it.
import { Context } from 'cordis'
import { describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { SlotsService } from '@deepseek-ai/dsh-client-runtime/client'
import type { ChatViewSlotProps, ConvViewProps, ToolRowProps } from '../src/client/contract/slots.ts'

describe('view-ring type negatives (compile-time; body never runs)', () => {
  it('holds the negative samples as expect-error sites', () => {
    const negatives = (slots: SlotsService) => {
      // 1. List-kind registration requires the id shape field.
      // @ts-expect-error missing `id` on a list-slot registration
      slots.register({ name: 'conversation.view', order: 1 }, (_p: ConvViewProps) => null)
      // 2. A keyed-kind shape field is rejected on the list slot.
      slots.register(
        // @ts-expect-error `key` belongs to keyed slots, not the list ring
        { name: 'conversation.view', id: 'x', key: 'k' },
        (_p: ConvViewProps) => null)
      // 3. Component props must stay within the composed contract: an
      //    undeclared member cannot be required.
      // @ts-expect-error component demands a prop no share supplies
      slots.register(
        { name: 'conversation.view', id: 'y' },
        (_p: ConvViewProps & { phantom: number }) => null)
      // 4. Views receive no renderSlot — the ring's entries declare no children.
      const renderless = (props: ConvViewProps): ReactNode => {
        // @ts-expect-error views receive no renderSlot — no sub-slot delegation
        void props.renderSlot
        return null
      }
      void renderless
      // 5. The chat entry's face is its own: openDetails does not exist on the
      //    base view props (store-less riders never see it).
      const baseOnly = (props: ConvViewProps): ReactNode => {
        // @ts-expect-error openDetails lives on ChatViewSlotProps, not the base
        void props.openDetails
        return null
      }
      void baseOnly
      // 6. ChatViewSlotProps carries the full composition (standard kit +
      //    store + inject face) — a handler with a wrong signature is red.
      const chatProps = (props: ChatViewSlotProps): ReactNode => {
        // @ts-expect-error openDetails takes a SelectionTarget, not a string
        props.openDetails('nope')
        // @ts-expect-error openFile takes a path string, not a SelectionTarget
        props.openFile({ turnSeq: 1, callId: 'c' })
        return null
      }
      void chatProps
      // 7. Keyed hole registration requires the key shape field.
      // @ts-expect-error missing `key` on a keyed-slot registration
      slots.register({ name: 'conversation.chat.toolview' }, (_p: ToolRowProps) => null)
      // 8. A list-kind shape field is rejected on the keyed hole.
      slots.register(
        // @ts-expect-error `id`/`order` belong to list slots, not the keyed hole
        { name: 'conversation.chat.toolview', key: 'k', order: 1 },
        (_p: ToolRowProps) => null)
      // 9. Tool-row components stay within their composed contract: the
      //    owner share + standard kit supply no chat-view members.
      const overreaching = (props: ToolRowProps): ReactNode => {
        // @ts-expect-error loadOlder lives on ChatViewSlotProps, not the row contract
        void props.loadOlder
        return null
      }
      void overreaching
      // 10. Owner-share drift is red at the row component seam: block is the
      //     call union, not arbitrary payload.
      const drifted = (props: ToolRowProps): ReactNode => {
        // @ts-expect-error the block union has no `argsParsed` member
        void props.block.argsParsed
        return null
      }
      void drifted
      return null as ReactNode
    }
    expect(negatives).toBeTypeOf('function')
  })
})

describe('view-ring runtime dual (real ledger)', () => {
  function bench() {
    const ctx = new Context()
    const slots = new SlotsService(ctx)
    // The conversation entry's role: declare the ring (declaring is claiming).
    slots.register({
      name: 'root',
      children: { 'conversation.view': { kind: 'list', scope: 'session' } },
    }, (_p: { renderSlot?: unknown }) => null)
    return { slots }
  }

  it('registers, orders, projects tabs, and disposes through the slot ledger', () => {
    const { slots } = bench()
    const offLate = slots.register(
      { name: 'conversation.view', id: 'z-late', order: 20, label: '晚' }, () => null)
    const offEarly = slots.register(
      { name: 'conversation.view', id: 'early', order: 0, label: '早' }, () => null)
    // Order-sorted ledger, label fallback for a labelless rider.
    const offBare = slots.register(
      { name: 'conversation.view', id: 'bare', order: 10 }, () => null)
    const tabs = slots.entries('conversation.view')
      .map(e => ({ id: e.options.id, label: e.options.label ?? e.options.id }))
    expect(tabs).toEqual([
      { id: 'early', label: '早' },
      { id: 'bare', label: 'bare' },
      { id: 'z-late', label: '晚' },
    ])
    // Duplicate ids fail loud at load (the ring's uniqueness contract).
    expect(() => slots.register({ name: 'conversation.view', id: 'early' }, () => null))
      .toThrow(/already has an entry with id "early"/)
    offEarly()
    expect(slots.entries('conversation.view').map(e => e.options.id)).toEqual(['bare', 'z-late'])
    offBare()
    offLate()
    expect(slots.entries('conversation.view')).toHaveLength(0)
  })
})
