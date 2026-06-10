# Tutorial: a 2-player multiplayer Pong

In this tutorial you'll build a complete **two-player networked Pong** with
gamekit: two paddles, a bouncing ball, and a live score — all authoritative on a
server, with smooth play on each client.

It builds on the ideas in [`tutorial-multiplayer.md`](./tutorial-multiplayer.md)
(read that first if "snapshot", "interpolation", or "prediction" are new). Here
we go further by making a **custom game**: our own paddle entities, our own ball,
and our own synced score.

What you'll use beyond the basics:

- **`createPlayer`** — give each connection a *paddle* instead of the default
  free-moving player.
- **`game.net.spawn(...)`** — add a server-owned **ball** that isn't tied to any
  connection.
- **`game.net.setState(...)` / `client.state`** — sync the **score** (which isn't
  a position, so it doesn't travel in the normal entity snapshots).

> **Setup:** Node 18+, a browser, and:
> ```bash
> npm install @cjgammon/gamekit @cjgammon/gamekit-server
> ```

## The plan

- **First player** to connect gets the **left** paddle, second gets the
  **right**. Each moves their paddle up/down with their input.
- The **server** owns the ball: it moves, bounces off the top/bottom walls and
  the paddles, and resets to the center when it goes past a paddle (a point).
- The **score** is broadcast as game state and drawn by every client.
- Each client **predicts its own paddle** so it feels instant.

The whole game lives in shared constants both sides agree on:

```ts
// shared.ts — imported by BOTH server and client
export const WIDTH = 480;
export const HEIGHT = 320;
export const PADDLE_W = 8;
export const PADDLE_H = 56;
export const PADDLE_SPEED = 260; // px/sec
export const PADDLE_INSET = 16; // distance of each paddle from its wall

/** Move a paddle from its input. The server runs this for real; the client
 *  runs the SAME function to predict its own paddle. Keeping it shared is what
 *  keeps the two in agreement. */
export function movePaddle(
  y: number,
  input: { up: boolean; down: boolean },
  dt: number,
): number {
  const dir = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  let next = y + dir * PADDLE_SPEED * dt;
  if (next < 0) next = 0;
  if (next > HEIGHT - PADDLE_H) next = HEIGHT - PADDLE_H;
  return next;
}
```

## Step 1 — The server

The server defines three things: a **Paddle** entity (one per connection), a
**Ball** entity (spawned once), and the glue that wires them together and keeps
score.

### The paddle

A paddle is a `Controllable` entity — the server writes the player's input onto
its `input` field each tick, and the paddle moves itself with the shared
`movePaddle`:

```ts
// server.mjs
import {
  ServerGame,
  WebSocketServer,
  ServerTransport,
} from "@cjgammon/gamekit-server";
import { Entity } from "@cjgammon/gamekit";
import {
  WIDTH, HEIGHT, PADDLE_W, PADDLE_H, PADDLE_INSET, movePaddle,
} from "./shared.js";

class Paddle extends Entity {
  input = { up: false, down: false, left: false, right: false };

  constructor(side /* "left" | "right" */) {
    super();
    this.width = PADDLE_W;
    this.height = PADDLE_H;
    this.x = side === "left" ? PADDLE_INSET : WIDTH - PADDLE_INSET - PADDLE_W;
    this.y = (HEIGHT - PADDLE_H) / 2;
  }

  fixedUpdate(dt) {
    this.y = movePaddle(this.y, this.input, dt);
  }
}
```

### The ball

The ball moves, bounces, scores, and resets. It needs to see both paddles and
report points — we'll give it a reference to the game:

```ts
const BALL_SIZE = 8;

class Ball extends Entity {
  constructor(game) {
    super();
    this.game = game;
    this.width = BALL_SIZE;
    this.height = BALL_SIZE;
    this.reset(1);
  }

  reset(dir /* +1 toward right, -1 toward left */) {
    this.x = (WIDTH - BALL_SIZE) / 2;
    this.y = (HEIGHT - BALL_SIZE) / 2;
    const angle = (Math.random() * 0.6 - 0.3); // small vertical spread
    this.velocity.set(dir * 200 * Math.cos(angle), 200 * Math.sin(angle));
  }

  fixedUpdate(dt) {
    super.fixedUpdate(dt); // integrate velocity → position

    // Bounce off top/bottom.
    if (this.y < 0) { this.y = 0; this.velocity.y *= -1; }
    if (this.y > HEIGHT - BALL_SIZE) { this.y = HEIGHT - BALL_SIZE; this.velocity.y *= -1; }

    // Bounce off paddles.
    for (const p of this.game.paddles()) {
      if (this.bounds.overlaps(p.bounds)) {
        this.velocity.x = Math.abs(this.velocity.x) * (p.x < WIDTH / 2 ? 1 : -1);
        // add a little "english" based on where it hit the paddle
        const offset = (this.y + BALL_SIZE / 2) - (p.y + PADDLE_H / 2);
        this.velocity.y += offset * 4;
      }
    }

    // Score: past the left or right edge.
    if (this.x < -BALL_SIZE) { this.game.score(1); this.reset(1); }
    if (this.x > WIDTH) { this.game.score(0); this.reset(-1); }
  }
}
```

### The game

`ServerGame` takes a **`createPlayer`** factory — that's how the first connection
becomes the left paddle and the second becomes the right. We also spawn the ball
and broadcast the score with `net.setState`:

```ts
const scores = [0, 0]; // [left, right]
let leftTaken = false;

const game = new ServerGame(
  { width: WIDTH, height: HEIGHT, tickRate: 60 },
  {
    // Called once per connection. index 0 = first player, 1 = second.
    createPlayer: (info) => {
      const side = info.index === 0 ? "left" : "right";
      return new Paddle(side);
    },
  },
);

// Helpers the Ball uses (paddles are the connection entities in the scene).
game.paddles = () =>
  game.scene.root.children.filter((e) => e instanceof Paddle);
game.score = (who) => {
  scores[who]++;
  game.net.setState({ scores });
};

// Spawn the one server-owned ball.
game.net.spawn("ball", new Ball(game));
game.net.setState({ scores });

// Accept WebSocket connections (run with Node, not Bun).
const ws = new WebSocketServer();
ws.onConnection.add((conn) => game.accept(new ServerTransport(conn)));
ws.listen(39400, () => console.log("pong server on ws://localhost:39400"));
game.start();
```

That's the whole server. Run it:

```bash
node server.mjs
```

> The ball reads paddles out of the scene each tick, so it always sees whoever
> is currently connected — no special wiring when players join or leave.

## Step 2 — The client

The client connects, renders the paddles + ball + score, and sends its input.
Our entity **factory** builds a box for each synced type (`"player"` paddles and
the `"ball"`), and we predict our own paddle with the shared `movePaddle`.

```ts
// main.ts
import { Entity, Game } from "@cjgammon/gamekit";
import { NetScene, WebSocketTransport } from "@cjgammon/gamekit/net";
import {
  WIDTH, HEIGHT, PADDLE_W, PADDLE_H, movePaddle,
} from "./shared.js";

const canvas = document.getElementById("view") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

// Build a client entity for each thing the server tells us about.
function factory(type: string): Entity {
  const e = new Entity();
  if (type === "ball") { e.width = 8; e.height = 8; }
  else { e.width = PADDLE_W; e.height = PADDLE_H; }
  return e;
}

const transport = new WebSocketTransport("ws://localhost:39400");
const scene = new NetScene(transport, factory, {
  // Predict OUR paddle by running the same movement the server runs.
  // (ctx here is the prediction context: world width/height.)
  simulate: (entity, input, dt) => {
    entity.width = PADDLE_W;
    entity.height = PADDLE_H;
    entity.y = movePaddle(entity.y, input, dt);
  },
});

class PongClient extends Game {
  constructor() {
    super({ width: WIDTH, height: HEIGHT, tickRate: 60 }); // match the server
    this.switchScene(scene);
  }

  render() {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Score (synced game state).
    const state = scene.client.state as { scores: [number, number] } | undefined;
    if (state) {
      ctx.fillStyle = "#fff";
      ctx.font = "32px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${state.scores[0]}   ${state.scores[1]}`, WIDTH / 2, 40);
    }

    // Entities (paddles + ball).
    ctx.fillStyle = "#fff";
    for (const e of scene.client.entities.values()) {
      ctx.fillRect(e.x, e.y, e.width, e.height);
    }
  }
}

