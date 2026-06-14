import { defineConfig } from "vitest/config";

// Vitest runs on Node (one runtime for the whole project) and resolves the
// engine's `.js` import specifiers to their `.ts` sources via Vite's resolver —
// the same way the examples build. Tests import { describe, test, expect } from
// "vitest"; no globals.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/net/**/*.test.ts"],
    testTimeout: 30000,
  },
});
