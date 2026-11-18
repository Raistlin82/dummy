#!/usr/bin/env node
/**
 * Normalizes a .drawio file so the validator of DIAGRAM_CHECK accepts it: validate_diagram.py of the skill
 * btp-diagram-generator (likweitan/abap-skills, run with --quality showcase --json, where warnings count as errors).
 * Diagrams converted from Mermaid (above all the sequences) come out of draw.io with what that validator rejects:
 * cells wrapped in a UserObject whose inner mxCell has no id (the validator reads only mxCell, so it sees ids "None",
 * duplicated, and edges pointing to ids it does not know), manual waypoints, edges without port pins, colors outside
 * the SAP Fiori Horizon palette, a page that is not A4 landscape, a compressed diagram it cannot read.
 *
 *   node drawio-normalize.mjs <file.drawio> [--check] [--output <file>] [--json]
 *
 * What it changes, in this order, on every page:
 * - a compressed <diagram> (deflate + base64) is written out as plain XML;
 * - every mxCell has an id: the inner mxCell of a UserObject or object gets the id of its wrapper (draw.io reads the id of
 *   the wrapper and ignores the same value on the inner cell); a cell without one gets a new id; a duplicated id is renamed
 *   on the later cell; the root cells 0 and 1 exist; a cell without parent goes on layer 1;
 * - edges: geometry relative="1" with an <Array as="points">; points that are not mxPoint or have a coordinate that is not
 *   a number are dropped; an edge without source and target is attached to the vertex its sourcePoint / targetPoint
 *   falls on; between two different cells the waypoints are removed and the port pins (exitX/exitY/entryX/entryY) are
 *   computed from the geometry when missing, at the height of the message for a horizontal edge (sequence diagrams);
 * - colors: every #RRGGBB (or #RGB) in a style outside the palette of the validator becomes the nearest palette color;
 * - page: pageWidth 1169 and pageHeight 827.
 * What it cannot decide is reported, not changed: a cell that is both vertex and edge, a shape=mxgraph.sap.* stencil,
 * an edge whose source or target does not exist, an edge with no cell at its ends. A self message loses its waypoints
 * for port pins at the same heights: look at the exported PNG.
 *
 * --check changes nothing: it reports what it would change. Exit 0 when there is nothing to change and nothing to
 * report, 1 otherwise (with --check, also when something would change), 2 on an error.
 * Then run the validator and read its receipt: validation.errors and validation.warnings must both be 0 (and ok true)
 * with --quality showcase; checksPassed alone does not say it.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { inflateRawSync } from 'node:zlib'

// the palette of validate_diagram.py (btp-diagram-generator), SAP Fiori Horizon
export const PALETTE = ['#0070F2', '#EBF8FF', '#475E75', '#F5F6F7', '#1D2D3E', '#556B82', '#188918', '#F5FAE5', '#266F3A',
  '#C35500', '#FFF8D6', '#D20A0A', '#FFEAF4', '#07838F', '#DAFDF5', '#5D36FF', '#F1ECFF', '#CC00DC', '#FFF0FA', '#FFFFFF',
  '#EAECEE', '#793802']
export const PAGE = { width: '1169', height: '827' }

// ---- a small XML tree that keeps attribute order and raw values, so an untouched file serializes as it was read

const NAME = /[^\s/>=]+/y
export function parseXml(text) {
  const root = { type: 'root', children: [] }
  const stack = [root]
  let i = 0
  const top = () => stack[stack.length - 1]
  while (i < text.length) {
    const lt = text.indexOf('<', i)
    if (lt < 0) { top().children.push({ type: 'text', raw: text.slice(i) }); break }
    if (lt > i) top().children.push({ type: 'text', raw: text.slice(i, lt) })
    const rest = (start, end) => {
      const close = text.indexOf(end, start)
      if (close < 0) throw new Error(`unterminated ${end} at ${lt}`)
      return close + end.length
    }
    if (text.startsWith('<!--', lt)) { i = rest(lt + 4, '-->'); top().children.push({ type: 'raw', raw: text.slice(lt, i) }); continue }
    if (text.startsWith('<![CDATA[', lt)) { i = rest(lt + 9, ']]>'); top().children.push({ type: 'raw', raw: text.slice(lt, i) }); continue }
    if (text.startsWith('<?', lt)) { i = rest(lt + 2, '?>'); top().children.push({ type: 'raw', raw: text.slice(lt, i) }); continue }
    if (text.startsWith('<!', lt)) { i = rest(lt + 2, '>'); top().children.push({ type: 'raw', raw: text.slice(lt, i) }); continue }
    if (text[lt + 1] === '/') {
      const end = rest(lt, '>')
      const name = text.slice(lt + 2, end - 1).trim()
      const open = stack.pop()
      if (!open || open.name !== name) throw new Error(`mismatched </${name}> at ${lt}`)
      i = end
      continue
    }
    NAME.lastIndex = lt + 1
    const name = NAME.exec(text)?.[0]
    if (!name) throw new Error(`bad tag at ${lt}`)
    const node = { type: 'element', name, attrs: [], children: [], selfClosing: false }
    let j = lt + 1 + name.length
    for (;;) {
      while (/\s/.test(text[j])) j++
      if (text[j] === '/' && text[j + 1] === '>') { node.selfClosing = true; j += 2; break }
      if (text[j] === '>') { j++; break }
      NAME.lastIndex = j
      const key = NAME.exec(text)?.[0]
      if (!key) throw new Error(`bad attribute at ${j}`)
      j += key.length
      while (/\s/.test(text[j])) j++
      if (text[j] !== '=') throw new Error(`attribute ${key} without value at ${j}`)
      j++
      while (/\s/.test(text[j])) j++
      const quote = text[j]
      if (quote !== '"' && quote !== "'") throw new Error(`unquoted attribute ${key} at ${j}`)
      const close = text.indexOf(quote, j + 1)
      node.attrs.push([key, text.slice(j + 1, close)])
      j = close + 1
    }
    top().children.push(node)
    if (!node.selfClosing) stack.push(node)
    i = j
  }
  if (stack.length !== 1) throw new Error(`unclosed <${top().name}>`)
  return root
}

export function serializeXml(node) {
  if (node.type === 'root') return node.children.map(serializeXml).join('')
  if (node.type !== 'element') return node.raw
  const attrs = node.attrs.map(([k, v]) => ` ${k}="${v}"`).join('')
  if (!node.children.length) return `<${node.name}${attrs}/>`
  return `<${node.name}${attrs}>${node.children.map(serializeXml).join('')}</${node.name}>`
}

const decode = raw => raw.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (_, e) =>
  ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' })[e.toLowerCase()] ??
  String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)))
const encode = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  .replace(/\n/g, '&#10;')
export const attr = (node, key) => { const a = node.attrs.find(([k]) => k === key); return a ? decode(a[1]) : undefined }
export function setAttr(node, key, value) {
  const a = node.attrs.find(([k]) => k === key)
  if (value === undefined) { node.attrs = node.attrs.filter(([k]) => k !== key); return }
  if (a) a[1] = encode(value)
  else node.attrs.push([key, encode(value)])
}
const elements = node => node.children.filter(c => c.type === 'element')
function* walk(node) {
  for (const child of elements(node)) { yield child; yield* walk(child) }
}

// ---- styles and colors

export const parseStyle = style => (style ?? '').split(';').filter(Boolean).map(part => {
  const at = part.indexOf('=')
  return at < 0 ? [part, null] : [part.slice(0, at), part.slice(at + 1)]
})
export const formatStyle = parts => parts.map(([k, v]) => v === null ? k : `${k}=${v}`).join(';') + (parts.length ? ';' : '')

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
/** The palette color nearest to a #RRGGBB or #RGB color (Euclidean distance in RGB). */
export function nearest(color) {
  const full = color.length === 4 ? '#' + [...color.slice(1)].map(c => c + c).join('') : color
  const [r, g, b] = rgb(full)
  let best = PALETTE[0], distance = Infinity
  for (const p of PALETTE) {
    const [pr, pg, pb] = rgb(p)
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
    if (d < distance) { best = p; distance = d }
  }
  return best
}
const inPalette = color => PALETTE.includes(color.toUpperCase())

