import {
  RenderGame,
  isWebGPUAvailable,
  mountUnsupportedNotice,
} from "@cjgammon/gamekit/renderer";
import { InputManager } from "@cjgammon/gamekit/input";
import { PlayScene } from "./PlayScene";

async function main() {
  const canvas = document.getElementById("view") as HTMLCanvasElement;
  if (!isWebGPUAvailable()) {
    mountUnsupportedNotice(canvas); // show a friendly message, not a blank canvas
    return;
  }

  // `fov` = world units visible across the canvas. The engine fits the backing
  // buffer to the canvas's CSS size and keeps the view constant on any display.
  const game = await RenderGame.create(canvas, { fov: 640, autoResize: true });

  // Map named actions to keys. Query them with input.isDown("up"), etc.
  const input = new InputManager({
    up: ["KeyW", "ArrowUp"],
    down: ["KeyS", "ArrowDown"],
    left: ["KeyA", "ArrowLeft"],
    right: ["KeyD", "ArrowRight"],
  });
  input.attach(window);

  game.switchScene(new PlayScene(input));
  game.start();
}

main().catch((err) => console.error(err));
