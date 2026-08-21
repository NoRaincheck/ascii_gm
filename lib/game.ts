import { createRng, shuffleWith } from './rng.ts';

export interface Tree {
  x: number;
  y: number;
}

export type BuildingType = 'house' | 'tower' | 'castle';

export const BUILDING_TYPES: BuildingType[] = ['house', 'tower', 'castle'];

export interface Building {
  x: number;
  y: number;
  type: BuildingType;
}

export interface Deco {
  x: number;
  y: number;
  variant: number;
}

export interface WaterRock {
  x: number;
  y: number;
  variant: number; // 1-4, maps to Rocks_01-04
  frameOffset: number; // staggered animation start frame
}

export interface Player {
  x: number;
  y: number;
  facing: 'up' | 'down' | 'left' | 'right';
}

export type TerrainKind = 'sea' | 'coast' | 'beach' | 'grass' | 'cliff' | 'rock' | 'stairs';

const GRASS_KINDS = new Set<TerrainKind>(['grass']);
const BUILDING_KINDS = new Set<TerrainKind>(['grass', 'rock']);
const WALKABLE_KINDS = new Set<TerrainKind>(['grass', 'beach', 'rock']);

export type RoomType = 'rock' | 'grass' | 'beach';

export interface StairRun {
  start: number;
  width: number;
  row: number;
}

// A room is a terrace segment: a run of columns of a single terrain kind,
// descending from the top of the map toward the sea. Rooms on the same terrace
// sit flush (same kind, no wall between them); vertically adjacent rooms are
// separated by a one-row cliff band that hugs the UPPER room's bottom edge and
// carries the staircases joining the two. Terrace heights wander per column,
// so a room's edges are stepped curves rather than straight lines:
// `tops`/`bottoms` hold the actual first/last row of each column (x + i),
// while `y`/`height` describe the room's bounding box. Walking down any
// column, the level never rises: rock(2) → grass(1)/beach(0), grass → beach,
// with repeats allowed. `world.stairs` records each doorway run.
export interface Room {
  type: RoomType;
  x: number; // left column (inclusive)
  y: number; // bounding-box top row (inclusive)
  width: number; // in tiles
  height: number; // bounding-box height in tiles
  tops: number[]; // per-column top row (inclusive), length === width
  bottoms: number[]; // per-column bottom row (inclusive), length === width
}


export interface World {
  width: number;
  height: number;
  terrain: TerrainKind[][];
  trees: Tree[];
  buildings: Building[];
  deco: Deco[];
  waterRocks: WaterRock[];
  stairs: StairRun[];
  rooms: Room[];
  player: Player;
  level: number; // highest room level present: 0=beach, 1=grass, 2=rock
}

export const ROOM_LEVEL: Record<RoomType, number> = { beach: 0, grass: 1, rock: 2 };

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const TILE = 64;

// Character body: a compact ground box centered on the feet (player.x, player.y).
const BODY: Rect = { x: -20, y: -36, w: 40, h: 36 };

// Full sprite content rects (for placement: no overlap, no boundary clip).
const CHAR_CONTENT: Rect = { x: -39, y: -91, w: 78, h: 91 };

// Solid footprints used for movement collision — the character cannot pass
// through the tree trunk or the building walls. Anchored at each landmark's
// bottom-center (tree: cx=tx*64+66, bottom=ty*64+114; buildings:
// cx=bx*64+128, bottom=by*64+236), derived from the measured solid parts of
// the sprites (see scripts/bbox_probe.ts).
const TREE_SOLID: Rect = { x: -26, y: -148, w: 52, h: 148 };
const BUILDING_SOLID: Record<BuildingType, Rect> = {
  house: { x: -54, y: -148, w: 108, h: 148 },
  tower: { x: -57, y: -182, w: 114, h: 183 },
  castle: { x: -148, y: -204, w: 296, h: 205 },
};

// Full sprite content rects (for placement: no overlap, no boundary clip).
// All buildings share the same ground anchor (bottom-center at bx*64+128,
// by*64+236) so they stand on one ground line; wider buildings just occupy
// more of the lattice.
const BUILDING_CONTENT: Record<BuildingType, Rect> = {
  house: { x: 74, y: 88, w: 108, h: 148 },
  tower: { x: 71, y: 53, w: 114, h: 183 },
  castle: { x: -20, y: 31, w: 296, h: 205 },
};

function charRect(px: number, py: number): Rect {
  return { x: px + CHAR_CONTENT.x, y: py + CHAR_CONTENT.y, w: CHAR_CONTENT.w, h: CHAR_CONTENT.h };
}

function bodyRect(px: number, py: number): Rect {
  return { x: px + BODY.x, y: py + BODY.y, w: BODY.w, h: BODY.h };
}

function treeSolid(t: Tree): Rect {
  const cx = t.x * TILE + 66;
  const bottom = t.y * TILE + 114;
  return { x: cx + TREE_SOLID.x, y: bottom + TREE_SOLID.y, w: TREE_SOLID.w, h: TREE_SOLID.h };
}

function buildingSolid(b: Building): Rect {
  const cx = b.x * TILE + 128;
  const bottom = b.y * TILE + 236;
  const s = BUILDING_SOLID[b.type];
  return { x: cx + s.x, y: bottom + s.y, w: s.w, h: s.h };
}

function treeContent(t: Tree): Rect {
  return { x: t.x * TILE + 11, y: t.y * TILE - 60, w: 111, h: 174 };
}

function buildingContent(b: Building): Rect {
  const c = BUILDING_CONTENT[b.type];
  return { x: b.x * TILE + c.x, y: b.y * TILE + c.y, w: c.w, h: c.h };
}

// Grass decoration sprites (assets/Deco/). Each entry is the alpha content rect
// measured inside its frame (see scripts/bbox_probe.ts). Content is the visible
// pixels; the frame is the full PNG. Variants are 1-indexed to match the
// `01.png`…`15.png` filenames. Only single-tile (64x64) sprites are used.
export interface DecoVariant {
  frameW: number;
  frameH: number;
  content: Rect;
}

