# Bunnymark

A sprite stress test (à la the PixiJS bunnymark): thousands of colored sprites
falling and bouncing, with a live count + FPS readout. It's the perf-test surface
for the renderer — and it runs on **either backend**, so it doubles as a visual
check of the Canvas2D fallback.

```bash
npm run demo:bunnymark    # from the repo root — Vite dev server
```

- **Hold the mouse** on the canvas to add bunnies (500 per tick).
- Open with **`?canvas`** in the URL to force the **Canvas2D** backend; without
  it, `createGame` picks WebGPU when available. The HUD shows which backend is live.

## What it shows

- `createGame(canvas, config)` — the same scene runs on WebGPU or Canvas2D.
- Thousands of `Sprite`s sharing **one texture** (the 5-bunny sheet). On WebGPU
  they batch into a **single draw call**; on Canvas2D each is a `drawImage`, so
  it's the clearest way to compare the two backends.
- Motion via the engine's `acceleration`/`velocity` integration (gravity at a
  60 Hz fixed tick), with bounce handling in `fixedUpdate`.

## The sprite

`public/bunnys.png` is the classic **PixiJS bunnymark** sheet by Goodboy Digital
(<https://www.goodboydigital.com/pixijs/bunnymark/>) — 5 bunnies packed at
irregular rects. The demo repacks those rects into a uniform 26×37 strip in the
browser (gamekit uses a uniform frame grid), then each bunny picks a random
frame. If the image can't be loaded, bunnies fall back to colored boxes (the
built-in white texture + a `tint`), so the demo always runs.
