/**
 * Host tools: GenOffice control plane via relay POST /api/control/<app>/<docId>/…
 *
 * Registration is filtered by CAPABILITY (BR-001 / BR-015). The table lists
 * every control tool (docx 11 + markdown 5 + xlsx 13 + pptx 39 + pdf 21 = 89);
 * a row without a CAPABILITY key is not registered. DSH_GENOFFICE_ALL_TOOLS=1
 * re-opens the filter.
 * Write-back only through *_save and the tab button (BR-011).
 * pptx_generate_deck / pptx_regenerate_slide plan on the session model then
 * land_pages — they must not POST iframe generate_deck / regenerate_slide.
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { AssetChannel } from './assets.ts'
import { capabilityOf, isExposed, type CapabilityEntry } from './capability.ts'
import { classifyControlError, type ClassifyInput } from './errors.ts'
import { planDeckPages, planOnePageSpec, type HostLlmOnce } from './page-plan.ts'
import { sessionPlanLlm } from './session-llm.ts'
import { isInSyncWindow, markSyncWindow } from './sync.ts'
import { CONTROL_TOOL_TABLE, isSaveEntry, type ControlToolEntry } from './tool-schema.ts'

const RELAY_BASE = 'http://localhost:8787'
const CONTROL_TIMEOUT_MS = 70_000
const GENERATE_DECK_TIMEOUT_MS = 300_000
/** How long `*_open` waits for the control iframe to register on relay. */
const OPEN_READY_MS = 20_000
const OPEN_POLL_MS = 250
const LAND_SETTLE_MS = 8_000
const LAND_POLL_MS = 250

