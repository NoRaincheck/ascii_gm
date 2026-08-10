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

export interface Player {
  x: number;
  y: number;
  facing: 'up' | 'down' | 'left' | 'right';
}

export type TerrainKind = 'sea' | 'coast' | 'beach' | 'grass';

export interface World {
  width: number;
  height: number;
  terrain: TerrainKind[][];
  trees: Tree[];
  buildings: Building[];
  player: Player;
}

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

// The world is always an island: a large grass mass, a sand beach ring, a
// foamy coast ring, then deep sea. Ellipse shape with seeded size variation.
function buildIsland(world: World, rand: () => number): void {
  const cx = (world.width - 1) / 2;
  const cy = (world.height - 1) / 2;
  const rx = world.width * (0.42 + rand() * 0.04);
  const ry = world.height * (0.42 + rand() * 0.04);
  world.terrain = [];
  for (let ty = 0; ty < world.height; ty++) {
    const row: TerrainKind[] = [];
    for (let tx = 0; tx < world.width; tx++) {
      const d = Math.hypot((tx - cx) / rx, (ty - cy) / ry);
      if (d > 1) row.push('sea');
      else if (d > 0.92) row.push('coast');
      else if (d > 0.78) row.push('beach');
      else row.push('grass');
    }
    world.terrain.push(row);
  }
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

export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canOccupyAt(world: World, px: number, py: number): boolean {
  if (!inBounds(charRect(px, py), world.width, world.height)) return false;
  // Cannot stand in the water (deep sea or foamy coast).
  for (const kind of standingTileKinds(world, px, py)) {
    if (kind === 'sea' || kind === 'coast') return false;
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

const CELL = 32;

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

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateWorld(seed: number, width = 16, height = 16): World {
  const rand = createRng(seed);
  const world: World = { width, height, terrain: [], trees: [], buildings: [], player: { x: 0, y: 0, facing: 'down' } };
  buildIsland(world, rand);

  // Landmarks sit on a lattice so they line up nicely on the grid.
  const treeSlots = shuffle(
    (() => {
      const slots: Array<[number, number]> = [];
      for (let ty = 2; ty + 2 < height; ty += 3) {
        for (let tx = 2; tx + 1 < width; tx += 3) {
          slots.push([tx, ty]);
        }
      }
      return slots;
    })(),
    rand,
  );

  const numTrees = 5 + Math.floor(rand() * 4);
  for (const [tx, ty] of treeSlots) {
    if (world.trees.length >= numTrees) break;
    const r = treeContent({ x: tx, y: ty });
    if (!inBounds(r, width, height)) continue;
    if (contentOverlaps(world, r)) continue;
    if (!rectOnGrass(world, r)) continue;
    world.trees.push({ x: tx, y: ty });
  }

  const numBuildings = 1 + Math.floor(rand() * 2);
  const houseSlots = shuffle(
    (() => {
      const slots: Array<[number, number]> = [];
      for (let by = 2; by + 2 < height; by += 3) {
        for (let bx = 2; bx + 2 < width; bx += 3) {
          slots.push([bx, by]);
        }
      }
      return slots;
    })(),
    rand,
  );
  for (const [bx, by] of houseSlots) {
    if (world.buildings.length >= numBuildings) break;
    const type = BUILDING_TYPES[Math.floor(rand() * BUILDING_TYPES.length)];
    const r = buildingContent({ x: bx, y: by, type });
    if (!inBounds(r, width, height)) continue;
    if (contentOverlaps(world, r)) continue;
    if (!rectOnGrass(world, r)) continue;
    world.buildings.push({ x: bx, y: by, type });
  }

  // Spawn on the most open connected area.
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
      if (score > 700) break;
    }
  }
  world.player = best;

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
  const baseReachable = (px: number, py: number): boolean => {
    const cx = Math.floor(px / CELL);
    const cy = Math.floor(py / CELL);
    // The body is 36px tall, so it must stand a cell or two clear of a large
    // footprint (e.g. below a house wall) before it can close in on the base.
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (reach.has(`${cx + dx},${cy + dy}`)) return true;
      }
    }
    return false;
  };
  world.trees = world.trees.filter((t) => {
    const s = treeSolid(t);
    return baseReachable(s.x + s.w / 2, s.y + s.h);
  });
  world.buildings = world.buildings.filter((b) => {
    const s = buildingSolid(b);
    return baseReachable(s.x + s.w / 2, s.y + s.h);
  });

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
