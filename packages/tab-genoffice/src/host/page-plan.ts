/**
 * Host-side deck planning. Prompt text is copied from
 * engine/apps/slides/src/renderer/ai/local-page-gen.ts
 * (`pageSpecSystemPrompt`, `pageSpecUserMessage`, `PLAN_DECK_SYSTEM_PROMPT`,
 * `STYLE_SKILL_SYSTEM_PROMPT`, `styleSkillUserMessage`, `planDeckUserMessage`).
 * Do not import the slides renderer (ASM-005).
 */

export const SPEC_CANVAS_W = 1280
export const SPEC_CANVAS_H = 720

export type HostLlmOnce = (
  system: string,
  user: string,
  signal: AbortSignal,
  maxTokens?: number,
) => Promise<string>

export const DEFAULT_STYLE =
  'Main background: #16395C\nMain text color: #FFFFFF\nPrimary accent: #3DDC97\nSecondary accent: #F4D35E\nOverall style: dark professional typography-first slide.'

export interface PageSpecLike {
  background?: string
  elements: Array<Record<string, unknown>>
}

export interface OutlinePage {
  title: string
  type?: string
  brief: string
  layout: string
  image_queries?: string[]
}

export interface DeckOutline {
  core_hook: string
  pages: OutlinePage[]
}

export function pageSpecSystemPrompt(canvasW: number, canvasH: number): string {
  return (
    'You are a professional slide visual designer. Output exactly ONE JSON object describing one slide; no explanations/markdown/code fences.\n' +
    '\n' +
    '## Canvas\n' +
    `${canvasW}x${canvasH} px, origin top-left. All x/y/w/h are integers in px. Nothing may cross the canvas edges; negative coordinates forbidden. Elements paint in array order: background/decor shapes first, then images, text last (text must never end up underneath a shape).\n` +
    '\n' +
    '## Format\n' +
    '{"background":"#RRGGBB","elements":[...]}\n' +
    'Element types:\n' +
    '- Shape: {"type":"shape","shape":"roundRect","x":80,"y":120,"w":360,"h":200,"fill":"#RRGGBB or #RRGGBBAA (AA=alpha, 00 transparent)","stroke":{"color":"#RRGGBB","widthPt":1},"paragraphs":[...optional label text, vertically centered...]}\n' +
    '  Allowed shape values: rect, roundRect, ellipse, triangle, rightArrow, leftArrow, upArrow, downArrow, chevron, diamond, parallelogram, trapezoid, hexagon, pentagon, pie, donut, star5, heart, cloud, line, lineArrow. line/lineArrow draw the diagonal of their box from top-left to bottom-right and need a stroke (a horizontal rule = a box with h:1).\n' +
    '- Text: {"type":"text","x":80,"y":60,"w":800,"h":90,"valign":"top","paragraphs":[{"align":"left","lineSpacingPct":110,"spaceAfterPt":6,"bullet":false,"runs":[{"text":"...","sizePt":18,"bold":true,"italic":false,"color":"#RRGGBB","font":"Font Name"}]}]}\n' +
    '  A paragraph may mix runs of different weight/color/size (e.g. a big number run + a small unit run in one line).\n' +
    '- Image: {"type":"image","url":"https://...","x":660,"y":80,"w":540,"h":560} — center-cropped to fill its box (object-fit: cover).\n' +
    '\n' +
    '## Hard layout rules\n' +
    '- Text boxes have ZERO inner padding: the box top-left is exactly where the first glyph starts. Size every box from its content: one line is about sizePt*1.8 px tall at lineSpacingPct 110; a CJK character is about sizePt*1.35 px wide, a Latin character about sizePt*0.7 px. Text wraps at the box width — count the wrapped lines and make the box tall enough, plus one spare line.\n' +
    '- Text must never overflow its box or overlap other text. Keep >=8px between text and card edges, >=20px between a big title and its subtitle, >=5px between stacked text blocks in the same column — self-check every pair before output.\n' +
    '- Font sizes in pt: big titles 32-48, subtitles 18-24, body 12-15, hero KPI numbers up to 80.\n' +
    '- Spread content across the whole page; do not cram it into the top half leaving large blank areas; make text and images as large as the layout allows.\n' +
    '\n' +
    '## Visuals and assets\n' +
    '- Photos may only use URLs from the "available images" list, at most as many image elements as URLs. With no available images, fill with typography/color blocks/shapes — never fake photos.\n' +
    '- Icon-like decoration uses the allowed shapes only (at most 4-5 per page, strongly content-related). **Never use emoji**.\n' +
    '- Data visuals: compose bars/rings/timelines from rect/donut/line shapes with sizes proportional to the real values from the brief.\n' +
    '- Solid colors only (alpha allowed) — no gradients. **No placeholders of any kind**: all copy comes from the brief’s real content.\n' +
    '\n' +
    '## Anti-AI design rules (violation = unacceptable)\n' +
    '- No thin vertical accent bar on the left of cards, no colored bar on top of cards, no small bar left of titles — express hierarchy with background color/font weight/size contrast.\n' +
    '- One primary + one secondary accent color for the whole page; even when comparing multiple entities, do not give each a different color (no rainbow cards).\n' +
    '- No decorative corner blocks/short lines; decorative elements must be consistent in position and style across the deck.\n' +
    '- Do not turn every page into a "shape + bold subtitle + description" list; the cover must not be a flat one-line title + subtitle layout — it needs a visual anchor (large color block/geometric composition/huge number/hero image).'
  )
}

