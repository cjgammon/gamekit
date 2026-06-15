import type { Scene } from "../core/Scene.js";
import { Texture } from "./Texture.js";
import type { AssetLoader, TextureFactory } from "./AssetLoader.js";
/**
 * A texture handle for the Canvas2D backend: the frame metadata plus a drawable
 * source (a `<canvas>` so it survives `ImageBitmap.close()` and can be tinted).
 */
export interface Canvas2DTexture {
    meta: Texture;
    source: CanvasImageSource;
    /** Lazily-filled cache of tinted copies, keyed by 0xRRGGBB. */
    tintCache?: Map<number, CanvasImageSource>;
}
export interface Canvas2DRendererOptions {
    /** `"nearest"` (default) keeps pixel art crisp; `"linear"` smooths. */
    filter?: "nearest" | "linear";
    /** Background clear color (any CSS color). Default black. */
    clearColor?: string;
}
/**
 * A from-scratch **Canvas2D** renderer — the fallback for browsers/devices
 * without WebGPU. It walks the scene like the WebGPU `RenderView` (world pass
 * under the camera transform, then a screen-space HUD pass) but draws each
 * sprite immediately with `drawImage` instead of instancing.
 *
 * Browser-only (`CanvasRenderingContext2D`); exported from `gamekit/renderer`.
 * Implements {@link TextureFactory} so an {@link AssetLoader} can load into it.
 *
 * Parity notes vs. WebGPU: alpha, rotation, origin, sprite-sheet frames, and
 * multiplicative tint (via a cached tinted copy) match. Flips assume a centered
 * origin (the `Sprite` default). Per-sprite `drawImage` is slower than the
 * instanced GPU path — fine for typical 2D scenes, not for tens of thousands.
 */
export declare class Canvas2DRenderer implements TextureFactory<Canvas2DTexture> {
    readonly ctx: CanvasRenderingContext2D;
    clearColor: string;
    private readonly _canvas;
    private readonly _smoothing;
    private readonly _t;
    private _viewMinX;
    private _viewMinY;
    private _viewMaxX;
    private _viewMaxY;
    private readonly _corner;
    constructor(canvas: HTMLCanvasElement, options?: Canvas2DRendererOptions);
    /** Resize the drawing buffer. */
    resize(width: number, height: number): void;
    /** Draw `scene` for this frame. `alpha` is `Game.render`'s 0..1 factor. */
    draw(scene: Scene, alpha: number, loader: AssetLoader<Canvas2DTexture>): void;
    createTextureFromImage(image: ImageBitmap, frameWidth?: number, frameHeight?: number): Canvas2DTexture;
    createSolidTexture(rgba?: Uint8Array, width?: number, height?: number): Canvas2DTexture;
    /** Set the 2D transform from a column-major {@link Mat3} (world → screen). */
    private _setMatrix;
    private _computeViewRect;
    private _drawGroup;
    private _drawEntity;
    private _drawTilemap;
    private _drawText;
    /** A multiplicatively-tinted copy of a texture, cached per tint. */
    private _tinted;
}
