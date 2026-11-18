// The model of a customer guide (installation and configuration, or user guide of a role): guide.yaml numbered into
// chapters, steps and figures, so that build, capture and check agree on figure numbers and screenshot file names
// (screenshots/figNN-<id>.png). No dependency here: the YAML parser is passed in, so the tests run without node_modules.
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// An installed package, without installing anything: <NAME>_MODULE, the node_modules of this folder (npm ci --prefix
// <skill>/scripts/guide), of the development repository, or the global modules.
export function requireInstalled(name, { cwd = process.cwd() } = {}) {
  const env = process.env[`${name.replace(/[^a-z]/gi, '_').toUpperCase()}_MODULE`];
  const req = createRequire(import.meta.url);
  const globalRoot = path.join(path.dirname(path.dirname(process.execPath)), 'lib', 'node_modules');
  const candidates = [env, path.join(HERE, 'node_modules', name), path.join(cwd, 'node_modules', name), path.join(globalRoot, name)]
    .filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return req(c);
  throw new Error(`${name} not found: run  npm ci --prefix ${HERE}  (or set ${name.replace(/[^a-z]/gi, '_').toUpperCase()}_MODULE)`);
}

export const KINDS = ['install-config', 'user'];

// Labels of the documents, in the language of the guide (meta.language, en by default).
export const LABELS = {
  en: {
    step: 'Step', goal: 'Goal', who: 'Who', prereq: 'Prerequisites', where: 'Transaction or app', path: 'Menu path',
    field: 'Field', value: 'Value to enter', expected: 'Expected result', verify: 'How to verify', fail: 'If it fails',
    figure: 'Figure', contents: 'Contents', figures: 'List of figures', toInsert: 'Screenshot to be inserted',
    see: 'see Figure', page: 'Page', of: 'of', version: 'Version', document: 'Document', chapter: 'Chapter',
    appendix: 'Appendix', expectedShort: 'Expected', whereShort: 'Where', mustShow: 'Must show', screenshot: 'Screenshot',
    about: 'About the screenshots', fullDetails: 'Full details: Word edition, step', steps: 'steps', overview: 'Overview',
    chapters: 'Chapters of the guide', publishedBy: 'Published by', role: 'Role',
  },
  it: {
    step: 'Passo', goal: 'Obiettivo', who: 'Chi', prereq: 'Prerequisiti', where: 'Transazione o app', path: 'Percorso',
    field: 'Campo', value: 'Valore da inserire', expected: 'Risultato atteso', verify: 'Come verificare', fail: 'Se non riesce',
    figure: 'Figura', contents: 'Indice', figures: 'Elenco delle figure', toInsert: 'Schermata da inserire',
    see: 'vedi la Figura', page: 'Pagina', of: 'di', version: 'Versione', document: 'Documento', chapter: 'Capitolo',
    appendix: 'Appendice', expectedShort: 'Risultato', whereShort: 'Dove', mustShow: 'Deve mostrare', screenshot: 'Schermata',
    about: 'Le schermate', fullDetails: 'Tutti i dettagli: edizione Word, passo', steps: 'passi', overview: 'Introduzione',
    chapters: 'Capitoli della guida', publishedBy: 'Pubblicato da', role: 'Ruolo',
  },
};

