---
name: tiny-swords-game
description: Use when working with the procedural Phaser game and tiny-swords sprites in this repo — adding/editing sprites, sprite frame crops, terrain rendering, world gen, player movement/collision, no-overlap/no-clipping placement rules, lattice layout, or the game container styling. Covers lib/game.ts, www/game.ts (Phaser), the assets/ sheet, and build-time PNG copying.
---

# Tiny Swords Game & Sprites

This skill documents how the ASCII Game Master's companion game (the WASD-explorable terrain canvas under the card) is built with **Phaser 3**, and how its `assets/` sprite assets are wired in. Use it before touching game rendering, sprites, terrain, or movement.

## Architecture

- `lib/game.ts` — pure logic, no DOM/Deno deps: `TILE`, `hashString` (card text → seed), `createRng` (mulberry32), `generateWorld`, `canOccupyAt`, `movePlayer` (sub-step pixel movement), rect helpers, terrain autotile helpers (`flatEdgeMask`, `flatTileIndex`), and the `World`/`Player`/`Tree`/`Building` types.
- `www/game.ts` — Phaser renderer: a `GameScene` (key `'game'`) loads the terrain PNGs + landmarks (spritesheets/images), `Game` wraps `Phaser.Game` (MAP_W×MAP_H = 16×24 tiles, teal water bg). WASD is **continuous smooth movement** (`SPEED = 200` px/s) with **walk**/**idle** animations and sprite flip. `window.__game` is exposed for debugging; `game.move(dx, dy, step)` is a direct movement hook for tests.
- `www/app.js` — calls `initGame(gameContainer, ...)` on load and `game.regenerate(hashString(currentCard))` in `newCard()` so each card seeds a fresh world.
- `scripts/build.ts` — esbuild-bundles `www/app.js` → `docs/app.js` (Phaser bundled via bare `import Phaser from 'phaser'`, bypassing the `external: ['npm:*']` rule) and copies assets into `docs/`. Tiny-swords PNGs are copied via the `gameAssets` map to short names (`warrior_blue.png`, `house_blue.png`, `tree.png`).
- `www/index.html` — `<div id="game-container">` holds the Phaser canvas below the card. `www/style.css` styles `#game-container canvas` (pixelated, max-width 640px — the 1024×1536 internal canvas is displayed scaled to 640px).

## Ground rules

- Keep the single-card invariant (AGENTS.md): the card and the game are separate; the game canvas never accumulates cards.
- Keep pure logic in `lib/game.ts` and Phaser/canvas code in `www/game.ts`.
- Tile grid is **64×64 px** (`TILE = 64`); the game map is 16×24 tiles (`MAP_W`/`MAP_H` in `www/game.ts`, 1024×1536 px canvas); `generateWorld(seed, w, h)` accepts any size.
- When a card is regenerated, always re-seed the game from the card text via `hashString` — never a fixed seed.
- The world is an **island**: sea → coast → beach → grass (ellipse rings, `buildIsland`). Coast is rendered with the animated **water foam** overlay (see Terrain rendering).
- Movement is **sub-grid (pixel)**: continuous WASD at 200 px/s, not tile-snapped and not one-keypress-per-tile. Player position is in **pixels** (feet anchor).

## Movement & collision model

- **Player position**: `world.player.x/y` = feet anchor (bottom-center of the character body) in global pixels.
- **Character body** (`BODY` = `{x:-20, y:-36, w:40, h:36}`): a compact ground box used for obstacle collision, anchored at the feet. `CHAR_CONTENT` (full visible content, 78×91, offsets `-39,-91`) is used only for boundary checks (no part of the visible character clips the canvas edge).
- **Solid footprints** are what the character collides with, so it can stand beside/in front of (at the bottom of) each landmark. Each is anchored at the landmark's bottom-center and covers the opaque trunk/walls:
  - Tree solid: `{x:-26, y:-148, w:52, h:148}` anchored at `(tx*64+66, ty*64+114)`.
  - Building solids match each type's content rect (see `BUILDING_SOLID` in `lib/game.ts`), anchored at the shared ground point `(bx*64+128, by*64+236)`.
- `canOccupyAt(world, px, py)`: true iff `charRect` is in-bounds and the body doesn't intersect any tree/building solid.
- `movePlayer(world, dx, dy, step)`: axis-separated; splits steps into ≤8px sub-steps so solid footprints are never tunneled through at low FPS.
- The character can physically reach the bottom of every landmark: base reachability is enforced at generation (unreachable landmarks are dropped).

## Placement (grid/lattice)

- Trees and buildings are placed on a **3-tile lattice** so they line up nicely: tree slots at `(tx,ty)` with `tx,ty ∈ {2,5,8,11}`, buildings on the same pattern (2×3 footprint).
- Placement uses the **full sprite content rects** so nothing overlaps or clips:
  - Tree content: `x: tx*64+11, y: ty*64-60, w:111, h:174`.
  - Buildings share a single ground anchor — content bottom-center at `bx*64+128, by*64+236` — so they stand on the same ground line. Each type has its own content rect:
    - House: `x: bx*64+74, y: by*64+88, w:108, h:148`.
    - Tower: `x: bx*64+71, y: by*64+53, w:114, h:183`.
    - Castle: `x: bx*64-20, y: by*64+31, w:296, h:205` (wide — blocks neighboring lattice slots).
- Player spawn picks the most open connected region (BFS on a 16px grid, `reachableAt`); then any landmark whose base isn't reachable is removed. The reach window used to keep landmarks is scale-aware: it widens with the footprint width, so a castle standing flush against a room edge can still be reached from the side.

## Animation

- Warrior row 0 = **idle** (6 frames, subtle breathing, ~4 fps), row 1 = **walk/run cycle** (6 frames, ~12 fps). Both bands share the same feet baseline (content bottom y=135) and horizontal center (~x=101) within the 192×192 cell, so the same `SPRITE_POS` offset is valid for every frame.
- `GameScene.create()` registers `walk` (frames 6–11) and `idle` (frames 0–5) guarded by `this.anims.exists(...)` (the global animation manager survives `scene.restart()`).
- `update()` plays `walk` while WASD is held (flipping for left), `idle` otherwise. Rows 2–7 are attack/cast/hurt/death bands — not used.

## Sprite facts (verified against the source PNGs)

All sheets are RGBA 8-bit. Loaded as Phaser spritesheets with 192×192 frames (warrior, tree) or a plain image (buildings). Faithful sprite placement is computed from the measured **content bboxes** within each frame (run `scripts/bbox_probe.ts` to regenerate):

| Asset | Source path | Frame/crop | Content bbox (within frame) | Sprite center offset in scene |
|---|---|---|---|---|
| Warrior | `assets/Factions/Knights/Troops/Warrior/Blue/Warrior_Blue.png` (1152×1536, 6×8 grid) | frame 0 = `(0,0,192,192)` | `(63,45)–(141,136)` = 78×91 | `SPRITE_POS.warrior = {dx:-6, dy:-40}` (frame center = feet `+(-6,-40)`) |
| House | `assets/Factions/Knights/Buildings/House/House_Blue.png` (128×192) | full | `(10,24)–(117,171)` = 108×148 | `SPRITE_POS.house = {dx:128, dy:160}` (frame center = tile `+ (128,160)`) |
| Tower | `assets/Factions/Knights/Buildings/Tower/Tower_Blue.png` (128×256) | full | `(7,52)–(120,234)` = 114×183 | `SPRITE_POS.tower = {dx:128, dy:129}` |
| Castle | `assets/Factions/Knights/Buildings/Castle/Castle_Blue.png` (320×256) | full | `(12,45)–(307,249)` = 296×205 | `SPRITE_POS.castle = {dx:128, dy:114}` |
| Tree | `assets/Resources/Trees/Tree.png` (768×576, 4×3 grid) | frame 0 = `(0,0,192,192)` | `(43,4)–(153,177)` = 111×174 | `SPRITE_POS.tree = {dx:64, dy:32}` (frame center = tile `+ (64,32)`) |
| Water foam | `assets/Terrain/Water/Foam/Foam.png` (1536×192, 8 frames) | each frame = `(n*192,0,192,192)` — a 3×3 grid of 64px tiles | blob centered on the frame: full center tile + thin strips on the 4 orthogonal neighbors, corners empty | centered on land tile `(tx*64+32, ty*64+32)` at depth −8 (under the land tile, ripples over water) |

- **Warrior**: row 0 is the idle band, row 1 the walk/run cycle; frame 0 = idle. Left-facing is `sprite.setFlipX(true)`.
- **Tree**: row 2 contains stumps; only frame 0 is used (frames 1–3 share the same baseline).
- **Water foam**: 8 frames of 192×192 (each a 3×3 grid of 64px tiles), animated at ~10 fps via the `foam` anim key. Sprite content is a blob centered on the frame (not corner tiles), so placement is **per land tile touching water**, not per-corner — see Terrain rendering.
- **Buildings**: single sprites, load as images. All share the ground anchor content bottom-center `(bx*64+128, by*64+236)`; SPRITE_POS places each frame center so its content bottom-center lands there. Collision solids match the content rects (`BUILDING_SOLID`/`BUILDING_CONTENT` in `lib/game.ts`).
- Derivation example (warrior): content feet y=136 and horizontal center x=102 within the frame; to land content on the feet position, frame center must sit at `(px + (102-108), py + (136-176)) = (px-6, py-40)`.

## Terrain rendering (layered tilemap + autotile)

Terrain is drawn by `GameScene.buildTerrain()` as stacked Phaser tilemap layers, one game tile each (64px) so the grid lines up with collision/placement:

| Depth | Layer | Tileset | Contents |
|---|---|---|---|
| -10 | `water` | `water.png` | full-map fill of the deep-sea tile |
| -9 | `elevation` | `Tilemap_Elevation.png` | wall bands (walls + 1–3-wide stair runs) + rock rooms (border autotile) |
| -8 | `foam` sprites | `Foam.png` | animated foam on beach tiles that touch water |
| -7 | `beach` | `Tilemap_Flat.png` (block at cols 5–8) | beach rooms |
| -6 | `grass` | `Tilemap_Flat.png` (block at cols 0–3) | grass rooms |

- The world is a **three-level palace** (`buildRooms` in `lib/game.ts`): a rock level on top, a grass courtyard in the middle, a beach shore at the bottom — always exactly these 3 levels, top→down. Each level is a horizontal run of its one terrain kind, split into 1–3 **side-by-side rooms** sharing the level's rows; `world.rooms` records every room. Rooms within a level sit flush (same kind, no wall between them). A room overlaps every room on the levels above/below it and gets a doorway into each one, so a **room joins multiple rooms up or down** (a wide single room may connect to two narrow rooms below). Each terrain kind has a **target minimal total area** (rock 18%, grass 22%, beach 26% of the usable cells — the *combined* area of that kind's rooms, min height derived from span; deeper levels get more room). The middle grass run always spans the full usable width, anchoring connectivity; rock/beach runs may pull in 0–2 columns from the sides, leaving open sea at their flanks. Between overlapping rooms of adjacent levels sits a one-row **wall band**: `cliff` except one 1–3-wide `stairs` run per overlapping pair — the "door". `TerrainKind` = `sea | coast | beach | grass | cliff | rock | stairs`. `world.stairs` records each doorway `{start, width, row}`.
- Map is **16×24 tiles** (`MAP_W`/`MAP_H` in `www/game.ts`, was 16×20); `generateWorld` stays dimension-agnostic (16×20 keeps 3 levels). Sea margins are 1 tile top/bottom/sides.
- Landmarks: **buildings** on a per-room lattice (`roomSlots`, step 2, margin 1) in `rock`+`grass` rooms, **trees** on a level-wide lattice across the grass run (step 2) kept 2 rows clear of the wall bands above/below — a tree is ~2.7 tiles tall, so this is what keeps its full content on grass and its solid out of the doorway corridors — plus **deco**/water rocks. All gated by `inBounds`, `contentOverlaps`, `rectOnBuildingSite`/`rectOnGrass`, doorway-corridor pruning (`stairCorridor` / `solidBlocksDoor`: a 3-row corridor around each door, 1 row above/below the band plus 1 column each side) and the maximal-reachability (`baseReachable`) pruning. Short/narrow rooms naturally host few or no buildings (a 205px castle needs a roughly 5-tile-tall, 6-tile-wide room).
- Elevation layer: `GameScene.buildTerrain()` calls `elevationTileIndex(kind, ty, tx)` from `lib/elevation_tileset.ts` for every tile and `putTileAt`s the result at depth −9. Only the wall bands and rock rooms get elevation tiles: `cliff` → a wall tile (run-variant by position), `stairs` → the stair tile for the run position via `stairsTileVariant(run.width, colInRun)` (single 31 for 1-wide; left+right 28/30 for 2-wide; left+center+right 28/29/30 for 3-wide), `rock` → `rockElevationTile` (border autotile, plain interior); everything else is flat (-1). `Tilemap_Elevation.png` is **256×512 = 4×8 tiles of 64px**: rows 0–4 rock border tiles/autotile (indices 0–11, 16–19), row 3 walls (12–15), row 7 stair motifs — left (28), center (29), right (30), single (31).
- The wall bands are impassable — `canOccupyAt` blocks `sea`/`coast`/`cliff` — except at `stairs` tiles, so every room is reachable only through its door.
- Water foam: `GameScene.buildFoam()` places an animated `foam` sprite (192×192, a 3×3 grid of 64px tiles) centered on every **beach tile** that touches water (`terrain === 'beach' && landTouchesWater(...)`). Grass/rock rooms that hang over the sea keep clean cliff lips instead of growing shoreline ripples. The foam blob is centered under the opaque land tile (depth −8, below beach −7), so the full foam center is hidden and only the outer foam strips show as ripples over the adjacent water. The foam sprites are masked with a stencil mask (`createGeometryMask()`, graphics kept off the display list with `add: false`) to the water only — in-map `sea` tiles plus a one-tile off-map border around the whole map. Start frames are staggered (`(i * 3) % 8`) so adjacent foam isn't animated in lockstep.
- `sea`/`coast` tiles get **no flat layer** — they show the water fill + foam below.
- Camera background is `WATER` (`#47aba9`); beyond-map ocean renders as that color.

