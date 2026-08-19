/**
 * Host tools: GenOffice control plane via relay POST /api/control/<app>/<docId>/…
 *
 * Registration is filtered by CAPABILITY (BR-001 / BR-015). The table still
 * lists all 81 entries; DSH_GENOFFICE_ALL_TOOLS=1 re-opens the filter.
 * Write-back only through *_save and the tab button (BR-011).
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { AssetChannel } from './assets.ts'
import { capabilityOf, isExposed, type CapabilityEntry } from './capability.ts'
import { classifyControlError, type ClassifyInput } from './errors.ts'
import { isInSyncWindow, markSyncWindow } from './sync.ts'
import { CONTROL_TOOL_TABLE, isSaveEntry, type ControlToolEntry } from './tool-schema.ts'

const RELAY_BASE = 'http://localhost:8787'
const CONTROL_TIMEOUT_MS = 70_000

export interface ControlToolsOptions {
  assets?: AssetChannel | null
  allTools?: boolean
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function describeEntry(entry: ControlToolEntry, cap: CapabilityEntry | undefined, allTools: boolean): string {
  let d = entry.description
  if (cap === undefined) return d
  if (allTools && cap.netEgress) d = `【会向公网发起请求】${d}`
  if (allTools && cap.handover === 'dsh:web_search') d = `【已交还 DSH，请改用 web_search】${d}`
  if (allTools && cap.handover === 'dsh:pending') d = `【已划归 DSH 侧，本包不提供】${d}`
  if (cap.status === 'partial') d = `【部分可用】${d}`
  if (cap.status === 'guarded') {
    d = `【上游守卫】空白或元素过少的 deck 上会被拒绝，请改写已有页面。${d}`
  }
  return d
}

function shouldRegister(
  entry: ControlToolEntry,
  opts: { allTools: boolean; assetsAvailable: boolean },
): boolean {
  if (opts.allTools) return true
  const cap = capabilityOf(entry.app, entry.skillName)
  if (cap === undefined || !isExposed(cap)) return false
  if (entry.name === 'docx_insert_image' && !opts.assetsAvailable) return false
  return true
}

function fail(error: string, path?: string, kind?: ClassifyInput['kind']): never {
  const input: ClassifyInput = { error }
  if (path !== undefined) input.path = path
  if (kind !== undefined) input.kind = kind
  throw new Error(classifyControlError(input).message)
}

async function callRelay(
  entry: ControlToolEntry,
  input: Record<string, unknown>,
  signal: AbortSignal,
): Promise<{ ok: boolean; output: string; summary: string }> {
  const path = String(input.path ?? '')
  if (!path.startsWith('/')) fail('path 必须是目标文件的本机绝对路径', path, 'local')
  if (isInSyncWindow(path)) fail('sync window', path, 'sync')
  const docId = await sha256Hex(path)
  const { path: _strip, ...skillInput } = input
  let resp: Response
  try {
    resp = await fetch(`${RELAY_BASE}/api/control/${entry.app}/${docId}/tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ call: { id: crypto.randomUUID(), name: entry.skillName, input: skillInput } }),
    })
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e), path, 'fetch')
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    fail(`relay 返回 HTTP ${resp.status}${text ? `: ${text}` : ''}`, path, 'fetch')
  }
  const data = (await resp.json()) as {
    ok?: boolean
    error?: string
    execution?: { output?: string; isError?: boolean; mutated?: boolean; summary?: string }
  }
  if (!data.ok) fail(String(data.error ?? 'unknown error'), path, 'relay')
  const execution = data.execution ?? {}
  if (execution.isError) {
    fail(String(execution.output ?? 'executor error'), path, 'executor')
  }
  return {
    ok: true,
    output: String(execution.output ?? ''),
    summary: String(execution.summary ?? entry.skillName),
  }
}

async function saveViaRelay(
  entry: ControlToolEntry,
  input: Record<string, unknown>,
  signal: AbortSignal,
): Promise<{ ok: boolean; output: string; summary: string }> {
  const path = String(input.path ?? '')
  if (!path.startsWith('/')) fail('path 必须是目标文件的本机绝对路径', path, 'local')
  if (isInSyncWindow(path)) fail('sync window', path, 'sync')
  const docId = await sha256Hex(path)
  let resp: Response
  try {
    resp = await fetch(`${RELAY_BASE}/api/control/${entry.app}/${docId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ path }),
    })
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e), path, 'fetch')
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    fail(`relay 返回 HTTP ${resp.status}${text ? `: ${text}` : ''}`, path, 'fetch')
  }
  const data = (await resp.json()) as { ok?: boolean; error?: string; path?: string }
  if (!data.ok) fail(String(data.error ?? 'unknown error'), path, 'relay')
  markSyncWindow(path)
  return { ok: true, output: `已保存到 ${data.path ?? path}`, summary: '已保存' }
}

const READ_SKILLS = new Set([
  'get_document_context',
  'read_blocks',
  'web_search',
  'image_search',
  'get_workbook_context',
  'read_range',
  'load_guide',
  'read_formats',
  'read_sheet_features',
  'read_cells',
  'get_deck_context',
  'read_slide',
  'analyze_media',
  'list_style_templates',
  'read_pages',
  'search_text',
  'goto_page',
  'list_page_images',
  'list_form_fields',
  'get_outline',
])

function callKindFor(entry: ControlToolEntry): 'read' | 'edit' | 'execute' {
  if (isSaveEntry(entry)) return 'execute'
  if (READ_SKILLS.has(entry.skillName)) return 'read'
  return 'edit'
}

async function executeInsertImage(
  entry: ControlToolEntry,
  input: Record<string, unknown>,
  signal: AbortSignal,
  assets: AssetChannel | null | undefined,
): Promise<{ ok: boolean; output: string; summary: string }> {
  const path = String(input.path ?? '')
  const imagePath = String(input.imagePath ?? '')
  if (assets === undefined || assets === null || !assets.available) {
    fail('资产通道不可用：当前组合没有 webServer', path, 'capability')
  }
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    fail('插图只接受本机路径，不接受公网 URL（BR-016）', path, 'local')
  }
  let published
  try {
    published = await assets.publish(imagePath)
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e), path, 'local')
  }
  try {
    const { imagePath: _drop, ...rest } = input
    return await callRelay(entry, { ...rest, url: published.url }, signal)
  } finally {
    published.dispose()
  }
}

/** Build the control tool definitions from the contract mirror table. */
export function createControlTools(opts: ControlToolsOptions = {}): ReturnType<typeof defineTool>[] {
  const allTools = opts.allTools ?? process.env.DSH_GENOFFICE_ALL_TOOLS === '1'
  const assetsAvailable = opts.assets?.available === true
  const controlTools = CONTROL_TOOL_TABLE.filter((entry) => shouldRegister(entry, { allTools, assetsAvailable })).map((entry) => {
    const isSave = isSaveEntry(entry)
    const cap = capabilityOf(entry.app, entry.skillName)
    return defineTool({
      name: entry.name,
      description: describeEntry(entry, cap, allTools),
      parameters: entry.parameters,
      timeoutMs: CONTROL_TIMEOUT_MS,
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            output: { type: 'string', required: true },
            summary: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.output }],
      },
      presentCall: (args) => ({
        card: 'generic',
        title: entry.name,
        kind: callKindFor(entry),
        rawInput: String((args as Record<string, unknown>).path ?? ''),
      }),
      presentResult: (_args, result) => ({
        card: 'generic',
        title: result.isError ? `${entry.name} 失败` : entry.name,
      }),
      async execute(args, exec) {
        const input = args as unknown as Record<string, unknown>
        if (entry.name === 'docx_insert_image') {
          return await executeInsertImage(entry, input, exec.signal, opts.assets)
        }
        if (isSave) {
          const result = await saveViaRelay(entry, input, exec.signal)
          return { ok: result.ok, output: result.output, summary: result.summary }
        }
        const result = await callRelay(entry, input, exec.signal)
        return { ok: result.ok, output: result.output, summary: result.summary }
      },
    })
  })
  return [...controlTools, ...createOpenTools()]
}

