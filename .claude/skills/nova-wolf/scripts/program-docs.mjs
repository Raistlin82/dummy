#!/usr/bin/env node
/**
 * The documents of a custom code program, assembled from its data (docs/wolf/18, sections 4.1 and 4.3): the steps
 * CC_AS_IS_REPORT, CCW_PATTERN_DOCS and CC_FINAL_REPORT run it in the repository of the program. No model and no
 * network: the tables and the numbers come from the files of the program; what a person or the agent writes (the
 * summary, the risks, the recommendations) stays between two markers and is never touched.
 *
 *   node program-docs.mjs as-is    [--root <repository>] [--lang it|en] [--program <title>] [--check]
 *   node program-docs.mjs patterns [--root <folder>] [--file docs/patterns/patterns.json] [--out <folder>] [--lang it|en] [--check]
 *   node program-docs.mjs final    [--root <repository>] [--lang it|en] [--program <title>] [--check]
 *   node program-docs.mjs deliver <file.md> [--root <repository>] [--brand docs/brand] [--out docs/deliverables]
 *        [--title <title>] [--program <title>] [--version 1.0] [--date <YYYY-MM-DD>] [--lang it|en] [--no-pdf] [--check]
 *
 * as-is     writes or updates docs/program/as-is.md, with its fixed index: summary for who decides; system, release
 *           and landscape; perimeter and register of the objects; real usage and retirement candidates; modifications
 *           of SAP code and their decision; ATC findings by priority and by group; Clean Core levels at the start, by
 *           package; estimate; risks and open points; AS-IS diagrams; what could not be detected, and why. It reads,
 *           under docs/program/: system-info.md, perimeter.md, register.json (else objects.json), usage.md,
 *           retirement.md, modifications.md, the latest worklist/<date>.json ({ variant, variantSource, findings:
 *           [{ object, package, check, message, priority, quickfix, note }] }, or the array of the findings alone),
 *           estimate/summary.md, volumes.json and diagrams/as-is-*.png. A section whose data are missing says which
 *           file is missing and which step writes it: it is never left empty and nothing is invented.
 * patterns  writes one <pattern>.md per correction pattern, and the index README.md, beside the file the runtime
 *           writes (wolf pattern-docs), --file:
 *             { "wave": { "id", "title" }, "patterns": [ { "id", "version", "check", "message", "correction",
 *               "writtenBy", "decidedBy", "decidedAt", "objects": [ { "type", "name", "package", "line", "outcome" } ] } ] }
 *           A pattern may also carry "name" (the name of its file), "examples" ([{ before, after, note }]),
 *           "exclusions", "verification" and "decision" (why it was approved). Any field may be missing or null: the
 *           document says it is not recorded. The file of a pattern is named from its id and version.
 * final     writes or updates docs/program/final-report.md, with its fixed index: summary; what was done, wave by
 *           wave; KPIs before and after; correction patterns applied; approved deviations and what remains;
 *           governance after the program; TO-BE diagrams beside the AS-IS ones; lessons. It reads the volumes exported
 *           from the configurator, docs/program/volumes.json:
 *             { "program": { "title", "type" }, "waves": [ { "title", "folder", "state" } ],
 *               "history": [ { "measure", "value", "measuredAt", "step", "wave" } ] }
 *           (one row per measurement, as DevelopmentVolumeHistory keeps them; "wave" is the title of the wave that
 *           measured it, null for the program), the register at the start (register.json) and at the end
 *           (register-final.json), each wave's <folder>/docs/report.md, docs/lessons.md and docs/patterns/patterns.json,
 *           backlog-clean-core.md, governance.md, atc-governance.md and the diagrams.
 * deliver   makes the Word and the PDF of a Markdown document in docs/deliverables/, with the brand of the team
 *           (docs/brand/brand.json, as the guides): a cover with title, program, date and version, header and footer,
 *           headings, paragraphs, lists, tables, code, images and bold. The PDF needs LibreOffice (soffice): without it
 *           one line says so and the Word is still made. Needs once: npm ci --prefix <skill>/scripts/guide.
 *
 * The parts written by a person or by the agent are between <!-- author:<name>:start --> and <!-- author:<name>:end -->.
 * --check writes nothing: the document is there, has every section of its index, no section and no part between
 * markers is empty, and it says what the data say now. One line per problem, then "problems: N".
 * Exit 0 when written, or checked with no problem; 1 with problems; 2 on an error.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { VIEWS } from './program-diagrams.mjs'
import { FILES, LEVELS, MODIFICATIONS, NO_PACKAGE, RETIRING, USAGES, firstAndLast, loadRegister, normalizeVolumes, packagesOf,
  perimeterOf, programOf, readJson, readText, recorded, shareAB, statsOf } from './lib/program-data.mjs'

export const LANGUAGES = ['it', 'en']
/** The parts of each document a person or the agent writes, by the number of their section. */
export const AUTHORED = {
  'as-is': { summary: 1, recommendations: 1, risks: 9, limits: 11 },
  final: { summary: 1, deviations: 5, lessons: 8 }
}
const DOCUMENTS = { 'as-is': 'docs/program/as-is.md', final: 'docs/program/final-report.md' }

// ---- the words of the documents: Italian and English side by side, so the two say the same things

const NAMES = {
  status: {
    it: { TO_ANALYZE: 'Da analizzare', TO_ADAPT: 'Da adeguare', IN_WAVE: 'In wave', RETIRE_CANDIDATE: 'Candidato al ritiro', QUARANTINE: 'In quarantena',
      RETIRE_APPROVED: 'Cancellazione approvata', ADAPTED: 'Adeguato', NO_CHANGE: 'Nessuna modifica', EXEMPT: 'Esente', RETIRED: 'Ritirato' },
    en: { TO_ANALYZE: 'To analyze', TO_ADAPT: 'To adapt', IN_WAVE: 'In a wave', RETIRE_CANDIDATE: 'Retirement candidate', QUARANTINE: 'In quarantine',
      RETIRE_APPROVED: 'Deletion approved', ADAPTED: 'Adapted', NO_CHANGE: 'No change', EXEMPT: 'Exempt', RETIRED: 'Retired' }
  },
  usage: {
    it: { USED: 'Usato', LIKELY_UNUSED: 'Probabilmente non usato', UNUSED: 'Non usato', INDETERMINATE: 'Uso non determinabile', none: 'Non rilevato' },
    en: { USED: 'Used', LIKELY_UNUSED: 'Probably unused', UNUSED: 'Unused', INDETERMINATE: 'Usage undetermined', none: 'Not recorded' }
  },
  outcome: {
    it: { QUEUED: 'In lotto', PROPOSED: 'Proposta', NOT_APPLICABLE: 'Non si applica', UNSURE: 'Incerta', FAILED: 'Non riuscita', EXCEPTION: 'Eccezione',
      OUTDATED: 'Superata', APPLYING: 'In scrittura', APPLIED: 'Scritta', VERIFIED: 'Verificata', REVERTED: 'Annullata' },
    en: { QUEUED: 'In a batch', PROPOSED: 'Proposed', NOT_APPLICABLE: 'Does not apply', UNSURE: 'Unsure', FAILED: 'Failed', EXCEPTION: 'Exception',
      OUTDATED: 'Outdated', APPLYING: 'Applying', APPLIED: 'Applied', VERIFIED: 'Verified', REVERTED: 'Reverted' }
  },
  view: {
    it: { landscape: 'Landscape del programma', 'custom-code-map': 'Mappa del codice custom', waves: 'Wave del programma', 'clean-core': 'Livelli Clean Core per package' },
    en: { landscape: 'Landscape of the program', 'custom-code-map': 'Custom code map', waves: 'Waves of the program', 'clean-core': 'Clean Core levels by package' }
  }
}
const INDEX = {
  'as-is': {
    it: ['Sintesi per chi decide', 'Sistema, release e landscape', 'Perimetro e registro degli oggetti', 'Uso reale e candidati al ritiro',
      'Modifiche al codice SAP e loro decisione', 'Finding ATC per priorità e per gruppo', 'Livelli Clean Core di partenza, per package',
      'Stima (refactoring Clean Core)', 'Rischi e punti aperti', 'Diagrammi AS-IS', 'Che cosa non è stato possibile rilevare, e perché'],
    en: ['Summary for who decides', 'System, release and landscape', 'Perimeter and register of the objects', 'Real usage and retirement candidates',
      'Modifications of SAP code and their decision', 'ATC findings by priority and by group', 'Clean Core levels at the start, by package',
      'Estimate (Clean Core refactoring)', 'Risks and open points', 'AS-IS diagrams', 'What could not be detected, and why']
  },
  final: {
    it: ['Sintesi', 'Che cosa è stato fatto, wave per wave', 'KPI prima e dopo', 'Pattern di correzione applicati', 'Deviazioni approvate e ciò che resta',
      'Governance dopo il programma', 'Diagrammi TO-BE accanto agli AS-IS', 'Lezioni'],
    en: ['Summary', 'What was done, wave by wave', 'KPIs before and after', 'Correction patterns applied', 'Approved deviations and what remains',
      'Governance after the program', 'TO-BE diagrams beside the AS-IS ones', 'Lessons']
  }
}

