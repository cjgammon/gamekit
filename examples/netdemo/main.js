// Throwaway netdemo client (milestone 2a). Plain ESM importing the built dist —
// no bundler. Serve the repo root statically and open this page; see README.
import { Entity, Game } from "../../packages/gamekit/dist/index.js";
import { NetScene, WebSocketTransport } from "../../packages/gamekit/dist/net/index.js";

const WIDTH = 800;
const HEIGHT = 600;
const SERVER_URL = "ws://localhost:39400";

const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
const hud = document.getElementById("hud");

/** Server "player" → a 32×32 box (size is hardcoded client-side this milestone). */
function factory() {
  const e = new Entity();
  e.width = 32;
  e.height = 32;
  return e;
}

/** A Game that draws the netscene's entities to a 2D canvas (NOT the WebGPU renderer). */
class DemoGame extends Game {
  constructor(scene) {
    super({ width: WIDTH, height: HEIGHT });
    this.scene = scene;
    this.switchScene(scene);
  }

  render() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const client = this.scene.client;
    for (const [id, e] of client.entities) {
      ctx.fillStyle = client.isLocal(id) ? "#33ccff" : "#ff6633";
      ctx.fillRect(e.x, e.y, e.width || 32, e.height || 32);
    }
  }
}

const transport = new WebSocketTransport(SERVER_URL);
const scene = new NetScene(transport, factory);
const game = new DemoGame(scene);

transport.onOpen.add(() => (hud.textContent = "connected — arrow keys / WASD to move"));
transport.onClose.add(() => (hud.textContent = "disconnected"));

const input = { up: false, down: false, left: false, right: false };
const KEYS = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right",
};

function setKey(e, down) {
  const dir = KEYS[e.key];
  if (!dir) return;
  if (input[dir] !== down) {
    input[dir] = down;
    scene.client.sendInput(input);
  }
  e.preventDefault();
}

window.addEventListener("keydown", (e) => setKey(e, true));
window.addEventListener("keyup", (e) => setKey(e, false));

game.start();
