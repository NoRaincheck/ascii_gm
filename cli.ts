import { generateCard } from './lib/card.ts';
import { loadOracles } from './lib/oracle_data.ts';
import type { Layout } from './lib/oracle_data.ts';
import { printCard } from './lib/terminal.ts';
import { renderCardToCanvas } from './lib/spritesheet.ts';
import type { ThemeName } from './lib/theme.ts';
import { setSeed } from './lib/rng.ts';
import { loadSpritesheetDeno } from './lib/canvas_loader.ts';
import { parseArgs, HELP_TEXT } from './lib/cli_args.ts';

async function main() {
  const args = parseArgs(Deno.args, ['--theme', '--layout', '--count', '--output-dir', '--seed', '--help', '-h']);
  if (args.help) { console.log(HELP_TEXT); Deno.exit(0); }

  const theme = (args.theme ?? 'macchiato') as ThemeName;
  const layout = (args.layout ?? 'portrait') as Layout;
  const count = Number(args.count) || 1;
  const outputDir = args['output-dir'] as string | undefined;

  if (args.seed !== undefined) setSeed(args.seed as number);
  loadOracles('ironsworn_oracles.json');
  if (outputDir) Deno.mkdirSync(outputDir, { recursive: true });
  await loadSpritesheetDeno(await importCanvas());

  for (let idx = 0; idx < count; idx++) {
    const card = generateCard(layout);
    if (count === 1) printCard(card, theme, layout);
    if (outputDir) {
      const buf = await renderPng(card, theme, layout);
      const filename = count === 1 ? `card_${theme}_${layout}.png` : `card_${String(idx).padStart(3, '0')}.png`;
      const outPath = `${outputDir}/${filename}`;
      Deno.writeFileSync(outPath, new Uint8Array(buf));
      console.log(`Saved ${outPath}`);
    }
  }
}

async function renderPng(card: string, theme: ThemeName, layout: Layout): Promise<Uint8Array> {
  const c = await importCanvas();
  const canvas = c.createCanvas(1, 1) as { width: number; height: number; getContext: (t: string) => unknown; toBuffer: (f: string) => Uint8Array };
  renderCardToCanvas(canvas.getContext('2d') as CanvasRenderingContext2D, card, theme, true, layout);
  return new Uint8Array(canvas.toBuffer('image/png'));
}

async function importCanvas(): Promise<{ createCanvas: (w: number, h: number) => unknown; loadImage: (s: string) => Promise<unknown> }> {
  const canvas = await import('npm:canvas');
  return { createCanvas: canvas.createCanvas, loadImage: canvas.loadImage };
}

if (import.meta.main) main();
