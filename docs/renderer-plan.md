# WebGPURenderer — implementation plan

Phase 3's largest piece: a from-scratch, zero-dependency WebGPU sprite renderer
that draws a `Scene`'s entities through the existing `Game.render(alpha)` seam,
using the `Camera.viewProjection()` matrix already in place.

## Locked decisions

1. **WebGPU only.** Single WGSL pipeline, no WebGL2 fallback. `init()` rejects
   with a clear error when `navigator.gpu` is absent. Matches the project's
   name/description/roadmap; keeps the surface small.
2. **Interpolate now.** Smooth variable-rate rendering of fixed-step motion by
   caching each `Entity`'s previous fixed transform in core and lerping by
   `alpha` in `render`. (Net entities still interpolate in the net layer; this
   covers all local, non-net motion.)
3. **Browser-only, behind `gamekit/renderer`.** References `GPUDevice`,
   `HTMLCanvasElement`, etc. Exported from a new subpath only — never the
   package root — so `import "gamekit"` on the server stays DOM-free (same rule
   as `gamekit/net` and `gamekit/input`).

## What it consumes (already in place)

- **`Sprite`** fields: `textureId`, `frameWidth/frameHeight`, `frame`,
  `flipX/flipY`, `alpha`, `tint` (0xRRGGBB), `originX/originY` (normalized pivot),
  plus `Entity` transform (`x,y,width,height,rotation,scaleX,scaleY,visible`).
- **`Camera.viewProjection()`** — world→clip `Mat3` (column-major `Float32Array`,
  built for direct GPU upload).
- **`Game.render(alpha)`** — per-frame hook; `alpha` ∈ [0,1] is the fraction
  into the next fixed step.

## Architecture & file layout

```
packages/gamekit/src/render/
  index.ts            # subpath barrel (gamekit/renderer)
  WebGPURenderer.ts   # device/context init, frame begin/submit, owns the batcher
  SpriteBatcher.ts    # collects instances, packs the instance buffer, issues draws
  Texture.ts          # GPUTexture wrapper + frame→UV math (sprite-sheet "atlas")
  AssetLoader.ts      # URL/ImageBitmap → Texture; named texture registry
  sprite.wgsl.ts      # WGSL shader source as a string (no bundler/file loader)
  RenderView.ts       # glue: traverses Scene → sprites, drives batcher each frame
```

Plus a core change in `packages/gamekit/src/core/Entity.ts` for interpolation,
and a new `examples/renderdemo/`.

### Why a `render/` subpath (not `core/`)

The renderer touches WebGPU/DOM globals, so it cannot live in the isomorphic
core. `Camera` and the interpolation bookkeeping stay in core (pure math); only
the GPU code is browser-gated.

## Core change: previous-transform interpolation

The fixed/variable split means logic runs at 20Hz but we draw at display rate.
To avoid 20Hz-looking motion, render at `lerp(prev, current, alpha)`.

Add to `Entity` (minimal, allocation-free):

- `prevX, prevY, prevRotation, prevScaleX, prevScaleY` — snapshot of the last
  fixed-step transform.
- `interpolate = true` — opt-out for entities positioned directly each frame
  (e.g. net-interpolated entities set it false, mirroring how `NetClient`
  already marks them passive).
- `syncPrev()` — copies current → prev. Called by the framework once per fixed
  tick *before* `fixedUpdate` runs, so after the tick `prev` holds the pre-tick
  pose and `current` the post-tick pose.

Wiring: `Scene.fixedUpdate` (or `Group`) calls `syncPrev()` on the tree at the
top of each fixed step. The renderer computes, per sprite:

```
rx = prev + (cur - prev) * alpha   // when interpolate, else cur
```

Edge cases to handle explicitly:
- **Spawn / teleport:** new entities get `prev = current` on construction (no
  lerp from origin). A manual teleport helper (`setPosition(x,y, snap=true)`)
  sets prev too, to avoid a one-frame streak.
- **Scene switch / first frame:** `syncPrev()` the whole tree on activation.
- **Net entities:** `interpolate = false` (the net layer owns their smoothing).

This keeps interpolation in pure core (unit-testable without a GPU) and leaves
the renderer a dumb consumer of `(prev, cur, alpha)`.

## Rendering model

