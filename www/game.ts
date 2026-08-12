import Phaser from 'phaser';
import {
  BUILDING_TYPES,
  type BuildingType,
  CELL,
  decoFrameOffset,
  findPath,
  flatEdgeMask,
  flatTileIndex,
  generateWorld,
  hashString,
  landTouchesWater,
  movePlayer,
  TILE,
  terrainAt,
} from '../lib/game.ts';
import type { TerrainKind } from '../lib/game.ts';
import { elevationTileIndex, rockElevationTile, stairsTileVariant } from '../lib/elevation_tileset.ts';
import type { World } from '../lib/game.ts';

const WATER = 0x47aba9;
const MAP_W = 16;
const MAP_H = 20;
const SPEED = 200; // px per second
const ZOOM = 0.5; // zoom out to show more of the world
const WORLD_W = MAP_W * TILE; // 1024
const WORLD_H = MAP_H * TILE; // 1280

// Sprite center offsets so the visible content lands on the player's (feet)
// position and landmark tiles, matching the collision rects in lib/game.ts.
// Warrior: content (63,45)-(141,136) within the 192x192 frame has feet at y=136
// and horizontal center x=102, so the frame center must sit at (px-6, py-40).
// Buildings: each frame center is placed so the content bottom-center lands on
// the shared ground anchor (bx*64+128, by*64+236).
const SPRITE_POS = {
  warrior: { dx: -6, dy: -40 },
  tree: { dx: 64, dy: 32 },
  house: { dx: 128, dy: 160 },
  tower: { dx: 128, dy: 129 },
  castle: { dx: 128, dy: 114 },
};

let currentSeed = 0;

class GameScene extends Phaser.Scene {
  world: World;
  player: Phaser.GameObjects.Sprite;
  private keys: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private path: Array<{ px: number; py: number }> | null = null;
  private targetMarker: Phaser.GameObjects.Image | null = null;
  private markerFading = false;

  constructor() {
    super('game');
  }

