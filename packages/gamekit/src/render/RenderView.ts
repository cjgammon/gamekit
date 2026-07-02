import { Mat3 } from "../math/Mat3.js";
import type { Camera } from "../core/Camera.js";
import type { Scene } from "../core/Scene.js";
import type { AssetLoader } from "./AssetLoader.js";
import { SceneWalker, type DrawSink, type RenderPass } from "./SceneWalker.js";
import type { SpriteBatcher, SpriteInstance } from "./SpriteBatcher.js";
import type { TextureEntry } from "./WebGPURenderer.js";

/** The slice of {@link WebGPURenderer} a view drives — fakeable in tests. */
export interface SpriteRenderer {
  readonly batcher: SpriteBatcher<TextureEntry>;
  /** Open a frame with the given projection. `clear` (default true) clears the
   *  target; pass false to draw on top of a prior pass (the HUD overlay). */
  beginFrame(viewProjection: Mat3, clear?: boolean): void;
  endFrame(): void;
}

/**
 * Bridges a {@link Scene} to the WebGPU renderer each frame. A thin
 * {@link DrawSink} adapter: the {@link SceneWalker} does the scene traversal,
 * culling, and entity-kind dispatch; this class only knows how to turn a
 * drawable into a `batcher.add()` call and a pass into a `beginFrame`/
 * `endFrame` pair with the right projection.
 */
export class RenderView implements DrawSink<TextureEntry> {
  private readonly _renderer: SpriteRenderer;
  private readonly _walker: SceneWalker<TextureEntry>;

  constructor(renderer: SpriteRenderer, loader: AssetLoader) {
    this._renderer = renderer;
    this._walker = new SceneWalker(loader);
  }

  /** Draw `scene` for this frame. `alpha` is `Game.render`'s 0..1 factor. */
  draw(scene: Scene, alpha: number): void {
    this._walker.walk(scene, alpha, this);
  }

  // ---- DrawSink<TextureEntry> ----

  beginPass(camera: Camera, alpha: number, pass: RenderPass, clear: boolean): void {
    const projection =
      pass === "world"
        ? camera.viewProjection(alpha)
        : Mat3.ortho(camera.viewportWidth, camera.viewportHeight);
    this._renderer.beginFrame(projection, clear);
    this._renderer.batcher.begin();
  }

  emit(inst: SpriteInstance<TextureEntry>): void {
    this._renderer.batcher.add(inst);
  }

  endPass(): void {
    this._renderer.batcher.end();
    this._renderer.endFrame();
  }
}