export const DECO_VARIANTS: DecoVariant[] = [
  { frameW: 64, frameH: 64, content: { x: 25, y: 24, w: 17, h: 19 } },
  { frameW: 64, frameH: 64, content: { x: 21, y: 20, w: 26, h: 27 } },
  { frameW: 64, frameH: 64, content: { x: 14, y: 12, w: 38, h: 37 } },
  { frameW: 64, frameH: 64, content: { x: 24, y: 19, w: 20, h: 18 } },
  { frameW: 64, frameH: 64, content: { x: 18, y: 18, w: 29, h: 22 } },
  { frameW: 64, frameH: 64, content: { x: 12, y: 15, w: 44, h: 34 } },
  { frameW: 64, frameH: 64, content: { x: 16, y: 21, w: 31, h: 22 } },
  { frameW: 64, frameH: 64, content: { x: 11, y: 17, w: 42, h: 32 } },
  { frameW: 64, frameH: 64, content: { x: 2, y: 11, w: 61, h: 42 } },
  { frameW: 64, frameH: 64, content: { x: 22, y: 23, w: 22, h: 23 } },
  { frameW: 64, frameH: 64, content: { x: 20, y: 15, w: 32, h: 35 } },
  { frameW: 64, frameH: 64, content: { x: 11, y: 12, w: 40, h: 39 } },
  { frameW: 64, frameH: 64, content: { x: 5, y: 10, w: 56, h: 45 } },
  { frameW: 64, frameH: 64, content: { x: 15, y: 16, w: 36, h: 31 } },
  { frameW: 64, frameH: 64, content: { x: 24, y: 20, w: 24, h: 24 } },
];

// Frame-center offset (from a tile's top-left) so the sprite's content bottom
// lands on the tile's bottom-center, the same ground-line rule as landmarks.
export function decoFrameOffset(variant: number): { dx: number; dy: number } {
  const v = DECO_VARIANTS[variant - 1];
  const centerX = v.content.x + v.content.w / 2;
  const bottomY = v.content.y + v.content.h;
  return {
    dx: TILE / 2 - (centerX - v.frameW / 2),
    dy: TILE - (bottomY - v.frameH / 2),
  };
}

export function decoContent(d: Deco): Rect {
  const v = DECO_VARIANTS[d.variant - 1];
  const off = decoFrameOffset(d.variant);
  const fx = off.dx - v.frameW / 2 + v.content.x;
  const fy = off.dy - v.frameH / 2 + v.content.y;
  return { x: d.x * TILE + fx, y: d.y * TILE + fy, w: v.content.w, h: v.content.h };
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

function inBounds(r: Rect, width: number, height: number): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= width * TILE && r.y + r.h <= height * TILE;
}

export function terrainAt(world: World, tx: number, ty: number): TerrainKind {
  if (tx < 0 || ty < 0 || tx >= world.width || ty >= world.height) return 'sea';
  return world.terrain[ty][tx];
}

/**
 * Return the level index for a terrain tile: 0=bottom(beach), 1=middle(grass), 2=top(rock).
 * Sea, coast, cliff, and stairs are outside the level hierarchy.
 */
export function terrainLevel(world: World, tx: number, ty: number): number | null {
  const kind = terrainAt(world, tx, ty);
  if (kind === 'beach') return 0;
  if (kind === 'grass') return 1;
  if (kind === 'rock') return 2;
  return null;
}

// Edge bits for the flat autotile tileset (Tilemap_Flat.png).
export const EDGE_N = 1;
export const EDGE_S = 2;
export const EDGE_W = 4;
export const EDGE_E = 8;

// True when a surface tile (beach/grass/rock, or a cliff wall face) has an
// orthogonal water (sea/coast) neighbor. Foam is centered on these tiles: the
// opaque land tile drawn above hides the foam blob's full center, leaving only
// the outer foam strips to ripple out over the adjacent water. Cliff tiles are
// included so the wall bands lap foam onto the sea — at the west/east ends of a
// wall run, and along the wall's south lip where the room below is narrower
// than the room above and the wall overhangs open sea.
export function landTouchesWater(world: World, tx: number, ty: number): boolean {
  const kind = terrainAt(world, tx, ty);
  if (kind !== 'beach' && kind !== 'grass' && kind !== 'rock' && kind !== 'cliff') return false;
  const neighbors: Array<[number, number]> = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (const [dx, dy] of neighbors) {
    const n = terrainAt(world, tx + dx, ty + dy);
    if (n === 'sea' || n === 'coast') return true;
  }
  return false;
}

// Autotile border mask for a grass/beach/rock tile: a border is drawn on each
// side where the region meets a "lower" terrain kind — grass against beach/coast/rock/sea,
// beach against coast/sea, rock against sea. Bits are EDGE_N/S/W/E.
export function flatEdgeMask(world: World, tx: number, ty: number, kind: 'grass' | 'beach' | 'rock'): number {
  let mask = 0;
  const neighbors: Array<[number, number, number]> = [
    [0, -1, EDGE_N],
    [0, 1, EDGE_S],
    [-1, 0, EDGE_W],
    [1, 0, EDGE_E],
  ];
  for (const [dx, dy, bit] of neighbors) {
    const n = terrainAt(world, tx + dx, ty + dy);
    const border = kind === 'grass'
      ? n !== 'grass'
      : kind === 'beach'
      ? n === 'coast' || n === 'sea'
      : /* rock */ n === 'sea';
    if (border) mask |= bit;
  }
  return mask;
}

// Map an edge mask to the flat tileset index. Each 4x4 block encodes the border
// combo: column = W/E (col0=W, col1=none, col2=E, col3=W+E), row = N/S
// (row0=N, row1=none, row2=S, row3=N+S). Grass and rock live in block 0,
// beach in the mirrored block at column 5 of the 10-wide sheet.
export function flatTileIndex(kind: 'grass' | 'beach' | 'rock', mask: number): number {
  const hasN = (mask & EDGE_N) !== 0;
  const hasS = (mask & EDGE_S) !== 0;
  const hasW = (mask & EDGE_W) !== 0;
  const hasE = (mask & EDGE_E) !== 0;
  const col = hasW ? (hasE ? 3 : 0) : hasE ? 2 : 1;
  const row = hasN ? (hasS ? 3 : 0) : hasS ? 2 : 1;
  const base = kind === 'beach' ? 5 : 0;
  return row * 10 + base + col;
}

