// Draws a design onto any 2D canvas context. Used by the editor, image export and print.
import { bitmapFor } from './stitch.js';
import { applyFilter } from './filters.js';

export const isStitch = (el) => el.type === 'text' || el.type === 'motif' || el.type === 'frame';

// ---------- grid geometry (inches) ----------

export function gridOf(doc) {
  const p = doc.pitch;
  const cols = Math.max(1, Math.floor(doc.w / p + 1e-6));
  const rows = Math.max(1, Math.floor(doc.h / p + 1e-6));
  return { p, cols, rows, gx: (doc.w - cols * p) / 2, gy: (doc.h - rows * p) / 2 };
}

export function cellPos(doc, el) {
  const g = gridOf(doc);
  return { col: Math.round((el.x - g.gx) / g.p), row: Math.round((el.y - g.gy) / g.p) };
}

export function snapStitch(doc, el) {
  const g = gridOf(doc);
  const { col, row } = cellPos(doc, el);
  el.x = g.gx + col * g.p;
  el.y = g.gy + row * g.p;
}

export function boundsOf(doc, el) {
  if (el.type === 'photo') return { x: el.x, y: el.y, w: el.w, h: el.h };
  const g = gridOf(doc);
  const bm = bitmapFor(el);
  const { col, row } = cellPos(doc, el);
  return { x: g.gx + col * g.p, y: g.gy + row * g.p, w: bm.w * g.p, h: bm.h * g.p };
}

// ---------- photos ----------

export const EDGES = [
  { id: 'none', name: 'No border' },
  { id: 'thin', name: 'Thin white' },
  { id: 'thick', name: 'Thick white' },
  { id: 'polaroid', name: 'Instant' },
];

function edgeInsets(el) {
  const m = Math.min(el.w, el.h);
  switch (el.edge) {
    case 'thin': { const t = m * 0.03; return [t, t, t, t]; }
    case 'thick': { const t = m * 0.075; return [t, t, t, t]; }
    case 'polaroid': { const t = el.w * 0.055; return [t, t, el.w * 0.2, t]; }
    default: return [0, 0, 0, 0];
  }
}

/** Where the picture sits inside a photo element, all in inches. */
export function photoGeometry(el, image) {
  const [t, r, b, l] = edgeInsets(el);
  const inner = { x: el.x + l, y: el.y + t, w: Math.max(0.05, el.w - l - r), h: Math.max(0.05, el.h - t - b) };
  if (!image) return { inner, draw: null, ovX: 0, ovY: 0 };
  const base = Math.max(inner.w / image.w, inner.h / image.h);
  const s = base * (el.zoom || 1);
  const dw = image.w * s, dh = image.h * s;
  const ovX = dw - inner.w, ovY = dh - inner.h;
  const draw = {
    x: inner.x - (ovX / 2) * (1 - (el.panX || 0)),
    y: inner.y - (ovY / 2) * (1 - (el.panY || 0)),
    w: dw, h: dh,
  };
  return { inner, draw, ovX, ovY };
}

const filterCache = new Map();
export function filteredImage(el, image) {
  const key = `${el.imgId}|${el.filter}|${el.brightness || 0}|${el.contrast || 0}`;
  let c = filterCache.get(key);
  if (!c) {
    c = applyFilter(image.img, image.w, image.h, el.filter || 'original', el.brightness || 0, el.contrast || 0);
    filterCache.set(key, c);
    if (filterCache.size > 24) filterCache.delete(filterCache.keys().next().value);
  }
  return c;
}

// ---------- color helpers ----------

