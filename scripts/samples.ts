import { generateCard, getGenData, resetGenData } from '../lib/card.ts';
import { loadOracles } from '../lib/oracle_data.ts';
import type { Layout } from '../lib/oracle_data.ts';
import { renderCardToCanvas } from '../lib/spritesheet.ts';
import type { ThemeName } from '../lib/theme.ts';
import { setSeed } from '../lib/rng.ts';
import { loadSpritesheetDeno } from '../lib/canvas_loader.ts';
import type { CanvasAPI } from '../lib/canvas_loader.ts';

const SEEDS: Record<string, number> = { macchiato: 42, latte: 99 };

async function main() {
  const args = parseArgs(Deno.args);
  const layout = (args.layout ?? 'portrait') as Layout;

  const canvasAPI = await importCanvas();
  await loadSpritesheetDeno(canvasAPI);

  loadOracles('ironsworn_oracles.json');

  for (const [theme, name] of [['macchiato', 'macchiato'], ['latte', 'latte']] as [ThemeName, string][]) {
    resetGenData();
    setSeed(SEEDS[theme]);
    loadOracles('ironsworn_oracles.json');
    const card = generateCard(layout);

    const canvas = canvasAPI.createCanvas(1, 1) as { width: number; height: number; getContext: (type: string) => unknown; toBuffer: (format: string) => Uint8Array };
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    renderCardToCanvas(ctx, card, theme, true, layout);

    const filename = layout === 'portrait' ? `card_${name}.png` : `card_${name}_${layout}.png`;
    const buf = canvas.toBuffer('image/png');
    Deno.writeFileSync(filename, new Uint8Array(buf));
    console.log(`Saved ${filename} (${canvas.width}x${canvas.height})`);
  }
}

async function importCanvas(): Promise<CanvasAPI> {
  const canvas = await import('npm:canvas');
  return {
    createCanvas: canvas.createCanvas,
    loadImage: canvas.loadImage,
  };
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--layout' && i + 1 < args.length) {
      result.layout = args[++i];
    }
  }
  return result;
}

main();
