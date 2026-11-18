// The data of a custom code program as its steps leave them in the repository of the program (docs/10, sections 4
// and 7.3; docs/wolf/18): the register of the objects, the where-used, the plan of the waves, the systems, the volumes.
// program-diagrams.mjs and program-docs.mjs read them here, so a diagram and a document of the same program count the
// same way. Nothing here asks a system or a model, and a field a step did not record stays null: who writes the
// diagram or the document says "not recorded", never a guess.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { domainOf } from '../wave-plan.mjs'

export { domainOf }
/** The Clean Core levels of an object (register: levelStart, levelNow); UNKNOWN is a level a step wrote, not a missing one. */
export const LEVELS = ['A', 'B', 'C', 'D', 'UNKNOWN']
/** The usage classes of sap-unused-code (register: usage). */
export const USAGES = ['USED', 'LIKELY_UNUSED', 'UNUSED', 'INDETERMINATE']
/** The statuses of an object that needs no more work (ObjectStatuses.done). */
export const DONE = new Set(['ADAPTED', 'NO_CHANGE', 'EXEMPT', 'RETIRED'])
/** The statuses of the retirement before the deletion (docs/10, section 7.4). */
export const RETIRING = new Set(['RETIRE_CANDIDATE', 'QUARANTINE', 'RETIRE_APPROVED'])
/** The entries of the register outside the perimeter Z: a modification of SAP code, an SAP Note. */
export const MODIFICATIONS = new Set(['MOD', 'NOTE'])
/** The package of the objects that have none, as wave-plan.mjs names it. */
export const NO_PACKAGE = '(none)'
/** Where the files of a program are, relative to its repository. */
export const FILES = {
  register: 'docs/program/register.json', objects: 'docs/program/objects.json', uses: 'docs/program/uses.json',
  waves: 'docs/program/waves.json', systemInfo: 'docs/program/system-info.md', volumes: 'docs/program/volumes.json',
  registerNow: 'docs/program/register-final.json', patterns: 'docs/patterns/patterns.json',
  manifest: '.claude/nova/skills.manifest.json'
}

const upper = value => String(value ?? '').toUpperCase().trim().split(/\s+/).join(' ')
/** The key of an object of the register: "TYPE NAME". */
export const keyOf = o => `${upper(o.type)} ${upper(o.name)}`

/** A JSON file of the program, or undefined when it is not there. */
export function readJson(file) {
  if (!existsSync(file)) return undefined
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`${file}: not JSON (${error.message})`, { cause: error })
  }
}
/** A text file of the program with Unix line ends, or undefined when it is not there. */
export const readText = file => existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n?/g, '\n') : undefined

/** A Clean Core level as the register may write it: A to D, UNKNOWN for any other value, null when there is none. */
export function levelOf(value) {
  const level = upper(value)
  if (!level) return null
  return ['A', 'B', 'C', 'D'].includes(level) ? level : 'UNKNOWN'
}
const usageOf = value => {
  const usage = upper(value).replace(/[ -]/g, '_')
  if (!usage) return null
  return USAGES.includes(usage) ? usage : 'INDETERMINATE'
}

/**
 * The register as the scripts read it, from what nova-config.mjs objects --export writes ([{type, name, package, main,
 * status, wave, usage, dossier, findings, levelStart, levelNow, note, category, proposal, decided, owner, expiry}]) or
 * from the inventory of CC_PERIMETER (objects.json: [{type, name, package, parts: ["PROG ZREP_TOP"]}], where each part
 * becomes a row of its own). Sorted by package, type and name: the order of the file does not matter.
 */
