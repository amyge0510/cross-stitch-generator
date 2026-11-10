// Ready-made layouts, as a matrix: every template has a layout for each card shape (wide strip,
// landscape, square, portrait, tall strip). Positions are fractions of the card, so a layout fits any size
// of that shape; lettering is then sized to fill its box for whichever font is picked. The result: every
// paper size × font has its own default letter size and placement.
//   photo: box [x0, y0, x1, y1]
//   text:  box [x0, y0, x1, y1] the words are centered in and sized to fill; text (default words)
//          optional 5th item { under: 'w3', at: 1 }: shift sideways so this word's first letter sits
//          exactly under letter `at` of that other word (e.g. the w of "we" under the r of "are")
//   motif: at [cx, cy], h (height as a fraction of the card's shorter side)
import { MOTIFS } from './motifs.js';
import { boundsOf, snapStitch } from './render.js';
import { fontById, charLeft } from './stitch.js';

/** Which layout a card uses, from its proportions. */
export function shapeOf(w, h) {
  const r = w / h;
  if (r >= 2) return 'wide';
  if (r > 1.12) return 'land';
  if (r >= 0.89) return 'square';
  if (r > 0.5) return 'port';
  return 'tall';
}

// Recreations of real cards people have stitched (measured from reference photos), extended to every shape.
export const TEMPLATES = [
  {
    // "how lucky are we": a black & white photo set low and off-center, "how lucky" stacked above it
    // (lucky overlapping the photo's top edge) and "are … we" along its bottom edge. Measured from a
    // framed card; the photo is deliberately NOT centered.
    id: 'words', name: 'How lucky', w: 10, h: 8, paper: '#FFFFFF', thread: '#C1121F', font: 'simple', filter: 'classic',
    text: { w1: 'how', w2: 'lucky', w3: 'are', w4: 'we' },
    layouts: {
      land: { p1: [0.26, 0.32, 0.73, 0.79], w1: [0.10, 0.08, 0.46, 0.31], w2: [0.17, 0.26, 0.75, 0.57], w3: [0.08, 0.69, 0.44, 0.90], w4: [0.55, 0.67, 0.84, 0.88] },
      // 11×4: "how lucky" stacked at the left, a large photo right of center, "are" over the photo's
      // bottom-right corner with "we" below it, the w exactly under the r
      wide: { p1: [0.39, 0.12, 0.81, 0.88], w1: [0.03, 0.08, 0.27, 0.36], w2: [0.10, 0.29, 0.40, 0.70], w3: [0.70, 0.56, 0.92, 0.78], w4: [0.78, 0.74, 0.98, 0.95, { under: 'w3', at: 1 }] },
      square: { p1: [0.24, 0.36, 0.74, 0.82], w1: [0.08, 0.06, 0.45, 0.25], w2: [0.15, 0.21, 0.73, 0.48], w3: [0.05, 0.78, 0.40, 0.96], w4: [0.54, 0.76, 0.84, 0.94] },
      port: { p1: [0.18, 0.37, 0.80, 0.77], w1: [0.06, 0.06, 0.48, 0.19], w2: [0.13, 0.17, 0.81, 0.40], w3: [0.04, 0.77, 0.44, 0.93], w4: [0.56, 0.76, 0.88, 0.92] },
      // 4×11 portrait strip: "how lucky" at the top, a tall photo, "are" then "we" (stepped right) at the bottom
      tall: { p1: [0.105, 0.29, 0.89, 0.81], w1: [0.06, 0.025, 0.70, 0.13], w2: [0.13, 0.12, 0.95, 0.27], w3: [0.06, 0.835, 0.62, 0.915], w4: [0.48, 0.895, 0.95, 0.975] },
    },
  },
  {
    // Cream monogram initials on a maroon mat, overlapping two corners of a black & white photo.
    id: 'monogram', name: 'Monogram', w: 7, h: 5, paper: '#5A1A20', thread: '#F1E6CF', font: 'viceroy', filter: 'classic',
    text: { i1: 'A', i2: 'J' },
    layouts: {
      land: { p1: [0.19, 0.215, 0.81, 0.785], i1: [0.03, 0.03, 0.37, 0.41], i2: [0.63, 0.58, 0.97, 0.97] },
      wide: { p1: [0.34, 0.215, 0.66, 0.785], i1: [0.06, 0.05, 0.34, 0.62], i2: [0.66, 0.40, 0.94, 0.96] },
      square: { p1: [0.2, 0.22, 0.8, 0.78], i1: [0.03, 0.03, 0.40, 0.38], i2: [0.60, 0.62, 0.97, 0.97] },
      port: { p1: [0.21, 0.19, 0.79, 0.81], i1: [0.03, 0.03, 0.47, 0.30], i2: [0.53, 0.70, 0.97, 0.97] },
      tall: { p1: [0.14, 0.3, 0.86, 0.7], i1: [0.06, 0.04, 0.94, 0.28], i2: [0.06, 0.72, 0.94, 0.96] },
    },
  },
  {
    // A big color photo, "you + me" stitched over its corner, sparkles around.
    id: 'youme', name: 'You + me', w: 7, h: 5, paper: '#FFFFFF', thread: '#C1121F', font: 'simple', filter: 'original',
    text: { phrase: 'you\n+ me' },
    layouts: {
      land: { p1: [0.145, 0.17, 0.855, 0.83], phrase: [0.50, 0.38, 0.95, 0.92],
        s1: [0.76, 0.17, 0.1], s2: [0.56, 0.20, 0.072], s3: [0.83, 0.34, 0.072], s4: [0.44, 0.68, 0.072], s5: [0.21, 0.84, 0.1], s6: [0.30, 0.30, 0.072] },
      wide: { p1: [0.29, 0.12, 0.71, 0.88], phrase: [0.58, 0.20, 0.95, 0.92],
        s1: [0.65, 0.12, 0.1], s2: [0.46, 0.15, 0.072], s3: [0.94, 0.20, 0.072], s4: [0.40, 0.70, 0.072], s5: [0.18, 0.88, 0.1], s6: [0.28, 0.30, 0.072] },
      square: { p1: [0.13, 0.17, 0.87, 0.83], phrase: [0.48, 0.52, 0.95, 0.94],
        s1: [0.80, 0.14, 0.1], s2: [0.55, 0.16, 0.072], s3: [0.88, 0.32, 0.072], s4: [0.40, 0.72, 0.072], s5: [0.14, 0.82, 0.1], s6: [0.28, 0.32, 0.072] },
      port: { p1: [0.1, 0.22, 0.9, 0.78], phrase: [0.40, 0.52, 0.95, 0.94],
        s1: [0.82, 0.11, 0.1], s2: [0.52, 0.13, 0.072], s3: [0.91, 0.28, 0.072], s4: [0.30, 0.64, 0.072], s5: [0.12, 0.72, 0.1], s6: [0.24, 0.86, 0.072] },
      tall: { p1: [0.1, 0.265, 0.9, 0.735], phrase: [0.10, 0.58, 0.90, 0.90],
        s1: [0.82, 0.08, 0.1], s2: [0.20, 0.06, 0.072], s3: [0.92, 0.25, 0.072], s4: [0.15, 0.60, 0.072], s5: [0.15, 0.93, 0.1], s6: [0.85, 0.94, 0.072] },
    },
    motifs: { s1: 'sparkle', s2: 'sparkle-small', s3: 'sparkle-small', s4: 'sparkle-small', s5: 'sparkle', s6: 'sparkle-small' },
  },
  {
    id: 'blank', name: 'Blank', w: 7, h: 5, paper: '#FBF8F2', thread: '#C1121F', font: 'viceroy',
    text: {}, layouts: { land: {}, wide: {}, square: {}, port: {}, tall: {} },
  },
];

