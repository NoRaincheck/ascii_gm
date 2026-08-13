/**
 * Elevation tileset support for Tilemap_Elevation.png.
 *
 * 256×512 px image (4×8 grid of 64×64 tiles = 32 tiles).
 * Rendering order: water(-10) → elevation(-9) → foam(-8) → beach(-7)/grass(-6)
 */

export const TILE_W = 64;
export const TILE_H = 64;
export const COLS = 4;
export const ROWS = 8;

// Named tile constants — computed from tileset layout
// Rock tiles: rows 0,1,2,4 (indices 0-11, 16-19)
export const ROCK_NW_TILE = 0, ROCK_N_TILE = 1, ROCK_NE_TILE = 2, ROCK_NWE_TILE = 3;
export const ROCK_W_TILE = 4, ROCK_TILE = 5, ROCK_E_TILE = 6, ROCK_WE_TILE = 7;
export const ROCK_WS_TILE = 8, ROCK_S_TILE = 9, ROCK_SE_TILE = 10, ROCK_WSE_TILE = 11;
export const ROCK_NWS_TILE = 16, ROCK_NS_TILE = 17, ROCK_NES_TILE = 18, ROCK_NWES_TILE = 19;

// Wall tiles: row 3 (indices 12-15)
export const WALL_LEFT_TILE = 12, WALL_CENTER_TILE = 13, WALL_RIGHT_TILE = 14, WALL_SINGLE_TILE = 15;
export const WALL_TILE = WALL_SINGLE_TILE;

// Stairs: row 7 (indices 28-31)
export const STAIRS_LEFT_TILE = 28, STAIRS_CENTER_TILE = 29, STAIRS_RIGHT_TILE = 30, STAIRS_SINGLE_TILE = 31;
export const STAIRS_TILE = STAIRS_SINGLE_TILE;

// Shared wall/stairs tile selector: width 1→single, else left/center/right
function edgeTile(single: number, left: number, right: number, center: number,
  runWidth: number, colInRun: number): number {
  if (runWidth <= 1) return single;
  if (colInRun <= 0) return left;
  if (colInRun >= runWidth - 1) return right;
  return center;
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

export type TerrainKind = 'sea' | 'coast' | 'beach' | 'grass' | 'cliff' | 'rock' | 'stairs';

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

import type { World } from '../lib/game.ts';
import { terrainAt, EDGE_N, EDGE_S, EDGE_W, EDGE_E } from '../lib/game.ts';

/**
 * Compute the rock autotile edge mask for a rock tile.
 *
 * A border is drawn on each side where the rock meets a non-rock terrain
 * (sea, coast, cliff, stairs). The mask bits are EDGE_N/S/W/E.
 *
 * @param world — the world containing terrain data
 * @param tx — column index
 * @param ty — row index
 * @returns the edge mask
 */
export function rockEdgeMask(world: World, tx: number, ty: number): number {
  let mask = 0;
  const neighbors: Array<[number, number, number]> = [
    [0, -1, EDGE_N],
    [0, 1, EDGE_S],
    [-1, 0, EDGE_W],
    [1, 0, EDGE_E],
  ];
  for (const [dx, dy, bit] of neighbors) {
    const n = terrainAt(world, tx + dx, ty + dy);
    if (n !== 'rock') mask |= bit;
  }
  return mask;
}

/**
 * Map a rock edge mask to the elevation tileset index.
 *
 * Rock tiles live in rows 0, 1, 2, 4 of the elevation tileset:
 *   row 0 → N variants (indices 0-3)
 *   row 1 → W/E variants (indices 4-7)
 *   row 2 → S variants (indices 8-11)
 *   row 4 → inner-corner variants (indices 16-19)
 *
 * @param mask — edge mask with EDGE_N/S/W/E bits
 * @returns the elevation tile index
 */
export function rockTileIndex(mask: number): number {
  const hasN = (mask & EDGE_N) !== 0;
  const hasS = (mask & EDGE_S) !== 0;
  const hasW = (mask & EDGE_W) !== 0;
  const hasE = (mask & EDGE_E) !== 0;
  const col = hasW ? (hasE ? 3 : 0) : hasE ? 2 : 1;
  const row = hasN ? (hasS ? 3 : 0) : hasS ? 2 : 1;
  // Row 3 in the formula maps to tileset row 4 (wall tiles are row 3)
  const tileRow = row === 3 ? 4 : row;
  return tileRow * COLS + col;
}

/**
 * Select the elevation tile for a given terrain tile.
 *
 * The cliff band uses elevation tiles for the cliff face (wall tiles) and
 * staircase (stairs tile). The rock plateau uses rock border tiles for
 * autotiling. All other terrain kinds (sea, coast, beach, grass) get no
 * elevation tile (-1); they are flat.
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
    case 'rock': {
      // Rock tiles need the full world for neighbor lookups; terrainRow alone
      // is insufficient because rock may border non-rock on any side.
      // We handle this in the caller which has access to the world.
      return -1; // placeholder — caller must use rockTileIndex + rockEdgeMask
    }
    case 'stairs':
      return stairsTileIndex();
    default:
      return -1;
  }
}

/**
 * Select the elevation tile for a rock terrain tile, using the world to
 * inspect neighbors for autotiling.
 *
 * @param world — the world containing terrain data
 * @param tx — column index
 * @param ty — row index
 * @returns the elevation tile index for this rock tile
 */
export function rockElevationTile(world: World, tx: number, ty: number): number {
  const mask = rockEdgeMask(world, tx, ty);
  return rockTileIndex(mask);
}

/**
 * Get the wall tile variant for a given column position within a wall run.
 * Wall tiles are in row 3: left(0), center(1), right(2), single(3).
 *
 * For runs of width 1: single. For width ≥2: left, center*, right.
 *
 * @param runWidth — total width of the wall run
 * @param colInRun — column within the wall run, 0-based from the run's left edge
 * @returns the wall tile index
 */
export function wallTileIndex(runWidth: number, colInRun: number): number {
  return edgeTile(WALL_SINGLE_TILE, WALL_LEFT_TILE, WALL_RIGHT_TILE, WALL_CENTER_TILE, runWidth, colInRun);
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
  return edgeTile(STAIRS_SINGLE_TILE, STAIRS_LEFT_TILE, STAIRS_RIGHT_TILE, STAIRS_CENTER_TILE, runWidth, colInRun);
}
