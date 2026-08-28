#!/usr/bin/env node
/**
 * dsh-community-standard v0.15 对齐检查器（自包含，零依赖）。
 *
 * 六个环节：
 *   1. Manifest 校验：packages/*\/dsh-plugin.json 按 spec/manifest.md 的 v0.15
 *      规则做静态校验（含 JSON Schema 表达不了的两条：contributes id 去重、
 *      entry 不得越出包根目录），并做跨包 contributes id 冲突检测。
 *   2. Facet 入口装载检查：entry 文件必须存在（缺失 = 未构建，fail closed）、
 *      源码不得 import 上游私有包（facet-model §2.2「只走前门」）、动态 import
 *      后默认导出必须是 defineFacet 品牌定义。装载只执行模块顶层（标准要求
 *      顶层无业务副作用），不调用 setup——与上游 conformance/fixtures/facet 同法。
 *   3. 协商：negotiate(manifest, descriptor, registrySnapshot) 纯函数，按
 *      spec/negotiation.md 产出 v0.15 报告（compatible / rejected /
 *      pending-authorization；facet apiVersion 检查；registry 敏感级别 →
 *      awaitingAuthorization）。快照来自 standards/registry/*.json。
 *   4. Manifest fixtures 自检：valid 全过，invalid 各自报出预期错误码。
 *   5. 协商 fixtures 自检：五种结局各一目录（manifest + descriptor + registry
 *      → expected-report 深比较），镜像上游 conformance/fixtures/negotiation。
 *   6. Adapter 审计：packages/*\/src 对上游包（@deepseek-ai/*、cordis、
 *      schemastery）的 import 比对基线，新增触点必须显式评审。
 *
 * 用法：node standards/validate.mjs [--update-baseline]
 * 退出码：0 = 全部通过；1 = 任一环节失败。
 * 注意：环节 2 依赖构建产物（先 npm run build -w @deepseek-ai/dsh-tab-genoffice）。
 *
 * 上游标准：https://github.com/oh-my-dsh/dsh-community-standard （Draft v0.15）
 * 本脚本是仓库本地纪律工具，不是标准的一致性认证。
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve, isAbsolute } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const STANDARDS_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(STANDARDS_DIR, '..')
const PACKAGES_DIR = join(REPO_ROOT, 'packages')
const DESCRIPTOR_PATH = join(STANDARDS_DIR, 'host-descriptor.json')
const BASELINE_PATH = join(STANDARDS_DIR, 'adapter-baseline.json')
const FIXTURES_DIR = join(STANDARDS_DIR, 'fixtures')
const REGISTRY_DIR = join(STANDARDS_DIR, 'registry')

const CANONICAL_SCHEMA_ID = 'https://dsh-std.example/schemas/dsh-plugin/v0.15.json'
const ID_RE = /^[a-z][a-z0-9]*(\.[a-z0-9][a-z0-9-]*)+$/
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/
const TOP_FIELDS = new Set(['$schema', 'id', 'name', 'version', 'manifestVersion', 'facets', 'requires', 'permissions', 'contributes', 'subscriptions'])
const UPSTREAM_RE = /^(@deepseek-ai\/|cordis$|schemastery$)/
const FACET_BRAND = Symbol.for('dsh-community-standard.facet-definition')

// ---------------------------------------------------------------- manifest 校验

/**
 * 按 v0.15 规则校验一份 manifest。
 * @param {unknown} m - 解析后的 JSON。
 * @returns {{code: string, msg: string}[]} 错误列表（空 = 合法）。
 */
