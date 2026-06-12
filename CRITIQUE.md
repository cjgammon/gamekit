# gamekit — Engineering Critique

*Evaluation date: 2026-06-10 · Reviewed at branch `pong-demo` · Reviewer: Claude (Opus 4.8)*

## What this is, and the lens I'm using

gamekit is a 2D multiplayer game engine for the web, written in TypeScript **from
scratch with zero runtime dependencies**, Flixel-inspired, with an authoritative
server. This critique was written after reading the actual source — core loop,
networking, renderer, the `mode` example game, and the server — not just the docs.

Two lenses matter, because the grade depends on which you apply:

- **As a from-scratch, solo-authored learning/portfolio engine and a multiplayer
  foundation** — it is excellent. Coherent, disciplined, genuinely complete
  through the hard parts (client prediction + reconciliation).
- **As a production engine to ship a commercial game on tomorrow** — it has real,
  specific gaps (WebGPU-only, O(n²) collision, JSON full-snapshot netcode, no UI
  layer).

I grade against the first lens and call out where the second bites. Both are
stated explicitly so the scores are fair.

## Scorecard

| Category | Grade | One-line verdict |
|---|---|---|
| Ease of Use & DX | **B+** | Clean happy path; manual per-frame plumbing and no UI/HUD layer. |
| Flexibility & Extensibility | **B+** | Superb networking/transport seams; held back by AABB-only collision and a single render backend. |
| Architecture & Code Quality | **A−** | Textbook fixed-timestep + isomorphic core; minor hot-path allocations and stringly-typed seams. |
| Performance & Scalability | **B−** | Excellent micro-optimization, little macro-scaling (no spatial partition, no sprite culling). |
| Multiplayer & Networking | **A−** | The headline feature is real and complete; JSON full-snapshots cap scale. |
| Testing & Reliability | **A−** | 198 fast, deterministic tests that pass; gaps at the GPU/E2E/CI edges. |
| Documentation & Onboarding | **B** | Great README + source comments, undercut by a missing `ROADMAP.md` and a stale `CLAUDE.md`. |

**Overall: A− as a zero-dependency engine and multiplayer foundation; not yet a
production engine.** The work is well above hobby grade — it reads like one
careful author with strong instincts about *why*, not just *what*.

---

## 1. Ease of Use & Developer Experience — B+

**Verdict:** The first 15 minutes are great; the gaps show up once you need a HUD,
particles, or to wire input correctly every frame.

**Strengths**
- The README's "smallest example" is real and runs: a plain `Entity` with a size
  draws as a white quad with no asset pipeline (`RenderView._drawEntity` →
  `packages/gamekit/src/render/RenderView.ts:151`), so you see motion in ~15 lines.
- Sensible defaults throughout: `tickRate` defaults to 20 and matches the server
  (`packages/gamekit/src/core/Game.ts:46`); `demo:mode` runs from procedural art
  with no downloads.
- Fluent builder APIs where it counts — `Sprite.setTexture().addAnim().play()` all
  return `this` (`packages/gamekit/src/core/Sprite.ts:94-125`).
- Action-based input mapping is a clean abstraction — bind `{ jump: ["Space"] }`
  and query `justPressed("jump")` (`packages/gamekit/src/input/InputManager.ts:55`).

**Weaknesses**
- **Manual per-frame plumbing the engine should own.** In `PlayState.update` you
  must call `input.poll()` first and `input.update()` last, in that order, by hand
  (`examples/mode/src/PlayState.ts:203-211`). Forget the trailing `update()` and
  edge queries silently break. The loop knows when a frame starts and ends; it
  could drive registered input managers itself.
- **No UI / screen-space layer.** Everything is world-space, so a HUD requires
  recomputing the camera's visible rect every frame by hand
  (`PlayState._updateHud`, `examples/mode/src/PlayState.ts:248-264`). For a 2D game
  engine, a fixed/screen-space draw layer is table stakes.
- **`Emitter` is configured by `Object.assign(emitter, {...})`** rather than an
  options object (`examples/mode/src/PlayState.ts:82-104`) — undiscoverable and
  inconsistent with the nicer `InputManager`/`Camera` constructors.
- **Audio-unlock boilerplate** is copied into every entry point
  (`examples/mode/src/main.ts:46-53`); a one-line `audio.unlockOnFirstGesture()`
  helper would remove a paper-cut every game re-implements.

---

## 2. Flexibility & Extensibility — B+

**Verdict:** The networking layer is one of the most extensible parts of the engine;
the rendering and collision layers are the least.

