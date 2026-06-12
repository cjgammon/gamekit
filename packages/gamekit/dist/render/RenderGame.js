import { Game } from "../core/Game.js";
import { AssetLoader } from "./AssetLoader.js";
import { RenderView } from "./RenderView.js";
import { WebGPURenderer } from "./WebGPURenderer.js";
/**
 * A {@link Game} wired to the WebGPU renderer: it owns the renderer, an
 * {@link AssetLoader}, and a {@link RenderView}, and overrides the `render`
 * seam to draw the active scene each frame (interpolated by `alpha`).
 *
 * Browser-only. Construct with the async {@link create} (device acquisition is
 * async); then load assets via {@link assets}, `switchScene`, and `start`.
 */
export class RenderGame extends Game {
    constructor(config, renderer) {
        super(config);
        this._resizeObserver = null;
        this.renderer = renderer;
        this.assets = new AssetLoader(renderer);
        this._view = new RenderView(renderer, this.assets);
        renderer.resize(this.width, this.height);
    }
    /** Acquire a WebGPU device for `canvas` and build the game. */
    static async create(canvas, config, options) {
        const renderer = await WebGPURenderer.create(canvas, options);
        const fit = RenderGame._fit(canvas, config);
        const game = new RenderGame({
            width: fit.width,
            height: fit.height,
            tickRate: config.tickRate,
            defaultZoom: fit.zoom ?? undefined,
        }, renderer);
        if (config.fov !== undefined && config.autoResize) {
            game._enableAutoResize(canvas, config.fov, config.dpr ?? "auto");
        }
        return game;
    }
    /** Stop the loop and disconnect the resize observer. */
    stop() {
        super.stop();
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
    }
    render(alpha) {
        if (this.currentScene)
            this._view.draw(this.currentScene, alpha);
    }
    // ---- Sizing ----
    /** Resolve a config to a concrete backing size (+ zoom in fit mode). */
    static _fit(canvas, config) {
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
    static _dpr(dpr) {
        if (dpr === "auto") {
            return typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        }
        return dpr;
    }
    /** Canvas CSS (display) size, falling back to the attribute size. */
    static _cssSize(canvas) {
        const rect = canvas.getBoundingClientRect();
        const cssW = rect.width || canvas.clientWidth || canvas.width || 1;
        const cssH = rect.height || canvas.clientHeight || canvas.height || 1;
        return { cssW, cssH };
    }
    _enableAutoResize(canvas, fov, dpr) {
        if (typeof ResizeObserver === "undefined")
            return;
        this._resizeObserver = new ResizeObserver(() => {
            const fit = RenderGame._fit(canvas, { fov, dpr });
            this._applyBackingSize(fit.width, fit.height, fit.zoom);
        });
        this._resizeObserver.observe(canvas);
    }
    /** Apply a new backing size (and zoom, in fit mode) to the renderer and the
     *  active scene's camera. Also updates {@link width}/{@link height} so a
     *  scene promoted later fits the current canvas. */
    _applyBackingSize(width, height, zoom) {
        this.width = width;
        this.height = height;
        this.renderer.resize(width, height);
        if (zoom !== null)
            this.defaultZoom = zoom;
        const cam = this.currentScene?.camera;
        if (cam) {
            cam.resize(width, height);
            if (zoom !== null)
                cam.zoom = zoom;
        }
    }
}
