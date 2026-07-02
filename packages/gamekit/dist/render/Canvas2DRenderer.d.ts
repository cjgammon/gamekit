import type { Camera } from "../core/Camera.js";
import type { Scene } from "../core/Scene.js";
import { Texture } from "./Texture.js";
import type { AssetLoader, TextureFactory } from "./AssetLoader.js";
import { type DrawSink, type RenderPass } from "./SceneWalker.js";
import type { SpriteInstance } from "./SpriteBatcher.js";
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
 * without WebGPU. A thin {@link DrawSink} adapter: the {@link SceneWalker}
 * (shared with the WebGPU `RenderView`) does the scene traversal, culling, and
 * entity-kind dispatch; this class only knows how to turn a drawable into a
 * `ctx.drawImage()` call and a pass into a transform + optional clear.
 *
 * Browser-only (`CanvasRenderingContext2D`); exported from `gamekit/renderer`.
 * Implements {@link TextureFactory} so an {@link AssetLoader} can load into it.
 *
 * Parity notes vs. WebGPU: alpha, rotation, origin, sprite-sheet frames, flips,
 * and multiplicative tint (via a cached tinted copy) match exactly — both
 * backends consume the same {@link SpriteInstance} shape from the walker. Flips
 * are decoded from the instance's UV sign (negative `uScale`/`vScale`) rather
 * than a `flipX`/`flipY` flag, since `emit()` never sees the source entity.
 * Per-sprite `drawImage` is slower than the instanced GPU path — fine for
 * typical 2D scenes, not for tens of thousands.
 */
export declare class Canvas2DRenderer implements TextureFactory<Canvas2DTexture>, DrawSink<Canvas2DTexture> {
    readonly ctx: CanvasRenderingContext2D;
    clearColor: string;
    private readonly _canvas;
    private readonly _smoothing;
    private _walker;
    constructor(canvas: HTMLCanvasElement, options?: Canvas2DRendererOptions);
    /** Resize the drawing buffer. */
    resize(width: number, height: number): void;
    /** Draw `scene` for this frame. `alpha` is `Game.render`'s 0..1 factor. */
    draw(scene: Scene, alpha: number, loader: AssetLoader<Canvas2DTexture>): void;
    beginPass(camera: Camera, alpha: number, pass: RenderPass, clear: boolean): void;
    emit(inst: SpriteInstance<Canvas2DTexture>): void;
    endPass(): void;
    createTextureFromImage(image: ImageBitmap, frameWidth?: number, frameHeight?: number): Canvas2DTexture;
    createSolidTexture(rgba?: Uint8Array, width?: number, height?: number): Canvas2DTexture;
    /** Set the 2D transform from a column-major {@link Mat3} (world → screen). */
    private _setMatrix;
    /** A multiplicatively-tinted copy of a texture, cached per tint. */
    private _tinted;
}
