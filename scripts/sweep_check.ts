// Invariant sweep across many seeds/sizes for the terrace generator.
import { generateWorld, type World } from '../lib/game.ts';

const WALK = new Set(['grass', 'beach', 'rock', 'stairs']);

function check(seed: number, w: number, h: number): string[] {
  const errs: string[] = [];
  const world: World = generateWorld(seed, w, h);
  const t = world.terrain;
  // sea margins
  for (let x = 0; x < w; x++) {
    if (t[0][x] !== 'sea') errs.push(`top margin row0 col${x}=${t[0][x]}`);
    if (t[h - 1][x] !== 'sea') errs.push(`bottom margin row${h - 1} col${x}=${t[h - 1][x]}`);
  }
  for (let y = 0; y < h; y++) {
    if (t[y][0] !== 'sea') errs.push(`left margin row${y} col0=${t[y][0]}`);
    if (t[y][w - 1] !== 'sea') errs.push(`right margin row${y} col${w - 1}=${t[y][w - 1]}`);
  }
  // rooms match terrain exactly; per-column intervals valid
  const covered: string[][] = Array.from({ length: h }, () => new Array(w).fill('none'));
  for (const r of world.rooms) {
    if (r.tops.length !== r.width || r.bottoms.length !== r.width) {
      errs.push(`room ${r.type}@${r.x} tops/bottoms length mismatch`);
      continue;
    }
    for (let i = 0; i < r.width; i++) {
      const top = r.tops[i];
      const bot = r.bottoms[i];
      if (bot - top + 1 < 3) errs.push(`room ${r.type}@${r.x}+${i} h=${bot - top + 1} < 3`);
      for (let y = top; y <= bot; y++) {
        if (y < 0 || y >= h || r.x + i < 0 || r.x + i >= w) {
          errs.push(`room ${r.type}@${r.x}+${i} out of bounds at y${y}`);
          continue;
        }
        if (covered[y][r.x + i] !== 'none') errs.push(`overlap at ${r.x + i},${y}`);
        covered[y][r.x + i] = r.type;
        if (t[y][r.x + i] !== r.type) errs.push(`terrain ${t[y][r.x + i]} != room ${r.type} at ${r.x + i},${y}`);
      }
    }
  }
  // per-column: level order never rises downward; exactly one non-floor row between stacked rooms; wall under upper bottom
  for (let x = 1; x < w - 1; x++) {
    const lv = { rock: 2, grass: 1, beach: 0 } as Record<string, number>;
    let prevBot = -10;
    let prevType: string | null = null;
    let y = 0;
    while (y < h) {
      if (covered[y][x] === 'none') {
        y++;
        continue;
      }
      const kind = covered[y][x];
      let bot = y;
      while (bot + 1 < h && covered[bot + 1][x] === kind) bot++;
      if (prevType !== null) {
        if (lv[kind] > lv[prevType]) errs.push(`level rises downward at col${x} row${y}: ${prevType}->${kind}`);
        if (y - prevBot !== 2) errs.push(`gap col${x}: prevBot${prevBot} nextTop${y} (expected 2)`);
        if (t[y - 1][x] !== 'cliff' && t[y - 1][x] !== 'stairs') {
          errs.push(`no wall under bottom edge at col${x} row${y - 1}: ${t[y - 1][x]}`);
        }
      }
      prevBot = bot;
      prevType = kind;
      y = bot + 1;
    }
  }
  // stairs: 1-3 wide, on 'stairs' terrain, never adjacent to sea/coast, never flush to another run in same row
  for (const s of world.stairs) {
    if (s.width < 1 || s.width > 3) errs.push(`stairs width ${s.width}`);
    for (let i = 0; i < s.width; i++) {
      if (t[s.row][s.start + i] !== 'stairs') errs.push(`stairs terrain mismatch at ${s.start + i},${s.row}`);
    }
    const l = t[s.row][s.start - 1];
    const r = t[s.row][s.start + s.width];
    if (l === 'sea' || l === 'coast') errs.push(`stairs left flank ${l} at ${s.start - 1},${s.row}`);
    if (r === 'sea' || r === 'coast') errs.push(`stairs right flank ${r} at ${s.start + s.width},${s.row}`);
  }
  for (let a = 0; a < world.stairs.length; a++) {
    for (let b = a + 1; b < world.stairs.length; b++) {
      const A = world.stairs[a];
      const B = world.stairs[b];
      if (A.row === B.row && A.start <= B.start + B.width && B.start <= A.start + A.width) {
        errs.push(`stairs runs flush/overlap in row ${A.row}`);
      }
    }
  }
  // connectivity: flood from top room; every walkable tile reached
  const first = world.rooms[0];
  const seen = new Set<string>([`${first.x},${first.tops[0]}`]);
  const q: Array<[number, number]> = [[first.x, first.tops[0]]];
  while (q.length) {
    const [cx, cy] = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      const k = `${nx},${ny}`;
      if (seen.has(k) || nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (!WALK.has(t[ny][nx])) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (WALK.has(t[y][x]) && !seen.has(`${x},${y}`)) errs.push(`unreachable walkable at ${x},${y}`);
    }
  }
  // every adjacent room pair has a door: check each wall cell between stacked rooms for stairs somewhere in row
  return errs;
}

let totalErrs = 0;
let checked = 0;
const sizes: Array<[number, number]> = [[16, 24], [18, 26], [20, 28], [14, 20], [24, 32]];
for (const [w, h] of sizes) {
  for (let seed = 1; seed <= 40; seed++) {
    const errs = check(seed, w, h);
    checked++;
    if (errs.length) {
      totalErrs++;
      console.log(`seed ${seed} ${w}x${h}: ${errs.length} errs`);
      for (const e of errs.slice(0, 5)) console.log('   ', e);
    }
  }
}
console.log(`checked ${checked} worlds, ${totalErrs} with errors`);
