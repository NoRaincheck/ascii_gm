# Terraced Island Implementation Plan

## Terrain construction (layers)

The world is a **terraced island**: horizontal bands, from the bottom of the map up — beach, lower grass, a cliff band, then a raised grass plateau. Sea margins frame the island on the top and sides.

```
row 0-1:     sea sea sea ... sea               (top margin)
rows 2-10:   sea G G G G G G G G G G G G sea   (raised grass plateau)
row 11:      sea C C C C C C G C C C C C sea   (cliff band, stairs at 1+ runs)
rows 12-13:  sea G G G G G G G G G G G G sea   (lower grass)
rows 14-15:  sea B B B B B B B B B B B B sea   (beach, bottom)
```

- The **cliff band** is impassable (`cliff` tiles block standing) except at the **stairs** — one or more randomly-placed staircases (each 1–3 tiles wide, ≥10 columns apart, at least one always) let the plateau be reached. Staircases ideally stay away from the sea margins; a spot against the water is only used when no dry position fits.
- `buildTerraced(world, rand)` in `lib/game.ts` produces `TerrainKind` = `sea | coast | beach | grass | cliff | stairs`, and records the runs on `world.stairs`.

## Rendering order (depth)

1. **Water** — depth -10 (background fill)
2. **Elevation** — depth -9 (cliff band: wall tiles + stairs tile)
3. **Foam** — depth -8 (animated shoreline ripples, stencil-masked to the sea)
4. **Beach + Grass** — depth -7/-6 (flat ground)

Only the cliff band uses the elevation tileset: `elevationTileIndex(kind, ty, tx)` returns the wall tile for `cliff`, the stairs tile for `stairs`, and `-1` (flat) for everything else.

## Asset: Tilemap_Elevation.png

**Dimensions:** 256×512 px → 4 columns × 8 rows of 64×64 tiles (32 tiles total)

**Layout (row, column):**
```
Row 0: [Grass 0]  [Grass 1]  [Grass 2]  [Wall 0]   ← indices  0,  1,  2,  3
Row 1: [Grass 3]  [Grass 4]  [Grass 5]  [Wall 1]   ← indices  4,  5,  6,  7
Row 2: [Grass 6]  [Grass 7]  [Grass 8]  [Wall 2]   ← indices  8,  9, 10, 11
Row 3: [Grass 9]  [Grass 10] [Grass 11] [Wall 3]   ← indices 12, 13, 14, 15
Row 4: [Beach 0]  [Beach 1]  [Beach 2]  [Wall 4]   ← indices 16, 17, 18, 19
Row 5: [Beach 3]  [Beach 4]  [Beach 5]  [Wall 5]   ← indices 20, 21, 22, 23
Row 6: [EMPTY]    [EMPTY]    [EMPTY]    [EMPTY]    ← indices 24, 25, 26, 27
Row 7: [Left Stair][Center Stair][Right Stair][Single Stair] ← indices 28, 29, 30, 31
```

**Tile index groups (row-major):**
- Elevation grass: tiles 0–11 (rows 0–3, cols 0–2)
- Elevation beach: tiles 12–23 (rows 4–5, cols 0–2)
- Elevation wall:  tiles 3, 7, 11, 15, 19, 23 (col 3 of rows 0–5)
- Elevation stairs: single tile 31 (row 7, col 3); wide staircases tile the shared motif — 2-wide = left+right (28, 30), 3-wide = left+center+right (28, 29, 30)

## Implementation Steps

1. **PLAN** (this document)
2. **UPDATE SKILL** — add elevation tileset documentation
3. **Create `lib/elevation_tileset.ts`** — tileset loading, parsing, tile index mapping
4. **Implement `parseElevationTileset()`** — draw the image and extract each 64×64 tile
5. **Implement `elevationTileIndex()`** — cliff → wall tile, stairs → stairs tile, else -1
6. **Update `lib/game.ts`** — add `cliff`/`stairs` kinds and `buildTerraced()`
7. **Update `www/game.ts`** — render the elevation layer (depth -9) for the cliff band
8. **Update `scripts/build.ts`** — copy Tilemap_Elevation.png to `docs/terrain_elevation.png`
9. **Write tests** — unit tests for tile index mapping + terraced layout (run with `deno test`)
10. **Verify** — run build, check output
