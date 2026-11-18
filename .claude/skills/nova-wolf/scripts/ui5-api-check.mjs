#!/usr/bin/env node
/**
 * Clean Core A of the UI: every SAPUI5 API an app uses is public in the release it runs on and in the next one.
 *
 * ATC checks only ABAP, and the UI5 linter reports what is deprecated, not an API that is restricted or private
 * without being deprecated (sap.ushell.services.Extension.Item#getControl is restricted in 1.120). The SAPUI5 SDK
 * publishes, for every library and release, its api.json (test-resources/<library>/designtime/api.json): every
 * documented symbol with its visibility, and the visibility of each method. A module that is not there is not
 * documented, so not public.
 *
 *   node ui5-api-check.mjs --versions <target>,<next> [--project <dir>] [--json] [--output <file>]
 *
 * It reads the JavaScript, TypeScript and XML of the app (webapp/, or the project without node_modules and dist):
 * - the modules it requires (sap.ui.define, sap.ui.require, import): the class or namespace must be public;
 * - the controls of the XML views and fragments: the same;
 * - the services of the shell it asks for (getServiceAsync("X"), getService("X")): sap.ushell.services.X public;
 * - the methods it calls (.name(...)): a name that the libraries in use have only as restricted, private or
 *   protected is a finding; a name that one of the imported classes has restricted, and another class public, is to
 *   check by hand (the script does not know the type of the object).
 * Exit 1 when there is a finding in one of the releases; the libraries it could not read are said, not passed.
 *
 * The api.json files come from https://ui5.sap.com/<version>/ (NOVA_UI5_CDN for another host) and stay in
 * ~/.nova/ui5-api/<version>/ (NOVA_UI5_API_CACHE).
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const SKIP = new Set(['node_modules', 'dist', '.git', '.claude', 'coverage', 'gen', 'target', 'graphify-out'])
// libraries under sap/ui/ that are not sap.ui.core
const UI_LIBRARIES = new Set(['codeeditor', 'comp', 'commons', 'dt', 'export', 'fl', 'generic', 'integration', 'layout', 'mdc',
  'richtexteditor', 'rta', 'suite', 'support', 'table', 'unified', 'ux3', 'vbm', 'vk', 'webc'])
// a method name that is everywhere (Object, Promise, arrays, the base classes) says nothing about a type
const COMMON = new Set(['then', 'catch', 'finally', 'push', 'map', 'filter', 'forEach', 'find', 'some', 'every', 'reduce', 'join',
  'split', 'slice', 'splice', 'indexOf', 'includes', 'call', 'apply', 'bind', 'toString', 'valueOf', 'extend', 'getMetadata',
  'define', 'require', 'resolve', 'reject', 'keys', 'values', 'entries', 'assign', 'stringify', 'parse', 'test', 'replace'])
const NOT_PUBLIC = new Set(['restricted', 'private', 'protected', 'hidden'])

/** The library of a module: sap/ushell/services/Extension → sap.ushell; sap/ui/model/json/JSONModel → sap.ui.core. */
export function libraryOf(module) {
  const parts = module.split('/')
  if (parts[0] !== 'sap' || parts.length < 2) return null
  if (parts[1] === 'ui') return parts[2] && UI_LIBRARIES.has(parts[2]) ? `sap.ui.${parts[2]}` : 'sap.ui.core'
  // sap/base has no api.json of its own: its modules are documented in sap.ui.core
  if (parts[1] === 'base') return 'sap.ui.core'
  if (parts[1] === 'fe' || parts[1] === 'suite' && parts[2] === 'ui') return parts.slice(0, parts[1] === 'fe' ? 3 : 4).join('.')
  return `sap.${parts[1]}`
}

/**
 * What an app uses, file by file: the modules it requires and the controls of its views, the globals (sap.ushell.Container),
 * the services of the shell it asks for, and the methods it calls, each with its lines.
 */
