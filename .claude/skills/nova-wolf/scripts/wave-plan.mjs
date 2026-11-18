#!/usr/bin/env node
/**
 * The waves of a custom code program, proposed from its register of the objects (docs/10, section 7.3): the step
 * CC_WAVE_PLAN runs it, the developer reviews and changes the proposal, then nova-config.mjs waves creates the waves.
 *
 *   node wave-plan.mjs --objects <register.json> [--uses <uses.json>] [--max <objects per wave>]
 *                      [--focus CODE|UI5|PERFORMANCE|PRE_UPGRADE|POST_UPGRADE] [--assessment <upgrade-before.json>]
 *                      [--with-unanalyzed] --output <waves.json> [--markdown <waves.md>]
 *
 * --objects: the register as nova-config.mjs objects <program> --export writes it ([{type, name, package, status, wave,
 *   findings}]). The waves take the objects to adapt (TO_ADAPT) in no wave; --with-unanalyzed also those not yet
 *   analyzed (TO_ANALYZE).
 * --uses: who uses whom, from the where-used of Nova ARC-1: [{"from": "CLAS ZCL_A", "to": "CLAS ZCL_B"}], ZCL_A uses ZCL_B.
 * --max: the most objects of a wave (default 150).
 * --assessment: the result of the upgrade mode of sap-erp-clean-core-refactor, phase before (docs/wolf/20, P4): the
 *   waves take only the objects of the units it fits before the upgrade (phaseFit before), with the focus PRE_UPGRADE;
 *   the others wait for the waves after the upgrade.
 *
 * How it proposes, deterministically:
 * 1. a package is a wave; packages that use each other in a circle go in the same wave (they change together);
 * 2. small packages of the same domain (ZSD_ORDERS and ZSD_PRICING: ZSD) go together, up to --max;
 * 3. a package larger than --max is split into waves of single objects (TYPE NAME (PACKAGE)), by name, never splitting
 *    an object from its parts (main in the register: the includes and the transactions of a report);
 * 4. the order: the objects used by others first (a wave after the waves it uses), then the most findings first.
 * Exit 0 with the proposal written, 2 on an error.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_MAX = 150
const WORK = new Set(['TO_ADAPT'])
// the entries of the register that are not code of the perimeter: a modification of SAP code, an SAP Note
const MODIFICATIONS = new Set(['MOD', 'NOTE'])

const keyOf = o => `${o.type} ${o.name}`
// the unit of an object: the object it is a part of (an include of a report), or itself
const unitOf = o => o.main ? String(o.main).toUpperCase().trim().split(/\s+/).join(' ') : keyOf(o)
/** The domain of a package: what comes before the first underscore (ZSD_ORDERS → ZSD), or the namespace. */
export const domainOf = pkg => pkg.startsWith('/') ? pkg.slice(0, pkg.indexOf('/', 1) + 1) || pkg : pkg.split('_')[0]

/** The strongly connected groups of a directed graph (Tarjan), as arrays of nodes, in a stable order. */
function components(nodes, edges) {
  let index = 0
  const indexOf = new Map(), low = new Map(), stack = [], on = new Set(), out = []
  const visit = node => {
    indexOf.set(node, index); low.set(node, index); index++
    stack.push(node); on.add(node)
    for (const next of [...(edges.get(node) ?? [])].sort()) {
      if (!indexOf.has(next)) { visit(next); low.set(node, Math.min(low.get(node), low.get(next))) }
      else if (on.has(next)) low.set(node, Math.min(low.get(node), indexOf.get(next)))
    }
    if (low.get(node) === indexOf.get(node)) {
      const group = []
      let top
      do { top = stack.pop(); on.delete(top); group.push(top) } while (top !== node)
      out.push(group.sort())
    }
  }
  for (const node of [...nodes].sort()) if (!indexOf.has(node)) visit(node)
  return out
}

/**
 * The proposal: `{ waves, skipped, warnings }`. Each wave: title, packages or objects (TYPE NAME (PACKAGE)), focus,
 * count (objects), findings (their sum), dependsOn (the titles of the waves it uses), order.
 */