// ---- Markdown: tables, a document of another step under a heading, the parts between markers

const cellOf = value => String(value ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim()
/** A Markdown table; the columns named in `right` hold numbers. */
export function table(head, rows, right = []) {
  return [`| ${head.map(cellOf).join(' | ')} |`, `|${head.map((_, n) => right.includes(n) ? '---:' : '---').join('|')}|`,
    ...rows.map(row => `| ${row.map(cellOf).join(' | ')} |`)].join('\n')
}
/** The text of a document another step wrote, to go under a heading of `level`: without its title, its headings moved down. */
export function embed(markdown, level) {
  const lines = String(markdown).replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '').split('\n')
  const first = lines.findIndex(line => line.trim())
  if (first >= 0 && /^#\s/.test(lines[first])) lines.splice(0, first + 1)
  let fence = false
  const depths = lines.filter(line => { if (/^(```|~~~)/.test(line.trim())) fence = !fence; return !fence && /^#{1,6}\s/.test(line) }).map(line => line.match(/^#+/)[0].length)
  const shift = depths.length ? level - Math.min(...depths) : 0
  fence = false
  return lines.map(line => {
    if (/^(```|~~~)/.test(line.trim())) fence = !fence
    return !fence && /^#{1,6}\s/.test(line) ? line.replace(/^#+/, marks => '#'.repeat(Math.min(6, Math.max(1, marks.length + shift)))) : line
  }).join('\n').trim()
}
const MARK = key => [`<!-- author:${key}:start -->`, `<!-- author:${key}:end -->`]
/** The parts between markers of a document: Map name → text. */
export function authoredOf(text) {
  const parts = new Map()
  for (const [, key, body] of String(text ?? '').matchAll(/<!-- author:([a-z-]+):start -->([\s\S]*?)<!-- author:\1:end -->/g)) parts.set(key, body.trim())
  return parts
}
const withoutComments = text => String(text).replace(/<!--[\s\S]*?-->/g, '')

/** What the two kinds of documents share: the language, the missing data, the parts between markers. */
function writer(lang, kept) {
  const t = (it, en) => lang === 'it' ? it : en
  const missing = []
  return {
    t, missing,
    /** A datum that is missing: the sentence for its section, and a line for the last one. */
    miss(what, file, step) {
      missing.push({ what, file, step })
      return t(`Questo dato manca: ${what}. Lo scrive il passo \`${step}\`, nel file \`${file}\`.`,
        `This datum is missing: ${what}. The step \`${step}\` writes it, in the file \`${file}\`.`)
    },
    /** A part a person or the agent writes: what is there stays. */
    part(key, hint) {
      const [start, end] = MARK(key)
      return `<!-- ${hint} -->\n${start}\n${kept.get(key) ? `${kept.get(key)}\n` : ''}${end}`
    },
    number: value => value === null || value === undefined ? t('non rilevato', 'not recorded')
      : Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', t(',', '.')),
    date: value => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? '')); return m ? t(`${m[3]}/${m[2]}/${m[1]}`, `${m[1]}-${m[2]}-${m[3]}`) : null },
    packageName: name => name === NO_PACKAGE ? t('(senza package)', '(without package)') : name
  }
}
const assemble = (kind, lang, title, program, intro, sections, t) => [
  `<!-- program-docs.mjs ${kind} · ${lang} · ${t('il testo tra i marcatori author resta a una nuova esecuzione, il resto è riscritto dai dati',
    'the text between the author markers is kept at a new run, the rest is written again from the data')} -->`,
  `# ${title}`, ...(program ? [`**${t('Programma', 'Program')}:** ${program}`] : []), intro,
  ...sections.flatMap((body, n) => [`## ${n + 1}. ${INDEX[kind][lang][n]}`, body.filter(Boolean).join('\n\n')])
].join('\n\n') + '\n'

// ---- the data of a program for its documents

/** The latest worklist of the ATC (docs/program/worklist/<date>.json): { file, variant, variantSource, findings }, or null. */
export function loadWorklist(root) {
  const dir = resolve(root, 'docs/program/worklist')
  const file = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json')).sort().pop() : null
  if (!file) return null
  const data = readJson(join(dir, file))
  const rows = Array.isArray(data) ? data : data?.findings ?? data?.rows ?? data?.worklist ?? data?.items
  if (!Array.isArray(rows)) throw new Error(`docs/program/worklist/${file}: not a worklist (the findings as an array, or { findings: [...] })`)
  const text = value => value === null || value === undefined || value === '' ? null : String(value)
  return {
    file: `docs/program/worklist/${file}`, variant: text(data?.variant), variantSource: text(data?.variantSource),
    findings: rows.map(r => ({ object: text(r.object) ?? ([r.type, r.name].filter(Boolean).join(' ') || null), package: text(r.package),
      check: text(r.check ?? r.checkTitle), message: text(r.message ?? r.messageTitle), priority: Number.isFinite(Number(r.priority)) && r.priority !== null && r.priority !== '' ? Number(r.priority) : null,
      quickfix: Boolean(r.quickfix ?? r.hasQuickfix), note: text(r.note ?? r.sapNote) }))
  }
}

/** The pages of the PNG of a diagram, relative to docs/program: ["diagrams/as-is-waves.png"], or -1, -2 for more pages. */
function diagramImages(root, mode, view) {
  const dir = resolve(root, 'docs/program/diagrams')
  if (!existsSync(dir)) return []
  const pages = readdirSync(dir).filter(f => new RegExp(`^${mode}-${view}(-\\d+)?\\.png$`).test(f))
    .sort((a, b) => (Number(/-(\d+)\.png$/.exec(a)?.[1]) || 0) - (Number(/-(\d+)\.png$/.exec(b)?.[1]) || 0))
  return pages.map(f => `diagrams/${f}`)
}
const levelCells = (counts, w) => [...LEVELS.map(level => counts[level]), counts.none, shareAB(counts) === null ? w.t('n.r.', 'n.r.') : `${shareAB(counts)}%`]
const sumOf = (list, key) => list.reduce((sum, item) => sum + (item[key] ?? 0), 0)

// ---- the AS-IS analysis

