/**
 * Deployment-boundary system prompt, generated from CAPABILITY (BR-002 / BR-015 / BR-017).
 * Nested inject so a composition without systemPrompt still loads.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { lookupSystemPrompt } from './lookup.ts'
import {
  CAPABILITY,
  isExposed,
  type CapabilityApp,
  type CapabilityEntry,
  type CapabilityKey,
} from './capability.ts'

const APP_LABEL: Record<CapabilityApp, string> = {
  docs: 'docx',
  markdown: 'markdown',
  sheets: 'xlsx',
  slides: 'pptx',
  pdf: 'pdf',
}

function appOf(key: CapabilityKey): CapabilityApp {
  return key.split(':')[0] as CapabilityApp
}

function skillOf(key: CapabilityKey): string {
  return key.slice(key.indexOf(':') + 1)
}

function reasonOf(entry: CapabilityEntry): string {
  if (entry.handover === 'dsh:web_search') return '已交还 DSH，请用 web_search'
  if (entry.handover === 'dsh:pending') return '已划归 DSH 侧其它工具，本包不提供'
  if (entry.status === 'bridge-missing') return '网页桥接缺失'
  if (entry.status === 'state-locked') return '控制面状态门锁死'
  if (entry.status === 'cloud-only') return '依赖云生成 / 桌面版'
  if (entry.status === 'relay-fetch') return '会经 relay 出网'
  if (entry.status === 'guarded') return '空白 deck 会被上游守卫拒绝'
  if (entry.status === 'partial') return '部分可用'
  return entry.status
}

/** Generated from CAPABILITY — do not maintain a second handwritten inventory. */
export function buildGenOfficePromptText(): string {
  const exposed: string[] = []
  const blocked: string[] = []
  for (const [key, entry] of Object.entries(CAPABILITY) as [CapabilityKey, CapabilityEntry][]) {
    const label = `${APP_LABEL[appOf(key)]}:${skillOf(key)}`
    if (isExposed(entry)) exposed.push(label)
    else blocked.push(`${label}（${reasonOf(entry)}）`)
  }

  const byApp: Record<string, string[]> = {}
  for (const name of exposed) {
    const colon = name.indexOf(':')
    const app = name.slice(0, colon)
    const skill = name.slice(colon + 1)
    const list = byApp[app] ?? (byApp[app] = [])
    list.push(skill)
  }
  const can = Object.entries(byApp)
    .map(([app, skills]) => `${app}：${skills.join('、')}`)
    .join('\n')

  return [
    '本机 GenOffice 是 web 部署，不是桌面版。工具只改已经在控制模式打开的文档；写盘只有 *_save 或界面「写入磁盘」。',
    `可做：\n${can}`,
    `不可做（不要调用、不要向用户承诺）：\n${blocked.join('；')}`,
    '需要联网资料时用 DSH 自己的 web_search。GenOffice 侧没有检索工具。',
    '图片：不提供搜图与生图。本地已有图片时用 docx_insert_image 或 pdf_insert_image，参数 imagePath 为本机绝对路径。',
    '「在浏览器中打开」会离开控制模式；网页版 AI 面板可直连第三方模型服务商，可能出网。',
  ].join('\n')
}

export function applyPrompt(ctx: Context): void {
  const text = buildGenOfficePromptText()
  const mount = (sp: Context['systemPrompt']): (() => void) => {
    return sp.section({ name: 'tool:genoffice', order: 150, text })
  }
  const existing = lookupSystemPrompt(ctx)
  if (existing !== undefined) {
    ctx.effect(() => mount(existing))
    return
  }
  ctx.inject(['systemPrompt'], (c) => mount(c.systemPrompt))
}
