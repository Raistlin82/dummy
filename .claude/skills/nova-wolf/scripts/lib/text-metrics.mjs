// The size of a text in Arial, estimated without a font file: the advance widths of Helvetica (the metrics Arial was
// drawn to match), in thousandths of the font size. program-diagrams.mjs sizes its shapes with it and checks that no
// text is wider or taller than its shape; the estimate is conservative: bold is taken wider than it is, a character
// outside the table as a wide capital, and every width gets a margin.
const WIDTHS = {
  ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191, '(': 333, ')': 333, '*': 389, '+': 584,
  ',': 278, '-': 333, '.': 278, '/': 278, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778,
  P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556,
  p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '{': 334, '|': 260, '}': 334, '~': 584,
  // what the labels of the diagrams use beyond ASCII
  '·': 333, '–': 556, '—': 1000, '→': 1000, '←': 1000, '…': 1000, '«': 556, '»': 556, '’': 222, '≥': 549, '≤': 549,
  à: 556, á: 556, è: 556, é: 556, ì: 278, í: 278, ò: 556, ó: 556, ù: 556, ú: 556, À: 667, È: 667, É: 667
}
for (let digit = 0; digit <= 9; digit++) WIDTHS[digit] = 556
// a character the table does not know: as wide as a wide capital
const UNKNOWN = 778
// bold is at most this much wider than regular (Helvetica-Bold against Helvetica), and the margin of the estimate
const BOLD = 1.14
const MARGIN = 1.05
/** The height of a line of text, as a browser lays out Arial (line-height normal), in units of the font size. */
export const LINE = 1.2

/** The width in px of a text on one line, at a font size in px. */
export function textWidth(text, size, bold = false) {
  let units = 0
  for (const character of String(text)) units += WIDTHS[character] ?? UNKNOWN
  return units / 1000 * size * (bold ? BOLD : 1) * MARGIN
}

/** A text wrapped by words at a width, as a browser wraps a label: the lines. A word wider than the width stays whole. */
export function wrapText(text, size, width, bold = false) {
  const lines = []
  for (const paragraph of String(text).split('\n')) {
    let line = ''
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word
      if (!line || textWidth(candidate, size, bold) <= width) line = candidate
      else { lines.push(line); line = word }
    }
    lines.push(line)
  }
  return lines
}

/** A text cut to a width, with an ellipsis when it does not fit. */
export function fitText(text, size, width, bold = false) {
  const whole = String(text)
  if (textWidth(whole, size, bold) <= width) return whole
  let cut = whole
  while (cut.length > 1 && textWidth(`${cut}…`, size, bold) > width) cut = cut.slice(0, -1)
  return `${cut}…`
}
