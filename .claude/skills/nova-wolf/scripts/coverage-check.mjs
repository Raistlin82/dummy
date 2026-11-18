#!/usr/bin/env node
/**
 * Coverage of the delivered objects by the documentation (step DOCS_COVERAGE): every object the customer sees after the
 * import (packages, application job catalog entries and templates, IAM apps, application log objects and their
 * subobjects, message classes, service bindings, authorization objects, business configuration objects, launchpad
 * app descriptors, BSP apps…) is named in the documentation, or excluded on purpose with the reason. A function taken
 * out of the documentation but still in the code shows up here: either it goes back into the documents, or out of the
 * code, or it is excluded with the reason, as the person responsible decides.
 *
 *   node coverage-check.mjs [--project <abapGit folder>] [--root-package <name>] [--objects <file>] [--docs docs,README.md]
 *        [--exclusions docs/coverage-exclusions.md] [--types DEVC,SAJC,...] [--output <file>] [--json]
 *
 * Objects: the abapGit sources of --project (one object per <name>.<type>.* file, # for the slashes of a namespace;
 * packages named by the folder logic of .abapgit.xml, the root package given with --root-package; application log
 * subobjects read from the .aplo file), and the lines TYPE NAME (TYPE "NAME WITH SPACES") of --objects for what abapGit does not
 * carry (PFCG roles, launchpad content of other stacks, CAP services). Documentation: Markdown, YAML and text under
 * --docs, without what does not describe the product as it is, with the same rule as docs-final-check.mjs
 * (guide/lib/doc-scope.mjs): archive/, audit/ and refactor/, the as-is, the open points and the SAP screenshot list of a
 * guide, the coverage exclusions.
 * Exclusions: a Markdown table | Object | Reason | (or lines `TYPE NAME: reason`); an exclusion without reason does
 * not count. Exit 1 when an object is neither documented nor excluded, or an exclusion names no delivered object.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
// what is not the documentation of the product as it is: the same rule as docs-final-check.mjs
import { notProductDir, notProductFile } from './guide/lib/doc-scope.mjs'

// the object types a customer meets in SAINT, PFCG, the launchpad and the monitoring apps
export const CUSTOMER_TYPES = ['DEVC', 'SAJC', 'SAJT', 'SIA6', 'SIA1', 'APLO', 'MSAG', 'SRVB', 'SUSO', 'SMBC', 'UIAD',
  'WAPA', 'SICF', 'NROB', 'SUSH', 'SCO2', 'SMIM', 'SPRX', 'G4BA', 'SHMA', 'SXCI', 'ENHS', 'ENHO', 'TRAN', 'PROG', 'SAMC',
  // CAP and SAP BTP (--cap): role templates and collections, apps and their launchpad intents, CDS services, the MTA,
  // its modules (the apps in the space) and its resources (the service instances in the cockpit)
  ...CAP_TYPES()]
function CAP_TYPES() { return ['XSRT', 'XSRC', 'APP', 'INTENT', 'SRV', 'MTA', 'MTAM', 'MTAR'] }

async function walk(dir, keep, out = []) {
  if (!existsSync(dir)) return out
  if (statSync(dir).isFile()) { if (keep(dir)) out.push(dir); return out }
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) { if (!notProductDir(entry.name)) await walk(join(dir, entry.name), keep, out) }
    else if (keep(entry.name)) out.push(join(dir, entry.name))
  }
  return out
}

/** The object of an abapGit file name: `#key2#nb_setup.sajc.json` → SAJC /KEY2/NB_SETUP. */
export function objectOfFile(file) {
  const base = file.split(/[\\/]/).pop()
  if (base === 'package.devc.xml') return null // named after its folder: read by the caller
  const m = base.match(/^([^.]+)\.([a-z0-9]{4})\./)
  if (!m) return null
  return { type: m[2].toUpperCase(), name: m[1].replaceAll('#', '/').toUpperCase() }
}