export function normalizeRegister(rows, file = 'the register') {
  if (!Array.isArray(rows)) throw new Error(`${file}: not the register (an array of objects)`)
  const out = new Map()
  const add = row => { if (!out.has(keyOf(row))) out.set(keyOf(row), row) }
  for (const o of rows) {
    if (!o || typeof o !== 'object' || !o.type || !o.name) throw new Error(`${file}: an object needs type and name: ${JSON.stringify(o)}`)
    const findings = o.findings === null || o.findings === undefined || o.findings === '' || !Number.isFinite(Number(o.findings))
      ? null : Number(o.findings)
    const row = {
      type: upper(o.type), name: upper(o.name), package: upper(o.package) || null, main: o.main ? upper(o.main) : null,
      status: upper(o.status) || null, wave: o.wave ?? null, usage: usageOf(o.usage), dossier: upper(o.dossier) || null,
      findings, levelStart: levelOf(o.levelStart), levelNow: levelOf(o.levelNow), note: o.note ?? null,
      category: o.category ?? null, proposal: o.proposal ?? null, decided: o.decided ?? null, owner: o.owner ?? null,
      expiry: o.expiry ?? null
    }
    add(row)
    for (const part of Array.isArray(o.parts) ? o.parts : []) {
      const [type, ...name] = upper(part).split(' ')
      // a part goes where its object goes; what was measured on the object (usage, findings, level) is not its own
      if (type && name.length) add({ ...row, type, name: name.join(' '), main: keyOf(row), usage: null, dossier: null, findings: null,
        levelStart: null, levelNow: null, note: null })
    }
  }
  const order = o => `${o.package ?? ''}\u0000${o.type}\u0000${o.name}`
  return [...out.values()].sort((a, b) => order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : 0)
}

/**
 * The register of a program: the file given, or docs/program/register.json, or docs/program/objects.json.
 * Returns { file, objects } (file relative to the root as given), or null when none of them is there.
 */
export function loadRegister(root, given) {
  for (const file of given ? [given] : [FILES.register, FILES.objects]) {
    const rows = readJson(resolve(root, file))
    if (rows !== undefined) return { file, objects: normalizeRegister(rows, file) }
  }
  if (given) throw new Error(`${given}: no such file`)
  return null
}

/** The objects of the perimeter: the register without the modifications of SAP code and the SAP Notes. */
export const perimeterOf = objects => objects.filter(o => !MODIFICATIONS.has(o.type))

const counter = keys => Object.fromEntries([...keys, 'none'].map(k => [k, 0]))
/** The numbers of a set of objects: how many, by status, usage and level, their findings. */
export function statsOf(objects) {
  const stats = { objects: objects.length, status: {}, done: 0, retired: 0, retiring: 0, usage: counter(USAGES),
    levelStart: counter(LEVELS), levelNow: counter(LEVELS), findings: null }
  for (const o of objects) {
    if (o.status) stats.status[o.status] = (stats.status[o.status] ?? 0) + 1
    if (DONE.has(o.status)) stats.done++
    if (o.status === 'RETIRED') stats.retired++
    if (RETIRING.has(o.status)) stats.retiring++
    stats.usage[o.usage ?? 'none']++
    stats.levelStart[o.levelStart ?? 'none']++
    stats.levelNow[o.levelNow ?? 'none']++
    if (o.findings !== null) stats.findings = (stats.findings ?? 0) + o.findings
  }
  return stats
}
/** Whether a count by class (usage, levelStart, levelNow of statsOf) has at least one recorded value. */
export const recorded = counts => Object.entries(counts).some(([k, n]) => k !== 'none' && n > 0)
/** The objects at level A or B among those with a level, as a whole percentage; null with no level recorded. */
export function shareAB(levels) {
  const withLevel = LEVELS.reduce((sum, level) => sum + levels[level], 0)
  return withLevel ? Math.round((levels.A + levels.B) / withLevel * 100) : null
}

/** The packages of the perimeter, by name, each with its objects and their numbers: Map package → { package, rows, ...statsOf }. */
export function packagesOf(objects) {
  const by = new Map()
  for (const o of perimeterOf(objects)) {
    const name = o.package ?? NO_PACKAGE
    if (!by.has(name)) by.set(name, [])
    by.get(name).push(o)
  }
  return new Map([...by.keys()].sort().map(name => [name, { package: name, rows: by.get(name), ...statsOf(by.get(name)) }]))
}

