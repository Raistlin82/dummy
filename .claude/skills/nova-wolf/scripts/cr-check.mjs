#!/usr/bin/env node
/**
 * Release state of ABAP objects in the Cloudification Repository (github.com/SAP/abap-atc-cr-cv-s4hc), the content of
 * the ATC checks "Usage of Released APIs" and "Usage of APIs". Research, plan and challenges ask the same question:
 * may this release of the target use this object from ABAP for Cloud Development? Asking it by hand on a 10 MB JSON
 * went wrong once (CL_ABAP_BIGINT is released from PCE2023_0, not in PCE2022).
 *
 *   node cr-check.mjs <object>... --release <id>[,<id>...] [--repo-ref <commit>] [--json]
 *
 * An object is a name (CL_ABAP_BIGINT, I_PRODUCT, BAPI_USER_GET_DETAIL) or TYPE:NAME (CLAS:CL_ABAP_BIGINT, DDLS:I_PRODUCT,
 * FUNC:BAPI_USER_GET_DETAIL); the type matches the TADIR type or the object type of the file (DDLS or CDS_STOB).
 *
 * A release id names a file of the repository: objectReleaseInfo_<id>.json under src/ (PCE2022, PCE2022_1, PCE2022_2,
 * PCE2023_0 … PCE2023_3, PCE2025_0 … PCE2025_2, PCELatest, BTPLatest) or under src/archive/ (the Public Cloud releases
 * 2208 … 2602); Latest is src/objectReleaseInfoLatest.json (SAP S/4HANA Cloud Public Edition, current).
 * For every object and release the answer is one of:
 * - released: state "released" in the file (released for ABAP for Cloud Development);
 * - deprecated, notToBeReleased, notToBeReleasedStable: not usable in ABAP Cloud, with the successors the file names
 *   (one object, several, or a concept);
 * - absent: not in the file, so not released for that release.
 * For the Private Edition and on-premise releases it adds the classification of src/objectClassifications_SAP.json
 * (classicAPI or noAPI, the Clean Core levels of classic ABAP), when the object is there. The files do not carry the
 * release contract (C0, C1, C2): released here means usable in ABAP for Cloud Development; ADT shows the contracts.
 * Exit 0 when every object is released in every release, 1 otherwise, 2 on an error.
 *
 * The files come from https://raw.githubusercontent.com/SAP/abap-atc-cr-cv-s4hc/<ref>/ (NOVA_CR_BASE for another
 * host) at the pinned commit below unless --repo-ref says another, and stay in ~/.nova/cr/<ref>/ (NOVA_CR_CACHE).
 * A ref that is not a commit (main) is downloaded again every time.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

// the commit of SAP/abap-atc-cr-cv-s4hc read on 2026-11-02 (files up to objectReleaseInfo_PCE2025_2.json)
export const PINNED_REF = 'd9ce316b289077e4b21f56f768e5a2a2c52480d9'
// the Public Cloud releases kept only under src/archive/ at the pinned commit
const ARCHIVED = new Set(['2208', '2302', '2308', '2402', '2408', '2502', '2508', '2602'])
const CLASSIFICATIONS = 'src/objectClassifications_SAP.json'

/** The repository path of the release file of an id; null for an id with a shape the repository does not use. */
export function releaseFile(id) {
  if (id === 'Latest') return 'src/objectReleaseInfoLatest.json'
  if (ARCHIVED.has(id)) return `src/archive/objectReleaseInfo_${id}.json`
  if (/^(PCE\d{4}(_\d)?|PCELatest|BTPLatest)$/.test(id)) return `src/objectReleaseInfo_${id}.json`
  return null
}

/** Whether a release id is a Private Edition / on-premise one, where the classic API classification applies. */
export const isPrivate = id => id.startsWith('PCE')

/** TYPE:NAME or NAME, upper case. */
export function parseObject(text) {
  const at = text.indexOf(':')
  const [type, name] = at > 0 ? [text.slice(0, at), text.slice(at + 1)] : [null, text]
  return { input: text, type: type?.trim().toUpperCase() || null, name: name.trim().toUpperCase() }
}

const matches = (entry, object) => (entry.objectKey?.toUpperCase() === object.name || entry.tadirObjName?.toUpperCase() === object.name &&
  entry.objectType === entry.tadirObject) && (!object.type || object.type === entry.tadirObject || object.type === entry.objectType)

/** The entries of a list (objectReleaseInfo or objectClassifications) for an object; the objectKey match wins. */
export function find(entries, object) {
  const all = entries.filter(entry => matches(entry, object))
  const byKey = all.filter(entry => entry.objectKey?.toUpperCase() === object.name)
  return byKey.length ? byKey : all
}

const successorsOf = entry => entry.successorClassification === 'concept' && entry.successorConceptName
  ? [`concept ${entry.successorConceptName}`]
  : (entry.successors ?? []).map(s => `${s.objectType ?? s.tadirObject} ${s.objectKey ?? s.tadirObjName}`)

