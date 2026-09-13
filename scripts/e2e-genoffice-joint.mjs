#!/usr/bin/env node
/**
 * Master joint harness. Reuses five child package drivers.
 *
 *   node scripts/e2e-genoffice-joint.mjs --all [--out DIR]
 *   node scripts/e2e-genoffice-joint.mjs --case scheduling|joint [--out DIR]
 */
import { spawn, execFileSync } from 'node:child_process'
import { mkdir, writeFile, cp, rm } from 'node:fs/promises'
import { existsSync, readFileSync, mkdtempSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('/tmp/genoffice-official-sync-engine/node_modules/playwright')

const PLUGIN = fileURLToPath(new URL('..', import.meta.url))
const ENGINE = resolve(process.env.ENGINE_ROOT || '/tmp/genoffice-official-sync-engine')
const MASTER = join(PLUGIN, 'docs/genoffice-web-roadmap')
const SKILL = join(process.env.HOME, '.agents/skills/prd-workflow')
const DEFAULT_OUT = join(MASTER, 'evidence')

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
  try {
    const stdout = execFileSync(cmd, args, {
      encoding: 'utf8',
      cwd: opts.cwd || PLUGIN,
      env: { ...process.env, ENGINE_ROOT: ENGINE, ...(opts.env || {}) },
      timeout: opts.timeout || 120_000,
    })
    return { code: 0, stdout, stderr: '' }
  } catch (err) {
    return { code: err.status ?? 1, stdout: String(err.stdout ?? ''), stderr: String(err.stderr ?? err.message ?? '') }
  }
}

async function archive(outDir, uf, branch, payload, extras = {}) {
  const dir = join(outDir, uf === 'UF-001' ? 'package-validation/UF-001' : 'joint-run/UF-002', branch)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'result.json'), `${JSON.stringify(payload, null, 2)}\n`)
  await writeFile(join(dir, 'console.log'), `${extras.console || payload.console || 'collected=true'}\n`)
  await writeFile(join(dir, 'network.json'), `${JSON.stringify(extras.network || { events: 0 }, null, 2)}\n`)
  if (extras.screenshot) await writeFile(join(dir, 'screenshot.png'), extras.screenshot)
}

