// Probe: which walls are allowed to hang over sea on their SOUTH side?
// Issue #13: rock/grass lips facing open water get a shore wall dropped into
// the water below them, so a cliff MAY have sea south — but only when the
// floor directly above is rock/grass (the lip it guards). Band walls (above
// another band row or stairs) must still always have ground beneath them.
import { generateWorld, type World } from '../lib/game.ts';

function check(seed: number, w: number, h: number): string[] {
  const errs: string[] = [];
  const world: World = generateWorld(seed, w, h);
  const t = world.terrain;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const kind = t[y][x];
      const south = y + 1 < h ? t[y + 1][x] : 'sea'; // out-of-bounds south is sea margin
      if (kind !== 'cliff' || (south !== 'sea' && south !== 'coast')) continue;
      const above = y > 0 ? t[y - 1][x] : 'sea';
      const isShoreWall = above === 'rock' || above === 'grass';
      if (!isShoreWall) {
        errs.push(`band wall over water at ${x},${y} (south=${south}, above=${above})`);
      }
    }
  }
  return errs;
}

let totalErrs = 0;
let checked = 0;
const sizes: Array<[number, number]> = [[16, 24], [18, 26], [20, 28], [14, 20], [24, 32], [16, 16], [12, 14]];
for (const [w, h] of sizes) {
  for (let seed = 1; seed <= 60; seed++) {
    const errs = check(seed, w, h);
    checked++;
    if (errs.length) {
      totalErrs++;
      if (totalErrs <= 10) console.log(`seed ${seed} ${w}x${h}:`, errs.slice(0, 3));
    }
  }
}
console.log(`checked ${checked} worlds, ${totalErrs} with cliff-over-water errors`);

// Also: which kinds ever appear with sea directly south?
const southOf = new Map<string, Set<string>>();
for (const [w, h] of sizes) {
  for (let seed = 1; seed <= 60; seed++) {
    const world = generateWorld(seed, w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const south = y + 1 < h ? world.terrain[y + 1][x] : 'sea';
        if (south === 'sea') {
          const k = world.terrain[y][x];
          if (!southOf.has(k)) southOf.set(k, new Set());
          southOf.get(k)!.add(`${w}x${h}`);
        }
      }
    }
  }
}
console.log('\nkinds that ever have sea directly south:');
for (const [k, sizes2] of [...southOf.entries()].sort()) {
  console.log(`  ${k}: ${sizes2.size} size configs (e.g. ${[...sizes2].slice(0, 3).join(', ')})`);
}