/** The answer for one object in one release file (and the classic classifications, or null). */
export function answer(object, releaseInfo, classifications) {
  const hits = find(releaseInfo, object)
  const classic = classifications ? find(classifications, object)
    .map(c => ({ state: c.state, labels: c.labels ?? [], successors: successorsOf(c) })) : null
  if (!hits.length) return { object: object.input, verdict: 'absent', classic }
  const entry = hits.find(h => h.state === 'released') ?? hits[0]
  return {
    object: object.input, verdict: entry.state, released: entry.state === 'released',
    type: entry.objectType, tadir: `${entry.tadirObject} ${entry.tadirObjName}`, softwareComponent: entry.softwareComponent,
    applicationComponent: entry.applicationComponent, successors: successorsOf(entry), classic
  }
}

async function download(path, ref, { fetchText = defaultFetch } = {}) {
  const cache = join(process.env.NOVA_CR_CACHE ?? join(homedir(), '.nova', 'cr'), ref, path)
  const pinned = /^[0-9a-f]{40}$/.test(ref)
  if (pinned) {
    try { return JSON.parse(await readFile(cache, 'utf8')) } catch { /* not cached yet */ }
  }
  const base = process.env.NOVA_CR_BASE ?? 'https://raw.githubusercontent.com/SAP/abap-atc-cr-cv-s4hc'
  const text = await fetchText(`${base}/${ref}/${path}`)
  if (text === null) return null
  const json = JSON.parse(text)
  if (pinned) {
    await mkdir(dirname(cache), { recursive: true })
    await writeFile(cache, text)
  }
  return json
}

async function defaultFetch(url) {
  const response = await fetch(url)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.text()
}

/**
 * Checks the objects in the releases. load(path) returns the parsed JSON of a repository file, or null when the file
 * does not exist; by default it downloads at the ref (cached).
 */
export async function check(objects, releases, { ref = PINNED_REF, load } = {}) {
  load ??= path => download(path, ref)
  const parsed = objects.map(parseObject)
  const result = { ref, releases: [], failed: false }
  let classifications
  for (const id of releases) {
    const path = releaseFile(id)
    if (!path) throw new Error(`release id ${id} unknown: use Latest, BTPLatest, PCELatest, PCE2022, PCE2022_1 … PCE2023_0 … PCE2025_2, or 2208 … 2602`)
    const file = await load(path)
    if (!file) throw new Error(`${path} not found at ${ref}: the release id ${id} is not in this version of the repository`)
    const list = file.objectReleaseInfo ?? []
    if (isPrivate(id) && classifications === undefined) classifications = (await load(CLASSIFICATIONS))?.objectClassifications ?? null
    const answers = parsed.map(object => answer(object, list, isPrivate(id) ? classifications : null))
    if (answers.some(a => !a.released)) result.failed = true
    result.releases.push({ id, file: path, answers })
  }
  return result
}

function line(a) {
  const classic = a.classic?.length ? ` · Clean Core classico: ${a.classic.map(c => c.state + (c.labels.length ? ` (${c.labels.join(', ')})` : '') +
    (c.successors.length ? `, successore ${c.successors.join(', ')}` : '')).join('; ')}` : ''
  if (a.verdict === 'absent') return `- \`${a.object}\`: **assente** (non rilasciato in questa release)${classic}`
  const where = `${a.tadir}, ${a.softwareComponent}, ${a.applicationComponent}`
  if (a.released) return `- \`${a.object}\`: **rilasciato** (released; ${where})${classic}`
  const next = a.successors.length ? `; successore: ${a.successors.join(', ')}` : '; nessun successore indicato'
  return `- \`${a.object}\`: **non rilasciato**, stato ${a.verdict} (${where})${next}${classic}`
}

export function report(result) {
  const lines = [`# Stato di rilascio nel Cloudification Repository`, '',
    `SAP/abap-atc-cr-cv-s4hc a ${result.ref}. «released» = utilizzabile in ABAP for Cloud Development; il contratto (C0, C1, C2) non è nei file: si legge in ADT.`, '']
  for (const r of result.releases) {
    lines.push(`## ${r.id} (${r.file})`, '', ...r.answers.map(line), '')
  }
  lines.push(result.failed ? 'Esito: almeno un oggetto non è rilasciato in una delle release.' : 'Esito: tutti gli oggetti sono rilasciati in tutte le release.')
  return lines.join('\n')
}

export async function main(argv = process.argv.slice(2), { log = console.log, load } = {}) {
  const options = { objects: [] }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') options.json = true
    else if (argv[i] === '--release') options.release = argv[++i]
    else if (argv[i] === '--repo-ref') options.ref = argv[++i]
    else if (argv[i] === '--help' || argv[i] === '-h') options.help = true
    else options.objects.push(argv[i])
  }
  const releases = (options.release ?? '').split(',').map(r => r.trim()).filter(Boolean)
  if (options.help || !releases.length || !options.objects.length) {
    log('node cr-check.mjs <object>... --release <id>[,<id>...] [--repo-ref <commit>] [--json]')
    return options.help ? 0 : 2
  }
  const result = await check(options.objects, releases, { ref: options.ref ?? PINNED_REF, load })
  log(options.json ? JSON.stringify(result, null, 2) : report(result))
  return result.failed ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  main().then(code => { process.exitCode = code }, error => { console.error(error.message); process.exitCode = 2 })
