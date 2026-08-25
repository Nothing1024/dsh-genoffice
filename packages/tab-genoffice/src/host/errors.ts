/**
 * Seven failure classes for GenOffice control tools (BR-010).
 * Pure mapping: 中文说明 + 上游原文 + 下一步. Never replaces the upstream string.
 */

export type ControlErrorClass =
  | 'relay-down'
  | 'executor-missing'
  | 'invalid-params'
  | 'upstream-guard'
  | 'capability-unavailable'
  | 'write-conflict'
  | 'sync-window'
  | 'unrecognized'

export interface MappedControlError {
  class: ControlErrorClass
  message: string
}

export interface ClassifyInput {
  error: string
  path?: string
  /** Pre-classified kind when the caller already knows the source. */
  kind?: 'fetch' | 'relay' | 'executor' | 'sync' | 'capability' | 'local'
}

function triple(zh: string, upstream: string, next: string): string {
  const src = upstream.trim().length > 0 ? upstream.trim() : '（无上游原文）'
  return `${zh}\n上游原文：${src}\n下一步：${next}`
}

const GUARD_RE =
  /blockScratchBuild|htmlGenerated|notAvailable|空白|守卫|cannot add|scratch build|cloud generation|htmlToPptx|cloudGenStatus/i

export function classifyControlError(input: ClassifyInput): MappedControlError {
  const err = input.error
  const path = input.path ?? ''

  if (input.kind === 'sync' || /文档正在同步|sync window/i.test(err)) {
    return {
      class: 'sync-window',
      message: triple(
        '文档正在同步，请稍后再试。本次调用不会被重放。',
        err,
        '等侧栏「正在同步…」结束后再调用工具。',
      ),
    }
  }

  if (input.kind === 'capability') {
    return {
      class: 'capability-unavailable',
      message: triple(
        '该能力在本机 GenOffice web 部署下不可用，本不该被调用。',
        err,
        '改用系统提示词里给出的替代（检索用 web_search；插图用本机 imagePath）。从零出片用 pptx_generate_deck 或 pptx_land_pages。',
      ),
    }
  }

  if (
    input.kind === 'fetch'
    || /econnrefused|fetch failed|failed to fetch|networkerror|relay 返回 http/i.test(err)
  ) {
    return {
      class: 'relay-down',
      message: triple(
        'GenOffice relay 不可达。控制工具需要本机 localhost:8787 上的中继。',
        err,
        '在 GenOffice 仓库执行 `node web/server.mjs`（或 `npm run web`），然后点侧栏「重新检查」。',
      ),
    }
  }

  if (err.includes('没有 DSH 页面在监听') || err.includes('no-gui-listening')) {
    return {
      class: 'executor-missing',
      message: triple(
        '没有 DSH 页面在监听打开请求。',
        err,
        '请先在浏览器打开 DSH（默认 http://127.0.0.1:3080）再重试。',
      ),
    }
  }

  if (input.kind === 'relay' && err === 'executor not registered' || err.includes('executor not registered')) {
    return {
      class: 'executor-missing',
      message: triple(
        `文档尚未在控制模式打开${path ? `（${path}）` : ''}。`,
        err,
        '在侧栏 explorer / chat 产物行 / git 面板点击该文件，等控制模式 iframe 加载后再重试。',
      ),
    }
  }

  if (err === 'invalid input' || /invalid input|参数无效/i.test(err)) {
    return {
      class: 'invalid-params',
      message: triple(
        '参数无效：工具参数必须是合法 JSON 对象，且字段名与上游 skill 一致。',
        err,
        '按工具 description 修正参数后重试；不要自造上游不认识的键。',
      ),
    }
  }

  if (err === 'conflict' || /mtime 冲突|已被外部修改/i.test(err)) {
    return {
      class: 'write-conflict',
      message: triple(
        '写回冲突：磁盘上的文件与冲突基线不一致，未覆盖原文件。',
        err,
        '若刚点过「写入磁盘」，等同步完成后再保存。若确有其它程序改了文件，点「从磁盘重载」丢弃未保存编辑后再试。',
      ),
    }
  }

  if (err === 'exists' || /(?:^|\b)exists(?:\b|$)/.test(err)) {
    return {
      class: 'write-conflict',
      message: triple(
        '另存目标已存在，未覆盖。',
        err,
        '换个名字或删除既有副本',
      ),
    }
  }

  if (/^planning failed:/i.test(err)) {
    return {
      class: 'invalid-params',
      message: triple(
        '宿主规划失败，未落地。',
        err,
        '改 topic/brief，或改调 pptx_land_pages 自写 PageSpec。不要把 key 写入 iframe。',
      ),
    }
  }

  if (input.kind === 'executor' && GUARD_RE.test(err) || GUARD_RE.test(err)) {
    return {
      class: 'upstream-guard',
      message: triple(
        '上游策略拒绝了这次编辑（不是参数写错）。空白稿需先落地再改元素。',
        err,
        '空白稿用 pptx_generate_deck 或 pptx_land_pages 出片后再改；不要反复重试同一调用。',
      ),
    }
  }

  if (input.kind === 'local') {
    return {
      class: 'invalid-params',
      message: triple('本机参数校验失败。', err, '修正 path / imagePath 后重试（必须是绝对路径，且不得含 ..）。'),
    }
  }

  return {
    class: 'unrecognized',
    message: triple('未识别的上游错误。', err, '规划失败看 planning failed:；落地失败看 land_pages 原文。不要盲目重试。'),
  }
}
