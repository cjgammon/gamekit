// mode2 loads the *original* Mode art and sound from public/data/ (fetched by
// `npm run fetch-assets`). The HUD font is still generated procedurally — the
// original used a system font, not a sheet.
//
// Original media © Adam Saltsman (Adam Atomic): https://github.com/AdamAtomic/Mode
import type { RenderGame } from "@cjgammon/gamekit/renderer";
import { AudioManager } from "@cjgammon/gamekit/audio";
import { BitmapFont } from "@cjgammon/gamekit";

export const FONT_W = 8;
export const FONT_H = 12;

// Frame sizes match the original PNG layouts:
//   spaceman 32×24 → 8×8      bullet     64×8  → 8×8     bot 16×16 → single
//   bot_bullet 20×4 → 4×4     spawner    168×24 → 24×24  dirt 128×8 → 8×8
//   gibs 30×6 → 6×6           spawner_gibs 48×12 → 12×12
const SHEETS: Array<{ name: string; url: string; frameWidth?: number; frameHeight?: number }> = [
  { name: "player", url: "/data/spaceman.png", frameWidth: 8, frameHeight: 8 },
  { name: "enemy", url: "/data/bot.png" }, // single sprite — rotated in-game
  { name: "bullet", url: "/data/bullet.png", frameWidth: 8, frameHeight: 8 },
  { name: "ebullet", url: "/data/bot_bullet.png", frameWidth: 4, frameHeight: 4 },
  { name: "spawner", url: "/data/spawner.png", frameWidth: 24, frameHeight: 24 },
  { name: "dirt", url: "/data/dirt.png", frameWidth: 8, frameHeight: 8 },
  { name: "dirt_top", url: "/data/dirt_top.png", frameWidth: 8, frameHeight: 8 },
  { name: "tech", url: "/data/tech_tiles.png", frameWidth: 8, frameHeight: 8 },
  { name: "gibs", url: "/data/gibs.png", frameWidth: 6, frameHeight: 6 },
  { name: "spawner_gibs", url: "/data/spawner_gibs.png", frameWidth: 12, frameHeight: 12 },
];

/** Load the real Mode graphics, then build the HUD font. */
export async function loadAssets(game: RenderGame): Promise<BitmapFont> {
  await game.assets.loadAll(SHEETS);
  return makeFont(game);
}

async function bitmap(canvas: HTMLCanvasElement): Promise<ImageBitmap> {
  return createImageBitmap(canvas);
}

/** Build the AudioManager and load the real Mode SFX. */
export async function loadAudio(): Promise<AudioManager> {
  const ctx = new AudioContext();
  const audio = new AudioManager(ctx);
  await audio.loadAll([
    { name: "shoot", url: "/data/shoot.mp3" },
    { name: "enemyShoot", url: "/data/enemy.mp3" },
    { name: "explode", url: "/data/asplode.mp3" },
    { name: "hurt", url: "/data/hurt.mp3" },
    { name: "jump", url: "/data/jump.mp3" },
    { name: "jam", url: "/data/jam.mp3" },
    { name: "count", url: "/data/countdown.mp3" },
    { name: "mode", url: "/data/mode.mp3" },
  ]);
  return audio;
}

// ---- Procedural HUD font (drawn with the system monospace) ----

async function makeFont(game: RenderGame): Promise<BitmapFont> {
  const COLS = 16;
  const COUNT = 95; // ASCII 32–126
  const rows = Math.ceil(COUNT / COLS);

  const canvas = document.createElement("canvas");
  canvas.width = COLS * FONT_W;
  canvas.height = rows * FONT_H;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.font = "11px monospace";
  g.textBaseline = "top";
  for (let i = 0; i < COUNT; i++) {
    const ch = String.fromCharCode(32 + i);
    g.fillText(ch, (i % COLS) * FONT_W + 1, Math.floor(i / COLS) * FONT_H);
  }

  const bmp = await bitmap(canvas);
  game.assets.register(
    "font",
    game.renderer.createTextureFromImage(bmp, FONT_W, FONT_H),
  );
  bmp.close();
  return new BitmapFont("font", {
    charWidth: FONT_W,
    charHeight: FONT_H,
    firstChar: 32,
    charCount: COUNT,
  });
}
