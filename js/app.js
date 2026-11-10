import { MOTIFS, FRAMES } from './motifs.js';
import { FONTS, fontCss, fontsChanged, bitmapFor, nativeSize } from './stitch.js';
import { FILTERS, applyFilter } from './filters.js';
import {
  drawScene, gridOf, boundsOf, snapStitch, photoGeometry, isStitch, paintStitches, stats, EDGES, filteredImage, photoFrame,
} from './render.js';
import { printDesign, printPreview, exportPNG, PAPERS, formatLength, inchLabel } from './print.js';
import { TEMPLATES, templateById, buildTemplate, layoutTexts, keepInside, applyLayout } from './templates.js';

const $ = (s) => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------------------------------------------------------------- presets

const SIZES = [
  { w: 4, h: 6, note: 'postcard' },
  { w: 5, h: 7, note: 'card' },
  { w: 6, h: 6, note: 'square' },
  { w: 8, h: 10, note: 'frame' },
  { w: 4, h: 11, note: 'long strip' },
];
const SHAPES = [
  { id: 'orig', name: 'Original' },
  { id: '1:1', name: 'Square' },
  { id: '4:5', name: '4:5' },
  { id: '3:4', name: '3:4' },
  { id: '2:3', name: '2:3' },
  { id: '3:2', name: '3:2' },
  { id: '16:9', name: 'Wide' },
];
const PAPER_COLORS = ['#FBF8F2', '#FFFFFF', '#C9A57D', '#F0D5D1', '#C2CBB0', '#F2E3AE', '#5A1A20', '#1F2A44', '#262322'];
const THREAD_COLORS = ['#C1121F', '#9E1B32', '#E79AA6', '#F1E6CF', '#FFFFFF', '#C9A24A', '#1C1A1A', '#23395B', '#5F7A52'];
const LOOKS = [
  { name: 'Classic', paper: '#FBF8F2', thread: '#C1121F' },
  { name: 'Maroon', paper: '#5A1A20', thread: '#F1E6CF' },
  { name: 'Noir', paper: '#262322', thread: '#E0313F' },
  { name: 'Navy & gold', paper: '#1F2A44', thread: '#C9A24A' },
];

// ---------------------------------------------------------------- state

const STORE = 'stitched:v15';
const DEFAULT_PITCH = 1 / 14; // 1.8 mm between holes, how most people stitch paper
const images = new Map(); // id -> { src, img, w, h }
let doc = null;
let selectedId = null;
let cropId = null;
let hoverId = null;
const view = { zoom: 1, mode: 'real', grid: false };
const prefs = { thread: '#C1121F', font: 'viceroy', size: 24, weight: 0, align: 'center', draft: '', letter: null };
const printOpts = {
  paper: /^en-(US|CA)|^es-(MX|US)/.test(navigator.language || '') ? 'letter' : 'a4',
  holes: true, photos: true, guide: false, paperFill: false, trim: true, chart: true,
};

const byId = (id) => doc.elements.find((e) => e.id === id);
const selected = () => (selectedId ? byId(selectedId) : null);

/*
 * Every element remembers its "home": where its center sits as a fraction of the card, and its size as a
 * fraction of the card's shorter side. Changing the card size rebuilds the layout from these, so each
 * card size always gets the same photo and stitch sizes, however many times you switch back and forth.
 * Home is only updated when the person places something (template, add, drag, resize, nudge).
 */
function setHome(el, d = doc) {
  const b = boundsOf(d, el);
  const m = Math.min(d.w, d.h);
  const home = { cx: (b.x + b.w / 2) / d.w, cy: (b.y + b.h / 2) / d.h };
  if (el.type === 'photo') { home.k = el.w / m; home.ar = el.h / el.w; }
  else if (el.type === 'text') {
    home.k = ((el.baseSize ?? el.size) * d.pitch) / m;
    if (el.home?.mw) home.mw = el.home.mw; // keep the box it fits in
    if (el.home?.mh) home.mh = el.home.mh;
  } else if (el.type === 'motif') home.k = (el.scale * d.pitch) / m;
  else if (el.type === 'frame') { home.fc = (el.cols * d.pitch) / d.w; home.fr = (el.rows * d.pitch) / d.h; }
  el.home = home;
}
const setHomes = (d = doc) => d.elements.forEach((el) => { if (!el.home) setHome(el, d); });

function textEl(text, extra = {}) {
  return {
    id: uid(), type: 'text', text, font: prefs.font, size: prefs.size, weight: prefs.weight,
    align: prefs.align, color: prefs.thread, x: 0, y: 0, ...extra,
  };
}

function starterDoc() {
  const d = buildTemplate(TEMPLATES[0], { pitch: DEFAULT_PITCH, uid });
  setHomes(d);
  return d;
}

/** Switch to a template, carrying over photos and words the person already added. */
function applyTemplate(id, { fresh = false } = {}) {
  const t = templateById(id);
  if (!t) return;
  flush();
  const photos = fresh ? [] : doc.elements.filter((e) => e.type === 'photo' && images.get(e.imgId));
  const texts = {};
  if (!fresh) {
    for (const e of doc.elements) if (e.type === 'text' && e.slot && !(e.slot in texts)) texts[e.slot] = e.text;
    if (!texts.names && texts.i1 && texts.i2) texts.names = `${texts.i1} + ${texts.i2}`;
    if (texts.names && !texts.i1) {
      const parts = texts.names.split(/\s*[&+]\s*|\s+and\s+/i).filter(Boolean);
      if (parts.length === 2) [texts.i1, texts.i2] = parts;
    }
  }
  const next = buildTemplate(t, { pitch: doc ? doc.pitch : DEFAULT_PITCH, texts, uid }); // always the template's default look & positions
  next.elements.filter((e) => e.type === 'photo').forEach((spot, i) => {
    const src = photos[i];
    if (src) Object.assign(spot, { imgId: src.imgId, filter: src.filter, brightness: src.brightness, contrast: src.contrast });
  });
  prefs.thread = t.thread;
  doc = next;
  setHomes();
  selectedId = null;
  cropId = null;
  commit();
  render();
  if (window.matchMedia('(max-width: 960px)').matches) $('.stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Elements flagged `center` were placed by their center point; resolve that once bitmaps exist. */
function resolveCenters() {
  for (const el of doc.elements) {
    if (!el.center) continue;
    const b = boundsOf(doc, el);
    el.x -= b.w / 2;
    delete el.center;
    snapStitch(doc, el);
  }
}

// ---------------------------------------------------------------- history & storage

const history = { stack: [], index: -1 };
const snapshot = () => JSON.stringify(doc);

function commit() {
  clearTimeout(commitTimer);
  commitTimer = 0;
  const s = snapshot();
  if (history.stack[history.index] === s) return;
  history.stack = history.stack.slice(0, history.index + 1);
  history.stack.push(s);
  if (history.stack.length > 100) history.stack.shift();
  history.index = history.stack.length - 1;
  persist();
  sync();
}
let commitTimer = 0;
/** Typing and sliding commit on a timer; make sure that lands before any other change starts. */
const flush = () => { if (commitTimer) { clearTimeout(commitTimer); commitTimer = 0; commit(); } };
function commitSoon(ms = 500) {
  clearTimeout(commitTimer);
  commitTimer = setTimeout(() => { commitTimer = 0; commit(); }, ms);
}
function restore(i) {
  history.index = i;
  doc = JSON.parse(history.stack[i]);
  if (selectedId && !byId(selectedId)) selectedId = null;
  if (cropId && !byId(cropId)) cropId = null;
  persist();
  sync();
  render();
}
const undo = () => history.index > 0 && restore(history.index - 1);
const redo = () => history.index < history.stack.length - 1 && restore(history.index + 1);

let persistTimer = 0, warnedStorage = false;
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const used = {};
    for (const el of doc.elements) {
      if (el.type === 'photo' && el.imgId && images.has(el.imgId)) used[el.imgId] = images.get(el.imgId).src;
    }
    try {
      localStorage.setItem(STORE, JSON.stringify({ doc, images: used }));
    } catch {
      try {
        localStorage.setItem(STORE, JSON.stringify({ doc, images: {} }));
      } catch { /* storage unavailable */ }
      if (!warnedStorage) {
        warnedStorage = true;
        toast('Your photos are too large to keep after a refresh. The rest of the design is saved.');
      }
    }
  }, 400);
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

