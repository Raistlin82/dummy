#!/usr/bin/env node
/**
 * The diagrams of a custom code program, generated from its data and checked against them (docs/wolf/18, section 4.2):
 * the steps CC_ARCH_DIAGRAMS (as-is) and CC_FINAL_REPORT (to-be) run it in the repository of the program. No model, no
 * network, nothing outside the repository: the same data give the same files, byte for byte.
 *
 *   node program-diagrams.mjs as-is|to-be [--root <repository of the program>] [--register <register.json>]
 *        [--now <register-final.json>] [--uses <uses.json>] [--waves <waves.json>] [--system-info <system-info.md>]
 *        [--volumes <volumes.json>] [--out docs/program/diagrams] [--view <views>] [--program <title>]
 *        [--lang it|en] [--no-png] [--check]
 *
 * What it reads, relative to --root (default: the current folder):
 * --register     the register of the objects at the start of the program, as nova-config.mjs objects <program> --export
 *                writes it ([{type, name, package, main, status, wave, usage, dossier, findings, levelStart, levelNow}]).
 *                Default docs/program/register.json, else the inventory of CC_PERIMETER, docs/program/objects.json
 *                ([{type, name, package, parts}]). as-is needs it; to-be compares with it when it is there.
 * --now          to-be only: the register as it is at the end, exported again (nova-config.mjs objects <program>
 *                --export docs/program/register-final.json, the default).
 * --uses         the where-used between the objects ([{from: "CLAS ZCL_A", to: "CLAS ZCL_B"}]: ZCL_A uses ZCL_B).
 *                Default docs/program/uses.json.
 * --waves        the plan of the waves, as wave-plan.mjs writes it ([{order, title, packages | objects, count, findings,
 *                focus, dependsOn}]). Default docs/program/waves.json.
 * --system-info  the systems of the program. Default docs/program/system-info.md: a table with the columns System (or
 *                Sistema, SID), Role (Ruolo), Release and Connection (Collegamento), one system per row, where a
 *                connection "RFC from S4C" links two systems; without the table, the lines "SID: ..." and "Release: ...".
 * --volumes      the volumes exported from the configurator ({ history: [{ measure, value, measuredAt, step, wave }] }),
 *                for the units by Clean Core level. Default docs/program/volumes.json.
 * A file that is not there, or a field a step did not record (the usage of an object, its Clean Core level, its
 * findings), is said in the diagram as "not recorded": nothing fails and nothing is invented.
 *
 * What it writes, in --out: <mode>-<view>.drawio for each view (--view: a comma list, default all four):
 *   landscape        the systems of the program and the connections it uses;
 *   custom-code-map  the packages of the perimeter in the lanes of their domains, each with objects, findings, usage and
 *                    Clean Core level, and who uses whom between packages and between domains;
 *   waves            the waves of the plan as lanes, in their order, with their packages and what each wave comes after;
 *   clean-core       the objects by Clean Core level, A to D, of each package.
 * to-be draws the same views with the arrival state and the start beside it: per package the objects, those done and
 * retired, the level at the start and now. Lanes and grids at fixed positions; a connector runs in the channel beside
 * the lanes, never across a box. The page is the smallest sheet in landscape, A4 to A0, that holds the content at full
 * size (more A0 pages beyond that): its name is in the footer of the page, and printed on it no text is below 7 pt.
 * The PNG of each page, with the diagram inside it, is exported when the draw.io command line is installed (drawio, or
 * NOVA_DRAWIO); without it one line says so.
 *
 * --check writes nothing and checks the files against the data: each text and number of the diagram is the one of the
 * data; every package of the register is in the diagram, and no other; no shape overlaps another or leaves the page;
 * no text is wider or taller than its shape, nor printed below 7 pt; no connector crosses a box; the file was made
 * from the data as they are now (their fingerprint is in the file). One line per problem, then "problems: N".
 * Exit 0 when written, or checked with no problem; 1 with problems; 2 on an error.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { delimiter, join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { inflateRawSync } from 'node:zlib'
import { attr, parseStyle, parseXml } from './drawio-normalize.mjs'
import { FILES, LEVELS, MODIFICATIONS, NO_PACKAGE, domainsOf, fingerprintOf, firstAndLast, landscapeOf, loadRegister,
  normalizeUses, normalizeVolumes, normalizeWaves, packageUses, packagesOf, programOf, readJson, readText,
  recorded, shareAB, statsOf, waveScope } from './lib/program-data.mjs'
import { LINE, fitText, textWidth, wrapText } from './lib/text-metrics.mjs'

// the layout: a change here changes the files, so it is part of the fingerprint
const LAYOUT = 1
export const VIEWS = ['landscape', 'custom-code-map', 'waves', 'clean-core']
export const MODES = ['as-is', 'to-be']
/** The sheets a page is made for, in landscape, in draw.io px (100 px per inch): printed at full size, 1 px is 0.72 pt. */
export const SHEETS = [['A4', 1169, 827], ['A3', 1654, 1169], ['A2', 2339, 1654], ['A1', 3311, 2339], ['A0', 4681, 3311]]
export const MIN_PT = 7
const PT_PER_PX = 0.72

// the colours of the SAP solution diagram guideline (Horizon), as docs/architecture uses them: SAP blue, non-SAP grey,
// the accent of Nova WOLF, positive green; the Clean Core levels from green to red
const SAP = '#0070F2', NON = '#475E75', NON_FILL = '#F5F6F7', TITLE = '#1D2D3E', BODY = '#556B82', OWN = '#07838F',
  OWN_FILL = '#DAFDF5', GOOD = '#188918', GOOD_FILL = '#F5FAE5', WHITE = '#FFFFFF'
const LEVEL_COLORS = { A: '#188918', B: '#0070F2', C: '#C35500', D: '#D20A0A', UNKNOWN: '#475E75', none: '#FFFFFF' }
const FONT = 'fontFamily=Arial;'
const CARD = `rounded=1;whiteSpace=wrap;html=1;arcSize=12;absoluteArcSize=1;strokeWidth=1.5;align=left;verticalAlign=top;spacing=0;spacingLeft=8;spacingRight=8;spacingTop=6;spacingBottom=6;${FONT}fontSize=10;fontColor=${BODY};`
const TEXT_CELL = `text;html=1;whiteSpace=wrap;align=left;verticalAlign=top;spacing=0;${FONT}fontSize=10;fontColor=${BODY};`
const BAND = `rounded=1;whiteSpace=wrap;html=1;arcSize=16;absoluteArcSize=1;strokeWidth=1.5;strokeColor=${NON};fillColor=${NON_FILL};container=1;collapsible=0;recursiveResize=0;${FONT}fontSize=10;`
const EDGE = `edgeStyle=none;rounded=0;html=1;endArrow=blockThin;endFill=1;endSize=4;startArrow=none;strokeWidth=1.5;strokeColor=${NON};${FONT}fontSize=10;`

// the sizes of the layout, in px
const M = 40, GAP = 10, PAD = 8, LABEL_W = 230, CARD_W = 250, TRACK = 8, PORT = 10, PORT_TOP = 20, BAR_H = 10
const INNER = CARD_W - 16 - 4
// beyond these the arrows between lanes would not be readable: the lanes say in words what they use
const MAX_ARROWS = 60, MAX_TRACKS = 24

// ---- the words of the diagrams, in the language of the program

