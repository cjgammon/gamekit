import { Game } from "../core/Game.js";
import { AssetLoader } from "./AssetLoader.js";
import { WebGPURenderer, type RendererOptions } from "./WebGPURenderer.js";
/**
 * Config for {@link RenderGame.create}. Two shapes are accepted:
 *
 * - **Explicit:** give `width`/`height` in backing pixels — the original,
 *   full-control path.
 * - **Fit-to-canvas:** give a `fov` (world units visible across the canvas
 *   width) and the engine derives the backing size from the canvas's CSS size ×
 *   device-pixel ratio, and a camera `zoom` so the field of view stays constant
 *   on any display. Set `autoResize` to keep it fitted as the canvas resizes.
 */
export interface RenderGameConfig {
    /** Backing width in pixels (explicit mode). Ignored when `fov` is set. */
    width?: number;
    /** Backing height in pixels (explicit mode). Ignored when `fov` is set. */
    height?: number;
    /** Fixed logic ticks per second. Default 20 — matches the server. */
    tickRate?: number;
    /** World units visible across the canvas width. Enables fit-to-canvas mode. */
    fov?: number;
    /** Device-pixel ratio for fit-to-canvas mode. `"auto"` (default) uses
     *  `window.devicePixelRatio`; pass a number to pin it (e.g. 1 for chunky
     *  pixels). */
    dpr?: number | "auto";
    /** In fit-to-canvas mode, re-fit the backing size + zoom when the canvas
     *  resizes (via `ResizeObserver`). Default false. */
    autoResize?: boolean;
}
/**
 * A {@link Game} wired to the WebGPU renderer: it owns the renderer, an
 * {@link AssetLoader}, and a {@link RenderView}, and overrides the `render`
 * seam to draw the active scene each frame (interpolated by `alpha`).
 *
 * Browser-only. Construct with the async {@link create} (device acquisition is
 * async); then load assets via {@link assets}, `switchScene`, and `start`.
 */
export declare class RenderGame extends Game {
    readonly renderer: WebGPURenderer;
    readonly assets: AssetLoader;
    private readonly _view;
    private _resizeObserver;
    private constructor();
    /** Acquire a WebGPU device for `canvas` and build the game. */
    static create(canvas: HTMLCanvasElement, config: RenderGameConfig, options?: RendererOptions): Promise<RenderGame>;
    /** Stop the loop and disconnect the resize observer. */
    stop(): void;
    protected render(alpha: number): void;
    /** Resolve a config to a concrete backing size (+ zoom in fit mode). */
    private static _fit;
    private static _dpr;
    /** Canvas CSS (display) size, falling back to the attribute size. */
    private static _cssSize;
    private _enableAutoResize;
    /** Apply a new backing size (and zoom, in fit mode) to the renderer and the
     *  active scene's camera. Also updates {@link width}/{@link height} so a
     *  scene promoted later fits the current canvas. */
    private _applyBackingSize;
}
