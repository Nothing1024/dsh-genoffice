// @vitest-environment jsdom
/**
 * Assembly-level acceptance on SlotTestRuntime (real apply, real slot
 * machinery, real renderer; data fed as fixtures) for surfaces that were
 * previously pinned only by the assembled-app jsdom snapshots
 * (apps/web/tests/{todo-display,terminal-card,slash-flow}.snapshot.ts):
 *
 * - the todo_write turn reaches BOTH surfaces through the product
 *   registrations (keyed toolview row in the flow, plan strip in the input
 *   dock via the 'todos' projection) and the strip follows projection
 *   retirement;
 * - the bash keyed row carries its resident terminal card, and the fallback
 *   row reaches the same card through its expand control;
 * - the resident composer textarea survives the blank→active conversion as
 *   the SAME DOM node (focus/IME continuity rides React reconciliation:
 *   component identity + tree position, which this assembled tree pins).
 *
 * Component-level behavior (collapse interaction, card model arms, summary
 * derivations) lives in todo-panel.spec.tsx / terminal-card.spec.tsx; this
 * suite only proves the assembled wiring.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { LocaleService } from '@deepseek-ai/dsh-client-locale/client'
import type { ISession, SessionId, TodoItem, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import { SlotTestRuntime, usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject, type EmptyWorkspaceOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'

// The service reads its initial locale from the browser; these specs assert
// the shipped Chinese copy, so they state the browser they assume.
usePinnedBrowserLanguages('zh-CN')

const SID = 's1' as SessionId

/** jsdom has no ResizeObserver; the composer seat publishes its height through one. */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
})

const TODOS: Array<TodoItem> = [
  { content: '梳理需求', status: 'completed' },
  { content: '实现 fixture 样本', status: 'in_progress' },
  { content: '浏览器验收', status: 'pending' },
]

const todoResult = (seq: number): ToolResultNode => ({
  kind: 'tool-result', seq, time: seq * 1_000, callId: `todo-${seq}`,
  call: { name: 'todo_write', argsRaw: JSON.stringify({ todos: TODOS }) },
  callTime: seq * 1_000 - 500,
  content: [], isError: false, callView: null, resultView: null,
})

const bashResult = (seq: number, callId: string, over?: Partial<ToolResultNode>): ToolResultNode => ({
  kind: 'tool-result', seq, time: seq * 1_000, callId,
  call: { name: 'bash', argsRaw: '{"command":"ls -la","description":"List files"}' },
  callTime: seq * 1_000 - 500,
  content: [{ type: 'text', text: 'total 2\ndemo.txt\n' }], isError: false,
  callView: { card: 'terminal', title: 'ls -la', description: 'List files' },
  resultView: { card: 'terminal', output: 'total 2\ndemo.txt\n', exitCode: 0 },
  ...over,
})

/** Test-owned AppFrame role: declares and renders the resident conversation area. */
type AppRootProps = PropsRenderSlots<'conversation' | 'details'>
function AppRoot({ renderSlot }: AppRootProps) {
  return <>{renderSlot('conversation', {})}</>
}

const LAYOUT_CHILDREN = {
  'conversation': { kind: 'single', scope: 'session-maybe' },
  'details': { kind: 'single', scope: 'session' },
} as const

/** Stateful occupant proving the root-scoped Hero workspace outlet is not rebuilt. */
function WorkspaceProbe({ open }: EmptyWorkspaceOwnerProps) {
  const [count, setCount] = useState(0)
  return (
    <button data-testid="workspace-probe" onClick={() => { setCount(value => value + 1) }}>
      {String(open)}:{count}
    </button>
  )
}

async function bench(nodes: ToolResultNode[], opts?: { blank?: boolean }) {
  const runtime = await SlotTestRuntime.create()
  runtime.provide('layout', { openDetails: vi.fn(), closeDetails: vi.fn() })
  const locale = new LocaleService(runtime.ctx)
  runtime.provide('locale', locale)
  runtime.slots.installLocale(locale)
  await runtime.sessions.add({
    id: SID,
    summary: { title: 'S', displayTitle: 'S', cwd: '/proj' },
    snapshot: {
      nodes,
      ...(opts?.blank === true ? { blank: true, composerPhase: 'blank' as const } : {}),
    },
    session: {
      loadOlder: vi.fn<ISession['loadOlder']>(),
      prompt: vi.fn<ISession['prompt']>(async () => ({ ok: true, value: { accepted: true } })),
    },
  })
  await runtime.root.declare(LAYOUT_CHILDREN, AppRoot)
  await runtime.mount({ inject: [...inject], apply })
  return runtime
}

