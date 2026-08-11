/**
 * Elevation tileset support for Tilemap_Elevation.png.
 *
 * The elevation tileset is a 256×512 px image (4×8 grid of 64×64 tiles = 32 tiles).
 *
 * Layout (row, column) — actual image tile indices:
 *   Row 0: [R NW ] [R N ] [R NE ] [R NWE ]              ← indices  0,  1,  2,  3
 *   Row 1: [R W ]  [R  ]  [R E ]  [R WE ]               ← indices  4,  5,  6,  7
 *   Row 2: [R WS]  [R S ]  [R SE]  [R WSE ]             ← indices  8,  9, 10, 11
 *   Row 3: [WALL_L] [WALL_C] [WALL_R] [WALL_S]           ← indices 12, 13, 14, 15
 *   Row 4: [R NWS] [R NS ] [R NES] [R NWES]             ← indices 16, 17, 18, 19
 *   Row 5: [Beach 4] [Beach 5] [EMPTY]   [EMPTY]         ← indices 20, 21, 22, 23
 *   Row 6: [EMPTY]   [EMPTY]   [EMPTY]   [EMPTY]         ← indices 24, 25, 26, 27
 *   Row 7: [BotElev 0][BotElev 1][BotElev 2][Stairs]     ← indices 28, 29, 30, 31
 *
 * Rock border tiles use cardinal directions to name their border edges:
 *   N=North(top)  E=East(right)  S=South(bottom)  W=West(left)
 *   e.g. tile 0 = "R NW" has borders on North and West sides.
 *
 * Rendering order (bottom to top):
 *   1. Water    (depth -10) — background fill
 *   2. Elevation (depth -9) — cliff band (walls + stairs)
 *   3. Foam     (depth -8)  — animated shoreline ripples
 *   4. Beach + Grass (depth -7/-6) — flat ground
 *
 * The elevation tiles are only used for the cliff band: the cliff face uses
 * the wall tiles (row 3), and the climb point uses the stairs tile (31).
 */

// ── Constants ────────────────────────────────────────────────────────────────

export const TILE_W = 64;
export const TILE_H = 64;
export const COLS = 4;
export const ROWS = 8;

// Rock border tiles live in rows 0, 1, 2, 4 (indices 0-11, 16-19)
// Row 0: top-edge variants (N, NW, NE, NWE)
export const ROCK_NW_TILE     = 0;  // row 0, col 0 — borders North, West
export const ROCK_N_TILE      = 1;  // row 0, col 1 — border North
export const ROCK_NE_TILE     = 2;  // row 0, col 2 — borders North, East
export const ROCK_NWE_TILE    = 3;  // row 0, col 3 — borders North, West, East
// Row 1: mid-edge variants (W, plain, E, WE)
export const ROCK_W_TILE      = 4;  // row 1, col 0 — border West
export const ROCK_TILE        = 5;  // row 1, col 1 — no borders
export const ROCK_E_TILE      = 6;  // row 1, col 2 — border East
export const ROCK_WE_TILE     = 7;  // row 1, col 3 — borders West, East
// Row 2: bottom-edge variants (WS, S, SE, WSE)
export const ROCK_WS_TILE     = 8;  // row 2, col 0 — borders West, South
export const ROCK_S_TILE      = 9;  // row 2, col 1 — border South
export const ROCK_SE_TILE     = 10; // row 2, col 2 — borders South, East
export const ROCK_WSE_TILE    = 11; // row 2, col 3 — borders West, South, East
// Row 4: inner-corner / three-side variants (NWS, NS, NES, NWES)
export const ROCK_NWS_TILE    = 16; // row 4, col 0 — borders North, West, South
export const ROCK_NS_TILE     = 17; // row 4, col 1 — borders North, South
export const ROCK_NES_TILE    = 18; // row 4, col 2 — borders North, East, South
export const ROCK_NWES_TILE   = 19; // row 4, col 3 — borders all four sides

// Wall tiles live in row 3, columns 0-3
export const WALL_ROW = 3; // tileset row 3

// Row 7 staircases (4 tiles of 64px each): left, center, right, single. The
// left/center/right tiles share the same repeating stair motif, so they tile
// seamlessly into a wide staircase: width 2 = left+right, width 3 =
// left+center+right, width 1 = the single tile.
export const WALL_LEFT_TILE = 12; // row 3, col 0
export const WALL_CENTER_TILE = 13; // row 3, col 1
export const WALL_RIGHT_TILE = 14; // row 3, col 2
export const WALL_SINGLE_TILE = 15; // row 3, col 3
export const WALL_TILE = WALL_SINGLE_TILE;

export const STAIRS_LEFT_TILE = 28; // row 7, col 0
export const STAIRS_CENTER_TILE = 29; // row 7, col 1
export const STAIRS_RIGHT_TILE = 30; // row 7, col 2
export const STAIRS_SINGLE_TILE = 31; // row 7, col 3
export const STAIRS_TILE = STAIRS_SINGLE_TILE;

/**
 * Convert a tileset row and column to a tile index.
 */
function tileIndex(row: number, col: number): number {
  return row * COLS + col;
}

// ── Tileset data ─────────────────────────────────────────────────────────────

interface TileData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

let elevationGlyphs: TileData[] | null = null;

/**
 * Parse the elevation tileset image and extract all 32 tiles.
 *
 * The whole image is drawn onto the context once, then each 64×64 cell is
 * read back with getImageData. The caller must provide a canvas context large
 * enough to hold the full image.
 *
 * @returns the parsed tiles, or null if the image dimensions are not a whole
 *          multiple of the tile size.
 */
