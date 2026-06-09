# gamekit roadmap

Live progress tracker for the from-scratch rewrite. Principles: zero runtime
dependencies, multiplayer-first, isomorphic core, fixed timestep for logic /
variable for rendering. See `CLAUDE.md` for architecture details.

## Phase 1 — Headless core ✅ DONE

- **math/** — `Vec2`, `Mat3`, `AABB`, `Circle` (immutable + `*Self` hot-path ops).
- **core/** — `Signal<T>`, `Entity` (transform + motion + lifecycle), `Sprite` (+`Animation`), `Group<T>`, `Scene` (`overlap()`/`collide()` via `AABB.penetration`, owns timers/tweens), `Game` (fixed-timestep loop, accumulator, spiral-of-death clamp, `render(alpha)` seam), `Timer`/`TimerManager`, `Tween`/`TweenManager`, `Ease`.
- Fully unit-tested (`tests/unit/`). Runs headless — no browser/DOM.

## Phase 2a — Multiplayer: snapshots + interpolation ✅ DONE

Server-authoritative loop → JSON snapshot broadcast → client interpolation.

- **Shared protocol** (`gamekit/src/net/protocol.ts`) — `input` / `welcome` / `snap` messages; `NetId`; JSON `encode`/`decode`. Single source of truth, imported by both sides.
- **Transport seam** — `Transport` interface; `MemoryTransport` (tests), `WebSocketTransport` (browser, `gamekit/net` subpath only).
- **Server** (`gamekit-server`) — hand-rolled **RFC 6455** WebSocket (`ws/frame.ts`, `ws/handshake.ts`, `WebSocketServer`, `WebSocketConnection`), `NetServer` (connection lifecycle, spawn/despawn, input routing, broadcast), `ServerGame` (subclasses `Game`; drives `step(fixedStep)` from a self-correcting timer; `render` seam serializes + broadcasts one snapshot/tick), `PlayerEntity`.
- **Client** — `NetClient` (reconcile membership by presence, send input), `Interpolator` (snapshot buffer, render ~100ms behind, lerp x/y + shortest-arc rotation), `NetScene` (writes interpolated transforms each frame).
- **Tests** — codec/handshake/interpolator unit tests; `tests/net/` integration (convergence, visibility, input routing, presence despawn, smoothness) over the in-memory transport; real-socket E2E verified manually + via `examples/netdemo/`.

Decisions: hand-rolled WS (no libs); JSON full snapshots (binary/delta later); presence-based membership; entity identity via net-layer registry (no core `id` field); snapshot carries only `{id,type,x,y,rotation}`.

## Phase 2b — Client-side prediction + reconciliation ✅ DONE

- **Shared deterministic sim** (`gamekit/src/net/sim.ts`) — `simulatePlayer` with `PLAYER_SPEED`/`PLAYER_SIZE` constants; called by both server `PlayerEntity` and client prediction so they cannot drift.
- **NetClient prediction** — `predict(dt)` sends input with seq, advances the local entity immediately; `setLocalInput()` decouples polling from per-tick send; `apply()` skips the local entity (leaves it where prediction placed it).
- **Reconciliation** — on each snapshot: local entity reset to authoritative state, acked inputs dropped, in-flight tail replayed.
- **Server input queue** — `NetServer` now buffers inputs per client; `consumeInputs()` drains one per tick (before the fixed step), so `snap.lastSeq` reflects what the server actually consumed — making replay deterministic.
- **NetScene** drives `client.predict(dt)` in `fixedUpdate` and `client.apply()` in `update`; pass `{ simulate }` in options to enable prediction.
- **Tests** (`tests/net/prediction.test.ts`) — predicted player locks to authority (no 100ms lag), un-predicted lags by interp delay, reconciliation replays in-flight inputs correctly.

## Phase 3 — Renderer + input + camera ✅ DONE

Full plan + step log: `docs/renderer-plan.md`. WebGPU-only; fixed-step logic is
interpolated to display rate (`alpha`), with camera and sprites sampled in
lockstep so motion is jitter-free.

- **`core/Camera.ts`** — center/zoom/rotation; follow (lerp + deadzone), bounds clamp, shake (injectable RNG); `worldToScreen`/`screenToWorld`; `viewProjection(alpha)` (`Mat3` world→clip). Runs in the **fixed step** (`Scene.fixedUpdate`) with `prev`/`syncPrev` and is interpolated at render, so it tracks entities without per-tick jitter. Owned by `Scene`, sized by `Game` on activation. Unit-tested.
- **Render interpolation in core** — `Entity` `prev*` transform + `interpolate` flag + `syncPrev()` + `sampleRender(alpha, out)` + `setPosition(x,y,snap)`; `Group.syncPrev` recursion; net entities opt out. Unit-tested.
- **`InputManager`** (`gamekit/input` subpath) — named actions over keyboard/mouse/gamepad codes, held + just-pressed/released edges, boolean `snapshot()` (feeds `setLocalInput`). Pure state machine (unit-tested); DOM/gamepad access confined to `attach()`/`poll()` so it stays out of the server import.
- **`WebGPURenderer`** (`gamekit/renderer` subpath) — instanced sprite pipeline, WGSL shader (std140 `mat3x3` uniform), premultiplied-alpha blending, nearest sampler. Pieces: `Texture` (frame→UV atlas math), `SpriteBatcher` (instance packing + texture-run batching behind an injected sink), `AssetLoader` (image→GPU + 1×1 white texture), `RenderView` (scene traversal → interpolated instances), `RenderGame` (async device init + `render(alpha)` seam). Pure pieces unit-tested with fakes; GPU path verified in the demo.
- **`@webgpu/types`** added as a dev-only type dependency (no runtime dep).
- **`examples/renderdemo`** — native-res (device-pixel) rendering, procedural walk sheet, `InputManager`-driven player, camera follow + bounds, white-quad blocks. `examples/netdemo` kept as-is as the multiplayer reference.

## Phase 4 — Gameplay subsystems ✅ DONE (Mode-critical complete)

The grab-bag that turns the core + renderer into something you can build a real
game on. All Mode-critical subsystems are implemented and unit-tested; the two
remaining items below are optional/deferred and not on the Mode path.

**Mode-critical** (Phase 5 is blocked without these) — all ✅:

- ✅ **`Tilemap`** (`core/Tilemap.ts`) — flat `Uint16Array` grid (0 = empty, N → tileset frame N-1); `getTile/setTile/world↔tile`; per-tile **immovable** AABB `collide(entity)` (tests only the tiles under the entity, separates + zeroes contact-axis velocity); default-solid with `setTileCollision` overrides; `forEachTileIn` for culling. Renderer draws only visible tiles via `RenderView` (view-rect unprojected from the camera). Core collision + render culling unit-tested. *(Mode: the block level + walls.)*
- ✅ **`Emitter` / `Particle`** — `Particle` is a lightweight `Sprite` (lifespan, gravity via `acceleration`, spin, alpha+scale fade, self-`kill`). `Emitter` is a recycling `Group`: `explode`/`start`/`stop`, per-particle speed/angle/life/spin/tint sampled from a seedable `Rng`, `maxParticles` cap. Draws through the existing sprite path (untextured → tinted white quad). Logic unit-tested (lifecycle, recycling, determinism, streams). *(Mode: explosions + debris.)*
- ✅ **Object pooling** — generic `core/Pool.ts` (`acquire`/`release`/`reset`/`prealloc`), plus Flixel-style `Group` recycling: opt-in `recycling` flag keeps dead children, `getFirstDead()`/`recycle(factory?)` revive in place, `Entity.revive()`. Lifecycle now skips dead children. Pure core; unit-tested, no regressions. *(Mode: bullets + particles.)*
- ✅ **`AudioManager`** (`gamekit/audio` subpath) — WebAudio load/decode (`load`/`loadAll`), one-shot SFX (volume/rate/loop), looping music with replace + `stopMusic`, master/SFX/music volume groups, `resume()` for the autoplay gesture. Context injected behind an `AudioBackend` interface so routing/registry are unit-tested with a fake; browser-only, kept out of the server import. *(Mode: music + SFX.)*
- ✅ **`Text` + bitmap font** — `BitmapFont` (glyph sprite-sheet: char→frame + advances, monospaced with per-char overrides) and `Text` entity: multi-line (`\n`), left/center/right align, scale, tint; whitespace advanced not drawn. Pure layout (`forEachGlyph`/`measure`) in core; drawn through the batcher in `RenderView`. World-space (HUD = position relative to camera). Unit-tested. *(Mode: score + "gun jammed" HUD.)*
- ✅ **Seeded RNG** (`core/Rng.ts`) — deterministic Mulberry32 (32-bit state), explicit seed, `next/range/int/intRange/bool/sign/pick/shuffle`, `getState/setState/clone` for snapshot/restore. Platform-stable; unit-tested. *(Mode: random block + spawner placement.)*

**Performance / scale** (Mode runs without it, but it's the natural home):

- **Broadphase collision** — optional quadtree (Flixel-style) behind the existing `scene.overlap()/collide()` API, for group-vs-group at bullet/particle counts. Pure core; degrades to brute force when absent. *(Mode: bullet↔block, bullet↔enemy, player↔enemy.)*

**Independent of Mode** (deferred, not on the Phase 5 path):

- **Binary / delta snapshot protocol** — replace JSON full snapshots with a `DataView` codec + per-tick deltas; transports already accept `ArrayBufferLike`, so it swaps in behind `encode`/`decode`.
- **Optional physics plugin** — richer collision response than core AABB separation. Mode does *not* need it (simple AABB + gravity suffices); listed for completeness.

## Phase 5 — "Mode" demo (Adam Atomic) 🔨 BUILT (browser GPU playtest pending)

A flagship demo inspired by Adam Atomic's **Mode** (the canonical Flixel
showcase) — a top-down score-survival arena shooter that exercises the whole
engine end-to-end. Lives in `examples/mode/`, a **Vite** project that imports the
gamekit packages straight from TypeScript source (alias → `src` indexes; no build
step, HMR into the engine). All assets — textures, bitmap font, SFX — are
generated procedurally at runtime; no binary files.

Implemented: 40×30-tile walled arena with pillar cover, WASD move + arrow-key
twin-stick shooting, four corner spawners that emit homing/shooting enemies,
pooled player/enemy bullets, particle explosions + impact sparks, camera follow
with bounds, score with decay + HP, win (destroy all spawners) / lose (HP 0) with
restart, and procedural WebAudio SFX. Type-checks (`tsc --noEmit`) and bundles
(`vite build`) clean; run via `npm run demo:mode`. **Pending:** in-browser GPU
playtest (can't run WebGPU in this environment).

Simplifications vs. the original: score-survival framing kept, but health is an
explicit HP bar rather than the original's pure score-as-life; arena is a pillar
grid rather than 16 hand-authored rooms; no gun-overheat/jam mechanic. A
multiplayer variant remains a possible stretch.

Every engine feature it needs (all delivered by earlier phases — Mode is the
assembly, not new engine work):

- **Camera** follow + world bounds → Phase 3.
- **Tilemap** + per-tile collision → Phase 4 `Tilemap`.
- **Emitters / particles** (explosions, debris) → Phase 4 `Emitter`/`Particle`.
- **Object pooling** (bullets, particles) → Phase 4 pooling.
- **Audio** (music + SFX) → Phase 4 `AudioManager`.
- **Bitmap/text HUD** (score, "gun jammed") → Phase 4 `Text`.
- **Seeded RNG** (random rooms + spawner placement) → Phase 4 `Rng`.
- **Group-vs-group collision at scale** (bullet↔block, bullet↔enemy, player↔enemy) → core `overlap()/collide()`, optionally the Phase 4 broadphase.
- **Gravity + jump, named sprite animations** → already in core (`Entity` acceleration, `Sprite` animations) — no new work.

Single-player first (faithful port); a multiplayer variant is a possible stretch once it runs.

## Cleanup backlog

- Delete legacy `examples/test/` (old PixiJS/Matter/Socket.io "pong").
- Decide on committed `dist/` (currently built into the repo) vs. gitignore + build step.