export function pageSpecUserMessage(args: {
  style: string
  topic?: string
  coreHook: string
  pageIndex: number
  totalPages: number
  title: string
  layout: string
  brief: string
  images: string[]
  context?: string
}): string {
  const imgBlock = args.images.length
    ? `\nAvailable image URLs (put them into image elements; do not invent placeholder blocks):\n${args.images.map((u, i) => `${i + 1}. ${u}`).join('\n')}`
    : ''
  const ctxBlock = args.context
    ? `\n\nReference material (all real names/figures/facts come from here; do not invent):\n${args.context.slice(0, 4000)}`
    : ''
  return (
    `This is the deck's unified style (this page must follow it strictly to stay consistent across pages):\n${args.style}\n\n` +
    (args.topic ? `Deck topic: ${args.topic}\n` : '') +
    `Deck-wide narrative Core Hook: ${args.coreHook}\n\n` +
    `Now design page ${args.pageIndex}/${args.totalPages}.\n` +
    `Title: ${args.title}\nLayout: ${args.layout}\nContent brief (use real data/facts): ${args.brief}${imgBlock}${ctxBlock}\n\n` +
    "Return only this page's spec JSON."
  )
}

export const STYLE_SKILL_SYSTEM_PROMPT =
  'You are a professional deck visual designer. Given the presentation topic and style preferences, produce a complete Style Skill (visual style guide). Output strictly in the structure below, only the Style Skill content, no explanations/markdown/code fences.\n\n' +
  'Color rules (must use concrete hex values)\n' +
  '  Main background: #hex\n' +
  '  Per-page-type backgrounds:\n    cover: #hex\n    content: #hex\n    data: #hex\n    closing: #hex\n' +
  '  (Background selection principles, highest priority first):\n' +
  '   1) Style preference first: when a tone is explicit (dark theme, a brand color family, a certain texture), the background must honor it — do not fall back to a safe light color.\n' +
  "   2) Then topic mood: serve the content's emotion and tone (serious/playful/artistic/tech/traditional); different topics should have clearly different backgrounds. Dark colors, brand colors, and saturated light colors are all legitimate choices.\n" +
  '   3) Light neutral backgrounds are only a fallback: use only when the topic is neutral and the style expresses no clear preference.\n' +
  '   Constraints: content pages share one background within a deck; the main background and main text color must have sufficient contrast (light text on dark, dark text on light).\n' +
  '  Main text color: #hex\n  Primary accent: #hex\n  Secondary accent: #hex\n' +
  '  (Iron rule: one accent color system across the whole deck — even when comparing multiple companies/products/options, do not assign each entity a different color; distinguish entities by name and typography. Never exceed the primary + secondary accents)\n' +
  '  Card background: #hex\n  Border color: #hex\n\n' +
  'Fonts\n  CJK title font: [font name]\n  Latin title font: [font name]\n  Body font: [font name]\n  Title size: [range]px\n  Body size: [range]px\n\n' +
  'Layout variants per page type (list at least 2 variants each, format: variant name: description)\n' +
  '  cover variants:\n    cover_full_image_overlay: full-bleed photo background + dark overlay, centered white title, bottom metadata bar\n    cover_split_color: two color blocks side by side (60/40)\n    cover_typography_hero: pure typography, no photo, huge title (100px+)\n    cover_dark_minimal: dark background, centered large title + a little accent color\n    cover_magazine: magazine-style title taking 60% + partial imagery\n    cover_split_image: title on the left half + hero image on the right half\n' +
  '  content variants:\n    left_text_right_image | three_column_cards | hero_big_number | two_column_comparison | timeline_horizontal | full_image_text_overlay (give each a one-line description)\n' +
  '  data variants:\n    kpi_cards_row: horizontal KPI cards\n    chart_with_insight: chart left + insight right\n    two_by_two_grid: 2x2 quadrants\n' +
  '  closing variants:\n    closing_cta: centered title + contact info\n    closing_thank_you: full-bleed thank-you page\n\n' +
  'Overall style: [one sentence describing the overall design language]'

