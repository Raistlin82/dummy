// The Word and the PDF of a Markdown document of a program, with the brand of the team (docs/wolf/18, section 4.3):
// program-docs.mjs deliver. The Word is built with the pieces of the customer guides (guide/lib/docx-kit.mjs: the
// dark cover, the header, the footer, the styles), from the Markdown the other commands write: headings, paragraphs,
// lists, tables, code, images and bold. The PDF comes from LibreOffice, when it is installed.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { loadBrand } from '../guide/lib/brand.mjs'
import { CONTENT, docxKit, fixBookmarkIds, officePdf } from '../guide/lib/docx-kit.mjs'
import { LABELS, requireInstalled } from '../guide/lib/model.mjs'
import { programOf } from './program-data.mjs'

const sha = data => createHash('sha256').update(data).digest('hex')

// ---- Markdown, as the documents of a program use it

/** The runs of a line of text: **bold**, *italics*, `code`, [a link](url) and ![an image](file.png). */
export function inlineOf(text) {
  const runs = []
  const source = String(text ?? '')
  const re = /(!\[([^\]]*)\]\(([^)\s]+)\))|(\[([^\]]+)\]\(([^)\s]+)\))|(`+)(.+?)\7|\*\*([^*]+)\*\*|(?<![\w*])\*([^*\s][^*]*?)\*(?![\w*])|(?<![\w_])_([^_\s][^_]*?)_(?![\w_])/g
  let last = 0
  for (const m of source.matchAll(re)) {
    if (m.index > last) runs.push({ t: source.slice(last, m.index) })
    if (m[1]) runs.push({ image: m[3], alt: m[2] })
    // a link to a page says where it goes; one to a file of the repository keeps its text
    else if (m[4]) runs.push({ t: /^https?:/i.test(m[6]) && m[5] !== m[6] ? `${m[5]} (${m[6]})` : m[5] })
    else if (m[7]) runs.push({ t: m[8], code: true })
    else if (m[9] !== undefined) runs.push({ t: m[9], bold: true })
    else runs.push({ t: m[10] ?? m[11], italic: true })
    last = m.index + m[0].length
  }
  if (last < source.length) runs.push({ t: source.slice(last) })
  return runs.map(run => run.t === undefined ? run : { ...run, t: run.t.replace(/\\([|*_`\\[\]()#])/g, '$1') })
}
const plainOf = text => inlineOf(text).map(run => run.t ?? run.alt ?? '').join('')

/**
 * The blocks of a Markdown document: { type: heading | paragraph | list | table | code | image | quote, ... }.
 * HTML comments (the markers of the authored parts) are not part of the document.
 */