/** The AS-IS analysis of a program as Markdown: { text, missing }. `existing` is the document as it is, for its authored parts. */
export function asIsDocument({ root = '.', lang = 'it', program, existing } = {}) {
  const w = writer(lang, authoredOf(existing))
  const { t } = w
  const at = file => resolve(root, file)
  const register = loadRegister(root)
  const objects = register?.objects ?? []
  const perimeter = perimeterOf(objects)
  const packages = packagesOf(objects)
  const total = statsOf(perimeter)
  const volumes = existsSync(at(FILES.volumes)) ? normalizeVolumes(readJson(at(FILES.volumes)), FILES.volumes) : null
  const title = program ?? programOf(root).title ?? volumes?.program?.title ?? null
  const type = programOf(root).type ?? volumes?.program?.type ?? null
  const file = name => readText(at(`docs/program/${name}`))
  const detail = (text, source) => [t(`Il dettaglio che segue è quello rilevato nel file \`${source}\`.`, `The detail that follows is the one recorded in the file \`${source}\`.`), embed(text, 3)]
  const noRegister = () => w.miss(t('il registro degli oggetti del programma', 'the register of the objects of the program'), FILES.register, 'CC_PERIMETER')

  // 2. system, release and landscape
  const systemInfo = file('system-info.md')
  const system = systemInfo ? [t('Il sistema del programma, la sua release e i sistemi collegati sono quelli rilevati dal passo `CC_SYSTEM_READY`.',
    'The system of the program, its release and the connected systems are those recorded by the step `CC_SYSTEM_READY`.'), embed(systemInfo, 3)]
    : [w.miss(t('il sistema del programma, la sua release e il landscape', 'the system of the program, its release and the landscape'), FILES.systemInfo, 'CC_SYSTEM_READY')]

  // 3. perimeter and register
  const scope = []
  if (!register) scope.push(noRegister())
  else {
    const outside = objects.filter(o => MODIFICATIONS.has(o.type))
    scope.push(t(`Il registro degli oggetti del programma conta **${total.objects}** oggetti in **${packages.size}** package.`,
      `The register of the objects of the program counts **${total.objects}** objects in **${packages.size}** packages.`) +
      (outside.length ? ' ' + t(`Fuori dal perimetro tiene anche le modifiche al codice SAP (${outside.filter(o => o.type === 'MOD').length}) e le note SAP (${outside.filter(o => o.type === 'NOTE').length}), descritte nella sezione 5.`,
        `Outside the perimeter it also keeps the modifications of SAP code (${outside.filter(o => o.type === 'MOD').length}) and the SAP Notes (${outside.filter(o => o.type === 'NOTE').length}), described in section 5.`) : ''))
    if (Object.keys(total.status).length) scope.push(`### ${t('Oggetti per stato', 'Objects by status')}`,
      table([t('Stato', 'Status'), t('Oggetti', 'Objects')], Object.keys(NAMES.status[lang]).filter(s => total.status[s]).map(s => [NAMES.status[lang][s], total.status[s]]), [1]))
    const types = new Map()
    for (const o of perimeter) types.set(o.type, (types.get(o.type) ?? 0) + 1)
    scope.push(`### ${t('Oggetti per tipo', 'Objects by type')}`, table([t('Tipo', 'Type'), t('Oggetti', 'Objects')], [...types].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)), [1]))
    scope.push(`### ${t('Oggetti per package', 'Objects by package')}`, table([t('Package', 'Package'), t('Oggetti', 'Objects'), t('Finding aperti', 'Open findings')],
      [...packages.values()].map(p => [w.packageName(p.package), p.objects, w.number(p.findings)]), [1, 2]))
  }
  const perimeterText = file('perimeter.md')
  scope.push(`### ${t('Perimetro', 'Perimeter')}`, ...(perimeterText ? detail(perimeterText, 'docs/program/perimeter.md')
    : [w.miss(t('il perimetro del programma, con namespace, package ed esclusioni', 'the perimeter of the program, with namespaces, packages and exclusions'), 'docs/program/perimeter.md', 'CC_PERIMETER')]))

  // 4. real usage and retirement candidates
  const usage = []
  if (register && recorded(total.usage)) {
    usage.push(t('La classe d\'uso di ogni oggetto viene dai dati di uso della produzione, incrociati con i where-used statici. Una classe «non usato» è un possibile candidato al ritiro, non una decisione.',
      'The usage class of each object comes from the usage data of production, crossed with the static where-used. A class "unused" is a possible retirement candidate, not a decision.'),
    table([t('Classe d\'uso', 'Usage class'), t('Oggetti', 'Objects')], [...USAGES, 'none'].map(u => [NAMES.usage[lang][u], total.usage[u]]), [1]),
    `### ${t('Uso per package', 'Usage by package')}`,
    table([t('Package', 'Package'), ...[...USAGES, 'none'].map(u => NAMES.usage[lang][u])], [...packages.values()].map(p => [w.packageName(p.package), ...[...USAGES, 'none'].map(u => p.usage[u])]), [1, 2, 3, 4, 5]))
  } else usage.push(register ? w.miss(t('la classe d\'uso degli oggetti', 'the usage class of the objects'), FILES.register, 'CC_USAGE') : noRegister())
  const usageText = file('usage.md')
  usage.push(...(usageText ? detail(usageText, 'docs/program/usage.md')
    : [w.miss(t('il periodo osservato e i limiti dei dati di uso', 'the observed period and the limits of the usage data'), 'docs/program/usage.md', 'CC_USAGE')]))
  usage.push(`### ${t('Candidati al ritiro', 'Retirement candidates')}`)
  const retiring = perimeter.filter(o => RETIRING.has(o.status) || o.status === 'RETIRED')
  if (retiring.length) usage.push(table([t('Oggetto', 'Object'), t('Package', 'Package'), t('Classe d\'uso', 'Usage class'), t('Stato', 'Status'), t('Nota', 'Note')],
    retiring.map(o => [`${o.type} ${o.name}`, w.packageName(o.package ?? NO_PACKAGE), NAMES.usage[lang][o.usage ?? 'none'], NAMES.status[lang][o.status] ?? o.status, o.note ?? ''])))
  else if (register) usage.push(t('Nel registro nessun oggetto è candidato al ritiro.', 'No object of the register is a retirement candidate.'))
  const retirementText = file('retirement.md')
  usage.push(...(retirementText ? detail(retirementText, 'docs/program/retirement.md')
    : [w.miss(t('le evidenze dei candidati al ritiro', 'the evidence of the retirement candidates'), 'docs/program/retirement.md', 'CC_RETIRE_CANDIDATES')]))

  // 5. modifications of SAP code
  const mods = []
  const entries = objects.filter(o => MODIFICATIONS.has(o.type))
  const modsText = file('modifications.md')
  if (entries.length) mods.push(t('Le modifiche al codice SAP e le note SAP del registro stanno fuori dal perimetro e non entrano in una wave. La decisione su ognuna la prende una persona.',
    'The modifications of SAP code and the SAP Notes of the register are outside the perimeter and enter no wave. A person takes the decision on each one.'),
  table([t('Voce', 'Entry'), t('Tipo', 'Type'), t('Categoria', 'Category'), t('Proposta', 'Proposal'), t('Decisione', 'Decision'), 'Owner', t('Scadenza', 'Expiry'), t('Stato', 'Status')],
    entries.map(o => [o.name, o.type === 'MOD' ? t('Modifica', 'Modification') : t('Nota SAP', 'SAP Note'), o.category ?? '', o.proposal ?? '',
      o.decided ?? t('da decidere', 'to decide'), o.owner ?? '', w.date(o.expiry) ?? '', NAMES.status[lang][o.status] ?? o.status ?? ''])))
  if (modsText) mods.push(...detail(modsText, 'docs/program/modifications.md'))
  if (!entries.length && !modsText) mods.push(w.miss(t('l\'inventario delle modifiche al codice SAP e delle note SAP', 'the inventory of the modifications of SAP code and of the SAP Notes'),
    'docs/program/modifications.md', 'CC_MOD_INVENTORY'))

  // 6. ATC findings
  const findings = []
  const worklist = loadWorklist(root)
  if (worklist) {
    const rows = worklist.findings
    findings.push(t(`La worklist dell'ATC conta **${rows.length}** finding` + (worklist.variant ? `, con la variante \`${worklist.variant}\`` : '') + '.',
      `The worklist of the ATC counts **${rows.length}** findings` + (worklist.variant ? `, with the variant \`${worklist.variant}\`` : '') + '.') +
      (total.findings !== null && total.findings !== rows.length ? ' ' + t(`Il registro degli oggetti ne conta ${total.findings}: la differenza è da verificare.`,
        `The register of the objects counts ${total.findings}: the difference is to verify.`) : ''))
    const priorities = [...new Set(rows.map(r => r.priority))].sort((a, b) => (a ?? 99) - (b ?? 99))
    findings.push(`### ${t('Finding per priorità', 'Findings by priority')}`, table([t('Priorità', 'Priority'), t('Finding', 'Findings'), t('Con quick fix SAP', 'With an SAP quick fix')],
      priorities.map(p => [p ?? t('non rilevata', 'not recorded'), rows.filter(r => r.priority === p).length, rows.filter(r => r.priority === p && r.quickfix).length]), [1, 2]))
    const groups = new Map()
    for (const r of rows) {
      const key = `${r.check ?? ''}\u0000${r.message ?? ''}`
      if (!groups.has(key)) groups.set(key, { check: r.check, message: r.message, priority: r.priority, findings: 0, objects: new Set(), quickfix: 0 })
      const g = groups.get(key)
      g.findings++; g.objects.add(r.object); g.quickfix += r.quickfix ? 1 : 0
      if (r.priority !== null && (g.priority === null || r.priority < g.priority)) g.priority = r.priority
    }
    const sorted = [...groups.values()].sort((a, b) => b.findings - a.findings || (`${a.check}${a.message}` < `${b.check}${b.message}` ? -1 : 1))
    const shown = sorted.slice(0, 40), rest = sorted.slice(40)
    findings.push(`### ${t('Finding per gruppo', 'Findings by group')}`,
      t('Un gruppo riunisce i finding con lo stesso controllo e lo stesso messaggio: è una correzione che si ripete su più oggetti.',
        'A group collects the findings with the same check and the same message: a correction that repeats across objects.'),
      table([t('Controllo', 'Check'), t('Messaggio', 'Message'), t('Priorità', 'Priority'), t('Finding', 'Findings'), t('Oggetti', 'Objects'), t('Con quick fix SAP', 'With an SAP quick fix')],
        [...shown.map(g => [g.check ?? '', g.message ?? '', g.priority ?? '', g.findings, g.objects.size, g.quickfix]),
          ...(rest.length ? [[t(`Altri ${rest.length} gruppi`, `${rest.length} more groups`), '', '', sumOf(rest, 'findings'), '', sumOf(rest, 'quickfix')]] : [])], [2, 3, 4, 5]))
  } else findings.push(w.miss(t('la worklist dell\'ATC, con i finding per priorità e per gruppo', 'the worklist of the ATC, with the findings by priority and by group'),
    'docs/program/worklist/<data>.json', 'CC_ATC_RUN'))
  if (total.findings !== null) findings.push(`### ${t('Finding aperti per package', 'Open findings by package')}`,
    table([t('Package', 'Package'), t('Finding aperti', 'Open findings')], [...[...packages.values()].filter(p => p.findings !== null).map(p => [w.packageName(p.package), p.findings]),
      [t('**Totale**', '**Total**'), `**${total.findings}**`]], [1]))

  // 7. Clean Core levels at the start
  const levels = []
  if (register && recorded(total.levelStart)) levels.push(
    t('Il livello Clean Core di partenza di ogni oggetto viene dai finding dell\'ATC. La quota A+B è calcolata sugli oggetti con un livello.',
      'The Clean Core level of each object at the start comes from the findings of the ATC. The share A+B is computed on the objects with a level.'),
    table([t('Package', 'Package'), t('Oggetti', 'Objects'), 'A', 'B', 'C', 'D', t('Non determinato', 'Not determined'), t('Non rilevato', 'Not recorded'), 'A+B'],
      [...[...packages.values()].map(p => [w.packageName(p.package), p.objects, ...levelCells(p.levelStart, w)]),
        [t('**Totale**', '**Total**'), `**${total.objects}**`, ...levelCells(total.levelStart, w).map(v => `**${v}**`)]], [1, 2, 3, 4, 5, 6, 7, 8]))
  else levels.push(register ? w.miss(t('il livello Clean Core di partenza degli oggetti', 'the Clean Core level of the objects at the start'), FILES.register,
    type === 'CC_REFACTOR_PROGRAM' ? 'CR_DISCOVER' : 'CC_ATC_RUN') : noRegister())

  // 8. estimate
  const estimate = []
  const summary = file('estimate/summary.md')
  if (summary) {
    const effort = ['EFFORT_LOW_PD', 'EFFORT_HIGH_PD'].map(m => firstAndLast(volumes?.history ?? [], m)?.first.value ?? null)
    estimate.push(t('La stima del refactoring Clean Core viene dalla somma per cluster e per livello del passo `CR_ESTIMATE`.',
      'The estimate of the Clean Core refactoring comes from the sum by cluster and by level of the step `CR_ESTIMATE`.') +
      (effort[0] !== null && effort[1] !== null ? ' ' + t(`Nei volumi del programma l'effort stimato va da ${w.number(effort[0])} a ${w.number(effort[1])} giorni-persona.`,
        `In the volumes of the program the estimated effort goes from ${w.number(effort[0])} to ${w.number(effort[1])} person-days.`) : ''), embed(summary, 3))
  } else estimate.push((type === 'CC_S4_PROGRAM' ? t('Un programma di adeguamento a SAP S/4HANA non stima il refactoring Clean Core: la stima appartiene al programma di refactoring dello stesso sistema. ',
    'A program that adapts to SAP S/4HANA does not estimate the Clean Core refactoring: the estimate belongs to the refactoring program of the same system. ') : '') +
    w.miss(t('la stima a intervalli del refactoring Clean Core', 'the estimate by ranges of the Clean Core refactoring'), 'docs/program/estimate/summary.md', 'CR_ESTIMATE'))

  // 10. diagrams
  const diagrams = []
  for (const view of VIEWS) {
    const images = diagramImages(root, 'as-is', view)
    if (images.length) diagrams.push(`### ${NAMES.view[lang][view]}`, ...images.map(image => `![${NAMES.view[lang][view]}](${image})`))
    else if (existsSync(at(`docs/program/diagrams/as-is-${view}.drawio`))) diagrams.push(`### ${NAMES.view[lang][view]}`,
      w.miss(t(`l'immagine del diagramma \`diagrams/as-is-${view}.drawio\`, che si apre in draw.io`, `the image of the diagram \`diagrams/as-is-${view}.drawio\`, which opens in draw.io`),
        `docs/program/diagrams/as-is-${view}.png`, 'CC_ARCH_DIAGRAMS'))
    else diagrams.push(`### ${NAMES.view[lang][view]}`, w.miss(t(`il diagramma «${NAMES.view[lang][view]}»`, `the diagram "${NAMES.view[lang][view]}"`),
      `docs/program/diagrams/as-is-${view}.drawio`, 'CC_ARCH_DIAGRAMS'))
  }
  if (diagrams.some(line => line.startsWith('!['))) diagrams.unshift(t('I diagrammi sono generati dai dati del programma e controllati contro di essi.',
    'The diagrams are generated from the data of the program and checked against them.'))

  // 11. what could not be detected: every missing datum of the sections above
  const limits = [w.missing.length ? t('I dati che seguono non sono nel repository del programma. Per ognuno sono indicati il file atteso e il passo che lo scrive.',
    'The data that follow are not in the repository of the program. For each one the expected file and the step that writes it are named.')
    : t('Tutti i dati previsti dall\'indice sono nel repository del programma.', 'All the data the index asks for are in the repository of the program.'),
  w.missing.map(m => `- ${m.what[0].toUpperCase()}${m.what.slice(1)}: \`${m.file}\` (${t('passo', 'step')} \`${m.step}\`).`).join('\n'),
  w.part('limits', t('Perché i dati qui sopra mancano, e che cosa non si è potuto rilevare per altre ragioni: lo scrive chi ha condotto l\'analisi.',
    'Why the data above are missing, and what could not be detected for other reasons: written by who carried out the analysis.'))]

  const text = assemble('as-is', lang, t('Analisi AS-IS del codice custom', 'AS-IS analysis of the custom code'), title,
    t('Questo documento descrive la situazione di partenza del codice custom, prima del piano delle wave. Le tabelle e i numeri vengono dai dati del programma. La sintesi, le raccomandazioni e i rischi sono scritti da chi ha condotto l\'analisi.',
      'This document describes the situation of the custom code at the start, before the plan of the waves. The tables and the numbers come from the data of the program. The summary, the recommendations and the risks are written by who carried out the analysis.'),
    [[w.part('summary', t('La sintesi per chi decide: lo stato del codice custom in poche frasi, con i numeri che contano.', 'The summary for who decides: the state of the custom code in a few sentences, with the numbers that matter.')),
      `### ${t('Raccomandazioni', 'Recommendations')}`,
      w.part('recommendations', t('Le raccomandazioni: che cosa conviene fare, in quale ordine.', 'The recommendations: what is worth doing, in which order.'))],
    system, scope, usage, mods, findings, levels, estimate,
    [w.part('risks', t('I rischi e i punti ancora aperti, ognuno con chi lo deve chiudere.', 'The risks and the points still open, each with who has to close it.'))],
    diagrams, limits], t)
  return { text, missing: w.missing }
}