export function parseElevationTileset(
  imageSource: CanvasImageSource,
  ctx: CanvasRenderingContext2D,
): TileData[] | null {
  const size = imageSource as { width: number; height: number };
  const w = size.width;
  const h = size.height;
  const cols = Math.floor(w / TILE_W);
  const rows = Math.floor(h / TILE_H);
  if (cols < 1 || rows < 1 || cols * TILE_W !== w || rows * TILE_H !== h) {
    return null;
  }

  ctx.drawImage(imageSource, 0, 0);
  const tiles: TileData[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tile = ctx.getImageData(col * TILE_W, row * TILE_H, TILE_W, TILE_H);
      tiles.push({
        data: tile.data,
        width: tile.width,
        height: tile.height,
      });
    }
  }

  elevationGlyphs = tiles;
  return tiles;
}

/**
 * Check if the elevation tileset has been loaded.
 */
export function isElevationLoaded(): boolean {
  return elevationGlyphs !== null;
}

/**
 * Get a specific elevation tile by index.
 * @param index — tile index (0–31)
 * @returns the tile data, or undefined if not loaded or index out of range
 */
export function getElevationTile(index: number): TileData | undefined {
  if (!elevationGlyphs || index < 0 || index >= elevationGlyphs.length) {
    return undefined;
  }
  return elevationGlyphs[index];
}

// ── Tile index selection ─────────────────────────────────────────────────────

export type TerrainKind = 'sea' | 'coast' | 'beach' | 'grass' | 'cliff' | 'stairs';

/**
 * Find the wall run that contains column `tx` in a terrain row, and return
 * the run's start column, end column, and the zero-based column index of `tx`
 * within that run.
 *
 * A wall run is a contiguous sequence of 'cliff' tiles on the same row.
 *
 * @param terrainRow — the full terrain row (kinds for each column)
 * @param tx — column to look up
 * @returns { start, end, colInRun } or null if no cliff run contains this column
 */
export function wallRunInfo(terrainRow: TerrainKind[], tx: number): { start: number; end: number; colInRun: number } | null {
  if (terrainRow[tx] !== 'cliff') return null;
  // Walk left from tx to find the run start
  let start = tx;
  while (start > 0 && terrainRow[start - 1] === 'cliff') start--;
  // Walk right to find the run end
  let end = tx;
  while (end < terrainRow.length - 1 && terrainRow[end + 1] === 'cliff') end++;
  return { start, end, colInRun: tx - start };
}

/**
 * Select the elevation tile for a given terrain tile.
 *
 * Only the cliff band uses elevation tiles:
 * - 'cliff' tiles render the cliff face, with position-aware variants
 *   (left / center / right / single) so the wall run looks natural
 * - 'stairs' tiles render the staircase at the climb point
 * All other terrain kinds get no elevation tile (-1); they are flat.
 *
 * @param kind — terrain type
 * @param terrainRow — the full terrain row for this y position
 * @param tx — column index within the row
 * @returns the elevation tile index, or -1 if no elevation tile should be shown
 */
export function elevationTileIndex(kind: TerrainKind, terrainRow: TerrainKind[], tx: number): number {
  switch (kind) {
    case 'cliff': {
      const info = wallRunInfo(terrainRow, tx);
      if (!info) return -1;
      return wallTileIndex(info.end - info.start + 1, info.colInRun);
    }
    case 'stairs':
      return stairsTileIndex();
    default:
      return -1;
  }
}

/**
 * Get the wall tile variant for a given column position within a wall run.
 * Wall tiles are in row 3: left(0), center(1), right(2), single(3).
 *
 * For runs of width 1: single.
 * For runs of width 2: left, right.
 * For runs of width 3: left, center, right.
 * For runs of width ≥4: left, center*, right — center tiles fill the middle.
 *
 * @param runWidth — total width of the wall run
 * @param colInRun — column within the wall run, 0-based from the run's left edge
 * @returns the wall tile index
 */
export function wallTileIndex(runWidth: number, colInRun: number): number {
  if (runWidth <= 1) return WALL_SINGLE_TILE;
  if (colInRun <= 0) return WALL_LEFT_TILE;
  if (colInRun >= runWidth - 1) return WALL_RIGHT_TILE;
  return WALL_CENTER_TILE;
}

/**
 * Get the stairs tile index.
 */
export function stairsTileIndex(): number {
  return STAIRS_TILE;
}

/**
 * Pick the elevation tile for a staircase tile at a column inside its run.
 *
 * A 1-wide staircase renders with the single tile (31). Wider runs tile the
 * shared motif side by side: a 2-wide run uses left+right (28, 30) and a
 * 3-wide run uses left+center+right (28, 29, 30).
 *
 * @param runWidth — staircase width (1-3)
 * @param colInRun — column within the run, 0-based from the run's left edge
 * @returns the elevation tile index for that position
 */
export function stairsTileVariant(runWidth: number, colInRun: number): number {
  if (runWidth <= 1) return STAIRS_SINGLE_TILE;
  if (runWidth === 2) return colInRun === 0 ? STAIRS_LEFT_TILE : STAIRS_RIGHT_TILE;
  const variants = [STAIRS_LEFT_TILE, STAIRS_CENTER_TILE, STAIRS_RIGHT_TILE];
  return variants[Math.min(Math.max(colInRun, 0), variants.length - 1)];
}