export interface ControlToolsOptions {
  assets?: AssetChannel | null
  allTools?: boolean
  /** Test seam: skip session LLM. Production uses the calling agent's model. */
  planLlm?: HostLlmOnce
  /** Test seam: shorten land settle polling. */
  landSettleMs?: number
  landPollMs?: number
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const OPEN_TOOL_BY_APP: Partial<Record<ControlToolEntry['app'], string>> = {
  docs: 'docx_open',
  markdown: 'md_open',
  sheets: 'xlsx_open',
  slides: 'pptx_open',
  pdf: 'pdf_open',
}

function describeEntry(entry: ControlToolEntry, cap: CapabilityEntry | undefined, allTools: boolean): string {
  let d = entry.description
  const openName = OPEN_TOOL_BY_APP[entry.app]
  if (openName !== undefined) {
    d = `须先 ${openName} 等到「已打开控制模式」再调用。${d}`
  }
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
  if (
    (entry.name === 'docx_insert_image' ||
      entry.name === 'pdf_insert_image' ||
      entry.name === 'pdf_replace_image') &&
    !opts.assetsAvailable
  ) {
    return false
  }
  return true
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'))
      return
    }
    const timer = setTimeout(resolve, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Poll relay until the control iframe has registered an executor for `path`.
 * Old relays without `registered` are treated as ready (do not block open).
 */
async function waitUntilRegistered(path: string, signal: AbortSignal): Promise<boolean> {
  const deadline = Date.now() + OPEN_READY_MS
  while (Date.now() < deadline) {
    if (signal.aborted) return false
    try {
      const resp = await fetch(`${RELAY_BASE}/api/control/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
        signal,
      })
      if (resp.ok) {
        const data = (await resp.json()) as { registered?: unknown }
        if (data.registered === true) return true
        if (data.registered === undefined) return true
      }
    } catch (e) {
      if (signal.aborted) return false
      if (e instanceof Error && e.name === 'AbortError') return false
    }
    try {
      await sleep(OPEN_POLL_MS, signal)
    } catch {
      return false
    }
  }
  return false
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
  const saveAsRaw = input.save_as
  if (saveAsRaw !== undefined && saveAsRaw !== '') {
    if (typeof saveAsRaw !== 'string' || !saveAsRaw.startsWith('/')) {
      fail('save_as 必须是本机绝对路径', path, 'local')
    }
  }
  const docId = await sha256Hex(path)
  const body: { path: string; saveAs?: string } = { path }
  if (typeof saveAsRaw === 'string' && saveAsRaw !== '') body.saveAs = saveAsRaw
  let resp: Response
  try {
    resp = await fetch(`${RELAY_BASE}/api/control/${entry.app}/${docId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify(body),
    })
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e), path, 'fetch')
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    fail(`relay 返回 HTTP ${resp.status}${text ? `: ${text}` : ''}`, path, 'fetch')
  }
  const data = (await resp.json()) as { ok?: boolean; error?: string; path?: string; mtimeMs?: unknown }
  if (!data.ok) fail(String(data.error ?? 'unknown error'), path, 'relay')
  if (body.saveAs !== undefined) {
    return { ok: true, output: `已另存为 ${data.path ?? body.saveAs}`, summary: '已另存为' }
  }
  if (typeof data.mtimeMs !== 'number') markSyncWindow(path)
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

function callKindFor(entry: ControlToolEntry): 'read' | 'edit' {
  if (READ_SKILLS.has(entry.skillName)) return 'read'
  // *_save and in-iframe mutations are both edits. Only save adds
  // `locations`, which is what the turn-tail 「产物」 row actually keys on.
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

function landPagesEntry(): ControlToolEntry {
  const entry = CONTROL_TOOL_TABLE.find((row) => row.skillName === 'land_pages')
  if (entry === undefined) throw new Error('planning failed: pptx_land_pages is not in CONTROL_TOOL_TABLE')
  return entry
}

function planningFail(error: unknown, path: string): never {
  const raw = error instanceof Error ? error.message : String(error)
  fail(raw.startsWith('planning failed:') ? raw : `planning failed: ${raw}`, path, 'local')
}

function isTimeoutError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error)
  return /timeout/i.test(raw)
}

async function callRelayRetry(
  entry: ControlToolEntry,
  input: Record<string, unknown>,
  signal: AbortSignal,
): Promise<{ ok: boolean; output: string; summary: string }> {
  let last: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await callRelay(entry, input, signal)
    } catch (e) {
      last = e
      if (!isTimeoutError(e) || attempt === 2) throw e
      await sleep(400, signal)
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

function parseLandedCount(output: string): number | undefined {
  const m = output.match(/Deck now has (\d+) page/i)
  if (m === null) return undefined
  return Number(m[1])
}

function parseDeckPageCount(output: string): number | undefined {
  const m = output.match(/The presentation has (\d+) pages?/i)
  if (m === null) return undefined
  return Number(m[1])
}

function contextHasElements(output: string): boolean {
  return /\|\s*(text|shape|image)\s*\|/i.test(output)
}

function firstTextNeedle(pages: unknown): string | undefined {
  if (!Array.isArray(pages) || pages.length === 0) return undefined
  const page = pages[0]
  if (typeof page !== 'object' || page === null || !('elements' in page)) return undefined
  const elements = (page as { elements?: unknown }).elements
  if (!Array.isArray(elements)) return undefined
  for (const el of elements) {
    if (typeof el !== 'object' || el === null) continue
    const rec = el as Record<string, unknown>
    if (rec.type !== 'text') continue
    const paragraphs = rec.paragraphs
    if (!Array.isArray(paragraphs) || paragraphs.length === 0) continue
    const para = paragraphs[0]
    if (typeof para !== 'object' || para === null) continue
    const runs = (para as { runs?: unknown }).runs
    if (!Array.isArray(runs) || runs.length === 0) continue
    const run = runs[0]
    if (typeof run !== 'object' || run === null) continue
    const text = (run as { text?: unknown }).text
    if (typeof text === 'string' && text.trim().length > 0) return text.trim().slice(0, 24)
  }
  return undefined
}

function deckContextEntry(): ControlToolEntry | undefined {
  return CONTROL_TOOL_TABLE.find((row) => row.skillName === 'get_deck_context')
}

async function waitLanded(
  path: string,
  expectedPages: number,
  signal: AbortSignal,
  needle: string | undefined,
  settle: { settleMs: number; pollMs: number },
): Promise<void> {
  const entry = deckContextEntry()
  if (entry === undefined) return
  const deadline = Date.now() + settle.settleMs
  for (;;) {
    if (signal.aborted) return
    let output = ''
    try {
      output = (await callRelay(entry, { path }, signal)).output
    } catch {
      output = ''
    }
    const n = parseDeckPageCount(output)
    const pagesOk = n !== undefined && n === expectedPages
    const filled = contextHasElements(output)
    const needleOk = needle === undefined || output.includes(needle)
    if (pagesOk && filled && needleOk) return
    if (Date.now() >= deadline) return
    try {
      await sleep(settle.pollMs, signal)
    } catch {
      return
    }
  }
}

async function executeLandPages(
  input: Record<string, unknown>,
  signal: AbortSignal,
  settle: { settleMs: number; pollMs: number },
): Promise<{ ok: boolean; output: string; summary: string }> {
  const result = await callRelayRetry(landPagesEntry(), input, signal)
  const expected = parseLandedCount(result.output)
  if (expected !== undefined) {
    await waitLanded(String(input.path ?? ''), expected, signal, firstTextNeedle(input.pages), settle)
  }
  return result
}

async function executeGenerateDeck(
  input: Record<string, unknown>,
  signal: AbortSignal,
  planLlm: HostLlmOnce,
  settle: { settleMs: number; pollMs: number },
): Promise<{ ok: boolean; output: string; summary: string }> {
  const path = String(input.path ?? '')
  let pages
  try {
    pages = await planDeckPages(input, planLlm, signal)
  } catch (e) {
    planningFail(e, path)
  }
  const landInput: Record<string, unknown> = {
    path,
    pages,
    insert_mode: input.insert_mode === 'append' ? 'append' : 'replace',
  }
  if (typeof input.deck_name === 'string') landInput.deck_name = input.deck_name
  return await executeLandPages(landInput, signal, settle)
}

async function executeRegenerateSlide(
  input: Record<string, unknown>,
  signal: AbortSignal,
  planLlm: HostLlmOnce,
  settle: { settleMs: number; pollMs: number },
): Promise<{ ok: boolean; output: string; summary: string }> {
  const path = String(input.path ?? '')
  const atIndex = input.slideIndex
  if (typeof atIndex !== 'number' || !Number.isInteger(atIndex) || atIndex < 0) {
    fail('slideIndex 必须是 ≥0 的整数', path, 'local')
  }
  let page
  try {
    page = await planOnePageSpec(input, planLlm, signal)
  } catch (e) {
    planningFail(e, path)
  }
  return await executeLandPages({
    path,
    pages: [page],
    insert_mode: 'replace_at',
    at_index: atIndex,
  }, signal, settle)
}

/** Build the control tool definitions from the contract mirror table. */
export function createControlTools(opts: ControlToolsOptions = {}): ReturnType<typeof defineTool>[] {
  const allTools = opts.allTools ?? process.env.DSH_GENOFFICE_ALL_TOOLS === '1'
  const assetsAvailable = opts.assets?.available === true
  const settle = {
    settleMs: opts.landSettleMs ?? LAND_SETTLE_MS,
    pollMs: opts.landPollMs ?? LAND_POLL_MS,
  }
  const controlTools = CONTROL_TOOL_TABLE.filter((entry) => shouldRegister(entry, { allTools, assetsAvailable })).map((entry) => {
    const isSave = isSaveEntry(entry)
    const cap = capabilityOf(entry.app, entry.skillName)
    return defineTool({
      name: entry.name,
      description: describeEntry(entry, cap, allTools),
      parameters: entry.parameters,
      timeoutMs: entry.name === 'pptx_generate_deck' ? GENERATE_DECK_TIMEOUT_MS : CONTROL_TIMEOUT_MS,
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
      presentCall: (args) => {
        const path = String((args as Record<string, unknown>).path ?? '')
        return {
          card: 'generic',
          title: entry.name,
          kind: callKindFor(entry),
          rawInput: path,
          // Only *_save joins the turn-tail produced-files row. In-iframe
          // edits are not on disk yet; listing them would open stale bytes.
          ...(isSave && path.startsWith('/') ? { locations: [{ path }] } : {}),
        }
      },
      presentResult: (_args, result) => ({
        card: 'generic',
        title: result.isError ? `${entry.name} 失败` : entry.name,
      }),
      async execute(args, exec) {
        const input = args as unknown as Record<string, unknown>
        if (
          entry.name === 'docx_insert_image' ||
          entry.name === 'pdf_insert_image' ||
          entry.name === 'pdf_replace_image'
        ) {
          return await executeInsertImage(entry, input, exec.signal, opts.assets)
        }
        if (isSave) {
          const result = await saveViaRelay(entry, input, exec.signal)
          return { ok: result.ok, output: result.output, summary: result.summary }
        }
        if (entry.name === 'pptx_generate_deck') {
          const planLlm = opts.planLlm ?? sessionPlanLlm(exec.agent)
          return await executeGenerateDeck(input, exec.signal, planLlm, settle)
        }
        if (entry.name === 'pptx_regenerate_slide') {
          const planLlm = opts.planLlm ?? sessionPlanLlm(exec.agent)
          return await executeRegenerateSlide(input, exec.signal, planLlm, settle)
        }
        if (entry.skillName === 'land_pages') {
          return await executeLandPages(input, exec.signal, settle)
        }
        const result = await callRelay(entry, input, exec.signal)
        return { ok: result.ok, output: result.output, summary: result.summary }
      },
    })
  })
  return [...controlTools, ...createOpenTools()]
}

const OPEN_TOOL_EXTS = ['pptx', 'docx', 'xlsx', 'md', 'pdf'] as const
type OpenExt = (typeof OPEN_TOOL_EXTS)[number]

function openToolDesc(ext: OpenExt): string {
  return `【必做第一步】用 GenOffice 控制模式打开本机 .${ext} 文件。做或改该类型文档时必须先调用本工具，等到返回「已打开控制模式」后才能调用其它 ${ext}_* 工具。禁止用 python、python-pptx、soffice、skill ppt-image-first、third-imagegen 代替本工具。path 为本机绝对路径，文件必须存在。`
}

/** Open tools: POST /api/open — bypasses the control plane (no docId needed). */
export function createOpenTools(): ReturnType<typeof defineTool>[] {
  return OPEN_TOOL_EXTS.map((ext: OpenExt) =>
    defineTool({
      name: `${ext}_open` as const,
      description: openToolDesc(ext),
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
          const sessionId = exec.agent?.id
          const body: { path: string; sessionId?: string } = { path: filePath }
          if (typeof sessionId === 'string' && sessionId !== '') body.sessionId = sessionId
          resp = await fetch(`${RELAY_BASE}/api/open`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
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
        if (data['subscribers'] === 0) {
          fail(
            '没有 DSH 页面在监听 /api/open/stream —— 请先在浏览器打开 DSH（默认 http://127.0.0.1:3080）再重试',
            filePath,
            'relay',
          )
        }
        const ready = await waitUntilRegistered(filePath, exec.signal)
        if (!ready) fail('executor not registered', filePath, 'relay')
        return { ok: true, output: `已打开控制模式：${filePath}`, summary: '打开文件' }
      },
    }),
  )
}

export function registeredToolNames(opts: ControlToolsOptions = {}): string[] {
  return createControlTools(opts).map((tool) => tool.name)
}
