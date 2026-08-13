import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { canOccupyAt, generateWorld, ROOM_LEVEL, TILE } from '../lib/game.ts';
import type { Room, StairRun, World } from '../lib/game.ts';

const W = 16;
const H = 24;

function world(): World {
  return generateWorld(12345, W, H);
}

const WALKABLE = new Set(['grass', 'beach', 'rock', 'stairs']);

// All rooms of one level share the same (y, height); group them that way.
function levelsOf(w: World): Room[][] {
  const bySig = new Map<string, Room[]>();
  for (const r of w.rooms) bySig.set(`${r.y},${r.height}`, [...(bySig.get(`${r.y},${r.height}`) ?? []), r]);
  return [...bySig.values()].sort((a, b) => a[0].y - b[0].y);
}

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

// ── Rooms: rectangles, layout, DAG ordering ────────────────────────────────

Deno.test('rooms — the map is framed by sea margins', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const w = generateWorld(seed, W, H);
    for (let tx = 0; tx < W; tx++) {
      assertEquals(w.terrain[0][tx], 'sea', `top edge (seed ${seed})`);
      assertEquals(w.terrain[H - 1][tx], 'sea', `bottom edge (seed ${seed})`);
    }
    for (let ty = 0; ty < H; ty++) {
      assertEquals(w.terrain[ty][0], 'sea', `left edge (seed ${seed})`);
      assertEquals(w.terrain[ty][W - 1], 'sea', `right edge (seed ${seed})`);
    }
  }
});

Deno.test('rooms — 3-9 rectangles inside the margins, one kind each, level rows shared', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const w = generateWorld(seed, W, H);
    const rooms = w.rooms;
    assert(rooms.length >= 3 && rooms.length <= 9, `room count ${rooms.length} (seed ${seed})`);
    // Rooms of a level share the same rows (same y + height); rows differ per level.
    const byY = new Map<string, Room[]>();
    for (const r of w.rooms) byY.set(`${r.y},${r.height}`, [...(byY.get(`${r.y},${r.height}`) ?? []), r]);
    assert(byY.size === 3, `seed ${seed}: expected 3 distinct levels, got ${byY.size}`);
    for (const r of rooms) {
      assert(r.type === 'rock' || r.type === 'grass' || r.type === 'beach', `room type ${r.type}`);
      assert(r.width >= 3 && r.width <= W - 2, `room width ${r.width} (seed ${seed})`);
      assert(r.height >= 3 && r.height <= 9, `room height ${r.height} (seed ${seed})`);
      assert(r.x >= 1 && r.y >= 1 && r.x + r.width <= W - 1 && r.y + r.height <= H - 1, `room in bounds ${r}`);
      for (let ty = r.y; ty < r.y + r.height; ty++) {
        for (let tx = r.x; tx < r.x + r.width; tx++) {
          assertEquals(w.terrain[ty][tx], r.type, `room fill (seed ${seed}) room ${r} at (${tx},${ty})`);
        }
      }
    }
  }
});

Deno.test('rooms — each level is a contiguous run; grass spans the full usable width', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const w = generateWorld(seed, W, H);
    // Group rooms by their (y, height) tuples — the level signature.
    const levels = new Map<string, Room[]>();
    for (const r of w.rooms) levels.set(`${r.y},${r.height}`, [...(levels.get(`${r.y},${r.height}`) ?? []), r]);
    for (const [sig, rs] of levels) {
      const type = rs[0].type;
      for (const r of rs) assertEquals(r.type, type, `level ${sig} mixes kinds`);
      rs.sort((a, b) => a.x - b.x);
      // Left to right they tile their span with no gap and no overlap.
      let cursor = rs[0].x;
      for (const r of rs) {
        assertEquals(r.x, cursor, `level ${sig} rooms should be flush (seed ${seed})`);
        cursor = r.x + r.width;
      }
      // All rooms stay inside the sea margins.
      for (const r of rs) assert(r.x >= 1 && r.x + r.width <= W - 1, `room leaves margins (seed ${seed})`);
      // The middle (grass) run reaches both margins — it anchors connectivity.
      if (type === 'grass') {
        assertEquals(rs[0].x, 1, `grass level should start at the left margin`);
        assertEquals(cursor, W - 1, `grass level should end at the right margin`);
      }
      // Same level rooms are all walkable to each other (no wall between them).
      for (let i = 0; i < rs.length; i++) {
        const a = rs[i];
        const b = rs[i + 1];
        if (b) {
          assertEquals(w.terrain[a.y + a.height - 1][a.x + a.width - 1], a.type, 'shared edge interior');
          assertEquals(w.terrain[b.y][b.x], b.type, 'shared edge interior');
        }
      }
    }
  }
});

