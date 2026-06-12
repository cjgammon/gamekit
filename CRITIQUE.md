# gamekit — Engineering Critique

*Evaluation date: 2026-06-11 · Reviewed at branch `pong-demo` · Reviewer: Claude (Opus 4.8)*

*This document consolidates two earlier review passes (a general-engineering review
and a "fit as a learning vehicle" review) into one. Factual discrepancies between
them — most notably whether CI exists — were re-verified against the repo before
merging.*

## What this is, and the two lenses

gamekit is a 2D multiplayer game engine for the web, written in TypeScript **from
scratch with zero runtime dependencies**, Flixel-inspired, with an authoritative
server and a WebGPU renderer. This critique was written after reading the actual
source — core loop, networking, renderer, the `mode` example game, and the server —
and after running the build and tests, not just the docs.

Two lenses, because the grade depends on which you apply:

- **As a from-scratch, solo-authored engine and multiplayer foundation** — it is
  excellent: coherent, disciplined, and complete through the hard parts (client
  prediction + reconciliation).
- **As a learning vehicle for a beginner / young programmer** — the foundation is
  better than it needs to be; the remaining work is almost entirely surface-level
  (less boilerplate, copy-paste recipes, one-command scaffolding, a way to share
  finished games).

Both are stated explicitly so the scores are fair. Where the production lens or the
beginner lens specifically bites, it's called out.

**Verified during this review:** fresh `npm install` → `npm run build` succeeds with
zero warnings; `tsc -p packages/gamekit --noEmit` exits clean; `bun test tests/unit/`
→ **198 pass / 0 fail**, 9016 assertions, ~148ms. The README's quick-start claims are
accurate.

## Scorecard

| Category | Grade | One-line verdict |
|---|---|---|
| Ease of Use & DX | **B+** | Excellent happy path; a steep cliff from hello-world to a real game, and a few beginner footguns. |
| Architecture & Code Quality | **A−** | Textbook fixed-timestep + isomorphic core; minor hot-path allocations and stringly-typed seams. |
| Flexibility & Extensibility | **A−** | Superb networking/transport/factory seams; held back by AABB-only collision and a single render backend. |
| Performance & Scalability | **B−** | Excellent micro-optimization, little macro-scaling (no spatial partition, no sprite culling). |
| Multiplayer & Networking | **A−** | The headline feature is real and complete; JSON full-snapshots cap scale. |
| Testing, Tooling & Reliability | **B+** | Fast deterministic suite + CI; undercut by committed `dist/`, a second runtime, and no GPU/perf coverage. |
| Documentation & Learning Path | **B+** | Outstanding README/tutorials/JSDoc, undercut by a missing `ROADMAP.md`, a stale `CLAUDE.md`, and no recipe layer. |

**Overall: A− as a zero-dependency engine and multiplayer foundation.** The work is
well above hobby grade — it reads like one careful author with strong instincts about
*why*, not just *what*. The gaps are surface-level and have escape hatches already in
place.

---

## 1. Ease of Use & Developer Experience — B+

**Verdict:** The first 15 minutes are great; the cliff from hello-world to a real game
is steep, and a couple of beginner footguns bite hard.

**Strengths**
- The README's "smallest example" is real and runs: a plain `Entity` with a size
  draws as a white quad with no asset pipeline
  (`RenderView._drawEntity`, `packages/gamekit/src/render/RenderView.ts:151`), so you
  see motion in ~15 lines. Pedagogically ideal — a box that slides, every line
  commented.
- `demo:mode` runs from procedural art with **no downloads and no build step** —
  removing the single most common beginner failure point (asset/setup yak-shaving
  before anything appears on screen).
- The API reads aloud: `scene.add(entity)`, `entity.velocity.x = 60`,
  `scene.overlap(a, b, callback)`. `Game.start()` even throws an *instructive* error
  in headless environments instead of failing cryptically
  (`packages/gamekit/src/core/Game.ts:65`).
- Fluent builders where it counts — `Sprite.setTexture().addAnim().play()` all return
  `this` (`packages/gamekit/src/core/Sprite.ts:94`).

**Weaknesses**
- **The cliff from hello-world to `mode` is steep.** `examples/mode/src/main.ts` opens
  with `devicePixelRatio` math, backing-buffer sizing, FOV-derived zoom, and
  audio-unlock event plumbing (`examples/mode/src/main.ts:18-53`) — all correct, all
  well-commented, but intimidating boilerplate. This belongs behind a one-liner
  default like `RenderGame.create(canvas, { fov: 416, dpr: "auto" })`, with the manual
  version available when needed.
