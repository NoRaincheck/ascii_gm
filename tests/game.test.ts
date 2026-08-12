import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { canOccupyAt, generateWorld, TILE } from '../lib/game.ts';

const W = 16;
const H = 20;

function world() {
  return generateWorld(12345, W, H);
}

// Rows of the cliff band (rows that contain cliff/stairs in cols 2-13).
function cliffBandRows(w: ReturnType<typeof world>): number[] {
  const rows: number[] = [];
  for (let ty = 0; ty < H; ty++) {
    if (w.terrain[ty].some((k, tx) => tx >= 2 && tx < W - 2 && (k === 'cliff' || k === 'stairs'))) {
      rows.push(ty);
    }
  }
  return rows;
}

// Contiguous stairs runs [start, end] in a given row.
function stairsRuns(w: ReturnType<typeof world>, ty: number): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start = -1;
  for (let tx = 0; tx < W; tx++) {
    const isStairs = w.terrain[ty][tx] === 'stairs';
    if (isStairs && start === -1) start = tx;
    if (!isStairs && start !== -1) {
      runs.push([start, tx - 1]);
      start = -1;
    }
  }
  if (start !== -1) runs.push([start, W - 1]);
  return runs;
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

Deno.test('terraced world — two cliff rows with 1-3-wide stairs runs ≥10 apart', () => {
  const w = world();
  const bands = cliffBandRows(w);
  assertEquals(bands.length, 2, 'the terrace has exactly two cliff bands');
  for (const ty of bands) {
    const runs = stairsRuns(w, ty);
    assert(runs.length >= 1, 'at least one staircase per band');
    for (const [s, e] of runs) {
      const width = e - s + 1;
      assert(width >= 1 && width <= 3, `stair run ${s}-${e} (width ${width}) should be 1-3`);
    }
    for (let i = 1; i < runs.length; i++) {
      const gap = runs[i][0] - runs[i - 1][1];
      assert(gap >= 10, `stairs gap of ${gap} must be ≥ 10 units`);
    }
    // Every interior tile in the band is either stairs or cliff; margins are sea.
    for (let tx = 0; tx < W; tx++) {
      const kind = w.terrain[ty][tx];
      if (tx < 2 || tx >= W - 2) {
        assertEquals(kind, 'sea', `margin tile (tx=${tx},ty=${ty})`);
      } else {
        assert(kind === 'cliff' || kind === 'stairs', `band tile (${tx},${ty}) = ${kind}`);
      }
    }
  }
});

Deno.test('terraced world — world.stairs runs match the terrain', () => {
  const w = world();
  for (const band of cliffBandRows(w)) {
    const runs = stairsRuns(w, band);
    const recorded = w.stairs.filter((s) => s.row === band);
    assertEquals(recorded.length, runs.length, 'one world.stairs entry per terrain run');
    for (const [i, [s, e]] of runs.entries()) {
      const run = recorded[i];
      assertEquals(run.start, s, `run ${i} start`);
      assertEquals(run.width, e - s + 1, `run ${i} width`);
    }
  }
});

Deno.test('terraced world — three distinct terrain levels: rock, grass, beach', () => {
  const w = world();
  const bands = cliffBandRows(w);
  const upper = Math.min(...bands);
  const lower = Math.max(...bands);
  // Top level (above upper cliff) → rock
  for (let ty = 2; ty < upper; ty++) {
    for (let tx = 2; tx < W - 2; tx++) {
      assertEquals(w.terrain[ty][tx], 'rock', `top plateau (${tx},${ty})`);
    }
  }
  // Middle level (between cliff bands) → grass
  for (let ty = upper + 1; ty < lower; ty++) {
    for (let tx = 2; tx < W - 2; tx++) {
      assertEquals(w.terrain[ty][tx], 'grass', `mid terrace (${tx},${ty})`);
    }
  }
  // Bottom level (below lower cliff) → beach
  for (let ty = lower + 1; ty < H; ty++) {
    for (let tx = 2; tx < W - 2; tx++) {
      assertEquals(w.terrain[ty][tx], 'beach', `lower ground (${tx},${ty})`);
    }
  }
});

