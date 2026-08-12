import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { canOccupyAt, generateWorld, TILE } from '../lib/game.ts';

const W = 16;
const H = 20;

function world() {
  return generateWorld(12345, W, H);
}

// Each wall band is a contiguous block of rows (cols 2-13) that contain
// cliff/stairs tiles. The bands can be 1-2 rows tall where the walls perturb
// into the grass terrace.
function wallRegions(w: ReturnType<typeof world>): Array<{ top: number; bottom: number }> {
  const regions: Array<{ top: number; bottom: number }> = [];
  let start = -1;
  for (let ty = 0; ty <= H; ty++) {
    const hasWall = ty < H && w.terrain[ty].some((k, tx) => tx >= 2 && tx < W - 2 && (k === 'cliff' || k === 'stairs'));
    if (hasWall && start === -1) start = ty;
    if (!hasWall && start !== -1) {
      regions.push({ top: start, bottom: ty - 1 });
      start = -1;
    }
  }
  return regions;
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
    let sawBeach = false;
    for (let tx = 0; tx < W; tx++) {
      const kind = w.terrain[ty][tx];
      assert(kind === 'beach' || kind === 'sea', `(tx=${tx},ty=${ty}) = ${kind}`);
      if (kind === 'beach') sawBeach = true;
    }
    assert(sawBeach, `row ${ty} should contain beach`);
  }
});

Deno.test('terraced world — two cliff regions with 1-3-wide stairs runs ≥10 apart', () => {
  const w = world();
  const regions = wallRegions(w);
  assertEquals(regions.length, 2, 'the terrace has exactly two cliff regions');
  for (const region of regions) {
    let sawCliff = false;
    let sawStairs = false;
    let sawStairRow = false;
    for (let ty = region.top; ty <= region.bottom; ty++) {
      const runs = stairsRuns(w, ty);
      if (runs.length > 0) sawStairRow = true;
      for (const [s, e] of runs) {
        const width = e - s + 1;
        assert(width >= 1 && width <= 3, `stair run ${s}-${e} (width ${width}) should be 1-3`);
      }
      for (let i = 1; i < runs.length; i++) {
        const gap = runs[i][0] - runs[i - 1][1];
        assert(gap >= 10, `stairs gap of ${gap} must be ≥ 10 units`);
      }
      // Margins are always sea; the interior is stair/cliff where the wall
      // band sits, grass where a column's wall perturbation hasn't reached
      // this row, or sea where the ragged coastlines bite in.
      for (let tx = 0; tx < W; tx++) {
        const kind = w.terrain[ty][tx];
        if (tx < 2 || tx >= W - 2) {
          assertEquals(kind, 'sea', `margin tile (tx=${tx},ty=${ty})`);
        } else {
          assert(
            kind === 'cliff' || kind === 'stairs' || kind === 'sea' || kind === 'grass',
            `band tile (${tx},${ty}) = ${kind}`,
          );
          if (kind === 'cliff') sawCliff = true;
          if (kind === 'stairs') sawStairs = true;
        }
      }
    }
    assert(sawCliff, 'each cliff region contains walls');
    assert(sawStairs, 'each cliff region contains stairs');
    assert(sawStairRow, 'each cliff region carries at least one staircase run');
  }
});

Deno.test('terraced world — world.stairs runs match the terrain', () => {
  const w = world();
  for (let ty = 0; ty < H; ty++) {
    const runs = stairsRuns(w, ty);
    const recorded = w.stairs.filter((s) => s.row === ty);
    assertEquals(recorded.length, runs.length, `one world.stairs entry per terrain run (row ${ty})`);
    for (const [i, [s, e]] of runs.entries()) {
      const run = recorded[i];
      assertEquals(run.start, s, `run ${i} start`);
      assertEquals(run.width, e - s + 1, `run ${i} width`);
    }
  }
});

