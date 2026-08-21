// Print ASCII terrain maps for a range of seeds to eyeball room layout variety.
//   deno run --allow-env scripts/rooms_preview.ts [seedStart] [seedEnd]
import { generateWorld } from '../lib/game.ts';

const GLYPH: Record<string, string> = {
  sea: '~',
  coast: ',',
  beach: '.',
  grass: '"',
  cliff: '#',
  rock: '^',
  stairs: 'S',
};

const start = Number(Deno.args[0] ?? 1);
const end = Number(Deno.args[1] ?? 6);
for (let seed = start; seed <= end; seed++) {
  const w = generateWorld(seed, 16, 24);
  console.log(`── seed ${seed} ──────────────────────────`);
  for (let ty = 0; ty < w.height; ty++) {
    console.log(w.terrain[ty].map((k) => GLYPH[k]).join(''));
  }
}
