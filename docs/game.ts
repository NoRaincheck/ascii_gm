import Phaser from 'phaser';
import {
  BUILDING_TYPES,
  type BuildingType,
  decoFrameOffset,
  flatEdgeMask,
  flatTileIndex,
  generateWorld,
  hashString,
  landTouchesWater,
  movePlayer,
  TILE,
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
  }

  // Layered tilemap, bottom to top: deep sea (water.png) → foam → elevation
  // cliff band (Tilemap_Elevation) → beach → grass. 64px tiles, one game tile
  // each, so the world grid lines up with collision/placement. The cliff band
  // shows the wall tiles (with one stairs tile at the climb point); beach and
  // grass tiles draw the flat ground. Sea/coast get no flat layer.
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
  // is centered on every land tile that touches water, so the opaque beach/grass
  // tile drawn above (depth -7/-6) hides the blob's full center and only the
  // outer foam strips show over the water as ripples. The foam is masked to the
  // sea: the shore land tiles have transparent edge speckles in their art, and
  // without the mask the blob body bleeds through them (white flecks on
  // grass/beach, including edges facing the cliff band). Start frames are
  // staggered per tile to avoid lockstep animation.
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
    // Foam sprites are 3×3 tiles (192×192) centered on the land tile. When
    // placed on edge tiles they extend 96px beyond the map boundary. The mask
    // must extend past the map edges to contain those sprite extents.
    //
    // The mask is shaped like the water tiles so foam strips only show over
    // water — not over cliff/elevation tiles or water rock sprites. Without
    // this, foam bleeds onto beach/grass edges facing cliffs and onto the
    // rock sprites themselves.
    const PADDING = TILE * 2; // 128px margin on each side covers any sprite
    const maskW = MAP_W * TILE + PADDING * 2;
    const maskH = MAP_H * TILE + PADDING * 2;
    const maskGraphics = this.make.graphics({ add: false });
    maskGraphics.fillStyle(0xffffff);
    // Draw opaque rectangles only on water tile positions (sea + coast)
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        const kind = this.world.terrain[ty][tx];
        if (kind === 'sea' || kind === 'coast') {
          maskGraphics.fillRect(
            tx * TILE - PADDING,
            ty * TILE - PADDING,
            TILE,
            TILE,
          );
        }
      }
    }
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
    let dx = 0;
    let dy = 0;
    if (this.keys.W.isDown) dy = -1;
    if (this.keys.S.isDown) dy = 1;
    if (this.keys.A.isDown) dx = -1;
    if (this.keys.D.isDown) dx = 1;

    const p = this.world.player;
    const anim = this.player.anims.getName();
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      const step = (SPEED * Math.min(delta, 50)) / 1000;
      movePlayer(this.world, dx / len, dy / len, step);
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
