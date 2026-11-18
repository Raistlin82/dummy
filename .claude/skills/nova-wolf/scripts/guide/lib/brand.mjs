// The brand of the documents (profile characteristic BRAND): docs/brand/brand.json of the development repository, with
// its logos; without the folder, a neutral brand. Colors are hex without #, as Word and PowerPoint take them.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require_zlib = () => createRequire(import.meta.url)('node:zlib');
import path from 'node:path';

export const NEUTRAL = {
  company: '', legal: '',
  font: 'Arial', mono: 'Consolas',
  colors: {
    accent: '0A6ED1', // fills, lines and text on dark backgrounds
    accentText: '0A5BAA', // accent text on white paper
    tint: 'EAF3FC', // background of a placeholder frame
    ink: '1D2D3E', // headings, header row of a table
    text: '1D2D3E', muted: '556B82', rule: 'D5DADD', labelFill: 'F5F6F7', codeFill: 'F1F2F3', note: 'EEF4FB',
    dark: '1D2D3E', darkCard: '2A3B4F', darkBorder: '3D5066', darkHeading: 'FFFFFF', darkText: 'D9E1E8', darkMuted: 'A9B4BE',
  },
  logo: null, // for white paper
  logoOnDark: null, // for the cover and the slides
  mark: null, // small square mark for the header and the slides
  pattern: null, // a light pattern (PNG with transparency) for the dark covers
  markers: [], // extra development markers the check refuses (regular expressions)
};

const HEX = /^[0-9A-F]{6}$/i;

export function loadBrand(dir) {
  const file = dir ? path.join(dir, 'brand.json') : null;
  if (!file || !existsSync(file)) return { ...NEUTRAL, colors: { ...NEUTRAL.colors }, neutral: true, dir: null };
  const b = JSON.parse(readFileSync(file, 'utf8'));
  const problems = [];
  const colors = { ...NEUTRAL.colors };
  for (const [k, v] of Object.entries(b.colors ?? {})) {
    const hex = String(v).replace(/^#/, '');
    if (!(k in NEUTRAL.colors)) problems.push(`colors.${k}: unknown (${Object.keys(NEUTRAL.colors).join(', ')})`);
    else if (!HEX.test(hex)) problems.push(`colors.${k}: ${v} is not a hex color`);
    else colors[k] = hex.toUpperCase();
  }
  const asset = (k) => {
    if (!b[k]) return null;
    const p = path.resolve(dir, b[k]);
    if (!existsSync(p)) problems.push(`${k}: ${b[k]} not found in ${dir}`);
    else if (!/\.png$/i.test(p)) problems.push(`${k}: ${b[k]} must be a PNG`);
    return p;
  };
  const brand = {
    company: b.company ?? '', legal: b.legal ?? b.company ?? '', font: b.font ?? NEUTRAL.font, mono: b.mono ?? NEUTRAL.mono,
    colors, logo: asset('logo'), logoOnDark: asset('logoOnDark'), mark: asset('mark'), pattern: asset('pattern'),
    markers: Array.isArray(b.markers) ? b.markers : [], neutral: false, dir,
  };
  for (const m of brand.markers) try { new RegExp(m, 'i'); } catch { problems.push(`markers: ${m} is not a regular expression`); }
  if (problems.length) throw new Error(`${file}:\n  ${problems.join('\n  ')}`);
  return brand;
}

// PNG size without a dependency (IHDR chunk).
export function pngSize(file) {
  const b = readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file} is not a PNG`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

// A PNG of one color, for the dark cover of the Word edition (docx has no page shapes): no dependency.
export function solidPng(hex, width = 794, height = 1123) {
  const { deflateSync } = require_zlib();
  const crc = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const row = Buffer.alloc(width * 3 + 1);
  for (let x = 0; x < width; x++) { row[1 + 3 * x] = r; row[2 + 3 * x] = g; row[3 + 3 * x] = b; }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// The same PNG with its alpha scaled (an RGBA, 8 bit, not interlaced PNG; null for any other kind): Word applies no
// transparency to an image, so the pattern of the cover is made faint here, as the slides do with their transparency.
export function fadePng(buf, factor) {
  const { inflateSync, deflateSync } = require_zlib();
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  let off = 8; let w = 0; let h = 0; const idat = []; let ok = false;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off); const type = buf.toString('ascii', off + 4, off + 8); const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ok = data[8] === 8 && data[9] === 6 && data[12] === 0; }
    if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  if (!ok) return null;
  const raw = inflateSync(Buffer.concat(idat)); const bpp = 4; const stride = w * bpp;
  const out = Buffer.alloc(h * (stride + 1)); let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0; const b = prev[x]; const c = x >= bpp ? prev[x - bpp] : 0;
      const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
      line[x] = (line[x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 0xff;
    }
    prev = line;
    const faded = Buffer.from(line); for (let x = 3; x < stride; x += 4) faded[x] = Math.round(faded[x] * factor);
    out[y * (stride + 1)] = 0; faded.copy(out, y * (stride + 1) + 1);
  }
  const crc = (b) => { let c = ~0; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([buf.subarray(0, 8), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(out)), chunk('IEND', Buffer.alloc(0))]);
}
