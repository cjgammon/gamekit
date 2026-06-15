import { RenderGame } from "@cjgammon/gamekit/renderer";
import { InputManager } from "@cjgammon/gamekit/input";
import { loadAssets, loadAudio } from "./assets";
import { PlayState } from "./PlayState";

const CSS_W = 800;
const CSS_H = 600;
const FOV_W = 320; // world units visible across the width (zoomed-in like Mode)

async function main() {
  const canvas = document.getElementById("view") as HTMLCanvasElement;
  const hud = document.getElementById("hud")!;
  if (!navigator.gpu) {
    hud.textContent = "WebGPU not available — use Chrome/Edge or Safari 18+.";
    return;
  }

  // Native-res rendering: device-pixel backing buffer, displayed at CSS size,
  // camera zoom set so the field of view is constant regardless of DPR.
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${CSS_W}px`;
  canvas.style.height = `${CSS_H}px`;
  const backingW = Math.round(CSS_W * dpr);
  const backingH = Math.round(CSS_H * dpr);
  const zoom = backingW / FOV_W;

  // 60Hz fixed step: single-player (no networking), and it matches Mode's
  // ~60fps so physics integrate identically and fast bullets don't tunnel
  // through enemies (at 20Hz a 360px/s bullet jumps 18px/step, past a 16px bot).
  const game = await RenderGame.create(canvas, {
    width: backingW,
    height: backingH,
    tickRate: 60,
  });
  game.renderer.clearColor = { r: 0.05, g: 0.05, b: 0.07, a: 1 };

  let font: Awaited<ReturnType<typeof loadAssets>>;
  let audio: Awaited<ReturnType<typeof loadAudio>>;
  try {
    font = await loadAssets(game);
    audio = await loadAudio();
  } catch {
    hud.textContent =
      "Couldn't load Mode assets — run `npm run fetch-assets` in examples/mode2 first.";
    return;
  }

  // Mode controls: arrows walk + aim, X jumps, C shoots.
  const input = new InputManager({
    moveLeft: ["ArrowLeft", "KeyA"],
    moveRight: ["ArrowRight", "KeyD"],
    aimUp: ["ArrowUp", "KeyW"],
    aimDown: ["ArrowDown", "KeyS"],
    jump: ["KeyX", "Space"],
    shoot: ["KeyC"],
    restart: ["KeyR"],
  });
  input.attach(window);

  // Browsers start audio suspended until a gesture — unlock on first input.
  const unlock = () => {
    void audio.resume();
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("pointerdown", unlock);
  };
  window.addEventListener("keydown", unlock);
  window.addEventListener("pointerdown", unlock);

  const start = () =>
    game.switchScene(new PlayState(input, audio, font, zoom, start));
  start();
  game.start();

  hud.textContent =
    "← → move · ↑/↓ aim · X jump · C shoot — destroy the 8 spawners before your score drains";
}

main().catch((err) => {
  console.error(err);
  const hud = document.getElementById("hud");
  if (hud) hud.textContent = `error: ${err.message}`;
});
