// The pieces of a Word document with the brand of the team (docs/brand/): the dark cover, the header and the footer,
// the styles of the headings, paragraphs with `code` and **bold**, tables. One place for the customer guides (build.mjs)
// and for the documents of a custom code program (program-docs.mjs deliver), so the two look the same.
// `docx` is the docx library, passed in (requireInstalled('docx')); `B` the brand of loadBrand.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fadePng, pngSize, solidPng } from './brand.mjs';
import { plain, runsOf } from './model.mjs';

export const PAGE_W = 11906; // A4, in twentieths of a point
export const PAGE_H = 16838;
export const MARGIN = 1134; // 2 cm
export const CONTENT = PAGE_W - 2 * MARGIN;

export function docxKit(docx, B) {
  const {
    BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, PageBreak, PageNumber, Paragraph, ShadingType, Tab,
    Table, TableCell, TableRow, TabStopType, TextRun, VerticalAlign, WidthType, TableLayoutType,
    HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom,
  } = docx;
  const K = B.colors;
  const FONT = B.font;
  const MONO = B.mono;

  const tr = (r, extra = {}) =>
    new TextRun({
      text: r.t,
      bold: r.bold || extra.bold,
      font: r.code ? MONO : extra.font ?? FONT,
      size: r.code ? (extra.size ?? 19) - 1 : extra.size ?? 19,
      color: r.code ? extra.codeColor ?? K.ink : extra.color ?? K.text,
      shading: r.code && !extra.noCodeShade ? { type: ShadingType.CLEAR, fill: K.codeFill, color: 'auto' } : undefined,
    });
  const P = (text, opts = {}) =>
    new Paragraph({
      spacing: { after: opts.after ?? 100, before: opts.before ?? 0, line: 276 },
      alignment: opts.align,
      numbering: opts.bullet ? { reference: 'bullets', level: 0 } : opts.number ? { reference: opts.number, level: 0 } : undefined,
      keepNext: opts.keepNext,
      children: runsOf(text).map((r) => tr(r, opts)),
    });
  const border = (c = K.rule) => ({ style: BorderStyle.SINGLE, size: 4, color: c });
  const borders = (c) => ({ top: border(c), bottom: border(c), left: border(c), right: border(c) });
  const cell = (children, w, opts = {}) =>
    new TableCell({
      width: { size: w, type: WidthType.DXA },
      borders: opts.borders ?? borders(),
      shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: 'auto' } : undefined,
      margins: { top: 70, bottom: 70, left: 110, right: 110 },
      verticalAlign: opts.vAlign ?? VerticalAlign.TOP,
      children,
    });
  const widthsOf = (pcts) => {
    const sum = pcts.reduce((a, b) => a + b, 0);
    const w = pcts.map((p) => Math.floor((p / sum) * CONTENT));
    w[w.length - 1] += CONTENT - w.reduce((a, b) => a + b, 0);
    return w;
  };
  const label = (text, size = 15, color = K.accentText) => new TextRun({ text: text.toUpperCase(), bold: true, size, color, font: FONT, characterSpacing: 10 });
  const headRow = (cols, w) =>
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: cols.map((c, i) => cell([new Paragraph({ spacing: { after: 0 }, children: [label(plain(c), 15, 'FFFFFF')] })], w[i], { fill: K.ink, borders: borders(K.ink) })),
    });
  const dataTable = (tbl, checklist = false) => {
    const cols = checklist ? ['', ...tbl.columns] : tbl.columns;
    // percentages: without widths the columns share the table, and a checklist's box stays narrow
    const base = tbl.widths ?? tbl.columns.map(() => 100 / tbl.columns.length);
    const w = widthsOf(checklist ? [5, ...base.map((x) => x * 0.95)] : base);
    return new Table({
      width: { size: CONTENT, type: WidthType.DXA },
      columnWidths: w,
      layout: TableLayoutType.FIXED,
      rows: [
        headRow(cols, w),
        ...tbl.rows.map((row, ri) => new TableRow({
          cantSplit: true,
          children: (checklist ? ['☐', ...row] : row).map((c, i) => cell([P(String(c), { after: 0, size: 17, bold: i === 0 && !checklist })], w[i], { fill: ri % 2 ? 'FAFAFB' : undefined })),
        })),
      ],
    });
  };
  const gap = (after = 120) => new Paragraph({ spacing: { after }, children: [] });
  const image = (file, maxW, maxH, alt) => {
    const { width, height } = pngSize(file);
    const s = Math.min(maxW / width, maxH / height, 1);
    return new ImageRun({ type: 'png', data: readFileSync(file), transformation: { width: Math.round(width * s), height: Math.round(height * s) }, altText: alt });
  };
  const floating = (data, w, h, x, y, name, behindDocument = true) => new ImageRun({
    type: 'png', data, transformation: { width: w, height: h }, altText: { title: name, description: name, name },
    floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: Math.round(x * 9525) },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: Math.round(y * 9525) }, behindDocument, allowOverlap: true, zIndex: behindDocument ? 0 : 1 },
  });

  // The cover: dark, with the logo for dark backgrounds and the pattern of the brand; an eyebrow, the title, a subtitle
  // and a line under a rule. docx has no page shapes: the dark page is a PNG of one color behind the text.
  const cover = ({ eyebrow, title, subtitle, line, vendor }) => {
    const coverLogo = B.logoOnDark ?? B.mark ?? B.logo;
    const behind = [floating(solidPng(K.dark), 794, 1123, 0, 0, 'cover')];
    const faint = B.pattern ? fadePng(readFileSync(B.pattern), 0.14) : null;
    if (faint) {
      const { width, height } = pngSize(B.pattern);
      const w = 640;
      behind.push(floating(faint, w, Math.round((w * height) / width), 794 - w + 120, 1123 - Math.round((w * height) / width) - 60, 'pattern', false));
    }
    const out = [new Paragraph({ spacing: { after: 0 }, children: behind })];
    if (coverLogo) out.push(new Paragraph({ spacing: { after: 2200 }, children: [image(coverLogo, 220, 56, { title: 'Logo', description: vendor, name: 'logo' })] }));
    else out.push(gap(2200));
    out.push(
      new Paragraph({ spacing: { after: 160 }, children: [label(eyebrow, 22, K.accent)] }),
      new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 240 }, children: [new TextRun({ text: title, font: FONT, bold: true, size: 60, color: K.darkHeading })] }),
      ...(subtitle ? [P(subtitle, { size: 26, color: K.darkText, after: 600 })] : []),
      new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 12, color: K.accent, space: 8 } }, spacing: { after: 120 }, children: [] }),
      P(line, { size: 20, color: K.darkMuted }),
      new Paragraph({ children: [new PageBreak()] }),
    );
    return out;
  };

  // The header (the mark, a name in bold, a title at the right) and the footer (the mark, a line, the page of pages).
  const header = ({ left, right, vendor }) => new Header({ children: [new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: CONTENT }],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: K.rule, space: 6 } },
    children: [
      ...(B.mark ? [image(B.mark, 16, 16, { title: 'Mark', description: vendor, name: 'mark' }), new TextRun({ text: '   ', size: 16 })] : []),
      new TextRun({ text: left, font: FONT, size: 16, bold: true, color: K.ink }),
      new TextRun({ children: [new Tab(), right], font: FONT, size: 16, color: K.muted }),
    ],
  })] });
  const footer = ({ text, page, of, vendor }) => new Footer({ children: [new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: CONTENT }],
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: K.rule, space: 6 } },
    children: [
      ...(B.mark ? [image(B.mark, 12, 12, { title: 'Mark', description: vendor, name: 'footer-mark' }), new TextRun({ text: '  ', size: 15 })] : []),
      new TextRun({ text, font: FONT, size: 15, color: K.muted }),
      new TextRun({ children: [new Tab(), `${page} `, PageNumber.CURRENT, ` ${of} `, PageNumber.TOTAL_PAGES], font: FONT, size: 15, color: K.muted }),
    ],
  })] });

  // The document: the cover on a page of its own, then the body with header and footer, numbered from page 2. Without
  // a cover (cover: null, the two pages of a status report or a delivery sheet) the body starts on page 1.
  const document = ({ creator, title, description, numbering, cover: coverChildren, body, header: head, footer: foot }) => {
    const page = { size: { width: PAGE_W, height: PAGE_H } };
    const bodySection = {
      properties: { page: { ...page, margin: { top: 1300, bottom: 1134, left: MARGIN, right: MARGIN, header: 560, footer: 560 }, pageNumbers: { start: coverChildren ? 2 : 1 } } },
      headers: { default: head }, footers: { default: foot }, children: body,
    };
    return new Document({
      creator,
      title,
      description,
      features: { updateFields: true },
      styles: {
        default: { document: { run: { font: FONT, size: 19, color: K.text } } },
        paragraphStyles: [
          { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: FONT, size: 60, bold: true, color: K.ink } },
          { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 36, bold: true, color: K.ink }, paragraph: { spacing: { before: 120, after: 240 }, outlineLevel: 0 } },
          { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true, color: K.ink }, paragraph: { spacing: { before: 360, after: 140 }, outlineLevel: 1, keepNext: true } },
          { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 22, bold: true, color: K.accentText }, paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 2, keepNext: true } },
        ],
      },
      numbering: { config: numbering },
      sections: coverChildren
        ? [{ properties: { page: { ...page, margin: { top: 1700, bottom: 1134, left: MARGIN, right: MARGIN } } }, children: coverChildren }, bodySection]
        : [bodySection],
    });
  };

  return { tr, P, border, borders, cell, widthsOf, label, headRow, dataTable, gap, image, floating, cover, header, footer, document };
}