function validateManifest(m) {
  const errors = []
  const err = (code, msg) => errors.push({ code, msg })
  if (typeof m !== 'object' || m === null || Array.isArray(m)) {
    err('not-object', 'manifest 必须是 JSON object')
    return errors
  }
  for (const k of Object.keys(m)) {
    if (k === 'provides') err('provides-rejected', 'provides 归 RFC 0003，v0.15 必须拒绝（fail closed，不静默忽略）')
    else if (!TOP_FIELDS.has(k)) err('unknown-field', `顶层未定义字段：${k}`)
  }
  if (typeof m.$schema !== 'string' || m.$schema !== CANONICAL_SCHEMA_ID) {
    err('missing-schema', `缺 $schema 或值不可识别（要求 ${CANONICAL_SCHEMA_ID}）`)
  }
  if (m.manifestVersion !== '0.15') err('wrong-manifest-version', `manifestVersion 必须为 "0.15"，实为 ${JSON.stringify(m.manifestVersion)}`)
  if (typeof m.id !== 'string' || !ID_RE.test(m.id)) err('bad-id', `id 必须是小写反向域名（至少两段），实为 ${JSON.stringify(m.id)}`)
  if (typeof m.name !== 'string' || m.name.length === 0) err('bad-name', 'name 必须是非空字符串')
  if (typeof m.version !== 'string' || !SEMVER_RE.test(m.version)) err('bad-version', `version 必须是 SemVer，实为 ${JSON.stringify(m.version)}`)

  if (typeof m.facets !== 'object' || m.facets === null || Array.isArray(m.facets) || !('host' in m.facets)) {
    err('missing-facets', '缺 facets 或缺 host facet')
  } else {
    for (const [facetName, facet] of Object.entries(m.facets)) {
      if (facetName === 'client' || facetName === 'worker') {
        err('reserved-facet', `facet 名 ${facetName} 为保留名（归 RFC 0002），v0.15 必须拒绝`)
        continue
      }
      if (typeof facet !== 'object' || facet === null || Array.isArray(facet)) {
        err('bad-facet', `facet ${facetName} 必须是 object`)
        continue
      }
      for (const k of Object.keys(facet)) {
        if (k !== 'entry' && k !== 'apiVersion') err('bad-facet', `facet ${facetName} 出现未定义字段 ${k}`)
      }
      if (typeof facet.entry !== 'string' || facet.entry.length === 0) {
        err('bad-facet', `facet ${facetName} 缺 entry`)
      } else if (isAbsolute(facet.entry) || facet.entry.split(/[\\/]/).includes('..')) {
        err('entry-outside-root', `facet ${facetName} 的 entry 越出包根目录：${facet.entry}`)
      }
      if (typeof facet.apiVersion !== 'string' || facet.apiVersion.length === 0) err('bad-facet', `facet ${facetName} 缺 apiVersion`)
    }
  }

  if ('requires' in m) {
    if (typeof m.requires !== 'object' || m.requires === null || Array.isArray(m.requires)) {
      err('bad-requires', 'requires 必须是 object')
    } else {
      for (const k of Object.keys(m.requires)) {
        if (k === 'services') err('requires-services-rejected', 'requires.services 归 RFC 0003，v0.15 必须拒绝')
        else if (k !== 'contracts') err('bad-requires', `requires 出现未定义键 ${k}`)
      }
      if ('contracts' in m.requires) {
        if (!Array.isArray(m.requires.contracts)) {
          err('bad-requires', 'requires.contracts 必须是数组')
        } else {
          for (const c of m.requires.contracts) {
            if (typeof c !== 'object' || c === null || Array.isArray(c)) { err('bad-contract', '契约条目必须是 object'); continue }
            for (const k of Object.keys(c)) {
              if (!['apiVersion', 'kind', 'optional'].includes(k)) err('bad-contract', `契约条目出现未定义字段 ${k}`)
            }
            if (typeof c.apiVersion !== 'string' || c.apiVersion.length === 0) err('bad-contract', '契约条目缺 apiVersion')
            if (typeof c.kind !== 'string' || c.kind.length === 0) err('bad-contract', '契约条目缺 kind')
            if ('optional' in c && typeof c.optional !== 'boolean') err('bad-contract', 'optional 必须是 boolean')
          }
        }
      }
    }
  }

  if ('permissions' in m && (!Array.isArray(m.permissions) || m.permissions.some((p) => typeof p !== 'string' || p.length === 0))) {
    err('bad-permissions', 'permissions 必须是非空字符串数组')
  }

  if ('contributes' in m) {
    const c = m.contributes
    if (typeof c !== 'object' || c === null || Array.isArray(c)) {
      err('bad-contributes', 'contributes 必须是 object')
    } else {
      for (const k of Object.keys(c)) {
        if (k !== 'commands') err('bad-contributes', `v0.15 只定义 contributes.commands，出现 ${k}`)
      }
      if ('commands' in c) {
        if (!Array.isArray(c.commands)) {
          err('bad-contributes', 'contributes.commands 必须是数组')
        } else {
          const seen = new Set()
          for (const cmd of c.commands) {
            if (typeof cmd !== 'object' || cmd === null || Array.isArray(cmd)) { err('bad-contributes', 'command 条目必须是 object'); continue }
            for (const k of Object.keys(cmd)) {
              if (k !== 'id' && k !== 'title') err('bad-contributes', `command 条目出现未定义字段 ${k}`)
            }
            if (typeof cmd.id !== 'string' || cmd.id.length === 0) {
              err('bad-contributes', 'command 条目缺 id')
            } else {
              if (seen.has(cmd.id)) err('duplicate-contributes-id', `contributes.commands id 重复：${cmd.id}`)
              seen.add(cmd.id)
            }
            if (typeof cmd.title !== 'string' || cmd.title.length === 0) err('bad-contributes', 'command 条目缺 title')
          }
        }
      }
    }
  }

  if ('subscriptions' in m && (!Array.isArray(m.subscriptions) || m.subscriptions.some((s) => typeof s !== 'string' || s.length === 0))) {
    err('bad-subscriptions', 'subscriptions 必须是非空字符串数组')
  }
  return errors
}

