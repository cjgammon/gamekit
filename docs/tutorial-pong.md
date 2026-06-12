# Build a multiplayer Pong (from scratch)

This is a complete, from-the-ground-up tutorial: you'll build a **two-player
online Pong** with gamekit — two paddles, a bouncing ball, a live score, and
lag-free controls — starting from an empty folder. No prior gamekit knowledge is
assumed; we explain every concept as it comes up.

By the end you'll understand how gamekit does multiplayer and have a real game
you can play with a friend across the internet.

**Contents**

1. [What we're building](#1-what-were-building)
2. [How multiplayer works in gamekit](#2-how-multiplayer-works-in-gamekit)
3. [Project setup](#3-project-setup)
4. [Shared code](#4-shared-code)
5. [The server](#5-the-server)
6. [The client](#6-the-client)
7. [Run it](#7-run-it)
8. [Polish: make paddles flash on a hit](#8-polish-make-paddles-flash-on-a-hit)
9. [How it maps to the engine](#9-how-it-maps-to-the-engine)
10. [Going further](#10-going-further)

---

## 1. What we're building

A classic Pong: a paddle on the left, a paddle on the right, and a ball that
bounces between them. Two people connect from two browsers — the **first** to
join controls the left paddle, the **second** controls the right. Miss the ball
and the other player scores. Everyone sees the same game in real time.

The important part: it's **server-authoritative**. One server program is the
single source of truth for where everything is. The browsers just send "I'm
pressing up" and draw what the server tells them. This is how you keep two
players in sync and stop anyone from cheating by editing their client.

## 2. How multiplayer works in gamekit

Four ideas. Read these once and the rest of the tutorial is just typing.

**The server owns the world.** A small Node program runs the real game at a
fixed rate (we'll use 60 ticks per second). Every tick it advances everything —
paddles, ball, score — then **serializes** the world into a small message called
a **snapshot** and sends it to every connected browser.

**Clients send input, not actions.** A browser never moves anything directly. It
sends its **input** ("up is held") to the server. The server decides what that
means. The browser's only other job is to **draw** the snapshots it receives.

**Clients interpolate.** Snapshots arrive ~60 times a second with network jitter
between them. If a client drew each snapshot the instant it arrived, motion
would stutter. Instead each client renders everything **~100 ms in the past**,
smoothly blending between the two snapshots that straddle that time. Result:
buttery-smooth motion for the *other* player and the ball, even on a shaky
connection. gamekit does this for you automatically.

**Clients predict their own player.** Rendering yourself 100 ms in the past would
make your own paddle feel sluggish. So a client **predicts**: it simulates your
own paddle immediately from your input, and gently corrects when the server's
snapshot confirms the real position. The trick that makes prediction work is a
**shared movement function** that the client and server both run, so they always
agree. You'll write that function once, in shared code, and import it on both
sides.

That's the whole model: **server simulates → broadcasts snapshots → clients
interpolate others and predict themselves.**

## 3. Project setup

Make a folder and install the two gamekit packages — the engine (browser) and
the server (Node):

```bash
mkdir pong && cd pong
npm init -y
npm pkg set type=module
npm install @cjgammon/gamekit @cjgammon/gamekit-server
npm install -D vite
```

We'll create these files:

```
pong/
├── shared.js     ← constants + the shared movement function (both sides)
├── server.js     ← the authoritative server (Node)
├── index.html    ← the page
└── client.js     ← the browser client
```

The server runs on **Node** (`node server.js`); the client is served by **Vite**
(`npx vite`). Both import from the same `shared.js`.

## 4. Shared code

Everything both sides must agree on lives here — the field size, paddle/ball
dimensions, and crucially the **`movePaddle`** function the server runs for real
and the client runs to predict.

```js
// shared.js
export const WIDTH = 480;
export const HEIGHT = 320;
export const PADDLE_W = 8;
export const PADDLE_H = 56;
export const PADDLE_SPEED = 260; // px per second
export const PADDLE_INSET = 16; // gap between paddle and wall
export const BALL_SIZE = 8;
export const TICK_RATE = 60; // server + client run at this rate

// The single source of truth for paddle movement. The server calls this to
// move a paddle for real; each client calls the SAME function to predict its
// own paddle. `input` is { up, down }.
export function movePaddle(y, input, dt) {
  const dir = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  let next = y + dir * PADDLE_SPEED * dt;
  if (next < 0) next = 0;
  if (next > HEIGHT - PADDLE_H) next = HEIGHT - PADDLE_H;
  return next;
}
```

## 5. The server

The server defines three things: a **Paddle** (one per connection), a **Ball**
(spawned once), and the **game** that wires them together and keeps score.

### Imports and the paddle

A connecting client controls a **paddle**. In gamekit, an entity a connection
drives just needs an `input` field — the server writes the player's latest input
there each tick, and the paddle moves itself with our shared `movePaddle`:

```js
// server.js
import {
  ServerGame,
  WebSocketServer,
  ServerTransport,
} from "@cjgammon/gamekit-server";
import { Entity } from "@cjgammon/gamekit";
import {
  WIDTH, HEIGHT, PADDLE_W, PADDLE_H, PADDLE_INSET, BALL_SIZE,
  TICK_RATE, movePaddle,
} from "./shared.js";

class Paddle extends Entity {
  // The server sets this from the client's input each tick.
  input = { up: false, down: false };

  constructor(side /* "left" | "right" */) {
    super();
    this.width = PADDLE_W;
    this.height = PADDLE_H;
    this.x = side === "left" ? PADDLE_INSET : WIDTH - PADDLE_INSET - PADDLE_W;
    this.y = (HEIGHT - PADDLE_H) / 2;
  }

  // fixedUpdate runs once per server tick — the authoritative simulation.
  fixedUpdate(dt) {
    this.y = movePaddle(this.y, this.input, dt);
  }
}
```

### The ball

The ball moves on its own, bounces off the top/bottom walls and the paddles, and
resets to the center when it goes past a paddle (a point). It needs to see the
paddles and report scores, so we hand it the game object:

```js
class Ball extends Entity {
  constructor(game) {
    super();
    this.game = game;
    this.width = BALL_SIZE;
    this.height = BALL_SIZE;
    this.serve(1);
  }

  // Place at center and fire toward `dir` (+1 = right, -1 = left).
  serve(dir) {
    this.x = (WIDTH - BALL_SIZE) / 2;
    this.y = (HEIGHT - BALL_SIZE) / 2;
    const spread = Math.random() * 0.6 - 0.3; // small vertical angle
    this.velocity.set(dir * 200 * Math.cos(spread), 200 * Math.sin(spread));
  }

  fixedUpdate(dt) {
    super.fixedUpdate(dt); // integrate velocity → position

    // Bounce off the top and bottom walls.
    if (this.y < 0) { this.y = 0; this.velocity.y *= -1; }
    if (this.y > HEIGHT - BALL_SIZE) {
      this.y = HEIGHT - BALL_SIZE;
      this.velocity.y *= -1;
    }

    // Bounce off paddles. `bounds` is the entity's world-space box.
    for (const paddle of this.game.paddles()) {
      if (this.bounds.overlaps(paddle.bounds)) {
        // Send the ball away from the paddle's side...
        const left = paddle.x < WIDTH / 2;
        this.velocity.x = Math.abs(this.velocity.x) * (left ? 1 : -1);
        // ...with some "english" based on where it struck the paddle.
        const offset =
          (this.y + BALL_SIZE / 2) - (paddle.y + PADDLE_H / 2);
        this.velocity.y += offset * 4;
        paddle.onHit?.(); // (used later for the flash effect)
      }
    }

    // Past an edge → the other player scores; re-serve toward the loser.
    if (this.x < -BALL_SIZE) { this.game.score(1); this.serve(1); }
    if (this.x > WIDTH) { this.game.score(0); this.serve(-1); }
  }
}
```

### Wiring the game

`ServerGame` is the headless authoritative loop. Two features make Pong possible:

- **`createPlayer`** lets us decide what entity each connection controls — the
  first connection becomes the left paddle, the second the right.
- **`net.setState(...)`** broadcasts arbitrary game state (here, the score) to
  every client. Entity positions travel automatically; the score doesn't (it's
  not a position), so we send it explicitly.

```js
const scores = [0, 0]; // [left, right]

const game = new ServerGame(
  { width: WIDTH, height: HEIGHT, tickRate: TICK_RATE },
  {
    // Called once per connection. index 0 = first player, 1 = second.
    createPlayer: (info) => new Paddle(info.index === 0 ? "left" : "right"),
  },
);

// Helpers the Ball uses. Paddles are the connection entities living in the scene.
game.paddles = () =>
  game.scene.root.children.filter((e) => e instanceof Paddle);
game.score = (who) => {
  scores[who]++;
  game.net.setState({ scores }); // push the new score to all clients
};

// One server-owned ball (not tied to any connection).
game.net.spawn("ball", new Ball(game));
game.net.setState({ scores }); // initial score

// Accept WebSocket connections. (Run with Node — not Bun.)
const ws = new WebSocketServer();
ws.onConnection.add((conn) => game.accept(new ServerTransport(conn)));
ws.listen(39400, () => console.log("pong server on ws://localhost:39400"));
game.start();
```

Run it:

```bash
node server.js
```

> Notice the ball reads paddles out of the scene each tick (`game.paddles()`),
> so it automatically works whether 1 or 2 players are connected — no extra
> wiring when someone joins or leaves.

## 6. The client

The client connects, draws the world to a 2D canvas, and sends input. We use a
plain canvas here to keep the focus on networking (you could swap in gamekit's
WebGPU renderer later without changing any net code).

### The page

```html
<!-- index.html -->
<!doctype html>
<html>
  <body style="margin:0;background:#000">
    <canvas id="view" width="480" height="320"></canvas>
    <script type="module" src="/client.js"></script>
  </body>
</html>
```

### The client program

`NetScene` does the networking. We give it:

1. a **transport** — the WebSocket connection,
2. a **factory** — builds a drawable entity for each thing the server reports
   (our `"player"` paddles and the `"ball"`),
3. a **`simulate`** function — predicts *our* paddle using the shared
   `movePaddle`, so our control feels instant.

```js
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
```

### Sending input

Only up/down matter for a paddle. With prediction on, we set the **latest**
input; the scene sends it and predicts with it every tick:

```js
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
```

## 7. Run it

In one terminal:

```bash
node server.js
```

In another:

```bash
npx vite
```

Open the printed URL (e.g. `http://localhost:5173`) in **two** browser windows.
The first window is the left paddle, the second is the right. Move with **W/S**
or the **arrow keys**, rally the ball, and watch the score update in both
windows the instant someone scores.

You now have a real authoritative two-player game: the server simulates the ball
and scoring, both clients draw the same world, each predicts its own paddle for
zero-lag control, and the score syncs to everyone.

## 8. Polish: make paddles flash on a hit

Let's make a paddle flash white-bright for a moment when the ball strikes it.
The flash is a tiny bit of **per-entity state** — not a position, so it rides
along in the snapshot via two opt-in hooks: the server entity provides
`netState()`, and the matching client entity receives it in `applyNetState()`.

**Server** — give `Paddle` a flash timer and expose it:

```js
class Paddle extends Entity {
  input = { up: false, down: false };
  flash = 0; // seconds of flash remaining

  // ...constructor unchanged...

  onHit() { this.flash = 0.12; }

  fixedUpdate(dt) {
    this.y = movePaddle(this.y, this.input, dt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
  }

  // Per-entity payload added to every snapshot of this paddle.
  netState() { return { hot: this.flash > 0 }; }
}
```

(The ball already calls `paddle.onHit?.()` on contact — see step 5.)

**Client** — the factory's paddle entity receives that payload and the renderer
uses it:

```js
class PaddleView extends Entity {
  hot = false;
  applyNetState(s) { this.hot = s.hot; }
}

function factory(type) {
  if (type === "ball") {
    const e = new Entity(); e.width = BALL_SIZE; e.height = BALL_SIZE; return e;
  }
  const e = new PaddleView(); e.width = PADDLE_W; e.height = PADDLE_H; return e;
}
```

And in `render()`, tint hot paddles:

```js
for (const e of scene.client.entities.values()) {
  ctx.fillStyle = e.hot ? "#9f9" : "#fff";
  ctx.fillRect(e.x, e.y, e.width, e.height);
}
```

That's the whole pattern for syncing *any* per-entity data — health bars,
animation frames, team colors — without touching positions or the protocol.

## 9. How it maps to the engine

| Pong concept | gamekit feature |
|---|---|
| A paddle per player | `createPlayer` factory on `ServerGame` |
| Server-owned ball | `game.net.spawn("ball", ball)` |
| Bounce / score logic | the entity's `fixedUpdate` (runs on the authoritative tick) |
| Synced score | `game.net.setState(...)` → `client.state` |
| Per-paddle flash | server `netState()` → client `applyNetState()` |
| Zero-lag paddle | `NetScene`'s `simulate` (shared `movePaddle`) |
| Smooth opponent + ball | automatic snapshot interpolation |
| Matching client/server step | both constructed with `tickRate: 60` |

## 10. Going further

- **Win condition.** Stop the ball and broadcast `{ scores, winner }` from
  `setState` when a score reaches 11; draw a "Player 1 wins — press R" overlay
  from `client.state` and reset on R.
- **Richer input.** Pong only needs up/down, but input can be **any** shape —
  `setLocalInput({ up, down, boost, aimX })` and read it in your entity. The
  built-in `InputManager` from `@cjgammon/gamekit/input` maps keys/gamepad to a
  named-action object you can send directly.
- **Determinism.** The ball uses `Math.random()` to pick a serve angle — fine,
  because only the *server* runs it. If you ever predict the ball on clients,
  switch to the seeded `Rng` from `@cjgammon/gamekit` so both sides roll the same
  numbers.
- **A real renderer.** Replace the 2D-canvas `Game` with `RenderGame` from
  `@cjgammon/gamekit/renderer` to draw sprites with WebGPU. None of the
  networking code changes.

For the finished, runnable version of this game — already upgraded to the WebGPU
renderer — see [`examples/pong/`](../examples/pong/); for the architecture behind
snapshots, interpolation, and prediction, see [`CLAUDE.md`](../CLAUDE.md).
