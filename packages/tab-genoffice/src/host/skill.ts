/**
 * Runtime skill: control-mode workflow. Lives on ctx.skills, not systemPrompt.
 * Catalog shows name + description; the body loads only after `skill dsh-genoffice`.
 */
import type { Context } from '@deepseek-ai/cordis'
import { lookupSkills, type SkillsService } from './lookup.ts'

export const GENOFFICE_SKILL_NAME = 'dsh-genoffice'

/** Catalog text. Do not list “做 PPT / 汇报 PPT” — those would auto-route. Capped at 500. */
export const GENOFFICE_SKILL_DESCRIPTION = [
  '【不要主动触发】仅当用户明确写出本 skill 名称或发送 /dsh-genoffice 时再加载。',
  '用户只说做 PPT、汇报、答辩、路演时不要调用本 skill。',
  '加载后：先 pptx_open / docx_open / xlsx_open / md_open，等到「已打开控制模式」，再用内置工具改稿。',
].join('')

export const GENOFFICE_SKILL_CONTENT = [
  '# GenOffice 控制模式',
  '',
  '本 skill 不自动适用于「做 PPT」类请求。只有用户点名 `dsh-genoffice` 或发送 `/dsh-genoffice` 后才按下面做。',
  '',
  '本会话有内置 `pptx_*` / `docx_*` / `xlsx_*` / `md_*` 工具。按本 skill 工作时只走这些工具。',
  '',
  '## 不要走这些路径',
  '',
  '- 不要调用 skill `ppt-image-first` 或 `third-imagegen`。若已经加载，停止执行它们的步骤。',
  '- 不要用 bash、python、python-pptx、soffice、LibreOffice 或生图 API 生成或改写 pptx/docx/xlsx。',
  '- 不要先拼 HTML 预览再导出 PPT。',
  '',
  '## 步骤',
  '',
  '1. 先调用对应 `pptx_open` / `docx_open` / `xlsx_open` / `md_open`，path 为本机绝对路径。',
  '2. 等到工具返回「已打开控制模式：<path>」，再调用其它同前缀工具。',
  '3. 读改先 `*_get_*_context`（PPT 用 `pptx_get_deck_context`）。',
  '4. 空白 pptx 出片：用 `pptx_generate_deck`（当前会话模型写 PageSpec 再落地）或自写 PageSpec 后 `pptx_land_pages`。不要把 API key 写入 iframe。',
  '5. 只用内置工具改 iframe 内文档。写盘只用 `*_save` 或界面「写入磁盘」。',
  '',
  '## 失败',
  '',
  '若报 `executor not registered` 或「尚未在控制模式打开」，只再调用一次对应 `*_open` 并等待成功。不要改走脚本。',
].join('\n')

export function applySkill(ctx: Context): void {
  const mount = (skills: SkillsService): (() => void) =>
    skills.register({
      name: GENOFFICE_SKILL_NAME,
      description: GENOFFICE_SKILL_DESCRIPTION,
      content: GENOFFICE_SKILL_CONTENT,
      source: 'runtime',
    })
  const existing = lookupSkills(ctx)
  if (existing !== undefined) {
    ctx.effect(() => mount(existing))
    return
  }
  ctx.inject(['skills'], (c) => mount((c as Context & { skills: SkillsService }).skills))
}
