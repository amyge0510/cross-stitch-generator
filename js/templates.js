// Ready-made layouts. Most people pick one, add a photo, type their initials and print.
// Everything is in inches on the template's own card, so templates work at any hole spacing.
//   photo: x, y, w, h
//   text:  slot (kept when switching templates), label (shown in "Your words"), text, cx, cy (center), h (letter size),
//          maxW / maxH: the box it must fit in; longer words shrink to fit
//   motif: motif id, cx, cy, h (target height; picks the nearest whole-stitch scale), rot, flip
//   frame: style, inset
import { MOTIFS } from './motifs.js';
import { boundsOf, snapStitch, gridOf } from './render.js';

const PHOTO = (x, y, w, h, extra = {}) => ({ type: 'photo', x, y, w, h, ...extra });

export const TEMPLATES = [
  {
    // The classic: an 8×10 frame, a landscape photo in the middle, initials in opposite corners.
    id: 'initials', name: 'Initials', note: 'photo + two initials',
    w: 8, h: 10, paper: '#5A1A20', thread: '#F1E6CF', font: 'viceroy',
    elements: [
      PHOTO(1.0, 3.0, 6.0, 4.0),
      { type: 'text', slot: 'i1', label: 'First initial', text: 'A', cx: 1.95, cy: 1.55, h: 2.5, maxW: 3.3, maxH: 2.4 },
      { type: 'text', slot: 'i2', label: 'Second initial', text: 'J', cx: 6.05, cy: 8.45, h: 2.5, maxW: 3.3, maxH: 2.4 },
      { type: 'motif', motif: 'twinkles', cx: 6.35, cy: 1.5, h: 1.1 },
      { type: 'motif', motif: 'sprig', cx: 1.6, cy: 8.45, h: 1.6 },
    ],
  },
  {
    id: 'words', name: 'Words', note: 'a line above & below',
    w: 8, h: 10, paper: '#FBF8F2', thread: '#C1121F', font: 'hand',
    elements: [
      PHOTO(1.75, 2.35, 4.5, 5.3),
      { type: 'text', slot: 'top', label: 'Top line', text: 'how lucky', cx: 4, cy: 1.15, h: 1.6, maxW: 7.2, maxH: 1.9 },
      { type: 'text', slot: 'bottom', label: 'Bottom line', text: 'are we', cx: 4, cy: 8.8, h: 1.6, maxW: 7.2, maxH: 1.8 },
    ],
  },
  {
    id: 'date', name: 'Initials & date', note: 'for anniversaries',
    w: 6, h: 8, paper: '#F0D5D1', thread: '#9E1B32', font: 'viceroy',
    elements: [
      PHOTO(0.8, 2.6, 4.4, 3.2),
      { type: 'text', slot: 'names', label: 'Initials or names', text: 'A + J', cx: 3, cy: 1.3, h: 2.5, maxW: 5.6, maxH: 2.3 },
      { type: 'text', slot: 'date', label: 'Date', text: '06.14.26', cx: 3, cy: 6.55, h: 1.0, font: 'hand', weight: 1, maxW: 4.5, maxH: 1.1 },
      { type: 'motif', motif: 'heart', cx: 3, cy: 7.45, h: 0.5 },
    ],
  },
  {
    id: 'rose', name: 'Rose', note: 'one big stitched rose',
    w: 6, h: 8, paper: '#FFFFFF', thread: '#C1121F', font: 'hand',
    elements: [
      PHOTO(3.3, 0.6, 2.3, 3.0),
      { type: 'motif', motif: 'long-rose', cx: 1.75, cy: 5.25, h: 4 },
      { type: 'text', slot: 'phrase', label: 'Words', text: 'forever', cx: 4.45, cy: 4.7, h: 1.25, maxW: 2.9, maxH: 1.5 },
    ],
  },
  {
    id: 'frame', name: 'Framed', note: 'folk border all around',
    w: 6, h: 6, paper: '#FBF8F2', thread: '#C1121F', font: 'hand',
    elements: [
      { type: 'frame', style: 'folk', inset: 0.25 },
      PHOTO(1.5, 0.85, 3.0, 3.0),
      { type: 'text', slot: 'phrase', label: 'Words', text: 'you & me', cx: 3, cy: 4.75, h: 1.25, maxW: 4.8, maxH: 1.4 },
    ],
  },
  {
    id: 'strip', name: 'Photo strip', note: 'three photos, one strip',
    w: 3.5, h: 10, paper: '#1F2A44', thread: '#C9A24A', font: 'hand',
    elements: [
      PHOTO(0.4, 0.4, 2.7, 2.1),
      PHOTO(0.4, 2.7, 2.7, 2.1),
      PHOTO(0.4, 5.0, 2.7, 2.1),
      { type: 'text', slot: 'names', label: 'Initials or names', text: 'A & J', cx: 1.75, cy: 8.05, h: 1.4, maxW: 3.0, maxH: 1.6 },
      { type: 'motif', motif: 'mini-hearts', cx: 1.75, cy: 9.25, h: 0.55 },
    ],
  },
  {
    id: 'collage', name: 'Collage', note: 'two photos, a phrase',
    w: 7, h: 5, paper: '#FFFFFF', thread: '#C1121F', font: 'hand',
    elements: [
      PHOTO(0.45, 0.85, 2.5, 3.3),
      PHOTO(2.45, 1.85, 1.85, 2.5),
      { type: 'motif', motif: 'lattice', cx: 0.95, cy: 0.95, h: 1.4 },
      { type: 'text', slot: 'phrase', label: 'Words', text: 'love,\nalways', cx: 5.5, cy: 1.9, h: 1.15, maxW: 2.9, maxH: 2.7 },
      { type: 'motif', motif: 'rose', cx: 5.6, cy: 3.95, h: 1.2 },
    ],
  },
  {
    id: 'blank', name: 'Blank', note: 'start from scratch',
    w: 5, h: 7, paper: '#FBF8F2', thread: '#C1121F', font: 'viceroy',
    elements: [],
  },
];