/**
 * The domains of a set of packages, for the lanes of a diagram and the groups of a table: what comes before the first
 * underscore (wave-plan.mjs domainOf). The packages alone in their domain go together in the last one, named null.
 * Returns [{ domain, packages }], by name.
 */
export function domainsOf(packages) {
  const by = new Map()
  for (const name of [...packages].sort()) {
    const domain = name === NO_PACKAGE ? NO_PACKAGE : domainOf(name)
    if (!by.has(domain)) by.set(domain, [])
    by.get(domain).push(name)
  }
  const groups = [...by].filter(([, list]) => list.length > 1).map(([domain, list]) => ({ domain, packages: list }))
  const alone = [...by].filter(([, list]) => list.length === 1).map(([, list]) => list[0])
  if (!groups.length && alone.length) return [{ domain: null, packages: alone.sort() }]
  return alone.length ? [...groups, { domain: null, packages: alone.sort() }] : groups
}

/** The where-used of Nova ARC-1 ([{from: "CLAS ZCL_A", to: "CLAS ZCL_B"}], ZCL_A uses ZCL_B), sorted, without doubles. */
export function normalizeUses(rows, file = 'the where-used') {
  if (!Array.isArray(rows)) throw new Error(`${file}: not the where-used (an array of {from, to})`)
  const out = new Map()
  for (const row of rows) {
    if (!row?.from || !row?.to) throw new Error(`${file}: a where-used needs from and to: ${JSON.stringify(row)}`)
    const use = { from: upper(row.from), to: upper(row.to) }
    out.set(`${use.from}\u0000${use.to}`, use)
  }
  return [...out.keys()].sort().map(k => out.get(k))
}

/**
 * Who uses whom between the packages of the perimeter: { pairs: Map "A\u0000B" → how many where-used (A uses B),
 * uses: Map package → packages it uses, usedBy: Map package → packages that use it, inside: where-used within one
 * package, outside: where-used with an end that is not in the register }.
 */
export function packageUses(objects, uses) {
  const packageOf = new Map(perimeterOf(objects).map(o => [keyOf(o), o.package ?? NO_PACKAGE]))
  const result = { pairs: new Map(), uses: new Map(), usedBy: new Map(), inside: 0, outside: 0 }
  const add = (map, key, value) => { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(value) }
  for (const { from, to } of uses) {
    const a = packageOf.get(from), b = packageOf.get(to)
    if (!a || !b) { result.outside++; continue }
    if (a === b) { result.inside++; continue }
    const pair = `${a}\u0000${b}`
    result.pairs.set(pair, (result.pairs.get(pair) ?? 0) + 1)
    add(result.uses, a, b)
    add(result.usedBy, b, a)
  }
  return result
}

/**
 * The plan of the waves as wave-plan.mjs writes it and the developer changes it ([{order, title, packages | objects,
 * count, findings, focus, dependsOn}]), in its order. A number the file does not have stays null.
 */
export function normalizeWaves(rows, file = 'the plan of the waves') {
  if (!Array.isArray(rows)) throw new Error(`${file}: not the plan of the waves (an array of waves)`)
  const number = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value)
  const waves = rows.map((w, n) => {
    if (!w?.title) throw new Error(`${file}: a wave needs a title: ${JSON.stringify(w)}`)
    return {
      order: number(w.order) ?? n + 1, title: String(w.title), packages: Array.isArray(w.packages) ? w.packages.map(upper) : null,
      objects: Array.isArray(w.objects) ? w.objects.map(String) : null, count: number(w.count), findings: number(w.findings),
      focus: w.focus ? upper(w.focus) : null, dependsOn: Array.isArray(w.dependsOn) ? w.dependsOn.map(String).sort() : []
    }
  })
  return waves.sort((a, b) => a.order - b.order || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0))
}