describe('todo_write assembly (product registrations, no outlet twins)', () => {
  it('reaches the keyed toolview row and the dock plan strip, and the strip follows projection retirement', async () => {
    const runtime = await bench([todoResult(3)])
    // The dock strip reads the host-computed 'todos' projection.
    runtime.sessions.behavior(SID).projections.set('todos', TODOS)
    const view = runtime.renderRoot()

    // Keyed toolview registration took the row (summary derived from args).
    const row = view.container.querySelector('[data-tool="todo_write"]')
    expect(row).not.toBeNull()
    expect(row!.textContent).toContain('1/3 已完成 · 实现 fixture 样本')

    // The plan strip sits in the input dock, fed by the projection
    // (default-collapsed: the header summary shows; rows appear on expand).
    const panel = view.container.querySelector('[data-testid="todo-panel"]')
    expect(panel).not.toBeNull()
    expect(panel!.textContent).toContain('1 已完成\u2002·\u20021 进行中\u2002·\u20021 待处理')
    fireEvent.click(panel!.querySelector('button')!)
    expect([...panel!.querySelectorAll('li')].map(li => li.getAttribute('data-status')))
      .toEqual(['completed', 'in_progress', 'pending'])

    // Next turn retires the standing plan (host pushes null): the strip
    // clears while the historical row stays in the flow.
    await runtime.flush()
    runtime.sessions.behavior(SID).projections.set('todos', null)
    await waitFor(() => {
      expect(view.container.querySelector('[data-testid="todo-panel"]')).toBeNull()
    })
    expect(view.container.querySelector('[data-tool="todo_write"]')).not.toBeNull()
    await runtime.dispose()
  })
})

describe('terminal card assembly', () => {
  it('both the keyed bash row and the fallback row reach the terminal card through the whole-row expand', async () => {
    const runtime = await bench([
      bashResult(3, 'c-keyed'),
      // An unregistered tool with terminal views: GenericToolCard fallback.
      bashResult(4, 'c-fallback', { call: { name: 'fx-bash', argsRaw: '{"command":"ls -la"}' } }),
    ])
    const view = runtime.renderRoot()

    // Keyed BashRow: collapsed by default, the whole summary row is the toggle.
    const keyedRow = view.container.querySelector('[data-sample="bash"]')
    const keyed = keyedRow?.parentElement
    expect(keyed?.querySelector('[data-terminal]')).toBeNull()
    fireEvent.click(keyedRow!)
    await waitFor(() => {
      expect(keyed!.querySelector('[data-terminal]')).not.toBeNull()
    })

    // Fallback row: same unified expand interaction.
    const fallback = view.container.querySelector('[data-tool="fx-bash"]')
    expect(fallback).not.toBeNull()
    expect(fallback!.querySelector('[data-terminal]')).toBeNull()
    fireEvent.click(fallback!.querySelector('[data-expandable]')!)
    await waitFor(() => {
      expect(fallback!.querySelector('[data-terminal]')).not.toBeNull()
    })
    await runtime.dispose()
  })
})

