# stitched !!

A free-canvas design tool for the cross-stitch-on-paper photo card trend: paste a photo onto heavy card stock, then stitch cursive words, initials and little motifs around it through punched holes.

Design it here, print the template at actual size, pierce the dots, stitch.

## What it does

1. **Choose the canvas**: 3×4, 4×6, 5×7, 6×6, 8×10, 4×11 or any custom size, plus hole spacing (10, 8, 6 or 5 holes per inch).
2. **Add photos**: upload or drag them onto the card. Move, resize, crop/reposition, change the shape, add a white edge, and pick a filter (Classic B&W, Soft B&W, Noir, Cool B&W, Sepia, Faded film, Rose mono, Cyanotype) with brightness and contrast.
3. **Write something** in 5 script styles (Elegant, Casual, Bubbly, Retro, Serif italic). Text is turned into stitches; “Single line” thins every letter to one stitch wide, the classic look.
4. **Add stitched motifs**: 20 motifs (hearts, roses, tulip, daisy, sprigs, sparkles, moon, butterfly, cherries, bow, geometric patterns) plus 4 resizable frames. Resize, rotate and flip.
5. **Paper & thread**: aesthetic presets (“looks”) or any hex color for the paper and each piece of thread.
6. **Print & punch**: page 1 is the actual-size template with a dot at every hole to pierce (optionally with the photos, a faint stitch guide, paper color and trim marks); page 2 is a stitch chart with counts and a thread estimate. **Save image** exports a 300 dpi PNG for sharing.

Everything runs in the browser; photos never leave the device. The design is autosaved to local storage, with undo/redo (⌘Z / ⇧⌘Z).

Shortcuts: arrows nudge (Shift = ×5), Delete removes, ⌘D duplicates, Esc deselects, double-click a photo to crop.

## Run locally

It's a static site with no build step:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. (Opening `index.html` directly from disk won't work because ES modules need a server.)

## Deploy

On Vercel, import the repo with the **Other** preset and no build command; every push to `main` redeploys.

## Code map

| File | What's in it |
| --- | --- |
| `index.html`, `styles.css` | Layout: canvas on the left, numbered steps on the right |
| `js/app.js` | State, undo/redo, autosave, canvas interaction (select, drag, resize, crop), panel controls |
| `js/stitch.js` | Fonts, text → stitch rasterizing (with thinning for single-line), motif and frame bitmaps |
| `js/motifs.js` | The motif library as pixel art (`X` = stitch) |
| `js/render.js` | Draws paper, photos, realistic thread stitches and hole dots onto any canvas |
| `js/filters.js` | Photo filters, computed per pixel |
| `js/print.js` | Punch template, stitch chart, print layout and PNG export |
