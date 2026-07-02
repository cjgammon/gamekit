# gamekit site

Two pages: a marketing **landing page** with a playable live demo, and the
interactive **Get Started** tutorial — build a small game step by step with a
live, editable code editor and an instant preview.

```bash
npm run site        # from the repo root → Vite dev server
# or: npm run dev -w gamekit-site
```

- `/` (`index.html` → `src/Landing.tsx`) — the marketing page: hero copy, a
  playable demo, and links into the tutorial.
- `/get-started.html` (`src/GetStarted.tsx`) — the tutorial. Two tracks,
  switchable from the top bar (and deep-linkable via the URL hash — `#learn` /
  `#play`):
  - **🌱 Easy — play & tweak** (`#play` · `src/PlayTrack.tsx` +
    `src/tutorial/steps.ts`) — a working game per step with an achievement to
    earn by editing existing code. The default track.
  - **🚀 Advanced — type it out** (`#learn` · `src/LearnTrack.tsx` +
    `src/tutorial/codealong.ts`) — build the whole game from nothing, one small
    piece at a time, typing every line yourself, with every word (`const`,
    `class`, `new`, …) explained. The learner types each piece, presses **Check**
    (a forgiving comparison that ignores spacing, quotes, semicolons, optional
    trailing commas, and TS type annotations), and watches a read-only "program
    so far" grow and run at each milestone. **Fill it in** is the escape hatch.

## How it works

- **Vite + Preact**, three HTML entries (plus the sandbox iframe — four total,
  see `vite.config.ts`'s `rollupOptions.input`).
- Both tracks use a **CodeMirror** editor (`src/components/CodeEditor.tsx`).
  Editor code is **TypeScript**, transpiled to JS in the browser with
  **Sucrase** (`src/runner/transpile.ts`) — types are stripped, not checked.
- Both the tutorial and the landing page's live demo run their code in a
  **sandbox `<iframe>`** (`preview.html` + `src/preview-entry.ts`, driven by
  `src/components/Preview.tsx`). Re-running reloads the iframe, which tears down
  the old game loop / WebGPU device / input listeners and contains any error.
  The iframe exposes the gamekit API (`createGame`, `Scene`, `Entity`,
  `InputManager`, …) plus a `canvas` and a `hud(text)` helper **in scope**, so
  snippets need no imports.
- Previews use **`createGame`**, so they run on WebGPU or fall back to Canvas2D.
- The tutorial script lives in `src/tutorial/steps.ts` (the coin-collector from
  `docs/your-first-game.md`). The landing page's demo snippet lives in
  `src/demo/liveDemo.ts`.

## Build & deploy

`vite build site` outputs a static bundle (`site/dist`). CI publishes it as the
GitHub Pages root with the demos under `/demos/*` — see
`.github/workflows/pages.yml`. Set the base path with `SITE_BASE` (e.g.
`SITE_BASE=/gamekit/`).

## Planned

A second track: a **fake multiplayer** tutorial — a `ServerGame` plus two clients
wired over `createMemoryTransportPair()` entirely in the browser (real netcode, no
server).
