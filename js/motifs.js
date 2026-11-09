// Stitched motif library.
// Each motif is pixel art: "X" = one cross stitch, "." = bare paper.
// Geometric motifs are generated from a small function instead of drawn by hand.

const art = (s) => s.trim().split('\n').map((r) => r.trim());

function generate(w, h, fn) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) r += fn(x, y) ? 'X' : '.';
    rows.push(r);
  }
  return rows;
}

export const MOTIFS = [
  {
    id: 'heart', name: 'Heart', group: 'love',
    rows: art(`
      ..XXX.XXX..
      .XXXXXXXXX.
      XXXXXXXXXXX
      XXXXXXXXXXX
      XXXXXXXXXXX
      .XXXXXXXXX.
      ..XXXXXXX..
      ...XXXXX...
      ....XXX....
      .....X.....
    `),
  },
  {
    id: 'heart-outline', name: 'Open heart', group: 'love',
    rows: art(`
      ..XXX...XXX..
      .X...X.X...X.
      X.....X.....X
      X...........X
      X...........X
      .X.........X.
      ..X.......X..
      ...X.....X...
      ....X...X....
      .....X.X.....
      ......X......
    `),
  },
  {
    id: 'mini-hearts', name: 'Tiny hearts', group: 'love',
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
    id: 'bow', name: 'Bow', group: 'love',
    rows: art(`
      .XXX.......XXX.
      X...XX...XX...X
      X.....X.X.....X
      X....XXXXX....X
      X.....X.X.....X
      X...XX...XX...X
      .XXX.X...X.XXX.
      ....X.....X....
      ...X.......X...
      ..XX.......XX..
    `),
  },
  {
    id: 'rose', name: 'Rose', group: 'flowers',
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
      .XX...X...XX.
      XXXX..X..XXXX
      .XXXX.X.XXXX.
      ...XXXXXXX...
      ......X......
    `),
  },
  {
    id: 'long-rose', name: 'Long-stem rose', group: 'flowers',
    rows: art(`
      .......XXXXX.......
      .....XXXXXXXXX.....
      ....XXX.....XXX....
      ...XXX.XXXXX.XXX...
      ...XX.XX...XX.XX...
      ...XX.X..X..X.XX...
      ...XX.XX.XX.X.XX...
      ...XXX.XX..XX.XX...
      ....XXX..XX..XX....
      ....XXXXX..XXXX....
      .....XXXXXXXXX.....
      ...X...XXXXX...X...
      ...XX....X....XX...
      ....XXX..X..XXX....
      ......XX.X.XX......
      .........X.........
      .XXX.....X.........
      XXXXX....X.........
      XXXXXX...X...XXX...
      .XXXXXX..X..XXXXX..
      ...XXXXX.X.XXXXXX..
      ......XX.X.XXXXX...
      ........XX.XXX.....
      .........XX........
      .........X.........
      .........X.........
      ........XX.........
      .........X.........
    `),
  },
  {
    id: 'rosebud', name: 'Rosebud', group: 'flowers',
    rows: art(`
      ...XXX...
      ..XXXXX..
      .XXX.XXX.
      .XX.X.XX.
      .XXX.XXX.
      ..XXXXX..
      X..XXX..X
      XX..X..XX
      .XX.X.XX.
      ..XXXXX..
      ....X....
      .XX.X....
      XXXXX....
      .XX.X....
      ....X....
      ....X....
    `),
  },
  {
    id: 'tulip', name: 'Tulip', group: 'flowers',
    rows: art(`
      X...X...X
      XX.XXX.XX
      XXXXXXXXX
      XXXXXXXXX
      XXXXXXXXX
      .XXXXXXX.
      ..XXXXX..
      ....X....
      ....X....
      XX..X..XX
      .XX.X.XX.
      ..XXXXX..
      ....X....
      ....X....
      ....X....
    `),
  },
  {
    id: 'daisy', name: 'Daisy', group: 'flowers',
    rows: generate(15, 15, (x, y) => {
      const dx = x - 7, dy = y - 7, r = Math.hypot(dx, dy);
      if (r <= 1.5) return true;
      if (r < 2.6 || r > 7.2) return false;
      const a = Math.atan2(dy, dx), step = Math.PI / 4;
      const off = Math.abs(a - Math.round(a / step) * step);
      return off * r < 1.05;
    }),
  },
  {
    id: 'blossom', name: 'Little blossom', group: 'flowers',
    rows: generate(11, 11, (x, y) => {
      const dx = x - 5, dy = y - 5;
      if (Math.hypot(dx, dy) < 0.9) return true;
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
        const px = Math.cos(a) * 3.1, py = Math.sin(a) * 3.1;
        if (Math.hypot(dx - px, dy - py) < 1.9) return true;
      }
      return false;
    }),
  },
  {
    id: 'sprig', name: 'Leafy sprig', group: 'plants',
    rows: art(`
      ....X....
      ...XXX...
      ....X....
      XX..X..XX
      XXX.X.XXX
      .XXXXXXX.
      ....X....
      XX..X..XX
      XXX.X.XXX
      .XXXXXXX.
      ....X....
      XX..X..XX
      XXX.X.XXX
      .XXXXXXX.
      ....X....
      ....X....
    `),
  },
  {
    id: 'laurel', name: 'Laurel', group: 'plants',
    rows: art(`
      ..........XX.
      .........XXXX
      ....XX..X.XX.
      ...XXXX.X....
      ....XXXX.....
      .......X..XX.
      ..XX..X..XXXX
      .XXXX.X.XXXX.
      ..XXXXX......
      ......X..XX..
      .XX..X..XXXX.
      XXXX.X.XXXX..
      .XXXXX.......
      .....X.......
      ....X........
    `),
  },
  {
    id: 'sparkle', name: 'Sparkle', group: 'sky',
    rows: art(`
      ....X....
      ....X....
      ...XXX...
      ..XXXXX..
      XXXXXXXXX
      ..XXXXX..
      ...XXX...
      ....X....
      ....X....
    `),
  },
  {
    id: 'star', name: 'Star', group: 'sky',
    rows: art(`
      .....X.....
      ....XXX....
      ....XXX....
      XXXXXXXXXXX
      .XXXXXXXXX.
      ..XXXXXXX..
      ...XXXXX...
      ..XXXXXXX..
      ..XXX.XXX..
      .XX.....XX.
      .X.......X.
    `),
  },
  {
    id: 'twinkles', name: 'Twinkles', group: 'sky',
    rows: art(`
      ..X..........
      .XXX.........
      ..X......X...
      .........X...
      .......XXXXX.
      .........X...
      ...X.....X...
      ..XXX........
      ...X.......X.
      ..........XXX
      ...........X.
    `),
  },
  {
    id: 'moon', name: 'Moon', group: 'sky',
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
  {
    id: 'butterfly', name: 'Butterfly', group: 'cute',
    rows: art(`
      ...X.....X...
      ....X...X....
      .XXX.X.X.XXX.
      XXXXX.X.XXXXX
      XXXXXXXXXXXXX
      XXXXXXXXXXXXX
      .XXXXXXXXXXX.
      ...XXXXXXX...
      ..XXXXXXXXX..
      .XXXXX.XXXXX.
      .XXXX...XXXX.
      ..XX.....XX..
    `),
  },
  {
    id: 'cherries', name: 'Cherries', group: 'cute',
    rows: art(`
      ........XXX.
      .......XXXXX
      ......X.XX..
      .....X......
      ....X.X.....
      ...X...X....
      ..X.....X...
      .XXX...XXX..
      XXXXX.XXXXX.
      XXXXX.XXXXX.
      XXXXX.XXXXX.
      .XXX...XXX..
    `),
  },
  {
    id: 'lattice', name: 'Diamond lattice', group: 'geometric',
    rows: generate(19, 19, (x, y) => {
      if (Math.abs(x - 9) + Math.abs(y - 9) > 10) return false;
      const isCenter = (cx, cy) => (cx % 4 === 1 && cy % 4 === 1) || (cx % 4 === 3 && cy % 4 === 3);
      const inside = (cx, cy) => Math.abs(cx - 9) + Math.abs(cy - 9) <= 9;
      return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) =>
        isCenter(x + ox, y + oy) && inside(x + ox, y + oy));
    }),
  },
  {
    id: 'folk', name: 'Folk flower', group: 'geometric',
    rows: art(`
      .....X.....
      ....XXX....
      .....X.....
      ..X..X..X..
      .XXX.X.XXX.
      XXXXXXXXXXX
      .XXX.X.XXX.
      ..X..X..X..
      .....X.....
      ....XXX....
      .....X.....
    `),
  },
];

// Frames are resizable borders, drawn by rule rather than stored as art.
export const FRAMES = [
  { id: 'line', name: 'Simple line' },
  { id: 'double', name: 'Double line' },
  { id: 'dotted', name: 'Dotted' },
  { id: 'folk', name: 'Folk chain' },
];
