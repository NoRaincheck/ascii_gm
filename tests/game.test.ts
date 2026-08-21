import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { canOccupyAt, generateWorld, landTouchesWater, TILE } from '../lib/game.ts';
import type { Room, StairRun, World } from '../lib/game.ts';

const W = 16;
const H = 24;

function world(): World {
  return generateWorld(12345, W, H);
}

const WALKABLE = new Set(['grass', 'beach', 'rock', 'stairs']);
const FLOOR = new Set(['grass', 'beach', 'rock']);
const LEVEL_OF: Record<string, number> = { rock: 2, grass: 1, beach: 0 };

// Contiguous stairs runs [start, end] in a given row.
function stairsRuns(w: World, ty: number): Array<[number, number]> {
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

// Flood-fill the connected walkable region containing (sx, sy).
function flood(w: World, sx: number, sy: number): Set<string> {
  const seen = new Set<string>([`${sx},${sy}`]);
  const queue: Array<[number, number]> = [[sx, sy]];
  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (!WALKABLE.has(w.terrain[ny][nx])) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

// The room owning the floor tile (tx,ty), or null. Uses the per-column
// intervals, not bounding boxes.
function roomAt(w: World, tx: number, ty: number): Room | null {
  for (const r of w.rooms) {
    const i = tx - r.x;
    if (i < 0 || i >= r.width) continue;
    if (ty >= r.tops[i] && ty <= r.bottoms[i]) return r;
  }
  return null;
}

// Per-column vertical stacks of room indices (top→down), keyed by column.
function columnStacks(w: World): number[][] {
  const stacks: number[][] = [];
  for (let c = 0; c < w.width; c++) {
    stacks[c] = w.rooms
      .map((r, ri) => ({ r, ri }))
      .filter(({ r }) => r.x <= c && c < r.x + r.width)
      .sort((a, b) => a.r.tops[c - a.r.x] - b.r.tops[c - b.r.x])
      .map(({ ri }) => ri);
  }
  return stacks;
}

// ── Rooms: terrace layout, ordering, walls ─────────────────────────────────

Deno.test('rooms — the map is framed by sea margins', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const w = generateWorld(seed, W, H);
    for (let tx = 0; tx < W; tx++) {
      assertEquals(w.terrain[0][tx], 'sea', `top edge (seed ${seed})`);
      // The south margin may carry shore walls dropped under rock/grass lips.
      assert(
        w.terrain[H - 1][tx] === 'sea' || w.terrain[H - 1][tx] === 'cliff',
        `bottom edge (seed ${seed}): ${w.terrain[H - 1][tx]}`,
      );
    }
    for (let ty = 0; ty < H; ty++) {
      assertEquals(w.terrain[ty][0], 'sea', `left edge (seed ${seed})`);
      assertEquals(w.terrain[ty][W - 1], 'sea', `right edge (seed ${seed})`);
    }
  }
});

Deno.test('rooms — 2-12 terrace segments, each column 3+ deep, inside the margins', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const w = generateWorld(seed, W, H);
    const rooms = w.rooms;
    // 2-4 terraces × 1-3 segments each.
    assert(rooms.length >= 2 && rooms.length <= 12, `room count ${rooms.length} (seed ${seed})`);
    for (const r of rooms) {
      assert(r.type === 'rock' || r.type === 'grass' || r.type === 'beach', `room type ${r.type}`);
      assert(r.width >= 4, `room width ${r.width} (seed ${seed})`);
      assertEquals(r.tops.length, r.width, `tops length (seed ${seed})`);
      assertEquals(r.bottoms.length, r.width, `bottoms length (seed ${seed})`);
      for (let i = 0; i < r.width; i++) {
        const h = r.bottoms[i] - r.tops[i] + 1;
        assert(h >= 3 && h <= 9, `column depth ${h} (seed ${seed} room ${r.type}@${r.x}+${i})`);
        assert(r.tops[i] >= 1 && r.bottoms[i] <= H - 2, `interval in bounds (seed ${seed})`);
      }
      // Bounding box agrees with the intervals.
      assertEquals(r.y, Math.min(...r.tops), `bbox y (seed ${seed})`);
      assertEquals(r.height, Math.max(...r.bottoms) - Math.min(...r.tops) + 1, `bbox height (seed ${seed})`);
    }
  }
});

