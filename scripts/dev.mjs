#!/usr/bin/env node
/**
 * GenOffice 栈开发入口（零依赖，Node >= 22）。
 *
 *   node scripts/dev.mjs status         relay / DSH 实例健康检查（默认命令）
 *   node scripts/dev.mjs start-relay    确保 :8787 relay 在跑（不在则拉起，日志 /tmp/genoffice-web.log）
 *   node scripts/dev.mjs smoke          对运行中的 relay 跑契约形状断言 + 跨侧镜像一致性
 *   node scripts/dev.mjs open <path> [--no-browser]   转发给 upstream/web/open.mjs
 *
 * 契约断言与 contracts/ 目录保持一致（relay-api.md / events.md）；接口改动先改
 * contracts/ 再改两侧源码，最后跑 smoke 验证。
 */
import { writeFile, readFile, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { openSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const UPSTREAM = join(ROOT, '../upstream')
const RELAY_BASE = 'http://127.0.0.1:8787'
const DSH_URL = 'http://127.0.0.1:3080'
const LOG_FILE = '/tmp/genoffice-web.log'

async function relayUp() {
  try {
    const resp = await fetch(`${RELAY_BASE}/api/health`, { signal: AbortSignal.timeout(2000) })
    return resp.ok
  } catch {
    return false
  }
}

async function startRelay() {
  if (await relayUp()) {
    console.log('[dev] relay 已在运行:', RELAY_BASE)
    return
  }
  console.log('[dev] 启动 relay:', join(UPSTREAM, 'web/server.mjs'))
  const logFd = openSync(LOG_FILE, 'a')
  const child = spawn(process.execPath, [join(UPSTREAM, 'web/server.mjs')], {
    cwd: UPSTREAM,
    stdio: ['ignore', logFd, logFd],
    detached: true,
  })
  child.unref()
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250))
    if (await relayUp()) {
      console.log('[dev] relay 就绪 (日志:', LOG_FILE + ')')
      return
    }
  }
  console.error('[dev] relay 启动超时 — 手动跑: cd upstream && node web/server.mjs')
  process.exit(1)
}

async function status() {
  const relay = await relayUp()
  console.log(`relay  :8787  ${relay ? 'UP' : 'DOWN'}`)
  try {
    const resp = await fetch(DSH_URL, { signal: AbortSignal.timeout(3000) })
    console.log(`dsh    :3080  ${resp.status === 200 ? 'UP' : `HTTP ${resp.status}`}`)
  } catch {
    console.log('dsh    :3080  DOWN')
  }
  if (!relay) console.log('提示: 运行 `node scripts/dev.mjs start-relay` 拉起 relay')
  return relay ? 0 : 1
}

// ── 契约冒烟（断言形状，与 contracts/relay-api.md 对齐）──────────────────

