# stitched !!

A free-canvas design tool for the cross-stitch-on-paper photo card trend: paste a photo onto heavy card stock, then stitch cursive words, initials and little motifs around it through punched holes.

Design it here, print the template at actual size, pierce the dots, stitch.

## What it does

Most people want something simple, so the flow is template-first:

1. **Pick a template**: Initials (photo in the middle, initials in opposite corners, little embellishments in the others), Words, Initials & date, Rose, Framed, Photo strip, Collage, or Blank.
2. **Add your photo**: uploads fill the template's photo spots in order. One tap sets the photo style for all of them (Classic B&W, Soft B&W, Noir, Cool B&W, Sepia, Faded film, Rose mono, Cyanotype). Tap a photo on the card to crop, zoom or add a border.
3. **Your words**: type your initials, names or date into labeled fields; words shrink to fit their spot. Pick a lettering style: **Viceroy** and **Antique** are real hand-charted cross-stitch alphabets, stitched exactly as charted; **Handwritten** is a casual script for phrases. Numbers and symbols the charts don't include (&, +, dates) come from Handwritten.
4. **Colors**: preset looks or any hex color for paper and thread.
5. **Size & stitch**: card size, and hole spacing from 16 down to 8 holes per inch (default 14/in, 1.8 mm). Changing spacing keeps everything the same size on paper.
6. **Print & punch**: page 1 is the actual-size template with a dot at every hole to pierce; page 2 is a stitch chart with counts and a thread estimate. **Save image** exports a 300 dpi PNG.

Switching templates keeps your photos and words. For the few who want full control, **Make it your own** (collapsed at the bottom) adds free text, 20 stitched motifs and 4 frames, and everything on the card can be dragged, resized and layered.

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
| `js/stitch.js` | Lettering: charted alphabets set by letter shape, web font → stitches (with single-line thinning), motif and frame bitmaps |
| `js/chartfonts.js` | The Viceroy and Antique alphabets, digitized square by square from their charts |
| `js/templates.js` | The template layouts, built in inches so they work at any hole spacing |
| `js/motifs.js` | The motif library as pixel art (`X` = stitch) |
| `js/render.js` | Draws paper, photos, realistic thread stitches and hole dots onto any canvas |
| `js/filters.js` | Photo filters, computed per pixel |
| `js/print.js` | Punch template, stitch chart, print layout and PNG export |

## Credits & licenses

- **Antique** alphabet: charted by the [Antique Pattern Library](https://www.antiquepatternlibrary.org) (2023.11), licensed [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). The digitized letters in `js/chartfonts.js` are shared under the same license, so they can't be used commercially.
- **Viceroy** alphabet: digitized from the “Monograma Viceroy” chart. The original designer and license are unknown, so confirm permission before any commercial use.
