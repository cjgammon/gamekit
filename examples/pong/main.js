import { RenderGame } from "@cjgammon/gamekit/renderer";
import { InputManager } from "@cjgammon/gamekit/input";
import { Scene, Arena } from "./entities";

const CSS_W = 800;
const CSS_H = 600;
const FOV_W = 320; // world units visible across the width (zoomed-in like Mode)

class PlayState extends Scene {}

async function main() {
  const canvas = document.getElementById("view");

  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${CSS_W}px`;
  canvas.style.height = `${CSS_H}px`;
  const backingW = Math.round(CSS_W * dpr);
  const backingH = Math.round(CSS_H * dpr);
  const zoom = backingW / FOV_W;

  const game = await RenderGame.create(canvas, {
    width: backingW,
    height: backingH,
    tickRate: 60,
  });

  game.renderer.clearColor = { r: 0.05, g: 0.05, b: 0.07, a: 1 };

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

  const start = () =>
    game.switchScene(new PlayState(input, audio, font, zoom, start));
  start();
  game.start();
}

main().catch((err) => {
  console.error(err);
});