/** The folder logic of an abapGit repository (.abapgit.xml in the project or above): FULL, PREFIX or MIXED, and the start. */
async function abapGitSettings(project) {
  for (let dir = project; ; dir = dirname(dir)) {
    const file = join(dir, '.abapgit.xml')
    if (existsSync(file)) {
      const xml = await readFile(file, 'utf8')
      return { root: dir, logic: xml.match(/<FOLDER_LOGIC>([^<]+)</)?.[1] ?? 'PREFIX', start: xml.match(/<STARTING_FOLDER>([^<]+)</)?.[1] ?? '/src/' }
    }
    if (dirname(dir) === dir) return { root: project, logic: 'PREFIX', start: '/' }
  }
}

/** The package of a folder: FULL takes the folder name, PREFIX the parent package, an underscore and the folder name. */
export function packageOf(segments, { logic, rootPackage }) {
  if (!segments.length) return rootPackage ?? null
  const folder = segments.at(-1).replaceAll('#', '/').toUpperCase()
  if (logic === 'FULL' || (logic === 'MIXED' && segments.length > 1)) return folder
  return rootPackage ? [rootPackage, ...segments.map(s => s.replaceAll('#', '/').toUpperCase())].join('_') : null
}

export async function deliveredObjects(project, types, { rootPackage } = {}) {
  const objects = new Map()
  const notes = []
  const add = (o, file) => { if (o && (!types || types.has(o.type))) objects.set(`${o.type} ${o.name}`, { ...o, file }) }
  const settings = await abapGitSettings(project)
  const startDir = join(settings.root, settings.start)
  for (const file of await walk(project, n => /\.(xml|json|abap|asddls|acds|asbdef|asdcls)$/.test(n))) {
    const base = file.split(/[\\/]/).pop()
    if (base === 'package.devc.xml') {
      const segments = relative(startDir, dirname(file)).split(/[\\/]/).filter(Boolean)
      const name = packageOf(segments, { logic: settings.logic, rootPackage })
      if (name) add({ type: 'DEVC', name }, file)
      else notes.push(`${relative(process.cwd(), file)}: package name unknown, pass --root-package`)
      continue
    }
    const o = objectOfFile(base)
    add(o, file)
    // application log subobjects: abapGit XML (<SUBOBJECT>) or the JSON format of ABAP Cloud (subobjects[].name)
    if (o?.type === 'APLO') {
      const text = await readFile(file, 'utf8')
      const subs = base.endsWith('.json') ? (JSON.parse(text).subobjects ?? []).map(x => x.name)
        : [...text.matchAll(/<SUBOBJECT>([^<]+)<\/SUBOBJECT>/g)].map(m => m[1])
      for (const sub of subs.filter(Boolean).map(x => x.trim().toUpperCase()))
        add({ type: 'APLO', name: `${o.name}/${sub}`, sub, parent: o.name }, file)
    }
  }
  return { objects, notes }
}

/**
 * The objects of a CAP or SAP BTP project a customer meets (F2), read from its files: xs-security.json (role templates,
 * role collections), the manifest.json of each app (its id and its launchpad intents), the CDS services (srv/), and
 * mta.yaml (its id, modules and resources). Names keep their case; the key is upper case, as for the exclusions.
 */