export function blocksOf(markdown) {
  const lines = String(markdown).replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '').split('\n')
  const blocks = []
  const cells = line => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim())
  const item = line => /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const fence = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fence) {
      const code = []
      for (i++; i < lines.length && !lines[i].trim().startsWith(fence[1]); i++) code.push(lines[i])
      blocks.push({ type: 'code', lines: code })
      continue
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*$/.exec(line)
    if (heading) { blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] }); continue }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) continue
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1] ?? '')) {
      const table = { type: 'table', columns: cells(line), right: cells(lines[i + 1]).map(c => /-:$/.test(c)), rows: [] }
      for (i += 2; i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]); i++) table.rows.push(cells(lines[i]))
      i--
      blocks.push(table)
      continue
    }
    const image = /^\s*!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(line)
    if (image) { blocks.push({ type: 'image', alt: image[1], file: image[2] }); continue }
    if (item(line)) {
      const list = { type: 'list', ordered: /\d/.test(item(line)[2]), items: [] }
      for (; i < lines.length && lines[i].trim(); i++) {
        const m = item(lines[i])
        if (m) list.items.push({ level: m[1].length >= 2 ? 1 : 0, text: m[3] })
        else list.items[list.items.length - 1].text += ` ${lines[i].trim()}`
      }
      i--
      blocks.push(list)
      continue
    }
    const quote = /^\s*>\s?(.*)$/.exec(line)
    const text = [quote ? quote[1] : line.trim()]
    for (i++; i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*(`{3,}|~{3,})|\s*\|.*\|\s*$)/.test(lines[i]) && !item(lines[i]) &&
      Boolean(/^\s*>/.test(lines[i])) === Boolean(quote); i++) text.push(quote ? lines[i].replace(/^\s*>\s?/, '') : lines[i].trim())
    i--
    blocks.push({ type: quote ? 'quote' : 'paragraph', text: text.join(' ') })
  }
  return blocks
}

/**
 * What the cover takes from a document written by program-docs.mjs: its title (the only heading of level 1, at the
 * top) and its program (the line "**Programma:** ..." after it). Returns { title, program, blocks, shift }: the
 * blocks without those two, and how far the headings move up.
 */
export function coverOf(blocks) {
  const tops = blocks.filter(b => b.type === 'heading' && b.level === 1)
  if (tops.length !== 1 || blocks[0] !== tops[0]) return { title: null, program: null, blocks, shift: 0 }
  const rest = blocks.slice(1)
  const program = rest[0]?.type === 'paragraph' ? /^\*\*(?:Programma|Program):\*\*\s*(.+)$/.exec(rest[0].text)?.[1] ?? null : null
  return { title: plainOf(tops[0].text), program, blocks: program ? rest.slice(1) : rest, shift: 1 }
}

// ---- the Word

/** The Word of a Markdown document as a buffer, and what could not be put in it (images that are missing or not PNG). */
export async function wordOf(markdown, { dir, brand, title, program, version, date, lang }) {
  const docx = requireInstalled('docx')
  const JSZip = requireInstalled('jszip')
  const { AlignmentType, Bookmark, HeadingLevel, LevelFormat, PageReference, Packer, Paragraph, Tab, Table, TableRow, TabStopType, TextRun,
    WidthType, TableLayoutType } = docx
  const kit = docxKit(docx, brand)
  const K = brand.colors, L = LABELS[lang]
  const warnings = []
  const cover = coverOf(blocksOf(markdown))
  const documentTitle = title ?? cover.title ?? 'Document'
  const programName = program ?? cover.program
  const vendor = brand.company, vendorLegal = brand.legal || brand.company

  const run = (r, extra = {}) => r.italic ? new TextRun({ text: r.t, italics: true, bold: extra.bold, font: brand.font, size: extra.size ?? 19, color: extra.color ?? K.text })
    : kit.tr(r, extra)
  const picture = (file, maxW, maxH, alt) => {
    const path = resolve(dir, file)
    if (!existsSync(path)) { warnings.push(`image not found: ${file}`); return null }
    if (extname(path).toLowerCase() !== '.png') { warnings.push(`image not embedded, only PNG is: ${file}`); return null }
    return kit.image(path, maxW, maxH, { title: alt || basename(file), description: alt || basename(file), name: basename(file) })
  }
  const inline = (text, extra, maxW = 200) => inlineOf(text).map(r => r.image ? picture(r.image, maxW, 400, r.alt) ?? new TextRun({ text: `[${r.alt || r.image}]`, font: brand.font, size: extra?.size ?? 19, color: K.muted })
    : run(r, extra))
  // a line with an image is as tall as the image: no fixed line height there
  const paragraph = (text, opts = {}) => new Paragraph({
    spacing: { after: opts.after ?? 140, before: opts.before ?? 0, ...(inlineOf(text).some(r => r.image) ? {} : { line: 276 }) }, alignment: opts.align,
    numbering: opts.numbering, keepNext: opts.keepNext, children: inline(text, opts, opts.maxW) })

  // lists: one numbering for the bullets, with two levels, and one per numbered list
  const numbering = [{ reference: 'bullets', levels: [0, 1].map(level => ({ level, format: LevelFormat.BULLET, text: level ? '–' : '▸', alignment: AlignmentType.LEFT,
    style: { run: { color: K.accentText }, paragraph: { indent: { left: 300 + 340 * level, hanging: 220 } } } })) }]
  let lists = 0
  const listOf = block => {
    const reference = block.ordered ? `list${++lists}` : 'bullets'
    if (block.ordered) numbering.push({ reference, levels: [0, 1].map(level => ({ level, format: level ? LevelFormat.LOWER_LETTER : LevelFormat.DECIMAL, text: `%${level + 1}.`,
      alignment: AlignmentType.LEFT, style: { run: { bold: true, color: K.accentText }, paragraph: { indent: { left: 320 + 340 * level, hanging: 300 } } } })) })
    return block.items.map(it => paragraph(it.text, { numbering: { reference, level: it.level }, after: 40, size: 19 }))
  }
  // tables: the columns as wide as what they hold, numbers at the right
  const tableOf = block => {
    const count = block.columns.length
    const rows = block.rows.map(row => Array.from({ length: count }, (_, n) => row[n] ?? ''))
    const size = count > 6 ? 15 : 17
    const hasImage = n => rows.some(row => inlineOf(row[n]).some(r => r.image))
    // a column is at least as wide as its longest word (in twentieths of a point: the heading in capitals, the cells in
    // the size of the table), and takes of what is left in proportion to its longest cell
    const longest = text => Math.max(0, ...plainOf(text).split(/[\s/]+/).map(word => word.length))
    const least = block.columns.map((column, n) => 240 + Math.max(longest(column) * 125, ...rows.map(row => longest(row[n]) * size * 6.2)))
    const wish = block.columns.map((_, n) => hasImage(n) ? CONTENT : Math.min(5200, 240 + Math.max(...rows.map(row => plainOf(row[n]).length), plainOf(block.columns[n]).length) * size * 6.2))
    const room = CONTENT - least.reduce((a, b) => a + b, 0)
    const more = wish.map((w, n) => Math.max(0, w - least[n]))
    const share = more.reduce((a, b) => a + b, 0)
    const widths = kit.widthsOf(room <= 0 ? least : least.map((w, n) => w + (share ? room * more[n] / share : room / count)))
    return new Table({
      width: { size: CONTENT, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED,
      rows: [kit.headRow(block.columns.map(plainOf), widths), ...rows.map((row, ri) => new TableRow({ cantSplit: !row.some(c => inlineOf(c).some(r => r.image)),
        children: row.map((c, n) => kit.cell([paragraph(c, { after: 0, size, align: block.right[n] ? AlignmentType.RIGHT : undefined, maxW: Math.floor(widths[n] / 15) - 16 })],
          widths[n], { fill: ri % 2 ? 'FAFAFB' : undefined })) }))]
    })
  }
  const boxed = (children, fill) => new Table({ width: { size: CONTENT, type: WidthType.DXA }, columnWidths: [CONTENT],
    rows: [new TableRow({ children: [kit.cell(children, CONTENT, { fill, borders: kit.borders(K.rule) })] })] })

  // the body: the contents with their pages, then the blocks; a section of the document starts a page
  const body = [], contents = []
  let bookmarks = 0, lead = null
  for (const block of cover.blocks) {
    if (block.type === 'heading') {
      lead ??= body.length
      const level = Math.max(1, block.level - cover.shift)
      const text = plainOf(block.text)
      if (level > 3) { body.push(new Paragraph({ spacing: { before: 160, after: 80 }, keepNext: true, children: [new TextRun({ text, bold: true, font: brand.font, size: 19, color: K.ink })] })); continue }
      const id = `h${++bookmarks}`
      if (level <= 2) contents.push({ text, id, level: level - 1 })
      body.push(new Paragraph({ heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][level - 1], keepNext: true,
        pageBreakBefore: level === 1, children: [new Bookmark({ id, children: [new TextRun({ text, font: brand.font })] })] }))
    } else if (block.type === 'paragraph') body.push(paragraph(block.text, { maxW: 642 }))
    else if (block.type === 'quote') body.push(boxed([paragraph(block.text, { after: 0, size: 18 })], K.note), kit.gap(140))
    else if (block.type === 'list') body.push(...listOf(block), kit.gap(80))
    else if (block.type === 'table') body.push(tableOf(block), kit.gap(160))
    else if (block.type === 'code') body.push(boxed(block.lines.map(line => new Paragraph({ spacing: { after: 0, line: 252 },
      children: [new TextRun({ text: line || ' ', font: brand.mono, size: 16, color: K.ink })] })), K.codeFill), kit.gap(140))
    else if (block.type === 'image') {
      const shown = picture(block.file, 642, 600, block.alt)
      if (shown) body.push(new Paragraph({ keepNext: Boolean(block.alt), spacing: { before: 80, after: block.alt ? 0 : 200 }, alignment: AlignmentType.CENTER, children: [shown] }),
        ...(block.alt ? [new Paragraph({ spacing: { before: 60, after: 200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: block.alt, font: brand.font, size: 17, color: K.muted })] })] : []))
      else body.push(paragraph(`[${block.alt || block.file}]`, { color: K.muted }))
    }
  }
  lead ??= body.length
  const front = [new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: L.contents, font: brand.font })] }),
    ...contents.map(c => new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: CONTENT, leader: 'dot' }], spacing: { after: c.level === 0 ? 60 : 20, before: c.level === 0 ? 120 : 0 },
      indent: { left: c.level === 0 ? 0 : 360 },
      children: [new TextRun({ text: c.text, font: brand.font, size: c.level === 0 ? 20 : 18, bold: c.level === 0, color: c.level === 0 ? K.ink : K.text }),
        new TextRun({ children: [new Tab()], font: brand.font, size: 18 }), new PageReference(c.id, { font: brand.font, size: 18 })]
    }))]

  const line = [`${L.version} ${version}`, date, vendorLegal].filter(Boolean).join(' · ')
  const doc = kit.document({
    creator: vendorLegal || documentTitle, title: [programName, documentTitle].filter(Boolean).join(' · '), description: '', numbering,
    cover: kit.cover({ eyebrow: programName ?? vendor ?? '', title: documentTitle, subtitle: null, line, vendor }),
    // what the document says before its first section comes before the contents
    body: [...body.slice(0, lead), ...(contents.length ? front : []), ...body.slice(lead)],
    header: kit.header({ left: programName ?? vendor ?? documentTitle, right: documentTitle, vendor }),
    footer: kit.footer({ text: [vendorLegal, `${L.version} ${version}`, date].filter(Boolean).join(' · '), page: L.page, of: L.of, vendor })
  })
  return { buffer: await fixBookmarkIds(JSZip, await Packer.toBuffer(doc)), warnings, title: documentTitle, program: programName,
    images: cover.blocks.flatMap(b => b.type === 'image' ? [b.file] : b.type === 'table' ? b.rows.flat().flatMap(c => inlineOf(c).filter(r => r.image).map(r => r.image)) : []) }
}

// ---- the command

/** What a delivered document was made from: the hashes of its Markdown, of its images and of the brand. */
function stampOf(markdownFile, images, brand) {
  const dir = dirname(markdownFile)
  return { source: sha(readFileSync(markdownFile)), brand: brand.neutral ? 'neutral' : sha(readFileSync(join(brand.dir, 'brand.json'))),
    images: Object.fromEntries([...new Set(images)].sort().map(file => [file, existsSync(resolve(dir, file)) ? sha(readFileSync(resolve(dir, file))) : null])) }
}

/** program-docs.mjs deliver: the exit code. */
export async function deliver({ root, file, brand: brandDir, out, title, program, version = '1.0', date, lang, pdf = true, check = false, log, env = process.env,
  shown = f => f }) {
  const source = existsSync(resolve(file)) ? resolve(file) : resolve(root, file)
  if (!existsSync(source)) throw new Error(`${file}: no such file`)
  const markdown = readFileSync(source, 'utf8')
  const language = lang ?? /^<!-- program-docs\.mjs [a-z-]+ · ([a-z]{2}) · /.exec(markdown)?.[1] ?? env.NOVA_CONFIG_LANGUAGE ?? 'it'
  if (!LABELS[language]) throw new Error(`--lang is ${Object.keys(LABELS).sort().join(' or ')}, not ${language}`)
  const brand = loadBrand(resolve(root, brandDir ?? 'docs/brand'))
  const folder = resolve(root, out ?? 'docs/deliverables')
  const name = basename(source, extname(source))
  const target = join(folder, `${name}.docx`), stampFile = join(folder, `${name}.json`), pdfFile = join(folder, `${name}.pdf`)
  const images = blocksOf(markdown).flatMap(b => b.type === 'image' ? [b.file] : b.type === 'table' ? b.rows.flat().flatMap(c => inlineOf(c).filter(r => r.image).map(r => r.image)) : [])

  if (check) {
    const problems = []
    const stamp = existsSync(stampFile) ? JSON.parse(readFileSync(stampFile, 'utf8')) : null
    if (!existsSync(target) || !stamp) problems.push(`${shown(target)}: not made: run program-docs.mjs deliver ${file}`)
    else {
      const now = stampOf(source, images, brand)
      if (stamp.source !== now.source) problems.push(`${shown(target)}: not up to date: ${shown(source)} changed since the Word was made`)
      if (stamp.brand !== now.brand) problems.push(`${shown(target)}: not up to date: the brand changed since the Word was made`)
      for (const [image, hash] of Object.entries(now.images)) if (stamp.images?.[image] !== hash) problems.push(`${shown(target)}: not up to date: the image ${image} changed since the Word was made`)
      if (stamp.documents?.includes(`${name}.pdf`) && !existsSync(pdfFile)) problems.push(`${shown(pdfFile)}: the PDF is gone`)
    }
    for (const problem of problems) log(problem)
    log(`problems: ${problems.length}`)
    return problems.length ? 1 : 0
  }

  const word = await wordOf(markdown, { dir: dirname(source), brand, title, program: program ?? programOf(root).title ?? undefined, version,
    date: date ?? new Date().toISOString().slice(0, 10), lang: language })
  mkdirSync(folder, { recursive: true })
  writeFileSync(target, word.buffer)
  log(`wrote ${shown(target)} · "${word.title}"${word.program ? ` of ${word.program}` : ''} · brand ${brand.neutral ? 'neutral (no docs/brand/brand.json)' : brand.company}`)
  for (const warning of word.warnings) log(`  ! ${warning}`)
  const documents = [`${name}.docx`]
  if (pdf) {
    const work = mkdtempSync(join(tmpdir(), 'nova-deliver-'))
    const made = officePdf(target, pdfFile, work)
    rmSync(work, { recursive: true, force: true })
    if (made.target) { documents.push(`${name}.pdf`); log(`wrote ${shown(pdfFile)}`) }
    else if (/ENOENT/.test(String(made.reason))) log('PDF not made: LibreOffice (soffice) is not installed; the Word file is complete')
    else log(`PDF not made: LibreOffice (soffice) failed: ${String(made.reason).trim().split('\n')[0]}; the Word file is complete`)
  }
  writeFileSync(stampFile, JSON.stringify({ ...stampOf(source, word.images, brand), from: relative(root, source).split('\\').join('/'), documents }, null, 2) + '\n')
  return 0
}
