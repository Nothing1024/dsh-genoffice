// @vitest-environment node
// Local-file path detection: the splitter's contract is the conservative
// boundary — absolute POSIX md/mdx/docx paths link, everything else stays
// plain text (URLs, relative paths, mid-word tokens, Windows drives, and
// prose punctuation never leak into a match).
import { describe, expect, it } from 'vitest'
import { LOCAL_FILE_OPEN_EVENT, splitTextWithLocalPaths } from '../src/markdown/local-paths.ts'

const text = (value: string) => ({ kind: 'text' as const, value })
const path = (value: string) => ({ kind: 'path' as const, path: value })

describe('splitTextWithLocalPaths', () => {
  it('keeps text without any path as a single text token', () => {
    expect(splitTextWithLocalPaths('普通的一段文字，没有路径。')).toEqual([text('普通的一段文字，没有路径。')])
    expect(splitTextWithLocalPaths('')).toEqual([])
  })

  it('links an absolute md path in prose', () => {
    expect(splitTextWithLocalPaths('详见 /Users/nothing/report.md 文件')).toEqual([
      text('详见 '),
      path('/Users/nothing/report.md'),
      text(' 文件'),
    ])
  })

  it('links a ~ home path and a docx path', () => {
    expect(splitTextWithLocalPaths('~/docs/notes.docx 已生成')).toEqual([
      path('~/docs/notes.docx'),
      text(' 已生成'),
    ])
  })

  it('keeps CJK prose around the path intact', () => {
    expect(splitTextWithLocalPaths('生成结果见 /数据/报告.md，请查收')).toEqual([
      text('生成结果见 '),
      path('/数据/报告.md'),
      text('，请查收'),
    ])
  })

  it('links several paths in one run', () => {
    expect(splitTextWithLocalPaths('/a.md 与 /b/c.docx')).toEqual([
      path('/a.md'),
      text(' 与 '),
      path('/b/c.docx'),
    ])
  })

  it('trims trailing prose punctuation from the match', () => {
    expect(splitTextWithLocalPaths('(见 /x/a.md)。')).toEqual([
      text('(见 '),
      path('/x/a.md'),
      text(')。'),
    ])
  })

  it('does not link inside URLs', () => {
    expect(splitTextWithLocalPaths('下载 https://example.com/x.md 查看')).toEqual([
      text('下载 https://example.com/x.md 查看'),
    ])
  })

  it('does not link relative paths', () => {
    expect(splitTextWithLocalPaths('参考 docs/a.md 或 ../b.docx')).toEqual([
      text('参考 docs/a.md 或 ../b.docx'),
    ])
  })

  it('does not link mid-word tokens or Windows drives', () => {
    expect(splitTextWithLocalPaths('foo/bar.md 与 C:\\x\\a.docx 都不行')).toEqual([
      text('foo/bar.md 与 C:\\x\\a.docx 都不行'),
    ])
  })

  it('does not link the extension as part of a longer token', () => {
    expect(splitTextWithLocalPaths('v1.2/report.md.txt 与 /x/a.md2')).toEqual([
      text('v1.2/report.md.txt 与 /x/a.md2'),
    ])
  })

  it('links case-insensitive extensions', () => {
    expect(splitTextWithLocalPaths('见 /x/A.MD 和 /x/B.Docx')).toEqual([
      text('见 '),
      path('/x/A.MD'),
      text(' 和 '),
      path('/x/B.Docx'),
    ])
  })

  it('links a path at the very start and end of the string', () => {
    expect(splitTextWithLocalPaths('/x/start.md 中间 /x/end.md')).toEqual([
      path('/x/start.md'),
      text(' 中间 '),
      path('/x/end.md'),
    ])
  })

  it('keeps the raw string recoverable from the tokens', () => {
    const raw = '开头 /a/b.md 中间 ~/c.docx 结尾'
    expect(splitTextWithLocalPaths(raw).map(t => (t.kind === 'text' ? t.value : t.path)).join('')).toBe(raw)
  })
})

describe('LOCAL_FILE_OPEN_EVENT', () => {
  it('names the window event the renderer dispatches', () => {
    expect(LOCAL_FILE_OPEN_EVENT).toBe('dsh:open-local-file')
  })
})
