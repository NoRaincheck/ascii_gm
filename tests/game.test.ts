import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { canOccupyAt, generateWorld, landTouchesWater, ROOM_LEVEL, TILE } from '../lib/game.ts';
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
          const kind = w.terrain[ty][tx];
          // Levels are rounded quarter-circle shapes, so a room's bbox corners
          // spill out into the sea where the terrace curves away.
          assert(
            kind === r.type || kind === 'sea',
            `room fill (seed ${seed}) room ${r} at (${tx},${ty}) = ${kind}, expected ${r.type} (or sea for a rounded corner)`,
          );
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
    assert(
      types[0] === 'rock' && types[1] === 'grass' && types[2] === 'beach',
      `seed ${seed}: wrong level order ${types.join('>')}`,
    );
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

Deno.test('rooms — wall bands hug the rounded lid; doors are one 1-wide tile per overlapping pair', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (const w of [generateWorld(seed, W, H), generateWorld(seed, 16, 20)]) {
      const levels = levelsOf(w);
      for (let z = 0; z < levels.length - 1; z++) {
        const up = levels[z];
        const down = levels[z + 1];
        const bandRow = up[0].y + up[0].height;
        // Every wall or stair tile sits directly under walkable lid of the
        // level above: bands follow the rounded terrace and never float.
        for (let c = 1; c < W - 1; c++) {
          const kind = w.terrain[bandRow][c];
          if (kind === 'cliff' || kind === 'stairs') {
            assert(
              WALKABLE.has(w.terrain[bandRow - 1][c]),
              `seed ${seed}: band tile (${c},${bandRow}) hangs under open sea`,
            );
          }
        }
        // One 1-wide door per overlapping (upper, lower) room pair. A lone
        // overlapping column only needs its own door when both neighbours are
        // solid cliff; a pinch whose every neighbour is open sea or a
        // neighbour's stair stays sealed (the two rooms reach each other
        // through their level-mates' doors).  A wider overlap may stay sealed
        // too if the rounding scooped out every column of the wall band there.
        for (const u of up) {
          for (const l of down) {
            const s = Math.max(u.x, l.x);
            const e = Math.min(u.x + u.width, l.x + l.width) - 1;
            if (s > e) continue;
            const doors = w.stairs.filter(
              (door) => door.row === bandRow && door.start >= s && door.start <= e,
            );
            for (const d of doors) assertEquals(d.width, 1, 'stairs are always 1 tile wide');
            if (e - s + 1 >= 2) {
              // A door is expected unless the rounding cut every column of the
              // band (no wall survived), the landing below all fell away, or the
              // only surviving columns are pinched between doors placed for the
              // neighbouring overlaps.
              let canDoor = false;
              for (const c of Array.from({ length: e - s + 1 }, (_, i) => s + i)) {
                const k = w.terrain[bandRow][c];
                if (k !== 'cliff' && k !== 'stairs') continue;
                const below = w.terrain[bandRow + 1][c];
                if (!(below === 'grass' || below === 'rock' || below === 'beach' || below === 'stairs')) continue;
                const leftAdj = c - 1 >= 0 && w.terrain[bandRow][c - 1] === 'stairs';
                const rightAdj = c + 1 < W && w.terrain[bandRow][c + 1] === 'stairs';
                if (!leftAdj && !rightAdj) {
                  canDoor = true;
                  break;
                }
              }
              if (canDoor) {
                assert(
                  doors.length >= 1,
                  `seed ${seed}: no door between u@${u.x}x${u.width} and l@${l.x}x${l.width} (${s}-${e})`,
                );
              }
            } else {
              const left = w.terrain[bandRow][s - 1];
              const right = w.terrain[bandRow][s + 1];
              if (left === 'cliff' && right === 'cliff') {
                assert(doors.length >= 1, `seed ${seed}: flanked lone column ${s} should carry a 1-wide door`);
              }
            }
          }
        }
        // Every stair lands on solid ground and keeps at least one wall flank.
        for (const run of stairsRuns(w, bandRow)) {
          for (let c = run[0]; c <= run[1]; c++) {
            assert(
              WALKABLE.has(w.terrain[bandRow - 1][c]) && WALKABLE.has(w.terrain[bandRow + 1][c]),
              `seed ${seed}: stair (${c},${bandRow}) is not flanked by land above and below`,
            );
            const left = w.terrain[bandRow][c - 1];
            const right = w.terrain[bandRow][c + 1];
            assert(
              left === 'cliff' || right === 'cliff',
              `seed ${seed}: stair (${c},${bandRow}) sits between open sea on both sides`,
            );
          }
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

Deno.test('rooms — stair runs are never placed flush against each other', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const w = generateWorld(seed, W, H);
    for (let ty = 0; ty < H; ty++) {
      const runs = stairsRuns(w, ty)
        .map(([s, e]) => ({ s, e }))
        .sort((a, b) => a.s - b.s);
      for (let i = 1; i < runs.length; i++) {
        const prev = runs[i - 1];
        const cur = runs[i];
        // Doors never sit flush: at least one band column (cliff or, where a
        // scoop ate the band, sea) must separate two stair runs.
        assert(
          cur.s > prev.e + 1,
          `seed ${seed}: stair runs ${prev.s}-${prev.e} and ${cur.s}-${cur.e} are adjacent (row ${ty})`,
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

Deno.test('rooms — terrace corners are rounded quarter-circles, deterministic per span', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (const w of [generateWorld(seed, W, H), generateWorld(seed, 16, 20)]) {
      let sawWideArc = false;
      for (const level of levelsOf(w)) {
        const x0 = Math.min(...level.map((r) => r.x));
        const x1 = Math.max(...level.map((r) => r.x + r.width)) - 1;
        const span = x1 - x0 + 1;
        if (span < 7) continue; // too narrow; stays a plain rectangle
        const y0 = level[0].y;
        const y1 = y0 + level[0].height - 1;
        // The four bounding corners of every sizable level are scooped to sea.
        for (
          const [tx, ty] of [
            [x0, y0],
            [x1, y0],
            [x0, y1],
            [x1, y1],
          ] as Array<[number, number]>
        ) {
          assertEquals(
            w.terrain[ty][tx],
            'sea',
            `seed ${seed}: level ${level[0].type} corner (${tx},${ty}) is not rounded`,
          );
        }
        // Wide levels round with a full 2-tile arc, not a bare bevel: the tile
        // one in from each corner is scooped too.
        if (span >= 10) {
          sawWideArc = true;
          assertEquals(w.terrain[y0][x0 + 1], 'sea', 'wide corner missing arc (top-left)');
          assertEquals(w.terrain[y0][x1 - 1], 'sea', 'wide corner missing arc (top-right)');
          assertEquals(w.terrain[y1][x0 + 1], 'sea', 'wide corner missing arc (bottom-left)');
          assertEquals(w.terrain[y1][x1 - 1], 'sea', 'wide corner missing arc (bottom-right)');
        }
      }
      // The grass level always spans the full width, so every map rounds by a
      // real arc somewhere.
      assert(sawWideArc, `seed ${seed}: expected a wide level with a 2-tile arc`);
    }
  }
});

Deno.test('rooms — no 2×2 block of wall or stair tiles ever forms', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const w = generateWorld(seed, W, H);
    for (let ty = 0; ty < H - 1; ty++) {
      for (let tx = 0; tx < W - 1; tx++) {
        const solid = (x: number, y: number): boolean => w.terrain[y][x] === 'cliff' || w.terrain[y][x] === 'stairs';
        assert(
          !(solid(tx, ty) && solid(tx + 1, ty) && solid(tx, ty + 1) && solid(tx + 1, ty + 1)),
          `seed ${seed}: 2×2 wall/stair block at (${tx},${ty})`,
        );
      }
    }
  }
});

// ── Reachability and physics ───────────────────────────────────────────────

Deno.test('rooms — every walkable tile is reachable through the stairs', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const w = generateWorld(seed, W, H);
    // Seed the flood at the first walkable tile (the top-left corner of the
    // first room may be scooped away by the rounding).
    let sx = -1;
    let sy = -1;
    for (let ty = 0; ty < H && sy === -1; ty++) {
      for (let tx = 0; tx < W && sy === -1; tx++) {
        if (WALKABLE.has(w.terrain[ty][tx])) {
          sx = tx;
          sy = ty;
        }
      }
    }
    assert(sy !== -1, `seed ${seed}: found no walkable tile at all`);
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
        const water = (x: number, y: number): boolean =>
          x >= 0 && x < W && y >= 0 && y < H &&
          (w.terrain[y][x] === 'sea' || w.terrain[y][x] === 'coast');
        const hasWaterNeighbor = water(tx - 1, ty) || water(tx + 1, ty) || water(tx, ty - 1) || water(tx, ty + 1);
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
  const differs = (a: Set<string>, b: Set<string>): boolean => a.size !== b.size || [...a].some((k) => !b.has(k));
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
