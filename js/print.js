// Print (punch template + stitch chart) and image export.
import { drawScene, stats, luminance, boundsOf, stitchList, gridOf } from './render.js';

export const PAPERS = {
  letter: { w: 8.5, h: 11, name: 'US Letter' },
  a4: { w: 8.27, h: 11.69, name: 'A4' },
};
const MARGIN = 0.2; // printable margin on every side, inches
const TRIM = 0.3; // room around the design for trim marks

export function formatLength(inches) {
  const m = inches * 0.0254;
  return m < 1 ? `${Math.round(m * 100)} cm` : `${m.toFixed(1)} m`;
}

export function inchLabel(v) {
  return `${+v.toFixed(2)}″`;
}

/** The design on its own canvas. Returns { canvas, wIn, hIn } including trim margin. */
export function renderDesign(doc, images, o, dpi) {
  const bleed = o.trim ? TRIM : 0;
  const wIn = doc.w + bleed * 2, hIn = doc.h + bleed * 2;
  const c = document.createElement('canvas');
  c.width = Math.round(wIn * dpi);
  c.height = Math.round(hIn * dpi);
  const ctx = c.getContext('2d');
  if (o.background !== 'transparent') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
  }
  const ox = bleed * dpi, oy = bleed * dpi;
  drawScene(ctx, doc, images, {
    ppi: dpi, ox, oy,
    stitches: o.stitches,
    holes: o.holes,
    photos: o.photos,
    paperFill: o.paperFill,
    grain: o.grain,
    placeholders: 'print',
    shadows: o.shadows,
  });
  const W = doc.w * dpi, H = doc.h * dpi;
  if (!o.paperFill) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = Math.max(1, dpi * 0.004);
    ctx.setLineDash([dpi * 0.03, dpi * 0.03]);
    ctx.strokeRect(ox, oy, W, H);
    ctx.restore();
  }
  if (o.trim) {
    ctx.save();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = Math.max(1, dpi * 0.005);
    const len = dpi * 0.22, gap = dpi * 0.05;
    const corners = [[ox, oy], [ox + W, oy], [ox, oy + H], [ox + W, oy + H]];
    ctx.beginPath();
    for (const [x, y] of corners) {
      const sx = x === ox ? -1 : 1, sy = y === oy ? -1 : 1;
      ctx.moveTo(x + sx * gap, y); ctx.lineTo(x + sx * (gap + len), y);
      ctx.moveTo(x, y + sy * gap); ctx.lineTo(x, y + sy * (gap + len));
    }
    ctx.stroke();
    ctx.restore();
  }
  return { canvas: c, wIn, hIn };
}