Deno.test('rooms — every terrain kind meets its minimal total area (rooms combined)', () => {
  const pct: Record<string, number> = { rock: 0.18, grass: 0.22, beach: 0.26 };
  for (let seed = 1; seed <= 60; seed++) {
    for (const w of [generateWorld(seed, W, H), generateWorld(seed, 16, 20)]) {
      const usableCells = (w.width - 2) * (w.height - 2);
      const total: Record<string, number> = { rock: 0, grass: 0, beach: 0 };
      for (const r of w.rooms) total[r.type] += r.width * r.height;
      for (const t of ['rock', 'grass', 'beach'] as const) {
        const target = Math.round(usableCells * pct[t]);
        assert(
          total[t] >= target,
          `seed ${seed}: ${t} total area ${total[t]} < target ${target}`,
        );
      }
      // Every level actually contributes rooms (none is dropped).
      assert(total.rock > 0 && total.grass > 0 && total.beach > 0, `seed ${seed}: a level is missing`);
    }
  }
});

Deno.test('rooms — terrain is exactly the room rects (no stray or shared land)', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (const w of [generateWorld(seed, W, H), generateWorld(seed, 16, 20)]) {
      // Rooms never overlap a cell.
      for (let i = 0; i < w.rooms.length; i++) {
        for (let j = i + 1; j < w.rooms.length; j++) {
          const a = w.rooms[i];
          const b = w.rooms[j];
          assert(
            !(a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height),
            `seed ${seed}: rooms ${i} and ${j} overlap`,
          );
        }
      }
      // Every land tile sits in exactly one room and matches that room's kind;
      // rooms contain no other terrain.
      for (let ty = 0; ty < w.height; ty++) {
        for (let tx = 0; tx < w.width; tx++) {
          const k = w.terrain[ty][tx];
          if (k === 'rock' || k === 'grass' || k === 'beach') {
            const owners = w.rooms.filter(
              (r) => tx >= r.x && tx < r.x + r.width && ty >= r.y && ty < r.y + r.height,
            );
            assert(owners.length === 1, `seed ${seed}: ${k} tile (${tx},${ty}) in ${owners.length} rooms`);
            assertEquals(owners[0].type, k, `seed ${seed}: ${k} tile (${tx},${ty}) ≠ room ${owners[0].type}`);
          }
        }
      }
    }
  }
});

Deno.test('rooms — types are strictly rock → grass → beach top→down (3 levels)', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const w = generateWorld(seed, W, H);
    const levels = new Map<string, Room[]>();
    for (const r of w.rooms) levels.set(`${r.y},${r.height}`, [...(levels.get(`${r.y},${r.height}`) ?? []), r]);
    const sigs = [...levels.keys()].sort((a, b) => Number(a.split(',')[0]) - Number(b.split(',')[0]));
    assert(sigs.length === 3, `seed ${seed}: expected exactly 3 levels`);
    const types = sigs.map((s) => levels.get(s)![0].type);
    assert(types[0] === 'rock' && types[1] === 'grass' && types[2] === 'beach',
      `seed ${seed}: wrong level order ${types.join('>')}`);
    // Room list is ordered top→down then left→right, so the level index never rises.
    for (let i = 1; i < w.rooms.length; i++) {
      assert(
        ROOM_LEVEL[w.rooms[i - 1].type] >= ROOM_LEVEL[w.rooms[i].type],
        `seed ${seed}: level rose ${w.rooms[i - 1].type}→${w.rooms[i].type}`,
      );
    }
  }
});

Deno.test('rooms — a single row (a wall band) separates adjacent levels', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const w = generateWorld(seed, W, H);
    const levels = levelsOf(w);
    assert(levels.length === 3, `seed ${seed}: expected 3 levels`);
    for (let z = 1; z < levels.length; z++) {
      const a = levels[z - 1][0];
      const b = levels[z][0];
      assertEquals(
        a.y + a.height + 1,
        b.y,
        `seed ${seed}: levels ${z - 1}/${z} should be separated by one band row`,
      );
    }
  }
});

