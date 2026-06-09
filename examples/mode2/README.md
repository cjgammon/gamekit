# Mode2

Same game as [`../mode`](../mode), but using the **original Mode art and sound**
instead of procedurally-generated placeholders. Built with Vite, importing the
gamekit packages from TypeScript source.

## Assets & attribution

The graphics and sounds are **© Adam Saltsman (Adam Atomic)**, from the original
Mode project: <https://github.com/AdamAtomic/Mode>. They are **not** committed to
this repo — `scripts/fetch-assets.mjs` downloads them from the original source on
demand into `public/data/` (gitignored). Please respect the original project's
terms; this is a learning/showcase port.

```bash
cd examples/mode2
npm run fetch-assets   # downloads the original PNG/MP3 media into public/data/
```

The HUD font is still generated procedurally (the original used a system font).

## Run

Requires a **WebGPU-capable browser** (Chrome/Edge, or Safari 18+), and the
assets fetched (above).

```bash
# from the repo root
npm run demo:mode2     # Vite dev server; open the printed URL

# or directly
cd examples/mode2 && npm run fetch-assets && npx vite
```

- **WASD** — move
- **Arrow keys** — shoot
- **R** — restart

## How the real assets map in

| Asset | Frames | Use |
|---|---|---|
| `spaceman.png` 32×24 | 8×8 | player, `idle`/`run` animations |
| `bot.png` 16×16 | single | enemy (rotated toward the player live) |
| `bullet.png` 64×8 | 8×8 | player bullet |
| `bot_bullet.png` 20×4 | 4×4 | enemy bullet |
| `spawner.png` 168×24 | 24×24 | spawner |
| `dirt.png` 128×8 | 8×8 | wall tiles (auto-tile sheet; frame 0 used) |
| `*.mp3` | — | shoot / enemy / explosion / hurt SFX |

Mode is a platformer in the original; this port keeps the top-down twin-stick
gameplay of `../mode` and simply swaps in the real media, so the art is used in a
different context than it was authored for.