async function registerImage(id, src) {
  const img = await loadImage(src);
  images.set(id, { src, img, w: img.naturalWidth, h: img.naturalHeight });
  return id;
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data?.doc?.elements) return false;
    doc = data.doc;
    for (const [id, src] of Object.entries(data.images || {})) {
      registerImage(id, src).then(() => { render(); sync(); }).catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- canvas view

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const scroller = $('#stageScroll');
const V = { ppi: 60, ox: 0, oy: 0, cssW: 0, cssH: 0, dpr: 1 };

function layout() {
  const narrow = scroller.clientWidth < 600;
  const pad = narrow ? 18 : 44;
  const availW = scroller.clientWidth, availH = scroller.clientHeight;
  const fit = Math.max(10, Math.min((availW - pad * 2) / doc.w, (availH - pad * 2) / doc.h));
  V.ppi = fit * view.zoom;
  const cssW = Math.max(availW, Math.ceil(doc.w * V.ppi + pad * 2));
  const cssH = Math.max(availH, Math.ceil(doc.h * V.ppi + pad * 2));
  V.ox = Math.round((cssW - doc.w * V.ppi) / 2);
  V.oy = Math.round((cssH - doc.h * V.ppi) / 2);
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  if (cssW !== V.cssW || cssH !== V.cssH || dpr !== V.dpr) {
    V.cssW = cssW; V.cssH = cssH; V.dpr = dpr;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  }
}

let frame = 0;
function render() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    draw();
  });
}

function handlesFor(el) {
  if (el.type === 'photo' || el.type === 'frame') return ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'rot'];
  return ['nw', 'ne', 'se', 'sw', 'rot'];
}
/** The selection frame in inches: center, size and rotation. */
function selFrame(el) {
  if (el.type === 'photo') return photoFrame(el);
  const b = boundsOf(doc, el);
  return { cx: b.x + b.w / 2, cy: b.y + b.h / 2, w: b.w, h: b.h, angle: 0 };
}
const ROT_GAP = 26; // px between the frame's bottom edge and the rotate handle
/** A handle's position in the frame's own (unrotated, centered) coordinates, in inches. */
function handleLocal(f, h) {
  const pad = 3 / V.ppi;
  if (h === 'rot') return [0, f.h / 2 + pad + ROT_GAP / V.ppi];
  const x = h.includes('w') ? -f.w / 2 - pad : h.includes('e') ? f.w / 2 + pad : 0;
  const y = h.includes('n') ? -f.h / 2 - pad : h.includes('s') ? f.h / 2 + pad : 0;
  return [x, y];
}
const rad = (deg) => (deg * Math.PI) / 180;
function toWorld(f, [lx, ly]) {
  const a = rad(f.angle), c = Math.cos(a), s = Math.sin(a);
  return [f.cx + lx * c - ly * s, f.cy + lx * s + ly * c];
}
function toLocal(f, p) {
  const a = rad(f.angle), c = Math.cos(a), s = Math.sin(a), dx = p.x - f.cx, dy = p.y - f.cy;
  return [dx * c + dy * s, -dx * s + dy * c];
}
const toScreen = (b) => ({ x: V.ox + b.x * V.ppi, y: V.oy + b.y * V.ppi, w: b.w * V.ppi, h: b.h * V.ppi });

function draw() {
  layout();
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  ctx.clearRect(0, 0, V.cssW, V.cssH);
  ctx.save();
  ctx.shadowColor = 'rgba(50,30,20,0.22)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = doc.paper;
  ctx.fillRect(V.ox, V.oy, doc.w * V.ppi, doc.h * V.ppi);
  ctx.restore();

  drawScene(ctx, doc, images, {
    ppi: V.ppi, ox: V.ox, oy: V.oy,
    stitches: view.mode === 'real' ? 'real' : 'light',
    holes: view.mode === 'pattern',
    grid: view.grid,
    photos: true, paperFill: true, grain: true, placeholders: 'editor', shadows: true, ghostOutside: true,
  });

  const crop = cropId && byId(cropId);
  if (crop && images.get(crop.imgId)) {
    const image = images.get(crop.imgId);
    const geo = photoGeometry(crop, image);
    const d = toScreen(geo.draw), inner = toScreen(geo.inner);
    const src = filteredImage(crop, image);
    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.drawImage(src, d.x, d.y, d.w, d.h);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.rect(inner.x, inner.y, inner.w, inner.h);
    ctx.clip();
    ctx.drawImage(src, d.x, d.y, d.w, d.h);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(inner.x, inner.y, inner.w, inner.h);
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#a8322e';
    ctx.strokeRect(inner.x, inner.y, inner.w, inner.h);
    ctx.restore();
    return;
  }

  if (drag?.guides && (drag.guides.v || drag.guides.h)) {
    ctx.save();
    ctx.strokeStyle = 'rgba(214, 51, 108, 0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (drag.guides.v) { const x = Math.round(V.ox + (doc.w / 2) * V.ppi) + 0.5; ctx.moveTo(x, V.oy); ctx.lineTo(x, V.oy + doc.h * V.ppi); }
    if (drag.guides.h) { const y = Math.round(V.oy + (doc.h / 2) * V.ppi) + 0.5; ctx.moveTo(V.ox, y); ctx.lineTo(V.ox + doc.w * V.ppi, y); }
    ctx.stroke();
    ctx.restore();
  }

  const hov = hoverId && hoverId !== selectedId && byId(hoverId);
  if (hov) {
    const r = toScreen(boundsOf(doc, hov));
    ctx.save();
    ctx.strokeStyle = 'rgba(168,50,46,0.55)';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(r.x - 2.5, r.y - 2.5, r.w + 5, r.h + 5);
    ctx.restore();
  }
  const sel = selected();
  if (sel) {
    const f = selFrame(sel);
    const busy = drag && drag.moved;
    ctx.save();
    ctx.translate(V.ox + f.cx * V.ppi, V.oy + f.cy * V.ppi);
    ctx.rotate(rad(f.angle));
    ctx.strokeStyle = '#a8322e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-f.w / 2 * V.ppi - 3, -f.h / 2 * V.ppi - 3, f.w * V.ppi + 6, f.h * V.ppi + 6);
    if (!busy || drag.kind === 'rotate') {
      for (const h of handlesFor(sel)) {
        const [lx, ly] = handleLocal(f, h);
        const sx = lx * V.ppi, sy = ly * V.ppi;
        ctx.fillStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = h === 'rot' ? '#cfc8c0' : '#a8322e';
        ctx.beginPath();
        if (h === 'rot') {
          ctx.save();
          ctx.shadowColor = 'rgba(40,25,15,0.18)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 1;
          ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          ctx.stroke();
          drawRotateIcon(ctx, sx, sy);
          continue;
        }
        if (h.length === 2) ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
        else if (h === 'n' || h === 's') ctx.roundRect ? ctx.roundRect(sx - 7, sy - 3.5, 14, 7, 3.5) : ctx.rect(sx - 7, sy - 3.5, 14, 7);
        else ctx.roundRect ? ctx.roundRect(sx - 3.5, sy - 7, 7, 14, 3.5) : ctx.rect(sx - 3.5, sy - 7, 7, 14);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
    if (drag?.kind === 'rotate' && drag.moved) {
      ctx.save();
      ctx.font = '600 12px "Archivo Narrow", sans-serif';
      const label = `${Math.round(((sel.angle || 0) % 360 + 360) % 360)}°`;
      const [wx, wy] = toWorld(f, handleLocal(f, 'rot'));
      const x = V.ox + wx * V.ppi, y = V.oy + wy * V.ppi + 26;
      const tw = ctx.measureText(label).width + 14;
      ctx.fillStyle = 'rgba(42,32,28,0.9)';
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - tw / 2, y - 10, tw, 20, 10) : ctx.rect(x - tw / 2, y - 10, tw, 20); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y + 0.5);
      ctx.restore();
    }
  }
  placeMiniBar(sel);
}