export async function capObjects(root, types) {
  const objects = new Map()
  const add = (type, name, file) => {
    if (name && (!types || types.has(type))) objects.set(`${type} ${String(name).toUpperCase()}`, { type, name: String(name), file })
  }
  const skip = new Set(['node_modules', '.git', 'archive', 'audit', '.claude', 'gen', 'dist', 'mta_archives', 'resources'])
  const files = []
  const scan = async (dir) => {
    if (!existsSync(dir)) return
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!skip.has(e.name) && !e.name.startsWith('.')) await scan(join(dir, e.name)) }
      else if (/^(xs-security\.json|manifest\.json|mta\.yaml)$|\.cds$/.test(e.name)) files.push(join(dir, e.name))
    }
  }
  await scan(root)
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    const base = file.split(/[\\/]/).pop()
    if (base === 'xs-security.json') {
      let x; try { x = JSON.parse(text) } catch { continue }
      for (const t of x['role-templates'] ?? []) add('XSRT', t.name, file)
      for (const c of x['role-collections'] ?? []) add('XSRC', c.name, file)
    } else if (base === 'manifest.json') {
      let m; try { m = JSON.parse(text) } catch { continue }
      if (!m['sap.app']?.id) continue
      add('APP', m['sap.app'].id, file)
      for (const i of Object.values(m['sap.app'].crossNavigation?.inbounds ?? {}))
        if (i?.semanticObject && i?.action) add('INTENT', `${i.semanticObject}-${i.action}`, file)
    } else if (base === 'mta.yaml') {
      const id = text.match(/^ID:\s*['"]?([\w.-]+)/m)?.[1]
      add('MTA', id, file)
      // the top-level lists modules: and resources:, each item `  - name: <name>`
      for (const [, section, body] of text.matchAll(/^(modules|resources):\s*\n((?:[ \t]+.*\n|\s*\n)*)/gm))
        for (const [, name] of body.matchAll(/^\s{2}-\s+name:\s*['"]?([\w.$\{\}-]+)/gm)) add(section === 'modules' ? 'MTAM' : 'MTAR', name, file)
    } else if (/[\\/]srv[\\/]/.test(file)) {
      for (const [, name] of text.replace(/\/\/.*$/gm, '').matchAll(/^\s*(?:@[^\n]*\s+)*service\s+([\w.]+)/gm)) add('SRV', name, file)
    }
  }
  return objects
}

export function objectsFromList(text, types) {
  const objects = new Map()
  for (const line of text.split(/\r?\n/)) {
    // a name with spaces (a role collection, an app title) goes in quotes: XSRC "ArchiveLink Administrator"
    const m = line.replace(/#.*$/, '').trim().match(/^([A-Z0-9]{2,6})\s+(?:"([^"]+)"|(\S+))/i)
    const name = (m?.[2] ?? m?.[3])?.trim().toUpperCase()
    if (m && name && (!types || types.has(m[1].toUpperCase()))) objects.set(`${m[1].toUpperCase()} ${name}`, { type: m[1].toUpperCase(), name, file: 'list' })
  }
  return objects
}

/** Exclusions: rows `| TYPE NAME | reason |` or lines `TYPE NAME: reason`. */
export function parseExclusions(text) {
  const out = new Map()
  for (const line of text.split(/\r?\n/)) {
    // in a table the cell is the name, spaces included; in a line, a name with spaces goes in quotes
    let type, name, reason
    const row = line.match(/^\|\s*`?([A-Z0-9]{2,6})\s+"?([^`|"]+?)"?`?\s*\|\s*([^|]*)\|/i)
    const item = row ? null : line.match(/^[-*]?\s*`?([A-Z0-9]{2,6})\s+(?:"([^"]+)"|([^`:\s]+))`?\s*:\s*(.*)$/i)
    if (row) [, type, name, reason] = row
    else if (item) [type, name, reason] = [item[1], item[2] ?? item[3], item[4]]
    if (type && !/^(object|oggetto|type|tipo)$/i.test(type)) out.set(`${type.toUpperCase()} ${name.trim().toUpperCase()}`, reason.trim())
  }
  return out
}

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Whether a text names the object: its full name as a word (a namespace counts as part of the word). */
export function names(text, o) {
  const words = [o.name]
  // a subobject is documented with its parent object nearby, or as OBJECT/SUB, or as OBJECT › SUB
  if (o.sub) return new RegExp(`${escape(o.parent)}[^\\n]{0,80}\\b${escape(o.sub)}\\b|\\b${escape(o.sub)}\\b[^\\n]{0,80}${escape(o.parent)}`, 'i').test(text)
  return words.some(w => new RegExp(`(^|[^A-Z0-9_/])${escape(w)}(?![A-Z0-9_])`, 'i').test(text))
}

export async function checkCoverage({ project, rootPackage, cap, objectsFile, docs = ['docs', 'README.md'], exclusions, types, root = process.cwd() }) {
  const typeSet = types === 'ALL' ? null : new Set(types ?? CUSTOMER_TYPES)
  // a folder that is not there would read as 0 objects, all documented: the gate would pass on a typo
  for (const [option, dir] of [['--project', project], ['--cap', cap]])
    if (dir && !statSync(resolve(root, dir), { throwIfNoEntry: false })?.isDirectory()) throw new Error(`${option} ${dir} is not a folder`)
  const { objects, notes } = project ? await deliveredObjects(resolve(root, project), typeSet, { rootPackage }) : { objects: new Map(), notes: [] }
  if (cap) for (const [k, v] of await capObjects(resolve(root, cap), typeSet)) objects.set(k, v)
  if (objectsFile) for (const [k, v] of objectsFromList(await readFile(resolve(root, objectsFile), 'utf8'), typeSet)) objects.set(k, v)
  const files = []
  for (const d of docs) files.push(...await walk(resolve(root, d), n => /\.(md|ya?ml|txt|json)$/i.test(n) && !notProductFile(n.split(/[\\/]/).pop())))
  const texts = await Promise.all(files.map(async f => ({ file: relative(root, f), text: await readFile(f, 'utf8') })))
  const excluded = exclusions && existsSync(resolve(root, exclusions)) ? parseExclusions(await readFile(resolve(root, exclusions), 'utf8')) : new Map()
  const rows = []
  for (const [key, o] of [...objects].sort(([a], [b]) => a.localeCompare(b))) {
    const where = texts.filter(t => names(t.text, o)).map(t => t.file)
    const reason = excluded.get(key)
    rows.push({ key, ...o, file: o.file === 'list' ? 'list' : relative(root, o.file), documentedIn: where,
      excluded: reason || undefined, state: where.length ? 'documented' : reason ? 'excluded' : excluded.has(key) ? 'excluded without reason' : 'missing' })
  }
  const stale = [...excluded.keys()].filter(k => !objects.has(k))
  return { objects: rows, missing: rows.filter(r => r.state === 'missing' || r.state === 'excluded without reason'), staleExclusions: stale, docs: texts.length, notes }
}

function markdown(r) {
  const lines = ['# Coverage of the delivered objects by the documentation', '',
    `${r.objects.length} objects, ${r.docs} documents: ${r.missing.length} not documented, ${r.staleExclusions.length} exclusions of objects no longer delivered.`, '',
    ...r.notes.map(n => `- ${n}`), ...(r.notes.length ? [''] : [])]
  if (r.missing.length) {
    lines.push('## Not documented', '', 'Document each one, take it out of the code, or exclude it with the reason (coverage-exclusions.md): the person responsible decides.', '',
      '| Object | Source |', '|---|---|', ...r.missing.map(m => `| \`${m.type} ${m.name}\`${m.state === 'excluded without reason' ? ' (excluded without reason)' : ''} | ${m.file} |`), '')
  }
  if (r.staleExclusions.length) lines.push('## Exclusions of objects no longer delivered', '', ...r.staleExclusions.map(k => `- \`${k}\``), '')
  lines.push('## All objects', '', '| Object | State | Where |', '|---|---|---|',
    ...r.objects.map(o => `| \`${o.type} ${o.name}\` | ${o.state} | ${o.state === 'documented' ? o.documentedIn.slice(0, 3).join(', ') : o.excluded ?? ''} |`), '')
  return lines.join('\n')
}

async function main(argv) {
  const { values } = parseArgs({ args: argv, options: {
    project: { type: 'string' }, 'root-package': { type: 'string' }, cap: { type: 'string' }, objects: { type: 'string' }, docs: { type: 'string', default: 'docs,README.md' },
    exclusions: { type: 'string', default: 'docs/coverage-exclusions.md' }, types: { type: 'string' },
    output: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } })
  if (values.help || (!values.project && !values.objects && !values.cap)) {
    console.log('node coverage-check.mjs --project <abapGit folder> [--root-package <name>] | --cap <project root> [--objects <file>] [--docs docs,README.md] [--exclusions docs/coverage-exclusions.md] [--types DEVC,SAJC,...|ALL] [--output <file>] [--json]')
    return values.help ? 0 : 2
  }
  const r = await checkCoverage({ project: values.project, cap: values.cap, rootPackage: values['root-package']?.toUpperCase(), objectsFile: values.objects, docs: values.docs.split(','), exclusions: values.exclusions,
    types: values.types === 'ALL' ? 'ALL' : values.types?.split(',').map(t => t.trim().toUpperCase()) })
  const md = markdown(r)
  if (values.output) { await mkdir(dirname(resolve(values.output)), { recursive: true }); await writeFile(values.output, md) }
  console.log(values.json ? JSON.stringify(r, null, 2) : md)
  return r.missing.length || r.staleExclusions.length ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  process.exit(await main(process.argv.slice(2)).catch(error => { console.error(error.message); return 2 }))
