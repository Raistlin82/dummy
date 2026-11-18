#!/usr/bin/env node
/**
 * ABAP_LINT without a system: the checks abaplint cannot do offline on abapGit sources.
 *
 * abaplint reads each object on its own: it does not see that a type of a class's locals_def used in its PUBLIC
 * SECTION makes the class impossible to activate, and it does not read behavior definitions. This script reads the
 * abapGit sources of a project (src/** or anywhere outside node_modules and .git):
 *
 *   node abap-offline-check.mjs --project <dir> [--output <file>] [--json]
 *
 * 1. Global classes (*.clas.abap): a type, class or interface defined in the class's locals_def or locals_imp and
 *    used in its PUBLIC or PROTECTED SECTION is an error (a global class cannot expose a local type); one defined
 *    only in locals_imp and used in the PRIVATE SECTION is an error too (locals_imp comes after the definition).
 * 2. Behavior definitions (*.bdef.asbdef): every entity has its CDS (*.ddls.asddls) and the first one is a root
 *    entity; the class of `implementation in class` is in the project; every action, function, determination and
 *    validation has a handler method in the behavior pool (METHODS ... FOR MODIFY / FOR READ / FOR DETERMINE /
 *    FOR VALIDATE ... <entity or alias>~<name>), and so do instance or global authorization and features; with
 *    draft, every entity names its draft table.
 * What the sources do not tell (a draft table or a class that is not in the project, an unmanaged save, a handler
 * declared for another entity) is listed as to check, not guessed. Exit 1 when there is an error, 2 on a wrong call.
 */
import { statSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const SKIP = new Set(['node_modules', '.git', '.claude', 'dist', 'coverage', 'gen', 'target'])
const SOURCE = /\.(clas(\.locals_def|\.locals_imp|\.testclasses)?\.abap|bdef\.asbdef|bdef\.xml|ddls\.asddls|tabl\.xml)$/i

/** The abapGit file name of an object: lower case, the slashes of a namespace as #. */
export const fileNameOf = (object, suffix) => `${object.toLowerCase().replaceAll('/', '#')}.${suffix}`

async function sourceFiles(root) {
  const found = []
  async function walk(dir) {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) await walk(join(dir, entry.name))
      } else if (SOURCE.test(entry.name)) found.push(join(dir, entry.name))
    }
  }
  await walk(root)
  return found.sort()
}

/**
 * ABAP source with its comments and literals blanked out, offsets and lines kept: a line starting with *, the rest
 * of a line after " (outside a literal), and the content of '...', `...` and |...| literals.
 */
export function stripAbap(text) {
  return text.split('\n').map(line => {
    if (line.startsWith('*')) return ' '.repeat(line.length)
    let out = '', quote = null
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (quote) {
        if (char === quote) {
          // a doubled quote inside a literal is the quote itself
          if (line[i + 1] === quote && quote !== '|') { out += '  '; i++; continue }
          quote = null
          out += char
        } else out += ' '
      } else if (char === '"') return out + ' '.repeat(line.length - i)
      else {
        if (char === "'" || char === '`' || char === '|') quote = char
        out += char
      }
    }
    return out
  }).join('\n')
}

/** CDS / BDEF source with // and /* comments blanked out, offsets kept. */
export function stripCds(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, c => ' '.repeat(c.length))
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length

/** The statements of ABAP source (already stripped), each with its text and its offset. */
function statements(text) {
  const found = []
  let start = 0
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === '.') {
      const raw = text.slice(start, i)
      const lead = raw.length - raw.trimStart().length
      if (raw.trim()) found.push({ text: raw.trim().replace(/\s+/g, ' '), offset: start + lead })
      start = i + 1
    }
  }
  return found
}

/**
 * The names a source defines: TYPES (also chained and BEGIN OF), local classes and interfaces, each with its line.
 */