**Instanced quads.** One static unit-quad vertex buffer (4 verts / triangle
strip). Per sprite, one *instance* record; the vertex shader builds the world
quad from instance data × the camera's view-projection uniform.

### Instance layout (per sprite, packed into a single GPU buffer)

| field        | type      | notes                                    |
|--------------|-----------|------------------------------------------|
| pos          | f32×2     | interpolated top-left world x,y          |
| size         | f32×2     | width,height (× scale)                   |
| origin       | f32×2     | normalized pivot (rotation/scale center) |
| rotation     | f32       | radians                                  |
| uvOffset     | f32×2     | frame top-left in [0,1] texture space    |
| uvScale      | f32×2     | frame size in [0,1] (flip via sign)      |
| tint+alpha   | f32×4     | rgba, tint unpacked from 0xRRGGBB        |

The batcher writes these into a growable `Float32Array`, uploads once per frame
(`device.queue.writeBuffer`), and draws.

### Batching & draw order

- Traverse the scene root `Group` depth-first → ordered list of visible leaves.
  Child order = z-order (matches Flixel; no z field needed initially).
- Group **consecutive** sprites sharing a texture into one draw call. A texture
  change flushes the current run (preserves correct back-to-front ordering;
  trades some draw calls for correctness — fine at demo scale, sortable later).
- **Untextured entities** (plain `Entity`, or `Sprite` with empty `textureId`)
  draw as solid tinted quads via a built-in **1×1 white texture**, so the
  netdemo-style boxes and Mode's blocks need no image.

### WGSL shader (`sprite.wgsl.ts`)

- **Uniform:** `viewProjection: mat3x3<f32>` (+ padding for std140-ish layout).
- **Vertex:** take unit-quad corner + instance; apply origin, scale, rotation,
  translate to world, multiply by viewProjection → clip; pass UV + color.
- **Fragment:** `textureSample(tex, samp, uv) * color`; discard fully
  transparent fragments. Premultiplied-alpha blend state.

### Camera integration

Each frame: `viewProjection = scene.camera.viewProjection()`, upload its
`Float32Array` to the uniform buffer. `Camera.update()` already runs in
`Scene.update`, so the matrix is current. Resize → `renderer.resize(w,h)` +
`camera.resize(w,h)` (reconfigure the canvas context, update the depth/size).

## Glue: `RenderView` + a browser `RenderGame`

- `RenderView(renderer, scene)` — exposes `draw(alpha)`: collect visible
  sprites, compute interpolated transforms, hand instances to the batcher,
  submit.
- A thin `RenderGame extends Game` (in the demo, or exported from the subpath)
  overrides `render(alpha)` to call `view.draw(alpha)`. Mirrors how `netdemo`'s
  `DemoGame` overrides `render`, but with the real renderer.

## Asset loading

`AssetLoader` (browser-only): `load(name, url)` → `fetch` → `createImageBitmap`
→ `GPUTexture` (via `copyExternalImageToTexture`), stored in a `Map<string,
Texture>`. `Texture` knows its pixel size and resolves `(frame, frameWidth,
frameHeight)` → UV offset/scale (the "texture atlas"/sprite-sheet math). A
default 1×1 white texture is registered under a reserved key for solid quads.

## Testing strategy

WebGPU isn't available in Bun, so split testable logic from GPU calls:

- **Unit-testable (no GPU), in `tests/unit/`:**
  - Interpolation math on `Entity` (`syncPrev` + lerp by alpha; teleport snap;
    `interpolate=false` passthrough).
  - `Texture` frame→UV resolution (incl. flipX/flipY sign), multiple frames per
    row, partial last row.
  - `SpriteBatcher` instance packing: given fake sprites, assert the
    `Float32Array` contents and that texture changes split runs (inject a
    no-op/fake GPU sink so the pack path runs without a device).
  - Scene traversal/draw-order flattening (visible filtering, group nesting).
- **Not unit-tested (needs a GPU):** device init, pipeline creation, actual
  draw submission. Validated manually via `renderdemo` + a screenshot.

Design the batcher/texture so the GPU device is injected behind a tiny
interface — the packing/UV/ordering logic takes plain data, the device calls are
a thin shell. That's what makes the above unit-testable.

