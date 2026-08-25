import { describe, expect, it } from 'vitest'
import { classifyControlError } from '../src/host/errors.ts'
import { isInSyncWindow, markSyncWindow, resetSyncWindows } from '../src/host/sync.ts'
import { createControlTools } from '../src/host/tools.ts'

describe('seven error classes', () => {
  it('relay-down includes 中文说明, 上游原文, and 下一步', () => {
    const m = classifyControlError({ error: 'fetch failed', kind: 'fetch' })
    expect(m.class).toBe('relay-down')
    expect(m.message).toMatch(/relay 不可达/)
    expect(m.message).toMatch(/上游原文：fetch failed/)
    expect(m.message).toMatch(/下一步：/)
    expect(m.message).toMatch(/node web\/server\.mjs/)
  })

  it('executor-missing', () => {
    const m = classifyControlError({ error: 'executor not registered', path: '/tmp/a.docx' })
    expect(m.class).toBe('executor-missing')
    expect(m.message).toMatch(/尚未在控制模式打开/)
    expect(m.message).toMatch(/上游原文：executor not registered/)
    expect(m.message).toMatch(/下一步：/)
  })

  it('invalid-params', () => {
    const m = classifyControlError({ error: 'invalid input' })
    expect(m.class).toBe('invalid-params')
    expect(m.message).toMatch(/参数无效/)
    expect(m.message).toMatch(/上游原文：invalid input/)
    expect(m.message).toMatch(/下一步：/)
  })

  it('upstream-guard', () => {
    const m = classifyControlError({
      error: 'blockScratchBuild: add text on a blank deck',
      kind: 'executor',
    })
    expect(m.class).toBe('upstream-guard')
    expect(m.message).toMatch(/上游策略/)
    expect(m.message).toMatch(/blockScratchBuild/)
    expect(m.message).toMatch(/下一步：/)
  })

  it('capability-unavailable', () => {
    const m = classifyControlError({ error: 'not registered', kind: 'capability' })
    expect(m.class).toBe('capability-unavailable')
    expect(m.message).toMatch(/不可用/)
    expect(m.message).toMatch(/web_search/)
    expect(m.message).toMatch(/下一步：/)
  })

  it('write-conflict', () => {
    const m = classifyControlError({ error: 'conflict' })
    expect(m.class).toBe('write-conflict')
    expect(m.message).toMatch(/写回冲突/)
    expect(m.message).toMatch(/上游原文：conflict/)
    expect(m.message).toMatch(/从磁盘重载/)
  })

  it('sync-window', () => {
    resetSyncWindows()
    markSyncWindow('/tmp/a.docx')
    expect(isInSyncWindow('/tmp/a.docx')).toBe(true)
    const m = classifyControlError({ error: 'sync window', path: '/tmp/a.docx', kind: 'sync' })
    expect(m.class).toBe('sync-window')
    expect(m.message).toMatch(/正在同步/)
    expect(m.message).toMatch(/不会被重放/)
    expect(m.message).toMatch(/下一步：/)
    resetSyncWindows()
  })

  it('control tool execute returns 文档正在同步 before calling relay', async () => {
    resetSyncWindows()
    markSyncWindow('/tmp/a.docx')
    const tools = createControlTools()
    const tool = tools.find((t) => t.name === 'docx_get_document_context')
    expect(tool).toBeDefined()
    await expect(
      tool!.execute({ path: '/tmp/a.docx' }, { signal: new AbortController().signal } as never),
    ).rejects.toThrow(/正在同步/)
    resetSyncWindows()
  })

  it('exists maps to write-conflict', () => {
    const m = classifyControlError({ error: 'exists' })
    expect(m.class).toBe('write-conflict')
    expect(m.message).toMatch(/另存目标已存在/)
    expect(m.message).toMatch(/换个名字或删除既有副本/)
  })

  it('no GUI listening maps to executor-missing', () => {
    const m = classifyControlError({
      error: '没有 DSH 页面在监听 /api/open/stream —— 请先在浏览器打开 DSH（默认 http://127.0.0.1:3080）再重试',
    })
    expect(m.class).toBe('executor-missing')
    expect(m.message).toMatch(/没有 DSH 页面在监听/)
  })

  it('unrecognized keeps the upstream string', () => {
    const m = classifyControlError({ error: 'weird-xyz-42' })
    expect(m.class).toBe('unrecognized')
    expect(m.message).toMatch(/未识别/)
    expect(m.message).toContain('weird-xyz-42')
  })
})