export function definedTypes(text) {
  const names = new Map()
  // inside BEGIN OF ... END OF the names are components, not types
  let depth = 0
  for (const statement of statements(text)) {
    const s = statement.text
    const line = lineAt(text, statement.offset)
    let match
    if ((match = /^types\s*:?\s*(.*)$/is.exec(s))) {
      for (const part of match[1].split(',')) {
        const words = part.trim().split(/\s+/)
        let name = null
        if (/^begin$/i.test(words[0]) && /^of$/i.test(words[1])) {
          if (depth++ === 0) name = words[2]
        } else if (/^end$/i.test(words[0]) && /^of$/i.test(words[1])) depth = Math.max(0, depth - 1)
        else if (depth === 0) name = words[0]
        if (name && /^[a-z_/][\w/]*$/i.test(name) && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), { name, line })
      }
    } else if ((match = /^(class|interface)\s+([a-z_/][\w/]*)\b/i.exec(s)) && !/\bimplementation\b/i.test(s)) {
      if (!names.has(match[2].toLowerCase())) names.set(match[2].toLowerCase(), { name: match[2], line })
    }
  }
  return names
}

/** The sections of the definition of a class in its main source: { public, protected, private } as { start, end }. */
export function classSections(text, className) {
  const definition = new RegExp(`\\bclass\\s+${className.replace(/[/]/g, '\\/')}\\s+definition\\b`, 'i').exec(text)
  if (!definition) return null
  const end = /\bendclass\s*\./i.exec(text.slice(definition.index))
  const stop = end ? definition.index + end.index : text.length
  const body = text.slice(definition.index, stop)
  const marks = [...body.matchAll(/\b(public|protected|private)\s+section\s*\./gi)]
    .map(m => ({ kind: m[1].toLowerCase(), at: definition.index + m.index }))
  const sections = {}
  marks.forEach((mark, n) => { sections[mark.kind] = { start: mark.at, end: n + 1 < marks.length ? marks[n + 1].at : stop } })
  return sections
}

/** The identifiers a section uses that name one of the given types, each with its first line. */
function usesOf(text, section, types, ownTypes) {
  const used = new Map()
  const slice = text.slice(section.start, section.end)
  for (const match of slice.matchAll(/[a-z_/][\w/]*/gi)) {
    const key = match[0].toLowerCase()
    if (!types.has(key) || ownTypes.has(key) || used.has(key)) continue
    // a component (structure-component, object->attribute) is not a type: skip what follows - or ->
    const before = slice.slice(Math.max(0, match.index - 2), match.index)
    if (before.endsWith('-') || before.endsWith('->') || before.endsWith('~')) continue
    used.set(key, lineAt(text, section.start + match.index))
  }
  return used
}

/** Check 1: local types in the visible sections of a global class. */
function checkClass(name, files, rel, errors) {
  const main = files.main && stripAbap(files.main.text)
  if (!main) return
  const sections = classSections(main, name)
  if (!sections) return
  const inDef = files.def ? definedTypes(stripAbap(files.def.text)) : new Map()
  const inImp = files.imp ? definedTypes(stripAbap(files.imp.text)) : new Map()
  const local = new Map([...inImp, ...inDef])
  if (!local.size) return
  // what the definition of the class itself declares is not local
  const own = new Map()
  for (const kind of ['public', 'protected', 'private'])
    if (sections[kind]) for (const [k, v] of definedTypes(main.slice(sections[kind].start, sections[kind].end))) own.set(k, v)
  for (const kind of ['public', 'protected']) {
    if (!sections[kind]) continue
    for (const [key, line] of usesOf(main, sections[kind], local, own)) {
      const from = inDef.has(key) ? files.def : files.imp
      errors.push({ rule: 'local-type-in-public', file: rel(files.main.path), line,
        message: `la classe globale ${name.toUpperCase()} usa nella ${kind.toUpperCase()} SECTION \`${local.get(key).name}\`, ` +
          `definito in ${basename(from.path)} (riga ${local.get(key).line}): una classe globale non può esporre un tipo locale ` +
          '(non si attiva). Spostalo nella classe (o in un\'interfaccia globale) o usalo solo nella PRIVATE SECTION' })
    }
  }
  if (sections.private) {
    const onlyImp = new Map([...inImp].filter(([k]) => !inDef.has(k)))
    for (const [key, line] of usesOf(main, sections.private, onlyImp, own))
      errors.push({ rule: 'local-imp-type-in-definition', file: rel(files.main.path), line,
        message: `la classe ${name.toUpperCase()} usa nella PRIVATE SECTION \`${onlyImp.get(key).name}\`, definito solo in ` +
          `${basename(files.imp.path)}, che viene dopo la definizione della classe: spostalo in locals_def` })
  }
}