- **Beginner footguns.** A freshly constructed `Entity` has `width = 0, height = 0`
  (`packages/gamekit/src/core/Entity.ts:79`), so it's invisible and never collides — a
  classic "why doesn't anything happen?" moment. And `rotation` is radians with no
  `rotationDegrees` convenience, when degrees are how a beginner thinks.
- **Manual per-frame plumbing the loop should own.** In `PlayState.update` you must
  call `input.poll()` first and `input.update()` last, in that order, by hand
  (`examples/mode/src/PlayState.ts:203-211`). Forget the trailing `update()` and edge
  queries silently break.
- **No UI / screen-space layer.** Everything is world-space, so a HUD requires
  recomputing the camera's visible rect every frame
  (`PlayState._updateHud`, `examples/mode/src/PlayState.ts:248-264`).
- **`Emitter` is configured via `Object.assign(emitter, {...})`**
  (`examples/mode/src/PlayState.ts:82-104`) — undiscoverable and inconsistent with the
  nicer `InputManager`/`Camera` constructors.

---

## 2. Architecture & Code Quality — A−

**Verdict:** The strongest dimension. The core decisions are correct and consistently
executed, and the code is itself good teaching material.

**Strengths**
- **The fixed/variable timestep loop is textbook-correct.** Accumulator drains
  `fixedUpdate` 0..N times at constant dt, `update` runs exactly once, render gets a
  0..1 `alpha`; a spiral-of-death clamp guards stalls (`Game.MAX_FRAME_DT`); scene
  promotion is deferred to the top of the next step, never mid-tick (`pendingScene`) —
  a whole bug class designed out. And `step(dt)` is pure (no clock, no DOM), so the
  server reuses the *exact same loop* (`packages/gamekit/src/core/Game.ts:90`,
  `ServerGame extends Game`).
- **Isomorphism is enforced structurally,** not by convention: DOM/WebGPU code lives
  only in the `/renderer`, `/input`, `/audio`, `/net` subpaths, never the package
  root, so the server's `import "gamekit"` stays DOM-free.
- **Dependency-injection discipline is unusually good** for a from-scratch project:
  `AudioManager` takes an `AudioBackend`, `AssetLoader` takes a texture factory,
  `ServerGame`/`Camera` take injectable clocks and RNG — so browser-touching
  subsystems unit-test headlessly.
- **The interpolation model is coherent and dodges a classic bug.** `syncPrev()` /
  `sampleRender(alpha)` lerp every entity allocation-free and handle teleport-smearing
  explicitly (`setPosition(x, y, snap)`); the `Camera` mirrors the same prev/lerp
  scheme and advances in the *same fixed step* as entities
  (`packages/gamekit/src/core/Camera.ts:144`), so sprites and camera move in lockstep
  with no inter-frame jitter. Net-synced entities set `interpolate = false`
  (`NetClient` `:240`).
- **JSDoc explains rationale, not behavior** — e.g. the swept-collision reasoning in
  `Tilemap.collide` (`packages/gamekit/src/core/Tilemap.ts:133`). For someone learning
  by reading source, this is a genuine asset.

**Weaknesses**
- **Hot-path allocation that contradicts the engine's own discipline.**
  `Scene._leaves` allocates a fresh array (and spreads sub-arrays) on *every*
  `overlap()`/`collide()` call (`packages/gamekit/src/core/Scene.ts:181`), in the
  per-tick collision path — at odds with the `*Self` math ops and reused render scratch
  elsewhere. The `mode` demo calls `overlap()` ~5×/tick, re-flattening groups each time.
- **Stringly-typed entity reconstruction.** The server tags entities with a string
  literal (`type: "player"`, `packages/gamekit-server/src/net/NetServer.ts:117`) and
  the client factory switches on it — drift between the two is a runtime bug, not a
  compile error.
- **Duck-typed seams via `as Partial<...>` casts** (`NetServer._collect:196`,
  `NetClient:248`) bypass the type system at the client/server boundary, exactly where
  you most want it.
- **Creeping complexity:** ~40 source modules and growing. The architecture supports
  it, but it raises the stakes on keeping the simple paths simple (see Ease of Use).

---

## 3. Flexibility & Extensibility — A−

**Verdict:** The networking layer is one of the most extensible parts of the engine;
the rendering and collision layers are the least.

