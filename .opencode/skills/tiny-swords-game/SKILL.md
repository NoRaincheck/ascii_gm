---
name: tiny-swords-game
description: Use when working with the procedural Phaser game and tiny-swords sprites in this repo — adding/editing sprites, sprite frame crops, terrain rendering, world gen, player movement/collision, no-overlap/no-clipping placement rules, lattice layout, or the game container styling. Covers lib/game.ts, www/game.ts (Phaser), the tiny-swords/ asset sheet, and build-time PNG copying.
---

# Tiny Swords Game & Sprites

This skill documents how the ASCII Game Master's companion game (the WASD-explorable terrain canvas under the card) is built with **Phaser 3**, and how its `tiny-swords/` sprite assets are wired in. Use it before touching game rendering, sprites, terrain, or movement.

## Architecture

- `lib/game.ts` — pure logic, no DOM/Deno deps: `TILE`, `hashString` (card text → seed), `createRng` (mulberry32), `generateWorld`, `canOccupyAt`, `movePlayer` (sub-step pixel movement), rect helpers, and the `World`/`Player`/`Tree`/`Building` types.
- `www/game.ts` — Phaser renderer: a `GameScene` (key `'game'`) loads the 3 PNGs as spritesheets/image, `Game` wraps `Phaser.Game` (1024×1024, grass bg). WASD is **continuous smooth movement** (`SPEED = 200` px/s) with **walk**/**idle** animations and sprite flip. `window.__game` is exposed for debugging; `game.move(dx, dy, step)` is a direct movement hook for tests.
- `www/app.js` — calls `initGame(gameContainer, ...)` on load and `game.regenerate(hashString(currentCard))` in `newCard()` so each card seeds a fresh world.
- `scripts/build.ts` — esbuild-bundles `www/app.js` → `docs/app.js` (Phaser bundled via bare `import Phaser from 'phaser'`, bypassing the `external: ['npm:*']` rule) and copies assets into `docs/`. Tiny-swords PNGs are copied via the `gameAssets` map to short names (`warrior_blue.png`, `house_blue.png`, `tree.png`).
- `www/index.html` — `<div id="game-container">` holds the Phaser canvas below the card. `www/style.css` styles `#game-container canvas` (pixelated, max-width 640px — the 1024×1024 internal canvas is displayed scaled to 640px).

## Ground rules

- Keep the single-card invariant (AGENTS.md): the card and the game are separate; the game canvas never accumulates cards.
- Keep pure logic in `lib/game.ts` and Phaser/canvas code in `www/game.ts`.
- Tile grid is **64×64 px** (`TILE = 64`); world is 16×16 tiles by default (1024×1024 canvas).
- When a card is regenerated, always re-seed the game from the card text via `hashString` — never a fixed seed.
- **No water** in the current world: terrain is a single grass background (`#85b156`). Water was intentionally removed.
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
- Player spawn picks the most open connected region (BFS on a 32px grid, `reachableAt`); then any landmark whose base isn't reachable is removed.

## Animation

- Warrior row 0 = **idle** (6 frames, subtle breathing, ~4 fps), row 1 = **walk/run cycle** (6 frames, ~12 fps). Both bands share the same feet baseline (content bottom y=135) and horizontal center (~x=101) within the 192×192 cell, so the same `SPRITE_POS` offset is valid for every frame.
- `GameScene.create()` registers `walk` (frames 6–11) and `idle` (frames 0–5) guarded by `this.anims.exists(...)` (the global animation manager survives `scene.restart()`).
- `update()` plays `walk` while WASD is held (flipping for left), `idle` otherwise. Rows 2–7 are attack/cast/hurt/death bands — not used.

## Sprite facts (verified against the source PNGs)

All sheets are RGBA 8-bit. Loaded as Phaser spritesheets with 192×192 frames (warrior, tree) or a plain image (buildings). Faithful sprite placement is computed from the measured **content bboxes** within each frame (run `scripts/bbox_probe.ts` to regenerate):

| Asset | Source path | Frame/crop | Content bbox (within frame) | Sprite center offset in scene |
|---|---|---|---|---|
| Warrior | `tiny-swords/Factions/Knights/Troops/Warrior/Blue/Warrior_Blue.png` (1152×1536, 6×8 grid) | frame 0 = `(0,0,192,192)` | `(63,45)–(141,136)` = 78×91 | `SPRITE_POS.warrior = {dx:-6, dy:-40}` (frame center = feet `+(-6,-40)`) |
| House | `tiny-swords/Factions/Knights/Buildings/House/House_Blue.png` (128×192) | full | `(10,24)–(117,171)` = 108×148 | `SPRITE_POS.house = {dx:128, dy:160}` (frame center = tile `+ (128,160)`) |
| Tower | `tiny-swords/Factions/Knights/Buildings/Tower/Tower_Blue.png` (128×256) | full | `(7,52)–(120,234)` = 114×183 | `SPRITE_POS.tower = {dx:128, dy:129}` |
| Castle | `tiny-swords/Factions/Knights/Buildings/Castle/Castle_Blue.png` (320×256) | full | `(12,45)–(307,249)` = 296×205 | `SPRITE_POS.castle = {dx:128, dy:114}` |
| Tree | `tiny-swords/Resources/Trees/Tree.png` (768×576, 4×3 grid) | frame 0 = `(0,0,192,192)` | `(43,4)–(153,177)` = 111×174 | `SPRITE_POS.tree = {dx:64, dy:32}` (frame center = tile `+ (64,32)`) |

- **Warrior**: row 0 is the idle band, row 1 the walk/run cycle; frame 0 = idle. Left-facing is `sprite.setFlipX(true)`.
- **Tree**: row 2 contains stumps; only frame 0 is used (frames 1–3 share the same baseline).
- **Buildings**: single sprites, load as images. All share the ground anchor content bottom-center `(bx*64+128, by*64+236)`; SPRITE_POS places each frame center so its content bottom-center lands there. Collision solids match the content rects (`BUILDING_SOLID`/`BUILDING_CONTENT` in `lib/game.ts`).
- Derivation example (warrior): content feet y=136 and horizontal center x=102 within the frame; to land content on the feet position, frame center must sit at `(px + (102-108), py + (136-176)) = (px-6, py-40)`.

## Terrain colors

The ground is a flat fill (Phaser `setBackgroundColor`). `Tilemap_Flat.png` contains only sparse autotile outlines, so it is not used.

- Grass: `#85b156`. Water: `#47aba9` (currently unused — water removed).

## Working with sprites

1. Locate the sheet under `tiny-swords/`.
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
