# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

gamekit is a 2D multiplayer game engine for the web, written in TypeScript **from scratch with zero runtime dependencies**. Inspired by Flixel. The server is authoritative; clients predict and interpolate.

Core principles that shape almost every decision:

- **Multiplayer-first** — networking is a design constraint, not an afterthought.
- **Zero runtime dependencies** — every subsystem is hand-written so optimizations can cross boundaries a library seam would block. Do not reach for a dependency to solve a problem; write it.
- **Fixed timestep for logic, variable for rendering** — game logic must stay deterministic and server-compatible.
- **Isomorphic core** — `Entity`/`Group`/`Scene` run unchanged on both client and headless server.

## The rewrite (status)

The project was rebuilt from scratch out of an older incarnation ("KidEngine") that wrapped **PixiJS + Matter.js + Socket.io**. The from-scratch core, the WebGPU renderer, input, audio, the headless server loop, and the full multiplayer layer (snapshots + interpolation **and** client-side prediction + reconciliation) are all implemented and tested. **The "Current build state" table below is the live progress tracker — read it first, and keep it current when subsystem status changes.**

### Current build state

Everything below is implemented and covered by tests (`bun test tests/unit/` + `tests/net/`; `npx tsc -p packages/gamekit --noEmit` is clean).

| Area | Reality |
|---|---|
| `math/` — `Vec2`, `Mat3`, `AABB`, `Circle` | Implemented + unit-tested. |
| `core/Signal`, `core/Entity` | Implemented + unit-tested. |
| `core/Sprite.ts` | Implemented (also `Animation` + `AnimationConfig`). |
| `core/Group.ts` | Implemented — real `Group<T>` collection (the old "identical to Sprite" defect is fixed). |
| `core/Scene.ts` | Implemented — root Group, `overlap()`/`collide()`, owns timers + tweens. |
| `core/Game.ts` | Implemented — fixed-timestep loop, scene mgmt, spiral-of-death clamp, `render(alpha)` seam. |
| `core/Timer.ts`, `core/Tween.ts`, `core/Ease.ts` | Implemented + unit-tested. |
| `core/Camera.ts` | Implemented + unit-tested — `follow` (with lerp), deadzone, world-bounds clamp, `shake`, and `view()`/`viewProjection()` matrices. |
| `core/Tilemap.ts` | Implemented + unit-tested — grid of tiles with collision against entities. |
| `core/Emitter.ts` + `core/Particle.ts` | Implemented + unit-tested — particle system. |
| `core/Text.ts` + `core/BitmapFont.ts` | Implemented + unit-tested — bitmap-font text rendering. |
| `core/Pool.ts` | Implemented + unit-tested — object pool for recycling entities. |
| `core/Rng.ts` | Implemented + unit-tested — deterministic (seedable) RNG for server-compatible logic. |
| `render/` (WebGPU) — `WebGPURenderer`, `SpriteBatcher`, `RenderView`, `Texture`, `AssetLoader`, `RenderGame`, `std140` | Implemented + unit-tested. Browser-only; exported from the `gamekit/renderer` subpath. |
| `input/InputManager.ts` | Implemented + unit-tested. Browser-only; exported from `gamekit/input`. |
| `audio/AudioManager.ts` | Implemented + unit-tested. Browser-only; exported from `gamekit/audio`. |
| `net/` (client) — `protocol`, `Transport`, `MemoryTransport`, `Interpolator`, `NetClient`, `NetScene`, `WebSocketTransport`, `sim` | Implemented + tested — milestone 2a (snapshots + interpolation) **and** 2b (client-side prediction + reconciliation). |
| Client-side prediction / reconciliation | Implemented + tested — `NetClient.predict()` / `_reconcileLocal` replay buffered inputs against authoritative snapshots (`tests/net/prediction.test.ts`). |
| `gamekit-server` — RFC 6455 WS server, `NetServer`, `ServerGame`, `PlayerEntity`, `ServerTransport` | Implemented + tested (memory transport + real-socket E2E). |

### Not started / possible next steps

- Delta snapshots and area-of-interest culling (binary snapshot encoding is done — `net/codec.ts`).
- Lag compensation / server-side hit rewind.
- Broader collision (rotated bodies, spatial partitioning) beyond AABB separation.
- Asset pipeline beyond the runtime `AssetLoader` (texture-atlas packing, etc.).

## Architecture

### The frame loop (the heart of the engine)

Logic and rendering are decoupled. Every frame:

```
accumulator += realDt
while accumulator >= fixedStep:
  fixedUpdate(fixedStep)   ← physics, motion, game logic (deterministic, server-compatible)
  accumulator -= fixedStep
update(realDt)             ← animation, tweens, sweep dead entities (exactly once/frame)
render()
```

`fixedUpdate` may run 0, 1, or many times per frame; `update` runs exactly once. Put anything that must match the server's fixed tick (default 20 Hz) in `fixedUpdate`; put anything purely visual (animation frame advance, tweens) in `update`. `Entity` integrates motion in `fixedUpdate` in this order: acceleration → drag (clamps to zero, no overshoot) → `maxVelocity` clamp → position.

