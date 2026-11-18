#!/usr/bin/env node
// Builds a customer guide of a NOVA development from its single source, docs/guides/<name>/guide.yaml:
//   <fileBase>.docx  Word, with docx-js: cover, document table, numbered contents with pages, list of figures, one
//                    block per step (goal, who, prerequisites, transaction or app, menu path, field → value, expected
//                    result, how to verify, if it fails, screenshot)
//   <fileBase>.pptx  PowerPoint, with PptxGenJS: cover, chapters, intro tables, one slide per step with the screenshot
//   capture-sap.md   the list of the SAP screenshots still to capture on the system (figures of kind sap)
//   build.json       the hashes of the source and of the screenshots the documents were built from (read by check.mjs)
// The brand comes from docs/brand/ (brand.json and its PNG logos); without it the documents are neutral.
// A figure whose PNG is in screenshots/ (figNN-<id>.png, or any *-<id>.png) is embedded; otherwise a numbered frame
// names the transaction, the path and what the screen must show, and check.mjs refuses the documents until it is
// captured (capture.mjs for the app figures, capture-sap.md for the SAP ones).
//
//   node <skill>/scripts/guide/build.mjs --guide docs/guides/install-config [--brand docs/brand] [--pdf <dir>]
// Needs once: npm ci --prefix <skill>/scripts/guide (docx, pptxgenjs, js-yaml, jszip at the versions of the lockfile).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { findShot, loadGuide, plain, requireInstalled, runsOf } from './lib/model.mjs';
import { loadBrand, pngSize } from './lib/brand.mjs';
import { CONTENT, docxKit, fixBookmarkIds, officePdf } from './lib/docx-kit.mjs';

process.on('uncaughtException', (e) => { console.error(e.message); process.exit(2); });

const { values: args } = parseArgs({
  options: { guide: { type: 'string' }, brand: { type: 'string', default: 'docs/brand' }, pdf: { type: 'string' }, help: { type: 'boolean', short: 'h' } },
});
if (args.help || !args.guide) {
  console.log('node build.mjs --guide <folder with guide.yaml> [--brand docs/brand] [--pdf <dir>]');
  process.exit(args.help ? 0 : 2);
}

const docx = requireInstalled('docx');
const PptxGenJS = requireInstalled('pptxgenjs');
const JSZip = requireInstalled('jszip');

const g = await loadGuide(args.guide);
const B = loadBrand(path.resolve(args.brand));
const M = g.meta;
const L = g.labels;
const K = B.colors;
const FONT = B.font;
const MONO = B.mono;
const SHOTS = g.paths.shots;
const OUT_DOCX = path.join(g.paths.root, `${M.fileBase}.docx`);
const OUT_PPTX = path.join(g.paths.root, `${M.fileBase}.pptx`);
const WORK = mkdtempSync(path.join(tmpdir(), 'nova-guide-'));
const vendor = M.vendor ?? B.company;
const vendorLegal = M.vendorLegal ?? B.legal ?? vendor;
const footerText = M.footer ?? [vendor, M.product, M.title].filter(Boolean).join(' · ');
const shotOf = (f) => findShot(SHOTS, f);
const stepTitle = (st) => `${L.step} ${st.id}  ${plain(st.title)}`;
const fullTitle = M.kind === 'user' && M.role ? `${M.title} · ${M.role}` : M.title;