**Strengths**
- **Game-agnostic netcode.** The wire input type is `unknown`
  (`packages/gamekit/src/net/protocol.ts:18`), and games plug in behavior through
  three clean seams: a `SimulateFn` for prediction
  (`packages/gamekit/src/net/NetClient.ts:31`), a `PlayerFactory` for custom
  controllable entities (`packages/gamekit-server/src/net/NetServer.ts:41`), and
  `netState()`/`applyNetState()` for per-entity payloads. You can ship paddles,
  ships, or bitmask inputs without touching the engine. This is genuinely good design.
- **Testable seams everywhere:** `Transport` (memory vs WebSocket), `InstanceSink`
  (the batcher runs headless against a fake GPU,
  `packages/gamekit/src/render/SpriteBatcher.ts:52`), injected clocks (`now`) and
  RNG (`Camera.random`). These exist for testing but double as extension points.
- Typed `Group<T>` collections and built-in Flixel-style recycling pools
  (`Group.recycling` + `recycle()`, `packages/gamekit/src/core/Group.ts:96-110`).

**Weaknesses**
- **AABB-only collision.** `Entity.bounds` explicitly ignores rotation
  (`packages/gamekit/src/core/Entity.ts:107`). A `Circle` type exists in `math/`
  but nothing in the collision path uses it — rotated sprites still collide as
  their axis-aligned box. No polygon/circle colliders.
- **One render backend, WebGPU only.** No Canvas2D/WebGL fallback; the README
  requires a WebGPU browser. The `InstanceSink` seam *would* allow a second
  backend, but none exists, so the addressable-device set is narrowed for what is
  otherwise a "just works on the web" engine.
- **Inheritance, not composition.** Behavior is class hierarchy (`Entity → Sprite`,
  `Group`), and cross-cutting concerns are bolted on via duck-typed interfaces
  (`Syncable`, `Controllable`). On-brand for Flixel, but there's no component model,
  so "damageable" or "physics body" gets re-implemented per subclass.
- **Server consumes exactly one input per tick** (`NetServer.consumeInputs`,
  `packages/gamekit-server/src/net/NetServer.ts:139`). If a client sends faster than
  the tick rate, inputs back up and add latency; slower, and the last input is
  re-held. Input cadence is welded to tick cadence.

---

## 3. Architecture & Code Quality — A−

**Verdict:** The strongest dimension. The core design decisions are correct and
consistently executed.

**Strengths**
- **The fixed/variable timestep loop is textbook-correct.** Accumulator drains
  `fixedUpdate` 0..N times at constant dt, `update` runs exactly once, render gets a
  0..1 `alpha`; a spiral-of-death clamp guards stalls (`Game.MAX_FRAME_DT`); and
  `step(dt)` is pure — no clock, no DOM — so the server reuses the *exact same loop*
  (`packages/gamekit/src/core/Game.ts:90-110`, `ServerGame extends Game`). This is
  the heart of the engine and it's right.
- **Isomorphism is enforced structurally,** not by convention: DOM/WebGPU code lives
  only in the `/renderer`, `/input`, `/audio`, `/net` subpaths, never the package
  root, so the server's `import "gamekit"` stays DOM-free.
- **The interpolation model is coherent and avoids a classic bug.** `syncPrev()` /
  `sampleRender(alpha)` lerp every entity, and the `Camera` mirrors the same
  prev/lerp scheme and advances in the *same fixed step* as entities
  (`packages/gamekit/src/core/Camera.ts:144-159`) — so sprites and camera move in
  lockstep with no inter-frame jitter. Net-synced entities set `interpolate = false`
  because the net layer already smooths them (`NetClient` `:240`). Thoughtful.
- Comments explain **rationale**, not behavior — e.g. the swept-collision reasoning
  in `Tilemap.collide` (`packages/gamekit/src/core/Tilemap.ts:133-143`) is the kind
  of note that saves a future maintainer an hour.

**Weaknesses**
- **Hot-path allocation that contradicts the engine's own discipline.**
  `Scene._leaves` allocates a fresh array (and spreads sub-arrays) on *every*
  `overlap()`/`collide()` call (`packages/gamekit/src/core/Scene.ts:181-192`), in the
  per-tick collision path. The `mode` demo calls `overlap()` ~5×/tick, re-flattening
  groups each time — GC churn at odds with the `*Self` math ops and reused render
  scratch elsewhere.