/**
 * The statements of the body of an entity at its own level: what a block ({ ... } of a determination, a draft
 * determine action, side effects, a mapping) holds is not an operation of the entity.
 */
function topStatements(body) {
  const found = []
  let depth = 0, start = 0
  for (let i = 0; i <= body.length; i++) {
    const char = body[i]
    if (i === body.length || (depth === 0 && (char === ';' || char === '{'))) {
      found.push({ text: body.slice(start, i), index: start })
      if (char === '{') depth = 1
      start = i + 1
    } else if (char === '{') depth++
    else if (char === '}' && depth > 0 && --depth === 0) start = i + 1
  }
  return found
}

/**
 * A behavior definition: its header (kind, implementation class, draft) and its entities, each with alias,
 * implementation class, draft table, authorization, features and the operations that need a handler.
 */
export function parseBdef(source) {
  const text = stripCds(source)
  const firstDefine = text.search(/\bdefine\s+behavior\s+for\b/i)
  const head = firstDefine < 0 ? text : text.slice(0, firstDefine)
  const kind = /^\s*(managed|unmanaged|abstract|projection|interface)\b/i.exec(head)?.[1]?.toLowerCase() ?? null
  const implementation = /\bimplementation\s+in\s+class\s+([\w/]+)/i.exec(head)?.[1] ?? null
  const draft = /\bwith\s+draft\s*;/i.test(head)
  const entities = []
  const define = /\bdefine\s+behavior\s+for\s+([\w/]+)/gi
  let match
  while ((match = define.exec(text))) {
    const open = text.indexOf('{', match.index)
    if (open < 0) break
    let depth = 0, close = open
    for (; close < text.length; close++) {
      if (text[close] === '{') depth++
      else if (text[close] === '}' && --depth === 0) break
    }
    const header = text.slice(match.index, open)
    const body = text.slice(open + 1, close)
    const entity = {
      name: match[1],
      line: lineAt(text, match.index),
      alias: /\balias\s+([\w/]+)/i.exec(header)?.[1] ?? null,
      implementation: /\bimplementation\s+in\s+class\s+([\w/]+)/i.exec(header)?.[1] ?? null,
      draftTable: /\bdraft\s+table\s+([\w/]+)/i.exec(header)?.[1] ?? null,
      persistentTable: /\bpersistent\s+table\s+([\w/]+)/i.exec(header)?.[1] ?? null,
      authorization: /\bauthorization\s+master\s*\(([^)]*)\)/i.exec(header)?.[1]?.toLowerCase() ?? '',
      features: new Set([...body.matchAll(/\bfeatures\s*:\s*(instance|global)\b/gi)].map(m => m[1].toLowerCase())),
      operations: []
    }
    for (const part of topStatements(body)) {
      const statement = part.text.trim().replace(/\s+/g, ' ')
      // draft actions, projections and side effects (action X affects ...) need no handler
      if (!statement || /^(draft|use|determine)\b/i.test(statement) || /\baffects\b/i.test(statement)) continue
      const line = lineAt(text, open + 1 + part.index + (part.text.length - part.text.trimStart().length))
      let op
      if ((op = /^(?:(?:static|factory|internal|repeatable|precheck)\s+)*action\s*(?:\([^)]*\)\s*)?([\w/]+)/i.exec(statement)))
        entity.operations.push({ kind: 'action', name: op[1], line })
      else if ((op = /^(?:static\s+)?function\s*(?:\([^)]*\)\s*)?([\w/]+)/i.exec(statement)))
        entity.operations.push({ kind: 'function', name: op[1], line })
      else if ((op = /^determination\s+([\w/]+)/i.exec(statement)))
        entity.operations.push({ kind: 'determination', name: op[1], line })
      else if ((op = /^validation\s+([\w/]+)/i.exec(statement)))
        entity.operations.push({ kind: 'validation', name: op[1], line })
    }
    entities.push(entity)
    define.lastIndex = close
  }
  return { kind, implementation, draft, unmanagedSave: /\bwith\s+unmanaged\s+save\b/i.test(text),
    additionalSave: /\bwith\s+additional\s+save\b/i.test(text), entities }
}