Deno.test('rooms — terrain is exactly the per-column room intervals (no stray land)', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (const w of [generateWorld(seed, W, H), generateWorld(seed, 16, 20)]) {
      // Every floor tile sits in exactly one room interval and matches its kind.
      for (let ty = 0; ty < w.height; ty++) {
        for (let tx = 0; tx < w.width; tx++) {
          const k = w.terrain[ty][tx];
          if (FLOOR.has(k)) {
            const owners = w.rooms.filter((r) => {
              const i = tx - r.x;
              return i >= 0 && i < r.width && ty >= r.tops[i] && ty <= r.bottoms[i];
            });
            assertEquals(owners.length, 1, `seed ${seed}: ${k} tile (${tx},${ty}) in ${owners.length} rooms`);
            assertEquals(owners[0].type, k, `seed ${seed}: ${k} tile (${tx},${ty}) ≠ room kind`);
          } else {
            assertEquals(roomAt(w, tx, ty), null, `seed ${seed}: stray room covers (${tx},${ty})`);
          }
        }
      }
    }
  }
});

Deno.test('rooms — walking down any column the level never rises (terrace order)', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const w = generateWorld(seed, W, H);
    const stacks = columnStacks(w);
    let sawStack = false;
    for (let c = 1; c < W - 1; c++) {
      for (let i = 1; i < stacks[c].length; i++) {
        sawStack = true;
        const up = w.rooms[stacks[c][i - 1]];
        const down = w.rooms[stacks[c][i]];
        assert(
          LEVEL_OF[up.type] >= LEVEL_OF[down.type],
          `seed ${seed}: level rose downward at col ${c}: ${up.type}→${down.type}`,
        );
      }
    }
    assert(sawStack, `seed ${seed}: expected stacked terraces`);
    // The crown starts at rock or grass — never a beach summit.
    const crown = w.rooms.reduce((a, r) => (r.y < a.y ? r : a), w.rooms[0]);
    assert(crown.type !== 'beach', `seed ${seed}: crown terrace should be rock or grass`);
  }
});

Deno.test('rooms — exactly one wall row between stacked rooms, hugging the upper bottom edge', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const w = generateWorld(seed, W, H);
    const stacks = columnStacks(w);
    for (let c = 1; c < W - 1; c++) {
      for (let i = 1; i < stacks[c].length; i++) {
        const up = w.rooms[stacks[c][i - 1]];
        const down = w.rooms[stacks[c][i]];
        const ui = c - up.x;
        const di = c - down.x;
        assertEquals(
          up.bottoms[ui] + 2,
          down.tops[di],
          `seed ${seed}: col ${c} should have exactly one row between the stacked rooms`,
        );
        // The higher room keeps its wall along the bottom edge (unless the
        // band carries a door there).
        const wallRow = up.bottoms[ui] + 1;
        assert(
          w.terrain[wallRow][c] === 'cliff' || w.terrain[wallRow][c] === 'stairs',
          `seed ${seed}: no wall under bottom edge at (${c},${wallRow}): ${w.terrain[wallRow][c]}`,
        );
      }
    }
  }
});

Deno.test('rooms — wall bands never stack vertically', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const w = generateWorld(seed, W, H);
    for (let ty = 1; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const k = w.terrain[ty][tx];
        if (k !== 'cliff' && k !== 'stairs') continue;
        assert(
          w.terrain[ty - 1][tx] !== 'cliff' && w.terrain[ty - 1][tx] !== 'stairs',
          `seed ${seed}: wall stacked vertically at (${tx},${ty})`,
        );
        if (ty + 1 < H) {
          assert(
            w.terrain[ty + 1][tx] !== 'cliff' && w.terrain[ty + 1][tx] !== 'stairs',
            `seed ${seed}: wall stacked vertically at (${tx},${ty})`,
          );
        }
      }
    }
  }
});

