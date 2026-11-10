// Photo filters, computed per pixel so they look the same in every browser
// (CanvasRenderingContext2D.filter isn't available everywhere).

export const FILTERS = [
  { id: 'original', name: 'Original' },
  { id: 'classic', name: 'Classic B&W' },
  { id: 'soft', name: 'Soft B&W' },
  { id: 'noir', name: 'Noir' },
];

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

// Photos saved with filters that no longer exist simply show in original color.
function pixel(id, r, g, b) {
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  switch (id) {
    case 'classic': {
      const v = clamp((L - 128) * 1.12 + 128);
      return [v, v, v];
    }
    case 'soft': {
      const v = 34 + L * 0.8;
      return [v + 2, v, v - 2];
    }
    case 'noir': {
      const t = L / 255;
      const s = 1 / (1 + Math.exp(-9 * (t - 0.5)));
      const v = clamp(s * 265 - 5);
      return [v, v, v];
    }
    default: return [r, g, b];
  }
}

/**
 * Returns a canvas with the filter applied.
 * brightness, contrast in [-1, 1].
 */
export function applyFilter(source, srcW, srcH, id, brightness = 0, contrast = 0, maxSide = 1800) {
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale)), h = Math.max(1, Math.round(srcH * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  if (id === 'original' && !brightness && !contrast) return c;
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  const bAdd = brightness * 70;
  const cMul = 1 + contrast * 0.8;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    if (bAdd || contrast) {
      r = clamp((r - 128) * cMul + 128 + bAdd);
      g = clamp((g - 128) * cMul + 128 + bAdd);
      b = clamp((b - 128) * cMul + 128 + bAdd);
    }
    const o = pixel(id, r, g, b);
    d[i] = clamp(o[0]);
    d[i + 1] = clamp(o[1]);
    d[i + 2] = clamp(o[2]);
  }
  ctx.putImageData(data, 0, 0);
  return c;
}