/** Circular-arrows icon for the rotate handle. */
function drawRotateIcon(c, x, y) {
  c.save();
  c.strokeStyle = '#3a2f2a';
  c.fillStyle = '#3a2f2a';
  c.lineWidth = 1.5;
  c.lineCap = 'round';
  const r = 5.5;
  for (const start of [-0.15 * Math.PI, 0.85 * Math.PI]) {
    c.beginPath();
    c.arc(x, y, r, start, start + 0.72 * Math.PI);
    c.stroke();
    const end = start + 0.72 * Math.PI;
    const ex = x + r * Math.cos(end), ey = y + r * Math.sin(end);
    const tx = -Math.sin(end), ty = Math.cos(end); // direction of travel
    c.beginPath();
    c.moveTo(ex + tx * 3, ey + ty * 3);
    c.lineTo(ex - ty * 2.6 - tx * 0.6, ey + tx * 2.6 - ty * 0.6);
    c.lineTo(ex + ty * 2.6 - tx * 0.6, ey - tx * 2.6 - ty * 0.6);
    c.closePath();
    c.fill();
  }
  c.restore();
}

// ---------------------------------------------------------------- floating mini toolbar (like Canva's)

const miniBar = $('#miniBar');
function placeMiniBar(sel) {
  const show = sel && !(drag && drag.moved);
  miniBar.hidden = !show;
  if (!show) return;
  const want = cropId ? 'crop' : 'edit';
  if (miniBar.dataset.mode !== want) {
    miniBar.dataset.mode = want;
    miniBar.innerHTML = cropId
      ? '<button type="button" data-act="done" class="text">Done</button>'
      : `<button type="button" data-act="dup" title="Duplicate" aria-label="Duplicate">
           <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 5.5v-.3A1.7 1.7 0 0 0 13.8 3.5H6.2A1.7 1.7 0 0 0 4.5 5.2v7.6a1.7 1.7 0 0 0 1.7 1.7h.3"/><path d="M14 11.5v5M11.5 14h5"/></svg>
         </button>
         <button type="button" data-act="del" title="Delete" aria-label="Delete">
           <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15"/><path d="M9.5 7V5.2c0-.7.5-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2V7"/><path d="M6.5 7l.8 11.3c.1 1 .9 1.7 1.9 1.7h5.6c1 0 1.8-.7 1.9-1.7L17.5 7"/><path d="M10.3 10.8v5.4M13.7 10.8v5.4"/></svg>
         </button>`;
  }
  const b = boundsOf(doc, sel);
  const r = toScreen(b);
  const bw = miniBar.offsetWidth || 96, bh = miniBar.offsetHeight || 40;
  let top = r.y - bh - 14;
  if (top < scroller.scrollTop + 6) top = r.y + r.h + ROT_GAP + 28; // no room above: go below the rotate handle
  const left = clamp(r.x + r.w / 2 - bw / 2, 6, V.cssW - bw - 6);
  miniBar.style.left = `${left}px`;
  miniBar.style.top = `${top}px`;
}
miniBar.addEventListener('pointerdown', (e) => e.stopPropagation());
miniBar.addEventListener('click', (e) => {
  const act = e.target.closest('button')?.dataset.act;
  if (act === 'dup') duplicateSelected();
  else if (act === 'del') removeSelected();
  else if (act === 'done') exitCrop();
});

new ResizeObserver(() => render()).observe(scroller);

// ---------------------------------------------------------------- hit testing & pointer

function pointerInches(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left - V.ox) / V.ppi, y: (e.clientY - r.top - V.oy) / V.ppi, sx: e.clientX - r.left, sy: e.clientY - r.top };
}
const inside = (p, b, slop = 0) => p.x >= b.x - slop && p.x <= b.x + b.w + slop && p.y >= b.y - slop && p.y <= b.y + b.h + slop;

function hitTest(p) {
  for (let i = doc.elements.length - 1; i >= 0; i--) {
    const el = doc.elements[i];
    if (inside(p, boundsOf(doc, el), 2 / V.ppi)) return el;
  }
  return null;
}

function hitHandle(p, el, touch) {
  const f = selFrame(el);
  const [lx, ly] = toLocal(f, p);
  const tol = (touch ? 16 : 9) / V.ppi;
  for (const h of handlesFor(el)) {
    const [hx, hy] = handleLocal(f, h);
    const t = h === 'rot' ? tol + 4 / V.ppi : tol;
    if (Math.abs(lx - hx) <= t && Math.abs(ly - hy) <= t) return h;
  }
  return null;
}

const CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', rot: 'grab' };
let drag = null;
let lastTap = { id: null, t: 0 };

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  canvas.focus({ preventScroll: true });
  const p = pointerInches(e);
  const touch = e.pointerType !== 'mouse';
  if (cropId) {
    const el = byId(cropId);
    if (el && inside(p, boundsOf(doc, el))) {
      drag = { kind: 'pan', id: el.id, start: p, orig: { ...el }, moved: false };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
      return;
    }
    exitCrop();
  }
  const sel = selected();
  const h = sel && hitHandle(p, sel, touch);
  if (h === 'rot') {
    const f = selFrame(sel);
    drag = { kind: 'rotate', id: sel.id, start: p, c: { x: f.cx, y: f.cy }, a0: sel.angle || 0, p0: Math.atan2(p.y - f.cy, p.x - f.cx), moved: false };
  } else if (h) {
    drag = { kind: 'resize', id: sel.id, handle: h, start: p, orig: JSON.parse(JSON.stringify(sel)), b0: boundsOf(doc, sel), f0: selFrame(sel), moved: false };
  } else {
    const hit = hitTest(p);
    // double-tap on touch screens (dblclick isn't reliable with touch-action: none)
    const now = performance.now();
    if (touch && hit && lastTap.id === hit.id && now - lastTap.t < 350) {
      lastTap = { id: null, t: 0 };
      openElement(hit);
      render();
      return;
    }
    lastTap = { id: hit ? hit.id : null, t: now };
    select(hit ? hit.id : null);
    if (hit) drag = { kind: 'move', id: hit.id, start: p, orig: { x: hit.x, y: hit.y }, moved: false };
  }
  if (drag) canvas.setPointerCapture(e.pointerId);
  render();
});

