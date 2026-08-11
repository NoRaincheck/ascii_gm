import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { canOccupyAt, generateWorld, TILE } from '../lib/game.ts';

const W = 16;
const H = 16;

// Expected terraced layout for a 16x16 world:
//   rows 0-1:   all sea
//   rows 2-10:  cols 0-1 + 14-15 sea, cols 2-13 grass (plateau)
//   row 11:     cols 0-1 + 14-15 sea, col 8 stairs, rest of cols 2-13 cliff
//   rows 12-13: cols 0-1 + 14-15 sea, cols 2-13 grass (lower ground)
//   rows 14-15: cols 0-1 + 14-15 sea, cols 2-13 beach
const CLIFF_ROW = 11;
const STAIRS_COL = 8;

function world() {
  return generateWorld(12345, W, H);
}

Deno.test('terraced world — sea margins frame the island', () => {
  const w = world();
  // Top rows are sea.
  for (let tx = 0; tx < W; tx++) {
    assertEquals(w.terrain[0][tx], 'sea');
    assertEquals(w.terrain[1][tx], 'sea');
  }
  // Side columns are sea.
  for (let ty = 0; ty < H; ty++) {
    assertEquals(w.terrain[ty][0], 'sea');
    assertEquals(w.terrain[ty][15], 'sea');
  }
});

Deno.test('terraced world — beach sits at the bottom', () => {
  const w = world();
  for (const ty of [H - 2, H - 1]) {
    for (let tx = 2; tx < W - 2; tx++) {
      assertEquals(w.terrain[ty][tx], 'beach', `(tx=${tx},ty=${ty}) should be beach`);
    }
  }
});

Deno.test('terraced world — cliff band with a single stairs gap', () => {
  const w = world();
  let stairs = 0;
  let cliffs = 0;
  for (let tx = 0; tx < W; tx++) {
    const kind = w.terrain[CLIFF_ROW][tx];
    if (kind === 'stairs') stairs++;
    else if (kind === 'cliff') cliffs++;
    else assertEquals(kind, 'sea', `(tx=${tx},ty=${CLIFF_ROW}) should be sea`);
  }
  assertEquals(stairs, 1, 'exactly one stairs tile');
  assert(cliffs >= 10, `cliff band should have walls, got ${cliffs}`);
  assertEquals(w.terrain[CLIFF_ROW][STAIRS_COL], 'stairs');
});

Deno.test('terraced world — grass above and below the cliff band', () => {
  const w = world();
  for (let ty = 2; ty < CLIFF_ROW; ty++) {
    for (let tx = 2; tx < W - 2; tx++) {
      assertEquals(w.terrain[ty][tx], 'grass', `plateau (${tx},${ty})`);
    }
  }
  for (let ty = CLIFF_ROW + 1; ty < H - 2; ty++) {
    for (let tx = 2; tx < W - 2; tx++) {
      assertEquals(w.terrain[ty][tx], 'grass', `lower ground (${tx},${ty})`);
    }
  }
});

Deno.test('terraced world — every land tile is reachable through the stairs', () => {
  const w = world();
  const walkable = (k: string): boolean => k === 'grass' || k === 'beach' || k === 'stairs';
  const seen = new Set<string>();
  const queue: Array<[number, number]> = [[2, H - 2]];
  seen.add('2,14');
  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (!walkable(w.terrain[ny][nx])) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const kind = w.terrain[ty][tx];
      if (walkable(kind)) {
        assert(seen.has(`${tx},${ty}`), `walkable tile (${tx},${ty}) [${kind}] is unreachable`);
      }
    }
  }
});

Deno.test('terraced world — player cannot stand on the cliff face but can on the stairs', () => {
  const w = world();
  // Center of a cliff tile.
  const cliffX = 5 * TILE + TILE / 2;
  const cliffY = CLIFF_ROW * TILE + TILE / 2;
  assertEquals(canOccupyAt(w, cliffX, cliffY), false, 'cliff face blocks standing');
  // Center of the stairs tile.
  const stairsX = STAIRS_COL * TILE + TILE / 2;
  assertEquals(canOccupyAt(w, stairsX, cliffY), true, 'stairs tile is walkable');
  // Beach tile is walkable.
  assertEquals(canOccupyAt(w, 4 * TILE + TILE / 2, (H - 2) * TILE + TILE / 2), true);
});
