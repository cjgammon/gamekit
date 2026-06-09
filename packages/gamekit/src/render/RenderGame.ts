import { Game, type GameConfig } from "../core/Game.js";
import { AssetLoader } from "./AssetLoader.js";
import { RenderView } from "./RenderView.js";
import { WebGPURenderer, type RendererOptions } from "./WebGPURenderer.js";

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
    config: GameConfig,
    options?: RendererOptions,
  ): Promise<RenderGame> {
    const renderer = await WebGPURenderer.create(canvas, options);
    return new RenderGame(config, renderer);
  }

  protected override render(alpha: number): void {
    if (this.currentScene) this._view.draw(this.currentScene, alpha);
  }
}