// Numbers and checks a parsed guide. Throws with every problem at once, so one run lists what to fix.
export function numberGuide(g) {
  const problems = [];
  const m = g?.meta ?? {};
  for (const k of ['product', 'title', 'docVersion', 'date', 'fileBase']) if (!m[k]) problems.push(`meta.${k} missing`);
  if (m.kind && !KINDS.includes(m.kind)) problems.push(`meta.kind ${m.kind}: one of ${KINDS.join(', ')}`);
  if (m.kind === 'user' && !m.role) problems.push('meta.role missing: a user guide is for one role');
  if (m.language && !LABELS[m.language]) problems.push(`meta.language ${m.language}: one of ${Object.keys(LABELS).join(', ')}`);
  if (!Array.isArray(g?.chapters) || !g.chapters.length) problems.push('chapters missing');
  const figures = [];
  const byId = new Map();
  const stepIds = new Set();
  let no = 0;
  for (const ch of g?.chapters ?? []) {
    ch.no = ch.appendix ? null : ++no;
    if (!ch.title) problems.push(`chapter ${ch.id ?? ch.no}: title missing`);
    for (const st of ch.steps ?? []) {
      st.chapter = ch;
      if (stepIds.has(st.id)) problems.push(`step ${st.id} defined twice`);
      stepIds.add(st.id);
      const list = [...(st.figures ?? []), ...(st.figure ? [st.figure] : [])];
      st.figs = [];
      for (const f of list) {
        if (!f?.id || !/^[a-z0-9][a-z0-9-]*$/.test(f.id)) { problems.push(`step ${st.id}: figure id ${f?.id} (lowercase, digits, dashes)`); continue; }
        if (byId.has(f.id)) { problems.push(`figure ${f.id} defined twice`); continue; }
        if (!['app', 'sap'].includes(f.kind)) problems.push(`figure ${f.id}: kind app or sap`);
        if (!f.title) problems.push(`figure ${f.id}: title missing`);
        // what to capture on the system: the frame of a screenshot still missing names it
        if (f.kind === 'sap') for (const k of ['tcode', 'path', 'shows']) if (!f[k]) problems.push(`figure ${f.id}: ${k} missing`);
        const fig = { ...f, no: figures.length + 1, step: st.id };
        fig.file = `fig${String(fig.no).padStart(2, '0')}-${f.id}.png`;
        figures.push(fig);
        byId.set(f.id, fig);
        st.figs.push(fig);
      }
      st.refs = [];
    }
  }
  // references after numbering, so that a step can name a figure defined later
  for (const ch of g?.chapters ?? [])
    for (const st of ch.steps ?? [])
      for (const ref of [st.figure_ref].flat().filter(Boolean)) {
        const f = byId.get(ref);
        if (f) st.refs.push(f); else problems.push(`step ${st.id}: figure_ref ${ref} unknown`);
      }
  // the shape of every step: the blocks the customer reads, always the same; a comma in an unquoted YAML flow item
  // silently splits a cell
  for (const ch of g?.chapters ?? []) {
    for (const b of ch.intro ?? []) {
      const t = b.table ?? b.checklist;
      if (t) for (const r of t.rows ?? []) if (r.length !== t.columns.length)
        problems.push(`${ch.id ?? ch.title}: row with ${r.length} cells for ${t.columns.length} columns: ${JSON.stringify(r)}`);
    }
    for (const st of ch.steps ?? []) {
      for (const f of st.fields ?? []) if (!Array.isArray(f) || f.length !== 2) problems.push(`step ${st.id}: field row ${JSON.stringify(f)} is not [field, value]`);
      for (const k of ['title', 'goal', 'who', 'where', 'expected']) if (!st[k]) problems.push(`step ${st.id}: ${k} missing`);
      for (const k of ['prereq', 'path', 'verify', 'fail']) if (!Array.isArray(st[k]) || !st[k].length) problems.push(`step ${st.id}: ${k} missing (a list)`);
      if (!st.figs.length && !st.refs.length) problems.push(`step ${st.id}: no screenshot (figure or figure_ref)`);
    }
  }
  if (problems.length) throw Object.assign(new Error(`guide.yaml is not valid:\n  ${problems.join('\n  ')}`), { problems });
  g.meta.language ??= 'en';
  g.meta.kind ??= 'install-config';
  g.labels = LABELS[g.meta.language];
  g.figures = figures;
  g.figureById = byId;
  g.steps = g.chapters.flatMap((c) => c.steps ?? []);
  return g;
}

// The files of a guide folder: docs/guides/<name>/guide.yaml, screenshots/, the generated documents next to it.
export function guidePaths(dir) {
  const root = path.resolve(dir);
  return {
    root, source: path.join(root, 'guide.yaml'), shots: path.join(root, 'screenshots'),
    captureList: path.join(root, 'capture-sap.md'), stamp: path.join(root, 'build.json'), openPoints: path.join(root, 'open-points.md'),
  };
}

export async function loadGuide(dir, { yaml = requireInstalled('js-yaml') } = {}) {
  const { readFileSync } = await import('node:fs');
  const p = guidePaths(dir);
  if (!existsSync(p.source)) throw new Error(`${p.source} not found`);
  const g = numberGuide(yaml.load(readFileSync(p.source, 'utf8')));
  g.paths = p;
  return g;
}

// The screenshot of a figure: the exact numbered file, or any file of the same figure id (numbers moved after an edit).
export function findShot(shots, fig) {
  const exact = path.join(shots, fig.file);
  if (existsSync(exact)) return exact;
  if (!existsSync(shots)) return null;
  const other = readdirSync(shots).find((f) => f.endsWith(`-${fig.id}.png`));
  return other ? path.join(shots, other) : null;
}

// Inline markup of every text: `code` and **bold**.
export function runsOf(text) {
  const s = String(text ?? '');
  const out = [];
  let last = 0;
  for (const m of s.matchAll(/(`[^`]+`|\*\*[^*]+\*\*)/g)) {
    if (m.index > last) out.push({ t: s.slice(last, m.index) });
    out.push(m[0].startsWith('`') ? { t: m[0].slice(1, -1), code: true } : { t: m[0].slice(2, -2), bold: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: s.slice(last) });
  return out;
}
export const plain = (text) => runsOf(text).map((r) => r.t).join('');
