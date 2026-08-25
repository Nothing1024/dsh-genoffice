import { describe, expect, it } from 'vitest'
import { buildGenOfficePromptText } from '../src/host/prompt.ts'

describe('genoffice system prompt', () => {
  const text = buildGenOfficePromptText()

  it('states the web-deploy boundary and DSH web_search handover', () => {
    expect(text).toMatch(/web 部署/)
    expect(text).toContain('web_search')
    expect(text).toContain('imagePath')
    expect(text).toMatch(/离开控制模式/)
    expect(text).toMatch(/第三方/)
  })

  it('lists deleted capabilities as 不可做, not as instructions to call them', () => {
    expect(text).toMatch(/不可做/)
    expect(text).toMatch(/pptx:generate_image/)
    expect(text).toMatch(/docx:web_search/)
    expect(text).not.toMatch(/请调用 docx_web_search/)
  })

  it('does not bake skill workflow into the system prompt', () => {
    expect(text).not.toMatch(/ppt-image-first/)
    expect(text).not.toMatch(/python-pptx/)
    expect(text).not.toMatch(/不要改走脚本/)
  })
})
