// Turns design elements (text, motifs, frames) into stitch bitmaps:
// a w×h grid where 1 = one cross stitch.
import { MOTIFS } from './motifs.js';

// `scale` evens out how big each font looks at the same "size", so size ≈ letter height in stitches × 2.
export const FONTS = [
  { id: 'vibes', name: 'Elegant', family: '"Great Vibes"', weight: 400, style: 'normal', lh: 0.95, scale: 1.3 },
  { id: 'dancing', name: 'Casual', family: '"Dancing Script"', weight: 700, style: 'normal', lh: 1.0, scale: 1.0 },
  { id: 'pacifico', name: 'Bubbly', family: '"Pacifico"', weight: 400, style: 'normal', lh: 1.15, scale: 0.82 },
  { id: 'yellowtail', name: 'Retro', family: '"Yellowtail"', weight: 400, style: 'normal', lh: 1.0, scale: 1.08 },
  { id: 'playfair', name: 'Serif italic', family: '"Playfair Display"', weight: 700, style: 'italic', lh: 1.05, scale: 0.92 },
];

// 0 = thinned to a single-stitch line (the classic stitched-on-paper look).
export const WEIGHTS = [
  { id: 0, name: 'Single line' },
  { id: 1, name: 'Fine' },
  { id: 2, name: 'Regular' },
  { id: 3, name: 'Bold' },
];

export const fontById = (id) => FONTS.find((f) => f.id === id) || FONTS[0];
export const fontCss = (f, px) => `${f.style} ${f.weight} ${px}px ${f.family}, cursive`;

// Canvas px per stitch when rasterizing text: fewer for big letters so typing stays fast.
const sampleFor = (size) => Math.max(3, Math.min(8, Math.round(112 / size)));
const STROKE = [0.15, 0, 0.4, 0.85]; // extra outline (in stitches) per weight
const cache = new Map();
let fontEpoch = 0;

export function fontsChanged() {
  fontEpoch++;
  cache.clear();
}

function keyFor(el) {
  switch (el.type) {
    case 'text': return `t|${el.text}|${el.font}|${el.size}|${el.weight}|${el.align}|${fontEpoch}`;
    case 'motif': return `m|${el.motif}|${el.scale}|${el.rot}|${el.flip}`;
    case 'frame': return `f|${el.style}|${el.cols}|${el.rows}`;
    default: return null;
  }
}

export function bitmapFor(el) {
  const key = keyFor(el);
  let bm = cache.get(key);
  if (!bm) {
    bm = el.type === 'text' ? textBitmap(el) : el.type === 'motif' ? motifBitmap(el) : frameBitmap(el);
    bm.key = key;
    cache.set(key, bm);
    if (cache.size > 400) cache.delete(cache.keys().next().value);
  }
  return bm;
}

function makeBitmap(w, h) {
  return { w, h, data: new Uint8Array(w * h), count: 0 };
}

function finalize(bm) {
  let n = 0;
  for (let i = 0; i < bm.data.length; i++) n += bm.data[i];
  bm.count = n;
  return bm;
}