canvas.addEventListener('pointermove', (e) => {
  const p = pointerInches(e);
  if (!drag) {
    if (e.pointerType !== 'mouse') return;
    if (cropId) {
      canvas.style.cursor = inside(p, boundsOf(doc, byId(cropId))) ? 'grab' : 'default';
      return;
    }
    const sel = selected();
    const h = sel && hitHandle(p, sel, false);
    const hit = h ? null : hitTest(p);
    canvas.style.cursor = h ? CURSORS[h] : hit ? 'move' : 'default';
    const nh = hit ? hit.id : null;
    if (nh !== hoverId) { hoverId = nh; render(); }
    return;
  }
  const el = byId(drag.id);
  if (!el) return;
  const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
  if (!drag.moved && Math.hypot(dx, dy) * V.ppi < 2) return;
  drag.moved = true;
  if (drag.kind === 'move') {
    el.x = drag.orig.x + dx;
    el.y = drag.orig.y + dy;
    // Canva-style center guides: snap to the card's center lines when close
    const b = boundsOf(doc, el);
    const tol = 7 / V.ppi;
    const offX = doc.w / 2 - (b.x + b.w / 2), offY = doc.h / 2 - (b.y + b.h / 2);
    drag.guides = { v: Math.abs(offX) < tol, h: Math.abs(offY) < tol };
    if (drag.guides.v) el.x += offX;
    if (drag.guides.h) el.y += offY;
  } else if (drag.kind === 'pan') {
    const geo = photoGeometry(drag.orig, images.get(el.imgId));
    if (geo.ovX > 0.001) el.panX = clamp(drag.orig.panX + (2 * dx) / geo.ovX, -1, 1);
    if (geo.ovY > 0.001) el.panY = clamp(drag.orig.panY + (2 * dy) / geo.ovY, -1, 1);
  } else if (drag.kind === 'resize') {
    resize(el, drag, p);
  } else if (drag.kind === 'rotate') {
    let a = drag.a0 + ((Math.atan2(p.y - drag.c.y, p.x - drag.c.x) - drag.p0) * 180) / Math.PI;
    a = ((a + 180) % 360 + 360) % 360 - 180;
    const snap = Math.round(a / 15) * 15;
    if (!e.shiftKey && Math.abs(a - snap) < 4) a = snap; // snaps to 0°, 15°, 30°… (hold Shift for free rotation)
    el.angle = Math.abs(a) < 0.05 ? 0 : a;
    if (isStitch(el)) placeAt(el, drag.c.x, drag.c.y); // keep it turning around its own center
  }
  render();
  syncLive();
});

function endDrag() {
  if (!drag) return;
  const el = byId(drag.id);
  if (drag.moved && el) {
    if (isStitch(el)) snapStitch(doc, el);
    if (el.angle === 0) delete el.angle;
    if (drag.kind !== 'pan') {
      if (el.tpl) el.custom = true;
      setHome(el);
    }
    commit();
  }
  canvas.style.cursor = drag.kind === 'pan' || drag.kind === 'rotate' ? 'grab' : 'default';
  drag = null;
  render();
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', () => { if (hoverId && !drag) { hoverId = null; render(); } });

function resize(el, d, p) {
  const { b0, orig, handle: h } = d;
  const hx = h.includes('w') ? -1 : h.includes('e') ? 1 : 0;
  const hy = h.includes('n') ? -1 : h.includes('s') ? 1 : 0;
  const L = b0.x, T = b0.y, R = b0.x + b0.w, B = b0.y + b0.h;
  const ax = hx < 0 ? R : L, ay = hy < 0 ? B : T;
  const corner = hx !== 0 && hy !== 0;
  const g = gridOf(doc);

  if (el.type === 'photo') {
    // Work in the photo's own frame so rotated photos resize along their own edges.
    const f0 = d.f0;
    const [lx, ly] = toLocal(f0, p);
    const Ax = -hx * f0.w / 2, Ay = -hy * f0.h / 2; // the fixed opposite side
    let w = f0.w, h = f0.h;
    if (corner) {
      const k = Math.max(Math.abs(lx - Ax) / f0.w, Math.abs(ly - Ay) / f0.h, 0.4 / Math.min(f0.w, f0.h));
      w = f0.w * k; h = f0.h * k;
    } else if (hx) w = Math.max(0.4, hx * (lx - Ax));
    else h = Math.max(0.4, hy * (ly - Ay));
    const [cx, cy] = toWorld(f0, [hx ? Ax + hx * w / 2 : 0, hy ? Ay + hy * h / 2 : 0]);
    Object.assign(el, { w, h, x: cx - w / 2, y: cy - h / 2 });
    return;
  }
  if (el.type === 'frame') {
    if (hx) el.cols = Math.max(3, Math.round((hx > 0 ? p.x - L : R - p.x) / g.p));
    if (hy) el.rows = Math.max(3, Math.round((hy > 0 ? p.y - T : B - p.y) / g.p));
    el.x = hx < 0 ? R - el.cols * g.p : L;
    el.y = hy < 0 ? B - el.rows * g.p : T;
    return;
  }
  // Proportional: measure the drag along the box's diagonal (from the fixed corner), so the text
  // grows and shrinks evenly with the cursor and keeps its shape.
  const cx0 = hx < 0 ? L : R, cy0 = hy < 0 ? T : B; // the dragged corner, at the start
  const vx = cx0 - ax, vy = cy0 - ay;
  const f = Math.max(0.05, ((p.x - ax) * vx + (p.y - ay) * vy) / (vx * vx + vy * vy));
  if (el.type === 'text') {
    el.size = clamp(Math.round(orig.size * f), 5, 160);
    el.baseSize = el.size;
    // Sized by hand: keeps this size when the font changes. It still belongs to the template, so changing
    // the card size puts it back at that size's default.
    if (el.tpl) el.custom = true;
    if (el.home) { delete el.home.mw; delete el.home.mh; }
  }
  if (el.type === 'motif') el.scale = clamp(orig.scale * f, 0.25, 10);
  const b = boundsOf(doc, el);
  el.x = hx < 0 ? R - b.w : L;
  el.y = hy < 0 ? B - b.h : T;
}

canvas.addEventListener('dblclick', (e) => openElement(hitTest(pointerInches(e))));

function openElement(hit) {
  if (!hit) return;
  if (hit.type === 'photo') {
    if (!images.get(hit.imgId)) pickFiles(hit.id);
    else enterCrop(hit.id);
  } else if (hit.type === 'text') {
    const input = $(`#wordFields [data-id="${hit.id}"] input, #wordFields [data-id="${hit.id}"] textarea`);
    if (input) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input.focus({ preventScroll: true });
      input.select();
    }
  }
}

canvas.addEventListener('wheel', (e) => {
  if (!cropId) return;
  const el = byId(cropId);
  if (!el) return;
  e.preventDefault();
  el.zoom = clamp((el.zoom || 1) * Math.exp(-e.deltaY * 0.0015), 1, 4);
  render();
  syncLive();
  commitSoon();
}, { passive: false });

// ---------------------------------------------------------------- selection & element ops

function select(id, { scroll = true } = {}) {
  if (id === selectedId) return;
  selectedId = id;
  if (cropId && cropId !== id) cropId = null;
  sync();
  const el = selected();
  if (!el || !scroll || !window.matchMedia('(min-width: 961px)').matches) return;
  const opts = { behavior: 'smooth', block: 'nearest' };
  if (el.type === 'photo') $('#photoEdit').scrollIntoView(opts);
  else if (el.type === 'text') $(`#wordFields [data-id="${el.id}"]`)?.scrollIntoView(opts);
}

