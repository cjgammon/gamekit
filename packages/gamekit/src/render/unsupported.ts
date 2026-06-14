/// <reference types="@webgpu/types" />
/**
 * Friendly handling for browsers without WebGPU. `RenderGame.create` throws when
 * `navigator.gpu` is missing; pair it with these so a shared link explains
 * itself instead of showing a blank canvas.
 *
 * Browser-only (touches `navigator`/`document`) — exported from the
 * `gamekit/renderer` subpath, never the package root.
 */

export const DEFAULT_UNSUPPORTED_MESSAGE =
  "This game needs WebGPU. Try Chrome or Edge (any recent version), or Safari 18+.";

/** True if the browser exposes a WebGPU entry point. */
export function isWebGPUAvailable(): boolean {
  return typeof navigator !== "undefined" && !!navigator.gpu;
}

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
export function mountUnsupportedNotice(
  canvas: HTMLCanvasElement,
  message: string = DEFAULT_UNSUPPORTED_MESSAGE,
): HTMLElement | null {
  if (typeof document === "undefined") return null;

  const notice = document.createElement("div");
  notice.className = "gamekit-unsupported";
  notice.setAttribute("role", "alert");
  notice.textContent = message;
  // Inline defaults so it's readable without any CSS; overridable by the class.
  notice.style.cssText = [
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "text-align:center",
    "padding:1.5rem",
    "max-width:32rem",
    "line-height:1.5",
    "font:16px/1.5 system-ui,sans-serif",
    "color:#ddd",
    "background:#14141c",
    "border:1px solid #333",
    "border-radius:8px",
  ].join(";");

  canvas.style.display = "none";
  canvas.insertAdjacentElement("afterend", notice);
  return notice;
}
