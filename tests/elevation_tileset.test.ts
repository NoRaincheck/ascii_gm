import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  COLS,
  elevationTileIndex,
  ROWS,
  stairsTileIndex,
  stairsTileVariant,
  STAIRS_CENTER_TILE,
  STAIRS_LEFT_TILE,
  STAIRS_RIGHT_TILE,
  STAIRS_SINGLE_TILE,
  type TerrainKind,
  TILE_H,
  TILE_W,
  wallTileIndex,
  wallRunInfo,
  WALL_LEFT_TILE,
  WALL_CENTER_TILE,
  WALL_RIGHT_TILE,
  WALL_SINGLE_TILE,
} from '../lib/elevation_tileset.ts';

// ── Constants ────────────────────────────────────────────────────────────────

Deno.test('elevation tileset constants', () => {
  assertEquals(TILE_W, 64);
  assertEquals(TILE_H, 64);
  assertEquals(COLS, 4);
  assertEquals(ROWS, 8);
});

// ── Flat kinds get no elevation tile ─────────────────────────────────────────

Deno.test('elevationTileIndex — flat terrain kinds get no elevation tile', () => {
  const row: TerrainKind[] = ['sea', 'coast', 'beach', 'grass'];
  for (const kind of row) {
    for (let tx = 0; tx < 16; tx++) {
      assertEquals(
        elevationTileIndex(kind, row, tx),
        -1,
        `${kind} at col ${tx} should have no elevation tile`,
      );
    }
  }
});

// ── Cliff band — position-aware wall tiling ──────────────────────────────────

Deno.test('elevationTileIndex — cliff uses position-aware wall tiles', () => {
  // A cliff run spanning columns 2–5: cliff cliff cliff cliff
  const row: TerrainKind[] = new Array(8).fill('grass');
  row[2] = 'cliff';
  row[3] = 'cliff';
  row[4] = 'cliff';
  row[5] = 'cliff';

  assertEquals(elevationTileIndex('cliff', row, 2), WALL_LEFT_TILE);   // left edge
  assertEquals(elevationTileIndex('cliff', row, 3), WALL_CENTER_TILE); // center
  assertEquals(elevationTileIndex('cliff', row, 4), WALL_CENTER_TILE); // center
  assertEquals(elevationTileIndex('cliff', row, 5), WALL_RIGHT_TILE);  // right edge
});

Deno.test('elevationTileIndex — single cliff tile uses single variant', () => {
  const row: TerrainKind[] = ['grass', 'cliff', 'grass'];
  assertEquals(elevationTileIndex('cliff', row, 1), WALL_SINGLE_TILE);
});

// ── Wall run info ────────────────────────────────────────────────────────────

Deno.test('wallRunInfo — finds correct run boundaries', () => {
  const row: TerrainKind[] = ['grass', 'cliff', 'cliff', 'cliff', 'grass'];
  assertEquals(wallRunInfo(row, 0), null); // not a cliff
  assertEquals(wallRunInfo(row, 1), { start: 1, end: 3, colInRun: 0 });
  assertEquals(wallRunInfo(row, 2), { start: 1, end: 3, colInRun: 1 });
  assertEquals(wallRunInfo(row, 3), { start: 1, end: 3, colInRun: 2 });
  assertEquals(wallRunInfo(row, 4), null); // not a cliff
});

Deno.test('wallRunInfo — works with cliff at map edges', () => {
  const row: TerrainKind[] = ['cliff', 'cliff', 'grass'];
  assertEquals(wallRunInfo(row, 0), { start: 0, end: 1, colInRun: 0 });
  assertEquals(wallRunInfo(row, 1), { start: 0, end: 1, colInRun: 1 });
});

// ── Wall tile index ──────────────────────────────────────────────────────────

Deno.test('wallTileIndex — width 1 is always single', () => {
  assertEquals(wallTileIndex(1, 0), WALL_SINGLE_TILE);
});

Deno.test('wallTileIndex — width 2 is left, right', () => {
  assertEquals(wallTileIndex(2, 0), WALL_LEFT_TILE);
  assertEquals(wallTileIndex(2, 1), WALL_RIGHT_TILE);
});

Deno.test('wallTileIndex — width 3 is left, center, right', () => {
  assertEquals(wallTileIndex(3, 0), WALL_LEFT_TILE);
  assertEquals(wallTileIndex(3, 1), WALL_CENTER_TILE);
  assertEquals(wallTileIndex(3, 2), WALL_RIGHT_TILE);
});

Deno.test('wallTileIndex — width 4+ is left, center*, right', () => {
  assertEquals(wallTileIndex(4, 0), WALL_LEFT_TILE);
  assertEquals(wallTileIndex(4, 1), WALL_CENTER_TILE);
  assertEquals(wallTileIndex(4, 2), WALL_CENTER_TILE);
  assertEquals(wallTileIndex(4, 3), WALL_RIGHT_TILE);
});

Deno.test('wallTileIndex — width 5 is left, center*, right', () => {
  assertEquals(wallTileIndex(5, 0), WALL_LEFT_TILE);
  assertEquals(wallTileIndex(5, 1), WALL_CENTER_TILE);
  assertEquals(wallTileIndex(5, 2), WALL_CENTER_TILE);
  assertEquals(wallTileIndex(5, 3), WALL_CENTER_TILE);
  assertEquals(wallTileIndex(5, 4), WALL_RIGHT_TILE);
});

// ── Stairs ───────────────────────────────────────────────────────────────────

Deno.test('elevationTileIndex — stairs uses the stairs tile', () => {
  const row: TerrainKind[] = new Array(16).fill('stairs');
  for (let tx = 0; tx < 16; tx++) {
    assertEquals(elevationTileIndex('stairs', row, tx), 31);
  }
});

Deno.test('stairsTileIndex — stairs are the last tile', () => {
  assertEquals(stairsTileIndex(), 31);
});

Deno.test('stairsTileVariant — single tile for a 1-wide run', () => {
  assertEquals(stairsTileVariant(1, 0), STAIRS_SINGLE_TILE);
});

Deno.test('stairsTileVariant — 2-wide run uses left + right', () => {
  assertEquals(stairsTileVariant(2, 0), STAIRS_LEFT_TILE);
  assertEquals(stairsTileVariant(2, 1), STAIRS_RIGHT_TILE);
});

Deno.test('stairsTileVariant — 3-wide run uses left + center + right', () => {
  assertEquals(stairsTileVariant(3, 0), STAIRS_LEFT_TILE);
  assertEquals(stairsTileVariant(3, 1), STAIRS_CENTER_TILE);
  assertEquals(stairsTileVariant(3, 2), STAIRS_RIGHT_TILE);
});