export const templateById = (id) => TEMPLATES.find((t) => t.id === id);

/** Shrinks template text (from its designed size) until it fits its box. */
export function fitText(doc, el) {
  if (el.type !== 'text' || !(el.maxW || el.maxH)) return;
  if (el.baseSize) el.size = el.baseSize;
  for (let i = 0; i < 40 && el.size > 6; i++) {
    const b = boundsOf(doc, el);
    if ((!el.maxW || b.w <= el.maxW + 1e-6) && (!el.maxH || b.h <= el.maxH + 1e-6)) break;
    el.size = Math.max(6, Math.floor(el.size * 0.93));
  }
}

function place(doc, el, cx, cy) {
  doc.elements.push(el);
  const b = boundsOf(doc, el);
  el.x = cx - b.w / 2;
  el.y = cy - b.h / 2;
  snapStitch(doc, el);
}

/**
 * Builds a design from a template.
 * texts: { slot: text } to carry over what the person already typed.
 */
export function buildTemplate(t, { pitch, texts = {}, uid, font = null }) {
  const doc = { w: t.w, h: t.h, pitch, paper: t.paper, grain: true, template: t.id, elements: [] };
  for (const s of t.elements) {
    if (s.type === 'photo') {
      doc.elements.push({
        id: uid(), type: 'photo', imgId: null, x: s.x, y: s.y, w: s.w, h: s.h,
        zoom: 1, panX: 0, panY: 0, filter: s.filter || 'classic', edge: s.edge || 'none', brightness: 0, contrast: 0,
      });
    } else if (s.type === 'text') {
      const size = Math.max(5, Math.round(s.h / pitch));
      const el = {
        id: uid(), type: 'text', slot: s.slot, label: s.label, text: texts[s.slot] ?? s.text,
        font: s.font || font || t.font, size, baseSize: size, maxW: s.maxW, maxH: s.maxH, weight: s.weight ?? 0,
        align: s.align || 'center', color: t.thread, x: 0, y: 0,
      };
      fitText(doc, el);
      place(doc, el, s.cx, s.cy);
    } else if (s.type === 'motif') {
      const m = MOTIFS.find((x) => x.id === s.motif);
      const natural = (s.rot % 2 ? Math.max(...m.rows.map((r) => r.length)) : m.rows.length) * pitch;
      place(doc, {
        id: uid(), type: 'motif', motif: s.motif, scale: Math.max(1, Math.round(s.h / natural)),
        rot: s.rot || 0, flip: !!s.flip, color: t.thread, x: 0, y: 0,
      }, s.cx, s.cy);
    } else if (s.type === 'frame') {
      const g = gridOf(doc);
      const ins = Math.round(s.inset / g.p);
      doc.elements.push({
        id: uid(), type: 'frame', style: s.style, cols: g.cols - ins * 2, rows: g.rows - ins * 2,
        color: t.thread, x: g.gx + ins * g.p, y: g.gy + ins * g.p,
      });
    }
  }
  return doc;
}