// ---- the correction patterns

const slug = text => String(text ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '')
/**
 * The correction patterns of a file of the runtime (wolf pattern-docs), with a name for the document of each one:
 * its "name", else its id and version, else its check and message. Two patterns never share a name.
 */
export function patternsOf(data, file = 'the patterns') {
  if (!data || typeof data !== 'object' || !Array.isArray(data.patterns)) throw new Error(`${file}: not the correction patterns ({ wave, patterns: [...] })`)
  const text = value => value === null || value === undefined || String(value).trim() === '' ? null : String(value).trim()
  const taken = new Set()
  const patterns = data.patterns.map((p, n) => {
    if (!p || typeof p !== 'object') throw new Error(`${file}: a pattern is an object: ${JSON.stringify(p)}`)
    const version = Number.isFinite(Number(p.version)) && p.version !== null && p.version !== '' ? Number(p.version) : null
    // the fields of the runtime, and those of the entities of the configurator they come from
    const check = text(p.check ?? p.group?.checkTitle), message = text(p.message ?? p.group?.messageTitle)
    let examples = p.examples
    if (typeof examples === 'string') try { examples = JSON.parse(examples) } catch { examples = [] }
    const base = slug(p.name) || [slug(p.id), version !== null ? `v${version}` : ''].filter(Boolean).join('-') || slug([check, message].filter(Boolean).join(' ')) || `pattern-${n + 1}`
    let name = base
    for (let k = 2; taken.has(name) || name === 'readme'; k++) name = `${base}-${k}`
    taken.add(name)
    return {
      name, id: text(p.id), version, check, message, correction: text(p.correction ?? p.rule), writtenBy: text(p.writtenBy ?? p.author),
      decidedBy: text(p.decidedBy), decidedAt: text(p.decidedAt), decision: text(p.decision), exclusions: text(p.exclusions), verification: text(p.verification),
      examples: (Array.isArray(examples) ? examples : []).filter(e => e && (e.before || e.after)).map(e => ({ before: text(e.before), after: text(e.after), note: text(e.note) })),
      objects: (Array.isArray(p.objects) ? p.objects : Array.isArray(p.corrections) ? p.corrections : []).filter(o => o && typeof o === 'object').map(o => ({
        object: [text(o.type), text(o.name)].filter(Boolean).join(' ') || text(o.object), package: text(o.package ?? o.objectPackage),
        line: Number.isFinite(Number(o.line)) && o.line !== null && o.line !== '' ? Number(o.line) : null, outcome: text(o.outcome ?? o.status) }))
    }
  })
  return { wave: { id: text(data.wave?.id), title: text(data.wave?.title) }, patterns }
}