// The world is a terraced stack of rooms ("rooms in a house"). Each room is a
// stretch of ground of one terrain kind — rock, grass, or beach — and the
// terraces descend from the top of the map toward the sea: walking down any
// column, the room level never rises (rock→grass/beach, grass→beach, repeats
// allowed), and every higher room keeps a cliff wall along its whole bottom
// edge wherever another room lies below it. Rock and grass never meet open
// water on their south side either: wherever such a lip faces the sea (a
// non-beach bottom terrace, or a flank column the lower terraces skip), an
// impassable wall tile is dropped into the water below it — only beach ends
// in a walkable sandy shore. Terraces are NOT full-width slabs:
// each covers its own column range (open sea at the flanks is common), and
// their heights wander along the range in small steps, so wall bands follow
// jagged, stepped curves instead of straight lines — a terrace's south lip can
// be a cliff face in one column and a sandy shore in the next.
//
// Between vertically adjacent rooms sits a single-row wall band owned by the
// upper room: the band hugs the upper room's actual (per-column) bottom edge
// and carries 1–3-wide staircases — the "doors". Every pair of vertically
// adjacent rooms (sharing at least one column) gets a door, so a room can join
// several rooms up and down. Doors never touch open water and are never flush
// against one another.
//
// Generation steps (a layout is redrawn until the island is fully connected):
//   1) 2–4 terraces via the DAG (top→down, biased to descend, shore at the
//      bottom), each with a nominal height and its own column range.
//   2) Per-terrace height jitter: piecewise-constant random walks (runs of
//      1–3 columns stepping ±1) give every terrace a gently craggy profile.
//   3) Per-column stacking: each column walks its covering terraces top→down,
//      deriving each top from the previous bottom (+2 rows for the wall),
//      clamped so everything fits above the southern sea margin.
//   4) Each terrace splits into 1–3 flush side-by-side rooms.
//   5) Sea base ← room rects ← wall bands under every upper bottom edge ←
//      shore walls under every rock/grass lip facing open sea ← doors per
//      adjacent pair ← flood-fill connectivity validation.
function buildRooms(world: World, rand: () => number): void {
  const { width, height } = world;
  const seaTop = 1;
  const seaBottom = 1;
  const seaSide = 1;
  const topRow = seaTop;
  const bottomRow = height - seaBottom - 1;
  const usableRows = bottomRow - topRow + 1;
  const leftCol = seaSide;
  const rightCol = width - seaSide - 1; // inclusive
  const usableCols = rightCol - leftCol + 1;

  const MIN_H = 3;
  const MAX_H = 9;
  const MIN_W = 4;

  // Piecewise-constant random walk over `len` columns: runs of `minRun`–3
  // columns, stepping −1/0/+1 with the cumulative offset clamped to ±amp.
  // These small per-column wobbles are what make walls step instead of
  // running straight.
  const curve = (len: number, amp: number, minRun = 1): number[] => {
    const out: number[] = [];
    let o = 0;
    let i = 0;
    while (i < len) {
      const run = minRun + Math.floor(rand() * (3 - minRun + 1));
      const r = rand();
      o = clamp(o + (r < 0.25 ? -1 : r < 0.75 ? 0 : 1), -amp, amp);
      for (let k = 0; k < run && i < len; k++, i++) out.push(o);
    }
    return out;
  };

  const weightedPick = <T,>(items: T[], weights: number[]): T => {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  };

  interface Terrace {
    type: RoomType;
    start: number; // left column of the terrace's range (inclusive)
    end: number; // right column of the range (inclusive)
    hNom: number; // nominal height before jitter
    jit: number[]; // per-column height jitter over [start..end]
    top: number[]; // per-column top row (filled in step 3)
    bottom: number[]; // per-column bottom row (inclusive)
  }

  // Draw one complete layout. Returns null when the island comes out
  // disconnected (or, as a safety valve, when a column cannot fit its
  // terraces); the caller redraws until it gets a connected one.
  const drawLayout = (): { terrain: TerrainKind[][]; stairs: StairRun[]; rooms: Room[] } | null => {
    // ── 1) Terraces: how many, which types ───────────────────────────────────
    const kMax = clamp(Math.floor((usableRows - 2) / (MIN_H + 2)), 1, 4);
    const kChoices = [2, 3, 4].filter((k) => k <= kMax);
    const K = kChoices.length === 0 ? 1 : weightedPick(
      kChoices,
      kChoices.map((k) => (k === 2 ? 0.2 : k === 3 ? 0.55 : 0.25)),
    );

    // Types: a walk down the DAG — the level never rises, repeats allowed,
    // and the bottom terrace almost always reaches the shore (beach).
    const types: RoomType[] = [];
    let lvl = rand() < 0.7 ? 2 : 1;
    for (let i = 0; i < K; i++) {
      if (i > 0) {
        const r = rand();
        const last = i === K - 1;
        if (lvl === 2) {
          if (last) lvl = r < 0.7 ? 0 : 1;
          else if (r >= 0.25) lvl = r < 0.8 ? 1 : 0;
        } else if (lvl === 1) {
          if (last) {
            if (r >= 0.35) lvl = 0;
          } else if (r >= 0.3) lvl = 0;
        }
      }
      types.push(lvl === 2 ? 'rock' : lvl === 1 ? 'grass' : 'beach');
    }
    // Every world should mix at least two kinds — a single-kind island reads
    // as a bug, not a terrace. Force the lowest terrace one step down the DAG
    // if the walk came out flat.
    if (types.every((t) => t === types[0]) && K >= 2) {
      const drop: Record<string, RoomType> = { rock: 'grass', grass: 'beach', beach: 'grass' };
      types[K - 1] = drop[types[K - 1]];
    }

    // Heights: split the rows between the terraces (one wall row between each
    // consecutive pair), keeping one spare row so even a worst-case wobble
    // fits. Extra rows are spread round-robin in random order so terraces come
    // out varied (e.g. 6/5/5) instead of greedily lopsided (9/9/1).
    const zoneRows = usableRows - (K - 1);
    const distributable = Math.max(K * MIN_H, zoneRows - 1);
    const hNom = new Array<number>(K).fill(MIN_H);
    let extra = distributable - K * MIN_H;
    while (extra > 0) {
      let progressed = false;
      for (const i of shuffleWith([...Array(K).keys()], rand)) {
        if (extra <= 0) break;
        if (hNom[i] < MAX_H) {
          hNom[i]++;
          extra--;
          progressed = true;
        }
      }
      if (!progressed) break;
    }

    // ── 2) Column ranges: each terrace picks its own span; consecutive ──────
    // terraces must share columns so doors can join them. The ranges are
    // drawn crown-last: T1..T(K−1) pick shifting spans (this is what breaks
    // the single-ziggurat look), and the crown T0 then spans their union, so
    // the topmost terrace in ANY column is always T0 — no 1-column needles
    // poking up against the open sea at range seams. A shared global margin
    // lets the whole island pull in from the flanks (open sea at the sides).
    const gML = rand() < 0.45 ? 0 : Math.floor(rand() * 3);
    const gMR = rand() < 0.45 ? 0 : Math.floor(rand() * 3);
    const ranges: Array<{ start: number; end: number }> = [];
    let prev = { start: leftCol + gML, end: rightCol - gMR };
    for (let z = 1; z < K; z++) {
      // Keep at least 3 shared columns with the previous terrace: overlap
      // edges can be sea-flanked (the wall band ends where the ranges end),
      // but an INTERIOR overlap column always has floor on both sides, so
      // three shared columns guarantee a placeable doorway.
      let start = leftCol + Math.floor(rand() * (Math.min(prev.end - 2, rightCol - MIN_W + 1) - leftCol + 1));
      const minEnd = Math.max(start + MIN_W - 1, prev.start + 2);
      let end = minEnd + Math.floor(rand() * (rightCol - minEnd + 1));
      // Occasional extra inward nibble for variety (never below MIN_W wide,
      // never eating the 3-column overlap).
      const s2 = start + (rand() < 0.25 ? 1 : 0);
      const e2 = end - (rand() < 0.25 ? 1 : 0);
      if (e2 - s2 + 1 >= MIN_W && s2 <= prev.end - 2 && e2 >= prev.start + 2) {
        start = s2;
        end = e2;
      }
      ranges.push({ start, end });
      prev = { start, end };
    }
    ranges.unshift({
      start: Math.min(leftCol + gML, ...ranges.map((r) => r.start)),
      end: Math.max(rightCol - gMR, ...ranges.map((r) => r.end)),
    });
    const terraces: Terrace[] = [];
    for (let z = 0; z < K; z++) {
      const { start, end } = ranges[z];
      const len = end - start + 1;
      terraces.push({
        type: types[z],
        start,
        end,
        hNom: hNom[z],
        // The crown's north edge is the shoreline: wiggle it in wider steps
        // (min run 2) so the coast steps cleanly instead of needling.
        jit: curve(len, 1, z === 0 ? 2 : 1),
        top: new Array<number>(len).fill(0),
        bottom: new Array<number>(len).fill(0),
      });
    }

    // ── 3) Per-column stacking: derive every terrace's rows ──────────────────
    for (let c = leftCol; c <= rightCol; c++) {
      const covering = terraces.filter((t) => t.start <= c && c <= t.end);
      let cur = -1;
      for (let idx = 0; idx < covering.length; idx++) {
        const t = covering[idx];
        const ci = c - t.start;
        if (idx === 0) {
          // The topmost terrace's north edge is the shoreline: mostly flush
          // with the sea margin, occasionally stepping down a row.
          cur = topRow + Math.max(0, t.jit[ci]);
        }
        // Leave room below for the remaining terraces of this column: each
        // needs its MIN_H floor plus one separating wall row.
        const m = covering.length - idx - 1;
        let h = clamp(t.hNom + t.jit[ci], MIN_H, MAX_H);
        h = Math.min(h, bottomRow - cur + 1 - m * (MIN_H + 1));
        if (h < MIN_H) return null; // column overfull — redraw the layout
        t.top[ci] = cur;
        t.bottom[ci] = cur + h - 1;
        cur = t.bottom[ci] + 2; // +1 wall row, then the next terrace's floor
      }
    }

    // ── 4) Split each terrace into 1–3 flush side-by-side rooms ──────────────
    const rooms: Room[] = [];
    for (const t of terraces) {
      const spanW = t.end - t.start + 1;
      const maxRooms = clamp(Math.floor(spanW / MIN_W), 1, 3);
      const count = 1 + Math.floor(rand() * maxRooms);
      const widths: number[] = [];
      let gap = spanW;
      for (let i = 0; i < count; i++) {
        const leftover = count - i - 1;
        const w = i === count - 1
          ? gap
          : MIN_W + Math.floor(rand() * (gap - leftover * MIN_W - MIN_W + 1));
        widths.push(w);
        gap -= w;
      }
      let x = t.start;
      for (const w of widths) {
        const tops = t.top.slice(x - t.start, x - t.start + w);
        const bottoms = t.bottom.slice(x - t.start, x - t.start + w);
        const y = Math.min(...tops);
        const yMax = Math.max(...bottoms);
        rooms.push({ type: t.type, x, y, width: w, height: yMax - y + 1, tops, bottoms });
        x += w;
      }
    }

    // ── 5) Carve: sea base, room rects, then the wall bands ──────────────────
    const terrain: TerrainKind[][] = [];
    for (let ty = 0; ty < height; ty++) terrain.push(new Array<TerrainKind>(width).fill('sea'));
    for (const r of rooms) {
      for (let i = 0; i < r.width; i++) {
        for (let ty = r.tops[i]; ty <= r.bottoms[i]; ty++) terrain[ty][r.x + i] = r.type;
      }
    }
    // Walls: scan each column top→down; wherever a floor run ends and another
    // begins two rows later, the row between becomes the upper room's cliff
    // face — the wall hugs the actual stepped bottom edge. A run whose south
    // is open water is the local shore: beach stays a walkable sandy shore,
    // but rock and grass get an impassable wall tile dropped into the water
    // directly below their lip — they never touch open sea on the south side.
    const isFloor = (ty: number, c: number): boolean => {
      const k = terrain[ty][c];
      return k === 'rock' || k === 'grass' || k === 'beach';
    };
    for (let c = leftCol; c <= rightCol; c++) {
      let ty = topRow;
      while (ty <= bottomRow) {
        if (!isFloor(ty, c)) {
          ty++;
          continue;
        }
        let b = ty;
        while (b + 1 <= bottomRow && isFloor(b + 1, c)) b++;
        if (b + 2 <= bottomRow && isFloor(b + 2, c)) terrain[b + 1][c] = 'cliff';
        else if (terrain[ty][c] !== 'beach' && terrain[b + 1][c] === 'sea') {
          terrain[b + 1][c] = 'cliff'; // shore wall under a rock/grass lip
        }
        ty = b + 2;
      }
    }

    // ── 6) Doors: one staircase per vertically adjacent room pair ────────────
    // Adjacency means sharing a column with no room between them there. The
    // door lives in the wall row under the upper room's bottom edge, on a run
    // of columns that share the same wall row, walled off from open water on
    // both flanks, and never flush against another door in the same row.
    const stairs: StairRun[] = [];
    const stacks: number[][] = [];
    for (let c = leftCol; c <= rightCol; c++) {
      const order = rooms
        .map((r, ri) => ({ r, ri }))
        .filter(({ r }) => r.x <= c && c < r.x + r.width)
        .sort((a, b) => a.r.tops[c - a.r.x] - b.r.tops[c - b.r.x]);
      stacks[c] = order.map(({ ri }) => ri);
    }
    const seenPairs = new Set<string>();
    const pairList: Array<[number, number]> = [];
    for (let c = leftCol; c <= rightCol; c++) {
      const stack = stacks[c];
      for (let i = 0; i + 1 < stack.length; i++) {
        const key = `${stack[i]},${stack[i + 1]}`;
        if (!seenPairs.has(key)) {
          seenPairs.add(key);
          pairList.push([stack[i], stack[i + 1]]);
        }
      }
    }
    type Cand = { row: number; start: number; width: number };
    const options: Cand[][] = pairList.map(([ui, li]) => {
      const u = rooms[ui];
      const l = rooms[li];
      // Group the pair's shared columns by their wall row…
      const byRow = new Map<number, number[]>();
      for (let i = 0; i < u.width; i++) {
        const c = u.x + i;
        if (c < l.x || c >= l.x + l.width) continue;
        const wr = u.bottoms[i] + 1;
        if (l.tops[c - l.x] !== wr + 1) continue; // not adjacent in this column
        const list = byRow.get(wr) ?? [];
        list.push(c);
        byRow.set(wr, list);
      }
      // …then offer every door position on each contiguous equal-row run.
      const cands: Cand[] = [];
      for (const [row, cols] of byRow) {
        let s = 0;
        while (s < cols.length) {
          let e = s;
          while (e + 1 < cols.length && cols[e + 1] === cols[e] + 1) e++;
          for (let w = Math.min(3, e - s + 1); w >= 1; w--) {
            for (let a = s; a + w - 1 <= e; a++) {
              const st = cols[a];
              const lf = st - 1 < 0 ? 'sea' : terrain[row][st - 1];
              const rt = st + w >= width ? 'sea' : terrain[row][st + w];
              if (lf !== 'sea' && lf !== 'coast' && rt !== 'sea' && rt !== 'coast') {
                cands.push({ row, start: st, width: w });
              }
            }
          }
          s = e + 1;
        }
      }
      return shuffleWith(cands, rand);
    });
    // Joint placement: pick one candidate per pair, keeping two doors in the
    // same row at least one wall column apart. Small search — backtrack, with
    // scarcest-first (MRV) ordering so pairs with few usable spots claim them
    // before flexible pairs crowd the row.
    const order = options.map((_, i) => i).sort((a, b) => options[a].length - options[b].length);
    const placed: Cand[] = [];
    const conflicts = (d: Cand): boolean =>
      placed.some((p) =>
        p.row === d.row && !(d.start - 1 > p.start + p.width - 1 || d.start + d.width < p.start)
      );
    const place = (k: number): boolean => {
      if (k === order.length) return true;
      const i = order[k];
      for (const d of options[i]) {
        if (conflicts(d)) continue;
        placed.push(d);
        if (place(k + 1)) return true;
        placed.pop();
      }
      return false;
    };
    if (!place(0)) {
      // Greedy fallback: best effort — the connectivity check below decides.
      placed.length = 0;
      for (const i of order) {
        const d = options[i].find((c) => !conflicts(c));
        if (d) placed.push(d);
      }
    }
    for (const d of placed) {
      for (let c = d.start; c < d.start + d.width; c++) terrain[d.row][c] = 'stairs';
      stairs.push({ start: d.start, width: d.width, row: d.row });
    }

    // ── 7) Connectivity: every walkable tile reachable from the top room ─────
    const isWalkKind = (k: TerrainKind): boolean =>
      k === 'rock' || k === 'grass' || k === 'beach' || k === 'stairs';
    const seen = new Set<string>([`${rooms[0].x},${rooms[0].tops[0]}`]);
    const queue: Array<[number, number]> = [[rooms[0].x, rooms[0].tops[0]]];
    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (!isWalkKind(terrain[ny][nx])) continue;
        const key = `${nx},${ny}`;
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push([nx, ny]);
      }
    }
    for (let ty = topRow; ty <= bottomRow; ty++) {
      for (let c = leftCol; c <= rightCol; c++) {
        if (isWalkKind(terrain[ty][c]) && !seen.has(`${c},${ty}`)) return null;
      }
    }
    return { terrain, stairs, rooms };
  };

  let layout = drawLayout();
  for (let attempt = 1; attempt < 60 && layout === null; attempt++) layout = drawLayout();
  if (layout === null) throw new Error('buildRooms: could not draw a connected terrace layout');

  world.terrain = layout.terrain;
  world.stairs = layout.stairs;
  world.rooms = layout.rooms;
  world.level = Math.max(...layout.rooms.map((r) => ROOM_LEVEL[r.type]));
}

