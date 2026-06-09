import { fileURLToPath } from "node:url";
import { defineConfig, searchForWorkspaceRoot } from "vite";

/** Resolve a path relative to this config file. */
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Import the gamekit packages straight from TypeScript source (no build step).
// Aliasing each entry/subpath to its src index lets Vite transpile + HMR the
// engine itself; exact-match regexes keep the bare `gamekit` from swallowing
// the subpath imports.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^gamekit$/, replacement: here("../../packages/gamekit/src/index.ts") },
      { find: /^gamekit\/renderer$/, replacement: here("../../packages/gamekit/src/render/index.ts") },
      { find: /^gamekit\/input$/, replacement: here("../../packages/gamekit/src/input/index.ts") },
      { find: /^gamekit\/audio$/, replacement: here("../../packages/gamekit/src/audio/index.ts") },
      { find: /^gamekit\/net$/, replacement: here("../../packages/gamekit/src/net/index.ts") },
    ],
  },
  server: {
    // Allow serving the engine source that lives above this project.
    fs: { allow: [searchForWorkspaceRoot(process.cwd())] },
  },
});