Deno.test('rooms — a room joins every room it overlaps on the level above/below (door per pair)', () => {
  for (let seed = 1; seed <= 50; seed++) {
    for (const w of [generateWorld(seed, W, H), generateWorld(seed, 16, 20)]) {
      const levels = levelsOf(w);
      for (let z = 0; z < levels.length - 1; z++) {
        const up = levels[z];
        const down = levels[z + 1];
        const bandRow = up[0].y + up[0].height;
        for (let c = 1; c < W - 1; c++) {
          const overUp = up.some((u) => c >= u.x && c < u.x + u.width);
          const overDown = down.some((l) => c >= l.x && c < l.x + l.width);
          const kind = w.terrain[bandRow][c];
          if (overUp && overDown) {
            assert(kind === 'cliff' || kind === 'stairs', `band tile (${c},${bandRow}) = ${kind}`);
            // The tiles immediately above/below are those rooms' floors.
            assert(WALKABLE.has(w.terrain[bandRow - 1][c]) && WALKABLE.has(w.terrain[bandRow + 1][c]));
          } else {
            assertEquals(kind, 'sea', `band gap (${c},${bandRow}) should be open sea`);
          }
        }
        // Every overlapping (upper, lower) room pair carries a door, unless its
        // single overlapping column is flanked on both sides by open sea (no
        // room for a safe landing).
        for (const u of up) {
          for (const l of down) {
            const s = Math.max(u.x, l.x);
            const e = Math.min(u.x + u.width, l.x + l.width) - 1;
            if (s > e) continue;
            const doors = (row: number): StairRun[] =>
              w.stairs.filter(
                (door) => door.row === row && door.start <= e && door.start + door.width - 1 >= s,
              );
            if (e - s + 1 >= 2) {
              assert(doors(bandRow).length >= 1,
                `seed ${seed}: no door connecting u@${u.x}x${u.width} and l@${l.x}x${l.width}`);
            } else {
              const bothSea = w.terrain[bandRow][s - 1] === 'sea' && w.terrain[bandRow][s + 1] === 'sea';
              assert(doors(bandRow).length >= 1 || bothSea,
                `seed ${seed}: lone column ${s} can and should have a door`);
            }
            for (const d of doors(bandRow)) {
              assert(d.width >= 1 && d.width <= 3, `door ${d.start} should be 1-3 wide`);
            }
          }
        }
        // The consumer-facing constraint: no stair tile is ever next to water.
        for (const run of stairsRuns(w, bandRow)) {
          const [rs, re] = run;
          assert(w.terrain[bandRow][rs - 1] !== 'sea' && w.terrain[bandRow][rs - 1] !== 'coast',
            `seed ${seed}: stairs run ${rs}-${re} touches water on the left`);
          assert(w.terrain[bandRow][re + 1] !== 'sea' && w.terrain[bandRow][re + 1] !== 'coast',
            `seed ${seed}: stairs run ${rs}-${re} touches water on the right`);
        }
      }
    }
  }
});

Deno.test('rooms — world.stairs matches the terrain', () => {
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

Deno.test('rooms — wall bands never stack vertically', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const w = generateWorld(seed, W, H);
    for (let ty = 1; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const k = w.terrain[ty][tx];
        if (k !== 'cliff' && k !== 'stairs') continue;
        // No cliff/stairs directly above or below.
        assert(
          w.terrain[ty - 1][tx] !== 'cliff' && w.terrain[ty - 1][tx] !== 'stairs',
          `seed ${seed}: wall stacked vertically at (${tx},${ty})`,
        );
        assert(
          w.terrain[ty + 1][tx] !== 'cliff' && w.terrain[ty + 1][tx] !== 'stairs',
          `seed ${seed}: wall stacked vertically at (${tx},${ty})`,
        );
      }
    }
  }
});

// ── Reachability and physics ───────────────────────────────────────────────

Deno.test('rooms — every walkable tile is reachable through the stairs', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const w = generateWorld(seed, W, H);
    const sx = w.rooms[0].x;
    const sy = w.rooms[0].y;
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
      // Landing region one row above/below the band, spanning the stairs plus
      // one column each side. Where there is land, a solid footprint must not
      // make it unoccupiable (the band row's cliff margins are excluded — the
      // walkable path is the stairs column itself).
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

// ── Variety across seeds ─────────────────────────────────────────────────

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

Deno.test('rooms — some worlds multiply-join: a room bridges several rooms up or down', () => {
  // Across seeds the per-level room counts vary (1..3), so at least sometimes a
  // single room on one level should span two rooms on the level below.
  let multiJoin = 0;
  const seenCounts = new Set<number>();
  const seenPartitions = new Set<string>();
  for (let seed = 1; seed <= 60; seed++) {
    const w = generateWorld(seed, W, H);
    seenCounts.add(w.rooms.length);
    seenPartitions.add(w.rooms.map((r) => r.width).join(','));
    const levels = levelsOf(w);
    for (let z = 0; z < levels.length - 1; z++) {
      for (const u of levels[z]) {
        const overlaps = levels[z + 1].filter(
          (l) => Math.max(u.x, l.x) <= Math.min(u.x + u.width, l.x + l.width) - 1,
        );
        if (overlaps.length >= 2) multiJoin++;
      }
    }
  }
  assert(seenCounts.size >= 2, 'expected variation in room count');
  assert(seenPartitions.size >= 3, 'expected variation in how levels split');
  assert(multiJoin >= 3, 'expected some rooms to join multiple rooms on one level');
});

Deno.test('rooms — builds on smaller maps too (16x20 keeps 3 levels)', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const w = generateWorld(seed, 16, 20);
    const levels = levelsOf(w);
    assert(levels.length === 3, `seed ${seed}: expected 3 levels on 16x20`);
    for (const stair of w.stairs as StairRun[]) {
      assert(WALKABLE.has(w.terrain[stair.row - 1][stair.start + Math.floor(stair.width / 2)]));
      assert(WALKABLE.has(w.terrain[stair.row + 1][stair.start + Math.floor(stair.width / 2)]));
    }
  }
});