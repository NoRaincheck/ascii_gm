import { generateCard, getGenData } from './lib/card.ts';
import { loadOracles } from './lib/oracle_data.ts';
import type { Layout } from './lib/oracle_data.ts';
import { printCard } from './lib/terminal.ts';
import { renderCardToCanvas } from './lib/spritesheet.ts';
import type { ThemeName } from './lib/theme.ts';
import { setSeed } from './lib/rng.ts';
import { loadSpritesheetDeno } from './lib/canvas_loader.ts';
import type { CanvasAPI } from './lib/canvas_loader.ts';

async function main() {
  const args = parseArgs(Deno.args);
  const theme = (args.theme ?? 'macchiato') as ThemeName;
  const layout = (args.layout ?? 'portrait') as Layout;
  const count = Number(args.count) || 1;
  const outputDir = args['output-dir'];

  if (args.seed !== undefined) {
    setSeed(args.seed as number);
  }

  loadOracles('ironsworn_oracles.json');

  if (outputDir) {
    Deno.mkdirSync(outputDir as string, { recursive: true });
  }

  await loadSpritesheetDeno(await importCanvas());

  for (let idx = 0; idx < Number(count); idx++) {
    const card = generateCard(layout);

    if (count === 1) {
      printCard(card, theme, layout);
    }

    if (outputDir) {
      const filename = count === 1 ? `card_${theme}_${layout}.png` : `card_${String(idx).padStart(3, '0')}.png`;
      const outPath = `${outputDir}/${filename}`;

      const c = await importCanvas();
      const canvas = c.createCanvas(1, 1) as { width: number; height: number; getContext: (type: string) => unknown; toBuffer: (format: string) => Uint8Array };
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      renderCardToCanvas(ctx, card, theme, true, layout);

      const buf = canvas.toBuffer('image/png');
      Deno.writeFileSync(outPath, new Uint8Array(buf));
      console.log(`Saved ${outPath}`);
    }
  }
}

function parseArgs(args: string[]): Record<string, string | number | undefined> {
  const result: Record<string, string | number | undefined> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--theme' && i + 1 < args.length) {
      result.theme = args[++i];
    } else if (arg === '--layout' && i + 1 < args.length) {
      result.layout = args[++i];
    } else if (arg === '--count' && i + 1 < args.length) {
      result.count = parseInt(args[++i]);
    } else if (arg === '--output-dir' && i + 1 < args.length) {
      result['output-dir'] = args[++i];
    } else if (arg === '--seed' && i + 1 < args.length) {
      result.seed = parseInt(args[++i]);
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      Deno.exit(0);
    }
  }
  return result;
}

function printHelp() {
  console.log(`Usage: deno run cli.ts [OPTIONS]

Options:
  --theme THEME      Catppuccin theme (macchiato, latte) [default: macchiato]
  --layout LAYOUT    Card layout (portrait, landscape) [default: portrait]
  --count N          Number of cards to generate [default: 1]
  --output-dir DIR   Output directory for PNG files
  --seed N           Seed for reproducible generation
  --help, -h         Show this help message`);
}

async function importCanvas(): Promise<CanvasAPI> {
  const canvas = await import('npm:canvas');
  return {
    createCanvas: canvas.createCanvas,
    loadImage: canvas.loadImage,
  };
}

if (import.meta.main) {
  main();
}