Deno.test('rooms — rock/grass never touch open water on their south side (issue #13)', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (const w of [generateWorld(seed, W, H), generateWorld(seed, 16, 20)]) {
      let shoreWall: { tx: number; ty: number } | null = null;
      for (let ty = 0; ty < w.height - 1; ty++) {
        for (let tx = 0; tx < w.width; tx++) {
          const k = w.terrain[ty][tx];
          if (k !== 'rock' && k !== 'grass' && k !== 'beach') continue;
          const south = w.terrain[ty + 1][tx];
          if (south !== 'sea') continue;
          // Only a beach lip may face open water as a sandy shore.
          assertEquals(k, 'beach', `seed ${seed}: ${k} lip at (${tx},${ty}) meets the sea bare`);
        }
        // Remember one dropped shore wall (cliff over sea) for the body check.
        for (let tx = 0; tx < w.width && !shoreWall; tx++) {
          if (
            w.terrain[ty][tx] === 'cliff' &&
            (w.terrain[ty - 1][tx] === 'rock' || w.terrain[ty - 1][tx] === 'grass') &&
            (ty + 1 >= w.height || w.terrain[ty + 1][tx] === 'sea')
          ) {
            shoreWall = { tx, ty };
          }
        }
      }
      // A shore wall is impassable ground for the character's body.
      if (shoreWall) {
        assertEquals(
          canOccupyAt(w, shoreWall.tx * TILE + TILE / 2, shoreWall.ty * TILE + TILE / 2),
          false,
          `seed ${seed}: shore wall at (${shoreWall.tx},${shoreWall.ty}) should be impassable`,
        );
      }
    }
  }
});

Deno.test('rooms — every terrain kind present covers a real area; worlds mix kinds', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (const w of [generateWorld(seed, W, H), generateWorld(seed, 16, 20)]) {
      const total: Record<string, number> = { rock: 0, grass: 0, beach: 0 };
      for (const r of w.rooms) {
        for (let i = 0; i < r.width; i++) total[r.type] += r.bottoms[i] - r.tops[i] + 1;
      }
      const present = (['rock', 'grass', 'beach'] as const).filter((t) => total[t] > 0);
      assert(present.length >= 2, `seed ${seed}: expected at least 2 kinds, got ${present.join(',')}`);
      for (const t of present) {
        assert(total[t] >= 12, `seed ${seed}: ${t} covers only ${total[t]} cells`);
      }
    }
  }
});

// ── Doors ──────────────────────────────────────────────────────────────────

Deno.test('rooms — every touchable room pair is traversed, water-flanked, or crowded out', () => {
  for (let seed = 1; seed <= 50; seed++) {
    for (const w of [generateWorld(seed, W, H), generateWorld(seed, 16, 20)]) {
      const stacks = columnStacks(w);
      const pairs = new Set<string>();
      for (let c = 1; c < W - 1; c++) {
        for (let i = 0; i + 1 < stacks[c].length; i++) {
          pairs.add(`${stacks[c][i]},${stacks[c][i + 1]}`);
        }
      }
      assert(pairs.size >= 1, `seed ${seed}: expected at least one adjacent pair`);
      for (const key of pairs) {
        const [ui, li] = key.split(',').map(Number);
        const u = w.rooms[ui];
        const l = w.rooms[li];
        // Columns where the pair actually touches (wall row exactly between).
        const touch: number[] = [];
        for (let i = 0; i < u.width; i++) {
          const c = u.x + i;
          const ci = c - l.x;
          if (ci < 0 || ci >= l.width) continue;
          if (l.tops[ci] === u.bottoms[i] + 2) touch.push(c);
        }
        if (!touch.length) continue;
        const joined = w.stairs.some((s) =>
          touch.some((c) => {
            const row = u.bottoms[c - u.x] + 1;
            return s.row === row && c >= s.start && c < s.start + s.width;
          })
        );
        if (joined) continue;
        const okFlank = (k: string): boolean => k !== 'sea' && k !== 'coast';
        // Structural: every touching column's wall row is water-flanked, so
        // no legal door exists there at all.
        const structural = touch.every((c) => {
          const row = u.bottoms[c - u.x] + 1;
          return !okFlank(w.terrain[row][c - 1]) || !okFlank(w.terrain[row][c + 1]);
        });
        if (structural) continue;
        // Crowded out: another stair run occupies the same wall row right
        // next to the pair's columns and won the spot.
        const rows = new Set(touch.map((c) => u.bottoms[c - u.x] + 1));
        const crowded = [...rows].some((row) =>
          w.stairs.some((s) =>
            s.row === row &&
            s.start + s.width >= Math.min(...touch) - 1 &&
            s.start <= Math.max(...touch) + 1
          )
        );
        assert(
          crowded,
          `seed ${seed}: pair u@${u.x}(w${u.width})${u.type}/l@${l.x}(w${l.width})${l.type} ` +
            `touch=[${touch}] has no door, is not water-flanked, and is not crowded`,
        );
      }
      // Doors land on two different rooms' floors: walkable above and below.
      for (const s of w.stairs) {
        for (let c = s.start; c < s.start + s.width; c++) {
          const up = roomAt(w, c, s.row - 1);
          const down = roomAt(w, c, s.row + 1);
          assert(up !== null && down !== null, `seed ${seed}: stair (${s.start},${s.row}) lacks landings`);
          assert(up !== down, `seed ${seed}: stair (${s.start},${s.row}) joins a room to itself`);
        }
      }
    }
  }
});

