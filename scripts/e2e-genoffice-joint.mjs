#!/usr/bin/env node
/**
 * Master joint harness. Reuses isolated SDK/headless (WRE) plus master.py
 * (UF-001) against the same protocol as the five child drivers.
 *
 *   node scripts/e2e-genoffice-joint.mjs --all [--out DIR]
 *   node scripts/e2e-genoffice-joint.mjs --case scheduling|joint [--out DIR]
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { createHash, randomUUID } from 'node:crypto'
const PLUGIN = fileURLToPath(new URL('..', import.meta.url))
const ENGINE = resolve(process.env.ENGINE_ROOT || join(PLUGIN, 'docs/web-runtime-efficiency/isolated-engine'))
const MASTER = join(PLUGIN, 'docs/genoffice-web-roadmap')
const DEFAULT_OUT = join(MASTER, 'evidence')
const require = createRequire(join(ENGINE, 'package.json'))
const { chromium } = require('playwright')

function gitHead(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function parseArgs(argv) {
  const out = { all: false, caseName: null, outDir: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--all') out.all = true
    else if (argv[i] === '--case') out.caseName = argv[++i]
    else if (argv[i] === '--out') out.outDir = argv[++i]
  }
  return out
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    cwd: opts.cwd || PLUGIN,
    env: { ...process.env, ENGINE_ROOT: ENGINE, ...(opts.env || {}) },
    timeout: opts.timeout || 120_000,
  })
  return {
    code: result.status ?? 1,
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? result.error?.message ?? ''),
  }
}

function assert(name, passed, expected, actual) {
  return { name, status: passed ? 'passed' : 'failed', expected, actual }
}

function docIdFor(absPath) {
  return createHash('sha256').update(String(absPath)).digest('hex')
}

async function archive(outDir, uf, branch, payload, extras = {}) {
  const dir = join(outDir, uf === 'UF-001' ? 'package-validation/UF-001' : 'joint-run/UF-002', branch)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'result.json'), `${JSON.stringify(payload, null, 2)}\n`)
  const consoleText = extras.console
  const consoleBody = typeof consoleText === 'string' && consoleText.length > 0
    ? consoleText
    : `collected=true events=${Array.isArray(extras.consoleEvents) ? extras.consoleEvents.length : 0}\n`
  await writeFile(join(dir, 'console.log'), consoleBody.endsWith('\n') ? consoleBody : `${consoleBody}\n`)
  const network = extras.network && typeof extras.network === 'object'
    ? extras.network
    : { events: 0, note: 'no HTTP captured for this branch' }
  await writeFile(join(dir, 'network.json'), `${JSON.stringify(network, null, 2)}\n`)
  if (extras.screenshot) await writeFile(join(dir, 'screenshot.png'), extras.screenshot)
}

async function screenshotFile(path) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  try {
    await page.goto(`file://${path}`, { waitUntil: 'domcontentloaded' })
    return await page.screenshot({ type: 'png' })
  } finally {
    await page.close().catch(() => {})
    await browser.close().catch(() => {})
  }
}

async function runScheduling(outDir) {
  const validate = run('python3', [join(MASTER, 'master.py'), 'validate'])
  const status = run('python3', [join(MASTER, 'master.py'), 'status', '--json'])
  const next = run('python3', [join(MASTER, 'master.py'), 'next', '--json'])
  const tests = run('python3', ['-m', 'unittest', join(MASTER, 'test_master.py')])
  const wreGate = run('python3', [join(MASTER, 'master.py'), 'gate', 'web-runtime-efficiency', '--json'])
  let wre
  try { wre = JSON.parse(wreGate.stdout.slice(wreGate.stdout.indexOf('{'))) } catch { wre = { passed: false, error: wreGate.stderr } }
  let nextJson
  try { nextJson = JSON.parse(next.stdout.slice(next.stdout.indexOf('{'))) } catch { nextJson = next }
  const csvCount = ['control-session-safety', 'plugin-tool-alignment', 'official-upstream-sync', 'web-feature-completion', 'web-runtime-efficiency', 'genoffice-web-roadmap']
    .filter((name) => existsSync(join(PLUGIN, 'docs', name, 'tasks.csv'))).length
  const shot = await screenshotFile(join(MASTER, 'spec-view.html'))
  const testLog = `${tests.stdout}\n${tests.stderr}`
  const assertions = [
    assert('six-csv', csvCount === 6, 6, csvCount),
    assert('validate-exit-0', validate.code === 0, 0, { code: validate.code, tail: validate.stdout.slice(-200) }),
    assert('wre-gate-passed', wre.passed === true, true, wre.passed),
    assert('next-points-real', nextJson.action === 'close_wrapper' || nextJson.action === 'execute_task' || nextJson.action === 'complete' || nextJson.package === 'genoffice-web-roadmap', true, nextJson),
    assert('master-unittests', tests.code === 0, 0, { code: tests.code, tail: testLog.slice(-300) }),
  ]
  const ok = assertions.every((row) => row.status === 'passed')
  const payload = {
    schema_version: 1,
    package: 'genoffice-web-roadmap',
    uf: 'UF-001',
    branch: 'success',
    status: ok ? 'passed' : 'failed',
    run_id: `joint-sched-${new Date().toISOString()}`,
    source_revisions: { plugin: gitHead(PLUGIN), engine: gitHead(ENGINE) },
    cases: [{ id: 'six-pack-validate-next-gate', status: ok ? 'passed' : 'failed', assertions }],
  }
  if (ok) {
    await archive(outDir, 'UF-001', 'success', payload, {
      console: testLog.slice(-4000),
      network: { events: [{ op: 'validate', code: validate.code }, { op: 'status', code: status.code }, { op: 'next', action: nextJson.action }, { op: 'gate-wre', passed: wre.passed }], count: 4 },
      screenshot: shot,
    })
  }
  if (ok === false) throw new Error(`scheduling success failed: ${JSON.stringify(assertions.filter((row) => row.status !== 'passed'))}`)
  return payload
}

async function runSchedulingFailures(outDir) {
  const shot = await screenshotFile(join(MASTER, 'spec-view.html'))
  const probe = run('python3', [join(PLUGIN, 'scripts/e2e-genoffice-joint-uf001.py')])
  let data
  try { data = JSON.parse(probe.stdout.slice(probe.stdout.indexOf('{'))) } catch { data = { parseError: true, stdout: probe.stdout, stderr: probe.stderr } }
  const fail1Assertions = [
    assert('temp-spec-missing-rejected', data.fail1?.no_execute_task === true, true, data.fail1),
    assert('restore-validate-passed', data.fail1?.restored_passed === true, true, data.fail1),
    assert('real-csv-untouched', data.real_csv_unchanged === true, true, data.real_csv_unchanged),
  ]
  const fail1Ok = fail1Assertions.every((row) => row.status === 'passed')
  const fail1 = {
    schema_version: 1,
    package: 'genoffice-web-roadmap',
    uf: 'UF-001',
    branch: 'failure-1',
    status: fail1Ok ? 'passed' : 'failed',
    run_id: `joint-sched-fail1-${new Date().toISOString()}`,
    source_revisions: { plugin: gitHead(PLUGIN), engine: gitHead(ENGINE) },
    cases: [{ id: 'broken-spec-csv-rejected', status: fail1Ok ? 'passed' : 'failed', assertions: fail1Assertions }],
  }
  await archive(outDir, 'UF-001', 'failure-1', fail1, {
    console: `${probe.stdout}\n${probe.stderr}`.slice(-4000),
    network: { events: [{ op: 'temp-next-missing', code: data.fail1?.broken_code }, { op: 'temp-next-cyclic', code: data.fail1?.cyclic_code }], count: 2 },
    screenshot: shot,
  })

  const fail2Assertions = [
    assert('false-complete-blocked', data.fail2?.downstream_locked === true, true, data.fail2),
    assert('empty-result-rejected', data.fail2?.empty_gate_passed === false, false, data.fail2),
    assert('real-csv-untouched', data.real_csv_unchanged === true, true, data.real_csv_unchanged),
  ]
  const fail2Ok = fail2Assertions.every((row) => row.status === 'passed')
  const fail2 = {
    schema_version: 1,
    package: 'genoffice-web-roadmap',
    uf: 'UF-001',
    branch: 'failure-2',
    status: fail2Ok ? 'passed' : 'failed',
    run_id: `joint-sched-fail2-${new Date().toISOString()}`,
    source_revisions: { plugin: gitHead(PLUGIN), engine: gitHead(ENGINE) },
    cases: [{ id: 'incomplete-evidence-blocks-downstream', status: fail2Ok ? 'passed' : 'failed', assertions: fail2Assertions }],
  }
  await archive(outDir, 'UF-001', 'failure-2', fail2, {
    console: `${probe.stdout}\n${probe.stderr}`.slice(-4000),
    network: { events: [{ op: 'temp-next-false-complete', action: data.fail2?.false_complete_action }, { op: 'temp-gate-empty', passed: data.fail2?.empty_gate_passed }], count: 2 },
    screenshot: shot,
  })
  if (fail1Ok === false || fail2Ok === false) throw new Error('scheduling failures failed')
  return { fail1, fail2 }
}

function diskContains(path, marker) {
  if (existsSync(path) === false) return false
  const buf = readFileSync(path)
  const needle = Buffer.from(marker)
  if (buf.includes(needle) || buf.toString('utf16le').includes(marker)) return true
  if (buf.subarray(0, 2).toString() !== 'PK') return false
  try {
    const entries = execFileSync('python3', ['-c', 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); sys.stdout.buffer.write(b"\\n".join(z.read(n) for n in z.namelist()))', path], { maxBuffer: 8_000_000 })
    return Buffer.from(entries).includes(needle)
  } catch {
    return false
  }
}

async function runJoint(outDir) {
  const { GenOfficeClient, toolOk } = await import(join(ENGINE, 'web/sdk/genoffice-control.mjs'))
  const { HeadlessExecutor } = await import(join(ENGINE, 'web/sdk/headless-executor.mjs'))
  const { createFixtures, startRelay, stopRelay, freePort, DEFAULT_PORT, editFamily, saveApp, post, callTool, toolOutput } = await import(join(ENGINE, 'web/runtime-measure.mjs'))
  const workDir = join(outDir, 'joint-run/work')
  const fixtures = await createFixtures(workDir)
  const port = await freePort(DEFAULT_PORT)
  const relay = await startRelay(port)
  const client = new GenOfficeClient({ base: relay.base })
  const worker = new HeadlessExecutor({ client })
  const other = new HeadlessExecutor({ client })
  const families = []
  const network = []
  const logs = []
  let shot = null
  let stale
  let missingProvider
  let convert
  const md = fixtures.find((row) => row.app === 'markdown' && row.size === 'small')
  const html = fixtures.find((row) => row.app === 'html' && row.size === 'small')
  const userBrowser = await chromium.launch({ headless: true })
  const userPage = await userBrowser.newPage()
  userPage.on('console', (msg) => logs.push(msg.text()))
  userPage.on('response', (resp) => {
    network.push({ method: resp.request().method(), url: resp.url(), status: resp.status() })
  })
  try {
    await userPage.goto(`${relay.base}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    for (const row of fixtures.filter((item) => item.size === 'small')) {
      const marker = `Joint${row.app}`
      const opened = await worker.open(row.path)
      const ctx = await client.context(row.app, row.path)
      const edited = await editFamily(relay.base, row.app, row.path, marker)
      const saved = await saveApp(relay.base, row.app, row.path)
      await worker.release(row.path, { force: true })
      const reopened = await worker.open(row.path)
      const reCtx = await client.context(row.app, row.path)
      const reText = JSON.stringify(reCtx)
      let pdfHit = false
      if (row.app === 'pdf') {
        const searched = await callTool(relay.base, 'pdf', row.path, 'search_text', { query: marker })
        const pages = await callTool(relay.base, 'pdf', row.path, 'read_pages', { start_page: 1, end_page: 1 })
        pdfHit = JSON.stringify(searched).includes(marker) || JSON.stringify(pages).includes(marker) || String(toolOutput(searched)).includes(marker) || String(toolOutput(pages)).includes(marker)
      }
      const persisted = diskContains(row.path, marker) || reText.includes(marker) || pdfHit
      families.push({
        app: row.app,
        opened: opened.readiness,
        contextOk: ctx.ok === true,
        editOk: toolOk(edited) || edited?.ok === true,
        saveOk: saved?.ok !== false,
        reopened: reopened.readiness,
        reContextOk: reCtx.ok === true,
        persisted,
        marker,
      })
      await worker.release(row.path, { force: true })
    }

    const convertDest = join(workDir, 'html-joint.docx')
    convert = await post(relay.base, '/api/html/docx/jobs', { html: readFileSync(html.path, 'utf8'), dest: convertDest })
    if (convert.ok === true && convert.jobId) {
      convert.wait = await post(relay.base, '/api/html/docx/jobs/wait', { id: convert.jobId })
    }
    convert.exists = existsSync(convertDest)
    convert.zip = convert.exists ? readFileSync(convertDest).subarray(0, 2).toString() === 'PK' : false

    const mdId = docIdFor(md.path)
    await worker.open(md.path)
    const ctxA = await post(relay.base, `/api/control/markdown/${mdId}/context`, {})
    const revA = ctxA.revision ?? ctxA.payload?.revision
    await post(relay.base, `/api/control/markdown/${mdId}/tool`, {
      call: { id: randomUUID(), name: 'insert_content', input: { afterIndex: -1, markdown: 'JOINT_B_INSERT' } },
    })
    const staleWrite = await post(relay.base, `/api/control/markdown/${mdId}/tool`, {
      call: {
        id: randomUUID(),
        name: 'replace_blocks',
        input: { startIndex: 0, endIndex: 0, markdown: '# STALE', expectedRevision: revA },
      },
    })
    try {
      await other.open(md.path)
      stale = { occupiedThrew: false }
    } catch (err) {
      stale = { occupiedThrew: true, code: err.code }
    }
    const mid = readFileSync(md.path, 'utf8')
    stale = {
      ...stale,
      revA,
      staleWrite,
      staleRejected: staleWrite.ok === false || staleWrite.error === 'conflict' || staleWrite.execution?.isError === true,
      unchanged: mid.includes('JOINT_B_INSERT') === false && mid.includes('STALE') === false,
    }
    await other.close({ force: true })
    await worker.release(md.path, { force: true })

    const dest = join(workDir, 'generate-missing.png')
    missingProvider = await post(relay.base, '/api/generate-image', { prompt: 'JointGenKeep', dest })
    missingProvider.destExists = existsSync(dest)
    missingProvider.health = await client.health()

    shot = await userPage.screenshot({ type: 'png' })
  } finally {
    await userPage.close().catch(() => {})
    await userBrowser.close().catch(() => {})
    await worker.close({ force: true })
    await other.close({ force: true })
    stopRelay(relay)
  }

  const needed = ['markdown', 'docs', 'sheets', 'slides', 'pdf', 'html']
  const successAssertions = [
    ...needed.map((app) => {
      const row = families.find((item) => item.app === app)
      return assert(`family-${app}`, Boolean(row) && row.opened === 'ready' && row.saveOk === true && row.reopened === 'ready' && row.persisted === true, 'ready+reopen', row)
    }),
    assert('html-export-docx', (convert?.wait?.ok === true && convert.zip === true) || convert?.ok === true && convert.zip === true, true, { ok: convert?.ok, zip: convert?.zip, wait: convert?.wait, error: convert?.error }),
    assert('user-page-open', network.length > 0, true, { count: network.length, sample: network.slice(0, 6) }),
  ]
  const ok = successAssertions.every((row) => row.status === 'passed')
  const success = {
    schema_version: 1,
    package: 'genoffice-web-roadmap',
    uf: 'UF-002',
    branch: 'success',
    status: ok ? 'passed' : 'failed',
    run_id: `joint-uf002-${new Date().toISOString()}`,
    source_revisions: { plugin: gitHead(PLUGIN), engine: gitHead(ENGINE) },
    cases: [{ id: 'five-family-html-open-save-reopen', status: ok ? 'passed' : 'failed', assertions: successAssertions }],
  }
  if (ok) {
    await archive(outDir, 'UF-002', 'success', success, {
      console: logs.join('\n') || `families=${JSON.stringify(families)}`,
      network: { events: network, count: network.length, families },
      screenshot: shot,
    })
  }

  const fail1Assertions = [
    assert('stale-revision-rejected', stale.staleRejected === true && stale.unchanged === true, 'conflict + no STALE', stale),
    assert('second-agent-occupied', stale.occupiedThrew === true && stale.code === 'occupied', 'occupied', stale),
  ]
  const fail1Ok = fail1Assertions.every((row) => row.status === 'passed')
  const fail1 = {
    schema_version: 1,
    package: 'genoffice-web-roadmap',
    uf: 'UF-002',
    branch: 'failure-1',
    status: fail1Ok ? 'passed' : 'failed',
    run_id: success.run_id,
    source_revisions: success.source_revisions,
    cases: [{ id: 'stale-owner-not-stolen', status: fail1Ok ? 'passed' : 'failed', assertions: fail1Assertions }],
  }
  if (fail1Ok) {
    await archive(outDir, 'UF-002', 'failure-1', fail1, {
      console: JSON.stringify(stale),
      network: { events: [stale.staleWrite], count: 1, occupied: { threw: stale.occupiedThrew, code: stale.code } },
      screenshot: shot,
    })
  }

  const fail2Assertions = [
    assert('generate-unconfigured-reported', missingProvider?.available === false || String(missingProvider?.error || '').includes('unconfigured') || missingProvider?.health?.providers?.generate?.available === false, true, missingProvider),
    assert('no-fake-generate-file', missingProvider?.destExists === false, false, missingProvider),
  ]
  const fail2Ok = fail2Assertions.every((row) => row.status === 'passed')
  const fail2 = {
    schema_version: 1,
    package: 'genoffice-web-roadmap',
    uf: 'UF-002',
    branch: 'failure-2',
    status: fail2Ok ? 'passed' : 'failed',
    run_id: success.run_id,
    source_revisions: success.source_revisions,
    cases: [{ id: 'missing-generate-provider', status: fail2Ok ? 'passed' : 'failed', assertions: fail2Assertions }],
  }
  if (fail2Ok) {
    await archive(outDir, 'UF-002', 'failure-2', fail2, {
      console: JSON.stringify(missingProvider),
      network: { events: [{ url: '/api/generate-image', body: missingProvider }], count: 1 },
      screenshot: shot,
    })
  }
  if (ok === false || fail1Ok === false || fail2Ok === false) throw new Error('joint uf-002 failed')
  return { success, fail1, fail2 }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.all === false && args.caseName == null) {
    console.error('usage: node e2e-genoffice-joint.mjs --all|--case scheduling|joint [--out DIR]')
    process.exit(2)
  }
  const outDir = args.outDir || DEFAULT_OUT
  if (args.all || args.caseName === 'joint') {
    await runJoint(outDir)
  }
  if (args.all || args.caseName === 'scheduling') {
    await runScheduling(outDir)
    await runSchedulingFailures(outDir)
  }
  const summary = {
    schema_version: 1,
    package: 'genoffice-web-roadmap',
    uf: 'joint',
    branch: 'all',
    status: 'passed',
    run_id: `joint-all-${new Date().toISOString()}`,
    source_revisions: { plugin: gitHead(PLUGIN), engine: gitHead(ENGINE) },
  }
  await mkdir(join(outDir, 'joint-run'), { recursive: true })
  await writeFile(join(outDir, 'joint-run/task-7.log'), `${JSON.stringify(summary, null, 2)}\n`)
  console.log(JSON.stringify(summary, null, 2))
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
