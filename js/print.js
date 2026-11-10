// Print (punch template + stitch chart) and image export.
import { drawScene } from './render.js';

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
  const design = renderDesign(doc, images, { ...opts, stitches: 'light', holes: true, grain: false, shadows: false }, 300);
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
  const design = renderDesign(doc, images, { ...opts, stitches: 'light', holes: true, grain: false, shadows: false }, 60);
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
