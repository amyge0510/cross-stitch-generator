// Stitched motif library.
// Each motif is pixel art: "X" = one cross stitch, "." = bare paper.

const art = (s) => s.trim().split('\n').map((r) => r.trim());

export const MOTIFS = [
  {
    id: 'mini-hearts', name: 'Tiny hearts',
    rows: art(`
      .XX.XX.........
      XXXXXXX........
      .XXXXX.........
      ..XXX....XX.XX.
      ...X....XXXXXXX
      .........XXXXX.
      ..........XXX..
      ...........X...
    `),
  },
  {
    // the little starbursts from the "you + me" card
    id: 'sparkle', name: 'Sparkle',
    rows: art(`
      X..X..X
      .X.X.X.
      ..XXX..
      XXXXXXX
      ..XXX..
      .X.X.X.
      X..X..X
    `),
  },
  {
    id: 'sparkle-small', name: 'Small sparkle',
    rows: art(`
      ..X..
      X.X.X
      .XXX.
      X.X.X
      ..X..
    `),
  },
  {
    id: 'moon', name: 'Moon',
    rows: art(`
      ....XXXX..
      ..XXXX....
      .XXXX.....
      XXXX......
      XXXX......
      XXXX......
      XXXX......
      XXXX......
      .XXXX.....
      ..XXXX....
      ....XXXX..
    `),
  },

  // ---- used by specific templates only ----
  {
    id: 'heart', name: 'Heart', templateOnly: true,
    rows: art(`
      .XX...XX.
      XXXX.XXXX
      XXXXXXXXX
      XXXXXXXXX
      .XXXXXXX.
      ..XXXXX..
      ...XXX...
      ....X....
    `),
  },
  {
    // blocky rose with a leafy stem, as on the "Roses" card
    id: 'rose-sprig', name: 'Rose', templateOnly: true,
    rows: art(`
      ....XXXXX....
      ..XXXXXXXXX..
      .XXX.....XXX.
      XXX.XXXXX.XXX
      XX.XX...XX.XX
      XX.X..X..X.XX
      XX.XX.XX.X.XX
      XXX.XX..XX.XX
      .XXX..XX..XX.
      .XXXXX..XXXX.
      ..XXXXXXXXX..
      ....XXXXX....
      ......X......
      .XX...X......
      XXXX..X......
      XXXXX.X......
      .XXXXXX......
      ...XXXX...XX.
      ......X..XXXX
      ......X.XXXXX
      ......XXXXXX.
      ......XXXX...
      ......X......
      .XX...X......
      XXXX..X......
      XXXXX.X......
      .XXXXXX......
      ......X......
      ......X......
    `),
  },
];

// No frames in the current template set (the rendering code still supports them).
export const FRAMES = [];