/** The documents of the correction patterns of a file: Map file name → Markdown, one per pattern and the index README.md. */
export function patternDocuments(data, { lang = 'it', file = 'the patterns' } = {}) {
  const { wave, patterns } = patternsOf(data, file)
  const w = writer(lang, new Map())
  const { t } = w
  const nr = t('non rilevato', 'not recorded')
  const outcomeName = code => code === null ? nr : NAMES.outcome[lang][code.toUpperCase()] ?? code
  const fence = code => { const marks = '`'.repeat(Math.max(3, ...[...String(code).matchAll(/`+/g)].map(m => m[0].length + 1))); return `${marks}abap\n${code}\n${marks}` }
  const counts = p => { const by = new Map(); for (const o of p.objects) by.set(o.outcome, (by.get(o.outcome) ?? 0) + 1); return by }
  const titleOf = p => p.message ?? p.check ?? p.id ?? p.name
  const documents = new Map()
  for (const p of patterns) {
    const decided = w.date(p.decidedAt)
    const body = [
      `<!-- program-docs.mjs patterns · ${lang} · ${t('scritto dai dati della fabbrica a lotti: non si modifica a mano', 'written from the data of the batch factory: not edited by hand')} -->`,
      `# ${t('Pattern di correzione', 'Correction pattern')}: ${titleOf(p)}`,
      ...(wave.title ? [`**Wave:** ${wave.title}`] : []),
      t('Un pattern di correzione è la regola con cui la stessa correzione si ripete su tutti i finding di un gruppo, cioè sui finding con lo stesso controllo e lo stesso messaggio. Questo documento descrive il gruppo, la correzione, chi l\'ha decisa e gli oggetti su cui è stata applicata.',
        'A correction pattern is the rule by which the same correction repeats on all the findings of a group, that is on the findings with the same check and the same message. This document describes the group, the correction, who decided it and the objects it was applied to.'),
      `## ${t('Il gruppo di finding', 'The group of findings')}`,
      table([t('Dato', 'Datum'), t('Valore', 'Value')], [[t('Controllo', 'Check'), p.check ?? nr], [t('Messaggio', 'Message'), p.message ?? nr],
        [t('Versione del pattern', 'Version of the pattern'), p.version ?? nr], [t('Oggetti corretti', 'Objects corrected'), new Set(p.objects.map(o => o.object)).size],
        [t('Correzioni', 'Corrections'), p.objects.length]]),
      `## ${t('La correzione', 'The correction')}`,
      p.correction ?? t('La regola della correzione non è rilevata nei dati della fabbrica.', 'The rule of the correction is not recorded in the data of the factory.'),
      ...p.examples.flatMap((e, n) => [`### ${t('Esempio', 'Example')} ${n + 1}${e.note ? `: ${e.note}` : ''}`,
        ...(e.before ? [t('Prima:', 'Before:'), fence(e.before)] : []), ...(e.after ? [t('Dopo:', 'After:'), fence(e.after)] : [])]),
      ...(p.exclusions ? [`### ${t('Quando non si applica', 'When it does not apply')}`, p.exclusions] : []),
      ...(p.verification ? [`### ${t('Come si verifica', 'How it is verified')}`, p.verification] : []),
      `## ${t('Chi l\'ha scritta e chi l\'ha decisa', 'Who wrote it and who decided it')}`,
      table([t('Dato', 'Datum'), t('Valore', 'Value')], [[t('Scritta da', 'Written by'), p.writtenBy ?? nr], [t('Decisa da', 'Decided by'), p.decidedBy ?? nr],
        [t('Data della decisione', 'Date of the decision'), decided ?? nr], ...(p.decision ? [[t('Motivo', 'Reason'), p.decision]] : [])]),
      `## ${t('Gli oggetti', 'The objects')}`,
      ...(p.objects.length ? [
        t('La tabella che segue conta le correzioni per esito.', 'The table that follows counts the corrections by outcome.'),
        table([t('Esito', 'Outcome'), t('Correzioni', 'Corrections')], [...counts(p)].map(([code, n]) => [outcomeName(code), n]), [1]),
        t('Ogni riga della tabella che segue è una correzione, con l\'oggetto, la riga del sorgente e l\'esito.', 'Each row of the table that follows is a correction, with the object, the line of the source and the outcome.'),
        table([t('Oggetto', 'Object'), t('Package', 'Package'), t('Riga', 'Line'), t('Esito', 'Outcome')],
          p.objects.map(o => [o.object ?? nr, o.package ?? nr, o.line ?? nr, outcomeName(o.outcome)]), [2])
      ] : [t('Nei dati della fabbrica il pattern non ha oggetti.', 'In the data of the factory the pattern has no objects.')])
    ]
    documents.set(`${p.name}.md`, body.join('\n\n') + '\n')
  }
  documents.set('README.md', [
    `<!-- program-docs.mjs patterns · ${lang} · ${t('scritto dai dati della fabbrica a lotti: non si modifica a mano', 'written from the data of the batch factory: not edited by hand')} -->`,
    `# ${t('Pattern di correzione', 'Correction patterns')}`, ...(wave.title ? [`**Wave:** ${wave.title}`] : []),
    patterns.length ? t(`I pattern di correzione applicati sono ${patterns.length}. Ognuno ha il suo documento, con la regola, chi l'ha decisa e gli oggetti corretti.`,
      `The correction patterns applied are ${patterns.length}. Each one has its document, with the rule, who decided it and the objects corrected.`)
      : t('Nei dati della fabbrica non c\'è alcun pattern di correzione.', 'The data of the factory hold no correction pattern.'),
    ...(patterns.length ? [table([t('Pattern', 'Pattern'), t('Controllo', 'Check'), t('Versione', 'Version'), t('Correzioni', 'Corrections'), t('Oggetti', 'Objects'), t('Decisa da', 'Decided by')],
      patterns.map(p => [`[${titleOf(p)}](${p.name}.md)`, p.check ?? nr, p.version ?? nr, p.objects.length, new Set(p.objects.map(o => o.object)).size, p.decidedBy ?? nr]), [2, 3, 4])] : [])
  ].join('\n\n') + '\n')
  return documents
}

// ---- the final report

/** A wave of the program for the final report: its folder, what the volumes say of it, its report and its lessons. */
function wavesOf(root, volumes) {
  const waves = new Map((volumes?.waves ?? []).map(w => [w.folder ?? w.title, { title: w.title, folder: w.folder, state: w.state }]))
  const dir = resolve(root, 'waves')
  if (existsSync(dir)) for (const entry of readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort())
    if (!waves.has(`waves/${entry}`)) waves.set(`waves/${entry}`, { title: null, folder: `waves/${entry}`, state: null })
  return [...waves.values()].map(wave => {
    const read = name => wave.folder ? readText(resolve(root, wave.folder, name)) : undefined
    const measure = (name, last = false) => { const m = wave.title ? firstAndLast(volumes?.history ?? [], name, wave.title) : null; return m ? (last ? (m.last ?? m.first).value : m.first.value) : null }
    const patterns = wave.folder ? readJson(resolve(root, wave.folder, FILES.patterns)) : undefined
    return { ...wave, report: read('docs/report.md'), lessons: read('docs/lessons.md'), patterns, objects: measure('OBJECTS'),
      baseline: measure('FINDINGS_BASELINE'), open: measure('FINDINGS_OPEN', true) }
  })
}

/**
 * The KPIs of a program before and after: [{ key, before, after, unit, source }]. From the volumes of the program (the
 * first value of a measure, and its latest when it was measured again); where the volumes say nothing, from the
 * register at the start and at the end. Null where neither says it.
 */
export function kpisOf({ volumes, start, now }) {
  const history = volumes?.history ?? []
  const measure = name => firstAndLast(history, name)
  const perimeter = register => register ? perimeterOf(register.objects) : null
  const sumFindings = rows => rows && rows.some(o => o.findings !== null) ? rows.reduce((sum, o) => sum + (o.findings ?? 0), 0) : null
  const rows = []
  const open = measure('FINDINGS_OPEN')
  rows.push({ key: 'findings', before: open?.first.value ?? sumFindings(perimeter(start)), after: open?.last?.value ?? sumFindings(perimeter(now)),
    source: [open ? 'volumes' : 'register', open?.last ? 'volumes' : 'register'] })
  // the levels: the units of the volumes, else the objects of the registers
  const measured = LEVELS.map(level => measure(`CC_LEVEL_${level}`))
  const fromVolumes = pick => measured.some(m => pick(m) !== undefined) ? Object.fromEntries(LEVELS.map((level, n) => [level, pick(measured[n]) ?? null])) : null
  const fromRegister = (register, field) => { const rows = perimeter(register); return rows && recorded(statsOf(rows)[field]) ? statsOf(rows)[field] : null }
  const before = fromVolumes(m => m?.first.value) ?? fromRegister(start, 'levelStart') ?? fromRegister(now, 'levelStart')
  const after = fromVolumes(m => m?.last?.value) ?? fromRegister(now, 'levelNow')
  const levelSource = [fromVolumes(m => m?.first.value) ? 'volumes' : 'register', fromVolumes(m => m?.last?.value) ? 'volumes' : 'register']
  for (const level of LEVELS) rows.push({ key: `level${level}`, before: before?.[level] ?? null, after: after?.[level] ?? null, source: levelSource })
  const share = levels => levels && LEVELS.every(level => levels[level] !== null) && LEVELS.some(level => levels[level]) ? shareAB({ ...levels }) : null
  rows.push({ key: 'shareAB', before: share(before), after: share(after), unit: '%', source: levelSource })
  for (const [key, name, unit] of [['cleanCoreShare', 'KPI_CLEAN_CORE_SHARE', '%'], ['technicalDebt', 'KPI_TECHNICAL_DEBT'], ['unusedShare', 'KPI_UNUSED_SHARE', '%']]) {
    const m = measure(name)
    if (m || key === 'technicalDebt') rows.push({ key, before: m?.first.value ?? null, after: m?.last?.value ?? null, unit, source: ['volumes', 'volumes'] })
  }
  const retired = register => perimeter(register)?.filter(o => o.status === 'RETIRED').length ?? null
  rows.push({ key: 'retired', before: retired(start), after: retired(now), source: ['register', 'register'] })
  const found = measure('MODIFICATIONS_FOUND'), reset = measure('MODIFICATIONS_RESET')
  const entries = register => register ? register.objects.filter(o => o.type === 'MOD').length : null
  rows.push({ key: 'modifications', before: found?.first.value ?? entries(start), after: found && reset ? (found.last ?? found.first).value - (reset.last ?? reset.first).value : null,
    source: [found ? 'volumes' : 'register', 'volumes'] })
  const kept = measure('KPI_BUSINESS_MODIFICATIONS')
  if (kept) rows.push({ key: 'modificationsKept', before: kept.first.value, after: kept.last?.value ?? null, source: ['volumes', 'volumes'] })
  return rows
}

/** The final report of a program as Markdown: { text, missing }. */
export function finalDocument({ root = '.', lang = 'it', program, existing } = {}) {
  const w = writer(lang, authoredOf(existing))
  const { t } = w
  const at = file => resolve(root, file)
  const volumes = existsSync(at(FILES.volumes)) ? normalizeVolumes(readJson(at(FILES.volumes)), FILES.volumes) : null
  const start = loadRegister(root)
  const now = existsSync(at(FILES.registerNow)) ? loadRegister(root, FILES.registerNow) : null
  const title = program ?? programOf(root).title ?? volumes?.program?.title ?? null
  const waves = wavesOf(root, volumes)
  const nr = t('non rilevato', 'not recorded')
  const detail = (text, source, level = 3) => [t(`Il testo che segue è quello del file \`${source}\`.`, `The text that follows is the one of the file \`${source}\`.`), embed(text, level)]
  const waveName = wave => wave.title ?? wave.folder

  // 2. wave by wave
  const done = []
  if (waves.length) {
    done.push(t(`Il programma ha ${waves.length} wave. La tabella riporta per ognuna gli oggetti presi e i finding alla partenza e alla chiusura, dai volumi del programma.`,
      `The program has ${waves.length} waves. The table gives for each one the objects it took and the findings at its start and at its closing, from the volumes of the program.`),
    table([t('Wave', 'Wave'), t('Cartella', 'Folder'), t('Oggetti', 'Objects'), t('Finding alla partenza', 'Findings at the start'), t('Finding alla chiusura', 'Findings at the closing'), t('Rapporto', 'Report')],
      waves.map(wave => [waveName(wave), wave.folder ?? nr, wave.objects ?? nr, wave.baseline ?? nr, wave.open ?? nr, wave.report ? t('presente', 'present') : t('mancante', 'missing')]), [2, 3, 4]))
    if (!volumes) done.push(w.miss(t('i volumi del programma e delle sue wave', 'the volumes of the program and of its waves'), FILES.volumes, 'CC_FINAL_REPORT'))
    for (const wave of waves) done.push(`### ${waveName(wave)}`, ...(wave.report ? [embed(wave.report, 4)]
      : [w.miss(t(`il rapporto della wave ${waveName(wave)}`, `the report of the wave ${waveName(wave)}`), `${wave.folder ?? 'waves/<wave>'}/docs/report.md`, 'CCW_CLOSE')]))
  } else done.push(w.miss(t('le wave del programma, con i loro rapporti', 'the waves of the program, with their reports'), 'waves/<wave>/docs/report.md', 'CCW_CLOSE'))

  // 3. KPIs before and after
  const labels = {
    findings: t('Finding aperti', 'Open findings'), levelA: t('Livello Clean Core A', 'Clean Core level A'), levelB: t('Livello Clean Core B', 'Clean Core level B'),
    levelC: t('Livello Clean Core C', 'Clean Core level C'), levelD: t('Livello Clean Core D', 'Clean Core level D'), levelUNKNOWN: t('Livello non determinato', 'Level not determined'),
    shareAB: t('Quota A+B', 'Share A+B'), cleanCoreShare: 'Clean Core Share', technicalDebt: t('Debito tecnico', 'Technical debt'),
    unusedShare: t('Quota di codice non usato', 'Share of unused code'), retired: t('Codice ritirato (oggetti)', 'Retired code (objects)'),
    modifications: t('Modifiche al codice SAP', 'Modifications of SAP code'), modificationsKept: t('Modifiche al codice SAP tenute (livello D)', 'Modifications of SAP code kept (level D)')
  }
  const sourceName = { volumes: t('volumi', 'volumes'), register: t('registro', 'register') }
  const value = (row, v) => v === null ? nr : `${w.number(v)}${row.unit ?? ''}`
  const change = row => row.before === null || row.after === null ? '' : `${row.after - row.before > 0 ? '+' : ''}${w.number(Number((row.after - row.before).toFixed(1)))}${row.unit ? t(' punti', ' points') : ''}`
  const kpis = kpisOf({ volumes, start, now })
  const kpi = [t('La tabella confronta la partenza e l\'arrivo del programma. I valori vengono dai volumi del programma nel configuratore e, dove i volumi non li hanno, dal registro degli oggetti. I livelli Clean Core dei volumi contano unità logiche, quelli del registro oggetti.',
    'The table compares the start and the arrival of the program. The values come from the volumes of the program in the configurator and, where the volumes do not have them, from the register of the objects. The Clean Core levels of the volumes count logical units, those of the register objects.'),
  table(['KPI', t('Prima', 'Before'), t('Dopo', 'After'), t('Variazione', 'Change'), t('Fonte', 'Source')],
    kpis.map(row => [labels[row.key], value(row, row.before), value(row, row.after), change(row), [...new Set(row.source.filter((_, n) => [row.before, row.after][n] !== null))].map(s => sourceName[s]).join(', ')]), [1, 2, 3])]
  if (!volumes) kpi.push(w.miss(t('i volumi del programma, con il loro storico', 'the volumes of the program, with their history'), FILES.volumes, 'CC_FINAL_REPORT'))
  if (!now) kpi.push(w.miss(t('il registro degli oggetti a fine programma', 'the register of the objects at the end of the program'), FILES.registerNow, 'CC_FINAL_REPORT'))

  // 4. correction patterns: those of the program and of each wave
  const applied = []
  const sources = [[FILES.patterns, readJson(at(FILES.patterns)), null], ...waves.filter(wave => wave.patterns !== undefined).map(wave => [`${wave.folder}/${FILES.patterns}`, wave.patterns, wave])]
    .filter(([, data]) => data !== undefined)
  const rows = sources.flatMap(([file, data, wave]) => patternsOf(data, file).patterns.map(p => [
    `[${p.message ?? p.check ?? p.id ?? p.name}](${relative('docs/program', join(dirname(file), `${p.name}.md`)).split('\\').join('/')})`, wave ? waveName(wave) : '', p.check ?? nr, p.version ?? nr,
    p.objects.length, p.objects.filter(o => o.outcome?.toUpperCase() === 'VERIFIED').length, new Set(p.objects.map(o => o.object)).size]))
  if (rows.length) applied.push(t(`I pattern di correzione applicati dalla fabbrica a lotti sono ${rows.length}. Un pattern di correzione è la regola con cui la stessa correzione si ripete su tutti i finding di un gruppo; ognuno ha il suo documento.`,
    `The correction patterns the batch factory applied are ${rows.length}. A correction pattern is the rule by which the same correction repeats on all the findings of a group; each one has its document.`),
  table([t('Pattern', 'Pattern'), 'Wave', t('Controllo', 'Check'), t('Versione', 'Version'), t('Correzioni', 'Corrections'), t('Verificate', 'Verified'), t('Oggetti', 'Objects')], rows, [3, 4, 5, 6]))
  else applied.push(w.miss(t('i pattern di correzione applicati dalla fabbrica a lotti', 'the correction patterns the batch factory applied'), `waves/<wave>/${FILES.patterns}`, 'CCW_PATTERN_DOCS'))

  // 5. deviations and what remains
  const remains = []
  if (now) {
    const perimeter = perimeterOf(now.objects)
    const stats = statsOf(perimeter)
    const open = perimeter.filter(o => !['ADAPTED', 'NO_CHANGE', 'EXEMPT', 'RETIRED'].includes(o.status))
    remains.push(t(`A fine programma il registro conta ${stats.objects} oggetti: ${stats.done} sono fatti, cioè adeguati, senza modifiche, esenti o ritirati, e ${open.length} restano da fare.`,
      `At the end of the program the register counts ${stats.objects} objects: ${stats.done} are done, that is adapted, with no change, exempt or retired, and ${open.length} remain to do.`))
    const shown = open.slice(0, 100)
    if (open.length) remains.push(`### ${t('Oggetti che restano', 'Objects that remain')}`,
      table([t('Oggetto', 'Object'), t('Package', 'Package'), t('Stato', 'Status'), t('Finding aperti', 'Open findings'), t('Nota', 'Note')],
        shown.map(o => [`${o.type} ${o.name}`, w.packageName(o.package ?? NO_PACKAGE), NAMES.status[lang][o.status] ?? o.status ?? nr, o.findings ?? nr, o.note ?? '']), [3]),
      ...(open.length > shown.length ? [t(`Gli altri ${open.length - shown.length} oggetti sono nel registro del programma, nel configuratore.`, `The other ${open.length - shown.length} objects are in the register of the program, in the configurator.`)] : []))
    const exempt = perimeter.filter(o => o.status === 'EXEMPT')
    if (exempt.length) remains.push(`### ${t('Oggetti esenti', 'Exempt objects')}`, table([t('Oggetto', 'Object'), t('Package', 'Package'), t('Finding aperti', 'Open findings'), t('Motivo', 'Reason')],
      exempt.map(o => [`${o.type} ${o.name}`, w.packageName(o.package ?? NO_PACKAGE), o.findings ?? nr, o.note ?? nr]), [2]))
  } else remains.push(w.miss(t('il registro degli oggetti a fine programma, con ciò che resta', 'the register of the objects at the end of the program, with what remains'), FILES.registerNow, 'CC_FINAL_REPORT'))
  const backlog = readText(at('docs/program/backlog-clean-core.md'))
  if (backlog) remains.push(`### ${t('Backlog Clean Core', 'Clean Core backlog')}`, ...detail(backlog, 'docs/program/backlog-clean-core.md', 4))
  remains.push(`### ${t('Deviazioni approvate', 'Approved deviations')}`,
    w.part('deviations', t('Le deviazioni approvate, ognuna con chi l\'ha approvata e perché, come sono registrate nel configuratore.', 'The approved deviations, each with who approved it and why, as the configurator records them.')))

  // 6. governance
  const governance = []
  for (const [name, step, what] of [['governance.md', 'CR_GOVERN', t('il registro Clean Core del sistema', 'the Clean Core register of the system')],
    ['atc-governance.md', 'CC_ATC_GOVERNANCE', t('le regole dell\'ATC dopo il programma', 'the rules of the ATC after the program')]]) {
    const text = readText(at(`docs/program/${name}`))
    if (text) governance.push(...detail(text, `docs/program/${name}`))
    else governance.push(w.miss(what, `docs/program/${name}`, step))
  }

  // 7. TO-BE beside AS-IS
  const diagrams = []
  for (const view of VIEWS) {
    const asIs = diagramImages(root, 'as-is', view), toBe = diagramImages(root, 'to-be', view)
    diagrams.push(`### ${NAMES.view[lang][view]}`)
    const image = (list, n, mode) => list[n] ? `![${NAMES.view[lang][view]}, ${mode}](${list[n]})` : ''
    if (asIs.length || toBe.length) diagrams.push(table(['AS-IS', 'TO-BE'],
      Array.from({ length: Math.max(asIs.length, toBe.length) }, (_, n) => [image(asIs, n, 'AS-IS'), image(toBe, n, 'TO-BE')])))
    if (!toBe.length) diagrams.push(w.miss(t(`l'immagine del diagramma TO-BE «${NAMES.view[lang][view]}»`, `the image of the TO-BE diagram "${NAMES.view[lang][view]}"`),
      `docs/program/diagrams/to-be-${view}.png`, 'CC_FINAL_REPORT'))
    if (!asIs.length) diagrams.push(w.miss(t(`l'immagine del diagramma AS-IS «${NAMES.view[lang][view]}»`, `the image of the AS-IS diagram "${NAMES.view[lang][view]}"`),
      `docs/program/diagrams/as-is-${view}.png`, 'CC_ARCH_DIAGRAMS'))
  }

  // 8. lessons
  const lessons = []
  for (const wave of waves.filter(wave => wave.lessons)) lessons.push(`### ${waveName(wave)}`, embed(wave.lessons, 4))
  if (!lessons.length) lessons.push(w.miss(t('le lezioni delle wave', 'the lessons of the waves'), 'waves/<wave>/docs/lessons.md', 'CCW_CLOSE'))
  lessons.push(`### ${t('Lezioni del programma', 'Lessons of the program')}`,
    w.part('lessons', t('Le lezioni del programma nel suo insieme: che cosa rifare allo stesso modo e che cosa cambiare.', 'The lessons of the program as a whole: what to do again the same way and what to change.')))

  const text = assemble('final', lang, t('Documento finale del programma', 'Final report of the program'), title,
    t('Questo documento descrive che cosa il programma ha fatto sul codice custom e con quale risultato. Le tabelle e i numeri vengono dai dati del programma. La sintesi, le deviazioni e le lezioni del programma sono scritte da chi lo ha condotto.',
      'This document describes what the program did on the custom code and with which result. The tables and the numbers come from the data of the program. The summary, the deviations and the lessons of the program are written by who carried it out.'),
    [[w.part('summary', t('La sintesi: che cosa è cambiato, con i numeri che contano.', 'The summary: what changed, with the numbers that matter.'))],
      done, kpi, applied, remains, governance, diagrams, lessons], t)
  return { text, missing: w.missing }
}

// ---- the checks

/** The language a document was written in (its first line), or null. */
export const languageOf = text => /^<!-- program-docs\.mjs [a-z-]+ · ([a-z]{2}) · /.exec(String(text ?? ''))?.[1] ?? null

/** The problems of a document against what the data give now: what --check prints. `expected` is the document written again. */
export function checkDocument(text, kind, lang, expected) {
  const problems = []
  const lines = text.split('\n')
  const headings = lines.map((line, n) => [/^## (\d+)\. (.*)$/.exec(line), n]).filter(([m]) => m)
  INDEX[kind][lang].forEach((title, n) => {
    const at = headings.findIndex(([m]) => Number(m[1]) === n + 1 && m[2].trim() === title)
    if (at < 0) { problems.push(`section ${n + 1} is missing: "${title}"`); return }
    if (n && headings.findIndex(([m]) => Number(m[1]) === n) > at) problems.push(`section ${n + 1} comes before section ${n}`)
    const body = lines.slice(headings[at][1] + 1, headings[at + 1]?.[1] ?? lines.length).join('\n')
    // a section that holds only a part between markers is said below, with the part to write
    if (!withoutComments(body).trim() && !Object.values(AUTHORED[kind]).includes(n + 1)) problems.push(`section ${n + 1} is empty: "${title}"`)
  })
  const parts = authoredOf(text)
  for (const [key, section] of Object.entries(AUTHORED[kind])) {
    if (!parts.has(key)) problems.push(`section ${section}: the markers of the part "${key}" are missing (<!-- author:${key}:start --> and <!-- author:${key}:end -->)`)
    else if (!withoutComments(parts.get(key)).trim()) problems.push(`section ${section}: the part "${key}" is still to write, between its markers`)
  }
  if (text !== expected) {
    const now = expected.split('\n')
    const line = lines.findIndex((l, n) => l !== now[n])
    problems.push(`not up to date at line ${(line < 0 ? lines.length : line) + 1}: the data of the program changed, or a part outside the markers was edited ` +
      `(run program-docs.mjs ${kind} again)`)
  }
  return problems
}

// ---- the command line

export const USAGE = `node program-docs.mjs as-is    [--root <repository>] [--lang it|en] [--program <title>] [--check]
node program-docs.mjs patterns [--root <folder>] [--file ${FILES.patterns}] [--out <folder>] [--lang it|en] [--check]
node program-docs.mjs final    [--root <repository>] [--lang it|en] [--program <title>] [--check]
node program-docs.mjs deliver <file.md> [--root <repository>] [--brand docs/brand] [--out docs/deliverables] [--title <title>]
                               [--program <title>] [--version 1.0] [--date <YYYY-MM-DD>] [--lang it|en] [--no-pdf] [--check]`

export async function main(argv, { log = console.log, env = process.env } = {}) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
    root: { type: 'string', default: '.' }, lang: { type: 'string' }, program: { type: 'string' }, check: { type: 'boolean' },
    file: { type: 'string' }, out: { type: 'string' }, brand: { type: 'string' }, title: { type: 'string' }, version: { type: 'string' },
    date: { type: 'string' }, 'no-pdf': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } })
  if (values.help) { log(USAGE); return 0 }
  const [command, ...rest] = positionals
  if (!['as-is', 'patterns', 'final', 'deliver'].includes(command)) throw new Error(`program-docs needs as-is, patterns, final or deliver\n${USAGE}`)
  if (values.lang && !LANGUAGES.includes(values.lang)) throw new Error(`--lang is ${LANGUAGES.join(' or ')}, not ${values.lang}`)
  const root = resolve(values.root)
  const language = text => values.lang ?? languageOf(text) ?? env.NOVA_CONFIG_LANGUAGE ?? 'it'
  const shown = file => { const here = relative(process.cwd(), file); return here && !here.startsWith('..') ? here : file }
  const report = problems => { for (const problem of problems) log(problem); log(`problems: ${problems.length}`); return problems.length ? 1 : 0 }

  if (command === 'as-is' || command === 'final') {
    if (rest.length) throw new Error(`${command} takes no file\n${USAGE}`)
    const file = resolve(root, DOCUMENTS[command])
    const existing = existsSync(file) ? readFileSync(file, 'utf8') : undefined
    const lang = language(existing)
    if (!LANGUAGES.includes(lang)) throw new Error(`the language is ${LANGUAGES.join(' or ')}, not ${lang}`)
    const { text, missing } = (command === 'as-is' ? asIsDocument : finalDocument)({ root, lang, program: values.program, existing })
    if (values.check) return report(existing === undefined ? [`${shown(file)}: not written: run program-docs.mjs ${command}`]
      : checkDocument(existing, command, lang, text).map(problem => `${shown(file)}: ${problem}`))
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)
    log(`wrote ${shown(file)} · ${INDEX[command][lang].length} sections, ${missing.length} data missing`)
    for (const m of missing) log(`  missing: ${m.what} · ${m.file} (${m.step})`)
    const empty = Object.keys(AUTHORED[command]).filter(key => !authoredOf(text).get(key))
    if (empty.length) log(`  to write between the markers: ${empty.join(', ')}`)
    return 0
  }

  if (command === 'patterns') {
    if (rest.length) throw new Error(`patterns takes no file but --file\n${USAGE}`)
    const source = resolve(root, values.file ?? FILES.patterns)
    const data = readJson(source)
    if (data === undefined) throw new Error(`${values.file ?? FILES.patterns}: no such file. The runtime writes it (wolf pattern-docs), from the correction patterns of the configurator`)
    const out = values.out ? resolve(root, values.out) : dirname(source)
    const index = existsSync(join(out, 'README.md')) ? readFileSync(join(out, 'README.md'), 'utf8') : undefined
    const documents = patternDocuments(data, { lang: language(index), file: values.file ?? FILES.patterns })
    if (values.check) {
      const problems = []
      for (const [name, text] of documents) {
        const file = join(out, name)
        if (!existsSync(file)) problems.push(`${shown(file)}: not written: run program-docs.mjs patterns`)
        else if (readFileSync(file, 'utf8') !== text) problems.push(`${shown(file)}: not up to date: the data of the factory changed, or the document was edited (run program-docs.mjs patterns again)`)
      }
      // a document of a pattern the data no longer have
      for (const name of existsSync(out) ? readdirSync(out).filter(f => f.endsWith('.md')) : [])
        if (!documents.has(name) && /^<!-- program-docs\.mjs patterns /.test(readFileSync(join(out, name), 'utf8'))) problems.push(`${shown(join(out, name))}: a pattern the data of the factory do not have`)
      return report(problems)
    }
    mkdirSync(out, { recursive: true })
    for (const [name, text] of documents) writeFileSync(join(out, name), text)
    log(`wrote ${documents.size - 1} correction patterns and their index in ${shown(out)}`)
    for (const name of documents.keys()) log(`  ${shown(join(out, name))}`)
    return 0
  }

  // deliver: Word and PDF, in a module of its own because it needs the docx library
  const { deliver } = await import('./lib/program-deliver.mjs')
  if (rest.length !== 1) throw new Error(`deliver needs the Markdown file\n${USAGE}`)
  return deliver({ root, file: rest[0], brand: values.brand, out: values.out, title: values.title, program: values.program, version: values.version,
    date: values.date, lang: values.lang, pdf: !values['no-pdf'], check: values.check, log, env, shown })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  main(process.argv.slice(2)).then(code => process.exit(code), error => { console.error(error.message); process.exit(2) })
