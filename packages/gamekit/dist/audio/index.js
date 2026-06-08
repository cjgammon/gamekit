/**
 * gamekit/audio — WebAudio sound. `AudioManager` references browser globals
 * (`AudioContext`, `fetch`), so it is exported from this subpath only — never
 * the package root — keeping the headless server's `import "gamekit"` DOM-free
 * (same rule as `gamekit/net`, `gamekit/input`, and `gamekit/renderer`).
 */
export { AudioManager } from "./AudioManager.js";