Deno.test('rooms — world.stairs matches the terrain', () => {
  const w = world();
  for (let ty = 0; ty < H; ty++) {
    const runs = stairsRuns(w, ty);
    // Placement order follows the door solver, not geography: sort by start.
    const recorded = w.stairs.filter((s) => s.row === ty).sort((a, b) => a.start - b.start);
    assertEquals(recorded.length, runs.length, `one world.stairs entry per terrain run (row ${ty})`);
    for (const [i, [s, e]] of runs.entries()) {
      const run = recorded[i];
      assertEquals(run.start, s, `run ${i} start`);
      assertEquals(run.width, e - s + 1, `run ${i} width`);
    }
  }
});

Deno.test('rooms — stair runs are 1-3 wide, never touch water, never flush together', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const w = generateWorld(seed, W, H);
    for (let ty = 0; ty < H; ty++) {
      const runs = stairsRuns(w, ty)
        .map(([s, e]) => ({ s, e }))
        .sort((a, b) => a.s - b.s);
      for (const { s, e } of runs) {
        assert(e - s + 1 >= 1 && e - s + 1 <= 3, `seed ${seed}: run width ${e - s + 1} (row ${ty})`);
        assert(
          w.terrain[ty][s - 1] !== 'sea' && w.terrain[ty][s - 1] !== 'coast',
          `seed ${seed}: stairs run ${s}-${e} touches water on the left`,
        );
        assert(
          w.terrain[ty][e + 1] !== 'sea' && w.terrain[ty][e + 1] !== 'coast',
          `seed ${seed}: stairs run ${s}-${e} touches water on the right`,
        );
      }
      for (let i = 1; i < runs.length; i++) {
        const prev = runs[i - 1];
        const cur = runs[i];
        assert(
          cur.s > prev.e + 1,
          `seed ${seed}: stair runs ${prev.s}-${prev.e} and ${cur.s}-${cur.e} are adjacent (row ${ty})`,
        );
        // The gap between two doors is wall or floor — never open water
        // (flanks were checked above) and of course not another run.
        for (let c = prev.e + 1; c < cur.s; c++) {
          const k = w.terrain[ty][c];
          assert(k === 'cliff' || FLOOR.has(k), `seed ${seed}: gap column ${c} (row ${ty}) is ${k}`);
        }
      }
    }
  }
});

// ── Reachability and physics ───────────────────────────────────────────────

Deno.test('rooms — every walkable tile is reachable through the stairs', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const w = generateWorld(seed, W, H);
    const sx = w.rooms[0].x;
    const sy = w.rooms[0].tops[0];
    const seen = flood(w, sx, sy);
    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        if (WALKABLE.has(w.terrain[ty][tx])) {
          assert(seen.has(`${tx},${ty}`), `walkable tile (${tx},${ty}) is unreachable (seed ${seed})`);
        }
      }
    }
  }
});

Deno.test('rooms — stairs are reachable from both sides', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const w = generateWorld(seed, W, H);
    for (const stair of w.stairs) {
      const { start, width, row } = stair;
      const midCol = start + Math.floor(width / 2);
      assert(WALKABLE.has(w.terrain[row - 1][midCol]), `stair ${midCol},${row} blocked from above`);
      assert(WALKABLE.has(w.terrain[row + 1][midCol]), `stair ${midCol},${row} blocked from below`);
    }
  }
});

Deno.test('rooms — player cannot stand on the cliff face but can on the stairs', () => {
  const w = world();
  let cliff = { tx: -1, ty: -1 };
  let stairs = { tx: -1, ty: -1 };
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      if (w.terrain[ty][tx] === 'cliff' && cliff.tx === -1) cliff = { tx, ty };
      else if (w.terrain[ty][tx] === 'stairs' && stairs.tx === -1) stairs = { tx, ty };
    }
  }
  assert(cliff.tx !== -1, 'expected a cliff tile');
  assert(stairs.tx !== -1, 'expected a stairs tile');
  assertEquals(canOccupyAt(w, cliff.tx * TILE + TILE / 2, cliff.ty * TILE + TILE / 2), false);
  assertEquals(canOccupyAt(w, stairs.tx * TILE + TILE / 2, stairs.ty * TILE + TILE / 2), true);
  // The player spawns on walkable ground.
  assert(canOccupyAt(w, w.player.x, w.player.y));
});