const OPEN_TOOL_EXTS = ['pptx', 'docx', 'xlsx', 'md'] as const
type OpenExt = (typeof OPEN_TOOL_EXTS)[number]

const OPEN_TOOL_DESC =
  '用 GenOffice 侧栏打开指定本地文件（控制模式）。调用后侧栏会自动切换到该文件的编辑器；文件必须存在于本机。path 为本机绝对路径。'

/** Open tools: POST /api/open — bypasses the control plane (no docId needed). */
export function createOpenTools(): ReturnType<typeof defineTool>[] {
  return OPEN_TOOL_EXTS.map((ext: OpenExt) =>
    defineTool({
      name: `${ext}_open` as const,
      description: OPEN_TOOL_DESC,
      parameters: {
        path: { type: 'string', description: '目标文件的本机绝对路径', required: true },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            output: { type: 'string', required: true },
            summary: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.output }],
      },
      presentCall: (args) => ({
        card: 'generic',
        title: `${ext}_open`,
        kind: 'read',
        rawInput: String((args as Record<string, unknown>).path ?? ''),
      }),
      presentResult: (_args, result) => ({
        card: 'generic',
        title: result.isError ? `${ext}_open 失败` : `${ext}_open`,
      }),
      async execute(args, exec) {
        const input = args as Record<string, unknown>
        const filePath = String(input.path ?? '')
        if (!filePath.startsWith('/')) fail('path 必须是目标文件的本机绝对路径', filePath, 'local')
        const slash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
        const base = slash < 0 ? filePath : filePath.slice(slash + 1)
        if (!base.toLowerCase().endsWith(`.${ext}`)) {
          fail(`path 必须是 .${ext} 文件`, filePath, 'local')
        }
        let resp: Response
        try {
          resp = await fetch(`${RELAY_BASE}/api/open`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath }),
            signal: exec.signal,
          })
        } catch (e) {
          throw new Error(`open failed: ${e instanceof Error ? e.message : String(e)}`)
        }
        if (!resp.ok) {
          const body = (await resp.json().catch(() => ({}))) as Record<string, unknown>
          const msg = typeof body['error'] === 'string' ? body['error'] : `HTTP ${resp.status}`
          throw new Error(`open failed: ${msg}`)
        }
        const data = (await resp.json()) as Record<string, unknown>
        if (data['ok'] !== true) {
          const msg = typeof data['error'] === 'string' ? data['error'] : '未知错误'
          throw new Error(`open failed: ${msg}`)
        }
        return { ok: true, output: `已发送打开指令：${filePath}`, summary: '打开文件' }
      },
    }),
  )
}

export function registeredToolNames(opts: ControlToolsOptions = {}): string[] {
  return createControlTools(opts).map((tool) => tool.name)
}