export function proposeWaves(register, { uses = [], max = DEFAULT_MAX, focus = null, withUnanalyzed = false } = {}) {
  if (!Number.isInteger(max) || max < 1) throw new Error('--max is a whole number of objects, at least 1')
  const statuses = new Set([...WORK, ...(withUnanalyzed ? ['TO_ANALYZE'] : [])])
  // a modification of SAP code (MOD) or an SAP Note (NOTE) stays with the program: SPDD, SPAU and SE95 in SAP GUI, never
  // a wave (the brownfield phases, CC_MOD_DECISION)
  const waveWork = o => statuses.has(o.status) && !o.wave && !MODIFICATIONS.has(o.type)
  const work = register.filter(waveWork)
  const warnings = []
  const skipped = register.filter(o => !waveWork(o)).length
  const noPackage = work.filter(o => !o.package)
  if (noPackage.length) warnings.push(`${noPackage.length} objects without a package: in waves of single objects`)

  // the packages of the work, and the objects of each
  const byPackage = new Map()
  for (const o of work) {
    const pkg = o.package || '(none)'
    if (!byPackage.has(pkg)) byPackage.set(pkg, [])
    byPackage.get(pkg).push(o)
  }
  const packageOf = new Map(work.map(o => [keyOf(o), o.package || '(none)']))
  // who uses whom, between packages of the work
  const packageEdges = new Map()
  for (const { from, to } of uses) {
    const a = packageOf.get(String(from).toUpperCase()), b = packageOf.get(String(to).toUpperCase())
    if (!a || !b || a === b) continue
    if (!packageEdges.has(a)) packageEdges.set(a, new Set())
    packageEdges.get(a).add(b)
  }

  // 1. packages in a circle change together, when they fit in a wave
  let clusters = []
  for (const group of components([...byPackage.keys()], packageEdges)) {
    const size = group.reduce((sum, p) => sum + byPackage.get(p).length, 0)
    if (group.length > 1 && size > max) {
      warnings.push(`${group.join(', ')} use each other but have ${size} objects, more than ${max}: in separate waves`)
      clusters.push(...group.map(p => [p]))
    } else clusters.push(group)
  }
  // 2. small clusters of the same domain go together, up to max
  const sizeOf = cluster => cluster.reduce((sum, p) => sum + byPackage.get(p).length, 0)
  const packed = []
  for (const cluster of clusters.sort((a, b) => a[0].localeCompare(b[0]))) {
    const last = packed[packed.length - 1]
    if (last && cluster[0] !== '(none)' && last[0] !== '(none)' && domainOf(last[0]) === domainOf(cluster[0]) &&
      sizeOf(last) + sizeOf(cluster) <= max) last.push(...cluster)
    else packed.push([...cluster])
  }
  clusters = packed

  // 3. the waves: a cluster that fits is a wave of packages, a larger one waves of single objects
  const waves = []
  for (const cluster of clusters) {
    const objects = cluster.flatMap(p => byPackage.get(p))
    const findings = list => list.reduce((sum, o) => sum + (Number(o.findings) || 0), 0)
    const name = cluster.length === 1 ? cluster[0] : `${domainOf(cluster[0])}: ${cluster[0]} +${cluster.length - 1}`
    if (objects.length <= max && !cluster.includes('(none)')) {
      waves.push({ title: name, packages: cluster, keys: new Set(objects.map(keyOf)), count: objects.length, findings: findings(objects) })
      continue
    }
    // an object and its parts (includes, transactions) are one unit: never in two waves
    const units = new Map()
    for (const o of [...objects].sort((a, b) => keyOf(a).localeCompare(keyOf(b)))) {
      const unit = unitOf(o)
      if (!units.has(unit)) units.set(unit, [])
      units.get(unit).push(o)
    }
    const chunks = [[]]
    for (const members of units.values()) {
      const last = chunks[chunks.length - 1]
      if (last.length && last.length + members.length > max) chunks.push([...members])
      else last.push(...members)
    }
    const label = cluster[0] === '(none)' ? 'Objects without a package' : name
    chunks.forEach((part, n) => {
      const mains = [...new Set(part.map(unitOf))]
      waves.push({
        title: chunks.length > 1 ? `${label} (${n + 1}/${chunks.length})` : label,
        // the main object of each unit: the configurator adds its parts
        objects: mains.map(main => {
          const pkg = part.find(o => unitOf(o) === main)?.package
          return `${main}${pkg ? ` (${pkg})` : ''}`
        }),
        keys: new Set(part.map(keyOf)), count: part.length, findings: findings(part)
      })
    })
  }

  // 4. the order: a wave after the waves it uses; then the most findings, then the title
  const waveOf = new Map()
  waves.forEach((w, n) => { for (const k of w.keys) waveOf.set(k, n) })
  const needs = waves.map(() => new Set())
  for (const { from, to } of uses) {
    const a = waveOf.get(String(from).toUpperCase()), b = waveOf.get(String(to).toUpperCase())
    if (a !== undefined && b !== undefined && a !== b) needs[a].add(b)
  }
  const order = [], placed = new Set()
  const rank = (a, b) => waves[b].findings - waves[a].findings || waves[a].title.localeCompare(waves[b].title)
  while (order.length < waves.length) {
    const ready = waves.map((_, n) => n).filter(n => !placed.has(n) && [...needs[n]].every(m => placed.has(m))).sort(rank)
    // waves that use each other in a circle: the one with the most findings first, and a warning
    const next = ready[0] ?? waves.map((_, n) => n).filter(n => !placed.has(n)).sort(rank)[0]
    if (!ready.length) warnings.push(`${waves[next].title} uses waves that use it in turn: it comes first, the order is to check`)
    placed.add(next)
    order.push(next)
  }
  return {
    waves: order.map((n, position) => {
      const { keys, ...wave } = waves[n]
      return { order: position + 1, ...wave, ...(focus ? { focus } : {}),
        dependsOn: [...needs[n]].map(m => waves[m].title).sort() }
    }),
    skipped,
    warnings
  }
}

