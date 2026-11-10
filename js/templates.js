// Ready-made layouts. Most people pick one, add a photo, type their words and print.
// Everything is in inches on the template's own card, so templates work at any hole spacing.
//   photo: x, y, w, h
//   text:  slot (kept when switching templates), text, cx, cy (center), h (letter size), weight,
//          maxW / maxH: the box it must fit in; longer words shrink to fit
//   motif: motif id, cx, cy, h (target height; picks the nearest whole-stitch scale), rot, flip
//   frame: style, inset (supported, though no current template uses one)
import { MOTIFS } from './motifs.js';
import { boundsOf, snapStitch, gridOf } from './render.js';
import { fontById } from './stitch.js';

const PHOTO = (x, y, w, h, extra = {}) => ({ type: 'photo', x, y, w, h, ...extra });

// Recreations of real cards people have stitched. Positions were measured from reference photos.
export const TEMPLATES = [
  {
    // "where love grows": chunky words around a black & white photo, and a little heart.
    // Simple lettering at its charted size, tucked against the photo's edges.
    id: 'words', name: 'Love note',
    w: 10, h: 8, paper: '#FFFFFF', thread: '#C1121F', font: 'simple',
    elements: [
      PHOTO(3.0, 2.1, 4.6, 3.5, { filter: 'classic' }),
      { type: 'text', slot: 'w1', text: 'where', cx: 3.25, cy: 2.0, h: 2.5, maxW: 5.0, maxH: 2.0 },
      { type: 'text', slot: 'w2', text: 'love', cx: 8.35, cy: 2.45, h: 2.5, maxW: 3.6, maxH: 2.0 },
      { type: 'text', slot: 'w3', text: 'grows', cx: 6.35, cy: 5.75, h: 2.5, maxW: 4.8, maxH: 2.0 },
      { type: 'motif', motif: 'heart', cx: 2.45, cy: 4.75, h: 0.55 },
    ],
  },
  {
    // Cream monogram initials on a maroon mat around a black & white wedding photo.
    id: 'monogram', name: 'Monogram',
    w: 7, h: 5, paper: '#5A1A20', thread: '#F1E6CF', font: 'viceroy',
    elements: [
      PHOTO(1.32, 0.93, 4.34, 2.87, { filter: 'classic' }),
      { type: 'text', slot: 'i1', text: 'A', cx: 1.4, cy: 1.09, h: 2.5, maxW: 2.8, maxH: 1.9 },
      { type: 'text', slot: 'i2', text: 'J', cx: 5.6, cy: 3.85, h: 2.5, maxW: 2.8, maxH: 1.9 },
    ],
  },
  {
    // A big color photo, "you + me" stitched over its corner, sparkles around.
    id: 'youme', name: 'You + me',
    w: 7, h: 5, paper: '#FFFFFF', thread: '#C1121F', font: 'simple',
    elements: [
      PHOTO(0.83, 0.87, 5.0, 3.3, { filter: 'original' }),
      { type: 'text', slot: 'phrase', text: 'you\n+ me', cx: 4.7, cy: 3.0, h: 2.5, maxW: 3.4, maxH: 3.6 },
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

/*
 * Text layout is computed fresh from three things, never from the previous layout:
 *   the words, the lettering style, and the text's home on the card:
 *   home = { cx, cy: center as a fraction of the card; k: designed letter size as a fraction of the
 *            card's shorter side; mw, mh: the box it must fit in, same units }.
 * So switching fonts, card sizes or templates can never make text drift or shrink step by step.
 * Every lettering style gets the same default letter height for a given card size (Viceroy's charted
 * size on the default templates). Smaller charts are enlarged with their stroke weight kept, and
 * anything only shrinks if the words can't fit. Texts that share a `group` (a template's words) share one size.
 */
/** Default layouts keep stitching at least this far (inches) inside the card edge. */
export const EDGE_MARGIN = 0.3;

/** Nudges a stitched element so it sits at least EDGE_MARGIN inside the card. */
export function keepInside(doc, el) {
  const M = EDGE_MARGIN;
  const b = boundsOf(doc, el);
  if (b.w <= doc.w - 2 * M) el.x += Math.max(0, M - b.x) - Math.max(0, b.x + b.w - (doc.w - M));
  else el.x += doc.w / 2 - (b.x + b.w / 2);
  if (b.h <= doc.h - 2 * M) el.y += Math.max(0, M - b.y) - Math.max(0, b.y + b.h - (doc.h - M));
  else el.y += doc.h / 2 - (b.y + b.h / 2);
  snapStitch(doc, el);
  // snapping can push it back over by a fraction of a stitch; step in by one if so
  const c = boundsOf(doc, el);
  if (c.x < M - 1e-6 && c.w <= doc.w - 2 * M) el.x += doc.pitch;
  if (c.x + c.w > doc.w - M + 1e-6 && c.w <= doc.w - 2 * M) el.x -= doc.pitch;
  if (c.y < M - 1e-6 && c.h <= doc.h - 2 * M) el.y += doc.pitch;
  if (c.y + c.h > doc.h - M + 1e-6 && c.h <= doc.h - 2 * M) el.y -= doc.pitch;
  snapStitch(doc, el);
}

/** Sets the text to its default size S, shrinking only if it can't fit its box. Returns size / S. */
function fitScale(doc, el, f, S, maxW, maxH) {
  const fits = () => {
    const b = boundsOf(doc, el);
    return (!maxW || b.w <= maxW + 1e-6) && (!maxH || b.h <= maxH + 1e-6);
  };
  el.size = Math.max(6, Math.round(S));
  while (el.size > 6 && !fits()) el.size = Math.max(6, Math.min(el.size - 1, Math.floor(el.size * 0.96)));
  return el.size / Math.max(1, S);
}

export function layoutTexts(doc, only = null) {
  const m = Math.min(doc.w, doc.h), p = doc.pitch;
  const texts = doc.elements.filter((e) => e.type === 'text' && e.home && (!only || only.includes(e) || (e.group && only.some((o) => o.group === e.group))));
  const scales = new Map();
  for (const el of texts) {
    const H = el.home, f = fontById(el.font);
    const S = (H.k * m) / p;
    el.baseSize = S;
    // the box it fits in never extends past the card's margins
    const maxW = Math.min(H.mw ? H.mw * m : Infinity, doc.w - 2 * EDGE_MARGIN);
    const maxH = Math.min(H.mh ? H.mh * m : Infinity, doc.h - 2 * EDGE_MARGIN);
    const sc = fitScale(doc, el, f, S, maxW, maxH);
    if (el.group) scales.set(el.group, Math.min(scales.get(el.group) ?? Infinity, sc));
  }
  for (const el of texts) {
    if (el.group) el.size = Math.max(6, Math.round(el.baseSize * scales.get(el.group)));
    const b = boundsOf(doc, el);
    el.x = el.home.cx * doc.w - b.w / 2;
    el.y = el.home.cy * doc.h - b.h / 2;
    snapStitch(doc, el);
    keepInside(doc, el);
  }
}

function place(doc, el, cx, cy) {
  doc.elements.push(el);
  const b = boundsOf(doc, el);
  el.x = cx - b.w / 2;
  el.y = cy - b.h / 2;
  snapStitch(doc, el);
  keepInside(doc, el);
}

/**
 * Builds a design from a template.
 * texts: { slot: text } to carry over what the person already typed.
 */
export function buildTemplate(t, { pitch, texts = {}, uid }) {
  const doc = { w: t.w, h: t.h, pitch, paper: t.paper, grain: true, template: t.id, elements: [] };
  for (const s of t.elements) {
    if (s.type === 'photo') {
      doc.elements.push({
        id: uid(), type: 'photo', imgId: null, x: s.x, y: s.y, w: s.w, h: s.h,
        zoom: 1, panX: 0, panY: 0, filter: s.filter || 'classic', edge: s.edge || 'none', brightness: 0, contrast: 0,
      });
    } else if (s.type === 'text') {
      const m = Math.min(t.w, t.h);
      doc.elements.push({
        id: uid(), type: 'text', slot: s.slot, group: 'template', text: texts[s.slot] ?? s.text,
        font: s.font || t.font, size: 10, weight: s.weight ?? 0, align: s.align || 'center', color: t.thread, x: 0, y: 0,
        home: { cx: s.cx / t.w, cy: s.cy / t.h, k: s.h / m, mw: s.maxW / m, mh: s.maxH / m },
      });
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
  layoutTexts(doc);
  return doc;
}
