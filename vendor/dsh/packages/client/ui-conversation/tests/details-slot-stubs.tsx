/**
 * Shared stubs for direct `<DetailsPanel …/>` mounts in ui-conversation
 * tests: the details entry declares a session-scope child slot, so its
 * component props require the `renderSlot` share and the `SessionProvider`
 * seat, which the real renderer would inject. A bare mount supplies the
 * keyed-dispatch stub (unregistered tools land on the fallback) and a
 * session provider that renders its area with the fixed test session id.
 * @module @deepseek-ai/dsh-client-ui-conversation/tests
 */

import type { ReactNode } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { DetailsSlotProps } from '../src/client/contract/slots.ts'

/** Keyed-dispatch stub: no registered toolview, always the render-site fallback. */
export function fallbackRenderSlot(_name: string, _owner: unknown, opts?: { fallback?: ReactNode }): ReactNode {
  return opts?.fallback ?? null
}

/** SessionProvider seat stub rendering its area with the fixed test session id. */
export function testSessionProvider({ children }: { children: (sessionId: SessionId) => ReactNode }): ReactNode {
  return <>{children('s1' as SessionId)}</>
}

/** The two stubs as the details-slot prop values a bare mount needs. */
export const DETAILS_SLOT_STUBS: Pick<DetailsSlotProps, 'renderSlot' | 'SessionProvider'> = {
  renderSlot: fallbackRenderSlot,
  SessionProvider: testSessionProvider,
}