export const templateById = (id) => TEMPLATES.find((t) => t.id === id);

/** The layout spec for one template item at the doc's current shape. */
function specFor(t, doc, key) {
  return t.layouts[shapeOf(doc.w, doc.h)][key];
}

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

/**
 * Lays out text from scratch.
 *  - Template words (not hand-edited) are sized as large as fits their box on this card, for their font,
 *    and centered in it; words in the same template share the smallest of those sizes so they match.
 *  - Other text (added or hand-edited) keeps its home: center and size relative to the card.
 */
export function layoutTexts(doc, only = null) {
  const m = Math.min(doc.w, doc.h), p = doc.pitch;
  const t = templateById(doc.template);
  const all = doc.elements.filter((e) => e.type === 'text');
  const want = (e) => !only || only.includes(e) || (e.group && only.some((o) => o.group === e.group));
  const boxed = all.filter((e) => want(e) && t && e.tpl && !e.custom && specFor(t, doc, e.tpl));
  const sizes = new Map();
  for (const el of boxed) {
    const [x0, y0, x1, y1] = specFor(t, doc, el.tpl);
    const maxW = Math.min((x1 - x0) * doc.w, doc.w - 2 * EDGE_MARGIN), maxH = Math.min((y1 - y0) * doc.h, doc.h - 2 * EDGE_MARGIN);
    fitScale(doc, el, fontById(el.font), (maxH / p) * 1.6, maxW, maxH); // start big, shrink until it fits
    if (el.group) sizes.set(el.group, Math.min(sizes.get(el.group) ?? Infinity, el.size));
  }
  for (const el of boxed) {
    if (el.group) el.size = sizes.get(el.group);
    el.baseSize = el.size;
    const [x0, y0, x1, y1] = specFor(t, doc, el.tpl);
    const b = boundsOf(doc, el);
    el.x = ((x0 + x1) / 2) * doc.w - b.w / 2;
    el.y = ((y0 + y1) / 2) * doc.h - b.h / 2;
    snapStitch(doc, el);
    keepInside(doc, el);
  }
  for (const el of boxed) {
    const opt = specFor(t, doc, el.tpl)[4];
    const ref = opt && boxed.find((o) => o.tpl === opt.under);
    if (!ref || String(ref.text).length <= opt.at) continue;
    el.x = ref.x + charLeft(ref, opt.at) - charLeft(el, 0);
    keepInside(doc, el);
  }
  for (const el of all) {
    if (!want(el) || boxed.includes(el) || !el.home) continue;
    const H = el.home;
    const S = (H.k * m) / p;
    el.baseSize = S;
    const maxW = Math.min(H.mw ? H.mw * m : Infinity, doc.w - 2 * EDGE_MARGIN);
    const maxH = Math.min(H.mh ? H.mh * m : Infinity, doc.h - 2 * EDGE_MARGIN);
    fitScale(doc, el, fontById(el.font), S, maxW, maxH);
    const b = boundsOf(doc, el);
    el.x = H.cx * doc.w - b.w / 2;
    el.y = H.cy * doc.h - b.h / 2;
    snapStitch(doc, el);
    keepInside(doc, el);
  }
}

