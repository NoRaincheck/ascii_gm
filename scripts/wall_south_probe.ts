// Probe: can a tile with sea touching its SOUTH ever be a wall (cliff)?
// Sweeps seeds/sizes, records the kind of every tile's south neighbor.
import { generateWorld, type World } from '../lib/game.ts';

function check(seed: number, w: number, h: number): string[] {
  const errs: string[] = [];
  const world: World = generateWorld(seed, w, h);
  const t = world.terrain;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const kind = t[y][x];
      const south = y + 1 < h ? t[y + 1][x] : 'sea'; // out-of-bounds south is sea margin
      if (kind === 'cliff' && (south === 'sea' || south === 'coast')) {
        errs.push(`cliff with water south at ${x},${y} (south=${south})`);
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
