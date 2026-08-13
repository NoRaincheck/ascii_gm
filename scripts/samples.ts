import { generateCard, resetGenData } from '../lib/card.ts';
import { loadOracles } from '../lib/oracle_data.ts';
import type { Layout } from '../lib/oracle_data.ts';
import { renderCardToCanvas } from '../lib/spritesheet.ts';
import type { ThemeName } from '../lib/theme.ts';
import { setSeed } from '../lib/rng.ts';
import { loadSpritesheetDeno } from '../lib/canvas_loader.ts';
import { parseArgs } from '../lib/cli_args.ts';

const SEEDS: Record<string, number> = { macchiato: 42, latte: 99 };

async function main() {
  const args = parseArgs(Deno.args, ['--layout']);
  const layout = (args.layout ?? 'portrait') as Layout;
  const canvasAPI = await importCanvas();
  await loadSpritesheetDeno(canvasAPI);

  for (const [theme, name] of [['macchiato', 'macchiato'], ['latte', 'latte']] as [ThemeName, string][]) {
    resetGenData();
    setSeed(SEEDS[theme]);
    loadOracles('ironsworn_oracles.json');
    const card = generateCard(layout);

    const canvas = canvasAPI.createCanvas(1, 1) as { width: number; height: number; getContext: (t: string) => unknown; toBuffer: (f: string) => Uint8Array };
    renderCardToCanvas(canvas.getContext('2d') as CanvasRenderingContext2D, card, theme, true, layout);

    const filename = layout === 'portrait' ? `card_${name}.png` : `card_${name}_${layout}.png`;
    Deno.writeFileSync(filename, new Uint8Array(canvas.toBuffer('image/png')));
    console.log(`Saved ${filename} (${canvas.width}x${canvas.height})`);
  }
}

async function importCanvas(): Promise<{ createCanvas: (w: number, h: number) => unknown; loadImage: (s: string) => Promise<unknown> }> {
  const canvas = await import('npm:canvas');
  return { createCanvas: canvas.createCanvas, loadImage: canvas.loadImage };
}

main();
