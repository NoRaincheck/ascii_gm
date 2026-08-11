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
  for (const kind of ['sea', 'coast', 'beach', 'grass'] as TerrainKind[]) {
    for (let ty = 0; ty < 16; ty++) {
      for (let tx = 0; tx < 16; tx++) {
        assertEquals(
          elevationTileIndex(kind, ty, tx),
          -1,
          `${kind} at (${tx},${ty}) should have no elevation tile`,
        );
      }
    }
  }
});

// ── Cliff band ───────────────────────────────────────────────────────────────

Deno.test('elevationTileIndex — cliff uses the wall column (same tile for all bands)', () => {
  const expected = wallTileIndex(0); // both cliff bands use the same wall tile
  for (let ty = 0; ty < 16; ty++) {
    const idx = elevationTileIndex('cliff', ty, 3);
    assertEquals(idx, expected, `cliff at row ${ty}: expected ${expected}, got ${idx}`);
    // Wall tiles are in column 3 of the sheet.
    assert(idx % COLS === 3, `cliff at row ${ty}: index ${idx} should be in column 3`);
  }
});

Deno.test('elevationTileIndex — stairs uses the stairs tile', () => {
  for (let ty = 0; ty < 16; ty++) {
    for (let tx = 0; tx < 16; tx++) {
      assertEquals(elevationTileIndex('stairs', ty, tx), 31);
    }
  }
});

// ── Wall and stairs helpers ──────────────────────────────────────────────────

Deno.test('wallTileIndex — walls are col 3 of rows 0-5', () => {
  const expected = [3, 7, 11, 15, 19, 23];
  for (let tsRow = 0; tsRow < 6; tsRow++) {
    assertEquals(wallTileIndex(tsRow), expected[tsRow], `wall row ${tsRow}`);
  }
});

Deno.test('wallTileIndex — returns -1 outside rows 0-5', () => {
  assertEquals(wallTileIndex(6), -1);
  assertEquals(wallTileIndex(7), -1);
  assertEquals(wallTileIndex(-1), -1);
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
