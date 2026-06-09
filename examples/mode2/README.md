# Mode2

A faithful-as-possible port of the original [Mode](https://github.com/AdamAtomic/Mode)
by Adam Saltsman (Adam Atomic), using its real art + sound. Built with Vite,
importing the gamekit packages from TypeScript source.

Unlike [`../mode`](../mode) (a top-down placeholder), this reproduces Mode's
actual **platformer** gameplay and constants: gravity + run/drag + jumping, an
8px-tile 640×640 world, 8 wall-mounted spawners, flying bots, and a decaying
score that doubles as your life.

## Assets & attribution

The graphics and sounds are **© Adam Saltsman (Adam Atomic)**, from the original
Mode project: <https://github.com/AdamAtomic/Mode>. They are **not** committed to
this repo — `scripts/fetch-assets.mjs` downloads them from the original source on
demand into `public/data/` (gitignored). Please respect the original project's
terms; this is a learning/showcase port. (The HUD font is generated
procedurally — Mode used a system font.)

```bash
cd examples/mode2
npm run fetch-assets   # downloads the original PNG/MP3 media into public/data/
```

## Run

Requires a **WebGPU-capable browser** (Chrome/Edge, or Safari 18+) and the assets
fetched (above).

```bash
npm run demo:mode2     # from the repo root — Vite dev server; open the printed URL
```

- **← →** — walk
- **↑ / ↓** — aim up / aim down (down only while airborne)
- **X** (or Space) — jump
- **C** — shoot

## Ported mechanics (from Mode's source)

- **Player** physics: max velocity 80/200, drag 640, gravity 420, run accel 640,
  jump −200, downward-shot recoil −36 — driven by the engine's accel/drag/clamp
  motion model. Grounded check probes the tiles under the feet. Animations
  (`idle`/`run`/`jump` + `_up` aim variants) come from `spaceman.png` (8×8).
- **Score as life**: starts at 600, decays 100/sec, +200 per enemy, +1000 per
  spawner, −200 per hit (with brief i-frames + knockback). Score 0 = death.
- **8 spawners** down the side walls; destroy them all to win.
- **Flying bots** (`bot.png`, rotated live toward the player) that home and shoot.
- **Level**: border walls + dirt floor + random platform blocks, with dirt tile
  frames randomized for texture variety (like Mode's `FlxTileblock`).
- **Gibs**: textured particle bursts (`gibs.png` / `spawner_gibs.png`) with
  gravity, plus the real shoot/jump/hurt/explosion SFX.

## Asset → frame mapping

| Asset | Frame size | Use |
|---|---|---|
| `spaceman.png` 32×24 | 8×8 | player (animated) |
| `bot.png` 16×16 | single | enemy (rotated live) |
| `bullet.png` 64×8 | 8×8 | player bullet |
| `bot_bullet.png` 20×4 | 4×4 | enemy bullet |
| `spawner.png` 168×24 | 24×24 | spawner (`open` animation) |
| `dirt.png` 128×8 | 8×8 | terrain (random frame per cell) |
| `gibs.png` 30×6 | 6×6 | enemy gibs |
| `spawner_gibs.png` 48×12 | 12×12 | spawner gibs |

## Known divergences from the original

The engine doesn't replicate every Flixel feature, so a few things are
approximated: bots fly through terrain (no tile collision, as in Mode), bullet↔
wall collision is discrete (fast shots can clip thin walls), there's no
two-player/menu/victory-state flow, and the HUD is world-space rather than a
dedicated screen layer.
