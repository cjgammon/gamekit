import { Game } from "../core/Game.js";
import { AssetLoader } from "./AssetLoader.js";
import { Canvas2DRenderer, type Canvas2DRendererOptions, type Canvas2DTexture } from "./Canvas2DRenderer.js";
import type { RenderGameConfig } from "./RenderGame.js";
/**
 * A {@link Game} wired to the {@link Canvas2DRenderer} — the no-WebGPU fallback.
 * Mirrors {@link RenderGame}'s API (same {@link RenderGameConfig}, `assets`,
 * `start`), so the same game code runs on either backend; prefer the
 * {@link createGame} factory, which picks WebGPU when available and falls back
 * to this. Construction is synchronous (no GPU device to acquire).
 */
export declare class Canvas2DGame extends Game {
    readonly renderer: Canvas2DRenderer;
    readonly assets: AssetLoader<Canvas2DTexture>;
    private _resizeObserver;
    private constructor();
    /** Build a Canvas2D game for `canvas`. Accepts the same config as
     *  {@link RenderGame.create} (explicit `width`/`height`, or `fov` fitting). */
    static create(canvas: HTMLCanvasElement, config: RenderGameConfig, options?: Canvas2DRendererOptions): Canvas2DGame;
    stop(): void;
    /** Stop the loop. Canvas2D holds no GPU device, so there's nothing extra to
     *  free — provided for parity with {@link RenderGame.destroy}. */
    destroy(): void;
    protected render(alpha: number): void;
    private static _fit;
    private static _dpr;
    private _enableAutoResize;
}
