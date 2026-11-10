// Turns design elements (text, motifs, frames) into stitch bitmaps:
// a w×h grid where 1 = one cross stitch.
import { MOTIFS } from './motifs.js';
import { CHART_FONTS } from './chartfonts.js';

// Lettering styles. "chart" fonts are hand-charted cross-stitch alphabets (see chartfonts.js);
// "type" fonts are web fonts turned into stitches. Charted letters are stitched exactly as charted
// at their native size (or a whole multiple of it) and resampled only when they must shrink or grow.
export const FONTS = [
  { id: 'viceroy', name: 'Viceroy', kind: 'chart' },
  { id: 'antique', name: 'Antique', kind: 'chart' },
  { id: 'simple', name: 'Simple', kind: 'chart' },
];
// Designs saved with earlier styles map onto the closest current one.
const ALIASES = { hand: 'simple', dancing: 'simple', pacifico: 'simple', yellowtail: 'simple', playfair: 'simple', vibes: 'viceroy' };

// 0 = thinned to a single-stitch line (the classic stitched-on-paper look).
export const WEIGHTS = [
  { id: 0, name: 'Single line' },
  { id: 1, name: 'Fine' },
  { id: 2, name: 'Regular' },
  { id: 3, name: 'Bold' },
];

export const fontById = (id) => FONTS.find((f) => f.id === (ALIASES[id] || id)) || FONTS[0];
export const fontCss = (f, px) => (f.kind === 'chart' ? `${px}px serif` : `${f.style} ${f.weight} ${px}px ${f.family}, cursive`);

// For charted fonts, "size" relates to capital height the same way it does for type fonts.
const CAP_RATIO = 0.72;
/** The size at which a charted font is stitched exactly as charted. */
export const nativeSize = (f) => (f.kind === 'chart' ? Math.round(CHART_FONTS[f.id].capHeight / CAP_RATIO) : 18);

/*
 * Charted lettering is always stitched exactly as charted; only the stitch size changes.
 * `size` sets the capital height (size × card spacing × CAP_RATIO). The stitch size follows it, up to
 * MAX_STITCH; past that, every charted stitch becomes n×n smaller stitches (2×2, 3×3…), so a big letter
 * is the same picture stitched finer. Small text gets smaller stitches, down to MIN_STITCH.
 */
export const CARD_PITCH = 1 / 14;
export const MAX_STITCH = 0.11; // inches between holes (2.8 mm)
export const MIN_STITCH = 0.04; // (1 mm)
export function textStitch(el) {
  const f = fontById(el.font);
  const c = f.kind === 'chart' ? CHART_FONTS[f.id].capHeight : 1;
  const capH = Math.max(1, el.size) * CARD_PITCH * CAP_RATIO;
  const n = Math.max(1, Math.ceil(capH / (c * MAX_STITCH) - 1e-9));
  return { n, s: Math.max(MIN_STITCH, capH / (c * n)) };
}

// Canvas px per stitch when rasterizing text: fewer for big letters so typing stays fast.
const sampleFor = (size) => Math.max(3, Math.min(8, Math.round(112 / size)));
const STROKE = [0.15, 0, 0.4, 0.85]; // extra outline (in stitches) per weight
const cache = new Map();
let fontEpoch = 0;

export function fontsChanged() {
  fontEpoch++;
  cache.clear();
  fallbackCache.clear();
}

function keyFor(el) {
  switch (el.type) {
    case 'text': return `t|${el.text}|${el.font}|${textStitch(el).n}|${el.align}|${fontEpoch}`;
    case 'motif': return `m|${el.motif}|${el.scale}|${el.rot}|${el.flip}`;
    case 'frame': return `f|${el.style}|${el.cols}|${el.rows}`;
    default: return null;
  }
}

export function bitmapFor(el) {
  const angle = el.type === 'frame' ? 0 : Math.round((el.angle || 0) * 10) / 10;
  const key = `${keyFor(el)}|a${angle}`;
  let bm = cache.get(key);
  if (!bm) {
    bm = el.type === 'text' ? textBitmap(el) : el.type === 'motif' ? motifBitmap(el) : frameBitmap(el);
    if (angle) bm = rotateBitmap(bm, angle);
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
  return trimAt(bm).bm;
}

function trimAt(bm) {
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
  if (x1 < 0) return { bm: finalize(makeBitmap(4, 2)), x0: 0, y0: 0 };
  const out = makeBitmap(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) out.data[(y - y0) * out.w + (x - x0)] = bm.data[y * bm.w + x];
  }
  return { bm: finalize(out), x0, y0 };
}

let rasterCanvas = null;

function textBitmap(el) {
  const f = fontById(el.font);
  if (f.kind === 'chart') return chartText(el, CHART_FONTS[f.id]);
  return typeRaster(f, String(el.text || '').split('\n'), el.size, el.weight ?? 0, el.align).bm;
}