describe('resident composer', () => {
  it('renders the locked view state while no session exists at all', async () => {
    const runtime = await SlotTestRuntime.create()
    runtime.provide('layout', { openDetails: vi.fn(), closeDetails: vi.fn() })
    const locale = new LocaleService(runtime.ctx)
    runtime.provide('locale', locale)
    runtime.slots.installLocale(locale)
    await runtime.root.declare(LAYOUT_CHILDREN, AppRoot)
    await runtime.mount({ inject: [...inject], apply })
    const view = runtime.renderRoot()
    // No session entity: the inert twin renders (disabled textarea), and the
    // workspace picker chip is the only live control.
    const textarea = view.container.querySelector('textarea')
    expect(textarea).not.toBeNull()
    expect(textarea!.disabled).toBe(true)
    expect(view.getByRole('button', { name: '选择工作区' })).toBeTruthy()
    await runtime.dispose()
  })

  it('keeps the complete Hero tree mounted when the first Workspace session appears', async () => {
    const runtime = await SlotTestRuntime.create()
    runtime.provide('layout', { openDetails: vi.fn(), closeDetails: vi.fn() })
    const locale = new LocaleService(runtime.ctx)
    runtime.provide('locale', locale)
    runtime.slots.installLocale(locale)
    await runtime.workspaces.update((draft) => {
      draft.items = [{ workspaceId: 'w1', title: 'Proj', path: '/proj', sessionIds: [SID] }] as never
    })
    await runtime.root.declare(LAYOUT_CHILDREN, AppRoot)
    await runtime.mount({ inject: [...inject], apply })
    runtime.slots.register({ name: 'conversation.hero.workspace' }, WorkspaceProbe)
    const view = runtime.renderRoot()

    const root = view.container.querySelector('[data-phase="hero"]')!
    const scrollBody = view.container.querySelector('[data-conversation-scroll]')!
    const composerSeat = view.container.querySelector('[data-composer-seat]')!
    const textarea = view.container.querySelector('textarea')!
    const workspaceChip = view.getByRole('button', { name: '选择工作区' })
    const workspaceProbe = view.getByTestId('workspace-probe')
    expect(textarea.disabled).toBe(true)

    fireEvent.click(workspaceChip)
    fireEvent.click(workspaceProbe)
    expect(workspaceProbe.textContent).toBe('true:1')

    await runtime.sessions.add({
      id: SID,
      summary: { title: 'S', displayTitle: 'S', cwd: '/proj', blank: true },
      snapshot: { blank: true, composerPhase: 'blank' },
    })

    expect(view.container.querySelector('[data-phase="hero"]')).toBe(root)
    expect(view.container.querySelector('[data-conversation-scroll]')).toBe(scrollBody)
    expect(view.container.querySelector('[data-composer-seat]')).toBe(composerSeat)
    expect(view.container.querySelector('textarea')).toBe(textarea)
    expect(view.getByRole('button', { name: '选择工作区' })).toBe(workspaceChip)
    expect(view.getByTestId('workspace-probe')).toBe(workspaceProbe)
    expect(workspaceProbe.textContent).toBe('true:1')
    expect(textarea.disabled).toBe(false)
    await runtime.dispose()
  })


  it('the textarea survives the blank→active conversion as the same DOM node', async () => {
    const runtime = await bench([], { blank: true })
    // The hero renders the LIVE composer only when the blank session's
    // workspace resolves a chip title; an ownerless blank session shows the
    // disabled twin instead (deleted-workspace semantics).
    await runtime.workspaces.update((draft) => {
      draft.items = [{ workspaceId: 'w1', title: 'Proj', path: '/proj', sessionIds: [SID] }] as never
    })
    const view = runtime.renderRoot()
    const hero = view.container.querySelector('textarea')
    expect(hero).not.toBeNull()
    expect(hero!.disabled).toBe(false)

    // First acceptance: the session leaves blank and the composer docks.
    await runtime.sessions.updateSnapshot(SID, (draft) => {
      draft.blank = false
      draft.composerPhase = 'active'
    })
    const docked = view.container.querySelector('textarea')
    expect(docked).toBe(hero)
    await runtime.dispose()
  })
})

describe('prompt rejection through the assembled composer', () => {
  it('renders the promptError alert strip and keeps the draft in the machine', async () => {
    const runtime = await SlotTestRuntime.create()
    runtime.provide('layout', { openDetails: vi.fn(), closeDetails: vi.fn() })
    const locale = new LocaleService(runtime.ctx)
    runtime.provide('locale', locale)
    runtime.slots.installLocale(locale)
    const prompt = vi.fn<ISession['prompt']>(async () => ({
      ok: false, error: { code: 'agent-busy', message: 'prompt rejected before acceptance', details: { reason: 'busy' } },
    }))
    await runtime.sessions.add({
      id: SID,
      summary: { title: 'S', displayTitle: 'S', cwd: '/proj' },
      session: { prompt, loadOlder: vi.fn<ISession['loadOlder']>() },
    })
    await runtime.root.declare(LAYOUT_CHILDREN, AppRoot)
    await runtime.mount({ inject: [...inject], apply })
    const view = runtime.renderRoot()

    const composer = view.container.querySelector('textarea')!
    fireEvent.change(composer, { target: { value: 'do not lose this' } })
    fireEvent.keyDown(composer, { key: 'Enter' })
    await waitFor(() => { expect(prompt).toHaveBeenCalledOnce() })

    // The rejection lands in snapshot.promptError (the Session's own path);
    // the fixture mirrors that hop — the assembled InputBar renders it.
    await runtime.sessions.updateSnapshot(SID, (draft) => {
      draft.promptError = {
        op: 'send',
        error: { code: 'agent-busy', message: 'prompt rejected before acceptance', details: { reason: 'busy' } },
      }
    })
    const alert = await view.findByRole('alert')
    expect(alert.textContent).toContain('prompt rejected before acceptance (agent-busy)')
    // Failure restore: the machine returned the draft to the same textarea.
    await waitFor(() => {
      expect((view.container.querySelector('textarea'))!.value).toBe('do not lose this')
    })
    await runtime.dispose()
  })
})

describe('title projection across assembled surfaces', () => {
  it('one summary update re-labels the current-session crumb', async () => {
    const runtime = await bench([])
    const view = runtime.renderRoot()
    const hierarchy = view.getByRole('navigation', { name: '会话层级' })
    expect(within(hierarchy).getByRole('button', { name: 'S' }).hasAttribute('disabled')).toBe(true)

    await runtime.sessions.updateSummary(SID, { displayTitle: '修订标题', title: '修订标题' })
    await waitFor(() => {
      expect(within(hierarchy).getByRole('button', { name: '修订标题' }).hasAttribute('disabled')).toBe(true)
    })
    expect(within(hierarchy).queryByRole('button', { name: 'S' })).toBeNull()
    await runtime.dispose()
  })
})