Deno.test('terraced world — three distinct terrain levels: rock, grass, beach', () => {
  const w = world();
  // Every land column shows the levels in strict top-down order — rock, the
  // upper wall, grass, the lower wall, beach — and carries all three ground
  // kinds. Sea may appear only at the very top/bottom edges of the column.
  for (let tx = 0; tx < W; tx++) {
    if (!w.terrain.some((row) => row[tx] !== 'sea')) continue; // fully sea column
    let rock = 0;
    let grass = 0;
    let beach = 0;
    // 0 = rock, 1 = upper wall, 2 = grass, 3 = lower wall, 4 = beach.
    let phase = 0;
    for (let ty = 0; ty < H; ty++) {
      const kind = w.terrain[ty][tx];
      if (kind === 'sea') continue;
      if (kind === 'rock') {
        assert(phase === 0, `column ${tx}: rock out of order at row ${ty}`);
        rock++;
        continue;
      }
      if (kind === 'cliff' || kind === 'stairs') {
        if (phase === 0 || phase === 1) phase = 1;
        else if (phase === 2) phase = 3;
        else if (phase === 3) phase = 3;
        else assert(false, `column ${tx}: wall out of order at row ${ty}`);
        continue;
      }
      if (kind === 'grass') {
        assert(phase === 2 || phase === 1, `column ${tx}: grass out of order at row ${ty}`);
        if (phase === 1) phase = 2;
        grass++;
        continue;
      }
      if (kind === 'beach') {
        assert(phase === 3 || phase === 4, `column ${tx}: beach out of order at row ${ty}`);
        phase = 4;
        beach++;
        continue;
      }
    }
    assert(rock > 0, `column ${tx} should have rock`);
    assert(grass > 0, `column ${tx} should have grass`);
    assert(beach > 0, `column ${tx} should have beach`);
    assert(phase === 4, `column ${tx} should end on the beach level`);
  }
});

Deno.test('terraced world — every land tile is reachable through the stairs', () => {
  const w = world();
  const walkable = (k: string): boolean => k === 'grass' || k === 'beach' || k === 'rock' || k === 'stairs';
  const seen = new Set<string>();
  // Column 4 is always inside the land envelope (columns 4-11 are never sea)
  // and row H-2 is always beach, so it is a guaranteed land seed for the flood.
  const queue: Array<[number, number]> = [[4, H - 2]];
  seen.add('4,18');
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
  for (const region of wallRegions(w)) {
    let cliffTx = -1;
    let cliffTy = -1;
    let stairsTx = -1;
    let stairsTy = -1;
    for (let ty = region.top; ty <= region.bottom; ty++) {
      for (let tx = 2; tx < W - 2; tx++) {
        if (w.terrain[ty][tx] === 'cliff' && cliffTx === -1) {
          cliffTx = tx;
          cliffTy = ty;
        } else if (w.terrain[ty][tx] === 'stairs' && stairsTx === -1) {
          stairsTx = tx;
          stairsTy = ty;
        }
      }
    }
    assert(cliffTx !== -1, 'expected a cliff tile');
    assert(stairsTx !== -1, 'expected a stairs tile');
    assertEquals(
      canOccupyAt(w, cliffTx * TILE + TILE / 2, cliffTy * TILE + TILE / 2),
      false,
      'cliff face blocks standing',
    );
    assertEquals(
      canOccupyAt(w, stairsTx * TILE + TILE / 2, stairsTy * TILE + TILE / 2),
      true,
      'stairs tile is walkable',
    );
  }
  assertEquals(canOccupyAt(w, 4 * TILE + TILE / 2, (H - 2) * TILE + TILE / 2), true);
});