// The tile the body stands on at a pixel position (feet + body width probes).
function standingTileKinds(world: World, px: number, py: number): TerrainKind[] {
  const tiles: TerrainKind[] = [];
  for (const dx of [-BODY.w / 2, 0, BODY.w / 2]) {
    const tx = Math.floor((px + dx) / TILE);
    const ty = Math.floor(py / TILE);
    tiles.push(terrainAt(world, tx, ty));
  }
  return tiles;
}

export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function canOccupyAt(world: World, px: number, py: number): boolean {
  if (!inBounds(charRect(px, py), world.width, world.height)) return false;
  // Cannot stand in the water (deep sea or foamy coast) or on a cliff face.
  for (const kind of standingTileKinds(world, px, py)) {
    if (kind === 'sea' || kind === 'coast' || kind === 'cliff') return false;
  }
  const body = bodyRect(px, py);
  for (const t of world.trees) {
    if (intersects(body, treeSolid(t))) return false;
  }
  for (const b of world.buildings) {
    if (intersects(body, buildingSolid(b))) return false;
  }
  return true;
}

function contentOverlaps(world: World, r: Rect): boolean {
  for (const t of world.trees) {
    if (intersects(r, treeContent(t))) return true;
  }
  for (const b of world.buildings) {
    if (intersects(r, buildingContent(b))) return true;
  }
  return false;
}