// ---------------------------------------------------------------- facet 入口装载检查

/**
 * 提取一份源码的 import/require 说明符。
 * @param {string} source - 源码文本。
 * @returns {string[]} 说明符列表。
 */
function importSpecifiersOf(source) {
  const specs = []
  const patterns = [
    /(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const re of patterns) {
    for (const match of source.matchAll(re)) specs.push(match[1])
  }
  return specs
}

/**
 * 装载检查一个 facet entry 文件。
 * @param {string} entryPath - entry 的绝对路径。
 * @returns {Promise<{code: string, msg: string} | undefined>} 失败项或通过。
 */
async function checkFacetEntry(entryPath) {
  if (!existsSync(entryPath)) {
    return { code: 'entry-missing', msg: `entry 不存在：${entryPath}（先构建：npm run build -w @deepseek-ai/dsh-tab-genoffice）` }
  }
  const source = readFileSync(entryPath, 'utf8')
  const privateImports = importSpecifiersOf(source).filter((s) => UPSTREAM_RE.test(s))
  if (privateImports.length > 0) {
    return { code: 'private-import', msg: `facet entry 引用上游私有包（只走前门，facet-model §2.2）：${privateImports.join('、')}` }
  }
  let mod
  try {
    mod = await import(pathToFileURL(entryPath).href)
  } catch (e) {
    return { code: 'entry-load-failed', msg: `entry 无法装载：${e instanceof Error ? e.message : String(e)}` }
  }
  const def = mod.default
  const branded = typeof def === 'object' && def !== null && def[FACET_BRAND] === true && typeof def.setup === 'function'
  if (!branded) {
    return { code: 'not-a-facet', msg: '默认导出不是 defineFacet 创建的 facet 定义' }
  }
  return undefined
}

// ---------------------------------------------------------------- 协商（纯函数）

/** @returns {object[]} standards/registry/*.json 的条目快照（无目录时为空）。 */
function loadRegistrySnapshot() {
  if (!existsSync(REGISTRY_DIR)) return []
  return readdirSync(REGISTRY_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(REGISTRY_DIR, f), 'utf8')))
}