const WORDS = {
  en: {
    mode: { 'as-is': 'AS-IS', 'to-be': 'TO-BE' },
    views: { landscape: 'Landscape of the program', 'custom-code-map': 'Custom code map', waves: 'Waves of the program',
      'clean-core': 'Clean Core levels by package' },
    subtitle: { 'as-is': 'The situation at the start of the program, drawn from its data.',
      'to-be': 'The arrival state of the program beside its start, drawn from its data.' },
    program: 'Custom code program', page: (n, of) => `Page ${n} of ${of}.`, nr: 'not recorded', nrShort: 'n.r.',
    noPackage: 'Without package', other: 'Other packages', continued: '(continued)',
    objects: 'objects', findings: 'findings', findingsNr: 'findings not recorded', packages: 'packages',
    usage: 'usage', usageNr: 'usage: not recorded', used: 'used', likely: 'probably unused', unused: 'unused', indeterminate: 'undetermined',
    level: 'level', startLevel: 'start', nowLevel: 'now', start: 'start', done: 'done', of: 'of', retired: 'retired',
    uses: 'uses', usedBy: 'used by', usesDomains: 'uses domains', usedByDomains: 'used by domains',
    whereUsed: 'Where-used between packages', pairs: 'pairs of packages', relations: 'relations', inside: 'inside one package',
    outside: 'toward objects outside the register',
    usesMissing: 'Where-used not recorded: the file docs/program/uses.json is missing (the step CC_WAVE_PLAN writes it).',
    mods: 'Outside the perimeter and not on the map: modifications of SAP code', notes: 'SAP Notes',
    order: 'order', after: 'after the waves', depsUnknown: 'dependencies not in the plan', focus: 'scope',
    focusNames: { CODE: 'ABAP code', UI5: 'SAPUI5 apps', PERFORMANCE: 'performance' }, inRegister: 'objects in the register',
    units: 'units of the wave', notInRegister: 'packages not in the register', findingsNow: 'findings now',
    waves: 'waves', objectsPlan: 'objects in the plan', notInWave: 'In no wave', packagesInWaves: 'packages in a wave',
    packagesOut: 'in no wave',
    wavesMissing: 'Plan of the waves not recorded: the file docs/program/waves.json is missing (the step CC_WAVE_PLAN writes it).',
    share: 'A+B', volumesStart: 'Units by level at the start, from the volumes of the program',
    volumesNow: 'Units by level now, from the volumes of the program',
    systems: 'systems', role: 'role', release: 'release', connection: 'connection', programSystem: 'System of the program',
    hub: 'Repository of the program and tools of Nova WOLF',
    landscape: {
      table: 'From the table of the systems of docs/program/system-info.md.',
      lines: 'Only the system of the program: docs/program/system-info.md has no table of the systems (columns System, Role, Release, Connection; the step CC_SYSTEM_READY writes it).',
      none: 'Systems not recorded: docs/program/system-info.md names no system (a table with the columns System, Role, Release, Connection; the step CC_SYSTEM_READY writes it).',
      missing: 'Systems not recorded: the file docs/program/system-info.md is missing (the step CC_SYSTEM_READY writes it).'
    },
    legend: {
      landscape: 'A line from the program to a system: a connection the program uses, named in the box of the system. A line between two systems: the connection of the second from the first.',
      map: 'Each box is a package of the perimeter, in the lane of its domain: the part of its name before the first underscore. n.r.: not recorded. ?: level not determined.',
      mapArrows: 'An arrow goes from a domain to a domain it uses.',
      waves: 'Each lane is a wave of the plan, in its order, with the packages it takes. n.r.: not recorded. ?: level not determined.',
      wavesArrows: 'An arrow goes from a wave to a wave that comes after it, because it uses its objects.',
      cleanCore: 'The bar of a package shows its objects by Clean Core level. n.r.: not recorded. ?: level not determined. A+B: the objects at level A or B among those with a level.',
      bars: 'In each box the upper bar is the start, the lower bar is now.',
      green: 'A green box: every object of the package is done (adapted, no change needed, exempt or retired).',
      tooMany: n => `The arrows are not drawn: they would be ${n}, too many to read. Each lane says how many it uses.`,
      pages: 'The arrows are not drawn: the lanes are on several pages. Each lane says how many it uses.',
      levels: { A: 'level A', B: 'level B', C: 'level C', D: 'level D', UNKNOWN: 'not determined', none: 'not recorded' }
    },
    footer: (sheet, pt, fingerprint) => `Generated from the data of the program, never drawn by hand · sheet ${sheet} landscape · smallest text ${pt} pt · data ${fingerprint}`
  },
  it: {
    mode: { 'as-is': 'AS-IS', 'to-be': 'TO-BE' },
    views: { landscape: 'Landscape del programma', 'custom-code-map': 'Mappa del codice custom', waves: 'Wave del programma',
      'clean-core': 'Livelli Clean Core per package' },
    subtitle: { 'as-is': 'La situazione alla partenza del programma, disegnata dai suoi dati.',
      'to-be': 'Lo stato di arrivo del programma accanto alla partenza, disegnato dai suoi dati.' },
    program: 'Programma di codice custom', page: (n, of) => `Pagina ${n} di ${of}.`, nr: 'non rilevato', nrShort: 'n.r.',
    noPackage: 'Senza package', other: 'Altri package', continued: '(continua)',
    objects: 'oggetti', findings: 'finding', findingsNr: 'finding non rilevati', packages: 'package',
    usage: 'uso', usageNr: 'uso: non rilevato', used: 'usati', likely: 'prob. non usati', unused: 'non usati', indeterminate: 'indeterminati',
    level: 'livello', startLevel: 'partenza', nowLevel: 'oggi', start: 'partenza', done: 'fatti', of: 'di', retired: 'ritirati',
    uses: 'usa', usedBy: 'usato da', usesDomains: 'usa domini', usedByDomains: 'usato da domini',
    whereUsed: 'Where-used tra package', pairs: 'coppie di package', relations: 'relazioni', inside: 'dentro lo stesso package',
    outside: 'verso oggetti fuori dal registro',
    usesMissing: 'Where-used non rilevati: manca il file docs/program/uses.json (lo scrive il passo CC_WAVE_PLAN).',
    mods: 'Fuori dal perimetro e non sulla mappa: modifiche al codice SAP', notes: 'note SAP',
    order: 'ordine', after: 'dopo le wave', depsUnknown: 'dipendenze non nel piano', focus: 'ambito',
    focusNames: { CODE: 'codice ABAP', UI5: 'app SAPUI5', PERFORMANCE: 'prestazioni' }, inRegister: 'oggetti nel registro',
    units: 'unità della wave', notInRegister: 'package non nel registro', findingsNow: 'finding oggi',
    waves: 'wave', objectsPlan: 'oggetti nel piano', notInWave: 'In nessuna wave', packagesInWaves: 'package in una wave',
    packagesOut: 'in nessuna wave',
    wavesMissing: 'Piano delle wave non rilevato: manca il file docs/program/waves.json (lo scrive il passo CC_WAVE_PLAN).',
    share: 'A+B', volumesStart: 'Unità per livello alla partenza, dai volumi del programma',
    volumesNow: 'Unità per livello oggi, dai volumi del programma',
    systems: 'sistemi', role: 'ruolo', release: 'release', connection: 'collegamento', programSystem: 'Sistema del programma',
    hub: 'Repository del programma e strumenti di Nova WOLF',
    landscape: {
      table: 'Dalla tabella dei sistemi di docs/program/system-info.md.',
      lines: 'Solo il sistema del programma: docs/program/system-info.md non ha la tabella dei sistemi (colonne Sistema, Ruolo, Release, Collegamento; la scrive il passo CC_SYSTEM_READY).',
      none: 'Sistemi non rilevati: docs/program/system-info.md non nomina alcun sistema (una tabella con le colonne Sistema, Ruolo, Release, Collegamento; la scrive il passo CC_SYSTEM_READY).',
      missing: 'Sistemi non rilevati: manca il file docs/program/system-info.md (lo scrive il passo CC_SYSTEM_READY).'
    },
    legend: {
      landscape: 'Una linea dal programma a un sistema: un collegamento che il programma usa, nominato nel riquadro del sistema. Una linea tra due sistemi: il collegamento del secondo dal primo.',
      map: 'Ogni riquadro è un package del perimetro, nella corsia del suo dominio: la parte del nome prima del primo trattino basso. n.r.: non rilevato. ?: livello non determinato.',
      mapArrows: 'Una freccia va da un dominio a un dominio che usa.',
      waves: 'Ogni corsia è una wave del piano, nel suo ordine, con i package che prende. n.r.: non rilevato. ?: livello non determinato.',
      wavesArrows: 'Una freccia va da una wave a una wave che viene dopo, perché ne usa gli oggetti.',
      cleanCore: 'La barra di un package mostra i suoi oggetti per livello Clean Core. n.r.: non rilevato. ?: livello non determinato. A+B: gli oggetti di livello A o B tra quelli con un livello.',
      bars: 'In ogni riquadro la barra in alto è la partenza, quella in basso è oggi.',
      green: 'Un riquadro verde: ogni oggetto del package è fatto (adeguato, senza modifiche, esente o ritirato).',
      tooMany: n => `Le frecce non sono disegnate: sarebbero ${n}, troppe per essere lette. Ogni corsia dice quante ne usa.`,
      pages: 'Le frecce non sono disegnate: le corsie sono su più pagine. Ogni corsia dice quante ne usa.',
      levels: { A: 'livello A', B: 'livello B', C: 'livello C', D: 'livello D', UNKNOWN: 'non determinato', none: 'non rilevato' }
    },
    footer: (sheet, pt, fingerprint) => `Generato dai dati del programma, mai disegnato a mano · foglio ${sheet} orizzontale · testo più piccolo ${pt} pt · dati ${fingerprint}`
  }
}

// ---- texts: rows of runs, measured, written as the html of a draw.io label

const esc = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const round = value => Number(Number(value).toFixed(2))
// a position along a side of a shape, as a fraction of it
const fraction = value => Number(Number(value).toFixed(4))