**Strengths**
- **Game-agnostic netcode.** The wire input type is deliberately `unknown`
  (`packages/gamekit/src/net/protocol.ts:18`), and games plug behavior through clean
  seams: a `SimulateFn` for prediction (`NetClient.ts:31`), a `PlayerFactory` for
  custom controllable entities (`NetServer.ts:41`), and `netState()`/`applyNetState()`
  for per-entity payloads. Paddles, ships, bitmask inputs — no engine edits. The
  protocol comments even pre-plan the JSON→binary migration without touching transports.
- **Testable seams double as extension points:** `Transport` (memory vs WebSocket),
  `InstanceSink` (the batcher runs headless against a fake GPU,
  `packages/gamekit/src/render/SpriteBatcher.ts:52`), `Game.render(alpha)` (server and
  client share one loop).
- Typed `Group<T>` collections and built-in Flixel-style recycling pools
  (`Group.recycling` + `recycle()`, `packages/gamekit/src/core/Group.ts:96`).
- **Deliberate inflexibilities are documented as decisions,** not accidents: `Group`
  is a logical container, not a transform node (Flixel's absolute-coordinate model).

**Weaknesses**
- **AABB-only collision.** `Entity.bounds` explicitly ignores rotation
  (`packages/gamekit/src/core/Entity.ts:107`); a `Circle` type exists in `math/` but
  nothing in the collision path uses it. Rotated sprites collide as their AABB. The
  absolute-coordinate `Group` model will also eventually pinch (a boss with rotating
  turret arms, UI anchored to an entity) — worth a documented escape hatch.
- **One render backend, WebGPU only.** `RenderGame` is married to WebGPU with no
  renderer interface a Canvas2D/WebGL fallback could implement — no Firefox, no older
  iPads. The `render(alpha)` seam plus `sampleRender` already give you most of the
  abstraction you'd need; this is the one seam I'd add.
- **Inheritance, not composition.** Behavior is a class hierarchy
  (`Entity → Sprite`, `Group`); cross-cutting concerns are duck-typed interfaces
  (`Syncable`, `Controllable`). On-brand for Flixel, but no component model.
- **Server consumes exactly one input per tick** (`NetServer.consumeInputs`,
  `packages/gamekit-server/src/net/NetServer.ts:139`): faster-than-tick input backs up
  and adds latency; slower re-holds the last. Input cadence is welded to tick cadence.

---

## 4. Performance & Scalability — B−

**Verdict:** Beautifully micro-optimized, structurally un-scaled. It will hold a crisp
60fps for a demo-sized game and fall over well before a bullet-hell or large open world.

**Strengths**
- **Real sprite batching:** one instance buffer, runs coalesced by texture identity, a
  single `writeBuffer` and one draw call per run, doubling growth, premultiplied color
  packed on the CPU (`packages/gamekit/src/render/SpriteBatcher.ts`).
- **Allocation-free render walk** — `RenderView` reuses `_t`/`_uv`/`_inst` scratch and
  states "a frame allocates nothing" (`packages/gamekit/src/render/RenderView.ts:32`).
  Verified by reading it.
- **Tilemap is the right primitive:** collision tests only the tiles under the entity's
  AABB (`Tilemap.collide:127`); rendering visits only on-screen tiles via a viewport
  rect (`RenderView._computeViewRect:89`). O(visible), not O(map).
- `*Self` mutating math for hot paths; `Float32Array`-backed `Mat3` for direct upload.

**Weaknesses**
- **Collision broad-phase is O(n²) with no spatial partition.**
  `Scene.overlap`/`collide` are nested loops over flattened leaf lists
  (`packages/gamekit/src/core/Scene.ts:125`); `pBullets × enemies` is
  |bullets|×|enemies| every tick. No grid/quadtree — and the `_leaves` allocation above
  compounds it.
- **No sprite frustum culling.** Only tilemaps are culled; `_drawGroup` walks and
  batches *every* visible entity in the tree regardless of whether it's on-screen
  (`RenderView.ts:116`). (You already compute the view rect for tilemaps — reuse it.)
- **Draw calls are at the mercy of child order.** The batcher splits a run on any
  texture change and never sorts (`SpriteBatcher.add:99`) — interleaving two textures
  in z-order degenerates to one draw call per sprite. No atlas packing to mitigate.
- **Network cost is O(entities × clients) per tick, JSON-encoded** and re-encoded per
  client (`NetServer.broadcast:150`). At 20Hz with no delta/binary/interest management,
  this caps practical entity and player counts.
- **Fast-bullet tunneling at the default 20Hz:** a 600 px/s bullet travels 30 px/tick —
  more than a tile. Entity↔entity overlap isn't swept (only tilemap collision is), so a
  fast mover can skip a thin target. Worth documenting (suggest a higher `tickRate` for
  single-player) until swept entity overlap lands.

---

## 5. Multiplayer & Networking — A−

**Verdict:** The engine's differentiator, and it delivers. It implements the *hard*
part — not just interpolation, but client-side prediction with server reconciliation —
and tests it.

**Strengths**
- **Authoritative server reusing the core loop:** one `fixedUpdate` → one snapshot per
  tick, off a self-correcting timer (`ServerGame._loop`,
  `packages/gamekit-server/src/game/ServerGame.ts:72`).
- **Interpolation done right:** clients buffer snapshots and render ~100ms behind
  server time with a clock-offset established at welcome
  (`NetClient.INTERPOLATION_DELAY` / `_clockOffset`).
- **Prediction + reconciliation is actually implemented** (older docs call it
  "deferred" — stale): `predict()` advances the local entity by a server-derived fixed
  step and records input history; `_reconcileLocal` snaps to the authoritative state
  and replays only unacked inputs (`packages/gamekit/src/net/NetClient.ts:161-280`),
  with the server echoing `lastSeq`. There's a dedicated `tests/net/prediction.test.ts`.
- **From-scratch RFC 6455 WebSocket server** — handshake + frame codec, each
  unit-tested (`tests/unit/ws-frame.test.ts`, `ws-handshake.test.ts`). A bold
  zero-dependency flex that genuinely holds up.

**Weaknesses**
- **JSON, full snapshots, every tick** — no delta compression, no binary codec
  (`protocol.ts` flags it as future work), no area-of-interest. Bandwidth-bound.
- **No lag compensation / server rewind.** Prediction covers the local mover only;
  authoritative hit-detection would feel laggy.
- **Not a finished netcode *stack*:** no rooms/lobbies, auth, anti-cheat, or
  reconnect/session-resume; one global scene, players auto-spawn on connect. None of
  this matters for the actual use case (two friends playing Pong), and the seams to fix
  it are in place. The architecture is right; only the wire efficiency is v0.

---

## 6. Testing, Tooling & Reliability — B+

**Verdict:** A disciplined, fast, deterministic suite with CI behind it. The gaps are
at the edges the architecture can't reach headless — plus some avoidable tooling friction.

**Strengths**
- **198 unit tests, 9016 assertions, pass in ~148ms; the package typechecks clean.**
  (Re-run during this review.) Plus `tests/net/` integration tests with a deterministic
  harness (fake clocks, memory transports).
- **CI exists** — `.github/workflows/e2e-tests.yml` installs deps, builds both
  packages, and runs the test suite on push (to `main`/`cj/scratch`) and PRs to `main`.
- **Determinism is designed in:** injected clocks, injected RNG, a pure `step(dt)`, and
  `MemoryTransport` make the whole multiplayer path testable without a network.
- **Headless-by-construction** means logic is testable without a browser/GPU — the
  batcher runs against a fake `InstanceSink`, `RenderView` against a fake
  `SpriteRenderer`. Nasty edge cases are handled *and* encoded (spiral-of-death clamp,
  swept tilemap collision, input-history cap, drag clamp without overshoot).

**Weaknesses**
- **The actual GPU pipeline is untested.** Only the CPU-side batcher logic is covered;
  shader correctness, blending, and visual output have no headless test. (The CI
  workflow installs Playwright chromium, but there are **no committed `.spec.ts`
  files** — `bun test:e2e` currently runs the Bun unit/net suite, so the "E2E" job is
  not yet exercising the browser/renderer.)
- **124 compiled `dist/` files are committed to git** — noisy diffs, merge-conflict
  bait, and the classic stale-dist trap. `prepack` already builds on publish, so
  committed `dist/` serves no purpose unless something installs the repo via git URL.
  `.gitignore` it.
- **Two runtimes:** tests require **Bun** while everything else runs on Node/npm — a
  second install is exactly the friction that derails a beginner's session. Node 18+'s
  built-in test runner (or Vitest) could likely run these and collapse the toolchain to one.
- **No performance guardrails** — the O(n²) collision and draw-call behaviors have no
  benchmark, so a scaling regression would be invisible.

---

## 7. Documentation & Learning Path — B+

**Verdict:** The prose that exists is outstanding; the problems are a broken pointer, a
stale status doc, and a missing middle rung on the learning ladder.

**Strengths**
- **The README is one of the best at this scale:** requirements, a one-command demo, a
  real 15-line example, the package/subpath map, a demo table, even a maintainer
  publish runbook.
- **Two tutorials** — a 275-line multiplayer intro and a 494-line from-scratch
  multiplayer-Pong tutorial whose four-paragraph explanation of server-authoritative
  netcode is better than most professional docs ("Read these once and the rest is just
  typing").
- **Source JSDoc is exceptional** — consistently the *why*, not the *what*.

**Weaknesses**
- **`ROADMAP.md` does not exist** — yet both the README and `CLAUDE.md` point to it as
  the source of truth, and `CLAUDE.md` says "read it first." Any AI-assisted session
  starts on a dead reference.
- **`CLAUDE.md`'s "Current build state" table is badly stale:** it claims `Camera.ts`
  is empty (it's 272 implemented, tested lines), the renderer/input/audio are "not
  started" (all implemented and tested), and prediction is "deferred" (it's in
  `NetClient`/`NetScene`). Since `CLAUDE.md` exists specifically to ground AI sessions,
  stale state there actively misleads the tool it's written for.
- **No recipe layer between "hello world" and "full tutorial."** Beginners learn by
  copy-pasting small spells — "follow the mouse," "screen shake," "play a sound on
  hit," "show a health bar." Each exists in the `mode` example but is buried in a
  265-line `PlayState`.
- **No API reference and no CHANGELOG** despite a versioned, scripted publish flow.

---

## Recommendations (prioritized)

1. **Fix the documentation drift first — cheap and high-leverage.** Create `ROADMAP.md`
   (or remove both references), and rewrite `CLAUDE.md`'s build-state table to match
   reality (renderer/input/audio/camera are done; prediction exists). This un-breaks
   AI-assisted sessions.
2. **Add a "Recipes" doc** (`docs/recipes.md`): 10–15 self-contained, copy-pasteable
   snippets (follow the mouse, shoot toward a point, flash on hit, screen shake, health
   bar, score popup, respawn timer). The single highest-leverage thing for a beginner's
   progress.
3. **Shrink the boilerplate** — fold the DPR/backing-buffer/zoom math and audio-unlock
   plumbing from `examples/mode/src/main.ts` into `RenderGame.create()` options with
   sensible defaults. Goal: a real game's `main.ts` under 20 lines.
4. **Ship a starter template** (`templates/starter/` or a tiny `npm create` script) —
   canvas HTML, Vite config, an empty scene, one sprite — so a new game is one copy
   away, not reverse-engineered from `mode`.
5. **Fix the collision scaling in one stroke:** add a spatial grid to the broad phase
   *and* make `Scene._leaves` allocation-free (cache leaf lists / reuse a buffer). Add
   sprite frustum culling in `_drawGroup` reusing the existing view rect.
6. **Introduce a screen-space/UI draw layer** so HUDs and menus don't require manual
   camera math every frame — the biggest day-to-day ease-of-use win.
7. **Land the binary/delta net codec** the protocol already anticipates, plus interest
   management — the changes that lift multiplayer from "demo" to "real game."
8. **Make games shareable** — a GitHub Pages deploy of the demos and a documented
   "deploy your game" path. Being able to send a friend a link is huge motivation (and
   surfaces the WebGPU-availability question naturally).
9. **Add a Canvas2D fallback renderer** behind a renderer interface — the one change
   that turns "works on my machine" into "works on grandma's iPad."
10. **Tooling hygiene:** `.gitignore` the committed `dist/`, and drop the Bun
    requirement (move tests to Node's built-in runner or Vitest) so the project needs
    exactly one runtime. Add a couple of perf benchmarks as regression guards, and wire
    real Playwright specs into the existing E2E job (or trim Playwright from CI until
    there are specs to run).
11. **Guard the beginner footguns** — default new entities to a visible size (or warn
    when a visible zero-sized entity is added), add a degrees-based rotation
    convenience, and document fast-bullet tunneling at 20Hz.
12. **Replace stringly-typed entity tags** with a shared registry so client/server
    factory drift becomes a compile error.

## Bottom line

Judged as what it is — a zero-dependency, from-scratch, multiplayer-first 2D engine —
this is impressive, disciplined work whose internals are themselves good teaching
material: the fixed-timestep loop, the interpolation model, and the
prediction/reconciliation netcode are all implemented the way the textbooks say to.
The weaknesses are the expected ones for this stage — scaling structures (spatial
partition, culling, binary netcode), ergonomic polish (a UI layer, less boilerplate),
tooling hygiene (committed `dist/`, a second runtime), and documentation that has
fallen behind a fast-moving codebase. None are architectural dead-ends; the seams to
fix every one of them are already in place. Tighten that top layer and this becomes a
genuinely great engine — and a genuinely great way to learn programming.
