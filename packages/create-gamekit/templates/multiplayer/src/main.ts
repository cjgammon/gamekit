import {
  Entity,
  Game,
  PLAYER_SPEED,
  PLAYER_SIZE,
  createEntityFactory,
} from "@cjgammon/gamekit";
import { NetScene, WebSocketTransport } from "@cjgammon/gamekit/net";
import {
  simulatePlayer,
  type InputState,
  type PredictContext,
} from "@cjgammon/gamekit";

const SERVER_URL = "ws://localhost:39400";
const W = 640;
const H = 480;

const canvas = document.getElementById("view") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

// A registry of client-side entities, keyed by the server's type tag. This game
// only spawns "player" entities; typing it with that union makes an unhandled
// server type a compile error (and an unknown tag throws at runtime).
type NetType = "player";
const factory = createEntityFactory<NetType>({
  player: () => {
    const e = new Entity();
    e.width = PLAYER_SIZE;
    e.height = PLAYER_SIZE;
    return e;
  },
});

// NetScene keeps our entities in sync with the server: remote players are
// interpolated, and OUR player is predicted from input + reconciled against the
// server's snapshots. `simulate` MUST match the server's movement exactly.
const transport = new WebSocketTransport(SERVER_URL);
const scene = new NetScene(transport, factory, {
  simulate: (entity, input, dt, c: PredictContext) =>
    simulatePlayer(entity, input as InputState, dt, {
      speed: PLAYER_SPEED,
      worldW: c.worldW,
      worldH: c.worldH,
    }),
});

// A Game runs the loop. We subclass it only to draw the scene to a 2D canvas.
// (Swap in RenderGame from "@cjgammon/gamekit/renderer" for WebGPU sprites.)
class ClientGame extends Game {
  constructor() {
    super({ width: W, height: H, tickRate: 20 });
    this.switchScene(scene);
  }
  protected override render(): void {
    ctx.clearRect(0, 0, W, H);
    for (const [id, e] of scene.client.entities) {
      ctx.fillStyle = scene.client.isLocal(id) ? "#3cf" : "#f63";
      ctx.fillRect(e.x, e.y, e.width, e.height);
    }
  }
}

new ClientGame().start();

// Send our input whenever it changes; prediction + sending happen each tick.
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
  scene.client.setLocalInput(input);
  e.preventDefault();
}
window.addEventListener("keydown", (e) => setKey(e, true));
window.addEventListener("keyup", (e) => setKey(e, false));
