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
export declare class RenderView {
    /**
     * Warn (once per entity) when a visible entity has zero width or height, so
     * the classic "I added it but nothing shows" is self-explaining. Set false to
     * silence (e.g. if you intentionally keep sized-later placeholders visible).
     */
    static warnOnZeroSize: boolean;
    private readonly _renderer;
    private readonly _loader;
    private readonly _t;
    private readonly _uv;
    private readonly _inst;
    private _viewMinX;
    private _viewMinY;
    private _viewMaxX;
    private _viewMaxY;
    private readonly _corner;
    constructor(renderer: SpriteRenderer, loader: AssetLoader);
    /** Draw `scene` for this frame. `alpha` is `Game.render`'s 0..1 factor. */
    draw(scene: Scene, alpha: number): void;
    /** World-space AABB of the viewport (the 4 corners unprojected), for culling. */
    private _computeViewRect;
    private _drawGroup;
    private _drawEntity;
    /** Emit one instance per non-empty tile in view, resolving tile→frame UVs. */
    private _drawTilemap;
    /** Emit one instance per glyph of a Text, resolving glyph→frame UVs. */
    private _drawText;
}
