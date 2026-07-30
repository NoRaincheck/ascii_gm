import { generateCard, generateArt, getGenData } from './lib/card.ts';
import { loadOracles } from './lib/oracle_data.ts';
import { printCard } from './lib/terminal.ts';
import { parseSpritesheet, renderCardToCanvas } from './lib/spritesheet.ts';
import type { ThemeName } from './lib/theme.ts';
import { setSeed } from './lib/rng.ts';

async function main() {
  const args = parseArgs(Deno.args);
  const theme = (args.theme ?? 'macchiato') as ThemeName;
  const count = args.count ?? 1;
  const outputDir = args['output-dir'];

  if (args.seed !== undefined) {
    setSeed(args.seed as number);
  }

  loadOracles('ironsworn_oracles.json');

  if (outputDir) {
    Deno.mkdirSync(outputDir, { recursive: true });
  }

  const { createCanvas, loadImage } = await import('npm:canvas');

  const spritesheetImg = await loadImage('wang_3050_BIOS_ROM__8x16.png');
  const tempCanvas = createCanvas(spritesheetImg.width, spritesheetImg.height);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(spritesheetImg, 0, 0);
  parseSpritesheet(spritesheetImg, tempCtx as unknown as CanvasRenderingContext2D);
  tempCanvas.width = 0;
  tempCanvas.height = 0;

  for (let idx = 0; idx < count; idx++) {
    const card = generateCard();
    const art = generateArt(card);

    if (count === 1) {
      printCard(card, theme, art);
    }

    if (outputDir) {
      const filename = count === 1 ? `card_${theme}.png` : `card_${String(idx).padStart(3, '0')}.png`;
      const outPath = `${outputDir}/${filename}`;

      const tempCtx2 = createCanvas(1, 1).getContext('2d');
      const canvas = createCanvas(1, 1);
      const ctx = canvas.getContext('2d');
      renderCardToCanvas(ctx as unknown as CanvasRenderingContext2D, card, theme, true, art);

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
  --count N          Number of cards to generate [default: 1]
  --output-dir DIR   Output directory for PNG files
  --seed N           Seed for reproducible generation
  --help, -h         Show this help message`);
}

if (import.meta.main) {
  main();
}
