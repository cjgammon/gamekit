import { Texture } from "./Texture.js";
import { INSTANCE_FLOATS, SpriteBatcher, } from "./SpriteBatcher.js";
import { SPRITE_WGSL } from "./sprite.wgsl.js";
import { MAT3_STD140_FLOATS, packMat3Std140 } from "./std140.js";
const BYTES_PER_INSTANCE = INSTANCE_FLOATS * 4;
/** Unit-quad corners as a triangle strip (covers [0,1]²). */
const QUAD = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
/**
 * From-scratch WebGPU sprite renderer. Owns the device, pipeline, and buffers,
 * and implements {@link InstanceSink} so its {@link batcher} can upload + draw.
 *
 * Browser-only (references `navigator.gpu`, `GPU*`); exported from
 * `gamekit/renderer`, never the package root. Construct via {@link create}.
 *
 * Frame: `beginFrame(vp)` → push sprites through `batcher` → `endFrame()`.
 */
export class WebGPURenderer {
    constructor(device, context, canvas, format, options) {
        this._uniformScratch = new Float32Array(MAT3_STD140_FLOATS);
        // Per-frame, valid between beginFrame and endFrame.
        this._encoder = null;
        this._pass = null;
        this._device = device;
        this._context = context;
        this._canvas = canvas;
        this.clearColor = options.clearColor ?? { r: 0, g: 0, b: 0, a: 1 };
        const module = device.createShaderModule({ code: SPRITE_WGSL });
        this._pipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module,
                entryPoint: "vs_main",
                buffers: [
                    // 0: static unit quad.
                    {
                        arrayStride: 8,
                        stepMode: "vertex",
                        attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
                    },
                    // 1: per-instance sprite data (matches SpriteBatcher layout).
                    {
                        arrayStride: BYTES_PER_INSTANCE,
                        stepMode: "instance",
                        attributes: [
                            { shaderLocation: 1, offset: 0, format: "float32x2" }, // pos
                            { shaderLocation: 2, offset: 8, format: "float32x2" }, // size
                            { shaderLocation: 3, offset: 16, format: "float32x2" }, // origin
                            { shaderLocation: 4, offset: 24, format: "float32" }, // rotation
                            { shaderLocation: 5, offset: 28, format: "float32x2" }, // uvOffset
                            { shaderLocation: 6, offset: 36, format: "float32x2" }, // uvScale
                            { shaderLocation: 7, offset: 44, format: "float32x4" }, // color
                        ],
                    },
                ],
            },
            fragment: {
                module,
                entryPoint: "fs_main",
                targets: [
                    {
                        format,
                        // Premultiplied src-over.
                        blend: {
                            color: {
                                srcFactor: "one",
                                dstFactor: "one-minus-src-alpha",
                                operation: "add",
                            },
                            alpha: {
                                srcFactor: "one",
                                dstFactor: "one-minus-src-alpha",
                                operation: "add",
                            },
                        },
                    },
                ],
            },
            primitive: { topology: "triangle-strip" },
        });
        this._sampler = device.createSampler({
            magFilter: options.filter ?? "nearest",
            minFilter: options.filter ?? "nearest",
        });
        this._uniformBuffer = device.createBuffer({
            size: MAT3_STD140_FLOATS * 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this._cameraBindGroup = device.createBindGroup({
            layout: this._pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this._uniformBuffer } }],
        });
        this._quadBuffer = device.createBuffer({
            size: QUAD.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this._quadBuffer, 0, QUAD);
        this._instanceCapacityFloats = 256 * INSTANCE_FLOATS;
        this._instanceBuffer = device.createBuffer({
            size: this._instanceCapacityFloats * 4,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.batcher = new SpriteBatcher(this);
    }
    /** Acquire a device + configure the canvas context. Rejects if WebGPU is
     *  unavailable. */
    static async create(canvas, options = {}) {
        if (!navigator.gpu) {
            throw new Error("WebGPU is not available in this browser.");
        }
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter)
            throw new Error("No suitable GPUAdapter found.");
        const device = await adapter.requestDevice();
        const context = canvas.getContext("webgpu");
        if (!context)
            throw new Error("Could not get a WebGPU canvas context.");
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format, alphaMode: "premultiplied" });
        return new WebGPURenderer(device, context, canvas, format, options);
    }
    /** The GPU device, for callers that need to create their own resources. */
    get device() {
        return this._device;
    }
    /** Resize the drawing buffer to match a CSS/display size. */
    resize(width, height) {
        this._canvas.width = width;
        this._canvas.height = height;
    }
    // ---- Frame ----
    /** Begin a frame: upload the camera matrix and open the render pass. */
    beginFrame(viewProjection) {
        packMat3Std140(viewProjection, this._uniformScratch);
        this._device.queue.writeBuffer(this._uniformBuffer, 0, this._uniformScratch);
        this._encoder = this._device.createCommandEncoder();
        this._pass = this._encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this._context.getCurrentTexture().createView(),
                    clearValue: this.clearColor,
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        });
        this._pass.setPipeline(this._pipeline);
        this._pass.setBindGroup(0, this._cameraBindGroup);
        this._pass.setVertexBuffer(0, this._quadBuffer);
    }
    /** End the frame: close the pass and submit. */
    endFrame() {
        if (!this._pass || !this._encoder)
            return;
        this._pass.end();
        this._device.queue.submit([this._encoder.finish()]);
        this._pass = null;
        this._encoder = null;
    }
    // ---- InstanceSink (called by the batcher inside a frame) ----
    writeInstances(data, count) {
        const floats = count * INSTANCE_FLOATS;
        if (floats > this._instanceCapacityFloats) {
            let cap = this._instanceCapacityFloats;
            while (cap < floats)
                cap *= 2;
            this._instanceCapacityFloats = cap;
            this._instanceBuffer.destroy();
            this._instanceBuffer = this._device.createBuffer({
                size: cap * 4,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
        }
        this._device.queue.writeBuffer(this._instanceBuffer, 0, data, 0, floats);
        this._pass?.setVertexBuffer(1, this._instanceBuffer);
    }
    draw(texture, first, count) {
        if (!this._pass)
            return;
        this._pass.setBindGroup(1, texture.bindGroup);
        this._pass.draw(4, count, 0, first);
    }
    // ---- Texture creation ----
    /** Upload an `ImageBitmap` (premultiplied) into a sampleable texture. */
    createTextureFromImage(image, frameWidth = 0, frameHeight = 0) {
        const gpu = this._device.createTexture({
            size: [image.width, image.height],
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this._device.queue.copyExternalImageToTexture({ source: image }, { texture: gpu, premultipliedAlpha: true }, [image.width, image.height]);
        const meta = new Texture(image.width, image.height, frameWidth, frameHeight);
        return this._entry(gpu, meta);
    }
    /** Create a solid-color texture from premultiplied RGBA bytes (default 1×1
     *  white — the surface untextured/solid quads sample). */
    createSolidTexture(rgba = new Uint8Array([255, 255, 255, 255]), width = 1, height = 1) {
        const gpu = this._device.createTexture({
            size: [width, height],
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        this._device.queue.writeTexture({ texture: gpu }, rgba, { bytesPerRow: width * 4, rowsPerImage: height }, [width, height]);
        return this._entry(gpu, new Texture(width, height));
    }
    _entry(gpu, meta) {
        const bindGroup = this._device.createBindGroup({
            layout: this._pipeline.getBindGroupLayout(1),
            entries: [
                { binding: 0, resource: gpu.createView() },
                { binding: 1, resource: this._sampler },
            ],
        });
        return { meta, gpu, bindGroup };
    }
}