/** Web font -> stitches. Returns the trimmed bitmap and the first line's baseline (rows from the top). */
function typeRaster(f, lines, size, weight, align) {
  const S = sampleFor(size);
  const px = Math.max(4, size) * S * (f.scale || 1);
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
  ctx.lineWidth = STROKE[weight] * S;
  lines.forEach((line, i) => {
    let x = pad;
    if (align === 'center') x = pad + (maxW - widths[i]) / 2;
    else if (align === 'right') x = pad + maxW - widths[i];
    const y = pad + i * lh + px * 0.8;
    ctx.fillText(line, x, y);
    if (ctx.lineWidth > 0) ctx.strokeText(line, x, y);
  });

  const cols = c.width / S, rows = c.height / S;
  const img = ctx.getImageData(0, 0, c.width, c.height).data;
  const ink = { w: c.width, h: c.height, data: new Uint8Array(c.width * c.height) };
  for (let i = 0; i < ink.data.length; i++) ink.data[i] = img[i * 4 + 3] > 127 ? 1 : 0;
  const single = weight === 0;
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
  const t = trimAt(bm);
  return { bm: t.bm, base: Math.ceil((pad + px * 0.8) / S) - t.y0 };
}

// ---------- charted alphabets ----------

/** Charted fonts snap to their native size (or a whole multiple) when close, so letters stay exactly as charted. */
export function chartScale(font, size) {
  let k = (size * CAP_RATIO) / font.capHeight;
  const r = Math.round(k);
  if (r >= 1 && Math.abs(k - r) <= 0.04 * r) k = r; // exact chart size when within 4%
  return k;
}

const fallbackCache = new Map();
/**
 * Characters a chart doesn't have (numbers, &, +, punctuation) come from the Simple chart,
 * enlarged to match the font's capital height.
 */
function fallbackGlyph(font, fontId, ch) {
  const key = `${fontId}|${ch}`;
  let g = fallbackCache.get(key);
  if (!g) {
    const simple = CHART_FONTS.simple;
    const src = simple.glyphs[ch];
    if (!src) {
      g = { w: 2, h: 1, base: 1, data: new Uint8Array(2) }; // unknown character: a small blank
    } else {
      // whole-stitch multiple of the Simple chart that best matches this font's capitals
      const k = Math.max(1, Math.round(font.capHeight / simple.capHeight));
      const bm = k === 1 ? src : scaleUp(src, k);
      g = { w: bm.w, h: bm.h, base: Math.max(1, Math.round(src.base * k)), data: bm.data };
    }
    fallbackCache.set(key, g);
  }
  return g;
}

function glyphFor(font, fontId, ch) {
  return font.glyphs[ch]
    || (font.capsOnly ? font.glyphs[ch.toUpperCase()] : font.glyphs[ch.toLowerCase()] || font.glyphs[ch.toUpperCase()])
    || fallbackGlyph(font, fontId, ch);
}

/**
 * Sets one line of charted letters. Letters are spaced by their actual shape (one clear stitch
 * between neighbours, including diagonally), so slanted strokes and swashes tuck in naturally.
 * Returns cells relative to the baseline row (y = 0 is the baseline row, negative is above).
 */
function setLine(font, fontId, text) {
  const right = new Map();
  const cells = [];
  let maxRight = -1, asc = 0, desc = 0, prevX = -Infinity, pendingSpace = false;
  const spaceW = Math.max(3, Math.round(font.capHeight * 0.45));
  for (const ch of text) {
    if (ch === ' ') { pendingSpace = true; continue; }
    const g = glyphFor(font, fontId, ch);
    const rowsL = [];
    for (let y = 0; y < g.h; y++) {
      let l = -1, r = -1;
      for (let x = 0; x < g.w; x++) if (g.data[y * g.w + x]) { if (l < 0) l = x; r = x; }
      rowsL.push([l, r]);
    }
    const leftMin = Math.min(...rowsL.filter(([l]) => l >= 0).map(([l]) => l));
    let x;
    if (maxRight < 0) x = -leftMin;
    else {
      x = -Infinity;
      rowsL.forEach(([l], y) => {
        if (l < 0) return;
        const rel = y - (g.base - 1);
        for (const d of [-1, 0, 1]) {
          const r = right.get(rel + d);
          if (r !== undefined) x = Math.max(x, r + 2 - l);
        }
      });
      if (x === -Infinity) x = maxRight + 2 - leftMin;
      if (pendingSpace) x = Math.max(x, maxRight + spaceW + 1 - leftMin);
      x = Math.max(x, prevX + 1);
    }
    pendingSpace = false;
    prevX = x;
    rowsL.forEach(([l, r], y) => {
      if (l < 0) return;
      const rel = y - (g.base - 1);
      right.set(rel, Math.max(right.get(rel) ?? -Infinity, x + r));
      maxRight = Math.max(maxRight, x + r);
      for (let xx = l; xx <= r; xx++) if (g.data[y * g.w + xx]) cells.push([x + xx, rel]);
    });
    asc = Math.max(asc, g.base);
    desc = Math.max(desc, g.h - g.base);
  }
  const minX = cells.length ? Math.min(...cells.map((c) => c[0])) : 0;
  for (const c of cells) c[0] -= minX;
  return { cells, w: Math.max(1, maxRight - minX + 1), asc, desc };
}