### Tilemap_Flat.png autotile convention

`Tilemap_Flat.png` is **640×256 = 10×4 tiles of 64px**. Columns 0–3 are the **grass 4×4 autotile block**, columns 5–8 the **beach 4×4 block** (columns 4 and 9 are spacers). Each block is a directional tile set where a border on an edge means that side of the terrain region is exposed:

- **Column** = the W/E border pair: col 0 = W only, col 1 = none, col 2 = E only, col 3 = W+E.
- **Row** = the N/S border pair: row 0 = N only, row 1 = none, row 2 = S only, row 3 = N+S.

So the anchor tiles are: (0,0)=N+W, (3,0)=N+W+E, (0,3)=W+N+S, (3,3)=all four.

`lib/game.ts` exposes the pure helpers:

- `flatEdgeMask(world, tx, ty, kind)` → border bits `EDGE_N|EDGE_S|EDGE_W|EDGE_E`. Grass borders on every side whose neighbor is **not grass** (beach/coast/sea); beach borders only where the neighbor is **coast or sea** (so beach never borders against grass — the grass edge already draws the boundary).
- `flatTileIndex(kind, mask)` → the 1-D index into the 10-wide sheet (`row*10 + base + col`, `base` = 0 for grass, 5 for beach). The plain interior tile is index 11 (grass) / 16 (beach).