// ============================================================================================== WORD
function buildDocx() {
  const {
    AlignmentType, BorderStyle, Bookmark, HeadingLevel, LevelFormat, PageReference, Packer, Paragraph, Tab, Table,
    TableRow, TabStopType, TextRun, WidthType, TableLayoutType,
  } = docx;
  // the pieces every branded Word document shares: lib/docx-kit.mjs
  const kit = docxKit(docx, B);
  const { tr, P, borders, cell, widthsOf, label, headRow, dataTable, gap, image } = kit;
  const bm = (id) => id.replace(/[^A-Za-z0-9_]/g, '_');

  // ---------- cover: product, title, subtitle, version and the legal name
  const cover = kit.cover({ eyebrow: fullTitle, title: M.product, subtitle: M.subtitle, vendor,
    line: `${L.version} ${M.docVersion} · ${M.date}${vendorLegal ? ` · ${vendorLegal}` : ''}` });

  // ---------- document table and the note on the screenshots
  const about = [...(M.about ?? [])];
  if (M.kind === 'user' && M.role) about.unshift([L.role, M.role]);
  about.push([L.version, `${M.docVersion} · ${M.date}`]);
  if (vendorLegal) about.push([L.publishedBy, vendorLegal]);
  about.push([`${L.steps} · ${L.figures.toLowerCase()}`, `${g.steps.length} · ${g.figures.length}`]);
  const body = [dataTable({ columns: [L.document, ''], widths: [30, 70], rows: about }), gap(200)];
  if (M.imagesNote) body.push(new Paragraph({ spacing: { after: 80 }, children: [label(L.about, 16)] }), P(M.imagesNote, { size: 18, color: K.muted }));

  // ---------- contents (static, with page references) and list of figures
  const tocLine = (text, anchor, level) =>
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: CONTENT, leader: 'dot' }],
      spacing: { after: level === 0 ? 60 : 20, before: level === 0 ? 120 : 0 },
      indent: { left: level === 0 ? 0 : 360 },
      children: [
        new TextRun({ text, font: FONT, size: level === 0 ? 20 : 18, bold: level === 0, color: level === 0 ? K.ink : K.text }),
        new TextRun({ children: [new Tab()], font: FONT, size: 18 }),
        new PageReference(anchor, { font: FONT, size: 18 }),
      ],
    });
  const chapterLabel = (ch) => (ch.appendix ? plain(ch.title) : `${ch.no}  ${plain(ch.title)}`);
  body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun({ text: L.contents, font: FONT })] }));
  g.chapters.forEach((ch, ci) => {
    body.push(tocLine(chapterLabel(ch), `ch${ci + 1}`, 0));
    for (const st of ch.steps ?? []) body.push(tocLine(stepTitle(st), bm(`st_${st.id}`), 1));
  });
  if (g.figures.length) {
    body.push(tocLine(L.figures, 'lof', 0));
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new Bookmark({ id: 'lof', children: [new TextRun({ text: L.figures, font: FONT })] })] }));
    for (const f of g.figures)
      body.push(new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT, leader: 'dot' }],
        spacing: { after: 30 },
        children: [
          new TextRun({ text: `${L.figure} ${f.no}  `, font: FONT, size: 18, bold: true, color: K.ink }),
          new TextRun({ text: plain(f.title), font: FONT, size: 18, color: K.text }),
          new TextRun({ children: [new Tab()], font: FONT, size: 18 }),
          new PageReference(`fig${f.no}`, { font: FONT, size: 18 }),
        ],
      }));
  }

  // ---------- figures: the screenshot, or the numbered frame of the screenshot still to capture
  const caption = (f) => new Paragraph({
    spacing: { before: 60, after: 200 },
    children: [new Bookmark({ id: `fig${f.no}`, children: [
      new TextRun({ text: `${L.figure} ${f.no}  `, bold: true, font: FONT, size: 17, color: K.accentText }),
      new TextRun({ text: plain(f.title), font: FONT, size: 17, color: K.muted }),
    ] })],
  });
  const figureBlock = (f) => {
    const shot = shotOf(f);
    if (shot)
      return [
        new Paragraph({ keepNext: true, spacing: { before: 80, after: 0 }, alignment: AlignmentType.CENTER, children: [image(shot, 642, 560, { title: `${L.figure} ${f.no}`, description: plain(f.title), name: f.id })] }),
        caption(f),
      ];
    const dash = { style: BorderStyle.DASHED, size: 12, color: K.accent };
    const line = (name, value) => new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `${name}  `, bold: true, font: FONT, size: 17, color: K.accentText }), ...runsOf(value).map((r) => tr(r, { size: 17, noCodeShade: true }))] });
    return [
      new Table({
        width: { size: CONTENT, type: WidthType.DXA },
        columnWidths: [CONTENT],
        rows: [new TableRow({ cantSplit: true, children: [cell([
          new Paragraph({ spacing: { before: 120, after: 80 }, alignment: AlignmentType.CENTER, children: [label(`${L.toInsert} · ${L.figure} ${f.no}`, 20, K.ink)] }),
          new Paragraph({ spacing: { after: 120 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${f.id} · screenshots/${f.file}`, font: MONO, size: 16, color: K.muted })] }),
          ...(f.tcode ? [line(L.where, f.tcode)] : []),
          ...(f.path ? [line(L.path, f.path)] : []),
          ...(f.shows ? [line(L.mustShow, f.shows)] : []),
          gap(100),
        ], CONTENT, { fill: K.tint, borders: { top: dash, bottom: dash, left: dash, right: dash } })] })],
      }),
      caption(f),
    ];
  };

  // ---------- steps
  const LABEL_W = 2300;
  const VAL_W = CONTENT - LABEL_W;
  const row = (name, children) => new TableRow({ cantSplit: true, children: [cell([new Paragraph({ spacing: { after: 0 }, children: [label(name)] })], LABEL_W, { fill: K.labelFill }), cell(children, VAL_W)] });
  const bullets = (list) => (list ?? []).map((t) => P(t, { bullet: true, after: 30, size: 18 }));
  let lists = 0;
  const numberingConfigs = [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '▸', alignment: AlignmentType.LEFT, style: { run: { color: K.accentText }, paragraph: { indent: { left: 300, hanging: 220 } } } }] }];
  const numbered = (list) => {
    const ref = `path${++lists}`;
    numberingConfigs.push({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { run: { bold: true, color: K.accentText }, paragraph: { indent: { left: 320, hanging: 300 } } } }] });
    return list.map((t) => P(t, { number: ref, after: 30, size: 18 }));
  };
  const twoCol = (rows) => new Table({ width: { size: CONTENT, type: WidthType.DXA }, columnWidths: [LABEL_W, VAL_W], layout: TableLayoutType.FIXED, rows });
  const stepBlocks = (st) => {
    const out = [
      new Paragraph({
        heading: HeadingLevel.HEADING_2, keepNext: true, pageBreakBefore: st !== st.chapter.steps[0],
        children: [new Bookmark({ id: bm(`st_${st.id}`), children: [new TextRun({ text: `${L.step} ${st.id}  `, font: FONT, color: K.accentText }), new TextRun({ text: plain(st.title), font: FONT })] })],
      }),
      twoCol([
        row(L.goal, [P(st.goal, { after: 0, size: 18 })]),
        row(L.who, [P(st.who, { after: 0, size: 18 })]),
        row(L.prereq, bullets(st.prereq)),
        row(L.where, [P(st.where, { after: 0, size: 18 })]),
        row(L.path, numbered(st.path)),
      ]),
      gap(80),
    ];
    if (st.fields?.length) {
      const w = widthsOf([40, 60]);
      out.push(new Table({
        width: { size: CONTENT, type: WidthType.DXA }, columnWidths: w, layout: TableLayoutType.FIXED,
        rows: [headRow([L.field, L.value], w), ...st.fields.map((f) => new TableRow({ cantSplit: true, children: [cell([P(f[0], { after: 0, size: 18, bold: true })], w[0]), cell([P(f[1], { after: 0, size: 18 })], w[1])] }))],
      }), gap(80));
    }
    out.push(twoCol([row(L.expected, [P(st.expected, { after: 0, size: 18 })]), row(L.verify, bullets(st.verify)), row(L.fail, bullets(st.fail))]), gap(60));
    for (const f of st.figs) out.push(...figureBlock(f));
    for (const f of st.refs)
      out.push(new Paragraph({ spacing: { before: 60, after: 200 }, children: [
        new TextRun({ text: `${L.screenshot}  `, bold: true, font: FONT, size: 17, color: K.accentText }),
        new TextRun({ text: `${L.see} ${f.no} (${plain(f.title)}), ${L.page.toLowerCase()} `, font: FONT, size: 17, color: K.muted }),
        new PageReference(`fig${f.no}`, { font: FONT, size: 17 }),
      ] }));
    return out;
  };

  // ---------- chapters
  g.chapters.forEach((ch, ci) => {
    body.push(new Paragraph({
      heading: HeadingLevel.HEADING_1, pageBreakBefore: true,
      children: [new Bookmark({ id: `ch${ci + 1}`, children: [...(ch.appendix ? [] : [new TextRun({ text: `${ch.no}  `, font: FONT, color: K.accentText })]), new TextRun({ text: plain(ch.title), font: FONT })] })],
    }));
    for (const b of ch.intro ?? []) {
      if (b.p) body.push(P(String(b.p).trim(), { after: 140 }));
      if (b.h) body.push(new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true, children: [new TextRun({ text: plain(b.h), font: FONT })] }));
      if (b.list) body.push(...bullets(b.list), gap(80));
      if (b.note) body.push(new Table({ width: { size: CONTENT, type: WidthType.DXA }, columnWidths: [CONTENT], rows: [new TableRow({ children: [cell([P(String(b.note).trim(), { after: 0, size: 18 })], CONTENT, { fill: K.note, borders: borders(K.rule) })] })] }), gap(140));
      if (b.table) body.push(dataTable(b.table), gap(160));
      if (b.checklist) body.push(dataTable(b.checklist, true), gap(160));
    }
    for (const st of ch.steps ?? []) body.push(...stepBlocks(st));
  });

  const doc = kit.document({
    creator: vendorLegal || M.product, title: `${M.product} · ${fullTitle}`, description: M.subtitle ?? '', numbering: numberingConfigs, cover, body,
    header: kit.header({ left: M.product, right: fullTitle, vendor }),
    footer: kit.footer({ text: [vendorLegal, `${L.version} ${M.docVersion}`, M.date].filter(Boolean).join(' · '), page: L.page, of: L.of, vendor }),
  });
  return Packer.toBuffer(doc);
}

// ============================================================================================== POWERPOINT
async function buildPptx() {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = vendorLegal || M.product;
  pptx.company = vendorLegal || '';
  pptx.title = `${M.product} · ${fullTitle}`;
  const W = 13.333;
  const H = 7.5;
  const C = { bg: K.dark, card: K.darkCard, border: K.darkBorder, heading: K.darkHeading, text: K.darkText, muted: K.darkMuted, accent: K.accent };
  let n = 0;
  const numbered = [];
  const sections = new Set();
  const addSlide = (section) => {
    if (!sections.has(section)) { pptx.addSection({ title: section }); sections.add(section); }
    n += 1;
    const slide = pptx.addSlide({ sectionTitle: section });
    slide.background = { color: C.bg };
    return slide;
  };
  const tx = (text, base = {}) => runsOf(text).map((r) => ({ text: r.t, options: { ...base, ...(r.code ? { fontFace: MONO, color: C.accent } : {}), ...(r.bold ? { bold: true } : {}) } }));
  const box = { fontFace: FONT, margin: 0, isTextBox: true };
  const logoOn = (slide, x, y, h) => {
    const file = B.logoOnDark ?? B.mark;
    if (!file) return;
    const { width, height } = pngSize(file);
    slide.addImage({ path: file, x: x - h * (width / height), y, h, w: h * (width / height) });
  };
  const footer = (slide) => {
    slide.addShape('line', { x: 0.6, y: H - 0.5, w: W - 1.2, h: 0, line: { color: C.border, width: 0.75 } });
    slide.addText(footerText, { ...box, x: 0.6, y: H - 0.45, w: 9, h: 0.3, fontSize: 9, color: C.muted });
    numbered.push({ slide, idx: n });
  };
  const frame = (s) => {
    const slide = addSlide(s.section);
    if (s.eyebrow) slide.addText(s.eyebrow.toUpperCase(), { ...box, x: 0.6, y: 0.4, w: 10.5, h: 0.3, fontSize: 11, bold: true, color: C.accent, charSpacing: 2 });
    if (s.title) slide.addText(tx(s.title), { ...box, x: 0.6, y: 0.7, w: 11.6, h: 0.75, fontSize: 26, bold: true, color: C.heading, valign: 'top', fit: 'shrink' });
    logoOn(slide, W - 0.6, 0.4, 0.3);
    footer(slide);
    return slide;
  };
  const tableSlide = (s, tbl, fontSize = 12) => {
    const slide = frame(s);
    const wts = tbl.widths ?? tbl.columns.map(() => 1);
    const sum = wts.reduce((a, b) => a + b, 0);
    const head = tbl.columns.map((c) => ({ text: plain(c).toUpperCase(), options: { bold: true, color: C.accent, fontSize: 10, fill: { color: C.card } } }));
    const rows = tbl.rows.map((r) => r.map((c, i) => ({ text: tx(String(c), { color: i === 0 ? C.heading : C.text, bold: i === 0, fontSize }) })));
    slide.addTable([head, ...rows], { x: 0.6, y: 1.65, w: W - 1.2, colW: wts.map((x) => (x / sum) * (W - 1.2)), fontFace: FONT, fontSize, border: { type: 'solid', color: C.border, pt: 0.75 }, fill: { color: C.bg }, valign: 'middle', margin: 0.06, autoPage: false });
  };
  const chunk = (arr, max) => { const parts = Math.max(1, Math.ceil(arr.length / max)); const size = Math.ceil(arr.length / parts); return Array.from({ length: parts }, (_, i) => arr.slice(i * size, i * size + size)); };

  // cover
  {
    const slide = addSlide('Cover');
    if (B.pattern) { const { width, height } = pngSize(B.pattern); slide.addImage({ path: B.pattern, x: 6.2, y: 2.2, w: 8.5, h: 8.5 * (height / width), transparency: 88 }); }
    logoOn(slide, W - 0.6, 0.55, 0.5);
    slide.addText(fullTitle.toUpperCase(), { ...box, x: 0.6, y: 2.2, w: 11, h: 0.4, fontSize: 13, bold: true, color: C.accent, charSpacing: 2 });
    slide.addText(M.product, { ...box, x: 0.6, y: 2.65, w: 11.5, h: 1.1, fontSize: 44, bold: true, color: C.heading, fit: 'shrink' });
    if (M.subtitle) slide.addText(tx(M.subtitle), { ...box, x: 0.6, y: 3.85, w: 9.5, h: 1.1, fontSize: 18, color: C.text, valign: 'top', fit: 'shrink' });
    slide.addShape('line', { x: 0.6, y: 5.6, w: 3, h: 0, line: { color: C.accent, width: 2 } });
    slide.addText([`${L.version} ${M.docVersion}`, M.date, vendorLegal].filter(Boolean).join(' · '), { ...box, x: 0.6, y: 5.8, w: 9, h: 0.35, fontSize: 12, color: C.muted });
  }
  // chapters of the guide
  {
    const slide = frame({ section: L.overview, eyebrow: L.contents, title: L.chapters });
    const cols = 3;
    const gapX = 0.25;
    const cw = (W - 1.2 - gapX * (cols - 1)) / cols;
    const rowsN = Math.ceil(g.chapters.length / cols);
    const ch = Math.min(1.05, (H - 2.4 - 0.2 * (rowsN - 1)) / rowsN);
    g.chapters.forEach((c, i) => {
      const x = 0.6 + (i % cols) * (cw + gapX);
      const y = 1.7 + Math.floor(i / cols) * (ch + 0.2);
      slide.addShape('roundRect', { x, y, w: cw, h: ch, rectRadius: 0.1, fill: { color: C.card }, line: { color: C.border, width: 0.75 } });
      slide.addText([
        { text: `${c.appendix ? L.appendix : String(c.no).padStart(2, '0')}\n`, options: { fontSize: 14, bold: true, color: C.accent } },
        { text: plain(c.title), options: { fontSize: 13, bold: true, color: C.heading } },
      ], { ...box, x: x + 0.18, y: y + 0.1, w: cw - 0.36, h: ch - 0.2, valign: 'top', fit: 'shrink' });
    });
  }
  for (const ch of g.chapters) {
    const section = (ch.appendix ? plain(ch.title) : `${ch.no} ${plain(ch.title)}`).slice(0, 60);
    {
      const slide = addSlide(section);
      slide.addText(ch.appendix ? L.appendix : String(ch.no).padStart(2, '0'), { ...box, x: 0.6, y: 1.8, w: 6, h: 1.4, fontSize: ch.appendix ? 40 : 72, bold: true, color: C.accent });
      slide.addText(plain(ch.title), { ...box, x: 0.6, y: 3.25, w: 11.5, h: 1.25, fontSize: 32, fit: 'shrink', bold: true, color: C.heading, valign: 'top' });
      const first = (ch.intro ?? []).find((b) => b.p);
      if (first) slide.addText(tx(String(first.p).trim(), { color: C.text }), { ...box, x: 0.6, y: 4.7, w: 10.5, h: 1.9, fontSize: 14, color: C.text, valign: 'top', fit: 'shrink' });
      footer(slide);
    }
    for (const b of ch.intro ?? []) {
      const t = b.table ?? b.checklist;
      if (!t) continue;
      const h = ch.intro.slice(0, ch.intro.indexOf(b)).reverse().find((x) => x.h)?.h ?? plain(ch.title);
      const parts = chunk(t.rows, t.rows.length > 12 ? 9 : 7);
      parts.forEach((rows, i) => {
        const tt = b.checklist ? { columns: ['☐', ...t.columns], widths: [4, ...(t.widths ?? t.columns.map(() => 100 / t.columns.length))], rows: rows.map((r) => ['☐', ...r]) } : { ...t, rows };
        tableSlide({ section, eyebrow: ch.appendix ? L.appendix : `${L.chapter} ${ch.no}`, title: `${plain(h)}${parts.length > 1 ? ` (${i + 1}/${parts.length})` : ''}` }, tt, t.columns.length > 3 ? 10 : 11);
      });
    }
    for (const st of ch.steps ?? []) {
      const slide = frame({ section, eyebrow: `${L.step} ${st.id} · ${plain(st.who).split(/[;,(]/)[0].trim()}`, title: plain(st.title) });
      const LX = 0.6;
      const LW = 5.55;
      const RX = 6.45;
      const RW = W - 0.6 - RX;
      let y = 1.6;
      slide.addText(tx(st.goal, { color: C.text }), { ...box, x: LX, y, w: LW, h: 0.62, fontSize: 13, color: C.text, valign: 'top', fit: 'shrink' });
      y += 0.72;
      slide.addShape('roundRect', { x: LX, y, w: LW, h: 0.5, rectRadius: 0.08, fill: { color: C.card }, line: { color: C.accent, width: 0.75 } });
      slide.addText([{ text: `${L.whereShort.toUpperCase()}  `, options: { bold: true, color: C.accent, fontSize: 10, charSpacing: 1 } }, ...tx(st.where, { color: C.heading, fontSize: 11 })], { ...box, x: LX + 0.12, y, w: LW - 0.24, h: 0.5, valign: 'middle', fit: 'shrink' });
      y += 0.62;
      const steps = st.path.slice(0, 8);
      slide.addText(steps.map((p, i) => ({ text: plain(p), options: { bullet: { type: 'number' }, color: C.text, fontSize: 11, breakLine: i < steps.length - 1 } })), { ...box, x: LX, y, w: LW, h: 1.75, valign: 'top', paraSpaceAfter: 2, fit: 'shrink' });
      y += 1.85;
      // the fields as far as they fit above the bar of the result: a table does not shrink, so the rows are measured
      // (about 24 characters a line in the name, 62 in the value at 10 pt) and a long value is cut at a word with «…»;
      // whatever is left out is in the Word edition, which the slide says, and in the notes
      const all = st.fields ?? [];
      const LINE = 0.165;
      const lines = (s, per) => Math.max(1, Math.ceil(plain(s).length / per));
      const rowH = (f) => Math.max(lines(f[0], 24), lines(f[1], 62)) * LINE + 0.1;
      let room = 6.2 - 0.12 - y - (all.length ? 0.3 : 0);
      const fv = [];
      for (const f of all.slice(0, 4)) {
        if (rowH(f) <= room) { fv.push(f); room -= rowH(f); continue; }
        const fit = Math.floor((room - 0.1) / LINE);
        if (fit >= 2 && lines(f[0], 24) <= fit) {
          const cut = plain(f[1]).slice(0, fit * 62 - 4).replace(/\s+\S*$/, '');
          fv.push([f[0], `${cut} …`]);
        }
        break;
      }
      if (fv.length)
        slide.addTable(fv.map((f) => [{ text: tx(f[0], { color: C.heading, bold: true, fontSize: 10 }) }, { text: tx(f[1], { color: C.text, fontSize: 10 }) }]),
          { x: LX, y, w: LW, colW: [2.0, LW - 2.0], fontFace: FONT, fontSize: 10, border: { type: 'solid', color: C.border, pt: 0.5 }, fill: { color: C.bg }, margin: 0.05, valign: 'middle', autoPage: false });
      const shortened = fv.length < all.length || fv.some((f, i) => f[1] !== all[i][1]);
      if (shortened)
        slide.addText(`${L.fullDetails} ${st.id}.`, { ...box, x: LX, y: 6.2 - 0.36, w: LW, h: 0.26, fontSize: 9, color: C.muted, valign: 'bottom' });
      const f = st.figs[0] ?? st.refs[0];
      const boxY = 1.6;
      const boxH = 4.45;
      const shot = f && shotOf(f);
      if (shot) {
        const { width, height } = pngSize(shot);
        const s = Math.min(RW / width, boxH / height);
        const iw = width * s;
        const ih = height * s;
        slide.addShape('rect', { x: RX + (RW - iw) / 2 - 0.03, y: boxY - 0.03, w: iw + 0.06, h: ih + 0.06, fill: { color: C.border }, line: { color: C.border, width: 0 } });
        slide.addImage({ path: shot, x: RX + (RW - iw) / 2, y: boxY, w: iw, h: ih, altText: plain(f.title) });
        slide.addText(`${L.figure} ${f.no} · ${plain(f.title)}`, { ...box, x: RX, y: boxY + ih + 0.1, w: RW, h: 0.4, fontSize: 10, color: C.muted, valign: 'top' });
      } else if (f) {
        slide.addShape('roundRect', { x: RX, y: boxY, w: RW, h: 3.2, rectRadius: 0.1, fill: { color: C.card }, line: { color: C.accent, width: 1.25, dashType: 'dash' } });
        slide.addText([
          { text: `${L.toInsert.toUpperCase()} · ${L.figure.toUpperCase()} ${f.no}\n`, options: { bold: true, color: C.accent, fontSize: 12, charSpacing: 1 } },
          { text: `${f.id}  ·  screenshots/${f.file}\n\n`, options: { color: C.muted, fontSize: 10, fontFace: MONO } },
          ...(f.tcode ? [{ text: `${L.where}  `, options: { bold: true, color: C.heading, fontSize: 11 } }, { text: `${plain(f.tcode)}\n`, options: { color: C.text, fontSize: 11 } }] : []),
          ...(f.path ? [{ text: `${L.path}  `, options: { bold: true, color: C.heading, fontSize: 11 } }, { text: `${plain(f.path)}\n`, options: { color: C.text, fontSize: 11 } }] : []),
          { text: `${L.mustShow}  `, options: { bold: true, color: C.heading, fontSize: 11 } },
          { text: plain(f.shows), options: { color: C.text, fontSize: 11 } },
        ], { ...box, x: RX + 0.25, y: boxY + 0.2, w: RW - 0.5, h: 2.8, valign: 'top', fit: 'shrink' });
      }
      slide.addShape('roundRect', { x: 0.6, y: 6.2, w: W - 1.2, h: 0.62, rectRadius: 0.08, fill: { color: C.card }, line: { color: C.border, width: 0.75 } });
      slide.addText([{ text: `${L.expectedShort.toUpperCase()}  `, options: { bold: true, color: C.accent, fontSize: 10, charSpacing: 1 } }, ...tx(st.expected, { color: C.heading, fontSize: 12 })], { ...box, x: 0.75, y: 6.2, w: W - 1.5, h: 0.62, valign: 'middle', fit: 'shrink' });
      // items that are sentences already end with their full stop: no semicolon after it
      const listed = items => items.map(plain).map((t, i, all) => i === all.length - 1 || /[.!?:]$/.test(t) ? t : `${t};`).join(' ');
      slide.addNotes([
        stepTitle(st),
        `${L.who}: ${plain(st.who)}`,
        `${L.prereq}: ${listed(st.prereq)}`,
        `${L.verify}: ${listed(st.verify)}`,
        `${L.fail}: ${listed(st.fail)}`,
        ...(st.fields ?? []).map((f) => `${plain(f[0])}: ${plain(f[1])}`),
        `${L.fullDetails} ${st.id}.`,
      ].join('\n'));
    }
  }
  numbered.forEach(({ slide, idx }) => slide.addText(`${String(idx).padStart(2, '0')} / ${String(n).padStart(2, '0')}`, { ...box, x: W - 2.6, y: H - 0.45, w: 2, h: 0.3, fontSize: 9, color: C.muted, align: 'right' }));
  await pptx.writeFile({ fileName: OUT_PPTX });
  return n;
}

// ============================================================================================== capture-sap.md
function writeCaptureList() {
  const sap = g.figures.filter((f) => f.kind === 'sap');
  const rows = sap.map((f) => `| ${f.no} | \`${f.file}\` | ${f.step} | ${plain(f.tcode)} | ${plain(f.path)} | ${plain(f.shows)} | ${shotOf(f) ? 'captured' : 'to capture'} |`);
  const table = ['| Figure | File in `screenshots/` | Step | Transaction / app | Path | Must show | State |', '|---|---|---|---|---|---|---|', ...rows].join('\n');
  const block = `<!-- figures:start -->\n${table}\n<!-- figures:end -->`;
  const file = g.paths.captureList;
  if (existsSync(file)) writeFileSync(file, readFileSync(file, 'utf8').replace(/<!-- figures:start -->[\s\S]*<!-- figures:end -->/, block));
  else if (sap.length)
    writeFileSync(file, `# SAP screenshots of ${M.product} · ${fullTitle}

Captured by hand on the development or test system (never a customer system), while running the steps of the guide,
and saved in \`screenshots/\` with the file name of the table; then \`build.mjs\` runs again and replaces the frames.

Rules: logon language of the guide; SAP GUI theme Quartz or Horizon, Fiori apps in SAP Horizon; window 1440 × 900;
only the transaction, no other windows or tooltips; the example values of the guide; names of real people, e-mail
addresses, internal host names, client IDs and secrets covered with the background color of the field (a secret is
never shown, not even masked); PNG without annotations (the guide adds the captions).

${block}
`);
}

// ============================================================================================== main
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
writeFileSync(OUT_DOCX, await fixBookmarkIds(JSZip, await buildDocx()));
const slides = await buildPptx();
writeCaptureList();
const shots = Object.fromEntries(g.figures.map((f) => [f.id, shotOf(f) ? sha(readFileSync(shotOf(f))) : null]));
writeFileSync(g.paths.stamp, JSON.stringify({
  source: sha(readFileSync(g.paths.source)), brand: B.neutral ? 'neutral' : sha(readFileSync(path.join(B.dir, 'brand.json'))),
  shots, documents: [path.basename(OUT_DOCX), path.basename(OUT_PPTX)],
}, null, 2) + '\n');
const captured = Object.values(shots).filter(Boolean).length;
console.log(`✓ ${path.relative(process.cwd(), OUT_DOCX)}`);
console.log(`✓ ${path.relative(process.cwd(), OUT_PPTX)} (${slides} slides)`);
console.log(`  ${g.steps.length} steps · ${g.figures.length} figures (${captured} captured, ${g.figures.length - captured} to capture) · brand ${B.neutral ? 'neutral (no docs/brand/brand.json)' : B.company}`);

if (args.pdf) {
  mkdirSync(args.pdf, { recursive: true });
  for (const f of [OUT_DOCX, OUT_PPTX]) {
    const target = path.join(args.pdf, `${path.basename(f).replace(/\./, '_')}.pdf`);
    const made = officePdf(f, target, WORK);
    if (made.target) console.log(`  PDF: ${target}`);
    else console.log(`  PDF not made for ${path.basename(f)} (LibreOffice soffice): ${made.reason}`);
  }
}
rmSync(WORK, { recursive: true, force: true });
