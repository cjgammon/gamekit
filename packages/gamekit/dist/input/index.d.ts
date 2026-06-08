/**
 * gamekit/input — browser input. `InputManager` references DOM globals
 * (`window`, `KeyboardEvent`, `navigator.getGamepads`) in its event/poll
 * methods, so it is exported from this subpath only — never the package root —
 * keeping the headless server's `import "gamekit"` DOM-free.
 */
export { InputManager } from "./InputManager.js";
