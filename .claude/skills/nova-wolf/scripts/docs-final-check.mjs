#!/usr/bin/env node
/**
 * The documents of a development describe its final state only (step DOCS_ARCHIVE, and the documentation steps after
 * it): what belongs to an earlier version is in the archive, with an index, and nothing current depends on it.
 *
 *   node docs-final-check.mjs [--root .] [--archive docs/archive] [--docs docs,README.md]
 *        [--superseded docs/archive/superseded.txt] [--no-archive "<reason>"] [--history <paths>]
 *        [--app-texts <files>] [--output <file>] [--json]
 *
 * Findings (exit 1 with any):
 *  - archive-missing  no archive folder, or (superseded-missing) no superseded.txt: a change has an earlier version, and
 *                     without its archive nothing below is checked. --no-archive "<reason>" when the earlier version had
 *                     no document of its own (the reason goes in the report);
 *  - archive-index    a file in the archive the index (<archive>/README.md) does not name, or no index at all;
 *  - archive-link     a current file (anywhere in the repository but the archive, the audit reports and the open points
 *                     of a guide) links or names a file in the archive; naming the archive or its index is fine;
 *  - archive-import   a current script imports or requires a module that is now in the archive (a Python module, a
 *                     relative JavaScript import or a Markdown link to a file that is gone, with the same name archived);
 *  - superseded       a current document names something superseded: the lines of superseded.txt, literal names
 *                     (ZNOTIF_BANNER, «v2») or /regular expressions/; the as-is documents (as-is*), the audit and
 *                     refactoring reports (audit/, refactor/), the records of decisions and research (adr/, decisions/,
 *                     research/, research*), the open points and the archive are where the comparison with the earlier
 *                     version belongs; --history <paths> adds files or folders of the project's own history (a comma
 *                     list, relative to --root: docs/CONTEXT.md,docs/notes). A literal name is found as a word: before it
 *                     there is no letter, digit, "_" or "/", except for a name with a dot or a hyphen (nome.md is found in
 *                     docs/nome.md); a plain name inside a path is written as a /regular expression/;
 *  - marker:<kind>    a diagram (.drawio, compressed or not) or a diagram receipt (*receipt*.json) with a development
 *                     marker: what a diagram says reaches the customer as an image, which no PDF text check reads. The text
 *                     of the application itself is not a marker even if it says «to be verified»: put it between «…» in the
 *                     cell, or list the files it comes from (i18n bundles .properties/.json, or a text with a line each)
 *                     with --app-texts <files>.
 *  The archive's superseded.txt, like its index, may be named by a current document (the step that writes it says so).
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { drawioText, findMarkers, receiptText } from './guide/lib/markers.mjs'

// where the comparison with the earlier version belongs, and the folders of tools: the same rule as coverage-check.mjs
import { HISTORY_DIRS, HISTORY_FILE, TOOL_DIRS as SKIP } from './guide/lib/doc-scope.mjs'
const HISTORY_DIR = new RegExp(`[\\\\/](${[...HISTORY_DIRS].filter(d => d !== 'archive').join('|')})$`)
const TEXT = /\.(md|py|mjs|cjs|js|ts|json|ya?ml|sh|xml|html|cds|properties|txt|drawio)$/i
// the markers a diagram must not carry; paths in a receipt are its business
const DIAGRAM_MARKERS = new Set(['unverified', 'placeholder', 'todo', 'open-risk', 'internal-ref', 'previous-version'])

async function walk(dir, skipDir, out = []) {
  if (!existsSync(dir)) return out
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (!SKIP.has(e.name) && !skipDir(p)) await walk(p, skipDir, out) } else out.push(p)
  }
  return out
}

export function parseSuperseded(text) {
  return String(text).split(/\r?\n/).map(l => l.replace(/\s+#.*$/, '').trim()).filter(l => l && !l.startsWith('#')).map(l => {
    const re = l.match(/^\/(.+)\/([a-z]*)$/)
    const escaped = l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // a name with a dot or a hyphen (a file name, a version) is found inside a path too; a plain word is not (v2 in /api/v2/)
    const before = /[.-]/.test(l) ? 'A-Za-z0-9_' : 'A-Za-z0-9_/'
    return { label: l, re: re ? new RegExp(re[1], re[2].includes('i') ? 'i' : '') : new RegExp(`(^|[^${before}])${escaped}(?![A-Za-z0-9_])`, 'i') }
  })
}

// imports and links of a current file: [kind, target] pairs
export function referencesOf(file, text) {
  const refs = []
  const ext = extname(file).toLowerCase()
  if (ext === '.py') for (const [, a, b] of text.matchAll(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm)) refs.push(['py', (a ?? b).split('.')[0]])
  if (/\.(m?js|cjs|ts)$/.test(ext))
    for (const [, t] of text.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) refs.push(['path', t])
  if (ext === '.md') for (const [, t] of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) if (!/^[a-z]+:/i.test(t)) refs.push(['path', t])
  return refs
}

// the texts of the application a diagram may quote: the values of i18n bundles (.properties, .json) or the lines of a text
export function appTextsOf(file, text) {
  const out = []
  if (/\.json$/i.test(file)) { const walk = v => { if (typeof v === 'string') out.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(walk) }; try { walk(JSON.parse(text)) } catch { /* not JSON */ } }
  else if (/\.properties$/i.test(file)) for (const l of text.split(/\r?\n/)) { const m = l.match(/^\s*[^#!\s][^=:]*[=:]\s*(.+)$/); if (m) out.push(m[1].trim()) }
  else out.push(...text.split(/\r?\n/))
  return out.map(t => t.trim()).filter(t => t.length >= 6)
}
// a diagram's text without what the application itself says: «…» in a cell, and the listed texts of the application
export function withoutAppTexts(text, appTexts = []) {
  let t = String(text).replace(/«[^»\n]*»/g, ' ')
  for (const a of [...new Set(appTexts)].sort((x, y) => y.length - x.length)) t = t.split(a).join(' ')
  return t
}

export async function checkFinalState({ root = process.cwd(), archive = 'docs/archive', docs = ['docs', 'README.md'], superseded,
  noArchive, history = [], appTexts = [] } = {}) {
  const findings = []
  const add = (kind, where, text) => findings.push({ kind, where, text })
  const archiveDir = resolve(root, archive)
  const inArchive = p => p === archiveDir || p.startsWith(archiveDir + sep)
  // the files and folders of the project's own history (--history): the comparison with the earlier version belongs there
  const historyPaths = history.map(h => resolve(root, h))
  const isHistory = p => historyPaths.some(h => p === h || p.startsWith(h + sep))
  const rel = p => relative(root, p).split(sep).join('/')
  // a change has an earlier version: its archive, the index and the superseded names are what DOCS_ARCHIVE writes, and
  // without them nothing here would be checked. Only an earlier version with no document of its own goes without, said
  // with --no-archive "<reason>"
  if (!noArchive) {
    if (!existsSync(archiveDir))
      add('archive-missing', rel(archiveDir), 'no archive: move the documents of the earlier version there with their index, ' +
        'or say why there are none with --no-archive "<reason>"')
    else if (!existsSync(join(archiveDir, 'README.md')))
      add('archive-index', rel(join(archiveDir, 'README.md')), 'the archive has no index: list each archived file, its version and why it was archived')
    if (superseded && !existsSync(resolve(root, superseded)))
      add('superseded-missing', rel(resolve(root, superseded)), 'no list of the superseded names: write the names of the earlier ' +
        'version the current documents must no longer use (renamed objects, «v2», removed functions), one per line')
  }
  const archived = existsSync(archiveDir) ? (await walk(archiveDir, () => false)).filter(p => !/^(README\.md|superseded\.txt)$/i.test(basename(p)) || dirname(p) !== archiveDir) : []

  // the index of the archive
  if (archived.length) {
    const index = join(archiveDir, 'README.md')
    if (!existsSync(index)) {
      if (!findings.some(f => f.kind === 'archive-index')) add('archive-index', rel(index), 'the archive has no index: list each archived file, its version and why it was archived')
    }
    else {
      const text = await readFile(index, 'utf8')
      for (const p of archived) {
        const r = relative(archiveDir, p).split(sep).join('/')
        // named itself, or one of its folders is (a row per archived version is an index)
        const folders = r.split('/').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('/') + '/')
        if (!text.includes(r) && !text.includes(basename(p)) && !folders.some(f => text.includes(f)))
          add('archive-index', rel(p), 'not named in the index of the archive, nor its folder')
      }
    }
  }

  // current files: links to the archive, and imports of what was archived
  const archiveRel = rel(archiveDir)
  // the audit reports and the open points behind a guide are evidence of the past: they may name the archive
  const current = (await walk(resolve(root), p => inArchive(p) || HISTORY_DIR.test(p) || isHistory(p))).filter(p => TEXT.test(p) && !HISTORY_FILE.test(basename(p)) && !isHistory(p))
  const linkRe = new RegExp(`(^|[^\\w.-])(?:\\.{1,2}/)*${archiveRel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[\\w#.-]`)
  const shortRe = archiveRel.includes('/') ? new RegExp(`(^|[\\s('"\`])(?:\\.{1,2}/)+${basename(archiveRel)}/[\\w#.-]`) : null
  const archivedNames = new Map(archived.map(p => [basename(p), p]))
  const archivedModules = new Set(archived.filter(p => p.endsWith('.py')).map(p => basename(p, '.py')))
  const currentModules = new Set(current.filter(p => p.endsWith('.py')).map(p => basename(p, '.py')))
  for (const file of current) {
    const text = await readFile(file, 'utf8')
    if (archived.length) {
      text.split(/\r?\n/).forEach((line, i) => {
        // a file in the archive, not the archive itself: pointing readers to the archive is fine
        const bare = line.replace(new RegExp(`(?:\\.{1,2}/)*(?:${archiveRel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${basename(archiveRel)})/(?:README\\.md|superseded\\.txt)`, 'g'), '')
        if (linkRe.test(bare) || shortRe?.test(bare))
          add('archive-link', `${rel(file)}:${i + 1}`, line.trim().slice(0, 160))
      })
      for (const [kind, target] of referencesOf(file, text)) {
        if (kind === 'py' && archivedModules.has(target) && !currentModules.has(target))
          add('archive-import', rel(file), `imports ${target}, archived (${rel(archived.find(p => basename(p, '.py') === target))}): make the script stand alone or use a library of the toolkit`)
        if (kind === 'path') {
          const to = resolve(dirname(file), target)
          if (inArchive(to)) {
            if (to !== join(archiveDir, 'README.md') && !findings.some(f => f.kind === 'archive-link' && f.where.startsWith(`${rel(file)}:`) && f.text.includes(target)))
              add('archive-link', `${rel(file)}:${text.split(/\r?\n/).findIndex(l => l.includes(target)) + 1}`, `links ${target}, in the archive`)
            continue
          }
          const name = basename(target)
          if (!existsSync(to) && archivedNames.has(name)) add('archive-import', rel(file), `${target} is gone, archived as ${rel(archivedNames.get(name))}`)
        }
      }
    }
  }

  // superseded names in the current documents, and markers in the diagrams
  const names = superseded && existsSync(resolve(root, superseded)) ? parseSuperseded(await readFile(resolve(root, superseded), 'utf8')) : []
  const docFiles = []
  for (const d of docs) {
    const p = resolve(root, d)
    if (!existsSync(p)) continue
    if (d.match(/\.[a-z]+$/i)) docFiles.push(p)
    else docFiles.push(...await walk(p, q => inArchive(q) || HISTORY_DIR.test(q) || isHistory(q)))
  }
  for (const file of docFiles) {
    const name = basename(file)
    if (HISTORY_FILE.test(name) || isHistory(file)) continue
    let text
    if (/\.drawio$/i.test(name)) text = await drawioText(await readFile(file, 'utf8'))
    else if (/receipt.*\.json$/i.test(name)) { try { text = receiptText(await readFile(file, 'utf8')) } catch { continue } }
    else if (/\.(md|ya?ml|txt)$/i.test(name)) text = await readFile(file, 'utf8')
    else continue
    // a path in the archive (a link to the index, a folder like archive/v2/) is not a use of the name
    const archivePath = new RegExp(`(?:\\.{1,2}/)*(?:[\\w.-]+/)*${basename(archiveDir).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[^\\s)\\]'"\`|]*`, 'g')
    text.split(/\r?\n/).map(l => l.replace(archivePath, '')).forEach((line, i) => {
      for (const s of names) if (s.re.test(line)) add('superseded', `${rel(file)}:${i + 1}`, `${s.label}: ${line.trim().slice(0, 140)}`)
    })
    if (/\.drawio$|receipt.*\.json$/i.test(name))
      for (const h of findMarkers(/\.drawio$/i.test(name) ? withoutAppTexts(text, appTexts) : text, { where: rel(file) })) if (DIAGRAM_MARKERS.has(h.marker)) add(`marker:${h.marker}`, h.where, h.text)
  }
  return { findings, archived: archived.length, superseded: names.length }
}

async function main(argv) {
  const { values } = parseArgs({ args: argv, options: {
    root: { type: 'string', default: '.' }, archive: { type: 'string', default: 'docs/archive' }, docs: { type: 'string', default: 'docs,README.md' },
    superseded: { type: 'string' }, 'no-archive': { type: 'string' }, history: { type: 'string' }, 'app-texts': { type: 'string' }, output: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } })
  if (values.help) {
    console.log('node docs-final-check.mjs [--root .] [--archive docs/archive] [--docs docs,README.md] [--superseded <archive>/superseded.txt] [--no-archive "<reason>"] [--history <paths>] [--app-texts <files>] [--output <file>] [--json]')
    return 0
  }
  const appTexts = []
  for (const f of (values['app-texts'] ?? '').split(',').map(x => x.trim()).filter(Boolean)) {
    const file = resolve(values.root, f)
    if (!existsSync(file)) { console.error(`--app-texts ${f}: no such file`); return 2 }
    appTexts.push(...appTextsOf(file, await readFile(file, 'utf8')))
  }
  const r = await checkFinalState({ root: resolve(values.root), archive: values.archive, docs: values.docs.split(','),
    superseded: values.superseded ?? join(values.archive, 'superseded.txt'), noArchive: values['no-archive'],
    history: (values.history ?? '').split(',').map(h => h.trim()).filter(Boolean), appTexts })
  const md = ['# Documents in their final state', '',
    ...(values['no-archive'] ? [`No archive: ${values['no-archive']}`, ''] : []),
    `${r.archived} archived files, ${r.superseded} superseded names: ${r.findings.length ? `${r.findings.length} findings` : 'no findings'}.`, '']
  if (r.findings.length) md.push('| Kind | Where | What |', '|---|---|---|', ...r.findings.map(f => `| ${f.kind} | ${f.where.replace(/\|/g, '\\|')} | ${f.text.replace(/\|/g, '\\|')} |`), '')
  if (values.output) { await mkdir(dirname(resolve(values.output)), { recursive: true }); await writeFile(values.output, md.join('\n')) }
  console.log(values.json ? JSON.stringify(r, null, 2) : md.join('\n'))
  return r.findings.length ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(await main(process.argv.slice(2)))