let failures = 0
function check(name, cond, detail = '') {
  if (cond) console.log(`  PASS  ${name}`)
  else {
    failures++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function smoke() {
  if (!(await relayUp())) {
    console.error('[smoke] relay 未运行 — 先 `node scripts/dev.mjs start-relay`')
    process.exit(1)
  }
  console.log('[smoke] 契约断言（relay-api.md）:')

  // 1. health
  const health = await (await fetch(`${RELAY_BASE}/api/health`)).json()
  check('GET /api/health', health.ok === true && health.name === 'genoffice-web-relay',
    JSON.stringify(health))

  // 2. /api/dir 形状（插件面板的消费形状）
  const dir = await (await fetch(`${RELAY_BASE}/api/dir?path=${encodeURIComponent('/tmp')}`)).json()
  check('GET /api/dir?path=/tmp → ok', dir.ok === true, dir.error)
  check('  path/parent 为字符串', typeof dir.path === 'string' && typeof dir.parent === 'string')
  const e0 = dir.entries?.[0]
  check('  entries 为数组且每项含 name/dir/hidden/symlink',
    Array.isArray(dir.entries) && e0 && typeof e0.name === 'string' &&
    typeof e0.dir === 'boolean' && typeof e0.hidden === 'boolean' &&
    typeof e0.symlink === 'boolean')
  check('  /api/dir 缺省 = 主目录', (await (await fetch(`${RELAY_BASE}/api/dir`)).json()).path === process.env.HOME)

  // 3. /api/file 字节回读（path: 形态后端）
  const tmp = join(tmpdir(), `genoffice-smoke-${randomBytes(4).toString('hex')}.docx`)
  const bytes = randomBytes(4096)
  await writeFile(tmp, bytes)
  try {
    const file = await (await fetch(`${RELAY_BASE}/api/file?path=${encodeURIComponent(tmp)}`)).json()
    const round = Buffer.from(file.base64 ?? '', 'base64')
    check('GET /api/file 读绝对路径', file.ok === true && round.equals(bytes), file.error)
    check('  name 为文件名', file.name === tmp.split('/').pop())
    const bad = await (await fetch(`${RELAY_BASE}/api/file?path=${encodeURIComponent('/nonexistent-xyz')}`)).json()
    check('  不可读路径 → ok:false', bad.ok === false)
    const postedFile = await (await fetch(`${RELAY_BASE}/api/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: tmp, base64: bytes.toString('base64') }),
    })).json()
    check('POST /api/file 成功含数值 mtimeMs', postedFile.ok === true && typeof postedFile.mtimeMs === 'number', JSON.stringify(postedFile))
  } finally {
    await rm(tmp, { force: true })
  }

  // 4. inject 一次性 token 回读（open.mjs 形态）
  const inj = await fetch(`${RELAY_BASE}/api/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'smoke.md' },
    body: bytes,
  }).then((r) => r.json())
  check('POST /api/inject → token', inj.ok === true && typeof inj.token === 'string', inj.error)
  const pulled = await (await fetch(`${RELAY_BASE}/api/inject/${inj.token}`)).json()
  check('GET /api/inject/<token> 字节回读', pulled.ok === true &&
    Buffer.from(pulled.base64 ?? '', 'base64').equals(bytes))
  const second = await fetch(`${RELAY_BASE}/api/inject/${inj.token}`)
  check('  token 一次性（二次读取 404）', second.status === 404)

  // 5. 插件 iframe 的 open= URL 形态可达（SPA 由 relay 托管）
  for (const [ext, app] of [['docx', 'docs'], ['md', 'markdown']]) {
    const url = `${RELAY_BASE}/${app}/?open=${encodeURIComponent(`path:${tmp}`)}`
    const resp = await fetch(url)
    const ct = resp.headers.get('content-type') ?? ''
    check(`GET /${app}/?open=path:… 可达（${ext} 预览 URL 形态）`, resp.status === 200 && ct.includes('text/html'))
  }

  // 6. 未知 API → 404
  check('未知 /api/* → 404', (await fetch(`${RELAY_BASE}/api/nope`)).status === 404)

  // 7. 插件侧 PREVIEWABLE 可读（定义在 relay.ts；内测 markdown 补丁 / wt-artifact 已删）
  const pluginRoot = ROOT
  const previewableFiles = [
    join(pluginRoot, 'packages/tab-genoffice/src/tabs/relay.ts'),
    join(pluginRoot, 'packages/tab-genoffice/src/tabs/genoffice.tsx'),
  ]
  try {
    let tabExts = []
    let lastErr = ''
    for (const previewableFile of previewableFiles) {
      try {
        const panelSrc = await readFile(previewableFile, 'utf8')
        tabExts = [...(panelSrc.match(/const PREVIEWABLE[\s\S]*?=\s*\{([\s\S]*?)\}/)?.[1] ?? '')
          .matchAll(/([a-z0-9]+)\s*:/g)].map((m) => m[1])
        if (tabExts.length > 0) break
      } catch (e) {
        lastErr = e.message
      }
    }
    const needExts = ['docx', 'md', 'xlsx', 'pptx', 'pdf']
    check('tab PREVIEWABLE 可解析', needExts.every((e) => tabExts.includes(e)),
      tabExts.length > 0 ? `tab=[${tabExts}]` : lastErr || 'tab=[]')
  } catch (e) {
    check('tab-genoffice 面板源码可读', false, e.message)
  }

  // 8. 控制面端点形状（contracts/control-api.md，INV-004 镜像点：server.mjs / 适配器 / host / smoke）
  const badDoc = 'zzz'
  check('GET /api/control/stream 非法 docId → 400',
    (await fetch(`${RELAY_BASE}/api/control/stream?docId=${badDoc}`)).status === 400)
  const noexec = await (await fetch(`${RELAY_BASE}/api/control/notify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ docId: 'a'.repeat(64), kind: 'tool-result', requestId: 'r', payload: {} }),
  })).json()
  check('POST /api/control/notify 未注册 → ok:false', noexec.ok === false && noexec.error === 'executor not registered', noexec.error)
  const noexecTool = await (await fetch(`${RELAY_BASE}/api/control/docs/${'a'.repeat(64)}/tool`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ call: { id: 'c', name: 'read_blocks', input: {} } }),
  })).json()
  check('POST tool 未注册 → executor not registered',
    noexecTool.ok === false && noexecTool.error === 'executor not registered', noexecTool.error)
  const badInput = await (await fetch(`${RELAY_BASE}/api/control/docs/${'a'.repeat(64)}/tool`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ call: { id: 'c', name: 'replace_blocks', input: 'not-an-object' } }),
  })).json()
  check('POST tool 非法 input → invalid input（不执行）', badInput.ok === false && badInput.error === 'invalid input', badInput.error)
  // 五 app 白名单（BR-003 未注册形状；docs/markdown 已有，sheets/slides/pdf 为扩展）
  const controlApps = ['docs', 'markdown', 'sheets', 'slides', 'pdf']
  const appStates = {}
  for (const app of controlApps) {
    const r = await (await fetch(`${RELAY_BASE}/api/control/${app}/${'a'.repeat(64)}/context`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })).json()
    appStates[app] = r.ok === false && r.error === 'executor not registered'
  }
  check('五 app 控制面未注册 → executor not registered',
    Object.values(appStates).every(Boolean),
    Object.entries(appStates).filter(([, ok]) => !ok).map(([a]) => a).join(',') || '全部通过')
  check('POST /api/control/<app>/… 未知 app → 404',
    (await fetch(`${RELAY_BASE}/api/control/foo/${'a'.repeat(64)}/context`, { method: 'POST', body: '{}' })).status === 404)
  const openRes = await (await fetch(`${RELAY_BASE}/api/control/open`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '/tmp/smoke-doc.md' }),
  })).json()
  check('POST /api/control/open → 64hex docId', openRes.ok === true && /^[0-9a-f]{64}$/.test(openRes.docId ?? ''), openRes.error)
  check('  docId 与 sha256(绝对路径) 一致', openRes.docId === createHash('sha256').update('/tmp/smoke-doc.md').digest('hex'))
  check('  registered 为 boolean（执行器是否已挂上 SSE）', typeof openRes.registered === 'boolean')
  const exportNoexec = await (await fetch(`${RELAY_BASE}/api/control/docs/${'a'.repeat(64)}/export`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '/tmp/smoke-doc.md', saveAs: '/tmp/smoke-copy.md' }),
  })).json()
  check('export saveAs 未注册 → executor not registered',
    exportNoexec.ok === false && exportNoexec.error === 'executor not registered', exportNoexec.error)
  const relSaveAs = await (await fetch(`${RELAY_BASE}/api/control/docs/${'a'.repeat(64)}/export`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '/tmp/smoke-doc.md', saveAs: 'relative.docx' }),
  })).json()
  check('相对 saveAs → invalid saveAs（或执行器未注册）',
    relSaveAs.ok === false && (relSaveAs.error === 'invalid saveAs' || relSaveAs.error === 'executor not registered'),
    relSaveAs.error)

  // 8b. /api/open 广播：file 事件带回 sessionId（与控制面 registered 分开）
  const selfPath = fileURLToPath(import.meta.url)
  const openAc = new AbortController()
  const openTimer = setTimeout(() => openAc.abort(), 4000)
  try {
    const stream = await fetch(`${RELAY_BASE}/api/open/stream`, { signal: openAc.signal })
    check('GET /api/open/stream → SSE', stream.ok === true && (stream.headers.get('content-type') ?? '').includes('text/event-stream'))
    const reader = stream.body?.getReader()
    const dec = new TextDecoder()
    let buf = ''
    const readUntil = async (pred) => {
      if (!reader) return null
      const deadline = Date.now() + 2500
      while (Date.now() < deadline) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const got = pred(buf)
        if (got) return got
      }
      return pred(buf)
    }
    const hello = await readUntil((s) => /event: hello/.test(s) ? true : null)
    check('  open/stream hello', hello === true)
    const posted = await (await fetch(`${RELAY_BASE}/api/open`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: selfPath, sessionId: 'smoke-session' }),
    })).json()
    check('POST /api/open → ok', posted.ok === true && posted.path === selfPath, posted.error)
    check('  subscribers 为数字（/api/open/stream 连接数）', typeof posted.subscribers === 'number', JSON.stringify(posted))
    const fileEv = await readUntil((s) => {
      const m = s.match(/event: file\ndata: (\{.*?\})/)
      return m ? JSON.parse(m[1]) : null
    })
    check('  open/stream file 带 sessionId', fileEv?.path === selfPath && fileEv?.sessionId === 'smoke-session', JSON.stringify(fileEv))
  } catch (e) {
    check('GET /api/open/stream → SSE', false, e.message)
  } finally {
    clearTimeout(openTimer)
    openAc.abort()
  }

  // 9. 工具名集合镜像（INV-004：契约表 ↔ skill AGENT_TOOLS ↔ 插件 host 注册）
  const controlContract = await readFile(join(ROOT, 'contracts/control-api.md'), 'utf8')
  check('契约 §2.1 事件表含 saved', /\| `saved` \|/.test(controlContract))
  const contractTools = [...controlContract.matchAll(/^\| `((?:docx|markdown|xlsx|pptx|pdf)[:_][a-z_]+)` \|/gm)].map((m) => m[1])
  const familyCount = (p) => contractTools.filter((t) => t.startsWith(`${p}_`)).length
  check('契约工具名集合表可解析（docx 11 + markdown 5 + xlsx 13 + pptx 39 + pdf 21）',
    familyCount('docx') === 11 && familyCount('markdown') === 5 && familyCount('xlsx') === 13 &&
    familyCount('pptx') === 39 && familyCount('pdf') === 21,
    `docx=${familyCount('docx')} markdown=${familyCount('markdown')} xlsx=${familyCount('xlsx')} pptx=${familyCount('pptx')} pdf=${familyCount('pdf')}`)
  const skillMirrors = {
    docs: join(UPSTREAM, 'apps/docs/src/renderer/ai/tools.ts'),
    markdown: join(UPSTREAM, 'apps/markdown/src/renderer/ai/tools.ts'),
    sheets: join(UPSTREAM, 'apps/sheets/src/renderer/ai/tools.ts'),
    slides: join(UPSTREAM, 'apps/slides/src/renderer/ai/slides-skill.ts'),
    pdf: join(UPSTREAM, 'apps/pdf/src/renderer/ai/tools.ts'),
  }
  const prefixOf = { docs: 'docx', markdown: 'markdown', sheets: 'xlsx', slides: 'pptx', pdf: 'pdf' }
  for (const [app, file] of Object.entries(skillMirrors)) {
    const src = await readFile(file, 'utf8')
    const skillNames = [...src.matchAll(/name: '([a-z_]+)'/g)].map((m) => m[1])
    const contractAppTools = contractTools
      .filter((t) => t.startsWith(`${prefixOf[app]}_`))
      .map((t) => t.replace(/^[a-z]+[:_]/, ''))
      .filter((n) => n !== 'save')
    const missing = contractAppTools.filter((n) => !skillNames.includes(n))
    check(`工具名集合镜像（契约 ↔ ${app} skill AGENT_TOOLS）`,
      missing.length === 0 && contractAppTools.length === skillNames.length,
      missing.length > 0 ? `契约有而 skill 无: ${missing.join(',')}` : `契约 ${contractAppTools.length} vs skill ${skillNames.length}`)
  }
  // 插件 host + capability 必须与契约整表锁步（五族已接线，不再允许整族缺席）。
  const hostTools = join(pluginRoot, 'packages/tab-genoffice/src/host/tool-schema.ts')
  const capFile = join(pluginRoot, 'packages/tab-genoffice/src/host/capability.ts')
  try {
    const hostSrc = await readFile(hostTools, 'utf8')
    const hostNames = [...hostSrc.matchAll(/name:\s*'((?:docx|markdown|xlsx|pptx|pdf)[:_][a-z_]+)'/g)].map((m) => m[1])
    const hostFamilies = [...new Set(hostNames.map((t) => t.split(/[:_]/)[0]))]
    const requiredFamilies = ['docx', 'markdown', 'xlsx', 'pptx', 'pdf']
    const missingHost = contractTools.filter((t) => !hostNames.includes(t))
    check('工具名集合镜像（契约 ↔ 插件 host 注册）', missingHost.length === 0,
      `契约有而 host 无: ${missingHost.join(',')}`)
    check('五族 host 均已声明', requiredFamilies.every((f) => hostFamilies.includes(f)),
      `hostFamilies=${hostFamilies.join(',')}`)
    const capSrc = await readFile(capFile, 'utf8')
    const prefixToApp = { docx: 'docs', markdown: 'markdown', xlsx: 'sheets', pptx: 'slides', pdf: 'pdf' }
    const missingCap = contractTools.filter((t) => {
      const i = t.indexOf('_')
      const app = prefixToApp[t.slice(0, i)]
      return !capSrc.includes(`'${app}:${t.slice(i + 1)}'`)
    })
    check('工具名集合镜像（契约 ↔ 插件 capability）', missingCap.length === 0,
      `契约有而 capability 无: ${missingCap.join(',')}`)
  } catch (e) {
    check('插件 host/capability 可读', false, e.message)
  }

  console.log(failures === 0 ? '[smoke] 全部通过 ✔' : `[smoke] ${failures} 项失败 ✘`)
  process.exit(failures === 0 ? 0 : 1)
}

async function openFile(fileArg) {
  if (!fileArg) {
    console.error('用法: node scripts/dev.mjs open <文件路径> [--no-browser]  (支持 .docx / .md / .xlsx / .pptx / .pdf)')
    process.exit(1)
  }
  await startRelay()
  const extra = process.argv.slice(4) // 透传 open.mjs 的选项（如 --no-browser）
  const child = spawn(process.execPath, [join(UPSTREAM, 'web/open.mjs'), resolve(fileArg), ...extra], {
    cwd: UPSTREAM,
    stdio: 'inherit',
  })
  child.on('exit', (code) => process.exit(code ?? 1))
}

const cmd = process.argv[2] ?? 'status'
const arg = process.argv[3]
if (cmd === 'start-relay') await startRelay()
else if (cmd === 'status') process.exit(await status())
else if (cmd === 'smoke') await smoke()
else if (cmd === 'open') await openFile(arg)
else {
  console.error(`未知命令: ${cmd}\n用法: node scripts/dev.mjs [status|start-relay|smoke|open <path>]`)
  process.exit(1)
}