Deno.test('terraced world — every land tile is reachable through the stairs', () => {
  const w = world();
  const walkable = (k: string): boolean => k === 'grass' || k === 'beach' || k === 'rock' || k === 'stairs';
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
  for (const ty of cliffBandRows(w)) {
    let cliffTx = -1;
    let stairsTx = -1;
    for (let tx = 2; tx < W - 2; tx++) {
      if (w.terrain[ty][tx] === 'cliff') cliffTx = tx;
      if (w.terrain[ty][tx] === 'stairs' && stairsTx === -1) stairsTx = tx;
    }
    assert(cliffTx !== -1, 'expected a cliff tile');
    assert(stairsTx !== -1, 'expected a stairs tile');
    const bandY = ty * TILE + TILE / 2;
    assertEquals(canOccupyAt(w, cliffTx * TILE + TILE / 2, bandY), false, 'cliff face blocks standing');
    assertEquals(canOccupyAt(w, stairsTx * TILE + TILE / 2, bandY), true, 'stairs tile is walkable');
  }
  assertEquals(canOccupyAt(w, 4 * TILE + TILE / 2, (H - 2) * TILE + TILE / 2), true);
});

// ── Buildings on grassland ──────────────────────────────────────────────────

Deno.test('buildings can be generated on grassland', () => {
  // Generate multiple worlds to increase chance of hitting grass buildings
  let foundGrassBuilding = false;
  for (let seed = 1; seed <= 50; seed++) {
    const w = generateWorld(seed, W, H);
    for (const b of w.buildings) {
      // Check if the building sits on grass terrain
      const ty = b.y;
      const tx = b.x;
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          if (ty + dy < H && tx + dx < W) {
            if (w.terrain[ty + dy][tx + dx] === 'grass') {
              foundGrassBuilding = true;
              break;
            }
          }
        }
      }
    }
    if (foundGrassBuilding) break;
  }
  assert(foundGrassBuilding, 'at least one building should be placed on grass terrain');
});

// ── Stair accessibility ─────────────────────────────────────────────────────

Deno.test('stairs are reachable from both top and bottom', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const w = generateWorld(seed, W, H);
    for (const stair of w.stairs) {
      const { start, width, row } = stair;
      const midCol = start + Math.floor(width / 2);
      
      // Check above (towards rock/grass): rows row-1, row-2, ...
      let aboveClear = false;
      for (let dr = 1; dr <= 5; dr++) {
        const ry = row - dr;
        if (ry < 0) break;
        const kind = w.terrain[ry][midCol];
        if (kind === 'grass' || kind === 'rock' || kind === 'beach') {
          aboveClear = true;
          break;
        }
      }
      
      // Check below (towards grass/beach): rows row+1, row+2, ...
      let belowClear = false;
      for (let dr = 1; dr <= 5; dr++) {
        const ry = row + dr;
        if (ry >= H) break;
        const kind = w.terrain[ry][midCol];
        if (kind === 'grass' || kind === 'rock' || kind === 'beach') {
          belowClear = true;
          break;
        }
      }
      
      assert(aboveClear, `stair at (${midCol},${row}) should be reachable from above`);
      assert(belowClear, `stair at (${midCol},${row}) should be reachable from below`);
    }
  }
});

// ── Pruning blocking elements ───────────────────────────────────────────────

Deno.test('trees and buildings block stair entryways are pruned', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const w = generateWorld(seed, W, H);
    for (const stair of w.stairs) {
      const { start, width, row } = stair;
      const midCol = start + Math.floor(width / 2);
      
      // Check that no tree blocks the stair entry zone
      for (const t of w.trees) {
        const colDiff = Math.abs(t.x - midCol);
        const rowDiff = Math.abs(t.y - row);
        assert(
          !(colDiff <= 3 && rowDiff <= 2),
          `tree at (${t.x},${t.y}) should not block stair entry at (${midCol},${row})`,
        );
      }
      
      // Check that no building blocks the stair entry zone
      for (const b of w.buildings) {
        const colDiff = Math.abs(b.x - midCol);
        const rowDiff = Math.abs(b.y - row);
        assert(
          !(colDiff <= 3 && rowDiff <= 2),
          `building at (${b.x},${b.y}) should not block stair entry at (${midCol},${row})`,
        );
      }
    }
  }
});