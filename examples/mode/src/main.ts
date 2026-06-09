import { RenderGame } from "@cjgammon/gamekit/renderer";
import { InputManager } from "@cjgammon/gamekit/input";
import { loadAssets, loadAudio } from "./assets";
import { PlayState } from "./PlayState";

const CSS_W = 800;
const CSS_H = 600;
const FOV_W = 416; // world units visible across the width

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

  const game = await RenderGame.create(canvas, { width: backingW, height: backingH });
  game.renderer.clearColor = { r: 0.05, g: 0.05, b: 0.07, a: 1 };

  const font = await loadAssets(game);
  const audio = loadAudio();

  const input = new InputManager({
    moveUp: ["KeyW"],
    moveDown: ["KeyS"],
    moveLeft: ["KeyA"],
    moveRight: ["KeyD"],
    aimUp: ["ArrowUp"],
    aimDown: ["ArrowDown"],
    aimLeft: ["ArrowLeft"],
    aimRight: ["ArrowRight"],
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

  hud.textContent = "WASD move · arrow keys shoot · destroy the 4 spawners";
}

main().catch((err) => {
  console.error(err);
  const hud = document.getElementById("hud");
  if (hud) hud.textContent = `error: ${err.message}`;
});
