import type { Mat3 } from "../math/Mat3.js";
import type { Scene } from "../core/Scene.js";
import type { AssetLoader } from "./AssetLoader.js";
import type { SpriteBatcher } from "./SpriteBatcher.js";
import type { TextureEntry } from "./WebGPURenderer.js";
/** The slice of {@link WebGPURenderer} a view drives — fakeable in tests. */
export interface SpriteRenderer {
    readonly batcher: SpriteBatcher<TextureEntry>;
    beginFrame(viewProjection: Mat3): void;
    endFrame(): void;
}
/**
 * Bridges a {@link Scene} to the renderer each frame: walks the scene's entity
 * tree in draw order, computes each drawable's interpolated transform + frame
 * UVs, and feeds the batcher.
 *
 * Draw order is depth-first child order (Flixel z-model). A drawable is any
 * visible, non-zero-size leaf: `Sprite`s resolve `textureId`/`frame`/flips/tint;
 * plain `Entity`s draw as solid white quads (so boxes/blocks need no image).
 *
 * Scene-agnostic — pass whichever scene is active. All scratch objects are
 * reused, so a frame allocates nothing.
 */
export declare class RenderView {
    private readonly _renderer;
    private readonly _loader;
    private readonly _t;
    private readonly _uv;
    private readonly _inst;
    constructor(renderer: SpriteRenderer, loader: AssetLoader);
    /** Draw `scene` for this frame. `alpha` is `Game.render`'s 0..1 factor. */
    draw(scene: Scene, alpha: number): void;
    private _drawGroup;
    private _drawEntity;
}
