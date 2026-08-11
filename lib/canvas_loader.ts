/**
 * Shared canvas/spritesheet loading utility for Deno CLI scripts.
 * Extracts common boilerplate from cli.ts and scripts/samples.ts.
 */
import { parseSpritesheet } from './spritesheet.ts';

// Opaque canvas module handle — types are intentionally loose to match npm:canvas.
export interface CanvasAPI {
  createCanvas(w: number, h: number): unknown;
  loadImage(src: string): Promise<unknown>;
}

/**
 * Load and parse the spritesheet, returning the canvas API for further use.
 * The spritesheet is parsed once and cached internally by lib/spritesheet.ts.
 */
export async function loadSpritesheetDeno(
  canvasAPI: CanvasAPI,
  spritesheetPath: string = 'wang_3050_BIOS_ROM__8x16.png',
): Promise<CanvasAPI> {
  const spritesheetImg = (await canvasAPI.loadImage(spritesheetPath)) as { width: number; height: number };
  const tempCanvas = canvasAPI.createCanvas(spritesheetImg.width, spritesheetImg.height);
  const tempCtx = (tempCanvas as { getContext: (type: string) => unknown }).getContext('2d');
  (tempCtx as CanvasRenderingContext2D).drawImage(spritesheetImg as CanvasImageSource, 0, 0);
  parseSpritesheet(spritesheetImg as CanvasImageSource, tempCtx as unknown as CanvasRenderingContext2D);
  (tempCanvas as { width: number; height: number }).width = 0;
  (tempCanvas as { width: number; height: number }).height = 0;
  return canvasAPI;
}
