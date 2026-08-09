import Phaser from 'phaser';
import { generateWorld, hashString, movePlayer, TILE } from '../lib/game.ts';
import type { World } from '../lib/game.ts';

const GRASS = 0x85b156;
const MAP_SIZE = 16;

// Sprite center offsets so the visible content of each sprite lands exactly on
// its collision rect (derived from measured content bounds in lib/game.ts).
const SPRITE_POS = {
  warrior: { dx: 26, dy: -32 },
  tree: { dx: 64, dy: 32 },
  house: { dx: 128, dy: 160 },
};

let currentSeed = 0;

class GameScene extends Phaser.Scene {
  world: World;  player: Phaser.GameObjects.Sprite;
  private keys: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private moving = false;

  constructor() {
    super('game');
  }

  preload() {
    this.load.spritesheet('warrior', 'warrior_blue.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('tree', 'tree.png', { frameWidth: 192, frameHeight: 192 });
    this.load.image('house', 'house_blue.png');
  }

  create() {
    this.world = generateWorld(currentSeed, MAP_SIZE, MAP_SIZE);
    this.cameras.main.setBackgroundColor(GRASS);

    for (const t of this.world.trees) {
      this.add.sprite(t.x * TILE + SPRITE_POS.tree.dx, t.y * TILE + SPRITE_POS.tree.dy, 'tree', 0);
    }
    for (const b of this.world.buildings) {
      this.add.sprite(b.x * TILE + SPRITE_POS.house.dx, b.y * TILE + SPRITE_POS.house.dy, 'house');
    }
    const p = this.world.player;
    this.player = this.add
      .sprite(p.x * TILE + SPRITE_POS.warrior.dx, p.y * TILE + SPRITE_POS.warrior.dy, 'warrior', 0)
      .setDepth(10);

    this.keys = this.input.keyboard.addKeys('W,A,S,D') as GameScene['keys'];
  }

  update() {
    if (this.moving) return;
    let dx = 0;
    let dy = 0;
    if (Phaser.Input.Keyboard.JustDown(this.keys.W)) dy = -1;
    else if (Phaser.Input.Keyboard.JustDown(this.keys.S)) dy = 1;
    else if (Phaser.Input.Keyboard.JustDown(this.keys.A)) dx = -1;
    else if (Phaser.Input.Keyboard.JustDown(this.keys.D)) dx = 1;
    if (dx === 0 && dy === 0) return;
    if (!movePlayer(this.world, dx, dy)) return;

    const p = this.world.player;
    if (dx < 0) this.player.setFlipX(true);
    else if (dx > 0) this.player.setFlipX(false);
    this.moving = true;
    this.tweens.add({
      targets: this.player,
      x: p.x * TILE + SPRITE_POS.warrior.dx,
      y: p.y * TILE + SPRITE_POS.warrior.dy,
      duration: 120,
      onComplete: () => {
        this.moving = false;
      },
    });
  }
}

export class Game {
  private phaser: Phaser.Game;

  constructor(container: HTMLElement, seed: number) {
    currentSeed = seed;
    this.phaser = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: MAP_SIZE * TILE,
      height: MAP_SIZE * TILE,
      backgroundColor: '#85b156',
      scene: GameScene,
    });
  }

  get world(): World {
    const scene = this.phaser.scene.getScene('game') as GameScene | null;
    return scene ? scene.world : null;
  }

  regenerate(seed: number) {
    currentSeed = seed;
    const scene = this.phaser.scene.getScene('game') as GameScene | null;
    if (scene && scene.scene && scene.scene.restart) {
      scene.scene.restart();
    }
  }
}

export function initGame(container: HTMLElement, seed: number): Game {
  return new Game(container, seed);
}

export { hashString };
