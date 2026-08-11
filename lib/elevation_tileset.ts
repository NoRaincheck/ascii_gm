/**
 * Elevation tileset support for Tilemap_Elevation.png.
 *
 * The elevation tileset is a 256×512 px image (4×8 grid of 64×64 tiles = 32 tiles).
 *
 * Layout (row, column) — actual image tile indices:
 *   Row 0: [Grass 0] [Grass 1] [Grass 2] [Wall 0]        ← indices  0,  1,  2,  3
 *   Row 1: [Grass 3] [Grass 4] [Grass 5] [Wall 1]        ← indices  4,  5,  6,  7
 *   Row 2: [Grass 6] [Grass 7] [Grass 8] [Wall 2]        ← indices  8,  9, 10, 11
 *   Row 3: [Grass 9] [Grass 10][Grass 11][Wall 3]        ← indices 12, 13, 14, 15
 *   Row 4: [Beach 0] [Beach 1] [Beach 2] [Wall 4]        ← indices 16, 17, 18, 19
 *   Row 5: [Beach 3] [Beach 4] [Beach 5] [Wall 5]        ← indices 20, 21, 22, 23
 *   Row 6: [EMPTY]   [EMPTY]   [EMPTY]   [EMPTY]         ← indices 24, 25, 26, 27
 *   Row 7: [BotElev 0][BotElev 1][BotElev 2][Stairs]     ← indices 28, 29, 30, 31
 *
 * Rendering order (bottom to top):
 *   1. Water    (depth -10) — background fill
 *   2. Elevation (depth -9) — cliff band (walls + stairs)
 *   3. Foam     (depth -8)  — animated shoreline ripples
 *   4. Beach + Grass (depth -7/-6) — flat ground
 *
 * The elevation tiles are only used for the cliff band: the cliff face uses
 * the wall tiles (col 3), and the climb point uses the stairs tile (31).
 */

// ── Constants ────────────────────────────────────────────────────────────────

export const TILE_W = 64;
export const TILE_H = 64;
export const COLS = 4;
export const ROWS = 8;

// Wall tiles live in column 3 of rows 0-5
export const WALL_START_ROW = 0; // tileset row 0
export const WALL_END_ROW = 5; // tileset row 5

// Stairs tile: row 7, col 3
export const STAIRS_TILE = 31;

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
 * Select the elevation tile for a given terrain tile.
 *
 * Only the cliff band uses elevation tiles:
 * - 'cliff' tiles render the cliff face (wall column; the variant varies by
 *   the map row so adjacent cliffs don't all look identical)
 * - 'stairs' tiles render the staircase at the climb point
 * All other terrain kinds get no elevation tile (-1); they are flat.
 *
 * @param kind — terrain type
 * @param ty — row index (0 = top of map), picks the wall variant
 * @param tx — column index (currently unused, kept for symmetry)
 * @returns the elevation tile index, or -1 if no elevation tile should be shown
 */
export function elevationTileIndex(kind: TerrainKind, ty: number, tx: number): number {
  switch (kind) {
    case 'cliff':
      return wallTileIndex(ty % (WALL_END_ROW + 1));
    case 'stairs':
      return stairsTileIndex();
    default:
      return -1;
  }
}

/**
 * Get the wall tile index for a given tileset row.
 * Wall tiles are in column 3 of rows 0-5.
 * @param tsRow — tileset row (0-5)
 * @returns the wall tile index, or -1 if no wall tile exists for this row
 */
export function wallTileIndex(tsRow: number): number {
  if (tsRow < WALL_START_ROW || tsRow > WALL_END_ROW) return -1;
  return tileIndex(tsRow, 3);
}

/**
 * Get the stairs tile index.
 */
export function stairsTileIndex(): number {
  return STAIRS_TILE;
}
