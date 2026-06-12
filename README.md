# gamekit 🎮

A small **2D game engine for the web**, written in TypeScript from scratch with
**zero runtime dependencies**. It has a fixed-timestep game loop, a WebGPU
renderer, sprites + animation, a tilemap, particles, input, audio, and an
authoritative **multiplayer** server. Inspired by [Flixel](https://github.com/AdamAtomic/flixel).

> New here? Run a demo first (below), then copy one of the `examples/` folders as
> a starting point for your own game.

## Requirements

- **[Node.js](https://nodejs.org) 18+** and npm.
- A **WebGPU-capable browser** to see graphics: Chrome or Edge (any recent
  version), or Safari 18+.
- Optional: **[Bun](https://bun.sh)** — only needed if you want to run the tests.

## Quick start

```bash
git clone <this-repo> gamekit
cd gamekit
npm install

# Launch the playable demo (a small arena shooter). Opens a Vite dev server —
# open the printed http://localhost:5173 URL in a WebGPU browser.
npm run demo:mode-simple
```

That's it — no build step, no asset downloads. `demo:mode-simple` runs entirely
from procedurally-generated art and sound, so it works right after `npm install`.

Want multiplayer? `npm run demo:pong` builds the engine and starts a 2-player
online Pong — open the printed URL in two windows to play both paddles.

## Start your own game

Scaffold a fresh project in one command — no need to copy an example:

```bash
npm create gamekit@latest my-game   # pick single-player or multiplayer
cd my-game
npm install
npm run dev                          # opens http://localhost:5173
```

You get a runnable game (a sprite you move with WASD) to edit. Then walk through
**[docs/your-first-game.md](docs/your-first-game.md)** and keep
**[docs/recipes.md](docs/recipes.md)** open for copy-paste snippets.

## Using it in your own project

The engine is published to npm as scoped packages:

```bash
npm install @cjgammon/gamekit            # the engine (browser)
npm install @cjgammon/gamekit-server     # optional: the multiplayer server (Node)
```

Then import the core from `@cjgammon/gamekit`, and the browser-only pieces from
its subpaths (`/renderer`, `/input`, `/audio`, `/net`). You'll want a bundler
(Vite, etc.) and a WebGPU-capable browser.

## Your first game (the smallest example)

The fastest way to start is `npm create gamekit` (above), or copy
`examples/mode-simple/`. But here's the whole idea in ~15 lines — a box that
slides across the screen:

```ts
import { Entity, Scene } from "@cjgammon/gamekit";
import { RenderGame } from "@cjgammon/gamekit/renderer";

class HelloScene extends Scene {
  create() {
    const box = new Entity(100, 100); // world position
    box.width = 32;
    box.height = 32;
    box.velocity.x = 60; // pixels per second — the engine integrates motion
    this.add(box); // entities with size draw as a white quad by default
  }
}

const canvas = document.querySelector("canvas")!;
// `fov` fits the view to the canvas (× devicePixelRatio); or pass an explicit
// { width, height } in pixels if you'd rather control the backing size.
const game = await RenderGame.create(canvas, { fov: 480, autoResize: true });
game.switchScene(new HelloScene());
game.start(); // runs the fixed-timestep loop + renders each frame
```

Core ideas:

- **`Scene`** holds your game objects; override `create()` to build it.
- **`Entity`** is a thing in the world (position, size, velocity). **`Sprite`**
  adds a texture + named animations. **`Group`** is a collection of entities.
- **`Game`/`RenderGame`** runs the loop: game logic ticks at a fixed rate, while
  rendering interpolates smoothly between ticks.
- Load images/sounds with `game.assets.load(...)` and play them with a
  `Sprite`. See `examples/mode-simple/src/` for a complete, commented example.

## What's in the box

```
packages/gamekit/                  the engine — published as @cjgammon/gamekit
  @cjgammon/gamekit                core: Scene, Entity, Sprite, Group, Tilemap,
                                   Emitter, Camera, Rng, math, ...
  @cjgammon/gamekit/renderer       WebGPU renderer + RenderGame  (browser only)
  @cjgammon/gamekit/input          keyboard / mouse / gamepad     (browser only)
  @cjgammon/gamekit/audio          sound effects + music          (browser only)
  @cjgammon/gamekit/net            multiplayer client transport
packages/gamekit-server/           @cjgammon/gamekit-server (Node + WebSocket)
examples/                          runnable demos (see below)
```

The browser-only pieces live in subpaths so the multiplayer server can import
the core without any DOM/WebGPU dependency.

## Demos

| Command | What it is |
|---|---|
| `npm run demo:mode-simple` | A small arena shooter — full game, procedural art (no setup). |
| `npm run demo:mode-advanced` | The same idea as a faithful platformer using the original [Mode](https://github.com/AdamAtomic/Mode) art/sound (run `npm run fetch-assets` in `examples/mode-advanced/` first). |
| `npm run demo:pong` | A 2-player online Pong — authoritative server + client prediction, WebGPU client. Open the printed URL in two windows. |

## Handy commands

```bash
npm run build           # type-check + compile the engine to dist/
npm test                # run the unit tests (requires Bun)
npm run demo:mode-simple # play the demo
```

## Where to go next

- **`docs/your-first-game.md`** — a 10-minute walkthrough from `npm create gamekit` to a player that collects coins. **Start here.**
- **`docs/recipes.md`** — copy-paste snippets: follow the mouse, screen shake, sounds, tilemaps, camera follow, pooling, a HUD.
- **`examples/mode-simple/src/`** — a commented small game; a good reference once you've done the walkthrough.
- **`docs/tutorial-pong.md`** — **build a 2-player online Pong from scratch** (the comprehensive multiplayer tutorial: custom entities, prediction, synced score + per-entity state).
- **`docs/tutorial-multiplayer.md`** — a shorter intro to the multiplayer model (moving squares).
- **`CLAUDE.md`** — architecture and conventions (the game loop, coordinate model, multiplayer model), plus the "Current build state" table: what's built and what's planned.

## Publishing (maintainers)

Both packages publish to npm under the `@cjgammon` scope. Each ships only its
`dist/` + `LICENSE` (built automatically via a `prepack` step) and is marked
`publishConfig.access = public`. Publish **both from the repo root**:

```bash
npm login                          # once
npm run version:packages patch     # bump both versions together (patch|minor|major)
npm run release:dry                # build + dry-run publish both — preview the tarballs
npm run release                    # build + publish: engine first, then the server
```

`@cjgammon/gamekit-server` depends on `@cjgammon/gamekit`, so `release` publishes
the engine first. Keep the two at the same version (the server pins
`@cjgammon/gamekit@^0.1.x`); a **minor/major** bump of the engine also needs that
range updated in `packages/gamekit-server/package.json`.

## License

MIT — see [LICENSE](LICENSE).