- **Stringly-typed entity reconstruction.** The server tags entities with a string
  (`type: "player"`, `NetServer.addConnection:117`) and the client factory switches
  on it. A drift between the two is a runtime despawn bug, not a compile error — a
  shared type registry would close it.
- **Duck-typed seams via `as Partial<...>` casts** (`NetServer._collect:196`,
  `NetClient:248`) bypass the type system at exactly the client/server boundary
  where you most want it.

---

## 4. Performance & Scalability — B−

**Verdict:** Beautifully micro-optimized, structurally un-scaled. It will hold a
crisp 60fps for a demo-sized game and fall over well before a bullet-hell or a large
open world.

**Strengths**
- **Real sprite batching:** one instance buffer, runs coalesced by texture identity,
  a single `writeBuffer` and one draw call per run, doubling growth
  (`packages/gamekit/src/render/SpriteBatcher.ts`). Color is premultiplied on the CPU.
- **Allocation-free render walk** — `RenderView` reuses `_t`/`_uv`/`_inst` scratch
  and states "a frame allocates nothing" (`packages/gamekit/src/render/RenderView.ts:32`).
  Verified by reading it.
- **Tilemap is the right primitive:** collision tests only the tiles under the
  entity's AABB (`Tilemap.collide:127`), and rendering visits only on-screen tiles
  via a viewport rect (`RenderView._computeViewRect:89`). O(visible), not O(map).

**Weaknesses**
- **Collision broad-phase is O(n²) with no spatial partition.**
  `Scene.overlap`/`collide` are nested loops over flattened leaf lists
  (`packages/gamekit/src/core/Scene.ts:125-136`); `pBullets × enemies` is
  |bullets|×|enemies| every tick. No grid/quadtree. Fine at tens of entities,
  quadratic at thousands — and the `_leaves` allocation above compounds it.
- **No sprite frustum culling.** Only tilemaps are culled; `_drawGroup` walks and
  batches *every* visible entity in the tree regardless of whether it's on-screen
  (`RenderView.ts:116`). A large world pays CPU for off-screen sprites.
- **Draw calls are at the mercy of child order.** The batcher splits a run on any
  texture change and never sorts (`SpriteBatcher.add:99`) — interleaving two textures
  in z-order degenerates to one draw call per sprite. No atlas packing to mitigate.
- **Network cost is O(entities × clients) per tick, JSON-encoded** and re-encoded per
  client (`NetServer.broadcast:150`). At 20Hz with no delta/binary/interest
  management, this caps practical entity and player counts.

---

## 5. Multiplayer & Networking — A−

**Verdict:** This is the engine's differentiator and it delivers. It implements the
*hard* part of netcode — not just interpolation, but client-side prediction with
server reconciliation — and tests it.

**Strengths**
- **Authoritative server reusing the core loop:** one `fixedUpdate` → one snapshot
  per tick, off a self-correcting timer (`ServerGame._loop`,
  `packages/gamekit-server/src/game/ServerGame.ts:72`).
- **Interpolation done right:** clients buffer snapshots and render ~100ms behind
  server time with a clock-offset established at welcome
  (`NetClient.INTERPOLATION_DELAY` / `_clockOffset`).