/**
 * manifest × descriptor × registrySnapshot → v0.15 协商报告
 * （spec/negotiation.md §2.3–2.5 的实现；纯函数，无 I/O）。
 * @param {object} manifest - 合法 manifest。
 * @param {object} descriptor - 合法 host descriptor。
 * @param {object[]} registrySnapshot - registry 条目冻结快照。
 * @returns {object} 协商报告（compatible / rejected / pending-authorization）。
 */
function negotiate(manifest, descriptor, registrySnapshot) {
  const caps = new Set((descriptor.capabilities ?? []).map((c) => `${c.apiVersion} # ${c.kind}`))
  const sensitivity = new Map(registrySnapshot.map((e) => [`${e.apiVersion} # ${e.kind}`, e.sensitivity]))

  const unsupportedFacets = []
  for (const [facet, decl] of Object.entries(manifest.facets ?? {})) {
    const supported = descriptor.apiVersions?.[facet] ?? []
    if (!supported.includes(decl.apiVersion)) {
      unsupportedFacets.push({ facet, requiredApiVersion: decl.apiVersion, supportedApiVersions: supported })
    }
  }

  const missingRequired = []
  const degradedOptional = []
  const awaitingAuthorization = []
  for (const c of manifest.requires?.contracts ?? []) {
    const key = `${c.apiVersion} # ${c.kind}`
    const coordinate = { apiVersion: c.apiVersion, kind: c.kind }
    if (!caps.has(key)) {
      ;(c.optional === true ? degradedOptional : missingRequired).push(coordinate)
      continue
    }
    // 敏感检查只针对匹配成功的声明——缺席即降级，人都不在，不需要授权。
    if (sensitivity.get(key) === 'high') awaitingAuthorization.push(coordinate)
  }

  const verdict = missingRequired.length > 0 || unsupportedFacets.length > 0
    ? 'rejected'
    : awaitingAuthorization.length > 0
      ? 'pending-authorization'
      : 'compatible'

  const message = verdict === 'rejected'
    ? `拒载：该插件需要 ${[
      ...missingRequired.map((c) => `${c.apiVersion}（${c.kind}）`),
      ...unsupportedFacets.map((f) => `facet ${f.facet} 的 API ${f.requiredApiVersion}`),
    ].join('、')}，当前宿主不提供。`
    : verdict === 'pending-authorization'
      ? `宿主支持该插件，但 ${awaitingAuthorization.map((c) => c.kind).join('、')} 为敏感能力，等待用户或策略授权后才能激活。`
      : degradedOptional.length > 0
        ? `静态协商通过；可选能力 ${degradedOptional.map((c) => c.kind).join('、')} 不可用，插件将按声明的降级路径运行。`
        : '静态协商通过。'

  const report = { reportVersion: '0.15', verdict, message }
  if (missingRequired.length > 0) report.missingRequired = missingRequired
  if (degradedOptional.length > 0) report.degradedOptional = degradedOptional
  if (awaitingAuthorization.length > 0) report.awaitingAuthorization = awaitingAuthorization
  if (unsupportedFacets.length > 0) report.unsupportedFacets = unsupportedFacets
  return report
}

/**
 * 最小 descriptor 校验（结构齐全即可，语义以 spec/host-descriptor.md 为准）。
 * @param {unknown} d - 解析后的 JSON。
 * @returns {string[]} 错误消息列表。
 */
