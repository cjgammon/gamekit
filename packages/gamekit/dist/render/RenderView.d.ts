import { Mat3 } from "../math/Mat3.js";
import type { Scene } from "../core/Scene.js";
import type { AssetLoader } from "./AssetLoader.js";
import type { SpriteBatcher } from "./SpriteBatcher.js";
import type { TextureEntry } from "./WebGPURenderer.js";
/** The slice of {@link WebGPURenderer} a view drives — fakeable in tests. */
export interface SpriteRenderer {
    readonly batcher: SpriteBatcher<TextureEntry>;
    /** Open a frame with the given projection. `clear` (default true) clears the
     *  target; pass false to draw on top of a prior pass (the HUD overlay). */
    beginFrame(viewProjection: Mat3, clear?: boolean): void;
    endFrame(): void;
}
export declare class RenderView {
    /**
     * Warn (once per entity) when a visible entity has zero width or height, so
     * the classic "I added it but nothing shows" is self-explaining. Set false to
     * silence (e.g. if you intentionally keep sized-later placeholders visible).
     */
    static warnOnZeroSize: boolean;
    /**
     * Skip entities whose (generously-padded) box falls outside the camera view —
     * a large world then costs only what's on screen. Disabled automatically when
     * the camera has no viewport (e.g. headless tests). Set false to draw all.
     */
    static cullSprites: boolean;
    private readonly _renderer;
    private readonly _loader;
    private readonly _t;
    private readonly _uv;
    private readonly _inst;
    private _viewMinX;
    private _viewMinY;
    private _viewMaxX;
    private _viewMaxY;
    private _viewValid;
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