/** A block of text for a shape `width` px wide: a bold title and lines of 10 px, wrapped here so draw.io never wraps. */
function block(width) {
  const rows = []
  const push = (runs, size, bold = false) => rows.push({ runs, size, bold })
  const self = {
    rows,
    /** A bold title: wrapped by words, or cut with an ellipsis when it must stay on one line. */
    title(text, { size = 12, wrap = false } = {}) {
      for (const line of wrap ? wrapText(text, size, width, true) : [fitText(text, size, width, true)]) push([{ t: line }], size, true)
      return self
    },
    /** A line of data: wrapped at its " · " separators, then by words. */
    line(text, size = 10) {
      let current = ''
      const flush = () => { for (const part of wrapText(current, size, width)) push([{ t: part }], size); current = '' }
      for (const chunk of String(text).split(' · ')) {
        const candidate = current ? `${current} · ${chunk}` : chunk
        if (current && textWidth(candidate, size) > width) { flush(); current = chunk } else current = candidate
      }
      if (current) flush()
      return self
    },
    /** A list of names after a prefix, in italics, on at most `lines` lines; an ellipsis says there are more. */
    names(prefix, names, lines = 1, size = 10) {
      const rest = [...names]
      for (let n = 0; n < lines && rest.length; n++) {
        const lead = n === 0 ? prefix : ''
        const last = n === lines - 1
        let shown = ''
        while (rest.length) {
          const candidate = (shown ? `${shown}, ` : '') + rest[0]
          // on the last line, room for the ellipsis that says there are more
          const closing = last && rest.length > 1 ? ', …' : ''
          if (textWidth(lead + candidate + closing, size) > width) {
            // a name longer than the line is cut
            if (!shown) { shown = fitText(rest[0], size, width - textWidth(`${lead}, …`, size)); rest.shift() }
            break
          }
          shown = candidate
          rest.shift()
        }
        if (last && rest.length) { shown += ', …'; rest.length = 0 }
        push([...(lead ? [{ t: lead }] : []), { t: shown, i: true }], size)
      }
      return self
    },
    height: () => rows.reduce((sum, row) => sum + row.size * LINE, 0),
    html: () => rows.map(row => {
      const text = row.runs.map(run => run.i ? `<i>${esc(run.t)}</i>` : esc(run.t)).join('')
      return row.bold ? `<b style="font-size:${row.size}px;color:${TITLE}">${text}</b>` : `<span style="font-size:${row.size}px;color:${BODY}">${text}</span>`
    }).join('<br>')
  }
  return self
}