function enterCrop(id) {
  const el = byId(id);
  if (!el || !images.get(el.imgId)) return;
  cropId = id;
  selectedId = id;
  canvas.style.cursor = 'grab';
  sync();
  render();
}
function exitCrop() {
  cropId = null;
  canvas.style.cursor = 'default';
  commit();
  render();
}

function addElement(el, { at, index } = {}) {
  if (at) placeAt(el, at.x, at.y);
  if (index === undefined) doc.elements.push(el);
  else doc.elements.splice(index, 0, el);
  setHome(el);
  selectedId = null;
  select(el.id);
  commit();
  render();
  // On phones the panel sits below the card; bring the card back into view.
  if (window.matchMedia('(max-width: 960px)').matches) {
    $('.stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function placeAt(el, cx, cy) {
  const b = boundsOf(doc, el);
  el.x += cx - (b.x + b.w / 2);
  el.y += cy - (b.y + b.h / 2);
  if (isStitch(el)) snapStitch(doc, el);
}

/** The spot on the card where a w×h box overlaps the least, preferring the middle. */
function freeSpot(w, h) {
  const others = doc.elements.map((e) => boundsOf(doc, e));
  let best = null;
  for (let fy = 0.06; fy <= 0.94; fy += 0.02) {
    for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8]) {
      const r = { x: doc.w * fx - w / 2, y: doc.h * fy - h / 2, w, h };
      if (r.x < 0 || r.y < 0 || r.x + w > doc.w || r.y + h > doc.h) continue;
      let overlap = 0;
      for (const o of others) {
        overlap += Math.max(0, Math.min(r.x + w, o.x + o.w) - Math.max(r.x, o.x))
          * Math.max(0, Math.min(r.y + h, o.y + o.h) - Math.max(r.y, o.y));
      }
      const score = overlap + Math.abs(fx - 0.5) * 0.05 * w * h;
      if (!best || score < best.score) best = { score, x: doc.w * fx, y: doc.h * fy };
    }
  }
  return best || nextSpot();
}

let stagger = 0;
function nextSpot() {
  const off = ((stagger++ % 5) - 2) * 0.18;
  return { x: doc.w / 2 + off, y: doc.h / 2 + off };
}

/** Change a text element while keeping it anchored per its alignment. */
function keepAnchor(el, fn, { vertical = false } = {}) {
  const b0 = boundsOf(doc, el);
  fn();
  const b1 = boundsOf(doc, el);
  const anchor = el.type === 'text' ? el.align : 'center';
  if (anchor === 'center') el.x += b0.x + b0.w / 2 - (b1.x + b1.w / 2);
  else if (anchor === 'right') el.x += b0.x + b0.w - (b1.x + b1.w);
  else el.x += b0.x - b1.x;
  if (el.type !== 'text' || vertical) el.y += b0.y + b0.h / 2 - (b1.y + b1.h / 2);
  if (isStitch(el)) snapStitch(doc, el);
}

function removeSelected() {
  const el = selected();
  if (!el) return;
  doc.elements = doc.elements.filter((e) => e.id !== el.id);
  selectedId = null;
  cropId = null;
  commit();
  render();
}
function duplicateSelected() {
  const el = selected();
  if (!el) return;
  const copy = { ...JSON.parse(JSON.stringify(el)), id: uid() };
  delete copy.tpl; delete copy.slot; delete copy.group; delete copy.custom;
  const g = gridOf(doc);
  copy.x += g.p * 3;
  copy.y += g.p * 3;
  const i = doc.elements.indexOf(el);
  addElement(copy, { index: i + 1 });
}
function moveLayer(dir) {
  const el = selected();
  if (!el) return;
  const i = doc.elements.indexOf(el), j = i + dir;
  if (j < 0 || j >= doc.elements.length) return;
  [doc.elements[i], doc.elements[j]] = [doc.elements[j], doc.elements[i]];
  commit();
  render();
}

// ---------------------------------------------------------------- photos

const fileInput = $('#fileInput');
let fileTarget = null;
function pickFiles(targetId = null) {
  fileTarget = targetId;
  fileInput.value = '';
  fileInput.click();
}
fileInput.addEventListener('change', () => {
  const files = [...fileInput.files];
  addPhotos(files, null, fileTarget);
  fileTarget = null;
});

async function prepareImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const max = 2000;
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    const id = uid();
    await registerImage(id, c.toDataURL('image/jpeg', 0.88));
    return id;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function addPhotos(files, at, targetId) {
  const list = files.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|avif)$/i.test(f.name));
  if (!list.length) return;
  let target = targetId ? byId(targetId) : null;
  if (!target) {
    const sel = selected();
    if (sel?.type === 'photo' && !images.get(sel.imgId) && !at) target = sel;
  }
  if (!target) target = doc.elements.find((e) => e.type === 'photo' && !images.get(e.imgId) && (!at || inside(at, e)));
  if (target && at && !inside(at, target)) target = null;
  for (const [i, file] of list.entries()) {
    let id;
    try {
      id = await prepareImage(file);
    } catch {
      toast(`Couldn't open ${file.name}. Try a JPG or PNG.`);
      continue;
    }
    const info = images.get(id);
    if (target && i === 0) {
      Object.assign(target, { imgId: id, zoom: 1, panX: 0, panY: 0 });
      selectedId = null;
      select(target.id);
      commit();
      render();
      continue;
    }
    const aspect = info.w / info.h;
    let w = Math.min(doc.w * 0.6, doc.h * 0.6 * aspect);
    let h = w / aspect;
    const spot = at ? { x: at.x + i * 0.25, y: at.y + i * 0.25 } : nextSpot();
    const el = {
      id: uid(), type: 'photo', imgId: id, x: spot.x - w / 2, y: spot.y - h / 2, w, h,
      zoom: 1, panX: 0, panY: 0, filter: 'classic', edge: 'none', brightness: 0, contrast: 0,
    };
    // Photos sit under the stitching, so slot them in after the last photo.
    let idx = 0;
    doc.elements.forEach((e, k) => { if (e.type === 'photo') idx = k + 1; });
    addElement(el, { index: idx });
  }
}

function setShape(el, shapeId) {
  const image = images.get(el.imgId);
  let ratio;
  if (shapeId === 'orig') ratio = image ? image.w / image.h : el.w / el.h;
  else {
    const [a, b] = shapeId.split(':').map(Number);
    ratio = a / b;
  }
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  const area = el.w * el.h;
  let w = Math.sqrt(area * ratio), h = w / ratio;
  const fit = Math.min(1, (doc.w * 0.95) / w, (doc.h * 0.95) / h);
  w *= fit; h *= fit;
  Object.assign(el, { w, h, x: cx - w / 2, y: cy - h / 2, panX: 0, panY: 0 });
  if (el.tpl) el.custom = true;
  setHome(el);
}

function currentShape(el) {
  const r = el.w / el.h;
  const image = images.get(el.imgId);
  if (image && Math.abs(r - image.w / image.h) < 0.01) return 'orig';
  const s = SHAPES.find((x) => x.id !== 'orig' && Math.abs(r - x.id.split(':')[0] / x.id.split(':')[1]) < 0.01);
  return s ? s.id : null;
}

