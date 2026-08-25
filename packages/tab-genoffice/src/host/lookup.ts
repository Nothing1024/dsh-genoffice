/**
 * External profile plugins do not share the web-app isolate map, so
 * `ctx.inject(['webServer'])` stays PENDING and `ctx.webServer` throws.
 * The reflect store is process-wide; look up by shape.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm/types'

export interface LlmStreamService {
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>
  listProviders(): unknown
}

function isLlmStreamService(v: unknown): v is LlmStreamService {
  if (typeof v !== 'object' || v === null) return false
  if (!('stream' in v) || !('listProviders' in v)) return false
  return typeof v.stream === 'function' && typeof v.listProviders === 'function'
}

export function lookupService<T>(ctx: Context, pred: (value: unknown) => value is T): T | undefined {
  const reflect = (ctx.root ?? ctx).reflect as { store?: Record<string | symbol, { value?: unknown }> } | undefined
  const store = reflect?.store
  if (store === undefined) return undefined
  for (const key of Reflect.ownKeys(store)) {
    const value = store[key]?.value
    if (pred(value)) return value
  }
  return undefined
}

export function lookupWebServer(ctx: Context): Context['webServer'] | undefined {
  return lookupService(
    ctx,
    (v): v is Context['webServer'] =>
      typeof v === 'object' && v !== null && typeof (v as { register?: unknown }).register === 'function'
        && typeof (v as { port?: unknown }).port === 'number',
  )
}

export function lookupSystemPrompt(ctx: Context): Context['systemPrompt'] | undefined {
  return lookupService(
    ctx,
    (v): v is Context['systemPrompt'] =>
      typeof v === 'object' && v !== null && typeof (v as { section?: unknown }).section === 'function',
  )
}

/** Host skill registry. Isolated profile plugins cannot `inject(['skills'])` at top level. */
export interface SkillsService {
  register(skill: { name: string; description: string; content: string; source: string }): () => void
}

export function lookupSkills(ctx: Context): SkillsService | undefined {
  return lookupService(
    ctx,
    (v): v is SkillsService =>
      typeof v === 'object' && v !== null
      && typeof (v as { register?: unknown }).register === 'function'
      && typeof (v as { registerProvider?: unknown }).registerProvider === 'function'
      && typeof (v as { snapshot?: unknown }).snapshot === 'function',
  )
}

export function lookupLlm(ctx: Context): LlmStreamService | undefined {
  return lookupService(ctx, isLlmStreamService)
}
