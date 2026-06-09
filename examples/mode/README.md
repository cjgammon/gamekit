# Mode

A gamekit demo inspired by Adam Atomic's **Mode** (the canonical Flixel
showcase) — a top-down arena shooter that exercises the whole engine end to end.
Built with **Vite**, importing the gamekit packages straight from TypeScript
source (no build step; HMR reaches into the engine).

Destroy the four enemy **spawners** in the corners before they overwhelm you.
Your score decays over time, so keep killing.

- **WASD** — move
- **Arrow keys** — shoot (twin-stick)
- **R** — restart (after win/lose)

## What it exercises

- **`Tilemap`** — the walled arena with pillar cover + per-tile collision.
- **`Group` recycling / pooling** — bullets, enemies (zero per-frame allocation).
- **`Emitter` / `Particle`** — explosions and impact sparks.
- **`Camera`** — follows the player, clamped to the arena, interpolated.
- **`InputManager`** — named move/aim/restart actions.
- **`Text` + `BitmapFont`** — the HUD and win/lose banner.
- **`AudioManager`** — procedural shoot/explosion SFX (WebAudio).
- **`Rng`** — seeded particle spread.

All assets (textures, font, sounds) are generated procedurally at runtime —
there are no binary asset files.

## Run

Requires a **WebGPU-capable browser** (Chrome/Edge, or Safari 18+).

```bash
# from the repo root
npm run demo:mode
# → Vite dev server; open the printed URL

# or directly
cd examples/mode && npx vite
```

`npx vite build` produces a static bundle in `dist/`.
