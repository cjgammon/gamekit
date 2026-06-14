/**
 * Friendly handling for browsers without WebGPU. `RenderGame.create` throws when
 * `navigator.gpu` is missing; pair it with these so a shared link explains
 * itself instead of showing a blank canvas.
 *
 * Browser-only (touches `navigator`/`document`) — exported from the
 * `gamekit/renderer` subpath, never the package root.
 */
export declare const DEFAULT_UNSUPPORTED_MESSAGE = "This game needs WebGPU. Try Chrome or Edge (any recent version), or Safari 18+.";
/** True if the browser exposes a WebGPU entry point. */
export declare function isWebGPUAvailable(): boolean;
/**
 * Replace `canvas` with a friendly notice when WebGPU isn't available. Hides the
 * canvas and inserts a styled message in its place. Returns the inserted
 * element, or null if there's no DOM. Style it via the `.gamekit-unsupported`
 * class, or pass your own `message`.
 *
 * ```ts
 * if (!isWebGPUAvailable()) {
 *   mountUnsupportedNotice(canvas);
 * } else {
 *   const game = await RenderGame.create(canvas, { fov: 480 });
 *   // ...
 * }
 * ```
 */
export declare function mountUnsupportedNotice(canvas: HTMLCanvasElement, message?: string): HTMLElement | null;