function chartText(el, font) {
  const lines = String(el.text || '').split('\n').map((t) => setLine(font, fontById(el.font).id, t));
  const capH = font.capHeight;
  const gap = Math.round(capH * 0.3);
  let y = 0;
  const placed = [];
  lines.forEach((L, i) => {
    if (i) y += gap;
    const baseRow = y + Math.max(L.asc, capH) - 1;
    placed.push({ L, baseRow });
    y = baseRow + 1 + Math.max(L.desc, Math.round(capH * 0.15));
  });
  const W = Math.max(1, ...lines.map((L) => L.w)), H = Math.max(1, y);
  const bm = makeBitmap(W, H);
  for (const { L, baseRow } of placed) {
    const ox = el.align === 'center' ? Math.floor((W - L.w) / 2) : el.align === 'right' ? W - L.w : 0;
    for (const [cx, cy] of L.cells) {
      const xx = cx + ox, yy = baseRow + cy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H) bm.data[yy * W + xx] = 1;
    }
  }
  const out = trim(bm);
  const { n } = textStitch(el);
  return n > 1 ? scaleUp(out, n) : out;
}

function scaleUp(bm, k) {
  const out = makeBitmap(bm.w * k, bm.h * k);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.data[y * out.w + x] = bm.data[Math.floor(y / k) * bm.w + Math.floor(x / k)];
  return finalize(out);
}

/** Area-weighted resample; a lower bar when shrinking keeps one-stitch hairlines from vanishing. */
function resample(bm, k) {
  const W = Math.max(1, Math.round(bm.w * k)), H = Math.max(1, Math.round(bm.h * k));
  const out = makeBitmap(W, H);
  const thr = k < 1 ? 0.28 : 0.5;
  for (let ty = 0; ty < H; ty++) {
    const y0 = ty / k, y1 = (ty + 1) / k;
    for (let tx = 0; tx < W; tx++) {
      const x0 = tx / k, x1 = (tx + 1) / k;
      let tot = 0;
      for (let sy = Math.floor(y0); sy < Math.min(bm.h, Math.ceil(y1)); sy++) {
        const oy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        for (let sx = Math.floor(x0); sx < Math.min(bm.w, Math.ceil(x1)); sx++) {
          if (bm.data[sy * bm.w + sx]) tot += (Math.min(x1, sx + 1) - Math.max(x0, sx)) * oy;
        }
      }
      if (tot * k * k >= thr) out.data[ty * W + tx] = 1;
    }
  }
  return trim(out);
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
  // Whole sizes stay exactly as drawn; in-between sizes (from resizing the card) are resampled.
  const k = el.scale || 1;
  const r = Math.round(k);
  if (r >= 1 && k >= r * 0.92 && k <= r * 1.2) return r > 1 ? scaleUp(finalize(bm), r) : finalize(bm);
  return resample(finalize(bm), k);
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

/**
 * Rotates a stitch bitmap by any angle. Each stitch's center is carried to its new spot and joined to
 * its stitched neighbours with a line (so thin strokes stay connected), and the target grid is also
 * sampled back into the source so solid areas stay solid.
 */
function rotateBitmap(bm, deg) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
  const W = Math.ceil(Math.abs(bm.w * c) + Math.abs(bm.h * sn)) + 2;
  const H = Math.ceil(Math.abs(bm.w * sn) + Math.abs(bm.h * c)) + 2;
  const out = makeBitmap(W, H);
  const scx = bm.w / 2, scy = bm.h / 2, tcx = W / 2, tcy = H / 2;
  const on = (x, y) => x >= 0 && y >= 0 && x < bm.w && y < bm.h && bm.data[y * bm.w + x] === 1;
  const fwd = (x, y) => {
    const dx = x + 0.5 - scx, dy = y + 0.5 - scy;
    return [Math.floor(dx * c - dy * sn + tcx), Math.floor(dx * sn + dy * c + tcy)];
  };
  const plot = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H) out.data[y * W + x] = 1; };
  const line = ([x0, y0], [x1, y1]) => {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      plot(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  for (let y = 0; y < bm.h; y++) {
    for (let x = 0; x < bm.w; x++) {
      if (!on(x, y)) continue;
      const p0 = fwd(x, y);
      plot(...p0);
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) if (on(x + dx, y + dy)) line(p0, fwd(x + dx, y + dy));
    }
  }
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const dx = tx + 0.5 - tcx, dy = ty + 0.5 - tcy;
      const sx = Math.floor(dx * c + dy * sn + scx), sy = Math.floor(-dx * sn + dy * c + scy);
      // only fill from solid areas, so one-stitch lines don't get doubled
      if (on(sx, sy) && ((on(sx - 1, sy) || on(sx + 1, sy)) && (on(sx, sy - 1) || on(sx, sy + 1)))) out.data[ty * W + tx] = 1;
    }
  }
  return trim(out);
}