function validateDescriptor(d) {
  const errors = []
  if (typeof d !== 'object' || d === null) return ['descriptor 必须是 JSON object']
  if (d.descriptorVersion !== '0.15') errors.push('descriptorVersion 必须为 "0.15"')
  if (typeof d.id !== 'string' || !ID_RE.test(d.id)) errors.push('id 必须是反向域名语法')
  if (typeof d.apiVersions !== 'object' || d.apiVersions === null || Object.values(d.apiVersions).some((v) => !Array.isArray(v) || v.some((x) => typeof x !== 'string'))) {
    errors.push('apiVersions 必须是 facet → string[] 的映射')
  }
  if (typeof d.execution !== 'object' || d.execution === null || d.execution.environment !== 'node' || d.execution.trustMode !== 'trusted-in-process') {
    errors.push('execution 必须为 { environment: "node", trustMode: "trusted-in-process" }（v0.15 唯一档位）')
  }
  if (!Array.isArray(d.capabilities)) {
    errors.push('capabilities 必须是数组')
  } else {
    for (const c of d.capabilities) {
      if (typeof c !== 'object' || c === null || typeof c.apiVersion !== 'string' || typeof c.kind !== 'string' || Object.keys(c).length !== 2) {
        errors.push(`capability 条目必须恰好含 apiVersion + kind：${JSON.stringify(c)}`)
      }
    }
  }
  return errors
}

// ---------------------------------------------------------------- adapter 审计

/**
 * 递归收集目录下的源码文件。
 * @param {string} dir - 目录绝对路径。
 * @returns {string[]} 文件绝对路径列表。
 */
function sourceFilesOf(dir) {
  const out = []
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...sourceFilesOf(p))
    else if (/\.(ts|tsx|mts|cts|js|mjs|jsx)$/.test(entry)) out.push(p)
  }
  return out
}

/**
 * 扫描 packages/*\/src 的上游触点。
 * @returns {Record<string, string[]>} 包名 → 排序去重后的上游说明符。
 */
function scanUpstreamTouches() {
  const result = {}
  for (const pkg of readdirSync(PACKAGES_DIR)) {
    const srcDir = join(PACKAGES_DIR, pkg, 'src')
    const specs = new Set()
    for (const file of sourceFilesOf(srcDir)) {
      for (const spec of importSpecifiersOf(readFileSync(file, 'utf8'))) {
        if (UPSTREAM_RE.test(spec)) specs.add(spec)
      }
    }
    if (specs.size > 0) result[pkg] = [...specs].sort()
  }
  return result
}

// ---------------------------------------------------------------- 主流程

/** @type {Record<string, string>} manifest invalid fixture 文件名 → 必须报出的错误码。 */
const INVALID_FIXTURE_EXPECT = {
  'missing-schema.json': 'missing-schema',
  'wrong-manifest-version.json': 'wrong-manifest-version',
  'missing-facets.json': 'missing-facets',
  'bad-id.json': 'bad-id',
  'unknown-field.json': 'unknown-field',
  'provides-rejected.json': 'provides-rejected',
  'requires-services-rejected.json': 'requires-services-rejected',
  'reserved-facet-client.json': 'reserved-facet',
  'duplicate-contributes-id.json': 'duplicate-contributes-id',
  'entry-outside-root.json': 'entry-outside-root',
}

/** @type {Record<string, string>} facet invalid fixture 目录名 → 必须报出的错误码。 */
const FACET_FIXTURE_EXPECT = {
  'not-a-facet': 'not-a-facet',
  'private-import': 'private-import',
}

/** 五种协商结局的 fixture 目录名（各含 manifest / host-descriptor / registry / expected-report）。 */
const NEGOTIATION_FIXTURES = [
  'compatible',
  'degraded-optional',
  'rejected-missing-required',
  'rejected-unsupported-facet',
  'pending-authorization',
]

