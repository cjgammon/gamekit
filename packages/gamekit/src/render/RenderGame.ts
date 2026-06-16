import { Game, type GameConfig } from "../core/Game.js";
import { AssetLoader } from "./AssetLoader.js";
import { RenderView } from "./RenderView.js";
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

interface Fit {
  width: number;
  height: number;
  /** Camera zoom, or null in explicit mode (leave each camera's own zoom). */
  zoom: number | null;
}

/**
 * A {@link Game} wired to the WebGPU renderer: it owns the renderer, an
 * {@link AssetLoader}, and a {@link RenderView}, and overrides the `render`
 * seam to draw the active scene each frame (interpolated by `alpha`).
 *
 * Browser-only. Construct with the async {@link create} (device acquisition is
 * async); then load assets via {@link assets}, `switchScene`, and `start`.
 */
export class RenderGame extends Game {
  readonly renderer: WebGPURenderer;
  readonly assets: AssetLoader;

  private readonly _view: RenderView;
  private _resizeObserver: ResizeObserver | null = null;

  private constructor(config: GameConfig, renderer: WebGPURenderer) {
    super(config);
    this.renderer = renderer;
    this.assets = new AssetLoader(renderer);
    this._view = new RenderView(renderer, this.assets);
    renderer.resize(this.width, this.height);
  }

  /** Acquire a WebGPU device for `canvas` and build the game. */
  static async create(
    canvas: HTMLCanvasElement,
    config: RenderGameConfig,
    options?: RendererOptions,
  ): Promise<RenderGame> {
    const renderer = await WebGPURenderer.create(canvas, options);
    const fit = RenderGame._fit(canvas, config);
    const game = new RenderGame(
      {
        width: fit.width,
        height: fit.height,
        tickRate: config.tickRate,
        defaultZoom: fit.zoom ?? undefined,
      },
      renderer,
    );
    if (config.fov !== undefined && config.autoResize) {
      game._enableAutoResize(canvas, config.fov, config.dpr ?? "auto");
    }
    return game;
  }

  /** Stop the loop and disconnect the resize observer. */
  override stop(): void {
    super.stop();
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
  }

  /** Stop the loop and release the WebGPU device + buffers. The game is unusable
   *  afterward — build a fresh one with {@link create} to run again. Call this on
   *  page/preview teardown so devices don't accumulate. */
  destroy(): void {
    this.stop();
    this.renderer.destroy();
  }

  protected override render(alpha: number): void {
    if (this.currentScene) this._view.draw(this.currentScene, alpha);
  }

  // ---- Sizing ----

  /** Resolve a config to a concrete backing size (+ zoom in fit mode). */
  private static _fit(
    canvas: HTMLCanvasElement,
    config: RenderGameConfig,
  ): Fit {
    if (config.fov !== undefined) {
      const dpr = RenderGame._dpr(config.dpr ?? "auto");
      const { cssW, cssH } = RenderGame._cssSize(canvas);
      const width = Math.max(1, Math.round(cssW * dpr));
      const height = Math.max(1, Math.round(cssH * dpr));
      return { width, height, zoom: width / config.fov };
    }
    return {
      width: config.width ?? canvas.width,
      height: config.height ?? canvas.height,
      zoom: null,
    };
  }

  private static _dpr(dpr: number | "auto"): number {
    if (dpr === "auto") {
      return typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    }
    return dpr;
  }

  /** Canvas CSS (display) size, falling back to the attribute size. */
  private static _cssSize(canvas: HTMLCanvasElement): {
    cssW: number;
    cssH: number;
  } {
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || canvas.clientWidth || canvas.width || 1;
    const cssH = rect.height || canvas.clientHeight || canvas.height || 1;
    return { cssW, cssH };
  }

  private _enableAutoResize(
    canvas: HTMLCanvasElement,
    fov: number,
    dpr: number | "auto",
  ): void {
    if (typeof ResizeObserver === "undefined") return;
    this._resizeObserver = new ResizeObserver(() => {
      const fit = RenderGame._fit(canvas, { fov, dpr });
      this._applyBackingSize(fit.width, fit.height, fit.zoom);
    });
    this._resizeObserver.observe(canvas);
  }

  /** Apply a new backing size (and zoom, in fit mode) to the renderer and the
   *  active scene's camera. Also updates {@link width}/{@link height} so a
   *  scene promoted later fits the current canvas. */
  private _applyBackingSize(
    width: number,
    height: number,
    zoom: number | null,
  ): void {
    this.width = width;
    this.height = height;
    this.renderer.resize(width, height);
    if (zoom !== null) this.defaultZoom = zoom;
    const cam = this.currentScene?.camera;
    if (cam) {
      cam.resize(width, height);
      if (zoom !== null) cam.zoom = zoom;
    }
  }
}
