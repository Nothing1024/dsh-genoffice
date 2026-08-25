/**
 * One-shot completion on the current DSH session model (ASM-001).
 * Direct `ctx.llm.stream()` — not iframe getAiSettings / localStorage.
 *
 * Nested inside a tool turn: do not forward session reasoningEffort (it has
 * produced empty assembler output), and collect text-delta as a fallback.
 */
import type { Context } from '@deepseek-ai/cordis'
import { BlockAssembler } from '@deepseek-ai/dsh-llm'
import { createUserMessage } from '@deepseek-ai/dsh-llm/message'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm/types'
import type { HostLlmOnce } from './page-plan.ts'
import { lookupLlm } from './lookup.ts'

interface SessionRoute {
  provider: string
  model: string
  temperature?: number
  maxTokens?: number
}

interface SessionModelAgent {
  id: string
  options: { provider?: string; model?: string }
  ctx: Context
  session: { requestHeader(): { config: SessionRoute } | undefined }
}

function asSessionAgent(value: unknown): SessionModelAgent | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  if (!('id' in value) || !('options' in value) || !('ctx' in value) || !('session' in value)) return undefined
  if (typeof value.id !== 'string' || value.id.length === 0) return undefined
  if (typeof value.options !== 'object' || value.options === null) return undefined
  if (typeof value.ctx !== 'object' || value.ctx === null) return undefined
  if (typeof value.session !== 'object' || value.session === null) return undefined
  if (!('requestHeader' in value.session) || typeof value.session.requestHeader !== 'function') return undefined
  return value as SessionModelAgent
}

function routeOf(agent: SessionModelAgent): SessionRoute | undefined {
  const header = agent.session.requestHeader()?.config
  const provider = header?.provider ?? agent.options.provider
  const model = header?.model ?? agent.options.model
  if (provider === undefined || provider.length === 0 || model === undefined || model.length === 0) return undefined
  const route: SessionRoute = { provider, model }
  if (header?.temperature !== undefined) route.temperature = header.temperature
  if (header?.maxTokens !== undefined) route.maxTokens = header.maxTokens
  return route
}

function assembledText(assembler: BlockAssembler, rawDeltas: string): string {
  try {
    const fromBlocks = assembler.blocks()
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('')
    if (fromBlocks.trim().length > 0) return fromBlocks
  } catch {
    // Unknown block types make blocks() throw; fall back to raw deltas.
  }
  return rawDeltas
}

function isTextDelta(chunk: StreamChunk): chunk is { type: 'text-delta'; index: number; text: string } {
  return chunk.type === 'text-delta'
}

export function sessionPlanLlm(agentValue: unknown): HostLlmOnce {
  const agent = asSessionAgent(agentValue)
  if (agent === undefined) {
    return async () => {
      throw new Error('planning failed: no session model')
    }
  }
  const llm = lookupLlm(agent.ctx)
  const route = routeOf(agent)
  if (llm === undefined || route === undefined) {
    return async () => {
      throw new Error('planning failed: session LLM is unavailable')
    }
  }
  return async (system, user, signal, maxTokens) => {
    const assembler = new BlockAssembler()
    const options: GenerateOptions = {
      provider: route.provider,
      model: route.model,
      system,
      messages: [
        createUserMessage({
          content: [{ type: 'text', text: user }],
          source: { kind: 'plugin', plugin: 'dsh-tab-genoffice', form: 'notice', summary: 'host page plan' },
        }),
      ],
      signal,
    }
    if (maxTokens !== undefined) options.maxTokens = maxTokens
    if (route.temperature !== undefined) options.temperature = route.temperature
    let rawDeltas = ''
    for await (const chunk of llm.stream(options)) {
      assembler.push(chunk)
      if (isTextDelta(chunk)) rawDeltas += chunk.text
    }
    const finish = assembler.finish
    if (finish.kind === 'error' || finish.kind === 'aborted') {
      throw new Error(finish.failure.message)
    }
    const text = assembledText(assembler, rawDeltas)
    if (text.trim().length === 0) throw new Error(`empty model output (${finish.kind})`)
    return text
  }
}
