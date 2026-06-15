# gamekit site

The interactive **Get Started** tutorial — build a small game step by step with a
live, editable code editor and an instant preview.

```bash
npm run site        # from the repo root → Vite dev server
# or: npm run dev -w gamekit-site
```

## How it works

- **Vite + Preact** app (`src/App.tsx`) with a **CodeMirror** editor
  (`src/components/CodeEditor.tsx`). Editor code is **TypeScript**, transpiled to
  JS in the browser with **Sucrase** (`src/runner/transpile.ts`) — types are
  stripped, not checked.
- Each preview runs in a **sandbox `<iframe>`** (`preview.html` +
  `src/preview-entry.ts`). Re-running reloads the iframe, which tears down the old
  game loop / WebGPU device / input listeners and contains any error. The iframe
  exposes the gamekit API (`createGame`, `Scene`, `Entity`, `InputManager`, …)
  plus a `canvas` and a `hud(text)` helper **in scope**, so tutorial snippets need
  no imports.
- Previews use **`createGame`**, so they run on WebGPU or fall back to Canvas2D.
- The tutorial script lives in `src/tutorial/steps.ts` (the coin-collector from
  `docs/your-first-game.md`).

## Build & deploy

`vite build site` outputs a static bundle (`site/dist`). CI publishes it as the
GitHub Pages root with the demos under `/demos/*` — see
`.github/workflows/pages.yml`. Set the base path with `SITE_BASE` (e.g.
`SITE_BASE=/gamekit/`).

## Planned

A second track: a **fake multiplayer** tutorial — a `ServerGame` plus two clients
wired over `createMemoryTransportPair()` entirely in the browser (real netcode, no
server).
