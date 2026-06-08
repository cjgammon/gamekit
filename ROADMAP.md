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

## Phase 3 — Renderer + input + camera ⬜ NEXT

- `WebGPURenderer` — sprite batcher, WGSL shaders, texture atlas, camera uniform; consumes `Game.render(alpha)` for interpolated draw.
- `core/Camera.ts` — viewport, follow, shake, world↔screen, `Mat3` projection.
- `InputManager` — keyboard/mouse/gamepad, snapshot-based, named actions.
- Replace the throwaway `examples/netdemo` canvas with the real renderer.

## Phase 4 — Later ⬜

- Audio (`AudioManager`), binary/delta snapshot protocol, optional physics plugin, tilemaps, object pooling.

## Cleanup backlog

- Delete legacy `examples/test/` (old PixiJS/Matter/Socket.io "pong").
- Decide on committed `dist/` (currently built into the repo) vs. gitignore + build step.
