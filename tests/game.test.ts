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