// Landmark terrain checks — shared implementation with a Set of allowed kinds.
function rectOnKinds(world: World, r: Rect, kinds: Set<TerrainKind>): boolean {
  const x0 = Math.floor(r.x / TILE);
  const y0 = Math.floor(r.y / TILE);
  const x1 = Math.floor((r.x + r.w - 1) / TILE);
  const y1 = Math.floor((r.y + r.h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!kinds.has(terrainAt(world, tx, ty))) return false;
    }
  }
  return true;
}

/** Trees only go on grass. */
function rectOnGrass(world: World, r: Rect): boolean {
  return rectOnKinds(world, r, GRASS_KINDS);
}

/** Buildings sit on grass or rock. */
function rectOnBuildingSite(world: World, r: Rect): boolean {
  return rectOnKinds(world, r, BUILDING_KINDS);
}

/** Walkable terrain for deco (grass, beach, rock). */
function rectOnWalkable(world: World, r: Rect): boolean {
  return rectOnKinds(world, r, WALKABLE_KINDS);
}

// Place animated water rocks on random sea/coast tiles. Each variant (1-4)
// is a 128×128 spritesheet with 8 splash-animation frames. Rocks are placed
// randomly on water tiles with a minimum spacing to avoid clustering, and
// staggered animation offsets so they don't all splash in lockstep.
function placeWaterRocks(world: World, rand: () => number): void {
  const spacing = 4;
  world.waterRocks = [];
  const variants = [1, 2, 3, 4];
  const candidates: Array<[number, number]> = [];
  for (let ty = 0; ty < world.height; ty++) {
    for (let tx = 0; tx < world.width; tx++) {
      if (tx < 1 || tx >= world.width - 1 || ty < 1 || ty >= world.height - 1) continue;
      if (world.terrain[ty][tx] === 'sea' || world.terrain[ty][tx] === 'coast') {
        candidates.push([tx, ty]);
      }
    }
  }
  shuffleWith(candidates, rand);
  for (const [tx, ty] of candidates) {
    // Check spacing against already-placed rocks
    if (world.waterRocks.some((r) => Math.max(Math.abs(r.x - tx), Math.abs(r.y - ty)) < spacing)) continue;
    const variant = variants[Math.floor(rand() * variants.length)];
    const frameOffset = Math.floor(rand() * 8);
    world.waterRocks.push({ x: tx, y: ty, variant, frameOffset });
    if (world.waterRocks.length >= 20) break; // cap at 20 rocks
  }
}