// docx-js gives every bookmark the same w:id; Word wants unique ids. Bookmarks never overlap here, so each start and
// the end that follows it get the same new number.
export async function fixBookmarkIds(JSZip, buf) {
  const zip = await JSZip.loadAsync(buf);
  let xml = await zip.file('word/document.xml').async('string');
  let n = 0;
  xml = xml.replace(/<w:bookmark(Start|End)\b([^>]*?)w:id="\d+"/g, (m, kind, mid) => {
    if (kind === 'Start') n += 1;
    return `<w:bookmark${kind}${mid}w:id="${n}"`;
  });
  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// The PDF of an Office document, with LibreOffice (soffice) in a profile of its own under `work`: { target } when
// written, { reason } when not (LibreOffice is not installed, or it failed).
export function officePdf(file, target, work) {
  const tmp = path.join(work, 'pdf');
  rmSync(tmp, { recursive: true, force: true });
  const r = spawnSync('soffice', [`-env:UserInstallation=file://${work}/lo`, '--headless', '--convert-to', 'pdf', '--outdir', tmp, file], { encoding: 'utf8', timeout: 300_000 });
  const made = existsSync(tmp) ? readdirSync(tmp).find((x) => x.endsWith('.pdf')) : null;
  if (r.status === 0 && made) { copyFileSync(path.join(tmp, made), target); return { target }; }
  return { reason: r.error?.message ?? r.stderr };
}