// ── Foam: wall tiles touching water ────────────────────────────────────────

Deno.test('foam — wall tiles that meet the sea qualify for foam (landTouchesWater)', () => {
  let wallWaterSeen = 0;
  let wallIsolatedSeen = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const w = generateWorld(seed, W, H);
    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        if (w.terrain[ty][tx] !== 'cliff') continue;
        // Out-of-map counts as water, matching terrainAt() — shore walls on
        // the map's bottom edge hang over the sea (and the off-map mask).
        const water = (x: number, y: number): boolean =>
          x < 0 || x >= W || y < 0 || y >= H ||
          w.terrain[y][x] === 'sea' || w.terrain[y][x] === 'coast';
        const hasWaterNeighbor =
          water(tx - 1, ty) || water(tx + 1, ty) || water(tx, ty - 1) || water(tx, ty + 1);
        if (hasWaterNeighbor) {
          wallWaterSeen++;
          assert(landTouchesWater(w, tx, ty), `seed ${seed}: wall (${tx},${ty}) should touch water`);
        } else {
          wallIsolatedSeen++;
          assertEquals(landTouchesWater(w, tx, ty), false, `seed ${seed}: wall (${tx},${ty}) should not touch water`);
        }
      }
    }
  }
  // Over many seeds the wall bands must actually hang over the sea (their
  // west/east ends and the south lips where a lower room is narrower).
  assert(wallWaterSeen > 0, 'expected some cliff tiles to touch water');
  // Interior wall spans (the face above a room) stay sealed away from water.
  assert(wallIsolatedSeen > 0, 'expected some cliff tiles to be sealed from water');
});

// ── Landmarks ──────────────────────────────────────────────────────────────

Deno.test('rooms — buildings sit on grass or rock, trees on grass', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const w = generateWorld(seed, W, H);
    for (const b of w.buildings) {
      // Sample the columns under the building content for its footing.
      let foundSite = false;
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 4; dx++) {
          const ty = b.y + dy;
          const tx = b.x + dx;
          if (ty < H && tx < W) {
            const k = w.terrain[ty][tx];
            if (k === 'grass' || k === 'rock') foundSite = true;
          }
        }
      }
      assert(foundSite, `seed ${seed}: building ${b.type} at (${b.x},${b.y}) not on grass/rock`);
    }
    for (const t of w.trees) {
      assert(
        w.terrain[t.y][t.x] === 'grass' || w.terrain[t.y][t.x + 1] === 'grass',
        `seed ${seed}: tree at (${t.x},${t.y}) not on grass`,
      );
    }
  }
});

Deno.test('rooms — stairs have clear entryways (no solid footprint in the corridor)', () => {
  for (let seed = 1; seed <= 80; seed++) {
    const w = generateWorld(seed, W, H);
    for (const stair of w.stairs) {
      const { start, width, row } = stair;
      for (let ty = row - 1; ty <= row + 1; ty++) {
        for (let tx = start - 1; tx <= start + width; tx++) {
          if (ty < 0 || ty >= H || tx < 0 || tx >= W) continue;
          const onBand = ty === row;
          const onStairsCol = tx >= start && tx < start + width;
          if (onBand && !onStairsCol) continue; // cliff lip, not walkable
          if (onBand || WALKABLE.has(w.terrain[ty][tx])) {
            assert(
              canOccupyAt(w, tx * TILE + TILE / 2, ty * TILE + TILE / 2),
              `seed ${seed}: corridor cell (${tx},${ty}) of stair (${start},${row}) is blocked`,
            );
          }
        }
      }
    }
  }
});

// ── Variety across seeds ───────────────────────────────────────────────────

