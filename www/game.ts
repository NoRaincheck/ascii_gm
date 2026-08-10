import Phaser from 'phaser';
import { BUILDING_TYPES, type BuildingType, generateWorld, hashString, movePlayer, TILE } from '../lib/game.ts';
import type { World } from '../lib/game.ts';

const GRASS = 0x85b156;
const MAP_SIZE = 16;
const SPEED = 200; // px per second
const ZOOM = 0.5; // zoom out to show more of the world
const WORLD_W = MAP_SIZE * TILE; // 1024
const WORLD_H = MAP_SIZE * TILE; // 1024

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
    this.load.spritesheet('tree', 'Tree.png', { frameWidth: 192, frameHeight: 192 });
    for (const type of BUILDING_TYPES) {
      this.load.image(type, `${type}_blue.png`);
    }
  }

  create() {
    this.world = generateWorld(currentSeed, MAP_SIZE, MAP_SIZE);
    this.cameras.main.setBackgroundColor(GRASS);

    // Set world bounds to full world size
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

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
      backgroundColor: '#85b156',
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
