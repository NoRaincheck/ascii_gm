export interface Tree {
  x: number;
  y: number;
}

export interface Building {
  x: number;
  y: number;
}

export interface Player {
  x: number;
  y: number;
  facing: 'up' | 'down' | 'left' | 'right';
}

export interface World {
  width: number;
  height: number;
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

// Content bounds of each sprite (measured from the source PNGs), relative to a
// bottom-center anchor placed at the sprite's grid position.
const CHAR_RECT: Rect = { x: -7, y: -83, w: 78, h: 91 };
const TREE_RECT: Rect = { x: -21, y: -124, w: 111, h: 174 };
const HOUSE_RECT: Rect = { x: 10, y: -40, w: 108, h: 148 };

export function charRect(x: number, y: number): Rect {
  return { x: x * TILE + CHAR_RECT.x, y: y * TILE + CHAR_RECT.y, w: CHAR_RECT.w, h: CHAR_RECT.h };
}

export function treeRect(tx: number, ty: number): Rect {
  return { x: tx * TILE + 32 + TREE_RECT.x, y: ty * TILE + 64 + TREE_RECT.y, w: TREE_RECT.w, h: TREE_RECT.h };
}

export function houseRect(bx: number, by: number): Rect {
  return { x: bx * TILE + 64 + HOUSE_RECT.x, y: (by + 2) * TILE + HOUSE_RECT.y, w: HOUSE_RECT.w, h: HOUSE_RECT.h };
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

function inBounds(r: Rect, width: number, height: number): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= width * TILE && r.y + r.h <= height * TILE;
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

export function canOccupy(world: World, x: number, y: number): boolean {
  if (!inBounds(charRect(x, y), world.width, world.height)) return false;
  for (const t of world.trees) {
    if (intersects(charRect(x, y), treeRect(t.x, t.y))) return false;
  }
  for (const b of world.buildings) {
    if (intersects(charRect(x, y), houseRect(b.x, b.y))) return false;
  }
  return true;
}

function obstacleIntersectsObstacle(world: World, r: Rect): boolean {
  for (const t of world.trees) {
    if (intersects(r, treeRect(t.x, t.y))) return true;
  }
  for (const b of world.buildings) {
    if (intersects(r, houseRect(b.x, b.y))) return true;
  }
  return false;
}

export function generateWorld(seed: number, width = 16, height = 16): World {
  const rand = createRng(seed);
  const world: World = { width, height, trees: [], buildings: [], player: { x: 1, y: 1, facing: 'down' } };

  const numTrees = 4 + Math.floor(rand() * 4);
  let guard = 0;
  while (world.trees.length < numTrees && guard < 2000) {
    guard++;
    const tx = 1 + Math.floor(rand() * (width - 2));
    const ty = 2 + Math.floor(rand() * (height - 3));
    const r = treeRect(tx, ty);
    if (!inBounds(r, width, height)) continue;
    if (obstacleIntersectsObstacle(world, r)) continue;
    world.trees.push({ x: tx, y: ty });
  }

  const numBuildings = 1 + Math.floor(rand() * 2);
  guard = 0;
  while (world.buildings.length < numBuildings && guard < 2000) {
    guard++;
    const bx = Math.floor(rand() * (width - 1));
    const by = 1 + Math.floor(rand() * (height - 3));
    const r = houseRect(bx, by);
    if (!inBounds(r, width, height)) continue;
    if (obstacleIntersectsObstacle(world, r)) continue;
    world.buildings.push({ x: bx, y: by });
  }

  let bestScore = -1;
  let best: Player = { x: 1, y: 1, facing: 'down' };
  for (let attempt = 0; attempt < 1000; attempt++) {
    const x = 1 + Math.floor(rand() * (width - 2));
    const y = 2 + Math.floor(rand() * (height - 3));
    if (!canOccupy(world, x, y)) continue;
    const score = reachableArea(world, x, y);
    if (score > bestScore) {
      bestScore = score;
      best = { x, y, facing: 'down' };
      if (score > 60) break;
    }
  }
  world.player = best;

  return world;
}

function reachableArea(world: World, sx: number, sy: number): number {
  const seen = new Set<string>([`${sx},${sy}`]);
  const queue: Array<[number, number]> = [[sx, sy]];
  let count = 1;
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      if (!canOccupy(world, nx, ny)) continue;
      seen.add(key);
      queue.push([nx, ny]);
      count++;
    }
  }
  return count;
}

export function movePlayer(world: World, dx: number, dy: number): boolean {
  if (dx < 0) world.player.facing = 'left';
  else if (dx > 0) world.player.facing = 'right';
  else if (dy < 0) world.player.facing = 'up';
  else if (dy > 0) world.player.facing = 'down';

  const nx = world.player.x + dx;
  const ny = world.player.y + dy;
  if (!canOccupy(world, nx, ny)) return false;
  world.player.x = nx;
  world.player.y = ny;
  return true;
}
