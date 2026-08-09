---
name: tiny-swords-game
description: Use when working with the procedural Phaser game and tiny-swords sprites in this repo — adding/editing sprites, sprite frame crops, terrain rendering, world gen, player movement/collision, no-overlap/no-clipping placement rules, or the game container styling. Covers lib/game.ts, www/game.ts (Phaser), the tiny-swords/ asset sheet, and build-time PNG copying.
---

# Tiny Swords Game & Sprites

This skill documents how the ASCII Game Master's companion game (the WASD-explorable terrain canvas under the card) is built with **Phaser 3**, and how its `tiny-swords/` sprite assets are wired in. Use it before touching game rendering, sprites, terrain, or movement.

## Architecture

- `lib/game.ts` — pure logic, no DOM/Deno deps: `TILE`, `hashString` (card text → seed), `createRng` (mulberry32), `generateWorld`, `canOccupy`, `movePlayer`, sprite rect helpers (`charRect`, `treeRect`, `houseRect`), and the `World`/`Player`/`Tree`/`Building` types.
- `www/game.ts` — Phaser renderer: a `GameScene` (key `'game'`) loads the 3 PNGs as spritesheets/image, `Game` wraps `Phaser.Game` (1024×1024, grass bg), WASD grid movement with a 120ms tween, sprite flip on left movement. `window.__game` is exposed for debugging.
- `www/app.js` — calls `initGame(gameContainer, ...)` on load and `game.regenerate(hashString(currentCard))` in `newCard()` so each card seeds a fresh world.
- `scripts/build.ts` — esbuild-bundles `www/app.js` → `docs/app.js` and copies assets into `docs/`. Tiny-swords PNGs are copied via the `gameAssets` map to short names (`warrior_blue.png`, `house_blue.png`, `tree.png`).
- `www/index.html` — `<div id="game-container">` holds the Phaser canvas below the card. `www/style.css` styles `#game-container canvas` (pixelated, max-width 640px).

## Ground rules

- Keep the single-card invariant (AGENTS.md): the card and the game are separate; the game canvas never accumulates cards.
- Keep pure logic in `lib/game.ts` and Phaser/canvas code in `www/game.ts`.
- Tile grid is **64×64 px** (`TILE = 64`); world is 16×16 tiles by default (1024×1024 canvas).
- When a card is regenerated, always re-seed the game from the card text via `hashString` — never a fixed seed.
- **No water** in the current world: terrain is a single grass background (`#85b156`). Water was intentionally removed.
- Movement is **grid-only** (tile to tile, one keypress per tile). Collision is **pixel-rect** based, not tile-based.

## Collision model (pixel rects)

Collision uses the *visible content* of each sprite (alpha-bbox measured from the source PNGs), anchored bottom-center on the grid position. All rects are defined in `lib/game.ts`:

| Sprite | Content rect (relative to tile origin) | Grid anchor |
|---|---|---|
| Warrior | `charRect(x,y)` = x: `x*64-7`, y: `y*64-83`, w 78, h 91 | bottom-center at `(x*64+32, y*64+64)` |
| Tree | `treeRect(tx,ty)` = x: `tx*64+11`, y: `ty*64-60`, w 111, h 174 | bottom-center at `(tx*64+32, ty*64+64)` |
| House | `houseRect(bx,by)` = x: `bx*64+74`, y: `by*64+88`, w 108, h 148 | bottom-center at `(bx*64+64, (by+2)*64)` |

Rules enforced by `generateWorld` and `canOccupy`:
- **No overlap**: tree/building content rects must not intersect each other, and must not intersect the character.
- **No boundary clipping**: every tree/building/character content rect must stay fully inside `[0,0]`–`[worldW*64, worldH*64]`. Since sprites are large, placement is constrained to interior tiles.
- **Character never touches**: `canOccupy(world,x,y)` returns true only if the warrior's content rect is in-bounds AND doesn't intersect any tree/house rect. `movePlayer` refuses moves to blocked tiles.
- **No trapped spawn**: `generateWorld` picks the player start with the largest connected walkable area (BFS `reachableArea`, breaks early when >60 tiles).

Sprite frame placement in Phaser uses `SPRITE_POS` offsets in `www/game.ts` (`warrior`/`tree`/`house`) computed so the frame center aligns the visible content onto its content rect. If you change content rects in `lib/game.ts`, update `SPRITE_POS` to match (center = rect origin + rect w/2, rect h/2 + frameTopOffset).

## Sprite facts (verified against the source PNGs)

All sheets are RGBA 8-bit. Loaded as Phaser spritesheets with 192×192 frames (warrior, tree) or a plain image (house).

| Asset | Source path | Source size | Frame/crop used | Content bbox (within frame) |
|---|---|---|---|---|
| Warrior | `tiny-swords/Factions/Knights/Troops/Warrior/Blue/Warrior_Blue.png` | 1152×1536 | frame 0 = `(0,0,192,192)` | `(63,45)–(141,136)` = 78×91 |
| House | `tiny-swords/Factions/Knights/Buildings/House/House_Blue.png` | 128×192 | full `(0,0,128,192)` | `(10,24)–(118,172)` = 108×148 |
| Tree | `tiny-swords/Resources/Trees/Tree.png` | 768×576 | frame 0 = `(0,0,192,192)` | `(43,4)–(154,178)` = 111×174 |

- **Warrior**: 6×8 grid of 192×192 frames. Row 0 is the idle band; frame 0 = idle. Left-facing is flipped via `sprite.setFlipX(true)`.
- **Tree**: 4 cols × 3 rows of 192×192. Frame (0,0) is a full tree; row 2 contains stumps. Phaser spritesheet frame 0.
- **House**: single 128×192 sprite; load as a plain image (not spritesheet).

## Terrain colors

The ground is a flat fill (Phaser `setBackgroundColor`), the Tiny Swords "BG color + edge pieces" approach. `Tilemap_Flat.png` contains only sparse autotile outlines, so it is not used.

- Grass: `#85b156`
- Water: `#47aba9` (currently unused — water removed)

## Working with sprites

To add or replace a sprite:

1. Locate the sheet under `tiny-swords/`.
2. Verify dimensions and pick the frame crop. If unsure, decode the PNG (RGBA, filters 0–4) and run an alpha-bbox check to find exact content bounds per frame cell before hard-coding a crop or content rect.
3. Register it in the `GameScene.preload()` (`spritesheet`/`image`) and add a `SPRITE_POS` entry in `www/game.ts`.
4. Add a `source → docs/` entry to the `gameAssets` map in `scripts/build.ts`, then re-run `deno task build`.
5. Add the matching content rect + `canOccupy` check in `lib/game.ts`.
6. Add it in the scene's `create()`.

## Verification

- `deno check lib/game.ts` (pure logic only — `www/game.ts` and `www/app.js` reference DOM/Phaser types and are not type-checked by esbuild; ignore those DOM-lib errors).
- `deno task build` then serve `docs/`; open the page, generate cards, and confirm the world regenerates per card and WASD movement is blocked by trees/buildings and map edges (no clipping).
- For world-gen sanity, run a seed loop asserting: every tree/house content rect is in-bounds, no two obstacle rects intersect, the player spawn is `canOccupy`-valid, and the reachable area (BFS) is ≥ some floor (e.g. 27) so the player is never boxed in.
- Headless check (optional): launch Chrome, confirm `#game-container canvas` is 1024×1024 and `window.__game` is non-null, then simulate keydowns and assert `world.player` changes only to `canOccupy`-valid tiles.
