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

export type RoomType = 'rock' | 'grass' | 'beach';

export interface StairRun {
  start: number;
  width: number;
  row: number;
}

// A room is a level in the house: a rectangle of a single terrain kind. Rooms
// are laid out in three stacked levels — rock halls on top, a grass courtyard
// in the middle, beach shore at the bottom — each level a full-width slab split
// into one or more side-by-side rooms sharing the level's rows. Rooms on the
// same level sit flush (same kind, no wall between them); a room overlaps the
// rooms on the levels above/below it and gets a doorway (a `stairs` run in the
// shared wall band) into every one of them, so a room joins *several* rooms up
// and down. `world.stairs` records each doorway run.
export interface Room {
  type: RoomType;
  x: number; // left column (inclusive)
  y: number; // top row (inclusive)
  width: number; // in tiles
  height: number; // in tiles
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

// True when a land tile (beach/grass/rock) has an orthogonal water (sea/coast)
// neighbor. Foam is centered on these land tiles: the opaque land tile drawn
// above hides the foam blob's full center, leaving only the outer foam strips
// to ripple out over the adjacent water.
export function landTouchesWater(world: World, tx: number, ty: number): boolean {
  const kind = terrainAt(world, tx, ty);
  if (kind !== 'beach' && kind !== 'grass' && kind !== 'rock') return false;
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

// The world is a vertical stack of rooms ("rooms in a house"). Each room is a
// square-ish rectangle of one terrain kind — rock, grass, or beach — and each
// is a level you descend. The rooms are stacked top→down in a relaxed order:
// a room's type may only transition DOWN per the DAG rock→grass/beach,
// grass→beach (the level index never increases going down, and rock may skip
// straight to beach). The top/bottom rooms are not fixed.
//
// Between every pair of adjacent rooms sits a single-row wall band. Where the
// two rectangles horizontally overlap, that row becomes a cliff face except
// for one 1–3-wide staircase — the "door" between the rooms. Rooms may be
// horizontally offset from one another, so a room that is wider than (or
// simply offset from) its neighbor hangs over the sea; its autotiled edge
// becomes a cliff lip facing the water. Because doors live only on the shared
// north/south walls (the horizontal bands), a room connects only to the ones
// directly above and below it — never side by side.
//
// Generation steps:
//   1) Room types via the DAG (top→down), biased toward descending.
//   2) Heights split the usable rows among the rooms (each band takes one row
//      between a pair); widths are drawn "square-ish" (close to the height).
//   3) Random horizontal offsets per room; adjacent pairs are then nudged so
//      every shared wall still overlaps for a doorway (a door needs just one
//      shared column, and full-overlap alignment guarantees it).
//   4) Sea base ← room rects ← wall bands with 1–3-wide stairs at each overlap.
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

  // ── Three levels, top→down: rock halls, grass courtyard, beach shore ──────
  // Each level is a horizontal run of one terrain kind, split into one or more
  // side-by-side rooms sharing the level's rows. Rooms within a level sit flush
  // (same kind, no wall between them); a room that overlaps rooms on the level
  // below/above gets a doorway (a `stairs` run in the shared wall band) into
  // every one of them, so a room can join *several* rooms up and down.
  // The middle (grass) run always spans the full usable width — that anchors
  // connectivity — while the rock and beach runs may be narrower, leaving open
  // sea at their flanks for a varied coastline.
  const LEVEL_TYPES: RoomType[] = ['rock', 'grass', 'beach'];

  // ── Minimal total area per terrain kind (cells) ───────────────────────────
  // The rooms of one level together must cover at least this many cells; note
  // this is the *combined* area of every room of that kind, so e.g. three small
  // beach rooms still add up to one big beach. Deeper levels get a bigger share.
  const usableCells = usableRows * usableCols;
  const areaTarget = (t: RoomType): number => {
    const pct = t === 'rock' ? 0.18 : t === 'grass' ? 0.22 : 0.26;
    return Math.round(usableCells * pct);
  };

  // Rooms per level: as many as the minimum room width allows (1-3).
  const maxRooms = clamp(Math.floor(usableCols / MIN_W), 1, 3);
  const counts = LEVEL_TYPES.map(() => 1 + Math.floor(rand() * maxRooms));

  // Horizontal span of each level's run. Grass spans the full width; rock and
  // beach may pull in from either side (0-2 columns), never narrower than the
  // level's own rooms need.
  const spans: Array<{ start: number; end: number }> = LEVEL_TYPES.map((_, z) => {
    const marginL = z === 1 ? 0 : Math.floor(rand() * 3);
    const marginR = z === 1 ? 0 : Math.floor(rand() * 3);
    let start = leftCol + marginL;
    let end = rightCol - marginR;
    const need = Math.min(counts[z] * MIN_W, usableCols);
    if (end - start + 1 < need) {
      const over = need - (end - start + 1);
      start = clamp(start - over, leftCol, rightCol);
      end = clamp(end + over, leftCol, rightCol);
    }
    return { start, end };
  });
  const spanWidths = spans.map((s) => s.end - s.start + 1);

  // Heights: height alone sizes a level's area (span × height).
  const minH: number[] = LEVEL_TYPES.map((t, z) =>
    clamp(Math.ceil(areaTarget(t) / spanWidths[z]), MIN_H, MAX_H)
  );
  // Rows available for the levels themselves (minus one wall band per boundary).
  const zoneRows = usableRows - (LEVEL_TYPES.length - 1);
  while (minH.reduce((a, b) => a + b, 0) > zoneRows) {
    const i = minH.indexOf(Math.max(...minH));
    minH[i] = Math.max(MIN_H, minH[i] - 1);
  }
  // Spread any leftover rows across the levels (bounded by MAX_H).
  const heights = [...minH];
  let extra = zoneRows - heights.reduce((a, b) => a + b, 0);
  for (const i of shuffleWith([0, 1, 2], rand)) {
    while (extra > 0 && heights[i] < MAX_H) {
      heights[i]++;
      extra--;
    }
    if (extra <= 0) break;
  }

  // Build the room rects: each level is a contiguous partition of its span.
  const zones: Room[][] = [];
  let top = topRow;
  for (let z = 0; z < LEVEL_TYPES.length; z++) {
    const widths: number[] = [];
    let gap = spanWidths[z];
    for (let i = 0; i < counts[z]; i++) {
      const leftover = counts[z] - i - 1;
      const w = i === counts[z] - 1
        ? gap
        : MIN_W + Math.floor(rand() * (gap - leftover * MIN_W - MIN_W + 1));
      widths.push(w);
      gap -= w;
    }
    const levelRooms: Room[] = [];
    let x = spans[z].start;
    for (const w of widths) {
      levelRooms.push({ type: LEVEL_TYPES[z], x, y: top, width: w, height: heights[z] });
      x += w;
    }
    zones.push(levelRooms);
    top += heights[z] + 1; // +1 = the wall band between this level and the next
  }
  const rooms = zones.flat();

  // ── Terrain: sea base, room rects, then doorway bands ─────────────────────
  const terrain: TerrainKind[][] = [];
  for (let ty = 0; ty < height; ty++) terrain.push(new Array<TerrainKind>(width).fill('sea'));
  for (const r of rooms) {
    for (let ty = r.y; ty < r.y + r.height; ty++) {
      for (let tx = r.x; tx < r.x + r.width; tx++) terrain[ty][tx] = r.type;
    }
  }

  // A wall band with one door per overlapping (upper, lower) room pair. Only
  // columns claimed by a room on BOTH levels become wall (with a doorway); the
  // rest of the band row stays open sea. A single room on one level that spans
  // across several rooms on the level below gets one doorway into *each* of
  // them, so a room can join multiple rooms up or down. A door must have a
  // non-sea column on each side (at least a cliff lip) so the stairs never butt
  // against the open sea at the run's flanks.
  const stairs: StairRun[] = [];
  for (let z = 0; z < zones.length - 1; z++) {
    const up = zones[z];
    const down = zones[z + 1];
    const bandRow = up[0].y + up[0].height;
    // Carve the whole wall first so every overlapping column is cliff before
    // any door is placed — that way a door at a segment edge sees its neighbour
    // cell (in an adjacent segment) as cliff, not as unprocessed sea.
    const spans: Array<{ s: number; e: number }> = [];
    for (const u of up) {
      for (const l of down) {
        const s = Math.max(u.x, l.x);
        const e = Math.min(u.x + u.width, l.x + l.width) - 1;
        if (s > e) continue;
        spans.push({ s, e });
        for (let c = s; c <= e; c++) terrain[bandRow][c] = 'cliff';
      }
    }
    // Place one door per overlapping pair. A door must have a non-sea column on
    // each side (at least a cliff lip) so the stairs never butt against the open
    // sea at the run's flanks; if none fits, the pair shares a door with a
    // neighbouring pair on the same wall (or the level's run).
    for (const { s, e } of spans) {
      const segW = e - s + 1;
      const candidates: Array<{ start: number; width: number }> = [];
      for (let w = Math.min(3, segW); w >= 1; w--) {
        for (let st = s; st <= e - w + 1; st++) candidates.push({ start: st, width: w });
      }
      shuffleWith(candidates, rand);
      const fits = ({ start: st, width: w }: { start: number; width: number }): boolean => {
        const left = st - 1 < 0 ? 'sea' : terrain[bandRow][st - 1];
        const right = st + w >= world.width ? 'sea' : terrain[bandRow][st + w];
        return left !== 'sea' && left !== 'coast' && right !== 'sea' && right !== 'coast';
      };
      const door = candidates.find(fits);
      if (!door) continue;
      for (let c = door.start; c < door.start + door.width; c++) terrain[bandRow][c] = 'stairs';
      stairs.push({ start: door.start, width: door.width, row: bandRow });
    }
  }

  world.terrain = terrain;
  world.stairs = stairs;
  world.rooms = rooms;
  world.level = Math.max(...rooms.map((r) => ROOM_LEVEL[r.type]));
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

// Landmarks only sit on the lawn — every tile under the content rect must be grass.
// Trees only go on grass.
function rectOnGrass(world: World, r: Rect): boolean {
  const x0 = Math.floor(r.x / TILE);
  const y0 = Math.floor(r.y / TILE);
  const x1 = Math.floor((r.x + r.w - 1) / TILE);
  const y1 = Math.floor((r.y + r.h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (terrainAt(world, tx, ty) !== 'grass') return false;
    }
  }
  return true;
}

/**
 * Check if a rect sits on walkable terrain suitable for buildings
 * (grass or rock, but not beach, sea, coast, or cliff).
 */
function rectOnBuildingSite(world: World, r: Rect): boolean {
  const x0 = Math.floor(r.x / TILE);
  const y0 = Math.floor(r.y / TILE);
  const x1 = Math.floor((r.x + r.w - 1) / TILE);
  const y1 = Math.floor((r.y + r.h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const kind = terrainAt(world, tx, ty);
      if (kind !== 'grass' && kind !== 'rock') return false;
    }
  }
  return true;
}

/**
 * Check if a rect sits on any walkable terrain (grass, beach, or rock).
 */
function rectOnWalkable(world: World, r: Rect): boolean {
  const x0 = Math.floor(r.x / TILE);
  const y0 = Math.floor(r.y / TILE);
  const x1 = Math.floor((r.x + r.w - 1) / TILE);
  const y1 = Math.floor((r.y + r.h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const kind = terrainAt(world, tx, ty);
      if (kind !== 'grass' && kind !== 'beach' && kind !== 'rock') return false;
    }
  }
  return true;
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

function reachableAt(world: World, sx: number, sy: number): number {
  const cols = Math.floor((world.width * TILE) / CELL);
  const rows = Math.floor((world.height * TILE) / CELL);
  const blocked = (cx: number, cy: number): boolean => !canOccupyAt(world, cx * CELL + CELL / 2, cy * CELL + CELL / 2);
  const startX = Math.floor(sx / CELL);
  const startY = Math.floor(sy / CELL);
  if (blocked(startX, startY)) return 0;
  const seen = new Set<string>([`${startX},${startY}`]);
  const queue: Array<[number, number]> = [[startX, startY]];
  let count = 1;
  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      if (blocked(nx, ny)) continue;
      seen.add(key);
      queue.push([nx, ny]);
      count++;
    }
  }
  return count;
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
  const grassRooms = world.rooms.filter((r) => r.type === 'grass');
  const treeSlots: Array<[number, number]> = [];
  if (grassRooms.length > 0) {
    const gx0 = Math.min(...grassRooms.map((r) => r.x));
    const gx1 = Math.max(...grassRooms.map((r) => r.x + r.width)) - 1;
    const gy0 = grassRooms[0].y;
    const gh = grassRooms[0].height;
    for (let ty = gy0 + 2; ty < gy0 + gh - 2; ty += 2) {
      for (let tx = gx0; tx <= gx1; tx += 2) treeSlots.push([tx, ty]);
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

  // Spawn on the most open connected area.
  const totalCells = Math.floor((width * TILE) / CELL) * Math.floor((height * TILE) / CELL);
  let bestScore = -1;
  let best: Player = { x: TILE, y: TILE, facing: 'down' };
  for (let attempt = 0; attempt < 400; attempt++) {
    const px = TILE + Math.floor(rand() * (width - 2) * TILE / CELL) * CELL + CELL / 2;
    const py = TILE + Math.floor(rand() * (height - 2) * TILE / CELL) * CELL + CELL / 2;
    if (!canOccupyAt(world, px, py)) continue;
    const score = reachableAt(world, px, py);
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
  const reach = new Set<string>();
  (() => {
    const cols = Math.floor((world.width * TILE) / CELL);
    const rows = Math.floor((world.height * TILE) / CELL);
    const startX = Math.floor(world.player.x / CELL);
    const startY = Math.floor(world.player.y / CELL);
    const queue: Array<[number, number]> = [[startX, startY]];
    reach.add(`${startX},${startY}`);
    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const key = `${nx},${ny}`;
        if (reach.has(key)) continue;
        if (!canOccupyAt(world, nx * CELL + CELL / 2, ny * CELL + CELL / 2)) continue;
        reach.add(key);
        queue.push([nx, ny]);
      }
    }
  })();
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
