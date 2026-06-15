import { RenderGame } from "@cjgammon/gamekit/renderer";
import { InputManager } from "@cjgammon/gamekit/input";
import { loadAssets, loadAudio } from "./assets";
import { PlayState } from "./PlayState";

async function main() {
  const canvas = document.getElementById("view") as HTMLCanvasElement;
  const hud = document.getElementById("hud")!;
  if (!navigator.gpu) {
    hud.textContent = "WebGPU not available — use Chrome/Edge or Safari 18+.";
    return;
  }

  // `fov` = world units visible across the canvas width. The engine fits the
  // backing buffer to the canvas's CSS size × devicePixelRatio and sets the
  // camera zoom to match, so the field of view is constant on any display.
  const game = await RenderGame.create(
    canvas,
    { fov: 416, autoResize: true },
    { clearColor: { r: 0.05, g: 0.05, b: 0.07, a: 1 } },
  );

  const font = await loadAssets(game);
  const audio = loadAudio();
  audio.unlockOnGesture(); // browsers start audio suspended until a gesture

  const input = new InputManager({
    moveUp: ["KeyW"], moveDown: ["KeyS"], moveLeft: ["KeyA"], moveRight: ["KeyD"],
    aimUp: ["ArrowUp"], aimDown: ["ArrowDown"],
    aimLeft: ["ArrowLeft"], aimRight: ["ArrowRight"],
    restart: ["KeyR"],
  });
  input.attach(window);

  const start = () => game.switchScene(new PlayState(input, audio, font, start));
  start();
  game.start();

  hud.textContent = "WASD move · arrow keys shoot · destroy the 4 spawners";
}

main().catch((err) => {
  console.error(err);
  const hud = document.getElementById("hud");
  if (hud) hud.textContent = `error: ${err.message}`;
});
