import { fileURLToPath } from "node:url";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import preact from "@preact/preset-vite";

/** Resolve a path relative to this config file. */
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Import the gamekit packages straight from TypeScript source (no build step) —
// same alias block the examples use, so the live previews run the real engine.
export default defineConfig({
  // GitHub Pages serves a project site under /<repo>/; overridden by the CI build.
  base: process.env.SITE_BASE ?? "/",
  plugins: [preact()],
  resolve: {
    alias: [
      { find: /^@cjgammon\/gamekit$/, replacement: here("../packages/gamekit/src/index.ts") },
      { find: /^@cjgammon\/gamekit\/renderer$/, replacement: here("../packages/gamekit/src/render/index.ts") },
      { find: /^@cjgammon\/gamekit\/input$/, replacement: here("../packages/gamekit/src/input/index.ts") },
      { find: /^@cjgammon\/gamekit\/audio$/, replacement: here("../packages/gamekit/src/audio/index.ts") },
      { find: /^@cjgammon\/gamekit\/net$/, replacement: here("../packages/gamekit/src/net/index.ts") },
    ],
  },
  server: {
    fs: { allow: [searchForWorkspaceRoot(process.cwd())] },
  },
  build: {
    rollupOptions: {
      // Two entry HTML files: the app, and the sandbox iframe.
      input: {
        main: here("index.html"),
        preview: here("preview.html"),
      },
    },
  },
});