/**
 * The handler methods of a behavior pool: each METHODS declaration (also chained) with what it is for (MODIFY,
 * READ, DETERMINE, VALIDATE, INSTANCE AUTHORIZATION, ...) and the entity~name pairs and entities it names.
 */
export function handlerMethods(text) {
  const methods = []
  for (const statement of statements(stripAbap(text))) {
    const match = /^(?:class-)?methods\s*:?\s*(.*)$/is.exec(statement.text)
    if (!match) continue
    for (const part of match[1].split(',')) {
      const upper = part.toUpperCase()
      const purpose = /\bFOR\s+(INSTANCE|GLOBAL)\s+(AUTHORIZATION|FEATURES)\b/.exec(upper)?.slice(1).join(' ') ??
        /\bFOR\s+(MODIFY|READ|DETERMINE|VALIDATE|LOCK|NUMBERING|PRECHECK)\b/.exec(upper)?.[1] ?? null
      if (!purpose) continue
      const targets = [...part.matchAll(/([\w/]+)\s*~\s*([\w/]+)/g)].map(m => ({ entity: m[1].toLowerCase(), name: m[2].toLowerCase() }))
      const entities = [...upper.matchAll(/\bFOR\s+([\w/]+)/g)].map(m => m[1].toLowerCase())
      methods.push({ purpose, targets, entities, line: lineAt(text, statement.offset) })
    }
  }
  return methods
}

const PURPOSE = { action: 'MODIFY', function: 'READ', determination: 'DETERMINE', validation: 'VALIDATE' }
const SIGNATURE = { action: 'FOR MODIFY ... FOR ACTION', function: 'FOR READ ... FOR FUNCTION', determination: 'FOR DETERMINE',
  validation: 'FOR VALIDATE' }

