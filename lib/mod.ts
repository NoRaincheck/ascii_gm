// Text generation (oracle-driven template expansion)
export { generateList, generateText } from './text_generator.ts';

// Oracle data loading and generation data
export { buildGenData, getOracles, loadOracles, setOracles, PORTRAIT_TEMPLATE, LANDSCAPE_TEMPLATE } from './oracle_data.ts';
export type { Layout, OracleEntry } from './oracle_data.ts';

// Card generation (entry point)
export { generateCard, getGenData, resetGenData } from './card.ts';

// Theming and colorization
export {
  colorizeCard,
  FIELD_CATEGORY,
  getFieldColor,
  getPalette,
  getPngColors,
  getTemplateText,
  getTerminalPalette,
  LANDSCAPE_FIELD_CATEGORY,
  LANDSCAPE_TEMPLATE_TEXT,
  type Rgb,
  TEMPLATE_TEXT,
  type ThemeName,
} from './theme.ts';

// Terminal output
export { printCard } from './terminal.ts';

// Canvas rendering (spritesheet + card rendering)
export { getGlyphIndex, isLoaded, parseSpritesheet, renderCardToCanvas } from './spritesheet.ts';

// Elevation tileset (cliff-face / wall rendering for the terrain game)
export {
  elevationTileIndex,
  getElevationTile,
  isElevationLoaded,
  parseElevationTileset,
  stairsTileIndex,
  wallRunInfo,
  wallTileIndex,
} from './elevation_tileset.ts';
export type { TerrainKind } from './elevation_tileset.ts';

// PRNG utilities
export { createRng, getSeed, random, randomInt, setSeed, shuffle, shuffleWith } from './rng.ts';

// Deno CLI canvas helpers
export type { CanvasAPI } from './canvas_loader.ts';
export { loadSpritesheetDeno } from './canvas_loader.ts';

// CLI argument parsing
export { parseArgs, HELP_TEXT } from './cli_args.ts';