// Scatter decorative sprites over grass only, at most one per 5x5-tile block
// (~1 per 25-tile box). No collision — the character walks over them. A few
// candidate tiles are tried per block so one rejected candidate doesn't empty
// the block, and candidates closer than the block spacing to an already-placed
// sprite are skipped.
function placeDeco(world: World, rand: () => number): void {
  const spacing = 5;
  world.deco = [];
  for (let by = 0; by < world.height; by += spacing) {
    for (let bx = 0; bx < world.width; bx += spacing) {
      const grass: Array<[number, number]> = [];
      for (let ty = by; ty < by + spacing && ty < world.height; ty++) {
        for (let tx = bx; tx < bx + spacing && tx < world.width; tx++) {
          if (world.terrain[ty][tx] === 'grass') grass.push([tx, ty]);
        }
      }
      if (grass.length === 0) continue;
      for (let attempt = 0; attempt < 6; attempt++) {
        const [tx, ty] = grass[Math.floor(rand() * grass.length)];
        const d: Deco = { x: tx, y: ty, variant: 1 + Math.floor(rand() * DECO_VARIANTS.length) };
        const r = decoContent(d);
        if (!inBounds(r, world.width, world.height)) continue;
        if (contentOverlaps(world, r)) continue;
        if (!rectOnGrass(world, r)) continue;
        if (world.deco.some((o) => Math.max(Math.abs(o.x - d.x), Math.abs(o.y - d.y)) < spacing)) continue;
        world.deco.push(d);
        break;
      }
    }
  }
}

export const CELL = 24;