export function styleSkillUserMessage(a: { topic: string; styleHint?: string; questionnaire?: string }): string {
  const q = a.questionnaire ? `\nUser questionnaire answers: ${a.questionnaire}` : ''
  const hint = a.styleHint ? `\nStyle preference: ${a.styleHint}` : ''
  return `Topic and style preferences: ${a.topic}${hint}${q}\nOutput the Style Skill.`
}

export const PLAN_DECK_SYSTEM_PROMPT =
  'You are a professional deck planner. Given the confirmed design style, plan the content page by page. Output only one JSON object, no explanations/markdown/code fences.\n' +
  'Format: {"core_hook":"...","pages":[{"title":"","type":"cover|content|data|closing","brief":"","layout":"","image_queries":[]}]}\n' +
  '\n' +
  '## core_hook\n' +
  "The deck's narrative anchor: one sentence, with tension, containing a number or counter-intuitive contrast, at most 20 characters.\n" +
  '\n' +
  "## layout (choose from the Style Skill's per-page-type variant library; content pages within one deck must not repeat the same variant)\n" +
  'cover: cover_typography_hero (huge pure typography) | cover_dark_minimal (dark background, centered large title) | cover_split_color (side-by-side color blocks) | cover_full_image_overlay (full-bleed photo + dark overlay) | cover_magazine (magazine-style large title + partial imagery) | cover_split_image (text left, image right)\n' +
  'content: left_text_right_image | three_column_cards | hero_big_number | two_column_comparison | timeline_horizontal | full_image_text_overlay\n' +
  'data: kpi_cards_row | chart_with_insight | two_by_two_grid\n' +
  'closing: closing_cta | closing_thank_you\n' +
  'Selection criteria: 3 parallel points → three_column_cards; a key number → hero_big_number; comparison/categories → two_column_comparison/two_by_two_grid; sequence → timeline_horizontal; image+text → left_text_right_image/full_image_text_overlay; metrics → kpi_cards_row.\n' +
  '\n' +
  '## brief\n' +
  'Describe in detail what goes in each region of the layout; prefer real data/facts from the reference material, no "XX%" placeholders; cover gives main/sub titles and mood; data gives metric names + concrete values + changes.\n' +
  '\n' +
  '## image_queries\n' +
  'Array: one entry per photo slot on the page. If the reference material contains ready image URLs (starting with http), use them directly; otherwise put English image-search keywords (describing a concrete scene, e.g. "summer palace kunming lake", not generic words like "park") — the system auto-searches and fills real URLs back. Travel/product/people/brand pages get images by default; give [] only when the page truly needs no photos (fill with typography/icons; never count on CSS-drawn fake images).'

