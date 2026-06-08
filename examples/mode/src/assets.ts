// Procedural assets — every texture, the bitmap font, and all SFX are generated
// at runtime, so the project ships no binary asset files.
import type { RenderGame } from "gamekit/renderer";
import { AudioManager } from "gamekit/audio";
import { BitmapFont } from "gamekit";

export const TILE = 16;
export const FONT_W = 8;
export const FONT_H = 12;

/** Draw onto an offscreen canvas and hand back an ImageBitmap. */
async function bitmap(
  width: number,
  height: number,
  draw: (g: CanvasRenderingContext2D) => void,
): Promise<ImageBitmap> {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  draw(c.getContext("2d")!);
  return createImageBitmap(c);
}

function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
}

/** Register all textures into the game's asset loader. Returns the font. */
export async function loadAssets(game: RenderGame): Promise<BitmapFont> {
  const reg = (name: string, bmp: ImageBitmap, fw = 0, fh = 0) => {
    game.assets.register(name, game.renderer.createTextureFromImage(bmp, fw, fh));
    bmp.close();
  };

  // Player — a friendly disc with eyes.
  reg(
    "player",
    await bitmap(16, 16, (g) => {
      disc(g, 8, 8, 7, "#46c8ff");
      g.fillStyle = "#08203a";
      g.fillRect(5, 6, 2, 3);
      g.fillRect(9, 6, 2, 3);
    }),
  );

  // Enemy — an angry red disc.
  reg(
    "enemy",
    await bitmap(16, 16, (g) => {
      disc(g, 8, 8, 7, "#ff5a4a");
      g.fillStyle = "#3a0808";
      g.fillRect(4, 6, 3, 2);
      g.fillRect(9, 6, 3, 2);
    }),
  );

  // Spawner — a dark pulsing block.
  reg(
    "spawner",
    await bitmap(16, 16, (g) => {
      g.fillStyle = "#8a3df2";
      g.fillRect(0, 0, 16, 16);
      g.fillStyle = "#d8b3ff";
      g.fillRect(3, 3, 10, 10);
      g.fillStyle = "#3a1066";
      g.fillRect(6, 6, 4, 4);
    }),
  );

  // Bullet — a small bright dot.
  reg(
    "bullet",
    await bitmap(6, 6, (g) => disc(g, 3, 3, 3, "#ffe066")),
  );

  // Tileset — one wall tile with a bevel (frame 0 → tile value 1).
  reg(
    "tiles",
    await bitmap(TILE, TILE, (g) => {
      g.fillStyle = "#2c2c3a";
      g.fillRect(0, 0, TILE, TILE);
      g.fillStyle = "#3d3d52";
      g.fillRect(1, 1, TILE - 2, TILE - 2);
      g.fillStyle = "#23232f";
      g.fillRect(3, 3, TILE - 6, TILE - 6);
    }),
    TILE,
    TILE,
  );

  // Font — draw ASCII 32–126 into an 8×12 grid (16 columns).
  const COLS = 16;
  const COUNT = 95;
  const rows = Math.ceil(COUNT / COLS);
  reg(
    "font",
    await bitmap(COLS * FONT_W, rows * FONT_H, (g) => {
      g.fillStyle = "#ffffff";
      g.font = "11px monospace";
      g.textBaseline = "top";
      for (let i = 0; i < COUNT; i++) {
        const ch = String.fromCharCode(32 + i);
        const cx = (i % COLS) * FONT_W;
        const cy = Math.floor(i / COLS) * FONT_H;
        g.fillText(ch, cx + 1, cy);
      }
    }),
    FONT_W,
    FONT_H,
  );

  return new BitmapFont("font", {
    charWidth: FONT_W,
    charHeight: FONT_H,
    firstChar: 32,
    charCount: COUNT,
  });
}

// ---- Audio ----

/** Fill a mono buffer from a per-sample function of time (seconds). */
function buffer(
  ctx: AudioContext,
  seconds: number,
  sample: (t: number) => number,
): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(seconds * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = sample(i / rate);
  return buf;
}

/** Build the AudioManager and register procedural SFX. */
export function loadAudio(): AudioManager {
  const ctx = new AudioContext();
  const audio = new AudioManager(ctx);

  // Shoot — a short descending square blip.
  audio.register(
    "shoot",
    buffer(ctx, 0.09, (t) => {
      const freq = 660 - t * 2600;
      const env = Math.exp(-t * 30);
      return (Math.sign(Math.sin(2 * Math.PI * freq * t)) * 0.25) * env;
    }),
  );

  // Enemy shoot — lower, softer.
  audio.register(
    "enemyShoot",
    buffer(ctx, 0.11, (t) => {
      const freq = 300 - t * 800;
      return Math.sin(2 * Math.PI * freq * t) * 0.2 * Math.exp(-t * 22);
    }),
  );

  // Explosion — decaying noise.
  audio.register(
    "explode",
    buffer(ctx, 0.32, (t) => (Math.random() * 2 - 1) * 0.4 * Math.exp(-t * 12)),
  );

  return audio;
}