  preload() {
    this.load.spritesheet('warrior', 'warrior_blue.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('tree', 'tree.png', { frameWidth: 192, frameHeight: 192 });
    for (const type of BUILDING_TYPES) {
      this.load.image(type, `${type}_blue.png`);
    }
    for (let i = 1; i <= 15; i++) {
      const n = String(i).padStart(2, '0');
      this.load.image(`deco${n}`, `deco_${n}.png`);
    }
    this.load.image('flat', 'terrain_flat.png');
    this.load.image('elevation', 'terrain_elevation.png');
    this.load.image('water', 'water.png');
    this.load.spritesheet('foam', 'foam.png', { frameWidth: 192, frameHeight: 192 });
    this.load.image('pointer_target', 'pointer_target.png');
    for (let i = 1; i <= 4; i++) {
      const n = String(i).padStart(2, '0');
      this.load.spritesheet(`rock${n}`, `Rocks_${n}.png`, { frameWidth: 128, frameHeight: 128 });
    }
  }

  create() {
    this.world = generateWorld(currentSeed, MAP_W, MAP_H);
    this.cameras.main.setBackgroundColor(WATER);

    // NOTE: no setBounds() here. At ZOOM 0.5 the camera view (2048x2048) is
    // wider than the world, so bounds clamping degenerates and shoves the
    // camera off-center. Without bounds the camera always centers on the
    // player, and beyond-map ocean renders as the background water color.

    this.buildTerrain();

    // Water foam animation: 8 frames of the 192×192 blob sheet (~10 fps).
    // Each frame is a 3×3 grid of 64px tiles. Registered before buildFoam()
    // so the shoreline sprites can play it.
    if (!this.anims.exists('foam')) {
      this.anims.create({
        key: 'foam',
        frames: this.anims.generateFrameNumbers('foam', { start: 0, end: 7 }),
        frameRate: 10,
        repeat: -1,
      });
    }
    // Water rock splash animations: 8 frames of each 128x128 rock spritesheet.
    for (let i = 1; i <= 4; i++) {
      const key = `rock${String(i).padStart(2, '0')}`;
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(key, { start: 0, end: 7 }),
          frameRate: 8,
          repeat: -1,
        });
      }
    }
    this.buildFoam();
    this.buildWaterRocks();
    this.buildDeco();

    // Tree animation: frames 0-3 (first row of the spritesheet)
    if (!this.anims.exists('tree')) {
      this.anims.create({
        key: 'tree',
        frames: this.anims.generateFrameNumbers('tree', { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1,
      });
    }
    for (const t of this.world.trees) {
      const tree = this.add.sprite(
        t.x * TILE + SPRITE_POS.tree.dx,
        t.y * TILE + SPRITE_POS.tree.dy,
        'tree',
      );
      tree.play('tree');
    }
    for (const b of this.world.buildings) {
      const pos = SPRITE_POS[b.type];
      this.add.sprite(b.x * TILE + pos.dx, b.y * TILE + pos.dy, b.type);
    }
    const p = this.world.player;
    this.player = this.add
      .sprite(p.x + SPRITE_POS.warrior.dx, p.y + SPRITE_POS.warrior.dy, 'warrior', 0)
      .setDepth(10);

    // Center camera on player
    this.cameras.main.setZoom(ZOOM);
    this.cameras.main.centerOn(p.x, p.y);

    // Row 0 = idle (6 frames), row 1 = walk/run cycle (6 frames). All rows
    // share the same feet baseline within the cell, so the sprite offset above
    // stays valid for every frame. The global animation manager survives scene
    // restarts, so guard against re-registering the same keys.
    if (!this.anims.exists('walk')) {
      this.anims.create({
        key: 'walk',
        frames: this.anims.generateFrameNumbers('warrior', { start: 6, end: 11 }),
        frameRate: 12,
        repeat: -1,
      });
    }
    if (!this.anims.exists('idle')) {
      this.anims.create({
        key: 'idle',
        frames: this.anims.generateFrameNumbers('warrior', { start: 0, end: 5 }),
        frameRate: 4,
        repeat: -1,
      });
    }

    this.keys = this.input.keyboard.addKeys('W,A,S,D') as GameScene['keys'];

    // Click-to-move: clicking a reachable land tile walks the character to it
    // via the shortest route (A* over the walk grid in lib/game.ts). Only land
    // tiles are targets; water, cliffs, and landmark-solid tiles are ignored.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const wx = pointer.worldX;
      const wy = pointer.worldY;
      const tx = Math.floor(wx / TILE);
      const ty = Math.floor(wy / TILE);
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return;
      const kind = terrainAt(this.world, tx, ty);
      if (kind !== 'grass' && kind !== 'beach' && kind !== 'rock' && kind !== 'stairs') return;
      const p = this.world.player;
      // Snap the target to a sub-grid cell (CELL px) so the destination can be
      // any point inside a tile, not just its center.
      const ex = Math.floor(wx / CELL) * CELL + CELL / 2;
      const ey = Math.floor(wy / CELL) * CELL + CELL / 2;
      if (Math.hypot(ex - p.x, ey - p.y) < 4) return;
      const path = findPath(this.world, p.x, p.y, ex, ey);
      if (!path || path.length === 0) return;
      this.path = path;
      // Marker sits on the actual destination cell (the last waypoint), which
      // may differ from the raw click point (e.g. a far edge or blocked cell).
      const last = path[path.length - 1];
      this.placeMarker(last.px, last.py);
    });
  }

  // Destination marker: a pulsing pointer over the clicked tile. It pulses in
  // and out at the destination while the unit travels, fades out once the unit
  // is within 2 squares, and is destroyed on arrival / WASD cancel / re-click.
  private placeMarker(x: number, y: number) {
    this.clearMarker();
    const marker = this.add.image(x, y, 'pointer_target');
    marker.setDepth(12);
    marker.setScale(0.9);
    this.tweens.add({
      targets: marker,
      scale: { from: 0.85, to: 1.0 },
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.targetMarker = marker;
    this.markerFading = false;
  }

  // Total distance still left to walk: from the current feet position through
  // every remaining waypoint to the destination marker. Path waypoints are
  // cell centers, so this is the true remaining route length (walls included).
  private remainingPathLength(px: number, py: number): number {
    let total = 0;
    let cx = px;
    let cy = py;
    for (const wp of this.path) {
      total += Math.hypot(wp.px - cx, wp.py - cy);
      cx = wp.px;
      cy = wp.py;
    }
    if (this.targetMarker) {
      total += Math.hypot(this.targetMarker.x - cx, this.targetMarker.y - cy);
    }
    return total;
  }

  private clearMarker() {
    if (this.targetMarker) {
      this.targetMarker.destroy();
      this.targetMarker = null;
    }
    this.markerFading = false;
  }

  // Layered tilemap, bottom to top: deep sea (water.png) → foam → rocks/elevation
  // → grass → beach. 64px tiles, one game tile each, so the world grid lines up
  // with collision/placement. The cliff band shows the wall tiles (with one stairs
  // tile at the climb point); beach and grass tiles draw the flat ground.
  // Sea/coast get no flat layer. Foam is below all land tiles so the land
  // tiles naturally occlude the foam blob center; only the foam strips at tile
  // edges show over water as ripples. No masking needed.
  private buildTerrain() {
    const map = this.make.tilemap({ width: MAP_W, height: MAP_H, tileWidth: TILE, tileHeight: TILE });
    const waterTiles = map.addTilesetImage('water', 'water')!;
    const elevationTiles = map.addTilesetImage('elevation', 'elevation')!;
    const flatTiles = map.addTilesetImage('flat', 'flat')!;
    map.createBlankLayer('water', waterTiles)!.fill(0).setDepth(-10);
    const elevationLayer = map.createBlankLayer('elevation', elevationTiles)!.setDepth(-9);
    const beachLayer = map.createBlankLayer('beach', flatTiles)!.setDepth(-7);
    const grassLayer = map.createBlankLayer('grass', flatTiles)!.setDepth(-6);
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        const kind = this.world.terrain[ty][tx];
        if (kind === 'cliff') {
          elevationLayer.putTileAt(elevationTileIndex(kind, this.world.terrain[ty], tx), tx, ty);
        } else if (kind === 'stairs') {
          // Wide staircases tile the left/center/right motif; the single tile
          // is used when a stairs tile isn't part of a wider run.
          const run = this.world.stairs.find((s) => s.row === ty && tx >= s.start && tx < s.start + s.width);
          const tile = run ? stairsTileVariant(run.width, tx - run.start) : elevationTileIndex(kind, this.world.terrain[ty], tx);
          elevationLayer.putTileAt(tile, tx, ty);
        } else if (kind === 'rock') {
          // Rock plateau uses elevation tiles (rock border autotiling).
          elevationLayer.putTileAt(rockElevationTile(this.world, tx, ty), tx, ty);
        } else if (kind === 'beach' || kind === 'grass') {
          const layer = kind === 'beach' ? beachLayer : grassLayer;
          layer.putTileAt(flatTileIndex(kind, flatEdgeMask(this.world, tx, ty, kind)), tx, ty);
        }
      }
    }
  }

  // Animated foam ripples along the coast. Each frame is a 3×3 grid of 64px
  // tiles (192×192 total). The blob is centered on the frame with foam strips
  // extending into the 4 orthogonal neighbor tiles (corners are empty). A sprite
  // is centered on every land tile that touches water. The opaque beach/grass
  // tile drawn above (depth -7/-6) hides the blob's full center, and the foam
  // is masked to the water so only the outer strips show over sea/coast as
  // ripples — without the mask the blob body bleeds through the transparent
  // edge speckles of shore tiles (white flecks on grass/beach/rock) and over
  // the cliff band. The mask covers in-map sea/coast tiles plus a one-tile
  // off-map border: the strips of edge land tiles ripple out over the ocean
  // beyond the map bounds (e.g. the south strips of the bottom beach tiles).
  // Start frames are staggered per tile to avoid lockstep animation.
  private buildFoam() {
    const foamSprites: Phaser.GameObjects.Sprite[] = [];
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        if (!landTouchesWater(this.world, tx, ty)) continue;
        const sprite = this.add.sprite(tx * TILE + TILE / 2, ty * TILE + TILE / 2, 'foam');
        sprite.setDepth(-8);
        foamSprites.push(sprite);
      }
    }
    const maskGraphics = this.make.graphics({ add: false });
    maskGraphics.fillStyle(0xffffff);
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        const kind = this.world.terrain[ty][tx];
        if (kind === 'sea' || kind === 'coast') {
          maskGraphics.fillRect(tx * TILE, ty * TILE, TILE, TILE);
        }
      }
    }
    // The foam blob of an edge land tile extends one tile past the map (e.g.
    // the south strips of the bottom beach tiles ripple over the off-map
    // ocean). Mask those border strips too, or the foam never shows there.
    const pad = TILE;
    maskGraphics.fillRect(-pad, -pad, MAP_W * TILE + 2 * pad, pad); // top
    maskGraphics.fillRect(-pad, MAP_H * TILE, MAP_W * TILE + 2 * pad, pad); // bottom
    maskGraphics.fillRect(-pad, 0, pad, MAP_H * TILE); // left
    maskGraphics.fillRect(MAP_W * TILE, 0, pad, MAP_H * TILE); // right
    const mask = maskGraphics.createGeometryMask();
    foamSprites.forEach((sprite) => sprite.setMask(mask));
    foamSprites.forEach((sprite, i) => {
      sprite.play({ key: 'foam', startFrame: (i * 3) % 8 });
    });
  }

  // Animated water rocks on sea/coast tiles. Each 128×128 frame is a rock with
  // water splash; 4 variants (Rocks_01-04) each have 8 animation frames. Placed
  // during world generation with staggered start frames so they splash independently.
  private buildWaterRocks() {
    for (const rock of this.world.waterRocks) {
      const key = `rock${String(rock.variant).padStart(2, '0')}`;
      const sprite = this.add.sprite(
        rock.x * TILE + TILE / 2,
        rock.y * TILE + TILE / 2,
        key,
      );
      sprite.setDepth(-9);
      sprite.play({ key, startFrame: rock.frameOffset });
    }
  }

  // Grass decorations: pure overlay sprites, no collision. Drawn just above the
  // grass layer but below trees/buildings/player.
  private buildDeco() {
    for (const d of this.world.deco) {
      const off = decoFrameOffset(d.variant);
      const key = `deco${String(d.variant).padStart(2, '0')}`;
      this.add.sprite(d.x * TILE + off.dx, d.y * TILE + off.dy, key).setDepth(-5);
    }
  }

  update(time: number, delta: number) {
    const p = this.world.player;
    let dx = 0;
    let dy = 0;
    if (this.keys.W.isDown) dy = -1;
    if (this.keys.S.isDown) dy = 1;
    if (this.keys.A.isDown) dx = -1;
    if (this.keys.D.isDown) dx = 1;

    const keyMoving = dx !== 0 || dy !== 0;
    let moving = keyMoving;
    if (keyMoving) {
      // Manual WASD takes over and cancels any click-path in progress.
      this.path = null;
      this.clearMarker();
      const len = Math.hypot(dx, dy);
      const step = (SPEED * Math.min(delta, 50)) / 1000;
      movePlayer(this.world, dx / len, dy / len, step);
    } else if (this.path && this.path.length > 0) {
      // Fade out the marker once the unit has < 2 squares of path remaining.
      // Measured along the route (not as the crow flies) so detours around
      // walls/cliffs don't trigger an early or late fade.
      if (this.targetMarker && !this.markerFading) {
        const remaining = this.remainingPathLength(p.x, p.y);
        if (remaining < 2 * TILE) {
          this.markerFading = true;
          this.tweens.add({
            targets: this.targetMarker,
            alpha: 0,
            duration: 300,
            ease: 'Sine.In',
          });
        }
      }
      // Follow the waypoint path at the walk speed. Each waypoint is an open
      // cell center. When one is reached we snap onto it and advance.
      const step = (SPEED * Math.min(delta, 50)) / 1000;
      let guard = 0;
      while (this.path.length > 0 && guard++ < 64) {
        const wp = this.path[0];
        const ex = wp.px - p.x;
        const ey = wp.py - p.y;
        const dist = Math.hypot(ex, ey);
        if (dist <= 0.5) {
          // Snapped exactly onto the waypoint center (guaranteed open) so the
          // next leg starts clean — prevents float drift from wedging the body
          // against narrow gaps like stair runs.
          p.x = wp.px;
          p.y = wp.py;
          this.path.shift();
          moving = true;
          continue;
        }
        const ok = movePlayer(this.world, ex / dist, ey / dist, Math.min(step, dist));
        moving = true;
        const done = Math.hypot(wp.px - p.x, wp.py - p.y);
        if (done <= 4) {
          // Reached (or essentially reached) this waypoint — snap and advance.
          p.x = wp.px;
          p.y = wp.py;
          this.path.shift();
          continue;
        }
        if (!ok && dist < 16) {
          // Collision-stopped right beside the waypoint; skip it to keep
          // hugging the path rather than stalling forever.
          this.path.shift();
          continue;
        }
        if (!ok) {
          // Blocked far from the waypoint — abandon rather than stall.
          this.path = null;
          this.clearMarker();
          break;
        }
        break;
      }
      if (this.path && this.path.length === 0) {
        this.path = null;
        this.clearMarker();
      }
    }

    const anim = this.player.anims.getName();
    if (moving) {
      if (p.facing === 'left') this.player.setFlipX(true);
      else if (p.facing === 'right') this.player.setFlipX(false);
      if (anim !== 'walk') this.player.anims.play('walk');
    } else if (anim !== 'idle') {
      this.player.anims.play('idle');
    }

    this.player.x = p.x + SPRITE_POS.warrior.dx;
    this.player.y = p.y + SPRITE_POS.warrior.dy;

    // Keep camera centered on player
    this.cameras.main.centerOn(p.x, p.y);
  }
}

