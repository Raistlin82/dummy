#!/usr/bin/env node
// The gate of the customer guides (step GUIDE_CHECK, before HANDOVER_APPROVAL): for each guide folder
//   - guide.yaml valid: every step with goal, who, prerequisites, transaction or app, path, expected result, how to
//     verify, if it fails, and a screenshot;
//   - every figure captured: no frame «screenshot to be inserted» left in the documents;
//   - the Word and PowerPoint files built from the current source and screenshots (build.json);
//   - with a brand (docs/brand/brand.json): the logo on the cover and the legal name in the footer (F23);
//   - no development marker in the source or in the documents: unverified facts, placeholders, TODO, open risks,
//     internal references (NV-…, SR-…), paths of the development docs; they belong in open-points.md, which the
//     documents never include (the build never reads it).
//
//   node <skill>/scripts/guide/check.mjs docs/guides/install-config docs/guides/user-<role> [--brand docs/brand]
//        [--output docs/audit/<date>-guides.md] [--json]
// Exit 1 with any finding.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { findShot, loadGuide, requireInstalled } from './lib/model.mjs';
import { loadBrand } from './lib/brand.mjs';
import { findMarkers, officeText } from './lib/markers.mjs';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: { brand: { type: 'string', default: 'docs/brand' }, output: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } },
});
if (args.help || !positionals.length) {
  console.log('node check.mjs <guide folder>... [--brand docs/brand] [--output <report.md>] [--json]');
  process.exit(args.help ? 0 : 2);
}

const JSZip = requireInstalled('jszip');
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const brand = loadBrand(path.resolve(args.brand));

async function officeParts(file) {
  const zip = await JSZip.loadAsync(readFileSync(file));
  const names = Object.keys(zip.files).filter((n) => /^(word\/(document|header\d*|footer\d*)\.xml|ppt\/(slides|notesSlides)\/[^/]+\.xml)$/.test(n));
  return Promise.all(names.map(async (n) => ({ name: n, text: officeText(await zip.file(n).async('string')) })));
}

async function checkGuide(dir) {
  const findings = [];
  const add = (kind, where, text) => findings.push({ kind, where, text });
  let g;
  try { g = await loadGuide(dir); } catch (e) {
    for (const p of e.problems ?? [e.message]) add('source', path.join(dir, 'guide.yaml'), p);
    return { dir, findings };
  }
  const rel = (p) => path.relative(process.cwd(), p);
  for (const h of findMarkers(readFileSync(g.paths.source, 'utf8'), { where: rel(g.paths.source), extra: brand.markers })) add(`marker:${h.marker}`, h.where, h.text);
  const missing = g.figures.filter((f) => !findShot(g.paths.shots, f));
  for (const f of missing) add('screenshot', `${g.labels.figure} ${f.no} (${f.id}, step ${f.step})`, `screenshots/${f.file} missing: ${f.kind === 'sap' ? 'capture it on the system (capture-sap.md)' : 'capture.mjs'}`);
  const docs = [`${g.meta.fileBase}.docx`, `${g.meta.fileBase}.pptx`].map((f) => path.join(g.paths.root, f));
  for (const d of docs) if (!existsSync(d)) add('build', rel(d), 'not built: run build.mjs');
  if (!existsSync(g.paths.stamp)) add('build', rel(g.paths.stamp), 'missing: run build.mjs');
  else {
    const stamp = JSON.parse(readFileSync(g.paths.stamp, 'utf8'));
    if (stamp.source !== sha(readFileSync(g.paths.source))) add('build', rel(g.paths.source), 'changed after the last build: run build.mjs');
    for (const f of g.figures) {
      const shot = findShot(g.paths.shots, f);
      if ((shot ? sha(readFileSync(shot)) : null) !== (stamp.shots?.[f.id] ?? null)) add('build', `screenshots/${f.file}`, 'changed after the last build: run build.mjs');
    }
    const brandNow = brand.neutral ? 'neutral' : sha(readFileSync(path.join(brand.dir, 'brand.json')));
    if (stamp.brand !== brandNow) add('build', args.brand, 'brand changed after the last build: run build.mjs');
  }
  // the brand (F23): the logo on the cover and the legal name in the footer of the Word edition, the logo on the first
  // slide; only with a brand: neutral documents have none
  if (!brand.neutral) {
    const squeeze = (t) => t.toLowerCase().replace(/\s+/g, '');
    const [docx, pptx] = docs;
    if (existsSync(docx)) {
      const zip = await JSZip.loadAsync(readFileSync(docx));
      const xml = await zip.file('word/document.xml').async('string');
      if (!/<wp:docPr\b[^>]*name="logo"/.test(xml)) add('brand', rel(docx), 'no logo on the cover: logoOnDark, mark or logo in brand.json');
      const footers = await Promise.all(Object.keys(zip.files).filter((n) => /^word\/footer\d*\.xml$/.test(n)).map((n) => zip.file(n).async('string')));
      if (brand.legal && !footers.some((f) => squeeze(officeText(f)).includes(squeeze(brand.legal)))) add('brand', rel(docx), `the footer does not carry ${brand.legal}`);
    }
    if (existsSync(pptx)) {
      const zip = await JSZip.loadAsync(readFileSync(pptx));
      const first = await zip.file('ppt/slides/slide1.xml')?.async('string');
      if (!first?.includes('<p:pic')) add('brand', rel(pptx), 'no logo on the cover slide: logoOnDark or mark in brand.json');
    }
  }
  for (const d of docs.filter((x) => existsSync(x)))
    for (const part of await officeParts(d))
      for (const h of findMarkers(part.text, { where: `${rel(d)}#${part.name}`, extra: brand.markers })) add(`marker:${h.marker}`, h.where, h.text);
  return { dir, guide: `${g.meta.product} · ${g.meta.title}${g.meta.role ? ` · ${g.meta.role}` : ''}`, steps: g.steps.length, figures: g.figures.length, findings };
}

const results = [];
for (const dir of positionals) results.push(await checkGuide(dir));
const total = results.reduce((a, r) => a + r.findings.length, 0);
if (args.json) console.log(JSON.stringify({ ok: total === 0, results }, null, 2));
const md = [`# Customer guides check`, '', `Brand: ${brand.neutral ? 'neutral (no brand.json)' : brand.company} · ${total ? `${total} findings` : 'no findings'}`, ''];
for (const r of results) {
  md.push(`## ${r.guide ?? r.dir}`, '', `Folder \`${r.dir}\`${r.steps != null ? ` · ${r.steps} steps · ${r.figures} figures` : ''}`, '');
  if (!r.findings.length) md.push('No findings.', '');
  else md.push('| Kind | Where | What |', '|---|---|---|', ...r.findings.map((f) => `| ${f.kind} | ${f.where.replace(/\|/g, '\\|')} | ${f.text.replace(/\|/g, '\\|')} |`), '');
}
if (args.output) { mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true }); writeFileSync(args.output, md.join('\n')); }
if (!args.json) console.log(md.join('\n'));
process.exit(total ? 1 : 0);
