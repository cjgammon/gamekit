import { Game } from "../core/Game.js";
import { AssetLoader } from "./AssetLoader.js";
import { Canvas2DRenderer, } from "./Canvas2DRenderer.js";
/**
 * A {@link Game} wired to the {@link Canvas2DRenderer} — the no-WebGPU fallback.
 * Mirrors {@link RenderGame}'s API (same {@link RenderGameConfig}, `assets`,
 * `start`), so the same game code runs on either backend; prefer the
 * {@link createGame} factory, which picks WebGPU when available and falls back
 * to this. Construction is synchronous (no GPU device to acquire).
 */
export class Canvas2DGame extends Game {
    constructor(config, renderer) {
        super(config);
        this._resizeObserver = null;
        this.renderer = renderer;
        this.assets = new AssetLoader(renderer);
        renderer.resize(this.width, this.height);
    }
    /** Build a Canvas2D game for `canvas`. Accepts the same config as
     *  {@link RenderGame.create} (explicit `width`/`height`, or `fov` fitting). */
    static create(canvas, config, options) {
        const renderer = new Canvas2DRenderer(canvas, options);
        const fit = Canvas2DGame._fit(canvas, config);
        const game = new Canvas2DGame({
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
    stop() {
        super.stop();
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
    }
    render(alpha) {
        if (this.currentScene) {
            this.renderer.draw(this.currentScene, alpha, this.assets);
        }
    }
    // ---- Sizing (mirrors RenderGame so the two backends fit identically) ----
    static _fit(canvas, config) {
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
    static _dpr(dpr) {
        if (dpr === "auto") {
            return typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        }
        return dpr;
    }
    _enableAutoResize(canvas, fov, dpr) {
        if (typeof ResizeObserver === "undefined")
            return;
        this._resizeObserver = new ResizeObserver(() => {
            const fit = Canvas2DGame._fit(canvas, { fov, dpr });
            this.width = fit.width;
            this.height = fit.height;
            this.renderer.resize(fit.width, fit.height);
            if (fit.zoom !== null)
                this.defaultZoom = fit.zoom;
            const cam = this.currentScene?.camera;
            if (cam) {
                cam.resize(fit.width, fit.height);
                if (fit.zoom !== null)
                    cam.zoom = fit.zoom;
            }
        });
        this._resizeObserver.observe(canvas);
    }
}
