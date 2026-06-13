import { Scene, Sprite } from "@cjgammon/gamekit";
import {
  Canvas2DGame,
  createGame,
  type AnyRenderGame,
} from "@cjgammon/gamekit/renderer";

// Logical world size; the camera frames exactly this, so bunnies bounce inside it.
const W = 800;
const H = 600;
const GRAVITY = 2000; // px/s²
const START = 1000;
const PER_FRAME = 120; // bunnies added per frame while the mouse is held
const FW = 26;
const FH = 37;
const FRAMES = 5;

// The classic PixiJS bunnymark sheet (bunnys.png, 30×203) packs 5 bunnies at
// these rects with irregular padding. gamekit uses a uniform frame grid, so we
// repack them into a clean 26×(37×5) strip in the browser — no build tooling.
const BUNNY_RECTS: ReadonlyArray<readonly [number, number]> = [
  [2, 2],
  [2, 47],
  [2, 86],
  [2, 125],
  [2, 164],
];
// Fallback colors if the sprite can't be loaded (so the demo still runs).
const PALETTE = [0xff6688, 0x66ccff, 0xffcc44, 0x88ee88, 0xcc88ff, 0xff8844];

class Bunny extends Sprite {
  constructor(textured: boolean) {
    super();
    if (textured) {
      this.setTexture("bunny", FW, FH);
      this.frame = (Math.random() * FRAMES) | 0;
    } else {
      this.textureId = ""; // built-in white texture, colored by tint
      this.width = FW;
      this.height = FH;
      this.tint = PALETTE[(Math.random() * PALETTE.length) | 0];
    }
    this.originX = 0;
    this.originY = 0;
    this.acceleration.y = GRAVITY;
    this.velocity.set(Math.random() * 300 - 150, Math.random() * 200 - 250);
  }
}

class BunnyScene extends Scene {
  readonly bunnies: Bunny[] = [];

  constructor(private readonly textured: boolean) {
    super();
  }

  override create(): void {
    this.camera.centerOn(W / 2, H / 2);
    this.spawn(START);
  }

  spawn(n: number): void {
    for (let i = 0; i < n; i++) {
      const b = new Bunny(this.textured);
      b.setPosition(Math.random() * (W - FW), 0);
      this.bunnies.push(b);
      this.add(b);
    }
  }

  override fixedUpdate(dt: number): void {
    super.fixedUpdate(dt); // integrates acceleration → velocity → position
    for (const b of this.bunnies) {
      if (b.x < 0) {
        b.x = 0;
        b.velocity.x = Math.abs(b.velocity.x);
      } else if (b.x + b.width > W) {
        b.x = W - b.width;
        b.velocity.x = -Math.abs(b.velocity.x);
      }
      if (b.y + b.height > H) {
        b.y = H - b.height;
        b.velocity.y = -Math.abs(b.velocity.y) * 0.85; // bounce, lose a little
        if (Math.random() < 0.5) b.velocity.y -= Math.random() * 380; // random kick
      } else if (b.y < 0) {
        b.y = 0;
        b.velocity.y = 0;
      }
    }
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Repack the 5 bunny rects into a uniform vertical strip and register it as the
 *  "bunny" texture on whichever backend is live. Returns false if it can't. */
async function loadBunnies(game: AnyRenderGame): Promise<boolean> {
  try {
    const img = await loadImage("bunnys.png"); // served from public/
    const sheet = document.createElement("canvas");
    sheet.width = FW;
    sheet.height = FH * BUNNY_RECTS.length;
    const sc = sheet.getContext("2d")!;
    BUNNY_RECTS.forEach(([sx, sy], i) =>
      sc.drawImage(img, sx, sy, FW, FH, 0, i * FH, FW, FH),
    );
    const bitmap = await createImageBitmap(sheet);
    // The renderer and its asset loader share a backend; narrowing keeps the
    // texture-handle types correlated.
    if (game instanceof Canvas2DGame) {
      game.assets.register("bunny", game.renderer.createTextureFromImage(bitmap, FW, FH));
    } else {
      game.assets.register("bunny", game.renderer.createTextureFromImage(bitmap, FW, FH));
    }
    bitmap.close();
    return true;
  } catch {
    return false; // not fetched / failed → colored-box fallback
  }
}

async function main() {
  const canvas = document.getElementById("view") as HTMLCanvasElement;
  const hud = document.getElementById("hud")!;

  // `?canvas` forces the Canvas2D fallback so you can compare backends; otherwise
  // createGame picks WebGPU when available, else Canvas2D.
  const force2d = new URLSearchParams(location.search).has("canvas");
  const game = force2d
    ? Canvas2DGame.create(canvas, { fov: W, tickRate: 60, autoResize: true })
    : await createGame(canvas, { fov: W, tickRate: 60, autoResize: true });

  const backend = game instanceof Canvas2DGame ? "Canvas2D" : "WebGPU";
  const textured = await loadBunnies(game);

  const scene = new BunnyScene(textured);
  game.switchScene(scene);
  game.start();

  // Add bunnies while the pointer is held down.
  let holding = false;
  canvas.addEventListener("pointerdown", () => (holding = true));
  window.addEventListener("pointerup", () => (holding = false));

  // FPS + count overlay (its own rAF — measures the real display frame rate).
  let frames = 0;
  let last = performance.now();
  let fps = 0;
  const tick = () => {
    if (holding) scene.spawn(PER_FRAME);
    frames++;
    const now = performance.now();
    if (now - last >= 500) {
      fps = Math.round((frames * 1000) / (now - last));
      frames = 0;
      last = now;
    }
    hud.innerHTML = `<b>${scene.bunnies.length}</b> bunnies · <b>${fps}</b> fps · ${backend}`;
    requestAnimationFrame(tick);
  };
  tick();
}

main().catch((err) => {
  console.error(err);
  const hud = document.getElementById("hud");
  if (hud) hud.textContent = `error: ${err.message}`;
});