/** Check 2: a behavior definition against the CDS, the classes and the tables of the project. */
function checkBdef(file, index, rel, errors, unknowns) {
  const bdef = parseBdef(file.text)
  const where = line => ({ file: rel(file.path), line })
  const object = basename(file.path).replace(/\.bdef\.asbdef$/i, '')
  if (!bdef.entities.length) {
    unknowns.push({ rule: 'bdef-unread', ...where(1), message: `${object.toUpperCase()}: nessuna \`define behavior for\` letta` })
    return bdef
  }
  // the entities and their CDS; the BDEF has the name of its root entity
  bdef.entities.forEach((entity, n) => {
    const cds = index.get(fileNameOf(entity.name, 'ddls.asddls'))
    if (!cds) {
      errors.push({ rule: 'bdef-entity-without-cds', ...where(entity.line),
        message: `${entity.name}: nessuna CDS ${fileNameOf(entity.name, 'ddls.asddls')} nel progetto` })
      return
    }
    if (n === 0 && !/\bdefine\s+root\s+(view|custom|abstract|table)\b/i.test(stripCds(cds.text)))
      errors.push({ rule: 'bdef-root-not-root', ...where(entity.line),
        message: `${entity.name} è la prima entità della behavior definition ma la sua CDS non è \`define root ...\`` })
  })
  if (bdef.entities[0].name.toLowerCase() !== object.toLowerCase().replaceAll('#', '/'))
    unknowns.push({ rule: 'bdef-name', ...where(bdef.entities[0].line),
      message: `la behavior definition ${object.toUpperCase()} non ha il nome della sua entità root ${bdef.entities[0].name}` })
  // what follows is about the behavior that has an implementation: not a projection, an interface or an abstract one
  if (!['managed', 'unmanaged'].includes(bdef.kind)) {
    if (!bdef.kind) unknowns.push({ rule: 'bdef-kind', ...where(1), message: `${object.toUpperCase()}: tipo di implementazione non letto` })
    return bdef
  }
  if (bdef.unmanagedSave || bdef.additionalSave || bdef.kind === 'unmanaged')
    unknowns.push({ rule: 'bdef-saver', ...where(1), message: `${object.toUpperCase()}: ` +
      `${bdef.kind === 'unmanaged' ? 'comportamento unmanaged (create, update, delete, read, lock)' : 'save unmanaged o additional'}: ` +
      'i metodi del saver e degli handler CRUD non sono controllati' })
  const pools = new Map()
  for (const entity of bdef.entities) {
    // with draft every entity has its draft table, and the table is in the project
    if (bdef.draft) {
      if (!entity.draftTable)
        errors.push({ rule: 'bdef-draft-table', ...where(entity.line), message: `${entity.name}: la behavior è \`with draft\` ma l'entità non dice \`draft table\`` })
      else if (!index.get(fileNameOf(entity.draftTable, 'tabl.xml')))
        unknowns.push({ rule: 'bdef-draft-table-missing', ...where(entity.line),
          message: `${entity.name}: la draft table ${entity.draftTable} non è nel progetto (${fileNameOf(entity.draftTable, 'tabl.xml')}): va creata, o è solo sul sistema` })
    }
    const className = entity.implementation ?? bdef.implementation
    const needs = [...entity.operations]
    if (/\binstance\b/.test(entity.authorization)) needs.push({ kind: 'authorization', purpose: 'INSTANCE AUTHORIZATION', name: null, line: entity.line })
    if (/\bglobal\b/.test(entity.authorization)) needs.push({ kind: 'authorization', purpose: 'GLOBAL AUTHORIZATION', name: null, line: entity.line })
    for (const feature of entity.features)
      needs.push({ kind: 'features', purpose: `${feature.toUpperCase()} FEATURES`, name: null, line: entity.line })
    if (!className) {
      if (needs.length)
        errors.push({ rule: 'bdef-no-implementation', ...where(entity.line),
          message: `${entity.name}: ${needs.length} operazioni da implementare ma nessuna \`implementation in class\`` })
      continue
    }
    if (!pools.has(className.toLowerCase())) {
      const parts = ['clas.abap', 'clas.locals_def.abap', 'clas.locals_imp.abap'].map(s => index.get(fileNameOf(className, s))).filter(Boolean)
      pools.set(className.toLowerCase(), parts.length ? parts.flatMap(p => handlerMethods(p.text).map(m => ({ ...m, file: p }))) : null)
      if (!parts.length)
        errors.push({ rule: 'bdef-class-missing', ...where(entity.line),
          message: `${entity.name}: \`implementation in class ${className}\` ma ${fileNameOf(className, 'clas.abap')} non è nel progetto` })
    }
    const methods = pools.get(className.toLowerCase())
    if (!methods) continue
    const names = new Set([entity.name.toLowerCase(), entity.alias?.toLowerCase()].filter(Boolean))
    for (const need of needs) {
      if (need.kind === 'authorization' || need.kind === 'features') {
        const found = methods.filter(m => m.purpose === need.purpose)
        if (found.some(m => m.entities.some(e => names.has(e)))) continue
        if (found.length) unknowns.push({ rule: 'bdef-handler-other-entity', ...where(need.line),
          message: `${entity.name}: un metodo FOR ${need.purpose} c'è in ${className}, ma non per ${[...names].join(' / ')}` })
        else errors.push({ rule: 'bdef-handler-missing', ...where(need.line),
          message: `${entity.name}: manca in ${className} il metodo FOR ${need.purpose} (la behavior lo dichiara)` })
        continue
      }
      const purpose = PURPOSE[need.kind]
      const found = methods.filter(m => m.purpose === purpose && m.targets.some(t => t.name === need.name.toLowerCase()))
      if (found.some(m => m.targets.some(t => t.name === need.name.toLowerCase() && names.has(t.entity)))) continue
      if (found.length) unknowns.push({ rule: 'bdef-handler-other-entity', ...where(need.line),
        message: `${entity.name}: ${need.kind} ${need.name} ha un metodo in ${className}, ma per ` +
          `${found.flatMap(m => m.targets.filter(t => t.name === need.name.toLowerCase()).map(t => `${t.entity}~${t.name}`)).join(', ')}, ` +
          `non per ${[...names].join(' / ')}` })
      else errors.push({ rule: 'bdef-handler-missing', ...where(need.line),
        message: `${entity.name}: ${need.kind} ${need.name} senza metodo in ${className} ` +
          `(METHODS ... ${SIGNATURE[need.kind]} ${entity.alias ?? entity.name}~${need.name})` })
    }
  }
  return bdef
}

