# renderdemo

Throwaway demo validating the WebGPU renderer end-to-end: a textured, animated
`Sprite` driven by `InputManager`, a camera that follows the player with world
bounds, render interpolation of fixed-step motion, and solid-color blocks
(plain entities → the built-in white texture).

No asset files — the walk sheet is drawn procedurally to a canvas and uploaded
as a texture. No server (single-player).

## Run

Requires a **WebGPU-capable browser** (Chrome/Edge, or Safari 18+).

```bash
npm run build                 # build gamekit (incl. the renderer subpath)
python3 -m http.server 8080   # serve the repo root
# open http://localhost:8080/examples/renderdemo/
```

WASD / arrow keys / gamepad to move. The little character animates while
walking; the camera follows it and stops at the world edges; the grid of white
blocks stays put, so the interpolation and camera motion are easy to see.

## What it exercises

- `RenderGame` (async device init) + `Game.render(alpha)` interpolation seam.
- `WebGPURenderer` instanced sprite pipeline + premultiplied blending.
- `AssetLoader` / `createTextureFromImage` (sheet) + the white texture (blocks).
- `Sprite` frames/animation; `Camera` follow + bounds; `InputManager` actions.
