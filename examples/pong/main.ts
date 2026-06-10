import { Entity, Game } from "@cjgammon/gamekit";
import { NetScene, WebSocketTransport } from "@cjgammon/gamekit/net";
import type { InputState } from "@cjgammon/gamekit/net";
import {
  simulatePlayer,
  PLAYER_SPEED,
  PLAYER_SIZE,
  type PredictContext,
} from "@cjgammon/gamekit";

const SERVER_URL = "ws://localhost:39400";
const canvas = document.getElementById("view") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

// The factory builds a client-side entity for each thing the server tells us
// about. The server only spawns "player" entities in this game.
function factory(_type: string): Entity {
  const e = new Entity();
  e.width = 24;
  e.height = 24;
  return e;
}

// NetScene wires the transport + factory into a NetClient and keeps the set of
// entities in sync with the server, writing interpolated positions each frame.
const transport = new WebSocketTransport(SERVER_URL);
const scene = new NetScene(transport, factory, {
    simulate: (entity, input, dt, ctx: PredictContext) => {
    if (entity.width === 0) {
      entity.width = PLAYER_SIZE;
      entity.height = PLAYER_SIZE;
    }
    simulatePlayer(entity, input, dt, {
      speed: PLAYER_SPEED,
      worldW: ctx.worldW,
      worldH: ctx.worldH,
    });
  }
});

// A Game runs the loop. We subclass it just to draw the scene to a 2D canvas.
// (You could use RenderGame from "@cjgammon/gamekit/renderer" for WebGPU
// instead — here a 2D canvas keeps the focus on networking.)
class ClientGame extends Game {
  constructor() {
    super({ width: 640, height: 480, tickRate: 20 });
    this.switchScene(scene);
  }
  protected render(): void {
    ctx.clearRect(0, 0, 640, 480);
    for (const [id, e] of scene.client.entities) {
      // Color your own player differently from everyone else.
      ctx.fillStyle = scene.client.isLocal(id) ? "#3cf" : "#f63";
      ctx.fillRect(e.x, e.y, e.width, e.height);
    }
  }
}

new ClientGame().start();

const input: InputState = { up: false, down: false, left: false, right: false };

const KEYS: Record<string, keyof InputState> = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
};

function setKey(e: KeyboardEvent, down: boolean) {
  const dir = KEYS[e.code];
  if (!dir || input[dir] === down) return;
  input[dir] = down;
  scene.client.setLocalInput(input); // predicted + sent automatically each tick
  //scene.client.sendInput(input); // tell the server our new intent
  e.preventDefault();
}

window.addEventListener("keydown", (e) => setKey(e, true));
window.addEventListener("keyup", (e) => setKey(e, false));