/** A stitch chart for page two: every hole and stitch, numbered every 10. */
export function renderChart(doc, page, dpi) {
  const availW = page.w - MARGIN * 2, availH = page.h - MARGIN * 2;
  const c = document.createElement('canvas');
  c.width = Math.round(availW * dpi);
  c.height = Math.round(availH * dpi);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  const g = gridOf(doc);
  const stitches = stitchList(doc);
  const st = stats(doc);

  const ink = '#2a201c';
  const pt = dpi / 72;
  ctx.fillStyle = ink;
  ctx.font = `600 ${16 * pt}px "Archivo Narrow", sans-serif`;
  ctx.fillText('Stitch chart', 0, 18 * pt);
  ctx.font = `${8.5 * pt}px "DM Mono", monospace`;
  ctx.fillStyle = '#6d625a';
  ctx.fillText(
    `${inchLabel(doc.w)} × ${inchLabel(doc.h)} card · ${st.stitches} stitches · ${st.holes} holes · gridlines ${(g.p * 25.4).toFixed(1)} mm apart`,
    0, 32 * pt,
  );

  const legendH = 30 * pt + Math.ceil(st.byColor.length / 3) * 16 * pt + 40 * pt;
  const top = 46 * pt, label = 16 * pt;
  const gridW = c.width - label * 2, gridH = c.height - top - legendH - label;
  const cs = Math.min(gridW / g.cols, gridH / g.rows);
  const gx = (c.width - cs * g.cols) / 2, gy = top + label;

  // photos as shaded areas
  for (const el of doc.elements) {
    if (el.type !== 'photo') continue;
    const b = boundsOf(doc, el);
    const x = gx + ((b.x - g.gx) / g.p) * cs, y = gy + ((b.y - g.gy) / g.p) * cs;
    ctx.fillStyle = '#ece7e1';
    ctx.fillRect(x, y, (b.w / g.p) * cs, (b.h / g.p) * cs);
    ctx.fillStyle = '#9b9089';
    ctx.font = `${8 * pt}px "DM Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('photo', x + (b.w / g.p) * cs / 2, y + (b.h / g.p) * cs / 2);
    ctx.textAlign = 'left';
  }

  // every stitch at its real position and size (lettering has its own stitch spacing)
  const k = cs / g.p; // chart px per inch
  for (const t of stitches) {
    const x = gx + (t.x - g.gx) * k, y = gy + (t.y - g.gy) * k, w = t.s * k;
    ctx.fillStyle = t.color;
    ctx.fillRect(x, y, w, w);
    ctx.strokeStyle = luminance(t.color) > 0.6 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(1, w * 0.08);
    const m = w * 0.22;
    ctx.beginPath();
    ctx.moveTo(x + m, y + m); ctx.lineTo(x + w - m, y + w - m);
    ctx.moveTo(x + m, y + w - m); ctx.lineTo(x + w - m, y + m);
    ctx.stroke();
  }

  ctx.lineWidth = Math.max(0.5, pt * 0.35);
  for (let i = 0; i <= g.cols; i++) {
    ctx.strokeStyle = i % 10 === 0 ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.14)';
    ctx.beginPath(); ctx.moveTo(gx + i * cs, gy); ctx.lineTo(gx + i * cs, gy + g.rows * cs); ctx.stroke();
  }
  for (let j = 0; j <= g.rows; j++) {
    ctx.strokeStyle = j % 10 === 0 ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.14)';
    ctx.beginPath(); ctx.moveTo(gx, gy + j * cs); ctx.lineTo(gx + g.cols * cs, gy + j * cs); ctx.stroke();
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = pt * 0.9;
  ctx.strokeRect(gx, gy, g.cols * cs, g.rows * cs);

  ctx.fillStyle = '#6d625a';
  ctx.font = `${7 * pt}px "DM Mono", monospace`;
  ctx.textAlign = 'center';
  for (let i = 10; i <= g.cols; i += 10) ctx.fillText(String(i), gx + i * cs, gy - 5 * pt);
  ctx.textAlign = 'right';
  for (let j = 10; j <= g.rows; j += 10) ctx.fillText(String(j), gx - 4 * pt, gy + j * cs + 3 * pt);
  ctx.textAlign = 'left';

  // legend
  let ly = gy + g.rows * cs + 26 * pt;
  ctx.fillStyle = ink;
  ctx.font = `600 ${10 * pt}px "Archivo Narrow", sans-serif`;
  ctx.fillText('Thread', 0, ly);
  ly += 14 * pt;
  ctx.font = `${8.5 * pt}px "DM Mono", monospace`;
  st.byColor.forEach((t, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = col * (c.width / 3), y = ly + row * 16 * pt;
    ctx.fillStyle = t.color;
    ctx.fillRect(x, y - 8 * pt, 10 * pt, 10 * pt);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = pt * 0.5;
    ctx.strokeRect(x, y - 8 * pt, 10 * pt, 10 * pt);
    ctx.fillStyle = ink;
    ctx.fillText(`${t.color.toUpperCase()}  ${t.n} stitches · ~${formatLength(t.threadIn)}`, x + 15 * pt, y);
  });
  ly += Math.ceil(st.byColor.length / 3) * 16 * pt + 10 * pt;
  ctx.fillStyle = '#6d625a';
  ctx.fillText('Each square is one cross stitch: needle up through one corner, down through the opposite corner, then cross back.', 0, ly);
  return c;
}

/** Picks page orientation, and drops trim marks if they're what keeps the design from printing at actual size. */
function pageFor(doc, o) {
  const base = PAPERS[o.paper] || PAPERS.letter;
  const fits = (w, h, pw, ph) => w <= pw - MARGIN * 2 + 1e-6 && h <= ph - MARGIN * 2 + 1e-6;
  const pick = (w, h) => {
    if (fits(w, h, base.w, base.h)) return { w: base.w, h: base.h };
    if (fits(w, h, base.h, base.w)) return { w: base.h, h: base.w };
    return null;
  };
  const extra = o.trim ? TRIM * 2 : 0;
  let page = pick(doc.w + extra, doc.h + extra);
  if (page) return { page, opts: o };
  page = pick(doc.w, doc.h);
  if (page) return { page, opts: { ...o, trim: false } };
  const landscape = doc.w > doc.h;
  return { page: landscape ? { w: base.h, h: base.w } : { w: base.w, h: base.h }, opts: o };
}

function canvasUrl(canvas, type = 'image/png', q) {
  return new Promise((res) => canvas.toBlob((b) => res(URL.createObjectURL(b)), type, q));
}

/** Lays out pages in #printRoot and opens the browser print dialog. */
export async function printDesign(doc, images, o) {
  const { page, opts } = pageFor(doc, o);
  const design = renderDesign(doc, images, { ...opts, stitches: o.guide ? 'light' : 'none', grain: false, shadows: false }, 300);
  const fit = Math.min(1, (page.w - MARGIN * 2) / design.wIn, (page.h - MARGIN * 2) / design.hIn);

  const root = document.getElementById('printRoot');
  root.innerHTML = '';
  let style = document.getElementById('pageStyle');
  if (!style) {
    style = document.createElement('style');
    style.id = 'pageStyle';
    document.head.appendChild(style);
  }
  style.textContent = `@page { size: ${page.w}in ${page.h}in; margin: 0; }`;

  const sheet = (inner) => {
    const s = document.createElement('div');
    s.className = 'sheet';
    s.style.width = `${page.w}in`;
    s.style.height = `${page.h}in`;
    s.appendChild(inner);
    root.appendChild(s);
    return s;
  };

  const img = new Image();
  img.src = await canvasUrl(design.canvas);
  img.style.width = `${design.wIn * fit}in`;
  img.style.height = `${design.hIn * fit}in`;
  const s1 = sheet(img);
  const note = document.createElement('p');
  note.className = 'sheet-note';
  note.textContent = fit < 1
    ? `Scaled to ${Math.round(fit * 100)}% to fit the page, so it is not actual size.`
    : `Actual size · ${inchLabel(doc.w)} × ${inchLabel(doc.h)} · print at 100% (“Actual size”) · pierce every dot`;
  s1.appendChild(note);

  if (o.chart) {
    const chart = renderChart(doc, page, 200);
    const cimg = new Image();
    cimg.src = await canvasUrl(chart);
    cimg.style.width = `${page.w - MARGIN * 2}in`;
    cimg.style.height = `${page.h - MARGIN * 2}in`;
    sheet(cimg);
  }

  await Promise.all([...root.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
  const cleanup = () => {
    root.querySelectorAll('img').forEach((i) => URL.revokeObjectURL(i.src));
    root.innerHTML = '';
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  return { fit };
}

/** A small preview of the first printed page. */
export function printPreview(doc, images, o, target) {
  const { page, opts } = pageFor(doc, o);
  const design = renderDesign(doc, images, { ...opts, stitches: o.guide ? 'light' : 'none', grain: false, shadows: false }, 60);
  const fit = Math.min(1, (page.w - MARGIN * 2) / design.wIn, (page.h - MARGIN * 2) / design.hIn);
  const scale = Math.min(target.clientWidth / page.w, 260 / page.h) || 24;
  const dpr = window.devicePixelRatio || 1;
  target.width = Math.round(page.w * scale * dpr);
  target.height = Math.round(page.h * scale * dpr);
  target.style.width = `${page.w * scale}px`;
  target.style.height = `${page.h * scale}px`;
  const ctx = target.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, page.w * scale, page.h * scale);
  const w = design.wIn * fit * scale, h = design.hIn * fit * scale;
  ctx.drawImage(design.canvas, (page.w * scale - w) / 2, (page.h * scale - h) / 2, w, h);
  return { fit, page, trimDropped: o.trim && !opts.trim };
}

export async function exportPNG(doc, images, filename = 'stitched-design.png') {
  const { canvas } = renderDesign(doc, images, {
    stitches: 'real', holes: false, photos: true, paperFill: true, grain: true, shadows: true, trim: false,
  }, 300);
  const url = await canvasUrl(canvas);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