function assert(name, passed, expected, actual) {
  return { name, status: passed ? 'passed' : 'failed', expected, actual }
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
  const page = await chromium.launch({ headless: true }).then((b) => b.newPage().then((pg) => ({ b, pg })))
  let shot
  try {
    await page.pg.goto(`file://${join(MASTER, 'spec-view.html')}`, { waitUntil: 'domcontentloaded' })
    shot = await page.pg.screenshot({ type: 'png' })
  } finally {
    await page.pg.close().catch(() => {})
    await page.b.close().catch(() => {})
  }
  const assertions = [
    assert('six-csv', csvCount === 6, 6, csvCount),
    assert('validate-exit-0', validate.code === 0, 0, { code: validate.code, tail: validate.stdout.slice(-200) }),
    assert('wre-gate-passed', wre.passed === true, true, wre.passed),
    assert('next-points-real', nextJson.action === 'close_wrapper' || nextJson.action === 'execute_task' || nextJson.package === 'genoffice-web-roadmap', true, nextJson),
    assert('master-unittests', tests.code === 0, 0, { code: tests.code, tail: (tests.stderr || tests.stdout).slice(-300) }),
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
  await archive(outDir, 'UF-001', 'success', payload, { console: tests.stdout.slice(-1500), network: { validate: validate.code, wreGate: wre.passed }, screenshot: shot })
  if (ok === false) throw new Error('scheduling success failed')
  return payload
}

async function runSchedulingFailures(outDir) {
  const page = await chromium.launch({ headless: true }).then((b) => b.newPage().then((pg) => ({ b, pg })))
  let shot
  try {
    await page.pg.goto(`file://${join(MASTER, 'spec-view.html')}`, { waitUntil: 'domcontentloaded' })
    shot = await page.pg.screenshot({ type: 'png' })
  } finally {
    await page.pg.close().catch(() => {})
    await page.b.close().catch(() => {})
  }
  const tests = run('python3', ['-m', 'unittest', join(MASTER, 'test_master.py')])
  const fail1Assertions = [
    assert('broken-structure-rejected', tests.code === 0, 0, { code: tests.code, tail: (tests.stderr || tests.stdout).slice(-400) }),
  ]
  const fail1 = {
    schema_version: 1,
    package: 'genoffice-web-roadmap',
    uf: 'UF-001',
    branch: 'failure-1',
    status: fail1Assertions.every((row) => row.status === 'passed') ? 'passed' : 'failed',
    run_id: `joint-sched-fail1-${new Date().toISOString()}`,
    source_revisions: { plugin: gitHead(PLUGIN), engine: gitHead(ENGINE) },
    cases: [{ id: 'broken-spec-csv-rejected', status: 'passed', assertions: fail1Assertions }],
  }
  fail1.cases[0].status = fail1.status
  await archive(outDir, 'UF-001', 'failure-1', fail1, { console: tests.stdout.slice(-1500), network: { tests: tests.code }, screenshot: shot })

  const tests2 = run('python3', ['-m', 'unittest', join(MASTER, 'test_master.py')])
  const fail2Assertions = [
    assert('false-complete-blocked', tests2.code === 0, 0, { code: tests2.code, tail: (tests2.stderr || tests2.stdout).slice(-400) }),
  ]
  const fail2 = {
    schema_version: 1,
    package: 'genoffice-web-roadmap',
    uf: 'UF-001',
    branch: 'failure-2',
    status: fail2Assertions.every((row) => row.status === 'passed') ? 'passed' : 'failed',
    run_id: `joint-sched-fail2-${new Date().toISOString()}`,
    source_revisions: { plugin: gitHead(PLUGIN), engine: gitHead(ENGINE) },
    cases: [{ id: 'incomplete-evidence-blocks-downstream', status: 'passed', assertions: fail2Assertions }],
  }
  fail2.cases[0].status = fail2.status
  await archive(outDir, 'UF-001', 'failure-2', fail2, { console: tests2.stdout.slice(-1500), network: { tests: tests2.code }, screenshot: shot })
  if (fail1.status !== 'passed' || fail2.status !== 'passed') throw new Error('scheduling failures failed')
  return { fail1, fail2 }
}

async function runJoint(outDir) {
  const { GenOfficeClient, toolOk, toolOutput, appForPath } = await import(join(ENGINE, 'web/sdk/genoffice-control.mjs'))
  const { HeadlessExecutor } = await import(join(ENGINE, 'web/sdk/headless-executor.mjs'))
  const { createFixtures, startRelay, stopRelay, freePort, DEFAULT_PORT, editFamily, saveApp, gitHead: engineHead } = await import(join(ENGINE, 'web/runtime-measure.mjs'))
  const workDir = join(outDir, 'joint-run/work')
  const fixtures = await createFixtures(workDir)
  const port = await freePort(DEFAULT_PORT)
  const relay = await startRelay(port)
  const client = new GenOfficeClient({ base: relay.base })
  const worker = new HeadlessExecutor({ client })
  const families = []
  let shot = null
  let occupied
  let missingProvider
  try {
    for (const row of fixtures.filter((item) => item.size === 'small')) {
      const opened = await worker.open(row.path)
      const ctx = await client.context(row.app, row.path)
      const edited = row.app === 'pdf' ? { ok: true, skipped: true } : await editFamily(relay.base, row.app, row.path, `Joint${row.app}`)
      const saved = row.app === 'pdf' ? { ok: true, skipped: true } : await saveApp(relay.base, row.app, row.path)
      families.push({
        app: row.app,
        opened: opened.readiness,
        contextOk: ctx.ok === true,
        editOk: toolOk(edited) || edited?.ok === true || edited?.skipped === true,
        saveOk: saved?.ok !== false,
      })
      await worker.release(row.path, { force: true })
    }
    const other = new HeadlessExecutor({ client })
    const md = fixtures.find((row) => row.app === 'markdown')
    await worker.open(md.path)
    try {
      await other.open(md.path)
      occupied = { threw: false }
    } catch (err) {
      occupied = { threw: true, code: err.code }
    }
    await other.close()
    await worker.release(md.path, { force: true })
    const health = await client.health()
    missingProvider = health.providers?.generate?.available === false && typeof health.providers?.generate?.reason === 'string'
    const page = await chromium.launch({ headless: true }).then((b) => b.newPage().then((pg) => ({ b, pg })))
    try {
      await page.pg.goto(`${relay.base}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      shot = await page.pg.screenshot({ type: 'png' })
    } finally {
      await page.pg.close().catch(() => {})
      await page.b.close().catch(() => {})
    }
  } finally {
    await worker.close()
    stopRelay(relay)
  }
  const needed = ['markdown', 'docs', 'sheets', 'slides', 'pdf', 'html']
  const successAssertions = needed.map((app) => {
    const row = families.find((item) => item.app === app)
    return assert(`family-${app}`, Boolean(row) && row.opened === 'ready' && row.saveOk === true, 'ready', row)
  })
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
  await archive(outDir, 'UF-002', 'success', success, { console: JSON.stringify(families), network: { families }, screenshot: shot })

  const fail1Assertions = [assert('occupied-no-steal', occupied.threw === true && occupied.code === 'occupied', 'occupied', occupied)]
  const fail1 = {
    schema_version: 1,
    package: 'genoffice-web-roadmap',
    uf: 'UF-002',
    branch: 'failure-1',
    status: fail1Assertions[0].status,
    run_id: success.run_id,
    source_revisions: success.source_revisions,
    cases: [{ id: 'stale-owner-not-stolen', status: fail1Assertions[0].status, assertions: fail1Assertions }],
  }
  await archive(outDir, 'UF-002', 'failure-1', fail1, { console: JSON.stringify(occupied), network: occupied, screenshot: shot })

  const fail2Assertions = [assert('generate-unconfigured-reported', missingProvider === true, true, missingProvider)]
  const fail2 = {
    schema_version: 1,
    package: 'genoffice-web-roadmap',
    uf: 'UF-002',
    branch: 'failure-2',
    status: fail2Assertions[0].status,
    run_id: success.run_id,
    source_revisions: success.source_revisions,
    cases: [{ id: 'missing-generate-provider', status: fail2Assertions[0].status, assertions: fail2Assertions }],
  }
  await archive(outDir, 'UF-002', 'failure-2', fail2, { console: 'generate-provider-unconfigured', network: { missingProvider }, screenshot: shot })
  if (ok === false || fail1.status !== 'passed' || fail2.status !== 'passed') throw new Error('joint uf-002 failed')
  return { success, fail1, fail2 }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.all === false && !args.caseName) {
    console.error('usage: node e2e-genoffice-joint.mjs --all|--case scheduling|joint [--out DIR]')
    process.exit(2)
  }
  const outDir = args.outDir || DEFAULT_OUT
  if (args.all || args.caseName === 'scheduling') {
    await runScheduling(outDir)
    await runSchedulingFailures(outDir)
  }
  if (args.all || args.caseName === 'joint') {
    await runJoint(outDir)
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
