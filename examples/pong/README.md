# Pong (multiplayer)

A 2-player online Pong: an **authoritative server** simulates the game, and each
client **predicts** its own paddle and **interpolates** everything else. Rendered
with **WebGPU** — the paddles and ball are plain white boxes (no art needed); the
score is a DOM overlay fed by the server's synced game state.

This is the runnable companion to the from-scratch walkthrough in
[`../../docs/tutorial-pong.md`](../../docs/tutorial-pong.md).

## Run

Requires **Node 18+** and a **WebGPU browser** (Chrome/Edge, or Safari 18+).

```bash
# from the repo root — builds the engine, then starts the server + client:
npm run demo:pong
```

Open the printed Vite URL (e.g. http://localhost:5173) in **two** windows — each
controls one paddle. **W/S** or **↑/↓** to move.

> The server runs on **Node**, not Bun — the from-scratch WebSocket server targets
> Node's `http` upgrade (a Bun `node:http` quirk drops the browser handshake).

## What it exercises

- `ServerGame` with a custom `createPlayer` factory (left/right paddles) and a
  server-owned `Ball` spawned via `net.spawn`.
- `NetScene` / `NetClient`: snapshot **interpolation** of remote entities plus
  local-paddle **prediction + reconciliation**, sharing `movePaddle` in
  `shared.js` between client and server.
- **Synced game state**: `net.setState({ scores })` on the server →
  `client.onState` on the client.
- `RenderGame` (WebGPU) drawing plain entities as white quads.

## Files

- `shared.js` — constants + the shared `movePaddle` simulation (client & server).
- `server.js` — authoritative game (Node): paddles, ball physics, scoring.
- `client.js` — WebGPU client: prediction, interpolation, score overlay, input.
