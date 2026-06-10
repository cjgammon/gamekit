# Tutorial: a simple multiplayer game

In this tutorial you'll build a tiny **server-authoritative multiplayer** game
with gamekit: an arena where every connected player controls a colored square,
and everyone sees everyone else move in real time. We'll start with the minimum
that works, then add **client-side prediction** so your own player feels
instant.

You'll write two small programs:

- a **server** (Node) that owns the truth and broadcasts the world,
- a **client** (browser) that draws the world and sends your input.

> **What you need:** Node 18+, a modern browser, and the packages installed:
> ```bash
> npm install @cjgammon/gamekit @cjgammon/gamekit-server
> ```

## How gamekit multiplayer works (the mental model)

Read this once — the rest of the tutorial is just wiring it up.

- The **server is authoritative.** It runs the real game at a fixed tick rate
  (default 20 ticks/second), and after each tick it serializes the world into a
  **snapshot** and broadcasts it to every client.
- A **client never changes the world directly.** It only sends its **input**
  (which buttons are held) to the server, and renders the snapshots it receives.
- To hide network latency, each client **interpolates**: it renders all entities
  ~100 ms in the past, smoothly between the last two snapshots. That makes other
  players move smoothly instead of teleporting on each snapshot.
- The catch: interpolating *your own* player makes it feel laggy. The fix is
  **client-side prediction** — your client simulates your own player immediately
  from your input, then gently corrects when the server's snapshot arrives. The
  trick that makes this work is a **shared movement function** that the client
  and server both run, so they agree.

Out of the box, `ServerGame` already spawns a controllable player for each
connection and moves it with that shared function — so the simplest game needs
**no custom server code at all.**

## Step 1 — The server

Create `server.mjs`. This is the entire authoritative server:

```js
import {
  ServerGame,
  WebSocketServer,
  ServerTransport,
} from "@cjgammon/gamekit-server";

const PORT = 39400;

// The world is 640×480 and ticks 20×/second. ServerGame automatically spawns a
// "player" entity for every client that connects and moves it from that
// client's input each tick.
const game = new ServerGame({ width: 640, height: 480, tickRate: 20 });

// A from-scratch WebSocket server (no dependencies). Each new connection becomes
// a client of the game.
const ws = new WebSocketServer();
ws.onConnection.add((conn) => {
  console.log("player connected");
  game.accept(new ServerTransport(conn));
  conn.onClose.add(() => console.log("player disconnected"));
});

ws.listen(PORT, () => console.log(`server on ws://localhost:${PORT}`));
game.start(); // begin ticking + broadcasting snapshots
```

Run it **with Node** (not Bun — the from-scratch WebSocket handshake targets
Node's HTTP upgrade):

```bash
node server.mjs
```

That's a complete server. It accepts connections, gives each one a player, and
broadcasts the world 20×/second.

## Step 2 — The client

The client connects, receives snapshots, and draws them. gamekit gives you a
**`NetScene`** that does the networking; you supply:

1. a **transport** (the WebSocket connection),
2. a **factory** that turns a server entity type into a drawable entity.

Create `index.html`:

```html
<!doctype html>
<html>
  <body style="margin:0;background:#111">
    <canvas id="view" width="640" height="480"></canvas>
    <script type="module" src="/main.ts"></script>
  </body>
</html>
```

Create `main.ts`:

```ts
import { Entity, Game } from "@cjgammon/gamekit";
import { NetScene, WebSocketTransport } from "@cjgammon/gamekit/net";

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
const scene = new NetScene(transport, factory);

// A Game runs the loop. We subclass it just to draw the scene to a 2D canvas.
// (You could use RenderGame from "@cjgammon/gamekit/renderer" for WebGPU
// instead — here a 2D canvas keeps the focus on networking.)
class ClientGame extends Game {
  constructor() {
    super({ width: 640, height: 480 });
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
```

Serve this with any dev server that resolves npm packages — **Vite** is the
easy choice:

```bash
npm install -D vite
npx vite
```

Open the printed URL. You'll see your square appear once the server welcomes
you. It won't move yet — we haven't sent any input.

## Step 3 — Sending input

The server moves your player from an **`InputState`**: which of `up`, `down`,
`left`, `right` are held. We send it whenever it changes.

Add this to `main.ts`:

```ts
import type { InputState } from "@cjgammon/gamekit/net";

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
  scene.client.sendInput(input); // tell the server our new intent
  e.preventDefault();
}

window.addEventListener("keydown", (e) => setKey(e, true));
window.addEventListener("keyup", (e) => setKey(e, false));
```

Now move with WASD / arrows. Open the page in **two browser windows** — each is
a separate player, and they see each other move.

**That's a complete multiplayer game.** The server is authoritative, clients
send input and render interpolated snapshots, and it all stays in sync.

## Step 4 — Make your own player feel instant (prediction)

Right now *every* entity, including yours, is rendered ~100 ms behind the
server, so your own movement feels slightly laggy. We fix that with client-side
prediction: simulate your own player locally and reconcile against the server.

The key is to predict with the **exact same movement function the server uses**,
so the two agree. gamekit exports it as `simulatePlayer` (and the constants the
default server uses). Wire it into `NetScene` via the `simulate` option:

```ts
import {
  simulatePlayer,
  PLAYER_SPEED,
  PLAYER_SIZE,
  type PredictContext,
} from "@cjgammon/gamekit";

const scene = new NetScene(transport, factory, {
  // Predict the local player by running the same step the server runs.
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
  },
});
```

With prediction enabled, you feed input a little differently: instead of
`sendInput`, set the **latest** input and let the scene send + predict it each
fixed tick. Change the key handler's send line to:

```ts
scene.client.setLocalInput(input); // predicted + sent automatically each tick
```

And make the client tick at the **same rate as the server** so prediction and
the server stay in lockstep (the loop derives the actual step from the server's
welcome, but matching avoids surprises):

```ts
super({ width: 640, height: 480, tickRate: 20 });
```

Now your own square responds instantly while remote players stay smoothly
interpolated. Under the hood the client replays any inputs the server hasn't
acknowledged yet and snaps to the server's authoritative position when a
snapshot arrives — you don't have to manage any of that.

## What you built, and where to go next

- A **server** that owns the world and broadcasts snapshots (`ServerGame` +
  `WebSocketServer`).
- A **client** that renders interpolated snapshots (`NetScene` +
  `WebSocketTransport`) and sends input.
- **Client-side prediction** for the local player via a shared `simulate`
  function.

To grow this into a real game:

- **Custom entities & rules.** Spawn more than just players on the server with
  `game.net.spawn(type, entity)`, and give each `type` a case in your client
  `factory`. Put game logic in your entities' `fixedUpdate` so it runs on the
  authoritative server tick.
- **Determinism matters for prediction.** Anything that affects gameplay in the
  fixed step (spawns, AI, spread) must be reproducible — use the seeded
  `Rng` from `@cjgammon/gamekit`, never `Math.random`, so client prediction and
  the server agree.
- **Swap in the real renderer.** Replace the 2D-canvas `Game` with `RenderGame`
  from `@cjgammon/gamekit/renderer` to draw sprites with WebGPU; the networking
  code stays exactly the same.

See the runnable reference in [`examples/netdemo/`](../examples/netdemo/), and
[`CLAUDE.md`](../CLAUDE.md) for the architecture behind the snapshot/interpolation/
prediction model.