async function main() {
  const updateBaseline = process.argv.includes('--update-baseline')
  let failed = false
  const section = (title) => console.log(`\n== ${title} ==`)

  // 1. manifest 校验 + 跨包 contributes 冲突
  section('manifest 校验（packages/*/dsh-plugin.json）')
  const manifests = []
  for (const pkg of readdirSync(PACKAGES_DIR).sort()) {
    const manifestPath = join(PACKAGES_DIR, pkg, 'dsh-plugin.json')
    if (!existsSync(manifestPath)) continue
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const errors = validateManifest(manifest)
    if (errors.length > 0) {
      failed = true
      console.log(`✗ ${pkg}`)
      for (const e of errors) console.log(`    [${e.code}] ${e.msg}`)
    } else {
      console.log(`✓ ${pkg} (${manifest.id})`)
      manifests.push({ pkg, manifest })
    }
  }
  if (manifests.length === 0) {
    console.log('✗ 未发现任何 dsh-plugin.json')
    failed = true
  }
  const commandOwners = new Map()
  for (const { pkg, manifest } of manifests) {
    for (const cmd of manifest.contributes?.commands ?? []) {
      const prior = commandOwners.get(cmd.id)
      if (prior !== undefined && prior !== pkg) {
        failed = true
        console.log(`✗ 跨包 contributes.commands id 冲突：${cmd.id}（${prior} 与 ${pkg} 不能共存）`)
      }
      commandOwners.set(cmd.id, pkg)
    }
  }

  // 2. facet 入口装载检查
  section('facet 入口装载检查（entry 存在 / 无私有 import / 品牌默认导出）')
  for (const { pkg, manifest } of manifests) {
    for (const [facetName, facet] of Object.entries(manifest.facets ?? {})) {
      const entryPath = join(PACKAGES_DIR, pkg, facet.entry)
      const failure = await checkFacetEntry(entryPath)
      if (failure !== undefined) {
        failed = true
        console.log(`✗ ${pkg} facets.${facetName}: [${failure.code}] ${failure.msg}`)
      } else {
        console.log(`✓ ${pkg} facets.${facetName} → ${facet.entry}`)
      }
    }
  }

  // 3. 协商
  section('协商（manifest × host-descriptor × registry 快照）')
  const descriptor = JSON.parse(readFileSync(DESCRIPTOR_PATH, 'utf8'))
  const descriptorErrors = validateDescriptor(descriptor)
  const registrySnapshot = loadRegistrySnapshot()
  if (descriptorErrors.length > 0) {
    failed = true
    for (const e of descriptorErrors) console.log(`✗ descriptor: ${e}`)
  } else {
    for (const { pkg, manifest } of manifests) {
      const report = negotiate(manifest, descriptor, registrySnapshot)
      if (report.verdict === 'rejected') {
        failed = true
        console.log(`✗ ${pkg}: ${report.message}`)
      } else if (report.verdict === 'pending-authorization') {
        console.log(`△ ${pkg}: pending-authorization —— ${report.message}`)
      } else {
        console.log(`✓ ${pkg}: compatible${report.degradedOptional !== undefined ? `（降级：${report.degradedOptional.map((c) => c.kind).join('、')}）` : ''}`)
      }
      if (Array.isArray(manifest.permissions) && manifest.permissions.length > 0) {
        console.log(`  permissions（契约之外的敏感 scope，授权归 authorize 阶段）：${manifest.permissions.join('、')}`)
      }
    }
  }

  // 4. manifest fixtures 自检
  section('manifest fixtures 自检')
  const validDir = join(FIXTURES_DIR, 'valid')
  const invalidDir = join(FIXTURES_DIR, 'invalid')
  for (const f of readdirSync(validDir).sort()) {
    const errors = validateManifest(JSON.parse(readFileSync(join(validDir, f), 'utf8')))
    if (errors.length > 0) {
      failed = true
      console.log(`✗ valid/${f} 应通过却报错：${errors.map((e) => e.code).join('、')}`)
    } else {
      console.log(`✓ valid/${f}`)
    }
  }
  for (const [f, expectedCode] of Object.entries(INVALID_FIXTURE_EXPECT)) {
    const path = join(invalidDir, f)
    if (!existsSync(path)) {
      failed = true
      console.log(`✗ invalid/${f} 缺失`)
      continue
    }
    const errors = validateManifest(JSON.parse(readFileSync(path, 'utf8')))
    if (errors.some((e) => e.code === expectedCode)) {
      console.log(`✓ invalid/${f} → [${expectedCode}]`)
    } else {
      failed = true
      console.log(`✗ invalid/${f} 未报出预期错误码 ${expectedCode}（实报：${errors.map((e) => e.code).join('、') || '无'}）`)
    }
  }

  // 4b. facet fixtures 自检
  const facetValid = join(FIXTURES_DIR, 'facet', 'valid', 'entry.js')
  const validFailure = await checkFacetEntry(facetValid)
  if (validFailure !== undefined) {
    failed = true
    console.log(`✗ facet/valid/entry.js 应通过却报错：[${validFailure.code}]`)
  } else {
    console.log('✓ facet/valid/entry.js')
  }
  for (const [dir, expectedCode] of Object.entries(FACET_FIXTURE_EXPECT)) {
    const failure = await checkFacetEntry(join(FIXTURES_DIR, 'facet', 'invalid', dir, 'entry.js'))
    if (failure !== undefined && failure.code === expectedCode) {
      console.log(`✓ facet/invalid/${dir} → [${expectedCode}]`)
    } else {
      failed = true
      console.log(`✗ facet/invalid/${dir} 未报出预期错误码 ${expectedCode}（实报：${failure?.code ?? '无'}）`)
    }
  }

  // 5. 协商 fixtures 自检
  section('协商 fixtures 自检（五种结局）')
  for (const name of NEGOTIATION_FIXTURES) {
    const dir = join(FIXTURES_DIR, 'negotiation', name)
    if (!existsSync(dir)) {
      failed = true
      console.log(`✗ negotiation/${name} 缺失`)
      continue
    }
    const load = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))
    const registry = existsSync(join(dir, 'registry.json')) ? load('registry.json') : []
    const report = negotiate(load('manifest.json'), load('host-descriptor.json'), registry)
    const expected = load('expected-report.json')
    if (JSON.stringify(report) === JSON.stringify(expected)) {
      console.log(`✓ negotiation/${name} → ${report.verdict}`)
    } else {
      failed = true
      console.log(`✗ negotiation/${name} 报告不符`)
      console.log(`    期望：${JSON.stringify(expected)}`)
      console.log(`    实得：${JSON.stringify(report)}`)
    }
  }

  // 6. adapter 审计
  section('adapter 审计（上游触点基线）')
  const current = scanUpstreamTouches()
  if (updateBaseline || !existsSync(BASELINE_PATH)) {
    writeFileSync(BASELINE_PATH, JSON.stringify({
      $comment: '上游触点基线：packages/*/src 中 import 的上游说明符（@deepseek-ai/*、cordis、schemastery）。新增触点属于耦合面扩张，须评审后用 --update-baseline 更新；目标是把触点收敛进 src/standard/cordis-*.ts 适配层（对齐 dsh-community-standard 原则⑤）。',
      packages: current,
    }, null, 2) + '\n')
    console.log(`✓ 基线已写入 ${BASELINE_PATH}`)
  } else {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).packages
    for (const [pkg, specs] of Object.entries(current)) {
      const known = new Set(baseline[pkg] ?? [])
      const added = specs.filter((s) => !known.has(s))
      if (added.length > 0) {
        failed = true
        console.log(`✗ ${pkg}: 新增上游触点未过评审：${added.join('、')}（评审后 --update-baseline）`)
      }
    }
    for (const [pkg, specs] of Object.entries(baseline)) {
      const now = new Set(current[pkg] ?? [])
      const removed = specs.filter((s) => !now.has(s))
      if (removed.length > 0) {
        console.log(`△ ${pkg}: 基线中的触点已消失（收敛，建议 --update-baseline 固化）：${removed.join('、')}`)
      }
    }
    if (!failed) console.log('✓ 无未评审的新增上游触点')
  }

  console.log(failed ? '\n结论：存在未通过项' : '\n结论：全部通过')
  process.exit(failed ? 1 : 0)
}

await main()
