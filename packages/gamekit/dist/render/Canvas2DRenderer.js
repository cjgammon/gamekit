import { Texture } from "./Texture.js";
import { SceneWalker } from "./SceneWalker.js";
function hexColor(tint) {
    return `#${(tint & 0xffffff).toString(16).padStart(6, "0")}`;
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
export class Canvas2DRenderer {
    constructor(canvas, options = {}) {
        // Lazily built on the first draw() call, bound to whichever loader is passed
        // (a Canvas2DRenderer can't take its AssetLoader at construction — it IS the
        // loader's TextureFactory, so the loader must be built after the renderer).
        this._walker = null;
        const ctx = canvas.getContext("2d");
        if (!ctx)
            throw new Error("Could not get a 2D canvas context.");
        this._canvas = canvas;
        this.ctx = ctx;
        this._smoothing = (options.filter ?? "nearest") === "linear";
        this.clearColor = options.clearColor ?? "#000";
    }
    /** Resize the drawing buffer. */
    resize(width, height) {
        this._canvas.width = width;
        this._canvas.height = height;
    }
    // ---- Frame ----
    /** Draw `scene` for this frame. `alpha` is `Game.render`'s 0..1 factor. */
    draw(scene, alpha, loader) {
        if (!this._walker)
            this._walker = new SceneWalker(loader);
        this._walker.walk(scene, alpha, this);
    }
    // ---- DrawSink<Canvas2DTexture> ----
    beginPass(camera, alpha, pass, clear) {
        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = this._smoothing;
        if (clear) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = 1;
            ctx.fillStyle = this.clearColor;
            ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
        }
        if (pass === "world")
            this._setMatrix(camera.view(alpha));
        else
            ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    emit(inst) {
        const entry = inst.texture;
        const meta = entry.meta;
        const src = inst.tint === 0xffffff ? entry.source : this._tinted(entry, inst.tint);
        // Flips are baked into the UV sign by the walker (Texture.frameUV); decode
        // back to a plain (always-positive) source rect + a destination-side flip,
        // since drawImage's source width/height can't be negative.
        const flipX = inst.uScale < 0;
        const flipY = inst.vScale < 0;
        const sx = (flipX ? inst.u + inst.uScale : inst.u) * meta.width;
        const sy = (flipY ? inst.v + inst.vScale : inst.v) * meta.height;
        const sw = Math.abs(inst.uScale) * meta.width;
        const sh = Math.abs(inst.vScale) * meta.height;
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = inst.alpha;
        ctx.translate(inst.x + inst.originX * inst.width, inst.y + inst.originY * inst.height);
        if (inst.rotation)
            ctx.rotate(inst.rotation);
        if (flipX || flipY)
            ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        ctx.drawImage(src, sx, sy, sw, sh, -inst.originX * inst.width, -inst.originY * inst.height, inst.width, inst.height);
        ctx.restore();
    }
    endPass() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.globalAlpha = 1;
    }
    // ---- TextureFactory (used by AssetLoader) ----
    createTextureFromImage(image, frameWidth = 0, frameHeight = 0) {
        // Copy into a <canvas> so the source outlives the (closed) ImageBitmap and
        // can be a tint base.
        const c = document.createElement("canvas");
        c.width = image.width;
        c.height = image.height;
        c.getContext("2d").drawImage(image, 0, 0);
        return {
            meta: new Texture(image.width, image.height, frameWidth, frameHeight),
            source: c,
        };
    }
    createSolidTexture(rgba = new Uint8Array([255, 255, 255, 255]), width = 1, height = 1) {
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        const cx = c.getContext("2d");
        const img = cx.createImageData(width, height);
        for (let i = 0; i < width * height; i++) {
            img.data[i * 4] = rgba[0];
            img.data[i * 4 + 1] = rgba[1];
            img.data[i * 4 + 2] = rgba[2];
            img.data[i * 4 + 3] = rgba[3];
        }
        cx.putImageData(img, 0, 0);
        return { meta: new Texture(width, height), source: c };
    }
    // ---- Internal ----
    /** Set the 2D transform from a column-major {@link Mat3} (world → screen). */
    _setMatrix(m) {
        const v = m.values;
        this.ctx.setTransform(v[0], v[1], v[3], v[4], v[6], v[7]);
    }
    /** A multiplicatively-tinted copy of a texture, cached per tint. */
    _tinted(entry, tint) {
        let cache = entry.tintCache;
        if (!cache) {
            cache = new Map();
            entry.tintCache = cache;
        }
        const hit = cache.get(tint);
        if (hit)
            return hit;
        const meta = entry.meta;
        const c = document.createElement("canvas");
        c.width = meta.width;
        c.height = meta.height;
        const cx = c.getContext("2d");
        cx.drawImage(entry.source, 0, 0);
        cx.globalCompositeOperation = "multiply";
        cx.fillStyle = hexColor(tint);
        cx.fillRect(0, 0, meta.width, meta.height);
        cx.globalCompositeOperation = "destination-in"; // re-apply the alpha mask
        cx.drawImage(entry.source, 0, 0);
        cache.set(tint, c);
        return c;
    }
}
