import { generateCard, getGenData, resetGenData } from '../lib/card.ts';
import { loadOracles } from '../lib/oracle_data.ts';
import { parseSpritesheet, renderCardToCanvas } from '../lib/spritesheet.ts';
import type { ThemeName } from '../lib/theme.ts';
import { setSeed } from '../lib/rng.ts';

const SEEDS: Record<string, number> = { macchiato: 42, latte: 99 };

async function main() {
  const { createCanvas, loadImage } = await import('npm:canvas');

  const spritesheetImg = await loadImage('wang_3050_BIOS_ROM__8x16.png');
  const tempCanvas = createCanvas(spritesheetImg.width, spritesheetImg.height);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(spritesheetImg, 0, 0);
  parseSpritesheet(spritesheetImg, tempCtx as unknown as CanvasRenderingContext2D);
  tempCanvas.width = 0;
  tempCanvas.height = 0;

  loadOracles('ironsworn_oracles.json');

  for (
    const [theme, name] of [['macchiato', 'card_macchiato.png'], ['latte', 'card_latte.png']] as [ThemeName, string][]
  ) {
    resetGenData();
    setSeed(SEEDS[theme]);
    loadOracles('ironsworn_oracles.json');
    const card = generateCard();

    const canvas = createCanvas(1, 1);
    const ctx = canvas.getContext('2d');
    renderCardToCanvas(ctx as unknown as CanvasRenderingContext2D, card, theme, true);

    const buf = canvas.toBuffer('image/png');
    Deno.writeFileSync(name, new Uint8Array(buf));
    console.log(`Saved ${name}`);
  }
}

main();