`buildTerrain()` calls `flatTileIndex(kind, flatEdgeMask(...))` per grass/beach tile; water fills the rest. Interior grass/beach is the plain (no-border) tile; the region's rim uses the directional edge tiles.

### Terrain palette (reference)

- Grass fill: `#85b156` (sheet base `9bb94e`). Sand/beach: `f1da84`/`f8f273`. Deep water: `#47aba9`. Coast foam: `assets/Terrain/Water/Foam/Foam.png` (animated).

## Working with sprites

1. Locate the sheet under `assets/`.
2. Verify dimensions; if unsure, decode the PNG (RGBA, filters 0–4) and run an alpha-bbox check to get exact content bounds per frame cell. `scripts/bbox_probe.ts` does this for all landmarks (pure TS, no native deps).
3. Register in `GameScene.preload()` and add a `SPRITE_POS` entry in `www/game.ts` (and an animation entry if it's an animation band).
4. Add the source → `docs/` entry to `gameAssets` in `scripts/build.ts`, then `deno task build`.
5. Add matching content rect + solid footprint + `canOccupyAt`/`movePlayer` handling in `lib/game.ts`.
6. Add it in the scene's `create()`.

## Verification

- `deno check lib/game.ts` (pure logic only — `www/game.ts` and `www/app.js` reference DOM/Phaser types and are not type-checked by esbuild; ignore those DOM-lib errors).
- `deno task build` then serve `docs/`; generate cards and confirm the world regenerates per card, landmarks sit on the lattice, nothing overlaps or clips the canvas, WASD moves smoothly (sub-grid) with walk animation, and the character can reach the bottom of every tree/house while never passing through them.
- Seed-loop sanity: every content rect in-bounds, no two content rects intersect, player spawn `canOccupyAt`-valid, big `movePlayer` steps never end inside an obstacle (no tunneling), every landmark base reachable (BFS feet-distance ≤ ~25px).
- Headless note: Playwright headless can defer Phaser's RAF start at boot (page looked hidden) — emit `scene.game.events.emit('visible')` to wake it before driving input. Real browsers start normally. The canvas displays at 640px (scaled 0.625), so map screenshot coordinates must be scaled from world coords.