// ---- normalization

const number = value => value !== undefined && value !== '' && Number.isFinite(Number(value))

function normalizeModel(model, page, changes, issues) {
  const note = (list, code, cell, message) => list.push({ page, code, cell, message })
  if (attr(model, 'pageWidth') !== PAGE.width || attr(model, 'pageHeight') !== PAGE.height) {
    note(changes, 'canvas/page-size', null, `page ${attr(model, 'pageWidth')}x${attr(model, 'pageHeight')} → ${PAGE.width}x${PAGE.height}`)
    setAttr(model, 'pageWidth', PAGE.width)
    setAttr(model, 'pageHeight', PAGE.height)
  }
  const root = elements(model).find(e => e.name === 'root')
  if (!root) { note(issues, 'structure/root', null, 'mxGraphModel without <root>'); return }

  // the cells as draw.io sees them: a wrapper (UserObject, object) with its inner mxCell, or a plain mxCell
  // the cells are the children of <root>: a plain mxCell, or a wrapper (UserObject, object) around an mxCell
  const cells = []
  for (const node of elements(root)) {
    if (node.name === 'mxCell') cells.push({ node, inner: node })
    else {
      const inner = elements(node).find(e => e.name === 'mxCell')
      if (inner) cells.push({ node, inner })
    }
  }
  const taken = new Set(cells.map(c => attr(c.node, 'id')).filter(Boolean))
  let counter = 0
  const fresh = () => { let id; do id = `nrm-${++counter}`; while (taken.has(id)); taken.add(id); return id }

  // ids: wrapper id on the inner cell, a new id where none, duplicates renamed on the later cell
  const seen = new Set()
  for (const cell of cells) {
    let id = attr(cell.node, 'id')
    if (!id) {
      id = fresh()
      note(changes, 'structure/missing-id', id, `${cell.node.name} without id: id ${id}`)
      setAttr(cell.node, 'id', id)
    } else if (seen.has(id)) {
      const renamed = fresh()
      note(changes, 'structure/duplicate-id', renamed, `duplicate id ${id} renamed to ${renamed} (references stay on the first)`)
      id = renamed
      setAttr(cell.node, 'id', id)
    }
    seen.add(id)
    cell.id = id
    if (cell.inner !== cell.node && attr(cell.inner, 'id') !== id) {
      note(changes, 'structure/inner-id', id, `inner mxCell of ${cell.node.name} ${id} gets the id of its wrapper`)
      setAttr(cell.inner, 'id', id)
    }
  }
  // the root cells 0 and 1
  if (!seen.has('0')) {
    note(changes, 'structure/root-cell', '0', 'root cell 0 added')
    root.children.unshift({ type: 'element', name: 'mxCell', attrs: [['id', '0']], children: [], selfClosing: true })
    seen.add('0')
  }
  if (!seen.has('1')) {
    note(changes, 'structure/root-cell', '1', 'layer cell 1 added')
    const at = root.children.findIndex(c => c.type === 'element' && attr(c, 'id') === '0')
    root.children.splice(at + 1, 0, { type: 'element', name: 'mxCell', attrs: [['id', '1'], ['parent', '0']], children: [], selfClosing: true })
    seen.add('1')
  }
  for (const cell of cells) {
    if (cell.id !== '0' && cell.id !== '1' && !attr(cell.inner, 'parent')) {
      note(changes, 'structure/parent', cell.id, `cell ${cell.id} without parent goes on layer 1`)
      setAttr(cell.inner, 'parent', '1')
    }
  }

  const byId = new Map(cells.map(c => [c.id, c]))
  const geometryOf = cell => elements(cell.inner).find(e => e.name === 'mxGeometry')
  // absolute bounds of a vertex, adding the offsets of its parents that are vertices
  const bounds = (cell, depth = 0) => {
    const g = geometryOf(cell)
    if (!g || attr(g, 'relative') === '1' || depth > 50) return null
    let x = Number(attr(g, 'x') ?? 0), y = Number(attr(g, 'y') ?? 0)
    const parent = byId.get(attr(cell.inner, 'parent'))
    if (parent && attr(parent.inner, 'vertex') === '1') {
      const p = bounds(parent, depth + 1)
      if (p) { x += p.x; y += p.y }
    }
    return { x, y, w: Number(attr(g, 'width') ?? 0), h: Number(attr(g, 'height') ?? 0), lifeline: /umlLifeline/.test(attr(cell.inner, 'style') ?? '') }
  }
  const vertices = cells.filter(c => attr(c.inner, 'vertex') === '1')
  const vertexAt = point => {
    const hits = vertices.map(v => ({ v, b: bounds(v) })).filter(({ b }) => b && point.x >= b.x - 1 && point.x <= b.x + b.w + 1 &&
      point.y >= b.y - 1 && point.y <= b.y + b.h + 1)
    hits.sort((a, b) => a.b.w * a.b.h - b.b.w * b.b.h)
    return hits[0]?.v
  }

  for (const cell of cells) {
    const style = attr(cell.inner, 'style') ?? ''
    const isVertex = attr(cell.inner, 'vertex') === '1', isEdge = attr(cell.inner, 'edge') === '1'
    if (isVertex && isEdge) note(issues, 'structure/cell-kind', cell.id, 'both vertex and edge: decide which it is')
    if (style.includes('shape=mxgraph.sap.')) note(issues, 'style/unsupported-stencil', cell.id, 'shape=mxgraph.sap.* does not exist: use an icon of the skill')

    // colors
    let recolored = style.replace(/#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})(?![0-9A-Fa-f])/g, color => inPalette(color) ? color : nearest(color))
    if (recolored !== style) {
      note(changes, 'style/off-palette', cell.id, `colors ${style.match(/#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})(?![0-9A-Fa-f])/g)
        .filter(c => !inPalette(c)).map(c => `${c}→${nearest(c)}`).join(', ')}`)
      setAttr(cell.inner, 'style', recolored)
    }
    if (!isEdge || isVertex) continue

    // geometry and points
    let geometry = geometryOf(cell)
    if (!geometry) {
      geometry = { type: 'element', name: 'mxGeometry', attrs: [['relative', '1'], ['as', 'geometry']], children: [], selfClosing: true }
      cell.inner.children.push(geometry)
      note(changes, 'edge/geometry', cell.id, 'edge without geometry: relative geometry added')
    } else if (attr(geometry, 'relative') !== '1') {
      setAttr(geometry, 'relative', '1')
      note(changes, 'edge/geometry', cell.id, 'edge geometry made relative')
    }
    let points = elements(geometry).find(e => e.name === 'Array' && attr(e, 'as') === 'points')
    if (!points) {
      points = { type: 'element', name: 'Array', attrs: [['as', 'points']], children: [], selfClosing: true }
      geometry.children.push(points)
    }
    const bad = points.children.filter(c => c.type === 'element' && (c.name !== 'mxPoint' ||
      ['x', 'y'].some(k => attr(c, k) !== undefined && !number(attr(c, k)))))
    if (bad.length) {
      points.children = points.children.filter(c => !bad.includes(c))
      note(changes, 'edge/points', cell.id, `${bad.length} malformed point(s) removed`)
    }
    const terminal = as => {
      const p = elements(geometry).find(e => e.name === 'mxPoint' && attr(e, 'as') === as)
      return p ? { x: Number(attr(p, 'x') ?? 0), y: Number(attr(p, 'y') ?? 0) } : null
    }
    const waypoints = elements(points).map(p => ({ x: Number(attr(p, 'x') ?? 0), y: Number(attr(p, 'y') ?? 0) }))

    // ends: attach a free end to the vertex under its terminal point; drop a reference to a missing cell
    for (const [end, as] of [['source', 'sourcePoint'], ['target', 'targetPoint']]) {
      const ref = attr(cell.inner, end)
      if (ref !== undefined && !byId.has(ref)) {
        note(issues, 'edge/endpoint-invalid', cell.id, `${end} ${ref} does not exist`)
        continue
      }
      if (ref === undefined) {
        const point = terminal(as)
        const vertex = point && vertexAt(point)
        if (vertex) {
          setAttr(cell.inner, end, vertex.id)
          note(changes, 'edge/endpoints', cell.id, `${end} attached to ${vertex.id} under its ${as}`)
        }
      }
    }
    const source = byId.get(attr(cell.inner, 'source')), target = byId.get(attr(cell.inner, 'target'))
    if (!source && !target) { note(issues, 'edge/endpoints-missing', cell.id, 'no cell at either end: connect it by hand'); continue }
    if (!source || !target) { note(issues, 'edge/endpoints-missing', cell.id, `no cell at its ${source ? 'target' : 'source'}`); continue }
    // the height of the message, before the waypoints go (a self message leaves at its first point, comes back at its last)
    const level = terminal('sourcePoint') ?? waypoints[0] ?? terminal('targetPoint')
    const back = terminal('targetPoint') ?? waypoints.at(-1) ?? level
    if (waypoints.length && source === target) note(changes, 'edge/self-message', cell.id,
      'self message: waypoints replaced by port pins at the same heights; check the exported PNG')
    if (waypoints.length) {
      points.children = []
      note(changes, 'edge/manual-waypoints', cell.id, `${waypoints.length} waypoint(s) removed`)
    }
    const parts = parseStyle(attr(cell.inner, 'style'))
    const has = key => parts.some(([k]) => k === key)
    if (['exitX', 'exitY', 'entryX', 'entryY'].every(has)) continue
    const s = bounds(source), t = bounds(target)
    if (!s || !t) { note(issues, 'edge/port-pins', cell.id, 'no geometry at an end: add exitX/exitY/entryX/entryY by hand'); continue }
    const round = v => String(Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000)
    const dx = t.x + t.w / 2 - (s.x + s.w / 2), dy = t.y + t.h / 2 - (s.y + s.h / 2)
    let pins
    if (source === target) {
      const side = s.lifeline ? '0.5' : '1'
      pins = { exitX: side, exitY: level === undefined || !s.h ? '0.25' : round((level.y - s.y) / s.h),
        entryX: side, entryY: back === undefined || !s.h ? '0.75' : round((back.y - s.y) / s.h) }
    } else if (Math.abs(dx) >= Math.abs(dy)) {
      const y = level?.y
      pins = {
        exitX: s.lifeline ? '0.5' : dx > 0 ? '1' : '0', exitY: y === undefined || !s.h ? '0.5' : round((y - s.y) / s.h),
        entryX: t.lifeline ? '0.5' : dx > 0 ? '0' : '1', entryY: y === undefined || !t.h ? '0.5' : round((y - t.y) / t.h)
      }
    } else pins = { exitX: '0.5', exitY: dy > 0 ? '1' : '0', entryX: '0.5', entryY: dy > 0 ? '0' : '1' }
    if (s.lifeline) pins.exitPerimeter = '0'
    if (t.lifeline) pins.entryPerimeter = '0'
    const added = Object.entries(pins).filter(([k]) => !has(k))
    setAttr(cell.inner, 'style', formatStyle([...parts, ...added]))
    note(changes, 'edge/port-pins', cell.id, `port pins ${added.map(([k, v]) => `${k}=${v}`).join(';')}`)
  }
}

/** Normalizes the text of a .drawio file: { text, changes, issues }. */
export function normalize(text) {
  const tree = parseXml(text)
  const changes = [], issues = []
  const diagrams = [...walk(tree)].filter(e => e.name === 'diagram')
  const models = []
  diagrams.forEach((diagram, index) => {
    const page = attr(diagram, 'name') ?? String(index + 1)
    let model = elements(diagram).find(e => e.name === 'mxGraphModel')
    const packed = diagram.children.filter(c => c.type === 'text').map(c => c.raw).join('').trim()
    if (!model && packed) {
      const xml = decodeURIComponent(inflateRawSync(Buffer.from(packed, 'base64')).toString('latin1'))
      model = elements(parseXml(xml)).find(e => e.name === 'mxGraphModel')
      if (!model) throw new Error(`page ${page}: compressed content without mxGraphModel`)
      diagram.children = [model]
      changes.push({ page, code: 'input/compressed', cell: null, message: 'compressed diagram written as plain XML' })
    }
    if (model) models.push([model, page])
  })
  // a bare mxGraphModel file, without mxfile/diagram
  if (!diagrams.length) for (const e of walk(tree)) if (e.name === 'mxGraphModel') models.push([e, '1'])
  if (!models.length) throw new Error('no mxGraphModel in the file')
  for (const [model, page] of models) normalizeModel(model, page, changes, issues)
  return { text: serializeXml(tree), changes, issues }
}

function report(file, result, checkOnly) {
  const lines = [`# draw.io normalize: ${file}`, '']
  lines.push(`## ${checkOnly ? 'Da cambiare' : 'Cambiato'} (${result.changes.length})`, '')
  for (const c of result.changes) lines.push(`- [${c.code}] pagina ${c.page}${c.cell ? `, cella ${c.cell}` : ''}: ${c.message}`)
  lines.push('', `## Da correggere a mano (${result.issues.length})`, '')
  for (const c of result.issues) lines.push(`- [${c.code}] pagina ${c.page}${c.cell ? `, cella ${c.cell}` : ''}: ${c.message}`)
  lines.push('', 'Poi: validate_diagram.py <file> --quality showcase --json, con validation.errors = 0 e validation.warnings = 0.')
  return lines.join('\n')
}

export async function main(argv = process.argv.slice(2), { log = console.log } = {}) {
  const options = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') options.check = true
    else if (argv[i] === '--json') options.json = true
    else if (argv[i] === '--output') options.output = argv[++i]
    else if (argv[i] === '--help' || argv[i] === '-h') options.help = true
    else options.file = argv[i]
  }
  if (options.help || !options.file) {
    log('node drawio-normalize.mjs <file.drawio> [--check] [--output <file>] [--json]')
    return options.help ? 0 : 2
  }
  const file = resolve(options.file)
  const result = normalize(await readFile(file, 'utf8'))
  if (!options.check && (result.changes.length || options.output)) await writeFile(resolve(options.output ?? file), result.text)
  log(options.json ? JSON.stringify({ file, check: !!options.check, changes: result.changes, issues: result.issues }, null, 2)
    : report(file, result, options.check))
  return result.issues.length || options.check && result.changes.length ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  main().then(code => { process.exitCode = code }, error => { console.error(error.message); process.exitCode = 2 })
