/**
 * Packs per-sprite draw data into one instance buffer and groups consecutive
 * sprites that share a texture into single draw calls — the CPU half of the
 * sprite pipeline.
 *
 * The GPU is abstracted behind {@link InstanceSink} (buffer upload + draw), so
 * all of the packing, color math, and run-batching here is exercised headless
 * with a fake sink; the real `WebGPURenderer` provides the GPU-backed sink.
 *
 * Generic over the texture handle `T`: tests use strings, the renderer uses a
 * struct holding the `GPUTexture` + its bind group. Runs split on `!==`, so the
 * caller must hand back stable handles for the same texture.
 *
 * Draw order is preserved: a texture change flushes the current run rather than
 * reordering, so back-to-front layering (child order) stays correct. Sorting by
 * texture to cut draw calls is a later optimization.
 */
/** Floats per instance — must match the vertex buffer layout in the shader. */
export declare const INSTANCE_FLOATS = 15;
/** One sprite's draw data, in interpolated world space. */
export interface SpriteInstance<T> {
    /** Texture handle; identity (`!==`) decides run boundaries. */
    texture: T;
    x: number;
    y: number;
    width: number;
    height: number;
    /** Normalized rotation/scale pivot (0.5 = center). */
    originX: number;
    originY: number;
    rotation: number;
    /** Frame UVs from `Texture.frameUV` (scale may be negative for flips). */
    u: number;
    v: number;
    uScale: number;
    vScale: number;
    /** Multiplicative tint as 0xRRGGBB. */
    tint: number;
    /** 0..1 opacity. */
    alpha: number;
}
/** A contiguous span of instances drawn with one texture. */
export interface DrawRun<T> {
    texture: T;
    first: number;
    count: number;
}
/** The GPU operations the batcher needs, injected so it can run headless. */
export interface InstanceSink<T> {
    /** Upload the first `count` instances (each {@link INSTANCE_FLOATS} floats). */
    writeInstances(data: Float32Array, count: number): void;
    /** Draw `count` instances starting at `first`, bound to `texture`. */
    draw(texture: T, first: number, count: number): void;
}
export declare class SpriteBatcher<T> {
    private readonly _sink;
    private _data;
    private _count;
    private _runs;
    private _current;
    constructor(sink: InstanceSink<T>, initialCapacity?: number);
    /** Instances added since the last {@link begin}. */
    get instanceCount(): number;
    /** The packed instance buffer (full backing store; use `instanceCount`). */
    get data(): Float32Array;
    /** Draw runs accumulated this frame (finalized in {@link end}). */
    get runs(): ReadonlyArray<DrawRun<T>>;
    /** Start a frame: clear instances and runs. */
    begin(): void;
    /** Append one sprite. Extends the current run or opens a new one on texture change. */
    add(s: SpriteInstance<T>): void;
    /** Finish the frame: close the last run, upload once, issue one draw per run. */
    end(): void;
    private _writeInstance;
    private _ensureCapacity;
}