function trim(bm) {
  let x0 = bm.w, y0 = bm.h, x1 = -1, y1 = -1;
  for (let y = 0; y < bm.h; y++) {
    for (let x = 0; x < bm.w; x++) {
      if (bm.data[y * bm.w + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return finalize(makeBitmap(4, 2));
  const out = makeBitmap(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) out.data[(y - y0) * out.w + (x - x0)] = bm.data[y * bm.w + x];
  }
  return finalize(out);
}

let rasterCanvas = null;

function textBitmap(el) {
  const f = fontById(el.font);
  const S = sampleFor(el.size);
  const px = Math.max(4, el.size) * S * (f.scale || 1);
  const lines = String(el.text || '').split('\n');
  if (!rasterCanvas) rasterCanvas = document.createElement('canvas');
  const c = rasterCanvas;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.font = fontCss(f, px);
  const widths = lines.map((l) => ctx.measureText(l).width);
  const maxW = Math.max(1, ...widths);
  const pad = Math.ceil(px * 0.6);
  const lh = px * f.lh;
  c.width = Math.ceil((maxW + pad * 2) / S) * S;
  c.height = Math.ceil((lh * lines.length + pad * 2) / S) * S;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.font = fontCss(f, px);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.lineJoin = 'round';
  ctx.lineWidth = STROKE[el.weight ?? 0] * S;
  lines.forEach((line, i) => {
    let x = pad;
    if (el.align === 'center') x = pad + (maxW - widths[i]) / 2;
    else if (el.align === 'right') x = pad + maxW - widths[i];
    const y = pad + i * lh + px * 0.8;
    ctx.fillText(line, x, y);
    if (ctx.lineWidth > 0) ctx.strokeText(line, x, y);
  });

  const cols = c.width / S, rows = c.height / S;
  const img = ctx.getImageData(0, 0, c.width, c.height).data;
  const ink = { w: c.width, h: c.height, data: new Uint8Array(c.width * c.height) };
  for (let i = 0; i < ink.data.length; i++) ink.data[i] = img[i * 4 + 3] > 127 ? 1 : 0;
  const single = (el.weight ?? 0) === 0;
  // Single line: find each stroke's centerline at full resolution, then stitch the squares it runs through.
  if (single) thin(ink);
  const bm = makeBitmap(cols, rows);
  const need = single ? (S >= 6 ? 2 : 1) : S * S * 0.4;
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      let on = 0;
      for (let y = cy * S; y < cy * S + S; y++) {
        let i = y * c.width + cx * S;
        for (let x = 0; x < S; x++, i++) on += ink.data[i];
      }
      if (on >= need) bm.data[cy * cols + cx] = 1;
    }
  }
  if (single) thin(bm);
  return trim(bm);
}

/** Zhang–Suen thinning on the stitch grid: strokes become one stitch wide. */
function thin(bm) {
  const { w, h, data: d } = bm;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  let changed = true;
  const kill = [];
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      kill.length = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (!d[y * w + x]) continue;
          const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y), p5 = at(x + 1, y + 1);
          const p6 = at(x, y + 1), p7 = at(x - 1, y + 1), p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
          const n = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (n < 2 || n > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let a = 0;
          for (let i = 0; i < 8; i++) if (!seq[i] && seq[i + 1]) a++;
          if (a !== 1) continue;
          if (pass === 0 ? (p2 * p4 * p6 || p4 * p6 * p8) : (p2 * p4 * p8 || p2 * p6 * p8)) continue;
          kill.push(y * w + x);
        }
      }
      for (const i of kill) d[i] = 0;
      if (kill.length) changed = true;
    }
  }
}

function motifBitmap(el) {
  const m = MOTIFS.find((x) => x.id === el.motif) || MOTIFS[0];
  const h0 = m.rows.length;
  const w0 = Math.max(...m.rows.map((r) => r.length));
  let bm = makeBitmap(w0, h0);
  m.rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] !== '.' && r[x] !== ' ') bm.data[y * w0 + x] = 1;
  });
  if (el.flip) {
    const out = makeBitmap(bm.w, bm.h);
    for (let y = 0; y < bm.h; y++) for (let x = 0; x < bm.w; x++) out.data[y * bm.w + (bm.w - 1 - x)] = bm.data[y * bm.w + x];
    bm = out;
  }
  for (let k = 0; k < ((el.rot || 0) % 4 + 4) % 4; k++) {
    const out = makeBitmap(bm.h, bm.w); // rotate 90° clockwise
    for (let y = 0; y < bm.h; y++) for (let x = 0; x < bm.w; x++) out.data[x * out.w + (bm.h - 1 - y)] = bm.data[y * bm.w + x];
    bm = out;
  }
  const s = Math.max(1, el.scale || 1);
  if (s > 1) {
    const out = makeBitmap(bm.w * s, bm.h * s);
    for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.data[y * out.w + x] = bm.data[Math.floor(y / s) * bm.w + Math.floor(x / s)];
    bm = out;
  }
  return finalize(bm);
}

function frameBitmap(el) {
  const w = Math.max(3, el.cols | 0), h = Math.max(3, el.rows | 0);
  const bm = makeBitmap(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dTop = y, dBottom = h - 1 - y, dLeft = x, dRight = w - 1 - x;
      const dV = Math.min(dTop, dBottom), dH = Math.min(dLeft, dRight);
      const d = Math.min(dV, dH);
      // Position along the edge we are closest to.
      const t = dV <= dH ? x : y;
      let on = false;
      switch (el.style) {
        case 'double': on = d === 0 || d === 2; break;
        case 'dotted': on = d === 0 && (x + y) % 2 === 0; break;
        case 'folk': {
          if (d > 2) break;
          const corner = dV <= 2 && dH <= 2;
          if (corner) { on = (dV === 1 && dH === 1) || (dV + dH === 1); break; }
          const phase = (t - 1) % 4;
          on = d === 1 ? phase !== 3 : phase === 1;
          break;
        }
        default: on = d === 0;
      }
      if (on) bm.data[y * w + x] = 1;
    }
  }
  return finalize(bm);
}

export function motifPreviewBitmap(id) {
  return bitmapFor({ type: 'motif', motif: id, scale: 1, rot: 0, flip: false });
}

export function framePreviewBitmap(style) {
  return bitmapFor({ type: 'frame', style, cols: 15, rows: 11 });
}