/** BFS flood-fill: return Set of reachable cell keys from (sx, sy). */
function floodFill(world: World, sx: number, sy: number, isOpen: (cx: number, cy: number) => boolean): Set<string> {
  const cols = Math.floor((world.width * TILE) / CELL);
  const rows = Math.floor((world.height * TILE) / CELL);
  const startX = Math.floor(sx / CELL);
  const startY = Math.floor(sy / CELL);
  if (!isOpen(startX, startY)) return new Set();
  const seen = new Set<string>([`${startX},${startY}`]);
  const queue: Array<[number, number]> = [[startX, startY]];
  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      if (!isOpen(nx, ny)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

function reachableAt(world: World, sx: number, sy: number): number {
  return floodFill(world, sx, sy, (cx, cy) => !canOccupyAt(world, cx * CELL + CELL / 2, cy * CELL + CELL / 2)).size;
}

export function generateWorld(seed: number, width = 16, height = 16): World {
  const rand = createRng(seed);
  const world: World = {
    width,
    height,
    terrain: [],
    trees: [],
    buildings: [],
    deco: [],
    waterRocks: [],
    stairs: [],
    rooms: [],
    player: { x: 0, y: 0, facing: 'down' },
    level: 0,
  };
  buildRooms(world, rand);

  // Landmarks sit on a small lattice inside each room so they line up on the
  // grid and stay within the room's rectangle. Buildings go in rock + grass
  // rooms, trees in grass rooms, rock deco in rock rooms. The usual content
  // checks (in bounds, no overlap, right terrain) filter out everything that
  // doesn't fit — e.g. a wide castle in a narrow room is simply skipped.
  const roomSlots = (room: Room, step: number, margin: number): Array<[number, number]> => {
    const slots: Array<[number, number]> = [];
    for (let ty = room.y + margin; ty < room.y + room.height - margin; ty += step) {
      for (let tx = room.x + margin; tx < room.x + room.width - margin; tx += step) {
        slots.push([tx, ty]);
      }
    }
    return slots;
  };

  // Buildings: rock rooms first, then grass rooms.
  const buildingSlots = shuffleWith(
    world.rooms
      .filter((r) => r.type !== 'beach')
      .sort((a, b) => ROOM_LEVEL[b.type] - ROOM_LEVEL[a.type])
      .flatMap((r) => roomSlots(r, 2, 1)),
    rand,
  );
  const numBuildings = 2 + Math.floor(rand() * 3);
  for (const [bx, by] of buildingSlots) {
    if (world.buildings.length >= numBuildings) break;
    const type = BUILDING_TYPES[Math.floor(rand() * BUILDING_TYPES.length)];
    const r = buildingContent({ x: bx, y: by, type });
    if (!inBounds(r, width, height)) continue;
    if (contentOverlaps(world, r)) continue;
    if (!rectOnBuildingSite(world, r)) continue;
    world.buildings.push({ x: bx, y: by, type });
  }

  // Trees: across the whole grass level, one lattice step 2 apart, but kept
  // two rows clear of the wall bands above/below. A tree is ~2.7 tiles tall, so
  // this is the only way its full content stays inside the grass and its solid
  // doesn't dip into a doorway corridor.
  // Each grass room contributes slots from its own bounding box (rooms on a
  // terrace no longer share exact rows); rectOnGrass filters per-tile.
  const grassRooms = world.rooms.filter((r) => r.type === 'grass');
  const treeSlots: Array<[number, number]> = [];
  for (const g of grassRooms) {
    for (let ty = g.y + 2; ty <= g.y + g.height - 3; ty += 2) {
      for (let tx = g.x; tx < g.x + g.width; tx += 2) treeSlots.push([tx, ty]);
    }
  }
  shuffleWith(treeSlots, rand);
  const numTrees = 6 + Math.floor(rand() * 6);
  for (const [tx, ty] of treeSlots) {
    if (world.trees.length >= numTrees) break;
    const r = treeContent({ x: tx, y: ty });
    if (!inBounds(r, width, height)) continue;
    if (contentOverlaps(world, r)) continue;
    if (!rectOnGrass(world, r)) continue;
    world.trees.push({ x: tx, y: ty });
  }

  // Rock-room decoration sprites.
  const rockSlots = shuffleWith(
    world.rooms.filter((r) => r.type === 'rock').flatMap((r) => roomSlots(r, 2, 1)),
    rand,
  );
  const numRockDeco = 4 + Math.floor(rand() * 5);
  for (const [tx, ty] of rockSlots) {
    if (world.deco.length >= numTrees + numRockDeco) break;
    const r = decoContent({ x: tx, y: ty, variant: 1 });
    if (!inBounds(r, width, height)) continue;
    if (contentOverlaps(world, r)) continue;
    if (!rectOnWalkable(world, r)) continue;
    if (world.deco.some((o) => Math.max(Math.abs(o.x - tx), Math.abs(o.y - ty)) < 3)) continue;
    world.deco.push({ x: tx, y: ty, variant: 1 + Math.floor(rand() * DECO_VARIANTS.length) });
  }

  // Spawn on the most open connected area (pick the cell with highest reachability).
  const totalCells = Math.floor((width * TILE) / CELL) * Math.floor((height * TILE) / CELL);
  let bestScore = -1;
  let best: Player = { x: TILE, y: TILE, facing: 'down' };
  const isOpen = (cx: number, cy: number) => canOccupyAt(world, cx * CELL + CELL / 2, cy * CELL + CELL / 2);
  for (let attempt = 0; attempt < 400; attempt++) {
    const px = TILE + Math.floor(rand() * (width - 2) * TILE / CELL) * CELL + CELL / 2;
    const py = TILE + Math.floor(rand() * (height - 2) * TILE / CELL) * CELL + CELL / 2;
    if (!isOpen(Math.floor(px / CELL), Math.floor(py / CELL))) continue;
    const score = floodFill(world, px, py, isOpen).size;
    if (score > bestScore) {
      bestScore = score;
      best = { x: px, y: py, facing: 'down' };
      if (score > totalCells * 0.65) break;
    }
  }
  world.player = best;

  // ── Prune landmarks that block stair entryways ────────────────────────────
  // For each stair run, ensure the tiles immediately above and below are clear
  // of solid obstacles (trees/buildings) so the stairs are reachable from both
  // the upper terrace (rock/grass) and lower terrace (grass/beach).
  // A door needs its landing tiles — one row above and below the band, spanning
  // the stairs plus one column each side — free of solid footprints so the
  // character can step from either room into the corridor. Anchor-tile distance
  // isn't enough: a wide castle placed a few tiles above a door can still cover
  // the whole room and the landing. So we compare solid rects against a corridor.
  const stairCorridor = (stair: StairRun): Rect => ({
    x: (stair.start - 1) * TILE,
    y: (stair.row - 1) * TILE,
    w: (stair.width + 2) * TILE,
    h: 3 * TILE,
  });
  const solidBlocksDoor = (s: Rect): boolean =>
    world.stairs.some((stair) => intersects(s, stairCorridor(stair)));

  // Remove trees/buildings whose solid footprint overlaps any doorway corridor.
  world.trees = world.trees.filter((t) => !solidBlocksDoor(treeSolid(t)));
  world.buildings = world.buildings.filter((b) => !solidBlocksDoor(buildingSolid(b)));

  // ── Ensure stairs are reachable from both top and bottom ──────────────────
  // After pruning, verify each stair run has walkable tiles on both sides.
  // If not, remove the blocking landmark and retry (up to a few iterations).
  const ensureStairReachability = () => {
    const cols = Math.floor((world.width * TILE) / CELL);
    const rows = Math.floor((world.height * TILE) / CELL);
    const isWalkable = (cx: number, cy: number): boolean => {
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return false;
      const kind = terrainAt(world, cx, cy);
      return kind === 'grass' || kind === 'beach' || kind === 'rock' || kind === 'stairs';
    };
    for (const stair of world.stairs) {
      const { start, width, row } = stair;
      const midCol = start + Math.floor(width / 2);
      // Check above (row - 1, row - 2, ...)
      let aboveClear = false;
      for (let dr = 1; dr <= 3; dr++) {
        const ry = row - dr;
        if (ry < 0) break;
        if (isWalkable(midCol, ry)) {
          aboveClear = true;
          break;
        }
      }
      // Check below (row + 1, row + 2, ...)
      let belowClear = false;
      for (let dr = 1; dr <= 3; dr++) {
        const ry = row + dr;
        if (ry >= world.height) break;
        if (isWalkable(midCol, ry)) {
          belowClear = true;
          break;
        }
      }
      // If either side is blocked, remove nearby landmarks and retry
      if (!aboveClear || !belowClear) {
        // Remove any tree or building whose solid rect overlaps the stair corridor
        const newTrees: Tree[] = [];
        for (const t of world.trees) {
          if (solidBlocksDoor(treeSolid(t))) continue;
          newTrees.push(t);
        }
        const newBuildings: Building[] = [];
        for (const b of world.buildings) {
          if (solidBlocksDoor(buildingSolid(b))) continue;
          newBuildings.push(b);
        }
        if (newTrees.length < world.trees.length || newBuildings.length < world.buildings.length) {
          world.trees = newTrees;
          world.buildings = newBuildings;
          // Recurse to recheck
          ensureStairReachability();
          return;
        }
      }
    }
  };
  ensureStairReachability();

  // Keep only landmarks whose base the character can actually reach.
  const reach = floodFill(world, world.player.x, world.player.y, (cx, cy) =>
    canOccupyAt(world, cx * CELL + CELL / 2, cy * CELL + CELL / 2));
  const baseReachable = (rect: Rect): boolean => {
    const cx = Math.floor(rect.x / CELL) + Math.floor(rect.w / CELL / 2);
    const cy = Math.floor((rect.y + rect.h) / CELL);
    // The body is 36px tall, so it must stand a cell or two clear of a large
    // footprint (e.g. below a house wall) before it can close in on the base.
    // Large landmarks (castles) can span several cells and may sit flush against
    // a terrace edge, so the search window widens with the footprint width.
    const radiusX = Math.max(2, Math.ceil(rect.w / CELL));
    for (let dy = -2; dy <= Math.ceil(rect.h / CELL); dy++) {
      for (let dx = -radiusX; dx <= radiusX; dx++) {
        if (reach.has(`${cx + dx},${cy + dy}`)) return true;
      }
    }
    return false;
  };
  world.trees = world.trees.filter((t) => {
    const s = treeSolid(t);
    return baseReachable(s);
  });
  world.buildings = world.buildings.filter((b) => {
    const s = buildingSolid(b);
    return baseReachable(s);
  });

  // Filter rock deco that is unreachable.
  world.deco = world.deco.filter((d) => {
    const r = decoContent(d);
    const cx = Math.floor(r.x / CELL) + Math.floor(r.w / CELL / 2);
    const cy = Math.floor((r.y + r.h) / CELL);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (reach.has(`${cx + dx},${cy + dy}`)) return true;
      }
    }
    return false;
  });

  placeDeco(world, rand);

  placeWaterRocks(world, rand);

  return world;
}