export function usages(files) {
  const modules = new Map(), services = new Map(), fallbacks = new Map(), perFile = []
  const at = (map, key, where) => map.has(key) ? map.get(key).add(where) : map.set(key, new Set([where]))
  for (const { path, text } of files) {
    const lineOf = index => text.slice(0, index).split('\n').length
    const file = { path, modules: new Set(), services: new Set(), calls: new Map() }
    perFile.push(file)
    if (path.endsWith('.xml')) {
      const namespaces = new Map()
      for (const m of text.matchAll(/xmlns(?::([\w.-]+))?\s*=\s*"([\w.]+)"/g)) namespaces.set(m[1] ?? '', m[2])
      for (const m of text.matchAll(/<(?:([\w.-]+):)?([A-Z]\w*)[\s/>]/g)) {
        const ns = namespaces.get(m[1] ?? '')
        if (!ns?.startsWith('sap.')) continue
        const module = `${ns}.${m[2]}`.replaceAll('.', '/')
        at(modules, module, `${path}:${lineOf(m.index)}`)
        file.modules.add(module)
      }
      continue
    }
    // comments out, lines kept
    const code = text.replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:])\/\/.*$/gm, (c, p) => p + ' '.repeat(c.length - p.length))
    const add = (module, index) => { at(modules, module, `${path}:${lineOf(index)}`); file.modules.add(module) }
    for (const m of code.matchAll(/["'`](sap\/[\w/.-]+)["'`]/g)) add(m[1].replace(/\.js$/, ''), m.index)
    // globals: sap.ushell.Container.getServiceAsync(...), sap.m.MessageToast.show(...)
    for (const m of code.matchAll(/\bsap\.((?:[a-z]\w*\.)+[A-Z]\w*)/g)) add(`sap/${m[1].replaceAll('.', '/')}`, m.index)
    for (const m of code.matchAll(/\bgetService(?:Async)?\(\s*["'`](\w+)["'`]/g)) {
      at(services, m[1], `${path}:${lineOf(m.index)}`)
      file.services.add(m[1])
      // feature detection: getServiceAsync("X").catch(() => getServiceAsync("Y")), X optional with Y in its place
      const after = code.slice(m.index + m[0].length, m.index + m[0].length + 240)
      const fallback = /^\s*\)\s*\.catch\(\s*(?:async\s+)?(?:function\s*\([^)]*\)|\([^)]*\)\s*=>|\w+\s*=>)[\s\S]{0,160}?\bgetService(?:Async)?\(\s*["'`](\w+)["'`]/.exec(after)
      if (fallback) at(fallbacks, m[1], fallback[1])
    }
    for (const m of code.matchAll(/\.\s*([a-zA-Z_$][\w$]*)\s*\(/g))
      if (!COMMON.has(m[1])) at(file.calls, m[1], `${path}:${lineOf(m.index)}`)
  }
  return { modules, services, fallbacks, files: perFile }
}

async function sourceFiles(root) {
  const base = await readdir(join(root, 'webapp')).then(() => join(root, 'webapp'), () => root)
  const files = []
  const walk = async dir => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue
      const path = join(dir, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (/\.(js|ts|xml)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name))
        files.push({ path: relative(root, path).split(sep).join('/'), text: await readFile(path, 'utf8') })
    }
  }
  await walk(base)
  return files
}

/** The api.json of a library at a release, from the cache or the SDK; null when the release has no such library. */
export async function apiJson(library, version, { cdn = process.env.NOVA_UI5_CDN || 'https://ui5.sap.com',
  cache = process.env.NOVA_UI5_API_CACHE || join(homedir(), '.nova', 'ui5-api') } = {}) {
  const file = join(cache, version, `${library}.json`)
  const kept = await readFile(file, 'utf8').then(JSON.parse, () => null)
  if (kept) return kept.missing ? null : kept
  const response = await fetch(`${cdn.replace(/\/+$/, '')}/${version}/test-resources/${library.replaceAll('.', '/')}/designtime/api.json`)
  if (response.status === 404) {
    await mkdir(join(cache, version), { recursive: true })
    await writeFile(file, '{"missing":true}\n')
    return null
  }
  if (!response.ok) throw new Error(`api.json of ${library} ${version}: HTTP ${response.status}`)
  const json = await response.json()
  await mkdir(join(cache, version), { recursive: true })
  await writeFile(file, JSON.stringify(json))
  return json
}

const where = set => [...set].slice(0, 3).join(', ') + (set.size > 3 ? ` and ${set.size - 3} more` : '')

/**
 * The verdicts for one release: the findings, what to check by hand, the libraries not read; and, for the next
 * release, the methods each file calls on the classes it uses (`owners`), to see one that disappears.
 */
export async function checkRelease(used, version, { load = apiJson, before = null } = {}) {
  const libraries = new Set([...used.modules.keys()].map(libraryOf).filter(Boolean))
  if (used.services.size) libraries.add('sap.ushell')
  const symbols = new Map(), unread = []
  for (const library of [...libraries].sort()) {
    const json = await load(library, version)
    if (!json) { unread.push(library); continue }
    for (const symbol of json.symbols ?? []) symbols.set(symbol.name, { ...symbol, library })
  }
  const symbolOf = module => symbols.get(module.replaceAll('/', '.')) ?? [...symbols.values()].find(s => s.module === module)
  const findings = [], checks = []
  // modules, controls and globals: public, or not
  for (const [module, places] of used.modules) {
    const library = libraryOf(module)
    if (!library || unread.includes(library)) continue
    const symbol = symbolOf(module)
    if (!symbol) {
      // the library module itself (sap/m/library), themes and resources are not symbols
      if (!/\/(library|themes|messagebundle)(\/|$)|\.(css|properties|json)$/.test(module))
        findings.push({ kind: 'module', api: module.replaceAll('/', '.'), visibility: 'not documented', where: where(places) })
    } else if (NOT_PUBLIC.has(symbol.visibility))
      findings.push({ kind: 'module', api: symbol.name, visibility: symbol.visibility, where: where(places) })
  }
  const publicService = service => {
    const symbol = symbols.get(`sap.ushell.services.${service}`)
    return symbol && !NOT_PUBLIC.has(symbol.visibility) ? symbol : null
  }
  for (const [service, places] of used.services) {
    if (unread.includes('sap.ushell') || publicService(service)) continue
    const visibility = symbols.get(`sap.ushell.services.${service}`)?.visibility ?? 'not documented'
    // an optional service with a public one in its place when it is missing: the app works on this release
    const instead = [...used.fallbacks?.get(service) ?? []].filter(publicService)
    if (instead.length)
      checks.push({ kind: 'service', api: `sap.ushell.services.${service}`, public: `fallback ${instead.map(i => `sap.ushell.services.${i}`).join(', ')}`,
        visibility, where: where(places) })
    else findings.push({ kind: 'service', api: `sap.ushell.services.${service}`, visibility, where: where(places) })
  }
  // methods: on the classes the file itself uses (what it imports, their inner classes, the services it asks for),
  // and, when none of them has the name, on those of the whole app: an object often comes from another file (the
  // extension service a component hands to a controller, the item createHeaderItem returns)
  const relatedTo = (modules, services) => {
    const roots = [...modules].map(m => m.replaceAll('/', '.')).concat([...services].map(sv => `sap.ushell.services.${sv}`))
    return [...symbols.values()].filter(sym => roots.some(r => sym.name === r || sym.name.startsWith(`${r}.`)))
  }
  const appRelated = relatedTo(used.modules.keys(), used.services.keys())
  const methodsOf = (related, name) => related.flatMap(sym => (sym.methods ?? []).filter(m => m.name === name)
    .map(m => ({ owner: sym.name, visibility: m.visibility ?? 'public' })))
  const owners = new Map()
  for (const file of used.files) {
    const related = relatedTo(file.modules, file.services)
    for (const [name, places] of file.calls) {
      const inFile = methodsOf(related, name)
      const key = `${file.path}#${name}`
      const previous = before?.get(key)
      // where an earlier release found the method: on the file's classes, it is not looked for elsewhere now
      const having = inFile.length || previous?.scope === 'file' ? inFile : methodsOf(appRelated, name)
      owners.set(key, { scope: inFile.length ? 'file' : 'app', owners: having.map(h => h.owner) })
      // a method an earlier release had on the classes of the file, and that none of them has in this one
      const earlier = previous?.owners ?? []
      if (earlier.length && !having.length && !earlier.every(owner => unread.includes(libraryOf(owner.replaceAll('.', '/')))))
        findings.push({ kind: 'method', api: earlier.map(owner => `${owner}#${name}`).join(', '), visibility: 'not in this release',
          where: where(places) })
      const hidden = having.filter(h => NOT_PUBLIC.has(h.visibility)), open = having.filter(h => !NOT_PUBLIC.has(h.visibility))
      if (!hidden.length) continue
      const api = hidden.map(h => `${h.owner}#${name}`).join(', ')
      // public on none of the classes the app uses: a finding; public on some and not on others: to check by hand,
      // with the classes, since the script does not know the type of the object
      if (!open.length) findings.push({ kind: 'method', api, visibility: hidden[0].visibility, where: where(places) })
      else checks.push({ kind: 'method', api, visibility: hidden[0].visibility, public: open.slice(0, 3).map(h => h.owner).join(', '),
        where: where(places) })
    }
  }
  return { version, findings, checks, unread, owners }
}

export async function check(root, versions, { load } = {}) {
  const used = usages(await sourceFiles(root))
  const releases = []
  let before = null
  for (const version of versions) {
    const release = await checkRelease(used, version, { load, before })
    before = release.owners
    delete release.owners
    releases.push(release)
  }
  return { project: root, versions, releases, modules: used.modules.size, failed: releases.some(r => r.findings.length) }
}

function report(result) {
  const lines = [`# API SAPUI5 pubbliche: ${result.versions.join(' e ')}`, '',
    `${result.modules} moduli e controlli letti in ${result.project}.`, '']
  for (const r of result.releases) {
    lines.push(`## ${r.version}`, '')
    if (!r.findings.length && !r.checks.length) lines.push('Nessuna API non pubblica.')
    for (const f of r.findings) lines.push(`- **non pubblica** · ${f.kind} \`${f.api}\` (${f.visibility}) · ${f.where}`)
    for (const c of r.checks) lines.push(`- da controllare · ${c.kind} \`${c.api}\`${c.visibility ? ` (${c.visibility})` : ''}, ` +
      `pubblica in ${c.public} · ${c.where}`)
    if (r.unread.length) lines.push(`- librerie non lette (nessun api.json per questa release): ${r.unread.join(', ')}`)
    lines.push('')
  }
  lines.push(result.failed ? 'Esito: API non pubbliche da sostituire con API pubbliche, o da approvare come eccezione scritta.'
    : 'Esito: nessuna API non pubblica.')
  return lines.join('\n')
}

export async function main(argv = process.argv.slice(2), { log = console.log } = {}) {
  const options = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') options.json = true
    else if (['--versions', '--project', '--output'].includes(argv[i])) options[argv[i].slice(2)] = argv[++i]
    else if (argv[i] === '--help' || argv[i] === '-h') options.help = true
  }
  const versions = (options.versions ?? '').split(',').map(v => v.trim()).filter(Boolean)
  if (options.help || !versions.length) {
    log('node ui5-api-check.mjs --versions <target>,<next> [--project <dir>] [--json] [--output <file>]')
    return options.help ? 0 : 2
  }
  const result = await check(resolve(options.project ?? '.'), versions)
  const text = options.json ? JSON.stringify(result, (key, value) => value instanceof Set ? [...value] : value, 2) : report(result)
  if (options.output) await writeFile(resolve(options.output), text + '\n')
  log(text)
  return result.failed ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  main().then(code => { process.exitCode = code }, error => { console.error(error.message); process.exitCode = 2 })
