# stitched !!

A free-canvas design tool for the cross-stitch-on-paper photo card trend: paste a photo onto heavy card stock, then stitch cursive words, initials and little motifs around it through punched holes.

Design it here, print the template at actual size, pierce the dots, stitch.

## What it does

Most people want something simple, so the steps are short and template-first:

1. **Pick a template**: recreations of real stitched cards: **Initials** (red script initials on two corners of the photo), **Love note** (chunky words around a black & white photo, plus a heart), **Monogram** (cream initials on a maroon mat), **You + me** (thin script over the photo with sparkles), **Roses** (red rose sprigs up the side of a portrait photo), or **Blank**.
2. **Size**: common card and frame sizes, or any custom size. Each element remembers where it belongs relative to the card, so every size always gets the same layout, however often you switch.
3. **Colors**: four preset looks: Classic, Maroon, Noir, Navy & gold.
4. **Paper** and **Thread**: pick from the swatches. Thread color applies to every stitch.
5. **Photo**: uploads fill the template's photo spots in order. Photo style (Original, Classic B&W, Soft B&W, Noir) applies to all photos, or to the one you tap on the card; a tapped photo can also change shape.
6. **Text**: one box per piece of text, plus **Add text**. Three lettering styles, all real hand-charted cross-stitch alphabets stitched exactly as charted: **Viceroy** (elegant script), **Antique** (capitals) and **Simple** (a small sampler alphabet with numbers). Numbers and symbols Viceroy and Antique don't include come from Simple.

**Print punch template** (top right) prints page 1, an actual-size template with a dot at every hole to pierce, and page 2, a stitch chart. You can also save a 300 dpi image from the print window. Holes are spaced 14 per inch (1.8 mm).

Switching templates keeps your photos and text. Everything on the card can still be dragged, resized and layered.

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
| `js/chartfonts.js` | The Viceroy, Antique and Simple alphabets, digitized square by square from their charts |
| `js/templates.js` | The template layouts, built in inches so they work at any hole spacing |
| `js/motifs.js` | Motifs as pixel art (`X` = stitch): tiny hearts, sparkles, moon, plus the heart and rose sprig two templates use |
| `js/render.js` | Draws paper, photos, realistic thread stitches and hole dots onto any canvas |
| `js/filters.js` | Photo filters, computed per pixel |
| `js/print.js` | Punch template, stitch chart, print layout and PNG export |

## Credits & licenses

- **Antique** alphabet: charted by the [Antique Pattern Library](https://www.antiquepatternlibrary.org) (2023.11), licensed [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). The digitized letters in `js/chartfonts.js` are shared under the same license, so they can't be used commercially.
- **Viceroy** alphabet: digitized from the “Monograma Viceroy” chart. The original designer and license are unknown, so confirm permission before any commercial use.
- **Simple** alphabet: digitized from a “Handmade with Love!” sampler chart (source unknown, same caution). The . , + - ' ? characters were drawn to match.