/**
 * Puts every template-owned piece back at this card's default layout (photo frames, motifs, words).
 * Hand edits are cleared: each card size starts from its own defaults. Photos keep their picture,
 * filter, crop and rotation; the frame is re-shaped for the card (a portrait card gets a portrait frame).
 */
export function applyLayout(doc) {
  const t = templateById(doc.template);
  if (!t) return;
  const m = Math.min(doc.w, doc.h);
  for (const el of doc.elements) {
    if (!el.tpl) continue;
    const spec = specFor(t, doc, el.tpl);
    if (!spec) continue;
    delete el.custom;
    delete el.home;
    if (el.type === 'photo') {
      const [x0, y0, x1, y1] = spec;
      Object.assign(el, { x: x0 * doc.w, y: y0 * doc.h, w: (x1 - x0) * doc.w, h: (y1 - y0) * doc.h });
    } else if (el.type === 'motif') {
      const [cx, cy, hf] = spec;
      const target = hf * m;
      const mo = MOTIFS.find((x) => x.id === el.motif);
      el.scale = Math.max(0.5, target / (mo.rows.length * doc.pitch));
      const b = boundsOf(doc, el);
      el.x = cx * doc.w - b.w / 2;
      el.y = cy * doc.h - b.h / 2;
      snapStitch(doc, el);
      keepInside(doc, el);
    }
  }
  layoutTexts(doc);
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
 * Builds a design from a template at its default card size.
 * texts: { slot: text } to carry over what the person already typed.
 */
export function buildTemplate(t, { pitch, texts = {}, uid }) {
  const doc = { w: t.w, h: t.h, pitch, paper: t.paper, grain: true, template: t.id, elements: [] };
  const keys = Object.keys(t.layouts.land);
  for (const key of keys.filter((k) => /^p\d/.test(k))) {
    doc.elements.push({
      id: uid(), type: 'photo', tpl: key, imgId: null, x: 0, y: 0, w: 1, h: 1,
      zoom: 1, panX: 0, panY: 0, filter: t.filter || 'classic', edge: 'none', brightness: 0, contrast: 0,
    });
  }
  for (const key of keys.filter((k) => k in (t.motifs || {}))) {
    doc.elements.push({ id: uid(), type: 'motif', tpl: key, motif: t.motifs[key], scale: 1, rot: 0, flip: false, color: t.thread, x: 0, y: 0 });
  }
  for (const [slot, text] of Object.entries(t.text)) {
    doc.elements.push({
      id: uid(), type: 'text', tpl: slot, slot, group: 'template', text: texts[slot] ?? text,
      font: t.font, size: 10, weight: 0, align: 'center', color: t.thread, x: 0, y: 0,
    });
  }
  applyLayout(doc);
  return doc;
}