export function planDeckUserMessage(a: { topic: string; context?: string; styleSkill?: string; count: number }): string {
  const styleBlock = a.styleSkill
    ? `\n[Confirmed design style Style Skill; choose layout accordingly while planning]:\n${a.styleSkill}`
    : ''
  return `Topic: ${a.topic}${a.context ? `\nReference material/requirements: ${a.context}` : ''}${styleBlock}\nPlan ${a.count} pages in total.\nOutput the JSON.`
}

export function extractJsonText(raw: string): string | undefined {
  const text = String(raw ?? '')
  const candidates: string[] = []
  for (let start = 0; start < text.length; start++) {
    if (text[start] !== '{') continue
    let depth = 0
    let inString = false
    let escape = false
    for (let i = start; i < text.length; i++) {
      const ch = text[i]
      if (inString) {
        if (escape) escape = false
        else if (ch === '\\') escape = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') {
        inString = true
        continue
      }
      if (ch === '{') depth += 1
      else if (ch === '}') {
        depth -= 1
        if (depth === 0) {
          candidates.push(text.slice(start, i + 1))
          break
        }
      }
    }
  }
  for (const candidate of candidates) {
    try {
      JSON.parse(candidate)
      return candidate
    } catch {
      continue
    }
  }
  return candidates[0]
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : undefined
}

export function isPageSpecLike(v: unknown): v is PageSpecLike {
  const rec = asRecord(v)
  if (rec === undefined) return false
  const elements = rec.elements
  if (!Array.isArray(elements) || elements.length === 0) return false
  return elements.every((el) => {
    const item = asRecord(el)
    if (item === undefined) return false
    if (typeof item.type !== 'string' || item.type.length === 0) return false
    return ['x', 'y', 'w', 'h'].every((k) => typeof item[k] === 'number' && Number.isFinite(item[k] as number))
  })
}

export function parsePageSpecLike(raw: string): { ok: true; spec: PageSpecLike } | { ok: false; error: string } {
  const json = extractJsonText(raw)
  if (json === undefined) return { ok: false, error: 'no JSON object found in the output' }
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  if (!isPageSpecLike(parsed)) return { ok: false, error: 'spec missing elements with type/x/y/w/h' }
  return { ok: true, spec: parsed }
}

