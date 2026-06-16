import { Game, type GameConfig } from "../core/Game.js";
import { AssetLoader } from "./AssetLoader.js";
import {
  Canvas2DRenderer,
  type Canvas2DRendererOptions,
  type Canvas2DTexture,
} from "./Canvas2DRenderer.js";
import type { RenderGameConfig } from "./RenderGame.js";

interface Fit {
  width: number;
  height: number;
  zoom: number | null;
}

/**
 * A {@link Game} wired to the {@link Canvas2DRenderer} — the no-WebGPU fallback.
 * Mirrors {@link RenderGame}'s API (same {@link RenderGameConfig}, `assets`,
 * `start`), so the same game code runs on either backend; prefer the
 * {@link createGame} factory, which picks WebGPU when available and falls back
 * to this. Construction is synchronous (no GPU device to acquire).
 */
export class Canvas2DGame extends Game {
  readonly renderer: Canvas2DRenderer;
  readonly assets: AssetLoader<Canvas2DTexture>;

  private _resizeObserver: ResizeObserver | null = null;

  private constructor(config: GameConfig, renderer: Canvas2DRenderer) {
    super(config);
    this.renderer = renderer;
    this.assets = new AssetLoader<Canvas2DTexture>(renderer);
    renderer.resize(this.width, this.height);
  }

  /** Build a Canvas2D game for `canvas`. Accepts the same config as
   *  {@link RenderGame.create} (explicit `width`/`height`, or `fov` fitting). */
  static create(
    canvas: HTMLCanvasElement,
    config: RenderGameConfig,
    options?: Canvas2DRendererOptions,
  ): Canvas2DGame {
    const renderer = new Canvas2DRenderer(canvas, options);
    const fit = Canvas2DGame._fit(canvas, config);
    const game = new Canvas2DGame(
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

  override stop(): void {
    super.stop();
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
  }

  /** Stop the loop. Canvas2D holds no GPU device, so there's nothing extra to
   *  free — provided for parity with {@link RenderGame.destroy}. */
  destroy(): void {
    this.stop();
  }

  protected override render(alpha: number): void {
    if (this.currentScene) {
      this.renderer.draw(this.currentScene, alpha, this.assets);
    }
  }

  // ---- Sizing (mirrors RenderGame so the two backends fit identically) ----

  private static _fit(canvas: HTMLCanvasElement, config: RenderGameConfig): Fit {
    if (config.fov !== undefined) {
      const dpr = Canvas2DGame._dpr(config.dpr ?? "auto");
      const rect = canvas.getBoundingClientRect();
      const cssW = rect.width || canvas.clientWidth || canvas.width || 1;
      const cssH = rect.height || canvas.clientHeight || canvas.height || 1;
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

  private _enableAutoResize(
    canvas: HTMLCanvasElement,
    fov: number,
    dpr: number | "auto",
  ): void {
    if (typeof ResizeObserver === "undefined") return;
    this._resizeObserver = new ResizeObserver(() => {
      const fit = Canvas2DGame._fit(canvas, { fov, dpr });
      this.width = fit.width;
      this.height = fit.height;
      this.renderer.resize(fit.width, fit.height);
      if (fit.zoom !== null) this.defaultZoom = fit.zoom;
      const cam = this.currentScene?.camera;
      if (cam) {
        cam.resize(fit.width, fit.height);
        if (fit.zoom !== null) cam.zoom = fit.zoom;
      }
    });
    this._resizeObserver.observe(canvas);
  }
}