// drag & drop onto the stage
let dragDepth = 0;
const dropHint = $('#dropHint');
const acceptsDrop = (e) => [...e.dataTransfer.types].some((t) => t === 'Files' || t === 'text/x-stitch');
scroller.addEventListener('dragenter', (e) => {
  if (!acceptsDrop(e)) return;
  e.preventDefault();
  dragDepth++;
  dropHint.hidden = false;
});
scroller.addEventListener('dragover', (e) => {
  if (!acceptsDrop(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
scroller.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dropHint.hidden = true;
});
scroller.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  dropHint.hidden = true;
  const p = pointerInches(e);
  const stitch = e.dataTransfer.getData('text/x-stitch');
  if (stitch) {
    const d = JSON.parse(stitch);
    addElement(d.kind === 'frame' ? frameEl(d.id) : motifEl(d.id), { at: p });
    return;
  }
  if (e.dataTransfer.files?.length) addPhotos([...e.dataTransfer.files], p);
});
// stop the browser from opening files dropped elsewhere on the page
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

// ---------------------------------------------------------------- motifs & frames

function motifEl(id) {
  return { id: uid(), type: 'motif', motif: id, scale: 1, rot: 0, flip: false, color: prefs.thread, x: 0, y: 0 };
}
function frameEl(style) {
  const g = gridOf(doc);
  return {
    id: uid(), type: 'frame', style, cols: Math.max(3, g.cols - 4), rows: Math.max(3, g.rows - 4),
    color: prefs.thread, x: g.gx + 2 * g.p, y: g.gy + 2 * g.p,
  };
}

// ---------------------------------------------------------------- panel UI

function chips(container, items, { onClick, solid = false } = {}) {
  container.innerHTML = '';
  for (const it of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `chip${solid ? ' solid' : ''}`;
    b.dataset.id = it.id;
    b.innerHTML = it.html ?? it.name;
    b.addEventListener('click', () => onClick(it.id));
    container.appendChild(b);
  }
}
const setOn = (container, id) => container.querySelectorAll('[data-id]').forEach((b) => b.classList.toggle('on', b.dataset.id === String(id)));

// Colors people add with "+" are remembered in this browser (a convenience; it's fine if storage is unavailable).
const CUSTOM_KEY = 'stitched:colors';
function loadCustom() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY)) || {}; } catch { return {}; }
}
function saveCustom(all) {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(all)); } catch { /* ignore */ }
}

/**
 * A row of color swatches. With `kind`, it ends in a "+" circle that opens the color wheel;
 * the picked color joins the palette and is applied.
 */
function swatches(container, colors, onClick, kind = null) {
  container.innerHTML = '';
  const custom = kind ? (loadCustom()[kind] || []).filter((c) => !colors.includes(c)) : [];
  for (const c of [...colors, ...custom]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.id = c;
    b.style.background = c;
    b.title = c;
    b.addEventListener('click', () => onClick(c));
    container.appendChild(b);
  }
  if (!kind) return;
  const add = document.createElement('label');
  add.className = 'swatch add';
  add.title = 'Add a color';
  add.innerHTML = '';
  const input = document.createElement('input');
  input.type = 'color';
  input.setAttribute('aria-label', `Add a ${kind} color`);
  input.addEventListener('change', () => {
    const c = input.value.toUpperCase();
    const all = loadCustom();
    const list = (all[kind] || []).filter((x) => x !== c);
    if (!colors.includes(c)) list.push(c);
    all[kind] = list.slice(-8);
    saveCustom(all);
    swatches(container, colors, onClick, kind);
    onClick(c);
  });
  add.appendChild(input);
  container.appendChild(add);
}

/** Resizes the card and lays everything out again from each element's home, so sizes never drift. */
function setCanvasSize(w, h) {
  w = clamp(+w || doc.w, 2, 16);
  h = clamp(+h || doc.h, 2, 16);
  if (w === doc.w && h === doc.h) return;
  flush();
  for (const el of doc.elements) if (!el.home) setHome(el); // designs saved before homes existed
  doc.w = w; doc.h = h;
  const m = Math.min(w, h);
  const p = doc.pitch;
  for (const el of doc.elements) {
    // The template's own photo frames, words and motifs get this card size's default layout (below);
    // anything the person added is scaled from where it sat on the old card.
    if (el.tpl && templateById(doc.template)) continue;
    const H = el.home;
    if (el.type === 'photo') {
      el.w = H.k * m; el.h = el.w * H.ar;
    } else if (el.type === 'text') {
      continue; // laid out below, together
    } else if (el.type === 'motif') {
      el.scale = Math.max(0.25, (H.k * m) / p);
    } else if (el.type === 'frame') {
      el.cols = Math.max(3, Math.round((H.fc * w) / p));
      el.rows = Math.max(3, Math.round((H.fr * h) / p));
    }
    placeAt(el, H.cx * w, H.cy * h);
    // keep it on the card (without touching its home); stitching stays clear of the edge
    if (isStitch(el)) keepInside(doc, el);
    else {
      const b = boundsOf(doc, el);
      if (b.w <= doc.w) el.x += Math.max(0, -b.x) - Math.max(0, b.x + b.w - doc.w);
      if (b.h <= doc.h) el.y += Math.max(0, -b.y) - Math.max(0, b.y + b.h - doc.h);
    }
  }
  applyLayout(doc); // also lays out every piece of text
  setHomes();
  commit();
  render();
}

function updateSelected(fn, { anchor = false, live = false } = {}) {
  const el = selected();
  if (!el) return false;
  if (anchor) keepAnchor(el, () => fn(el));
  else fn(el);
  render();
  if (live) { syncLive(); commitSoon(); } else commit();
  return true;
}

/** Thread color goes on every stitch on the card. */
function setThread(c) {
  prefs.thread = c;
  for (const x of doc.elements) if (isStitch(x)) x.color = c;
  commit();
  render();
}

function buildPanel() {
  buildTemplates();

  // size
  chips($('#sizeChips'), SIZES.map((s) => ({ id: `${s.w}x${s.h}`, html: `${s.w} × ${s.h}″<small>${s.note}</small>` })), {
    onClick: (id) => {
      const [a, b] = id.split('x').map(Number);
      // Remember orientation across square sizes, so landscape stays landscape after trying 6×6.
      if (doc.w !== doc.h) doc.landscape = doc.w > doc.h;
      const landscape = !!doc.landscape;
      setCanvasSize(landscape ? Math.max(a, b) : Math.min(a, b), landscape ? Math.min(a, b) : Math.max(a, b));
    },
  });
  $('#wIn').addEventListener('change', (e) => setCanvasSize(e.target.value, doc.h));
  $('#hIn').addEventListener('change', (e) => setCanvasSize(doc.w, e.target.value));
  $('#swapBtn').addEventListener('click', () => { doc.landscape = !(doc.w > doc.h || (doc.w === doc.h && doc.landscape)); setCanvasSize(doc.h, doc.w); });

  // color presets, paper, thread
  const looks = $('#lookChips');
  for (const l of LOOKS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'look';
    b.dataset.id = l.name;
    b.innerHTML = `<div class="look-swatch" style="background:${l.paper};color:${l.thread}">✕✕</div><span>${l.name}</span>`;
    b.addEventListener('click', () => {
      doc.paper = l.paper;
      prefs.thread = l.thread;
      for (const el of doc.elements) if (isStitch(el)) el.color = l.thread;
      commit();
      render();
    });
    looks.appendChild(b);
  }
  swatches($('#paperSwatches'), PAPER_COLORS, (c) => { doc.paper = c; commit(); render(); }, 'paper');
  swatches($('#threadSwatches'), THREAD_COLORS, setThread, 'thread');

  // photo
  $('#uploadBtn').addEventListener('click', () => pickFiles());
  buildStyleChips();
  chips($('#shapeChips'), SHAPES, { onClick: (id) => updateSelected((el) => setShape(el, id)) });

  // text
  buildLetterChips();
  $('#addTextBtn').addEventListener('click', addTextBox);

  // top bar, print dialog & stage
  $('#printBtn').addEventListener('click', openPrint);
  $('#saveBtn').addEventListener('click', () => { dialog.close(); saveImage(); });
  $('#undoBtn').addEventListener('click', undo);
  $('#redoBtn').addEventListener('click', redo);
  $('#newBtn').addEventListener('click', () => {
    if (!confirm('Start this template over from scratch? You can undo this.')) return;
    prefs.letter = null;
    applyTemplate(doc.template || TEMPLATES[0].id, { fresh: true });
  });
  $('#gridToggle').addEventListener('change', (e) => { view.grid = e.target.checked; render(); });
  const zoomTo = (z) => { view.zoom = clamp(z, 0.5, 4); sync(); render(); };
  $('#zoomIn').addEventListener('click', () => zoomTo(view.zoom * 1.25));
  $('#zoomOut').addEventListener('click', () => zoomTo(view.zoom / 1.25));
  $('#zoomFit').addEventListener('click', () => zoomTo(1));
}

