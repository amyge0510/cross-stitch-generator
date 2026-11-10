// Ready-made layouts. Most people pick one, add a photo, type their words and print.
// Everything is in inches on the template's own card, so templates work at any hole spacing.
//   photo: x, y, w, h
//   text:  slot (kept when switching templates), text, cx, cy (center), h (letter size), weight,
//          maxW / maxH: the box it must fit in; longer words shrink to fit
//   motif: motif id, cx, cy, h (target height; picks the nearest whole-stitch scale), rot, flip
//   frame: style, inset (supported, though no current template uses one)
import { MOTIFS } from './motifs.js';
import { boundsOf, snapStitch, gridOf } from './render.js';

const PHOTO = (x, y, w, h, extra = {}) => ({ type: 'photo', x, y, w, h, ...extra });

// Recreations of real cards people have stitched. Positions were measured from reference photos.
export const TEMPLATES = [
  {
    // "where love grows": chunky words around a black & white photo, and a little heart.
    // Simple lettering at exactly 2× its charted size, kept off the photo so every word reads clearly.
    id: 'words', name: 'Love note',
    w: 10, h: 8, paper: '#FFFFFF', thread: '#C1121F', font: 'simple',
    elements: [
      PHOTO(3.0, 2.1, 4.6, 3.5, { filter: 'classic' }),
      { type: 'text', slot: 'w1', text: 'where', cx: 2.75, cy: 1.2, h: 1.57, maxW: 5.0, maxH: 1.75 },
      { type: 'text', slot: 'w2', text: 'love', cx: 8.15, cy: 1.75, h: 1.57, maxW: 3.6, maxH: 1.75 },
      { type: 'text', slot: 'w3', text: 'grows', cx: 6.35, cy: 6.6, h: 1.57, maxW: 4.8, maxH: 1.75 },
      { type: 'motif', motif: 'heart', cx: 2.05, cy: 4.9, h: 0.85 },
    ],
  },
  {
    // Cream monogram initials on a maroon mat around a black & white wedding photo.
    id: 'monogram', name: 'Monogram',
    w: 7, h: 5, paper: '#5A1A20', thread: '#F1E6CF', font: 'viceroy',
    elements: [
      PHOTO(1.32, 0.93, 4.34, 2.87, { filter: 'classic' }),
      { type: 'text', slot: 'i1', text: 'A', cx: 1.22, cy: 1.09, h: 2.5, maxW: 2.2, maxH: 1.9 },
      { type: 'text', slot: 'i2', text: 'J', cx: 5.83, cy: 3.82, h: 2.5, maxW: 2.2, maxH: 1.9 },
    ],
  },
  {
    // A big color photo, "you + me" stitched over its corner, sparkles around.
    id: 'youme', name: 'You + me',
    w: 7, h: 5, paper: '#FFFFFF', thread: '#C1121F', font: 'simple',
    elements: [
      PHOTO(0.83, 0.87, 5.0, 3.3, { filter: 'original' }),
      { type: 'text', slot: 'phrase', text: 'you\n+ me', cx: 4.7, cy: 3.0, h: 1.6, maxW: 3.4, maxH: 3.6 },
      { type: 'motif', motif: 'sparkle', cx: 5.33, cy: 0.87, h: 0.5 },
      { type: 'motif', motif: 'sparkle-small', cx: 3.89, cy: 1.0, h: 0.36 },
      { type: 'motif', motif: 'sparkle-small', cx: 5.8, cy: 1.68, h: 0.36 },
      { type: 'motif', motif: 'sparkle-small', cx: 3.09, cy: 3.4, h: 0.36 },
      { type: 'motif', motif: 'sparkle', cx: 1.44, cy: 4.18, h: 0.5 },
      { type: 'motif', motif: 'sparkle-small', cx: 3.91, cy: 3.85, h: 0.36 },
    ],
  },
  {
    id: 'blank', name: 'Blank',
    w: 7, h: 5, paper: '#FBF8F2', thread: '#C1121F', font: 'viceroy',
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
