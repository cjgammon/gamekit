// Throwaway renderdemo: validates the WebGPU renderer + camera + input +
// interpolation end-to-end. Plain ESM importing the built dist — no bundler.
// Build first (`npm run build`), serve the repo root, open this page in a
// WebGPU browser (Chrome/Edge, or Safari 18+).
import { Entity, Scene, Sprite } from "../../packages/gamekit/dist/index.js";
import { RenderGame } from "../../packages/gamekit/dist/render/index.js";
import { InputManager } from "../../packages/gamekit/dist/input/index.js";

const VIEW_W = 480;
const VIEW_H = 360;
const WORLD_W = 1280;
const WORLD_H = 960;
const SPEED = 200;

const hud = document.getElementById("hud");

/** Procedurally draw a 4-frame 32×32 walk sheet → ImageBitmap (no asset files). */
function makeSpriteSheet() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 32;
  const g = c.getContext("2d");
  for (let f = 0; f < 4; f++) {
    const ox = f * 32;
    // body
    g.fillStyle = "#ffcc44";
    g.beginPath();
    g.arc(ox + 16, 14, 10, 0, Math.PI * 2);
    g.fill();
    // eyes
    g.fillStyle = "#222";
    g.fillRect(ox + 12, 11, 3, 3);
    g.fillRect(ox + 19, 11, 3, 3);
    // legs alternate per frame for a walk cycle
    g.fillStyle = "#cc8833";
    const step = f % 2 === 0;
    g.fillRect(ox + 10, 23, 4, step ? 7 : 4);
    g.fillRect(ox + 18, 23, 4, step ? 4 : 7);
  }
  return createImageBitmap(c);
}

/** Player: reads input each fixed tick, moves via Entity motion (so render
 *  interpolation smooths it), animates while moving. */
class Player extends Sprite {
  constructor(input) {
    super(WORLD_W / 2, WORLD_H / 2);
    this.input = input;
    this.setTexture("player", 32, 32);
    this.addAnim("walk", { frames: [0, 1, 2, 3], fps: 8 });
    this.originX = 0.5;
    this.originY = 0.5;
  }

  fixedUpdate(dt) {
    const i = this.input.snapshot();
    this.velocity.x = ((i.right ? 1 : 0) - (i.left ? 1 : 0)) * SPEED;
    this.velocity.y = ((i.down ? 1 : 0) - (i.up ? 1 : 0)) * SPEED;
    super.fixedUpdate(dt); // integrate position
    // Keep inside the world.
    this.x = Math.max(0, Math.min(this.x, WORLD_W - this.width));
    this.y = Math.max(0, Math.min(this.y, WORLD_H - this.height));
  }

  update(dt) {
    if (this.velocity.x !== 0 || this.velocity.y !== 0) this.play("walk");
    else {
      this.stop();
      this.frame = 0;
    }
    super.update(dt);
  }
}

/** A scattered grid of solid blocks (plain entities → white quads) so camera
 *  motion + interpolation are obvious. */
function addBlocks(scene) {
  for (let y = 120; y < WORLD_H; y += 220) {
    for (let x = 120; x < WORLD_W; x += 240) {
      const b = new Entity(x, y);
      b.width = 48;
      b.height = 48;
      scene.add(b);
    }
  }
}

class PlayScene extends Scene {
  constructor(input) {
    super();
    this.input = input;
  }

  create() {
    addBlocks(this);
    this.player = this.add(new Player(this.input));
    this.camera.bounds = { minX: 0, minY: 0, maxX: WORLD_W, maxY: WORLD_H };
    this.camera.follow(this.player, 0.12);
    this.camera.snapToTarget();
  }

  update(dt) {
    this.input.poll(); // gamepad
    super.update(dt); // advances entities, tweens, camera follow
    this.input.update(); // roll input edges
  }
}

async function main() {
  const canvas = document.getElementById("view");
  if (!navigator.gpu) {
    hud.textContent = "WebGPU not available — try Chrome/Edge or Safari 18+.";
    return;
  }

  const game = await RenderGame.create(canvas, { width: VIEW_W, height: VIEW_H });
  game.renderer.clearColor = { r: 0.08, g: 0.08, b: 0.11, a: 1 };

  const sheet = await makeSpriteSheet();
  game.assets.register("player", game.renderer.createTextureFromImage(sheet, 32, 32));
  sheet.close();

  const input = new InputManager({
    up: ["ArrowUp", "KeyW", "PadUp"],
    down: ["ArrowDown", "KeyS", "PadDown"],
    left: ["ArrowLeft", "KeyA", "PadLeft"],
    right: ["ArrowRight", "KeyD", "PadRight"],
  });
  input.attach(window);

  game.switchScene(new PlayScene(input));
  game.start();
  hud.textContent = "WASD / arrows / gamepad to move — camera follows, blocks are static";
}

main().catch((err) => {
  console.error(err);
  hud.textContent = `error: ${err.message}`;
});
