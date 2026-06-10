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
npm run demo:mode
```

That's it — no build step, no asset downloads. `demo:mode` runs entirely from
procedurally-generated art and sound, so it works right after `npm install`.

Prefer something tiny? `npm run demo:render` builds the engine and serves a
minimal "sprite + camera + input" example on http://localhost:8080.

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

The fastest way to start is to copy `examples/mode/` and edit it. But here's the
whole idea in ~15 lines — a box that slides across the screen:

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
const game = await RenderGame.create(canvas, { width: 480, height: 360 });
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
  `Sprite`. See `examples/mode/src/` for a complete, commented example.

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
| `npm run demo:mode` | A small arena shooter — full game, procedural art (no setup). |
| `npm run demo:mode2` | The same game using the original [Mode](https://github.com/AdamAtomic/Mode) art/sound (run `npm run fetch-assets` in `examples/mode2/` first). |
| `npm run demo:render` | Minimal renderer + camera + input demo. |
| `npm run demo:server` | The multiplayer demo's server (then serve the repo and open `examples/netdemo/`). |

## Handy commands

```bash
npm run build        # type-check + compile the engine to dist/
npm test             # run the unit tests (requires Bun)
npm run demo:mode    # play the demo
```

## Where to go next

- **`examples/mode/src/`** — a commented small game; a good template to learn from.
- **`docs/tutorial-multiplayer.md`** — build a simple multiplayer game step by step.
- **`ROADMAP.md`** — what's built and what's planned.
- **`CLAUDE.md`** — architecture and conventions (the game loop, coordinate model, multiplayer model).

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