export function pageSpecFromOutline(page: OutlinePage, coreHook: string, cover: boolean): PageSpecLike {
  const body = page.brief.length > 0 ? page.brief.slice(0, 800) : coreHook
  const urls = (page.image_queries ?? []).filter((u) => /^https?:\/\//i.test(u)).slice(0, 2)
  const titleW = urls.length > 0 ? 720 : 1120
  const elements: Array<Record<string, unknown>> = [
    {
      type: 'text',
      x: 80,
      y: 80,
      w: titleW,
      h: 90,
      valign: 'top',
      paragraphs: [{ align: 'left', runs: [{ text: page.title, sizePt: 36, bold: true, color: '#FFFFFF' }] }],
    },
    {
      type: 'text',
      x: 80,
      y: 200,
      w: titleW,
      h: 420,
      valign: 'top',
      paragraphs: [{ align: 'left', runs: [{ text: body, sizePt: 18, color: '#FFFFFF' }] }],
    },
  ]
  for (const [i, url] of urls.entries()) {
    elements.push({ type: 'image', url, x: 840, y: 80 + i * 300, w: 360, h: 280 })
  }
  return { background: backgroundFor(page, cover), elements }
}

function backgroundFor(page: OutlinePage, cover: boolean): string {
  if (page.type === 'closing' || page.layout.startsWith('closing_')) return '#0B1F33'
  if (page.type === 'data' || page.layout.startsWith('kpi_') || page.layout.startsWith('chart_') || page.layout.startsWith('two_by_two')) {
    return '#123348'
  }
  if (cover || page.type === 'cover' || page.layout.startsWith('cover_')) return '#16395C'
  return '#0F2740'
}

export function parseOutline(raw: string): { ok: true; outline: DeckOutline } | { ok: false; error: string } {
  const json = extractJsonText(raw)
  if (json === undefined) return { ok: false, error: 'no JSON object found in the output' }
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (e) {
    return { ok: false, error: 'outline JSON parse failed: ' + (e instanceof Error ? e.message : String(e)) }
  }
  const rec = asRecord(parsed)
  if (rec === undefined) return { ok: false, error: 'outline JSON parse failed: not an object' }
  const pagesRaw = rec.pages
  if (!Array.isArray(pagesRaw) || pagesRaw.length === 0) {
    return { ok: false, error: 'outline JSON parse failed: pages must be a non-empty array' }
  }
  const pages: OutlinePage[] = []
  for (const item of pagesRaw) {
    const p = asRecord(item)
    if (p === undefined) return { ok: false, error: 'outline JSON parse failed: page is not an object' }
    const title = typeof p.title === 'string' ? p.title : ''
    const brief = typeof p.brief === 'string' ? p.brief : ''
    const layout = typeof p.layout === 'string' ? p.layout : ''
    if (title.length === 0 || brief.length === 0 || layout.length === 0) {
      return { ok: false, error: 'outline JSON parse failed: each page needs title/brief/layout' }
    }
    const image_queries = Array.isArray(p.image_queries)
      ? p.image_queries.filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u))
      : []
    pages.push({
      title,
      brief,
      layout,
      ...(typeof p.type === 'string' ? { type: p.type } : {}),
      ...(image_queries.length > 0 ? { image_queries } : {}),
    })
  }
  const core_hook = typeof rec.core_hook === 'string' && rec.core_hook.length > 0 ? rec.core_hook : pages[0]?.title ?? ''
  return { ok: true, outline: { core_hook, pages } }
}

export function coercePagesSpec(value: unknown): PageSpecLike[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  if (!value.every(isPageSpecLike)) return undefined
  return value
}

export function httpImagesFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u))
}


async function llmJson(
  run: HostLlmOnce,
  system: string,
  user: string,
  signal: AbortSignal,
  parse: (text: string) => { ok: true; value: unknown } | { ok: false; error: string },
  maxTokens?: number,
): Promise<unknown> {
  let lastErr = 'empty model output'
  for (let attempt = 0; attempt < 2; attempt++) {
    if (signal.aborted) throw new Error('planning failed: aborted')
    const prompt = attempt === 0
      ? user
      : `${user}\n\nYour previous output was rejected: ${lastErr}. Output the corrected JSON object only.`
    let text: string
    try {
      text = await run(system, prompt, signal, maxTokens)
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
      continue
    }
    if (typeof text !== 'string' || text.trim().length === 0) {
      lastErr = 'empty model output'
      continue
    }
    const parsed = parse(text)
    if (parsed.ok) return parsed.value
    lastErr = parsed.error
  }
  throw new Error(`planning failed: ${lastErr}`)
}