const decode = text => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
/** The text of a label as a reader sees it: tags removed, one space for every break. */
export const plainOf = html => decode(String(html ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
/** The numbers a label states: its digits outside the names (the bold title and the lists in italics). */
export const numbersOf = html => plainOf(String(html ?? '').replace(/<b\b[^>]*>.*?<\/b>/gis, ' ').replace(/<i\b[^>]*>.*?<\/i>/gis, ' '))
  .match(/\d+/g) ?? []

// ---- what each view says, from the data: lanes, boxes and arrows, with every text

const levelLine = (W, prefix, counts) => !recorded(counts) ? `${prefix}: ${W.nr}`
  : `${prefix}: A ${counts.A} · B ${counts.B} · C ${counts.C} · D ${counts.D}` + (counts.UNKNOWN ? ` · ? ${counts.UNKNOWN}` : '') +
    (counts.none ? ` · ${W.nrShort} ${counts.none}` : '')
const usageLine = (W, usage) => !recorded(usage) ? W.usageNr : `${W.usage}: ` + [[W.used, usage.USED], [W.likely, usage.LIKELY_UNUSED],
  [W.unused, usage.UNUSED], [W.indeterminate, usage.INDETERMINATE], [W.nrShort, usage.none]].filter(([, n]) => n).map(([name, n]) => `${name} ${n}`).join(' · ')
const findingsText = (W, findings) => findings === null ? W.findingsNr : `${W.findings} ${findings}`
const orNr = (W, value) => value === null || value === undefined ? W.nrShort : value
const sumLevels = list => Object.fromEntries([...LEVELS, 'none'].map(k => [k, list.reduce((sum, counts) => sum + counts[k], 0)]))
const packageName = (W, name) => name === NO_PACKAGE ? W.noPackage : name
const EMPTY = statsOf([])

/** The packages of a view: those of the register of the view and, in a to-be, also those only at the start. */
function packagesIn(data) {
  const now = packagesOf(data.register.objects)
  const start = data.start ? packagesOf(data.start.objects) : null
  const names = [...new Set([...now.keys(), ...(start?.keys() ?? [])])].sort()
  // the levels at the start: of the register of the start, else what the register of today remembers of it
  const startLevels = name => (start ? start.get(name)?.levelStart : now.get(name)?.levelStart) ?? EMPTY.levelStart
  return { names, now: name => now.get(name) ?? EMPTY, start: name => start ? start.get(name) ?? EMPTY : null, startLevels }
}
const allDone = stats => stats.objects > 0 && stats.done === stats.objects

function mapModel(data, W) {
  const toBe = data.mode === 'to-be'
  const p = packagesIn(data)
  const uses = data.uses ? packageUses([...data.register.objects, ...(data.start?.objects ?? [])], data.uses) : null
  const domains = domainsOf(p.names)
  const bandOf = new Map(domains.flatMap(d => d.packages.map(name => [name, d.domain ?? ''])))
  const between = new Map()
  for (const [pair, count] of uses?.pairs ?? []) {
    const [a, b] = pair.split('\u0000').map(name => bandOf.get(name))
    if (a !== b) between.set(`${a}\u0000${b}`, (between.get(`${a}\u0000${b}`) ?? 0) + count)
  }
  const card = name => {
    const s = p.now(name), st = p.start(name)
    const text = block(INNER).title(packageName(W, name))
    if (toBe) {
      text.line(`${W.objects} ${s.objects} (${W.start} ${orNr(W, st?.objects)}) · ${W.retired} ${s.retired}`)
      text.line(`${W.done} ${s.done} ${W.of} ${s.objects} · ${W.findings} ${orNr(W, s.findings)} (${W.start} ${orNr(W, st?.findings)})`)
      text.line(levelLine(W, W.startLevel, p.startLevels(name))).line(levelLine(W, W.nowLevel, s.levelNow))
    } else {
      text.line(`${W.objects} ${s.objects} · ${findingsText(W, s.findings)}`).line(usageLine(W, s.usage)).line(levelLine(W, W.level, s.levelStart))
    }
    if (uses) {
      const used = [...(uses.uses.get(name) ?? [])].sort()
      text.line(`${W.uses} ${used.length} · ${W.usedBy} ${(uses.usedBy.get(name) ?? new Set()).size}`)
      if (used.length) text.names('→ ', used.map(n => packageName(W, n)))
    }
    return { key: `package:${name}`, text, good: toBe && allDone(s) }
  }
  const bands = domains.map(d => {
    const key = d.domain ?? ''
    const stats = d.packages.map(p.now)
    const text = block(LABEL_W - 16).title(d.domain === null ? W.other : packageName(W, d.domain), { wrap: true })
      .line(`${W.packages} ${d.packages.length} · ${W.objects} ${stats.reduce((sum, s) => sum + s.objects, 0)}`)
    if (uses) {
      const out = [...between.keys()].filter(k => k.startsWith(`${key}\u0000`)).length
      const into = [...between.keys()].filter(k => k.endsWith(`\u0000${key}`)).length
      text.line(`${W.usesDomains} ${out} · ${W.usedByDomains} ${into}`)
    }
    return { key: `band:${key}`, text, cards: d.packages.map(card) }
  })
  const all = p.names.map(p.now)
  const total = statsOf(all.flatMap(s => s.rows ?? []))
  const summary = block(0)
  summary.rows.push(...block(Infinity).line(`${W.packages} ${p.names.length} · ${W.objects} ${total.objects} · ${findingsText(W, total.findings)}` +
    (toBe ? ` · ${W.done} ${total.done} · ${W.retired} ${total.retired}` : '')).rows)
  const lines = [uses ? `${W.whereUsed}: ${W.pairs} ${uses.pairs.size} · ${W.relations} ${[...uses.pairs.values()].reduce((a, b) => a + b, 0)} · ` +
    `${W.inside} ${uses.inside} · ${W.outside} ${uses.outside}` : W.usesMissing]
  const outside = data.register.objects.filter(o => MODIFICATIONS.has(o.type))
  if (outside.length) lines.push(`${W.mods} ${outside.filter(o => o.type === 'MOD').length} · ${W.notes} ${outside.filter(o => o.type === 'NOTE').length}`)
  return { summary: [summary.rows[0].runs[0].t, ...lines], bands,
    edges: [...between.keys()].sort().map(k => k.split('\u0000').map(d => `band:${d}`)),
    legend: [W.legend.map, ...(toBe ? [W.legend.green] : [])], arrows: W.legend.mapArrows }
}

function wavesModel(data, W) {
  const toBe = data.mode === 'to-be'
  const p = packagesIn(data)
  const waves = data.waves ?? []
  const orderOf = new Map(waves.map(w => [w.title, w.order]))
  const taken = new Set()
  const card = (name, band, rows, units) => {
    const s = statsOf(rows)
    const text = block(INNER).title(packageName(W, name))
    if (toBe) text.line(`${W.done} ${s.done} ${W.of} ${s.objects}` + (units === null ? '' : ` · ${W.units} ${units}`))
    else text.line(units === null ? `${W.inRegister} ${s.objects}` : `${W.units} ${units} · ${W.objects} ${s.objects}`)
    text.line(findingsText(W, s.findings)).line(toBe ? levelLine(W, W.nowLevel, s.levelNow) : levelLine(W, W.level, s.levelStart))
    return { key: `package:${name}@${band}`, text, good: toBe && allDone(s) }
  }
  const bands = waves.map((w, n) => {
    const scope = waveScope(w, data.register.objects)
    const known = [...scope.byPackage].filter(([name]) => p.names.includes(name))
    for (const [name] of known) taken.add(name)
    const text = block(LABEL_W - 16).title(w.title, { wrap: true })
      .line(`${W.order} ${w.order} · ${W.objects} ${orNr(W, w.count)} · ${W.findings} ${orNr(W, w.findings)}`)
    if (toBe) { const s = statsOf(scope.rows); text.line(`${W.done} ${s.done} ${W.of} ${s.objects} · ${W.findingsNow} ${orNr(W, s.findings)}`) }
    if (w.focus) text.line(`${W.focus}: ${W.focusNames[w.focus] ?? w.focus}`)
    const before = w.dependsOn.filter(t => orderOf.has(t)).map(t => orderOf.get(t)).sort((a, b) => a - b)
    if (before.length) text.line(`${W.after}: ${before.join(', ')}`)
    if (before.length < w.dependsOn.length) text.line(`${W.depsUnknown} ${w.dependsOn.length - before.length}`)
    if (known.length < scope.byPackage.size) text.line(`${W.notInRegister} ${scope.byPackage.size - known.length}`)
    return { key: `wave:${n + 1}`, text, cards: known.map(([name, part]) => card(name, n + 1, part.rows, w.packages ? null : part.units)) }
  })
  const out = p.names.filter(name => !taken.has(name))
  if (out.length) bands.push({ key: 'wave:none', cards: out.map(name => card(name, 'none', p.now(name).rows ?? [], null)),
    text: block(LABEL_W - 16).title(W.notInWave, { wrap: true })
      .line(`${W.packages} ${out.length} · ${W.objects} ${out.reduce((sum, name) => sum + p.now(name).objects, 0)}`) })
  const index = new Map(waves.map((w, n) => [w.title, n + 1]))
  const edges = waves.flatMap((w, n) => w.dependsOn.filter(t => index.has(t) && index.get(t) !== n + 1).map(t => [`wave:${index.get(t)}`, `wave:${n + 1}`]))
  const planned = key => waves.some(w => w[key] !== null) ? waves.reduce((sum, w) => sum + (w[key] ?? 0), 0) : null
  const summary = data.waves ? [`${W.waves} ${waves.length} · ${W.objectsPlan} ${orNr(W, planned('count'))} · ${W.findings} ${orNr(W, planned('findings'))}`,
    `${W.packagesInWaves} ${taken.size} · ${W.packagesOut} ${out.length}`] : [W.wavesMissing]
  return { summary, bands, edges: [...new Set(edges.map(e => e.join('\u0000')))].sort().map(e => e.split('\u0000')),
    legend: [W.legend.waves, ...(toBe ? [W.legend.green] : [])], arrows: W.legend.wavesArrows }
}

function cleanCoreModel(data, W) {
  const toBe = data.mode === 'to-be'
  const p = packagesIn(data)
  const share = counts => shareAB(counts) === null ? W.nrShort : `${shareAB(counts)}%`
  const lines = (text, start, now) => {
    if (!toBe) return text.line(levelLine(W, W.level, start)).line(`${W.share} ${share(start)}`)
    return text.line(levelLine(W, W.startLevel, start)).line(levelLine(W, W.nowLevel, now)).line(`${W.share} ${share(start)} → ${share(now)}`)
  }
  const card = name => {
    const s = p.now(name), start = p.startLevels(name)
    const text = lines(block(INNER).title(packageName(W, name)).line(`${W.objects} ${s.objects}`), start, s.levelNow)
    return { key: `package:${name}`, text, bars: (toBe ? [start, s.levelNow] : [start]).map(counts => recorded(counts) ? counts : null) }
  }
  const bands = domainsOf(p.names).map(d => {
    const stats = d.packages.map(p.now)
    const text = block(LABEL_W - 16).title(d.domain === null ? W.other : packageName(W, d.domain), { wrap: true })
      .line(`${W.packages} ${d.packages.length} · ${W.objects} ${stats.reduce((sum, s) => sum + s.objects, 0)}`)
    return { key: `band:${d.domain ?? ''}`, cards: d.packages.map(card),
      text: lines(text, sumLevels(d.packages.map(p.startLevels)), sumLevels(stats.map(s => s.levelNow))) }
  })
  const start = sumLevels(p.names.map(p.startLevels)), now = sumLevels(p.names.map(name => p.now(name).levelNow))
  const summary = [`${W.packages} ${p.names.length} · ${W.objects} ${p.names.reduce((sum, name) => sum + p.now(name).objects, 0)}`,
    ...(toBe ? [levelLine(W, W.startLevel, start), levelLine(W, W.nowLevel, now), `${W.share} ${share(start)} → ${share(now)}`]
      : [levelLine(W, W.level, start), `${W.share} ${share(start)}`])]
  // the units by level of the volumes of the program (CC_LEVEL_A..UNKNOWN), when they were exported
  const units = pick => LEVELS.map(level => [level, pick(firstAndLast(data.volumes?.history ?? [], `CC_LEVEL_${level}`))]).filter(([, v]) => v !== null && v !== undefined)
  const unitsLine = (label, values) => `${label}: ` + values.map(([level, v]) => `${level === 'UNKNOWN' ? '?' : level} ${v}`).join(' · ')
  const first = units(m => m?.first.value), last = units(m => m?.last?.value)
  if (first.length) summary.push(unitsLine(W.volumesStart, first))
  if (toBe && last.length) summary.push(unitsLine(W.volumesNow, last))
  return { summary, bands, edges: [], legend: [W.legend.cleanCore, ...(toBe ? [W.legend.bars] : [])], swatches: true }
}

function landscapeModel(data, W) {
  const { systems, source } = data.landscape
  const cards = systems.map((s, n) => ({
    key: `system:${n + 1}`, name: s.name, from: s.from, linked: Boolean(s.connection) && !s.from,
    text: block(INNER).title(s.name ?? W.programSystem).line(s.role ?? `${W.role}: ${W.nr}`).line(`${W.release}: ${s.release ?? W.nr}`)
      .line(`${W.connection}: ${s.connection ?? W.nr}`)
  }))
  return { summary: [`${W.systems} ${systems.length}`, W.landscape[source]], cards, legend: [W.legend.landscape],
    hub: block(400).title(data.program ?? W.program, { wrap: true }).line(W.hub) }
}

// ---- the layout: lanes one under the other, boxes on a grid inside them, arrows in the channel beside the lanes

const vertex = (id, box, style, html = '', parent = '1') => ({ id, box, style, html, parent })

/** The furniture of every page: title, subtitle, summary, legend and footer. Returns the y where the content starts. */
function furniture(page, model, ctx, { first, legendAt }) {
  const { W, sheet } = ctx
  const width = page.w - 2 * M
  const title = `${ctx.words.views[ctx.view]} · ${ctx.words.mode[ctx.mode]}`
  page.cells.push(vertex('title', [M, 26, width, 30], TEXT_CELL, `<b style="font-size:22px;color:${TITLE}">${esc(fitText(title, 22, width, true))}</b>`))
  const sub = [ctx.program, ctx.words.subtitle[ctx.mode], ...(ctx.pages > 1 ? [ctx.words.page(page.n, ctx.pages)] : [])].filter(Boolean).join(' · ')
  page.cells.push(vertex('subtitle', [M, 60, width, 20], TEXT_CELL, `<span style="font-size:13px;color:${BODY}">${esc(fitText(sub, 13, width))}</span>`))
  let y = 90
  if (first) {
    const text = block(width - 20)
    for (const line of model.summary) text.line(line, 11)
    const h = text.height() + 14
    page.cells.push(vertex('summary', [M, y, width, h], `${CARD}strokeColor=${OWN};fillColor=${OWN_FILL};`, text.html()))
    y += h + 12
  }
  if (legendAt !== undefined) {
    let ly = legendAt
    if (model.swatches) {
      let x = M
      for (const level of [...LEVELS, 'none']) {
        page.cells.push(vertex(`swatch:${level}`, [x, ly + 2, 12, 12], `rounded=0;whiteSpace=wrap;html=1;strokeColor=${level === 'none' ? NON : LEVEL_COLORS[level]};fillColor=${LEVEL_COLORS[level]};`))
        const name = W.legend.levels[level]
        const w = Math.ceil(textWidth(name, 10)) + 6
        page.cells.push(vertex(`swatch-name:${level}`, [x + 18, ly, w, 14], TEXT_CELL, `<span style="font-size:10px;color:${BODY}">${esc(name)}</span>`))
        x += 18 + w + 16
      }
      ly += 20
    }
    const legend = block(width)
    for (const line of ctx.legend) legend.line(line)
    page.cells.push(vertex('legend', [M, ly, width, legend.height() + 2], TEXT_CELL, legend.html()))
  }
  page.cells.push(vertex('nova-meta', [M, page.h - 34, width, 14],
    `${TEXT_CELL}novaView=${ctx.view};novaMode=${ctx.mode};novaLang=${ctx.lang};novaSheet=${sheet};novaLayout=${LAYOUT};novaFingerprint=${ctx.fingerprint};`,
    `<span style="font-size:10px;color:${BODY}">${esc(W.footer(sheet, round(10 * PT_PER_PX), ctx.fingerprint.slice(0, 12)))}</span>`))
  return y
}
const legendHeight = (ctx, model, width) => {
  const legend = block(width)
  for (const line of ctx.legend) legend.line(line)
  return legend.height() + 2 + (model.swatches ? 20 : 0)
}
const summaryHeight = (model, width) => {
  const text = block(width - 20)
  for (const line of model.summary) text.line(line, 11)
  return text.height() + 14 + 12
}

/** The tracks of the arrows in the channel, on the order of the lanes alone: [{ from, to, a, b, track }] and how many tracks. */
function routes(bands, edges) {
  const index = new Map(bands.map((b, n) => [b.key, n]))
  const list = edges.map(([from, to]) => ({ from: index.get(from), to: index.get(to) })).filter(e => e.from !== undefined && e.to !== undefined)
  // the ports of a lane, from top to bottom: by the lane at the other end, an arrow that leaves before one that arrives
  const ports = bands.map(() => [])
  list.forEach(e => { ports[e.from].push({ e, other: e.to, out: 0 }); ports[e.to].push({ e, other: e.from, out: 1 }) })
  ports.forEach((p, n) => p.sort((x, y) => x.other - y.other || x.out - y.out).forEach((port, k) => {
    port.e[port.out === 0 ? 'a' : 'b'] = k
    port.e[port.out === 0 ? 'pa' : 'pb'] = n + (k + 1) / (p.length + 1)
  }))
  // the shortest arrows nearest to the lanes; two arrows share a track only when they do not overlap
  const tracks = []
  for (const e of [...list].sort((x, y) => Math.abs(x.pa - x.pb) - Math.abs(y.pa - y.pb) || Math.min(x.pa, x.pb) - Math.min(y.pa, y.pb))) {
    const lo = Math.min(e.pa, e.pb), hi = Math.max(e.pa, e.pb)
    let t = tracks.findIndex(taken => taken.every(([a, b]) => hi < a || lo > b))
    if (t < 0) { t = tracks.length; tracks.push([]) }
    tracks[t].push([lo, hi])
    e.track = t
  }
  return { list, tracks: tracks.length, ports: ports.map(p => p.length) }
}

/** The pages of a view of lanes: the smallest sheet that holds everything on one page, else as many A0 as it takes. */
function lanePages(model, ctx) {
  const cardText = Math.max(0, ...model.bands.flatMap(b => b.cards.map(c => c.text.height())))
  const bars = Math.max(0, ...model.bands.flatMap(b => b.cards.map(c => c.bars?.length ?? 0)))
  const cardH = Math.ceil(cardText + (bars ? 4 + bars * (BAR_H + 4) : 0) + 14)
  const routed = routes(model.bands, model.edges)
  const drawable = routed.list.length > 0 && routed.list.length <= MAX_ARROWS && routed.tracks <= MAX_TRACKS

  const attempt = (sheet, w, h, arrows, single) => {
    // what the legend says of the arrows: drawn, too many to draw, or not drawn because the lanes are on several pages
    const legend = [...model.legend, ...(!routed.list.length ? [] : [arrows ? model.arrows
      : drawable ? ctx.words.legend.pages : ctx.words.legend.tooMany(routed.list.length)])]
    const local = { ...ctx, sheet, legend }
    const channel = arrows ? 12 + routed.tracks * TRACK + 6 : 0
    const bandX = M + channel, bandW = w - 2 * M - channel
    const cols = Math.floor((bandW - LABEL_W - PAD + GAP) / (CARD_W + GAP))
    if (cols < 1) return null
    const legendH = legendHeight(local, model, w - 2 * M)
    const bottom = h - 34 - 8 - legendH - 6
    // the parts of the lanes on their pages: a lane that does not fit a whole page goes on, row by row, on the next
    const pages = [[]]
    let y = 90 + summaryHeight(model, w - 2 * M)
    model.bands.forEach((band, n) => {
      const rows = Math.max(1, Math.ceil(band.cards.length / cols))
      const minimum = Math.max(band.text.height(), arrows ? PORT_TOP + routed.ports[n] * PORT - 2 * PAD + 8 : 0)
      let row = 0
      do {
        const room = Math.floor((bottom - y - 2 * PAD + GAP) / (cardH + GAP))
        const fits = bottom - y >= Math.max(minimum, cardH) + 2 * PAD
        const take = Math.min(rows - row, room)
        // a lane starts on a new page rather than leaving a few rows behind, unless it is longer than a page
        const whole = Math.floor((bottom - 90 - 2 * PAD + GAP) / (cardH + GAP))
        if (!fits || take < 1 || (take < rows - row && rows - row <= whole && pages[pages.length - 1].length)) {
          if (!pages[pages.length - 1].length && (!fits || take < 1)) return
          pages.push([]); y = 90
          continue
        }
        const height = Math.max(minimum, take * cardH + (take - 1) * GAP) + 2 * PAD
        pages[pages.length - 1].push({ band, n, y, height, from: row * cols, to: Math.min(band.cards.length, (row + take) * cols), part: row > 0 })
        y += height + GAP
        row += take
      } while (row < rows)
    })
    const placed = pages.flat()
    if (new Set(placed.map(part => part.n)).size < model.bands.length) return null
    if (single && pages.length > 1) return null
    return pages.map((parts, pageIndex) => {
      const page = { n: pageIndex + 1, w, h, sheet, cells: [], edges: [] }
      const end = parts.length ? parts[parts.length - 1].y + parts[parts.length - 1].height : 90
      furniture(page, model, { ...local, pages: pages.length }, { first: pageIndex === 0, legendAt: end + 8 })
      for (const part of parts) {
        const { band } = part
        const id = part.part ? `${band.key}#${page.n}` : band.key
        page.cells.push(vertex(id, [bandX, part.y, bandW, part.height], BAND))
        const label = part.part ? block(LABEL_W - 16).title(plainOf(band.text.html().split('<br>')[0]), { wrap: true }).line(ctx.words.continued) : band.text
        page.cells.push(vertex(`label:${id}`, [bandX + 10, part.y + PAD, LABEL_W - 16, label.height() + 2], TEXT_CELL, label.html(), id))
        band.cards.slice(part.from, part.to).forEach((card, k) => {
          const x = bandX + LABEL_W + (k % cols) * (CARD_W + GAP), cy = part.y + PAD + Math.floor(k / cols) * (cardH + GAP)
          page.cells.push(vertex(card.key, [x, cy, CARD_W, cardH], `${CARD}strokeColor=${card.good ? GOOD : NON};fillColor=${card.good ? GOOD_FILL : WHITE};`, card.text.html(), id))
          ;(card.bars ?? []).forEach((counts, r) => {
            if (!counts) return
            const total = [...LEVELS, 'none'].reduce((sum, level) => sum + counts[level], 0)
            const by = cy + cardH - 8 - (card.bars.length - r) * (BAR_H + 4) + 4
            let seen = 0
            for (const level of [...LEVELS, 'none']) {
              const x0 = Math.round(seen / total * (CARD_W - 16))
              seen += counts[level]
              const x1 = Math.round(seen / total * (CARD_W - 16))
              if (x1 > x0) page.cells.push(vertex(`bar:${card.key.slice(8)}:${r}:${level}`, [x + 8 + x0, by, x1 - x0, BAR_H],
                `rounded=0;whiteSpace=wrap;html=1;strokeColor=${level === 'none' ? NON : LEVEL_COLORS[level]};fillColor=${LEVEL_COLORS[level]};`, '', card.key))
            }
          })
        })
      }
      if (arrows) {
        const at = new Map(parts.map(part => [part.n, part]))
        for (const e of routed.list) {
          const a = at.get(e.from), b = at.get(e.to)
          const fa = fraction((PORT_TOP + e.a * PORT) / a.height), fb = fraction((PORT_TOP + e.b * PORT) / b.height)
          const x = bandX - 12 - e.track * TRACK
          page.edges.push({ id: `edge:${model.bands[e.from].key}>${model.bands[e.to].key}`, source: model.bands[e.from].key, target: model.bands[e.to].key,
            exit: [0, fa], entry: [0, fb], points: [[x, round(a.y + fa * a.height)], [x, round(b.y + fb * b.height)]] })
        }
      }
      return page
    })
  }
  for (const [sheet, w, h] of SHEETS) {
    const pages = attempt(sheet, w, h, drawable, true)
    if (pages) return pages
  }
  const [sheet, w, h] = SHEETS[SHEETS.length - 1]
  const pages = attempt(sheet, w, h, false, false)
  if (!pages) throw new Error(`${ctx.view}: a lane does not fit a page of the sheet ${sheet}`)
  return pages
}

/** The page of the landscape: the program above, its systems in a row under it, the links between systems below them. */
function landscapePages(model, ctx) {
  const SYSTEM_W = CARD_W + 10, STEP = SYSTEM_W + 40
  const n = model.cards.length
  const rowW = Math.max(n * SYSTEM_W + Math.max(0, n - 1) * 40, 440)
  const cardH = Math.ceil(Math.max(0, ...model.cards.map(c => c.text.height())) + 14)
  const hubH = Math.ceil(model.hub.height() + 14)
  const index = new Map(model.cards.map((c, k) => [c.name?.toUpperCase(), k]))
  const links = model.cards.map((c, k) => ({ from: index.get(c.from?.toUpperCase()), to: k })).filter(l => l.from !== undefined)
  // the links under the row, each on its track: the shortest nearest to the systems
  const tracks = []
  for (const l of [...links].sort((x, y) => Math.abs(x.from - x.to) - Math.abs(y.from - y.to) || Math.min(x.from, x.to) - Math.min(y.from, y.to))) {
    const lo = Math.min(l.from, l.to), hi = Math.max(l.from, l.to)
    let t = tracks.findIndex(taken => taken.every(([a, b]) => hi < a || lo > b))
    if (t < 0) { t = tracks.length; tracks.push([]) }
    tracks[t].push([lo, hi])
    l.track = t
  }
  const local = { ...ctx, legend: model.legend, pages: 1 }
  for (const [sheet, w, h] of SHEETS) {
    const top = 90 + summaryHeight(model, w - 2 * M)
    const rowY = top + hubH + 60
    const end = n ? rowY + cardH + (tracks.length ? 14 + tracks.length * 10 : 0) : top + hubH
    if (rowW + 2 * M > w || end + 8 + legendHeight(local, model, w - 2 * M) + 6 > h - 34 - 8) continue
    const page = { n: 1, w, h, sheet, cells: [], edges: [] }
    furniture(page, model, { ...local, sheet }, { first: true, legendAt: end + 8 })
    const x0 = Math.round((w - rowW) / 2)
    page.cells.push(vertex('hub', [x0, top, rowW, hubH], `${CARD}strokeColor=${OWN};fillColor=${WHITE};`, model.hub.html()))
    const ports = model.cards.map((_, k) => links.filter(l => l.from === k || l.to === k).sort((a, b) => (a.from === k ? a.to : a.from) - (b.from === k ? b.to : b.from)))
    model.cards.forEach((card, k) => {
      const x = x0 + k * STEP
      page.cells.push(vertex(card.key, [x, rowY, SYSTEM_W, cardH], `${CARD}strokeColor=${SAP};fillColor=${WHITE};`, card.text.html()))
      if (card.linked) page.edges.push({ id: `edge:hub>${card.key}`, source: 'hub', target: card.key, plain: true,
        exit: [fraction((x + SYSTEM_W / 2 - x0) / rowW), 1], entry: [0.5, 0], points: [] })
    })
    for (const l of links) {
      const port = k => { const list = ports[k]; return fraction(0.5 + (list.indexOf(l) - (list.length - 1) / 2) * 14 / SYSTEM_W) }
      const y = rowY + cardH + 14 + l.track * 10
      const xa = x0 + l.from * STEP + port(l.from) * SYSTEM_W, xb = x0 + l.to * STEP + port(l.to) * SYSTEM_W
      page.edges.push({ id: `edge:${model.cards[l.from].key}>${model.cards[l.to].key}`, source: model.cards[l.from].key, target: model.cards[l.to].key,
        exit: [port(l.from), 1], entry: [port(l.to), 1], points: [[round(xa), y], [round(xb), y]] })
    }
    return [page]
  }
  throw new Error(`landscape: ${n} systems do not fit the sheet ${SHEETS[SHEETS.length - 1][0]}`)
}

// ---- the file

function xmlOf(pages, name) {
  const body = pages.map(page => {
    const boxes = new Map(page.cells.map(c => [c.id, c.box]))
    const cells = page.cells.map(c => {
      const [px, py] = c.parent === '1' ? [0, 0] : boxes.get(c.parent)
      return `<mxCell id="${esc(c.id)}" value="${esc(c.html)}" style="${esc(c.style)}" vertex="1" parent="${esc(c.parent)}">` +
        `<mxGeometry x="${round(c.box[0] - px)}" y="${round(c.box[1] - py)}" width="${round(c.box[2])}" height="${round(c.box[3])}" as="geometry"/></mxCell>`
    })
    const edges = page.edges.map(e => `<mxCell id="${esc(e.id)}" value="" style="${esc(`${EDGE}${e.plain ? 'endArrow=none;' : ''}exitX=${e.exit[0]};exitY=${e.exit[1]};exitDx=0;exitDy=0;entryX=${e.entry[0]};entryY=${e.entry[1]};entryDx=0;entryDy=0;`)}" ` +
      `edge="1" parent="1" source="${esc(e.source)}" target="${esc(e.target)}"><mxGeometry relative="1" as="geometry">` +
      (e.points.length ? `<Array as="points">${e.points.map(([x, y]) => `<mxPoint x="${x}" y="${y}"/>`).join('')}</Array>` : '') + '</mxGeometry></mxCell>')
    const id = pages.length > 1 ? `${name}-${page.n}` : name
    return `<diagram id="${esc(id)}" name="${esc(id)}"><mxGraphModel dx="${page.w}" dy="${page.h}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" ` +
      `arrows="1" fold="1" page="1" pageScale="1" pageWidth="${page.w}" pageHeight="${page.h}" math="0" shadow="0" background="#FFFFFF">` +
      `<root><mxCell id="0"/><mxCell id="1" parent="0"/>\n${[...cells, ...edges].join('\n')}\n</root></mxGraphModel></diagram>`
  })
  return `<mxfile host="drawio" version="24.7.17">${body.join('\n')}</mxfile>\n`
}

/** What a view is made from: its inputs, for the fingerprint. */
function inputsOf(view, data) {
  const base = { layout: LAYOUT, view, mode: data.mode, lang: data.lang, program: data.program }
  if (view === 'landscape') return { ...base, landscape: data.landscape }
  const registers = { register: data.register.objects, start: data.start?.objects ?? null }
  if (view === 'custom-code-map') return { ...base, ...registers, uses: data.uses ?? null }
  if (view === 'waves') return { ...base, ...registers, waves: data.waves ?? null }
  return { ...base, ...registers, volumes: (data.volumes?.history ?? []).filter(h => h.wave === null && h.measure.startsWith('CC_LEVEL_')) }
}

/** One view of a program as a draw.io file: { name, xml, pages, sheet, fingerprint }. */
export function diagramOf(view, data) {
  if (!VIEWS.includes(view)) throw new Error(`unknown view ${view}: one of ${VIEWS.join(', ')}`)
  const words = WORDS[data.lang]
  const ctx = { view, mode: data.mode, lang: data.lang, program: data.program, words, W: words, fingerprint: fingerprintOf(inputsOf(view, data)) }
  const model = { landscape: landscapeModel, 'custom-code-map': mapModel, waves: wavesModel, 'clean-core': cleanCoreModel }[view](data, words)
  const pages = view === 'landscape' ? landscapePages(model, ctx) : lanePages(model, ctx)
  const name = `${data.mode}-${view}`
  return { name, xml: xmlOf(pages, name), pages, sheet: pages[0].sheet, fingerprint: ctx.fingerprint }
}

// ---- the checks, on the file as it is on disk

/** The pages of a draw.io file: [{ width, height, cells: Map id → { id, html, style, vertex, edge, parent, box, source, target, points } }]. */
export function readDiagram(text) {
  const tree = parseXml(text)
  const elements = node => node.children.filter(c => c.type === 'element')
  const find = (node, name) => { for (const e of elements(node)) { if (e.name === name) return e; const deep = find(e, name); if (deep) return deep } return null }
  const all = (node, name, out = []) => { for (const e of elements(node)) { if (e.name === name) out.push(e); else all(e, name, out) } return out }
  return all(tree, 'diagram').map(diagram => {
    let model = find(diagram, 'mxGraphModel')
    if (!model) {
      // a diagram saved compressed by draw.io: base64 of a raw deflate of the URI-encoded XML
      const raw = diagram.children.filter(c => c.type === 'text').map(c => c.raw).join('').trim()
      model = find(parseXml(decodeURIComponent(inflateRawSync(Buffer.from(raw, 'base64')).toString('utf8'))), 'mxGraphModel')
    }
    const cells = new Map()
    for (const node of elements(find(model, 'root') ?? model)) {
      const inner = node.name === 'mxCell' ? node : elements(node).find(e => e.name === 'mxCell')
      if (!inner) continue
      const geometry = elements(inner).find(e => e.name === 'mxGeometry')
      const number = key => geometry && Number.isFinite(Number(attr(geometry, key))) ? Number(attr(geometry, key)) : 0
      const points = geometry ? all(geometry, 'mxPoint').filter(p => !attr(p, 'as')).map(p => [Number(attr(p, 'x')), Number(attr(p, 'y'))]) : []
      const id = attr(node, 'id') ?? attr(inner, 'id')
      cells.set(id, { id, html: attr(node, 'value') ?? attr(node, 'label') ?? '', style: Object.fromEntries(parseStyle(attr(inner, 'style'))),
        vertex: attr(inner, 'vertex') === '1', edge: attr(inner, 'edge') === '1', parent: attr(inner, 'parent'), source: attr(inner, 'source'),
        target: attr(inner, 'target'), points, box: [number('x'), number('y'), number('width'), number('height')] })
    }
    // positions on the page: a child is written relative to its parent
    const absolute = cell => {
      if (cell.absolute) return cell.absolute
      const parent = cells.get(cell.parent)
      const [px, py] = parent?.vertex ? absolute(parent) : [0, 0]
      return (cell.absolute = [cell.box[0] + px, cell.box[1] + py, cell.box[2], cell.box[3]])
    }
    for (const cell of cells.values()) if (cell.vertex) absolute(cell)
    return { width: Number(attr(model, 'pageWidth')), height: Number(attr(model, 'pageHeight')), cells }
  })
}

/** The rows of a label with the size of their text: [{ width, height }], as a browser lays them out. */
function labelRows(html, base, boldCell) {
  const rows = [{ width: 0, size: 0 }]
  const stack = []
  for (const token of String(html).split(/(<[^>]+>)/)) {
    if (!token) continue
    if (/^<br\s*\/?>$/i.test(token)) { rows.push({ width: 0, size: 0 }); continue }
    const open = /^<([a-z0-9]+)\b([^>]*)>$/i.exec(token)
    if (open) { stack.push({ tag: open[1].toLowerCase(), size: Number(/font-size:\s*([\d.]+)px/i.exec(open[2])?.[1]) || null }); continue }
    if (/^<\//.test(token)) { stack.pop(); continue }
    const size = [...stack].reverse().find(s => s.size)?.size ?? base
    const bold = boldCell || stack.some(s => s.tag === 'b' || s.tag === 'strong')
    const row = rows[rows.length - 1]
    row.width += textWidth(decode(token), size, bold)
    row.size = Math.max(row.size, size)
  }
  return rows.map(row => ({ width: row.width, height: (row.size || base) * LINE }))
}
const fontSizes = cell => [...(cell.html ? [Number(cell.style.fontSize) || 12] : []), ...[...String(cell.html).matchAll(/font-size:\s*([\d.]+)px/gi)].map(m => Number(m[1]))]

/** The problems of the shapes of one page, whatever they say: overlaps, texts that do not fit, the page, the print size. */
export function geometryProblems(page, sheet) {
  const problems = []
  const cells = [...page.cells.values()]
  const shapes = cells.filter(c => c.vertex && c.absolute[2] > 0 && c.absolute[3] > 0)
  const ancestors = cell => { const out = new Set(); for (let p = page.cells.get(cell.parent); p; p = page.cells.get(p.parent)) out.add(p.id); return out }
  const up = new Map(shapes.map(c => [c.id, ancestors(c)]))
  const EPS = 0.5
  for (const c of shapes) {
    const [x, y, w, h] = c.absolute
    if (x < -EPS || y < -EPS || x + w > page.width + EPS || y + h > page.height + EPS) problems.push(`${c.id}: outside the page`)
    const parent = page.cells.get(c.parent)
    if (parent?.vertex) {
      const [px, py, pw, ph] = parent.absolute
      if (x < px - EPS || y < py - EPS || x + w > px + pw + EPS || y + h > py + ph + EPS) problems.push(`${c.id}: outside ${parent.id}, the shape it belongs to`)
    }
  }
  // shapes that overlap: a sweep from left to right; a shape and what it contains are one thing
  const sorted = [...shapes].sort((a, b) => a.absolute[0] - b.absolute[0])
  sorted.forEach((a, i) => {
    for (let j = i + 1; j < sorted.length && sorted[j].absolute[0] < a.absolute[0] + a.absolute[2] - EPS; j++) {
      const b = sorted[j]
      if (up.get(a.id).has(b.id) || up.get(b.id).has(a.id)) continue
      if (a.absolute[1] < b.absolute[1] + b.absolute[3] - EPS && b.absolute[1] < a.absolute[1] + a.absolute[3] - EPS)
        problems.push(`${a.id} and ${b.id}: the shapes overlap`)
    }
  })
  // the text of a shape inside it: above what the shape contains
  const children = new Map()
  for (const c of shapes) if (page.cells.get(c.parent)?.vertex) children.set(c.parent, Math.min(children.get(c.parent) ?? Infinity, c.absolute[1]))
  for (const c of shapes) {
    if (!c.html) continue
    const s = key => Number(c.style[key]) || 0
    const border = c.style.strokeColor && c.style.strokeColor !== 'none' ? 2 * (Number(c.style.strokeWidth) || 1) : 0
    const width = c.absolute[2] - s('spacingLeft') - s('spacingRight') - 2 * s('spacing') - border
    const floor = children.has(c.id) ? children.get(c.id) - c.absolute[1] : c.absolute[3] - s('spacingBottom') - s('spacing')
    const height = floor - s('spacingTop') - s('spacing')
    const rows = labelRows(c.html, Number(c.style.fontSize) || 12, (Number(c.style.fontStyle) & 1) === 1)
    const widest = Math.max(...rows.map(r => r.width))
    if (widest > width + EPS) problems.push(`${c.id}: the text is ${Math.ceil(widest)} px wide, its shape has ${Math.floor(width)} px`)
    const tall = rows.reduce((sum, r) => sum + r.height, 0)
    if (tall > height + EPS) problems.push(`${c.id}: the text is ${Math.ceil(tall)} px tall, its shape has ${Math.floor(height)} px`)
  }
  // the smallest text, printed on the sheet of the page
  const dimensions = SHEETS.find(([name]) => name === sheet)
  if (!dimensions) problems.push(`the page names no sheet (${SHEETS.map(([name]) => name).join(', ')}): its print size is unknown`)
  else {
    const scale = Math.min(1, dimensions[1] / page.width, dimensions[2] / page.height)
    const smallest = Math.min(...cells.flatMap(fontSizes), Infinity)
    if (smallest * PT_PER_PX * scale < MIN_PT) problems.push(`the smallest text is ${round(smallest * PT_PER_PX * scale)} pt on the sheet ${sheet}, below ${MIN_PT} pt`)
  }
  // a connector across a shape that is neither of its ends
  for (const e of cells.filter(c => c.edge)) {
    const ends = [page.cells.get(e.source), page.cells.get(e.target)]
    if (!ends[0]?.vertex || !ends[1]?.vertex) { problems.push(`${e.id}: a connector without both its ends`); continue }
    const at = (cell, kx, ky) => [cell.absolute[0] + (Number(e.style[kx]) || 0) * cell.absolute[2], cell.absolute[1] + (Number(e.style[ky]) || 0) * cell.absolute[3]]
    const path = [at(ends[0], 'exitX', 'exitY'), ...e.points, at(ends[1], 'entryX', 'entryY')]
    const skip = new Set([e.source, e.target, ...up.get(e.source) ?? [], ...up.get(e.target) ?? []])
    for (let k = 0; k + 1 < path.length; k++) {
      const [x1, y1] = path[k], [x2, y2] = path[k + 1]
      const hit = shapes.find(c => !skip.has(c.id) && Math.max(x1, x2) > c.absolute[0] + EPS && Math.min(x1, x2) < c.absolute[0] + c.absolute[2] - EPS &&
        Math.max(y1, y2) > c.absolute[1] + EPS && Math.min(y1, y2) < c.absolute[1] + c.absolute[3] - EPS)
      if (hit) { problems.push(`${e.id}: the connector crosses ${hit.id}`); break }
    }
  }
  return problems
}

/** The problems of the file of a view against the data of the program: what --check prints. */
export function checkDiagram(text, view, data) {
  const problems = []
  let pages
  try { pages = readDiagram(text) } catch (error) { return [`not a draw.io file: ${error.message}`] }
  if (!pages.length) return ['not a draw.io file: no page']
  const expected = diagramOf(view, data)
  const meta = pages[0].cells.get('nova-meta')?.style ?? {}
  if (meta.novaFingerprint !== expected.fingerprint)
    problems.push(meta.novaFingerprint ? `not up to date: the data of the program changed since the file was written (run program-diagrams.mjs ${data.mode} again)`
      : 'no fingerprint of the data in the file: it was not written by program-diagrams.mjs')
  // every text of the diagram, shape by shape, against what the data say now
  const said = new Map(pages.flatMap(page => [...page.cells.values()].filter(c => c.vertex && c.html && c.id !== 'nova-meta').map(c => [c.id, c.html])))
  const wanted = new Map(expected.pages.flatMap(page => page.cells.filter(c => c.html && c.id !== 'nova-meta').map(c => [c.id, c.html])))
  const packageIn = id => id.startsWith('package:') ? id.slice(8).replace(/@[^@]*$/, '') : null
  const drawn = new Set([...said.keys()].map(packageIn).filter(Boolean)), inRegister = new Set([...wanted.keys()].map(packageIn).filter(Boolean))
  for (const name of [...inRegister].sort()) if (!drawn.has(name)) problems.push(`the package ${name} of the register is not in the diagram`)
  for (const name of [...drawn].sort()) if (!inRegister.has(name)) problems.push(`the package ${name} is in the diagram but not in the register`)
  for (const [id, html] of wanted) {
    if (!said.has(id)) { if (!packageIn(id) || drawn.has(packageIn(id))) problems.push(`${id}: missing in the diagram`); continue }
    const numbers = numbersOf(said.get(id)), right = numbersOf(html)
    if (numbers.join(' ') !== right.join(' ')) problems.push(`${id}: the diagram says ${numbers.join(', ') || 'no number'}, the data say ${right.join(', ') || 'no number'}`)
    else if (plainOf(said.get(id)) !== plainOf(html)) problems.push(`${id}: the diagram says "${plainOf(said.get(id))}", the data say "${plainOf(html)}"`)
  }
  for (const id of said.keys()) if (!wanted.has(id) && !(packageIn(id) && !inRegister.has(packageIn(id)))) problems.push(`${id}: in the diagram but not in the data`)
  pages.forEach((page, n) => {
    const sheet = page.cells.get('nova-meta')?.style.novaSheet
    for (const problem of geometryProblems(page, sheet)) problems.push(pages.length > 1 ? `page ${n + 1}: ${problem}` : problem)
  })
  return problems
}

// ---- the data of a run, the PNG and the command line

/** The data of a program for a mode, from its files: what diagramOf and checkDiagram take. */
export function loadData({ mode, root = '.', lang = 'it', program, register, now, uses, waves, systemInfo, volumes } = {}) {
  if (!MODES.includes(mode)) throw new Error(`as-is or to-be, not ${mode}`)
  if (!WORDS[lang]) throw new Error(`--lang is ${Object.keys(WORDS).join(' or ')}, not ${lang}`)
  const optional = (given, standard, normalize) => {
    if (given && !existsSync(resolve(root, given))) throw new Error(`${given}: no such file`)
    const rows = readJson(resolve(root, given ?? standard))
    return rows === undefined ? null : normalize(rows, given ?? standard)
  }
  const start = mode === 'to-be' && !register && !existsSync(resolve(root, FILES.register)) && !existsSync(resolve(root, FILES.objects))
    ? null : loadRegister(root, register)
  let current = start
  if (mode === 'to-be') {
    if (!existsSync(resolve(root, now ?? FILES.registerNow)))
      throw new Error(`${now ?? FILES.registerNow}: no such file. to-be reads the register as it is at the end: ` +
        `node nova-config.mjs objects <program> --export ${now ?? FILES.registerNow}`)
    current = loadRegister(root, now ?? FILES.registerNow)
  } else if (!start) throw new Error(`no register of the objects: ${FILES.register} (node nova-config.mjs objects <program> --export ${FILES.register}) ` +
    `or ${FILES.objects} (the inventory of the step CC_PERIMETER)`)
  if (systemInfo && !existsSync(resolve(root, systemInfo))) throw new Error(`${systemInfo}: no such file`)
  return {
    mode, lang, program: program ?? programOf(root).title, register: current, start: mode === 'to-be' ? start : null,
    uses: optional(uses, FILES.uses, normalizeUses), waves: optional(waves, FILES.waves, normalizeWaves),
    volumes: optional(volumes, FILES.volumes, normalizeVolumes), landscape: landscapeOf(readText(resolve(root, systemInfo ?? FILES.systemInfo)))
  }
}

/** The draw.io command line, or null: NOVA_DRAWIO, else drawio or draw.io on the PATH. */
export function drawioCli(env = process.env) {
  if (env.NOVA_DRAWIO !== undefined) return env.NOVA_DRAWIO && existsSync(env.NOVA_DRAWIO) ? env.NOVA_DRAWIO : null
  for (const dir of String(env.PATH ?? '').split(delimiter).filter(Boolean))
    for (const name of ['drawio', 'draw.io']) if (existsSync(join(dir, name))) return join(dir, name)
  return null
}

/** The PNG of every page of a file, with the diagram inside it (draw.io -e): the files written, and those that failed. */
function exportPng(cli, file, pages, sheet, env = process.env) {
  // twice the size of the page, as the diagrams of docs/architecture; the largest sheets at their size, because the
  // desktop application cuts an image beyond some thirty million pixels
  const scale = ['A1', 'A0'].includes(sheet) ? '1' : '2'
  const onPath = name => String(env.PATH ?? '').split(delimiter).filter(Boolean).some(dir => existsSync(join(dir, name)))
  // without a display the desktop application needs a virtual one
  const prefix = !env.DISPLAY && onPath('xvfb-run') ? ['xvfb-run', '-a'] : []
  const written = [], failed = []
  for (let page = 1; page <= pages; page++) {
    const out = file.replace(/\.drawio$/, pages > 1 ? `-${page}.png` : '.png')
    const args = [...prefix, cli, '-x', '-f', 'png', '-p', String(page), '-e', '-s', scale, '-b', '10', '-o', out, file, '--no-sandbox']
    let made = false
    // the desktop command line sometimes writes the file and does not exit: it is stopped after a while, and the
    // export counts when the file was written
    for (let attempt = 0; attempt < 2 && !made; attempt++) {
      const before = Date.now()
      spawnSync(args[0], args.slice(1), { stdio: 'ignore', timeout: 180000, killSignal: 'SIGKILL' })
      made = existsSync(out) && statSync(out).size > 0 && statSync(out).mtimeMs >= before - 1000
    }
    ;(made ? written : failed).push(out)
  }
  return { written, failed }
}

export const USAGE = 'node program-diagrams.mjs as-is|to-be [--root <repository of the program>] [--register <register.json>] ' +
  '[--now <register-final.json>] [--uses <uses.json>] [--waves <waves.json>] [--system-info <system-info.md>] [--volumes <volumes.json>] ' +
  `[--out docs/program/diagrams] [--view ${VIEWS.join(',')}] [--program <title>] [--lang it|en] [--no-png] [--check]`

export async function main(argv, { log = console.log, env = process.env } = {}) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
    root: { type: 'string', default: '.' }, register: { type: 'string' }, now: { type: 'string' }, uses: { type: 'string' },
    waves: { type: 'string' }, 'system-info': { type: 'string' }, volumes: { type: 'string' }, out: { type: 'string', default: 'docs/program/diagrams' },
    view: { type: 'string' }, program: { type: 'string' }, lang: { type: 'string' }, 'no-png': { type: 'boolean' }, check: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' } } })
  if (values.help) { log(USAGE); return 0 }
  if (positionals.length !== 1 || !MODES.includes(positionals[0])) throw new Error(`program-diagrams needs as-is or to-be\n${USAGE}`)
  const views = values.view ? values.view.split(',').map(v => v.trim()).filter(Boolean) : VIEWS
  for (const view of views) if (!VIEWS.includes(view)) throw new Error(`--view: ${view} is not one of ${VIEWS.join(', ')}`)
  const root = resolve(values.root)
  const data = loadData({ mode: positionals[0], root, lang: values.lang ?? env.NOVA_CONFIG_LANGUAGE ?? 'it', program: values.program,
    register: values.register, now: values.now, uses: values.uses, waves: values.waves, systemInfo: values['system-info'], volumes: values.volumes })
  const out = resolve(root, values.out)
  const shown = file => { const here = relative(process.cwd(), file); return here && !here.startsWith('..') ? here : file }

  if (values.check) {
    let count = 0
    for (const view of views) {
      const file = join(out, `${data.mode}-${view}.drawio`)
      const text = existsSync(file) ? readFileSync(file, 'utf8') : null
      // a file is checked in the language it was written in, unless --lang asks for another
      const written = WORDS[/novaLang=([a-z]+)/.exec(text ?? '')?.[1]] && !values.lang ? /novaLang=([a-z]+)/.exec(text)[1] : data.lang
      const problems = text === null ? [`not written: run program-diagrams.mjs ${data.mode}`] : checkDiagram(text, view, { ...data, lang: written })
      for (const problem of problems) log(`${shown(file)}: ${problem}`)
      if (!problems.length) log(`checked ${shown(file)}`)
      count += problems.length
    }
    log(`problems: ${count}`)
    return count ? 1 : 0
  }

  mkdirSync(out, { recursive: true })
  const cli = values['no-png'] ? null : drawioCli(env)
  let count = 0
  for (const view of views) {
    const diagram = diagramOf(view, data)
    const file = join(out, `${diagram.name}.drawio`)
    writeFileSync(file, diagram.xml)
    log(`wrote ${shown(file)} · sheet ${diagram.sheet} landscape, ${diagram.pages.length} page${diagram.pages.length > 1 ? 's' : ''}, ` +
      `smallest text ${round(10 * PT_PER_PX)} pt`)
    // a file just written has no problem: one here is a defect of this script, and it is said
    const problems = checkDiagram(diagram.xml, view, data)
    for (const problem of problems) log(`${shown(file)}: ${problem}`)
    count += problems.length
    if (cli) {
      const { written, failed } = exportPng(cli, file, diagram.pages.length, diagram.sheet, env)
      for (const png of written) log(`exported ${shown(png)}`)
      for (const png of failed) log(`PNG not exported: ${shown(png)} (the draw.io command line did not write it; the .drawio file is complete)`)
    }
  }
  if (!cli && !values['no-png']) log('PNG not exported: the draw.io command line (drawio) is not installed; the .drawio files are complete')
  if (count) log(`problems: ${count}`)
  return count ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  main(process.argv.slice(2)).then(code => process.exit(code), error => { console.error(error.message); process.exit(2) })
