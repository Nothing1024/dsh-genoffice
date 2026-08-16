/**
 * External profile plugins do not share the web-app isolate map, so
 * `ctx.inject(['webServer'])` stays PENDING and `ctx.webServer` throws.
 * The reflect store is process-wide; look up by shape.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'

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