export async function planDeckPages(
  input: Record<string, unknown>,
  run: HostLlmOnce,
  signal: AbortSignal,
): Promise<PageSpecLike[]> {
  const given = coercePagesSpec(input.pages_spec)
  if (given !== undefined) return given
  if (input.pages_spec !== undefined) {
    throw new Error('planning failed: pages_spec must be a non-empty array of PageSpec objects')
  }

  const topic = typeof input.topic === 'string' ? input.topic.trim() : ''
  const approx = typeof input.approx_pages === 'number' && Number.isFinite(input.approx_pages)
    ? Math.max(1, Math.min(12, Math.round(input.approx_pages)))
    : 3
  const style = typeof input.style === 'string' && input.style.length > 0 ? input.style : DEFAULT_STYLE
  const context = typeof input.context === 'string' && input.context.length > 0 ? input.context : undefined

  let outline: DeckOutline | undefined
  const pagesInput = input.pages
  if (Array.isArray(pagesInput) && pagesInput.length > 0) {
    const parsed = parseOutline(JSON.stringify({
      core_hook: typeof input.core_hook === 'string' ? input.core_hook : topic,
      pages: pagesInput,
    }))
    if (!parsed.ok) throw new Error(`planning failed: ${parsed.error}`)
    outline = parsed.outline
  }
  if (outline === undefined) {
    if (topic.length === 0) throw new Error('planning failed: topic is required when pages_spec is omitted')
    const outlineArgs: { topic: string; count: number; context?: string; styleSkill?: string } = {
      topic,
      count: approx,
      styleSkill: style,
    }
    if (context !== undefined) outlineArgs.context = context
    const planned = await llmJson(
      run,
      PLAN_DECK_SYSTEM_PROMPT,
      planDeckUserMessage(outlineArgs),
      signal,
      (text) => {
        const parsed = parseOutline(text)
        return parsed.ok ? { ok: true, value: parsed.outline } : parsed
      },
      2048,
    )
    outline = planned as DeckOutline
  }

  const sharedImages = httpImagesFrom(input.image_urls)
  const specs: PageSpecLike[] = []
  for (const [i, page] of outline.pages.entries()) {
    const pageImages = [
      ...sharedImages,
      ...(page.image_queries ?? []).filter((u) => /^https?:\/\//i.test(u)),
    ]
    const specArgs: Parameters<typeof pageSpecUserMessage>[0] = {
      style,
      coreHook: outline.core_hook,
      pageIndex: i + 1,
      totalPages: outline.pages.length,
      title: page.title,
      layout: page.layout,
      brief: page.brief,
      images: pageImages,
    }
    if (topic.length > 0) specArgs.topic = topic
    if (context !== undefined) specArgs.context = context
    const spec = await llmJson(
      run,
      pageSpecSystemPrompt(SPEC_CANVAS_W, SPEC_CANVAS_H),
      pageSpecUserMessage(specArgs),
      signal,
      (text) => {
        const parsed = parsePageSpecLike(text)
        return parsed.ok ? { ok: true, value: parsed.spec } : parsed
      },
      4096,
    )
    specs.push(spec as PageSpecLike)
  }
  if (specs.length === 0) throw new Error('planning failed: no pages produced')
  return specs
}

export async function planOnePageSpec(
  input: Record<string, unknown>,
  run: HostLlmOnce,
  signal: AbortSignal,
): Promise<PageSpecLike> {
  const given = input.page_spec
  if (given !== undefined) {
    if (!isPageSpecLike(given)) throw new Error('planning failed: page_spec must be a PageSpec object')
    return given
  }
  const brief = typeof input.brief === 'string' ? input.brief.trim() : ''
  if (brief.length === 0) throw new Error('planning failed: brief is required when page_spec is omitted')
  const title = typeof input.title === 'string' && input.title.length > 0 ? input.title : 'Slide'
  const layout = typeof input.layout === 'string' && input.layout.length > 0 ? input.layout : 'cover_dark_minimal'
  const style = typeof input.style === 'string' && input.style.length > 0
    ? input.style
    : DEFAULT_STYLE
  const spec = await llmJson(
    run,
    pageSpecSystemPrompt(SPEC_CANVAS_W, SPEC_CANVAS_H),
    pageSpecUserMessage({
      style,
      coreHook: title,
      pageIndex: 1,
      totalPages: 1,
      title,
      layout,
      brief,
      images: httpImagesFrom(input.image_urls),
    }),
    signal,
    (text) => {
      const parsed = parsePageSpecLike(text)
      return parsed.ok ? { ok: true, value: parsed.spec } : parsed
    },
    4096,
  )
  return spec as PageSpecLike
}