new PongClient().start();
```

### Sending input

Only up/down matter for a paddle. With prediction on, we set the **latest**
input and the scene sends + predicts it each tick:

```ts
const input = { up: false, down: false, left: false, right: false };
const KEYS: Record<string, "up" | "down"> = {
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
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
```

An `index.html` with a `<canvas id="view" width="480" height="320">` and a
`<script type="module" src="/main.ts">`, served with Vite (`npx vite`), and
you're done.

## Step 3 — Play

1. `node server.mjs`
2. `npx vite` (in the client folder), open the URL in **two** browser windows.
3. The first window is the left paddle, the second is the right. Move with
   **W/S** or the **arrow keys**, rally the ball, and watch the score update in
   both windows.

You now have a real, authoritative two-player game: the server simulates the
ball and scoring, both clients render the same world, each predicts its own
paddle for zero-lag control, and the score syncs to everyone.

## How the pieces map to the engine

| Pong concept | gamekit feature |
|---|---|
| A paddle per player | `createPlayer` factory on `ServerGame` |
| Server-owned ball | `game.net.spawn("ball", ball)` |
| Bouncing / scoring | the ball's `fixedUpdate` (runs on the authoritative tick) |
| Synced score | `game.net.setState(...)` → `client.state` |
| Zero-lag paddle | `NetScene`'s `simulate` (shared `movePaddle`) |
| Smooth opponent + ball | automatic snapshot interpolation |

## Going further

- **Win condition:** stop the ball and broadcast a `{ winner }` in `setState`
  when a score reaches 11; show a "Player 1 wins!" overlay on the client.
- **Determinism:** the ball uses `Math.random()` for its serve angle, which is
  fine because only the *server* runs it. If you ever predict the ball on the
  client, switch to the seeded `Rng` from `@cjgammon/gamekit` so both sides agree.
- **Spectators / >2 players:** `info.index >= 2` connections could become
  spectators (a paddle that ignores input), or a second ball.

See [`examples/netdemo/`](../examples/netdemo/) for a runnable networking
reference, and [`CLAUDE.md`](../CLAUDE.md) for the architecture.
