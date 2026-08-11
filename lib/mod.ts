// Text generation (oracle-driven template expansion)
export { generateList, generateText } from './text_generator.ts';

// Oracle data loading and generation data
export { buildGenData, getOracles, loadOracles, setOracles } from './oracle_data.ts';
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

// PRNG utilities
export { createRng, random, randomInt, setSeed, getSeed, shuffle, shuffleWith } from './rng.ts';

// Deno CLI canvas helpers
export type { CanvasAPI } from './canvas_loader.ts';
export { loadSpritesheetDeno } from './canvas_loader.ts';
