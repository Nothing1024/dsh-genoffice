// @vitest-environment jsdom
// Branch tails the acceptance specs do not reach: ToolRow stopped-state dot,
// bash sample state dots, the node-half empty apply, and AssistantMarkdown
// reasoning/unknown block arms.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import type { RunningToolCall, SessionId, SessionListState, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { apply as nodeApply } from '../src/index.ts'
import { GenericToolCard, type GenericToolCardProps } from '../src/client/chat/GenericToolCard.tsx'
import { ToolRow } from '../src/client/chat/ToolRow.tsx'
import { AssistantMarkdown } from '../src/client/chat/AssistantMarkdown.tsx'
import { BashRow } from '../src/client/toolviews/bash-sample.tsx'
import { zh } from '../src/client/locales.ts'

type BashRowProps = Parameters<typeof BashRow>[0]

// Mirrors the real lookup chain (conversation namespace, then common).
const t: GenericToolCardProps['t'] = makeTranslate(zh, commonZh)

afterEach(cleanup)

describe('tails', () => {
  it('node-half apply is an intentional no-op', () => {
    expect(() => { nodeApply() }).not.toThrow()
  })

  it('ToolRow stopped state renders the warning dot in the leading slot', () => {
    const view = render(
      <ToolRow t={t} variant="bash" icon={<i data-testid="icon" />} title="Bash" summary="s" body={null} state="stopped" />,
    )
    expect(view.queryByTestId('icon')).toBeNull()
    expect(view.container.querySelector('[data-state="stopped"]')).not.toBeNull()
  })

  it('AssistantMarkdown renders reasoning as a Think row and unknown blocks as JSON fallback', () => {
    const view = render(
      <AssistantMarkdown
        t={t}
        blocks={[
          { kind: 'reasoning', text: 'thinking hard\nsecond line' },
          { kind: 'tool-call', callId: 'c', name: 'bash', argsRaw: '{}' },
          { kind: 'other', block: { type: 'mystery' } },
        ]}
        streaming
      />,
    )
    expect(view.getByText('Think')).toBeTruthy()
    expect(view.getByText('thinking hard')).toBeTruthy()
    expect(view.getByText(/未知内容块/)).toBeTruthy()
    const stopped = render(
      <AssistantMarkdown t={t} blocks={[{ kind: 'text', text: 'partial words' }]} streaming={false} interrupted />,
    )
    expect(stopped.getByText('已停止')).toBeTruthy()
  })

  it('AssistantMarkdown skips the root shell when only tool-call heads remain', () => {
    // Tool heads are drawn by ChatView's tool groups; an empty root between
    // groups is layout noise (no text, no pulse, no interrupted marker).
    const empty = render(
      <AssistantMarkdown
        t={t}
        blocks={[{ kind: 'tool-call', callId: 'c', name: 'todo_write', argsRaw: '{}' }]}
        streaming={false}
      />,
    )
    expect(empty.container.firstChild).toBeNull()
    const blank = render(<AssistantMarkdown t={t} blocks={[]} streaming={false} />)
    expect(blank.container.firstChild).toBeNull()
  })

  it('a settled others-variant row renders the sparkle icon in the leading slot', () => {
    const settled: ToolResultNode = {
      kind: 'tool-result', seq: 2, time: 2_000, callId: 'c5',
      call: { name: 'todo_write', argsRaw: '{"note":"x"}' },
      callTime: 1_000,
      content: [], isError: false, callView: null, resultView: null,
    }
    const props: GenericToolCardProps = {
      callId: 'c5', toolName: 'todo_write', block: settled, openFile: vi.fn(), t,
    }
    const view = render(<GenericToolCard {...props} />)
    // Settled ok state keeps the variant icon (sparkle) instead of a StateDot.
    expect(view.container.querySelector('[data-variant="others"] svg')).not.toBeNull()
    expect(view.container.querySelector('[data-state="ok"]')).not.toBeNull()
  })

  it('BashRow carries data-state for running (row sweep) and StateDots for error/stopped', () => {
    const sid = 'root-1' as SessionId
    const list = createSnapshotStore<SessionListState>({
      ids: [sid],
      byId: { [sid]: { id: sid, title: 'r', displayTitle: 'r', running: false, blank: false, updatedAt: 0 } },
      current: undefined,
      phase: 'ready',
      subagentsByParent: {},
      currentAddress: undefined,
    })
    const props = (block: RunningToolCall | ToolResultNode) => ({
      callId: 'c1', toolName: 'bash', block, openFile: vi.fn(),
      sessionId: sid, useSessions: bindSnapshotSelector(list),
      t,
    } as unknown as BashRowProps)

    const running: RunningToolCall = {
      callId: 'c1', name: 'bash', argsRaw: '{"command":"ls","description":"List"}',
      turn: 1, step: 1, time: 1_000, callView: null,
    }
    const errorResult: ToolResultNode = {
      kind: 'tool-result', seq: 1, time: 1_000, callId: 'c1',
      call: { name: 'bash', argsRaw: '{"command":"boom"}' },
      callTime: 500,
      content: [], isError: true, callView: null, resultView: null,
    }
    const stoppedResult: ToolResultNode = {
      ...errorResult,
      error: { name: 'E', code: 'interrupted' },
    }

    const runningView = render(<BashRow {...props(running)} />)
    expect(runningView.container.querySelector('[data-state="running"]')).not.toBeNull()
    expect(runningView.getByText('Bash')).toBeTruthy()
    expect(runningView.getByText('List')).toBeTruthy()
    runningView.unmount()

    const errorView = render(<BashRow {...props(errorResult)} />)
    expect(errorView.container.querySelector('[data-sample="bash"]')).not.toBeNull()
    expect(errorView.container.querySelector('[data-state="error"]')).not.toBeNull()
    expect(errorView.getByText('失败')).toBeTruthy()
    errorView.unmount()

    const stoppedView = render(<BashRow {...props(stoppedResult)} />)
    expect(stoppedView.container.querySelector('[data-state="stopped"]')).not.toBeNull()
    expect(stoppedView.getByText('已停止')).toBeTruthy()
  })
})