// ---------------------------------------------------------------- simple flow: templates, photo style, words

function buildTemplates() {
  const grid = $('#templateGrid');
  for (const t of TEMPLATES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'template';
    b.dataset.id = t.id;
    b.innerHTML = `<div class="thumb"><canvas></canvas></div><strong>${t.name}</strong>`;
    b.addEventListener('click', () => applyTemplate(t.id));
    grid.appendChild(b);
  }
  renderTemplateThumbs();
}

function renderTemplateThumbs() {
  const dpr = window.devicePixelRatio || 1;
  for (const b of $('#templateGrid').children) {
    const t = templateById(b.dataset.id);
    const cv = b.querySelector('canvas');
    const d = buildTemplate(t, { pitch: DEFAULT_PITCH, uid });
    const ppi = Math.min(76 / t.w, 60 / t.h);
    cv.width = Math.round(t.w * ppi * dpr);
    cv.height = Math.round(t.h * ppi * dpr);
    cv.style.width = `${t.w * ppi}px`;
    cv.style.height = `${t.h * ppi}px`;
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene(c, d, new Map(), {
      ppi, ox: 0, oy: 0, stitches: 'real', photos: true, paperFill: true, grain: false, placeholders: 'thumb', shadows: false,
    });
  }
}

const allPhotos = () => doc.elements.filter((e) => e.type === 'photo');

const selectedPhoto = () => (selected()?.type === 'photo' ? selected() : null);

/** Photo style applies to the selected photo, or to every photo when none is selected. */
let styleFor = null;
function buildStyleChips() {
  const sel = selectedPhoto();
  const src = sel && images.get(sel.imgId) ? sel : allPhotos().find((e) => images.get(e.imgId));
  const key = src ? src.imgId : 'none';
  if (styleFor === key) return;
  styleFor = key;
  const box = $('#styleChips');
  box.innerHTML = '';
  const image = src && images.get(src.imgId);
  const small = image ? applyFilter(image.img, image.w, image.h, 'original', 0, 0, 120) : null;
  for (const f of FILTERS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'filter';
    b.dataset.id = f.id;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 80;
    const g = cv.getContext('2d');
    if (small) {
      const t = applyFilter(small, small.width, small.height, f.id, 0, 0, 120);
      const sc = Math.max(80 / t.width, 80 / t.height);
      g.drawImage(t, (80 - t.width * sc) / 2, (80 - t.height * sc) / 2, t.width * sc, t.height * sc);
    } else {
      const grad = g.createLinearGradient(0, 0, 80, 80);
      grad.addColorStop(0, '#e9c9b5'); grad.addColorStop(1, '#6d8fb3');
      g.fillStyle = grad; g.fillRect(0, 0, 80, 80);
      g.drawImage(applyFilter(cv, 80, 80, f.id, 0, 0, 80), 0, 0);
    }
    b.append(cv, document.createTextNode(f.name));
    b.addEventListener('click', () => {
      const one = selectedPhoto();
      const photos = one ? [one] : allPhotos();
      if (!photos.length) { toast('This design has no photo spots. Pick a template with a photo.'); return; }
      for (const p of photos) p.filter = f.id;
      commit();
      render();
    });
    box.appendChild(b);
  }
}

/** The lettering style in use: whatever the text on the card uses, else the last one picked. */
function currentLetter() {
  return doc.elements.find((e) => e.type === 'text')?.font || prefs.letter || 'viceroy';
}

function buildLetterChips() {
  const box = $('#letterChips');
  for (const f of FONTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'font-chip';
    b.dataset.id = f.id;
    b.append(fontPreview(f, f.id === 'simple' ? 'Amy' : 'AJ'), Object.assign(document.createElement('small'), { textContent: f.name }));
    b.addEventListener('click', () => {
      prefs.letter = f.id;
      prefs.font = f.id;
      for (const el of doc.elements) if (el.type === 'text') el.font = f.id;
      layoutTexts(doc); // same words, same spots, sized for the new lettering
      commit();
      render();
    });
    box.appendChild(b);
  }
}

