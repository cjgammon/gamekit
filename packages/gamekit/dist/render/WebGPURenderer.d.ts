import type { Mat3 } from "../math/Mat3.js";
import { Texture } from "./Texture.js";
import { SpriteBatcher, type InstanceSink } from "./SpriteBatcher.js";
/** A GPU-resident texture paired with its UV metadata and bind group. This is
 *  the handle the {@link SpriteBatcher} batches on. */
export interface TextureEntry {
    /** Sprite-sheet UV metadata (sizes, frame grid). */
    meta: Texture;
    gpu: GPUTexture;
    /** Group-1 bind group (texture + sampler) for this texture. */
    bindGroup: GPUBindGroup;
}
export interface RendererOptions {
    /** Texture filtering. `"nearest"` (default) keeps pixel art crisp. */
    filter?: "nearest" | "linear";
    /** Background clear color (premultiplied). Default opaque black. */
    clearColor?: GPUColor;
}
/**
 * From-scratch WebGPU sprite renderer. Owns the device, pipeline, and buffers,
 * and implements {@link InstanceSink} so its {@link batcher} can upload + draw.
 *
 * Browser-only (references `navigator.gpu`, `GPU*`); exported from
 * `gamekit/renderer`, never the package root. Construct via {@link create}.
 *
 * Frame: `beginFrame(vp)` → push sprites through `batcher` → `endFrame()`.
 */
export declare class WebGPURenderer implements InstanceSink<TextureEntry> {
    readonly batcher: SpriteBatcher<TextureEntry>;
    clearColor: GPUColor;
    private readonly _device;
    private readonly _context;
    private readonly _canvas;
    private readonly _pipeline;
    private readonly _sampler;
    private readonly _uniformBuffer;
    private readonly _cameraBindGroup;
    private readonly _quadBuffer;
    private readonly _uniformScratch;
    private _instanceBuffer;
    private _instanceCapacityFloats;
    private _encoder;
    private _pass;
    private constructor();
    /** Acquire a device + configure the canvas context. Rejects if WebGPU is
     *  unavailable. */
    static create(canvas: HTMLCanvasElement, options?: RendererOptions): Promise<WebGPURenderer>;
    /** The GPU device, for callers that need to create their own resources. */
    get device(): GPUDevice;
    /** Resize the drawing buffer to match a CSS/display size. */
    resize(width: number, height: number): void;
    /** Begin a frame: upload the camera matrix and open the render pass. */
    beginFrame(viewProjection: Mat3): void;
    /** End the frame: close the pass and submit. */
    endFrame(): void;
    writeInstances(data: Float32Array, count: number): void;
    draw(texture: TextureEntry, first: number, count: number): void;
    /** Upload an `ImageBitmap` (premultiplied) into a sampleable texture. */
    createTextureFromImage(image: ImageBitmap, frameWidth?: number, frameHeight?: number): TextureEntry;
    /** Create a solid-color texture from premultiplied RGBA bytes (default 1×1
     *  white — the surface untextured/solid quads sample). */
    createSolidTexture(rgba?: Uint8Array, width?: number, height?: number): TextureEntry;
    private _entry;
}