- **Prediction + reconciliation is actually implemented** (the docs call it
  "deferred" — that's stale): `predict()` advances the local entity by a
  server-derived fixed step and records input history; `_reconcileLocal` snaps to the
  authoritative state and replays only unacked inputs
  (`packages/gamekit/src/net/NetClient.ts:161-280`), with the server echoing
  `lastSeq`. There's a dedicated `tests/net/prediction.test.ts`.
- **From-scratch RFC 6455 WebSocket server** — handshake + frame codec, each
  unit-tested (`tests/unit/ws-frame.test.ts`, `ws-handshake.test.ts`). The
  zero-dependency claim genuinely holds.

**Weaknesses**
- **JSON, full snapshots, every tick** — no delta compression, no binary codec
  (`protocol.ts` flags it as future work), no area-of-interest. Bandwidth-bound.
- **No lag compensation / server rewind.** Prediction covers the local mover only;
  there's no authoritative hit-detection rewind, so server-authoritative shooting
  would feel laggy.
- **Not a finished netcode *stack*:** no rooms/lobbies, auth, anti-cheat, or
  reconnect; one global scene, players auto-spawn on connect. An excellent
  foundation, not a turnkey backend.

---

## 6. Testing & Reliability — A−

**Verdict:** A disciplined, fast, deterministic suite that I ran and watched pass.
The gaps are all at the edges the architecture can't easily reach headless.

**Strengths**
- **198 unit tests, 9016 assertions, pass in ~148ms; the package typechecks clean.**
  (Run during this review: `bun test tests/unit/` → `198 pass / 0 fail`;
  `tsc -p packages/gamekit --noEmit` → exit 0.) Plus `tests/net/` integration tests
  over the in-memory transport.
- **Determinism is designed in:** injected clocks, injected RNG, a pure `step(dt)`,
  and `MemoryTransport` make the entire multiplayer path testable without a network.
- **Headless-by-construction** means logic is testable without a browser/GPU — the
  batcher runs against a fake `InstanceSink`, `RenderView` against a fake
  `SpriteRenderer`.
- Nasty edge cases are handled *and* encoded: spiral-of-death clamp, swept tilemap
  collision to prevent tunneling, input-history cap, drag clamping without overshoot.

**Weaknesses**
- **The actual GPU pipeline is untested.** Only the CPU-side batcher logic is
  covered; shader correctness, blending, and visual output have no headless test, so
  visual regressions would slip through.
- **No CI configuration in the repo** (no `.github/workflows`), so "tests pass"
  depends on each contributor running them locally — across three runtimes (Bun for
  tests, Node for the server, npm/tsc for builds).
- **No performance guardrails** — the O(n²) collision and draw-call behaviors have no
  benchmark test, so a scaling regression would be invisible.

---

## 7. Documentation & Onboarding — B

**Verdict:** The prose that exists is high quality; the problem is a broken pointer
and a stale status doc that actively mislead a newcomer (human or AI).

**Strengths**
- **The README is genuinely good:** requirements, a one-command demo, a real 15-line
  example, the package/subpath map, a demo table, even a maintainer publish runbook.
- **Two tutorials** (`docs/tutorial-pong.md`, `docs/tutorial-multiplayer.md`) plus a
  commented example game (`examples/mode/`) as a copy-to-start template.
- **Source doc-comments are exceptional** — consistently the *why*, not the *what*.

**Weaknesses**
- **`ROADMAP.md` does not exist** — yet both the README ("what's built and planned")
  and `CLAUDE.md` ("read it first", "the live progress tracker") point to it as the
  source of truth. A dead link at the one place a newcomer is told to start.
- **`CLAUDE.md`'s "Current build state" table is materially false.** It lists the
  renderer, input, and audio as "Not started" and `Camera.ts` as "Empty (0 bytes)" —
  all four are implemented *and* unit-tested in the tree I just read. An onboarding
  doc this out of date is worse than none; it will send a contributor (or an AI
  agent) down wrong paths.
- **No API reference and no CHANGELOG** despite a versioned, scripted publish flow —
  discovery is by reading source or examples.

---

## Top recommendations (in priority order)

1. **Fix the docs drift first — it's cheap and high-leverage.** Either create
   `ROADMAP.md` or remove the references, and bring `CLAUDE.md`'s build-state table
   in line with reality (renderer/input/audio/camera are done). Misleading
   onboarding docs tax every future contributor.
2. **Add a spatial grid to broad-phase collision** and make `Scene._leaves`
   allocation-free (cache leaf lists, or write into a reused buffer). This removes
   both the O(n²) blowup and the per-tick GC churn in one stroke.
3. **Add sprite frustum culling** in `RenderView._drawGroup` (you already compute the
   view rect for tilemaps — reuse it for entity AABBs).
4. **Introduce a screen-space/UI draw layer** so HUDs and menus don't require manual
   camera math every frame. This is the biggest day-to-day ease-of-use win.
5. **Land the binary/delta net codec** the protocol already anticipates, and add
   interest management — the two changes that lift the multiplayer ceiling from
   "demo" to "real game."
6. **Add CI** (run `tsc` + `bun test` on push) and a couple of performance
   benchmarks as regression guards.
7. **Replace stringly-typed entity tags** with a shared registry so client/server
   factory drift becomes a compile error.

## Closing

Judged as what it is — a zero-dependency, from-scratch, multiplayer-first 2D engine
by a solo author — this is impressive, disciplined work. The core loop is correct,
the isomorphic boundary is enforced rather than hoped for, and the netcode goes all
the way through prediction and reconciliation with tests to back it. The weaknesses
are the expected ones for this stage: scaling structures (spatial partition, culling,
binary netcode), ergonomic polish (a UI layer, less manual plumbing), and a
documentation set that has fallen behind a fast-moving codebase. None of them are
architectural dead-ends — the seams to fix them are already in place.
