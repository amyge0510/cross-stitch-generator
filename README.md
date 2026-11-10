# stitched !!

A free-canvas design tool for the cross-stitch-on-paper photo card trend: paste a photo onto heavy card stock, then stitch cursive words, initials and little motifs around it through punched holes.

Design it here, print the template at actual size, pierce the dots, stitch.

## What it does

Most people want something simple, so the steps are short and template-first:

1. **Pick a template**: recreations of real stitched cards: **How lucky** (“how lucky are we” around a black & white photo set off-center), **Monogram** (cream initials on a maroon mat), **You + me** (words over the photo with sparkles), or **Blank**.
2. **Size**: common card and frame sizes, or any custom size. Each template has its own layout for every card shape (wide strip, landscape, square, portrait, tall strip), and lettering is sized to fill its spot for the chosen font, so every size × font combination gets its own default. Rotating to portrait turns the photo frame too; the photo inside stays upright.
3. **Presets**: four preset looks: Classic, Maroon, Noir, Navy & gold.
4. **Paper** and **Thread**: pick from the swatches. Thread color applies to every stitch.
5. **Photo**: uploads fill the template's photo spots in order. Photo style (Original, Classic B&W, Soft B&W, Noir) applies to all photos, or to the one you tap on the card; a tapped photo can also change shape.
6. **Text**: one box per piece of text, plus **Add text**. Three lettering styles, all real hand-charted cross-stitch alphabets, one style per card: **Viceroy** (a flourished script), **Simple** (DMC's classic script with numbers) and **Gothic** (blackletter with numbers). Characters a style doesn't include come from Simple. Letters are always stitched from the chart; only the stitch size changes (1.5–4 mm). Past the largest stitch, each charted stitch becomes 2×2 (then 3×3) smaller stitches; when a very detailed chart (Viceroy) would need stitches finer than 1.5 mm, each 2×2 block of the chart becomes one regular stitch instead.

**Print punch template** (top right) prints an actual-size template with a dot at every hole to pierce and a faint X for each stitch. Options: photos, paper color and trim marks. You can also save a 300 dpi image from the print window.

Switching templates keeps your photos and text. Everything on the card can still be dragged, resized and rotated:

- **Select several**: Shift/Cmd-click, drag a box around pieces on empty paper, or Cmd+A for everything. They move, duplicate and delete together.
- **Alignment guides**: while dragging, pieces snap (with a pink guide line) when an edge or center lines up with another piece or the card's center.
- **Per-text settings live on each text's row**: its words, size (− / number / +) and thread color. Lettering, Colors, Paper, Thread and Photo style always change the whole card.

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
| `js/chartfonts.js` | The Viceroy, Simple and Gothic alphabets (plus the retired Antique), digitized square by square from their charts |
| `js/templates.js` | The template layout matrix (one layout per card shape) and text sizing |
| `js/motifs.js` | Motifs as pixel art (`X` = stitch): tiny hearts, sparkles, moon, plus a heart |
| `js/render.js` | Draws paper, photos, realistic thread stitches and hole dots onto any canvas |
| `js/filters.js` | Photo filters, computed per pixel |
| `js/print.js` | Punch template, stitch chart, print layout and PNG export |

## Credits & licenses

- **Viceroy** alphabet: digitized from a clean render of a flourished script chart (upper and lower case). Source and license unknown; confirm permission before commercial use.
- **Gothic** alphabet: digitized from a blackletter “Handmade with Love!” chart render. Source and license unknown; confirm permission before commercial use.
- **Simple** alphabet: digitized from a clean scan of DMC's “Alphabet et chiffres” chart in *La Broderie en Petit* (© DMC; confirm permission before commercial use). . , + & - ' ! ? were drawn to match.
