# Changelog

All notable changes to gamekit are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the packages
(`@cjgammon/gamekit`, `@cjgammon/gamekit-server`, `create-gamekit`) are versioned
together.

## [Unreleased]

### Added

- **One-command scaffolding:** `npm create gamekit` (`create-gamekit`) generates a
  runnable single-player or multiplayer project.
- **Frictionless setup:** `RenderGame.create(canvas, { fov, dpr, autoResize })`
  fits the backing buffer to the canvas and derives the camera zoom; a default
  zoom threads through `Game`.
- **Canvas2D fallback renderer** — `Canvas2DRenderer`, `Canvas2DGame`, and
  `createGame(canvas, config)`, which picks WebGPU when available and falls back
  to Canvas2D (Firefox / older iPads / Safari < 18). Same scenes, either backend.
- **Screen-space UI layer:** `Scene.hud` + `addHud()` — draw HUDs/menus in screen
  pixels with no camera math.
- **Binary net codec** (now the default wire format): compact transforms plus a
  self-describing value codec (MessagePack-style) for game payloads, ~50% smaller
  than JSON; `jsonCodec` is selectable for debugging. Exposes `BinaryWriter` /
  `BinaryReader`.
- **Typed entity registry:** `createEntityFactory<T>(builders)` — exhaustive,
  drift-caught entity construction for the net layer.
- **Anti-tunneling collision:** `Scene.overlapSwept()` tests a body's swept path,
  catching fast movers that would skip past a target between ticks.
- **Helpers:** `AudioManager.unlockOnGesture()`, `Entity.rotationDegrees` /
  `Camera.rotationDegrees`, `mountUnsupportedNotice()` / `isWebGPUAvailable()`.
- **Docs & demos:** `docs/your-first-game.md`, `docs/recipes.md`, a GitHub Pages
  deploy workflow, and an `examples/bunnymark` sprite stress test (runs on either
  backend; `?canvas` forces Canvas2D).
- A one-time dev warning when a visible entity has zero size.

### Changed

- **Collision scales:** `overlap`/`collide` use a uniform spatial-hash broad-phase
  (O(n²) → ~linear, identical results) with an allocation-free leaf flatten.
- **Renderer:** off-screen sprites are frustum-culled; `AssetLoader` /
  `TextureFactory` are generic over the backend texture handle.
- **Examples reorganized:** `mode` → `mode-simple`, `mode2` → `mode-advanced`; the
  multiplayer **pong** demo was upgraded to WebGPU and is now the canonical
  networking example (`npm run demo:pong`).
- **Tooling:** tests run on Node via **Vitest** (was Bun) — one runtime for the
  whole project; an API-reference target (`npm run docs:api`, typedoc) was added.

### Removed

- Throwaway/duplicate examples: `renderdemo`, `netdemo`, `multiplayer`
  (consolidated into the demos above).
- Committed `dist/` is no longer tracked in git — it's built on demand
  (`npm run build`) and by each package's `prepack` before publish.

## [0.1.0]

- Initial from-scratch engine: math, core (`Entity`/`Group`/`Scene`/`Game`,
  timers, tweens, camera, tilemap, particles, text, pooling, RNG), WebGPU
  renderer, input, audio, and the authoritative multiplayer layer (snapshots +
  interpolation and client-side prediction + reconciliation).