export async function check(root) {
  const paths = await sourceFiles(root)
  const files = await Promise.all(paths.map(async path => ({ path, text: await readFile(path, 'utf8') })))
  const index = new Map(files.map(f => [basename(f.path).toLowerCase(), f]))
  const rel = path => relative(root, path)
  const errors = [], unknowns = []
  const classes = new Map()
  for (const file of files) {
    const match = /^(.+)\.clas(?:\.(locals_def|locals_imp))?\.abap$/i.exec(basename(file.path))
    if (!match) continue
    const name = match[1].replaceAll('#', '/')
    if (!classes.has(name.toLowerCase())) classes.set(name.toLowerCase(), { name })
    classes.get(name.toLowerCase())[{ locals_def: 'def', locals_imp: 'imp' }[match[2]?.toLowerCase()] ?? 'main'] = file
  }
  for (const entry of classes.values()) checkClass(entry.name, entry, rel, errors)
  const bdefs = files.filter(f => /\.bdef\.asbdef$/i.test(f.path))
  for (const file of bdefs) checkBdef(file, index, rel, errors, unknowns)
  for (const xml of files.filter(f => /\.bdef\.xml$/i.test(f.path)))
    if (!index.has(basename(xml.path).toLowerCase().replace(/\.xml$/, '.asbdef')))
      unknowns.push({ rule: 'bdef-source-missing', file: rel(xml.path), line: 1,
        message: `${basename(xml.path)} senza il sorgente .bdef.asbdef: la behavior definition non è stata letta` })
  const cds = files.filter(f => /\.ddls\.asddls$/i.test(f.path)).length
  return { project: root, classes: classes.size, bdefs: bdefs.length, cds, errors, unknowns, failed: errors.length > 0 }
}

export function report(result) {
  const item = f => `- \`${f.file}:${f.line}\` · ${f.rule} · ${f.message}`
  const lines = ['# Controllo ABAP offline', '',
    `Progetto \`${result.project}\`: ${result.classes} classi, ${result.bdefs} behavior definition, ${result.cds} CDS lette ` +
    '(formato abapGit). Controlla quello che abaplint offline non vede: tipi locali nella parte pubblica di una classe ' +
    'globale; coerenza della behavior definition con CDS, classe di implementazione, handler e draft table.', '']
  lines.push(`## Errori (${result.errors.length})`, '')
  lines.push(...(result.errors.length ? result.errors.map(item) : ['Nessuno.']), '')
  lines.push(`## Da verificare (${result.unknowns.length})`, '')
  lines.push(...(result.unknowns.length ? result.unknowns.map(item) : ['Niente.']), '')
  lines.push(result.failed ? 'Esito: **KO**, errori da correggere prima dell\'attivazione.'
    : `Esito: **OK**${result.unknowns.length ? ', con punti da verificare sul sistema o a mano' : ''}.`)
  if (!result.classes && !result.bdefs) lines.push('', 'Nessun sorgente ABAP in formato abapGit trovato: controlla --project.')
  return lines.join('\n')
}

export async function main(argv = process.argv.slice(2), { log = console.log } = {}) {
  const options = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') options.json = true
    else if (['--project', '--output'].includes(argv[i])) {
      if (argv[i + 1] === undefined) { log(`${argv[i]} needs a value`); return 2 }
      options[argv[i].slice(2)] = argv[++i]
    } else if (argv[i] === '--help' || argv[i] === '-h') options.help = true
    else { log(`unknown argument ${argv[i]}`); return 2 }
  }
  if (options.help) {
    log('node abap-offline-check.mjs --project <dir> [--output <file>] [--json]')
    return 0
  }
  // a folder that is not there would read as no sources and pass the gate: a wrong --project is an error
  if (!statSync(resolve(options.project ?? '.'), { throwIfNoEntry: false })?.isDirectory()) {
    log(`--project ${options.project} is not a folder`)
    return 2
  }
  const result = await check(resolve(options.project ?? '.'))
  const text = options.json ? JSON.stringify(result, null, 2) : report(result)
  if (options.output) {
    await mkdir(dirname(resolve(options.output)), { recursive: true })
    await writeFile(resolve(options.output), text + '\n')
  }
  log(text)
  return result.failed ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  main().then(code => { process.exitCode = code }, error => { console.error(error.message); process.exitCode = 2 })
