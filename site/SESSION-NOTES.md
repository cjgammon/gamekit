# Session notes — landing page + tutorial track merge (2026-07-02)

Working notes for merging `worktree-website` into `dev`. Delete this file once
the merge is done and reviewed — it's a handoff doc, not permanent project docs.

## What changed, and why

**1. Root page became a marketing landing page.**
The site used to open directly into the interactive tutorial. The ask was to
put a proper landing page at `/` — hero copy, a playable live demo, and links
into the tutorial — with the tutorial itself pushed to a sub-page.

- `site/index.html` / `src/Landing.tsx` / `src/landing.css` / `src/landing-main.tsx`
  — all new. Hero section, feature grid, a "start in one command" quick-start
  block (`npm create gamekit@latest`, plus a 9-line scene snippet), and a CTA
  band, all linking to `get-started.html`.
- `src/demo/liveDemo.ts` — new. The landing page's playable demo scene (coin
  collector with a particle burst + camera shake on pickup), run through the
  same sandboxed `preview.html` iframe the tutorial uses.
- The old `App.tsx` / `index.html` / `main.tsx` (the tutorial) were renamed to
  `GetStarted.tsx` / `get-started.html` / `get-started-main.tsx`.
- `vite.config.ts` — added `get-started.html` as a third Rollup entry.
- Copy was iterated per feedback to be short and beginner-focused (emphasis on
  "no setup," a real terminal command, and a tiny code sample) rather than
  feature-listing engine internals.

**2. Restored a second tutorial track that existed on `cj/site-update` but was
never merged.**
Partway through, it came up that a "write it yourself" advanced track had
already been built (commits `a679103`..`48f55b0` on `cj/site-update`, also
present on `dev`), but this branch (`worktree-website`) forked *before* that
work landed, so the new `GetStarted.tsx` didn't have it. Rather than a full
branch merge (which would've pulled in unrelated/unvetted engine commits from
`cj/site-update`), the track's files were ported by hand:

- `src/LearnTrack.tsx`, `src/tutorial/codealong.ts`,
  `src/components/SidebarToggle.tsx` — new, copied as-is from `cj/site-update`.
- `src/PlayTrack.tsx` — the original tutorial body (steps sidebar, mission bar,
  editor/preview workbench), split out of `GetStarted.tsx` so it could sit
  alongside `LearnTrack.tsx`.
- `src/GetStarted.tsx` — rewritten into a thin switcher between the two tracks,
  keyed off a `#play` / `#learn` URL hash, plus a `Home` link back to `/`
  (the Home link is new in this session; `cj/site-update`'s `App.tsx` didn't
  need one since it had no landing page to link to).
- `src/preview-entry.ts` — merged in the WebGPU-device-teardown-on-reload fix
  and the hud() postMessage dedupe from `cj/site-update`, on top of this
  branch's own addition of `Emitter`/`Particle` to the sandbox's exposed API
  (needed for the landing page's particle-burst demo).
- `src/styles.css` — replaced wholesale with `cj/site-update`'s version (this
  branch hadn't touched it, so it was a clean copy): sticky top bar, collapsible
  sidebar, page-scroll layout instead of a fixed-height app shell, plus the new
  `.trackswitch`/`.track-tab`/`.learn-*` rules.
- `src/landing.css` — adjusted `.landing`'s height rule to match the new
  document-scroll body model (`min-height: 100vh` instead of `height: 100%` +
  `overflow-y: auto`).

**Labeling**: the two tabs are **"🌱 Easy — play & tweak"** (the original
tutorial, default tab) and **"🚀 Advanced — type it out"** (the from-scratch
track). Note the order/framing was flipped once during this session — type-it-
out is the *advanced* track (you write every line yourself with no starter
code), play & tweak is *easy* (you edit working starter code toward a goal).
`cj/site-update`'s original `App.tsx` had no such framing, just "⌨️ Type it out"
/ "🛠️ Play & tweak" with Learn listed first — that ordering/labeling was
intentionally changed here.

## Where merge conflicts are likely, and what actually happened upstream

**`dev` has moved past `cj/site-update` by one more commit** that this port
did *not* pick up: `409ca53` *"site: share one typed message protocol between
the sandbox and its parent"*. It refactors the exact files this session also
touched:

- `site/src/preview-entry.ts` — dev extracts the postMessage shapes into a new
  `site/src/preview-protocol.ts` (typed, split by direction) that both
  `preview-entry.ts` and `components/Preview.tsx` import, replacing the
  hand-rolled inline message objects. **This branch's `preview-entry.ts` still
  has the old hand-rolled shapes** (plus the WebGPU-teardown/hud-dedupe logic
  ported from the earlier commit, and the `Emitter`/`Particle` scope
  additions this branch made on its own).
- `site/src/components/Preview.tsx` — dev updates it to use the new protocol
  types; this branch didn't touch this file at all, so it's still the
  original version.
- `site/src/PlayTrack.tsx` — dev has a small follow-up diff here too (part of
  the same protocol-typing commit).

**Recommended merge approach**: when merging `worktree-website` → `dev`, expect
`preview-entry.ts` to conflict. Take `dev`'s protocol-based version as the
base, then re-apply, on top of it:
1. This branch's `Emitter`/`Particle` additions to the sandbox `scope` object
   (needed by `src/demo/liveDemo.ts`'s particle burst).
2. Nothing else needs to move — the WebGPU teardown and hud dedupe are already
   in `dev` via `409ca53`'s ancestor commits.

`Preview.tsx` should not conflict (this branch never modified it) — just take
`dev`'s version; the landing page's `<Preview>` usage in `Landing.tsx` doesn't
depend on anything protocol-specific.

Everything else in this branch's diff (`Landing.tsx`, `landing.css`,
`landing-main.tsx`, `demo/liveDemo.ts`, `index.html`/`get-started.html` split,
`vite.config.ts`'s third entry) is net-new relative to `dev` and shouldn't
conflict — `dev` never built a landing page.

## Verification performed this session

- `npx tsc --noEmit -p site/tsconfig.json` — clean.
- `npx vite build site` — builds all three HTML entries with no errors.
- Headless Chromium (Playwright) against a live `vite site` dev server:
  landing page loads and the demo is playable (WASD moves the sprite); both
  `get-started.html` tracks render and switch cleanly; `Home` link returns to
  `/`; zero console errors throughout. Screenshots were inspected, not just
  captured.
- Not tested: production GitHub Pages build/deploy path (`.github/workflows/pages.yml`
  wasn't changed and shouldn't need to be, since it just builds `site` with
  `SITE_BASE` set — the new entries land at the same output root).