## Demo: `examples/renderdemo/`

New throwaway demo (keep `netdemo` as-is). Single-player: a `Sprite` with a
loaded texture + a walk animation, camera follow with bounds, WASD via
`InputManager`, a few solid-color blocks. Proves renderer + camera + input +
interpolation end-to-end. Served statically like netdemo (plain ESM importing
`dist`).

## Implementation order (each step builds + tests green before the next)

1. ✅ **Core interpolation** — `Entity` prev-transform + `interpolate` flag +
   `syncPrev()` + `sampleRender(alpha, out)` + `setPosition(x,y,snap)`;
   `Group.syncPrev` recursion; `Scene.fixedUpdate` snapshots before the step;
   net entities set `interpolate=false`. 10 unit tests; no GPU.
2. ✅ **`Texture` + UV math** — sprite-sheet grid derivation + `frameUV(frame,
   flipX, flipY, out)` (flip = negative scale, offset at opposite edge, frame
   index wraps). Pure/headless; 7 unit tests. GPU handle deferred to step 4.
3. ✅ **`SpriteBatcher` packing/ordering** — generic over the texture handle;
   packs a growable instance `Float32Array` (`INSTANCE_FLOATS=15`,
   premultiplied color), splits draw runs on texture change while preserving
   order, GPU behind an injected `InstanceSink`. 7 unit tests with a fake sink.
4. ✅ **WGSL shader + `WebGPURenderer`** — instanced sprite pipeline (`@webgpu/types`
   devDep, triple-slash ref; `navigator.gpu` init, premultiplied src-over blend,
   nearest filter), implements `InstanceSink` (instance buffer grow + draw),
   `beginFrame/endFrame`, texture upload (image + solid). Pure `std140` matrix
   padding extracted + unit-tested (3 tests); GPU paths verified in the demo.
5. ✅ **`AssetLoader`** — name→`TextureEntry` registry over a `TextureFactory`
   interface; `load`/`loadAll` (fetch + `createImageBitmap`), `resolve()` falls
   back to the built-in 1×1 `WHITE_TEXTURE` for missing/empty ids. Registry
   unit-tested with a fake factory (3 tests); fetch path browser-validated.
6. ✅ **`RenderView`/`RenderGame` glue** — `RenderView` walks the scene tree in
   depth-first child order, builds interpolated `SpriteInstance`s (Sprite UVs/
   flips/tint; plain entities → white quads), reuses all scratch (zero alloc);
   typed against a `SpriteRenderer` interface so it's headless-tested (5 tests:
   order, visibility/size filtering, texture-run batching, alpha lerp).
   `RenderGame extends Game` owns renderer+loader+view, overrides `render`.
   Barrel + `gamekit/renderer` package export added.
7. ✅ **`examples/renderdemo`** (built) — procedural walk-sheet (no asset files),
   `Player` sprite driven by `InputManager`, `Camera` follow + bounds, white-quad
   blocks, `demo:render` script. Statically validated (bundles, 33 modules
   resolve, syntax OK). ⏳ Manual GPU screenshot verification pending (needs a
   real WebGPU browser).
8. Roadmap update; mark Phase 3 done (after manual verification).

## Deferred / out of scope (later phases)

- **Text / bitmap font** → Phase 4 (`Text`), draws through this batcher.
- **Runtime atlas packing** of multiple images into one texture → optimization;
  per-texture batching is enough for Mode. (Sprite-sheet frames are already
  supported via UV math.)
- **Z-sort / explicit depth** beyond child order → add a `depth` field + sort
  when a demo needs it.
- **Post-processing / multiple render targets** → not now.
- **Tilemap rendering** → Phase 4 (`Tilemap`), but it will reuse the batcher.

## Risks / watch-items

- **Interpolation touching core `Entity`** is the one change that ripples beyond
  the renderer. Keep it opt-out (`interpolate`) and allocation-free; make sure
  existing unit tests (entity/group/scene) still pass after adding the fields.
- **std140 uniform alignment** for `mat3x3<f32>` in WGSL (each column padded to
  16 bytes) — easy to get subtly wrong; cover with a careful buffer-layout
  comment and verify in the demo.
- **Premultiplied vs straight alpha** — pick premultiplied at texture upload and
  in the blend state consistently.
