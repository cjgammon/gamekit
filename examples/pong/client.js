// client.js — Pong client, rendered with WebGPU.
//
// The paddles and ball are plain entities, so the renderer draws them as white
// boxes (no art needed). The score is a DOM overlay, updated from the synced
// game state the server broadcasts. Networking is unchanged from a 2D-canvas
// client: a NetScene predicts our paddle and interpolates everything else.
import { Entity, createEntityFactory } from "@cjgammon/gamekit";
import { NetScene, WebSocketTransport } from "@cjgammon/gamekit/net";
import {
  RenderGame,
  isWebGPUAvailable,
  mountUnsupportedNotice,
} from "@cjgammon/gamekit/renderer";
import {
  WIDTH, HEIGHT, PADDLE_W, PADDLE_H, BALL_SIZE, TICK_RATE, movePaddle,
} from "./shared.js";

const canvas = document.getElementById("view");
const scoreEl = document.getElementById("score");

if (!isWebGPUAvailable()) {
  mountUnsupportedNotice(canvas);
} else {
  main();
}

async function main() {
  // A registry of client-side entities, keyed by the server's type tag. Throws a
  // clear error if the server ever sends a type we didn't register.
  const factory = createEntityFactory({
    player: () => {
      const e = new Entity();
      e.width = PADDLE_W;
      e.height = PADDLE_H;
      return e;
    },
    ball: () => {
      const e = new Entity();
      e.width = BALL_SIZE;
      e.height = BALL_SIZE;
      return e;
    },
  });

  // The world is [0..WIDTH] × [0..HEIGHT]; center the camera so (0,0) is the
  // top-left corner of the canvas (the camera centers on its position).
  class PongScene extends NetScene {
    create() {
      this.camera.centerOn(WIDTH / 2, HEIGHT / 2);
    }
  }

  const transport = new WebSocketTransport("ws://localhost:39400");
  const scene = new PongScene(transport, factory, {
    // Predict OUR paddle by running the SAME movement the server runs.
    simulate: (entity, input, dt) => {
      entity.y = movePaddle(entity.y, input, dt);
    },
  });

  // Update the score overlay whenever the server broadcasts new state.
  scene.client.onState.add((s) => {
    if (s && s.scores) scoreEl.textContent = `${s.scores[0]} ${s.scores[1]}`;
  });

  // fov = WIDTH world units across the canvas; tickRate matches the server.
  const game = await RenderGame.create(canvas, { fov: WIDTH, tickRate: TICK_RATE });
  game.switchScene(scene);
  game.start();

  // Send input on change; prediction + sending happen each tick.
  const input = { up: false, down: false };
  const KEYS = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down" };
  function setKey(e, down) {
    const dir = KEYS[e.code];
    if (!dir || input[dir] === down) return;
    input[dir] = down;
    scene.client.setLocalInput(input); // predicted + sent automatically
    e.preventDefault();
  }
  window.addEventListener("keydown", (e) => setKey(e, true));
  window.addEventListener("keyup", (e) => setKey(e, false));
}