/** An object named by a wave of single objects, "TYPE NAME (PACKAGE)": { key, package }. */
export function waveObject(text) {
  const m = /^(.*?)(?:\s*\(([^()]+)\))?$/.exec(String(text).trim())
  return { key: upper(m[1]), package: m[2] ? upper(m[2]) : null }
}

/**
 * What a wave of the plan takes from a register: { rows, byPackage: Map package → { rows, units } }. A wave of packages
 * takes the objects of its packages; a wave of single objects the objects it names with their parts (units: how many
 * it names in that package).
 */
export function waveScope(wave, objects) {
  const perimeter = perimeterOf(objects)
  const byPackage = new Map()
  const slot = name => { if (!byPackage.has(name)) byPackage.set(name, { rows: [], units: 0 }); return byPackage.get(name) }
  if (wave.packages) {
    const names = new Set(wave.packages)
    for (const name of [...names].sort()) slot(name)
    for (const o of perimeter) if (names.has(o.package ?? NO_PACKAGE)) slot(o.package ?? NO_PACKAGE).rows.push(o)
  } else {
    const named = new Map((wave.objects ?? []).map(waveObject).map(o => [o.key, o]))
    const packageOf = new Map(perimeter.map(o => [keyOf(o), o.package ?? NO_PACKAGE]))
    for (const o of named.values()) slot(packageOf.get(o.key) ?? o.package ?? NO_PACKAGE).units++
    for (const o of perimeter) {
      const unit = named.has(keyOf(o)) ? keyOf(o) : o.main && named.has(o.main) ? o.main : null
      if (unit) slot(packageOf.get(unit) ?? o.package ?? NO_PACKAGE).rows.push(o)
    }
  }
  const sorted = new Map([...byPackage.keys()].sort().map(name => [name, byPackage.get(name)]))
  return { rows: [...sorted.values()].flatMap(p => p.rows), byPackage: sorted }
}