/** The proposal as a table, for docs/program/waves.md. */
export function markdownOf({ waves, skipped, warnings }) {
  const cell = text => String(text).replace(/\|/g, '\\|')
  const lines = ['| # | Wave | Packages or objects | Objects | Findings | Uses |', '|---|---|---|---|---|---|']
  for (const w of waves) {
    const scope = w.packages ? w.packages.join(', ') : `${w.objects.length} single objects: ${w.objects.slice(0, 3).join(', ')}` +
      (w.objects.length > 3 ? ', …' : '')
    lines.push(`| ${w.order} | ${cell(w.title)} | ${cell(scope)} | ${w.count} | ${w.findings} | ${cell(w.dependsOn.join(', ') || '–')} |`)
  }
  const total = waves.reduce((sum, w) => sum + w.count, 0)
  lines.push('', `${waves.length} waves, ${total} objects; ${skipped} objects of the register not in the waves (done, ` +
    'in a wave, or not to adapt).')
  if (warnings.length) lines.push('', ...warnings.map(w => `- ${w}`))
  return lines.join('\n') + '\n'
}

export const USAGE = 'node wave-plan.mjs --objects <register.json> [--uses <uses.json>] [--max <objects per wave>] ' +
  '[--focus CODE|UI5|PERFORMANCE|PRE_UPGRADE|POST_UPGRADE] [--assessment <upgrade-before.json>] [--with-unanalyzed] ' +
  '--output <waves.json> [--markdown <waves.md>]'

/**
 * The register limited to the units the phase before of the upgrade mode fits before SUM (P4, docs/wolf/20): an object
 * is kept when it, or the object it is a part of, is a unit with phaseFit before. Refuses another kind of file.
 */
export function beforeUpgrade(register, assessment) {
  if (assessment?.kind !== 'clean-core-upgrade-assessment' || assessment.phase !== 'before' || assessment.status !== 'resolved')
    throw new Error('--assessment is the resolved result of the upgrade mode, phase before (resolve-upgrade.mjs)')
  const before = new Set((assessment.units ?? []).filter(u => u.phaseFit === 'before').map(u => `${u.type} ${u.name}`))
  return register.filter(o => before.has(unitOf(o)) || before.has(keyOf(o)))
}
const FOCUS = ['CODE', 'UI5', 'PERFORMANCE', 'PRE_UPGRADE', 'POST_UPGRADE']

function argsOf(argv) {
  const options = { withUnanalyzed: false }
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i]
    if (argument === '--with-unanalyzed') options.withUnanalyzed = true
    else if (['--objects', '--uses', '--max', '--focus', '--output', '--markdown', '--assessment'].includes(argument)) {
      if (argv[i + 1] === undefined) throw new Error(`${argument} needs a value`)
      options[argument.slice(2)] = argv[++i]
    } else throw new Error(`unknown argument ${argument}`)
  }
  if (!options.objects || !options.output) throw new Error(`wave-plan needs --objects <register.json> and --output <waves.json>\n${USAGE}`)
  // the focus of an adaptation wave, as nova-config.mjs wave takes it: another value fails only when the waves are created
  if (options.focus && !FOCUS.includes(options.focus.toUpperCase())) throw new Error(`--focus is ${FOCUS.join(', ')}, not ${options.focus}`)
  return options
}

export async function main(argv, log = console.log) {
  if (argv.includes('--help') || argv.includes('-h')) {
    log(USAGE)
    return 0
  }
  const options = argsOf(argv)
  const register = JSON.parse(await readFile(resolve(options.objects), 'utf8'))
  if (!Array.isArray(register)) throw new Error(`${options.objects}: not the register (an array of objects)`)
  const uses = options.uses ? JSON.parse(await readFile(resolve(options.uses), 'utf8')) : []
  const assessment = options.assessment ? JSON.parse(await readFile(resolve(options.assessment), 'utf8')) : null
  const proposal = proposeWaves(assessment ? beforeUpgrade(register, assessment) : register, {
    uses: Array.isArray(uses) ? uses : [], max: options.max ? Number(options.max) : DEFAULT_MAX,
    focus: options.focus ? options.focus.toUpperCase() : assessment ? 'PRE_UPGRADE' : null, withUnanalyzed: options.withUnanalyzed
  })
  await writeFile(resolve(options.output), JSON.stringify(proposal.waves, null, 2) + '\n')
  if (options.markdown) await writeFile(resolve(options.markdown), markdownOf(proposal))
  log(`${proposal.waves.length} waves proposed in ${options.output}` + (options.markdown ? ` and ${options.markdown}` : '') +
    `; review them, then: node nova-config.mjs waves <program> --file ${options.output}`)
  for (const warning of proposal.warnings) log(`! ${warning}`)
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  main(process.argv.slice(2)).then(code => process.exit(code), error => { console.error(error.message); process.exit(2) })