Deno.test('rooms — different seeds produce different room layouts and coastlines', () => {
  const roomSets: Set<string>[] = [];
  const seaSets: Set<string>[] = [];
  for (let seed = 1; seed <= 12; seed++) {
    const w = generateWorld(seed, W, H);
    const rs = new Set<string>(w.rooms.map((r: Room) => `${r.type}@${r.x},${r.y},${r.width}x${r.height}`));
    roomSets.push(rs);
    const ss = new Set<string>();
    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        if (w.terrain[ty][tx] === 'sea') ss.add(`${tx},${ty}`);
      }
    }
    seaSets.push(ss);
  }
  const differs = (a: Set<string>, b: Set<string>): boolean =>
    a.size !== b.size || [...a].some((k) => !b.has(k));
  let roomVariety = false;
  let coastVariety = false;
  for (let i = 0; i < roomSets.length && !(roomVariety && coastVariety); i++) {
    for (let j = i + 1; j < roomSets.length && !(roomVariety && coastVariety); j++) {
      if (differs(roomSets[i], roomSets[j])) roomVariety = true;
      if (differs(seaSets[i], seaSets[j])) coastVariety = true;
    }
  }
  assert(roomVariety, 'different seeds should produce different room layouts');
  assert(coastVariety, 'different seeds should produce different coastlines');
});

Deno.test('rooms — layouts break the single-ziggurat pattern (varied silhouettes)', () => {
  // Across seeds: the crown terrace sometimes pulls in from the flanks (open
  // sea beside the summit), and wall bands are usually stepped rather than one
  // long straight run.
  let pulledIn = 0;
  let jagged = 0;
  const roomCounts = new Set<number>();
  const N = 40;
  for (let seed = 1; seed <= N; seed++) {
    const w = generateWorld(seed, W, H);
    roomCounts.add(w.rooms.length);
    // Crown = columns whose topmost floor appears near the shoreline.
    const crownCols = new Set<number>();
    for (let c = 1; c < W - 1; c++) {
      for (let ty = 1; ty <= 3; ty++) {
        if (FLOOR.has(w.terrain[ty][c])) {
          crownCols.add(c);
          break;
        }
      }
    }
    if (crownCols.size < W - 2) pulledIn++;
    // Jagged: no single cliff row runs 8+ tiles without a break.
    let longRun = false;
    for (let ty = 0; ty < H; ty++) {
      let run = 0;
      for (let tx = 0; tx < W; tx++) {
        if (w.terrain[ty][tx] === 'cliff') {
          run++;
          if (run >= 8) longRun = true;
        } else run = 0;
      }
    }
    if (!longRun) jagged++;
  }
  assert(pulledIn >= 8, `expected varied crown silhouettes, got ${pulledIn}/${N} pulled in`);
  assert(jagged >= Math.floor(N * 0.8), `expected mostly stepped walls, got ${jagged}/${N} without long straight runs`);
  assert(roomCounts.size >= 4, `expected varied room counts, got ${[...roomCounts].join(',')}`);
});

Deno.test('rooms — some rooms bridge several rooms above or below (multiply-joined)', () => {
  let multiJoin = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const w = generateWorld(seed, W, H);
    for (const u of w.rooms) {
      // Count distinct rooms directly above/below u across its columns.
      const others = new Set<number>();
      for (let i = 0; i < u.width; i++) {
        const c = u.x + i;
        const above = roomAt(w, c, u.tops[i] - 2);
        const below = roomAt(w, c, u.bottoms[i] + 2);
        for (const n of [above, below]) {
          if (n && n !== u) others.add(w.rooms.indexOf(n));
        }
      }
      if (others.size >= 2) multiJoin++;
    }
  }
  assert(multiJoin >= 10, `expected many multiply-joined rooms, got ${multiJoin}`);
});

Deno.test('rooms — builds on smaller and larger maps too', () => {
  for (const [mw, mh] of [[14, 20], [16, 20], [20, 28], [24, 32]] as const) {
    for (let seed = 1; seed <= 10; seed++) {
      const w = generateWorld(seed, mw, mh);
      assert(w.rooms.length >= 1, `${mw}x${mh} seed ${seed}: no rooms`);
      for (const stair of w.stairs as StairRun[]) {
        assert(WALKABLE.has(w.terrain[stair.row - 1][stair.start + Math.floor(stair.width / 2)]));
        assert(WALKABLE.has(w.terrain[stair.row + 1][stair.start + Math.floor(stair.width / 2)]));
      }
      // Sea margins hold on every size (the south margin may carry shore
      // walls dropped under rock/grass lips).
      for (let tx = 0; tx < mw; tx++) {
        assertEquals(w.terrain[0][tx], 'sea');
        assert(
          w.terrain[mh - 1][tx] === 'sea' || w.terrain[mh - 1][tx] === 'cliff',
          `${mw}x${mh} seed ${seed}: bottom edge ${w.terrain[mh - 1][tx]}`,
        );
      }
    }
  }
});
