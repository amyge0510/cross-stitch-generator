# stitched !!

A free-canvas design tool for the cross-stitch-on-paper photo card trend: paste a photo onto heavy card stock, then stitch cursive words, initials and little motifs around it through punched holes.

Design it here, print the template at actual size, pierce the dots, stitch.

## What it does

Most people want something simple, so the steps are short and template-first:

1. **Pick a template**: recreations of real stitched cards: **How lucky** (“how lucky are we” around a black & white photo set off-center), **Monogram** (cream initials on a maroon mat), **You + me** (words over the photo with sparkles), or **Blank**.
2. **Size**: common card and frame sizes, or any custom size. Each template has its own layout for every card shape (wide strip, landscape, square, portrait, tall strip), and lettering is sized to fill its spot for the chosen font, so every size × font combination gets its own default. Rotating to portrait turns the photo frame too; the photo inside stays upright.
3. **Colors**: four preset looks: Classic, Maroon, Noir, Navy & gold.
4. **Paper** and **Thread**: pick from the swatches. Thread color applies to every stitch.
5. **Photo**: uploads fill the template's photo spots in order. Photo style (Original, Classic B&W, Soft B&W, Noir) applies to all photos, or to the one you tap on the card; a tapped photo can also change shape.
6. **Text**: one box per piece of text, plus **Add text**. Three lettering styles, all real hand-charted cross-stitch alphabets stitched exactly as charted: **Viceroy** (elegant script), **Antique** (a flourished script, upper and lower case) and **Simple** (DMC's classic script with numbers). Numbers and symbols Viceroy and Antique don't include come from Simple. Letters are always stitched exactly as charted; only the stitch size changes (1–2.8 mm). Past the largest stitch, each charted stitch becomes 2×2 (then 3×3) smaller stitches, so big letters are the same picture stitched finer.

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
| `js/templates.js` | The template layout matrix (one layout per card shape) and text sizing |
| `js/motifs.js` | Motifs as pixel art (`X` = stitch): tiny hearts, sparkles, moon, plus a heart |
| `js/render.js` | Draws paper, photos, realistic thread stitches and hole dots onto any canvas |
| `js/filters.js` | Photo filters, computed per pixel |
| `js/print.js` | Punch template, stitch chart, print layout and PNG export |

## Credits & licenses

- **Antique** alphabet: digitized from a Brazilian magazine script chart (“Medida do bordado em pontos”, 104 × 127). Source and license unknown; confirm permission before commercial use.
- **Viceroy** alphabet: digitized from the “Monograma Viceroy” chart. The original designer and license are unknown, so confirm permission before any commercial use.
- **Simple** alphabet: digitized from a clean scan of DMC's “Alphabet et chiffres” chart in *La Broderie en Petit* (© DMC; confirm permission before commercial use). . , + & - ' ! ? were drawn to match.