/** Adds a new text box in the current lettering, at the same letter size as the card's other words. */
function addTextBox() {
  flush();
  const m = Math.min(doc.w, doc.h);
  const sibling = doc.elements.find((e) => e.type === 'text' && e.home);
  const el = {
    id: uid(), type: 'text', text: 'love', font: currentLetter(), size: 10, weight: 0, align: 'center',
    color: doc.elements.find(isStitch)?.color || prefs.thread, x: 0, y: 0,
    home: { cx: 0.5, cy: 0.5, k: sibling ? sibling.home.k : 0.2, mw: (doc.w * 0.6) / m, mh: 0.3 },
  };
  // size it first, then put it in the emptiest spot
  doc.elements.push(el);
  layoutTexts(doc, [el]);
  doc.elements.pop();
  const b = boundsOf(doc, el);
  addElement(el, { at: freeSpot(b.w, b.h) });
  requestAnimationFrame(() => {
    const input = $(`#word-${el.id}`);
    if (!input) return;
    input.focus({ preventScroll: true });
    input.select();
    input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

/** A stitched sample of a lettering style, for the style buttons. */
function fontPreview(f, text) {
  const cv = document.createElement('canvas');
  cv.className = 'font-preview';
  cv.dataset.font = f.id;
  cv.dataset.text = text;
  drawFontPreview(cv);
  return cv;
}
function drawFontPreview(cv) {
  const f = FONTS.find((x) => x.id === cv.dataset.font);
  const dpr = window.devicePixelRatio || 1;
  const W = 78, H = 34;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = `${W}px`; cv.style.height = `${H}px`;
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bm = bitmapFor({ type: 'text', text: cv.dataset.text, font: f.id, size: nativeSize(f), weight: f.kind === 'chart' ? 0 : 1, align: 'left' });
  const s = Math.min((W - 4) / bm.w, (H - 4) / bm.h, 3);
  paintStitches(c, bm, (W - bm.w * s) / 2, (H - bm.h * s) / 2, s, '#a8322e', 'real');
}

let wordKey = '';
function syncWords() {
  const box = $('#wordFields');
  const texts = doc.elements.filter((e) => e.type === 'text');
  const key = texts.map((e) => `${e.id}:${e.text.includes('\n')}`).join('|');
  if (key !== wordKey) {
    wordKey = key;
    box.innerHTML = '';
    if (!texts.length) box.innerHTML = '<p class="word-empty">No text yet.</p>';
    texts.forEach((el, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'word-field';
      wrap.dataset.id = el.id;
      const head = document.createElement('div');
      head.className = 'word-head';
      const label = document.createElement('label');
      label.htmlFor = `word-${el.id}`;
      label.textContent = `Text ${i + 1}`;
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'word-del';
      del.title = 'Remove this text';
      del.setAttribute('aria-label', `Remove text ${i + 1}`);
      del.textContent = '×';
      del.addEventListener('click', () => {
        doc.elements = doc.elements.filter((e) => e.id !== el.id);
        if (selectedId === el.id) selectedId = null;
        commit();
        render();
      });
      head.append(label, del);
      const multi = el.text.includes('\n');
      const input = document.createElement(multi ? 'textarea' : 'input');
      input.id = `word-${el.id}`;
      if (multi) input.rows = el.text.split('\n').length;
      else input.type = 'text';
      input.value = el.text;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.addEventListener('input', () => {
        const t = byId(el.id);
        if (!t) return;
        t.text = input.value;
        if (!t.home) setHome(t);
        layoutTexts(doc, [t]);
        render();
        syncLive();
        commitSoon(700);
      });
      input.addEventListener('focus', () => select(el.id, { scroll: false }));
      input.addEventListener('blur', flush);
      input.addEventListener('change', flush);
      wrap.append(head, input);
      box.appendChild(wrap);
    });
  }
  for (const wrap of box.querySelectorAll('.word-field')) {
    const el = byId(wrap.dataset.id);
    const input = wrap.querySelector('input, textarea');
    if (el && document.activeElement !== input && input.value !== el.text) input.value = el.text;
    wrap.classList.toggle('on', wrap.dataset.id === selectedId);
  }
  setOn($('#letterChips'), currentLetter());
}

async function saveImage() {
  toast('Preparing image…');
  try {
    await exportPNG(doc, images);
    toast('Image saved.');
  } catch (err) {
    console.error(err);
    toast('Sorry, the image could not be saved.');
  }
}

// ---------------------------------------------------------------- context bar

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- sync panel with state

/** Light sync for things that change continuously while dragging/sliding. */
function syncLive() {
  const threadColor = doc.elements.find(isStitch)?.color || prefs.thread;
  setOn($('#paperSwatches'), doc.paper.toUpperCase());
  setOn($('#threadSwatches'), threadColor.toUpperCase());
  const look = LOOKS.find((l) => l.paper === doc.paper.toUpperCase() && l.thread === threadColor.toUpperCase());
  setOn($('#lookChips'), look ? look.name : '');
}

function sync() {
  const el = selected();
  const g = gridOf(doc);

  setOn($('#templateGrid'), doc.template || '');
  const sizeId = SIZES.find((s) => (s.w === doc.w && s.h === doc.h) || (s.w === doc.h && s.h === doc.w));
  setOn($('#sizeChips'), sizeId ? `${sizeId.w}x${sizeId.h}` : '');
  if (document.activeElement !== $('#wIn')) $('#wIn').value = +doc.w.toFixed(2);
  if (document.activeElement !== $('#hIn')) $('#hIn').value = +doc.h.toFixed(2);

  buildStyleChips();
  const photos = allPhotos();
  const shared = photos.length && photos.every((p) => p.filter === photos[0].filter) ? photos[0].filter : '';
  const selPhoto = selectedPhoto();
  setOn($('#styleChips'), selPhoto ? selPhoto.filter || 'original' : shared);
  $('#styleTarget').textContent = selPhoto ? '· selected photo' : '';
  $('#photoEdit').hidden = !selPhoto;
  if (selPhoto) setOn($('#shapeChips'), currentShape(selPhoto));

  syncWords();

  $('#undoBtn').disabled = history.index <= 0;
  $('#redoBtn').disabled = history.index >= history.stack.length - 1;
  $('#zoomLabel').textContent = view.zoom === 1 ? 'Fit' : `${Math.round(view.zoom * 100)}%`;
  syncLive();
}

// ---------------------------------------------------------------- print dialog

const dialog = $('#printDialog');
function readPrintForm() {
  const f = dialog.querySelector('form');
  for (const k of ['holes', 'photos', 'guide', 'paperFill', 'trim', 'chart']) printOpts[k] = f.elements[k].checked;
}
function updatePrintPreview() {
  const { fit } = printPreview(doc, images, printOpts, $('#printPreview'));
  // Only speak up when something's wrong: a card too big to print at actual size.
  $('#printNote').textContent = fit < 1
    ? `This card is bigger than one ${PAPERS[printOpts.paper].name} sheet, so it will print at ${Math.round(fit * 100)}%. Pick a smaller size for an actual-size template.`
    : '';
}
function openPrint() {
  if (cropId) exitCrop();
  chips($('#paperSizeChips'), Object.entries(PAPERS).map(([id, p]) => ({ id, name: p.name })), {
    onClick: (id) => { printOpts.paper = id; setOn($('#paperSizeChips'), id); updatePrintPreview(); },
  });
  setOn($('#paperSizeChips'), printOpts.paper);
  const f = dialog.querySelector('form');
  for (const k of ['holes', 'photos', 'guide', 'paperFill', 'trim', 'chart']) f.elements[k].checked = printOpts[k];
  dialog.showModal();
  requestAnimationFrame(updatePrintPreview);
}
dialog.querySelector('form').addEventListener('change', () => { readPrintForm(); updatePrintPreview(); });
$('#doPrint').addEventListener('click', async (e) => {
  e.preventDefault();
  readPrintForm();
  dialog.close();
  try {
    await printDesign(doc, images, printOpts);
  } catch (err) {
    console.error(err);
    toast('Printing failed. Try “Save image” instead.');
  }
});

// ---------------------------------------------------------------- keyboard

document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || dialog.open) return;
  const meta = e.metaKey || e.ctrlKey;
  const k = e.key.toLowerCase();
  if (meta && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (meta && k === 'y') { e.preventDefault(); redo(); return; }
  if (meta && k === 'd') { e.preventDefault(); duplicateSelected(); return; }
  if (k === 'escape') { if (cropId) exitCrop(); else { select(null); render(); } return; }
  const el = selected();
  if (!el) return;
  if (k === 'delete' || k === 'backspace') { e.preventDefault(); removeSelected(); return; }
  if (k === 'enter' && el.type === 'photo' && images.get(el.imgId)) { cropId ? exitCrop() : enterCrop(el.id); return; }
  const arrows = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
  if (arrows[k]) {
    e.preventDefault();
    const step = (isStitch(el) ? doc.pitch : 0.05) * (e.shiftKey ? 5 : 1);
    el.x += arrows[k][0] * step;
    el.y += arrows[k][1] * step;
    if (isStitch(el)) snapStitch(doc, el);
    setHome(el);
    render();
    commitSoon(400);
  }
});

// ---------------------------------------------------------------- toast

let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ---------------------------------------------------------------- boot

function boot() {
  if (!loadSaved()) doc = starterDoc();
  resolveCenters();
  history.stack = [snapshot()];
  history.index = 0;
  buildPanel();
  sync();
  render();

}

boot();
