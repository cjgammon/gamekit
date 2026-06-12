# gamekit — Engine Critique

*An evaluation of [cjgammon/gamekit](https://github.com/cjgammon/gamekit), a from-scratch TypeScript 2D web game engine with WebGPU rendering and first-class multiplayer, built as a learning project for a 10-year-old.*

**Verified during review:** fresh clone → `npm install` → `npm run build` all succeed with zero warnings. The README's claims about the quick start are accurate.

---

## 1. Ease of Use — B+

This is the category that matters most given the audience, and it's a mixed but mostly positive picture.

**What works:** The README is genuinely excellent — one of the best-written project READMEs I've seen at this scale. The "your first game in ~15 lines" example is exactly right pedagogically: a box that slides across the screen, with every line commented. The promise of "no build step, no asset downloads" for `demo:mode` is real and removes the single most common failure point for kids (asset/setup yak-shaving before anything appears on screen). The API itself is friendly: `scene.add(entity)`, `entity.velocity.x = 60`, `scene.overlap(a, b, callback)` — a kid can read that aloud and understand it. `Game.start()` even throws a helpful, instructive error in headless environments instead of failing cryptically.

**What's harder than it needs to be:** The gap between the 15-line hello world and the `mode` example is steep. `examples/mode/src/main.ts` opens with `devicePixelRatio` math, backing-buffer sizing, FOV-derived zoom calculation, and audio-unlock event plumbing — all correct and well-commented, but intimidating boilerplate for a beginner who just wants a player on screen. That ~40 lines of setup should be something the engine offers as a one-liner default (`RenderGame.create(canvas, { fov: 416, dpr: "auto" })`) with the manual version available for when he's ready.

Two smaller footguns: a freshly constructed `Entity` has `width = 0, height = 0`, so it's invisible and never collides — a classic "why doesn't anything happen" moment for a new programmer (a default size, or a console warning when adding a zero-sized visible entity, would help). And `rotation` is in radians with no `rotationDegrees` convenience; degrees are how a 10-year-old thinks.

Finally, the WebGPU-only requirement is the single biggest accessibility constraint — no Firefox, no older iPads, and it makes sharing a game with friends conditional on what browser they have. The README discloses this honestly, but for a kid, "send your friend a link and it just works" is a huge part of the payoff.

## 2. Architecture & Code Quality — A

This is the engine's strongest dimension. The code reads like it was written by someone who has built engines before and is also deliberately teaching through the code itself.

Concretely: the fixed-timestep accumulator loop in `Game.step()` is textbook-correct, including the `MAX_FRAME_DT` spiral-of-death clamp and the deferred scene promotion (`pendingScene` promoted at the top of the next step, never mid-tick — a subtle bug class eliminated by design). `Entity` separates `fixedUpdate` (deterministic logic) from `update` (visuals) cleanly, and render interpolation via `syncPrev()`/`sampleRender(alpha)` is allocation-free and handles the teleport-smearing problem explicitly (`setPosition(x, y, snap)`).

The dependency-injection discipline is unusually good for a hobby project: `AudioManager` takes an `AudioBackend` interface, `AssetLoader` takes a `TextureFactory`, `ServerGame` takes an injectable clock — all so the browser-touching subsystems can be unit-tested headlessly. The isomorphic-core constraint (browser-only code lives behind `/renderer`, `/input`, `/audio` subpaths; the package root stays DOM-free so the server can import it) is enforced through package structure rather than convention, which is the right way.

The JSDoc density deserves special mention. Nearly every class and method explains not just *what* but *why* ("Snapshots transforms first so the renderer can interpolate this tick"). For a kid learning by reading source, this is a real asset.

The main critique: at 5,000 lines across ~30 files, complexity is creeping toward "engine author" territory rather than "engine user" territory. That's fine — the architecture supports it — but it raises the stakes on keeping the simple paths simple (see Ease of Use).

## 3. Flexibility & Extensibility — A−

The extension seams are well-chosen. The `Transport` interface (with `MemoryTransport` for tests and `WebSocketTransport` for production) means the entire multiplayer stack is swappable and testable. The wire protocol's `Input` type is deliberately `unknown` so games define their own input shapes. `ServerGame` accepts a `createPlayer` factory so the synced entity can be a paddle, a ship, anything. `Game.render(alpha)` is a protected seam, so the headless server and the WebGPU client share one loop. The protocol comments even pre-plan the JSON → binary codec migration without touching transports.

Deliberate inflexibilities are documented as decisions, not accidents: `Group` is a logical container, not a transform node (Flixel's absolute-coordinate model), and CLAUDE.md explicitly says "do not add child-relative transforms." Reasonable — but it will eventually pinch (a boss with rotating turret arms, UI anchored to an entity), and collision is AABB-only with no rotation awareness and an O(n²) broad phase. Fine at current scale; worth a documented escape hatch later (swept AABB for fast bullets, a simple spatial hash).

The renderer is the least swappable subsystem — `RenderGame` is married to WebGPU with no renderer interface that a Canvas2D fallback could implement. That's the one seam I'd add.

## 4. Documentation & Learning Path — A−

The documentation is far above hobby-project norm: a polished README, a 275-line multiplayer intro, and a 494-line from-scratch multiplayer Pong tutorial that explains snapshots, interpolation, and prediction in genuinely accessible language ("Read these once and the rest of the tutorial is just typing"). The four-paragraph explanation of server-authoritative multiplayer in the Pong tutorial is better than most professional netcode docs.

Two real problems, both fixable in an afternoon. First, **both the README and CLAUDE.md point to a `ROADMAP.md` that doesn't exist in the repo** — and CLAUDE.md says "read it first," which means any AI-assisted session starts with a dead reference. Second, **CLAUDE.md's "Current build state" table is badly stale**: it claims `Camera.ts` is empty (it's 272 implemented lines), the renderer/input/audio are "not started" (all fully implemented), and prediction is "deferred" (it exists in `NetClient`/`NetScene`). Since CLAUDE.md exists specifically to ground AI coding sessions, stale state there actively misleads the tool it's written for.

The bigger pedagogical gap: there's no *recipe-level* documentation between "hello world" and "full tutorial." Kids learn by copy-pasting small spells — "make a thing follow the mouse," "add screen shake," "play a sound on hit," "show a health bar." Each of these exists in the `mode` example, but buried in a 265-line `PlayState`.

## 5. Multiplayer Design — A

For a from-scratch implementation, this is impressively complete and correct in its fundamentals: server-authoritative simulation at a fixed tick, JSON snapshots with sequence-numbered input acking, client-side interpolation ~100ms behind real time, and local-player prediction with reconciliation via a shared deterministic `simulatePlayer` step that runs identically on client and server. The from-scratch RFC 6455 WebSocket server (handshake, framing) is a bold zero-dependency flex that's also unit-tested (`ws-frame.test.ts`, `ws-handshake.test.ts`).

Honest limitations: JSON full-world snapshots every tick won't scale past small entity counts (acknowledged in comments — delta compression and binary encoding are the planned path), there's no interest management, and no reconnect/session-resume story. None of this matters for the actual use case (a kid playing Pong with a friend), and the seams to fix it later are already in place. The architecture is right; only the wire efficiency is v0.

## 6. Testing & Tooling — B+

The test investment is unusual and commendable: 23 unit test files covering nearly every subsystem (entity, camera, tween, tilemap, interpolator, std140 layout, WS framing...), plus net integration tests with a deterministic harness (fake clocks, memory transports), plus Playwright E2E tests running in CI on every push. The DI discipline noted in §2 is what makes the browser-only subsystems testable at all, and it pays off here.

Two issues. The test suite requires **Bun** while everything else runs on Node/npm — a second runtime to install is exactly the kind of environment friction that derails a kid's session, and Node 18+ now ships a built-in test runner that could likely run these. And **124 compiled `dist/` files are committed to git**, which creates noisy diffs, merge-conflict bait, and the classic stale-dist trap where the committed JS silently lags the TS source; `prepack` already builds on publish, so committed dist serves no purpose unless something consumes the repo directly via git URL.

---

## Recommendations

In rough priority order for the actual goal (a 10-year-old learning, staying motivated, and shipping things):

1. **Fix the documentation drift first** — add the missing `ROADMAP.md` (or remove both references) and rewrite CLAUDE.md's build-state table to match reality. Cheap, and it un-breaks AI-assisted sessions, which are presumably a big part of how he codes.

2. **Add a "Recipes" doc** (`docs/recipes.md`): 10–15 self-contained, copy-pasteable snippets — follow the mouse, shoot toward a point, flash on hit, screen shake, health bar, score popup, respawn timer. This is the highest-leverage thing you can do for his learning; recipes are how kids actually progress.

3. **Shrink the boilerplate** — fold the DPR/backing-buffer/zoom math and the audio-unlock gesture handling from `examples/mode/src/main.ts` into `RenderGame.create()` options with sensible defaults. The goal: a complete real game's `main.ts` under 20 lines.

4. **Ship a starter template** — a `templates/starter/` folder (or a tiny `npm create` script) with canvas HTML, Vite config, an empty scene, and one sprite, so a new game is one copy away rather than reverse-engineered from `mode`.

5. **Make games shareable** — a GitHub Pages deploy of the demos, and a documented "deploy your game" path. Being able to send a link to a friend is rocket fuel for a kid's motivation, and it'll surface the WebGPU-availability question naturally.

6. **Consider a Canvas2D fallback renderer** behind a renderer interface. It's real work, but it's the one change that turns "works on my machine" into "works on grandma's iPad," and the `render(alpha)` seam plus `sampleRender` already give you most of the abstraction you'd need.

7. **Stop committing `dist/`** — `.gitignore` it and rely on the existing `prepack` build (keep it only if you intentionally support git-URL installs).

8. **Drop the Bun requirement** if feasible by moving tests to Node's built-in runner or Vitest, so the entire project needs exactly one runtime.

9. **Guard the beginner footguns** — default new entities to a visible size (or warn when a visible, zero-sized entity is added), and add a degrees-based rotation convenience.

10. **Document fast-bullet tunneling** at the default 20 Hz tick (a bullet moving 600 px/s travels 30 px per tick — more than a tile) and either suggest a higher `tickRate` for single-player games or add swept-AABB overlap later.

## Bottom line

As an engine, this is a well-architected, well-tested, honestly documented piece of work whose internals are themselves good teaching material — the fixed-timestep loop, the interpolation model, and the prediction/reconciliation netcode are all implemented the way the textbooks say to. As a learning vehicle for a 10-year-old, the foundation is better than it needs to be; the remaining work is almost entirely at the surface: recipes, less boilerplate, one-command scaffolding, and a way to share finished games. Tighten that top layer and this becomes a genuinely great way to learn programming.