/** The tables of a Markdown text: [{ header: [cell], rows: [[cell]] }], cells without their inline marks. */
export function tablesOf(markdown) {
  const cells = line => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim())
  const tables = []
  const lines = String(markdown ?? '').split('\n')
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!/^\s*\|.*\|\s*$/.test(lines[i]) || !/^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1])) continue
    const table = { header: cells(lines[i]), rows: [] }
    for (i += 2; i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]); i++) table.rows.push(cells(lines[i]))
    tables.push(table)
  }
  return tables
}
const plain = text => String(text ?? '').replace(/[`*]/g, '').trim()

/**
 * The systems of the program, from docs/program/system-info.md (CC_SYSTEM_READY): { systems: [{ name, role, release,
 * connection, from }], source }. The file has no fixed format, so only two things are read:
 * - a table with a column System (or Sistema, SID) and any of Role (Ruolo), Release, Connection (Collegamento): one
 *   system per row (source "table"); a connection written "RFC from S4C" (or "da S4C") is a link from that system;
 * - without such a table, the lines "SID: S4D" (System, Sistema, System ID) and "Release: ...": the system of the
 *   program alone (source "lines").
 * Nothing else is guessed from the text: source "none" when the file says neither, "missing" when it is not there.
 */
export function landscapeOf(text) {
  if (text === undefined || text === null) return { systems: [], source: 'missing' }
  const column = (header, re) => header.findIndex(h => re.test(plain(h)))
  for (const table of tablesOf(text)) {
    const name = column(table.header, /^(system|sistema|sid)$/i)
    if (name < 0) continue
    const at = { role: column(table.header, /^(role|ruolo)$/i), release: column(table.header, /^release$/i),
      connection: column(table.header, /^(connections?|collegament[oi]|link)$/i) }
    const cell = (row, index) => index >= 0 && plain(row[index]) && !/^[-–—]$/.test(plain(row[index])) ? plain(row[index]) : null
    const systems = table.rows.filter(row => cell(row, name)).map(row => ({ name: cell(row, name), role: cell(row, at.role),
      release: cell(row, at.release), connection: cell(row, at.connection), from: null }))
    for (const s of systems) {
      const other = /\b(?:from|da)\s+(.+)$/i.exec(s.connection ?? '')?.[1]
      s.from = systems.find(o => o !== s && other && o.name.toUpperCase() === other.trim().toUpperCase())?.name ?? null
    }
    return { systems, source: 'table' }
  }
  const value = re => {
    for (const line of text.split('\n')) {
      const m = new RegExp(`^\\s*(?:[-*]\\s*)?(?:\\|\\s*)?\\**(?:${re})\\**\\s*(?::|=|\\|)\\s*\\**([^|*]+?)\\**\\s*\\|?\\s*$`, 'i').exec(line)
      if (m && plain(m[1])) return plain(m[1])
    }
    return null
  }
  const name = value('SID|System ID') ?? value('System|Sistema')
  const release = value('Release|SAP release')
  if (!name && !release) return { systems: [], source: 'none' }
  return { systems: [{ name: name ?? null, role: null, release, connection: null, from: null }], source: 'lines' }
}

/**
 * The volumes of a program as the configurator exports them (docs/10, section 7): { program: { title, type }, waves:
 * [{ title, folder, state }], history: [{ measure, value, measuredAt, step, wave }] }. history has one row per
 * measurement (DevelopmentVolumeHistory), `wave` the title of the wave that measured it and null (or absent) for the
 * program itself; waves names the waves of the program with their folder in the repository (waves/<name>). Returns
 * { program, waves, history }, the rows with numbers, oldest first.
 */
export function normalizeVolumes(data, file = 'the volumes') {
  const history = Array.isArray(data) ? data : data?.history
  if (!Array.isArray(history)) throw new Error(`${file}: not the volumes ({ history: [{ measure, value, measuredAt, step, wave }] })`)
  const rows = history.map(h => {
    if (!h?.measure || !Number.isFinite(Number(h.value))) throw new Error(`${file}: a measurement needs measure and value: ${JSON.stringify(h)}`)
    return { measure: upper(h.measure), value: Number(h.value), measuredAt: String(h.measuredAt ?? ''), step: h.step ?? null, wave: h.wave ?? null }
  })
  const order = h => `${h.measuredAt}\u0000${h.wave ?? ''}\u0000${h.measure}`
  const waves = (Array.isArray(data?.waves) ? data.waves : []).filter(w => w?.title)
    .map(w => ({ title: String(w.title), folder: w.folder ? String(w.folder).replace(/\/+$/, '') : null, state: w.state ?? null }))
  return { program: Array.isArray(data) ? null : data.program ?? null, waves,
    history: rows.sort((a, b) => order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : 0) }
}

/**
 * The first and the latest value of a measure for one owner of the history (the program: wave null; or a wave, by its
 * title): { first, last }, each { value, at, step }; last is null when the measure was measured once. Null when never.
 */
export function firstAndLast(history, measure, wave = null) {
  const rows = history.filter(h => h.measure === measure && (h.wave ?? null) === wave)
  if (!rows.length) return null
  const point = h => ({ value: h.value, at: h.measuredAt, step: h.step })
  return { first: point(rows[0]), last: rows.length > 1 ? point(rows[rows.length - 1]) : null }
}

/** The program as its installation names it (.claude/nova/skills.manifest.json): { title, type }, null when unknown. */
export function programOf(root) {
  let manifest
  try { manifest = readJson(resolve(root, FILES.manifest)) } catch { manifest = undefined }
  const development = manifest?.development ?? {}
  const text = value => typeof value === 'string' && value.trim() ? value.trim() : null
  return { title: text(development.title), type: text(development.type) ?? text(development.type?.code) }
}

/** A value with the keys of its objects sorted, so two equal values give the same text. */
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]))
  return value ?? null
}
/** The fingerprint of the inputs of a diagram or a document: sha256 of their canonical JSON. */
export const fingerprintOf = inputs => createHash('sha256').update(JSON.stringify(canonical(inputs))).digest('hex')
