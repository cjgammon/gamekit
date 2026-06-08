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

## Phase 3 — Renderer + input + camera 🔨 IN PROGRESS

- ✅ `core/Camera.ts` — viewport, follow (lerp + deadzone), bounds clamp, shake (injectable RNG), `worldToScreen`/`screenToWorld`, `viewProjection()` (`Mat3` world→clip). Owned by `Scene`, advanced in `update`, sized by `Game` on activation. Unit-tested.
- ✅ `InputManager` (`gamekit/input` subpath) — named actions over keyboard/mouse/gamepad codes, held + just-pressed/released edges, boolean `snapshot()` (feeds `setLocalInput`). Pure state machine (unit-tested); DOM/gamepad access confined to `attach()`/`poll()` so it stays out of the server import.
- `WebGPURenderer` — sprite batcher, WGSL shaders, texture atlas, camera uniform; consumes `Game.render(alpha)` for interpolated draw.
- New `examples/renderdemo` showing the real renderer + camera + input. Keep `examples/netdemo` (the 2D-canvas multiplayer demo) as-is — it stays the multiplayer reference; the renderer gets its own demo rather than replacing it.

## Phase 4 — Gameplay subsystems ⬜

The grab-bag that turns the core + renderer into something you can build a real
game on. Most of these exist specifically to make the **Mode** demo (Phase 5)
buildable; each is tagged accordingly. Depends on Phase 3 for anything that draws.

**Mode-critical** (Phase 5 is blocked without these):

- **`Tilemap`** — grid of tiles backed by a flat typed array; batched draw through the renderer; per-tile AABB collision via `scene.collide(entity, tilemap)`. Isomorphic core + a renderer-side draw path. *(Mode: the block level + walls.)*
- **`Emitter` / `Particle`** — burst + continuous emission, per-particle lifespan, velocity/gravity, fade-out; particles are pooled `Entity`s the emitter owns. New subsystem; logic in core, draw via the sprite batcher. *(Mode: explosions + debris.)*
- **Object pooling** — `Pool<T>` and `Group.recycle()/getFirstAvailable()` (Flixel-style) so bullets and particles reuse dead slots instead of allocating per-frame. Pure core; reinforces the zero-GC hot-path principle. *(Mode: bullets + particles.)*
- **`AudioManager`** — WebAudio load/decode, one-shot SFX, looping music, master/group volume. Browser-only — lives behind a subpath export like `WebSocketTransport`, never imported by the isomorphic core or the server. *(Mode: music + SFX.)*
- **`Text` + bitmap font** — text entity rendered from a glyph atlas through the batcher; left/center align. Renderer-dependent. *(Mode: score + "gun jammed" HUD.)*
- **Seeded RNG** (`Rng`) — deterministic, zero-dep (xorshift/PCG), explicit-seed. Needed so random level/spawn generation is reproducible and server-compatible (determinism principle). *(Mode: random block + spawner placement.)*

**Performance / scale** (Mode runs without it, but it's the natural home):

- **Broadphase collision** — optional quadtree (Flixel-style) behind the existing `scene.overlap()/collide()` API, for group-vs-group at bullet/particle counts. Pure core; degrades to brute force when absent. *(Mode: bullet↔block, bullet↔enemy, player↔enemy.)*

**Independent of Mode** (deferred, not on the Phase 5 path):

- **Binary / delta snapshot protocol** — replace JSON full snapshots with a `DataView` codec + per-tick deltas; transports already accept `ArrayBufferLike`, so it swaps in behind `encode`/`decode`.
- **Optional physics plugin** — richer collision response than core AABB separation. Mode does *not* need it (simple AABB + gravity suffices); listed for completeness.

## Phase 5 — "Mode" demo (Adam Atomic) ⬜

Port Adam Atomic's **Mode** as a flagship demo that exercises the whole engine end-to-end — the original [`PlayState.as`](https://github.com/AdamAtomic/Mode/blob/master/src/PlayState.as) is the canonical Flixel showcase, and gamekit is Flixel-inspired, so it doubles as a feature checklist and a real-world validation of the API.

A top-down score-survival shooter: 640×640 world of 16 rooms (160×160 each), randomly-generated platform blocks, enemy spawners in the corner rooms, enemies that shoot at the player, player + enemy bullets, particle explosions, a HUD (score with continuous decay, hi/last score, "gun jammed" overheat notice), camera follow with bounds, and music/SFX.

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
