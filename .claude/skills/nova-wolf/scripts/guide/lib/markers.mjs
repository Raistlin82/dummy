// The development markers that must never reach a customer document: the guide describes the final state of the
// product only, so open risks, unverified facts, placeholders and internal references stay in open-points.md.
export const MARKERS = [
  { id: 'unverified', re: /\bnot\s+verified\b|\bunverified\b|\bnon\s+verificat[oaie]\b|\bda\s+verificare\b|\bto\s+be\s+verified\b/i },
  { id: 'placeholder', re: /\bplaceholder\b|\bsegnaposto\b|\bscreenshot\s+to\s+be\s+inserted\b|\bschermata\s+da\s+inserire\b|\blorem\s+ipsum\b/i },
  { id: 'todo', re: /\bTODO\b|\bTBD\b|\bFIXME\b|\bXXX\b|\bda\s+definire\b|\bto\s+be\s+defined\b/ },
  { id: 'open-risk', re: /\bopen\s+(risk|point|issue)s?\b|\brisch(?:io|i)\s+apert[oi]\b|\bpunt[oi]\s+apert[oi]\b/i },
  // internal references of the development: NV-A03, NV-S12, SR-10, DS-3, DEC-2, R-1, A-15, I-4 …
  { id: 'internal-ref', re: /\b(?:NV-[A-Z]?\d+|SR-\d+|DS-\d+|DEC-\d+|RA-\d+|UX-[A-Z]\d+|DC-\d+|[ARIS]-\d{1,2})\b/ },
  { id: 'previous-version', re: /\b(?:previous|old|former)\s+version\s+of\s+(?:this|the)\s+(?:guide|document)\b|\bversione\s+precedente\s+(?:della|del)\s+(?:guida|documento)\b/i },
  { id: 'dev-path', re: /\bdocs\/(?:specification|architecture|technical|research|audit|decisions)\b|\bopen-points\.md\b|\.claude\/nova\b/i },
];

// Every marker in a text, with the line and a short excerpt; `extra` are the regular expressions of brand.json.
export function findMarkers(text, { where = '', extra = [] } = {}) {
  const rules = [...MARKERS, ...extra.map((m, i) => ({ id: `brand-${i + 1}`, re: new RegExp(m, 'i') }))];
  const hits = [];
  String(text ?? '').split(/\r?\n/).forEach((line, i) => {
    for (const r of rules) {
      const m = line.match(r.re);
      if (m) {
        const at = Math.max(0, m.index - 30);
        hits.push({ marker: r.id, where: `${where}:${i + 1}`, text: line.slice(at, m.index + m[0].length + 30).trim() });
      }
    }
  });
  return hits;
}

// The visible text of an Office file part: paragraphs on their own line, tags removed, entities decoded.
export function officeText(xml) {
  return String(xml)
    .replace(/<\/(?:w:p|a:p)>/g, '\n')
    .replace(/<(?:w:tab|w:br|a:br)\b[^>]*\/>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

// The text of a draw.io file: the labels and values of every cell, compressed diagrams included (base64 of a raw
// deflate of the URI-encoded XML). What a diagram says is text for the checks, also once it is an image in a PDF.
export async function drawioText(xml) {
  const { inflateRawSync } = await import('node:zlib');
  const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#xa;|&#10;/gi, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  const parts = [String(xml)];
  for (const [, body] of String(xml).matchAll(/<diagram\b[^>]*>([^<]+)<\/diagram>/g)) {
    try { parts.push(decodeURIComponent(inflateRawSync(Buffer.from(body.trim(), 'base64')).toString('utf8'))); } catch { /* not compressed */ }
  }
  const out = [];
  for (const part of parts)
    for (const [, attr] of part.matchAll(/\b(?:value|label|tooltip)="([^"]*)"/g)) {
      const text = decode(decode(attr)).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim();
      if (text) out.push(text);
    }
  return out.join('\n');
}

// The text of a diagram receipt (JSON): every string value that is not a path, a hash, a URL or a date.
export function receiptText(json) {
  const out = [];
  const walk = (v, key = '') => {
    if (typeof v === 'string') {
      if (!/(path|file|hash|sha|url|href|src|at|date)$/i.test(key) && !/^[\w./-]+\.(drawio|png|svg|json|md|pdf)$/i.test(v) && !/^[0-9a-f]{12,}$/i.test(v)) out.push(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(typeof json === 'string' ? JSON.parse(json) : json);
  return out.join('\n');
}
