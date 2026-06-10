// client.js
import { Entity, Game } from "@cjgammon/gamekit";
import { NetScene, WebSocketTransport } from "@cjgammon/gamekit/net";
import {
  WIDTH, HEIGHT, PADDLE_W, PADDLE_H, BALL_SIZE, TICK_RATE, movePaddle,
} from "./shared.js";

const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");

// Build a client-side entity for each server entity type.
function factory(type) {
  const e = new Entity();
  if (type === "ball") { e.width = BALL_SIZE; e.height = BALL_SIZE; }
  else { e.width = PADDLE_W; e.height = PADDLE_H; }
  return e;
}

const transport = new WebSocketTransport("ws://localhost:39400");
const scene = new NetScene(transport, factory, {
  // Predict OUR paddle by running the SAME movement the server runs.
  simulate: (entity, input, dt) => {
    entity.y = movePaddle(entity.y, input, dt);
  },
});

// A Game runs the loop; we subclass it to draw the scene to the canvas.
class PongClient extends Game {
  constructor() {
    super({ width: WIDTH, height: HEIGHT, tickRate: TICK_RATE }); // match the server
    this.switchScene(scene);
  }

  render() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // The score — read from the synced game state the server broadcasts.
    const state = scene.client.state; // { scores: [left, right] } | undefined
    if (state) {
      ctx.fillStyle = "#fff";
      ctx.font = "32px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${state.scores[0]}   ${state.scores[1]}`, WIDTH / 2, 40);
    }

    // The entities — paddles and the ball.
    ctx.fillStyle = "#fff";
    for (const e of scene.client.entities.values()) {
      ctx.fillRect(e.x, e.y, e.width, e.height);
    }
  }
}

const game = new PongClient();
game.start();

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