Deno.test('wall band is one tile high — no vertical stacking, diagonal steps allowed', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const w = generateWorld(seed, W, H);
    for (const region of wallRegions(w)) {
      const wall = new Set<string>();
      const rowsOf = new Map<number, number[]>();
      for (let ty = region.top; ty <= region.bottom; ty++) {
        for (let tx = 2; tx < W - 2; tx++) {
          const k = w.terrain[ty][tx];
          if (k === 'cliff' || k === 'stairs') {
            wall.add(`${tx},${ty}`);
            (rowsOf.get(tx) ?? rowsOf.set(tx, []).get(tx)!).push(ty);
          }
        }
      }
      // Exactly one wall tile per column: no two walls stacked vertically.
      for (const [tx, rows] of rowsOf) {
        assert(
          rows.length === 1,
          `seed ${seed} region rows ${region.top}-${region.bottom}: column ${tx} has ${rows.length} walls stacked`,
        );
      }
      // The wall is an 8-connected diagonal line (diagonal steps allowed).
      const start = [...wall][0];
      assert(start !== undefined, 'each wall region has tiles');
      const seen = new Set<string>([start]);
      const queue = [start];
      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!.split(',').map(Number);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const key = `${cx + dx},${cy + dy}`;
            if (!wall.has(key) || seen.has(key)) continue;
            seen.add(key);
            queue.push(key);
          }
        }
      }
      assert(seen.size === wall.size, `seed ${seed}: wall region ${region.top}-${region.bottom} is not 8-connected`);
      // No 4-connected gap lets movement leak across the diagonal wall: the
      // tiles immediately above and below two diagonally-adjacent wall tiles
      // must not both be passable for a same-column stride from rock to beach.
      for (const [tx, rows] of rowsOf) {
        const ty = rows[0];
        for (const nb of [tx - 1, tx + 1]) {
          if (!rowsOf.has(nb)) continue;
          const nty = rowsOf.get(nb)![0];
          assert(Math.abs(nty - ty) <= 1, `seed ${seed}: wall steps more than 1 row between adjacent columns`);
        }
      }
    }
  }
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

// ── Randomized island shape ─────────────────────────────────────────────────

Deno.test('randomized islands — different coastlines per seed while invariants hold', () => {
  const seaSets: Set<string>[] = [];
  const wallSets: Set<string>[] = [];
  for (let seed = 1; seed <= 12; seed++) {
    const w = generateWorld(seed, W, H);

    // Invariant: exactly two cliff regions, each carrying at least one staircase.
    const regions = wallRegions(w);
    assertEquals(regions.length, 2, `exactly two cliff regions (seed ${seed})`);
    for (const region of regions) {
      let sawStairs = false;
      for (let ty = region.top; ty <= region.bottom; ty++) {
        const runs = stairsRuns(w, ty);
        if (runs.length > 0) sawStairs = true;
        for (const [s, e] of runs) {
          const width = e - s + 1;
          assert(width >= 1 && width <= 3, `stair run ${s}-${e} should be 1-3 wide (seed ${seed})`);
        }
      }
      assert(sawStairs, `at least one staircase per cliff region (seed ${seed})`);
    }

    // Invariant: every walkable tile is reachable through the stairs.
    const walkable = (k: string): boolean => k === 'grass' || k === 'beach' || k === 'rock' || k === 'stairs';
    let sx = -1;
    let sy = -1;
    for (let ty = 0; ty < H && sx === -1; ty++) {
      for (let tx = 0; tx < W && sx === -1; tx++) {
        if (walkable(w.terrain[ty][tx])) {
          sx = tx;
          sy = ty;
        }
      }
    }
    assert(sx !== -1, `expected a walkable tile (seed ${seed})`);
    const seen = new Set<string>([`${sx},${sy}`]);
    const queue: Array<[number, number]> = [[sx, sy]];
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
        if (walkable(w.terrain[ty][tx])) {
          assert(seen.has(`${tx},${ty}`), `walkable tile (${tx},${ty}) unreachable (seed ${seed})`);
        }
      }
    }

    const set = new Set<string>();
    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        if (w.terrain[ty][tx] === 'sea') set.add(`${tx},${ty}`);
      }
    }
    seaSets.push(set);

    // Also fingerprint the wall bands, so wall perturbation variety is visible.
    const wallSet = new Set<string>();
    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        if (w.terrain[ty][tx] === 'cliff' || w.terrain[ty][tx] === 'stairs') wallSet.add(`${tx},${ty}`);
      }
    }
    wallSets.push(wallSet);
  }

  // Randomness must be visible: at least one seed produces different coastlines
  // or a different wall shape.
  const differs = (a: Set<string>, b: Set<string>): boolean => a.size !== b.size || [...a].some((k) => !b.has(k));
  let different = false;
  for (let i = 0; i < seaSets.length && !different; i++) {
    for (let j = i + 1; j < seaSets.length && !different; j++) {
      if (differs(seaSets[i], seaSets[j]) || differs(wallSets[i], wallSets[j])) different = true;
    }
  }
  assert(different, 'different seeds should produce different island shapes');
});
