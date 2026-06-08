import { Game, type GameConfig } from "../core/Game.js";
import { AssetLoader } from "./AssetLoader.js";
import { WebGPURenderer, type RendererOptions } from "./WebGPURenderer.js";
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
    private constructor();
    /** Acquire a WebGPU device for `canvas` and build the game. */
    static create(canvas: HTMLCanvasElement, config: GameConfig, options?: RendererOptions): Promise<RenderGame>;
    protected render(alpha: number): void;
}
