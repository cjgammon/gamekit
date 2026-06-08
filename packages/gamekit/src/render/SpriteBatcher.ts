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
export const INSTANCE_FLOATS = 15;

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

export class SpriteBatcher<T> {
  private readonly _sink: InstanceSink<T>;
  private _data: Float32Array;
  private _count = 0;
  private _runs: DrawRun<T>[] = [];
  private _current: DrawRun<T> | null = null;

  constructor(sink: InstanceSink<T>, initialCapacity = 256) {
    this._sink = sink;
    this._data = new Float32Array(initialCapacity * INSTANCE_FLOATS);
  }

  /** Instances added since the last {@link begin}. */
  get instanceCount(): number {
    return this._count;
  }

  /** The packed instance buffer (full backing store; use `instanceCount`). */
  get data(): Float32Array {
    return this._data;
  }

  /** Draw runs accumulated this frame (finalized in {@link end}). */
  get runs(): ReadonlyArray<DrawRun<T>> {
    return this._runs;
  }

  /** Start a frame: clear instances and runs. */
  begin(): void {
    this._count = 0;
    this._runs = [];
    this._current = null;
  }

  /** Append one sprite. Extends the current run or opens a new one on texture change. */
  add(s: SpriteInstance<T>): void {
    this._ensureCapacity(this._count + 1);
    this._writeInstance(s);

    if (this._current && this._current.texture === s.texture) {
      this._current.count++;
    } else {
      if (this._current) this._runs.push(this._current);
      this._current = { texture: s.texture, first: this._count, count: 1 };
    }
    this._count++;
  }

  /** Finish the frame: close the last run, upload once, issue one draw per run. */
  end(): void {
    if (this._current) {
      this._runs.push(this._current);
      this._current = null;
    }
    if (this._count === 0) return;
    this._sink.writeInstances(this._data, this._count);
    for (const run of this._runs) {
      this._sink.draw(run.texture, run.first, run.count);
    }
  }

  // ---- Internal ----

  private _writeInstance(s: SpriteInstance<T>): void {
    const d = this._data;
    let o = this._count * INSTANCE_FLOATS;
    d[o++] = s.x;
    d[o++] = s.y;
    d[o++] = s.width;
    d[o++] = s.height;
    d[o++] = s.originX;
    d[o++] = s.originY;
    d[o++] = s.rotation;
    d[o++] = s.u;
    d[o++] = s.v;
    d[o++] = s.uScale;
    d[o++] = s.vScale;
    // Premultiplied RGBA, so the shader can blend with src-over against
    // premultiplied textures: rgb *= a.
    const a = s.alpha;
    d[o++] = (((s.tint >> 16) & 0xff) / 255) * a;
    d[o++] = (((s.tint >> 8) & 0xff) / 255) * a;
    d[o++] = ((s.tint & 0xff) / 255) * a;
    d[o] = a;
  }

  private _ensureCapacity(instances: number): void {
    const needed = instances * INSTANCE_FLOATS;
    if (needed <= this._data.length) return;
    let len = this._data.length;
    while (len < needed) len *= 2;
    const grown = new Float32Array(len);
    grown.set(this._data);
    this._data = grown;
  }
}