export class Game {
  private phaser: Phaser.Game;
  private container: HTMLElement;
  private currentCardWidth = WORLD_W;
  private currentCardHeight = WORLD_H;

  constructor(container: HTMLElement, seed: number) {
    this.container = container;
    currentSeed = seed;
    this.phaser = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: WORLD_W,
      height: WORLD_H,
      backgroundColor: '#47aba9',
      scene: GameScene,
    });
  }

  get world(): World {
    const scene = this.phaser.scene.getScene('game') as GameScene | null;
    return scene ? scene.world : null;
  }

  // Direct movement hook for tests/debugging; mirrors the key-driven path.
  move(dx: number, dy: number, step: number): boolean {
    const scene = this.phaser.scene.getScene('game') as GameScene | null;
    if (!scene) return false;
    const moved = movePlayer(scene.world, dx, dy, step);
    const p = scene.world.player;
    if (p.facing === 'left') scene.player.setFlipX(true);
    else if (p.facing === 'right') scene.player.setFlipX(false);
    scene.player.x = p.x + SPRITE_POS.warrior.dx;
    scene.player.y = p.y + SPRITE_POS.warrior.dy;
    scene.cameras.main.centerOn(p.x, p.y);
    return moved;
  }

  regenerate(seed: number) {
    currentSeed = seed;
    const scene = this.phaser.scene.getScene('game') as GameScene | null;
    if (scene && scene.scene && scene.scene.restart) {
      scene.scene.restart();
    }
  }

  resize(cardWidth: number, cardHeight: number) {
    this.currentCardWidth = cardWidth;
    this.currentCardHeight = cardHeight;
    this.phaser.scale.resize(cardWidth, cardHeight);
  }
}

export function initGame(container: HTMLElement, seed: number): Game {
  return new Game(container, seed);
}

export { hashString };