export function movePlayer(world: World, dx: number, dy: number, step: number): boolean {
  if (dx < 0) world.player.facing = 'left';
  else if (dx > 0) world.player.facing = 'right';
  else if (dy < 0) world.player.facing = 'up';
  else if (dy > 0) world.player.facing = 'down';

  let moved = false;
  // Sub-step so solid footprints are never tunneled through at low FPS.
  const maxStep = 8;
  const chunks = Math.max(1, Math.ceil(Math.abs(step) / maxStep));
  const sub = step / chunks;
  for (let i = 0; i < chunks; i++) {
    let stepped = false;
    if (dx !== 0) {
      const nx = world.player.x + dx * sub;
      if (canOccupyAt(world, nx, world.player.y)) {
        world.player.x = nx;
        stepped = true;
        moved = true;
      }
    }
    if (dy !== 0) {
      const ny = world.player.y + dy * sub;
      if (canOccupyAt(world, world.player.x, ny)) {
        world.player.y = ny;
        stepped = true;
        moved = true;
      }
    }
    if (!stepped) break;
  }
  return moved;
}

/**
 * A* pathfinding over the sub-grid walk lattice (the same CELL grid used for
 * reachability). Returns the walkable waypoints from the start cell to the end
 * cell as cell-center pixel positions (excluding the start cell, including the
 * target), or null when no route exists. A cell is open when the character body
 * fits at its center (canOccupyAt), so water, cliffs, trees, and buildings are
 * avoided while grass/beach/rock and staircases are traversable.
 */
export function findPath(
  world: World,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
): Array<{ px: number; py: number }> | null {
  const cols = Math.floor((world.width * TILE) / CELL);
  const rows = Math.floor((world.height * TILE) / CELL);
  const startX = Math.floor(sx / CELL);
  const startY = Math.floor(sy / CELL);
  const endX = Math.floor(ex / CELL);
  const endY = Math.floor(ey / CELL);
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  const openCell = (cx: number, cy: number): boolean => {
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return false;
    return canOccupyAt(world, cx * CELL + CELL / 2, cy * CELL + CELL / 2);
  };
  if (!openCell(endX, endY)) return null;
  if (startX === endX && startY === endY) return [];

  const g = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  const startKey = key(startX, startY);
  g.set(startKey, 0);
  // Open set kept sorted-ish by f via a linear min scan (the grid is tiny).
  const open: Array<[number, number, number]> = [[0, startX, startY]];
  const neighbors: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let visited = 0;
  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i][0] < open[best][0]) best = i;
    const [, cx, cy] = open.splice(best, 1)[0];
    if (cx === endX && cy === endY) {
      const path: Array<{ px: number; py: number }> = [];
      let cur = key(endX, endY);
      while (cur !== startKey) {
        const comma = cur.indexOf(',');
        const px = Number(cur.slice(0, comma));
        const py = Number(cur.slice(comma + 1));
        path.push({ px: px * CELL + CELL / 2, py: py * CELL + CELL / 2 });
        cur = cameFrom.get(cur)!;
      }
      return path.reverse();
    }
    const curKey = key(cx, cy);
    const gScore = g.get(curKey)!;
    for (const [dx, dy] of neighbors) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!openCell(nx, ny)) continue;
      const nKey = key(nx, ny);
      const tentative = gScore + 1;
      const prev = g.get(nKey);
      if (prev !== undefined && prev <= tentative) continue;
      g.set(nKey, tentative);
      cameFrom.set(nKey, curKey);
      open.push([tentative + Math.abs(nx - endX) + Math.abs(ny - endY), nx, ny]);
    }
    if (++visited > cols * rows * 4) return null;
  }
  return null;
}