### Coordinate model

Entity coordinates are **absolute world coordinates**. `Group` is a logical container, **not** a transform node — it does not offset its children. This is the Flixel model, chosen over a scene graph deliberately. Do not add child-relative transforms to `Group`.

### Class hierarchy

```
Entity            base object — transform, motion, lifecycle hooks, onDestroy signal
  Sprite          adds texture/frames/named animations; animation advances in update()
  Group<T>        typed collection, itself an Entity; forwards updates, sweeps dead children
Scene             owns root Group, Camera, timers, tweens; overlap()/collide() helpers
Game              fixed-timestep loop + scene management
Signal<T>         typed event emitter used throughout (emits over a snapshot, so listeners
                  can add/remove during dispatch)
```

`Group` sweeps children with `alive === false` at the start of each `update`, iterating back-to-front for splice safety. Basic collision (`scene.overlap()` / `scene.collide()`) lives in core and uses `AABB.penetration()` — no physics plugin needed for simple separation.

### Math conventions

- `Vec2` has **immutable** ops (`add`, `scale`, `normalized`, `lerp` → new instances) and **mutating** `*Self` variants (`addSelf`, `scaleSelf`) for hot paths. Use `*Self` in per-frame integration to avoid allocation.
- `Mat3` is **column-major**, backed by `Float32Array` for direct GPU upload.

### Multiplayer model

Server runs the same headless core loop at a fixed tick rate (default 20 Hz), serializes world state after each tick, and broadcasts snapshots over a from-scratch (RFC 6455) WebSocket. The wire format is a compact **binary** codec by default (transforms packed as raw numbers, the game-defined `unknown` payloads written by a small self-describing value codec — MessagePack-style — so any shape goes binary with no schema); a `jsonCodec` is selectable for debugging (`net/codec.ts`). Clients buffer snapshots and **interpolate** all entities ~100ms behind real time, and **predict the local player** with reconciliation (`NetClient.predict` / `_reconcileLocal`). Net logic sits behind a `Transport` interface (`MemoryTransport` for tests, `WebSocketTransport` in the browser).

Server runtime note: the WS server targets **Node**'s `http` upgrade. Bun has a `node:http` upgrade quirk that drops the handshake to browser clients, so run the real server on Node (`node examples/pong/server.js`). Bun is used as the **test runner** and to run TS sources directly.

## Packages & layout

```
packages/gamekit/         client engine — math, core, render (WebGPU), input, audio, net
packages/gamekit-server/  authoritative server — RFC 6455 WS, NetServer, ServerGame
packages/create-gamekit/  `npm create gamekit` scaffolder (zero-dep CLI + templates)
examples/                  runnable demos — mode-simple, mode-advanced, pong (multiplayer)
docs/                      recipes.md, your-first-game.md, multiplayer tutorials
tests/unit/               core + codec + interpolator unit tests (Bun)
tests/net/                multiplayer integration tests (in-memory transport)
```

## Commands

```bash
npm run build           # tsc: build gamekit then gamekit-server (dist + .d.ts)
npm run build:gamekit   # build just the client package

npm test                # bun test tests/unit/   (fast pure unit tests)
npm run test:watch
npm run test:net        # build:gamekit, then bun test tests/net/ (integration)
npm run test:e2e        # bun test tests/  (everything)

# Run a single bun test file / filter
bun test tests/unit/<file>.test.ts
bun test tests/ -t "<test name pattern>"

# Multiplayer Pong demo (builds, then runs the Node server + Vite client together)
npm run demo:pong       # server on ws://localhost:39400; open the printed Vite URL in two windows
```

The server imports the core via the `gamekit` package name, which resolves to its built `dist` — so **`gamekit` must be built before running the server or `tests/net/`** (`test:net` and `demo:pong` do this for you). Unit tests import core from source via relative paths and need no build.

Test env lives in `.env.test`; runner config in `bunfig.toml`.

## Conventions when adding to the new engine

- **Imports use `.js` extensions** even from `.ts` source (`./Entity.js`), per ESM output — match the existing files.
- TypeScript is `strict`, target ES2020. The client (`gamekit`) uses `module: ESNext` (bundler-style); the server (`gamekit-server`) uses `module`/`moduleResolution: NodeNext` (it uses `node:http`/`node:crypto`).
- Keep core **and the isomorphic net pieces** (`protocol`, `Transport`, `Interpolator`, `NetClient`, `NetScene`) free of DOM/`window`/WebGPU references. Browser-only code (`WebSocketTransport`) lives in `net/` and is exported **only** from the `gamekit/net` subpath, never the package root — that keeps the server's `import "gamekit"` DOM-free. Do not re-export it from `src/index.ts`.
- New subsystems are written from scratch — adding a runtime dependency contradicts a core project principle, so don't without explicit direction.