export function hexToRgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
  const n = m ? parseInt(m[1], 16) : 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(h, target, amt) {
  const c = hexToRgb(h);
  return `rgb(${c.map((v, i) => Math.round(v + (target[i] - v) * amt)).join(',')})`;
}
export const luminance = (h) => {
  const [r, g, b] = hexToRgb(h);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

// ---------- stitches ----------

function eachCell(bm, fn) {
  for (let y = 0; y < bm.h; y++) for (let x = 0; x < bm.w; x++) if (bm.data[y * bm.w + x]) fn(x, y);
}

export function paintStitches(ctx, bm, x0, y0, s, color, mode) {
  if (mode === 'none') return;
  if (mode === 'light') {
    ctx.beginPath();
    const m = s * 0.18;
    eachCell(bm, (x, y) => {
      const X = x0 + x * s, Y = y0 + y * s;
      ctx.moveTo(X + m, Y + m); ctx.lineTo(X + s - m, Y + s - m);
      ctx.moveTo(X + m, Y + s - m); ctx.lineTo(X + s - m, Y + m);
    });
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.6, s * 0.07);
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (s < 3.5) {
    ctx.fillStyle = color;
    eachCell(bm, (x, y) => ctx.fillRect(x0 + x * s, y0 + y * s, s, s));
    return;
  }
  const m = s * 0.13;
  const lw = s * 0.32;
  const back = new Path2D(), front = new Path2D();
  eachCell(bm, (x, y) => {
    const X = x0 + x * s, Y = y0 + y * s;
    back.moveTo(X + m, Y + m); back.lineTo(X + s - m, Y + s - m);
    front.moveTo(X + m, Y + s - m); front.lineTo(X + s - m, Y + m);
  });
  ctx.save();
  ctx.lineCap = 'round';
  // soft shadow on the paper
  ctx.save();
  ctx.translate(s * 0.05, s * 0.08);
  ctx.strokeStyle = 'rgba(30,15,10,0.22)';
  ctx.lineWidth = lw * 1.05;
  ctx.stroke(back);
  ctx.stroke(front);
  ctx.restore();
  // under thread, slightly darker
  ctx.strokeStyle = mix(color, [0, 0, 0], 0.3);
  ctx.lineWidth = lw;
  ctx.stroke(back);
  // top thread
  ctx.strokeStyle = color;
  ctx.stroke(front);
  // sheen
  ctx.translate(-lw * 0.16, -lw * 0.16);
  ctx.strokeStyle = mix(color, [255, 255, 255], 0.35);
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = lw * 0.25;
  ctx.stroke(front);
  ctx.restore();
}

/** All stitched cells clipped to the paper: Map(cellIndex -> color), later elements win. */
export function cellMap(doc) {
  const g = gridOf(doc);
  const map = new Map();
  for (const el of doc.elements) {
    if (!isStitch(el)) continue;
    const bm = bitmapFor(el);
    const { col, row } = cellPos(doc, el);
    eachCell(bm, (x, y) => {
      const c = col + x, r = row + y;
      if (c >= 0 && r >= 0 && c < g.cols && r < g.rows) map.set(r * g.cols + c, el.color);
    });
  }
  return { map, g };
}

/** Hole positions (grid vertices) that need punching. */
export function holeList(doc) {
  const { map, g } = cellMap(doc);
  const set = new Set();
  const W = g.cols + 1;
  for (const k of map.keys()) {
    const c = k % g.cols, r = (k - c) / g.cols;
    set.add(r * W + c); set.add(r * W + c + 1); set.add((r + 1) * W + c); set.add((r + 1) * W + c + 1);
  }
  return { holes: [...set].map((k) => [k % W, Math.floor(k / W)]), g, cells: map };
}

export function stats(doc) {
  const { holes, cells, g } = holeList(doc);
  const byColor = new Map();
  for (const c of cells.values()) byColor.set(c, (byColor.get(c) || 0) + 1);
  // Front: two diagonals; back: roughly two cell sides; plus 15% for tails.
  const perStitch = (2 * Math.SQRT2 + 2) * g.p * 1.15;
  return {
    stitches: cells.size,
    holes: holes.length,
    threadIn: cells.size * perStitch,
    byColor: [...byColor.entries()].map(([color, n]) => ({ color, n, threadIn: n * perStitch })),
  };
}

// ---------- paper ----------

let grainPattern = null, grainCanvas = null;
function grain(ctx) {
  if (!grainCanvas) {
    grainCanvas = document.createElement('canvas');
    grainCanvas.width = grainCanvas.height = 180;
    const g = grainCanvas.getContext('2d');
    const img = g.createImageData(180, 180);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 255 - Math.random() * Math.random() * 60;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  if (!grainPattern || grainPattern.ctx !== ctx) {
    grainPattern = { ctx, pat: ctx.createPattern(grainCanvas, 'repeat') };
  }
  return grainPattern.pat;
}

// ---------- scene ----------

/**
 * o: { ppi, ox, oy, stitches: 'real'|'light'|'none', holes, grid, photos, paperFill, grain,
 *      placeholders: 'editor'|'print'|'none', shadows, ghostOutside, hiddenId, holeColor }
 */
export function drawScene(ctx, doc, images, o) {
  const { ppi, ox, oy } = o;
  const W = doc.w * ppi, H = doc.h * ppi;
  const toX = (inch) => ox + inch * ppi;
  const toY = (inch) => oy + inch * ppi;

  if (o.paperFill) {
    ctx.fillStyle = doc.paper;
    ctx.fillRect(ox, oy, W, H);
    if (o.grain && doc.grain) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = luminance(doc.paper) > 0.35 ? 0.35 : 0.6;
      ctx.translate(ox, oy);
      ctx.fillStyle = grain(ctx);
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  const g = gridOf(doc);
  const s = g.p * ppi;
  const dark = luminance(o.paperFill ? doc.paper : '#ffffff') < 0.45;

  if (o.grid && s >= 5) {
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.28)' : 'rgba(60,40,30,0.22)';
    const r = Math.max(0.6, s * 0.06);
    for (let y = 0; y <= g.rows; y++) {
      for (let x = 0; x <= g.cols; x++) {
        ctx.fillRect(toX(g.gx) + x * s - r, toY(g.gy) + y * s - r, r * 2, r * 2);
      }
    }
  }

  const drawElements = (shadows) => {
    for (const el of doc.elements) {
      if (el.id === o.hiddenId) continue;
      if (el.type === 'photo') {
        const image = images.get(el.imgId);
        if (o.photos === false || !image) {
          if (o.placeholders === 'print') drawPhotoOutline(ctx, el, toX, toY, ppi);
          else if (!image && o.placeholders === 'editor') drawPhoto(ctx, el, null, toX, toY, ppi, false, 'editor');
          continue;
        }
        drawPhoto(ctx, el, image, toX, toY, ppi, shadows, o.placeholders);
      } else {
        const bm = bitmapFor(el);
        const { col, row } = cellPos(doc, el);
        paintStitches(ctx, bm, toX(g.gx) + col * s, toY(g.gy) + row * s, s, el.color, o.stitches);
      }
    }
  };

  if (o.ghostOutside) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    drawElements(false);
    ctx.restore();
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, W, H);
  ctx.clip();
  drawElements(o.shadows);
  if (o.holes) {
    const { holes } = holeList(doc);
    ctx.fillStyle = o.holeColor || (dark ? 'rgba(255,255,255,0.9)' : 'rgba(35,25,22,0.9)');
    const r = Math.max(0.8, Math.min(s * 0.13, ppi * 0.022));
    ctx.beginPath();
    for (const [x, y] of holes) {
      const cx = toX(g.gx) + x * s, cy = toY(g.gy) + y * s;
      ctx.moveTo(cx + r, cy);
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.restore();
}

function drawPhotoOutline(ctx, el, toX, toY, ppi) {
  ctx.save();
  ctx.strokeStyle = 'rgba(40,30,25,0.55)';
  ctx.lineWidth = Math.max(1, ppi * 0.008);
  ctx.setLineDash([ppi * 0.06, ppi * 0.05]);
  ctx.strokeRect(toX(el.x), toY(el.y), el.w * ppi, el.h * ppi);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(40,30,25,0.55)';
  ctx.font = `${Math.max(9, ppi * 0.1)}px "DM Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('photo goes here', toX(el.x + el.w / 2), toY(el.y + el.h / 2));
  ctx.restore();
}

function drawPhoto(ctx, el, image, toX, toY, ppi, shadows, placeholders) {
  const X = toX(el.x), Y = toY(el.y), Wd = el.w * ppi, Ht = el.h * ppi;
  const geo = photoGeometry(el, image);
  ctx.save();
  if (shadows) {
    ctx.shadowColor = 'rgba(30,20,15,0.22)';
    ctx.shadowBlur = Math.max(2, ppi * 0.05);
    ctx.shadowOffsetY = Math.max(1, ppi * 0.015);
  }
  if (!image) {
    if (placeholders === 'none') { ctx.restore(); return; }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(X, Y, Wd, Ht);
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(60,40,30,0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.strokeRect(X + 0.75, Y + 0.75, Wd - 1.5, Ht - 1.5);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(60,40,30,0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fs = Math.max(10, Math.min(Wd, Ht) * 0.075);
    ctx.font = `500 ${fs}px "Archivo Narrow", sans-serif`;
    ctx.fillText('drop a photo here', X + Wd / 2, Y + Ht / 2 - fs * 0.6);
    ctx.font = `${fs * 0.75}px "DM Mono", monospace`;
    ctx.fillText('or double-click / tap twice', X + Wd / 2, Y + Ht / 2 + fs * 0.7);
    ctx.restore();
    return;
  }
  if (el.edge && el.edge !== 'none') {
    ctx.fillStyle = '#fbf9f4';
    ctx.fillRect(X, Y, Wd, Ht);
    ctx.shadowColor = 'transparent';
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(toX(geo.inner.x), toY(geo.inner.y), geo.inner.w * ppi, geo.inner.h * ppi);
    ctx.shadowColor = 'transparent';
  }
  ctx.beginPath();
  ctx.rect(toX(geo.inner.x), toY(geo.inner.y), geo.inner.w * ppi, geo.inner.h * ppi);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(filteredImage(el, image), toX(geo.draw.x), toY(geo.draw.y), geo.draw.w * ppi, geo.draw.h * ppi);
  ctx.restore();
}
